-- ═════════════════════════════════════════════════════════════════════════════
-- Crédit des cumuls par le serveur à la validation d'un score de tournoi
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
--
--   P    les cas partagés de `tournament_credit_cases.json`, joués par le VRAI
--        chemin : WOD structuré, score en attente, passage à `validated`. Le
--        registre et les cumuls doivent valoir exactement les crédits attendus ;
--        puis le score est supprimé et tout doit disparaître.
--   I1…  le cycle de vie : double validation, rejet, correction, validation par
--        le staff d'une autre box, registre fermé aux clients, fenêtre de 24 h,
--        contrôle d'écriture des WOD, recalcul après modification du WOD.
--
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Credit des scores de tournoi par le serveur'

BEGIN;

\i supabase/seed/tournament_credit_cases.sql

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Deux box et leurs gérants ; trois athlètes de la box A (homme, femme, sexe
-- inconnu) et un athlète de la box B.
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a400-000000000001'), ('00000000-0000-4000-a400-000000000002'),
  ('00000000-0000-4000-a400-000000000011'), ('00000000-0000-4000-a400-000000000012'),
  ('00000000-0000-4000-a400-000000000013'), ('00000000-0000-4000-a400-000000000014');

INSERT INTO public.profiles (id, email, username, gender) VALUES
  ('00000000-0000-4000-a400-000000000001', 'credit-staff-a@test.invalid', 'credit_staff_a', NULL),
  ('00000000-0000-4000-a400-000000000002', 'credit-staff-b@test.invalid', 'credit_staff_b', NULL),
  ('00000000-0000-4000-a400-000000000011', 'credit-m@test.invalid',       'credit_m',       'male'),
  ('00000000-0000-4000-a400-000000000012', 'credit-f@test.invalid',       'credit_f',       'female'),
  ('00000000-0000-4000-a400-000000000013', 'credit-n@test.invalid',       'credit_n',       NULL),
  ('00000000-0000-4000-a400-000000000014', 'credit-x@test.invalid',       'credit_x',       'male');

INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b400-00000000000a', 'Box crédits A', 'CRDA', '00000000-0000-4000-a400-000000000001'),
  ('00000000-0000-4000-b400-00000000000b', 'Box crédits B', 'CRDB', '00000000-0000-4000-a400-000000000002');

INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b400-00000000000a', '00000000-0000-4000-a400-000000000011', 'member', 'active'),
  ('00000000-0000-4000-b400-00000000000a', '00000000-0000-4000-a400-000000000012', 'member', 'active'),
  ('00000000-0000-4000-b400-00000000000a', '00000000-0000-4000-a400-000000000013', 'member', 'active'),
  ('00000000-0000-4000-b400-00000000000b', '00000000-0000-4000-a400-000000000014', 'member', 'active');

INSERT INTO public.tournaments (id, box_id, name, level, format, status) VALUES
  ('00000000-0000-4000-c400-000000000001', '00000000-0000-4000-b400-00000000000a',
   'Tournoi crédits', 'rx', 'simple', 'active');

-- ── Outils ──────────────────────────────────────────────────────────────────

CREATE FUNCTION pg_temp.wod(p_type text, p_rounds int, p_rpr int, p_lines jsonb)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.tournament_wods (id, tournament_id, title, type, status, rounds, reps_per_round, movement_lines)
  VALUES (v, '00000000-0000-4000-c400-000000000001', 'WOD crédits', p_type, 'active', p_rounds, p_rpr, p_lines);
  RETURN v;
END $$;

CREATE FUNCTION pg_temp.score(p_wod uuid, p_ath uuid, p_val text, p_capped boolean)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.tournament_scores (id, tournament_id, tournament_wod_id, athlete_id, score_value, capped, status)
  VALUES (v, '00000000-0000-4000-c400-000000000001', p_wod, p_ath, p_val, p_capped, 'pending');
  RETURN v;
END $$;

-- Les crédits d'un score au registre, en texte trié : « mouvement|unité|qté,… ».
CREATE FUNCTION pg_temp.credits(p_score uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(movement || '|' || unit || '|' || quantity, ',' ORDER BY movement, unit), '')
    FROM public.movement_credit_ledger
   WHERE source_type = 'tournament_score' AND source_id = p_score;
$$;

-- Les cumuls non nuls d'un athlète, même forme.
CREATE FUNCTION pg_temp.cumuls(p_ath uuid)
RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(movement || '|' || unit || '|' || total_reps, ',' ORDER BY movement, unit), '')
    FROM public.user_movement_stats WHERE user_id = p_ath AND total_reps <> 0;
$$;

