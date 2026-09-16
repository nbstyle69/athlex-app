# Échantillons — Programmation automatique AthleX Fitness (J1)

Moteur séance `1.0.0` · banque séance v2 · catalogue v2. Box fictive `00000000-0000-4000-8000-00000000f17e`, seed = hash(box, piste, année ISO, semaine ISO, regen 0) — exactement ce que `generate-box-week` poserait dans `box_wods` (source `auto`, audience `all`).

Deux semaines consécutives Functional / Hybrid (la seconde reçoit les signatures de la première en anti-répétition), puis deux semaines Musculation sur deux objectifs du cycle. Les relâchements sont imprimés tels que journalisés dans `box_auto_programming_runs.relaxations`.

Cycle Musculation par semaine ISO : W1 Prise de muscle · W2 Prise de muscle · W3 Tonification · W4 Tonification · W5 Force · W6 Force · W7 Prise de muscle

## Functional / Hybrid — 2026-W40 (lundi 2026-09-28)

seed `371985941` · publication `publish_at = 2026-09-27T16:00:00.000Z` (dimanche 18:00 Paris) · volume gym RX de la semaine : pull 100/150, HSPU 0/80 · aucun relâchement semaine

### #1 — Lundi 2026-09-28 · Haltéro · Snatch · 62' (budget 60')

squelette `S1_snatch` · bloc C `emom_alternating` · intention **mixed** · pattern lourd écarté du C : hinge · signature `functional|emom_alternating|emom|5|front_squat:reps,chest_to_bar:reps,echo_bike:9cal` · aucun relâchement

**Bloc A · 30' · Haltéro · Power Snatch**

```
Échauffement (10') — mobilité épaules et hanches, barre à vide : Snatch Deadlift, Muscle Snatch, Overhead Squat, Snatch Balance en série de 5.

Haltéro — complexe Power Snatch (A) : Hang Power Snatch + Power Snatch + Overhead Squat
Un complexe = une répétition, sans lâcher la barre. Sans 1RM connu : monter jusqu'à une charge propre.
Power Snatch — 2 × 2 @ 30 %1RM — repos 1:00 — charge montée
Power Snatch — 2 × 2 @ 50 %1RM — repos 1:00 — charge montée
Power Snatch — 4 × 1 @ 65 %1RM — repos 3:00 — charge E3MOM · 60-70 %
Power Snatch — 4 × 1 @ 72 %1RM — repos 3:00 — charge E3MOM · 70-75 %
```

_Pourcentages du 1RM du mouvement complet ; sans 1RM, charge propre._

**Bloc B · 8' · Building · Snatch Balance**

```
Building — Snatch Balance tempo 2-0-X-1
Snatch Balance — 3 × 5 @ 50 %1RM — repos 1:30 — tempo 2-0-X-1 — charge building tempo
```

**Bloc C · 15' · EMOM 15 · Front Squat / Chest-to-Bar / Echo Bike** · leaderboard oui

```
EMOM 15 · 3 stations en alternance
Min 1 · 6 Front Squat (70/50 kg)
Scaled 50/35 · Inter 60/43 · RX+ 80/55 · Elite 90/60 · Pro 100/70 kg
Min 2 · 8 Chest-to-Bar
Scaled : Ring Rows · Inter : Pull-ups · Elite/Pro : Bar Muscle-ups
Min 3 · 9 cal Echo Bike
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 5 passages, travail 18-32 s / 60 s.
```

_Chaque station ≤ 40 s de travail, le repos est la consigne. Score : reps_total._

**Finisher · 5' · Finisher**

```
Finisher — 3 rounds, rythme continu :
12 Glute Kickback élastique (par côté)
15 KB Swings Russian
```

### #2 — Mardi 2026-09-29 · Force · Squat · 60' (budget 60')

squelette `S2_squat` · bloc C `interval_work_rest` · intention **cardio** · pattern lourd écarté du C : squat · signature `functional|interval_work_rest|interval|5|bike_erg:13cal,hang_power_clean:reps,burpee_box_jump:reps` · aucun relâchement

**Bloc A · 28' · Force · Back Squat**

```
Échauffement (10') — vélo ou rameur facile, mobilité chevilles et hanches, Air Squats, Goblet Squats légers, activation fessiers.

Force — Back Squat
Back Squat — 1 × 5 @ 40 %1RM — repos 1:30 — charge montée
Back Squat — 1 × 5 @ 50 %1RM — repos 1:30 — charge montée
Back Squat — 1 × 3 @ 60 %1RM — repos 2:00 — charge montée
Back Squat — 5 × 5 @ 75 %1RM — repos 2:30 — tempo 3-1-X-1
Tempo 3-1-X-1 sur les séries de travail. Sans 1RM connu : dernière série RPE 8.
```

