-- ═════════════════════════════════════════════════════════════════════════════
-- Gymnastique (G2, base) : validation sans charge, reps totales, séries ajoutées,
-- record de gymnastique confirmé
--
-- Appliquée en prod : NON (en attente du feu vert de Nab après le précontrôle).
--
-- Chantier « Saisie des séries en gymnastique », lot G2. Spec Figma 501:513, brief
-- G0 à G4 et arbitrages de Nab des 04/10/2026.
--
-- Constat en prod, lecture seule, le 04/10/2026 (G0, recontrôlé au précontrôle) :
--   * strength_sessions colonnes md5 360c5d64…, strength_sessions_statut_coherent
--     995590a3… (une séance validée exige max_load_kg) ; policies own_insert
--     8ff9ddf6…, own_update befcd93f… (qual|with_check) ;
--   * strength_set_logs colonnes md5 5437885b… (load_kg et prescribed_reps déjà
--     facultatifs) ;
--   * validate_strength_session 51768bb3… (prosrc 5393dc81…), identique à
--     20270138 : elle ne garde que les séries chargées (une séance de gymnastique
--     seule finit en SEANCE_VIDE, les séries sans charge d'une séance mixte sont
--     supprimées) ;
--   * list_athlete_strength_sets 17c26f33… (prosrc bd906512…), droits
--     authenticated, service_role (et propriétaire) ;
--   * aucun record de gymnastique avec source ; 8 séances validées, toutes
--     chargées ; 68 séries, toutes chargées.
--
-- Ce qui change :
--   1. strength_sessions.total_reps : somme des reps des séries sans charge,
--      calculée par validate_strength_session seule (les policies refusent toute
--      valeur écrite par le client, comme pour max_load_kg). Une séance validée
--      porte une charge max OU des reps totales (statut_coherent adapté).
--   2. strength_set_logs.is_added (défaut false) : série ajoutée depuis la grille
--      (G3), sans reps prévues (CHECK).
--   3. validate_strength_session (même signature) : une série sans charge est
--      gardée et validée quand aucune charge n'était prescrite pour elle ; une
--      série dont la charge est prescrite reste exigée avec sa charge, comme
--      avant. Charge max = séries chargées (NULL sans aucune), reps totales =
--      séries sans charge. Whiteboard : aucune écriture dans wod_scores pour une
--      séance sans aucune série chargée ; une séance chargée ou mixte garde son
--      score en charge, inchangé. is_added lu dans p_sets (prescribed_reps NULL
--      pour une série ajoutée) ; prescribed_reps / prescribed_load_kg à 0
--      deviennent NULL (la table les refusait). Records 1RM inchangés. Jamais de
--      movement_logs, aucun changement aux classements, tournois ni badges.
--   4. list_athlete_strength_sets renvoie is_added (dernière colonne) : nouveau
--      type de retour, donc DROP + CREATE ; corps, droits et commentaire repris
--      de la prod.
--   5. internal.gym_pr_label(text) : rapprochement des noms de gymnastique, miroir
--      de gymPrLabel (app), fermé aux rôles clients.
--   6. confirm_gym_record(p_set_log_id, p_label) : record de gymnastique confirmé
--      par l'athlète, prouvé par une série sans charge d'une séance validée de
--      l'appelant, jamais abaissé, au format des records actuels
--      (gymnastics_<Libellé>, _date, _src = id de la série). Exécutable par
--      authenticated seulement.
--
-- Contrôlée par `supabase/tests/gymnastique_validation_sans_charge.sql`.
--
-- Retour arrière : supabase/retours/20270145000000_gymnastique_validation_sans_charge.sql,
-- en une transaction (psql -1). Rejoué par le test, qui vérifie le retour exact
-- aux empreintes de prod du 04/10/2026. Une séance validée sans aucune charge y
-- redevient un brouillon (ses séries restent) ; les records de gymnastique déjà
-- confirmés restent.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══ 1. Séance : reps totales, statut cohérent ═══════════════════════════════
ALTER TABLE public.strength_sessions
  ADD COLUMN total_reps integer CHECK (total_reps IS NULL OR total_reps > 0);
