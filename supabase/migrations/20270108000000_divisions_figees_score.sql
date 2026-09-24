-- ═════════════════════════════════════════════════════════════════════════════
-- Divisions figées au moment du WOD — tournois, PR 3
--
-- Appliquée en prod : NON
--
-- Dans une ligue à divisions (`league_div`), les points d'un WOD se gagnent par
-- rang DANS SA DIVISION. `internal.recalc_division_points` recalculait tout à
-- partir de l'appartenance ACTUELLE : un athlète changé de division reclassait
-- ses anciens scores dans sa nouvelle division et faisait bouger les points de
-- ses nouveaux voisins. Et aucun filtre de saison : après une fin de saison, le
-- premier score recalculait les points avec les WOD des saisons passées.
--
-- La solution la plus simple : la division est enregistrée AVEC le score.
--   * `tournament_scores.division_id` : posée par le serveur à l'insertion
--     (trigger `trg_tournament_scores_division`), d'après l'appartenance de
--     l'athlète à cet instant. Une valeur envoyée par le client est ignorée ;
--   * colonne réservée au staff du tournoi (ajoutée à
--     `trg_tournament_scores_colonnes_reservees`) : un athlète ne peut pas la
--     changer, le gérant peut la corriger ;
--   * `internal.recalc_division_points` classe chaque score dans SA division (à
--     défaut, pour un score antérieur à cette règle, l'appartenance actuelle),
--     sur les WOD de la saison en cours seulement, et crédite les points à
--     l'athlète sur sa ligne d'appartenance actuelle. Le barème (100, 97, 94…,
--     plancher 1) et le tri ne changent pas.
-- Pas d'historique d'appartenance : la division du score suffit.
--
-- Données en prod : aucune ligue, donc aucun score de ligue. La reprise des
-- scores existants (division actuelle) est posée pour la forme et ne touche
-- aucune ligne en prod.
--
-- Contrôlée par `supabase/tests/divisions_figees_score.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.tournament_scores
  ADD COLUMN IF NOT EXISTS division_id uuid
    REFERENCES public.tournament_divisions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tournament_scores.division_id IS
  'Division de l''athlète au moment du score (ligues). Posée par le serveur à l''insertion ; réservée au staff.';

-- Reprise : les scores de ligue déjà présents prennent la division actuelle de
-- leur athlète (aucun en prod au 24/09/2026).
UPDATE public.tournament_scores ts
   SET division_id = tdm.division_id
  FROM public.tournament_division_members tdm
  JOIN public.tournament_divisions d ON d.id = tdm.division_id
 WHERE ts.division_id IS NULL
   AND d.tournament_id = ts.tournament_id
   AND tdm.athlete_id = ts.athlete_id;

-- La division est posée par le serveur à l'insertion, quelle que soit la valeur envoyée.
CREATE OR REPLACE FUNCTION public.trg_tournament_scores_division()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  SELECT tdm.division_id INTO NEW.division_id
    FROM public.tournament_division_members tdm
    JOIN public.tournament_divisions d ON d.id = tdm.division_id
   WHERE d.tournament_id = NEW.tournament_id
     AND tdm.athlete_id = NEW.athlete_id
   ORDER BY tdm.joined_at DESC, d.level ASC
   LIMIT 1;
  IF NOT FOUND THEN
    NEW.division_id := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.trg_tournament_scores_division() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tournament_scores_division ON public.tournament_scores;
CREATE TRIGGER trg_tournament_scores_division
  BEFORE INSERT ON public.tournament_scores
  FOR EACH ROW EXECUTE FUNCTION public.trg_tournament_scores_division();

-- division_id rejoint les colonnes réservées au staff.
CREATE OR REPLACE FUNCTION public.trg_tournament_scores_colonnes_reservees()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role  text := auth.role();
  v_staff boolean;
BEGIN
  -- `service_role` (la fonction edge `analyze-tournament-score` écrit
  -- `ai_analysis`) et les connexions sans JWT (migration, cron) passent.
  IF v_role IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT public.is_box_admin(t.box_id) INTO v_staff
    FROM public.tournaments t WHERE t.id = NEW.tournament_id;
  IF COALESCE(v_staff, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.tournament_id        IS DISTINCT FROM OLD.tournament_id
     OR NEW.tournament_wod_id IS DISTINCT FROM OLD.tournament_wod_id
     OR NEW.athlete_id        IS DISTINCT FROM OLD.athlete_id
     OR NEW.validated_by      IS DISTINCT FROM OLD.validated_by
     OR NEW.validated_at      IS DISTINCT FROM OLD.validated_at
     OR NEW.admin_message     IS DISTINCT FROM OLD.admin_message
     OR NEW.elo_points        IS DISTINCT FROM OLD.elo_points
     OR NEW.ai_analysis       IS DISTINCT FROM OLD.ai_analysis
     OR NEW.division_id       IS DISTINCT FROM OLD.division_id THEN
    RAISE EXCEPTION 'tournament_scores : colonne réservée au staff du tournoi'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION internal.recalc_division_points(p_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_format text;
BEGIN
  SELECT format INTO v_format FROM public.tournaments WHERE id = p_tournament_id;
  IF v_format IS DISTINCT FROM 'league_div' THEN
    RETURN;
  END IF;

  UPDATE public.tournament_division_members tdm
  SET points = 0
  FROM public.tournament_divisions d
  WHERE d.id = tdm.division_id
    AND d.tournament_id = p_tournament_id;

  -- Chaque score est classé dans la division de l'athlète AU MOMENT du score
  -- (`tournament_scores.division_id`, posé à l'insertion ; à défaut, pour un
  -- score plus ancien que cette règle, l'appartenance actuelle), et seuls les
  -- WOD de la saison en cours comptent. Les points vont à l'athlète, sur sa
  -- ligne d'appartenance actuelle.
  WITH scored AS (
    SELECT
      tdm.id AS member_id,
      ts.tournament_wod_id,
      COALESCE(ts.division_id, tdm.division_id) AS division_id,
      (tw.type = 'For Time') AS is_time,
      NULLIF(substring(ts.score_value from '^(-?[0-9]+(?:\.[0-9]+)?)'), '')::numeric AS raw_num,
      COALESCE(ts.capped, false) AS raw_capped
    FROM public.tournament_scores ts
    JOIN public.tournament_wods tw ON tw.id = ts.tournament_wod_id
    JOIN public.tournaments t ON t.id = p_tournament_id
    JOIN public.tournament_division_members tdm ON tdm.athlete_id = ts.athlete_id
    JOIN public.tournament_divisions d ON d.id = tdm.division_id
    WHERE d.tournament_id = p_tournament_id
      AND ts.tournament_id = p_tournament_id
      AND ts.status = 'validated'
      AND tw.season_number = t.current_season
  ),
  normalized AS (
    -- Normalisation de l'encodage hérité DNF_BASE (999999 + reps).
    SELECT s.member_id, s.tournament_wod_id, s.division_id, s.is_time,
           CASE WHEN s.is_time AND s.raw_num >= 999999 THEN s.raw_num - 999999 ELSE s.raw_num END AS num,
           (s.is_time AND (s.raw_capped OR s.raw_num >= 999999)) AS capped
      FROM scored s
  ),
  ranked AS (
    SELECT
      n.member_id,
      ROW_NUMBER() OVER (
        PARTITION BY n.tournament_wod_id, n.division_id
        ORDER BY
          (CASE WHEN n.capped THEN 1 ELSE 0 END) ASC,
          CASE WHEN n.is_time AND NOT n.capped
               THEN COALESCE(n.num,  'Infinity'::numeric) END ASC  NULLS LAST,
          CASE WHEN n.is_time AND     n.capped
               THEN COALESCE(n.num, '-Infinity'::numeric) END DESC NULLS LAST,
          CASE WHEN NOT n.is_time
               THEN COALESCE(n.num, '-Infinity'::numeric) END DESC NULLS LAST
      ) AS rk
    FROM normalized n
  ),
  totals AS (
    SELECT member_id, SUM(GREATEST(1, 100 - (rk::int - 1) * 3)) AS pts
    FROM ranked
    GROUP BY member_id
  )
  UPDATE public.tournament_division_members tdm
  SET points = totals.pts
  FROM totals
  WHERE tdm.id = totals.member_id;
END;
$function$;

COMMIT;
