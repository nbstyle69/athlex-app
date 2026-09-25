-- ═════════════════════════════════════════════════════════════════════════════
-- Tournois : un résultat validé ne disparaît jamais ; archivage (migration 20270124)
--
-- Remplace le test de la migration 20270109 (« supprimer un tournoi retire son
-- ELO »), dont la règle est renversée.
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B : gérant O, coach K, simple membre M. Athlètes A à H, à 1000 ELO.
--   S1 suppression refusée pour chaque type de résultat validé, chacun seul
--      dans son tournoi (K1 à K8) : clôturé, match terminé, forfait, score
--      validé, saison close, historique de match, ELO de WOD de ligue,
--      historique de clôture ; message qui invite à archiver ; ni ELO ni
--      historique touchés ;
--   S2 suppression acceptée pour un tournoi sans résultat (K9 : match en
--      attente, exemption, score en attente et rejeté, WOD, division), par le
--      gérant ;
--   S3 match terminé ou forfait : suppression refusée ; en attente, en cours,
--      exemption : acceptée (K10) ;
--   S4 archivage (gérant) puis désarchivage (coach) : seule `archived_at`
--      change ; ni ELO, ni historiques, ni matchs ; la clé serveur le peut aussi ;
--   S5 archivage et désarchivage refusés au simple membre et à anon ;
--   S6 correction du vainqueur d'un match terminé : l'ELO est recalculé (#348) ;
--   S7 forfait posé sur un match terminé : l'ELO est recalculé (#355) ;
--   S8 plus aucun déclencheur ne retire l'ELO à la suppression.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Tournois : résultats validés conservés, archivage'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a900-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0', 'e1', 'e2', '0a', '0b', '0c', '0d', '0e', '0f', '10', '11']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a900-0000000000' || s)::uuid, 'sup-' || s || '@test.invalid', 'sup_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', '0a', '0b', '0c', '0d', '0e', '0f', '10', '11']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b900-000000000001', 'Box résultats', 'SUPT', '00000000-0000-4000-a900-0000000000e0');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-0000000000e0', 'owner',  'active'),
  ('00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-0000000000e1', 'coach',  'active'),
  ('00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-0000000000e2', 'member', 'active');

-- K1 à K11 (…c9000000000001 à …11).
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status)
SELECT ('00000000-0000-4000-c900-0000000000' || k)::uuid, 'K' || k, 'rx', f,
       '00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-0000000000e0', st
  FROM (VALUES ('01', 'simple', 'completed'), ('02', 'bracket', 'active'), ('03', 'bracket', 'active'),
               ('04', 'simple', 'active'), ('05', 'league_div', 'active'), ('06', 'bracket', 'active'),
               ('07', 'league_div', 'active'), ('08', 'bracket', 'active'), ('09', 'bracket', 'open'),
               ('10', 'bracket', 'active'), ('11', 'bracket', 'active')) v(k, f, st);

-- K2 : A bat B (ELO appliqué par le déclencheur de match).
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, winner_id, loser_id, status) VALUES
  ('00000000-0000-4000-c900-000000000002', 1, 1, 'winner', '00000000-0000-4000-a900-00000000000a', '00000000-0000-4000-a900-00000000000b',
   '00000000-0000-4000-a900-00000000000a', '00000000-0000-4000-a900-00000000000b', 'completed');
-- K3 : un forfait, sans ELO.
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, winner_id, loser_id, status) VALUES
  ('00000000-0000-4000-c900-000000000003', 1, 1, 'winner', '00000000-0000-4000-a900-00000000000c', '00000000-0000-4000-a900-00000000000d',
   '00000000-0000-4000-a900-00000000000c', '00000000-0000-4000-a900-00000000000d', 'forfeit');
-- K4 : un score validé, rien d'autre.
INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
  ('00000000-0000-4000-f900-000000000004', '00000000-0000-4000-c900-000000000004', 'WOD K4', 'For Time');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c900-000000000004', '00000000-0000-4000-f900-000000000004', '00000000-0000-4000-a900-00000000000c', '300', 'validated');
