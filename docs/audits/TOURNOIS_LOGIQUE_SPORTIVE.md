# Logique sportive des tournois — état des lieux et plan (24/09/2026)

Étape 0 du chantier, en lecture seule. Les PR qui suivent y renvoient.

## Prod et dépôt : identiques

Empreintes des 56 fonctions et triggers de tournoi, prod contre base de rejeu (ce que décrit le dépôt) :

- **47 identiques** octet pour octet ;
- **9 qui ne diffèrent que par des blancs** (0 ligne d'écart hors blancs) : `auto_assign_lowest_division`, `calculate_elo`, `end_season_and_advance`, `generate_bracket_round_1`, `get_tournament_participants`, `get_tournament_validated_scores`, `promote_relegate_divisions`, `tournament_wods_set_season`, `update_user_elo` ;
- aucune absente d'un côté ou de l'autre.

Données en prod au 24/09 :

- 8 tournois, formats `bracket` et `simple` seulement. **Aucune** double élimination (`swiss`), **aucune** division (`league_div`) ;
- 135 matchs de tableau, dont 133 terminés, avec 133 historiques ELO de deux lignes, tous conformes à l'état de leur match ;
- 4 lignes d'historique de clôture ELO (`tournament_elo_history`), **toutes orphelines** : ce sont les clôtures de tournois déjà supprimés en juillet et août (JCVD, in the bar), dont l'ELO est resté sur les profils. La PR 4 ne les touche pas ; les retirer rétroactivement est une décision de Nab.

## Ce que fait chaque sujet aujourd'hui

| Sujet | Fonction | Écart avec les règles produit |
|---|---|---|
| ELO de match | `apply_bracket_match_elo` (AFTER INSERT/UPDATE OF winner_id, status) | réécrire un match terminé **sans changer de vainqueur réapplique l'ELO et les compteurs**. L'historique est protégé, le profil non. Un match supprimé ne rend rien |
| Fin de saison | `end_season_and_advance` | un second appel clôt une nouvelle saison à 0 point, rejoue promotions et relégations sur ce classement vide, et saute une saison |
| Points de division | `internal.recalc_division_points` | calculés sur l'appartenance **actuelle**, et **toutes saisons confondues** : après une fin de saison, le score suivant ramène les WOD des saisons passées |
| Affectation | `auto_assign_lowest_division` | toujours la division du bas. `max_members` (16 par défaut) n'est lu nulle part |
| Suppression d'un tournoi | cascade depuis `tournaments` | matchs, scores et WOD supprimés, **l'ELO reste sur les profils**. Les historiques survivent, par la migration `20261129`, voulue alors |
| Élimination simple | `generate_bracket_round_1` / `advance_bracket_round` | exemptions gérées ; pas de petite finale |
| Double élimination | `advance_bracket_round` (`swiss`) | tableau des perdants apparié par `LEAST(…)` : des athlètes sont omis ; un vainqueur isolé n'a pas d'exemption ; **pas de grande finale**, que le Manager crée à la main |
| Comparaison en tableau | Manager, `winnerFromScores` (`BracketManager.tsx:183`) | ignore `capped` et `tiebreak_value`, applique « le plus bas gagne » à tout For Time : **un cappé peut battre un finisher** |

Sources d'ELO d'un tournoi :

- **`simple`** : la clôture (`finalize_tournament_elo`) applique l'ELO et l'enregistre dans `tournament_elo_history` ;
- **`bracket` et `swiss`** : chaque match applique son ELO (`tournament_match_elo_history`) ; la clôture n'enregistre qu'un récapitulatif ;
- **`league_div`** : l'ELO s'applique par WOD (`tournament_wod_elo_history`).

## Barèmes de la compétition classique : trois versions

Rien n'est corrigé ici : le choix de la référence appartient à Nab.

| | App | Manager | SQL (qui fixe l'ELO de clôture) |
|---|---|---|---|
| Barème | table CF Games : 100, 97, 95, 93, 91… | linéaire : 100, 97, 94, 91, 88… (plancher 1) | même linéaire |
| Code | `src/utils/tournamentUtils.ts:4-14` | `lib/tournamentScoring.ts:166` | `tournament_classique_standings`, migration `20261128` |
| Ex-aequo sur un WOD | rang partagé, mêmes points | départagés par `athlete_id` | départagés par `athlete_id` |
| Tie-break | ne sert qu'à décider si le rang est partagé | ignoré si un seul des deux en a un | dans le tri |
| Égalité au général | positions selon l'ordre du tableau | ordre non déterministe | rang partagé (`RANK()`) |

Exemple : un WOD For Time. A et B finissent en 8:00, C en 9:30, D cappé à 150 reps, E cappé à 140 reps, F n'a pas de score.

| | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| App | 100 | **100** | **95** | 93 | 91 | 0 |
| Manager et SQL | 100 | **97** | **94** | 91 | 88 | 0 |

L'ordre est le même partout ; seuls les points diffèrent.

Autres écarts :

- l'app et le Manager écrivent tous deux `tournament_participants.score`, chacun avec son barème : le dernier recalcul l'emporte ;
- le rejet d'un score ne relance aucun recalcul ;
- un For Time illisible vaut 0 s dans l'app, donc la 1re place ;
- aucune des trois versions ne sépare les sexes ni RX et scaled.

## Plan des PR (une par sujet, dans l'ordre)

1. **ELO de match idempotent** (`20270106`). L'effet se déduit de l'état du match et se compare à l'effet enregistré ; s'ils diffèrent, l'enregistré est défait exactement avant d'appliquer le nouveau.
2. **Fin de saison idempotente.** Verrou sur la ligne du tournoi, et `p_saison_attendue` en option : si elle ne correspond pas à la saison en cours, rien ne se passe. Sans ce paramètre, l'appel ne fait rien quand la saison en cours n'a aucun score validé et que la précédente vient d'être close.
3. **Divisions figées au moment du WOD.** `tournament_scores.division_id` est posé à l'insertion. Les points se classent par division du score, sur la saison en cours seulement.
4. **Suppression d'un tournoi.** Trigger BEFORE DELETE sur `tournaments`, et sur les matchs de tableau, qui défait exactement ce qui a été appliqué (ELO de match, ELO de WOD, clôture `simple`, compteurs) puis supprime ces historiques.
5. **Double élimination complète** (`20270110`). Aucun athlète omis ; exemption si le nombre est impair ; élimination à la deuxième défaite. Les deux tableaux avancent au même numéro de tour : le tableau des perdants commence au tour 2.
6. **Grande finale avec reset** (`20270111`). Création automatique, puis second match si le vainqueur du tableau des perdants gagne. Une grande finale déjà créée par le Manager est tolérée. Le classement de clôture suit la dernière finale.
7. **Comparaison en tableau.** Une fonction SQL applique la règle ; une RPC décide les matchs d'une manche.
8. **Forfait.** Statut `forfeit` : l'absent est perdant, l'adversaire passe, l'ELO ne bouge pas.
9. **Petite finale optionnelle.** `tournaments.third_place_match`, et le côté `third_place` en élimination simple.
10. **Divisions.** Colonne `placement` (`auto` ou `manual`, `manual` par défaut) ; affectation par ELO dans la limite de `max_members`, débordement vers la division suivante ; un placement manuel n'est jamais déplacé.

Aucun point n'exige de refonte importante du schéma : quelques colonnes, et des valeurs ajoutées aux contraintes.

## Points de vigilance

- **Double élimination.** Les PR 5 et 6 réécrivent l'algorithme de progression. Aucun tournoi `swiss` n'existe en prod, mais la logique est délicate : tests de 3 à 9 athlètes.
- **Écritures du Manager.** Le Manager écrit lui-même les matchs de tableau (vainqueur, remise à zéro, grande finale à la main). La progression côté serveur doit tolérer ce qu'il a déjà fait, jusqu'au lot Manager.
- **Retrait exact.** On retire le delta enregistré. Le plancher de 100 est gardé par sûreté ; il ne s'écarte du retrait exact que si l'athlète est passé sous 100 entre-temps.
- **ELO des défis 1 contre 1.** La table `matches` (1 ligne en prod) a ses propres défauts, notamment aucun retrait si le vainqueur change. C'est hors de ce chantier, et seulement signalé.
