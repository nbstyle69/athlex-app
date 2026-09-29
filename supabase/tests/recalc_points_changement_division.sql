-- ═════════════════════════════════════════════════════════════════════════════
-- Recalcul des points quand la division d'un score change (migration 20270140)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Une ligue : Élite (A, B) et Open (C, D). WOD 1 en AMRAP : A 100, B 90 (Élite),
-- C 120, D 80 (Open).
--   R1 mutation : sans `division_id` dans le déclencheur, le gérant déplace le
--      score validé de C en Élite et rien n'est recalculé (R2 prouve bien
--      quelque chose) ;
--   R2 le gérant déplace le score validé de C de l'Open à l'Élite : Élite
--      (C 100, A 97, B 95) ET Open (D 100) recalculées ;
--   R3 changement de statut : le score de D repasse en attente, D perd ses points ;
--   R4 changement de score : B passe à 130 et devance C et A.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Recalcul des points quand la division d''un score change'

BEGIN;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a840-000000000009'),
  ('00000000-0000-4000-a840-00000000000a'), ('00000000-0000-4000-a840-00000000000b'),
  ('00000000-0000-4000-a840-00000000000c'), ('00000000-0000-4000-a840-00000000000d');
INSERT INTO public.profiles (id, email, username) VALUES
  ('00000000-0000-4000-a840-000000000009', 'rcd-gerant@test.invalid', 'rcd_gerant'),
  ('00000000-0000-4000-a840-00000000000a', 'rcd-a@test.invalid', 'rcd_a'),
  ('00000000-0000-4000-a840-00000000000b', 'rcd-b@test.invalid', 'rcd_b'),
  ('00000000-0000-4000-a840-00000000000c', 'rcd-c@test.invalid', 'rcd_c'),
  ('00000000-0000-4000-a840-00000000000d', 'rcd-d@test.invalid', 'rcd_d');
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b840-000000000001', 'Box recalcul division', 'RCDV', '00000000-0000-4000-a840-000000000009');
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by) VALUES
  ('00000000-0000-4000-c840-000000000001', 'Ligue recalcul', 'rx', 'league_div',
   '00000000-0000-4000-b840-000000000001', '00000000-0000-4000-a840-000000000009');
INSERT INTO public.tournament_divisions (id, tournament_id, name, level) VALUES
  ('00000000-0000-4000-e840-000000000001', '00000000-0000-4000-c840-000000000001', 'Élite', 1),
  ('00000000-0000-4000-e840-000000000002', '00000000-0000-4000-c840-000000000001', 'Open',  2);
INSERT INTO public.tournament_division_members (id, division_id, athlete_id) VALUES
  ('00000000-0000-4000-e840-00000000010a', '00000000-0000-4000-e840-000000000001', '00000000-0000-4000-a840-00000000000a'),
  ('00000000-0000-4000-e840-00000000010b', '00000000-0000-4000-e840-000000000001', '00000000-0000-4000-a840-00000000000b'),
  ('00000000-0000-4000-e840-00000000010c', '00000000-0000-4000-e840-000000000002', '00000000-0000-4000-a840-00000000000c'),
  ('00000000-0000-4000-e840-00000000010d', '00000000-0000-4000-e840-000000000002', '00000000-0000-4000-a840-00000000000d');
INSERT INTO public.tournament_wods (id, tournament_id, title, type, season_number) VALUES
  ('00000000-0000-4000-f840-000000000001', '00000000-0000-4000-c840-000000000001', 'WOD 1', 'AMRAP', 1);
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c840-000000000001', '00000000-0000-4000-f840-000000000001', '00000000-0000-4000-a840-00000000000a', '100', 'validated'),
  ('00000000-0000-4000-c840-000000000001', '00000000-0000-4000-f840-000000000001', '00000000-0000-4000-a840-00000000000b', '90',  'validated'),
  ('00000000-0000-4000-c840-000000000001', '00000000-0000-4000-f840-000000000001', '00000000-0000-4000-a840-00000000000c', '120', 'validated'),
  ('00000000-0000-4000-c840-000000000001', '00000000-0000-4000-f840-000000000001', '00000000-0000-4000-a840-00000000000d', '80',  'validated');

