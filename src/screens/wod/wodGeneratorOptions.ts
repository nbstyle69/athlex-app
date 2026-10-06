/**
 * Options du « Générateur de WOD » (brief §8) : constantes et helpers purs,
 * séparés de l'écran pour être testables sans React Native.
 */
import { afterClassFilter } from '../../../packages/wod-engine/src';
import type { Catalog, Discipline, Entry, Family, FormatChoice, Intention, Pattern, Vest } from '../../../packages/wod-engine/src';
import i18n from '../../i18n';

export const HYBRID_ORANGE = '#F97316';

export const DURATIONS: Record<Entry, Record<Discipline, number[]>> = {
  express: { functional: [8, 12, 15, 20, 30], hybrid: [15, 20, 30, 45] },
  after_class: { functional: [10, 15, 20], hybrid: [10, 15, 20] },
};

// Libellés : clés i18n, traduites au rendu (`t(labelKey)`) ; `key` est la valeur envoyée au moteur.
export const FORMATS: { key: FormatChoice; labelKey: string }[] = [
  { key: 'surprise', labelKey: 'wodGen.format.surprise' }, { key: 'amrap', labelKey: 'wodGen.format.amrap' }, { key: 'for_time', labelKey: 'wodGen.format.for_time' },
  { key: 'emom', labelKey: 'wodGen.format.emom' }, { key: 'chipper', labelKey: 'wodGen.format.chipper' }, { key: 'stations', labelKey: 'wodGen.format.stations' },
  { key: 'interval', labelKey: 'wodGen.format.interval' },
];

export const INTENTIONS: Record<Discipline, { key: Intention; labelKey: string }[]> = {
  functional: [
    { key: 'mixed', labelKey: 'wodGenerator.intentOpt.mixed' }, { key: 'cardio', labelKey: 'wodGenerator.intentOpt.cardio' },
    { key: 'force', labelKey: 'wodGenerator.intentOpt.strength' }, { key: 'gym', labelKey: 'wodGenerator.intentOpt.gymnastics' },
  ],
  hybrid: [
    { key: 'interval', labelKey: 'wodGen.intention.interval' }, { key: 'engine', labelKey: 'wodGen.intention.engine' }, { key: 'aerobic', labelKey: 'wodGen.intention.aerobic' },
    { key: 'run', labelKey: 'wodGen.intention.run' }, { key: 'core', labelKey: 'wodGen.intention.core' },
  ],
};

export const VESTS: { key: Vest; labelKey: string }[] = [
  { key: 'none', labelKey: 'wodGen.vest.none' }, { key: 'required', labelKey: 'wodGen.vest.required' }, { key: 'optional', labelKey: 'wodGenerator.vestOpt.optional' },
];

/** Libellé d'un pattern de mouvement (`wodGen.pattern.<clé>`), traduit à l'appel. */
export const patternLabel = (p: Pattern): string => i18n.t(`wodGen.pattern.${p}`);

/** Libellé d'une famille de matériel (`wodGen.family.<clé>`), traduit à l'appel. */
export const familyLabel = (f: Family): string => i18n.t(`wodGen.family.${f}`);

/** « Patterns évités : squat, fente · barre » — ce que le complément écartera. */
export function avoidedText(catalog: Catalog, dayMovements: string[]): string {
  const f = afterClassFilter(catalog, dayMovements);
  const patterns = [...f.patterns].map(patternLabel);
  const families = [...f.families].map(familyLabel);
  if (!patterns.length && !families.length) return i18n.t('wodGen.noPattern');
  return i18n.t('wodGen.avoided', { list: [patterns.join(', '), families.join(', ')].filter(Boolean).join(' · ') });
}

/** Matériel proposé dans « Exclure » : union du champ `equipment` des mouvements actifs. */
export function equipmentOptions(catalog: Catalog): string[] {
  const set = new Set<string>();
  for (const m of catalog.movements) if (m.active && (m.weight_functional > 0 || m.weight_hybrid > 0)) m.equipment.forEach((e) => set.add(e));
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Première durée valide quand entrée ou discipline change. */
export function coerceDuration(entry: Entry, discipline: Discipline, current: number): number {
  const list = DURATIONS[entry][discipline];
  return list.includes(current) ? current : list[Math.floor(list.length / 2)];
}
