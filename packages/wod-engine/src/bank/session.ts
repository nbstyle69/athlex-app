import type { Pattern, SessionBlockAOption, SessionBlockBOption, SessionFinisherOption, SessionSkeleton, StrengthStep } from '../types';

/**
 * Squelettes de séance Functional / Hybrid (brief J1 §3-§4) : un par jour, lundi → samedi.
 * Bloc A en grammaire `strength` (% du 1RM, jamais de kg), bloc C tiré dans la banque
 * Functional existante avec `pattern_not` = pattern lourd du bloc A.
 */

export const SESSION_BANK_VERSION = 2;

// Montées et progressions (brief §4)
const WL_STEPS: StrengthStep[] = [
  { sets: 2, reps: 2, percent: 30, rest_s: 60, note: 'montée' },
  { sets: 2, reps: 2, percent: 50, rest_s: 60, note: 'montée' },
  { sets: 4, reps: 1, percent: 65, rest_s: 180, note: 'E3MOM · 60-70 %' },
  { sets: 4, reps: 1, percent: 72, rest_s: 180, note: 'E3MOM · 70-75 %' },
];
const STRENGTH_RAMP: StrengthStep[] = [
  { sets: 1, reps: 5, percent: 40, rest_s: 90, note: 'montée' },
  { sets: 1, reps: 5, percent: 50, rest_s: 90, note: 'montée' },
  { sets: 1, reps: 3, percent: 60, rest_s: 120, note: 'montée' },
];
const FIVE_BY_FIVE: StrengthStep[] = [...STRENGTH_RAMP, { sets: 5, reps: 5, percent: 75, rest_s: 150 }];
const FIVE_BY_THREE: StrengthStep[] = [...STRENGTH_RAMP, { sets: 5, reps: 3, percent: 82, rest_s: 180, note: '80-85 %' }];

const building = (id: string, movement: string, pattern: Pattern, tempo: string, percent: number | null = 55, name?: string): SessionBlockBOption => ({
  id, movement, pattern, tempo, minutes: 8, ...(name ? { name } : {}),
  steps: [{ sets: 3, reps: 5, percent, rest_s: 90, note: percent === null ? 'strict, qualité avant quantité' : 'building tempo' }],
});

// Options de bloc B par squelette (P1) : exercice ≠ A, pattern ≠ pattern lourd de A, jamais deux fois le même B dans la semaine.
const B_OHS = building('b_ohs_tempo', 'overhead_squat', 'squat', '3-1-1-1');
const B_SNATCH_BALANCE = building('b_snatch_balance', 'snatch_balance', 'squat', '2-0-X-1', 50, 'Snatch Balance');
const B_STRICT_PULL_UP = building('b_strict_pull_up', 'strict_pull_up', 'pull_v', '2-1-2-1', null);
const B_PUSH_PRESS = building('b_push_press_tempo', 'push_press', 'push_v', '2-0-1-2');
const B_STRICT_PRESS = building('b_strict_press_tempo', 'strict_press', 'push_v', '3-0-1-1');
const B_RING_DIP = building('b_ring_dip', 'ring_dip', 'push_v', '2-1-2-1', null);
const B_STRICT_HSPU = building('b_strict_hspu', 'strict_handstand_push_up', 'push_v', '2-1-2-1', null);
const B_FRONT_SQUAT = building('b_front_squat_pause', 'front_squat', 'squat', '2-2-X-1');
const B_FRONT_RACK_LUNGE = building('b_front_rack_lunge', 'front_rack_lunge', 'lunge', '2-1-1-1');
const B_GHD = building('b_ghd_sit_up', 'ghd_sit_up', 'core', '2-1-1-1', null);

