-- ═════════════════════════════════════════════════════════════════════════════
-- Ligue : classement général d'une saison (migration 20270119)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Une ligue sur deux saisons, athlètes A à F :
--   saison 1 (terminée) : le cas de référence de l'étape 0 — un For Time, A et
--     B en 8:00, C en 9:30, D au CAP à 150 reps, E au CAP à 140 reps, F sans score ;
--   saison 2 (en cours) : deux WOD — un For Time (F 7:00, A 8:00) et un AMRAP
--     (F 200, B 150).
--   L1 le général par défaut est celui de la saison en cours, SANS la saison
--      précédente : F 200 (1er), A 97 et B 97 (2es ex-aequo), C, D, E 0 (4es) ;
--   L2 le général final de la saison 1 : A 100, B 100 (1ers), C 95 (3e), D 93,
--      E 91, F 0 ;
--   L3 la saison en cours passée explicitement donne le même classement ;
--   L4 `anon` ne peut pas l'appeler, `authenticated` si.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Ligue : classement général d''une saison'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9e5-00000000000' || n)::uuid FROM generate_series(0, 6) n;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9e5-00000000000' || n)::uuid, 'lg-' || n || '@test.invalid',
       'lg_' || substr('0ABCDEF', n + 1, 1)
  FROM generate_series(0, 6) n;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9e5-000000000001', 'Box ligue saisons', 'LGTS', '00000000-0000-4000-a9e5-000000000000');
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status) VALUES
  ('00000000-0000-4000-c9e5-000000000001', 'Ligue', 'rx', 'league_div',
   '00000000-0000-4000-b9e5-000000000001', '00000000-0000-4000-a9e5-000000000000', 'active');
INSERT INTO public.tournament_participants (tournament_id, athlete_id)
SELECT '00000000-0000-4000-c9e5-000000000001', ('00000000-0000-4000-a9e5-00000000000' || a)::uuid
  FROM generate_series(1, 6) a;

-- Saison 1 : le cas de référence.
INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
  ('00000000-0000-4000-f9e5-000000000011', '00000000-0000-4000-c9e5-000000000001', 'Fran S1', 'For Time');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, capped, status)
SELECT '00000000-0000-4000-c9e5-000000000001', '00000000-0000-4000-f9e5-000000000011',
       ('00000000-0000-4000-a9e5-00000000000' || a)::uuid, sc, cap, 'validated'
  FROM (VALUES (1, '480', false), (2, '480', false), (3, '570', false), (4, '150', true), (5, '140', true)) v(a, sc, cap);

-- La saison 1 se termine ; saison 2 : deux WOD.
UPDATE public.tournaments SET current_season = 2 WHERE id = '00000000-0000-4000-c9e5-000000000001';
INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
  ('00000000-0000-4000-f9e5-000000000021', '00000000-0000-4000-c9e5-000000000001', 'Grace S2', 'For Time'),
  ('00000000-0000-4000-f9e5-000000000022', '00000000-0000-4000-c9e5-000000000001', 'Cindy S2', 'AMRAP');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c9e5-000000000001', '00000000-0000-4000-f9e5-000000000021', '00000000-0000-4000-a9e5-000000000006', '420', 'validated'),
  ('00000000-0000-4000-c9e5-000000000001', '00000000-0000-4000-f9e5-000000000021', '00000000-0000-4000-a9e5-000000000001', '480', 'validated'),
  ('00000000-0000-4000-c9e5-000000000001', '00000000-0000-4000-f9e5-000000000022', '00000000-0000-4000-a9e5-000000000006', '200', 'validated'),
  ('00000000-0000-4000-c9e5-000000000001', '00000000-0000-4000-f9e5-000000000022', '00000000-0000-4000-a9e5-000000000002', '150', 'validated');

-- « A:100/1 B:100/1 … » pour une saison (NULL : saison par défaut).
CREATE FUNCTION pg_temp.general(p_saison int) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(p.username || ':' || s.points || '/' || s.final_rank, ' ' ORDER BY p.username)
    FROM public.tournament_ligue_standings('00000000-0000-4000-c9e5-000000000001', p_saison) s
    JOIN public.profiles p ON p.id = s.athlete_id
$$;

DO $t$
DECLARE
  v text;
BEGIN
  IF (SELECT array_agg(season_number ORDER BY title) FROM public.tournament_wods
       WHERE tournament_id = '00000000-0000-4000-c9e5-000000000001') <> ARRAY[2, 1, 2] THEN
    RAISE EXCEPTION 'décor : les WOD ne portent pas leurs saisons (Cindy S2, Fran S1, Grace S2)';
  END IF;

  v := pg_temp.general(NULL);
  IF v <> 'lg_A:97/2 lg_B:97/2 lg_C:0/4 lg_D:0/4 lg_E:0/4 lg_F:200/1' THEN
    RAISE EXCEPTION 'L1 : général de la saison en cours : % (attendu F 200, A 97, B 97, C D E 0)', v;
  END IF;

  v := pg_temp.general(1);
  IF v <> 'lg_A:100/1 lg_B:100/1 lg_C:95/3 lg_D:93/4 lg_E:91/5 lg_F:0/6' THEN
    RAISE EXCEPTION 'L2 : général final de la saison 1 : % (attendu A 100, B 100, C 95, D 93, E 91, F 0)', v;
  END IF;

  IF pg_temp.general(2) IS DISTINCT FROM pg_temp.general(NULL) THEN
    RAISE EXCEPTION 'L3 : saison 2 explicite % ≠ saison par défaut %', pg_temp.general(2), pg_temp.general(NULL);
  END IF;

  IF has_function_privilege('anon', 'public.tournament_ligue_standings(uuid, integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.tournament_ligue_standings(uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'L4 : droits : anon ne doit pas pouvoir l''appeler, authenticated si';
  END IF;

  RAISE NOTICE 'ligue, général par saison : L1 à L4 conformes';
END $t$;

ROLLBACK;
