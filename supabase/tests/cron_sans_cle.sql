-- ═════════════════════════════════════════════════════════════════════════════
-- Tâches pg_cron sans clé d'API, x-cron-secret dans le Vault (migration 20270104)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
--
-- La base de rejeu n'a aucune des cinq tâches (elles sont créées à la main en
-- prod) : la migration y a été un no-op. Ce test les crée sous leur forme de
-- prod (relevée le 23/09/2026 : JWT `anon` et secret en clair, garde d'heure de
-- Paris pour generate-box-week), avec des valeurs FACTICES assemblées ici, puis
-- rejoue la migration et vérifie :
--   T1 les cinq commandes n'ont plus d'Authorization, de JWT ni de secret en
--      clair, lisent le Vault une fois, et ne diffèrent de l'ancienne que par
--      les deux remplacements ; planning, rôle, état actif inchangés ;
--   T2 le Vault porte la valeur, une seule fois ;
--   T3 la sauvegarde : cinq lignes, secret masqué, md5 de l'originale ;
--   T4 les autres tâches pg_cron ne bougent pas ;
--   T5 rejouer la migration ne change rien ;
--   T6 le script de retour arrière (celui de la PR) rend les commandes à
--      l'identique (md5), retire le secret du Vault et la sauvegarde ;
--   T7 refus : valeurs de secret divergentes, secret du Vault différent,
--      commande de forme inattendue — et dans chaque cas rien n'a bougé.
--
-- La migration contient son propre BEGIN/COMMIT : ce test ne peut pas tout
-- envelopper dans une transaction annulée. Il nettoie donc au début et à la fin.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Tâches pg_cron sans clé, x-cron-secret dans le Vault'

-- ── Outils du test ──────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS zz_test_cron;

CREATE OR REPLACE FUNCTION zz_test_cron.nettoyer() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('session-followup-cron-hourly', 'weekly-owner-digest-monday',
                     'tournament-notifications-sweep', 'generate-box-week-cest', 'generate-box-week-cet');
  DELETE FROM vault.secrets WHERE name = 'cron_secret';
  DELETE FROM internal.cron_commandes_avant_20270104;
END $$;

-- Valeurs factices, assemblées à l'exécution : aucun motif de clé dans le dépôt.
CREATE OR REPLACE FUNCTION zz_test_cron.secret() RETURNS text LANGUAGE sql IMMUTABLE AS
  $$ SELECT 'zz-secret-de-test-' || md5('cron') $$;
CREATE OR REPLACE FUNCTION zz_test_cron.jwt() RETURNS text LANGUAGE sql IMMUTABLE AS
  $$ SELECT 'ey' || 'JhbGciOiJIUzI1NiJ9' || '.' || 'ey' || 'Jyb2xlIjoiYW5vbiJ9' || '.' || 'c2lnbmF0dXJlLWZhY3RpY2U' $$;

-- Les cinq tâches sous leur forme de prod (espaces compris).
CREATE OR REPLACE FUNCTION zz_test_cron.creer(p_secret_13 text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  simple CONSTANT text := $c$ select net.http_post( url := 'https://exemple-test.supabase.co/functions/v1/%s', headers := jsonb_build_object( 'Authorization', 'Bearer %s', 'Content-Type', 'application/json', 'x-cron-secret', '%s' ), body := '{}'::jsonb ); $c$;
  garde  CONSTANT text := $c$ DO $guard$ BEGIN IF EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Europe/Paris'))::int = 6 AND EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris'))::int = 8 THEN PERFORM net.http_post(url := 'https://exemple-test.supabase.co/functions/v1/generate-box-week', headers := jsonb_build_object( 'Authorization', 'Bearer %s', 'Content-Type', 'application/json', 'x-cron-secret', '%s' ), body := '{}'::jsonb); END IF; END $guard$; $c$;
  s text := zz_test_cron.secret();
  j text := zz_test_cron.jwt();
