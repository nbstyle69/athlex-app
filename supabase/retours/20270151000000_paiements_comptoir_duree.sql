-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270151000000_paiements_comptoir_duree.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test paiements_comptoir_duree.sql le rejoue
-- dans sa propre transaction annulée).
--
-- Définitions rétablies octet pour octet (md5 de pg_get_functiondef, search_path
-- "$user", public, extensions ; relevés de prod du 13/10/2026, précontrôle
-- comptoir-p1, à recontrôler en prod avant l'application) :
--   public.record_member_cash_payment(uuid)            05ac1a6c13381169de8c887970461ce9
--   public.mark_box_invitation_paid(uuid)              58f668fc4ef9454fee71cddb0263965c
--   public._log_box_cash_payment(8 arguments)          d5361a6e55adcbeccb3f0abb752a5995
--   public.reject_cash_payment_rewrite()               d1c6053375305c67197ad659d42a0926
--   internal.garder_facturation_membre()               b50e8f8843dbe51848862942b3f3602f
--   public._consume_box_invitation(text,uuid)          78b0d0a212111ddec7e08ecfb684640f
--   public.create_box_invitation(9 arguments)          f9412cbc5e1d03d4de7483c8bb6e6e2f
--   déclencheur trg_box_members_garde_facturation      05e9de13a14666cd9b5d99040e8da0c3
-- Droits rétablis tels qu'en prod, y compris l'EXECUTE de _log_box_cash_payment
-- par authenticated et service_role (hérité des privilèges par défaut).
-- Perdu au retour : les périodes journalisées (period_months, access_from,
-- access_until), les fins d'accès des membres et des invitations, le réglage
-- allow_counter_renewal des boxes.
-- ═════════════════════════════════════════════════════════════════════════════

-- Garde de facturation et son déclencheur, d'abord : la liste UPDATE OF
-- dépend de la colonne retirée plus bas.
CREATE OR REPLACE FUNCTION internal.garder_facturation_membre()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF ROW(
        NEW.plan_id,
        NEW.subscription_status,
        NEW.stripe_subscription_id,
        NEW.stripe_checkout_session_id,
        NEW.subscription_current_period_end,
        NEW.subscription_cancel_at_period_end,
        NEW.amount_cents,
        NEW.platform_fee_cents,
        NEW.commitment_end_date,
        NEW.subscription_paused,
        NEW.pause_started_at,
        NEW.pause_resumes_at,
        NEW.payment_method_type,
        NEW.past_due_since,
        NEW.dunning_attempts,
        NEW.last_payment_error,
        NEW.dunning_reminders_sent,
        NEW.dunning_last_reminder_at,
        NEW.billing_day,
        NEW.scheduled_plan_id,
        NEW.scheduled_change_at,
        NEW.stripe_schedule_id
       ) IS DISTINCT FROM ROW(
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        false,
        NULL,
        NULL,
        NULL,
        false,
        NULL,
        NULL,
        NULL,
        NULL,
        0,
        NULL,
        0,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
       ) THEN
      RAISE EXCEPTION 'MEMBRE_FACTURATION_RESERVEE: la facturation d''un membre est écrite par le serveur (paiement, Manager), jamais depuis le navigateur ou l''app.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF ROW(
      NEW.plan_id,
        NEW.subscription_status,
        NEW.stripe_subscription_id,
        NEW.stripe_checkout_session_id,
        NEW.subscription_current_period_end,
        NEW.subscription_cancel_at_period_end,
        NEW.amount_cents,
        NEW.platform_fee_cents,
        NEW.commitment_end_date,
        NEW.subscription_paused,
        NEW.pause_started_at,
        NEW.pause_resumes_at,
        NEW.payment_method_type,
        NEW.past_due_since,
        NEW.dunning_attempts,
        NEW.last_payment_error,
        NEW.dunning_reminders_sent,
        NEW.dunning_last_reminder_at,
        NEW.billing_day,
        NEW.scheduled_plan_id,
        NEW.scheduled_change_at,
        NEW.stripe_schedule_id
     ) IS DISTINCT FROM ROW(
      OLD.plan_id,
        OLD.subscription_status,
        OLD.stripe_subscription_id,
        OLD.stripe_checkout_session_id,
        OLD.subscription_current_period_end,
        OLD.subscription_cancel_at_period_end,
        OLD.amount_cents,
        OLD.platform_fee_cents,
        OLD.commitment_end_date,
        OLD.subscription_paused,
        OLD.pause_started_at,
        OLD.pause_resumes_at,
        OLD.payment_method_type,
        OLD.past_due_since,
        OLD.dunning_attempts,
        OLD.last_payment_error,
        OLD.dunning_reminders_sent,
        OLD.dunning_last_reminder_at,
        OLD.billing_day,
        OLD.scheduled_plan_id,
        OLD.scheduled_change_at,
        OLD.stripe_schedule_id
     ) THEN
    RAISE EXCEPTION 'MEMBRE_FACTURATION_RESERVEE: la facturation d''un membre est écrite par le serveur (paiement, Manager), jamais depuis le navigateur ou l''app.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.status = 'banned' AND OLD.status IS DISTINCT FROM 'banned'
     AND OLD.stripe_subscription_id IS NOT NULL
     AND OLD.subscription_status IN ('active', 'trialing', 'past_due') THEN
    RAISE EXCEPTION 'MEMBRE_ABONNEMENT_EN_COURS: Ce membre a un abonnement en cours : bannis-le depuis le Manager, qui arrête aussi son abonnement.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$
