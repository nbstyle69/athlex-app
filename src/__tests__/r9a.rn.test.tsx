/**
 * R9a : Ma Box (WhiteboardScreen) et détail du WOD (WODDetailScreen) au nouveau
 * design, montés avec le vrai react-native. Données fictives, aucun réseau.
 */
import React from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lightTheme, darkTheme } from '../theme/palette';
import BEFORE from './r9aStructureBefore.json';
import WhiteboardScreen from '../screens/whiteboard/WhiteboardScreen';
import WODDetailScreen from '../screens/whiteboard/WODDetailScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockTheme = lightTheme;
let mockRouteParams: Record<string, unknown> | undefined;
const mockTables: Record<string, unknown[]> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true, setOptions: jest.fn() }),
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
const BOX = { id: 'box-1', name: 'CrossFit Fictif', owner_id: 'u9', logo_url: null };
const mockAuth: { user: Record<string, unknown>; currentBox: typeof BOX | null; boxRole: string; joinBox: jest.Mock } = {
  user: { id: 'me', username: 'Moi', avatar_url: null },
  currentBox: BOX,
  boxRole: 'member',
  joinBox: jest.fn(async () => ({ error: null })),
};
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let sel = '';
    let perso = false;
    const b: Record<string, unknown> = {};
    const rows = () => (perso ? mockTables[`${table}|perso`] ?? [] : mockTables[`${table}|${sel}`] ?? mockTables[table] ?? []) as unknown[];
    for (const m of ['select', 'eq', 'gte', 'lte', 'gt', 'order', 'limit', 'in', 'or', 'is', 'contains', 'update', 'delete', 'insert', 'upsert']) {
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
    b.then = (res: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows(), count: rows().length, error: null }).then(res);
    return b;
  };
  const channel = () => {
    const ch = { on: () => ch, subscribe: () => ch };
    return ch;
  };
  return { supabase: { from: (t: string) => builder(t), channel, removeChannel: jest.fn(), rpc: jest.fn(async () => ({ data: null, error: null })) } };
});
jest.mock('../lib/unreadMessages', () => ({ countUnreadMessages: jest.fn(async () => 3) }));
jest.mock('../lib/analytics', () => ({ trackScoreSubmit: jest.fn() }));
jest.mock('../services/notifications', () => ({
  sendScoreNotification: jest.fn(), sendScoreOvertakenNotification: jest.fn(), cancelTodayScoreReminder: jest.fn(),
}));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn(async () => {}), recordActivity: jest.fn(async () => {}) }));
jest.mock('../services/programContent', () => ({ listProgramWodsByProgram: jest.fn(async () => ({})), listProgramRestDaysByProgram: jest.fn(async () => ({})) }));
jest.mock('../services/eloCompute', () => ({
  computeAndSaveElo: jest.fn(async () => {}),
  sortScoresRxFirst: (s: unknown[]) => s,
}));
jest.mock('../services/strengthPR', () => ({ recordStrengthPRs: jest.fn(async () => []) }));
jest.mock('../utils/eloLevels', () => ({ syncLevelAndBadges: jest.fn(async () => []) }));
jest.mock('../hooks/useMyOneRepMax', () => {
  const none = () => null;
  return { useMyOneRepMax: () => none };
});
jest.mock('../services/strengthSets', () => {
  const actual = jest.requireActual('../services/strengthSets');
  return {
    ...actual,
    fetchStrengthSummaries: jest.fn(async () => ({ wS: { status: 'draft', done: 1, total: 3 } })),
    loadStrengthGrid: jest.fn(async (_k: unknown, prescription: unknown[]) => ({ drafts: prescription, origin: 'prescription', server: null, pending: null, offline: false })),
    saveStrengthDraft: jest.fn(async () => ({ status: 'saved', updatedAt: '2026-09-28T10:00:00Z' })),
    submitStrengthValidation: jest.fn(),
    fetchStrengthSession: jest.fn(async () => ({ session: null, sets: [] })),
  };
});
jest.mock('../components/wod/TimerLaunchModal', () => () => null);
jest.mock('../components/ReportMenu', () => () => null);
jest.mock('../components/ShareScoreCard', () => () => null);
jest.mock('react-native-webview', () => 'WebView');
jest.mock('react-native-view-shot', () => 'ViewShot');
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn(async () => true) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-09-28T10:00:00');
const TODAY = '2026-09-28';
const LONG = 'Une séance au titre particulièrement long pour vérifier qu’aucun texte ne déborde à 390 points';

