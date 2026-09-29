/**
 * Couleur du palier sur la carte ELO de l'Accueil : la couleur de `LevelColors`,
 * rapprochée de l'encre du thème juste assez pour tenir le contraste AA sur la
 * surface de la carte.
 */
import { LevelColors } from '../../theme/designTokens';
import { contrast } from '../../theme/contrast';
import type { AxColors } from '../../theme/axTokens';

const TEXT_MIN = 4.5;

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function mix(from: string, to: string, t: number): string {
  const a = channels(from);
  const b = channels(to);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function levelInk(level: string, c: AxColors): string {
  const base = LevelColors[level] ?? c.text;
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(base, c.text, step / 20);
    if (contrast(candidate, c.surface) >= TEXT_MIN) return candidate;
  }
  return c.text;
}
