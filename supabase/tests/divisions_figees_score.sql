-- ═════════════════════════════════════════════════════════════════════════════
-- Divisions figées au moment du WOD (migration 20270108)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Une ligue : Élite (A, B) et Open (C, D). WOD 1 en AMRAP, saison 1.
--   D1 la division est posée à l'insertion, d'après l'appartenance de l'instant ;
--   D2 une division envoyée par le client est ignorée ;
--   D3 C passe en Élite : son score du WOD 1 reste classé en Open — A garde
--      100 (l'ancienne logique reclassait C en Élite, devant A) ;
--   D4 un nouveau score de C, après son passage, est posé en Élite ;
--   D5 un athlète ne peut pas changer la division d'un score ; le gérant peut ;
--   D6 seuls les WOD de la saison en cours comptent ;
--   D7 un score antérieur à la règle (division vide) se classe dans la
--      division actuelle de l'athlète.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Divisions figées au moment du WOD'

BEGIN;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a800-000000000009'),
  ('00000000-0000-4000-a800-00000000000a'), ('00000000-0000-4000-a800-00000000000b'),
  ('00000000-0000-4000-a800-00000000000c'), ('00000000-0000-4000-a800-00000000000d');
INSERT INTO public.profiles (id, email, username) VALUES
  ('00000000-0000-4000-a800-000000000009', 'div-gerant@test.invalid', 'div_gerant'),
  ('00000000-0000-4000-a800-00000000000a', 'div-a@test.invalid', 'div_a'),
  ('00000000-0000-4000-a800-00000000000b', 'div-b@test.invalid', 'div_b'),
  ('00000000-0000-4000-a800-00000000000c', 'div-c@test.invalid', 'div_c'),
  ('00000000-0000-4000-a800-00000000000d', 'div-d@test.invalid', 'div_d');
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b800-000000000001', 'Box divisions', 'DIVF', '00000000-0000-4000-a800-000000000009');
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by) VALUES
  ('00000000-0000-4000-c800-000000000001', 'Ligue divisions', 'rx', 'league_div',
   '00000000-0000-4000-b800-000000000001', '00000000-0000-4000-a800-000000000009');
INSERT INTO public.tournament_divisions (id, tournament_id, name, level) VALUES
  ('00000000-0000-4000-e800-000000000001', '00000000-0000-4000-c800-000000000001', 'Élite', 1),
  ('00000000-0000-4000-e800-000000000002', '00000000-0000-4000-c800-000000000001', 'Open',  2);
INSERT INTO public.tournament_division_members (id, division_id, athlete_id) VALUES
  ('00000000-0000-4000-e800-00000000010a', '00000000-0000-4000-e800-000000000001', '00000000-0000-4000-a800-00000000000a'),
  ('00000000-0000-4000-e800-00000000010b', '00000000-0000-4000-e800-000000000001', '00000000-0000-4000-a800-00000000000b'),
  ('00000000-0000-4000-e800-00000000010c', '00000000-0000-4000-e800-000000000002', '00000000-0000-4000-a800-00000000000c'),
  ('00000000-0000-4000-e800-00000000010d', '00000000-0000-4000-e800-000000000002', '00000000-0000-4000-a800-00000000000d');
INSERT INTO public.tournament_wods (id, tournament_id, title, type, season_number) VALUES
  ('00000000-0000-4000-f800-000000000001', '00000000-0000-4000-c800-000000000001', 'WOD 1', 'AMRAP', 1),
  ('00000000-0000-4000-f800-000000000002', '00000000-0000-4000-c800-000000000001', 'WOD 2', 'AMRAP', 1);

-- Points de chaque athlète, lus sur sa ligne d'appartenance.
CREATE FUNCTION pg_temp.points() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(right(m.athlete_id::text, 1) || '=' || m.points::int, ' ' ORDER BY m.athlete_id)
    FROM public.tournament_division_members m JOIN public.tournament_divisions d ON d.id = m.division_id
   WHERE d.tournament_id = '00000000-0000-4000-c800-000000000001'
