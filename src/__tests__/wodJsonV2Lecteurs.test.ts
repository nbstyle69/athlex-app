/**
 * wod_json v2 du moteur (i18n « Moteur », M3) : chaque lecteur de `generated_wods.wod_json`
 * dans l'app reçoit un JSON v2 (clés ajoutées `v` et `rendu`, y compris dans les
 * exercices de Musculation) et se comporte exactement comme avec le même JSON sans ces
 * clés, la forme d'avant M3. Lecteurs recensés : `recentSignatures`, `loadLastSession` /
 * `reopenParams`, `findResumableMuscuSession`, et en aval `whiteboardRows`,
 * `initialPerformed`, `performedToDrafts`, `plannedSets`, `muscuRepsOnly`. Aucun écran ne
 * lit `box_wods.wod_json`, et ni le Manager, ni la base, ni une autre fonction edge ne le lit.
 * Faux client Supabase en mémoire : jamais la vraie base.
 */
type Row = Record<string, unknown>;
const mockTables: Record<string, Row[]> = { generated_wods: [] };

jest.mock('../lib/supabase', () => {
  class Q {
    filters: [string, unknown][] = [];
    constructor(public table: string) {}
    select() { return this; }
    eq(k: string, v: unknown) { this.filters.push([k, v]); return this; }
    not() { return this; }
    order() { return this; }
    limit() { return this; }
    rows() { return (mockTables[this.table] ?? []).filter((r) => this.filters.every(([k, v]) => r[k] === v)); }
    maybeSingle() { return Promise.resolve({ data: this.rows()[0] ?? null, error: null }); }
    then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve({ data: this.rows(), error: null }).then(res, rej); }
  }
  return { supabase: { from: (t: string) => new Q(t) } };
});
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: () => Promise.resolve({}) }));
jest.mock('../services/strengthSets', () => ({
  ...jest.requireActual('../services/strengthSets'),
  latestStrengthDraft: async () => ({ sourceId: 'g-muscu' }),
}));

import { generateBlocC, generateMuscu, CATALOG_SNAPSHOT, BANK_V1 } from '../../packages/wod-engine/src';
import type { GeneratedWod, MuscuWod } from '../../packages/wod-engine/src';
import type { User } from '../types';
import { recentSignatures, whiteboardRows, plannedSets } from '../services/wodGenerator';
import { findResumableMuscuSession, initialPerformed, performedToDrafts, muscuRepsOnly } from '../services/muscuSession';
import { loadLastSession, reopenParams } from '../screens/training/lastSession';

/** Le même JSON sans les clés ajoutées par M3 : la forme d'avant. */
function sansAjouts<T>(v: T): T {
  if (Array.isArray(v)) return v.map(sansAjouts) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'v' && k !== 'rendu').map(([k, x]) => [k, sansAjouts(x)])) as T;
  return v;
}
const user = { id: 'u1', level: 'rx', gender: 'male' } as Pick<User, 'id' | 'level' | 'gender'>;

const metcon: GeneratedWod = generateBlocC({ entry: 'express', discipline: 'functional', budget_min: 15, intention: 'mixed', format: 'surprise' }, CATALOG_SNAPSHOT, BANK_V1, 11);
const muscu: MuscuWod = generateMuscu({ entry: 'express', target: 'pull', objective: 'force', budget_min: 45, equipment: 'gym', level: 'debutant' }, CATALOG_SNAPSHOT, BANK_V1, 5);

describe('lecteurs de wod_json : un JSON v2 se lit comme avant', () => {
  it('les objets testés sont bien en v2, avec un rendu jusque dans les exercices', () => {
    expect(metcon.v).toBe(2);
    expect(muscu.v).toBe(2);
    expect(muscu.rendu).toBeDefined();
    expect(muscu.blocks[0].exercises.every((e) => e.rendu)).toBe(true);
  });

  it('recentSignatures : mêmes signatures', async () => {
    mockTables.generated_wods = [{ user_id: 'u1', wod_json: metcon }, { user_id: 'u1', wod_json: muscu }];
    const v2 = await recentSignatures('u1');
    mockTables.generated_wods = [{ user_id: 'u1', wod_json: sansAjouts(metcon) }, { user_id: 'u1', wod_json: sansAjouts(muscu) }];
    expect(v2).toEqual(await recentSignatures('u1'));
    expect(v2).toEqual([metcon.signature, muscu.signature]);
  });

  it.each([['metcon', metcon], ['musculation', muscu]] as const)('loadLastSession et reopenParams (%s) : mêmes paramètres', async (_, wod) => {
    mockTables.generated_wods = [{ user_id: 'u1', created_at: '2026-10-13T10:00:00Z', wod_json: wod, scores: [] }];
    const v2 = await loadLastSession(user, []);
    mockTables.generated_wods = [{ user_id: 'u1', created_at: '2026-10-13T10:00:00Z', wod_json: sansAjouts(wod), scores: [] }];
    const avant = await loadLastSession(user, []);
    expect(v2).not.toBeNull();
    expect(sansAjouts(v2)).toEqual(avant);
    expect(v2!.params.result.wod).toBe(wod);
    expect(reopenParams(wod, user, []).screen).toEqual(reopenParams(sansAjouts(wod), user, []).screen);
  });

  it('findResumableMuscuSession : même séance rouverte', async () => {
    mockTables.generated_wods = [{ id: 'g-muscu', user_id: 'u1', wod_json: muscu }];
    const v2 = await findResumableMuscuSession('u1');
    mockTables.generated_wods = [{ id: 'g-muscu', user_id: 'u1', wod_json: sansAjouts(muscu) }];
    expect(v2).not.toBeNull();
    expect(sansAjouts(v2)).toEqual(await findResumableMuscuSession('u1'));
  });

  it('whiteboardRows : mêmes colonnes, wod_json identique hors clés ajoutées', () => {
    for (const wod of [metcon, muscu]) {
      expect(sansAjouts(whiteboardRows(wod))).toEqual(whiteboardRows(sansAjouts(wod)));
    }
  });

  it('séries prévues, brouillons et reps seules de la Musculation : identiques', () => {
    const avant = sansAjouts(muscu);
    expect(initialPerformed(muscu)).toEqual(initialPerformed(avant));
    const perf = initialPerformed(muscu);
    expect(performedToDrafts(muscu, perf)).toEqual(performedToDrafts(avant, perf));
    muscu.blocks[0].exercises.forEach((e, i) => {
      expect(plannedSets(e)).toEqual(plannedSets(avant.blocks[0].exercises[i]));
      expect(muscuRepsOnly(e)).toBe(muscuRepsOnly(avant.blocks[0].exercises[i]));
    });
  });
});
