-- ═════════════════════════════════════════════════════════════════════════════
-- Classement global sans les comptes de démo (#565, migration 20270159)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (la migration et son retour arrière sont rejoués par \i).
-- Décor : AthleX Fitness (identifiant du seed) avec 146 comptes de démo et le
-- reviewer dans la sauvegarde de 20270157, 3 coachs de démo, le gérant, et
-- trois comptes ordinaires (dont le membre réel, aussi dans la sauvegarde).
-- Les comptes de démo ont les ELO les plus hauts : sans filtre, ils occupent
-- tout le haut du classement.
--   C0  rejouée par la CI sans décor : marqueur vide, fonctions ouvertes à
--       authenticated et service_role, fermées à anon ;
--   C1  garde-fou : un coach de démo de moins → exception, rien d'écrit ;
--   C2  migration : 150 comptes inscrits ; aucun d'eux dans les 100 premiers
--       du classement global ;
--   C3  un compte ordinaire a le rang qu'il aurait les exclus retirés (liste
--       et rang mondial) ;
--   C4  un compte retiré du marqueur réapparaît aussitôt ;
--   C5  tournoi classique, poule et whiteboard, lus comme un membre connecté :
--       identiques, marqueur rempli, à ce qu'ils sont marqueur vide (master) ;
--   C6  le marqueur est illisible par authenticated ;
--   C7  aucune ligne de box_members ni de membership_plans n'a bougé ;
--   C8  un membre connecté ne reçoit de la RPC que les colonnes et valeurs
--       qu'il lit en direct sur profiles (la RPC contourne la RLS) ;
--   R   retour arrière : fonctions et marqueur supprimés, catalogue identique
--       à master (fonctions, vues, règles RLS, droits des tables de public).
-- Mutations : jouées localement sur la migration et le retour arrière (liste
-- et résultat dans la PR) ; chacune fait échouer ce fichier.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Classement global sans les comptes de démo'

BEGIN;
SET LOCAL search_path = "$user", public, extensions;

CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a565-' || lpad(n::text, 12, '0'))::uuid $$;

