# Protocole de test manuel — même mouvement dans deux blocs (musculation)

Correctif du 1er octobre 2026 (retours de Nab sur le build 1.0.58). À faire sur un build qui
contient la PR, sur un iPhone, avec un compte athlète membre d'une box.

## Préparation (back-office, coach ou gérant)

Publier pour **aujourd'hui** un WOD de type **Musculation** dans la box, avec cette description
exacte (deux blocs du même mouvement) :

```
Front Squat — 2 × 3 @ 65 %1RM — tempo 1" pause en bas
Front Squat — 2 × 2 @ 75 %1RM — tempo 2" pause en bas
```

Facultatif, mais utile : un second WOD « Complexe — 5 × 1 @ 60 %1RM » écrit deux fois.

## Parcours

| # | Action | Résultat attendu |
| --- | --- | --- |
| 1 | Ma Box → ouvrir le WOD « Front Squat » → « Entrer mon score » | Deux blocs « Front Squat », chacun avec **Série 1** et **Série 2** (jamais 3 ou 4). « En cours · 0 / 4 séries ». |
| 2 | Saisir des charges **différentes** dans chaque série : bloc 1 → 60 et 62,5 ; bloc 2 → 72,5 et 75 (clavier iOS, avec la virgule) | Environ 1 s après la dernière frappe : « Enregistré à l'instant ». **Jamais** « Hors connexion » avec le réseau actif. « En cours · 4 / 4 séries ». |
| 3 | « Enregistrer et continuer plus tard » | La fenêtre se ferme, aucune alerte. |
| 4 | Revenir à Ma Box | La carte du WOD affiche « En cours · 4 / 4 séries » et « Reprendre ma saisie ». |
| 5 | Fermer complètement l'app (balayer), la rouvrir, rouvrir le WOD → « Entrer mon score » | Bloc 1 : 60 et 62,5 ; bloc 2 : 72,5 et 75. Aucune case vide, aucune valeur recopiée d'un bloc à l'autre. |
| 6 | (Si possible) même compte sur un second téléphone, ou désinstaller / réinstaller : rouvrir la saisie | Mêmes valeurs qu'à l'étape 5 (elles viennent du serveur). |
| 7 | « Valider la séance » | Aucune erreur ; la fenêtre se ferme ; score de charge **75 kg**. Aucun message « Un mouvement a deux fois la même série ». |
| 8 | Regarder le détail du WOD | Bloc « Mes charges » : Front Squat Série 1 · 3 × 60, Série 2 · 3 × 62,5, puis Front Squat Série 1 · 2 × 72,5, Série 2 · 2 × 75 ; tonnage 662,5 kg ; charge max 75 kg. |
| 9 | Ma Box | La carte affiche « Validée ». |
| 10 | « Modifier mes charges » → bloc 2, série 2 : 77,5 → « Valider la séance » | Charge max 77,5 kg ; « Mes charges » ne change que cette ligne ; compteurs de séances non augmentés (une seule séance comptée). |
| 11 | Mode avion activé, ouvrir la saisie (« Entrer mon score ») d'un **autre** WOD de musculation non validé, taper une charge | « Hors connexion : ta saisie est gardée sur ce téléphone… ». Mode avion coupé : l'enregistrement repart tout seul, « Enregistré à l'instant ». |
| 12 | (Complexe, si publié) saisir les 10 séries, fermer, rouvrir | Les 10 charges reviennent, cinq par bloc, « Série 1 à 5 » dans chaque bloc. |

## Ce qui doit alerter

- « Hors connexion » alors que le réseau est actif : c'est un refus du serveur mal classé. À noter
  avec l'heure exacte.
- Le message « Enregistrement refusé par le serveur : ta saisie est gardée sur ce téléphone… » :
  la saisie doit rester à l'écran ; noter l'heure et l'étape (les journaux Supabase donneront le code).
- Une case qui se vide toute seule, ou un bloc qui affiche les valeurs de l'autre.
