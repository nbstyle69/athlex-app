-- ═════════════════════════════════════════════════════════════════════════════
-- « Mon abonnement », PR A (base) : changement de formule par le membre
--
-- Appliquée en prod : OUI, le 06/10/2026 à 15:00 UTC, avec PGCLIENTENCODING=UTF8,
-- en une transaction, sur GO de Nab. Dump des schémas public et internal avec
-- droits db-dumps/2026-10-06/athlex-prod-public-internal-20261006T145926Z.dump,
-- sha256 ff67d5b14cf3f83bf60d56d2e5a663867a8554c5066682d0467756bfc6c4e3c1 vérifié
-- après aller-retour, 136 TABLE DATA, 460 ACL, 346 POLICY ; précontrôles (deux
-- passages identiques, search_path de la prod) : get_my_membership_billing
-- 6b3770f8…, garder_facturation_membre 2c8c6335…, filer_notification_gerant
-- 6b0bb58f…, sans retour chariot, déclencheur de la garde 28761293…, contrainte
-- à quatre types, cinq déclencheurs trg_notif_gerant_*, colonnes, tables et
-- fonctions absentes ; 174 adhésions actives au comptoir dont 0 avec
-- amount_cents ; vérifications : les sept définitions et le déclencheur aux
-- empreintes du test (b4ca5500…, b50e8f88…, df14724f…, 06fadcdb…, 0208fa64…,
-- a9870f67…, 8cc12cb3…, déclencheur 05e9de13…), droits, règles et commentaire
-- conformes, données de box_members (183 lignes, colonnes existantes), boxes
-- (4) et box_manager_notifications (0) à la même empreinte avant/après ; audit
-- des droits en prod 40/40 (T14, T15) lancé depuis la branche.
--
-- Une seule règle, depuis l'app comme depuis le site /compte :
--   - membre payant en ligne (abonnement Stripe sur le compte connecté de la
--     box) : changement programmé à la prochaine échéance par un subscription
--     schedule Stripe, sans prorata ; la nouvelle formule est écrite par le
--     webhook Connect à la bascule. Ici, seulement les colonnes où le serveur
--     note ce qui est programmé ;
--   - membre payant au comptoir (sans abonnement Stripe vivant) : une demande
--     part au gérant, qui accepte (formule appliquée tout de suite) ou refuse
--     dans Abonnés du Manager ;
--   - refusé en impayé (subscription_status past_due, past_due_since renseigné
--     ou suspension), en pause, résiliation programmée, box archivée ou en
--     archivage ; possible pendant un engagement, commitment_end_date intacte ;
--   - le membre annule une demande en attente (et, PR B, un changement
--     programmé).
-- Les trois fonctions ne sont appelées que par la clé serveur (PR B, Manager).
--
-- 1. box_members : scheduled_plan_id (FK membership_plans, ON DELETE SET
--    NULL), scheduled_change_at, stripe_schedule_id, NULL par défaut. Ajoutées
--    à `internal.garder_facturation_membre` (prod 2c8c6335dd9ec48f9e2899af6f24dffc)
--    et à la liste UPDATE OF de `trg_box_members_garde_facturation` (prod
--    28761293666c139c12bf0f687c07eaf1), recréé à l'identique hormis ces trois
--    colonnes : un rôle client n'en écrit aucune (42501
--    MEMBRE_FACTURATION_RESERVEE), comme plan_id et subscription_*. Lecture :
--    `anon` et `authenticated` ne lisent de box_members que des colonnes
--    nommées, pas celles-ci.
-- 2. `get_my_membership_billing()` (prod 6b3770f8bcf03c86b7e68f2e680c734e)
--    renvoie aussi, en fin de retour, scheduled_plan_id et scheduled_change_at.
--    Le type de retour change : DROP puis CREATE, corps de prod repris, seules
--    les deux colonnes ajoutées ; droits (authenticated, service_role) et
--    commentaire reposés à l'identique. stripe_schedule_id n'est pas exposé
--    (comme stripe_subscription_id, réduit à has_stripe_subscription).
-- 3. Configuration du portail Stripe d'une box : `authenticated` a le SELECT
--    de TABLE sur `boxes` (toutes les colonnes, y compris une colonne ajoutée),
--    donc une colonne `boxes.stripe_portal_configuration_id` y serait lisible
--    par tout compte connecté. Elle vit dans `public.box_stripe_portal`
--    (box_id, stripe_portal_configuration_id), RLS sans règle, aucun droit
--    pour anon ni authenticated : la clé serveur seule la lit et l'écrit.
-- 4. `public.box_plan_change_requests` : une demande par ligne (pending,
--    accepted, refused, cancelled) ; une seule en attente par (box, membre),
--    index unique partiel. RLS : le membre lit ses lignes, le gérant et les
--    co-gérants celles de leur box (`is_box_owner_admin`, la règle de
--    box_member_alerts) ; aucune écriture client. Fonctions SECURITY DEFINER,
--    EXECUTE pour service_role seulement :
--      request_plan_change(member, box, to_plan) → id de la demande ;
--      cancel_plan_change_request(member, box) → false si rien en attente ;
--      decide_plan_change_request(request, actor, accept) → {decided, status} ;
--        actor gérant principal ou co-gérant actif, jamais coach
--        (PLAN_CHANGE_FORBIDDEN) ; transition pending → accepted / refused par
--        écriture conditionnelle (decided false si déjà décidée) ; acceptée :
--        box_members.plan_id = to_plan_id dans la même transaction
--        (trg_sync_member_plan_groups suit), après avoir rejoué la règle ;
--        amount_cents, s'il est renseigné, passe au prix de la nouvelle
--        formule dans la même instruction (NULL reste NULL : /compte et l'app
--        affichent amount_cents avant le prix de la formule).
--    La règle : `internal.refus_changement_formule`, check_violation
--    PLAN_CHANGE_NOT_MEMBER, _BOX_CLOSED, _NOT_COUNTER, _PAST_DUE, _PAUSED,
--    _CANCEL_SCHEDULED, _INVALID_PLAN (formule active, de la box, plan_type
--    subscription), _SAME_PLAN ; puis _PENDING_EXISTS.
-- 5. Notification au gérant : `internal.filer_notification_gerant` (prod
--    6b0bb58f80f3eeeaa883d838ae5049ce) gagne la branche plan_change_request
--    (member_id du demandeur, plan_id = formule demandée, event_ref = id de
--    la demande) ; le type entre dans la contrainte de box_manager_notifications ;
--    déclencheur `trg_notif_gerant_changement_formule`, AFTER INSERT (une
--    demande naît toujours en attente). Non bloquant, comme les cinq autres. Le texte
--    « {pseudo} demande à passer à {formule} » est à ajouter à
--    deliver-manager-notifications (regles.ts ne connaît pas ce type).
--
-- Données en prod : aucune ligne lue ni écrite ; colonnes et tables naissent
-- vides.
--
-- Contrôlée par `supabase/tests/changement_formule.sql`,
-- `supabase/tests/box_members_garde_facturation.sql` et le contrôle T15 de
-- l'audit des droits.
--
-- Retour arrière (transactionnel, rejoué par le test) :
--
--   psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 \
--     -f supabase/retours/20270147000000_changement_formule.sql
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Colonnes ───────────────────────────────────────────────────────────────
ALTER TABLE public.box_members
  ADD COLUMN scheduled_plan_id uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  ADD COLUMN scheduled_change_at timestamptz,
  ADD COLUMN stripe_schedule_id text;
