-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270164000000_strength_optional_load.sql
-- (nbstyle69/AthleX-Manager#453, PR 4a)
--
-- À jouer en UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test le rejoue dans sa transaction annulée).
--
-- Remet validate_strength_session (c39b912c…), confirm_gym_record (6ebca7f3…)
-- et les trois commentaires tels que relevés en prod le 20/11/2026 ; droits
-- conservés par CREATE OR REPLACE. Aucune donnée n'est touchée : les séances
-- déjà validées avec des séries faites sans charge restent telles quelles
-- (elles respectent toutes les contraintes) ; elles seraient seulement
-- refusées à une nouvelle validation par l'ancienne règle.
-- ═════════════════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  v_vss text := md5(pg_get_functiondef('public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure));
  v_cgr text := md5(pg_get_functiondef('public.confirm_gym_record(uuid, text)'::regprocedure));
BEGIN
  IF v_vss <> '80c963e615fb4b369fafbd31f8915074' OR v_cgr <> '1230f660ba3c054476ff2510b6a3fc2b' THEN
    RAISE EXCEPTION 'CHARGE_FACULTATIVE_RETOUR_DERIVE: définitions inattendues (validate_strength_session %, confirm_gym_record %) : rien n''est écrit', v_vss, v_cgr;
  END IF;
END $garde$;

CREATE OR REPLACE FUNCTION public.validate_strength_session(p_source_type text, p_source_id uuid, p_source_title text, p_planned_sets integer, p_rx boolean, p_sets jsonb, p_records jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_session   public.strength_sessions%ROWTYPE;
  v_box       uuid;
  v_type_wod  text;    -- type de score choisi par le créateur du WOD (NULL = libre)
  v_first     boolean;
  v_valides   jsonb;
  v_max       numeric;
  v_total     integer;
  v_nb        integer;
  v_ancien    jsonb;   -- {id de série : estimation 1RM} de la séance avant validation
  v_pr        jsonb;
  v_pr_avant  jsonb;
  v_rec       jsonb;
  v_key       text;
  v_kg        numeric;
  v_cur       numeric;
  v_src       text;
  v_ici       boolean;
  v_set_id    uuid;
  v_set_est   numeric;
  v_traites   text[] := '{}';
  v_modifies  jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF p_source_type IS NULL OR p_source_type NOT IN ('whiteboard', 'generated') THEN
    RAISE EXCEPTION 'SOURCE_INVALIDE: %', p_source_type USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_sets) IS DISTINCT FROM 'array'
     OR jsonb_typeof(coalesce(p_records, '[]'::jsonb)) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'PARAMETRES_INVALIDES: p_sets et p_records sont des tableaux' USING ERRCODE = '22023';
  END IF;

  IF p_source_type = 'whiteboard' THEN
    SELECT w.box_id, w.score_type INTO v_box, v_type_wod FROM public.box_wods w WHERE w.id = p_source_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WOD_INTROUVABLE' USING ERRCODE = 'P0002';
    END IF;
    -- Un WOD typé autrement que « Charge » ne reçoit pas de score de charge :
    -- un score d'un autre type y est alors légitime.
    IF coalesce(v_type_wod, 'weight') = 'weight' AND EXISTS (SELECT 1 FROM public.wod_scores s
                WHERE s.wod_id = p_source_id AND s.member_id = v_uid AND s.score_type <> 'weight') THEN
      RAISE EXCEPTION 'SCORE_AUTRE_TYPE: ce WOD porte déjà un score d''un autre type' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Séries valides reçues (les séries vides ou incomplètes ne comptent pas).
  -- Une série sans charge (gymnastique) est valide si aucune charge n'était
  -- prescrite : ni charge prévue reçue, ni load_required (ligne prescrite en kg
  -- ou en %1RM, résolue ou non, selon l'app). Sinon elle reste exigée avec sa
  -- charge, comme avant. Un ancien client n'envoie que des séries chargées : la
  -- clé absente vaut false. Une série ajoutée (is_added) n'a pas de reps prévues.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'movement', btrim(c.e->>'movement'),
           'movement_label', nullif(c.e->>'movement_label', ''),
           'set_index', (c.e->>'set_index')::integer,
           'reps', (c.e->>'reps')::integer,
           'load_kg', c.charge,
           'prescribed_reps', CASE WHEN NOT c.ajoutee AND c.e->>'prescribed_reps' ~ '^[1-9][0-9]*$'
                                   THEN (c.e->>'prescribed_reps')::integer END,
           'prescribed_load_kg', c.charge_prevue,
           'is_added', c.ajoutee)), '[]')
    INTO v_valides
    FROM (SELECT e,
                 CASE WHEN e->>'load_kg' ~ '^[0-9]+(\.[0-9]+)?$' THEN (e->>'load_kg')::numeric END AS charge,
                 coalesce(e->>'load_kg', '') = '' AS sans_charge,
                 CASE WHEN e->>'prescribed_load_kg' ~ '^[0-9]+(\.[0-9]+)?$'
                      THEN nullif((e->>'prescribed_load_kg')::numeric, 0) END AS charge_prevue,
                 coalesce(e->>'is_added', '') = 'true' AS ajoutee,
                 coalesce(e->>'load_required', '') = 'true' AS charge_exigee
            FROM jsonb_array_elements(p_sets) e) c
   WHERE c.e->>'reps' ~ '^[0-9]+$'
     AND c.e->>'set_index' ~ '^[0-9]+$'
     AND (c.e->>'reps')::integer BETWEEN 1 AND 500
     AND ((c.charge > 0 AND c.charge <= 500)
          OR (c.sans_charge AND c.charge_prevue IS NULL AND NOT c.charge_exigee));

  -- Charge max : séries chargées seulement (NULL sans charge) ; reps totales :
  -- séries sans charge seulement, calculées ici, jamais reçues du client.
  SELECT count(*), max((v->>'load_kg')::numeric),
         sum((v->>'reps')::integer) FILTER (WHERE v->>'load_kg' IS NULL)
    INTO v_nb, v_max, v_total
    FROM jsonb_array_elements(v_valides) v;
  IF v_nb = 0 THEN
    RAISE EXCEPTION 'SEANCE_VIDE: aucune série valide (reps, et charge si elle est prescrite)' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT (v->>'movement', v->>'set_index')) FROM jsonb_array_elements(v_valides) v) <> v_nb THEN
    RAISE EXCEPTION 'SERIES_EN_DOUBLE: un mouvement a deux fois la même série' USING ERRCODE = '22023';
  END IF;

  -- La séance, verrouillée (créée si l'athlète valide sans brouillon préalable).
  INSERT INTO public.strength_sessions (user_id, source_type, source_id, source_title, planned_sets)
  VALUES (v_uid, p_source_type, p_source_id, p_source_title, p_planned_sets)
  ON CONFLICT (user_id, source_type, source_id) DO NOTHING;
  SELECT * INTO v_session FROM public.strength_sessions
   WHERE user_id = v_uid AND source_type = p_source_type AND source_id = p_source_id
   FOR UPDATE;
  v_first := v_session.first_validated_at IS NULL;

  SELECT coalesce(jsonb_object_agg(l.id::text, internal.estimation_1rm(l.load_kg, l.reps)), '{}')
    INTO v_ancien
    FROM public.strength_set_logs l
   WHERE l.user_id = v_uid AND l.source_type = p_source_type AND l.source_id = p_source_id;

  -- Séries : la grille reçue remplace celle de la séance ; une série gardée
  -- conserve son id (et donc la provenance d'un record).
  DELETE FROM public.strength_set_logs l
   WHERE l.user_id = v_uid AND l.source_type = p_source_type AND l.source_id = p_source_id
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_valides) v
                      WHERE v->>'movement' = l.movement AND (v->>'set_index')::integer = l.set_index);
  INSERT INTO public.strength_set_logs
    (user_id, source_type, source_id, source_title, movement, movement_label, set_index,
     reps, load_kg, prescribed_reps, prescribed_load_kg, is_added)
  SELECT v_uid, p_source_type, p_source_id, coalesce(p_source_title, v_session.source_title),
         r.movement, r.movement_label, r.set_index, r.reps, r.load_kg,
         r.prescribed_reps, r.prescribed_load_kg, r.is_added
    FROM jsonb_to_recordset(v_valides) AS r(movement text, movement_label text, set_index integer,
         reps integer, load_kg numeric, prescribed_reps integer, prescribed_load_kg numeric,
         is_added boolean)
  ON CONFLICT (user_id, source_type, source_id, movement, set_index) DO UPDATE
     SET reps = EXCLUDED.reps, load_kg = EXCLUDED.load_kg,
         movement_label = EXCLUDED.movement_label, source_title = EXCLUDED.source_title,
         prescribed_reps = EXCLUDED.prescribed_reps, prescribed_load_kg = EXCLUDED.prescribed_load_kg,
         is_added = EXCLUDED.is_added;

  UPDATE public.strength_sessions
     SET status = 'validated', max_load_kg = v_max, total_reps = v_total,
         validated_at = now(), first_validated_at = coalesce(first_validated_at, now()),
         source_title = coalesce(p_source_title, source_title),
         planned_sets = coalesce(p_planned_sets, planned_sets), updated_at = now()
   WHERE id = v_session.id;

  -- Score du Whiteboard : la charge max des séries valides. Une séance sans
  -- aucune série chargée n'écrit rien dans wod_scores (reps totales gardées sur
  -- la séance seulement) : classements et tournois ne changent pas.
  -- WOD dont le créateur a choisi un autre type que « Charge » (#453) : rien
  -- n'est écrit, comme une séance sans série chargée (sinon SCORE_TYPE_MISMATCH).
  IF p_source_type = 'whiteboard' AND v_max IS NOT NULL
     AND coalesce(v_type_wod, 'weight') = 'weight' THEN
    INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value, capped, rx, scaled)
    VALUES (p_source_id, v_uid, v_box, 'weight', v_max, false, coalesce(p_rx, true), NOT coalesce(p_rx, true))
    ON CONFLICT (wod_id, member_id) DO UPDATE
       SET score_type = 'weight', score_value = EXCLUDED.score_value, capped = false,
           rx = EXCLUDED.rx, scaled = EXCLUDED.scaled;
  END IF;

  -- 1RM : calculés par l'app, prouvés ici par une série de l'athlète.
  SELECT coalesce(personal_records, '{}'::jsonb) INTO v_pr FROM public.profiles WHERE id = v_uid FOR UPDATE;
  v_pr_avant := v_pr;

  FOR v_rec IN SELECT * FROM jsonb_array_elements(coalesce(p_records, '[]'::jsonb)) LOOP
    IF coalesce(btrim(v_rec->>'label'), '') = '' OR length(v_rec->>'label') > 60 THEN
      RAISE EXCEPTION 'RECORD_INVALIDE: libellé manquant' USING ERRCODE = '22023';
    END IF;
    v_key := 'weightlifting_' || (v_rec->>'label');
    v_kg  := CASE WHEN v_rec->>'kg' ~ '^[0-9]+(\.[0-9]+)?$' THEN (v_rec->>'kg')::numeric END;
    IF v_kg IS NULL AND v_rec->>'kg' IS NOT NULL THEN
      RAISE EXCEPTION 'RECORD_INVALIDE: kg' USING ERRCODE = '22023';
    END IF;
    v_cur := CASE WHEN (v_pr->>v_key) ~ '^[0-9]+([.,][0-9]+)?$'
                  THEN replace(v_pr->>v_key, ',', '.')::numeric END;
    v_src := v_pr->>(v_key || '_src');
    v_ici := v_src IS NOT NULL AND v_ancien ? v_src AND v_cur IS NOT NULL
             AND (v_ancien->>v_src)::numeric >= v_cur;
    v_traites := v_traites || v_key;

    IF v_kg IS NULL THEN
      -- Plus aucune série ne justifie ce record : il disparaît s'il venait d'ici.
      IF v_ici THEN
        v_pr := v_pr - v_key - (v_key || '_date') - (v_key || '_src');
        v_modifies := v_modifies || jsonb_build_object('label', v_rec->>'label', 'kg', NULL, 'precedent', v_cur);
      END IF;
      CONTINUE;
    END IF;

    -- La série qui prouve ce record.
    v_set_id := NULL;
    v_set_est := NULL;
    IF v_rec ? 'log_id' THEN
      SELECT l.id, internal.estimation_1rm(l.load_kg, l.reps) INTO v_set_id, v_set_est
        FROM public.strength_set_logs l
        JOIN public.strength_sessions s
          ON s.user_id = l.user_id AND s.source_type = l.source_type AND s.source_id = l.source_id
       WHERE l.id::text = v_rec->>'log_id' AND l.user_id = v_uid AND s.status = 'validated';
    ELSE
      SELECT l.id, internal.estimation_1rm(l.load_kg, l.reps) INTO v_set_id, v_set_est
        FROM public.strength_set_logs l
       WHERE l.user_id = v_uid AND l.source_type = p_source_type AND l.source_id = p_source_id
         AND l.movement = btrim(v_rec->>'movement') AND l.set_index::text = v_rec->>'set_index';
    END IF;
    IF v_set_id IS NULL OR v_set_est IS NULL OR v_kg > v_set_est THEN
      RAISE EXCEPTION 'RECORD_NON_PROUVE: % kg pour %', v_kg, v_rec->>'label' USING ERRCODE = '22023';
    END IF;

    IF v_cur IS NULL OR v_kg > v_cur OR (v_ici AND (v_kg <> v_cur OR v_src <> v_set_id::text)) THEN
      v_pr := v_pr || jsonb_build_object(
        v_key, trim_scale(v_kg)::text,
        v_key || '_date', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
        v_key || '_src', v_set_id::text);
      v_modifies := v_modifies || jsonb_build_object('label', v_rec->>'label', 'kg', v_kg, 'precedent', v_cur);
    END IF;
  END LOOP;

  -- Un record venu de cette séance et non recalculé doit rester prouvé par sa
  -- série après correction : sinon rien n'est écrit.
  FOR v_key IN SELECT left(k, length(k) - 4) FROM jsonb_object_keys(v_pr_avant) k
                WHERE k LIKE 'weightlifting\_%\_src' LOOP
    CONTINUE WHEN v_key = ANY (v_traites);
    v_src := v_pr_avant->>(v_key || '_src');
    v_cur := CASE WHEN (v_pr_avant->>v_key) ~ '^[0-9]+([.,][0-9]+)?$'
                  THEN replace(v_pr_avant->>v_key, ',', '.')::numeric END;
    CONTINUE WHEN NOT (v_src IS NOT NULL AND v_ancien ? v_src AND v_cur IS NOT NULL
                       AND (v_ancien->>v_src)::numeric >= v_cur);
    v_set_est := NULL;
    SELECT internal.estimation_1rm(l.load_kg, l.reps) INTO v_set_est
      FROM public.strength_set_logs l WHERE l.id::text = v_src;
    IF v_set_est IS NULL OR v_set_est < v_cur THEN
      RAISE EXCEPTION 'RECORD_A_RECALCULER: %', substr(v_key, 15) USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF v_pr IS DISTINCT FROM v_pr_avant THEN
    UPDATE public.profiles SET personal_records = v_pr WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'premiere_validation', v_first,
    'max_load_kg', v_max,
    'total_reps', v_total,
    'series_valides', v_nb,
    'records', v_modifies);
