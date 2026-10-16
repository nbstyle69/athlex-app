/**
 * Moteur M5 (#529) — Whiteboard, détail de WOD, programme et historique montés avec le vrai
 * react-native, app en français puis en anglais. Lignes fabriquées par le moteur lui-même
 * (« Ajouter au Whiteboard », séance de box) et une ligne du Manager (v1, titre humain).
 *
 * Affichage : français = texte enregistré ; anglais = rendu du moteur, sauf la ligne du Manager.
 * Règle 2 : score, max, reps de badge, grille de force et écritures (wod_scores, strength_set_logs
 * avec source_title) identiques en français et en anglais, sur le texte enregistré.
 * Données fictives, aucun réseau.
 */
import React from 'react';
import { Alert, Share } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../i18n';
import WhiteboardScreen from '../screens/whiteboard/WhiteboardScreen';
import WODDetailScreen from '../screens/whiteboard/WODDetailScreen';
import ProgramDetailScreen from '../screens/programs/ProgramDetailScreen';
import WodHistoryScreen from '../screens/wod/WodHistoryScreen';
import { whiteboardRows } from '../services/wodGenerator';
import { displayStimulusNote } from '../services/wodRender';
import { CHEMINS } from '../../packages/wod-engine/__tests__/instantane/chemins';
import {
  BANK_V1, CATALOG_SNAPSHOT, exerciseLine, generateBlocC, generateMuscu, renderFromWodJson,
} from '../../packages/wod-engine/src';
import type { GeneratedWeek, GeneratedWod, MuscuWod } from '../../packages/wod-engine/src';