-- K5 : une saison close.
INSERT INTO public.tournament_season_history (tournament_id, season_number, division_level, division_name, athlete_id, final_rank, outcome) VALUES
  ('00000000-0000-4000-c900-000000000005', 1, 1, 'Élite', '00000000-0000-4000-a900-00000000000c', 1, 'champion');
-- K6, K7, K8 : une ligne d'historique ELO seule (le résultat qui l'a produite a changé depuis).
INSERT INTO public.tournament_match_elo_history (tournament_id, athlete_id, result, elo_before, elo_after, elo_delta) VALUES
  ('00000000-0000-4000-c900-000000000006', '00000000-0000-4000-a900-00000000000c', 'win', 1000, 1000, 0);
INSERT INTO public.tournament_wod_elo_history (tournament_id, athlete_id, elo_before, elo_after, elo_delta, rank) VALUES
  ('00000000-0000-4000-c900-000000000007', '00000000-0000-4000-a900-00000000000c', 1000, 1000, 0, 1);
INSERT INTO public.tournament_elo_history (tournament_id, athlete_id, final_rank, participants_count, avg_opponent_elo, elo_before, elo_after, elo_change) VALUES
  ('00000000-0000-4000-c900-000000000008', '00000000-0000-4000-a900-00000000000c', 1, 2, 1000, 1000, 1000, 0);

-- K9 : aucun résultat — un match en attente, une exemption, des scores en
-- attente et rejeté, un WOD, une division, des participants.
INSERT INTO public.tournament_participants (tournament_id, athlete_id) VALUES
  ('00000000-0000-4000-c900-000000000009', '00000000-0000-4000-a900-00000000000c'),
  ('00000000-0000-4000-c900-000000000009', '00000000-0000-4000-a900-00000000000d');
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, status) VALUES
  ('00000000-0000-4000-c900-000000000009', 1, 1, 'winner', '00000000-0000-4000-a900-00000000000c', '00000000-0000-4000-a900-00000000000d', 'pending');
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, winner_id, status) VALUES
  ('00000000-0000-4000-c900-000000000009', 1, 2, 'winner', '00000000-0000-4000-a900-00000000000a', '00000000-0000-4000-a900-00000000000a', 'bye');
INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
  ('00000000-0000-4000-f900-000000000009', '00000000-0000-4000-c900-000000000009', 'WOD K9', 'AMRAP');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c900-000000000009', '00000000-0000-4000-f900-000000000009', '00000000-0000-4000-a900-00000000000c', '100', 'pending'),
  ('00000000-0000-4000-c900-000000000009', '00000000-0000-4000-f900-000000000009', '00000000-0000-4000-a900-00000000000d', '90', 'rejected');
INSERT INTO public.tournament_divisions (tournament_id, name, level) VALUES
  ('00000000-0000-4000-c900-000000000009', 'Élite', 1);

-- K10 : un match de chaque statut. K11 : deux matchs terminés, pour S6 et S7.
INSERT INTO public.tournament_bracket_matches (id, tournament_id, round, match_number, side, participant1_id, participant2_id, winner_id, loser_id, status)
SELECT ('00000000-0000-4000-d900-0000000000' || id)::uuid, ('00000000-0000-4000-c900-0000000000' || k)::uuid, 1, n, 'winner',
       ('00000000-0000-4000-a900-0000000000' || p1)::uuid, ('00000000-0000-4000-a900-0000000000' || p2)::uuid,
       ('00000000-0000-4000-a900-0000000000' || w)::uuid, ('00000000-0000-4000-a900-0000000000' || l)::uuid, st
  FROM (VALUES ('01', '10', 1, '0c', '0d', '0c', '0d', 'completed'),
               ('02', '10', 2, '0c', '0d', '0c', '0d', 'forfeit'),
               ('03', '10', 3, '0c', '0d', NULL, NULL, 'pending'),
               ('04', '10', 4, '0c', '0d', NULL, NULL, 'active'),
               ('06', '11', 1, '0e', '0f', '0e', '0f', 'completed'),
               ('07', '11', 2, '10', '11', '10', '11', 'completed')) v(id, k, n, p1, p2, w, l, st);
