-- ═════════════════════════════════════════════════════════════════════════════
-- Rejoindre une box en payant, lot 3 (base) : prochaine échéance d'un adhérent
-- migré et jour de prélèvement
--
-- Appliquée en prod : NON
--
-- Un adhérent qui arrive d'un autre logiciel a une « prochaine échéance » (date
-- où l'ancien prestataire l'aurait prélevé), que le gérant renseigne sur
-- l'invitation ou dans l'import. Chaque adhérent choisit un jour de prélèvement
-- du 1er au 10, écrit plus tard par le webhook du Manager. Le calcul (prorata,
-- premier prélèvement à l'échéance) et Stripe restent côté Manager : ici,
-- seulement les données.
--
-- 1. Colonnes : `box_invitations.next_due_date` (date, NULL) ;
--    `box_members.billing_day` et `pending_entitlements.billing_day` (smallint,
--    NULL, CHECK 1 à 10). Droits de table inchangés : `authenticated` ne lit de
--    box_members que six colonnes nommées, donc pas billing_day ; box_invitations
--    reste bornée par `box_invitations_owner_manage` (gérant ou co-gérant) ;
--    pending_entitlements reste à la seule clé serveur.
-- 2. `internal.garder_facturation_membre` (prod e0dfcd26b73cf9bab5b70f16bcfc672c) :
--    billing_day devient la 19e colonne réservée au serveur. Seul ajout, porté
--    aussi à la liste de colonnes de son déclencheur
--    `trg_box_members_garde_facturation` (BEFORE INSERT OR UPDATE OF …, prod
--    30cc7eaef70e796798e60b05637b1793), recréé à l'identique hormis billing_day.
-- 3. `create_box_invitation` : nouveau paramètre `p_next_due_date text DEFAULT
--    NULL` en dernier. DROP de la version à 8 arguments et CREATE de celle à 9
--    (un CREATE OR REPLACE aurait laissé deux versions, et tout appel de 2 à 8
--    arguments serait devenu ambigu) ; droits et commentaire réappliqués à
--    l'identique. Échéance vide ou absente : comportement inchangé. Sinon
--    AAAA-MM-JJ d'une date qui existe (DUE_DATE_INVALID), strictement après
--    aujourd'hui à Paris (DUE_DATE_PAST), au plus douze mois après
--    (DUE_DATE_TOO_FAR) ; check_violation. Le JSON renvoyé ne change pas.
--    Corps de prod e0b48f48b0211c34dea71318ee5c4795.
-- 4. `create_box_invitations_bulk` (prod 809ebf560992450ca12d4b44a1c068be),
--    signature inchangée : clé facultative `next_due_date` par ligne, mêmes
--    règles, rendues en verdict `refusee` (raison DUE_DATE_INVALID, DUE_DATE_PAST
--    ou DUE_DATE_TOO_FAR), ligne non créée. Contrôlée après la formule et avant
--    le doublon : une ligne refusée ne compte pas comme vue.
-- 5. `resolve_box_invitation_for_checkout` (prod 4c2288bfd50cf37eaf1d033d91245e7c)
--    et `peek_box_invitation` (prod 09b37db76642449d20d9338357c30ab7) : renvoient
--    aussi `next_due_date` (null si absente).
-- 6. `claim_pending_entitlements` (prod 39653b35af642ffa91662e886a1ab96e) recopie
--    la facturation d'un paiement antérieur au compte vers box_members ; elle
--    recopie désormais `pending_entitlements.billing_day`, à l'insertion comme à
--    la mise à jour (comme les autres colonnes, une valeur absente écrit NULL).
--
-- Rien d'autre : ni règle, ni autre fonction, ni donnée existante (les colonnes
-- naissent vides).
--
-- Contrôlée par `supabase/tests/echeance_jour_prelevement.sql` et
-- `supabase/tests/box_members_garde_facturation.sql`.
--
-- Retour arrière (transactionnel, vérifié en CI par echeance_jour_prelevement.sql
-- contre les md5 de prod relevés le 27/09/2026) :
--
--   psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 \
--     -f supabase/retours/20270135000000_echeance_jour_prelevement.sql
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.box_invitations ADD COLUMN next_due_date date;
ALTER TABLE public.box_members ADD COLUMN billing_day smallint
  CONSTRAINT box_members_billing_day_check CHECK (billing_day BETWEEN 1 AND 10);
