-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR de données : formule « Accès démo »
-- (migration 20270157)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (la migration et son retour arrière sont rejoués par \i).
-- Décor : la box AthleX Fitness (identifiant du seed) avec 146 comptes de démo
-- au comptoir, le reviewer (compte du journal du seed), un membre réel, et ce
-- qui ne doit PAS bouger : le gérant et un coach du seed, un compte du seed
-- membre au comptoir mais coach ailleurs, un membre actif sans
-- subscription_status, et une autre box avec son membre au comptoir.
--   A0  sur ce décor, rien encore : migration rejouée par la CI sans la box ;
--   A1  garde-fou : un compte de démo de moins → exception, rien d'écrit ;
--   A2  migration : formule « Accès démo » (0 €, abonnement, inactive, sans
--       prix Stripe) ; démo et reviewer dessus ; réel daté à J+30 (Paris),
--       formule inchangée ; sauvegarde d'avant ;
--   A3  rien d'autre ne bouge (empreintes des autres lignes, autre box) ;
--   A4  aucune notification, aucun avis, aucune alerte, aucun groupe touché ;
--   A5  la formule n'est dans aucune liste de vente ; changement de formule
--       refusé ; les membres démo gardent leur formule (membre_a_formule) ;
--   A6  expirer_acces_comptoir et filer_avis_fin_acces ne touchent aucun compte
--       « Accès démo », même daté ;
--   A7  rejouée, la migration ne change rien (sauvegarde et date intactes) ;
--   R   retour arrière : état d'avant à l'empreinte près, formule et
--       sauvegarde supprimées.
-- Mutations : jouées localement sur la migration et le retour arrière (liste
-- et résultat dans la PR) ; chacune fait échouer ce fichier.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Paiements au comptoir : formule Accès démo'

BEGIN;
SET LOCAL search_path = "$user", public, extensions;

-- Journal du seed (présent en prod, absent du rejeu).
CREATE TABLE IF NOT EXISTS public._demo_seed_log (id bigserial PRIMARY KEY, table_name text, row_id text, seeded_at timestamptz DEFAULT now());

CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a9d7-' || lpad(n::text, 12, '0'))::uuid $$;
-- 1..146 : démo ; 900001 reviewer ; 900002 gérant (seed) ; 900003 coach (seed) ;
-- 900004 compte du seed membre au comptoir mais coach dans B ; 900005 réel ;
-- 900006 membre actif sans subscription_status ; 900007 membre au comptoir de B ;
-- 900008 gérant de B ; 900009 coach d'AthleX Fitness au statut actif ; 900010
-- abonné Stripe ; 900011 membre inactif au statut actif.
INSERT INTO auth.users (id, email)
SELECT pg_temp.u(n), CASE WHEN n <= 146 THEN 'cad-' || n || '@demo.athlexapp.eu' ELSE 'cad-' || n || '@test.invalid' END
  FROM (SELECT generate_series(1, 146) UNION ALL SELECT unnest(ARRAY[900001, 900002, 900003, 900004, 900005, 900006, 900007, 900008, 900009, 900010, 900011])) v(n);
INSERT INTO public.profiles (id, email, username)
SELECT id, email, 'cad_' || right(id::text, 6) FROM auth.users WHERE id::text LIKE '00000000-0000-4000-a9d7-%';
INSERT INTO public._demo_seed_log (table_name, row_id)
SELECT 'auth.users', pg_temp.u(n)::text
  FROM (SELECT generate_series(1, 146) UNION ALL SELECT unnest(ARRAY[900001, 900002, 900003, 900004])) v(n);
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('d3d0b0a0-0000-4000-a000-000000000001', 'AthleX Fitness (test)', 'CADAF', pg_temp.u(900002)),
  ('00000000-0000-4000-b9d7-000000000002', 'Autre box (test)', 'CADB', pg_temp.u(900008));
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active, stripe_price_id) VALUES
  ('00000000-0000-4000-c9d7-0000000000a1', 'd3d0b0a0-0000-4000-a000-000000000001', 'Mensuel 59', 5900, 'subscription', true, NULL),
  ('00000000-0000-4000-c9d7-0000000000a2', 'd3d0b0a0-0000-4000-a000-000000000001', 'Mensuel 89', 8900, 'subscription', true, 'price_cad_a2'),
  ('00000000-0000-4000-c9d7-0000000000a3', 'd3d0b0a0-0000-4000-a000-000000000001', 'Essai', 0, 'trial', true, NULL),
  ('00000000-0000-4000-c9d7-0000000000b1', '00000000-0000-4000-b9d7-000000000002', 'Mensuel B', 4000, 'subscription', true, NULL);