;
DROP TRIGGER trg_box_members_garde_facturation ON public.box_members;
CREATE TRIGGER trg_box_members_garde_facturation BEFORE INSERT OR UPDATE OF plan_id, subscription_status, stripe_subscription_id, stripe_checkout_session_id, subscription_current_period_end, subscription_cancel_at_period_end, amount_cents, platform_fee_cents, commitment_end_date, subscription_paused, pause_started_at, pause_resumes_at, payment_method_type, past_due_since, dunning_attempts, last_payment_error, dunning_reminders_sent, dunning_last_reminder_at, billing_day, scheduled_plan_id, scheduled_change_at, stripe_schedule_id, status ON public.box_members FOR EACH ROW EXECUTE FUNCTION internal.garder_facturation_membre();

CREATE OR REPLACE FUNCTION public.reject_cash_payment_rewrite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Seule la disparition de la box efface ses encaissements (cascade FK).
    IF EXISTS (SELECT 1 FROM public.boxes WHERE id = OLD.box_id) THEN
      RAISE EXCEPTION 'APPEND_ONLY: un encaissement journalisé ne se supprime pas.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.id           IS DISTINCT FROM OLD.id
  OR NEW.box_id       IS DISTINCT FROM OLD.box_id
  OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
  OR NEW.collected_at IS DISTINCT FROM OLD.collected_at
  OR NEW.source       IS DISTINCT FROM OLD.source
  OR NEW.plan_name    IS DISTINCT FROM OLD.plan_name THEN
    RAISE EXCEPTION 'APPEND_ONLY: le montant et la date d''un encaissement ne se corrigent pas.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$
;

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
$function$
;

