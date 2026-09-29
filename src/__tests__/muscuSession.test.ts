/**
 * Séance Musculation générée côté serveur (PR 3) : brouillon sans effet, reprise
 * sur un autre appareil, validation par validate_strength_session, score =
 * tonnage, crédit movement_logs une seule fois. Faux client Supabase en mémoire
 * suivant la migration 20270138 : jamais la vraie base.
 */
import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Row = Record<string, unknown>;
interface Db {
  strength_sessions: Row[];
  strength_set_logs: Row[];
  generated_wods: Row[];
  generated_wod_scores: Row[];
  touched: string[];
  rpcCalls: Row[];
  offline: boolean;
}
const mockDb: Db = {
  strength_sessions: [], strength_set_logs: [], generated_wods: [], generated_wod_scores: [], touched: [], rpcCalls: [], offline: false,
};
let mockSeq = 0;

jest.mock('../lib/supabase', () => {
  const OFFLINE = { error: { message: 'TypeError: Network request failed' }, data: null };
  class Q {
    filters: [string, unknown][] = [];
    notIds: string[] | null = null;
    op: 'select' | 'upsert' | 'insert' | 'update' | 'delete' = 'select';
    payload: Row[] = [];
    single = false;
    sortDesc: string | null = null;
    constructor(public table: keyof Db) {}
    select() { return this; }
    order(k: string, o?: { ascending?: boolean }) { if (o?.ascending === false) this.sortDesc = k; return this; }
    limit() { return this; }
    eq(k: string, v: unknown) { this.filters.push([k, v]); return this; }
    not(_k: string, _op: string, list: string) { this.notIds = list.slice(1, -1).split(','); return this; }
    upsert(p: Row | Row[]) { this.op = 'upsert'; this.payload = Array.isArray(p) ? p : [p]; return this; }
    insert(p: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(p) ? p : [p]; return this; }
    update(p: Row) { this.op = 'update'; this.payload = [p]; return this; }
    delete() { this.op = 'delete'; return this; }
    maybeSingle() { this.single = true; return this.run(); }
    then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return this.run().then(res, rej); }
    rows() { return mockDb[this.table] as Row[]; }
    match(r: Row) { return this.filters.every(([k, v]) => r[k] === v); }
    async run(): Promise<{ data: unknown; error: unknown }> {
      if (mockDb.offline) return OFFLINE;
      mockDb.touched.push(`${this.op}:${String(this.table)}`);
      if (this.op === 'select') {
        let found = this.rows().filter(r => this.match(r)).map(r => ({ ...r }));
        const k = this.sortDesc;
        if (k) found = found.sort((a, b) => String(b[k]).localeCompare(String(a[k])));
        return { data: this.single ? found[0] ?? null : found, error: null };
      }
      if (this.op === 'delete') {
        (mockDb[this.table] as Row[]) = this.rows().filter(r => !this.match(r) || (this.notIds ?? []).includes(String(r.id)));
        return { data: null, error: null };
      }
      if (this.op === 'update') {
        const hit = this.rows().filter(r => this.match(r));
        hit.forEach(r => Object.assign(r, this.payload[0]));
        return { data: hit.map(r => ({ id: r.id })), error: null };
      }
      if (this.op === 'insert') {
        const out = this.payload.map(p => { const row = { id: `id-${++mockSeq}`, ...p }; this.rows().push(row); return row; });
        return { data: this.single ? { id: out[0].id } : out.map(r => ({ id: r.id })), error: null };
      }
      const key = this.table === 'strength_sessions'
        ? ['user_id', 'source_type', 'source_id'] : ['user_id', 'source_type', 'source_id', 'movement', 'set_index'];
      const out = this.payload.map(p => {
        const ex = this.rows().find(r => key.every(k => r[k] === p[k]));
        if (ex) { Object.assign(ex, p); return ex; }
        const row = { id: `id-${++mockSeq}`, status: 'draft', max_load_kg: null, first_validated_at: null, ...p };
        this.rows().push(row);
        return row;
      });
      return { data: out.map(r => ({ id: r.id })), error: null };
    }
  }
  return {
    supabase: {
      from: (t: keyof Db) => new Q(t),
      rpc: jest.fn(async (_fn: string, a: Row) => {
        if (mockDb.offline) return OFFLINE;
        mockDb.rpcCalls.push(a);
        const sets = a.p_sets as Row[];
        if (sets.length === 0) return { data: null, error: { message: 'SEANCE_VIDE: aucune série valide' } };
        const k = { user_id: 'u1', source_type: a.p_source_type, source_id: a.p_source_id };
        let s = mockDb.strength_sessions.find(r => r.source_id === k.source_id && r.source_type === k.source_type);
        if (!s) { s = { id: `id-${++mockSeq}`, ...k, status: 'draft', first_validated_at: null }; mockDb.strength_sessions.push(s); }
        const first = s.first_validated_at == null;
        const max = Math.max(...sets.map(x => Number(x.load_kg)));
        mockDb.strength_set_logs = mockDb.strength_set_logs.filter(r => r.source_id !== k.source_id)
          .concat(sets.map(x => ({ id: `id-${++mockSeq}`, ...k, ...x })));
        Object.assign(s, { status: 'validated', max_load_kg: max, first_validated_at: s.first_validated_at ?? 'T1', updated_at: new Date().toISOString() });
        return { data: { premiere_validation: first, max_load_kg: max, series_valides: sets.length, records: [] }, error: null };
      }),
    },
  };
});
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/gamification', () => ({
  incrementCounter: jest.fn(() => Promise.resolve()), logMovementReps: jest.fn(() => Promise.resolve()),
}));
jest.mock('../services/notifications', () => ({
  cancelTodayScoreReminder: jest.fn(() => Promise.resolve()), sendScoreNotification: jest.fn(),
}));

