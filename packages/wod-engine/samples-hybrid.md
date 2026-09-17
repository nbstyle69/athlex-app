# Échantillons — piste Hybrid (programmation de box)

Moteur séance `1.0.0` · banque séance v3 · catalogue v2.
Box fictive `00000000-0000-4000-8000-00000000f17e`, profil de référence Men / Inter — les autres catégories sont dans chaque ligne de mouvement.

Structure fixe lundi → samedi : intervalles, force et stations, course, engine, course compromise, simulation.
Le bloc de travail est tiré dans la banque Hybrid existante, restreinte par jour ; les blocs A (stations, intervalles de course, enchaînement chronométré) vivent dans les squelettes.

## 2026-W40 (lundi 2026-09-28)

seed `1637939396` · révélation par défaut `2026-09-27T16:00:00.000Z` (dimanche 18:00 Paris)
course et ergs de la semaine : **29.9 km** · répétitions sautées : 0
**relâchements : movement_repeat_week:db_farmer_carry, movement_repeat_week:kb_goblet_squat, movement_repeat_week:sled_pull**

### Lundi 2026-09-28 · Intervalles · 56' (budget 60')

squelette `H1_intervals` · bloc tiré `run_into_station` · intention **engine** · RPE du jour **8.5** · course 3170 m

**strength · Force sur station · Goblet Squat**

```
Échauffement (10') — 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 × 20 s skipping.

Every 2' × 8, en rotation :
Impair · 12 Goblet Squat @ 24/16 kg
Pair · 15 Air Squats
Women Pro / Men Pro : Goblet Squat 28/20 kg
```

**wod · 4 rounds · Run / Sled Pull** — *classement activé*

