-- ═════════════════════════════════════════════════════════════════════════════
-- Crédit des cumuls de mouvement par le serveur — lot badges 4b, PR 2
--
-- Appliquée en prod : non
--
-- Décision produit : la validation d'un score de tournoi crédite les cumuls de
-- mouvement de l'athlète, au même titre qu'un WOD qu'il termine lui-même, quel
-- que soit le validateur (back-office de l'app, Manager web). Aujourd'hui le
-- back-office crédite `movement_rep_counts` en direct, le Manager ne crédite
-- rien, et le découpage d'un score n'existe qu'en TypeScript, sur du texte
-- libre. Ce lot le fait en base, sur une description STRUCTURÉE du WOD.
--
-- ── Ce que la migration pose ─────────────────────────────────────────────────
--
--   1. `movement_stats_keys` : id de `movement_catalog` → clé canonique créditée.
--   2. `tournament_wods.movement_lines` (facultative) et son contrôle d'écriture.
--   3. `movement_credit_ledger` : le registre de chaque crédit, par source.
--   4. `increment_movement_stats` écrit ses crédits au registre et borne le
--      total déclaré par l'athlète sur une fenêtre glissante de 24 h.
--   5. Le crédit automatique, dans la transaction, à la validation d'un score ;
--      son retrait quand le score quitte `validated` ; son recalcul quand le
--      score ou le WOD change — le WOD, sur EXACTEMENT les colonnes que le calcul
--      lit : `movement_lines`, `type`, `rounds`, `reps_per_round` (un test
--      échoue si le calcul se met à en lire une autre). Badges `mv_*` atteints
--      attribués au passage.
--
-- ── Deux espaces de clés, un seul pont (arbitrage de Nab, 23/09/2026) ────────
--
-- `movement_lines` nomme ses mouvements par l'id de `movement_catalog` — c'est
-- ce que manipule l'éditeur du Manager. Les cumuls et les badges comptent des
-- clés canoniques de l'app ; dix-neuf d'entre elles n'existent pas dans le
-- catalogue (`hspu`, `clean`, `kb_swing`…). Le pont est `movement_stats_keys`,
-- GÉNÉRÉ par le `normalizeMovement` du client appliqué aux noms du catalogue
-- (`scripts/generate-movement-stats-keys.mjs`), versionné dans
-- `supabase/seed/movement_stats_keys.json` et redérivé par un test jest. Une
-- seule implémentation fait foi : celle du client.
--
-- Un id connu du catalogue mais sans correspondance (musculation, accessoires)
-- est accepté dans `movement_lines` et ne crédite rien — comme le client, qui
-- ne compte pas non plus ces lignes.
--
-- ── Règles de crédit : ce que le score prouve (arbitrage de Nab) ─────────────
--
-- Jamais plus que ce que le score prouve ; en cas d'ambiguïté, rien.
--
--   For Time terminé   prescription complète × rounds (1 si non renseigné)
--   For Time au CAP    les reps du score, réparties dans l'ordre des lignes
--                      comme un AMRAP, sans dépasser la prescription ;
--                      l'ancien encodage `999999 + reps` est lu comme un CAP
--   AMRAP              tours complets, puis reste réparti dans l'ordre ;
--                      si `reps_per_round` est renseigné et diffère de la somme
--                      des lignes, on ne sait pas quel tour l'athlète comptait :
--                      rien
--   Ligne en mètres    dans un AMRAP ou un For Time au CAP, crédit seulement si
--                      `reps_per_round` est renseignée et égale à la somme des
--                      lignes (le score compte alors les mètres) ; sinon rien
--   EMOM               rien : le score n'a pas de sémantique structurée (il
--                      débloquera avec le lot Manager)
--   Tabata / Max Reps  le score, s'il porte sur un seul mouvement ; sinon rien
--   Strength, autres   rien
--   Quantité ♂/♀       selon le sexe du profil ; sans sexe, la plus basse
--   Score illisible    rien (entier attendu pour CAP, AMRAP, Tabata, Max Reps)
--
-- Les lignes en durée n'existent pas dans `movement_lines` : le contrôle
-- d'écriture n'accepte que `reps`, `m` et `cal`. C'est aussi ce que fait le
-- client, qui ne les compte pas dans les reps d'un tour.
--
-- En AMRAP et au CAP, TOUTES les lignes comptent dans la répartition — y
-- compris celles sans correspondance et celles en `cal`, que le score total
-- additionne comme des reps, comme le client — mais seules les lignes à
-- correspondance sont créditées. Une ligne en `m` n'y entre qu'avec la
-- déclaration du gérant ci-dessus.
--
-- ── Fenêtre de 24 h ──────────────────────────────────────────────────────────
--
-- Chaque crédit accepté par `increment_movement_stats` est écrit au registre,
-- source `athlete_declared`, avec un identifiant de source propre à l'appel.
-- Au-delà de trois fois le plafond par appel (6 000 reps, 150 000 m, 4 500 cal)
-- déclarés sur 24 h glissantes par athlète, mouvement et unité, l'appel est
-- refusé en 22003. Les crédits issus de tournois ne comptent pas. Le registre
-- ne contient que des quantités strictement positives : la fonction refuse
-- tout crédit négatif depuis `20270101`.
--
-- ── Ce que le lot ne fait pas ────────────────────────────────────────────────
--
-- `movement_rep_counts`, ses policies et `badges_admin_write` restent en place :
-- l'app déployée les utilise encore (lot de fermeture). Aucun rattrapage :
-- `tournament_scores` est vide en prod. Aucune ligne d'`athlete_badges` n'est
-- retirée, jamais.
--
-- Contrôlée par `supabase/tests/tournament_credits.sql`, sur le fichier de cas
-- partagé `supabase/seed/tournament_credit_cases.json`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Correspondance catalogue → clé canonique ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.movement_stats_keys (
  catalog_id text PRIMARY KEY
               REFERENCES public.movement_catalog(id) ON UPDATE CASCADE ON DELETE CASCADE,
  stats_key  text NOT NULL CHECK (stats_key ~ '^[a-z0-9_]+$')
);

