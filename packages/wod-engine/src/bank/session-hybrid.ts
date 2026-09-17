import type {
  SessionBlockAOption, SessionFinisherOption, SessionSkeleton, SessionStationItem,
} from '../types';

/**
 * Squelettes de semaine Hybrid (piste `hybrid` de la programmation de box).
 *
 * Structure fixe lundi → samedi, contenu tiré par la graine. Deux différences avec
 * les squelettes Functional S1–S6 :
 *   - aucun bloc A haltéro ni gymnique : la force vit en `Every X' + station` ;
 *   - le bloc de travail est tiré dans la banque Hybrid existante (`discipline = 'hybrid'`,
 *     10 squelettes), restreinte par squelette à une liste blanche (`block_c.skeletons`).
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
/** RPE au-delà duquel une journée est « dure » (règle §3.5 : jamais deux de suite). */
export const HYBRID_HARD_RPE = 8;
/** Plafond de RPE du jeudi engine (règle §3.5). */
export const HYBRID_EASY_RPE = 6.5;

// ─── Fabriques ───────────────────────────────────────────────────────────────

const item = (id: string, qty: number, unit: SessionStationItem['unit'], band?: SessionStationItem['band'], name?: string): SessionStationItem =>
  ({ id, qty, unit, ...(band ? { band } : {}), ...(name ? { name } : {}) });

const station = (id: string, movement: string, minutes: number, every_s: number, rounds: number, items: SessionStationItem[]): SessionBlockAOption =>
  ({ id, kind: 'station', movement, minutes, station: { every_s, rounds, items } });

const fin = (id: string, family: SessionFinisherOption['family'], minutes: number, rounds: number, movements: SessionFinisherOption['movements']): SessionFinisherOption =>
  ({ id, family, rounds, minutes, movements });

const mv = (id: string, qty: number, unit: SessionFinisherOption['movements'][number]['unit'] = 'reps', name?: string) =>
  ({ id, qty, unit, ...(name ? { name } : {}) });

/** Tronc et carries de fin de séance — jamais de charge lourde, jamais d'échec. */
const CORE_FINISHERS: SessionFinisherOption[] = [
  fin('h_core_plank_hollow', 'core', 5, 3, [mv('plank_hold', 40, 's'), mv('hollow_rock', 12)]),
  fin('h_core_suitcase', 'carry', 5, 3, [mv('suitcase_carry', 40, 'm'), mv('dead_bug', 10)]),
  fin('h_core_sit_up_superman', 'core', 5, 3, [mv('sit_up', 20), mv('superman', 30, 's')]),
  fin('h_core_carry_plank', 'carry', 5, 3, [mv('db_farmer_carry', 40, 'm'), mv('plank_hold', 30, 's')]),
];

/** Retour au calme : mobilité seule, aucun renforcement (jeudi et samedi). */
const MOBILITY_FINISHERS: SessionFinisherOption[] = [
  fin('h_mob_hanches', 'breathing', 8, 1, [mv('plank_hold', 30, 's', 'Mobilité hanches, chevilles et chaîne postérieure')]),
  fin('h_mob_posterieure', 'breathing', 8, 1, [mv('plank_hold', 30, 's', 'Mobilité dorsale, ischios et mollets')]),
];

// ─── H1 — Lundi, intervalles courts ──────────────────────────────────────────

const H1_A: SessionBlockAOption[] = [
  station('h1_sled_goblet', 'sled_push', 16, 120, 8, [item('sled_push', 25, 'm', 'medium'), item('kb_goblet_squat', 10, 'reps', 'medium')]),
  station('h1_pull_step', 'sled_pull', 16, 120, 8, [item('sled_pull', 25, 'm', 'medium'), item('box_step_up', 12, 'reps', 'light')]),
  station('h1_swing_squat', 'kb_swing_russian', 16, 120, 8, [item('kb_swing_russian', 15, 'reps', 'medium'), item('air_squat', 15, 'reps')]),
];

export const H1_intervals: SessionSkeleton = {
  id: 'H1_intervals', discipline: 'session', format: 'session', track: 'hybrid', day: 1,
  label: 'Intervalles', budget_min: 60,
  warmup: { minutes: 10, lines: ["Échauffement (10') — 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 × 20 s skipping."] },
  block_a: H1_A,
  block_b: null,
  block_c: {
    intentions: ['run', 'interval', 'engine'], durations: [20, 30], pattern_not: [],
    skeletons: ['run_intervals', 'stations_interval', 'amrap_distances', 'run_into_station'],
  },
  finisher: CORE_FINISHERS,
};