COMMENT ON COLUMN public.box_members.scheduled_plan_id IS
  'Formule programmée à la prochaine échéance (abonnement Stripe). Écrite par le serveur seul.';
COMMENT ON COLUMN public.box_members.scheduled_change_at IS
  'Date de bascule vers scheduled_plan_id. Écrite par le serveur seul.';
COMMENT ON COLUMN public.box_members.stripe_schedule_id IS
  'Subscription schedule Stripe qui porte le changement programmé. Écrit par le serveur seul.';

CREATE TABLE public.box_stripe_portal (
  box_id                         uuid PRIMARY KEY REFERENCES public.boxes(id) ON DELETE CASCADE,
  stripe_portal_configuration_id text NOT NULL
);
COMMENT ON TABLE public.box_stripe_portal IS
  'Configuration du portail client Stripe de la box (compte connecté). Clé serveur seule : ni lue ni écrite par anon ou authenticated.';
ALTER TABLE public.box_stripe_portal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.box_stripe_portal FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.box_stripe_portal TO service_role;

-- ── 2. Garde des colonnes de facturation ─────────────────────────────────────
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

-- ── 3. Lecture par le membre ─────────────────────────────────────────────────
DROP FUNCTION public.get_my_membership_billing();

CREATE FUNCTION public.get_my_membership_billing()
 RETURNS TABLE(id uuid, box_id uuid, status text, joined_at timestamp with time zone, plan_id uuid, subscription_status text, subscription_current_period_end timestamp with time zone, subscription_cancel_at_period_end boolean, subscription_paused boolean, pause_resumes_at timestamp with time zone, commitment_end_date timestamp with time zone, amount_cents integer, past_due_since timestamp with time zone, dunning_grace_days integer, suspended boolean, has_stripe_subscription boolean, stopped_at timestamp with time zone, stop_mode text, scheduled_plan_id uuid, scheduled_change_at timestamp with time zone)
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
         arret.mode,
         bm.scheduled_plan_id,
         bm.scheduled_change_at
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

