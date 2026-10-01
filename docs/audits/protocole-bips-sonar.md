# Protocole de test manuel — bips « sonar » (jeu AthleX)

Nouveau son du jeu de bips **AthleX** (demande de Nab, 1er octobre 2026). Le jeu **Classique** ne change
pas. À faire sur un build qui contient la PR, sur iPhone (et si possible un Android), volume média à mi-course.

| # | Action | Résultat attendu |
| --- | --- | --- |
| 1 | Minuteur → réglages (« Design du minuteur ») → Sons activés, jeu **AthleX** | Puce AthleX sélectionnée. |
| 2 | Lancer un For Time avec décompte de 10 s, sans caméra | À 3-2-1 : trois « pings » de sonar (attaque nette, son qui s'éteint doucement en environ un tiers de seconde, légère ondulation). Aucun grésillement ni saturation, même volume au maximum. |
| 3 | Laisser arriver le départ | « GO » : ping plus aigu et plus long (près d'une seconde) que les tics, sur le même instant qu'avant (fin du décompte). |
| 4 | Arrêter le chrono (bouton stop) | Fin : trois pings qui descendent (aigu, moyen, grave). |
| 5 | EMOM 1 min × 2 : écouter le passage d'une minute à l'autre | 3-2-1 puis GO aux mêmes instants qu'avant ; les pings ne se chevauchent pas. |
| 6 | Réglages → jeu **Classique**, relancer | Les bips d'avant, identiques (bip court, bip long, double bip de fin). |
| 7 | Revenir sur **AthleX**, mode caméra, micro **coupé**, « Bips dans la vidéo » activé ; enregistrer un décompte puis GO et stop | À la relecture : les mêmes pings de sonar que ceux du haut-parleur, aux mêmes instants, sans saturation. |

## Ce qui doit alerter

- Un ping qui « claque » en fin de son (clic), ou qui sature au volume maximum.
- Un GO ou une fin décalés par rapport à l'affichage.
- Un jeu Classique qui a changé.
