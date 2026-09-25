-- ═════════════════════════════════════════════════════════════════════════════
-- Divisions : capacité, affectation par ELO, placement manuel (migration 20270115)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Une ligue à trois divisions de deux places (Élite, Inter, Open) ; athlètes
-- A0 à A8, ELO 1700, 1600, … 1000 pour A0 à A7, et A8 à 1050 :
--   V1 inscriptions dans le désordre : Élite {A1, A2}, Inter {A3, A4}, Open
--      {A5, A6, A7} — la dernière division prend le reste ;
--   V2 le gérant place A7 en Élite : A7 est « manual », y reste quand A0
--      (1700) s'inscrit, et occupe sa place : A1 déborde en Inter ;
--   V3 une ligne insérée par le gérant est « manual », même s'il écrit « auto » ;
--   V6 le gérant rend A7 à l'affectation automatique : relancée, elle le place
--      en Open ;
--   V4 le tournoi a démarré (migration 20270125, qui remplace ici la règle de
--      la 20270115) : un nouvel inscrit va dans la division la plus basse s'il
--      y reste de la place, même si une division plus haute en a, et nulle part
--      quand elle est pleine ; personne d'autre ne bouge ;
--   V5 un athlète ne peut pas relancer l'affectation (42501) ;
--   V7 à chaque étape, personne n'est dans deux divisions ; avant le
--      démarrage, chaque inscrit a une division.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Divisions : capacité, affectation par ELO, placement manuel'

BEGIN;

-- Gérant …a9 (hors série), athlètes …00 à …08.
INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9d1-0000000000' || lpad(n::text, 2, '0'))::uuid FROM generate_series(0, 9) n;
INSERT INTO public.profiles (id, email, username, elo)
SELECT ('00000000-0000-4000-a9d1-0000000000' || lpad(n::text, 2, '0'))::uuid, 'dv-' || n || '@test.invalid', 'dv_' || n,
       CASE WHEN n = 8 THEN 1050 WHEN n = 9 THEN 1000 ELSE 1700 - 100 * n END
  FROM generate_series(0, 9) n;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9d1-000000000001', 'Box divisions', 'DVTS', '00000000-0000-4000-a9d1-000000000009');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9d1-000000000001', '00000000-0000-4000-a9d1-000000000009', 'owner', 'active');
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status) VALUES
  ('00000000-0000-4000-c9d1-000000000001', 'Ligue', 'rx', 'league_div', '00000000-0000-4000-b9d1-000000000001', '00000000-0000-4000-a9d1-000000000009', 'open');
INSERT INTO public.tournament_divisions (id, tournament_id, name, level, max_members) VALUES
  ('00000000-0000-4000-e9d1-000000000001', '00000000-0000-4000-c9d1-000000000001', 'Élite', 1, 2),
  ('00000000-0000-4000-e9d1-000000000002', '00000000-0000-4000-c9d1-000000000001', 'Inter', 2, 2),
  ('00000000-0000-4000-e9d1-000000000003', '00000000-0000-4000-c9d1-000000000001', 'Open',  3, 2);

-- Répartition lue : « É:1,2 I:3,4 O:5,6,7 » (numéros des athlètes, par division).
CREATE FUNCTION pg_temp.repartition() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(left(d.name, 1) || ':' || (SELECT string_agg(right(m.athlete_id::text, 1), ',' ORDER BY m.athlete_id)
                                                  FROM public.tournament_division_members m WHERE m.division_id = d.id), ' ' ORDER BY d.level)
    FROM public.tournament_divisions d WHERE d.tournament_id = '00000000-0000-4000-c9d1-000000000001'
$$;
CREATE FUNCTION pg_temp.inscrire(p_n int) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.tournament_participants (tournament_id, athlete_id)
  VALUES ('00000000-0000-4000-c9d1-000000000001', ('00000000-0000-4000-a9d1-0000000000' || lpad(p_n::text, 2, '0'))::uuid)
$$;
CREATE FUNCTION pg_temp.v7(p_etape text, p_tous_places boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT athlete_id FROM public.tournament_division_members m
               JOIN public.tournament_divisions d ON d.id = m.division_id
              WHERE d.tournament_id = '00000000-0000-4000-c9d1-000000000001'
              GROUP BY athlete_id HAVING count(*) > 1)
     OR p_tous_places AND EXISTS (SELECT 1 FROM public.tournament_participants tp
                 WHERE tp.tournament_id = '00000000-0000-4000-c9d1-000000000001'
                   AND NOT EXISTS (SELECT 1 FROM public.tournament_division_members m
                                    JOIN public.tournament_divisions d ON d.id = m.division_id
                                   WHERE d.tournament_id = tp.tournament_id AND m.athlete_id = tp.athlete_id)) THEN
    RAISE EXCEPTION 'V7 (%) : un athlète dans deux divisions, ou un inscrit sans division : %', p_etape, pg_temp.repartition();
  END IF;
END $$;

DO $t$
DECLARE
  v_t constant uuid := '00000000-0000-4000-c9d1-000000000001';
  a7  constant uuid := '00000000-0000-4000-a9d1-000000000007';
  v_avant text;
  v_ok boolean;
