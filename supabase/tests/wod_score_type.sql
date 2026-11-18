-- ═════════════════════════════════════════════════════════════════════════════
-- WOD de box : type de score choisi par le créateur, texte libre (#453,
-- migration 20270162)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (la migration et son retour arrière sont rejoués par \i).
-- Box X : athlète A (…01, membre), B (…05, membre), propriétaire (…04).
--   D0  définitions figées : garde (md5, SECURITY DEFINER, search_path vide,
--       ni anon ni authenticated ni PUBLIC), déclencheur (événements et
--       colonnes), badge_condition_met et validate_strength_session (md5) ;
--   C1  box_wods : WOD créé comme avant → score_type NULL, text_mode 'lines' ;
--       5 types acceptés, autre refusé ; text_mode lines | free seulement ;
--       'none' exige leaderboard_enabled = false (à l'écriture du type comme
--       à la réactivation du classement) ;
--   C2  wod_scores : 'rounds_reps' entier ≥ 0, 'done' = 1, type inconnu refusé ;
--   G1  WOD sans type (et score sans WOD) : les 4 types d'avant et NULL
--       acceptés, 'rounds_reps' et 'done' refusés (SCORE_TYPE_MISMATCH) ;
--   G2  WOD typé : matrice 5 types de WOD × 6 types de score, seul le type
--       correspondant passe ('none' ↔ 'done') ;
--   G3  mise à jour : changer de type refusé ; WOD retypé après coup : le
--       score d'avant reste modifiable hors type/valeur, sa valeur non ;
--       upsert de l'app au mauvais type refusé ;
--   G4  WOD caché par la RLS (brouillon) : la garde voit quand même son type ;
--   E1  WOD « Sans score » : compute_wod_elo et compute_box_elo ne classent
--       pas les 'done' ;
--   B1  first_score : un 'done' seul ne crédite pas, un vrai score oui ;
--   S1  validate_strength_session : WOD 'none' → validation sans score (même
--       avec un 'done' déjà posé) ; 'weight' et sans type → score de charge ;
--       sans type avec un score 'reps' → SCORE_AUTRE_TYPE comme avant ;
--   R   retour arrière : définitions d'avant (md5 prod), colonnes, garde et
--       contraintes retirées, ancienne contrainte de type ; la migration
--       rejouée depuis cet état redonne les mêmes empreintes.
-- Mutations : jouées localement (liste et résultat dans la PR) ; chacune fait
-- échouer ce fichier. Tout est joué dans une transaction annulée.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> WOD : type de score choisi par le créateur, texte libre (#453)'

BEGIN;

CREATE FUNCTION pg_temp.u(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a453-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.w(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-c453-0000000000' || s)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text), pg_temp.w(text) TO PUBLIC; -- appelées sous authenticated

INSERT INTO auth.users (id) SELECT pg_temp.u(s) FROM unnest(ARRAY['01', '04', '05']) s;
INSERT INTO public.profiles (id, email, username)
SELECT pg_temp.u(s), 'wst-' || s || '@test.invalid', 'wst_' || s FROM unnest(ARRAY['01', '04', '05']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b453-00000000000a', 'Box X', 'WST453', pg_temp.u('04'));
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b453-00000000000a', pg_temp.u(m), r, 'active'
  FROM (VALUES ('01', 'member'), ('05', 'member'), ('04', 'owner')) v(m, r);

-- WODs créés comme avant la migration (sans les nouvelles colonnes), puis typés.
--   00 sans type ; 01 time ; 02 rounds_reps ; 03 reps ; 04 weight ; 05 none ;
--   06 weight (force) ; 07 none (force) ; 08 sans type (force) ; 09 time,
--   brouillon ; 10 sans type (force) ; 11 libre (C1) ; 12 none (ELO).
INSERT INTO public.box_wods (id, box_id, title, wod_type, scheduled_date, is_published)
SELECT pg_temp.w(n), '00000000-0000-4000-b453-00000000000a', 'WOD ' || n,
       CASE WHEN n IN ('06', '07', '08', '10') THEN 'strength' ELSE 'for-time' END,
       CURRENT_DATE, n <> '09'
  FROM unnest(ARRAY['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']) n;

-- Exécute en superutilisateur et ANNULE toujours : 'OK' ou 'SQLSTATE: message'.
CREATE FUNCTION pg_temp.essai(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'ESSAI_ANNULE';
  EXCEPTION WHEN OTHERS THEN
    RETURN CASE WHEN SQLERRM = 'ESSAI_ANNULE' THEN 'OK' ELSE SQLSTATE || ': ' || SQLERRM END;
  END;
END $$;

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

CREATE FUNCTION pg_temp.ins(p_wod text, p_type text, p_val numeric, p_qui text DEFAULT '01') RETURNS text LANGUAGE sql AS $$
  SELECT format('INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value) VALUES (%s, %L, %L, %L, %s)',
                CASE WHEN p_wod IS NULL THEN 'NULL' ELSE quote_literal(pg_temp.w(p_wod)) END,
                pg_temp.u(p_qui), '00000000-0000-4000-b453-00000000000a', p_type, p_val);
$$;

CREATE FUNCTION pg_temp.attendu(p_cas text, p_obtenu text, p_prefixe text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_obtenu IS NULL OR p_obtenu NOT LIKE p_prefixe || '%' THEN
    RAISE EXCEPTION '% : obtenu « % », attendu « %… »', p_cas, p_obtenu, p_prefixe;
  END IF;
END $$;

-- ── D0 : définitions figées ──────────────────────────────────────────────────
DO $t$
DECLARE
  f regprocedure := 'public.trg_wod_scores_type_du_wod()'::regprocedure;
BEGIN
  IF md5(pg_get_functiondef(f)) IS DISTINCT FROM 'b679950418bec9284b627619584ab1f3' THEN
    RAISE EXCEPTION 'D0 : garde inattendue (md5 %)', md5(pg_get_functiondef(f));
  END IF;
  IF NOT (SELECT prosecdef AND proconfig = ARRAY['search_path=""'] FROM pg_proc WHERE oid = f) THEN
    RAISE EXCEPTION 'D0 : garde sans SECURITY DEFINER ou search_path vide';
  END IF;
  IF has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc, aclexplode(proacl) a WHERE oid = f AND a.grantee = 0) THEN
    RAISE EXCEPTION 'D0 : garde exécutable par un client';
  END IF;
  IF (SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'trg_wod_scores_type_du_wod'
        AND tgrelid = 'public.wod_scores'::regclass AND tgenabled = 'O')
     IS DISTINCT FROM 'CREATE TRIGGER trg_wod_scores_type_du_wod BEFORE INSERT OR UPDATE OF score_type, score_value, wod_id ON public.wod_scores FOR EACH ROW EXECUTE FUNCTION trg_wod_scores_type_du_wod()' THEN
    RAISE EXCEPTION 'D0 : déclencheur absent, désactivé ou modifié';
  END IF;
  IF md5(pg_get_functiondef('public.badge_condition_met(uuid, text)'::regprocedure)) IS DISTINCT FROM '3f1be61bc58cf5a0e831ed7cc3812d23' THEN
    RAISE EXCEPTION 'D0 : badge_condition_met inattendue';
  END IF;
  IF md5(pg_get_functiondef('public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure)) IS DISTINCT FROM 'c39b912c63312f07deae5ffa4fbddc94' THEN
    RAISE EXCEPTION 'D0 : validate_strength_session inattendue';
  END IF;
END $t$;

-- ── C1 : box_wods ────────────────────────────────────────────────────────────
DO $t$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.box_wods WHERE id = pg_temp.w('00') AND (score_type IS NOT NULL OR text_mode <> 'lines')) THEN
    RAISE EXCEPTION 'C1 : un WOD créé comme avant n''est pas NULL / lines';
  END IF;
  FOREACH t IN ARRAY ARRAY['time', 'rounds_reps', 'reps', 'weight'] LOOP
    PERFORM pg_temp.attendu('C1 type ' || t, pg_temp.essai(format('UPDATE public.box_wods SET score_type = %L WHERE id = %L', t, pg_temp.w('11'))), 'OK');
  END LOOP;
  PERFORM pg_temp.attendu('C1 type none sans classement', pg_temp.essai(format('UPDATE public.box_wods SET score_type = ''none'', leaderboard_enabled = false WHERE id = %L', pg_temp.w('11'))), 'OK');
  PERFORM pg_temp.attendu('C1 type none avec classement', pg_temp.essai(format('UPDATE public.box_wods SET score_type = ''none'' WHERE id = %L', pg_temp.w('11'))), '23514');
  PERFORM pg_temp.attendu('C1 type amrap', pg_temp.essai(format('UPDATE public.box_wods SET score_type = ''amrap'' WHERE id = %L', pg_temp.w('11'))), '23514');
  PERFORM pg_temp.attendu('C1 texte libre', pg_temp.essai(format('UPDATE public.box_wods SET text_mode = ''free'' WHERE id = %L', pg_temp.w('11'))), 'OK');
  PERFORM pg_temp.attendu('C1 texte html', pg_temp.essai(format('UPDATE public.box_wods SET text_mode = ''html'' WHERE id = %L', pg_temp.w('11'))), '23514');
  PERFORM pg_temp.attendu('C1 texte NULL', pg_temp.essai(format('UPDATE public.box_wods SET text_mode = NULL WHERE id = %L', pg_temp.w('11'))), '23502');
END $t$;

UPDATE public.box_wods SET score_type = 'time'        WHERE id = pg_temp.w('01');
UPDATE public.box_wods SET score_type = 'rounds_reps' WHERE id = pg_temp.w('02');
UPDATE public.box_wods SET score_type = 'reps'        WHERE id = pg_temp.w('03');
UPDATE public.box_wods SET score_type = 'weight'      WHERE id IN (pg_temp.w('04'), pg_temp.w('06'));
UPDATE public.box_wods SET score_type = 'none', leaderboard_enabled = false
 WHERE id IN (pg_temp.w('05'), pg_temp.w('07'), pg_temp.w('12'));
UPDATE public.box_wods SET score_type = 'time'        WHERE id = pg_temp.w('09');

SELECT pg_temp.attendu('C1 réactiver le classement d''un WOD sans score',
  pg_temp.essai(format('UPDATE public.box_wods SET leaderboard_enabled = true WHERE id = %L', pg_temp.w('05'))), '23514');

-- ── C2 : valeurs des nouveaux types ──────────────────────────────────────────
SELECT pg_temp.attendu('C2 rounds_reps 3005',   pg_temp.essai(pg_temp.ins('02', 'rounds_reps', 3005)), 'OK');
SELECT pg_temp.attendu('C2 rounds_reps 0',      pg_temp.essai(pg_temp.ins('02', 'rounds_reps', 0)), 'OK');
SELECT pg_temp.attendu('C2 rounds_reps 3005.5', pg_temp.essai(pg_temp.ins('02', 'rounds_reps', 3005.5)), '23514');
SELECT pg_temp.attendu('C2 rounds_reps -1',     pg_temp.essai(pg_temp.ins('02', 'rounds_reps', -1)), '23514');
SELECT pg_temp.attendu('C2 done 1',             pg_temp.essai(pg_temp.ins('05', 'done', 1)), 'OK');
SELECT pg_temp.attendu('C2 done 2',             pg_temp.essai(pg_temp.ins('05', 'done', 2)), '23514');
SELECT pg_temp.attendu('C2 type foo',           pg_temp.essai(pg_temp.ins('00', 'foo', 1)), '23514');

-- ── G1 : WOD sans type, score sans WOD ───────────────────────────────────────
DO $t$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['time', 'reps', 'weight', 'rounds'] LOOP
    PERFORM pg_temp.attendu('G1 sans type, ' || t, pg_temp.essai(pg_temp.ins('00', t, 42)), 'OK');
    PERFORM pg_temp.attendu('G1 sans WOD, ' || t,  pg_temp.essai(pg_temp.ins(NULL, t, 42)), 'OK');
  END LOOP;
  PERFORM pg_temp.attendu('G1 sans type, NULL', pg_temp.essai(pg_temp.ins('00', NULL, 42)), 'OK');
  FOREACH t IN ARRAY ARRAY['rounds_reps', 'done'] LOOP
    PERFORM pg_temp.attendu('G1 sans type, ' || t, pg_temp.essai(pg_temp.ins('00', t, 1)), '22023: SCORE_TYPE_MISMATCH');
    PERFORM pg_temp.attendu('G1 sans WOD, ' || t,  pg_temp.essai(pg_temp.ins(NULL, t, 1)), '22023: SCORE_TYPE_MISMATCH');
  END LOOP;
END $t$;

-- ── G2 : matrice WOD typé × type de score ────────────────────────────────────
DO $t$
DECLARE wod record; t text; ok text;
BEGIN
  FOR wod IN SELECT * FROM (VALUES ('01', 'time'), ('02', 'rounds_reps'), ('03', 'reps'), ('04', 'weight'), ('05', 'done')) v(n, attendu) LOOP
    FOREACH t IN ARRAY ARRAY['time', 'reps', 'weight', 'rounds', 'rounds_reps', 'done'] LOOP
      ok := CASE WHEN t = wod.attendu THEN 'OK' ELSE '22023: SCORE_TYPE_MISMATCH' END;
      PERFORM pg_temp.attendu(format('G2 WOD %s, score %s', wod.n, t), pg_temp.essai(pg_temp.ins(wod.n, t, 1)), ok);
    END LOOP;
    PERFORM pg_temp.attendu(format('G2 WOD %s, score NULL', wod.n), pg_temp.essai(pg_temp.ins(wod.n, NULL, 1)), '22023: SCORE_TYPE_MISMATCH');
  END LOOP;
END $t$;

-- ── G3 : mises à jour ────────────────────────────────────────────────────────
INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value)
VALUES (pg_temp.w('01'), pg_temp.u('01'), '00000000-0000-4000-b453-00000000000a', 'time', 300);
SELECT pg_temp.attendu('G3 changer de type', pg_temp.essai(format(
  'UPDATE public.wod_scores SET score_type = ''reps'' WHERE wod_id = %L', pg_temp.w('01'))), '22023: SCORE_TYPE_MISMATCH');
SELECT pg_temp.attendu('G3 upsert de l''app au mauvais type', pg_temp.essai(format(
  'INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value) VALUES (%L, %L, %L, ''reps'', 50)
   ON CONFLICT (wod_id, member_id) DO UPDATE SET score_type = EXCLUDED.score_type, score_value = EXCLUDED.score_value',
  pg_temp.w('01'), pg_temp.u('01'), '00000000-0000-4000-b453-00000000000a')), '22023: SCORE_TYPE_MISMATCH');
SELECT pg_temp.attendu('G3 upsert de l''app au bon type', pg_temp.essai(format(
  'INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value) VALUES (%L, %L, %L, ''time'', 280)
   ON CONFLICT (wod_id, member_id) DO UPDATE SET score_type = EXCLUDED.score_type, score_value = EXCLUDED.score_value',
  pg_temp.w('01'), pg_temp.u('01'), '00000000-0000-4000-b453-00000000000a')), 'OK');
UPDATE public.box_wods SET score_type = 'reps' WHERE id = pg_temp.w('01');   -- retypé après coup
SELECT pg_temp.attendu('G3 retypé : notes', pg_temp.essai(format(
  'UPDATE public.wod_scores SET notes = ''bien'' WHERE wod_id = %L', pg_temp.w('01'))), 'OK');
SELECT pg_temp.attendu('G3 retypé : valeur', pg_temp.essai(format(
  'UPDATE public.wod_scores SET score_value = 290 WHERE wod_id = %L', pg_temp.w('01'))), '22023: SCORE_TYPE_MISMATCH');
SELECT pg_temp.attendu('G3 retypé : nouveau type', pg_temp.essai(format(
  'UPDATE public.wod_scores SET score_type = ''reps'', score_value = 90 WHERE wod_id = %L', pg_temp.w('01'))), 'OK');

-- ── G4 : WOD caché par la RLS (brouillon 09, typé time) ──────────────────────
DO $t$
BEGIN
  IF pg_temp.faire('01', format('SELECT count(*)::text FROM public.box_wods WHERE id = %L', pg_temp.w('09'))) <> 'OK 0' THEN
    RAISE EXCEPTION 'G4 : le brouillon devrait être invisible à A';
  END IF;
  PERFORM pg_temp.attendu('G4 brouillon, mauvais type', pg_temp.faire('01', pg_temp.ins('09', 'reps', 50)), '22023: SCORE_TYPE_MISMATCH');
  PERFORM pg_temp.attendu('G4 brouillon, bon type',     pg_temp.faire('01', pg_temp.ins('09', 'time', 300)), 'OK');
END $t$;

-- ── E1 : WOD « Sans score » jamais classé ────────────────────────────────────
INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value)
SELECT pg_temp.w('12'), pg_temp.u(m), '00000000-0000-4000-b453-00000000000a', 'done', 1 FROM unnest(ARRAY['01', '05']) m;
SELECT pg_temp.attendu('E1 compute_wod_elo', pg_temp.faire('04', format('SELECT count(*)::text FROM public.compute_wod_elo(%L)', pg_temp.w('12'))), 'OK 0');
SELECT pg_temp.attendu('E1 compute_box_elo', pg_temp.faire('04', format('SELECT count(*)::text FROM public.compute_box_elo(%L)', pg_temp.w('12'))), 'OK 0');
DO $t$
BEGIN
  IF EXISTS (SELECT 1 FROM public.elo_history WHERE wod_id = pg_temp.w('12'))
     OR EXISTS (SELECT 1 FROM public.box_elo_history WHERE wod_id = pg_temp.w('12')) THEN
    RAISE EXCEPTION 'E1 : un WOD sans score a produit de l''ELO';
  END IF;
END $t$;

-- ── B1 : first_score ne compte pas un 'done' ─────────────────────────────────
DELETE FROM public.wod_scores WHERE member_id = pg_temp.u('05');
INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value)
VALUES (pg_temp.w('05'), pg_temp.u('05'), '00000000-0000-4000-b453-00000000000a', 'done', 1);
DO $t$
BEGIN
  IF public.badge_condition_met(pg_temp.u('05'), 'first_score') THEN
    RAISE EXCEPTION 'B1 : un ''done'' seul crédite first_score';
  END IF;
  INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value)
  VALUES (pg_temp.w('03'), pg_temp.u('05'), '00000000-0000-4000-b453-00000000000a', 'reps', 80);
  IF NOT public.badge_condition_met(pg_temp.u('05'), 'first_score') THEN
    RAISE EXCEPTION 'B1 : un vrai score ne crédite pas first_score';
  END IF;
END $t$;

-- ── S1 : validate_strength_session ───────────────────────────────────────────
CREATE FUNCTION pg_temp.valider(p_wod text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire('01', format(
    'SELECT public.validate_strength_session(%L, %L::uuid, %L, 1, true, %L::jsonb, %L::jsonb)::text',
    'whiteboard', pg_temp.w(p_wod), 'Séance ' || p_wod,
    '[{"movement":"Back Squat","set_index":1,"reps":5,"load_kg":100,"prescribed_reps":5,"prescribed_load_kg":100}]', '[]'));
$$;
CREATE FUNCTION pg_temp.scores(p_wod text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(score_type || '=' || score_value, ','), '')
    FROM public.wod_scores WHERE wod_id = pg_temp.w(p_wod) AND member_id = pg_temp.u('01');
$$;
DO $t$
BEGIN
  PERFORM pg_temp.attendu('S1 none : validation', pg_temp.valider('07'), 'OK ');
  IF pg_temp.scores('07') <> '' THEN RAISE EXCEPTION 'S1 none : score écrit (%)', pg_temp.scores('07'); END IF;
  INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value)
  VALUES (pg_temp.w('07'), pg_temp.u('01'), '00000000-0000-4000-b453-00000000000a', 'done', 1);
  PERFORM pg_temp.attendu('S1 none + done : revalidation', pg_temp.valider('07'), 'OK ');
  IF pg_temp.scores('07') <> 'done=1' THEN RAISE EXCEPTION 'S1 none + done : %', pg_temp.scores('07'); END IF;

  PERFORM pg_temp.attendu('S1 weight', pg_temp.valider('06'), 'OK ');
  IF pg_temp.scores('06') <> 'weight=100' THEN RAISE EXCEPTION 'S1 weight : %', pg_temp.scores('06'); END IF;
  PERFORM pg_temp.attendu('S1 sans type', pg_temp.valider('08'), 'OK ');
  IF pg_temp.scores('08') <> 'weight=100' THEN RAISE EXCEPTION 'S1 sans type : %', pg_temp.scores('08'); END IF;

  INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value)
  VALUES (pg_temp.w('10'), pg_temp.u('01'), '00000000-0000-4000-b453-00000000000a', 'reps', 50);
  PERFORM pg_temp.attendu('S1 sans type + reps', pg_temp.valider('10'), '22023: SCORE_AUTRE_TYPE');
END $t$;

-- ── R : retour arrière, puis migration rejouée ───────────────────────────────
-- Le retour refuse de tourner tant qu'il reste des scores des nouveaux types
-- (sa remise de l'ancienne contrainte, à l'identique).
SELECT pg_temp.attendu('R scores nouveaux types présents', pg_temp.essai($r$
ALTER TABLE public.wod_scores
  DROP CONSTRAINT wod_scores_done_check,
  DROP CONSTRAINT wod_scores_rounds_reps_check,
  DROP CONSTRAINT wod_scores_score_type_check,
  ADD CONSTRAINT wod_scores_score_type_check
    CHECK (score_type = ANY (ARRAY['time'::text, 'reps'::text, 'weight'::text, 'rounds'::text]))$r$), '23514');
DELETE FROM public.wod_scores WHERE score_type IN ('rounds_reps', 'done');
\i supabase/retours/20270162000000_wod_score_type.sql
DO $t$
BEGIN
  IF md5(pg_get_functiondef('public.badge_condition_met(uuid, text)'::regprocedure)) IS DISTINCT FROM 'fb726c4696e987f8a4223d89c18af964'
     OR md5(pg_get_functiondef('public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure)) IS DISTINCT FROM '14ac92fb6ad033f4fce1ebed800d1d2b' THEN
    RAISE EXCEPTION 'R : définitions d''avant non rétablies';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.box_wods'::regclass AND attname IN ('score_type', 'text_mode') AND NOT attisdropped)
     OR EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trg_wod_scores_type_du_wod')
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('wod_scores_rounds_reps_check', 'wod_scores_done_check')) THEN
    RAISE EXCEPTION 'R : colonnes, garde ou contraintes restantes';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'wod_scores_score_type_check')
     IS DISTINCT FROM 'CHECK ((score_type = ANY (ARRAY[''time''::text, ''reps''::text, ''weight''::text, ''rounds''::text])))' THEN
    RAISE EXCEPTION 'R : contrainte de type d''avant non rétablie';
  END IF;
END $t$;
\i supabase/migrations/20270162000000_wod_score_type.sql
DO $t$
BEGIN
  IF md5(pg_get_functiondef('public.trg_wod_scores_type_du_wod()'::regprocedure)) IS DISTINCT FROM 'b679950418bec9284b627619584ab1f3'
     OR md5(pg_get_functiondef('public.badge_condition_met(uuid, text)'::regprocedure)) IS DISTINCT FROM '3f1be61bc58cf5a0e831ed7cc3812d23'
     OR md5(pg_get_functiondef('public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure)) IS DISTINCT FROM 'c39b912c63312f07deae5ffa4fbddc94' THEN
    RAISE EXCEPTION 'R : la migration rejouée ne redonne pas les mêmes empreintes';
  END IF;
END $t$;

ROLLBACK;
\echo '    ok'
