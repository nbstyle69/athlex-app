import { MovementEntry, MovementUnit } from '../services/gamification';
import { parseCardioLine, cardioToMovementEntry } from './cardioBlock';
import { defaultUnitFor } from './movementsCatalog';

export type AthleteGender = 'male' | 'female';

export interface ParseOptions {
  /** Genre de l'athlète : choisit la valeur ♀ d'un split `20/15` ; ♂ par défaut. */
  gender?: AthleteGender | null;
}

/**
 * Quantité `20` ou split `20/15` (♂/♀) : rend la valeur du genre demandé.
 * Une seule valeur vaut pour tout le monde.
 */
function pickQuantity(men: string, women: string | undefined, gender?: AthleteGender | null): number {
  const m = parseInt(men, 10);
  if (gender === 'female' && women != null) return parseInt(women, 10);
  return m;
}

/** `m` / `cal` (et leurs graphies usuelles) → unité de crédit. */
function normalizeUnit(raw: string): MovementUnit {
  const u = raw.toLowerCase();
  if (u === 'm') return 'm';
  return 'cal';
}

/**
 * Parse a formatted movement line from generated WODs.
 * Examples:
 *   "12 Thrusters (43 kg)"  → { name: "Thrusters", reps: 12, weight_kg: 43 }
 *   "20 cal Row"            → { name: "Row", reps: 20, unit: "cal" }
 *   "20/15 cal Row"         → reps 20 (♂) ou 15 (♀ via `options.gender`)
 *   "500 m Run (RPE 7)"     → { name: "Run", reps: 500, unit: "m" }
 *   "400m Course"           → { name: "Course", reps: 400, unit: "m" }
 *   "20 Row" / "800 Run"    → unité par défaut du catalogue (cal / m)
 *   "21-15-9 :"             → null  (header)
 *   "5 Rounds For Time :"   → null  (header)
 *   "Row ~ 2 × 500 m"       → null  (bloc cardio, cf. cardioBlock.ts)
 *
 * `reps` porte la quantité dans `unit` (`reps` par défaut) ; le nom est celui
 * de la ligne, sans unité, pour que `normalizeMovement` résolve `Row`.
 */
export function parseMovementLine(line: string, options?: ParseOptions): MovementEntry | null {
  const trimmed = line.trim();
  const gender = options?.gender;

  // Skip headers & labels
  if (!trimmed) return null;
  if (/^\d+\s+rounds?\s+/i.test(trimmed)) return null;
  if (/^(amrap|emom|for time|tabata|pyramide|ladder|chipper|──|min\s+\d)/i.test(trimmed)) return null;
  if (/^\d+[-–]\d+/.test(trimmed)) return null; // rep scheme like "21-15-9 :"
  if (trimmed.endsWith(':')) return null;
  if (trimmed.startsWith('⚡') || trimmed.startsWith('──')) return null;
  if (/⟨.*⟩/.test(trimmed)) return null; // team format labels

  // Cardio: "20 cal Row", "20/15 cal Row", "500 m Run (RPE 7)", "400m Course".
  // Sans espace ("400m") l'ancien parseur comptait 1 rep : la distance vaut
  // désormais des mètres, la seule lecture qui alimente un compteur cardio.
  const cardioMatch = trimmed.match(/^(\d+)(?:\s*\/\s*(\d+))?\s*(m|cals?|kcal)\b\.?\s+(.+)$/i);
  if (cardioMatch) {
    const reps = pickQuantity(cardioMatch[1], cardioMatch[2], gender);
    const name = cardioMatch[4].replace(/\s*\([^)]*\)/g, '').replace(/\s*@.*$/, '').trim();
    if (isNaN(reps) || reps <= 0 || !name) return null;
    return { name, reps, unit: normalizeUnit(cardioMatch[3]) };
  }

  // Standard: "12 Thrusters (43 kg)", "15 Cal Assault Bike", "21/15 Pull-ups",
  // and tolerant of "7 reps — Sumo Deadlift @ 42.5/30 kg" (leading "reps"/"—", "@ kg").
  const stdMatch = trimmed.match(/^(\d+)(?:\s*\/\s*(\d+))?\s*(?:reps?|x)?\s*[—–\-:]?\s*(.+)/i);
  if (stdMatch) {
    const reps = pickQuantity(stdMatch[1], stdMatch[2], gender);
    let rest = stdMatch[3];
    // Extract weight: "(43 kg)" / "(43/30 kg)" or "@ 42.5" / "@ 42.5/30 kg" — ♂ first, ♀ second.
    let weight_kg: number | undefined;
    const weightParen = rest.match(/\((\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*kg\)/i);
    const weightAt = rest.match(/@\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?/);
    const w = weightParen ?? weightAt;
    if (w) {
      weight_kg = parseFloat(gender === 'female' && w[2] != null ? w[2] : w[1]);
    }
    // Remove parenthetical info (weight/scale) and trailing "@ ..." load
    rest = rest.replace(/\s*\([^)]*\)/g, '').replace(/\s*@.*$/, '').trim();
    if (isNaN(reps) || reps <= 0 || !rest) return null;
    const unit = defaultUnitFor(rest);
    return unit === 'reps' ? { name: rest, reps, weight_kg } : { name: rest, reps, unit };
  }

  return null;
}

