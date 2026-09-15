import type { Skeleton } from '../../types';

export const death_by: Skeleton = {
  id: 'death_by',
  discipline: 'functional',
  format: 'death_by',
  durations: [10, 15],
  intentions: ['mixed', 'force'],
  band_by_intention: { mixed: 'medium', force: 'heavy' },
  rest: { every_s: 60 },
  slots: [
    { pick: { modality: ['M'], pattern_any: ['mono'], unit: 'cal' }, qty: 'fixed', fixed: 5, optional: true, role: 'buy-in' },
    { pick: { family: ['barbell'], pattern_any: ['hinge', 'squat', 'push_v'] }, qty: 'minute' },
  ],
  score_type: 'reps_total',
  cap_factor: 1.0,
  allow_variant_up: false,
  stimulus: { rpe: 9, note: "S'arrête quand la minute n'est plus tenue." },
};
