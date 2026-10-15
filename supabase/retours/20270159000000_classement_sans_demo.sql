-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270159000000_classement_sans_demo.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test classement_sans_demo.sql le rejoue dans sa
-- propre transaction annulée).
--
-- Supprime les deux fonctions et le marqueur. La migration n'a écrit dans
-- aucune autre table : rien d'autre à remettre. Avant de le jouer, repasser
-- l'app sur l'ancienne requête (sinon le classement ne charge plus).
-- ═════════════════════════════════════════════════════════════════════════════

DROP FUNCTION public.global_leaderboard(integer, integer);
DROP FUNCTION public.global_elo_rank(integer);
DROP TABLE internal.demo_accounts;
