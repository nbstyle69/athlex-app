import type { Skeleton } from '../../types';

export const compromised_run: Skeleton = {
  id: 'compromised_run',
  discipline: 'hybrid',
  format: 'rounds_for_time',
  duration_range: [15, 30],
  durations: [20, 30],
  intentions: ['interval', 'run'],
  band_by_intention: { interval: 'medium', run: 'medium' },
  rounds: { min: 3, max: 4 },
  slots: [
    { pick: { ids: ['sled_push', 'sandbag_lunge', 'wall_ball', 'db_farmer_carry'] }, qty: 'range', role: 'station lourde 60-90 s' },
    { pick: { ids: ['run'], unit: 'm' }, qty: 'draw', fixed_range: [600, 1000] },
  ],
  score_type: 'time',
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: 'Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km.' },
};
