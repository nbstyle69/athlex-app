-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — activation des comptes fictifs, après le `seed`.
--
-- Joué comme `postgres`, en une transaction, avec PGCLIENTENCODING=UTF8 :
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v box=<uuid> [-v n_membres=50] \
--        -f scripts/demo-vitrine/sql/01-activer.sql
--
-- 1. Ajoute à internal.demo_accounts les comptes demo.vitrine+NN@athlexapp.eu
--    (NN = 01..n_membres) et demo.vitrine+coach@athlexapp.eu, membres de la box :
--    global_leaderboard et global_elo_rank les excluent alors.
-- 2. Passe les membres (rôle member) sur « Accès démo », abonnement actif, au
--    comptoir : mêmes colonnes et valeurs que les 147 adhésions déjà sur cette
--    formule (plan_id par la migration 20270157 ; subscription_status et
--    payment_method_type par le seed qu'elle a trouvé en place). Le coach n'a
--    pas de formule : il est staff.
-- 3. Résout les alertes ouvertes de ces comptes comme resoudre_alerte_membre
--    (resolved_at = now(), resolved_by = auth.uid(), NULL ici).
-- Garde-fous (exception, donc ROLLBACK de toute la transaction) :
--   - box = AthleX Fitness, ou box jetable sans aucun membre hors gérant et
--     comptes demo.vitrine ;
--   - comptes ciblés ≠ n_membres + 1, ou membres sur la formule ≠ n_membres ;
--   - box_manager_notifications a changé pendant la transaction ;
--   - une alerte reste ouverte pour ces comptes.
-- Rejoué, il ne change rien (aucune ligne écrite) et repasse les contrôles.
-- Testé par scripts/demo-vitrine/sql/test-rejeu.sh (rejeu local, mutations).
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\if :{?n_membres}
\else
  \set n_membres 50
\endif

BEGIN;
SELECT set_config('vitrine.box', :'box', true), set_config('vitrine.n', :'n_membres', true);

DO $activer$
DECLARE
  c_af      constant uuid := 'd3d0b0a0-0000-4000-a000-000000000001';
  c_membre  constant text := '^demo\.vitrine\+(0[1-9]|[1-4][0-9]|50)@athlexapp\.eu$';
  c_coach   constant text := 'demo.vitrine+coach@athlexapp.eu';
  v_box     uuid := current_setting('vitrine.box')::uuid;
  v_n       int  := current_setting('vitrine.n')::int;
  v_plan    uuid;
  v_notif0  bigint;
  v_notif1  bigint;
  v_cibles  int;
  v_membres int;
  v_ajouts  int;
  v_formule int;
  v_alertes int;
  v_demo    int;
  v_sur_formule int;
  v_ouvertes int;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'VITRINE_ROLE: à jouer sous un rôle serveur (postgres)';
  END IF;
  IF v_n NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'VITRINE_N: n_membres doit être entre 1 et 50 (reçu %)', v_n;
  END IF;
  IF v_box <> c_af AND EXISTS (
       SELECT 1 FROM public.box_members bm JOIN auth.users u ON u.id = bm.member_id
        WHERE bm.box_id = v_box
          AND bm.member_id <> (SELECT owner_id FROM public.boxes WHERE id = v_box)
          AND lower(u.email) !~ c_membre AND lower(u.email) <> c_coach) THEN
    RAISE EXCEPTION 'VITRINE_BOX: % n''est ni AthleX Fitness ni une box jetable (membres réels présents)', v_box;
  END IF;

  SELECT count(*) INTO v_notif0 FROM public.box_manager_notifications;

  SELECT id INTO v_plan FROM public.membership_plans
   WHERE box_id = v_box AND name = 'Accès démo' AND plan_type = 'subscription' AND price_cents = 0;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'VITRINE_FORMULE: formule « Accès démo » (abonnement, 0 €) absente de la box %', v_box;
  END IF;

  -- Comptes ciblés : motif d'adresse strict ET membre actif de la box.
  DROP TABLE IF EXISTS vitrine_cible;
  CREATE TEMP TABLE vitrine_cible ON COMMIT DROP AS
  SELECT bm.id AS box_member_id, bm.member_id, bm.role,
         lower(u.email) <> c_coach AS est_membre
    FROM public.box_members bm
    JOIN auth.users u ON u.id = bm.member_id
   WHERE bm.box_id = v_box AND bm.status = 'active'
     AND (lower(u.email) ~ c_membre OR lower(u.email) = c_coach);

  SELECT count(*), count(*) FILTER (WHERE est_membre) INTO v_cibles, v_membres FROM vitrine_cible;
  IF v_cibles <> v_n + 1 OR v_membres <> v_n THEN
    RAISE EXCEPTION 'VITRINE_COMPTES: % comptes dont % membres (attendu % dont %) : rien n''est écrit',
      v_cibles, v_membres, v_n + 1, v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM vitrine_cible WHERE est_membre AND role <> 'member') THEN
    RAISE EXCEPTION 'VITRINE_ROLE_MEMBRE: un compte membre fictif n''a pas le rôle member';
  END IF;
  IF EXISTS (SELECT 1 FROM vitrine_cible c JOIN public.box_members bm ON bm.id = c.box_member_id
              WHERE bm.stripe_subscription_id IS NOT NULL) THEN
    RAISE EXCEPTION 'VITRINE_STRIPE: un compte fictif porte un abonnement Stripe';
  END IF;

  INSERT INTO internal.demo_accounts (user_id)
  SELECT member_id FROM vitrine_cible
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS v_ajouts = ROW_COUNT;

  UPDATE public.box_members bm
     SET plan_id = v_plan, subscription_status = 'active', payment_method_type = 'cash'
    FROM vitrine_cible c
   WHERE bm.id = c.box_member_id AND c.est_membre
     AND (bm.plan_id IS DISTINCT FROM v_plan
          OR bm.subscription_status IS DISTINCT FROM 'active'
          OR bm.payment_method_type IS DISTINCT FROM 'cash');
  GET DIAGNOSTICS v_formule = ROW_COUNT;

  UPDATE public.box_member_alerts a
     SET resolved_at = now(), resolved_by = auth.uid()
   WHERE a.box_id = v_box AND a.resolved_at IS NULL
     AND a.member_id IN (SELECT member_id FROM vitrine_cible);
  GET DIAGNOSTICS v_alertes = ROW_COUNT;

  -- Contrôles de fin.
  SELECT count(*) INTO v_demo FROM internal.demo_accounts d WHERE d.user_id IN (SELECT member_id FROM vitrine_cible);
  SELECT count(*) INTO v_sur_formule FROM public.box_members bm JOIN vitrine_cible c ON c.box_member_id = bm.id
   WHERE c.est_membre AND bm.plan_id = v_plan AND bm.subscription_status = 'active' AND bm.payment_method_type = 'cash';
  SELECT count(*) INTO v_ouvertes FROM public.box_member_alerts a
   WHERE a.box_id = v_box AND a.resolved_at IS NULL AND a.member_id IN (SELECT member_id FROM vitrine_cible);
  SELECT count(*) INTO v_notif1 FROM public.box_manager_notifications;

  IF v_demo <> v_n + 1 OR v_sur_formule <> v_n THEN
    RAISE EXCEPTION 'VITRINE_CONTROLE: % dans demo_accounts (attendu %), % sur la formule (attendu %)',
      v_demo, v_n + 1, v_sur_formule, v_n;
  END IF;
  IF v_notif1 <> v_notif0 THEN
    RAISE EXCEPTION 'VITRINE_NOTIFICATIONS: box_manager_notifications % → % pendant la transaction', v_notif0, v_notif1;
  END IF;
  IF v_ouvertes <> 0 THEN
    RAISE EXCEPTION 'VITRINE_ALERTES: % alerte(s) ouverte(s) restante(s)', v_ouvertes;
  END IF;

  RAISE NOTICE 'VITRINE_ACTIVER comptes=% membres=% demo_accounts_ajouts=% formule_ecrites=% alertes_resolues=% demo_accounts=% sur_formule=% notifications=%→%',
    v_cibles, v_membres, v_ajouts, v_formule, v_alertes, v_demo, v_sur_formule, v_notif0, v_notif1;
END $activer$;

COMMIT;
