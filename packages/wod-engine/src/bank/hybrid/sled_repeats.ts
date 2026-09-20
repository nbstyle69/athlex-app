import type { Skeleton } from '../../types';

export const sled_repeats: Skeleton = {
  id: 'sled_repeats',
  discipline: 'hybrid',
  format: 'interval',
  duration_range: [15, 28],
  durations: [15, 20],
  intentions: ['force', 'interval'],
  band_by_intention: { force: 'heavy', interval: 'heavy' },
  rest: { every_s: 240 },
  rounds: { min: 4, max: 7 },
  max_work_fraction: 0.7,
  slots: [],
  variants: [
    {
      id: '25m-every4',
      duration_range: [16, 28],
      rest: { every_s: 240 },
      rounds: { min: 4, max: 7 },
      slots: [
        { pick: { ids: ['sled_push'], unit: 'm' }, qty: 'fixed', fixed: 25 },
        { pick: { ids: ['run'], unit: 'm' }, qty: 'fixed', fixed: 200 },
      ],
    },
    {
      id: '15m-every3',
      duration_range: [15, 21],
      rest: { every_s: 180 },
      rounds: { min: 5, max: 7 },
      slots: [
        { pick: { ids: ['sled_push'], unit: 'm' }, qty: 'fixed', fixed: 15 },
        { pick: { ids: ['run'], unit: 'm' }, qty: 'fixed', fixed: 200 },
      ],
    },
  ],
  score_type: 'time',
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: 'Lourd et court, repos réel entre les tours.' },
};
