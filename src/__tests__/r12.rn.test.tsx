/**
 * R12 — Profil (Compte, PR, Stats, Badges) et écrans sociaux (Amis, Profil
 * public, Utilisateurs bloqués, Notifications, Nouveautés) au nouveau design,
 * montés avec le vrai react-native : ordre des blocs inchangé, navigation et
 * callbacks inchangés, couleurs et typographies clés dans les deux thèmes,
 * textes longs bornés.
 */
import React, { useEffect as mockUseEffect } from 'react';
import fs from 'fs';
import path from 'path';
import { Alert, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import i18n from '../i18n';
import BEFORE from './r12StructureBefore.json';
import ProfileScreen from '../screens/profile/ProfileScreen';
import PublicProfileScreen from '../screens/profile/PublicProfileScreen';
import BlockedUsersScreen from '../screens/profile/BlockedUsersScreen';
import FriendsScreen from '../screens/home/FriendsScreen';
import ChangelogScreen from '../screens/home/ChangelogScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import { AxButton, AxCard, AxChip, AxSwitch } from '../components/ax';
import { axTypography } from '../theme/axTokens';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockToggleTheme = jest.fn();
const mockSetLanguage = jest.fn();
const mockInvalidate = jest.fn();
const mockSaveNotif = jest.fn(async (..._a: unknown[]) => {});
const mockUnblock = jest.fn(async (_id: string) => true);
const mockShareBoxCode = jest.fn(async (_id: string) => 'BOX42');
let mockTheme: AppTheme = lightTheme;
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];
const mockState: Record<string, any> = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, getParent: () => ({ navigate: mockParentNavigate }) }),
  useRoute: () => ({ params: undefined }),
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 92 }));
const mockQueryClient = { invalidateQueries: (...a: unknown[]) => mockInvalidate(...a) };
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('react-native-svg', () => {
  const R = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const C = (p: { children?: React.ReactNode }) => R.createElement(View, null, typeof p.children === 'string' || typeof p.children === 'number' ? null : p.children);
  const out: Record<string, unknown> = { __esModule: true, default: C };
  for (const k of ['Svg', 'G', 'Path', 'Rect', 'Circle', 'Line', 'Polyline', 'Polygon', 'Ellipse', 'Defs', 'LinearGradient', 'RadialGradient', 'Stop', 'Text', 'TSpan', 'ClipPath', 'Mask', 'Filter', 'FeGaussianBlur', 'Use', 'Symbol']) out[k] = C;
  return out;
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockState.auth }));
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme, mode: mockTheme.mode, toggleTheme: mockToggleTheme }),
}));
jest.mock('../hooks/useFocusQuery', () => ({
  useFocusQuery: (key: unknown[]) => (key[0] === 'owner-subscription'
    ? { data: mockState.ownerSub, isFetching: false, refetch: jest.fn() }
    : { data: mockState.profileData, isFetching: false, refetch: jest.fn() }),
}));
jest.mock('../i18n', () => {
  const actual = jest.requireActual('../i18n');
  return { __esModule: true, ...actual, default: actual.default, setLanguage: (l: string) => mockSetLanguage(l) };
});
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/boxInviteCode', () => ({ getMyBoxInviteCode: (id: string) => mockShareBoxCode(id) }));
jest.mock('expo-image-picker', () => ({}), { virtual: true });
jest.mock('expo-file-system/legacy', () => ({}), { virtual: true });
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('../components/ReportMenu', () => {
  const { View } = jest.requireActual('react-native');
  return (p: { onActionDone: () => void }) => <View testID="report-menu" onActionDone={p.onActionDone} />;
});
jest.mock('../services/gamification', () => ({
  getBadgesCatalog: async () => mockState.badges,
  getEarnedBadges: async () => [],
  getStreak: async () => null,
  isBadgeUnobtainable: (k: string) => k.startsWith('streak_'),
  incrementCounter: jest.fn(async () => {}),
}));
jest.mock('../services/myProfile', () => ({
  fetchMyProfile: async () => ({ personal_records: {} }),
  fetchMyPersonalRecords: async () => ({}),
}));
jest.mock('../services/strengthSets', () => ({ fetchMyStrengthSets: async () => [], groupStrengthSessions: () => [] }));
jest.mock('../services/membership', () => ({
  ...jest.requireActual('../services/membership'),
  getMyMemberships: async () => mockState.memberships ?? [],
}));
jest.mock('../services/notifications', () => ({
  DEFAULT_NOTIFICATION_PREFS: jest.requireActual('../services/notificationPrefsCache').DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs: async () => mockState.prefs,
  saveNotificationPrefs: (...a: unknown[]) => mockSaveNotif(...a),
  registerForPushNotifications: async () => null,
  savePushToken: jest.fn(),
  sendFriendRequestNotification: jest.fn(async () => {}),
  sendFriendAcceptedNotification: jest.fn(async () => {}),
}));
jest.mock('../services/moderation', () => ({
  getMyBlockedUsers: async () => mockState.blocked,
  unblockUser: (id: string) => mockUnblock(id),
}));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const ops: Array<{ method: string; args: unknown[] }> = [];
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'or', 'order', 'limit', 'in', 'ilike', 'update', 'delete', 'insert', 'upsert', 'single', 'maybeSingle']) {
      b[m] = (...args: unknown[]) => { ops.push({ method: m, args }); mockCalls.push({ table, method: m, args }); return b; };
    }
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: mockState.resolve(table, ops), error: null, count: 0 }).then(res, rej);
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: async () => ({ data: [], error: null }),
      auth: { updateUser: jest.fn(async () => ({ error: null })), signInWithPassword: jest.fn(async () => ({ error: null })) },
    },
  };
});

