# Échantillons — Générateur Musculation V1 (M1)

Moteur `1.0.0` · banque musculation v1 · catalogue v2 (178 exercices).
5 séances par cible × objectif (matériel, niveau et durée variés, 1RM et poids de corps connus sur la 1re et la 5e), puis 10 « Après ma classe ».
Une combinaison absente est une cible indisponible avec ce matériel (sans matériel : Pull, Dos, Épaules, Bras — trop peu d’exercices poids du corps sur deux muscles distincts ; Force sans matériel exclue par le brief).

Cibles disponibles par matériel × niveau :

- Sans matériel · Débutant : toutes sauf Pull, Dos, Épaules, Bras
- Sans matériel · Intermédiaire : toutes sauf Pull, Dos, Épaules, Bras
- Sans matériel · Avancé : toutes sauf Pull, Dos, Épaules, Bras
- Box · Débutant : toutes
- Box · Intermédiaire : toutes
- Box · Avancé : toutes
- Salle · Débutant : toutes
- Salle · Intermédiaire : toutes
- Salle · Avancé : toutes

## Push

### #1 — Push · Hypertrophie · 20' · Salle · Intermédiaire

seed `1000` · squelette `push_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : optional_slot_empty, slots_dropped

```
Musculation · Push · Hypertrophie · 20' · Salle

Machine Incline Press — 3 × 12 — charge RPE 8 — repos 1:30
Machine Shoulder Press — 3 × 12 — charge RPE 8 — repos 1:15
Cable Pullover — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 19'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #2 — Push · Hypertrophie · 30' · Box · Avancé

seed `1001` · squelette `push_hypertrophie` · 1RM inconnus · relâchements : optional_slot_empty

```
Musculation · Push · Hypertrophie · 30' · Box

Push-ups — 4 × 10 — charge poids du corps — repos 1:30
Strict Press — 3 × 10 — charge RPE 8 — repos 1:15
DB Fly — 3 × 10 — charge RPE 8 — repos 1:15
Lateral Raise — 3 × 10 — charge RPE 8 — repos 1:15
One-Arm Overhead Triceps Extension — 3 × 10 / bras — charge RPE 8 — repos 1:15

Durée estimée 31'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #3 — Push · Hypertrophie · 45' · Sans matériel · Débutant

seed `1002` · squelette `push_hypertrophie` · 1RM inconnus · relâchements : beginner_max, optional_slot_empty, slot_muscle, slot_role

```
Musculation · Push · Hypertrophie · 45' · Sans matériel

Wide Push-Ups — 5 × 12 — charge poids du corps — repos 1:30
  tempo 3-1-1
Pike Push-Ups — 5 × 12 — charge poids du corps — repos 1:15
  tempo 3-1-1
Push-ups — 4 × 12 — charge poids du corps — repos 1:15
  tempo 3-1-1
Wall Triceps Extension — 4 × 20 — charge poids du corps — repos 1:15

Durée estimée 42'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #4 — Push · Hypertrophie · 60' · Salle · Débutant

seed `1003` · squelette `push_hypertrophie` · 1RM inconnus · relâchements : beginner_max, optional_slot_empty, rest_extended, tempo_311

```
Musculation · Push · Hypertrophie · 60' · Salle

DB Bench Press — 5 × 12 — charge RPE 8 — repos 2:00
  tempo 3-1-1
Pike Push-Ups — 5 × 12 — charge poids du corps — repos 1:45
  tempo 3-1-1
Low To High Cable Fly — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1
Lateral Raise — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1

Durée estimée 58'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #5 — Push · Hypertrophie · 20' · Box · Intermédiaire

seed `1004` · squelette `push_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : optional_slot_empty, slots_dropped

```
Musculation · Push · Hypertrophie · 20' · Box

Push-ups — 3 × 8 — charge poids du corps — repos 1:30
Strict Press — 3 × 8 @ 47.5 kg — charge 72 % 1RM — repos 1:15
DB Pullover — 3 × 8 — charge RPE 8 — repos 1:15
Lateral Raise — 3 × 8 — charge RPE 8 — repos 1:15

Durée estimée 21'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #6 — Push · Force · 20' · Salle · Intermédiaire

seed `1005` · squelette `push_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slots_dropped

```
Musculation · Push · Force · 20' · Salle

Incline Bench Press — 3 × 5 @ 55 kg — charge 82 % 1RM — repos 2:30
Strict Press — 3 × 5 @ 45 kg — charge 82 % 1RM — repos 2:30

Durée estimée 18'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Incline Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #7 — Push · Force · 30' · Box · Avancé

seed `1006` · squelette `push_force` · 1RM inconnus

```
Musculation · Push · Force · 30' · Box

Incline Bench Press — 4 × 3 — charge RPE 8 — repos 2:30
Strict Press — 4 × 3 — charge RPE 8 — repos 2:30
Close Grip Dips — 4 × 3 — lesté léger, RPE 8 — repos 2:00

Durée estimée 32'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Incline Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #8 — Push · Force · 45' · Box · Débutant

seed `1007` · squelette `push_force` · 1RM inconnus · relâchements : beginner_max, slot_role

```
Musculation · Push · Force · 45' · Box

Bench Press — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Strict Press — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Overhead Triceps Extension — 4 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Rear Delt Fly — 3 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 42'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #9 — Push · Force · 60' · Salle · Débutant

seed `1008` · squelette `push_force` · 1RM inconnus · relâchements : beginner_max, rest_extended, slot_role, tempo_311

```
Musculation · Push · Force · 60' · Salle

Bench Press — 5 × 5 — charge RPE 7 — repos 2:45
  monter jusqu'à une charge propre · tempo 3-1-1
Strict Press — 5 × 5 — charge RPE 7 — repos 2:45
  monter jusqu'à une charge propre · tempo 3-1-1
Cable Overhead Triceps Extension — 5 × 12 — charge RPE 8 — repos 1:30
  schéma hypertrophie · tempo 3-1-1
Rear Delt Machine — 5 × 12 — charge RPE 8 — repos 1:30
  schéma hypertrophie · tempo 3-1-1

Durée estimée 59'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #10 — Push · Force · 20' · Box · Intermédiaire

seed `1009` · squelette `push_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slots_dropped

```
Musculation · Push · Force · 20' · Box

Dips — 4 × 5 — lesté 10 kg (10 % du poids de corps), RPE 8 — repos 2:30
Strict Press — 3 × 5 @ 52.5 kg — charge 82 % 1RM — repos 2:30

Durée estimée 20'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Dips : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #11 — Push · Endurance musculaire · 20' · Salle · Intermédiaire

seed `1010` · squelette `push_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Push · Endurance musculaire · 20' · Salle

Machine Chest Press — 3 × 18 — charge RPE 7 — repos 40s
Upright Row — 3 × 18 — charge RPE 7 — repos 40s
Low To High Cable Fly — 3 × 18 — charge RPE 7 — repos 40s
Wall Triceps Extension — 3 × 18 — charge poids du corps — repos 40s

Durée estimée 19'
Stimulus : Rythme continu, aucune série à l'échec
```

### #12 — Push · Endurance musculaire · 30' · Box · Avancé

seed `1011` · squelette `push_endurance` · 1RM inconnus

```
Musculation · Push · Endurance musculaire · 30' · Box

Wall Push-Ups — 4 × 20 — charge poids du corps — repos 40s
DB Shoulder Press — 4 × 20 — charge RPE 7 — repos 40s
DB Fly — 3 × 20 — charge RPE 7 — repos 40s
DB Kickback — 3 × 20 / bras — charge RPE 7 — repos 40s
Lateral Raise — 3 × 20 — charge RPE 7 — repos 40s

Durée estimée 28'
Stimulus : Rythme continu, aucune série à l'échec
```

### #13 — Push · Endurance musculaire · 45' · Sans matériel · Débutant

seed `1012` · squelette `push_endurance` · 1RM inconnus · relâchements : optional_slot_empty, slot_role, tempo_311

```
Musculation · Push · Endurance musculaire · 45' · Sans matériel

Wide Push-Ups — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Pike Push-Ups — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Incline Push-Ups — 4 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Wall Triceps Extension — 5 × 20 — charge poids du corps — repos 40s

Durée estimée 42'
Stimulus : Rythme continu, aucune série à l'échec
```

### #14 — Push · Endurance musculaire · 60' · Salle · Débutant

seed `1013` · squelette `push_endurance` · 1RM inconnus · relâchements : beginner_max, rest_extended, tempo_311

```
Musculation · Push · Endurance musculaire · 60' · Salle

Bench Press — 5 × 20 — charge RPE 7 — repos 1:10
  monter jusqu'à une charge propre · tempo 3-1-1
Pike Push-Ups — 5 × 20 — charge poids du corps — repos 1:10
  tempo 3-1-1
DB Fly — 4 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1
Rope Triceps Pushdown — 5 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1

Durée estimée 55'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #15 — Push · Endurance musculaire · 20' · Box · Intermédiaire

seed `1014` · squelette `push_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Push · Endurance musculaire · 20' · Box

Push-ups — 3 × 18 — charge poids du corps — repos 40s
DB Shoulder Press — 3 × 18 — charge RPE 7 — repos 40s
DB Fly — 3 × 18 — charge RPE 7 — repos 40s
DB Kickback — 3 × 18 / bras — charge RPE 7 — repos 40s

Durée estimée 20'
Stimulus : Rythme continu, aucune série à l'échec
```

## Pull

### #16 — Pull · Hypertrophie · 30' · Salle · Intermédiaire

seed `1015` · squelette `pull_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : optional_slot_empty, slot_muscle

```
Musculation · Pull · Hypertrophie · 30' · Salle

Lat Pulldown — 4 × 10 — charge RPE 8 — repos 1:30
Yates Row — 3 × 10 @ 47.5 kg — charge 68 % 1RM — repos 1:15
Face Pull — 3 × 10 — charge RPE 8 — repos 1:15
Rope Hammer Curl — 3 × 10 — charge RPE 8 — repos 1:15
DB Shrug — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 30'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #17 — Pull · Hypertrophie · 45' · Box · Avancé

seed `1016` · squelette `pull_hypertrophie` · 1RM inconnus · relâchements : optional_slot_empty, slot_muscle

```
Musculation · Pull · Hypertrophie · 45' · Box

Close Grip Pull-Ups — 5 × 12 — charge poids du corps — repos 1:30
Yates Row — 4 × 12 — charge RPE 8 — repos 1:15
Rear Delt Fly — 4 × 12 — charge RPE 8 — repos 1:15
DB Curl — 4 × 12 / bras — charge RPE 8 — repos 1:15
Barbell Shrug — 4 × 12 — charge RPE 8 — repos 1:15

Durée estimée 42'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #18 — Pull · Hypertrophie · 60' · Box · Débutant

seed `1017` · squelette `pull_hypertrophie` · 1RM inconnus · relâchements : beginner_max, optional_slot_empty, rest_extended, slot_muscle, tempo_311

```
Musculation · Pull · Hypertrophie · 60' · Box

Deadlift — 5 × 12 — charge RPE 7 — repos 2:00
  monter jusqu'à une charge propre · tempo 3-1-1
Barbell Curl — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1
Rear Delt Fly — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1
Hammer Curl — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1

Durée estimée 58'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #19 — Pull · Hypertrophie · 20' · Salle · Débutant

seed `1018` · squelette `pull_hypertrophie` · 1RM inconnus · relâchements : beginner_max, optional_slot_empty, slot_muscle

```
Musculation · Pull · Hypertrophie · 20' · Salle

Converging Machine Pulldown — 3 × 8 — charge RPE 8 — repos 1:30
Preacher Barbell Curl — 3 × 8 — charge RPE 8 — repos 1:15
Face Pull — 3 × 8 — charge RPE 8 — repos 1:15
Cable Curl — 3 × 8 — charge RPE 8 — repos 1:15

Durée estimée 21'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #20 — Pull · Hypertrophie · 30' · Box · Intermédiaire

seed `1019` · squelette `pull_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : optional_slot_empty, slot_muscle

```
Musculation · Pull · Hypertrophie · 30' · Box

Deadlift — 4 × 10 @ 122.5 kg — charge 68 % 1RM — repos 1:30
Yates Row — 3 × 10 @ 60 kg — charge 68 % 1RM — repos 1:15
Bent Over Lateral Raise — 3 × 10 — charge RPE 8 — repos 1:15
Hammer Curl — 3 × 10 — charge RPE 8 — repos 1:15
Barbell Shrug — 3 × 10 @ 72.5 kg — charge 68 % 1RM — repos 1:15

Durée estimée 30'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #21 — Pull · Force · 30' · Salle · Intermédiaire

seed `1020` · squelette `pull_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : optional_slot_empty, slot_muscle

```
Musculation · Pull · Force · 30' · Salle

Deadlift — 4 × 3 @ 122.5 kg — charge 88 % 1RM — repos 2:30
Yates Row — 5 × 3 @ 62.5 kg — charge 88 % 1RM — repos 2:30
Cross-Body Hammer Curl — 3 × 8 / bras — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 32'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Deadlift : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #22 — Pull · Force · 45' · Box · Avancé

seed `1021` · squelette `pull_force` · 1RM inconnus · relâchements : optional_slot_empty, slot_muscle

```
Musculation · Pull · Force · 45' · Box

Neutral Grip Pull-Ups — 5 × 5 — lesté léger, RPE 8 — repos 2:30
Yates Row — 5 × 5 — charge RPE 8 — repos 2:30
DB Curl — 3 × 12 / bras — charge RPE 8 — repos 1:15
  schéma hypertrophie
Bent Over Lateral Raise — 3 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 41'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Neutral Grip Pull-Ups : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #23 — Pull · Force · 60' · Box · Débutant

seed `1022` · squelette `pull_force` · 1RM inconnus · relâchements : beginner_max, rest_extended, slot_muscle, slot_role, tempo_311

```
Musculation · Pull · Force · 60' · Box

Barbell Row — 5 × 5 — charge RPE 7 — repos 2:45
  monter jusqu'à une charge propre · tempo 3-1-1
Hammer Curl — 5 × 12 — charge RPE 8 — repos 1:45
  schéma hypertrophie · tempo 3-1-1
DB Shrug — 5 × 12 — charge RPE 8 — repos 1:30
  schéma hypertrophie · tempo 3-1-1
Barbell Curl — 5 × 12 — charge RPE 8 — repos 1:30
  schéma hypertrophie · tempo 3-1-1

Durée estimée 56'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Barbell Row : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #24 — Pull · Force · 20' · Salle · Débutant

seed `1023` · squelette `pull_force` · 1RM inconnus · relâchements : adjacent_muscle, beginner_max, slot_muscle, slot_role

```
Musculation · Pull · Force · 20' · Salle

Barbell Row — 4 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Machine Preacher Curl — 4 × 12 — charge RPE 8 — repos 1:30
  schéma hypertrophie

Durée estimée 20'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Barbell Row : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #25 — Pull · Force · 30' · Box · Intermédiaire

seed `1024` · squelette `pull_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : optional_slot_empty, slot_muscle

```
Musculation · Pull · Force · 30' · Box

Pendlay Row — 5 × 3 @ 80 kg — charge 88 % 1RM — repos 2:30
Yates Row — 5 × 3 @ 80 kg — charge 88 % 1RM — repos 2:30
Spider Curl — 3 × 8 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 33'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Pendlay Row : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #26 — Pull · Endurance musculaire · 30' · Salle · Intermédiaire

seed `1025` · squelette `pull_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_muscle

