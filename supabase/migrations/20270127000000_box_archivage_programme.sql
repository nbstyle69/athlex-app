-- ═════════════════════════════════════════════════════════════════════════════
-- Archivage d'une box et abonnements — PR 1 sur 3 (la base)
--
-- Appliquée en prod : NON
--
-- Règle validée le 25/09/2026 : archiver une box qui a encore des abonnements
-- actifs les arrête tous en fin de période payée (tout de suite pour les
-- impayés), abonnement de la box à AthleX compris. Tout le monde garde l'accès
-- jusque-là ; la box est archivée automatiquement quand plus rien ne paie. Les
-- arrêts Stripe sont faits par le Manager (PR 2) ; ici, la base seulement.
-- Relevé et plan : athlex-captures/archivage-abonnements/releve-et-plan.md.
--
-- 1. État « archivage programmé » : `boxes.archive_scheduled_at` (quand) et
--    `archive_scheduled_by` (qui, comme `archived_by`). Rien de plus : la date
--    d'archivage prévue se lit dans les abonnements qui paient encore (elle
--    bouge avec eux), et la stocker la ferait diverger.
--
-- 2. Une seule règle « la box accepte-t-elle des entrées ? » :
--    `box_accepts_entries(box)`, fausse si la box est archivée OU en archivage
--    programmé ; `internal.refus_entree_box(box, contexte)` en donne le refus
--    en clair (`BOX_ARCHIVEE` ou `BOX_ARCHIVAGE_PROGRAMME`, message selon
--    l'entrée). Elle ferme aussi le trou relevé : une box déjà archivée
--    acceptait encore des entrées.
--
-- 3. Gardes, dans le style de refus de chaque fonction (exception ou
--    `{ok: false, reason}`) :
--      rejoindre par code (`join_box_by_invite`, sauf le membre déjà actif) ;
--      invitations (`_consume_box_invitation`, donc `consume_box_invitation*`,
--        et `peek_box_invitation`, qui la présente) ;
--      essais (`book_trial_slot`, `list_public_trial_slots`) ;
--      offre gratuite (`subscribe_free_programming`) : par le déclencheur
--        ci-dessous sur `box_programming_subscriptions` (box abonnée ou
--        éditrice), qui la couvre entièrement — elle exige un gérant connecté ;
--      droits en attente (`claim_pending_entitlements` : le droit d'une box
--        fermée reste en attente, les autres sont réclamés) ;
--      inscription à un programme (`_upsert_program_member`, donc `join_program`
--        et `assign_program_cash`) ;
--      vente au comptoir (`_log_box_cash_payment`, donc
--        `record_member_cash_payment`, `mark_box_invitation_paid`,
--        `assign_program_cash`).
--    `book_appointment_slot` n'est pas une entrée : elle exige déjà d'être
--    membre actif, et les membres gardent l'accès jusqu'à l'archivage.
--    Écritures directes du client : un déclencheur BEFORE INSERT sur
--    `box_members`, `box_programming_subscriptions` et `box_invitations` (les
--    seules tables d'entrée où un client peut insérer : `program_members`,
--    `box_cash_payments`, `member_class_credits` n'ont ni droit ni règle
--    d'insertion pour lui) refuse les écritures des rôles client
--    (`authenticated`, `anon`) dans une box fermée. La clé serveur passe : les routes du Manager
--    sont gardées dans la PR 2, et un webhook qui termine un paiement déjà
--    encaissé ne doit pas être refusé par la base.
--
-- 4. Annuaire : une box en archivage programmé n'est plus lisible que par ses
--    membres, son staff et les admins (règle restrictive
--    `boxes_hide_archive_scheduled`) : elle disparaît de l'annuaire (app et
--    Manager lisent `boxes`) et de sa page publique pour tous les autres.
--
-- 5. Archivage automatique : `internal.archiver_boxes_echues()`, par la tâche
--    pg_cron `box_archive_sweep`, toutes les heures (à la 7e minute). Une box
--    programmée est archivée quand plus rien ne paie
--    (`internal.box_encore_payante`) : aucun membre avec un abonnement Stripe
--    actif, en essai ou en impayé ; aucun abonnement de programme actif ;
--    aucune offre vendue ou achetée active ou en impayé ; aucun abonnement de
--    la box à AthleX par Stripe actif, en essai ou en impayé. Un abonnement
--    `manual` et les membres au comptoir ne retardent rien. Chaque archivage
--    automatique est journalisé (`box_auto_archive_log`, lisible par le
--    super-admin). Toutes les heures : une fin de période tombe à une date,
--    le webhook de fin arrive au plus tôt à cette date, et un passage coûte
--    une requête sur les seules boxs programmées.
--
-- 6. Annulation : `unschedule_box_archive(box)`, super-admin seulement (ou la
--    clé serveur, par laquelle passe la route admin du Manager), tant que la
--    box n'est pas archivée. Elle rouvre les entrées ; les abonnements déjà
--    arrêtés le restent.
--
-- 7. Programmes payés en une fois : leurs acheteurs gardent la lecture du
--    programme et de son contenu après l'archivage (vérifié par le test ; les
--    règles en place ne regardent pas la box).
--
-- 8. Alerte : `box_archive_overdue()`, super-admin seulement (ou la clé
--    serveur) : les boxs programmées dont la dernière fin de période connue
--    des abonnements qui paient encore est dépassée de plus de 2 jours.
--
-- Aligne aussi le dépôt sur la prod : `box_subscriptions.billing_source`
-- (`stripe` ou `manual`) existe en prod sans migration ; il est ajouté ici à
-- l'identique, seulement s'il manque (sans effet en prod).
--
-- Contrôlée par `supabase/tests/box_archivage_programme.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Alignement sur la prod : billing_source ──────────────────────────────────
ALTER TABLE public.box_subscriptions ADD COLUMN IF NOT EXISTS billing_source text NOT NULL DEFAULT 'stripe';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.box_subscriptions'::regclass
                    AND conname = 'box_subscriptions_billing_source_check') THEN
    ALTER TABLE public.box_subscriptions ADD CONSTRAINT box_subscriptions_billing_source_check
      CHECK (billing_source = ANY (ARRAY['stripe'::text, 'manual'::text]));
  END IF;
END $$;

-- ── 1. État « archivage programmé » ──────────────────────────────────────────
ALTER TABLE public.boxes
  ADD COLUMN archive_scheduled_at timestamptz,
  ADD COLUMN archive_scheduled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── 2. La règle d'entrée ─────────────────────────────────────────────────────
-- Le refus en clair, ou NULL si la box accepte des entrées (ou n'existe pas :
-- chaque fonction garde alors son propre refus « introuvable »).
CREATE FUNCTION internal.refus_entree_box(p_box_id uuid, p_contexte text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_archivee   timestamptz;
  v_programmee timestamptz;
  v_code       text;
BEGIN
  SELECT archived_at, archive_scheduled_at INTO v_archivee, v_programmee
    FROM public.boxes WHERE id = p_box_id;
  IF v_archivee IS NOT NULL THEN
    v_code := 'BOX_ARCHIVEE';
  ELSIF v_programmee IS NOT NULL THEN
    v_code := 'BOX_ARCHIVAGE_PROGRAMME';
  ELSE
    RETURN NULL;
  END IF;
  RETURN v_code || ': ' || CASE p_contexte
    WHEN 'adhesion' THEN 'Cette box n''accepte plus de nouveaux membres.'
    WHEN 'essai'    THEN 'Cette box ne propose plus de séance d''essai.'
    WHEN 'comptoir' THEN CASE v_code WHEN 'BOX_ARCHIVEE' THEN 'Cette box est archivée : les ventes au comptoir sont fermées.'
                                     ELSE 'Cette box est en cours d''archivage : les ventes au comptoir sont fermées.' END
    ELSE 'Cette box n''accepte plus de nouvel abonnement ni d''achat.'
  END;
END;
$function$;
REVOKE ALL ON FUNCTION internal.refus_entree_box(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.box_accepts_entries(p_box_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.boxes
                  WHERE id = p_box_id AND archived_at IS NULL AND archive_scheduled_at IS NULL);
$function$;
REVOKE ALL ON FUNCTION public.box_accepts_entries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.box_accepts_entries(uuid) TO authenticated, service_role;

-- ── 3. Écritures directes du client ──────────────────────────────────────────
CREATE FUNCTION internal.refuser_entree_directe_box()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_refus text;
BEGIN
  -- Rôles client seulement : la clé serveur et les tâches passent.
  IF coalesce(auth.role(), '') NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME IN ('box_members', 'box_invitations') THEN
    v_refus := internal.refus_entree_box(NEW.box_id, 'adhesion');
  ELSIF TG_TABLE_NAME = 'box_programming_subscriptions' THEN
    v_refus := coalesce(
      internal.refus_entree_box(NEW.subscriber_box_id, 'achat'),
      internal.refus_entree_box((SELECT publisher_box_id FROM public.box_programming WHERE id = NEW.programming_id), 'achat'));
  END IF;
  IF v_refus IS NOT NULL THEN
    RAISE EXCEPTION '%', v_refus USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.refuser_entree_directe_box() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_box_members_entree_box
  BEFORE INSERT ON public.box_members
  FOR EACH ROW EXECUTE FUNCTION internal.refuser_entree_directe_box();
CREATE TRIGGER trg_box_programming_subscriptions_entree_box
  BEFORE INSERT ON public.box_programming_subscriptions
  FOR EACH ROW EXECUTE FUNCTION internal.refuser_entree_directe_box();
CREATE TRIGGER trg_box_invitations_entree_box
  BEFORE INSERT ON public.box_invitations
  FOR EACH ROW EXECUTE FUNCTION internal.refuser_entree_directe_box();

-- ── 4. Annuaire ──────────────────────────────────────────────────────────────
-- Restrictive, lecture seulement : ses membres, son staff et les admins la
-- voient encore (ils gardent l'accès) ; les autres, anon compris, non.
CREATE POLICY boxes_hide_archive_scheduled ON public.boxes
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (archive_scheduled_at IS NULL
         OR owner_id = auth.uid()
         OR id IN (SELECT public.get_user_box_ids())
         OR public.is_box_admin(id));

-- ── 5. Archivage automatique ─────────────────────────────────────────────────
CREATE FUNCTION internal.box_encore_payante(p_box_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.box_members bm
                  WHERE bm.box_id = p_box_id AND bm.stripe_subscription_id IS NOT NULL
                    AND bm.subscription_status IN ('active', 'trialing', 'past_due'))
      OR EXISTS (SELECT 1 FROM public.program_members pm JOIN public.programs p ON p.id = pm.program_id
                  WHERE p.box_id = p_box_id AND pm.stripe_subscription_id IS NOT NULL AND pm.status = 'active')
      OR EXISTS (SELECT 1 FROM public.box_programming_subscriptions s
                   LEFT JOIN public.box_programming bp ON bp.id = s.programming_id
                  WHERE (s.subscriber_box_id = p_box_id OR bp.publisher_box_id = p_box_id)
                    AND s.stripe_subscription_id IS NOT NULL AND s.status IN ('active', 'past_due'))
      OR EXISTS (SELECT 1 FROM public.box_subscriptions bs
                  WHERE bs.box_id = p_box_id AND bs.billing_source = 'stripe'
                    AND bs.status IN ('active', 'trialing', 'past_due'));
$function$;
REVOKE ALL ON FUNCTION internal.box_encore_payante(uuid) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.box_auto_archive_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id       uuid NOT NULL,
  scheduled_at timestamptz,
  scheduled_by uuid,
  archived_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.box_auto_archive_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.box_auto_archive_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.box_auto_archive_log TO authenticated, service_role;
CREATE POLICY box_auto_archive_log_super_admin_read ON public.box_auto_archive_log
  FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE FUNCTION internal.archiver_boxes_echues()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r   record;
  v_n integer := 0;
BEGIN
  FOR r IN
    SELECT b.id, b.archive_scheduled_at, b.archive_scheduled_by
      FROM public.boxes b
     WHERE b.archive_scheduled_at IS NOT NULL AND b.archived_at IS NULL
       AND NOT internal.box_encore_payante(b.id)
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.boxes SET archived_at = now(), archived_by = r.archive_scheduled_by WHERE id = r.id;
    INSERT INTO public.box_auto_archive_log (box_id, scheduled_at, scheduled_by)
    VALUES (r.id, r.archive_scheduled_at, r.archive_scheduled_by);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION internal.archiver_boxes_echues() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'box_archive_sweep') THEN
      PERFORM cron.unschedule('box_archive_sweep');
    END IF;
    PERFORM cron.schedule('box_archive_sweep', '7 * * * *', $cron$ SELECT internal.archiver_boxes_echues(); $cron$);
  ELSE
    RAISE NOTICE 'pg_cron indisponible : les boxs programmées ne seront pas archivées automatiquement.';
  END IF;
END $$;

-- ── 6. Annulation ────────────────────────────────────────────────────────────
CREATE FUNCTION public.unschedule_box_archive(p_box_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_archivee   timestamptz;
  v_programmee timestamptz;
BEGIN
  IF NOT (public.is_super_admin() OR coalesce(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'Accès refusé : super-admin requis' USING ERRCODE = '42501';
  END IF;
  SELECT archived_at, archive_scheduled_at INTO v_archivee, v_programmee
    FROM public.boxes WHERE id = p_box_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOX_INCONNUE' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_archivee IS NOT NULL THEN
    RAISE EXCEPTION 'BOX_DEJA_ARCHIVEE: cette box est déjà archivée, l''archivage ne s''annule plus.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_programmee IS NULL THEN
    RAISE EXCEPTION 'ARCHIVAGE_NON_PROGRAMME: aucun archivage n''est programmé pour cette box.'
      USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.boxes SET archive_scheduled_at = NULL, archive_scheduled_by = NULL WHERE id = p_box_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.unschedule_box_archive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unschedule_box_archive(uuid) TO authenticated, service_role;

-- ── 8. Alerte ────────────────────────────────────────────────────────────────
CREATE FUNCTION public.box_archive_overdue()
 RETURNS TABLE(box_id uuid, box_name text, archive_scheduled_at timestamptz, last_period_end timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (public.is_super_admin() OR coalesce(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'Accès refusé : super-admin requis' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT b.id, b.name, b.archive_scheduled_at, f.fin
    FROM public.boxes b
    CROSS JOIN LATERAL (
      SELECT max(u.fin) AS fin FROM (
        SELECT bm.subscription_current_period_end AS fin FROM public.box_members bm
         WHERE bm.box_id = b.id AND bm.stripe_subscription_id IS NOT NULL
           AND bm.subscription_status IN ('active', 'trialing', 'past_due')
        UNION ALL
        SELECT bs.current_period_end FROM public.box_subscriptions bs
         WHERE bs.box_id = b.id AND bs.billing_source = 'stripe'
           AND bs.status IN ('active', 'trialing', 'past_due')
        UNION ALL
        SELECT s.current_period_end FROM public.box_programming_subscriptions s
          LEFT JOIN public.box_programming bp ON bp.id = s.programming_id
         WHERE (s.subscriber_box_id = b.id OR bp.publisher_box_id = b.id)
           AND s.stripe_subscription_id IS NOT NULL AND s.status IN ('active', 'past_due')
      ) u
    ) f
   WHERE b.archive_scheduled_at IS NOT NULL AND b.archived_at IS NULL
     AND f.fin < now() - interval '2 days'
   ORDER BY f.fin;
END;
$function$;
REVOKE ALL ON FUNCTION public.box_archive_overdue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.box_archive_overdue() TO authenticated, service_role;

-- ── Gardes des fonctions d'entrée (définitions reprises de la prod, octet pour
-- octet ; seules changent les lignes de la garde) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.join_box_by_invite(p_invite_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_box_id uuid;
  v_owner  uuid;
  v_status text;
  v_role   text;
  v_refus  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: connexion requise' USING ERRCODE = 'check_violation';
  END IF;

  SELECT id, owner_id INTO v_box_id, v_owner
  FROM public.boxes
  WHERE upper(invite_code) = upper(btrim(p_invite_code)) AND is_active = true;

  IF v_box_id IS NULL THEN
    RAISE EXCEPTION 'Code invalide ou box introuvable';
  END IF;

  -- Un owner « primaire » qui rejoint sa propre box par le code ne doit pas se
  -- retrouver simple membre (même cas qu'aux lots 1C-a / 1C-c).
  v_role := CASE WHEN v_owner = auth.uid() THEN 'owner' ELSE 'member' END;

  SELECT status INTO v_status
  FROM public.box_members
  WHERE box_id = v_box_id AND member_id = auth.uid();

  -- Box archivée ou en archivage programmé : plus d'entrée (migration 20270127).
  -- Le membre déjà actif retombe sur le cas 3, sans effet.
  IF v_status IS DISTINCT FROM 'active' THEN
    v_refus := internal.refus_entree_box(v_box_id, 'adhesion');
    IF v_refus IS NOT NULL THEN
      RAISE EXCEPTION '%', v_refus USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 1. Jamais membre → adhésion normale.
  IF v_status IS NULL THEN
    INSERT INTO public.box_members (box_id, member_id, status, role)
    VALUES (v_box_id, auth.uid(), 'active', v_role)
    ON CONFLICT (box_id, member_id) DO NOTHING;   -- course entre deux appels
    RETURN v_box_id;
  END IF;

  -- 2. Exclu → refus EXPLICITE. Sans ce garde-fou, la réactivation du point 3
  --    réadmettrait un membre banni via le code d'invitation de la box.
  IF v_status = 'banned' THEN
    RAISE EXCEPTION 'BANNED: votre acces a cette box a ete revoque'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Déjà membre → idempotent (l'app peut rappeler le code sans effet de bord).
  IF v_status = 'active' THEN
    RETURN v_box_id;
  END IF;

  -- 4. Ex-membre (`inactive`) → réactivation PROPRE.
  --    Aucun élément d'abonnement n'est ressuscité : ni forfait, ni identifiants
  --    Stripe, ni engagement, ni compteurs de relance. Le membre revient comme
  --    un nouvel arrivant et souscrira à nouveau s'il le souhaite.
  UPDATE public.box_members SET
    status                            = 'active',
    role                              = v_role,
    plan_id                           = NULL,
    subscription_status               = NULL,
    stripe_subscription_id            = NULL,
    stripe_checkout_session_id        = NULL,
    subscription_current_period_end   = NULL,
    amount_cents                      = NULL,
    platform_fee_cents                = NULL,
    subscription_cancel_at_period_end = false,
    commitment_end_date               = NULL,
    subscription_paused               = false,
    pause_started_at                  = NULL,
    pause_resumes_at                  = NULL,
    payment_method_type               = NULL,
    past_due_since                    = NULL,
    dunning_attempts                  = 0,
    last_payment_error                = NULL,
    dunning_reminders_sent            = 0,
    dunning_last_reminder_at          = NULL
  WHERE box_id = v_box_id AND member_id = auth.uid();

  RETURN v_box_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public._consume_box_invitation(p_token text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r            public.box_invitations;
  v_user_email text;
  v_member     public.box_members;
  v_status     text;
  v_sub_status text;
  v_pay_method text;
  v_refus      text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: connexion requise' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO r FROM public.box_invitations
  WHERE token_hash = encode(sha256(btrim(coalesce(p_token, ''))::bytea), 'hex')
  FOR UPDATE;

  IF r.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invitation_introuvable');
  END IF;

  -- Rejeu du même lien par la même personne : succès sans double effet.
  IF r.status = 'accepted' THEN
    IF r.accepted_by = p_user_id THEN
      RETURN jsonb_build_object('ok', true, 'already', true, 'box_id', r.box_id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'invitation_deja_utilisee');
  END IF;

  IF r.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invitation_revoquee');
  END IF;
  IF r.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invitation_expiree');
  END IF;

  -- Box archivée ou en archivage programmé : plus d'entrée (migration 20270127).
  v_refus := internal.refus_entree_box(r.box_id, 'adhesion');
  IF v_refus IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', lower(split_part(v_refus, ':', 1)),
                              'message', btrim(substr(v_refus, position(':' in v_refus) + 1)));
  END IF;

  -- L'invitation est nominative : le compte doit porter l'adresse invitée.
  SELECT lower(btrim(email)) INTO v_user_email FROM public.profiles WHERE id = p_user_id;
  IF v_user_email IS NULL OR v_user_email <> r.email THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_non_correspondant');
  END IF;

  IF r.payment_mode = 'box' AND r.cash_collected THEN
    v_status     := 'active';
    v_sub_status := 'active';
    v_pay_method := 'cash';
  ELSIF r.payment_mode = 'box' THEN
    v_status     := 'inactive';
    v_sub_status := 'pending_cash';
    v_pay_method := 'cash';
  ELSE
    v_status     := 'inactive';
    v_sub_status := 'pending_payment';
    v_pay_method := NULL;
  END IF;

  SELECT * INTO v_member FROM public.box_members
  WHERE box_id = r.box_id AND member_id = p_user_id;

  IF v_member.id IS NULL THEN
    INSERT INTO public.box_members (
      box_id, member_id, role, plan_id, status, subscription_status, payment_method_type
    ) VALUES (
      r.box_id, p_user_id, 'member', r.plan_id, v_status, v_sub_status, v_pay_method
    )
    ON CONFLICT (box_id, member_id) DO NOTHING;
  ELSE
    IF v_member.status = 'banned' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'membre_exclu');
    END IF;

    UPDATE public.box_members SET
      plan_id             = coalesce(r.plan_id, plan_id),
      status              = CASE WHEN status = 'active' THEN 'active' ELSE v_status END,
      subscription_status = CASE WHEN status = 'active' AND v_status <> 'active'
                                 THEN subscription_status ELSE v_sub_status END,
      payment_method_type = coalesce(v_pay_method, payment_method_type)
    WHERE id = v_member.id;
  END IF;

  UPDATE public.box_invitations
  SET status = 'accepted', accepted_by = p_user_id, accepted_at = now()
  WHERE id = r.id;

  RETURN jsonb_build_object(
    'ok', true, 'already', false,
    'invitation_id', r.id,
    'box_id', r.box_id, 'plan_id', r.plan_id,
    'payment_mode', r.payment_mode,
    'member_status', v_status, 'subscription_status', v_sub_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.peek_box_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r      public.box_invitations;
  v_box  public.boxes;
  v_plan public.membership_plans;
  v_refus text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_absent');
  END IF;

  SELECT * INTO r FROM public.box_invitations
  WHERE token_hash = encode(sha256(btrim(p_token)::bytea), 'hex');

  IF r.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invitation_introuvable');
  END IF;
  IF r.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invitation_revoquee');
  END IF;
  IF r.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invitation_deja_utilisee');
  END IF;
  IF r.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invitation_expiree');
  END IF;

  -- Box archivée ou en archivage programmé : plus d'entrée (migration 20270127).
  v_refus := internal.refus_entree_box(r.box_id, 'adhesion');
  IF v_refus IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', lower(split_part(v_refus, ':', 1)),
                              'message', btrim(substr(v_refus, position(':' in v_refus) + 1)));
  END IF;

  SELECT * INTO v_box  FROM public.boxes            WHERE id = r.box_id;
  SELECT * INTO v_plan FROM public.membership_plans WHERE id = r.plan_id;

  RETURN jsonb_build_object(
    'ok', true,
    'email',        r.email,          -- son propre e-mail : il le connaît déjà
    'first_name',   r.first_name,
    'last_name',    r.last_name,
    'payment_mode', r.payment_mode,
    'expires_at',   r.expires_at,
    'box', jsonb_build_object(
      'name', v_box.name, 'slug', v_box.slug,
      'city', v_box.city, 'logo_url', v_box.logo_url
    ),
    'plan', CASE WHEN v_plan.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_plan.name, 'description', v_plan.description,
      'price_cents', v_plan.price_cents, 'currency', v_plan.currency,
      'plan_type', v_plan.plan_type,
      'max_sessions_per_week', v_plan.max_sessions_per_week,
      'commitment_months', v_plan.commitment_months
    ) END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.book_trial_slot(p_box_id uuid, p_schedule_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  -- Plafonds anti-abus tenus EN BASE (l'e-mail est prouvable ici ; l'IP est
  -- prononcée dans la route Next.js — `request.headers` n'est pas mesurable
  -- depuis SQL, et une limite supposée n'est pas une limite).
  c_max_par_box     CONSTANT int := 2;   -- essais dans la même box
  c_max_fenetre     CONSTANT int := 5;   -- essais toutes box confondues…
  c_fenetre         CONSTANT interval := interval '7 days';

  v_plan        public.membership_plans;
  v_sched       public.class_schedules;
  v_email       text := lower(btrim(COALESCE(p_email, '')));
  v_prenom      text := btrim(COALESCE(p_first_name, ''));
  v_nom         text := NULLIF(btrim(COALESCE(p_last_name, '')), '');
  v_tel         text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_confirmed   int;
  v_prospect_id uuid;
  v_res_id      uuid;
  v_status      text;
  v_refus       text;
BEGIN
  IF v_prenom = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'prenom_absent');
  END IF;

  IF v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_invalide');
  END IF;

  -- Box archivée ou en archivage programmé : plus d'entrée (migration 20270127).
  v_refus := internal.refus_entree_box(p_box_id, 'essai');
  IF v_refus IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', lower(split_part(v_refus, ':', 1)),
                              'message', btrim(substr(v_refus, position(':' in v_refus) + 1)));
  END IF;

  SELECT * INTO v_plan
  FROM public.membership_plans
  WHERE box_id = p_box_id AND plan_type = 'trial' AND is_active;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'offre_essai_absente');
  END IF;

  SELECT * INTO v_sched
  FROM public.class_schedules
  WHERE id = p_schedule_id AND box_id = p_box_id;

  IF v_sched.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'creneau_introuvable');
  END IF;

  IF (v_sched.scheduled_date + v_sched.start_time::time) <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'creneau_passe');
  END IF;

  -- Doublon exact : ce visiteur a déjà ce créneau.
  IF EXISTS (
    SELECT 1 FROM public.box_prospects
    WHERE box_id = p_box_id AND email = v_email AND schedule_id = p_schedule_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deja_reserve');
  END IF;

  IF (SELECT COUNT(*) FROM public.box_prospects
      WHERE box_id = p_box_id AND email = v_email) >= c_max_par_box THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plafond_box_atteint');
  END IF;

  IF (SELECT COUNT(*) FROM public.box_prospects
      WHERE email = v_email AND created_at > now() - c_fenetre) >= c_max_fenetre THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plafond_fenetre_atteint');
  END IF;

  -- Même verrou que `enforce_reservation_capacity`, donc le comptage ci-dessous
  -- ne peut pas être doublé par une réservation concurrente.
  PERFORM pg_advisory_xact_lock(hashtext('resa:' || p_schedule_id::text));

  SELECT COUNT(*) INTO v_confirmed
  FROM public.class_reservations
  WHERE schedule_id = p_schedule_id AND status = 'confirmed';

  IF v_confirmed >= v_sched.max_capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'creneau_complet');
  END IF;

  INSERT INTO public.box_prospects (box_id, first_name, last_name, email, phone, plan_id, schedule_id)
  VALUES (p_box_id, v_prenom, v_nom, v_email, v_tel, v_plan.id, p_schedule_id)
  RETURNING id INTO v_prospect_id;

  INSERT INTO public.class_reservations (schedule_id, box_id, member_id, prospect_id, is_trial, status)
  VALUES (p_schedule_id, p_box_id, NULL, v_prospect_id, true, 'confirmed')
  RETURNING id, status INTO v_res_id, v_status;

  -- Le trigger a le dernier mot : on relit ce qu'il a écrit. Un essai ne va
  -- jamais en liste d'attente.
  IF v_status <> 'confirmed' THEN
    RAISE EXCEPTION 'ESSAI_NON_CONFIRME'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'prospect_id', v_prospect_id,
    'reservation_id', v_res_id,
    'plan', jsonb_build_object('id', v_plan.id, 'name', v_plan.name),
    'slot', jsonb_build_object(
      'schedule_id', v_sched.id, 'title', v_sched.title,
      'scheduled_date', v_sched.scheduled_date,
      'start_time', v_sched.start_time, 'end_time', v_sched.end_time
    )
  );
EXCEPTION
  -- Deux mains sur le même créneau, ou le trigger qui bascule en `waiting` :
  -- la transaction de la fonction est annulée, donc aucun prospect orphelin.
  WHEN check_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'creneau_complet');
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deja_reserve');
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_public_trial_slots(p_box_id uuid, p_days integer DEFAULT 21)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_box   public.boxes;
  v_plan  public.membership_plans;
  v_slots jsonb;
  v_days  int := LEAST(GREATEST(COALESCE(p_days, 21), 1), 60);
  v_refus text;
BEGIN
  IF p_box_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'box_absente');
  END IF;

  SELECT * INTO v_box FROM public.boxes WHERE id = p_box_id AND is_active;
  IF v_box.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'box_introuvable');
  END IF;

  -- Box archivée ou en archivage programmé : plus d'entrée (migration 20270127).
  v_refus := internal.refus_entree_box(p_box_id, 'essai');
  IF v_refus IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', lower(split_part(v_refus, ':', 1)),
                              'message', btrim(substr(v_refus, position(':' in v_refus) + 1)));
  END IF;

  SELECT * INTO v_plan
  FROM public.membership_plans
  WHERE box_id = p_box_id AND plan_type = 'trial' AND is_active;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'offre_essai_absente');
  END IF;

  -- Seuls les créneaux À VENIR et NON COMPLETS sont proposés. Les places
  -- restantes se comptent sur les réservations confirmées — essais compris,
  -- puisqu'un essai prend une vraie place.
  SELECT COALESCE(jsonb_agg(s ORDER BY s.scheduled_date, s.start_time), '[]'::jsonb)
    INTO v_slots
  FROM (
    SELECT cs.id AS schedule_id,
           cs.title,
           cs.coach,
           cs.scheduled_date,
           cs.start_time,
           cs.end_time,
           cs.max_capacity,
           cs.max_capacity - COUNT(cr.id) FILTER (WHERE cr.status = 'confirmed') AS seats_left
    FROM public.class_schedules cs
    LEFT JOIN public.class_reservations cr ON cr.schedule_id = cs.id
    WHERE cs.box_id = p_box_id
      AND (cs.scheduled_date + cs.start_time::time) > now()
      AND cs.scheduled_date <= (now()::date + v_days)
    GROUP BY cs.id
    HAVING cs.max_capacity - COUNT(cr.id) FILTER (WHERE cr.status = 'confirmed') > 0
  ) s;

  RETURN jsonb_build_object(
    'ok', true,
    'box',  jsonb_build_object('id', v_box.id, 'name', v_box.name, 'slug', v_box.slug, 'city', v_box.city),
    'plan', jsonb_build_object(
      'id', v_plan.id, 'name', v_plan.name,
      'description', v_plan.description, 'terms', v_plan.terms
    ),
    'slots', v_slots
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_pending_entitlements(p_user_id uuid, p_email text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.pending_entitlements;
  v_claimed integer := 0;
  v_member_id uuid;
  v_box uuid;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT * FROM public.pending_entitlements
    WHERE email = lower(btrim(p_email))
      AND claimed_at IS NULL
    ORDER BY created_at
    FOR UPDATE
  LOOP
    -- Box archivée ou en archivage programmé (migration 20270127) : le droit,
    -- déjà payé, reste en attente ; les droits des autres boxs sont réclamés.
    v_box := CASE WHEN r.kind = 'program'
                  THEN (SELECT box_id FROM public.programs WHERE id = (r.payload->>'program_id')::uuid)
                  ELSE (r.payload->>'box_id')::uuid END;
    IF internal.refus_entree_box(v_box, 'achat') IS NOT NULL THEN
      CONTINUE;
    END IF;

    IF r.kind = 'membership' THEN
      SELECT id INTO v_member_id FROM public.box_members
      WHERE box_id = (r.payload->>'box_id')::uuid AND member_id = p_user_id;

      IF v_member_id IS NULL THEN
        INSERT INTO public.box_members (
          box_id, member_id, role, plan_id, status, subscription_status,
          stripe_subscription_id, stripe_checkout_session_id,
          subscription_current_period_end, amount_cents, platform_fee_cents,
          commitment_end_date, payment_method_type
        ) VALUES (
          (r.payload->>'box_id')::uuid, p_user_id, 'member',
          (r.payload->>'plan_id')::uuid, 'active', 'active',
          r.payload->>'stripe_subscription_id', r.stripe_checkout_session_id,
          (r.payload->>'subscription_current_period_end')::timestamptz,
          (r.payload->>'amount_cents')::integer,
          (r.payload->>'platform_fee_cents')::integer,
          (r.payload->>'commitment_end_date')::timestamptz,
          r.payload->>'payment_method_type'
        );
      ELSE
        UPDATE public.box_members SET
          plan_id = (r.payload->>'plan_id')::uuid,
          status = 'active',
          subscription_status = 'active',
          stripe_subscription_id = r.payload->>'stripe_subscription_id',
          stripe_checkout_session_id = r.stripe_checkout_session_id,
          subscription_current_period_end = (r.payload->>'subscription_current_period_end')::timestamptz,
          amount_cents = (r.payload->>'amount_cents')::integer,
          platform_fee_cents = (r.payload->>'platform_fee_cents')::integer,
          commitment_end_date = (r.payload->>'commitment_end_date')::timestamptz,
          payment_method_type = r.payload->>'payment_method_type'
        WHERE id = v_member_id;
      END IF;

    ELSIF r.kind = 'credit' THEN
      -- La validité court à partir de la réclamation : des séances prépayées
      -- ne doivent pas expirer pendant que l'acheteur n'a pas encore de compte.
      INSERT INTO public.member_class_credits (
        box_id, member_id, plan_id, credits_total, credits_used,
        expires_at, status, stripe_checkout_session_id, stripe_payment_intent
      ) VALUES (
        (r.payload->>'box_id')::uuid, p_user_id,
        NULLIF(r.payload->>'plan_id', '')::uuid,
        (r.payload->>'credits')::integer, 0,
        now() + make_interval(days => (r.payload->>'validity_days')::integer),
        'active', r.stripe_checkout_session_id, r.payload->>'stripe_payment_intent'
      )
      -- Index unique PARTIEL en prod (uq_member_class_credits_session) :
      -- l'inférence exige de répéter son prédicat.
      ON CONFLICT (stripe_checkout_session_id)
        WHERE stripe_checkout_session_id IS NOT NULL DO NOTHING;

    ELSIF r.kind = 'program' THEN
      INSERT INTO public.program_members (
        program_id, user_id, start_date, amount_cents, platform_fee_cents,
        status, stripe_checkout_session_id, stripe_subscription_id, stripe_payment_intent
      ) VALUES (
        (r.payload->>'program_id')::uuid, p_user_id, NULL,
        (r.payload->>'amount_cents')::integer,
        (r.payload->>'platform_fee_cents')::integer,
        'active', r.stripe_checkout_session_id,
        r.payload->>'stripe_subscription_id', r.payload->>'stripe_payment_intent'
      )
      ON CONFLICT (program_id, user_id) DO UPDATE SET
        status = 'active',
        stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_payment_intent = EXCLUDED.stripe_payment_intent;
    END IF;

    UPDATE public.pending_entitlements
    SET claimed_at = now(), claimed_by = p_user_id
    WHERE id = r.id;
    v_claimed := v_claimed + 1;
  END LOOP;

  RETURN v_claimed;
END;
$function$;

CREATE OR REPLACE FUNCTION public._upsert_program_member(p_program_id uuid, p_user_id uuid, p_start_date date, p_provenance text, p_amount_cents integer DEFAULT NULL::integer, p_platform_fee_cents integer DEFAULT NULL::integer, p_stripe_checkout_session_id text DEFAULT NULL::text, p_stripe_subscription_id text DEFAULT NULL::text, p_stripe_payment_intent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
  v_refus text;
BEGIN
  -- Box archivée ou en archivage programmé : plus d'entrée (migration 20270127).
  v_refus := internal.refus_entree_box((SELECT box_id FROM public.programs WHERE id = p_program_id), 'achat');
  IF v_refus IS NOT NULL THEN
    RAISE EXCEPTION '%', v_refus USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.program_members (
    program_id, user_id, start_date, status, provenance,
    amount_cents, platform_fee_cents,
    stripe_checkout_session_id, stripe_subscription_id, stripe_payment_intent
  ) VALUES (
    p_program_id, p_user_id, p_start_date, 'active', p_provenance,
    CASE WHEN p_provenance = 'stripe' THEN p_amount_cents END,
    CASE WHEN p_provenance = 'stripe' THEN p_platform_fee_cents END,
    p_stripe_checkout_session_id, p_stripe_subscription_id, p_stripe_payment_intent
  )
  ON CONFLICT (program_id, user_id) DO UPDATE SET
    status = 'active',
    provenance = CASE
      WHEN EXCLUDED.provenance = 'stripe' THEN 'stripe'
      WHEN EXCLUDED.provenance = 'cash'
           AND program_members.provenance <> 'stripe' THEN 'cash'
      ELSE program_members.provenance
    END,
    start_date = COALESCE(EXCLUDED.start_date, program_members.start_date),
    amount_cents = COALESCE(EXCLUDED.amount_cents, program_members.amount_cents),
    platform_fee_cents = COALESCE(EXCLUDED.platform_fee_cents, program_members.platform_fee_cents),
    stripe_checkout_session_id = COALESCE(EXCLUDED.stripe_checkout_session_id, program_members.stripe_checkout_session_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, program_members.stripe_subscription_id),
    stripe_payment_intent = COALESCE(EXCLUDED.stripe_payment_intent, program_members.stripe_payment_intent)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public._log_box_cash_payment(p_box_id uuid, p_member_id uuid, p_invitation_id uuid, p_plan_id uuid, p_source text, p_program_id uuid DEFAULT NULL::uuid, p_amount_cents integer DEFAULT NULL::integer, p_label text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_plan public.membership_plans;
  v_id   uuid;
  v_refus text;
BEGIN
  -- Box archivée ou en archivage programmé : plus d'entrée (migration 20270127).
  v_refus := internal.refus_entree_box(p_box_id, 'comptoir');
  IF v_refus IS NOT NULL THEN
    RAISE EXCEPTION '%', v_refus USING ERRCODE = 'check_violation';
  END IF;

  IF p_source = 'program' THEN
    -- Le montant d'un encaissement de programme vient de l'appelant, qui l'a
    -- borné au prix. Ici on refuse seulement l'absurde.
    IF coalesce(p_amount_cents, 0) <= 0 OR p_program_id IS NULL THEN
      RETURN NULL;
    END IF;

    INSERT INTO public.box_cash_payments (
      box_id, member_id, invitation_id, plan_id, plan_name,
      program_id, amount_cents, source, collected_by
    ) VALUES (
      p_box_id, p_member_id, NULL, NULL, p_label,
      p_program_id, p_amount_cents, 'program', auth.uid()
    )
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  SELECT * INTO v_plan FROM public.membership_plans WHERE id = p_plan_id;

  -- Sans formule, il n'y a pas de montant de référence : journaliser un zéro
  -- serait pire que ne rien journaliser, il ferait croire à un encaissement nul.
  IF v_plan.id IS NULL OR coalesce(v_plan.price_cents, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.box_cash_payments (
    box_id, member_id, invitation_id, plan_id, plan_name,
    amount_cents, source, collected_by
  ) VALUES (
    p_box_id, p_member_id, p_invitation_id, p_plan_id, v_plan.name,
    v_plan.price_cents, p_source, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

COMMIT;
