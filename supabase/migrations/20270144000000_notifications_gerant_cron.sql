-- ═════════════════════════════════════════════════════════════════════════════
-- Notifications push au gérant (D4a, PR C) : tâches pg_cron
--
-- Appliquée en prod : OUI, le 04/10/2026 à 10:19 UTC, avec PGCLIENTENCODING=UTF8,
-- sur GO de Nab, après 20270143 (10:16 UTC) et le déploiement de
-- deliver-manager-notifications (10:19 UTC) ; dump du jour
-- db-dumps/2026-10-04/athlex-prod-public-internal-20261004T101510Z.dump (sha256
-- 92a481a3…). Précontrôle : cron_secret présent dans le Vault, aucune des deux
-- tâches. Vérifications : tâche 15 deliver-manager-notifications-minute
-- (`* * * * *`, active, md5 de commande 539f5a3d…) et tâche 16
-- box-manager-notifications-purge (`23 3 * * *`, active, fbe6903a…), les 13
-- autres tâches au même planning, état et md5 de commande qu'avant ; exécutions
-- de 10:20, 10:21, 10:22 et 10:23 `succeeded` dans cron.job_run_details,
-- réponses HTTP 200 `{"lues":0,"envoyees":0,"echecs":0,"prises_ailleurs":0}`,
-- journaux de la fonction sans erreur, file vide.
--
-- À APPLIQUER EN DERNIER : après la migration 20270143 (PR A, la file
-- `box_manager_notifications`) et après le déploiement de la fonction
-- `deliver-manager-notifications` (PR B). Conception : docs/NOTIFS_GERANT.md.
--
-- Deux tâches :
--   * `deliver-manager-notifications-minute` (`* * * * *`) : appelle la fonction
--     edge par `net.http_post`, sur le modèle des tâches 8, 10 et 11 depuis
--     20270104 : aucune clé d'API ni `Authorization` (`verify_jwt = false`
--     versionné), `x-cron-secret` lu dans le Vault (`cron_secret`) au moment de
--     l'appel, jamais écrit en clair. Sans secret `cron_secret` dans le Vault
--     (base de rejeu), la tâche est créée INACTIVE : elle n'appelle rien ;
--   * `box-manager-notifications-purge` (`23 3 * * *`, 03:23 UTC) : supprime
--     les lignes de la file créées il y a plus de 30 jours (envoyées,
--     abandonnées après 5 tentatives, ou trop vieilles pour partir).
--
-- Rejouable : les deux tâches sont retirées puis recréées à l'identique.
-- Sans pg_cron, elle ne fait rien.
--
-- Contrôlée par `supabase/tests/notifications_gerant_cron.sql`.
--
-- Retour arrière (vérifié sur le rejeu par la suite de tests : plus aucune des
-- deux tâches, les autres inchangées) :
--
--   BEGIN;
--   SELECT cron.unschedule('deliver-manager-notifications-minute');
--   SELECT cron.unschedule('box-manager-notifications-purge');
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $migration$
DECLARE
  v_job bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron indisponible : les notifications du gérant ne partiront pas.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('deliver-manager-notifications-minute', 'box-manager-notifications-purge');

  v_job := cron.schedule('deliver-manager-notifications-minute', '* * * * *', $cron$
  select net.http_post(
    url := 'https://lkwdlqlbrbxaiydkoxfp.supabase.co/functions/v1/deliver-manager-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$cron$);
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret') THEN
    PERFORM cron.alter_job(job_id := v_job, active := false);
    RAISE NOTICE 'Vault sans cron_secret : deliver-manager-notifications-minute créée inactive.';
  END IF;

  PERFORM cron.schedule('box-manager-notifications-purge', '23 3 * * *', $cron$
  DELETE FROM public.box_manager_notifications WHERE created_at < now() - interval '30 days';
$cron$);
END $migration$;

COMMIT;
