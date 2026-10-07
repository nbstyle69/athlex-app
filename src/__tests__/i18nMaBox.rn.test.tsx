/**
 * Chantier anglais, groupe Ma Box + Réservation : chaque écran du groupe est
 * monté avec le vrai react-native (données fictives, aucun réseau).
 * - FR : textes affichés, placeholders, libellés d'accessibilité et alertes
 *   identiques à l'instantané pris sur master avant la traduction
 *   (i18nMaBoxAvant.json ; I18N_MABOX_CAPTURE=<fichier> pour le reprendre).
 * - EN : aucun texte accentué, et aucun texte resté identique au français hors
 *   données fictives (contenu de box) et libellés identiques par nature.
 */
import React from 'react';
import { Alert, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../i18n';
import { lightTheme } from '../theme/palette';
import BEFORE from './i18nMaBoxAvant.json';
import WODDetailScreen from '../screens/whiteboard/WODDetailScreen';
import PersonalWODFormScreen from '../screens/whiteboard/PersonalWODFormScreen';
import ArticlesScreen from '../screens/whiteboard/ArticlesScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import BoxInfoScreen from '../screens/home/BoxInfoScreen';
import CommunityScreen from '../screens/community/CommunityScreen';
import BOBoxInfoScreen from '../screens/backoffice/BOBoxInfoScreen';
import ReportMenu from '../components/ReportMenu';
import WeekDayPicker from '../components/WeekDayPicker';
import ReservationWeekPicker from '../screens/reservation/ReservationWeekPicker';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { strictAllowed } = require('../../scripts/i18n/scanner');

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: Record<string, unknown> | undefined;
const mockTables: Record<string, unknown[]> = {};
let mockUpsertError: { message: string } | null = null;
let mockFailTable: string | null = null;

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
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
const BOX = { id: 'box-1', name: 'Box Alpha', owner_id: 'u9', logo_url: null, slug: 'box-alpha', created_at: '2024-01-15T10:00:00Z' };
const mockAuth: { user: Record<string, unknown>; currentBox: typeof BOX | null; boxRole: string; refreshBox: jest.Mock } = {
  user: { id: 'me', username: 'Sam', avatar_url: null },
  currentBox: BOX,
  boxRole: 'member',
  refreshBox: jest.fn(async () => {}),
};
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').lightTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let sel = '';
    let perso = false;
    let upsert = false;
    const b: Record<string, unknown> = {};
    const rows = () => (perso ? mockTables[`${table}|perso`] ?? [] : mockTables[`${table}|${sel}`] ?? mockTables[table] ?? []) as unknown[];
    for (const m of ['select', 'eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'in', 'or', 'is', 'not', 'contains', 'update', 'delete', 'insert', 'upsert']) {
      b[m] = (...args: unknown[]) => {
        if (m === 'select' && !sel) sel = String(args[0]);
        if (m === 'is' && args[0] === 'box_id' && args[1] === null) perso = true;
        if (m === 'upsert') upsert = true;
        return b;
      };
    }
    const fail = () => mockFailTable === table;
    const one = () => ({ then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      (fail() ? Promise.reject(new Error('boom')) : Promise.resolve({ data: rows()[0] ?? null, error: null })).then(res, rej) });
    b.single = one;
    b.maybeSingle = one;
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      (fail() ? Promise.reject(new Error('boom')) : Promise.resolve(upsert && mockUpsertError
        ? { data: null, error: mockUpsertError }
        : { data: rows(), count: rows().length, error: null })).then(res, rej);
    return b;
  };
  const channel = () => {
    const ch = { on: () => ch, subscribe: () => ch };
    return ch;
  };
  return {
    supabase: {
      from: (t: string) => builder(t), channel, removeChannel: jest.fn(),
      rpc: jest.fn(async () => ({ data: null, error: null })),
      auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    },
  };
});
jest.mock('../lib/storageUrl', () => ({
  resolveStorageUrls: async (xs: string[]) => xs.map((x) => `https://signed.local/${x}`),
  isExternalValue: (v: string) => v.startsWith('https://'),
}));
jest.mock('../lib/messageAttachments', () => ({ uploadMessageAttachment: jest.fn(), MESSAGE_ATTACHMENTS_BUCKET: 'message-attachments' }));
jest.mock('../lib/unreadMessages', () => ({ lastSeenMessagesKey: () => 'k', markMessagesSeen: jest.fn(), countUnreadMessages: jest.fn(async () => 0) }));
jest.mock('../services/membership', () => ({
  ...jest.requireActual('../services/membership'),
  getMyPlanStatus: async () => null,
}));
jest.mock('../lib/analytics', () => ({ trackScoreSubmit: jest.fn() }));
jest.mock('../services/notifications', () => ({
  sendScoreNotification: jest.fn(async () => {}), sendScoreOvertakenNotification: jest.fn(async () => {}),
  cancelTodayScoreReminder: jest.fn(async () => {}), sendNewMessageNotification: jest.fn(async () => {}),
}));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}), logMovementReps: jest.fn(async () => {}), recordActivity: jest.fn(async () => {}) }));
jest.mock('../services/programContent', () => ({ listProgramWodsByProgram: jest.fn(async () => ({})), listProgramRestDaysByProgram: jest.fn(async () => ({})) }));
jest.mock('../services/eloCompute', () => ({ computeAndSaveElo: jest.fn(async () => {}), sortScoresRxFirst: (s: unknown[]) => s }));
jest.mock('../services/strengthPR', () => ({ recordStrengthPRs: jest.fn(async () => []) }));
jest.mock('../utils/eloLevels', () => ({ syncLevelAndBadges: jest.fn(async () => []) }));
jest.mock('../hooks/useMyOneRepMax', () => {
  const none = () => null;
  return { useMyOneRepMax: () => none, useMyRecords: () => ({ oneRepMaxFor: none, gymRecordFor: none, reload: () => {} }) };
});
jest.mock('../services/strengthSets', () => ({
  ...jest.requireActual('../services/strengthSets'),
  fetchStrengthSummaries: jest.fn(async () => ({})),
  loadStrengthGrid: jest.fn(async (_k: unknown, prescription: unknown[]) => ({ drafts: prescription, origin: 'prescription', server: null, pending: null, offline: false })),
  saveStrengthDraft: jest.fn(async () => ({ status: 'saved', updatedAt: '2026-09-28T10:00:00Z' })),
  submitStrengthValidation: jest.fn(),
  fetchStrengthSession: jest.fn(async () => ({ session: null, sets: [] })),
}));
let mockBlockOk = true;
let mockReportId: string | null = 'r1';
jest.mock('../services/moderation', () => ({
  ...jest.requireActual('../services/moderation'),
  getBlockedUserIds: async () => [],
  blockUser: async () => mockBlockOk,
  reportContent: async () => mockReportId,
}));
jest.mock('../components/wod/TimerLaunchModal', () => () => null);
jest.mock('../components/ShareScoreCard', () => () => null);
jest.mock('react-native-webview', () => 'WebView');
jest.mock('react-native-view-shot', () => 'ViewShot');
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn(async () => true) }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-09-28T10:00:00Z');
const TODAY = '2026-09-28';

