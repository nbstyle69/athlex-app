import type { Skeleton } from '../../types';

export const gym_density: Skeleton = {
  id: 'gym_density',
  discipline: 'functional',
  format: 'emom',
  duration_range: [10, 20],
  durations: [10, 15],
  intentions: ['gym'],
  band_by_intention: { gym: 'light' },
  rest: { every_s: [60, 90] },
  max_station_work_s: 40,
  slots: [
    { pick: { family: ['gym'], pattern_any: ['pull_v', 'push_v'] }, qty: 'range', reps_range: [5, 12] },
    { pick: { ids: ['hollow_rock', 'ghd_sit_up', 'plank_hold', 'toes_to_bar'], no_shared_high_grip_with: 0 }, qty: 'range' },
  ],
  score_type: 'reps_total',
  cap_factor: 1.0,
  allow_variant_up: true,
  stimulus: { rpe: 6.5, note: 'Technique, aucun échec musculaire.' },
};
