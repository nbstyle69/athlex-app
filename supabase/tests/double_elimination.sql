-- ═════════════════════════════════════════════════════════════════════════════
-- Double élimination complète, grande finale avec reset (migrations 20270110,
-- 20270111)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Tableaux de 3 à 9 athlètes, joués jusqu'au bout par `generate_bracket_round_1`
-- et `advance_bracket_round`, appelées par le gérant. Trois règles de vainqueur :
-- « force » (le plus fort gagne toujours), « p1 » (le premier inscrit du match
-- gagne : surprises en série), « hasard » (et, en grande finale, l'athlète venu
-- du tableau des perdants gagne : le match décisif est dû) ; trois tirages du
-- tour 1 chacune.
-- À chaque tour créé avant la grande finale :
--   E1 aucun athlète à deux défaites ne rejoue ;
--   E2 chaque athlète encore en lice joue exactement une fois (match ou
--      exemption) — seul l'invaincu isolé attend que le tableau des perdants
--      finisse ;
--   E3 côté gagnants : que des invaincus ; côté perdants : qu'une défaite.
-- Grande finale :
--   E4 elle n'arrive qu'avec un invaincu, un athlète à une défaite, tous les
--      autres à deux ;
--   G1 elle est créée par le serveur, seule dans son tour, l'invaincu en premier ;
--   G2 le match décisif suit si, et seulement si, le vainqueur de la finale
--      venait du tableau des perdants : même paire, rien après ;
--   G3 le classement donne champion et deuxième par la DERNIÈRE finale, et plus
--      personne en lice ;
--   G5 tant que le match décisif est dû ou à jouer, personne n'est champion.
-- Et aussi :
--   E5 le tableau se termine en au plus 2N tours ;
--   E6 relancer un tour déjà avancé (le 1er, le dernier) ne crée rien ;
--   G4 une grande finale créée à la main par le Manager est tolérée : aucune
--      seconde, et le match décisif suit la sienne.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Double élimination : aucun athlète omis, grande finale avec reset'

BEGIN;

-- Le gérant (…a95d-…000) et neuf athlètes ; règle « force » : le plus petit uuid gagne.
INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a95d-00000000000' || n)::uuid FROM generate_series(0, 9) n;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a95d-00000000000' || n)::uuid, 'de-' || n || '@test.invalid', 'de_' || n
  FROM generate_series(0, 9) n;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b95d-000000000001', 'Box double élimination', 'DETS', '00000000-0000-4000-a95d-000000000000');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b95d-000000000001', '00000000-0000-4000-a95d-000000000000', 'owner', 'active');

CREATE TEMP TABLE _de (pid uuid, pertes int, joue int, cote text);

-- Personne n'est champion (classement de la double élimination).
CREATE FUNCTION pg_temp.sans_champion(p_tid uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM public.tournament_bracket_standings(p_tid) WHERE still_alive)
      OR NOT EXISTS (SELECT 1 FROM public.tournament_bracket_standings(p_tid) WHERE final_rank = 1)
$$;

