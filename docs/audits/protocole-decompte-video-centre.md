# Protocole de test manuel — décompte incrusté centré dans la vidéo

Correctif du 1er octobre 2026 (retour de Nab sur le build 1.0.58 : le décompte incrusté dans la
vidéo n'était pas centré). À faire sur un build qui contient la PR, sur iPhone et sur Android.

Pour chaque vidéo : minuteur en mode caméra, décompte de **10 s** (pour voir « PRÉPARE-TOI » puis
« PRÊT ? » 3-2-1), laisser passer le GO, arrêter après 5 s, puis relire la vidéo **en plein écran**
(Photos / Galerie). Mettre en pause sur un chiffre au-dessus de 3, sur « 2 » et sur « GO ! ».

| # | Orientation | Caméra | Plateforme |
| --- | --- | --- | --- |
| 1 | Portrait | Arrière | iPhone |
| 2 | Portrait | Avant | iPhone |
| 3 | Paysage | Arrière | iPhone |
| 4 | Paysage | Avant | iPhone |
| 5 | Portrait | Arrière | Android |
| 6 | Portrait | Avant | Android |
| 7 | Paysage | Arrière | Android |
| 8 | Paysage | Avant | Android |

## Attendu sur chaque vidéo (image en pause)

- **Horizontalement** : le libellé (« PRÉPARE-TOI » / « PRÊT ? »), l'anneau (ou le halo) et le
  chiffre sont sur l'axe vertical du milieu de l'image ; le libellé n'est pas décalé vers la gauche.
- **Verticalement** : l'ensemble « libellé + anneau » est au milieu de l'image (autant d'espace
  au-dessus du libellé qu'en dessous de l'anneau, à la hauteur du titre et du chrono près).
- Le **chiffre** est au centre de l'anneau : autant de marge au-dessus qu'en dessous, « 1 » compris.
- Passer de « PRÉPARE-TOI » à « PRÊT ? » (de 4 à 3) ne fait pas sauter l'anneau.
- **« GO ! »** : la bande inclinée passe par le centre de l'image, le texte est au milieu de la bande
  (même marge au-dessus et en dessous des lettres).
- Aucun texte à l'envers en caméra avant.

Astuce : une capture d'écran de la vidéo en pause, ouverte dans l'éditeur Photos avec la grille de
recadrage, montre les axes du milieu.

## Ce qui doit alerter

- Un élément nettement hors de l'axe du milieu dans une orientation ou une caméra seulement (noter
  laquelle, avec une capture).
- Un chiffre visiblement plus près du haut ou du bas de l'anneau.
