# Échantillon générateur — 10 WODs par intention × discipline

Moteur 1.0.0 · catalogue v1 · banque v1. Sortie texte telle que l'athlète la lirait (`title` + `description`), suivie de l'estimation par catégorie et des métadonnées du tirage. Tout est régénérable à l'identique depuis la seed.

## Functional

### Functional · mixed

#### 1. 30-20-10 · Hang Power Clean / Handstand Push-ups

**Entrées** : Express · Functional · 8' · intention mixed · format Surprise

```
For time · 30-20-10 (cap 10:30)
Hang Power Clean (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
Handstand Push-ups
Scaled : Push-ups · Inter : Pike Push-Ups · Elite/Pro : Strict Handstand Push-Ups
Stimulus : RPE 9 — Sprint, sets courts dès le round 1. Cible RX : ≈ 7:29, cap 10:30.
```

Estimation : Scaled 9.5' (≈ 9:28) · Inter 8.5' (≈ 8:28) · RX 7.5' (≈ 7:29) · RX+ 7.0' (≈ 6:57) · Elite 6.5' (≈ 6:29) · Pro 6.2' (≈ 6:10) · cap 10:30

_Squelette `couplet_for_time_21_15_9` · seed 1000 · tirage 2 · signature `functional|couplet_for_time_21_15_9|for_time|-|hang_power_clean:reps,handstand_push_up:reps`_

#### 2. AMRAP 12 · Row / Front Squat / Bar Facing Burpees

**Entrées** : Express · Functional · 12' · intention mixed · format AMRAP

```
AMRAP 12
11 cal Row
7 Front Squat (70/50 kg)
Scaled 50/35 · Inter 60/43 · RX+ 80/55 · Elite 90/60 · Pro 100/70 kg
8 Bar Facing Burpees
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 5 rounds.
```

Estimation : Scaled 12.0' (≈ 4 rounds) · Inter 12.0' (≈ 5 rounds) · RX 12.0' (≈ 5 rounds) · RX+ 12.0' (≈ 6 rounds) · Elite 12.0' (≈ 6 rounds) · Pro 12.0' (≈ 7 rounds)

_Squelette `triplet_amrap_mid` · seed 1007 · tirage 1 · signature `functional|triplet_amrap_mid|amrap|-|row:11cal,front_squat:reps,bar_facing_burpee:reps`_

#### 3. Ladder · Thruster / Toes-to-Bar

**Entrées** : Express · Functional · 15' · intention mixed · format For time

```
Ladder 3-6-9-12-15-18-21 · AMRAP 15
Monter les paliers dans le temps imparti, score = reps totales
Thruster (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
Toes-to-Bar
Scaled : Hanging Knee Raises
Stimulus : RPE 8 — Les premiers paliers se font sans poser la barre. Cible RX : palier 21.
```

Estimation : Scaled 15.0' (palier 21) · Inter 15.0' (palier 21) · RX 15.0' (palier 21) · RX+ 15.0' (palier 21) · Elite 15.0' (palier 21) · Pro 15.0' (palier 21)

_Squelette `ladder_ascending` · seed 1014 · tirage 2 · signature `functional|ladder_ascending|ladder|-|thruster:reps,toes_to_bar:reps`_

#### 4. EMOM 20 · Front Rack Lunges / Ring Dips / Bike Erg

**Entrées** : Express · Functional · 20' · intention mixed · format EMOM

```
EMOM 20 · 4 stations en alternance
Min 1 · 7 Front Rack Lunges (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
Min 2 · 8 Ring Dips
Scaled : Box Dips · Inter : Banded Ring Dips
Min 3 · 10 cal Bike Erg
Min 4 · 10 Burpees
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 5 passages, travail 18-40 s / 60 s.
```

Estimation : Scaled 20.0' (5 passages, travail 23-52 s / 60 s) · Inter 20.0' (5 passages, travail 20-46 s / 60 s) · RX 20.0' (5 passages, travail 18-40 s / 60 s) · RX+ 20.0' (5 passages, travail 16-37 s / 60 s) · Elite 20.0' (5 passages, travail 15-34 s / 60 s) · Pro 20.0' (5 passages, travail 14-32 s / 60 s)

_Squelette `emom_alternating` · seed 1021 · tirage 1 · signature `functional|emom_alternating|emom|5|front_rack_lunge:reps,ring_dip:reps,bike_erg:10cal,burpee:reps`_

#### 5. Chipper · SkiErg / Sandbag Carry / Row

**Entrées** : Express · Functional · 30' · intention mixed · format Chipper

```
2 rounds for time · chipper (cap 40:30)
30 cal SkiErg
180 m Sandbag Carry (40/30 kg)
Scaled 20/15 · Inter 30/20 · RX+ 50/35 · Elite 60/45 · Pro 70/50 kg
20 cal Row
24 KB Clean (24/16 kg)
Scaled 16/12 · Inter 20/16 · RX+ 28/20 · Elite 32/24 · Pro 32/24 kg
1400 m Run
11 Burpees
Stimulus : RPE 7 — Stations enchaînées, ergs à 85 %. Cible RX : ≈ 28:35, cap 40:30.
```

Estimation : Scaled 36.6' (≈ 36:37) · Inter 32.6' (≈ 32:36) · RX 28.6' (≈ 28:35) · RX+ 26.5' (≈ 26:30) · Elite 24.6' (≈ 24:35) · Pro 23.4' (≈ 23:24) · cap 40:30

_Squelette `chipper_stations_erg` · seed 1028 · tirage 2 · signature `functional|chipper_stations_erg|chipper|2|ski_erg:30cal,sandbag_carry:180m,row:20cal,kb_clean:reps,run:1400m,burpee:reps`_

#### 6. AMRAP 8 · Sumo Deadlift High Pull / Pistols

**Entrées** : Express · Functional · 8' · intention mixed · format Stations

```
AMRAP 8
10 Sumo Deadlift High Pull (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
12 Pistols
Scaled : Box Pistols · Inter : Pistols To Box
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 6 rounds.
```

Estimation : Scaled 8.0' (≈ 5 rounds) · Inter 8.0' (≈ 5 rounds) · RX 8.0' (≈ 6 rounds) · RX+ 8.0' (≈ 6 rounds) · Elite 8.0' (≈ 7 rounds) · Pro 8.0' (≈ 7 rounds)

_Squelette `couplet_amrap_short` · seed 1035 · tirage 2 · relâché : format · signature `functional|couplet_amrap_short|amrap|-|sumo_deadlift_high_pull:reps,pistol:reps`_

#### 7. AMRAP 12 · DB Thruster / Bike Erg

**Entrées** : Express · Functional · 12' · intention mixed · format Intervalles

```
AMRAP 12
12 DB Thruster (22.5/15 kg)
Scaled 15/10 · Inter 20/12.5 · RX+ 30/20 · Elite 35/22.5 · Pro 40/25 kg
30 cal Bike Erg
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 4 rounds.
```

Estimation : Scaled 12.0' (≈ 3 rounds) · Inter 12.0' (≈ 4 rounds) · RX 12.0' (≈ 4 rounds) · RX+ 12.0' (≈ 5 rounds) · Elite 12.0' (≈ 5 rounds) · Pro 12.0' (≈ 5 rounds)

_Squelette `couplet_amrap_short` · seed 1042 · tirage 1 · relâché : format · signature `functional|couplet_amrap_short|amrap|-|db_thruster:reps,bike_erg:30cal`_

#### 8. Death by · SkiErg / Deadlift

**Entrées** : Express · Functional · 15' · intention mixed · format Surprise

```
EMOM 15 · Death by : +1 rep par minute jusqu'à l'échec
5 cal SkiErg (avant chaque série)
Deadlift (100/70 kg) · min 1 : 1 rep, +1 rep par minute
Scaled 60/40 · Inter 80/55 · RX+ 120/80 · Elite 140/95 · Pro 160/110 kg
Stimulus : RPE 9 — S'arrête quand la minute n'est plus tenue. Cible RX : minute 13.
```

Estimation : Scaled 15.0' (minute 8) · Inter 15.0' (minute 10) · RX 15.0' (minute 13) · RX+ 15.0' (minute 15 complétée) · Elite 15.0' (minute 15 complétée) · Pro 15.0' (minute 15 complétée)

_Squelette `death_by` · seed 1049 · tirage 1 · signature `functional|death_by|death_by|-|ski_erg:5cal,deadlift:reps`_

#### 9. AMRAP 10 · Bike Erg / KB Swing / Burpees

