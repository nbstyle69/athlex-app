/**
 * Options de la carte « Musculation » du générateur (PR M2) : constantes et
 * helpers purs, séparés de l'écran pour être testables sans React Native.
 */
import { MUSCU_DURATIONS, OBJECTIVE_LABEL, TARGET_LABEL, muscuLevelFor } from '../../../packages/wod-engine/src';
import type {
  Catalog, Entry, MuscuEquipment, MuscuLevel, MuscuObjective, MuscuTarget, RmReference,
} from '../../../packages/wod-engine/src';
import { readPr } from '../profile/prStorage';

export const MUSCU_BLUE = '#3B82F6';
/**
 * Fond du bouton « Série suivante » (MuscuSessionCard), seul usage : le blanc sur MUSCU_BLUE
 * fait 3,7:1, sous le seuil 4,5 des textes ; sur ce bleu il fait 5,2:1 (src/__tests__/themeContrast).
 */
export const MUSCU_BLUE_DARK = '#2563EB';

export const MUSCU_OBJECTIVES: { key: MuscuObjective; label: string }[] = (
  ['hypertrophie', 'force', 'endurance'] as MuscuObjective[]
).map((key) => ({ key, label: OBJECTIVE_LABEL[key] }));

export const MUSCU_EQUIPMENTS: { key: MuscuEquipment; label: string }[] = [
  { key: 'none', label: 'Sans matériel' }, { key: 'box', label: 'Box' }, { key: 'gym', label: 'Salle' },
];

/** Ordre des cibles selon le genre du profil ; sans genre, Full body en tête. */
export const TARGET_ORDER: Record<'female' | 'male' | 'none', MuscuTarget[]> = {
  female: ['fessiers', 'fessiers_ischios', 'bas', 'full_body', 'tronc', 'haut', 'dos', 'epaules', 'bras', 'pecs', 'push', 'pull', 'jambes'],
  male: ['push', 'pull', 'jambes', 'full_body', 'haut', 'bas', 'tronc', 'dos', 'epaules', 'bras', 'pecs', 'fessiers', 'fessiers_ischios'],
  none: ['full_body', 'haut', 'bas', 'push', 'pull', 'jambes', 'tronc', 'dos', 'epaules', 'bras', 'pecs', 'fessiers', 'fessiers_ischios'],
};

export function targetOrderFor(gender: string | null | undefined): MuscuTarget[] {
  return gender === 'female' ? TARGET_ORDER.female : gender === 'male' ? TARGET_ORDER.male : TARGET_ORDER.none;
}

export function targetLabel(t: MuscuTarget): string {
  return t === 'fessiers_ischios' ? 'Fessiers + ischios' : TARGET_LABEL[t];
}

/** Sous-titre de la ligne Cible : ordre d'après le profil, ou invitation à le renseigner. */
export function targetOrderHint(gender: string | null | undefined): { text: string; link: string } {
  return gender === 'female' || gender === 'male'
    ? { text: 'Ordre d\'après ton profil', link: 'modifier' }
    : { text: 'Renseigne ton profil pour un ordre adapté', link: 'modifier' };
}

/** Durées candidates avant filtrage par `availableDurations` (Tronc : 15 · 20 · 30). */
export function candidateDurations(entry: Entry, target: MuscuTarget): number[] {
  if (target === 'tronc') return [...MUSCU_DURATIONS.tronc];
  return entry === 'after_class' ? [...MUSCU_DURATIONS.after_class] : [...MUSCU_DURATIONS.express];
}

/** Force grisée : Tronc, Après ma classe, sans matériel. */
export function objectiveDisabled(objective: MuscuObjective, entry: Entry, target: MuscuTarget, equipment: MuscuEquipment): boolean {
  if (objective !== 'force') return false;
  return entry === 'after_class' || target === 'tronc' || equipment === 'none';
}

/**
 * Matériel excluable pour la piste choisie : celui des exercices muscu tirés par
 * cette piste (barres, machines, poulies…), les mots-clés poids du corps exceptés.
 */
export function muscuEquipmentOptions(catalog: Catalog, equipment: MuscuEquipment): string[] {
  const set = new Set<string>();
  for (const m of catalog.movements) {
    if (!m.muscu || !m.active) continue;
    const w = equipment === 'none' ? m.muscu.weight_bodyweight : equipment === 'box' ? m.muscu.weight_box : m.muscu.weight_gym;
    if (w <= 0) continue;
    for (const e of m.equipment) if (e && e !== 'none' && e !== 'bodyweight') set.add(e);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
}

export function coerceMuscuDuration(durations: number[], current: number): number {
  if (durations.length === 0) return current;
  if (durations.includes(current)) return current;
  return durations.reduce((best, d) => (Math.abs(d - current) < Math.abs(best - current) ? d : best), durations[0]);
}

export const MUSCU_LEVEL_TEXT: Record<MuscuLevel, string> = { debutant: 'Débutant', inter: 'Intermédiaire', avance: 'Avancé' };

/** « Affiché pour : Intermédiaire · d'après ton profil » / « Débutant · niveau non renseigné ». */
export function muscuDisplayedFor(level: string | null | undefined): { level: MuscuLevel; text: string; link: string } {
  const lv = muscuLevelFor(level);
  return level
    ? { level: lv, text: `Affiché pour : ${MUSCU_LEVEL_TEXT[lv]} · d'après ton profil`, link: 'modifier' }
    : { level: lv, text: `Affiché pour : ${MUSCU_LEVEL_TEXT[lv]} · niveau non renseigné`, link: 'choisir' };
}

/** Libellé de la page Records pour chaque référence 1RM du moteur. */
export const RM_REFERENCE_PR_LABEL: Record<RmReference, string> = {
  back_squat: 'Back Squat', deadlift: 'Deadlift', bench: 'Bench Press', press: 'Strict Press', hip_thrust: 'Hip Thrust',
};

const RM_SHORT: Record<RmReference, string> = { back_squat: 'Squat', deadlift: 'DL', bench: 'Bench', press: 'Press', hip_thrust: 'Hip Thrust' };
const RM_ORDER: RmReference[] = ['back_squat', 'deadlift', 'bench', 'press', 'hip_thrust'];

/** 1RM du profil (`profiles.personal_records`, clés `weightlifting_<Label>`) → références du moteur. */
export function muscuOneRepMax(records: Record<string, unknown> | null | undefined): Partial<Record<RmReference, number>> {
  const out: Partial<Record<RmReference, number>> = {};
  if (!records) return out;
  const strings: Record<string, string> = {};
  for (const [k, v] of Object.entries(records)) if (typeof v === 'string' || typeof v === 'number') strings[k] = String(v);
  for (const ref of RM_ORDER) {
    const raw = readPr(strings, 'weightlifting', RM_REFERENCE_PR_LABEL[ref]);
    const n = raw == null ? NaN : parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(n) && n >= 20 && n <= 400) out[ref] = n;
  }
  return out;
}

/** « Charges d'après tes 1RM : Squat 120 · DL 150 — modifier » ou l'invitation au calculateur. */
export function oneRepMaxLine(rm: Partial<Record<RmReference, number>>): { text: string; link: string; known: boolean } {
  const parts = RM_ORDER.filter((r) => rm[r] != null).map((r) => `${RM_SHORT[r]} ${rm[r]}`);
  return parts.length
    ? { text: `Charges d'après tes 1RM : ${parts.join(' · ')}`, link: 'modifier', known: true }
    : { text: 'Renseigne tes 1RM pour avoir des charges en kg', link: 'calculateur', known: false };
}
