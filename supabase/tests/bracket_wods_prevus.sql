-- ═════════════════════════════════════════════════════════════════════════════
-- WOD de tableau préparés à l'avance (migration 20270133)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Gérant G (…e0), 33 athlètes, un intrus X (…ef).
--   W1  de vrais tableaux joués de bout en bout, de 2 à 33 participants, en
--       élimination simple et double : un WOD est préparé pour chaque étape
--       proposée par `tournament_bracket_stages` ; chaque match créé porte le
--       WOD attendu. L'étape attendue est déduite du tableau JOUÉ, pas de la
--       formule de la base : gagnants = distance au dernier tour de gagnants
--       créé, perdants = rang du tour parmi les tours de perdants joués,
--       finales = leur ordre. Exemptions : aucun WOD ;
--   W2  les étapes proposées correspondent au tableau joué (autant d'étapes de
--       gagnants que de tours de gagnants, de tours des perdants que de tours
--       des perdants joués, petite finale si l'option est prise et qu'il y a
--       au moins deux tours) ;
--   W3  match décisif sans WOD prévu : il reste sans WOD (effectifs impairs) ;
--       petite finale sans WOD prévu : le WOD de la finale (effectifs
--       multiples de 4) ;
--   W4  grande finale créée à la main (tour 99) : elle reçoit le sien, le match
--       décisif le sien ; un WOD donné à la création est gardé ;
--   W5  matchs existants inchangés : un WOD préparé après la création des
--       matchs ne s'y pose pas ; le tour suivant, créé ensuite, le reçoit ;
--   W6  contrainte CHECK et unicité ;
--   W8  (dans W6) compatibilité : une étape écrite sans tableau (formulaire
--       actuel du Manager), à la création comme à la modification, est rangée
--       chez les gagnants ;
--   W7  `tournament_bracket_stages` : 32 participants en double élimination →
--       5 étapes des gagnants, 7 tours des perdants, grande finale et match
--       décisif, libellés FR et EN ; élimination simple avec petite finale ;
--       après le tirage, les participants réels (5 tirés pour 32 places) ;
--       refusée (42501) à un non-gérant.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> WOD de tableau préparés à l''avance'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9c2-0000000000' || lpad(k::text, 2, '0'))::uuid FROM generate_series(1, 33) k
UNION ALL SELECT '00000000-0000-4000-a9c2-0000000000e0'::uuid
UNION ALL SELECT '00000000-0000-4000-a9c2-0000000000ef'::uuid;
INSERT INTO public.profiles (id, email, username)
SELECT id, 'bwp-' || right(id::text, 2) || '@test.invalid', 'bwp_' || right(id::text, 2)
  FROM auth.users WHERE id::text LIKE '00000000-0000-4000-a9c2-%';
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9c2-000000000001', 'Box tableaux', 'BWP1', '00000000-0000-4000-a9c2-0000000000e0');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9c2-000000000001', '00000000-0000-4000-a9c2-0000000000e0', 'owner', 'active');

