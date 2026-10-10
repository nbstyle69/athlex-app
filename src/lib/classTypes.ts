import i18n from '../i18n';

/**
 * Types de cours proposés au gérant. La clé est la valeur enregistrée telle
 * quelle comme titre du cours (class_schedules.title) : elle ne change jamais,
 * pour que les cours existants restent reconnus ; seul le libellé affiché est
 * traduit.
 */
export const CLASS_TYPE_KEYS: Record<string, string> = {
  WOD: 'bo.schedule.classTypes.wod',
  // i18n-ignore : valeur enregistrée en base (titre du cours), affichée par sa clé
  'Haltérophilie': 'bo.schedule.classTypes.weightlifting',
  Cardio: 'bo.schedule.classTypes.cardio',
  'Open Gym': 'bo.schedule.classTypes.openGym',
  Strength: 'bo.schedule.classTypes.strength',
  Mobility: 'bo.schedule.classTypes.mobility',
  Kids: 'bo.schedule.classTypes.kids',
  Teens: 'bo.schedule.classTypes.teens',
  // i18n-ignore : valeur sentinelle « autre » (titre personnalisé), affichée par sa clé
  Autre: 'bo.schedule.classTypes.other',
};

export const CLASS_TYPES = Object.keys(CLASS_TYPE_KEYS);

// i18n-ignore : valeur sentinelle du type « autre », jamais affichée telle quelle
export const OTHER_CLASS_TYPE = 'Autre';

/** Libellé affiché d'un titre de cours : traduit si c'est un type proposé, sinon le titre saisi tel quel. */
export function classTitleLabel(title: string): string {
  const key = CLASS_TYPE_KEYS[title];
  return key ? i18n.t(key) : title;
}