CREATE FUNCTION pg_temp.remise_a_zero(p_ath uuid)
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.movement_credit_ledger WHERE athlete_id = p_ath;
  DELETE FROM public.user_movement_stats   WHERE user_id   = p_ath;
$$;

-- Endosser un rôle client avec son JWT. Le retour se fait par
-- `set_config('role', 'none', true)` suivi de `pg_temp.sortir()`.
CREATE FUNCTION pg_temp.endosser(p_user uuid, p_role text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',  COALESCE(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config('role', p_role, true);
END $$;

CREATE FUNCTION pg_temp.sortir()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',  '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;

-- ── P · les cas partagés, par le vrai chemin ───────────────────────────────
DO $$
DECLARE
  c       jsonb;
  v_ath   uuid;
  v_wod   uuid;
  v_score uuid;
  v_att   text;
  v_obt   text;
  n       int := 0;
BEGIN
  FOR c IN SELECT jsonb_array_elements(donnees -> 'cas') FROM cas_credits LOOP
    n := n + 1;
    v_ath := CASE c ->> 'genre'
               WHEN 'male'   THEN '00000000-0000-4000-a400-000000000011'::uuid
               WHEN 'female' THEN '00000000-0000-4000-a400-000000000012'::uuid
               ELSE               '00000000-0000-4000-a400-000000000013'::uuid END;
    PERFORM pg_temp.remise_a_zero(v_ath);

    v_wod := pg_temp.wod(c -> 'wod' ->> 'type', (c -> 'wod' ->> 'rounds')::int,
                         (c -> 'wod' ->> 'reps_per_round')::int, c -> 'wod' -> 'movement_lines');
    v_score := pg_temp.score(v_wod, v_ath, c -> 'score' ->> 'score_value', (c -> 'score' ->> 'capped')::boolean);

    IF pg_temp.credits(v_score) <> '' THEN
      RAISE EXCEPTION 'P/% (%) : un score EN ATTENTE a été crédité — %', n, c ->> 'nom', pg_temp.credits(v_score);
    END IF;

    UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;

    SELECT COALESCE(string_agg((x ->> 'movement') || '|' || (x ->> 'unit') || '|' || (x ->> 'quantite'),
                               ',' ORDER BY x ->> 'movement', x ->> 'unit'), '')
      INTO v_att FROM jsonb_array_elements(c -> 'attendus') x;
    v_obt := pg_temp.credits(v_score);

    IF v_obt IS DISTINCT FROM v_att THEN
      RAISE EXCEPTION 'P/% (%) : registre « % », attendu « % »', n, c ->> 'nom', v_obt, v_att;
    END IF;
    -- Les cumuls disent la même chose que le registre : aucun crédit ailleurs.
    IF pg_temp.cumuls(v_ath) IS DISTINCT FROM v_att THEN
      RAISE EXCEPTION 'P/% (%) : cumuls « % », attendu « % »', n, c ->> 'nom', pg_temp.cumuls(v_ath), v_att;
    END IF;

    -- Supprimer le score retire son crédit, du registre comme des cumuls.
    DELETE FROM public.tournament_scores WHERE id = v_score;
    IF pg_temp.credits(v_score) <> '' OR pg_temp.cumuls(v_ath) <> '' THEN
      RAISE EXCEPTION 'P/% (%) : la suppression du score n''a pas retiré son crédit — registre « % », cumuls « % »',
        n, c ->> 'nom', pg_temp.credits(v_score), pg_temp.cumuls(v_ath);
    END IF;
  END LOOP;

  IF n < 20 THEN
    RAISE EXCEPTION 'P : % cas seulement — le fichier de cas n''a pas été chargé', n;
  END IF;
  RAISE NOTICE 'cas partagés : % joués par le chemin de validation', n;
END $$;

-- ── I1 · validation : crédit et badge au seuil ─────────────────────────────
-- ── I2 · double validation : rien de plus ──────────────────────────────────
-- ── I3 · rejet après validation : crédit retiré, badge conservé ────────────
DO $$
DECLARE
  v_ath   uuid := '00000000-0000-4000-a400-000000000011';
  v_wod   uuid;
  v_score uuid;
  v_avant text;
  v_badges int;
BEGIN
  PERFORM pg_temp.remise_a_zero(v_ath);
  DELETE FROM public.athlete_badges WHERE athlete_id = v_ath;

  v_wod := pg_temp.wod('For Time', NULL, NULL, '[{"movement":"pull_up","unit":"reps","qty_male":100}]');
  v_score := pg_temp.score(v_wod, v_ath, '600', false);
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;

  IF pg_temp.cumuls(v_ath) <> 'pull_up|reps|100' THEN
    RAISE EXCEPTION 'I1 : cumul après validation « % », attendu pull_up 100', pg_temp.cumuls(v_ath);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.athlete_badges WHERE athlete_id = v_ath AND badge_key = 'mv_pullup_100') THEN
    RAISE EXCEPTION 'I1 : mv_pullup_100 non attribué au seuil';
  END IF;
  IF EXISTS (SELECT 1 FROM public.athlete_badges WHERE athlete_id = v_ath AND badge_key = 'mv_pullup_500') THEN
    RAISE EXCEPTION 'I1 : mv_pullup_500 attribué sous le seuil';
  END IF;

  -- I2 : re-valider, puis toucher une autre colonne — rien ne bouge.
  v_avant  := pg_temp.credits(v_score) || '/' || pg_temp.cumuls(v_ath);
  SELECT count(*) INTO v_badges FROM public.athlete_badges WHERE athlete_id = v_ath;
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;
  UPDATE public.tournament_scores SET notes = 'relu' WHERE id = v_score;
  IF pg_temp.credits(v_score) || '/' || pg_temp.cumuls(v_ath) <> v_avant THEN
    RAISE EXCEPTION 'I2 : une double validation a changé le crédit — % → %',
      v_avant, pg_temp.credits(v_score) || '/' || pg_temp.cumuls(v_ath);
  END IF;
  IF (SELECT count(*) FROM public.athlete_badges WHERE athlete_id = v_ath) <> v_badges THEN
    RAISE EXCEPTION 'I2 : une double validation a posé un badge de plus';
  END IF;
  IF (SELECT count(*) FROM public.movement_credit_ledger WHERE source_id = v_score) <> 1 THEN
    RAISE EXCEPTION 'I2 : le registre porte plus d''une ligne pour ce score';
  END IF;

  -- I3 : rejet — le crédit s'en va, le badge reste.
  UPDATE public.tournament_scores SET status = 'rejected' WHERE id = v_score;
  IF pg_temp.credits(v_score) <> '' OR pg_temp.cumuls(v_ath) <> '' THEN
    RAISE EXCEPTION 'I3 : crédit non retiré au rejet — registre « % », cumuls « % »',
      pg_temp.credits(v_score), pg_temp.cumuls(v_ath);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.athlete_badges WHERE athlete_id = v_ath AND badge_key = 'mv_pullup_100') THEN
    RAISE EXCEPTION 'I3 : le badge obtenu a été retiré au rejet';
  END IF;
