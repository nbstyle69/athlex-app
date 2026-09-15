import type { Skeleton } from '../../types';

export const couplet_for_time_21_15_9: Skeleton = {
  id: 'couplet_for_time_21_15_9',
  discipline: 'functional',
  format: 'for_time',
  durations: [8, 12],
  intentions: ['mixed', 'gym', 'force'],
  band_by_intention: { mixed: 'medium', force: 'heavy', gym: 'light' },
  scheme: [21, 15, 9],
  scheme_by_band: { heavy: [15, 12, 9] },
  scheme_alternatives: [[15, 12, 9], [21, 15, 9], [27, 21, 15], [30, 20, 10], [33, 27, 21]],
  rounds: 'scheme',
  slots: [
    { pick: { family: ['barbell', 'dumbbell'], pattern_any: ['squat', 'hinge', 'push_v'] }, qty: 'scheme' },
    { pick: { family: ['gym'], pattern_any: ['pull_v', 'push_v', 'core'], pattern_not_of_slot: 0 }, qty: 'scheme' },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 9, note: 'Sprint, sets courts dès le round 1.' },
};
