-- ═════════════════════════════════════════════════════════════════════════════
-- Démo historique (#523) — suppression des comptes Auth figés au relevé (80),
-- après 90 et 91. Joué comme `postgres`, en une transaction :
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v releve=<fichier de 80> \
--        -f scripts/demo-historique/sql/92-supprimer-comptes.sql
-- Même effet que l'API admin d'Auth (DELETE de auth.users, cascades des
-- identités, sessions et de toutes les données de l'app), mais en une seule
-- transaction gardée, sans processus node.
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

  DELETE FROM auth.users WHERE id = ANY (v_comptes);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> v_presents THEN RAISE EXCEPTION 'HISTO_SUPPRESSION: % supprimé(s), % attendu(s)', n, v_presents; END IF;

  SELECT count(*) INTO n FROM auth.users WHERE id = ANY (v_comptes);
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_RESTE: % compte(s) du relevé encore là', n; END IF;
  SELECT count(*) INTO n FROM unnest(v_exclus) e(id)
   WHERE NOT EXISTS (SELECT 1 FROM internal.demo_accounts d JOIN auth.users u ON u.id = d.user_id WHERE d.user_id = e.id);
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_EXCLUS: % exclu(s) disparu(s)', n; END IF;
  RAISE NOTICE 'HISTO_COMPTES supprimes=% (relevé : %)', v_presents, cardinality(v_comptes);
END $comptes$;

COMMIT;
