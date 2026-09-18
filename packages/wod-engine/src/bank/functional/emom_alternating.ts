import type { Skeleton } from '../../types';

export const emom_alternating: Skeleton = {
  id: 'emom_alternating',
  discipline: 'functional',
  format: 'emom',
  durations: [12, 15, 20],
  intentions: ['mixed', 'gym', 'force'],
  band_by_intention: { mixed: 'medium', gym: 'light', force: 'heavy' },
  rest: { every_s: 60 },
  station_count: { by_duration: { 12: 3, 15: 3, 20: 4 } },
  max_station_work_s: 40,
  slots: [
    { pick: { family: ['barbell'] }, qty: 'range' },
    { pick: { family: ['gym'] }, qty: 'range' },
    { pick: { family: ['erg'], unit: 'cal' }, qty: 'range' },
    { pick: { family: ['bodyweight', 'jump_rope'] }, qty: 'range', optional: true },
  ],
  score_type: 'reps_total',
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 7, note: 'Chaque station ≤ 40 s de travail, le repos est la consigne.' },
};