```
4 rounds for time (cap 27')
650 m Run
R1 · 45 m Sled Pull (75/50 kg)
Pro 100/75 kg
R2 · 550 m SkiErg
R3 · 20 m Burpee Broad Jumps
R4 · 30 m Sled Push (100/75 kg)
Pro 125/100 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 21:24, cap 27'.
```
> Allure course à 90 % du 5 km, stations sans pause. Score : time.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
40 m Overhead Carry (par côté)
10 Push-ups
```

### Mardi 2026-09-29 · Force & stations · 58' (budget 60')

squelette `H2_strength_stations` · bloc de travail écrit dans le squelette · RPE du jour **7.5** · course 0 m

**strength · Force sur station · Goblet Squat**

```
Échauffement (10') — 500 m rameur facile, 10 hip hinges à la barre à vide, 10 fentes / jambe, 10 pompes, 20 m d'ours.

Every 3' × 5, en rotation :
Impair · 12 Goblet Squat @ 24/16 kg
Pair · 20 m Farmer Carry @ 24/16 kg
Women Pro / Men Pro : Goblet Squat 28/20 kg · Farmer Carry 28/20 kg
```

**wod · Force & stations · Row** — *classement activé*

```
Every 1'30 × 12, en rotation :
Poste 1 · 60 s Row — allure tenable, ni sprint ni promenade
Poste 2 · 60 s Sandbag Lunges @ 40/30 kg
Poste 3 · 60 s SkiErg — allure tenable
Poste 4 · 60 s Sandbag Carry @ 40/30 kg
Women Pro / Men Pro : Sandbag Lunges 50/35 kg · Sandbag Carry 50/35 kg
```

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
20 Sit-ups
30 s Superman Hold
```

### Mercredi 2026-09-30 · Course · 56' (budget 60')

squelette `H3_run` · bloc de travail écrit dans le squelette · RPE du jour **8.5** · course 3200 m

**wod · Course · Run** — *classement activé*

```
Échauffement (12') — 1 km progressif, gammes (talons-fesses, montées de genoux, pas chassés) 2 × 20 m, 3 × 30 m d'accélérations.

Intervalles course — 8 × 400 m, repos 1:00
Allure cible : allure 5 km. L'écart entre le premier et le dernier intervalle reste sous 5 s.
Autres variantes du cycle : 5 × 800 m · 3 × 1 600 m · 12 × 200 m shuttle
```
> Séance chronométrée de bout en bout : compare avec ta dernière simulation.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
40 m Suitcase Carry
10 Dead Bug
```

**cooldown · Retour au calme**

```
Retour au calme (6') — 400 m de marche rapide puis respiration 4-6 allongé, 2'.
Étirements : quadriceps debout 45 s / jambe · adducteurs en grenouille 45 s · psoas en fente basse 45 s / côté.
```

### Jeudi 2026-10-01 · Engine · 58' (budget 60')

squelette `H4_engine` · bloc tiré `engine_continuous` · intention **aerobic** · RPE du jour **6** · course 9500 m

**wod · Continu · SkiErg / Run / Bike Erg** — *classement activé*

```
Échauffement (8') — 400 m course facile, 10 air squats, 10 pompes, 5 inchworms.

En continu 40' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
200 m Farmer Carry (20/16 kg)
Pro 24/16 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 9980 m.
```
> Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Score : distance.

**cooldown · Retour au calme**

```
Retour au calme (8') — 600 m de footing très lent ou 5' de vélo facile, respiration nasale.
Étirements : ischios debout 45 s / jambe · fléchisseurs de hanche en fente 45 s / côté · mollets au mur 45 s / jambe.
```

### Vendredi 2026-10-02 · Course compromise · 58' (budget 60')

squelette `H5_compromised` · bloc de travail écrit dans le squelette · RPE du jour **7.5** · course 3900 m

**strength · Force sur station · Sled Pull**

```
Échauffement (10') — 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled à vide, 10 wall balls légères.

Every 2'30 × 5, en rotation :
Impair · 30 m Sled Pull @ 125/100 kg
Pair · 100 m Run
Women Pro / Men Pro : Sled Pull 150/125 kg
Seule charge lourde de la semaine. Poussée continue, jamais en saccades.
```

**wod · Course compromise · Run** — *classement activé*

```
4 rounds :
1. 90 s de station — 40 m Sandbag Carry @ 40/30 kg
   puis 1000 m Run à allure cible (allure 5 km + 15 s/km)
2. 90 s de station — 20 Box Step-ups lestés (2 × DB) (box 60/50 cm) @ 24/16 kg
   puis 1000 m Run à allure cible (allure 5 km + 15 s/km)
3. 90 s de station — 20 Burpees
   puis 600 m Run à allure cible (allure 5 km + 15 s/km)
4. 90 s de station — 15 Box Jumps (box 60/50 cm)
   puis 1000 m Run à allure cible (allure 5 km + 15 s/km)
Women Pro / Men Pro : Sandbag Carry 50/35 kg
Total de course : 3600 m. Tenir l'allure avec les jambes chargées, ne pas sprinter la station.
```

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
25 Calf Raise (bodyweight)
30 s Plank Hold
```

### Samedi 2026-10-03 · Simulation · test de bloc · 73' (budget 75')

squelette `H6_simulation_full` · bloc de travail écrit dans le squelette · RPE du jour **9** · course 10080 m

**wod · Simulation · test de bloc** — *classement activé*

```
Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide. Prépare ton matériel : la séance s'enchaîne sans arrêt.

Enchaînement chronométré — 8 tours, dans l'ordre :
1. 1000 m Run puis 1000 m SkiErg
2. 1000 m Run puis 50 m Sled Push @ 125/100 kg
3. 1000 m Run puis 50 m Sled Pull @ 100/75 kg
4. 1000 m Run puis 80 m Burpee Broad Jumps
5. 1000 m Run puis 1000 m Row
6. 1000 m Run puis 200 m Farmer Carry @ 24/16 kg
7. 1000 m Run puis 100 m Sandbag Lunges @ 40/30 kg
8. 1000 m Run puis 100 Wall Balls @ 9/6 kg
Women Pro / Men Pro : Sled Push 150/125 kg · Sled Pull 125/100 kg · Farmer Carry 28/20 kg · Sandbag Lunges 50/35 kg · Wall Balls 12/9 kg
Score : temps total. Note le temps de chaque segment.
```
> Séance chronométrée de bout en bout : compare avec ta dernière simulation.

**cooldown · Retour au calme**

```
Retour au calme (6') — 400 m de marche rapide puis respiration 4-6 allongé, 2'.
Étirements : quadriceps debout 45 s / jambe · adducteurs en grenouille 45 s · psoas en fente basse 45 s / côté.
```

## 2026-W41 (lundi 2026-10-05)

seed `3224906895` · révélation par défaut `2026-10-04T16:00:00.000Z` (dimanche 18:00 Paris)
course et ergs de la semaine : **23.6 km** · répétitions sautées : 0
**relâchements : movement_repeat_week:db_farmer_carry**

### Lundi 2026-10-05 · Intervalles · 56' (budget 60')

squelette `H1_intervals` · bloc tiré `run_into_station` · intention **engine** · RPE du jour **8.5** · course 3135 m

**strength · Force sur station · KB Swings Russian**

```
Échauffement (10') — 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 × 20 s skipping.

Every 2' × 8, en rotation :
Impair · 15 KB Swings Russian @ 24/16 kg
Pair · 10 Box Step-ups lestés (2 × DB) (box 60/50 cm) @ 24/16 kg
Women Pro / Men Pro : KB Swings Russian 28/20 kg
```

**wod · 4 rounds · Run / Sled Pull** — *classement activé*

```
4 rounds for time (cap 27')
650 m Run
R1 · 30 m Sled Pull (75/50 kg)
Pro 100/75 kg
R2 · 35 m Burpee Broad Jumps
R3 · 35 m Sled Push (100/75 kg)
Pro 125/100 kg
R4 · 500 m Row
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 21:19, cap 27'.
```
> Allure course à 90 % du 5 km, stations sans pause. Score : time.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
15 Row en respiration nasale
30 s Plank Hold
```

### Mardi 2026-10-06 · Force & stations · 58' (budget 60')

squelette `H2_strength_stations` · bloc de travail écrit dans le squelette · RPE du jour **7.5** · course 0 m

**strength · Force sur station · Goblet Squat**

```
Échauffement (10') — 500 m rameur facile, 10 hip hinges à la barre à vide, 10 fentes / jambe, 10 pompes, 20 m d'ours.

Every 3' × 5, en rotation :
Impair · 12 Goblet Squat @ 24/16 kg
Pair · 20 m Farmer Carry @ 24/16 kg
Women Pro / Men Pro : Goblet Squat 28/20 kg · Farmer Carry 28/20 kg
```

**wod · Force & stations · Row** — *classement activé*

```
Every 1'30 × 12, en rotation :
Poste 1 · 60 s Row — allure tenable, ni sprint ni promenade
Poste 2 · 60 s Sandbag Lunges @ 40/30 kg
Poste 3 · 60 s SkiErg — allure tenable
Poste 4 · 60 s Sandbag Carry @ 40/30 kg
Women Pro / Men Pro : Sandbag Lunges 50/35 kg · Sandbag Carry 50/35 kg
```

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
25 Calf Raise (bodyweight)
40 m Farmer Carry
```

### Mercredi 2026-10-07 · Course · 58' (budget 60')

squelette `H3_run` · bloc de travail écrit dans le squelette · RPE du jour **8.5** · course 4000 m

**wod · Course · Run** — *classement activé*

```
Échauffement (12') — 1 km progressif, gammes (talons-fesses, montées de genoux, pas chassés) 2 × 20 m, 3 × 30 m d'accélérations.

Intervalles course — 5 × 800 m, repos 1:30
Allure cible : allure 10 km − 10 s/km. L'écart entre le premier et le dernier intervalle reste sous 5 s.
Autres variantes du cycle : 8 × 400 m · 3 × 1 600 m · 12 × 200 m shuttle
```
> Séance chronométrée de bout en bout : compare avec ta dernière simulation.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
25 Glute Bridge
12 Dead Bug
```

**cooldown · Retour au calme**

```
Retour au calme (8') — 5' de rameur très facile, épaules relâchées.
Étirements : chaîne postérieure assis 45 s · pigeon 45 s / côté · ouverture thoracique au mur 45 s / bras.
```

### Jeudi 2026-10-08 · Engine · 56' (budget 60')

squelette `H4_engine` · bloc tiré `engine_continuous` · intention **aerobic** · RPE du jour **6** · course 9500 m

**wod · Continu · Row / Run / Bike Erg** — *classement activé*

```
Échauffement (8') — 400 m course facile, 10 air squats, 10 pompes, 5 inchworms.

En continu 40' · rotation sans repos, score = distance totale
500 m Row
400 m Run
1000 m Bike Erg
200 m Farmer Carry (20/16 kg)
Pro 24/16 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 10080 m.
```
> Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Score : distance.

**cooldown · Retour au calme**

```
Retour au calme (6') — 400 m de marche rapide puis respiration 4-6 allongé, 2'.
Étirements : quadriceps debout 45 s / jambe · adducteurs en grenouille 45 s · psoas en fente basse 45 s / côté.
```

### Vendredi 2026-10-09 · Course compromise · 58' (budget 60')

squelette `H5_compromised` · bloc de travail écrit dans le squelette · RPE du jour **7.5** · course 3500 m

**strength · Force sur station · Sandbag Carry**

```
Échauffement (10') — 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled à vide, 10 wall balls légères.

Every 2'30 × 5, en rotation :
Impair · 50 m Sandbag Carry @ 50/35 kg
Pair · 100 m Run
Women Pro / Men Pro : Sandbag Carry 70/50 kg
Seule charge lourde de la semaine. Poussée continue, jamais en saccades.
```

**wod · Course compromise · Run** — *classement activé*

```
4 rounds :
1. 90 s de station — 30 Air Squats
   puis 700 m Run à allure cible (allure 5 km + 15 s/km)
2. 90 s de station — 20 Burpees
   puis 1000 m Run à allure cible (allure 5 km + 15 s/km)
3. 90 s de station — 20 Box Step-ups lestés (2 × DB) (box 60/50 cm) @ 24/16 kg
   puis 600 m Run à allure cible (allure 5 km + 15 s/km)
4. 90 s de station — 40 m Sandbag Carry @ 40/30 kg
   puis 900 m Run à allure cible (allure 5 km + 15 s/km)
Women Pro / Men Pro : Sandbag Carry 50/35 kg
Total de course : 3200 m. Tenir l'allure avec les jambes chargées, ne pas sprinter la station.
```

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
10 Dead Bug
30 s Side Plank (par côté)
```

### Samedi 2026-10-10 · Simulation · 58' (budget 60')

squelette `H6_simulation` · bloc de travail écrit dans le squelette · RPE du jour **9** · course 3500 m

**wod · Simulation** — *classement activé*

```
Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide.

Enchaînement chronométré — 6 tours, dans l'ordre :
1. 500 m Run puis 50 m Sandbag Lunges @ 40/30 kg
2. 500 m Run puis 25 m Sled Push @ 125/100 kg
3. 500 m Run puis 25 m Sled Pull @ 100/75 kg
4. 500 m Run puis 100 m Farmer Carry @ 24/16 kg
5. 500 m Run puis 500 m SkiErg
6. 500 m Run puis 50 Wall Balls @ 9/6 kg
Women Pro / Men Pro : Sandbag Lunges 50/35 kg · Sled Push 150/125 kg · Sled Pull 125/100 kg · Farmer Carry 28/20 kg · Wall Balls 12/9 kg
Score : temps total. Note le temps de chaque segment.
```
> Séance chronométrée de bout en bout : compare avec ta dernière simulation.

**cooldown · Retour au calme**

```
Retour au calme (6') — 400 m de marche rapide puis respiration 4-6 allongé, 2'.
Étirements : quadriceps debout 45 s / jambe · adducteurs en grenouille 45 s · psoas en fente basse 45 s / côté.
```

## 2026-W48 (lundi 2026-11-23) — semaine de simulation complète

seed `1751627452` · révélation par défaut `2026-11-22T17:00:00.000Z` (dimanche 18:00 Paris)
course et ergs de la semaine : **28.7 km** · répétitions sautées : 0
**relâchements : movement_repeat_week:db_farmer_carry**

### Lundi 2026-11-23 · Intervalles · 56' (budget 60')

squelette `H1_intervals` · bloc tiré `compromised_run` · intention **interval** · RPE du jour **8** · course 2600 m

**strength · Force sur station · KB Swings Russian**

```
Échauffement (10') — 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 × 20 s skipping.

Every 2' × 8, en rotation :
Impair · 15 KB Swings Russian @ 24/16 kg
Pair · 10 Box Step-ups lestés (2 × DB) (box 60/50 cm) @ 24/16 kg
Women Pro / Men Pro : KB Swings Russian 28/20 kg
```

**wod · 4 rounds · Sled Push / Run** — *classement activé*

```
4 rounds for time (cap 27')
40 m Sled Push (125/100 kg)
Pro 150/125 kg
650 m Run
Stimulus : RPE 8 — Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km. Cible Men : ≈ 21:26, cap 27'.
```
> Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km. Score : time.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
10 Single-Leg RDL poids du corps (par jambe)
20 Glute Bridge
```

### Mardi 2026-11-24 · Force & stations · 58' (budget 60')

squelette `H2_strength_stations` · bloc de travail écrit dans le squelette · RPE du jour **7.5** · course 0 m

**strength · Force sur station · Front Squat**

```
Échauffement (10') — 500 m rameur facile, 10 hip hinges à la barre à vide, 10 fentes / jambe, 10 pompes, 20 m d'ours.

Every 3' × 5, en rotation :
Impair · 6 Front Squat @ 70/50 kg
Pair · 20 m Farmer Carry @ 24/16 kg
Women Pro / Men Pro : Front Squat 80/55 kg · Farmer Carry 28/20 kg
```

**wod · Force & stations · Bike Erg** — *classement activé*

```
Every 1'30 × 12, en rotation :
Poste 1 · 60 s Bike Erg — allure tenable
Poste 2 · 60 s Wall Balls @ 9/6 kg
Poste 3 · 60 s SkiErg — allure tenable
Poste 4 · 60 s Farmer Carry @ 24/16 kg
Women Pro / Men Pro : Wall Balls 12/9 kg · Farmer Carry 28/20 kg
```

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
20 Hollow Rocks
40 s Superman Hold
```

### Mercredi 2026-11-25 · Course · 56' (budget 60')

squelette `H3_run` · bloc de travail écrit dans le squelette · RPE du jour **8.5** · course 3200 m

**wod · Course · Run** — *classement activé*

```
Échauffement (12') — 1 km progressif, gammes (talons-fesses, montées de genoux, pas chassés) 2 × 20 m, 3 × 30 m d'accélérations.

Intervalles course — 8 × 400 m, repos 1:00
Allure cible : allure 5 km. L'écart entre le premier et le dernier intervalle reste sous 5 s.
Autres variantes du cycle : 5 × 800 m · 3 × 1 600 m · 12 × 200 m shuttle
```
> Séance chronométrée de bout en bout : compare avec ta dernière simulation.

**finisher · Finisher**

```
Finisher — 2 rounds, rythme continu :
25 Row facile, respiration nasale
40 s Superman Hold
```

**cooldown · Retour au calme**

```
Retour au calme (6') — 400 m de marche rapide puis respiration 4-6 allongé, 2'.
Étirements : quadriceps debout 45 s / jambe · adducteurs en grenouille 45 s · psoas en fente basse 45 s / côté.
```

### Jeudi 2026-11-26 · Engine · 58' (budget 60')

squelette `H4_engine` · bloc tiré `engine_continuous` · intention **aerobic** · RPE du jour **6** · course 9500 m · **relâchements : c_fallback:signature**

**wod · Continu · SkiErg / Run / Bike Erg** — *classement activé*

```
Échauffement (8') — 400 m course facile, 10 air squats, 10 pompes, 5 inchworms.

En continu 40' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
200 m Farmer Carry (20/16 kg)
Pro 24/16 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 9980 m.
```
> Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Score : distance.

**cooldown · Retour au calme**

```
Retour au calme (8') — 600 m de footing très lent ou 5' de vélo facile, respiration nasale.
Étirements : ischios debout 45 s / jambe · fléchisseurs de hanche en fente 45 s / côté · mollets au mur 45 s / jambe.
```

### Vendredi 2026-11-27 · Course compromise · 58' (budget 60')

squelette `H5_compromised` · bloc de travail écrit dans le squelette · RPE du jour **7.5** · course 3300 m

**strength · Force sur station · Sled Pull**

```
Échauffement (10') — 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled à vide, 10 wall balls légères.

Every 2'30 × 5, en rotation :
Impair · 30 m Sled Pull @ 125/100 kg
Pair · 100 m Run
Women Pro / Men Pro : Sled Pull 150/125 kg
Seule charge lourde de la semaine. Poussée continue, jamais en saccades.
```

**wod · Course compromise · Run** — *classement activé*

```
4 rounds :
1. 90 s de station — 20 Burpees
   puis 900 m Run à allure cible (allure 5 km + 15 s/km)
2. 90 s de station — 40 m Sandbag Carry @ 40/30 kg
   puis 700 m Run à allure cible (allure 5 km + 15 s/km)
3. 90 s de station — 20 Box Step-ups lestés (2 × DB) (box 60/50 cm) @ 24/16 kg
   puis 800 m Run à allure cible (allure 5 km + 15 s/km)
4. 90 s de station — 15 Box Jumps (box 60/50 cm)
   puis 600 m Run à allure cible (allure 5 km + 15 s/km)
Women Pro / Men Pro : Sandbag Carry 50/35 kg
Total de course : 3000 m. Tenir l'allure avec les jambes chargées, ne pas sprinter la station.
```

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
30 s Pallof Press tenu (par côté)
15 Hollow Rocks
```

### Samedi 2026-11-28 · Simulation · test de bloc · 75' (budget 75')

squelette `H6_simulation_full` · bloc de travail écrit dans le squelette · RPE du jour **9** · course 10080 m

**wod · Simulation · test de bloc** — *classement activé*

```
Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide. Prépare ton matériel : la séance s'enchaîne sans arrêt.

Enchaînement chronométré — 8 tours, dans l'ordre :
1. 1000 m Run puis 1000 m SkiErg
2. 1000 m Run puis 50 m Sled Push @ 125/100 kg
3. 1000 m Run puis 50 m Sled Pull @ 100/75 kg
4. 1000 m Run puis 80 m Burpee Broad Jumps
5. 1000 m Run puis 1000 m Row
6. 1000 m Run puis 200 m Farmer Carry @ 24/16 kg
7. 1000 m Run puis 100 m Sandbag Lunges @ 40/30 kg
8. 1000 m Run puis 100 Wall Balls @ 9/6 kg
Women Pro / Men Pro : Sled Push 150/125 kg · Sled Pull 125/100 kg · Farmer Carry 28/20 kg · Sandbag Lunges 50/35 kg · Wall Balls 12/9 kg
Score : temps total. Note le temps de chaque segment.
```
> Séance chronométrée de bout en bout : compare avec ta dernière simulation.

**cooldown · Retour au calme**

```
Retour au calme (8') — 5' de rameur très facile, épaules relâchées.
Étirements : chaîne postérieure assis 45 s · pigeon 45 s / côté · ouverture thoracique au mur 45 s / bras.
```

