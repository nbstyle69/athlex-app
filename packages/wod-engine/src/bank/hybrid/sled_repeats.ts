import type { Skeleton } from '../../types';

export const sled_repeats: Skeleton = {
  id: 'sled_repeats',
  discipline: 'hybrid',
  format: 'interval',
  durations: [15, 20],
  intentions: ['force', 'interval'],
  band_by_intention: { force: 'heavy', interval: 'heavy' },
  rest: { every_s: 180 },
  rounds: { min: 5, max: 7 },
  max_work_fraction: 0.75,
  slots: [
    { pick: { ids: ['sled_push'], unit: 'm' }, qty: 'fixed', fixed_range: [25, 30] },
    { pick: { ids: ['sled_pull', 'sandbag_carry'], unit: 'm' }, qty: 'fixed', fixed_by_id: { sled_pull: 25, sandbag_carry: 50 } },
    { pick: { ids: ['run'], unit: 'm' }, qty: 'fixed', fixed_range: [100, 200] },
  ],
  score_type: 'time',
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: 'Lourd et court, repos réel entre les tours.' },
};
