import type {
  Category, CategoryEstimate, DurationEstimate, GeneratedBlock, GeneratedMovement, GeneratedWod, SkeletonFormat,
} from './types';
import { categoriesFor } from './catalog';

/** Transition entre deux mouvements (brief §7). */
export const TRANSITION_S = 8;

/** Formats bornés par le temps : la durée est le budget, l'estimation donne la cible de score. */
export const TIME_BOUNDED: ReadonlySet<SkeletonFormat> = new Set<SkeletonFormat>([
  'amrap', 'emom', 'tabata', 'death_by', 'ladder', 'continuous', 'stations',
]);

export function degradation(rounds: number): number {
  return Math.min(1.3, 1 + 0.05 * (Math.max(1, rounds) - 1));
}

function cadence(m: GeneratedMovement, category: Category): number {
  const c = m.cadence_by_category[category];
  if (c === undefined) throw new Error(`cadence manquante : ${m.id} / ${category}`);
  return c;
}

/** Secondes de travail d'un mouvement exécuté une fois pour `qty`. */
export function movementSeconds(m: GeneratedMovement, category: Category, qty = m.qty): number {
  return qty * cadence(m, category);
}

/**
 * Secondes de travail d'un round (un passage sur chaque mouvement du bloc, sans
 * les mouvements exécutés à un round précis) + transitions.
 */
export function roundSeconds(block: GeneratedBlock, category: Category): number {
  const fixed = block.movements.filter((m) => m.round === undefined);
  const work = fixed.reduce((s, m) => s + movementSeconds(m, category), 0);
  return work + TRANSITION_S * fixed.length;
}

/** Secondes de travail total pour les formats à volume fixe (for_time, rounds, chipper, interval). */
export function fixedWorkSeconds(block: GeneratedBlock, category: Category): number {
  const rounds = block.rounds ?? 1;
  const scheme = block.scheme;
  let total = 0;
  if (scheme && block.movements.some((m) => m.scheme)) {
    scheme.forEach((_, i) => {
      for (const m of block.movements) {
        const q = m.scheme ? m.scheme[i] : m.round === undefined ? m.qty : 0;
        if (q > 0) total += movementSeconds(m, category, q) + TRANSITION_S;
      }
    });
    return total * degradation(scheme.length);
  }
  total = roundSeconds(block, category) * rounds;
  for (const m of block.movements) if (m.round !== undefined) total += movementSeconds(m, category) + TRANSITION_S;
  return total * degradation(rounds);
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Estimation complète d'un bloc pour une catégorie. */
export function estimateBlock(block: GeneratedBlock, category: Category, budgetMin: number): CategoryEstimate {
  const f = block.format;
  const budgetS = budgetMin * 60;
  switch (f) {
    case 'amrap': {
      const rs = roundSeconds(block, category);
      const rounds = budgetS / rs;
      return { minutes: budgetMin, target: `≈ ${Math.floor(rounds)} rounds` };
    }
    case 'ladder': {
      const scheme = block.scheme ?? [];
      let acc = 0;
      let step = 0;
      for (let i = 0; i < scheme.length; i++) {
        const stepS = block.movements.reduce((s, m) => s + movementSeconds(m, category, scheme[i]) + TRANSITION_S, 0);
        if (acc + stepS > budgetS) break;
        acc += stepS;
        step = scheme[i];
      }
      return { minutes: budgetMin, target: step ? `palier ${step}` : 'palier 1 partiel' };
    }
    case 'death_by': {
      const buyIn = block.movements.filter((m) => m.round === undefined && m.qty > 0 && !m.per_minute);
      const main = block.movements.find((m) => m.per_minute);
      const buyS = buyIn.reduce((s, m) => s + movementSeconds(m, category) + TRANSITION_S, 0);
      let minute = 0;
      if (main) {
        for (let n = 1; n <= budgetMin; n++) {
          if (buyS + movementSeconds(main, category, n) > 60) break;
          minute = n;
        }
      }
      return { minutes: budgetMin, target: minute >= budgetMin ? `minute ${budgetMin} complétée` : `minute ${minute}` };
    }
    case 'emom': {
      const every = block.rest?.every_s ?? 60;
      const n = block.movements.length;
      const cycles = Math.floor(budgetS / every / n);
      const perStation = block.movements.map((m) => Math.round(movementSeconds(m, category)));
      return { minutes: budgetMin, target: `${cycles} passages, travail ${Math.min(...perStation)}-${Math.max(...perStation)} s / ${every} s` };
    }
    case 'tabata': {
      return { minutes: budgetMin, target: 'reps min sur 8 × 20 s par bloc' };
    }
    case 'stations': {
      const rounds = block.rounds ?? 1;
      const work = block.rest?.work_s ?? 60;
      const rest = block.rest?.rest_s ?? 0;
      const n = block.movements.length;
      const minutes = (rounds * n * (work + rest)) / 60;
      return { minutes, target: `${rounds} tours × ${n} stations, ${work} s on / ${rest} s off` };
    }
    case 'continuous': {
      const cycle = roundSeconds(block, category);
      const dist = block.movements.filter((m) => m.unit === 'm').reduce((s, m) => s + m.qty, 0);
      return { minutes: budgetMin, target: `≈ ${Math.round((budgetS / cycle) * dist)} m` };
    }
    case 'interval': {
      const rounds = block.rounds ?? 1;
      const workPer = roundSeconds(block, category);
      if (block.rest?.every_s) {
        const total = block.rest.every_s * (rounds - 1) + workPer;
        return { minutes: total / 60, target: `travail ≈ ${fmtTime(workPer)} par intervalle` };
      }
      const rest = block.rest?.rest_s ?? 0;
      const total = rounds * workPer + rest * (rounds - 1);
      return { minutes: total / 60, target: `≈ ${fmtTime(workPer)} par répétition` };
    }
    default: {
      const s = fixedWorkSeconds(block, category);
      return { minutes: s / 60, target: `≈ ${fmtTime(s)}` };
    }
  }
}

/** Catégorie de référence pour le cap : rx (Functional) / men (Hybrid). */
export function referenceCategory(wod: Pick<GeneratedWod, 'discipline'>): Category {
  return wod.discipline === 'functional' ? 'rx' : 'men';
}

export function estimateDuration(wod: GeneratedWod, category: Category): DurationEstimate {
  const block = wod.blocks[0];
  const est = estimateBlock(block, category, wod.budget_min);
  const ref = estimateBlock(block, referenceCategory(wod), wod.budget_min);
  return {
    by_category: { [category]: est },
    reference_minutes: ref.minutes,
    cap_minutes: wod.blocks[0].timecap != null ? wod.blocks[0].timecap / 60 : null,
  };
}

/** Estimation pour toutes les catégories de la discipline. */
export function estimateAll(wod: Omit<GeneratedWod, 'estimate' | 'signature'>): DurationEstimate {
  const block = wod.blocks[0];
  const by: DurationEstimate['by_category'] = {};
  for (const c of categoriesFor(wod.discipline)) by[c] = estimateBlock(block, c, wod.budget_min);
  const ref = estimateBlock(block, referenceCategory(wod), wod.budget_min);
  return {
    by_category: by,
    reference_minutes: ref.minutes,
    cap_minutes: block.timecap != null ? block.timecap / 60 : null,
  };
}
