-- ═════════════════════════════════════════════════════════════════════════════
-- Points de division : même règle d'égalité que le barème (migration 20270117)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Des ligues d'une division Élite (A à G) et d'une division Open (H), un WOD
-- For Time de la saison en cours ; barème des divisions inchangé (100, 97, 94…).
--   P1 cas de référence (étape 0) : A et B en 8:00, C en 9:30, D au CAP à 150
--      reps, E au CAP à 140 reps, F sans score. Attendu : A 100, B 100 (rang 1
--      partagé), C 94 (rang 3, le 2 est sauté), D 91, E 88, F 0 ;
--   P2 le tie-break départage d'abord : A (30) devant B (40) ;
--   P3 un score illisible est ignoré : aucun point, et il ne décale personne ;
--   P4 « 8:00 » et « 480 » sont le même temps : égalité, pas 8 secondes ;
--   P5 chaque division est classée à part : H, seul en Open, y est 1er.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Points de division : tie-break, puis rang partagé'

BEGIN;

-- Gérant …0 ; athlètes A à H = …1 à …8.
INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9d7-00000000000' || n)::uuid FROM generate_series(0, 8) n;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9d7-00000000000' || n)::uuid, 'pd-' || n || '@test.invalid',
       'pd_' || substr('0ABCDEFGH', n + 1, 1)
  FROM generate_series(0, 8) n;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9d7-000000000001', 'Box points division', 'PDTS', '00000000-0000-4000-a9d7-000000000000');

-- Ligues L1 (référence), L2 (tie-break), L3 (score illisible), L4 (« 8:00 »).
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status)
SELECT ('00000000-0000-4000-c9d7-00000000000' || n)::uuid, 'L' || n, 'rx', 'league_div',
       '00000000-0000-4000-b9d7-000000000001', '00000000-0000-4000-a9d7-000000000000', 'active'
  FROM generate_series(1, 4) n;
INSERT INTO public.tournament_divisions (id, tournament_id, name, level)
SELECT ('00000000-0000-4000-e9d7-0000000000' || n || d)::uuid, ('00000000-0000-4000-c9d7-00000000000' || n)::uuid,
       CASE d WHEN 1 THEN 'Élite' ELSE 'Open' END, d
  FROM generate_series(1, 4) n, generate_series(1, 2) d;
-- A à G en Élite, H en Open (placements du gérant).
INSERT INTO public.tournament_division_members (division_id, athlete_id)
SELECT ('00000000-0000-4000-e9d7-0000000000' || n || CASE WHEN a = 8 THEN 2 ELSE 1 END)::uuid,
       ('00000000-0000-4000-a9d7-00000000000' || a)::uuid
  FROM generate_series(1, 4) n, generate_series(1, 8) a;
INSERT INTO public.tournament_wods (id, tournament_id, title, type)
SELECT ('00000000-0000-4000-f9d7-00000000000' || n)::uuid, ('00000000-0000-4000-c9d7-00000000000' || n)::uuid, 'Fran', 'For Time'
  FROM generate_series(1, 4) n;

-- Le cas de référence partout (temps en secondes, comme l'app les écrit) ; H en Open.
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, capped, tiebreak_value, status)
SELECT ('00000000-0000-4000-c9d7-00000000000' || n)::uuid, ('00000000-0000-4000-f9d7-00000000000' || n)::uuid,
       ('00000000-0000-4000-a9d7-00000000000' || a)::uuid,
       CASE WHEN n = 4 AND a = 1 THEN '8:00' ELSE sc END, cap,
       CASE WHEN n = 2 AND a = 1 THEN 30 WHEN n = 2 AND a = 2 THEN 40 END, 'validated'
  FROM generate_series(1, 4) n,
       (VALUES (1, '480', false), (2, '480', false), (3, '570', false), (4, '150', true), (5, '140', true), (8, '540', false)) v(a, sc, cap);
-- L3 : G a un score illisible.
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c9d7-000000000003', '00000000-0000-4000-f9d7-000000000003', '00000000-0000-4000-a9d7-000000000007', 'abc', 'validated');

-- Points par athlète (lettre) : « A:100 B:100 … ».
CREATE FUNCTION pg_temp.points(p_l int) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(p.username || ':' || m.points::int, ' ' ORDER BY p.username)
    FROM public.tournament_division_members m
    JOIN public.tournament_divisions d ON d.id = m.division_id
    JOIN public.profiles p ON p.id = m.athlete_id
   WHERE d.tournament_id = ('00000000-0000-4000-c9d7-00000000000' || p_l)::uuid
$$;

DO $t$
DECLARE
  v text;
BEGIN
  PERFORM internal.recalc_division_points(('00000000-0000-4000-c9d7-00000000000' || n)::uuid) FROM generate_series(1, 4) n;

  IF pg_temp.points(1) NOT LIKE '% pd_H:100' THEN
    RAISE EXCEPTION 'P5 : H, seul en Open, n''est pas 1er de sa division : %', pg_temp.points(1);
  END IF;

  v := pg_temp.points(1);
  IF v NOT LIKE 'pd_A:100 pd_B:100 pd_C:94 pd_D:91 pd_E:88 pd_F:0 %' THEN
    RAISE EXCEPTION 'P1 : cas de référence : % (attendu A 100, B 100, C 94, D 91, E 88, F 0)', v;
  END IF;
  v := pg_temp.points(2);
  IF v NOT LIKE 'pd_A:100 pd_B:97 pd_C:94 %' THEN
    RAISE EXCEPTION 'P2 : tie-break 30 contre 40 : %', v;
  END IF;
  v := pg_temp.points(3);
  IF v NOT LIKE 'pd_A:100 pd_B:100 pd_C:94 pd_D:91 pd_E:88 pd_F:0 pd_G:0 %' THEN
    RAISE EXCEPTION 'P3 : score illisible : %', v;
  END IF;
  v := pg_temp.points(4);
  IF v NOT LIKE 'pd_A:100 pd_B:100 pd_C:94 %' THEN
    RAISE EXCEPTION 'P4 : « 8:00 » contre « 480 » : %', v;
  END IF;

  RAISE NOTICE 'points de division : P1 à P5 conformes';
END $t$;

ROLLBACK;