END $$;

-- ── I4 · correction d'un score validé : le nouveau montant seul ────────────
DO $$
DECLARE
  v_ath   uuid := '00000000-0000-4000-a400-000000000011';
  v_wod   uuid;
  v_score uuid;
BEGIN
  PERFORM pg_temp.remise_a_zero(v_ath);
  v_wod := pg_temp.wod('AMRAP', NULL, NULL,
    '[{"movement":"pull_up","unit":"reps","qty_male":5},{"movement":"push_up","unit":"reps","qty_male":10}]');
  v_score := pg_temp.score(v_wod, v_ath, '30', false);
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;
  IF pg_temp.cumuls(v_ath) <> 'pull_up|reps|10,push_up|reps|20' THEN
    RAISE EXCEPTION 'I4 : crédit initial « % »', pg_temp.cumuls(v_ath);
  END IF;

  UPDATE public.tournament_scores SET score_value = '45' WHERE id = v_score;
  IF pg_temp.cumuls(v_ath) <> 'pull_up|reps|15,push_up|reps|30'
     OR pg_temp.credits(v_score) <> 'pull_up|reps|15,push_up|reps|30' THEN
    RAISE EXCEPTION 'I4 : après correction, cumuls « % », registre « % » — attendu le nouveau montant seul (15 / 30)',
      pg_temp.cumuls(v_ath), pg_temp.credits(v_score);
  END IF;
END $$;

-- ── I5 · le staff d'une autre box ne valide pas ────────────────────────────
DO $$
DECLARE
  v_ath   uuid := '00000000-0000-4000-a400-000000000011';
  v_wod   uuid;
  v_score uuid;
  v_n     int;
