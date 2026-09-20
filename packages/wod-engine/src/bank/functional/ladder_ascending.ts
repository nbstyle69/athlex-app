import type { Skeleton } from '../../types';

export const ladder_ascending: Skeleton = {
  id: 'ladder_ascending',
  discipline: 'functional',
  format: 'ladder',
  duration_range: [8, 12],
  durations: [10, 15],
  intentions: ['mixed', 'gym'],
  ladder_mode: 'open',
  band_by_intention: { mixed: 'medium', gym: 'light' },
  scheme: [3, 6],
  rounds: 'scheme',
  slots: [
    { pick: { family: ['barbell', 'dumbbell'], pattern_any: ['squat', 'push_v', 'hinge'] }, qty: 'scheme' },
    { pick: { family: ['gym'], pattern_any: ['pull_v', 'core'], pattern_not_of_slot: 0 }, qty: 'scheme' },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 8, note: 'Les premiers paliers se font sans poser la barre.' },
};
