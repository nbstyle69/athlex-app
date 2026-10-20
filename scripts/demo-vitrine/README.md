# Box vitrine (#523)

Pendant la revue Apple / Google, AthleX Fitness (`d3d0b0a0-0000-4000-a000-000000000001`) reçoit 50 membres fictifs, un coach fictif et 6 tournois. L'objectif : le reviewer et Nab y voient une box vivante. Tout est purgé après l'acceptation de la revue, avant la publication.

## Fichiers

| Fichier | Rôle |
|---|---|
| `vitrine.ts` | CLI : `seed`, `refresh`, `tournaments create\|register\|play\|finalize`, `purge`. Écritures **connecté comme chaque compte fictif**, par les tables et RPC de l'app et du Manager. |
| `logique.ts` | Logique pure : pseudos, scores, séries de musculation, répartition des tournois, quotas, sélection de la purge. |
| `__tests__/logique.test.ts` | Tests jest de la logique. `mutations.sh` prouve chaque contrôle par une mutation. |
| `sql/01-activer.sql` | `postgres`, une transaction : `internal.demo_accounts`, plus « Accès démo » en abonnement actif pour les membres. |
| `sql/90-purger-tournois.sql` | `postgres`, une transaction : désactive les **deux** gardes nommées le temps de supprimer les tournois listés. |
| `sql/99-controle-purge.sql` | Lecture seule : 0 ligne restante dans chaque table liée aux comptes ou aux tournois purgés. |
| `sql/test-rejeu.sh`, `sql/test-fixture.sql` | Test des trois scripts SQL sur le rejeu local (PG17 natif, sans Docker), mutations comprises. |
| `vitrine.ids.json` | Identifiants techniques des tournois, par box. |

## Règles

- **Par défaut, `--dry-run`** : rien n'est écrit sans `--apply`. La purge exige en plus `--yes`.
- **`--box <uuid>` est obligatoire.** Le script refuse toute box autre qu'AthleX Fitness ou une box jetable. Une box jetable ne contient que son gérant et des comptes `demo.vitrine+…`.
- **Comptes** : créés par l'API admin d'Auth avec `email_confirm: true`, donc sans aucun e-mail. Le mot de passe est aléatoire, gardé en mémoire, jamais affiché ni écrit. Les sessions suivantes passent par un lien magique *généré* (`generateLink`, sans envoi).
- **Clé serveur** : elle ne sert qu'à Auth et à des lectures. Toute écriture métier est faite par le compte fictif lui-même. Seules exceptions : les deux scripts SQL décidés par Nab (activation, purge des tournois).
- **Rôle coach** : donné par Nab dans le Manager, jamais par le script.
- **Reviewer** : jamais inscrit ni touché par le script.
- **ELO** : il part de 1 000 pour tous (`handle_new_user`) et n'évolue que par les fonctions serveur (`compute_wod_elo`, ELO de match, `compute_league_wod_elo`, `finalize_tournament_elo`). Aucun ELO de départ n'est écrit.
- **Badges, compteurs et crédits de mouvement** : la gamification posée par l'app côté client (`incrementCounter`, `athlete_badges`, `movement_logs`) n'est **pas** reproduite. Ce sont des écritures directes, pas des fonctions serveur. Les badges de tournoi, posés par l'app du gérant à la clôture, ne sont pas fabriqués non plus.

Variables d'environnement : `SUPABASE_URL` (ou `EXPO_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, et `PROD_DB_URL` pour psql. Aucune n'est affichée.

```bash
S="npx tsx scripts/demo-vitrine/vitrine.ts"
B="--box d3d0b0a0-0000-4000-a000-000000000001"
```

## Ce que fait chaque commande

- **`seed`** :
  - crée les 50 membres dans l'ordre de la liste, puis CoachAthleX. Les métadonnées `username`, `gender` et `level` sont lues par `handle_new_user` ;
  - rattache chaque compte par `join_box_by_invite`, sans formule et sans notification ;
  - écrit le prénom affiché (`full_name`) et appelle `mark_onboarding_completed` ;
  - s'arrête ensuite : il reste à jouer `01-activer.sql` et à faire donner le rôle coach.
