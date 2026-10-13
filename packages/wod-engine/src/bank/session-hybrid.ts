import type {
  SessionBlockAOption, SessionFinisherOption, SessionSkeleton, SessionStationItem,
} from '../types';
import { fr } from '../i18n/fr';

const T = fr.banque;

/**
 * Squelettes de semaine Hybrid (piste `hybrid` de la programmation de box).
 *
 * Structure fixe lundi → samedi, contenu tiré par la graine. Trois différences avec
 * les squelettes Functional S1–S6 :
 *   - aucun bloc A haltéro ni gymnique : la force vit en `Every X' + station` ;
 *   - les jours dont l'identité tient à leur structure (mardi stations, vendredi course
 *     compromise, samedi simulation) portent un bloc de travail écrit (`block_work`),
 *     dont les postes sont tirés ; les autres tirent dans la banque Hybrid partagée ;
 *   - jeudi et samedi finissent par un retour au calme, pas par un finisher.
 *
 * Le samedi a deux squelettes : la demi-simulation `H6_simulation` et, une semaine sur
 * huit (`iso_week % 8 === 0`), la simulation complète `H6_simulation_full` — seule séance
 * de la piste qui dépasse le budget de 60 minutes.
 */

// ─── Mouvements interdits à la piste (règles §3.1 et §3.2 du brief) ──────────
/**
 * Haltéro technique et gymnique avancé : jamais en programmation Hybrid de box.
 * Le catalogue n'est pas touché — un athlète qui choisit Hybrid dans le générateur
 * peut toujours les tirer ; c'est la semaine posée sur le Whiteboard qui reste lisible.
 */
export const HYBRID_FORBIDDEN_IDS: readonly string[] = [
  // haltéro technique
  'power_snatch', 'squat_snatch', 'hang_power_snatch', 'hang_squat_snatch', 'muscle_snatch', 'snatch_balance',
  'db_snatch', 'kb_snatch', 'power_clean', 'squat_clean', 'hang_power_clean', 'hang_squat_clean', 'muscle_clean',
  'clean_and_jerk', 'db_clean_and_jerk', 'kb_clean_and_jerk', 'kb_clean', 'sandbag_clean', 'push_jerk', 'split_jerk',
  'cluster', 'thruster', 'overhead_squat', 'snatch_deadlift', 'clean_deadlift',
  // gymnique avancé
  'bar_muscle_up', 'ring_muscle_up', 'handstand_push_up', 'strict_handstand_push_up', 'handstand_walk',
  'handstand_hold', 'wall_walk', 'half_wall_walk', 'rope_climb', 'legless_rope_climb', 'pistol', 'box_pistol',
  'pistol_to_box', 'chest_to_bar', 'bar_muscle_up_banded',
];

/** Mouvements sautés comptés au plafond hebdomadaire (règle §3.7 : 60 par semaine). */
export const HYBRID_JUMP_IDS: readonly string[] = ['box_jump', 'box_jump_over', 'burpee_box_jump', 'burpee_box_jump_over'];
export const HYBRID_WEEKLY_JUMP_CAP = 60;
/** Distance de course minimale sur la semaine, course et ergs confondus (règle §3.4). */
export const HYBRID_WEEKLY_RUN_M = 12000;
/** Distance de course minimale du vendredi : c'est la séance « course compromise ». */
export const HYBRID_FRIDAY_RUN_M = 3000;
/** RPE au-delà duquel une journée est « dure » (règle §3.5 : jamais deux de suite). */
export const HYBRID_HARD_RPE = 8;
/** Plafond de RPE du jeudi engine (règle §3.5). */
export const HYBRID_EASY_RPE = 6.5;
/** Plafond de RPE du mardi : force puis stations à 80 % d'effort, jamais un second jour dur. */
export const HYBRID_TUESDAY_RPE = 7.5;
/**
 * Plafond de RPE du vendredi. La course compromise se court à allure cible, pas à fond :
 * sans ce plafond, vendredi (8) précédait samedi (9) et la semaine enchaînait ses deux
 * séances les plus dures.
 */