$$;
CREATE FUNCTION pg_temp.division(p_athlete text, p_wod text) RETURNS text LANGUAGE sql AS $$
  SELECT d.name FROM public.tournament_scores s JOIN public.tournament_divisions d ON d.id = s.division_id
   WHERE s.athlete_id = ('00000000-0000-4000-a800-00000000000' || p_athlete)::uuid
     AND s.tournament_wod_id = ('00000000-0000-4000-f800-00000000000' || p_wod)::uuid
$$;

-- WOD 1 : A 100, B 90 (Élite) ; C 120, D 80 (Open). C tente d'imposer l'Élite (D2).
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status, division_id) VALUES
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000001', '00000000-0000-4000-a800-00000000000a', '100', 'validated', NULL),
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000001', '00000000-0000-4000-a800-00000000000b', '90',  'validated', NULL),
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000001', '00000000-0000-4000-a800-00000000000c', '120', 'validated', '00000000-0000-4000-e800-000000000001'),
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000001', '00000000-0000-4000-a800-00000000000d', '80',  'validated', NULL);

DO $t$
BEGIN
  -- D1, D2
  IF pg_temp.division('a', '1') <> 'Élite' OR pg_temp.division('c', '1') <> 'Open' THEN
    RAISE EXCEPTION 'D1/D2 : divisions posées A=% C=% (attendu Élite, Open)', pg_temp.division('a', '1'), pg_temp.division('c', '1');
  END IF;
  IF pg_temp.points() <> 'a=100 b=97 c=100 d=97' THEN
    RAISE EXCEPTION 'D1 : points inattendus après le WOD 1 : %', pg_temp.points();
  END IF;

  -- D3 : C passe en Élite (déplacement du gérant), puis un recalcul a lieu.
  UPDATE public.tournament_division_members SET division_id = '00000000-0000-4000-e800-000000000001'
   WHERE id = '00000000-0000-4000-e800-00000000010c';
  UPDATE public.tournament_scores SET score_value = '91'
   WHERE athlete_id = '00000000-0000-4000-a800-00000000000b' AND tournament_wod_id = '00000000-0000-4000-f800-000000000001';
  IF pg_temp.points() <> 'a=100 b=97 c=100 d=97' THEN
    RAISE EXCEPTION 'D3 : le score de C a été reclassé dans sa nouvelle division : %', pg_temp.points();
  END IF;
  RAISE NOTICE 'D1–D3 ok';
END $t$;

-- D4 : WOD 2, C (désormais en Élite) 50, A 60.
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000002', '00000000-0000-4000-a800-00000000000c', '50', 'validated'),
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000002', '00000000-0000-4000-a800-00000000000a', '60', 'validated');
DO $t$
BEGIN
  IF pg_temp.division('c', '2') <> 'Élite' THEN
    RAISE EXCEPTION 'D4 : le score de C après son passage n''est pas posé en Élite (%)', pg_temp.division('c', '2');
  END IF;
  -- A 100 + 100, C 100 (Open) + 97 (Élite, derrière A).
  IF pg_temp.points() <> 'a=200 b=97 c=197 d=97' THEN
    RAISE EXCEPTION 'D4 : points inattendus après le WOD 2 : %', pg_temp.points();
  END IF;
  RAISE NOTICE 'D4 ok';
END $t$;

-- D5 : sur un score EN ATTENTE d'un WOD ouvert, l'athlète peut modifier son score
-- (la RLS le permet) mais pas sa division ; le gérant peut la corriger. C est en
-- Élite depuis D3 : son score est posé en Élite, et l'on tente de le passer en Open.
INSERT INTO public.tournament_wods (id, tournament_id, title, type, season_number, status) VALUES
  ('00000000-0000-4000-f800-000000000005', '00000000-0000-4000-c800-000000000001', 'WOD 5', 'AMRAP', 1, 'active');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000005', '00000000-0000-4000-a800-00000000000c', '30', 'pending');
