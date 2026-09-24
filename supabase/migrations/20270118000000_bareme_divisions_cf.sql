-- ═════════════════════════════════════════════════════════════════════════════
-- Barème des divisions : la table de la compétition classique
--
-- Appliquée en prod : OUI, le 24/09/2026 à 20:20:50 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public et internal
-- avec droits db-dumps/2026-09-24/athlex-prod-public-internal-20260924T202035Z.dump, sha256 b8964ec2f927870fa8e4680e836c67dce929c4cb5e2a03d8dadaefd4e09f2c9d vérifié
-- après aller-retour ; précontrôles : objets du chantier identiques à ceux de master rejoué,
-- aucun tournoi swiss ni league_div ; vérifications : md5 identiques avant et après des
-- tables du chantier, des profils, des policies, des droits des tables et des autres
-- fonctions, objets identiques à la référence droits compris, aucun double encodage ;
-- audit grants-prod.yml relancé à 20:22 UTC : 29/29).
--
-- Décision de Nab (24/09/2026) : les points de division suivent le même barème
-- que la compétition classique, `tournament_cf_points` (table CF Games : 100,
-- 97, 95, 93, 91…), à la place du barème linéaire 100, 97, 94… (100 − 3 × (rang − 1)).
--
-- `internal.recalc_division_points` : seule la conversion rang → points change.
-- La règle d'égalité (migration 20270117) est inchangée : ordre de
-- `tournament_score_cle`, tie-break d'abord, puis rang partagé et mêmes points
-- (RANK), rang suivant sauté ; score illisible ignoré ; division figée au moment
-- du score ; saison en cours seulement.
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
    -- Barème de la compétition classique (table CF Games), migration 20270118.
    SELECT member_id, SUM(public.tournament_cf_points(rk::int)) AS pts
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