COMMENT ON TABLE public.movement_stats_keys IS
  'Id de movement_catalog → clé canonique de user_movement_stats. Générée depuis le normalizeMovement du client (supabase/seed/movement_stats_keys.json). Lecture ouverte, écriture réservée aux migrations et à service_role.';

INSERT INTO public.movement_stats_keys (catalog_id, stats_key) VALUES
  ('air_squat', 'air_squat'),
  ('back_rack_split_jerk', 'press'),
  ('back_squat', 'squat'),
  ('bar_facing_burpee', 'burpee'),
  ('bar_muscle_up', 'bar_muscle_up'),
  ('bench_press', 'bench_press'),
  ('bike_erg', 'bike'),
  ('box_jump', 'box_jump'),
  ('box_jump_over', 'box_jump'),
  ('box_step_up', 'box_jump'),
  ('burpee', 'burpee'),
  ('burpee_box_jump', 'burpee_box_jump'),
  ('burpee_box_jump_over', 'burpee_box_jump'),
  ('burpee_over_the_bar', 'burpee'),
  ('chest_to_bar', 'chest_to_bar'),
  ('clean_and_jerk', 'clean_and_jerk'),
  ('clean_pull', 'clean_pull'),
  ('db_clean_and_jerk', 'db_cj'),
  ('db_lunge', 'lunge'),
  ('db_push_press', 'db_push_press'),
  ('db_shoulder_press', 'db_strict_press'),
  ('db_strict_press', 'db_strict_press'),
  ('db_thruster', 'db_thruster'),
  ('deadlift', 'deadlift'),
  ('devil_press', 'devil_press'),
  ('double_under', 'double_under'),
  ('echo_bike', 'bike'),
  ('front_squat', 'squat'),
  ('handstand_push_up', 'hspu'),
  ('hang_clean_and_jerk', 'clean_and_jerk'),
  ('hang_power_clean', 'clean'),
  ('hollow_rock', 'hollow_rock'),
  ('kb_clean_and_jerk', 'kb_cj'),
  ('kb_goblet_squat', 'goblet_squat'),
  ('kb_snatch', 'kb_snatch'),
  ('kb_swing_american', 'kb_swing'),
  ('mountain_climber', 'mountain_climber'),
  ('overhead_squat', 'overhead_squat'),
  ('pistol', 'pistol_squat'),
  ('power_clean', 'clean'),
  ('power_jerk', 'press'),
  ('power_snatch', 'snatch'),
  ('pull_up', 'pull_up'),
  ('push_jerk', 'press'),
  ('push_press', 'press'),
  ('push_up', 'push_up'),
  ('ring_dip', 'ring_dip'),
  ('ring_muscle_up', 'ring_muscle_up'),
  ('ring_row', 'ring_row'),
  ('row', 'row'),
  ('run', 'run'),
  ('shoulder_to_overhead', 'press'),
  ('single_under', 'single_under'),
  ('sit_up', 'sit_up'),
  ('ski_erg', 'ski_erg'),
  ('snatch_balance', 'snatch_balance'),
  ('snatch_high_pull', 'snatch_high_pull'),
  ('split_jerk', 'press'),
  ('squat_clean', 'clean'),
  ('squat_snatch', 'snatch'),
  ('strict_handstand_push_up', 'hspu'),
  ('strict_press', 'strict_press'),
  ('strict_pull_up', 'pull_up'),
  ('sumo_deadlift_high_pull', 'sdlhp'),
  ('tall_clean', 'clean'),
  ('thruster', 'thruster'),
  ('toes_to_bar', 'toes_to_bar'),
  ('v_ups', 'v_up'),
  ('walking_lunge', 'lunge'),
  ('wall_ball', 'wall_ball'),
  ('wall_walk', 'wall_walk'),
  ('zercher_squat', 'squat')