BEGIN
  PERFORM pg_temp.remise_a_zero(v_ath);
  v_wod := pg_temp.wod('For Time', NULL, NULL, '[{"movement":"push_up","unit":"reps","qty_male":40}]');
  v_score := pg_temp.score(v_wod, v_ath, '300', false);

  PERFORM pg_temp.endosser('00000000-0000-4000-a400-000000000002', 'authenticated');
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  PERFORM pg_temp.sortir();
  IF v_n <> 0 OR pg_temp.credits(v_score) <> '' THEN
    RAISE EXCEPTION 'I5a : le staff de la box B a validé un score de la box A (% ligne, registre « % »)',
      v_n, pg_temp.credits(v_score);
  END IF;

  -- Contre-exemple : le staff de la box A valide, sous son JWT — le crédit
  -- passe par les fonctions SECURITY DEFINER, sans droit client sur `internal`.
  PERFORM pg_temp.endosser('00000000-0000-4000-a400-000000000001', 'authenticated');
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  PERFORM pg_temp.sortir();
  IF v_n <> 1 OR pg_temp.credits(v_score) <> 'push_up|reps|40' THEN
    RAISE EXCEPTION 'I5b : le staff de la box A n''a pas crédité en validant (% ligne, registre « % »)',
      v_n, pg_temp.credits(v_score);
  END IF;
END $$;

-- ── I6 · le registre : lu par qui il faut, écrit par personne côté client ──
DO $$
DECLARE
  v_role  text;
  v_geste text;
  v_err   text;
  v_lu    int;
BEGIN
  -- Écriture : refusée par le GRANT, pour l'athlète comme pour le staff.
  FOREACH v_role IN ARRAY ARRAY['00000000-0000-4000-a400-000000000011', '00000000-0000-4000-a400-000000000001'] LOOP
    FOREACH v_geste IN ARRAY ARRAY[
      format($i$INSERT INTO public.movement_credit_ledger (source_type, source_id, athlete_id, movement, unit, quantity)
                VALUES ('athlete_declared', gen_random_uuid(), %L, 'pull_up', 'reps', 5000)$i$, v_role),
      $u$UPDATE public.movement_credit_ledger SET quantity = 999999$u$,
      $d$DELETE FROM public.movement_credit_ledger$d$
    ] LOOP
      PERFORM pg_temp.endosser(v_role::uuid, 'authenticated');
      v_err := NULL;
      BEGIN EXECUTE v_geste; EXCEPTION WHEN others THEN v_err := SQLERRM; END;
      PERFORM set_config('role', 'none', true);
      PERFORM pg_temp.sortir();
      IF v_err IS NULL OR v_err NOT LIKE '%permission denied for table%' THEN
        RAISE EXCEPTION 'I6a : % a pu écrire au registre, ou en est empêché autrement que par le GRANT — % — %',
          v_role, v_err, left(v_geste, 50);
      END IF;
    END LOOP;
  END LOOP;

  -- Lecture : l'athlète voit les siennes, le staff de sa box aussi ; un autre
  -- athlète et le staff d'une autre box ne voient rien.
  FOR v_role, v_lu IN
    SELECT u, (SELECT 0) FROM unnest(ARRAY[
      '00000000-0000-4000-a400-000000000011', '00000000-0000-4000-a400-000000000001',
      '00000000-0000-4000-a400-000000000014', '00000000-0000-4000-a400-000000000002']) u
  LOOP
    PERFORM pg_temp.endosser(v_role::uuid, 'authenticated');
    SELECT count(*) INTO v_lu FROM public.movement_credit_ledger
     WHERE athlete_id = '00000000-0000-4000-a400-000000000011';
    PERFORM set_config('role', 'none', true);
    PERFORM pg_temp.sortir();
    IF v_role IN ('00000000-0000-4000-a400-000000000011', '00000000-0000-4000-a400-000000000001') AND v_lu = 0 THEN
      RAISE EXCEPTION 'I6b : % ne lit pas le registre de l''athlète alors qu''il le doit', v_role;
    END IF;
    IF v_role IN ('00000000-0000-4000-a400-000000000014', '00000000-0000-4000-a400-000000000002') AND v_lu <> 0 THEN
      RAISE EXCEPTION 'I6c : % lit % ligne(s) du registre d''un athlète qui n''est pas le sien', v_role, v_lu;
    END IF;
  END LOOP;
END $$;

-- ── I7 · fenêtre de 24 h sur les crédits déclarés ──────────────────────────
DO $$
DECLARE
  v_ath uuid := '00000000-0000-4000-a400-000000000013';
  v_wod uuid;
  v_sc  uuid;
  r     text;
  i     int;
