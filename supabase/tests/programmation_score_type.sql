-- ═════════════════════════════════════════════════════════════════════════════
-- WOD d'offre Marketplace : type de score et texte libre recopiés à chaque copie
-- (nbstyle69/AthleX-Manager#453, PR 1c, migration 20270165)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (la migration et son retour arrière sont rejoués par \i).
-- Gérant G (…01) de la box éditrice P et de la box abonnée S. Semaine du
-- 07/01/2030 dans P : WOD 1 « Temps » en texte libre, WOD 2 « Sans score » en
-- texte libre (sans classement), WOD 3 sans type, en lignes.
--   D0  définitions figées : les six fonctions de copie et le déclencheur de
--       propagation (md5), droits et options inchangés ;
--   T   colonnes et contraintes de box_programming_wods (mêmes règles que
--       box_wods) ; un WOD d'offre écrit sans les colonnes reste NULL / 'lines' ;
--   C1  sync_wod_to_offer : insertion, puis mise à jour (ON CONFLICT) ;
--   C2  propagation d'un WOD maison vers sa copie d'offre quand seul son type,
--       ou seul son mode, change ;
--   C3  copy_week_to_offer depuis la semaine de la box ;
--   C4  save_week_as_template (semaine type) ;
--   C5  copy_week_to_offer depuis une semaine type (offre → offre) ;
--   C6  apply_program_week depuis une semaine type et depuis un abonnement ;
--   C7  materialize_box_programming (pose automatique de l'abonnement) ;
--   R   retour arrière : définitions d'avant (md5) et colonnes retirées ; la
--       migration rejouée redonne les mêmes empreintes.
-- Chaque chemin : le WOD typé arrive typé et en texte libre, le WOD « Sans
-- score » arrive sans score et sans classement, le WOD sans type reste
-- NULL / 'lines'.
-- Mutations : jouées localement sans D0 ni R (liste et résultat dans la PR) ;
-- chacune fait échouer ce fichier. Tout est joué dans une transaction annulée.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> WOD d''offre : type de score et texte libre recopiés (20270165)'

BEGIN;

CREATE FUNCTION pg_temp.u(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a465-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.b(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-b465-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.w(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-c465-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.o(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-d465-0000000000' || s)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.b(text), pg_temp.w(text), pg_temp.o(text) TO PUBLIC; -- appelées sous authenticated

INSERT INTO auth.users (id) VALUES (pg_temp.u('01'));
INSERT INTO public.profiles (id, email, username) VALUES (pg_temp.u('01'), 'pst-01@test.invalid', 'pst_01');
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  (pg_temp.b('aa'), 'Box P', 'PST65P', pg_temp.u('01')),
  (pg_temp.b('bb'), 'Box S', 'PST65S', pg_temp.u('01'));
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  (pg_temp.b('aa'), pg_temp.u('01'), 'owner', 'active'),
  (pg_temp.b('bb'), pg_temp.u('01'), 'owner', 'active');
INSERT INTO public.box_wods (id, box_id, created_by, title, wod_type, scheduled_date, sort_order, score_type, text_mode, leaderboard_enabled) VALUES
  (pg_temp.w('01'), pg_temp.b('aa'), pg_temp.u('01'), 'WOD 1', 'for_time', DATE '2030-01-07', 0, 'time', 'free', true),
  (pg_temp.w('02'), pg_temp.b('aa'), pg_temp.u('01'), 'WOD 2', 'custom',   DATE '2030-01-08', 0, 'none', 'free', false),
  (pg_temp.w('03'), pg_temp.b('aa'), pg_temp.u('01'), 'WOD 3', 'amrap',    DATE '2030-01-09', 0, NULL,   'lines', true);
-- Offres de P : O1 (2 semaines, abonnée par S), O2, O3.
INSERT INTO public.box_programming (id, publisher_box_id, title, weeks_count, is_published) VALUES
  (pg_temp.o('01'), pg_temp.b('aa'), 'Offre O1', 2, true),
  (pg_temp.o('02'), pg_temp.b('aa'), 'Offre O2', 1, true),
  (pg_temp.o('03'), pg_temp.b('aa'), 'Offre O3', 1, true);

-- Exécute comme le vrai client (authenticated + auth.uid()), effet GARDÉ.
CREATE FUNCTION pg_temp.faire(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK'; r text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', pg_temp.u('01')::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE p_sql INTO r;
    v := 'OK ' || coalesce(r, 'NULL');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN v;
END $$;
CREATE FUNCTION pg_temp.attendu(p_cas text, p_obtenu text, p_prefixe text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtenu IS NULL OR p_obtenu NOT LIKE p_prefixe || '%' THEN
    RAISE EXCEPTION '% : obtenu « % », attendu « %… »', p_cas, p_obtenu, p_prefixe;
  END IF;
END $$;
CREATE FUNCTION pg_temp.egal(p_cas text, p_obtenu text, p_attendu text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtenu IS DISTINCT FROM p_attendu THEN
    RAISE EXCEPTION '% : obtenu « % », attendu « % »', p_cas, p_obtenu, p_attendu;
  END IF;
END $$;
-- « titre:type/mode/classement » des WODs d'une offre (ou d'une semaine), triés.
CREATE FUNCTION pg_temp.offre(p_prog uuid, p_semaine int DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(title || ':' || coalesce(score_type, 'NULL') || '/' || text_mode || '/' || leaderboard_enabled,
                             ',' ORDER BY title), '')
    FROM public.box_programming_wods
   WHERE programming_id = p_prog AND (p_semaine IS NULL OR week_number = p_semaine);
$$;
-- Idem pour les WODs posés dans une box sur la semaine du lundi donné.
CREATE FUNCTION pg_temp.box(p_box uuid, p_lundi date) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(title || ':' || coalesce(score_type, 'NULL') || '/' || text_mode || '/' || leaderboard_enabled,
                             ',' ORDER BY title), '')
    FROM public.box_wods
   WHERE box_id = p_box AND scheduled_date >= p_lundi AND scheduled_date < p_lundi + 7;
$$;
-- Ce que chaque chemin doit produire.
CREATE FUNCTION pg_temp.trois() RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'WOD 1:time/free/true,WOD 2:none/free/false,WOD 3:NULL/lines/true'
$$;

-- ── D0 : définitions figées ──────────────────────────────────────────────────
DO $t$
DECLARE
  f record;
BEGIN
  FOR f IN SELECT * FROM (VALUES
    ('public.sync_wod_to_offer(uuid, uuid, integer)', '6bc07a9b3a6aac8979098d5882337d3a', true),
    ('public.copy_week_to_offer(text, uuid, date, uuid, uuid, integer, boolean)', '5044d180c24de58a8b4ea369ffbe6c1c', true),
    ('public.box_wods_propagate_to_offer()', '8e97ee37f5c50a005fb0e1fe055f4e46', true),
    ('public.save_week_as_template(uuid, date, text, uuid)', '941f0a50e4ee9d4bc88a50b4248cce15', true),
    ('public.apply_program_week(text, uuid, integer, date, text, uuid[], boolean)', '109707e9011fdf12fed622af2535cf34', true),
    ('public.materialize_box_programming(date)', '551cf5ab3ee4c72b804d873aee174c2c', false)
  ) v(sig, md5, authentifie) LOOP
    PERFORM pg_temp.egal('D0 ' || f.sig, md5(pg_get_functiondef(f.sig::regprocedure)), f.md5);
    IF has_function_privilege('authenticated', f.sig, 'EXECUTE') IS DISTINCT FROM f.authentifie
       OR NOT has_function_privilege('service_role', f.sig, 'EXECUTE')
       OR has_function_privilege('anon', f.sig, 'EXECUTE')
       OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) x WHERE p.oid = f.sig::regprocedure AND x.grantee = 0)
       OR NOT (SELECT prosecdef AND proconfig = ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid = f.sig::regprocedure) THEN
      RAISE EXCEPTION 'D0 : droits ou options de %', f.sig;
    END IF;
  END LOOP;
  PERFORM pg_temp.egal('D0 déclencheur de propagation',
    (SELECT md5(pg_get_triggerdef(t.oid)) FROM pg_trigger t
      WHERE t.tgrelid = 'public.box_wods'::regclass AND t.tgname = 'trg_box_wods_propagate_to_offer'),
    '3a2ef9d9c2b6b46ab014b711d1a95268');
END $t$;
-- ── fin D0 ──

-- ── T : colonnes et contraintes ──────────────────────────────────────────────
DO $t$
DECLARE
  v text;
BEGIN
  INSERT INTO public.box_programming_wods (programming_id, day_of_week, title)
  VALUES (pg_temp.o('03'), 7, 'WOD d''avant');
  PERFORM pg_temp.egal('T défauts', pg_temp.offre(pg_temp.o('03')), 'WOD d''avant:NULL/lines/true');
  DELETE FROM public.box_programming_wods WHERE programming_id = pg_temp.o('03');

  FOR v IN SELECT unnest(ARRAY[
    $$INSERT INTO public.box_programming_wods (programming_id, day_of_week, title, score_type) VALUES ('00000000-0000-4000-d465-000000000003', 1, 'x', 'done')$$,
    $$INSERT INTO public.box_programming_wods (programming_id, day_of_week, title, text_mode) VALUES ('00000000-0000-4000-d465-000000000003', 1, 'x', 'libre')$$,
    $$INSERT INTO public.box_programming_wods (programming_id, day_of_week, title, text_mode) VALUES ('00000000-0000-4000-d465-000000000003', 1, 'x', NULL)$$,
    $$INSERT INTO public.box_programming_wods (programming_id, day_of_week, title, score_type, leaderboard_enabled) VALUES ('00000000-0000-4000-d465-000000000003', 1, 'x', 'none', true)$$])
  LOOP
    BEGIN
      EXECUTE v;
      RAISE EXCEPTION 'T : écriture acceptée à tort : %', v;
    EXCEPTION WHEN check_violation OR not_null_violation THEN NULL;
    END;
  END LOOP;
  PERFORM pg_temp.egal('T noms des contraintes',
    (SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint
      WHERE conrelid = 'public.box_programming_wods'::regclass
        AND conname IN ('box_programming_wods_score_type_check', 'box_programming_wods_text_mode_check',
                        'box_programming_wods_sans_score_sans_classement_check')),
    'box_programming_wods_sans_score_sans_classement_check,box_programming_wods_score_type_check,box_programming_wods_text_mode_check');
END $t$;

-- ── C1 à C7 : chaque chemin de copie ─────────────────────────────────────────
DO $t$
DECLARE
  v text;
  tpl uuid;
  sub uuid := '00000000-0000-4000-e465-000000000001';
BEGIN
  -- C1 sync_wod_to_offer : insertion, puis mise à jour (ON CONFLICT).
  FOR v IN SELECT unnest(ARRAY['01', '02', '03']) LOOP
    PERFORM pg_temp.attendu('C1 sync ' || v, pg_temp.faire(format(
      'SELECT public.sync_wod_to_offer(%L::uuid, %L::uuid, 1)::text', pg_temp.w(v), pg_temp.o('01'))), 'OK ');
  END LOOP;
  PERFORM pg_temp.egal('C1 insertion', pg_temp.offre(pg_temp.o('01')), pg_temp.trois());
  UPDATE public.box_programming_wods SET score_type = 'reps', text_mode = 'lines'
   WHERE programming_id = pg_temp.o('01') AND origin_box_wod_id = pg_temp.w('01');
  UPDATE public.box_programming_wods SET score_type = 'weight', text_mode = 'free'
   WHERE programming_id = pg_temp.o('01') AND origin_box_wod_id = pg_temp.w('03');
  PERFORM pg_temp.attendu('C1 resync 1', pg_temp.faire(format(
    'SELECT public.sync_wod_to_offer(%L::uuid, %L::uuid, 1)::text', pg_temp.w('01'), pg_temp.o('01'))), 'OK ');
  PERFORM pg_temp.attendu('C1 resync 3', pg_temp.faire(format(
    'SELECT public.sync_wod_to_offer(%L::uuid, %L::uuid, 1)::text', pg_temp.w('03'), pg_temp.o('01'))), 'OK ');
  PERFORM pg_temp.egal('C1 mise à jour', pg_temp.offre(pg_temp.o('01')), pg_temp.trois());

  -- C2 propagation : seul le type, puis seul le mode, change sur le WOD maison.
  UPDATE public.box_wods SET score_type = 'weight' WHERE id = pg_temp.w('03');
  PERFORM pg_temp.egal('C2 type seul', pg_temp.offre(pg_temp.o('01')),
    'WOD 1:time/free/true,WOD 2:none/free/false,WOD 3:weight/lines/true');
  UPDATE public.box_wods SET text_mode = 'free' WHERE id = pg_temp.w('03');
  PERFORM pg_temp.egal('C2 mode seul', pg_temp.offre(pg_temp.o('01')),
    'WOD 1:time/free/true,WOD 2:none/free/false,WOD 3:weight/free/true');
  UPDATE public.box_wods SET score_type = NULL, text_mode = 'lines' WHERE id = pg_temp.w('03');
  PERFORM pg_temp.egal('C2 retour sans type', pg_temp.offre(pg_temp.o('01')), pg_temp.trois());

  -- C3 copy_week_to_offer depuis la semaine de la box.
  PERFORM pg_temp.attendu('C3 copie', pg_temp.faire(format(
    'SELECT public.copy_week_to_offer(%L, %L::uuid, %L::date, NULL, %L::uuid, 1)::text',
    'whiteboard', pg_temp.b('aa'), '2030-01-07', pg_temp.o('02'))), 'OK ');
  PERFORM pg_temp.egal('C3 semaine de la box', pg_temp.offre(pg_temp.o('02')), pg_temp.trois());

  -- C4 save_week_as_template.
  v := pg_temp.faire(format('SELECT public.save_week_as_template(%L::uuid, %L::date, %L)->>''template_id''',
    pg_temp.b('aa'), '2030-01-07', 'Semaine type 1c'));
  PERFORM pg_temp.attendu('C4 semaine type', v, 'OK ');
  tpl := substr(v, 4)::uuid;
  PERFORM pg_temp.egal('C4 semaine type', pg_temp.offre(tpl), pg_temp.trois());

  -- C5 copy_week_to_offer depuis la semaine type (offre → offre).
  PERFORM pg_temp.attendu('C5 copie', pg_temp.faire(format(
    'SELECT public.copy_week_to_offer(%L, %L::uuid, NULL, %L::uuid, %L::uuid, 1)::text',
    'template', pg_temp.b('aa'), tpl, pg_temp.o('03'))), 'OK ');
  PERFORM pg_temp.egal('C5 semaine type → offre', pg_temp.offre(pg_temp.o('03')), pg_temp.trois());

  -- C6 apply_program_week : semaine type chez P, abonnement O1 chez S.
  PERFORM pg_temp.attendu('C6 semaine type', pg_temp.faire(format(
    'SELECT public.apply_program_week(%L, %L::uuid, 1, %L::date, %L)::text',
    'template', tpl, '2030-01-14', 'all')), 'OK ');
  PERFORM pg_temp.egal('C6 semaine type → box', pg_temp.box(pg_temp.b('aa'), '2030-01-14'), pg_temp.trois());
  INSERT INTO public.box_programming_subscriptions (id, programming_id, subscriber_box_id, status, auto_apply_weekly, week_anchor)
  VALUES (sub, pg_temp.o('01'), pg_temp.b('bb'), 'active', true, DATE '2030-01-28');
  PERFORM pg_temp.attendu('C6 abonnement', pg_temp.faire(format(
    'SELECT public.apply_program_week(%L, %L::uuid, 1, %L::date, %L)::text',
    'subscription', sub, '2030-01-21', 'all')), 'OK ');
  PERFORM pg_temp.egal('C6 abonnement → box', pg_temp.box(pg_temp.b('bb'), '2030-01-21'), pg_temp.trois());

  -- C7 materialize_box_programming : pose automatique (semaine 1 au 28/01).
  UPDATE public.box_programming_subscriptions SET week_anchor = DATE '2030-01-28' WHERE id = sub;
  PERFORM public.materialize_box_programming(DATE '2030-01-28');
  PERFORM pg_temp.egal('C7 pose automatique', pg_temp.box(pg_temp.b('bb'), '2030-01-28'), pg_temp.trois());
END $t$;

-- ── R : retour arrière, puis migration rejouée ───────────────────────────────
\i supabase/retours/20270165000000_programming_score_type.sql
DO $t$
BEGIN
  -- Le retour vérifie lui-même les définitions d'avant (garde d'après) ; ici,
  -- les colonnes retirées.
  PERFORM pg_temp.egal('R colonnes retirées',
    (SELECT count(*)::text FROM pg_attribute WHERE attrelid = 'public.box_programming_wods'::regclass
        AND attname IN ('score_type', 'text_mode') AND NOT attisdropped), '0');
  PERFORM pg_temp.egal('R box_wods intactes', pg_temp.box(pg_temp.b('bb'), '2030-01-28'), pg_temp.trois());
END $t$;
\i supabase/migrations/20270165000000_programming_score_type.sql
DO $t$
BEGIN
  PERFORM pg_temp.egal('R rejouée sync', md5(pg_get_functiondef('public.sync_wod_to_offer(uuid, uuid, integer)'::regprocedure)), '6bc07a9b3a6aac8979098d5882337d3a');
  PERFORM pg_temp.egal('R rejouée défaut', pg_temp.offre(pg_temp.o('01')),
    'WOD 1:NULL/lines/true,WOD 2:NULL/lines/false,WOD 3:NULL/lines/true');
END $t$;
-- ── fin R ──

ROLLBACK;
\echo '    D0, T, C1 à C7 et R OK'