**Bloc B · 8' · Building · Ring Dips**

```
Building — Ring Dips tempo 2-1-2-1
Ring Dips — 3 × 5 — repos 1:30 — tempo 2-1-2-1 — charge strict, qualité avant quantité
```

**Bloc C · 15' · Intervalles · Bike Erg / Hang Power Clean / Burpee Box Jump** · leaderboard oui

```
5 rounds · every 3'
13 cal Bike Erg
5 Hang Power Clean (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
5 Burpee Box Jump (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Stimulus : RPE 9 — Chaque intervalle est un sprint, repos complet. Cible RX : travail ≈ 1:49 par intervalle.
```

_Chaque intervalle est un sprint, repos complet. Score : time._

**Finisher · 5' · Finisher**

```
Finisher — 3 rounds, rythme continu :
10 Single-Leg Glute Bridge (par côté)
16 Box Step-ups
```

### #3 — Mercredi 2026-09-30 · Gym · Skill · 54' (budget 60')

squelette `S3_gym` · bloc C `emom_alternating` · intention **gym** · pattern lourd écarté du C : aucun · signature `functional|emom_alternating|emom|4|front_rack_lunge:reps,pull_up:reps,row:11cal` · aucun relâchement

**Bloc A · 25' · Skill · Chest-to-Bar**

```
Échauffement (10') — mobilité épaules et poignets, Scap Pull-Ups, Kip Swings, Hollow / Arch, marche en HS contre le mur.

Skill — Chest-to-Bar : progression en 3 étapes
Étape A : Kip Swings amples + Scap Pull-Ups (3 × 8), fermeture des hanches vers la barre — 3'
Étape B : Chest-to-Bar assistés élastique ou Jumping C2B avec pause poitrine à la barre (3 × 5) — 3'
Étape C : Every 1'30 × 4
5 Chest-to-Bar
→ Scaled : Banded Pull-Ups · Inter : Pull-ups · RX+ : Chest-to-Bar · Elite : Bar Muscle-ups · Pro : Bar Muscle-ups
```

**Bloc B · 8' · Building · Strict Pull-Ups**

```
Building — Strict Pull-Ups tempo 2-1-2-1
Strict Pull-Ups — 3 × 5 — repos 1:30 — tempo 2-1-2-1 — charge strict, qualité avant quantité
```

**Bloc C · 12' · EMOM 12 · Front Rack Lunges / Pull-ups / Row** · leaderboard oui

```
EMOM 12 · 3 stations en alternance
Min 1 · 8 Front Rack Lunges (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
Min 2 · 10 Pull-ups
Scaled : Ring Rows · Inter : Banded Pull-Ups · Elite/Pro : Chest-to-Bar
Min 3 · 11 cal Row
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 4 passages, travail 18-40 s / 60 s.
```

_Chaque station ≤ 40 s de travail, le repos est la consigne. Score : reps_total._

**Finisher · 5' · Finisher**

```
Finisher — 3 rounds, rythme continu :
12 GHD Sit-Ups
30 s Hollow Hold
```

### #4 — Jeudi 2026-10-01 · Haltéro · Clean & Jerk · 62' (budget 60')

squelette `S4_cj` · bloc C `interval_work_rest` · intention **mixed** · pattern lourd écarté du C : hinge · signature `functional|interval_work_rest|interval|5|bike_erg:12cal,overhead_squat:reps,burpee_over_the_bar:reps` · aucun relâchement

**Bloc A · 30' · Haltéro · Clean & Jerk**

```
Échauffement (10') — mobilité poignets et hanches, barre à vide : Clean Deadlift, Muscle Clean, Front Squat, Push Press, Push Jerk en série de 5.

Haltéro — complexe Clean & Jerk (A) : Power Clean + Front Squat + Push Jerk
Un complexe = une répétition, sans lâcher la barre. Sans 1RM connu : monter jusqu'à une charge propre.
Clean & Jerk — 2 × 2 @ 30 %1RM — repos 1:00 — charge montée
Clean & Jerk — 2 × 2 @ 50 %1RM — repos 1:00 — charge montée
Clean & Jerk — 4 × 1 @ 65 %1RM — repos 3:00 — charge E3MOM · 60-70 %
Clean & Jerk — 4 × 1 @ 72 %1RM — repos 3:00 — charge E3MOM · 70-75 %
```

_Pourcentages du 1RM du mouvement complet ; sans 1RM, charge propre._

**Bloc B · 8' · Building · Push Press**

```
Building — Push Press tempo 2-0-1-2
Push Press — 3 × 5 @ 55 %1RM — repos 1:30 — tempo 2-0-1-2 — charge building tempo
```

