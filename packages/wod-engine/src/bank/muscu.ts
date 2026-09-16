import type { Muscle, MuscuObjective, MuscuSkeleton, MuscuSlot, MuscuSlotRole, MuscuTarget } from '../types';

/**
 * Squelettes Musculation (brief M1 §4) : 13 cibles × 3 objectifs = 39.
 * Un squelette = liste ordonnée de slots (main_compound → secondary_compound →
 * isolation → core / calves). Les slots `optional` sont retirés en premier quand
 * le budget est court ; `ids` restreint le tirage à une liste d'exercices
 * (relâchée si aucun n'est disponible avec le matériel / niveau).
 */

type SlotOpts = Pick<MuscuSlot, 'optional' | 'ids' | 'unilateral' | 'exclude_ids' | 'groups' | 'pair'>;
const slot = (role: MuscuSlotRole, muscle: Muscle | Muscle[], opts: SlotOpts = {}): MuscuSlot => ({ role, muscle, ...opts });
const main = (m: Muscle | Muscle[], o?: SlotOpts) => slot('main_compound', m, o);
const sec = (m: Muscle | Muscle[], o?: SlotOpts) => slot('secondary_compound', m, o);
const iso = (m: Muscle | Muscle[], o?: SlotOpts) => slot('isolation', m, o);
const core = (m: Muscle | Muscle[], o?: SlotOpts) => slot('core', m, o);
const calves = (o?: SlotOpts) => slot('calves', 'mollets', o);
const OPT = { optional: true } as const;
/** isolation autorisée dans le groupe d'un compound déjà tiré (paire compound + isolation, M2) */
const PAIR = { pair: true } as const;

/** Hip Thrust chargé (barre, DB, machine) : obligatoire sur les cibles fessiers (M10). Sans matériel, le slot se relâche vers Glute Bridge. */
const HIP_THRUST_LOADED = ['hip_thrust', 'db_hip_thrust', 'hip_thrust_machine'];
const RDL = ['romanian_deadlift', 'db_rdl', 'good_morning', 'bodyweight_single_leg_rdl'];
const ABDUCTION = ['hip_abduction_machine', 'cable_hip_abduction', 'banded_hip_abduction'];
const KICKBACK = ['glute_kickback', 'cable_pull_through', 'frog_pump'];
const LEG_CURL = ['leg_curl', 'nordic_curl', 'bodyweight_single_leg_rdl'];
const ANTI_ROTATION = ['pallof_press', 'dead_bug', 'plank_hold', 'hollow_hold', 'ab_wheel', 'vacuum'];
const LATERAL = ['side_plank', 'db_side_bend', 'oblique_crunch', 'hanging_oblique_raise', 'oblique_bench_raise', 'rotation_machine', 'crunch_with_rotation', 'standing_rotation'];
const CARRY = ['db_farmer_carry', 'suitcase_carry'];
const TRICEPS_COMPOUND = ['close_grip_bench', 'close_grip_dips', 'machine_dips', 'diamond_push_up', 'dips'];

/** Dos : un tirage vertical et un tirage horizontal par séance (M4). */
const PULL_V: SlotOpts = { groups: ['pull_v'] };
const ROW: SlotOpts = { groups: ['row'] };
const LUNGE: SlotOpts = { unilateral: true, groups: ['lunge'] };
const FLY: SlotOpts = { groups: ['fly'] };
const RAISE: SlotOpts = { groups: ['raise'] };
const SHRUG: SlotOpts = { groups: ['shrug'] };
const TRI_EXT: SlotOpts = { groups: ['triceps_ext'] };
const PULLOVER: SlotOpts = { groups: ['pull_v'] };