import { supabase } from '../lib/supabase';
import { incrementCounter, logMovementReps } from '../services/gamification';
import { cancelTodayScoreReminder, sendScoreNotification } from '../services/notifications';
import type { MuscuWod } from '../../packages/wod-engine/src';
import { loadStrengthGrid, saveStrengthDraft } from '../services/strengthSets';
import {
  draftsToPerformed, findResumableMuscuSession, initialPerformed, performedToDrafts, validateMuscuSession,
} from '../services/muscuSession';
import { PerformedExercise, totalTonnage } from '../services/wodGenerator';

const exercise = (id: string, name: string, sets: number, reps: number, kg: number) => ({
  id, name, sets, reps, reps_unit: 'reps', load: { mode: 'weighted', kg },
});
const WOD = {
  source: 'generator', discipline: 'musculation', title: 'Séance Fessiers', level: 'intermediaire',
  entry: 'express', target: 'fessiers', objective: 'hypertrophie', equipment: 'box', budget_min: 30,
  score_type: 'tonnage',
  blocks: [{ exercises: [exercise('hip_thrust', 'Hip Thrust', 3, 10, 60), exercise('rdl', 'Romanian Deadlift', 2, 8, 50)] }],
} as unknown as MuscuWod;
const user = { id: 'u1' };
const KEY = { userId: 'u1', sourceType: 'generated' as const, sourceId: 'gw-1' };

const setLoad = (p: PerformedExercise[], ei: number, si: number, load_kg: number, reps?: number) =>
  p.map((ex, i) => (i !== ei ? ex : {
    ...ex, sets: ex.sets.map((s, j) => (j === si ? { reps: reps ?? s.reps, load_kg } : s)),
  }));
const saveDraft = (performed: PerformedExercise[]) => saveStrengthDraft({
  ...KEY, sourceTitle: WOD.title, drafts: performedToDrafts(WOD, performed), editedAt: new Date().toISOString(), baseUpdatedAt: null,
});
const validate = (performed: PerformedExercise[]) =>
  validateMuscuSession(user, 'box-1', WOD, { wodId: 'gw-1', performed, notes: '' });

