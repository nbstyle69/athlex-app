-- ═════════════════════════════════════════════════════════════════════════════
-- Gymnastique (G2) : validation sans charge, reps totales, séries ajoutées,
-- record de gymnastique confirmé (migration 20270145)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box X : propriétaire (…04), coach (…03), athlète A (…01, membre), B (…02, autre
-- athlète). WOD w1 (gymnastique seule), w2 (mixte), w3 (brouillon), w4 (B).
-- Records de A au départ : Pull-ups 20 (clé moderne), Dips 15 (clé historique
-- « Gymnastics_ »), Back Squat 200 kg.
--
--   G1  séance sans charge validée (plus de SEANCE_VIDE), séries gardées ;
--   G2  total_reps calculé par le serveur seul (valeur reçue ignorée, écriture
--       directe refusée par les policies) ;
--   G3  charge exigée : série à charge prescrite sans charge écartée, série sans
--       charge marquée load_required écartée (seule : SEANCE_VIDE ; dans une
--       séance mixte : ignorée), la même sans la clé acceptée ; charge max
--       présente dès qu'une série chargée existe, contrainte statut_coherent ;
--   G4  séance mixte : score en charge inchangé, reps totales en plus ;
--   G5  aucune ligne wod_scores pour une séance sans charge (même revalidée) ;
--   G6  is_added : posé depuis p_sets, sans reps prévues (CHECK), renvoyé par
--       list_athlete_strength_sets (athlète et coach) ;
--   G7  confirm_gym_record : non prouvé, autre athlète, brouillon, série chargée,
--       autre mouvement, non gymnique, non amélioré (clé moderne et historique),
--       jamais abaissé, valeur = reps de la série, format (clé, date, source),
--       abréviation rapprochée, anon refusé ;
--   G8  rapprochement des noms : mêmes exemples que gymPercentReps.test.ts ;
--   G9  séparation : movement_logs, user_movement_stats, total_scores_submitted
--       intacts ;
--   G10 définitions et droits : confirm_gym_record (authenticated seul, SECURITY
--       DEFINER, search_path), internal fermé, list_athlete_strength_sets figée
--       (définition, droits, commentaire) ;
--   R   retour arrière (supabase/retours/…) : retour exact aux empreintes de prod
--       du 04/10/2026 ; une séance sans charge redevient un brouillon.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Gymnastique : validation sans charge, record confirmé'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9e1-0000000000' || s)::uuid FROM unnest(ARRAY['01','02','03','04']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9e1-0000000000' || s)::uuid, 'gym-' || s || '@test.invalid', 'gym_' || s
  FROM unnest(ARRAY['01','02','03','04']) s;
UPDATE public.profiles
   SET personal_records = '{"gymnastics_Pull-ups": "20", "gymnastics_Pull-ups_date": "2026-09-01", "Gymnastics_Dips": "15", "weightlifting_Back Squat": "200"}'::jsonb
 WHERE id = '00000000-0000-4000-a9e1-000000000001';
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9e1-00000000000a', 'Box X', 'GYMX', '00000000-0000-4000-a9e1-000000000004');
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b9e1-00000000000a', ('00000000-0000-4000-a9e1-0000000000' || m)::uuid, r, 'active'
  FROM (VALUES ('01', 'member'), ('02', 'member'), ('03', 'coach'), ('04', 'owner')) v(m, r);
INSERT INTO public.box_wods (id, box_id, title, wod_type, scheduled_date)
SELECT ('00000000-0000-4000-c9e1-00000000000' || n)::uuid, '00000000-0000-4000-b9e1-00000000000a',
       'WOD ' || n, 'strength', CURRENT_DATE
  FROM unnest(ARRAY['1', '2', '3', '4', '5']) n;

CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK'; r text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',
    CASE WHEN p_qui = 'anon' THEN '' ELSE '00000000-0000-4000-a9e1-0000000000' || p_qui END, true);
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

