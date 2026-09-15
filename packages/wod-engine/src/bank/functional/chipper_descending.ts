import type { Skeleton } from '../../types';

export const chipper_descending: Skeleton = {
  id: 'chipper_descending',
  discipline: 'functional',
  format: 'chipper',
  durations: [20, 30],
  intentions: ['mixed', 'cardio'],
  band_by_intention: { mixed: 'medium', cardio: 'light' },
  scheme: [50, 40, 30, 20, 10],
  scheme_alternatives: [
    [50, 40, 30, 20, 10], [60, 50, 40, 30, 20], [80, 60, 50, 40, 30], [100, 80, 60, 40, 20], [100, 80, 60, 50, 40], [100, 90, 80, 70, 60],
  ],
  rounds: 'scheme',
  barbell_low_scheme: true,
  slots: [
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'scheme' },
    { pick: { family: ['box', 'jump_rope'] }, qty: 'scheme' },
    { pick: { family: ['kettlebell', 'dumbbell', 'wallball'] }, qty: 'scheme' },
    { pick: { family: ['barbell'], band: 'light' }, qty: 'scheme' },
    { pick: { family: ['bodyweight'], pattern_any: ['core', 'mono'] }, qty: 'scheme' },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 7.5, note: 'Gestion, pas de sprint avant le dernier tiers.' },
};
