/**
 * Séance de musculation côté serveur (PR 2) : brouillon, reprise sur un autre
 * appareil, hors connexion, validation atomique, et effets de la première
 * validation seulement. Le client Supabase est un faux en mémoire qui suit le
 * contrat de la migration 20270138 : jamais la vraie base.
 */
import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Row = Record<string, unknown>;
interface Db {
  strength_sessions: Row[];
  strength_set_logs: Row[];
  wod_scores: Row[];
  touched: string[];
  rpcCalls: Row[];
  offline: boolean;
}
const mockDb: Db = { strength_sessions: [], strength_set_logs: [], wod_scores: [], touched: [], rpcCalls: [], offline: false };
let mockSeq = 0;

jest.mock('../lib/supabase', () => {
  const OFFLINE = { error: { message: 'TypeError: Network request failed' }, data: null };
  class Q {
    filters: [string, unknown][] = [];
    notIds: string[] | null = null;
    op: 'select' | 'upsert' | 'delete' = 'select';
    payload: Row[] = [];
    single = false;
    constructor(public table: keyof Db) {}
    select() { return this; }
    order() { return this; }
    eq(k: string, v: unknown) { this.filters.push([k, v]); return this; }
    not(_k: string, _op: string, list: string) { this.notIds = list.slice(1, -1).split(','); return this; }
    upsert(p: Row | Row[]) { this.op = 'upsert'; this.payload = Array.isArray(p) ? p : [p]; return this; }
    delete() { this.op = 'delete'; return this; }
    maybeSingle() { this.single = true; return this.run(); }
    then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return this.run().then(res, rej); }
    rows() { return mockDb[this.table] as Row[]; }
    match(r: Row) { return this.filters.every(([k, v]) => r[k] === v); }
    async run(): Promise<{ data: unknown; error: unknown }> {
      if (mockDb.offline) return OFFLINE;
      mockDb.touched.push(`${this.op}:${String(this.table)}`);
      if (this.op === 'select') {
        const found = this.rows().filter(r => this.match(r)).map(r => ({ ...r }));
        return { data: this.single ? found[0] ?? null : found, error: null };
      }
      if (this.op === 'delete') {
        const keep = this.rows().filter(r => !this.match(r) || (this.notIds ?? []).includes(String(r.id)));
        (mockDb[this.table] as Row[]) = keep;
        return { data: null, error: null };
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
        Object.assign(s, { status: 'validated', max_load_kg: max, first_validated_at: s.first_validated_at ?? 'T1', validated_at: 'T', updated_at: new Date().toISOString() });
        if (a.p_source_type === 'whiteboard') {
          mockDb.wod_scores = [{ wod_id: k.source_id, score_type: 'weight', score_value: max }];
        }
        return { data: { premiere_validation: first, max_load_kg: max, series_valides: sets.length, records: [] }, error: null };
      }),
    },
  };
});
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ sendScoreNotification: jest.fn(), sendScoreOvertakenNotification: jest.fn() }));

import { supabase } from '../lib/supabase';
import { incrementCounter, logMovementReps } from '../services/gamification';
import { sendScoreNotification } from '../services/notifications';
import { estimateOneRepMax } from '../services/strengthPR';
import {
  StrengthSetDraft, buildStrengthGrid, computedMaxLoad, loadStrengthGrid, normalizeDecimalInput,
  parseDecimal, saveStrengthDraft, savedAgo, strengthProgress, strengthRecordsFor,
  submitStrengthValidation, validationErrorCode, SaveStrengthDraftParams, StrengthSourceKey,
} from '../services/strengthSets';

const KEY: StrengthSourceKey = { userId: 'u1', sourceType: 'whiteboard', sourceId: 'wod-1' };
const prescription = (): StrengthSetDraft[] => buildStrengthGrid(
  [{ name: 'Back Squat', sets: 3, reps: 5, load: 100, unit: 'kg', restSec: null, tempo: null }],
  () => null,
);
const edit = (d: StrengthSetDraft[], i: number, patch: Partial<StrengthSetDraft>) =>
  d.map((x, j) => (j === i ? { ...x, ...patch } : x));
const draftParams = (drafts: StrengthSetDraft[], over: Partial<SaveStrengthDraftParams> = {}): SaveStrengthDraftParams => ({
  ...KEY, sourceTitle: 'Squat day', drafts, editedAt: new Date().toISOString(), baseUpdatedAt: null, ...over,
});
const validate = (drafts: StrengthSetDraft[], onFirst = jest.fn()) => submitStrengthValidation(
  { userId: 'u1', sourceType: 'whiteboard', sourceId: 'wod-1', sourceTitle: 'Squat day', drafts, rx: true },
  onFirst,
);

