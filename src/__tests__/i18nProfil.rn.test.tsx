/**
 * Chantier anglais, groupe Profil & Accueil : chaque écran du groupe est monté
 * avec le vrai react-native (données fictives, aucun réseau).
 * - FR : textes affichés, placeholders, libellés d'accessibilité, fenêtres,
 *   alertes et partages identiques à l'instantané pris sur master avant la
 *   traduction (i18nProfilAvant.json ; I18N_PROFIL_CAPTURE=<fichier> pour le reprendre).
 * - EN : aucun texte accentué, et aucun texte resté identique au français hors
 *   données fictives et libellés identiques par nature.
 */
import React, { useEffect as mockUseEffect } from 'react';
import { Alert, Linking, Modal, Share, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import BEFORE from './i18nProfilAvant.json';
import ProfileScreen from '../screens/profile/ProfileScreen';
import PublicProfileScreen from '../screens/profile/PublicProfileScreen';
import BlockedUsersScreen from '../screens/profile/BlockedUsersScreen';
import EloHistoryScreen from '../screens/profile/EloHistoryScreen';
import FriendsScreen from '../screens/home/FriendsScreen';
import ChangelogScreen from '../screens/home/ChangelogScreen';
import HomeScreen from '../screens/home/HomeScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordCodeScreen from '../screens/auth/ResetPasswordCodeScreen';
import JoinBoxScreen from '../screens/onboarding/JoinBoxScreen';
import OnboardingTutorialScreen from '../screens/onboarding/OnboardingTutorialScreen';
import InteractiveTour, { BO_TOUR_STEPS, COACH_TOUR_STEPS } from '../components/InteractiveTour';
import ForceUpdateGate from '../components/ForceUpdateGate';
import DateField from '../components/DateField';
import StrengthHistory from '../components/profile/StrengthHistory';
import { lightTheme } from '../theme/palette';
import { WEIGHTLIFTING_PR_MOVEMENTS } from '../screens/profile/prStorage';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { strictAllowed } = require('../../scripts/i18n/scanner');

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockState: Record<string, any> = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, getParent: () => ({ navigate: jest.fn() }), setOptions: jest.fn(), addListener: () => () => {}, canGoBack: () => true }),
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
const mockQueryClient = { invalidateQueries: () => {} };
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
jest.mock('../context/ThemeContext', () => {
  const { lightTheme } = jest.requireActual('../theme/palette');
  return { useTheme: () => ({ theme: lightTheme, mode: 'light', toggleTheme: jest.fn() }) };
});
jest.mock('../hooks/useFocusQuery', () => ({
  useFocusQuery: (key: unknown[]) => ({
    data: key[0] === 'owner-subscription' ? mockState.ownerSub : key[0] === 'home' ? mockState.homeData : mockState.profileData,
    isFetching: false, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('../i18n', () => {
  const actual = jest.requireActual('../i18n');
  return { __esModule: true, ...actual, default: actual.default, setLanguage: jest.fn() };
});
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-updates', () => ({ updateId: null }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/boxInviteCode', () => ({ getMyBoxInviteCode: async () => 'BOX42' }));
jest.mock('../lib/analytics', () => ({
  trackOnboardingStep: jest.fn(), trackOnboardingComplete: jest.fn(), trackOnboardingBoxJoin: jest.fn(), trackOnboardingSkipBox: jest.fn(),
}));
jest.mock('../lib/onboardingStatus', () => ({ markOnboardingCompleted: jest.fn(async () => undefined), ONBOARDING_KEY: 'k' }));
jest.mock('expo-image-picker', () => ({}), { virtual: true });
jest.mock('expo-file-system/legacy', () => ({}), { virtual: true });
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('../components/ReportMenu', () => () => null);
jest.mock('../services/gamification', () => ({
  getBadgesCatalog: async () => mockState.badges,
  getEarnedBadges: async () => [],
  getStreak: async () => null,
  isBadgeUnobtainable: (k: string) => k.startsWith('streak_'),
  incrementCounter: jest.fn(async () => {}),
  awardLevelBadge: jest.fn(async () => true),
  readBadgeQueue: async () => mockState.badgeQueue,
  clearBadgeQueue: async () => {},
}));
jest.mock('../services/myProfile', () => ({
  fetchMyProfile: async () => ({ personal_records: {} }),
  fetchMyPersonalRecords: async () => ({}),
}));
jest.mock('../services/strengthSets', () => ({ fetchMyStrengthSets: async () => [], groupStrengthSessions: () => [] }));
jest.mock('../services/membership', () => ({
  ...jest.requireActual('../services/membership'),
  getMyMemberships: async () => mockState.memberships ?? [],
  getMyPlanStatus: async (id: string) => mockState.plans?.[id] ?? null,
}));
jest.mock('../services/notifications', () => ({
  DEFAULT_NOTIFICATION_PREFS: jest.requireActual('../services/notificationPrefsCache').DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs: async () => mockState.prefs,
  saveNotificationPrefs: jest.fn(async () => {}),
  registerForPushNotifications: async () => null,
  savePushToken: jest.fn(),
  sendFriendRequestNotification: jest.fn(async () => {}),
  sendFriendAcceptedNotification: jest.fn(async () => {}),
}));
jest.mock('../services/moderation', () => ({
  getMyBlockedUsers: async () => mockState.blocked,
  getBlockedUserIds: async () => [],
  unblockUser: async () => mockState.unblockOk,
}));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const ops: Array<{ method: string; args: unknown[] }> = [];
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'or', 'order', 'limit', 'in', 'ilike', 'gt', 'gte', 'lte', 'is', 'not', 'update', 'delete', 'insert', 'upsert', 'single', 'maybeSingle']) {
      b[m] = (...args: unknown[]) => { ops.push({ method: m, args }); return b; };
    }
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
      const write = ops.some((o) => ['update', 'delete', 'insert', 'upsert'].includes(o.method));
      return Promise.resolve(write
        ? { data: null, error: mockState.writeError, count: 0 }
        : { data: mockState.resolve(table, ops), error: null, count: 0 }).then(res, rej);
    };
    return b;
  };
  const channel = () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; };
  return {
    supabase: {
      from: (t: string) => builder(t), channel, removeChannel: jest.fn(),
      rpc: async () => ({ data: [], error: null }),
      auth: {
        updateUser: jest.fn(async () => ({ error: null })), signInWithPassword: jest.fn(async () => ({ error: null })),
        resend: jest.fn(async () => ({ error: null })),
      },
    },
  };
});

