/**
 * Textes anglais du moteur (étude i18n « Moteur », PR M2).
 *
 * Même structure que `fr.ts` (le type `Textes` l'impose, et `i18n-parite.test.ts`
 * vérifie les clés et le nombre de paramètres). Aucune dépendance. Le texte
 * ENREGISTRÉ reste le français : cette langue ne sert qu'à l'affichage, quand
 * l'app la demandera (M4, M5).
 *
 * Vocabulaire tranché le 13/10/2026 (plan.md, § 7) : en-têtes de format inchangés,
 * round / rounds au vrai pluriel, rest, step, Weighted vest (optional),
 * Weightlifting, Strength (bloc de force et Musculation), Warm-up / Cool-down /
 * Stretching, Step A / B / C, kg seulement, leg / arm / side ; termes techniques
 * inchangés (Building, Finisher, Skill, Death by, Chipper, Ladder, Tabata, E3MOM,
 * RPE, RIR, 1RM, Scaled, RX, Pro). Cibles, objectifs, matériel, niveaux, côtés et
 * types de score : mêmes mots que `src/i18n/locales/en.json` (`i18n-en-app.test.ts`).
 */
import type { Textes } from './fr';

const min = (m: number | string) => `${m} min`;
const plural = (n: number | null, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const rounds = (n: number | null) => plural(n, 'round', 'rounds');

/** Libellés des types de score : `wod.scoreType.*` et `bo.interComp.scoring.*` de l'app quand ils existent. */
const SCORE: Record<string, string> = {
  time: 'Time', rounds_reps: 'Rounds+Reps', reps_total: 'Reps', cal_total: 'Total calories', distance: 'Distance',
};

/** Muscles évités après la classe (ids du moteur). */
const MUSCLE: Record<string, string> = {
  pecs: 'Chest', epaules: 'Shoulders', epaules_ant: 'Front delts', epaules_post: 'Rear delts', triceps: 'Triceps', dos: 'Back',
  lombaires: 'Lower back', biceps: 'Biceps', quadriceps: 'Quads', ischios: 'Hamstrings', fessiers: 'Glutes', mollets: 'Calves',
  tronc: 'Core', trapezes: 'Traps', avant_bras: 'Forearms', obliques: 'Obliques', coiffe: 'Rotator cuff',
};

export const en: Textes = {
  categories: {
    scaled: 'Scaled', inter: 'Inter', rx: 'RX', rxplus: 'RX+', elite: 'Elite', pro: 'Pro',
    women: 'Women', men: 'Men', women_pro: 'Women Pro', men_pro: 'Men Pro',
  },

  duree: {
    minutes: min,
    minutesSecondes: (m: number, ss: string) => `${m}:${ss}`,
  },

  rendu: {
    cap: (t: string) => ` (cap ${t})`,
    amrap: (m: number) => `AMRAP ${m}`,
    forTime: (cap: string) => `For time${cap}`,
    forTimeSchema: (schema: string, cap: string) => `For time · ${schema}${cap}`,
    roundsForTime: (n: number, cap: string) => `${rounds(n)} for time${cap}`,
    chipper: (cap: string) => `Chipper · for time${cap}`,
    ladderOuverte: (a: number, b: number, c: number, m: number) => `Ladder ${a}-${b}-${c}… · AMRAP ${m}`,
    ladderOuverteConsigne: (pas: number) => `Climb the steps (+${pas} each step) until time is up, score = total reps`,
    ladderFinie: (schema: string, cap: string) => `Ladder ${schema} · for time${cap}`,
    ladderFinieConsigne: 'Complete every listed step once',
    emom: (m: number, every: string, stations: number) => `EMOM ${m}${every} · ${plural(stations, 'station', 'stations')} alternating`,
    emomEvery: (t: string) => ` · every ${t}`,
    deathBy: (m: number) => `EMOM ${m} · Death by: +1 rep each minute until failure`,
    tabata: (transition: string) => `Tabata × 2 blocks · 8 × 20 s / 10 s${transition}`,
    tabataTransition: (s: number) => `, ${s} s transition`,
    intervalEvery: (n: number, t: string) => `${rounds(n)} · every ${t}`,
    intervalRepos: (n: number, t: string) => `${rounds(n)} · ${t} rest between efforts`,
    stations: (n: number, k: number, work: number, rest: number) => `${rounds(n)} × ${plural(k, 'station', 'stations')} · ${work} s on / ${rest} s off`,
    continu: (m: number) => `Continuous ${min(m)} · rotation without rest, score = total distance`,

    ligneTabata: (i: number, nom: string, tenue: boolean) => `Tabata ${i} · ${nom} (${tenue ? '20 s hold' : 'max reps'})`,
    ligneStationTenue: (i: number, nom: string) => `Station ${i} · ${nom} (hold)`,
    ligneStation: (i: number, nom: string, unite: string, cible: string) => `Station ${i} · ${nom} (max ${unite}, target ${cible})`,
    ligneRound: (round: number, ligne: string) => `R${round} · ${ligne}`,
    lignePalier: (ligne: string) => `${ligne} (between each step)`,
    ligneParMinute: (nom: string) => `${nom} · minute 1: 1 rep, +1 rep each minute`,
    ligneAvantSerie: (ligne: string) => `${ligne} (before each set)`,
    ligneMinute: (i: number, ligne: string) => `Min ${i} · ${ligne}`,

    substitution: (categories: string, nom: string) => `${categories}: ${nom}`,
    gilet: (h: number, f: number) => `Weighted vest ${h}/${f} kg`,
    giletOptionnel: (h: number, f: number) => `Weighted vest (optional) ${h}/${f} kg`,
    stimulus: (rpe: string, note: string, cible: string) => `Stimulus: RPE ${rpe} — ${note}${cible}`,
    stimulusCible: (cat: string, cible: string, cap: string) => ` Target ${cat}: ${cible}${cap}.`,
    stimulusCap: (t: string) => `, cap ${t}`,
    notes: (note: string, score: string) => `${note} Score: ${SCORE[score] ?? score}.`,
    titreEmom: (m: number) => `EMOM ${m}`,

    titre: {
      for_time: 'For time', rounds_for_time: (n: number | null) => rounds(n), chipper: 'Chipper', ladder: 'Ladder',
      death_by: 'Death by', tabata: 'Tabata', interval: 'Intervals', stations: 'Stations', continuous: 'Continuous',
    },
  },

  estimation: {
    rounds: (n: number) => `≈ ${rounds(n)}`,
    temps: (t: string) => `≈ ${t}`,
    palierPartiel: (palier: number, pct: number, suivant: number) => `step ${palier} + ${pct}% of step ${suivant}`,
    palier: (palier: number) => `step ${palier}`,
    premierPalier: 'step 1 partial',
    minuteComplete: (m: number) => `minute ${m} completed`,
    minute: (m: number) => `minute ${m}`,
    emom: (cycles: number, lo: number, hi: number, every: number) => `${plural(cycles, 'cycle', 'cycles')}, work ${lo}-${hi} s / ${every} s`,
    tabata: 'min reps over 8 × 20 s per block',
    stations: (n: number, k: number, work: number, rest: number) => `${rounds(n)} × ${plural(k, 'station', 'stations')}, ${work} s on / ${rest} s off`,
    distance: (m: number) => `≈ ${m} m`,
    parIntervalle: (t: string) => `work ≈ ${t} per interval`,
    parRepetition: (t: string) => `≈ ${t} per effort`,
  },

  generation: {
    aucunSquelette: 'No compatible skeleton',
    aucunWod: (tirages: number) => `No valid WOD after ${plural(tirages, 'draw', 'draws')}`,
  },

  musculation: {
    cible: {
      fessiers: 'Glutes', fessiers_ischios: 'Glutes + hamstrings', bas: 'Lower body', full_body: 'Full body', tronc: 'Core',
      haut: 'Upper body', dos: 'Back', epaules: 'Shoulders', bras: 'Arms', pecs: 'Chest', push: 'Push', pull: 'Pull', jambes: 'Legs',
    },
    objectif: { hypertrophie: 'Muscle gain', force: 'Max Strength', endurance: 'Toning' },
    materiel: { none: 'No equipment', box: 'Box', gym: 'Gym' },
    niveau: { debutant: 'Beginner', inter: 'Intermediate', avance: 'Advanced' },
    rir: {
      hypertrophie: 'last set 1-2 reps short of failure',
      force: 'RIR 2, last set at RPE 9',
      endurance: 'steady pace, no set to failure',
    },
    cote: { jambe: 'leg', bras: 'arm', cote: 'side' },
    note: {
      schemaHypertrophie: 'hypertrophy scheme',
      chargePropre: 'build up to a clean load',
      troisiemeCompound: '3rd compound: 70-75% × 6-8',
      debutantBanded: 'Beginner: banded',
      tempo: (t: string) => `tempo ${t}`,
    },
    refus: {
      forceApresClasse: 'After my class: Max Strength is not offered (Muscle gain or Toning)',
      forceSansMateriel: 'No equipment: Max Strength is unavailable',
      forceTronc: 'Core: Max Strength is not offered (Muscle gain or Toning)',
      cibleIndisponible: (cible: string, materiel: string) => `${cible}: no exercise available for this level (${materiel})`,
    },
    monteeEnCharge: (nom: string) => `Ramp-up on ${nom}: 5 @ 50% · 3 @ 65% · 2 @ 75% before the work sets`,
    renseigne1rm: 'Enter your 1RMs in the calculator to get loads in kg',
    charge: {
      kgPourcent: (kg: number | undefined, pct: number | undefined) => `${kg} kg (${pct}%)`,
      pourcent1rm: (pct: number | undefined) => `${pct}% 1RM`,
      leste: (kg: number, rpe: number | undefined) => `weighted ${kg} kg, RPE ${rpe}`,
      lesteLeger: (rpe: number | undefined) => `light weight, RPE ${rpe}`,
      elastique: 'band',
      poidsDuCorps: 'bodyweight',
      rpePourcent: (rpe: number | undefined, pct: number) => `RPE ${rpe} (≈ ${pct}% of 1RM)`,
      rpe: (rpe: number | undefined) => `RPE ${rpe}`,
    },
    ligne: {
      kg: (kg: number, pct: number | undefined) => ` @ ${kg} kg — load ${pct}% 1RM`,
      pourcent: (rpe: number | undefined, pct: number | undefined) => ` — RPE ${rpe} (≈ ${pct}% of 1RM)`,
      leste: (kg: number, rpe: number | undefined) => ` — weighted ${kg} kg (10% of bodyweight), RPE ${rpe}`,
      lesteLeger: (rpe: number | undefined) => ` — light weight, RPE ${rpe}`,
      rpePourcent: (rpe: number | undefined, pct: number) => ` — load RPE ${rpe} (≈ ${pct}% of 1RM)`,
      rpe: (rpe: number | undefined) => ` — load RPE ${rpe}`,
      elastique: ' — band',
      poidsDuCorps: ' — bodyweight',
      repos: (t: string) => ` — rest ${t}`,
    },
    titre: (cible: string, objectif: string) => `${cible} · ${objectif}`,
    entete: (cible: string, objectif: string, m: number, materiel: string) => `Strength · ${cible} · ${objectif} · ${min(m)} · ${materiel}`,
    dureeEstimee: (m: number) => `Estimated duration ${min(m)}`,
    stimulus: (note: string) => `Stimulus: ${note}`,
    musclesEvites: (muscles: string[]) => `After my class: muscles avoided ${muscles.map((m) => MUSCLE[m] ?? m).join(', ')}`,
  },

  seance: {
    serie: {
      pourcent: (pct: number) => ` @ ${pct} %1RM`,
      repos: (t: string) => ` — rest ${t}`,
      tempo: (t: string) => ` — tempo ${t}`,
      charge: (note: string) => ` — ${note}`,
    },
    halteroComplexe: (nom: string, variante: string, complexe: string) => `Weightlifting — complex ${nom} (${variante}): ${complexe}`,
    halteroConsigne: 'One complex = one rep, without letting go of the bar. No known 1RM: build up to a clean load.',
    force: (nom: string) => `Strength — ${nom}`,
    forceTempo: (t: string) => `Tempo ${t} on the work sets. No known 1RM: last set at RPE 8.`,
    skill: (nom: string) => `Skill — ${nom}: 3-step progression`,
    etapeA: (texte: string, duree: string) => `Step A: ${texte} — ${duree}`,
    etapeB: (texte: string, duree: string) => `Step B: ${texte} — ${duree}`,
    etapeC: (every: string, n: number) => `Step C: Every ${every} × ${n}`,
    building: (nom: string, tempo: string) => `Building — ${nom} tempo ${tempo}`,
    finisher: (n: number) => `Finisher — ${rounds(n)}, steady pace:`,
    stationBox: (h: number, f: number) => `(box ${h}/${f} cm)`,
    pro: (lignes: string) => `Women Pro / Men Pro: ${lignes}`,
    stationEvery: (every: string, n: number) => `Every ${every} × ${n}:`,
    stationRotation: (every: string, n: number) => `Every ${every} × ${n}, rotating:`,
    impair: 'Odd · ',
    pair: 'Even · ',
    poste: (i: number) => `Station ${i} · `,
    chargeLourde: 'Only heavy load of the week. Continuous push, never jerky.',
    intervallesCourse: (label: string, repos: string) => `Run intervals — ${label}, rest ${repos}`,
    allureCible: (cible: string) => `Target pace: ${cible}. The gap between the first and last interval stays under 5 s.`,
    autresVariantes: (labels: string) => `Other variants in the cycle: ${labels}`,
    compromiseRounds: (n: number) => `${rounds(n)}:`,
    compromiseStation: (i: number, work: number, ligne: string) => `${i}. ${work} s of station — ${ligne}`,
    compromiseCourse: (m: number, cible: string) => `   then ${m} m Run at target pace (${cible})`,
    compromiseTotal: (m: number) => `Total run: ${m} m. Hold the pace on loaded legs, do not sprint the station.`,
    enchainement: (tours: number) => `Timed sequence — ${rounds(tours)}, in order:`,
    enchainementLigne: (i: number, m: number, ligne: string) => `${i}. ${m} m Run then ${ligne}`,
    enchainementScore: (score: string) => `Score: ${score}. Note the time of each segment.`,
    type: {
      weightlifting: 'Weightlifting', strength: 'Strength', skill: 'Skill',
      station: 'Station strength', run: 'Run', race: 'Simulation', compromised: 'Compromised run',
    },
    titreBuilding: (nom: string) => `Building · ${nom}`,
    titreFinisher: 'Finisher',
    titreRetourAuCalme: 'Cool-down',
    notePourcentages: 'Percentages of the full-movement 1RM; without a 1RM, clean load.',
    noteChronometree: 'Timed from start to finish: compare with your last simulation.',
  },

  jours: { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' },

  programmation: {
    piste: { functional: 'Functional', hybrid: 'Hybrid', musculation: 'Strength' },
  },

  banque: {
    stimulus: {
      chipper_descending: 'Pace it, no sprint before the last third.',
      chipper_stations_erg: 'Stations back to back, ergs at 85%.',
      couplet_amrap_short: 'Steady pace, no broken set before halfway.',
      couplet_for_time_21_15_9: 'Sprint, short sets from round 1.',
      death_by: 'Stops when the minute can no longer be held.',
      emom_alternating: 'Keep at least a third of each interval to recover.',
      engine_long_amrap: 'Zone 3, controlled breathing from start to finish.',
      gym_density: 'Technique, no muscle failure.',
      heavy_couplet: 'Heavy load, unbroken sets, the mono is active recovery.',
      interval_work_rest: 'Each interval is a sprint, full rest.',
      ladder_ascending: 'The first steps are done without dropping the bar.',
      ladder_finite: 'Progressive rhythm, keep clean sets at the top.',
      stations_rotation: 'Max effort on each station, incomplete rest on purpose.',
      tabata_pair: 'Score = sum of the min reps of each block.',
      triplet_amrap_mid: 'Sustainable for 20 min, fast transitions.',
      triplet_for_time_classics: 'Short transitions and broken-up sets before failure.',
      triplet_rounds_for_time: 'Consistent rounds, the bar stays up until the end of the set.',
      amrap_distances: 'Steady pace, each round within 15 s of the previous one.',
      chipper_hybrid: 'Run to open and close, stations linked at a steady pace.',
      compromised_run: 'Run fast on tired legs: 5 km pace + 15 s/km.',
      core_carry_finisher: 'Posture and bracing, never to failure.',
      emom_hybrid: 'Erg, run and load alternating; keep a third of each start to recover.',
      engine_continuous: 'Zone 3, conversation hard but possible. Rotation without rest until time is up.',
      engine_negative_split: 'Zone 3, sustainable nasal breathing. Second half a notch faster than the first, never going into zone 4.',
      erg_pyramid: 'Pyramid at a steady pace, the short station restarts without breaking rhythm.',
      half_sim: 'Half race, manage it like a competition day.',
      run_intervals: '5 km pace or faster, consistent between efforts.',
      run_into_station: 'Run at 90% of 5 km pace, stations without a break.',
      sled_repeats: 'Heavy and short, real rest between rounds.',
      stations_interval: 'Legs / shoulders / mono alternating, 90 s of max-effort work.',
    },

    seance: {
      S1_snatch: { label: 'Weightlifting · Snatch', echauffement: 'Warm-up (10 min) — shoulder and hip mobility, empty bar: Snatch Deadlift, Muscle Snatch, Overhead Squat, Snatch Balance, sets of 5.' },
      S2_squat: { label: 'Strength · Squat', echauffement: 'Warm-up (10 min) — easy bike or rower, ankle and hip mobility, Air Squats, light Goblet Squats, glute activation.' },
      S3_gym: { label: 'Gym · Skill', echauffement: 'Warm-up (10 min) — shoulder and wrist mobility, Scap Pull-Ups, Kip Swings, Hollow / Arch, handstand walk facing the wall.' },
      S4_cj: { label: 'Weightlifting · Clean & Jerk', echauffement: 'Warm-up (10 min) — wrist and hip mobility, empty bar: Clean Deadlift, Muscle Clean, Front Squat, Push Press, Push Jerk, sets of 5.' },
      S5_hinge: { label: 'Strength · Hinge', echauffement: 'Warm-up (10 min) — easy rower, hamstring and hip mobility, empty-bar Good Mornings, Glute Bridges, light Kettlebell Swings.' },
      S6_long: { label: 'Long · Engine', echauffement: 'Long warm-up (18 min) — 3 easy rounds: 2 min of any erg, Inchworms, Spiderman Lunges, Scap Pull-Ups, Air Squats; then the metcon movements unloaded.' },
      H1_intervals: { label: 'Intervals', echauffement: 'Warm-up (10 min) — 800 m progressive run, 10 leg swings / leg, 10 air squats, 10 push-ups, 2 × 20 s skipping.' },
      H2_strength_stations: { label: 'Strength & stations', echauffement: 'Warm-up (10 min) — 500 m easy rower, 10 empty-bar hip hinges, 10 lunges / leg, 10 push-ups, 20 m bear crawl.' },
      H3_run: { label: 'Run', echauffement: 'Warm-up (12 min) — 1 km progressive, drills (butt kicks, high knees, side shuffles) 2 × 20 m, 3 × 30 m strides.' },
      H4_engine: { label: 'Engine', echauffement: 'Warm-up (8 min) — 400 m easy run, 10 air squats, 10 push-ups, 5 inchworms.' },
      H5_compromised: { label: 'Compromised run', echauffement: 'Warm-up (10 min) — 600 m run, 10 hip hinges, 10 lunges / leg, 20 m empty sled, 10 light wall balls.' },
      H6_simulation: { label: 'Simulation', echauffement: 'Warm-up (12 min) — 1 km progressive, drills, then 20 m of each station unloaded.' },
      H6_simulation_full: { label: 'Simulation · block test', echauffement: 'Warm-up (12 min) — 1 km progressive, drills, then 20 m of each station unloaded. Get your gear ready: the session runs without stopping.' },
    },

    serie: {
      montee: 'ramp-up',
      e3mom6070: 'E3MOM · 60-70%',
      e3mom7075: 'E3MOM · 70-75%',
      pct8085: '80-85%',
      strict: 'strict, quality over quantity',
      buildingTempo: 'building tempo',
    },

    building: { b_snatch_balance: 'Snatch Balance' },

    skill: {
      skill_c2b: {
        a: 'Wide Kip Swings + Scap Pull-Ups (3 × 8), hips closing toward the bar',
        b: 'Band-assisted Chest-to-Bar or Jumping C2B with a chest pause at the bar (3 × 5)',
        substitutions: { scaled: 'Banded Pull-Ups', inter: 'Pull-ups', rxplus: 'Chest-to-Bar', elite: 'Bar Muscle-ups', pro: 'Bar Muscle-ups' },
      },
      skill_hspu: {
        a: 'Handstand Hold facing the wall (3 × 30 s), braced with locked elbows',
        b: '5 s negatives in Handstand Push-Up or Pike Push-Ups with feet on a box (3 × 5)',
        substitutions: { scaled: 'Pike Push-Ups', inter: 'Half Wall Walks', rxplus: 'Strict Handstand Push-Ups', elite: 'Strict Handstand Push-Ups', pro: 'Strict Handstand Push-Ups' },
      },
      skill_bmu: {
        a: 'Kip Swings with high hips + explosive Chest-to-Bar (3 × 5), path toward the bar',
        b: 'Band-assisted Bar Muscle-Ups or jumping from a low box, transition and dip (3 × 3)',
        substitutions: { scaled: 'Banded Pull-Ups', inter: 'Chest-to-Bar', rxplus: 'Bar Muscle-ups', elite: 'Ring Muscle-ups', pro: 'Ring Muscle-ups' },
      },
      skill_rmu: {
        a: 'False grip Hang + false grip Ring Rows (3 × 8), rings to the sternum',
        b: 'Feet-on-floor transitions on low rings then deep Ring Dips (3 × 4)',
        substitutions: { scaled: 'Ring Rows false grip', inter: 'Chest-to-Bar', rxplus: 'Bar Muscle-ups', elite: 'Ring Muscle-ups', pro: 'Ring Muscle-ups' },
      },
      skill_rope: {
        a: 'Foot lock on the floor (J-hook / S-wrap) and seated → standing Rope Pulls (3 × 5)',
        b: 'Low climbs in 3 pulls with a pause at each lock (3 × 2)',
        substitutions: { scaled: 'Rope Pulls From Floor', inter: 'Rope Climbs', rxplus: 'Rope Climbs', elite: 'Legless Rope Climbs', pro: 'Legless Rope Climbs' },
      },
      skill_wall_walk: {
        a: 'Plank Hold with feet on the wall + Bear Crawl (3 × 20 s), pelvis tucked',
        b: 'Half Wall Walks with a 3 s pause at the top (3 × 3)',
        substitutions: { scaled: 'Half Wall Walks', inter: 'Wall Walks', rxplus: 'Wall Walks', elite: 'Wall Walks + 5 Shoulder Taps', pro: 'Wall Walks + 5 Shoulder Taps' },
      },
      skill_hs_walk: {
        a: 'Handstand Hold back to the wall (3 × 30 s) then Shoulder Taps (3 × 10), fingers gripping the floor',
        b: 'Off the wall: Handstand Walk 2-3 steps then back (3 × 4 attempts)',
        substitutions: { scaled: 'Handstand Shoulder Taps', inter: 'Half Wall Walks', rxplus: 'Handstand Walk', elite: 'Handstand Walk', pro: 'Handstand Walk' },
      },
    },

    finisher: {
      core_dead_bug_side_plank: { dead_bug: 'Dead Bug (each side)', side_plank: 'Side Plank (each side)' },
      core_t2b_l_sit: { l_sit: 'L-Sit on parallettes' },
      carry_sandbag_bear_hug: { sandbag_carry: 'Sandbag Bear Hug Carry' },
      carry_suitcase_plank: { suitcase_carry: 'Suitcase Carry (each side)', side_plank: 'Side Plank (each side)' },
      carry_overhead_kb: { kb_overhead_carry: 'KB Overhead Carry (each arm)' },
      carry_front_rack_db: { db_front_rack_carry: 'DB Front Rack Carry' },
      shoulders_face_pull_raise: { face_pull: 'Band Face Pull', lateral_raise: 'Light Lateral Raise' },
      shoulders_band_pull_apart_y: { band_pull_apart: 'Band Pull-Aparts', db_y_raise: 'DB Y-Raise' },
      shoulders_cuban_press_hold: { cuban_press: 'Light Cuban Press' },
      glutes_bridge_clam: { banded_clamshell: 'Banded Clamshells (each side)' },
      glutes_hip_thrust_monster: { monster_walk: 'Band Monster Walk' },
      glutes_kickback_swing: { glute_kickback: 'Band Glute Kickback (each side)' },
      glutes_single_leg_bridge_step_up: { single_leg_glute_bridge: 'Single-Leg Glute Bridge (each side)' },
      calves_raise_jump: { bodyweight_calf_raise: 'Calf Raises on a step' },
      calves_single_leg_hold: { single_leg_calf_raise: 'Single-Leg Calf Raise (each side)', calf_raise_hold: 'Calf Raise Hold at the top' },
      breathing_row_nasal: { row: 'Row with nasal breathing', box_breathing: 'Box Breathing 4-4-4-4' },
      breathing_bike_exhale: { bike_erg: 'Easy Bike Erg', slow_exhale: 'Breathing: 4 s in / 8 s out' },
      h_core_deadbug_side: { plank_hold: 'Side Plank (each side)' },
      h_core_pallof: { plank_hold: 'Pallof Press hold (each side)' },
      h_post_rdl_bridge: { bodyweight_single_leg_rdl: 'Bodyweight Single-Leg RDL (each leg)' },
      h_breath_row: { row: 'Row with nasal breathing' },
      h_breath_ski: { ski_erg: 'Easy SkiErg, nasal breathing' },
      h_breath_bike: { bike_erg: 'Easy Bike Erg, nasal breathing' },
      h_shoulders_carry: { suitcase_carry: 'Overhead Carry (each side)' },
      h_breath_row_long: { row: 'Easy Row, nasal breathing' },
    },

    poste: {
      stepUpsLestes: 'Weighted Box Step-ups (2 × DB)',
      rowTenable: 'Row — sustainable pace, neither sprint nor stroll',
      skiTenable: 'SkiErg — sustainable pace',
      bikeTenable: 'Bike Erg — sustainable pace',
    },

    retourAuCalme: [
      [
        'Cool-down (8 min) — 600 m very slow jog or 5 min easy bike, nasal breathing.',
        'Stretching: standing hamstrings 45 s / leg · hip flexors in a lunge 45 s / side · calves against the wall 45 s / leg.',
      ],
      [
        'Cool-down (8 min) — 5 min very easy rower, shoulders relaxed.',
        'Stretching: seated posterior chain 45 s · pigeon 45 s / side · thoracic opener against the wall 45 s / arm.',
      ],
      [
        'Cool-down (6 min) — 400 m brisk walk then 4-6 breathing lying down, 2 min.',
        'Stretching: standing quads 45 s / leg · frog adductors 45 s · psoas in a low lunge 45 s / side.',
      ],
    ],

    course: {
      variantes: [
        { label: '8 × 400 m', cible: '5 km pace' },
        { label: '5 × 800 m', cible: '10 km pace − 10 s/km' },
        { label: '3 × 1,600 m', cible: '10 km pace' },
        { label: '12 × 200 m shuttle', cible: 'fast, even pace' },
      ],
      compromiseCible: '5 km pace + 15 s/km',
      scoreSimulation: 'total time',
    },
  },
};
