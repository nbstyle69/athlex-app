import type { SessionBlockAOption, SessionBlockBOption, SessionFinisherOption, SessionSkeleton, StrengthStep } from '../types';

/**
 * Squelettes de séance Functional / Hybrid (brief J1 §3-§4) : un par jour, lundi → samedi.
 * Bloc A en grammaire `strength` (% du 1RM, jamais de kg), bloc C tiré dans la banque
 * Functional existante avec `pattern_not` = pattern lourd du bloc A.
 */

export const SESSION_BANK_VERSION = 1;

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

const building = (id: string, movement: string, tempo: string, percent: number | null = 55): SessionBlockBOption => ({
  id, movement, tempo, minutes: 8,
  steps: [{ sets: 3, reps: 5, percent, rest_s: 90, note: percent === null ? 'strict, qualité avant quantité' : 'building tempo' }],
});

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
const S3_A: SessionBlockAOption[] = [
  { id: 'skill_c2b', kind: 'skill', movement: 'chest_to_bar', minutes: 15,
    skill: { reps: 5, rounds: 4, every_s: 90, substitutions: { scaled: 'Banded Pull-Ups', inter: 'Pull-ups', rxplus: 'Chest-to-Bar', elite: 'Bar Muscle-ups', pro: 'Bar Muscle-ups' } } },
  { id: 'skill_hspu', kind: 'skill', movement: 'handstand_push_up', minutes: 15,
    skill: { reps: 6, rounds: 4, every_s: 90, substitutions: { scaled: 'Pike Push-Ups', inter: 'Half Wall Walks', rxplus: 'Strict Handstand Push-Ups', elite: 'Strict Handstand Push-Ups', pro: 'Strict Handstand Push-Ups' } } },
  { id: 'skill_bmu', kind: 'skill', movement: 'bar_muscle_up', minutes: 15,
    skill: { reps: 3, rounds: 4, every_s: 90, substitutions: { scaled: 'Banded Pull-Ups', inter: 'Chest-to-Bar', rxplus: 'Bar Muscle-ups', elite: 'Ring Muscle-ups', pro: 'Ring Muscle-ups' } } },
  { id: 'skill_rope', kind: 'skill', movement: 'rope_climb', minutes: 15,
    skill: { reps: 2, rounds: 4, every_s: 90, substitutions: { scaled: 'Rope Pulls From Floor', inter: 'Rope Climbs', rxplus: 'Rope Climbs', elite: 'Legless Rope Climbs', pro: 'Legless Rope Climbs' } } },
  { id: 'skill_hs_walk', kind: 'skill', movement: 'handstand_walk', minutes: 15,
    skill: { reps: 10, rounds: 4, every_s: 90, substitutions: { scaled: 'Handstand Shoulder Taps', inter: 'Half Wall Walks', rxplus: 'Handstand Walk', elite: 'Handstand Walk', pro: 'Handstand Walk' } } },
];

const CORE_FINISHERS: SessionFinisherOption[] = [
  { id: 'core_hollow_plank', rounds: 3, minutes: 5, movements: [{ id: 'hollow_rock', qty: 15, unit: 'reps' }, { id: 'plank_hold', qty: 30, unit: 's' }] },
  { id: 'core_sit_up_superman', rounds: 3, minutes: 5, movements: [{ id: 'sit_up', qty: 20, unit: 'reps' }, { id: 'superman', qty: 20, unit: 's' }] },
  { id: 'core_ghd_hollow', rounds: 3, minutes: 5, movements: [{ id: 'ghd_sit_up', qty: 12, unit: 'reps' }, { id: 'hollow_hold', qty: 30, unit: 's' }] },
];
const ACCESSORY_FINISHERS: SessionFinisherOption[] = [
  { id: 'acc_carry_lunge', rounds: 3, minutes: 5, movements: [{ id: 'db_farmer_carry', qty: 50, unit: 'm' }, { id: 'walking_lunge', qty: 20, unit: 'reps' }] },
  { id: 'acc_ring_row_pushup', rounds: 3, minutes: 5, movements: [{ id: 'ring_row', qty: 12, unit: 'reps' }, { id: 'push_up', qty: 12, unit: 'reps' }] },
  ...CORE_FINISHERS,
];

