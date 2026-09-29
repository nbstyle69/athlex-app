/**
 * Paliers ELO de l'Historique : palier courant, progression vers le suivant,
 * repères de la courbe et encres lisibles (AA) dans chaque thème.
 * Seuils : ELO_THRESHOLDS (src/utils/eloLevels.ts).
 */
import { ELO_THRESHOLDS, type EloLevel } from './eloLevels';
import { LevelColors } from '../theme/designTokens';
import { contrast } from '../theme/contrast';
import type { AxColors } from '../theme/axTokens';

export interface EloTier {
  level: EloLevel;
  name: string;
  min: number;
}

const TIER_NAMES: Record<EloLevel, string> = {
  scaled: 'Scaled', inter: 'Inter', rx: 'RX', 'rx+': 'RX+', elite: 'Elite', pro: 'Pro',
};

/** Du plus bas au plus haut. */
export const ELO_TIERS: EloTier[] = [...ELO_THRESHOLDS]
  .sort((a, b) => a.min - b.min)
  .map((t) => ({ level: t.level, name: TIER_NAMES[t.level], min: t.min }));

export function tierIndexOf(elo: number): number {
  for (let i = ELO_TIERS.length - 1; i > 0; i--) {
    if (elo >= ELO_TIERS[i].min) return i;
  }
  return 0;
}

export function tierOf(elo: number): EloTier {
  return ELO_TIERS[tierIndexOf(elo)];
}

export interface TierProgress {
  current: EloTier;
  /** null au dernier palier. */
  next: EloTier | null;
  /** Points restants avant le palier suivant ; null au dernier palier. */
  remaining: number | null;
  /** Avancée entre le seuil du palier courant et celui du suivant, de 0 à 1 (1 au dernier palier). */
  ratio: number;
}

export function tierProgress(elo: number): TierProgress {
  const i = tierIndexOf(elo);
  const current = ELO_TIERS[i];
  const next = ELO_TIERS[i + 1] ?? null;
  if (!next) return { current, next: null, remaining: null, ratio: 1 };
  const ratio = (elo - current.min) / (next.min - current.min);
  return { current, next, remaining: next.min - elo, ratio: Math.min(1, Math.max(0, ratio)) };
}

/**
 * Indice du premier point de la période où la courbe entre dans `level` en venant
 * d'un palier inférieur ; null si elle n'y entre pas sur la période.
 */
export function passageIndex(elos: number[], level: EloLevel): number | null {
  const target = ELO_TIERS.findIndex((t) => t.level === level);
  for (let i = 1; i < elos.length; i++) {
    if (tierIndexOf(elos[i]) === target && tierIndexOf(elos[i - 1]) < target) return i;
  }
  return null;
}

/** Indice du meilleur point (le premier en cas d'égalité) ; null sans point. */
export function bestIndex(elos: number[]): number | null {
  if (elos.length === 0) return null;
  let best = 0;
  for (let i = 1; i < elos.length; i++) if (elos[i] > elos[best]) best = i;
  return best;
}

export interface TierBand {
  tier: EloTier;
  from: number;
  to: number;
}

/** Portion de chaque palier comprise dans [min, max], du plus bas au plus haut. */
export function tierBands(min: number, max: number): TierBand[] {
  return ELO_TIERS.flatMap((tier, i) => {
    const upper = ELO_TIERS[i + 1]?.min ?? Infinity;
    const from = Math.max(min, tier.min);
    const to = Math.min(max, upper);
    return to > from ? [{ tier, from, to }] : [];
  });
}

/** Seuils strictement compris dans (min, max). */
export function thresholdsIn(min: number, max: number): EloTier[] {
  return ELO_TIERS.filter((t) => t.min > min && t.min < max);
}

// ── Couleurs ───────────────────────────────────────────────────────────

export const TIER_BAND_ALPHA = 0.1;
const TEXT_MIN = 4.5;

function channels(color: string): [number, number, number, number] {
  const rgba = /^rgba?\(([^)]+)\)$/.exec(color);
  if (rgba) {
    const [r, g, b, a] = rgba[1].split(',').map(Number);
    return [r, g, b, a === undefined ? 1 : a];
  }
  const n = parseInt(color.slice(1, 7), 16);
  return [n >> 16, (n >> 8) & 255, n & 255, 1];
}

function hex([r, g, b]: number[]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Couleur opaque obtenue en posant `top` (éventuellement translucide) sur `under`. */
export function composite(top: string, under: string): string {
  const [r, g, b, a] = channels(top);
  const [ur, ug, ub] = channels(under);
  return hex([r * a + ur * (1 - a), g * a + ug * (1 - a), b * a + ub * (1 - a)]);
}

function mix(from: string, to: string, t: number): string {
  const a = channels(from);
  const b = channels(to);
  return hex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t));
}

/** `base` rapprochée de l'encre du thème juste assez pour tenir l'AA sur `bg`. */
export function inkOn(base: string, c: AxColors, bg: string): string {
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(base, c.text, step / 20);
    if (contrast(candidate, bg) >= TEXT_MIN) return candidate;
  }
  return c.text;
}

/** Encre du palier, lisible sur la surface des cartes. */
export function tierInk(level: EloLevel, c: AxColors): string {
  return inkOn(LevelColors[level], c, c.surface);
}

/** Bande de couleur du palier, posée sur la surface du graphique. */
export function tierBand(level: EloLevel, c: AxColors): string {
  return composite(`rgba(${channels(LevelColors[level]).slice(0, 3).join(',')},${TIER_BAND_ALPHA})`, c.surface);
}

/** Encre du palier lisible sur sa propre bande (valeur du seuil, points). */
export function tierInkOnBand(level: EloLevel, c: AxColors): string {
  return inkOn(LevelColors[level], c, tierBand(level, c));
}
