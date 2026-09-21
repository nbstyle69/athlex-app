import type { Skeleton } from '../../types';

const POOL = ['ski_erg', 'row', 'bike_erg', 'wall_ball', 'burpee_broad_jump', 'sandbag_lunge', 'sled_push', 'db_farmer_carry', 'kb_swing_russian'];

export const stations_interval: Skeleton = {
  id: 'stations_interval',
  discipline: 'hybrid',
  format: 'stations',
  duration_range: [15, 30],
  durations: [20, 30],
  intentions: ['interval'],
  band_by_intention: { interval: 'medium' },
  rest: { work_s: 90, rest_s: 30 },
  rounds: { min: 2, max: 3 },
  station_count: { min: 4, max: 5 },
  no_consecutive_erg: true,
  slots: [
    { pick: { ids: POOL, erg_unit: 'cal' }, qty: 'range' },
    { pick: { ids: POOL, erg_unit: 'cal', pattern_not_of_slot: 0 }, qty: 'range' },
    { pick: { ids: POOL, erg_unit: 'cal', pattern_not_of_slot: 1 }, qty: 'range' },
    { pick: { ids: POOL, erg_unit: 'cal', pattern_not_of_slot: 2 }, qty: 'range' },
    { pick: { ids: POOL, erg_unit: 'cal', pattern_not_of_slot: 3 }, qty: 'range', optional: true },
  ],
  score_type: 'reps_total',
  cap_factor: 1.0,
  allow_variant_up: false,
  stimulus: { rpe: 8.5, note: 'Alternance jambes / épaules / mono, 90 s de travail max effort.' },
};
