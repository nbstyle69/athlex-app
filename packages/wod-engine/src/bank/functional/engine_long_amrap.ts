import type { Skeleton } from '../../types';

export const engine_long_amrap: Skeleton = {
  id: 'engine_long_amrap',
  discipline: 'functional',
  format: 'amrap',
  duration_range: [12, 20],
  durations: [20, 30],
  intentions: ['cardio'],
  band_by_intention: { cardio: 'light' },
  rounds: 'amrap',
  slots: [
    { pick: { family: ['erg', 'run'] }, qty: 'range' },
    { pick: { family: ['bodyweight', 'gym'], pattern_any: ['mono', 'core', 'pull_v', 'push_v'] }, qty: 'range' },
    { pick: { family: ['kettlebell', 'wallball', 'dumbbell'], band: 'light' }, qty: 'range' },
    { pick: { family: ['erg', 'run'] }, qty: 'range', role: 'erg différent du (1) ou run' },
  ],
  score_type: 'rounds_reps',
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 6.5, note: 'Zone 3, respiration contrôlée du début à la fin.' },
};