ON CONFLICT (catalog_id) DO UPDATE SET stats_key = EXCLUDED.stats_key;

ALTER TABLE public.movement_stats_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS movement_stats_keys_public_read ON public.movement_stats_keys;
CREATE POLICY movement_stats_keys_public_read ON public.movement_stats_keys FOR SELECT USING (true);
REVOKE ALL ON TABLE public.movement_stats_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.movement_stats_keys TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.movement_stats_keys TO service_role;

-- ── 2. `movement_lines` et son contrôle d'écriture ──────────────────────────

ALTER TABLE public.tournament_wods ADD COLUMN IF NOT EXISTS movement_lines jsonb;

COMMENT ON COLUMN public.tournament_wods.movement_lines IS
  'Description structurée du WOD, dans l''ordre : [{movement: id de movement_catalog, unit: reps|m|cal, qty_male: >0, qty_female: >0 ou absent}]. Facultative ; sans elle, un score validé ne crédite rien.';

CREATE OR REPLACE FUNCTION public.trg_tournament_wods_movement_lines_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  l   jsonb;
  i   int := 0;
  v_q text;
BEGIN
  IF NEW.movement_lines IS NULL THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW.movement_lines) <> 'array' THEN
    RAISE EXCEPTION 'movement_lines : un tableau est attendu' USING ERRCODE = '23514';
  END IF;

  FOR l IN SELECT jsonb_array_elements(NEW.movement_lines) LOOP
    i := i + 1;
    IF jsonb_typeof(l) <> 'object' THEN
      RAISE EXCEPTION 'movement_lines, ligne % : un objet est attendu', i USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.movement_catalog WHERE id = l ->> 'movement') THEN
      RAISE EXCEPTION 'movement_lines, ligne % : mouvement « % » inconnu de movement_catalog', i, l ->> 'movement'
        USING ERRCODE = '23514';
    END IF;
    IF (l ->> 'unit') IS NULL OR (l ->> 'unit') NOT IN ('reps', 'm', 'cal') THEN
      RAISE EXCEPTION 'movement_lines, ligne % : unité « % » refusée (reps, m ou cal)', i, l ->> 'unit'
        USING ERRCODE = '23514';
    END IF;
    -- Quantité ♂ obligatoire ; quantité ♀ facultative (absente = même valeur).
    -- Toutes deux entières et strictement positives : le motif sans signe
    -- écarte d'emblée le négatif et le décimal.
    v_q := l ->> 'qty_male';
    IF v_q IS NULL OR v_q !~ '^[0-9]+$' OR v_q::numeric <= 0 THEN
      RAISE EXCEPTION 'movement_lines, ligne % : quantité ♂ « % » refusée (entier strictement positif)',
        i, COALESCE(v_q, 'absente') USING ERRCODE = '23514';
    END IF;
    v_q := l ->> 'qty_female';
    IF v_q IS NOT NULL AND (v_q !~ '^[0-9]+$' OR v_q::numeric <= 0) THEN
      RAISE EXCEPTION 'movement_lines, ligne % : quantité ♀ « % » refusée (entier strictement positif)',
        i, v_q USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_wods_movement_lines_check ON public.tournament_wods;
