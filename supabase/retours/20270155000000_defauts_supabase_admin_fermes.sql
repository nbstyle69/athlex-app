-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270155000000_defauts_supabase_admin_fermes.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- Privilèges par défaut rétablis tels qu'en prod le 14/10/2026 :
-- {postgres=X, anon=X, authenticated=X, service_role=X} pour supabase_admin
-- dans public. Seulement si la migration a pu s'appliquer.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