ALTER TABLE public.pending_entitlements ADD COLUMN billing_day smallint
  CONSTRAINT pending_entitlements_billing_day_check CHECK (billing_day BETWEEN 1 AND 10);

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

-- Le déclencheur ne se lève que sur les colonnes nommées (prod : les 18 et
-- status, md5 30cc7eaef70e796798e60b05637b1793) : billing_day y est ajoutée,
-- sinon la garde ne verrait jamais sa mise à jour. Même nom, donc même rang
-- parmi les BEFORE.
DROP TRIGGER trg_box_members_garde_facturation ON public.box_members;
CREATE TRIGGER trg_box_members_garde_facturation BEFORE INSERT OR UPDATE OF plan_id, subscription_status, stripe_subscription_id, stripe_checkout_session_id, subscription_current_period_end, subscription_cancel_at_period_end, amount_cents, platform_fee_cents, commitment_end_date, subscription_paused, pause_started_at, pause_resumes_at, payment_method_type, past_due_since, dunning_attempts, last_payment_error, dunning_reminders_sent, dunning_last_reminder_at, billing_day, status ON public.box_members FOR EACH ROW EXECUTE FUNCTION internal.garder_facturation_membre();

DROP FUNCTION public.create_box_invitation(uuid, text, text, text, uuid, text, boolean, integer);

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

