/**
 * Génération en un tap depuis l'onglet Entraînement : les réglages par défaut
 * de `WodGeneratorScreen` (format « Surprends-moi », première intention de la
 * discipline, sans gilet, objectif hypertrophie, première cible disponible),
 * complétés par ce que l'app mémorise déjà (exclusions, adaptation aux PR,
 * matériel Musculation).
 */
import type { Catalog, Entry, MuscuEquipment } from '../../../packages/wod-engine/src';
import { availableTargets, muscuLevelFor } from '../../../packages/wod-engine/src';
import type { ScreenParams } from '../../services/wodGenerator';
import { INTENTIONS } from '../wod/wodGeneratorOptions';
import { targetOrderFor } from '../wod/muscuOptions';

export type Sport = 'functional' | 'hybrid' | 'musculation';

export interface QuickSettings {
  exclude: string[];
  adaptToPr: boolean;
  muscuEquipment: MuscuEquipment;
}

export function quickScreenParams(
  entry: Entry,
  sport: Sport,
  settings: QuickSettings,
  user: { gender?: string | null; level?: string | null } | null,
  catalog: Catalog | null,
): ScreenParams {
  if (sport === 'musculation') {
    const order = targetOrderFor(user?.gender);
    const ok = catalog ? new Set(availableTargets(catalog, settings.muscuEquipment, muscuLevelFor(user?.level ?? null))) : null;
    const targets = ok ? order.filter((t) => ok.has(t)) : order;
    return {
      discipline: 'musculation', entry, target: targets[0] ?? order[0], objective: 'hypertrophie',
      equipment: settings.muscuEquipment, exclude: settings.exclude,
    };
  }
  return {
    entry, discipline: sport, intention: INTENTIONS[sport][0].key, exclude: settings.exclude,
    adapt_to_pr: settings.adaptToPr, format: 'surprise', vest: 'none',
  };
}
