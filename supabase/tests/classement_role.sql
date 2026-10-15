-- ═════════════════════════════════════════════════════════════════════════════
-- Classement global : global_leaderboard rend aussi `role` (#565, migration
-- 20270160)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (la migration et son retour arrière sont rejoués par \i).
--   D0  définitions figées : global_leaderboard (md5, 8 colonnes dont role),
--       global_elo_rank inchangée ; EXECUTE à authenticated et service_role,
--       ni à anon ni à PUBLIC ;
--   D1  appel authentifié : `role` rendu ; aucun filtre de rôle dans la RPC
--       (gérant, admin, athlète présents) ; démo toujours exclus ;
--   C8  la RPC ne rend que des colonnes et valeurs que le membre lit en direct
--       sur profiles, `role` compris ;
--   G   garde de dérive : une autre définition en place → exception, rien
--       d'écrit ;
--   R   retour arrière : définition de 20270159 (md5 relevé en prod), droits
--       reposés, RPC joignable ; puis la migration rejouée depuis cet état
--       (le chemin de la prod) et rejouée une seconde fois : même définition,
--       mêmes droits.
-- Mutations : jouées localement (liste et résultat dans la PR) ; chacune fait
-- échouer ce fichier. Tout est joué dans une transaction annulée.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Classement global : role rendu par global_leaderboard'

BEGIN;
SET LOCAL search_path = "$user", public, extensions;

-- Aucun droit par défaut sur les fonctions créées ici : seuls comptent les
-- GRANT explicites de la migration et du retour. Sans cela, le rejeu (sous
-- supabase_admin, dont les privilèges par défaut ouvrent EXECUTE à
-- authenticated) masquerait un DROP sans GRANT reposé, que la prod (sous
-- postgres, défaut : service_role seul) paierait d'une RPC injoignable.
-- Annulé avec le reste.
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;

CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a160-' || lpad(n::text, 12, '0'))::uuid $$;

-- OID relu par nom à chaque appel : un littéral '…'::regprocedure serait figé
-- dans le plan mis en cache et viserait encore la fonction supprimée par DROP.
CREATE FUNCTION pg_temp.f() RETURNS oid LANGUAGE plpgsql VOLATILE AS $$
DECLARE v oid;
BEGIN
  EXECUTE 'SELECT p.oid FROM pg_proc p WHERE p.proname = ''global_leaderboard'' AND p.pronamespace = ''public''::regnamespace' INTO v;
  IF v IS NULL THEN RAISE EXCEPTION 'global_leaderboard absente'; END IF;
  RETURN v;
END $$;

-- État de la fonction : définition, sortie, droits.
CREATE FUNCTION pg_temp.etat(p_md5 text, p_sortie text, p_etape text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  f oid := pg_temp.f();
BEGIN
  IF md5(pg_get_functiondef(f)) IS DISTINCT FROM p_md5 THEN
    RAISE EXCEPTION '% : définition de global_leaderboard inattendue (md5 %, attendu %)', p_etape, md5(pg_get_functiondef(f)), p_md5;
  END IF;
  IF pg_get_function_result(f) IS DISTINCT FROM p_sortie THEN
    RAISE EXCEPTION '% : sortie %', p_etape, pg_get_function_result(f);
  END IF;
  IF has_function_privilege('authenticated', f, 'EXECUTE') IS NOT TRUE OR has_function_privilege('service_role', f, 'EXECUTE') IS NOT TRUE THEN
    RAISE EXCEPTION '% : RPC injoignable par authenticated ou service_role (droits perdus au DROP ?)', p_etape;
  END IF;
  IF has_function_privilege('anon', f, 'EXECUTE') IS NOT FALSE
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = f AND a.grantee = 0) THEN
    RAISE EXCEPTION '% : RPC ouverte à anon ou à PUBLIC', p_etape;
  END IF;
END $$;

-- ── D0 : définitions figées ───────────────────────────────────────────────────
SELECT pg_temp.etat('275c3f85af23ea5fa3291b9a391850d5',
  'TABLE(id uuid, username text, level text, elo integer, wins integer, total_matches integer, avatar_url text, role text)', 'D0');
DO $t$
BEGIN
  IF md5(pg_get_functiondef('public.global_elo_rank(integer)'::regprocedure)) IS DISTINCT FROM 'cb211c6addf971fe1bceb3f8f5f57720' THEN
    RAISE EXCEPTION 'D0 : global_elo_rank a changé';
  END IF;
END $t$;

-- ── Décor ─────────────────────────────────────────────────────────────────────
-- 1 démo (ELO le plus haut), 2 gérant, 3 admin, 4 athlète, 5 membre (appelant).
INSERT INTO auth.users (id, email)
SELECT pg_temp.u(n), 'cr-' || n || CASE WHEN n = 1 THEN '@demo.athlexapp.eu' ELSE '@test.invalid' END FROM generate_series(1, 5) n;
INSERT INTO public.profiles (id, email, username, elo, role)
VALUES (pg_temp.u(1), 'cr-1@demo.athlexapp.eu', 'cr_demo',    9905, 'member'),
       (pg_temp.u(2), 'cr-2@test.invalid',      'cr_gerant',  9904, 'box_owner'),
       (pg_temp.u(3), 'cr-3@test.invalid',      'cr_admin',   9903, 'admin'),
       (pg_temp.u(4), 'cr-4@test.invalid',      'cr_athlete', 9902, 'athlete'),
       (pg_temp.u(5), 'cr-5@test.invalid',      'cr_membre',  9901, 'member');