CREATE TRIGGER trg_tournament_wods_movement_lines_check
  BEFORE INSERT OR UPDATE OF movement_lines ON public.tournament_wods
  FOR EACH ROW EXECUTE FUNCTION public.trg_tournament_wods_movement_lines_check();

-- ── 3. Le registre des crédits ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.movement_credit_ledger (
  id          bigserial PRIMARY KEY,
  source_type text   NOT NULL CHECK (source_type IN ('tournament_score', 'athlete_declared')),
  -- L'id du score de tournoi, ou un identifiant propre à l'appel déclaratif.
  -- Pas de clé étrangère : la source est polymorphe, et un score supprimé
  -- emporte son crédit par son propre trigger.
  source_id   uuid   NOT NULL,
  athlete_id  uuid   NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  movement    text   NOT NULL,
  unit        text   NOT NULL CHECK (unit IN ('reps', 'm', 'cal')),
  quantity    bigint NOT NULL CHECK (quantity > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, movement, unit)
);

-- La fenêtre de 24 h interroge (athlète, mouvement, unité, date) à chaque appel.
CREATE INDEX IF NOT EXISTS movement_credit_ledger_fenetre
  ON public.movement_credit_ledger (athlete_id, movement, unit, created_at)
  WHERE source_type = 'athlete_declared';

COMMENT ON TABLE public.movement_credit_ledger IS
  'Chaque crédit de user_movement_stats, par source (score de tournoi, déclaration de l''athlète). Lu par l''athlète pour lui-même et par le staff de sa box ; écrit par les seules fonctions du serveur.';

ALTER TABLE public.movement_credit_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS movement_credit_ledger_lecture ON public.movement_credit_ledger;
CREATE POLICY movement_credit_ledger_lecture ON public.movement_credit_ledger FOR SELECT
  USING (athlete_id = auth.uid() OR public.is_box_admin_of_athlete(athlete_id));
REVOKE ALL ON TABLE public.movement_credit_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.movement_credit_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.movement_credit_ledger TO service_role;
REVOKE ALL ON SEQUENCE public.movement_credit_ledger_id_seq FROM PUBLIC, anon, authenticated;

-- ── 4. `increment_movement_stats` : registre et fenêtre de 24 h ─────────────
-- Corps de `20270101` ; ajoutés : le verrou, la fenêtre, l'écriture au registre.

