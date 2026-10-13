import type { Skeleton } from '../../types';
import { fr } from '../../i18n/fr';

export const tabata_pair: Skeleton = {
  id: 'tabata_pair',
  discipline: 'functional',
  format: 'tabata',
  duration_range: [8, 10],
  durations: [8, 10],
  intentions: ['cardio', 'gym'],
  band_by_intention: { cardio: 'light', gym: 'light' },
  rest: { work_s: 20, rest_s: 10 },
  rounds: { min: 8, max: 8 },
  slots: [
    { pick: { family: ['bodyweight', 'erg'] }, qty: 'range' },
    { pick: { family: ['bodyweight', 'gym'], pattern_not_of_slot: 0 }, qty: 'range' },
  ],
  score_type: 'reps_total',
  cap_factor: 1.0,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: fr.banque.stimulus.tabata_pair },
};
