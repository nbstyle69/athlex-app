import type { Skeleton } from '../../types';

export const run_intervals: Skeleton = {
  id: 'run_intervals',
  discipline: 'hybrid',
  format: 'interval',
  duration_range: [10, 20],
  durations: [10, 15, 20],
  intentions: ['run', 'engine'],
  band_by_intention: { run: 'light', engine: 'light' },
  slots: [],
  variants: [
    { id: 'A', slots: [{ pick: { ids: ['run'], unit: 'm' }, qty: 'fixed', fixed: 400 }], rounds: { min: 4, max: 8 }, rest: { rest_s: 60 } },
    { id: 'B', slots: [{ pick: { ids: ['run'], unit: 'm' }, qty: 'fixed', fixed: 800 }], rounds: { min: 2, max: 5 }, rest: { rest_s: 90 } },
    { id: 'C', slots: [{ pick: { ids: ['shuttle_run'], unit: 'm' }, qty: 'fixed', fixed: 200 }], rounds: { min: 6, max: 12 }, rest: { rest_s: 45 } },
  ],
  score_type: 'time',
  cap_factor: 1.0,
  allow_variant_up: false,
  stimulus: { rpe: 8.5, note: 'Allure 5 km ou plus vite, régularité entre répétitions.' },
};
