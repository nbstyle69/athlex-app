import type { Skeleton } from '../../types';

export const interval_work_rest: Skeleton = {
  id: 'interval_work_rest',
  discipline: 'functional',
  format: 'interval',
  durations: [15, 20],
  intentions: ['mixed', 'cardio', 'force'],
  band_by_intention: { mixed: 'medium', cardio: 'light', force: 'heavy' },
  rest: { every_s: [180, 240] },
  rounds: { min: 4, max: 6 },
  max_work_fraction: 0.65,
  slots: [
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'range' },
    { pick: { family: ['barbell', 'dumbbell'], pattern_any: ['hinge', 'squat'] }, qty: 'range' },
    { pick: { family: ['bodyweight'], pattern_any: ['mono'] }, qty: 'range' },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 9, note: 'Chaque intervalle est un sprint, repos complet.' },
};
