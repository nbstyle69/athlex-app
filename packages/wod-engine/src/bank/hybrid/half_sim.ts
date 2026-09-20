import type { Skeleton } from '../../types';

export const half_sim: Skeleton = {
  id: 'half_sim',
  discipline: 'hybrid',
  format: 'rounds_for_time',
  duration_range: [18, 22],
  // bank-v1 annonce 45' ; avec les cadences du catalogue 4 × (500 m + station) ≈ 16' RX → recalé sur 15/20.
  durations: [15, 20],
  intentions: ['interval'],
  band_by_intention: { interval: 'medium' },
  rounds: { min: 4, max: 4 },
  slots: [],
  variants: [
    {
      id: 'A',
      slots: [
        { pick: { ids: ['run'], unit: 'm' }, qty: 'draw', fixed_range: [500, 800] },
        {
          pick: { ids: ['ski_erg', 'sled_push', 'sled_pull', 'burpee_broad_jump'], erg_unit: 'm' }, qty: 'fixed',
          fixed_by_id: { ski_erg: 500, sled_push: 25, sled_pull: 25, burpee_broad_jump: 40 }, rotate_per_round: true,
          role: 'une station différente par round',
        },
      ],
    },
    {
      id: 'B',
      slots: [
        { pick: { ids: ['run'], unit: 'm' }, qty: 'draw', fixed_range: [500, 800] },
        {
          pick: { ids: ['row', 'db_farmer_carry', 'sandbag_lunge', 'wall_ball'], erg_unit: 'm' }, qty: 'fixed',
          fixed_by_id: { row: 500, db_farmer_carry: 100, sandbag_lunge: 50, wall_ball: 50 }, rotate_per_round: true,
          role: 'une station différente par round',
        },
      ],
    },
  ],
  score_type: 'time',
  cap_factor: 1.2,
  allow_variant_up: false,
  stimulus: { rpe: 9, note: 'Demi-course, gérer comme un jour de compétition.' },
};
