-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270145000000_gymnastique_validation_sans_charge.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test gymnastique_validation_sans_charge.sql le
-- rejoue dans sa propre transaction annulée et vérifie le retour exact aux
-- empreintes de prod du 04/10/2026).
--
-- Effets sur les données : une séance validée sans aucune charge redevient un
-- brouillon (ses séries restent) ; is_added et total_reps disparaissent ; les
-- records de gymnastique déjà confirmés restent dans personal_records.
-- ═════════════════════════════════════════════════════════════════════════════

DROP FUNCTION public.confirm_gym_record(uuid, text);
DROP FUNCTION internal.gym_pr_label(text);

-- validate_strength_session : définition de prod (md5 51768bb3…), 20270138.
CREATE OR REPLACE FUNCTION public.validate_strength_session(
  p_source_type  text,
  p_source_id    uuid,
  p_source_title text,
  p_planned_sets integer,
  p_rx           boolean,
  p_sets         jsonb,
  p_records      jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_session   public.strength_sessions%ROWTYPE;
  v_box       uuid;
  v_first     boolean;
  v_valides   jsonb;
  v_max       numeric;
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
    SELECT w.box_id INTO v_box FROM public.box_wods w WHERE w.id = p_source_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WOD_INTROUVABLE' USING ERRCODE = 'P0002';
    END IF;
    IF EXISTS (SELECT 1 FROM public.wod_scores s
                WHERE s.wod_id = p_source_id AND s.member_id = v_uid AND s.score_type <> 'weight') THEN
      RAISE EXCEPTION 'SCORE_AUTRE_TYPE: ce WOD porte déjà un score d''un autre type' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Séries valides reçues (les séries vides ou incomplètes ne comptent pas).
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'movement', btrim(e->>'movement'),
           'movement_label', nullif(e->>'movement_label', ''),
           'set_index', (e->>'set_index')::integer,
           'reps', (e->>'reps')::integer,
           'load_kg', (e->>'load_kg')::numeric,
           'prescribed_reps', CASE WHEN e->>'prescribed_reps' ~ '^[0-9]+$'
                                   THEN (e->>'prescribed_reps')::integer END,
           'prescribed_load_kg', CASE WHEN e->>'prescribed_load_kg' ~ '^[0-9]+(\.[0-9]+)?$'
                                      THEN (e->>'prescribed_load_kg')::numeric END)), '[]')
    INTO v_valides
    FROM jsonb_array_elements(p_sets) e
   WHERE e->>'reps' ~ '^[0-9]+$' AND e->>'load_kg' ~ '^[0-9]+(\.[0-9]+)?$'
     AND e->>'set_index' ~ '^[0-9]+$'
     AND (e->>'reps')::integer BETWEEN 1 AND 500
     AND (e->>'load_kg')::numeric > 0 AND (e->>'load_kg')::numeric <= 500;

  SELECT count(*), max((v->>'load_kg')::numeric) INTO v_nb, v_max FROM jsonb_array_elements(v_valides) v;
  IF v_nb = 0 THEN
    RAISE EXCEPTION 'SEANCE_VIDE: aucune série avec reps et charge' USING ERRCODE = '22023';
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
     reps, load_kg, prescribed_reps, prescribed_load_kg)
  SELECT v_uid, p_source_type, p_source_id, coalesce(p_source_title, v_session.source_title),
         r.movement, r.movement_label, r.set_index, r.reps, r.load_kg,
         r.prescribed_reps, r.prescribed_load_kg
    FROM jsonb_to_recordset(v_valides) AS r(movement text, movement_label text, set_index integer,
         reps integer, load_kg numeric, prescribed_reps integer, prescribed_load_kg numeric)
  ON CONFLICT (user_id, source_type, source_id, movement, set_index) DO UPDATE
     SET reps = EXCLUDED.reps, load_kg = EXCLUDED.load_kg,
         movement_label = EXCLUDED.movement_label, source_title = EXCLUDED.source_title,
         prescribed_reps = EXCLUDED.prescribed_reps, prescribed_load_kg = EXCLUDED.prescribed_load_kg;

  UPDATE public.strength_sessions
     SET status = 'validated', max_load_kg = v_max,
         validated_at = now(), first_validated_at = coalesce(first_validated_at, now()),
         source_title = coalesce(p_source_title, source_title),
         planned_sets = coalesce(p_planned_sets, planned_sets), updated_at = now()
   WHERE id = v_session.id;

  -- Score du Whiteboard : la charge max des séries valides.
  IF p_source_type = 'whiteboard' THEN
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
    'series_valides', v_nb,
    'records', v_modifies);
