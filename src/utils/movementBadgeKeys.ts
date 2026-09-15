// ── Clé canonique de mouvement → préfixe de badge ───────────────────
// Les compteurs de reps sont indexés par la clé canonique de
// `normalizeMovement` ; le catalogue, lui, porte des clés
// `mv_<préfixe>_<palier>`. Cette table est la seule jonction entre les deux, et
// elle sert aux deux chemins d'attribution — crédit du back-office et WOD
// terminé côté athlète. Une clé absente d'ici ne donne aucun badge.
export const MOVEMENT_BADGE_PREFIX: Record<string, string> = {
  air_squat: 'mv_air_squat',        bar_muscle_up: 'mv_bmu',
  bench_press: 'mv_bench_press',
  box_jump: 'mv_box_jump',
  burpee: 'mv_burpee',              burpee_box_jump: 'mv_burpee_bj',
  chest_to_bar: 'mv_c2b',           clean: 'mv_clean',
  clean_pull: 'mv_clean_pull',
  clean_and_jerk: 'mv_cj',          db_cj: 'mv_db_cj',
  db_push_press: 'mv_db_push_press', db_snatch: 'mv_db_snatch',
  db_strict_press: 'mv_db_strict_press',
  strict_press: 'mv_strict_press',
  db_thruster: 'mv_db_thruster',    deadlift: 'mv_deadlifts',
  devil_press: 'mv_devil_press',    double_under: 'mv_du',
  goblet_squat: 'mv_goblet_squat',  hollow_rock: 'mv_hollow',
  hspu: 'mv_hspu',                  kb_cj: 'mv_kb_cj',
  kb_snatch: 'mv_kb_snatch',        kb_swing: 'mv_kb_swing',
  kb_thruster: 'mv_kb_thruster',    knees_to_elbow: 'mv_k2e',
  lunge: 'mv_lunge',                mb_slam: 'mv_mb_slam',
  mountain_climber: 'mv_mtclimber', overhead_squat: 'mv_ohs',
  pistol_squat: 'mv_pistol',        press: 'mv_press',
  pull_over: 'mv_pullover',         pull_up: 'mv_pullup',
  push_up: 'mv_pushup',             ring_dip: 'mv_ring_dip',
  ring_muscle_up: 'mv_ring_mu',     ring_row: 'mv_ring_row',
  sdlhp: 'mv_sdlhp',
  single_under: 'mv_su',            sit_up: 'mv_situp',
  snatch: 'mv_snatch',              snatch_balance: 'mv_snatch_balance',
  snatch_high_pull: 'mv_snatch_hp',
  squat: 'mv_squat',                thruster: 'mv_thrusters',
  toes_to_bar: 'mv_t2b',            turkish_get_up: 'mv_turkish_gu',
  v_up: 'mv_vup',                   wall_ball: 'mv_wallball',
  wall_walk: 'mv_wallwalk',
};

export type MovementUnit = 'reps' | 'm' | 'cal';

/**
 * Mouvements cardio : un préfixe par unité. Les paliers `mv_row_*`,
 * `mv_bike_*`, `mv_ski_*` comptent des calories (leurs descriptions l'ont
 * toujours dit) ; les mètres ont leur propre préfixe `_m`, la course n'existe
 * qu'en mètres. Une rep de Row (ligne sans unité) ne donne aucun badge.
 */
export const CARDIO_BADGE_PREFIX: Record<string, Partial<Record<MovementUnit, string>>> = {
  row:     { cal: 'mv_row',  m: 'mv_row_m' },
  bike:    { cal: 'mv_bike', m: 'mv_bike_m' },
  ski_erg: { cal: 'mv_ski',  m: 'mv_ski_m' },
  run:     { m: 'mv_run' },
};

/** Préfixe de badge d'un `(mouvement, unité)`, ou `undefined` s'il n'en a pas. */
export function badgePrefixFor(movementKey: string, unit: MovementUnit = 'reps'): string | undefined {
  const cardio = CARDIO_BADGE_PREFIX[movementKey];
  if (cardio) return cardio[unit];
  if (unit !== 'reps') return undefined;
  return MOVEMENT_BADGE_PREFIX[movementKey];
}
