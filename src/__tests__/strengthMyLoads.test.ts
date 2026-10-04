/**
 * Musculation PR 4 : états des séances pour les cartes de Ma Box (lecture
 * groupée pour la semaine), bloc « Mes charges » (écart, tonnage) et
 * « Modifier mes charges ». Faux client Supabase en mémoire : jamais la vraie base.
 */
import fs from 'fs';
import path from 'path';

type Row = Record<string, unknown>;
interface Call { table: string; filters: [string, unknown][]; inIds: unknown[] | null }
const mockDb: { strength_sessions: Row[]; strength_set_logs: Row[]; calls: Call[] } = {
  strength_sessions: [], strength_set_logs: [], calls: [],
};

jest.mock('../lib/supabase', () => {
  class Q {
    filters: [string, unknown][] = [];
    inIds: unknown[] | null = null;
    constructor(public table: 'strength_sessions' | 'strength_set_logs') {}
    select() { return this; }
    eq(k: string, v: unknown) { this.filters.push([k, v]); return this; }
    in(k: string, v: unknown[]) { if (k === 'source_id') this.inIds = v; return this; }
    then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
      mockDb.calls.push({ table: this.table, filters: this.filters, inIds: this.inIds });
      const data = (mockDb[this.table] as Row[])
        .filter(r => this.filters.every(([k, v]) => r[k] === v))
        .filter(r => !this.inIds || this.inIds.includes(r.source_id));
      return Promise.resolve({ data, error: null }).then(res, rej);
    }
  }
  return { supabase: { from: (t: 'strength_sessions' | 'strength_set_logs') => new Q(t) } };
});
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

import {
  fetchStrengthSummaries, strengthSetDeviation, strengthTonnage, StrengthSetDraft,
} from '../services/strengthSets';

const U = 'user-1';
const session = (source_id: string, status: string, planned_sets: number): Row => ({
  user_id: U, source_type: 'whiteboard', source_id, status, planned_sets,
});
const set = (source_id: string, reps: number | null, load_kg: number | null, prescribed_load_kg: number | null = 100): Row => ({
  user_id: U, source_type: 'whiteboard', source_id, reps, load_kg, prescribed_load_kg,
});
const draft = (setIndex: number, reps: string, loadKg: string, prescribedReps = 7, prescribedLoadKg: number | null = 100): StrengthSetDraft => ({
  entryIndex: 0, setIndex, name: 'Back Squat', reps, loadKg, prescribedReps, prescribedLoadKg,
});

beforeEach(() => {
  mockDb.strength_sessions = [];
  mockDb.strength_set_logs = [];
  mockDb.calls = [];
});

describe('cartes de Ma Box : états des séances de la semaine', () => {
  beforeEach(() => {
    mockDb.strength_sessions = [session('w-draft', 'draft', 5), session('w-done', 'validated', 3),
      { ...session('w-other', 'draft', 2), user_id: 'autre' }];
    mockDb.strength_set_logs = [
      set('w-draft', 5, 100), set('w-draft', 5, 102.5), set('w-draft', 5, null), set('w-draft', null, 80),
      // G3 : série sans charge d'une ligne sans charge prévue (gymnastique) : elle compte.
      set('w-draft', 8, null, null),
      set('w-done', 3, 120), set('w-done', 3, 120), set('w-done', 3, 125),
    ];
  });

  it('brouillon « n / N » (séries valides sur séries prévues), validée, sans séance : rien', async () => {
    const r = await fetchStrengthSummaries(U, 'whiteboard', ['w-draft', 'w-done', 'w-none', 'w-other']);
    expect(r).toEqual({
      'w-draft': { status: 'draft', done: 3, total: 5 },
      'w-done': { status: 'validated', done: 3, total: 3 },
    });
  });

  it('une seule lecture groupée pour toute la semaine, quel que soit le nombre de cartes', async () => {
    const ids = Array.from({ length: 7 }, (_, i) => `w-${i}`).concat('w-draft', 'w-done');
    await fetchStrengthSummaries(U, 'whiteboard', ids);
    expect(mockDb.calls.map(c => c.table).sort()).toEqual(['strength_sessions', 'strength_set_logs']);
    for (const c of mockDb.calls) {
      expect(c.inIds).toEqual(ids);
      expect(c.filters).toEqual(expect.arrayContaining([['user_id', U], ['source_type', 'whiteboard']]));
    }
  });

  it('semaine sans WOD de musculation : aucune requête', async () => {
    expect(await fetchStrengthSummaries(U, 'whiteboard', [])).toEqual({});
    expect(mockDb.calls).toHaveLength(0);
  });

  it('l’écran lit les états une fois pour la semaine (pas dans la boucle des cartes)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../screens/whiteboard/WhiteboardScreen.tsx'), 'utf8');
    expect(src.match(/fetchStrengthSummaries\(/g)).toHaveLength(1);
    const q = src.indexOf('fetchStrengthSummaries(');
    const cards = src.indexOf('shownWODs.map(');
    expect(q).toBeGreaterThan(-1);
    expect(q).toBeLessThan(cards);
    expect(src).toContain("select('id, track, wod_type')");
    expect(src).toContain("filter(r => r.wod_type === 'strength')");
    expect(src).toContain('<StrengthWodCardStatus summary={strengthByWod?.[wod.id]} />');
    expect(src).toContain('t(strengthCardLinkKey(strengthByWod?.[wod.id]))');
  });
});

