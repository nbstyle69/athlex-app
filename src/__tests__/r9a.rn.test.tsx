/**
 * R9a : Ma Box (WhiteboardScreen) et détail du WOD (WODDetailScreen) au nouveau
 * design, montés avec le vrai react-native. Données fictives, aucun réseau.
 */
import React from 'react';
import { Linking, Modal, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lightTheme, darkTheme } from '../theme/palette';
import { contrast } from '../theme/contrast';
import { axTypography } from '../theme/axTokens';
import { AxButton, AxChip } from '../components/ax';
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
const BOX = { id: 'box-1', name: 'CrossFit Fictif', owner_id: 'u9', logo_url: null, slug: 'crossfit-fictif' };
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
let mockPlanStatus: unknown = null;
jest.mock('../services/membership', () => ({
  ...jest.requireActual('../services/membership'),
  getMyPlanStatus: async () => mockPlanStatus,
}));
jest.mock('../lib/unreadMessages', () => ({ countUnreadMessages: jest.fn(async () => 3) }));
jest.mock('../lib/analytics', () => ({ trackScoreSubmit: jest.fn() }));
jest.mock('../services/notifications', () => ({
  sendScoreNotification: jest.fn(async () => {}), sendScoreOvertakenNotification: jest.fn(async () => {}), cancelTodayScoreReminder: jest.fn(async () => {}),
}));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}), logMovementReps: jest.fn(async () => {}), recordActivity: jest.fn(async () => {}) }));
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
const mockTimerOpen: string[] = [];
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
  mockTimerOpen.length = 0;
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

