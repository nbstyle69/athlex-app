-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270147000000_changement_formule.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test changement_formule.sql le rejoue dans sa
-- propre transaction annulée).
--
-- Définitions rétablies octet pour octet (md5 de pg_get_functiondef, search_path
-- "$user", public ; identiques aux relevés de prod du 01/10 et du 04/10/2026,
-- à recontrôler en prod avant l'application) :
--   public.get_my_membership_billing()      6b3770f8bcf03c86b7e68f2e680c734e
--   internal.garder_facturation_membre()    2c8c6335dd9ec48f9e2899af6f24dffc
--   internal.filer_notification_gerant()    6b0bb58f80f3eeeaa883d838ae5049ce
--   déclencheur trg_box_members_garde_facturation (pg_get_triggerdef)
--                                           28761293666c139c12bf0f687c07eaf1
-- Perdu au retour : les demandes de changement, la configuration du portail,
-- les trois colonnes de box_members et les notifications plan_change_request
-- de la file (supprimées, sans quoi la contrainte d'origine ne se repose pas).
-- ═════════════════════════════════════════════════════════════════════════════

DROP TRIGGER trg_notif_gerant_changement_formule ON public.box_plan_change_requests;
CREATE OR REPLACE FUNCTION internal.filer_notification_gerant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_type   text := TG_ARGV[0];
  v_ref    text;
  v_membre uuid;
  v_plan   uuid;
  v_cours  timestamptz;
  v_auteur uuid;
BEGIN
  BEGIN
    IF v_type = 'subscription_paid' THEN
      v_ref := NEW.stripe_subscription_id;
      v_membre := NEW.member_id;
      v_plan := NEW.plan_id;
    ELSIF v_type = 'payment_failed' THEN
      v_ref := NEW.id::text || '@' || to_char(NEW.past_due_since AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US');
      v_membre := NEW.member_id;
      v_plan := NEW.plan_id;
    ELSIF v_type = 'booked_without_plan' THEN
      v_ref := NEW.id::text;
      v_membre := NEW.member_id;
      v_auteur := NEW.created_by;
      -- Les heures de créneau sont celles de la box, à Paris.
      SELECT (cs.scheduled_date + cs.start_time::time) AT TIME ZONE 'Europe/Paris' INTO v_cours
      FROM class_reservations cr
      JOIN class_schedules cs ON cs.id = cr.schedule_id
      WHERE cr.id = NEW.reservation_id;
    ELSIF v_type = 'invitation_accepted' THEN
      v_ref := NEW.id::text;
      v_membre := NEW.accepted_by;
    ELSE
      RAISE EXCEPTION 'type de notification inconnu : %', v_type;
    END IF;

    IF v_membre IS NOT NULL AND EXISTS (
      SELECT 1 FROM boxes WHERE id = NEW.box_id AND archived_at IS NULL
    ) THEN
      INSERT INTO box_manager_notifications (box_id, type, event_ref, member_id, plan_id, class_starts_at, actor_id)
      VALUES (NEW.box_id, v_type, v_ref, v_membre, v_plan, v_cours, v_auteur)
      ON CONFLICT (type, event_ref) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Une notification ne bloque jamais un paiement, une réservation ou une invitation.
    RAISE WARNING 'NOTIF_GERANT_NON_FILEE: % (%, %)', v_type, SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$function$
;

DELETE FROM public.box_manager_notifications WHERE type = 'plan_change_request';
ALTER TABLE public.box_manager_notifications DROP CONSTRAINT box_manager_notifications_type_check;
ALTER TABLE public.box_manager_notifications ADD CONSTRAINT box_manager_notifications_type_check
  CHECK (type IN ('subscription_paid', 'payment_failed', 'booked_without_plan', 'invitation_accepted'));

DROP FUNCTION public.decide_plan_change_request(uuid, uuid, boolean);
DROP FUNCTION public.cancel_plan_change_request(uuid, uuid);
DROP FUNCTION public.request_plan_change(uuid, uuid, uuid);
DROP FUNCTION internal.refus_changement_formule(uuid, uuid, uuid);
DROP TABLE public.box_plan_change_requests;
DROP TABLE public.box_stripe_portal;

DROP FUNCTION public.get_my_membership_billing();

CREATE FUNCTION public.get_my_membership_billing()
 RETURNS TABLE(id uuid, box_id uuid, status text, joined_at timestamp with time zone, plan_id uuid, subscription_status text, subscription_current_period_end timestamp with time zone, subscription_cancel_at_period_end boolean, subscription_paused boolean, pause_resumes_at timestamp with time zone, commitment_end_date timestamp with time zone, amount_cents integer, past_due_since timestamp with time zone, dunning_grace_days integer, suspended boolean, has_stripe_subscription boolean, stopped_at timestamp with time zone, stop_mode text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT bm.id, bm.box_id, bm.status, bm.joined_at, bm.plan_id,
         bm.subscription_status, bm.subscription_current_period_end,
         bm.subscription_cancel_at_period_end, bm.subscription_paused,
         bm.pause_resumes_at, bm.commitment_end_date, bm.amount_cents,
         bm.past_due_since,
         COALESCE(b.dunning_grace_days, 7),
         internal.membership_suspendu(bm.member_id, bm.box_id),
         (bm.stripe_subscription_id IS NOT NULL),
         arret.created_at,
         arret.mode
  FROM public.box_members bm
  LEFT JOIN public.boxes b ON b.id = bm.box_id
  LEFT JOIN LATERAL (
    SELECT a.created_at, a.mode
      FROM public.box_member_subscription_actions a
     WHERE a.box_member_id = bm.id
       AND a.action = 'stop'
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT 1
  ) arret ON true
  WHERE bm.member_id = auth.uid();
$function$
;

REVOKE ALL ON FUNCTION public.get_my_membership_billing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_membership_billing() TO authenticated, service_role;
COMMENT ON FUNCTION public.get_my_membership_billing() IS
  'Lot 6 : son propre abonnement, par auth.uid(). Remplace la lecture directe des colonnes nominatives de box_members.';

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
        NEW.billing_day
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
        NEW.billing_day
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
        OLD.billing_day
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
CREATE TRIGGER trg_box_members_garde_facturation BEFORE INSERT OR UPDATE OF plan_id, subscription_status, stripe_subscription_id, stripe_checkout_session_id, subscription_current_period_end, subscription_cancel_at_period_end, amount_cents, platform_fee_cents, commitment_end_date, subscription_paused, pause_started_at, pause_resumes_at, payment_method_type, past_due_since, dunning_attempts, last_payment_error, dunning_reminders_sent, dunning_last_reminder_at, billing_day, status ON public.box_members FOR EACH ROW EXECUTE FUNCTION internal.garder_facturation_membre();

ALTER TABLE public.box_members
  DROP COLUMN scheduled_plan_id,
  DROP COLUMN scheduled_change_at,
  DROP COLUMN stripe_schedule_id;
