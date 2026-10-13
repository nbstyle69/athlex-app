-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR 3 : tâche pg_cron deliver-access-notices
-- (migration 20270153)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (le test rejoue la migration par \i).
--   C0  forme de la tâche laissée par la migration : `46 * * * *`, appel de
--       deliver-access-notices sans Authorization ni clé ni secret en clair,
--       x-cron-secret lu dans le Vault une fois ; active si et seulement si le
--       Vault a `cron_secret` ;
--   C1  avec `cron_secret` dans le Vault (valeur factice), la migration rejouée
--       crée la tâche active, sans doublon ; sans lui, inactive ; les autres
--       tâches ne bougent pas ;
--   M   mutations : une planification, une URL ou un en-tête Authorization
--       différents sont vus par le contrôle ;
--   R   retour arrière : plus de tâche deliver-access-notices, les autres
--       inchangées.
-- Une tâche témoin (`zz-cem-temoin`) prouve que la migration ne touche qu'à sa
-- tâche. Tout est joué dans des transactions annulées : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Paiements au comptoir : tâche d''envoi des messages'

BEGIN;
SELECT cron.schedule('zz-cem-temoin', '0 0 1 1 *', 'SELECT 1');
CREATE TEMP TABLE cem_autres AS
  SELECT jobid, jobname, schedule, active, md5(command) AS m FROM cron.job WHERE jobname <> 'deliver-access-notices';

-- Écart de forme de la tâche, ou NULL si elle est conforme. `p_actif` : état attendu.
CREATE FUNCTION pg_temp.ecart(p_actif boolean) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  e record;
BEGIN
  IF (SELECT count(*) FROM cron.job WHERE jobname = 'deliver-access-notices') <> 1 THEN
    RETURN 'il faut exactement une tâche deliver-access-notices';
  END IF;
  SELECT * INTO e FROM cron.job WHERE jobname = 'deliver-access-notices';
  IF e.schedule <> '46 * * * *' THEN RETURN format('planifiée « %s » (attendu 46 * * * *)', e.schedule); END IF;
  IF e.active IS DISTINCT FROM p_actif THEN RETURN format('active = %s (attendu %s)', e.active, p_actif); END IF;
  IF strpos(e.command, $c$url := 'https://lkwdlqlbrbxaiydkoxfp.supabase.co/functions/v1/deliver-access-notices'$c$) = 0
     OR strpos(e.command, 'net.http_post(') = 0 THEN
    RETURN 'la tâche n''appelle pas deliver-access-notices';
  END IF;
  IF strpos(e.command, $c$'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')$c$) = 0
     OR array_length(string_to_array(e.command, 'vault.'), 1) <> 2 THEN
    RETURN 'x-cron-secret n''est pas lu une fois dans le Vault';
  END IF;
  IF e.command ~* '(authorization|bearer|apikey|eyJ|sb_secret_|sb_publishable_)' THEN
    RETURN 'la tâche porte une clé ou un en-tête Authorization';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cem_autres a FULL JOIN (
      SELECT jobid, jobname, schedule, active, md5(command) AS m FROM cron.job WHERE jobname <> 'deliver-access-notices'
    ) b USING (jobid) WHERE a IS DISTINCT FROM b
  ) THEN
    RETURN 'une autre tâche pg_cron a changé';
  END IF;
  RETURN NULL;
END $$;
CREATE FUNCTION pg_temp.verifier(p_etape text, p_actif boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text := pg_temp.ecart(p_actif);
BEGIN
  IF v IS NOT NULL THEN RAISE EXCEPTION '% : %', p_etape, v; END IF;
END $$;

-- C0 : état laissé par la migration.
SELECT pg_temp.verifier('C0', EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret'));

-- C1 : Vault avec et sans cron_secret (valeur factice, assemblée ici).
DELETE FROM vault.secrets WHERE name = 'cron_secret';
SELECT vault.create_secret('zz-cem-' || md5('cron'), 'cron_secret');
\i supabase/migrations/20270153000000_comptoir_envoi_messages.sql
SELECT pg_temp.verifier('C1 avec secret', true);
\i supabase/migrations/20270153000000_comptoir_envoi_messages.sql
SELECT pg_temp.verifier('C1 rejouée', true);
DELETE FROM vault.secrets WHERE name = 'cron_secret';
\i supabase/migrations/20270153000000_comptoir_envoi_messages.sql
SELECT pg_temp.verifier('C1 sans secret', false);

-- M : chaque écart est vu.
DO $t$
DECLARE
  v_job bigint := (SELECT jobid FROM cron.job WHERE jobname = 'deliver-access-notices');
  v_cmd text := (SELECT command FROM cron.job WHERE jobname = 'deliver-access-notices');
BEGIN
  PERFORM cron.alter_job(job_id := v_job, schedule := '41 * * * *');
  IF pg_temp.ecart(false) IS NULL THEN RAISE EXCEPTION 'M : planification changée, non vue'; END IF;
  PERFORM cron.alter_job(job_id := v_job, schedule := '46 * * * *');
  PERFORM cron.alter_job(job_id := v_job, command := replace(v_cmd, 'deliver-access-notices', 'deliver-manager-notifications'));
  IF pg_temp.ecart(false) IS NULL THEN RAISE EXCEPTION 'M : URL changée, non vue'; END IF;
  PERFORM cron.alter_job(job_id := v_job, command := replace(v_cmd, '''Content-Type''', '''Authorization'', ''Bearer x'', ''Content-Type'''));
  IF pg_temp.ecart(false) IS NULL THEN RAISE EXCEPTION 'M : en-tête Authorization ajouté, non vu'; END IF;
  PERFORM cron.alter_job(job_id := v_job, command := v_cmd);
  PERFORM cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'zz-cem-temoin'), schedule := '0 0 2 1 *');
  IF pg_temp.ecart(false) IS NULL THEN RAISE EXCEPTION 'M : autre tâche changée, non vue'; END IF;
  PERFORM cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'zz-cem-temoin'), schedule := '0 0 1 1 *');
  PERFORM pg_temp.verifier('M rétablie', false);
END $t$;

-- R : retour arrière, tel quel.
\i supabase/retours/20270153000000_comptoir_envoi_messages.sql
DO $t$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deliver-access-notices') THEN
    RAISE EXCEPTION 'R : après retour arrière, la tâche reste';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cem_autres a FULL JOIN (SELECT jobid, jobname, schedule, active, md5(command) AS m FROM cron.job) b USING (jobid)
    WHERE a IS DISTINCT FROM b
  ) THEN
    RAISE EXCEPTION 'R : le retour arrière touche une autre tâche';
  END IF;
END $t$;
ROLLBACK;
\echo '    C0, C1, M et R OK'
