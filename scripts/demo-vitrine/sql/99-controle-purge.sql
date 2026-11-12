-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — contrôle final de la purge, en lecture seule.
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v comptes='{…}' -v tournois='{…}' \
--        -v releve=<fichier écrit par 80-releve-purge.sql> -f scripts/demo-vitrine/sql/99-controle-purge.sql
-- Compte, dans CHAQUE colonne qui référence un compte (toute clé étrangère vers
-- auth.users ou public.profiles, lue au catalogue : une table ajoutée demain est
-- couverte) et dans les colonnes sans clé étrangère relevées à l'étape 1, les
-- lignes liées aux comptes purgés ; puis les lignes liées aux tournois purgés.
-- Puis : chaque ligne du relevé (clés en mise à NULL, 80-releve-purge.sql) doit
-- avoir disparu — une ligne encore là aurait sa colonne à NULL, orpheline ;
-- et aucun compte purgé ne reste dans les tableaux d'uuid sans clé étrangère
-- (message_groups.members, messages.read_by).
-- Affiche chaque compte non nul et échoue si un seul l'est.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
SET default_transaction_read_only = on;
-- Réglages qui changent le texte d'une ligne (ligne::text, dates, flottants) :
-- fixés ici, pour qu'une prise et une comparaison faites dans deux sessions
-- différentes donnent le même md5. search_path = celui de la prod.
SET TimeZone = 'UTC';
SET DateStyle = 'ISO, MDY';
SET IntervalStyle = 'postgres';
SET extra_float_digits = 1;
SET search_path = "$user", public, extensions;
BEGIN;
SELECT set_config('vitrine.comptes', :'comptes', true) AS c, set_config('vitrine.tournois', :'tournois', true) AS t \gset vitrine_
\i :releve

DO $controle$
DECLARE
  v_comptes  uuid[] := current_setting('vitrine.comptes')::uuid[];
  v_tournois uuid[] := current_setting('vitrine.tournois')::uuid[];
  r          record;
  n          bigint;
  v_total    bigint := 0;
  v_colonnes int := 0;
  v_releve   int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT c.conrelid::regclass::text AS tbl, a.attname::text AS col, 'comptes' AS cible
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
       AND c.conrelid::regclass::text NOT LIKE 'auth.%' AND c.conrelid::regclass::text NOT LIKE 'storage.%'
    UNION ALL
    SELECT * FROM (VALUES
      ('auth.users', 'id', 'comptes'),
      ('public.box_member_subscription_actions', 'member_id', 'comptes'),
      ('public.box_member_subscription_actions', 'actor_id', 'comptes'),
      ('public.tournament_match_elo_history', 'opponent_id', 'comptes'),
      ('public.tournaments', 'id', 'tournois'),
      ('public.tournament_wods', 'tournament_id', 'tournois'),
      ('public.tournament_scores', 'tournament_id', 'tournois'),
      ('public.tournament_participants', 'tournament_id', 'tournois'),
      ('public.tournament_bracket_matches', 'tournament_id', 'tournois'),
      ('public.tournament_divisions', 'tournament_id', 'tournois'),
      ('public.tournament_season_history', 'tournament_id', 'tournois'),
      ('public.tournament_notifications_sent', 'tournament_id', 'tournois'),
      ('public.tournament_elo_history', 'tournament_id', 'tournois'),
      ('public.tournament_match_elo_history', 'tournament_id', 'tournois'),
      ('public.tournament_wod_elo_history', 'tournament_id', 'tournois')) v(tbl, col, cible)
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = ANY ($1)', r.tbl, r.col)
      INTO n USING CASE r.cible WHEN 'comptes' THEN v_comptes ELSE v_tournois END;
    v_colonnes := v_colonnes + 1;
    IF n <> 0 THEN
      RAISE NOTICE 'VITRINE_RESTE %.% = %', r.tbl, r.col, n;
      v_total := v_total + n;
    END IF;
  END LOOP;
  -- Lignes relevées avant la purge : aucune ne doit subsister.
  FOR r IN
    SELECT split_part(l, ',', 1) AS tbl, split_part(l, ',', 2) AS pk_col, split_part(l, ',', 3) AS pk,
           split_part(l, ',', 4) AS col, split_part(l, ',', 5) AS classe
      FROM unnest(string_to_array(current_setting('vitrine.releve'), ';')) l WHERE l <> ''
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I::text = $1', r.tbl, r.pk_col) INTO n USING r.pk;
    IF n <> 0 THEN
      RAISE NOTICE 'VITRINE_RESTE_RELEVE %.% = % (%, % à NULL)', r.tbl, r.pk_col, r.pk, r.classe, r.col;
      v_total := v_total + n;
    END IF;
    v_releve := v_releve + 1;
  END LOOP;
  SELECT count(*) INTO n FROM public.message_groups WHERE members && v_comptes;
  v_total := v_total + n;
  SELECT count(*) INTO n FROM public.messages WHERE read_by && v_comptes;
  v_total := v_total + n;
  -- Comptes de box_member_subscription_actions sans member_id : par adhésion.
  SELECT count(*) INTO n FROM public.box_member_subscription_actions a
   WHERE a.box_member_id IN (SELECT id FROM public.box_members WHERE member_id = ANY (v_comptes));
  v_total := v_total + n;
  IF v_total <> 0 THEN
    RAISE EXCEPTION 'VITRINE_CONTROLE_PURGE: % ligne(s) restante(s) (voir VITRINE_RESTE)', v_total;
  END IF;
  RAISE NOTICE 'VITRINE_CONTROLE_PURGE colonnes=% comptes=% tournois=% lignes_relevees=% reste=0',
    v_colonnes, cardinality(v_comptes), cardinality(v_tournois), v_releve;
END $controle$;

COMMIT;
