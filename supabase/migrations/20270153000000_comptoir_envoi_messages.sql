-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR 3 sur 6 : tâche pg_cron d'envoi des messages
-- de fin d'accès
--
-- Appliquée en prod : non.
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
