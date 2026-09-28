-- ═════════════════════════════════════════════════════════════════════════════
-- Séances de musculation : brouillon côté serveur, validation en une transaction
--
-- Appliquée en prod : NON.
--
-- Chantier « Saisie des charges en musculation », PR 1 (base). Décisions de Nab et
-- de Claude (conception), 28-29/09/2026.
--
-- Constat en prod, lecture seule, le 29/09/2026 :
--   * strength_set_logs : 50 séries, 5 séances (user, source_type, source_id),
--     3 athlètes, toutes 'whiteboard' ; aucun statut, aucun déclencheur ; 4 policies
--     propriétaire (qual / with_check md5 3a807491e0a912fbfbee0ffa087b82f6) ;
--     ACL authenticated=arwdm, anon aucun ;
--   * l'app écrit les séries (upsert puis purge séparée), le score (champ POIDS
--     saisi à part) et le 1RM (profiles.personal_records) en trois appels non
--     atomiques ; rien n'est gardé tant que le score n'est pas validé ;
--   * list_athlete_strength_sets (lecture staff) : md5 871558a8d650613413328abd505305aa.
--
-- Ce qui change :
--   1. strength_sessions : une séance par (athlète, source_type, source_id), statut
--      'draft' ou 'validated', séries prévues, charge max, première et dernière
--      validation. L'athlète crée, modifie et supprime ses brouillons ; il ne peut
--      ni créer une séance validée, ni en faire une par modification (statut,
--      charge max, dates de validation), ni toucher une séance validée : seule la
--      fonction validate_strength_session le fait.
--   2. strength_set_logs rattachée à sa séance par une clé étrangère composite
--      (user_id, source_type, source_id) → strength_sessions, en cascade : une série
--      ne peut exister sans sa séance, ni appartenir à la séance d'un autre.
--      `reps` devient facultatif (une série commencée en brouillon) ;
--      source_type accepte 'generated' (séances générées, PR 3).
--      Écriture directe des séries par l'athlète : seulement dans une séance en
--      brouillon. Lecture : l'athlète lit toutes ses séries (brouillons compris).
--   3. Reprise : les 5 séances existantes deviennent des séances validées
--      (première validation = première série, charge max = plus lourde série
--      valide). Aucune série, aucun score, aucun record modifié.
--   4. validate_strength_session(…) : SECURITY DEFINER bornée à auth.uid(). En UNE
--      transaction, sous verrou de la séance :
--        - remplace les séries de la séance par les séries valides reçues
--          (reps 1..500, charge ]0 ; 500]) ; une série gardée conserve son id ;
--          plus de purge séparée ;
--        - charge max = plus lourde charge des séries valides (« jamais plus que
--          ce que le score prouve ») ; refus SEANCE_VIDE sans série valide ;
--        - séance validée, première validation posée une seule fois ;
--        - Whiteboard : score wod_scores 'weight' = charge max, dans la box du WOD
--          (refus SCORE_AUTRE_TYPE si l'athlète a déjà un score d'un autre type) ;
--          séances générées : pas de wod_scores (le score reste le tonnage,
--          écrit par l'app dans generated_wod_scores) ;
--        - 1RM calculés par l'app (formule existante, Epley) et reçus ici : chaque
--          record doit être prouvé par une série de l'athlète (celle de la séance,
--          ou une série d'une séance validée) : kg ≤ estimation Epley de la série
--          (reps 1..10), sinon RECORD_NON_PROUVE. Un record monte si le nouveau
--          est plus haut ; il ne baisse (ou ne disparaît, kg NULL) que s'il venait
--          d'une série de cette séance (_src). Un record venu de cette séance et
--          plus justifié après correction, sans nouveau calcul reçu, est refusé
--          (RECORD_A_RECALCULER) : aucune écriture partielle ;
--        - rend premiere_validation : l'app ne fait partir compteurs, série
--          hebdomadaire, badges, crédits et notifications qu'à la première
--          validation.
--      Elle n'écrit jamais dans movement_logs ni user_movement_stats.
--   5. list_athlete_strength_sets : un tiers (staff) ne voit que les séries des
--      séances validées ; l'athlète voit aussi ses brouillons.
--
-- Contrôlée par `supabase/tests/seances_musculation.sql`.
--
-- Retour arrière (transactionnel, vérifié sur le rejeu contre les empreintes de
-- prod du 29/09/2026 ; supprime les séries de brouillon incomplètes et les séries
-- 'generated', qui n'existaient pas avant) :
--
--   BEGIN;
--   DROP FUNCTION public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb);
--   DROP FUNCTION internal.estimation_1rm(numeric, integer);
--   <définition de prod de list_athlete_strength_sets, md5 871558a8…, reprise
--    telle quelle de 20261110_lot4_journal_series_realisees.sql>
--   ALTER POLICY strength_sets_own_insert ON public.strength_set_logs WITH CHECK (user_id = auth.uid());
--   ALTER POLICY strength_sets_own_update ON public.strength_set_logs
--     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
--   ALTER POLICY strength_sets_own_delete ON public.strength_set_logs USING (user_id = auth.uid());
--   DELETE FROM public.strength_set_logs WHERE reps IS NULL OR source_type = 'generated';
--   ALTER TABLE public.strength_set_logs DROP CONSTRAINT strength_set_logs_session_fkey;
--   ALTER TABLE public.strength_set_logs ALTER COLUMN reps SET NOT NULL;
--   ALTER TABLE public.strength_set_logs DROP CONSTRAINT strength_set_logs_source_type_check;
--   ALTER TABLE public.strength_set_logs ADD CONSTRAINT strength_set_logs_source_type_check
--     CHECK (source_type = ANY (ARRAY['whiteboard'::text, 'program'::text]));
--   DROP TABLE public.strength_sessions;
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══ 1. Séances ═════════════════════════════════════════════════════════════
CREATE TABLE public.strength_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type        text NOT NULL CHECK (source_type IN ('whiteboard', 'program', 'generated')),
  source_id          uuid NOT NULL,
  source_title       text,
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated')),
  planned_sets       integer CHECK (planned_sets IS NULL OR planned_sets BETWEEN 1 AND 500),
  max_load_kg        numeric(6,2) CHECK (max_load_kg IS NULL OR (max_load_kg > 0 AND max_load_kg <= 500)),
  first_validated_at timestamptz,
  validated_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strength_sessions_source_key UNIQUE (user_id, source_type, source_id),
  CONSTRAINT strength_sessions_statut_coherent CHECK (
    (status = 'draft' AND validated_at IS NULL)
    OR (status = 'validated' AND validated_at IS NOT NULL AND first_validated_at IS NOT NULL
        AND max_load_kg IS NOT NULL)
  )
);

