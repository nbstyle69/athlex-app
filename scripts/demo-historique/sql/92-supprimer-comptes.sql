-- ═════════════════════════════════════════════════════════════════════════════
-- Démo historique (#523) — suppression des comptes Auth figés au relevé (80),
-- après 90 et 91. Joué comme `postgres`, en une transaction :
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v releve=<fichier de 80> \
--        -f scripts/demo-historique/sql/92-supprimer-comptes.sql
-- Même effet que l'API admin d'Auth (DELETE de auth.users, cascades des
-- identités, sessions, facteurs MFA, jetons à usage unique et de toutes les
-- données de l'app), mais en une seule transaction gardée, sans processus
-- node. auth.refresh_tokens.user_id est du texte sans clé étrangère : seuls les
-- jetons rattachés à une session partent en cascade ; les autres sont
-- supprimés ici, explicitement.
-- Contrôle après coup, sur chaque table d'Auth qui porte un user_id (lue au
-- catalogue, en texte) : 0 ligne des comptes purgés ; et les lignes des autres
-- comptes, comptées avant et après, inchangées.
-- Gardes, revérifiées au moment de la suppression (sinon exception, ROLLBACK) :
--   - chaque compte est encore dans internal.demo_accounts, adresse en
--     @demo.athlexapp.eu, et n'est pas un exclu (reviewer) ;
--   - le nombre de comptes supprimés vaut celui du relevé (ou 0 au rejeu) ;
--   - après coup, aucun compte du relevé ne reste ; les exclus restent, avec
--     leur entrée internal.demo_accounts.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
BEGIN;
\i :releve

DO $comptes$
DECLARE
  v_comptes uuid[] := current_setting('histo.comptes')::uuid[];
  v_exclus  uuid[] := current_setting('histo.exclus')::uuid[];
  v_presents int;
  n          int;
  v_autres   bigint;
  v_apres    bigint;
  v_reste    bigint := 0;
  r          record;
BEGIN
  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'HISTO_REPLICATION: session_replication_role doit rester origin';
  END IF;
  IF v_comptes && v_exclus THEN RAISE EXCEPTION 'HISTO_EXCLUS: un exclu figure parmi les comptes du relevé'; END IF;
  SELECT count(*) INTO v_presents FROM auth.users WHERE id = ANY (v_comptes);
  SELECT count(*) INTO n FROM auth.users u
   WHERE u.id = ANY (v_comptes)
     AND (NOT EXISTS (SELECT 1 FROM internal.demo_accounts d WHERE d.user_id = u.id)
          OR NOT lower(u.email) ~ '^[^@]+@demo\.athlexapp\.eu$');
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_COMPTE: % compte(s) du relevé hors internal.demo_accounts ou hors @demo.athlexapp.eu', n; END IF;
  IF v_presents NOT IN (0, cardinality(v_comptes)) THEN
    RAISE EXCEPTION 'HISTO_NOMBRE: % compte(s) présent(s) sur % au relevé (purge partielle ?)', v_presents, cardinality(v_comptes);
  END IF;

  -- Lignes d'Auth des AUTRES comptes, avant.
  SELECT coalesce(sum(c), 0) INTO v_autres FROM (
    SELECT (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %s WHERE user_id IS NOT NULL AND NOT user_id::text = ANY (%L::text[])',
             a.attrelid::regclass, v_comptes::text[]), false, true, '')))[1]::text::bigint AS c
      FROM pg_attribute a JOIN pg_class t ON t.oid = a.attrelid
     WHERE t.relnamespace = 'auth'::regnamespace AND t.relkind = 'r' AND a.attname = 'user_id' AND NOT a.attisdropped) x;

  IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE user_id = ANY (v_comptes::text[]);
  END IF;
  DELETE FROM auth.users WHERE id = ANY (v_comptes);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> v_presents THEN RAISE EXCEPTION 'HISTO_SUPPRESSION: % supprimé(s), % attendu(s)', n, v_presents; END IF;

  FOR r IN SELECT a.attrelid::regclass AS t FROM pg_attribute a JOIN pg_class t ON t.oid = a.attrelid
            WHERE t.relnamespace = 'auth'::regnamespace AND t.relkind = 'r' AND a.attname = 'user_id' AND NOT a.attisdropped LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE user_id::text = ANY ($1)', r.t) INTO n USING v_comptes::text[];
    IF n > 0 THEN RAISE NOTICE 'HISTO_RESTE_AUTH % = %', r.t, n; v_reste := v_reste + n; END IF;
  END LOOP;
  IF v_reste > 0 THEN RAISE EXCEPTION 'HISTO_RESTE_AUTH: % ligne(s) d''Auth des comptes purgés encore là', v_reste; END IF;
  SELECT coalesce(sum(c), 0) INTO v_apres FROM (
    SELECT (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %s WHERE user_id IS NOT NULL AND NOT user_id::text = ANY (%L::text[])',
             a.attrelid::regclass, v_comptes::text[]), false, true, '')))[1]::text::bigint AS c
      FROM pg_attribute a JOIN pg_class t ON t.oid = a.attrelid
     WHERE t.relnamespace = 'auth'::regnamespace AND t.relkind = 'r' AND a.attname = 'user_id' AND NOT a.attisdropped) x;
  IF v_apres <> v_autres THEN
    RAISE EXCEPTION 'HISTO_AUTH_AUTRES: lignes d''Auth des autres comptes % avant, % après', v_autres, v_apres;
  END IF;

  SELECT count(*) INTO n FROM auth.users WHERE id = ANY (v_comptes);
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_RESTE: % compte(s) du relevé encore là', n; END IF;
  SELECT count(*) INTO n FROM unnest(v_exclus) e(id)
   WHERE NOT EXISTS (SELECT 1 FROM internal.demo_accounts d JOIN auth.users u ON u.id = d.user_id WHERE d.user_id = e.id);
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_EXCLUS: % exclu(s) disparu(s)', n; END IF;
  RAISE NOTICE 'HISTO_COMPTES supprimes=% (relevé : %), lignes d''Auth des autres comptes inchangées : %', v_presents, cardinality(v_comptes), v_autres;
END $comptes$;

COMMIT;
