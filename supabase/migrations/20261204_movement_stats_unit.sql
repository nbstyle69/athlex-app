-- Cardio — compteurs de mouvement par unité (reps · m · cal).
--
-- Les trois tables de crédit (`movement_logs`, `user_movement_stats`,
-- `movement_rep_counts`) portent un seul entier par mouvement : les calories
-- d'un « 20 cal Row » s'ajoutaient aux reps, et un « 500m Run » valait 1.
-- Une colonne `unit` (défaut `reps`) sépare les totaux sans toucher aux
-- lignes existantes : tout ce qui est en base est, par construction, des reps.
--
-- Coexistence : la signature 4 arguments d'`increment_movement_stats` reste en
-- wrapper (unit = 'reps'), et aucun client n'écrit ces tables via `upsert`
-- avec `onConflict` — l'app en place continue de fonctionner à l'identique.

BEGIN;

-- ── 1. movement_logs : historique, pas d'unicité ───────────────────────────

ALTER TABLE public.movement_logs
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'reps';

ALTER TABLE public.movement_logs
  DROP CONSTRAINT IF EXISTS movement_logs_unit_check;
ALTER TABLE public.movement_logs
  ADD CONSTRAINT movement_logs_unit_check CHECK (unit IN ('reps', 'm', 'cal'));

COMMENT ON COLUMN public.movement_logs.unit IS
  'Unité de total_reps : reps (défaut), m (mètres) ou cal (calories).';

-- ── 2. user_movement_stats : PK (user_id, movement) → + unit ───────────────

ALTER TABLE public.user_movement_stats
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'reps';

ALTER TABLE public.user_movement_stats
  DROP CONSTRAINT IF EXISTS user_movement_stats_unit_check;
ALTER TABLE public.user_movement_stats
  ADD CONSTRAINT user_movement_stats_unit_check CHECK (unit IN ('reps', 'm', 'cal'));

ALTER TABLE public.user_movement_stats
  DROP CONSTRAINT IF EXISTS user_movement_stats_pkey;
ALTER TABLE public.user_movement_stats
  ADD CONSTRAINT user_movement_stats_pkey PRIMARY KEY (user_id, movement, unit);

COMMENT ON COLUMN public.user_movement_stats.unit IS
  'Unité de total_reps : reps (défaut), m (mètres) ou cal (calories). Un total par (mouvement, unité).';

-- ── 3. movement_rep_counts : UNIQUE (athlete_id, movement_key) → + unit ────

ALTER TABLE public.movement_rep_counts
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'reps';

ALTER TABLE public.movement_rep_counts
  DROP CONSTRAINT IF EXISTS movement_rep_counts_unit_check;
ALTER TABLE public.movement_rep_counts
  ADD CONSTRAINT movement_rep_counts_unit_check CHECK (unit IN ('reps', 'm', 'cal'));

ALTER TABLE public.movement_rep_counts
  DROP CONSTRAINT IF EXISTS movement_rep_counts_athlete_id_movement_key_key;
ALTER TABLE public.movement_rep_counts
  ADD CONSTRAINT movement_rep_counts_athlete_id_movement_key_unit_key
  UNIQUE (athlete_id, movement_key, unit);

COMMENT ON COLUMN public.movement_rep_counts.unit IS
  'Unité de total_reps : reps (défaut), m (mètres) ou cal (calories).';

-- ── 4. Vue movement_totals : un total par unité ────────────────────────────

DROP VIEW IF EXISTS public.movement_totals;
CREATE VIEW public.movement_totals AS
 SELECT user_id,
    movement,
    unit,
    sum(total_reps) AS lifetime_reps
   FROM public.movement_logs
  GROUP BY user_id, movement, unit;

GRANT ALL ON TABLE public.movement_totals TO anon;
GRANT ALL ON TABLE public.movement_totals TO authenticated;
GRANT ALL ON TABLE public.movement_totals TO service_role;

-- ── 5. RPC increment_movement_stats avec unité + wrapper legacy ────────────
--
-- Même garde que l'existant : un appelant client ne cumule QUE pour
-- auth.uid() ; seul service_role peut viser un p_user_id explicite.

CREATE OR REPLACE FUNCTION public.increment_movement_stats(
  p_user_id  uuid,
  p_movement text,
  p_reps     integer,
  p_weight   numeric,
  p_unit     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_target uuid;
  v_unit   text := COALESCE(p_unit, 'reps');
BEGIN
  v_target := CASE WHEN auth.role() = 'service_role'
                     THEN COALESCE(p_user_id, auth.uid())
                   ELSE auth.uid() END;
  IF v_target IS NULL THEN RETURN; END IF;
  IF v_unit NOT IN ('reps', 'm', 'cal') THEN
    RAISE EXCEPTION 'increment_movement_stats: unité inconnue %', v_unit;
  END IF;

  INSERT INTO public.user_movement_stats (user_id, movement, unit, total_reps, best_weight, updated_at)
  VALUES (v_target, p_movement, v_unit, p_reps, p_weight, now())
  ON CONFLICT (user_id, movement, unit) DO UPDATE SET
    total_reps  = user_movement_stats.total_reps + p_reps,
    best_weight = GREATEST(user_movement_stats.best_weight, p_weight),
    updated_at  = now();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric, text) TO service_role;

-- Signature historique (app en place) : délègue en unité `reps`.
CREATE OR REPLACE FUNCTION public.increment_movement_stats(
  p_user_id  uuid,
  p_movement text,
  p_reps     integer,
  p_weight   numeric DEFAULT NULL::numeric
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.increment_movement_stats(p_user_id, p_movement, p_reps, p_weight, 'reps');
$$;

REVOKE ALL ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric) TO service_role;

COMMIT;
