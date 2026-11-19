-- ═════════════════════════════════════════════════════════════════════════════
-- ELO de box et ELO global : le sens du classement suit le type de score choisi
-- par le créateur (#453, PR 1b, migration 20270163)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (la migration et son retour arrière sont rejoués par \i).
-- Box E : athlètes 01, 02, 03 (membres), propriétaire 04. Chaque classement est
-- calculé puis ANNULÉ (pg_temp.classer) et rendu « membre:rang:delta », pour
-- compute_wod_elo (ELO global) et compute_box_elo (ELO de box).
--   D0  définitions figées (md5), SECURITY DEFINER, search_path, droits ;
--   T1  WOD AMRAP typé 'time' : temps croissant, capé derrière ;
--   T2  WOD For Time typé 'rounds_reps' : décroissant ;
--   T3  WOD For Time typé 'reps' : décroissant ;
--   T4  WOD For Time typé 'weight' : décroissant ;
--   N   WOD 'none' : aucune ELO, même classement réactivé de force (CHECK
--       retiré dans un point de sauvegarde) : garde explicite ;
--   U   WODs sans type (for-time avec capé, amrap, strength, wod_type NULL) :
--       rangs attendus, puis mêmes résultats exacts qu'avec les définitions
--       d'avant (retour arrière) ;
--   R   retour arrière : md5 de prod rétablis ; les définitions d'avant
--       classent T1–T4 selon wod_type et N malgré 'none' (ce que la migration
--       corrige) ; la migration rejouée redonne les mêmes empreintes.
-- Mutations : jouées localement (liste et résultat dans la PR) ; chacune fait
-- échouer ce fichier. Tout est joué dans une transaction annulée.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> ELO : le sens du classement suit le type de score du WOD (#453, PR 1b)'

BEGIN;

CREATE FUNCTION pg_temp.u(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a463-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.w(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-c463-0000000000' || s)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.w(text) TO PUBLIC; -- appelées sous authenticated

INSERT INTO auth.users (id) SELECT pg_temp.u(s) FROM unnest(ARRAY['01', '02', '03', '04']) s;
INSERT INTO public.profiles (id, email, username)
SELECT pg_temp.u(s), 'est-' || s || '@test.invalid', 'est_' || s FROM unnest(ARRAY['01', '02', '03', '04']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b463-00000000000e', 'Box E', 'EST463', pg_temp.u('04'));
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b463-00000000000e', pg_temp.u(m), r, 'active'
  FROM (VALUES ('01', 'member'), ('02', 'member'), ('03', 'member'), ('04', 'owner')) v(m, r);

-- WODs : t1–t5 typés, wod_type dans l'autre sens ; u1–u4 sans type.
INSERT INTO public.box_wods (id, box_id, title, wod_type, score_type, leaderboard_enabled, scheduled_date, is_published)
SELECT pg_temp.w(n), '00000000-0000-4000-b463-00000000000e', 'WOD ' || n, wt, st, st IS DISTINCT FROM 'none', CURRENT_DATE, true
  FROM (VALUES ('11', 'amrap', 'time'), ('12', 'for-time', 'rounds_reps'), ('13', 'for-time', 'reps'),
               ('14', 'for-time', 'weight'), ('15', 'for-time', 'none'),
               ('21', 'for-time', NULL), ('22', 'amrap', NULL), ('23', 'strength', NULL), ('24', NULL, NULL)) v(n, wt, st);

-- Scores (rx) : le bon sens donne toujours 02 premier, 01 deuxième, 03 dernier.
INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value, capped, rx)
SELECT pg_temp.w(n), pg_temp.u(m), '00000000-0000-4000-b463-00000000000e', st, v, c, true
  FROM (VALUES
    ('11', '01', 'time', 300, false), ('11', '02', 'time', 200, false), ('11', '03', 'time', 999999 + 40, true),
    ('12', '01', 'rounds_reps', 5012, false), ('12', '02', 'rounds_reps', 6003, false), ('12', '03', 'rounds_reps', 4999, false),
    ('13', '01', 'reps', 100, false), ('13', '02', 'reps', 150, false), ('13', '03', 'reps', 50, false),
    ('14', '01', 'weight', 100, false), ('14', '02', 'weight', 120, false), ('14', '03', 'weight', 80, false),
    ('15', '01', 'done', 1, false), ('15', '02', 'done', 1, false),
    ('21', '01', 'time', 300, false), ('21', '02', 'time', 999999 + 50, true), ('21', '03', 'time', 200, false),
    ('22', '01', 'reps', 100, false), ('22', '02', 'reps', 150, false), ('22', '03', 'reps', 50, false),
    ('23', '01', 'weight', 100, false), ('23', '02', 'weight', 120, false), ('23', '03', 'weight', 80, false),
    ('24', '01', 'reps', 70, false), ('24', '02', 'reps', 70, false), ('24', '03', 'reps', 70, false)
  ) v(n, m, st, v, c);

-- Calcule le classement comme le propriétaire (authenticated + auth.uid()) et
-- l'ANNULE : rend « membre:rang:delta, … », « vide », ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.classer(p_fn text, p_wod text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', pg_temp.u('04')::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE format('SELECT coalesce(string_agg(right(member_id::text, 2) || '':'' || rank || '':'' || elo_delta, '','' ORDER BY member_id), ''vide'') FROM public.%I(%L)',
                   p_fn, pg_temp.w(p_wod)) INTO v;
    RAISE EXCEPTION USING MESSAGE = 'CLASSER:' || v;
  EXCEPTION WHEN OTHERS THEN
    v := CASE WHEN SQLERRM LIKE 'CLASSER:%' THEN substr(SQLERRM, 9) ELSE SQLSTATE || ': ' || SQLERRM END;
  END;
  RETURN v;
END $$;

CREATE FUNCTION pg_temp.attendu(p_cas text, p_obtenu text, p_attendu text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtenu IS DISTINCT FROM p_attendu THEN
    RAISE EXCEPTION '% : obtenu « % », attendu « % »', p_cas, p_obtenu, p_attendu;
  END IF;
END $$;

CREATE TEMP TABLE _fn (fn text);
INSERT INTO _fn VALUES ('compute_wod_elo'), ('compute_box_elo');

-- ── D0 : définitions figées ──────────────────────────────────────────────────
DO $t$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid, p.proname, md5(pg_get_functiondef(p.oid)) AS m, p.prosecdef, p.proconfig
             FROM pg_proc p WHERE p.oid IN ('public.compute_wod_elo(uuid)'::regprocedure, 'public.compute_box_elo(uuid)'::regprocedure) LOOP
    IF r.m IS DISTINCT FROM (CASE r.proname WHEN 'compute_wod_elo' THEN '98dd9d5cd4ecb229c8c4a3ebe259a5ff'
                                            ELSE '45bf8589e8ffa0fa4dd45527ac21b5f1' END) THEN
      RAISE EXCEPTION 'D0 % : md5 % inattendu', r.proname, r.m;
    END IF;
    IF NOT r.prosecdef OR r.proconfig IS DISTINCT FROM ARRAY['search_path=public'] THEN
      RAISE EXCEPTION 'D0 % : SECURITY DEFINER ou search_path perdu', r.proname;
    END IF;
    IF NOT has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'D0 % : authenticated ne peut plus l''appeler', r.proname;
    END IF;
  END LOOP;
END $t$;

-- ── T1–T4 : le type de score l'emporte sur wod_type ─────────────────────────
SELECT pg_temp.attendu('T' || substr(n, 2) || ' ' || fn, pg_temp.classer(fn, n), '01:2:0,02:1:32,03:3:-32')
  FROM _fn, unnest(ARRAY['11', '12', '13', '14']) n;

-- ── N : WOD « Sans score » jamais classé ─────────────────────────────────────
SELECT pg_temp.attendu('N ' || fn, pg_temp.classer(fn, '15'), 'vide') FROM _fn;
SAVEPOINT n_force;
ALTER TABLE public.box_wods DROP CONSTRAINT box_wods_sans_score_sans_classement_check;
UPDATE public.box_wods SET leaderboard_enabled = true WHERE id = pg_temp.w('15');
SELECT pg_temp.attendu('N forcé ' || fn, pg_temp.classer(fn, '15'), 'vide') FROM _fn;
ROLLBACK TO SAVEPOINT n_force;

-- ── U : WODs sans type, classés comme avant ─────────────────────────────────
SELECT pg_temp.attendu('U' || n || ' ' || fn, pg_temp.classer(fn, n), a)
  FROM _fn, (VALUES ('21', '01:2:0,02:3:-32,03:1:32'), ('22', '01:2:0,02:1:32,03:3:-32'),
                    ('23', '01:2:0,02:1:32,03:3:-32'), ('24', '01:1:0,02:1:0,03:1:0')) v(n, a);
CREATE TEMP TABLE _apres AS
SELECT fn, n, pg_temp.classer(fn, n) AS c FROM _fn, unnest(ARRAY['21', '22', '23', '24']) n;

-- ── R : retour arrière, puis migration rejouée ───────────────────────────────
\i supabase/retours/20270163000000_elo_score_type.sql
DO $t$
BEGIN
  IF md5(pg_get_functiondef('public.compute_wod_elo(uuid)'::regprocedure)) IS DISTINCT FROM 'e6ee4fce3d71a4a29ffd3bea93c102d2'
     OR md5(pg_get_functiondef('public.compute_box_elo(uuid)'::regprocedure)) IS DISTINCT FROM 'f04fa5d49d90ae61c989b18bb2afcd59' THEN
    RAISE EXCEPTION 'R : définitions de prod non rétablies';
  END IF;
END $t$;
-- Mêmes résultats exacts qu'avant la migration sur les WODs sans type.
SELECT pg_temp.attendu('R U' || a.n || ' ' || a.fn, pg_temp.classer(a.fn, a.n), a.c) FROM _apres a;
-- Les définitions d'avant suivent wod_type (sens inverse) et classent un 'none'
-- forcé : c'est bien la migration qui fait passer T1–T4 et N.
SELECT pg_temp.attendu('R T' || substr(n, 2) || ' ' || fn, pg_temp.classer(fn, n), '01:2:0,02:3:-32,03:1:32')
  FROM _fn, unnest(ARRAY['11', '12', '13', '14']) n;
SAVEPOINT r_force;
ALTER TABLE public.box_wods DROP CONSTRAINT box_wods_sans_score_sans_classement_check;
UPDATE public.box_wods SET leaderboard_enabled = true WHERE id = pg_temp.w('15');
SELECT pg_temp.attendu('R N forcé ' || fn, pg_temp.classer(fn, '15'), '01:1:0,02:1:0') FROM _fn;
ROLLBACK TO SAVEPOINT r_force;

\i supabase/migrations/20270163000000_elo_score_type.sql
DO $t$
BEGIN
  IF md5(pg_get_functiondef('public.compute_wod_elo(uuid)'::regprocedure)) IS DISTINCT FROM '98dd9d5cd4ecb229c8c4a3ebe259a5ff'
     OR md5(pg_get_functiondef('public.compute_box_elo(uuid)'::regprocedure)) IS DISTINCT FROM '45bf8589e8ffa0fa4dd45527ac21b5f1' THEN
    RAISE EXCEPTION 'R : la migration rejouée ne redonne pas les mêmes empreintes';
  END IF;
END $t$;
SELECT pg_temp.attendu('R rejouée T' || substr(n, 2) || ' ' || fn, pg_temp.classer(fn, n), '01:2:0,02:1:32,03:3:-32')
  FROM _fn, unnest(ARRAY['11', '12', '13', '14']) n;

ROLLBACK;
\echo '    ok'
