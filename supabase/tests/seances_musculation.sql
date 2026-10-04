-- ═════════════════════════════════════════════════════════════════════════════
-- Séances de musculation : brouillon, validation en une transaction (migration 20270138)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box X : propriétaire OX (…04), coach CX (…03), athlète A (…01, membre). B (…02) :
-- un autre athlète. WOD w1, w2 (force) et w3 (déjà scoré au temps par A).
-- Records de A au départ : Back Squat 200 kg saisi à la main (sans provenance).
--
--   M1  brouillon : A crée sa séance et ses séries (série commencée sans reps
--       comprise) ; une séance créée validée est refusée ; A ne change ni statut ni
--       charge max ; B ne lit rien et n'écrit pas dans la séance de A ; une série
--       sans séance (chemin historique de l'app actuelle) reste permise ;
--   M2  un brouillon n'a aucun effet : ni score, ni record, ni compteur, ni
--       movement_logs ; le staff ne voit pas les séries d'un brouillon, A si ;
--   M3  validation : refus sans session, sans série valide, WOD inconnu, WOD scoré
--       d'un autre type, séries en double ; une série historique reste écrite,
--       modifiable et visible du coach ; la première validation garde les séries
--       valides seulement, pose la charge max, le score (charge max, box du WOD),
--       le record prouvé et rend premiere_validation ; un record plus haut que sa
--       série est refusé sans rien écrire ;
--   M4  modification : premiere_validation faux, score et séance mis à jour ; un
--       record venu de la séance baisse avec le calcul reçu, ou disparaît (kg NULL) ;
--       non recalculé alors qu'il n'est plus prouvé : refusé, rien d'écrit ; un
--       record retouché à la main au-dessus de sa série ne baisse pas et ne bloque
--       pas ; un record plus bas qu'un record manuel ne le remplace pas ;
--   M5  séance validée : plus d'écriture directe de séries, pas de suppression ;
--       record prouvé par une série d'une autre séance validée : accepté ; par une
--       série de brouillon : refusé ; séance générée : validée sans wod_scores ;
--   M6  séparation : movement_logs, user_movement_stats et total_scores_submitted
--       intacts d'un bout à l'autre ;
--   M7  définitions : policies, droits de la fonction, fonction interne fermée ;
--   M8  retour arrière de l'en-tête : retour exact aux empreintes de prod du
--       29/09/2026 (4 policies 3a807491…, list_athlete_strength_sets 871558a8…,
--       reps obligatoire, source_type), dans une sous-transaction annulée.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Séances de musculation'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9fc-0000000000' || s)::uuid FROM unnest(ARRAY['01','02','03','04']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9fc-0000000000' || s)::uuid, 'smu-' || s || '@test.invalid', 'smu_' || s
  FROM unnest(ARRAY['01','02','03','04']) s;
UPDATE public.profiles SET personal_records = '{"weightlifting_Back Squat": "200"}'::jsonb
 WHERE id = '00000000-0000-4000-a9fc-000000000001';
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9fc-00000000000a', 'Box X', 'SMUX', '00000000-0000-4000-a9fc-000000000004');
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b9fc-00000000000a', ('00000000-0000-4000-a9fc-0000000000' || m)::uuid, r, 'active'
  FROM (VALUES ('01', 'member'), ('03', 'coach'), ('04', 'owner')) v(m, r);
INSERT INTO public.box_wods (id, box_id, title, wod_type, scheduled_date)
SELECT ('00000000-0000-4000-c9fc-00000000000' || n)::uuid, '00000000-0000-4000-b9fc-00000000000a',
       'WOD ' || n, t, CURRENT_DATE
  FROM (VALUES ('1', 'strength'), ('2', 'strength'), ('3', 'for_time')) v(n, t);
INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value)
VALUES ('00000000-0000-4000-c9fc-000000000003', '00000000-0000-4000-a9fc-000000000001',
        '00000000-0000-4000-b9fc-00000000000a', 'time', 300);

