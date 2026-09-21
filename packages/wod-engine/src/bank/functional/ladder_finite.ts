import type { Skeleton } from '../../types';

const slots: Skeleton['slots'] = [
  { pick: { family: ['barbell', 'dumbbell'], pattern_any: ['squat', 'push_v', 'hinge'] }, qty: 'scheme' },
  { pick: { family: ['gym', 'bodyweight'], pattern_any: ['pull_v', 'push_v', 'core'], pattern_not_of_slot: 0 }, qty: 'scheme' },
];

export const ladder_finite: Skeleton = {
  id: 'ladder_finite',
  discipline: 'functional',
  format: 'ladder',
  duration_range: [4, 12],
  durations: [10, 15, 20],
  intentions: ['mixed', 'gym'],
  band_by_intention: { mixed: 'medium', gym: 'light' },
  ladder_mode: 'finite',
  scheme: [3, 6, 9, 12],
  rounds: 'scheme',
  slots,
  variants: [
    { id: '3-6-9-12', slots, scheme: [3, 6, 9, 12], duration_range: [4, 8] },
    { id: '12-9-6-3', slots, scheme: [12, 9, 6, 3], duration_range: [4, 8] },
    { id: '2-4-6-8-10', slots, scheme: [2, 4, 6, 8, 10], duration_range: [4, 8] },
    { id: '10-8-6-4-2', slots, scheme: [10, 8, 6, 4, 2], duration_range: [4, 8] },
    { id: '3-6-9-12-9-6-3', slots, scheme: [3, 6, 9, 12, 9, 6, 3], duration_range: [8, 12] },
    { id: '2-4-6-8-10-8-6-4-2', slots, scheme: [2, 4, 6, 8, 10, 8, 6, 4, 2], duration_range: [8, 12] },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 8, note: 'Rythme progressif, garder des séries propres sur le sommet.' },
};
