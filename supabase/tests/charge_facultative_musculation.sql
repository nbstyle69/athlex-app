-- ═════════════════════════════════════════════════════════════════════════════
-- Musculation : charge facultative sur les séries (nbstyle69/AthleX-Manager#453,
-- PR 4a, migration 20270164)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (la migration et son retour arrière sont rejoués par \i).
-- Box X : athlète A (…01, membre), propriétaire (…04). WODs : 1, 2, 5, 6 sans
-- type ; 3 typé « Temps » ; 4 typé « Charge ».
--   D0  définitions figées : validate_strength_session et confirm_gym_record
--       (md5, commentaires, droits), commentaire de total_reps ;
--   C1  série avec reps sans charge acceptée, même si une charge était
--       prescrite (charge prévue ou load_required), charge prévue gardée ;
--       série vide (ni reps ni charge) et série sans reps ignorées ; séance
--       sans aucune charge : validée, reps totales, aucun score ;
--   C2  validation partielle (2 et 3 séries pour 5 et 6 prévues) ; séance
--       mixte : charge max et score sur les seules séries chargées ; 1RM prouvé
--       par une série chargée, refusé sur une série sans charge (rien n'est
--       écrit) ; première validation seule marquée ;
--   C3  WOD typé autre que « Charge » : aucun score (inchangé) ; WOD typé
--       « Charge » : aucun score sans charge, score de charge avec ;
--   C4  record de gymnastique : refusé sur une série prescrite chargée faite à
--       vide, accepté sur une série sans charge prévue ;
--   R   retour arrière : définitions et commentaires de prod (c39b912c… /
--       6ebca7f3…), ancienne règle rétablie ; la migration rejouée redonne les
--       mêmes empreintes.
-- Mutations : jouées localement sans D0 ni R (liste et résultat dans la PR) ;
-- chacune fait échouer ce fichier. Tout est joué dans une transaction annulée.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Musculation : charge facultative sur les séries (20270164)'

BEGIN;

