import type { GeneratedWod } from './types';

/**
 * Signature anti-répétition : squelette + format + rounds + mouvements (ordre,
 * unité, et distance pour les mètres/calories). Deux WODs qui ne diffèrent que
 * par les reps ou la graine partagent la même signature — c'est voulu,
 * l'athlète les vivrait comme le même WOD ; 400 m et 800 m de course, non.
 */
export function signature(wod: Pick<GeneratedWod, 'discipline' | 'generator' | 'format' | 'blocks'>): string {
  const b = wod.blocks[0];
  const movs = b.movements.map((m) => ((m.unit === 'm' || m.unit === 'cal') && m.qty > 0 ? `${m.id}:${m.qty}${m.unit}` : `${m.id}:${m.unit}`)).join(',');
  return `${wod.discipline}|${wod.generator.skeleton_id}|${b.format}|${b.rounds ?? '-'}|${movs}`;
}