const S1_A: SessionBlockAOption[] = [
  { id: 'snatch_complex_a', kind: 'weightlifting', movement: 'power_snatch', weeks: 'even', minutes: 20,
    complex: ['hang_power_snatch', 'power_snatch', 'overhead_squat'], steps: WL_STEPS },
  { id: 'snatch_complex_b', kind: 'weightlifting', movement: 'squat_snatch', weeks: 'odd', minutes: 20,
    complex: ['power_snatch', 'hang_power_snatch', 'squat_snatch'], steps: WL_STEPS },
];
const S4_A: SessionBlockAOption[] = [
  { id: 'cj_complex_a', kind: 'weightlifting', movement: 'clean_and_jerk', weeks: 'even', minutes: 20,
    complex: ['power_clean', 'front_squat', 'push_jerk'], steps: WL_STEPS },
  { id: 'cj_complex_b', kind: 'weightlifting', movement: 'clean_and_jerk', weeks: 'odd', minutes: 20,
    complex: ['hang_power_clean', 'squat_clean', 'split_jerk'], steps: WL_STEPS },
];
const S2_A: SessionBlockAOption[] = [
  { id: 'back_squat_5x5', kind: 'strength', movement: 'back_squat', weeks: 'even', minutes: 18, steps: FIVE_BY_FIVE, tempo: '3-1-X-1' },
  { id: 'front_squat_5x3', kind: 'strength', movement: 'front_squat', weeks: 'odd', minutes: 18, steps: FIVE_BY_THREE, tempo: '2-1-X-1' },
];
const S5_A: SessionBlockAOption[] = [
  { id: 'deadlift_5x3', kind: 'strength', movement: 'deadlift', weeks: 'even', minutes: 18, steps: FIVE_BY_THREE, tempo: '2-0-X-2' },
  { id: 'rdl_5x5', kind: 'strength', movement: 'romanian_deadlift', weeks: 'odd', minutes: 18, steps: FIVE_BY_FIVE, tempo: '3-1-1-1' },
  { id: 'sumo_5x5', kind: 'strength', movement: 'sumo_deadlift', weeks: 'odd', minutes: 18, steps: FIVE_BY_FIVE, tempo: '2-0-X-2' },
];
// Skills S3 (P3) : progression A / B propre à chaque skill, stockée dans le squelette.
const S3_A: SessionBlockAOption[] = [
  { id: 'skill_c2b', kind: 'skill', movement: 'chest_to_bar', minutes: 15,
    skill: { reps: 5, rounds: 4, every_s: 90,
      progression: { a: 'Kip Swings amples + Scap Pull-Ups (3 × 8), fermeture des hanches vers la barre', b: 'Chest-to-Bar assistés élastique ou Jumping C2B avec pause poitrine à la barre (3 × 5)' },
      substitutions: { scaled: 'Banded Pull-Ups', inter: 'Pull-ups', rxplus: 'Chest-to-Bar', elite: 'Bar Muscle-ups', pro: 'Bar Muscle-ups' } } },
  { id: 'skill_hspu', kind: 'skill', movement: 'handstand_push_up', minutes: 15,
    skill: { reps: 6, rounds: 4, every_s: 90,
      progression: { a: 'Handstand Hold face au mur (3 × 30 s), gainage et coudes verrouillés', b: 'Descentes négatives 5 s en Handstand Push-Up ou Pike Push-Ups pieds sur box (3 × 5)' },
      substitutions: { scaled: 'Pike Push-Ups', inter: 'Half Wall Walks', rxplus: 'Strict Handstand Push-Ups', elite: 'Strict Handstand Push-Ups', pro: 'Strict Handstand Push-Ups' } } },
  { id: 'skill_bmu', kind: 'skill', movement: 'bar_muscle_up', minutes: 15,
    skill: { reps: 3, rounds: 4, every_s: 90,
      progression: { a: 'Kip Swings avec hanches hautes + Chest-to-Bar explosifs (3 × 5), trajet vers la barre', b: 'Bar Muscle-Ups élastique ou sautés depuis une box basse, transition et dip (3 × 3)' },
      substitutions: { scaled: 'Banded Pull-Ups', inter: 'Chest-to-Bar', rxplus: 'Bar Muscle-ups', elite: 'Ring Muscle-ups', pro: 'Ring Muscle-ups' } } },
  { id: 'skill_rmu', kind: 'skill', movement: 'ring_muscle_up', minutes: 15,
    skill: { reps: 3, rounds: 4, every_s: 90,
      progression: { a: 'False grip Hang + Ring Rows en false grip (3 × 8), anneaux vers le sternum', b: 'Transitions pieds au sol sur anneaux bas puis Ring Dips profonds (3 × 4)' },
      substitutions: { scaled: 'Ring Rows false grip', inter: 'Chest-to-Bar', rxplus: 'Bar Muscle-ups', elite: 'Ring Muscle-ups', pro: 'Ring Muscle-ups' } } },
  { id: 'skill_rope', kind: 'skill', movement: 'rope_climb', minutes: 15,
    skill: { reps: 2, rounds: 4, every_s: 90,
      progression: { a: 'Verrouillage de pieds au sol (J-hook / S-wrap) et Rope Pulls assis → debout (3 × 5)', b: 'Montées basses en 3 accroches avec pause à chaque verrouillage (3 × 2)' },
      substitutions: { scaled: 'Rope Pulls From Floor', inter: 'Rope Climbs', rxplus: 'Rope Climbs', elite: 'Legless Rope Climbs', pro: 'Legless Rope Climbs' } } },
  { id: 'skill_wall_walk', kind: 'skill', movement: 'wall_walk', minutes: 15,
    skill: { reps: 4, rounds: 4, every_s: 90,
      progression: { a: 'Plank Hold pieds au mur + Bear Crawl (3 × 20 s), bassin rentré', b: 'Half Wall Walks avec pause 3 s en haut (3 × 3)' },
      substitutions: { scaled: 'Half Wall Walks', inter: 'Wall Walks', rxplus: 'Wall Walks', elite: 'Wall Walks + 5 Shoulder Taps', pro: 'Wall Walks + 5 Shoulder Taps' } } },
  { id: 'skill_hs_walk', kind: 'skill', movement: 'handstand_walk', minutes: 15,
    skill: { reps: 10, rounds: 4, every_s: 90,
      progression: { a: 'Handstand Hold dos au mur (3 × 30 s) puis Shoulder Taps (3 × 10), doigts qui agrippent le sol', b: 'Décollages du mur : Handstand Walk 2-3 pas puis retour (3 × 4 tentatives)' },
      substitutions: { scaled: 'Handstand Shoulder Taps', inter: 'Half Wall Walks', rxplus: 'Handstand Walk', elite: 'Handstand Walk', pro: 'Handstand Walk' } } },
];

