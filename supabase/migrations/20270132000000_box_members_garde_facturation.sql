-- ═════════════════════════════════════════════════════════════════════════════
-- Colonnes de facturation de box_members réservées au serveur (lot sécurité, PR H)
--
-- Appliquée en prod : NON. À appliquer seulement après le GO de Nab, une fois
-- déployé le Manager qui fait passer `assignPlan` (formule d'un membre) et le
-- débannissement côté serveur : aujourd'hui, `assignPlan` écrit `plan_id`
-- depuis le navigateur et serait refusé.
--
-- La faille (relevé du 26/09/2026, confirmé en prod) : `authenticated` a UPDATE
-- sur les 24 colonnes de `box_members`, et `owner_manage_members` /
-- `box_members_coowner_manage` (FOR ALL) laissent le gérant et le co-gérant
-- écrire toute la facturation depuis le navigateur (statut d'abonnement,
-- identifiants Stripe, période, impayé, engagement, montants…). Le lot 6 en
-- avait masqué la lecture, pas l'écriture.
--
-- 1. Garde sur le modèle de #379 (`current_user`, SECURITY INVOKER) : un rôle
--    client (`authenticated`, `anon`) n'écrit aucune des 18 colonnes de
--    facturation (`plan_id`, `subscription_status`, `stripe_subscription_id`, `stripe_checkout_session_id`, les dates de
--    période, de pause et d'engagement, les montants, `past_due_since`, les
--    colonnes de relance, `payment_method_type`). Refus 42501
--    `MEMBRE_FACTURATION_RESERVEE`. Une réécriture à l'identique passe ; une
--    insertion par un client n'y met que les valeurs par défaut. La clé
--    serveur (webhooks, routes du Manager), les fonctions SECURITY DEFINER
--    (`join_box_by_invite`, invitations, droits en attente, comptoir,
--    `reactivate_box_member`…) et les rôles d'administration passent.
-- 2. Bannissement : un rôle client ne passe pas à `banned` un membre qui a un
--    abonnement Stripe en cours (`stripe_subscription_id` renseigné, statut
--    actif, en essai ou en impayé) : refus 42501 `MEMBRE_ABONNEMENT_EN_COURS`.
--    Le Manager bannit par sa route serveur, qui arrête d'abord l'abonnement.
--    Un membre au comptoir ou sans abonnement reste bannissable depuis l'app.
-- 3. `reactivate_box_member` refuse (`REACTIVATION_ABONNEMENT_EN_COURS`,
--    check_violation) quand le membre a encore un abonnement Stripe en cours,
--    au lieu d'effacer `stripe_subscription_id`. Corps repris de la prod (md5
--    30cd85c47a405a2880ba89f1dad61910), seul ce contrôle est ajouté.
-- 4. Ni `status` (hors le cas 2) ni `role` ne sont gardés.
--
-- Écrans qui afficheront ces refus : app `BOMembersScreen` (bannir →
-- MEMBRE_ABONNEMENT_EN_COURS ; réactiver → REACTIVATION_ABONNEMENT_EN_COURS),
-- à traduire dans une PR app ; Manager, le débannissement une fois passé par
-- `reactivate_box_member`.
--
-- Contrôlée par `supabase/tests/box_members_garde_facturation.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE FUNCTION internal.garder_facturation_membre()
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
        NEW.dunning_last_reminder_at
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
        NEW.dunning_last_reminder_at
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
        OLD.dunning_last_reminder_at
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
$function$;
REVOKE ALL ON FUNCTION internal.garder_facturation_membre() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_box_members_garde_facturation
  BEFORE INSERT OR UPDATE OF plan_id, subscription_status, stripe_subscription_id, stripe_checkout_session_id, subscription_current_period_end, subscription_cancel_at_period_end, amount_cents, platform_fee_cents, commitment_end_date, subscription_paused, pause_started_at, pause_resumes_at, payment_method_type, past_due_since, dunning_attempts, last_payment_error, dunning_reminders_sent, dunning_last_reminder_at, status ON public.box_members
  FOR EACH ROW EXECUTE FUNCTION internal.garder_facturation_membre();

CREATE OR REPLACE FUNCTION public.reactivate_box_member(p_box_id uuid, p_member_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_box_owner_admin(p_box_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: reserve aux gestionnaires de la box'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Effacer stripe_subscription_id laisserait un abonnement prélevé, détaché
  -- de sa ligne (le webhook ne le retrouverait plus).
  IF EXISTS (SELECT 1 FROM public.box_members
              WHERE box_id = p_box_id AND member_id = p_member_id AND status <> 'active'
                AND stripe_subscription_id IS NOT NULL
                AND subscription_status IN ('active', 'trialing', 'past_due')) THEN
    RAISE EXCEPTION 'REACTIVATION_ABONNEMENT_EN_COURS: Ce membre a encore un abonnement Stripe en cours : arrête-le depuis le Manager avant de le réactiver.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.box_members SET
    status                            = 'active',
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
  WHERE box_id = p_box_id AND member_id = p_member_id AND status <> 'active';

  RETURN FOUND;
END;
$function$;

COMMIT;
