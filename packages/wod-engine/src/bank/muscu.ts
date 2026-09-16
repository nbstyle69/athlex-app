import type { Muscle, MuscuObjective, MuscuSkeleton, MuscuSlot, MuscuSlotRole, MuscuTarget } from '../types';

/**
 * Squelettes Musculation (brief M1 §4) : 13 cibles × 3 objectifs = 39.
 * Un squelette = liste ordonnée de slots (main_compound → secondary_compound →
 * isolation → core / calves). Les slots `optional` sont retirés en premier quand
 * le budget est court ; `ids` restreint le tirage à une liste d'exercices
 * (relâchée si aucun n'est disponible avec le matériel / niveau).
 */

type SlotOpts = Pick<MuscuSlot, 'optional' | 'ids' | 'unilateral' | 'exclude_ids'>;
const slot = (role: MuscuSlotRole, muscle: Muscle | Muscle[], opts: SlotOpts = {}): MuscuSlot => ({ role, muscle, ...opts });
const main = (m: Muscle | Muscle[], o?: SlotOpts) => slot('main_compound', m, o);
const sec = (m: Muscle | Muscle[], o?: SlotOpts) => slot('secondary_compound', m, o);
const iso = (m: Muscle | Muscle[], o?: SlotOpts) => slot('isolation', m, o);
const core = (m: Muscle | Muscle[], o?: SlotOpts) => slot('core', m, o);
const calves = (o?: SlotOpts) => slot('calves', 'mollets', o);
const OPT = { optional: true } as const;

const HIP_THRUST = ['hip_thrust', 'db_hip_thrust', 'hip_thrust_machine', 'single_leg_hip_thrust', 'glute_bridge', 'single_leg_glute_bridge'];
const RDL = ['romanian_deadlift', 'db_rdl', 'good_morning', 'bodyweight_single_leg_rdl'];
const ABDUCTION = ['hip_abduction_machine', 'cable_hip_abduction', 'banded_hip_abduction'];
const KICKBACK = ['glute_kickback', 'cable_pull_through', 'frog_pump'];
const LEG_CURL = ['leg_curl', 'nordic_curl', 'bodyweight_single_leg_rdl'];
const ANTI_ROTATION = ['pallof_press', 'dead_bug', 'plank_hold', 'hollow_hold', 'ab_wheel', 'vacuum'];
const LATERAL = ['side_plank', 'db_side_bend', 'oblique_crunch', 'hanging_oblique_raise', 'oblique_bench_raise', 'rotation_machine', 'crunch_with_rotation', 'standing_rotation'];
const CARRY = ['db_farmer_carry', 'suitcase_carry'];
const VERTICAL_PULL = ['strict_pull_up', 'chin_up', 'wide_grip_pull_up', 'neutral_grip_pull_up', 'close_grip_pull_up', 'lat_pulldown', 'converging_pulldown', 'close_grip_pulldown', 'supinated_pulldown', 'one_arm_pulldown'];
const TRICEPS_COMPOUND = ['close_grip_bench', 'close_grip_dips', 'machine_dips', 'diamond_push_up', 'dips'];