COMMENT ON TABLE public.strength_sessions IS
  'Séance de musculation d''un athlète (WOD du Whiteboard ou de programme, ou séance générée). Brouillon écrit par l''athlète au fil de la saisie ; validée seulement par validate_strength_session, qui écrit séries, score et 1RM en une transaction.';

ALTER TABLE public.strength_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY strength_sessions_own_read ON public.strength_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY strength_sessions_own_insert ON public.strength_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'draft' AND validated_at IS NULL
              AND first_validated_at IS NULL AND max_load_kg IS NULL);
-- Un brouillon reste un brouillon : ni statut, ni charge max, ni dates de
-- validation ne s'écrivent en direct (droit de table, pas de droit de colonne :
-- l'audit des droits les refuse aux rôles clients, contrôle T3).
CREATE POLICY strength_sessions_own_update ON public.strength_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid() AND status = 'draft' AND validated_at IS NULL
              AND first_validated_at IS NULL AND max_load_kg IS NULL);
CREATE POLICY strength_sessions_own_delete ON public.strength_sessions
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND status = 'draft');

REVOKE ALL ON public.strength_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strength_sessions TO authenticated;

-- ═══ 2. Reprise des séances existantes (avant la clé étrangère) ═══════════════
INSERT INTO public.strength_sessions
  (user_id, source_type, source_id, source_title, status, max_load_kg,
   first_validated_at, validated_at, created_at, updated_at)
SELECT l.user_id, l.source_type, l.source_id, max(l.source_title), 'validated',
       max(l.load_kg) FILTER (WHERE l.load_kg > 0),
       min(l.performed_at), max(l.performed_at), min(l.performed_at), max(l.performed_at)
  FROM public.strength_set_logs l
 GROUP BY l.user_id, l.source_type, l.source_id;

-- ═══ 3. Séries rattachées à leur séance ══════════════════════════════════════
ALTER TABLE public.strength_set_logs
  ADD CONSTRAINT strength_set_logs_session_fkey
  FOREIGN KEY (user_id, source_type, source_id)
  REFERENCES public.strength_sessions (user_id, source_type, source_id) ON DELETE CASCADE;

