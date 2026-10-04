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
  /** Refus du serveur sur l'écriture d'une table (policy, contrainte…). */
  refuse: { table: string; code: string; message: string } | null;
}
const mockDb: Db = { strength_sessions: [], strength_set_logs: [], wod_scores: [], touched: [], rpcCalls: [], offline: false, refuse: null };
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
    if (rows.some(r => r.prescribed_reps != null && !(Number(r.prescribed_reps) >= 1))) {
      return pgError('23514', 'new row for relation "strength_set_logs" violates check constraint "strength_set_logs_prescribed_reps_check"');
    }
    return null;
  };
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
      return { data: out.map(r => ({ ...r })), error: null };
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
import { parseStrengthLine, StrengthEntry } from '../utils/strengthBlock';
import {
  StrengthSetDraft, buildStrengthGrid, computedMaxLoad, loadStrengthGrid, normalizeDecimalInput,
  parseDecimal, saveStrengthDraft, savedAgo, strengthProgress, strengthRecordsFor,
  submitStrengthValidation, validationErrorCode, SaveStrengthDraftParams, StrengthSourceKey,
  gridFromServer, isNetworkError, logStrengthSets, setRanks,
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
  Object.assign(mockDb, { strength_sessions: [], strength_set_logs: [], wod_scores: [], touched: [], rpcCalls: [], offline: false, refuse: null });
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
    // G2 : chaque série porte is_added (aucune série ajoutée avant la grille de G3).
    expect((mockDb.rpcCalls[0].p_sets as Row[]).map(s => s.is_added)).toEqual([false, false]);
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

// ═══ Même mouvement dans deux blocs (build 1.0.58) ════════════════════════════
// Les deux séances réelles de Nab du 30/09. Chaque bloc numérotait ses séries à
// partir de 1 : brouillon refusé (21000) mais affiché « hors connexion », puis
// saisie remplacée par une grille vide, validation refusée (SERIES_EN_DOUBLE).
const cells = (d: StrengthSetDraft[]) => d.map(x => `${x.reps}x${x.loadKg}`);
const PENDING_KEY = '@athlex:strengthDraft:u1:whiteboard:wod-1';

describe('même mouvement dans deux blocs', () => {
  const entries = (lines: string[]): StrengthEntry[] =>
    lines.map(parseStrengthLine).filter((e): e is StrengthEntry => e !== null);
  const FRONT_SQUAT = entries([
    'Front Squat — 2 × 3 @ 65 %1RM — tempo 1" pause en bas',
    'Front Squat — 2 × 2 @ 75 %1RM — tempo 2" pause en bas',
  ]);
  const COMPLEXE = entries(['Complexe — 5 × 1 @ 60 %1RM', 'Complexe — 5 × 1 @ 60 %1RM']);
  const oneRm = (name: string) => (name === 'Front Squat' ? 100 : null);
  const fsGrid = () => buildStrengthGrid(FRONT_SQUAT, oneRm);
  /** Ce que Nab tape : chaque série a sa charge (bloc 1 : 60, 62,5 ; bloc 2 : 72,5, 75). */
  const fsTyped = () => fsGrid().map((d, i) => ({ ...d, loadKg: ['60', '62.5', '72.5', '75'][i] }));
  /** La même grille numérotée par bloc, comme la 1.0.58. */
  const perBlock = () => fsTyped().map(d => ({ ...d, setIndex: d.entryIndex === 0 ? d.setIndex : d.setIndex - 2 }));
  const stored = () => mockDb.strength_set_logs
    .map(r => `${r.movement}#${r.set_index}:${r.reps}x${r.load_kg}`).sort();
  const FS_STORED = ['Front Squat#1:3x60', 'Front Squat#2:3x62.5', 'Front Squat#3:2x72.5', 'Front Squat#4:2x75'];

  it('numéro de stockage continu par mouvement, rang affiché dans le bloc', () => {
    expect(FRONT_SQUAT).toHaveLength(2);
    const g = fsGrid();
    expect(g.map(d => [d.entryIndex, d.setIndex, d.reps, d.loadKg])).toEqual([
      [0, 1, '3', '65'], [0, 2, '3', '65'], [1, 3, '2', '75'], [1, 4, '2', '75'],
    ]);
    expect(setRanks(g)).toEqual([1, 2, 1, 2]);
    const c = buildStrengthGrid(COMPLEXE, oneRm);
    expect(c.map(d => d.setIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(setRanks(c)).toEqual([1, 2, 3, 4, 5, 1, 2, 3, 4, 5]);
  });

  it('plafond de 50 séries par mouvement (CHECK set_index ≤ 50)', () => {
    const g = buildStrengthGrid(entries(['Back Squat — 30 × 1 @ 50kg', 'Back Squat — 30 × 1 @ 60kg']), () => null);
    expect(g).toHaveLength(50);
    expect(Math.max(...g.map(d => d.setIndex))).toBe(50);
  });

  it('brouillon : chaque série est enregistrée, aucune n’est prise pour une autre', async () => {
    const res = await saveStrengthDraft(draftParams(fsTyped()));
    expect(res.status).toBe('saved');
    expect(stored()).toEqual(FS_STORED);
    expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('Complexe 5 × 1 deux fois : les 10 séries partent et se relisent', async () => {
    const typed = buildStrengthGrid(COMPLEXE, oneRm).map((d, i) => ({ ...d, loadKg: String(40 + i * 2.5) }));
    expect((await saveStrengthDraft(draftParams(typed))).status).toBe('saved');
    expect(mockDb.strength_set_logs).toHaveLength(10);
    await AsyncStorage.clear();
    const loaded = await loadStrengthGrid(KEY, buildStrengthGrid(COMPLEXE, oneRm));
    expect(cells(loaded.drafts)).toEqual(cells(typed));
  });

  it('rechargement sur un autre appareil : chaque bloc retrouve SES valeurs', async () => {
    await saveStrengthDraft(draftParams(fsTyped()));
    await AsyncStorage.clear();
    const loaded = await loadStrengthGrid(KEY, fsGrid());
    expect(loaded.origin).toBe('server');
    expect(cells(loaded.drafts)).toEqual(['3x60', '3x62.5', '2x72.5', '2x75']);
    expect(loaded.drafts.map(d => d.entryIndex)).toEqual([0, 0, 1, 1]);
  });

  it('validation : 4 séries, charge max du bloc 2, record prouvé par sa propre série', async () => {
    const r = await validate(fsTyped());
    expect(r).toMatchObject({ premiereValidation: true, maxLoadKg: 75, seriesValides: 4 });
    expect((mockDb.rpcCalls[0].p_sets as Row[]).map(x => [x.set_index, x.reps, x.load_kg]))
      .toEqual([[1, 3, 60], [2, 3, 62.5], [3, 2, 72.5], [4, 2, 75]]);
    const [rec] = strengthRecordsFor(fsTyped());
    expect(rec).toMatchObject({ movement: 'Front Squat', set_index: 4, kg: estimateOneRepMax(75, 2) });
  });

  it('modification après validation : seule la série corrigée change', async () => {
    await validate(fsTyped());
    const r = await validate(edit(fsTyped(), 3, { loadKg: '77,5' }));
    expect(r).toMatchObject({ premiereValidation: false, maxLoadKg: 77.5, seriesValides: 4 });
    expect(stored()).toEqual([...FS_STORED.slice(0, 3), 'Front Squat#4:2x77.5']);
    const reloaded = gridFromServer(fsGrid(), mockDb.strength_set_logs as never);
    expect(cells(reloaded)).toEqual(['3x60', '3x62.5', '2x72.5', '2x77.5']);
  });

  it('copie locale laissée par la 1.0.58 (1, 2, 1, 2) : relue, renumérotée, enregistrée sans perte', async () => {
    expect(perBlock().map(d => d.setIndex)).toEqual([1, 2, 1, 2]);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ drafts: perBlock(), editedAt: new Date().toISOString(), baseUpdatedAt: null }));
    const loaded = await loadStrengthGrid(KEY, fsGrid());
    expect(loaded.origin).toBe('local');
    expect(loaded.drafts.map(d => d.setIndex)).toEqual([1, 2, 3, 4]);
    expect(cells(loaded.drafts)).toEqual(['3x60', '3x62.5', '2x72.5', '2x75']);
    expect((await saveStrengthDraft(draftParams(loaded.drafts))).status).toBe('saved');
    expect(stored()).toEqual(FS_STORED);
  });

  it('une grille encore numérotée par bloc est renumérotée avant toute écriture (brouillon, validation, ancien journal)', async () => {
    expect((await saveStrengthDraft(draftParams(perBlock()))).status).toBe('saved');
    expect(stored()).toEqual(FS_STORED);
    await validate(perBlock());
    expect(stored()).toEqual(FS_STORED);
    Object.assign(mockDb, { strength_sessions: [], strength_set_logs: [] });
    const performed = await logStrengthSets({ userId: 'u1', sourceType: 'whiteboard', sourceId: 'wod-1', sourceTitle: 'FS', drafts: perBlock() });
    expect(performed).toHaveLength(4);
    expect(stored()).toEqual(FS_STORED);
  });
});

describe('refus du serveur ≠ hors connexion', () => {
  const REFUS = { table: 'strength_set_logs', code: '42501', message: 'new row violates row-level security policy for table "strength_set_logs"' };

  it('une erreur de la base n’est jamais classée hors connexion ; une coupure réseau, si', () => {
    expect(isNetworkError({ code: '', message: 'TypeError: Network request failed' })).toBe(true);
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    for (const code of ['21000', '42501', '23514', '22023', 'PGRST116']) expect(isNetworkError({ code, message: 'x' })).toBe(false);
  });

  it('refus : statut refused avec son code, saisie gardée sur le téléphone', async () => {
    mockDb.refuse = REFUS;
    const res = await saveStrengthDraft(draftParams(edit(prescription(), 0, { loadKg: '110' })));
    expect(res).toMatchObject({ status: 'refused', code: '42501' });
    expect(JSON.parse((await AsyncStorage.getItem(PENDING_KEY))!).drafts[0].loadKg).toBe('110');
  });

  it('coupure réseau : toujours offline', async () => {
    mockDb.offline = true;
    expect((await saveStrengthDraft(draftParams(prescription()))).status).toBe('offline');
  });

  it('lecture refusée à la réouverture : refused, jamais offline', async () => {
    mockDb.refuse = null;
    const spy = jest.spyOn(supabase, 'from').mockImplementationOnce(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } }) }) }) }) }),
    }) as never);
    const loaded = await loadStrengthGrid(KEY, prescription());
    spy.mockRestore();
    expect(loaded).toMatchObject({ offline: false, refused: true, origin: 'prescription' });
  });

  it('la séance écrite avant l’échec des séries ne se fait pas passer pour un autre appareil : rien n’est écrasé', async () => {
    const editedAt = new Date(Date.now() - 5000).toISOString();
    const typed = edit(edit(prescription(), 0, { loadKg: '110' }), 1, { loadKg: '112,5' });
    mockDb.refuse = REFUS;
    const first = await saveStrengthDraft(draftParams(typed, { editedAt }));
    expect(first.status).toBe('refused');
    const written = mockDb.strength_sessions[0].updated_at as string;
    expect(first.status === 'refused' ? first.baseUpdatedAt : null).toBe(written);

    // Réouverture : la copie locale l'emporte (elle repose sur la séance qu'elle a écrite).
    const reopened = await loadStrengthGrid(KEY, prescription());
    expect(reopened.origin).toBe('local');
    expect(cells(reopened.drafts)).toEqual(['5x110', '5x112,5', '5x100']);

    // Nouvel essai à partir de la version rendue : enregistré, pas « serveur plus récent ».
    mockDb.refuse = null;
    const base = first.status === 'refused' ? first.baseUpdatedAt : null;
    const again = await saveStrengthDraft(draftParams(typed, { editedAt, baseUpdatedAt: base }));
    expect(again.status).toBe('saved');
    expect(mockDb.strength_set_logs.map(r => r.load_kg)).toEqual([110, 112.5, 100]);
  });

  it('écrans : un refus ne lance pas la boucle de nouvel essai, et la validation l’affiche comme un refus', () => {
    for (const file of [['whiteboard', 'WODDetailScreen.tsx'], ['wod', 'WodResultScreen.tsx']]) {
      const src = fs.readFileSync(path.join(__dirname, '..', 'screens', ...file), 'utf8');
      expect(src).toMatch(/if \(draftSaveState !== 'offline'\) return undefined;/);
      expect(src).toContain('baseUpdatedAtRef.current = res.baseUpdatedAt;');
      expect(src).toContain('else if (res.refused) setDraftSaveState(\'refused\');');
      expect(src).toMatch(/isNetworkError\(e\)/);
      expect(src).toContain("i18n.t('strengthSession.refused')");
    }
  });
});

