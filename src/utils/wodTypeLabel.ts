import i18n from '../i18n';

const WOD_TYPE_KEYS: Record<string, string> = {
  'for-time': 'forTime',
  for_time: 'forTime',
  fortime: 'forTime',
  amrap: 'amrap',
  emom: 'emom',
  tabata: 'tabata',
  strength: 'strength',
  custom: 'custom',
};

/** Libellé traduit d'un type de séance (`wod_type`) ; type inconnu affiché tel quel. */
export function wodTypeLabel(type: string | null | undefined, fallback = 'WOD'): string {
  if (!type) return fallback;
  const key = WOD_TYPE_KEYS[type.trim().toLowerCase()];
  return key ? i18n.t(`wodTypes.${key}`) : type;
}