```
Musculation · Pull · Endurance musculaire · 30' · Salle

Supinated Lat Pulldown — 4 × 20 — charge RPE 7 — repos 40s
DB Shrug — 3 × 20 — charge RPE 7 — repos 40s
Face Pull — 3 × 20 — charge RPE 7 — repos 40s
Cross-Body Hammer Curl — 3 × 20 / bras — charge RPE 7 — repos 40s
Plank Hold — 3 × 60 s — repos 30s

Durée estimée 28'
Stimulus : Rythme continu, aucune série à l'échec
```

### #27 — Pull · Endurance musculaire · 45' · Box · Avancé

seed `1026` · squelette `pull_endurance` · 1RM inconnus · relâchements : bonus_slot, slot_muscle

```
Musculation · Pull · Endurance musculaire · 45' · Box

DB Row — 5 × 20 / bras — charge RPE 7 — repos 40s
Barbell Shrug — 5 × 20 — charge RPE 7 — repos 40s
Bent Over Lateral Raise — 5 × 20 — charge RPE 7 — repos 40s
Hammer Curl — 5 × 20 — charge RPE 7 — repos 40s
Farmer Carry — 5 × 50 m — charge RPE 7 — repos 30s
Rear Delt Fly — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 44'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #28 — Pull · Endurance musculaire · 60' · Box · Débutant

seed `1027` · squelette `pull_endurance` · 1RM inconnus · relâchements : beginner_max, rest_extended, slot_muscle, tempo_311

```
Musculation · Pull · Endurance musculaire · 60' · Box

Barbell Row — 5 × 20 — charge RPE 7 — repos 1:10
  monter jusqu'à une charge propre · tempo 3-1-1
DB Shrug — 5 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1
Rear Delt Fly — 5 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1
Hammer Curl — 5 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1

Durée estimée 58'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #29 — Pull · Endurance musculaire · 20' · Salle · Débutant

seed `1028` · squelette `pull_endurance` · 1RM inconnus · relâchements : beginner_max, slot_muscle

```
Musculation · Pull · Endurance musculaire · 20' · Salle

Ring Rows — 3 × 18 — charge poids du corps — repos 40s
Barbell Curl — 3 × 18 — charge RPE 7 — repos 40s
Rear Delt Machine — 3 × 18 — charge RPE 7 — repos 40s
Cable Curl — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 19'
Stimulus : Rythme continu, aucune série à l'échec
```

### #30 — Pull · Endurance musculaire · 30' · Box · Intermédiaire

seed `1029` · squelette `pull_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_muscle

```
Musculation · Pull · Endurance musculaire · 30' · Box

Barbell Row — 4 × 20 @ 47.5 kg — charge 52 % 1RM — repos 40s
Incline DB Curl — 4 × 12 — charge RPE 8 — repos 1:15
Bent Over Lateral Raise — 3 × 20 — charge RPE 7 — repos 40s
Hammer Curl — 3 × 20 — charge RPE 7 — repos 40s
Bird Dog — 3 × 16 — charge poids du corps — repos 30s

Durée estimée 28'
Stimulus : Rythme continu, aucune série à l'échec
```

## Jambes

### #31 — Jambes · Hypertrophie · 45' · Salle · Intermédiaire

seed `1030` · squelette `jambes_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Jambes · Hypertrophie · 45' · Salle

Leg Press — 4 × 12 — charge RPE 8 — repos 1:30
Romanian Deadlift — 4 × 12 @ 62.5 kg — charge 65 % 1RM — repos 1:15
Reverse Lunge — 4 × 16 — charge poids du corps — repos 1:15
Leg Extension — 3 × 12 — charge RPE 8 — repos 1:15
Leg Curl — 3 × 12 — charge RPE 8 — repos 1:15
Seated Calf Raise — 3 × 12 — charge RPE 8 — repos 45s

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #32 — Jambes · Hypertrophie · 60' · Box · Avancé

seed `1031` · squelette `jambes_hypertrophie` · 1RM inconnus · relâchements : slot_objective, slot_role

```
Musculation · Jambes · Hypertrophie · 60' · Box

Bulgarian Split Squat — 5 × 12 / jambe — charge RPE 8 — repos 1:30
Good Morning — 4 × 12 — charge RPE 8 — repos 1:15
Sumo Deadlift — 4 × 12 — charge RPE 8 — repos 1:15
Pistols — 4 × 12 / jambe — charge poids du corps — repos 1:15
Nordic Curl — 4 × 12 — charge poids du corps — repos 1:15
Calf Raise (bodyweight) — 4 × 20 — charge poids du corps — repos 45s

Durée estimée 56'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #33 — Jambes · Hypertrophie · 20' · Sans matériel · Débutant

seed `1032` · squelette `jambes_hypertrophie` · 1RM inconnus · relâchements : beginner_max, slot_muscle, slot_objective, slots_dropped

```
Musculation · Jambes · Hypertrophie · 20' · Sans matériel

Squat Hold — 3 × 30 s — repos 1:30
Reverse Lunge — 3 × 10 — charge poids du corps — repos 1:15
  tempo 3-1-1
Air Squats — 3 × 15 — charge poids du corps — repos 1:15
  tempo 3-1-1

Durée estimée 20'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #34 — Jambes · Hypertrophie · 30' · Salle · Débutant

seed `1033` · squelette `jambes_hypertrophie` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Jambes · Hypertrophie · 30' · Salle

Leg Press — 4 × 12 — charge RPE 8 — repos 1:30
DB Romanian Deadlift — 4 × 12 — charge RPE 8 — repos 1:15
Reverse Lunge — 3 × 16 — charge poids du corps — repos 1:15
Leg Extension — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 29'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #35 — Jambes · Hypertrophie · 45' · Box · Intermédiaire

seed `1034` · squelette `jambes_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_objective, slot_role

```
Musculation · Jambes · Hypertrophie · 45' · Box

DB Lunges — 4 × 12 / jambe — charge RPE 8 — repos 1:30
Good Morning — 3 × 12 — charge RPE 8 — repos 1:15
DB Reverse Lunge — 3 × 12 / jambe — charge RPE 8 — repos 1:15
Bulgarian Split Squat — 3 × 12 / jambe — charge RPE 8 — repos 1:15
DB Romanian Deadlift — 3 × 12 — charge RPE 8 — repos 1:15
Calf Raise (bodyweight) — 3 × 20 — charge poids du corps — repos 45s

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #36 — Jambes · Force · 45' · Salle · Intermédiaire

seed `1035` · squelette `jambes_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Jambes · Force · 45' · Salle

Leg Press — 5 × 4 — charge RPE 8 — repos 2:30
Hip Thrust Machine — 5 × 4 — charge RPE 8 — repos 2:30
Front Squat — 4 × 4 @ 80 kg — charge 85 % 1RM — repos 2:00
Leg Curl — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Seated Calf Raise — 3 × 10 — charge RPE 8 — repos 45s
  schéma hypertrophie

Durée estimée 47'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Leg Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #37 — Jambes · Force · 60' · Box · Avancé

seed `1036` · squelette `jambes_force` · 1RM inconnus · relâchements : slot_objective

```
Musculation · Jambes · Force · 60' · Box

Back Squat — 5 × 5 — charge RPE 8 — repos 2:30
Sumo Deadlift — 5 × 5 — charge RPE 8 — repos 2:30
Front Squat — 4 × 5 — charge RPE 8 — repos 2:00
Nordic Curl — 4 × 12 — charge poids du corps — repos 1:15
  schéma hypertrophie
Calf Raise (bodyweight) — 4 × 20 — charge poids du corps — repos 45s
  schéma hypertrophie

Durée estimée 55'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #38 — Jambes · Force · 20' · Box · Débutant

seed `1037` · squelette `jambes_force` · 1RM inconnus · relâchements : beginner_max, slot_objective

```
Musculation · Jambes · Force · 20' · Box

Back Squat — 3 × 3 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Romanian Deadlift — 4 × 3 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre

Durée estimée 20'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #39 — Jambes · Force · 30' · Salle · Débutant

seed `1038` · squelette `jambes_force` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Jambes · Force · 30' · Salle

Back Squat — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Hip Thrust — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre

Durée estimée 29'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #40 — Jambes · Force · 45' · Box · Intermédiaire

seed `1039` · squelette `jambes_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_objective, slot_role

```
Musculation · Jambes · Force · 45' · Box

Back Squat — 5 × 4 @ 120 kg — charge 85 % 1RM — repos 2:30
Hip Thrust — 5 × 4 @ 162.5 kg — charge 85 % 1RM — repos 2:30
Front Squat — 4 × 4 @ 100 kg — charge 85 % 1RM — repos 2:00
Romanian Deadlift — 4 × 4 @ 107.5 kg — charge 85 % 1RM — repos 2:00

Durée estimée 49'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #41 — Jambes · Endurance musculaire · 45' · Salle · Intermédiaire

seed `1040` · squelette `jambes_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Jambes · Endurance musculaire · 45' · Salle

Back Squat — 5 × 20 @ 57.5 kg — charge 52 % 1RM — repos 40s
Single-Leg Hip Thrust — 5 × 20 / jambe — charge poids du corps — repos 40s
Leg Extension — 4 × 20 — charge RPE 7 — repos 40s
Standing Calf Raise — 4 × 20 — charge RPE 7 — repos 40s
Mountain Climbers — 4 × 20 — charge poids du corps — repos 30s

Durée estimée 41'
Stimulus : Rythme continu, aucune série à l'échec
```

### #42 — Jambes · Endurance musculaire · 60' · Box · Avancé

seed `1041` · squelette `jambes_endurance` · 1RM inconnus · relâchements : bonus_slot

```
Musculation · Jambes · Endurance musculaire · 60' · Box

Box Step-ups — 5 × 20 / jambe — charge RPE 7 — repos 40s
Single-Leg RDL (bodyweight) — 5 × 20 / jambe — charge poids du corps — repos 40s
Banded Hip Abduction — 5 × 20 — charge poids du corps — repos 40s
Calf Raise (bodyweight) — 5 × 20 — charge poids du corps — repos 40s
Plank Hold — 5 × 60 s — repos 30s
Squat Hold — 4 × 60 s — repos 40s

Durée estimée 55'
Stimulus : Rythme continu, aucune série à l'échec
```

### #43 — Jambes · Endurance musculaire · 20' · Sans matériel · Débutant

seed `1042` · squelette `jambes_endurance` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Jambes · Endurance musculaire · 20' · Sans matériel

Air Squats — 4 × 20 — charge poids du corps — repos 40s
Reverse Lunge — 3 × 24 — charge poids du corps — repos 40s
Squat Hold — 3 × 60 s — repos 40s
Calf Raise (bodyweight) — 3 × 20 — charge poids du corps — repos 40s

Durée estimée 19'
Stimulus : Rythme continu, aucune série à l'échec
```

### #44 — Jambes · Endurance musculaire · 30' · Salle · Débutant

seed `1043` · squelette `jambes_endurance` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Jambes · Endurance musculaire · 30' · Salle

Goblet Squat — 5 × 20 — charge RPE 7 — repos 40s
DB Hip Thrust — 4 × 20 — charge RPE 7 — repos 40s
Squat Hold — 4 × 60 s — repos 40s
Seated Calf Raise — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 28'
Stimulus : Rythme continu, aucune série à l'échec
```

### #45 — Jambes · Endurance musculaire · 45' · Box · Intermédiaire

seed `1044` · squelette `jambes_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Jambes · Endurance musculaire · 45' · Box

DB Lunges — 5 × 20 / jambe — charge RPE 7 — repos 40s
DB Romanian Deadlift — 5 × 20 — charge RPE 7 — repos 40s
Glute Bridge — 5 × 20 — charge poids du corps — repos 40s
Calf Raise (bodyweight) — 5 × 20 — charge poids du corps — repos 40s
Reverse Crunch — 4 × 20 — charge poids du corps — repos 30s

Durée estimée 41'
Stimulus : Rythme continu, aucune série à l'échec
```

## Bas du corps

### #46 — Bas du corps · Hypertrophie · 60' · Salle · Intermédiaire

seed `1045` · squelette `bas_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Bas du corps · Hypertrophie · 60' · Salle

DB Lunges — 5 × 12 / jambe — charge RPE 8 — repos 1:30
Sumo Deadlift — 5 × 12 @ 90 kg — charge 65 % 1RM — repos 1:15
Romanian Deadlift — 5 × 12 @ 62.5 kg — charge 65 % 1RM — repos 1:15
Glute Kickback (câble) — 4 × 12 / jambe — charge RPE 8 — repos 1:15
Leg Curl — 4 × 12 — charge RPE 8 — repos 1:15
Cable Crunch — 4 × 12 — charge RPE 8 — repos 1:00

Durée estimée 55'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #47 — Bas du corps · Hypertrophie · 20' · Box · Avancé

seed `1046` · squelette `bas_hypertrophie` · 1RM inconnus · relâchements : slots_dropped

```
Musculation · Bas du corps · Hypertrophie · 20' · Box

DB Lunges — 3 × 10 / jambe — charge RPE 8 — repos 1:30
Sumo Deadlift — 3 × 10 — charge RPE 8 — repos 1:15
Romanian Deadlift — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 19'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #48 — Bas du corps · Hypertrophie · 30' · Sans matériel · Débutant

seed `1047` · squelette `bas_hypertrophie` · 1RM inconnus · relâchements : beginner_max, optional_slot_empty, slot_muscle, slot_objective

```
Musculation · Bas du corps · Hypertrophie · 30' · Sans matériel

Wall Sit — 4 × 45 s — repos 1:30
Reverse Lunge — 3 × 13 — charge poids du corps — repos 1:15
  tempo 3-1-1
Superman Hold — 3 × 45 s — repos 1:15
Glute Bridge — 3 × 13 — charge poids du corps — repos 1:15

Durée estimée 28'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #49 — Bas du corps · Hypertrophie · 45' · Salle · Débutant

seed `1048` · squelette `bas_hypertrophie` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Bas du corps · Hypertrophie · 45' · Salle

Back Squat — 5 × 12 — charge RPE 7 — repos 1:30
  monter jusqu'à une charge propre
DB Hip Thrust — 5 × 12 — charge RPE 8 — repos 1:15
DB Romanian Deadlift — 5 × 12 — charge RPE 8 — repos 1:15
Leg Extension — 5 × 12 — charge RPE 8 — repos 1:15

Durée estimée 42'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #50 — Bas du corps · Hypertrophie · 60' · Box · Intermédiaire

seed `1049` · squelette `bas_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_role

```
Musculation · Bas du corps · Hypertrophie · 60' · Box

Bulgarian Split Squat — 4 × 12 / jambe — charge RPE 8 — repos 1:30
High Box Step-Up — 4 × 12 / jambe — charge RPE 8 — repos 1:15
Good Morning — 4 × 12 — charge RPE 8 — repos 1:15
Single-Leg Glute Bridge — 4 × 12 / jambe — charge poids du corps — repos 1:15
Romanian Deadlift — 4 × 12 @ 82.5 kg — charge 65 % 1RM — repos 1:15
Back Extension — 4 × 12 — charge poids du corps — repos 1:00

Durée estimée 55'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #51 — Bas du corps · Force · 60' · Salle · Intermédiaire

seed `1050` · squelette `bas_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Bas du corps · Force · 60' · Salle

Leg Press — 5 × 5 — charge RPE 8 — repos 2:30
Romanian Deadlift — 5 × 5 @ 80 kg — charge 82 % 1RM — repos 2:00
Sumo Deadlift — 5 × 5 @ 115 kg — charge 82 % 1RM — repos 2:00
Leg Extension — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Back Extension — 4 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie

Durée estimée 55'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Leg Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #52 — Bas du corps · Force · 20' · Box · Avancé

seed `1051` · squelette `bas_force` · 1RM inconnus · relâchements : slot_role, slots_dropped

```
Musculation · Bas du corps · Force · 20' · Box

