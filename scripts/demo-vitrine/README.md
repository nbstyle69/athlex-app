# Box vitrine (#523)

Pendant la revue Apple / Google, AthleX Fitness (`d3d0b0a0-0000-4000-a000-000000000001`) reçoit 50 membres fictifs, un coach fictif et 6 tournois. L'objectif : le reviewer et Nab y voient une box vivante. Tout est purgé après l'acceptation de la revue, avant la publication.

> **Merge de la PR : seulement après l'étape 4**, une fois `vitrine.ids.json` rempli (T1 à T6) et commité. Sans ces identifiants, la purge de l'étape 5 ne trouverait pas les tournois.

## Fichiers

| Fichier | Rôle |
|---|---|
| `vitrine.ts` | CLI : `seed`, `refresh`, `tournaments create\|register\|play\|finalize`, `purge`, `cles`. Écritures **connecté comme chaque compte fictif**, par les tables et RPC de l'app et du Manager. |
| `logique.ts` | Logique pure : pseudos, scores, séries de musculation, répartition des tournois, quotas, clés, sélection de la purge. |
| `__tests__/logique.test.ts` | Tests jest. `mutations.sh` prouve chaque contrôle par une mutation. |
| `sql/01-activer.sql` | `postgres`, une transaction : `internal.demo_accounts`, plus « Accès démo » en abonnement actif pour les membres. |
| `sql/proteges.sql` | Définition unique des **comptes réels protégés** (lecture seule), incluse par `10`, `20` et `vitrine.ts`. |
| `sql/10-contact-elo.sql` | **Lecture seule**, au début de `refresh`, `tournaments` et `purge` : STOP si un compte protégé a un score sur un WOD scoré par des fictifs. |
| `sql/20-empreinte-elo.sql` | **Lecture seule** : lignes d'historique ELO des comptes protégés figées avant le premier seed, contrôlées intactes après la purge ; ELO courant pour information. |
| `sql/30-empreinte-box.sql` | **Lecture seule** : empreinte de la box et des lignes à ne pas toucher (reviewer, comptes de démo, comptes protégés, tournois existants : strict ; créneaux et WODs existants : figés ; nouveaux créneaux du cron : information). Colonnes exclues : `box_elo.updated_at`, `user_movement_stats.updated_at`. |
| `sql/80-releve-purge.sql` | **Lecture seule**, avant toute suppression : relevé au catalogue des clés étrangères vers les comptes ; STOP sur les cas bloquants. |
| `sql/90-purger-tournois.sql` | `postgres`, une transaction : désactive les **deux** gardes nommées le temps de supprimer les tournois listés. |
| `sql/91-supprimer-lignes-fictifs.sql` | `postgres`, une transaction : supprime les lignes créées par les fictifs et citées par une clé en mise à NULL. |
| `sql/99-controle-purge.sql` | Lecture seule : 0 ligne restante (toutes les clés, les lignes relevées, les tableaux d'uuid). |
| `sql/test-rejeu.sh`, `sql/test-fixture.sql` | Test des SQL sur le rejeu local (PG17 natif, sans Docker), mutations comprises. |
| `vitrine.ids.json` | Identifiants techniques des tournois : `{ "vitrine": { T1…T6 }, "essai": { E1 } }`. |

## Règles

- **Par défaut, `--dry-run`** : rien n'est écrit sans `--apply`. La purge exige en plus `--yes`.
- **`--box <uuid>` est obligatoire.** Le script refuse toute box autre qu'AthleX Fitness ou une box jetable (seulement son gérant et des comptes `demo.vitrine+…`).
- **Clés : uniquement les nouvelles (#521).**
  - Clé secrète `sb_secret_…`, lue dans `SUPABASE_SECRET_KEY` puis `SUPABASE_SERVICE_ROLE_KEY`.
  - Clé publishable `sb_publishable_…`, lue dans `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` puis `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - Préfixe différent : STOP. Le message nomme la variable, jamais sa valeur.
  - `cles` vérifie les deux clés en dry-run.
  - Autres variables : `SUPABASE_URL` (ou `EXPO_PUBLIC_SUPABASE_URL`) et `PROD_DB_URL` (psql : signalement, précaution, empreinte, activation, purge).
- **Comptes** : créés par l'API admin d'Auth avec `email_confirm: true`, donc sans aucun e-mail. Le mot de passe est aléatoire, gardé en mémoire, jamais affiché ni écrit.
  - Sessions : lien magique *généré* (`generateLink`, sans envoi) puis `verifyOtp`.
  - `generateLink` n'est jamais appelé sur une adresse inexistante, car il créerait le compte.
- **Clé secrète** : elle ne sert qu'à Auth et à des lectures. Toute écriture métier est faite par le compte fictif lui-même. Seules exceptions : les SQL décidés par Nab (activation, purge).
- **Rôle coach** : donné par Nab dans le Manager, jamais par le script.
- **Reviewer** : jamais inscrit ni touché par le script.
- **ELO** : il part de 1 000 pour tous (`handle_new_user`) et n'évolue que par les fonctions serveur.

## ELO des vrais comptes : règle de contact (étape 2d)

`compute_wod_elo` et `compute_box_elo` calculent par ajouts à l'ELO courant et ne font plus rien une fois l'historique du WOD écrit (étape 2c). La purge ne peut donc pas défaire l'effet des fictifs sur l'ELO d'un vrai compte qui a scoré le même WOD qu'eux. **On n'écrit jamais sur un vrai compte.** À la place :

- **Comptes réels protégés** (`sql/proteges.sql`) : le gérant, les co-gérants, les coachs et les membres d'AthleX Fitness (tout statut), **hors** `internal.demo_accounts` et hors comptes vitrine.
- **Effet accepté** : le reviewer et les comptes de démo historiques (tous dans `internal.demo_accounts`) ne sont pas protégés. Si l'un d'eux score un WOD que des fictifs ont scoré, son ELO de WOD et de box garde l'effet des fictifs après la purge. C'est accepté (décision de Nab).
- **Précaution** : `refresh` ne fait jamais scorer un fictif sur un WOD où un compte protégé a déjà un score. Le WOD est sauté et compté (« WODs sautés »). Les scores de tournoi ne passent pas par ces fonctions : rien à sauter dans `tournaments play`.
- **Signalement** : au début de `refresh`, `tournaments` et `purge`, `10-contact-elo.sql` arrête tout, avant toute écriture, si un compte protégé a un score sur un WOD où un fictif a scoré (cas d'un vrai score posé **après** les fictifs). Il donne « WOD, date, nombre de comptes », sans identifiant de personne.
- **Empreinte de contrôle** (`20-empreinte-elo.sql`) : elle est prise par `seed` juste avant le premier compte, une fois par groupe (`essai`, `vitrine`), dans `VITRINE_DOSSIER` (défaut `~/Desktop/athlex-captures/box-vitrine`, hors dépôt). La contamination n'entre que par `compute_wod_elo` / `compute_box_elo` sur un WOD scoré par un fictif, ou par un tournoi de vitrine. On ne fige donc que ce qui existait à la prise :
  - **Lignes figées**. À la prise, l'empreinte relève l'id et le md5 (calculé par la base) de chaque ligne des comptes protégés dans `elo_history`, `box_elo_history`, `tournament_elo_history`, `tournament_match_elo_history` et `tournament_wod_elo_history`. Après la purge, chacune doit exister, inchangée. Une ligne modifiée ou supprimée → STOP, avec le nombre par table. **Rien n'est corrigé**, Nab décide.
  - **Aucune ligne nouvelle au contact**. Avant toute suppression, `80-releve-purge.sql` compte les lignes de ces historiques qui appartiennent à un compte protégé et portent sur un WOD scoré par un fictif ou sur un tournoi de la liste. Attendu : 0, sinon STOP.
  - **Lignes nouvelles ailleurs** (autres WODs, autres box, autres tournois) : permises, elles n'arrêtent rien. C'est l'activité réelle du gérant ou des membres pendant la vitrine.
  - **ELO courant** (`profiles.elo` et compteurs, `box_elo` de la box), pour information seulement : « N inchangé(s), M changé(s) », sans identifiant et sans arrêt. Il bouge légitimement.
  - Le fichier ne contient que des uuid techniques et des md5.
- **Gamification côté client** (`incrementCounter`, `athlete_badges`, `movement_logs`, push « dépassé ») : non reproduite. Les badges de tournoi, posés par l'app du gérant à la clôture, ne sont pas fabriqués non plus.

## Purge : ordre et règles

0. **Signalement de contact** (`10-contact-elo.sql`) et présence de l'empreinte de référence. Sinon STOP.
1. **Reviewer** : aucun résultat dans les tournois purgés. Sinon STOP, à remettre à la main.
2. **`80-releve-purge.sql`, en lecture seule, avant toute suppression.** Il lit au catalogue chaque clé étrangère (une colonne) vers `auth.users` et `public.profiles`, avec son `confdeltype`, et classe chaque ligne qui vise un compte à purger. Il vérifie aussi qu'aucun compte protégé n'a de ligne d'historique ELO au contact des fictifs :

   | Classe | Cas | Traitement |
   |---|---|---|
   | `tournoi` | ligne d'un tournoi de la liste | supprimée par `90` |
   | `bloquant` | clé `a` (sans action) ou `r` (restriction), hors tournoi de la liste | **STOP**, avec `table.colonne = nombre` |
   | `tournoi_autre` | ligne d'un tournoi **non** listé | **STOP** : la mise à NULL relancerait l'ELO de match |
   | `cascade` | clé `n`/`d`, mais la ligne part avec un autre parent purgé (clé `c`) | aucun : la cascade la supprime |
   | `reel` | clé `n`/`d`, et la ligne cite un compte non purgé : ligne d'un vrai compte qui cite un fictif | **STOP** |
   | `fictif` | clé `n`/`d`, et la ligne ne cite que des comptes purgés : créée par les fictifs eux-mêmes | **supprimée** par `91`, à condition que rien ne la référence (sinon STOP) |

   Il s'arrête aussi si la réservation « waiting » d'un autre compte attend sur un créneau tenu par un fictif : la purge la promouvrait.

   Les clés primaires des lignes `n`/`d` vont dans un fichier **hors dépôt** (dossier temporaire), qui ne contient que des identifiants techniques.
3. **`90-purger-tournois.sql`** : les tournois de la liste.
4. **`91-supprimer-lignes-fictifs.sql`** : les lignes `fictif`.
5. **Comptes** : supprimés par l'API admin d'Auth. La cascade efface leurs données, `internal.demo_accounts` compris.
6. **`99-controle-purge.sql`** : 0 ligne liée aux comptes et aux tournois. Aucune ligne relevée ne doit subsister : une ligne restante aurait sa colonne à NULL, orpheline. Aucun compte purgé ne doit rester dans `message_groups.members` ni `messages.read_by`.
7. **`20-empreinte-elo.sql`** en comparaison, après `99` : lignes d'historique ELO figées avant le seed toutes présentes et inchangées, sinon STOP sans correction ; ELO courant affiché pour information.

**`--include-legacy-demo`** (désactivée par défaut) :
- elle ne retient un compte historique que s'il figure dans `internal.demo_accounts` **et** que son adresse est en `@demo.athlexapp.eu`, reviewer exclu. Un compte réel ne peut jamais être pris ;
- **elle reste bloquée** (STOP immédiat) tant que Nab n'a pas tranché le sort des 6 anciens tournois de ces comptes (135 matchs).

Reviewer : `3a60662c-35b2-4865-aa38-a9eab5ff4ecc`. C'est le seul compte de `internal.demo_accounts` dont l'adresse n'est pas en `@demo.athlexapp.eu` ; il figure aussi au journal du seed.

## Ce que fait chaque commande

```bash
S="npx tsx scripts/demo-vitrine/vitrine.ts"
B="--box d3d0b0a0-0000-4000-a000-000000000001"
```

- **`cles`** :
  - vérifie les préfixes, puis fait une lecture admin ;
  - fait `generateLink` + `verifyOtp` si un compte vitrine existe déjà.
- **`seed`** :
  - crée les membres dans l'ordre de la liste, puis CoachAthleX ;
  - les rattache par `join_box_by_invite`, sans formule et sans notification ;
  - écrit le prénom affiché et appelle `mark_onboarding_completed` ;
  - s'arrête ensuite : `01-activer.sql`, puis rôle coach.
- **`refresh`** (idempotent) :
  - scores du jour et de la veille, environ 60 % des membres (`wod_scores`, `validate_strength_session`) ;
  - ELO des WODs clos de J−7 à J−2 ;
  - réservations sur 14 jours : au plus 60 % de la capacité, au moins 3 places libres.
- **`tournaments create | register | play | finalize`** :
  - le coach crée les tournois et en vérifie les formats permis ;
  - chaque fictif s'inscrit lui-même ;
  - `play` joue un tour par passage ;
  - la clôture de T1, T2 et E1 est faite par Nab ;
  - `--essai` utilise le groupe `essai` (E1, tableau à 4).
- **`purge [--essai] --apply --yes`** : voir plus haut.

## Calendrier (étape 4, sur feu vert)

| Moment | Script | Nab |
|---|---|---|
| J | `$S cles $B`, puis `$S seed $B --apply` → STOP | — |
| J | `01-activer.sql` → rapport, STOP | donne le rôle coach à CoachAthleX |
| J | `$S refresh $B --apply`, `tournaments create`, puis `register` → rapport, STOP | ouvre `league_div` avant `create` |
| J+1 après 00:15 | `$S tournaments play $B --apply` : T1 validé, tour 1 de T2, de T3 et journée 1 de T4 → STOP | clôture T1 (« Clôturer & ELO ») |
| J+1… | `play` une fois par passage : tours 2 à 4 de T2 (finale et petite finale) → STOP | clôture T2 |
| chaque jour | `$S refresh $B --apply` | — |
| fin de l'étape 4 | `vitrine.ids.json` commité ; ligne dans `docs/ETAT_DU_PROJET.md` | **merge de la PR** |
| après acceptation | `$S purge $B --apply --yes` (étape 5) | publie ensuite |

```bash
PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v box=<uuid> [-v n_membres=4] -f scripts/demo-vitrine/sql/01-activer.sql
```

## Essai (étape 3) : sur AthleX Fitness, sur feu vert

Fenêtre : **hors samedi 07:30 à 09:30 Paris**, à cause de la génération de la programmation. On vérifie avant qu'aucun cron ne touche la box pendant l'essai.

1. Empreintes « avant », md5 calculés par la base, en lecture seule, hors dépôt : `20-empreinte-elo.sql` (groupe `essai`) et `30-empreinte-box.sql`. Aucune écriture de l'essai vers 04:00 Paris (`extend-class-schedules-daily` crée alors des créneaux sur la box).
2. `$S seed $B --n 4 --apply`, plus le coach → STOP : rôle coach.
3. `01-activer.sql -v n_membres=4`.
4. `$S refresh $B --n 4 --apply`.
5. Mini-tournoi :
   - `$S tournaments create|register $B --n 4 --essai --apply` ;
   - après minuit : `play` (demi-finales), puis `play` (finale) ;
   - clôture par Nab ;
   - ses ids vont dans `vitrine.ids.json` sous `essai`.
6. Contrôles avant la purge (comptages agrégés) :
   - scores, réservations et ELO du mini-tournoi présents ;
   - 0 ligne de plus dans `box_manager_notifications` et `box_notifications` ;
   - aucun e-mail ;
   - aucun des 5 comptes au classement global.
7. `$S purge $B --n 4 --essai --apply --yes`.
8. Empreinte « après » identique à « avant », hors colonnes exclues. Sinon : STOP.

## Tests

```bash
npx jest scripts/demo-vitrine
bash scripts/demo-vitrine/mutations.sh        # chaque mutation doit être « tuée »
bash scripts/demo-vitrine/sql/test-rejeu.sh   # rejeu local sur le port 54339 (voir supabase/README.md)
```
