import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lightTheme, darkTheme } from '../theme/palette';
import BEFORE from './r9bStructureBefore.json';
import ArticlesScreen from '../screens/whiteboard/ArticlesScreen';
import PersonalWODFormScreen from '../screens/whiteboard/PersonalWODFormScreen';
import BoxRankingScreen from '../screens/leaderboard/BoxRankingScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import BoxInfoScreen from '../screens/home/BoxInfoScreen';
import WhiteboardMembersModal, { WhiteboardMember } from '../screens/whiteboard/WhiteboardMembersModal';

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
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
const mockAuth = {
  user: { id: 'me', username: 'Moi' },
  currentBox: { id: 'box-1', name: 'CrossFit Fictif', logo_url: null, created_at: '2024-01-15T10:00:00Z' },
};
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let sel = '';
    const b: Record<string, unknown> = {};
    const rows = () => (mockTables[`${table}|${sel}`] ?? mockTables[table] ?? []) as unknown[];
    for (const m of ['select', 'eq', 'order', 'limit', 'in', 'or', 'is', 'contains', 'update', 'delete', 'insert']) {
      b[m] = (...args: unknown[]) => {
        mockCalls.push({ table, method: m, args });
        if (m === 'select' && !sel) sel = String(args[0]);
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
  return { supabase: { from: (t: string) => builder(t), channel, removeChannel: jest.fn() } };
});
jest.mock('../lib/storageUrl', () => ({
  resolveStorageUrls: async (xs: string[]) => xs.map((x) => `https://signe.local/${x}`),
  isExternalValue: (v: string) => v.startsWith('https://'),
}));
jest.mock('../lib/messageAttachments', () => ({ uploadMessageAttachment: jest.fn(), MESSAGE_ATTACHMENTS_BUCKET: 'message-attachments' }));
jest.mock('../lib/unreadMessages', () => ({ lastSeenMessagesKey: () => 'k', markMessagesSeen: jest.fn() }));
jest.mock('../services/notifications', () => ({ sendNewMessageNotification: jest.fn(async () => {}) }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}) }));
jest.mock('../services/moderation', () => ({ getBlockedUserIds: async () => [] }));
jest.mock('../components/ReportMenu', () => () => null);
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-09-28T10:00:00');
const LONG = 'Un intitulé particulièrement long pour vérifier qu’aucun texte ne déborde à 390 points de large';
const LONG_NAME = 'Maximilien-Alexandre de la Fontaine-Beaumarchais';

const ARTICLES = [
  { id: 'a1', title: LONG, body: 'Ouverture le samedi matin pour un WOD en équipe, venez nombreux.', image_url: null, created_at: '2026-09-27T08:00:00Z', author: { username: 'Coach Léa' } },
  { id: 'a2', title: 'Nouveaux horaires', body: '', image_url: null, created_at: '2026-09-20T08:00:00Z', author: { username: 'Coach Tom' } },
];
const COMMENTS = [
  { id: 'c1', user_id: 'me', content: 'Je serai là !', created_at: '2026-09-27T09:00:00Z', profile: { username: 'Moi' } },
  { id: 'c2', user_id: 'u2', content: 'Top', created_at: '2026-09-27T09:30:00Z', profile: { username: 'Julie' } },
];
const MEMBERS: WhiteboardMember[] = [
  { id: 'u2', username: LONG_NAME, level: 'rx', elo: 1420, avatar_url: null },
  { id: 'u3', username: 'Julie', level: 'scaled', elo: 1100, avatar_url: null },
  { id: 'u4', username: 'Karim', level: 'elite', elo: 980, avatar_url: null },
];
const RANK_MEMBERS = [
  { member_id: 'u2', profiles: { id: 'u2', username: LONG_NAME, avatar_url: null, level: 'rx' } },
  { member_id: 'me', profiles: { id: 'me', username: 'Moi', avatar_url: null, level: 'inter' } },
  { member_id: 'u3', profiles: { id: 'u3', username: 'Julie', avatar_url: null, level: 'scaled' } },
  { member_id: 'u4', profiles: { id: 'u4', username: 'Karim', avatar_url: null, level: 'elite' } },
];
const RANK_ELO = [
  { member_id: 'u2', elo: 1320, matches: 12, wins: 7 },
  { member_id: 'me', elo: 1210, matches: 1, wins: 1 },
  { member_id: 'u3', elo: 1100, matches: 4, wins: 1 },
  { member_id: 'u4', elo: 990, matches: 3, wins: 0 },
];
const WOD_ROW = {
  id: 'w1', title: 'Cindy', description: '20 min AMRAP', wod_type: 'emom', scheduled_date: '2026-09-28',
  time_cap_seconds: 750, rounds: 5, emom_interval_minutes: 2, tabata_work_seconds: null, tabata_rest_seconds: null, notes: 'Scaling libre',
};
const GROUPS = [
  { id: 'g1', name: 'Compétiteurs', color: '#EF4444' },
  { id: 'g2', name: 'Groupe du matin au nom vraiment très long', color: null },
];
const GROUP_MESSAGES = [
  { id: 'm1', group_id: 'g1', sender_id: 'u2', content: LONG, attachment_url: null, created_at: '2026-09-28T08:00:00Z' },
  { id: 'm2', group_id: 'g1', sender_id: 'u2', content: '📷 Image', attachment_url: 'https://media.giphy.local/gif.gif', created_at: '2026-09-28T08:01:00Z' },
  { id: 'm3', group_id: 'g1', sender_id: 'me', content: 'Bien reçu, à demain', attachment_url: null, created_at: '2026-09-28T08:05:00Z' },
];
const BOX_MESSAGES = [
  { id: 'b1', box_id: 'box-1', title: 'Fermeture', body: 'La salle ferme à 18 h vendredi.', type: 'general', sent_at: '2026-09-27T07:00:00Z', target_group_id: 'g1' },
];
const REACTIONS = [
  { message_id: 'gc-m1', emoji: '🔥', member_id: 'me' },
  { message_id: 'gc-m1', emoji: '🔥', member_id: 'u3' },
];
const BOX_ROW = {
  name: 'CrossFit Fictif', description: 'Une box de test aux données fictives.', logo_url: null, address: '12 rue de l’Exemple, 69000 Lyon',
  website_url: 'https://box-fictive.local', contact_email: 'contact@box-fictive.local', phone: '0102030405',
  google_maps_url: 'https://maps.local/box', founded_at: '2019-03-01T00:00:00Z', owner_id: 'u9', created_at: '2024-01-15T10:00:00Z',
};