**Bloc C · 15' · Intervalles · Bike Erg / Overhead Squat / Burpees Over the Bar** · leaderboard oui

```
5 rounds · every 3'
12 cal Bike Erg
6 Overhead Squat (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
7 Burpees Over the Bar
Stimulus : RPE 9 — Chaque intervalle est un sprint, repos complet. Cible RX : travail ≈ 1:51 par intervalle.
```

_Chaque intervalle est un sprint, repos complet. Score : time._

**Finisher · 5' · Finisher**

```
Finisher — 3 rounds, rythme continu :
12 Single-Leg Calf Raise (par côté)
20 s Calf Raise Hold en haut
```

### #5 — Vendredi 2026-10-02 · Force · Hinge · 59' (budget 60')

squelette `S5_hinge` · bloc C `chipper_stations_erg` · intention **cardio** · pattern lourd écarté du C : hinge · signature `functional|chipper_stations_erg|chipper|-|echo_bike:50cal,sled_push:90m,bike_erg:60cal,wall_ball:reps,run:800m,burpee:reps` · aucun relâchement

**Bloc A · 28' · Force · Deadlift**

```
Échauffement (10') — rameur facile, mobilité ischios et hanches, Good Mornings barre à vide, Glute Bridges, Kettlebell Swings légers.

Force — Deadlift
Deadlift — 1 × 5 @ 40 %1RM — repos 1:30 — charge montée
Deadlift — 1 × 5 @ 50 %1RM — repos 1:30 — charge montée
Deadlift — 1 × 3 @ 60 %1RM — repos 2:00 — charge montée
Deadlift — 5 × 3 @ 82 %1RM — repos 3:00 — tempo 2-0-X-2 — charge 80-85 %
Tempo 2-0-X-2 sur les séries de travail. Sans 1RM connu : dernière série RPE 8.
```

**Bloc B · 8' · Building · Front Rack Lunges**

```
Building — Front Rack Lunges tempo 2-1-1-1
Front Rack Lunges — 3 × 5 @ 55 %1RM — repos 1:30 — tempo 2-1-1-1 — charge building tempo
```

**Bloc C · 20' · Chipper · Echo Bike / Sled Push / Bike Erg** · leaderboard oui

```
Chipper · for time (cap 25:30)
50 cal Echo Bike
90 m Sled Push (100/75 kg)
Scaled 50/35 · Inter 75/50 · RX+ 125/100 · Elite 150/125 · Pro 150/125 kg
60 cal Bike Erg
50 Wall Balls (6/4 kg)
Scaled 4/3 · Inter 6/4 · RX+ 9/6 · Elite 9/6 · Pro 9/6 kg
800 m Run
30 Burpees
Stimulus : RPE 7 — Stations enchaînées, ergs à 85 %. Cible RX : ≈ 18:00, cap 25:30.
```

_Stations enchaînées, ergs à 85 %. Score : time._

### #6 — Samedi 2026-10-03 · Long · Engine · 55' (budget 60')

squelette `S6_long` · bloc C `stations_rotation` · intention **mixed** · pattern lourd écarté du C : aucun · signature `functional|stations_rotation|stations|4|shuttle_run:200m,kb_clean:reps,row:19cal,db_thruster:reps` · aucun relâchement

**Bloc C · 48' · Stations · Shuttle Run / KB Clean / Row** · leaderboard oui

```
Échauffement long (18') — 3 tours faciles : 2' d'erg au choix, Inchworms, Spiderman Lunges, Scap Pull-Ups, Air Squats ; puis les mouvements du metcon à vide.

4 rounds × 4 stations · 75 s on / 30 s off
Station 1 · Shuttle Run (max m, cible 200 m)
Station 2 · KB Clean (24/16 kg) (max reps, cible 25)
Scaled 16/12 · Inter 20/16 · RX+ 28/20 · Elite 32/24 · Pro 32/24 kg
Station 3 · Row (max cal, cible 19 cal)
Station 4 · DB Thruster (22.5/15 kg) (max reps, cible 23)
Scaled 15/10 · Inter 20/12.5 · RX+ 30/20 · Elite 35/22.5 · Pro 40/25 kg
Stimulus : RPE 8 — Max effort sur chaque station, repos incomplet voulu. Cible RX : 4 tours × 4 stations, 75 s on / 30 s off.
```

_Max effort sur chaque station, repos incomplet voulu. Score : reps_total._

**Finisher · 5' · Finisher**

```
Finisher — 3 rounds, rythme continu :
12 DB Hip Thrust
20 m Monster Walk élastique
```

## Functional / Hybrid — 2026-W41 (lundi 2026-10-05)

