-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR 3 sur 6 : tâche pg_cron d'envoi des messages
-- de fin d'accès
--
-- Appliquée en prod : OUI, le 14/10/2026 à 10:11 UTC, avec PGCLIENTENCODING=UTF8,
-- en une transaction (psql -1), sur GO de Nab, après le déploiement de
-- deliver-access-notices (v1, 10:10 UTC, verify_jwt false) et de send-push
-- (v25, 10:10 UTC, sources identiques à la PR ; v24 d'avant identique à master,
-- gardée dans C:\Users\NBS\athlex-retour-arriere-send-push\avant-comptoir-p3).
-- Sondes : deliver-access-notices sans secret et avec un secret faux → 401 ;
-- send-push sans authentification → 401 avant comme après. Dump des schémas
-- public et internal avec droits
-- db-dumps/2026-10-14/athlex-prod-public-internal-20261014T101056Z.dump, sha256
-- 5e2caa37410048c26b96aa84460ccccbdb9f388121461ecbc67606892f5422be vérifié
-- après aller-retour, 139 TABLE DATA, 479 ACL, 348 POLICY. Précontrôles :
-- CRON_SECRET et RESEND_API_KEY présents (noms), cron_secret dans le Vault
-- (nom), file vide, tâche absente, 16 tâches relevées. Vérifications : tâche
-- 18 deliver-access-notices à « 46 * * * * », active, md5 de commande
-- 65bb761f… (celui du fichier), URL attendue, x-cron-secret lu une fois dans
-- le Vault, aucune clé ; les 16 autres tâches inchangées. Première passe le
-- 14/10/2026 à 10:46:00 UTC : succeeded, HTTP 200
-- {"hors_heures":false,"lues":0,…}, journaux sans erreur, file vide. Audit des
-- droits en prod 45/45 lancé depuis la branche.
--
-- À APPLIQUER APRÈS le déploiement de la fonction edge `deliver-access-notices`
-- (même PR), sinon la tâche appelle une fonction absente toutes les heures.
-- La file `box_member_access_notices` vient de la migration 20270152 (appliquée
-- le 13/10/2026), remplie par la tâche `comptoir-fin-acces` à la 41e minute.
--
-- Une tâche, `deliver-access-notices` (`46 * * * *`, cinq minutes après
-- `comptoir-fin-acces`) : appelle la fonction edge par `net.http_post`, sur le
-- modèle de `deliver-manager-notifications-minute` (20270144) : aucune clé
-- d'API ni `Authorization` (`verify_jwt = false` versionné), `x-cron-secret`
-- lu dans le Vault (`cron_secret`) au moment de l'appel, jamais écrit en clair.
-- Sans secret `cron_secret` dans le Vault (base de rejeu), la tâche est créée
-- INACTIVE : elle n'appelle rien. La fonction n'envoie qu'entre 9:00 et 20:00,
-- heure de Paris : en dehors, elle ne lit rien.
--
-- Rejouable : la tâche est retirée puis recréée à l'identique. Sans pg_cron,
-- elle ne fait rien. Retour arrière : supabase/retours/20270153000000_comptoir_envoi_messages.sql.
-- Contrôlée par `supabase/tests/comptoir_envoi_messages_cron.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

DO $migration$
DECLARE
  v_job bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron indisponible : les messages de fin d''accès ne partiront pas.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'deliver-access-notices';

  v_job := cron.schedule('deliver-access-notices', '46 * * * *', $cron$
  select net.http_post(
    url := 'https://lkwdlqlbrbxaiydkoxfp.supabase.co/functions/v1/deliver-access-notices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$cron$);
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret') THEN
    PERFORM cron.alter_job(job_id := v_job, active := false);
    RAISE NOTICE 'Vault sans cron_secret : deliver-access-notices créée inactive.';
  END IF;
END $migration$;
