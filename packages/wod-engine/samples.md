# Échantillon générateur — 10 WODs par intention × discipline

Moteur 1.1.0 · catalogue v2 · banque v3. Sortie texte telle que l'athlète la lirait (`title` + `description`), suivie de l'estimation par catégorie et des métadonnées du tirage. Tout est régénérable à l'identique depuis la seed.

## Functional

### Functional · mixed

#### 1. 21-15-9 · Squat Snatch / Handstand Push-ups

**Entrées** : Express · Functional · 8' · intention mixed · format Surprise

```
For time · 21-15-9 (cap 10:30)
Squat Snatch (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
Handstand Push-ups
Scaled : Push-ups · Inter : Pike Push-Ups · Elite/Pro : Strict Handstand Push-Ups
Stimulus : RPE 9 — Sprint, sets courts dès le round 1. Cible RX : ≈ 7:29, cap 10:30.
```

Estimation : Scaled 9.5' (≈ 9:28) · Inter 8.5' (≈ 8:28) · RX 7.5' (≈ 7:29) · RX+ 7.0' (≈ 6:57) · Elite 6.5' (≈ 6:29) · Pro 6.2' (≈ 6:10) · cap 10:30

_Squelette `couplet_for_time_21_15_9` · seed 1000 · tirage 6 · signature `functional|couplet_for_time_21_15_9|for_time|-|squat_snatch:reps,handstand_push_up:reps`_

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

#### 3. 5 rounds · Back Squat / Echo Bike / Toes-to-Bar

**Entrées** : Express · Functional · 15' · intention mixed · format For time

```
5 rounds for time (cap 19:30)
6 Back Squat (100/70 kg)
Scaled 60/40 · Inter 80/55 · RX+ 120/80 · Elite 140/95 · Pro 160/110 kg
20 cal Echo Bike
12 Toes-to-Bar
Scaled : Hanging Knee Raises
Stimulus : RPE 8 — Rounds réguliers, la barre ne se pose pas avant la fin du set. Cible RX : ≈ 13:36, cap 19:30.
```

Estimation : Scaled 17.0' (≈ 16:58) · Inter 15.3' (≈ 15:16) · RX 13.6' (≈ 13:36) · RX+ 12.7' (≈ 12:42) · Elite 11.9' (≈ 11:56) · Pro 11.4' (≈ 11:22) · cap 19:30

_Squelette `triplet_rounds_for_time` · seed 1014 · tirage 6 · signature `functional|triplet_rounds_for_time|rounds_for_time|5|back_squat:reps,echo_bike:20cal,toes_to_bar:reps`_

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

#### 5. Stations · Bike Erg / Sled Pull / SkiErg

**Entrées** : Express · Functional · 30' · intention mixed · format Chipper

```
4 rounds × 4 stations · 75 s on / 30 s off
Station 1 · Bike Erg (max cal, cible 20 cal)
Station 2 · Sled Pull (100/75 kg) (max m, cible 25 m)
Scaled 50/40 · Inter 75/50 · RX+ 125/100 · Elite 150/125 · Pro 150/125 kg
Station 3 · SkiErg (max cal, cible 18 cal)
Station 4 · Box Jump-overs (60/50 cm) (max reps, cible 15)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Scaled : Box Step Over
Stimulus : RPE 8 — Max effort sur chaque station, repos incomplet voulu. Cible RX : 4 tours × 4 stations, 75 s on / 30 s off.
```

Estimation : Scaled 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · Inter 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · RX 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · RX+ 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · Elite 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · Pro 28.0' (4 tours × 4 stations, 75 s on / 30 s off)

_Squelette `stations_rotation` · seed 1028 · tirage 51 · relâché : format · signature `functional|stations_rotation|stations|4|bike_erg:20cal,sled_pull:25m,ski_erg:18cal,box_jump_over:reps`_

#### 6. AMRAP 8 · Sumo Deadlift High Pull / Pistols

**Entrées** : Express · Functional · 8' · intention mixed · format Stations

```
AMRAP 8
8 Sumo Deadlift High Pull (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
12 Pistols
Scaled : Box Pistols · Inter : Pistols To Box
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 6 rounds.
```

Estimation : Scaled 8.0' (≈ 5 rounds) · Inter 8.0' (≈ 6 rounds) · RX 8.0' (≈ 6 rounds) · RX+ 8.0' (≈ 7 rounds) · Elite 8.0' (≈ 7 rounds) · Pro 8.0' (≈ 8 rounds)

_Squelette `couplet_amrap_short` · seed 1035 · tirage 2 · relâché : format · signature `functional|couplet_amrap_short|amrap|-|sumo_deadlift_high_pull:reps,pistol:reps`_

#### 7. AMRAP 12 · DB Thruster / Bike Erg

**Entrées** : Express · Functional · 12' · intention mixed · format Intervalles

```
AMRAP 12
12 DB Thruster (22.5/15 kg)
Scaled 15/10 · Inter 20/12.5 · RX+ 30/20 · Elite 35/22.5 · Pro 40/25 kg
12 cal Bike Erg
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 7 rounds.
```

Estimation : Scaled 12.0' (≈ 6 rounds) · Inter 12.0' (≈ 6 rounds) · RX 12.0' (≈ 7 rounds) · RX+ 12.0' (≈ 8 rounds) · Elite 12.0' (≈ 8 rounds) · Pro 12.0' (≈ 9 rounds)

_Squelette `couplet_amrap_short` · seed 1042 · tirage 1 · relâché : format · signature `functional|couplet_amrap_short|amrap|-|db_thruster:reps,bike_erg:12cal`_

#### 8. Death by · Row / Power Snatch

**Entrées** : Express · Functional · 15' · intention mixed · format Surprise

```
EMOM 15 · Death by : +1 rep par minute jusqu'à l'échec
5 cal Row (avant chaque série)
Power Snatch (43/30 kg) · min 1 : 1 rep, +1 rep par minute
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
Stimulus : RPE 9 — S'arrête quand la minute n'est plus tenue. Cible RX : minute 9.
```

Estimation : Scaled 15.0' (minute 6) · Inter 15.0' (minute 7) · RX 15.0' (minute 9) · RX+ 15.0' (minute 11) · Elite 15.0' (minute 12) · Pro 15.0' (minute 13)

_Squelette `death_by` · seed 1049 · tirage 2 · signature `functional|death_by|death_by|-|row:5cal,power_snatch:reps`_

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

#### 10. AMRAP 15 · Echo Bike / KB Swings Russian / Burpee Box Jump Over

