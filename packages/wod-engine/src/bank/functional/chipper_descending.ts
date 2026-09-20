import type { Skeleton } from '../../types';

const slots: Skeleton['slots'] = [
  { pick: { family: ['erg'], unit: 'cal' }, qty: 'scheme' },
  { pick: { family: ['box', 'jump_rope'] }, qty: 'scheme' },
  { pick: { family: ['kettlebell', 'dumbbell', 'wallball'] }, qty: 'scheme' },
  { pick: { family: ['barbell'], band: 'light' }, qty: 'scheme' },
  { pick: { family: ['bodyweight'], pattern_any: ['core', 'mono'] }, qty: 'scheme' },
];

export const chipper_descending: Skeleton = {
  id: 'chipper_descending',
  discipline: 'functional',
  format: 'chipper',
  duration_range: [8, 14],
  durations: [15, 20],
  intentions: ['mixed', 'cardio'],
  band_by_intention: { mixed: 'medium', cardio: 'light' },
  scheme: [30, 25, 20, 15, 10],
  rounds: 'scheme',
  barbell_low_scheme: true,
  slots,
  variants: [
    { id: '50-40-30-20-10', slots, scheme: [50, 40, 30, 20, 10], duration_range: [11, 14] },
    { id: '40-30-20-10', slots: slots.slice(0, 4), scheme: [40, 30, 20, 10], duration_range: [8, 10] },
    { id: '30-25-20-15-10', slots, scheme: [30, 25, 20, 15, 10], duration_range: [8, 10] },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 7.5, note: 'Gestion, pas de sprint avant le dernier tiers.' },
};
