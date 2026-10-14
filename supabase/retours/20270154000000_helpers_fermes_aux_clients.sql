-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270154000000_helpers_fermes_aux_clients.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test helpers_fermes_aux_clients.sql le rejoue
-- dans sa propre transaction annulée).
--
-- Droits rétablis tels qu'en prod le 14/10/2026 (précontrôle en lecture
-- seule) : authenticated seulement, jamais anon. _log_box_cash_payment était
-- déjà fermée : rien à rétablir pour elle.
-- Rouvre l'inscription à un programme payant sans paiement : à ne jouer que
-- pour annuler la migration.
-- ═════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public._upsert_program_member(uuid, uuid, date, text, integer, integer, text, text, text)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public._daily_official_template(date)
  TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;