END;
$function$
;

COMMENT ON FUNCTION public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb) IS
  'Valide une séance de musculation de l''appelant : séries (sans charge comprises, si aucune charge n''était prescrite : ni prescribed_load_kg ni load_required), séance (charge max et reps totales), score (Whiteboard : charge max, rien sans série chargée) et 1RM en une transaction. N''écrit ni compteurs ni movement_logs : l''app les fait partir une seule fois, quand premiere_validation est vrai.';

CREATE OR REPLACE FUNCTION public.confirm_gym_record(p_set_log_id uuid, p_label text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_set    public.strength_set_logs%ROWTYPE;
  v_label  text;
  v_key    text;
  v_pr     jsonb;
  v_cur    integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF p_label IS NULL OR internal.gym_pr_label(p_label) IS DISTINCT FROM p_label THEN
    RAISE EXCEPTION 'MOUVEMENT_NON_GYMNIQUE: %', p_label USING ERRCODE = '22023';
  END IF;

  SELECT l.* INTO v_set
    FROM public.strength_set_logs l
    JOIN public.strength_sessions s
      ON s.user_id = l.user_id AND s.source_type = l.source_type AND s.source_id = l.source_id
   WHERE l.id = p_set_log_id AND l.user_id = v_uid AND s.status = 'validated'
     AND l.load_kg IS NULL AND l.reps BETWEEN 1 AND 500;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECORD_NON_PROUVE: aucune série validée sans charge de l''appelant' USING ERRCODE = '22023';
  END IF;
  v_label := internal.gym_pr_label(v_set.movement);
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'MOUVEMENT_NON_GYMNIQUE: %', v_set.movement USING ERRCODE = '22023';
  END IF;
  IF v_label <> p_label THEN
    RAISE EXCEPTION 'RECORD_NON_PROUVE: la série est un autre mouvement (%)', v_label USING ERRCODE = '22023';
  END IF;

  v_key := 'gymnastics_' || p_label;
  SELECT coalesce(personal_records, '{}'::jsonb) INTO v_pr FROM public.profiles WHERE id = v_uid FOR UPDATE;
  -- Record actuel : clé moderne, ou clé historique « Gymnastics_ » que l'app lit encore.
  SELECT max(floor(replace(v, ',', '.')::numeric)::integer) INTO v_cur
    FROM (VALUES (v_pr->>v_key), (v_pr->>('Gymnastics_' || p_label))) AS t(v)
   WHERE v ~ '^[0-9]+([.,][0-9]+)?$';
  IF v_cur IS NOT NULL AND v_set.reps <= v_cur THEN
    RAISE EXCEPTION 'RECORD_NON_AMELIORE: % reps, record % reps', v_set.reps, v_cur USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET personal_records = v_pr || jsonb_build_object(
           v_key, v_set.reps::text,
           v_key || '_date', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
           v_key || '_src', v_set.id::text)
   WHERE id = v_uid;

  RETURN jsonb_build_object('label', p_label, 'reps', v_set.reps, 'precedent', v_cur, 'log_id', v_set.id);
END;
$function$
;

COMMENT ON FUNCTION public.confirm_gym_record(uuid, text) IS
  'Confirme un record de gymnastique (reps) de l''appelant, prouvé par une série sans charge d''une séance validée : valeur = reps de la série, jamais abaissé, clé gymnastics_<Libellé> avec date et source (id de la série). Erreurs RECORD_NON_PROUVE, RECORD_NON_AMELIORE, MOUVEMENT_NON_GYMNIQUE.';

COMMENT ON COLUMN public.strength_sessions.total_reps IS
  'Somme des reps des séries sans charge (gymnastique) de la séance validée, calculée par validate_strength_session ; NULL sans série sans charge.';

DO $apres$
BEGIN
  IF md5(pg_get_functiondef('public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure)) <> 'c39b912c63312f07deae5ffa4fbddc94'
     OR md5(pg_get_functiondef('public.confirm_gym_record(uuid, text)'::regprocedure)) <> '6ebca7f3a041ba5eabdb5ab613e5c15f'
     OR md5(obj_description('public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure, 'pg_proc')) <> 'ebca16420a34fd891a1ebe5ea8809bdf'
     OR md5(obj_description('public.confirm_gym_record(uuid, text)'::regprocedure, 'pg_proc')) <> 'c2a606a6308e70cd936204201924d05e'
     OR md5(col_description('public.strength_sessions'::regclass,
            (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.strength_sessions'::regclass AND attname = 'total_reps'))) <> '95cdb07a6a9912a21986f7c0f595b188' THEN
    RAISE EXCEPTION 'CHARGE_FACULTATIVE_RETOUR_DERIVE: état de prod du 20/11/2026 non rétabli';
  END IF;
END $apres$;
