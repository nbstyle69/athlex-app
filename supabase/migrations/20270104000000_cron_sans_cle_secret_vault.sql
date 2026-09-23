-- ═════════════════════════════════════════════════════════════════════════════
-- Tâches pg_cron des fonctions edge : plus de clé d'API, x-cron-secret dans le Vault
-- — clés Supabase, PR C
--
-- Appliquée en prod : NON
--
-- Cinq tâches appellent une fonction edge par `net.http_post` :
--   8  session-followup-cron-hourly   → session-followup-cron
--   10 weekly-owner-digest-monday     → weekly-owner-digest
--   11 tournament-notifications-sweep → tournament-notifications-cron
--   12 generate-box-week-cest         → generate-box-week
--   13 generate-box-week-cet          → generate-box-week
-- Relevé en prod le 23/09/2026 en lecture seule : chacune porte en clair,
-- dans sa commande, l'ancien JWT `anon` (`Authorization: Bearer …`, le même
-- pour les cinq) et la valeur de `x-cron-secret` (la même pour les cinq,
-- identique au CRON_SECRET des fonctions, comparé par empreinte).
--
-- Après cette migration :
--   * plus d'en-tête `Authorization` : les fonctions ont `verify_jwt = false`
--     (PR B, versionné dans supabase/config.toml) et authentifient la tâche par
--     `x-cron-secret` ; la route /functions/v1 n'exige aucune clé d'API. Le JWT
--     `anon` cessera d'être valide à la révocation de l'ancien secret JWT : les
--     tâches n'en dépendent plus ;
--   * `x-cron-secret` est lu au moment de l'appel dans le Vault, secret
--     `cron_secret`, créé ici à partir de la valeur trouvée dans les commandes :
--     elle n'est écrite ni dans ce fichier ni dans aucun message.
-- Le reste de chaque commande (URL, corps, garde d'heure de Paris des tâches
-- 12 et 13), le planning, le rôle et l'état actif ne changent pas : la commande
-- est transformée par deux remplacements exacts, pas réécrite.
--
-- À APPLIQUER APRÈS LE DÉPLOIEMENT DE LA PR B : avec `verify_jwt = true`,
-- session-followup-cron et tournament-notifications-cron refuseraient un appel
-- sans `Authorization` (401 de la plateforme).
--
-- Retour arrière : les commandes d'avant sont gardées dans
-- `internal.cron_commandes_avant_20270104`, avec la valeur du secret remplacée
-- par un marqueur (elle est dans le Vault) et l'empreinte md5 de la commande
-- d'origine, pour vérifier qu'un retour arrière la reproduit à l'identique. Le
-- JWT `anon` y reste : il est public (embarqué dans l'app). Script dans la PR.
-- Table à supprimer une fois l'ancien secret JWT révoqué.
--
-- Rejouable : une tâche déjà transformée n'est pas touchée, le secret du Vault
-- n'est créé qu'une fois, et une valeur divergente fait échouer la migration.
-- Sans aucune des cinq tâches (base de rejeu), elle ne fait rien d'autre que
-- créer la table de sauvegarde, vide.
-- Contrôlée par `supabase/tests/cron_sans_cle.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS internal.cron_commandes_avant_20270104 (
  jobid            bigint PRIMARY KEY,
  jobname          text NOT NULL,
  commande_masquee text NOT NULL,   -- valeur de x-cron-secret remplacée par __CRON_SECRET__
  md5_avant        text NOT NULL,   -- md5 de la commande d'origine, secret compris
  sauvegardee_le   timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON internal.cron_commandes_avant_20270104 FROM PUBLIC, anon, authenticated;

DO $migration$
DECLARE
  -- Les deux formes reconnues : l'ancienne (JWT + secret en clair) et la nouvelle.
  c_auth    CONSTANT text := '''Authorization'',\s*''Bearer [^'']*'',\s*';
  c_secret  CONSTANT text := '(''x-cron-secret'',\s*)''([^'']*)''';
  c_vault   CONSTANT text := '(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''cron_secret'')';
  v_noms    CONSTANT text[] := ARRAY['session-followup-cron-hourly', 'weekly-owner-digest-monday',
                                     'tournament-notifications-sweep', 'generate-box-week-cest', 'generate-box-week-cet'];
  v_job     record;
  v_valeurs text[];
  v_vault   text;
  v_neuve   text;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron absent : aucune tâche à transformer.';
    RETURN;
  END IF;

  -- Chaque tâche présente est sous l'ancienne forme OU sous la nouvelle, rien d'autre.
  FOR v_job IN SELECT jobid, jobname, command FROM cron.job WHERE jobname = ANY (v_noms) LOOP
    IF position(c_vault IN v_job.command) > 0
       AND v_job.command !~ 'Authorization' AND v_job.command !~ 'eyJ' THEN
      CONTINUE; -- déjà transformée
    END IF;
    IF (SELECT count(*) FROM regexp_matches(v_job.command, c_auth, 'g')) <> 1
       OR (SELECT count(*) FROM regexp_matches(v_job.command, c_secret, 'g')) <> 1
       OR (SELECT count(*) FROM regexp_matches(v_job.command, 'Authorization', 'g')) <> 1 THEN
      RAISE EXCEPTION 'tâche % (%) : commande de forme inattendue, rien n''est modifié', v_job.jobid, v_job.jobname;
    END IF;
  END LOOP;

  -- La valeur de x-cron-secret des tâches encore sous l'ancienne forme : une seule.
  SELECT array_agg(DISTINCT (regexp_match(command, c_secret))[2]) INTO v_valeurs
    FROM cron.job WHERE jobname = ANY (v_noms) AND command ~ c_auth;

  IF v_valeurs IS NULL THEN
    RAISE NOTICE 'aucune tâche sous l''ancienne forme : rien à transformer.';
    RETURN;
  END IF;
  IF array_length(v_valeurs, 1) <> 1 OR v_valeurs[1] = '' THEN
    RAISE EXCEPTION '% valeurs de x-cron-secret différentes (ou vide) dans les tâches : rien n''est modifié',
      array_length(v_valeurs, 1);
  END IF;

  -- Le Vault : créé une fois ; s'il existe, il doit porter la même valeur.
  SELECT decrypted_secret INTO v_vault FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  IF NOT FOUND THEN
    PERFORM vault.create_secret(v_valeurs[1], 'cron_secret',
      'x-cron-secret des tâches pg_cron qui appellent les fonctions edge ; égal au CRON_SECRET des fonctions');
  ELSIF v_vault IS DISTINCT FROM v_valeurs[1] THEN
    RAISE EXCEPTION 'le secret cron_secret du Vault diffère de la valeur des tâches : rien n''est modifié';
  END IF;

  -- Sauvegarde puis transformation, tâche par tâche.
  FOR v_job IN SELECT jobid, jobname, command FROM cron.job
                WHERE jobname = ANY (v_noms) AND command ~ c_auth ORDER BY jobid LOOP
    INSERT INTO internal.cron_commandes_avant_20270104 (jobid, jobname, commande_masquee, md5_avant)
    VALUES (v_job.jobid, v_job.jobname,
            regexp_replace(v_job.command, c_secret, '\1''__CRON_SECRET__'''),
            md5(v_job.command))
    ON CONFLICT (jobid) DO NOTHING;

    v_neuve := regexp_replace(regexp_replace(v_job.command, c_auth, ''), c_secret, '\1' || c_vault);
    IF v_neuve ~ 'Authorization' OR v_neuve ~ 'eyJ' OR position(v_valeurs[1] IN v_neuve) > 0
       OR (length(v_neuve) - length(replace(v_neuve, c_vault, ''))) / length(c_vault) <> 1 THEN
      RAISE EXCEPTION 'tâche % : transformation incomplète, rien n''est modifié', v_job.jobid;
    END IF;
    PERFORM cron.alter_job(job_id := v_job.jobid, command := v_neuve);
  END LOOP;
END
$migration$;

COMMIT;
