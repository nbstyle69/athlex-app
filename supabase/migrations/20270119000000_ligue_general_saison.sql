-- ═════════════════════════════════════════════════════════════════════════════
-- Ligue : classement général d'une saison, calculé par la base
--
-- Appliquée en prod : NON
--
-- Décision de Nab (24/09/2026) : dans une ligue, l'onglet « Général » de l'app
-- se limite à la saison en cours, comme les points de division ; un onglet
-- « Saisons précédentes » montre le classement général final d'une saison
-- terminée.
--
-- `tournament_classique_standings` additionne tous les WOD du tournoi, toutes
-- saisons confondues : il ne convient pas à une ligue.
--
--   * `public.tournament_ligue_standings(tournoi, saison)` : pour chaque inscrit,
--     la somme des points de WOD (`tournament_classique_wod_ranks` : barème
--     `tournament_cf_points`, tie-break puis rang partagé, scores validés et
--     lisibles seulement) sur les WOD de CETTE saison ; rang final partagé à
--     égalité de points. Saison omise : la saison en cours du tournoi.
--   * Une saison terminée se recalcule à partir de ses scores, qui restent en
--     base : son classement général final est donc celui-ci, avec la saison
--     passée en paramètre.
--
-- Données en prod : aucun tournoi `league_div` ; aucune donnée touchée.
--
-- Contrôlée par `supabase/tests/ligue_general_saison.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.tournament_ligue_standings(p_tournament_id uuid, p_season integer DEFAULT NULL::integer)
 RETURNS TABLE(athlete_id uuid, points integer, final_rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH saison AS (
    SELECT COALESCE(p_season, t.current_season, 1) AS n
      FROM public.tournaments t WHERE t.id = p_tournament_id
  ),
  totals AS (
    SELECT tp.athlete_id, COALESCE(SUM(w.points), 0)::int AS points
      FROM public.tournament_participants tp
      LEFT JOIN (
        SELECT r.athlete_id, r.points
          FROM public.tournament_classique_wod_ranks(p_tournament_id) r
          JOIN public.tournament_wods tw ON tw.id = r.tournament_wod_id
         WHERE COALESCE(tw.season_number, 1) = (SELECT n FROM saison)
      ) w ON w.athlete_id = tp.athlete_id
     WHERE tp.tournament_id = p_tournament_id
     GROUP BY tp.athlete_id
  )
  SELECT t.athlete_id, t.points,
         RANK() OVER (ORDER BY t.points DESC)::int AS final_rank
    FROM totals t;
$function$;
REVOKE ALL ON FUNCTION public.tournament_ligue_standings(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tournament_ligue_standings(uuid, integer) TO authenticated, service_role;

COMMIT;