const T: Record<MuscuTarget, Record<MuscuObjective, MuscuSlot[]>> = {
  push: {
    hypertrophie: [main('pecs'), sec('epaules'), iso('pecs'), iso('epaules'), iso('triceps'), iso('triceps', OPT)],
    force: [main('pecs'), main('epaules'), sec('triceps', { ids: TRICEPS_COMPOUND }), iso('epaules_post', OPT), iso('triceps', OPT)],
    endurance: [sec('pecs'), sec('epaules'), iso('pecs'), iso('triceps'), iso('epaules', OPT)],
  },
  pull: {
    hypertrophie: [main('dos'), sec('dos', { ids: VERTICAL_PULL }), iso('epaules_post'), iso('biceps'), iso('biceps', OPT), iso('trapezes', OPT)],
    force: [main('dos'), main('dos', { ids: VERTICAL_PULL }), sec('trapezes', OPT), iso('biceps'), iso('epaules_post', OPT)],
    endurance: [sec('dos'), sec('dos', { ids: VERTICAL_PULL }), iso('epaules_post'), iso('biceps'), core(['tronc', 'lombaires'], OPT)],
  },
  jambes: {
    hypertrophie: [main('quadriceps'), sec('ischios'), sec(['quadriceps', 'fessiers']), iso('quadriceps'), iso('ischios'), calves()],
    force: [main('quadriceps'), main(['ischios', 'fessiers']), sec('quadriceps', OPT), iso('ischios', OPT), calves(OPT)],
    endurance: [sec('quadriceps'), sec(['ischios', 'fessiers']), iso(['quadriceps', 'fessiers']), calves(), core('tronc', OPT)],
  },
  bas: {
    hypertrophie: [main('quadriceps'), sec('fessiers'), sec('ischios'), iso(['quadriceps', 'fessiers']), iso('ischios', OPT), core(['tronc', 'lombaires'], OPT)],
    force: [main('quadriceps'), sec('ischios'), sec('fessiers', OPT), iso(['quadriceps', 'fessiers']), core(['lombaires', 'tronc'], OPT)],
    endurance: [sec('quadriceps'), sec('fessiers'), iso(['ischios', 'fessiers']), core('tronc'), calves(OPT)],
  },
  full_body: {
    hypertrophie: [main('quadriceps'), main('pecs'), sec('dos'), sec(['ischios', 'fessiers']), iso('epaules', OPT), core('tronc', OPT)],
    force: [main('quadriceps'), main('pecs'), main('dos'), sec('ischios', OPT)],
    endurance: [sec(['quadriceps', 'fessiers']), sec('pecs'), sec('dos'), sec(['ischios', 'fessiers']), core('tronc', OPT)],
  },
  tronc: {
    hypertrophie: [core('tronc'), core(['obliques', 'tronc']), core('lombaires'), core('tronc', OPT)],
    force: [core('tronc'), core('obliques'), core('lombaires'), core('tronc', OPT)],
    endurance: [core('tronc', { ids: ANTI_ROTATION }), core(['obliques', 'tronc'], { ids: LATERAL }), core('tronc', { ids: CARRY }), core('lombaires')],
  },
  haut: {
    hypertrophie: [main('pecs'), main('dos'), sec('epaules'), iso('biceps'), iso('triceps'), iso('epaules_post', OPT)],
    force: [main('pecs'), main('epaules'), main('dos'), sec('triceps', { ...OPT, ids: TRICEPS_COMPOUND }), iso('epaules_post', OPT)],
    endurance: [sec('pecs'), sec('dos'), sec('epaules'), iso(['biceps', 'triceps']), core('tronc', OPT)],
  },
  dos: {
    hypertrophie: [main('dos'), sec('dos', { ids: VERTICAL_PULL }), sec('dos', OPT), iso('epaules_post'), iso('trapezes', OPT), iso('lombaires', OPT)],
    force: [main('dos'), main('dos', { ids: VERTICAL_PULL }), sec('trapezes', OPT), iso('epaules_post', OPT), iso('lombaires', OPT)],
    endurance: [sec('dos'), sec('dos', { ids: VERTICAL_PULL }), iso('epaules_post'), iso('lombaires'), iso('trapezes', OPT)],
  },
  epaules: {
    hypertrophie: [main('epaules'), iso('epaules'), iso('epaules_post'), iso('epaules_ant', OPT), iso('trapezes', OPT)],
    force: [main('epaules'), sec('epaules', OPT), iso('epaules_post'), iso('epaules', OPT), iso('trapezes', OPT)],
    endurance: [sec('epaules'), iso('epaules'), iso('epaules_post'), iso('epaules_ant', OPT)],
  },
  bras: {
    hypertrophie: [sec('triceps', { ids: TRICEPS_COMPOUND }), iso('biceps'), iso('triceps'), iso('biceps'), iso('triceps', OPT), iso('avant_bras', OPT)],
    force: [main('triceps', { ids: TRICEPS_COMPOUND }), iso('biceps'), iso('triceps'), iso('biceps', OPT), iso('avant_bras', OPT)],
    endurance: [iso('triceps'), iso('biceps'), iso('triceps'), iso('biceps'), iso('avant_bras', OPT)],
  },
  pecs: {
    hypertrophie: [main('pecs'), sec('pecs'), iso('pecs'), iso('triceps'), iso('pecs', OPT)],
    force: [main('pecs'), sec('pecs', OPT), sec('triceps', { ids: TRICEPS_COMPOUND }), iso('pecs', OPT)],
    endurance: [sec('pecs'), sec('pecs'), iso('pecs'), iso('triceps', OPT)],
  },
  fessiers: {
    hypertrophie: [
      main('fessiers', { ids: HIP_THRUST, exclude_ids: ['back_squat'] }), sec('ischios', { ids: RDL }),
      sec('fessiers', { unilateral: true }), iso(['fessiers', 'ischios'], { ids: [...KICKBACK, ...LEG_CURL] }),
      iso('fessiers', { ids: ABDUCTION }), iso('fessiers', { ...OPT, ids: KICKBACK }),
    ],
    force: [main('fessiers', { exclude_ids: ['back_squat'] }), main('ischios', { ids: RDL }), sec('fessiers', { ...OPT, unilateral: true }), iso('fessiers', OPT), core('lombaires', OPT)],
    endurance: [sec('fessiers', { exclude_ids: ['back_squat'] }), sec('ischios'), iso('fessiers'), iso(['ischios', 'fessiers']), core('lombaires', OPT)],
  },
  fessiers_ischios: {
    hypertrophie: [main('ischios', { ids: RDL }), main('fessiers', { ids: HIP_THRUST }), sec(['fessiers', 'ischios'], { unilateral: true }), iso('ischios', { ids: LEG_CURL }), iso('fessiers', { ids: ABDUCTION })],
    force: [main('ischios', { ids: RDL }), main('fessiers', { exclude_ids: ['back_squat'] }), sec(['fessiers', 'ischios'], OPT), iso('ischios', OPT), core('lombaires', OPT)],
    endurance: [sec('ischios'), sec('fessiers'), iso('fessiers'), iso('ischios'), core('lombaires', OPT)],
  },
};

