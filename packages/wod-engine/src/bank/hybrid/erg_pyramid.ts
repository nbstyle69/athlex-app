import type { Skeleton } from '../../types';

export const erg_pyramid: Skeleton = {
  id: 'erg_pyramid',
  discipline: 'hybrid',
  format: 'for_time',
  duration_range: [8, 15],
  durations: [20, 30],
  intentions: ['engine', 'aerobic'],
  band_by_intention: { engine: 'light', aerobic: 'light' },
  scheme: [250, 500, 750, 500, 250],
  rounds: 'scheme',
  slots: [
    { pick: { ids: ['row', 'ski_erg', 'bike_erg'], unit: 'm' }, qty: 'scheme' },
    { pick: { ids: ['sandbag_lunge', 'walking_lunge', 'db_farmer_carry', 'burpee_broad_jump'] }, qty: 'fixed', fixed_by_id: { sandbag_lunge: 20, walking_lunge: 20, db_farmer_carry: 50, burpee_broad_jump: 10 }, role: 'entre chaque palier' },
  ],
  score_type: 'time',
  cap_factor: 1.25,
  allow_variant_up: false,
  stimulus: { rpe: 7, note: 'Pyramide à allure régulière, la station courte relance sans casser le rythme.' },
};