beforeEach(async () => {
  Object.assign(mockDb, { strength_sessions: [], strength_set_logs: [], wod_scores: [], touched: [], rpcCalls: [], offline: false });
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('brouillon', () => {
  it('n’écrit que la séance et ses séries : ni score, ni 1RM, ni compteurs, ni badges, ni notifications', async () => {
    const res = await saveStrengthDraft(draftParams(edit(prescription(), 0, { loadKg: '102,5' })));
    expect(res.status).toBe('saved');
    expect(new Set(mockDb.touched.map(t => t.split(':')[1]))).toEqual(new Set(['strength_sessions', 'strength_set_logs']));
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(mockDb.wod_scores).toEqual([]);
    expect(mockDb.strength_sessions[0].status).toBe('draft');
    expect(incrementCounter).not.toHaveBeenCalled();
    expect(logMovementReps).not.toHaveBeenCalled();
    expect(sendScoreNotification).not.toHaveBeenCalled();
  });

  it('se recharge depuis le serveur sur un autre appareil (aucune copie locale)', async () => {
    let d = edit(prescription(), 0, { reps: '4', loadKg: '102,5' });
    d = edit(d, 2, { reps: '', loadKg: '' });
    await saveStrengthDraft(draftParams(d));
    await AsyncStorage.clear();
    const loaded = await loadStrengthGrid(KEY, prescription());
    expect(loaded.origin).toBe('server');
    expect(loaded.drafts.map(x => [x.reps, x.loadKg])).toEqual([['4', '102.5'], ['5', '100'], ['', '']]);
    expect(loaded.server?.session?.status).toBe('draft');
  });

  it('sans rien sur le serveur, la grille vient de la prescription', async () => {
    const loaded = await loadStrengthGrid(KEY, prescription());
    expect(loaded.origin).toBe('prescription');
    expect(loaded.drafts).toEqual(prescription());
  });
});

describe('hors connexion', () => {
  it('garde une copie locale et la renvoie au retour du réseau', async () => {
    mockDb.offline = true;
    const d = edit(prescription(), 1, { loadKg: '110' });
    const editedAt = new Date().toISOString();
    expect((await saveStrengthDraft(draftParams(d, { editedAt }))).status).toBe('offline');
    const offlineLoad = await loadStrengthGrid(KEY, prescription());
    expect(offlineLoad.offline).toBe(true);
    expect(offlineLoad.origin).toBe('local');
    mockDb.offline = false;
    const back = await loadStrengthGrid(KEY, prescription());
    expect(back.origin).toBe('local');
    expect((await saveStrengthDraft(draftParams(back.drafts, { editedAt }))).status).toBe('saved');
    expect(mockDb.strength_set_logs.find(r => r.set_index === 2)?.load_kg).toBe(110);
  });

  it('une version serveur plus récente (autre appareil) gagne et n’est jamais écrasée', async () => {
    const saved = await saveStrengthDraft(draftParams(prescription()));
    const base = saved.status === 'saved' ? saved.updatedAt : null;
    mockDb.offline = true;
    const oldEdit = new Date(Date.now() - 60_000).toISOString();
    await saveStrengthDraft(draftParams(edit(prescription(), 0, { loadKg: '90' }), { editedAt: oldEdit, baseUpdatedAt: base }));
    mockDb.offline = false;
    const other = mockDb.strength_set_logs.find(r => r.set_index === 1)!;
    other.load_kg = 120;
    mockDb.strength_sessions[0].updated_at = new Date(Date.now() + 1000).toISOString();

    const loaded = await loadStrengthGrid(KEY, prescription());
    expect(loaded.origin).toBe('server');
    expect(loaded.drafts[0].loadKg).toBe('120');
    expect(await AsyncStorage.getItem('@athlex:strengthDraft:u1:whiteboard:wod-1')).toBeNull();

    const res = await saveStrengthDraft(draftParams(edit(prescription(), 0, { loadKg: '90' }), { editedAt: oldEdit, baseUpdatedAt: base }));
    expect(res.status).toBe('server_newer');
    expect(other.load_kg).toBe(120);
  });
});

describe('validation', () => {
  it('score = charge max des séries valides ; effets de première validation une seule fois', async () => {
    const onFirst = jest.fn();
    let d = edit(prescription(), 1, { loadKg: '102,5' });
    d = edit(d, 2, { reps: '', loadKg: '140' });
    const r1 = await validate(d, onFirst);
    expect(r1.premiereValidation).toBe(true);
    expect(computedMaxLoad(d)).toBe(102.5);
    expect(mockDb.wod_scores[0].score_value).toBe(102.5);
    expect((mockDb.rpcCalls[0].p_sets as Row[]).map(s => s.load_kg)).toEqual([100, 102.5]);
    expect(onFirst).toHaveBeenCalledTimes(1);

    const r2 = await validate(edit(d, 0, { loadKg: '105' }), onFirst);
    expect(r2.premiereValidation).toBe(false);
    expect(mockDb.wod_scores[0].score_value).toBe(105);
    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('les 1RM transmis viennent de la formule existante (estimateOneRepMax)', () => {
    const d = edit(edit(prescription(), 0, { reps: '3', loadKg: '110' }), 1, { reps: '5', loadKg: '102,5' });
    const [rec] = strengthRecordsFor(d);
    expect(rec.kg).toBe(Math.max(estimateOneRepMax(110, 3)!, estimateOneRepMax(102.5, 5)!, estimateOneRepMax(100, 5)!));
    expect(rec).toMatchObject({ label: 'Back Squat', kg: 121, movement: 'Back Squat', set_index: 1 });
  });

  it('une séance validée l’emporte sur une copie locale', async () => {
    mockDb.offline = true;
    await saveStrengthDraft(draftParams(edit(prescription(), 0, { loadKg: '60' })));
    mockDb.offline = false;
    await submitStrengthValidation({ userId: 'u1', sourceType: 'whiteboard', sourceId: 'wod-1', sourceTitle: null, drafts: prescription(), rx: true }, jest.fn());
    await saveStrengthDraft(draftParams(edit(prescription(), 0, { loadKg: '60' })));
    expect(mockDb.strength_set_logs.find(r => r.set_index === 1)?.load_kg).toBe(100);
  });

  it('lit le code métier d’une erreur de validation', () => {
    expect(validationErrorCode({ message: 'SEANCE_VIDE: aucune série valide' })).toBe('SEANCE_VIDE');
    expect(validationErrorCode({ message: 'TypeError: Network request failed' })).toBeNull();
  });
});

describe('saisie et affichage', () => {
  it('accepte la virgule et le point : 102,5 → 102.5', () => {
    expect(normalizeDecimalInput('102,5')).toBe('102.5');
    expect(normalizeDecimalInput('102.5')).toBe('102.5');
    expect(normalizeDecimalInput('1,2,5')).toBe('1.25');
    expect(parseDecimal('102,5')).toBe(102.5);
  });

  it('compte n / N séries valides et date le dernier enregistrement', () => {
    expect(strengthProgress(edit(prescription(), 0, { reps: '' }))).toEqual({ done: 2, total: 3 });
    const now = Date.parse('2026-09-28T12:00:00Z');
    expect(savedAgo('2026-09-28T11:59:30Z', now)).toEqual({ key: 'justNow', count: 0 });
    expect(savedAgo('2026-09-28T11:55:00Z', now)).toEqual({ key: 'minutes', count: 5 });
    expect(savedAgo('2026-09-28T09:00:00Z', now)).toEqual({ key: 'hours', count: 3 });
  });
});

describe('écran Whiteboard (lecture du source)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'screens', 'whiteboard', 'WODDetailScreen.tsx'), 'utf8');
  const fn = (name: string) => src.slice(src.indexOf(`function ${name}`), src.indexOf('\n  }\n', src.indexOf(`function ${name}`)));

  it('compteurs et crédit ne partent que depuis le rappel de première validation', () => {
    const v = fn('validateStrength');
    expect(v).toMatch(/submitStrengthValidation\([\s\S]*?async r => \{\s*first = true;\s*await creditScoreSubmission\(r\.maxLoadKg, 'weight'\);/);
    expect(v.match(/creditScoreSubmission\(/g)).toHaveLength(1);
    expect(v).not.toMatch(/incrementCounter|logMovementReps|recordStrengthPRs/);
    expect(v).toContain('refreshScoresAfterSubmit(first)');
    const save = src.slice(src.indexOf('const saveDraftNow'), src.indexOf('// Chargement : séance'));
    expect(save).not.toMatch(/creditScoreSubmission|incrementCounter|rpc\(/);
  });

  it('pas de champ POIDS pour une séance de musculation : charge max calculée', () => {
    expect(src).toMatch(/\{isStrengthSession \? \(\s*<StrengthMaxLoadRow maxLoadKg=\{computedMaxLoad\(strengthDrafts\)\} \/>/);
    expect(src).toMatch(/variant="accent"[\s\S]{0,120}strengthSession\.validate/);
    expect(src).toMatch(/variant="outline"\s*label=\{i18n\.t\('strengthSession\.saveLater'\)\}/);
    expect(src).toMatch(/variant="outline"\s*label=\{i18n\.t\('strengthSession\.editLoads'\)\}/);
  });

  it('brouillon enregistré ~0,8 s après la dernière frappe', () => {
    expect(src).toContain('export const DRAFT_SAVE_DELAY_MS = 800;');
    expect(src).toMatch(/setTimeout\(\(\) => \{ saveDraftNow\(\); \}, DRAFT_SAVE_DELAY_MS\)/);
  });
});
