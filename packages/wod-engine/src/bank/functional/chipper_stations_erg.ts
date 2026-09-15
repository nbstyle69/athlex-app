import type { Skeleton } from '../../types';

export const chipper_stations_erg: Skeleton = {
  id: 'chipper_stations_erg',
  discipline: 'functional',
  format: 'chipper',
  durations: [20, 30],
  intentions: ['mixed', 'cardio'],
  band_by_intention: { mixed: 'medium', cardio: 'light' },
  rounds: { min: 1, max: 1 },
  slots: [
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'range' },
    { pick: { family: ['sled', 'carry', 'sandbag'], unit: 'm' }, qty: 'range' },
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'range', role: 'erg différent du (1)' },
    { pick: { family: ['kettlebell', 'dumbbell', 'wallball'] }, qty: 'range' },
    { pick: { family: ['run'], unit: 'm' }, qty: 'range', qty_max: 800 },
    { pick: { family: ['bodyweight', 'gym'], pattern_any: ['core', 'pull_v', 'push_v'] }, qty: 'range' },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: false,
  stimulus: { rpe: 7, note: 'Stations enchaînées, ergs à 85 %.' },
};