export const MUSCU_TARGETS = Object.keys(T) as MuscuTarget[];
export const MUSCU_OBJECTIVES: MuscuObjective[] = ['hypertrophie', 'force', 'endurance'];

export const MUSCU_SKELETONS: MuscuSkeleton[] = MUSCU_TARGETS.flatMap((target) =>
  MUSCU_OBJECTIVES.map((objective) => ({
    id: `${target}_${objective}`,
    discipline: 'musculation' as const,
    format: 'strength_session' as const,
    target,
    objective,
    slots: T[target][objective],
  })));

/** Muscles couverts par une cible (ordre = priorité), pour Après ma classe et le repli des slots. */
export const TARGET_MUSCLES: Record<MuscuTarget, Muscle[]> = {
  fessiers: ['fessiers', 'ischios', 'lombaires'],
  fessiers_ischios: ['ischios', 'fessiers', 'lombaires'],
  bas: ['quadriceps', 'fessiers', 'ischios', 'mollets', 'lombaires'],
  full_body: ['quadriceps', 'pecs', 'dos', 'ischios', 'fessiers', 'epaules', 'tronc'],
  tronc: ['tronc', 'obliques', 'lombaires'],
  haut: ['pecs', 'dos', 'epaules', 'biceps', 'triceps', 'epaules_post'],
  dos: ['dos', 'epaules_post', 'trapezes', 'lombaires'],
  epaules: ['epaules', 'epaules_post', 'epaules_ant', 'trapezes'],
  bras: ['biceps', 'triceps', 'avant_bras'],
  pecs: ['pecs', 'triceps'],
  push: ['pecs', 'epaules', 'triceps', 'epaules_post'],
  pull: ['dos', 'epaules_post', 'biceps', 'trapezes'],
  jambes: ['quadriceps', 'ischios', 'fessiers', 'mollets'],
};