CREATE FUNCTION pg_temp.points() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(right(m.athlete_id::text, 1) || '=' || m.points::int, ' ' ORDER BY m.athlete_id)
    FROM public.tournament_division_members m JOIN public.tournament_divisions d ON d.id = m.division_id
   WHERE d.tournament_id = '00000000-0000-4000-c840-000000000001'
$$;

DO $t$
BEGIN
  IF pg_temp.points() <> 'a=100 b=97 c=100 d=97' THEN
    RAISE EXCEPTION 'Départ : points inattendus : %', pg_temp.points();
  END IF;
END $t$;

-- R1 : mutation — le déclencheur tel qu'avant la migration.
SAVEPOINT avant_r1;
DROP TRIGGER trg_recalc_division_points_on_scores ON public.tournament_scores;
CREATE TRIGGER trg_recalc_division_points_on_scores
  AFTER INSERT OR DELETE OR UPDATE OF status, score_value ON public.tournament_scores
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_division_points();
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a840-000000000009';
SET LOCAL request.jwt.claim.role = 'authenticated';
UPDATE public.tournament_scores SET division_id = '00000000-0000-4000-e840-000000000001'
 WHERE athlete_id = '00000000-0000-4000-a840-00000000000c';
RESET ROLE;
DO $t$
BEGIN
  IF (SELECT division_id FROM public.tournament_scores WHERE athlete_id = '00000000-0000-4000-a840-00000000000c')
     IS DISTINCT FROM '00000000-0000-4000-e840-000000000001' THEN
    RAISE EXCEPTION 'R1 : contre-exemple — le gérant n''a pas pu déplacer le score de C';
  END IF;
  IF pg_temp.points() <> 'a=100 b=97 c=100 d=97' THEN
    RAISE EXCEPTION 'R1 : sans division_id dans le déclencheur, les points ont bougé (%) : R2 ne prouve rien', pg_temp.points();
  END IF;
  RAISE NOTICE 'R1 ok';
END $t$;
ROLLBACK TO SAVEPOINT avant_r1;

-- R2 : le gérant déplace le score validé de C en Élite (parcours du Manager).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a840-000000000009';
SET LOCAL request.jwt.claim.role = 'authenticated';
UPDATE public.tournament_scores SET division_id = '00000000-0000-4000-e840-000000000001'
 WHERE athlete_id = '00000000-0000-4000-a840-00000000000c';
RESET ROLE;
DO $t$
BEGIN
  -- Élite : C 1er (100), A 2e (97), B 3e (95) ; Open : D seul (100).
  IF pg_temp.points() <> 'a=97 b=95 c=100 d=100' THEN
    RAISE EXCEPTION 'R2 : division du score changée, points non recalculés : % (attendu a=97 b=95 c=100 d=100)', pg_temp.points();
  END IF;
  RAISE NOTICE 'R2 ok';
END $t$;

-- R3 : changement de statut.
UPDATE public.tournament_scores SET status = 'pending'
 WHERE athlete_id = '00000000-0000-4000-a840-00000000000d';
DO $t$
BEGIN
  IF pg_temp.points() <> 'a=97 b=95 c=100 d=0' THEN
    RAISE EXCEPTION 'R3 : changement de statut mal recalculé : %', pg_temp.points();
  END IF;
  RAISE NOTICE 'R3 ok';
END $t$;

-- R4 : changement de score.
UPDATE public.tournament_scores SET score_value = '130'
 WHERE athlete_id = '00000000-0000-4000-a840-00000000000b';
DO $t$
BEGIN
  IF pg_temp.points() <> 'a=95 b=100 c=97 d=0' THEN
    RAISE EXCEPTION 'R4 : changement de score mal recalculé : %', pg_temp.points();
  END IF;
  RAISE NOTICE 'R4 ok';
END $t$;

ROLLBACK;
\echo '    R1 à R4 OK'