ALTER TABLE public.strength_set_logs ALTER COLUMN reps DROP NOT NULL;

-- Définition en prod : CHECK (source_type = ANY (ARRAY['whiteboard', 'program'])).
ALTER TABLE public.strength_set_logs DROP CONSTRAINT strength_set_logs_source_type_check;
ALTER TABLE public.strength_set_logs ADD CONSTRAINT strength_set_logs_source_type_check
  CHECK (source_type = ANY (ARRAY['whiteboard'::text, 'program'::text, 'generated'::text]));

-- Définitions en prod : user_id = auth.uid() (qual et with_check, md5 3a807491…).
-- La lecture reste celle-là ; l'écriture directe n'est permise que dans un
-- brouillon. La sous-requête lit strength_sessions, dont les policies ne relisent
-- pas strength_set_logs : pas de récursion.
ALTER POLICY strength_sets_own_insert ON public.strength_set_logs
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.strength_sessions s
     WHERE s.user_id = strength_set_logs.user_id AND s.source_type = strength_set_logs.source_type
       AND s.source_id = strength_set_logs.source_id AND s.status = 'draft'));
ALTER POLICY strength_sets_own_update ON public.strength_set_logs
  USING (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.strength_sessions s
     WHERE s.user_id = strength_set_logs.user_id AND s.source_type = strength_set_logs.source_type
       AND s.source_id = strength_set_logs.source_id AND s.status = 'draft'))
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.strength_sessions s
     WHERE s.user_id = strength_set_logs.user_id AND s.source_type = strength_set_logs.source_type
       AND s.source_id = strength_set_logs.source_id AND s.status = 'draft'));
ALTER POLICY strength_sets_own_delete ON public.strength_set_logs
  USING (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.strength_sessions s
     WHERE s.user_id = strength_set_logs.user_id AND s.source_type = strength_set_logs.source_type
       AND s.source_id = strength_set_logs.source_id AND s.status = 'draft'));

-- ═══ 4. Validation ═════════════════════════════════════════════════════════════
-- Estimation Epley, miroir de estimateOneRepMax (src/services/strengthPR.ts) sans
-- ses bornes de vraisemblance : ici elle ne sert qu'à vérifier qu'un record reçu
-- ne dépasse pas ce que la série prouve. NULL au-delà de 10 reps.
CREATE FUNCTION internal.estimation_1rm(p_load numeric, p_reps integer)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  SELECT CASE WHEN p_load > 0 AND p_reps BETWEEN 1 AND 10
              THEN round(CASE WHEN p_reps = 1 THEN p_load ELSE p_load * (1 + p_reps / 30.0) END * 2) / 2
         END
$function$;
REVOKE ALL ON FUNCTION internal.estimation_1rm(numeric, integer) FROM PUBLIC, anon, authenticated;

-- p_sets    : [{movement, movement_label, set_index, reps, load_kg,
--               prescribed_reps, prescribed_load_kg}] — la grille entière ; seules
--             les séries valides (reps 1..500, charge ]0 ; 500]) sont gardées.
-- p_records : [{label, kg, movement, set_index}] (série de cette séance) ou
--             [{label, kg, log_id}] (série d'une séance validée) ; kg NULL = plus
--             aucune série ne justifie un record venu de cette séance.
-- Un record « vient de cette séance » si sa provenance (_src) est une série de la
-- séance avant validation ET que cette série le justifiait : un record retouché à
-- la main au-dessus de sa série n'est ni baissé ni bloquant.
CREATE FUNCTION public.validate_strength_session(
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

REVOKE ALL ON FUNCTION public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb) TO authenticated;

-- ═══ 5. Lecture staff : sans les brouillons ═══════════════════════════════════
-- Définition en prod (md5 871558a8…) : identique, sans le filtre de statut.
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

  -- Un brouillon n'est visible que de l'athlète lui-même.
  RETURN QUERY
  SELECT s.id, s.source_type, s.source_id, s.source_title, s.movement,
         s.movement_label, s.set_index, s.reps, s.load_kg,
         s.prescribed_reps, s.prescribed_load_kg, s.performed_at
  FROM public.strength_set_logs s
  WHERE s.user_id = p_user_id
    AND (p_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.strength_sessions ss
       WHERE ss.user_id = s.user_id AND ss.source_type = s.source_type
         AND ss.source_id = s.source_id AND ss.status = 'validated'))
  ORDER BY s.performed_at DESC, s.movement, s.set_index
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
END;
$function$;

COMMIT;
