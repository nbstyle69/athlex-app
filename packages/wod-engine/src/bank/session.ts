import type { Pattern, SessionBlockAOption, SessionBlockBOption, SessionFinisherOption, SessionSkeleton, StrengthStep } from '../types';
import { fr } from '../i18n/fr';

const T = fr.banque;

/**
 * Squelettes de séance Functional / Hybrid (brief J1 §3-§4) : un par jour, lundi → samedi.
 * Bloc A en grammaire `strength` (% du 1RM, jamais de kg), bloc C tiré dans la banque
 * Functional existante avec `pattern_not` = pattern lourd du bloc A.
 */

export const SESSION_BANK_VERSION = 3;

// Montées et progressions (brief §4)
const WL_STEPS: StrengthStep[] = [
  { sets: 2, reps: 2, percent: 30, rest_s: 60, note: T.serie.montee },
  { sets: 2, reps: 2, percent: 50, rest_s: 60, note: T.serie.montee },
  { sets: 4, reps: 1, percent: 65, rest_s: 180, note: T.serie.e3mom6070 },
  { sets: 4, reps: 1, percent: 72, rest_s: 180, note: T.serie.e3mom7075 },
];
const STRENGTH_RAMP: StrengthStep[] = [
  { sets: 1, reps: 5, percent: 40, rest_s: 90, note: T.serie.montee },
  { sets: 1, reps: 5, percent: 50, rest_s: 90, note: T.serie.montee },
  { sets: 1, reps: 3, percent: 60, rest_s: 120, note: T.serie.montee },
];
const FIVE_BY_FIVE: StrengthStep[] = [...STRENGTH_RAMP, { sets: 5, reps: 5, percent: 75, rest_s: 150 }];
const FIVE_BY_THREE: StrengthStep[] = [...STRENGTH_RAMP, { sets: 5, reps: 3, percent: 82, rest_s: 180, note: T.serie.pct8085 }];

const building = (id: string, movement: string, pattern: Pattern, tempo: string, percent: number | null = 55, name?: string): SessionBlockBOption => ({
  id, movement, pattern, tempo, minutes: 8, ...(name ? { name } : {}),
  steps: [{ sets: 3, reps: 5, percent, rest_s: 90, note: percent === null ? T.serie.strict : T.serie.buildingTempo }],
});

