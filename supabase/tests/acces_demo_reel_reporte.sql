-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1) : membre réel reporté à la bascule Stripe live
-- (migration 20270159, correctif de 20270157)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt. Décor : celui de acces_demo.sql (AthleX Fitness, 146 démo,
-- reviewer, membre réel 900005, staff du seed, autre box), puis l'état de la
-- prod : 20270157 appliquée, réel daté au 2026-11-14.
--   B0  rejouée sans ligne « reel » (CI) : rien ; colonne ajoutée, fermée ;
--   B1  les trois conditions (date changée, avis existant, date d'avant non
--       vide) et deux lignes « reel » : exception, rien d'écrit ;
--   B2  correction : la ligne du réel revient à son empreinte d'avant 20270157
--       (md5) ; toutes les autres adhésions, la sauvegarde d'origine, les
--       formules et les files sont identiques ; seule la marque corrigee_par ;
--       ni avis ni coupure ensuite ;
--   B3  rejouée, rien ne change ;
--   R1  retour arrière ambigu (deux membres réels) : exception, rien d'écrit ;
--   R3, R4  le retour écarte un compte de démo hors « Accès démo » et un compte
--       quelconque posé sur « Accès démo » ;
--   R   retour arrière : état d'après 20270157 au md5 près, colonne retirée ;
--   R2  retour autonome : fonctionne même sans la sauvegarde.
-- Mutations : jouées localement (liste dans la PR) ; chacune fait échouer ce
-- fichier. Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Paiements au comptoir : membre réel reporté (20270159)'

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

CREATE FUNCTION pg_temp.reel() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(bm::text) FROM public.box_members bm WHERE bm.member_id = pg_temp.u(900005)
$$;
CREATE FUNCTION pg_temp.sauvegarde() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(coalesce(string_agg(s::text, E'\n' ORDER BY s.box_member_id), ''))
    FROM (SELECT box_member_id, categorie, plan_id_avant, cash_access_until_avant, sauvegarde_le FROM internal.acces_demo_sauvegarde) s
$$;
CREATE FUNCTION pg_temp.marques() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(string_agg(categorie || ':' || left(corrigee_par, 8), ',' ORDER BY categorie), '-')
    FROM internal.acces_demo_sauvegarde WHERE corrigee_par IS NOT NULL
$$;

-- ── B0 : rejouée par la CI (sauvegarde vide) : rien ; colonne fermée ──────────
DO $t$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'internal' AND table_name = 'acces_demo_sauvegarde' AND column_name = 'corrigee_par') THEN
    RAISE EXCEPTION 'B0 : colonne corrigee_par absente';
  END IF;
  IF EXISTS (SELECT 1 FROM internal.acces_demo_sauvegarde) THEN RAISE EXCEPTION 'B0 : sauvegarde non vide au rejeu'; END IF;
  IF has_table_privilege('anon', 'internal.acces_demo_sauvegarde', 'SELECT')
     OR has_table_privilege('authenticated', 'internal.acces_demo_sauvegarde', 'SELECT')
     OR has_table_privilege('service_role', 'internal.acces_demo_sauvegarde', 'SELECT')
     OR has_column_privilege('authenticated', 'internal.acces_demo_sauvegarde', 'corrigee_par', 'SELECT') THEN
    RAISE EXCEPTION 'B0 : sauvegarde lisible par un client';
  END IF;
END $t$;
\i supabase/migrations/20270159000000_acces_demo_reel_reporte.sql
DO $t$
BEGIN
  IF pg_temp.empreinte_bm('true') <> (SELECT tout FROM cad_avant) THEN RAISE EXCEPTION 'B0 : écriture sans ligne « reel »'; END IF;
END $t$;

-- État de la prod : 20270157 appliquée, réel daté au 2026-11-14.
CREATE TEMP TABLE reel_avant AS SELECT pg_temp.reel() AS reel;
\i supabase/migrations/20270157000000_acces_demo.sql
UPDATE public.box_members SET cash_access_until = '2026-11-14' WHERE member_id = pg_temp.u(900005);
CREATE TEMP TABLE prod AS SELECT
  pg_temp.empreinte_bm('true') AS tout,
  pg_temp.empreinte_bm('bm.member_id <> pg_temp.u(900005)') AS autres,
  pg_temp.sauvegarde() AS sauvegarde,
  pg_temp.files() AS files,
  (SELECT md5(coalesce(string_agg(mp::text, E'\n' ORDER BY mp.id), '')) FROM public.membership_plans mp) AS formules;

