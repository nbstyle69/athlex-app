-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR de données : le membre réel d'AthleX Fitness
-- est reporté à la bascule Stripe live (correctif de 20270157)
--
-- Appliquée en prod : OUI, le 15/10/2026 à 15:27 UTC, avec PGCLIENTENCODING=UTF8,
-- en une transaction (psql -1), sur GO de Nab. Dump des schémas public et
-- internal avec droits : db-dumps/2026-10-15/athlex-prod-public-internal-
-- 20261015T152718Z.dump. Résultat : 1 adhésion (7363331b) sans fin d'accès,
-- revenue à son empreinte d'avant 20270157 ; reste inchangé.
--
-- Décision de Nab (15/10/2026). 20270157 (appliquée le 15/10/2026 à 09:44 UTC)
-- a posé au membre réel au comptoir d'AthleX Fitness une fin d'accès au
-- 2026-11-14. Tant que Stripe est en mode test, les vraies box sont au comptoir
-- seul : ce membre ne peut pas payer en ligne, les rappels l'inviteraient à une
-- chose impossible puis lui couperaient la réservation. Sa date est retirée ;
-- sa régularisation se fera à la bascule Stripe live. Les 146 comptes de démo
-- et le reviewer restent sur « Accès démo » (inchangés).
--
-- 1. Cible : la seule ligne « reel » de internal.acces_demo_sauvegarde (la
--    trace de 20270157), si les trois conditions tiennent encore :
--      - sa fin d'accès vaut toujours 2026-11-14 (aucun encaissement depuis) ;
--      - la sauvegarde dit qu'elle n'en avait pas avant 20270157 ;
--      - aucun avis de fin d'accès n'existe pour elle (rien en file, rien parti).
--    Sinon : exception, rien n'est écrit. Formule, statut et reste de la ligne
--    ne bougent pas.
-- 2. Écriture : cash_access_until = NULL sur cette seule adhésion. Aucune
--    notification, aucun avis, aucun push, aucun e-mail (les déclencheurs des
--    notifications au gérant ne portent pas sur cette colonne ; la garde de
--    facturation laisse passer le rôle serveur).
-- 3. La sauvegarde de 20270157 n'est ni effacée ni réécrite : elle garde l'état
--    d'avant. Une colonne `corrigee_par` y note seulement que la ligne a été
--    corrigée ici.
-- 4. Rejeu : sans ligne « reel » (base de rejeu), rien ; ligne déjà marquée,
--    rien. Plus d'une ligne « reel » : exception.
-- 5. Retour arrière autonome (ne lit pas la sauvegarde) :
--    supabase/retours/20270159000000_acces_demo_reel_reporte.sql.
-- Contrôlée par supabase/tests/acces_demo_reel_reporte.sql.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE internal.acces_demo_sauvegarde ADD COLUMN IF NOT EXISTS corrigee_par text;
COMMENT ON COLUMN internal.acces_demo_sauvegarde.corrigee_par IS
  'Correction ultérieure de la ligne (la ligne elle-même reste l''état d''avant 20270157).';

DO $migration$
DECLARE
  c_fin    constant date := '2026-11-14';
  c_marque constant text := '20270159 : fin d''accès retirée, membre reporté à la bascule Stripe live';
  v_reel   int;
  v_deja   int;
  v_cible  uuid;
  v_n      int;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'ACCES_DEMO_REEL_ROLE: migration à jouer sous un rôle serveur (garde de facturation)';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE corrigee_par IS NOT NULL)
    INTO v_reel, v_deja
    FROM internal.acces_demo_sauvegarde WHERE categorie = 'reel';
  IF v_reel = 0 THEN
    RAISE NOTICE 'Accès démo, membre réel : aucune ligne « reel » dans la sauvegarde, rien à faire.';
    RETURN;
  END IF;
  IF v_reel <> 1 THEN
    RAISE EXCEPTION 'ACCES_DEMO_REEL_COMPTE: % lignes « reel » (attendu 1) : rien n''est écrit', v_reel;
  END IF;
  IF v_deja = 1 THEN
    RAISE NOTICE 'Accès démo, membre réel : déjà corrigé, rien à faire.';
    RETURN;
  END IF;

  SELECT bm.id INTO v_cible
    FROM internal.acces_demo_sauvegarde s
    JOIN public.box_members bm ON bm.id = s.box_member_id
   WHERE s.categorie = 'reel'
     AND s.cash_access_until_avant IS NULL
     AND bm.cash_access_until = c_fin
     AND NOT EXISTS (SELECT 1 FROM public.box_member_access_notices n WHERE n.box_member_id = bm.id)
     FOR UPDATE OF bm;
  IF v_cible IS NULL THEN
    RAISE EXCEPTION 'ACCES_DEMO_REEL_CONDITIONS: fin d''accès changée, date d''avant non vide ou avis existant : rien n''est écrit';
  END IF;

  UPDATE public.box_members SET cash_access_until = NULL WHERE id = v_cible AND cash_access_until = c_fin;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ACCES_DEMO_REEL_ECRITURE: % ligne(s) modifiée(s) (attendu 1)', v_n;
  END IF;
  UPDATE internal.acces_demo_sauvegarde SET corrigee_par = c_marque WHERE box_member_id = v_cible;

  RAISE NOTICE 'Accès démo, membre réel : fin d''accès retirée (1 adhésion).';
END $migration$;
