-- ═════════════════════════════════════════════════════════════════════════════
-- Tournois : démarrage à la date ; inscriptions pendant le tournoi (migration 20270125)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B : gérant O (…e0, le staff) ; athlètes A1 à A9, membres ; X, hors box.
-- Démarrage (D1 à D8), par le cron (`sync_tournament_activation`) ou le
-- déclencheur de WOD :
--   D1 date hier → démarre ;           D2 date aujourd'hui 23:59 à Paris → démarre (00:00 compte) ;
--   D3 date demain 00:30 à Paris → reste « open » (piège une date lue en UTC) ;
--   D4 date hier, archivé → reste « open » ;
--   D5 sans date, WOD actif ouvert, vu par le cron seul → démarre ;
--   D6 date demain, WOD ouvert maintenant → démarre au WOD ;
--   D7 archivé, WOD ouvert → reste « open » ;   D8 sans date ni WOD → reste « open ».
-- Inscriptions (l'athlète s'inscrit lui-même, sauf mention « staff ») :
--   I1 démarré sans l'option : refusée ; le staff ajoute quand même ;
--   I2 classique avec l'option : acceptée ; score refusé sur le WOD fermé,
--      accepté sur le WOD en cours ; 0 point sur le WOD passé ;
--   I3 tableau avec l'option : acceptée avant le tirage, refusée après ;
--   I4 ligue avec l'option : acceptée et placée dans la division la plus
--      basse tant qu'elle a de la place, refusée quand elle est pleine ;
--      l'ajout du staff dans une division pleine n'est placé nulle part ;
--   I5 tournoi archivé : refusée, staff compris ;
--   I6 max_participants : refusée à l'athlète ; le staff ajoute quand même ;
--      hors de la box : refusée.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Tournois : démarrage à la date, inscriptions pendant le tournoi'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9aa-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0', '01', '02', '03', '04', '05', '06', '07', '08', '09', 'ff']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9aa-0000000000' || s)::uuid, 'dem-' || s || '@test.invalid', 'dem_' || s
  FROM unnest(ARRAY['e0', '01', '02', '03', '04', '05', '06', '07', '08', '09', 'ff']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9aa-000000000001', 'Box démarrage', 'DEM1', '00000000-0000-4000-a9aa-0000000000e0');
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b9aa-000000000001', ('00000000-0000-4000-a9aa-0000000000' || s)::uuid,
       CASE s WHEN 'e0' THEN 'owner' ELSE 'member' END, 'active'
  FROM unnest(ARRAY['e0', '01', '02', '03', '04', '05', '06', '07', '08', '09']) s;

-- Démarrage : D1 à D8 (…c9aa…01 à …08), tous « open » au départ.
INSERT INTO public.tournaments (id, name, level, format, box_id, status, start_date, archived_at)
SELECT ('00000000-0000-4000-c9aa-0000000000' || k)::uuid, 'D' || k, 'rx', 'simple',
       '00000000-0000-4000-b9aa-000000000001', 'open', d, a
  FROM (VALUES
    ('01', (((now() AT TIME ZONE 'Europe/Paris')::date - 1) + time '20:00') AT TIME ZONE 'Europe/Paris', NULL::timestamptz),
    ('02', (((now() AT TIME ZONE 'Europe/Paris')::date)     + time '23:59') AT TIME ZONE 'Europe/Paris', NULL),
    ('03', (((now() AT TIME ZONE 'Europe/Paris')::date + 1) + time '00:30') AT TIME ZONE 'Europe/Paris', NULL),
    ('04', (((now() AT TIME ZONE 'Europe/Paris')::date - 1) + time '20:00') AT TIME ZONE 'Europe/Paris', now()),
    ('05', NULL, NULL),
    ('06', (((now() AT TIME ZONE 'Europe/Paris')::date + 1) + time '00:00') AT TIME ZONE 'Europe/Paris', NULL),
    ('07', NULL, now()),
    ('08', NULL, NULL)) v(k, d, a);

-- D5 : un WOD ouvert que seul le cron verra (le déclencheur est suspendu
-- pour cet insert, comme un WOD programmé dont l'heure est arrivée).
ALTER TABLE public.tournament_wods DISABLE TRIGGER trg_tournament_wod_activation;
INSERT INTO public.tournament_wods (tournament_id, title, type, status, opens_at) VALUES
  ('00000000-0000-4000-c9aa-000000000005', 'WOD D5', 'AMRAP', 'active', now() - interval '1 hour');
ALTER TABLE public.tournament_wods ENABLE TRIGGER trg_tournament_wod_activation;
-- D6, D7 : un WOD ouvert maintenant, par le chemin normal.
INSERT INTO public.tournament_wods (tournament_id, title, type, status) VALUES
  ('00000000-0000-4000-c9aa-000000000006', 'WOD D6', 'AMRAP', 'active'),
  ('00000000-0000-4000-c9aa-000000000007', 'WOD D7', 'AMRAP', 'active');

-- Inscriptions : T10 à T15 (…c9aa…10 à …15).
INSERT INTO public.tournaments (id, name, level, format, box_id, status, registrations_open_during_tournament, max_participants, archived_at)
SELECT ('00000000-0000-4000-c9aa-0000000000' || k)::uuid, 'T' || k, 'rx', f,
       '00000000-0000-4000-b9aa-000000000001', st, opt, coalesce(mx, 100), a
  FROM (VALUES
    ('10', 'simple',     'active', false, NULL::int, NULL::timestamptz),
    ('11', 'simple',     'active', true,  NULL,      NULL),
    ('12', 'bracket',    'active', true,  NULL,      NULL),
    ('13', 'league_div', 'active', true,  NULL,      NULL),
    ('14', 'simple',     'open',   true,  NULL,      now()),
    ('15', 'simple',     'open',   false, 1,         NULL)) v(k, f, st, opt, mx, a);

-- T11 : W1 fermé (A3 y a un score validé), W2 en cours.
INSERT INTO public.tournament_wods (id, tournament_id, title, type, status) VALUES
  ('00000000-0000-4000-f9aa-000000000001', '00000000-0000-4000-c9aa-000000000011', 'W1', 'For Time', 'closed'),
  ('00000000-0000-4000-f9aa-000000000002', '00000000-0000-4000-c9aa-000000000011', 'W2', 'For Time', 'active');
INSERT INTO public.tournament_participants (tournament_id, athlete_id) VALUES
  ('00000000-0000-4000-c9aa-000000000011', '00000000-0000-4000-a9aa-000000000003');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c9aa-000000000011', '00000000-0000-4000-f9aa-000000000001', '00000000-0000-4000-a9aa-000000000003', '300', 'validated');

-- T13 : Élite (niveau 1, 10 places) et Base (niveau 2, 2 places), A6 déjà en Base.
INSERT INTO public.tournament_divisions (id, tournament_id, name, level, max_members) VALUES
  ('00000000-0000-4000-e9aa-000000000001', '00000000-0000-4000-c9aa-000000000013', 'Élite', 1, 10),
  ('00000000-0000-4000-e9aa-000000000002', '00000000-0000-4000-c9aa-000000000013', 'Base',  2, 2);
INSERT INTO public.tournament_participants (tournament_id, athlete_id) VALUES
  ('00000000-0000-4000-c9aa-000000000013', '00000000-0000-4000-a9aa-000000000006');

-- T15 : complet (1 place, A9 inscrit).
INSERT INTO public.tournament_participants (tournament_id, athlete_id) VALUES
  ('00000000-0000-4000-c9aa-000000000015', '00000000-0000-4000-a9aa-000000000009');

-- Un geste fait sous l'identité de `qui` : l'erreur éventuelle, ou OK.
CREATE FUNCTION pg_temp.en_tant_que(p_qui text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9aa-0000000000' || p_qui, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
END $$;
CREATE FUNCTION pg_temp.inscrire(p_qui text, p_athlete text, p_tournoi text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK';
BEGIN
  PERFORM pg_temp.en_tant_que(p_qui);
  BEGIN
    INSERT INTO public.tournament_participants (tournament_id, athlete_id)
    VALUES (('00000000-0000-4000-c9aa-0000000000' || p_tournoi)::uuid, ('00000000-0000-4000-a9aa-0000000000' || p_athlete)::uuid);
  EXCEPTION WHEN OTHERS THEN v := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  RETURN v;
END $$;
CREATE FUNCTION pg_temp.scorer(p_qui text, p_tournoi text, p_wod text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK';
BEGIN
  PERFORM pg_temp.en_tant_que(p_qui);
  BEGIN
    INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
    VALUES (('00000000-0000-4000-c9aa-0000000000' || p_tournoi)::uuid, ('00000000-0000-4000-f9aa-0000000000' || p_wod)::uuid,
            ('00000000-0000-4000-a9aa-0000000000' || p_qui)::uuid, '250', 'pending');
  EXCEPTION WHEN OTHERS THEN v := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  RETURN v;
END $$;
CREATE FUNCTION pg_temp.statut(p_tournoi text) RETURNS text LANGUAGE sql AS $$
  SELECT status FROM public.tournaments WHERE id = ('00000000-0000-4000-c9aa-0000000000' || p_tournoi)::uuid
$$;
CREATE FUNCTION pg_temp.division(p_athlete text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(d.name || '/' || m.placement, ','), 'aucune')
    FROM public.tournament_division_members m JOIN public.tournament_divisions d ON d.id = m.division_id
   WHERE d.tournament_id = '00000000-0000-4000-c9aa-000000000013'
     AND m.athlete_id = ('00000000-0000-4000-a9aa-0000000000' || p_athlete)::uuid
$$;

DO $t$
DECLARE v text;
BEGIN
  -- D6 : le WOD ouvert a démarré le tournoi, avant sa date.
  IF pg_temp.statut('06') <> 'active' THEN RAISE EXCEPTION 'D6 : le premier WOD ouvert ne démarre pas le tournoi'; END IF;
  IF pg_temp.statut('07') <> 'open' THEN RAISE EXCEPTION 'D7 : un tournoi archivé a démarré à l''ouverture d''un WOD'; END IF;
  IF pg_temp.statut('05') <> 'open' THEN RAISE EXCEPTION 'décor : D5 a démarré avant le passage du cron'; END IF;

  PERFORM public.sync_tournament_activation();
  IF pg_temp.statut('01') <> 'active' THEN RAISE EXCEPTION 'D1 : un tournoi dont la date est passée n''a pas démarré'; END IF;
  IF pg_temp.statut('02') <> 'active' THEN RAISE EXCEPTION 'D2 : le tournoi du jour n''a pas démarré à 00:00 (heure de Paris)'; END IF;
  IF pg_temp.statut('03') <> 'open' THEN RAISE EXCEPTION 'D3 : un tournoi a démarré avant sa date (heure de Paris)'; END IF;
  IF pg_temp.statut('04') <> 'open' THEN RAISE EXCEPTION 'D4 : un tournoi archivé a démarré à sa date'; END IF;
  IF pg_temp.statut('05') <> 'active' THEN RAISE EXCEPTION 'D5 : le cron ne démarre pas un tournoi au premier WOD ouvert'; END IF;
  IF pg_temp.statut('08') <> 'open' THEN RAISE EXCEPTION 'D8 : un tournoi sans date ni WOD a démarré'; END IF;

  -- I1 : démarré, option décochée.
  v := pg_temp.inscrire('01', '01', '10');
  IF v NOT LIKE 'INSCRIPTIONS_FERMEES%' THEN RAISE EXCEPTION 'I1 : inscription après le démarrage sans l''option : %', v; END IF;
  v := pg_temp.inscrire('e0', '01', '10');
  IF v <> 'OK' THEN RAISE EXCEPTION 'I1 : le staff ne peut plus ajouter un participant : %', v; END IF;

  -- I2 : classique avec l'option.
  v := pg_temp.inscrire('02', '02', '11');
  IF v <> 'OK' THEN RAISE EXCEPTION 'I2 : inscription refusée pendant un classique ouvert aux inscriptions : %', v; END IF;
  v := pg_temp.scorer('02', '11', '01');
  IF v = 'OK' THEN RAISE EXCEPTION 'I2 : l''inscrit tardif a déposé un score sur un WOD fermé'; END IF;
  v := pg_temp.scorer('02', '11', '02');
  IF v <> 'OK' THEN RAISE EXCEPTION 'I2 : l''inscrit tardif ne peut pas scorer le WOD en cours : %', v; END IF;
  IF (SELECT points FROM public.tournament_classique_standings('00000000-0000-4000-c9aa-000000000011')
       WHERE athlete_id = '00000000-0000-4000-a9aa-000000000002') IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'I2 : l''inscrit tardif n''a pas 0 point sur le WOD passé';
  END IF;

  -- I3 : tableau avec l'option.
  v := pg_temp.inscrire('04', '04', '12');
  IF v <> 'OK' THEN RAISE EXCEPTION 'I3 : inscription refusée avant le tirage : %', v; END IF;
  INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, status) VALUES
    ('00000000-0000-4000-c9aa-000000000012', 1, 1, 'winner', '00000000-0000-4000-a9aa-000000000004', '00000000-0000-4000-a9aa-000000000003', 'pending');
  v := pg_temp.inscrire('05', '05', '12');
  IF v NOT LIKE 'TABLEAU_DEJA_TIRE%' THEN RAISE EXCEPTION 'I3 : inscription après le tirage : %', v; END IF;

  -- I4 : ligue avec l'option.
  IF pg_temp.division('06') <> 'Base/auto' THEN RAISE EXCEPTION 'décor : A6 n''est pas en Base (%)', pg_temp.division('06'); END IF;
  v := pg_temp.inscrire('07', '07', '13');
  IF v <> 'OK' OR pg_temp.division('07') <> 'Base/auto' THEN
    RAISE EXCEPTION 'I4 : inscription en ligue : %, placé : %', v, pg_temp.division('07');
  END IF;
  v := pg_temp.inscrire('08', '08', '13');
  IF v NOT LIKE 'DIVISION_PLEINE%' THEN RAISE EXCEPTION 'I4 : inscription dans une division d''entrée pleine : %', v; END IF;
  v := pg_temp.inscrire('e0', '08', '13');
  IF v <> 'OK' OR pg_temp.division('08') <> 'aucune' THEN
    RAISE EXCEPTION 'I4 : ajout du staff dans une ligue pleine : %, placé : % (attendu : nulle part)', v, pg_temp.division('08');
  END IF;

  -- I5 : archivé, staff compris.
  v := pg_temp.inscrire('09', '09', '14');
  IF v NOT LIKE 'TOURNOI_ARCHIVE%' THEN RAISE EXCEPTION 'I5 : inscription sur un tournoi archivé : %', v; END IF;
  v := pg_temp.inscrire('e0', '09', '14');
  IF v NOT LIKE 'TOURNOI_ARCHIVE%' THEN RAISE EXCEPTION 'I5 : ajout du staff sur un tournoi archivé : %', v; END IF;

  -- I6 : complet ; hors box.
  v := pg_temp.inscrire('01', '01', '15');
  IF v NOT LIKE 'TOURNOI_COMPLET%' THEN RAISE EXCEPTION 'I6 : inscription au-delà de max_participants : %', v; END IF;
  v := pg_temp.inscrire('e0', '01', '15');
  IF v <> 'OK' THEN RAISE EXCEPTION 'I6 : le staff ne peut plus ajouter au-delà du maximum : %', v; END IF;
  v := pg_temp.inscrire('ff', 'ff', '11');
  IF v NOT LIKE 'HORS_BOX%' THEN RAISE EXCEPTION 'I6 : inscription hors de la box : %', v; END IF;
END $t$;

ROLLBACK;
\echo '    D1 à D8, I1 à I6 OK'
