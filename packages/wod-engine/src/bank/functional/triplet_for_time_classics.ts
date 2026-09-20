import type { Skeleton } from '../../types';

const slots: Skeleton['slots'] = [
  { pick: { family: ['barbell', 'dumbbell', 'kettlebell'], pattern_any: ['squat', 'hinge', 'push_v'] }, qty: 'scheme' },
  { pick: { family: ['gym'], pattern_any: ['pull_v', 'push_v', 'core'], pattern_not_of_slot: 0 }, qty: 'scheme' },
  { pick: { family: ['bodyweight', 'box', 'jump_rope'], pattern_not_of_slot: 1 }, qty: 'scheme' },
];

export const triplet_for_time_classics: Skeleton = {
  id: 'triplet_for_time_classics',
  discipline: 'functional',
  format: 'for_time',
  duration_range: [8, 20],
  durations: [10, 15, 20],
  intentions: ['mixed', 'gym', 'force'],
  band_by_intention: { mixed: 'medium', gym: 'light', force: 'heavy' },
  scheme: [21, 15, 9],
  rounds: 'scheme',
  slots,
  variants: [
    { id: '21-15-9', slots, scheme: [21, 15, 9], duration_range: [8, 12] },
    { id: '9-15-21', slots, scheme: [9, 15, 21], duration_range: [8, 12] },
    { id: '15-12-9', slots, scheme: [15, 12, 9], duration_range: [8, 12] },
    { id: '9-12-15', slots, scheme: [9, 12, 15], duration_range: [8, 12] },
    { id: '21-18-15-12-9-6-3', slots, scheme: [21, 18, 15, 12, 9, 6, 3], duration_range: [12, 20] },
    { id: '3-6-9-12-15-18-21', slots, scheme: [3, 6, 9, 12, 15, 18, 21], duration_range: [12, 20] },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 8.5, note: 'Transitions courtes et séries fractionnées avant l’échec.' },
};