BEGIN
  PERFORM pg_temp.remise_a_zero(v_ath);

  -- Un crédit de tournoi important d'abord : il ne doit PAS compter.
  v_wod := pg_temp.wod('For Time', 2, NULL, '[{"movement":"pull_up","unit":"reps","qty_male":1500}]');
  v_sc  := pg_temp.score(v_wod, v_ath, '900', false);
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_sc;
  IF pg_temp.credits(v_sc) <> 'pull_up|reps|3000' THEN
    RAISE EXCEPTION 'I7 : décor — crédit de tournoi « % »', pg_temp.credits(v_sc);
  END IF;

  -- Trois appels au plafond : 6 000 reps déclarées, tout juste dans la fenêtre.
  FOR i IN 1 .. 3 LOOP
    PERFORM pg_temp.endosser(v_ath, 'authenticated');
    r := 'ok';
    BEGIN
      PERFORM public.increment_movement_stats(NULL, 'pull_up', 2000, NULL, 'reps');
    EXCEPTION WHEN others THEN r := SQLSTATE || '|' || SQLERRM;
    END;
    PERFORM set_config('role', 'none', true);
    PERFORM pg_temp.sortir();
    IF r <> 'ok' THEN
      RAISE EXCEPTION 'I7a : appel % de 2 000 reps refusé alors que la fenêtre le permet — %', i, r;
    END IF;
  END LOOP;

  IF (SELECT count(DISTINCT source_id) FROM public.movement_credit_ledger
       WHERE athlete_id = v_ath AND source_type = 'athlete_declared') <> 3 THEN
    RAISE EXCEPTION 'I7b : chaque appel déclaré doit porter son propre identifiant de source';
  END IF;

  -- Le suivant, même d'une seule rep, franchit la fenêtre.
  PERFORM pg_temp.endosser(v_ath, 'authenticated');
  r := 'ok';
  BEGIN
    PERFORM public.increment_movement_stats(NULL, 'pull_up', 1, NULL, 'reps');
  EXCEPTION WHEN others THEN r := SQLSTATE || '|' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM pg_temp.sortir();
  IF r NOT LIKE '22003|%fenêtre de 24 h%' OR r NOT LIKE '%6000 reps de pull_up%' THEN
    RAISE EXCEPTION 'I7c : l''appel qui franchit la fenêtre n''est pas refusé comme attendu — %', r;
  END IF;
  IF pg_temp.cumuls(v_ath) <> 'pull_up|reps|9000' THEN
    RAISE EXCEPTION 'I7d : cumul « % », attendu 9 000 (3 000 de tournoi + 6 000 déclarées)', pg_temp.cumuls(v_ath);
  END IF;

  -- Une autre unité, un autre mouvement : leur propre fenêtre.
  PERFORM pg_temp.endosser(v_ath, 'authenticated');
  r := 'ok';
  BEGIN
    PERFORM public.increment_movement_stats(NULL, 'push_up', 2000, NULL, 'reps');
  EXCEPTION WHEN others THEN r := SQLSTATE || '|' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM pg_temp.sortir();
  IF r <> 'ok' THEN
    RAISE EXCEPTION 'I7e : la fenêtre d''un mouvement a débordé sur un autre — %', r;
  END IF;

  -- Sortie de fenêtre : les déclarations de pull_up datent de plus de 24 h.
  UPDATE public.movement_credit_ledger SET created_at = now() - interval '25 hours'
   WHERE athlete_id = v_ath AND source_type = 'athlete_declared' AND movement = 'pull_up';
  PERFORM pg_temp.endosser(v_ath, 'authenticated');
  r := 'ok';
  BEGIN
    PERFORM public.increment_movement_stats(NULL, 'pull_up', 2000, NULL, 'reps');
  EXCEPTION WHEN others THEN r := SQLSTATE || '|' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM pg_temp.sortir();
  IF r <> 'ok' THEN
    RAISE EXCEPTION 'I7f : après 24 h, la fenêtre ne s''est pas libérée — %', r;
  END IF;
END $$;

-- ── I8 · contrôle d'écriture de movement_lines ─────────────────────────────
DO $$
DECLARE
  v_cas   text[][] := ARRAY[
    ARRAY['clé inconnue du catalogue', '[{"movement":"pompe_imaginaire","unit":"reps","qty_male":10}]'],
    ARRAY['unité en secondes',          '[{"movement":"hollow_hold","unit":"s","qty_male":30}]'],
    ARRAY['unité absente',              '[{"movement":"pull_up","qty_male":10}]'],
    ARRAY['quantité nulle',             '[{"movement":"pull_up","unit":"reps","qty_male":0}]'],
    ARRAY['quantité négative',          '[{"movement":"pull_up","unit":"reps","qty_male":-5}]'],
    ARRAY['quantité décimale',          '[{"movement":"pull_up","unit":"reps","qty_male":2.5}]'],
    ARRAY['quantité ♂ absente',         '[{"movement":"pull_up","unit":"reps"}]'],
    ARRAY['quantité ♀ nulle',           '[{"movement":"pull_up","unit":"reps","qty_male":10,"qty_female":0}]'],
    ARRAY['pas un tableau',             '{"movement":"pull_up","unit":"reps","qty_male":10}'],
    ARRAY['ligne qui n''est pas un objet', '["pull_up"]']];
  i       int;
  v_err   text;
  v_wod   uuid;