export const HYBRID_FRIDAY_RPE = 7.5;

// ─── Fabriques ───────────────────────────────────────────────────────────────

interface ItemOpts { band?: SessionStationItem['band']; name?: string; load_from?: string; work_s?: number }
const item = (id: string, qty: number, unit: SessionStationItem['unit'], o: ItemOpts = {}): SessionStationItem =>
  ({ id, qty, unit, ...(o.band ? { band: o.band } : {}), ...(o.name ? { name: o.name } : {}),
    ...(o.load_from ? { load_from: o.load_from } : {}), ...(o.work_s ? { work_s: o.work_s } : {}) });

const station = (id: string, movement: string, minutes: number, every_s: number, rounds: number, items: SessionStationItem[], rpe: number): SessionBlockAOption =>
  ({ id, kind: 'station', movement, minutes, rpe, station: { every_s, rounds, items } });

const fin = (id: string, family: SessionFinisherOption['family'], minutes: number, rounds: number, movements: SessionFinisherOption['movements']): SessionFinisherOption =>
  ({ id, family, rounds, minutes, movements });

const mv = (id: string, qty: number, unit: SessionFinisherOption['movements'][number]['unit'] = 'reps', name?: string) =>
  ({ id, qty, unit, ...(name ? { name } : {}) });

/**
 * Vingt finishers en sept familles, sur le modèle de la banque Functional. La piste en
 * tirait quatre et `finisher_repeat` était relâché presque toutes les semaines ; à douze
 * elle tombait pile sur la fenêtre d'anti-répétition (trois par semaine, quatre semaines
 * de journal), ce qui suffisait à la vider. Quatre jours en portent désormais un (lundi, mardi,
 * mercredi, vendredi) : vingt laissent de la marge sur les quatre semaines de journal.
 */
const CORE_FINISHERS: SessionFinisherOption[] = [
  // gainage
  fin('h_core_plank_hollow', 'core', 5, 3, [mv('plank_hold', 40, 's'), mv('hollow_rock', 15)]),
  fin('h_core_sit_up_superman', 'core', 5, 3, [mv('sit_up', 20), mv('superman', 30, 's')]),
  // gainage anti-rotation
  fin('h_core_deadbug_side', 'core', 5, 3, [mv('dead_bug', 10), mv('plank_hold', 30, 's', T.finisher.h_core_deadbug_side.plank_hold)]),
  fin('h_core_pallof', 'core', 5, 3, [mv('plank_hold', 30, 's', T.finisher.h_core_pallof.plank_hold), mv('hollow_rock', 15)]),
  // carries
  fin('h_carry_suitcase', 'carry', 5, 3, [mv('suitcase_carry', 40, 'm'), mv('dead_bug', 10)]),
  fin('h_carry_farmer_plank', 'carry', 5, 3, [mv('db_farmer_carry', 40, 'm'), mv('plank_hold', 30, 's')]),
  fin('h_carry_sandbag', 'carry', 5, 3, [mv('sandbag_carry', 40, 'm'), mv('sit_up', 20)]),
  // chaîne postérieure
  fin('h_post_hip_bridge', 'glutes', 5, 3, [mv('glute_bridge', 20), mv('superman', 30, 's')]),
  fin('h_post_rdl_bridge', 'glutes', 5, 3, [mv('bodyweight_single_leg_rdl', 10, 'reps', T.finisher.h_post_rdl_bridge.bodyweight_single_leg_rdl), mv('glute_bridge', 20)]),
  // mollets
  fin('h_calves_raise', 'calves', 5, 3, [mv('bodyweight_calf_raise', 25), mv('plank_hold', 30, 's')]),
  // respiratoire sur erg
  fin('h_breath_row', 'breathing', 5, 3, [mv('row', 15, 'cal', T.finisher.h_breath_row.row), mv('plank_hold', 30, 's')]),
  fin('h_breath_ski', 'breathing', 5, 3, [mv('ski_erg', 15, 'cal', T.finisher.h_breath_ski.ski_erg), mv('dead_bug', 10)]),
  fin('h_breath_bike', 'breathing', 5, 3, [mv('bike_erg', 15, 'cal', T.finisher.h_breath_bike.bike_erg), mv('superman', 30, 's')]),
  // épaules et haut du dos
  fin('h_shoulders_carry', 'shoulders', 5, 3, [mv('suitcase_carry', 40, 'm', T.finisher.h_shoulders_carry.suitcase_carry), mv('push_up', 10)]),
  fin('h_shoulders_pushup', 'shoulders', 5, 3, [mv('push_up', 15), mv('plank_hold', 30, 's')]),
  // mollets, second choix
  fin('h_calves_carry', 'calves', 5, 3, [mv('bodyweight_calf_raise', 25), mv('db_farmer_carry', 40, 'm')]),
  // gainage, troisième choix
  fin('h_core_hollow_superman', 'core', 5, 3, [mv('hollow_rock', 20), mv('superman', 40, 's')]),
  fin('h_core_situp_plank', 'core', 5, 3, [mv('sit_up', 25), mv('plank_hold', 40, 's')]),
  fin('h_post_bridge_deadbug', 'glutes', 5, 3, [mv('glute_bridge', 25), mv('dead_bug', 12)]),
  fin('h_breath_row_long', 'breathing', 5, 2, [mv('row', 25, 'cal', T.finisher.h_breath_row_long.row), mv('superman', 40, 's')]),
];

