import type { Skeleton } from '../../types';
import { fr } from '../../i18n/fr';

export const amrap_distances: Skeleton = {
  id: 'amrap_distances',
  discipline: 'hybrid',
  format: 'amrap',
  duration_range: [15, 30],
  durations: [15, 20],
  intentions: ['interval', 'engine'],
  band_by_intention: { interval: 'medium', engine: 'light' },
  rounds: 'amrap',
  slots: [
    { pick: { ids: ['run'], unit: 'm' }, qty: 'draw', fixed_range: [200, 400] },
    { pick: { ids: ['sled_push', 'sled_pull'], unit: 'm' }, qty: 'draw', fixed_range: [25, 50] },
    { pick: { ids: ['wall_ball', 'sandbag_lunge'] }, qty: 'range' },
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'draw', fixed_range: [10, 20] },
  ],
  score_type: 'rounds_reps',
  cap_factor: 1.0,
  allow_variant_up: false,
  stimulus: { rpe: 8, note: fr.banque.stimulus.amrap_distances },
};
