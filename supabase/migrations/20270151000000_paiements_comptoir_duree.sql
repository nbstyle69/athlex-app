-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR 1 sur 6 : durée des encaissements et date de
-- fin d'accès (base)
--
-- Appliquée en prod : non.
--
-- Spec validée par Nab le 13/10/2026 (Figma « AthleX Manager — Back-office »,
-- page « 🧪 Spec · Paiements au comptoir (P1) », §1 à §4). Un encaissement au
-- comptoir couvre 1, 3 ou 12 mois et pose une date de fin d'accès. Rien ne se
-- renouvelle tout seul. Un réglage de box dit si le gérant peut renouveler au
-- comptoir. La coupure à la date de fin (PR 2), l'Edge Function (PR 3), le
-- Manager (PR 4, 5), l'app (PR 6) et la reprise des données existantes (PR de
-- données) viennent après. Aucune donnée existante n'est modifiée ici : les
-- colonnes ajoutées naissent vides ou à leur valeur par défaut.
--
-- Précontrôle du 13/10/2026 (comptoir-p1/precontrole.md) : les définitions de
-- prod sont celles de master. Empreintes de prod (md5 de pg_get_functiondef,
-- search_path "$user", public, extensions), rétablies par le retour arrière :
--   public.record_member_cash_payment(uuid)            05ac1a6c13381169de8c887970461ce9
--   public.mark_box_invitation_paid(uuid)              58f668fc4ef9454fee71cddb0263965c
--   public._log_box_cash_payment(8 arguments)          d5361a6e55adcbeccb3f0abb752a5995
--   public.reject_cash_payment_rewrite()               d1c6053375305c67197ad659d42a0926
--   internal.garder_facturation_membre()               b50e8f8843dbe51848862942b3f3602f
--   public._consume_box_invitation(text,uuid)          78b0d0a212111ddec7e08ecfb684640f
--   public.create_box_invitation(9 arguments)          f9412cbc5e1d03d4de7483c8bb6e6e2f
--   déclencheur trg_box_members_garde_facturation      05e9de13a14666cd9b5d99040e8da0c3
--
-- 1. Colonnes
--    - box_members.cash_access_until (date, dernier jour d'accès payé au
--      comptoir, inclus, au jour de Paris) : 20e colonne réservée au serveur
--      de internal.garder_facturation_membre (attendue NULL à l'INSERT) et de
--      la liste UPDATE OF de trg_box_members_garde_facturation, recréé à
--      l'identique hormis cette colonne (méthode de 20270135 pour billing_day).
--      Lecture : box_members n'est lisible par les clients que par colonnes
--      nommées, pas celle-ci.
--    - boxes.allow_counter_renewal (booléen, faux par défaut). Constat :
--      boxes.dunning_grace_days n'a aucune protection en base aujourd'hui
--      (`authenticated` a le SELECT et l'UPDATE de TABLE sur boxes, la règle
--      boxes_owner_write laisse le gérant écrire sa ligne ; la révocation
--      « Phase 3 » annoncée par le Manager n'a pas eu lieu). Reproduire ce
--      traitement laisserait le réglage écrit depuis le navigateur. L'écriture
--      est donc fermée par une garde (BOX_REGLAGE_RESERVE, comme la garde
--      d'archivage de 20270130) ; la lecture reste celle de la table, comme
--      pour dunning_grace_days (un REVOKE de colonne est sans effet tant que le
--      SELECT de table est accordé).
--    - box_invitations.cash_access_until : fin d'accès calculée quand
--      l'encaissement précède la création du compte, recopiée sur le membre à
--      la consommation de l'invitation.
--    - box_cash_payments : period_months (1, 3 ou 12), access_from,
--      access_until, les trois ensemble ou aucun (les lignes existantes restent
--      sans période). Ajoutées au verrou de reject_cash_payment_rewrite : elles
--      ne se modifient plus une fois écrites, quel que soit le rôle.
-- 2. internal.periode_comptoir(fin actuelle, mois) : seul calcul de période.
--    Début = lendemain de la fin actuelle si elle est à aujourd'hui ou après
--    (prolongation), sinon aujourd'hui ; fin = début + N mois − 1 jour, en
--    arithmétique de dates Postgres. Durée hors {1, 3, 12} : INVALID_DURATION.
-- 3. internal.box_vend_en_ligne(box) : compte Stripe terminé et au moins une
--    formule active avec un prix Stripe. Servira aussi à la PR 2 et au Manager.
-- 4. public._log_box_cash_payment : la période s'ajoute (p_months,
--    p_access_from, p_access_until) et le montant devient prix × mois, lu en
--    base. Écart avec le brief : la fonction de master a 8 arguments, pas 5 ;
--    le chemin « program » (20261117, appelé par arguments nommés) est gardé,
--    ses trois paramètres passent après la période. DROP puis CREATE : une
--    seule version. Écart corrigé : la version de master n'était révoquée
--    qu'à PUBLIC ; les privilèges par défaut de la plateforme la laissaient
--    exécutable par `authenticated` et `service_role` (un compte connecté
--    pouvait journaliser un encaissement de programme de n'importe quel
--    montant). Révoquée ici à tous les rôles clients, comme en 20261026.
-- 5. public.record_member_cash_payment(p_box_member_id, p_months DEFAULT 1) :
--    verrou de la ligne du membre, nouveau refus COUNTER_RENEWAL_DISABLED
--    (le membre a déjà une période au comptoir, le réglage est à faux et la
--    box vend en ligne), période posée sur le membre. L'appel à un argument du
--    Manager reste valable (1 mois).
-- 6. public.mark_box_invitation_paid(p_invitation_id, p_months DEFAULT 1) :
--    toujours permis (premier paiement) ; période sur le membre s'il a un
--    compte, sinon sur l'invitation.
-- 7. public.create_box_invitation(…, p_cash_months DEFAULT 1) : écart corrigé,
--    une invitation créée « déjà encaissée » ne journalisait rien ; elle pose
--    désormais la période sur l'invitation et journalise l'encaissement, comme
--    mark_box_invitation_paid. create_box_invitations_bulk n'est pas touchée :
--    elle crée toujours cash_collected = false.
--    Pour 6 et 7 : invitation sans formule ou à formule à 0 € = aucune
--    période, aucune date de fin, rien au journal (spec P1) ; l'encaissement
--    est noté (cash_collected) et le membre activé comme avant.
-- 8. public._consume_box_invitation : pour une invitation encaissée au
--    comptoir, la fin d'accès de l'invitation est recopiée sur le membre (la
--    plus tardive des deux en mise à jour). Rien d'autre ne change.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes ──────────────────────────────────────────────────────────────

ALTER TABLE public.box_members ADD COLUMN cash_access_until date;
COMMENT ON COLUMN public.box_members.cash_access_until IS
  'Dernier jour d''accès payé au comptoir, inclus (jour de Paris). Écrit par le serveur seul (garde de facturation).';

ALTER TABLE public.boxes ADD COLUMN allow_counter_renewal boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.boxes.allow_counter_renewal IS
  'Le gérant peut renouveler au comptoir l''accès d''un membre qui a déjà une période, même si la box vend en ligne. Écrit par le serveur seul.';

ALTER TABLE public.box_invitations ADD COLUMN cash_access_until date;
COMMENT ON COLUMN public.box_invitations.cash_access_until IS
  'Fin d''accès d''un encaissement au comptoir antérieur à la création du compte, recopiée sur le membre à la consommation.';

ALTER TABLE public.box_cash_payments
  ADD COLUMN period_months smallint CONSTRAINT box_cash_payments_period_months_check CHECK (period_months IN (1, 3, 12)),
  ADD COLUMN access_from date,
  ADD COLUMN access_until date,
  ADD CONSTRAINT box_cash_payments_periode_complete CHECK (
    (period_months IS NULL AND access_from IS NULL AND access_until IS NULL)
    OR (period_months IS NOT NULL AND access_from IS NOT NULL AND access_until IS NOT NULL
        AND access_until >= access_from)
  );
COMMENT ON COLUMN public.box_cash_payments.period_months IS 'Durée couverte par l''encaissement (1, 3 ou 12 mois). NULL pour un programme et pour les lignes d''avant 20270151.';
COMMENT ON COLUMN public.box_cash_payments.access_from IS 'Premier jour d''accès couvert, inclus.';
COMMENT ON COLUMN public.box_cash_payments.access_until IS 'Dernier jour d''accès couvert, inclus.';

-- Garde du réglage : seul le serveur l'écrit (Manager, route serveur, PR 4).
CREATE FUNCTION internal.garder_reglage_comptoir_box()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.allow_counter_renewal IS DISTINCT FROM false)
     OR (TG_OP = 'UPDATE' AND NEW.allow_counter_renewal IS DISTINCT FROM OLD.allow_counter_renewal) THEN
    RAISE EXCEPTION 'BOX_REGLAGE_RESERVE: le renouvellement au comptoir se règle depuis le Manager, jamais depuis le navigateur ou l''app.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.garder_reglage_comptoir_box() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_boxes_garde_renouvellement_comptoir
  BEFORE INSERT OR UPDATE OF allow_counter_renewal ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION internal.garder_reglage_comptoir_box();

-- Garde de facturation : cash_access_until devient la 20e colonne réservée.
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
        NEW.stripe_schedule_id,
        NEW.cash_access_until
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
        NEW.stripe_schedule_id,
        NEW.cash_access_until
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
        OLD.stripe_schedule_id,
        OLD.cash_access_until
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
CREATE TRIGGER trg_box_members_garde_facturation BEFORE INSERT OR UPDATE OF plan_id, subscription_status, stripe_subscription_id, stripe_checkout_session_id, subscription_current_period_end, subscription_cancel_at_period_end, amount_cents, platform_fee_cents, commitment_end_date, subscription_paused, pause_started_at, pause_resumes_at, payment_method_type, past_due_since, dunning_attempts, last_payment_error, dunning_reminders_sent, dunning_last_reminder_at, billing_day, scheduled_plan_id, scheduled_change_at, stripe_schedule_id, cash_access_until, status ON public.box_members FOR EACH ROW EXECUTE FUNCTION internal.garder_facturation_membre();

-- Verrou du journal : la période ne se réécrit pas non plus.
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

  IF NEW.id            IS DISTINCT FROM OLD.id
  OR NEW.box_id        IS DISTINCT FROM OLD.box_id
  OR NEW.amount_cents  IS DISTINCT FROM OLD.amount_cents
  OR NEW.collected_at  IS DISTINCT FROM OLD.collected_at
  OR NEW.source        IS DISTINCT FROM OLD.source
  OR NEW.plan_name     IS DISTINCT FROM OLD.plan_name
  OR NEW.period_months IS DISTINCT FROM OLD.period_months
  OR NEW.access_from   IS DISTINCT FROM OLD.access_from
  OR NEW.access_until  IS DISTINCT FROM OLD.access_until THEN
    RAISE EXCEPTION 'APPEND_ONLY: le montant, la date et la période d''un encaissement ne se corrigent pas.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 2. Calcul de la période ──────────────────────────────────────────────────

-- Arithmétique de dates Postgres : un mois ajouté au 31/01 donne le 28/02 (ou
-- le 29 en année bissextile), donc 1 mois depuis le 31/01/2027 finit le
-- 27/02/2027. Le 13/10 + 1 mois finit le 12/11.
CREATE FUNCTION internal.periode_comptoir(p_fin_actuelle date, p_mois integer)
 RETURNS TABLE(access_from date, access_until date)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF p_mois IS NULL OR p_mois NOT IN (1, 3, 12) THEN
    RAISE EXCEPTION 'INVALID_DURATION: durée de 1, 3 ou 12 mois attendue'
      USING ERRCODE = 'check_violation';
  END IF;
  access_from  := CASE WHEN p_fin_actuelle >= v_today THEN p_fin_actuelle + 1 ELSE v_today END;
  access_until := (access_from + make_interval(months => p_mois))::date - 1;
  RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION internal.periode_comptoir(date, integer) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION internal.periode_comptoir(date, integer) IS
  'Période couverte par un encaissement au comptoir de 1, 3 ou 12 mois : prolonge une fin à venir, sinon part d''aujourd''hui (jour de Paris).';

-- ── 3. La box vend-elle en ligne ? ───────────────────────────────────────────

CREATE FUNCTION internal.box_vend_en_ligne(p_box uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.boxes b
     WHERE b.id = p_box
       AND b.stripe_account_id IS NOT NULL
       AND b.stripe_onboarding_complete IS TRUE
       AND EXISTS (SELECT 1 FROM public.membership_plans mp
                    WHERE mp.box_id = b.id AND mp.is_active AND mp.stripe_price_id IS NOT NULL)
  );
$function$;
REVOKE ALL ON FUNCTION internal.box_vend_en_ligne(uuid) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION internal.box_vend_en_ligne(uuid) IS
  'La box vend en ligne : compte Stripe terminé et au moins une formule active avec un prix Stripe.';

-- ── 4. Journal des encaissements ─────────────────────────────────────────────

DROP FUNCTION public._log_box_cash_payment(uuid, uuid, uuid, uuid, text, uuid, integer, text);
CREATE FUNCTION public._log_box_cash_payment(p_box_id uuid, p_member_id uuid, p_invitation_id uuid, p_plan_id uuid, p_source text, p_months integer DEFAULT NULL::integer, p_access_from date DEFAULT NULL::date, p_access_until date DEFAULT NULL::date, p_program_id uuid DEFAULT NULL::uuid, p_amount_cents integer DEFAULT NULL::integer, p_label text DEFAULT NULL::text)
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

  -- Un encaissement d'adhésion couvre toujours une période (20270151).
  IF p_months IS NULL OR p_months NOT IN (1, 3, 12) OR p_access_from IS NULL OR p_access_until IS NULL THEN
    RAISE EXCEPTION 'INVALID_DURATION: un encaissement d''adhésion couvre 1, 3 ou 12 mois'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.box_cash_payments (
    box_id, member_id, invitation_id, plan_id, plan_name,
    amount_cents, source, collected_by,
    period_months, access_from, access_until
  ) VALUES (
    p_box_id, p_member_id, p_invitation_id, p_plan_id, v_plan.name,
    v_plan.price_cents * p_months, p_source, auth.uid(),
    p_months, p_access_from, p_access_until
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
REVOKE ALL ON FUNCTION public._log_box_cash_payment(uuid, uuid, uuid, uuid, text, integer, date, date, uuid, integer, text) FROM PUBLIC, anon, authenticated, service_role;

-- ── 5. Encaissement d'un membre ──────────────────────────────────────────────

DROP FUNCTION public.record_member_cash_payment(uuid);
CREATE FUNCTION public.record_member_cash_payment(p_box_member_id uuid, p_months integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  m        public.box_members;
  v_logged uuid;
  v_from   date;
  v_until  date;
BEGIN
  -- Verrou de la ligne : deux encaissements simultanés ne calculent pas le
  -- même début de période.
  SELECT * INTO m FROM public.box_members WHERE id = p_box_member_id FOR UPDATE;

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

  -- Renouvellement au comptoir : refusé quand la box vend en ligne et ne l'a
  -- pas autorisé. Le premier encaissement d'un membre reste toujours possible.
  -- Un encaissement de programme n'est pas une période d'adhésion.
  IF (m.cash_access_until IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.box_cash_payments c
                  WHERE c.box_id = m.box_id AND c.member_id = m.member_id
                    AND c.source IN ('renewal', 'invitation')))
     AND NOT (SELECT b.allow_counter_renewal FROM public.boxes b WHERE b.id = m.box_id)
     AND internal.box_vend_en_ligne(m.box_id) THEN
    RAISE EXCEPTION 'COUNTER_RENEWAL_DISABLED: cette box ne renouvelle pas au comptoir, le membre passe au paiement en ligne'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT p.access_from, p.access_until INTO v_from, v_until
    FROM internal.periode_comptoir(m.cash_access_until, p_months) p;

  v_logged := public._log_box_cash_payment(
    m.box_id, m.member_id, NULL, m.plan_id, 'renewal', p_months, v_from, v_until
  );

  IF v_logged IS NULL THEN
    RAISE EXCEPTION 'NO_PLAN_PRICE: cette adhésion n''a pas de formule tarifée'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.box_members SET
    status              = CASE WHEN status = 'banned' THEN status ELSE 'active' END,
    subscription_status = CASE WHEN status = 'banned' THEN subscription_status ELSE 'active' END,
    payment_method_type = 'cash',
    cash_access_until   = v_until
  WHERE id = m.id;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_logged,
    'amount_cents', (SELECT c.amount_cents FROM public.box_cash_payments c WHERE c.id = v_logged),
    'access_from', v_from,
    'access_until', v_until
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.record_member_cash_payment(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_member_cash_payment(uuid, integer) TO authenticated, service_role;
COMMENT ON FUNCTION public.record_member_cash_payment(uuid, integer) IS
  'Journalise l''échéance comptoir d''un membre (montant lu sur sa formule). Admin de la box uniquement, refusée sur un abonné Stripe.';

-- ── 6. Invitation encaissée après coup ───────────────────────────────────────

DROP FUNCTION public.mark_box_invitation_paid(uuid);
CREATE FUNCTION public.mark_box_invitation_paid(p_invitation_id uuid, p_months integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r        public.box_invitations;
  v_logged uuid;
  v_fin    date;
  v_from   date;
  v_until  date;
  v_payante boolean;
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

  -- Formule absente ou à 0 € : aucune période, aucune date de fin (spec P1),
  -- et rien au journal (_log_box_cash_payment ne journalise pas un zéro).
  v_payante := EXISTS (SELECT 1 FROM public.membership_plans mp WHERE mp.id = r.plan_id AND mp.price_cents > 0);

  -- Premier paiement : toujours permis, même renouvellement au comptoir
  -- désactivé. La période part de la fin d'accès du membre s'il a un compte.
  IF v_payante THEN
    IF r.accepted_by IS NOT NULL THEN
      SELECT cash_access_until INTO v_fin FROM public.box_members
       WHERE box_id = r.box_id AND member_id = r.accepted_by FOR UPDATE;
    END IF;
    SELECT p.access_from, p.access_until INTO v_from, v_until
      FROM internal.periode_comptoir(v_fin, p_months) p;
  END IF;

  UPDATE public.box_invitations SET
    cash_collected    = true,
    cash_access_until = CASE WHEN v_payante AND r.accepted_by IS NULL THEN v_until ELSE cash_access_until END
  WHERE id = r.id;

  v_logged := public._log_box_cash_payment(
    r.box_id, r.accepted_by, r.id, r.plan_id, 'invitation', p_months, v_from, v_until
  );

  -- Le membre a déjà créé son compte : l'encaissement l'active. Sinon la
  -- consommation le fera, l'invitation portant désormais le paiement.
  IF r.accepted_by IS NOT NULL THEN
    UPDATE public.box_members SET
      status              = CASE WHEN status = 'banned' THEN status ELSE 'active' END,
      subscription_status = CASE WHEN status = 'banned' THEN subscription_status ELSE 'active' END,
      payment_method_type = 'cash',
      cash_access_until   = CASE WHEN v_payante THEN v_until ELSE cash_access_until END
    WHERE box_id = r.box_id AND member_id = r.accepted_by;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'activated', r.accepted_by IS NOT NULL,
    'payment_id', v_logged,
    'access_from', v_from,
    'access_until', v_until
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.mark_box_invitation_paid(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_box_invitation_paid(uuid, integer) TO authenticated, service_role;
COMMENT ON FUNCTION public.mark_box_invitation_paid(uuid, integer) IS
  'Marque une invitation « mode box » comme encaissée au comptoir, journalise le paiement et active le membre s''il a déjà créé son compte.';

-- ── 7. Invitation créée « déjà encaissée » ───────────────────────────────────

DROP FUNCTION public.create_box_invitation(uuid, text, text, text, uuid, text, boolean, integer, text);
CREATE OR REPLACE FUNCTION public.create_box_invitation(p_box_id uuid, p_email text, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_plan_id uuid DEFAULT NULL::uuid, p_payment_mode text DEFAULT 'box'::text, p_cash_collected boolean DEFAULT false, p_valid_days integer DEFAULT 7, p_next_due_date text DEFAULT NULL::text, p_cash_months integer DEFAULT 1)
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
  v_cash    boolean := coalesce(p_payment_mode, 'box') = 'box' AND coalesce(p_cash_collected, false);
  v_payante boolean;
  v_from    date;
  v_until   date;
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

  -- Déjà encaissée à la création (20270151) : même période et même journal
  -- que mark_box_invitation_paid, la fin d'accès attend le compte sur
  -- l'invitation. Formule absente ou à 0 € : ni période ni journal (spec P1).
  v_payante := v_cash AND EXISTS (SELECT 1 FROM public.membership_plans mp WHERE mp.id = p_plan_id AND mp.price_cents > 0);
  IF v_payante THEN
    SELECT p.access_from, p.access_until INTO v_from, v_until
      FROM internal.periode_comptoir(NULL, p_cash_months) p;
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.box_invitations (
    box_id, email, first_name, last_name, plan_id,
    payment_mode, cash_collected, token_hash, expires_at, created_by, next_due_date, cash_access_until
  ) VALUES (
    p_box_id, v_email, nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), ''),
    p_plan_id,
    coalesce(p_payment_mode, 'box'),
    v_cash,
    encode(sha256(v_token::bytea), 'hex'),
    now() + make_interval(days => v_days),
    auth.uid(),
    v_due_date,
    v_until
  )
  RETURNING id INTO v_id;

  IF v_payante THEN
    PERFORM public._log_box_cash_payment(
      p_box_id, NULL, v_id, p_plan_id, 'invitation', p_cash_months, v_from, v_until
    );
  END IF;

  -- Le jeton brut ne sera plus jamais lisible après ce retour.
  RETURN jsonb_build_object(
    'ok', true, 'id', v_id, 'token', v_token,
    'email', v_email, 'expires_at', now() + make_interval(days => v_days)
  );
END;
$function$
;
REVOKE ALL ON FUNCTION public.create_box_invitation(uuid, text, text, text, uuid, text, boolean, integer, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_box_invitation(uuid, text, text, text, uuid, text, boolean, integer, text, integer) TO authenticated, service_role;
COMMENT ON FUNCTION public.create_box_invitation(uuid, text, text, text, uuid, text, boolean, integer, text, integer) IS
  'Crée une invitation nominative pour une box administrée par l''appelant. Renvoie le jeton en clair une seule fois.';

-- ── 8. Consommation de l'invitation ──────────────────────────────────────────

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
      box_id, member_id, role, plan_id, status, subscription_status, payment_method_type,
      cash_access_until
    ) VALUES (
      r.box_id, p_user_id, 'member', r.plan_id, v_status, v_sub_status, v_pay_method,
      CASE WHEN r.payment_mode = 'box' AND r.cash_collected THEN r.cash_access_until END
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
      payment_method_type = coalesce(v_pay_method, payment_method_type),
      -- Fin d'accès payée au comptoir avant le compte (20270151) : la plus
      -- tardive des deux, une fin déjà posée n'est jamais raccourcie.
      cash_access_until   = CASE WHEN r.payment_mode = 'box' AND r.cash_collected
                                 THEN greatest(cash_access_until, r.cash_access_until)
                                 ELSE cash_access_until END
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