COMMENT ON COLUMN public.strength_sessions.total_reps IS
  'Somme des reps des séries sans charge (gymnastique) de la séance validée, calculée par validate_strength_session ; NULL sans série sans charge.';

-- Définition en prod (995590a3…) : validée ⇒ max_load_kg présent.
ALTER TABLE public.strength_sessions DROP CONSTRAINT strength_sessions_statut_coherent;
ALTER TABLE public.strength_sessions ADD CONSTRAINT strength_sessions_statut_coherent CHECK (
  (status = 'draft' AND validated_at IS NULL)
  OR (status = 'validated' AND validated_at IS NOT NULL AND first_validated_at IS NOT NULL
      AND (max_load_kg IS NOT NULL OR total_reps IS NOT NULL))
);

-- Définitions en prod : identiques, sans « total_reps IS NULL ». Les reps
-- totales, comme la charge max, ne s'écrivent jamais en direct.
ALTER POLICY strength_sessions_own_insert ON public.strength_sessions
  WITH CHECK (user_id = auth.uid() AND status = 'draft' AND validated_at IS NULL
              AND first_validated_at IS NULL AND max_load_kg IS NULL AND total_reps IS NULL);
ALTER POLICY strength_sessions_own_update ON public.strength_sessions
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid() AND status = 'draft' AND validated_at IS NULL
              AND first_validated_at IS NULL AND max_load_kg IS NULL AND total_reps IS NULL);

-- ═══ 2. Séries ajoutées ══════════════════════════════════════════════════════
ALTER TABLE public.strength_set_logs
  ADD COLUMN is_added boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT strength_set_logs_ajoutee_sans_prevu CHECK (NOT is_added OR prescribed_reps IS NULL);
COMMENT ON COLUMN public.strength_set_logs.is_added IS
  'Série ajoutée par l''athlète au-delà de la prescription (grille « Ajouter une série ») ; jamais de reps prévues.';

-- ═══ 3. Validation ═════════════════════════════════════════════════════════════
-- Définition en prod : 20270138 (md5 51768bb3…). Changements : voir l'en-tête
-- (le diff prod → migration est montré dans la PR).
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
  -- prescrite ; une série dont la charge est prescrite reste exigée avec sa
  -- charge, comme avant. Une série ajoutée (is_added) n'a pas de reps prévues.
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
                 coalesce(e->>'is_added', '') = 'true' AS ajoutee
            FROM jsonb_array_elements(p_sets) e) c
   WHERE c.e->>'reps' ~ '^[0-9]+$'
     AND c.e->>'set_index' ~ '^[0-9]+$'
     AND (c.e->>'reps')::integer BETWEEN 1 AND 500
     AND ((c.charge > 0 AND c.charge <= 500)
          OR (c.sans_charge AND c.charge_prevue IS NULL));

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

COMMENT ON FUNCTION public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb) IS
  'Valide une séance de musculation de l''appelant : séries, séance, score (Whiteboard : charge max) et 1RM en une transaction. N''écrit ni compteurs ni movement_logs : l''app les fait partir une seule fois, quand premiere_validation est vrai.';


COMMENT ON FUNCTION public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb) IS
  'Valide une séance de musculation de l''appelant : séries (sans charge comprises, si aucune charge n''était prescrite), séance (charge max et reps totales), score (Whiteboard : charge max, rien sans série chargée) et 1RM en une transaction. N''écrit ni compteurs ni movement_logs : l''app les fait partir une seule fois, quand premiere_validation est vrai.';