const mockNavigate = jest.fn();
let mockRouteParams: Record<string, unknown> | undefined;
const mockTables: Record<string, unknown[]> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];
const mockTimerOpen: string[] = [];
const mockProgram: { wods: unknown[] } = { wods: [] };

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true, setOptions: jest.fn() }),
    useRoute: () => ({ params: mockRouteParams }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(83),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
const BOX = { id: 'box-1', name: 'Box fictive', owner_id: 'u9', logo_url: null, slug: 'box-fictive' };
const mockAuth = { user: { id: 'me', username: 'Moi', avatar_url: null, gender: 'male' }, currentBox: BOX, boxRole: 'member', joinBox: jest.fn() };
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').darkTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let sel = '';
    let perso = false;
    const b: Record<string, unknown> = {};
    const rows = () => (perso ? mockTables[`${table}|perso`] ?? [] : mockTables[`${table}|${sel}`] ?? mockTables[table] ?? []) as unknown[];
    for (const m of ['select', 'eq', 'gte', 'lte', 'gt', 'order', 'limit', 'in', 'or', 'is', 'not', 'contains', 'update', 'delete', 'insert', 'upsert']) {
      b[m] = (...args: unknown[]) => {
        mockCalls.push({ table, method: m, args });
        if (m === 'select' && !sel) sel = String(args[0]);
        if (m === 'is' && args[0] === 'box_id' && args[1] === null) perso = true;
        return b;
      };
    }
    const one = () => ({ then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows()[0] ?? null, error: null }).then(res) });
    b.single = one;
    b.maybeSingle = one;
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows(), count: rows().length, error: null }).then(res);
    return b;
  };
  const channel = () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; };
  return { supabase: { from: (t: string) => builder(t), channel, removeChannel: jest.fn(), rpc: jest.fn(async () => ({ data: null, error: null })) } };
});
jest.mock('../services/membership', () => ({ ...jest.requireActual('../services/membership'), getMyPlanStatus: async () => null }));
jest.mock('../lib/unreadMessages', () => ({ countUnreadMessages: jest.fn(async () => 0) }));
jest.mock('../lib/analytics', () => ({ trackScoreSubmit: jest.fn() }));
jest.mock('../services/notifications', () => ({
  sendScoreNotification: jest.fn(async () => {}), sendScoreOvertakenNotification: jest.fn(async () => {}), cancelTodayScoreReminder: jest.fn(async () => {}),
}));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}), logMovementReps: jest.fn(async () => {}), recordActivity: jest.fn(async () => {}) }));
jest.mock('../services/programContent', () => ({
  listProgramWods: async () => mockProgram.wods,
  listProgramRestDays: async () => [],
  setProgramStartDate: jest.fn(),
  listProgramWodsByProgram: async () => ({ p1: mockProgram.wods }),
  listProgramRestDaysByProgram: async () => ({}),
}));
jest.mock('../services/eloCompute', () => ({ computeAndSaveElo: jest.fn(async () => {}), sortScoresRxFirst: (s: unknown[]) => s }));
jest.mock('../services/strengthPR', () => ({ recordStrengthPRs: jest.fn(async () => []) }));
jest.mock('../utils/eloLevels', () => ({ syncLevelAndBadges: jest.fn(async () => []) }));
// Un 1RM connu partout : les annotations ≈ kg s'affichent, les charges de la grille se calculent.
jest.mock('../hooks/useMyOneRepMax', () => {
  const rm = () => 100;
  const none = () => null;
  return { useMyOneRepMax: () => rm, useMyRecords: () => ({ oneRepMaxFor: rm, gymRecordFor: none, reload: () => {} }) };
});
jest.mock('../services/strengthSets', () => {
  const actual = jest.requireActual('../services/strengthSets');
  return {
    ...actual,
    fetchStrengthSummaries: jest.fn(async () => ({})),
    loadStrengthGrid: jest.fn(async (_k: unknown, prescription: unknown[]) => ({ drafts: prescription, origin: 'prescription', server: null, pending: null, offline: false })),
    saveStrengthDraft: jest.fn(async () => ({ status: 'saved', updatedAt: '2026-09-28T10:00:00Z' })),
    submitStrengthValidation: jest.fn(),
    fetchStrengthSession: jest.fn(async () => ({ session: null, sets: [] })),
  };
});
jest.mock('../components/wod/TimerLaunchModal', () => (p: { visible: boolean; title: string }) => {
  if (p.visible) mockTimerOpen.push(p.title);
  return null;
});
jest.mock('../components/ReportMenu', () => () => null);
jest.mock('../components/ShareScoreCard', () => () => null);
jest.mock('react-native-webview', () => 'WebView');
jest.mock('react-native-view-shot', () => 'ViewShot');
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn(async () => true) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const gamification = require('../services/gamification') as { logMovementReps: jest.Mock; incrementCounter: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const strengthSets = require('../services/strengthSets') as { loadStrengthGrid: jest.Mock };

const NOW = new Date('2026-09-28T10:00:00Z');
const TODAY = '2026-09-28';

// ─── Lignes du moteur, écrites exactement comme l'app et la programmation les écrivent ─────
const METCON: GeneratedWod = generateBlocC({ entry: 'express', discipline: 'functional', budget_min: 15, intention: 'mixed', format: 'amrap' }, CATALOG_SNAPSHOT, BANK_V1, 11);
const MUSCU: MuscuWod = generateMuscu({ entry: 'express', target: 'pull', objective: 'force', budget_min: 45, equipment: 'gym', level: 'debutant' }, CATALOG_SNAPSHOT, BANK_V1, 5);
const meta = { box_id: 'box-1', scheduled_date: TODAY, is_published: true, leaderboard_enabled: true, video_url: null, track: 'functional' };
const BOX_METCON = { ...whiteboardRows(METCON)[0], ...meta, id: 'wM' } as Record<string, any>;
const PERSO_MUSCU = { ...whiteboardRows(MUSCU)[0], id: 'wX0', box_id: null, created_by: 'me', scheduled_date: TODAY } as Record<string, any>;
const MANAGER = {
  id: 'wG', ...meta, title: 'Murph du coach', description: '1 mile run\n100 pull-ups\n1 mile run', notes: 'Gilet conseillé',
  wod_type: 'for-time', block_name: 'wod', sort_order: 1, wod_json: { version: 1, source: 'manager', movements: [] },
};
/** Bloc de force d'une séance de la programmation (lignes %1RM : ≈ kg). */
let FORCE: Record<string, any>;

const EN = (row: { wod_json: unknown }) => renderFromWodJson(row.wod_json, 'en')!;

beforeAll(async () => {
  const seance = CHEMINS.find((c) => c.nom === 'seance-functional')!;
  for (let k = 0; k < 50 && !FORCE; k++) {
    const { sortie } = await seance.produire(k, 'fr');
    const b = (sortie as GeneratedWeek).sessions?.flatMap((s) => s.blocks).find((x) => x.wod_type === 'strength' && /%1RM/.test(x.description));
    if (b) FORCE = { ...meta, id: 'wF', title: b.title, description: b.description, notes: b.notes, wod_type: b.wod_type, block_name: b.block_name, sort_order: 2, wod_json: b.wod_json };
  }
  expect(FORCE).toBeDefined();
}, 120_000);

let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockRouteParams = undefined;
  mockProgram.wods = [];
  mockTables['box_wods|id, track, wod_type'] = [BOX_METCON, MANAGER].map(({ id, track, wod_type }) => ({ id, track, wod_type }));
  mockTables['box_wods|*'] = [BOX_METCON, MANAGER];
  mockTables['box_wods|perso'] = [PERSO_MUSCU];
  mockTables.wod_scores = [];
  mockTables.wod_completions = [];
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  await i18n.changeLanguage('fr');
  jest.useRealTimers();
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockTimerOpen.length = 0;
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
const hostText = (n: ReactTestInstance): string => n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
const texts = (root: ReactTestInstance) => root.findAll(isHostText).map(hostText);
async function settle() {
  for (let i = 0; i < 12; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
async function mount(el: React.ReactElement, langue: 'fr' | 'en') {
  await act(async () => { await i18n.changeLanguage(langue); });
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>{el}</QueryClientProvider>,
    );
  });
  await settle();
  return renderer.root;
}
async function remount(el: () => React.ReactElement, langue: 'fr' | 'en') {
  if (renderer) await act(async () => renderer.unmount());
  return mount(el(), langue);
}
const byID = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`testID appuyable introuvable : ${id}`);
  await act(async () => { n.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
const detail = (wod: Record<string, unknown>) => () => {
  mockTables['box_wods|*'] = [wod];
  mockRouteParams = { wodId: wod.id };
  return <WODDetailScreen />;
};

describe('les lignes du moteur sont bien rendues en anglais (sinon les tests ci-dessous ne prouvent rien)', () => {
  it('description et notes anglaises différentes du français (le titre d’un metcon n’a que des noms) ; Musculation : ligne anglaise', () => {
    for (const r of [BOX_METCON, FORCE]) expect(EN(r).description).not.toBe(r.description);
    expect(displayStimulusNote(METCON, 'en')).not.toBe(BOX_METCON.notes);
    expect(EN(FORCE).title).not.toBe(FORCE.title);
    expect(exerciseLine(MUSCU.blocks[0].exercises[0], 'en')).not.toBe(PERSO_MUSCU.description);
  });
});

describe('Whiteboard', () => {
  it('français : texte enregistré ; anglais : rendu du moteur, sauf le WOD du Manager', async () => {
    let t = texts(await mount(<WhiteboardScreen />, 'fr'));
    for (const s of [BOX_METCON.title, PERSO_MUSCU.title, PERSO_MUSCU.description, MANAGER.title, MANAGER.description]) expect(t).toContain(s);
    expect(t).toContain(BOX_METCON.description);

    t = texts(await remount(() => <WhiteboardScreen />, 'en'));
    expect(t).toContain(EN(BOX_METCON).title);
    expect(t).toContain(EN(BOX_METCON).description);
    expect(t).not.toContain(BOX_METCON.description);
    expect(t).toContain(exerciseLine(MUSCU.blocks[0].exercises[0], 'en'));
    expect(t).not.toContain(PERSO_MUSCU.description);
    expect(t).toContain(MANAGER.title);
    expect(t).toContain(MANAGER.description);
  });

  it('minuteur : le titre affiché, dans la langue de l’app ; Manager inchangé', async () => {
    mockTables['box_wods|*'] = [FORCE, MANAGER];
    mockTables['box_wods|id, track, wod_type'] = [FORCE, MANAGER].map(({ id, track, wod_type }) => ({ id, track, wod_type }));
    let root = await mount(<WhiteboardScreen />, 'fr');
    await press(root, `wod-timer-${FORCE.id}`);
    root = await remount(() => <WhiteboardScreen />, 'en');
    await press(root, `wod-timer-${FORCE.id}`);
    await press(root, `wod-timer-${MANAGER.id}`);
    expect(mockTimerOpen.filter((x, i, a) => a.indexOf(x) === i)).toEqual([FORCE.title, EN(FORCE).title, MANAGER.title]);
  });

  it('séance de programme : rendu anglais du moteur', async () => {
    mockTables.program_members = [{ program_id: 'p1', start_date: '2026-09-21', programs: { id: 'p1', title: 'Programme fictif', type: 'fixed', duration_weeks: 4, days_per_week: 5 } }];
    mockProgram.wods = [{ ...FORCE, id: 'pF', box_id: 'box-2', program_week: null, program_day: null }];
    let t = texts(await mount(<WhiteboardScreen />, 'fr'));
    expect(t).toContain(FORCE.title);
    expect(t).toContain(FORCE.description);
    t = texts(await remount(() => <WhiteboardScreen />, 'en'));
    expect(t).toContain(EN(FORCE).title);
    expect(t).toContain(EN(FORCE).description);
  });
});

describe('détail de WOD', () => {
  it('titre, description, notes, fenêtre de score et partage dans la langue de l’app', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    let root = await mount(detail(BOX_METCON)(), 'fr');
    expect(hostText(byID(root, 'wod-detail-title'))).toBe(BOX_METCON.title);
    expect(texts(root)).toContain(BOX_METCON.description);
    expect(texts(root)).toContain(BOX_METCON.notes);

    root = await remount(detail(BOX_METCON), 'en');
    expect(hostText(byID(root, 'wod-detail-title'))).toBe(EN(BOX_METCON).title);
    expect(texts(root)).toContain(EN(BOX_METCON).description);
    expect(texts(root)).toContain(displayStimulusNote(METCON, 'en'));
    expect(texts(root)).not.toContain(BOX_METCON.notes);
    await press(root, 'header-share');
    expect(share.mock.calls[0][0].message).toContain(EN(BOX_METCON).title);
    await press(root, 'enter-score');
    expect(texts(root)).toContain(EN(BOX_METCON).title);
    share.mockRestore();
  });

  it('WOD du Manager : titre, description et notes enregistrés, même en anglais', async () => {
    const root = await mount(detail(MANAGER)(), 'en');
    expect(hostText(byID(root, 'wod-detail-title'))).toBe(MANAGER.title);
    expect(texts(root)).toEqual(expect.arrayContaining([MANAGER.description, MANAGER.notes]));
  });

  it('séance de force : ≈ kg reporté sur les lignes anglaises, grille de force identique FR / EN', async () => {
    const prescriptions: unknown[] = [];
    let root = await mount(detail(FORCE)(), 'fr');
    const fr = texts(root).find((x) => x.startsWith(FORCE.description.split('\n')[0]))!;
    expect(fr).toMatch(/\(≈ [\d.]+ kg\)/);
    prescriptions.push(strengthSets.loadStrengthGrid.mock.calls.at(-1)?.[1]);
    root = await remount(detail(FORCE), 'en');
    const enLignes = EN(FORCE).description.split('\n');
    const en = texts(root).find((x) => x.startsWith(enLignes[0]))!;
    expect(en.split('\n')).toHaveLength(enLignes.length);
    expect(en.match(/\(≈ [\d.]+ kg\)/g)).toEqual(fr.match(/\(≈ [\d.]+ kg\)/g));
    expect(en).not.toContain('repos');
    prescriptions.push(strengthSets.loadStrengthGrid.mock.calls.at(-1)?.[1]);
    expect(prescriptions[0]).toBeDefined();
    expect((prescriptions[0] as unknown[]).length).toBeGreaterThan(0);
    expect(prescriptions[1]).toEqual(prescriptions[0]);
  });

  /** Envoie un score et relève tout ce qui en découle : écritures, crédit de badges, max. */
  async function envoyer(wod: Record<string, any>, langue: 'fr' | 'en', valeur: string) {
    mockCalls.length = 0;
    gamification.logMovementReps.mockClear();
    gamification.incrementCounter.mockClear();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const root = await remount(detail(wod), langue);
    await press(root, 'enter-score');
    const field = root.findAll((x) => x.props.testID === 'score-value' && String(x.type) === 'TextInput')[0];
    await act(async () => { field.props.onChangeText(valeur); });
    await press(root, 'score-submit');
    await settle();
    const ecrit = (table: string, m: string) => mockCalls.filter((c) => c.table === table && c.method === m).map((c) => c.args[0]);
    const out = {
      wod_scores: ecrit('wod_scores', 'upsert'),
      strength_set_logs: ecrit('strength_set_logs', 'upsert'),
      badges: gamification.logMovementReps.mock.calls.map((c) => c.slice(0, 4)),
      compteurs: gamification.incrementCounter.mock.calls,
      max: alert.mock.calls.map((c) => String(c[1] ?? '').match(/\d+/)?.[0] ?? null),
    };
    alert.mockRestore();
    return out;
  }

  it('règle 2 : même WOD, app FR puis EN → mêmes écritures, mêmes reps de badge, même max', async () => {
    const fr = await envoyer(BOX_METCON, 'fr', '12');
    const en = await envoyer(BOX_METCON, 'en', '12');
    expect(fr.wod_scores).toHaveLength(1);
    expect(fr.badges).toHaveLength(1);
    expect((fr.badges[0][1] as unknown[]).length).toBeGreaterThan(0);
    expect(en).toEqual(fr);
    const trop = { fr: await envoyer(BOX_METCON, 'fr', '99999'), en: await envoyer(BOX_METCON, 'en', '99999') };
    expect(trop.fr.max).toHaveLength(1);
    expect(trop.fr.max[0]).not.toBeNull();
    expect(trop.en.max).toEqual(trop.fr.max);
    expect(trop.en.wod_scores).toEqual([]);
  });

  it('règle 2 : séries de force journalisées sur le texte enregistré, source_title français en anglais', async () => {
    // Lignes de force dans un bloc qui n'est pas une séance : la grille se pré-remplit, les séries partent au score.
    const bloc = { ...FORCE, wod_type: 'amrap' };
    const fr = await envoyer(bloc, 'fr', '1');
    const en = await envoyer(bloc, 'en', '1');
    expect(fr.strength_set_logs).toHaveLength(1);
    const rows = fr.strength_set_logs[0] as Array<{ source_title: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.source_title === FORCE.title)).toBe(true);
    expect(en).toEqual(fr);
  });
});