-- Exécute `p_sql` sous l'identité `p_qui` (suffixe ou « anon ») ; rend « OK »,
-- « OK <valeur> » pour un SELECT à une valeur, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK'; r text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',
    CASE WHEN p_qui = 'anon' THEN '' ELSE '00000000-0000-4000-a9fc-0000000000' || p_qui END, true);
  PERFORM set_config('request.jwt.claim.role', CASE WHEN p_qui = 'anon' THEN 'anon' ELSE 'authenticated' END, true);
  PERFORM set_config('role', CASE WHEN p_qui = 'anon' THEN 'anon' ELSE 'authenticated' END, true);
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

-- Appel de la validation par A (ou `p_qui`) sur le WOD `p_wod`.
CREATE FUNCTION pg_temp.valider(p_qui text, p_wod text, p_sets text, p_records text DEFAULT '[]',
                                p_type text DEFAULT 'whiteboard') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire(p_qui, format(
    'SELECT public.validate_strength_session(%L, %L::uuid, %L, 3, true, %L::jsonb, %L::jsonb)::text',
    p_type, CASE WHEN p_wod ~ '^[0-9]$' THEN '00000000-0000-4000-c9fc-00000000000' || p_wod ELSE p_wod END,
    'Séance ' || p_wod, p_sets, p_records));
$$;

CREATE FUNCTION pg_temp.pr(k text) RETURNS text LANGUAGE sql AS $$
  SELECT personal_records->>k FROM public.profiles WHERE id = '00000000-0000-4000-a9fc-000000000001';
$$;
CREATE FUNCTION pg_temp.score(n text) RETURNS numeric LANGUAGE sql AS $$
  SELECT score_value FROM public.wod_scores
   WHERE wod_id = ('00000000-0000-4000-c9fc-00000000000' || n)::uuid
     AND member_id = '00000000-0000-4000-a9fc-000000000001';
$$;
CREATE FUNCTION pg_temp.series(n text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(movement || '#' || set_index || '=' || coalesce(reps::text, '-') || 'x' || coalesce(load_kg::text, '-'),
                             ',' ORDER BY movement, set_index), '')
    FROM public.strength_set_logs
   WHERE user_id = '00000000-0000-4000-a9fc-000000000001'
     AND source_id = ('00000000-0000-4000-c9fc-00000000000' || n)::uuid;
$$;

DO $t$
DECLARE
  v text;
  j jsonb;
  s1 text;
  a constant text := '00000000-0000-4000-a9fc-000000000001';
  w1 constant text := '00000000-0000-4000-c9fc-000000000001';
  compteur_avant integer;
