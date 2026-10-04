-- ═════════════════════════════════════════════════════════════════════════════
-- Notifications push au gérant : tâches pg_cron (migration 20270144)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (le test rejoue la migration par \i).
--   C0  forme des deux tâches laissées par la migration : planning, appel de
--       deliver-manager-notifications sans Authorization ni clé ni secret en
--       clair, x-cron-secret lu dans le Vault une fois ; purge à 30 jours ;
--       tâche d'envoi active si et seulement si le Vault a `cron_secret` ;
--   C1  avec `cron_secret` dans le Vault (valeur factice), la migration rejouée
--       crée la tâche d'envoi active, sans doublon ; sans lui, inactive ; les
--       autres tâches ne bougent pas ;
--   C2  la purge supprime ce qui a plus de 30 jours, garde le reste (si la file
--       de la migration 20270143 existe) ; mutation : à 0 jour, elle supprime
--       aussi le récent ;
--   C3  retour arrière de l'en-tête de la migration : plus aucune des deux
--       tâches, les autres inchangées.
-- Une tâche témoin (`zz-ngc-notifications-temoin`) prouve que la migration ne
-- touche qu'à ses deux tâches ; elle est retirée à la fin.
-- La migration contient son propre BEGIN/COMMIT : C1 laisse la base dans
-- l'état d'après migration (Vault sans `cron_secret`). C2 et C3 sont annulés.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Notifications du gérant : tâches pg_cron'

-- Une tâche témoin au nom voisin : la migration ne doit toucher qu'à ses deux tâches.
SELECT cron.schedule('zz-ngc-notifications-temoin', '0 0 1 1 *', 'SELECT 1');

CREATE TEMP TABLE ngc_autres AS
  SELECT jobid, jobname, schedule, active, md5(command) AS m FROM cron.job
  WHERE jobname NOT IN ('deliver-manager-notifications-minute', 'box-manager-notifications-purge');

-- Forme attendue des deux tâches ; `p_actif` : état attendu de la tâche d'envoi.
CREATE FUNCTION pg_temp.verifier(p_etape text, p_actif boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  e record;
  p record;
BEGIN
  IF (SELECT count(*) FROM cron.job WHERE jobname = 'deliver-manager-notifications-minute') <> 1
     OR (SELECT count(*) FROM cron.job WHERE jobname = 'box-manager-notifications-purge') <> 1 THEN
    RAISE EXCEPTION '% : il faut exactement une tâche de chaque', p_etape;
  END IF;
  SELECT * INTO e FROM cron.job WHERE jobname = 'deliver-manager-notifications-minute';
  SELECT * INTO p FROM cron.job WHERE jobname = 'box-manager-notifications-purge';
  IF e.schedule <> '* * * * *' THEN RAISE EXCEPTION '% : envoi planifié « % » (attendu chaque minute)', p_etape, e.schedule; END IF;
  IF e.active IS DISTINCT FROM p_actif THEN RAISE EXCEPTION '% : tâche d''envoi active = % (attendu %)', p_etape, e.active, p_actif; END IF;
  IF strpos(e.command, $c$url := 'https://lkwdlqlbrbxaiydkoxfp.supabase.co/functions/v1/deliver-manager-notifications'$c$) = 0
     OR strpos(e.command, 'net.http_post(') = 0 THEN
    RAISE EXCEPTION '% : la tâche d''envoi n''appelle pas deliver-manager-notifications', p_etape;
  END IF;
  IF strpos(e.command, $c$'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')$c$) = 0
     OR array_length(string_to_array(e.command, 'vault.'), 1) <> 2 THEN
    RAISE EXCEPTION '% : x-cron-secret n''est pas lu une fois dans le Vault', p_etape;
  END IF;
  IF e.command ~* '(authorization|bearer|apikey|eyJ|sb_secret_|sb_publishable_)' THEN
    RAISE EXCEPTION '% : la tâche d''envoi porte une clé ou un en-tête Authorization', p_etape;
  END IF;
  IF p.schedule <> '23 3 * * *' OR NOT p.active
     OR btrim(p.command, E' \n') <> $c$DELETE FROM public.box_manager_notifications WHERE created_at < now() - interval '30 days';$c$ THEN
    RAISE EXCEPTION '% : purge inattendue (« % », actif %, « % »)', p_etape, p.schedule, p.active, p.command;
  END IF;
  IF EXISTS (
    SELECT 1 FROM ngc_autres a FULL JOIN (
      SELECT jobid, jobname, schedule, active, md5(command) AS m FROM cron.job
      WHERE jobname NOT IN ('deliver-manager-notifications-minute', 'box-manager-notifications-purge')
    ) b USING (jobid)
    WHERE a IS DISTINCT FROM b
  ) THEN
    RAISE EXCEPTION '% : une autre tâche pg_cron a changé', p_etape;
  END IF;
