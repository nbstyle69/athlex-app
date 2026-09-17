import type {
  SessionBlockAOption, SessionFinisherOption, SessionSkeleton, SessionStationItem,
} from '../types';

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
 * Seize finishers en sept familles, sur le modèle de la banque Functional. La piste en
 * tirait quatre et `finisher_repeat` était relâché presque toutes les semaines ; à douze
 * elle tombait pile sur la fenêtre d'anti-répétition (trois par semaine, quatre semaines
 * de journal), ce qui suffisait à la vider. Seize laissent de la marge.
 */
const CORE_FINISHERS: SessionFinisherOption[] = [
  // gainage
  fin('h_core_plank_hollow', 'core', 5, 3, [mv('plank_hold', 40, 's'), mv('hollow_rock', 15)]),
  fin('h_core_sit_up_superman', 'core', 5, 3, [mv('sit_up', 20), mv('superman', 30, 's')]),
  // gainage anti-rotation
  fin('h_core_deadbug_side', 'core', 5, 3, [mv('dead_bug', 10), mv('plank_hold', 30, 's', 'Side Plank (par côté)')]),
  fin('h_core_pallof', 'core', 5, 3, [mv('plank_hold', 30, 's', 'Pallof Press tenu (par côté)'), mv('hollow_rock', 15)]),
  // carries
  fin('h_carry_suitcase', 'carry', 5, 3, [mv('suitcase_carry', 40, 'm'), mv('dead_bug', 10)]),
  fin('h_carry_farmer_plank', 'carry', 5, 3, [mv('db_farmer_carry', 40, 'm'), mv('plank_hold', 30, 's')]),
  fin('h_carry_sandbag', 'carry', 5, 3, [mv('sandbag_carry', 40, 'm'), mv('sit_up', 20)]),
  // chaîne postérieure
  fin('h_post_hip_bridge', 'glutes', 5, 3, [mv('glute_bridge', 20), mv('superman', 30, 's')]),
  fin('h_post_rdl_bridge', 'glutes', 5, 3, [mv('bodyweight_single_leg_rdl', 10, 'reps', 'Single-Leg RDL poids du corps (par jambe)'), mv('glute_bridge', 20)]),
  // mollets
  fin('h_calves_raise', 'calves', 5, 3, [mv('bodyweight_calf_raise', 25), mv('plank_hold', 30, 's')]),
  // respiratoire sur erg
  fin('h_breath_row', 'breathing', 5, 3, [mv('row', 15, 'cal', 'Row en respiration nasale'), mv('plank_hold', 30, 's')]),
  fin('h_breath_ski', 'breathing', 5, 3, [mv('ski_erg', 15, 'cal', 'SkiErg facile, respiration nasale'), mv('dead_bug', 10)]),
  fin('h_breath_bike', 'breathing', 5, 3, [mv('bike_erg', 15, 'cal', 'Bike Erg facile, respiration nasale'), mv('superman', 30, 's')]),
  // épaules et haut du dos
  fin('h_shoulders_carry', 'shoulders', 5, 3, [mv('suitcase_carry', 40, 'm', 'Overhead Carry (par côté)'), mv('push_up', 10)]),
  fin('h_shoulders_pushup', 'shoulders', 5, 3, [mv('push_up', 15), mv('plank_hold', 30, 's')]),
  // mollets, second choix
  fin('h_calves_carry', 'calves', 5, 3, [mv('bodyweight_calf_raise', 25), mv('db_farmer_carry', 40, 'm')]),
];

/**
 * Retour au calme : un vrai bloc de fin, pas un finisher d'un round de trente secondes.
 * Cinq à huit minutes, une sortie facile puis trois étirements nommés.
 */
const COOLDOWNS: { minutes: number; lines: string[] }[] = [
  { minutes: 8, lines: [
    "Retour au calme (8') — 600 m de footing très lent ou 5' de vélo facile, respiration nasale.",
    'Étirements : ischios debout 45 s / jambe · fléchisseurs de hanche en fente 45 s / côté · mollets au mur 45 s / jambe.',
  ] },
  { minutes: 8, lines: [
    "Retour au calme (8') — 5' de rameur très facile, épaules relâchées.",
    'Étirements : chaîne postérieure assis 45 s · pigeon 45 s / côté · ouverture thoracique au mur 45 s / bras.',
  ] },
  { minutes: 6, lines: [
    "Retour au calme (6') — 400 m de marche rapide puis respiration 4-6 allongé, 2'.",
    'Étirements : quadriceps debout 45 s / jambe · adducteurs en grenouille 45 s · psoas en fente basse 45 s / côté.',
  ] },
];

