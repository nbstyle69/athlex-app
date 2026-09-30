/**
 * R3b — l'Accueil de l'athlète au nouveau design, monté avec le vrai
 * react-native : ordre des blocs, typographies et couleurs clés dans les deux
 * thèmes, navigation inchangée, textes longs bornés.
 */
import React, { useEffect as mockUseEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import { axAccentSafeLineHeight, axTypography } from '../theme/axTokens';
import { LevelColors } from '../theme/designTokens';
import { contrast } from '../theme/contrast';
import { levelInk } from '../screens/home/homeLevelColor';
import i18n from '../i18n';
import HomeScreen from '../screens/home/HomeScreen';

const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();
let mockTheme: AppTheme = lightTheme;
let mockUser: Record<string, unknown> = {};
let mockBox: Record<string, unknown> | null = null;
let mockHomeData: Record<string, unknown> | null = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, getParent: () => ({ navigate: mockParentNavigate }) }),
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 92 }));
jest.mock('../hooks/useFocusQuery', () => ({
  useFocusQuery: () => ({ data: mockHomeData, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, currentBox: mockBox, myBoxes: mockBox ? [{ box: mockBox, role: 'member' }] : [], switchBox: jest.fn() }),
}));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/InteractiveTour', () => () => null);
jest.mock('../services/gamification', () => ({
  getStreak: jest.fn(), readBadgeQueue: async () => [], clearBadgeQueue: async () => {},
}));
jest.mock('../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'gte', 'order', 'limit', 'is', 'in']) chain[m] = () => chain;
  chain.then = (res: (v: unknown) => void) => res({ data: [], count: 0, error: null });
  const channel: Record<string, unknown> = {};
  channel.on = () => channel;
  channel.subscribe = () => channel;
  return { supabase: { from: () => chain, channel: () => channel, removeChannel: () => {} } };
});

const LONG = 'Un nom vraiment très très long qui ne tiendrait jamais sur un écran de 390 points de large';
const NOW = new Date();

function homeData(overrides: Record<string, unknown> = {}) {
  return {
    rank: 122,
    news: { id: 'n1', title: 'Portes ouvertes samedi', body: 'Viens avec tes amis', image_url: 'https://x/y.jpg', created_at: NOW.toISOString(), likes: 12, comments: 3 },
    streak: { current_streak: 1, longest_streak: 3, week_session_count: 1, week_start: '', max_sessions_per_week: 3 },
    unreadChangelog: 2,
    competitions: [{ id: 't1', name: "Open d'automne", status: 'active', participants: 32, maxParticipants: 48, startDate: '26 sept.' }],
    pendingFriends: 1,
    recentScores: [
      { id: 's1', score_value: '8 + 22', submitted_at: '2026-09-26T10:00:00Z', wod_title: "AMRAP 14'", status: 'pending' },
      { id: 's2', score_value: '5:12', submitted_at: '2026-09-21T10:00:00Z', wod_title: 'Fran', status: 'approved' },
    ],
    totalWods: 37, totalScoresGen: 1, favCount: 0,
    weekActivity: [0, 1, 0, 0, 0, 0, 0], weekReservations: [1, 0, 0, 0, 0, 0, 0],
    weekWodsTotal: 1, weekResTotal: 1, activeDayStreak: 0, totalReservations: 48, genStreak: 0,
    bestScores: [{ name: 'EMOM 15 · Thruster', value: '25 reps', type: 'reps' }],
    physComps: [{ id: 'p1', name: 'Lens Throwdown', logo_url: null, mode: 'physical' }],
    ...overrides,
  };
}

