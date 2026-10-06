/**
 * Bloc musculation : séries × reps × charge, sérialisé dans `description`.
 *
 * Les mouvements de WOD sont écrits « reps d'abord » (`21 Thruster (43 kg)`) et
 * c'est cette forme que le crédit de badges parse (`parseMovementLine`). Un bloc
 * de force est écrit « nom d'abord » :
 *
 *   Back Squat — 5 × 3 @ 80 %1RM — repos 2:00 — tempo 30X1
 *
 * L'absence de chiffre en tête est ce qui le rend invisible au crédit : les
 * parseurs de l'app déjà installée rendent `null` sur cette ligne, donc un bloc
 * de force n'invente ni reps ni badge, et reste lisible tel quel sans mise à
 * jour. `serializeStrength` garantit cette propriété (le nom est nettoyé de tout
 * chiffre de tête) ; le test de non-crédit la verrouille.
 */

import { annotateGymReps, gymPrLabel } from '../screens/home/gymZones';
import { weightliftingPrLabel } from '../screens/profile/prStorage';
import i18n from '../i18n';

export type StrengthLoadUnit = 'kg' | '%1RM';
/** Unité des « reps » : répétitions (défaut), secondes (gainage) ou mètres (carry). */
export type StrengthRepsUnit = 'reps' | 's' | 'm';
export type StrengthSide = 'jambe' | 'bras' | 'côté';

export interface StrengthEntry {
  name: string;
  sets: number;
  reps: number;
  /** `s` → « 3 × 30 s », `m` → « 3 × 40 m » ; absent = répétitions. */
  repsUnit?: StrengthRepsUnit;
  /** Exercice unilatéral : « 3 × 8 / jambe ». */
  perSide?: StrengthSide | null;
  /** Charge prescrite, dans `unit`. `null` = à l'appréciation de l'athlète. */
  load: number | null;
  unit: StrengthLoadUnit;
  restSec: number | null;
  tempo: string | null;
  /**
   * Charge non numérique (« RPE 8 », « RM du jour », « +2,5 kg »), segment
   * `charge …`. Une ligne sans `load` mais avec `charge` reste un bloc de
   * force : elle commence par le nom, donc jamais créditée comme metcon.
   */
  loadNote?: string | null;
  /**
   * Mouvement de gymnastique prescrit en % du record (max unbroken) :
   * « Ring Muscle-up — 3 × 15 % du max ». Les reps viennent du record de
   * l'athlète (`gymRepsForPct`) ; `reps` vaut alors 0 (inconnues ici).
   */
  pctOfMax?: number;
}

const SEP = ' — ';

/** Un bloc de force ne doit jamais commencer par un chiffre (cf. en-tête). */
function sanitizeName(name: string): string {
  // Un tiret entouré d'espaces est le séparateur de la ligne : il ne peut pas
  // rester dans le nom (« Toes-to-Bar » n'est pas concerné, son tiret est collé).
  return name.replace(/^[\d\s×x.,:—–-]+/, '').replace(/\s+[—–-]\s+/g, ' ').trim();
}

function formatRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function parseRest(text: string): number | null {
  const raw = text.trim().toLowerCase().replace(/\s/g, '');
  const mmss = raw.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  const sec = raw.match(/^(\d+)s?$/);
  if (sec) return parseInt(sec[1], 10);
  return null;
}

export function serializeStrength(e: StrengthEntry): string {
  const name = sanitizeName(e.name);
  if (!name) return '';
  const sets = Math.max(1, Math.round(e.sets));
  const reps = Math.max(1, Math.round(e.reps));
  let out = e.pctOfMax != null
    ? `${name}${SEP}${sets} × ${e.pctOfMax} % du max` // i18n-ignore : texte du WOD enregistré, relu par parseStrengthLine
    : `${name}${SEP}${sets} × ${reps}`;
  if (e.pctOfMax == null && e.repsUnit && e.repsUnit !== 'reps') out += ` ${e.repsUnit}`;
  if (e.pctOfMax == null && e.perSide) out += ` / ${e.perSide}`;
  if (e.pctOfMax == null && e.load != null && e.load > 0) out += ` @ ${e.load} ${e.unit}`;
  const loadNote = (e.loadNote ?? '').trim().replace(/\s+[—–-]\s+/g, ' ');
  if (loadNote) out += `${SEP}charge ${loadNote}`;
  if (e.restSec != null && e.restSec > 0) out += `${SEP}repos ${formatRest(e.restSec)}`;
  const tempo = (e.tempo ?? '').trim();
  if (tempo) out += `${SEP}tempo ${tempo}`;
  return out;
}