describe('détail de programme', () => {
  const PROG_FORCE = () => ({ ...FORCE, id: 'pF', scheduled_date: null, program_week: 1, program_day: 1 });
  const PROG_MANAGER = { ...MANAGER, id: 'pG', scheduled_date: null, program_week: 1, program_day: 2 };
  const ecran = () => (
    <ProgramDetailScreen
      navigation={{ navigate: mockNavigate, goBack: jest.fn() }}
      route={{ params: { programId: 'p1', programTitle: 'Programme fictif', progType: 'fixed', durationWeeks: 4, daysPerWeek: 5, startDate: TODAY } }}
    />
  );

  it('liste et fenêtre de séance : français enregistré, anglais du moteur, Manager inchangé', async () => {
    mockProgram.wods = [PROG_FORCE(), PROG_MANAGER];
    let root = await mount(ecran(), 'fr');
    expect(texts(root)).toEqual(expect.arrayContaining([FORCE.title, FORCE.description, MANAGER.title, MANAGER.description]));
    await press(root, 'program-wod-pF');
    expect(texts(root).some((x) => x.startsWith(FORCE.description.split('\n')[0]) && /\(≈ [\d.]+ kg\)/.test(x))).toBe(true);

    root = await remount(ecran, 'en');
    expect(texts(root)).toEqual(expect.arrayContaining([EN(FORCE).title, EN(FORCE).description, MANAGER.title, MANAGER.description]));
    expect(texts(root)).not.toContain(FORCE.title);
    await press(root, 'program-wod-pF');
    const desc = texts(root).find((x) => x.startsWith(EN(FORCE).description.split('\n')[0]) && x.includes('≈'))!;
    expect(desc).toMatch(/\(≈ [\d.]+ kg\)/);
    expect(desc).not.toContain('repos');
    if (EN(FORCE).notes) expect(texts(root)).toContain(EN(FORCE).notes);
    await press(root, 'program-wod-pG');
    expect(texts(root)).toEqual(expect.arrayContaining([MANAGER.title, MANAGER.notes]));
  });
});