// ─── H1 — Lundi, intervalles courts ──────────────────────────────────────────

const H1_A: SessionBlockAOption[] = [
  station('h1_sled_goblet', 'sled_push', 18, 120, 8, [
    item('sled_push', 25, 'm', { band: 'medium' }),
    item('kb_goblet_squat', 10, 'reps', { band: 'medium' }),
  ], 7.5),
  station('h1_pull_step', 'sled_pull', 18, 120, 8, [
    item('sled_pull', 25, 'm', { band: 'medium' }),
    item('box_step_up', 10, 'reps', { band: 'medium', load_from: 'db_farmer_carry', name: 'Box Step-ups lestés (2 × DB)' }),
  ], 7.5),
  station('h1_swing_squat', 'kb_swing_russian', 18, 120, 8, [
    item('kb_swing_russian', 15, 'reps', { band: 'medium' }),
    item('air_squat', 15, 'reps'),
  ], 7),
];

export const H1_intervals: SessionSkeleton = {
  id: 'H1_intervals', discipline: 'session', format: 'session', track: 'hybrid', day: 1,
  label: 'Intervalles', budget_min: 60,
  warmup: { minutes: 10, lines: ["Échauffement (10') — 800 m course progressive, 10 leg swings / jambe, 10 air squats, 10 pompes, 2 × 20 s skipping."] },
  block_a: H1_A,
  block_b: null,
  block_c: {
    intentions: ['run', 'interval'], durations: [20], pattern_not: [],
    skeletons: ['run_intervals', 'stations_interval', 'amrap_distances', 'run_into_station'],
  },
  finisher: CORE_FINISHERS,
};

// ─── H2 — Mardi, force et stations (jour modéré par conception) ──────────────

const H2_A: SessionBlockAOption[] = [
  station('h2_front_squat_carry', 'front_squat', 20, 180, 5, [
    item('front_squat', 6, 'reps', { band: 'medium' }),
    item('db_farmer_carry', 20, 'm', { band: 'medium' }),
  ], 7),
  station('h2_back_squat_carry', 'back_squat', 20, 180, 5, [
    item('back_squat', 6, 'reps', { band: 'medium' }),
    item('sandbag_carry', 20, 'm', { band: 'medium' }),
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
        item('row', 60, 's', { work_s: 60, name: 'Row — allure tenable, ni sprint ni promenade' }),
        item('sandbag_lunge', 60, 's', { band: 'medium', work_s: 60 }),
        item('ski_erg', 60, 's', { work_s: 60, name: 'SkiErg — allure tenable' }),
        item('kb_swing_russian', 60, 's', { band: 'medium', work_s: 60 }),
      ],
    },
  },
  {
    id: 'h2_stations_bike_charge', kind: 'station', movement: 'bike_erg', minutes: 20, rpe: 7.5,
    station: {
      every_s: 90, rounds: 12,
      items: [
        item('bike_erg', 60, 's', { work_s: 60, name: 'Bike Erg — allure tenable' }),
        item('wall_ball', 60, 's', { band: 'medium', work_s: 60 }),
        item('ski_erg', 60, 's', { work_s: 60, name: 'SkiErg — allure tenable' }),
        item('db_farmer_carry', 60, 's', { band: 'medium', work_s: 60 }),
      ],
    },
  },
];

export const H2_strength_stations: SessionSkeleton = {
  id: 'H2_strength_stations', discipline: 'session', format: 'session', track: 'hybrid', day: 2,
  label: 'Force & stations', budget_min: 60, max_rpe: HYBRID_TUESDAY_RPE,
  warmup: { minutes: 10, lines: ["Échauffement (10') — 500 m rameur facile, 10 hip hinges à la barre à vide, 10 fentes / jambe, 10 pompes, 20 m d'ours."] },
  block_a: H2_A,
  block_b: null,
  block_work: H2_WORK,
  block_c: null,
  finisher: CORE_FINISHERS,
};