END;
$function$;

COMMENT ON FUNCTION public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb) IS
  'Valide une séance de musculation de l''appelant : séries, séance, score (Whiteboard : charge max) et 1RM en une transaction. N''écrit ni compteurs ni movement_logs : l''app les fait partir une seule fois, quand premiere_validation est vrai.';



-- list_athlete_strength_sets : définition de prod (md5 17c26f33…), 20270138.
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

  -- Un brouillon n'est visible que de l'athlète lui-même (une série sans séance,
  -- écrite par l'app actuelle au moment du score, reste visible comme avant).
  RETURN QUERY
  SELECT s.id, s.source_type, s.source_id, s.source_title, s.movement,
         s.movement_label, s.set_index, s.reps, s.load_kg,
         s.prescribed_reps, s.prescribed_load_kg, s.performed_at
  FROM public.strength_set_logs s
  WHERE s.user_id = p_user_id
    AND (p_user_id = auth.uid() OR NOT EXISTS (
      SELECT 1 FROM public.strength_sessions ss
       WHERE ss.user_id = s.user_id AND ss.source_type = s.source_type
         AND ss.source_id = s.source_id AND ss.status = 'draft'))
  ORDER BY s.performed_at DESC, s.movement, s.set_index
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
END;
$function$;

COMMENT ON FUNCTION public.list_athlete_strength_sets(uuid, integer) IS
  'Journal des séries réalisées d''un athlète. Autorisation identique à get_athlete_private_profile() : l''athlète lui-même, ou le gérant/co-gérant/coach d''une box où il est membre actif. Le journal n''est pas cloisonné par box : le staff voit aussi les séances faites ailleurs, exactement comme il voit déjà tous les 1RM.';
REVOKE ALL ON FUNCTION public.list_athlete_strength_sets(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_athlete_strength_sets(uuid, integer) TO authenticated, service_role;

-- Séances validées sans charge : brouillons (l'ancienne contrainte exige une charge max).
UPDATE public.strength_sessions SET status = 'draft', validated_at = NULL
 WHERE status = 'validated' AND max_load_kg IS NULL;

ALTER POLICY strength_sessions_own_insert ON public.strength_sessions
  WITH CHECK (user_id = auth.uid() AND status = 'draft' AND validated_at IS NULL
              AND first_validated_at IS NULL AND max_load_kg IS NULL);
ALTER POLICY strength_sessions_own_update ON public.strength_sessions
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid() AND status = 'draft' AND validated_at IS NULL
              AND first_validated_at IS NULL AND max_load_kg IS NULL);

ALTER TABLE public.strength_sessions DROP CONSTRAINT strength_sessions_statut_coherent;
ALTER TABLE public.strength_sessions DROP COLUMN total_reps;
ALTER TABLE public.strength_sessions ADD CONSTRAINT strength_sessions_statut_coherent CHECK (
  (status = 'draft' AND validated_at IS NULL)
  OR (status = 'validated' AND validated_at IS NOT NULL AND first_validated_at IS NOT NULL
      AND max_load_kg IS NOT NULL)
);

ALTER TABLE public.strength_set_logs DROP COLUMN is_added;