export function parseStrengthLine(line: string): StrengthEntry | null {
  const raw = (line ?? '').trim();
  if (!raw || /^\d/.test(raw)) return null;    // « reps d'abord » = mouvement de WOD
  const parts = raw.split(/\s+[—–-]\s+/);
  if (parts.length < 2) return null;
  const name = parts[0].trim();
  if (!name) return null;

  const m = parts[1].match(/^(\d+)\s*[x×]\s*(\d+)(?:\s*(s|m)\b)?(?:\s*\/\s*(jambe|bras|c[oô]t[eé]))?(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*(kg|%\s*1rm|%))?$/i);
  // « 3 × 15 % du max » / « 3 × 15 % » : seulement pour un mouvement de
  // gymnastique (un % de son record). Un mouvement chargé reste non reconnu.
  const pm = m ? null : parts[1].match(/^(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*%(?:\s*du\s+max)?$/i);
  if (!m && !(pm && gymPrLabel(name))) return null;

  const repsUnit = (m?.[3]?.toLowerCase() ?? null) as StrengthRepsUnit | null;
  // i18n-ignore : valeur interne relue dans le texte français du WOD (affichée par sideLabel)
  const perSide: StrengthSide | null = m?.[4] ? (/^jambe/i.test(m[4]) ? 'jambe' : /^bras/i.test(m[4]) ? 'bras' : 'côté') : null;
  const load = m?.[5] != null ? parseFloat(m[5].replace(',', '.')) : null;
  const unit: StrengthLoadUnit = m?.[6] != null && m[6].toLowerCase().startsWith('kg') ? 'kg' : '%1RM';

  let restSec: number | null = null;
  let tempo: string | null = null;
  let loadNote: string | null = null;
  for (const tail of parts.slice(2)) {
    const rest = tail.match(/^repos\s+(.+)$/i);
    if (rest) { restSec = parseRest(rest[1]); continue; }
    const tp = tail.match(/^tempo\s+(.+)$/i);
    if (tp) { tempo = tp[1].trim(); continue; }
    const ch = tail.match(/^charge\s+(.+)$/i);
    if (ch) loadNote = ch[1].trim();
  }

  return {
    name,
    sets: parseInt((m ?? pm)![1], 10),
    reps: m ? parseInt(m[2], 10) : 0,
    load,
    unit: load == null ? 'kg' : unit,
    restSec,
    tempo,
    ...(loadNote ? { loadNote } : {}),
    ...(repsUnit ? { repsUnit } : {}),
    ...(perSide ? { perSide } : {}),
    ...(pm ? { pctOfMax: parseFloat(pm[2].replace(',', '.')) } : {}),
  };
}

export function isStrengthLine(line: string): boolean {
  return parseStrengthLine(line) !== null;
}

/** Sépare une description en mouvements de WOD (crédités) et blocs de force. */
export function splitStrengthLines(lines: string[]): { wod: string[]; strength: string[] } {
  const wod: string[] = [];
  const strength: string[] = [];
  for (const l of lines) (isStrengthLine(l) ? strength : wod).push(l);
  return { wod, strength };
}

const LOAD_STEP = 2.5;

/**
 * Charge réelle d'un bloc, en kg. Une prescription en `%1RM` a besoin du 1RM de
 * l'athlète : sans lui (records vides, mouvement inconnu) elle reste un
 * pourcentage et cette fonction rend `null` — jamais une charge inventée.
 */
export function resolveStrengthLoadKg(
  e: Pick<StrengthEntry, 'load' | 'unit'>,
  oneRepMaxKg: number | null | undefined,
): number | null {
  if (e.load == null || e.load <= 0) return null;
  if (e.unit === 'kg') return e.load;
  if (oneRepMaxKg == null || oneRepMaxKg <= 0) return null;
  return Math.round((oneRepMaxKg * e.load) / 100 / LOAD_STEP) * LOAD_STEP;
}

/**
 * Description d'un WOD où chaque bloc en `%1RM` porte la charge de l'athlète
 * (« … @ 80 %1RM (≈ 152.5 kg) »). Les autres lignes sont rendues intactes, et un
 * pourcentage sans 1RM connu reste un pourcentage nu.
 *
 * `oneRepMaxFor` est injecté : ce module ne lit jamais `personal_records`
 * lui-même (l'athlète passe par `get_my_profile()`, le staff par sa RPC).
 */
export function annotateStrengthLoads(
  description: string,
  oneRepMaxFor: (movementName: string) => number | null,
): string {
  return description
    .split('\n')
    .map(line => {
      const e = parseStrengthLine(line);
      if (!e || e.unit !== '%1RM' || e.load == null) return line;
      const kg = resolveStrengthLoadKg(e, oneRepMaxFor(e.name));
      return kg == null ? line : `${line.trimEnd()} (≈ ${kg} kg)`;
    })
    .join('\n');
}

/** Côté d'un exercice unilatéral, traduit (« jambe » / « leg ») ; la valeur interne reste française. */
function sideLabel(side: StrengthSide): string {
  return i18n.t(`strengthSession.side.${side === 'côté' ? 'cote' : side}`);
}

/** « 5 × 3 @ 80 %1RM (≈ 152.5 kg) » — le kg n'apparaît que s'il est connu. */
export function formatStrengthPrescription(
  e: StrengthEntry,
  oneRepMaxKg?: number | null,
): string {
  // Affichage traduit (« 3 × 15 % du max », « 3 × 15% of max ») ; le texte du WOD,
  // lui, reste écrit en français par serializeStrength (c'est ce que lit le parseur).
  if (e.pctOfMax != null) return i18n.t('strengthSession.pctOfMaxScheme', { sets: e.sets, pct: e.pctOfMax });
  let out = `${e.sets} × ${e.reps}`;
  if (e.repsUnit && e.repsUnit !== 'reps') out += ` ${e.repsUnit}`;
  if (e.perSide) out += ` / ${sideLabel(e.perSide)}`;
  const note = (e.loadNote ?? '').trim();
  const noteText = note ? ` · ${i18n.t('strengthSession.loadNote', { note })}` : '';
  if (e.load == null || e.load <= 0) return `${out}${noteText}`;
  out += ` @ ${e.load} ${e.unit}`;
  if (e.unit === '%1RM') {
    const kg = resolveStrengthLoadKg(e, oneRepMaxKg);
    if (kg != null) out += ` (≈ ${kg} kg)`;
  }
  return `${out}${noteText}`;
}

/**
 * Reps (≈ N reps) des % du max de gymnastique dans un texte de WOD, tous types
 * confondus. Une ligne qui nomme aussi un mouvement à 1RM est laissée telle
 * quelle : le % pourrait être le sien.
 */
export function annotateGymRepsInText(
  description: string,
  gymRecordFor: (movementName: string) => number | null,
): string {
  return annotateGymReps(description, gymRecordFor, name => weightliftingPrLabel(name) != null);
}
