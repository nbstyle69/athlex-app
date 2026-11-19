-- ═════════════════════════════════════════════════════════════════════════════
-- WOD de box : type de score choisi par le créateur, texte libre (#453, PR 1 sur 4 : base)
--
-- Appliquée en prod : OUI, le 19/11/2026 à 11:06 (heure de Paris lue par la
-- base), avec PGCLIENTENCODING=UTF8, sur feu vert de Nab. Pas de BEGIN/COMMIT
-- dans ce fichier : il se joue en UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- Dump des schémas public et internal avec droits
-- db-dumps/2026-11-19/athlex-prod-public-internal-20261119T100346Z.dump,
-- sha256 beaff5bac39a6670d44c1133499a3a87bce336126034b5c16eef7263d57c7d5f
-- vérifié après aller-retour, 141 TABLE DATA, 485 ACL, 348 POLICY. Précontrôle
-- juste avant : md5 fb726c46… / 14ac92fb… ; après : 3f1be61b… / c39b912c…,
-- garde b6799504…, droits des deux fonctions inchangés. box_wods (1564 lignes,
-- f5c8e333…) et wod_scores (119 lignes, f34ba0fb…) identiques avant et après ;
-- audit des droits 48/48 ; test réel annulé vert (time passe, done refusé).
-- Écart au catalogue accepté par Nab : demo_stg.nbs2_snapshot(uuid) (scripts
-- de démo, ménage #522) compte les lignes de wod_scores d'une box, sans lire
-- score_type ni score_value : non touchée.
--
-- Ordre du chantier : cette base → app en OTA → quelques jours → Manager. Tant
-- que le Manager n'écrit pas box_wods.score_type, toutes les colonnes ajoutées
-- ici restent NULL / 'lines' et une ancienne version de l'app ne voit aucune
-- différence : la garde ne s'arme que sur un WOD typé.
--
-- 1. box_wods.score_type (NULL | time | rounds_reps | reps | weight | none) :
--    type de score choisi par le créateur. NULL = l'athlète choisit, comme avant.
--    box_wods.text_mode (lines | free, défaut 'lines') : WOD écrit en lignes
--    structurées ou en texte libre affiché tel quel. Les WODs existants restent
--    en 'lines' (défaut constant : pas de réécriture de la table).
--    'none' (« Sans score ») ⇒ leaderboard_enabled = false (CHECK).
-- 2. wod_scores.score_type : 'rounds_reps' et 'done' s'ajoutent aux 4 valeurs
--    d'avant ; aucune ligne existante n'est modifiée.
--      rounds_reps : score_value = tours × 1000 + reps, entier ≥ 0 (CHECK) ;
--                    les reps sont score_value mod 1000, donc < 1000 par
--                    construction, et l'ordre numérique décroissant est le bon.
--      done        : séance marquée faite, score_value = 1 (CHECK), jamais
--                    classée (seulement sur un WOD « Sans score », donc sans
--                    classement : compute_wod_elo / compute_box_elo sortent
--                    avant de lire les scores).
-- 3. Garde trg_wod_scores_type_du_wod (BEFORE INSERT OR UPDATE OF score_type,
--    score_value, wod_id) : sur un WOD typé, le score doit être du même type
--    ('none' ↔ 'done'), sinon SCORE_TYPE_MISMATCH (22023). WOD sans type (ou
--    score sans WOD) : les 4 types d'avant passent comme avant ; 'rounds_reps'
--    et 'done' y sont refusés (sans quoi un 'done' entrerait dans l'ELO).
--    UPDATE limité à ces colonnes : un score déjà posé avant qu'on type le WOD
--    reste modifiable (notes, vidéo, réactions) sans être bloqué.
-- 4. Redéfinitions, chacune derrière une garde de dérive (md5 de
--    pg_get_functiondef relevé en prod) ; propriétaire et droits conservés par
--    CREATE OR REPLACE :
--    - badge_condition_met : le badge first_score ne compte pas un 'done' ;
--    - validate_strength_session : n'écrit son score de charge que sur un WOD
--      sans type ou typé 'weight' (sinon la validation entière échouerait sur
--      la garde) ; son contrôle SCORE_AUTRE_TYPE suit la même règle.
-- 5. Retour arrière : supabase/retours/20270162000000_wod_score_type.sql.
-- Contrôlée par supabase/tests/wod_score_type.sql.
-- ═════════════════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  v_bcm text := md5(pg_get_functiondef('public.badge_condition_met(uuid, text)'::regprocedure));
  v_vss text := md5(pg_get_functiondef('public.validate_strength_session(text, uuid, text, integer, boolean, jsonb, jsonb)'::regprocedure));
BEGIN
  IF v_bcm NOT IN ('fb726c4696e987f8a4223d89c18af964', '3f1be61bc58cf5a0e831ed7cc3812d23') THEN
    RAISE EXCEPTION 'WOD_SCORE_TYPE_DERIVE: définition de badge_condition_met inattendue (md5 %) : rien n''est écrit', v_bcm;
  END IF;
  IF v_vss NOT IN ('14ac92fb6ad033f4fce1ebed800d1d2b', 'c39b912c63312f07deae5ffa4fbddc94') THEN
    RAISE EXCEPTION 'WOD_SCORE_TYPE_DERIVE: définition de validate_strength_session inattendue (md5 %) : rien n''est écrit', v_vss;
  END IF;
END $garde$;

-- ── 1. box_wods ──────────────────────────────────────────────────────────────
ALTER TABLE public.box_wods
  ADD COLUMN score_type text,
  ADD COLUMN text_mode text NOT NULL DEFAULT 'lines',
  ADD CONSTRAINT box_wods_score_type_check
    CHECK (score_type IN ('time', 'rounds_reps', 'reps', 'weight', 'none')),
  ADD CONSTRAINT box_wods_text_mode_check CHECK (text_mode IN ('lines', 'free')),
  ADD CONSTRAINT box_wods_sans_score_sans_classement_check
    CHECK (score_type IS DISTINCT FROM 'none' OR leaderboard_enabled = false);
COMMENT ON COLUMN public.box_wods.score_type IS
  'Type de score choisi par le créateur (time | rounds_reps | reps | weight | none) ; NULL = l''athlète choisit. Gardé sur wod_scores par trg_wod_scores_type_du_wod (#453).';
COMMENT ON COLUMN public.box_wods.text_mode IS
  'lines = lignes structurées ; free = texte libre affiché tel quel (#453).';

-- ── 2. wod_scores ────────────────────────────────────────────────────────────
ALTER TABLE public.wod_scores
  DROP CONSTRAINT wod_scores_score_type_check,
  ADD CONSTRAINT wod_scores_score_type_check
    CHECK (score_type IN ('time', 'reps', 'weight', 'rounds', 'rounds_reps', 'done')),
  ADD CONSTRAINT wod_scores_rounds_reps_check
    CHECK (score_type IS DISTINCT FROM 'rounds_reps' OR (score_value >= 0 AND score_value = trunc(score_value))),
  ADD CONSTRAINT wod_scores_done_check
    CHECK (score_type IS DISTINCT FROM 'done' OR score_value = 1);

-- ── 3. Garde : le score suit le type choisi par le créateur ─────────────────
CREATE FUNCTION public.trg_wod_scores_type_du_wod()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- lit le type même d'un WOD que la RLS cache à l'athlète
SET search_path = ''
AS $$
DECLARE
  v_attendu text;
BEGIN
  IF NEW.wod_id IS NOT NULL THEN
    SELECT CASE w.score_type WHEN 'none' THEN 'done' ELSE w.score_type END
      INTO v_attendu FROM public.box_wods w WHERE w.id = NEW.wod_id;
  END IF;

  IF v_attendu IS NULL THEN
    -- WOD sans type : rien ne change pour les 4 types d'avant.
    IF NEW.score_type IN ('rounds_reps', 'done') THEN
      RAISE EXCEPTION 'SCORE_TYPE_MISMATCH: le WOD ne déclare pas de type, % refusé', NEW.score_type
        USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.score_type IS DISTINCT FROM v_attendu THEN
    RAISE EXCEPTION 'SCORE_TYPE_MISMATCH: type attendu %, reçu %', v_attendu, coalesce(NEW.score_type, 'NULL')
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_wod_scores_type_du_wod() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_wod_scores_type_du_wod
  BEFORE INSERT OR UPDATE OF score_type, score_value, wod_id ON public.wod_scores
  FOR EACH ROW EXECUTE FUNCTION public.trg_wod_scores_type_du_wod();

-- ── 4a. badge_condition_met : first_score ne compte pas un 'done' ────────────
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

    -- Premier score : une ligne de score existe réellement. Une séance
    -- seulement marquée faite (score_type 'done', #453) n'est pas un score.
    WHEN 'first_score' THEN
      RETURN EXISTS (SELECT 1 FROM public.tournament_scores      WHERE athlete_id = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.daily_tournament_scores WHERE user_id    = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.wod_scores              WHERE member_id  = p_athlete_id
                                                                     AND score_type IS DISTINCT FROM 'done')
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

-- ── 4b. validate_strength_session : score de charge sur un WOD sans type ou « Charge » ──
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
$function$;
