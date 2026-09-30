// Paliers ELO de l'écran Historique ELO : lecture seule des seuils de eloLevels.
import { ELO_THRESHOLDS, EloLevel } from './eloLevels';

export interface EloTier {
  level: EloLevel;
  name: string;
  min: number;
}

export const TIER_NAMES: Record<EloLevel, string> = {
  scaled: 'Scaled', inter: 'Inter', rx: 'RX', 'rx+': 'RX+', elite: 'Elite', pro: 'Pro',
};

/** Du plus bas au plus haut. */
export const ELO_TIERS: EloTier[] = [...ELO_THRESHOLDS]
  .sort((a, b) => a.min - b.min)
  .map((t) => ({ level: t.level, name: TIER_NAMES[t.level], min: t.min }));

export function tierIndex(elo: number): number {
  let idx = 0;
  ELO_TIERS.forEach((t, i) => { if (elo >= t.min) idx = i; });
  return idx;
}

export function tierOf(elo: number): EloTier {
  return ELO_TIERS[tierIndex(elo)];
}

export interface TierProgress {
  tier: EloTier;
  next: EloTier | null;
  /** Points manquants avant le palier suivant ; null au dernier palier. */
  remaining: number | null;
  /** Avancement de 0 à 1 entre le seuil du palier et celui du suivant ; 1 au dernier palier. */
  ratio: number;
}

export function tierProgress(elo: number): TierProgress {
  const i = tierIndex(elo);
  const tier = ELO_TIERS[i];
  const next = ELO_TIERS[i + 1] ?? null;
  if (!next) return { tier, next: null, remaining: null, ratio: 1 };
  const ratio = (elo - tier.min) / (next.min - tier.min);
  return { tier, next, remaining: next.min - elo, ratio: Math.min(1, Math.max(0, ratio)) };
}

/**
 * Index du point où la courbe entre pour la première fois dans le palier `level`
 * (point précédent dans un autre palier) ; null si elle ne fait qu'y rester ou n'y entre pas.
 */
export function tierPassageIndex(elos: number[], level: EloLevel): number | null {
  for (let i = 1; i < elos.length; i++) {
    if (tierOf(elos[i]).level === level && tierOf(elos[i - 1]).level !== level) return i;
  }
  return null;
}

/** Index du meilleur ELO de la courbe (première occurrence) ; null si vide. */
export function bestIndex(elos: number[]): number | null {
  if (elos.length === 0) return null;
  let best = 0;
  elos.forEach((e, i) => { if (e > elos[best]) best = i; });
  return best;
}

/** Tranches de palier visibles sur la plage [min, max] du graphique, du bas vers le haut. */
export function tierBands(min: number, max: number): { tier: EloTier; from: number; to: number }[] {
  return ELO_TIERS.map((tier, i) => {
    const upper = ELO_TIERS[i + 1]?.min ?? Infinity;
    return { tier, from: Math.max(tier.min, min), to: Math.min(upper, max) };
  }).filter((b) => b.to > b.from);
}

/** Seuils strictement compris dans la plage affichée. */
export function thresholdsIn(min: number, max: number): EloTier[] {
  return ELO_TIERS.filter((t) => t.min > min && t.min < max);
}