-- ── B1 : les trois conditions, chacune refuse (l'exception annule tout ; contrôle global après) ──
SAVEPOINT b1a;
UPDATE public.box_members SET cash_access_until = '2026-12-14' WHERE member_id = pg_temp.u(900005);
\set ON_ERROR_STOP off
\i supabase/migrations/20270159000000_acces_demo_reel_reporte.sql
\set err :ERROR
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT b1a;
SELECT CASE WHEN :'err' = 'true' AND :'LAST_ERROR_MESSAGE' LIKE 'ACCES_DEMO_REEL_CONDITIONS:%' THEN 1 ELSE 1 / 0 END AS "B1a date changée";

SAVEPOINT b1b;
INSERT INTO public.box_member_access_notices (box_id, member_id, box_member_id, kind, access_until)
SELECT box_id, member_id, id, 'j7', '2026-11-14' FROM public.box_members WHERE member_id = pg_temp.u(900005);
\set ON_ERROR_STOP off
\i supabase/migrations/20270159000000_acces_demo_reel_reporte.sql
\set err :ERROR
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT b1b;
SELECT CASE WHEN :'err' = 'true' AND :'LAST_ERROR_MESSAGE' LIKE 'ACCES_DEMO_REEL_CONDITIONS:%' THEN 1 ELSE 1 / 0 END AS "B1b avis existant";

SAVEPOINT b1c;
UPDATE internal.acces_demo_sauvegarde SET cash_access_until_avant = '2026-10-01' WHERE categorie = 'reel';
\set ON_ERROR_STOP off
\i supabase/migrations/20270159000000_acces_demo_reel_reporte.sql
\set err :ERROR
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT b1c;
SELECT CASE WHEN :'err' = 'true' AND :'LAST_ERROR_MESSAGE' LIKE 'ACCES_DEMO_REEL_CONDITIONS:%' THEN 1 ELSE 1 / 0 END AS "B1c date d'avant non vide";

SAVEPOINT b1d;
INSERT INTO internal.acces_demo_sauvegarde (box_member_id, categorie, plan_id_avant, cash_access_until_avant)
SELECT id, 'reel', plan_id, NULL FROM public.box_members WHERE member_id = pg_temp.u(900006);
\set ON_ERROR_STOP off
\i supabase/migrations/20270159000000_acces_demo_reel_reporte.sql
\set err :ERROR
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT b1d;
SELECT CASE WHEN :'err' = 'true' AND :'LAST_ERROR_MESSAGE' LIKE 'ACCES_DEMO_REEL_COMPTE: 2 %' THEN 1 ELSE 1 / 0 END AS "B1d deux lignes reel";

DO $t$
BEGIN
  IF pg_temp.empreinte_bm('true') <> (SELECT tout FROM prod) OR pg_temp.marques() <> '-' THEN
    RAISE EXCEPTION 'B1 : un refus a laissé une écriture';
  END IF;
END $t$;

-- ── B2 : la correction ───────────────────────────────────────────────────────
\i supabase/migrations/20270159000000_acces_demo_reel_reporte.sql
DO $t$
BEGIN
  IF pg_temp.reel() <> (SELECT reel FROM reel_avant) THEN
    RAISE EXCEPTION 'B2 : la ligne du réel n''est pas revenue à son empreinte d''avant 20270157';
  END IF;
  IF pg_temp.empreinte_bm('bm.member_id <> pg_temp.u(900005)') <> (SELECT autres FROM prod) THEN
    RAISE EXCEPTION 'B2 : une autre adhésion a bougé (démo, reviewer, staff, autre box)';
  END IF;
  IF (SELECT count(*) FROM public.box_members bm JOIN public.membership_plans mp ON mp.id = bm.plan_id WHERE mp.name = 'Accès démo') <> 147 THEN
    RAISE EXCEPTION 'B2 : démo et reviewer ne sont plus 147 sur « Accès démo »';
  END IF;
  IF pg_temp.sauvegarde() <> (SELECT sauvegarde FROM prod) OR pg_temp.marques() <> 'reel:20270159' THEN
    RAISE EXCEPTION 'B2 : sauvegarde réécrite ou marque inattendue (%)', pg_temp.marques();
  END IF;
  IF pg_temp.files() <> (SELECT files FROM prod)
     OR (SELECT md5(coalesce(string_agg(mp::text, E'\n' ORDER BY mp.id), '')) FROM public.membership_plans mp) <> (SELECT formules FROM prod) THEN
    RAISE EXCEPTION 'B2 : une file ou une formule a bougé';
  END IF;
  -- Sans date, le réel ne reçoit aucun avis et n'est jamais coupé.
  PERFORM internal.filer_avis_fin_acces();
  PERFORM internal.expirer_acces_comptoir();
  IF EXISTS (SELECT 1 FROM public.box_member_access_notices WHERE member_id = pg_temp.u(900005))
     OR (SELECT subscription_status FROM public.box_members WHERE member_id = pg_temp.u(900005)) <> 'active' THEN
    RAISE EXCEPTION 'B2 : le réel a reçu un avis ou a été coupé';
  END IF;
END $t$;

-- ── B3 : rejouée, rien ne change ──────────────────────────────────────────────
CREATE TEMP TABLE apres AS SELECT pg_temp.empreinte_bm('true') AS tout,
  (SELECT md5(coalesce(string_agg(s::text, E'\n' ORDER BY s.box_member_id), '')) FROM internal.acces_demo_sauvegarde s) AS sauvegarde;
\i supabase/migrations/20270159000000_acces_demo_reel_reporte.sql
DO $t$
BEGIN
  IF pg_temp.empreinte_bm('true') <> (SELECT tout FROM apres)
     OR (SELECT md5(coalesce(string_agg(s::text, E'\n' ORDER BY s.box_member_id), '')) FROM internal.acces_demo_sauvegarde s) <> (SELECT sauvegarde FROM apres) THEN
    RAISE EXCEPTION 'B3 : rejouée, la migration a changé quelque chose';
  END IF;
END $t$;

-- ── R1 : le retour refuse s'il trouve plus d'un membre réel ────────────────────
SAVEPOINT r1;
INSERT INTO auth.users (id, email) VALUES (pg_temp.u(900012), 'cad-900012@test.invalid');
INSERT INTO public.profiles (id, email, username) VALUES (pg_temp.u(900012), 'cad-900012@test.invalid', 'cad_900012');
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, payment_method_type)
VALUES ('d3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(900012), 'member', 'active', '00000000-0000-4000-c9d7-0000000000a1', 'active', 'cash');
\set ON_ERROR_STOP off
\i supabase/retours/20270159000000_acces_demo_reel_reporte.sql
\set err :ERROR
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT r1;
SELECT :'err' = 'true' AND :'LAST_ERROR_MESSAGE' LIKE 'ACCES_DEMO_REEL_RETOUR: 2 %'
       AND (SELECT cash_access_until FROM public.box_members WHERE member_id = pg_temp.u(900005)) IS NULL AS r1 \gset
SELECT CASE WHEN :'r1' = 't' THEN 1 ELSE 1 / 0 END AS "R1 retour ambigu refusé";

-- ── R3, R4 : le retour reconnaît le réel par le critère complet ───────────────
-- R3 : un compte de démo sorti de « Accès démo » n'est pas pris pour le réel.
SAVEPOINT r3;
UPDATE public.box_members SET plan_id = '00000000-0000-4000-c9d7-0000000000a1' WHERE member_id = pg_temp.u(146);
DELETE FROM public._demo_seed_log WHERE row_id = pg_temp.u(146)::text;  -- seule l'adresse de démo l'écarte
\i supabase/retours/20270159000000_acces_demo_reel_reporte.sql
SELECT (SELECT cash_access_until FROM public.box_members WHERE member_id = pg_temp.u(900005)) = '2026-11-14'
       AND (SELECT cash_access_until FROM public.box_members WHERE member_id = pg_temp.u(146)) IS NULL AS r3 \gset
SELECT CASE WHEN :'r3' = 't' THEN 1 ELSE 1 / 0 END AS "R3 compte de démo hors formule écarté";
ROLLBACK TO SAVEPOINT r3;
-- R4 : un compte ni démo ni seed posé sur « Accès démo » n'est pas pris pour le réel.
SAVEPOINT r4;
INSERT INTO auth.users (id, email) VALUES (pg_temp.u(900013), 'cad-900013@test.invalid');
INSERT INTO public.profiles (id, email, username) VALUES (pg_temp.u(900013), 'cad-900013@test.invalid', 'cad_900013');
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, payment_method_type)
SELECT 'd3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(900013), 'member', 'active', id, 'active', 'cash'
  FROM public.membership_plans WHERE name = 'Accès démo';