export const LONG = 'Un pseudo vraiment très très long qui ne tiendrait jamais sur un écran de 390 points';
const NOW = new Date('2026-09-28T10:00:00');
const BOX = { id: 'b1', name: 'CrossFit Lens' };
const BOX2 = { id: 'b2', name: 'Box au nom particulièrement long pour vérifier le retour à la ligne' };
const BADGES = [
  { badge_key: 'first_wod', title: 'Premier WOD', description: 'Termine ton premier WOD', icon: '🏋️', category: 'wod', sort_order: 1 },
  { badge_key: 'elo_1200', title: 'Palier RX', description: 'Atteins 1200 ELO', icon: '📈', category: 'elo', sort_order: 2 },
  { badge_key: 'friends_5', title: LONG, description: 'Ajoute 5 amis', icon: '🤝', category: 'social', sort_order: 3 },
];

function baseState() {
  mockState.auth = {
    user: {
      id: 'me', username: 'Nabil', email: 'nab@example.test', elo: 1250, level: 'rx', wins: 6, total_matches: 10,
      role: 'box_owner', full_name: 'Nabil Selmane', bio: '#rx', avatar_url: null,
    },
    currentBox: BOX,
    myBoxes: [{ box: BOX, role: 'owner' }, { box: BOX2, role: 'member' }],
    boxRole: 'owner', boxSubscription: { status: 'active' }, daysLeftTrial: 0,
    signOut: jest.fn(), deleteAccount: jest.fn(async () => ({ error: null })), joinBox: jest.fn(async () => ({})),
    leaveBox: jest.fn(async () => ({})), updateUser: jest.fn(), switchBox: jest.fn(async () => {}),
  };
  mockState.ownerSub = { status: 'active', box_quota: 3 };
  mockState.memberships = [{ box_id: 'b2', suspended: true }];
  mockState.badges = BADGES;
  mockState.profileData = {
    wodCount: 37,
    prValues: { 'weightlifting_Back Squat': '120', 'weightlifting_Back Squat_date': '2026-09-01', benchmarks_Fran: '3.5' },
    strengthSessions: [],
    badgesCatalog: BADGES,
    earnedBadges: [{ badge_key: 'first_wod', achieved_at: '2026-09-01' }, { badge_key: 'elo_1200', achieved_at: '2026-09-02' }],
    streak: { current_streak: 3, longest_streak: 5, week_session_count: 2, week_start: '', max_sessions_per_week: 4 },
    friends: [
      { requester_id: 'me', addressee_id: 'f1', addressee: { id: 'f1', username: 'Lina', level: 'rx', avatar_url: null } },
      { requester_id: 'f2', addressee_id: 'me', requester: { id: 'f2', username: LONG, level: 'elite', avatar_url: null } },
    ],
    featuredColumnAvailable: true,
    featuredBadgesCol: ['first_wod'],
  };
  mockState.programs = [{
    start_date: '2026-09-21', status: 'active',
    programs: { id: 'p1', title: 'Force & Condition', type: 'fixed', duration_weeks: 6, days_per_week: 4 },
  }];
  mockState.received = [{ id: 'r1', requester_id: 'u3', addressee_id: 'me', status: 'pending', requester: { id: 'u3', username: 'Marc', level: 'inter', elo: 900 } }];
  mockState.sent = [{ id: 's1', requester_id: 'me', addressee_id: 'u4', status: 'pending', addressee: { id: 'u4', username: 'Julie', level: 'scaled', elo: 700 } }];
  mockState.accepted = [
    { requester_id: 'me', addressee_id: 'f1', addressee: { id: 'f1', username: 'Lina', level: 'rx', elo: 1300 } },
    { requester_id: 'f2', addressee_id: 'me', requester: { id: 'f2', username: LONG, level: 'elite', elo: 1700 } },
  ];
  mockState.search = [
    { id: 'f1', username: 'Lina', level: 'rx', elo: 1300 },
    { id: 'u4', username: 'Julie', level: 'scaled', elo: 700 },
    { id: 'u5', username: 'Tom', level: 'pro', elo: 1900 },
  ];
  mockState.publicUser = { id: 'u9', username: LONG, avatar_url: null, level: 'elite', elo: 1650, wins: 12, total_matches: 20, bio: 'Coach #hyrox du samedi' };
  mockState.publicFriend = { status: 'accepted', requester_id: 'me' };
  mockState.publicFeatured = ['first_wod', 'elo_1200'];
  mockState.elo = [
    { elo_before: 1500, elo_after: 1560, created_at: '2026-09-01T10:00:00Z' },
    { elo_before: 1560, elo_after: 1650, created_at: '2026-09-10T10:00:00Z' },
  ];
  mockState.publicBox = { box_id: 'b1', boxes: { id: 'b1', name: 'CrossFit Lens', city: 'Lens' } };
  mockState.blocked = [
    { id: 'x1', username: 'Spammeur', avatar_url: null },
    { id: 'x2', username: LONG, avatar_url: null },
  ];
  mockState.prefs = {
    ...jest.requireActual('../services/notificationPrefsCache').DEFAULT_NOTIFICATION_PREFS,
    notifications_enabled: true, daily_reminder: true, reminder_hour: 18,
  };
  mockState.changelog = [
    { id: 'c1', title: 'Nouveau minuteur', body: 'Le minuteur passe au nouveau design.', type: 'feature', created_at: '2026-09-20T10:00:00Z' },
    { id: 'c2', title: LONG, body: '', type: 'fix', created_at: '2026-09-10T10:00:00Z' },
    { id: 'c3', title: 'Classement', body: 'Mise à jour du classement.', type: 'update', created_at: '2026-09-01T10:00:00Z' },
  ];
  mockState.reads = [{ changelog_id: 'c2' }];
  mockState.resolve = (table: string, ops: Array<{ method: string; args: unknown[] }>) => {
    const sel = String(ops.find((o) => o.method === 'select')?.args[0] ?? '');
    const eqKey = (k: string) => ops.some((o) => o.method === 'eq' && o.args[0] === k);
    if (ops.some((o) => ['update', 'delete', 'insert', 'upsert'].includes(o.method))) return null;
    switch (table) {
      case 'profiles':
        if (sel.includes('referral_code')) return { referral_code: 'ATH-7K2' };
        if (sel.includes('featured_badges')) return { featured_badges: mockState.publicFeatured };
        if (sel.includes('bio')) return mockState.publicUser;
        return mockState.search;
      case 'friendships':
        if (sel === 'status, requester_id') return mockState.publicFriend;
        if (eqKey('addressee_id')) return mockState.received;
        if (eqKey('requester_id')) return mockState.sent;
        return mockState.accepted;
      case 'program_members': return mockState.programs;
      case 'elo_history': return mockState.elo;
      case 'box_members': return mockState.publicBox;
      case 'app_changelog': return mockState.changelog;
      case 'changelog_reads': return mockState.reads;
      default: return [];
    }
  };
}

