-- ═════════════════════════════════════════════════════════════════════════════
-- Compétition classique : le barème de l'app, calculé par la base seule
--
-- Appliquée en prod : OUI, le 24/09/2026 à 18:40:38 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public et internal
-- avec droits db-dumps/2026-09-24/athlex-prod-public-internal-20260924T184022Z.dump, sha256 858bfb9ab1eab26de6eba02ea4206d6dd5dbcce299236bb073adf7ede5dd987e vérifié
-- après aller-retour ; précontrôles : objets du chantier identiques à ceux de master rejoué,
-- aucun tournoi swiss ni league_div ; vérifications : md5 identiques avant et après des
-- tables du chantier, des profils, des policies, des droits des tables et des autres
-- fonctions, objets identiques à la référence droits compris, aucun double encodage ;
-- audit grants-prod.yml relancé à 18:42 UTC : 29/29).
--
-- Décision de Nab (24/09/2026) : la référence est le barème de l'app
-- (`src/utils/tournamentUtils.ts`, table CF Games 100, 97, 95, 93, 91…). Sur un
-- WOD, le tie-break départage d'abord quand il existe ; s'il reste une égalité,
-- rang partagé et mêmes points, le rang suivant est sauté. La base devient la
-- seule source du calcul.
--
-- Jusqu'ici, trois versions coexistaient : l'app (table CF Games, rang partagé),
-- le Manager et `tournament_classique_standings` (barème linéaire 100, 97, 94…,
-- égalités départagées par `athlete_id`). La clôture ELO du format `simple`
-- lit `tournament_classique_standings`.
--
--   * `public.tournament_cf_points(rang)` : la table CF Games de l'app, à
--     l'identique (50 rangs, puis 30, 29, … jusqu'à 1) ;
--   * `public.tournament_classique_wod_ranks(tournoi)` : rang et points de
--     chaque athlète sur chaque WOD. Seuls les scores VALIDÉS comptent ; un
--     score illisible est ignoré (il ne prend aucun rang). L'ordre est celui de
--     `tournament_score_cle` (#354) : terminés avant CAP, temps croissant, CAP
--     aux reps décroissantes, autres formats au score décroissant, puis
--     tie-break croissant — un tie-break absent passe après un tie-break donné.
--     Deux clés égales : même rang (RANK), le suivant est sauté ;
--   * `public.tournament_classique_standings(tournoi)` : même signature, somme
--     de ces points ; rang final partagé en cas d'égalité de points. La clôture
--     ELO (`finalize_tournament_elo`, format `simple`) s'appuie dessus sans
--     changement.
--
-- Données en prod : aucune donnée touchée. Aucune clôture n'est rejouée.
--
-- Contrôlée par `supabase/tests/bareme_classique.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.tournament_cf_points(p_rank integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
           WHEN p_rank IS NULL OR p_rank <= 0 THEN 0
           WHEN p_rank <= 50 THEN (ARRAY[
             100, 97, 95, 93, 91, 89, 87, 85, 83, 81,
              79, 77, 75, 73, 71, 69, 67, 65, 63, 61,
              60, 59, 58, 57, 56, 55, 54, 53, 52, 51,
              50, 49, 48, 47, 46, 45, 44, 43, 42, 41,
              40, 39, 38, 37, 36, 35, 34, 33, 32, 31])[p_rank]
           ELSE GREATEST(1, 30 - (p_rank - 51))
         END
$function$;
REVOKE ALL ON FUNCTION public.tournament_cf_points(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tournament_cf_points(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tournament_classique_wod_ranks(p_tournament_id uuid)
 RETURNS TABLE(athlete_id uuid, tournament_wod_id uuid, wod_rank integer, points integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH cles AS (
    SELECT ts.athlete_id, ts.tournament_wod_id,
           public.tournament_score_cle(tw.type = 'For Time', ts.score_value, ts.capped, ts.tiebreak_value) AS cle
      FROM public.tournament_scores ts
      JOIN public.tournament_wods tw ON tw.id = ts.tournament_wod_id
     WHERE ts.tournament_id = p_tournament_id
       AND ts.status = 'validated'
       AND public.parse_score_val(ts.score_value) IS NOT NULL
  ),
  rangs AS (
    SELECT c.athlete_id, c.tournament_wod_id,
           RANK() OVER (PARTITION BY c.tournament_wod_id ORDER BY c.cle)::int AS wod_rank
      FROM cles c
  )
  SELECT r.athlete_id, r.tournament_wod_id, r.wod_rank, public.tournament_cf_points(r.wod_rank)
    FROM rangs r;
$function$;
REVOKE ALL ON FUNCTION public.tournament_classique_wod_ranks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tournament_classique_wod_ranks(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tournament_classique_standings(p_tournament_id uuid)
 RETURNS TABLE(athlete_id uuid, points integer, final_rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH totals AS (
    SELECT tp.athlete_id, COALESCE(SUM(w.points), 0)::int AS points
      FROM public.tournament_participants tp
      LEFT JOIN public.tournament_classique_wod_ranks(p_tournament_id) w ON w.athlete_id = tp.athlete_id
     WHERE tp.tournament_id = p_tournament_id
     GROUP BY tp.athlete_id
  )
  SELECT t.athlete_id, t.points,
         RANK() OVER (ORDER BY t.points DESC)::int AS final_rank
    FROM totals t;
$function$;

COMMIT;