\i supabase/retours/20270159000000_acces_demo_reel_reporte.sql
SELECT (SELECT cash_access_until FROM public.box_members WHERE member_id = pg_temp.u(900005)) = '2026-11-14'
       AND (SELECT cash_access_until FROM public.box_members WHERE member_id = pg_temp.u(900013)) IS NULL AS r4 \gset
SELECT CASE WHEN :'r4' = 't' THEN 1 ELSE 1 / 0 END AS "R4 compte sur Accès démo écarté";
ROLLBACK TO SAVEPOINT r4;

-- ── R : retour arrière, sans la sauvegarde ────────────────────────────────────
SAVEPOINT r;
\i supabase/retours/20270159000000_acces_demo_reel_reporte.sql
DO $t$
BEGIN
  IF pg_temp.empreinte_bm('true') <> (SELECT tout FROM prod) THEN
    RAISE EXCEPTION 'R : box_members n''est pas revenue à l''état d''après 20270157';
  END IF;
  IF pg_temp.sauvegarde() <> (SELECT sauvegarde FROM prod) THEN RAISE EXCEPTION 'R : sauvegarde de 20270157 modifiée'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'internal' AND table_name = 'acces_demo_sauvegarde' AND column_name = 'corrigee_par') THEN
    RAISE EXCEPTION 'R : colonne corrigee_par restante';
  END IF;
END $t$;
ROLLBACK TO SAVEPOINT r;

-- Le retour ne lit pas la sauvegarde : il fonctionne même si elle a disparu.
DROP TABLE internal.acces_demo_sauvegarde;
\i supabase/retours/20270159000000_acces_demo_reel_reporte.sql
SELECT (SELECT cash_access_until FROM public.box_members WHERE member_id = pg_temp.u(900005)) = '2026-11-14'
       AND pg_temp.empreinte_bm('true') = (SELECT tout FROM prod) AS r2 \gset
SELECT CASE WHEN :'r2' = 't' THEN 1 ELSE 1 / 0 END AS "R2 retour autonome";

ROLLBACK;
\echo '    B0 à B3, R1 à R4 et R OK'