seed `2812823762` · publication `publish_at = 2026-10-04T16:00:00.000Z` (dimanche 18:00 Paris) · volume gym RX de la semaine : pull 110/150, HSPU 0/80 · aucun relâchement semaine

### #7 — Lundi 2026-10-05 · Haltéro · Snatch · 62' (budget 60')

squelette `S1_snatch` · bloc C `gym_density` · intention **gym** · pattern lourd écarté du C : hinge · signature `functional|gym_density|emom|5|chest_to_bar:reps,ghd_sit_up:reps` · aucun relâchement

**Bloc A · 30' · Haltéro · Squat Snatch**

```
Échauffement (10') — mobilité épaules et hanches, barre à vide : Snatch Deadlift, Muscle Snatch, Overhead Squat, Snatch Balance en série de 5.

Haltéro — complexe Squat Snatch (B) : Power Snatch + Hang Power Snatch + Squat Snatch
Un complexe = une répétition, sans lâcher la barre. Sans 1RM connu : monter jusqu'à une charge propre.
Squat Snatch — 2 × 2 @ 30 %1RM — repos 1:00 — charge montée
Squat Snatch — 2 × 2 @ 50 %1RM — repos 1:00 — charge montée
Squat Snatch — 4 × 1 @ 65 %1RM — repos 3:00 — charge E3MOM · 60-70 %
Squat Snatch — 4 × 1 @ 72 %1RM — repos 3:00 — charge E3MOM · 70-75 %
```

_Pourcentages du 1RM du mouvement complet ; sans 1RM, charge propre._

**Bloc B · 8' · Building · Overhead Squat**

```
Building — Overhead Squat tempo 3-1-1-1
Overhead Squat — 3 × 5 @ 55 %1RM — repos 1:30 — tempo 3-1-1-1 — charge building tempo
```

**Bloc C · 15' · EMOM 15 · Chest-to-Bar / GHD Sit-Ups** · leaderboard oui

```
EMOM 15 · every 1:30 · 2 stations en alternance
Min 1 · 12 Chest-to-Bar
Scaled : Ring Rows · Inter : Pull-ups · Elite/Pro : Bar Muscle-ups
Min 2 · 12 GHD Sit-Ups
Scaled/Inter : Sit-ups
Stimulus : RPE 6.5 — Technique, aucun échec musculaire. Cible RX : 5 passages, travail 26-26 s / 90 s.
```

_Technique, aucun échec musculaire. Score : reps_total._

**Finisher · 5' · Finisher**

```
Finisher — 3 rounds, rythme continu :
50 m Sandbag Bear Hug Carry
10 Air Squats
```

### #8 — Mardi 2026-10-06 · Force · Squat · 65' (budget 60')

squelette `S2_squat` · bloc C `interval_work_rest` · intention **cardio** · pattern lourd écarté du C : squat · signature `functional|interval_work_rest|interval|5|ski_erg:15cal,deadlift:reps,burpee_box_jump:reps` · aucun relâchement

**Bloc A · 28' · Force · Front Squat**

```
Échauffement (10') — vélo ou rameur facile, mobilité chevilles et hanches, Air Squats, Goblet Squats légers, activation fessiers.

Force — Front Squat
Front Squat — 1 × 5 @ 40 %1RM — repos 1:30 — charge montée
Front Squat — 1 × 5 @ 50 %1RM — repos 1:30 — charge montée
Front Squat — 1 × 3 @ 60 %1RM — repos 2:00 — charge montée
Front Squat — 5 × 3 @ 82 %1RM — repos 3:00 — tempo 2-1-X-1 — charge 80-85 %
Tempo 2-1-X-1 sur les séries de travail. Sans 1RM connu : dernière série RPE 8.
```

**Bloc B · 8' · Building · Strict Pull-Ups**

```
Building — Strict Pull-Ups tempo 2-1-2-1
Strict Pull-Ups — 3 × 5 — repos 1:30 — tempo 2-1-2-1 — charge strict, qualité avant quantité
```

**Bloc C · 20' · Intervalles · SkiErg / Deadlift / Burpee Box Jump** · leaderboard oui

```
5 rounds · every 4'
15 cal SkiErg
5 Deadlift (70/50 kg)
Scaled 50/35 · Inter 60/43 · RX+ 80/55 · Elite 90/60 · Pro 100/70 kg
5 Burpee Box Jump (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Stimulus : RPE 9 — Chaque intervalle est un sprint, repos complet. Cible RX : travail ≈ 2:01 par intervalle.
```

_Chaque intervalle est un sprint, repos complet. Score : time._

**Finisher · 5' · Finisher**

```
Finisher — 2 rounds, rythme continu :
250 m Row respiration nasale
60 s Box Breathing 4-4-4-4
```