CREATE OR REPLACE FUNCTION public.increment_movement_stats(
  p_user_id  uuid,
  p_movement text,
  p_reps     integer,
  p_weight   numeric,
  p_unit     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_target  uuid;
  v_unit    text := COALESCE(p_unit, 'reps');
  v_cap     bigint;
  v_fenetre bigint;
BEGIN
  v_target := CASE WHEN auth.role() = 'service_role'
                     THEN COALESCE(p_user_id, auth.uid())
                   ELSE auth.uid() END;
  IF v_target IS NULL THEN RETURN; END IF;
  IF v_unit NOT IN ('reps', 'm', 'cal') THEN
    RAISE EXCEPTION 'increment_movement_stats: unité inconnue %', v_unit;
  END IF;

  IF p_reps IS NULL OR p_reps = 0 THEN
    RETURN;
  END IF;

  IF p_reps < 0 THEN
    RAISE EXCEPTION 'increment_movement_stats : quantité négative refusée — % % de %',
      p_reps, v_unit, p_movement
      USING ERRCODE = '22003';
  END IF;

  IF p_weight < 0 THEN
    RAISE EXCEPTION 'increment_movement_stats : charge négative refusée — % kg sur %',
      p_weight, p_movement
      USING ERRCODE = '22003';
  END IF;

  SELECT per_call INTO v_cap
    FROM public.movement_credit_caps
   WHERE unit = v_unit AND (movement = p_movement OR movement IS NULL)
   ORDER BY movement IS NULL
   LIMIT 1;

  IF v_cap IS NULL THEN
    RAISE EXCEPTION 'increment_movement_stats : aucun plafond configuré pour l''unité % — crédit refusé', v_unit
      USING ERRCODE = '22003';
  END IF;

  IF p_reps > v_cap THEN
    RAISE EXCEPTION 'increment_movement_stats : % % de % dépassent le plafond par appel (% %)',
      p_reps, v_unit, p_movement, v_cap, v_unit
      USING ERRCODE = '22003',
            HINT = 'Un seul appel ne peut pas créditer plus que ce plafond ; il vaut pour chaque ligne d''un WOD.';
  END IF;

  -- Deux appels simultanés liraient la même fenêtre et passeraient tous deux :
  -- on les sérialise par (athlète, mouvement, unité), le temps de la transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_target::text || '|' || p_movement || '|' || v_unit, 0));

  SELECT COALESCE(sum(quantity), 0) INTO v_fenetre
    FROM public.movement_credit_ledger
   WHERE athlete_id = v_target AND movement = p_movement AND unit = v_unit
     AND source_type = 'athlete_declared'
     AND created_at > now() - interval '24 hours';

  IF v_fenetre + p_reps > 3 * v_cap THEN
    RAISE EXCEPTION 'increment_movement_stats : fenêtre de 24 h dépassée — % % de % déjà déclarés, % de plus, plafond % %',
      v_fenetre, v_unit, p_movement, p_reps, 3 * v_cap, v_unit
      USING ERRCODE = '22003',
            HINT = 'Les crédits déclarés sur 24 h glissantes sont bornés à trois fois le plafond par appel ; les crédits de tournoi n''y comptent pas.';
  END IF;

  INSERT INTO public.movement_credit_ledger (source_type, source_id, athlete_id, movement, unit, quantity)
  VALUES ('athlete_declared', gen_random_uuid(), v_target, p_movement, v_unit, p_reps);

  INSERT INTO public.user_movement_stats (user_id, movement, unit, total_reps, best_weight, updated_at)
  VALUES (v_target, p_movement, v_unit, p_reps, p_weight, now())
  ON CONFLICT (user_id, movement, unit) DO UPDATE SET
    total_reps  = user_movement_stats.total_reps + p_reps,
    best_weight = GREATEST(user_movement_stats.best_weight, p_weight),
    updated_at  = now();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric, text) TO service_role;

-- ── 5. Le calcul : ce que le score prouve ───────────────────────────────────
-- Fonction pure au sens métier : elle lit le score, le WOD, le sexe du profil
-- et la correspondance, et rend les crédits dus. Rien si le score n'est pas
-- validé. Schéma `internal` : aucun rôle client ne l'appelle.