// Options de bloc B par squelette (P1) : exercice ≠ A, pattern ≠ pattern lourd de A, jamais deux fois le même B dans la semaine.
const B_OHS = building('b_ohs_tempo', 'overhead_squat', 'squat', '3-1-1-1');
const B_SNATCH_BALANCE = building('b_snatch_balance', 'snatch_balance', 'squat', '2-0-X-1', 50, T.building.b_snatch_balance);
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
      progression: { a: T.skill.skill_c2b.a, b: T.skill.skill_c2b.b },
      substitutions: T.skill.skill_c2b.substitutions } },
  { id: 'skill_hspu', kind: 'skill', movement: 'handstand_push_up', minutes: 15,
    skill: { reps: 6, rounds: 4, every_s: 90,
      progression: { a: T.skill.skill_hspu.a, b: T.skill.skill_hspu.b },
      substitutions: T.skill.skill_hspu.substitutions } },
  { id: 'skill_bmu', kind: 'skill', movement: 'bar_muscle_up', minutes: 15,
    skill: { reps: 3, rounds: 4, every_s: 90,
      progression: { a: T.skill.skill_bmu.a, b: T.skill.skill_bmu.b },
      substitutions: T.skill.skill_bmu.substitutions } },
  { id: 'skill_rmu', kind: 'skill', movement: 'ring_muscle_up', minutes: 15,
    skill: { reps: 3, rounds: 4, every_s: 90,
      progression: { a: T.skill.skill_rmu.a, b: T.skill.skill_rmu.b },
      substitutions: T.skill.skill_rmu.substitutions } },
  { id: 'skill_rope', kind: 'skill', movement: 'rope_climb', minutes: 15,
    skill: { reps: 2, rounds: 4, every_s: 90,
      progression: { a: T.skill.skill_rope.a, b: T.skill.skill_rope.b },
      substitutions: T.skill.skill_rope.substitutions } },
  { id: 'skill_wall_walk', kind: 'skill', movement: 'wall_walk', minutes: 15,
    skill: { reps: 4, rounds: 4, every_s: 90,
      progression: { a: T.skill.skill_wall_walk.a, b: T.skill.skill_wall_walk.b },
      substitutions: T.skill.skill_wall_walk.substitutions } },
  { id: 'skill_hs_walk', kind: 'skill', movement: 'handstand_walk', minutes: 15,
    skill: { reps: 10, rounds: 4, every_s: 90,
      progression: { a: T.skill.skill_hs_walk.a, b: T.skill.skill_hs_walk.b },
      substitutions: T.skill.skill_hs_walk.substitutions } },
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
  fin('core_dead_bug_side_plank', 'core', [mv('dead_bug', 10, 'reps', T.finisher.core_dead_bug_side_plank.dead_bug), mv('side_plank', 20, 's', T.finisher.core_dead_bug_side_plank.side_plank)]),
  fin('core_t2b_l_sit', 'core', [mv('toes_to_bar', 8), mv('l_sit', 15, 's', T.finisher.core_t2b_l_sit.l_sit)]),
  fin('core_knee_raise_russian', 'core', [mv('hanging_knee_raise', 12), mv('russian_twist', 20)]),
  fin('core_bear_crawl_hollow', 'core', [mv('bear_crawl', 15, 'm'), mv('hollow_hold', 20, 's')]),
  fin('core_ab_wheel_plank', 'core', [mv('ab_wheel', 8), mv('plank_hold', 40, 's')]),
  // Carries
  fin('carry_farmer_lunge', 'carry', [mv('db_farmer_carry', 50, 'm'), mv('walking_lunge', 20)]),
  fin('carry_sandbag_bear_hug', 'carry', [mv('sandbag_carry', 50, 'm', T.finisher.carry_sandbag_bear_hug.sandbag_carry), mv('air_squat', 10)]),
  fin('carry_suitcase_plank', 'carry', [mv('suitcase_carry', 40, 'm', T.finisher.carry_suitcase_plank.suitcase_carry), mv('side_plank', 20, 's', T.finisher.carry_suitcase_plank.side_plank)]),
  fin('carry_overhead_kb', 'carry', [mv('kb_overhead_carry', 30, 'm', T.finisher.carry_overhead_kb.kb_overhead_carry), mv('hollow_rock', 10)]),
  fin('carry_front_rack_db', 'carry', [mv('db_front_rack_carry', 50, 'm', T.finisher.carry_front_rack_db.db_front_rack_carry), mv('sit_up', 15)]),
  // Épaules
  fin('shoulders_face_pull_raise', 'shoulders', [mv('face_pull', 15, 'reps', T.finisher.shoulders_face_pull_raise.face_pull), mv('lateral_raise', 12, 'reps', T.finisher.shoulders_face_pull_raise.lateral_raise)]),
  fin('shoulders_band_pull_apart_y', 'shoulders', [mv('band_pull_apart', 20, 'reps', T.finisher.shoulders_band_pull_apart_y.band_pull_apart), mv('db_y_raise', 10, 'reps', T.finisher.shoulders_band_pull_apart_y.db_y_raise)]),
  fin('shoulders_ring_row_pushup', 'shoulders', [mv('ring_row', 12), mv('push_up', 12)]),
  fin('shoulders_cuban_press_hold', 'shoulders', [mv('cuban_press', 10, 'reps', T.finisher.shoulders_cuban_press_hold.cuban_press), mv('handstand_shoulder_tap', 10)]),
  // Fessiers
  fin('glutes_bridge_clam', 'glutes', [mv('glute_bridge', 15), mv('banded_clamshell', 15, 'reps', T.finisher.glutes_bridge_clam.banded_clamshell)]),
  fin('glutes_hip_thrust_monster', 'glutes', [mv('db_hip_thrust', 12), mv('monster_walk', 20, 'm', T.finisher.glutes_hip_thrust_monster.monster_walk)]),
  fin('glutes_kickback_swing', 'glutes', [mv('glute_kickback', 12, 'reps', T.finisher.glutes_kickback_swing.glute_kickback), mv('kb_swing_russian', 15)]),
  fin('glutes_single_leg_bridge_step_up', 'glutes', [mv('single_leg_glute_bridge', 10, 'reps', T.finisher.glutes_single_leg_bridge_step_up.single_leg_glute_bridge), mv('box_step_up', 16)]),
  // Mollets
  fin('calves_raise_jump', 'calves', [mv('bodyweight_calf_raise', 20, 'reps', T.finisher.calves_raise_jump.bodyweight_calf_raise), mv('double_under', 40)]),
  fin('calves_single_leg_hold', 'calves', [mv('single_leg_calf_raise', 12, 'reps', T.finisher.calves_single_leg_hold.single_leg_calf_raise), mv('calf_raise_hold', 20, 's', T.finisher.calves_single_leg_hold.calf_raise_hold)]),
  // Respiratoire
  fin('breathing_row_nasal', 'breathing', [mv('row', 250, 'm', T.finisher.breathing_row_nasal.row), mv('box_breathing', 60, 's', T.finisher.breathing_row_nasal.box_breathing)], 2),
  fin('breathing_bike_exhale', 'breathing', [mv('bike_erg', 300, 'm', T.finisher.breathing_bike_exhale.bike_erg), mv('slow_exhale', 60, 's', T.finisher.breathing_bike_exhale.slow_exhale)], 2),
];

