# Protocole de test manuel — démarrage de la caméra sans plantage, 1080p fixe

Correctif des plantages du build 1.0.59 (deux rapports iPhone du 1er octobre 2026 : exception
`-[AVCaptureSession startRunning]` non rattrapée, aperçu couché et vidéo étirée en paysage). À faire
sur un build qui contient la PR (**1.0.60**, TestFlight interne), sur l'iPhone de Nab, **avant tout
merge**. Android n'a pas changé (module Android intact) : une passe courte seulement si un appareil
est sous la main.

Réglage préalable : Minuteur → « Enregistrer avec caméra » → l'écran ne propose plus de qualité
(720p / 2K / 4K disparus) ; seules les puces 25 / 30 fps, le micro et « Bips dans la vidéo » restent.

## 1. Vingt démarrages d'affilée

Minuteur en mode caméra, For Time, décompte de 3 s. Appuyer sur **Démarrer**, attendre « Lancer le
chrono », lancer, arrêter après 3 s, « Arrêter la vidéo », puis quitter l'écran et recommencer.
Alterner à chaque passage, de façon à couvrir la grille suivante au moins une fois chacune :

| Orientation | Caméra | Micro | Cadence |
| --- | --- | --- | --- |
| Portrait | Arrière | Activé | 30 |
| Portrait | Avant | Activé | 25 |
| Portrait | Arrière | Coupé | 30 |
| Portrait | Avant | Coupé | 25 |
| Paysage | Arrière | Activé | 25 |
| Paysage | Avant | Activé | 30 |
| Paysage | Arrière | Coupé | 25 |
| Paysage | Avant | Coupé | 30 |

Attendu, à chaque fois :

- aucun plantage, aucun retour à l'écran d'accueil ;
- après **Démarrer**, le bouton affiche brièvement « Démarrage… » (grisé) puis « Lancer le chrono » ;
- l'aperçu est droit (scène dans le bon sens) **avant** et **pendant** l'enregistrement ;
- dans Photos, la vidéo est en 1080p (1920×1080 en paysage, 1080×1920 en portrait, menu « i »),
  la scène est droite, **non étirée**, et le cercle du décompte est un **cercle**, pas un ovale ;
- caméra avant : la vidéo n'est pas en miroir, le texte incrusté se lit.

## 2. Rotation entre l'ouverture et Démarrer

1. Ouvrir le mode caméra en portrait, attendre l'aperçu, tourner le téléphone en paysage, attendre
   que l'interface suive, appuyer sur Démarrer. Attendu : aperçu et vidéo en paysage, droits.
2. L'inverse : ouvrir en paysage, revenir en portrait, Démarrer. Attendu : aperçu et vidéo en portrait.
3. Tourner le téléphone **pendant** l'enregistrement. Attendu : rien ne bouge (orientation figée au
   démarrage, comme avant), la vidéo garde l'orientation du démarrage.

## 3. Changement de caméra avant Démarrer

Appuyer plusieurs fois vite sur « Retourner la caméra » (avant ↔ arrière), puis Démarrer tout de
suite. Attendu : aucun plantage, l'aperçu montre la caméra choisie en dernier, la vidéo aussi.

## 4. Arrière-plan puis retour

1. Mode caméra ouvert, aperçu visible : passer sur l'écran d'accueil iOS, revenir. Attendu : aperçu
   de nouveau visible, Démarrer fonctionne.
2. Pendant un enregistrement : passer en arrière-plan 5 s, revenir, arrêter. Attendu : pas de
   plantage ; la vidéo est sauvegardée (le son ou les images peuvent manquer pendant l'absence,
   c'est le comportement d'avant).

## 5. Échec propre (si reproductible)

Refuser l'accès à la caméra dans Réglages iOS → AthleX, ouvrir le mode caméra, Démarrer. Attendu :
alerte « Démarrage de l'enregistrement échoué » avec un motif lisible, l'écran reste ouvert, on peut
revenir en arrière. L'app n'est jamais tuée.

## Ce qui doit alerter

- Un seul plantage sur les vingt démarrages (noter le passage de la grille et l'orientation).
- Un aperçu couché ou une vidéo étirée dans une orientation ou une caméra seulement.
- « Démarrage… » qui reste affiché plus de quelques secondes.
- Une qualité encore proposée dans les réglages, ou un fichier qui n'est pas en 1080p.
