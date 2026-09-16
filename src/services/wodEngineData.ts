/**
 * Données du générateur de WOD (bloc C) : catalogue de mouvements, banque de
 * squelettes et plafonds §5.4. Lues dans Supabase (`movement_catalog`,
 * `wod_skeletons`, `wod_volume_caps`) quand le réseau répond, sinon repli sur
 * les snapshots embarqués du package — le moteur lui-même ne touche jamais au
 * réseau.
 */
import { supabase } from '../lib/supabase';
import {
  BANK_V1, CATALOG_SNAPSHOT, bankFromRows, catalogFromRows,
} from '../../packages/wod-engine/src';
import type {
  AnySkeletonRow, Catalog, CatalogRow, Skeleton, SkeletonBank, SkeletonRow, VolumeCapRow,
} from '../../packages/wod-engine/src';

export type EngineDataSource = 'supabase' | 'snapshot' | 'supabase+snapshot_muscu';

export interface EngineData {
  catalog: Catalog;
  bank: SkeletonBank;
  source: { catalog: EngineDataSource; bank: EngineDataSource };
}

const SNAPSHOT: EngineData = {
  catalog: CATALOG_SNAPSHOT,
  bank: BANK_V1,
  source: { catalog: 'snapshot', bank: 'snapshot' },
};

let cache: EngineData | null = null;
let inflight: Promise<EngineData> | null = null;

async function fetchCatalog(): Promise<Catalog | null> {
  const { data, error } = await supabase.from('movement_catalog').select('*');
  if (error || !data || data.length === 0) return null;
  const rows: CatalogRow[] = data.map((r) => ({
    ...r,
    cadence: r.cadence,
    loads: r.loads,
    rep_ranges: r.rep_ranges,
    substitutions: r.substitutions,
  }));
  const catalog = catalogFromRows(rows);
  return catalog.movements.some((m) => m.active) ? catalog : null;
}

async function fetchBank(): Promise<SkeletonBank | null> {
  const [sk, caps] = await Promise.all([
    supabase.from('wod_skeletons').select('*').eq('active', true),
    supabase.from('wod_volume_caps').select('*').eq('active', true),
  ]);
  if (sk.error || caps.error || !sk.data?.length || !caps.data?.length) return null;
  const skeletonRows = sk.data.map((r) => ({
    id: r.id,
    discipline: r.discipline as SkeletonRow['discipline'],
    format: r.format as SkeletonRow['format'],
    definition: r.definition as unknown as Skeleton,
    active: r.active,
    version: r.version,
  })) as AnySkeletonRow[];
  const capRows: VolumeCapRow[] = caps.data.map((r) => ({
    label: r.label,
    ids: r.ids,
    family: r.family as VolumeCapRow['family'],
    band: r.band as VolumeCapRow['band'],
    unit: r.unit as VolumeCapRow['unit'],
    rx_total: r.rx_total,
    active: r.active,
    version: r.version,
  }));
  try {
    return bankFromRows(skeletonRows, capRows);
  } catch {
    return null;
  }
}

/**
 * Base antérieure à la migration 20261214 : `movement_catalog` n'a pas les
 * colonnes muscu, tous les mouvements distants arrivent avec `muscu: null`. La
 * part Musculation vient alors du snapshot embarqué (métadonnées greffées sur
 * les mouvements partagés, exercices muscu seuls ajoutés), la part
 * Functional / Hybrid reste celle de Supabase. Les squelettes suivent la même
 * logique dans `bankFromRows`.
 */
export function withSnapshotMuscu(catalog: Catalog): { catalog: Catalog; patched: boolean } {
  if (catalog.movements.some((m) => m.muscu && m.active)) return { catalog, patched: false };
  const byId = new Map(catalog.movements.map((m) => [m.id, m]));
  for (const snap of SNAPSHOT.catalog.movements) {
    if (!snap.muscu) continue;
    const remote = byId.get(snap.id);
    byId.set(snap.id, remote ? { ...remote, muscu: snap.muscu } : snap);
  }
  return { catalog: { ...catalog, movements: Array.from(byId.values()) }, patched: true };
}

/** Snapshots embarqués, sans réseau (tests, hors ligne assumé). */
export function engineSnapshot(): EngineData {
  return SNAPSHOT;
}

/**
 * Catalogue + banque, mis en cache pour la session. Chaque source retombe
 * indépendamment sur son snapshot (erreur réseau, table vide, RLS).
 */
export async function loadEngineData(force = false): Promise<EngineData> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const [catalog, bank] = await Promise.all([
      fetchCatalog().catch(() => null),
      fetchBank().catch(() => null),
    ]);
    const cat = catalog ? withSnapshotMuscu(catalog) : null;
    const data: EngineData = {
      catalog: cat?.catalog ?? SNAPSHOT.catalog,
      bank: bank ?? SNAPSHOT.bank,
      source: {
        catalog: !cat ? 'snapshot' : cat.patched ? 'supabase+snapshot_muscu' : 'supabase',
        bank: bank ? 'supabase' : 'snapshot',
      },
    };
    cache = data;
    inflight = null;
    return data;
  })();
  return inflight;
}

export function resetEngineDataCache() {
  cache = null;
  inflight = null;
}
