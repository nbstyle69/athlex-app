import type { SkeletonBank } from '../types';
import { couplet_for_time_21_15_9 } from './functional/couplet_for_time_21_15_9';
import { couplet_amrap_short } from './functional/couplet_amrap_short';
import { triplet_amrap_mid } from './functional/triplet_amrap_mid';
import { triplet_rounds_for_time } from './functional/triplet_rounds_for_time';
import { chipper_descending } from './functional/chipper_descending';
import { chipper_stations_erg } from './functional/chipper_stations_erg';
import { emom_alternating } from './functional/emom_alternating';
import { interval_work_rest } from './functional/interval_work_rest';
import { ladder_ascending } from './functional/ladder_ascending';
import { death_by } from './functional/death_by';
import { tabata_pair } from './functional/tabata_pair';
import { heavy_couplet } from './functional/heavy_couplet';
import { engine_long_amrap } from './functional/engine_long_amrap';
import { gym_density } from './functional/gym_density';
import { stations_rotation } from './functional/stations_rotation';
import { run_into_station } from './hybrid/run_into_station';
import { stations_interval } from './hybrid/stations_interval';
import { amrap_distances } from './hybrid/amrap_distances';
import { erg_pyramid } from './hybrid/erg_pyramid';
import { sled_repeats } from './hybrid/sled_repeats';
import { compromised_run } from './hybrid/compromised_run';
import { half_sim } from './hybrid/half_sim';
import { engine_continuous } from './hybrid/engine_continuous';
import { core_carry_finisher } from './hybrid/core_carry_finisher';
import { run_intervals } from './hybrid/run_intervals';

export const BANK_VERSION = 1;

export const FUNCTIONAL_SKELETONS = [
  couplet_for_time_21_15_9, couplet_amrap_short, triplet_amrap_mid, triplet_rounds_for_time, chipper_descending,
  chipper_stations_erg, emom_alternating, interval_work_rest, ladder_ascending, death_by, tabata_pair, heavy_couplet,
  engine_long_amrap, gym_density, stations_rotation,
];

export const HYBRID_SKELETONS = [
  run_into_station, stations_interval, amrap_distances, erg_pyramid, sled_repeats, compromised_run, half_sim,
  engine_continuous, core_carry_finisher, run_intervals,
];

/**
 * Plafond de volume total par mouvement (qty × rounds) — brief §5.4.
 * Vérifié sur la catégorie de référence (rx / men) : les quantités sont
 * communes à toutes les catégories, seules charges et substitutions varient.
 */
const FUNCTIONAL_CAPS = {
  scaled: { reps: 60, cal: 60, m: 2000, s: 240 },
  inter: { reps: 80, cal: 80, m: 2500, s: 300 },
  rx: { reps: 100, cal: 100, m: 3000, s: 360 },
  rxplus: { reps: 120, cal: 120, m: 3500, s: 420 },
  elite: { reps: 150, cal: 150, m: 4000, s: 480 },
  pro: { reps: 150, cal: 150, m: 4000, s: 480 },
};
const HYBRID_CAPS = {
  women: { reps: 100, cal: 100, m: 6000, s: 360 },
  men: { reps: 100, cal: 100, m: 6000, s: 360 },
  women_pro: { reps: 120, cal: 120, m: 7000, s: 420 },
  men_pro: { reps: 120, cal: 120, m: 7000, s: 420 },
};

export const BANK_V1: SkeletonBank = {
  version: BANK_VERSION,
  skeletons: [...FUNCTIONAL_SKELETONS, ...HYBRID_SKELETONS],
  volume_caps: { functional: FUNCTIONAL_CAPS, hybrid: HYBRID_CAPS },
};
