-- ═════════════════════════════════════════════════════════════════════════════
-- L'argent relève du gérant, pas du coach (migration 20270131)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box abonnée S : gérant G1 (…e0), co-gérant C1 (…e1), coach K1 (…e2), membres
-- M1 (…e3, auteur d'une demande de résiliation) et M2 (…e4, en impayé).
-- Box éditrice P : gérant G2 (…e5), coach K2 (…e6). X (…e7) n'est nulle part.
-- Offres gratuites O1 et O2 de P ; S est abonnée à O1.
--   R1  demandes de résiliation, lecture : K1 et X ne voient rien ; G1, C1 et
--       l'auteur M1 voient la demande ;
--   R2  demandes de résiliation, traitement : K1 ne change rien ; G1 et C1
--       traitent ; R2b : même avec une lecture ouverte à tous, K1 ne traite
--       pas (la règle de mise à jour tient seule) ;
--   A1  abonnements, lecture côté abonné : K1, G1 et C1 lisent l'abonnement de
--       S (couleur de /wods) ;
--   A2  abonnements, lecture côté éditeur : K2 ne voit pas les boxes qui
--       achètent O1 ; G2 les voit ;
--   A3  abonnements, écriture : K1 ne modifie, ne supprime ni ne crée rien ;
--       G1 et C1 modifient ;
--   A4  `subscribe_free_programming` : K1 refusé (42501) ; G1 et C1 acceptés ;
--   A5  contenu des offres : K2 écrit toujours un WOD dans O1 ;
--   D1  `get_box_dunning` : K1, M1 et X refusés en 42501 ; G1 et C1 lisent
--       l'impayé de M2.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> L''argent relève du gérant, pas du coach'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9c0-0000000000' || s)::uuid FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9c0-0000000000' || s)::uuid, 'cag-' || s || '@test.invalid', 'cag_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9c0-000000000001', 'Box abonnee S', 'CAGS', '00000000-0000-4000-a9c0-0000000000e0'),
  ('00000000-0000-4000-b9c0-000000000002', 'Box editrice P', 'CAGP', '00000000-0000-4000-a9c0-0000000000e5');
INSERT INTO public.box_members (box_id, member_id, role, status, subscription_status, past_due_since) VALUES
  ('00000000-0000-4000-b9c0-000000000001', '00000000-0000-4000-a9c0-0000000000e1', 'owner',  'active', NULL, NULL),
  ('00000000-0000-4000-b9c0-000000000001', '00000000-0000-4000-a9c0-0000000000e2', 'coach',  'active', NULL, NULL),
  ('00000000-0000-4000-b9c0-000000000001', '00000000-0000-4000-a9c0-0000000000e3', 'member', 'active', 'active', NULL),
  ('00000000-0000-4000-b9c0-000000000001', '00000000-0000-4000-a9c0-0000000000e4', 'member', 'active', 'past_due', now() - interval '1 day'),
  ('00000000-0000-4000-b9c0-000000000002', '00000000-0000-4000-a9c0-0000000000e6', 'coach',  'active', NULL, NULL);
INSERT INTO public.box_programming (id, publisher_box_id, title, is_published) VALUES
  ('00000000-0000-4000-d9c0-000000000001', '00000000-0000-4000-b9c0-000000000002', 'Offre O1', true),
  ('00000000-0000-4000-d9c0-000000000002', '00000000-0000-4000-b9c0-000000000002', 'Offre O2', true);
INSERT INTO public.box_programming_subscriptions (id, programming_id, subscriber_box_id, status, color) VALUES
  ('00000000-0000-4000-e9c0-000000000001', '00000000-0000-4000-d9c0-000000000001', '00000000-0000-4000-b9c0-000000000001', 'active', 'sky');
INSERT INTO public.membership_cancellation_requests (id, box_id, member_id, reason_type, message) VALUES
  ('00000000-0000-4000-f9c0-000000000001', '00000000-0000-4000-b9c0-000000000001', '00000000-0000-4000-a9c0-0000000000e3', 'medical', 'Justificatif');

