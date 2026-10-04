/**
 * B8 (lot B) — section Gymnastique, sur le modèle de la table des barres :
 * le record est en reps, les paliers vont de 10 % en 10 % jusqu'à 150 %.
 * Zones proposées : volume facile (échauffement, EMOM long), volume de travail
 * (séries répétées dans un WOD), série limite (proche du max), le record, et
 * au-delà — un objectif ou un volume cumulé sur plusieurs séries.
 */
export const GYM_PR_MOVEMENTS = [
  'Toes To Bar', 'Pull-ups', 'Chest To Bar', 'Hand Stand Push Up', 'Strict Hand Stand Push Up', 'Wall Facing Hand Stand Push Up',
  'Ring Muscle-up', 'Bar Muscle-up', 'Dips', 'Strict Dips', 'Pull Over',
] as const;

export const GYM_ZONES: Array<{ pct: number; zone: string; usage: string; color: string; bg: string }> = [
  { pct: 10,  zone: 'Volume facile',     usage: 'Échauffement',             color: '#60A5FA', bg: '#1E3A5F' },
  { pct: 20,  zone: 'Volume facile',     usage: 'EMOM long',                color: '#60A5FA', bg: '#1E3A5F' },
  { pct: 30,  zone: 'Volume facile',     usage: 'Séries en AMRAP',          color: '#60A5FA', bg: '#1E3A5F' },
  { pct: 40,  zone: 'Volume facile',     usage: 'Séries tenues au chrono',  color: '#4ADE80', bg: '#1C2023' },
  { pct: 50,  zone: 'Volume de travail', usage: 'Série type de WOD',        color: '#4ADE80', bg: '#1C2023' },
  { pct: 60,  zone: 'Volume de travail', usage: 'Plafond par WOD',          color: '#4ADE80', bg: '#1C2023' },
  { pct: 70,  zone: 'Volume de travail', usage: 'Grosse série, 1 à 2 fois', color: '#FBBF24', bg: '#3D2E0F' },
  { pct: 80,  zone: 'Série limite',      usage: 'Proche du max',            color: '#F97316', bg: '#3D1A0A' },
  { pct: 90,  zone: 'Série limite',      usage: 'Test en forme',            color: '#F97316', bg: '#3D1A0A' },
  { pct: 100, zone: 'Record',            usage: 'Max unbroken',             color: '#EF4444', bg: '#3D0F0F' },
  { pct: 110, zone: 'Au-delà du record', usage: 'Objectif',                 color: '#A855F7', bg: '#2E1048' },
  { pct: 120, zone: 'Au-delà du record', usage: 'Objectif',                 color: '#A855F7', bg: '#2E1048' },
  { pct: 130, zone: 'Au-delà du record', usage: 'Cumulé en 2 séries',       color: '#EC4899', bg: '#3D0A24' },
  { pct: 140, zone: 'Au-delà du record', usage: 'Cumulé en 2 séries',       color: '#EC4899', bg: '#3D0A24' },
  { pct: 150, zone: 'Au-delà du record', usage: 'Cumulé en 3 séries',       color: '#EC4899', bg: '#3D0A24' },
];

/** Reps au palier, arrondies à l'entier (record 50 → 50 % = 25, 150 % = 75). */
export function gymRepsAt(record: number, pct: number): number {
  return Math.round(record * pct / 100);
}

export type GymPrMovement = (typeof GYM_PR_MOVEMENTS)[number];

/**
 * Clé de rapprochement d'un nom de mouvement : casse, tirets, espaces et pluriel
 * ne comptent pas (« Ring Muscle-ups » = « Ring Muscle-up », « Toes-to-bar » =
 * « Toes To Bar »). Les mots ne sont jamais retirés : « Strict Pull-Ups » reste
 * distinct de « Pull-ups ».
 */
export function movementMatchKey(name: string): string {
  return name.toLowerCase().split(/[\s_-]+/).filter(Boolean).map(w => w.replace(/s$/, '')).join('');
}

/**
 * Abréviations rapprochées : seulement celles qui désignent un seul des 11
 * libellés. « HSPU » (kipping, strict ou face au mur ?) et « MU » (anneaux ou
 * barre ?) n'y sont pas : en cas de doute, aucun rapprochement.
 */
const GYM_ABBREVIATIONS: Record<string, GymPrMovement> = {
  t2b: 'Toes To Bar',
  ttb: 'Toes To Bar',
  c2b: 'Chest To Bar',
  ctb: 'Chest To Bar',
  rmu: 'Ring Muscle-up',
  bmu: 'Bar Muscle-up',
  stricthspu: 'Strict Hand Stand Push Up',
  wallfacinghspu: 'Wall Facing Hand Stand Push Up',
};