CREATE FUNCTION pg_temp.valider(p_qui text, p_wod text, p_sets text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire(p_qui, format(
    'SELECT public.validate_strength_session(%L, %L::uuid, %L, 3, true, %L::jsonb, %L::jsonb)::text',
    'whiteboard', '00000000-0000-4000-c9e1-00000000000' || p_wod, 'Séance ' || p_wod, p_sets, '[]'));
$$;
CREATE FUNCTION pg_temp.confirmer(p_qui text, p_log uuid, p_label text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire(p_qui, format('SELECT public.confirm_gym_record(%L::uuid, %L)::text', p_log, p_label));
$$;
CREATE FUNCTION pg_temp.pr(k text) RETURNS text LANGUAGE sql AS $$
  SELECT personal_records->>k FROM public.profiles WHERE id = '00000000-0000-4000-a9e1-000000000001';
$$;
CREATE FUNCTION pg_temp.serie(p_qui text, p_wod text, p_mvt text, p_idx integer) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.strength_set_logs
   WHERE user_id = ('00000000-0000-4000-a9e1-0000000000' || p_qui)::uuid
     AND source_id = ('00000000-0000-4000-c9e1-00000000000' || p_wod)::uuid
     AND movement = p_mvt AND set_index = p_idx;
$$;
CREATE FUNCTION pg_temp.seance(p_qui text, p_wod text) RETURNS text LANGUAGE sql AS $$
  SELECT status || '|' || coalesce(max_load_kg::text, '-') || '|' || coalesce(total_reps::text, '-')
    FROM public.strength_sessions
   WHERE user_id = ('00000000-0000-4000-a9e1-0000000000' || p_qui)::uuid
     AND source_id = ('00000000-0000-4000-c9e1-00000000000' || p_wod)::uuid;
$$;
CREATE FUNCTION pg_temp.scores(p_wod text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(score_type || '=' || score_value, ','), '')
    FROM public.wod_scores
   WHERE wod_id = ('00000000-0000-4000-c9e1-00000000000' || p_wod)::uuid
     AND member_id = '00000000-0000-4000-a9e1-000000000001';
$$;

DO $t$
DECLARE
  v text;
  j jsonb;
  a constant text := '00000000-0000-4000-a9e1-000000000001';
  compteur_avant integer;
  s_pu25 uuid; s_pu12 uuid; s_pu22 uuid; s_t2b uuid; s_burpee uuid; s_rmu uuid; s_dips uuid;
  s_squat uuid; s_b uuid; s_brouillon uuid;
BEGIN
  SELECT total_scores_submitted INTO compteur_avant FROM public.profiles WHERE id = a::uuid;

  -- ── G1 : séance sans charge validée ─────────────────────────────────────
  v := pg_temp.valider('01', '1', $j$[
    {"movement":"Pull-ups","set_index":1,"reps":12,"load_kg":null,"prescribed_reps":12},
    {"movement":"Pull-ups","set_index":2,"reps":22,"prescribed_reps":12},
    {"movement":"Pull-ups","set_index":3,"reps":25,"load_kg":"","is_added":true,"prescribed_reps":12},
    {"movement":"Toes to Bar","set_index":1,"reps":9,"load_kg":null},
    {"movement":"Burpees","set_index":1,"reps":30,"load_kg":null},
    {"movement":"RMU","set_index":1,"reps":4,"load_kg":null},
    {"movement":"Dips","set_index":1,"reps":12,"load_kg":null},
    {"movement":"Pull-ups","set_index":4,"reps":"","load_kg":null}
  ]$j$);
  IF v NOT LIKE 'OK %' THEN RAISE EXCEPTION 'G1 : séance sans charge refusée : %', v; END IF;
  j := substr(v, 4)::jsonb;
  IF j->>'max_load_kg' IS NOT NULL OR (j->>'series_valides')::int IS DISTINCT FROM 7 OR (j->>'premiere_validation')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'G1 : réponse inattendue : %', j;
  END IF;
  IF pg_temp.seance('01', '1') IS DISTINCT FROM 'validated|-|114' THEN
    RAISE EXCEPTION 'G1 : séance %', pg_temp.seance('01', '1');
  END IF;
  IF (SELECT count(*) FROM public.strength_set_logs WHERE user_id = a::uuid AND load_kg IS NULL) IS DISTINCT FROM 7 THEN
    RAISE EXCEPTION 'G1 : séries sans charge non gardées';
  END IF;

  -- ── G2 : total_reps calculé par le serveur seul ─────────────────────────
  IF (j->>'total_reps')::int IS DISTINCT FROM 12 + 22 + 25 + 9 + 30 + 4 + 12 THEN
    RAISE EXCEPTION 'G2 : total_reps %', j->>'total_reps';
  END IF;
  v := pg_temp.valider('01', '1', $j$[
    {"movement":"Pull-ups","set_index":1,"reps":12,"prescribed_reps":12,"total_reps":999},
    {"movement":"Pull-ups","set_index":2,"reps":22},
    {"movement":"Pull-ups","set_index":3,"reps":25,"is_added":true},
    {"movement":"Toes to Bar","set_index":1,"reps":9},
    {"movement":"Burpees","set_index":1,"reps":30},
    {"movement":"RMU","set_index":1,"reps":4},
    {"movement":"Dips","set_index":1,"reps":12}
  ]$j$);
  IF v NOT LIKE 'OK %' OR pg_temp.seance('01', '1') IS DISTINCT FROM 'validated|-|114'
     OR (substr(v, 4)::jsonb->>'premiere_validation')::boolean THEN
    RAISE EXCEPTION 'G2 : revalidation : % / %', v, pg_temp.seance('01', '1');
  END IF;
  v := pg_temp.faire('01', format($q$INSERT INTO public.strength_sessions (user_id, source_type, source_id, total_reps)
                                     VALUES (%L, 'whiteboard', '00000000-0000-4000-c9e1-000000000003', 50)$q$, a));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'G2 : brouillon créé avec des reps totales : %', v; END IF;
  v := pg_temp.faire('01', format($q$INSERT INTO public.strength_sessions (user_id, source_type, source_id)
                                     VALUES (%L, 'whiteboard', '00000000-0000-4000-c9e1-000000000003')$q$, a));
  IF v IS DISTINCT FROM 'OK' THEN RAISE EXCEPTION 'G2 : brouillon refusé : %', v; END IF;
  v := pg_temp.faire('01', $q$UPDATE public.strength_sessions SET total_reps = 50
                              WHERE source_id = '00000000-0000-4000-c9e1-000000000003'$q$);
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'G2 : reps totales écrites en direct : %', v; END IF;

  -- ── G3 : charge exigée dès qu'elle est prescrite ou qu'une série la porte ──
  v := pg_temp.valider('01', '2', '[{"movement":"Back Squat","set_index":1,"reps":5,"load_kg":"","prescribed_load_kg":100}]');
  IF v NOT LIKE '22023: SEANCE_VIDE%' THEN RAISE EXCEPTION 'G3 : charge prescrite non exigée : %', v; END IF;
  -- Ligne en %1RM sans 1RM connu : pas de charge prévue, mais l'app dit load_required.
  v := pg_temp.valider('01', '2', '[{"movement":"Back Squat","set_index":1,"reps":5,"load_required":true}]');
  IF v NOT LIKE '22023: SEANCE_VIDE%' THEN RAISE EXCEPTION 'G3 : série load_required sans charge acceptée : %', v; END IF;
  -- La même série sans la clé (ancien client, ou ligne sans charge) : acceptée.
  v := pg_temp.valider('01', '5', '[{"movement":"Back Squat","set_index":1,"reps":5}]');
  IF v NOT LIKE 'OK %' OR pg_temp.seance('01', '5') IS DISTINCT FROM 'validated|-|5' THEN
    RAISE EXCEPTION 'G3 : série sans clé refusée : % / %', v, pg_temp.seance('01', '5');
  END IF;
  BEGIN
    UPDATE public.strength_sessions SET total_reps = NULL
     WHERE user_id = a::uuid AND source_id = '00000000-0000-4000-c9e1-000000000001';
    RAISE EXCEPTION 'G3 : séance validée sans charge ni reps acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- ── G4 : séance mixte, score en charge inchangé ─────────────────────────
  v := pg_temp.valider('01', '2', $j$[
    {"movement":"Back Squat","set_index":1,"reps":5,"load_kg":100,"prescribed_reps":5,"prescribed_load_kg":100},
    {"movement":"Back Squat","set_index":2,"reps":5,"load_kg":90,"prescribed_reps":5,"prescribed_load_kg":100},
    {"movement":"Back Squat","set_index":3,"reps":5,"load_kg":"","prescribed_reps":5,"prescribed_load_kg":100},
    {"movement":"Pull-ups","set_index":1,"reps":10,"load_kg":null},
    {"movement":"Back Squat","set_index":4,"reps":5,"load_kg":"","load_required":true}
  ]$j$);
  IF v NOT LIKE 'OK %' THEN RAISE EXCEPTION 'G4 : séance mixte refusée : %', v; END IF;
  j := substr(v, 4)::jsonb;
  IF (j->>'max_load_kg')::numeric IS DISTINCT FROM 100 OR (j->>'total_reps')::int IS DISTINCT FROM 10 OR (j->>'series_valides')::int IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'G4 : réponse %', j;
  END IF;
  IF pg_temp.seance('01', '2') IS DISTINCT FROM 'validated|100.00|10' OR pg_temp.scores('2') IS DISTINCT FROM 'weight=100' THEN
    RAISE EXCEPTION 'G4 : séance % / score %', pg_temp.seance('01', '2'), pg_temp.scores('2');
  END IF;

  -- ── G5 : aucune ligne wod_scores sans série chargée ─────────────────────
  IF pg_temp.scores('1') IS DISTINCT FROM '' THEN RAISE EXCEPTION 'G5 : score écrit sans charge : %', pg_temp.scores('1'); END IF;

  -- ── G6 : séries ajoutées ────────────────────────────────────────────────
  IF (SELECT is_added::text || '|' || coalesce(prescribed_reps::text, '-') FROM public.strength_set_logs
       WHERE id = pg_temp.serie('01', '1', 'Pull-ups', 3)) IS DISTINCT FROM 'true|-'
     OR (SELECT is_added::text || '|' || prescribed_reps FROM public.strength_set_logs
          WHERE id = pg_temp.serie('01', '1', 'Pull-ups', 1)) IS DISTINCT FROM 'false|12' THEN
    RAISE EXCEPTION 'G6 : is_added ou reps prévues mal posés';
  END IF;
  v := pg_temp.faire('01', $q$INSERT INTO public.strength_set_logs
        (user_id, source_type, source_id, movement, set_index, reps, prescribed_reps, is_added)
        VALUES ('00000000-0000-4000-a9e1-000000000001', 'whiteboard', '00000000-0000-4000-c9e1-000000000003',
                'Pull-ups', 9, 5, 5, true)$q$);
  IF v NOT LIKE '23514:%' THEN RAISE EXCEPTION 'G6 : série ajoutée avec reps prévues acceptée : %', v; END IF;
  v := pg_temp.faire('03', format('SELECT string_agg(movement || set_index || ''='' || is_added, '','' ORDER BY movement, set_index) FROM public.list_athlete_strength_sets(%L) WHERE source_id = ''00000000-0000-4000-c9e1-000000000001''', a));
  IF v IS DISTINCT FROM 'OK Burpees1=false,Dips1=false,Pull-ups1=false,Pull-ups2=false,Pull-ups3=true,RMU1=false,Toes to Bar1=false' THEN
    RAISE EXCEPTION 'G6 : le coach ne lit pas is_added : %', v;
  END IF;
  v := pg_temp.faire('01', format('SELECT count(*) FILTER (WHERE is_added) FROM public.list_athlete_strength_sets(%L)', a));
  IF v IS DISTINCT FROM 'OK 1' THEN RAISE EXCEPTION 'G6 : A ne lit pas is_added : %', v; END IF;

  -- ── G7 : record de gymnastique confirmé ─────────────────────────────────
  s_pu12 := pg_temp.serie('01', '1', 'Pull-ups', 1);
  s_pu22 := pg_temp.serie('01', '1', 'Pull-ups', 2);
  s_pu25 := pg_temp.serie('01', '1', 'Pull-ups', 3);
  s_t2b := pg_temp.serie('01', '1', 'Toes to Bar', 1);
  s_burpee := pg_temp.serie('01', '1', 'Burpees', 1);
  s_rmu := pg_temp.serie('01', '1', 'RMU', 1);
  s_dips := pg_temp.serie('01', '1', 'Dips', 1);
  s_squat := pg_temp.serie('01', '2', 'Back Squat', 1);
  -- B valide sa propre séance ; A brouillonne une série sans charge.
  v := pg_temp.valider('02', '4', '[{"movement":"Pull-ups","set_index":1,"reps":40}]');
  IF v NOT LIKE 'OK %' THEN RAISE EXCEPTION 'G7 : séance de B : %', v; END IF;
  s_b := pg_temp.serie('02', '4', 'Pull-ups', 1);
  v := pg_temp.faire('01', $q$INSERT INTO public.strength_set_logs (user_id, source_type, source_id, movement, set_index, reps)
        VALUES ('00000000-0000-4000-a9e1-000000000001', 'whiteboard', '00000000-0000-4000-c9e1-000000000003', 'Pull-ups', 1, 50)$q$);
  IF v IS DISTINCT FROM 'OK' THEN RAISE EXCEPTION 'G7 : série de brouillon : %', v; END IF;
  s_brouillon := pg_temp.serie('01', '3', 'Pull-ups', 1);

  v := pg_temp.confirmer('anon', s_pu25, 'Pull-ups');
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'G7 : anon : %', v; END IF;
  v := pg_temp.confirmer('01', gen_random_uuid(), 'Pull-ups');
  IF v NOT LIKE '22023: RECORD_NON_PROUVE%' THEN RAISE EXCEPTION 'G7 : série inconnue : %', v; END IF;
  v := pg_temp.confirmer('01', s_b, 'Pull-ups');
  IF v NOT LIKE '22023: RECORD_NON_PROUVE%' THEN RAISE EXCEPTION 'G7 : série d''un autre athlète : %', v; END IF;
  v := pg_temp.confirmer('01', s_brouillon, 'Pull-ups');
  IF v NOT LIKE '22023: RECORD_NON_PROUVE%' THEN RAISE EXCEPTION 'G7 : série de brouillon : %', v; END IF;
  v := pg_temp.confirmer('01', s_squat, 'Pull-ups');
  IF v NOT LIKE '22023: RECORD_NON_PROUVE%' THEN RAISE EXCEPTION 'G7 : série chargée : %', v; END IF;
  v := pg_temp.confirmer('01', s_t2b, 'Pull-ups');
  IF v NOT LIKE '22023: RECORD_NON_PROUVE%' THEN RAISE EXCEPTION 'G7 : autre mouvement : %', v; END IF;
  v := pg_temp.confirmer('01', s_pu25, 'Back Squat');
  IF v NOT LIKE '22023: MOUVEMENT_NON_GYMNIQUE%' THEN RAISE EXCEPTION 'G7 : libellé non gymnique : %', v; END IF;
  v := pg_temp.confirmer('01', s_pu25, 'T2B');
  IF v NOT LIKE '22023: MOUVEMENT_NON_GYMNIQUE%' THEN RAISE EXCEPTION 'G7 : abréviation comme libellé : %', v; END IF;
  v := pg_temp.confirmer('01', s_burpee, 'Pull-ups');
  IF v NOT LIKE '22023: MOUVEMENT_NON_GYMNIQUE%' THEN RAISE EXCEPTION 'G7 : série non gymnique : %', v; END IF;
  v := pg_temp.confirmer('01', s_pu12, 'Pull-ups');
  IF v NOT LIKE '22023: RECORD_NON_AMELIORE%' THEN RAISE EXCEPTION 'G7 : 12 < 20 accepté : %', v; END IF;
  v := pg_temp.confirmer('01', s_dips, 'Dips');
  IF v NOT LIKE '22023: RECORD_NON_AMELIORE%' THEN RAISE EXCEPTION 'G7 : record historique ignoré : %', v; END IF;
  IF pg_temp.pr('gymnastics_Pull-ups') IS DISTINCT FROM '20' OR pg_temp.pr('gymnastics_Dips') IS NOT NULL THEN
    RAISE EXCEPTION 'G7 : un refus a écrit un record';
  END IF;

  v := pg_temp.confirmer('01', s_pu25, 'Pull-ups');
  IF v NOT LIKE 'OK %' THEN RAISE EXCEPTION 'G7 : 25 > 20 refusé : %', v; END IF;
  j := substr(v, 4)::jsonb;
  IF (j->>'reps')::int IS DISTINCT FROM 25 OR (j->>'precedent')::int IS DISTINCT FROM 20 OR j->>'label' IS DISTINCT FROM 'Pull-ups' THEN
    RAISE EXCEPTION 'G7 : réponse %', j;
  END IF;
  IF pg_temp.pr('gymnastics_Pull-ups') IS DISTINCT FROM '25'
     OR pg_temp.pr('gymnastics_Pull-ups_date') IS DISTINCT FROM to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
     OR pg_temp.pr('gymnastics_Pull-ups_src') IS DISTINCT FROM s_pu25::text
     OR pg_temp.pr('weightlifting_Back Squat') IS DISTINCT FROM '200' THEN
    RAISE EXCEPTION 'G7 : format du record : %', (SELECT personal_records FROM public.profiles WHERE id = a::uuid);
  END IF;
  v := pg_temp.confirmer('01', s_pu22, 'Pull-ups');
  IF v NOT LIKE '22023: RECORD_NON_AMELIORE%' OR pg_temp.pr('gymnastics_Pull-ups') IS DISTINCT FROM '25' THEN
    RAISE EXCEPTION 'G7 : record abaissé : % / %', v, pg_temp.pr('gymnastics_Pull-ups');
  END IF;
  v := pg_temp.confirmer('01', s_pu25, 'Pull-ups');
  IF v NOT LIKE '22023: RECORD_NON_AMELIORE%' THEN RAISE EXCEPTION 'G7 : même série deux fois : %', v; END IF;
  v := pg_temp.confirmer('01', s_rmu, 'Ring Muscle-up');
  IF v NOT LIKE 'OK %' OR pg_temp.pr('gymnastics_Ring Muscle-up') IS DISTINCT FROM '4' THEN
    RAISE EXCEPTION 'G7 : abréviation RMU : % / %', v, pg_temp.pr('gymnastics_Ring Muscle-up');
  END IF;

  -- ── G8 : rapprochement des noms (exemples de gymPercentReps.test.ts) ────
  SELECT string_agg(n || '=' || coalesce(internal.gym_pr_label(n), '∅'), ' | ' ORDER BY o) INTO v
    FROM unnest(ARRAY[
      'Ring Muscle-ups', 'ring muscle up', 'Toes to Bar', 'Toes-to-bar', 'PULLUPS', 'Handstand Push-ups',
      'Strict Dips', 'Pull Overs', 'T2B', 'C2B', 'RMU', 'BMU', 'Strict HSPU',
      'HSPU', 'MU', 'Strict Pull-Ups', 'Bench Dips', 'Back Squat', '', NULL
    ]) WITH ORDINALITY AS t(n, o);
  IF v IS DISTINCT FROM
     'Ring Muscle-ups=Ring Muscle-up | ring muscle up=Ring Muscle-up | Toes to Bar=Toes To Bar | '
     'Toes-to-bar=Toes To Bar | PULLUPS=Pull-ups | Handstand Push-ups=Hand Stand Push Up | '
     'Strict Dips=Strict Dips | Pull Overs=Pull Over | T2B=Toes To Bar | C2B=Chest To Bar | '
     'RMU=Ring Muscle-up | BMU=Bar Muscle-up | Strict HSPU=Strict Hand Stand Push Up | '
     'HSPU=∅ | MU=∅ | Strict Pull-Ups=∅ | Bench Dips=∅ | Back Squat=∅ | =∅' THEN
    RAISE EXCEPTION 'G8 : rapprochement %', v;
  END IF;
  -- Les 11 libellés se rapprochent d'eux-mêmes.
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['Toes To Bar', 'Pull-ups', 'Chest To Bar', 'Hand Stand Push Up',
               'Strict Hand Stand Push Up', 'Wall Facing Hand Stand Push Up', 'Ring Muscle-up', 'Bar Muscle-up',
               'Dips', 'Strict Dips', 'Pull Over']) l WHERE internal.gym_pr_label(l) IS DISTINCT FROM l) THEN
    RAISE EXCEPTION 'G8 : un libellé ne se rapproche pas de lui-même';
  END IF;

  -- ── G9 : séparation ─────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM public.movement_logs WHERE user_id IN (a::uuid, '00000000-0000-4000-a9e1-000000000002'))
     OR EXISTS (SELECT 1 FROM public.user_movement_stats WHERE user_id = a::uuid) THEN
    RAISE EXCEPTION 'G9 : écriture dans movement_logs ou user_movement_stats';
  END IF;
  IF (SELECT total_scores_submitted FROM public.profiles WHERE id = a::uuid) IS DISTINCT FROM compteur_avant THEN
    RAISE EXCEPTION 'G9 : total_scores_submitted touché';
  END IF;
  RAISE NOTICE 'gymnastique : G1 à G9 conformes';