const NOW = new Date('2026-09-28T10:00:00Z');
// Données fictives neutres : aucun accent, aucun mot de la liste du scanner français.
const BOX = { id: 'b1', name: 'Box Alpha', logo_url: null };
const BOX2 = { id: 'b2', name: 'Box Beta', slug: 'box-beta', logo_url: null };
const BOX3 = { id: 'b3', name: 'Box Gamma', logo_url: null };
const BADGES = [
  { badge_key: 'first_wod', title: 'First WOD', description: 'Finish one WOD', icon: '🏋️', category: 'wod', sort_order: 1 },
  { badge_key: 'elo_1200', title: 'RX Step', description: 'Reach 1200 ELO', icon: '📈', category: 'elo', sort_order: 2 },
  { badge_key: 'friends_5', title: 'Squad', description: 'Add 5 friends', icon: '🤝', category: 'social', sort_order: 3 },
  { badge_key: 'streak_10', title: 'Streak 10', description: 'Ten in a row', icon: '🔥', category: 'Classement', sort_order: 4 },
];
const SESSIONS = [
  { key: 'k1', sourceType: 'program', sourceId: 'p1', sourceTitle: null, performedAt: '2026-09-20T10:00:00Z', movement: 'back_squat', movementLabel: 'Back Squat',
    sets: [{ setIndex: 1, reps: 5, loadKg: 100, id: 'set1' }, { setIndex: 2, reps: 3, loadKg: 110, id: 'set2' }] },
  { key: 'k2', sourceType: 'box_wod', sourceId: 'w1', sourceTitle: 'Heavy Day', performedAt: '2026-09-22T10:00:00Z', movement: 'deadlift', movementLabel: null,
    sets: [{ setIndex: 1, reps: 1, loadKg: null, id: 'set3' }] },
];