type FMove = SessionFinisherOption['movements'][number];
const fin = (id: string, family: SessionFinisherOption['family'], movements: FMove[], rounds = 3): SessionFinisherOption => ({ id, family, rounds, minutes: 5, movements });
const mv = (id: string, qty: number, unit: FMove['unit'] = 'reps', name?: string): FMove => ({ id, qty, unit, ...(name ? { name } : {}) });

/**
 * Banque de finishers (P2) : partagée par tous les squelettes, jamais deux fois le même dans la semaine,
 * anti-répétition sur 4 semaines via le journal `finisher:<id>`. 5 finishers par semaine × 5 semaines = 25 ≤ 25 options.
 * Les finishers respiratoires se font sur rameur ou vélo uniquement (jamais en marchant).
 */
export const FINISHERS: SessionFinisherOption[] = [
  // Tronc
  fin('core_hollow_plank', 'core', [mv('hollow_rock', 15), mv('plank_hold', 30, 's')]),
  fin('core_sit_up_superman', 'core', [mv('sit_up', 20), mv('superman', 20, 's')]),
  fin('core_ghd_hollow', 'core', [mv('ghd_sit_up', 12), mv('hollow_hold', 30, 's')]),
  fin('core_dead_bug_side_plank', 'core', [mv('dead_bug', 10, 'reps', 'Dead Bug (par côté)'), mv('side_plank', 20, 's', 'Side Plank (par côté)')]),
  fin('core_t2b_l_sit', 'core', [mv('toes_to_bar', 8), mv('l_sit', 15, 's', 'L-Sit sur parallettes')]),
  fin('core_knee_raise_russian', 'core', [mv('hanging_knee_raise', 12), mv('russian_twist', 20)]),
  fin('core_bear_crawl_hollow', 'core', [mv('bear_crawl', 15, 'm'), mv('hollow_hold', 20, 's')]),
  fin('core_ab_wheel_plank', 'core', [mv('ab_wheel', 8), mv('plank_hold', 40, 's')]),
  // Carries
  fin('carry_farmer_lunge', 'carry', [mv('db_farmer_carry', 50, 'm'), mv('walking_lunge', 20)]),
  fin('carry_sandbag_bear_hug', 'carry', [mv('sandbag_carry', 50, 'm', 'Sandbag Bear Hug Carry'), mv('air_squat', 10)]),
  fin('carry_suitcase_plank', 'carry', [mv('suitcase_carry', 40, 'm', 'Suitcase Carry (par côté)'), mv('side_plank', 20, 's', 'Side Plank (par côté)')]),
  fin('carry_overhead_kb', 'carry', [mv('kb_overhead_carry', 30, 'm', 'KB Overhead Carry (par bras)'), mv('hollow_rock', 10)]),
  fin('carry_front_rack_db', 'carry', [mv('db_front_rack_carry', 50, 'm', 'DB Front Rack Carry'), mv('sit_up', 15)]),
  // Épaules
  fin('shoulders_face_pull_raise', 'shoulders', [mv('face_pull', 15, 'reps', 'Face Pull élastique'), mv('lateral_raise', 12, 'reps', 'Lateral Raise léger')]),
  fin('shoulders_band_pull_apart_y', 'shoulders', [mv('band_pull_apart', 20, 'reps', 'Band Pull-Aparts'), mv('db_y_raise', 10, 'reps', 'DB Y-Raise')]),
  fin('shoulders_ring_row_pushup', 'shoulders', [mv('ring_row', 12), mv('push_up', 12)]),
  fin('shoulders_cuban_press_hold', 'shoulders', [mv('cuban_press', 10, 'reps', 'Cuban Press léger'), mv('handstand_shoulder_tap', 10)]),
  // Fessiers
  fin('glutes_bridge_clam', 'glutes', [mv('glute_bridge', 15), mv('banded_clamshell', 15, 'reps', 'Banded Clamshells (par côté)')]),
  fin('glutes_hip_thrust_monster', 'glutes', [mv('db_hip_thrust', 12), mv('monster_walk', 20, 'm', 'Monster Walk élastique')]),
  fin('glutes_kickback_swing', 'glutes', [mv('glute_kickback', 12, 'reps', 'Glute Kickback élastique (par côté)'), mv('kb_swing_russian', 15)]),
  fin('glutes_single_leg_bridge_step_up', 'glutes', [mv('single_leg_glute_bridge', 10, 'reps', 'Single-Leg Glute Bridge (par côté)'), mv('box_step_up', 16)]),
  // Mollets
  fin('calves_raise_jump', 'calves', [mv('bodyweight_calf_raise', 20, 'reps', 'Calf Raises sur marche'), mv('double_under', 40)]),
  fin('calves_single_leg_hold', 'calves', [mv('single_leg_calf_raise', 12, 'reps', 'Single-Leg Calf Raise (par côté)'), mv('calf_raise_hold', 20, 's', 'Calf Raise Hold en haut')]),
  // Respiratoire
  fin('breathing_row_nasal', 'breathing', [mv('row', 250, 'm', 'Row respiration nasale'), mv('box_breathing', 60, 's', 'Box Breathing 4-4-4-4')], 2),
  fin('breathing_bike_exhale', 'breathing', [mv('bike_erg', 300, 'm', 'Bike Erg facile'), mv('slow_exhale', 60, 's', 'Respiration 4 s inspir / 8 s expir')], 2),
];

