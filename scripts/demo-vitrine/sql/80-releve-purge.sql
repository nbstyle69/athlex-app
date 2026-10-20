-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — relevé avant purge, en LECTURE SEULE, joué avant toute
-- suppression (avant 90-purger-tournois.sql).
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v comptes='{…}' -v tournois='{…}' \
--        -v releve=<fichier hors dépôt> -f scripts/demo-vitrine/sql/80-releve-purge.sql
--
-- Lit au catalogue toutes les clés étrangères (une colonne) vers auth.users et
-- public.profiles, avec leur confdeltype, et classe chaque ligne qui vise un
-- compte à purger, hors suppression en cascade (confdeltype `c`, couverte par le
-- contrôle final) :
--   tournoi       ligne d'un tournoi de vitrine : supprimée par 90-purger-tournois ;
--   bloquant      clé `a` (sans action) ou `r` (restriction) hors tournoi de
--                 vitrine : la suppression du compte échouerait → STOP ;
--   tournoi_autre ligne d'un tournoi NON listé : la mise à NULL relancerait l'ELO
--                 de match ou laisserait un résultat orphelin → STOP ;
--   cascade       `n`/`d`, mais la ligne part avec un autre parent purgé (clé `c`) ;
--   reel          `n`/`d` et la ligne cite un compte non purgé : ligne d'un vrai
--                 compte qui cite un fictif → STOP ;
--   fictif        `n`/`d` et la ligne ne cite que des comptes purgés : créée par
--                 les fictifs eux-mêmes → supprimée par 91-supprimer-lignes-fictifs.
-- Bloque aussi si une réservation « waiting » d'un autre compte attend sur un
-- créneau tenu par un compte purgé (la purge la promouvrait).
-- Écrit dans le fichier `releve` (identifiants techniques seulement) une
-- instruction set_config que 91 et 99 rejouent par \i.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
SET default_transaction_read_only = on;
SELECT set_config('vitrine.comptes', :'comptes', false) AS c, set_config('vitrine.tournois', :'tournois', false) AS t \gset vitrine_

-- Une requête par clé étrangère n/d/a/r, construite au catalogue.
WITH fk AS (
  SELECT c.conrelid, c.conrelid::regclass::text AS tbl, a.attname::text AS col, c.confdeltype::text AS deltype
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
   WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
     AND c.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
     AND c.conrelid::regclass::text NOT LIKE 'auth.%' AND c.conrelid::regclass::text NOT LIKE 'storage.%'
), cle AS (
  SELECT i.indrelid, a.attname::text AS pk
    FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
   WHERE i.indisprimary AND i.indnatts = 1
), parTable AS (
  SELECT conrelid,
         coalesce(string_agg(format('%I = ANY (current_setting(''vitrine.comptes'')::uuid[])', col), ' OR ') FILTER (WHERE deltype = 'c'), 'false') AS cascade_expr,
         string_agg(format('(%I IS NOT NULL AND NOT %I = ANY (current_setting(''vitrine.comptes'')::uuid[]))', col, col), ' OR ') AS reel_expr
    FROM fk GROUP BY conrelid
)
SELECT string_agg(format(
  $q$SELECT %L AS tbl, %L AS pk_col, %s AS pk, %L AS col, %L AS deltype,
            CASE WHEN %s THEN 'tournoi'
                 WHEN %L IN ('a', 'r') THEN 'bloquant'
                 WHEN %s THEN 'tournoi_autre'
                 WHEN %s THEN 'cascade'
                 WHEN %s THEN 'reel'
                 ELSE 'fictif' END AS classe
       FROM %s WHERE %I = ANY (current_setting('vitrine.comptes')::uuid[])$q$,
  f.tbl, k.pk, CASE WHEN k.pk IS NULL THEN 'NULL::text' ELSE format('%I::text', k.pk) END, f.col, f.deltype,
  CASE WHEN f.conrelid = 'public.tournaments'::regclass THEN 'id = ANY (current_setting(''vitrine.tournois'')::uuid[])'
       WHEN t.attname IS NULL THEN 'false' ELSE 'tournament_id = ANY (current_setting(''vitrine.tournois'')::uuid[])' END,
  f.deltype,
  CASE WHEN f.conrelid = 'public.tournaments'::regclass THEN 'true'
       WHEN t.attname IS NULL THEN 'false' ELSE 'tournament_id IS NOT NULL' END,
  p.cascade_expr, p.reel_expr, f.tbl, f.col), ' UNION ALL ') AS releve_sql
  FROM fk f
  JOIN parTable p ON p.conrelid = f.conrelid
  LEFT JOIN cle k ON k.indrelid = f.conrelid
  LEFT JOIN pg_attribute t ON t.attrelid = f.conrelid AND t.attname = 'tournament_id' AND NOT t.attisdropped
 WHERE f.deltype <> 'c' \gset

SELECT set_config('vitrine.releve_sql', :'releve_sql', false) AS s \gset vitrine_

DO $releve$
DECLARE
  v_sql     text := current_setting('vitrine.releve_sql');
  r         record;
  v_stop    text := '';
  v_attente bigint;
BEGIN
  FOR r IN EXECUTE format('SELECT tbl, col, classe, count(*) AS n, count(*) FILTER (WHERE pk IS NULL) AS sans_pk
                             FROM (%s) x GROUP BY 1, 2, 3 ORDER BY 1, 2, 3', v_sql) LOOP
    RAISE NOTICE 'VITRINE_RELEVE %.% % = %', r.tbl, r.col, r.classe, r.n;
    IF r.classe IN ('bloquant', 'reel', 'tournoi_autre') THEN
      v_stop := v_stop || format(' %s.%s=%s (%s)', r.tbl, r.col, r.n, r.classe);
    ELSIF r.sans_pk > 0 AND r.classe <> 'tournoi' THEN
      v_stop := v_stop || format(' %s.%s=%s (sans clé primaire simple)', r.tbl, r.col, r.n);
    END IF;
  END LOOP;

  SELECT count(*) INTO v_attente
    FROM public.class_reservations w
   WHERE w.status = 'waiting'
     AND NOT w.member_id = ANY (current_setting('vitrine.comptes')::uuid[])
     AND w.schedule_id IN (SELECT schedule_id FROM public.class_reservations
                            WHERE member_id = ANY (current_setting('vitrine.comptes')::uuid[]) AND status = 'confirmed');
  IF v_attente > 0 THEN
    v_stop := v_stop || format(' class_reservations.waiting=%s (promotion à la purge)', v_attente);
  END IF;

  IF v_stop <> '' THEN
    RAISE EXCEPTION 'VITRINE_BLOQUANT:%', v_stop;
  END IF;
END $releve$;

-- Relevé pour 91 et 99 : une instruction set_config, lignes séparées par « ; ».
\pset tuples_only on
\pset format unaligned
\o :releve
SELECT format('SELECT set_config(%L, %L, false) AS r \gset vitrine_', 'vitrine.releve',
              coalesce(string_agg(concat_ws(',', tbl, pk_col, pk, col, classe), ';' ORDER BY tbl, col, pk), ''))
  FROM (:releve_sql) x;
\o
\pset tuples_only off
\pset format aligned