Front Squat — 4 × 5 — charge RPE 8 — repos 2:30
Romanian Deadlift — 3 × 5 — charge RPE 8 — repos 2:00

Durée estimée 20'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Front Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #53 — Bas du corps · Force · 30' · Box · Débutant

seed `1052` · squelette `bas_force` · 1RM inconnus · relâchements : beginner_max, slot_objective

```
Musculation · Bas du corps · Force · 30' · Box

Back Squat — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Romanian Deadlift — 4 × 4 — charge RPE 7 — repos 2:00
  monter jusqu'à une charge propre
Air Squats — 3 × 18 — charge poids du corps — repos 1:15
  schéma hypertrophie

Durée estimée 30'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #54 — Bas du corps · Force · 45' · Salle · Débutant

seed `1053` · squelette `bas_force` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Bas du corps · Force · 45' · Salle

Back Squat — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Romanian Deadlift — 4 × 5 — charge RPE 7 — repos 2:00
  monter jusqu'à une charge propre
Hip Thrust Machine — 4 × 5 — charge RPE 8 — repos 2:00
Leg Extension — 4 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 42'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #55 — Bas du corps · Force · 60' · Box · Intermédiaire

seed `1054` · squelette `bas_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_role

```
Musculation · Bas du corps · Force · 60' · Box

Back Squat — 5 × 5 @ 115 kg — charge 82 % 1RM — repos 2:30
Romanian Deadlift — 5 × 5 @ 102.5 kg — charge 82 % 1RM — repos 2:00
Sumo Deadlift — 4 × 5 @ 147.5 kg — charge 82 % 1RM — repos 2:00
Front Squat — 4 × 5 @ 97.5 kg — charge 82 % 1RM — repos 2:00
Back Extension — 4 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie

Durée estimée 54'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #56 — Bas du corps · Endurance musculaire · 60' · Salle · Intermédiaire

seed `1055` · squelette `bas_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : bonus_slot, tempo_311

```
Musculation · Bas du corps · Endurance musculaire · 60' · Salle

Goblet Squat — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Hip Thrust — 5 × 20 @ 77.5 kg — charge 52 % 1RM — repos 40s
  tempo 3-1-1
Leg Curl — 5 × 20 — charge RPE 7 — repos 40s
Dead Bug — 5 × 20 — charge poids du corps — repos 30s
Calf Raise (bodyweight) — 5 × 20 — charge poids du corps — repos 40s
Superman Hold — 5 × 60 s — repos 40s

Durée estimée 56'
Stimulus : Rythme continu, aucune série à l'échec
```

### #57 — Bas du corps · Endurance musculaire · 20' · Box · Avancé

seed `1056` · squelette `bas_endurance` · 1RM inconnus · relâchements : slot_role

```
Musculation · Bas du corps · Endurance musculaire · 20' · Box

Lunges — 3 × 18 / jambe — charge poids du corps — repos 40s
DB Hip Thrust — 3 × 18 — charge RPE 7 — repos 40s
DB Romanian Deadlift — 3 × 18 — charge RPE 7 — repos 40s
Crunch — 3 × 18 — charge poids du corps — repos 30s

Durée estimée 20'
Stimulus : Rythme continu, aucune série à l'échec
```

### #58 — Bas du corps · Endurance musculaire · 30' · Sans matériel · Débutant

seed `1057` · squelette `bas_endurance` · 1RM inconnus · relâchements : beginner_max, slot_muscle, tempo_311

```
Musculation · Bas du corps · Endurance musculaire · 30' · Sans matériel

Air Squats — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Reverse Lunge — 5 × 24 — charge poids du corps — repos 40s
Squat Hold — 4 × 60 s — repos 40s
AbMat Crunch — 5 × 20 — charge poids du corps — repos 30s

Durée estimée 32'
Stimulus : Rythme continu, aucune série à l'échec
```

### #59 — Bas du corps · Endurance musculaire · 45' · Salle · Débutant

seed `1058` · squelette `bas_endurance` · 1RM inconnus · relâchements : beginner_max, tempo_311

```
Musculation · Bas du corps · Endurance musculaire · 45' · Salle

Air Squats — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Hip Thrust Machine — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Leg Curl — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Machine Crunch — 5 × 20 — charge RPE 7 — repos 30s

Durée estimée 42'
Stimulus : Rythme continu, aucune série à l'échec
```

### #60 — Bas du corps · Endurance musculaire · 60' · Box · Intermédiaire

seed `1059` · squelette `bas_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : bonus_slot, slot_role

```
Musculation · Bas du corps · Endurance musculaire · 60' · Box

Box Step-ups — 5 × 20 / jambe — charge RPE 7 — repos 40s
DB Sumo Squat — 5 × 20 — charge RPE 7 — repos 40s
Single-Leg RDL (bodyweight) — 5 × 20 / jambe — charge poids du corps — repos 40s
Hollow Hold — 5 × 60 s — repos 30s
Calf Raise (bodyweight) — 5 × 20 — charge poids du corps — repos 40s
Squat Hold — 3 × 45 s — repos 40s

Durée estimée 54'
Stimulus : Rythme continu, aucune série à l'échec
```

## Full body

### #61 — Full body · Hypertrophie · 20' · Salle · Intermédiaire

seed `1060` · squelette `full_body_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slots_dropped

```
Musculation · Full body · Hypertrophie · 20' · Salle

Hack Squat — 3 × 12 — charge RPE 8 — repos 1:30
Wide Push-Ups — 3 × 12 — charge poids du corps — repos 1:30
Supinated Lat Pulldown — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 19'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #62 — Full body · Hypertrophie · 30' · Box · Avancé

seed `1061` · squelette `full_body_hypertrophie` · 1RM inconnus

```
Musculation · Full body · Hypertrophie · 30' · Box

Pistols — 4 × 10 / jambe — charge poids du corps — repos 1:30
Decline Push-Ups — 4 × 10 — charge poids du corps — repos 1:30
Supinated Barbell Row — 3 × 10 — charge RPE 8 — repos 1:15
Romanian Deadlift — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 30'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #63 — Full body · Hypertrophie · 45' · Sans matériel · Débutant

seed `1062` · squelette `full_body_hypertrophie` · 1RM inconnus · relâchements : beginner_max, slot_muscle, slot_objective, slot_role

```
Musculation · Full body · Hypertrophie · 45' · Sans matériel

Squat Hold — 5 × 60 s — repos 1:30
Wide Push-Ups — 4 × 12 — charge poids du corps — repos 1:30
  tempo 3-1-1
Reverse Lunge — 4 × 16 — charge poids du corps — repos 1:15
  tempo 3-1-1
Incline Push-Ups — 4 × 12 — charge poids du corps — repos 1:15
  tempo 3-1-1

Durée estimée 42'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #64 — Full body · Hypertrophie · 60' · Salle · Débutant

seed `1063` · squelette `full_body_hypertrophie` · 1RM inconnus · relâchements : beginner_max, rest_extended, tempo_311

```
Musculation · Full body · Hypertrophie · 60' · Salle

Back Squat — 5 × 12 — charge RPE 7 — repos 1:45
  monter jusqu'à une charge propre · tempo 3-1-1
Machine Chest Press — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1
Chest Supported Row — 5 × 12 — charge RPE 8 — repos 1:30
  tempo 3-1-1
Reverse Lunge — 5 × 16 — charge poids du corps — repos 1:30
  tempo 3-1-1

Durée estimée 56'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #65 — Full body · Hypertrophie · 20' · Box · Intermédiaire

seed `1064` · squelette `full_body_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slots_dropped

```
Musculation · Full body · Hypertrophie · 20' · Box

Bulgarian Split Squat — 3 × 8 / jambe — charge RPE 8 — repos 1:30
Push-ups — 3 × 8 — charge poids du corps — repos 1:30
Pendlay Row — 3 × 8 @ 65 kg — charge 72 % 1RM — repos 1:15

Durée estimée 18'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #66 — Full body · Force · 20' · Salle · Intermédiaire

seed `1065` · squelette `full_body_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slots_dropped

```
Musculation · Full body · Force · 20' · Salle

Leg Press — 4 × 5 — charge RPE 8 — repos 2:30
Incline Bench Press — 3 × 5 @ 55 kg — charge 82 % 1RM — repos 2:30

Durée estimée 21'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Leg Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #67 — Full body · Force · 30' · Box · Avancé

seed `1066` · squelette `full_body_force` · 1RM inconnus

```
Musculation · Full body · Force · 30' · Box

Front Squat — 3 × 3 — charge RPE 8 — repos 2:30
Bench Press — 4 × 3 — charge RPE 8 — repos 2:30
Rack Pull — 4 × 3 — charge RPE 8 — repos 2:30

Durée estimée 32'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Front Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #68 — Full body · Force · 45' · Box · Débutant

seed `1067` · squelette `full_body_force` · 1RM inconnus

```
Musculation · Full body · Force · 45' · Box

Back Squat — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Bench Press — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Barbell Row — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre

Durée estimée 43'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #69 — Full body · Force · 60' · Salle · Débutant

seed `1068` · squelette `full_body_force` · 1RM inconnus

```
Musculation · Full body · Force · 60' · Salle

Back Squat — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Bench Press — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Barbell Row — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Romanian Deadlift — 5 × 5 — charge RPE 7 — repos 2:00
  monter jusqu'à une charge propre

Durée estimée 56'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #70 — Full body · Force · 20' · Box · Intermédiaire

seed `1069` · squelette `full_body_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slots_dropped

```
Musculation · Full body · Force · 20' · Box

Back Squat — 3 × 4 @ 120 kg — charge 85 % 1RM — repos 2:30
Incline Bench Press — 3 × 4 @ 72.5 kg — charge 85 % 1RM — repos 2:30

Durée estimée 18'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Back Squat : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #71 — Full body · Endurance musculaire · 20' · Salle · Intermédiaire

seed `1070` · squelette `full_body_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Full body · Endurance musculaire · 20' · Salle

DB Reverse Lunge — 3 × 15 / jambe — charge RPE 7 — repos 40s
DB Bench Press — 3 × 15 — charge RPE 7 — repos 40s
Strict Pull-Ups — 3 × 15 — charge poids du corps — repos 40s
Romanian Deadlift — 3 × 15 @ 60 kg — charge 60 % 1RM — repos 40s

Durée estimée 20'
Stimulus : Rythme continu, aucune série à l'échec
```

### #72 — Full body · Endurance musculaire · 30' · Box · Avancé

seed `1071` · squelette `full_body_endurance` · 1RM inconnus

```
Musculation · Full body · Endurance musculaire · 30' · Box

DB Sumo Squat — 3 × 18 — charge RPE 7 — repos 40s
Incline DB Press — 3 × 18 — charge RPE 7 — repos 40s
Barbell Row — 3 × 18 — charge RPE 7 — repos 40s
Single-Leg RDL (bodyweight) — 3 × 18 / jambe — charge poids du corps — repos 40s
Bird Dog — 3 × 13 — charge poids du corps — repos 30s

Durée estimée 28'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #73 — Full body · Endurance musculaire · 45' · Sans matériel · Débutant

seed `1072` · squelette `full_body_endurance` · 1RM inconnus · relâchements : beginner_max, slot_muscle, tempo_311

```
Musculation · Full body · Endurance musculaire · 45' · Sans matériel

Air Squats — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Push-ups — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Reverse Lunge — 5 × 24 — charge poids du corps — repos 40s
  tempo 3-1-1
Incline Push-Ups — 4 × 20 — charge poids du corps — repos 40s

Durée estimée 43'
Stimulus : Rythme continu, aucune série à l'échec
```

### #74 — Full body · Endurance musculaire · 60' · Salle · Débutant

seed `1073` · squelette `full_body_endurance` · 1RM inconnus · relâchements : beginner_max, rest_extended, tempo_311

```
Musculation · Full body · Endurance musculaire · 60' · Salle

Hip Thrust — 5 × 20 — charge RPE 7 — repos 1:10
  monter jusqu'à une charge propre · tempo 3-1-1
DB Bench Press — 5 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1
Ring Rows — 5 × 20 — charge poids du corps — repos 1:10
  tempo 3-1-1
DB Hip Thrust — 4 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1

Durée estimée 56'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #75 — Full body · Endurance musculaire · 20' · Box · Intermédiaire

seed `1074` · squelette `full_body_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Full body · Endurance musculaire · 20' · Box

Bulgarian Split Squat — 3 × 15 / jambe — charge RPE 7 — repos 40s
Push-ups — 3 × 15 — charge poids du corps — repos 40s
Neutral Grip Pull-Ups — 3 × 15 — charge poids du corps — repos 40s
DB Romanian Deadlift — 3 × 15 — charge RPE 7 — repos 40s

Durée estimée 20'
Stimulus : Rythme continu, aucune série à l'échec
```

## Tronc

### #76 — Tronc · Hypertrophie · 30' · Salle · Intermédiaire

seed `1075` · squelette `tronc_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_objective

```
Musculation · Tronc · Hypertrophie · 30' · Salle

Machine Crunch — 4 × 12 — charge RPE 8 — repos 1:00
Oblique Crunch — 4 × 20 / côté — charge poids du corps — repos 1:00
Back Extension — 4 × 12 — charge poids du corps — repos 1:00
Hanging Leg Raise — 3 × 12 — charge poids du corps — repos 1:00

Durée estimée 27'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #77 — Tronc · Hypertrophie · 45' · Box · Avancé

seed `1076` · squelette `tronc_hypertrophie` · 1RM inconnus · relâchements : bonus_slot, slot_objective

```
Musculation · Tronc · Hypertrophie · 45' · Box

Ab Wheel Rollout — 5 × 12 — charge poids du corps — repos 1:00
Hanging Oblique Knee Raise — 5 × 20 / côté — charge poids du corps — repos 1:00
Back Extension — 5 × 12 — charge poids du corps — repos 1:00
Hanging Leg Raise — 5 × 12 — charge poids du corps — repos 1:00
Back Squat — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 44'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #78 — Tronc · Hypertrophie · 60' · Sans matériel · Débutant

seed `1077` · squelette `tronc_hypertrophie` · 1RM inconnus · relâchements : rest_extended, slot_objective, tempo_311

```
Musculation · Tronc · Hypertrophie · 60' · Sans matériel

Reverse Crunch — 5 × 12 — charge poids du corps — repos 1:30
  tempo 3-1-1
Standing Broomstick Rotation — 5 × 20 — charge poids du corps — repos 1:30
  tempo 3-1-1
Superman Hold — 5 × 60 s — repos 1:30
AbMat Crunch — 5 × 20 — charge poids du corps — repos 1:30
  tempo 3-1-1

Durée estimée 57'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #79 — Tronc · Hypertrophie · 20' · Salle · Débutant

seed `1078` · squelette `tronc_hypertrophie` · 1RM inconnus · relâchements : slot_objective

```
Musculation · Tronc · Hypertrophie · 20' · Salle

Swiss Ball Crunch — 3 × 12 — charge poids du corps — repos 1:00
Standing Broomstick Rotation — 3 × 20 — charge poids du corps — repos 1:00
Back Extension — 3 × 12 — charge poids du corps — repos 1:00
Cable Crunch — 3 × 12 — charge RPE 8 — repos 1:00

Durée estimée 18'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #80 — Tronc · Hypertrophie · 30' · Box · Intermédiaire

seed `1079` · squelette `tronc_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_objective

```
Musculation · Tronc · Hypertrophie · 30' · Box

