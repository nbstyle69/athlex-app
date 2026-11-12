-- ═════════════════════════════════════════════════════════════════════════════
-- Démo historique (#523) — contrôle final de la purge, en lecture seule.
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v tournois='{…}' -v archiver='{…}' \
--        -v releve=<fichier écrit par 80-releve-purge.sql> -f scripts/demo-historique/sql/99-controle-purge.sql
-- Comptes : ceux figés au relevé (le fichier `releve`), pas ceux de
-- internal.demo_accounts, vidée de ces comptes par la purge.
-- Compte, dans CHAQUE colonne qui référence un compte (toute clé étrangère vers
-- auth.users ou public.profiles, lue au catalogue) et dans les colonnes sans
-- clé étrangère connues, les lignes liées aux comptes purgés ; puis les lignes
-- liées aux tournois supprimés (`tournois`). Puis : chaque ligne « fictif » du
-- relevé doit avoir disparu ; chaque ligne « archive » doit rester, colonne à
-- NULL ; chaque tournoi de `archiver` existe et est archivé ; chaque exclu
-- (reviewer) est encore dans internal.demo_accounts ; aucun compte purgé ne
-- reste dans les tableaux d'uuid (message_groups.members, messages.read_by).
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
SELECT set_config('histo.tournois', :'tournois', true) AS t, set_config('histo.archiver', :'archiver', true) AS a \gset histo_
\i :releve

DO $controle$
DECLARE
  v_comptes  uuid[] := current_setting('histo.comptes')::uuid[];
  v_tournois uuid[] := current_setting('histo.tournois')::uuid[];
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
      RAISE NOTICE 'HISTO_RESTE %.% = %', r.tbl, r.col, n;
      v_total := v_total + n;
    END IF;
  END LOOP;
  -- Lignes relevées avant la purge : aucune ne doit subsister.
  FOR r IN
    SELECT split_part(l, ',', 1) AS tbl, split_part(l, ',', 2) AS pk_col, split_part(l, ',', 3) AS pk,
           split_part(l, ',', 4) AS col, split_part(l, ',', 5) AS classe
      FROM unnest(string_to_array(current_setting('histo.releve'), ';')) l WHERE l <> ''
  LOOP
    IF r.classe = 'archive' THEN   -- la ligne reste, sa colonne à NULL
      EXECUTE format('SELECT count(*) FROM %s WHERE %I::text = $1 AND %I IS NULL', r.tbl, r.pk_col, r.col) INTO n USING r.pk;
      n := 1 - n;
    ELSE
      EXECUTE format('SELECT count(*) FROM %s WHERE %I::text = $1', r.tbl, r.pk_col) INTO n USING r.pk;
    END IF;
    IF n <> 0 THEN
      RAISE NOTICE 'HISTO_RESTE_RELEVE %.% = % (%, % à NULL)', r.tbl, r.pk_col, r.pk, r.classe, r.col;
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
  -- Tournois archivés : présents et archivés. Exclus (reviewer) : toujours marqués démo.
  SELECT cardinality(current_setting('histo.archiver')::uuid[]) - count(*) INTO n FROM public.tournaments
   WHERE id = ANY (current_setting('histo.archiver')::uuid[]) AND archived_at IS NOT NULL;
  IF n <> 0 THEN RAISE NOTICE 'HISTO_RESTE tournois à archiver absents ou non archivés = %', n; END IF;
  v_total := v_total + n;
  SELECT count(*) INTO n FROM unnest(current_setting('histo.exclus')::uuid[]) e(id)
   WHERE NOT EXISTS (SELECT 1 FROM internal.demo_accounts d WHERE d.user_id = e.id)
      OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.id);
  IF n <> 0 THEN RAISE NOTICE 'HISTO_RESTE exclus disparus (compte ou entrée demo_accounts) = %', n; END IF;
  v_total := v_total + n;
  IF v_total <> 0 THEN
    RAISE EXCEPTION 'HISTO_CONTROLE_PURGE: % ligne(s) restante(s) (voir HISTO_RESTE)', v_total;
  END IF;
  RAISE NOTICE 'HISTO_CONTROLE_PURGE colonnes=% comptes=% tournois=% lignes_relevees=% reste=0',
    v_colonnes, cardinality(v_comptes), cardinality(v_tournois), v_releve;
END $controle$;

COMMIT;