let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  mockRouteParams = undefined;
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockTables.box_articles = ARTICLES;
  mockTables.box_article_likes = [];
  mockTables['box_article_likes|article_id'] = [];
  mockTables.box_article_comments = COMMENTS;
  mockTables['box_members|member_id, profiles(id, username, avatar_url, level)'] = RANK_MEMBERS;
  mockTables.box_elo = RANK_ELO;
  mockTables.box_wods = [WOD_ROW];
  mockTables.message_groups = GROUPS;
  mockTables.box_messages = BOX_MESSAGES;
  mockTables.group_messages = GROUP_MESSAGES;
  mockTables.profiles = [{ id: 'u2', username: LONG_NAME, avatar_url: null }, { id: 'me', username: 'Moi', avatar_url: null }];
  mockTables.message_reactions = REACTIONS;
  mockTables.boxes = [BOX_ROW];
  mockTables['box_members|id'] = [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }];
  mockTables['box_members|member_id, profiles(elo)'] = [{ member_id: 'u2', profiles: { elo: 1300 } }, { member_id: 'u3', profiles: { elo: 1100 } }];
  mockTables['box_members|joined_at'] = [{ joined_at: '2025-02-10T00:00:00Z' }];
  mockTables['box_members|member_id, profiles:member_id(username, avatar_url)'] = [
    { member_id: 'c1', profiles: { username: 'Coach Léa', avatar_url: null } },
    { member_id: 'c2', profiles: { username: LONG_NAME, avatar_url: null } },
  ];
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
    if (isHostText(n)) { textsOf(n, out); return; }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch); });
  };
  walk(root);
  for (const m of root.findAllByType(Modal).filter((x) => x.props.visible)) {
    out.push('── fenêtre ──');
    textsOf(m, out);
  }
  return out.filter((t) => t.trim().length > 0);
}
async function pressText(root: ReactTestInstance, text: string) {
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress(); });
  await settle();
}
async function settle() {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
async function mount(el: React.ReactElement, theme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  await settle();
  return renderer.root;
}
const withQuery = (el: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>{el}</QueryClientProvider>
);
const membersModal = (members = MEMBERS, onClose = jest.fn(), onOpenProfile = jest.fn()) => (
  <WhiteboardMembersModal visible boxName="CrossFit Fictif" loading={false} members={members} onClose={onClose} onOpenProfile={onOpenProfile} />
);

type Variant = { name: string; run: (theme?: typeof lightTheme) => Promise<ReactTestInstance> };
const VARIANTS: Variant[] = [
  { name: 'actualites-liste', run: (th) => mount(<ArticlesScreen />, th) },
  { name: 'actualites-detail', run: async (th) => {
    const root = await mount(<ArticlesScreen />, th);
    await pressText(root, LONG);
    return root;
  } },
  { name: 'membres', run: (th) => mount(membersModal(), th) },
  { name: 'membres-vide', run: (th) => mount(membersModal([]), th) },
  { name: 'seance-creer', run: (th) => mount(<PersonalWODFormScreen />, th) },
  { name: 'seance-modifier', run: async (th) => {
    mockRouteParams = { wodId: 'w1' };
    return mount(<PersonalWODFormScreen />, th);
  } },
  { name: 'seance-tabata', run: async (th) => {
    const root = await mount(<PersonalWODFormScreen />, th);
    await pressText(root, 'Tabata');
    return root;
  } },
  { name: 'classement', run: (th) => mount(withQuery(<BoxRankingScreen />), th) },
  { name: 'messages', run: (th) => mount(<MessagesScreen />, th) },
  { name: 'infos', run: (th) => mount(<BoxInfoScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />, th) },
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
/** Casse et emoji mis à part : les surtitres passent en capitales, les emoji deviennent des icônes Lucide. */
const normalize = (xs: string[]) => xs.map((x) => x.replace(EMOJI, '').trim().toUpperCase()).filter((x) => x.length > 0);

describe('R9b : ordre des blocs et libellés inchangés (instantané pris sur master)', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const root = await v.run();
    const current = structure(root);
    if (process.env.R9B_CAPTURE) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      const file = process.env.R9B_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(normalize(current)).toEqual(normalize(before));
  });
});

export { darkTheme };
