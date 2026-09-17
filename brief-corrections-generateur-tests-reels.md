# Brief — Corrections du générateur après tests réels (lots A et B)

Repo : `athlex-app`. Issu d'une passe de tests réels de Nab sur le build 1.0.54. Deux lots séparés :

- **Lot A — données** : migration seule, visible dans l'app sans nouveau build.
- **Lot B — code** : part dans le build 1.0.55, à ne pas déclencher avant validation de Nab.

Règles habituelles : recon lecture seule avec rapport avant code, migration non appliquée en prod sans accord, `pg_dump` avant application, écart brief/réel signalé et non résolu en silence, PR ouverte et attente du merge de Nab pour tout ce qui touche migration, moteur ou Edge Function.

---

## Lot A — données

### A1. Catalogue sans matériel trop mince

Constat : en Musculation « Sans matériel », Pike Push-Ups et Wall Triceps Extension reviennent sur presque tous les tirages. Le catalogue n'a quasiment rien d'autre pour les épaules et les triceps au poids du corps, et la règle de priorité (le meilleur exercice disponible pour le muscle) sort donc toujours le même.

Deux corrections combinées :

1. Élargir le catalogue sans matériel d'une trentaine d'exercices, avec leurs colonnes muscu complètes (muscle principal et secondaires, `compound`, `unilateral`, `level_min`, `load_mode = bodyweight`, `seconds_per_rep`, `setup_s`, `objectives`, `rep_ranges_muscu`, `priority`, `movement_group`, `weight_bodyweight > 0`, poids metcon à 0). Couvrir en priorité les manques : épaules (pompes piquées surélevées, pompes hindu, handstand hold, prone Y-T-W, reverse snow angels), triceps (pompes diamant déclinées, extensions triceps au sol, pompes serrées sur box), pecs (pompes archer, pompes déclinées pieds sur mur, pompes lestées d'un sac), dos (rowing inversé sous table, superman pull, scapular pull-ups), jambes (cossack squat, shrimp squat, sissy squat, fentes sautées, mollets unilatéraux), tronc (dead bug lesté, V-ups, toes-to-bar au sol, side plank avec rotation).
2. En mode Sans matériel uniquement, le slot principal tire au hasard parmi les **deux premières priorités** du muscle au lieu de prendre toujours la première, et un exercice sorti dans les trois derniers tirages de l'athlète est pénalisé.

Test : sur 200 tirages « Sans matériel » par cible, aucun exercice n'apparaît dans plus de 40 % des séances.

### A2. Anti-répétition hebdomadaire côté Musculation

Constat sur la piste Musculation d'AthleX Fitness : Superman Hold sur deux jours consécutifs, hip thrust et DB hip thrust la même semaine, Ab Wheel en carte Jambes, Oblique Raise en carte Push.

Règle à ajouter, sur le modèle de celle de la piste Hybrid : un exercice (et son `movement_group`) n'apparaît qu'une fois dans la semaine ; deux fois tolérées seulement s'ils ne sont pas sur deux jours consécutifs et pas dans le même rôle. Au-delà, relâchement tracé en nommant l'exercice. Les variantes du même geste (hip thrust barre / DB / machine) comptent comme un seul exercice.

### A3. Corde à sauter jamais tirée

Constat : `jump_rope` (Double Unders, Single Unders) ne sort jamais dans le générateur Functional, même en retirant un maximum d'exclusions. Le mouvement est au catalogue avec un poids de tirage élevé.

Diagnostic à faire avant correction : poids réels en base, présence dans les slots des squelettes, effet des plafonds de volume, effet du filtre d'équipement (`jump_rope` est-il requis et absent de la liste par défaut ?). Rapporter la cause avant de corriger, puis corriger là où elle se trouve — poids, squelettes ou filtre. Test : sur 500 tirages Functional sans exclusion, les double unders apparaissent dans au moins 15 % des WODs.

---

## Lot B — code (build 1.0.55)

### B1. Écran du générateur — titre et alignement

En discipline Functional, le titre n'affiche pas la discipline alors que Hybrid et Musculation le font (« Générateur de WOD · Hybrid »). Ajouter « Functional », et placer les deux lignes centrées sous le titre « Générateur de WOD », de la même façon pour les trois disciplines.

### B2. Encart « Classe du jour »

Le texte touche les bords de l'encart et la troisième ligne est coupée. Padding intérieur 16 px minimum, hauteur libre, texte non tronqué sur trois lignes, même style que les cartes de la page résultat.

### B3. Options avancées — libellés et recherche

- Les exclusions affichent les identifiants techniques (`band`, `barbell`, `bench`, `bike_erg`, `jump_rope`). Afficher les noms en français (Élastique, Barre, Banc, Vélo, Corde à sauter…), avec une table de libellés FR/EN ; la valeur interne reste l'identifiant.
- Quand le clavier s'ouvre pour rechercher un mouvement à exclure, le champ de recherche est masqué par le clavier. Le champ doit rester visible au-dessus du clavier (`KeyboardAvoidingView` ou équivalent), et la liste de résultats défiler sous lui.

### B4. Navigation — mémoire de pile par onglet

Aujourd'hui, changer d'onglet puis revenir remet l'onglet à sa racine : l'athlète doit refaire toute la navigation. Attendu :

- chaque onglet conserve sa pile : Accueil → Calculateur 1RM, puis Ma Box, puis retour sur Accueil ⇒ on retrouve le Calculateur ;
- un **double appui** sur l'onglet déjà actif ramène à la racine de cet onglet.

À appliquer aux cinq onglets. Test sur les deux comportements.

### B5. Minuteur — mode Split

Ajouter `SeqBlock.type = 'split'` aux quatre modes existants : chrono global qui tourne, bouton « Série terminée » qui enregistre un split et lance le compte à rebours du repos de l'exercice courant (`rest_s` du `wod_json`), passage à l'exercice suivant quand toutes ses séries sont faites, liste des splits en fin de séance. C'est le mode par défaut pour une séance Musculation ; utilisable aussi pour splitter un metcon par round.

### B6. Retour à la séance après le minuteur, sans enregistrement

Constat : l'athlète qui lance le minuteur sans avoir enregistré la séance perd le WOD généré. Attendu : le WOD généré est conservé en brouillon local (clé par utilisateur, purgée à la déconnexion) dès la génération ; au retour du minuteur, la page résultat se rouvre avec la même séance, ses charges et son état. Le brouillon est remplacé au tirage suivant et effacé à l'enregistrement.

### B7. Ajouter au Whiteboard — date libre et blocs par exercice

- **Date** : un sélecteur de date, sans limite de plage (passé et futur autorisés), avec le jour même par défaut.
- **Découpage** : la séance n'est plus insérée comme un bloc de texte unique. Chaque exercice (Musculation) ou chaque bloc (Functional / Hybrid : skill, force, building, wod, finisher) devient une ligne `box_wods` distincte, avec son `block_name`, son `sort_order`, son `wod_json` et sa description rendue, comme une séance de box. Conséquence attendue : l'athlète peut valider ses blocs un par un depuis le Whiteboard (onglet réalisé) et saisir un score par bloc.

### B8. Calculateur 1RM — section Gymnastique

Ajouter une section Gymnastique au calculateur, sur le **modèle exact de la table des barres** (lignes colorées, colonnes % / reps / zone, même mise en forme) :

- le sélecteur « Choisir un mouvement (mes PR) » liste aussi les mouvements gymniques du profil (Toes To Bar, Pull-ups, Chest To Bar, HSPU, Strict HSPU, Ring Muscle-up, Bar Muscle-up, Dips…) avec leur record en reps ;
- la table donne le nombre de répétitions par palier de **10 % en 10 %, de 10 % à 150 %** du record (record 50 tractions → 50 % = 25, 100 % = 50, 150 % = 75), arrondi à l'entier ;
- les zones affichées sont adaptées au gymnique (volume facile, volume de travail, série limite, au-delà du record), à proposer par Claude Code dans la PR pour validation.

### B9. Suppression du bloc « Gymnastique — ce que je maîtrise »

Le bloc de paliers à cocher du Profil → PR (Tractions / HSPU / Toes-to-Bar / Double-unders) est supprimé. Il est en outre visiblement cassé : « Toes-to-Bar » apparaît quatre fois, « Deficit HSPU » deux fois, libellés en anglais, et le niveau affiché à droite (« niveau Elite ») ne correspond pas au niveau du profil.

**Avant de supprimer** : vérifier si ce bloc est réellement consommé par le générateur (choix des variantes) et le rapporter. S'il l'est, sa fonction est reprise par B10 avant suppression ; s'il ne l'est pas, suppression simple. Dans les deux cas, ne rien supprimer sans mon accord dans la PR.

### B10. Les PR gym pilotent le générateur

Le bloc « Gymnastique » du Profil (records chiffrés en reps) devient la source de vérité pour les mouvements gymniques du générateur, en plus de la catégorie :

- un mouvement gymnique dont le record est absent ou à 0 est **substitué** par sa variante accessible (Ring Muscle-up absent → Bar Muscle-up, puis Chest To Bar, puis Pull-ups, puis Banded Pull-ups, puis Ring Rows) ;
- le volume d'un mouvement gymnique dans un WOD est **borné par le record** : jamais plus de 60 % du record en volume total sur un WOD (record 12 tractions → 7 tractions maximum au total, pas 45) ;
- la catégorie reste la source pour les charges ; le record gym prime sur elle pour les variantes gymniques.

Tests : profil sans aucun record gym (comportement actuel par catégorie, inchangé) ; profil avec 12 tractions et 0 muscle-up (aucun muscle-up tiré, volume de tractions ≤ 7) ; profil complet (comportement RX normal).

### B11. Saisie des temps en minutes et secondes

Dans Profil → PR, section Cardio & Endurance et certains benchmarks, la saisie n'accepte que des minutes entières : impossible d'entrer 1'42. Attendu : saisie en minutes **et** secondes (deux champs ou un format `mm:ss` contrôlé), pour tous les records dont l'unité est un temps. Les records déjà saisis restent valides.

---

## Ordre et livraison

1. Lot A en une PR (migration + moteur + tests), non appliquée en prod avant relecture par Nab d'un échantillon de tirages « Sans matériel » et d'une semaine Musculation.
2. Lot B en deux ou trois PR groupées par sujet : écran du générateur (B1, B2, B3), navigation et minuteur (B4, B5, B6), Whiteboard et PR (B7, B8, B9, B10, B11).
3. Aucun build tant que Nab ne l'a pas demandé.
