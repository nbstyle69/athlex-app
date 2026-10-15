-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270159000000_acces_demo_reel_reporte.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test le rejoue dans sa propre transaction).
--
-- Autonome : ne lit pas internal.acces_demo_sauvegarde. Retrouve le membre réel
-- par le critère de 20270157 (adhésion au comptoir d'AthleX Fitness : membre,
-- active, sans abonnement Stripe, abonnement actif, en essai ou impayé ; ni
-- compte de démo, ni compte du journal du seed, ni formule « Accès démo »),
-- sans fin d'accès. Exactement une adhésion attendue, sinon exception et rien
-- n'est écrit. Lui repose la fin d'accès du 2026-11-14, puis retire la colonne
-- `corrigee_par` ajoutée à la sauvegarde. Joué sous un rôle serveur.
-- ═════════════════════════════════════════════════════════════════════════════

DO $retour$
DECLARE
  c_box constant uuid := 'd3d0b0a0-0000-4000-a000-000000000001';
  c_fin constant date := '2026-11-14';
  v_n   int;
  v_id  uuid;
BEGIN
  DROP TABLE IF EXISTS acces_demo_reel_seed;
  CREATE TEMP TABLE acces_demo_reel_seed (member_id uuid PRIMARY KEY) ON COMMIT DROP;
  IF to_regclass('public._demo_seed_log') IS NOT NULL THEN
    EXECUTE $q$INSERT INTO acces_demo_reel_seed SELECT DISTINCT row_id::uuid FROM public._demo_seed_log WHERE table_name = 'auth.users'$q$;
  END IF;

  SELECT count(*), min(bm.id::text)::uuid INTO v_n, v_id
    FROM public.box_members bm
    JOIN auth.users u ON u.id = bm.member_id
   WHERE bm.box_id = c_box
     AND bm.role = 'member'
     AND bm.status = 'active'
     AND bm.stripe_subscription_id IS NULL
     AND bm.subscription_status IN ('active', 'trialing', 'past_due')
     AND bm.cash_access_until IS NULL
     AND lower(u.email) NOT LIKE '%@demo.athlexapp.eu'
     AND bm.member_id NOT IN (SELECT s.member_id FROM acces_demo_reel_seed s)
     AND bm.plan_id IS DISTINCT FROM (SELECT mp.id FROM public.membership_plans mp WHERE mp.box_id = c_box AND mp.name = 'Accès démo');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ACCES_DEMO_REEL_RETOUR: % adhésion(s) correspondent (attendu 1) : rien n''est écrit', v_n;
  END IF;

  UPDATE public.box_members SET cash_access_until = c_fin WHERE id = v_id AND cash_access_until IS NULL;

  IF to_regclass('internal.acces_demo_sauvegarde') IS NOT NULL THEN
    ALTER TABLE internal.acces_demo_sauvegarde DROP COLUMN IF EXISTS corrigee_par;
  END IF;
END $retour$;
