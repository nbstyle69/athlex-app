-- Programmes athlètes, suite de 20261207 : trois décisions produit.
--
-- 1. La date de début est choisie par l'athlète, APRÈS l'achat, et c'est un
--    lundi (semaine 1 = 7 jours pleins). `program_members.start_date` reste
--    NULL tant qu'il n'a pas choisi : l'app affiche « Choisir ma date de
--    début », jamais du vide. Les trois chemins d'écriture (join_program /
--    assign_program_cash via _upsert_program_member, claim_pending_entitlements)
--    cessent de poser `current_date`. La date reste modifiable tant qu'aucune
--    séance du programme n'a été scorée : RPC `set_program_start_date`.
--
-- 2. Pas de classement ni d'ELO sur une séance relative : deux athlètes ne la
--    font pas le même jour, comparer n'a pas de sens. `leaderboard_enabled`
--    est forcé à false par le CHECK, et un trigger refuse toute ligne
--    d'historique ELO qui pointerait vers une séance relative — quel que soit
--    le chemin (compute_wod_elo, compute_box_elo, écriture directe).
--
-- 3. Jours de repos libres, par semaine : `program_rest_days`. Un repos est
--    une décision du coach, pas l'absence de séance ; `days_per_week` redevient
--    informatif.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Date de début : nullable, lundi, choisie par l'athlète
-- ---------------------------------------------------------------------------

ALTER TABLE public.program_members
  ALTER COLUMN start_date DROP NOT NULL;