END $$;

-- C0 : état laissé par la migration.
SELECT pg_temp.verifier('C0', EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret'));

-- C1 : Vault avec et sans cron_secret (valeur factice, assemblée ici).
DELETE FROM vault.secrets WHERE name = 'cron_secret';
SELECT vault.create_secret('zz-ngc-' || md5('cron'), 'cron_secret');
\i supabase/migrations/20270144000000_notifications_gerant_cron.sql
SELECT pg_temp.verifier('C1 avec secret', true);
\i supabase/migrations/20270144000000_notifications_gerant_cron.sql
SELECT pg_temp.verifier('C1 rejouée', true);
DELETE FROM vault.secrets WHERE name = 'cron_secret';
\i supabase/migrations/20270144000000_notifications_gerant_cron.sql
SELECT pg_temp.verifier('C1 sans secret', false);

-- C2 : la purge, exécutée telle que la tâche la porte.
BEGIN;
DO $t$
DECLARE
  v_purge text := (SELECT command FROM cron.job WHERE jobname = 'box-manager-notifications-purge');
  v_restent text;
BEGIN
  IF to_regclass('public.box_manager_notifications') IS NULL THEN
    RAISE NOTICE 'C2 : file absente (migration 20270143 pas encore là), purge non exécutée';
    RETURN;
  END IF;
  INSERT INTO auth.users (id) VALUES ('00000000-0000-4000-a9d6-000000000001');
  INSERT INTO public.profiles (id, email, username) VALUES ('00000000-0000-4000-a9d6-000000000001', 'ngc@test.invalid', 'ngc_1');
  INSERT INTO public.boxes (id, name, invite_code, owner_id)
  VALUES ('00000000-0000-4000-b9d6-000000000001', 'Box purge', 'NGC1', '00000000-0000-4000-a9d6-000000000001');
  EXECUTE $s$
    INSERT INTO public.box_manager_notifications (box_id, type, event_ref, member_id, created_at, sent_at, attempts)
    SELECT '00000000-0000-4000-b9d6-000000000001', 'invitation_accepted', r, '00000000-0000-4000-a9d6-000000000001', c, s, a
    FROM (VALUES ('vieille-envoyee', now() - interval '31 days', now() - interval '31 days', 1),
                 ('vieille-abandonnee', now() - interval '31 days', NULL::timestamptz, 5),
                 ('recente', now() - interval '29 days', now() - interval '29 days', 1),
                 ('en-attente', now(), NULL::timestamptz, 0)) v(r, c, s, a)
  $s$;
  EXECUTE v_purge;
  EXECUTE $s$ SELECT string_agg(event_ref, ',' ORDER BY event_ref) FROM public.box_manager_notifications
               WHERE box_id = '00000000-0000-4000-b9d6-000000000001' $s$ INTO v_restent;
  IF v_restent IS DISTINCT FROM 'en-attente,recente' THEN
    RAISE EXCEPTION 'C2 : après la purge, il reste « % » (attendu en-attente,recente)', v_restent;
  END IF;
  -- Mutation : à 0 jour, la purge emporte aussi le récent — C2 le voit.
  EXECUTE replace(v_purge, '30 days', '0 days');
  EXECUTE $s$ SELECT string_agg(event_ref, ',' ORDER BY event_ref) FROM public.box_manager_notifications
               WHERE box_id = '00000000-0000-4000-b9d6-000000000001' $s$ INTO v_restent;
  IF v_restent IS NOT DISTINCT FROM 'en-attente,recente' THEN
    RAISE EXCEPTION 'C2 : purge à 0 jour, le récent reste : C2 ne prouve rien';
  END IF;
END $t$;
ROLLBACK;

-- C3 : retour arrière de l'en-tête, tel quel.
BEGIN;
SELECT cron.unschedule('deliver-manager-notifications-minute');
SELECT cron.unschedule('box-manager-notifications-purge');
DO $t$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname IN ('deliver-manager-notifications-minute', 'box-manager-notifications-purge')) THEN
    RAISE EXCEPTION 'C3 : après retour arrière, une des deux tâches reste';
  END IF;
  IF EXISTS (
    SELECT 1 FROM ngc_autres a FULL JOIN (SELECT jobid, jobname, schedule, active, md5(command) AS m FROM cron.job) b USING (jobid)
    WHERE a IS DISTINCT FROM b
  ) THEN
    RAISE EXCEPTION 'C3 : le retour arrière touche une autre tâche';
  END IF;
END $t$;
ROLLBACK;

SELECT cron.unschedule('zz-ngc-notifications-temoin');
\echo '    C0 à C3 OK'