function baseState() {
  for (const k of Object.keys(mockState)) delete mockState[k];
  mockState.auth = {
    user: {
      id: 'me', username: 'Sam', email: 'sam@example.test', elo: 1250, level: 'rx', wins: 6, total_matches: 10,
      role: 'box_owner', full_name: 'Sam Doe', bio: '#rx', avatar_url: null,
    },
    currentBox: BOX,
    myBoxes: [{ box: BOX, role: 'owner' }, { box: BOX2, role: 'member' }],
    boxRole: 'owner', boxSubscription: { status: 'active' }, daysLeftTrial: 0,
    signOut: jest.fn(), deleteAccount: jest.fn(async () => ({ error: null })), joinBox: jest.fn(async () => ({ error: null })),
    leaveBox: jest.fn(async () => ({})), updateUser: jest.fn(), switchBox: jest.fn(async () => {}),
    signIn: jest.fn(async () => ({ error: null })),
    signUp: jest.fn(async () => ({ error: 'CONFIRM_EMAIL', finalUsername: 'Sam' })),
    resetPassword: jest.fn(async () => ({ error: null })),
    resetPasswordWithCode: jest.fn(async () => ({ error: null })),
    skipBox: jest.fn(async () => undefined),
    profileError: null,
  };
  mockState.writeError = null;
  mockState.unblockOk = true;
  mockState.badgeQueue = [];
  mockState.ownerSub = { status: 'active', box_quota: 3 };
  mockState.memberships = [{ box_id: 'b2', suspended: true }];
  mockState.badges = BADGES;
  mockState.profileData = {
    wodCount: 37,
    prValues: { 'weightlifting_Back Squat': '120', 'weightlifting_Back Squat_date': '2026-09-01', 'weightlifting_Back Squat_src': 'set2', benchmarks_Fran: '3.5' },
    strengthSessions: [],
    badgesCatalog: BADGES,
    earnedBadges: [{ badge_key: 'first_wod', achieved_at: '2026-09-01' }, { badge_key: 'elo_1200', achieved_at: '2026-09-02' }],
    streak: { current_streak: 3, longest_streak: 5, week_session_count: 2, week_start: '', max_sessions_per_week: 4 },
    friends: [
      { requester_id: 'me', addressee_id: 'f1', addressee: { id: 'f1', username: 'Lina', level: 'rx', avatar_url: null } },
      { requester_id: 'f2', addressee_id: 'me', requester: { id: 'f2', username: 'Tom', level: 'elite', avatar_url: null } },
    ],
    featuredColumnAvailable: true,
    featuredBadgesCol: ['first_wod'],
  };
  mockState.programs = [{
    start_date: '2026-09-21', status: 'active',
    programs: { id: 'p1', title: 'Engine Six', type: 'fixed', duration_weeks: 6, days_per_week: 4 },
  }];
  mockState.received = [{ id: 'r1', requester_id: 'u3', addressee_id: 'me', status: 'pending', requester: { id: 'u3', username: 'Marc', level: 'inter', elo: 900 } }];
  mockState.receivedNoName = [{ id: 'r2', requester_id: 'u6', addressee_id: 'me', status: 'pending', requester: null }];
  mockState.sent = [{ id: 's1', requester_id: 'me', addressee_id: 'u4', status: 'pending', addressee: { id: 'u4', username: 'Julie', level: 'scaled', elo: 700 } }];
  mockState.accepted = [
    { requester_id: 'me', addressee_id: 'f1', addressee: { id: 'f1', username: 'Lina', level: 'rx', elo: 1300 } },
    { requester_id: 'f2', addressee_id: 'me', requester: { id: 'f2', username: 'Tom', level: 'elite', elo: 1700 } },
  ];
  mockState.search = [
    { id: 'f1', username: 'Lina', level: 'rx', elo: 1300 },
    { id: 'u4', username: 'Julie', level: 'scaled', elo: 700 },
    { id: 'u5', username: 'Kim', level: 'pro', elo: 1900 },
  ];
  mockState.publicUser = { id: 'u9', username: 'Lea', avatar_url: null, level: 'elite', elo: 1650, wins: 12, total_matches: 20, bio: 'Coach #hyrox' };
  mockState.publicFriend = { status: 'accepted', requester_id: 'me' };
  mockState.publicFeatured = ['first_wod', 'elo_1200'];
  mockState.elo = [
    { elo_before: 1500, elo_after: 1560, created_at: '2026-09-01T10:00:00Z' },
    { elo_before: 1560, elo_after: 1650, created_at: '2026-09-10T10:00:00Z' },
  ];
  mockState.publicBox = { box_id: 'b1', boxes: { id: 'b1', name: 'Box Alpha', city: 'Lens' } };
  mockState.blocked = [{ id: 'x1', username: 'Spammer', avatar_url: null }];
  mockState.prefs = {
    ...jest.requireActual('../services/notificationPrefsCache').DEFAULT_NOTIFICATION_PREFS,
    notifications_enabled: true, daily_reminder: true, reminder_hour: 18,
  };
  mockState.changelog = [
    { id: 'c1', title: 'Timer', body: 'New timer design.', type: 'feature', created_at: '2026-09-20T10:00:00Z' },
    { id: 'c2', title: 'Fix', body: '', type: 'fix', created_at: '2026-09-10T10:00:00Z' },
    { id: 'c3', title: 'Board', body: 'Board update.', type: 'update', created_at: '2026-09-01T10:00:00Z' },
  ];
  mockState.reads = [{ changelog_id: 'c2' }];
  mockState.eloWod = [
    { id: 'e4', wod_id: 'w-4', elo_before: 1190, elo_after: 1260, elo_delta: 70, rank: 3, created_at: '2026-09-24T18:05:00', box_wods: { title: 'Fran', wod_type: 'for-time' } },
    { id: 'e1', wod_id: 'w-1', elo_before: 1150, elo_after: 1180, elo_delta: 30, rank: 1, created_at: '2026-06-01T08:30:00', box_wods: { title: 'Cindy', wod_type: 'amrap' } },
  ];
  mockState.eloTournament = [
    { id: 'e2', tournament_id: 't-2', elo_before: 1180, elo_after: 1210, elo_change: 30, final_rank: 2, calculated_at: '2026-09-10T18:00:00', tournaments: { name: 'Battle #3' } },
  ];
  mockState.eloDaily = [
    { id: 'e3', tournament_id: 'd-3', elo_before: 1210, elo_after: 1190, elo_delta: -20, final_rank: 5, calculated_at: '2026-09-15T18:00:00', daily_tournaments: { wod_name: 'Mini Murph' } },
  ];
  mockState.eloMatch = [
    { id: 'e5', match_id: 'm-5', opponent_id: 'p-2', result: 'loss', elo_before: 1260, elo_after: 1250, elo_delta: -10, created_at: '2026-09-27T18:00:00', tournament_bracket_matches: { tournament_id: 't-5', tournaments: { name: 'Sprint #7' } } },
  ];
  mockState.minVersion = '0.0.0';
  mockState.homeData = {
    rank: 122,
    news: { id: 'n1', title: 'Open day', body: 'Bring a friend', image_url: null, created_at: NOW.toISOString(), likes: 12, comments: 3 },
    streak: { current_streak: 1, longest_streak: 3, week_session_count: 1, week_start: '', max_sessions_per_week: 3 },
    unreadChangelog: 2,
    competitions: [{ id: 't1', name: 'Fall Open', status: 'active', participants: 32, maxParticipants: 48, startDate: '26 sept.' }],
    pendingFriends: 1,
    recentScores: [
      { id: 's1', score_value: '8 + 22', submitted_at: '2026-09-26T10:00:00Z', wod_title: 'AMRAP 14', status: 'pending' },
      { id: 's2', score_value: '5:12', submitted_at: '2026-09-21T10:00:00Z', wod_title: 'Fran', status: 'approved' },
      { id: 's3', score_value: '4:40', submitted_at: '2026-09-20T10:00:00Z', wod_title: 'Grace', status: 'rejected' },
    ],
    totalWods: 37, totalScoresGen: 1, favCount: 0,
    weekActivity: [0, 1, 0, 0, 0, 0, 0], weekReservations: [1, 0, 0, 0, 0, 0, 0],
    weekWodsTotal: 1, weekResTotal: 1, activeDayStreak: 0, totalReservations: 48, genStreak: 0,
    bestScores: [{ name: 'EMOM 15', value: '25 reps', type: 'reps' }],
    physComps: [{ id: 'p1', name: 'Lens Throwdown', logo_url: null, mode: 'physical' }],
  };
  mockState.resolve = (table: string, ops: Array<{ method: string; args: unknown[] }>) => {
    const sel = String(ops.find((o) => o.method === 'select')?.args[0] ?? '');
    const eqKey = (k: string) => ops.some((o) => o.method === 'eq' && o.args[0] === k);
    switch (table) {
      case 'profiles':
        if (sel.includes('referral_code')) return { referral_code: 'ATH-7K2' };
        if (sel.includes('featured_badges')) return { featured_badges: mockState.publicFeatured };
        if (sel.includes('bio')) return mockState.publicUser;
        if (eqKey('id') || ops.some((o) => o.method === 'in')) return [{ id: 'p-2', username: 'Diego B.' }];
        return mockState.search;
      case 'friendships':
        if (sel === 'status, requester_id') return mockState.publicFriend;
        if (eqKey('addressee_id')) return mockState.received;
        if (eqKey('requester_id')) return mockState.sent;
        return mockState.accepted;
      case 'program_members': return mockState.programs;
      case 'elo_history': return sel.includes('box_wods') ? mockState.eloWod : mockState.elo;
      case 'tournament_elo_history': return mockState.eloTournament;
      case 'daily_tournament_elo_history': return mockState.eloDaily;
      case 'tournament_match_elo_history': return mockState.eloMatch;
      case 'box_members': return mockState.publicBox;
      case 'app_changelog': return mockState.changelog;
      case 'changelog_reads': return mockState.reads;
      case 'app_config': return { value: mockState.minVersion };
      default: return [];
    }
  };
}

