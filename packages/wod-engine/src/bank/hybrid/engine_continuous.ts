import type { Skeleton } from '../../types';

export const engine_continuous: Skeleton = {
  id: 'engine_continuous',
  discipline: 'hybrid',
  format: 'continuous',
  durations: [20, 30, 45],
  intentions: ['aerobic'],
  band_by_intention: { aerobic: 'light' },
  rounds: { min: 1, max: 6 },
  slots: [
    { pick: { ids: ['row', 'ski_erg'], unit: 'm' }, qty: 'fixed', fixed: 500 },
    { pick: { ids: ['run'], unit: 'm' }, qty: 'fixed', fixed: 400 },
    { pick: { ids: ['bike_erg'], unit: 'm' }, qty: 'fixed', fixed: 1000 },
    { pick: { ids: ['sandbag_carry', 'db_farmer_carry'], unit: 'm' }, qty: 'fixed', fixed: 200, optional: true },
  ],
  station_count: { min: 3, max: 4 },
  score_type: 'distance',
  cap_factor: 1.0,
  allow_variant_up: false,
  stimulus: { rpe: 6, note: 'Zone 3, conversation difficile mais possible. Rotation sans repos jusqu\'au budget.' },
};
