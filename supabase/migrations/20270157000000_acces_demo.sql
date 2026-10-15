-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR de données : formule « Accès démo »
--
-- Appliquée en prod : OUI, le 15/10/2026 à 09:44 UTC, avec PGCLIENTENCODING=UTF8,
-- en une transaction (psql -1), sur GO de Nab. Dump des schémas public et
-- internal avec droits : db-dumps/2026-10-15/athlex-prod-public-internal-
-- 20261015T092541Z.dump. Résultat : 146 démo et 1 reviewer sur « Accès démo »,
-- 1 membre réel daté au 2026-11-14 ; files inchangées.
--
-- Décisions validées par Nab (15/10/2026) ; étude en lecture seule :
-- athlex-captures/comptoir-p1/donnees-demo/etape1-etude.md.
--
-- 1. Formule « Accès démo » sur AthleX Fitness (box d3d0b0a0-…-000000000001,
--    celle du seed de démo) : 0 €, type abonnement, is_active = false, sans prix
--    Stripe. Non vendue, sans nouveau code : une formule inactive n'est proposée
--    ni sur /box/[slug] (actives et payantes seulement, hors Essai), ni à
--    l'invitation (actives), ni au paiement en ligne (refus si inactive ou à
--    0 €), ni au changement de formule (Manager et refus_changement_formule
--    exigent une formule active et payante). Les membres qui la portent gardent
--    l'accès : internal.membre_a_formule ne regarde pas is_active. Formule à
--    0 € : ni date de fin, ni avis, ni coupure (adhesions_comptoir_datees exige
--    price_cents > 0).
-- 2. Adhésions au comptoir d'AthleX Fitness : role = 'member', status =
--    'active', sans abonnement Stripe, subscription_status active, trialing ou
--    past_due. Trois catégories, par critère (aucune liste d'identifiants) :
--      démo     : adresse du compte en @demo.athlexapp.eu (attendu 146) ;
--      reviewer : compte du journal du seed (public._demo_seed_log, comptes
--                 auth.users), hors domaine démo, ni propriétaire d'une box ni
--                 staff (owner, co-gérant, coach) d'aucune box (attendu 1) ;
--                 sans journal du seed (base de rejeu), aucun reviewer ;
--      réel     : ni démo ni compte du seed (attendu 1).
--    Démo et reviewer passent sur « Accès démo ». Le réel garde sa formule et
--    reçoit cash_access_until = jour de Paris de l'application + 30, s'il n'en a
--    pas déjà une.
-- 3. Garde-fou : les catégories sont comptées AVANT toute écriture ; sur une
--    base où AthleX Fitness a ses comptes de démo, des comptes différents de
--    146 / 1 / 1 lèvent une exception (tout est annulé). Sans la box ou sans
--    compte de démo (rejeu CI), rien n'est écrit et rien n'échoue.
-- 4. Garde de facturation : plan_id et cash_access_until sont réservés au
--    serveur par internal.garder_facturation_membre, qui laisse passer tout
--    rôle autre qu'authenticated et anon. La migration vérifie qu'elle tourne
--    sous un tel rôle et n'écrit que les lignes classées ; aucun déclencheur
--    n'est désactivé.
-- 5. Effets de bord des UPDATE de box_members (plan_id, cash_access_until) :
--    garde de facturation (passe), garde co-gérant (rien pour un membre),
--    compte des membres (inchangé), sync_member_plan_groups (aucune formule
--    d'AthleX Fitness n'est liée à un groupe : rien) ; les notifications au
--    gérant ne se lèvent que sur subscription_status, stripe_subscription_id
--    et past_due_since, non écrits ; aucune alerte, aucun avis, aucun push,
--    aucun e-mail. Le message J−7 du membre réel partira normalement 23 jours
--    après l'application (tâche comptoir-fin-acces).
-- 6. Retour arrière : internal.acces_demo_sauvegarde garde, pour chaque ligne
--    écrite, la formule et la fin d'accès d'avant (première écriture seulement :
--    un rejeu ne l'écrase pas). Fermée aux clients. Retour :
--    supabase/retours/20270157000000_acces_demo.sql.
-- Contrôlée par supabase/tests/acces_demo.sql.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS internal.acces_demo_sauvegarde (
  box_member_id           uuid PRIMARY KEY,
  categorie               text NOT NULL CHECK (categorie IN ('demo', 'reviewer', 'reel')),
  plan_id_avant           uuid,
  cash_access_until_avant date,
  sauvegarde_le           timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE internal.acces_demo_sauvegarde FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE internal.acces_demo_sauvegarde IS
  'Migration 20270157 : formule et fin d''accès d''avant des adhésions passées sur « Accès démo » ou datées, pour le retour arrière.';

DO $migration$
DECLARE
  c_box  constant uuid := 'd3d0b0a0-0000-4000-a000-000000000001';
  v_seed boolean := to_regclass('public._demo_seed_log') IS NOT NULL;
  v_demo int;
  v_rev  int;
  v_reel int;
  v_plan uuid;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'ACCES_DEMO_ROLE: migration à jouer sous un rôle serveur (garde de facturation)';
  END IF;

  -- Comptes du journal du seed, lus seulement si le journal existe (absent du
  -- rejeu : une référence directe échouerait à la préparation).
  DROP TABLE IF EXISTS acces_demo_seed;
  CREATE TEMP TABLE acces_demo_seed (member_id uuid PRIMARY KEY) ON COMMIT DROP;
  IF v_seed THEN
    EXECUTE $q$INSERT INTO acces_demo_seed SELECT DISTINCT row_id::uuid FROM public._demo_seed_log WHERE table_name = 'auth.users'$q$;
  END IF;

  -- Adhésions au comptoir classées (critère, pas de liste).
  DROP TABLE IF EXISTS acces_demo_cible;
  CREATE TEMP TABLE acces_demo_cible ON COMMIT DROP AS
  SELECT bm.id AS box_member_id, bm.plan_id, bm.cash_access_until,
         CASE
           WHEN lower(u.email) LIKE '%@demo.athlexapp.eu' THEN 'demo'
           WHEN bm.member_id IN (SELECT s.member_id FROM acces_demo_seed s) THEN 'reviewer'
           ELSE 'reel'
         END AS categorie,
         -- Propriétaire d'une box, ou staff (owner, co-gérant, coach) d'une box.
         (EXISTS (SELECT 1 FROM public.boxes b WHERE b.owner_id = bm.member_id)
          OR EXISTS (SELECT 1 FROM public.box_members s WHERE s.member_id = bm.member_id AND s.role <> 'member')) AS staff
    FROM public.box_members bm
    JOIN auth.users u ON u.id = bm.member_id
   WHERE bm.box_id = c_box
     AND bm.role = 'member'
     AND bm.status = 'active'
     AND bm.stripe_subscription_id IS NULL
     AND bm.subscription_status IN ('active', 'trialing', 'past_due');
  -- Un compte du seed qui est aussi staff n'est pas le reviewer, et n'est pas
  -- non plus un membre réel : il est écarté.
  DELETE FROM acces_demo_cible WHERE categorie = 'reviewer' AND staff;

  SELECT count(*) FILTER (WHERE categorie = 'demo'), count(*) FILTER (WHERE categorie = 'reviewer'),
         count(*) FILTER (WHERE categorie = 'reel')
    INTO v_demo, v_rev, v_reel FROM acces_demo_cible;

  IF v_demo = 0 THEN
    RAISE NOTICE 'Accès démo : AthleX Fitness ou ses comptes de démo absents, rien à faire.';
    RETURN;
  END IF;
  IF v_demo <> 146 OR v_rev <> (CASE WHEN v_seed THEN 1 ELSE 0 END) OR v_reel <> 1 THEN
    RAISE EXCEPTION 'ACCES_DEMO_COMPTES: démo %, reviewer %, réel % (attendu 146, %, 1) : rien n''est écrit',
      v_demo, v_rev, v_reel, CASE WHEN v_seed THEN 1 ELSE 0 END;
  END IF;

  -- La formule, créée une fois.
  SELECT id INTO v_plan FROM public.membership_plans WHERE box_id = c_box AND name = 'Accès démo';
  IF v_plan IS NULL THEN
    INSERT INTO public.membership_plans (box_id, name, price_cents, currency, plan_type, is_active, description)
    VALUES (c_box, 'Accès démo', 0, 'eur', 'subscription', false,
            'Comptes de démonstration. Non vendue : pas de date de fin, pas de paiement.')
    RETURNING id INTO v_plan;
  END IF;

  -- Sauvegarde d'avant, une fois par ligne.
  INSERT INTO internal.acces_demo_sauvegarde (box_member_id, categorie, plan_id_avant, cash_access_until_avant)
  SELECT box_member_id, categorie, plan_id, cash_access_until FROM acces_demo_cible
  ON CONFLICT (box_member_id) DO NOTHING;

  UPDATE public.box_members bm SET plan_id = v_plan
    FROM acces_demo_cible c
   WHERE bm.id = c.box_member_id AND c.categorie IN ('demo', 'reviewer') AND bm.plan_id IS DISTINCT FROM v_plan;

  UPDATE public.box_members bm SET cash_access_until = (now() AT TIME ZONE 'Europe/Paris')::date + 30
    FROM acces_demo_cible c
   WHERE bm.id = c.box_member_id AND c.categorie = 'reel' AND bm.cash_access_until IS NULL;

  RAISE NOTICE 'Accès démo : % comptes de démo, % reviewer sur la formule ; % membre réel daté.', v_demo, v_rev, v_reel;
END $migration$;