const GYM_BY_KEY: ReadonlyMap<string, GymPrMovement> = new Map<string, GymPrMovement>([
  ...GYM_PR_MOVEMENTS.map(m => [movementMatchKey(m), m] as [string, GymPrMovement]),
  ...Object.entries(GYM_ABBREVIATIONS),
]);

/** Libellé de la page Records (section Gymnastique) d'un nom de mouvement, sinon `null`. */
export function gymPrLabel(name: string): GymPrMovement | null {
  return GYM_BY_KEY.get(movementMatchKey(name ?? '')) ?? null;
}

/** Reps d'un % du record : arrondies, jamais moins d'une ; `null` sans record. */
export function gymRepsForPct(record: number | null | undefined, pct: number): number | null {
  if (record == null || !Number.isFinite(record) || record <= 0) return null;
  return Math.max(1, gymRepsAt(record, pct));
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const PCT = /(\d+(?:[.,]\d+)?)\s*%(\s*du\s+max\b)?/gi;
/** Mots qui peuvent précéder le mouvement sans le modifier (« 60 % du max de T2B »). */
const LINKING_WORDS = new Set(['de', 'du', 'des', 'd', 'of', 'the', 'max', 'en', 'x']);
const MAX_WORDS = 6;

/**
 * « (≈ N reps) » d'une ligne de texte de WOD qui porte un % du max d'un
 * mouvement de gymnastique, ou `null` s'il n'y a rien à ajouter.
 *
 * Affichage seul (aucun effet sur le score, la grille ou les crédits), donc
 * prudent : en cas de doute, rien. Il faut exactement un mouvement reconnu,
 * exactement un pourcentage, aucune charge, aucun autre mouvement à 1RM, et
 * des reps qui ne sont pas déjà écrites (« 5 Pull-ups @ 60 % » : le 5 gagne).
 */
export function gymRepsAnnotation(
  line: string,
  recordFor: (movement: GymPrMovement) => number | null,
  isLoadedMovement: (name: string) => boolean = () => false,
): { insertAt: number; reps: number } | null {
  const pcts = [...line.matchAll(PCT)];
  if (pcts.length !== 1 || (line.match(/%/g) ?? []).length !== 1) return null;
  if (/\bkg\b|\blbs?\b/i.test(line)) return null;
  const pctMatch = pcts[0];
  // Reps écrites juste avant le % (« 5 @ 60 % », « 3 × 5 @ 60 % ») : elles gagnent.
  if (/\d\s*@\s*$/.test(line.slice(0, pctMatch.index))) return null;

  const words = [...line.matchAll(WORD)];
  const found: Array<{ start: number; end: number; label: GymPrMovement }> = [];
  for (let i = 0; i < words.length; i++) {
    for (let n = Math.min(MAX_WORDS, words.length - i); n >= 1; n--) {
      const phrase = words.slice(i, i + n).map(w => w[0]).join(' ');
      if (isLoadedMovement(phrase)) return null;
      const label = gymPrLabel(phrase);
      if (label) { found.push({ start: i, end: i + n, label }); i += n - 1; break; }
    }
  }
  if (found.length !== 1) return null;
  const { start, label } = found[0];

  const prev = words[start - 1];
  if (prev) {
    const between = line.slice(prev.index! + prev[0].length, words[start].index);
    if (/^\s*$/.test(between)) {
      // « 5 Pull-ups » : reps écrites. « Strict Pull-ups » : autre mouvement.
      if (/^\d/.test(prev[0])) return null;
      if (!LINKING_WORDS.has(prev[0].toLowerCase())) return null;
    }
  }

  const reps = gymRepsForPct(recordFor(label), parseFloat(pctMatch[1].replace(',', '.')));
  if (reps == null) return null;
  return { insertAt: pctMatch.index! + pctMatch[0].length, reps };
}

/**
 * Texte d'un WOD où chaque % du max d'un mouvement de gymnastique porte ses
 * reps (« 60 % du max (≈ 9 reps) de Toes to Bar »), quand l'athlète a un record.
 * `recordFor` est injecté : ce module ne lit jamais `personal_records`.
 */
export function annotateGymReps(
  description: string,
  recordFor: (movement: GymPrMovement) => number | null,
  isLoadedMovement?: (name: string) => boolean,
): string {
  return description
    .split('\n')
    .map(line => {
      const a = gymRepsAnnotation(line, recordFor, isLoadedMovement);
      return a ? `${line.slice(0, a.insertAt)} (≈ ${a.reps} ${a.reps > 1 ? 'reps' : 'rep'})${line.slice(a.insertAt)}` : line;
    })
    .join('\n');
}
