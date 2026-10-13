-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270153000000_comptoir_envoi_messages.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test comptoir_envoi_messages_cron.sql le rejoue
-- dans sa propre transaction annulée).
--
-- Retire la seule tâche `deliver-access-notices` ; les autres tâches ne bougent
-- pas. Les messages restent en file : la fonction edge, si elle reste
-- déployée, ne part plus que sur appel.
-- ═════════════════════════════════════════════════════════════════════════════

DO $retour$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'deliver-access-notices';
  END IF;
END $retour$;
