// Mouvements de l'ancien MOVEMENT_CATALOG absents de catalogue-v1.csv.
// Ils entrent dans movement_catalog avec active = false : présents pour les
// badges et le back-office, jamais tirés par le générateur (poids 0).
// Champs : [id, name, family, pattern[], modality, grip, shoulder_load, unit_default, load_unit]
module.exports = [
  ['back_rack_split_jerk', 'Back Rack Split Jerk', 'barbell', ['push_v'], 'W', 'low', 'high', 'reps', 'kg'],
  ['clean_pull',           'Clean Pull',           'barbell', ['hinge'],  'W', 'high', 'low', 'reps', 'kg'],
  ['db_deadlift',          'DB Deadlift',          'dumbbell', ['hinge'], 'W', 'high', 'none', 'reps', 'kg'],
  ['db_push_press',        'DB Push Press',        'dumbbell', ['push_v'], 'W', 'low', 'high', 'reps', 'kg'],
  ['db_strict_press',      'DB Strict Press',      'dumbbell', ['push_v'], 'W', 'low', 'high', 'reps', 'kg'],
  ['power_jerk',           'Power Jerk',           'barbell', ['push_v'], 'W', 'low', 'high', 'reps', 'kg'],
  ['snatch_balance',       'Snatch Balance',       'barbell', ['squat', 'push_v'], 'W', 'low', 'high', 'reps', 'kg'],
  ['snatch_high_pull',     'Snatch High Pull',     'barbell', ['hinge', 'pull_v'], 'W', 'high', 'low', 'reps', 'kg'],
  ['split_jerk',           'Split Jerk',           'barbell', ['push_v'], 'W', 'low', 'high', 'reps', 'kg'],
  ['squat_clean_and_jerk', 'Squat Clean & Jerk',   'barbell', ['squat', 'hinge', 'push_v'], 'W', 'high', 'high', 'reps', 'kg'],
  ['strict_press',         'Strict Press',         'barbell', ['push_v'], 'W', 'low', 'high', 'reps', 'kg'],
  ['tall_clean',           'Tall Clean',           'barbell', ['squat'],  'W', 'high', 'low', 'reps', 'kg'],
  ['v_ups',                'V-ups',                'bodyweight', ['core'], 'G', 'none', 'none', 'reps', null],
  ['zercher_squat',        'Zercher Squat',        'barbell', ['squat'],  'W', 'low', 'low', 'reps', 'kg'],
];