SAVEPOINT avant_d5;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a800-00000000000c';
SET LOCAL request.jwt.claim.role = 'authenticated';
DO $t$
DECLARE n int; refuse boolean := false;
BEGIN
  IF (SELECT division_id FROM public.tournament_scores
       WHERE athlete_id = '00000000-0000-4000-a800-00000000000c'
         AND tournament_wod_id = '00000000-0000-4000-f800-000000000005') IS DISTINCT FROM '00000000-0000-4000-e800-000000000001' THEN
    RAISE EXCEPTION 'D5 : contre-exemple — le score en attente de C n''est pas posé en Élite';
  END IF;
  -- Contre-exemple : l'athlète peut bien modifier ce score.
  UPDATE public.tournament_scores SET score_value = '31'
   WHERE athlete_id = '00000000-0000-4000-a800-00000000000c'
     AND tournament_wod_id = '00000000-0000-4000-f800-000000000005';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'D5 : contre-exemple — l''athlète ne peut pas modifier son score en attente'; END IF;
  -- Mais pas sa division.
  BEGIN
    UPDATE public.tournament_scores SET division_id = '00000000-0000-4000-e800-000000000002'
     WHERE athlete_id = '00000000-0000-4000-a800-00000000000c'
       AND tournament_wod_id = '00000000-0000-4000-f800-000000000005';
  EXCEPTION WHEN insufficient_privilege THEN refuse := true;
  END;
  IF NOT refuse THEN RAISE EXCEPTION 'D5 : un athlète a changé la division de son score'; END IF;
END $t$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a800-000000000009';
UPDATE public.tournament_scores SET division_id = '00000000-0000-4000-e800-000000000002'
 WHERE athlete_id = '00000000-0000-4000-a800-00000000000c'
   AND tournament_wod_id = '00000000-0000-4000-f800-000000000005';
RESET ROLE;
DO $t$
BEGIN
  IF (SELECT division_id FROM public.tournament_scores
       WHERE athlete_id = '00000000-0000-4000-a800-00000000000c'
         AND tournament_wod_id = '00000000-0000-4000-f800-000000000005')
     IS DISTINCT FROM '00000000-0000-4000-e800-000000000002' THEN
    RAISE EXCEPTION 'D5 : le gérant n''a pas pu corriger la division d''un score';
  END IF;
  RAISE NOTICE 'D5 ok';
END $t$;
ROLLBACK TO SAVEPOINT avant_d5;

-- D6 : saison 2 — seuls ses WOD comptent.
UPDATE public.tournaments SET current_season = 2 WHERE id = '00000000-0000-4000-c800-000000000001';
INSERT INTO public.tournament_wods (id, tournament_id, title, type, season_number) VALUES
  ('00000000-0000-4000-f800-000000000003', '00000000-0000-4000-c800-000000000001', 'WOD 3', 'AMRAP', 2);
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000003', '00000000-0000-4000-a800-00000000000d', '10', 'validated');
DO $t$
BEGIN
  IF pg_temp.points() <> 'a=0 b=0 c=0 d=100' THEN
    RAISE EXCEPTION 'D6 : des WOD d''une saison passée comptent encore : %', pg_temp.points();
  END IF;
  RAISE NOTICE 'D6 ok';
END $t$;

-- D7 : un score sans division (antérieur à la règle) suit l'appartenance actuelle,
-- et se classe AVEC les scores de cette division. A (Élite) 30 ; puis B (Élite,
-- sans division) 20 : B doit être 2e de l'Élite, pas seul dans un groupe à part.
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000003', '00000000-0000-4000-a800-00000000000a', '30', 'validated');
ALTER TABLE public.tournament_scores DISABLE TRIGGER trg_tournament_scores_division;
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status, division_id) VALUES
  ('00000000-0000-4000-c800-000000000001', '00000000-0000-4000-f800-000000000003', '00000000-0000-4000-a800-00000000000b', '20', 'validated', NULL);
ALTER TABLE public.tournament_scores ENABLE TRIGGER trg_tournament_scores_division;
DO $t$
BEGIN
  -- Élite : A 100, B 97 ; Open : D 100.
  IF pg_temp.points() <> 'a=100 b=97 c=0 d=100' THEN
    RAISE EXCEPTION 'D7 : un score sans division n''a pas suivi l''appartenance actuelle : %', pg_temp.points();
  END IF;
  RAISE NOTICE 'D7 ok';
END $t$;

ROLLBACK;
\echo '    ok'