describe('Mes charges : écart et tonnage', () => {
  it('écart en reps et en charge, rien quand la série suit la prescription', () => {
    expect(strengthSetDeviation(draft(1, '6', '100'))).toEqual({ reps: { done: 6, planned: 7 }, loadKg: null });
    expect(strengthSetDeviation(draft(2, '7', '102.5'))).toEqual({ reps: null, loadKg: { done: 102.5, planned: 100 } });
    expect(strengthSetDeviation(draft(3, '7', '100'))).toEqual({ reps: null, loadKg: null });
    expect(strengthSetDeviation(draft(4, '5', '60', 0, null))).toEqual({ reps: null, loadKg: null });
  });

  it('tonnage = somme reps × charge des séries valides seulement', () => {
    expect(strengthTonnage([draft(1, '6', '100'), draft(2, '7', '102.5'), draft(3, '', '100'), draft(4, '5', '')]))
      .toBe(6 * 100 + 7 * 102.5);
  });
});

describe('« Modifier mes charges »', () => {
  const src = fs.readFileSync(path.join(__dirname, '../screens/whiteboard/WODDetailScreen.tsx'), 'utf8');

  it('le bloc s’affiche sur une séance validée et ouvre la saisie pré-remplie de ses charges', () => {
    expect(src).toMatch(/\{isStrengthSession && strengthValidated && \(\s*<View[^>]*>[\s\S]{0,600}?<StrengthMyLoadsCard\s+drafts=\{strengthDrafts\}/);
    const block = src.slice(src.indexOf('<StrengthMyLoadsCard'), src.indexOf('<StrengthMyLoadsCard') + 900);
    // G3 : « Modifier mes séries » quand la séance a des lignes en reps seules.
    expect(block).toMatch(/variant="outline"\s*label=\{i18n\.t\(strengthDrafts\.some\(isRepsOnly\) \? 'strengthSession\.editSets' : 'strengthSession\.editLoads'\)\}\s*onPress=\{openEditModal\}/);
    // La saisie d'une séance serveur garde la grille relue du serveur : pas de
    // retour à la prescription à l'ouverture.
    expect(src).toMatch(/const prefillStrengthLoads = useCallback\(\(\) => \{\s*if \(isStrengthSession\) return;/);
    expect(src).toMatch(/function openEditModal\(\) \{\s*prefillStrengthLoads\(\);/);
  });

  it('le bloc est au-dessus de la saisie', () => {
    expect(src.indexOf('<StrengthMyLoadsCard')).toBeGreaterThan(-1);
    expect(src.indexOf('<StrengthMyLoadsCard')).toBeLessThan(src.indexOf('<StrengthSetGrid'));
  });
});
