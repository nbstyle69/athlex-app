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
  /** Refus du serveur sur l'écriture d'une table (policy, contrainte…). */
  refuse: { table: string; code: string; message: string } | null;
}
const mockDb: Db = {
  strength_sessions: [], strength_set_logs: [], generated_wods: [], generated_wod_scores: [], touched: [], rpcCalls: [], offline: false, refuse: null,
};
let mockSeq = 0;

jest.mock('../lib/supabase', () => {
  // Contrat de postgrest-js : une coupure réseau rend status 0 et code '' ; un
  // refus de la base porte toujours son code Postgres ou PostgREST.
  const OFFLINE = { error: { message: 'TypeError: Network request failed', code: '' }, data: null, status: 0 };
  const pgError = (code: string, message: string) => ({ data: null, error: { code, message } });
  // Règles de Postgres que le client doit respecter (migration 20270138).
  const SERIES_CHECK = (rows: Row[]) => {
    if (rows.some(r => !(Number(r.set_index) >= 1 && Number(r.set_index) <= 50))) {
      return pgError('23514', 'new row for relation "strength_set_logs" violates check constraint "strength_set_logs_set_index_check"');
    }
    return null;
  };
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
      if (mockDb.refuse?.table === this.table) return pgError(mockDb.refuse.code, mockDb.refuse.message);
      // Un INSERT … ON CONFLICT DO UPDATE ne peut pas toucher deux fois la même clé.
      if (new Set(this.payload.map(p => key.map(k => String(p[k])).join('|'))).size !== this.payload.length) {
        return pgError('21000', 'ON CONFLICT DO UPDATE command cannot affect row a second time');
      }
      if (this.table === 'strength_set_logs') { const bad = SERIES_CHECK(this.payload); if (bad) return bad; }
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
        if (sets.length === 0) return pgError('22023', 'SEANCE_VIDE: aucune série valide');
        if (new Set(sets.map(x => `${x.movement}#${x.set_index}`)).size !== sets.length) {
          return pgError('22023', 'SERIES_EN_DOUBLE: un mouvement a deux fois la même série');
        }
        const bad = SERIES_CHECK(sets);
        if (bad) return bad;
        const k = { user_id: 'u1', source_type: a.p_source_type, source_id: a.p_source_id };
        let s = mockDb.strength_sessions.find(r => r.source_id === k.source_id && r.source_type === k.source_type);
        if (!s) { s = { id: `id-${++mockSeq}`, ...k, status: 'draft', first_validated_at: null }; mockDb.strength_sessions.push(s); }
        const first = s.first_validated_at == null;
        // Règles de 20270145 : charge max des séries chargées, reps totales des séries sans charge.
        const loads = sets.filter(x => x.load_kg != null).map(x => Number(x.load_kg));
        const max = loads.length ? Math.max(...loads) : null;
        const unloaded = sets.filter(x => x.load_kg == null).map(x => Number(x.reps));
        const total = unloaded.length ? unloaded.reduce((p, q) => p + q, 0) : null;
        mockDb.strength_set_logs = mockDb.strength_set_logs.filter(r => r.source_id !== k.source_id)
          .concat(sets.map(x => ({ id: `id-${++mockSeq}`, ...k, ...x })));
        Object.assign(s, { status: 'validated', max_load_kg: max, total_reps: total, first_validated_at: s.first_validated_at ?? 'T1', updated_at: new Date().toISOString() });
        return { data: { premiere_validation: first, max_load_kg: max, total_reps: total, series_valides: sets.length, records: [] }, error: null };
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
import { isRepsOnly } from '../services/strengthSets';

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
    strength_sessions: [], strength_set_logs: [], generated_wods: [], generated_wod_scores: [], touched: [], rpcCalls: [], offline: false, refuse: null,
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

describe('même exercice deux fois dans la séance', () => {
  const TWICE = {
    ...WOD,
    blocks: [{ exercises: [exercise('hip_thrust', 'Hip Thrust', 2, 10, 60), exercise('rdl', 'Romanian Deadlift', 1, 8, 50), exercise('hip_thrust_2', 'Hip Thrust', 2, 8, 70)] }],
  } as unknown as MuscuWod;
  const typed = () => setLoad(setLoad(initialPerformed(TWICE), 0, 1, 65), 2, 0, 72.5);

  it('numéro de stockage continu par exercice, séries relues par bloc et rang', () => {
    const drafts = performedToDrafts(TWICE, typed());
    expect(drafts.map(d => [d.entryIndex, d.name, d.setIndex])).toEqual([
      [0, 'Hip Thrust', 1], [0, 'Hip Thrust', 2], [1, 'Romanian Deadlift', 1], [2, 'Hip Thrust', 3], [2, 'Hip Thrust', 4],
    ]);
    expect(draftsToPerformed(initialPerformed(TWICE), drafts)).toEqual(typed());
  });

  it('brouillon, rechargement puis validation : chaque bloc garde ses charges', async () => {
    const res = await saveStrengthDraft({
      ...KEY, sourceTitle: TWICE.title, drafts: performedToDrafts(TWICE, typed()), editedAt: new Date().toISOString(), baseUpdatedAt: null,
    });
    expect(res.status).toBe('saved');
    expect(mockDb.strength_set_logs).toHaveLength(5);
    await AsyncStorage.clear();
    const base = initialPerformed(TWICE);
    const loaded = await loadStrengthGrid(KEY, performedToDrafts(TWICE, base));
    expect(draftsToPerformed(base, loaded.drafts)).toEqual(typed());
    const v = await validateMuscuSession(user, 'box-1', TWICE, { wodId: 'gw-1', performed: typed(), notes: '' });
    expect(v.result.seriesValides).toBe(5);
    expect((mockDb.rpcCalls[0].p_sets as Row[]).filter(x => x.movement === 'Hip Thrust').map(x => [x.set_index, x.load_kg]))
      .toEqual([[1, 60], [2, 65], [3, 72.5], [4, 70]]);
  });
});

describe('G3 : exercices au poids du corps en reps seules', () => {
  const bw = (id: string, name: string, sets: number, reps: number) => ({
    id, name, sets, reps, reps_unit: 'reps', load: { mode: 'bodyweight' },
  });
  const BW = { ...WOD, blocks: [{ exercises: [bw('pull_up', 'Strict Pull-Ups', 3, 8), bw('dips', 'Dips', 2, 10)] }] } as unknown as MuscuWod;
  const MIXTE = { ...WOD, blocks: [{ exercises: [bw('pull_up', 'Strict Pull-Ups', 2, 8), exercise('hip_thrust', 'Hip Thrust', 2, 10, 60)] }] } as unknown as MuscuWod;
  const withAdded = (p: PerformedExercise[], ei: number, reps: number) =>
    p.map((ex, i) => (i !== ei ? ex : { ...ex, sets: [...ex.sets, { reps, load_kg: 0, added: true }] }));
  const run = (wod: MuscuWod, performed: PerformedExercise[]) =>
    validateMuscuSession(user, 'box-1', wod, { wodId: 'gw-1', performed, notes: '' });

  it('poids du corps : reps seules (sans charge) ; toute autre charge reste exigée', () => {
    const d = performedToDrafts(MIXTE, initialPerformed(MIXTE));
    expect(d.map(x => [x.name, isRepsOnly(x), x.loadKg, x.loadRequired])).toEqual([
      ['Strict Pull-Ups', true, '', false], ['Strict Pull-Ups', true, '', false],
      ['Hip Thrust', false, '60', true], ['Hip Thrust', false, '60', true],
    ]);
  });

  it('série ajoutée : sans reps prévues, envoyée is_added, relue après le brouillon', async () => {
    const p = withAdded(initialPerformed(BW), 0, 5);
    const d = performedToDrafts(BW, p);
    expect(d[3]).toMatchObject({ name: 'Strict Pull-Ups', setIndex: 4, reps: '5', isAdded: true, prescribedReps: 0, loadRequired: false });
    expect((await saveStrengthDraft({ ...KEY, sourceTitle: BW.title, drafts: d, editedAt: new Date().toISOString(), baseUpdatedAt: null })).status).toBe('saved');
    const loaded = await loadStrengthGrid(KEY, performedToDrafts(BW, initialPerformed(BW)));
    const back = draftsToPerformed(initialPerformed(BW), loaded.drafts);
    expect(back[0].sets).toEqual([
      { reps: 8, load_kg: 0 }, { reps: 8, load_kg: 0 }, { reps: 8, load_kg: 0 }, { reps: 5, load_kg: 0, added: true },
    ]);
  });

  it('séance au poids du corps seule : validée, même crédit de compteurs qu’une séance chargée, sans score ni movement_logs', async () => {
    const { result } = await run(BW, withAdded(initialPerformed(BW), 0, 5));
    expect(result).toMatchObject({ premiereValidation: true, maxLoadKg: null, totalReps: 3 * 8 + 5 + 2 * 10 });
    const p = mockDb.rpcCalls[0].p_sets as Row[];
    expect(p.map(x => [x.set_index, x.load_kg, x.is_added, x.load_required])).toEqual([
      [1, null, false, false], [2, null, false, false], [3, null, false, false], [4, null, true, false],
      [1, null, false, false], [2, null, false, false],
    ]);
    expect(mockDb.generated_wod_scores).toEqual([]);
    expect(incrementCounter).toHaveBeenCalledTimes(1);
    expect(incrementCounter).toHaveBeenCalledWith('u1', 'total_scores_submitted', 1, 'box-1');
    expect(cancelTodayScoreReminder).toHaveBeenCalledTimes(1);
    expect(logMovementReps).not.toHaveBeenCalled();
    // Une modification ne recompte rien.
    await run(BW, initialPerformed(BW));
    expect(mockDb.generated_wod_scores).toEqual([]);
    expect(incrementCounter).toHaveBeenCalledTimes(1);
  });

  it('séance mixte : score tonnage comme avant, reps totales en plus', async () => {
    const { tonnage, result } = await run(MIXTE, initialPerformed(MIXTE));
    expect(result).toMatchObject({ maxLoadKg: 60, totalReps: 16 });
    expect(mockDb.generated_wod_scores).toHaveLength(1);
    expect(mockDb.generated_wod_scores[0].score_value).toBe(tonnage);
    expect(tonnage).toBe(2 * 10 * 60);
  });
});
