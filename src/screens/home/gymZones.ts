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
  { pct: 40,  zone: 'Volume facile',     usage: 'Séries tenues au chrono',  color: '#34D399', bg: '#1A3D2E' },
  { pct: 50,  zone: 'Volume de travail', usage: 'Série type de WOD',        color: '#34D399', bg: '#1A3D2E' },
  { pct: 60,  zone: 'Volume de travail', usage: 'Plafond par WOD',          color: '#34D399', bg: '#1A3D2E' },
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