-- (box, membre, rôle, formule, statut d'abonnement)
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, payment_method_type)
SELECT CASE WHEN b = 'B' THEN '00000000-0000-4000-b9d7-000000000002'::uuid ELSE 'd3d0b0a0-0000-4000-a000-000000000001'::uuid END,
       pg_temp.u(m), r, 'active',
       CASE WHEN p IS NULL THEN NULL ELSE ('00000000-0000-4000-c9d7-0000000000' || p)::uuid END, ss,
       CASE WHEN r = 'member' THEN 'cash' END
  FROM (SELECT 'A', n, 'member', CASE WHEN n % 2 = 0 THEN 'a1' ELSE 'a2' END, 'active' FROM generate_series(1, 146) n
        UNION ALL VALUES ('A', 900001, 'member', 'a1', 'active'),
                         ('A', 900002, 'owner',  NULL, NULL),
                         ('A', 900003, 'coach',  NULL, NULL),
                         ('A', 900004, 'member', 'a1', 'active'),
                         ('B', 900004, 'coach',  NULL, NULL),
                         ('A', 900005, 'member', 'a2', 'active'),
                         ('A', 900006, 'member', 'a1', NULL),
                         ('B', 900007, 'member', 'b1', 'active'),
                         ('A', 900009, 'coach',  'a1', 'active'),
                         ('A', 900010, 'member', 'a2', 'active'),
                         ('A', 900011, 'member', 'a1', 'active')) v(b, m, r, p, ss);
UPDATE public.box_members SET stripe_subscription_id = 'sub_cad', payment_method_type = 'card' WHERE member_id = pg_temp.u(900010);
UPDATE public.box_members SET status = 'inactive' WHERE member_id = pg_temp.u(900011);
-- Des comptes de démo déjà datés (échus ou proches) : la formule à 0 € doit les protéger.
UPDATE public.box_members SET cash_access_until = (now() AT TIME ZONE 'Europe/Paris')::date - 1
 WHERE member_id IN (SELECT pg_temp.u(n) FROM generate_series(1, 5) n);
UPDATE public.box_members SET cash_access_until = (now() AT TIME ZONE 'Europe/Paris')::date + 3
 WHERE member_id IN (SELECT pg_temp.u(n) FROM generate_series(6, 10) n);
-- Le membre de démo 11 a une réservation à venir : elle doit rester.
INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time, max_capacity)
VALUES ('00000000-0000-4000-e9d7-000000000001', 'd3d0b0a0-0000-4000-a000-000000000001', 'Cours test', (now() AT TIME ZONE 'Europe/Paris')::date + 2, '18:00', '19:00', 10);
INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status)
VALUES ('00000000-0000-4000-e9d7-000000000001', pg_temp.u(11), 'd3d0b0a0-0000-4000-a000-000000000001', 'confirmed');
INSERT INTO public.message_groups (box_id, name, members)
VALUES ('d3d0b0a0-0000-4000-a000-000000000001', 'Groupe test', ARRAY[pg_temp.u(1), pg_temp.u(900005)]);

