import type { Skeleton } from '../../types';

export const couplet_amrap_short: Skeleton = {
  id: 'couplet_amrap_short',
  discipline: 'functional',
  format: 'amrap',
  durations: [8, 12],
  intentions: ['mixed', 'cardio', 'gym'],
  band_by_intention: { mixed: 'medium', cardio: 'light', gym: 'light' },
  rounds: 'amrap',
  slots: [
    { pick: { modality: ['W', 'M'], pattern_any: ['squat', 'hinge', 'push_v', 'mono'] }, qty: 'range' },
    { pick: { modality: ['G', 'M'], pattern_not_of_slot: 0 }, qty: 'range' },
  ],
  score_type: 'rounds_reps',
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: 'Allure constante, pas de set cassé avant la mi-temps.' },
};