-- ── C0 : la migration rejouée par la CI (sans décor) ──────────────────────────
DO $t$
BEGIN
  IF to_regclass('internal.demo_accounts') IS NULL THEN RAISE EXCEPTION 'C0 : marqueur absent'; END IF;
  IF EXISTS (SELECT 1 FROM internal.demo_accounts) THEN RAISE EXCEPTION 'C0 : la migration a inscrit des comptes sans décor'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.global_leaderboard(integer, integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.global_elo_rank(integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.global_leaderboard(integer, integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.global_elo_rank(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C0 : RPC injoignable par authenticated ou service_role';
  END IF;
  IF has_function_privilege('anon', 'public.global_leaderboard(integer, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.global_elo_rank(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C0 : RPC ouverte à anon';
  END IF;
END $t$;

-- ── Décor ─────────────────────────────────────────────────────────────────────
-- 1..146 démo (membres) ; 900001 reviewer ; 900101..900103 coachs de démo ;
-- 900200 gérant ; 900301 membre réel (8600) ; 900302 (8500), 900303 (8400)
-- ordinaires hors box.
INSERT INTO auth.users (id, email)
SELECT pg_temp.u(n), CASE WHEN n <= 146 OR n BETWEEN 900101 AND 900103 THEN 'cl-' || n || '@demo.athlexapp.eu'
                          ELSE 'cl-' || n || '@test.invalid' END
  FROM (SELECT generate_series(1, 146) UNION ALL SELECT unnest(ARRAY[900001, 900101, 900102, 900103, 900200, 900301, 900302, 900303])) v(n);
INSERT INTO public.profiles (id, email, username, elo)
SELECT u.id, u.email, 'cl_' || right(u.id::text, 6),
       CASE right(u.id::text, 6)::int WHEN 900001 THEN 9500 WHEN 900101 THEN 9600 WHEN 900102 THEN 9601 WHEN 900103 THEN 9602
                                     WHEN 900200 THEN 1000 WHEN 900301 THEN 8600 WHEN 900302 THEN 8500 WHEN 900303 THEN 8400
                                     ELSE 9000 + right(u.id::text, 6)::int END
  FROM auth.users u WHERE u.id::text LIKE '00000000-0000-4000-a565-%';
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('d3d0b0a0-0000-4000-a000-000000000001', 'AthleX Fitness (test)', 'CL565', pg_temp.u(900200));
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT 'd3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(m), r, 'active'
  FROM (SELECT n, 'member' FROM generate_series(1, 146) n
        UNION ALL VALUES (900001, 'member'), (900101, 'coach'), (900102, 'coach'), (900103, 'coach'),
                         (900200, 'owner'), (900301, 'member')) v(m, r);
INSERT INTO internal.acces_demo_sauvegarde (box_member_id, categorie)
SELECT bm.id, CASE WHEN bm.member_id = pg_temp.u(900001) THEN 'reviewer' WHEN bm.member_id = pg_temp.u(900301) THEN 'reel' ELSE 'demo' END
  FROM public.box_members bm
 WHERE bm.box_id = 'd3d0b0a0-0000-4000-a000-000000000001' AND bm.role = 'member';
-- Whiteboard : ELO de box de deux démo et du membre réel.
INSERT INTO public.box_elo (member_id, box_id, elo) VALUES
  (pg_temp.u(1), 'd3d0b0a0-0000-4000-a000-000000000001', 1300),
  (pg_temp.u(900101), 'd3d0b0a0-0000-4000-a000-000000000001', 1250),
  (pg_temp.u(900301), 'd3d0b0a0-0000-4000-a000-000000000001', 1200);
-- Tournoi classique : deux démo, deux ordinaires.
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status) VALUES
  ('00000000-0000-4000-c565-000000000001', 'T565', 'rx', 'simple', 'd3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(900200), 'active');
INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
  ('00000000-0000-4000-f565-000000000001', '00000000-0000-4000-c565-000000000001', 'Fran', 'For Time');
INSERT INTO public.tournament_participants (tournament_id, athlete_id)
SELECT '00000000-0000-4000-c565-000000000001', pg_temp.u(a) FROM unnest(ARRAY[1, 900101, 900301, 900302]) a;
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
SELECT '00000000-0000-4000-c565-000000000001', '00000000-0000-4000-f565-000000000001', pg_temp.u(a), sc, 'validated'
  FROM (VALUES (1, '7:00'), (900101, '7:30'), (900301, '8:00'), (900302, '9:00')) v(a, sc);
-- Poule : une compétition inter en poules, un groupe, démo et ordinaires.
INSERT INTO public.inter_competitions (id, title, format) VALUES ('00000000-0000-4000-d565-000000000001', 'Inter 565', 'pool');
INSERT INTO public.inter_pool_groups (id, competition_id, group_name, group_index) VALUES
  ('00000000-0000-4000-e565-000000000001', '00000000-0000-4000-d565-000000000001', 'A', 0);
INSERT INTO public.inter_pool_members (group_id, athlete_id)
SELECT '00000000-0000-4000-e565-000000000001', pg_temp.u(a) FROM unnest(ARRAY[2, 900102, 900302, 900303]) a;

-- Ce qu'un membre connecté (le membre réel) lit : tournoi, poule, whiteboard.
CREATE FUNCTION pg_temp.lu_par_membre() RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a565-000000900301', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SELECT concat_ws(E'\n',
    (SELECT string_agg(s.athlete_id || ':' || s.points || '/' || s.final_rank || ':' || coalesce(p.username, '?'), ',' ORDER BY s.final_rank, s.athlete_id)
       FROM public.tournament_classique_standings('00000000-0000-4000-c565-000000000001') s
       LEFT JOIN public.profiles p ON p.id = s.athlete_id),
    (SELECT string_agg(m.athlete_id || ':' || coalesce(p.username, '?'), ',' ORDER BY m.athlete_id)
       FROM public.inter_pool_members m LEFT JOIN public.profiles p ON p.id = m.athlete_id
      WHERE m.group_id = '00000000-0000-4000-e565-000000000001'),
    (SELECT string_agg(bm.member_id || ':' || coalesce(p.username, '?') || ':' || coalesce(e.elo::text, '-'), ',' ORDER BY bm.member_id)
       FROM public.box_members bm LEFT JOIN public.profiles p ON p.id = bm.member_id
       LEFT JOIN public.box_elo e ON e.member_id = bm.member_id AND e.box_id = bm.box_id
      WHERE bm.box_id = 'd3d0b0a0-0000-4000-a000-000000000001' AND bm.status = 'active'))
    INTO v;
  RESET ROLE;
  RETURN v;
END $$;

CREATE FUNCTION pg_temp.empreinte_donnees() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (SELECT md5(string_agg(bm::text, E'\n' ORDER BY bm.id)) FROM public.box_members bm)
      || '|' || (SELECT md5(coalesce(string_agg(mp::text, E'\n' ORDER BY mp.id), '')) FROM public.membership_plans mp);
$$;
-- Catalogue : définitions et droits des fonctions (hors les deux nouvelles),
-- vues, règles RLS, droits des tables de public.
CREATE FUNCTION pg_temp.empreinte_catalogue() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (SELECT md5(string_agg(p.oid::regprocedure::text || p.prosrc || coalesce(p.proacl::text, '') || p.prosecdef::text, E'\n' ORDER BY p.oid::regprocedure::text))
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname IN ('public', 'internal') AND p.proname NOT IN ('global_leaderboard', 'global_elo_rank'))
      || '|' || (SELECT md5(string_agg(schemaname || '.' || viewname || definition, E'\n' ORDER BY schemaname, viewname)) FROM pg_views WHERE schemaname = 'public')
      || '|' || (SELECT md5(string_agg(schemaname || '.' || tablename || policyname || permissive || roles::text || cmd || coalesce(qual, '') || coalesce(with_check, ''), E'\n' ORDER BY schemaname, tablename, policyname)) FROM pg_policies)
      || '|' || (SELECT md5(string_agg(c.oid::regclass::text || coalesce(c.relacl::text, '') || c.relrowsecurity::text, E'\n' ORDER BY c.oid::regclass::text))
                   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm'));
$$;

-- Avant la migration du test (marqueur vide : ce que master rend) : données,
-- lecture du membre, catalogue.
CREATE TEMP TABLE cl_avant AS SELECT pg_temp.empreinte_donnees() AS donnees, pg_temp.lu_par_membre() AS lu,
  pg_temp.empreinte_catalogue() AS catalogue;

-- ── C1 : garde-fou, un coach de démo de moins ─────────────────────────────────
SAVEPOINT garde;
UPDATE public.box_members SET status = 'inactive' WHERE member_id = pg_temp.u(900103);
-- Le compte est lu AVANT le retour au point de sauvegarde (après, il serait
-- vide dans tous les cas) ; transaction interrompue par le garde-fou : la
-- lecture échoue et c1_ecrits reste à 0.
\set c1_ecrits 0
\set ON_ERROR_STOP off
\i supabase/migrations/20270159000000_classement_sans_demo.sql
SELECT count(*) AS c1_ecrits FROM internal.demo_accounts \gset
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT garde;
SET LOCAL cl.c1_ecrits = :'c1_ecrits';
DO $t$
BEGIN
  IF current_setting('cl.c1_ecrits')::int <> 0 THEN RAISE EXCEPTION 'C1 : le garde-fou a laissé % écriture(s)', current_setting('cl.c1_ecrits'); END IF;
  IF EXISTS (SELECT 1 FROM internal.demo_accounts) THEN RAISE EXCEPTION 'C1 : écriture restante'; END IF;
END $t$;

-- ── C2 : migration ────────────────────────────────────────────────────────────
\i supabase/migrations/20270159000000_classement_sans_demo.sql
DO $t$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM internal.demo_accounts;
  IF n <> 150 THEN RAISE EXCEPTION 'C2 : % comptes inscrits (attendu 150)', n; END IF;
  IF EXISTS (SELECT 1 FROM internal.demo_accounts WHERE user_id IN (pg_temp.u(900200), pg_temp.u(900301), pg_temp.u(900302), pg_temp.u(900303))) THEN
    RAISE EXCEPTION 'C2 : un compte ordinaire est inscrit au marqueur';
  END IF;
  -- Contre-exemple : sans filtre, les démo tiennent tout le haut.
  IF (SELECT count(*) FROM (SELECT id FROM public.profiles ORDER BY elo DESC, id LIMIT 100) t
       WHERE t.id IN (SELECT user_id FROM internal.demo_accounts)) <> 100 THEN
    RAISE EXCEPTION 'C2 : contre-exemple — le décor ne place pas les démo en tête';
  END IF;
  IF EXISTS (SELECT 1 FROM public.global_leaderboard(100, 0) g WHERE g.id IN (SELECT user_id FROM internal.demo_accounts))
     OR EXISTS (SELECT 1 FROM public.global_leaderboard(100, 50) g WHERE g.id IN (SELECT user_id FROM internal.demo_accounts)) THEN
    RAISE EXCEPTION 'C2 : un compte de démo apparaît dans le classement global';
  END IF;
END $t$;

-- ── C3 : un compte ordinaire au rang qu'il aurait les exclus retirés ──────────
DO $t$
DECLARE v_pos int; v_attendu int;
BEGIN
  SELECT count(*) + 1 INTO v_attendu FROM public.profiles p
   WHERE p.elo > 8500 AND p.id NOT IN (SELECT user_id FROM internal.demo_accounts);
  IF v_attendu <> 2 THEN RAISE EXCEPTION 'C3 : contre-exemple — rang attendu % (2 dans ce décor)', v_attendu; END IF;
  SELECT rn INTO v_pos FROM (SELECT g.id, row_number() OVER () rn FROM public.global_leaderboard(100, 0) g) t WHERE t.id = pg_temp.u(900302);
  IF v_pos IS DISTINCT FROM v_attendu THEN RAISE EXCEPTION 'C3 : place dans la liste % (attendu %)', v_pos, v_attendu; END IF;
  IF (SELECT g.id FROM public.global_leaderboard(1, 1) g) IS DISTINCT FROM pg_temp.u(900302) THEN
    RAISE EXCEPTION 'C3 : la page (1, 1) ne rend pas le deuxième';
  END IF;
  IF public.global_elo_rank(8500) <> v_attendu THEN
    RAISE EXCEPTION 'C3 : rang mondial % (attendu %)', public.global_elo_rank(8500), v_attendu;
  END IF;
  IF (SELECT count(*) FROM public.global_leaderboard(1000, 0)) > 100 THEN RAISE EXCEPTION 'C3 : plus de 100 lignes par appel'; END IF;
END $t$;

-- ── C4 : retiré du marqueur, un compte réapparaît aussitôt ────────────────────
SAVEPOINT retrait;
DELETE FROM internal.demo_accounts WHERE user_id = pg_temp.u(900103);
DO $t$
BEGIN
  IF (SELECT g.id FROM public.global_leaderboard(1, 0) g) IS DISTINCT FROM pg_temp.u(900103) THEN
    RAISE EXCEPTION 'C4 : le compte retiré du marqueur n''est pas revenu en tête';
  END IF;
  IF public.global_elo_rank(8500) <> 3 THEN RAISE EXCEPTION 'C4 : rang mondial % (attendu 3)', public.global_elo_rank(8500); END IF;
END $t$;
ROLLBACK TO SAVEPOINT retrait;

-- ── C8 : un membre ne reçoit que ce qu'il lirait en direct sur profiles ───────
-- La RPC contourne la RLS (SECURITY DEFINER) : chaque colonne qu'elle rend doit
-- être lisible par authenticated, et chaque ligne identique à ce que le membre
-- lit par une requête directe (pas de colonne privée renommée).
DO $t$
DECLARE
  v_cols text;
  v_privees text;
  v_autres int;
  v_ecarts int;
BEGIN
  SELECT string_agg(quote_ident(u.a), ', ' ORDER BY u.o),
         string_agg(u.a, ', ' ORDER BY u.o) FILTER (WHERE NOT has_column_privilege('authenticated', 'public.profiles', u.a, 'SELECT'))
    INTO v_cols, v_privees
    FROM pg_proc p, unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS u(a, m, o)
   WHERE p.oid = 'public.global_leaderboard(integer, integer)'::regprocedure AND u.m = 't';
  IF v_privees IS NOT NULL THEN
    RAISE EXCEPTION 'C8 : colonne(s) rendue(s) que authenticated ne lit pas sur profiles : %', v_privees;
  END IF;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a565-000000900302', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SELECT count(*) INTO v_autres FROM public.global_leaderboard(100, 0) g WHERE g.id <> '00000000-0000-4000-a565-000000900302';
  EXECUTE format('SELECT count(*) FROM (SELECT * FROM public.global_leaderboard(100, 0) EXCEPT SELECT %s FROM public.profiles) x', v_cols)
    INTO v_ecarts;
  RESET ROLE;
  IF v_autres = 0 THEN RAISE EXCEPTION 'C8 : contre-exemple — le membre ne reçoit aucun autre profil'; END IF;
  IF v_ecarts <> 0 THEN
    RAISE EXCEPTION 'C8 : % ligne(s) de la RPC différentes de ce que le membre lit en direct sur profiles', v_ecarts;
  END IF;
END $t$;

-- ── C6 : marqueur illisible par authenticated ─────────────────────────────────
DO $t$
DECLARE refuse boolean := false;
BEGIN
  IF has_table_privilege('authenticated', 'internal.demo_accounts', 'SELECT')
     OR has_table_privilege('anon', 'internal.demo_accounts', 'SELECT') THEN
    RAISE EXCEPTION 'C6 : marqueur lisible par un client (droit de table)';
  END IF;
  IF has_function_privilege('anon', 'public.global_leaderboard(integer, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.global_elo_rank(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'C6 : RPC ouverte à anon';
  END IF;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM 1 FROM internal.demo_accounts;
  EXCEPTION WHEN insufficient_privilege THEN refuse := true;
  END;
  RESET ROLE;
  IF NOT refuse THEN RAISE EXCEPTION 'C6 : authenticated lit le marqueur'; END IF;
END $t$;

-- ── C7 : aucune ligne de box_members ni de membership_plans n'a bougé ─────────
DO $t$
BEGIN
  IF pg_temp.empreinte_donnees() <> (SELECT donnees FROM cl_avant) THEN
    RAISE EXCEPTION 'C7 : box_members ou membership_plans modifiée par la migration';
  END IF;
END $t$;

-- ── C5 : marqueur rempli, tournoi, poule et whiteboard lus comme avant ───────
DO $t$
DECLARE v text := pg_temp.lu_par_membre();
BEGIN
  IF v IS NULL OR v NOT LIKE '%:cl_%' OR (SELECT lu FROM cl_avant) IS NULL THEN
    RAISE EXCEPTION 'C5 : contre-exemple — lecture du membre vide';
  END IF;
  IF v <> (SELECT lu FROM cl_avant) THEN
    RAISE EXCEPTION E'C5 : tournoi, poule ou whiteboard différent de master\n  avec : %\n  avant : %', v, (SELECT lu FROM cl_avant);
  END IF;
END $t$;

-- ── R : retour arrière, catalogue et lectures identiques à master ────────────
\i supabase/retours/20270159000000_classement_sans_demo.sql
DO $t$
DECLARE v text := pg_temp.lu_par_membre();
BEGIN
  IF to_regclass('internal.demo_accounts') IS NOT NULL
     OR to_regprocedure('public.global_leaderboard(integer, integer)') IS NOT NULL
     OR to_regprocedure('public.global_elo_rank(integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'R : fonction ou marqueur restant';
  END IF;
  IF v <> (SELECT lu FROM cl_avant) THEN
    RAISE EXCEPTION E'R : tournoi, poule ou whiteboard différent après retour\n  après : %\n  avant : %', v, (SELECT lu FROM cl_avant);
  END IF;
  IF pg_temp.empreinte_catalogue() <> (SELECT catalogue FROM cl_avant) THEN
    RAISE EXCEPTION 'R : catalogue différent de master (fonctions, vues, RLS ou droits de tables)';
  END IF;
  IF pg_temp.empreinte_donnees() <> (SELECT donnees FROM cl_avant) THEN
    RAISE EXCEPTION 'R : box_members ou membership_plans modifiée';
  END IF;
END $t$;

ROLLBACK;
\echo '    C0 à C8 et R OK'
