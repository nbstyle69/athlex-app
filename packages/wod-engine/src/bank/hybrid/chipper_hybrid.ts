import type { Skeleton } from '../../types';

export const chipper_hybrid: Skeleton = {
  id: 'chipper_hybrid',
  discipline: 'hybrid',
  format: 'chipper',
  duration_range: [18, 30],
  durations: [20, 30],
  intentions: ['interval', 'engine', 'aerobic', 'run'],
  band_by_intention: { interval: 'medium', engine: 'light', aerobic: 'light', run: 'light' },
  rounds: { min: 1, max: 1 },
  station_count: { min: 6, max: 7 },
  slots: [
    { pick: { ids: ['run'], unit: 'm' }, qty: 'draw', fixed_range: [800, 1000], role: 'ouverture' },
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'range', reps_range: [30, 60] },
    { pick: { ids: ['wall_ball', 'sandbag_lunge', 'sled_push', 'sled_pull'] }, qty: 'range' },
    { pick: { ids: ['db_farmer_carry', 'sandbag_carry'], unit: 'm' }, qty: 'range', reps_range: [50, 150] },
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'range', reps_range: [30, 60] },
    { pick: { ids: ['wall_ball', 'sandbag_lunge', 'sled_push', 'sled_pull'] }, qty: 'range', optional: true },
    { pick: { ids: ['run'], unit: 'm' }, qty: 'draw', fixed_range: [800, 1000], allow_repeat: true, role: 'fermeture' },
  ],
  score_type: 'time',
  cap_factor: 1.3,
  allow_variant_up: false,
  stimulus: { rpe: 7, note: 'Course en ouverture et fermeture, stations enchaînées à allure régulière.' },
};
