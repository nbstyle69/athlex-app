-- ═════════════════════════════════════════════════════════════════════════════
-- KB Deadlift et KB Front Squat créditent deadlift et squat
-- (nbstyle69/AthleX-Manager#453, PR 3c-0, migration 20270166)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (la migration et son retour arrière sont rejoués par \i, et
-- relus comme texte par \copy pour éprouver leurs gardes).
--   S   après toutes les migrations, movement_stats_keys est EXACTEMENT
--       supabase/seed/movement_stats_keys.json (le fichier que le test jest
--       redérive du client), et le badge_key de chaque id à correspondance est
--       renseigné, celui de chaque id sans correspondance est NULL ;
--   E   l'état posé par 20270166 : deux clés, deux badge_key ;
--   R   retour arrière : les deux lignes et les deux badge_key retirés, rien
--       d'autre ne bouge ;
--   C   crédits : un score validé AVANT la migration n'est pas recalculé par
--       elle ; un score validé APRÈS crédite deadlift et squat ; l'ancien score
--       n'est recrédité que s'il est modifié ensuite (chemin connu, documenté) ;
--   G   gardes : migration rejouée sur l'état d'après, migration sur un
--       catalogue inattendu, retour sur un état d'après partiel ou sur l'état
--       d'avant → refusés, rien écrit ;
--   M   la migration rejouée redonne exactement les empreintes d'après.
-- Mutations : jouées localement (liste et résultat dans la PR) ; chacune fait
-- échouer ce fichier. Tout est joué dans une transaction annulée.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> KB Deadlift / KB Front Squat : pont et badge (20270166)'

BEGIN;

-- ── Outils ──────────────────────────────────────────────────────────────────

-- Un fichier du dépôt, ligne à ligne, dans l'ordre (côté client : marche aussi
-- contre une base dans un conteneur). Le format csv avec des caractères de
-- contrôle comme délimiteur et guillemet garde chaque ligne telle quelle.
CREATE TEMP TABLE f_json (n bigserial, l text);
CREATE TEMP TABLE f_mig  (n bigserial, l text);
CREATE TEMP TABLE f_ret  (n bigserial, l text);
\copy f_json (l) FROM 'supabase/seed/movement_stats_keys.json' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\x02')
\copy f_mig  (l) FROM 'supabase/migrations/20270166000000_movement_stats_keys_kb.sql' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\x02')
\copy f_ret  (l) FROM 'supabase/retours/20270166000000_movement_stats_keys_kb.sql' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\x02')

