-- ═════════════════════════════════════════════════════════════════════════════
-- Lecture des cumuls de mouvement par le super-admin
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
--
-- La migration `20270103` ouvre la LECTURE de `user_movement_stats` au
-- super-admin, et rien d'autre. Ce test vérifie les deux moitiés : ce qui
-- s'ouvre (le super-admin lit tout) et ce qui ne doit pas bouger (l'athlète ne
-- lit que ses lignes, un gérant de box pas davantage qu'avant, `anon` rien,
-- et personne n'écrit — super-admin compris).
--
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Lecture des cumuls par le super-admin'

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Un super-admin, un gérant de la box A, un athlète de chaque box.
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a500-000000000001'), ('00000000-0000-4000-a500-000000000002'),
  ('00000000-0000-4000-a500-000000000011'), ('00000000-0000-4000-a500-000000000012');

INSERT INTO public.profiles (id, email, username, role) VALUES
  ('00000000-0000-4000-a500-000000000001', 'sa-cumuls@test.invalid',    'sa_cumuls',    'super_admin'),
  ('00000000-0000-4000-a500-000000000002', 'staff-cumuls@test.invalid', 'staff_cumuls', 'box_owner'),
  ('00000000-0000-4000-a500-000000000011', 'ath-a-cumuls@test.invalid', 'ath_a_cumuls', 'athlete'),
  ('00000000-0000-4000-a500-000000000012', 'ath-b-cumuls@test.invalid', 'ath_b_cumuls', 'athlete');

INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b500-00000000000a', 'Box cumuls A', 'CUMA', '00000000-0000-4000-a500-000000000002'),
  ('00000000-0000-4000-b500-00000000000b', 'Box cumuls B', 'CUMB', NULL);

INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b500-00000000000a', '00000000-0000-4000-a500-000000000011', 'member', 'active'),
  ('00000000-0000-4000-b500-00000000000b', '00000000-0000-4000-a500-000000000012', 'member', 'active');

INSERT INTO public.user_movement_stats (user_id, movement, unit, total_reps) VALUES
  ('00000000-0000-4000-a500-000000000011', 'pull_up', 'reps', 100),
  ('00000000-0000-4000-a500-000000000011', 'row',     'cal',  300),
  ('00000000-0000-4000-a500-000000000012', 'push_up', 'reps', 50);