**Entrées** : Après la classe · Functional · 15' · intention mixed · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 15
20 cal Echo Bike
19 KB Swings Russian (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
12 Burpee Box Jump Over (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 4 rounds.
```

Estimation : Scaled 15.0' (≈ 3 rounds) · Inter 15.0' (≈ 3 rounds) · RX 15.0' (≈ 4 rounds) · RX+ 15.0' (≈ 4 rounds) · Elite 15.0' (≈ 5 rounds) · Pro 15.0' (≈ 5 rounds)

_Squelette `triplet_amrap_mid` · seed 1063 · tirage 2 · signature `functional|triplet_amrap_mid|amrap|-|echo_bike:20cal,kb_swing_russian:reps,burpee_box_jump_over:reps`_

### Functional · cardio

#### 11. AMRAP 8 · Power Snatch / Box Jump Over Step Down

**Entrées** : Express · Functional · 8' · intention cardio · format Surprise

```
AMRAP 8
11 Power Snatch (30/20 kg)
Scaled 20/15 · Inter 25/20 · RX+ 35/25 · Elite 40/30 · Pro 43/30 kg
12 Box Jump Over Step Down (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Scaled : Box Step Over
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 5 rounds.
```

Estimation : Scaled 8.0' (≈ 4 rounds) · Inter 8.0' (≈ 4 rounds) · RX 8.0' (≈ 5 rounds) · RX+ 8.0' (≈ 5 rounds) · Elite 8.0' (≈ 5 rounds) · Pro 8.0' (≈ 6 rounds)

_Squelette `couplet_amrap_short` · seed 1070 · tirage 3 · signature `functional|couplet_amrap_short|amrap|-|power_snatch:reps,box_jump_over_step_down:reps`_

#### 12. AMRAP 12 · Echo Bike / Push Press / Toes-to-Bar

**Entrées** : Express · Functional · 12' · intention cardio · format AMRAP

```
AMRAP 12
11 cal Echo Bike
15 Push Press (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
10 Toes-to-Bar
Scaled : Hanging Knee Raises
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 6 rounds.
```

Estimation : Scaled 12.0' (≈ 4 rounds) · Inter 12.0' (≈ 5 rounds) · RX 12.0' (≈ 6 rounds) · RX+ 12.0' (≈ 6 rounds) · Elite 12.0' (≈ 6 rounds) · Pro 12.0' (≈ 7 rounds)

_Squelette `triplet_amrap_mid` · seed 1077 · tirage 1 · signature `functional|triplet_amrap_mid|amrap|-|echo_bike:11cal,push_press:reps,toes_to_bar:reps`_

#### 13. AMRAP 15 · SkiErg / DB Thruster / Plank Hold

**Entrées** : Express · Functional · 15' · intention cardio · format For time

```
AMRAP 15
14 cal SkiErg
15 DB Thruster (15/10 kg)
Scaled 10/7.5 · Inter 12.5/10 · RX+ 20/12.5 · Elite 22.5/15 · Pro 22.5/15 kg
35 s Plank Hold
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 5 rounds.
```

Estimation : Scaled 15.0' (≈ 4 rounds) · Inter 15.0' (≈ 5 rounds) · RX 15.0' (≈ 5 rounds) · RX+ 15.0' (≈ 6 rounds) · Elite 15.0' (≈ 6 rounds) · Pro 15.0' (≈ 6 rounds)

_Squelette `triplet_amrap_mid` · seed 1084 · tirage 1 · relâché : format · signature `functional|triplet_amrap_mid|amrap|-|ski_erg:14cal,db_thruster:reps,plank_hold:s`_

#### 14. Intervalles · Row / DB Clean & Jerk / Burpee Broad Jumps

**Entrées** : Express · Functional · 20' · intention cardio · format EMOM

```
6 rounds · every 3'
10 cal Row
5 DB Clean & Jerk (15/10 kg)
Scaled 10/7.5 · Inter 12.5/10 · RX+ 20/12.5 · Elite 22.5/15 · Pro 22.5/15 kg
15 m Burpee Broad Jumps
Stimulus : RPE 9 — Chaque intervalle est un sprint, repos complet. Cible RX : travail ≈ 1:57 par intervalle.
```

Estimation : Scaled 18.0' (travail ≈ 2:24 par intervalle) · Inter 18.0' (travail ≈ 2:10 par intervalle) · RX 18.0' (travail ≈ 1:57 par intervalle) · RX+ 18.0' (travail ≈ 1:49 par intervalle) · Elite 18.0' (travail ≈ 1:43 par intervalle) · Pro 18.0' (travail ≈ 1:38 par intervalle)

_Squelette `interval_work_rest` · seed 1091 · tirage 1 · relâché : format · signature `functional|interval_work_rest|interval|6|row:10cal,db_clean_and_jerk:reps,burpee_broad_jump:15m`_

#### 15. Stations · SkiErg / Sled Push / Echo Bike

**Entrées** : Express · Functional · 30' · intention cardio · format Chipper

```
4 rounds × 4 stations · 75 s on / 30 s off
Station 1 · SkiErg (max cal, cible 18 cal)
Station 2 · Sled Push (100/75 kg) (max m, cible 30 m)
Scaled 50/35 · Inter 75/50 · RX+ 125/100 · Elite 150/125 · Pro 150/125 kg
Station 3 · Echo Bike (max cal, cible 19 cal)
Station 4 · Alt DB Snatch (15/10 kg) (max reps, cible 25)
Scaled 10/7.5 · Inter 12.5/10 · RX+ 20/12.5 · Elite 22.5/15 · Pro 22.5/15 kg
Stimulus : RPE 8 — Max effort sur chaque station, repos incomplet voulu. Cible RX : 4 tours × 4 stations, 75 s on / 30 s off.
```

Estimation : Scaled 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · Inter 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · RX 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · RX+ 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · Elite 28.0' (4 tours × 4 stations, 75 s on / 30 s off) · Pro 28.0' (4 tours × 4 stations, 75 s on / 30 s off)

_Squelette `stations_rotation` · seed 1098 · tirage 55 · relâché : format · signature `functional|stations_rotation|stations|4|ski_erg:18cal,sled_push:30m,echo_bike:19cal,db_snatch:reps`_

#### 16. AMRAP 8 · KB Snatch / Row

**Entrées** : Express · Functional · 8' · intention cardio · format Stations

```
AMRAP 8
14 KB Snatch (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
17 cal Row
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 4 rounds.
```

Estimation : Scaled 8.0' (≈ 3 rounds) · Inter 8.0' (≈ 3 rounds) · RX 8.0' (≈ 4 rounds) · RX+ 8.0' (≈ 4 rounds) · Elite 8.0' (≈ 5 rounds) · Pro 8.0' (≈ 5 rounds)

_Squelette `couplet_amrap_short` · seed 1105 · tirage 10 · relâché : format · signature `functional|couplet_amrap_short|amrap|-|kb_snatch:reps,row:17cal`_

#### 17. AMRAP 12 · Row / DB Thruster / Chest-to-Bar

**Entrées** : Express · Functional · 12' · intention cardio · format Intervalles

```
AMRAP 12
13 cal Row
12 DB Thruster (15/10 kg)
Scaled 10/7.5 · Inter 12.5/10 · RX+ 20/12.5 · Elite 22.5/15 · Pro 22.5/15 kg
7 Chest-to-Bar
Scaled : Ring Rows · Inter : Pull-ups · Elite/Pro : Bar Muscle-ups
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 5 rounds.
```

Estimation : Scaled 12.0' (≈ 4 rounds) · Inter 12.0' (≈ 5 rounds) · RX 12.0' (≈ 5 rounds) · RX+ 12.0' (≈ 6 rounds) · Elite 12.0' (≈ 6 rounds) · Pro 12.0' (≈ 7 rounds)

_Squelette `triplet_amrap_mid` · seed 1112 · tirage 2 · relâché : format · signature `functional|triplet_amrap_mid|amrap|-|row:13cal,db_thruster:reps,chest_to_bar:reps`_

#### 18. Intervalles · SkiErg / Front Squat / Burpee Broad Jumps

**Entrées** : Express · Functional · 15' · intention cardio · format Surprise

```
5 rounds · every 3'
10 cal SkiErg
5 Front Squat (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
15 m Burpee Broad Jumps
Stimulus : RPE 9 — Chaque intervalle est un sprint, repos complet. Cible RX : travail ≈ 1:56 par intervalle.
```

Estimation : Scaled 15.0' (travail ≈ 2:24 par intervalle) · Inter 15.0' (travail ≈ 2:10 par intervalle) · RX 15.0' (travail ≈ 1:56 par intervalle) · RX+ 15.0' (travail ≈ 1:49 par intervalle) · Elite 15.0' (travail ≈ 1:42 par intervalle) · Pro 15.0' (travail ≈ 1:38 par intervalle)

_Squelette `interval_work_rest` · seed 1119 · tirage 1 · signature `functional|interval_work_rest|interval|5|ski_erg:10cal,front_squat:reps,burpee_broad_jump:15m`_

#### 19. Tabata · Row / Plank Hold

**Entrées** : Après la classe · Functional · 10' · intention cardio · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
Tabata × 2 blocs · 8 × 20 s / 10 s, transition 60 s
Tabata 1 · Row (max reps)
Tabata 2 · Plank Hold (tenue 20 s)
Stimulus : RPE 8 — Score = somme des reps min de chaque bloc. Cible RX : reps min sur 8 × 20 s par bloc.
```

Estimation : Scaled 10.0' (reps min sur 8 × 20 s par bloc) · Inter 10.0' (reps min sur 8 × 20 s par bloc) · RX 10.0' (reps min sur 8 × 20 s par bloc) · RX+ 10.0' (reps min sur 8 × 20 s par bloc) · Elite 10.0' (reps min sur 8 × 20 s par bloc) · Pro 10.0' (reps min sur 8 × 20 s par bloc)

_Squelette `tabata_pair` · seed 1126 · tirage 50 · signature `functional|tabata_pair|tabata|8|row:cal,plank_hold:s`_

#### 20. AMRAP 15 · Bike Erg / KB Clean / Plank Hold

**Entrées** : Après la classe · Functional · 15' · intention cardio · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 15
16 cal Bike Erg
14 KB Clean (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
55 s Plank Hold
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 5 rounds.
```

Estimation : Scaled 15.0' (≈ 4 rounds) · Inter 15.0' (≈ 4 rounds) · RX 15.0' (≈ 5 rounds) · RX+ 15.0' (≈ 5 rounds) · Elite 15.0' (≈ 6 rounds) · Pro 15.0' (≈ 6 rounds)

_Squelette `triplet_amrap_mid` · seed 1133 · tirage 1 · signature `functional|triplet_amrap_mid|amrap|-|bike_erg:16cal,kb_clean:reps,plank_hold:s`_

### Functional · force

#### 21. 6 rounds · Power Snatch / Echo Bike

**Entrées** : Express · Functional · 8' · intention force · format Surprise

```
6 rounds for time (cap 12')
3 Power Snatch (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
12 cal Echo Bike
Stimulus : RPE 8 — Charge lourde, sets non cassés, le mono sert de récupération active. Cible RX : ≈ 8:34, cap 12'.
```

Estimation : Scaled 10.5' (≈ 10:32) · Inter 9.5' (≈ 9:32) · RX 8.6' (≈ 8:34) · RX+ 8.0' (≈ 8:02) · Elite 7.6' (≈ 7:35) · Pro 7.2' (≈ 7:15) · cap 12:00

_Squelette `heavy_couplet` · seed 1140 · tirage 51 · relâché : format, duration±5 · signature `functional|heavy_couplet|rounds_for_time|6|power_snatch:reps,echo_bike:12cal`_

#### 22. EMOM 12 · Front Rack Lunges / GHD Sit-Ups / Row

**Entrées** : Express · Functional · 12' · intention force · format AMRAP

```
EMOM 12 · 3 stations en alternance
Min 1 · 6 Front Rack Lunges (70/50 kg)
Scaled 50/35 · Inter 60/43 · RX+ 80/55 · Elite 90/60 · Pro 100/70 kg
Min 2 · 9 GHD Sit-Ups
Scaled/Inter : Sit-ups
Min 3 · 9 cal Row
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 4 passages, travail 15-32 s / 60 s.
```

Estimation : Scaled 12.0' (4 passages, travail 20-42 s / 60 s) · Inter 12.0' (4 passages, travail 17-37 s / 60 s) · RX 12.0' (4 passages, travail 15-32 s / 60 s) · RX+ 12.0' (4 passages, travail 14-30 s / 60 s) · Elite 12.0' (4 passages, travail 13-28 s / 60 s) · Pro 12.0' (4 passages, travail 12-26 s / 60 s)

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
Min 1 · 5 Deadlift (140/95 kg)
Scaled 80/55 · Inter 100/70 · RX+ 160/110 · Elite 180/120 · Pro 200/140 kg
Min 2 · 8 Handstand Push-ups
Scaled : Push-ups · Inter : Pike Push-Ups · Elite/Pro : Strict Handstand Push-Ups
Min 3 · 9 cal Row
Min 4 · 6 Burpees
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 5 passages, travail 13-32 s / 60 s.
```

Estimation : Scaled 20.0' (5 passages, travail 16-42 s / 60 s) · Inter 20.0' (5 passages, travail 14-37 s / 60 s) · RX 20.0' (5 passages, travail 13-32 s / 60 s) · RX+ 20.0' (5 passages, travail 12-30 s / 60 s) · Elite 20.0' (5 passages, travail 11-28 s / 60 s) · Pro 20.0' (5 passages, travail 10-26 s / 60 s)

_Squelette `emom_alternating` · seed 1161 · tirage 1 · signature `functional|emom_alternating|emom|5|deadlift:reps,handstand_push_up:reps,row:9cal,burpee:reps`_

#### 25. Stations · Row / KB Front Squat / Bike Erg

**Entrées** : Express · Functional · 30' · intention force · format Chipper

```
4 rounds × 4 stations · 90 s on / 15 s off
Station 1 · Row (max cal, cible 25 cal)
Station 2 · KB Front Squat (32/24 kg) (max reps, cible 25)
Scaled 20/16 · Inter 24/16 · RX+ 32/24 · Elite 40/28 · Pro 40/28 kg
Station 3 · Bike Erg (max cal, cible 25 cal)
Station 4 · Devils Press (30/20 kg) (max reps, cible 7)
Scaled 20/12.5 · Inter 22.5/15 · RX+ 35/22.5 · Elite 40/25 · Pro 50/30 kg
Stimulus : RPE 8 — Max effort sur chaque station, repos incomplet voulu. Cible RX : 4 tours × 4 stations, 90 s on / 15 s off.
```

Estimation : Scaled 28.0' (4 tours × 4 stations, 90 s on / 15 s off) · Inter 28.0' (4 tours × 4 stations, 90 s on / 15 s off) · RX 28.0' (4 tours × 4 stations, 90 s on / 15 s off) · RX+ 28.0' (4 tours × 4 stations, 90 s on / 15 s off) · Elite 28.0' (4 tours × 4 stations, 90 s on / 15 s off) · Pro 28.0' (4 tours × 4 stations, 90 s on / 15 s off)

_Squelette `stations_rotation` · seed 1168 · tirage 3 · relâché : format, skeleton · signature `functional|stations_rotation|stations|4|row:25cal,kb_front_squat:reps,bike_erg:25cal,devil_press:reps`_

#### 26. 3 rounds · Hang Power Snatch / Box Jump-overs / Handstand Walk

**Entrées** : Express · Functional · 8' · intention force · format Stations

```
3 rounds for time (cap 11')
7 Hang Power Snatch (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
12 Box Jump-overs (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Scaled : Box Step Over
20 m Handstand Walk
Scaled : Bear Crawl · Inter : Handstand Shoulder Taps
Stimulus : RPE 8 — Rounds réguliers, la barre ne se pose pas avant la fin du set. Cible RX : ≈ 7:45, cap 11'.
```

Estimation : Scaled 9.7' (≈ 9:41) · Inter 8.7' (≈ 8:43) · RX 7.8' (≈ 7:45) · RX+ 7.2' (≈ 7:14) · Elite 6.8' (≈ 6:47) · Pro 6.5' (≈ 6:28) · cap 11:00

_Squelette `triplet_rounds_for_time` · seed 1175 · tirage 52 · relâché : format, duration±5 · signature `functional|triplet_rounds_for_time|rounds_for_time|3|hang_power_snatch:reps,box_jump_over:reps,handstand_walk:20m`_

#### 27. EMOM 12 · Shoulder To Overhead / Chest-to-Bar / Row

**Entrées** : Express · Functional · 12' · intention force · format Intervalles

```
EMOM 12 · 3 stations en alternance
Min 1 · 6 Shoulder To Overhead (70/50 kg)
Scaled 50/35 · Inter 60/43 · RX+ 80/55 · Elite 90/60 · Pro 100/70 kg
Min 2 · 8 Chest-to-Bar
Scaled : Ring Rows · Inter : Pull-ups · Elite/Pro : Bar Muscle-ups
Min 3 · 9 cal Row
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 4 passages, travail 17-32 s / 60 s.
```

Estimation : Scaled 12.0' (4 passages, travail 22-42 s / 60 s) · Inter 12.0' (4 passages, travail 19-37 s / 60 s) · RX 12.0' (4 passages, travail 17-32 s / 60 s) · RX+ 12.0' (4 passages, travail 15-30 s / 60 s) · Elite 12.0' (4 passages, travail 14-28 s / 60 s) · Pro 12.0' (4 passages, travail 13-26 s / 60 s)

_Squelette `emom_alternating` · seed 1182 · tirage 5 · relâché : format · signature `functional|emom_alternating|emom|4|shoulder_to_overhead:reps,chest_to_bar:reps,row:9cal`_

#### 28. Intervalles · SkiErg / Deadlift / Bar Facing Burpees

**Entrées** : Express · Functional · 15' · intention force · format Surprise

```
5 rounds · every 3'
11 cal SkiErg
5 Deadlift (140/95 kg)
Scaled 80/55 · Inter 100/70 · RX+ 160/110 · Elite 180/120 · Pro 200/140 kg
6 Bar Facing Burpees
Stimulus : RPE 9 — Chaque intervalle est un sprint, repos complet. Cible RX : travail ≈ 1:45 par intervalle.
```

Estimation : Scaled 15.0' (travail ≈ 2:10 par intervalle) · Inter 15.0' (travail ≈ 1:57 par intervalle) · RX 15.0' (travail ≈ 1:45 par intervalle) · RX+ 15.0' (travail ≈ 1:39 par intervalle) · Elite 15.0' (travail ≈ 1:33 par intervalle) · Pro 15.0' (travail ≈ 1:29 par intervalle)

_Squelette `interval_work_rest` · seed 1189 · tirage 1 · signature `functional|interval_work_rest|interval|5|ski_erg:11cal,deadlift:reps,bar_facing_burpee:reps`_

#### 29. AMRAP 10 · Echo Bike / KB Deadlift / Burpee Box Jump

**Entrées** : Après la classe · Functional · 10' · intention force · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 10
11 cal Echo Bike
13 KB Deadlift (24/16 kg)
Scaled 16/12 · Inter 20/16 · RX+ 28/20 · Elite 32/24 · Pro 32/24 kg
12 Burpee Box Jump (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 3 rounds.
```

Estimation : Scaled 10.0' (≈ 3 rounds) · Inter 10.0' (≈ 3 rounds) · RX 10.0' (≈ 3 rounds) · RX+ 10.0' (≈ 4 rounds) · Elite 10.0' (≈ 4 rounds) · Pro 10.0' (≈ 4 rounds)

_Squelette `triplet_amrap_mid` · seed 1196 · tirage 164 · relâché : format, skeleton, duration±5 · signature `functional|triplet_amrap_mid|amrap|-|echo_bike:11cal,kb_deadlift:reps,burpee_box_jump:reps`_

#### 30. AMRAP 15 · Bike Erg / KB Clean / Burpees

**Entrées** : Après la classe · Functional · 15' · intention force · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 15
14 cal Bike Erg
14 KB Clean (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
8 Burpees
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 6 rounds.
```

Estimation : Scaled 15.0' (≈ 5 rounds) · Inter 15.0' (≈ 6 rounds) · RX 15.0' (≈ 6 rounds) · RX+ 15.0' (≈ 7 rounds) · Elite 15.0' (≈ 7 rounds) · Pro 15.0' (≈ 8 rounds)

_Squelette `triplet_amrap_mid` · seed 1203 · tirage 52 · relâché : format, skeleton · signature `functional|triplet_amrap_mid|amrap|-|bike_erg:14cal,kb_clean:reps,burpee:reps`_

### Functional · gym

#### 31. AMRAP 8 · Burpee Box Jump / Rope Climbs

**Entrées** : Express · Functional · 8' · intention gym · format Surprise

```
AMRAP 8
10 Burpee Box Jump (60/50 cm)
Scaled 50/40 · Inter 60/50 · RX+ 60/50 · Elite 75/60 · Pro 75/60 cm
1 Rope Climbs
Scaled : Rope Pulls From Floor
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 5 rounds.
```

Estimation : Scaled 8.0' (≈ 4 rounds) · Inter 8.0' (≈ 4 rounds) · RX 8.0' (≈ 5 rounds) · RX+ 8.0' (≈ 5 rounds) · Elite 8.0' (≈ 6 rounds) · Pro 8.0' (≈ 6 rounds)

_Squelette `couplet_amrap_short` · seed 1210 · tirage 1 · signature `functional|couplet_amrap_short|amrap|-|burpee_box_jump:reps,rope_climb:reps`_

#### 32. AMRAP 12 · Squat Snatch / Ring Dips

**Entrées** : Express · Functional · 12' · intention gym · format AMRAP

```
AMRAP 12
7 Squat Snatch (30/20 kg)
Scaled 20/15 · Inter 25/20 · RX+ 35/25 · Elite 40/30 · Pro 43/30 kg
10 Ring Dips
Scaled : Box Dips · Inter : Banded Ring Dips
Stimulus : RPE 8 — Allure constante, pas de set cassé avant la mi-temps. Cible RX : ≈ 9 rounds.
```

Estimation : Scaled 12.0' (≈ 7 rounds) · Inter 12.0' (≈ 8 rounds) · RX 12.0' (≈ 9 rounds) · RX+ 12.0' (≈ 10 rounds) · Elite 12.0' (≈ 11 rounds) · Pro 12.0' (≈ 11 rounds)

_Squelette `couplet_amrap_short` · seed 1217 · tirage 26 · signature `functional|couplet_amrap_short|amrap|-|squat_snatch:reps,ring_dip:reps`_

#### 33. EMOM 15 · Ring Dips / GHD Sit-Ups

**Entrées** : Express · Functional · 15' · intention gym · format For time

```
EMOM 15 · every 1:30 · 2 stations en alternance
Min 1 · 12 Ring Dips
Scaled : Box Dips · Inter : Banded Ring Dips
Min 2 · 12 GHD Sit-Ups
Scaled/Inter : Sit-ups
Stimulus : RPE 6.5 — Technique, aucun échec musculaire. Cible RX : 5 passages, travail 26-26 s / 90 s.
```

Estimation : Scaled 15.0' (5 passages, travail 34-34 s / 90 s) · Inter 15.0' (5 passages, travail 30-30 s / 90 s) · RX 15.0' (5 passages, travail 26-26 s / 90 s) · RX+ 15.0' (5 passages, travail 24-24 s / 90 s) · Elite 15.0' (5 passages, travail 22-22 s / 90 s) · Pro 15.0' (5 passages, travail 21-21 s / 90 s)

_Squelette `gym_density` · seed 1224 · tirage 56 · relâché : format · signature `functional|gym_density|emom|5|ring_dip:reps,ghd_sit_up:reps`_

#### 34. EMOM 20 · Front Squat / Rope Climbs / SkiErg

**Entrées** : Express · Functional · 20' · intention gym · format EMOM

```
EMOM 20 · 4 stations en alternance
Min 1 · 6 Front Squat (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
Min 2 · 1 Rope Climbs
Scaled : Rope Pulls From Floor · Elite/Pro : Legless Rope Climbs
Min 3 · 8 cal SkiErg
Min 4 · 30 s Plank Hold
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 5 passages, travail 15-30 s / 60 s.
```

Estimation : Scaled 20.0' (5 passages, travail 20-40 s / 60 s) · Inter 20.0' (5 passages, travail 17-35 s / 60 s) · RX 20.0' (5 passages, travail 15-30 s / 60 s) · RX+ 20.0' (5 passages, travail 14-28 s / 60 s) · Elite 20.0' (5 passages, travail 13-26 s / 60 s) · Pro 20.0' (5 passages, travail 12-24 s / 60 s)

_Squelette `emom_alternating` · seed 1231 · tirage 1 · signature `functional|emom_alternating|emom|5|front_squat:reps,rope_climb:reps,ski_erg:8cal,plank_hold:s`_

#### 35. Stations · Run / Devils Press / Row

**Entrées** : Express · Functional · 30' · intention gym · format Chipper

```
4 rounds × 5 stations · 60 s on / 30 s off
Station 1 · Run (max m, cible 200 m)
Station 2 · Devils Press (15/10 kg) (max reps, cible 7)
Scaled 10/7.5 · Inter 12.5/10 · RX+ 20/12.5 · Elite 22.5/15 · Pro 22.5/15 kg
Station 3 · Row (max cal, cible 15 cal)
Station 4 · DB Lunges (15/10 kg) (max reps, cible 25)
Scaled 10/7.5 · Inter 12.5/10 · RX+ 20/12.5 · Elite 22.5/15 · Pro 22.5/15 kg
Station 5 · Bar Muscle-ups (max reps, cible 5)
Scaled : Banded Pull-Ups · Inter/RX : Chest-to-Bar
Stimulus : RPE 8 — Max effort sur chaque station, repos incomplet voulu. Cible RX : 4 tours × 5 stations, 60 s on / 30 s off.
```

Estimation : Scaled 30.0' (4 tours × 5 stations, 60 s on / 30 s off) · Inter 30.0' (4 tours × 5 stations, 60 s on / 30 s off) · RX 30.0' (4 tours × 5 stations, 60 s on / 30 s off) · RX+ 30.0' (4 tours × 5 stations, 60 s on / 30 s off) · Elite 30.0' (4 tours × 5 stations, 60 s on / 30 s off) · Pro 30.0' (4 tours × 5 stations, 60 s on / 30 s off)

_Squelette `stations_rotation` · seed 1238 · tirage 23 · relâché : format, skeleton · signature `functional|stations_rotation|stations|4|run:200m,devil_press:reps,row:15cal,db_lunge:reps,bar_muscle_up:reps`_

#### 36. 21-15-9 · Devils Press / Ring Dips

**Entrées** : Express · Functional · 8' · intention gym · format Stations

```
For time · 21-15-9 (cap 11')
Devils Press (15/10 kg)
Scaled 10/7.5 · Inter 12.5/10 · RX+ 20/12.5 · Elite 22.5/15 · Pro 22.5/15 kg
Ring Dips
Scaled : Box Dips · Inter : Banded Ring Dips
Stimulus : RPE 9 — Sprint, sets courts dès le round 1. Cible RX : ≈ 7:39, cap 11'.
```

Estimation : Scaled 9.7' (≈ 9:40) · Inter 8.7' (≈ 8:40) · RX 7.6' (≈ 7:39) · RX+ 7.1' (≈ 7:06) · Elite 6.6' (≈ 6:38) · Pro 6.3' (≈ 6:18) · cap 11:00

_Squelette `couplet_for_time_21_15_9` · seed 1245 · tirage 8 · relâché : format · signature `functional|couplet_for_time_21_15_9|for_time|-|devil_press:reps,ring_dip:reps`_

#### 37. EMOM 12 · Back Squat / Handstand Push-ups / Echo Bike

**Entrées** : Express · Functional · 12' · intention gym · format Intervalles

```
EMOM 12 · 3 stations en alternance
Min 1 · 6 Back Squat (60/43 kg)
Scaled 40/30 · Inter 50/35 · RX+ 70/50 · Elite 80/55 · Pro 90/60 kg
Min 2 · 7 Handstand Push-ups
Scaled : Push-ups · Inter : Pike Push-Ups · Elite/Pro : Strict Handstand Push-Ups
Min 3 · 11 cal Echo Bike
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 4 passages, travail 18-39 s / 60 s.
```

Estimation : Scaled 12.0' (4 passages, travail 23-50 s / 60 s) · Inter 12.0' (4 passages, travail 21-44 s / 60 s) · RX 12.0' (4 passages, travail 18-39 s / 60 s) · RX+ 12.0' (4 passages, travail 17-35 s / 60 s) · Elite 12.0' (4 passages, travail 15-33 s / 60 s) · Pro 12.0' (4 passages, travail 14-31 s / 60 s)

_Squelette `emom_alternating` · seed 1252 · tirage 5 · relâché : format · signature `functional|emom_alternating|emom|4|back_squat:reps,handstand_push_up:reps,echo_bike:11cal`_

#### 38. EMOM 15 · Hang Power Clean / Strict Handstand Push-Ups / Bike Erg

**Entrées** : Express · Functional · 15' · intention gym · format Surprise

```
EMOM 15 · 3 stations en alternance
Min 1 · 6 Hang Power Clean (43/30 kg)
Scaled 30/20 · Inter 35/25 · RX+ 50/35 · Elite 55/40 · Pro 60/43 kg
Min 2 · 4 Strict Handstand Push-Ups
Scaled : Push-ups · Inter : Pike Push-Ups · RX : Handstand Push-ups
Min 3 · 10 cal Bike Erg
Stimulus : RPE 7 — Chaque station ≤ 40 s de travail, le repos est la consigne. Cible RX : 5 passages, travail 16-33 s / 60 s.
```

Estimation : Scaled 15.0' (5 passages, travail 21-43 s / 60 s) · Inter 15.0' (5 passages, travail 18-38 s / 60 s) · RX 15.0' (5 passages, travail 16-33 s / 60 s) · RX+ 15.0' (5 passages, travail 15-30 s / 60 s) · Elite 15.0' (5 passages, travail 14-28 s / 60 s) · Pro 15.0' (5 passages, travail 13-26 s / 60 s)

_Squelette `emom_alternating` · seed 1259 · tirage 5 · signature `functional|emom_alternating|emom|5|hang_power_clean:reps,strict_handstand_push_up:reps,bike_erg:10cal`_

#### 39. AMRAP 10 · Echo Bike / KB Swings Russian / Plank Hold

**Entrées** : Après la classe · Functional · 10' · intention gym · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
AMRAP 10
19 cal Echo Bike
19 KB Swings Russian (20/16 kg)
Scaled 12/8 · Inter 16/12 · RX+ 24/16 · Elite 24/20 · Pro 28/20 kg
45 s Plank Hold
Stimulus : RPE 7.5 — Tenable 20 min, transitions rapides. Cible RX : ≈ 3 rounds.
```

Estimation : Scaled 10.0' (≈ 2 rounds) · Inter 10.0' (≈ 3 rounds) · RX 10.0' (≈ 3 rounds) · RX+ 10.0' (≈ 3 rounds) · Elite 10.0' (≈ 4 rounds) · Pro 10.0' (≈ 4 rounds)

_Squelette `triplet_amrap_mid` · seed 1266 · tirage 153 · relâché : format, skeleton, duration±5 · signature `functional|triplet_amrap_mid|amrap|-|echo_bike:19cal,kb_swing_russian:reps,plank_hold:s`_

#### 40. EMOM 15 · Pull-ups / Hollow Rocks

**Entrées** : Après la classe · Functional · 15' · intention gym · format Surprise · WOD du jour : Back Squat, Thruster, Pull-ups

```
EMOM 15 · every 1:30 · 2 stations en alternance
Min 1 · 12 Pull-ups
Scaled : Ring Rows · Inter : Banded Pull-Ups · Elite/Pro : Chest-to-Bar
Min 2 · 20 Hollow Rocks
Stimulus : RPE 6.5 — Technique, aucun échec musculaire. Cible RX : 5 passages, travail 22-24 s / 90 s.
```

Estimation : Scaled 15.0' (5 passages, travail 28-31 s / 90 s) · Inter 15.0' (5 passages, travail 25-28 s / 90 s) · RX 15.0' (5 passages, travail 22-24 s / 90 s) · RX+ 15.0' (5 passages, travail 20-22 s / 90 s) · Elite 15.0' (5 passages, travail 18-20 s / 90 s) · Pro 15.0' (5 passages, travail 17-19 s / 90 s)

_Squelette `gym_density` · seed 1273 · tirage 9 · relâché : after_class_pattern · signature `functional|gym_density|emom|5|pull_up:reps,hollow_rock:reps`_

## Hybrid

### Hybrid · interval

#### 41. AMRAP 15 · Run / Sled Push / Sandbag Lunges

**Entrées** : Express · Hybrid · 15' · intention interval · format Surprise · sans gilet

```
AMRAP 15
300 m Run
40 m Sled Push (125/100 kg)
Pro 150/125 kg
20 m Sandbag Lunges (40/30 kg)
Pro 50/35 kg
15 cal Row
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```

Estimation : Women 15.0' (≈ 3 rounds) · Men 15.0' (≈ 3 rounds) · Women Pro 15.0' (≈ 3 rounds) · Men Pro 15.0' (≈ 3 rounds)

_Squelette `amrap_distances` · seed 1280 · tirage 10 · signature `hybrid|amrap_distances|amrap|-|run:300m,sled_push:40m,sandbag_lunge:20m,row:15cal`_

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
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```

Estimation : Women 20.0' (≈ 3 rounds) · Men 20.0' (≈ 3 rounds) · Women Pro 20.0' (≈ 3 rounds) · Men Pro 20.0' (≈ 3 rounds)

_Squelette `amrap_distances` · seed 1287 · tirage 1 · signature `hybrid|amrap_distances|amrap|-|run:350m,sled_pull:40m,sandbag_lunge:25m,row:13cal`_

#### 43. 4 rounds · Run / Farmer Carry

**Entrées** : Express · Hybrid · 30' · intention interval · format For time · gilet obligatoire

```
4 rounds for time (cap 34:30)
650 m Run
R1 · 200 m Farmer Carry (24/16 kg)
Pro 28/20 kg
R2 · 80 m Burpee Broad Jumps
R3 · 80 m Sandbag Lunges (40/30 kg)
Pro 50/35 kg
R4 · 550 m SkiErg
Gilet lesté 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 27:12, cap 34:30.
```

Estimation : Women 27.2' (≈ 27:12) · Men 27.2' (≈ 27:12) · Women Pro 25.2' (≈ 25:12) · Men Pro 25.2' (≈ 25:12) · cap 34:30

_Squelette `run_into_station` · seed 1294 · tirage 1 · signature `hybrid|run_into_station|rounds_for_time|4|run:650m,db_farmer_carry:200m,burpee_broad_jump:80m,sandbag_lunge:80m,ski_erg:550m`_

#### 44. 6 rounds · Run / Farmer Carry

**Entrées** : Express · Hybrid · 45' · intention interval · format EMOM · sans gilet

```
6 rounds for time (cap 52')
700 m Run
R1 · 90 m Farmer Carry (24/16 kg)
Pro 28/20 kg
R2 · 70 m Sled Push (125/100 kg)
Pro 150/125 kg
R3 · 42 Wall Balls (9/6 kg)
Pro 12/9 kg
R4 · 650 m Row
R5 · 100 m Sandbag Lunges (40/30 kg)
Pro 50/35 kg
R6 · 35 m Burpee Broad Jumps
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 41:23, cap 52'.
```

Estimation : Women 41.4' (≈ 41:23) · Men 41.4' (≈ 41:23) · Women Pro 38.4' (≈ 38:22) · Men Pro 38.4' (≈ 38:22) · cap 52:00

_Squelette `run_into_station` · seed 1301 · tirage 5 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|6|run:700m,db_farmer_carry:90m,sled_push:70m,wall_ball:reps,row:650m,sandbag_lunge:100m,burpee_broad_jump:35m`_

#### 45. AMRAP 15 · Run / Sled Pull / Wall Balls

**Entrées** : Express · Hybrid · 15' · intention interval · format Chipper · gilet optionnel

```
AMRAP 15
250 m Run
35 m Sled Pull (100/75 kg)
Pro 125/100 kg
15 Wall Balls (9/6 kg)
Pro 12/9 kg
20 cal Bike Erg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```

Estimation : Women 15.0' (≈ 3 rounds) · Men 15.0' (≈ 3 rounds) · Women Pro 15.0' (≈ 3 rounds) · Men Pro 15.0' (≈ 3 rounds)

_Squelette `amrap_distances` · seed 1308 · tirage 24 · relâché : format · signature `hybrid|amrap_distances|amrap|-|run:250m,sled_pull:35m,wall_ball:reps,bike_erg:20cal`_

#### 46. Stations · Sandbag Lunges / KB Swings Russian / SkiErg

**Entrées** : Express · Hybrid · 20' · intention interval · format Stations · gilet obligatoire

```
2 rounds × 5 stations · 90 s on / 30 s off
Station 1 · Sandbag Lunges (40/30 kg) (max m, cible 40 m)
Pro 50/35 kg
Station 2 · KB Swings Russian (24/16 kg) (max reps, cible 45)
Pro 28/20 kg
Station 3 · SkiErg (max cal, cible 20 cal)
Station 4 · Burpee Broad Jumps (max m, cible 30 m)
Station 5 · Wall Balls (9/6 kg) (max reps, cible 32)
Pro 12/9 kg
Gilet lesté 9/6 kg
Stimulus : RPE 8.5 — Alternance jambes / épaules / mono, 90 s de travail max effort. Cible Men : 2 tours × 5 stations, 90 s on / 30 s off.
```

Estimation : Women 20.0' (2 tours × 5 stations, 90 s on / 30 s off) · Men 20.0' (2 tours × 5 stations, 90 s on / 30 s off) · Women Pro 20.0' (2 tours × 5 stations, 90 s on / 30 s off) · Men Pro 20.0' (2 tours × 5 stations, 90 s on / 30 s off)

_Squelette `stations_interval` · seed 1315 · tirage 1 · signature `hybrid|stations_interval|stations|2|sandbag_lunge:40m,kb_swing_russian:reps,ski_erg:20cal,burpee_broad_jump:30m,wall_ball:reps`_

#### 47. Stations · SkiErg / Burpee Broad Jumps / Row

**Entrées** : Express · Hybrid · 30' · intention interval · format Intervalles · sans gilet

```
3 rounds × 5 stations · 90 s on / 30 s off
Station 1 · SkiErg (max cal, cible 20 cal)
Station 2 · Burpee Broad Jumps (max m, cible 30 m)
Station 3 · Row (max cal, cible 25 cal)
Station 4 · Sled Push (125/100 kg) (max m, cible 35 m)
Pro 150/125 kg
Station 5 · Farmer Carry (24/16 kg) (max m, cible 100 m)
Pro 28/20 kg
Stimulus : RPE 8.5 — Alternance jambes / épaules / mono, 90 s de travail max effort. Cible Men : 3 tours × 5 stations, 90 s on / 30 s off.
```

Estimation : Women 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Men 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Women Pro 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Men Pro 30.0' (3 tours × 5 stations, 90 s on / 30 s off)

_Squelette `stations_interval` · seed 1322 · tirage 2 · relâché : format · signature `hybrid|stations_interval|stations|3|ski_erg:20cal,burpee_broad_jump:30m,row:25cal,sled_push:35m,db_farmer_carry:100m`_

#### 48. 6 rounds · Run / Row

**Entrées** : Express · Hybrid · 45' · intention interval · format Surprise · gilet optionnel

```
6 rounds for time (cap 52')
600 m Run
R1 · 700 m Row
R2 · 750 m SkiErg
R3 · 150 m Farmer Carry (24/16 kg)
Pro 28/20 kg
R4 · 35 m Sled Pull (100/75 kg)
Pro 125/100 kg
R5 · 100 m Sandbag Lunges (40/30 kg)
Pro 50/35 kg
R6 · 90 m Sled Push (125/100 kg)
Pro 150/125 kg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 41:18, cap 52'.
```

Estimation : Women 41.3' (≈ 41:18) · Men 41.3' (≈ 41:18) · Women Pro 38.3' (≈ 38:15) · Men Pro 38.3' (≈ 38:15) · cap 52:00

_Squelette `run_into_station` · seed 1329 · tirage 3 · signature `hybrid|run_into_station|rounds_for_time|6|run:600m,row:700m,ski_erg:750m,db_farmer_carry:150m,sled_pull:35m,sandbag_lunge:100m,sled_push:90m`_

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

_Squelette `core_carry_finisher` · seed 1336 · tirage 51 · relâché : format, skeleton · signature `hybrid|core_carry_finisher|rounds_for_time|3|db_farmer_carry:100m,sit_up:reps,row:10cal`_

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
13 Wall Balls (6/4 kg)
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
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```

Estimation : Women 20.0' (≈ 3 rounds) · Men 20.0' (≈ 3 rounds) · Women Pro 20.0' (≈ 3 rounds) · Men Pro 20.0' (≈ 3 rounds)

_Squelette `amrap_distances` · seed 1357 · tirage 1 · signature `hybrid|amrap_distances|amrap|-|run:350m,sled_push:50m,sandbag_lunge:25m,ski_erg:15cal`_

#### 53. 5 rounds · Run / Wall Balls

**Entrées** : Express · Hybrid · 30' · intention engine · format For time · gilet obligatoire

```
5 rounds for time (cap 35')
500 m Run
R1 · 28 Wall Balls (6/4 kg)
Pro 9/6 kg
R2 · 80 m Sled Pull (75/50 kg)
Pro 100/75 kg
R3 · 700 m SkiErg
R4 · 45 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R5 · 650 m Row
Gilet lesté 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 28:00, cap 35'.
```

Estimation : Women 28.0' (≈ 28:00) · Men 28.0' (≈ 28:00) · Women Pro 26.0' (≈ 25:58) · Men Pro 26.0' (≈ 25:58) · cap 35:00

_Squelette `run_into_station` · seed 1364 · tirage 2 · signature `hybrid|run_into_station|rounds_for_time|5|run:500m,wall_ball:reps,sled_pull:80m,ski_erg:700m,sandbag_lunge:45m,row:650m`_

#### 54. 6 rounds · Run / Farmer Carry

**Entrées** : Express · Hybrid · 45' · intention engine · format EMOM · sans gilet

```
6 rounds for time (cap 51:30)
650 m Run
R1 · 140 m Farmer Carry (20/16 kg)
Pro 24/16 kg
R2 · 45 m Burpee Broad Jumps
R3 · 80 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R4 · 750 m Row
R5 · 70 m Sled Push (100/75 kg)
Pro 125/100 kg
R6 · 47 Wall Balls (6/4 kg)
Pro 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 40:58, cap 51:30.
```

Estimation : Women 41.0' (≈ 40:58) · Men 41.0' (≈ 40:58) · Women Pro 38.0' (≈ 37:58) · Men Pro 38.0' (≈ 37:58) · cap 51:30

_Squelette `run_into_station` · seed 1371 · tirage 4 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|6|run:650m,db_farmer_carry:140m,burpee_broad_jump:45m,sandbag_lunge:80m,row:750m,sled_push:70m,wall_ball:reps`_

#### 55. AMRAP 15 · Run / Sled Pull / Sandbag Lunges

**Entrées** : Express · Hybrid · 15' · intention engine · format Chipper · gilet optionnel

```
AMRAP 15
200 m Run
40 m Sled Pull (75/50 kg)
Pro 100/75 kg
30 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
13 cal SkiErg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8 — Allure constante, chaque round dans les 15 s du précédent. Cible Men : ≈ 3 rounds.
```

Estimation : Women 15.0' (≈ 3 rounds) · Men 15.0' (≈ 3 rounds) · Women Pro 15.0' (≈ 3 rounds) · Men Pro 15.0' (≈ 3 rounds)

_Squelette `amrap_distances` · seed 1378 · tirage 1 · relâché : format · signature `hybrid|amrap_distances|amrap|-|run:200m,sled_pull:40m,sandbag_lunge:30m,ski_erg:13cal`_

#### 56. 4 rounds · Run / SkiErg

**Entrées** : Express · Hybrid · 20' · intention engine · format Stations · gilet obligatoire

```
4 rounds for time (cap 23:30)
450 m Run
R1 · 450 m SkiErg
R2 · 550 m Row
R3 · 30 m Burpee Broad Jumps
R4 · 70 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
Gilet lesté 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 18:38, cap 23:30.
```

Estimation : Women 18.6' (≈ 18:38) · Men 18.6' (≈ 18:38) · Women Pro 17.3' (≈ 17:18) · Men Pro 17.3' (≈ 17:18) · cap 23:30

_Squelette `run_into_station` · seed 1385 · tirage 1 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|4|run:450m,ski_erg:450m,row:550m,burpee_broad_jump:30m,sandbag_lunge:70m`_

#### 57. 6 rounds · Run / Wall Balls

**Entrées** : Express · Hybrid · 30' · intention engine · format Intervalles · sans gilet

```
6 rounds for time (cap 39:30)
550 m Run
R1 · 21 Wall Balls (6/4 kg)
Pro 9/6 kg
R2 · 60 m Sled Push (100/75 kg)
Pro 125/100 kg
R3 · 400 m SkiErg
R4 · 35 m Burpee Broad Jumps
R5 · 350 m Row
R6 · 50 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 31:36, cap 39:30.
```

Estimation : Women 31.6' (≈ 31:36) · Men 31.6' (≈ 31:36) · Women Pro 29.3' (≈ 29:20) · Men Pro 29.3' (≈ 29:20) · cap 39:30

_Squelette `run_into_station` · seed 1392 · tirage 1 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|6|run:550m,wall_ball:reps,sled_push:60m,ski_erg:400m,burpee_broad_jump:35m,row:350m,sandbag_lunge:50m`_

#### 58. 6 rounds · Run / Sandbag Lunges

**Entrées** : Express · Hybrid · 45' · intention engine · format Surprise · gilet optionnel

```
6 rounds for time (cap 52:30)
650 m Run
R1 · 70 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R2 · 33 Wall Balls (6/4 kg)
Pro 9/6 kg
R3 · 950 m Row
R4 · 100 m Sled Pull (75/50 kg)
Pro 100/75 kg
R5 · 40 m Sled Push (100/75 kg)
Pro 125/100 kg
R6 · 40 m Burpee Broad Jumps
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 41:57, cap 52:30.
```

Estimation : Women 41.9' (≈ 41:57) · Men 41.9' (≈ 41:57) · Women Pro 38.9' (≈ 38:52) · Men Pro 38.9' (≈ 38:52) · cap 52:30

_Squelette `run_into_station` · seed 1399 · tirage 3 · signature `hybrid|run_into_station|rounds_for_time|6|run:650m,sandbag_lunge:70m,wall_ball:reps,row:950m,sled_pull:100m,sled_push:40m,burpee_broad_jump:40m`_

#### 59. 3 rounds · Sandbag Carry / GHD Sit-Ups / Row

**Entrées** : Après la classe · Hybrid · 10' · intention engine · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
3 rounds for time (cap 13:30)
70 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
13 GHD Sit-Ups
25 cal Row
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 10:32, cap 13:30.
```

Estimation : Women 10.5' (≈ 10:32) · Men 10.5' (≈ 10:32) · Women Pro 9.8' (≈ 9:47) · Men Pro 9.8' (≈ 9:47) · cap 13:30

_Squelette `core_carry_finisher` · seed 1406 · tirage 52 · relâché : format, skeleton · signature `hybrid|core_carry_finisher|rounds_for_time|3|sandbag_carry:70m,ghd_sit_up:reps,row:25cal`_

#### 60. 4 rounds · Run / Row

**Entrées** : Après la classe · Hybrid · 15' · intention engine · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
4 rounds for time (cap 20:30)
450 m Run
R1 · 250 m Row
R2 · 80 m Farmer Carry (20/16 kg)
Pro 24/16 kg
R3 · 30 m Sled Pull (75/50 kg)
Pro 100/75 kg
R4 · 35 m Burpee Broad Jumps
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 16:03, cap 20:30.
```

Estimation : Women 16.0' (≈ 16:03) · Men 16.0' (≈ 16:03) · Women Pro 14.9' (≈ 14:54) · Men Pro 14.9' (≈ 14:54) · cap 20:30

_Squelette `run_into_station` · seed 1413 · tirage 66 · relâché : format, duration±5 · signature `hybrid|run_into_station|rounds_for_time|4|run:450m,row:250m,db_farmer_carry:80m,sled_pull:30m,burpee_broad_jump:35m`_

### Hybrid · aerobic

#### 61. 250-500-750-500-250 · SkiErg / Burpee Broad Jumps

**Entrées** : Express · Hybrid · 15' · intention aerobic · format Surprise · sans gilet

```
For time · 250-500-750-500-250 m (cap 17:30)
SkiErg
10 m Burpee Broad Jumps (entre chaque palier)
Stimulus : RPE 7 — Pyramide à allure régulière, la station courte relance sans casser le rythme. Cible Men : ≈ 13:39, cap 17:30.
```

Estimation : Women 13.7' (≈ 13:39) · Men 13.7' (≈ 13:39) · Women Pro 12.7' (≈ 12:41) · Men Pro 12.7' (≈ 12:41) · cap 17:30

_Squelette `erg_pyramid` · seed 1420 · tirage 1 · relâché : format, duration±5 · signature `hybrid|erg_pyramid|for_time|-|ski_erg:2250m,burpee_broad_jump:10m`_

#### 62. Continu · SkiErg / Run / Bike Erg

**Entrées** : Express · Hybrid · 20' · intention aerobic · format AMRAP · gilet optionnel

```
En continu 20' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 6972 m.
```

Estimation : Women 20.0' (≈ 6972 m) · Men 20.0' (≈ 6972 m) · Women Pro 20.0' (≈ 7512 m) · Men Pro 20.0' (≈ 7512 m)

_Squelette `engine_continuous` · seed 1427 · tirage 2 · relâché : format · signature `hybrid|engine_continuous|continuous|-|ski_erg:500m,run:400m,bike_erg:1000m`_

#### 63. Continu · Row / Run / Bike Erg

**Entrées** : Express · Hybrid · 30' · intention aerobic · format For time · gilet obligatoire

```
En continu 30' · rotation sans repos, score = distance totale
500 m Row
400 m Run
1000 m Bike Erg
Gilet lesté 9/6 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 10621 m.
```

Estimation : Women 30.0' (≈ 10621 m) · Men 30.0' (≈ 10621 m) · Women Pro 30.0' (≈ 11438 m) · Men Pro 30.0' (≈ 11438 m)

_Squelette `engine_continuous` · seed 1435 · tirage 52 · relâché : format · signature `hybrid|engine_continuous|continuous|-|row:500m,run:400m,bike_erg:1000m`_

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
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 5362 m.
```

Estimation : Women 20.0' (≈ 5362 m) · Men 20.0' (≈ 5362 m) · Women Pro 20.0' (≈ 5793 m) · Men Pro 20.0' (≈ 5793 m)

_Squelette `engine_continuous` · seed 1455 · tirage 1 · signature `hybrid|engine_continuous|continuous|-|row:500m,run:400m,bike_erg:1000m,sandbag_carry:200m`_

#### 67. Continu · SkiErg / Run / Bike Erg

**Entrées** : Express · Hybrid · 30' · intention aerobic · format Intervalles · sans gilet

```
En continu 30' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
200 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 7958 m.
```

Estimation : Women 30.0' (≈ 7958 m) · Men 30.0' (≈ 7958 m) · Women Pro 30.0' (≈ 8601 m) · Men Pro 30.0' (≈ 8601 m)

_Squelette `engine_continuous` · seed 1467 · tirage 1 · relâché : format · signature `hybrid|engine_continuous|continuous|-|ski_erg:500m,run:400m,bike_erg:1000m,sandbag_carry:200m`_

#### 68. Continu · SkiErg / Run / Bike Erg

**Entrées** : Express · Hybrid · 45' · intention aerobic · format Surprise · gilet optionnel

```
En continu 45' · rotation sans repos, score = distance totale
500 m SkiErg
400 m Run
1000 m Bike Erg
200 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 6 — Zone 3, conversation difficile mais possible. Rotation sans repos jusqu'au budget. Cible Men : ≈ 11937 m.
```

Estimation : Women 45.0' (≈ 11937 m) · Men 45.0' (≈ 11937 m) · Women Pro 45.0' (≈ 12901 m) · Men Pro 45.0' (≈ 12901 m)

_Squelette `engine_continuous` · seed 1499 · tirage 1 · signature `hybrid|engine_continuous|continuous|-|ski_erg:500m,run:400m,bike_erg:1000m,sandbag_carry:200m`_

#### 69. 3 rounds · Sandbag Carry / Plank Hold / Bike Erg

**Entrées** : Après la classe · Hybrid · 10' · intention aerobic · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
3 rounds for time (cap 11:30)
100 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
40 s Plank Hold
10 cal Bike Erg
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 9:11, cap 11:30.
```

Estimation : Women 9.2' (≈ 9:11) · Men 9.2' (≈ 9:11) · Women Pro 8.5' (≈ 8:32) · Men Pro 8.5' (≈ 8:32) · cap 11:30

_Squelette `core_carry_finisher` · seed 1476 · tirage 2 · relâché : format, skeleton · signature `hybrid|core_carry_finisher|rounds_for_time|3|sandbag_carry:100m,plank_hold:s,bike_erg:10cal`_

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
4 rounds for time (cap 40')
70 m Sled Push (125/100 kg)
Pro 150/125 kg
900 m Run
Gilet lesté 9/6 kg
Stimulus : RPE 8 — Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km. Cible Men : ≈ 31:40, cap 40'.
```

Estimation : Women 31.7' (≈ 31:40) · Men 31.7' (≈ 31:40) · Women Pro 29.3' (≈ 29:19) · Men Pro 29.3' (≈ 29:19) · cap 40:00

_Squelette `compromised_run` · seed 1504 · tirage 1 · signature `hybrid|compromised_run|rounds_for_time|4|sled_push:70m,run:900m`_

#### 74. 6 rounds · Run / Wall Balls

**Entrées** : Express · Hybrid · 45' · intention run · format EMOM · sans gilet

```
6 rounds for time (cap 54:30)
650 m Run
R1 · 38 Wall Balls (6/4 kg)
Pro 9/6 kg
R2 · 100 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R3 · 80 m Sled Push (100/75 kg)
Pro 125/100 kg
R4 · 700 m Row
R5 · 850 m SkiErg
R6 · 170 m Farmer Carry (20/16 kg)
Pro 24/16 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 43:24, cap 54:30.
```

Estimation : Women 43.4' (≈ 43:24) · Men 43.4' (≈ 43:24) · Women Pro 40.2' (≈ 40:12) · Men Pro 40.2' (≈ 40:12) · cap 54:30

_Squelette `run_into_station` · seed 1511 · tirage 3 · relâché : format · signature `hybrid|run_into_station|rounds_for_time|6|run:650m,wall_ball:reps,sandbag_lunge:100m,sled_push:80m,row:700m,ski_erg:850m,db_farmer_carry:170m`_

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

#### 78. 6 rounds · Run / Wall Balls

**Entrées** : Express · Hybrid · 45' · intention run · format Surprise · gilet optionnel

```
6 rounds for time (cap 51:30)
550 m Run
R1 · 50 Wall Balls (6/4 kg)
Pro 9/6 kg
R2 · 1000 m Row
R3 · 200 m Farmer Carry (20/16 kg)
Pro 24/16 kg
R4 · 1000 m SkiErg
R5 · 60 m Burpee Broad Jumps
R6 · 45 m Sled Pull (75/50 kg)
Pro 100/75 kg
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 40:56, cap 51:30.
```

Estimation : Women 40.9' (≈ 40:56) · Men 40.9' (≈ 40:56) · Women Pro 37.9' (≈ 37:55) · Men Pro 37.9' (≈ 37:55) · cap 51:30

_Squelette `run_into_station` · seed 1539 · tirage 4 · signature `hybrid|run_into_station|rounds_for_time|6|run:550m,wall_ball:reps,row:1000m,db_farmer_carry:200m,ski_erg:1000m,burpee_broad_jump:60m,sled_pull:45m`_

#### 79. 3 rounds · Farmer Carry / Sit-ups / Run

**Entrées** : Après la classe · Hybrid · 10' · intention run · format Surprise · sans gilet · WOD du jour : Back Squat, Thruster, Pull-ups

```
3 rounds for time (cap 12')
80 m Farmer Carry (20/16 kg)
Pro 24/16 kg
15 Sit-ups
200 m Run
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 9:21, cap 12'.
```

Estimation : Women 9.3' (≈ 9:21) · Men 9.3' (≈ 9:21) · Women Pro 8.7' (≈ 8:43) · Men Pro 8.7' (≈ 8:43) · cap 12:00

_Squelette `core_carry_finisher` · seed 1546 · tirage 56 · relâché : format, skeleton · signature `hybrid|core_carry_finisher|rounds_for_time|3|db_farmer_carry:80m,sit_up:reps,run:200m`_

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

#### 81. 5 rounds · Farmer Carry / Hollow Rocks / Bike Erg

**Entrées** : Express · Hybrid · 15' · intention core · format Surprise · sans gilet

```
5 rounds for time (cap 19')
80 m Farmer Carry (20/16 kg)
Pro 24/16 kg
20 Hollow Rocks
10 cal Bike Erg
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 14:54, cap 19'.
```

Estimation : Women 14.9' (≈ 14:54) · Men 14.9' (≈ 14:54) · Women Pro 13.9' (≈ 13:53) · Men Pro 13.9' (≈ 13:53) · cap 19:00

_Squelette `core_carry_finisher` · seed 1560 · tirage 1 · signature `hybrid|core_carry_finisher|rounds_for_time|5|db_farmer_carry:80m,hollow_rock:reps,bike_erg:10cal`_

#### 82. 6 rounds · Farmer Carry / Sit-ups / Run

**Entrées** : Express · Hybrid · 20' · intention core · format AMRAP · gilet optionnel

```
6 rounds for time (cap 23')
80 m Farmer Carry (20/16 kg)
Pro 24/16 kg
16 Sit-ups
100 m Run
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 18:05, cap 23'.
```

Estimation : Women 18.1' (≈ 18:05) · Men 18.1' (≈ 18:05) · Women Pro 16.9' (≈ 16:52) · Men Pro 16.9' (≈ 16:52) · cap 23:00

_Squelette `core_carry_finisher` · seed 1567 · tirage 1 · relâché : format · signature `hybrid|core_carry_finisher|rounds_for_time|6|db_farmer_carry:80m,sit_up:reps,run:100m`_

#### 83. Stations · Wall Balls / KB Swings Russian / SkiErg

**Entrées** : Express · Hybrid · 30' · intention core · format For time · gilet obligatoire

```
3 rounds × 5 stations · 90 s on / 30 s off
Station 1 · Wall Balls (6/4 kg) (max reps, cible 32)
Pro 9/6 kg
Station 2 · KB Swings Russian (20/16 kg) (max reps, cible 33)
Pro 24/16 kg
Station 3 · SkiErg (max cal, cible 20 cal)
Station 4 · Farmer Carry (20/16 kg) (max m, cible 100 m)
Pro 24/16 kg
Station 5 · Sandbag Lunges (30/20 kg) (max m, cible 40 m)
Pro 40/30 kg
Gilet lesté 9/6 kg
Stimulus : RPE 8.5 — Alternance jambes / épaules / mono, 90 s de travail max effort. Cible Men : 3 tours × 5 stations, 90 s on / 30 s off.
```

Estimation : Women 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Men 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Women Pro 30.0' (3 tours × 5 stations, 90 s on / 30 s off) · Men Pro 30.0' (3 tours × 5 stations, 90 s on / 30 s off)

_Squelette `stations_interval` · seed 1574 · tirage 2 · relâché : format, skeleton · signature `hybrid|stations_interval|stations|3|wall_ball:reps,kb_swing_russian:reps,ski_erg:20cal,db_farmer_carry:100m,sandbag_lunge:40m`_

#### 84. 6 rounds · Run / SkiErg

**Entrées** : Express · Hybrid · 45' · intention core · format EMOM · sans gilet

```
6 rounds for time (cap 55')
750 m Run
R1 · 500 m SkiErg
R2 · 25 m Burpee Broad Jumps
R3 · 100 m Sled Pull (75/50 kg)
Pro 100/75 kg
R4 · 60 m Sandbag Lunges (30/20 kg)
Pro 40/30 kg
R5 · 180 m Farmer Carry (20/16 kg)
Pro 24/16 kg
R6 · 35 Wall Balls (6/4 kg)
Pro 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 43:47, cap 55'.
```

Estimation : Women 43.8' (≈ 43:47) · Men 43.8' (≈ 43:47) · Women Pro 40.6' (≈ 40:34) · Men Pro 40.6' (≈ 40:34) · cap 55:00

_Squelette `run_into_station` · seed 1583 · tirage 4 · relâché : format, skeleton · signature `hybrid|run_into_station|rounds_for_time|6|run:750m,ski_erg:500m,burpee_broad_jump:25m,sled_pull:100m,sandbag_lunge:60m,db_farmer_carry:180m,wall_ball:reps`_

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
6 rounds for time (cap 25')
60 m Sandbag Carry (30/20 kg)
Pro 40/30 kg
60 s Plank Hold
100 m Shuttle Run
Gilet lesté 9/6 kg
Stimulus : RPE 6 — Posture et gainage, jamais à l'échec. Cible Men : ≈ 19:45, cap 25'.
```

Estimation : Women 19.8' (≈ 19:45) · Men 19.8' (≈ 19:45) · Women Pro 18.3' (≈ 18:20) · Men Pro 18.3' (≈ 18:20) · cap 25:00

_Squelette `core_carry_finisher` · seed 1595 · tirage 2 · relâché : format · signature `hybrid|core_carry_finisher|rounds_for_time|6|sandbag_carry:60m,plank_hold:s,shuttle_run:100m`_

#### 87. 4 rounds · Run / SkiErg

**Entrées** : Express · Hybrid · 30' · intention core · format Intervalles · sans gilet

```
4 rounds for time (cap 34')
550 m Run
R1 · 1000 m SkiErg
R2 · 60 m Burpee Broad Jumps
R3 · 100 m Sled Pull (75/50 kg)
Pro 100/75 kg
R4 · 60 m Sled Push (100/75 kg)
Pro 125/100 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 27:08, cap 34'.
```

Estimation : Women 27.1' (≈ 27:08) · Men 27.1' (≈ 27:08) · Women Pro 25.1' (≈ 25:07) · Men Pro 25.1' (≈ 25:07) · cap 34:00

_Squelette `run_into_station` · seed 1602 · tirage 4 · relâché : format, skeleton · signature `hybrid|run_into_station|rounds_for_time|4|run:550m,ski_erg:1000m,burpee_broad_jump:60m,sled_pull:100m,sled_push:60m`_

#### 88. 6 rounds · Run / SkiErg

**Entrées** : Express · Hybrid · 45' · intention core · format Surprise · gilet optionnel

```
6 rounds for time (cap 51:30)
650 m Run
R1 · 400 m SkiErg
R2 · 40 m Burpee Broad Jumps
R3 · 190 m Farmer Carry (20/16 kg)
Pro 24/16 kg
R4 · 22 Wall Balls (6/4 kg)
Pro 9/6 kg
R5 · 100 m Sled Pull (75/50 kg)
Pro 100/75 kg
R6 · 750 m Row
Gilet lesté optionnel 9/6 kg
Stimulus : RPE 8.5 — Allure course à 90 % du 5 km, stations sans pause. Cible Men : ≈ 40:54, cap 51:30.
```

Estimation : Women 40.9' (≈ 40:54) · Men 40.9' (≈ 40:54) · Women Pro 37.9' (≈ 37:55) · Men Pro 37.9' (≈ 37:55) · cap 51:30

_Squelette `run_into_station` · seed 1609 · tirage 2 · relâché : format, skeleton · signature `hybrid|run_into_station|rounds_for_time|6|run:650m,ski_erg:400m,burpee_broad_jump:40m,db_farmer_carry:190m,wall_ball:reps,sled_pull:100m,row:750m`_

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