export const S1_snatch: SessionSkeleton = {
  id: 'S1_snatch', discipline: 'session', format: 'session', day: 1, label: 'Haltéro · Snatch', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — mobilité épaules et hanches, barre à vide : Snatch Deadlift, Muscle Snatch, Overhead Squat, Snatch Balance en série de 5.'] },
  block_a: S1_A,
  block_b: [B_OHS, B_SNATCH_BALANCE, B_STRICT_PULL_UP],
  block_c: { intentions: ['mixed', 'gym'], durations: [12, 15, 20], pattern_not: 'heavy_pattern' },
  finisher: FINISHERS,
};

export const S2_squat: SessionSkeleton = {
  id: 'S2_squat', discipline: 'session', format: 'session', day: 2, label: 'Force · Squat', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — vélo ou rameur facile, mobilité chevilles et hanches, Air Squats, Goblet Squats légers, activation fessiers.'] },
  block_a: S2_A,
  block_b: [B_PUSH_PRESS, B_STRICT_PRESS, B_RING_DIP, B_STRICT_PULL_UP],
  block_c: { intentions: ['cardio'], durations: [15, 20], pattern_not: 'heavy_pattern' },
  finisher: FINISHERS,
};

export const S3_gym: SessionSkeleton = {
  id: 'S3_gym', discipline: 'session', format: 'session', day: 3, label: 'Gym · Skill', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — mobilité épaules et poignets, Scap Pull-Ups, Kip Swings, Hollow / Arch, marche en HS contre le mur.'] },
  block_a: S3_A,
  block_b: [B_RING_DIP, B_STRICT_HSPU, B_STRICT_PULL_UP],
  block_c: { intentions: ['gym', 'mixed'], durations: [12, 15], formats: ['for_time', 'amrap', 'emom'], pattern_not: [] },
  finisher: FINISHERS,
};

