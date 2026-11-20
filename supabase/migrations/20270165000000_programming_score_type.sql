-- ═════════════════════════════════════════════════════════════════════════════
-- WOD d'offre Marketplace : type de score et texte libre, recopiés à chaque
-- copie de WOD (nbstyle69/AthleX-Manager#453, PR 1c : base)
--
-- Appliquée en prod : NON (feu vert de Nab attendu). Pas de BEGIN/COMMIT dans
-- ce fichier : il se joue en UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- 1. box_programming_wods.score_type (NULL | time | rounds_reps | reps | weight
--    | none) et text_mode (lines | free, défaut 'lines'), avec les mêmes
--    contraintes que box_wods (20270162), noms explicites : 'none' ⇒
--    leaderboard_enabled = false. Les WODs d'offre existants restent NULL /
--    'lines' (défaut constant : pas de réécriture de la table), donc se
--    comportent comme avant.
-- 2. Les deux colonnes sont recopiées par chaque chemin de copie, et rien
--    d'autre ne change dans ces fonctions :
--      box_wods → offre  : sync_wod_to_offer (insertion et mise à jour),
--                          copy_week_to_offer depuis une semaine de la box
--                          (passe par sync_wod_to_offer),
--                          box_wods_propagate_to_offer (déclencheur),
--                          save_week_as_template (semaine type) ;
--      offre → offre     : copy_week_to_offer depuis une semaine type ;
--      offre → box_wods  : apply_program_week (programme, abonnement, semaine
--                          type), materialize_box_programming (cron).
-- 3. Le déclencheur trg_box_wods_propagate_to_offer (AFTER UPDATE OF …) écoute
--    aussi score_type et text_mode : sans quoi changer le seul type d'un WOD
--    maison ne mettrait pas à jour ses copies dans les offres.
-- Inchangé : la garde trg_wod_scores_type_du_wod (les scores restent sur
-- box_wods, et chaque copie vers box_wods porte désormais le type de l'offre).
-- Retour arrière : supabase/retours/20270165000000_programming_score_type.sql.
-- Contrôlée par supabase/tests/programmation_score_type.sql.
-- ═════════════════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  v_0 text := md5(pg_get_functiondef('public.sync_wod_to_offer(uuid, uuid, integer)'::regprocedure));
  v_1 text := md5(pg_get_functiondef('public.copy_week_to_offer(text, uuid, date, uuid, uuid, integer, boolean)'::regprocedure));
  v_2 text := md5(pg_get_functiondef('public.box_wods_propagate_to_offer()'::regprocedure));
  v_3 text := md5(pg_get_functiondef('public.save_week_as_template(uuid, date, text, uuid)'::regprocedure));
  v_4 text := md5(pg_get_functiondef('public.apply_program_week(text, uuid, integer, date, text, uuid[], boolean)'::regprocedure));
  v_5 text := md5(pg_get_functiondef('public.materialize_box_programming(date)'::regprocedure));
  v_trg text := (SELECT md5(pg_get_triggerdef(t.oid)) FROM pg_trigger t
                 WHERE t.tgrelid = 'public.box_wods'::regclass AND t.tgname = 'trg_box_wods_propagate_to_offer');
BEGIN
  IF v_0 NOT IN ('c6efe778d88d6996e161320a00caa2bc', '6bc07a9b3a6aac8979098d5882337d3a') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_DERIVE: définition de sync_wod_to_offer inattendue (md5 %) : rien n''est écrit', v_0;
  END IF;
  IF v_1 NOT IN ('d4703fb237f6050cb033cf12d8cdd716', '5044d180c24de58a8b4ea369ffbe6c1c') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_DERIVE: définition de copy_week_to_offer inattendue (md5 %) : rien n''est écrit', v_1;
  END IF;
  IF v_2 NOT IN ('8b9beac5fa467bf5f1d15a90d2d0eafd', '8e97ee37f5c50a005fb0e1fe055f4e46') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_DERIVE: définition de box_wods_propagate_to_offer inattendue (md5 %) : rien n''est écrit', v_2;
  END IF;
  IF v_3 NOT IN ('630d0c7f6ffbd232b86b2dae5d495c05', '941f0a50e4ee9d4bc88a50b4248cce15') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_DERIVE: définition de save_week_as_template inattendue (md5 %) : rien n''est écrit', v_3;
  END IF;
  IF v_4 NOT IN ('d81f5b7d3c3a057d2cc7671fa30d88c5', '109707e9011fdf12fed622af2535cf34') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_DERIVE: définition de apply_program_week inattendue (md5 %) : rien n''est écrit', v_4;
  END IF;
  IF v_5 NOT IN ('d04f268fbd5f59e2f480fec6d043891f', '551cf5ab3ee4c72b804d873aee174c2c') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_DERIVE: définition de materialize_box_programming inattendue (md5 %) : rien n''est écrit', v_5;
  END IF;
  IF v_trg IS NULL OR v_trg NOT IN ('1df76cd2fab882d5e7fd9a39801c3a05', '3a2ef9d9c2b6b46ab014b711d1a95268') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_DERIVE: déclencheur trg_box_wods_propagate_to_offer inattendu (md5 %) : rien n''est écrit', v_trg;
  END IF;
END $garde$;

-- ── 1. box_programming_wods : mêmes colonnes et règles que box_wods (20270162) ─
ALTER TABLE public.box_programming_wods
  ADD COLUMN score_type text,
  ADD COLUMN text_mode text NOT NULL DEFAULT 'lines',
  ADD CONSTRAINT box_programming_wods_score_type_check
    CHECK (score_type IN ('time', 'rounds_reps', 'reps', 'weight', 'none')),
  ADD CONSTRAINT box_programming_wods_text_mode_check CHECK (text_mode IN ('lines', 'free')),
  ADD CONSTRAINT box_programming_wods_sans_score_sans_classement_check
    CHECK (score_type IS DISTINCT FROM 'none' OR leaderboard_enabled = false);
COMMENT ON COLUMN public.box_programming_wods.score_type IS
  'Type de score choisi par le créateur (time | rounds_reps | reps | weight | none) ; NULL = l''athlète choisit. Recopié vers et depuis box_wods à chaque copie (#453).';
COMMENT ON COLUMN public.box_programming_wods.text_mode IS
  'lines = lignes structurées ; free = texte libre affiché tel quel. Recopié vers et depuis box_wods à chaque copie (#453).';

-- ── 2. Fonctions de copie : score_type et text_mode recopiés, rien d'autre ──
-- Définitions de prod (md5 de la garde) ; propriétaire et droits conservés
-- par CREATE OR REPLACE.

-- sync_wod_to_offer
CREATE OR REPLACE FUNCTION public.sync_wod_to_offer(p_box_wod_id uuid, p_programming_id uuid, p_week integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog public.box_programming;
  v_wod  public.box_wods;
  v_id   uuid;
BEGIN
  v_prog := public.assert_offer_editor(p_programming_id);

  SELECT * INTO v_wod FROM public.box_wods WHERE id = p_box_wod_id;
  IF v_wod.id IS NULL OR v_wod.box_id IS DISTINCT FROM v_prog.publisher_box_id THEN
    RAISE EXCEPTION 'WOD introuvable dans la box éditrice' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_wod.scheduled_date IS NULL THEN
    RAISE EXCEPTION 'Une séance sans date ne se copie pas dans une offre (jour indéterminé)'
      USING ERRCODE = 'check_violation';
  END IF;
  -- Une carte reçue d'une autre box ne se revend pas.
  IF v_wod.source_programming_wod_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.box_programming sp
     WHERE sp.id = v_wod.source_programming_id
       AND sp.publisher_box_id IS DISTINCT FROM v_prog.publisher_box_id
  ) THEN
    RAISE EXCEPTION 'WOD reçu d''une programmation : il ne se copie pas dans une offre'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_week IS NULL OR p_week < 1 OR p_week > v_prog.weeks_count THEN
    RAISE EXCEPTION 'Semaine % hors de l''offre (1..%)', p_week, v_prog.weeks_count
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.box_programming_wods (
    programming_id, week_number, day_of_week, title, description, wod_type,
    time_cap_seconds, rounds, sort_order, notes, block_name, video_url,
    leaderboard_enabled, emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
    score_type, text_mode,
    origin_box_wod_id
  )
  VALUES (
    p_programming_id, p_week, EXTRACT(ISODOW FROM v_wod.scheduled_date)::smallint,
    v_wod.title, v_wod.description, v_wod.wod_type,
    v_wod.time_cap_seconds, v_wod.rounds, v_wod.sort_order, v_wod.notes, v_wod.block_name,
    v_wod.video_url, v_wod.leaderboard_enabled, v_wod.emom_interval_minutes,
    v_wod.tabata_work_seconds, v_wod.tabata_rest_seconds,
    v_wod.score_type, v_wod.text_mode,
    v_wod.id
  )
  ON CONFLICT (programming_id, origin_box_wod_id) WHERE origin_box_wod_id IS NOT NULL
  DO UPDATE SET
    week_number = EXCLUDED.week_number,
    day_of_week = EXCLUDED.day_of_week,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    wod_type = EXCLUDED.wod_type,
    time_cap_seconds = EXCLUDED.time_cap_seconds,
    rounds = EXCLUDED.rounds,
    sort_order = EXCLUDED.sort_order,
    notes = EXCLUDED.notes,
    block_name = EXCLUDED.block_name,
    video_url = EXCLUDED.video_url,
    leaderboard_enabled = EXCLUDED.leaderboard_enabled,
    emom_interval_minutes = EXCLUDED.emom_interval_minutes,
    tabata_work_seconds = EXCLUDED.tabata_work_seconds,
    tabata_rest_seconds = EXCLUDED.tabata_rest_seconds,
    score_type = EXCLUDED.score_type,
    text_mode = EXCLUDED.text_mode
  RETURNING id INTO v_id;

  UPDATE public.box_programming SET updated_at = now() WHERE id = p_programming_id;

  RETURN v_id;
END;
$function$;

-- copy_week_to_offer
CREATE OR REPLACE FUNCTION public.copy_week_to_offer(p_source_kind text, p_box_id uuid, p_source_monday date, p_template_id uuid, p_programming_id uuid, p_week integer, p_replace boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog     public.box_programming;
  v_tpl      record;
  v_copied   integer := 0;
  v_replaced integer := 0;
  v_existing integer := 0;
  wodrow     record;
BEGIN
  v_prog := public.assert_offer_editor(p_programming_id);

  IF p_week IS NULL OR p_week < 1 OR p_week > v_prog.weeks_count THEN
    RAISE EXCEPTION 'Semaine % hors de l''offre (1..%)', p_week, v_prog.weeks_count
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_source_kind = 'whiteboard' THEN
    IF p_box_id IS DISTINCT FROM v_prog.publisher_box_id THEN
      RAISE EXCEPTION 'La semaine copiée doit venir de la box éditrice'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p_source_monday IS NULL OR EXTRACT(ISODOW FROM p_source_monday)::int <> 1 THEN
      RAISE EXCEPTION 'La semaine source doit commencer un lundi (reçu : %)', p_source_monday;
    END IF;
  ELSIF p_source_kind = 'template' THEN
    SELECT p.id, p.publisher_box_id INTO v_tpl
      FROM public.box_programming p
     WHERE p.id = p_template_id AND p.is_template;
    IF v_tpl.id IS NULL OR v_tpl.publisher_box_id IS DISTINCT FROM v_prog.publisher_box_id THEN
      RAISE EXCEPTION 'Semaine type introuvable pour cette box'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    RAISE EXCEPTION 'Source inconnue : %', p_source_kind;
  END IF;

  SELECT count(*) INTO v_existing
    FROM public.box_programming_wods
   WHERE programming_id = p_programming_id AND week_number = p_week;

  IF p_replace THEN
    WITH removed AS (
      DELETE FROM public.box_programming_wods
       WHERE programming_id = p_programming_id AND week_number = p_week
      RETURNING 1
    )
    SELECT count(*) INTO v_replaced FROM removed;
  END IF;

  IF p_source_kind = 'whiteboard' THEN
    FOR wodrow IN
      SELECT w.id
        FROM public.box_wods w
       WHERE w.box_id = p_box_id
         AND w.scheduled_date >= p_source_monday
         AND w.scheduled_date <  p_source_monday + 7
         AND NOT (
           w.source_programming_wod_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM public.box_programming sp
              WHERE sp.id = w.source_programming_id
                AND sp.publisher_box_id IS DISTINCT FROM v_prog.publisher_box_id
           )
         )
       ORDER BY w.scheduled_date, w.sort_order
    LOOP
      PERFORM public.sync_wod_to_offer(wodrow.id, p_programming_id, p_week);
      v_copied := v_copied + 1;
    END LOOP;
  ELSE
    FOR wodrow IN
      SELECT * FROM public.box_programming_wods
       WHERE programming_id = p_template_id AND week_number = 1
       ORDER BY day_of_week, sort_order
    LOOP
      INSERT INTO public.box_programming_wods (
        programming_id, week_number, day_of_week, title, description, wod_type,
        time_cap_seconds, rounds, sort_order, notes, block_name, video_url,
        leaderboard_enabled, emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
        score_type, text_mode
      )
      VALUES (
        p_programming_id, p_week, wodrow.day_of_week, wodrow.title, wodrow.description,
        wodrow.wod_type, wodrow.time_cap_seconds, wodrow.rounds, wodrow.sort_order,
        wodrow.notes, wodrow.block_name, wodrow.video_url, wodrow.leaderboard_enabled,
        wodrow.emom_interval_minutes, wodrow.tabata_work_seconds, wodrow.tabata_rest_seconds,
        wodrow.score_type, wodrow.text_mode
      );
      v_copied := v_copied + 1;
    END LOOP;
  END IF;

  IF v_copied = 0 THEN
    RAISE EXCEPTION 'Aucun WOD à copier depuis cette source' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.box_programming SET updated_at = now() WHERE id = p_programming_id;

  RETURN jsonb_build_object(
    'copied', v_copied,
    'replaced', v_replaced,
    'existing_before', v_existing,
    'week', p_week
  );
END;
$function$;

-- box_wods_propagate_to_offer
CREATE OR REPLACE FUNCTION public.box_wods_propagate_to_offer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.box_programming_wods w
     SET title = NEW.title,
         description = NEW.description,
         wod_type = NEW.wod_type,
         time_cap_seconds = NEW.time_cap_seconds,
         rounds = NEW.rounds,
         sort_order = NEW.sort_order,
         notes = NEW.notes,
         block_name = NEW.block_name,
         video_url = NEW.video_url,
         leaderboard_enabled = NEW.leaderboard_enabled,
         emom_interval_minutes = NEW.emom_interval_minutes,
         tabata_work_seconds = NEW.tabata_work_seconds,
         tabata_rest_seconds = NEW.tabata_rest_seconds,
         score_type = NEW.score_type,
         text_mode = NEW.text_mode,
         day_of_week = CASE
           WHEN NEW.scheduled_date IS NOT NULL THEN EXTRACT(ISODOW FROM NEW.scheduled_date)::smallint
           ELSE w.day_of_week
         END
   WHERE w.origin_box_wod_id = NEW.id;
  RETURN NEW;
END;
$function$;

-- save_week_as_template
CREATE OR REPLACE FUNCTION public.save_week_as_template(p_box_id uuid, p_source_monday date, p_title text DEFAULT NULL::text, p_template_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_template_id uuid;
  v_title       text;
  v_days        integer;
  v_wods        integer := 0;
  v_replaced    integer := 0;
  wodrow        record;
BEGIN
  IF NOT public.manages_box(p_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou coach de la box requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF EXTRACT(ISODOW FROM p_source_monday)::int <> 1 THEN
    RAISE EXCEPTION 'La semaine source doit commencer un lundi (reçu : %)', p_source_monday;
  END IF;

  SELECT count(*), count(DISTINCT scheduled_date)
    INTO v_wods, v_days
    FROM public.box_wods
   WHERE box_id = p_box_id
     AND scheduled_date >= p_source_monday
     AND scheduled_date < p_source_monday + 7;

  IF v_wods = 0 THEN
    RAISE EXCEPTION 'Aucun WOD sur la semaine du % : rien à enregistrer', p_source_monday;
  END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  v_title := COALESCE(v_title, 'Semaine type du ' || to_char(p_source_monday, 'DD/MM/YYYY'));

  IF p_template_id IS NOT NULL THEN
    -- Mise à jour d'une semaine type existante : la box doit la gérer, et ce doit
    -- bien être une semaine type (jamais une offre du catalogue).
    UPDATE public.box_programming
       SET title = v_title,
           days_per_week = v_days,
           weeks_count = 1,
           updated_at = now()
     WHERE id = p_template_id
       AND is_template
       AND public.manages_box(publisher_box_id)
    RETURNING id INTO v_template_id;

    IF v_template_id IS NULL THEN
      RAISE EXCEPTION 'Semaine type introuvable pour cette box'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    WITH removed AS (
      DELETE FROM public.box_programming_wods
       WHERE programming_id = v_template_id
      RETURNING 1
    )
    SELECT count(*) INTO v_replaced FROM removed;
  ELSE
    INSERT INTO public.box_programming (
      publisher_box_id, title, description, discipline, level,
      days_per_week, weeks_count, billing, price_cents,
      is_published, is_template, created_by
    )
    VALUES (
      p_box_id, v_title, NULL, NULL, NULL,
      v_days, 1, 'free', 0,
      false, true, auth.uid()
    )
    RETURNING id INTO v_template_id;
  END IF;

  FOR wodrow IN
    SELECT * FROM public.box_wods
     WHERE box_id = p_box_id
       AND scheduled_date >= p_source_monday
       AND scheduled_date < p_source_monday + 7
     ORDER BY scheduled_date, sort_order
  LOOP
    INSERT INTO public.box_programming_wods (
      programming_id, week_number, day_of_week, title, description, wod_type,
      time_cap_seconds, rounds, sort_order,
      notes, block_name, video_url, leaderboard_enabled,
      emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
      score_type, text_mode
    )
    VALUES (
      v_template_id, 1, EXTRACT(ISODOW FROM wodrow.scheduled_date)::smallint,
      wodrow.title, wodrow.description, wodrow.wod_type,
      wodrow.time_cap_seconds, wodrow.rounds, wodrow.sort_order,
      wodrow.notes, wodrow.block_name, wodrow.video_url, wodrow.leaderboard_enabled,
      wodrow.emom_interval_minutes, wodrow.tabata_work_seconds, wodrow.tabata_rest_seconds,
      wodrow.score_type, wodrow.text_mode
    );
  END LOOP;

  RETURN jsonb_build_object(
    'template_id', v_template_id,
    'title', v_title,
    'wods', v_wods,
    'days', v_days,
    'replaced_wods', v_replaced
  );
END;
$function$;

-- apply_program_week
CREATE OR REPLACE FUNCTION public.apply_program_week(p_source_kind text, p_source_id uuid, p_week integer, p_target_monday date, p_audience text, p_group_ids uuid[] DEFAULT NULL::uuid[], p_replace boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_src       record;
  v_groups_in uuid[] := COALESCE(p_group_ids, '{}'::uuid[]);
  v_dates     date[];
  v_conflicts integer := 0;
  v_deleted   integer := 0;
  v_kept      integer := 0;
  v_kept_rows jsonb   := '[]'::jsonb;
  v_inserted  integer := 0;
  v_skipped   integer := 0;
  v_groups    integer := 0;
  v_anchor    date;
  wodrow      record;
  v_wod_id    uuid;
  v_group_id  uuid;
BEGIN
  IF p_audience IS NULL OR p_audience NOT IN ('all', 'groups', 'none') THEN
    RAISE EXCEPTION 'Visibilité requise : all, groups ou none (reçu : %)', COALESCE(p_audience, 'NULL')
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_audience = 'groups' AND cardinality(v_groups_in) = 0 THEN
    RAISE EXCEPTION 'Visibilité « ces groupes » : au moins un groupe requis'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_audience <> 'groups' THEN
    v_groups_in := '{}'::uuid[];
  END IF;

  SELECT * INTO v_src
    FROM public.resolve_program_week_source(p_source_kind, p_source_id, p_week);

  IF EXTRACT(ISODOW FROM p_target_monday)::int <> 1 THEN
    RAISE EXCEPTION 'La semaine cible doit commencer un lundi (reçu : %)', p_target_monday;
  END IF;

  -- Les groupes doivent appartenir à la box cible : sinon on ouvrirait un WOD
  -- aux membres d'une autre box.
  IF cardinality(v_groups_in) > 0 AND EXISTS (
    SELECT 1 FROM unnest(v_groups_in) g(id)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.message_groups mg
        WHERE mg.id = g.id AND mg.box_id = v_src.box_id
     )
  ) THEN
    RAISE EXCEPTION 'Groupe hors de la box cible'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT array_agg(DISTINCT p_target_monday + (pw.day_of_week - 1))
    INTO v_dates
    FROM public.box_programming_wods pw
   WHERE pw.programming_id = v_src.programming_id
     AND pw.week_number = p_week;

  IF v_dates IS NULL THEN
    RAISE EXCEPTION 'La semaine % de cette source ne contient aucun WOD', p_week;
  END IF;

  SELECT count(*) INTO v_conflicts
    FROM public.box_wods w
   WHERE w.box_id = v_src.box_id
     AND w.scheduled_date = ANY (v_dates);

  IF v_conflicts > 0 AND NOT p_replace THEN
    RAISE EXCEPTION 'Ces jours portent déjà % WOD', v_conflicts
      USING ERRCODE = 'unique_violation';
  END IF;

  IF v_conflicts > 0 THEN
    SELECT count(*),
           COALESCE(jsonb_agg(jsonb_build_object(
             'date', w.scheduled_date, 'title', w.title
           ) ORDER BY w.scheduled_date), '[]'::jsonb)
      INTO v_kept, v_kept_rows
      FROM public.box_wods w
     WHERE w.box_id = v_src.box_id
       AND w.scheduled_date = ANY (v_dates)
       AND (EXISTS (SELECT 1 FROM public.wod_scores s WHERE s.wod_id = w.id)
            OR EXISTS (SELECT 1 FROM public.wod_completions c WHERE c.wod_id = w.id));

    WITH removed AS (
      DELETE FROM public.box_wods w
       WHERE w.box_id = v_src.box_id
         AND w.scheduled_date = ANY (v_dates)
         AND NOT EXISTS (SELECT 1 FROM public.wod_scores s WHERE s.wod_id = w.id)
         AND NOT EXISTS (SELECT 1 FROM public.wod_completions c WHERE c.wod_id = w.id)
      RETURNING 1
    )
    SELECT count(*) INTO v_deleted FROM removed;
  END IF;

  FOR wodrow IN
    SELECT * FROM public.box_programming_wods
     WHERE programming_id = v_src.programming_id
       AND week_number = p_week
     ORDER BY day_of_week, sort_order
  LOOP
    INSERT INTO public.box_wods (
      box_id, created_by, title, description, wod_type,
      scheduled_date, time_cap_seconds, rounds, is_published,
      publish_at, sort_order, source_programming_id, source_programming_wod_id,
      notes, block_name, video_url, leaderboard_enabled,
      emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
      score_type, text_mode,
      audience
    )
    VALUES (
      v_src.box_id, COALESCE(v_src.created_by, auth.uid()), wodrow.title,
      wodrow.description, wodrow.wod_type,
      p_target_monday + (wodrow.day_of_week - 1),
      wodrow.time_cap_seconds, wodrow.rounds, true,
      now(), wodrow.sort_order, v_src.programming_id, wodrow.id,
      wodrow.notes, wodrow.block_name, wodrow.video_url, wodrow.leaderboard_enabled,
      wodrow.emom_interval_minutes, wodrow.tabata_work_seconds, wodrow.tabata_rest_seconds,
      wodrow.score_type, wodrow.text_mode,
      p_audience
    )
    ON CONFLICT (box_id, scheduled_date, source_programming_wod_id)
      WHERE source_programming_wod_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_wod_id;

    IF v_wod_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_inserted := v_inserted + 1;

    FOREACH v_group_id IN ARRAY v_groups_in LOOP
      INSERT INTO public.wod_group_access (wod_id, group_id)
      VALUES (v_wod_id, v_group_id)
      ON CONFLICT (wod_id, group_id) DO NOTHING;
      v_groups := v_groups + 1;
    END LOOP;
  END LOOP;

  -- Marketplace : la pose manuelle de la semaine N sur M réaligne l'ancrage
  -- (M − 7·(N−1)) pour que l'auto enchaîne sur N+1, et mémorise la visibilité
  -- choisie pour les poses automatiques suivantes.
  IF p_source_kind = 'subscription' THEN
    v_anchor := p_target_monday - 7 * (p_week - 1);
    UPDATE public.box_programming_subscriptions
       SET week_anchor = v_anchor,
           default_audience = p_audience,
           default_group_ids = v_groups_in
     WHERE id = p_source_id;
  END IF;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'replaced', v_deleted,
    'kept_with_results', v_kept,
    'kept_details', v_kept_rows,
    'skipped', v_skipped,
    'group_links', v_groups,
    'audience', p_audience,
    'week_anchor', v_anchor,
    'box_id', v_src.box_id,
    'week', p_week,
    'target_monday', p_target_monday
  );
END;
$function$;

-- materialize_box_programming
CREATE OR REPLACE FUNCTION public.materialize_box_programming(p_target_monday date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_monday     date;
  v_reveal     timestamptz;
  v_total      integer := 0;
  v_subs       integer := 0;
  v_inserted   integer;
  v_skipped    integer;
  v_has_source boolean;
  v_groups     uuid[];
  v_audience   text;
  v_wod_id     uuid;
  v_group_id   uuid;
  sub          record;
  wodrow       record;
  v_weeknum    int;
BEGIN
  -- T2 : deux jobs pg_cron (16h et 17h UTC) couvrent CET/CEST ; seul celui qui
  -- tombe à 18h Paris agit. Un lundi explicite (tests, admin) passe la garde.
  IF p_target_monday IS NULL
     AND EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris'))::int <> 18 THEN
    RETURN 0;
  END IF;

  v_monday := COALESCE(
    p_target_monday,
    date_trunc('week', (now() AT TIME ZONE 'Europe/Paris'))::date + 7
  );
  v_reveal := ((v_monday - 1)::text || ' 18:00:00 Europe/Paris')::timestamptz;

  FOR sub IN
    SELECT s.*, p.weeks_count
    FROM public.box_programming_subscriptions s
    JOIN public.box_programming p ON p.id = s.programming_id
    WHERE s.status = 'active'
      AND s.auto_apply_weekly
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ORDER BY s.created_at
  LOOP
    v_subs := v_subs + 1;
    v_inserted := 0;
    v_skipped := 0;
    -- `%` sur un écart négatif (ancrage dans le futur) donnerait une semaine 0
    -- ou négative : on ramène dans 1..weeks_count.
    v_weeknum := (((((v_monday - sub.week_anchor) / 7) % GREATEST(sub.weeks_count, 1))
                   + GREATEST(sub.weeks_count, 1)) % GREATEST(sub.weeks_count, 1)) + 1;

    SELECT EXISTS (
      SELECT 1 FROM public.box_programming_wods
       WHERE programming_id = sub.programming_id AND week_number = v_weeknum
    ) INTO v_has_source;

    IF NOT v_has_source THEN
      INSERT INTO public.box_programming_runs
        (target_monday, subscription_id, box_id, programming_id, week_number, inserted, skipped, note)
      VALUES (v_monday, sub.id, sub.subscriber_box_id, sub.programming_id, v_weeknum, 0, 0, 'empty_week');
      CONTINUE;
    END IF;

    v_audience := sub.default_audience;
    -- Les groupes mémorisés qui existent encore dans la box abonnée ; s'il n'en
    -- reste aucun, 'groups' sans groupe n'a pas de sens → 'none'.
    SELECT COALESCE(array_agg(mg.id), '{}'::uuid[]) INTO v_groups
      FROM public.message_groups mg
     WHERE mg.id = ANY (sub.default_group_ids)
       AND mg.box_id = sub.subscriber_box_id;
    IF v_audience = 'groups' AND cardinality(v_groups) = 0 THEN
      v_audience := 'none';
    END IF;
    IF v_audience <> 'groups' THEN
      v_groups := '{}'::uuid[];
    END IF;

    FOR wodrow IN
      SELECT * FROM public.box_programming_wods
      WHERE programming_id = sub.programming_id AND week_number = v_weeknum
      ORDER BY day_of_week, sort_order
    LOOP
      INSERT INTO public.box_wods (
        box_id, created_by, title, description, wod_type,
        scheduled_date, time_cap_seconds, rounds, is_published,
        publish_at, sort_order, source_programming_id, source_programming_wod_id,
        notes, block_name, video_url, leaderboard_enabled,
        emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
        score_type, text_mode,
        audience
      )
      VALUES (
        sub.subscriber_box_id, sub.created_by, wodrow.title, wodrow.description,
        wodrow.wod_type, v_monday + (wodrow.day_of_week - 1),
        wodrow.time_cap_seconds, wodrow.rounds, true,
        v_reveal, wodrow.sort_order, sub.programming_id, wodrow.id,
        wodrow.notes, wodrow.block_name, wodrow.video_url, wodrow.leaderboard_enabled,
        wodrow.emom_interval_minutes, wodrow.tabata_work_seconds, wodrow.tabata_rest_seconds,
        wodrow.score_type, wodrow.text_mode,
        v_audience
      )
      ON CONFLICT (box_id, scheduled_date, source_programming_wod_id)
        WHERE source_programming_wod_id IS NOT NULL DO NOTHING
      RETURNING id INTO v_wod_id;

      IF v_wod_id IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
      v_inserted := v_inserted + 1;

      FOREACH v_group_id IN ARRAY v_groups LOOP
        INSERT INTO public.wod_group_access (wod_id, group_id)
        VALUES (v_wod_id, v_group_id)
        ON CONFLICT (wod_id, group_id) DO NOTHING;
      END LOOP;
    END LOOP;

    v_total := v_total + v_inserted;

    INSERT INTO public.box_programming_runs
      (target_monday, subscription_id, box_id, programming_id, week_number, inserted, skipped, note)
    VALUES (
      v_monday, sub.id, sub.subscriber_box_id, sub.programming_id, v_weeknum,
      v_inserted, v_skipped,
      CASE WHEN v_inserted > 0 THEN 'inserted' ELSE 'skipped' END
    );
  END LOOP;

  INSERT INTO public.box_programming_runs
    (target_monday, subscription_id, box_id, programming_id, week_number, inserted, skipped, note)
  VALUES (v_monday, NULL, NULL, NULL, NULL, v_total, v_subs, 'run');

  RETURN v_total;
END;
$function$;

-- ── 3. La propagation se déclenche aussi sur ces deux colonnes ─────────────
DROP TRIGGER trg_box_wods_propagate_to_offer ON public.box_wods;
CREATE TRIGGER trg_box_wods_propagate_to_offer
  AFTER UPDATE OF title, description, wod_type, time_cap_seconds, rounds, sort_order,
                  notes, block_name, video_url, leaderboard_enabled,
                  emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
                  score_type, text_mode,
                  scheduled_date
  ON public.box_wods
  FOR EACH ROW EXECUTE FUNCTION public.box_wods_propagate_to_offer();

-- ── 4. Garde d'après : définitions attendues ────────────────────────────────
DO $garde$
DECLARE
  v_0 text := md5(pg_get_functiondef('public.sync_wod_to_offer(uuid, uuid, integer)'::regprocedure));
  v_1 text := md5(pg_get_functiondef('public.copy_week_to_offer(text, uuid, date, uuid, uuid, integer, boolean)'::regprocedure));
  v_2 text := md5(pg_get_functiondef('public.box_wods_propagate_to_offer()'::regprocedure));
  v_3 text := md5(pg_get_functiondef('public.save_week_as_template(uuid, date, text, uuid)'::regprocedure));
  v_4 text := md5(pg_get_functiondef('public.apply_program_week(text, uuid, integer, date, text, uuid[], boolean)'::regprocedure));
  v_5 text := md5(pg_get_functiondef('public.materialize_box_programming(date)'::regprocedure));
  v_trg text := (SELECT md5(pg_get_triggerdef(t.oid)) FROM pg_trigger t
                 WHERE t.tgrelid = 'public.box_wods'::regclass AND t.tgname = 'trg_box_wods_propagate_to_offer');
BEGIN
  IF v_0 NOT IN ('6bc07a9b3a6aac8979098d5882337d3a') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_APRES: définition de sync_wod_to_offer inattendue (md5 %)', v_0;
  END IF;
  IF v_1 NOT IN ('5044d180c24de58a8b4ea369ffbe6c1c') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_APRES: définition de copy_week_to_offer inattendue (md5 %)', v_1;
  END IF;
  IF v_2 NOT IN ('8e97ee37f5c50a005fb0e1fe055f4e46') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_APRES: définition de box_wods_propagate_to_offer inattendue (md5 %)', v_2;
  END IF;
  IF v_3 NOT IN ('941f0a50e4ee9d4bc88a50b4248cce15') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_APRES: définition de save_week_as_template inattendue (md5 %)', v_3;
  END IF;
  IF v_4 NOT IN ('109707e9011fdf12fed622af2535cf34') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_APRES: définition de apply_program_week inattendue (md5 %)', v_4;
  END IF;
  IF v_5 NOT IN ('551cf5ab3ee4c72b804d873aee174c2c') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_APRES: définition de materialize_box_programming inattendue (md5 %)', v_5;
  END IF;
  IF v_trg IS NULL OR v_trg NOT IN ('3a2ef9d9c2b6b46ab014b711d1a95268') THEN
    RAISE EXCEPTION 'PROGRAMMING_SCORE_TYPE_APRES: déclencheur trg_box_wods_propagate_to_offer inattendu (md5 %)', v_trg;
  END IF;
END $garde$;