### #9 — Mercredi 2026-10-07 · Gym · Skill · 57' (budget 60')

squelette `S3_gym` · bloc C `death_by` · intention **mixed** · pattern lourd écarté du C : aucun · signature `functional|death_by|death_by|-|bike_erg:5cal,power_snatch:reps` · aucun relâchement

**Bloc A · 25' · Skill · Handstand Walk**

```
Échauffement (10') — mobilité épaules et poignets, Scap Pull-Ups, Kip Swings, Hollow / Arch, marche en HS contre le mur.

Skill — Handstand Walk : progression en 3 étapes
Étape A : Handstand Hold dos au mur (3 × 30 s) puis Shoulder Taps (3 × 10), doigts qui agrippent le sol — 3'
Étape B : Décollages du mur : Handstand Walk 2-3 pas puis retour (3 × 4 tentatives) — 3'
Étape C : Every 1'30 × 4
10 Handstand Walk
→ Scaled : Handstand Shoulder Taps · Inter : Half Wall Walks · RX+ : Handstand Walk · Elite : Handstand Walk · Pro : Handstand Walk
```

**Bloc B · 8' · Building · Ring Dips**

```
Building — Ring Dips tempo 2-1-2-1
Ring Dips — 3 × 5 — repos 1:30 — tempo 2-1-2-1 — charge strict, qualité avant quantité
```

**Bloc C · 15' · Death by · Bike Erg / Power Snatch** · leaderboard oui

```
EMOM 15 · Death by : +1 rep par minute jusqu'à l'échec
5 cal Bike Erg (avant chaque série)
Power Snatch (43/30 kg) · min 1 : 1 rep, +1 rep par minute
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
Stimulus : RPE 9 — S'arrête quand la minute n'est plus tenue. Cible RX : minute 10.
```

_S'arrête quand la minute n'est plus tenue. Score : reps_total._

**Finisher · 5' · Finisher**

```
Finisher — 2 rounds, rythme continu :
100 m Marche rapide
20 s Marche en apnée expiratoire
```

### #10 — Jeudi 2026-10-08 · Haltéro · Clean & Jerk · 62' (budget 60')

squelette `S4_cj` · bloc C `emom_alternating` · intention **mixed** · pattern lourd écarté du C : hinge · signature `functional|emom_alternating|emom|5|push_jerk:reps,pull_up:reps,echo_bike:11cal` · aucun relâchement

**Bloc A · 30' · Haltéro · Clean & Jerk**

```
Échauffement (10') — mobilité poignets et hanches, barre à vide : Clean Deadlift, Muscle Clean, Front Squat, Push Press, Push Jerk en série de 5.

Haltéro — complexe Clean & Jerk (B) : Hang Power Clean + Squat Clean + Split Jerk
Un complexe = une répétition, sans lâcher la barre. Sans 1RM connu : monter jusqu'à une charge propre.
Clean & Jerk — 2 × 2 @ 30 %1RM — repos 1:00 — charge montée
Clean & Jerk — 2 × 2 @ 50 %1RM — repos 1:00 — charge montée
Clean & Jerk — 4 × 1 @ 65 %1RM — repos 3:00 — charge E3MOM · 60-70 %
Clean & Jerk — 4 × 1 @ 72 %1RM — repos 3:00 — charge E3MOM · 70-75 %
```

_Pourcentages du 1RM du mouvement complet ; sans 1RM, charge propre._

**Bloc B · 8' · Building · Front Squat**

```
Building — Front Squat tempo 2-2-X-1
Front Squat — 3 × 5 @ 55 %1RM — repos 1:30 — tempo 2-2-X-1 — charge building tempo
```

**Bloc C · 15' · EMOM 15 · Push Jerk / Pull-ups / Echo Bike** · leaderboard oui

```
EMOM 15 · 3 stations en alternance
Min 1 · 8 Push Jerk (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
Min 2 · 10 Pull-ups
Scaled : Ring Rows · Inter : Banded Pull-Ups · Elite/Pro : Chest-to-Bar
Min 3 · 11 cal Echo Bike
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 5 passages, travail 18-39 s / 60 s.
```

_Chaque station ≤ 40 s de travail, le repos est la consigne. Score : reps_total._

**Finisher · 5' · Finisher**

```
Finisher — 3 rounds, rythme continu :
20 Sit-ups
20 s Superman Hold
```

### #11 — Vendredi 2026-10-09 · Force · Hinge · 59' (budget 60')

squelette `S5_hinge` · bloc C `stations_rotation` · intention **mixed** · pattern lourd écarté du C : hinge · signature `functional|stations_rotation|stations|3|run:200m,box_jump:reps,ski_erg:14cal,db_box_step_over:reps` · aucun relâchement