// Premier montage du profil (≈ 2 000 lignes + i18n) lent sur les runners CI.
jest.setTimeout(30000);
let renderer: TestRenderer.ReactTestRenderer | null = null;
beforeAll(async () => { await i18n.changeLanguage('fr'); });
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  baseState();
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  jest.clearAllMocks();
  mockCalls.length = 0;
});

export const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
export function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]/gu;
function textsOf(n: ReactTestInstance, out: string[]) {
  if (isHostText(n)) {
    const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
    const s = hostText(n);
    out.push(upper ? s.toUpperCase() : s);
    return;
  }
  n.children.forEach((ch) => { if (typeof ch !== 'string') textsOf(ch, out); });
}
/**
 * Suite ordonnée des textes visibles, puis de chaque fenêtre ouverte. Les
 * emoji décoratifs (remplacés par des icônes Lucide) et la casse sont neutralisés :
 * seul compte le contenu et son ordre.
 */
function structure(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance) => {
    if (n.type === Modal) return;
    if (isHostText(n)) { textsOf(n, out); return; }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch); });
  };
  walk(root);
  for (const m of root.findAllByType(Modal).filter((x) => x.props.visible)) {
    out.push('── fenêtre ──');
    textsOf(m, out);
  }
  return out
    .map((t) => t.replace(EMOJI, '').replace(/\s+/g, ' ').trim().toUpperCase())
    .filter((t) => t.length > 0);
}

