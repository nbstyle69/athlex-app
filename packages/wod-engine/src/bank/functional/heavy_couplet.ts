import type { Skeleton } from '../../types';

export const heavy_couplet: Skeleton = {
  id: 'heavy_couplet',
  discipline: 'functional',
  format: 'rounds_for_time',
  duration_range: [8, 15],
  durations: [10, 15],
  intentions: ['force'],
  band_by_intention: { force: 'heavy' },
  rounds: { min: 5, max: 7 },
  slots: [
    { pick: { family: ['barbell'], pattern_any: ['hinge', 'squat', 'push_v'] }, qty: 'range', reps_range: [3, 5] },
    { pick: { modality: ['M'], pattern_any: ['mono'], family: ['erg', 'run', 'jump_rope'] }, qty: 'range' },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: 'Charge lourde, sets non cassés, le mono sert de récupération active.' },
};