/**
 * Retour au calme : un vrai bloc de fin, pas un finisher d'un round de trente secondes.
 * Cinq à huit minutes, une sortie facile puis trois étirements nommés.
 */
const COOLDOWNS: { minutes: number; lines: string[] }[] = [
  { minutes: 8, lines: [...T.retourAuCalme[0]] },
  { minutes: 8, lines: [...T.retourAuCalme[1]] },
  { minutes: 6, lines: [...T.retourAuCalme[2]] },
];

// ─── H1 — Lundi, intervalles courts ──────────────────────────────────────────

/**
 * Pas de sled le lundi : il est au bloc lourd du vendredi et dans la simulation du samedi.
 * L'y remettre en faisait un mouvement de trois jours sur six.
 */
const H1_A: SessionBlockAOption[] = [
  station('h1_goblet_squat', 'kb_goblet_squat', 18, 120, 8, [
    item('kb_goblet_squat', 12, 'reps', { band: 'medium' }),
    item('air_squat', 15, 'reps'),
  ], 7.5),
  station('h1_swing_step', 'kb_swing_russian', 18, 120, 8, [
    item('kb_swing_russian', 15, 'reps', { band: 'medium' }),
    item('box_step_up', 10, 'reps', { band: 'medium', load_from: 'db_farmer_carry', name: T.poste.stepUpsLestes }),
  ], 7.5),
  station('h1_carry_pushup', 'suitcase_carry', 18, 120, 8, [
    item('suitcase_carry', 40, 'm'),
    item('push_up', 12, 'reps'),
  ], 7),
];

export const H1_intervals: SessionSkeleton = {
  id: 'H1_intervals', discipline: 'session', format: 'session', track: 'hybrid', day: 1,
  label: T.seance.H1_intervals.label, budget_min: 60,
  warmup: { minutes: 10, lines: [T.seance.H1_intervals.echauffement] },
  block_a: H1_A,
  block_b: null,
  // `run_intervals` est exclu : le mercredi EST la séance d'intervalles de course, dans son
  // bloc A. Le lundi est « intervalles courts avec stations ».
  block_c: {
    intentions: ['interval', 'engine', 'run'], durations: [20], pattern_not: [],
    skeletons: ['amrap_distances', 'stations_interval', 'run_into_station', 'compromised_run'],
  },
  finisher: CORE_FINISHERS,
};

