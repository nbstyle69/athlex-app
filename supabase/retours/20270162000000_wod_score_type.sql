-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270162000000_wod_score_type.sql (#453)
--
-- À jouer en UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : les tests le rejouent dans leur propre
-- transaction annulée).
--
-- Remet les définitions d'avant (md5 relevés en prod), retire la garde, les
-- contraintes et les deux colonnes de box_wods.
-- Échoue (contrainte wod_scores_score_type_check) s'il existe déjà des scores
-- 'rounds_reps' ou 'done' : c'est voulu, rien n'est effacé en silence. Dans ce
-- cas, décider d'abord de leur sort (DELETE explicite des lignes concernées).
-- Le Manager et l'app qui écrivent score_type / text_mode doivent être revenus
-- en arrière avant (sinon leurs écritures échouent sur colonne inconnue).
-- ═════════════════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  v_bcm text := md5(pg_get_functiondef('public.badge_condition_met(uuid, text)'::regprocedure));
  v_vss text := md5(pg_get_functiondef('public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure));
BEGIN
  IF v_bcm <> '3f1be61bc58cf5a0e831ed7cc3812d23' OR v_vss <> 'c39b912c63312f07deae5ffa4fbddc94' THEN
    RAISE EXCEPTION 'WOD_SCORE_TYPE_RETOUR_DERIVE: définitions inattendues (badge_condition_met %, validate_strength_session %) : rien n''est écrit', v_bcm, v_vss;
  END IF;
END $garde$;

DROP TRIGGER trg_wod_scores_type_du_wod ON public.wod_scores;
DROP FUNCTION public.trg_wod_scores_type_du_wod();

ALTER TABLE public.wod_scores
  DROP CONSTRAINT wod_scores_done_check,
  DROP CONSTRAINT wod_scores_rounds_reps_check,
  DROP CONSTRAINT wod_scores_score_type_check,
  ADD CONSTRAINT wod_scores_score_type_check
    CHECK (score_type = ANY (ARRAY['time'::text, 'reps'::text, 'weight'::text, 'rounds'::text]));

ALTER TABLE public.box_wods
  DROP COLUMN score_type,
  DROP COLUMN text_mode;

CREATE OR REPLACE FUNCTION public.badge_condition_met(p_athlete_id uuid, p_badge_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_elo   integer;
  v_count integer;
  v_rule  public.badge_rules%ROWTYPE;
  v_total bigint;
BEGIN
  IF p_athlete_id IS NULL THEN
    RETURN false;
  END IF;

  -- ── Badges de mouvement : la règle est en base, le cumul aussi ────────────
  IF p_badge_key LIKE 'mv\_%' THEN
    SELECT * INTO v_rule FROM public.badge_rules WHERE badge_key = p_badge_key;
    IF NOT FOUND THEN
      -- Badge `mv_*` publié au catalogue sans règle : jamais réclamable, comme
      -- avant ce lot. Silencieux volontairement — `claim_badge` répond déjà
      -- « condition_non_remplie », et un badge sans règle est un oubli de
      -- migration, pas une tentative de l'athlète.
      RETURN false;
    END IF;

    IF v_rule.rule_kind = 'polyvalent' THEN
      -- Nombre de mouvements dépassant le seuil par mouvement. La clé primaire
      -- de `user_movement_stats` est (user, movement, unit) : une ligne par
      -- mouvement, donc compter les lignes revient à compter les mouvements.
      SELECT count(*) INTO v_count
        FROM public.user_movement_stats
       WHERE user_id = p_athlete_id
         AND unit = v_rule.unit
         AND movement = ANY (v_rule.movement_keys)
         AND total_reps >= v_rule.per_movement_threshold;
      RETURN v_count >= v_rule.threshold;
    END IF;

    -- `movement` et `total` se calculent pareil : une somme sur les mouvements
    -- comptés, dans l'unité de la règle. Seule l'étendue de `movement_keys`
    -- les distingue — une famille d'un côté, l'espace de clés entier de l'autre.
    SELECT COALESCE(sum(total_reps), 0) INTO v_total
      FROM public.user_movement_stats
     WHERE user_id = p_athlete_id
       AND unit = v_rule.unit
       AND movement = ANY (v_rule.movement_keys);
    RETURN v_total >= v_rule.threshold;
  END IF;

  CASE p_badge_key

    -- Bienvenue : porté par tout profil existant.
    WHEN 'level_scaled' THEN
      RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = p_athlete_id);

    -- Paliers de classement : ELO réel du profil.
    WHEN 'level_inter', 'level_rx', 'level_rx_plus', 'level_elite', 'level_pro' THEN
      SELECT elo INTO v_elo FROM public.profiles WHERE id = p_athlete_id;
      IF v_elo IS NULL THEN RETURN false; END IF;
      RETURN v_elo >= CASE p_badge_key
        WHEN 'level_inter'    THEN 1001
        WHEN 'level_rx'       THEN 1200
        WHEN 'level_rx_plus'  THEN 1400
        WHEN 'level_elite'    THEN 1600
        WHEN 'level_pro'      THEN 1800
      END;

    -- Premier score : une ligne de score existe réellement.
    WHEN 'first_score' THEN
      RETURN EXISTS (SELECT 1 FROM public.tournament_scores      WHERE athlete_id = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.daily_tournament_scores WHERE user_id    = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.wod_scores              WHERE member_id  = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.generated_wod_scores    WHERE user_id    = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.inter_scores            WHERE athlete_id = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.scores                  WHERE athlete_id = p_athlete_id);

    -- Palmarès : rang final distribué par l'organisateur à la clôture.
    WHEN 'first_win' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.tournament_elo_history
         WHERE athlete_id = p_athlete_id AND final_rank = 1
      );

    WHEN 'champion_5' THEN
      SELECT count(*) INTO v_count
        FROM public.tournament_elo_history
       WHERE athlete_id = p_athlete_id AND final_rank = 1;
      RETURN v_count >= 5;

    WHEN 'podium' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.tournament_elo_history
         WHERE athlete_id = p_athlete_id AND final_rank BETWEEN 1 AND 3
      );

    WHEN 'veteran_10' THEN
      SELECT count(DISTINCT tournament_id) INTO v_count
        FROM public.tournament_participants
       WHERE athlete_id = p_athlete_id;
      RETURN v_count >= 10;

    -- Social : amitiés réellement acceptées, dans les deux sens.
    WHEN 'social_5' THEN
      SELECT count(*) INTO v_count
        FROM public.friendships
       WHERE status = 'accepted'
         AND (requester_id = p_athlete_id OR addressee_id = p_athlete_id);
      RETURN v_count >= 5;

    -- Messages réellement envoyés (chat de groupe + messagerie directe).
    WHEN 'chatty_50' THEN
      SELECT (SELECT count(*) FROM public.group_messages WHERE sender_id = p_athlete_id)
           + (SELECT count(*) FROM public.messages       WHERE sender_id = p_athlete_id)
        INTO v_count;
      RETURN v_count >= 50;

    ELSE
      -- Badge sans source serveur fiable : jamais réclamable.
      RETURN false;
  END CASE;
END;
$function$;

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
  IF p_source_type = 'whiteboard' AND v_max IS NOT NULL THEN
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
$function$;
