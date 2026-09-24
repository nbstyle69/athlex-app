-- ═════════════════════════════════════════════════════════════════════════════
-- Points de division : même règle d'égalité que le barème classique
--
-- Appliquée en prod : NON
--
-- Décision de Nab (24/09/2026) : les points de division suivent la même règle
-- d'égalité que le barème de la compétition classique (migration 20270116) :
-- sur un WOD, le tie-break départage d'abord ; s'il reste une égalité, rang
-- partagé et mêmes points, le rang suivant sauté.
--
-- `internal.recalc_division_points` classait chaque WOD, dans chaque division,
-- par ROW_NUMBER sans tie-break : deux scores égaux recevaient des points
-- différents, dans un ordre arbitraire.
--
--   * l'ordre est celui de `tournament_score_cle` (#354) : terminés avant CAP,
--     temps croissant, CAP aux reps décroissantes, autres formats au score
--     décroissant, puis tie-break (un tie-break donné passe devant un absent) ;
--   * RANK : à clés égales, même rang et mêmes points, le rang suivant sauté ;
--   * la lecture du score passe par `parse_score_val` (comme partout ailleurs :
--     « 8:00 » vaut 480 s, et non 8) ; un score illisible est ignoré ;
--   * le barème des divisions est inchangé : 100, 97, 94… (100 − 3 × (rang − 1),
--     au moins 1). Seule la règle d'égalité change.
-- Le reste est inchangé : division figée au moment du score, saison en cours.
--
-- Données en prod : aucun tournoi `league_div`, aucun point recalculé.
--
-- Contrôlée par `supabase/tests/points_division_egalite.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

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
  -- Ordre de `tournament_score_cle` (#354, comme le barème classique) : le
  -- tie-break départage d'abord ; à clés égales, rang partagé et mêmes points,
  -- le rang suivant sauté (RANK). Un score illisible est ignoré (migration 20270117).
  WITH scored AS (
    SELECT
      tdm.id AS member_id,
      ts.tournament_wod_id,
      COALESCE(ts.division_id, tdm.division_id) AS division_id,
      public.tournament_score_cle(tw.type = 'For Time', ts.score_value, ts.capped, ts.tiebreak_value) AS cle
    FROM public.tournament_scores ts
    JOIN public.tournament_wods tw ON tw.id = ts.tournament_wod_id
    JOIN public.tournaments t ON t.id = p_tournament_id
    JOIN public.tournament_division_members tdm ON tdm.athlete_id = ts.athlete_id
    JOIN public.tournament_divisions d ON d.id = tdm.division_id
    WHERE d.tournament_id = p_tournament_id
      AND ts.tournament_id = p_tournament_id
      AND ts.status = 'validated'
      AND tw.season_number = t.current_season
      AND public.parse_score_val(ts.score_value) IS NOT NULL
  ),
  ranked AS (
    SELECT
      s.member_id,
      RANK() OVER (PARTITION BY s.tournament_wod_id, s.division_id ORDER BY s.cle) AS rk
    FROM scored s
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