BEGIN
  FOR i IN 1 .. array_length(v_cas, 1) LOOP
    v_err := NULL;
    BEGIN
      PERFORM pg_temp.wod('For Time', NULL, NULL, v_cas[i][2]::jsonb);
    EXCEPTION WHEN others THEN v_err := SQLSTATE;
    END;
    IF v_err IS DISTINCT FROM '23514' THEN
      RAISE EXCEPTION 'I8 : « % » accepté à l''écriture (ou refusé autrement : %)', v_cas[i][1], v_err;
    END IF;
  END LOOP;

  -- Contre-exemples : sans description, avec un id sans correspondance, avec
  -- un split ♂/♀ — tous acceptés.
  PERFORM pg_temp.wod('For Time', NULL, NULL, NULL);
  PERFORM pg_temp.wod('For Time', NULL, NULL, '[{"movement":"arnold_press","unit":"reps","qty_male":10}]');
  v_wod := pg_temp.wod('For Time', NULL, NULL,
    '[{"movement":"wall_ball","unit":"reps","qty_male":20,"qty_female":14},{"movement":"row","unit":"m","qty_male":500}]');

  -- Le contrôle vaut aussi en modification.
  v_err := NULL;
  BEGIN
    UPDATE public.tournament_wods SET movement_lines = '[{"movement":"pompe_imaginaire","unit":"reps","qty_male":10}]'
     WHERE id = v_wod;
  EXCEPTION WHEN others THEN v_err := SQLSTATE;
  END;
  IF v_err IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'I8 : une clé inconnue passe en modification (%)', v_err;
  END IF;
END $$;

-- ── I9 · modification du WOD après validation : recalcul par différence ────
DO $$
DECLARE
  v_ath   uuid := '00000000-0000-4000-a400-000000000012';
  v_wod   uuid;
  v_score uuid;
BEGIN
  PERFORM pg_temp.remise_a_zero(v_ath);
  DELETE FROM public.athlete_badges WHERE athlete_id = v_ath;
  v_wod := pg_temp.wod('For Time', NULL, NULL, '[{"movement":"pull_up","unit":"reps","qty_male":100}]');
  v_score := pg_temp.score(v_wod, v_ath, '500', false);
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;
  IF pg_temp.cumuls(v_ath) <> 'pull_up|reps|100' THEN
    RAISE EXCEPTION 'I9 : décor « % »', pg_temp.cumuls(v_ath);
  END IF;

  -- Quantité corrigée : 60 au lieu de 100.
  UPDATE public.tournament_wods SET movement_lines = '[{"movement":"pull_up","unit":"reps","qty_male":60}]' WHERE id = v_wod;
  IF pg_temp.cumuls(v_ath) <> 'pull_up|reps|60' OR pg_temp.credits(v_score) <> 'pull_up|reps|60' THEN
    RAISE EXCEPTION 'I9a : après modification des lignes, cumuls « % », registre « % » — attendu 60',
      pg_temp.cumuls(v_ath), pg_temp.credits(v_score);
  END IF;

  -- Rounds ajoutés : 60 × 3.
  UPDATE public.tournament_wods SET rounds = 3 WHERE id = v_wod;
  IF pg_temp.cumuls(v_ath) <> 'pull_up|reps|180' THEN
    RAISE EXCEPTION 'I9b : après ajout de rounds, cumuls « % » — attendu 180', pg_temp.cumuls(v_ath);
  END IF;

  -- Le titre ne compte pas : aucun recalcul, aucune écriture.
  UPDATE public.tournament_wods SET title = 'WOD renommé' WHERE id = v_wod;
  IF pg_temp.cumuls(v_ath) <> 'pull_up|reps|180' THEN
    RAISE EXCEPTION 'I9c : un changement de titre a modifié le crédit';
  END IF;

  -- Devenu EMOM : plus rien n'est prouvé, le crédit s'en va, le badge reste.
  UPDATE public.tournament_wods SET type = 'EMOM' WHERE id = v_wod;
  IF pg_temp.cumuls(v_ath) <> '' OR pg_temp.credits(v_score) <> '' THEN
    RAISE EXCEPTION 'I9d : passé en EMOM, crédit non retiré — cumuls « % »', pg_temp.cumuls(v_ath);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.athlete_badges WHERE athlete_id = v_ath AND badge_key = 'mv_pullup_100') THEN
    RAISE EXCEPTION 'I9e : le badge obtenu a été retiré par la modification du WOD';
  END IF;
END $$;

-- ── I10 · WOD sans description structurée : aucun crédit, aucune erreur ────
DO $$
DECLARE
  v_ath   uuid := '00000000-0000-4000-a400-000000000011';
  v_wod   uuid;
  v_score uuid;