Hanging Leg Raise — 4 × 12 — charge poids du corps — repos 1:00
Oblique Raise On Roman Chair — 4 × 20 / côté — charge poids du corps — repos 1:00
Back Extension — 3 × 12 — charge poids du corps — repos 1:00
Reverse Crunch — 3 × 12 — charge poids du corps — repos 1:00

Durée estimée 28'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #81 — Tronc · Force · 30' · Salle · Intermédiaire

seed `1080` · squelette `tronc_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_objective

```
Musculation · Tronc · Force · 30' · Salle

Swiss Ball Crunch — 4 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie
DB Side Bend — 4 × 20 / côté — charge RPE 8 — repos 1:00
  schéma hypertrophie
Back Extension — 4 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie
Ab Wheel Rollout — 3 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie

Durée estimée 28'
Stimulus : RIR 2, dernière série RPE 9
```

### #82 — Tronc · Force · 45' · Box · Avancé

seed `1081` · squelette `tronc_force` · 1RM inconnus · relâchements : bonus_slot, slot_objective

```
Musculation · Tronc · Force · 45' · Box

Hanging Leg Raise — 5 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie
DB Side Bend — 5 × 20 / côté — charge RPE 8 — repos 1:00
  schéma hypertrophie
Back Extension — 5 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie
Ab Wheel Rollout — 5 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie
Back Squat — 4 × 4 — charge RPE 8 — repos 2:00

Durée estimée 48'
Stimulus : RIR 2, dernière série RPE 9. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #83 — Tronc · Force · 60' · Box · Débutant

seed `1082` · squelette `tronc_force` · 1RM inconnus · relâchements : rest_extended, slot_objective, tempo_311

```
Musculation · Tronc · Force · 60' · Box

Reverse Crunch — 5 × 12 — charge poids du corps — repos 1:30
  schéma hypertrophie · tempo 3-1-1
Crunch With Rotation — 5 × 20 — charge poids du corps — repos 1:30
  schéma hypertrophie · tempo 3-1-1
Back Extension — 5 × 12 — charge poids du corps — repos 1:30
  schéma hypertrophie · tempo 3-1-1
Crunch — 5 × 20 — charge poids du corps — repos 1:30
  schéma hypertrophie · tempo 3-1-1

Durée estimée 57'
Stimulus : RIR 2, dernière série RPE 9
```

### #84 — Tronc · Force · 20' · Salle · Débutant

seed `1083` · squelette `tronc_force` · 1RM inconnus · relâchements : slot_objective

```
Musculation · Tronc · Force · 20' · Salle

Machine Crunch — 3 × 10 — charge RPE 8 — repos 1:00
  schéma hypertrophie
Crunch With Rotation — 3 × 18 — charge poids du corps — repos 1:00
  schéma hypertrophie
Back Extension — 3 × 10 — charge poids du corps — repos 1:00
  schéma hypertrophie
Cable Crunch — 3 × 10 — charge RPE 8 — repos 1:00
  schéma hypertrophie

Durée estimée 18'
Stimulus : RIR 2, dernière série RPE 9
```

### #85 — Tronc · Force · 30' · Box · Intermédiaire

seed `1084` · squelette `tronc_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_objective

```
Musculation · Tronc · Force · 30' · Box

Hanging Leg Raise — 4 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie
Oblique Raise On Roman Chair — 4 × 20 / côté — charge poids du corps — repos 1:00
  schéma hypertrophie
Back Extension — 3 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie
Reverse Crunch — 3 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie

Durée estimée 28'
Stimulus : RIR 2, dernière série RPE 9
```

### #86 — Tronc · Endurance musculaire · 30' · Salle · Intermédiaire

seed `1085` · squelette `tronc_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Tronc · Endurance musculaire · 30' · Salle

Pallof Press — 4 × 20 / côté — charge RPE 7 — repos 30s
Crunch With Rotation — 4 × 20 — charge poids du corps — repos 30s
Suitcase Carry — 4 × 50 m / côté — charge RPE 7 — repos 30s
Back Extension — 3 × 20 — charge poids du corps — repos 30s

Durée estimée 29'
Stimulus : Rythme continu, aucune série à l'échec
```

### #87 — Tronc · Endurance musculaire · 45' · Box · Avancé

seed `1086` · squelette `tronc_endurance` · 1RM inconnus · relâchements : bonus_slot

```
Musculation · Tronc · Endurance musculaire · 45' · Box

Ab Wheel Rollout — 5 × 20 — charge poids du corps — repos 30s
Crunch With Rotation — 5 × 20 — charge poids du corps — repos 30s
Farmer Carry — 4 × 50 m — charge RPE 7 — repos 30s
Back Extension — 5 × 20 — charge poids du corps — repos 30s
Hanging Oblique Knee Raise — 4 × 20 / côté — charge poids du corps — repos 40s
Superman Hold — 3 × 45 s — repos 40s

Durée estimée 41'
Stimulus : Rythme continu, aucune série à l'échec
```

### #88 — Tronc · Endurance musculaire · 60' · Sans matériel · Débutant

seed `1087` · squelette `tronc_endurance` · 1RM inconnus · relâchements : beginner_fifth, rest_extended, slot_ids, tempo_311

```
Musculation · Tronc · Endurance musculaire · 60' · Sans matériel

Stomach Vacuum — 5 × 60 s — repos 1:15
Standing Broomstick Rotation — 5 × 20 — charge poids du corps — repos 1:15
  tempo 3-1-1
Reverse Crunch — 4 × 20 — charge poids du corps — repos 1:15
  tempo 3-1-1
Superman Hold — 5 × 60 s — repos 1:15
Crunch With Rotation — 4 × 20 — charge poids du corps — repos 40s

Durée estimée 55'
Stimulus : Rythme continu, aucune série à l'échec
```

### #89 — Tronc · Endurance musculaire · 20' · Salle · Débutant

seed `1088` · squelette `tronc_endurance` · 1RM inconnus

```
Musculation · Tronc · Endurance musculaire · 20' · Salle

Plank Hold — 4 × 60 s — repos 30s
Crunch With Rotation — 3 × 20 — charge poids du corps — repos 30s
Farmer Carry — 3 × 50 m — charge RPE 7 — repos 30s
Back Extension — 3 × 20 — charge poids du corps — repos 30s

Durée estimée 19'
Stimulus : Rythme continu, aucune série à l'échec
```

### #90 — Tronc · Endurance musculaire · 30' · Box · Intermédiaire

seed `1089` · squelette `tronc_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Tronc · Endurance musculaire · 30' · Box

Ab Wheel Rollout — 4 × 20 — charge poids du corps — repos 30s
Hanging Oblique Knee Raise — 4 × 20 / côté — charge poids du corps — repos 30s
Suitcase Carry — 4 × 50 m / côté — charge RPE 7 — repos 30s
Superman Hold — 3 × 60 s — repos 30s

Durée estimée 29'
Stimulus : Rythme continu, aucune série à l'échec
```

## Haut du corps

### #91 — Haut du corps · Hypertrophie · 45' · Salle · Intermédiaire

seed `1090` · squelette `haut_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Haut du corps · Hypertrophie · 45' · Salle

Bench Press — 4 × 12 @ 55 kg — charge 65 % 1RM — repos 1:30
Ring Rows — 4 × 12 — charge poids du corps — repos 1:30
Arnold Press — 3 × 12 — charge RPE 8 — repos 1:15
Concentration Curl — 3 × 12 / bras — charge RPE 8 — repos 1:15
Machine Triceps Extension — 3 × 12 — charge RPE 8 — repos 1:15
Face Pull — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 43'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #92 — Haut du corps · Hypertrophie · 60' · Box · Avancé

seed `1091` · squelette `haut_hypertrophie` · 1RM inconnus

```
Musculation · Haut du corps · Hypertrophie · 60' · Box

Incline DB Press — 5 × 12 — charge RPE 8 — repos 1:30
Chest Supported Row — 5 × 12 — charge RPE 8 — repos 1:30
Strict Press — 4 × 12 — charge RPE 8 — repos 1:15
DB Curl — 4 × 12 / bras — charge RPE 8 — repos 1:15
Skull Crushers — 4 × 12 — charge RPE 8 — repos 1:15
Bent Over Lateral Raise — 4 × 12 — charge RPE 8 — repos 1:15

Durée estimée 55'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #93 — Haut du corps · Hypertrophie · 20' · Sans matériel · Débutant

seed `1092` · squelette `haut_hypertrophie` · 1RM inconnus · relâchements : beginner_max, optional_slot_empty, slot_muscle, slots_dropped

```
Musculation · Haut du corps · Hypertrophie · 20' · Sans matériel

Wide Push-Ups — 3 × 8 — charge poids du corps — repos 1:30
  tempo 3-1-1
Pike Push-Ups — 3 × 8 — charge poids du corps — repos 1:30
  tempo 3-1-1
Push-ups — 3 × 8 — charge poids du corps — repos 1:15
  tempo 3-1-1

Durée estimée 19'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #94 — Haut du corps · Hypertrophie · 30' · Salle · Débutant

seed `1093` · squelette `haut_hypertrophie` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Haut du corps · Hypertrophie · 30' · Salle

Push-ups — 4 × 12 — charge poids du corps — repos 1:30
Converging Machine Pulldown — 4 × 12 — charge RPE 8 — repos 1:30
Pike Push-Ups — 3 × 12 — charge poids du corps — repos 1:15
Hammer Curl — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 28'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #95 — Haut du corps · Hypertrophie · 45' · Box · Intermédiaire

seed `1094` · squelette `haut_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Haut du corps · Hypertrophie · 45' · Box

Incline Bench Press — 4 × 12 @ 55 kg — charge 65 % 1RM — repos 1:30
Chin-Ups — 4 × 12 — charge poids du corps — repos 1:30
Strict Press — 3 × 12 @ 42.5 kg — charge 65 % 1RM — repos 1:15
Hammer Curl — 3 × 12 — charge RPE 8 — repos 1:15
One-Arm Overhead Triceps Extension — 3 × 12 / bras — charge RPE 8 — repos 1:15
Rear Delt Fly — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 43'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #96 — Haut du corps · Force · 45' · Salle · Intermédiaire

seed `1095` · squelette `haut_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Haut du corps · Force · 45' · Salle

Dips — 5 × 4 — lesté 7.5 kg (10 % du poids de corps), RPE 8 — repos 2:30
Strict Press — 5 × 4 @ 47.5 kg — charge 85 % 1RM — repos 2:30
Neutral Grip Pull-Ups — 5 × 4 — lesté 7.5 kg (10 % du poids de corps), RPE 8 — repos 2:30

Durée estimée 42'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Dips : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #97 — Haut du corps · Force · 60' · Box · Avancé

seed `1096` · squelette `haut_force` · 1RM inconnus

```
Musculation · Haut du corps · Force · 60' · Box

Incline Bench Press — 5 × 4 — charge RPE 8 — repos 2:30
Strict Press — 5 × 4 — charge RPE 8 — repos 2:30
Wide Grip Pull-Ups — 5 × 4 — lesté léger, RPE 8 — repos 2:30
Close Grip Dips — 4 × 4 — lesté léger, RPE 8 — repos 2:00
Rear Delt Fly — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 56'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Incline Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #98 — Haut du corps · Force · 20' · Box · Débutant

seed `1097` · squelette `haut_force` · 1RM inconnus · relâchements : beginner_max, slot_role, slots_dropped

```
Musculation · Haut du corps · Force · 20' · Box

Bench Press — 3 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Strict Press — 3 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre

Durée estimée 18'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #99 — Haut du corps · Force · 30' · Salle · Débutant

seed `1098` · squelette `haut_force` · 1RM inconnus · relâchements : beginner_max, slot_role

```
Musculation · Haut du corps · Force · 30' · Salle

Bench Press — 3 × 3 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Strict Press — 4 × 3 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Barbell Row — 4 × 3 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre

Durée estimée 31'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #100 — Haut du corps · Force · 45' · Box · Intermédiaire

seed `1099` · squelette `haut_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Haut du corps · Force · 45' · Box

Incline Bench Press — 5 × 4 @ 72.5 kg — charge 85 % 1RM — repos 2:30
Strict Press — 5 × 4 @ 55 kg — charge 85 % 1RM — repos 2:30
Wide Grip Pull-Ups — 5 × 4 — lesté 10 kg (10 % du poids de corps), RPE 8 — repos 2:30

Durée estimée 42'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Incline Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #101 — Haut du corps · Endurance musculaire · 45' · Salle · Intermédiaire

seed `1100` · squelette `haut_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Haut du corps · Endurance musculaire · 45' · Salle

Wide Push-Ups — 5 × 20 — charge poids du corps — repos 40s
Converging Machine Pulldown — 5 × 20 — charge RPE 7 — repos 40s
Machine Shoulder Press — 5 × 20 — charge RPE 7 — repos 40s
Triceps Pushdown — 5 × 20 — charge RPE 7 — repos 40s
Side Plank — 4 × 60 s / côté — repos 30s

Durée estimée 41'
Stimulus : Rythme continu, aucune série à l'échec
```

### #102 — Haut du corps · Endurance musculaire · 60' · Box · Avancé

seed `1101` · squelette `haut_endurance` · 1RM inconnus · relâchements : bonus_slot

```
Musculation · Haut du corps · Endurance musculaire · 60' · Box

DB Bench Press — 5 × 20 — charge RPE 7 — repos 40s
Neutral Grip Pull-Ups — 5 × 20 — charge poids du corps — repos 40s
DB Shoulder Press — 5 × 20 — charge RPE 7 — repos 40s
Cross-Body Hammer Curl — 5 × 20 / bras — charge RPE 7 — repos 40s
Reverse Crunch — 5 × 20 — charge poids du corps — repos 30s
DB Kickback — 5 × 20 / bras — charge RPE 7 — repos 40s

Durée estimée 56'
Stimulus : Rythme continu, aucune série à l'échec
```

### #103 — Haut du corps · Endurance musculaire · 20' · Sans matériel · Débutant

seed `1102` · squelette `haut_endurance` · 1RM inconnus · relâchements : beginner_max, slot_muscle

```
Musculation · Haut du corps · Endurance musculaire · 20' · Sans matériel

Wide Push-Ups — 3 × 20 — charge poids du corps — repos 40s
Pike Push-Ups — 3 × 20 — charge poids du corps — repos 40s
Wall Push-Ups — 3 × 20 — charge poids du corps — repos 40s
Wall Triceps Extension — 3 × 20 — charge poids du corps — repos 40s

Durée estimée 19'
Stimulus : Rythme continu, aucune série à l'échec
```

### #104 — Haut du corps · Endurance musculaire · 30' · Salle · Débutant

seed `1103` · squelette `haut_endurance` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Haut du corps · Endurance musculaire · 30' · Salle

Machine Incline Press — 5 × 20 — charge RPE 7 — repos 40s
Barbell Row — 4 × 20 — charge RPE 7 — repos 40s
  monter jusqu'à une charge propre
Pike Push-Ups — 4 × 20 — charge poids du corps — repos 40s
Triceps Pushdown — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 29'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #105 — Haut du corps · Endurance musculaire · 45' · Box · Intermédiaire

seed `1104` · squelette `haut_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Haut du corps · Endurance musculaire · 45' · Box

Bench Press — 5 × 20 @ 55 kg — charge 52 % 1RM — repos 40s
Barbell Row — 5 × 20 @ 47.5 kg — charge 52 % 1RM — repos 40s
Strict Press — 5 × 20 @ 35 kg — charge 52 % 1RM — repos 40s
Barbell Curl — 5 × 20 — charge RPE 7 — repos 40s
Hanging Leg Raise — 4 × 20 — charge poids du corps — repos 30s

Durée estimée 42'
Stimulus : Rythme continu, aucune série à l'échec
```