export const S1_snatch: SessionSkeleton = {
  id: 'S1_snatch', discipline: 'session', format: 'session', day: 1, label: 'Haltéro · Snatch', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — mobilité épaules et hanches, barre à vide : Snatch Deadlift, Muscle Snatch, Overhead Squat, Snatch Balance en série de 5.'] },
  block_a: S1_A,
  block_b: [building('b_ohs_tempo', 'overhead_squat', '3-1-1-1'), building('b_push_press_tempo_s1', 'push_press', '2-0-1-2')],
  block_c: { intentions: ['mixed', 'gym'], durations: [12, 15, 20], pattern_not: 'heavy_pattern' },
  finisher: CORE_FINISHERS,
};

export const S2_squat: SessionSkeleton = {
  id: 'S2_squat', discipline: 'session', format: 'session', day: 2, label: 'Force · Squat', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — vélo ou rameur facile, mobilité chevilles et hanches, Air Squats, Goblet Squats légers, activation fessiers.'] },
  block_a: S2_A,
  block_b: [building('b_front_squat_tempo', 'front_squat', '3-1-1-1'), building('b_ohs_pause', 'overhead_squat', '3-2-1-1')],
  block_c: { intentions: ['cardio'], durations: [15, 20], pattern_not: 'heavy_pattern' },
  finisher: CORE_FINISHERS,
};

export const S3_gym: SessionSkeleton = {
  id: 'S3_gym', discipline: 'session', format: 'session', day: 3, label: 'Gym · Skill', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — mobilité épaules et poignets, Scap Pull-Ups, Kip Swings, Hollow / Arch, marche en HS contre le mur.'] },
  block_a: S3_A,
  block_b: [building('b_strict_pull_up', 'strict_pull_up', '2-1-2-1', null), building('b_ring_dip', 'ring_dip', '2-1-2-1', null), building('b_strict_hspu', 'strict_handstand_push_up', '2-1-2-1', null)],
  block_c: { intentions: ['gym', 'mixed'], durations: [12, 15], formats: ['for_time', 'amrap', 'emom'], pattern_not: [] },
  finisher: ACCESSORY_FINISHERS,
};

export const S4_cj: SessionSkeleton = {
  id: 'S4_cj', discipline: 'session', format: 'session', day: 4, label: 'Haltéro · Clean & Jerk', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — mobilité poignets et hanches, barre à vide : Clean Deadlift, Muscle Clean, Front Squat, Push Press, Push Jerk en série de 5.'] },
  block_a: S4_A,
  block_b: [building('b_front_squat_pause', 'front_squat', '2-2-X-1'), building('b_push_press_tempo', 'push_press', '2-0-1-2')],
  block_c: { intentions: ['mixed'], durations: [15, 20], pattern_not: 'heavy_pattern' },
  finisher: CORE_FINISHERS,
};

export const S5_hinge: SessionSkeleton = {
  id: 'S5_hinge', discipline: 'session', format: 'session', day: 5, label: 'Force · Hinge', budget_min: 60,
  warmup: { minutes: 10, lines: ['Échauffement (10\') — rameur facile, mobilité ischios et hanches, Good Mornings barre à vide, Glute Bridges, Kettlebell Swings légers.'] },
  block_a: S5_A,
  block_b: [building('b_rdl_tempo', 'romanian_deadlift', '3-1-1-1'), building('b_hip_thrust', 'hip_thrust', '2-2-X-1')],
  block_c: { intentions: ['mixed', 'cardio'], durations: [20, 30], formats: ['chipper', 'stations'], pattern_not: 'heavy_pattern' },
  finisher: null,
};

export const S6_long: SessionSkeleton = {
  id: 'S6_long', discipline: 'session', format: 'session', day: 6, label: 'Long · Engine', budget_min: 60,
  warmup: { minutes: 18, lines: ['Échauffement long (18\') — 3 tours faciles : 2\' d\'erg au choix, Inchworms, Spiderman Lunges, Scap Pull-Ups, Air Squats ; puis les mouvements du metcon à vide.'] },
  block_a: null,
  block_b: null,
  block_c: { intentions: ['cardio', 'mixed'], durations: [25, 30], pattern_not: [] },
  finisher: CORE_FINISHERS,
};

export const SESSION_SKELETONS: SessionSkeleton[] = [S1_snatch, S2_squat, S3_gym, S4_cj, S5_hinge, S6_long];
