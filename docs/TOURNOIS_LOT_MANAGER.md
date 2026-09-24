# Tournois : ce que le lot Manager doit ajouter (24/09/2026)

Les dix PR du chantier « logique sportive des tournois » (#348 à #357) sont **appliquées en prod depuis le 24/09/2026**, de 12:19 à 12:22 UTC. Le serveur applique désormais les règles sportives, mais le Manager (dépôt `AthleX-Manager`) doit s'y brancher pour que le gérant en profite.

Ce document réunit en une seule liste ce que chaque PR demandait au Manager, classée par priorité. Le détail de chaque règle est dans [`audits/TOURNOIS_LOGIQUE_SPORTIVE.md`](./audits/TOURNOIS_LOGIQUE_SPORTIVE.md) et dans la description de chaque PR.

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

- **Supprimer un tournoi** (`DeleteTournamentButton`, #351) : prévenir que **l'ELO gagné ou perdu dans ce tournoi sera retiré aux athlètes**, si possible avec le nombre d'athlètes concernés. La fenêtre doit aussi se fermer après la suppression.
- **Supprimer un match du tableau**, si l'action existe : même avertissement, à l'échelle du match.
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