-- NOT VALID : les inscriptions existantes ont une date de début quelconque
-- (posée par `current_date` à l'achat) ; `programWeekAt` les lit déjà via
-- `mondayOf`, on ne réécrit pas des données d'achat. Toute nouvelle valeur,
-- elle, est un lundi.
ALTER TABLE public.program_members DROP CONSTRAINT IF EXISTS program_members_start_date_lundi;
ALTER TABLE public.program_members ADD CONSTRAINT program_members_start_date_lundi
  CHECK (start_date IS NULL OR EXTRACT(ISODOW FROM start_date) = 1) NOT VALID;

COMMENT ON COLUMN public.program_members.start_date IS
  'Lundi choisi par l''athlète après l''achat (semaine 1). NULL = pas encore choisi : l''app doit le demander, pas afficher du vide.';

CREATE OR REPLACE FUNCTION public._upsert_program_member(
  p_program_id uuid,
  p_user_id uuid,
  p_start_date date,
  p_provenance text,
  p_amount_cents integer DEFAULT NULL,
  p_platform_fee_cents integer DEFAULT NULL,
  p_stripe_checkout_session_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_payment_intent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
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
$$;

-- Même chemin, même dérivation que 20261117 (les DEFAULT ne changent pas la
-- signature) ; seule différence : `p_start_date` NULL reste NULL.

CREATE OR REPLACE FUNCTION public.claim_pending_entitlements(
  p_user_id uuid,
  p_email text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.pending_entitlements;
  v_claimed integer := 0;
  v_member_id uuid;
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
$$;

REVOKE ALL ON FUNCTION public.claim_pending_entitlements(uuid, text) FROM PUBLIC, anon, authenticated;

-- L'athlète choisit (ou change) sa date : un lundi, et seulement tant qu'il
-- n'a scoré aucune séance du programme — après, la semaine 1 est de l'histoire.
CREATE OR REPLACE FUNCTION public.set_program_start_date(
  p_program_id uuid,
  p_start_date date
)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;
  IF p_start_date IS NULL OR EXTRACT(ISODOW FROM p_start_date) <> 1 THEN
    RAISE EXCEPTION 'La date de début doit être un lundi' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.program_members pm
    WHERE pm.program_id = p_program_id AND pm.user_id = v_uid AND pm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Aucune inscription active à ce programme' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.wod_scores s
    JOIN public.wod_program_access a ON a.wod_id = s.wod_id
    WHERE a.program_id = p_program_id AND s.member_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Date de début verrouillée : une séance de ce programme a déjà été scorée'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.program_members
  SET start_date = p_start_date
  WHERE program_id = p_program_id AND user_id = v_uid;

  RETURN p_start_date;
END;
$$;

REVOKE ALL ON FUNCTION public.set_program_start_date(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_program_start_date(uuid, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Ni classement ni ELO sur une séance relative
-- ---------------------------------------------------------------------------

ALTER TABLE public.box_wods DROP CONSTRAINT IF EXISTS box_wods_ancrage_check;
ALTER TABLE public.box_wods ADD CONSTRAINT box_wods_ancrage_check CHECK (
  (scheduled_date IS NOT NULL AND program_week IS NULL AND program_day IS NULL)
  OR
  (scheduled_date IS NULL
   AND program_week IS NOT NULL AND program_week >= 1
   AND program_day IS NOT NULL AND program_day BETWEEN 1 AND 7
   AND leaderboard_enabled = false)
);

-- Ceinture en plus des bretelles : compute_wod_elo / compute_box_elo sortent
-- déjà sur `leaderboard_enabled = false`, mais c'est la table d'historique qui
-- doit être infranchissable, pas un chemin particulier.
CREATE OR REPLACE FUNCTION public.refuse_elo_seance_relative()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.wod_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.box_wods w WHERE w.id = NEW.wod_id AND w.scheduled_date IS NULL
  ) THEN
    RAISE EXCEPTION 'Pas d''ELO sur une séance de programme (WOD % sans date)', NEW.wod_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_elo_history_seance_relative ON public.elo_history;
CREATE TRIGGER trg_elo_history_seance_relative
  BEFORE INSERT OR UPDATE OF wod_id ON public.elo_history
  FOR EACH ROW EXECUTE FUNCTION public.refuse_elo_seance_relative();

DROP TRIGGER IF EXISTS trg_box_elo_history_seance_relative ON public.box_elo_history;
CREATE TRIGGER trg_box_elo_history_seance_relative
  BEFORE INSERT OR UPDATE OF wod_id ON public.box_elo_history
  FOR EACH ROW EXECUTE FUNCTION public.refuse_elo_seance_relative();

-- ---------------------------------------------------------------------------
-- 3. Jours de repos explicites, par semaine
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_rest_days (
  program_id   uuid     NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  program_week smallint NOT NULL CHECK (program_week >= 1),
  program_day  smallint NOT NULL CHECK (program_day BETWEEN 1 AND 7),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (program_id, program_week, program_day)
);

COMMENT ON TABLE public.program_rest_days IS
  'Jour marqué « Repos » par le coach sur la grille relative d''un programme (semaine × jour ISO). Un jour sans séance et sans cette marque n''est pas un repos, c''est un jour vide.';

ALTER TABLE public.program_rest_days ENABLE ROW LEVEL SECURITY;

-- Le gérant/admin de la box du programme écrit ; l'acheteur actif et le
-- membre de la box lisent (même périmètre que `wod_program_access`).
DROP POLICY IF EXISTS program_rest_days_admin_write ON public.program_rest_days;
CREATE POLICY program_rest_days_admin_write ON public.program_rest_days
  FOR ALL
  TO authenticated
  USING (program_id IN (
    SELECT p.id FROM public.programs p WHERE public.is_box_owner_admin(p.box_id)
  ))
  WITH CHECK (program_id IN (
    SELECT p.id FROM public.programs p WHERE public.is_box_owner_admin(p.box_id)
  ));

DROP POLICY IF EXISTS program_rest_days_member_read ON public.program_rest_days;
CREATE POLICY program_rest_days_member_read ON public.program_rest_days
  FOR SELECT
  TO authenticated
  USING (
    program_id IN (
      SELECT pm.program_id FROM public.program_members pm
      WHERE pm.user_id = auth.uid() AND pm.status = 'active'
    )
    OR program_id IN (
      SELECT p.id FROM public.programs p WHERE p.box_id IN (SELECT public.get_user_box_ids())
    )
  );

REVOKE ALL ON TABLE public.program_rest_days FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.program_rest_days TO authenticated;
GRANT ALL ON TABLE public.program_rest_days TO service_role;

COMMIT;
