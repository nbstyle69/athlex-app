-- ═════════════════════════════════════════════════════════════════════════════
-- Argent — K1 (issue #552) : les fonctions internes « _* » de public ne sont
-- plus exécutables par les rôles clients, et la prochaine ne le sera pas non
-- plus par défaut (rôle postgres).
--
-- Appliquée en prod : OUI, le 14/10/2026 à 21:06 UTC, avec PGCLIENTENCODING=UTF8,
-- seule et en une transaction (dump des schémas public et internal avec droits
-- db-dumps/2026-10-14/athlex-prod-public-internal-20261014T210510Z.dump,
-- sha256 b337aafbb8171e1ceaa91349ed26f827b1317bfe89c1718dd5131547ce4b3157
-- vérifié après aller-retour, 139 TABLE DATA, 479 ACL, 348 POLICY ; md5 des
-- helpers identiques au précontrôle ; sur les 735 droits EXECUTE de public et
-- internal pour anon, authenticated et service_role, seuls changent
-- _upsert_program_member et _daily_official_template pour authenticated, et
-- les défauts de postgres dans public perdent authenticated ;
-- _upsert_program_member reste exécutable par service_role.)
--
-- Constat en prod, lecture seule (session en default_transaction_read_only),
-- le 14/10/2026 — md5 de pg_get_functiondef calculés par la base :
--   * _upsert_program_member(uuid,uuid,date,text,integer,integer,text,text,text)
--     md5 0064220744bbf51f3470d7ac257dfd35, SECURITY DEFINER, propriétaire
--     postgres, sans garde sur auth.uid() : EXECUTE à authenticated et
--     service_role (pas à anon). Un compte connecté s'inscrit lui-même à un
--     programme payant, sans paiement. Sa migration (20261117) ne révoquait
--     que PUBLIC : authenticated lui vient des privilèges par défaut ci-dessous.
--   * _log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)
--     md5 d2e9ef2e96701fbf9d2e1e62e6c72672 : déjà fermée à anon, authenticated
--     ET service_role, par 20270151 (REVOKE ALL … FROM PUBLIC, anon,
--     authenticated, service_role). Le REVOKE ci-dessous est sans effet
--     aujourd'hui ; il est gardé pour qu'une réouverture future se lise
--     comme une régression.
--   * _daily_official_template(date) : ni SECURITY DEFINER ni garde, EXECUTE à
--     authenticated. Aucun appel client dans athlex-app ni dans AthleX-Manager
--     (code, Edge Functions) ; seule appelante : ensure_daily_official_wod(),
--     SECURITY DEFINER. Fermée ici.
--   * pg_default_acl, rôle postgres, schéma public, fonctions :
--     {postgres=X, authenticated=X, service_role=X}.
--
-- Chemin d'appel (prod, 14/10/2026) : ces trois fonctions ne sont appelées que
-- par des fonctions SECURITY DEFINER dont le propriétaire est postgres —
-- record_member_cash_payment, mark_box_invitation_paid, create_box_invitation,
-- assign_program_cash (_log_box_cash_payment), join_program, assign_program_cash
-- (_upsert_program_member), ensure_daily_official_wod (_daily_official_template).
-- L'appel interne s'exécute avec les droits de postgres : le REVOKE ne change
-- rien pour elles. Aucune vue, policy ni tâche cron ne les cite.
--
-- Ce que fait cette migration, et rien d'autre : aucune définition de fonction,
-- aucune policy n'est touchée.
--
-- Retour arrière : supabase/retours/20270154000000_helpers_fermes_aux_clients.sql
-- Contrôles : supabase/tests/helpers_fermes_aux_clients.sql, audit T19a / T19b.
-- ═════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public._upsert_program_member(uuid, uuid, date, text, integer, integer, text, text, text)
  FROM anon, authenticated;

-- Confirmé déjà fermée en prod par 20270151 (précontrôle du 14/10/2026) :
-- sans effet aujourd'hui, protège contre une réouverture.
REVOKE EXECUTE ON FUNCTION public._log_box_cash_payment(uuid, uuid, uuid, uuid, text, integer, date, date, uuid, integer, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._daily_official_template(date)
  FROM anon, authenticated;

-- Privilèges par défaut : ils ne concernent QUE les fonctions créées ensuite
-- par postgres dans public, pas l'existant (déjà traité au cas par cas
-- ci-dessus). Conséquence : toute nouvelle fonction appelée par l'app doit
-- recevoir un GRANT EXECUTE … TO authenticated explicite, sinon elle sera
-- inappelable (voir docs/REGLES_DE_VERIFICATION.md).
-- Le même réglage pour supabase_admin, tenté seul le 14/10/2026 à 21:06 UTC
-- depuis postgres, a été refusé en prod (« permission denied to change default
-- privileges ») : il repartira dans une PR dédiée. Les fonctions que
-- supabase_admin crée dans public naissent donc encore ouvertes.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