-- Empreintes et comptages d'avant.
CREATE FUNCTION pg_temp.empreinte_bm(p_filtre text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  EXECUTE format('SELECT md5(coalesce(string_agg(bm::text, E''\n'' ORDER BY bm.id), '''')) FROM public.box_members bm WHERE %s', p_filtre) INTO v;
  RETURN v;
END $$;
CREATE FUNCTION pg_temp.files() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (SELECT count(*) FROM public.box_manager_notifications) || '|' || (SELECT count(*) FROM public.box_member_access_notices)
      || '|' || (SELECT count(*) FROM public.box_member_alerts) || '|' || (SELECT count(*) FROM public.box_plan_change_requests)
      || '|' || (SELECT count(*) FROM public.box_cash_payments) || '|' || (SELECT count(*) FROM public.class_reservations)
      || '|' || (SELECT md5(coalesce(string_agg(g::text, ',' ORDER BY g.id), '')) FROM public.message_groups g);
$$;
CREATE TEMP TABLE cad_avant AS SELECT
  pg_temp.empreinte_bm('true') AS tout,
  pg_temp.empreinte_bm('bm.member_id NOT IN (SELECT pg_temp.u(n) FROM generate_series(1, 146) n) AND bm.member_id NOT IN (pg_temp.u(900001), pg_temp.u(900005))') AS autres,
  pg_temp.files() AS files,
  (SELECT md5(coalesce(string_agg(mp::text, E'\n' ORDER BY mp.id), '')) FROM public.membership_plans mp) AS formules;

-- ── A0 : la migration rejouée par la CI (sans la box) n'a rien écrit ──────────
DO $t$
BEGIN
  IF to_regclass('internal.acces_demo_sauvegarde') IS NULL THEN RAISE EXCEPTION 'A0 : table de sauvegarde absente'; END IF;
  IF EXISTS (SELECT 1 FROM internal.acces_demo_sauvegarde)
     OR EXISTS (SELECT 1 FROM public.membership_plans WHERE name = 'Accès démo') THEN
    RAISE EXCEPTION 'A0 : la migration a écrit sans la box';
  END IF;
  IF has_table_privilege('authenticated', 'internal.acces_demo_sauvegarde', 'SELECT')
     OR has_table_privilege('service_role', 'internal.acces_demo_sauvegarde', 'SELECT')
     OR has_table_privilege('anon', 'internal.acces_demo_sauvegarde', 'SELECT') THEN
    RAISE EXCEPTION 'A0 : sauvegarde lisible par un client';
  END IF;
END $t$;

-- ── A1 : garde-fou, un compte de démo de moins ────────────────────────────────
SAVEPOINT garde;
UPDATE public.box_members SET status = 'inactive' WHERE member_id = pg_temp.u(146);
\set ON_ERROR_STOP off
\i supabase/migrations/20270157000000_acces_demo.sql
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT garde;
SELECT CASE WHEN :'LAST_ERROR_MESSAGE' LIKE 'ACCES_DEMO_COMPTES: démo 145, reviewer 1, réel 1%' THEN 'A1 OK'
            ELSE 'A1 : garde-fou absent (' || :'LAST_ERROR_MESSAGE' || ')' END AS a1 \gset
SELECT CASE WHEN :'a1' = 'A1 OK' THEN 1 ELSE 1 / 0 END AS "A1 garde-fou";
DO $t$
BEGIN
  IF EXISTS (SELECT 1 FROM public.membership_plans WHERE name = 'Accès démo')
     OR pg_temp.empreinte_bm('true') <> (SELECT tout FROM cad_avant) THEN
    RAISE EXCEPTION 'A1 : le garde-fou a laissé une écriture';
  END IF;
END $t$;

-- ── A2 : la migration ────────────────────────────────────────────────────────
\i supabase/migrations/20270157000000_acces_demo.sql
DO $t$
DECLARE
  p public.membership_plans;
  t date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  SELECT * INTO p FROM public.membership_plans WHERE name = 'Accès démo';
  IF p.id IS NULL OR p.box_id <> 'd3d0b0a0-0000-4000-a000-000000000001' OR p.price_cents <> 0 OR p.plan_type <> 'subscription'
     OR p.is_active OR p.stripe_price_id IS NOT NULL OR p.stripe_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'A2 : formule « Accès démo » inattendue (%)', p;
  END IF;
  IF (SELECT count(*) FROM public.box_members WHERE plan_id = p.id) <> 147
     OR EXISTS (SELECT 1 FROM public.box_members WHERE plan_id = p.id
                 AND member_id NOT IN (SELECT pg_temp.u(n) FROM generate_series(1, 146) n) AND member_id <> pg_temp.u(900001)) THEN
    RAISE EXCEPTION 'A2 : démo et reviewer ne sont pas exactement les 147 adhésions sur la formule';
  END IF;
  IF (SELECT cash_access_until FROM public.box_members WHERE member_id = pg_temp.u(900005)) IS DISTINCT FROM t + 30
     OR (SELECT right(plan_id::text, 2) FROM public.box_members WHERE member_id = pg_temp.u(900005)) <> 'a2' THEN
    RAISE EXCEPTION 'A2 : membre réel (fin %)', (SELECT cash_access_until FROM public.box_members WHERE member_id = pg_temp.u(900005));
  END IF;
  IF (SELECT string_agg(categorie || ':' || n, ',' ORDER BY categorie)
        FROM (SELECT categorie, count(*) n FROM internal.acces_demo_sauvegarde GROUP BY 1) s) <> 'demo:146,reel:1,reviewer:1'
     OR EXISTS (SELECT 1 FROM internal.acces_demo_sauvegarde s JOIN public.box_members bm ON bm.id = s.box_member_id
                 WHERE s.categorie <> 'reel' AND right(s.plan_id_avant::text, 2) NOT IN ('a1', 'a2')) THEN
    RAISE EXCEPTION 'A2 : sauvegarde d''avant';
  END IF;
  -- ── A3 : rien d'autre ne bouge ──
  IF pg_temp.empreinte_bm('bm.member_id NOT IN (SELECT pg_temp.u(n) FROM generate_series(1, 146) n) AND bm.member_id NOT IN (pg_temp.u(900001), pg_temp.u(900005))')
     <> (SELECT autres FROM cad_avant) THEN
    RAISE EXCEPTION 'A3 : une autre adhésion a bougé (gérant, coach, staff du seed, sans statut, autre box)';
  END IF;
  -- ── A4 : aucune notification, aucun avis, aucune alerte, aucun groupe touché ──
  IF pg_temp.files() <> (SELECT files FROM cad_avant) THEN
    RAISE EXCEPTION 'A4 : une file a bougé (% au lieu de %)', pg_temp.files(), (SELECT files FROM cad_avant);
  END IF;
END $t$;

-- ── A5 : jamais vendue, toujours une formule pour ses membres ─────────────────
DO $t$
DECLARE
  p uuid := (SELECT id FROM public.membership_plans WHERE name = 'Accès démo');
BEGIN
  -- /box/[slug] : actives et (payantes ou Essai) ; invitation : actives ;
  -- paiement en ligne : active et payante.
  IF EXISTS (SELECT 1 FROM public.membership_plans WHERE id = p AND is_active AND (price_cents > 0 OR plan_type = 'trial'))
     OR EXISTS (SELECT 1 FROM public.membership_plans WHERE id = p AND is_active)
     OR EXISTS (SELECT 1 FROM public.membership_plans WHERE id = p AND is_active AND price_cents > 0) THEN
    RAISE EXCEPTION 'A5 : « Accès démo » apparaît dans une liste de vente';
  END IF;
  IF internal.refus_changement_formule(pg_temp.u(900005), 'd3d0b0a0-0000-4000-a000-000000000001', p) IS NULL THEN
    RAISE EXCEPTION 'A5 : changement vers « Accès démo » accepté';
  END IF;
  IF NOT internal.membre_a_formule('d3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(1))
     OR NOT internal.membre_a_formule('d3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(900001)) THEN
    RAISE EXCEPTION 'A5 : un compte « Accès démo » a perdu sa formule';
  END IF;
END $t$;

-- ── A6 : coupure et avis ne touchent aucun compte « Accès démo » ──────────────
DO $t$
DECLARE
  n_coupes int;
  n_avis int;
BEGIN
  n_coupes := internal.expirer_acces_comptoir();
  n_avis := internal.filer_avis_fin_acces();
  IF EXISTS (SELECT 1 FROM public.box_members WHERE member_id IN (SELECT pg_temp.u(n) FROM generate_series(1, 146) n) AND subscription_status <> 'active')
     OR EXISTS (SELECT 1 FROM public.box_member_access_notices WHERE member_id IN (SELECT pg_temp.u(n) FROM generate_series(1, 146) n))
     OR (SELECT count(*) FROM public.class_reservations WHERE member_id = pg_temp.u(11)) <> 1 THEN
    RAISE EXCEPTION 'A6 : la coupure ou les avis touchent un compte « Accès démo » (coupés %, avis %)', n_coupes, n_avis;
  END IF;
  IF n_coupes <> 0 OR n_avis <> 0 THEN RAISE EXCEPTION 'A6 : coupés %, avis % (attendu 0, 0)', n_coupes, n_avis; END IF;
END $t$;

-- ── A7 : rejouée, rien ne change ──────────────────────────────────────────────
-- Entre-temps, la fin d'accès du réel a été prolongée (nouvel encaissement) :
-- un rejeu ne doit pas la ramener à J+30.
UPDATE public.box_members SET cash_access_until = (now() AT TIME ZONE 'Europe/Paris')::date + 40 WHERE member_id = pg_temp.u(900005);
CREATE TEMP TABLE cad_apres AS SELECT pg_temp.empreinte_bm('true') AS tout,
  (SELECT md5(string_agg(s::text, E'\n' ORDER BY s.box_member_id)) FROM (SELECT box_member_id, categorie, plan_id_avant, cash_access_until_avant FROM internal.acces_demo_sauvegarde) s) AS sauvegarde;
\i supabase/migrations/20270157000000_acces_demo.sql
DO $t$
BEGIN
  IF pg_temp.empreinte_bm('true') <> (SELECT tout FROM cad_apres)
     OR (SELECT md5(string_agg(s::text, E'\n' ORDER BY s.box_member_id)) FROM (SELECT box_member_id, categorie, plan_id_avant, cash_access_until_avant FROM internal.acces_demo_sauvegarde) s)
        <> (SELECT sauvegarde FROM cad_apres)
     OR (SELECT count(*) FROM public.membership_plans WHERE name = 'Accès démo') <> 1 THEN
    RAISE EXCEPTION 'A7 : rejouée, la migration a changé quelque chose';
  END IF;
END $t$;

-- ── R : retour arrière ────────────────────────────────────────────────────────
\i supabase/retours/20270157000000_acces_demo.sql
DO $t$
BEGIN
  IF pg_temp.empreinte_bm('true') <> (SELECT tout FROM cad_avant) THEN
    RAISE EXCEPTION 'R : box_members n''est pas revenue à l''identique';
  END IF;
  IF (SELECT md5(coalesce(string_agg(mp::text, E'\n' ORDER BY mp.id), '')) FROM public.membership_plans mp) <> (SELECT formules FROM cad_avant) THEN
    RAISE EXCEPTION 'R : formules différentes d''avant';
  END IF;
  IF to_regclass('internal.acces_demo_sauvegarde') IS NOT NULL THEN RAISE EXCEPTION 'R : sauvegarde restante'; END IF;
END $t$;

ROLLBACK;
\echo '    A0 à A7 et R OK'