-- ── 4. Demandes de changement de formule (membres payant au comptoir) ────────
CREATE TABLE public.box_plan_change_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id       uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_plan_id uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  to_plan_id   uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  decided_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.box_plan_change_requests IS
  'Demandes de changement de formule d''un membre payant au comptoir, décidées par le gérant ou un co-gérant. Écrites seulement par request_plan_change, cancel_plan_change_request et decide_plan_change_request (clé serveur).';
-- Une seule demande en attente par membre et par box.
CREATE UNIQUE INDEX box_plan_change_requests_une_en_attente
  ON public.box_plan_change_requests (box_id, member_id) WHERE status = 'pending';
CREATE INDEX box_plan_change_requests_membre ON public.box_plan_change_requests (member_id);

ALTER TABLE public.box_plan_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.box_plan_change_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.box_plan_change_requests TO authenticated, service_role;
CREATE POLICY box_plan_change_requests_lecture_membre ON public.box_plan_change_requests
  FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY box_plan_change_requests_lecture_gerant ON public.box_plan_change_requests
  FOR SELECT TO authenticated
  USING (public.is_box_owner_admin(box_id));

-- La règle, une seule fois : le refus en clair (« CODE: message »), ou NULL si
-- le membre peut passer à cette formule. Lue à la demande et à l'acceptation.
CREATE FUNCTION internal.refus_changement_formule(p_member uuid, p_box uuid, p_to_plan uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  bm public.box_members;
BEGIN
  SELECT * INTO bm FROM public.box_members
   WHERE box_id = p_box AND member_id = p_member AND status = 'active';
  IF bm.id IS NULL THEN
    RETURN 'PLAN_CHANGE_NOT_MEMBER: tu n''es pas membre actif de cette box.';
  END IF;
  IF internal.refus_entree_box(p_box, 'achat') IS NOT NULL THEN
    RETURN 'PLAN_CHANGE_BOX_CLOSED: cette box ferme, la formule ne peut plus changer.';
  END IF;
  -- Abonnement Stripe vivant : le changement passe par l'échéancier Stripe.
  IF bm.stripe_subscription_id IS NOT NULL
     AND bm.subscription_status IN ('active', 'trialing', 'past_due') THEN
    RETURN 'PLAN_CHANGE_NOT_COUNTER: ton abonnement est payé en ligne, change de formule depuis la page de paiement.';
  END IF;
  IF bm.subscription_status = 'past_due' OR bm.past_due_since IS NOT NULL
     OR internal.membership_suspendu(p_member, p_box) THEN
    RETURN 'PLAN_CHANGE_PAST_DUE: règle d''abord ton impayé auprès de ta box.';
  END IF;
  IF bm.subscription_paused THEN
    RETURN 'PLAN_CHANGE_PAUSED: ton abonnement est en pause.';
  END IF;
  IF bm.subscription_cancel_at_period_end THEN
    RETURN 'PLAN_CHANGE_CANCEL_SCHEDULED: ton abonnement s''arrête à la fin de la période.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.membership_plans
                  WHERE id = p_to_plan AND box_id = p_box AND is_active
                    AND plan_type = 'subscription') THEN
    RETURN 'PLAN_CHANGE_INVALID_PLAN: cette formule n''est pas proposée par ta box.';
  END IF;
  IF bm.plan_id IS NOT DISTINCT FROM p_to_plan THEN
    RETURN 'PLAN_CHANGE_SAME_PLAN: c''est déjà ta formule.';
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION internal.refus_changement_formule(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.request_plan_change(p_member_id uuid, p_box_id uuid, p_to_plan_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_refus text;
  v_id    uuid;
BEGIN
  v_refus := internal.refus_changement_formule(p_member_id, p_box_id, p_to_plan_id);
  IF v_refus IS NOT NULL THEN
    RAISE EXCEPTION '%', v_refus USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.box_plan_change_requests (box_id, member_id, from_plan_id, to_plan_id)
  SELECT p_box_id, p_member_id, bm.plan_id, p_to_plan_id
    FROM public.box_members bm
   WHERE bm.box_id = p_box_id AND bm.member_id = p_member_id
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'PLAN_CHANGE_PENDING_EXISTS: une demande de changement est déjà en attente.'
    USING ERRCODE = 'check_violation';
END;
$function$;

CREATE FUNCTION public.cancel_plan_change_request(p_member_id uuid, p_box_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.box_plan_change_requests
     SET status = 'cancelled', decided_at = now(), decided_by = p_member_id
   WHERE box_id = p_box_id AND member_id = p_member_id AND status = 'pending';
  RETURN FOUND;
END;
$function$;

CREATE FUNCTION public.decide_plan_change_request(p_request_id uuid, p_actor_id uuid, p_accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r       public.box_plan_change_requests;
  v_refus text;
BEGIN
  SELECT * INTO r FROM public.box_plan_change_requests WHERE id = p_request_id;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'PLAN_CHANGE_NOT_FOUND: demande introuvable.' USING ERRCODE = 'check_violation';
  END IF;
  -- Gérant principal ou co-gérant actif de la box ; jamais le coach.
  IF p_actor_id IS NULL OR NOT (
       EXISTS (SELECT 1 FROM public.boxes WHERE id = r.box_id AND owner_id = p_actor_id)
       OR EXISTS (SELECT 1 FROM public.box_members
                   WHERE box_id = r.box_id AND member_id = p_actor_id
                     AND role = 'owner' AND COALESCE(status, 'active') = 'active')) THEN
    RAISE EXCEPTION 'PLAN_CHANGE_FORBIDDEN: seuls le gérant et les co-gérants de la box décident.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_accept AND r.status = 'pending' THEN
    v_refus := internal.refus_changement_formule(r.member_id, r.box_id, r.to_plan_id);
    IF v_refus IS NOT NULL THEN
      RAISE EXCEPTION '%', v_refus USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  -- Écriture conditionnelle : une demande déjà décidée ne bouge plus.
  UPDATE public.box_plan_change_requests
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'refused' END,
         decided_at = now(), decided_by = p_actor_id
   WHERE id = p_request_id AND status = 'pending'
  RETURNING * INTO r;
  IF NOT FOUND THEN
    SELECT * INTO r FROM public.box_plan_change_requests WHERE id = p_request_id;
    RETURN jsonb_build_object('decided', false, 'status', r.status);
  END IF;
  IF p_accept THEN
    -- trg_sync_member_plan_groups suit plan_id ; l'engagement ne change pas.
    -- Un montant noté suit le prix de la nouvelle formule ; NULL reste NULL
    -- (l'affichage retombe alors sur le prix de la formule).
    UPDATE public.box_members bm
       SET plan_id = r.to_plan_id,
           amount_cents = CASE WHEN bm.amount_cents IS NULL THEN NULL
                               ELSE (SELECT mp.price_cents FROM public.membership_plans mp WHERE mp.id = r.to_plan_id) END
     WHERE bm.box_id = r.box_id AND bm.member_id = r.member_id;
  END IF;
  RETURN jsonb_build_object('decided', true, 'status', r.status);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_plan_change(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_plan_change_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_plan_change_request(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_plan_change(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_plan_change_request(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_plan_change_request(uuid, uuid, boolean) TO service_role;

-- ── 5. Notification au gérant ───────────────────────────────────────────────
ALTER TABLE public.box_manager_notifications DROP CONSTRAINT box_manager_notifications_type_check;
ALTER TABLE public.box_manager_notifications ADD CONSTRAINT box_manager_notifications_type_check
  CHECK (type IN ('subscription_paid', 'payment_failed', 'booked_without_plan', 'invitation_accepted', 'plan_change_request'));

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
    ELSIF v_type = 'plan_change_request' THEN
      v_ref := NEW.id::text;
      v_membre := NEW.member_id;
      v_plan := NEW.to_plan_id;
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

CREATE TRIGGER trg_notif_gerant_changement_formule
  AFTER INSERT ON public.box_plan_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION internal.filer_notification_gerant('plan_change_request');

COMMIT;