CREATE OR REPLACE FUNCTION internal.tournament_score_credits(p_score_id uuid)
RETURNS TABLE (movement text, unit text, quantity bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  s          record;
  w          record;
  v_gender   text;
  v_type     text;
  v_num      bigint;
  v_rounds   bigint;
  v_par_tour bigint;
  v_reps     bigint;
  v_complets bigint;
  v_reste    bigint;
  v_n        int;
  v_keys     text[];
  v_units    text[];
  v_qtys     bigint[];
  v_credits  bigint[];
  i          int;
BEGIN
  SELECT ts.status, ts.score_value, ts.capped, ts.athlete_id, ts.tournament_wod_id
    INTO s FROM public.tournament_scores ts WHERE ts.id = p_score_id;
  IF NOT FOUND OR s.status IS DISTINCT FROM 'validated' THEN
    RETURN;
  END IF;

  SELECT tw.type, tw.rounds, tw.reps_per_round, tw.movement_lines
    INTO w FROM public.tournament_wods tw WHERE tw.id = s.tournament_wod_id;
  IF NOT FOUND OR w.movement_lines IS NULL OR jsonb_array_length(w.movement_lines) = 0 THEN
    RETURN;
  END IF;

  SELECT p.gender INTO v_gender FROM public.profiles p WHERE p.id = s.athlete_id;

  -- Les lignes, dans l'ordre, avec la quantité selon le sexe : ♀ si renseignée
  -- pour une athlète, ♂ pour un athlète, la plus basse sans sexe connu.
  SELECT array_agg(k.stats_key ORDER BY x.n),
         array_agg(x.l ->> 'unit' ORDER BY x.n),
         array_agg(CASE v_gender
                     WHEN 'female' THEN COALESCE((x.l ->> 'qty_female')::bigint, (x.l ->> 'qty_male')::bigint)
                     WHEN 'male'   THEN (x.l ->> 'qty_male')::bigint
                     ELSE LEAST((x.l ->> 'qty_male')::bigint,
                                COALESCE((x.l ->> 'qty_female')::bigint, (x.l ->> 'qty_male')::bigint))
                   END ORDER BY x.n)
    INTO v_keys, v_units, v_qtys
    FROM jsonb_array_elements(w.movement_lines) WITH ORDINALITY AS x(l, n)
    LEFT JOIN public.movement_stats_keys k ON k.catalog_id = x.l ->> 'movement';

  v_n        := array_length(v_qtys, 1);
  v_par_tour := (SELECT sum(q) FROM unnest(v_qtys) q);
  v_type     := lower(btrim(COALESCE(w.type, '')));
  v_rounds   := COALESCE(NULLIF(w.rounds, 0), 1);
  -- Un score entier, et seulement entier : « 12:30 », « 5+12 » ou « 150.5 »
  -- ne prouvent pas un nombre de reps.
  v_num      := CASE WHEN btrim(COALESCE(s.score_value, '')) ~ '^[0-9]+(\.0+)?$'
                     THEN floor(btrim(s.score_value)::numeric)::bigint END;
  v_credits  := array_fill(0::bigint, ARRAY[v_n]);

  IF v_type IN ('for time', 'for-time') THEN
    IF COALESCE(s.capped, false) OR v_num >= 999999 THEN
      -- Au CAP : les reps réalisées, jamais plus que la prescription.
      v_reps := CASE WHEN v_num >= 999999 THEN v_num - 999999 ELSE v_num END;
      IF v_reps IS NULL THEN RETURN; END IF;
      v_reps := LEAST(v_reps, v_par_tour * v_rounds);
    ELSE
      -- Terminé : la prescription complète, tour par tour.
      FOR i IN 1 .. v_n LOOP
        v_credits[i] := v_qtys[i] * v_rounds;
      END LOOP;
      v_reps := NULL;
    END IF;

  ELSIF v_type = 'amrap' THEN
    IF v_num IS NULL THEN RETURN; END IF;
    -- Un `reps_per_round` différent de la somme des lignes : on ne sait pas
    -- quel tour l'athlète comptait. Ambiguïté → rien.
    IF w.reps_per_round IS NOT NULL AND w.reps_per_round <> v_par_tour THEN RETURN; END IF;
    v_reps := v_num;

  ELSIF v_type IN ('tabata', 'max reps') THEN
    IF v_n <> 1 OR v_num IS NULL OR v_num <= 0 THEN RETURN; END IF;
    v_credits[1] := v_num;
    v_reps := NULL;

  ELSE
    -- EMOM (score sans sémantique structurée), Strength, formats inconnus.
    RETURN;
  END IF;

  -- Répartition dans l'ordre des lignes : tours complets, puis le reste.
  IF v_reps IS NOT NULL THEN
    -- Une ligne en mètres rend le tour hétérogène : sur « 200 m de course +
    -- 10 burpees », un tour vaut 210 et un score saisi en reps se répartirait
    -- arbitrairement. On ne crédite que si le gérant a déclaré que le score
    -- compte les mètres : `reps_per_round` renseignée ET égale à la somme des
    -- lignes. Les calories, elles, restent comptées comme des reps (arbitrage
    -- de Nab, 23/09/2026).
    IF 'm' = ANY (v_units)
       AND (w.reps_per_round IS NULL OR w.reps_per_round <> v_par_tour) THEN
      RETURN;
    END IF;
    IF v_par_tour IS NULL OR v_par_tour <= 0 THEN RETURN; END IF;
    v_complets := v_reps / v_par_tour;
    v_reste    := v_reps % v_par_tour;
    FOR i IN 1 .. v_n LOOP
      v_credits[i] := v_qtys[i] * v_complets + LEAST(v_reste, v_qtys[i]);
      v_reste      := GREATEST(0, v_reste - v_qtys[i]);
    END LOOP;
  END IF;

  -- Seules les lignes à correspondance sont créditées ; deux lignes du même
  -- mouvement dans la même unité s'additionnent.
  RETURN QUERY
    SELECT c.k, c.u, sum(c.q)::bigint
      FROM unnest(v_keys, v_units, v_credits) AS c(k, u, q)
     WHERE c.k IS NOT NULL AND c.q > 0
     GROUP BY c.k, c.u;
END;
$$;

-- ── 6. L'application : registre, cumuls, badges ─────────────────────────────
-- Met le registre et `user_movement_stats` en accord avec ce que le score
-- prouve AUJOURD'HUI, par différence avec ce qui a déjà été crédité. D'où,
-- sans cas particulier : une double validation ne crédite rien, un score qui
-- quitte `validated` retire son crédit, une correction ne crédite que le
-- nouveau montant, et une modification du WOD se recalcule.

CREATE OR REPLACE FUNCTION internal.sync_tournament_score_credits(p_score_id uuid, p_athlete_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  d        record;
  v_valide boolean;
BEGIN
  IF p_athlete_id IS NULL THEN RETURN; END IF;

  FOR d IN
    WITH cible AS (
      SELECT movement, unit, quantity FROM internal.tournament_score_credits(p_score_id)
    ), actuel AS (
      SELECT movement, unit, quantity FROM public.movement_credit_ledger
       WHERE source_type = 'tournament_score' AND source_id = p_score_id
    )
    SELECT COALESCE(c.movement, a.movement) AS movement,
           COALESCE(c.unit, a.unit)         AS unit,
           COALESCE(c.quantity, 0)          AS cible,
           COALESCE(a.quantity, 0)          AS actuel
      FROM cible c FULL JOIN actuel a ON a.movement = c.movement AND a.unit = c.unit
  LOOP
    CONTINUE WHEN d.cible = d.actuel;

    IF d.cible - d.actuel > 0 THEN
      INSERT INTO public.user_movement_stats (user_id, movement, unit, total_reps, updated_at)
      VALUES (p_athlete_id, d.movement, d.unit, d.cible - d.actuel, now())
      ON CONFLICT (user_id, movement, unit) DO UPDATE SET
        total_reps = user_movement_stats.total_reps + EXCLUDED.total_reps,
        updated_at = now();
    ELSE
      UPDATE public.user_movement_stats
         SET total_reps = total_reps + (d.cible - d.actuel), updated_at = now()
       WHERE user_id = p_athlete_id AND movement = d.movement AND unit = d.unit;
    END IF;

    IF d.cible = 0 THEN
      DELETE FROM public.movement_credit_ledger
       WHERE source_type = 'tournament_score' AND source_id = p_score_id
         AND movement = d.movement AND unit = d.unit;
    ELSE
      INSERT INTO public.movement_credit_ledger (source_type, source_id, athlete_id, movement, unit, quantity)
      VALUES ('tournament_score', p_score_id, p_athlete_id, d.movement, d.unit, d.cible)
      ON CONFLICT (source_type, source_id, movement, unit)
        DO UPDATE SET quantity = EXCLUDED.quantity, created_at = now();
    END IF;
  END LOOP;

  -- Badges : seulement pour un score validé, sans doublon, jamais retirés.
  SELECT status = 'validated' INTO v_valide FROM public.tournament_scores WHERE id = p_score_id;
  IF v_valide THEN
    INSERT INTO public.athlete_badges (athlete_id, badge_key)
    SELECT p_athlete_id, r.badge_key
      FROM public.badge_rules r
     WHERE public.badge_condition_met(p_athlete_id, r.badge_key)
    ON CONFLICT (athlete_id, badge_key) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION internal.tournament_score_credits(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.sync_tournament_score_credits(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── 7. Les déclencheurs ─────────────────────────────────────────────────────
-- Fonctions de trigger dans `public`, en SECURITY DEFINER, sur le modèle de
-- `trg_recalc_division_points` (20261230) : c'est le propriétaire qui atteint
-- le schéma `internal`, pas le validateur.

CREATE OR REPLACE FUNCTION public.trg_tournament_scores_credits()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM internal.sync_tournament_score_credits(OLD.id, OLD.athlete_id);
    RETURN OLD;
  END IF;
  -- Une mise à jour qui ne touche ni le statut ni le score ne change rien au
  -- crédit : on s'épargne le calcul (et 187 vérifications de badges).
  IF TG_OP = 'UPDATE'
     AND NEW.status      IS NOT DISTINCT FROM OLD.status
     AND NEW.score_value IS NOT DISTINCT FROM OLD.score_value
     AND NEW.capped      IS NOT DISTINCT FROM OLD.capped THEN
    RETURN NEW;
  END IF;
  PERFORM internal.sync_tournament_score_credits(NEW.id, NEW.athlete_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_scores_credits ON public.tournament_scores;
CREATE TRIGGER trg_tournament_scores_credits
  AFTER INSERT OR UPDATE OR DELETE ON public.tournament_scores
  FOR EACH ROW EXECUTE FUNCTION public.trg_tournament_scores_credits();

CREATE OR REPLACE FUNCTION public.trg_tournament_wods_credits()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  sc record;
BEGIN
  IF NEW.movement_lines   IS NOT DISTINCT FROM OLD.movement_lines
     AND NEW.type             IS NOT DISTINCT FROM OLD.type
     AND NEW.rounds           IS NOT DISTINCT FROM OLD.rounds
     AND NEW.reps_per_round   IS NOT DISTINCT FROM OLD.reps_per_round THEN
    RETURN NEW;
  END IF;
  -- Tous les scores du WOD : les validés sont recalculés, les autres n'ont ni
  -- cible ni crédit, l'appel ne fait rien.
  FOR sc IN SELECT id, athlete_id FROM public.tournament_scores WHERE tournament_wod_id = NEW.id LOOP
    PERFORM internal.sync_tournament_score_credits(sc.id, sc.athlete_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_wods_credits ON public.tournament_wods;
CREATE TRIGGER trg_tournament_wods_credits
  AFTER UPDATE OF movement_lines, type, rounds, reps_per_round ON public.tournament_wods
  FOR EACH ROW EXECUTE FUNCTION public.trg_tournament_wods_credits();

-- Les fonctions de trigger ne s'appellent pas en RPC, mais on ne laisse pas
-- traîner d'EXECUTE hérité.
REVOKE ALL ON FUNCTION public.trg_tournament_wods_movement_lines_check() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_tournament_scores_credits()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_tournament_wods_credits()             FROM PUBLIC, anon, authenticated;

COMMIT;
