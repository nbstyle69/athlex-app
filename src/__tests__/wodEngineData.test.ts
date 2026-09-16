/**
 * Chargeur des données du moteur : Supabase quand les trois tables répondent,
 * repli indépendant sur les snapshots embarqués sinon. Le moteur n'est jamais
 * appelé avec un jeu vide.
 */

type Result = { data: unknown[] | null; error: { message: string } | null };
const results: Record<string, Result> = {};
const queried: string[] = [];

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      queried.push(table);
      const builder = {
        select: () => builder,
        eq: () => builder,
        then: (resolve: (r: Result) => unknown) =>
          Promise.resolve(results[table] ?? { data: null, error: { message: 'down' } }).then(resolve),
      };
      return builder;
    },
  },
}));

import {
  loadEngineData, resetEngineDataCache, engineSnapshot, withSnapshotMuscu,
} from '../services/wodEngineData';
import {
  BANK_V1, BANK_VERSION, CATALOG_SNAPSHOT, skeletonToRow, movementCapToRow,
} from '../../packages/wod-engine/src';
import type { Catalog, CatalogRow } from '../../packages/wod-engine/src';

/** Catalogue tel que le rend une prod sans la migration M1 : aucune colonne muscu. */
function preM1Catalog(): Catalog {
  return {
    version: CATALOG_SNAPSHOT.version,
    movements: CATALOG_SNAPSHOT.movements
      .filter((m) => m.weight_functional > 0 || m.weight_hybrid > 0 || !m.muscu)
      .map((m) => ({ ...m, muscu: null })),
  };
}

/** Lignes `movement_catalog` d'une prod pré-M1 : colonnes Functional / Hybrid seulement. */
function preM1Rows(): CatalogRow[] {
  return preM1Catalog().movements.map((m) => ({
    id: m.id,
    name: m.name,
    family: m.family,
    pattern: m.pattern,
    modality: m.modality,
    grip: m.grip,
    shoulder_load: m.shoulder_load,
    unit_default: m.unit_default,
    units_allowed: m.units_allowed,
    load_unit: m.load_unit,
    weight_functional: m.weight_functional,
    weight_hybrid: m.weight_hybrid,
    equipment: m.equipment,
    cadence: m.cadence,
    loads: m.loads,
    rep_ranges: m.rep_ranges,
    substitutions: m.substitutions,
    variant_up: m.variant_up,
    badge_key: m.badge_key,
    active: m.active,
    version: m.version,
    notes: m.notes,
  }));
}

beforeEach(() => {
  resetEngineDataCache();
  queried.length = 0;
  for (const k of Object.keys(results)) delete results[k];
});

describe('loadEngineData', () => {
  it('retombe sur les snapshots quand Supabase ne répond pas', async () => {
    const d = await loadEngineData();
    expect(d.source).toEqual({ catalog: 'snapshot', bank: 'snapshot' });
    expect(d.catalog).toBe(CATALOG_SNAPSHOT);
    expect(d.bank).toBe(BANK_V1);
    expect(new Set(queried)).toEqual(new Set(['movement_catalog', 'wod_skeletons', 'wod_volume_caps']));
  });

  it('lit la banque dans wod_skeletons + wod_volume_caps quand elles sont remplies', async () => {
    results.wod_skeletons = { data: BANK_V1.skeletons.map((s) => skeletonToRow(s, BANK_VERSION)), error: null };
    results.wod_volume_caps = { data: BANK_V1.movement_caps.map((c) => movementCapToRow(c, BANK_VERSION)), error: null };
    const d = await loadEngineData();
    expect(d.source).toEqual({ catalog: 'snapshot', bank: 'supabase' });
    expect(d.bank).not.toBe(BANK_V1);
    expect(d.bank.skeletons).toEqual(BANK_V1.skeletons);
    expect(d.bank.movement_caps).toEqual(BANK_V1.movement_caps);
  });

  it('une table vide ou en erreur ramène au snapshot de la banque seulement', async () => {
    results.wod_skeletons = { data: BANK_V1.skeletons.map((s) => skeletonToRow(s, BANK_VERSION)), error: null };
    results.wod_volume_caps = { data: [], error: null };
    const d = await loadEngineData();
    expect(d.source.bank).toBe('snapshot');
    expect(d.bank).toBe(BANK_V1);
  });

  it('met en cache pour la session (une seule série de requêtes) sauf force', async () => {
    await loadEngineData();
    const n = queried.length;
    await loadEngineData();
    expect(queried.length).toBe(n);
    await loadEngineData(true);
    expect(queried.length).toBe(2 * n);
  });

  it('complète un catalogue Supabase sans colonnes muscu avec la part Musculation du snapshot', () => {
    const remote = preM1Catalog();
    expect(remote.movements.length).toBeLessThan(CATALOG_SNAPSHOT.movements.length);
    const { catalog, patched } = withSnapshotMuscu(remote);
    expect(patched).toBe(true);
    const muscuIds = CATALOG_SNAPSHOT.movements.filter((m) => m.muscu).map((m) => m.id);
    for (const id of muscuIds) {
      expect(catalog.movements.find((m) => m.id === id)?.muscu).toBeTruthy();
    }
    // Les mouvements partagés gardent leurs champs Functional / Hybrid distants.
    const shared = remote.movements.find((m) => muscuIds.includes(m.id))!;
    const merged = catalog.movements.find((m) => m.id === shared.id)!;
    expect(merged.weight_functional).toBe(shared.weight_functional);
    expect(merged.name).toBe(shared.name);
    expect(new Set(catalog.movements.map((m) => m.id)).size).toBe(catalog.movements.length);
  });

  it('ne touche pas un catalogue qui a déjà sa part Musculation', () => {
    expect(withSnapshotMuscu(CATALOG_SNAPSHOT)).toEqual({ catalog: CATALOG_SNAPSHOT, patched: false });
  });

  it('loadEngineData trace supabase+snapshot_muscu sur un movement_catalog pré-M1', async () => {
    results.movement_catalog = { data: preM1Rows(), error: null };
    results.wod_skeletons = { data: BANK_V1.skeletons.map((s) => skeletonToRow(s, BANK_VERSION)), error: null };
    results.wod_volume_caps = { data: BANK_V1.movement_caps.map((c) => movementCapToRow(c, BANK_VERSION)), error: null };
    const d = await loadEngineData();
    expect(d.source).toEqual({ catalog: 'supabase+snapshot_muscu', bank: 'supabase' });
    expect(d.catalog.movements.filter((m) => m.muscu).length)
      .toBe(CATALOG_SNAPSHOT.movements.filter((m) => m.muscu).length);
    // squelettes musculation : repli déjà assuré par bankFromRows
    expect(d.bank.muscu_skeletons.length).toBe(BANK_V1.muscu_skeletons.length);
  });

  it('engineSnapshot() ne touche pas au réseau', () => {
    const s = engineSnapshot();
    expect(s.source).toEqual({ catalog: 'snapshot', bank: 'snapshot' });
    expect(queried).toEqual([]);
  });
});