// ─── H2 — Mardi, force et stations ───────────────────────────────────────────

const H2_A: SessionBlockAOption[] = [
  station('h2_front_squat_carry', 'front_squat', 20, 180, 5, [item('front_squat', 6, 'reps', 'medium'), item('db_farmer_carry', 20, 'm', 'medium')]),
  station('h2_back_squat_carry', 'back_squat', 20, 180, 5, [item('back_squat', 6, 'reps', 'medium'), item('suitcase_carry', 20, 'm', 'medium')]),
  station('h2_hip_thrust_carry', 'hip_thrust', 20, 180, 5, [item('hip_thrust', 10, 'reps', 'medium'), item('db_farmer_carry', 20, 'm', 'medium')]),
  station('h2_rdl_carry', 'romanian_deadlift', 20, 180, 5, [item('romanian_deadlift', 8, 'reps', 'medium'), item('sandbag_carry', 20, 'm', 'medium')]),
];

export const H2_strength_stations: SessionSkeleton = {
  id: 'H2_strength_stations', discipline: 'session', format: 'session', track: 'hybrid', day: 2,
  label: 'Force & stations', budget_min: 60,
  warmup: { minutes: 10, lines: ["Échauffement (10') — 500 m rameur facile, 10 hip hinges à la barre à vide, 10 fentes / jambe, 10 pompes, 20 m d'ours."] },
  block_a: H2_A,
  block_b: null,
  block_c: {
    intentions: ['interval', 'force', 'engine', 'run'], durations: [20], pattern_not: [],
    skeletons: ['stations_interval', 'sled_repeats', 'amrap_distances', 'run_into_station'],
  },
  finisher: CORE_FINISHERS,
};

// ─── H3 — Mercredi, course ───────────────────────────────────────────────────

const H3_A: SessionBlockAOption[] = [{
  id: 'h3_run_intervals', kind: 'run', movement: 'run', minutes: 30,
  run: {
    variants: [
      { label: '8 × 400 m', target: 'allure 5 km', rest_s: 60, meters: 3200 },
      { label: '5 × 800 m', target: 'allure 10 km − 10 s/km', rest_s: 90, meters: 4000 },
      { label: '3 × 1 600 m', target: 'allure 10 km', rest_s: 120, meters: 4800 },
      { label: '12 × 200 m shuttle', target: 'allure rapide et régulière', rest_s: 45, meters: 2400 },
    ],
  },
}];

export const H3_run: SessionSkeleton = {
  id: 'H3_run', discipline: 'session', format: 'session', track: 'hybrid', day: 3,
  label: 'Course', budget_min: 60,
  warmup: { minutes: 12, lines: ["Échauffement (12') — 1 km progressif, gammes (talons-fesses, montées de genoux, pas chassés) 2 × 20 m, 3 × 30 m d'accélérations."] },
  block_a: H3_A,
  block_b: null,
  block_c: {
    intentions: ['core', 'run', 'interval'], durations: [10, 15, 20], pattern_not: [],
    skeletons: ['core_carry_finisher', 'run_intervals', 'amrap_distances'],
  },
  finisher: null,
};

// ─── H4 — Jeudi, engine continu (jour facile obligatoire) ────────────────────

export const H4_engine: SessionSkeleton = {
  id: 'H4_engine', discipline: 'session', format: 'session', track: 'hybrid', day: 4,
  label: 'Engine', budget_min: 60,
  warmup: { minutes: 8, lines: ["Échauffement (8') — 400 m course facile, 10 air squats, 10 pompes, 5 inchworms."] },
  block_a: null,
  block_b: null,
  // 45' de continu : la seule durée qui tient le budget avec l'échauffement court et la
  // mobilité de fin. `engine_continuous` est le seul squelette de la banque à la proposer.
  block_c: { intentions: ['aerobic'], durations: [45], pattern_not: [], skeletons: ['engine_continuous'] },
  finisher: MOBILITY_FINISHERS,
};

