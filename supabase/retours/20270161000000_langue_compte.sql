-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270161000000_langue_compte.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : les tests le rejouent dans leur propre
-- transaction annulée).
--
-- Efface les langues écrites par l'app depuis la migration. Les fonctions Edge
-- et le Manager qui appellent langues_destinataires doivent d'abord revenir à
-- la langue du jeton, sinon 'fr'. L'app continue d'écrire `language` : son
-- upsert échoue alors sans bruit (journal Sentry), sans effet pour l'utilisateur.
-- ═════════════════════════════════════════════════════════════════════════════

DROP FUNCTION public.langues_destinataires(uuid[]);
ALTER TABLE public.notification_preferences DROP COLUMN language;
