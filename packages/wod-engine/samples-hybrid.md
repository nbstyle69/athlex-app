# Échantillons — piste Hybrid (programmation de box)

Moteur séance `1.0.0` · banque séance v3 · catalogue v2.
Box fictive `00000000-0000-4000-8000-00000000f17e`, profil de référence Men / Inter — les autres catégories sont dans chaque ligne de mouvement.

Structure fixe lundi → samedi : intervalles, force et stations, course, engine, course compromise, simulation.
Le bloc de travail est tiré dans la banque Hybrid existante, restreinte par jour ; les blocs A (stations, intervalles de course, enchaînement chronométré) vivent dans les squelettes.

## 2026-W40 (lundi 2026-09-28)

seed `1637939396` · révélation par défaut `2026-09-27T16:00:00.000Z` (dimanche 18:00 Paris)
course et ergs de la semaine : **32.8 km** · répétitions sautées : 0
**relâchements : hard_days_in_a_row:2**

### Lundi 2026-09-28 · Intervalles · 54' (budget 60')

squelette `H1_intervals` · bloc de travail `amrap_distances` · intention **interval** · RPE 8 · course 2150 m

**strength · Force sur station · Sled Push**

```
Échauffement (10') — 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 × 20 s skipping.

Every 2' × 8, en alternance :
Impair · 25 m Sled Push @ 125/100 kg
Pair · 10 Goblet Squat @ 24/16 kg
Women Pro / Men Pro : Sled Push 150/125 kg · Goblet Squat 28/20 kg
```

**wod · AMRAP 20 · Run / Sled Pull / Wall Balls** — *classement activé*

