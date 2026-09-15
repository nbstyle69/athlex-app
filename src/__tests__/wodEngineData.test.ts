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

import { loadEngineData, resetEngineDataCache, engineSnapshot } from '../services/wodEngineData';
import {
  BANK_V1, BANK_VERSION, CATALOG_SNAPSHOT, skeletonToRow, movementCapToRow,
} from '../../packages/wod-engine/src';

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

  it('engineSnapshot() ne touche pas au réseau', () => {
    const s = engineSnapshot();
    expect(s.source).toEqual({ catalog: 'snapshot', bank: 'snapshot' });
    expect(queried).toEqual([]);
  });
});