export async function flush() {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
export async function mount(el: React.ReactElement, theme: AppTheme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  await flush();
  return renderer!.root;
}
export async function pressText(root: ReactTestInstance, text: string) {
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
  if (!t) throw new Error(`texte introuvable : « ${text} »`);
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress({ stopPropagation: () => {} }); });
  await flush();
}
async function typeIn(root: ReactTestInstance, placeholder: string, value: string, submit = false) {
  const input = root.findAll((n) => String(n.type) === 'TextInput' && n.props.placeholder === placeholder)[0];
  await act(async () => { input.props.onChangeText(value); });
  if (submit) { await act(async () => { input.props.onSubmitEditing(); }); await flush(); }
}

const publicNav = { navigate: mockNavigate, goBack: mockGoBack } as any;
const publicRoute = { params: { userId: 'u9' } } as any;

type Variant = { name: string; run: (th?: AppTheme) => Promise<ReactTestInstance> };
export const VARIANTS: Variant[] = [
  { name: 'profil-compte', run: (th) => mount(<ProfileScreen />, th) },
  { name: 'profil-compte-edition', run: async (th) => { const r = await mount(<ProfileScreen />, th); await pressText(r, 'Modifier'); return r; } },
  { name: 'profil-compte-athlete', run: async (th) => {
    mockState.auth = { ...mockState.auth, user: { ...mockState.auth.user, role: 'athlete', level: 'elite', elo: 1900 }, boxRole: 'member', myBoxes: [], currentBox: null, boxSubscription: null };
    mockState.programs = [];
    mockState.profileData = { ...mockState.profileData, friends: [] };
    return mount(<ProfileScreen />, th);
  } },
  { name: 'profil-pr', run: async (th) => { const r = await mount(<ProfileScreen />, th); await pressText(r, 'PR'); return r; } },
  { name: 'profil-pr-recherche-vide', run: async (th) => {
    const r = await mount(<ProfileScreen />, th); await pressText(r, 'PR');
    await typeIn(r, i18n.t('profile.pr.searchPlaceholder'), 'zzz'); return r;
  } },
  { name: 'profil-stats', run: async (th) => { const r = await mount(<ProfileScreen />, th); await pressText(r, 'Stats'); return r; } },
  { name: 'profil-stats-vide', run: async (th) => {
    mockState.auth = { ...mockState.auth, user: { ...mockState.auth.user, total_matches: 0, wins: 0 } };
    const r = await mount(<ProfileScreen />, th); await pressText(r, 'Stats'); return r;
  } },
  { name: 'profil-badges', run: async (th) => { const r = await mount(<ProfileScreen />, th); await pressText(r, 'Badges'); return r; } },
  { name: 'amis', run: (th) => mount(<FriendsScreen />, th) },
  { name: 'amis-invitations', run: async (th) => { const r = await mount(<FriendsScreen />, th); await pressText(r, 'Invitations (1)'); return r; } },
  { name: 'amis-recherche', run: async (th) => {
    const r = await mount(<FriendsScreen />, th); await pressText(r, 'Rechercher');
    await typeIn(r, 'Rechercher un athlète…', 'a', true); return r;
  } },
  { name: 'amis-vide', run: async (th) => {
    mockState.accepted = []; mockState.received = []; mockState.sent = [];
    const r = await mount(<FriendsScreen />, th); await pressText(r, 'Invitations'); return r;
  } },
  { name: 'amis-vide-liste', run: async (th) => { mockState.accepted = []; return mount(<FriendsScreen />, th); } },
  { name: 'profil-public', run: (th) => mount(<PublicProfileScreen navigation={publicNav} route={publicRoute} />, th) },
  { name: 'profil-public-demande', run: async (th) => {
    mockState.publicFriend = null; mockState.publicFeatured = []; mockState.publicBox = null; mockState.elo = [];
    return mount(<PublicProfileScreen navigation={publicNav} route={publicRoute} />, th);
  } },
  { name: 'profil-public-recue', run: async (th) => {
    mockState.publicFriend = { status: 'pending', requester_id: 'u9' };
    return mount(<PublicProfileScreen navigation={publicNav} route={publicRoute} />, th);
  } },
  { name: 'bloques', run: (th) => mount(<BlockedUsersScreen navigation={publicNav} />, th) },
  { name: 'bloques-vide', run: async (th) => { mockState.blocked = []; return mount(<BlockedUsersScreen navigation={publicNav} />, th); } },
  { name: 'notifications', run: (th) => mount(<NotificationSettingsScreen />, th) },
  { name: 'notifications-coupees', run: async (th) => {
    mockState.prefs = { ...mockState.prefs, notifications_enabled: false };
    return mount(<NotificationSettingsScreen />, th);
  } },
  { name: 'nouveautes', run: (th) => mount(<ChangelogScreen />, th) },
  { name: 'nouveautes-vide', run: async (th) => { mockState.changelog = []; return mount(<ChangelogScreen />, th); } },
];