-- Ce que voit un rôle client sous le JWT d'un compte : nombre de lignes, et
-- nombre de celles des deux athlètes de test.
CREATE FUNCTION pg_temp.voit(p_user uuid, p_role text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_tout int; v_a int; v_b int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',  COALESCE(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config('role', p_role, true);
  SELECT count(*),
         count(*) FILTER (WHERE user_id = '00000000-0000-4000-a500-000000000011'),
         count(*) FILTER (WHERE user_id = '00000000-0000-4000-a500-000000000012')
    INTO v_tout, v_a, v_b FROM public.user_movement_stats;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub',  '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN v_tout || '|' || v_a || '|' || v_b;
END $$;

-- ── S1 · le super-admin lit toutes les lignes ──────────────────────────────
DO $$
DECLARE v text; v_total int;
BEGIN
  SELECT count(*) INTO v_total FROM public.user_movement_stats;
  v := pg_temp.voit('00000000-0000-4000-a500-000000000001', 'authenticated');
  IF v <> v_total || '|2|1' THEN
    RAISE EXCEPTION 'S1 : le super-admin voit « % » (toutes|athlète A|athlète B), attendu « %|2|1 »', v, v_total;
  END IF;
END $$;

-- ── S2 · un athlète ne lit toujours que ses lignes ─────────────────────────
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.voit('00000000-0000-4000-a500-000000000011', 'authenticated');
  IF v <> '2|2|0' THEN
    RAISE EXCEPTION 'S2 : l''athlète A voit « % », attendu ses 2 lignes seulement (2|2|0)', v;
  END IF;
END $$;

-- ── S3 · un gérant de box ne lit pas davantage qu'avant ─────────────────────
-- Aujourd'hui, aucune policy n'ouvre les cumuls au staff : le gérant de la box A
-- ne lit ni ceux de la box B, ni ceux de ses propres membres. Ce lot ne change
-- rien à cela.
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.voit('00000000-0000-4000-a500-000000000002', 'authenticated');
  IF v <> '0|0|0' THEN
    RAISE EXCEPTION 'S3 : le gérant de la box A voit « % », attendu 0|0|0 (comportement inchangé)', v;
  END IF;
END $$;

-- ── S4 · anon ne lit rien ──────────────────────────────────────────────────
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.voit(NULL, 'anon');
  IF v <> '0|0|0' THEN
    RAISE EXCEPTION 'S4 : anon voit « % »', v;
  END IF;
END $$;

-- ── S5 · le super-admin n'écrit pas ────────────────────────────────────────
-- La policy est en lecture seule. Les droits de table d'`authenticated`
-- (INSERT/UPDATE/DELETE) existaient avant ce lot ; c'est la RLS, sans aucune
-- policy d'écriture, qui refuse — et doit continuer de refuser.
DO $$
DECLARE v_err text; v_n int; v_avant text; v_apres text;
BEGIN
  SELECT string_agg(user_id || movement || unit || total_reps, ',' ORDER BY user_id, movement, unit)
    INTO v_avant FROM public.user_movement_stats;

  PERFORM set_config('request.jwt.claim.sub',  '00000000-0000-4000-a500-000000000001', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);

  v_err := NULL;
  BEGIN
    INSERT INTO public.user_movement_stats (user_id, movement, unit, total_reps)
    VALUES ('00000000-0000-4000-a500-000000000012', 'deadlift', 'reps', 5000);
  EXCEPTION WHEN others THEN v_err := SQLERRM;
  END;
  IF v_err IS NULL THEN
    PERFORM set_config('role', 'none', true);
    RAISE EXCEPTION 'S5a : le super-admin a pu insérer un cumul';
  END IF;

  UPDATE public.user_movement_stats SET total_reps = 999999;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN
    PERFORM set_config('role', 'none', true);
    RAISE EXCEPTION 'S5b : le super-admin a modifié % cumul(s)', v_n;
  END IF;

  DELETE FROM public.user_movement_stats;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'S5c : le super-admin a supprimé % cumul(s)', v_n;
  END IF;

  SELECT string_agg(user_id || movement || unit || total_reps, ',' ORDER BY user_id, movement, unit)
    INTO v_apres FROM public.user_movement_stats;
  IF v_apres IS DISTINCT FROM v_avant THEN
    RAISE EXCEPTION 'S5d : les cumuls ont changé sous le super-admin';
  END IF;
END $$;

-- ── S6 · la forme des policies : une lecture de plus, aucune écriture ──────
-- La condition est comparée sans le préfixe de schéma : Postgres restitue
-- `auth.uid()` en `uid()` selon le `search_path` de la session, la prod et la
-- base de rejeu ne l'écrivent pas pareil. Le reste est comparé tel quel.
DO $$
DECLARE v_lecture text; v_ecriture int;
BEGIN
  SELECT string_agg(policyname || ' ' || permissive || ' ' || roles::text || ' '
                    || regexp_replace(qual, '\m(auth|public)\.', '', 'g'), ' ; ' ORDER BY policyname)
    INTO v_lecture
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_movement_stats' AND cmd = 'SELECT';
  IF v_lecture IS DISTINCT FROM
     'movement_stats_own_read PERMISSIVE {public} (user_id = uid()) ; '
     'user_movement_stats_superadmin_read PERMISSIVE {public} is_super_admin()' THEN
    RAISE EXCEPTION 'S6a : policies de lecture inattendues — %', v_lecture;
  END IF;
  SELECT count(*) INTO v_ecriture
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_movement_stats' AND cmd <> 'SELECT';
  IF v_ecriture <> 0 THEN
    RAISE EXCEPTION 'S6b : % policy(s) autre(s) que de lecture sur user_movement_stats', v_ecriture;
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'user_movement_stats_superadmin : S1…S6 OK'; END $$;

ROLLBACK;
