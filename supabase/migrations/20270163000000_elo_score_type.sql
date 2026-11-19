-- ═════════════════════════════════════════════════════════════════════════════
-- ELO de box et ELO global : le sens du classement suit le type de score choisi
-- par le créateur (AthleX-Manager #453, PR 1b : base)
--
-- Appliquée en prod : NON. Pas de BEGIN/COMMIT dans ce fichier : il se joue en
-- UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- À appliquer avant la PR Manager qui écrit box_wods.score_type.
--
-- Inventaire (rejeu et prod en lecture seule, 19/11/2026, md5 identiques) :
-- parmi les fonctions qui lisent wod_scores ou box_wods.wod_type, seules
-- compute_wod_elo (ELO global : profiles.elo, elo_history) et compute_box_elo
-- (box_elo, box_elo_history) choisissent un sens de classement, et elles le
-- tirent de box_wods.wod_type. global_leaderboard trie profiles.elo ; ligues et
-- tournois (compute_league_wod_elo, recalc_division_points, tournament_*) ne
-- lisent que tournament_wods ; aucune vue ne lit wod_scores.
--
-- Changement, identique dans les deux fonctions, sur la seule ligne qui lit le
-- WOD :
--   - score_type renseigné : v_is_time = (score_type = 'time'). 'time' prend
--     donc la logique For Time actuelle (croissant, capés derrière, 999999 +
--     reps), 'rounds_reps' / 'reps' / 'weight' la logique décroissante actuelle
--     (AMRAP et charge partagent déjà la même branche) ;
--   - score_type 'none' : aucune ELO (v_lb_enabled faux), en plus du CHECK
--     box_wods_sans_score_sans_classement_check ;
--   - score_type NULL : expression d'avant, mot pour mot (bw.wod_type =
--     'for-time'), y compris quand wod_type est NULL.
-- Les scores d'un autre type ne peuvent plus exister sur un WOD typé
-- (trg_wod_scores_type_du_wod, #606) : rien à ajouter de ce côté.
--
-- Garde de dérive : md5 de pg_get_functiondef relevé en prod (avant) ou
-- celui de cette migration (après, rejeu sans effet). Propriétaire et droits
-- conservés par CREATE OR REPLACE.
-- Retour arrière : supabase/retours/20270163000000_elo_score_type.sql.
-- Contrôlée par supabase/tests/elo_score_type.sql.
-- ═════════════════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  v_wod text := md5(pg_get_functiondef('public.compute_wod_elo(uuid)'::regprocedure));
  v_box text := md5(pg_get_functiondef('public.compute_box_elo(uuid)'::regprocedure));
BEGIN
  IF v_wod NOT IN ('e6ee4fce3d71a4a29ffd3bea93c102d2', '98dd9d5cd4ecb229c8c4a3ebe259a5ff') THEN
    RAISE EXCEPTION 'ELO_SCORE_TYPE_DERIVE: définition de compute_wod_elo inattendue (md5 %) : rien n''est écrit', v_wod;
  END IF;
  IF v_box NOT IN ('f04fa5d49d90ae61c989b18bb2afcd59', '45bf8589e8ffa0fa4dd45527ac21b5f1') THEN
    RAISE EXCEPTION 'ELO_SCORE_TYPE_DERIVE: définition de compute_box_elo inattendue (md5 %) : rien n''est écrit', v_box;
  END IF;
END $garde$;

-- ── ELO global ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_wod_elo(p_wod_id uuid)
 RETURNS TABLE(member_id uuid, elo_before integer, elo_after integer, elo_delta integer, rank integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_box_id       uuid;
  v_is_time      boolean;
  v_lb_enabled   boolean;
  v_n            int;
  k_pairwise     constant numeric := 64;
  scaled_mult    constant numeric := 0.4;
BEGIN
  -- Sens du classement (#453) : le type de score choisi par le créateur s'il
  -- existe ('time' : logique For Time ; 'rounds_reps', 'reps', 'weight' :
  -- décroissant), sinon wod_type comme avant. 'none' : jamais d'ELO.
  SELECT bw.box_id,
         CASE WHEN bw.score_type IS NULL THEN bw.wod_type = 'for-time'
              ELSE bw.score_type = 'time' END,
         COALESCE(bw.leaderboard_enabled, true) AND bw.score_type IS DISTINCT FROM 'none'
    INTO v_box_id, v_is_time, v_lb_enabled
    FROM box_wods bw WHERE bw.id = p_wod_id;

  IF v_box_id IS NULL THEN RAISE EXCEPTION 'WOD introuvable'; END IF;

  IF NOT (
    is_box_owner(v_box_id) OR EXISTS (
      SELECT 1 FROM box_members bm
       WHERE bm.box_id = v_box_id AND bm.member_id = auth.uid() AND bm.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF NOT v_lb_enabled THEN RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_wod_id::text));
  IF EXISTS (SELECT 1 FROM elo_history eh WHERE eh.wod_id = p_wod_id) THEN RETURN; END IF;

  CREATE TEMP TABLE _wod_field ON COMMIT DROP AS
  WITH scores AS (
    SELECT ws.member_id, COALESCE(p.elo, 1000)::int AS elo,
           CASE WHEN v_is_time AND ws.score_value >= 999999
                THEN ws.score_value - 999999 ELSE ws.score_value END AS score_value,
           COALESCE(ws.rx, false) AS rx,
           (v_is_time AND (COALESCE(ws.capped, false) OR ws.score_value >= 999999)) AS capped
      FROM wod_scores ws JOIN profiles p ON p.id = ws.member_id
     WHERE ws.wod_id = p_wod_id
  ),
  ordered AS (
    SELECT s.*, ROW_NUMBER() OVER (
             ORDER BY (CASE WHEN s.rx THEN 0 ELSE 1 END) ASC,
                      (CASE WHEN s.capped THEN 1 ELSE 0 END) ASC,
                      CASE WHEN v_is_time AND NOT s.capped THEN s.score_value END ASC,
                      CASE WHEN v_is_time AND     s.capped THEN s.score_value END DESC,
                      CASE WHEN NOT v_is_time              THEN s.score_value END DESC
           ) AS seq
      FROM scores s
  ),
  ranked AS (
    -- Partition élargie à capped : un capped à 100 reps ne doit pas égaliser un
    -- finisher à 100 s (même score_value, sens opposé).
    SELECT o.*, MIN(o.seq) OVER (PARTITION BY o.rx, o.capped, o.score_value) AS rnk FROM ordered o
  )
  SELECT member_id, elo, rx, rnk::int AS rank FROM ranked;

  SELECT COUNT(*) INTO v_n FROM _wod_field;
  IF v_n < 2 THEN RETURN; END IF;

  CREATE TEMP TABLE _wod_deltas ON COMMIT DROP AS
  SELECT a.member_id, a.elo AS elo_before, a.rank,
         ROUND(
           ROUND( (k_pairwise / (v_n - 1)) * (
             (SELECT COALESCE(SUM(CASE WHEN a.rank < b.rank THEN 1 WHEN a.rank = b.rank THEN 0.5 ELSE 0 END),0)
                FROM _wod_field b WHERE b.member_id <> a.member_id)
             - (SELECT COALESCE(SUM(1 / (1 + POWER(10, (b.elo - a.elo) / 400.0))),0)
                FROM _wod_field b WHERE b.member_id <> a.member_id)
           ) )
           * (CASE WHEN a.rx THEN 1 ELSE scaled_mult END)
         )::int AS elo_delta
    FROM _wod_field a;

  -- ── PLANCHER 100 : elo_after plafonné, elo_delta recalculé pour cohérence ──
  INSERT INTO elo_history (box_id, wod_id, member_id, elo_before, elo_after, elo_delta, rank)
  SELECT v_box_id, p_wod_id, d.member_id, d.elo_before,
         GREATEST(100, d.elo_before + d.elo_delta),
         GREATEST(100, d.elo_before + d.elo_delta) - d.elo_before,
         d.rank
    FROM _wod_deltas d
  ON CONFLICT (wod_id, member_id) DO NOTHING;

  UPDATE profiles p
     SET elo           = GREATEST(100, d.elo_before + d.elo_delta),
         total_matches = p.total_matches + 1,
         wins          = p.wins + (CASE WHEN d.rank = 1 THEN 1 ELSE 0 END)
    FROM _wod_deltas d
   WHERE p.id = d.member_id;

  RETURN QUERY
    SELECT d.member_id, d.elo_before,
           GREATEST(100, d.elo_before + d.elo_delta) AS elo_after,
           GREATEST(100, d.elo_before + d.elo_delta) - d.elo_before AS elo_delta,
           d.rank
      FROM _wod_deltas d;
END;
$function$
;

-- ── ELO de box ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_box_elo(p_wod_id uuid)
 RETURNS TABLE(member_id uuid, elo_before integer, elo_after integer, elo_delta integer, rank integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_box_id     uuid;
  v_is_time    boolean;
  v_lb_enabled boolean;
  v_n          int;
  k_pairwise   constant numeric := 64;
  scaled_mult  constant numeric := 0.4;
BEGIN
  -- Sens du classement (#453) : le type de score choisi par le créateur s'il
  -- existe ('time' : logique For Time ; 'rounds_reps', 'reps', 'weight' :
  -- décroissant), sinon wod_type comme avant. 'none' : jamais d'ELO.
  SELECT bw.box_id,
         CASE WHEN bw.score_type IS NULL THEN bw.wod_type = 'for-time'
              ELSE bw.score_type = 'time' END,
         COALESCE(bw.leaderboard_enabled, true) AND bw.score_type IS DISTINCT FROM 'none'
    INTO v_box_id, v_is_time, v_lb_enabled
    FROM box_wods bw WHERE bw.id = p_wod_id;

  IF v_box_id IS NULL THEN RAISE EXCEPTION 'WOD introuvable'; END IF;

  IF NOT (
    is_box_owner(v_box_id) OR EXISTS (
      SELECT 1 FROM box_members bm
       WHERE bm.box_id = v_box_id AND bm.member_id = auth.uid() AND bm.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF NOT v_lb_enabled THEN RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('boxelo:' || p_wod_id::text));
  IF EXISTS (SELECT 1 FROM box_elo_history h WHERE h.wod_id = p_wod_id) THEN RETURN; END IF;

  CREATE TEMP TABLE _bx_field ON COMMIT DROP AS
  WITH scores AS (
    SELECT ws.member_id, COALESCE(be.elo, 1000)::int AS elo,
           CASE WHEN v_is_time AND ws.score_value >= 999999
                THEN ws.score_value - 999999 ELSE ws.score_value END AS score_value,
           COALESCE(ws.rx, false) AS rx,
           (v_is_time AND (COALESCE(ws.capped, false) OR ws.score_value >= 999999)) AS capped
      FROM wod_scores ws
      LEFT JOIN box_elo be ON be.member_id = ws.member_id AND be.box_id = v_box_id
     WHERE ws.wod_id = p_wod_id
  ),
  ordered AS (
    SELECT s.*, ROW_NUMBER() OVER (
             ORDER BY (CASE WHEN s.rx THEN 0 ELSE 1 END) ASC,
                      (CASE WHEN s.capped THEN 1 ELSE 0 END) ASC,
                      CASE WHEN v_is_time AND NOT s.capped THEN s.score_value END ASC,
                      CASE WHEN v_is_time AND     s.capped THEN s.score_value END DESC,
                      CASE WHEN NOT v_is_time              THEN s.score_value END DESC
           ) AS seq
      FROM scores s
  ),
  ranked AS (
    SELECT o.*, MIN(o.seq) OVER (PARTITION BY o.rx, o.capped, o.score_value) AS rnk FROM ordered o
  )
  SELECT member_id, elo, rx, rnk::int AS rank FROM ranked;

  SELECT COUNT(*) INTO v_n FROM _bx_field;
  IF v_n < 2 THEN RETURN; END IF;

  CREATE TEMP TABLE _bx_deltas ON COMMIT DROP AS
  SELECT a.member_id, a.elo AS elo_before, a.rank,
         ROUND(
           ROUND( (k_pairwise / (v_n - 1)) * (
             (SELECT COALESCE(SUM(CASE WHEN a.rank < b.rank THEN 1 WHEN a.rank = b.rank THEN 0.5 ELSE 0 END),0)
                FROM _bx_field b WHERE b.member_id <> a.member_id)
             - (SELECT COALESCE(SUM(1 / (1 + POWER(10, (b.elo - a.elo) / 400.0))),0)
                FROM _bx_field b WHERE b.member_id <> a.member_id)
           ) )
           * (CASE WHEN a.rx THEN 1 ELSE scaled_mult END)
         )::int AS elo_delta
    FROM _bx_field a;

  INSERT INTO box_elo_history (box_id, wod_id, member_id, elo_before, elo_after, elo_delta, rank)
  SELECT v_box_id, p_wod_id, d.member_id, d.elo_before,
         GREATEST(100, d.elo_before + d.elo_delta),
         GREATEST(100, d.elo_before + d.elo_delta) - d.elo_before,   -- ← cohérence
         d.rank
    FROM _bx_deltas d
  ON CONFLICT (wod_id, member_id) DO NOTHING;

  INSERT INTO box_elo (member_id, box_id, elo, matches, wins, updated_at)
  SELECT d.member_id, v_box_id,
         GREATEST(100, d.elo_before + d.elo_delta),
         1,
         (CASE WHEN d.rank = 1 THEN 1 ELSE 0 END),
         now()
    FROM _bx_deltas d
  ON CONFLICT (member_id, box_id) DO UPDATE
     SET elo        = EXCLUDED.elo,
         matches    = box_elo.matches + 1,
         wins       = box_elo.wins + EXCLUDED.wins,
         updated_at = now();

  RETURN QUERY
    SELECT d.member_id, d.elo_before,
           GREATEST(100, d.elo_before + d.elo_delta) AS elo_after,
           GREATEST(100, d.elo_before + d.elo_delta) - d.elo_before AS elo_delta,
           d.rank
      FROM _bx_deltas d;
END;
$function$
;