CREATE OR REPLACE FUNCTION public.create_box_invitations_bulk(p_box_id uuid, p_rows jsonb, p_valid_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row      jsonb;
  v_email    text;
  v_plan     uuid;
  v_blocker  text;
  v_token    text;
  v_id       uuid;
  v_days     integer := least(greatest(coalesce(p_valid_days, 14), 1), 30);
  v_line     integer := 0;
  v_created  integer := 0;
  v_ignored  integer := 0;
  v_refused  integer := 0;
  v_seen     text[]  := ARRAY[]::text[];
  v_results  jsonb   := '[]'::jsonb;
  v_verdict  text;
  v_reason   text;
  v_due      text;
  v_due_date date;
  v_today    date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: connexion requise' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT public.is_box_owner_admin(p_box_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: vous n''administrez pas cette box'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: liste de lignes attendue' USING ERRCODE = 'check_violation';
  END IF;

  -- Plafond : un import est une reprise d'effectif, pas un publipostage.
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'TOO_MANY_ROWS: 500 lignes maximum par import'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_line   := v_line + 1;
    v_email  := lower(btrim(coalesce(v_row->>'email', '')));
    v_verdict := NULL;
    v_reason  := NULL;
    v_id      := NULL;
    v_due      := nullif(btrim(coalesce(v_row->>'next_due_date', '')), '');
    v_due_date := NULL;

    BEGIN
      v_plan := nullif(v_row->>'plan_id', '')::uuid;
    EXCEPTION WHEN others THEN
      v_plan := NULL;
      v_verdict := 'refusee';
      v_reason  := 'formule_inconnue';
    END;

    IF v_verdict IS NULL AND v_plan IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.membership_plans WHERE id = v_plan AND box_id = p_box_id
    ) THEN
      -- Couvre le fichier piégé : une formule d'une AUTRE box est inconnue ici.
      v_verdict := 'refusee';
      v_reason  := 'formule_inconnue';
    END IF;

    -- Prochaine échéance : mêmes règles que create_box_invitation.
    IF v_verdict IS NULL AND v_due IS NOT NULL THEN
      IF v_due !~ '^\d{4}-\d{2}-\d{2}$' THEN
        v_verdict := 'refusee'; v_reason := 'DUE_DATE_INVALID';
      ELSE
        BEGIN
          v_due_date := v_due::date;
        EXCEPTION WHEN others THEN
          v_verdict := 'refusee'; v_reason := 'DUE_DATE_INVALID';
        END;
      END IF;
      IF v_verdict IS NULL AND v_due_date <= v_today THEN
        v_verdict := 'refusee'; v_reason := 'DUE_DATE_PAST';
      ELSIF v_verdict IS NULL AND v_due_date > (v_today + interval '12 months')::date THEN
        v_verdict := 'refusee'; v_reason := 'DUE_DATE_TOO_FAR';
      END IF;
    END IF;

    -- Doublon interne au fichier : la première ligne gagne, les suivantes sont
    -- ignorées sans jamais devenir une seconde invitation vivante.
    IF v_verdict IS NULL AND v_email = ANY (v_seen) THEN
      v_verdict := 'ignoree';
      v_reason  := 'doublon_fichier';
    END IF;

    IF v_verdict IS NULL THEN
      v_blocker := public.invitation_target_blocker(p_box_id, v_email);
      IF v_blocker = 'email_invalide' THEN
        v_verdict := 'refusee'; v_reason := 'email_invalide';
      ELSIF v_blocker = 'membre_exclu' THEN
        v_verdict := 'refusee'; v_reason := 'membre_exclu';
      ELSIF v_blocker = 'deja_membre' THEN
        v_verdict := 'ignoree'; v_reason := 'deja_membre';
      ELSIF v_blocker = 'invitation_en_attente' THEN
        v_verdict := 'ignoree'; v_reason := 'invitation_en_attente';
      END IF;
    END IF;

    IF v_verdict IS NULL THEN
      v_token := encode(extensions.gen_random_bytes(32), 'hex');
      INSERT INTO public.box_invitations (
        box_id, email, first_name, last_name, plan_id,
        payment_mode, cash_collected, token_hash, expires_at, created_by, next_due_date
      ) VALUES (
        p_box_id, v_email,
        nullif(btrim(coalesce(v_row->>'first_name', '')), ''),
        nullif(btrim(coalesce(v_row->>'last_name', '')), ''),
        v_plan, 'box', false,
        encode(sha256(v_token::bytea), 'hex'),
        now() + make_interval(days => v_days),
        auth.uid(),
        v_due_date
      )
      RETURNING id INTO v_id;
      v_verdict := 'creee';
      v_seen    := v_seen || v_email;
    END IF;

    IF    v_verdict = 'creee'   THEN v_created := v_created + 1;
    ELSIF v_verdict = 'ignoree' THEN v_ignored := v_ignored + 1;
    ELSE                             v_refused := v_refused + 1;
    END IF;

    v_results := v_results || jsonb_build_object(
      'line', coalesce((v_row->>'line')::integer, v_line),
      'email', v_email,
      'verdict', v_verdict,
      'reason', v_reason,
      'invitation_id', v_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'total',   v_line,
    'created', v_created,
    'ignored', v_ignored,
    'refused', v_refused,
    'results', v_results
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_box_invitation_for_checkout(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r public.box_invitations;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_TOKEN');
  END IF;

  SELECT * INTO r
  FROM public.box_invitations
  WHERE token_hash = encode(sha256(btrim(p_token)::bytea), 'hex');

  IF r.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_TOKEN');
  END IF;

  IF r.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'REVOKED');
  END IF;

  -- L'expiration protège le lien, pas le paiement : une invitation déjà
  -- acceptée reste payable même après la date, sinon un membre créé la veille
  -- de l'expiration se retrouverait avec un compte et aucun moyen de payer.
  IF r.status = 'pending' AND r.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'EXPIRED');
  END IF;

  IF r.payment_mode <> 'stripe' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_STRIPE');
  END IF;

  IF r.plan_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_PLAN');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', r.id,
    'box_id', r.box_id,
    'plan_id', r.plan_id,
    'email', r.email,
    'status', r.status,
    'next_due_date', r.next_due_date
  );
END;
$function$
;

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
    'next_due_date', r.next_due_date,
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
$function$
;

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
          commitment_end_date, payment_method_type, billing_day
        ) VALUES (
          (r.payload->>'box_id')::uuid, p_user_id, 'member',
          (r.payload->>'plan_id')::uuid, 'active', 'active',
          r.payload->>'stripe_subscription_id', r.stripe_checkout_session_id,
          (r.payload->>'subscription_current_period_end')::timestamptz,
          (r.payload->>'amount_cents')::integer,
          (r.payload->>'platform_fee_cents')::integer,
          (r.payload->>'commitment_end_date')::timestamptz,
          r.payload->>'payment_method_type',
          r.billing_day
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
          payment_method_type = r.payload->>'payment_method_type',
          billing_day = r.billing_day
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
$function$
;

COMMIT;
