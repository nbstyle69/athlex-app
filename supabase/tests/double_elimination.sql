-- ═════════════════════════════════════════════════════════════════════════════
-- Double élimination complète : aucun athlète omis (migration 20270110)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Tableaux de 3 à 9 athlètes, joués jusqu'au bout par `generate_bracket_round_1`
-- et `advance_bracket_round`, appelées par le gérant. Trois règles de vainqueur :
-- « force » (le plus fort gagne toujours), « p1 » (le premier inscrit du match
-- gagne : surprises en série), « hasard » ; trois tirages du tour 1 chacune.
-- À chaque tour créé :
--   E1 aucun athlète à deux défaites ne rejoue ;
--   E2 chaque athlète encore en lice joue exactement une fois (match ou
--      exemption) — seul l'invaincu isolé attend que le tableau des perdants
--      finisse ;
--   E3 côté gagnants : que des invaincus ; côté perdants : qu'une défaite.
-- Quand plus aucun tour n'est créé :
--   E4 un invaincu, un athlète à une défaite, tous les autres à deux ;
--   E5 le tableau se termine en au plus 2N tours ;
--   E6 relancer un tour déjà avancé (le 1er, le dernier) ne crée rien.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Double élimination : aucun athlète omis'

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

DO $t$
DECLARE
  v_owner constant uuid := '00000000-0000-4000-a95d-000000000000';
  v_n int; v_regle text; v_tirage int;
  v_tid uuid; v_r int; v_crees int; v_m record; v_gagnant uuid;
  v_zero int; v_un int; v_deux int;
  v_bad text; v_runs int := 0;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

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
      FOR v_m IN SELECT id, participant1_id AS p1, participant2_id AS p2
                   FROM public.tournament_bracket_matches
                  WHERE tournament_id = v_tid AND round = v_r AND status = 'pending'
      LOOP
        v_gagnant := CASE v_regle
          WHEN 'force' THEN LEAST(v_m.p1, v_m.p2)
          WHEN 'p1'    THEN v_m.p1
          ELSE CASE WHEN random() < 0.5 THEN v_m.p1 ELSE v_m.p2 END END;
        UPDATE public.tournament_bracket_matches
           SET winner_id = v_gagnant,
               loser_id  = CASE WHEN v_gagnant = v_m.p1 THEN v_m.p2 ELSE v_m.p1 END,
               status = 'completed', completed_at = now()
         WHERE id = v_m.id;
      END LOOP;

      v_crees := public.advance_bracket_round(v_tid, v_r);

      -- Défaites de chaque inscrit sur les tours joués (1 à v_r).
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

      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                             WHERE tournament_id = v_tid AND round = v_r + 1);

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

    IF v_zero <> 1 OR v_un <> 1 OR v_deux <> v_n - 2 THEN
      RAISE EXCEPTION 'E4 % (%×%, tirage %) : fin au tour % avec % invaincu(s), % à une défaite, % éliminé(s)',
        v_tid, v_regle, v_n, v_tirage, v_r, v_zero, v_un, v_deux;
    END IF;
    IF public.advance_bracket_round(v_tid, v_r) <> 0
       OR EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = v_tid AND round > v_r) THEN
      RAISE EXCEPTION 'E6 % : relancer le dernier tour a créé des matchs', v_tid;
    END IF;
    v_runs := v_runs + 1;
  END LOOP;
  END LOOP;
  END LOOP;

  RAISE NOTICE 'double élimination : % tableaux joués (3 à 9 athlètes), E1 à E6 conformes', v_runs;
END $t$;

ROLLBACK;