// Données fictives neutres : aucun accent, aucun mot de la liste du scanner français.
const WOD_AMRAP = {
  id: 'wA', box_id: 'box-1', title: 'Cindy', description: '20 min AMRAP\n5 pull-ups', wod_type: 'amrap', block_name: 'wod',
  scheduled_date: TODAY, time_cap_seconds: 1200, video_url: 'https://youtu.be/abcdefghijk', notes: 'Keep moving',
  track: 'functional', is_published: true, sort_order: 0, leaderboard_enabled: true,
};
const WOD_FORTIME = { ...WOD_AMRAP, id: 'wF', title: 'Fran', description: '21-15-9 thrusters', wod_type: 'for-time', video_url: null, notes: null };
const WOD_PROGRAM = { ...WOD_FORTIME, id: 'wG', scheduled_date: null, program_week: 2, program_day: 3 };
const SCORES = [
  { id: 's1', wod_id: 'wA', member_id: 'u2', score_value: 212, score_type: 'reps', rx: true, capped: false, notes: null,
    profile: { id: 'u2', username: 'Julie', avatar_url: null, level: 'rx', elo: 1320 } },
  { id: 's2', wod_id: 'wA', member_id: 'me', score_value: 180, score_type: 'reps', rx: false, capped: false, notes: 'Good one',
    profile: { id: 'me', username: 'Sam', avatar_url: null, level: 'inter', elo: 1180 } },
  { id: 's3', wod_id: 'wA', member_id: 'u3', score_value: 150, score_type: 'reps', rx: true, capped: false, notes: null,
    profile: null },
];
const PERSO_ROW = {
  id: 'p1', title: 'Helen', description: '3 rounds', wod_type: 'emom', scheduled_date: TODAY,
  time_cap_seconds: 750, rounds: 5, emom_interval_minutes: 2, tabata_work_seconds: null, tabata_rest_seconds: null, notes: 'Easy',
};
const ARTICLES = [
  { id: 'a1', title: 'Open Gym', body: 'Saturday 9am', image_url: null, created_at: '2026-09-27T08:00:00Z', author: { username: 'Coach Lea' } },
];
const COMMENTS = [
  { id: 'c1', user_id: 'me', content: 'Nice', created_at: '2026-09-27T09:00:00Z', profile: { username: 'Sam' } },
];
const GROUPS = [{ id: 'g1', name: 'Team A', color: '#EF4444' }];
const GROUP_MESSAGES = [
  { id: 'm1', group_id: 'g1', sender_id: 'u2', content: 'Hello team', attachment_url: null, created_at: '2026-09-28T08:00:00Z' },
  { id: 'm2', group_id: 'g1', sender_id: 'u7', content: 'Hi', attachment_url: null, created_at: '2026-09-27T08:01:00Z' },
  { id: 'm3', group_id: 'g1', sender_id: 'me', content: 'See you', attachment_url: null, created_at: '2026-09-20T08:05:00Z' },
];
const BOX_MESSAGES = [
  { id: 'b1', box_id: 'box-1', title: 'Closed Friday', body: 'Closed at 6pm', type: 'general', sent_at: '2026-09-27T07:00:00Z', target_group_id: 'g1' },
];
const BOX_ROW = {
  name: 'Box Alpha', description: 'Strong community', logo_url: null, address: '12 Main Street',
  website_url: 'https://box-alpha.local', contact_email: 'hello@box-alpha.local', phone: '0102030405',
  google_maps_url: 'https://maps.local/box', founded_at: '2019-03-01T00:00:00Z', owner_id: 'u9', created_at: '2024-01-15T10:00:00Z',
};
const COMMUNITY = [
  { profiles: { id: 'me', username: 'Sam', level: 'rx', elo: 1200, wins: 3, total_matches: 5, avatar_url: null } },
  { profiles: { id: 'u2', username: 'Julie', level: 'scaled', elo: 1100, wins: 0, total_matches: 0, avatar_url: null } },
];

