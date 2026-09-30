import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lightTheme, darkTheme } from '../theme/palette';
import { axRadius, axTypography } from '../theme/axTokens';
import { contrast } from '../theme/contrast';
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


const THEMES = [['clair', lightTheme], ['sombre', darkTheme]] as const;
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const byID = (root: ReactTestInstance, id: string) => {
  const n = root.findAll((x) => x.props.testID === id && typeof x.type === 'string')[0]
    ?? root.findAll((x) => x.props.testID === id)[0];
  if (!n) throw new Error(`testID introuvable : ${id}`);
  return n;
};
const hostByID = (root: ReactTestInstance, id: string) => {
  const n = root.findAll((x) => x.props.testID === id && typeof x.type === 'string')[0];
  if (!n) throw new Error(`testID introuvable : ${id}`);
  return n;
};
/** Appui sur l'élément `testID` : on appelle le `onPress` du composant qui le porte. */
async function press(root: ReactTestInstance, id: string, ...args: unknown[]) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await act(async () => { n.props.onPress(...args); });
  await settle();
}
const textNode = (root: ReactTestInstance, text: string) => {
  const n = root.findAll((x) => isHostText(x) && hostText(x) === text)[0];
  if (!n) throw new Error(`texte introuvable : ${text}`);
  return n;
};
/** Couleur de fond effective : premier ancêtre qui peint un fond opaque, sinon le fond de l'app. */
function backgroundOf(n: ReactTestInstance, theme: typeof lightTheme): string {
  let cur: ReactTestInstance | null = n;
  while (cur) {
    const bg = typeof cur.type === 'string' ? flat(cur).backgroundColor : undefined;
    if (typeof bg === 'string' && /^#[0-9A-Fa-f]{6}$/.test(bg)) return bg;
    cur = cur.parent;
  }
  return theme.ax.background;
}
const AA = 4.5;
function expectReadable(root: ReactTestInstance, n: ReactTestInstance, theme: typeof lightTheme, surface?: string) {
  const color = String(flat(n).color);
  const bg = surface ?? backgroundOf(n, theme);
  expect({ text: hostText(n), color, bg, ratio: contrast(color, bg) >= AA }).toEqual({ text: hostText(n), color, bg, ratio: true });
}
/** Un texte long ne déborde pas : dans chaque rangée qu'il traverse, sa branche peut rétrécir. */
function expectNoOverflow(n: ReactTestInstance) {
  let child: ReactTestInstance = n;
  let cur = n.parent;
  while (cur) {
    if (typeof cur.type === 'string' && flat(cur).flexDirection === 'row' && flat(cur).flexWrap !== 'wrap') {
      const st = flat(child);
      const shrinks = (Number(st.flex) >= 1 && st.minWidth === 0) || Number(st.flexShrink) >= 1 || st.maxWidth != null;
      expect({ text: hostText(n), shrinks }).toEqual({ text: hostText(n), shrinks: true });
    }
    if (typeof cur.type === 'string') child = cur;
    cur = cur.parent;
  }
  expect(flat(n).width).toBeUndefined();
}
const typo = (n: ReactTestInstance, name: keyof typeof axTypography) => {
  const st = flat(n);
  expect({ fontFamily: st.fontFamily, fontSize: st.fontSize }).toEqual({
    fontFamily: axTypography[name].fontFamily, fontSize: axTypography[name].fontSize,
  });
};
const EMOJI_TEST = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
/** Textes de l'interface (hors contenu saisi : réactions et messages des membres). */
function chromeTexts(root: ReactTestInstance): string[] {
  return root.findAll((x) => isHostText(x) && !/^(bubble-text-|reaction)/.test(String(x.props.testID ?? '')))
    .filter((x) => !REACTION_EMOJI.has(hostText(x)))
    .map(hostText);
}
const REACTION_EMOJI = new Set(['❤️', '🔥', '💪', '😂', '👏', '👀']);

describe.each(THEMES)('R9b : thème %s', (_name, theme) => {
  const c = theme.ax;

  it('Actualités : carte AxCard, date en overline, titre en titleM, compteurs en caption, AA', async () => {
    const root = await mount(<ArticlesScreen />, theme);
    const card = hostByID(root, 'article-a1');
    expect(flat(card).borderRadius).toBe(axRadius.card);
    typo(byID(root, 'article-date-a1'), 'overline');
    typo(byID(root, 'article-title-a1'), 'titleM');
    typo(byID(root, 'article-likes-a1'), 'caption');
    typo(byID(root, 'article-comments-a1'), 'caption');
    expect(byID(root, 'article-title-a1').props.numberOfLines).toBe(2);
    for (const id of ['article-date-a1', 'article-title-a1', 'article-author-a1', 'article-body-a1', 'article-likes-a1', 'article-comments-a1']) {
      expectReadable(root, byID(root, id), theme, c.surface);
    }
    expectNoOverflow(byID(root, 'article-title-a1'));
  });

  it('Actualités · détail : titre titleM, commentaires en AxCard, champ AxTextField, AA', async () => {
    const root = await mount(<ArticlesScreen />, theme);
    await pressText(root, LONG);
    typo(byID(root, 'article-detail-title'), 'titleM');
    typo(byID(root, 'article-comments-title'), 'overline');
    expect(flat(hostByID(root, 'article-comment-c1')).borderRadius).toBe(axRadius.card);
    expect(byID(root, 'article-comment-input')).toBeDefined();
    for (const id of ['article-detail-title', 'article-detail-meta', 'article-comments-title']) expectReadable(root, byID(root, id), theme, c.background);
    expectReadable(root, textNode(root, 'Moi'), theme, c.surface);
    expectReadable(root, textNode(root, "0 J'aime"), theme, c.background);
    expectNoOverflow(byID(root, 'article-detail-title'));
  });

  it('Membres : AxCard par membre, nom en label, palier coloré AA, ELO en numberM', async () => {
    const root = await mount(membersModal(), theme);
    const card = hostByID(root, 'member-u2');
    expect(flat(card).borderRadius).toBe(axRadius.card);
    typo(byID(root, 'member-name-u2'), 'label');
    typo(byID(root, 'member-elo-u2'), 'numberM');
    typo(byID(root, 'members-title'), 'titleM');
    expect(byID(root, 'member-name-u2').props.numberOfLines).toBe(1);
    for (const u of ['u2', 'u3', 'u4']) {
      const lvl = byID(root, `member-level-${u}`);
      expect(flat(lvl).color).not.toBe(c.textMuted);
      expectReadable(root, lvl, theme, c.surface);
      expectReadable(root, byID(root, `member-name-${u}`), theme, c.surface);
      expectReadable(root, byID(root, `member-elo-${u}`), theme, c.surface);
    }
    expectReadable(root, byID(root, 'members-title'), theme, c.surface);
    expectNoOverflow(byID(root, 'member-name-u2'));
    expectNoOverflow(byID(root, 'members-title'));
  });

  it('Séance perso : AxTextField, AxChip pour le type, AxButton accent, étiquettes en overline AA', async () => {
    const root = await mount(<PersonalWODFormScreen />, theme);
    for (const id of ['pwod-title', 'pwod-description', 'pwod-timecap', 'pwod-rounds', 'pwod-notes']) {
      expect(root.findAll((x) => x.props.testID === id && String(x.type) === 'TextInput').length).toBe(1);
    }
    const selected = hostByID(root, 'pwod-type-amrap');
    expect(selected.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(hostByID(root, 'pwod-type-emom').props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
    const saveLabel = textNode(root, 'Créer le WOD');
    typo(saveLabel, 'label');
    expect(flat(saveLabel).color).toBe(c.onAccent);
    const label = textNode(root, 'TITRE *');
    typo(label, 'overline');
    expectReadable(root, label, theme, c.background);
    for (const id of ['pwod-description', 'pwod-notes']) {
      expect(flat(root.findAll((x) => x.props.testID === id && String(x.type) === 'TextInput')[0]).minHeight).toBe(80);
    }
    expect(root.findAll((x) => String(x.type) === 'TextInput' && !/^pwod-|^date/.test(String(x.props.testID ?? ''))).length).toBe(1);
  });

  it('Classement : AxCard, rang sans emoji, initiale, nom en label, score en numberM AA', async () => {
    const root = await mount(withQuery(<BoxRankingScreen />), theme);
    expect(flat(hostByID(root, 'ranking-row-u2')).borderRadius).toBe(axRadius.card);
    for (const r of [1, 2, 3]) expect(byID(root, `rank-medal-${r}`)).toBeDefined();
    expect(textNode(root, '#4')).toBeDefined();
    typo(byID(root, 'ranking-name-u2'), 'label');
    typo(byID(root, 'ranking-elo-u2'), 'numberM');
    for (const u of ['u2', 'u3', 'u4']) {
      expectReadable(root, byID(root, `ranking-name-${u}`), theme, c.surface);
      expectReadable(root, byID(root, `ranking-elo-${u}`), theme, c.surface);
      expectReadable(root, byID(root, `ranking-wins-${u}`), theme, c.surface);
    }
    expectReadable(root, byID(root, 'ranking-name-me'), theme, c.surface);
    expectReadable(root, byID(root, 'ranking-sub'), theme, c.background);
    expect(textNode(root, 'Moi')).toBeDefined();
    expectNoOverflow(byID(root, 'ranking-name-u2'));
  });

  it('Messages : bulles AA dans les deux sens, champ AxTextField, onglets lisibles', async () => {
    const root = await mount(<MessagesScreen />, theme);
    for (const id of ['gc-m1', 'gc-m3']) {
      const bubble = hostByID(root, `bubble-${id}`);
      const bg = String(flat(bubble).backgroundColor);
      expectReadable(root, byID(root, `bubble-text-${id}`), theme, bg);
      expectReadable(root, byID(root, `bubble-time-${id}`), theme, bg);
      typo(byID(root, `bubble-text-${id}`), 'body');
    }
    expect(flat(hostByID(root, 'bubble-gc-m3')).backgroundColor).toBe(c.accent);
    expectReadable(root, byID(root, 'bubble-sender-gc-m1'), theme, String(flat(hostByID(root, 'bubble-gc-m1')).backgroundColor));
    const input = root.findAll((x) => x.props.testID === 'messages-input' && String(x.type) === 'TextInput')[0];
    expect(input.props).toEqual(expect.objectContaining({ placeholder: 'Écrire un message…', multiline: true, maxLength: 500 }));
    expect(flat(input).maxHeight).toBe(100);
    for (const g of ['g1', 'g2']) {
      const tab = hostByID(root, `messages-tab-${g}`);
      const t = tab.findAll(isHostText)[0];
      expectReadable(root, t, theme, String(flat(tab).backgroundColor));
    }
    expectNoOverflow(byID(root, 'bubble-text-gc-m1'));
    expectNoOverflow(textNode(root, 'Groupe du matin au nom vraiment très long'));
    // Pièces jointes inchangées : le GIF externe s'affiche tel quel.
    expect(root.findAll((x) => String(x.type) === 'Image' && x.props.source?.uri === 'https://media.giphy.local/gif.gif').length).toBe(1);
  });

  it('Infos : une AxCard par section, valeurs AA, textes longs sans débordement', async () => {
    const root = await mount(<BoxInfoScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />, theme);
    for (const id of ['boxinfo-hero', 'boxinfo-stat-members', 'boxinfo-stat-elo', 'boxinfo-stat-created', 'boxinfo-contact', 'boxinfo-people', 'boxinfo-dates']) {
      expect(flat(hostByID(root, id)).borderRadius).toBe(axRadius.card);
    }
    typo(byID(root, 'boxinfo-name'), 'titleM');
    for (const t of ['ADRESSE', 'https://box-fictive.local', 'Voir sur Google Maps', 'Ouverture de la salle', '1 mars 2019', 'Membres', '1200']) {
      expectReadable(root, textNode(root, t), theme, c.surface);
    }
    expectNoOverflow(textNode(root, BOX_ROW.address));
    for (const n of root.findAll((x) => isHostText(x) && hostText(x) === LONG_NAME)) expectNoOverflow(n);
  });
});

describe('R9b : navigation et callbacks inchangés', () => {
  it('Actualités : ouvrir, aimer (sans ouvrir) et revenir', async () => {
    const root = await mount(<ArticlesScreen />);
    await press(root, 'article-like-a1', { stopPropagation: jest.fn() });
    await settle();
    expect(mockCalls.some((x) => x.table === 'box_article_likes' && x.method === 'insert')).toBe(true);
    expect(root.findAll((x) => x.props.testID === 'article-detail-title').length).toBe(0);
    await press(root, 'article-a1');
    await settle();
    expect(hostText(byID(root, 'article-detail-title'))).toBe(LONG);
  });

  it('Membres : appui → fermeture puis profil public', async () => {
    const onClose = jest.fn();
    const onOpen = jest.fn();
    const root = await mount(membersModal(MEMBERS, onClose, onOpen));
    await press(root, 'member-u3');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith('u3');
    await press(root, 'members-close');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Séance perso : le type choisi et « Enregistrer » gardent leur effet', async () => {
    mockRouteParams = { wodId: 'w1' };
    const root = await mount(<PersonalWODFormScreen />);
    expect(hostByID(root, 'pwod-type-emom').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(root.findAll((x) => x.props.testID === 'pwod-title' && String(x.type) === 'TextInput')[0].props.value).toBe('Cindy');
    await press(root, 'pwod-type-tabata');
    await press(root, 'pwod-save');
    await settle();
    const upd = mockCalls.find((x) => x.table === 'box_wods' && x.method === 'update');
    expect(upd?.args[0]).toEqual(expect.objectContaining({ title: 'Cindy', wod_type: 'tabata', tabata_work_seconds: 20, tabata_rest_seconds: 10 }));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('Classement : un autre membre ouvre son profil, pas soi-même', async () => {
    const root = await mount(withQuery(<BoxRankingScreen />));
    await press(root, 'ranking-row-u2');
    expect(mockNavigate).toHaveBeenCalledWith('PublicProfile', { userId: 'u2' });
    mockNavigate.mockClear();
    await press(root, 'ranking-row-me');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('Messages : la saisie alimente l’envoi et vide le champ', async () => {
    const root = await mount(<MessagesScreen />);
    const input = () => root.findAll((x) => x.props.testID === 'messages-input' && String(x.type) === 'TextInput')[0];
    await act(async () => { input().props.onChangeText('Salut'); });
    expect(input().props.value).toBe('Salut');
    const send = root.findAll((x) => typeof x.props.onPress === 'function' && x.props.disabled === false && typeof x.type !== 'string')
      .find((x) => x.findAll((y) => String(y.type) === 'ActivityIndicator').length === 0 && flat(x).width === 44);
    await act(async () => { send!.props.onPress(); });
    await settle();
    expect(mockCalls.some((x) => x.table === 'group_messages' && x.method === 'insert')).toBe(true);
    expect(input().props.value).toBe('');
  });

  it('Infos : chaque lien garde son adresse', async () => {
    const { Linking } = jest.requireActual('react-native');
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await mount(<BoxInfoScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    for (const id of ['boxinfo-website', 'boxinfo-email', 'boxinfo-phone', 'boxinfo-maps']) {
      await press(root, id);
    }
    expect(open.mock.calls.map((x) => x[0])).toEqual([
      'https://box-fictive.local', 'mailto:contact@box-fictive.local', 'tel:0102030405', 'https://maps.local/box',
    ]);
  });
});

describe('R9b : aucun emoji dans les zones refondues', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (_n, v) => {
    const root = await v.run();
    expect(chromeTexts(root).filter((t) => EMOJI_TEST.test(t))).toEqual([]);
  });
});