- **`refresh`** (idempotent) :
  - **scores du jour et de la veille**, seulement ce que l'app laisse encore saisir : environ 60 % des membres par WOD. Upsert dans `wod_scores` ; pour la musculation, `validate_strength_session`, ce qui donne les 1RM ;
  - **ELO** des WODs clos de J−7 à J−2 (`compute_wod_elo` puis `compute_box_elo`, sans effet si l'ELO est déjà calculé) ;
  - **réservations** sur 14 jours : au plus 60 % de la capacité, au moins 3 places libres, un créneau par membre et par jour.
- **`tournaments create`** (par le coach) :
  - T1 à T4 avec `start_date` = J+1 00:00 Paris, T5 et T6 sans date (« à venir ») ;
  - divisions de T4 (3 × 8) et WODs de chaque tournoi ;
  - refuse un format non permis sur la box (`allowed_tournament_formats`).
- **`tournaments register`** : chaque fictif s'inscrit lui-même.
- **`tournaments play`** (par le coach, un tour par passage) :
  - ouverture du WOD, scores des athlètes, validation ;
  - pour les tableaux, en plus : `generate_bracket_round_1`, `decide_bracket_round` puis `advance_bracket_round` ;
  - pour la ligue, en plus : `compute_league_wod_elo` ;
  - T3 et T4 s'arrêtent après le premier tour ou la première journée.
- **`tournaments finalize`** : vérifie que T1 et T2 ont été clôturés par Nab (`finalize_tournament_elo` est réservée au gérant).
- **`purge`** :
  1. vérifications préalables : le reviewer n'a aucun résultat dans ces tournois, et aucun compte purgé ne figure dans un match d'un autre tournoi ;
  2. `90-purger-tournois.sql` ;
  3. suppression des comptes par l'API admin d'Auth : la cascade efface leurs données, `internal.demo_accounts` compris ;
  4. `99-controle-purge.sql`, qui doit trouver 0.

  Avec `--include-legacy-demo` (**jamais sans le feu vert explicite de Nab**), la purge s'étend aux comptes de `internal.demo_accounts` rattachés à AthleX Fitness, reviewer exclu. Le reviewer est le **seul** compte de `internal.demo_accounts` dont l'adresse n'est pas en `@demo.athlexapp.eu`. Telle quelle, cette option s'arrête sur la vérification « matchs d'autres tournois » : les comptes historiques jouent 135 matchs dans 6 anciens tournois, et c'est à Nab de trancher.

## Calendrier (étape 4)

| Moment | Script | Nab |
|---|---|---|
| J | `$S seed $B --apply` → STOP | — |
| J | `01-activer.sql` (feu vert) → rapport, STOP | donne le rôle coach à CoachAthleX |
| J | `$S refresh $B --apply` ; `$S tournaments create $B --apply` ; `$S tournaments register $B --apply` → rapport, STOP | ouvre `league_div` avant `create` |
| J+1 après 00:15 | `$S tournaments play $B --apply` : T1 validé, tour 1 de T2, de T3 et journée 1 de T4 → STOP | clôture T1 (« Clôturer & ELO ») |
| J+1… | `play` une fois par passage : tours 2, 3, puis 4 de T2 (finale et petite finale) → STOP | clôture T2 |
| après chaque clôture | `$S tournaments finalize $B` | — |
| chaque jour | `$S refresh $B --apply` | — |
| après acceptation | `$S purge $B --apply --yes` (étape 5, feu vert) | publie ensuite |

`01-activer.sql` :

```bash
PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v box=<uuid> [-v n_membres=4] -f scripts/demo-vitrine/sql/01-activer.sql
```

## Essai (étape 3, box jetable)

La box jetable doit avoir sa formule « Accès démo » (abonnement, 0 €), à créer dans le Manager, et deux créneaux. Elle doit autoriser le format `bracket`.

```bash
$S seed --box <jetable> --n 4 --apply
# 01-activer.sql -v box=<jetable> -v n_membres=4, puis rôle coach
$S refresh --box <jetable> --n 4 --apply
$S tournaments create --box <jetable> --n 4 --essai --apply          # tableau à 4, J+1
$S tournaments register --box <jetable> --n 4 --essai --apply
# après minuit : play deux fois (demi-finales, puis finale), puis clôture par Nab
$S purge --box <jetable> --n 4 --apply --yes
```

## Tests

```bash
npx jest scripts/demo-vitrine
bash scripts/demo-vitrine/mutations.sh        # chaque mutation doit être « tuée »
bash scripts/demo-vitrine/sql/test-rejeu.sh   # rejeu local sur le port 54339 (voir supabase/README.md)
```