let renderer: TestRenderer.ReactTestRenderer;
let alerts: string[] = [];
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    alerts.push(['ALERTE', title, message ?? '', ...(buttons ?? []).map((b) => b.text ?? '')].join(' | '));
  });
  mockRouteParams = undefined;
  mockAuth.currentBox = BOX;
  mockUpsertError = null;
  mockFailTable = null;
  mockBlockOk = true;
  mockReportId = 'r1';
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockTables['box_wods|*'] = [WOD_AMRAP];
  mockTables.box_wods = [PERSO_ROW];
  mockTables.wod_scores = SCORES;
  mockTables.score_comments = [];
  mockTables.score_reactions = [];
  mockTables.box_articles = ARTICLES;
  mockTables.box_article_likes = [];
  mockTables.box_article_comments = COMMENTS;
  mockTables.message_groups = GROUPS;
  mockTables.box_messages = BOX_MESSAGES;
  mockTables.group_messages = GROUP_MESSAGES;
  mockTables.profiles = [{ id: 'u2', username: 'Julie', avatar_url: null }, { id: 'me', username: 'Sam', avatar_url: null }];
  mockTables.message_reactions = [];
  mockTables.boxes = [BOX_ROW];
  mockTables['box_members|id'] = [{ id: 'x1' }, { id: 'x2' }];
  mockTables['box_members|member_id, profiles(elo)'] = [{ member_id: 'u2', profiles: { elo: 1300 } }];
  mockTables['box_members|joined_at'] = [{ joined_at: '2025-02-10T00:00:00Z' }];
  mockTables['box_members|member_id, profiles:member_id(username, avatar_url)'] = [
    { member_id: 'c1', profiles: { username: 'Lea', avatar_url: null } },
    { member_id: 'c2', profiles: null },
  ];
  mockTables['box_members|profiles:member_id(id, username, level, elo, wins, total_matches, avatar_url)'] = COMMUNITY;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
