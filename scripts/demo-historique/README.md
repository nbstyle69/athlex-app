# Purge des comptes de démo historiques (#523)

Retire d'AthleX Fitness (`d3d0b0a0-0000-4000-a000-000000000001`) les comptes de démo créés avant la vitrine (`internal.demo_accounts`, adresses `@demo.athlexapp.eu`) et leurs tournois. Même méthode que `scripts/demo-vitrine/` (non modifié), en SQL seulement : aucun processus node.

À garder :
- le reviewer Apple (`3a60662c-35b2-4865-aa38-a9eab5ff4ecc`) : exclu de la purge, son entrée `internal.demo_accounts` reste ;
- testapple et tous les comptes réels ;
- la box, ses formules, ses WODs et sa programmation ; les autres box (Crossfit NBS2…) : aucune écriture.

## Fichiers (`sql/`)

| Fichier | Rôle |
|---|---|
| `comptes.sql` | Définition unique des comptes à purger : `internal.demo_accounts` sauf `exclus`. Gardes : exclus présents, nombre = `attendu`, adresse en `@demo.athlexapp.eu`, aucun rattachement à une autre box, aucun gérant de box. Inclus par 20, 30, 80. |
| `80-releve-purge.sql` | **Lecture seule.** Fermeture de la purge au catalogue (toutes les clés étrangères, jusqu'au point fixe), chiffrage par table, classement de chaque ligne touchée, STOP sur tout contact avec un compte réel. Écrit le relevé (hors dépôt) : comptes figés, lignes mises à NULL. |
| `20-empreinte-elo.sql` | **Lecture seule.** Lignes d'historique ELO de tous les comptes qui restent, hors tournois supprimés : prise avant 90, comparaison après 99 (chaque ligne présente et inchangée). ELO courant : information. |
| `30-empreinte-box.sql` | **Lecture seule.** Chaque ligne de `boxes` et de toute table à `box_id` (toutes les box), hors lignes qui citent un compte purgé et hors tournois listés : prise avant 90, comparaison après 99. Lignes nouvelles : information. |
| `90-tournois.sql` | `postgres`, une transaction : supprime `ids` (deux gardes de conservation désactivées par leur nom, réactivées et vérifiées avant le COMMIT), archive `archiver`. |
| `91-supprimer-lignes-fictifs.sql` | `postgres`, une transaction : supprime les lignes « fictif » du relevé (hors tables de box). |
| `92-supprimer-comptes.sql` | `postgres`, une transaction : `DELETE FROM auth.users` des comptes du relevé, chacun revérifié (demo_accounts, domaine, pas exclu). |
| `99-controle-purge.sql` | Lecture seule : 0 ligne liée aux comptes et aux tournois supprimés, lignes « fictif » parties, lignes « archive » restées à NULL, tournois archivés, exclus présents. |
| `test-rejeu.sh`, `test-fixture.sql` | Rejeu local (PG17 natif, port 54339, sans Docker), cas et mutations. |

## Classes du relevé (80)

| Classe | Cas | Traitement |
|---|---|---|
| `contact` | ligne **supprimée** qui cite un compte réel (amitié, message, inscription, match…) | **STOP** |
| `accepte` | idem, compte réel listé dans `acceptes` (par uuid, jamais un pseudo) | affichée |
| `reel` / `accepte_nul` | ligne **mise à NULL** qui cite un compte réel | **STOP** |
| `bloquant` | clé `a` / `r` vers une ligne supprimée | **STOP** |
| `tournoi_autre` | ligne mise à NULL d'un tournoi hors listes | **STOP** |
| `stripe` | colonne `*stripe*` renseignée dans la fermeture | **STOP** |
| `archive` | ligne mise à NULL d'un tournoi archivé (matchs) | reste, participants à NULL |
| `garde` | ligne d'une table de box (WOD, programmation, programme…) créée par un compte de démo | **gardée**, `created_by` à NULL |
| `fictif` | autre ligne mise à NULL qui ne cite que des comptes purgés | supprimée par 91 (STOP si une ligne qui reste la référence) |

Arrêts nommés en plus : ELO de WOD d'un réel sur un WOD scoré par un compte de démo ; réaction / commentaire / like / réponse d'un compte de démo sur un contenu réel ; achat ou suivi de programme par un compte de démo ; offre Marketplace d'un compte de démo ; WOD d'un compte de démo scoré par un réel ou programmé ; compétition inter-box ou événement ; compte purgé dans `message_groups.members` / `messages.read_by` d'une ligne qui reste ; liste d'attente derrière un compte de démo ; fichier de stockage d'un compte de démo.

**Tournois** : un tournoi au résultat validé (`internal.tournoi_resultat_valide`) est **archivé**, jamais supprimé, sauf accord explicite de Nab (il passe alors dans `ids`). Archiver ne garde que la coquille : les inscriptions, scores et ELO des comptes de démo partent avec eux, les matchs restent avec des participants à NULL.

## Ordre (étape 2, sur « go », depuis le commit de la PR à CI verte)

Heure de Paris lue par la base ; aucune écriture entre 03:30 et 04:30. `PGCLIENTENCODING=UTF8`, chaque psql en lecture seule sauf 90, 91, 92.

```bash
D=scripts/demo-historique/sql; H=~/Desktop/athlex-captures/purge-demo-historique
C="-v box=d3d0b0a0-0000-4000-a000-000000000001 -v exclus={3a60662c-35b2-4865-aa38-a9eab5ff4ecc} -v attendu=<n> -v acceptes={<reviewer>,<testapple>}"
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 $C -v tournois='{<supprimés>}' -v sortie=$H/e20.sql -f $D/20-empreinte-elo.sql
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 $C -v tournois='{<supprimés et archivés>}' -v sortie=$H/e30.sql -f $D/30-empreinte-box.sql
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 $C -v supprimer='{…}' -v archiver='{…}' -v releve=$H/releve.sql -f $D/80-releve-purge.sql
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v box=… -v ids='{…}' -v archiver='{…}' -f $D/90-tournois.sql
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v releve=$H/releve.sql -f $D/91-supprimer-lignes-fictifs.sql
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v releve=$H/releve.sql -f $D/92-supprimer-comptes.sql
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v tournois='{…}' -v archiver='{…}' -v releve=$H/releve.sql -f $D/99-controle-purge.sql
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v reference=$H/e20.sql -f $D/20-empreinte-elo.sql
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v reference=$H/e30.sql -f $D/30-empreinte-box.sql
```

Puis `grants-prod.yml` à la main, et `PROD_DB_URL` effacée.

## Test

```bash
bash scripts/demo-historique/sql/test-rejeu.sh   # rejeu local, port 54339 (voir supabase/README.md)
```