BEGIN
  SELECT total_scores_submitted INTO compteur_avant FROM public.profiles WHERE id = a::uuid;

  -- ── M1 : brouillon ───────────────────────────────────────────────────────
  v := pg_temp.faire('01', format($q$INSERT INTO public.strength_sessions (user_id, source_type, source_id, source_title, planned_sets)
                                     VALUES (%L, 'whiteboard', %L, 'WOD 1', 3)$q$, a, w1));
  IF v <> 'OK' THEN RAISE EXCEPTION 'M1 : A ne crée pas son brouillon : %', v; END IF;
  v := pg_temp.faire('01', format($q$INSERT INTO public.strength_sessions (user_id, source_type, source_id, status, validated_at, first_validated_at, max_load_kg)
                                     VALUES (%L, 'whiteboard', '00000000-0000-4000-c9fc-000000000002', 'validated', now(), now(), 100)$q$, a));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'M1 : séance créée validée : %', v; END IF;
  v := pg_temp.faire('01', format($q$INSERT INTO public.strength_set_logs (user_id, source_type, source_id, movement, set_index, reps, load_kg)
                                     VALUES (%L, 'whiteboard', %L, 'back squat', 1, 5, 100),
                                            (%L, 'whiteboard', %L, 'back squat', 2, NULL, 110)$q$, a, w1, a, w1));
  IF v <> 'OK' THEN RAISE EXCEPTION 'M1 : séries du brouillon refusées : %', v; END IF;
  v := pg_temp.faire('01', format($q$UPDATE public.strength_sessions SET status = 'validated' WHERE source_id = %L$q$, w1));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'M1 : A change le statut : %', v; END IF;
  v := pg_temp.faire('01', format($q$UPDATE public.strength_sessions SET max_load_kg = 300 WHERE source_id = %L$q$, w1));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'M1 : A change la charge max : %', v; END IF;
  v := pg_temp.faire('01', format($q$UPDATE public.strength_sessions SET planned_sets = 4, updated_at = now() WHERE source_id = %L$q$, w1));
  IF v <> 'OK' OR (SELECT planned_sets FROM public.strength_sessions WHERE source_id = w1::uuid) <> 4 THEN
    RAISE EXCEPTION 'M1 : A ne met pas à jour ses séries prévues : %', v;
  END IF;
  v := pg_temp.faire('02', 'SELECT count(*) FROM public.strength_sessions');
  IF v <> 'OK 0' THEN RAISE EXCEPTION 'M1 : B lit les séances de A : %', v; END IF;
  v := pg_temp.faire('02', 'SELECT count(*) FROM public.strength_set_logs');
  IF v <> 'OK 0' THEN RAISE EXCEPTION 'M1 : B lit les séries de A : %', v; END IF;
  v := pg_temp.faire('02', format($q$INSERT INTO public.strength_set_logs (user_id, source_type, source_id, movement, set_index, reps, load_kg)
                                     VALUES (%L, 'whiteboard', %L, 'back squat', 3, 5, 100)$q$, a, w1));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'M1 : B écrit dans la séance de A : %', v; END IF;
  -- Chemin historique (app actuelle, builds installés) : une série sans séance,
  -- écrite au moment du score, reste permise pour soi.
  v := pg_temp.faire('02', format($q$INSERT INTO public.strength_set_logs (user_id, source_type, source_id, movement, set_index, reps, load_kg)
                                     VALUES ('00000000-0000-4000-a9fc-000000000002', 'whiteboard', %L, 'back squat', 1, 5, 100)$q$, w1));
  IF v <> 'OK' THEN RAISE EXCEPTION 'M1 : série sans séance (chemin historique) refusée : %', v; END IF;

  -- ── M2 : un brouillon n'a aucun effet ────────────────────────────────────
  IF pg_temp.score('1') IS NOT NULL THEN RAISE EXCEPTION 'M2 : un brouillon a écrit un score'; END IF;
  IF (SELECT personal_records FROM public.profiles WHERE id = a::uuid) <> '{"weightlifting_Back Squat": "200"}'::jsonb THEN
    RAISE EXCEPTION 'M2 : un brouillon a touché aux records';
  END IF;
  v := pg_temp.faire('03', format('SELECT count(*) FROM public.list_athlete_strength_sets(%L)', a));
  IF v <> 'OK 0' THEN RAISE EXCEPTION 'M2 : le coach voit un brouillon : %', v; END IF;
  v := pg_temp.faire('01', format('SELECT count(*) FROM public.list_athlete_strength_sets(%L)', a));
  IF v <> 'OK 2' THEN RAISE EXCEPTION 'M2 : A ne voit pas son brouillon : %', v; END IF;

  -- ── M3 : validation ─────────────────────────────────────────────────────
  v := pg_temp.valider('anon', '1', '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":100}]');
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'M3 : anon valide : %', v; END IF;
  -- Depuis 20270145, une série sans charge compte si aucune charge n'était
  -- prescrite (gymnastique) : ici la charge est prescrite, la série reste vide.
  v := pg_temp.valider('01', '1', '[{"movement":"back squat","set_index":1,"reps":null,"load_kg":100},{"movement":"back squat","set_index":2,"reps":5,"load_kg":"","prescribed_load_kg":100}]');
  IF v NOT LIKE '22023: SEANCE_VIDE%' THEN RAISE EXCEPTION 'M3 : séance vide : %', v; END IF;
  v := pg_temp.valider('01', '00000000-0000-4000-c9fc-00000000000f', '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":100}]');
  IF v NOT LIKE 'P0002: WOD_INTROUVABLE%' THEN RAISE EXCEPTION 'M3 : WOD inconnu : %', v; END IF;
  v := pg_temp.valider('01', '3', '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":100}]');
  IF v NOT LIKE '22023: SCORE_AUTRE_TYPE%' THEN RAISE EXCEPTION 'M3 : WOD scoré au temps : %', v; END IF;
  v := pg_temp.valider('01', '1', '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":100},{"movement":"back squat","set_index":1,"reps":3,"load_kg":110}]');
  IF v NOT LIKE '22023: SERIES_EN_DOUBLE%' THEN RAISE EXCEPTION 'M3 : séries en double : %', v; END IF;
  -- Au-delà de 10 reps, Epley ne prouve aucun 1RM : refusé.
  v := pg_temp.valider('01', '1', '[{"movement":"deadlift","set_index":1,"reps":12,"load_kg":100}]',
    '[{"label":"Deadlift","kg":100,"movement":"deadlift","set_index":1}]');
  IF v NOT LIKE '22023: RECORD_NON_PROUVE%' THEN RAISE EXCEPTION 'M3 : 1RM prouvé par 12 reps : %', v; END IF;
  -- Record plus haut que sa série (110 × 3 → 121) : refusé, rien d'écrit.
  v := pg_temp.valider('01', '1',
    '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":100},{"movement":"back squat","set_index":2,"reps":3,"load_kg":110},{"movement":"deadlift","set_index":1,"reps":1,"load_kg":150}]',
    '[{"label":"Deadlift","kg":150.5,"movement":"deadlift","set_index":1}]');
  IF v NOT LIKE '22023: RECORD_NON_PROUVE%' THEN RAISE EXCEPTION 'M3 : record non prouvé accepté : %', v; END IF;
  IF pg_temp.score('1') IS NOT NULL OR pg_temp.series('1') <> 'back squat#1=5x100.00,back squat#2=-x110.00'
     OR (SELECT status FROM public.strength_sessions WHERE source_id = w1::uuid) <> 'draft' THEN
    RAISE EXCEPTION 'M3 : un refus a laissé une écriture partielle (%)', pg_temp.series('1');
  END IF;

  v := pg_temp.valider('01', '1',
    '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":100},{"movement":"back squat","set_index":2,"reps":3,"load_kg":110},{"movement":"back squat","set_index":3,"reps":null,"load_kg":null},{"movement":"back squat","set_index":4,"reps":0,"load_kg":100},{"movement":"back squat","set_index":5,"reps":501,"load_kg":100},{"movement":"deadlift","set_index":1,"reps":1,"load_kg":150}]',
    '[{"label":"Back Squat","kg":121,"movement":"back squat","set_index":2},{"label":"Deadlift","kg":150,"movement":"deadlift","set_index":1}]');
  IF v NOT LIKE 'OK %' THEN RAISE EXCEPTION 'M3 : validation refusée : %', v; END IF;
  j := substr(v, 4)::jsonb;
  IF NOT (j->>'premiere_validation')::boolean OR (j->>'max_load_kg')::numeric <> 150 OR (j->>'series_valides')::int <> 3 THEN
    RAISE EXCEPTION 'M3 : retour de la validation : %', j;
  END IF;
  IF pg_temp.series('1') <> 'back squat#1=5x100.00,back squat#2=3x110.00,deadlift#1=1x150.00' THEN
    RAISE EXCEPTION 'M3 : séries gardées : %', pg_temp.series('1');
  END IF;
  IF pg_temp.score('1') <> 150
     OR (SELECT box_id FROM public.wod_scores WHERE wod_id = w1::uuid AND member_id = a::uuid) <> '00000000-0000-4000-b9fc-00000000000a'
     OR (SELECT score_type FROM public.wod_scores WHERE wod_id = w1::uuid AND member_id = a::uuid) <> 'weight' THEN
    RAISE EXCEPTION 'M3 : score : %', pg_temp.score('1');
  END IF;
  IF (SELECT status || '|' || max_load_kg || '|' || (first_validated_at IS NOT NULL) FROM public.strength_sessions WHERE source_id = w1::uuid)
     <> 'validated|150.00|true' THEN
    RAISE EXCEPTION 'M3 : séance après validation';
  END IF;
  SELECT id::text INTO s1 FROM public.strength_set_logs WHERE source_id = w1::uuid AND movement = 'deadlift';
  IF pg_temp.pr('weightlifting_Deadlift') <> '150' OR pg_temp.pr('weightlifting_Deadlift_src') <> s1
     OR pg_temp.pr('weightlifting_Back Squat') <> '200' OR pg_temp.pr('weightlifting_Back Squat_src') IS NOT NULL THEN
    RAISE EXCEPTION 'M3 : records : %', (SELECT personal_records FROM public.profiles WHERE id = a::uuid);
  END IF;
  v := pg_temp.faire('03', format('SELECT count(*) FROM public.list_athlete_strength_sets(%L)', a));
  IF v <> 'OK 3' THEN RAISE EXCEPTION 'M3 : le coach ne voit pas la séance validée : %', v; END IF;
  -- Série sans séance (chemin historique) : écrite, modifiable, visible du coach.
  v := pg_temp.faire('01', format($q$INSERT INTO public.strength_set_logs (user_id, source_type, source_id, movement, set_index, reps, load_kg)
                                     VALUES (%L, 'whiteboard', '00000000-0000-4000-c9fc-000000000002', 'row', 1, 10, 50)$q$, a));
  IF v <> 'OK' THEN RAISE EXCEPTION 'M3 : série historique refusée : %', v; END IF;
  v := pg_temp.faire('01', $q$UPDATE public.strength_set_logs SET load_kg = 55 WHERE movement = 'row'$q$);
  IF v <> 'OK' OR (SELECT load_kg FROM public.strength_set_logs WHERE movement = 'row') <> 55 THEN
    RAISE EXCEPTION 'M3 : série historique non modifiable : %', v;
  END IF;
  v := pg_temp.faire('03', format('SELECT count(*) FROM public.list_athlete_strength_sets(%L)', a));
  IF v <> 'OK 4' THEN RAISE EXCEPTION 'M3 : le coach ne voit pas la série historique : %', v; END IF;

  -- ── M4 : modification ───────────────────────────────────────────────────
  -- Deadlift corrigé à 120 sans recalcul : le record (150, venu d'ici) n'est plus prouvé.
  v := pg_temp.valider('01', '1',
    '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":100},{"movement":"back squat","set_index":2,"reps":3,"load_kg":110},{"movement":"deadlift","set_index":1,"reps":1,"load_kg":120}]');
  IF v NOT LIKE '22023: RECORD_A_RECALCULER%' THEN RAISE EXCEPTION 'M4 : record non recalculé accepté : %', v; END IF;
  IF pg_temp.score('1') <> 150 OR pg_temp.series('1') NOT LIKE '%deadlift#1=1x150.00' THEN
    RAISE EXCEPTION 'M4 : un refus a laissé une écriture partielle';
  END IF;
  -- Avec le recalcul : le record baisse, la provenance suit, le score suit.
  v := pg_temp.valider('01', '1',
    '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":100},{"movement":"back squat","set_index":2,"reps":3,"load_kg":110},{"movement":"deadlift","set_index":1,"reps":1,"load_kg":120}]',
    '[{"label":"Deadlift","kg":120,"movement":"deadlift","set_index":1}]');
  IF v NOT LIKE 'OK %' OR (substr(v, 4)::jsonb->>'premiere_validation')::boolean THEN
    RAISE EXCEPTION 'M4 : modification : %', v;
  END IF;
  IF pg_temp.pr('weightlifting_Deadlift') <> '120' OR pg_temp.pr('weightlifting_Deadlift_src') <> s1
     OR pg_temp.score('1') <> 120 OR (SELECT max_load_kg FROM public.strength_sessions WHERE source_id = w1::uuid) <> 120 THEN
    RAISE EXCEPTION 'M4 : baisse : % / score %', pg_temp.pr('weightlifting_Deadlift'), pg_temp.score('1');
  END IF;
  -- Le deadlift disparaît de la séance : kg NULL, le record disparaît.
  v := pg_temp.valider('01', '1',
    '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":100},{"movement":"back squat","set_index":2,"reps":3,"load_kg":110}]',
    '[{"label":"Deadlift","kg":null}]');
  IF v NOT LIKE 'OK %' OR pg_temp.pr('weightlifting_Deadlift') IS NOT NULL OR pg_temp.pr('weightlifting_Deadlift_src') IS NOT NULL
     OR pg_temp.pr('weightlifting_Deadlift_date') IS NOT NULL THEN
    RAISE EXCEPTION 'M4 : record non retiré : % / %', v, pg_temp.pr('weightlifting_Deadlift');
  END IF;
  -- Record retouché à la main (300) en gardant la provenance d'une série qui ne
  -- prouve que 121 : ni baissé, ni bloquant.
  UPDATE public.profiles SET personal_records = personal_records
    || jsonb_build_object('weightlifting_Back Squat', '300',
         'weightlifting_Back Squat_src', (SELECT id::text FROM public.strength_set_logs WHERE source_id = w1::uuid AND movement = 'back squat' AND set_index = 2))
   WHERE id = a::uuid;
  v := pg_temp.valider('01', '1',
    '[{"movement":"back squat","set_index":1,"reps":5,"load_kg":90},{"movement":"back squat","set_index":2,"reps":3,"load_kg":100}]',
    '[{"label":"Back Squat","kg":110,"movement":"back squat","set_index":2}]');
  IF v NOT LIKE 'OK %' OR pg_temp.pr('weightlifting_Back Squat') <> '300' THEN
    RAISE EXCEPTION 'M4 : record manuel baissé ou bloquant : % / %', v, pg_temp.pr('weightlifting_Back Squat');
  END IF;

  -- ── M5 : séance validée, autres sources ──────────────────────────────────
  v := pg_temp.faire('01', format($q$INSERT INTO public.strength_set_logs (user_id, source_type, source_id, movement, set_index, reps, load_kg)
                                     VALUES (%L, 'whiteboard', %L, 'back squat', 9, 5, 100)$q$, a, w1));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'M5 : écriture directe dans une séance validée : %', v; END IF;
  v := pg_temp.faire('01', format($q$UPDATE public.strength_set_logs SET load_kg = 400 WHERE source_id = %L$q$, w1));
  IF v <> 'OK' OR EXISTS (SELECT 1 FROM public.strength_set_logs WHERE load_kg = 400) THEN
    RAISE EXCEPTION 'M5 : modification directe d''une séance validée : %', v;
  END IF;
  -- Repasser une séance validée en brouillon rouvrirait une « première » validation.
  v := pg_temp.faire('01', format($q$UPDATE public.strength_sessions
    SET status = 'draft', validated_at = NULL, first_validated_at = NULL, max_load_kg = NULL WHERE source_id = %L$q$, w1));
  IF v <> 'OK' OR (SELECT status FROM public.strength_sessions WHERE source_id = w1::uuid) <> 'validated' THEN
    RAISE EXCEPTION 'M5 : séance validée repassée en brouillon : %', v;
  END IF;
  v := pg_temp.faire('01', format($q$DELETE FROM public.strength_sessions WHERE source_id = %L$q$, w1));
  IF v <> 'OK' OR NOT EXISTS (SELECT 1 FROM public.strength_sessions WHERE source_id = w1::uuid) THEN
    RAISE EXCEPTION 'M5 : séance validée supprimée : %', v;
  END IF;
  -- Record prouvé par une série d'une autre séance validée (w1, 100 × 3 → 110).
  v := pg_temp.valider('01', '2', '[{"movement":"front squat","set_index":1,"reps":5,"load_kg":80}]',
    format('[{"label":"Front Squat","kg":110,"log_id":"%s"}]',
           (SELECT id FROM public.strength_set_logs WHERE source_id = w1::uuid AND set_index = 2)));
  IF v NOT LIKE 'OK %' OR pg_temp.pr('weightlifting_Front Squat') <> '110' THEN
    RAISE EXCEPTION 'M5 : record prouvé par une autre séance validée : % / %', v, pg_temp.pr('weightlifting_Front Squat');
  END IF;
  -- … mais pas par une série de brouillon.
  PERFORM pg_temp.faire('01', format($q$INSERT INTO public.strength_sessions (user_id, source_type, source_id) VALUES (%L, 'generated', '00000000-0000-4000-d9fc-000000000001')$q$, a));
  PERFORM pg_temp.faire('01', format($q$INSERT INTO public.strength_set_logs (user_id, source_type, source_id, movement, set_index, reps, load_kg)
                                        VALUES (%L, 'generated', '00000000-0000-4000-d9fc-000000000001', 'bench press', 1, 1, 200)$q$, a));
  v := pg_temp.valider('01', '2', '[{"movement":"front squat","set_index":1,"reps":5,"load_kg":80}]',
    format('[{"label":"Bench Press","kg":200,"log_id":"%s"}]',
           (SELECT id FROM public.strength_set_logs WHERE source_type = 'generated')));
  IF v NOT LIKE '22023: RECORD_NON_PROUVE%' THEN RAISE EXCEPTION 'M5 : record prouvé par un brouillon : %', v; END IF;
  -- Séance générée : validée, sans wod_scores.
  v := pg_temp.valider('01', '00000000-0000-4000-d9fc-000000000001',
    '[{"movement":"bench press","set_index":1,"reps":1,"load_kg":80}]', '[]', 'generated');
  IF v NOT LIKE 'OK %' OR EXISTS (SELECT 1 FROM public.wod_scores WHERE wod_id = '00000000-0000-4000-d9fc-000000000001')
     OR (SELECT status FROM public.strength_sessions WHERE source_type = 'generated') <> 'validated' THEN
    RAISE EXCEPTION 'M5 : séance générée : %', v;
  END IF;

  -- ── M6 : séparation et compteurs ─────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM public.movement_logs WHERE user_id = a::uuid)
     OR EXISTS (SELECT 1 FROM public.user_movement_stats WHERE user_id = a::uuid) THEN
    RAISE EXCEPTION 'M6 : la validation a écrit dans movement_logs ou user_movement_stats';
  END IF;
  IF (SELECT total_scores_submitted FROM public.profiles WHERE id = a::uuid) IS DISTINCT FROM compteur_avant THEN
    RAISE EXCEPTION 'M6 : la validation a touché total_scores_submitted';
  END IF;

  RAISE NOTICE 'séances de musculation : M1 à M6 conformes';
