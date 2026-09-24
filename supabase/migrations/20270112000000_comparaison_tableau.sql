-- ═════════════════════════════════════════════════════════════════════════════
-- Comparaison en tableau : la règle appliquée par le serveur — tournois, PR 7
--
-- Appliquée en prod : NON
--
-- Règle produit : « un For Time terminé bat toujours un For Time au CAP ; entre
-- deux athlètes au CAP, le plus de reps gagne ; en cas d'égalité, le tie-break
-- décide. »
--
-- Le Manager décidait les matchs de tableau dans le navigateur
-- (`winnerFromScores`), en ignorant `capped` et `tiebreak_value` : « le plus
-- bas gagne » pour tout For Time, si bien qu'un athlète au CAP (150 reps) battait
-- un finisher en 9:30 (570 s). Une égalité parfaite de score était laissée à la
-- main, même avec un tie-break.
--
--   * `public.tournament_score_cle(for_time, score, cap, tie-break)` : la clé de
--     classement d'un score, la plus PETITE gagne. C'est l'ordre déjà appliqué
--     par `tournament_classique_standings` (compétition classique) : terminés
--     avant CAP ; terminés au temps croissant ; CAP aux reps décroissantes ;
--     autres formats au score décroissant ; puis tie-break croissant. L'encodage
--     hérité « 999999 + reps » vaut CAP.
--   * `public.decide_bracket_round(tournoi, tour, wod)` : décide les matchs en
--     attente d'un tour (tous tableaux), sur les scores VALIDÉS du WOD du match
--     (`wod_id` du match, sinon celui passé par le Manager). Un match reste à la
--     main quand un score manque ou que les deux clés sont égales ; le motif est
--     rendu. Réservée au gérant, comme `advance_bracket_round`.
--
-- Données en prod : aucune donnée touchée ; la RPC n'agit qu'à l'appel.
--
-- Contrôlée par `supabase/tests/comparaison_tableau.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.tournament_score_cle(
  p_for_time boolean, p_score text, p_capped boolean, p_tiebreak numeric)
 RETURNS numeric[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH s AS (SELECT public.parse_score_val(p_score) AS brut),
  n AS (
    SELECT CASE WHEN p_for_time AND brut >= 999999 THEN brut - 999999 ELSE brut END AS num,
           (p_for_time AND (COALESCE(p_capped, false) OR brut >= 999999)) AS cap
      FROM s
  )
  SELECT ARRAY[
           CASE WHEN cap THEN 1 ELSE 0 END,
           CASE WHEN p_for_time AND NOT cap THEN COALESCE(num, 'Infinity'::numeric)
                ELSE -COALESCE(num, '-Infinity'::numeric) END,
           COALESCE(p_tiebreak, 'Infinity'::numeric)
         ]
    FROM n
$function$;
REVOKE ALL ON FUNCTION public.tournament_score_cle(boolean, text, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tournament_score_cle(boolean, text, boolean, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decide_bracket_round(
  p_tournament_id uuid, p_round integer, p_wod_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(match_id uuid, winner_id uuid, motif text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_m     record;
  v_wod   record;
  v_c1    numeric[];
  v_c2    numeric[];
  v_win   uuid;
BEGIN
  IF NOT public.is_tournament_manager(p_tournament_id) THEN
    RAISE EXCEPTION 'Not authorized: only the box owner/coach or an admin can manage this tournament'
      USING ERRCODE = '42501';
  END IF;

  FOR v_m IN
    SELECT m.id, m.participant1_id AS p1, m.participant2_id AS p2, COALESCE(m.wod_id, p_wod_id) AS wod
      FROM public.tournament_bracket_matches m
     WHERE m.tournament_id = p_tournament_id AND m.round = p_round
       AND m.status IN ('pending', 'active') AND m.winner_id IS NULL
       AND m.participant1_id IS NOT NULL AND m.participant2_id IS NOT NULL
     ORDER BY m.side, m.match_number
     FOR UPDATE
  LOOP
    match_id := v_m.id; winner_id := NULL; motif := NULL;

    SELECT w.id, (w.type = 'For Time') AS for_time INTO v_wod
      FROM public.tournament_wods w
     WHERE w.id = v_m.wod AND w.tournament_id = p_tournament_id;
    IF v_wod.id IS NULL THEN
      motif := 'wod_absent'; RETURN NEXT; CONTINUE;
    END IF;

    SELECT public.tournament_score_cle(v_wod.for_time, s.score_value, s.capped, s.tiebreak_value) INTO v_c1
      FROM public.tournament_scores s
     WHERE s.tournament_wod_id = v_wod.id AND s.athlete_id = v_m.p1 AND s.status = 'validated';
    SELECT public.tournament_score_cle(v_wod.for_time, s.score_value, s.capped, s.tiebreak_value) INTO v_c2
      FROM public.tournament_scores s
     WHERE s.tournament_wod_id = v_wod.id AND s.athlete_id = v_m.p2 AND s.status = 'validated';
    IF v_c1 IS NULL OR v_c2 IS NULL THEN
      motif := 'score_manquant'; RETURN NEXT; CONTINUE;
    END IF;
    IF v_c1 = v_c2 THEN
      motif := 'egalite'; RETURN NEXT; CONTINUE;
    END IF;

    v_win := CASE WHEN v_c1 < v_c2 THEN v_m.p1 ELSE v_m.p2 END;
    UPDATE public.tournament_bracket_matches
       SET winner_id = v_win,
           loser_id  = CASE WHEN v_win = v_m.p1 THEN v_m.p2 ELSE v_m.p1 END,
           status = 'completed', completed_at = now()
     WHERE id = v_m.id;
    winner_id := v_win;
    RETURN NEXT;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.decide_bracket_round(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_bracket_round(uuid, integer, uuid) TO authenticated, service_role;

COMMIT;