BEGIN
  PERFORM pg_temp.remise_a_zero(v_ath);
  v_wod := pg_temp.wod('For Time', NULL, NULL, NULL);
  v_score := pg_temp.score(v_wod, v_ath, '300', false);
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;
  IF pg_temp.credits(v_score) <> '' OR pg_temp.cumuls(v_ath) <> '' THEN
    RAISE EXCEPTION 'I10 : un WOD sans movement_lines a crédité « % »', pg_temp.cumuls(v_ath);
  END IF;
END $$;

-- ── I11 · la correspondance : catalogue lisible, jamais écrit côté client ──
DO $$
DECLARE v_role text; v_err text; v_lu int;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    PERFORM set_config('role', v_role, true);
    SELECT count(*) INTO v_lu FROM public.movement_stats_keys;
    v_err := NULL;
    BEGIN
      UPDATE public.movement_stats_keys SET stats_key = 'pull_up' WHERE catalog_id = 'arnold_press';
    EXCEPTION WHEN others THEN v_err := SQLERRM;
    END;
    PERFORM set_config('role', 'none', true);
    IF v_lu < 50 THEN
      RAISE EXCEPTION 'I11a : % ne lit que % correspondance(s)', v_role, v_lu;
    END IF;
    IF v_err IS NULL OR v_err NOT LIKE '%permission denied for table%' THEN
      RAISE EXCEPTION 'I11b : % peut modifier la correspondance, ou en est empêché autrement que par le GRANT — %', v_role, v_err;
    END IF;
  END LOOP;
END $$;

