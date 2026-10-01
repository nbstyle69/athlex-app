# Protocole de test manuel — bips dans la vidéo sans doublon

Correctif du 1er octobre 2026 (retour de Nab sur le build 1.0.58 : double bip à la relecture). Règle
décidée par Claude (conception) et Nab : **micro activé ET sons du téléphone activés → les bips ne sont
pas mélangés dans la piste** (le micro les capte déjà) ; ils ne sont mélangés que si le micro est coupé
ou si le téléphone est muet (sons coupés ou volume des bips à zéro).

À faire sur iPhone et si possible sur Android, dans une pièce calme, volume média à mi-course. Pour
chaque vidéo : décompte de 5 s, GO, 10 s de chrono, stop ; relire au casque.

| # | Micro | Sons du téléphone | « Bips dans la vidéo » | Attendu à la relecture |
| --- | --- | --- | --- | --- |
| 1 | activé | activés | activé | **Un seul** bip à chaque tic, au GO et à la fin (celui du haut-parleur, capté par le micro). Plus jamais de doublon ni d'écho. |
| 2 | **coupé** | activés | activé | Les bips sont dans la vidéo (mélangés), nets, calés sur l'affichage du décompte. |
| 3 | activé | **coupés** (interrupteur Sons dans les réglages du chrono) | activé | Aucun bip au téléphone pendant l'enregistrement ; à la relecture, les bips sont bien là (mélangés) avec le son ambiant du micro, calés sur le décompte (sans retard). |
| 4 | activé | activés, **volume des bips à 0 %** | activé | Comme 3 : bips présents dans la vidéo, une seule fois. |
| 5 | coupé | coupés | activé | Vidéo avec les seuls bips (piste synthétique). |
| 6 | activé | activés | **coupé** | Bips du haut-parleur captés par le micro uniquement (comme 1). |
| 7 | coupé | activés | **coupé** | Vidéo sans aucun son. |
| 8 | activé | activés au départ, **coupés pendant l'enregistrement** | activé | Avant la coupure : un seul bip (micro). Après : bips mélangés dans la vidéo. |

Réglages → « Bips dans la vidéo » : le texte d'aide explique la règle (« ajoutés à la piste si le micro
est coupé ou le téléphone muet, sinon captés par le micro »).

## Ce qui doit alerter

- Un bip entendu deux fois (ou en écho) dans le cas 1, 4 ou 8.
- Un bip absent de la vidéo dans les cas 2 à 5.
- Un bip nettement en retard sur l'affichage du décompte dans les cas 2 à 5 (le calage d'avant, pensé
  pour le doublon, est retiré).