## Dos

### #106 — Dos · Hypertrophie · 60' · Salle · Intermédiaire

seed `1105` · squelette `dos_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_muscle

```
Musculation · Dos · Hypertrophie · 60' · Salle

Strict Pull-Ups — 5 × 12 — charge poids du corps — repos 1:30
Yates Row — 5 × 12 @ 45 kg — charge 65 % 1RM — repos 1:15
Neutral Grip Pull-Ups — 5 × 12 — charge poids du corps — repos 1:15
Face Pull — 5 × 12 — charge RPE 8 — repos 1:15
Cable Shrug — 5 × 12 — charge RPE 8 — repos 1:15
Back Extension — 4 × 12 — charge poids du corps — repos 1:15

Durée estimée 55'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #107 — Dos · Hypertrophie · 20' · Box · Avancé

seed `1106` · squelette `dos_hypertrophie` · 1RM inconnus · relâchements : slot_muscle

```
Musculation · Dos · Hypertrophie · 20' · Box

Deadlift — 4 × 10 — charge RPE 8 — repos 1:30
Yates Row — 3 × 10 — charge RPE 8 — repos 1:15
Rear Delt Fly — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 20'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #108 — Dos · Hypertrophie · 30' · Box · Débutant

seed `1107` · squelette `dos_hypertrophie` · 1RM inconnus · relâchements : beginner_max, slot_muscle

```
Musculation · Dos · Hypertrophie · 30' · Box

Deadlift — 4 × 12 — charge RPE 7 — repos 1:30
  monter jusqu'à une charge propre
DB Shrug — 4 × 12 — charge RPE 8 — repos 1:15
Barbell Row — 3 × 12 — charge RPE 7 — repos 1:15
  monter jusqu'à une charge propre
Bent Over Lateral Raise — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 27'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #109 — Dos · Hypertrophie · 45' · Salle · Débutant

seed `1108` · squelette `dos_hypertrophie` · 1RM inconnus · relâchements : beginner_max, slot_muscle, slot_objective, tempo_311

```
Musculation · Dos · Hypertrophie · 45' · Salle

Supinated Lat Pulldown — 5 × 12 — charge RPE 8 — repos 1:30
  tempo 3-1-1
Back Extension — 5 × 12 — charge poids du corps — repos 1:15
Machine Row — 5 × 12 — charge RPE 8 — repos 1:15
Rear Delt Machine — 5 × 12 — charge RPE 8 — repos 1:15

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #110 — Dos · Hypertrophie · 60' · Box · Intermédiaire

seed `1109` · squelette `dos_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_muscle

```
Musculation · Dos · Hypertrophie · 60' · Box

Deadlift — 5 × 12 @ 117.5 kg — charge 65 % 1RM — repos 1:30
Yates Row — 5 × 12 @ 57.5 kg — charge 65 % 1RM — repos 1:15
Chest Supported Row — 5 × 12 — charge RPE 8 — repos 1:15
Rear Delt Fly — 5 × 12 — charge RPE 8 — repos 1:15
DB Shrug — 5 × 12 — charge RPE 8 — repos 1:15
Back Extension — 4 × 12 — charge poids du corps — repos 1:15

Durée estimée 55'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #111 — Dos · Force · 60' · Salle · Intermédiaire

seed `1110` · squelette `dos_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : bonus_slot, optional_slot_empty, slot_muscle

```
Musculation · Dos · Force · 60' · Salle

Wide Grip Pull-Ups — 5 × 5 — lesté 7.5 kg (10 % du poids de corps), RPE 8 — repos 2:30
Yates Row — 5 × 5 @ 57.5 kg — charge 82 % 1RM — repos 2:30
Face Pull — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Back Extension — 5 × 12 — charge poids du corps — repos 1:15
  schéma hypertrophie
Rear Delt Machine — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 55'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Wide Grip Pull-Ups : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #112 — Dos · Force · 20' · Box · Avancé

seed `1111` · squelette `dos_force` · 1RM inconnus · relâchements : optional_slot_empty, slot_muscle

```
Musculation · Dos · Force · 20' · Box

Wide Grip Pull-Ups — 4 × 3 — lesté léger, RPE 8 — repos 2:30
Yates Row — 4 × 3 — charge RPE 8 — repos 2:30

Durée estimée 22'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Wide Grip Pull-Ups : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #113 — Dos · Force · 30' · Box · Débutant

seed `1112` · squelette `dos_force` · 1RM inconnus · relâchements : beginner_max, slot_muscle, slot_role

```
Musculation · Dos · Force · 30' · Box

Deadlift — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Superman Hold — 4 × 45 s — repos 1:30
  schéma hypertrophie
Barbell Shrug — 3 × 10 — charge RPE 7 — repos 1:15
  schéma hypertrophie · monter jusqu'à une charge propre

Durée estimée 28'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Deadlift : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #114 — Dos · Force · 45' · Salle · Débutant

seed `1113` · squelette `dos_force` · 1RM inconnus · relâchements : beginner_max, slot_muscle, slot_role

```
Musculation · Dos · Force · 45' · Salle

Barbell Row — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Superman Hold — 5 × 60 s — repos 1:30
  schéma hypertrophie
DB Shrug — 4 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Rear Delt Fly — 4 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 41'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Barbell Row : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #115 — Dos · Force · 60' · Box · Intermédiaire

seed `1114` · squelette `dos_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : bonus_slot, optional_slot_empty, slot_muscle

```
Musculation · Dos · Force · 60' · Box

T-Bar Row — 5 × 5 — charge RPE 8 — repos 2:30
Yates Row — 5 × 5 @ 75 kg — charge 82 % 1RM — repos 2:30
Bent Over Lateral Raise — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Back Extension — 5 × 12 — charge poids du corps — repos 1:15
  schéma hypertrophie
Rear Delt Fly — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 55'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur T-Bar Row : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #116 — Dos · Endurance musculaire · 60' · Salle · Intermédiaire

seed `1115` · squelette `dos_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : bonus_slot, slot_muscle, tempo_311

```
Musculation · Dos · Endurance musculaire · 60' · Salle

Chin-Ups — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
DB Shrug — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Rear Delt Fly — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Back Extension — 5 × 20 — charge poids du corps — repos 40s
Cable Shrug — 4 × 20 — charge RPE 7 — repos 40s
Face Pull — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 56'
Stimulus : Rythme continu, aucune série à l'échec
```

### #117 — Dos · Endurance musculaire · 20' · Box · Avancé

seed `1116` · squelette `dos_endurance` · 1RM inconnus · relâchements : slot_muscle

```
Musculation · Dos · Endurance musculaire · 20' · Box

DB Row — 3 × 18 / bras — charge RPE 7 — repos 40s
Rear Delt Fly — 3 × 18 — charge RPE 7 — repos 40s
Back Extension — 3 × 18 — charge poids du corps — repos 40s
Bent Over Lateral Raise — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 19'
Stimulus : Rythme continu, aucune série à l'échec
```

### #118 — Dos · Endurance musculaire · 30' · Box · Débutant

seed `1117` · squelette `dos_endurance` · 1RM inconnus · relâchements : beginner_max, slot_muscle

```
Musculation · Dos · Endurance musculaire · 30' · Box

Chest Supported Row — 5 × 20 — charge RPE 7 — repos 40s
Superman Hold — 4 × 60 s — repos 40s
Bent Over Lateral Raise — 4 × 20 — charge RPE 7 — repos 40s
Back Extension — 4 × 20 — charge poids du corps — repos 40s

Durée estimée 28'
Stimulus : Rythme continu, aucune série à l'échec
```

### #119 — Dos · Endurance musculaire · 45' · Salle · Débutant

seed `1118` · squelette `dos_endurance` · 1RM inconnus · relâchements : beginner_max, slot_muscle, tempo_311

```
Musculation · Dos · Endurance musculaire · 45' · Salle

Seated Cable Row — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Rear Delt Machine — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Barbell Shrug — 5 × 20 — charge RPE 7 — repos 40s
  monter jusqu'à une charge propre · tempo 3-1-1
Superman Hold — 5 × 60 s — repos 40s

Durée estimée 44'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #120 — Dos · Endurance musculaire · 60' · Box · Intermédiaire

seed `1119` · squelette `dos_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : bonus_slot, slot_muscle, tempo_311

```
Musculation · Dos · Endurance musculaire · 60' · Box

Neutral Grip Pull-Ups — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Yates Row — 5 × 12 @ 57.5 kg — charge 65 % 1RM — repos 1:15
  tempo 3-1-1
Rear Delt Fly — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Superman Hold — 5 × 60 s — repos 40s
Barbell Shrug — 4 × 20 @ 55 kg — charge 52 % 1RM — repos 40s
Bent Over Lateral Raise — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 55'
Stimulus : Rythme continu, aucune série à l'échec
```

## Épaules

### #121 — Épaules · Hypertrophie · 20' · Salle · Intermédiaire

seed `1120` · squelette `epaules_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_muscle

```
Musculation · Épaules · Hypertrophie · 20' · Salle

Landmine Press — 4 × 10 / bras — charge RPE 8 — repos 1:30
Machine Shrug — 3 × 10 — charge RPE 8 — repos 1:15
Rear Delt Fly — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 21'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #122 — Épaules · Hypertrophie · 30' · Box · Avancé

seed `1121` · squelette `epaules_hypertrophie` · 1RM inconnus · relâchements : optional_slot_empty, slot_muscle

```
Musculation · Épaules · Hypertrophie · 30' · Box

Strict Press — 4 × 12 — charge RPE 8 — repos 1:30
Bent Over Lateral Raise — 4 × 12 — charge RPE 8 — repos 1:15
Barbell Front Raise — 4 × 12 — charge RPE 8 — repos 1:15
Barbell Shrug — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 28'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #123 — Épaules · Hypertrophie · 45' · Box · Débutant

seed `1122` · squelette `epaules_hypertrophie` · 1RM inconnus · relâchements : beginner_max, slot_muscle, tempo_311

```
Musculation · Épaules · Hypertrophie · 45' · Box

Strict Press — 5 × 12 — charge RPE 7 — repos 1:30
  monter jusqu'à une charge propre · tempo 3-1-1
Barbell Front Raise — 5 × 12 — charge RPE 8 — repos 1:15
  tempo 3-1-1
Rear Delt Fly — 5 × 12 — charge RPE 8 — repos 1:15
Front Raise — 5 × 12 — charge RPE 8 — repos 1:15

Durée estimée 42'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #124 — Épaules · Hypertrophie · 60' · Salle · Débutant

seed `1123` · squelette `epaules_hypertrophie` · 1RM inconnus · relâchements : beginner_max, rest_extended, slot_muscle, tempo_311

```
Musculation · Épaules · Hypertrophie · 60' · Salle

Pike Push-Ups — 5 × 12 — charge poids du corps — repos 2:00
  tempo 3-1-1
Rear Delt Fly — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1
Barbell Shrug — 5 × 12 — charge RPE 7 — repos 1:45
  monter jusqu'à une charge propre · tempo 3-1-1
Front Raise — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1

Durée estimée 57'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #125 — Épaules · Hypertrophie · 20' · Box · Intermédiaire

seed `1124` · squelette `epaules_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_muscle

```
Musculation · Épaules · Hypertrophie · 20' · Box

Landmine Press — 4 × 10 / bras — charge RPE 8 — repos 1:30
Barbell Front Raise — 3 × 10 — charge RPE 8 — repos 1:15
Rear Delt Fly — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 21'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #126 — Épaules · Force · 20' · Salle · Intermédiaire

seed `1125` · squelette `epaules_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : optional_slot_empty

```
Musculation · Épaules · Force · 20' · Salle

Strict Press — 5 × 4 @ 47.5 kg — charge 85 % 1RM — repos 2:30
Rear Delt Fly — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 19'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Strict Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #127 — Épaules · Force · 30' · Box · Avancé

seed `1126` · squelette `epaules_force` · 1RM inconnus · relâchements : optional_slot_empty

```
Musculation · Épaules · Force · 30' · Box

Strict Press — 5 × 4 — charge RPE 8 — repos 2:30
Rear Delt Fly — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Lateral Raise — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie
DB Shrug — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 29'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Strict Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #128 — Épaules · Force · 45' · Box · Débutant

seed `1127` · squelette `epaules_force` · 1RM inconnus · relâchements : optional_slot_empty, tempo_311

```
Musculation · Épaules · Force · 45' · Box

Strict Press — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre · tempo 3-1-1
Rear Delt Fly — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Lateral Raise — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
DB Shrug — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 41'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Strict Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #129 — Épaules · Force · 60' · Salle · Débutant

seed `1128` · squelette `epaules_force` · 1RM inconnus · relâchements : optional_slot_empty, rest_extended, tempo_311

```
Musculation · Épaules · Force · 60' · Salle

Strict Press — 5 × 5 — charge RPE 7 — repos 2:45
  monter jusqu'à une charge propre · tempo 3-1-1
Bent Over Lateral Raise — 5 × 12 — charge RPE 8 — repos 1:30
  schéma hypertrophie · tempo 3-1-1
Lateral Raise — 5 × 12 — charge RPE 8 — repos 1:30
  schéma hypertrophie · tempo 3-1-1
Cable Shrug — 5 × 12 — charge RPE 8 — repos 1:30
  schéma hypertrophie · tempo 3-1-1

Durée estimée 55'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Strict Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #130 — Épaules · Force · 20' · Box · Intermédiaire

seed `1129` · squelette `epaules_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : optional_slot_empty

```
Musculation · Épaules · Force · 20' · Box

Strict Press — 5 × 4 @ 55 kg — charge 85 % 1RM — repos 2:30
Rear Delt Fly — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 19'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Strict Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #131 — Épaules · Endurance musculaire · 20' · Salle · Intermédiaire

seed `1130` · squelette `epaules_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_muscle

```
Musculation · Épaules · Endurance musculaire · 20' · Salle

Pike Push-Ups — 3 × 20 — charge poids du corps — repos 40s
Rear Delt Machine — 3 × 20 — charge RPE 7 — repos 40s
DB Shrug — 3 × 20 — charge RPE 7 — repos 40s
Front Raise — 3 × 20 — charge RPE 7 — repos 40s

Durée estimée 18'
Stimulus : Rythme continu, aucune série à l'échec
```

### #132 — Épaules · Endurance musculaire · 30' · Box · Avancé

seed `1131` · squelette `epaules_endurance` · 1RM inconnus · relâchements : slot_muscle

```
Musculation · Épaules · Endurance musculaire · 30' · Box

DB Shoulder Press — 5 × 20 — charge RPE 7 — repos 40s
Rear Delt Fly — 5 × 20 — charge RPE 7 — repos 40s
Barbell Shrug — 4 × 20 — charge RPE 7 — repos 40s
Front Raise — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 27'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #133 — Épaules · Endurance musculaire · 45' · Box · Débutant

seed `1132` · squelette `epaules_endurance` · 1RM inconnus · relâchements : slot_muscle, tempo_311

```
Musculation · Épaules · Endurance musculaire · 45' · Box

DB Shoulder Press — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Barbell Front Raise — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Rear Delt Fly — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Front Raise — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 42'
Stimulus : Rythme continu, aucune série à l'échec
```

### #134 — Épaules · Endurance musculaire · 60' · Salle · Débutant

seed `1133` · squelette `epaules_endurance` · 1RM inconnus · relâchements : rest_extended, slot_muscle, tempo_311

```
Musculation · Épaules · Endurance musculaire · 60' · Salle

Strict Press — 5 × 20 — charge RPE 7 — repos 1:10
  monter jusqu'à une charge propre · tempo 3-1-1