```
AMRAP 20
250 m Run
30 m Sled Pull (100/75 kg)
Pro 125/100 kg
11 Wall Balls (9/6 kg)
Pro 12/9 kg
18 cal SkiErg
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 4 rounds.
```
> Allure constante, chaque round dans les 15 s du précédent. Score : rounds_reps.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
20 Sit-ups
30 s Superman Hold
```

### Mardi 2026-09-29 · Force & stations · 58' (budget 60')

squelette `H2_strength_stations` · bloc de travail `run_into_station` · intention **engine** · RPE 8.5 · course 3250 m

**strength · Force sur station · Hip Thrust**

```
Échauffement (10') — 500 m rameur facile, 10 hip hinges à la barre à vide, 10 fentes / jambe, 10 pompes, 20 m d'ours.

Every 3' × 5, en alternance :
Impair · 10 Hip Thrust
Pair · 20 m Farmer Carry @ 24/16 kg
Women Pro / Men Pro : Farmer Carry 28/20 kg
```

**wod · 4 rounds · Run / Burpee Broad Jumps** — *classement activé*

```
4 rounds for time (cap 27')
550 m Run
R1 · 50 m Burpee Broad Jumps
R2 · 60 m Sled Push (100/75 kg)
Pro 125/100 kg
R3 · 500 m Row
R4 · 500 m SkiErg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 21:34, cap 27'.
```
> Allure course à 90 % du 5 km, stations sans pause. Score : time.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
40 m Suitcase Carry
10 Dead Bug
```

### Mercredi 2026-09-30 · Course · 64' (budget 60')

squelette `H3_run` · bloc de travail `core_carry_finisher` · intention **core** · RPE 6 · course 4200 m

**strength · Course · Run**

```
Échauffement (12') — 1 km progressif, gammes (talons-fesses, montées de genoux, pas chassés) 2 × 20 m, 3 × 30 m d'accélérations.

Intervalles course — 8 × 400 m, repos 1:00
Allure cible : allure 5 km. L'écart entre le premier et le dernier intervalle reste sous 5 s.
Autres variantes du cycle : 5 × 800 m · 3 × 1 600 m · 12 × 200 m shuttle
```

**wod · 4 rounds · Farmer Carry / Plank Hold / Shuttle Run** — *classement activé*

```
4 rounds for time (cap 23')
90 m Farmer Carry (20/16 kg)
Pro 24/16 kg
55 s Plank Hold
250 m Shuttle Run
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 18:03, cap 23'.
```
> Posture et gainage, jamais à l'échec. Score : time.

### Jeudi 2026-10-01 · Engine · 63' (budget 60')

squelette `H4_engine` · bloc de travail `engine_continuous` · intention **aerobic** · RPE 6 · course 11400 m

**wod · Continu · SkiErg / Run / Bike Erg** — *classement activé*

```
Échauffement (8') — 400 m course facile, 10 air squats, 10 pompes, 5 inchworms.

En continu 45' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
200 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 11937 m.
```
> Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Score : distance.

**finisher · Finisher**

```
Finisher — 1 rounds, rythme continu :
30 s Mobilité hanches, chevilles et chaîne postérieure
```

### Vendredi 2026-10-02 · Course compromise · 60' (budget 60')

squelette `H5_compromised` · bloc de travail `stations_interval` · intention **engine** · RPE 8.5 · course 1740 m · **relâchements : c:format, c:skeleton**

**strength · Force sur station · Sled Pull**

```
Échauffement (10') — 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled à vide, 10 wall balls légères.

Every 2'30 × 5, en alternance :
Impair · 30 m Sled Pull @ 125/100 kg
Pair · 100 m Run
Women Pro / Men Pro : Sled Pull 150/125 kg
Seule charge lourde de la semaine. Poussée continue, jamais en saccades.
```

**wod · Stations · Sandbag Lunges / Burpee Broad Jumps / Row** — *classement activé*

```
3 rounds × 5 stations · 90 s on / 30 s off
Station 1 · Sandbag Lunges (30/20 kg) (max m, cible 40 m)
Pro 40/30 kg
Station 2 · Burpee Broad Jumps (max m, cible 30 m)
Station 3 · Row (max cal, cible 25 cal)
Station 4 · KB Swings Russian (20/16 kg) (max reps, cible 33)
Pro 24/16 kg
Station 5 · SkiErg (max cal, cible 20 cal)
Stimulus : RPE 8.5 — Alternance jambes / épaules / mono, 90 s de travail max effort. Cible Men : 3 tours × 5 stations, 90 s on / 30 s off.
```
> Alternance jambes / épaules / mono, 90 s de travail max effort. Score : reps_total.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
40 s Plank Hold
12 Hollow Rocks
```

### Samedi 2026-10-03 · Simulation · test de bloc · 77' (budget 75')

squelette `H6_simulation_full` · séance chronométrée, sans bloc tiré · course 10080 m

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

**finisher · Finisher**

```
Finisher — 1 rounds, rythme continu :
30 s Mobilité dorsale, ischios et mollets
```

## 2026-W41 (lundi 2026-10-05)

seed `3224906895` · révélation par défaut `2026-10-04T16:00:00.000Z` (dimanche 18:00 Paris)
course et ergs de la semaine : **28.7 km** · répétitions sautées : 0
**relâchements : hard_day_softened:3, hard_days_in_a_row:2, movement_repeat_week:3**

### Lundi 2026-10-05 · Intervalles · 64' (budget 60')

squelette `H1_intervals` · bloc de travail `run_into_station` · intention **interval** · RPE 8.5 · course 4010 m

**strength · Force sur station · Sled Pull**

```
Échauffement (10') — 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 × 20 s skipping.

Every 2' × 8, en alternance :
Impair · 25 m Sled Pull @ 100/75 kg
Pair · 12 Box Step-ups @ 60/50 cm
Women Pro / Men Pro : Sled Pull 125/100 kg · Box Step-ups 60/50 cm
```

**wod · 6 rounds · Run / Farmer Carry** — *classement activé*

```
6 rounds for time (cap 40:30)
500 m Run
R1 · 180 m Farmer Carry (24/16 kg)
Pro 28/20 kg
R2 · 32 Wall Balls (9/6 kg)
Pro 12/9 kg
R3 · 25 m Sled Push (125/100 kg)
Pro 150/125 kg
R4 · 60 m Burpee Broad Jumps
R5 · 600 m Row
R6 · 350 m SkiErg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 32:09, cap 40:30.
```
> Allure course à 90 % du 5 km, stations sans pause. Score : time.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
40 m Farmer Carry
30 s Plank Hold
```

### Mardi 2026-10-06 · Force & stations · 58' (budget 60')

squelette `H2_strength_stations` · bloc de travail `amrap_distances` · intention **run** · RPE 8 · course 2280 m · **relâchements : c:format, c:skeleton, finisher_repeat**

**strength · Force sur station · Romanian Deadlift**

```
Échauffement (10') — 500 m rameur facile, 10 hip hinges à la barre à vide, 10 fentes / jambe, 10 pompes, 20 m d'ours.

Every 3' × 5, en alternance :
Impair · 8 Romanian Deadlift
Pair · 20 m Sandbag Carry @ 40/30 kg
Women Pro / Men Pro : Sandbag Carry 50/35 kg
```

**wod · AMRAP 20 · Run / Sled Pull / Sandbag Lunges** — *classement activé*

```
AMRAP 20
400 m Run
30 m Sled Pull (75/50 kg)
Pro 100/75 kg
30 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
17 cal Echo Bike
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```
> Allure constante, chaque round dans les 15 s du précédent. Score : rounds_reps.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
40 m Suitcase Carry
10 Dead Bug
```

### Mercredi 2026-10-07 · Course · 54' (budget 60')

squelette `H3_run` · bloc de travail `core_carry_finisher` · intention **core** · RPE 6 · course 4480 m

**strength · Course · Run**

```
Échauffement (12') — 1 km progressif, gammes (talons-fesses, montées de genoux, pas chassés) 2 × 20 m, 3 × 30 m d'accélérations.

Intervalles course — 5 × 800 m, repos 1:30
Allure cible : allure 10 km − 10 s/km. L'écart entre le premier et le dernier intervalle reste sous 5 s.
Autres variantes du cycle : 8 × 400 m · 3 × 1 600 m · 12 × 200 m shuttle
```

**wod · 4 rounds · Sandbag Carry / Hollow Rocks / Row** — *classement activé*

```
4 rounds for time (cap 13')
60 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
20 Hollow Rocks
12 cal Row
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 10:13, cap 13'.
```
> Posture et gainage, jamais à l'échec. Score : time.

### Jeudi 2026-10-08 · Engine · 63' (budget 60')

squelette `H4_engine` · bloc de travail `engine_continuous` · intention **aerobic** · RPE 6 · course 11400 m · **relâchements : finisher_repeat**

**wod · Continu · Row / Run / Bike Erg** — *classement activé*

```
Échauffement (8') — 400 m course facile, 10 air squats, 10 pompes, 5 inchworms.

En continu 45' · rotation sans repos, score = distance totale
500 m Row
400 m Run
1000 m Bike Erg
200 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 12064 m.
```
> Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Score : distance.

**finisher · Finisher**

```
Finisher — 1 rounds, rythme continu :
30 s Mobilité dorsale, ischios et mollets
```

### Vendredi 2026-10-09 · Course compromise · 60' (budget 60')

squelette `H5_compromised` · bloc de travail `stations_interval` · intention **engine** · RPE 8.5 · course 2490 m · **relâchements : c:format, c:skeleton, finisher_repeat**

**strength · Force sur station · Sandbag Carry**

```
Échauffement (10') — 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled à vide, 10 wall balls légères.

Every 2'30 × 5, en alternance :
Impair · 50 m Sandbag Carry @ 50/35 kg
Pair · 100 m Run
Women Pro / Men Pro : Sandbag Carry 70/50 kg
Seule charge lourde de la semaine. Poussée continue, jamais en saccades.
```

**wod · Stations · Row / Burpee Broad Jumps / SkiErg** — *classement activé*

```
3 rounds × 5 stations · 90 s on / 30 s off
Station 1 · Row (max cal, cible 25 cal)
Station 2 · Burpee Broad Jumps (max m, cible 30 m)
Station 3 · SkiErg (max cal, cible 20 cal)
Station 4 · KB Swings Russian (20/16 kg) (max reps, cible 33)
Pro 24/16 kg
Station 5 · Bike Erg (max cal, cible 25 cal)
Stimulus : RPE 8.5 — Alternance jambes / épaules / mono, 90 s de travail max effort. Cible Men : 3 tours × 5 stations, 90 s on / 30 s off.
```
> Alternance jambes / épaules / mono, 90 s de travail max effort. Score : reps_total.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
40 s Plank Hold
12 Hollow Rocks
```

### Samedi 2026-10-10 · Simulation · 62' (budget 60')

squelette `H6_simulation` · séance chronométrée, sans bloc tiré · course 4040 m · **relâchements : finisher_repeat**

**wod · Simulation** — *classement activé*

```
Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide.

Enchaînement chronométré — 7 tours, dans l'ordre :
1. 500 m Run puis 500 m SkiErg
2. 500 m Run puis 50 m Sandbag Lunges @ 40/30 kg
3. 500 m Run puis 25 m Sled Pull @ 100/75 kg
4. 500 m Run puis 40 m Burpee Broad Jumps
5. 500 m Run puis 100 m Farmer Carry @ 24/16 kg
6. 500 m Run puis 25 m Sled Push @ 125/100 kg
7. 500 m Run puis 50 Wall Balls @ 9/6 kg
Women Pro / Men Pro : Sandbag Lunges 50/35 kg · Sled Pull 125/100 kg · Farmer Carry 28/20 kg · Sled Push 150/125 kg · Wall Balls 12/9 kg
Score : temps total. Note le temps de chaque segment.
```
> Séance chronométrée de bout en bout : compare avec ta dernière simulation.

**finisher · Finisher**

```
Finisher — 1 rounds, rythme continu :
30 s Mobilité dorsale, ischios et mollets
```

## 2026-W48 (lundi 2026-11-23) — semaine de simulation complète

seed `1751627452` · révélation par défaut `2026-11-22T17:00:00.000Z` (dimanche 18:00 Paris)
course et ergs de la semaine : **33.5 km** · répétitions sautées : 0
**relâchements : hard_day_softened:3, hard_days_in_a_row:2, movement_repeat_week:3**

### Lundi 2026-11-23 · Intervalles · 64' (budget 60')

squelette `H1_intervals` · bloc de travail `run_into_station` · intention **run** · RPE 8.5 · course 3410 m · **relâchements : finisher_repeat**

**strength · Force sur station · Sled Pull**

```
Échauffement (10') — 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 × 20 s skipping.

Every 2' × 8, en alternance :
Impair · 25 m Sled Pull @ 100/75 kg
Pair · 12 Box Step-ups @ 60/50 cm
Women Pro / Men Pro : Sled Pull 125/100 kg · Box Step-ups 60/50 cm
```

**wod · 5 rounds · Run / Sled Push** — *classement activé*

```
5 rounds for time (cap 34')
600 m Run
R1 · 40 m Sled Push (100/75 kg)
Pro 125/100 kg
R2 · 60 m Burpee Broad Jumps
R3 · 350 m Row
R4 · 50 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R5 · 60 m Farmer Carry (20/16 kg)
Pro 24/16 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 27:06, cap 34'.
```
> Allure course à 90 % du 5 km, stations sans pause. Score : time.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
40 m Suitcase Carry
10 Dead Bug
```

### Mardi 2026-11-24 · Force & stations · 58' (budget 60')

squelette `H2_strength_stations` · bloc de travail `amrap_distances` · intention **engine** · RPE 8 · course 2150 m · **relâchements : finisher_repeat**

**strength · Force sur station · Front Squat**

```
Échauffement (10') — 500 m rameur facile, 10 hip hinges à la barre à vide, 10 fentes / jambe, 10 pompes, 20 m d'ours.

Every 3' × 5, en alternance :
Impair · 6 Front Squat @ 70/50 kg
Pair · 20 m Farmer Carry @ 24/16 kg
Women Pro / Men Pro : Front Squat 80/55 kg · Farmer Carry 28/20 kg
```

**wod · AMRAP 20 · Run / Sled Pull / Wall Balls** — *classement activé*

```
AMRAP 20
300 m Run
30 m Sled Pull (75/50 kg)
Pro 100/75 kg
20 Wall Balls (6/4 kg)
Pro 9/6 kg
13 cal Row
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 4 rounds.
```
> Allure constante, chaque round dans les 15 s du précédent. Score : rounds_reps.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
20 Sit-ups
30 s Superman Hold
```

### Mercredi 2026-11-25 · Course · 54' (budget 60')

squelette `H3_run` · bloc de travail `core_carry_finisher` · intention **core** · RPE 6 · course 3950 m

**strength · Course · Run**

```
Échauffement (12') — 1 km progressif, gammes (talons-fesses, montées de genoux, pas chassés) 2 × 20 m, 3 × 30 m d'accélérations.

Intervalles course — 8 × 400 m, repos 1:00
Allure cible : allure 5 km. L'écart entre le premier et le dernier intervalle reste sous 5 s.
Autres variantes du cycle : 5 × 800 m · 3 × 1 600 m · 12 × 200 m shuttle
```

**wod · 3 rounds · Farmer Carry / Hollow Rocks / Run** — *classement activé*

```
3 rounds for time (cap 12')
60 m Farmer Carry (20/16 kg)
Pro 24/16 kg
24 Hollow Rocks
250 m Run
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 9:25, cap 12'.
```
> Posture et gainage, jamais à l'échec. Score : time.

### Jeudi 2026-11-26 · Engine · 63' (budget 60')

squelette `H4_engine` · bloc de travail `engine_continuous` · intention **aerobic** · RPE 6 · course 11400 m · **relâchements : c_fallback:signature, finisher_repeat**

**wod · Continu · SkiErg / Run / Bike Erg** — *classement activé*

```
Échauffement (8') — 400 m course facile, 10 air squats, 10 pompes, 5 inchworms.

En continu 45' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
200 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 11937 m.
```
> Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Score : distance.

**finisher · Finisher**

```
Finisher — 1 rounds, rythme continu :
30 s Mobilité hanches, chevilles et chaîne postérieure
```

### Vendredi 2026-11-27 · Course compromise · 60' (budget 60')

squelette `H5_compromised` · bloc de travail `stations_interval` · intention **interval** · RPE 8.5 · course 2490 m · **relâchements : c_fallback:intention, finisher_repeat**

**strength · Force sur station · Sled Pull**

```
Échauffement (10') — 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled à vide, 10 wall balls légères.

Every 2'30 × 5, en alternance :
Impair · 30 m Sled Pull @ 125/100 kg
Pair · 100 m Run
Women Pro / Men Pro : Sled Pull 150/125 kg
Seule charge lourde de la semaine. Poussée continue, jamais en saccades.
```

**wod · Stations · Bike Erg / KB Swings Russian / SkiErg** — *classement activé*

```
3 rounds × 5 stations · 90 s on / 30 s off
Station 1 · Bike Erg (max cal, cible 25 cal)
Station 2 · KB Swings Russian (24/16 kg) (max reps, cible 33)
Pro 28/20 kg
Station 3 · SkiErg (max cal, cible 20 cal)
Station 4 · Burpee Broad Jumps (max m, cible 30 m)
Station 5 · Row (max cal, cible 25 cal)
Stimulus : RPE 8.5 — Alternance jambes / épaules / mono, 90 s de travail max effort. Cible Men : 3 tours × 5 stations, 90 s on / 30 s off.
```
> Alternance jambes / épaules / mono, 90 s de travail max effort. Score : reps_total.

**finisher · Finisher**

```
Finisher — 3 rounds, rythme continu :
40 s Plank Hold
12 Hollow Rocks
```

### Samedi 2026-11-28 · Simulation · test de bloc · 77' (budget 75')

squelette `H6_simulation_full` · séance chronométrée, sans bloc tiré · course 10080 m · **relâchements : finisher_repeat**

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

**finisher · Finisher**

```
Finisher — 1 rounds, rythme continu :
30 s Mobilité dorsale, ischios et mollets
```