// ─── H2 — Mardi, force et stations (jour modéré par conception) ──────────────

/**
 * Le back squat est écarté : sa bande moyenne au catalogue vaut 100/70 kg, soit un vrai
 * lourd pour cinq séries de six en bloc A Hybrid. Le front squat (70/50) et la charnière
 * tiennent la consigne « bande moyenne » sans la trahir.
 */
const H2_A: SessionBlockAOption[] = [
  station('h2_front_squat_carry', 'front_squat', 20, 180, 5, [
    item('front_squat', 6, 'reps', { band: 'medium' }),
    item('db_farmer_carry', 20, 'm', { band: 'medium' }),
  ], 7),
  station('h2_front_squat_sandbag', 'front_squat', 20, 180, 5, [
    item('front_squat', 6, 'reps', { band: 'medium' }),
    item('sandbag_carry', 20, 'm', { band: 'medium' }),
  ], 7),
  station('h2_goblet_carry', 'kb_goblet_squat', 20, 180, 5, [
    item('kb_goblet_squat', 12, 'reps', { band: 'medium' }),
    item('db_farmer_carry', 20, 'm', { band: 'medium' }),
  ], 7),
];

/**
 * Stations du mardi, écrites : quatre postes, trois tours, 60 s de travail pour 30 s de
 * repos, à 80 % d'effort. Écrites plutôt que tirées parce que tous les squelettes de
 * stations de la banque partagée sont à RPE 8,5 — le mardi resterait un second jour dur.
 */
const H2_WORK: SessionBlockAOption[] = [
  {
    id: 'h2_stations_erg_charge', kind: 'station', movement: 'row', minutes: 20, rpe: 7.5,
    station: {
      every_s: 90, rounds: 12,
      items: [
        item('row', 60, 's', { work_s: 60, name: T.poste.rowTenable }),
        item('sandbag_lunge', 60, 's', { band: 'medium', work_s: 60 }),
        item('ski_erg', 60, 's', { work_s: 60, name: T.poste.skiTenable }),
        item('sandbag_carry', 60, 's', { band: 'medium', work_s: 60 }),
      ],
    },
  },
  {
    id: 'h2_stations_bike_charge', kind: 'station', movement: 'bike_erg', minutes: 20, rpe: 7.5,
    station: {
      every_s: 90, rounds: 12,
      items: [
        item('bike_erg', 60, 's', { work_s: 60, name: T.poste.bikeTenable }),
        item('wall_ball', 60, 's', { band: 'medium', work_s: 60 }),
        item('ski_erg', 60, 's', { work_s: 60, name: T.poste.skiTenable }),
        item('db_farmer_carry', 60, 's', { band: 'medium', work_s: 60 }),
      ],
    },
  },
];

export const H2_strength_stations: SessionSkeleton = {
  id: 'H2_strength_stations', discipline: 'session', format: 'session', track: 'hybrid', day: 2,
  label: T.seance.H2_strength_stations.label, budget_min: 60, max_rpe: HYBRID_TUESDAY_RPE,
  warmup: { minutes: 10, lines: [T.seance.H2_strength_stations.echauffement] },
  block_a: H2_A,
  block_b: null,
  block_work: H2_WORK,
  block_c: null,
  finisher: CORE_FINISHERS,
};

// ─── H3 — Mercredi, course ───────────────────────────────────────────────────

const H3_A: SessionBlockAOption[] = [{
  id: 'h3_run_intervals', kind: 'run', movement: 'run', minutes: 30, rpe: 8.5, timed: true,
  run: {
    variants: [
      { label: T.course.variantes[0].label, target: T.course.variantes[0].cible, rest_s: 60, meters: 3200 },
      { label: T.course.variantes[1].label, target: T.course.variantes[1].cible, rest_s: 90, meters: 4000 },
      { label: T.course.variantes[2].label, target: T.course.variantes[2].cible, rest_s: 120, meters: 4800 },
      { label: T.course.variantes[3].label, target: T.course.variantes[3].cible, rest_s: 45, meters: 2400 },
    ],
  },
}];

