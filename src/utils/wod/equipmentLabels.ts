import i18n from '../../i18n';

/**
 * Matériel du catalogue (B3, lot B) : identifiant → clé i18n `equipment.<id>`.
 * La valeur interne reste l'identifiant (`band`, `barbell`…) : c'est lui qui
 * est persisté dans les exclusions et lu par le moteur ; seul l'affichage est
 * traduit, au rendu. Un identifiant inconnu s'affiche tel quel plutôt que de disparaître.
 */
export const EQUIPMENT_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  [
    'ab_machine',
    'ab_wheel',
    'abduction_machine',
    'abmat',
    'band',
    'barbell',
    'bench',
    'bench_decline',
    'bench_incline',
    'bike_erg',
    'box',
    'cable',
    'cable_row',
    'calf_machine',
    'chest_press_machine',
    'dip_machine',
    'dip_station',
    'dumbbell',
    'echo_bike',
    'floor',
    'ghd',
    'hack_squat',
    'hip_thrust_machine',
    'jump_rope',
    'kettlebell',
    'landmine',
    'lat_pulldown',
    'leg_curl',
    'leg_extension',
    'leg_press',
    'pec_deck',
    'preacher_bench',
    'preacher_machine',
    'pull_up_bar',
    'pullover_machine',
    'pvc',
    'rack',
    'rig',
    'rings',
    'rope',
    'rotation_machine',
    'row_machine',
    'rower',
    'sandbag',
    'shoulder_press_machine',
    'shrug_machine',
    'ski_erg',
    'sled',
    'swiss_ball',
    'triceps_machine',
    'wall',
    'wallball',
    'wrist_roller',
  ].map((id) => [id, `equipment.${id}`]),
);

export function equipmentLabel(id: string): string {
  const key = EQUIPMENT_LABEL_KEYS[id];
  return key ? i18n.t(key) : id;
}