let r: TestRenderer.ReactTestRenderer;
const flat = (n: TestRenderer.ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const host = (id: string) => r.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
const pressable = (id: string) => r.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const textNode = (s: string) => r.root.findAll((n) => n.type === Text && [n.props.children].flat().join('') === s)[0];

async function mount(theme: AppTheme = lightTheme, data = homeData()) {
  mockTheme = theme;
  mockHomeData = data;
  await act(async () => { r = TestRenderer.create(<HomeScreen />); });
  await act(async () => {});
}

beforeAll(async () => { await i18n.changeLanguage('fr'); });
beforeEach(() => {
  mockNavigate.mockClear(); mockParentNavigate.mockClear();
  mockUser = { id: 'u1', username: 'ATHLEX_USER', elo: 1423, level: 'rx+', wins: 4, total_matches: 8 };
  mockBox = { id: 'b1', name: 'AthleX Fitness', logo_url: 'https://x/logo.png' };
});
afterEach(async () => { if (r) await act(async () => r.unmount()); });

describe('ordre des blocs', () => {
  it('en-tête, ELO, Amis / Profil, Actu, Cette semaine, Explorer, Compétitions, Tournois, Résultats récents', async () => {
    await mount();
    const ids = ['home-header', 'home-elo-card', 'home-actions', 'home-news', 'home-week', 'home-explorer',
      'home-competition-card', 'home-tournament-card', 'home-result'];
    const order: string[] = [];
    const visit = (n: TestRenderer.ReactTestInstance) => {
      if (typeof n.type === 'string' && ids.includes(n.props.testID) && !order.includes(n.props.testID)) order.push(n.props.testID);
      n.children.forEach((ch) => typeof ch !== 'string' && visit(ch));
    };
    visit(r.root);
    expect(order).toEqual(ids);
    const titles = host('home-section-title').map((n) => [n.props.children].flat().join(''));
    expect(titles).toEqual(['Actu de ta box', 'Cette semaine', 'Explorer', 'Compétitions', 'Tournois', 'Résultats récents']);
  });
});

describe.each([['clair', lightTheme], ['sombre', darkTheme]])('thème %s', (_name, theme) => {
  const c = theme.ax;

  it('ELO en accentText et Oswald 44, statistiques en Oswald 24', async () => {
    await mount(theme);
    const elo = flat(host('home-elo-value')[0]);
    expect(elo).toMatchObject({ color: c.accentText, fontFamily: axTypography.numberL.fontFamily, fontSize: 44 });
    const stats = host('home-stat-value').map(flat);
    expect(stats).toHaveLength(3);
    for (const s of stats) expect(s).toMatchObject({ color: c.text, fontFamily: axTypography.numberM.fontFamily, fontSize: 24 });
    expect(flat(textNode('ELO ›'))).toMatchObject({ color: c.textMuted, fontSize: axTypography.overlineSmall.fontSize });
  });

  it('pseudo en titleXL, titres de section en Oswald 20 capitales', async () => {
    await mount(theme);
    expect(flat(host('home-username')[0])).toMatchObject({ ...axTypography.titleXL, lineHeight: axAccentSafeLineHeight.titleXL, color: c.text });
    for (const t of host('home-section-title').map(flat)) {
      expect(t).toMatchObject({ fontFamily: axTypography.titleM.fontFamily, fontSize: 20, textTransform: 'uppercase', color: c.text });
    }
  });

  it('palier coloré selon LevelColors, lisible (AA) sur la carte', async () => {
    await mount(theme);
    const dot = host('home-level-dot')[0];
    expect(flat(dot).backgroundColor).toBe(levelInk('rx+', c));
    const label = textNode('RX+');
    expect(flat(label).color).toBe(levelInk('rx+', c));
    for (const lvl of Object.keys(LevelColors)) expect(contrast(levelInk(lvl, c), c.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('« Validé » en success, « En attente » en textMuted', async () => {
    await mount(theme);
    const status = host('home-result-status').map((n) => [[n.props.children].flat().join(''), flat(n).color]);
    expect(status).toEqual([['En attente', c.textMuted], ['Validé', c.success]]);
  });
});

describe('couleur du palier', () => {
  it('garde la couleur exacte de LevelColors quand elle tient le contraste, sinon la rapproche de l’encre', () => {
    expect(levelInk('rx+', darkTheme.ax)).toBe(LevelColors['rx+']);
    expect(levelInk('rx', lightTheme.ax)).not.toBe(LevelColors.rx);
    expect(levelInk('scaled', lightTheme.ax)).toBe(LevelColors.scaled);
    expect(levelInk('inconnu', darkTheme.ax)).toBe(darkTheme.ax.text);
  });
});

describe('navigation inchangée', () => {
  it.each([
    ['home-elo', 'EloHistory'],
    ['home-rank', 'Leaderboard'],
    ['home-friends', 'Friends'],
    ['home-profile', 'Profile'],
    ['home-history', 'WodHistory'],
    ['home-bell', 'Changelog'],
    ['home-box-logo', 'BoxInfo'],
    ['home-explorer-BoxDirectory', 'BoxDirectory'],
    ['home-explorer-Programmation', 'Programmation'],
    ['home-explorer-Partners', 'Partners'],
  ])('%s → %s', async (id, route) => {
    await mount();
    await act(async () => { pressable(id).props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(route);
  });

  it('carte de tournoi → CompetitionDetail', async () => {
    await mount();
    await act(async () => { pressable('home-tournament-card').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CompetitionDetail', { competition: expect.objectContaining({ id: 't1' }) });
  });

  it.each([
    ['home-see-competitions', ['Competitions', { screen: 'CompetitionList', params: { initialTab: 2 } }]],
    ['home-see-tournaments', ['Competitions', { screen: 'CompetitionList', params: { initialTab: 0 } }]],
    ['home-competition-card', ['Competitions', { screen: 'PhysicalCompetition', params: { mode: 'physical', selectedId: 'p1' } }]],
    ['home-news-card', ['Whiteboard', { screen: 'Articles' }]],
  ])('%s → onglet parent', async (id, args) => {
    await mount();
    await act(async () => { pressable(id).props.onPress(); });
    expect(mockParentNavigate).toHaveBeenCalledWith(...args);
  });

  it('badges de la cloche et des amis en AxCounterBadge', async () => {
    await mount();
    expect(textNode('2')).toBeDefined();
    expect(host('home-bell-badge')).toHaveLength(1);
    expect(host('home-friends-badge')).toHaveLength(1);
  });
});

describe('textes longs', () => {
  it('pseudo, nom de box et titre d’article longs : une ligne (deux pour l’article) terminée par « … », dans un conteneur qui rétrécit', async () => {
    mockUser = { ...mockUser, username: LONG };
    mockBox = { ...mockBox, name: LONG };
    const base = homeData();
    await mount(darkTheme, homeData({ news: { ...(base.news as object), title: LONG } }));
    for (const [id, lines] of [['home-username', 1], ['home-box-name', 1], ['home-news-title', 2]] as const) {
      const n = host(id)[0];
      expect([n.props.children].flat().join('')).toBe(LONG);
      expect(n.props.numberOfLines).toBe(lines);
      expect(n.props.ellipsizeMode ?? 'tail').toBe('tail');
    }
    expect(flat(host('home-box-name')[0]).flexShrink).toBe(1);
    const header = host('home-header')[0];
    expect(flat(header.children[0] as TestRenderer.ReactTestInstance)).toMatchObject({ flex: 1, minWidth: 0 });
  });
});