**Entrées** : Après la classe · Functional · 10' · intention mixed · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 10
18 cal Bike Erg
10 KB Swing (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
12 Burpees
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 3 rounds.
```

Estimation : Scaled 10.0' (≈ 3 rounds) · Inter 10.0' (≈ 3 rounds) · RX 10.0' (≈ 3 rounds) · RX+ 10.0' (≈ 4 rounds) · Elite 10.0' (≈ 4 rounds) · Pro 10.0' (≈ 4 rounds)

_Squelette `triplet_amrap_mid` · seed 1056 · tirage 63 · relâché : format, duration±5 · signature `functional|triplet_amrap_mid|amrap|-|bike_erg:18cal,kb_swing_american:reps,burpee:reps`_

#### 10. AMRAP 15 · Bike Erg / KB Deadlift / Hollow Rocks

**Entrées** : Après la classe · Functional · 15' · intention mixed · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 15
20 cal Bike Erg
13 KB Deadlift (24/16 kg)
Scaled 16/12 · Inter 20/16 · RX+ 28/20 · Elite 32/24 · Pro 32/24 kg
27 Hollow Rocks
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 6 rounds.
```

Estimation : Scaled 15.0' (≈ 4 rounds) · Inter 15.0' (≈ 5 rounds) · RX 15.0' (≈ 6 rounds) · RX+ 15.0' (≈ 6 rounds) · Elite 15.0' (≈ 7 rounds) · Pro 15.0' (≈ 7 rounds)

_Squelette `triplet_amrap_mid` · seed 1063 · tirage 1 · signature `functional|triplet_amrap_mid|amrap|-|bike_erg:20cal,kb_deadlift:reps,hollow_rock:reps`_

### Functional · cardio

#### 11. Tabata · Echo Bike / Pull-ups

**Entrées** : Express · Functional · 8' · intention cardio · format Surprise

```
Tabata × 2 blocs · 8 × 20 s / 10 s, transition 30 s
Tabata 1 · Echo Bike (max reps)
Tabata 2 · Pull-ups (max reps)
Scaled : Ring Rows · Inter : Banded Pull-Ups
Stimulus : RPE 8 — Score = somme des reps min de chaque bloc. Cible RX : reps min sur 8 × 20 s par bloc.
```

Estimation : Scaled 8.0' (reps min sur 8 × 20 s par bloc) · Inter 8.0' (reps min sur 8 × 20 s par bloc) · RX 8.0' (reps min sur 8 × 20 s par bloc) · RX+ 8.0' (reps min sur 8 × 20 s par bloc) · Elite 8.0' (reps min sur 8 × 20 s par bloc) · Pro 8.0' (reps min sur 8 × 20 s par bloc)

_Squelette `tabata_pair` · seed 1070 · tirage 1 · signature `functional|tabata_pair|tabata|8|echo_bike:cal,pull_up:reps`_

#### 12. AMRAP 12 · Echo Bike / Push Press / Ring Muscle-ups

**Entrées** : Express · Functional · 12' · intention cardio · format AMRAP

```
AMRAP 12
11 cal Echo Bike
15 Push Press (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
4 Ring Muscle-ups
Scaled : Ring Rows · Inter : Chest-to-Bar · RX : Bar Muscle-ups
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 6 rounds.
```

Estimation : Scaled 12.0' (≈ 4 rounds) · Inter 12.0' (≈ 5 rounds) · RX 12.0' (≈ 6 rounds) · RX+ 12.0' (≈ 6 rounds) · Elite 12.0' (≈ 6 rounds) · Pro 12.0' (≈ 7 rounds)

_Squelette `triplet_amrap_mid` · seed 1077 · tirage 1 · signature `functional|triplet_amrap_mid|amrap|-|echo_bike:11cal,push_press:reps,ring_muscle_up:reps`_

#### 13. AMRAP 15 · SkiErg / DB Clean & Jerk / Burpee Box Jump

**Entrées** : Express · Functional · 15' · intention cardio · format For time

```
AMRAP 15
14 cal SkiErg
12 DB Clean & Jerk (15/10 kg)
Scaled 10/7.5 · Inter 12.5/10 · RX+ 20/12.5 · Elite 22.5/15 · Pro 22.5/15 kg
7 Burpee Box Jump (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 5 rounds.
```

Estimation : Scaled 15.0' (≈ 4 rounds) · Inter 15.0' (≈ 5 rounds) · RX 15.0' (≈ 5 rounds) · RX+ 15.0' (≈ 6 rounds) · Elite 15.0' (≈ 6 rounds) · Pro 15.0' (≈ 6 rounds)

_Squelette `triplet_amrap_mid` · seed 1084 · tirage 1 · relâché : format · signature `functional|triplet_amrap_mid|amrap|-|ski_erg:14cal,db_clean_and_jerk:reps,burpee_box_jump:reps`_

#### 14. Intervalles · Row / Hang Clean & Jerk / Burpee Box Jump Over

**Entrées** : Express · Functional · 20' · intention cardio · format EMOM

```
6 rounds · every 4'
10 cal Row
4 Hang Clean & Jerk (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
5 Burpee Box Jump Over (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Stimulus : RPE 9 — Chaque intervalle est un sprint, repos complet. Cible RX : travail ≈ 1:48 par intervalle.
```

Estimation : Scaled 22.2' (travail ≈ 2:13 par intervalle) · Inter 22.0' (travail ≈ 2:01 par intervalle) · RX 21.8' (travail ≈ 1:48 par intervalle) · RX+ 21.7' (travail ≈ 1:41 par intervalle) · Elite 21.6' (travail ≈ 1:35 par intervalle) · Pro 21.5' (travail ≈ 1:31 par intervalle)

_Squelette `interval_work_rest` · seed 1091 · tirage 1 · relâché : format · signature `functional|interval_work_rest|interval|6|row:10cal,hang_clean_and_jerk:reps,burpee_box_jump_over:reps`_

#### 15. Chipper · Row / Farmer Carry / SkiErg

**Entrées** : Express · Functional · 30' · intention cardio · format Chipper

```
2 rounds for time · chipper (cap 42:30)
35 cal Row
150 m Farmer Carry (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
35 cal SkiErg
15 KB Clean & Jerk (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
1200 m Run
15 Burpees Over the Bar
Stimulus : RPE 7 — Stations enchaînées, ergs à 85 %. Cible RX : ≈ 30:20, cap 42:30.
```

Estimation : Scaled 38.9' (≈ 38:51) · Inter 34.6' (≈ 34:37) · RX 30.3' (≈ 30:20) · RX+ 28.1' (≈ 28:06) · Elite 26.0' (≈ 26:02) · Pro 24.8' (≈ 24:46) · cap 42:30

_Squelette `chipper_stations_erg` · seed 1098 · tirage 4 · signature `functional|chipper_stations_erg|chipper|2|row:35cal,db_farmer_carry:150m,ski_erg:35cal,kb_clean_and_jerk:reps,run:1200m,burpee_over_the_bar:reps`_

#### 16. Tabata · Bike Erg / Wall Walk

**Entrées** : Express · Functional · 8' · intention cardio · format Stations

```
Tabata × 2 blocs · 8 × 20 s / 10 s, transition 30 s
Tabata 1 · Bike Erg (max reps)
Tabata 2 · Wall Walk (max reps)
Scaled : Inchworms · Inter : Half Wall Walks
Stimulus : RPE 8 — Score = somme des reps min de chaque bloc. Cible RX : reps min sur 8 × 20 s par bloc.
```

Estimation : Scaled 8.0' (reps min sur 8 × 20 s par bloc) · Inter 8.0' (reps min sur 8 × 20 s par bloc) · RX 8.0' (reps min sur 8 × 20 s par bloc) · RX+ 8.0' (reps min sur 8 × 20 s par bloc) · Elite 8.0' (reps min sur 8 × 20 s par bloc) · Pro 8.0' (reps min sur 8 × 20 s par bloc)

_Squelette `tabata_pair` · seed 1105 · tirage 2 · relâché : format · signature `functional|tabata_pair|tabata|8|bike_erg:cal,wall_walk:reps`_

#### 17. AMRAP 12 · Box Jump Over Step Down / Handstand Walk

**Entrées** : Express · Functional · 12' · intention cardio · format Intervalles

```
AMRAP 12
9 Box Jump Over Step Down (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Scaled : Box Step Over
15 m Handstand Walk
Scaled : Bear Crawl · Inter : Handstand Shoulder Taps
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 9 rounds.
```

Estimation : Scaled 12.0' (≈ 7 rounds) · Inter 12.0' (≈ 8 rounds) · RX 12.0' (≈ 9 rounds) · RX+ 12.0' (≈ 10 rounds) · Elite 12.0' (≈ 10 rounds) · Pro 12.0' (≈ 11 rounds)

_Squelette `couplet_amrap_short` · seed 1112 · tirage 1 · relâché : format · signature `functional|couplet_amrap_short|amrap|-|box_jump_over_step_down:reps,handstand_walk:15m`_

#### 18. Intervalles · SkiErg / Back Squat / Bar Facing Burpees

**Entrées** : Express · Functional · 15' · intention cardio · format Surprise

```
5 rounds · every 3'
10 cal SkiErg
6 Back Squat (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
6 Bar Facing Burpees
Stimulus : RPE 9 — Chaque intervalle est un sprint, repos complet. Cible RX : travail ≈ 1:47 par intervalle.
```

Estimation : Scaled 14.2' (travail ≈ 2:12 par intervalle) · Inter 14.0' (travail ≈ 1:59 par intervalle) · RX 13.8' (travail ≈ 1:47 par intervalle) · RX+ 13.7' (travail ≈ 1:40 par intervalle) · Elite 13.6' (travail ≈ 1:35 par intervalle) · Pro 13.5' (travail ≈ 1:30 par intervalle)

_Squelette `interval_work_rest` · seed 1119 · tirage 1 · signature `functional|interval_work_rest|interval|5|ski_erg:10cal,back_squat:reps,bar_facing_burpee:reps`_

#### 19. Tabata · Burpees / Push-ups

**Entrées** : Après la classe · Functional · 10' · intention cardio · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
Tabata × 2 blocs · 8 × 20 s / 10 s, transition 60 s
Tabata 1 · Burpees (max reps)
Tabata 2 · Push-ups (max reps)
Scaled : Knee Push-Ups
Stimulus : RPE 8 — Score = somme des reps min de chaque bloc. Cible RX : reps min sur 8 × 20 s par bloc.
```

Estimation : Scaled 10.0' (reps min sur 8 × 20 s par bloc) · Inter 10.0' (reps min sur 8 × 20 s par bloc) · RX 10.0' (reps min sur 8 × 20 s par bloc) · RX+ 10.0' (reps min sur 8 × 20 s par bloc) · Elite 10.0' (reps min sur 8 × 20 s par bloc) · Pro 10.0' (reps min sur 8 × 20 s par bloc)

_Squelette `tabata_pair` · seed 1126 · tirage 2 · signature `functional|tabata_pair|tabata|8|burpee:reps,push_up:reps`_

#### 20. AMRAP 15 · Bike Erg / KB Clean / Burpee Box Jump

**Entrées** : Après la classe · Functional · 15' · intention cardio · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 15
30 cal Bike Erg
14 KB Clean (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
11 Burpee Box Jump (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 4 rounds.
```

Estimation : Scaled 15.0' (≈ 3 rounds) · Inter 15.0' (≈ 3 rounds) · RX 15.0' (≈ 4 rounds) · RX+ 15.0' (≈ 4 rounds) · Elite 15.0' (≈ 4 rounds) · Pro 15.0' (≈ 5 rounds)

_Squelette `triplet_amrap_mid` · seed 1133 · tirage 1 · signature `functional|triplet_amrap_mid|amrap|-|bike_erg:30cal,kb_clean:reps,burpee_box_jump:reps`_

### Functional · force

#### 21. 21-15-9 · Clean & Jerk / GHD Sit-Ups

**Entrées** : Express · Functional · 8' · intention force · format Surprise

```
For time · 21-15-9 (cap 10:30)
Clean & Jerk (100/70 kg)
Scaled 60/40 · Inter 80/55 · RX+ 120/80 · Elite 140/95 · Pro 160/110 kg
GHD Sit-Ups
Scaled/Inter : Sit-ups
Stimulus : RPE 9 — Sprint, sets courts dès le round 1. Cible RX : ≈ 7:14, cap 10:30.
```

Estimation : Scaled 9.1' (≈ 9:08) · Inter 8.2' (≈ 8:11) · RX 7.2' (≈ 7:14) · RX+ 6.7' (≈ 6:43) · Elite 6.3' (≈ 6:17) · Pro 6.0' (≈ 5:58) · cap 10:30

_Squelette `couplet_for_time_21_15_9` · seed 1140 · tirage 1 · signature `functional|couplet_for_time_21_15_9|for_time|-|clean_and_jerk:reps,ghd_sit_up:reps`_

#### 22. EMOM 12 · Front Rack Lunges / GHD Sit-Ups / Row

**Entrées** : Express · Functional · 12' · intention force · format AMRAP

```
EMOM 12 · 3 stations en alternance
Min 1 · 9 Front Rack Lunges (70/50 kg)
Scaled 50/35 · Inter 60/43 · RX+ 80/55 · Elite 90/60 · Pro 100/70 kg
Min 2 · 9 GHD Sit-Ups
Scaled/Inter : Sit-ups
Min 3 · 9 cal Row
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 4 passages, travail 20-32 s / 60 s.
```

Estimation : Scaled 12.0' (4 passages, travail 26-42 s / 60 s) · Inter 12.0' (4 passages, travail 23-37 s / 60 s) · RX 12.0' (4 passages, travail 20-32 s / 60 s) · RX+ 12.0' (4 passages, travail 18-30 s / 60 s) · Elite 12.0' (4 passages, travail 17-28 s / 60 s) · Pro 12.0' (4 passages, travail 16-26 s / 60 s)

_Squelette `emom_alternating` · seed 1147 · tirage 1 · relâché : format · signature `functional|emom_alternating|emom|4|front_rack_lunge:reps,ghd_sit_up:reps,row:9cal`_

#### 23. 7 rounds · Power Clean / Run

**Entrées** : Express · Functional · 15' · intention force · format For time

```
7 rounds for time (cap 23')
3 Power Clean (100/70 kg)
Scaled 60/40 · Inter 80/55 · RX+ 120/80 · Elite 140/95 · Pro 160/110 kg
300 m Run
Stimulus : RPE 8 — Charge lourde, sets non cassés, le mono sert de récupération active. Cible RX : ≈ 16:18, cap 23'.
```

Estimation : Scaled 20.4' (≈ 20:25) · Inter 18.4' (≈ 18:22) · RX 16.3' (≈ 16:18) · RX+ 15.3' (≈ 15:16) · Elite 14.2' (≈ 14:15) · Pro 13.7' (≈ 13:43) · cap 23:00

_Squelette `heavy_couplet` · seed 1154 · tirage 2 · signature `functional|heavy_couplet|rounds_for_time|7|power_clean:reps,run:300m`_

#### 24. EMOM 20 · Deadlift / Handstand Push-ups / Row

**Entrées** : Express · Functional · 20' · intention force · format EMOM

```
EMOM 20 · 4 stations en alternance
Min 1 · 8 Deadlift (100/70 kg)
Scaled 60/40 · Inter 80/55 · RX+ 120/80 · Elite 140/95 · Pro 160/110 kg
Min 2 · 8 Handstand Push-ups
Scaled : Push-ups · Inter : Pike Push-Ups · Elite/Pro : Strict Handstand Push-Ups
Min 3 · 9 cal Row
Min 4 · 6 Burpees
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 5 passages, travail 20-32 s / 60 s.
```

Estimation : Scaled 20.0' (5 passages, travail 26-42 s / 60 s) · Inter 20.0' (5 passages, travail 23-37 s / 60 s) · RX 20.0' (5 passages, travail 20-32 s / 60 s) · RX+ 20.0' (5 passages, travail 18-30 s / 60 s) · Elite 20.0' (5 passages, travail 17-28 s / 60 s) · Pro 20.0' (5 passages, travail 16-26 s / 60 s)

_Squelette `emom_alternating` · seed 1161 · tirage 1 · signature `functional|emom_alternating|emom|5|deadlift:reps,handstand_push_up:reps,row:9cal,burpee:reps`_

#### 25. Chipper · Row / Farmer Carry / SkiErg

**Entrées** : Express · Functional · 30' · intention force · format Chipper

```
2 rounds for time · chipper (cap 39')
25 cal Row
90 m Farmer Carry (24/16 kg)
Scaled 16/12 · Inter 20/16 · RX+ 28/20 · Elite 32/24 · Pro 32/24 kg
17 cal SkiErg
14 DB Clean & Jerk (22.5/15 kg)
Scaled 15/10 · Inter 20/12.5 · RX+ 30/20 · Elite 35/22.5 · Pro 40/25 kg
1500 m Run
44 Hollow Rocks
Stimulus : RPE 7 — Stations enchaînées, ergs à 85 %. Cible RX : ≈ 27:30, cap 39'.
```

Estimation : Scaled 35.2' (≈ 35:11) · Inter 31.4' (≈ 31:22) · RX 27.5' (≈ 27:30) · RX+ 25.5' (≈ 25:31) · Elite 23.7' (≈ 23:39) · Pro 22.6' (≈ 22:33) · cap 39:00

_Squelette `chipper_stations_erg` · seed 1168 · tirage 2 · relâché : format, intention · signature `functional|chipper_stations_erg|chipper|2|row:25cal,db_farmer_carry:90m,ski_erg:17cal,db_clean_and_jerk:reps,run:1500m,hollow_rock:reps`_

#### 26. 30-20-10 · Hang Power Snatch / Handstand Push-ups

**Entrées** : Express · Functional · 8' · intention force · format Stations

```
For time · 30-20-10 (cap 10:30)
Hang Power Snatch (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
Handstand Push-ups
Scaled : Push-ups · Inter : Pike Push-Ups · Elite/Pro : Strict Handstand Push-Ups
Stimulus : RPE 9 — Sprint, sets courts dès le round 1. Cible RX : ≈ 7:29, cap 10:30.
```

Estimation : Scaled 9.5' (≈ 9:28) · Inter 8.5' (≈ 8:28) · RX 7.5' (≈ 7:29) · RX+ 7.0' (≈ 6:57) · Elite 6.5' (≈ 6:29) · Pro 6.2' (≈ 6:10) · cap 10:30

_Squelette `couplet_for_time_21_15_9` · seed 1175 · tirage 1 · relâché : format · signature `functional|couplet_for_time_21_15_9|for_time|-|hang_power_snatch:reps,handstand_push_up:reps`_

#### 27. 4 rounds · Thruster / Row / Toes-to-Bar

**Entrées** : Express · Functional · 12' · intention force · format Intervalles

```
4 rounds for time (cap 17')
13 Thruster (70/50 kg)
Scaled 50/35 · Inter 60/43 · RX+ 80/55 · Elite 90/60 · Pro 100/70 kg
12 cal Row
24 Toes-to-Bar
Scaled : Hanging Knee Raises
Stimulus : RPE 8 — Rounds réguliers, la barre ne se pose pas avant la fin du set. Cible RX : ≈ 12:01, cap 17'.
```

Estimation : Scaled 15.1' (≈ 15:05) · Inter 13.5' (≈ 13:33) · RX 12.0' (≈ 12:01) · RX+ 11.2' (≈ 11:12) · Elite 10.5' (≈ 10:30) · Pro 10.0' (≈ 9:59) · cap 17:00

_Squelette `triplet_rounds_for_time` · seed 1182 · tirage 1 · relâché : format · signature `functional|triplet_rounds_for_time|rounds_for_time|4|thruster:reps,row:12cal,toes_to_bar:reps`_

#### 28. Intervalles · SkiErg / Deadlift / Bar Facing Burpees

**Entrées** : Express · Functional · 15' · intention force · format Surprise

```
4 rounds · every 4'
15 cal SkiErg
7 Deadlift (140/95 kg)
Scaled 80/55 · Inter 100/70 · RX+ 160/110 · Elite 180/120 · Pro 200/140 kg
8 Bar Facing Burpees
Stimulus : RPE 9 — Chaque intervalle est un sprint, repos complet. Cible RX : travail ≈ 2:15 par intervalle.
```

Estimation : Scaled 14.8' (travail ≈ 2:48 par intervalle) · Inter 14.5' (travail ≈ 2:31 par intervalle) · RX 14.2' (travail ≈ 2:15 par intervalle) · RX+ 14.1' (travail ≈ 2:06 par intervalle) · Elite 14.0' (travail ≈ 1:58 par intervalle) · Pro 13.9' (travail ≈ 1:52 par intervalle)

_Squelette `interval_work_rest` · seed 1189 · tirage 1 · signature `functional|interval_work_rest|interval|4|ski_erg:15cal,deadlift:reps,bar_facing_burpee:reps`_

#### 29. AMRAP 10 · Echo Bike / KB Deadlift / Bar Facing Burpees

**Entrées** : Après la classe · Functional · 10' · intention force · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 10
14 cal Echo Bike
20 KB Deadlift (24/16 kg)
Scaled 16/12 · Inter 20/16 · RX+ 28/20 · Elite 32/24 · Pro 32/24 kg
13 Bar Facing Burpees
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 3 rounds.
```

Estimation : Scaled 10.0' (≈ 2 rounds) · Inter 10.0' (≈ 3 rounds) · RX 10.0' (≈ 3 rounds) · RX+ 10.0' (≈ 3 rounds) · Elite 10.0' (≈ 4 rounds) · Pro 10.0' (≈ 4 rounds)

_Squelette `triplet_amrap_mid` · seed 1196 · tirage 158 · relâché : format, intention, duration±5 · signature `functional|triplet_amrap_mid|amrap|-|echo_bike:14cal,kb_deadlift:reps,bar_facing_burpee:reps`_

#### 30. AMRAP 15 · Bike Erg / KB Clean / Bar Facing Burpees

**Entrées** : Après la classe · Functional · 15' · intention force · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 15
25 cal Bike Erg
15 KB Clean (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
14 Bar Facing Burpees
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 4 rounds.
```

Estimation : Scaled 15.0' (≈ 3 rounds) · Inter 15.0' (≈ 3 rounds) · RX 15.0' (≈ 4 rounds) · RX+ 15.0' (≈ 4 rounds) · Elite 15.0' (≈ 5 rounds) · Pro 15.0' (≈ 5 rounds)

_Squelette `triplet_amrap_mid` · seed 1203 · tirage 52 · relâché : format, intention · signature `functional|triplet_amrap_mid|amrap|-|bike_erg:25cal,kb_clean:reps,bar_facing_burpee:reps`_

### Functional · gym

#### 31. 30-20-10 · Sumo Deadlift High Pull / Strict Handstand Push-Ups

**Entrées** : Express · Functional · 8' · intention gym · format Surprise

```
For time · 30-20-10 (cap 11')
Sumo Deadlift High Pull (30/20 kg)
Scaled 20/15 · Inter 25/20 · RX+ 35/25 · Elite 40/30 · Pro 43/30 kg
Strict Handstand Push-Ups
Scaled : Push-ups · Inter : Pike Push-Ups · RX : Handstand Push-ups
Stimulus : RPE 9 — Sprint, sets courts dès le round 1. Cible RX : ≈ 7:42, cap 11'.
```

Estimation : Scaled 9.7' (≈ 9:45) · Inter 8.7' (≈ 8:43) · RX 7.7' (≈ 7:42) · RX+ 7.2' (≈ 7:09) · Elite 6.7' (≈ 6:41) · Pro 6.3' (≈ 6:20) · cap 11:00

_Squelette `couplet_for_time_21_15_9` · seed 1210 · tirage 4 · signature `functional|couplet_for_time_21_15_9|for_time|-|sumo_deadlift_high_pull:reps,strict_handstand_push_up:reps`_

#### 32. AMRAP 12 · Push Press / Toes-to-Bar

**Entrées** : Express · Functional · 12' · intention gym · format AMRAP

```
AMRAP 12
12 Push Press (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
15 Toes-to-Bar
Scaled : Hanging Knee Raises
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 9 rounds.
```

Estimation : Scaled 12.0' (≈ 7 rounds) · Inter 12.0' (≈ 8 rounds) · RX 12.0' (≈ 9 rounds) · RX+ 12.0' (≈ 10 rounds) · Elite 12.0' (≈ 10 rounds) · Pro 12.0' (≈ 11 rounds)

_Squelette `couplet_amrap_short` · seed 1217 · tirage 4 · signature `functional|couplet_amrap_short|amrap|-|push_press:reps,toes_to_bar:reps`_

#### 33. Ladder · Cluster / GHD Sit-Ups

**Entrées** : Express · Functional · 15' · intention gym · format For time

```
Ladder 3-6-9-12-15-18-21 · AMRAP 15
Monter les paliers dans le temps imparti, score = reps totales
Cluster (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
GHD Sit-Ups
Scaled/Inter : Sit-ups
Stimulus : RPE 8 — Les premiers paliers se font sans poser la barre. Cible RX : palier 21.
```

Estimation : Scaled 15.0' (palier 21) · Inter 15.0' (palier 21) · RX 15.0' (palier 21) · RX+ 15.0' (palier 21) · Elite 15.0' (palier 21) · Pro 15.0' (palier 21)

_Squelette `ladder_ascending` · seed 1224 · tirage 1 · signature `functional|ladder_ascending|ladder|-|cluster:reps,ghd_sit_up:reps`_

#### 34. EMOM 20 · Front Squat / Rope Climbs / SkiErg

**Entrées** : Express · Functional · 20' · intention gym · format EMOM

```
EMOM 20 · 4 stations en alternance
Min 1 · 6 Front Squat (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
Min 2 · 2 Rope Climbs
Scaled : Rope Pulls From Floor · Elite/Pro : Legless Rope Climbs
Min 3 · 8 cal SkiErg
Min 4 · 30 s Plank Hold
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 5 passages, travail 18-30 s / 60 s.
```

Estimation : Scaled 20.0' (5 passages, travail 23-40 s / 60 s) · Inter 20.0' (5 passages, travail 21-35 s / 60 s) · RX 20.0' (5 passages, travail 18-30 s / 60 s) · RX+ 20.0' (5 passages, travail 17-28 s / 60 s) · Elite 20.0' (5 passages, travail 15-26 s / 60 s) · Pro 20.0' (5 passages, travail 14-24 s / 60 s)

_Squelette `emom_alternating` · seed 1231 · tirage 1 · signature `functional|emom_alternating|emom|5|front_squat:reps,rope_climb:reps,ski_erg:8cal,plank_hold:s`_

#### 35. Chipper · Bike Erg / Farmer Carry / Row

**Entrées** : Express · Functional · 30' · intention gym · format Chipper

```
2 rounds for time · chipper (cap 38:30)
60 cal Bike Erg
200 m Farmer Carry (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
40 cal Row
15 DB Box Step Over (15/10 kg)
Scaled 10/7.5 · Inter 12.5/10 · RX+ 20/12.5 · Elite 22.5/15 · Pro 22.5/15 kg
300 m Shuttle Run
50 Hollow Rocks
Stimulus : RPE 7 — Stations enchaînées, ergs à 85 %. Cible RX : ≈ 27:10, cap 38:30.
```

Estimation : Scaled 34.8' (≈ 34:49) · Inter 31.0' (≈ 31:01) · RX 27.2' (≈ 27:10) · RX+ 25.1' (≈ 25:04) · Elite 23.3' (≈ 23:17) · Pro 22.1' (≈ 22:06) · cap 38:30

_Squelette `chipper_stations_erg` · seed 1238 · tirage 8 · relâché : format, intention · signature `functional|chipper_stations_erg|chipper|2|bike_erg:60cal,db_farmer_carry:200m,row:40cal,db_box_step_over:reps,shuttle_run:300m,hollow_rock:reps`_

#### 36. Tabata · Plank Hold / Chest-to-Bar

**Entrées** : Express · Functional · 8' · intention gym · format Stations

```
Tabata × 2 blocs · 8 × 20 s / 10 s, transition 30 s
Tabata 1 · Plank Hold (tenue 20 s)
Tabata 2 · Chest-to-Bar (max reps)
Scaled : Ring Rows · Inter : Pull-ups
Stimulus : RPE 8 — Score = somme des reps min de chaque bloc. Cible RX : reps min sur 8 × 20 s par bloc.
```

Estimation : Scaled 8.0' (reps min sur 8 × 20 s par bloc) · Inter 8.0' (reps min sur 8 × 20 s par bloc) · RX 8.0' (reps min sur 8 × 20 s par bloc) · RX+ 8.0' (reps min sur 8 × 20 s par bloc) · Elite 8.0' (reps min sur 8 × 20 s par bloc) · Pro 8.0' (reps min sur 8 × 20 s par bloc)

_Squelette `tabata_pair` · seed 1245 · tirage 1 · relâché : format · signature `functional|tabata_pair|tabata|8|plank_hold:s,chest_to_bar:reps`_

#### 37. AMRAP 12 · SkiErg / Plank Hold

**Entrées** : Express · Functional · 12' · intention gym · format Intervalles

```
AMRAP 12
15 cal SkiErg
55 s Plank Hold
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 5 rounds.
```

Estimation : Scaled 12.0' (≈ 4 rounds) · Inter 12.0' (≈ 4 rounds) · RX 12.0' (≈ 5 rounds) · RX+ 12.0' (≈ 6 rounds) · Elite 12.0' (≈ 6 rounds) · Pro 12.0' (≈ 6 rounds)

_Squelette `couplet_amrap_short` · seed 1252 · tirage 3 · relâché : format · signature `functional|couplet_amrap_short|amrap|-|ski_erg:15cal,plank_hold:s`_

#### 38. Ladder · Shoulder To Overhead / GHD Sit-Ups

**Entrées** : Express · Functional · 15' · intention gym · format Surprise

```
Ladder 3-6-9-12-15-18-21 · AMRAP 15
Monter les paliers dans le temps imparti, score = reps totales
Shoulder To Overhead (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
GHD Sit-Ups
Scaled/Inter : Sit-ups
Stimulus : RPE 8 — Les premiers paliers se font sans poser la barre. Cible RX : palier 21.
```

Estimation : Scaled 15.0' (palier 21) · Inter 15.0' (palier 21) · RX 15.0' (palier 21) · RX+ 15.0' (palier 21) · Elite 15.0' (palier 21) · Pro 15.0' (palier 21)

_Squelette `ladder_ascending` · seed 1259 · tirage 1 · signature `functional|ladder_ascending|ladder|-|shoulder_to_overhead:reps,ghd_sit_up:reps`_

#### 39. Tabata · Plank Hold / Push-ups

**Entrées** : Après la classe · Functional · 10' · intention gym · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
Tabata × 2 blocs · 8 × 20 s / 10 s, transition 60 s
Tabata 1 · Plank Hold (tenue 20 s)
Tabata 2 · Push-ups (max reps)
Scaled : Knee Push-Ups
Stimulus : RPE 8 — Score = somme des reps min de chaque bloc. Cible RX : reps min sur 8 × 20 s par bloc.
```

Estimation : Scaled 10.0' (reps min sur 8 × 20 s par bloc) · Inter 10.0' (reps min sur 8 × 20 s par bloc) · RX 10.0' (reps min sur 8 × 20 s par bloc) · RX+ 10.0' (reps min sur 8 × 20 s par bloc) · Elite 10.0' (reps min sur 8 × 20 s par bloc) · Pro 10.0' (reps min sur 8 × 20 s par bloc)

_Squelette `tabata_pair` · seed 1266 · tirage 4 · signature `functional|tabata_pair|tabata|8|plank_hold:s,push_up:reps`_

#### 40. AMRAP 15 · Echo Bike / KB Swing / Sit-ups

**Entrées** : Après la classe · Functional · 15' · intention gym · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 15
13 cal Echo Bike
13 KB Swing (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
23 Sit-ups
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 6 rounds.
```

Estimation : Scaled 15.0' (≈ 5 rounds) · Inter 15.0' (≈ 6 rounds) · RX 15.0' (≈ 6 rounds) · RX+ 15.0' (≈ 7 rounds) · Elite 15.0' (≈ 7 rounds) · Pro 15.0' (≈ 8 rounds)

_Squelette `triplet_amrap_mid` · seed 1273 · tirage 140 · relâché : format, intention · signature `functional|triplet_amrap_mid|amrap|-|echo_bike:13cal,kb_swing_american:reps,sit_up:reps`_

## Hybrid

### Hybrid · interval

#### 41. AMRAP 15 · Run / Sled Pull / Wall Balls

**Entrées** : Express · Hybrid · 15' · intention interval · format Surprise · sans gilet

```
AMRAP 15
400 m Run
40 m Sled Pull (100/75 kg)
Pro 125/100 kg
13 Wall Balls (9/6 kg)
Pro 12/9 kg
14 cal Bike Erg
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```

Estimation : Women 15.0' (≈ 3 rounds) · Men 15.0' (≈ 3 rounds) · Women Pro 15.0' (≈ 3 rounds) · Men Pro 15.0' (≈ 3 rounds)

_Squelette `amrap_distances` · seed 1280 · tirage 1 · signature `hybrid|amrap_distances|amrap|-|run:400m,sled_pull:40m,wall_ball:reps,bike_erg:14cal`_

#### 42. AMRAP 20 · Run / Sled Pull / Sandbag Lunges

**Entrées** : Express · Hybrid · 20' · intention interval · format AMRAP · gilet optionnel

```
AMRAP 20
350 m Run
40 m Sled Pull (100/75 kg)
Pro 125/100 kg
25 m Sandbag Lunges (40/30 kg)
Pro 50/35 kg
13 cal Row
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 4 rounds.
```

Estimation : Women 20.0' (≈ 4 rounds) · Men 20.0' (≈ 4 rounds) · Women Pro 20.0' (≈ 5 rounds) · Men Pro 20.0' (≈ 5 rounds)

_Squelette `amrap_distances` · seed 1287 · tirage 1 · signature `hybrid|amrap_distances|amrap|-|run:350m,sled_pull:40m,sandbag_lunge:25m,row:13cal`_

#### 43. 4 rounds · Farmer Carry / Run

**Entrées** : Express · Hybrid · 30' · intention interval · format For time · gilet obligatoire

```
4 rounds for time (cap 41')
180 m Farmer Carry (24/16 kg)
Pro 28/20 kg
950 m Run
Gilet lesté 9/6 kg
Stimulus : RPE 8 — Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km. Cible Men : ≈ 32:37, cap 41'.
```

Estimation : Women 32.6' (≈ 32:37) · Men 32.6' (≈ 32:37) · Women Pro 30.2' (≈ 30:12) · Men Pro 30.2' (≈ 30:12) · cap 41:00

_Squelette `compromised_run` · seed 1294 · tirage 2 · signature `hybrid|compromised_run|rounds_for_time|4|db_farmer_carry:180m,run:950m`_

#### 44. 6 rounds · Run / Farmer Carry

**Entrées** : Express · Hybrid · 45' · intention interval · format EMOM · sans gilet

```
6 rounds for time (cap 51')
700 m Run
R1 · 140 m Farmer Carry (24/16 kg)
Pro 28/20 kg
R2 · 100 m Sled Push (125/100 kg)
Pro 150/125 kg
R3 · 50 Wall Balls (9/6 kg)
Pro 12/9 kg
R4 · 950 m Row
R5 · 100 m Sandbag Lunges (40/30 kg)
Pro 50/35 kg
R6 · 50 m Burpee Broad Jumps
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 40:43, cap 51'.
```

Estimation : Women 40.7' (≈ 40:43) · Men 40.7' (≈ 40:43) · Women Pro 37.7' (≈ 37:44) · Men Pro 37.7' (≈ 37:44) · cap 51:00

_Squelette `run_into_station` · seed 1301 · tirage 5 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|6|run:700m,db_farmer_carry:140m,sled_push:100m,wall_ball:reps,row:950m,sandbag_lunge:100m,burpee_broad_jump:50m`_

#### 45. AMRAP 15 · Run / Sled Pull / Sandbag Lunges

**Entrées** : Express · Hybrid · 15' · intention interval · format Chipper · gilet optionnel

```
AMRAP 15
400 m Run
40 m Sled Pull (100/75 kg)
Pro 125/100 kg
40 m Sandbag Lunges (40/30 kg)
Pro 50/35 kg
16 cal SkiErg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```

Estimation : Women 15.0' (≈ 3 rounds) · Men 15.0' (≈ 3 rounds) · Women Pro 15.0' (≈ 3 rounds) · Men Pro 15.0' (≈ 3 rounds)

_Squelette `amrap_distances` · seed 1308 · tirage 1 · relâché : format · signature `hybrid|amrap_distances|amrap|-|run:400m,sled_pull:40m,sandbag_lunge:40m,ski_erg:16cal`_

#### 46. Stations · Sandbag Lunges / KB Swings Russian / SkiErg

**Entrées** : Express · Hybrid · 20' · intention interval · format Stations · gilet obligatoire

```
2 rounds × 5 stations · 90 s on / 30 s off
Station 1 · Sandbag Lunges (40/30 kg) (max m, cible 100 m)
Pro 50/35 kg
Station 2 · KB Swings Russian (24/16 kg) (max reps, cible 50)
Pro 28/20 kg
Station 3 · SkiErg (max cal, cible 25 cal)
Station 4 · Burpee Broad Jumps (max m, cible 60 m)
Station 5 · Wall Balls (9/6 kg) (max reps, cible 36)
Pro 12/9 kg
Gilet lesté 9/6 kg
Stimulus : RPE 8.5 — Alternance jambes / épaules / mono, 90 s de travail max effort. Cible Men : 2 tours × 5 stations, 90 s on / 30 s off.
```

Estimation : Women 20.0' (2 tours × 5 stations, 90 s on / 30 s off) · Men 20.0' (2 tours × 5 stations, 90 s on / 30 s off) · Women Pro 20.0' (2 tours × 5 stations, 90 s on / 30 s off) · Men Pro 20.0' (2 tours × 5 stations, 90 s on / 30 s off)

_Squelette `stations_interval` · seed 1315 · tirage 1 · signature `hybrid|stations_interval|stations|2|sandbag_lunge:100m,kb_swing_russian:reps,ski_erg:25cal,burpee_broad_jump:60m,wall_ball:reps`_

#### 47. Stations · SkiErg / Burpee Broad Jumps / Row

**Entrées** : Express · Hybrid · 30' · intention interval · format Intervalles · sans gilet

```
3 rounds × 5 stations · 90 s on / 30 s off
Station 1 · SkiErg (max cal, cible 25 cal)
Station 2 · Burpee Broad Jumps (max m, cible 60 m)
Station 3 · Row (max cal, cible 25 cal)
Station 4 · Sled Push (125/100 kg) (max m, cible 80 m)
Pro 150/125 kg
Station 5 · Farmer Carry (24/16 kg) (max m, cible 110 m)
Pro 28/20 kg
Stimulus : RPE 8.5 — Alternance jambes / épaules / mono, 90 s de travail max effort. Cible Men : 3 tours × 5 stations, 90 s on / 30 s off.
```

Estimation : Women 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Men 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Women Pro 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Men Pro 30.0' (3 tours × 5 stations, 90 s on / 30 s off)

_Squelette `stations_interval` · seed 1322 · tirage 2 · relâché : format · signature `hybrid|stations_interval|stations|3|ski_erg:25cal,burpee_broad_jump:60m,row:25cal,sled_push:80m,db_farmer_carry:110m`_

#### 48. 6 rounds · Run / Burpee Broad Jumps

**Entrées** : Express · Hybrid · 45' · intention interval · format Surprise · gilet optionnel

```
6 rounds for time (cap 51')
750 m Run
R1 · 35 m Burpee Broad Jumps
R2 · 100 m Sled Pull (100/75 kg)
Pro 125/100 kg
R3 · 1000 m Row
R4 · 70 m Sled Push (125/100 kg)
Pro 150/125 kg
R5 · 100 m Sandbag Lunges (40/30 kg)
Pro 50/35 kg
R6 · 28 Wall Balls (9/6 kg)
Pro 12/9 kg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 40:39, cap 51'.
```

Estimation : Women 40.6' (≈ 40:39) · Men 40.6' (≈ 40:39) · Women Pro 37.7' (≈ 37:42) · Men Pro 37.7' (≈ 37:42) · cap 51:00

_Squelette `run_into_station` · seed 1329 · tirage 7 · signature `hybrid|run_into_station|rounds_for_time|6|run:750m,burpee_broad_jump:35m,sled_pull:100m,row:1000m,sled_push:70m,sandbag_lunge:100m,wall_ball:reps`_

#### 49. 3 rounds · Farmer Carry / Sit-ups / Row

**Entrées** : Après la classe · Hybrid · 10' · intention interval · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
3 rounds for time (cap 12')
100 m Farmer Carry (20/16 kg)
Pro 24/16 kg
15 Sit-ups
10 cal Row
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 9:18, cap 12'.
```

Estimation : Women 9.3' (≈ 9:18) · Men 9.3' (≈ 9:18) · Women Pro 8.6' (≈ 8:39) · Men Pro 8.6' (≈ 8:39) · cap 12:00

_Squelette `core_carry_finisher` · seed 1336 · tirage 51 · relâché : format, intention · signature `hybrid|core_carry_finisher|rounds_for_time|3|db_farmer_carry:100m,sit_up:reps,row:10cal`_

#### 50. 3 rounds · Farmer Carry / Run

**Entrées** : Après la classe · Hybrid · 15' · intention interval · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
3 rounds for time (cap 17')
80 m Farmer Carry (20/16 kg)
Pro 24/16 kg
600 m Run
Stimulus : RPE 8 — Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km. Cible Men : ≈ 13:32, cap 17'.
```

Estimation : Women 13.5' (≈ 13:32) · Men 13.5' (≈ 13:32) · Women Pro 12.6' (≈ 12:34) · Men Pro 12.6' (≈ 12:34) · cap 17:00

_Squelette `compromised_run` · seed 1343 · tirage 51 · relâché : format, duration±5 · signature `hybrid|compromised_run|rounds_for_time|3|db_farmer_carry:80m,run:600m`_

### Hybrid · engine

#### 51. AMRAP 15 · Run / Sled Pull / Wall Balls

**Entrées** : Express · Hybrid · 15' · intention engine · format Surprise · sans gilet

```
AMRAP 15
400 m Run
30 m Sled Pull (75/50 kg)
Pro 100/75 kg
25 Wall Balls (6/4 kg)
Pro 9/6 kg
10 cal SkiErg
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```

Estimation : Women 15.0' (≈ 3 rounds) · Men 15.0' (≈ 3 rounds) · Women Pro 15.0' (≈ 3 rounds) · Men Pro 15.0' (≈ 3 rounds)

_Squelette `amrap_distances` · seed 1350 · tirage 1 · signature `hybrid|amrap_distances|amrap|-|run:400m,sled_pull:30m,wall_ball:reps,ski_erg:10cal`_

#### 52. AMRAP 20 · Run / Sled Push / Sandbag Lunges

**Entrées** : Express · Hybrid · 20' · intention engine · format AMRAP · gilet optionnel

```
AMRAP 20
350 m Run
50 m Sled Push (100/75 kg)
Pro 125/100 kg
25 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
15 cal SkiErg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 4 rounds.
```

Estimation : Women 20.0' (≈ 4 rounds) · Men 20.0' (≈ 4 rounds) · Women Pro 20.0' (≈ 4 rounds) · Men Pro 20.0' (≈ 4 rounds)

_Squelette `amrap_distances` · seed 1357 · tirage 1 · signature `hybrid|amrap_distances|amrap|-|run:350m,sled_push:50m,sandbag_lunge:25m,ski_erg:15cal`_

#### 53. 5 rounds · Run / Wall Balls

**Entrées** : Express · Hybrid · 30' · intention engine · format For time · gilet obligatoire

```
5 rounds for time (cap 34:30)
500 m Run
R1 · 33 Wall Balls (6/4 kg)
Pro 9/6 kg
R2 · 100 m Sled Pull (75/50 kg)
Pro 100/75 kg
R3 · 850 m SkiErg
R4 · 50 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R5 · 800 m Row
Gilet lesté 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 27:13, cap 34:30.
```

Estimation : Women 27.2' (≈ 27:13) · Men 27.2' (≈ 27:13) · Women Pro 25.3' (≈ 25:15) · Men Pro 25.3' (≈ 25:15) · cap 34:30

_Squelette `run_into_station` · seed 1364 · tirage 2 · signature `hybrid|run_into_station|rounds_for_time|5|run:500m,wall_ball:reps,sled_pull:100m,ski_erg:850m,sandbag_lunge:50m,row:800m`_

#### 54. 6 rounds · Run / Farmer Carry

**Entrées** : Express · Hybrid · 45' · intention engine · format EMOM · sans gilet

```
6 rounds for time (cap 51')
650 m Run
R1 · 190 m Farmer Carry (20/16 kg)
Pro 24/16 kg
R2 · 70 m Burpee Broad Jumps
R3 · 100 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R4 · 1000 m Row
R5 · 100 m Sled Push (100/75 kg)
Pro 125/100 kg
R6 · 50 Wall Balls (6/4 kg)
Pro 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 40:47, cap 51'.
```

Estimation : Women 40.8' (≈ 40:47) · Men 40.8' (≈ 40:47) · Women Pro 37.8' (≈ 37:48) · Men Pro 37.8' (≈ 37:48) · cap 51:00

_Squelette `run_into_station` · seed 1371 · tirage 4 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|6|run:650m,db_farmer_carry:190m,burpee_broad_jump:70m,sandbag_lunge:100m,row:1000m,sled_push:100m,wall_ball:reps`_

#### 55. AMRAP 15 · Run / Sled Pull / Sandbag Lunges

**Entrées** : Express · Hybrid · 15' · intention engine · format Chipper · gilet optionnel

```
AMRAP 15
200 m Run
40 m Sled Pull (75/50 kg)
Pro 100/75 kg
45 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
13 cal SkiErg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```

Estimation : Women 15.0' (≈ 3 rounds) · Men 15.0' (≈ 3 rounds) · Women Pro 15.0' (≈ 4 rounds) · Men Pro 15.0' (≈ 4 rounds)

_Squelette `amrap_distances` · seed 1378 · tirage 1 · relâché : format · signature `hybrid|amrap_distances|amrap|-|run:200m,sled_pull:40m,sandbag_lunge:45m,ski_erg:13cal`_

#### 56. 4 rounds · Run / SkiErg

**Entrées** : Express · Hybrid · 20' · intention engine · format Stations · gilet obligatoire

```
4 rounds for time (cap 23:30)
450 m Run
R1 · 600 m SkiErg
R2 · 750 m Row
R3 · 35 m Burpee Broad Jumps
R4 · 90 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
Gilet lesté 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 18:27, cap 23:30.
```

Estimation : Women 18.5' (≈ 18:27) · Men 18.5' (≈ 18:27) · Women Pro 17.1' (≈ 17:08) · Men Pro 17.1' (≈ 17:08) · cap 23:30

_Squelette `run_into_station` · seed 1385 · tirage 1 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|4|run:450m,ski_erg:600m,row:750m,burpee_broad_jump:35m,sandbag_lunge:90m`_

#### 57. 6 rounds · Run / Wall Balls

**Entrées** : Express · Hybrid · 30' · intention engine · format Intervalles · sans gilet

```
6 rounds for time (cap 41')
550 m Run
R1 · 32 Wall Balls (6/4 kg)
Pro 9/6 kg
R2 · 90 m Sled Push (100/75 kg)
Pro 125/100 kg
R3 · 600 m SkiErg
R4 · 50 m Burpee Broad Jumps
R5 · 550 m Row
R6 · 80 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 32:34, cap 41'.
```

Estimation : Women 32.6' (≈ 32:34) · Men 32.6' (≈ 32:34) · Women Pro 30.2' (≈ 30:13) · Men Pro 30.2' (≈ 30:13) · cap 41:00

_Squelette `run_into_station` · seed 1392 · tirage 1 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|6|run:550m,wall_ball:reps,sled_push:90m,ski_erg:600m,burpee_broad_jump:50m,row:550m,sandbag_lunge:80m`_

#### 58. 6 rounds · Run / SkiErg

**Entrées** : Express · Hybrid · 45' · intention engine · format Surprise · gilet optionnel

```
6 rounds for time (cap 51')
750 m Run
R1 · 800 m SkiErg
R2 · 450 m Row
R3 · 60 m Burpee Broad Jumps
R4 · 100 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R5 · 170 m Farmer Carry (20/16 kg)
Pro 24/16 kg
R6 · 21 Wall Balls (6/4 kg)
Pro 9/6 kg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 40:40, cap 51'.
```

Estimation : Women 40.7' (≈ 40:40) · Men 40.7' (≈ 40:40) · Women Pro 37.7' (≈ 37:43) · Men Pro 37.7' (≈ 37:43) · cap 51:00

_Squelette `run_into_station` · seed 1399 · tirage 9 · signature `hybrid|run_into_station|rounds_for_time|6|run:750m,ski_erg:800m,row:450m,burpee_broad_jump:60m,sandbag_lunge:100m,db_farmer_carry:170m,wall_ball:reps`_

#### 59. Intervalles · Run

**Entrées** : Après la classe · Hybrid · 10' · intention engine · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
4 rounds · repos 1' entre les répétitions
400 m Run
Stimulus : RPE 8.5 — Allure 5 km ou plus vite, régularité entre répétitions. Cible Men : ≈ 1:56 par répétition.
```

Estimation : Women 10.7' (≈ 1:56 par répétition) · Men 10.7' (≈ 1:56 par répétition) · Women Pro 10.2' (≈ 1:48 par répétition) · Men Pro 10.2' (≈ 1:48 par répétition)

_Squelette `run_intervals:A` · seed 1406 · tirage 51 · relâché : format, intention · signature `hybrid|run_intervals:A|interval|4|run:400m`_

#### 60. 500-750-1000-1250-1000-750-500 · Bike Erg / Burpee Broad Jumps

**Entrées** : Après la classe · Hybrid · 15' · intention engine · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
For time · 500-750-1000-1250-1000-750-500 m (cap 20:30)
Bike Erg
10 m Burpee Broad Jumps (entre chaque palier)
Stimulus : RPE 7 — Pyramide à allure régulière, la station courte relance sans casser le rythme. Cible Men : ≈ 16:04, cap 20:30.
```

Estimation : Women 16.1' (≈ 16:04) · Men 16.1' (≈ 16:04) · Women Pro 15.0' (≈ 14:60) · Men Pro 15.0' (≈ 14:60) · cap 20:30

_Squelette `erg_pyramid` · seed 1413 · tirage 65 · relâché : format, duration±5 · signature `hybrid|erg_pyramid|for_time|-|bike_erg:5750m,burpee_broad_jump:10m`_

### Hybrid · aerobic

#### 61. Continu · SkiErg / Run / Bike Erg

**Entrées** : Express · Hybrid · 15' · intention aerobic · format Surprise · sans gilet

```
En continu 15' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
200 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 4154 m.
```

Estimation : Women 15.0' (≈ 4154 m) · Men 15.0' (≈ 4154 m) · Women Pro 15.0' (≈ 4484 m) · Men Pro 15.0' (≈ 4484 m)

_Squelette `engine_continuous` · seed 1420 · tirage 3 · relâché : format, duration±5 · signature `hybrid|engine_continuous|continuous|-|ski_erg:500m,run:400m,bike_erg:1000m,sandbag_carry:200m`_

#### 62. 500-750-1000-750-500 · Row / Farmer Carry

**Entrées** : Express · Hybrid · 20' · intention aerobic · format AMRAP · gilet optionnel

```
For time · 500-750-1000-750-500 m (cap 25')
Row
50 m Farmer Carry (20/16 kg) (entre chaque palier)
Pro 24/16 kg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 7 — Pyramide à allure régulière, la station courte relance sans casser le rythme. Cible Men : ≈ 19:51, cap 25'.
```

Estimation : Women 19.9' (≈ 19:51) · Men 19.9' (≈ 19:51) · Women Pro 18.4' (≈ 18:23) · Men Pro 18.4' (≈ 18:23) · cap 25:00

_Squelette `erg_pyramid` · seed 1427 · tirage 1 · relâché : format · signature `hybrid|erg_pyramid|for_time|-|row:3500m,db_farmer_carry:50m`_

#### 63. 500-750-1000-1250-1000-750-500 · Row / Sandbag Lunges

**Entrées** : Express · Hybrid · 30' · intention aerobic · format For time · gilet obligatoire

```
For time · 500-750-1000-1250-1000-750-500 m (cap 38')
Row
20 m Sandbag Lunges (30/20 kg) (entre chaque palier)
Pro 40/30 kg
Gilet lesté 9/6 kg
Stimulus : RPE 7 — Pyramide à allure régulière, la station courte relance sans casser le rythme. Cible Men : ≈ 30:04, cap 38'.
```

Estimation : Women 30.1' (≈ 30:04) · Men 30.1' (≈ 30:04) · Women Pro 27.9' (≈ 27:52) · Men Pro 27.9' (≈ 27:52) · cap 38:00

_Squelette `erg_pyramid` · seed 1434 · tirage 2 · signature `hybrid|erg_pyramid|for_time|-|row:5750m,sandbag_lunge:20m`_

#### 64. Continu · SkiErg / Run / Bike Erg

**Entrées** : Express · Hybrid · 45' · intention aerobic · format EMOM · sans gilet

```
En continu 45' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
200 m Farmer Carry (20/16 kg)
Pro 24/16 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 11228 m.
```

Estimation : Women 45.0' (≈ 11228 m) · Men 45.0' (≈ 11228 m) · Women Pro 45.0' (≈ 12128 m) · Men Pro 45.0' (≈ 12128 m)

_Squelette `engine_continuous` · seed 1441 · tirage 1 · relâché : format · signature `hybrid|engine_continuous|continuous|-|ski_erg:500m,run:400m,bike_erg:1000m,db_farmer_carry:200m`_

#### 65. Continu · Row / Run / Bike Erg

**Entrées** : Express · Hybrid · 15' · intention aerobic · format Chipper · gilet optionnel

```
En continu 15' · rotation sans repos, score = distance totale
500 m Row
400 m Run
1000 m Bike Erg
200 m Farmer Carry (20/16 kg)
Pro 24/16 kg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 3780 m.
```

Estimation : Women 15.0' (≈ 3780 m) · Men 15.0' (≈ 3780 m) · Women Pro 15.0' (≈ 4082 m) · Men Pro 15.0' (≈ 4082 m)

_Squelette `engine_continuous` · seed 1448 · tirage 1 · relâché : format, duration±5 · signature `hybrid|engine_continuous|continuous|-|row:500m,run:400m,bike_erg:1000m,db_farmer_carry:200m`_

#### 66. Continu · Row / Run / Bike Erg

**Entrées** : Express · Hybrid · 20' · intention aerobic · format Stations · gilet obligatoire

```
En continu 20' · rotation sans repos, score = distance totale
500 m Row
400 m Run
1000 m Bike Erg
200 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
Gilet lesté 9/6 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 5600 m.
```

Estimation : Women 20.0' (≈ 5600 m) · Men 20.0' (≈ 5600 m) · Women Pro 20.0' (≈ 6043 m) · Men Pro 20.0' (≈ 6043 m)

_Squelette `engine_continuous` · seed 1455 · tirage 1 · signature `hybrid|engine_continuous|continuous|-|row:500m,run:400m,bike_erg:1000m,sandbag_carry:200m`_

#### 67. 500-750-1000-1250-1000-750-500 · Row / Lunges

**Entrées** : Express · Hybrid · 30' · intention aerobic · format Intervalles · sans gilet

```
For time · 500-750-1000-1250-1000-750-500 m (cap 40:30)
Row
20 Lunges (entre chaque palier)
Stimulus : RPE 7 — Pyramide à allure régulière, la station courte relance sans casser le rythme. Cible Men : ≈ 32:12, cap 40:30.
```

Estimation : Women 32.2' (≈ 32:12) · Men 32.2' (≈ 32:12) · Women Pro 29.8' (≈ 29:49) · Men Pro 29.8' (≈ 29:49) · cap 40:30

_Squelette `erg_pyramid` · seed 1462 · tirage 2 · relâché : format · signature `hybrid|erg_pyramid|for_time|-|row:5750m,walking_lunge:reps`_

#### 68. Continu · SkiErg / Run / Bike Erg

**Entrées** : Express · Hybrid · 45' · intention aerobic · format Surprise · gilet optionnel

```
En continu 45' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 15688 m.
```

Estimation : Women 45.0' (≈ 15688 m) · Men 45.0' (≈ 15688 m) · Women Pro 45.0' (≈ 16903 m) · Men Pro 45.0' (≈ 16903 m)

_Squelette `engine_continuous` · seed 1473 · tirage 1 · signature `hybrid|engine_continuous|continuous|-|ski_erg:500m,run:400m,bike_erg:1000m`_

#### 69. Intervalles · Shuttle Run

**Entrées** : Après la classe · Hybrid · 10' · intention aerobic · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
6 rounds · repos 0:45 entre les répétitions
200 m Shuttle Run
Stimulus : RPE 8.5 — Allure 5 km ou plus vite, régularité entre répétitions. Cible Men : ≈ 1:12 par répétition.
```

Estimation : Women 10.9' (≈ 1:12 par répétition) · Men 10.9' (≈ 1:12 par répétition) · Women Pro 10.3' (≈ 1:06 par répétition) · Men Pro 10.3' (≈ 1:06 par répétition)

_Squelette `run_intervals:C` · seed 1476 · tirage 1 · relâché : format, intention · signature `hybrid|run_intervals:C|interval|6|shuttle_run:200m`_

#### 70. 250-500-750-500-250 · Row / Farmer Carry

**Entrées** : Après la classe · Hybrid · 15' · intention aerobic · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
For time · 250-500-750-500-250 m (cap 19')
Row
50 m Farmer Carry (20/16 kg) (entre chaque palier)
Pro 24/16 kg
Stimulus : RPE 7 — Pyramide à allure régulière, la station courte relance sans casser le rythme. Cible Men : ≈ 14:51, cap 19'.
```

Estimation : Women 14.8' (≈ 14:51) · Men 14.8' (≈ 14:51) · Women Pro 13.8' (≈ 13:47) · Men Pro 13.8' (≈ 13:47) · cap 19:00

_Squelette `erg_pyramid` · seed 1484 · tirage 1 · relâché : format, duration±5 · signature `hybrid|erg_pyramid|for_time|-|row:2250m,db_farmer_carry:50m`_

### Hybrid · run

#### 71. Intervalles · Run

**Entrées** : Express · Hybrid · 15' · intention run · format Surprise · sans gilet

```
5 rounds · repos 1' entre les répétitions
400 m Run
Stimulus : RPE 8.5 — Allure 5 km ou plus vite, régularité entre répétitions. Cible Men : ≈ 1:56 par répétition.
```

Estimation : Women 13.7' (≈ 1:56 par répétition) · Men 13.7' (≈ 1:56 par répétition) · Women Pro 13.0' (≈ 1:48 par répétition) · Men Pro 13.0' (≈ 1:48 par répétition)

_Squelette `run_intervals:A` · seed 1490 · tirage 1 · signature `hybrid|run_intervals:A|interval|5|run:400m`_

#### 72. Intervalles · Run

**Entrées** : Express · Hybrid · 20' · intention run · format AMRAP · gilet optionnel

```
7 rounds · repos 1' entre les répétitions
400 m Run
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure 5 km ou plus vite, régularité entre répétitions. Cible Men : ≈ 1:56 par répétition.
```

Estimation : Women 19.5' (≈ 1:56 par répétition) · Men 19.5' (≈ 1:56 par répétition) · Women Pro 18.6' (≈ 1:48 par répétition) · Men Pro 18.6' (≈ 1:48 par répétition)

_Squelette `run_intervals:A` · seed 1497 · tirage 1 · relâché : format · signature `hybrid|run_intervals:A|interval|7|run:400m`_

#### 73. 4 rounds · Sled Push / Run

**Entrées** : Express · Hybrid · 30' · intention run · format For time · gilet obligatoire

```
4 rounds for time (cap 36:30)
100 m Sled Push (125/100 kg)
Pro 150/125 kg
900 m Run
Gilet lesté 9/6 kg
Stimulus : RPE 8 — Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km. Cible Men : ≈ 29:03, cap 36:30.
```

Estimation : Women 29.1' (≈ 29:03) · Men 29.1' (≈ 29:03) · Women Pro 26.9' (≈ 26:55) · Men Pro 26.9' (≈ 26:55) · cap 36:30

_Squelette `compromised_run` · seed 1504 · tirage 1 · signature `hybrid|compromised_run|rounds_for_time|4|sled_push:100m,run:900m`_

#### 74. 6 rounds · Run / Wall Balls

**Entrées** : Express · Hybrid · 45' · intention run · format EMOM · sans gilet

```
6 rounds for time (cap 51:30)
650 m Run
R1 · 43 Wall Balls (6/4 kg)
Pro 9/6 kg
R2 · 100 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R3 · 90 m Sled Push (100/75 kg)
Pro 125/100 kg
R4 · 800 m Row
R5 · 950 m SkiErg
R6 · 190 m Farmer Carry (20/16 kg)
Pro 24/16 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 41:09, cap 51:30.
```

Estimation : Women 41.2' (≈ 41:09) · Men 41.2' (≈ 41:09) · Women Pro 38.1' (≈ 38:08) · Men Pro 38.1' (≈ 38:08) · cap 51:30

_Squelette `run_into_station` · seed 1511 · tirage 3 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|6|run:650m,wall_ball:reps,sandbag_lunge:100m,sled_push:90m,row:800m,ski_erg:950m,db_farmer_carry:190m`_

#### 75. Intervalles · Run

**Entrées** : Express · Hybrid · 15' · intention run · format Chipper · gilet optionnel

```
3 rounds · repos 1:30 entre les répétitions
800 m Run
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure 5 km ou plus vite, régularité entre répétitions. Cible Men : ≈ 3:44 par répétition.
```

Estimation : Women 14.2' (≈ 3:44 par répétition) · Men 14.2' (≈ 3:44 par répétition) · Women Pro 13.4' (≈ 3:28 par répétition) · Men Pro 13.4' (≈ 3:28 par répétition)

_Squelette `run_intervals:B` · seed 1518 · tirage 1 · relâché : format · signature `hybrid|run_intervals:B|interval|3|run:800m`_

#### 76. Intervalles · Run

**Entrées** : Express · Hybrid · 20' · intention run · format Stations · gilet obligatoire

```
4 rounds · repos 1:30 entre les répétitions
800 m Run
Gilet lesté 9/6 kg
Stimulus : RPE 8.5 — Allure 5 km ou plus vite, régularité entre répétitions. Cible Men : ≈ 3:44 par répétition.
```

Estimation : Women 19.4' (≈ 3:44 par répétition) · Men 19.4' (≈ 3:44 par répétition) · Women Pro 18.4' (≈ 3:28 par répétition) · Men Pro 18.4' (≈ 3:28 par répétition)

_Squelette `run_intervals:B` · seed 1525 · tirage 1 · relâché : format · signature `hybrid|run_intervals:B|interval|4|run:800m`_

#### 77. 4 rounds · Farmer Carry / Run

**Entrées** : Express · Hybrid · 30' · intention run · format Intervalles · sans gilet

```
4 rounds for time (cap 36')
180 m Farmer Carry (24/16 kg)
Pro 28/20 kg
750 m Run
Stimulus : RPE 8 — Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km. Cible Men : ≈ 28:29, cap 36'.
```

Estimation : Women 28.5' (≈ 28:29) · Men 28.5' (≈ 28:29) · Women Pro 26.4' (≈ 26:22) · Men Pro 26.4' (≈ 26:22) · cap 36:00

_Squelette `compromised_run` · seed 1532 · tirage 1 · relâché : format · signature `hybrid|compromised_run|rounds_for_time|4|db_farmer_carry:180m,run:750m`_

#### 78. 6 rounds · Run / SkiErg

**Entrées** : Express · Hybrid · 45' · intention run · format Surprise · gilet optionnel

```
6 rounds for time (cap 52')
650 m Run
R1 · 1000 m SkiErg
R2 · 90 m Sled Push (100/75 kg)
Pro 125/100 kg
R3 · 1000 m Row
R4 · 70 m Burpee Broad Jumps
R5 · 90 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R6 · 160 m Farmer Carry (20/16 kg)
Pro 24/16 kg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 41:35, cap 52'.
```

Estimation : Women 41.6' (≈ 41:35) · Men 41.6' (≈ 41:35) · Women Pro 38.5' (≈ 38:32) · Men Pro 38.5' (≈ 38:32) · cap 52:00

_Squelette `run_into_station` · seed 1539 · tirage 8 · signature `hybrid|run_into_station|rounds_for_time|6|run:650m,ski_erg:1000m,sled_push:90m,row:1000m,burpee_broad_jump:70m,sandbag_lunge:90m,db_farmer_carry:160m`_

#### 79. Intervalles · Shuttle Run

**Entrées** : Après la classe · Hybrid · 10' · intention run · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
6 rounds · repos 0:45 entre les répétitions
200 m Shuttle Run
Stimulus : RPE 8.5 — Allure 5 km ou plus vite, régularité entre répétitions. Cible Men : ≈ 1:12 par répétition.
```

Estimation : Women 10.9' (≈ 1:12 par répétition) · Men 10.9' (≈ 1:12 par répétition) · Women Pro 10.3' (≈ 1:06 par répétition) · Men Pro 10.3' (≈ 1:06 par répétition)

_Squelette `run_intervals:C` · seed 1576 · tirage 1 · signature `hybrid|run_intervals:C|interval|6|shuttle_run:200m`_

#### 80. Intervalles · Shuttle Run

**Entrées** : Après la classe · Hybrid · 15' · intention run · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
8 rounds · repos 0:45 entre les répétitions
200 m Shuttle Run
Stimulus : RPE 8.5 — Allure 5 km ou plus vite, régularité entre répétitions. Cible Men : ≈ 1:12 par répétition.
```

Estimation : Women 14.8' (≈ 1:12 par répétition) · Men 14.8' (≈ 1:12 par répétition) · Women Pro 14.1' (≈ 1:06 par répétition) · Men Pro 14.1' (≈ 1:06 par répétition)

_Squelette `run_intervals:C` · seed 1553 · tirage 1 · signature `hybrid|run_intervals:C|interval|8|shuttle_run:200m`_

### Hybrid · core

#### 81. 4 rounds · Farmer Carry / Plank Hold / Echo Bike

**Entrées** : Express · Hybrid · 15' · intention core · format Surprise · sans gilet

```
4 rounds for time (cap 17:30)
70 m Farmer Carry (20/16 kg)
Pro 24/16 kg
60 s Plank Hold
10 cal Echo Bike
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 13:41, cap 17:30.
```

Estimation : Women 13.7' (≈ 13:41) · Men 13.7' (≈ 13:41) · Women Pro 12.7' (≈ 12:44) · Men Pro 12.7' (≈ 12:44) · cap 17:30

_Squelette `core_carry_finisher` · seed 1560 · tirage 2 · signature `hybrid|core_carry_finisher|rounds_for_time|4|db_farmer_carry:70m,plank_hold:s,echo_bike:10cal`_

#### 82. 6 rounds · Farmer Carry / Plank Hold / Echo Bike

**Entrées** : Express · Hybrid · 20' · intention core · format AMRAP · gilet optionnel

```
6 rounds for time (cap 27')
60 m Farmer Carry (20/16 kg)
Pro 24/16 kg
60 s Plank Hold
10 cal Echo Bike
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 21:15, cap 27'.
```

Estimation : Women 21.3' (≈ 21:15) · Men 21.3' (≈ 21:15) · Women Pro 19.8' (≈ 19:47) · Men Pro 19.8' (≈ 19:47) · cap 27:00

_Squelette `core_carry_finisher` · seed 1567 · tirage 2 · relâché : format · signature `hybrid|core_carry_finisher|rounds_for_time|6|db_farmer_carry:60m,plank_hold:s,echo_bike:10cal`_

#### 83. 4 rounds · Sled Push / Run

**Entrées** : Express · Hybrid · 30' · intention core · format For time · gilet obligatoire

```
4 rounds for time (cap 34:30)
60 m Sled Push (100/75 kg)
Pro 125/100 kg
1000 m Run
Gilet lesté 9/6 kg
Stimulus : RPE 8 — Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km. Cible Men : ≈ 27:27, cap 34:30.
```

Estimation : Women 27.4' (≈ 27:27) · Men 27.4' (≈ 27:27) · Women Pro 25.5' (≈ 25:27) · Men Pro 25.5' (≈ 25:27) · cap 34:30

_Squelette `compromised_run` · seed 1574 · tirage 1 · relâché : format, intention · signature `hybrid|compromised_run|rounds_for_time|4|sled_push:60m,run:1000m`_

#### 84. Continu · Row / Run / Bike Erg

**Entrées** : Express · Hybrid · 45' · intention core · format EMOM · sans gilet

```
En continu 45' · rotation sans repos, score = distance totale
500 m Row
400 m Run
1000 m Bike Erg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 15932 m.
```

Estimation : Women 45.0' (≈ 15932 m) · Men 45.0' (≈ 15932 m) · Women Pro 45.0' (≈ 17157 m) · Men Pro 45.0' (≈ 17157 m)

_Squelette `engine_continuous` · seed 1583 · tirage 1 · relâché : format, intention · signature `hybrid|engine_continuous|continuous|-|row:500m,run:400m,bike_erg:1000m`_

#### 85. 5 rounds · Farmer Carry / Plank Hold / Run

**Entrées** : Express · Hybrid · 15' · intention core · format Chipper · gilet optionnel

```
5 rounds for time (cap 20:30)
60 m Farmer Carry (20/16 kg)
Pro 24/16 kg
60 s Plank Hold
100 m Run
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 16:12, cap 20:30.
```

Estimation : Women 16.2' (≈ 16:12) · Men 16.2' (≈ 16:12) · Women Pro 15.1' (≈ 15:06) · Men Pro 15.1' (≈ 15:06) · cap 20:30

_Squelette `core_carry_finisher` · seed 1588 · tirage 1 · relâché : format · signature `hybrid|core_carry_finisher|rounds_for_time|5|db_farmer_carry:60m,plank_hold:s,run:100m`_

#### 86. 6 rounds · Sandbag Carry / Plank Hold / Shuttle Run

**Entrées** : Express · Hybrid · 20' · intention core · format Stations · gilet obligatoire

```
6 rounds for time (cap 24')
60 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
60 s Plank Hold
100 m Shuttle Run
Gilet lesté 9/6 kg
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 19:00, cap 24'.
```

Estimation : Women 19.0' (≈ 19:00) · Men 19.0' (≈ 19:00) · Women Pro 17.6' (≈ 17:39) · Men Pro 17.6' (≈ 17:39) · cap 24:00

_Squelette `core_carry_finisher` · seed 1595 · tirage 2 · relâché : format · signature `hybrid|core_carry_finisher|rounds_for_time|6|sandbag_carry:60m,plank_hold:s,shuttle_run:100m`_

#### 87. Stations · SkiErg / KB Swings Russian / Bike Erg

**Entrées** : Express · Hybrid · 30' · intention core · format Intervalles · sans gilet

```
3 rounds × 5 stations · 90 s on / 30 s off
Station 1 · SkiErg (max cal, cible 25 cal)
Station 2 · KB Swings Russian (20/16 kg) (max reps, cible 50)
Pro 24/16 kg
Station 3 · Bike Erg (max cal, cible 25 cal)
Station 4 · Burpee Broad Jumps (max m, cible 60 m)
Station 5 · Sandbag Lunges (30/20 kg) (max m, cible 100 m)
Pro 40/30 kg
Stimulus : RPE 8.5 — Alternance jambes / épaules / mono, 90 s de travail max effort. Cible Men : 3 tours × 5 stations, 90 s on / 30 s off.
```

Estimation : Women 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Men 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Women Pro 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Men Pro 30.0' (3 tours × 5 stations, 90 s on / 30 s off)

_Squelette `stations_interval` · seed 1602 · tirage 4 · relâché : format, intention · signature `hybrid|stations_interval|stations|3|ski_erg:25cal,kb_swing_russian:reps,bike_erg:25cal,burpee_broad_jump:60m,sandbag_lunge:100m`_

#### 88. 6 rounds · Run / Farmer Carry

**Entrées** : Express · Hybrid · 45' · intention core · format Surprise · gilet optionnel

```
6 rounds for time (cap 51:30)
750 m Run
R1 · 170 m Farmer Carry (20/16 kg)
Pro 24/16 kg
R2 · 100 m Sled Pull (75/50 kg)
Pro 100/75 kg
R3 · 100 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R4 · 35 m Burpee Broad Jumps
R5 · 100 m Sled Push (100/75 kg)
Pro 125/100 kg
R6 · 500 m SkiErg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 40:58, cap 51:30.
```

Estimation : Women 41.0' (≈ 40:58) · Men 41.0' (≈ 40:58) · Women Pro 38.0' (≈ 37:59) · Men Pro 38.0' (≈ 37:59) · cap 51:30

_Squelette `run_into_station` · seed 1621 · tirage 3 · relâché : format, intention · signature `hybrid|run_into_station|rounds_for_time|6|run:750m,db_farmer_carry:170m,sled_pull:100m,sandbag_lunge:100m,burpee_broad_jump:35m,sled_push:100m,ski_erg:500m`_

#### 89. 3 rounds · Farmer Carry / Sit-ups / Row

**Entrées** : Après la classe · Hybrid · 10' · intention core · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
3 rounds for time (cap 11:30)
60 m Farmer Carry (20/16 kg)
Pro 24/16 kg
33 Sit-ups
10 cal Row
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 9:01, cap 11:30.
```

Estimation : Women 9.0' (≈ 9:01) · Men 9.0' (≈ 9:01) · Women Pro 8.4' (≈ 8:23) · Men Pro 8.4' (≈ 8:23) · cap 11:30

_Squelette `core_carry_finisher` · seed 1616 · tirage 2 · signature `hybrid|core_carry_finisher|rounds_for_time|3|db_farmer_carry:60m,sit_up:reps,row:10cal`_

#### 90. 5 rounds · Farmer Carry / Plank Hold / Bike Erg

**Entrées** : Après la classe · Hybrid · 15' · intention core · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
5 rounds for time (cap 20:30)
60 m Farmer Carry (20/16 kg)
Pro 24/16 kg
55 s Plank Hold
10 cal Bike Erg
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 16:18, cap 20:30.
```

Estimation : Women 16.3' (≈ 16:18) · Men 16.3' (≈ 16:18) · Women Pro 15.2' (≈ 15:11) · Men Pro 15.2' (≈ 15:11) · cap 20:30

_Squelette `core_carry_finisher` · seed 1623 · tirage 1 · signature `hybrid|core_carry_finisher|rounds_for_time|5|db_farmer_carry:60m,plank_hold:s,bike_erg:10cal`_
