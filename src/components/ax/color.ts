/** Convertit une couleur `#RRGGBB` des jetons ax en `rgba(...)` à l'opacité donnée. */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) throw new Error(`withAlpha attend une couleur #RRGGBB, reçu : ${color}`);
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Marge tactile pour porter une zone visuelle à 44 pt minimum. */
export function hitSlopFor(width: number, height: number) {
  const h = Math.max(0, Math.ceil((44 - width) / 2));
  const v = Math.max(0, Math.ceil((44 - height) / 2));
  return { top: v, bottom: v, left: h, right: h };
}
