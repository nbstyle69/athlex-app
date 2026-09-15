import type { Skeleton } from '../../types';

/** Stations Hybrid (ergs en mètres). */
export const HYBRID_STATIONS = [
  'sled_push', 'sled_pull', 'sandbag_lunge', 'db_farmer_carry', 'wall_ball', 'burpee_broad_jump', 'ski_erg', 'row',
];

export const run_into_station: Skeleton = {
  id: 'run_into_station',
  discipline: 'hybrid',
  format: 'rounds_for_time',
  durations: [20, 30, 45],
  intentions: ['interval', 'engine', 'run'],
  band_by_intention: { interval: 'medium', engine: 'light', run: 'light' },
  rounds: { min: 4, max: 6 },
  slots: [
    { pick: { ids: ['run'], unit: 'm' }, qty: 'fixed', fixed_range: [400, 800] },
    { pick: { ids: HYBRID_STATIONS, erg_unit: 'm' }, qty: 'range', rotate_per_round: true },
  ],
  score_type: 'time',
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 8.5, note: 'Allure course à 90 % du 5 km, stations sans pause.' },
};