INSERT INTO public.tournament_bracket_matches (id, tournament_id, round, match_number, side, participant1_id, winner_id, status) VALUES
  ('00000000-0000-4000-d900-000000000005', '00000000-0000-4000-c900-000000000010', 1, 5, 'winner',
   '00000000-0000-4000-a900-00000000000c', '00000000-0000-4000-a900-00000000000c', 'bye');

CREATE FUNCTION pg_temp.en_tant_que(p_qui text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_qui IS NULL THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    PERFORM set_config('role', 'anon', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a900-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
END $$;

-- Empreinte de tout ce que la règle protège : profils, historiques, matchs.
CREATE FUNCTION pg_temp.empreinte() RETURNS text LANGUAGE sql AS $$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(id || ':' || elo || '/' || total_matches || '/' || wins, ',' ORDER BY id) FROM public.profiles WHERE id::text LIKE '%-a900-%'),
    (SELECT string_agg(h::text, ',' ORDER BY h.id) FROM public.tournament_match_elo_history h),
    (SELECT string_agg(h::text, ',' ORDER BY h.id) FROM public.tournament_wod_elo_history h),
    (SELECT string_agg(h::text, ',' ORDER BY h.id) FROM public.tournament_elo_history h),
    (SELECT string_agg(h::text, ',' ORDER BY h.id) FROM public.tournament_season_history h),
    (SELECT string_agg(m::text, ',' ORDER BY m.id) FROM public.tournament_bracket_matches m)))
$$;

DO $t$
DECLARE
  v_k text;
  v_err text;
  v_state text;
  v_avant text;
  v_ligne text;
  v_ts timestamptz;
  v_n int;
  K2 constant uuid := '00000000-0000-4000-c900-000000000002';