END $t$;

-- ── G10 : définitions et droits ──────────────────────────────────────────────
SET LOCAL search_path TO "$user", public, extensions;
DO $t$
DECLARE v text;
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.confirm_gym_record(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.confirm_gym_record(uuid,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.confirm_gym_record(uuid,text)', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) x
                 WHERE p.oid = 'public.confirm_gym_record(uuid,text)'::regprocedure AND x.grantee = 0)
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.confirm_gym_record(uuid,text)'::regprocedure)
     OR (SELECT proconfig FROM pg_proc WHERE oid = 'public.confirm_gym_record(uuid,text)'::regprocedure)
        IS DISTINCT FROM ARRAY['search_path=public, pg_temp'] THEN
    RAISE EXCEPTION 'G10 : droits ou options de confirm_gym_record';
  END IF;
  IF has_function_privilege('anon', 'internal.gym_pr_label(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'internal.gym_pr_label(text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'internal.gym_pr_label(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'G10 : internal.gym_pr_label ouverte';
  END IF;
  IF has_function_privilege('anon', 'public.list_athlete_strength_sets(uuid,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.list_athlete_strength_sets(uuid,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.list_athlete_strength_sets(uuid,integer)', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) x
                 WHERE p.oid = 'public.list_athlete_strength_sets(uuid,integer)'::regprocedure AND x.grantee = 0)
     OR md5(obj_description('public.list_athlete_strength_sets(uuid,integer)'::regprocedure, 'pg_proc'))
        IS DISTINCT FROM '160a2db01848cc4003458296d2b385a5' THEN
    RAISE EXCEPTION 'G10 : droits ou commentaire de list_athlete_strength_sets';
  END IF;
  -- Définition figée (GM2, fiche athlète du Manager, lit ces colonnes).
  v := md5(pg_get_functiondef('public.list_athlete_strength_sets(uuid,integer)'::regprocedure));
  IF v IS DISTINCT FROM '0d267536a782a786cfb0cd6e2edbfc6c' THEN
    RAISE EXCEPTION 'G10 : list_athlete_strength_sets a changé (%)', v;
  END IF;
  RAISE NOTICE 'gymnastique : G10 conforme';
END $t$;

-- ── R : retour arrière, contre les empreintes de prod du 04/10/2026 ───────────
SAVEPOINT avant_retour;
\i supabase/retours/20270145000000_gymnastique_validation_sans_charge.sql
DO $t$
DECLARE v text;
BEGIN
  SELECT string_agg(c.relname || '=' || x.m, ',' ORDER BY c.relname) INTO v
    FROM (SELECT a.attrelid, md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull
                                 || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), ''), ',' ORDER BY a.attnum)) m
            FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
           WHERE a.attrelid IN ('public.strength_sessions'::regclass, 'public.strength_set_logs'::regclass)
             AND a.attnum > 0 AND NOT a.attisdropped
           GROUP BY a.attrelid) x
    JOIN pg_class c ON c.oid = x.attrelid;
  IF v IS DISTINCT FROM 'strength_sessions=360c5d64ca6366e1b77ba2651d181933,strength_set_logs=5437885bbd9bba3f37850ca099e9ffb5' THEN
    RAISE EXCEPTION 'R : colonnes ≠ prod : %', v;
  END IF;
  SELECT string_agg(conname || '=' || md5(pg_get_constraintdef(oid)), ',' ORDER BY conname COLLATE "C") INTO v
    FROM pg_constraint WHERE conrelid IN ('public.strength_sessions'::regclass, 'public.strength_set_logs'::regclass);
  IF v IS DISTINCT FROM 'strength_sessions_max_load_kg_check=3727f2b1b65952ca49a28997e1ab1c2d,'
          'strength_sessions_pkey=4c6419b3704337bbfe50f018842a9ad3,'
          'strength_sessions_planned_sets_check=95fc38fa027bf9221fca228ba732de99,'
          'strength_sessions_source_key=c53a16a922a75b02f51fa7157aab05dd,'
          'strength_sessions_source_type_check=28c182487b412a02152aa2800a915f02,'
          'strength_sessions_status_check=f3caede6c51530a0fc1c0e618682d0a5,'
          'strength_sessions_statut_coherent=995590a3caeef97b1cdeb839b5c09273,'
          'strength_sessions_user_id_fkey=f52ea365e97de6e8cafd675b03a940e4,'
          'strength_set_logs_load_kg_check=385c615802c9e2fb5025598fcb41c46d,'
          'strength_set_logs_movement_check=1f5ca74df6ce17d0c9af001f54616ed6,'
          'strength_set_logs_pkey=4c6419b3704337bbfe50f018842a9ad3,'
          'strength_set_logs_prescribed_load_kg_check=89ba070a9904ff98aad7dc558fc2390b,'
          'strength_set_logs_prescribed_reps_check=a39db5e1cc147341faaf495765378353,'
          'strength_set_logs_reps_check=ee05d8222af6df22154691435ad32765,'
          'strength_set_logs_set_index_check=e4a0d494d77b25879cf4ed3d5374e2ce,'
          'strength_set_logs_source_type_check=28c182487b412a02152aa2800a915f02,'
          'strength_set_logs_user_id_fkey=f52ea365e97de6e8cafd675b03a940e4' THEN
    RAISE EXCEPTION 'R : contraintes ≠ prod : %', v;
  END IF;
  SELECT string_agg(tablename || '.' || policyname || '=' || md5(coalesce(qual, '') || '|' || coalesce(with_check, '')), ','
                    ORDER BY tablename || '.' || policyname COLLATE "C") INTO v
    FROM pg_policies WHERE tablename IN ('strength_sessions', 'strength_set_logs');
  IF v IS DISTINCT FROM 'strength_sessions.strength_sessions_own_delete=7aba67cc9feeda0f683a53a8ff77a5f2,'
          'strength_sessions.strength_sessions_own_insert=8ff9ddf6cb704a2a8d464f3780770a1e,'
          'strength_sessions.strength_sessions_own_read=5eebdfba311617743b110b29a41f23a0,'
          'strength_sessions.strength_sessions_own_update=befcd93f5cf1f6f04cea02fef5c3cd31,'
          'strength_set_logs.strength_sets_own_delete=dda05884483c4251b000279f56575167,'
          'strength_set_logs.strength_sets_own_insert=320262fb68f39025e3c327b928b04741,'
          'strength_set_logs.strength_sets_own_read=5eebdfba311617743b110b29a41f23a0,'
          'strength_set_logs.strength_sets_own_update=eb4f01dfc9bb29b05cd27ddedaf98c2f' THEN
    RAISE EXCEPTION 'R : policies ≠ prod : %', v;
  END IF;
  IF md5(pg_get_functiondef('public.validate_strength_session(text,uuid,text,integer,boolean,jsonb,jsonb)'::regprocedure))
       IS DISTINCT FROM '51768bb37e553243ed02c41a82f6a7ff'
     OR md5(obj_description('public.validate_strength_session(text,uuid,text,integer,boolean,jsonb,jsonb)'::regprocedure, 'pg_proc'))
       IS DISTINCT FROM '1cf32e88e9d41e547d7d4b56febbf3fd'
     OR md5(pg_get_functiondef('public.list_athlete_strength_sets(uuid,integer)'::regprocedure))
       IS DISTINCT FROM '17c26f33fb0e95ce24330906aaf78d12'
     OR md5(obj_description('public.list_athlete_strength_sets(uuid,integer)'::regprocedure, 'pg_proc'))
       IS DISTINCT FROM '160a2db01848cc4003458296d2b385a5'
     OR has_function_privilege('anon', 'public.list_athlete_strength_sets(uuid,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.list_athlete_strength_sets(uuid,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.list_athlete_strength_sets(uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'R : fonctions ≠ prod';
  END IF;
  IF to_regprocedure('public.confirm_gym_record(uuid,text)') IS NOT NULL
     OR to_regprocedure('internal.gym_pr_label(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'R : fonctions de la migration encore présentes';
  END IF;
  IF (SELECT status FROM public.strength_sessions
       WHERE user_id = '00000000-0000-4000-a9e1-000000000001'
         AND source_id = '00000000-0000-4000-c9e1-000000000001') IS DISTINCT FROM 'draft'
     OR (SELECT count(*) FROM public.strength_set_logs
          WHERE user_id = '00000000-0000-4000-a9e1-000000000001'
            AND source_id = '00000000-0000-4000-c9e1-000000000001') IS DISTINCT FROM 7 THEN
    RAISE EXCEPTION 'R : séance sans charge non repassée en brouillon, ou séries perdues';
  END IF;
  RAISE NOTICE 'gymnastique : R conforme (retour arrière exact)';
END $t$;
ROLLBACK TO SAVEPOINT avant_retour;

ROLLBACK;
\echo '    G1 à G10 et R OK'