CREATE FUNCTION pg_temp.u(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a464-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.w(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-c464-0000000000' || s)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.w(text) TO PUBLIC; -- appelées sous authenticated

INSERT INTO auth.users (id) SELECT pg_temp.u(s) FROM unnest(ARRAY['01', '04']) s;
INSERT INTO public.profiles (id, email, username)
SELECT pg_temp.u(s), 'cf-' || s || '@test.invalid', 'cf_' || s FROM unnest(ARRAY['01', '04']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b464-00000000000a', 'Box X', 'CF464', pg_temp.u('04'));
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b464-00000000000a', pg_temp.u(m), r, 'active'
  FROM (VALUES ('01', 'member'), ('04', 'owner')) v(m, r);
INSERT INTO public.box_wods (id, box_id, title, wod_type, scheduled_date, score_type)
SELECT pg_temp.w(n), '00000000-0000-4000-b464-00000000000a', 'WOD ' || n, 'strength', CURRENT_DATE,
       CASE n WHEN '03' THEN 'time' WHEN '04' THEN 'weight' END
  FROM unnest(ARRAY['01', '02', '03', '04', '05', '06']) n;

-- Exécute comme le vrai client (authenticated + auth.uid()), effet GARDÉ.
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK'; r text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', pg_temp.u(p_qui)::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    IF p_sql ILIKE 'select%' THEN
      EXECUTE p_sql INTO r;
      v := 'OK ' || coalesce(r, 'NULL');
    ELSE
      EXECUTE p_sql;
    END IF;
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN v;
END $$;

CREATE FUNCTION pg_temp.valider(p_wod text, p_prevues integer, p_sets text, p_records text DEFAULT '[]') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire('01', format(
    'SELECT public.validate_strength_session(%L, %L::uuid, %L, %s, true, %L::jsonb, %L::jsonb)::text',
    'whiteboard', pg_temp.w(p_wod), 'Séance ' || p_wod, p_prevues, p_sets, p_records));
$$;
CREATE FUNCTION pg_temp.seance(p_wod text) RETURNS text LANGUAGE sql AS $$
  SELECT status || '|' || coalesce(trim_scale(max_load_kg)::text, '-') || '|' || coalesce(total_reps::text, '-')
    FROM public.strength_sessions WHERE user_id = pg_temp.u('01') AND source_id = pg_temp.w(p_wod);
$$;
-- « mouvement#série:reps/charge/charge prévue », triées.
CREATE FUNCTION pg_temp.series(p_wod text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(movement || '#' || set_index || ':' || reps || '/'
                             || coalesce(trim_scale(load_kg)::text, '-') || '/'
                             || coalesce(trim_scale(prescribed_load_kg)::text, '-'), ',' ORDER BY movement, set_index), '')
    FROM public.strength_set_logs WHERE user_id = pg_temp.u('01') AND source_id = pg_temp.w(p_wod);
$$;
CREATE FUNCTION pg_temp.scores(p_wod text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(score_type || '=' || trim_scale(score_value), ','), '')
    FROM public.wod_scores WHERE wod_id = pg_temp.w(p_wod) AND member_id = pg_temp.u('01');
$$;
CREATE FUNCTION pg_temp.pr(k text) RETURNS text LANGUAGE sql AS $$
  SELECT personal_records->>k FROM public.profiles WHERE id = pg_temp.u('01');
$$;
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

-- ── D0 : définitions figées ──────────────────────────────────────────────────
DO $t$
DECLARE
  vss regprocedure := 'public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure;
  cgr regprocedure := 'public.confirm_gym_record(uuid, text)'::regprocedure;
BEGIN
  PERFORM pg_temp.egal('D0 validate_strength_session', md5(pg_get_functiondef(vss)), '80c963e615fb4b369fafbd31f8915074');
  PERFORM pg_temp.egal('D0 confirm_gym_record', md5(pg_get_functiondef(cgr)), '1230f660ba3c054476ff2510b6a3fc2b');
  PERFORM pg_temp.egal('D0 commentaire vss', md5(obj_description(vss, 'pg_proc')), '340795e403551482eac47a930d25884b');
  PERFORM pg_temp.egal('D0 commentaire cgr', md5(obj_description(cgr, 'pg_proc')), 'a08a4cc9b38bed17c1c6e99cdb6a0f9c');
  PERFORM pg_temp.egal('D0 commentaire total_reps',
    md5(col_description('public.strength_sessions'::regclass,
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.strength_sessions'::regclass AND attname = 'total_reps'))),
    'c0d856ba5bb82cce77f6732354353d1c');
  IF NOT has_function_privilege('authenticated', vss, 'EXECUTE')
     OR NOT has_function_privilege('service_role', vss, 'EXECUTE')
     OR has_function_privilege('anon', vss, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', cgr, 'EXECUTE')
     OR has_function_privilege('service_role', cgr, 'EXECUTE')
     OR has_function_privilege('anon', cgr, 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) x WHERE p.oid IN (vss, cgr) AND x.grantee = 0)
     OR NOT (SELECT bool_and(prosecdef AND proconfig = ARRAY['search_path=public, pg_temp']) FROM pg_proc WHERE oid IN (vss, cgr)) THEN
    RAISE EXCEPTION 'D0 : droits ou options des fonctions';
  END IF;
END $t$;
-- ── fin D0 ──

-- ── C1 : charge facultative, séries vides ignorées, aucun score sans charge ──
DO $t$
DECLARE v text;
BEGIN
  v := pg_temp.valider('01', 5, $j$[
    {"movement":"Back Squat","set_index":1,"reps":5,"load_kg":"","prescribed_reps":5,"prescribed_load_kg":100,"load_required":true},
    {"movement":"Back Squat","set_index":2,"reps":4,"load_required":true},
    {"movement":"Back Squat","set_index":3,"reps":"","load_kg":"","prescribed_reps":5,"prescribed_load_kg":100,"load_required":true},
    {"movement":"Back Squat","set_index":4,"reps":"","load_kg":"100","prescribed_reps":5,"prescribed_load_kg":100,"load_required":true}
  ]$j$);
  PERFORM pg_temp.attendu('C1 validation', v, 'OK ');
  PERFORM pg_temp.egal('C1 séries valides', (substr(v, 4)::jsonb->>'series_valides'), '2');
  PERFORM pg_temp.egal('C1 charge max', (substr(v, 4)::jsonb->>'max_load_kg'), NULL);
  PERFORM pg_temp.egal('C1 séance', pg_temp.seance('01'), 'validated|-|9');
  PERFORM pg_temp.egal('C1 séries', pg_temp.series('01'), 'Back Squat#1:5/-/100,Back Squat#2:4/-/-');
  PERFORM pg_temp.egal('C1 score', pg_temp.scores('01'), '');
END $t$;

-- ── C2 : validation partielle, séance mixte, 1RM, première validation ────────
DO $t$
DECLARE v text;
BEGIN
  v := pg_temp.valider('02', 6, $j$[
    {"movement":"Back Squat","set_index":1,"reps":1,"load_kg":"120","prescribed_reps":1,"prescribed_load_kg":120,"load_required":true},
    {"movement":"Back Squat","set_index":2,"reps":3,"load_kg":"","prescribed_reps":3,"prescribed_load_kg":130,"load_required":true},
    {"movement":"Front Squat","set_index":1,"reps":5,"load_kg":"","prescribed_reps":5,"prescribed_load_kg":80,"load_required":true}
  ]$j$, '[{"label":"Back Squat","kg":120,"movement":"Back Squat","set_index":1}]');
  PERFORM pg_temp.attendu('C2 validation partielle', v, 'OK ');
  PERFORM pg_temp.egal('C2 première validation', (substr(v, 4)::jsonb->>'premiere_validation'), 'true');
  PERFORM pg_temp.egal('C2 séance', pg_temp.seance('02'), 'validated|120|8');
  PERFORM pg_temp.egal('C2 score', pg_temp.scores('02'), 'weight=120');
  PERFORM pg_temp.egal('C2 1RM', pg_temp.pr('weightlifting_Back Squat'), '120');

  -- 1RM « prouvé » par une série sans charge : refusé, rien n'est écrit.
  v := pg_temp.valider('02', 6, $j$[
    {"movement":"Back Squat","set_index":1,"reps":1,"load_kg":"125","prescribed_load_kg":120},
    {"movement":"Front Squat","set_index":1,"reps":5,"load_kg":"","prescribed_load_kg":80}
  ]$j$, '[{"label":"Front Squat","kg":50,"movement":"Front Squat","set_index":1}]');
  PERFORM pg_temp.attendu('C2 1RM sans charge', v, '22023: RECORD_NON_PROUVE');
  PERFORM pg_temp.egal('C2 1RM sans charge : record', pg_temp.pr('weightlifting_Front Squat'), NULL);
  PERFORM pg_temp.egal('C2 1RM sans charge : score', pg_temp.scores('02'), 'weight=120');

  -- Revalidation (la série qui prouve le 1RM gardée) : plus la première.
  v := pg_temp.valider('02', 6, $j$[
    {"movement":"Back Squat","set_index":1,"reps":1,"load_kg":"120","prescribed_load_kg":120},
    {"movement":"Front Squat","set_index":1,"reps":5,"load_kg":"","prescribed_load_kg":80}
  ]$j$);
  PERFORM pg_temp.attendu('C2 revalidation', v, 'OK ');
  PERFORM pg_temp.egal('C2 revalidation : première', (substr(v, 4)::jsonb->>'premiere_validation'), 'false');
END $t$;

-- ── C3 : type de score du WOD ────────────────────────────────────────────────
DO $t$
BEGIN
  PERFORM pg_temp.attendu('C3 Temps', pg_temp.valider('03', 1, '[{"movement":"Deadlift","set_index":1,"reps":3,"load_kg":"100"}]'), 'OK ');
  PERFORM pg_temp.egal('C3 Temps : score', pg_temp.scores('03'), '');
  PERFORM pg_temp.attendu('C3 Charge sans charge', pg_temp.valider('04', 2, '[{"movement":"Deadlift","set_index":1,"reps":3,"load_kg":"","prescribed_load_kg":100}]'), 'OK ');
  PERFORM pg_temp.egal('C3 Charge sans charge : score', pg_temp.scores('04'), '');
  PERFORM pg_temp.attendu('C3 Charge', pg_temp.valider('04', 2, '[{"movement":"Deadlift","set_index":1,"reps":3,"load_kg":"100"}]'), 'OK ');
  PERFORM pg_temp.egal('C3 Charge : score', pg_temp.scores('04'), 'weight=100');
END $t$;

-- ── C4 : record de gymnastique ───────────────────────────────────────────────
DO $t$
DECLARE v text; s uuid;
BEGIN
  -- « Pull-ups — 1 × 25 @ 10 kg » fait à vide : pas un record de gymnastique.
  PERFORM pg_temp.attendu('C4 lestée à vide', pg_temp.valider('05', 1,
    '[{"movement":"Pull-ups","set_index":1,"reps":25,"load_kg":"","prescribed_load_kg":10,"load_required":true}]'), 'OK ');
  SELECT id INTO s FROM public.strength_set_logs WHERE user_id = pg_temp.u('01') AND source_id = pg_temp.w('05');
  v := pg_temp.faire('01', format('SELECT public.confirm_gym_record(%L::uuid, %L)::text', s, 'Pull-ups'));
  PERFORM pg_temp.attendu('C4 lestée à vide : record', v, '22023: RECORD_NON_PROUVE');
  PERFORM pg_temp.egal('C4 lestée à vide : rien écrit', pg_temp.pr('gymnastics_Pull-ups'), NULL);

  PERFORM pg_temp.attendu('C4 sans charge prévue', pg_temp.valider('06', 1,
    '[{"movement":"Pull-ups","set_index":1,"reps":25,"load_kg":""}]'), 'OK ');
  SELECT id INTO s FROM public.strength_set_logs WHERE user_id = pg_temp.u('01') AND source_id = pg_temp.w('06');
  v := pg_temp.faire('01', format('SELECT public.confirm_gym_record(%L::uuid, %L)::text', s, 'Pull-ups'));
  PERFORM pg_temp.attendu('C4 sans charge prévue : record', v, 'OK ');
  PERFORM pg_temp.egal('C4 sans charge prévue : valeur', pg_temp.pr('gymnastics_Pull-ups'), '25');
END $t$;

-- ── R : retour arrière, puis migration rejouée ───────────────────────────────
\i supabase/retours/20270164000000_strength_optional_load.sql
DO $t$
BEGIN
  -- Le retour vérifie lui-même définitions et commentaires de prod ; ici,
  -- l'ancienne règle : une série prescrite chargée faite à vide est écartée.
  PERFORM pg_temp.attendu('R ancienne règle', pg_temp.valider('01', 5,
    '[{"movement":"Back Squat","set_index":1,"reps":5,"load_kg":"","prescribed_load_kg":100}]'), '22023: SEANCE_VIDE');
END $t$;
\i supabase/migrations/20270164000000_strength_optional_load.sql
DO $t$
BEGIN
  PERFORM pg_temp.egal('R rejouée vss', md5(pg_get_functiondef('public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure)), '80c963e615fb4b369fafbd31f8915074');
  PERFORM pg_temp.egal('R rejouée cgr', md5(pg_get_functiondef('public.confirm_gym_record(uuid, text)'::regprocedure)), '1230f660ba3c054476ff2510b6a3fc2b');
END $t$;
-- ── fin R ──

ROLLBACK;
\echo '    D0, C1 à C4 et R OK'
