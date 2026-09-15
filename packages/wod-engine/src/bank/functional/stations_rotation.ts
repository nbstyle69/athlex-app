import type { Skeleton } from '../../types';

export const stations_rotation: Skeleton = {
  id: 'stations_rotation',
  discipline: 'functional',
  format: 'stations',
  durations: [20, 30],
  intentions: ['mixed', 'cardio'],
  band_by_intention: { mixed: 'medium', cardio: 'light' },
  rest: { work_s: [60, 90], rest_s: [15, 30] },
  rounds: { min: 2, max: 4 },
  station_count: { min: 4, max: 5 },
  no_consecutive_erg: true,
  slots: [
    { pick: { family: ['erg', 'run'] }, qty: 'range' },
    { pick: { family: ['kettlebell', 'dumbbell', 'wallball', 'sandbag', 'sled', 'box'] }, qty: 'range' },
    { pick: { family: ['erg', 'run'] }, qty: 'range', role: 'erg différent du (1)' },
    { pick: { family: ['kettlebell', 'dumbbell', 'wallball', 'sandbag', 'sled', 'box'], pattern_not_of_slot: 1 }, qty: 'range' },
    { pick: { family: ['kettlebell', 'dumbbell', 'wallball', 'sandbag', 'sled', 'box', 'bodyweight'], pattern_not_of_slot: 3 }, qty: 'range', optional: true },
  ],
  score_type: 'reps_total',
  cap_factor: 1.0,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: 'Max effort sur chaque station, repos incomplet voulu.' },
};
