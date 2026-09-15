import type { Skeleton } from '../../types';

export const triplet_rounds_for_time: Skeleton = {
  id: 'triplet_rounds_for_time',
  discipline: 'functional',
  format: 'rounds_for_time',
  durations: [12, 15, 20],
  intentions: ['mixed', 'force'],
  band_by_intention: { mixed: 'medium', force: 'heavy' },
  rounds: { min: 3, max: 5 },
  max_rounds_by_band: { heavy: 4 },
  slots: [
    { pick: { family: ['barbell'], pattern_any: ['hinge', 'squat'] }, qty: 'range' },
    { pick: { family: ['erg', 'box', 'jump_rope'] }, qty: 'range' },
    { pick: { family: ['gym'], pattern_any: ['pull_v', 'push_v'], no_shared_high_grip_with: 0 }, qty: 'range' },
  ],
  score_type: 'time',
  cap_factor: 1.4,
  allow_variant_up: true,
  stimulus: { rpe: 8, note: 'Rounds réguliers, la barre ne se pose pas avant la fin du set.' },
};