Barbell Front Raise — 5 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1
Rear Delt Machine — 5 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1
Cable Front Raise — 4 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1

Durée estimée 56'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #135 — Épaules · Endurance musculaire · 20' · Box · Intermédiaire

seed `1134` · squelette `epaules_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : optional_slot_empty, slot_muscle

```
Musculation · Épaules · Endurance musculaire · 20' · Box

DB Shoulder Press — 4 × 20 — charge RPE 7 — repos 40s
Rear Delt Fly — 4 × 20 — charge RPE 7 — repos 40s
Barbell Front Raise — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 18'
Stimulus : Rythme continu, aucune série à l'échec
```

## Bras

### #136 — Bras · Hypertrophie · 30' · Salle · Intermédiaire

seed `1135` · squelette `bras_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Bras · Hypertrophie · 30' · Salle

Close Grip Dips — 3 × 10 — charge poids du corps — repos 1:15
Lying Cable Curl — 3 × 10 — charge RPE 8 — repos 1:15
Cable Kickback — 3 × 10 / bras — charge RPE 8 — repos 1:15
DB Curl — 3 × 10 / bras — charge RPE 8 — repos 1:15
Machine Triceps Extension — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 30'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #137 — Bras · Hypertrophie · 45' · Box · Avancé

seed `1136` · squelette `bras_hypertrophie` · 1RM inconnus

```
Musculation · Bras · Hypertrophie · 45' · Box

Close Grip Dips — 4 × 12 — charge poids du corps — repos 1:15
Barbell Curl — 4 × 12 — charge RPE 8 — repos 1:15
Bench Dips — 4 × 12 — charge poids du corps — repos 1:15
Incline DB Curl — 4 × 12 — charge RPE 8 — repos 1:15
DB Kickback — 3 × 12 / bras — charge RPE 8 — repos 1:15
Wrist Curl — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #138 — Bras · Hypertrophie · 60' · Box · Débutant

seed `1137` · squelette `bras_hypertrophie` · 1RM inconnus · relâchements : beginner_max, rest_extended, slot_objective, slot_role, tempo_311

```
Musculation · Bras · Hypertrophie · 60' · Box

Bench Dips — 5 × 12 — charge poids du corps — repos 1:45
  tempo 3-1-1
Hammer Curl — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1
Overhead Triceps Extension — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1
Barbell Curl — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1

Durée estimée 56'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #139 — Bras · Hypertrophie · 20' · Salle · Débutant

seed `1138` · squelette `bras_hypertrophie` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Bras · Hypertrophie · 20' · Salle

Machine Dips — 3 × 8 — charge RPE 8 — repos 1:15
Barbell Curl — 3 × 8 — charge RPE 8 — repos 1:15
Overhead Triceps Extension — 3 × 8 — charge RPE 8 — repos 1:15
Rope Hammer Curl — 3 × 8 — charge RPE 8 — repos 1:15

Durée estimée 21'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #140 — Bras · Hypertrophie · 30' · Box · Intermédiaire

seed `1139` · squelette `bras_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Bras · Hypertrophie · 30' · Box

Close Grip Bench Press — 3 × 10 @ 60 kg — charge 68 % 1RM — repos 1:15
Incline DB Curl — 3 × 10 — charge RPE 8 — repos 1:15
Skull Crushers — 3 × 10 — charge RPE 8 — repos 1:15
Spider Curl — 3 × 10 — charge RPE 8 — repos 1:15
Overhead Triceps Extension — 3 × 10 — charge RPE 8 — repos 1:15

Durée estimée 28'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #141 — Bras · Force · 30' · Salle · Intermédiaire

seed `1140` · squelette `bras_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Bras · Force · 30' · Salle

Close Grip Bench Press — 5 × 4 @ 62.5 kg — charge 85 % 1RM — repos 2:30
Preacher Curl — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie
DB Kickback — 3 × 10 / bras — charge RPE 8 — repos 1:15
  schéma hypertrophie
Preacher Barbell Curl — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 31'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Close Grip Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #142 — Bras · Force · 45' · Box · Avancé

seed `1141` · squelette `bras_force` · 1RM inconnus

```
Musculation · Bras · Force · 45' · Box

Close Grip Bench Press — 5 × 5 — charge RPE 8 — repos 2:30
DB Curl — 4 × 12 / bras — charge RPE 8 — repos 1:15
  schéma hypertrophie
Bench Dips — 3 × 12 — charge poids du corps — repos 1:15
  schéma hypertrophie
Concentration Curl — 3 × 12 / bras — charge RPE 8 — repos 1:15
  schéma hypertrophie
Wrist Extension — 3 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 42'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Close Grip Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #143 — Bras · Force · 60' · Box · Débutant

seed `1142` · squelette `bras_force` · 1RM inconnus · relâchements : beginner_max, rest_extended, slot_role, tempo_311

```
Musculation · Bras · Force · 60' · Box

Overhead Triceps Extension — 5 × 12 — charge RPE 8 — repos 2:00
  schéma hypertrophie · tempo 3-1-1
Hammer Curl — 5 × 12 — charge RPE 8 — repos 1:45
  schéma hypertrophie · tempo 3-1-1
Bench Dips — 5 × 12 — charge poids du corps — repos 1:45
  schéma hypertrophie · tempo 3-1-1
Barbell Curl — 5 × 12 — charge RPE 8 — repos 1:45
  schéma hypertrophie · tempo 3-1-1

Durée estimée 57'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Overhead Triceps Extension : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #144 — Bras · Force · 20' · Salle · Débutant

seed `1143` · squelette `bras_force` · 1RM inconnus · relâchements : beginner_max, slot_role

```
Musculation · Bras · Force · 20' · Salle

Overhead Triceps Extension — 4 × 10 — charge RPE 8 — repos 1:30
  schéma hypertrophie
Hammer Curl — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Bench Dips — 3 × 10 — charge poids du corps — repos 1:15
  schéma hypertrophie

Durée estimée 19'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Overhead Triceps Extension : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #145 — Bras · Force · 30' · Box · Intermédiaire

seed `1144` · squelette `bras_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Bras · Force · 30' · Box

Close Grip Dips — 5 × 5 — lesté 10 kg (10 % du poids de corps), RPE 8 — repos 2:30
Barbell Curl — 3 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
One-Arm Overhead Triceps Extension — 3 × 12 / bras — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 27'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Close Grip Dips : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #146 — Bras · Endurance musculaire · 30' · Salle · Intermédiaire

seed `1145` · squelette `bras_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg

```
Musculation · Bras · Endurance musculaire · 30' · Salle

One-Arm Triceps Pushdown — 4 × 20 / bras — charge RPE 7 — repos 40s
Barbell Curl — 3 × 20 — charge RPE 7 — repos 40s
Bench Dips — 3 × 20 — charge poids du corps — repos 40s
Rope Hammer Curl — 3 × 20 — charge RPE 7 — repos 40s
Wrist Extension — 3 × 20 — charge RPE 7 — repos 40s

Durée estimée 27'
Stimulus : Rythme continu, aucune série à l'échec
```

### #147 — Bras · Endurance musculaire · 45' · Box · Avancé

seed `1146` · squelette `bras_endurance` · 1RM inconnus

```
Musculation · Bras · Endurance musculaire · 45' · Box

DB Kickback — 5 × 20 / bras — charge RPE 7 — repos 40s
Hammer Curl — 5 × 20 — charge RPE 7 — repos 40s
Bench Dips — 4 × 20 — charge poids du corps — repos 40s
Cross-Body Hammer Curl — 4 × 20 / bras — charge RPE 7 — repos 40s
Wrist Curl — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 41'
Stimulus : Rythme continu, aucune série à l'échec
```

### #148 — Bras · Endurance musculaire · 60' · Box · Débutant

seed `1147` · squelette `bras_endurance` · 1RM inconnus · relâchements : beginner_fifth, beginner_max, rest_extended, tempo_311

```
Musculation · Bras · Endurance musculaire · 60' · Box

Wall Triceps Extension — 5 × 20 — charge poids du corps — repos 1:15
  tempo 3-1-1
Hammer Curl — 5 × 20 — charge RPE 7 — repos 1:15
  tempo 3-1-1
Overhead Triceps Extension — 4 × 20 — charge RPE 7 — repos 1:15
  tempo 3-1-1
Barbell Curl — 4 × 20 — charge RPE 7 — repos 1:15
  tempo 3-1-1
Wrist Curl — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 57'
Stimulus : Rythme continu, aucune série à l'échec
```

### #149 — Bras · Endurance musculaire · 20' · Salle · Débutant

seed `1148` · squelette `bras_endurance` · 1RM inconnus · relâchements : beginner_max

```
Musculation · Bras · Endurance musculaire · 20' · Salle

Bench Dips — 3 × 18 — charge poids du corps — repos 40s
Rope Hammer Curl — 3 × 18 — charge RPE 7 — repos 40s
Machine Triceps Extension — 3 × 18 — charge RPE 7 — repos 40s
Machine Preacher Curl — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 19'
Stimulus : Rythme continu, aucune série à l'échec
```

### #150 — Bras · Endurance musculaire · 30' · Box · Intermédiaire

seed `1149` · squelette `bras_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg

```
Musculation · Bras · Endurance musculaire · 30' · Box

DB Kickback — 3 × 18 / bras — charge RPE 7 — repos 40s
Barbell Curl — 3 × 18 — charge RPE 7 — repos 40s
Wall Triceps Extension — 3 × 18 — charge poids du corps — repos 40s
Cross-Body Hammer Curl — 3 × 18 / bras — charge RPE 7 — repos 40s
Wrist Curl — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 27'
Stimulus : Rythme continu, aucune série à l'échec
```

## Pectoraux

### #151 — Pectoraux · Hypertrophie · 45' · Salle · Intermédiaire

seed `1150` · squelette `pecs_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_muscle

```
Musculation · Pectoraux · Hypertrophie · 45' · Salle

Push-ups — 4 × 12 — charge poids du corps — repos 1:30
Close Grip Bench Press — 5 × 12 @ 47.5 kg — charge 65 % 1RM — repos 1:15
Pec Deck — 4 × 12 — charge RPE 8 — repos 1:15
Lying Cable Triceps Extension — 4 × 12 — charge RPE 8 — repos 1:15
Low To High Cable Fly — 4 × 12 — charge RPE 8 — repos 1:15

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #152 — Pectoraux · Hypertrophie · 60' · Box · Avancé

seed `1151` · squelette `pecs_hypertrophie` · 1RM inconnus · relâchements : bonus_slot, slot_muscle, tempo_311

```
Musculation · Pectoraux · Hypertrophie · 60' · Box

Dips — 4 × 12 — charge poids du corps — repos 1:30
  tempo 3-1-1
Close Grip Bench Press — 5 × 12 — charge RPE 8 — repos 1:15
Incline DB Fly — 4 × 12 — charge RPE 8 — repos 1:15
Bench Dips — 5 × 12 — charge poids du corps — repos 1:15
DB Pullover — 4 × 12 — charge RPE 8 — repos 1:15
Strict Press — 5 × 12 — charge RPE 8 — repos 1:15

Durée estimée 54'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #153 — Pectoraux · Hypertrophie · 20' · Sans matériel · Débutant

seed `1152` · squelette `pecs_hypertrophie` · 1RM inconnus · relâchements : optional_slot_empty, slot_dropped, slot_muscle, slot_role

```
Musculation · Pectoraux · Hypertrophie · 20' · Sans matériel

Wide Push-Ups — 4 × 8 — charge poids du corps — repos 1:30
  tempo 3-1-1
Wall Triceps Extension — 3 × 15 — charge poids du corps — repos 1:15
Push-ups — 3 × 8 — charge poids du corps — repos 1:15
  tempo 3-1-1

Durée estimée 21'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #154 — Pectoraux · Hypertrophie · 30' · Salle · Débutant

seed `1153` · squelette `pecs_hypertrophie` · 1RM inconnus · relâchements : beginner_max, slot_muscle

```
Musculation · Pectoraux · Hypertrophie · 30' · Salle

Incline Push-Ups — 4 × 12 — charge poids du corps — repos 1:30
Machine Dips — 4 × 12 — charge RPE 8 — repos 1:15
Cable Fly — 3 × 12 — charge RPE 8 — repos 1:15
Overhead Triceps Extension — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 27'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #155 — Pectoraux · Hypertrophie · 45' · Box · Intermédiaire

seed `1154` · squelette `pecs_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_muscle

```
Musculation · Pectoraux · Hypertrophie · 45' · Box

DB Bench Press — 4 × 12 — charge RPE 8 — repos 1:30
Close Grip Dips — 5 × 12 — charge poids du corps — repos 1:15
DB Pullover — 4 × 12 — charge RPE 8 — repos 1:15
Bench Dips — 4 × 12 — charge poids du corps — repos 1:15
DB Fly — 4 × 12 — charge RPE 8 — repos 1:15

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #156 — Pectoraux · Force · 45' · Salle · Intermédiaire

seed `1155` · squelette `pecs_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : bonus_slot, optional_slot_empty

```
Musculation · Pectoraux · Force · 45' · Salle

Dips — 5 × 5 — lesté 7.5 kg (10 % du poids de corps), RPE 8 — repos 2:30
Close Grip Bench Press — 5 × 5 @ 60 kg — charge 82 % 1RM — repos 2:00
Cable Fly — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
One-Arm Overhead Triceps Extension — 3 × 10 / bras — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 43'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Dips : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #157 — Pectoraux · Force · 60' · Box · Avancé

seed `1156` · squelette `pecs_force` · 1RM inconnus · relâchements : bonus_slot, optional_slot_empty

```
Musculation · Pectoraux · Force · 60' · Box

Incline Bench Press — 5 × 5 — charge RPE 8 — repos 2:30
Close Grip Bench Press — 5 × 5 — charge RPE 8 — repos 2:00
DB Pullover — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
DB Kickback — 5 × 12 / bras — charge RPE 8 — repos 1:15
  schéma hypertrophie
Strict Press — 4 × 4 — charge RPE 8 — repos 2:00

Durée estimée 56'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Incline Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #158 — Pectoraux · Force · 20' · Box · Débutant

seed `1157` · squelette `pecs_force` · 1RM inconnus · relâchements : optional_slot_empty, slot_role

```
Musculation · Pectoraux · Force · 20' · Box

Bench Press — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Overhead Triceps Extension — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 20'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #159 — Pectoraux · Force · 30' · Salle · Débutant

seed `1158` · squelette `pecs_force` · 1RM inconnus · relâchements : optional_slot_empty, slot_role

```
Musculation · Pectoraux · Force · 30' · Salle

Bench Press — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Triceps Pushdown — 4 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
DB Fly — 3 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 27'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #160 — Pectoraux · Force · 45' · Box · Intermédiaire

seed `1159` · squelette `pecs_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : bonus_slot, optional_slot_empty

```
Musculation · Pectoraux · Force · 45' · Box

Incline Bench Press — 5 × 5 @ 70 kg — charge 82 % 1RM — repos 2:30
Close Grip Bench Press — 5 × 5 @ 72.5 kg — charge 82 % 1RM — repos 2:00
DB Pullover — 5 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Skull Crushers — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 42'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Incline Bench Press : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #161 — Pectoraux · Endurance musculaire · 45' · Salle · Intermédiaire

seed `1160` · squelette `pecs_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : bonus_slot, slot_muscle

```
Musculation · Pectoraux · Endurance musculaire · 45' · Salle