CREATE FUNCTION pg_temp.texte(t regclass) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  EXECUTE format('SELECT string_agg(COALESCE(l, ''''), E''\n'' ORDER BY n) FROM %s', t) INTO r;
  RETURN r;
END $$;

-- Empreinte du pont entier, et des badge_key du catalogue entier.
CREATE FUNCTION pg_temp.e_cles() RETURNS text LANGUAGE sql AS $$
  SELECT md5(COALESCE(string_agg(catalog_id || '=' || stats_key, ',' ORDER BY catalog_id), ''))
    FROM public.movement_stats_keys $$;
CREATE FUNCTION pg_temp.e_badges() RETURNS text LANGUAGE sql AS $$
  SELECT md5(string_agg(id || '=' || COALESCE(badge_key, '∅'), ',' ORDER BY id))
    FROM public.movement_catalog $$;
-- Tout le catalogue sauf updated_at (que le déclencheur de la table réécrit).
CREATE FUNCTION pg_temp.e_catalogue() RETURNS text LANGUAGE sql AS $$
  SELECT md5(string_agg((to_jsonb(c) - 'updated_at')::text, ',' ORDER BY id))
    FROM public.movement_catalog c $$;

-- Jouer un fichier relu et rendre le code d'erreur levé ('' s'il passe).
CREATE FUNCTION pg_temp.jouer(t regclass) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE pg_temp.texte(t);
  RETURN '';
EXCEPTION WHEN raise_exception THEN
  RETURN split_part(SQLERRM, ':', 1);
END $$;

-- ── S · le pont de la base ≡ le fichier redérivé du client ─────────────────
DO $$
DECLARE
  j      jsonb := pg_temp.texte('f_json')::jsonb;
  v_att  text;
  v_obt  text;
  n      int;
BEGIN
  SELECT string_agg(key || '=' || value, ',' ORDER BY key) INTO v_att
    FROM jsonb_each_text(j -> 'correspondances');
  SELECT string_agg(catalog_id || '=' || stats_key, ',' ORDER BY catalog_id) INTO v_obt
    FROM public.movement_stats_keys;
  -- Contre-exemple : un fichier vide ou mal lu rendrait tout égal à NULL.
  IF v_att IS NULL OR (SELECT count(*) FROM jsonb_object_keys(j -> 'correspondances')) < 70 THEN
    RAISE EXCEPTION 'S0 : movement_stats_keys.json mal lu';
  END IF;
  IF v_obt IS DISTINCT FROM v_att THEN
    RAISE EXCEPTION E'S1 : movement_stats_keys diffère du fichier du client\n  base    : %\n  fichier : %',
      v_obt, v_att;
  END IF;

  -- Un id du catalogue a un badge_key si et seulement s'il a une clé.
  SELECT count(*) INTO n FROM public.movement_catalog c
   WHERE (c.badge_key IS NOT NULL) <> EXISTS (SELECT 1 FROM public.movement_stats_keys k WHERE k.catalog_id = c.id);
  IF n <> 0 THEN
    RAISE EXCEPTION 'S2 : % id(s) du catalogue avec un badge_key sans clé, ou une clé sans badge_key', n;
  END IF;
END $$;

-- ── E · l'état posé par 20270166 ────────────────────────────────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM public.movement_stats_keys
       WHERE (catalog_id, stats_key) IN (('kb_deadlift', 'deadlift'), ('kb_front_squat', 'squat'))) <> 2 THEN
    RAISE EXCEPTION 'E1 : clés de kb_deadlift / kb_front_squat absentes';
  END IF;
  IF (SELECT count(*) FROM public.movement_catalog
       WHERE (id, badge_key) IN (('kb_deadlift', 'mv_deadlifts'), ('kb_front_squat', 'mv_squat'))) <> 2 THEN
    RAISE EXCEPTION 'E2 : badge_key de kb_deadlift / kb_front_squat inattendu';
  END IF;
END $$;

CREATE TEMP TABLE apres AS
  SELECT pg_temp.e_cles() AS cles, pg_temp.e_badges() AS badges, pg_temp.e_catalogue() AS cat,
         (SELECT count(*) FROM public.movement_stats_keys) AS n_cles;

-- ── G1 · la migration rejouée sur l'état d'après est refusée ───────────────
DO $$
DECLARE r text := pg_temp.jouer('f_mig');
BEGIN
  IF r <> 'MOVEMENT_STATS_KEYS_KB_ETAT' THEN
    RAISE EXCEPTION 'G1 : migration rejouée sur l''état d''après : attendu MOVEMENT_STATS_KEYS_KB_ETAT, obtenu « % »', r;
  END IF;
  IF pg_temp.e_cles() <> (SELECT cles FROM apres) OR pg_temp.e_catalogue() <> (SELECT cat FROM apres) THEN
    RAISE EXCEPTION 'G1 : une migration refusée a écrit';
  END IF;
END $$;

-- ── G2b, G2c · retour sur un état d'après partiel : refusé ─────────────────
DO $$
DECLARE r text;
BEGIN
  -- les deux clés, mais un seul badge
  UPDATE public.movement_catalog SET badge_key = NULL WHERE id = 'kb_deadlift';
  r := pg_temp.jouer('f_ret');
  UPDATE public.movement_catalog SET badge_key = 'mv_deadlifts' WHERE id = 'kb_deadlift';
  IF r <> 'MOVEMENT_STATS_KEYS_KB_RETOUR_ETAT' THEN
    RAISE EXCEPTION 'G2b : un seul badge posé : attendu MOVEMENT_STATS_KEYS_KB_RETOUR_ETAT, obtenu « % »', r;
  END IF;
  -- les deux badges, mais une seule clé
  DELETE FROM public.movement_stats_keys WHERE catalog_id = 'kb_front_squat';
  r := pg_temp.jouer('f_ret');
  INSERT INTO public.movement_stats_keys (catalog_id, stats_key) VALUES ('kb_front_squat', 'squat');
  IF r <> 'MOVEMENT_STATS_KEYS_KB_RETOUR_ETAT' THEN
    RAISE EXCEPTION 'G2c : une seule clé posée : attendu MOVEMENT_STATS_KEYS_KB_RETOUR_ETAT, obtenu « % »', r;
  END IF;
  IF pg_temp.e_cles() <> (SELECT cles FROM apres) OR pg_temp.e_badges() <> (SELECT badges FROM apres) THEN
    RAISE EXCEPTION 'G2 : état d''après non restauré après les cas refusés';
  END IF;
END $$;

-- ── R · retour arrière (le fichier, tel qu'il se joue en prod) ─────────────
\i supabase/retours/20270166000000_movement_stats_keys_kb.sql

DO $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM apres;
  IF EXISTS (SELECT 1 FROM public.movement_stats_keys WHERE catalog_id IN ('kb_deadlift', 'kb_front_squat')) THEN
    RAISE EXCEPTION 'R1 : le retour laisse une clé à kb_deadlift / kb_front_squat';
  END IF;
  IF (SELECT count(*) FROM public.movement_catalog
       WHERE id IN ('kb_deadlift', 'kb_front_squat') AND badge_key IS NULL) <> 2 THEN
    RAISE EXCEPTION 'R2 : le retour ne remet pas les deux badge_key à NULL';
  END IF;
  IF (SELECT count(*) FROM public.movement_stats_keys) <> a.n_cles - 2 THEN
    RAISE EXCEPTION 'R3 : le retour a touché d''autres clés';
  END IF;
  IF (SELECT count(*) FROM public.movement_catalog WHERE badge_key IS NOT NULL
        AND id NOT IN ('kb_deadlift', 'kb_front_squat')) <>
     (SELECT count(*) FROM public.movement_stats_keys) THEN
    RAISE EXCEPTION 'R4 : le retour a touché d''autres badge_key';
  END IF;
END $$;

CREATE TEMP TABLE avant AS
  SELECT pg_temp.e_cles() AS cles, pg_temp.e_badges() AS badges, pg_temp.e_catalogue() AS cat;

-- ── G2 · le retour rejoué sur l'état d'avant est refusé ────────────────────
DO $$
DECLARE r text := pg_temp.jouer('f_ret');
BEGIN
  IF r <> 'MOVEMENT_STATS_KEYS_KB_RETOUR_ETAT' THEN
    RAISE EXCEPTION 'G2 : retour rejoué sur l''état d''avant : attendu MOVEMENT_STATS_KEYS_KB_RETOUR_ETAT, obtenu « % »', r;
  END IF;
  IF pg_temp.e_cles() <> (SELECT cles FROM avant) OR pg_temp.e_catalogue() <> (SELECT cat FROM avant) THEN
    RAISE EXCEPTION 'G2 : un retour refusé a écrit';
  END IF;
END $$;

-- ── G3 · catalogue inattendu : la migration est refusée ────────────────────
DO $$
DECLARE r text;
BEGIN
  -- badge de référence de deadlift déplacé
  UPDATE public.movement_catalog SET badge_key = 'mv_autre' WHERE id = 'deadlift';
  r := pg_temp.jouer('f_mig');
  UPDATE public.movement_catalog SET badge_key = 'mv_deadlifts' WHERE id = 'deadlift';
  IF r <> 'MOVEMENT_STATS_KEYS_KB_ETAT' THEN
    RAISE EXCEPTION 'G3a : badge de deadlift inattendu : attendu MOVEMENT_STATS_KEYS_KB_ETAT, obtenu « % »', r;
  END IF;
  -- kb_front_squat déjà rattaché à un badge
  UPDATE public.movement_catalog SET badge_key = 'mv_squat' WHERE id = 'kb_front_squat';
  r := pg_temp.jouer('f_mig');
  UPDATE public.movement_catalog SET badge_key = NULL WHERE id = 'kb_front_squat';
  IF r <> 'MOVEMENT_STATS_KEYS_KB_ETAT' THEN
    RAISE EXCEPTION 'G3b : kb_front_squat déjà rattaché : attendu MOVEMENT_STATS_KEYS_KB_ETAT, obtenu « % »', r;
  END IF;
  -- kb_deadlift a déjà une clé (une autre que celle prévue)
  INSERT INTO public.movement_stats_keys (catalog_id, stats_key) VALUES ('kb_deadlift', 'kb_swing');
  r := pg_temp.jouer('f_mig');
  DELETE FROM public.movement_stats_keys WHERE catalog_id = 'kb_deadlift';
  IF r <> 'MOVEMENT_STATS_KEYS_KB_ETAT' THEN
    RAISE EXCEPTION 'G3c : kb_deadlift a déjà une clé : attendu MOVEMENT_STATS_KEYS_KB_ETAT, obtenu « % »', r;
  END IF;
  IF pg_temp.e_cles() <> (SELECT cles FROM avant) OR pg_temp.e_badges() <> (SELECT badges FROM avant) THEN
    RAISE EXCEPTION 'G3 : état d''avant non restauré après les cas refusés';
  END IF;
END $$;

-- ── C · crédits avant / après ──────────────────────────────────────────────
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a466-000000000001'), ('00000000-0000-4000-a466-000000000011'),
  ('00000000-0000-4000-a466-000000000012');
INSERT INTO public.profiles (id, email, username, gender) VALUES
  ('00000000-0000-4000-a466-000000000001', 'kb-staff@test.invalid', 'kb_staff', NULL),
  ('00000000-0000-4000-a466-000000000011', 'kb-m@test.invalid',     'kb_m',     'male'),
  ('00000000-0000-4000-a466-000000000012', 'kb-m2@test.invalid',    'kb_m2',    'male');
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b466-00000000000a', 'Box KB', 'KB66', '00000000-0000-4000-a466-000000000001');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b466-00000000000a', '00000000-0000-4000-a466-000000000011', 'member', 'active'),
  ('00000000-0000-4000-b466-00000000000a', '00000000-0000-4000-a466-000000000012', 'member', 'active');
INSERT INTO public.tournaments (id, box_id, name, level, format, status) VALUES
  ('00000000-0000-4000-c466-000000000001', '00000000-0000-4000-b466-00000000000a', 'Tournoi KB', 'rx', 'simple', 'active');
-- For Time : 21 KB Deadlift + 15 KB Front Squat + 10 burpees, 1 tour.
INSERT INTO public.tournament_wods (id, tournament_id, title, type, status, rounds, movement_lines) VALUES
  ('00000000-0000-4000-d466-000000000001', '00000000-0000-4000-c466-000000000001', 'WOD KB', 'For Time', 'active', 1,
   '[{"movement":"kb_deadlift","unit":"reps","qty_male":21},
     {"movement":"kb_front_squat","unit":"reps","qty_male":15},
     {"movement":"burpee","unit":"reps","qty_male":10}]'::jsonb);

CREATE FUNCTION pg_temp.credits(p_score uuid) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(movement || '|' || unit || '|' || quantity, ',' ORDER BY movement, unit), '')
    FROM public.movement_credit_ledger
   WHERE source_type = 'tournament_score' AND source_id = p_score $$;

-- Score 1, validé AVANT la migration : seuls les burpees comptent.
INSERT INTO public.tournament_scores (id, tournament_id, tournament_wod_id, athlete_id, score_value, capped, status) VALUES
  ('00000000-0000-4000-e466-000000000001', '00000000-0000-4000-c466-000000000001',
   '00000000-0000-4000-d466-000000000001', '00000000-0000-4000-a466-000000000011', '600', false, 'pending');
UPDATE public.tournament_scores SET status = 'validated' WHERE id = '00000000-0000-4000-e466-000000000001';

DO $$
DECLARE v text := pg_temp.credits('00000000-0000-4000-e466-000000000001');
BEGIN
  IF v <> 'burpee|reps|10' THEN
    RAISE EXCEPTION 'C1 : avant la migration, attendu « burpee|reps|10 », obtenu « % »', v;
  END IF;
END $$;

-- ── M · la migration (le fichier, tel qu'il se joue en prod) ───────────────
\i supabase/migrations/20270166000000_movement_stats_keys_kb.sql

DO $$
DECLARE a record; v text;
BEGIN
  SELECT * INTO a FROM apres;
  IF pg_temp.e_cles() <> a.cles OR pg_temp.e_badges() <> a.badges OR pg_temp.e_catalogue() <> a.cat THEN
    RAISE EXCEPTION 'M1 : la migration rejouée ne redonne pas les empreintes d''après';
  END IF;

  -- Rien n'est recalculé : le score 1 garde son crédit.
  v := pg_temp.credits('00000000-0000-4000-e466-000000000001');
  IF v <> 'burpee|reps|10' THEN
    RAISE EXCEPTION 'C2 : la migration a recalculé un crédit passé : « % »', v;
  END IF;
END $$;

-- Score 2 (un autre athlète), validé APRÈS : deadlift et squat comptent.
INSERT INTO public.tournament_scores (id, tournament_id, tournament_wod_id, athlete_id, score_value, capped, status) VALUES
  ('00000000-0000-4000-e466-000000000002', '00000000-0000-4000-c466-000000000001',
   '00000000-0000-4000-d466-000000000001', '00000000-0000-4000-a466-000000000012', '580', false, 'pending');
UPDATE public.tournament_scores SET status = 'validated' WHERE id = '00000000-0000-4000-e466-000000000002';

-- Score 1 corrigé ensuite : recalculé par différence avec le registre.
UPDATE public.tournament_scores SET score_value = '590' WHERE id = '00000000-0000-4000-e466-000000000001';

DO $$
DECLARE v text;
BEGIN
  v := pg_temp.credits('00000000-0000-4000-e466-000000000002');
  IF v <> 'burpee|reps|10,deadlift|reps|21,squat|reps|15' THEN
    RAISE EXCEPTION 'C3 : après la migration, attendu deadlift 21 et squat 15, obtenu « % »', v;
  END IF;
  v := pg_temp.credits('00000000-0000-4000-e466-000000000001');
  IF v <> 'burpee|reps|10,deadlift|reps|21,squat|reps|15' THEN
    RAISE EXCEPTION 'C4 : un score modifié après la migration est recrédité, attendu deadlift 21 et squat 15, obtenu « % »', v;
  END IF;
END $$;

\echo '    ok'
ROLLBACK;