export const S4_cj: SessionSkeleton = {
  id: 'S4_cj', discipline: 'session', format: 'session', day: 4, label: 'Haltéro · Clean & Jerk', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — mobilité poignets et hanches, barre à vide : Clean Deadlift, Muscle Clean, Front Squat, Push Press, Push Jerk en série de 5.'] },
  block_a: S4_A,
  block_b: [B_FRONT_SQUAT, B_PUSH_PRESS, B_STRICT_PULL_UP],
  block_c: { intentions: ['mixed'], durations: [15, 20], pattern_not: 'heavy_pattern' },
  finisher: FINISHERS,
};

export const S5_hinge: SessionSkeleton = {
  id: 'S5_hinge', discipline: 'session', format: 'session', day: 5, label: 'Force · Hinge', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — rameur facile, mobilité ischios et hanches, Good Mornings barre à vide, Glute Bridges, Kettlebell Swings légers.'] },
  block_a: S5_A,
  block_b: [B_FRONT_RACK_LUNGE, B_STRICT_PRESS, B_GHD],
  block_c: { intentions: ['mixed', 'cardio'], durations: [20, 30], formats: ['chipper', 'stations'], pattern_not: 'heavy_pattern' },
  finisher: null,
};

export const S6_long: SessionSkeleton = {
  id: 'S6_long', discipline: 'session', format: 'session', day: 6, label: 'Long · Engine', budget_min: 60,
  warmup: { minutes: 18, lines: ['Échauffement long (18\') — 3 tours faciles : 2\' d\'erg au choix, Inchworms, Spiderman Lunges, Scap Pull-Ups, Air Squats ; puis les mouvements du metcon à vide.'] },
  block_a: null,
  block_b: null,
  block_c: { intentions: ['cardio', 'mixed'], durations: [25, 30], pattern_not: [] },
  finisher: FINISHERS,
};

export const SESSION_SKELETONS: SessionSkeleton[] = [S1_snatch, S2_squat, S3_gym, S4_cj, S5_hinge, S6_long];
