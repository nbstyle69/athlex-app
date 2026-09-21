-- ═════════════════════════════════════════════════════════════════════════════
-- Contrôle des gardes d'écriture de `tournament_scores` et de la garde
-- d'appelant de `recalc_division_points` (migration 20261230000000).
--
-- Rejoué par `scripts/db-replay.sh` — donc par la CI — sur la base reconstruite
-- depuis `supabase/migrations/`. Chaque assertion peut échouer : un refus
-- attendu qui passe, ou un chemin légitime qui casse, arrête le script.
--
-- Rôles : `SET LOCAL ROLE` + `request.jwt.claim.*` reproduisent ce que PostgREST
-- pose pour une requête authentifiée. `auth.role()` et `auth.uid()` les lisent.
--
-- Les fixtures vivent dans une transaction annulée à la fin : la base de rejeu
-- ressort telle qu'elle était.
-- ═════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\echo '==> Gardes tournament_scores + recalc_division_points'

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Deux box, deux staff, deux athlètes, un tournoi `league_div` et un tournoi
-- d'un autre format, chacun avec un WOD actif et ouvert.
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a000-000000000001'),  -- staff box A
  ('00000000-0000-4000-a000-000000000002'),  -- staff box B
  ('00000000-0000-4000-a000-000000000011'),  -- athlète inscrit
  ('00000000-0000-4000-a000-000000000012');  -- athlète non inscrit

INSERT INTO public.profiles (id, email, username) VALUES
  ('00000000-0000-4000-a000-000000000001', 'staff-a@test.invalid', 'staff_a'),
  ('00000000-0000-4000-a000-000000000002', 'staff-b@test.invalid', 'staff_b'),
  ('00000000-0000-4000-a000-000000000011', 'athlete-1@test.invalid', 'athlete_1'),
  ('00000000-0000-4000-a000-000000000012', 'athlete-2@test.invalid', 'athlete_2');

INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b000-00000000000a', 'Box A', 'TESTA', '00000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-b000-00000000000b', 'Box B', 'TESTB', '00000000-0000-4000-a000-000000000002');

INSERT INTO public.tournaments (id, box_id, name, level, format, status) VALUES
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-00000000000a', 'Ligue test',  'rx', 'league_div', 'active'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-00000000000a', 'Simple test', 'rx', 'simple',     'active');

INSERT INTO public.tournament_wods (id, tournament_id, title, type, status, opens_at, closes_at) VALUES
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000001', 'WOD ligue',  'For Time', 'active', now() - interval '1 hour', now() + interval '1 day'),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000002', 'WOD simple', 'AMRAP',    'active', now() - interval '1 hour', now() + interval '1 day'),
  -- WOD laissé vierge : `tournament_scores` porte un unique (wod, athlète) ; un
  -- refus obtenu sur un WOD déjà scoré ne prouverait pas la règle testée.
  ('00000000-0000-4000-d000-000000000003', '00000000-0000-4000-c000-000000000001', 'WOD vierge', 'For Time', 'active', now() - interval '1 hour', now() + interval '1 day');

INSERT INTO public.tournament_participants (tournament_id, athlete_id) VALUES
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-000000000011'),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-a000-000000000011');

-- ── T01 · athlète inscrit : insertion `pending` acceptée (tournoi `league_div`) ──
-- Prouve aussi que le trigger de recalcul s'exécute : il appelle désormais la
-- fonction interne, et la garde de la fonction publique ne doit pas s'y opposer.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub  = '00000000-0000-4000-a000-000000000011';
SET LOCAL request.jwt.claim.role = 'authenticated';
DO $$
BEGIN
  INSERT INTO public.tournament_scores (id, tournament_id, tournament_wod_id, athlete_id, score_value, status)
  VALUES ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-c000-000000000001',
          '00000000-0000-4000-d000-000000000001', '00000000-0000-4000-a000-000000000011', '300', 'pending');
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'T01 : insertion pending refusée alors qu''elle doit passer (ligue) — % / %', SQLSTATE, SQLERRM;
END $$;

-- ── T02 · même chose sur un tournoi d'un autre format ──────────────────────
DO $$
BEGIN
  INSERT INTO public.tournament_scores (id, tournament_id, tournament_wod_id, athlete_id, score_value, status)
  VALUES ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-c000-000000000002',
          '00000000-0000-4000-d000-000000000002', '00000000-0000-4000-a000-000000000011', '150', 'pending');
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'T02 : insertion pending refusée alors qu''elle doit passer (hors ligue) — % / %', SQLSTATE, SQLERRM;
END $$;

-- ── T03 · athlète inscrit : insertion `validated` refusée ──────────────────
DO $$
BEGIN
  INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
  VALUES ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-d000-000000000003',
          '00000000-0000-4000-a000-000000000011', '299', 'validated');
  RAISE EXCEPTION 'T03 : un athlète a pu déposer un score déjà validated';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ── T04 · athlète NON inscrit : insertion refusée ──────────────────────────
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a000-000000000012';
DO $$
BEGIN
  INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
  VALUES ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-d000-000000000003',
          '00000000-0000-4000-a000-000000000012', '250', 'pending');
  RAISE EXCEPTION 'T04 : un athlète non inscrit au tournoi a pu déposer un score';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ── T05 · athlète : `pending` → `validated` refusé ─────────────────────────
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';
DO $$
BEGIN
  UPDATE public.tournament_scores SET status = 'validated'
   WHERE id = '00000000-0000-4000-e000-000000000001';
  RAISE EXCEPTION 'T05 : un athlète a pu valider sa propre ligne';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ── T06 · athlète : modification de `notes` acceptée ───────────────────────