-- ── I12 · les fonctions du calcul restent hors de portée ───────────────────
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'internal.tournament_score_credits(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'internal.tournament_score_credits(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'internal.sync_tournament_score_credits(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'internal.sync_tournament_score_credits(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I12 : une fonction du crédit est exécutable par un rôle client';
  END IF;
END $$;

-- ── I13 · correction de reps_per_round après validation : recalcul ────────
DO $$
DECLARE
  v_ath   uuid := '00000000-0000-4000-a400-000000000011';
  v_wod   uuid;
  v_score uuid;
BEGIN
  PERFORM pg_temp.remise_a_zero(v_ath);
  v_wod := pg_temp.wod('AMRAP', NULL, NULL,
    '[{"movement":"row","unit":"cal","qty_male":20},{"movement":"burpee","unit":"reps","qty_male":10}]');
  v_score := pg_temp.score(v_wod, v_ath, '95', false);
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;
  IF pg_temp.cumuls(v_ath) <> 'burpee|reps|30,row|cal|65' THEN
    RAISE EXCEPTION 'I13 : décor « % »', pg_temp.cumuls(v_ath);
  END IF;

  -- Un reps_per_round qui contredit la somme des lignes : plus rien de prouvé.
  UPDATE public.tournament_wods SET reps_per_round = 25 WHERE id = v_wod;
  IF pg_temp.cumuls(v_ath) <> '' OR pg_temp.credits(v_score) <> '' THEN
    RAISE EXCEPTION 'I13a : reps_per_round corrigé à 25 sans recalcul — cumuls « % »', pg_temp.cumuls(v_ath);
  END IF;

  -- Rétabli à la somme : le crédit revient, au même montant.
  UPDATE public.tournament_wods SET reps_per_round = 30 WHERE id = v_wod;
  IF pg_temp.cumuls(v_ath) <> 'burpee|reps|30,row|cal|65' THEN
    RAISE EXCEPTION 'I13b : reps_per_round rétabli sans recalcul — cumuls « % »', pg_temp.cumuls(v_ath);
  END IF;
END $$;

-- ── I14 · le déclencheur du WOD suit exactement ce que le calcul lit ───────
-- Un oubli de colonne ne se voit pas : le crédit reste simplement faux après
-- une correction du WOD. Ce contrôle compare trois listes qui doivent être
-- identiques — les colonnes de `tournament_wods` que le calcul lit (`tw.xxx`,
-- hors la clé `id`), celles du `UPDATE OF` du déclencheur, et celles que la
-- fonction du déclencheur compare avant de recalculer.
DO $$
DECLARE
  v_lues      text[];
  v_trigger   text[];
  v_comparees text[];
BEGIN
  SELECT array_agg(DISTINCT m[1] ORDER BY m[1]) INTO v_lues
    FROM pg_proc p, regexp_matches(p.prosrc, '\mtw\.([a-z_]+)', 'g') AS m
   WHERE p.oid = 'internal.tournament_score_credits(uuid)'::regprocedure
     AND m[1] <> 'id';

  SELECT array_agg(a.attname::text ORDER BY a.attname) INTO v_trigger
    FROM pg_trigger t
    JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = ANY (t.tgattr)
   WHERE t.tgrelid = 'public.tournament_wods'::regclass AND t.tgname = 'trg_tournament_wods_credits';

  SELECT array_agg(DISTINCT m[1] ORDER BY m[1]) INTO v_comparees
    FROM pg_proc p, regexp_matches(p.prosrc, 'NEW\.([a-z_]+)\s+IS NOT DISTINCT FROM', 'g') AS m
   WHERE p.oid = 'public.trg_tournament_wods_credits()'::regprocedure;

  -- Contre-exemple : sur des listes vides, l'égalité ne prouverait rien.
  IF COALESCE(array_length(v_lues, 1), 0) < 3 THEN
    RAISE EXCEPTION 'I14 : le calcul ne lit que % colonne(s) de tournament_wods — lecture introuvable', v_lues;
  END IF;
  IF v_trigger IS DISTINCT FROM v_lues THEN
    RAISE EXCEPTION 'I14a : le calcul lit % mais le déclencheur ne suit que % — une correction de la colonne manquante laisserait des crédits faux',
      v_lues, v_trigger;
  END IF;
  IF v_comparees IS DISTINCT FROM v_lues THEN
    RAISE EXCEPTION 'I14b : le calcul lit % mais la fonction du déclencheur ne compare que %', v_lues, v_comparees;
  END IF;
END $$;

-- ── I15 · un score validé retient son tournoi ; rejeté, le tournoi part ─────
-- Depuis la migration 20270124, un tournoi qui a un score validé ne se supprime
-- plus (on l'archive) : ses crédits restent. Une fois le score rejeté, les
-- crédits partent, le tournoi se supprime, et le badge obtenu reste.
DO $$
DECLARE
  v_ath   uuid := '00000000-0000-4000-a400-000000000014';
  v_t     uuid := gen_random_uuid();
  v_wod   uuid := gen_random_uuid();
  v_score uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.remise_a_zero(v_ath);
  DELETE FROM public.athlete_badges WHERE athlete_id = v_ath;
  INSERT INTO public.tournaments (id, box_id, name, level, format, status)
  VALUES (v_t, '00000000-0000-4000-b400-00000000000b', 'Tournoi jetable', 'rx', 'simple', 'active');
  INSERT INTO public.tournament_wods (id, tournament_id, title, type, status, movement_lines)
  VALUES (v_wod, v_t, 'WOD jetable', 'For Time', 'active', '[{"movement":"row","unit":"cal","qty_male":500}]');
  INSERT INTO public.tournament_scores (id, tournament_id, tournament_wod_id, athlete_id, score_value, status)
  VALUES (v_score, v_t, v_wod, v_ath, '1500', 'pending');
  UPDATE public.tournament_scores SET status = 'validated' WHERE id = v_score;
  IF pg_temp.cumuls(v_ath) <> 'row|cal|500'
     OR NOT EXISTS (SELECT 1 FROM public.athlete_badges WHERE athlete_id = v_ath AND badge_key = 'mv_row_500') THEN
    RAISE EXCEPTION 'I15 : décor — cumuls « % », badge mv_row_500 absent ?', pg_temp.cumuls(v_ath);
  END IF;

  BEGIN
    DELETE FROM public.tournaments WHERE id = v_t;
    RAISE EXCEPTION 'I15a : un tournoi qui a un score validé a été supprimé';
  EXCEPTION WHEN restrict_violation THEN NULL;
  END;
  IF pg_temp.cumuls(v_ath) <> 'row|cal|500' THEN
    RAISE EXCEPTION 'I15a : suppression refusée, mais crédit touché — cumuls « % »', pg_temp.cumuls(v_ath);
  END IF;

  UPDATE public.tournament_scores SET status = 'rejected' WHERE id = v_score;
  DELETE FROM public.tournaments WHERE id = v_t;
  IF EXISTS (SELECT 1 FROM public.tournaments WHERE id = v_t)
     OR pg_temp.cumuls(v_ath) <> '' OR pg_temp.credits(v_score) <> '' THEN
    RAISE EXCEPTION 'I15a : score rejeté puis tournoi supprimé, crédit resté — cumuls « % », registre « % »',
      pg_temp.cumuls(v_ath), pg_temp.credits(v_score);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.athlete_badges WHERE athlete_id = v_ath AND badge_key = 'mv_row_500') THEN
    RAISE EXCEPTION 'I15b : le badge obtenu a disparu avec le tournoi';
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'tournament_credits : P, I1…I15 OK'; END $$;

ROLLBACK;
