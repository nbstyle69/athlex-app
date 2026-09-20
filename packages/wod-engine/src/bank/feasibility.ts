// GÉNÉRÉ par scripts/feasibility.mjs — ne pas éditer. 25 seeds par combinaison.
// 63 combinaisons déclarées, 0 jamais servies.
import type { Discipline, Intention, SkeletonFormat } from '../types';

export interface FeasibilityRow {
  id: string;
  discipline: Discipline;
  format: SkeletonFormat;
  intention: Intention;
  /** au moins un tirage sur 25 aboutit, ce squelette seul autorisé */
  feasible: boolean;
}

export const FEASIBILITY: readonly FeasibilityRow[] = [
  { id: 'couplet_for_time_21_15_9', discipline: 'functional', format: 'for_time', intention: 'mixed', feasible: true },
  { id: 'couplet_for_time_21_15_9', discipline: 'functional', format: 'for_time', intention: 'gym', feasible: true },
  { id: 'couplet_for_time_21_15_9', discipline: 'functional', format: 'for_time', intention: 'force', feasible: true },
  { id: 'triplet_for_time_classics', discipline: 'functional', format: 'for_time', intention: 'mixed', feasible: true },
  { id: 'triplet_for_time_classics', discipline: 'functional', format: 'for_time', intention: 'gym', feasible: true },
  { id: 'triplet_for_time_classics', discipline: 'functional', format: 'for_time', intention: 'force', feasible: true },
  { id: 'couplet_amrap_short', discipline: 'functional', format: 'amrap', intention: 'mixed', feasible: true },
  { id: 'couplet_amrap_short', discipline: 'functional', format: 'amrap', intention: 'cardio', feasible: true },
  { id: 'couplet_amrap_short', discipline: 'functional', format: 'amrap', intention: 'gym', feasible: true },
  { id: 'triplet_amrap_mid', discipline: 'functional', format: 'amrap', intention: 'mixed', feasible: true },
  { id: 'triplet_amrap_mid', discipline: 'functional', format: 'amrap', intention: 'cardio', feasible: true },
  { id: 'triplet_amrap_mid', discipline: 'functional', format: 'amrap', intention: 'gym', feasible: true },
  { id: 'triplet_rounds_for_time', discipline: 'functional', format: 'rounds_for_time', intention: 'mixed', feasible: true },
  { id: 'triplet_rounds_for_time', discipline: 'functional', format: 'rounds_for_time', intention: 'force', feasible: true },
  { id: 'chipper_descending', discipline: 'functional', format: 'chipper', intention: 'mixed', feasible: true },
  { id: 'chipper_descending', discipline: 'functional', format: 'chipper', intention: 'cardio', feasible: true },
  { id: 'chipper_stations_erg', discipline: 'functional', format: 'chipper', intention: 'mixed', feasible: true },
  { id: 'chipper_stations_erg', discipline: 'functional', format: 'chipper', intention: 'cardio', feasible: true },
  { id: 'emom_alternating', discipline: 'functional', format: 'emom', intention: 'mixed', feasible: true },
  { id: 'emom_alternating', discipline: 'functional', format: 'emom', intention: 'gym', feasible: true },
  { id: 'emom_alternating', discipline: 'functional', format: 'emom', intention: 'force', feasible: true },
  { id: 'interval_work_rest', discipline: 'functional', format: 'interval', intention: 'mixed', feasible: true },
  { id: 'interval_work_rest', discipline: 'functional', format: 'interval', intention: 'cardio', feasible: true },
  { id: 'interval_work_rest', discipline: 'functional', format: 'interval', intention: 'force', feasible: true },
  { id: 'ladder_ascending', discipline: 'functional', format: 'ladder', intention: 'mixed', feasible: true },
  { id: 'ladder_ascending', discipline: 'functional', format: 'ladder', intention: 'gym', feasible: true },
  { id: 'ladder_finite', discipline: 'functional', format: 'ladder', intention: 'mixed', feasible: true },
  { id: 'ladder_finite', discipline: 'functional', format: 'ladder', intention: 'gym', feasible: true },
  { id: 'death_by', discipline: 'functional', format: 'death_by', intention: 'mixed', feasible: true },
  { id: 'death_by', discipline: 'functional', format: 'death_by', intention: 'force', feasible: true },
  { id: 'tabata_pair', discipline: 'functional', format: 'tabata', intention: 'cardio', feasible: true },
  { id: 'tabata_pair', discipline: 'functional', format: 'tabata', intention: 'gym', feasible: true },
  { id: 'heavy_couplet', discipline: 'functional', format: 'rounds_for_time', intention: 'force', feasible: true },
  { id: 'engine_long_amrap', discipline: 'functional', format: 'amrap', intention: 'cardio', feasible: true },
  { id: 'gym_density', discipline: 'functional', format: 'emom', intention: 'gym', feasible: true },
  { id: 'stations_rotation', discipline: 'functional', format: 'stations', intention: 'mixed', feasible: true },
  { id: 'stations_rotation', discipline: 'functional', format: 'stations', intention: 'cardio', feasible: true },
  { id: 'run_into_station', discipline: 'hybrid', format: 'rounds_for_time', intention: 'interval', feasible: true },
  { id: 'run_into_station', discipline: 'hybrid', format: 'rounds_for_time', intention: 'engine', feasible: true },
  { id: 'run_into_station', discipline: 'hybrid', format: 'rounds_for_time', intention: 'run', feasible: true },
  { id: 'stations_interval', discipline: 'hybrid', format: 'stations', intention: 'interval', feasible: true },
  { id: 'amrap_distances', discipline: 'hybrid', format: 'amrap', intention: 'interval', feasible: true },
  { id: 'amrap_distances', discipline: 'hybrid', format: 'amrap', intention: 'engine', feasible: true },
  { id: 'erg_pyramid', discipline: 'hybrid', format: 'for_time', intention: 'engine', feasible: true },
  { id: 'erg_pyramid', discipline: 'hybrid', format: 'for_time', intention: 'aerobic', feasible: true },
  { id: 'sled_repeats', discipline: 'hybrid', format: 'interval', intention: 'force', feasible: true },
  { id: 'sled_repeats', discipline: 'hybrid', format: 'interval', intention: 'interval', feasible: true },
  { id: 'compromised_run', discipline: 'hybrid', format: 'rounds_for_time', intention: 'interval', feasible: true },
  { id: 'compromised_run', discipline: 'hybrid', format: 'rounds_for_time', intention: 'run', feasible: true },
  { id: 'half_sim', discipline: 'hybrid', format: 'rounds_for_time', intention: 'interval', feasible: true },
  { id: 'engine_continuous', discipline: 'hybrid', format: 'continuous', intention: 'aerobic', feasible: true },
  { id: 'core_carry_finisher', discipline: 'hybrid', format: 'rounds_for_time', intention: 'core', feasible: true },
  { id: 'run_intervals', discipline: 'hybrid', format: 'interval', intention: 'run', feasible: true },
  { id: 'run_intervals', discipline: 'hybrid', format: 'interval', intention: 'engine', feasible: true },
  { id: 'engine_negative_split', discipline: 'hybrid', format: 'continuous', intention: 'aerobic', feasible: true },
  { id: 'emom_hybrid', discipline: 'hybrid', format: 'emom', intention: 'interval', feasible: true },
  { id: 'emom_hybrid', discipline: 'hybrid', format: 'emom', intention: 'engine', feasible: true },
  { id: 'emom_hybrid', discipline: 'hybrid', format: 'emom', intention: 'aerobic', feasible: true },
  { id: 'emom_hybrid', discipline: 'hybrid', format: 'emom', intention: 'run', feasible: true },
  { id: 'chipper_hybrid', discipline: 'hybrid', format: 'chipper', intention: 'interval', feasible: true },
  { id: 'chipper_hybrid', discipline: 'hybrid', format: 'chipper', intention: 'engine', feasible: true },
  { id: 'chipper_hybrid', discipline: 'hybrid', format: 'chipper', intention: 'aerobic', feasible: true },
  { id: 'chipper_hybrid', discipline: 'hybrid', format: 'chipper', intention: 'run', feasible: true },
];