BEGIN
  PERFORM cron.schedule('session-followup-cron-hourly', '20 * * * *', format(simple, 'session-followup-cron', j, s));
  PERFORM cron.schedule('weekly-owner-digest-monday', '0 7 * * 1', format(simple, 'weekly-owner-digest', j, s));
  PERFORM cron.schedule('tournament-notifications-sweep', '5,20,35,50 * * * *', format(simple, 'tournament-notifications-cron', j, s));
  PERFORM cron.schedule('generate-box-week-cest', '0 6 * * 6', format(garde, j, s));
  PERFORM cron.schedule('generate-box-week-cet', '0 7 * * 6', format(garde, j, coalesce(p_secret_13, s)));
END $$;

CREATE TABLE IF NOT EXISTS zz_test_cron.avant (jobname text PRIMARY KEY, command text, schedule text, active boolean, username text);
CREATE OR REPLACE FUNCTION zz_test_cron.photo() RETURNS void LANGUAGE sql AS $$
  TRUNCATE zz_test_cron.avant;
  INSERT INTO zz_test_cron.avant SELECT jobname, command, schedule, active, username FROM cron.job;
$$;
-- md5 de toutes les tâches, pour « rien n'a bougé ».
CREATE OR REPLACE FUNCTION zz_test_cron.empreinte() RETURNS text LANGUAGE sql AS $$
  SELECT md5(string_agg(jobname || '|' || command || '|' || schedule || '|' || active, E'\n' ORDER BY jobname)) FROM cron.job
$$;

SELECT zz_test_cron.nettoyer();
SELECT zz_test_cron.creer();
SELECT zz_test_cron.photo();

-- ── Application ────────────────────────────────────────────────────────────
\i supabase/migrations/20270104000000_cron_sans_cle_secret_vault.sql

DO $t$
DECLARE
  c_vault CONSTANT text := '(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''cron_secret'')';
  r record;
  n int := 0;