-- ═══ 4. Lecture staff : is_added en plus ══════════════════════════════════════
-- Définition en prod : 20270138 (md5 17c26f33…), droits authenticated et
-- service_role, commentaire 160a2db0…. Le type de retour change : DROP + CREATE,
-- puis droits et commentaire reposés à l'identique. Seul ajout : is_added.
DROP FUNCTION public.list_athlete_strength_sets(uuid, integer);
CREATE FUNCTION public.list_athlete_strength_sets(
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
  performed_at       timestamptz,
  is_added           boolean
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
         s.prescribed_reps, s.prescribed_load_kg, s.performed_at, s.is_added
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

-- ═══ 5. Rapprochement des noms de gymnastique ════════════════════════════════
-- Miroir de gymPrLabel (src/screens/home/gymZones.ts) : casse, tirets, espaces et
-- pluriel ne comptent pas (« Ring Muscle-ups » = « Ring Muscle-up »), les mots ne
-- sont jamais retirés (« Strict Pull-Ups » n'est pas « Pull-ups »), et seules les
-- abréviations qui désignent un seul libellé sont rapprochées (ni « HSPU » ni
-- « MU » seuls). Les 11 libellés sont ceux de GYM_PR_MOVEMENTS.
CREATE FUNCTION internal.gym_pr_label(p_name text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  WITH cle AS (
    SELECT string_agg(regexp_replace(w, 's$', ''), '' ORDER BY n) AS k
      FROM regexp_split_to_table(lower(coalesce(p_name, '')), '[[:space:]_-]+') WITH ORDINALITY AS t(w, n)
     WHERE w <> ''
  )
  SELECT l.libelle
    FROM cle
    JOIN (VALUES
      ('toetobar', 'Toes To Bar'),
      ('pullup', 'Pull-ups'),
      ('chesttobar', 'Chest To Bar'),
      ('handstandpushup', 'Hand Stand Push Up'),
      ('stricthandstandpushup', 'Strict Hand Stand Push Up'),
      ('wallfacinghandstandpushup', 'Wall Facing Hand Stand Push Up'),
      ('ringmuscleup', 'Ring Muscle-up'),
      ('barmuscleup', 'Bar Muscle-up'),
      ('dip', 'Dips'),
      ('strictdip', 'Strict Dips'),
      ('pullover', 'Pull Over'),
      ('t2b', 'Toes To Bar'),
      ('ttb', 'Toes To Bar'),
      ('c2b', 'Chest To Bar'),
      ('ctb', 'Chest To Bar'),
      ('rmu', 'Ring Muscle-up'),
      ('bmu', 'Bar Muscle-up'),
      ('stricthspu', 'Strict Hand Stand Push Up'),
      ('wallfacinghspu', 'Wall Facing Hand Stand Push Up')
    ) AS l(cle, libelle) ON l.cle = cle.k
$function$;
REVOKE ALL ON FUNCTION internal.gym_pr_label(text) FROM PUBLIC, anon, authenticated, service_role;

-- ═══ 6. Record de gymnastique confirmé (fenêtre « Nouveau record ? ») ══════════
-- Le record ne change jamais seul : l'athlète le confirme depuis l'app, ici, et le
-- serveur vérifie qu'une série validée de l'appelant le prouve. La valeur écrite
-- est le nombre de reps de la série (jamais une valeur du client) ; un record
-- n'est jamais abaissé ; format des records actuels (clé, date, source).
--   RECORD_NON_PROUVE      : série absente, d'un autre athlète, d'un brouillon,
--                            chargée, ou d'un autre mouvement de gymnastique ;
--   RECORD_NON_AMELIORE    : la série ne dépasse pas le record enregistré ;
--   MOUVEMENT_NON_GYMNIQUE : libellé hors des 11, ou mouvement de la série qui ne
--                            se rapproche d'aucun d'eux.
CREATE FUNCTION public.confirm_gym_record(p_set_log_id uuid, p_label text)
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
$function$;

COMMENT ON FUNCTION public.confirm_gym_record(uuid, text) IS
  'Confirme un record de gymnastique (reps) de l''appelant, prouvé par une série sans charge d''une séance validée : valeur = reps de la série, jamais abaissé, clé gymnastics_<Libellé> avec date et source (id de la série). Erreurs RECORD_NON_PROUVE, RECORD_NON_AMELIORE, MOUVEMENT_NON_GYMNIQUE.';
REVOKE ALL ON FUNCTION public.confirm_gym_record(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_gym_record(uuid, text) TO authenticated;

COMMIT;