**Bloc A · 28' · Force · Romanian Deadlift**

```
Échauffement (10') — rameur facile, mobilité ischios et hanches, Good Mornings barre à vide, Glute Bridges, Kettlebell Swings légers.

Force — Romanian Deadlift
Romanian Deadlift — 1 × 5 @ 40 %1RM — repos 1:30 — charge montée
Romanian Deadlift — 1 × 5 @ 50 %1RM — repos 1:30 — charge montée
Romanian Deadlift — 1 × 3 @ 60 %1RM — repos 2:00 — charge montée
Romanian Deadlift — 5 × 5 @ 75 %1RM — repos 2:30 — tempo 3-1-1-1
Tempo 3-1-1-1 sur les séries de travail. Sans 1RM connu : dernière série RPE 8.
```

**Bloc B · 8' · Building · Front Rack Lunges**

```
Building — Front Rack Lunges tempo 2-1-1-1
Front Rack Lunges — 3 × 5 @ 55 %1RM — repos 1:30 — tempo 2-1-1-1 — charge building tempo
```

**Bloc C · 20' · Stations · Run / Box Jumps / SkiErg** · leaderboard oui

```
3 rounds × 4 stations · 60 s on / 30 s off
Station 1 · Run (max m, cible 200 m)
Station 2 · Box Jumps (60/50 cm) (max reps, cible 18)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Scaled : Box Step-ups
Station 3 · SkiErg (max cal, cible 14 cal)
Station 4 · DB Box Step Over (22.5/15 kg) (max reps, cible 14)
Scaled 15/10 · Inter 20/12.5 · RX+ 30/20 · Elite 35/22.5 · Pro 40/25 kg
Stimulus : RPE 8 — Max effort sur chaque station, repos incomplet voulu. Cible RX : 3 tours × 4 stations, 60 s on / 30 s off.
```

_Max effort sur chaque station, repos incomplet voulu. Score : reps_total._

### #12 — Samedi 2026-10-10 · Long · Engine · 55' (budget 60')

squelette `S6_long` · bloc C `engine_long_amrap` · intention **mixed** · pattern lourd écarté du C : aucun · signature `functional|engine_long_amrap|amrap|-|bike_erg:16cal,bar_facing_burpee:reps,kb_goblet_squat:reps,run:500m` · **relâchements : c:format, c:skeleton**

**Bloc C · 48' · AMRAP 30 · Bike Erg / Bar Facing Burpees / Goblet Squat** · leaderboard oui

```
Échauffement long (18') — 3 tours faciles : 2' d'erg au choix, Inchworms, Spiderman Lunges, Scap Pull-Ups, Air Squats ; puis les mouvements du metcon à vide.

AMRAP 30
16 cal Bike Erg
10 Bar Facing Burpees
16 Goblet Squat (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
500 m Run
Stimulus : RPE 6.5 — Zone 3, respiration contrôlée du début à la fin. Cible RX : ≈ 5 rounds.
```

_Zone 3, respiration contrôlée du début à la fin. Score : rounds_reps._

**Finisher · 5' · Finisher**

```
Finisher — 3 rounds, rythme continu :
8 Ab Wheel Rollout
40 s Plank Hold
```

## Musculation — 2026-W40 (lundi 2026-09-28) · objectif **Tonification**

seed `2189133668` · publication `publish_at = 2026-09-27T16:00:00.000Z` · leaderboard désactivé sur les 5 séances · séries hebdo par muscle principal (plafond 16) : fessiers 16, tronc 16, lombaires 12, pecs 9, epaules 9, quadriceps 9, dos 9, obliques 7, mollets 5, epaules_post 5, biceps 5, ischios 5, triceps 4, trapezes 4 · **relâchements semaine : fessiers_ischios:adjacent_muscle, fessiers_ischios:bonus_slot, fessiers_ischios:slot_muscle, fessiers_ischios:tempo_311, jambes:bonus_slot, jambes:tempo_311, pull:bonus_slot, push:bonus_slot, tronc:bonus_slot, weekly_cap:fessiers, weekly_cap:tronc**

### #1 — Lundi 2026-09-28 · Push · Tonification · 41' (budget 45')

squelette `push_endurance` · signature `musculation|push_endurance|db_bench_press,strict_press,db_fly,overhead_triceps_extension,lateral_raise,oblique_crunch` · **relâchements : bonus_slot**

```
Musculation · Push · Tonification · 45' · Box

DB Bench Press — 5 × 15 — charge RPE 7 — repos 40s
Strict Press — 5 × 15 — RPE 7 (≈ 60 % du 1RM) — repos 40s
DB Fly — 4 × 18 — charge RPE 7 — repos 40s
Overhead Triceps Extension — 4 × 18 — charge RPE 7 — repos 40s
Lateral Raise — 4 × 18 — charge RPE 7 — repos 40s
Oblique Crunch — 4 × 18 / côté — charge poids du corps — repos 30s

Durée estimée 41'
Stimulus : Rythme continu, aucune série à l'échec
```