export const S1_snatch: SessionSkeleton = {
  id: 'S1_snatch', discipline: 'session', format: 'session', track: 'functional', day: 1, label: T.seance.S1_snatch.label, budget_min: 60,
  warmup: { minutes: 10, lines: [T.seance.S1_snatch.echauffement] },
  block_a: S1_A,
  block_b: [B_OHS, B_SNATCH_BALANCE, B_STRICT_PULL_UP],
  block_c: { intentions: ['mixed', 'gym'], durations: [12, 15, 20], pattern_not: 'heavy_pattern' },
  finisher: FINISHERS,
};

export const S2_squat: SessionSkeleton = {
  id: 'S2_squat', discipline: 'session', format: 'session', track: 'functional', day: 2, label: T.seance.S2_squat.label, budget_min: 60,
  warmup: { minutes: 10, lines: [T.seance.S2_squat.echauffement] },
  block_a: S2_A,
  block_b: [B_PUSH_PRESS, B_STRICT_PRESS, B_RING_DIP, B_STRICT_PULL_UP],
  block_c: { intentions: ['cardio'], durations: [15, 20], pattern_not: 'heavy_pattern' },
  finisher: FINISHERS,
};

export const S3_gym: SessionSkeleton = {
  id: 'S3_gym', discipline: 'session', format: 'session', track: 'functional', day: 3, label: T.seance.S3_gym.label, budget_min: 60,
  warmup: { minutes: 10, lines: [T.seance.S3_gym.echauffement] },
  block_a: S3_A,
  block_b: [B_RING_DIP, B_STRICT_HSPU, B_STRICT_PULL_UP],
  block_c: { intentions: ['gym', 'mixed'], durations: [12, 15], formats: ['for_time', 'amrap', 'emom'], pattern_not: [] },
  finisher: FINISHERS,
};

export const S4_cj: SessionSkeleton = {
  id: 'S4_cj', discipline: 'session', format: 'session', track: 'functional', day: 4, label: T.seance.S4_cj.label, budget_min: 60,
  warmup: { minutes: 10, lines: [T.seance.S4_cj.echauffement] },
  block_a: S4_A,
  block_b: [B_FRONT_SQUAT, B_PUSH_PRESS, B_STRICT_PULL_UP],
  block_c: { intentions: ['mixed'], durations: [15, 20], pattern_not: 'heavy_pattern' },
  finisher: FINISHERS,
};

export const S5_hinge: SessionSkeleton = {
  id: 'S5_hinge', discipline: 'session', format: 'session', track: 'functional', day: 5, label: T.seance.S5_hinge.label, budget_min: 60,
  warmup: { minutes: 10, lines: [T.seance.S5_hinge.echauffement] },
  block_a: S5_A,
  block_b: [B_FRONT_RACK_LUNGE, B_STRICT_PRESS, B_GHD],
  block_c: { intentions: ['mixed', 'cardio'], durations: [20, 30], formats: ['chipper', 'stations'], pattern_not: 'heavy_pattern' },
  finisher: null,
};

export const S6_long: SessionSkeleton = {
  id: 'S6_long', discipline: 'session', format: 'session', track: 'functional', day: 6, label: T.seance.S6_long.label, budget_min: 60,
  warmup: { minutes: 18, lines: [T.seance.S6_long.echauffement] },
  block_a: null,
  block_b: null,
  block_c: { intentions: ['cardio', 'mixed'], durations: [25, 30], pattern_not: [] },
  finisher: FINISHERS,
};

export const SESSION_SKELETONS: SessionSkeleton[] = [S1_snatch, S2_squat, S3_gym, S4_cj, S5_hinge, S6_long];