const flat = (n: ReactTestInstance) => (StyleSheet.flatten(n.props.style) ?? {}) as Record<string, unknown>;
const byID = (root: ReactTestInstance, id: string) => {
  const n = root.findAll((x) => x.props.testID === id && typeof x.type === 'string')[0]
    ?? root.findAll((x) => x.props.testID === id)[0];
  if (!n) throw new Error(`testID introuvable : ${id}`);
  return n;
};
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await act(async () => { n.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
const textNode = (root: ReactTestInstance, text: string) => {
  const n = root.findAll((x) => isHostText(x) && hostText(x) === text)[0];
  if (!n) throw new Error(`texte introuvable : ${text}`);
  return n;
};
const insideModal = (n: ReactTestInstance) => {
  for (let cur: ReactTestInstance | null = n; cur; cur = cur.parent) if (cur.type === Modal) return true;
  return false;
};
const isAncestor = (a: ReactTestInstance, n: ReactTestInstance) => {
  for (let cur: ReactTestInstance | null = n; cur; cur = cur.parent) if (cur === a) return true;
  return false;
};
const verticalScrolls = (root: ReactTestInstance) =>
  root.findAllByType(ScrollView).filter((x) => !x.props.horizontal && !insideModal(x));
const accentButtons = (root: ReactTestInstance) =>
  root.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent' && !insideModal(b));
const visibleModals = (root: ReactTestInstance) => root.findAllByType(Modal).filter((m) => m.props.visible);
const typo = (n: ReactTestInstance, name: keyof typeof axTypography) => {
  const st = flat(n);
  expect({ text: hostText(n), fontFamily: st.fontFamily, fontSize: st.fontSize }).toEqual({
    text: hostText(n), fontFamily: axTypography[name].fontFamily, fontSize: axTypography[name].fontSize,
  });
};
function backgroundOf(n: ReactTestInstance, theme: typeof lightTheme): string {
  for (let cur: ReactTestInstance | null = n; cur; cur = cur.parent) {
    if (cur.type === AxChip) return cur.props.selected ? theme.ax.accent : theme.ax.background;
    if (cur.type === AxButton && (cur.props.variant ?? 'accent') === 'accent') return theme.ax.accent;
    const bg = typeof cur.type === 'string' ? flat(cur).backgroundColor : undefined;
    if (typeof bg === 'string' && /^#[0-9A-Fa-f]{6}$/.test(bg)) return bg;
  }
  return theme.ax.background;
}
/** Un texte long ne déborde pas : dans chaque rangée qu'il traverse, sa branche peut rétrécir ou passer à la ligne. */
function expectNoOverflow(n: ReactTestInstance) {
  let child: ReactTestInstance = n;
  for (let cur = n.parent; cur; cur = cur.parent) {
    if (typeof cur.type === 'string' && flat(cur).flexDirection === 'row' && flat(cur).flexWrap !== 'wrap') {
      const st = flat(child);
      const shrinks = (Number(st.flex) >= 1 && (st.minWidth === 0 || child === n)) || Number(st.flexShrink) >= 1 || st.maxWidth != null;
      expect({ text: hostText(n), shrinks }).toEqual({ text: hostText(n), shrinks: true });
    }
    if (typeof cur.type === 'string') child = cur;
  }
  expect(flat(n).width).toBeUndefined();
}
const EMOJI_TEST = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
/** Réactions choisies par les membres : du contenu, pas de la décoration. */
const REACTIONS = new Set(['❤️', '🔥', '💪', '👏', '🎯', '⚡']);
const THEMES = [['clair', lightTheme], ['sombre', darkTheme]] as const;

describe('R9a : toute la page Ma Box défile', () => {
  it('un seul ScrollView vertical contient en-tête, boutons, onglets, jours, quick actions et séances', async () => {
    const root = await mount(<WhiteboardScreen />);
    const scrolls = verticalScrolls(root);
    expect(scrolls).toHaveLength(1);
    const [scroll] = scrolls;
    for (const id of ['whiteboard-header', 'whiteboard-members', 'whiteboard-messages', 'whiteboard-news', 'whiteboard-box-ranking',
      'whiteboard-track-tabs', 'week-day-picker', 'whiteboard-quick-actions', 'whiteboard-enter-score', 'whiteboard-ranking',
      'wod-card-wA', 'wod-card-wS']) {
      expect({ id, inScroll: isAncestor(scroll, byID(root, id)) }).toEqual({ id, inScroll: true });
    }
    expect(isAncestor(scroll, textNode(root, 'Ma Box'))).toBe(true);
    expect(isAncestor(scroll, textNode(root, 'CrossFit Fictif'))).toBe(true);
    // Les fenêtres restent hors du défilement.
    for (const m of root.findAllByType(Modal)) expect(isAncestor(scroll, m)).toBe(false);
  });

  it('tirer pour actualiser recharge les séances de la box', async () => {
    const root = await mount(<WhiteboardScreen />);
    const [scroll] = verticalScrolls(root);
    const rc = scroll.props.refreshControl;
    expect(rc).toBeTruthy();
    expect(rc.type).toBe(RefreshControl);
    const before = mockCalls.filter((c) => c.table === 'box_wods' && c.method === 'select').length;
    await act(async () => { rc.props.onRefresh(); });
    await settle();
    expect(mockCalls.filter((c) => c.table === 'box_wods' && c.method === 'select').length).toBeGreaterThan(before);
  });

  it('sans box : un seul ScrollView, « tirer pour actualiser » recharge les séances perso', async () => {
    mockAuth.currentBox = null;
    const root = await mount(<WhiteboardScreen />);
    const scrolls = verticalScrolls(root);
    expect(scrolls).toHaveLength(1);
    expect(isAncestor(scrolls[0], byID(root, 'whiteboard-join-box'))).toBe(true);
    const rc = scrolls[0].props.refreshControl;
    const before = mockCalls.filter((c) => c.table === 'box_wods' && c.method === 'is').length;
    await act(async () => { rc.props.onRefresh(); });
    await settle();
    expect(mockCalls.filter((c) => c.table === 'box_wods' && c.method === 'is').length).toBeGreaterThan(before);
  });

  it('la fenêtre de rejoindre une box reste au-dessus du défilement', async () => {
    mockAuth.currentBox = null;
    const root = await mount(<WhiteboardScreen />);
    await press(root, 'whiteboard-join-box');
    const open = visibleModals(root);
    expect(open.length).toBeGreaterThan(0);
    for (const m of open) expect(isAncestor(verticalScrolls(root)[0], m)).toBe(false);
  });
});

describe('R9a : navigation et callbacks de Ma Box inchangés', () => {
  it('Membres ouvre la fenêtre des membres', async () => {
    const root = await mount(<WhiteboardScreen />);
    expect(visibleModals(root)).toHaveLength(0);
    await press(root, 'whiteboard-members');
    expect(visibleModals(root).length).toBe(1);
  });
  it.each([
    ['whiteboard-messages', ['Messages']],
    ['whiteboard-news', ['Articles']],
    ['whiteboard-box-ranking', ['BoxRanking']],
    ['whiteboard-enter-score', ['WODDetail', { wodId: 'wA' }]],
    ['whiteboard-ranking', ['WODDetail', { wodId: 'wA', scrollToLeaderboard: true }]],
    ['wod-details-wA', ['WODDetail', { wodId: 'wA' }]],
    ['wod-open-wA', ['WODDetail', { wodId: 'wA' }]],
    ['wod-details-wS', ['WODDetail', { wodId: 'wS' }]],
  ])('%s', async (id, args) => {
    const root = await mount(<WhiteboardScreen />);
    await press(root, id);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(...args);
  });
  it('compteur de messages non lus en AxCounterBadge', async () => {
    const root = await mount(<WhiteboardScreen />);
    const badge = byID(root, 'whiteboard-messages-badge');
    const messages = byID(root, 'whiteboard-messages');
    let box: ReactTestInstance | null = badge;
    while (box && !isAncestor(box, messages)) box = box.parent;
    expect(box).toBeTruthy();
    expect(isAncestor(box!, byID(root, 'whiteboard-members'))).toBe(false);
    expect(isAncestor(box!, byID(root, 'whiteboard-news'))).toBe(false);
    expect(hostText(byID(root, 'whiteboard-messages-badge'))).toBe('3');
  });
  it('séance de musculation en brouillon : « Reprendre ma saisie » et statut « En cours »', async () => {
    const root = await mount(<WhiteboardScreen />);
    expect(isAncestor(byID(root, 'wod-details-wS'), textNode(root, 'Reprendre ma saisie'))).toBe(true);
    expect(isAncestor(byID(root, 'wod-details-wA'), textNode(root, 'Voir détails & score'))).toBe(true);
  });
  it('le bouton chrono ouvre le minuteur de la séance', async () => {
    const root = await mount(<WhiteboardScreen />);
    expect(mockTimerOpen).toEqual([]);
    await press(root, 'wod-timer-wA');
    expect(mockTimerOpen).toContain(LONG);
  });
  it('onglets de piste : « Hybrid » ne montre que la séance hybrid, l’onglet actif est sélectionné', async () => {
    const root = await mount(<WhiteboardScreen />);
    await press(root, 'whiteboard-track-functional');
    expect(root.findAll((x) => x.props.testID === 'wod-card-wH')).toHaveLength(0);
    expect(root.findAll((x) => x.props.testID === 'wod-card-wA').length).toBeGreaterThan(0);
    await press(root, 'whiteboard-track-hybrid');
    expect(root.findAll((x) => x.props.testID === 'wod-card-wH').length).toBeGreaterThan(0);
    expect(root.findAll((x) => x.props.testID === 'wod-card-wA')).toHaveLength(0);
    const tab = root.findAll((x) => x.props.testID === 'whiteboard-track-hybrid' && x.props.accessibilityRole === 'tab' && typeof x.type === 'string')[0];
    expect(tab.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });
  it('sélecteur de jours : un appui change de jour et recharge', async () => {
    const root = await mount(<WhiteboardScreen />);
    const n = mockCalls.filter((c) => c.table === 'box_wods' && c.method === 'eq' && c.args[0] === 'scheduled_date').length;
    await press(root, 'week-day-2026-09-29');
    const days = mockCalls.filter((c) => c.table === 'box_wods' && c.method === 'eq' && c.args[0] === 'scheduled_date');
    expect(days.length).toBeGreaterThan(n);
    expect(days[days.length - 1].args[1]).toBe('2026-09-29');
  });
});

describe('R9a : apparence Ma Box', () => {
  it.each(THEMES)('thème %s : une seule action accent en haut, typographie, AA et pas de débordement', async (_n, theme) => {
    const root = await mount(<WhiteboardScreen />, theme);
    await press(root, 'whiteboard-track-functional');
    const inCard = (b: ReactTestInstance) => {
      for (let cur: ReactTestInstance | null = b; cur; cur = cur.parent) if (String(cur.props.testID ?? '').startsWith('wod-card-')) return true;
      return false;
    };
    const accents = accentButtons(root).filter((b) => !inCard(b));
    expect(accents.map((b) => String(b.props.label).toUpperCase())).toEqual(['ENTRER MON SCORE']);
    typo(textNode(root, 'Ma Box'), 'titleXL');
    typo(textNode(root, 'CrossFit Fictif'), 'bodySmall');
    typo(textNode(root, LONG), 'titleM');
    typo(textNode(root, '10 burpees\n15 wall balls'), 'bodySmall');
    typo(textNode(root, 'Voir détails & score'), 'labelSmall');
    expect(flat(textNode(root, 'CrossFit Fictif')).color).toBe(theme.ax.textMuted);
    expect(flat(textNode(root, 'Voir détails & score')).color).toBe(theme.ax.accentText);
    for (const t of root.findAll((x) => isHostText(x) && !insideModal(x) && hostText(x).trim().length > 0)) {
      const color = flat(t).color;
      if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) continue;
      const bg = backgroundOf(t, theme);
      expect({ text: hostText(t), color, bg, aa: contrast(color, bg) >= 4.5 }).toEqual({ text: hostText(t), color, bg, aa: true });
    }
    expectNoOverflow(textNode(root, LONG));
    expectNoOverflow(textNode(root, 'CrossFit Fictif'));
  });
});

describe('R9a : détail du WOD', () => {
  it('« Mon score » affiche le score envoyé, sans saisie dans la page', async () => {
    const root = await mount(detail(WOD_AMRAP));
    expect(hostText(byID(root, 'my-score-value'))).toBe('180 reps');
    typo(byID(root, 'my-score-value'), 'numberM');
    expect(isAncestor(byID(root, 'my-score'), textNode(root, 'Wall balls à 6 kg'))).toBe(true);
    expect(root.findAll((x) => x.props.testID === 'enter-score')).toHaveLength(0);
    expect(accentButtons(root)).toHaveLength(0);
    expect(root.findAll((x) => String(x.type) === 'TextInput' && !insideModal(x))).toHaveLength(0);
    await press(root, 'my-score-edit');
    expect(visibleModals(root)).toHaveLength(1);
    await act(async () => { visibleModals(root)[0].props.onRequestClose(); });
    await settle();
    await press(root, 'my-score-share');
    expect(visibleModals(root)).toHaveLength(1);
  });

  it('« Entrer mon score » ouvre la fenêtre de saisie, une seule action accent par écran', async () => {
    mockTables.wod_scores = SCORES.filter((s) => s.member_id !== 'me');
    const root = await mount(detail(WOD_AMRAP));
    expect(accentButtons(root).map((b) => String(b.props.label).toUpperCase())).toEqual(['ENTRER MON SCORE']);
    expect(visibleModals(root)).toHaveLength(0);
    await press(root, 'enter-score');
    const [modal] = visibleModals(root);
    expect(modal).toBeTruthy();
    const inModal = modal.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent').map((b) => b.props.label);
    expect(inModal).toEqual(['Valider le score']);
  });

  it('fenêtre de saisie : niveau et type en AxChip, valider envoie le score', async () => {
    mockTables.wod_scores = SCORES.filter((s) => s.member_id !== 'me');
    const root = await mount(detail(WOD_AMRAP));
    await press(root, 'enter-score');
    const chip = (id: string) => root.findAll((x) => x.props.testID === id && typeof x.type === 'string' && x.props.accessibilityState)[0];
    expect(chip('score-level-rx').props.accessibilityState.selected).toBe(true);
    await press(root, 'score-level-scaled');
    expect(chip('score-level-scaled').props.accessibilityState.selected).toBe(true);
    expect(chip('score-level-rx').props.accessibilityState.selected).toBe(false);
    const field = root.findAll((x) => x.props.testID === 'score-value' && String(x.type) === 'TextInput')[0];
    await act(async () => { field.props.onChangeText('190'); });
    await press(root, 'score-submit');
    const writes = mockCalls.filter((c) => c.table === 'wod_scores' && (c.method === 'upsert' || c.method === 'insert'));
    expect(writes.length).toBe(1);
    expect(writes[0].args[0]).toEqual(expect.objectContaining({ score_value: 190, rx: false }));
  });

  it('séance terminée : message conservé, pas de bouton accent', async () => {
    mockTables.wod_scores = SCORES.filter((s) => s.member_id !== 'me');
    const root = await mount(detail({ ...WOD_AMRAP, scheduled_date: '2026-09-20' }));
    textNode(root, 'Soumission de score terminée (minuit passé)');
    expect(accentButtons(root)).toHaveLength(0);
  });

  it('classement : une AxCard par score, médailles en icônes, un appui ouvre le détail et ses commentaires', async () => {
    const root = await mount(detail(WOD_AMRAP));
    for (const id of ['s1', 's2', 's3', 's4']) byID(root, `leader-row-${id}`);
    for (const r of [1, 2, 3]) byID(root, `rank-medal-${r}`);
    expect(root.findAll((x) => x.props.testID === 'rank-medal-4')).toHaveLength(0);
    textNode(root, '4');
    textNode(root, '1320 ELO');
    textNode(root, 'Moi (moi)');
    await press(root, 'leader-row-s1');
    expect(visibleModals(root)).toHaveLength(1);
    expect(root.findAll((x) => x.props.testID === 'comment-input' && String(x.type) === 'TextInput')).toHaveLength(1);
  });

  it.each(THEMES)('thème %s : carte featured, Notes coach en overline accentText, AA et pas de débordement', async (_n, theme) => {
    const root = await mount(detail(WOD_AMRAP), theme);
    expect(byID(root, 'wod-card').props.variant ?? root.findAll((x) => x.props.testID === 'wod-card' && x.props.variant)[0]?.props.variant).toBe('featured');
    typo(textNode(root, 'Notes coach'), 'overline');
    expect(flat(textNode(root, 'Notes coach')).color).toBe(theme.ax.accentText);
    expect(root.findAll((x) => x.props.testID === 'wod-card' && x.props.variant === 'featured').length).toBe(1);
    for (const t of root.findAll((x) => isHostText(x) && !insideModal(x) && hostText(x).trim().length > 0)) {
      const color = flat(t).color;
      if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) continue;
      const bg = backgroundOf(t, theme);
      expect({ text: hostText(t), color, bg, aa: contrast(color, bg) >= 4.5 }).toEqual({ text: hostText(t), color, bg, aa: true });
    }
    expectNoOverflow(textNode(root, 'Moi (moi)'));
  });
});

describe('R9a : aucun emoji dans Ma Box et le détail du WOD', () => {
  it.each(VARIANTS.flatMap((v) => THEMES.map(([n, th]) => [`${v.name} (${n})`, v, th] as const)))('%s', async (_n, v, th) => {
    const root = await v.run(th);
    const offenders = root.findAll((x) => isHostText(x) && EMOJI_TEST.test(hostText(x)))
      .map(hostText).filter((t) => t !== 'Bravo !' && !REACTIONS.has(t));
    expect(offenders).toEqual([]);
  });
});

describe('Retours iPhone (7) : en-tête court, nom long en tête du contenu', () => {
  it('détail d’un WOD au nom très long : « WOD du jour » en en-tête, nom entier dans le contenu', async () => {
    const root = await mount(detail(WOD_AMRAP));
    const title = root.findAll((n) => n.props.testID === 'ax-screen-header-title' && typeof n.type === 'string')[0];
    expect(hostText(title)).toBe('WOD du jour');
    const content = root.findAll((n) => n.props.testID === 'wod-detail-title' && typeof n.type === 'string')[0];
    expect(hostText(content)).toBe(LONG);
    expect(content.props.numberOfLines).toBeUndefined();
  });
});

// Lot 4 « Rejoindre une box en payant » : bandeau « Formule à activer » sous les raccourcis (maquette 68:671).
describe('Lot 4 : Ma Box sans formule', () => {
  const SANS_FORMULE = { is_staff: false, has_plan: false, suspended: false, credits_left: 0, pays_online: true };
  afterEach(() => { mockPlanStatus = null; });

  it.each(THEMES)('thème %s : sous « Classement de la box », au-dessus des pistes et des jours ; bouton vers la page de la box', async (_n, theme) => {
    mockPlanStatus = SANS_FORMULE;
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await mount(<WhiteboardScreen />, theme);
    const s = structure(root);
    const i = s.indexOf('FORMULE À ACTIVER');
    expect(i).toBeGreaterThan(s.indexOf('Classement de la box'));
    expect(i).toBeLessThan(s.indexOf('Functional'));
    expect(i).toBeLessThan(s.indexOf('LUN'));
    expect(s).toContain('Tu as rejoint CrossFit Fictif. Pour réserver tes cours, active une formule de ta box.');
    const card = root.findAll((n) => n.props.testID === 'whiteboard-plan' && String(n.type) === 'View')[0];
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({ borderColor: theme.ax.warning });
    const cta = root.findAll((n) => n.props.testID === 'whiteboard-plan-cta' && typeof n.props.onPress === 'function')[0];
    await act(async () => { cta.props.onPress(); });
    expect(open).toHaveBeenCalledWith('https://athlexapp.eu/box/crossfit-fictif');
    open.mockRestore();
  });

  it('sans formule en ligne : pas de bouton ; suspendu, formule ou staff : aucun bandeau', async () => {
    mockPlanStatus = { ...SANS_FORMULE, pays_online: false };
    let root = await mount(<WhiteboardScreen />);
    expect(root.findAll((n) => n.props.testID === 'whiteboard-plan').length).toBeGreaterThan(0);
    expect(root.findAll((n) => n.props.testID === 'whiteboard-plan-cta')).toHaveLength(0);
    for (const st of [{ ...SANS_FORMULE, suspended: true }, { ...SANS_FORMULE, has_plan: true }, { ...SANS_FORMULE, is_staff: true }, null]) {
      await act(async () => renderer.unmount());
      mockPlanStatus = st;
      root = await mount(<WhiteboardScreen />);
      expect([st, root.findAll((n) => n.props.testID === 'whiteboard-plan').length]).toEqual([st, 0]);
    }
  });
});