export const H3_run: SessionSkeleton = {
  id: 'H3_run', discipline: 'session', format: 'session', track: 'hybrid', day: 3,
  label: T.seance.H3_run.label, budget_min: 60,
  warmup: { minutes: 12, lines: [T.seance.H3_run.echauffement] },
  block_a: H3_A,
  block_b: null,
  /*
   * Aucun bloc tiré : `core_carry_finisher` est le seul squelette court de la banque
   * Hybrid, et ses carries sont déjà au mardi et au jeudi — les deux jours voisins.
   * Le tronc du mercredi passe donc en finisher, où la banque est large.
   */
  block_c: null,
  finisher: CORE_FINISHERS,
  // après des intervalles de course, la sortie lente fait partie de la séance
  cooldown: COOLDOWNS,
};

// ─── H4 — Jeudi, engine continu (jour facile obligatoire) ────────────────────

export const H4_engine: SessionSkeleton = {
  id: 'H4_engine', discipline: 'session', format: 'session', track: 'hybrid', day: 4,
  label: T.seance.H4_engine.label, budget_min: 60, max_rpe: HYBRID_EASY_RPE,
  warmup: { minutes: 8, lines: [T.seance.H4_engine.echauffement] },
  block_a: null,
  block_b: null,
  block_c: { intentions: ['aerobic'], durations: [35, 40], pattern_not: [], skeletons: ['engine_continuous', 'engine_negative_split'] },
  finisher: null,
  cooldown: COOLDOWNS,
};

// ─── H5 — Vendredi, course compromise ────────────────────────────────────────

/** Seul bloc de la semaine autorisé en bande lourde (règle §3.3). */
const H5_A: SessionBlockAOption[] = [
  station('h5_sled_push_heavy', 'sled_push', 12, 150, 5, [
    item('sled_push', 30, 'm', { band: 'heavy' }), item('run', 100, 'm'),
  ], HYBRID_FRIDAY_RPE),
  station('h5_sled_pull_heavy', 'sled_pull', 12, 150, 5, [
    item('sled_pull', 30, 'm', { band: 'heavy' }), item('run', 100, 'm'),
  ], HYBRID_FRIDAY_RPE),
  station('h5_sandbag_heavy', 'sandbag_carry', 12, 150, 5, [
    item('sandbag_carry', 50, 'm', { band: 'heavy' }), item('run', 100, 'm'),
  ], HYBRID_FRIDAY_RPE),
];

/**
 * Le cœur du vendredi, écrit : quatre tours de (poste tenu 90 s + 600 à 1 000 m de course
 * à allure cible). Tiré dans la banque partagée, le jour perdait son identité — il sortait
 * en stations sans course, à 1,7 km quand la séance doit en garantir 3.
 */
const H5_WORK: SessionBlockAOption[] = [{
  id: 'h5_compromised_run', kind: 'compromised', movement: 'run', minutes: 28, rpe: HYBRID_FRIDAY_RPE, timed: false,
  compromised: {
    rounds: 4, work_s: 90, run_m_min: 600, run_m_max: 1000, target: T.course.compromiseCible,
    // aucun poste en commun avec la simulation du samedi : les deux jours se suivent,
    // et un mouvement qui revient le lendemain est la répétition la plus visible
    stations: [
      item('box_step_up', 20, 'reps', { band: 'medium', load_from: 'db_farmer_carry', name: T.poste.stepUpsLestes, work_s: 90 }),
      item('box_jump', 15, 'reps', { band: 'medium', work_s: 90 }),
      item('burpee', 20, 'reps', { work_s: 90 }),
      item('sandbag_carry', 40, 'm', { band: 'medium', work_s: 90 }),
      item('suitcase_carry', 40, 'm', { work_s: 90 }),
      item('air_squat', 30, 'reps', { work_s: 90 }),
    ],
  },
}];

