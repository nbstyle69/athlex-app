import type { Family, Unit } from './types';

function step(q: number, unit: Unit, family: Family): number {
  if (unit === 'reps') return q >= 10 ? 5 : 1;
  if (unit === 'cal') return 5;
  if (unit === 'm') {
    if (family === 'run') return 100;
    if (family === 'sled' || family === 'carry') return 25;
    return q >= 1000 ? 100 : q >= 200 ? 50 : q >= 50 ? 10 : 5;
  }
  return q >= 20 ? 5 : 1;
}

export function roundCalculatedQuantity(
  q: number, unit: Unit, family: Family, mode: 'nearest' | 'down' | 'up' = 'nearest',
): number {
  const s = step(q, unit, family);
  const round = mode === 'down' ? Math.floor : mode === 'up' ? Math.ceil : Math.round;
  return round(q / s) * s;
}