-- Un tournoi de n inscrits.
CREATE FUNCTION pg_temp.tournoi(p_format text, p_n int, p_petite boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO public.tournaments (name, level, format, box_id, created_by, status, max_participants, third_place_match)
  VALUES (format('BWP %s×%s', p_format, p_n), 'rx', p_format, '00000000-0000-4000-b9c2-000000000001',
          '00000000-0000-4000-a9c2-0000000000e0', 'active', p_n, p_petite)
  RETURNING id INTO v;
  INSERT INTO public.tournament_participants (tournament_id, athlete_id)
  SELECT v, ('00000000-0000-4000-a9c2-0000000000' || lpad(k::text, 2, '0'))::uuid FROM generate_series(1, p_n) k;
  RETURN v;
END $$;

-- Un WOD par étape ; titre = « tableau:étape ».
CREATE FUNCTION pg_temp.wod(p_tid uuid, p_board text, p_stage int) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.tournament_wods (tournament_id, title, type, bracket_board, bracket_stage)
  VALUES (p_tid, p_board || ':' || coalesce(p_stage::text, ''), 'For Time', p_board, p_stage)
  RETURNING id;
$$;

-- Joue le tableau jusqu'au bout : le plus petit uuid gagne, sauf la première
-- grande finale, gagnée par l'athlète venu des perdants (le match décisif suit).
CREATE FUNCTION pg_temp.jouer(p_tid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_r int := 1; v_m record; v_g uuid;
BEGIN
  PERFORM public.generate_bracket_round_1(p_tid);
  LOOP
    FOR v_m IN SELECT id, side, participant1_id AS p1, participant2_id AS p2
                 FROM public.tournament_bracket_matches
                WHERE tournament_id = p_tid AND round = v_r AND status = 'pending'
    LOOP
      v_g := CASE WHEN v_m.side = 'grand_final' AND NOT EXISTS (
                     SELECT 1 FROM public.tournament_bracket_matches
                      WHERE tournament_id = p_tid AND side = 'grand_final' AND round < v_r)
                  THEN v_m.p2 ELSE LEAST(v_m.p1, v_m.p2) END;
      UPDATE public.tournament_bracket_matches
         SET winner_id = v_g, loser_id = CASE WHEN v_g = v_m.p1 THEN v_m.p2 ELSE v_m.p1 END,
             status = 'completed', completed_at = now()
       WHERE id = v_m.id;
    END LOOP;
    PERFORM public.advance_bracket_round(p_tid, v_r);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = p_tid AND round = v_r + 1);
    v_r := v_r + 1;
    IF v_r > 40 THEN RAISE EXCEPTION 'tableau sans fin (%)', p_tid; END IF;
  END LOOP;
END $$;

-- Écart entre le WOD porté et le WOD attendu, match par match (vide si conforme).
CREATE FUNCTION pg_temp.ecarts(p_tid uuid) RETURNS text LANGUAGE sql AS $$
  WITH m AS (
    SELECT m.*,
           max(m.round) FILTER (WHERE m.side = 'winner') OVER () AS dernier_g,
           dense_rank() OVER (PARTITION BY m.side ORDER BY m.round) AS rang
      FROM public.tournament_bracket_matches m WHERE m.tournament_id = p_tid
  ), attendu AS (
    SELECT m.id, m.side, m.round, m.status, w.title AS porte,
           CASE
             WHEN m.status = 'bye' THEN NULL
             WHEN m.side = 'winner' THEN 'winner:' || (m.dernier_g - m.round)
             WHEN m.side = 'loser' THEN 'loser:' || m.rang
             WHEN m.side = 'grand_final' AND m.rang = 1 THEN 'grand_final:'
             WHEN m.side = 'grand_final' THEN
               CASE WHEN EXISTS (SELECT 1 FROM public.tournament_wods x WHERE x.tournament_id = p_tid AND x.bracket_board = 'grand_final_reset')
                    THEN 'grand_final_reset:' END
             WHEN m.side = 'third_place' THEN
               CASE WHEN EXISTS (SELECT 1 FROM public.tournament_wods x WHERE x.tournament_id = p_tid AND x.bracket_board = 'third_place')
                    THEN 'third_place:' ELSE 'winner:0' END
           END AS voulu
      FROM m LEFT JOIN public.tournament_wods w ON w.id = m.wod_id
  )
  SELECT string_agg(format('%s r%s %s : porte %s, attendu %s', side, round, status, coalesce(porte, '∅'), coalesce(voulu, '∅')), ' ; ')
    FROM attendu WHERE porte IS DISTINCT FROM voulu;
$$;

DO $t$
DECLARE
  v_tid uuid; v_n int; v_f text; v_e record; v_x text; v_cas int := 0;
  v_resets int := 0; v_petites_propres int := 0; v_petites_finale int := 0; v_decisifs_vides int := 0;
  v_etapes_g int; v_etapes_p int; v_tours_g int; v_tours_p int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9c2-0000000000e0', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- W1, W2, W3 : de vrais tableaux.
  FOREACH v_f IN ARRAY ARRAY['bracket', 'swiss'] LOOP
    FOR v_n IN 2..33 LOOP
      v_tid := pg_temp.tournoi(v_f, v_n, v_f = 'bracket');
      FOR v_e IN SELECT * FROM public.tournament_bracket_stages(v_tid) LOOP
        -- Pas de WOD de match décisif pour les effectifs impairs, pas de WOD de
        -- petite finale pour les multiples de 4 : ces matchs doivent le montrer.
        CONTINUE WHEN v_e.bracket_board = 'grand_final_reset' AND v_n % 2 = 1;
        CONTINUE WHEN v_e.bracket_board = 'third_place' AND v_n % 4 = 0;
        PERFORM pg_temp.wod(v_tid, v_e.bracket_board, v_e.bracket_stage);
      END LOOP;
      SELECT count(*) FILTER (WHERE bracket_board = 'winner'), count(*) FILTER (WHERE bracket_board = 'loser')
        INTO v_etapes_g, v_etapes_p FROM public.tournament_bracket_stages(v_tid);

      PERFORM pg_temp.jouer(v_tid);

      v_x := pg_temp.ecarts(v_tid);
      IF v_x IS NOT NULL THEN
        RAISE EXCEPTION 'W1 % × % : %', v_f, v_n, v_x;
      END IF;
      IF EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = v_tid AND status = 'bye' AND wod_id IS NOT NULL) THEN
        RAISE EXCEPTION 'W1 % × % : une exemption porte un WOD', v_f, v_n;
      END IF;

      SELECT count(DISTINCT round) FILTER (WHERE side = 'winner'), count(DISTINCT round) FILTER (WHERE side = 'loser')
        INTO v_tours_g, v_tours_p FROM public.tournament_bracket_matches WHERE tournament_id = v_tid;
      IF v_etapes_g <> v_tours_g OR v_etapes_p <> v_tours_p THEN
        RAISE EXCEPTION 'W2 % × % : étapes proposées % gagnants / % perdants, tableau joué % / %',
          v_f, v_n, v_etapes_g, v_etapes_p, v_tours_g, v_tours_p;
      END IF;
      IF (v_f = 'bracket' AND v_n >= 3) <> EXISTS (SELECT 1 FROM public.tournament_bracket_stages(v_tid) WHERE bracket_board = 'third_place') THEN
        RAISE EXCEPTION 'W2 % × % : petite finale proposée à tort ou manquante', v_f, v_n;
      END IF;

      v_resets := v_resets + (SELECT count(*) FROM public.tournament_bracket_matches WHERE tournament_id = v_tid AND side = 'grand_final' AND round > (SELECT min(round) FROM public.tournament_bracket_matches WHERE tournament_id = v_tid AND side = 'grand_final'))::int;
      v_decisifs_vides := v_decisifs_vides + (SELECT count(*) FROM public.tournament_bracket_matches m WHERE m.tournament_id = v_tid AND m.side = 'grand_final' AND m.wod_id IS NULL)::int;
      v_petites_propres := v_petites_propres + (SELECT count(*) FROM public.tournament_bracket_matches m JOIN public.tournament_wods w ON w.id = m.wod_id WHERE m.tournament_id = v_tid AND m.side = 'third_place' AND w.bracket_board = 'third_place')::int;
      v_petites_finale := v_petites_finale + (SELECT count(*) FROM public.tournament_bracket_matches m JOIN public.tournament_wods w ON w.id = m.wod_id WHERE m.tournament_id = v_tid AND m.side = 'third_place' AND w.bracket_board = 'winner')::int;
      v_cas := v_cas + 1;
    END LOOP;
  END LOOP;
  -- Les cas W3 ont bien été rencontrés.
  IF v_resets = 0 OR v_decisifs_vides = 0 OR v_petites_propres = 0 OR v_petites_finale = 0 THEN
    RAISE EXCEPTION 'W3 : cas non rencontrés (matchs décisifs %, dont sans WOD %, petites finales propres %, au WOD de la finale %)',
      v_resets, v_decisifs_vides, v_petites_propres, v_petites_finale;
  END IF;

  -- W4 : grande finale créée à la main par le Manager, au tour 99.
  v_tid := pg_temp.tournoi('swiss', 4, false);
  PERFORM pg_temp.wod(v_tid, 'grand_final', NULL);
  PERFORM pg_temp.wod(v_tid, 'grand_final_reset', NULL);
  INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
  VALUES (v_tid, 99, 1, 'grand_final', '00000000-0000-4000-a9c2-000000000001', '00000000-0000-4000-a9c2-000000000002', 'pending');
  IF (SELECT w.title FROM public.tournament_bracket_matches m JOIN public.tournament_wods w ON w.id = m.wod_id
       WHERE m.tournament_id = v_tid AND m.round = 99) IS DISTINCT FROM 'grand_final:' THEN
    RAISE EXCEPTION 'W4 : la grande finale créée à la main n''a pas reçu son WOD';
  END IF;
  INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
  VALUES (v_tid, 100, 1, 'grand_final', '00000000-0000-4000-a9c2-000000000002', '00000000-0000-4000-a9c2-000000000001', 'pending');
  IF (SELECT w.title FROM public.tournament_bracket_matches m JOIN public.tournament_wods w ON w.id = m.wod_id
       WHERE m.tournament_id = v_tid AND m.round = 100) IS DISTINCT FROM 'grand_final_reset:' THEN
    RAISE EXCEPTION 'W4 : le match décisif n''a pas reçu son WOD';
  END IF;
  -- Un WOD donné à la création est gardé.
  INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, status, wod_id)
  VALUES (v_tid, 101, 1, 'grand_final', '00000000-0000-4000-a9c2-000000000001', '00000000-0000-4000-a9c2-000000000002', 'pending',
          (SELECT id FROM public.tournament_wods WHERE tournament_id = v_tid AND bracket_board = 'grand_final'));
  IF (SELECT w.title FROM public.tournament_bracket_matches m JOIN public.tournament_wods w ON w.id = m.wod_id
       WHERE m.tournament_id = v_tid AND m.round = 101) IS DISTINCT FROM 'grand_final:' THEN
    RAISE EXCEPTION 'W4 : le WOD donné à la création a été remplacé';
  END IF;

  -- W5 : matchs existants inchangés.
  v_tid := pg_temp.tournoi('bracket', 8, false);
  PERFORM public.generate_bracket_round_1(v_tid);
  PERFORM pg_temp.wod(v_tid, 'winner', 2);
  PERFORM pg_temp.wod(v_tid, 'winner', 1);
  IF EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = v_tid AND wod_id IS NOT NULL) THEN
    RAISE EXCEPTION 'W5 : un WOD préparé après coup s''est posé sur un match existant';
  END IF;
  UPDATE public.tournament_bracket_matches
     SET winner_id = LEAST(participant1_id, participant2_id), loser_id = GREATEST(participant1_id, participant2_id),
         status = 'completed', completed_at = now()
   WHERE tournament_id = v_tid AND round = 1;
  PERFORM public.advance_bracket_round(v_tid, 1);
  IF (SELECT count(*) FROM public.tournament_bracket_matches m JOIN public.tournament_wods w ON w.id = m.wod_id
       WHERE m.tournament_id = v_tid AND m.round = 2 AND w.title = 'winner:1') <> 2
     OR EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = v_tid AND round = 1 AND wod_id IS NOT NULL) THEN
    RAISE EXCEPTION 'W5 : le tour créé ensuite n''a pas reçu son WOD, ou le tour 1 a changé';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $t$;