describe('historique', () => {
  const GEN = {
    id: 'g1', sport: METCON.discipline, wod_name: METCON.title, wod_type: METCON.wod_type, duration: METCON.budget_min, level: 'rx',
    format: METCON.format, movements: METCON.description, scoring: METCON.score_type, coach_tip: METCON.stimulus.note, team_note: null,
    equipment: [], is_favorite: false, is_benchmark: false, created_at: '2026-09-28T08:00:00Z', scores: [], wod_json: METCON,
  };
  const ref = (r: Record<string, any>) => ({ title: r.title, description: r.description, notes: r.notes, wod_json: r.wod_json, wod_type: r.wod_type, scheduled_date: TODAY });

  it('WOD générés et WOD de box : titres et mouvements dans la langue de l’app, Manager inchangé', async () => {
    mockTables.generated_wods = [GEN];
    mockTables.wod_scores = [{ id: 'b1', wod_id: 'wX0', score_value: 300, score_type: 'reps', rx: true, submitted_at: '2026-09-27T18:00:00Z', wod: ref(PERSO_MUSCU) }];
    mockTables.wod_completions = [{ id: 'c1', wod_id: 'wG', completed_at: '2026-09-26T18:00:00Z', wod: ref(MANAGER) }];
    let root = await mount(<WodHistoryScreen />, 'fr');
    expect(texts(root)).toEqual(expect.arrayContaining([METCON.title, PERSO_MUSCU.title, MANAGER.title]));
    await press(root, 'history-generated-g1');
    expect(texts(root)).toEqual(expect.arrayContaining([...METCON.description.split('\n').filter(Boolean), METCON.stimulus.note]));
    const selects = mockCalls.filter((c) => c.method === 'select' && (c.table === 'wod_scores' || c.table === 'wod_completions')).map((c) => String(c.args[0]));
    expect(selects.length).toBe(2);
    for (const s of selects) expect(s).toContain('wod:box_wods(title, description, notes, wod_json,');

    root = await remount(() => <WodHistoryScreen />, 'en');
    expect(texts(root)).toEqual(expect.arrayContaining([EN(GEN).title, PERSO_MUSCU.title, MANAGER.title]));
    await press(root, 'history-generated-g1');
    expect(texts(root)).toEqual(expect.arrayContaining([...EN(GEN).description.split('\n').filter(Boolean), displayStimulusNote(METCON, 'en')]));
    expect(texts(root)).not.toContain(METCON.stimulus.note);
  });
});