INSERT INTO internal.demo_accounts (user_id) VALUES (pg_temp.u(1));

-- ── D1 et C8 : appel authentifié ──────────────────────────────────────────────
CREATE FUNCTION pg_temp.appel(p_etape text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  f oid := pg_temp.f();
  v_cols text;
  v_privees text;
  v_roles text;
  v_demo int;
  v_ecarts int;
BEGIN
  SELECT string_agg(quote_ident(u.a), ', ' ORDER BY u.o),
         string_agg(u.a, ', ' ORDER BY u.o) FILTER (WHERE NOT has_column_privilege('authenticated', 'public.profiles', u.a, 'SELECT'))
    INTO v_cols, v_privees
    FROM pg_proc p, unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS u(a, m, o)
   WHERE p.oid = f AND u.m = 't';
  IF v_privees IS NOT NULL THEN
    RAISE EXCEPTION '% (C8) : colonne(s) rendue(s) que authenticated ne lit pas sur profiles : %', p_etape, v_privees;
  END IF;
  IF v_cols IS NULL OR v_cols NOT LIKE '%, role' THEN RAISE EXCEPTION '% (C8) : role absent des colonnes rendues (%)', p_etape, v_cols; END IF;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a160-000000000005', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SELECT string_agg(g.username || '':'' || g.role, '','' ORDER BY g.elo DESC) FROM public.global_leaderboard(4, 0) g'
    INTO v_roles;
  EXECUTE 'SELECT count(*) FROM public.global_leaderboard(100, 0) g WHERE g.username = ''cr_demo''' INTO v_demo;
  EXECUTE format('SELECT count(*) FROM (SELECT * FROM public.global_leaderboard(100, 0) EXCEPT SELECT %s FROM public.profiles) x', v_cols)
    INTO v_ecarts;
  RESET ROLE;
  IF v_ecarts IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION '% (C8) : % ligne(s) de la RPC différentes de ce que le membre lit en direct sur profiles', p_etape, v_ecarts;
  END IF;
  IF v_roles IS DISTINCT FROM 'cr_gerant:box_owner,cr_admin:admin,cr_athlete:athlete,cr_membre:member' THEN
    RAISE EXCEPTION '% (D1) : tête du classement et rôles inattendus : %', p_etape, v_roles;
  END IF;
  IF v_demo IS DISTINCT FROM 0 THEN RAISE EXCEPTION '% (D1) : compte de démo dans le classement', p_etape; END IF;
END $$;
SELECT pg_temp.appel('D1');

-- ── G : garde de dérive ───────────────────────────────────────────────────────
SAVEPOINT derive;
CREATE OR REPLACE FUNCTION public.global_leaderboard(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, username text, level text, elo integer, wins integer, total_matches integer, avatar_url text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.username, p.level, p.elo, p.wins, p.total_matches, p.avatar_url, p.role FROM public.profiles p LIMIT 1;
$$;
-- La définition est relue AVANT le retour au point de sauvegarde : transaction
-- interrompue par la garde, la lecture échoue et g_md5 reste « interrompue » ;
-- sans garde, la migration passe et g_md5 vaut la nouvelle définition.
\set g_md5 interrompue
\set ON_ERROR_STOP off
\i supabase/migrations/20270160000000_classement_role.sql
SELECT md5(pg_get_functiondef('public.global_leaderboard(integer, integer)'::regprocedure)) AS g_md5 \gset
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT derive;
SELECT CASE WHEN :'g_md5' = 'interrompue' THEN 1 ELSE 1 / 0 END AS "G garde de dérive (migration interrompue)";

-- ── R : retour arrière, puis la migration depuis l'état de la prod ────────────
\i supabase/retours/20270160000000_classement_role.sql
SELECT pg_temp.etat('82ec38f7b325da5dd435ae43dfb0b3a6',
  'TABLE(id uuid, username text, level text, elo integer, wins integer, total_matches integer, avatar_url text)', 'R retour');
DO $t$
DECLARE n int;
BEGIN
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.global_leaderboard(100, 0) g WHERE g.username LIKE 'cr\_%';
  RESET ROLE;
  IF n <> 4 THEN RAISE EXCEPTION 'R retour : % ligne(s) du décor (attendu 4)', n; END IF;
END $t$;

\i supabase/migrations/20270160000000_classement_role.sql
SELECT pg_temp.etat('275c3f85af23ea5fa3291b9a391850d5',
  'TABLE(id uuid, username text, level text, elo integer, wins integer, total_matches integer, avatar_url text, role text)', 'R migration');
SELECT pg_temp.appel('R migration');
\i supabase/migrations/20270160000000_classement_role.sql
SELECT pg_temp.etat('275c3f85af23ea5fa3291b9a391850d5',
  'TABLE(id uuid, username text, level text, elo integer, wins integer, total_matches integer, avatar_url text, role text)', 'R rejeu');

ROLLBACK;
\echo '    D0, D1, C8, G et R OK'
