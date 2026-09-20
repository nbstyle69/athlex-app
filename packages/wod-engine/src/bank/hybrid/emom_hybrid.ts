import type { Skeleton } from '../../types';

const slots: Skeleton['slots'] = [
  { pick: { family: ['erg'], unit: 'cal' }, qty: 'range' },
  { pick: { ids: ['run'], unit: 'm' }, qty: 'range', reps_range: [100, 300] },
  {
    pick: { ids: ['sled_push', 'sled_pull', 'sandbag_lunge', 'sandbag_carry', 'kb_swing_russian', 'wall_ball', 'db_farmer_carry'] },
    qty: 'range',
  },
];

export const emom_hybrid: Skeleton = {
  id: 'emom_hybrid',
  discipline: 'hybrid',
  format: 'emom',
  duration_range: [12, 20],
  durations: [12, 15, 18, 20],
  intentions: ['interval', 'engine', 'aerobic', 'run'],
  band_by_intention: { interval: 'medium', engine: 'light', aerobic: 'light', run: 'light' },
  slots,
  variants: [
    { id: 'EMOM', slots, rest: { every_s: 60 } },
    { id: 'E2MOM', slots, rest: { every_s: 120 } },
    { id: 'E3MOM', slots, rest: { every_s: 180 } },
  ],
  score_type: 'reps_total',
  cap_factor: 1,
  allow_variant_up: false,
  stimulus: { rpe: 7, note: 'Erg, course et charge en alternance ; garder un tiers de chaque départ pour récupérer.' },
};