DO $t$
DECLARE
  v_owner constant uuid := '00000000-0000-4000-a95d-000000000000';
  v_n int; v_regle text; v_tirage int;
  v_tid uuid; v_r int; v_crees int; v_m record; v_gagnant uuid;
  v_zero int; v_un int; v_deux int;
  v_gf record; v_prec record; v_n_gf int; v_resets int := 0;
  v_bad text; v_runs int := 0;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- G4 : le Manager crée lui-même la grande finale (tour 99), avant l'appel au
  -- serveur. Aucune seconde finale ; le match décisif suit la sienne.
  -- Tableau de 4 déjà joué, écrit tel quel : 1 invaincu, 2 à une défaite.
  INSERT INTO public.tournaments (name, level, format, box_id, created_by, status)
  VALUES ('DE Manager', 'rx', 'swiss', '00000000-0000-4000-b95d-000000000001', v_owner, 'active')
  RETURNING id INTO v_tid;
  INSERT INTO public.tournament_participants (tournament_id, athlete_id)
  SELECT v_tid, ('00000000-0000-4000-a95d-00000000000' || k)::uuid FROM generate_series(1, 4) k;
  INSERT INTO public.tournament_bracket_matches
    (tournament_id, round, match_number, side, participant1_id, participant2_id, winner_id, loser_id, status)
  SELECT v_tid, r, n, sd, ('00000000-0000-4000-a95d-00000000000' || a)::uuid, ('00000000-0000-4000-a95d-00000000000' || b)::uuid,
         ('00000000-0000-4000-a95d-00000000000' || a)::uuid, ('00000000-0000-4000-a95d-00000000000' || b)::uuid, 'completed'
    FROM (VALUES (1, 1, 'winner', 1, 2), (1, 2, 'winner', 3, 4),
                 (2, 1, 'winner', 1, 3), (2, 1, 'loser', 2, 4),
                 (3, 1, 'loser', 2, 3)) v(r, n, sd, a, b);
  -- Le Manager crée la finale (tour 99), puis appelle le serveur sur le tour 3.
  INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
  VALUES (v_tid, 99, 1, 'grand_final', '00000000-0000-4000-a95d-000000000001', '00000000-0000-4000-a95d-000000000002', 'pending');
  v_r := 3;
  PERFORM public.advance_bracket_round(v_tid, v_r);
  IF (SELECT count(*) FROM public.tournament_bracket_matches WHERE tournament_id = v_tid AND side = 'grand_final') <> 1 THEN
    RAISE EXCEPTION 'G4 % : une seconde grande finale a été créée à côté de celle du Manager', v_tid;
  END IF;
  UPDATE public.tournament_bracket_matches
     SET winner_id = participant2_id, loser_id = participant1_id, status = 'completed', completed_at = now()
   WHERE tournament_id = v_tid AND round = 99;
  v_crees := public.advance_bracket_round(v_tid, 99);
  IF v_crees <> 1
     OR NOT EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                     WHERE tournament_id = v_tid AND round = 100 AND side = 'grand_final' AND status = 'pending') THEN
    RAISE EXCEPTION 'G4 % : pas de match décisif après la finale du Manager gagnée par le tableau des perdants', v_tid;
  END IF;

  FOREACH v_regle IN ARRAY ARRAY['force', 'p1', 'hasard'] LOOP
  FOR v_n IN 3..9 LOOP
  FOR v_tirage IN 1..3 LOOP
    PERFORM setseed(v_n / 10.0 + v_tirage / 100.0);
    INSERT INTO public.tournaments (name, level, format, box_id, created_by, status)
    VALUES (format('DE %s×%s #%s', v_regle, v_n, v_tirage), 'rx', 'swiss',
            '00000000-0000-4000-b95d-000000000001', v_owner, 'active')
    RETURNING id INTO v_tid;
    INSERT INTO public.tournament_participants (tournament_id, athlete_id)
    SELECT v_tid, ('00000000-0000-4000-a95d-00000000000' || k)::uuid FROM generate_series(1, v_n) k;
    PERFORM public.generate_bracket_round_1(v_tid);

    v_r := 1;
    LOOP
      -- Le gérant tranche les matchs du tour.
      FOR v_m IN SELECT id, side, participant1_id AS p1, participant2_id AS p2
                   FROM public.tournament_bracket_matches
                  WHERE tournament_id = v_tid AND round = v_r AND status = 'pending'
      LOOP
        v_gagnant := CASE
          WHEN v_regle = 'force' THEN LEAST(v_m.p1, v_m.p2)
          WHEN v_regle = 'p1'    THEN v_m.p1
          WHEN v_m.side = 'grand_final' AND NOT EXISTS (
                 SELECT 1 FROM public.tournament_bracket_matches
                  WHERE tournament_id = v_tid AND side = 'grand_final' AND round < v_r) THEN v_m.p2
          ELSE CASE WHEN random() < 0.5 THEN v_m.p1 ELSE v_m.p2 END END;
        UPDATE public.tournament_bracket_matches
           SET winner_id = v_gagnant,
               loser_id  = CASE WHEN v_gagnant = v_m.p1 THEN v_m.p2 ELSE v_m.p1 END,
               status = 'completed', completed_at = now()
         WHERE id = v_m.id;
      END LOOP;

      -- Une seule finale jouée, gagnée par l'athlète venu des perdants : le
      -- match décisif est dû, personne n'est encore champion.
      IF v_regle = 'hasard' AND EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                                         WHERE tournament_id = v_tid AND side = 'grand_final' AND round = v_r)
         AND (SELECT count(*) FROM public.tournament_bracket_matches
               WHERE tournament_id = v_tid AND side = 'grand_final') = 1
         AND NOT pg_temp.sans_champion(v_tid) THEN
        RAISE EXCEPTION 'G5 % : finale gagnée par le tableau des perdants, match décisif dû, et déjà un champion', v_tid;
      END IF;

      v_crees := public.advance_bracket_round(v_tid, v_r);

      -- Défaites de chaque inscrit sur les tours joués (1 à v_r), finales comprises.
      DELETE FROM _de;
      INSERT INTO _de
        SELECT tp.athlete_id AS pid,
               (SELECT count(*) FROM public.tournament_bracket_matches m
                 WHERE m.tournament_id = v_tid AND m.round <= v_r AND m.status = 'completed'
                   AND tp.athlete_id IN (m.participant1_id, m.participant2_id)
                   AND m.winner_id <> tp.athlete_id)::int AS pertes,
               (SELECT count(*) FROM public.tournament_bracket_matches m
                 WHERE m.tournament_id = v_tid AND m.round = v_r + 1
                   AND tp.athlete_id IN (m.participant1_id, m.participant2_id))::int AS joue,
               (SELECT string_agg(DISTINCT m.side, ',') FROM public.tournament_bracket_matches m
                 WHERE m.tournament_id = v_tid AND m.round = v_r + 1
                   AND tp.athlete_id IN (m.participant1_id, m.participant2_id)) AS cote
          FROM public.tournament_participants tp
         WHERE tp.tournament_id = v_tid;
      SELECT count(*) FILTER (WHERE pertes = 0), count(*) FILTER (WHERE pertes = 1),
             count(*) FILTER (WHERE pertes >= 2)
        INTO v_zero, v_un, v_deux FROM _de;
      SELECT count(*) INTO v_n_gf FROM public.tournament_bracket_matches
       WHERE tournament_id = v_tid AND side = 'grand_final' AND round <= v_r;

      -- Plus aucun tour : il faut une finale jouée, et le match décisif s'il était dû.
      IF NOT EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                      WHERE tournament_id = v_tid AND round = v_r + 1) THEN
        IF v_n_gf = 0 THEN
          RAISE EXCEPTION 'G1 % (%×%, tirage %) : tableaux joués au tour %, aucune grande finale créée',
            v_tid, v_regle, v_n, v_tirage, v_r;
        END IF;
        SELECT * INTO v_gf FROM public.tournament_bracket_matches
         WHERE tournament_id = v_tid AND side = 'grand_final' ORDER BY round DESC LIMIT 1;
        IF v_n_gf = 1 AND v_gf.winner_id = v_gf.participant2_id THEN
          RAISE EXCEPTION 'G2 % (%×%) : finale gagnée par le tableau des perdants, aucun match décisif', v_tid, v_regle, v_n;
        END IF;
        EXIT;
      END IF;

      IF EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                  WHERE tournament_id = v_tid AND round = v_r + 1 AND side = 'grand_final') THEN
        SELECT * INTO v_gf FROM public.tournament_bracket_matches
         WHERE tournament_id = v_tid AND round = v_r + 1 AND side = 'grand_final';
        IF v_n_gf = 0 THEN
          -- Première finale.
          IF v_zero <> 1 OR v_un <> 1 OR v_deux <> v_n - 2 THEN
            RAISE EXCEPTION 'E4 % (%×%, tirage %) : finale au tour % avec % invaincu(s), % à une défaite, % éliminé(s)',
              v_tid, v_regle, v_n, v_tirage, v_r + 1, v_zero, v_un, v_deux;
          END IF;
          IF (SELECT count(*) FROM public.tournament_bracket_matches WHERE tournament_id = v_tid AND round = v_r + 1) <> 1
             OR v_gf.participant1_id <> (SELECT pid FROM _de WHERE pertes = 0)
             OR v_gf.participant2_id <> (SELECT pid FROM _de WHERE pertes = 1) THEN
            RAISE EXCEPTION 'G1 % : finale mal formée (seule dans son tour, invaincu puis finaliste des perdants)', v_tid;
          END IF;
        ELSE
          -- Match décisif : la finale précédente a été gagnée par l'athlète venu des perdants.
          SELECT * INTO v_prec FROM public.tournament_bracket_matches
           WHERE tournament_id = v_tid AND side = 'grand_final' AND round = v_r;
          IF v_n_gf <> 1 OR v_prec.winner_id IS DISTINCT FROM v_prec.participant2_id
             OR v_gf.participant1_id <> v_prec.participant1_id OR v_gf.participant2_id <> v_prec.participant2_id THEN
            RAISE EXCEPTION 'G2 % (%×%) : match décisif créé à tort ou avec une autre paire', v_tid, v_regle, v_n;
          END IF;
          IF NOT pg_temp.sans_champion(v_tid) THEN
            RAISE EXCEPTION 'G5 % : match décisif à jouer, et déjà un champion', v_tid;
          END IF;
          v_resets := v_resets + 1;
        END IF;
      ELSE
        SELECT string_agg(right(pid::text, 1), ',') INTO v_bad FROM _de WHERE pertes >= 2 AND joue > 0;
        IF v_bad IS NOT NULL THEN
          RAISE EXCEPTION 'E1 % : éliminé(s) qui rejoue(nt) au tour % : %', v_tid, v_r + 1, v_bad;
        END IF;
        SELECT string_agg(right(pid::text, 1), ',') INTO v_bad FROM _de
         WHERE joue > 0 AND cote IS DISTINCT FROM CASE pertes WHEN 0 THEN 'winner' ELSE 'loser' END;
        IF v_bad IS NOT NULL THEN
          RAISE EXCEPTION 'E3 % : tour %, athlète(s) du mauvais côté : %', v_tid, v_r + 1, v_bad;
        END IF;
        SELECT string_agg(right(pid::text, 1) || '×' || joue, ',') INTO v_bad FROM _de
         WHERE pertes <= 1 AND joue <> CASE WHEN pertes = 0 AND v_zero = 1 THEN 0 ELSE 1 END;
        IF v_bad IS NOT NULL THEN
          RAISE EXCEPTION 'E2 % (%×%, tirage %) : tour %, athlète(s) omis ou en double : %',
            v_tid, v_regle, v_n, v_tirage, v_r + 1, v_bad;
        END IF;
      END IF;

      IF v_r = 1 THEN
        BEGIN
          IF public.advance_bracket_round(v_tid, 1) <> 0 THEN
            RAISE EXCEPTION 'E6 % : relancer le tour 1 a rendu des matchs créés', v_tid;
          END IF;
        EXCEPTION WHEN unique_violation THEN
          RAISE EXCEPTION 'E6 % : relancer le tour 1 a recréé des matchs', v_tid;
        END;
      END IF;

      v_r := v_r + 1;
      IF v_r > 2 * v_n THEN
        RAISE EXCEPTION 'E5 % (%×%) : plus de % tours', v_tid, v_regle, v_n, 2 * v_n;
      END IF;
    END LOOP;

    v_crees := public.advance_bracket_round(v_tid, v_r);
    IF v_crees <> 0
       OR EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = v_tid AND round > v_r) THEN
      RAISE EXCEPTION 'E6 % : relancer le dernier tour a créé des matchs', v_tid;
    END IF;
    -- Classement : la dernière finale décide, plus personne en lice.
    IF EXISTS (SELECT 1 FROM public.tournament_bracket_standings(v_tid) WHERE still_alive)
       OR (SELECT athlete_id FROM public.tournament_bracket_standings(v_tid) WHERE final_rank = 1) IS DISTINCT FROM v_gf.winner_id
       OR (SELECT athlete_id FROM public.tournament_bracket_standings(v_tid) WHERE final_rank = 2) IS DISTINCT FROM v_gf.loser_id THEN
      RAISE EXCEPTION 'G3 % (%×%) : le classement ne suit pas la dernière finale', v_tid, v_regle, v_n;
    END IF;
    v_runs := v_runs + 1;
  END LOOP;
  END LOOP;
  END LOOP;

  IF v_resets = 0 THEN
    RAISE EXCEPTION 'contre-exemple : aucun match décisif joué, G2 et G5 n''ont rien vérifié';
  END IF;

  RAISE NOTICE 'double élimination : % tableaux joués (3 à 9 athlètes), dont % avec match décisif ; E1 à E6, G1 à G5 conformes',
    v_runs, v_resets;
END $t$;

ROLLBACK;