/**
 * Séries cardio structurées d'une description (`Row ~ 2 × 500 m ~ 250 W`).
 * Un bloc n'est ni multiplié par les rounds ni par le score : la prescription
 * est la quantité réalisée, comme un bloc de force est la charge réalisée.
 */
export function parseCardioBlocks(lines: string[]): MovementEntry[] {
  const out: MovementEntry[] = [];
  for (const line of lines) {
    const e = parseCardioLine(line);
    if (e) out.push(cardioToMovementEntry(e));
  }
  return out;
}

/**
 * Parse all movement lines from a generated WOD and compute total reps
 * based on WOD type and submitted score.
 *
 * @param movements - string[] from GeneratedWOD.movements
 * @param wodType - 'For Time' | 'AMRAP' | 'EMOM' | 'Tabata' | 'Max Reps' | etc.
 * @param scoreValue - the submitted score (time in seconds, rounds, or reps)
 * @param scoreType - 'time' | 'reps' | 'rounds'
 */
export function computeCompletedMovements(
  movements: string[],
  wodType: string,
  scoreValue: number,
  scoreType: string,
  options?: ParseOptions,
): MovementEntry[] {
  const cardio = parseCardioBlocks(movements);
  const metcon = computeMetconMovements(movements, wodType, scoreValue, scoreType, options);
  return [...metcon, ...cardio];
}

function computeMetconMovements(
  movements: string[],
  wodType: string,
  scoreValue: number,
  scoreType: string,
  options?: ParseOptions,
): MovementEntry[] {
  const parsed = movements.map(l => parseMovementLine(l, options)).filter(Boolean) as MovementEntry[];
  if (parsed.length === 0) return [];

  // Extract rounds from header if present (e.g. "5 Rounds For Time :")
  const headerRounds = extractHeaderRounds(movements);

  switch (wodType) {
    case 'For Time': {
      // User completed the whole WOD (score = time)
      // If it has rounds in the header, multiply
      if (headerRounds > 1) {
        return parsed.map(m => ({ ...m, reps: m.reps * headerRounds }));
      }
      // Chipper: reps as-is (each line already has total reps)
      return parsed;
    }

    case 'AMRAP': {
      // Score is total reps or rounds
      if (scoreType === 'rounds' || scoreType === 'reps') {
        // Calculate reps per round
        const repsPerRound = parsed.reduce((sum, m) => sum + m.reps, 0);
        if (repsPerRound <= 0) return parsed;

        if (scoreType === 'rounds') {
          // Exact rounds completed
          return parsed.map(m => ({ ...m, reps: m.reps * scoreValue }));
        } else {
          // Total reps: figure out full rounds
          const fullRounds = Math.floor(scoreValue / repsPerRound);
          const partialReps = scoreValue % repsPerRound;
          const result: MovementEntry[] = [];
          let remaining = partialReps;
          for (const m of parsed) {
            const fullReps = m.reps * fullRounds;
            const partial = Math.min(remaining, m.reps);
            remaining = Math.max(0, remaining - m.reps);
            result.push({ ...m, reps: fullReps + partial });
          }
          return result;
        }
      }
      return parsed;
    }

    case 'EMOM': {
      // Score is rounds completed (each round = 1 minute of work)
      // Each movement appears once per cycle; cycles = scoreValue / parsed.length
      if (scoreType === 'rounds' && parsed.length > 0) {
        const cycles = Math.floor(scoreValue / parsed.length) || 1;
        return parsed.map(m => ({ ...m, reps: m.reps * cycles }));
      }
      // Fallback: header rounds
      if (headerRounds > 1) {
        return parsed.map(m => ({ ...m, reps: m.reps * headerRounds }));
      }
      return parsed;
    }

    case 'Tabata': {
      // 8 rounds standard Tabata
      return parsed.map(m => ({ ...m, reps: m.reps * 8 }));
    }

    case 'Max Reps': {
      // Single movement, score IS the reps
      if (parsed.length === 1) {
        return [{ ...parsed[0], reps: scoreValue }];
      }
      return parsed;
    }

    default:
      // Chipper, Ladder, Couplet, etc. → treat like For Time
      if (headerRounds > 1) {
        return parsed.map(m => ({ ...m, reps: m.reps * headerRounds }));
      }
      return parsed;
  }
}

function extractHeaderRounds(movements: string[]): number {
  for (const line of movements) {
    const match = line.match(/^(\d+)\s+rounds?\s+/i);
    if (match) return parseInt(match[1], 10);
  }
  return 1;
}