afterAll(async () => { await i18n.changeLanguage('fr'); });

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
/** Textes, placeholders et libellés d'accessibilité dans l'ordre de l'arbre ; fenêtres ouvertes à la fin. */
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
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
const withQuery = (el: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>{el}</QueryClientProvider>
);
async function mount(el: React.ReactElement) {
  await act(async () => { renderer = TestRenderer.create(withQuery(el)); });
  await settle();
  return renderer.root;
}
/** Appuie sur l'élément `testID` (le composant qui porte `onPress`). */
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await act(async () => { n.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
/** Appuie sur le texte affiché (français ou anglais selon la langue du test). */
async function pressText(root: ReactTestInstance, texts: { fr: string; en: string }) {
  const text = i18n.language === 'en' ? texts.en : texts.fr;
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
  if (!t) throw new Error(`texte introuvable : ${text}`);
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
/** Appelle le bouton `index` de la dernière alerte affichée. */
async function pressAlertButton(index: number) {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = calls[calls.length - 1][2] as { onPress?: () => unknown }[];
  await act(async () => { await buttons[index].onPress?.(); });
  await settle();
}
const detail = (wod: Record<string, unknown>) => {
  mockTables['box_wods|*'] = [wod];
  mockRouteParams = { wodId: wod.id };
  return <WODDetailScreen />;
};
const withoutMine = () => { mockTables.wod_scores = SCORES.filter((s) => s.member_id !== 'me'); };
const weekDays = Array.from({ length: 7 }, (_, i) => ({ iso: `2026-09-${String(28 + i).padStart(2, '0')}`, dayNumber: 28 + i }));

type Variant = { name: string; run: () => Promise<ReactTestInstance> };
const VARIANTS: Variant[] = [
  // ── Détail du WOD ──
  { name: 'wod-score', run: () => mount(detail(WOD_AMRAP)) },
  { name: 'wod-sans-score', run: () => { withoutMine(); return mount(detail(WOD_AMRAP)); } },
  { name: 'wod-introuvable', run: () => { mockTables['box_wods|*'] = []; mockRouteParams = { wodId: 'x' }; return mount(<WODDetailScreen />); } },
  { name: 'wod-expire', run: () => { withoutMine(); return mount(detail({ ...WOD_AMRAP, scheduled_date: '2026-09-20' })); } },
  { name: 'wod-programme', run: () => { mockTables.wod_scores = []; return mount(detail(WOD_PROGRAM)); } },
  { name: 'wod-saisie-amrap', run: async () => {
    withoutMine();
    const root = await mount(detail(WOD_AMRAP));
    await press(root, 'enter-score');
    return root;
  } },
  { name: 'wod-saisie-temps', run: async () => {
    mockTables.wod_scores = [];
    const root = await mount(detail(WOD_FORTIME));
    await press(root, 'enter-score');
    return root;
  } },
  { name: 'wod-saisie-cap', run: async () => {
    mockTables.wod_scores = [];
    const root = await mount(detail(WOD_FORTIME));
    await press(root, 'enter-score');
    await press(root, 'score-dnf');
    await press(root, 'score-submit');
    return root;
  } },
  { name: 'wod-saisie-invalide', run: async () => {
    withoutMine();
    const root = await mount(detail(WOD_AMRAP));
    await press(root, 'enter-score');
    await press(root, 'score-submit');
    return root;
  } },
  { name: 'wod-saisie-erreur', run: async () => {
    withoutMine();
    mockUpsertError = { message: 'boom' };
    const root = await mount(detail({ ...WOD_AMRAP, wod_type: 'custom' }));
    await press(root, 'enter-score');
    await act(async () => { root.findAll((x) => x.props.testID === 'score-value' && typeof x.props.onChangeText === 'function')[0].props.onChangeText('42'); });
    await press(root, 'score-submit');
    return root;
  } },
  { name: 'wod-saisie-trop', run: async () => {
    withoutMine();
    const root = await mount(detail(WOD_AMRAP));
    await press(root, 'enter-score');
    await act(async () => { root.findAll((x) => x.props.testID === 'score-value' && typeof x.props.onChangeText === 'function')[0].props.onChangeText('99999'); });
    await press(root, 'score-submit');
    return root;
  } },
  { name: 'wod-commentaires-vide', run: async () => {
    const root = await mount(detail(WOD_AMRAP));
    await press(root, 'leader-row-s1');
    return root;
  } },
  { name: 'wod-commentaires', run: async () => {
    mockTables.score_comments = [
      { id: 'k1', score_id: 's1', content: 'Nice', created_at: '2026-09-28T09:00:00Z', author: { id: 'u3', username: 'Karim', avatar_url: null } },
      { id: 'k2', score_id: 's1', content: 'Wow', created_at: '2026-09-28T09:10:00Z', author: null },
    ];
    const root = await mount(detail(WOD_AMRAP));
    await press(root, 'leader-row-s3');
    return root;
  } },
  // ── WOD perso ──
  { name: 'perso-creer', run: () => mount(<PersonalWODFormScreen />) },
  { name: 'perso-creer-vide', run: async () => {
    const root = await mount(<PersonalWODFormScreen />);
    await press(root, 'pwod-save');
    return root;
  } },
  { name: 'perso-tabata', run: async () => {
    const root = await mount(<PersonalWODFormScreen />);
    await press(root, 'pwod-type-tabata');
    return root;
  } },
  { name: 'perso-modifier', run: () => { mockRouteParams = { wodId: 'p1' }; return mount(<PersonalWODFormScreen />); } },
  { name: 'perso-supprimer', run: async () => {
    mockRouteParams = { wodId: 'p1' };
    const root = await mount(<PersonalWODFormScreen />);
    await press(root, 'header-delete');
    return root;
  } },
  // ── Actualités ──
  { name: 'actualites', run: () => mount(<ArticlesScreen />) },
  { name: 'actualites-vide', run: () => { mockTables.box_articles = []; return mount(<ArticlesScreen />); } },
  { name: 'actualite-detail', run: async () => {
    const root = await mount(<ArticlesScreen />);
    await press(root, 'article-a1');
    return root;
  } },
  { name: 'actualite-sans-commentaire', run: async () => {
    mockTables.box_article_comments = [];
    const root = await mount(<ArticlesScreen />);
    await press(root, 'article-a1');
    return root;
  } },
  // ── Messages ──
  { name: 'messages', run: () => mount(<MessagesScreen />) },
  { name: 'messages-vide', run: () => { mockTables.group_messages = []; mockTables.box_messages = []; return mount(<MessagesScreen />); } },
  { name: 'messages-sans-box', run: () => { mockAuth.currentBox = null; return mount(<MessagesScreen />); } },
  { name: 'messages-gif', run: async () => {
    const root = await mount(<MessagesScreen />);
    await press(root, 'messages-gif');
    return root;
  } },
  // ── Infos de la box ──
  { name: 'box-infos', run: () => mount(<BoxInfoScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />) },
  { name: 'box-infos-vide', run: () => { mockFailTable = 'boxes'; return mount(<BoxInfoScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />); } },
  // ── Membres ──
  { name: 'membres', run: () => mount(<CommunityScreen />) },
  { name: 'membres-sans-box', run: () => { mockAuth.currentBox = null; return mount(<CommunityScreen />); } },
  { name: 'membres-recherche-vide', run: async () => {
    const root = await mount(<CommunityScreen />);
    const input = root.findAll((x) => typeof x.props.onChangeText === 'function')[0];
    await act(async () => { input.props.onChangeText('zzz'); });
    return root;
  } },
  // ── Signaler / bloquer ──
  { name: 'signaler-menu', run: async () => {
    const root = await mount(<ReportMenu contentType="message" contentId="m1" reportedUserId="u2" />);
    await press(root, 'report-menu-open');
    return root;
  } },
  { name: 'signaler-formulaire', run: async () => {
    const root = await mount(<ReportMenu contentType="message" contentId="m1" reportedUserId="u2" />);
    await press(root, 'report-menu-open');
    await press(root, 'report-menu-report');
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    await settle();
    return root;
  } },
  { name: 'signaler-envoye', run: async () => {
    const root = await mount(<ReportMenu contentType="message" contentId="m1" reportedUserId="u2" />);
    await press(root, 'report-menu-open');
    await press(root, 'report-menu-report');
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    await press(root, 'report-reason-spam');
    await press(root, 'report-submit');
    mockReportId = null;
    await press(root, 'report-menu-open');
    await press(root, 'report-menu-report');
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    await press(root, 'report-reason-other');
    await press(root, 'report-submit');
    return root;
  } },
  { name: 'bloquer', run: async () => {
    const root = await mount(<ReportMenu contentType="message" contentId="m1" reportedUserId="u2" />);
    await press(root, 'report-menu-open');
    await press(root, 'report-menu-block');
    await pressAlertButton(1);
    mockBlockOk = false;
    await press(root, 'report-menu-open');
    await press(root, 'report-menu-block');
    await pressAlertButton(1);
    return root;
  } },
  // ── Semaines ──
  { name: 'semaine-whiteboard', run: () => mount(<WeekDayPicker weekOffset={0} setWeekOffset={jest.fn()} selectedDate={TODAY} onSelectDate={jest.fn()} theme={lightTheme} />) },
  { name: 'semaine-whiteboard-ax', run: () => mount(<WeekDayPicker weekOffset={0} setWeekOffset={jest.fn()} selectedDate={TODAY} onSelectDate={jest.fn()} theme={lightTheme} variant="ax" />) },
  { name: 'semaine-reservation', run: () => mount(
    <ReservationWeekPicker days={weekDays} selectedDate={TODAY} todayISO={TODAY} maxDate="2026-10-02" forwardDisabled={false} onSelectDate={jest.fn()} onPrev={jest.fn()} onNext={jest.fn()} />,
  ) },
  // ── Infos de la box côté gérant ──
  { name: 'gerant-infos-box', run: () => mount(<BOBoxInfoScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />) },
];

/** Textes des données fictives (contenu des box, jamais traduit), ligne par ligne. */
function dataTexts(): Set<string> {
  const out = new Set<string>();
  (function walk(v: unknown) {
    if (typeof v === 'string') [v, ...v.split('\n')].forEach((l) => out.add(l.toLowerCase()));
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })([BOX, mockAuth.user, mockTables]);
  return out;
}
/** Libellés identiques dans les deux langues : termes techniques, noms propres, mentions imposées. */
const SAME_IN_EN = [
  /^(Tabata|For Time|Custom|GIF|REPS|ROUNDS|NOTES|DESCRIPTION|TYPE|CONTACT|Messages|Article|Violence|Coach|MM|SS)$/i,
  /^DATE \*$/, /^TIME CAP \(mm:ss\)$/i, /^(WORK|REST) \(sec\)$/i, /^\d+(min|h)$/, /^Cap \d/,
  /^21-15-9 Thrusters \+ Pull-ups…$/, /^Powered by GIPHY$/,
  /^Functional Lyon, Box Forge…$/, // exemple de nom de box, identique en EN (disciplineLabels.test.ts)
];
const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;

describe('Ma Box + Réservation, français : textes identiques à master', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const current = collect(await v.run());
    if (process.env.I18N_MABOX_CAPTURE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      const file = process.env.I18N_MABOX_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(current).toEqual(before);
  });
});

describe('Ma Box + Réservation, anglais : aucun texte français', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  afterAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const en = collect(await v.run());
    const DATA = dataTexts();
    const fr =(BEFORE as Record<string, string[]>)[name];
    const strip = (s: string) => s.replace(/^(placeholder|a11y): /, '').replace(/^ALERTE \| /, '');
    const shown = en.filter((s) => s !== '── fenêtre ──');
    // Un accent ne s'écrit pas en anglais : c'est du français.
    const french = shown.filter((s) => ACCENT.test(strip(s)) && !DATA.has(strip(s).toLowerCase()));
    // Texte resté identique à l'instantané français : non traduit, sauf donnée de box ou libellé identique par nature.
    const frSet = new Set(fr.map((s) => s.toLowerCase()));
    const unchanged = shown.filter((s) => frSet.has(s.toLowerCase()) && /\p{L}{2,}/u.test(strip(s))
      && !strip(s).split('\n').every((l) => DATA.has(l.toLowerCase())) && !strictAllowed(strip(s)) && !SAME_IN_EN.some((re) => re.test(strip(s))));
    expect({ name, french, unchanged }).toEqual({ name, french: [], unchanged: [] });
  });
});