// ─── H5 — Vendredi, course compromise ────────────────────────────────────────

/** Seul bloc de la semaine autorisé en bande lourde (règle §3.3). */
const H5_A: SessionBlockAOption[] = [
  station('h5_sled_push_heavy', 'sled_push', 12, 150, 5, [item('sled_push', 30, 'm', 'heavy'), item('run', 100, 'm')]),
  station('h5_sled_pull_heavy', 'sled_pull', 12, 150, 5, [item('sled_pull', 30, 'm', 'heavy'), item('run', 100, 'm')]),
  station('h5_sandbag_heavy', 'sandbag_carry', 12, 150, 5, [item('sandbag_carry', 50, 'm', 'heavy'), item('run', 100, 'm')]),
];

export const H5_compromised: SessionSkeleton = {
  id: 'H5_compromised', discipline: 'session', format: 'session', track: 'hybrid', day: 5,
  label: 'Course compromise', budget_min: 60,
  warmup: { minutes: 10, lines: ["Échauffement (10') — 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled à vide, 10 wall balls légères."] },
  block_a: H5_A,
  block_b: null,
  block_c: {
    intentions: ['run', 'interval', 'engine'], durations: [30], pattern_not: [],
    skeletons: ['compromised_run', 'run_into_station', 'stations_interval'],
  },
  finisher: CORE_FINISHERS,
};

// ─── H6 — Samedi, demi-simulation et simulation complète ─────────────────────

const HALF_SIM_STATIONS: SessionStationItem[] = [
  item('ski_erg', 500, 'm'),
  item('sled_push', 25, 'm', 'medium'),
  item('sled_pull', 25, 'm', 'medium'),
  item('burpee_broad_jump', 40, 'm'),
  item('db_farmer_carry', 100, 'm', 'medium'),
  item('sandbag_lunge', 50, 'm', 'medium'),
  item('wall_ball', 50, 'reps', 'medium'),
];

export const H6_simulation: SessionSkeleton = {
  id: 'H6_simulation', discipline: 'session', format: 'session', track: 'hybrid', day: 6,
  label: 'Simulation', budget_min: 60,
  warmup: { minutes: 12, lines: ["Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide."] },
  block_a: [{
    id: 'h6_half_sim', kind: 'race', movement: 'run', minutes: 40, timed: true,
    race: { rounds: 7, rounds_min: 6, rounds_max: 8, run_m: 500, stations: HALF_SIM_STATIONS, score: 'temps total' },
  }],
  block_b: null,
  block_c: null,
  finisher: MOBILITY_FINISHERS,
};

/**
 * Simulation complète : une semaine sur huit, à la place de la demi-simulation.
 * Seule séance de la piste au-delà de 60 minutes — le samedi suivant est allégé.
 */
export const H6_simulation_full: SessionSkeleton = {
  id: 'H6_simulation_full', discipline: 'session', format: 'session', track: 'hybrid', day: 6,
  label: 'Simulation · test de bloc', budget_min: 75,
  weeks_modulo: { modulo: 8, equals: 0 },
  warmup: { minutes: 12, lines: ["Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide. Prépare ton matériel : la séance s'enchaîne sans arrêt."] },
  block_a: [{
    id: 'h6_full_sim', kind: 'race', movement: 'run', minutes: 55, timed: true,
    race: {
      rounds: 8, run_m: 1000, score: 'temps total', ordered: true,
      stations: [
        item('ski_erg', 1000, 'm'),
        item('sled_push', 50, 'm', 'medium'),
        item('sled_pull', 50, 'm', 'medium'),
        item('burpee_broad_jump', 80, 'm'),
        item('row', 1000, 'm'),
        item('db_farmer_carry', 200, 'm', 'medium'),
        item('sandbag_lunge', 100, 'm', 'medium'),
        item('wall_ball', 100, 'reps', 'medium'),
      ],
    },
  }],
  block_b: null,
  block_c: null,
  finisher: MOBILITY_FINISHERS,
};

/** Les six jours de la semaine Hybrid, plus la simulation complète (samedi, une semaine sur huit). */
export const HYBRID_SESSION_SKELETONS: SessionSkeleton[] = [
  H1_intervals, H2_strength_stations, H3_run, H4_engine, H5_compromised, H6_simulation, H6_simulation_full,
];