BEGIN
  -- Contre-exemple : le match de K2 a bien appliqué un ELO.
  IF (SELECT elo FROM public.profiles WHERE id = '00000000-0000-4000-a900-00000000000a') <= 1000 THEN
    RAISE EXCEPTION 'contre-exemple : le match de K2 n''a pas appliqué d''ELO';
  END IF;

  -- S1 : chaque type de résultat validé bloque la suppression.
  v_avant := pg_temp.empreinte();
  FOREACH v_k IN ARRAY ARRAY['01', '02', '03', '04', '05', '06', '07', '08'] LOOP
    v_err := NULL; v_state := NULL;
    BEGIN
      DELETE FROM public.tournaments WHERE id = ('00000000-0000-4000-c900-0000000000' || v_k)::uuid;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; v_state := SQLSTATE;
    END;
    IF v_err IS NULL OR v_state <> '23001' OR v_err NOT LIKE 'TOURNOI_AVEC_RESULTATS%' OR v_err NOT LIKE '%Archive-le%' THEN
      RAISE EXCEPTION 'S1 : la suppression de K% n''est pas refusée comme attendu (% %)', v_k, v_state, coalesce(v_err, 'aucune erreur');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = ('00000000-0000-4000-c900-0000000000' || v_k)::uuid) THEN
      RAISE EXCEPTION 'S1 : K% a disparu', v_k;
    END IF;
  END LOOP;
  IF pg_temp.empreinte() <> v_avant THEN RAISE EXCEPTION 'S1 : un refus a touché l''ELO, un historique ou un match'; END IF;

  -- S2 : un tournoi sans résultat se supprime, par le gérant, sans rien toucher d'autre.
  v_err := NULL;
  PERFORM pg_temp.en_tant_que('e0');
  BEGIN
    DELETE FROM public.tournaments WHERE id = '00000000-0000-4000-c900-000000000009';
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  IF v_err IS NOT NULL THEN RAISE EXCEPTION 'S2 : un tournoi sans résultat n''est pas supprimé : %', v_err; END IF;
  IF EXISTS (SELECT 1 FROM public.tournaments WHERE id = '00000000-0000-4000-c900-000000000009') THEN
    RAISE EXCEPTION 'S2 : le tournoi sans résultat est toujours là';
  END IF;

  -- S3 : matchs de K10.
  FOREACH v_k IN ARRAY ARRAY['01', '02'] LOOP
    v_err := NULL;
    BEGIN
      DELETE FROM public.tournament_bracket_matches WHERE id = ('00000000-0000-4000-d900-0000000000' || v_k)::uuid;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    IF v_err IS NULL OR v_err NOT LIKE 'MATCH_TERMINE%' THEN
      RAISE EXCEPTION 'S3 : la suppression du match terminé % n''est pas refusée (%)', v_k, coalesce(v_err, 'aucune erreur');
    END IF;
  END LOOP;
  FOREACH v_k IN ARRAY ARRAY['03', '04', '05'] LOOP
    v_err := NULL;
    BEGIN
      DELETE FROM public.tournament_bracket_matches WHERE id = ('00000000-0000-4000-d900-0000000000' || v_k)::uuid;
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    IF v_err IS NOT NULL OR EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE id = ('00000000-0000-4000-d900-0000000000' || v_k)::uuid) THEN
      RAISE EXCEPTION 'S3 : le match non terminé % n''est pas supprimé (%)', v_k, coalesce(v_err, 'toujours présent');
    END IF;
  END LOOP;

  -- S4 : archiver (gérant), puis désarchiver (coach) : seule archived_at change.
  v_avant := pg_temp.empreinte();
  SELECT (to_jsonb(t) - 'archived_at')::text INTO v_ligne FROM public.tournaments t WHERE id = K2;
  PERFORM pg_temp.en_tant_que('e0');
  v_ts := public.archive_tournament(K2);
  PERFORM set_config('role', 'none', true);
  IF v_ts IS NULL OR (SELECT archived_at FROM public.tournaments WHERE id = K2) IS DISTINCT FROM v_ts THEN
    RAISE EXCEPTION 'S4 : l''archivage n''a pas posé archived_at';
  END IF;
  IF (SELECT (to_jsonb(t) - 'archived_at')::text FROM public.tournaments t WHERE id = K2) <> v_ligne
     OR pg_temp.empreinte() <> v_avant THEN
    RAISE EXCEPTION 'S4 : l''archivage a changé autre chose qu''archived_at';
  END IF;
  PERFORM pg_temp.en_tant_que('e1');
  PERFORM public.unarchive_tournament(K2);
  PERFORM set_config('role', 'none', true);
  IF (SELECT archived_at FROM public.tournaments WHERE id = K2) IS NOT NULL
     OR (SELECT (to_jsonb(t) - 'archived_at')::text FROM public.tournaments t WHERE id = K2) <> v_ligne
     OR pg_temp.empreinte() <> v_avant THEN
    RAISE EXCEPTION 'S4 : le désarchivage n''a pas rendu l''état d''avant';
  END IF;
  -- La clé serveur archive et désarchive, comme elle supprime.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('role', 'service_role', true);
  v_ts := public.archive_tournament(K2);
  PERFORM public.unarchive_tournament(K2);
  PERFORM set_config('role', 'none', true);
  IF v_ts IS NULL OR (SELECT archived_at FROM public.tournaments WHERE id = K2) IS NOT NULL THEN
    RAISE EXCEPTION 'S4 : la clé serveur n''archive ou ne désarchive pas';
  END IF;

  -- S5 : simple membre et anon refusés.
  FOREACH v_k IN ARRAY ARRAY['archive membre', 'desarchive membre', 'archive anon', 'desarchive anon'] LOOP
    v_state := NULL;
    PERFORM pg_temp.en_tant_que(CASE WHEN v_k LIKE '%membre' THEN 'e2' END);
    BEGIN
      IF v_k LIKE 'archive%' THEN PERFORM public.archive_tournament(K2);
      ELSE PERFORM public.unarchive_tournament(K2); END IF;
    EXCEPTION WHEN OTHERS THEN v_state := SQLSTATE;
    END;
    PERFORM set_config('role', 'none', true);
    IF v_state IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'S5 : % n''est pas refusé (obtenu : %)', v_k, coalesce(v_state, 'aucune erreur');
    END IF;
  END LOOP;
  IF (SELECT archived_at FROM public.tournaments WHERE id = K2) IS NOT NULL THEN
    RAISE EXCEPTION 'S5 : un refus a quand même archivé';
  END IF;
  IF has_function_privilege('anon', 'public.archive_tournament(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.unarchive_tournament(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'S5 : anon a EXECUTE sur l''archivage';
  END IF;

  -- S6 : E battait F ; on corrige : F gagne. ELO recalculé, un seul match compté.
  BEGIN
    UPDATE public.tournament_bracket_matches
       SET winner_id = '00000000-0000-4000-a900-00000000000f', loser_id = '00000000-0000-4000-a900-00000000000e'
     WHERE id = '00000000-0000-4000-d900-000000000006';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'S6 : la correction du vainqueur d''un match terminé est refusée : %', SQLERRM;
  END;
  SELECT count(*) INTO v_n FROM public.profiles
   WHERE (id = '00000000-0000-4000-a900-00000000000e' AND elo < 1000 AND total_matches = 1 AND wins = 0)
      OR (id = '00000000-0000-4000-a900-00000000000f' AND elo > 1000 AND total_matches = 1 AND wins = 1);
  IF v_n <> 2 OR NOT EXISTS (SELECT 1 FROM public.tournament_match_elo_history
                              WHERE match_id = '00000000-0000-4000-d900-000000000006'
                                AND athlete_id = '00000000-0000-4000-a900-00000000000f' AND result = 'win') THEN
    RAISE EXCEPTION 'S6 : la correction du vainqueur ne recalcule pas l''ELO';
  END IF;

  -- S7 : forfait posé sur un match terminé (G battait H) : l'ELO du match est retiré.
  BEGIN
    UPDATE public.tournament_bracket_matches SET status = 'forfeit'
     WHERE id = '00000000-0000-4000-d900-000000000007';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'S7 : le forfait posé sur un match terminé est refusé : %', SQLERRM;
  END;
  SELECT count(*) INTO v_n FROM public.profiles
   WHERE id IN ('00000000-0000-4000-a900-000000000010', '00000000-0000-4000-a900-000000000011')
     AND elo = 1000 AND total_matches = 0 AND wins = 0;
  IF v_n <> 2 OR EXISTS (SELECT 1 FROM public.tournament_match_elo_history WHERE match_id = '00000000-0000-4000-d900-000000000007') THEN
    RAISE EXCEPTION 'S7 : le forfait posé sur un match terminé ne recalcule pas l''ELO';
  END IF;

  -- S8 : plus aucun déclencheur ne retire l'ELO à la suppression.
  IF EXISTS (SELECT 1 FROM pg_trigger
              WHERE NOT tgisinternal AND tgrelid IN ('public.tournaments'::regclass, 'public.tournament_bracket_matches'::regclass)
                AND (tgtype & 8) <> 0
                AND tgfoid NOT IN ('internal.refuser_suppression_tournoi_valide()'::regprocedure,
                                   'internal.refuser_suppression_match_termine()'::regprocedure)) THEN
    RAISE EXCEPTION 'S8 : un déclencheur de suppression autre que les refus agit encore sur les tournois ou les matchs';
  END IF;
END $t$;

ROLLBACK;
\echo '    S1 à S8 OK'
