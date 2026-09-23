-- ═════════════════════════════════════════════════════════════════════════════
-- Le rôle de l'audit nocturne lit les deux tables du signal catalogue → clés
--
-- Appliquée en prod : NON
--
-- L'audit nocturne des droits (`.github/workflows/grants-prod.yml`) se connecte
-- à la prod avec `PROD_DB_URL_RO`, sous le rôle `athlex_audit_ro` : créé à la
-- main le 21/08/2026 (LOGIN, NOINHERIT, membre d'aucun rôle), il ne lit aucune
-- table de `public`. Le signal ajouté par la migration 20270102
-- (`scripts/lib/signal-correspondances-catalogue.mjs`) lit `movement_catalog` et
-- `movement_stats_keys` ; il avait été essayé avec `PROD_DB_URL`, pas sous ce
-- rôle. Depuis le merge de #337 (23/09/2026 11:48 UTC), l'audit s'arrête sur
-- `permission denied for table movement_catalog`, à 27 assertions sur 29.
--
-- Le droit le plus étroit qui rende le signal juste :
--   * `SELECT` sur ces deux tables seulement ;
--   * une policy de lecture sur `movement_catalog` pour ce rôle seul. La RLS y
--     est active et la seule policy de lecture vise `authenticated` : sans
--     elle, le rôle lirait 0 ligne sur 324 et le signal se tairait à tort.
--     `movement_stats_keys` a déjà une policy de lecture `TO public`.
-- Rien d'autre : ni écriture, ni autre table, ni autre rôle. Le catalogue des
-- mouvements n'a aucune donnée personnelle ; tout utilisateur connecté le lit.
--
-- Sans le rôle (base de rejeu d'avant ce lot, pile locale), la migration ne fait
-- rien. `scripts/db-replay.sh` le recrée désormais comme en prod, et rejoue
-- l'audit de prod sous ce rôle : un contrôle qui aurait besoin d'un droit que le
-- rôle n'a pas échoue en CI, plus en prod.
--
-- Rejouable : `GRANT` idempotent, `DROP POLICY IF EXISTS` puis `CREATE POLICY`.
-- Contrôlée par `supabase/tests/audit_ro_lecture.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'athlex_audit_ro') THEN
    RAISE NOTICE 'rôle athlex_audit_ro absent : rien à faire sur cette base.';
    RETURN;
  END IF;

  GRANT SELECT ON public.movement_catalog, public.movement_stats_keys TO athlex_audit_ro;

  DROP POLICY IF EXISTS movement_catalog_select_audit_ro ON public.movement_catalog;
  CREATE POLICY movement_catalog_select_audit_ro ON public.movement_catalog
    AS PERMISSIVE FOR SELECT TO athlex_audit_ro
    USING (true);
END
$migration$;

COMMIT;