DROP FUNCTION public.create_box_invitation(uuid, text, text, text, uuid, text, boolean, integer, text, integer);
CREATE OR REPLACE FUNCTION public.create_box_invitation(p_box_id uuid, p_email text, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_plan_id uuid DEFAULT NULL::uuid, p_payment_mode text DEFAULT 'box'::text, p_cash_collected boolean DEFAULT false, p_valid_days integer DEFAULT 7, p_next_due_date text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_token   text;
  v_id      uuid;
  v_days    integer := least(greatest(coalesce(p_valid_days, 7), 1), 30);
  v_blocker text;
  v_due     text := nullif(btrim(p_next_due_date), '');
  v_due_date date;
  v_today   date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: connexion requise' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT public.is_box_owner_admin(p_box_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: vous n''administrez pas cette box'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF coalesce(p_payment_mode, 'box') NOT IN ('box', 'stripe') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_MODE: mode de paiement inconnu' USING ERRCODE = 'check_violation';
  END IF;

  -- La formule doit appartenir à CETTE box : sinon un gérant rattacherait ses
  -- membres au tarif d'une autre salle.
  IF p_plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.membership_plans
    WHERE id = p_plan_id AND box_id = p_box_id
  ) THEN
    RAISE EXCEPTION 'PLAN_NOT_IN_BOX: cette formule n''appartient pas à la box'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Prochaine échéance d'un adhérent migré : AAAA-MM-JJ, du lendemain (heure de
  -- Paris) à douze mois au plus. Absente : rien ne change.
  IF v_due IS NOT NULL THEN
    IF v_due !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'DUE_DATE_INVALID: échéance attendue au format AAAA-MM-JJ'
        USING ERRCODE = 'check_violation';
    END IF;
    BEGIN
      v_due_date := v_due::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'DUE_DATE_INVALID: cette date n''existe pas'
        USING ERRCODE = 'check_violation';
    END;
    IF v_due_date <= v_today THEN
      RAISE EXCEPTION 'DUE_DATE_PAST: l''échéance doit être postérieure à aujourd''hui'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_due_date > (v_today + interval '12 months')::date THEN
      RAISE EXCEPTION 'DUE_DATE_TOO_FAR: l''échéance doit tomber dans les douze mois'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  v_blocker := public.invitation_target_blocker(p_box_id, v_email);

  IF v_blocker = 'email_invalide' THEN
    RAISE EXCEPTION 'INVALID_EMAIL: adresse e-mail invalide' USING ERRCODE = 'check_violation';
  ELSIF v_blocker = 'membre_exclu' THEN
    RAISE EXCEPTION 'MEMBER_BANNED: cette personne est exclue de la box'
      USING ERRCODE = 'check_violation';
  ELSIF v_blocker = 'deja_membre' THEN
    RAISE EXCEPTION 'MEMBER_EXISTS: cette personne est déjà membre de ta box'
      USING ERRCODE = 'check_violation';
  ELSIF v_blocker = 'invitation_en_attente' THEN
    RAISE EXCEPTION 'INVITATION_EXISTS: une invitation est déjà en attente pour cette adresse'
      USING ERRCODE = 'unique_violation';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.box_invitations (
    box_id, email, first_name, last_name, plan_id,
    payment_mode, cash_collected, token_hash, expires_at, created_by, next_due_date
  ) VALUES (
    p_box_id, v_email, nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), ''),
    p_plan_id,
    coalesce(p_payment_mode, 'box'),
    coalesce(p_payment_mode, 'box') = 'box' AND coalesce(p_cash_collected, false),
    encode(sha256(v_token::bytea), 'hex'),
    now() + make_interval(days => v_days),
    auth.uid(),
    v_due_date
  )
  RETURNING id INTO v_id;

  -- Le jeton brut ne sera plus jamais lisible après ce retour.
  RETURN jsonb_build_object(
    'ok', true, 'id', v_id, 'token', v_token,
    'email', v_email, 'expires_at', now() + make_interval(days => v_days)
  );