Machine Chest Press — 5 × 20 — charge RPE 7 — repos 40s
Diamond Push-Ups — 5 × 20 — charge poids du corps — repos 40s
DB Fly — 4 × 20 — charge RPE 7 — repos 40s
Cable Overhead Triceps Extension — 4 × 20 — charge RPE 7 — repos 40s
Machine Pullover — 5 × 20 — charge RPE 7 — repos 40s
DB Shoulder Press — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 44'
Stimulus : Rythme continu, aucune série à l'échec
```

### #162 — Pectoraux · Endurance musculaire · 60' · Box · Avancé

seed `1161` · squelette `pecs_endurance` · 1RM inconnus · relâchements : bonus_slot, slot_muscle, tempo_311

```
Musculation · Pectoraux · Endurance musculaire · 60' · Box

Dips — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Diamond Push-Ups — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
DB Fly — 4 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Overhead Triceps Extension — 4 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Pike Push-Ups — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1

Durée estimée 55'
Stimulus : Rythme continu, aucune série à l'échec
```

### #163 — Pectoraux · Endurance musculaire · 20' · Sans matériel · Débutant

seed `1162` · squelette `pecs_endurance` · 1RM inconnus · relâchements : optional_slot_empty, slot_muscle, slot_role

```
Musculation · Pectoraux · Endurance musculaire · 20' · Sans matériel

Incline Push-Ups — 5 × 20 — charge poids du corps — repos 40s
Wall Triceps Extension — 4 × 20 — charge poids du corps — repos 40s
Wall Push-Ups — 4 × 20 — charge poids du corps — repos 40s

Durée estimée 19'
Stimulus : Rythme continu, aucune série à l'échec
```

### #164 — Pectoraux · Endurance musculaire · 30' · Salle · Débutant

seed `1163` · squelette `pecs_endurance` · 1RM inconnus · relâchements : slot_muscle

```
Musculation · Pectoraux · Endurance musculaire · 30' · Salle

Machine Incline Press — 5 × 20 — charge RPE 7 — repos 40s
Machine Dips — 4 × 20 — charge RPE 7 — repos 40s
DB Fly — 4 × 20 — charge RPE 7 — repos 40s
Rope Triceps Pushdown — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 29'
Stimulus : Rythme continu, aucune série à l'échec
```

### #165 — Pectoraux · Endurance musculaire · 45' · Box · Intermédiaire

seed `1164` · squelette `pecs_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : bonus_slot, slot_muscle, tempo_311

```
Musculation · Pectoraux · Endurance musculaire · 45' · Box

Dips — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Diamond Push-Ups — 5 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
DB Fly — 4 × 20 — charge RPE 7 — repos 40s
Bench Dips — 4 × 20 — charge poids du corps — repos 40s
DB Shoulder Press — 5 × 20 — charge RPE 7 — repos 40s

Durée estimée 45'
Stimulus : Rythme continu, aucune série à l'échec
```

## Fessiers

### #166 — Fessiers · Hypertrophie · 60' · Salle · Intermédiaire

seed `1165` · squelette `fessiers_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : bonus_slot, optional_slot_empty

```
Musculation · Fessiers · Hypertrophie · 60' · Salle

Hip Thrust — 4 × 12 @ 97.5 kg — charge 65 % 1RM — repos 1:30
DB Romanian Deadlift — 5 × 12 — charge RPE 8 — repos 1:15
High Box Step-Up — 4 × 12 / jambe — charge RPE 8 — repos 1:15
Leg Curl — 5 × 12 — charge RPE 8 — repos 1:15
Cable Hip Abduction — 4 × 12 / jambe — charge RPE 8 — repos 1:15
Back Extension — 3 × 12 — charge poids du corps — repos 1:15

Durée estimée 54'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #167 — Fessiers · Hypertrophie · 20' · Box · Avancé

seed `1166` · squelette `fessiers_hypertrophie` · 1RM inconnus · relâchements : optional_slot_empty, slot_ids, slots_dropped

```
Musculation · Fessiers · Hypertrophie · 20' · Box

DB Hip Thrust — 3 × 8 — charge RPE 8 — repos 1:30
Good Morning — 3 × 8 — charge RPE 8 — repos 1:15
Single-Leg Hip Thrust — 3 × 8 / jambe — charge poids du corps — repos 1:15

Durée estimée 18'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #168 — Fessiers · Hypertrophie · 30' · Sans matériel · Débutant

seed `1167` · squelette `fessiers_hypertrophie` · 1RM inconnus · relâchements : optional_slot_empty, slot_dropped, slot_ids, slot_muscle, slot_role

```
Musculation · Fessiers · Hypertrophie · 30' · Sans matériel

Reverse Lunge — 4 × 16 — charge poids du corps — repos 1:30
  tempo 3-1-1
Superman Hold — 4 × 60 s — repos 1:15
Glute Bridge — 4 × 15 — charge poids du corps — repos 1:15

Durée estimée 29'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #169 — Fessiers · Hypertrophie · 45' · Salle · Débutant

seed `1168` · squelette `fessiers_hypertrophie` · 1RM inconnus · relâchements : beginner_max, optional_slot_empty

```
Musculation · Fessiers · Hypertrophie · 45' · Salle

Hip Thrust — 5 × 12 — charge RPE 7 — repos 1:30
  monter jusqu'à une charge propre
DB Romanian Deadlift — 5 × 12 — charge RPE 8 — repos 1:15
Hip Thrust Machine — 5 × 12 — charge RPE 8 — repos 1:15
Leg Curl — 5 × 12 — charge RPE 8 — repos 1:15

Durée estimée 41'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #170 — Fessiers · Hypertrophie · 60' · Box · Intermédiaire

seed `1169` · squelette `fessiers_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : bonus_slot, optional_slot_empty, slot_ids, slot_role

```
Musculation · Fessiers · Hypertrophie · 60' · Box

Hip Thrust — 4 × 12 @ 122.5 kg — charge 65 % 1RM — repos 1:30
DB Romanian Deadlift — 5 × 12 — charge RPE 8 — repos 1:15
Single-Leg Hip Thrust — 4 × 12 / jambe — charge poids du corps — repos 1:15
Romanian Deadlift — 5 × 12 @ 82.5 kg — charge 65 % 1RM — repos 1:15
Single-Leg Glute Bridge — 4 × 12 / jambe — charge poids du corps — repos 1:15
Back Extension — 3 × 10 — charge poids du corps — repos 1:15

Durée estimée 56'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #171 — Fessiers · Force · 60' · Salle · Intermédiaire

seed `1170` · squelette `fessiers_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : bonus_slot, optional_slot_empty, slot_unilateral

```
Musculation · Fessiers · Force · 60' · Salle

Sumo Deadlift — 5 × 5 @ 115 kg — charge 82 % 1RM — repos 2:30
Romanian Deadlift — 5 × 5 @ 80 kg — charge 82 % 1RM — repos 2:30
Hip Thrust — 5 × 5 @ 122.5 kg — charge 82 % 1RM — repos 2:00
Back Extension — 5 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie
Leg Curl — 3 × 10 — charge RPE 8 — repos 1:15
  schéma hypertrophie

Durée estimée 55'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Sumo Deadlift : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #172 — Fessiers · Force · 20' · Box · Avancé

seed `1171` · squelette `fessiers_force` · 1RM inconnus · relâchements : optional_slot_empty, slot_unilateral

```
Musculation · Fessiers · Force · 20' · Box

Sumo Deadlift — 3 × 3 — charge RPE 8 — repos 2:30
Romanian Deadlift — 4 × 3 — charge RPE 8 — repos 2:30

Durée estimée 20'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Sumo Deadlift : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #173 — Fessiers · Force · 30' · Box · Débutant

seed `1172` · squelette `fessiers_force` · 1RM inconnus · relâchements : optional_slot_empty, slot_role

```
Musculation · Fessiers · Force · 30' · Box

Hip Thrust — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Romanian Deadlift — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre

Durée estimée 29'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Hip Thrust : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #174 — Fessiers · Force · 45' · Salle · Débutant

seed `1173` · squelette `fessiers_force` · 1RM inconnus · relâchements : optional_slot_empty

```
Musculation · Fessiers · Force · 45' · Salle

Hip Thrust Machine — 5 × 4 — charge RPE 8 — repos 2:30
Romanian Deadlift — 5 × 4 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Hip Thrust — 4 × 4 — charge RPE 7 — repos 2:00
  monter jusqu'à une charge propre
Back Extension — 3 × 10 — charge poids du corps — repos 1:00
  schéma hypertrophie

Durée estimée 43'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Hip Thrust Machine : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #175 — Fessiers · Force · 60' · Box · Intermédiaire

seed `1174` · squelette `fessiers_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : bonus_slot, optional_slot_empty, slot_unilateral

```
Musculation · Fessiers · Force · 60' · Box

Hip Thrust — 5 × 5 @ 155 kg — charge 82 % 1RM — repos 2:30
Romanian Deadlift — 5 × 5 @ 102.5 kg — charge 82 % 1RM — repos 2:30
Sumo Deadlift — 5 × 5 @ 147.5 kg — charge 82 % 1RM — repos 2:00
Back Extension — 5 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie
Front Squat — 4 × 4 @ 100 kg — charge 85 % 1RM — repos 2:00

Durée estimée 60'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Hip Thrust : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #176 — Fessiers · Endurance musculaire · 60' · Salle · Intermédiaire

seed `1175` · squelette `fessiers_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : bonus_slot, tempo_311

```
Musculation · Fessiers · Endurance musculaire · 60' · Salle

Single-Leg Hip Thrust — 5 × 20 / jambe — charge poids du corps — repos 40s
  tempo 3-1-1
Romanian Deadlift — 5 × 20 @ 50 kg — charge 52 % 1RM — repos 40s
Glute Bridge — 4 × 20 — charge poids du corps — repos 40s
Leg Curl — 4 × 20 — charge RPE 7 — repos 40s
Superman Hold — 5 × 60 s — repos 30s
Bird Dog — 5 × 16 — charge poids du corps — repos 40s

Durée estimée 60'
Stimulus : Rythme continu, aucune série à l'échec
```

### #177 — Fessiers · Endurance musculaire · 20' · Box · Avancé

seed `1176` · squelette `fessiers_endurance` · 1RM inconnus · relâchements : slot_role

```
Musculation · Fessiers · Endurance musculaire · 20' · Box

DB Sumo Squat — 3 × 15 — charge RPE 7 — repos 40s
Single-Leg RDL (bodyweight) — 3 × 15 / jambe — charge poids du corps — repos 40s
Banded Hip Abduction — 3 × 15 — charge poids du corps — repos 40s
DB Romanian Deadlift — 3 × 15 — charge RPE 7 — repos 40s

Durée estimée 22'
Stimulus : Rythme continu, aucune série à l'échec
```

### #178 — Fessiers · Endurance musculaire · 30' · Sans matériel · Débutant

seed `1177` · squelette `fessiers_endurance` · 1RM inconnus · relâchements : bonus_slot, optional_slot_empty, slot_dropped, slot_muscle

```
Musculation · Fessiers · Endurance musculaire · 30' · Sans matériel

Reverse Lunge — 5 × 24 — charge poids du corps — repos 40s
Superman Hold — 5 × 60 s — repos 40s
Glute Bridge — 4 × 20 — charge poids du corps — repos 40s
Squat Hold — 3 × 45 s — repos 40s

Durée estimée 27'
Stimulus : Rythme continu, aucune série à l'échec
```

### #179 — Fessiers · Endurance musculaire · 45' · Salle · Débutant

seed `1178` · squelette `fessiers_endurance` · 1RM inconnus · relâchements : beginner_max, tempo_311

```
Musculation · Fessiers · Endurance musculaire · 45' · Salle

Hip Thrust — 5 × 20 — charge RPE 7 — repos 40s
  monter jusqu'à une charge propre · tempo 3-1-1
DB Romanian Deadlift — 5 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Cable Pull-Through — 4 × 20 — charge RPE 7 — repos 40s
  tempo 3-1-1
Leg Curl — 4 × 20 — charge RPE 7 — repos 40s

Durée estimée 41'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #180 — Fessiers · Endurance musculaire · 60' · Box · Intermédiaire

seed `1179` · squelette `fessiers_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : bonus_slot, slot_role

```
Musculation · Fessiers · Endurance musculaire · 60' · Box

Hip Thrust — 5 × 20 @ 100 kg — charge 52 % 1RM — repos 40s
Single-Leg RDL (bodyweight) — 5 × 20 / jambe — charge poids du corps — repos 40s
Banded Hip Abduction — 4 × 20 — charge poids du corps — repos 40s
Romanian Deadlift — 4 × 20 @ 65 kg — charge 52 % 1RM — repos 40s
Back Extension — 5 × 20 — charge poids du corps — repos 30s
Oblique Raise On Roman Chair — 3 × 18 / côté — charge poids du corps — repos 40s

Durée estimée 55'
Stimulus : Rythme continu, aucune série à l'échec
```

## Fessiers & ischios

### #181 — Fessiers & ischios · Hypertrophie · 20' · Salle · Intermédiaire

seed `1180` · squelette `fessiers_ischios_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_muscle, slot_unilateral, slots_dropped

```
Musculation · Fessiers & ischios · Hypertrophie · 20' · Salle

DB Romanian Deadlift — 3 × 8 — charge RPE 8 — repos 1:30
DB Hip Thrust — 3 × 8 — charge RPE 8 — repos 1:30
Good Morning — 3 × 8 — charge RPE 8 — repos 1:15

Durée estimée 18'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #182 — Fessiers & ischios · Hypertrophie · 30' · Box · Avancé

seed `1181` · squelette `fessiers_ischios_hypertrophie` · 1RM inconnus · relâchements : slot_muscle, slot_unilateral

```
Musculation · Fessiers & ischios · Hypertrophie · 30' · Box

Romanian Deadlift — 3 × 8 — charge RPE 8 — repos 1:30
Hip Thrust — 3 × 8 — charge RPE 8 — repos 1:30
DB Romanian Deadlift — 3 × 8 — charge RPE 8 — repos 1:15
Single-Leg Glute Bridge — 3 × 8 / jambe — charge poids du corps — repos 1:15
Nordic Curl — 3 × 8 — charge poids du corps — repos 1:15

Durée estimée 31'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #183 — Fessiers & ischios · Hypertrophie · 45' · Sans matériel · Débutant

seed `1182` · squelette `fessiers_ischios_hypertrophie` · 1RM inconnus · relâchements : rest_extended, slot_dropped, slot_muscle, slot_role, tempo_311

```
Musculation · Fessiers & ischios · Hypertrophie · 45' · Sans matériel

Reverse Lunge — 5 × 16 — charge poids du corps — repos 1:45
  tempo 3-1-1
Superman Hold — 5 × 60 s — repos 1:45
Glute Bridge — 5 × 15 — charge poids du corps — repos 1:30
  tempo 3-1-1

Durée estimée 43'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #184 — Fessiers & ischios · Hypertrophie · 60' · Salle · Débutant

seed `1183` · squelette `fessiers_ischios_hypertrophie` · 1RM inconnus · relâchements : beginner_max, rest_extended, slot_muscle, tempo_311

```
Musculation · Fessiers & ischios · Hypertrophie · 60' · Salle

DB Romanian Deadlift — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1
Hip Thrust Machine — 5 × 12 — charge RPE 8 — repos 1:45
  tempo 3-1-1
Romanian Deadlift — 5 × 12 — charge RPE 7 — repos 1:30
  monter jusqu'à une charge propre · tempo 3-1-1
Glute Bridge — 5 × 15 — charge poids du corps — repos 1:30
  tempo 3-1-1

Durée estimée 55'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #185 — Fessiers & ischios · Hypertrophie · 20' · Box · Intermédiaire