### #2 — Mardi 2026-09-29 · Jambes · Tonification · 43' (budget 45')

squelette `jambes_endurance` · signature `musculation|jambes_endurance|air_squat,reverse_lunge,squat_hold,bodyweight_calf_raise,hollow_hold,glute_bridge` · **relâchements : bonus_slot, tempo_311**

```
Musculation · Jambes · Tonification · 45' · Box

Air Squats — 5 × 15 — charge poids du corps — repos 40s
  tempo 3-1-1
DB Reverse Lunge — 5 × 15 / jambe — charge RPE 7 — repos 40s
Squat Hold — 4 × 45 s — repos 40s
Calf Raise (bodyweight) — 5 × 15 — charge poids du corps — repos 40s
Hollow Hold — 5 × 45 s — repos 30s
Glute Bridge — 4 × 18 — charge poids du corps — repos 40s

Durée estimée 43'
Stimulus : Rythme continu, aucune série à l'échec
```

### #3 — Jeudi 2026-10-01 · Pull · Tonification · 41' (budget 45')

squelette `pull_endurance` · signature `musculation|pull_endurance|pull_up_banded,rear_delt_fly,barbell_row,hammer_curl,side_plank,barbell_shrug` · **relâchements : bonus_slot**

```
Musculation · Pull · Tonification · 45' · Box

Banded Pull-Ups — 5 × 14 — charge poids du corps — repos 40s
Rear Delt Fly — 5 × 15 — charge RPE 7 — repos 40s
Barbell Row — 4 × 18 — RPE 7 (≈ 55 % du 1RM) — repos 40s
Hammer Curl — 5 × 15 — charge RPE 7 — repos 40s
Side Plank — 4 × 45 s / côté — repos 30s
Barbell Shrug — 4 × 18 — RPE 7 (≈ 55 % du 1RM) — repos 40s

Durée estimée 41'
Stimulus : Rythme continu, aucune série à l'échec
```

### #4 — Vendredi 2026-10-02 · Fessiers & ischios · Tonification · 33' (budget 45')

squelette `fessiers_ischios_endurance` · signature `musculation|fessiers_ischios_endurance|romanian_deadlift,db_hip_thrust,superman,banded_hip_abduction,back_extension,db_sumo_squat` · **relâchements : adjacent_muscle, bonus_slot, slot_muscle, tempo_311, weekly_cap**

```
Musculation · Fessiers & ischios · Tonification · 45' · Box

Romanian Deadlift — 5 × 15 — RPE 7 (≈ 60 % du 1RM) — repos 40s
  tempo 3-1-1
DB Hip Thrust — 2 × 18 — charge RPE 7 — repos 40s
  tempo 3-1-1
Superman Hold — 5 × 45 s — repos 40s
Banded Hip Abduction — 2 × 18 — charge poids du corps — repos 40s
  tempo 3-1-1
Back Extension — 4 × 18 — charge poids du corps — repos 30s
DB Sumo Squat — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 33'
Stimulus : Rythme continu, aucune série à l'échec
```

### #5 — Samedi 2026-10-03 · Tronc · Tonification · 18' (budget 20')

squelette `tronc_endurance` · signature `musculation|tronc_endurance|hollow_hold,crunch_with_rotation,suitcase_carry,back_extension,vacuum` · **relâchements : bonus_slot, weekly_cap**

```
Musculation · Tronc · Tonification · 20' · Box

Hollow Hold — 2 × 45 s — repos 30s
Crunch With Rotation — 3 × 18 — charge poids du corps — repos 30s
Suitcase Carry — 2 × 40 m / côté — charge RPE 7 — repos 30s
Back Extension — 3 × 18 — charge poids du corps — repos 30s
Stomach Vacuum — 3 × 45 s — repos 30s

Durée estimée 18'
Stimulus : Rythme continu, aucune série à l'échec
```

## Musculation — 2026-W43 (lundi 2026-10-19) · objectif **Prise de muscle**

seed `3189392821` · publication `publish_at = 2026-10-18T16:00:00.000Z` · leaderboard désactivé sur les 5 séances · séries hebdo par muscle principal (plafond 16) : fessiers 16, tronc 12, lombaires 10, pecs 8, epaules 8, ischios 8, dos 8, quadriceps 7, epaules_post 4, biceps 4, triceps 3, mollets 3, trapezes 3, obliques 3 · **relâchements semaine : fessiers_ischios:adjacent_muscle, fessiers_ischios:bonus_slot, fessiers_ischios:slot_ids, fessiers_ischios:slot_muscle, jambes:slot_muscle, jambes:slot_objective, tronc:slot_objective**