describe('gymnastique « % du max » sans record : prescribed_reps jamais à 0', () => {
  // Reps prévues inconnues (0 dans la grille) : la base n'accepte que NULL ou ≥ 1.
  const gymDrafts = () => {
    const grid = buildStrengthGrid([parseStrengthLine('Toes to Bar — 2 × 60 % du max')!], () => null, () => null);
    expect(grid.map(d => d.prescribedReps)).toEqual([0, 0]);
    return edit(edit(grid, 0, { reps: '10', loadKg: '5' }), 1, { reps: '8', loadKg: '5' });
  };
  const prescribed = () => mockDb.strength_set_logs.map(r => r.prescribed_reps);

  it('journal (logStrengthSets) : série chargée envoyée avec prescribed_reps null', async () => {
    const performed = await logStrengthSets({ userId: 'u1', sourceType: 'whiteboard', sourceId: 'wod-1', sourceTitle: 'Gym', drafts: gymDrafts() });
    expect(performed).toHaveLength(2);
    expect(prescribed()).toEqual([null, null]);
  });

  it('brouillon et validation : même règle', async () => {
    expect((await saveStrengthDraft(draftParams(gymDrafts()))).status).toBe('saved');
    expect(prescribed()).toEqual([null, null]);
    await validate(gymDrafts());
    expect(prescribed()).toEqual([null, null]);
  });
});

