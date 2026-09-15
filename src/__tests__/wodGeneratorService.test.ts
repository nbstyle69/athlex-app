/**
 * Service du générateur : tirage hors ligne (snapshots), persistance
 * structurée dans `generated_wods.wod_json`, anti-répétition sur 10 signatures,
 * score avec catégorie demandée et crédit de badges conservé.
 */

type Row = Record<string, unknown>;
const inserted: { table: string; row: Row }[] = [];
const updated: { table: string; row: Row; filters: string[] }[] = [];
const selects: Record<string, { data: unknown; error: null }> = {};

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: string[] = [];
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      Object.assign(builder, {
        select: chain, eq: (c: string, v: unknown) => { filters.push(`${c}=${String(v)}`); return builder; },
        not: chain, order: chain, limit: chain, maybeSingle: chain, single: chain,
        insert: (row: Row) => { inserted.push({ table, row }); selects[table] = { data: { id: 'wod-1' }, error: null }; return builder; },
        update: (row: Row) => { updated.push({ table, row, filters }); return builder; },
        upsert: (row: Row) => { inserted.push({ table, row }); return builder; },
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve(selects[table] ?? { data: null, error: null }).then(resolve),
      });
      return builder;
    },
  },
}));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
const counters: unknown[][] = [];
const reps: unknown[][] = [];
jest.mock('../services/gamification', () => ({
  incrementCounter: (...a: unknown[]) => { counters.push(a); return Promise.resolve(); },
  logMovementReps: (...a: unknown[]) => { reps.push(a); return Promise.resolve(); },
}));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: () => Promise.resolve() }));

import {
  categoryFor, generateForUser, saveGeneratedWod, setFavorite, submitGeneratedScore, scoreInputTypeFor,
  recentSignatures, SIGNATURE_WINDOW,
} from '../services/wodGenerator';
import { signature } from '../../packages/wod-engine/src';
import type { AthleteLevel } from '../types';

const user = { id: 'u1', level: 'rx' as AthleteLevel, gender: 'male' as const };

beforeEach(() => {
  inserted.length = 0; updated.length = 0; counters.length = 0; reps.length = 0;
  for (const k of Object.keys(selects)) delete selects[k];
});

describe('catégorie du profil', () => {
  it('RX / Men par défaut, rx+ → rxplus, Hybrid dérivé du niveau et du genre', () => {
    expect(categoryFor(null, 'functional')).toBe('rx');
    expect(categoryFor(null, 'hybrid')).toBe('men');
    expect(categoryFor({ level: 'rx+' as AthleteLevel, gender: 'female' }, 'functional')).toBe('rxplus');
    expect(categoryFor({ level: 'rx+' as AthleteLevel, gender: 'female' }, 'hybrid')).toBe('women_pro');
    expect(categoryFor({ level: 'scaled' as AthleteLevel, gender: 'male' }, 'hybrid')).toBe('men');
  });
});

describe('tirage', () => {
  it('génère hors ligne (snapshots) à graine fixe, sans classe du jour en express', async () => {
    const screen = { entry: 'express' as const, discipline: 'functional' as const, budget_min: 15, format: 'surprise' as const, intention: 'mixed' as const, vest: 'none' as const, exclude: [] };
    const a = await generateForUser(user, 'box', screen, 7);
    const b = await generateForUser(user, 'box', screen, 7);
    expect(a.wod.signature).toBe(b.wod.signature);
    expect(a.category).toBe('rx');
    expect(a.params.after_class).toBeNull();
    expect(a.wod.generator.seed).toBe(7);
  });

  it('relit les 10 dernières signatures depuis wod_json', async () => {
    selects.generated_wods = { data: [{ wod_json: { signature: 's1' } }, { wod_json: null }, { wod_json: { signature: 's2' } }], error: null };
    expect(await recentSignatures('u1')).toEqual(['s1', 's2']);
    expect(SIGNATURE_WINDOW).toBe(10);
  });
});

describe('persistance', () => {
  it('enregistre le rendu texte + wod_json structuré, puis favori', async () => {
    const { wod } = await generateForUser(user, null, { entry: 'express', discipline: 'hybrid', budget_min: 20, format: 'surprise', intention: 'engine', vest: 'required', exclude: [] }, 11);
    const id = await saveGeneratedWod('u1', wod, 'men');
    expect(id).toBe('wod-1');
    const row = inserted.find((i) => i.table === 'generated_wods')!.row;
    expect(row.user_id).toBe('u1');
    expect(row.sport).toBe('hybrid');
    expect(row.movements).toBe(wod.description);
    expect(row.level).toBe('rx');
    expect((row.wod_json as { signature: string }).signature).toBe(signature(wod));
    expect((row.wod_json as { generator: { seed: number } }).generator.seed).toBe(11);

    await setFavorite(id, true);
    expect(updated[0]).toMatchObject({ table: 'generated_wods', row: { is_favorite: true }, filters: ['id=wod-1'] });
  });

  it('score : catégorie demandée dans les notes, rx dérivé, compteur + crédit de badges', async () => {
    const { wod } = await generateForUser(user, null, { entry: 'express', discipline: 'functional', budget_min: 12, format: 'amrap', intention: 'mixed', vest: 'none', exclude: [] }, 3);
    expect(scoreInputTypeFor(wod)).toBe('rounds');
    await submitGeneratedScore(user, 'box', wod, { wodId: 'wod-1', scoreType: 'rounds', value: 5, category: 'scaled', notes: 'dur' });
    const score = inserted.find((i) => i.table === 'generated_wod_scores')!.row;
    expect(score).toMatchObject({ wod_id: 'wod-1', user_id: 'u1', score_type: 'rounds', score_value: 5, rx: false });
    expect(score.notes).toContain('Catégorie : Scaled');
    expect(score.notes).toContain('dur');
    expect(counters[0]).toEqual(['u1', 'total_scores_submitted', 1, 'box']);
    expect(reps[0][0]).toBe('u1');
    expect(reps[0][2]).toBe('wod');
    expect(reps[0][3]).toBe('wod-1');
  });
});
