import type { Skeleton } from '../../types';

export const core_carry_finisher: Skeleton = {
  id: 'core_carry_finisher',
  discipline: 'hybrid',
  format: 'rounds_for_time',
  durations: [10, 15, 20],
  intentions: ['core'],
  band_by_intention: { core: 'light' },
  rounds: { min: 3, max: 6 },
  slots: [
    { pick: { ids: ['db_farmer_carry', 'sandbag_carry'], unit: 'm' }, qty: 'fixed', fixed_range: [50, 100] },
    { pick: { ids: ['hollow_rock', 'plank_hold', 'sit_up', 'ghd_sit_up'] }, qty: 'range' },
    {
      pick: { family: ['erg', 'run'], pattern_any: ['mono'], erg_unit: 'cal' },
      qty: 'fixed',
      fixed: 10,
      fixed_by_id: { run: 100, shuttle_run: 100 },
      optional: true,
      role: 'mono léger',
    },
  ],
  score_type: 'time',
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 6, note: "Posture et gainage, jamais à l'échec." },
};