END;
$function$
;
REVOKE ALL ON FUNCTION public.create_box_invitation(uuid, text, text, text, uuid, text, boolean, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_box_invitation(uuid, text, text, text, uuid, text, boolean, integer, text) TO authenticated, service_role;
COMMENT ON FUNCTION public.create_box_invitation(uuid, text, text, text, uuid, text, boolean, integer, text) IS
  'Crée une invitation nominative pour une box administrée par l''appelant. Renvoie le jeton en clair une seule fois.';

DROP FUNCTION public.mark_box_invitation_paid(uuid, integer);
CREATE OR REPLACE FUNCTION public.mark_box_invitation_paid(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r        public.box_invitations;
  v_logged uuid;
BEGIN
  SELECT * INTO r FROM public.box_invitations WHERE id = p_invitation_id FOR UPDATE;

  IF r.id IS NULL OR NOT public.is_box_owner_admin(r.box_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: invitation introuvable ou hors de votre box'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF r.payment_mode <> 'box' THEN
    RAISE EXCEPTION 'NOT_CASH_MODE: cette invitation est réglée par Stripe'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Déjà encaissée : ne pas journaliser deux fois le même argent.
  IF r.cash_collected THEN
    RETURN jsonb_build_object('ok', true, 'already_collected', true);
  END IF;

  UPDATE public.box_invitations SET cash_collected = true WHERE id = r.id;

  v_logged := public._log_box_cash_payment(
    r.box_id, r.accepted_by, r.id, r.plan_id, 'invitation'
  );

  -- Le membre a déjà créé son compte : l'encaissement l'active. Sinon la
  -- consommation le fera, l'invitation portant désormais le paiement.
  IF r.accepted_by IS NOT NULL THEN
    UPDATE public.box_members SET
      status              = CASE WHEN status = 'banned' THEN status ELSE 'active' END,
      subscription_status = CASE WHEN status = 'banned' THEN subscription_status ELSE 'active' END,
      payment_method_type = 'cash'
    WHERE box_id = r.box_id AND member_id = r.accepted_by;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'activated', r.accepted_by IS NOT NULL,
    'payment_id', v_logged
  );
END;
$function$
;
REVOKE ALL ON FUNCTION public.mark_box_invitation_paid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_box_invitation_paid(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.mark_box_invitation_paid(uuid) IS
  'Marque une invitation « mode box » comme encaissée au comptoir, journalise le paiement et active le membre s''il a déjà créé son compte.';

DROP FUNCTION public.record_member_cash_payment(uuid, integer);
CREATE OR REPLACE FUNCTION public.record_member_cash_payment(p_box_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  m        public.box_members;
  v_logged uuid;
BEGIN
  SELECT * INTO m FROM public.box_members WHERE id = p_box_member_id;

  IF m.id IS NULL OR NOT public.is_box_owner_admin(m.box_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: adhésion introuvable ou hors de votre box'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Un abonné Stripe est déjà prélevé : enregistrer un encaissement comptoir
  -- pour lui compterait son mois deux fois.
  IF m.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'STRIPE_MEMBER: cette adhésion est prélevée par Stripe'
      USING ERRCODE = 'check_violation';
  END IF;

  v_logged := public._log_box_cash_payment(
    m.box_id, m.member_id, NULL, m.plan_id, 'renewal'
  );

  IF v_logged IS NULL THEN
    RAISE EXCEPTION 'NO_PLAN_PRICE: cette adhésion n''a pas de formule tarifée'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.box_members SET
    status              = CASE WHEN status = 'banned' THEN status ELSE 'active' END,
    subscription_status = CASE WHEN status = 'banned' THEN subscription_status ELSE 'active' END,
    payment_method_type = 'cash'
  WHERE id = m.id;

  RETURN jsonb_build_object('ok', true, 'payment_id', v_logged);
END;
$function$
;
REVOKE ALL ON FUNCTION public.record_member_cash_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_member_cash_payment(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.record_member_cash_payment(uuid) IS
  'Journalise l''échéance comptoir d''un membre (montant lu sur sa formule). Admin de la box uniquement, refusée sur un abonné Stripe.';

DROP FUNCTION public._log_box_cash_payment(uuid, uuid, uuid, uuid, text, integer, date, date, uuid, integer, text);
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
$function$
;
REVOKE ALL ON FUNCTION public._log_box_cash_payment(uuid, uuid, uuid, uuid, text, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._log_box_cash_payment(uuid, uuid, uuid, uuid, text, uuid, integer, text) TO authenticated, service_role;

DROP FUNCTION internal.box_vend_en_ligne(uuid);
DROP FUNCTION internal.periode_comptoir(date, integer);
DROP TRIGGER trg_boxes_garde_renouvellement_comptoir ON public.boxes;
DROP FUNCTION internal.garder_reglage_comptoir_box();

ALTER TABLE public.box_cash_payments
  DROP CONSTRAINT box_cash_payments_periode_complete,
  DROP COLUMN period_months,
  DROP COLUMN access_from,
  DROP COLUMN access_until;
ALTER TABLE public.box_invitations DROP COLUMN cash_access_until;
ALTER TABLE public.boxes DROP COLUMN allow_counter_renewal;
ALTER TABLE public.box_members DROP COLUMN cash_access_until;