// Premier montage du profil (≈ 2 000 lignes + i18n) lent sur les runners CI.
jest.setTimeout(30000);
let renderer: TestRenderer.ReactTestRenderer | null = null;
let alerts: string[] = [];
beforeEach(async () => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  baseState();
  await AsyncStorage.clear();
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    alerts.push(['ALERTE', title, message ?? '', ...(buttons ?? []).map((b) => b.text ?? '')].join(' | '));
  });
  jest.spyOn(Share, 'share').mockImplementation(async (c) => {
    alerts.push(`PARTAGE | ${'message' in c ? c.message : ''}`);
    return { action: 'dismissedAction' };
  });
  jest.spyOn(Linking, 'openURL').mockImplementation(async () => true);
});
afterEach(async () => {
  if (renderer) { const r = renderer; renderer = null; await act(async () => r.unmount()); }
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
afterAll(async () => { await i18n.changeLanguage('fr'); });

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
/** Textes, placeholders et libellés d'accessibilité dans l'ordre de l'arbre ; fenêtres ouvertes, puis alertes. */
function collect(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance, inModal: boolean) => {
    if (n.type === Modal && !inModal) return;
    if (typeof n.type === 'string') {
      if (typeof n.props.placeholder === 'string') out.push(`placeholder: ${n.props.placeholder}`);
      if (typeof n.props.accessibilityLabel === 'string') out.push(`a11y: ${n.props.accessibilityLabel}`);
    }
    if (isHostText(n)) {
      const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
      out.push(upper ? hostText(n).toUpperCase() : hostText(n));
      return;
    }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch, inModal); });
  };
  walk(root, false);
  for (const m of root.findAllByType(Modal).filter((x) => x.props.visible)) {
    out.push('── fenêtre ──');
    walk(m, true);
  }
  return [...out, ...alerts].filter((t) => t.replace(/^(placeholder|a11y): /, '').trim().length > 0);
}
async function settle() {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
async function mount(el: React.ReactElement) {
  await act(async () => { renderer = TestRenderer.create(el); });
  await settle();
  return renderer!.root;
}
async function tap(n: ReactTestInstance) {
  await act(async () => { await n.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
/** Appuie sur l'élément `testID` (le composant qui porte `onPress`, ou son premier descendant appuyable). */
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0]
    ?? root.findAll((x) => x.props.testID === id)[0]?.findAll((x) => typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await tap(n);
}
/** Appuie sur le texte affiché (français ou anglais selon la langue du test). */
async function pressText(root: ReactTestInstance, texts: { fr: string; en: string }) {
  const text = i18n.language === 'en' ? texts.en : texts.fr;
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
  if (!t) throw new Error(`texte introuvable : ${text}`);
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  await tap(n);
}
async function pressA11y(root: ReactTestInstance, texts: { fr: string; en: string }) {
  const label = i18n.language === 'en' ? texts.en : texts.fr;
  const n = root.findAll((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`libellé introuvable : ${label}`);
  await tap(n);
}
/** Appelle le bouton `index` de la dernière alerte affichée. */
async function pressAlertButton(index: number) {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = calls[calls.length - 1][2] as { onPress?: () => unknown }[];
  await act(async () => { await buttons[index].onPress?.(); });
  await settle();
}
async function typeAt(root: ReactTestInstance, index: number, value: string) {
  const input = root.findAll((n) => String(n.type) === 'TextInput')[index];
  await act(async () => { input.props.onChangeText(value); });
}

const TAB = {
  pr: { fr: 'PR', en: 'PR' }, stats: { fr: 'Stats', en: 'Stats' }, badges: { fr: 'Badges', en: 'Badges' },
};
const nav = { navigate: mockNavigate, goBack: mockGoBack } as never;
const publicRoute = { params: { userId: 'u9' } } as never;
const publicProfile = () => <PublicProfileScreen navigation={nav} route={publicRoute} />;
const asAthlete = () => {
  mockState.auth = { ...mockState.auth, user: { ...mockState.auth.user, role: 'athlete', level: 'elite', elo: 1900 }, boxRole: 'member', myBoxes: [], currentBox: null, boxSubscription: null };
  mockState.programs = [];
  mockState.profileData = { ...mockState.profileData, friends: [] };
};
async function friendsSearch() {
  const root = await mount(<FriendsScreen />);
  await pressText(root, { fr: 'Rechercher', en: 'Search' });
  await typeAt(root, 0, 'a');
  await act(async () => { root.findAll((n) => String(n.type) === 'TextInput')[0].props.onSubmitEditing(); });
  await settle();
  return root;
}
async function tourStep(steps: typeof BO_TOUR_STEPS, n: number) {
  const root = await mount(<InteractiveTour steps={steps} />);
  for (let i = 1; i < n; i++) await pressText(root, { fr: 'Suivant', en: 'Next' });
  return root;
}
async function login(error: string | null) {
  mockState.auth.signIn = jest.fn(async () => ({ error }));
  const root = await mount(<LoginScreen navigation={nav} />);
  await typeAt(root, 0, 'sam@example.test');
  await typeAt(root, 1, 'secret123');
  await pressA11y(root, { fr: 'Se connecter', en: 'Sign in' });
  return root;
}
async function register(result: { error: string | null; finalUsername?: string }) {
  mockState.auth.signUp = jest.fn(async () => result);
  const root = await mount(<RegisterScreen navigation={nav} />);
  await typeAt(root, 0, 'Sam');
  await typeAt(root, 1, 'sam@example.test');
  await typeAt(root, 2, 'secret123');
  await tap(root.findAll((n) => n.props.accessibilityRole === 'checkbox' && typeof n.props.onPress === 'function')[0]);
  await pressA11y(root, { fr: 'Créer un compte', en: 'Create account' });
  return root;
}

type Variant = { name: string; run: () => Promise<ReactTestInstance> };
const VARIANTS: Variant[] = [
  // ── Profil ──
  { name: 'profil-compte', run: () => mount(<ProfileScreen />) },
  { name: 'profil-compte-edition', run: async () => { const r = await mount(<ProfileScreen />); await pressText(r, { fr: 'Modifier', en: 'Edit' }); return r; } },
  { name: 'profil-compte-athlete', run: () => { asAthlete(); return mount(<ProfileScreen />); } },
  { name: 'profil-sans-pseudo', run: async () => {
    mockState.auth = { ...mockState.auth, user: { ...mockState.auth.user, username: undefined, level: undefined, elo: 3000 } };
    const r = await mount(<ProfileScreen />);
    await pressText(r, { fr: 'Modifier', en: 'Edit' });
    return r;
  } },
  { name: 'profil-programme-continu', run: () => {
    mockState.programs = [
      { start_date: '2026-09-21', status: 'active', programs: { id: 'p2', title: 'Engine Open', type: 'ongoing', duration_weeks: null, days_per_week: 3 } },
      { start_date: null, status: 'active', programs: { id: 'p3', title: 'Engine Later', type: 'fixed', duration_weeks: 4, days_per_week: 2 } },
    ];
    return mount(<ProfileScreen />);
  } },
  { name: 'profil-rejoindre-box', run: async () => { const r = await mount(<ProfileScreen />); await press(r, 'profile-join-box'); return r; } },
  { name: 'profil-rejoindre-programme', run: async () => {
    const r = await mount(<ProfileScreen />);
    await pressText(r, { fr: 'Rejoindre un programme', en: 'Join a program' });
    return r;
  } },
  { name: 'profil-pr', run: async () => { const r = await mount(<ProfileScreen />); await pressText(r, TAB.pr); return r; } },
  { name: 'profil-pr-temps-invalide', run: async () => {
    const r = await mount(<ProfileScreen />);
    await pressText(r, TAB.pr);
    await press(r, 'profile-pr-benchmarks');
    await press(r, 'profile-pr-value-benchmarks_Fran');
    const input = r.findAll((n) => String(n.type) === 'TextInput' && n.props.placeholder === 'mm:ss')[0];
    await act(async () => { input.props.onChangeText('abc'); });
    let n: ReactTestInstance | null = input;
    while (n && !n.parent?.findAll((x) => typeof x.props.onPress === 'function').length) n = n.parent;
    await tap(n!.parent!.findAll((x) => typeof x.props.onPress === 'function')[0]);
    return r;
  } },
  { name: 'profil-pr-series', run: async () => {
    mockState.profileData = { ...mockState.profileData, strengthSessions: SESSIONS };
    const r = await mount(<ProfileScreen />);
    await pressText(r, TAB.pr);
    return r;
  } },
  { name: 'profil-stats', run: async () => { const r = await mount(<ProfileScreen />); await pressText(r, TAB.stats); return r; } },
  { name: 'profil-stats-vide', run: async () => {
    mockState.auth = { ...mockState.auth, user: { ...mockState.auth.user, total_matches: 0, wins: 0 } };
    const r = await mount(<ProfileScreen />);
    await pressText(r, TAB.stats);
    return r;
  } },
  { name: 'profil-badges', run: async () => { const r = await mount(<ProfileScreen />); await pressText(r, TAB.badges); return r; } },
  { name: 'series-vide', run: () => mount(<StrengthHistory sessions={[]} prSourceIds={new Set()} />) },
  { name: 'series', run: () => mount(<StrengthHistory sessions={SESSIONS} prSourceIds={new Set(['set2'])} />) },
  // ── Amis ──
  { name: 'amis', run: () => mount(<FriendsScreen />) },
  { name: 'amis-invitations', run: async () => {
    mockState.received = [...mockState.received, ...mockState.receivedNoName];
    mockState.sent = [...mockState.sent, { id: 's2', requester_id: 'me', addressee_id: 'u8', status: 'pending', addressee: null }];
    const r = await mount(<FriendsScreen />);
    await pressText(r, { fr: 'Invitations (2)', en: 'Requests (2)' });
    return r;
  } },
  { name: 'amis-recherche', run: friendsSearch },
  { name: 'amis-invitation-envoyee', run: async () => { const r = await friendsSearch(); await pressText(r, { fr: 'Ajouter', en: 'Add' }); return r; } },
  { name: 'amis-invitation-deja', run: async () => {
    const r = await friendsSearch();
    mockState.writeError = { code: '23505', message: 'duplicate' };
    await pressText(r, { fr: 'Ajouter', en: 'Add' });
    return r;
  } },
  { name: 'amis-invitation-erreur', run: async () => {
    const r = await friendsSearch();
    mockState.writeError = { code: 'x', message: 'boom' };
    await pressText(r, { fr: 'Ajouter', en: 'Add' });
    return r;
  } },
  { name: 'amis-vide', run: async () => {
    mockState.accepted = []; mockState.received = []; mockState.sent = [];
    const r = await mount(<FriendsScreen />);
    await pressText(r, { fr: 'Invitations', en: 'Requests' });
    return r;
  } },
  { name: 'amis-vide-liste', run: () => { mockState.accepted = []; return mount(<FriendsScreen />); } },
  { name: 'amis-un', run: () => { mockState.accepted = mockState.accepted.slice(0, 1); return mount(<FriendsScreen />); } },
  // ── Profil public ──
  { name: 'profil-public', run: () => mount(publicProfile()) },
  { name: 'profil-public-demande', run: () => {
    mockState.publicFriend = null; mockState.publicFeatured = []; mockState.publicBox = null; mockState.elo = [];
    return mount(publicProfile());
  } },
  { name: 'profil-public-envoyee', run: () => { mockState.publicFriend = { status: 'pending', requester_id: 'me' }; return mount(publicProfile()); } },
  { name: 'profil-public-recue', run: () => { mockState.publicFriend = { status: 'pending', requester_id: 'u9' }; return mount(publicProfile()); } },
  { name: 'profil-public-introuvable', run: () => { mockState.publicUser = null; return mount(publicProfile()); } },
  { name: 'profil-public-partage', run: async () => { const r = await mount(publicProfile()); await press(r, 'header-share'); return r; } },
  { name: 'profil-public-erreur-demande', run: async () => {
    mockState.publicFriend = null;
    const r = await mount(publicProfile());
    mockState.writeError = { message: 'boom' };
    await pressText(r, { fr: 'Demander en ami', en: 'Add friend' });
    return r;
  } },
  { name: 'profil-public-erreur-accepter', run: async () => {
    mockState.publicFriend = { status: 'pending', requester_id: 'u9' };
    const r = await mount(publicProfile());
    mockState.writeError = { message: 'boom' };
    await pressText(r, { fr: 'Accepter', en: 'Accept' });
    return r;
  } },
  // ── Utilisateurs bloqués ──
  { name: 'bloques', run: () => mount(<BlockedUsersScreen navigation={nav} />) },
  { name: 'bloques-vide', run: () => { mockState.blocked = []; return mount(<BlockedUsersScreen navigation={nav} />); } },
  { name: 'bloques-debloquer', run: async () => {
    mockState.unblockOk = false;
    const r = await mount(<BlockedUsersScreen navigation={nav} />);
    await pressText(r, { fr: 'Débloquer', en: 'Unblock' });
    await pressAlertButton(1);
    return r;
  } },
  // ── Historique ELO ──
  { name: 'elo-historique', run: () => mount(<EloHistoryScreen />) },
  { name: 'elo-historique-vide', run: () => {
    mockState.eloWod = []; mockState.eloTournament = []; mockState.eloDaily = []; mockState.eloMatch = [];
    return mount(<EloHistoryScreen />);
  } },
  // ── Notifications, nouveautés ──
  { name: 'notifications', run: () => mount(<NotificationSettingsScreen />) },
  { name: 'notifications-coupees', run: () => { mockState.prefs = { ...mockState.prefs, notifications_enabled: false }; return mount(<NotificationSettingsScreen />); } },
  { name: 'nouveautes', run: () => mount(<ChangelogScreen />) },
  { name: 'nouveautes-vide', run: () => { mockState.changelog = []; return mount(<ChangelogScreen />); } },
  // ── Accueil ──
  { name: 'accueil', run: () => mount(<HomeScreen />) },
  { name: 'accueil-boxes', run: async () => {
    mockState.auth = { ...mockState.auth, myBoxes: [{ box: BOX, role: 'owner' }, { box: BOX2, role: 'coach' }, { box: BOX3, role: 'member' }] };
    const r = await mount(<HomeScreen />);
    let n: ReactTestInstance | null = r.findAll((x) => x.props.testID === 'home-box-name')[0];
    while (n && typeof n.props.onPress !== 'function') n = n.parent;
    await tap(n!);
    return r;
  } },
  { name: 'accueil-badge', run: () => {
    mockState.badgeQueue = [{ badge_key: 'first_wod', title: 'First WOD', description: 'Finish one WOD', icon: '🏋️' }];
    mockState.auth = { ...mockState.auth, user: { ...mockState.auth.user, username: undefined } };
    return mount(<HomeScreen />);
  } },
  // ── Tours guidés gérant et coach ──
  ...[1, 2, 3, 4].map((n) => ({ name: `tour-gerant-${n}`, run: () => tourStep(BO_TOUR_STEPS, n) })),
  ...[1, 2, 3, 4].map((n) => ({ name: `tour-coach-${n}`, run: () => tourStep(COACH_TOUR_STEPS, n) })),
  // ── Connexion, inscription, mot de passe ──
  { name: 'connexion', run: () => mount(<LoginScreen navigation={nav} />) },
  { name: 'connexion-non-confirme', run: () => login('Email not confirmed') },
  { name: 'connexion-version', run: async () => { const r = await mount(<LoginScreen navigation={nav} />); await press(r, 'login-version'); return r; } },
  { name: 'connexion-mot-de-passe-visible', run: async () => {
    const r = await mount(<LoginScreen navigation={nav} />);
    await pressA11y(r, { fr: 'Afficher le mot de passe', en: 'Show password' });
    return r;
  } },
  { name: 'creer-un-compte', run: () => mount(<RegisterScreen navigation={nav} />) },
  { name: 'creer-un-compte-mail-a-confirmer', run: () => register({ error: 'CONFIRM_EMAIL', finalUsername: 'Sam' }) },
  { name: 'creer-un-compte-mail-pseudo-pris', run: () => register({ error: 'CONFIRM_EMAIL', finalUsername: 'Sam2' }) },
  { name: 'creer-un-compte-pseudo-modifie', run: () => register({ error: null, finalUsername: 'Sam2' }) },
  { name: 'creer-un-compte-cgu-cochees', run: async () => {
    const r = await mount(<RegisterScreen navigation={nav} />);
    await pressA11y(r, { fr: 'Afficher le mot de passe', en: 'Show password' });
    await tap(r.findAll((n) => n.props.accessibilityRole === 'checkbox' && typeof n.props.onPress === 'function')[0]);
    return r;
  } },
  { name: 'mot-de-passe-oublie', run: () => mount(<ForgotPasswordScreen navigation={nav} />) },
  { name: 'nouveau-mot-de-passe', run: async () => {
    const r = await mount(<ResetPasswordCodeScreen navigation={nav} route={{ params: { email: 'sam@example.test' } } as never} />);
    await pressA11y(r, { fr: 'Afficher le mot de passe', en: 'Show password' });
    return r;
  } },
  // ── Embarquement ──
  { name: 'rejoins-ta-box', run: () => mount(<JoinBoxScreen navigation={nav} />) },
  { name: 'tutoriel', run: () => {
    // Compteur ELO animé en boucle : animations figées pour un texte stable (ELO 1000).
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'queueMicrotask'] });
    mockState.auth = { ...mockState.auth, currentBox: null };
    return mount(<OnboardingTutorialScreen onDone={jest.fn()} />);
  } },
  // ── Composants ──
  { name: 'mise-a-jour-requise', run: () => { mockState.minVersion = '99.0.0'; return mount(<ForceUpdateGate><></></ForceUpdateGate>); } },
  { name: 'date-invalide', run: () => mount(<DateField value="2026-13-45" onChangeText={jest.fn()} theme={lightTheme} />) },
];

/** Textes des données fictives (jamais traduits), ligne par ligne. */
function dataTexts(): Set<string> {
  const out = new Set<string>();
  (function walk(v: unknown) {
    if (typeof v === 'string') [v, ...v.split('\n')].forEach((l) => out.add(l.toLowerCase()));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { out.add(k.toLowerCase()); walk(x); });
  })([mockState, BADGES, SESSIONS]);
  // Noms de mouvements des PR : clés stockées en base (prKey), jamais traduites.
  const src = require('fs').readFileSync(require.resolve('../screens/profile/ProfileScreen.tsx'), 'utf8') as string;
  for (const m of src.matchAll(/movement: '([^']+)'/g)) out.add(m[1].toLowerCase());
  for (const m of WEIGHTLIFTING_PR_MOVEMENTS) out.add(m.toLowerCase());
  return out;
}
/** Libellés identiques dans les deux langues : termes techniques, noms propres, mentions imposées. */
const SAME_IN_EN = [
  /^(PR|Stats|Badges|Notifications|Messages|Whiteboard|Dashboard|WODs|Coach|English|Fran|Grace|Helen|Cindy|Diane|DT|Murph|Box|Cardio|Bio|Email|E-mail|OK|ABC123|Photo|Scores|Français|ATH-7K2|Win rate|Cardio & Endurance|ELO & inter-box)$/i,
  / · vs /, // « vs » devant l'adversaire, identique en anglais (eloHistory.versus)
  /^\d+ records?$/, /^\d+\/\d+ participants$/,
  /^Version v\d/, // « Version » suivi du numéro, identique en anglais (auth.versionA11y)
  /ELO · Pro Legend$/, // nom du palier le plus haut, identique en anglais (profile.elo.maxLevelNote)
];
const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;

