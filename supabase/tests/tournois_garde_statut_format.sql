-- ═════════════════════════════════════════════════════════════════════════════
-- Tournois : format figé, statut vers l'avant seulement (migration 20270126)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B, gérant O (…e0) ; athlètes A1, A2.
--   G1 changer le format est refusé, même hors rôle client ;
--   G2 open → active accepté (démarrage manuel par le gérant) ;
--   G3 active → open refusé ;
--   G4 completed → autre chose refusé ;
--   G5 passage direct à completed refusé, depuis open comme depuis active, et
--      même avec le réglage de clôture posé pour un AUTRE tournoi ;
--   G6 la clôture dédiée (finalize_tournament_elo, par le gérant) clôt ;
--   G7 le cron (date passée) et l'ouverture d'un WOD démarrent toujours.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Tournois : format figé, statut vers l''avant'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9ac-0000000000' || s)::uuid FROM unnest(ARRAY['e0', '01', '02']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9ac-0000000000' || s)::uuid, 'gsf-' || s || '@test.invalid', 'gsf_' || s
  FROM unnest(ARRAY['e0', '01', '02']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9ac-000000000001', 'Box garde', 'GSF1', '00000000-0000-4000-a9ac-0000000000e0');
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b9ac-000000000001', ('00000000-0000-4000-a9ac-0000000000' || s)::uuid,
       CASE s WHEN 'e0' THEN 'owner' ELSE 'member' END, 'active'
  FROM unnest(ARRAY['e0', '01', '02']) s;

-- T1 bracket open ; T2 open ; T3 active ; T4 completed ; T5 open ; T6 active
-- (clôturé par la vraie clôture) ; T7 open, date passée ; T8 open (WOD).
INSERT INTO public.tournaments (id, name, level, format, box_id, status, start_date)
SELECT ('00000000-0000-4000-c9ac-00000000000' || k)::uuid, 'G' || k, 'rx', f,
       '00000000-0000-4000-b9ac-000000000001', st, d
  FROM (VALUES ('1', 'bracket', 'open', NULL::timestamptz), ('2', 'simple', 'open', NULL), ('3', 'simple', 'active', NULL),
               ('4', 'simple', 'completed', NULL), ('5', 'simple', 'open', NULL), ('6', 'simple', 'active', NULL),
               ('7', 'simple', 'open', now() - interval '3 days'), ('8', 'simple', 'open', NULL)) v(k, f, st, d);

-- T6 : deux scores validés, prêts pour la clôture.
INSERT INTO public.tournament_participants (tournament_id, athlete_id) VALUES
  ('00000000-0000-4000-c9ac-000000000006', '00000000-0000-4000-a9ac-000000000001'),
  ('00000000-0000-4000-c9ac-000000000006', '00000000-0000-4000-a9ac-000000000002');
INSERT INTO public.tournament_wods (id, tournament_id, title, type, status) VALUES
  ('00000000-0000-4000-f9ac-000000000006', '00000000-0000-4000-c9ac-000000000006', 'WOD G6', 'For Time', 'closed');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c9ac-000000000006', '00000000-0000-4000-f9ac-000000000006', '00000000-0000-4000-a9ac-000000000001', '300', 'validated'),
  ('00000000-0000-4000-c9ac-000000000006', '00000000-0000-4000-f9ac-000000000006', '00000000-0000-4000-a9ac-000000000002', '400', 'validated');

-- Sans identité : ni utilisateur, ni rôle client (comme le cron ou la clé serveur).
CREATE FUNCTION pg_temp.sans_identite() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('role', 'none', true);
END $$;
-- Une mise à jour, sous l'identité du gérant ou sans (NULL) : l'erreur, ou OK.
CREATE FUNCTION pg_temp.maj(p_gerant boolean, p_tournoi text, p_set text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK';
BEGIN
  IF p_gerant THEN
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9ac-0000000000e0', true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  ELSE
    PERFORM pg_temp.sans_identite();
  END IF;
  BEGIN
    EXECUTE format('UPDATE public.tournaments SET %s WHERE id = %L', p_set, '00000000-0000-4000-c9ac-00000000000' || p_tournoi);
  EXCEPTION WHEN OTHERS THEN v := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  RETURN v;
END $$;
CREATE FUNCTION pg_temp.statut(p_tournoi text) RETURNS text LANGUAGE sql AS $$
  SELECT status FROM public.tournaments WHERE id = ('00000000-0000-4000-c9ac-00000000000' || p_tournoi)::uuid
$$;

DO $t$
DECLARE v text;
BEGIN
  -- G1 : format figé, par le gérant comme hors rôle client.
  v := pg_temp.maj(true, '1', 'format = ''simple''');
  IF v NOT LIKE 'FORMAT_FIGE%' THEN RAISE EXCEPTION 'G1 : changement de format par le gérant : %', v; END IF;
  v := pg_temp.maj(false, '1', 'format = ''swiss''');
  IF v NOT LIKE 'FORMAT_FIGE%' THEN RAISE EXCEPTION 'G1 : changement de format hors rôle client : %', v; END IF;

  -- G2 : démarrage manuel par le gérant.
  v := pg_temp.maj(true, '2', 'status = ''active''');
  IF v <> 'OK' OR pg_temp.statut('2') <> 'active' THEN RAISE EXCEPTION 'G2 : open → active refusé : %', v; END IF;

  -- G3 : pas de retour aux inscriptions.
  v := pg_temp.maj(true, '3', 'status = ''open''');
  IF v NOT LIKE 'STATUT_RECUL%' THEN RAISE EXCEPTION 'G3 : active → open : %', v; END IF;

  -- G4 : un tournoi clôturé ne bouge plus.
  v := pg_temp.maj(false, '4', 'status = ''active''');
  IF v NOT LIKE 'TOURNOI_CLOTURE%' THEN RAISE EXCEPTION 'G4 : completed → active : %', v; END IF;
  v := pg_temp.maj(false, '4', 'status = ''open''');
  IF v NOT LIKE 'TOURNOI_CLOTURE%' THEN RAISE EXCEPTION 'G4 : completed → open : %', v; END IF;

  -- G5 : pas de clôture par mise à jour directe.
  v := pg_temp.maj(true, '5', 'status = ''completed''');
  IF v NOT LIKE 'CLOTURE_DEDIEE%' THEN RAISE EXCEPTION 'G5 : open → completed direct : %', v; END IF;
  v := pg_temp.maj(false, '3', 'status = ''completed''');
  IF v NOT LIKE 'CLOTURE_DEDIEE%' THEN RAISE EXCEPTION 'G5 : active → completed direct : %', v; END IF;
  PERFORM set_config('athlex.cloture_tournoi', '00000000-0000-4000-c9ac-000000000006', true);
  v := pg_temp.maj(false, '3', 'status = ''completed''');
  PERFORM set_config('athlex.cloture_tournoi', '', true);
  IF v NOT LIKE 'CLOTURE_DEDIEE%' THEN RAISE EXCEPTION 'G5 : le réglage d''un autre tournoi a ouvert la clôture : %', v; END IF;

  -- G6 : la clôture dédiée, par le gérant.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9ac-0000000000e0', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    PERFORM public.finalize_tournament_elo('00000000-0000-4000-c9ac-000000000006');
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'none', true);
    RAISE EXCEPTION 'G6 : la clôture dédiée échoue : %', SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  IF pg_temp.statut('6') <> 'completed' THEN RAISE EXCEPTION 'G6 : la clôture dédiée n''a pas clôturé'; END IF;

  -- G7 : cron (date passée) et ouverture d'un WOD.
  PERFORM pg_temp.sans_identite();
  BEGIN
    PERFORM public.sync_tournament_activation();
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'G7 : le cron échoue : %', SQLERRM;
  END;
  IF pg_temp.statut('7') <> 'active' THEN RAISE EXCEPTION 'G7 : le cron ne démarre plus un tournoi à sa date'; END IF;
  BEGIN
    INSERT INTO public.tournament_wods (tournament_id, title, type, status) VALUES
      ('00000000-0000-4000-c9ac-000000000008', 'WOD G8', 'AMRAP', 'active');
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'G7 : l''ouverture d''un WOD échoue : %', SQLERRM;
  END;
  IF pg_temp.statut('8') <> 'active' THEN RAISE EXCEPTION 'G7 : l''ouverture d''un WOD ne démarre plus le tournoi'; END IF;
END $t$;

ROLLBACK;
\echo '    G1 à G7 OK'