-- W6 : contrainte et unicité.
DO $t$
DECLARE v_tid uuid; v_etat text; v_c text[];
BEGIN
  v_tid := pg_temp.tournoi('swiss', 4, false);
  -- W8 : le formulaire actuel du Manager écrit l'étape sans tableau : `winner`.
  INSERT INTO public.tournament_wods (tournament_id, title, type, bracket_stage) VALUES (v_tid, 'ancien', 'For Time', 2);
  UPDATE public.tournament_wods SET bracket_stage = 3 WHERE tournament_id = v_tid AND title = 'ancien';
  INSERT INTO public.tournament_wods (tournament_id, title, type) VALUES (v_tid, 'sans etape', 'For Time');
  UPDATE public.tournament_wods SET bracket_stage = 4 WHERE tournament_id = v_tid AND title = 'sans etape';
  IF (SELECT string_agg(title || '=' || bracket_board || ':' || bracket_stage, ' ' ORDER BY title) FROM public.tournament_wods
       WHERE tournament_id = v_tid AND title IN ('ancien', 'sans etape')) IS DISTINCT FROM 'ancien=winner:3 sans etape=winner:4' THEN
    RAISE EXCEPTION 'W8 : une étape écrite sans tableau n''est pas rangée chez les gagnants';
  END IF;
  FOREACH v_c SLICE 1 IN ARRAY ARRAY[['winner', NULL], ['winner', '-1'], ['loser', '0'], ['grand_final', '0'],
                                        ['grand_final_reset', '1'], ['third_place', '0'], ['finale', NULL]] LOOP
    v_etat := NULL;
    BEGIN
      INSERT INTO public.tournament_wods (tournament_id, title, type, bracket_board, bracket_stage)
      VALUES (v_tid, 'x', 'For Time', v_c[1], v_c[2]::int);
    EXCEPTION WHEN OTHERS THEN v_etat := SQLSTATE;
    END;
    IF v_etat IS DISTINCT FROM '23514' THEN
      RAISE EXCEPTION 'W6 : (%, %) accepté ou refusé autrement (%)', v_c[1], v_c[2], coalesce(v_etat, 'accepté');
    END IF;
  END LOOP;
  PERFORM pg_temp.wod(v_tid, 'winner', 0);
  PERFORM pg_temp.wod(v_tid, 'loser', 1);
  PERFORM pg_temp.wod(v_tid, 'grand_final', NULL);
  PERFORM pg_temp.wod(v_tid, 'winner', 1);
  FOREACH v_c SLICE 1 IN ARRAY ARRAY[['winner', '0'], ['loser', '1'], ['grand_final', NULL]] LOOP
    v_etat := NULL;
    BEGIN
      PERFORM pg_temp.wod(v_tid, v_c[1], v_c[2]::int);
    EXCEPTION WHEN OTHERS THEN v_etat := SQLSTATE;
    END;
    IF v_etat IS DISTINCT FROM '23505' THEN
      RAISE EXCEPTION 'W6 : deux WOD pour l''étape (%, %) (%)', v_c[1], v_c[2], coalesce(v_etat, 'accepté');
    END IF;
  END LOOP;
