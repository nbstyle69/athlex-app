# Tournois : ce que le lot Manager doit ajouter (24/09/2026)

Les dix PR du chantier « logique sportive des tournois » (#348 à #357) sont **appliquées en prod depuis le 24/09/2026**, de 12:19 à 12:22 UTC. Le serveur applique désormais les règles sportives, mais le Manager (dépôt `AthleX-Manager`) doit s'y brancher pour que le gérant en profite.

Les décisions du 24/09 sur le classement de la compétition classique (#359 à #361) y sont ajoutées en priorité 2 bis.

Ce document réunit en une seule liste ce que chaque PR demandait au Manager, classée par priorité. Le détail de chaque règle est dans [`audits/TOURNOIS_LOGIQUE_SPORTIVE.md`](./audits/TOURNOIS_LOGIQUE_SPORTIVE.md) et dans la description de chaque PR.

Mise à jour du 25/09/2026 : la priorité 0 ci-dessous passe **en premier**, et la règle de suppression change (migration `20270124` : un résultat validé ne disparaît jamais, on archive).

## Priorité 0 — à faire en premier

### Format converti en « simple » à l'édition (défaut, constaté le 25/09)

- La page d'édition (`app/(dashboard)/tournaments/[id]/edit/page.tsx`, autour de la ligne 120) rend `TournamentForm` **sans `allowedFormats`**, qui vaut alors `['simple']` (`TournamentForm.tsx:35`).
- `defaultFormat` (`TournamentForm.tsx:50`) ne trouve pas le format du tournoi dans cette liste et prend `simple`, et l'enregistrement envoie tout le formulaire (`...form`, autour de la ligne 122).
- Conséquence : enregistrer une modification quelconque d'un tournoi en tableau, en double élimination ou en ligue le **convertit en « simple »**.
- Correction attendue : à l'édition, garder le format du tournoi tel quel et ne pas l'envoyer (le format ne se change pas après la création). Test : éditer le nom d'un tournoi `bracket` laisse `format = 'bracket'`.

### Archiver au lieu de supprimer (#… « Résultats validés conservés », migration `20270124`)

Un tournoi qui a un résultat validé ne se supprime plus : la base refuse (`TOURNOI_AVEC_RESULTATS`, code `23001`) et invite à archiver. Résultat validé : tournoi clôturé (`status = 'completed'`), match de tableau terminé ou forfait, score validé, saison close, ou historique ELO (match, WOD de ligue, clôture).

- **Bouton « Archiver »** à la place de « Supprimer » (`DeleteTournamentButton`, page du tournoi) quand le tournoi a un résultat validé :
  - le Manager le déduit de ce qu'il lit déjà (statut, matchs, scores) ; en cas de doute, il peut tenter la suppression et, sur `TOURNOI_AVEC_RESULTATS`, proposer l'archivage ;
  - appel : `supabase.rpc('archive_tournament', { p_tournament_id })` → la date d'archivage. Mêmes droits que la suppression (gérant, co-gérant, coach, admin plateforme).
- **Fenêtre de confirmation** : titre « Archiver ce tournoi ? ». Texte : « Ce tournoi a des résultats validés : il ne peut pas être supprimé. Archivé, il n'apparaît plus dans les listes, mais ses résultats, ses classements et l'ELO gagné par les athlètes sont conservés. Tu pourras le désarchiver. » Bouton « Archiver » (non rouge), bouton « Annuler ».
- **Supprimer** un tournoi sans résultat : inchangé. La fenêtre actuelle ne doit plus parler d'ELO retiré (voir la priorité 5, mise à jour).
- **Désarchiver** : `supabase.rpc('unarchive_tournament', { p_tournament_id })`, depuis la liste des tournois archivés.
- **Listes** : masquer les tournois où `archived_at` est renseigné, avec un filtre « Archivés ». Écrans qui lisent `tournaments` : `app/(dashboard)/page.tsx`, `app/(dashboard)/tournaments/page.tsx`, `app/(dashboard)/stats/page.tsx`, `app/admin/analytics/page.tsx`, `lib/tournaments/getTournamentForActiveBox.ts`.
- **« Régénérer le tableau »** (`regenerateBracketAction`, `bracket/actions.ts`) : il supprime d'abord tous les matchs. Sur un tableau qui a un match terminé, la base refuse désormais (`MATCH_TERMINE`) : afficher ce refus. Il ne faut plus supprimer les matchs côté Manager ; `generate_bracket_round_1` refuse déjà un tableau joué.
- **Corriger un match** : inchangé (réinitialiser, choisir le vainqueur, forfait) ; l'ELO est recalculé par la base.

## Priorité 1 — à faire avant tout tournoi réel en double élimination

Aucun tournoi `swiss` (double élimination) n'existe en prod aujourd'hui. **Le premier ne doit pas commencer avant ces points** : sans eux, le tableau des perdants reste bloqué après la finale du tableau des gagnants.

### Bouton « Tour suivant » (`BracketManager.tsx`, autour des lignes 425–450)

- Aujourd'hui, il avance sur le **dernier tour du tableau des gagnants**.
- En double élimination, il doit avancer sur le **dernier tour tous tableaux confondus** : `max(round)` des matchs du tournoi, tous côtés.
  - Les deux tableaux avancent au même numéro de tour (#352).
  - Après la finale du tableau des gagnants, les tours ne contiennent plus que des matchs du tableau des perdants.
- Il doit rester disponible **après la grande finale**. C'est l'appel `advance_bracket_round(tournoi, tour de la finale)` qui crée le match décisif quand il est dû (#353).
- « Tous les matchs du tour sont décidés » : un match est décidé quand `winner_id` est non nul. Cela couvre une victoire, une exemption (`bye`) et un forfait (`forfeit`, #355).

### Grande finale (#353)

- **Retirer `createGrandFinalAction`** et son bouton (`BracketManager.tsx:720`). Le serveur crée la grande finale à l'avancée du dernier tour, l'invaincu en premier. En attendant ce retrait, une finale créée à la main est tolérée : le serveur n'en crée pas une seconde.
- **Afficher toutes les lignes `side = 'grand_final'`**, par tour croissant :
  - la première sous « Grande finale » ;
  - la seconde, si elle existe, sous « Grande finale — match décisif ».

### Tableau des perdants (#352)

- Numéroter les colonnes **depuis 1** : le premier tour du tableau des perdants est le tour 2 du serveur.
- Les **exemptions** (`status = 'bye'`, un seul participant, vainqueur = lui-même) existent désormais des deux côtés : les afficher comme telles.

## Priorité 2 — décisions de match par le serveur (#354)

Les tableaux simples (`bracket`) existent déjà en prod, et le Manager y décide les matchs avec l'ancienne règle, où **un athlète au CAP peut battre un finisher**. C'est à brancher au plus tôt.

- **« Décider selon les scores »** (`autoResolveRound`) : remplacer `winnerFromScores` et `applyDecisionsAction` par un seul appel :
  ```ts
  supabase.rpc('decide_bracket_round', { p_tournament_id, p_round, p_wod_id })
  ```
  - `p_round` : le dernier tour, tous tableaux confondus (voir la priorité 1).
  - `p_wod_id` : le WOD de la manche (`wodForRound`). Le `wod_id` propre au match, s'il existe, prime côté serveur.
  - Retour : une ligne par match en attente, `{ match_id, winner_id, motif }`.
- **Matchs laissés à la main** (`winner_id` nul) : afficher leur motif.
  - `score_manquant` : un des deux scores est absent ou non validé ;
  - `egalite` : scores et tie-breaks identiques ;
  - `wod_absent` : aucun WOD pour ce match.
- **Confirmation** : le nombre de matchs décidés vient du retour de la RPC. Ne plus le calculer avant l'appel.
- **Supprimer `winnerFromScores` et `parseScoreVal`** une fois l'appel branché : ils portent l'ancienne règle.
- La règle appliquée : un For Time terminé bat un CAP ; entre deux CAP, le plus de reps gagne ; puis le tie-break le plus bas ; hors For Time, le score le plus haut. La clé est `tournament_score_cle`, le même ordre que la compétition classique.

## Priorité 2 bis — classement de la compétition classique par la base (#359, #360, #361)

Décision du 24/09/2026 : le barème de référence est celui de l'app (table CF Games 100, 97, 95, 93, 91…). Sur un WOD, le tie-break départage d'abord ; s'il reste une égalité, rang partagé et mêmes points, le rang suivant sauté. **La base est la seule source du calcul** : l'app ne classe plus rien depuis #361, et le Manager doit faire de même.

Aujourd'hui, le Manager calcule son propre classement avec un barème linéaire (100, 97, 94…, égalités départagées par `athlete_id`) et l'écrit dans `tournament_participants.score`. Une fois #359 appliquée, ce chiffre ne correspond plus à celui de la base, ni à la clôture ELO.

- **Cesser d'écrire `tournament_participants.score`** :
  - retirer `recalcLeaderboard` de `app/(dashboard)/tournaments/[id]/scores/ScoresClient.tsx` (autour de la ligne 55) et ses appels, à la validation comme sur le bouton de recalcul : il n'y a plus rien à recalculer ;
  - ne plus mettre `score` à l'inscription d'un athlète (0 par défaut en base).
- **Lire le classement calculé par la base** :
  - général : `supabase.rpc('tournament_classique_standings', { p_tournament_id })` → `{ athlete_id, points, final_rank }` ;
  - par WOD : `supabase.rpc('tournament_classique_wod_ranks', { p_tournament_id })` → `{ athlete_id, tournament_wod_id, wod_rank, points }`. Seuls les scores validés et lisibles y figurent. Un score rejeté, en attente ou illisible n'a pas de rang : il n'apparaît pas ;
  - à brancher sur la page Classement (`app/(dashboard)/tournaments/[id]/leaderboard/page.tsx`), qui lit aujourd'hui `tournament_participants.score` et classe chaque WOD avec `rankWodScores`.
- **Afficher le rang de la base**, pas la position dans la liste : deux ex-aequo portent le même rang et les mêmes points, et le rang suivant est sauté (1, 1, 3…).
- **Retirer le barème du Manager** : `rankClassique` et `rankWodScores` de `lib/tournamentScoring.ts`. `formatWodScore` reste utile à l'affichage.
- **Rejet d'un score** : recharger le classement après un rejet. Le score sort du calcul de la base dès qu'il est rejeté.
- **Points de division** : ils sont calculés par la base (`tournament_division_members.points`) avec la même règle d'égalité (#360). Le Manager les lit et ne les recalcule pas. Le bouton d'édition manuelle des points (`updatePoints`), s'il est gardé, est écrasé au prochain score validé.

Cas de référence pour vérifier l'écran (un For Time) : A et B en 8:00, C en 9:30, D au CAP à 150 reps, E au CAP à 140 reps, F sans score. La base rend A 100 et B 100 (1ers ex-aequo), C 95 (3e), D 93, E 91, F 0.

### Ligues : barème des divisions et général par saison (#363, #364, #365)

Décisions du 24/09/2026 :

- **Barème des divisions** : c'est désormais la table de la compétition classique (`tournament_cf_points` : 100, 97, 95, 93…), à la place du barème linéaire. La base calcule `tournament_division_members.points`.
  - Le Manager **n'a pas de barème à lui** pour les divisions : il lit ces points tels quels.
  - Tout texte qui mentionne « 100, 97, 94… » (aide, info-bulle, export) est à corriger.
- **Général d'une ligue = la saison en cours** : `supabase.rpc('tournament_ligue_standings', { p_tournament_id })` → `{ athlete_id, points, final_rank }`. C'est la somme des points de WOD de la **seule** saison en cours.
  - Pour une ligue, **ne pas** utiliser `tournament_classique_standings`, qui additionne toutes les saisons.
  - La page Classement (`leaderboard/page.tsx`) est concernée si elle affiche un général pour une ligue.
- **Saisons précédentes**, si le Manager les affiche : `tournament_ligue_standings(tournoi, saison)` donne le général final d'une saison terminée.
  - Les saisons terminées sont `1 … current_season − 1`.
  - Proposer un choix de la saison ; l'app met la plus récente d'office.
  - À n'afficher que s'il existe au moins une saison terminée.
- **Rangs** : afficher le rang de la base (`final_rank`), ex-aequo compris, comme partout.

## Priorité 3 — nouvelles possibilités du tableau

### Forfait (#355)

- **Bouton « Forfait »** sur un match à deux athlètes : choisir l'absent, puis écrire directement, sur le modèle de `setMatchWinnerAction` :
  ```ts
  { status: 'forfeit', winner_id: present, loser_id: absent, completed_at: now }
  ```
  Une contrainte serveur refuse un forfait incohérent : sans perdant, ou avec un vainqueur hors du match.
- Le prévoir aussi sur un **match déjà terminé**, pour une correction : l'ELO de ce match est alors retiré.
- **Affichage** : « Forfait » sur le match, l'absent en perdant.
- **Prévenir le gérant** qu'un forfait ne donne ni ne retire aucun point ELO.

### Petite finale, en élimination simple (#356)

- **Création d'un tournoi** `bracket` : case « Petite finale (3e place) », qui écrit `tournaments.third_place_match`. Elle est modifiable tant que les demi-finales ne sont pas avancées.
- **Tableau** : afficher la petite finale (`side = 'third_place'`), créée par le serveur avec la finale. On la décide comme un match, par la RPC de la priorité 2, et le forfait s'y applique.
- **Clôture** : la petite finale doit être jouée avant (sinon `TABLEAU_NON_TERMINE`). Le classement distingue alors le 3e du 4e.

## Priorité 4 — ligues à divisions

### Capacité et affectation par ELO (#357)

- **Capacité** : un champ « Places » (`max_members`) par division, à la création et en édition.
- **Bouton « Répartir par ELO »** : appelle `supabase.rpc('affecter_divisions', { p_tournament_id })`, qui rend le nombre d'athlètes placés.
  - À proposer surtout **avant le premier score validé** : après avoir créé les divisions, ou après avoir changé une capacité.
  - Tant que la ligue n'a aucun score validé, le serveur recalcule tous les placements automatiques à chaque inscription. Ensuite, il ne place que les nouveaux inscrits.
- **Placement manuel** : ajouter ou déplacer un athlète (`addMember`, `moveMember`) le marque déjà `placement = 'manual'`, sans rien changer côté Manager. À ajouter :
  - une **pastille** « placé à la main » ;
  - une action « **Rendre à l'automatique** », qui écrit `placement = 'auto'`.
- **Remplissage** : afficher « n / places » par division. La dernière division prend le reste et peut dépasser : le signaler.
- **Doublons** : `addMember` peut aujourd'hui placer un athlète dans une deuxième division du même tournoi. Le filtrer.

### Divisions figées au moment du WOD (#350)

- **Écran Scores d'une ligue** : afficher la division du score (`tournament_scores.division_id`), qui peut différer de la division actuelle de l'athlète.
- **Correction du gérant** : un sélecteur « Division de ce score », qui écrit `division_id`. Le gérant en a le droit ; l'athlète non.
- **Déplacer un athlète** : prévenir que ses scores déjà faits restent classés dans leur division d'origine.

### Fin de saison (#349)

- Le bouton « Fin de saison » (`DivisionsManager.tsx`) passe `p_saison_attendue: tournament.current_season` à `end_season_and_advance`.
  - Si la saison rendue vaut la saison attendue + 1, la saison est close : l'afficher.
  - Sinon, rien ne s'est passé : afficher « Saison déjà close » et recharger.
- Désactiver le bouton pendant l'appel.
- Clore une saison **sans aucun score** : confirmation explicite, puis l'appel avec `p_saison_attendue`.

## Priorité 5 — avertissements et confort

- **Supprimer un tournoi** (`DeleteTournamentButton`) : **mis à jour le 25/09** — la suppression ne retire plus aucun ELO ; elle n'est possible que sans résultat validé (sinon « Archiver », priorité 0). La fenêtre doit se fermer après la suppression.
- **Supprimer un match du tableau**, si l'action existe : refusée par la base pour un match terminé ou forfait (`MATCH_TERMINE`) ; la correction passe par la réinitialisation ou le choix du vainqueur.
- **Réinitialiser un match** (`resetMatchAction`, #348) : rien à changer. Le serveur rend désormais l'ELO du match, et corriger un vainqueur ne compte plus un match de trop. Facultatif : afficher dans la fiche du match l'écart d'ELO appliqué (`tournament_match_elo_history.elo_delta`).
- **Clôture** : le refus `TABLEAU_NON_TERMINE` peut maintenant venir d'un match décisif dû (#353) ou d'une petite finale non jouée (#356). Le message affiché gagnerait à le dire.

## Fonctions serveur disponibles

| Fonction | Rôle | Appelée par |
|---|---|---|
| `advance_bracket_round(tournoi, tour)` | tour suivant ; grande finale, match décisif et petite finale compris | le gérant |
| `decide_bracket_round(tournoi, tour, wod)` | décide les matchs en attente d'un tour | le gérant |
| `tournament_score_cle(for_time, score, cap, tie-break)` | clé de classement d'un score (la plus petite gagne) | lecture |
| `affecter_divisions(tournoi)` | répartit les athlètes par ELO dans les divisions | le gérant |
| `end_season_and_advance(tournoi, saison_attendue)` | fin de saison, sans risque de double clôture | le gérant |
| `finalize_tournament_elo(tournoi)` | clôture du tournoi | le gérant |
| `tournament_classique_standings(tournoi)` | classement général de la compétition classique (points, rang final) | lecture |
| `tournament_classique_wod_ranks(tournoi)` | rang et points de chaque athlète sur chaque WOD | lecture |
| `tournament_ligue_standings(tournoi, saison)` | général d'une ligue pour une saison (en cours par défaut) | lecture |