const T: Record<MuscuTarget, Record<MuscuObjective, MuscuSlot[]>> = {
  push: {
    hypertrophie: [main('pecs'), sec('epaules'), iso('pecs', FLY), iso('epaules', RAISE), iso('triceps', TRI_EXT), core('tronc', OPT)],
    force: [main('pecs'), main('epaules'), iso('triceps', TRI_EXT), iso('epaules_post', { ...OPT, ...FLY }), iso('epaules', { ...OPT, ...RAISE })],
    endurance: [sec('pecs'), sec('epaules'), iso('pecs', FLY), iso('triceps', TRI_EXT), iso('epaules', { ...OPT, ...RAISE })],
  },
  pull: {
    hypertrophie: [main('dos', PULL_V), sec('dos', ROW), iso('epaules_post', FLY), iso('biceps'), iso('trapezes', { ...OPT, ...SHRUG }), core(['tronc', 'lombaires'], OPT)],
    force: [main('dos', PULL_V), sec('dos', ROW), iso('biceps'), iso('trapezes', { ...OPT, ...SHRUG }), iso('epaules_post', { ...OPT, ...FLY })],
    endurance: [sec('dos', PULL_V), sec('dos', ROW), iso('epaules_post', FLY), iso('biceps'), core(['tronc', 'lombaires'], OPT)],
  },
  jambes: {
    hypertrophie: [main('quadriceps'), sec('ischios', { ids: RDL }), sec(['quadriceps', 'fessiers'], LUNGE), iso('quadriceps', PAIR), iso('ischios', { ids: LEG_CURL }), calves()],
    force: [main('quadriceps'), main(['ischios', 'fessiers']), sec('quadriceps', { ...OPT, ...LUNGE }), iso('ischios', { ...OPT, ids: LEG_CURL }), calves(OPT)],
    endurance: [sec('quadriceps'), sec(['ischios', 'fessiers']), iso(['quadriceps', 'fessiers'], PAIR), calves(), core('tronc', OPT)],
  },
  bas: {
    hypertrophie: [main('quadriceps'), sec('fessiers', { ids: HIP_THRUST_LOADED }), sec('ischios', { ids: RDL }), iso(['quadriceps', 'fessiers'], PAIR), iso('ischios', { ...OPT, ids: LEG_CURL }), core(['tronc', 'lombaires'], OPT)],
    force: [main('quadriceps'), sec('ischios', { ids: RDL }), sec('fessiers', { ...OPT, ids: HIP_THRUST_LOADED }), iso(['quadriceps', 'fessiers'], PAIR), core(['lombaires', 'tronc'], OPT)],
    endurance: [sec('quadriceps'), sec('fessiers'), iso(['ischios', 'fessiers'], PAIR), core('tronc'), calves(OPT)],
  },
  full_body: {
    hypertrophie: [main('quadriceps'), main('pecs'), sec('dos'), sec(['ischios', 'fessiers']), iso('epaules', OPT), core('tronc', OPT)],
    force: [main('quadriceps'), main('pecs'), main('dos'), sec('ischios', OPT)],
    endurance: [sec(['quadriceps', 'fessiers']), sec('pecs'), sec('dos'), sec(['ischios', 'fessiers']), core('tronc', OPT)],
  },
  tronc: {
    hypertrophie: [core('tronc'), core(['obliques', 'tronc']), core('lombaires'), core('tronc', OPT)],
    // Force indisponible sur le Tronc (M8) : squelette conservé pour la table, refusé par le moteur (`force_tronc`)
    force: [core('tronc'), core('obliques'), core('lombaires'), core('tronc', OPT)],
    endurance: [core('tronc', { ids: ANTI_ROTATION }), core(['obliques', 'tronc'], { ids: LATERAL }), core('tronc', { ids: CARRY }), core('lombaires')],
  },
  haut: {
    hypertrophie: [main('pecs'), main('dos', PULL_V), sec('epaules'), iso('biceps'), iso('triceps', TRI_EXT), iso('epaules_post', { ...OPT, ...FLY })],
    force: [main('pecs'), main('epaules'), main('dos', PULL_V), iso('triceps', { ...OPT, ...TRI_EXT }), iso('epaules_post', { ...OPT, ...FLY })],
    endurance: [sec('pecs'), sec('dos', PULL_V), sec('epaules'), iso(['biceps', 'triceps']), core('tronc', OPT)],
  },
  dos: {
    hypertrophie: [main('dos', PULL_V), sec('dos', ROW), iso('dos', { ...OPT, ...PAIR }), iso('epaules_post', FLY), iso('trapezes', { ...OPT, ...SHRUG }), iso('lombaires', OPT)],
    force: [main('dos', PULL_V), sec('dos', ROW), iso('trapezes', SHRUG), iso('epaules_post', { ...OPT, ...FLY }), iso('lombaires', OPT)],
    endurance: [sec('dos', PULL_V), sec('dos', ROW), iso('epaules_post', FLY), iso('lombaires'), iso('trapezes', { ...OPT, ...SHRUG })],
  },
  epaules: {
    hypertrophie: [main('epaules'), iso('epaules', RAISE), iso('epaules_post', FLY), iso('trapezes', { ...OPT, ...SHRUG })],
    force: [main('epaules'), iso('epaules', RAISE), iso('epaules_post', FLY), iso('trapezes', { ...OPT, ...SHRUG })],
    endurance: [sec('epaules'), iso('epaules', RAISE), iso('epaules_post', FLY), iso('trapezes', { ...OPT, ...SHRUG })],
  },
  bras: {
    hypertrophie: [sec('triceps', { ids: TRICEPS_COMPOUND }), iso('biceps'), iso('triceps', TRI_EXT), iso('avant_bras', { ...OPT, groups: ['carry'] })],
    force: [main('triceps', { ids: TRICEPS_COMPOUND }), iso('biceps'), iso('triceps', TRI_EXT)],
    endurance: [sec('triceps', { ids: TRICEPS_COMPOUND }), iso('biceps'), iso('triceps', TRI_EXT)],
  },
  pecs: {
    hypertrophie: [main('pecs'), iso('pecs', FLY), iso('pecs', PULLOVER), iso('triceps', TRI_EXT), core('tronc', OPT)],
    force: [main('pecs'), iso('pecs', FLY), iso('triceps', TRI_EXT), iso('pecs', { ...OPT, ...PULLOVER })],
    endurance: [sec('pecs'), iso('pecs', FLY), iso('triceps', TRI_EXT), iso('pecs', { ...OPT, ...PULLOVER })],
  },
  fessiers: {
    hypertrophie: [
      main('fessiers', { ids: HIP_THRUST_LOADED }), sec('ischios', { ids: RDL }), sec('fessiers', LUNGE),
      iso('ischios', { ids: LEG_CURL }), iso('fessiers', { ...PAIR, ids: [...KICKBACK, ...ABDUCTION] }), core('lombaires', OPT),
    ],
    force: [main('fessiers', { ids: HIP_THRUST_LOADED }), main('ischios', { ids: RDL }), sec('fessiers', { ...OPT, ...LUNGE }), iso('ischios', { ...OPT, ids: LEG_CURL }), core('lombaires', OPT)],
    endurance: [sec('fessiers', { ids: HIP_THRUST_LOADED }), sec('ischios', { ids: RDL }), sec('fessiers', LUNGE), iso('fessiers', { ...PAIR, ids: [...KICKBACK, ...ABDUCTION] }), iso('ischios', { ...OPT, ids: LEG_CURL }), core('lombaires', OPT)],
  },
  fessiers_ischios: {
    hypertrophie: [main('ischios', { ids: RDL }), main('fessiers', { ids: HIP_THRUST_LOADED }), sec(['fessiers', 'ischios'], LUNGE), iso('ischios', { ids: LEG_CURL }), iso('fessiers', { ...PAIR, ids: [...KICKBACK, ...ABDUCTION] }), core('lombaires', OPT)],
    force: [main('ischios', { ids: RDL }), main('fessiers', { ids: HIP_THRUST_LOADED }), sec(['fessiers', 'ischios'], { ...OPT, ...LUNGE }), iso('ischios', { ...OPT, ids: LEG_CURL }), core('lombaires', OPT)],
    endurance: [sec('ischios', { ids: RDL }), sec('fessiers', { ids: HIP_THRUST_LOADED }), sec(['fessiers', 'ischios'], LUNGE), iso('ischios', { ids: LEG_CURL }), iso('fessiers', { ...PAIR, ids: [...KICKBACK, ...ABDUCTION] }), core('lombaires', OPT)],
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
