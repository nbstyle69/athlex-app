-- ═════════════════════════════════════════════════════════════════════════════
-- Fin de saison idempotente (migration 20270107)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Une ligue à deux divisions (niveau 1 : relègue 1 ; niveau 2 : promeut 1).
--   S1 une fin de saison archive, promeut, relègue, remet à zéro, passe à 2 ;
--   S2 un second appel aussitôt (sans saison attendue) ne change RIEN ;
--   S3 un appel avec une saison attendue périmée ne change rien ;
--   S4 dès qu'un score est validé dans la saison en cours, la fin de saison
--      suivante passe (sans paramètre) ;
--   S5 clore volontairement une saison vide reste possible avec la saison
--      attendue ;
--   S6 droits : `authenticated` exécute, `anon` et PUBLIC non ; l'appel
--      historique à un seul argument fonctionne toujours.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Fin de saison idempotente'

BEGIN;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a700-000000000009'),
  ('00000000-0000-4000-a700-00000000000a'), ('00000000-0000-4000-a700-00000000000b'),
  ('00000000-0000-4000-a700-00000000000c'), ('00000000-0000-4000-a700-00000000000d');
INSERT INTO public.profiles (id, email, username) VALUES
  ('00000000-0000-4000-a700-000000000009', 'saison-gerant@test.invalid', 'saison_gerant'),
  ('00000000-0000-4000-a700-00000000000a', 'saison-a@test.invalid', 'saison_a'),
  ('00000000-0000-4000-a700-00000000000b', 'saison-b@test.invalid', 'saison_b'),
  ('00000000-0000-4000-a700-00000000000c', 'saison-c@test.invalid', 'saison_c'),
  ('00000000-0000-4000-a700-00000000000d', 'saison-d@test.invalid', 'saison_d');
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b700-000000000001', 'Box saison', 'SAIS', '00000000-0000-4000-a700-000000000009');
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by) VALUES
  ('00000000-0000-4000-c700-000000000001', 'Ligue saison', 'rx', 'league_div',
   '00000000-0000-4000-b700-000000000001', '00000000-0000-4000-a700-000000000009');
INSERT INTO public.tournament_divisions (id, tournament_id, name, level, max_members, promote_count, relegate_count) VALUES
  ('00000000-0000-4000-e700-000000000001', '00000000-0000-4000-c700-000000000001', 'Élite', 1, 16, 0, 1),
  ('00000000-0000-4000-e700-000000000002', '00000000-0000-4000-c700-000000000001', 'Open',  2, 16, 1, 0);
INSERT INTO public.tournament_division_members (division_id, athlete_id, points) VALUES
  ('00000000-0000-4000-e700-000000000001', '00000000-0000-4000-a700-00000000000a', 50),
  ('00000000-0000-4000-e700-000000000001', '00000000-0000-4000-a700-00000000000b', 10),
  ('00000000-0000-4000-e700-000000000002', '00000000-0000-4000-a700-00000000000c', 40),
  ('00000000-0000-4000-e700-000000000002', '00000000-0000-4000-a700-00000000000d', 5);

-- L'état complet de la ligue, pour « rien n'a bougé ».
CREATE FUNCTION pg_temp.etat() RETURNS text LANGUAGE sql AS $$
  SELECT (SELECT current_season FROM public.tournaments WHERE id = '00000000-0000-4000-c700-000000000001')
      || '|' || (SELECT string_agg(m.athlete_id || ':' || d.level || ':' || m.points, ',' ORDER BY m.athlete_id)
                   FROM public.tournament_division_members m JOIN public.tournament_divisions d ON d.id = m.division_id
                  WHERE d.tournament_id = '00000000-0000-4000-c700-000000000001')
      || '|' || (SELECT count(*) FROM public.tournament_season_history WHERE tournament_id = '00000000-0000-4000-c700-000000000001')
$$;
-- La fin de saison, appelée comme le Manager : par le gérant, sous `authenticated`.
CREATE FUNCTION pg_temp.clore(p_saison integer DEFAULT NULL) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE r integer;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a700-000000000009', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  IF p_saison IS NULL THEN
    r := public.end_season_and_advance('00000000-0000-4000-c700-000000000001');
  ELSE
    r := public.end_season_and_advance('00000000-0000-4000-c700-000000000001', p_saison);
  END IF;
  PERFORM set_config('role', 'none', true);
  RETURN r;