describe('R12 : ordre des blocs inchangé (instantané pris sur master)', () => {
  const captured: Record<string, string[]> = {};
  afterAll(() => {
    if (process.env.R12_CAPTURE) {
      fs.writeFileSync(path.join(__dirname, 'r12StructureBefore.json'), `${JSON.stringify(captured, null, 2)}\n`);
    }
  });
  for (const v of VARIANTS) {
    it(v.name, async () => {
      const root = await v.run();
      const s = structure(root);
      captured[v.name] = s;
      if (!process.env.R12_CAPTURE) expect(s).toEqual((BEFORE as Record<string, string[]>)[v.name]);
    });
  }
});

// ── Aides ────────────────────────────────────────────────────────────
const THEMES: Array<[string, AppTheme]> = [['clair', lightTheme], ['sombre', darkTheme]];
function byId(root: ReactTestInstance, id: string): ReactTestInstance {
  const n = root.findAll((x) => x.props.testID === id)[0];
  if (!n) throw new Error(`testID introuvable : ${id}`);
  return n;
}
function hostTextById(root: ReactTestInstance, id: string) {
  return root.findAll((x) => isHostText(x) && x.props.testID === id)[0];
}
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
function lum(hex: string) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
function expectTypo(n: ReactTestInstance, name: keyof typeof axTypography) {
  const st = flat(n);
  expect(st.fontFamily).toBe(axTypography[name].fontFamily);
  expect(st.fontSize).toBe(axTypography[name].fontSize);
}
async function pressId(root: ReactTestInstance, id: string) {
  const n = byId(root, id);
  await act(async () => { n.props.onPress({ stopPropagation: () => {} }); });
  await flush();
}
function lastAlertButtons() {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  return calls[calls.length - 1][2] as Array<{ text: string; onPress?: () => unknown }>;
}