END $t$;

-- W7 : étapes proposées et libellés.
DO $t$
DECLARE v_tid uuid; v_l text; v_etat text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9c2-0000000000e0', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  v_tid := pg_temp.tournoi('swiss', 32, false);
  SELECT string_agg(bracket_board || ':' || coalesce(bracket_stage::text, '') || '=' || label_fr || '|' || label_en, ' ; ' ORDER BY ordre)
    INTO v_l FROM public.tournament_bracket_stages(v_tid);
  IF v_l IS DISTINCT FROM
     'winner:4=16e de finale des gagnants|Winners'' round of 32 ; winner:3=8e de finale des gagnants|Winners'' round of 16 ; '
     'winner:2=Quart de finale des gagnants|Winners'' quarter-final ; winner:1=Demi-finale des gagnants|Winners'' semi-final ; '
     'winner:0=Finale des gagnants|Winners'' final ; loser:1=Tour 1 des perdants|Losers'' round 1 ; loser:2=Tour 2 des perdants|Losers'' round 2 ; '
     'loser:3=Tour 3 des perdants|Losers'' round 3 ; loser:4=Tour 4 des perdants|Losers'' round 4 ; loser:5=Tour 5 des perdants|Losers'' round 5 ; '
     'loser:6=Tour 6 des perdants|Losers'' round 6 ; loser:7=Tour 7 des perdants|Losers'' round 7 ; '
     'grand_final:=Grande finale|Grand final ; grand_final_reset:=Grande finale — match décisif|Grand final — decider' THEN
    RAISE EXCEPTION 'W7 : double élimination à 32 : %', v_l;
  END IF;
  v_tid := pg_temp.tournoi('bracket', 8, true);
  SELECT string_agg(bracket_board || ':' || coalesce(bracket_stage::text, '') || '=' || label_fr || '|' || label_en, ' ; ' ORDER BY ordre)
    INTO v_l FROM public.tournament_bracket_stages(v_tid);
  IF v_l IS DISTINCT FROM
     'winner:2=Quart de finale|Quarter-final ; winner:1=Demi-finale|Semi-final ; winner:0=Finale|Final ; third_place:=Petite finale|Third-place match' THEN
    RAISE EXCEPTION 'W7 : élimination simple à 8 avec petite finale : %', v_l;
  END IF;
  -- Après le tirage : les participants réels, plus max_participants.
  v_tid := pg_temp.tournoi('swiss', 5, false);
  UPDATE public.tournaments SET max_participants = 32 WHERE id = v_tid;
  PERFORM public.generate_bracket_round_1(v_tid);
  SELECT string_agg(bracket_board || ':' || coalesce(bracket_stage::text, ''), ' ' ORDER BY ordre) INTO v_l
    FROM public.tournament_bracket_stages(v_tid);
  IF v_l IS DISTINCT FROM 'winner:2 winner:1 winner:0 loser:1 loser:2 loser:3 grand_final: grand_final_reset:' THEN
    RAISE EXCEPTION 'W7 : tirage de 5 pour 32 places : %', v_l;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9c2-0000000000ef', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    PERFORM * FROM public.tournament_bracket_stages(v_tid);
  EXCEPTION WHEN OTHERS THEN v_etat := SQLSTATE;
  END;
  PERFORM set_config('role', 'none', true);
  IF v_etat IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'W7 : un non-gérant lit les étapes (%)', coalesce(v_etat, 'accepté');
  END IF;
END $t$;

ROLLBACK;
\echo '    W1 à W7 OK'
