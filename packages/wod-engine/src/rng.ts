/**
 * RNG à graine (mulberry32) — repris tel quel de `src/utils/wod/rng.ts`.
 *   - même seed  -> même séquence
 *   - autre seed -> autre séquence
 * Aucune dépendance, aucun appel réseau.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  private r: () => number;
  constructor(seed: number) { this.r = mulberry32(seed); }
  float(): number { return this.r(); }
  int(min: number, max: number): number { return Math.floor(this.r() * (max - min + 1)) + min; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.r() * arr.length)]; }
  /** tirage pondéré ; poids ≤ 0 jamais tirés */
  pickWeighted<T>(arr: readonly T[], weight: (x: T) => number): T | undefined {
    let total = 0;
    for (const x of arr) total += Math.max(0, weight(x));
    if (total <= 0) return undefined;
    let cursor = this.r() * total;
    for (const x of arr) {
      const w = Math.max(0, weight(x));
      if (w <= 0) continue;
      cursor -= w;
      if (cursor < 0) return x;
    }
    return arr[arr.length - 1];
  }
  sample<T>(arr: readonly T[], n: number): T[] { return this.shuffle([...arr]).slice(0, n); }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export const randomSeed = (): number => Math.floor(Math.random() * 1e9);
