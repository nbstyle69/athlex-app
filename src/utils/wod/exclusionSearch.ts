import type { Catalog } from '../../../packages/wod-engine/src';
import { equipmentLabel } from './equipmentLabels';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function searchExclusions(
  catalog: Catalog,
  equipment: readonly string[],
  query: string,
  excluded: readonly string[],
  musculation: boolean,
): { id: string; name: string; kind: 'equipment' | 'movement' }[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const materials = equipment
    .filter((id) => !excluded.includes(id) && normalize(equipmentLabel(id)).includes(q))
    .map((id) => ({ id, name: equipmentLabel(id), kind: 'equipment' as const }));
  const movements = catalog.movements
    .filter((m) => m.active && (!musculation || !!m.muscu) && !excluded.includes(m.id) && normalize(m.name).includes(q))
    .slice(0, 8)
    .map((m) => ({ id: m.id, name: m.name, kind: 'movement' as const }));
  return [...materials, ...movements];
}