### #6 — Lundi 2026-10-19 · Push · Prise de muscle · 41' (budget 45')

squelette `push_hypertrophie` · signature `musculation|push_hypertrophie|bench_press,strict_press,db_fly,lateral_raise,overhead_triceps_extension,ab_wheel` · aucun relâchement

```
Musculation · Push · Prise de muscle · 45' · Box

Bench Press — 4 × 10 — RPE 8 (≈ 68 % du 1RM) — repos 1:30
Strict Press — 4 × 10 — RPE 8 (≈ 68 % du 1RM) — repos 1:15
DB Fly — 4 × 10 — charge RPE 8 — repos 1:15
Lateral Raise — 4 × 10 — charge RPE 8 — repos 1:15
Overhead Triceps Extension — 3 × 10 — charge RPE 8 — repos 1:15
Ab Wheel Rollout — 3 × 10 — charge poids du corps — repos 1:00

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #7 — Mardi 2026-10-20 · Jambes · Prise de muscle · 41' (budget 45')

squelette `jambes_hypertrophie` · signature `musculation|jambes_hypertrophie|back_squat,good_morning,step_up_high,squat_hold,glute_bridge,bodyweight_calf_raise` · **relâchements : slot_muscle, slot_objective**

```
Musculation · Jambes · Prise de muscle · 45' · Box

Back Squat — 4 × 10 — RPE 8 (≈ 68 % du 1RM) — repos 1:30
Good Morning — 4 × 10 — charge RPE 8 — repos 1:15
High Box Step-Up — 3 × 10 / jambe — charge RPE 8 — repos 1:15
Squat Hold — 3 × 45 s — repos 1:15
Glute Bridge — 3 × 13 — charge poids du corps — repos 1:15
Calf Raise (bodyweight) — 3 × 18 — charge poids du corps — repos 45s

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #8 — Jeudi 2026-10-22 · Pull · Prise de muscle · 41' (budget 45')

squelette `pull_hypertrophie` · signature `musculation|pull_hypertrophie|chin_up,bent_over_lateral_raise,barbell_row,concentration_curl,db_shrug,reverse_crunch` · aucun relâchement

```
Musculation · Pull · Prise de muscle · 45' · Box

Chin-Ups — 4 × 10 — charge poids du corps — repos 1:30
Bent Over Lateral Raise — 4 × 10 — charge RPE 8 — repos 1:15
Barbell Row — 4 × 10 — RPE 8 (≈ 68 % du 1RM) — repos 1:15
Concentration Curl — 4 × 10 / bras — charge RPE 8 — repos 1:15
DB Shrug — 3 × 10 — charge RPE 8 — repos 1:15
Reverse Crunch — 3 × 10 — charge poids du corps — repos 1:00

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #9 — Vendredi 2026-10-23 · Fessiers & ischios · Prise de muscle · 42' (budget 45')

squelette `fessiers_ischios_hypertrophie` · signature `musculation|fessiers_ischios_hypertrophie|romanian_deadlift,hip_thrust,superman,glute_bridge,back_extension,db_sumo_squat` · **relâchements : adjacent_muscle, bonus_slot, slot_ids, slot_muscle**

```
Musculation · Fessiers & ischios · Prise de muscle · 45' · Box

Romanian Deadlift — 4 × 10 — RPE 8 (≈ 68 % du 1RM) — repos 1:30
Hip Thrust — 4 × 10 — RPE 8 (≈ 68 % du 1RM) — repos 1:30
Superman Hold — 4 × 45 s — repos 1:15
Glute Bridge — 3 × 13 — charge poids du corps — repos 1:15
Back Extension — 3 × 10 — charge poids du corps — repos 1:00
DB Sumo Squat — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 42'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #10 — Samedi 2026-10-24 · Tronc · Prise de muscle · 18' (budget 20')

squelette `tronc_hypertrophie` · signature `musculation|tronc_hypertrophie|hanging_leg_raise,crunch_with_rotation,back_extension,reverse_crunch` · **relâchements : slot_objective**

```
Musculation · Tronc · Prise de muscle · 20' · Box

Hanging Leg Raise — 3 × 10 — charge poids du corps — repos 1:00
Crunch With Rotation — 3 × 18 — charge poids du corps — repos 1:00
Back Extension — 3 × 10 — charge poids du corps — repos 1:00
Reverse Crunch — 3 × 10 — charge poids du corps — repos 1:00

Durée estimée 18'
Stimulus : Dernière série à 1-2 reps de l'échec
```

