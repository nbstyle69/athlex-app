-- ═════════════════════════════════════════════════════════════════════════════
-- Argent — K1 (issue #552), second fichier : les fonctions que supabase_admin
-- créera dans public ne naissent plus exécutables par anon ni authenticated.
--
-- Appliquée en prod : non
--
-- Seul dans son fichier, volontairement : en prod, les migrations passent par
-- le rôle postgres, qui n'est pas membre de supabase_admin. Ce réglage risque
-- donc d'y être refusé (« permission denied to change default privileges »).
-- Indice : 20261112 a tenté le même retrait d'anon dans un bloc qui avalait
-- le refus, et la prod porte encore anon=X pour supabase_admin. Ici, pas de
-- bloc DO ni d'EXCEPTION : un refus doit se voir. S'il survient, seul ce
-- fichier échoue ; 20270154000000 est déjà appliqué.
--
-- Constat en prod, lecture seule, le 14/10/2026 — pg_default_acl, rôle
-- supabase_admin, schéma public, fonctions :
--   {postgres=X, anon=X, authenticated=X, service_role=X}
--
-- Ces privilèges par défaut ne concernent que les fonctions créées ensuite
-- par supabase_admin dans public, pas l'existant.
--
-- Retour arrière : supabase/retours/20270155000000_defauts_supabase_admin_fermes.sql
-- ═════════════════════════════════════════════════════════════════════════════

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