END $t$;

-- ── M7 : définitions ─────────────────────────────────────────────────────────
SET LOCAL search_path TO "$user", public, extensions;

DO $t$
BEGIN
  IF has_function_privilege('anon', 'public.validate_strength_session(text,uuid,text,integer,boolean,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.validate_strength_session(text,uuid,text,integer,boolean,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'internal.estimation_1rm(numeric,integer)', 'EXECUTE')
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.validate_strength_session(text,uuid,text,integer,boolean,jsonb,jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'M7 : droits des fonctions';
  END IF;
  IF has_table_privilege('anon', 'public.strength_sessions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.strength_sessions', 'TRUNCATE')
     OR EXISTS (SELECT 1 FROM pg_attribute a, aclexplode(a.attacl) x
                 WHERE a.attrelid = 'public.strength_sessions'::regclass
                   AND x.grantee IN ('anon'::regrole, 'authenticated'::regrole))
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.strength_sessions'::regclass) THEN
    RAISE EXCEPTION 'M7 : droits de strength_sessions';
  END IF;
  IF (SELECT md5(pg_get_expr(polqual, polrelid)) FROM pg_policy
       WHERE polrelid = 'public.strength_set_logs'::regclass AND polname = 'strength_sets_own_read')
     <> '3a807491e0a912fbfbee0ffa087b82f6' THEN
    RAISE EXCEPTION 'M7 : la lecture de ses séries a changé';
  END IF;
  RAISE NOTICE 'séances de musculation : M7 conforme';
END $t$;

-- ── M8 : retour arrière de l'en-tête, contre les empreintes de prod ─────────
DO $t$
DECLARE v text;
BEGIN
  BEGIN
    DROP FUNCTION public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb);
    DROP FUNCTION internal.estimation_1rm(numeric, integer);
    -- 20270145 a changé son type de retour (is_added) : la définition d'origine
    -- ne peut plus la remplacer en place.
    DROP FUNCTION public.list_athlete_strength_sets(uuid, integer);
    CREATE OR REPLACE FUNCTION public.list_athlete_strength_sets(
      p_user_id uuid,
      p_limit   integer DEFAULT 200
    )
    RETURNS TABLE (
      id                 uuid,
      source_type        text,
      source_id          uuid,
      source_title       text,
      movement           text,
      movement_label     text,
      set_index          integer,
      reps               integer,
      load_kg            numeric,
      prescribed_reps    integer,
      prescribed_load_kg numeric,
      performed_at       timestamptz
    )
    LANGUAGE plpgsql
    STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  IF p_user_id <> auth.uid()
     AND NOT EXISTS (
       SELECT 1
       FROM public.box_members bm_athlete
       JOIN public.box_members bm_staff ON bm_staff.box_id = bm_athlete.box_id
       WHERE bm_athlete.member_id = p_user_id
         AND bm_athlete.status = 'active'
         AND bm_staff.member_id = auth.uid()
         AND bm_staff.status = 'active'
         AND bm_staff.role IN ('owner', 'coach')
     )
     AND NOT EXISTS (
       -- gérant principal, qui n'a pas toujours de ligne box_members
       SELECT 1
       FROM public.box_members bm
       JOIN public.boxes b ON b.id = bm.box_id
       WHERE bm.member_id = p_user_id
         AND bm.status = 'active'
         AND b.owner_id = auth.uid()
     )
  THEN
    RAISE EXCEPTION 'Accès refusé : staff de la box de l''athlète requis'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id, s.source_type, s.source_id, s.source_title, s.movement,
         s.movement_label, s.set_index, s.reps, s.load_kg,
         s.prescribed_reps, s.prescribed_load_kg, s.performed_at
  FROM public.strength_set_logs s
  WHERE s.user_id = p_user_id
  ORDER BY s.performed_at DESC, s.movement, s.set_index
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
END;
$function$;
    ALTER POLICY strength_sets_own_insert ON public.strength_set_logs WITH CHECK (user_id = auth.uid());
    ALTER POLICY strength_sets_own_update ON public.strength_set_logs
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    ALTER POLICY strength_sets_own_delete ON public.strength_set_logs USING (user_id = auth.uid());
    DELETE FROM public.strength_set_logs WHERE reps IS NULL OR source_type = 'generated';
    ALTER TABLE public.strength_set_logs ALTER COLUMN reps SET NOT NULL;
    ALTER TABLE public.strength_set_logs DROP CONSTRAINT strength_set_logs_source_type_check;
    ALTER TABLE public.strength_set_logs ADD CONSTRAINT strength_set_logs_source_type_check
      CHECK (source_type = ANY (ARRAY['whiteboard'::text, 'program'::text]));
    DROP TABLE public.strength_sessions;

    SELECT string_agg(polname || '|' || md5(coalesce(pg_get_expr(polqual, polrelid), '')) || '|'
                      || md5(coalesce(pg_get_expr(polwithcheck, polrelid), '')), ',' ORDER BY polname) INTO v
      FROM pg_policy WHERE polrelid = 'public.strength_set_logs'::regclass;
    IF v IS DISTINCT FROM
       'strength_sets_own_delete|3a807491e0a912fbfbee0ffa087b82f6|d41d8cd98f00b204e9800998ecf8427e,'
       'strength_sets_own_insert|d41d8cd98f00b204e9800998ecf8427e|3a807491e0a912fbfbee0ffa087b82f6,'
       'strength_sets_own_read|3a807491e0a912fbfbee0ffa087b82f6|d41d8cd98f00b204e9800998ecf8427e,'
       'strength_sets_own_update|3a807491e0a912fbfbee0ffa087b82f6|3a807491e0a912fbfbee0ffa087b82f6' THEN
      RAISE EXCEPTION 'M8 : policies après retour arrière ≠ prod : %', v;
    END IF;
    v := md5(pg_get_functiondef('public.list_athlete_strength_sets(uuid,integer)'::regprocedure));
    IF v <> '871558a8d650613413328abd505305aa' THEN
      RAISE EXCEPTION 'M8 : list_athlete_strength_sets après retour arrière ≠ prod (%)', v;
    END IF;
    IF (SELECT is_nullable FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'strength_set_logs' AND column_name = 'reps') <> 'NO'
       OR (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'strength_set_logs_source_type_check')
          <> 'CHECK ((source_type = ANY (ARRAY[''whiteboard''::text, ''program''::text])))'
       OR to_regclass('public.strength_sessions') IS NOT NULL
       OR to_regprocedure('internal.estimation_1rm(numeric,integer)') IS NOT NULL THEN
      RAISE EXCEPTION 'M8 : table ou colonnes après retour arrière ≠ prod';
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0M08', MESSAGE = 'retour arrière conforme';
  EXCEPTION WHEN SQLSTATE 'P0M08' THEN
    RAISE NOTICE 'séances de musculation : M8 conforme (retour arrière annulé)';
  END;
  IF to_regclass('public.strength_sessions') IS NULL THEN
    RAISE EXCEPTION 'M8 : le retour arrière n''a pas été annulé';
  END IF;
END $t$;

ROLLBACK;
