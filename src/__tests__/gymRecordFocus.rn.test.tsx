/**
 * G1 bis : record de gymnastique renseigné depuis le Profil, puis retour au WOD.
 * Les records sont relus au retour sur l'écran ; seules les reps encore vides
 * sont pré-remplies, une valeur saisie reste telle quelle. Vrai react-native,
 * données fictives, aucun réseau.
 */
import React from 'react';
import { Modal } from 'react-native';
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

const TODAY = '2026-10-04';
const WOD = {
  id: 'wG', box_id: 'box-1', title: 'Skill gym', wod_type: 'strength', block_name: 'strength', scheduled_date: TODAY,
  description: 'Toes to Bar — 3 × 60 % du max', time_cap_seconds: null, video_url: null, notes: null, track: 'functional',
  is_published: true, sort_order: 0, leaderboard_enabled: true,
};

let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(`${TODAY}T10:00:00Z`),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockTables['box_wods|*'] = [WOD];
  mockTables.wod_scores = [];
  mockRouteParams = { wodId: WOD.id };
  mockRecords = {};
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
  jest.clearAllMocks();
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
const hostText = (n: ReactTestInstance): string => n.children.map(ch => (typeof ch === 'string' ? ch : hostText(ch))).join('');
async function settle() {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}
async function mount() {
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
const byID = (root: ReactTestInstance, id: string) => root.findAll(n => n.props.testID === id && typeof n.type === 'string')[0];
const repsField = (root: ReactTestInstance, i: number) =>
  root.findAll(n => n.props.testID === `strength-reps-${i}` && String(n.type) === 'TextInput')[0];
const repsValues = (root: ReactTestInstance) => [0, 1, 2].map(i => repsField(root, i).props.value);
async function openGrid(root: ReactTestInstance) {
  const t = root.findAll(n => isHostText(n) && hostText(n) === 'Entrer mon score')[0];
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  await act(async () => { n!.props.onPress({ stopPropagation: () => {} }); });
  await settle();
  expect(root.findAllByType(Modal).some(m => m.props.visible)).toBe(true);
}
async function focusAgain() {
  await act(async () => { mockFocus.current?.(); });
  await settle();
}
const pctLine = (root: ReactTestInstance) => hostText(byID(root, 'strength-gym-pct-0'));

describe('G1 bis : records relus au retour sur le WOD', () => {
  it('record absent puis renseigné : ligne recalculée et reps vides pré-remplies, reps saisies gardées', async () => {
    const root = await mount();
    await openGrid(root);
    expect(pctLine(root)).toBe('60 % de ton max · aucun record enregistré');
    expect(byID(root, 'strength-gym-set-record-0')).toBeTruthy();
    expect(repsValues(root)).toEqual(['', '', '']);

    await act(async () => { repsField(root, 0).props.onChangeText('12'); });
    await settle();

    // « Renseigner mon record » : la fenêtre se ferme, le Profil s'ouvre sur Gymnastique.
    await act(async () => {
      let n: ReactTestInstance | null = byID(root, 'strength-gym-set-record-0');
      while (n && typeof n.props.onPress !== 'function') n = n.parent;
      n!.props.onPress();
    });
    await settle();
    expect(mockNavigate).toHaveBeenCalledWith('Profile', { prCategory: 'gymnastics' });

    // Record enregistré dans le Profil, puis retour sur le WOD.
    mockRecords = { 'gymnastics_Toes To Bar': '15' };
    await focusAgain();
    await openGrid(root);
    expect(pctLine(root)).toBe('60 % de ton max (15 reps) → 9 reps');
    expect(byID(root, 'strength-gym-set-record-0')).toBeUndefined();
    expect(repsValues(root)).toEqual(['12', '9', '9']);
  });

  it('tant que les records ne sont pas relus, rien n’est inventé', async () => {
    const root = await mount();
    mockRecords = { 'gymnastics_Toes To Bar': '15' };
    await openGrid(root);
    expect(pctLine(root)).toBe('60 % de ton max · aucun record enregistré');
    expect(repsValues(root)).toEqual(['', '', '']);
  });

  it('le premier focus (montage) ne relit pas les records une seconde fois', async () => {
    const { fetchMyPersonalRecords } = jest.requireMock('../services/myProfile');
    await mount();
    expect(fetchMyPersonalRecords).toHaveBeenCalledTimes(1);
    await focusAgain();
    expect(fetchMyPersonalRecords).toHaveBeenCalledTimes(2);
  });
});