-- Exécute `p_sql` sous l'identité `p_qui` ; rend le résultat, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9c0-0000000000' || p_qui, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE p_sql INTO v;
    v := coalesce(v, 'OK');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN v;
END $$;

DO $t$
DECLARE
  v text;
  v_qui text;
  DEM constant text := 'SELECT count(*)::text FROM public.membership_cancellation_requests WHERE id = ''00000000-0000-4000-f9c0-000000000001''';
  ABO_S constant text := 'SELECT count(*)::text FROM public.box_programming_subscriptions WHERE subscriber_box_id = ''00000000-0000-4000-b9c0-000000000001'' AND color = ''sky''';
  ACHETEURS constant text := 'SELECT count(*)::text FROM public.box_programming_subscriptions WHERE programming_id = ''00000000-0000-4000-d9c0-000000000001''';
  DUNNING constant text := 'SELECT count(*)::text FROM public.get_box_dunning(''00000000-0000-4000-b9c0-000000000001'')';
BEGIN
  -- R1 : lecture des demandes de résiliation.
  FOREACH v_qui IN ARRAY ARRAY['e2', 'e7'] LOOP
    v := pg_temp.faire(v_qui, DEM);
    IF v <> '0' THEN RAISE EXCEPTION 'R1 : % lit la demande de résiliation (%)', v_qui, v; END IF;
  END LOOP;
  FOREACH v_qui IN ARRAY ARRAY['e0', 'e1', 'e3'] LOOP
    v := pg_temp.faire(v_qui, DEM);
    IF v <> '1' THEN RAISE EXCEPTION 'R1 : % ne lit pas la demande de résiliation (%)', v_qui, v; END IF;
  END LOOP;

  -- R2 : traitement.
  v := pg_temp.faire('e2', 'WITH m AS (UPDATE public.membership_cancellation_requests SET status = ''approved'' WHERE id = ''00000000-0000-4000-f9c0-000000000001'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '0' OR (SELECT status FROM public.membership_cancellation_requests WHERE id = '00000000-0000-4000-f9c0-000000000001') <> 'pending' THEN
    RAISE EXCEPTION 'R2 : le coach a traité la demande (%)', v;
  END IF;
  v := pg_temp.faire('e1', 'WITH m AS (UPDATE public.membership_cancellation_requests SET review_note = ''vu'' WHERE id = ''00000000-0000-4000-f9c0-000000000001'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'R2 : le co-gérant ne traite pas la demande (%)', v; END IF;
  v := pg_temp.faire('e0', 'WITH m AS (UPDATE public.membership_cancellation_requests SET status = ''rejected'' WHERE id = ''00000000-0000-4000-f9c0-000000000001'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'R2 : le gérant ne traite pas la demande (%)', v; END IF;

  -- R2b : même s'il voyait la demande (lecture ouverte, dans la transaction),
  -- le coach ne la traite pas : la règle de mise à jour tient seule.
  CREATE POLICY zz_lecture_ouverte ON public.membership_cancellation_requests FOR SELECT TO authenticated USING (true);
  v := pg_temp.faire('e2', 'WITH m AS (UPDATE public.membership_cancellation_requests SET status = ''approved'' WHERE id = ''00000000-0000-4000-f9c0-000000000001'' RETURNING 1) SELECT count(*)::text FROM m');
  DROP POLICY zz_lecture_ouverte ON public.membership_cancellation_requests;
  IF v <> '0' THEN RAISE EXCEPTION 'R2b : le coach traite la demande quand il la voit (%)', v; END IF;

  -- A1 : lecture côté abonné (couleur des cartes reçues).
  FOREACH v_qui IN ARRAY ARRAY['e2', 'e0', 'e1'] LOOP
    v := pg_temp.faire(v_qui, ABO_S);
    IF v <> '1' THEN RAISE EXCEPTION 'A1 : % ne lit pas l''abonnement de sa box (%)', v_qui, v; END IF;
  END LOOP;

  -- A2 : lecture côté éditeur.
  v := pg_temp.faire('e6', ACHETEURS);
  IF v <> '0' THEN RAISE EXCEPTION 'A2 : le coach de l''éditrice voit les boxes qui achètent (%)', v; END IF;
  v := pg_temp.faire('e5', ACHETEURS);
  IF v <> '1' THEN RAISE EXCEPTION 'A2 : le gérant de l''éditrice ne voit pas les boxes qui achètent (%)', v; END IF;

  -- A3 : écriture.
  v := pg_temp.faire('e2', 'WITH m AS (UPDATE public.box_programming_subscriptions SET color = ''rose'', status = ''canceled'' WHERE id = ''00000000-0000-4000-e9c0-000000000001'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '0' THEN RAISE EXCEPTION 'A3 : le coach modifie un abonnement (%)', v; END IF;
  v := pg_temp.faire('e2', 'WITH m AS (DELETE FROM public.box_programming_subscriptions WHERE id = ''00000000-0000-4000-e9c0-000000000001'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '0' THEN RAISE EXCEPTION 'A3 : le coach supprime un abonnement (%)', v; END IF;
  v := pg_temp.faire('e2', 'WITH m AS (INSERT INTO public.box_programming_subscriptions (programming_id, subscriber_box_id, status) VALUES (''00000000-0000-4000-d9c0-000000000002'', ''00000000-0000-4000-b9c0-000000000001'', ''active'') RETURNING 1) SELECT count(*)::text FROM m');
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'A3 : le coach crée un abonnement (%)', v; END IF;
  IF (SELECT color || '/' || status FROM public.box_programming_subscriptions WHERE id = '00000000-0000-4000-e9c0-000000000001') <> 'sky/active' THEN
    RAISE EXCEPTION 'A3 : l''abonnement a bougé';
  END IF;
  v := pg_temp.faire('e0', 'WITH m AS (UPDATE public.box_programming_subscriptions SET color = ''rose'' WHERE id = ''00000000-0000-4000-e9c0-000000000001'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'A3 : le gérant ne modifie pas l''abonnement (%)', v; END IF;
  v := pg_temp.faire('e1', 'WITH m AS (UPDATE public.box_programming_subscriptions SET auto_apply_weekly = true WHERE id = ''00000000-0000-4000-e9c0-000000000001'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'A3 : le co-gérant ne modifie pas l''abonnement (%)', v; END IF;

  -- A4 : abonnement gratuit.
  v := pg_temp.faire('e2', 'SELECT public.subscribe_free_programming(''00000000-0000-4000-d9c0-000000000002'', ''00000000-0000-4000-b9c0-000000000001'')->>''status''');
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'A4 : le coach abonne sa box (%)', v; END IF;
  FOREACH v_qui IN ARRAY ARRAY['e0', 'e1'] LOOP
    v := pg_temp.faire(v_qui, 'SELECT public.subscribe_free_programming(''00000000-0000-4000-d9c0-000000000002'', ''00000000-0000-4000-b9c0-000000000001'')->>''status''');
    IF v <> 'active' THEN RAISE EXCEPTION 'A4 : % n''abonne pas sa box (%)', v_qui, v; END IF;
  END LOOP;

  -- A5 : le coach de l'éditrice écrit toujours le contenu d'une offre.
  v := pg_temp.faire('e6', 'WITH m AS (INSERT INTO public.box_programming_wods (programming_id, day_of_week, title) VALUES (''00000000-0000-4000-d9c0-000000000001'', 1, ''WOD du coach'') RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'A5 : le coach n''écrit plus le contenu de l''offre (%)', v; END IF;

  -- D1 : impayés.
  FOREACH v_qui IN ARRAY ARRAY['e2', 'e3', 'e7'] LOOP
    v := pg_temp.faire(v_qui, DUNNING);
    IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'D1 : % n''est pas refusé en 42501 sur get_box_dunning (%)', v_qui, v; END IF;
  END LOOP;
  FOREACH v_qui IN ARRAY ARRAY['e0', 'e1'] LOOP
    v := pg_temp.faire(v_qui, DUNNING);
    IF v <> '1' THEN RAISE EXCEPTION 'D1 : % ne lit pas l''impayé (%)', v_qui, v; END IF;
  END LOOP;
END $t$;

ROLLBACK;
\echo '    R1, R2, R2b, A1 à A5, D1 OK'