export const H5_compromised: SessionSkeleton = {
  id: 'H5_compromised', discipline: 'session', format: 'session', track: 'hybrid', day: 5,
  label: T.seance.H5_compromised.label, budget_min: 60, max_rpe: HYBRID_FRIDAY_RPE,
  warmup: { minutes: 10, lines: [T.seance.H5_compromised.echauffement] },
  block_a: H5_A,
  block_b: null,
  block_work: H5_WORK,
  block_c: null,
  finisher: CORE_FINISHERS,
};

// ─── H6 — Samedi, demi-simulation et simulation complète ─────────────────────

const HALF_SIM_STATIONS: SessionStationItem[] = [
  item('ski_erg', 500, 'm'),
  item('sled_push', 25, 'm', { band: 'medium' }),
  item('sled_pull', 25, 'm', { band: 'medium' }),
  item('burpee_broad_jump', 40, 'm'),
  item('db_farmer_carry', 100, 'm', { band: 'medium' }),
  item('sandbag_lunge', 50, 'm', { band: 'medium' }),
  item('wall_ball', 50, 'reps', { band: 'medium' }),
];

export const H6_simulation: SessionSkeleton = {
  id: 'H6_simulation', discipline: 'session', format: 'session', track: 'hybrid', day: 6,
  label: T.seance.H6_simulation.label, budget_min: 60,
  warmup: { minutes: 12, lines: [T.seance.H6_simulation.echauffement] },
  block_a: null,
  block_b: null,
  block_work: [{
    id: 'h6_half_sim', kind: 'race', movement: 'run', minutes: 38, timed: true, rpe: 9,
    race: { rounds: 7, rounds_min: 6, rounds_max: 8, run_m: 500, stations: HALF_SIM_STATIONS, score: T.course.scoreSimulation },
  }],
  block_c: null,
  finisher: null,
  cooldown: COOLDOWNS,
};

/**
 * Simulation complète : une semaine sur huit, à la place de la demi-simulation.
 * Seule séance de la piste au-delà de 60 minutes — le samedi suivant est allégé.
 */
export const H6_simulation_full: SessionSkeleton = {
  id: 'H6_simulation_full', discipline: 'session', format: 'session', track: 'hybrid', day: 6,
  label: T.seance.H6_simulation_full.label, budget_min: 75,
  weeks_modulo: { modulo: 8, equals: 0 },
  warmup: { minutes: 12, lines: [T.seance.H6_simulation_full.echauffement] },
  block_a: null,
  block_b: null,
  block_work: [{
    id: 'h6_full_sim', kind: 'race', movement: 'run', minutes: 53, timed: true, rpe: 9,
    race: {
      rounds: 8, run_m: 1000, score: T.course.scoreSimulation, ordered: true,
      stations: [
        item('ski_erg', 1000, 'm'),
        item('sled_push', 50, 'm', { band: 'medium' }),
        item('sled_pull', 50, 'm', { band: 'medium' }),
        item('burpee_broad_jump', 80, 'm'),
        item('row', 1000, 'm'),
        item('db_farmer_carry', 200, 'm', { band: 'medium' }),
        item('sandbag_lunge', 100, 'm', { band: 'medium' }),
        item('wall_ball', 100, 'reps', { band: 'medium' }),
      ],
    },
  }],
  block_c: null,
  finisher: null,
  cooldown: COOLDOWNS,
};

/** Les six jours de la semaine Hybrid, plus la simulation complète (samedi, une semaine sur huit). */
export const HYBRID_SESSION_SKELETONS: SessionSkeleton[] = [
  H1_intervals, H2_strength_stations, H3_run, H4_engine, H5_compromised, H6_simulation, H6_simulation_full,
];