END $$;

DO $t$
DECLARE
  r integer;
  apres_s1 text;
BEGIN
  -- S1 : première fin de saison.
  r := pg_temp.clore();
  IF r <> 2 THEN RAISE EXCEPTION 'S1 : saison rendue %, attendu 2', r; END IF;
  IF (SELECT string_agg(athlete_id::text || '=' || outcome, ',' ORDER BY athlete_id) FROM public.tournament_season_history
       WHERE tournament_id = '00000000-0000-4000-c700-000000000001' AND season_number = 1)
     IS DISTINCT FROM '00000000-0000-4000-a700-00000000000a=champion,00000000-0000-4000-a700-00000000000b=relegated,'
                   || '00000000-0000-4000-a700-00000000000c=promoted,00000000-0000-4000-a700-00000000000d=stayed' THEN
    RAISE EXCEPTION 'S1 : archive de la saison 1 inattendue';
  END IF;
  apres_s1 := pg_temp.etat();
  IF apres_s1 IS DISTINCT FROM '2|00000000-0000-4000-a700-00000000000a:1:0,00000000-0000-4000-a700-00000000000b:2:0,'
                            || '00000000-0000-4000-a700-00000000000c:1:0,00000000-0000-4000-a700-00000000000d:2:0|4' THEN
    RAISE EXCEPTION 'S1 : état après la fin de saison inattendu : %', apres_s1;
  END IF;

  -- S2 : second appel aussitôt, sans saison attendue.
  r := pg_temp.clore();
  IF r <> 2 OR pg_temp.etat() IS DISTINCT FROM apres_s1 THEN
    RAISE EXCEPTION 'S2 : le second appel a changé la ligue (saison rendue %, état %)', r, pg_temp.etat();
  END IF;

  -- S3 : saison attendue périmée (1 alors que la saison en cours est 2).
  r := pg_temp.clore(1);
  IF r <> 2 OR pg_temp.etat() IS DISTINCT FROM apres_s1 THEN
    RAISE EXCEPTION 'S3 : une saison attendue périmée a changé la ligue (saison rendue %)', r;
  END IF;
  RAISE NOTICE 'S1–S3 ok';
END $t$;

-- S4 : un score validé dans la saison 2 → la fin de saison suivante passe.
INSERT INTO public.tournament_wods (id, tournament_id, title, type, season_number) VALUES
  ('00000000-0000-4000-f700-000000000002', '00000000-0000-4000-c700-000000000001', 'WOD saison 2', 'AMRAP', 2);
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c700-000000000001', '00000000-0000-4000-f700-000000000002',
   '00000000-0000-4000-a700-00000000000a', '120', 'validated');
DO $t$
DECLARE r integer;
BEGIN
  r := pg_temp.clore();
  IF r <> 3 OR (SELECT current_season FROM public.tournaments WHERE id = '00000000-0000-4000-c700-000000000001') <> 3
     OR NOT EXISTS (SELECT 1 FROM public.tournament_season_history
                     WHERE tournament_id = '00000000-0000-4000-c700-000000000001' AND season_number = 2) THEN
    RAISE EXCEPTION 'S4 : la saison 2, jouée, n''a pas été close (saison rendue %)', r;
  END IF;

  -- S5 : saison 3 vide, close volontairement avec la saison attendue.
  r := pg_temp.clore(3);
  IF r <> 4 THEN RAISE EXCEPTION 'S5 : clore une saison vide avec la saison attendue a échoué (rendu %)', r; END IF;
  -- … mais sans elle, un nouvel appel reste sans effet.
  r := pg_temp.clore();
  IF r <> 4 THEN RAISE EXCEPTION 'S5 : un appel sans saison attendue a sauté la saison vide 4 (rendu %)', r; END IF;
  RAISE NOTICE 'S4–S5 ok';
END $t$;

-- S6 : droits, et appel historique à un seul argument.
DO $t$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.end_season_and_advance(uuid, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.end_season_and_advance(uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'S6 : droits d''exécution inattendus';
  END IF;
  IF to_regprocedure('public.end_season_and_advance(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'S6 : l''ancienne signature à un argument existe encore (appel ambigu)';
  END IF;
  RAISE NOTICE 'S6 ok';
END $t$;

ROLLBACK;
\echo '    ok'
