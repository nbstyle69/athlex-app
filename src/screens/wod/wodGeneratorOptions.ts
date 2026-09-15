/**
 * Options du « Générateur de WOD » (brief §8) : constantes et helpers purs,
 * séparés de l'écran pour être testables sans React Native.
 */
import { afterClassFilter } from '../../../packages/wod-engine/src';
import type { Catalog, Discipline, Entry, Family, FormatChoice, Intention, Pattern, Vest } from '../../../packages/wod-engine/src';

export const HYBRID_ORANGE = '#F97316';

export const DURATIONS: Record<Entry, Record<Discipline, number[]>> = {
  express: { functional: [8, 12, 15, 20, 30], hybrid: [15, 20, 30, 45] },
  after_class: { functional: [10, 15, 20], hybrid: [10, 15, 20] },
};

export const FORMATS: { key: FormatChoice; label: string }[] = [
  { key: 'surprise', label: 'Surprends-moi' }, { key: 'amrap', label: 'AMRAP' }, { key: 'for_time', label: 'For time' },
  { key: 'emom', label: 'EMOM' }, { key: 'chipper', label: 'Chipper' }, { key: 'stations', label: 'Stations' },
  { key: 'interval', label: 'Intervalles' },
];

export const INTENTIONS: Record<Discipline, { key: Intention; label: string }[]> = {
  functional: [
    { key: 'mixed', label: 'Mixed' }, { key: 'cardio', label: 'Cardio' }, { key: 'force', label: 'Force' }, { key: 'gym', label: 'Gym' },
  ],
  hybrid: [
    { key: 'interval', label: 'Interval' }, { key: 'engine', label: 'Engine' }, { key: 'aerobic', label: 'Aerobic' },
    { key: 'run', label: 'Run' }, { key: 'core', label: 'Core' },
  ],
};

export const VESTS: { key: Vest; label: string }[] = [
  { key: 'none', label: 'Sans' }, { key: 'required', label: 'Avec' }, { key: 'optional', label: 'Optionnel' },
];

export const PATTERN_LABEL: Record<Pattern, string> = {
  squat: 'squat', hinge: 'hinge', push_v: 'poussée verticale', push_h: 'poussée horizontale',
  pull_v: 'traction verticale', pull_h: 'traction horizontale', carry: 'porté', lunge: 'fente', core: 'core', mono: 'mono',
};

export const FAMILY_LABEL: Record<Family, string> = {
  barbell: 'barre', dumbbell: 'haltères', kettlebell: 'kettlebell', gym: 'gym', bodyweight: 'poids du corps', erg: 'erg',
  run: 'course', sled: 'sled', carry: 'porté', sandbag: 'sandbag', wallball: 'wall ball', jump_rope: 'corde', box: 'box', other: 'autre',
};

/** « Patterns évités : squat, fente · barre » — ce que le complément écartera. */
export function avoidedText(catalog: Catalog, dayMovements: string[]): string {
  const f = afterClassFilter(catalog, dayMovements);
  const patterns = [...f.patterns].map((p) => PATTERN_LABEL[p]);
  const families = [...f.families].map((p) => FAMILY_LABEL[p]);
  if (!patterns.length && !families.length) return 'Aucun pattern reconnu : complément sans filtre.';
  return `Patterns évités : ${[patterns.join(', '), families.join(', ')].filter(Boolean).join(' · ')}`;
}

/** Matériel proposé dans « Exclure » : union du champ `equipment` des mouvements actifs. */
export function equipmentOptions(catalog: Catalog): string[] {
  const set = new Set<string>();
  for (const m of catalog.movements) if (m.active) m.equipment.forEach((e) => set.add(e));
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Première durée valide quand entrée ou discipline change. */
export function coerceDuration(entry: Entry, discipline: Discipline, current: number): number {
  const list = DURATIONS[entry][discipline];
  return list.includes(current) ? current : list[Math.floor(list.length / 2)];
}