DO $$
DECLARE n int;
BEGIN
  UPDATE public.tournament_scores SET notes = 'remarque athlète'
   WHERE id = '00000000-0000-4000-e000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'T06 : l''athlète ne peut plus écrire ses propres notes (% ligne(s))', n; END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'T06 : écriture de notes refusée alors qu''elle doit passer';
END $$;

-- ── T07 · athlète : colonne réservée refusée (trigger BEFORE UPDATE) ───────
DO $$
BEGIN
  UPDATE public.tournament_scores SET admin_message = 'je me réponds à moi-même'
   WHERE id = '00000000-0000-4000-e000-000000000001';
  RAISE EXCEPTION 'T07a : un athlète a pu écrire admin_message';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$
BEGIN
  UPDATE public.tournament_scores SET tournament_wod_id = '00000000-0000-4000-d000-000000000003'
   WHERE id = '00000000-0000-4000-e000-000000000001';
  RAISE EXCEPTION 'T07b : un athlète a pu déplacer son score vers un autre WOD';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Forger la trace de modération passait avant la migration (1 ligne modifiée).
DO $$
BEGIN
  UPDATE public.tournament_scores
     SET validated_by = '00000000-0000-4000-a000-000000000011', validated_at = now()
   WHERE id = '00000000-0000-4000-e000-000000000001';
  RAISE EXCEPTION 'T07c : un athlète a pu forger validated_by / validated_at';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ── T08 · staff de la box : validation, rejet, admin_message, score_value ──
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a000-000000000001';
DO $$
DECLARE n int;
BEGIN
  UPDATE public.tournament_scores SET status = 'validated', validated_at = now()
   WHERE id = '00000000-0000-4000-e000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'T08a : le staff ne peut plus valider (% ligne(s))', n; END IF;

  UPDATE public.tournament_scores SET admin_message = 'score revu', score_value = '295'
   WHERE id = '00000000-0000-4000-e000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'T08b : le staff ne peut plus corriger score_value / admin_message (% ligne(s))', n; END IF;

  UPDATE public.tournament_scores SET status = 'rejected'
   WHERE id = '00000000-0000-4000-e000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'T08c : le staff ne peut plus rejeter (% ligne(s))', n; END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'T08 : un chemin staff est refusé — %', SQLERRM;
END $$;

-- ── T09 · athlète : correction d'une ligne `rejected`, retour en `pending` ──
-- C'est le cas que la policy d'avant faisait échouer en silence.
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a000-000000000011';
DO $$
DECLARE n int;
BEGIN
  UPDATE public.tournament_scores SET score_value = '280', status = 'pending'
   WHERE id = '00000000-0000-4000-e000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'T09 : la correction d''un score rejeté ne passe pas (% ligne(s))', n; END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'T09 : correction d''un score rejeté refusée — %', SQLERRM;
END $$;

-- ── T10 · staff d'une AUTRE box : refusé ───────────────────────────────────
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a000-000000000002';
DO $$
DECLARE n int;
BEGIN
  UPDATE public.tournament_scores SET status = 'validated'
   WHERE id = '00000000-0000-4000-e000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  -- Aucune policy ne le laisse lire cette ligne : 0 ligne touchée, sans erreur.
  IF n <> 0 THEN RAISE EXCEPTION 'T10 : le staff d''une autre box a modifié % ligne(s)', n; END IF;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ── T11 · service_role : l'analyse IA (ai_analysis) doit passer ────────────
RESET ROLE;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL request.jwt.claim.sub  = '';
DO $$
DECLARE n int;
BEGIN
  UPDATE public.tournament_scores SET ai_analysis = 'analyse'
   WHERE id = '00000000-0000-4000-e000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'T11 : la fonction edge ne peut plus écrire ai_analysis (% ligne(s))', n; END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'T11 : écriture service_role refusée — %', SQLERRM;
END $$;

-- ── T12 · garde de `recalc_division_points`, indépendamment de l'ACL ───────
-- On accorde EXECUTE à `authenticated` LE TEMPS DU TEST : si la garde ne tenait
-- qu'à l'ACL, l'appel passerait. C'est ce qui prouve la garde elle-même.
RESET ROLE;
GRANT EXECUTE ON FUNCTION public.recalc_division_points(uuid) TO authenticated;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub  = '00000000-0000-4000-a000-000000000011';
DO $$
BEGIN
  PERFORM public.recalc_division_points('00000000-0000-4000-c000-000000000001');
  RAISE EXCEPTION 'T12a : un athlète a pu déclencher recalc_division_points en direct';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Le gestionnaire du tournoi, lui, passe.
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-a000-000000000001';
DO $$
BEGIN
  PERFORM public.recalc_division_points('00000000-0000-4000-c000-000000000001');
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'T12b : le gestionnaire du tournoi est refusé — % / %', SQLSTATE, SQLERRM;
END $$;

RESET ROLE;
REVOKE EXECUTE ON FUNCTION public.recalc_division_points(uuid) FROM authenticated;

-- ── T13 · la fonction interne est hors de portée des rôles clients ─────────
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'internal.recalc_division_points(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T13a : authenticated peut exécuter la fonction interne';
  END IF;
  IF has_function_privilege('anon', 'internal.recalc_division_points(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T13b : anon peut exécuter la fonction interne';
  END IF;
  IF has_schema_privilege('authenticated', 'internal', 'USAGE') THEN
    RAISE EXCEPTION 'T13c : authenticated a USAGE sur le schéma internal';
  END IF;
  IF has_function_privilege('authenticated', 'public.recalc_division_points(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'T13d : authenticated a gardé EXECUTE sur la fonction publique';
  END IF;
END $$;

ROLLBACK;

\echo '    14 contrôles vrais : gardes tournament_scores + recalc_division_points'
