-- ═════════════════════════════════════════════════════════════════════════════
-- Le rôle de l'audit nocturne lit les deux tables du signal, et rien d'autre
-- (migration 20270105)
--
-- Rejoué par `scripts/db-replay.sh`, qui crée `athlex_audit_ro` comme en prod
-- avant les migrations.
--   A1 le rôle lit TOUTES les lignes des deux tables (RLS comprise) ;
--   A2 il ne lit aucune autre table de `public` ;
--   A3 il n'écrit pas, pas même dans ces deux tables ;
--   A4 la policy ajoutée est exactement celle attendue ;
--   A5 le script de retour arrière (celui de la PR) retire le droit et la
--      policy — le rôle retombe sur `permission denied`.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Lecture des tables du signal par le rôle de l''audit'

BEGIN;

CREATE TEMP TABLE zz_totaux AS
  SELECT (SELECT count(*) FROM public.movement_catalog) AS catalogue,
         (SELECT count(*) FROM public.movement_stats_keys) AS cles;
GRANT SELECT ON zz_totaux TO athlex_audit_ro;

DO $t$
BEGIN
  IF (SELECT catalogue FROM zz_totaux) = 0 OR (SELECT cles FROM zz_totaux) = 0 THEN
    RAISE EXCEPTION 'contre-exemple : la base de rejeu n''a pas de catalogue ou de correspondances, le test ne prouverait rien';
  END IF;

  -- A2 : exactement deux tables de public lisibles.
  IF (SELECT string_agg(c.relname, ',' ORDER BY c.relname) FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'p')
         AND has_table_privilege('athlex_audit_ro', c.oid, 'SELECT'))
     IS DISTINCT FROM 'movement_catalog,movement_stats_keys' THEN
    RAISE EXCEPTION 'A2 : le rôle lit d''autres tables de public que les deux du signal';
  END IF;

  -- A3 : aucune écriture, nulle part dans public.
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
                AND (has_table_privilege('athlex_audit_ro', c.oid, 'INSERT')
                  OR has_table_privilege('athlex_audit_ro', c.oid, 'UPDATE')
                  OR has_table_privilege('athlex_audit_ro', c.oid, 'DELETE'))) THEN
    RAISE EXCEPTION 'A3 : le rôle a un droit d''écriture dans public';
  END IF;

  -- A4 : la policy, telle qu'attendue.
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'movement_catalog'
         AND policyname = 'movement_catalog_select_audit_ro' AND permissive = 'PERMISSIVE'
         AND cmd = 'SELECT' AND roles = '{athlex_audit_ro}' AND qual = 'true') <> 1 THEN
    RAISE EXCEPTION 'A4 : policy movement_catalog_select_audit_ro absente ou différente';
  END IF;
END $t$;

-- A1 : sous le rôle, toutes les lignes — la RLS ne les masque pas.
SET LOCAL ROLE athlex_audit_ro;
DO $t$
BEGIN
  IF (SELECT count(*) FROM public.movement_catalog) <> (SELECT catalogue FROM zz_totaux) THEN
    RAISE EXCEPTION 'A1 : le rôle ne voit pas toutes les lignes de movement_catalog';
  END IF;
  IF (SELECT count(*) FROM public.movement_stats_keys) <> (SELECT cles FROM zz_totaux) THEN
    RAISE EXCEPTION 'A1 : le rôle ne voit pas toutes les lignes de movement_stats_keys';
  END IF;
  -- A3, par le geste : l'écriture est refusée par le droit.
  BEGIN
    INSERT INTO public.movement_stats_keys (catalog_id, stats_key) VALUES ('zz', 'zz');
    RAISE EXCEPTION 'A3 : une écriture est passée';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- A2, par le geste : une autre table de public est refusée.
  BEGIN
    PERFORM 1 FROM public.profiles LIMIT 1;
    RAISE EXCEPTION 'A2 : profiles est lisible';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $t$;
RESET ROLE;

-- A5 : le retour arrière de la PR, à l'identique.
DROP POLICY IF EXISTS movement_catalog_select_audit_ro ON public.movement_catalog;
REVOKE SELECT ON public.movement_catalog, public.movement_stats_keys FROM athlex_audit_ro;

SET LOCAL ROLE athlex_audit_ro;
DO $t$
BEGIN
  BEGIN
    PERFORM 1 FROM public.movement_catalog LIMIT 1;
    RAISE EXCEPTION 'A5 : après retour arrière, movement_catalog reste lisible';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.movement_stats_keys LIMIT 1;
    RAISE EXCEPTION 'A5 : après retour arrière, movement_stats_keys reste lisible';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $t$;
RESET ROLE;

ROLLBACK;
\echo '    ok'
