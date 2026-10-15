-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270157000000_acces_demo.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test acces_demo.sql le rejoue dans sa propre
-- transaction annulée).
--
-- Remet à chaque adhésion écrite sa formule d'avant (démo, reviewer) ou sa fin
-- d'accès d'avant (membre réel : NULL), d'après internal.acces_demo_sauvegarde,
-- puis supprime la formule « Accès démo » et la sauvegarde. Joué sous un rôle
-- serveur, comme la migration (garde de facturation).
-- ═════════════════════════════════════════════════════════════════════════════

UPDATE public.box_members bm SET plan_id = s.plan_id_avant
  FROM internal.acces_demo_sauvegarde s
 WHERE bm.id = s.box_member_id AND s.categorie IN ('demo', 'reviewer');

UPDATE public.box_members bm SET cash_access_until = s.cash_access_until_avant
  FROM internal.acces_demo_sauvegarde s
 WHERE bm.id = s.box_member_id AND s.categorie = 'reel';

DELETE FROM public.membership_plans
 WHERE box_id = 'd3d0b0a0-0000-4000-a000-000000000001' AND name = 'Accès démo';

DROP TABLE internal.acces_demo_sauvegarde;