beforeEach(async () => {
  Object.assign(mockDb, {
    strength_sessions: [], strength_set_logs: [], generated_wods: [], generated_wod_scores: [], touched: [], rpcCalls: [], offline: false,
  });
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('grille de la carte Séance ↔ séries du service', () => {
  it('une ligne par série, prescription conservée, aller-retour sans perte (102,5 → 102.5)', () => {
    const performed = setLoad(initialPerformed(WOD), 0, 1, 102.5);
    const drafts = performedToDrafts(WOD, performed);
    expect(drafts).toHaveLength(5);
    expect(drafts[1]).toMatchObject({ entryIndex: 0, setIndex: 2, name: 'Hip Thrust', reps: '10', loadKg: '102.5', prescribedReps: 10, prescribedLoadKg: 60 });
    expect(draftsToPerformed(initialPerformed(WOD), drafts)).toEqual(performed);
    const edited = drafts.map((d, i) => (i === 0 ? { ...d, loadKg: '102,5' } : d));
    expect(draftsToPerformed(initialPerformed(WOD), edited)[0].sets[0].load_kg).toBe(102.5);
  });
});

describe('brouillon côté serveur', () => {
  it('n’écrit que la séance et ses séries : ni score, ni 1RM, ni compteurs, ni badges, ni notifications', async () => {
    const res = await saveDraft(setLoad(initialPerformed(WOD), 0, 0, 70));
    expect(res.status).toBe('saved');
    expect(new Set(mockDb.touched.map(t => t.split(':')[1]))).toEqual(new Set(['strength_sessions', 'strength_set_logs']));
    expect(mockDb.strength_sessions[0]).toMatchObject({ source_type: 'generated', source_id: 'gw-1', status: 'draft' });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(mockDb.generated_wod_scores).toEqual([]);
    expect(incrementCounter).not.toHaveBeenCalled();
    expect(logMovementReps).not.toHaveBeenCalled();
    expect(cancelTodayScoreReminder).not.toHaveBeenCalled();
    expect(sendScoreNotification).not.toHaveBeenCalled();
  });

  it('se reprend sur un autre appareil : séance retrouvée, grille relue du serveur (aucune copie locale)', async () => {
    mockDb.generated_wods.push({ id: 'gw-1', user_id: 'u1', wod_json: WOD });
    const performed = setLoad(setLoad(initialPerformed(WOD), 0, 0, 72.5, 9), 1, 1, 55);
    await saveDraft(performed);
    await AsyncStorage.clear();

    const resumable = await findResumableMuscuSession('u1');
    expect(resumable?.savedId).toBe('gw-1');
    expect(resumable?.result.wod.title).toBe('Séance Fessiers');
    expect(resumable?.screen.discipline).toBe('musculation');

    const base = initialPerformed(WOD);
    const loaded = await loadStrengthGrid(KEY, performedToDrafts(WOD, base));
    expect(loaded.origin).toBe('server');
    expect(draftsToPerformed(base, loaded.drafts)).toEqual(performed);
  });

  it('une séance déjà validée n’est plus proposée à la reprise', async () => {
    mockDb.generated_wods.push({ id: 'gw-1', user_id: 'u1', wod_json: WOD });
    await saveDraft(initialPerformed(WOD));
    await validate(initialPerformed(WOD));
    expect(await findResumableMuscuSession('u1')).toBeNull();
  });
});

describe('validation', () => {
  it('passe par validate_strength_session (source generated) ; score = tonnage ; crédit movement_logs une seule fois', async () => {
    const performed = initialPerformed(WOD);
    const { tonnage, result } = await validate(performed);
    expect(result.premiereValidation).toBe(true);
    expect(tonnage).toBe(3 * 10 * 60 + 2 * 8 * 50);
    expect(mockDb.rpcCalls[0]).toMatchObject({ p_source_type: 'generated', p_source_id: 'gw-1', p_rx: true });
    expect(mockDb.generated_wod_scores).toHaveLength(1);
    expect(mockDb.generated_wod_scores[0]).toMatchObject({ wod_id: 'gw-1', user_id: 'u1', score_type: 'weight', score_value: tonnage });
    expect(incrementCounter).toHaveBeenCalledTimes(1);
    expect(cancelTodayScoreReminder).toHaveBeenCalledTimes(1);
    expect(logMovementReps).toHaveBeenCalledTimes(1);
    expect(logMovementReps).toHaveBeenCalledWith('u1', expect.any(Array), 'wod', 'gw-1');
  });

  it('modifier ses charges après validation : même RPC, tonnage remplacé, aucun nouveau crédit ni compteur', async () => {
    await validate(initialPerformed(WOD));
    const edited = setLoad(initialPerformed(WOD), 0, 2, 80);
    const { tonnage, result } = await validate(edited);
    expect(result.premiereValidation).toBe(false);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(tonnage).toBe(totalTonnage(edited));
    expect(mockDb.generated_wod_scores).toHaveLength(1);
    expect(mockDb.generated_wod_scores[0].score_value).toBe(tonnage);
    expect(incrementCounter).toHaveBeenCalledTimes(1);
    expect(cancelTodayScoreReminder).toHaveBeenCalledTimes(1);
    expect(logMovementReps).toHaveBeenCalledTimes(1);
  });

  it('séance vide refusée par le serveur : aucun score ni crédit', async () => {
    const empty = initialPerformed(WOD).map(ex => ({ ...ex, sets: ex.sets.map(() => ({ reps: 0, load_kg: 0 })) }));
    await expect(validate(empty)).rejects.toBeTruthy();
    expect(mockDb.generated_wod_scores).toEqual([]);
    expect(logMovementReps).not.toHaveBeenCalled();
  });

  it('le journal des séries n’écrit jamais dans movement_logs', async () => {
    await saveDraft(initialPerformed(WOD));
    await validate(initialPerformed(WOD));
    expect(mockDb.touched.some(t => t.endsWith(':movement_logs'))).toBe(false);
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'muscuSession.ts'), 'utf8');
    expect(src).not.toMatch(/movement_logs['"]/);
  });
});

describe('écran résultat', () => {
  const screen = fs.readFileSync(path.join(__dirname, '..', 'screens', 'wod', 'WodResultScreen.tsx'), 'utf8');
  it('la Musculation valide par validateMuscuSession, plus par submitMuscuScore', () => {
    expect(screen).toContain('validateMuscuSession(');
    expect(screen).not.toMatch(/submitMuscuScore\(/);
  });
  it('le brouillon serveur part ~0,8 s après la dernière frappe', () => {
    expect(screen).toContain('export const MUSCU_DRAFT_SAVE_DELAY_MS = 800;');
    expect(screen).toMatch(/setTimeout\(\(\) => \{ saveDraftNow\(\); \}, MUSCU_DRAFT_SAVE_DELAY_MS\)/);
  });
});