BEGIN
  -- V1 : inscriptions dans le désordre.
  PERFORM pg_temp.inscrire(n) FROM unnest(ARRAY[5, 1, 7, 3, 2, 6, 4]) n;
  PERFORM pg_temp.v7('V1');
  IF pg_temp.repartition() <> 'É:1,2 I:3,4 O:5,6,7' THEN
    RAISE EXCEPTION 'V1 : répartition % (attendu É:1,2 I:3,4 O:5,6,7)', pg_temp.repartition();
  END IF;

  -- V2 : le gérant place A7 en Élite (écriture directe, comme le Manager), puis A0 s'inscrit.
  UPDATE public.tournament_division_members SET division_id = '00000000-0000-4000-e9d1-000000000001', points = 0, rank = NULL
   WHERE athlete_id = a7;
  PERFORM pg_temp.inscrire(0);
  PERFORM pg_temp.v7('V2');
  IF pg_temp.repartition() <> 'É:0,7 I:1,2 O:3,4,5,6'
     OR (SELECT placement FROM public.tournament_division_members WHERE athlete_id = a7) <> 'manual' THEN
    RAISE EXCEPTION 'V2 : répartition % (attendu É:0,7 I:1,2 O:3,4,5,6, A7 « manual »)', pg_temp.repartition();
  END IF;

  -- V3 : une ligne insérée par le gérant est « manual ».
  INSERT INTO public.tournament_divisions (id, tournament_id, name, level, max_members) VALUES
    ('00000000-0000-4000-e9d1-000000000009', '00000000-0000-4000-c9d1-000000000001', 'Test', 9, 1);
  INSERT INTO public.tournament_division_members (division_id, athlete_id, placement)
  VALUES ('00000000-0000-4000-e9d1-000000000009', '00000000-0000-4000-a9d1-000000000009', 'auto');
  IF (SELECT placement FROM public.tournament_division_members WHERE athlete_id = '00000000-0000-4000-a9d1-000000000009') <> 'manual' THEN
    RAISE EXCEPTION 'V3 : une ligne écrite par le gérant est restée « auto »';
  END IF;
  DELETE FROM public.tournament_divisions WHERE id = '00000000-0000-4000-e9d1-000000000009';

  -- V5 : un athlète ne relance pas l'affectation.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9d1-000000000001', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  v_ok := false;
  BEGIN
    PERFORM public.affecter_divisions(v_t);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  PERFORM set_config('role', 'none', true);
  IF NOT v_ok THEN RAISE EXCEPTION 'V5 : un athlète a pu relancer l''affectation'; END IF;

  -- V6 : le gérant rend A7 à l'affectation automatique, puis la relance.
  UPDATE public.tournament_division_members SET placement = 'auto' WHERE athlete_id = a7;
  IF (SELECT placement FROM public.tournament_division_members WHERE athlete_id = a7) <> 'auto' THEN
    RAISE EXCEPTION 'V6 : le retour explicite à « auto » n''a pas été respecté';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9d1-000000000009', true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.affecter_divisions(v_t);
  PERFORM set_config('role', 'none', true);
  PERFORM pg_temp.v7('V6');
  IF pg_temp.repartition() <> 'É:0,1 I:2,3 O:4,5,6,7' THEN
    RAISE EXCEPTION 'V6 : répartition % (attendu É:0,1 I:2,3 O:4,5,6,7)', pg_temp.repartition();
  END IF;

  -- V4 : le tournoi démarre (un score validé). A1 quitte l'Élite (place libre) ;
  -- le gérant porte l'Open à 5 places. A8 (1050) s'inscrit : il va en Open, la
  -- plus basse, pas en Élite. L'Open est alors pleine : A1 (1600) se réinscrit
  -- et n'est placé nulle part. Personne d'autre ne bouge.
  UPDATE public.tournaments SET status = 'active' WHERE id = v_t;
  INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
    ('00000000-0000-4000-f9d1-000000000001', v_t, 'WOD 1', 'AMRAP');
  INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
  VALUES (v_t, '00000000-0000-4000-f9d1-000000000001', '00000000-0000-4000-a9d1-000000000000', '100', 'validated');
  DELETE FROM public.tournament_division_members WHERE athlete_id = '00000000-0000-4000-a9d1-000000000001';
  DELETE FROM public.tournament_participants WHERE tournament_id = v_t AND athlete_id = '00000000-0000-4000-a9d1-000000000001';
  UPDATE public.tournament_divisions SET max_members = 5 WHERE id = '00000000-0000-4000-e9d1-000000000003';
  v_avant := pg_temp.repartition();
  PERFORM pg_temp.inscrire(8);
  PERFORM pg_temp.v7('V4', false);
  IF pg_temp.repartition() <> 'É:0 I:2,3 O:4,5,6,7,8' THEN
    RAISE EXCEPTION 'V4 : répartition % avant, % après l''inscription de A8 (attendu É:0 I:2,3 O:4,5,6,7,8)',
      v_avant, pg_temp.repartition();
  END IF;
  PERFORM pg_temp.inscrire(1);
  PERFORM pg_temp.v7('V4', false);
  IF pg_temp.repartition() <> 'É:0 I:2,3 O:4,5,6,7,8' THEN
    RAISE EXCEPTION 'V4 : Open pleine, A1 a été placé ailleurs : %', pg_temp.repartition();
  END IF;

  RAISE NOTICE 'divisions : V1 à V7 conformes';
END $t$;

ROLLBACK;