describe('G2 : load_required, une série sans charge sur une ligne chargée ne vaut rien', () => {
  const ligne = (l: string) => buildStrengthGrid([parseStrengthLine(l)!], () => null, () => null);

  it('posé sur toute ligne prescrite avec une charge, même inconnue ; pas sur « % du max » ni sans charge', () => {
    expect(ligne('Back Squat — 5 × 3 @ 80 %1RM').map(d => [d.prescribedLoadKg, d.loadRequired])).toEqual(Array(5).fill([null, true]));
    expect(ligne('Back Squat — 2 × 3 @ 100 kg').map(d => d.loadRequired)).toEqual([true, true]);
    expect(ligne('Back Squat — 2 × 3 — charge RPE 8').map(d => d.loadRequired)).toEqual([true, true]);
    expect(ligne('Ring Muscle-up — 2 × 15 % du max').map(d => d.loadRequired)).toEqual([false, false]);
    expect(ligne('Pull-ups — 2 × 8').map(d => d.loadRequired)).toEqual([false, false]);
  });

  it('envoyé dans p_sets avec chaque série', async () => {
    const d = edit(ligne('Back Squat — 2 × 3 @ 80 %1RM'), 0, { loadKg: '100' });
    await validate(edit(d, 1, { loadKg: '100' }));
    expect((mockDb.rpcCalls[0].p_sets as Row[]).map(s => s.load_required)).toEqual([true, true]);
  });
});