// ─── H3 — Mercredi, course ───────────────────────────────────────────────────

const H3_A: SessionBlockAOption[] = [{
  id: 'h3_run_intervals', kind: 'run', movement: 'run', minutes: 30, rpe: 8.5,
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
  // le mercredi est déjà une journée dure par son bloc A : le bloc tiré reste du tronc
  block_c: { intentions: ['core'], durations: [10, 15], pattern_not: [], skeletons: ['core_carry_finisher'] },
  finisher: null,
};

// ─── H4 — Jeudi, engine continu (jour facile obligatoire) ────────────────────

export const H4_engine: SessionSkeleton = {
  id: 'H4_engine', discipline: 'session', format: 'session', track: 'hybrid', day: 4,
  label: 'Engine', budget_min: 60, max_rpe: HYBRID_EASY_RPE,
  warmup: { minutes: 8, lines: ["Échauffement (8') — 400 m course facile, 10 air squats, 10 pompes, 5 inchworms."] },
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
  ], 8),
  station('h5_sled_pull_heavy', 'sled_pull', 12, 150, 5, [
    item('sled_pull', 30, 'm', { band: 'heavy' }), item('run', 100, 'm'),
  ], 8),
  station('h5_sandbag_heavy', 'sandbag_carry', 12, 150, 5, [
    item('sandbag_carry', 50, 'm', { band: 'heavy' }), item('run', 100, 'm'),
  ], 8),
];

/**
 * Le cœur du vendredi, écrit : quatre tours de (poste tenu 90 s + 600 à 1 000 m de course
 * à allure cible). Tiré dans la banque partagée, le jour perdait son identité — il sortait
 * en stations sans course, à 1,7 km quand la séance doit en garantir 3.
 */
const H5_WORK: SessionBlockAOption[] = [{
  id: 'h5_compromised_run', kind: 'compromised', movement: 'run', minutes: 28, rpe: 8, timed: false,
  compromised: {
    rounds: 4, work_s: 90, run_m_min: 600, run_m_max: 1000, target: 'allure 5 km + 15 s/km',
    stations: [
      item('burpee_broad_jump', 40, 'm', { work_s: 90 }),
      item('box_step_up', 20, 'reps', { band: 'medium', load_from: 'db_farmer_carry', name: 'Box Step-ups lestés (2 × DB)', work_s: 90 }),
      item('wall_ball', 20, 'reps', { band: 'medium', work_s: 90 }),
      item('box_jump', 15, 'reps', { band: 'medium', work_s: 90 }),
      item('kb_swing_russian', 20, 'reps', { band: 'medium', work_s: 90 }),
      item('sandbag_lunge', 30, 'm', { band: 'medium', work_s: 90 }),
    ],
  },
}];

export const H5_compromised: SessionSkeleton = {
  id: 'H5_compromised', discipline: 'session', format: 'session', track: 'hybrid', day: 5,
  label: 'Course compromise', budget_min: 60,
  warmup: { minutes: 10, lines: ["Échauffement (10') — 600 m course, 10 hip hinges, 10 fentes / jambe, 20 m de sled à vide, 10 wall balls légères."] },
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
  label: 'Simulation', budget_min: 60,
  warmup: { minutes: 12, lines: ["Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide."] },
  block_a: null,
  block_b: null,
  block_work: [{
    id: 'h6_half_sim', kind: 'race', movement: 'run', minutes: 38, timed: true, rpe: 9,
    race: { rounds: 7, rounds_min: 6, rounds_max: 8, run_m: 500, stations: HALF_SIM_STATIONS, score: 'temps total' },
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
  label: 'Simulation · test de bloc', budget_min: 75,
  weeks_modulo: { modulo: 8, equals: 0 },
  warmup: { minutes: 12, lines: ["Échauffement (12') — 1 km progressif, gammes, puis 20 m de chaque station à vide. Prépare ton matériel : la séance s'enchaîne sans arrêt."] },
  block_a: null,
  block_b: null,
  block_work: [{
    id: 'h6_full_sim', kind: 'race', movement: 'run', minutes: 53, timed: true, rpe: 9,
    race: {
      rounds: 8, run_m: 1000, score: 'temps total', ordered: true,
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