describe('R12 : aucun emoji visible, dans les deux thèmes', () => {
  for (const [nom, th] of THEMES) {
    it(`thème ${nom}`, async () => {
      const found: string[] = [];
      for (const v of VARIANTS) {
        baseState();
        const root = await v.run(th);
        const txt: string[] = [];
        textsOf(root, txt);
        for (const t of txt) if (/\p{Extended_Pictographic}/u.test(t)) found.push(`${v.name} : ${t}`);
        const r = renderer!; await act(async () => r.unmount()); renderer = null;
      }
      expect(found).toEqual([]);
    });
  }
});

describe('R12 : composants Ax, typographies et couleurs dans les deux thèmes', () => {
  for (const [nom, th] of THEMES) {
    it(`Profil · en-tête et onglets (${nom})`, async () => {
      const root = await mount(<ProfileScreen />, th);
      const c = th.ax;
      const name = hostTextById(root, 'profile-username');
      expectTypo(name, 'titleXL');
      expect(flat(name).color).toBe(c.text);
      expect(name.props.numberOfLines).toBe(2);
      const elo = hostTextById(root, 'profile-elo-value');
      expectTypo(elo, 'numberM');
      const level = byId(root, 'profile-level').findAll(isHostText)[0];
      expect(ratio(String(flat(level).color), c.surface)).toBeGreaterThanOrEqual(4.5);
      const tabs = byId(root, 'profile-tabs').findAllByType(AxChip);
      expect(tabs.map((t) => t.props.label)).toEqual(['Compte', 'PR', 'Stats', 'Badges']);
      expect(tabs.map((t) => t.props.selected)).toEqual([true, false, false, false]);
    });

    it(`Profil · Compte : cartes, interrupteur, zone dangereuse (${nom})`, async () => {
      const root = await mount(<ProfileScreen />, th);
      expect(root.findAllByType(AxCard).length).toBeGreaterThanOrEqual(10);
      const sw = byId(root, 'profile-theme-switch');
      expect(sw.type).toBe(AxSwitch);
      expect(sw.props.value).toBe(th.mode === 'dark');
      const del = byId(root, 'profile-delete-account');
      expect(del.type).toBe(AxButton);
      expect(del.props.variant).toBe('stop');
      const langs = root.findAllByType(AxChip).filter((x) => String(x.props.testID).startsWith('profile-lang-'));
      expect(langs.map((x) => x.props.label)).toEqual(['Français', 'English']);
    });

    it(`Profil · Stats et PR en numberM (${nom})`, async () => {
      const root = await mount(<ProfileScreen />, th);
      await pressText(root, 'Stats');
      expectTypo(hostTextById(root, 'profile-stat-0-value'), 'numberM');
      expect(byId(root, 'profile-stat-0').type).toBe(AxCard);
      await pressText(root, 'PR');
      expect(byId(root, 'profile-pr-weightlifting').type).toBe(AxCard);
    });

    it(`Profil · Badges en grille de cartes (${nom})`, async () => {
      const root = await mount(<ProfileScreen />, th);
      await pressText(root, 'Badges');
      const card = byId(root, 'profile-badge-first_wod');
      expect(card.type).toBe(AxCard);
      expect(flat(card.parent!).width).toBe('47%');
      expect(root.findAll((x) => x.props.testID === 'profile-badge-first_wod-pin').length).toBeGreaterThan(0);
      const longName = byId(root, 'profile-badge-friends_5').findAll(isHostText)[0];
      expect(longName.props.numberOfLines).toBe(3);
    });

    it(`Amis : onglets AxChip, lignes AxCard, niveau AA (${nom})`, async () => {
      const root = await mount(<FriendsScreen />, th);
      const chips = byId(root, 'friends-tabs').findAllByType(AxChip);
      expect(chips.map((x) => x.props.label)).toEqual(['Mes amis', 'Invitations (1)', 'Rechercher']);
      const row = byId(root, 'friend-f2');
      expect(row.type).toBe(AxCard);
      const texts = row.findAll(isHostText);
      const i = texts.findIndex((x) => hostText(x) === LONG);
      expect(texts[i].props.numberOfLines).toBe(1);
      expectTypo(texts[i], 'label');
      expect(hostText(texts[i + 1])).toBe('ELITE');
      expect(ratio(String(flat(texts[i + 1]).color), th.ax.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it(`Profil public : héros titleXL, stats numberM, périodes AxChip (${nom})`, async () => {
      const root = await mount(<PublicProfileScreen navigation={publicNav} route={publicRoute} />, th);
      expect(byId(root, 'public-hero').type).toBe(AxCard);
      expectTypo(hostTextById(root, 'public-username'), 'titleXL');
      expect(hostTextById(root, 'public-username').props.numberOfLines).toBe(2);
      expectTypo(hostTextById(root, 'public-stat-0-value'), 'numberM');
      const level = byId(root, 'public-level').findAll(isHostText)[0];
      expect(ratio(String(flat(level).color), th.ax.surface)).toBeGreaterThanOrEqual(4.5);
      const periods = byId(root, 'public-elo-chart').findAllByType(AxChip);
      expect(periods.map((x) => x.props.label)).toEqual(['7j', '30j', '1an', 'Tout']);
      expect(byId(root, 'header-share')).toBeTruthy();
    });

    it(`Bloqués : AxCard + AxButton outline (${nom})`, async () => {
      const root = await mount(<BlockedUsersScreen navigation={publicNav} />, th);
      expect(byId(root, 'blocked-x2').type).toBe(AxCard);
      expect(byId(root, 'unblock-x2').props.variant).toBe('outline');
      const name = byId(root, 'blocked-x2').findAll((x) => isHostText(x) && hostText(x) === LONG)[0];
      expect(name.props.numberOfLines).toBe(1);
      expect(flat(name).flex).toBe(1);
    });

    it(`Notifications : AxSwitch, AxCard, heures en AxChip (${nom})`, async () => {
      const root = await mount(<NotificationSettingsScreen />, th);
      expect(byId(root, 'notif-section-master').type).toBe(AxCard);
      expect(byId(root, 'notif-switch-notifications_enabled').type).toBe(AxSwitch);
      expect(root.findAllByType(AxSwitch).length).toBeGreaterThanOrEqual(3);
      expect(byId(root, 'notif-hour-18').props.selected).toBe(true);
    });

    it(`Nouveautés : AxCard, pastille de type lisible (${nom})`, async () => {
      const root = await mount(<ChangelogScreen />, th);
      expect(byId(root, 'changelog-c1').type).toBe(AxCard);
      const label = byId(root, 'changelog-c2-type').findAll(isHostText)[0];
      expect(hostText(label)).toBe('Correction');
      expect(ratio(String(flat(label).color), th.ax.surface)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('R12 : navigation et callbacks inchangés', () => {
  beforeEach(() => { jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });

  it('Profil : thème, langue, ELO, bloqués, notifications, abonnement', async () => {
    const root = await mount(<ProfileScreen />);
    await act(async () => { byId(root, 'profile-theme-switch').props.onValueChange(true); });
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    await pressId(root, 'profile-lang-en');
    expect(mockSetLanguage).toHaveBeenCalledWith('en');
    await pressId(root, 'profile-elo');
    expect(mockNavigate).toHaveBeenCalledWith('EloHistory');
    await pressId(root, 'profile-blocked');
    expect(mockNavigate).toHaveBeenCalledWith('BlockedUsers');
    await pressId(root, 'profile-notifications');
    expect(mockNavigate).toHaveBeenCalledWith('NotificationSettings');
    await pressId(root, 'profile-my-trainings');
    expect(mockNavigate).toHaveBeenCalledWith('WodHistory');
    await pressId(root, 'profile-legal');
    expect(mockNavigate).toHaveBeenCalledWith('Legal');
    await pressId(root, 'profile-friend-f1');
    expect(mockNavigate).toHaveBeenCalledWith('PublicProfile', { userId: 'f1' });
  });

  it('Profil : onglets pilotent le contenu', async () => {
    const root = await mount(<ProfileScreen />);
    await pressId(root, 'profile-tab-stats');
    expect(byId(root, 'profile-tabs').findAllByType(AxChip).map((x) => x.props.selected)).toEqual([false, false, true, false]);
    expect(root.findAll((x) => x.props.testID === 'profile-stat-0').length).toBeGreaterThan(0);
  });

  it('Profil : suppression de compte après deux confirmations', async () => {
    const root = await mount(<ProfileScreen />);
    await pressId(root, 'profile-delete-account');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(mockState.auth.deleteAccount).not.toHaveBeenCalled();
    await act(async () => { lastAlertButtons()[1].onPress!(); });
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    expect(mockState.auth.deleteAccount).not.toHaveBeenCalled();
    await act(async () => { await lastAlertButtons()[1].onPress!(); });
    expect(mockState.auth.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('Amis : onglets, profil public, accepter', async () => {
    const root = await mount(<FriendsScreen />);
    await pressId(root, 'friend-f1');
    expect(mockNavigate).toHaveBeenCalledWith('PublicProfile', { userId: 'f1' });
    await pressId(root, 'friends-tab-requests');
    expect(byId(root, 'friends-tab-requests').props.selected).toBe(true);
    await pressId(root, 'accept-r1');
    expect(mockCalls.some((x) => x.table === 'friendships' && x.method === 'update')).toBe(true);
  });

  it('Profil public : période et partage', async () => {
    const shareSpy = jest.spyOn(jest.requireActual('react-native').Share, 'share').mockResolvedValue({} as never);
    const root = await mount(<PublicProfileScreen navigation={publicNav} route={publicRoute} />);
    await pressId(root, 'public-period-30d');
    expect(byId(root, 'public-period-30d').props.selected).toBe(true);
    await pressId(root, 'header-share');
    expect(shareSpy).toHaveBeenCalledWith({ message: 'Découvre mon profil sur AthleX ! athlex://profile/u9' });
  });

  it('Bloqués : débloquer passe par la confirmation', async () => {
    const root = await mount(<BlockedUsersScreen navigation={publicNav} />);
    await pressId(root, 'unblock-x1');
    expect(mockUnblock).not.toHaveBeenCalled();
    await act(async () => { await lastAlertButtons()[1].onPress!(); });
    expect(mockUnblock).toHaveBeenCalledWith('x1');
  });

  it('Notifications : chaque réglage écrit sa clé', async () => {
    const root = await mount(<NotificationSettingsScreen />);
    await act(async () => { byId(root, 'notif-switch-daily_reminder').props.onValueChange(false); });
    await flush();
    expect(mockSaveNotif).toHaveBeenLastCalledWith('me', { daily_reminder: false });
    await act(async () => { byId(root, 'notif-switch-notifications_enabled').props.onValueChange(false); });
    await flush();
    expect(mockSaveNotif).toHaveBeenLastCalledWith('me', { notifications_enabled: false });
  });

  it('Notifications : heure du rappel', async () => {
    const root = await mount(<NotificationSettingsScreen />);
    await pressId(root, 'notif-hour-7');
    expect(mockSaveNotif).toHaveBeenLastCalledWith('me', { reminder_hour: 7 });
  });

  it('Nouveautés : lecture marquée et accueil invalidé', async () => {
    await mount(<ChangelogScreen />);
    expect(mockCalls.some((x) => x.table === 'changelog_reads' && x.method === 'upsert')).toBe(true);
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['home'] });
  });
});