seed `1184` · squelette `fessiers_ischios_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_ids, slot_muscle, slot_unilateral, slots_dropped

```
Musculation · Fessiers & ischios · Hypertrophie · 20' · Box

DB Romanian Deadlift — 3 × 8 — charge RPE 8 — repos 1:30
Hip Thrust — 3 × 8 @ 137.5 kg — charge 72 % 1RM — repos 1:30
Romanian Deadlift — 3 × 8 @ 90 kg — charge 72 % 1RM — repos 1:15

Durée estimée 19'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #186 — Fessiers & ischios · Force · 20' · Salle · Intermédiaire

seed `1185` · squelette `fessiers_ischios_force` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : optional_slot_empty, slot_role

```
Musculation · Fessiers & ischios · Force · 20' · Salle

Romanian Deadlift — 3 × 3 @ 85 kg — charge 88 % 1RM — repos 2:30
Sumo Deadlift — 4 × 3 @ 122.5 kg — charge 88 % 1RM — repos 2:30

Durée estimée 20'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Romanian Deadlift : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #187 — Fessiers & ischios · Force · 30' · Box · Avancé

seed `1186` · squelette `fessiers_ischios_force` · 1RM inconnus · relâchements : optional_slot_empty, slot_role

```
Musculation · Fessiers & ischios · Force · 30' · Box

Romanian Deadlift — 5 × 4 — charge RPE 8 — repos 2:30
Hip Thrust — 5 × 4 — charge RPE 8 — repos 2:30

Durée estimée 29'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Romanian Deadlift : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #188 — Fessiers & ischios · Force · 45' · Box · Débutant

seed `1187` · squelette `fessiers_ischios_force` · 1RM inconnus · relâchements : optional_slot_empty, slot_objective

```
Musculation · Fessiers & ischios · Force · 45' · Box

Romanian Deadlift — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
Hip Thrust — 5 × 5 — charge RPE 7 — repos 2:30
  monter jusqu'à une charge propre
DB Romanian Deadlift — 3 × 12 — charge RPE 8 — repos 1:15
  schéma hypertrophie
Back Extension — 3 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie

Durée estimée 41'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Romanian Deadlift : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #189 — Fessiers & ischios · Force · 60' · Salle · Débutant

seed `1188` · squelette `fessiers_ischios_force` · 1RM inconnus · relâchements : optional_slot_empty, rest_extended, slot_role, tempo_311

```
Musculation · Fessiers & ischios · Force · 60' · Salle

Romanian Deadlift — 5 × 5 — charge RPE 7 — repos 2:45
  monter jusqu'à une charge propre · tempo 3-1-1
Hip Thrust Machine — 5 × 5 — charge RPE 8 — repos 2:45
  tempo 3-1-1
Leg Curl — 5 × 12 — charge RPE 8 — repos 1:30
  schéma hypertrophie · tempo 3-1-1
Back Extension — 5 × 12 — charge poids du corps — repos 1:00
  schéma hypertrophie · tempo 3-1-1

Durée estimée 56'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Romanian Deadlift : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #190 — Fessiers & ischios · Force · 20' · Box · Intermédiaire

seed `1189` · squelette `fessiers_ischios_force` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : optional_slot_empty, slot_objective

```
Musculation · Fessiers & ischios · Force · 20' · Box

Romanian Deadlift — 3 × 3 @ 110 kg — charge 88 % 1RM — repos 2:30
Hip Thrust — 4 × 3 @ 167.5 kg — charge 88 % 1RM — repos 2:30

Durée estimée 20'
Stimulus : RIR 2, dernière série RPE 9. Montée en charge sur Romanian Deadlift : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail
```

### #191 — Fessiers & ischios · Endurance musculaire · 20' · Salle · Intermédiaire

seed `1190` · squelette `fessiers_ischios_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_muscle

```
Musculation · Fessiers & ischios · Endurance musculaire · 20' · Salle

DB Romanian Deadlift — 3 × 18 — charge RPE 7 — repos 40s
DB Sumo Squat — 3 × 18 — charge RPE 7 — repos 40s
Superman Hold — 3 × 45 s — repos 40s
Leg Curl — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 20'
Stimulus : Rythme continu, aucune série à l'échec
```

### #192 — Fessiers & ischios · Endurance musculaire · 30' · Box · Avancé

seed `1191` · squelette `fessiers_ischios_endurance` · 1RM inconnus · relâchements : slot_muscle, slot_role

```
Musculation · Fessiers & ischios · Endurance musculaire · 30' · Box

DB Romanian Deadlift — 3 × 18 — charge RPE 7 — repos 40s
Hip Thrust — 3 × 18 — charge RPE 7 — repos 40s
Back Extension — 3 × 18 — charge poids du corps — repos 40s
Single-Leg RDL (bodyweight) — 3 × 18 / jambe — charge poids du corps — repos 40s
Superman Hold — 3 × 45 s — repos 30s

Durée estimée 30'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
```

### #193 — Fessiers & ischios · Endurance musculaire · 45' · Sans matériel · Débutant

seed `1192` · squelette `fessiers_ischios_endurance` · 1RM inconnus · relâchements : bonus_slot, optional_slot_empty, slot_dropped, slot_muscle, tempo_311

```
Musculation · Fessiers & ischios · Endurance musculaire · 45' · Sans matériel

Reverse Lunge — 5 × 24 — charge poids du corps — repos 40s
  tempo 3-1-1
Superman Hold — 5 × 60 s — repos 40s
Glute Bridge — 4 × 20 — charge poids du corps — repos 40s
  tempo 3-1-1
Bird Dog — 5 × 16 — charge poids du corps — repos 40s
  tempo 3-1-1

Durée estimée 42'
Stimulus : Rythme continu, aucune série à l'échec
```

### #194 — Fessiers & ischios · Endurance musculaire · 60' · Salle · Débutant

seed `1193` · squelette `fessiers_ischios_endurance` · 1RM inconnus · relâchements : optional_slot_empty, rest_extended, slot_muscle, tempo_311

```
Musculation · Fessiers & ischios · Endurance musculaire · 60' · Salle

DB Romanian Deadlift — 5 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1
Reverse Lunge — 5 × 24 — charge poids du corps — repos 1:10
  tempo 3-1-1
Leg Curl — 4 × 20 — charge RPE 7 — repos 1:10
  tempo 3-1-1
Back Extension — 5 × 20 — charge poids du corps — repos 1:10
  tempo 3-1-1

Durée estimée 57'
Stimulus : Rythme continu, aucune série à l'échec
```

### #195 — Fessiers & ischios · Endurance musculaire · 20' · Box · Intermédiaire

seed `1194` · squelette `fessiers_ischios_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_muscle, slot_role

```
Musculation · Fessiers & ischios · Endurance musculaire · 20' · Box

Single-Leg RDL (bodyweight) — 3 × 15 / jambe — charge poids du corps — repos 40s
Reverse Lunge — 3 × 16 — charge poids du corps — repos 40s
Back Extension — 3 × 15 — charge poids du corps — repos 40s
DB Romanian Deadlift — 3 × 15 — charge RPE 7 — repos 40s

Durée estimée 22'
Stimulus : Rythme continu, aucune série à l'échec
```

## Après ma classe

### #196 — Tronc · Hypertrophie · 15' · Salle · Intermédiaire · après « Back Squat + Thruster »

seed `2000` · squelette `tronc_hypertrophie` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_objective · muscles exclus : quadriceps, fessiers, epaules · cible suggérée : Tronc

```
Musculation · Tronc · Hypertrophie · 15' · Salle

Swiss Ball Crunch — 3 × 10 — charge poids du corps — repos 1:00
Hanging Oblique Knee Raise — 3 × 18 / côté — charge poids du corps — repos 1:00
Back Extension — 3 × 10 — charge poids du corps — repos 1:00

Durée estimée 16'
Stimulus : Dernière série à 1-2 reps de l'échec
Après ma classe : muscles évités quadriceps, fessiers, epaules
```

### #197 — Bas du corps · Endurance musculaire · 20' · Box · Avancé · après « Pull-ups + Push-ups + Strict Press »

seed `2001` · squelette `bas_endurance` · 1RM inconnus · relâchements : slot_role · muscles exclus : dos, biceps, pecs, triceps, epaules · cible suggérée : Bas du corps

```
Musculation · Bas du corps · Endurance musculaire · 20' · Box

Back Squat — 3 × 15 — charge RPE 7 — repos 40s
DB Hip Thrust — 3 × 15 — charge RPE 7 — repos 40s
DB Romanian Deadlift — 3 × 15 — charge RPE 7 — repos 40s
Suitcase Carry — 3 × 30 m / côté — charge RPE 7 — repos 30s

Durée estimée 21'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
Après ma classe : muscles évités dos, biceps, pecs, triceps, epaules
```

### #198 — Tronc · Hypertrophie · 30' · Box · Débutant · après « Deadlift + Box Jumps + Run 400 m »

seed `2002` · squelette `tronc_hypertrophie` · 1RM inconnus · relâchements : bonus_slot, optional_slot_empty, slot_muscle, slot_objective · muscles exclus : ischios, lombaires, dos, quadriceps, fessiers · cible suggérée : aucune (Tronc par défaut)

```
Musculation · Tronc · Hypertrophie · 30' · Box

Reverse Crunch — 5 × 12 — charge poids du corps — repos 1:00
Crunch With Rotation — 5 × 20 — charge poids du corps — repos 1:00
Mountain Climbers — 5 × 20 — charge poids du corps — repos 1:00
Push-ups — 3 × 10 — charge poids du corps — repos 1:15

Durée estimée 27'
Stimulus : Dernière série à 1-2 reps de l'échec
Après ma classe : muscles évités ischios, lombaires, dos, quadriceps, fessiers
```

### #199 — Tronc · Endurance musculaire · 15' · Salle · Débutant · après « Wall Balls + Row + Burpees »

seed `2003` · squelette `tronc_endurance` · 1RM inconnus · muscles exclus : quadriceps, fessiers, epaules, dos · cible suggérée : Tronc

```
Musculation · Tronc · Endurance musculaire · 15' · Salle

Dead Bug — 3 × 18 — charge poids du corps — repos 30s
Standing Broomstick Rotation — 3 × 18 — charge poids du corps — repos 30s
Farmer Carry — 3 × 40 m — charge RPE 7 — repos 30s
Back Extension — 3 × 18 — charge poids du corps — repos 30s

Durée estimée 15'
Stimulus : Rythme continu, aucune série à l'échec
Après ma classe : muscles évités quadriceps, fessiers, epaules, dos
```

### #200 — Bas du corps · Hypertrophie · 20' · Box · Intermédiaire · après « Bench Press + Toes-to-Bar »

seed `2004` · squelette `bas_hypertrophie` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · relâchements : slot_role, slots_dropped · muscles exclus : pecs, triceps, dos, biceps · cible suggérée : Bas du corps

```
Musculation · Bas du corps · Hypertrophie · 20' · Box

Back Squat — 3 × 8 @ 100 kg — charge 72 % 1RM — repos 1:30
DB Reverse Lunge — 3 × 8 / jambe — charge RPE 8 — repos 1:15
Good Morning — 3 × 8 — charge RPE 8 — repos 1:15

Durée estimée 19'
Stimulus : Dernière série à 1-2 reps de l'échec
Après ma classe : muscles évités pecs, triceps, dos, biceps
```

### #201 — Tronc · Endurance musculaire · 30' · Box · Intermédiaire · après « Clean & Jerk + Double-Unders »

seed `2005` · squelette `tronc_endurance` · 1RM connus (back_squat 110, deadlift 140, bench 85, press 55, hip_thrust 150) · PdC 72 kg · relâchements : slot_muscle · muscles exclus : ischios, lombaires, epaules · cible suggérée : aucune (Tronc par défaut)

```
Musculation · Tronc · Endurance musculaire · 30' · Box

Dead Bug — 4 × 20 — charge poids du corps — repos 30s
Hanging Oblique Knee Raise — 4 × 20 / côté — charge poids du corps — repos 30s
Suitcase Carry — 4 × 50 m / côté — charge RPE 7 — repos 30s
Oblique Crunch — 3 × 20 / côté — charge poids du corps — repos 30s

Durée estimée 28'
Stimulus : Rythme continu, aucune série à l'échec
Après ma classe : muscles évités ischios, lombaires, epaules
```

### #202 — Bas du corps · Hypertrophie · 15' · Salle · Avancé · après « Handstand Push-ups + Ring Rows »

seed `2006` · squelette `bas_hypertrophie` · 1RM inconnus · relâchements : slots_dropped · muscles exclus : epaules, dos · cible suggérée : Bas du corps

```
Musculation · Bas du corps · Hypertrophie · 15' · Salle

Front Squat — 3 × 10 — charge RPE 8 — repos 1:30
DB Reverse Lunge — 3 × 10 / jambe — charge RPE 8 — repos 1:15

Durée estimée 14'
Stimulus : Dernière série à 1-2 reps de l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
Après ma classe : muscles évités epaules, dos
```

### #203 — Haut du corps · Endurance musculaire · 20' · Box · Débutant · après « Front Squat + Kettlebell Swings »

seed `2007` · squelette `haut_endurance` · 1RM inconnus · relâchements : beginner_max · muscles exclus : quadriceps, fessiers · cible suggérée : Haut du corps

```
Musculation · Haut du corps · Endurance musculaire · 20' · Box

Bench Press — 3 × 18 — charge RPE 7 — repos 40s
  monter jusqu'à une charge propre
Chest Supported Row — 3 × 18 — charge RPE 7 — repos 40s
Strict Press — 3 × 18 — charge RPE 7 — repos 40s
  monter jusqu'à une charge propre
Overhead Triceps Extension — 3 × 18 — charge RPE 7 — repos 40s

Durée estimée 21'
Stimulus : Rythme continu, aucune série à l'échec. Renseigne tes 1RM dans le calculateur pour avoir des charges en kg
Après ma classe : muscles évités quadriceps, fessiers
```

### #204 — Haut du corps · Hypertrophie · 30' · Box · Débutant · après « Run 800 m + Sit-ups »

seed `2008` · squelette `haut_hypertrophie` · 1RM inconnus · relâchements : beginner_max · muscles exclus : aucun · cible suggérée : Haut du corps

```
Musculation · Haut du corps · Hypertrophie · 30' · Box

Push-ups — 4 × 12 — charge poids du corps — repos 1:30
Chest Supported Row — 4 × 12 — charge RPE 8 — repos 1:30
Pike Push-Ups — 3 × 12 — charge poids du corps — repos 1:15
Barbell Curl — 3 × 12 — charge RPE 8 — repos 1:15

Durée estimée 28'
Stimulus : Dernière série à 1-2 reps de l'échec
```

### #205 — Bas du corps · Endurance musculaire · 15' · Salle · Intermédiaire · après « Snatch + Bar Muscle-ups »

seed `2009` · squelette `bas_endurance` · 1RM connus (back_squat 140, deadlift 180, bench 105, press 65, hip_thrust 190) · PdC 88 kg · muscles exclus : dos, biceps, epaules · cible suggérée : Bas du corps

```
Musculation · Bas du corps · Endurance musculaire · 15' · Salle

Goblet Squat — 2 × 15 — charge RPE 7 — repos 40s
Hip Thrust — 3 × 15 @ 115 kg — charge 60 % 1RM — repos 40s
Leg Curl — 3 × 15 — charge RPE 7 — repos 40s
Stomach Vacuum — 3 × 30 s — repos 30s

Durée estimée 16'
Stimulus : Rythme continu, aucune série à l'échec
Après ma classe : muscles évités dos, biceps, epaules
```