const WOD_AMRAP = {
  id: 'wA', box_id: 'box-1', title: LONG, description: '10 burpees\n15 wall balls', wod_type: 'amrap', block_name: 'wod',
  scheduled_date: TODAY, time_cap_seconds: 720, video_url: 'https://youtu.be/abcdefghijk', notes: 'Scaling libre, gardez le rythme',
  track: 'functional', is_published: true, sort_order: 0, leaderboard_enabled: true,
};
const WOD_STRENGTH = {
  id: 'wS', box_id: 'box-1', title: 'Back Squat', description: 'Back Squat - 3x5 @ 80kg', wod_type: 'strength', block_name: 'strength',
  scheduled_date: TODAY, time_cap_seconds: null, video_url: null, notes: null, track: 'functional', is_published: true, sort_order: 1,
};
const WOD_HYBRID = {
  id: 'wH', box_id: 'box-1', title: 'Run & Row', description: '5 rounds', wod_type: 'for-time', block_name: 'wod',
  scheduled_date: TODAY, time_cap_seconds: null, video_url: null, notes: null, track: 'hybrid', is_published: true, sort_order: 2,
};
const PERSONAL = {
  id: 'wP', box_id: null, title: 'Mon WOD perso', description: '50 double unders', wod_type: 'for-time', scheduled_date: TODAY,
  time_cap_seconds: 600, created_by: 'me', sort_order: 0,
};
const SCORES = [
  { id: 's1', wod_id: 'wA', member_id: 'u2', score_value: 212, score_type: 'reps', rx: true, capped: false, notes: null,
    profile: { id: 'u2', username: 'Julie', avatar_url: null, level: 'rx', elo: 1320 } },
  { id: 's2', wod_id: 'wA', member_id: 'me', score_value: 180, score_type: 'reps', rx: false, capped: false, notes: 'Wall balls à 6 kg',
    profile: { id: 'me', username: 'Moi', avatar_url: null, level: 'inter', elo: 1180 } },
  { id: 's3', wod_id: 'wA', member_id: 'u3', score_value: 150, score_type: 'reps', rx: true, capped: false, notes: null,
    profile: { id: 'u3', username: 'Karim', avatar_url: null, level: 'scaled', elo: 1010 } },
  { id: 's4', wod_id: 'wA', member_id: 'u4', score_value: 120, score_type: 'reps', rx: true, capped: false, notes: null,
    profile: { id: 'u4', username: 'Léa', avatar_url: null, level: 'scaled', elo: 990 } },
];