BEGIN
  -- T1
  FOR r IN SELECT j.jobname, j.command, j.schedule, j.active, j.username, a.command AS ancienne,
                  a.schedule AS s0, a.active AS a0, a.username AS u0
             FROM cron.job j JOIN zz_test_cron.avant a USING (jobname)
            WHERE j.jobname LIKE 'session-followup%' OR j.jobname LIKE 'weekly-owner%'
               OR j.jobname LIKE 'tournament-notifications-sweep' OR j.jobname LIKE 'generate-box-week-%' LOOP
    n := n + 1;
    IF r.command ~ 'Authorization' OR r.command ~ 'eyJ' OR position(zz_test_cron.secret() IN r.command) > 0 THEN
      RAISE EXCEPTION 'T1 % : clé ou secret encore présent', r.jobname;
    END IF;
    IF r.command <> replace(replace(r.ancienne, '''Authorization'', ''Bearer ' || zz_test_cron.jwt() || ''', ', ''),
                            '''' || zz_test_cron.secret() || '''', c_vault) THEN
      RAISE EXCEPTION 'T1 % : la commande diffère d''autre chose que des deux remplacements', r.jobname;
    END IF;
    IF (r.schedule, r.active, r.username) IS DISTINCT FROM (r.s0, r.a0, r.u0) THEN
      RAISE EXCEPTION 'T1 % : planning, état ou rôle modifié', r.jobname;
    END IF;
  END LOOP;
  IF n <> 5 THEN RAISE EXCEPTION 'T1 : % tâche(s) contrôlée(s), 5 attendues', n; END IF;

  -- T2
  IF (SELECT count(*) FROM vault.decrypted_secrets WHERE name = 'cron_secret') <> 1
     OR (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret') <> zz_test_cron.secret() THEN
    RAISE EXCEPTION 'T2 : le Vault ne porte pas la valeur une fois';
  END IF;

  -- T3
  IF (SELECT count(*) FROM internal.cron_commandes_avant_20270104) <> 5
     OR EXISTS (SELECT 1 FROM internal.cron_commandes_avant_20270104
                 WHERE position(zz_test_cron.secret() IN commande_masquee) > 0
                    OR position('__CRON_SECRET__' IN commande_masquee) = 0)
     OR EXISTS (SELECT 1 FROM internal.cron_commandes_avant_20270104 b JOIN zz_test_cron.avant a USING (jobname)
                 WHERE b.md5_avant <> md5(a.command)) THEN
    RAISE EXCEPTION 'T3 : sauvegarde incomplète ou secret en clair';
  END IF;

  -- T4 : la tâche de la base de rejeu (tournament_activation_sweep) et toute autre.
  IF EXISTS (SELECT 1 FROM cron.job j JOIN zz_test_cron.avant a USING (jobname)
              WHERE j.jobname NOT IN ('session-followup-cron-hourly', 'weekly-owner-digest-monday',
                                      'tournament-notifications-sweep', 'generate-box-week-cest', 'generate-box-week-cet')
                AND (j.command, j.schedule, j.active) IS DISTINCT FROM (a.command, a.schedule, a.active)) THEN
    RAISE EXCEPTION 'T4 : une autre tâche a été modifiée';
  END IF;
  RAISE NOTICE 'T1–T4 ok';
END $t$;

-- ── T5 : rejouer ne change rien ────────────────────────────────────────────
CREATE TEMP TABLE zz_apres AS SELECT zz_test_cron.empreinte() AS e,
  (SELECT count(*) FROM vault.secrets WHERE name = 'cron_secret') AS v,
  (SELECT md5(string_agg(jobid || commande_masquee || md5_avant, ',' ORDER BY jobid)) FROM internal.cron_commandes_avant_20270104) AS b;
\i supabase/migrations/20270104000000_cron_sans_cle_secret_vault.sql
DO $t$
BEGIN
  IF (SELECT e FROM zz_apres) <> zz_test_cron.empreinte()
     OR (SELECT v FROM zz_apres) <> (SELECT count(*) FROM vault.secrets WHERE name = 'cron_secret')
     OR (SELECT b FROM zz_apres) <> (SELECT md5(string_agg(jobid || commande_masquee || md5_avant, ',' ORDER BY jobid)) FROM internal.cron_commandes_avant_20270104) THEN
    RAISE EXCEPTION 'T5 : rejouer la migration a changé quelque chose';
  END IF;
  RAISE NOTICE 'T5 ok';
END $t$;

-- ── T6 : retour arrière — le script de la PR, à l'identique ────────────────
BEGIN;
DO $retour$
DECLARE b record; v_secret text; v_cmd text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  IF v_secret IS NULL THEN RAISE EXCEPTION 'cron_secret absent du Vault : retour arrière impossible'; END IF;
  FOR b IN SELECT * FROM internal.cron_commandes_avant_20270104 ORDER BY jobid LOOP
    v_cmd := replace(b.commande_masquee, '__CRON_SECRET__', v_secret);
    IF md5(v_cmd) <> b.md5_avant THEN
      RAISE EXCEPTION 'tâche % : la commande reconstruite diffère de l''originale, rien n''est modifié', b.jobid;
    END IF;
    PERFORM cron.alter_job(job_id := b.jobid, command := v_cmd);
  END LOOP;
END $retour$;
DELETE FROM vault.secrets WHERE name = 'cron_secret';
DROP TABLE internal.cron_commandes_avant_20270104;
COMMIT;

DO $t$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job j JOIN zz_test_cron.avant a USING (jobname)
              WHERE (j.command, j.schedule, j.active, j.username) IS DISTINCT FROM (a.command, a.schedule, a.active, a.username))
     OR (SELECT count(*) FROM cron.job) <> (SELECT count(*) FROM zz_test_cron.avant) THEN
    RAISE EXCEPTION 'T6 : les tâches ne sont pas revenues à l''identique';
  END IF;
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret')
     OR to_regclass('internal.cron_commandes_avant_20270104') IS NOT NULL THEN
    RAISE EXCEPTION 'T6 : le secret ou la sauvegarde subsiste';
  END IF;
  RAISE NOTICE 'T6 ok';
END $t$;

-- La table de sauvegarde est recréée par la migration ; on la remet pour la suite.
CREATE TABLE internal.cron_commandes_avant_20270104 (
  jobid bigint PRIMARY KEY, jobname text NOT NULL, commande_masquee text NOT NULL,
  md5_avant text NOT NULL, sauvegardee_le timestamptz NOT NULL DEFAULT now());

-- ── T7 : refus, et rien n'a bougé ──────────────────────────────────────────
CREATE TEMP TABLE zz_refus (cas text, message text, empreinte_avant text, empreinte_apres text, vault int, sauvegarde int);
\set ON_ERROR_STOP off

-- T7a : une tâche porte une autre valeur de x-cron-secret.
SELECT zz_test_cron.nettoyer();
SELECT zz_test_cron.creer('zz-autre-valeur');
INSERT INTO zz_refus (cas, empreinte_avant) VALUES ('secrets divergents', zz_test_cron.empreinte());
\i supabase/migrations/20270104000000_cron_sans_cle_secret_vault.sql
UPDATE zz_refus SET message = :'LAST_ERROR_MESSAGE', empreinte_apres = zz_test_cron.empreinte(),
  vault = (SELECT count(*) FROM vault.secrets WHERE name = 'cron_secret'),
  sauvegarde = (SELECT count(*) FROM internal.cron_commandes_avant_20270104) WHERE cas = 'secrets divergents';

-- T7b : le Vault porte déjà une autre valeur.
SELECT zz_test_cron.nettoyer();
SELECT zz_test_cron.creer();
SELECT vault.create_secret('zz-valeur-differente', 'cron_secret');
INSERT INTO zz_refus (cas, empreinte_avant) VALUES ('vault différent', zz_test_cron.empreinte());
\i supabase/migrations/20270104000000_cron_sans_cle_secret_vault.sql
UPDATE zz_refus SET message = :'LAST_ERROR_MESSAGE', empreinte_apres = zz_test_cron.empreinte(),
  vault = (SELECT count(*) FROM vault.secrets WHERE name = 'cron_secret'),
  sauvegarde = (SELECT count(*) FROM internal.cron_commandes_avant_20270104) WHERE cas = 'vault différent';

-- T7c : une commande de forme inattendue (deux en-têtes Authorization).
SELECT zz_test_cron.nettoyer();
SELECT zz_test_cron.creer();
SELECT cron.alter_job(job_id := jobid, command := replace(command, '''Content-Type''', '''Authorization'', ''Bearer x'', ''Content-Type'''))
  FROM cron.job WHERE jobname = 'weekly-owner-digest-monday';
INSERT INTO zz_refus (cas, empreinte_avant) VALUES ('forme inattendue', zz_test_cron.empreinte());
\i supabase/migrations/20270104000000_cron_sans_cle_secret_vault.sql
UPDATE zz_refus SET message = :'LAST_ERROR_MESSAGE', empreinte_apres = zz_test_cron.empreinte(),
  vault = (SELECT count(*) FROM vault.secrets WHERE name = 'cron_secret'),
  sauvegarde = (SELECT count(*) FROM internal.cron_commandes_avant_20270104) WHERE cas = 'forme inattendue';

\set ON_ERROR_STOP on
DO $t$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM zz_refus LOOP
    IF r.empreinte_apres IS DISTINCT FROM r.empreinte_avant OR r.sauvegarde <> 0 THEN
      RAISE EXCEPTION 'T7 % : la migration a modifié quelque chose malgré le refus', r.cas;
    END IF;
    IF (r.cas = 'secrets divergents' AND r.message NOT LIKE '%valeurs de x-cron-secret différentes%')
       OR (r.cas = 'vault différent' AND r.message NOT LIKE '%cron_secret du Vault diffère%')
       OR (r.cas = 'forme inattendue' AND r.message NOT LIKE '%forme inattendue%') THEN
      RAISE EXCEPTION 'T7 % : pas le refus attendu (%)', r.cas, r.message;
    END IF;
    -- Le Vault n'est ni créé ni remplacé par une migration refusée.
    IF r.vault <> (CASE WHEN r.cas = 'vault différent' THEN 1 ELSE 0 END) THEN
      RAISE EXCEPTION 'T7 % : le Vault a été modifié', r.cas;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM zz_refus) <> 3 THEN RAISE EXCEPTION 'T7 : % cas joués, 3 attendus', (SELECT count(*) FROM zz_refus); END IF;
  RAISE NOTICE 'T7 ok';
END $t$;

-- ── Nettoyage ───────────────────────────────────────────────────────────────
SELECT zz_test_cron.nettoyer();
DROP SCHEMA zz_test_cron CASCADE;
\echo '    ok'
