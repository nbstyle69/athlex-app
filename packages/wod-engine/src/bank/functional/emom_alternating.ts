import type { Skeleton } from '../../types';

const pair: Skeleton['slots'] = [
  { pick: { family: ['barbell', 'dumbbell', 'kettlebell'] }, qty: 'range' },
  { pick: { family: ['gym', 'bodyweight', 'erg'], pattern_not_of_slot: 0 }, qty: 'range' },
];
const triplet: Skeleton['slots'] = [
  { pick: { family: ['barbell', 'dumbbell', 'kettlebell'] }, qty: 'range' },
  { pick: { family: ['gym'] }, qty: 'range' },
  { pick: { family: ['erg', 'bodyweight', 'jump_rope'], pattern_not_of_slot: 1 }, qty: 'range' },
];
const five: Skeleton['slots'] = [
  ...triplet,
  { pick: { family: ['bodyweight', 'box'], pattern_not_of_slot: 1 }, qty: 'range' },
  { pick: { family: ['erg', 'jump_rope'], pattern_not_of_slot: 3 }, qty: 'range' },
];

export const emom_alternating: Skeleton = {
  id: 'emom_alternating',
  discipline: 'functional',
  format: 'emom',
  duration_range: [10, 20],
  durations: [12, 15, 20],
  intentions: ['mixed', 'gym', 'force'],
  band_by_intention: { mixed: 'medium', gym: 'light', force: 'heavy' },
  rest: { every_s: 60 },
  station_count: { by_duration: { 12: 3, 15: 3, 20: 4 } },
  slots: [
    { pick: { family: ['barbell'] }, qty: 'range' },
    { pick: { family: ['gym'] }, qty: 'range' },
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'range' },
    { pick: { family: ['bodyweight', 'jump_rope'] }, qty: 'range', optional: true },
  ],
  variants: [
    { id: 'EMOM-five', slots: five, rest: { every_s: 60 }, duration_range: [10, 20] },
    { id: 'E2MOM-triplet', slots: triplet, rest: { every_s: 120 }, duration_range: [12, 20] },
    { id: 'E3MOM-pair', slots: pair, rest: { every_s: 180 }, duration_range: [15, 20] },
  ],
  score_type: 'reps_total',
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 7, note: 'Garder au moins un tiers de chaque intervalle pour récupérer.' },
};