describe('Profil & Accueil, français : textes identiques à master', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const current = collect(await v.run());
    if (process.env.I18N_PROFIL_CAPTURE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      const file = process.env.I18N_PROFIL_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(current).toEqual(before);
  });
});

describe('Profil & Accueil, anglais : aucun texte français', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  afterAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const en = collect(await v.run());
    const DATA = dataTexts();
    const fr = (BEFORE as Record<string, string[]>)[name];
    const strip = (s: string) => s.replace(/^(placeholder|a11y): /, '').replace(/^(ALERTE|PARTAGE) \| /, '');
    const isData = (s: string) => s.split(/\n|, | — | · | \| /).every((l) => !/\p{L}/u.test(l) || DATA.has(l.trim().toLowerCase()));
    const shown = en.filter((s) => s !== '── fenêtre ──');
    const french = shown.filter((s) => ACCENT.test(strip(s)) && !isData(strip(s)) && !SAME_IN_EN.some((re) => re.test(strip(s))));
    const frSet = new Set(fr.map((s) => s.toLowerCase()));
    const unchanged = shown.filter((s) => frSet.has(s.toLowerCase()) && /\p{L}{2,}/u.test(strip(s))
      && !isData(strip(s)) && !strictAllowed(strip(s)) && !SAME_IN_EN.some((re) => re.test(strip(s))));
    expect({ name, french, unchanged }).toEqual({ name, french: [], unchanged: [] });
  });
});
