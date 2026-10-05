/**
 * Bloc non classé : la liste des scores des membres s'affiche (titre « Scores »,
 * likes, RX/Scaled) sans rang ni ELO ; le bloc classé garde son classement.
 * Vrai react-native, données fictives, aucun réseau.
 */
import React from 'react';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WODDetailScreen from '../screens/whiteboard/WODDetailScreen';

const mockNavigate = jest.fn();
let mockRouteParams: Record<string, unknown> | undefined;
const mockTables: Record<string, unknown[]> = {};
let mockRecords: Record<string, unknown> = {};
const mockFocus: { current: (() => void) | null } = { current: null };

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true, setOptions: jest.fn() }),
    useRoute: () => ({ params: mockRouteParams }),
    // Le premier focus est le montage ; `focusAgain()` simule le retour sur l'écran.
    useFocusEffect: (cb: () => void) => { mockFocus.current = cb; useEffect(cb, [cb]); },
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
const mockAuth = { user: { id: 'me', username: 'Moi', avatar_url: null }, currentBox: BOX, boxRole: 'member', joinBox: jest.fn() };
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').lightTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let sel = '';
    const b: Record<string, unknown> = {};
    const rows = () => (mockTables[`${table}|${sel}`] ?? mockTables[table] ?? []) as unknown[];
    for (const m of ['select', 'eq', 'gte', 'lte', 'gt', 'order', 'limit', 'in', 'or', 'is', 'contains', 'update', 'delete', 'insert', 'upsert']) {
      b[m] = (...args: unknown[]) => { if (m === 'select' && !sel) sel = String(args[0]); return b; };
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
jest.mock('../services/myProfile', () => ({
  fetchMyPersonalRecords: jest.fn(async () => ({ ...mockRecords })),
  fetchMyProfile: jest.fn(async () => ({ personal_records: { ...mockRecords } })),
}));
jest.mock('../services/membership', () => ({ ...jest.requireActual('../services/membership'), getMyPlanStatus: async () => null }));
jest.mock('../lib/analytics', () => ({ trackScoreSubmit: jest.fn() }));
jest.mock('../services/notifications', () => ({
  sendScoreNotification: jest.fn(async () => {}), sendScoreOvertakenNotification: jest.fn(async () => {}), cancelTodayScoreReminder: jest.fn(async () => {}),
}));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}), logMovementReps: jest.fn(async () => {}), recordActivity: jest.fn(async () => {}) }));
jest.mock('../services/eloCompute', () => ({ computeAndSaveElo: jest.fn(async () => {}), sortScoresRxFirst: (s: unknown[]) => s }));
jest.mock('../services/strengthPR', () => ({ recordStrengthPRs: jest.fn(async () => []) }));
jest.mock('../utils/eloLevels', () => ({ syncLevelAndBadges: jest.fn(async () => []) }));
jest.mock('../services/strengthSets', () => {
  const actual = jest.requireActual('../services/strengthSets');
  return {
    ...actual,
    loadStrengthGrid: jest.fn(async (_k: unknown, prescription: unknown[]) => ({ drafts: prescription, origin: 'prescription', server: null, pending: null, offline: false })),
    saveStrengthDraft: jest.fn(async () => ({ status: 'saved', updatedAt: '2026-10-04T10:00:00Z' })),
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

const TODAY = '2026-10-05';
const WOD = {
  id: 'w1', box_id: 'box-1', title: 'Bloc fictif', wod_type: 'amrap', block_name: 'post-wod', scheduled_date: TODAY,
  description: '10 Burpees', time_cap_seconds: null, video_url: null, notes: null, track: 'functional',
  is_published: true, sort_order: 0, leaderboard_enabled: true,
};
const score = (id: string, member: string, name: string, value: number, rx: boolean) => ({
  id, wod_id: WOD.id, member_id: member, box_id: 'box-1', score_type: 'reps', score_value: value, rx, scaled: !rx,
  capped: false, notes: null, profile: { id: member, username: name, avatar_url: null, level: 1, elo: 1234 },
});
const SCORES = [score('s1', 'a1', 'Athlète A', 120, true), score('s2', 'a2', 'Athlète B', 100, true), score('s3', 'a3', 'Athlète C', 90, false)];

let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(`${TODAY}T10:00:00Z`),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockTables.wod_scores = SCORES;
  mockTables.score_reactions = [{ score_id: 's1' }, { score_id: 's1' }, { score_id: 's2' }];
  mockTables.score_comments = [];
  mockRouteParams = { wodId: WOD.id };
  mockRecords = {};
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
  jest.clearAllMocks();
});

const hostText = (n: ReactTestInstance): string => n.children.map(ch => (typeof ch === 'string' ? ch : hostText(ch))).join('');
async function settle() {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}
async function mount(wod: Record<string, unknown>) {
  mockTables['box_wods|*'] = [wod];
  await act(async () => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
        <WODDetailScreen />
      </QueryClientProvider>,
    );
  });
  await settle();
  return renderer.root;
}
const host = (root: ReactTestInstance, id: string) => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const rowText = (root: ReactTestInstance, id: string) => hostText(host(root, `leader-row-${id}`)[0]);
const medals = (root: ReactTestInstance) => root.findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('rank-medal-'));

describe('liste des scores sur WODDetail', () => {
  it('bloc classé : classement avec compteur, rangs et ELO', async () => {
    const root = await mount(WOD);
    expect(hostText(host(root, 'score-list-title')[0])).toBe('Classement · 3 scores');
    expect(medals(root).length).toBeGreaterThan(0);
    expect(rowText(root, 's1')).toContain('1234 ELO');
    expect(rowText(root, 's1')).toContain('Athlète A');
  });

  it('bloc non classé : « Scores », mêmes lignes sans rang ni ELO, likes et RX/Scaled présents', async () => {
    const root = await mount({ ...WOD, leaderboard_enabled: false });
    expect(hostText(host(root, 'score-list-title')[0])).toBe('Scores');
    expect(SCORES.every(s => host(root, `leader-row-${s.id}`).length === 1)).toBe(true);
    expect(medals(root)).toHaveLength(0);
    for (const s of SCORES) expect(rowText(root, s.id)).not.toContain('ELO');
    // Initiale de l'avatar, nom, likes, score, RX/Scaled — aucun numéro de rang.
    expect(rowText(root, 's1')).toBe('AAthlète A2120 repsRX');
    expect(rowText(root, 's2')).toBe('AAthlète B1100 repsRX');
    expect(rowText(root, 's3')).toBe('AAthlète C90 repsScaled');
  });

  it('aucun score : ni classement ni liste', async () => {
    mockTables.wod_scores = [];
    const root = await mount({ ...WOD, leaderboard_enabled: false });
    expect(host(root, 'score-list-title')).toHaveLength(0);
    await act(async () => renderer.unmount());
    const root2 = await mount(WOD);
    expect(host(root2, 'score-list-title')).toHaveLength(0);
  });

  it('séance non datée : pas de liste, comme avant', async () => {
    const root = await mount({ ...WOD, scheduled_date: null, program_week: 1, program_day: 1, leaderboard_enabled: false });
    expect(host(root, 'wod-card').length + host(root, 'wod-detail-title').length).toBeGreaterThan(0);
    expect(host(root, 'score-list-title')).toHaveLength(0);
  });
});
