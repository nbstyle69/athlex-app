import type { Skeleton } from '../../types';

export const triplet_amrap_mid: Skeleton = {
  id: 'triplet_amrap_mid',
  discipline: 'functional',
  format: 'amrap',
  duration_range: [12, 20],
  durations: [12, 15, 20],
  intentions: ['mixed', 'cardio', 'gym'],
  band_by_intention: { mixed: 'medium', cardio: 'light', gym: 'light' },
  rounds: 'amrap',
  slots: [
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'range' },
    { pick: { family: ['barbell', 'dumbbell', 'kettlebell', 'wallball'], pattern_any: ['squat', 'hinge', 'push_v'] }, qty: 'range' },
    { pick: { family: ['gym', 'bodyweight', 'jump_rope'], pattern_any: ['pull_v', 'core', 'mono'], pattern_not_of_slot: 1 }, qty: 'range' },
  ],
  score_type: 'rounds_reps',
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 7.5, note: 'Tenable 20 min, transitions rapides.' },
};
