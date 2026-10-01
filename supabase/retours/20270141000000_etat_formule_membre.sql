-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270141000000_etat_formule_membre.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test etat_formule_membre.sql le rejoue dans sa
-- propre transaction annulée).
--
-- La migration n'a fait qu'ajouter une fonction : la supprimer suffit. Les
-- fonctions internes qu'elle appelle n'ont pas changé (le test vérifie leurs
-- md5 de prod avant et après).
-- ═════════════════════════════════════════════════════════════════════════════

DROP FUNCTION public.my_box_plan_status(uuid);