let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  mockRouteParams = undefined;
  mockAuth.currentBox = BOX;
  mockAuth.boxRole = 'member';
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockTables['box_wods|id, track, wod_type'] = [WOD_AMRAP, WOD_STRENGTH, WOD_HYBRID].map(({ id, track, wod_type }) => ({ id, track, wod_type }));
  mockTables['box_wods|*'] = [WOD_AMRAP, WOD_STRENGTH, WOD_HYBRID];
  mockTables['box_wods|perso'] = [PERSONAL];
  mockTables.box_articles = [{ id: 'a1' }, { id: 'a2' }];
  mockTables.wod_scores = SCORES;
  mockTables['wod_scores|wod_id'] = [{ wod_id: 'wA' }];
  mockTables.wod_completions = [];
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
  jest.clearAllMocks();
  mockCalls.length = 0;
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
function textsOf(n: ReactTestInstance, out: string[]) {
  if (isHostText(n)) {
    const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
    out.push(upper ? hostText(n).toUpperCase() : hostText(n));
    return;
  }
  n.children.forEach((ch) => { if (typeof ch !== 'string') textsOf(ch, out); });
}
/** Suite ordonnée des textes visibles de l'écran, puis de chaque fenêtre ouverte. */
function structure(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance) => {
    if (n.type === Modal) return;
    if (isHostText(n)) { if (n.props.accessibilityElementsHidden) return; textsOf(n, out); return; }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch); });
  };
  walk(root);
  for (const m of root.findAllByType(Modal).filter((x) => x.props.visible)) {
    out.push('── fenêtre ──');
    textsOf(m, out);
  }
  return out.filter((t) => t.trim().length > 0);
}
async function settle() {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
const withQuery = (el: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>{el}</QueryClientProvider>
);
async function mount(el: React.ReactElement, theme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(withQuery(el)); });
  await settle();
  return renderer.root;
}
async function pressText(root: ReactTestInstance, text: string) {
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
  if (!t) throw new Error(`texte introuvable : ${text}`);
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
const detail = (wod: Record<string, unknown>, params: Record<string, unknown> = {}) => {
  mockTables['box_wods|*'] = [wod];
  mockRouteParams = { wodId: wod.id, ...params };
  return <WODDetailScreen />;
};

type Variant = { name: string; run: (theme?: typeof lightTheme) => Promise<ReactTestInstance> };
const VARIANTS: Variant[] = [
  { name: 'mabox', run: (th) => mount(<WhiteboardScreen />, th) },
  { name: 'mabox-tout', run: async (th) => {
    const root = await mount(<WhiteboardScreen />, th);
    await pressText(root, 'Tout');
    return root;
  } },
  { name: 'mabox-sans-box', run: (th) => {
    mockAuth.currentBox = null;
    return mount(<WhiteboardScreen />, th);
  } },
  { name: 'detail-score', run: (th) => mount(detail(WOD_AMRAP), th) },
  { name: 'detail-sans-score', run: (th) => {
    mockTables.wod_scores = SCORES.filter((s) => s.member_id !== 'me');
    return mount(detail(WOD_AMRAP), th);
  } },
  { name: 'detail-saisie', run: async (th) => {
    mockTables.wod_scores = SCORES.filter((s) => s.member_id !== 'me');
    const root = await mount(detail({ ...WOD_AMRAP, wod_type: 'custom' }), th);
    await pressText(root, 'Entrer mon score');
    return root;
  } },
  { name: 'detail-expire', run: (th) => {
    mockTables.wod_scores = SCORES.filter((s) => s.member_id !== 'me');
    return mount(detail({ ...WOD_AMRAP, scheduled_date: '2026-09-20' }), th);
  } },
  { name: 'detail-muscu-saisie', run: async (th) => {
    mockTables.wod_scores = [];
    const root = await mount(detail(WOD_STRENGTH), th);
    await pressText(root, 'Entrer mon score');
    return root;
  } },
  { name: 'detail-commentaires', run: async (th) => {
    mockTables.score_comments = [{ id: 'c1', score_id: 's1', content: 'Bravo !', created_at: '2026-09-28T09:00:00Z', author: { id: 'u3', username: 'Karim', avatar_url: null } }];
    const root = await mount(detail(WOD_AMRAP), th);
    await pressText(root, 'Julie');
    return root;
  } },
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
/** Casse et emoji mis à part : les surtitres passent en capitales, les médailles deviennent des icônes Lucide. */
const normalize = (xs: string[]) => xs.map((x) => x.replace(EMOJI, '').trim().toUpperCase()).filter((x) => x.length > 0);

describe('R9a : ordre des blocs et libellés inchangés (instantané pris sur master)', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const root = await v.run();
    const current = structure(root);
    if (process.env.R9A_CAPTURE) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      const file = process.env.R9A_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(normalize(current)).toEqual(normalize(before));
  });
});
