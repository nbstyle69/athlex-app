-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270163000000_elo_score_type.sql (#453, PR 1b)
--
-- À jouer en UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : les tests le rejouent dans leur propre
-- transaction annulée).
--
-- Remet compute_wod_elo et compute_box_elo telles qu'en prod avant la
-- migration (md5 e6ee4fce… / f04fa5d4…) : le sens du classement revient à
-- box_wods.wod_type pour tous les WODs. Aucune donnée touchée ; l'ELO déjà
-- calculé (elo_history, box_elo_history) reste tel quel. Tant que le Manager
-- ne pose aucun score_type, ce retour ne change aucun classement.
-- ═════════════════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  v_wod text := md5(pg_get_functiondef('public.compute_wod_elo(uuid)'::regprocedure));
  v_box text := md5(pg_get_functiondef('public.compute_box_elo(uuid)'::regprocedure));
BEGIN
  IF v_wod <> '98dd9d5cd4ecb229c8c4a3ebe259a5ff' OR v_box <> '45bf8589e8ffa0fa4dd45527ac21b5f1' THEN
    RAISE EXCEPTION 'ELO_SCORE_TYPE_RETOUR_DERIVE: définitions inattendues (compute_wod_elo %, compute_box_elo %) : rien n''est écrit', v_wod, v_box;
  END IF;
END $garde$;

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
  SELECT bw.box_id, (bw.wod_type = 'for-time'), COALESCE(bw.leaderboard_enabled, true)
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
  SELECT bw.box_id, (bw.wod_type = 'for-time'), COALESCE(bw.leaderboard_enabled, true)
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
