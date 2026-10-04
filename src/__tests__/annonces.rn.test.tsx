/**
 * Annonces de la box : écran AnnoncesScreen et bouton « Annonces » de Ma Box,
 * montés avec le vrai react-native. Données fictives, aucun réseau.
 * Le faux client applique eq / gt / order / limit sur box_notifications : les
 * lignes posées sont celles que la RLS laisserait lire au membre.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { lightTheme } from '../theme/palette';
import AnnoncesScreen from '../screens/whiteboard/AnnoncesScreen';
import WhiteboardScreen from '../screens/whiteboard/WhiteboardScreen';

const mockNavigate = jest.fn();
const mockTables: Record<string, Array<Record<string, unknown>>> = {};
const mockErrors: Record<string, unknown> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true, setOptions: jest.fn() }),
    useRoute: () => ({ params: undefined }),
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
const BOX = { id: 'box-1', name: 'CrossFit Fictif', owner_id: 'u9', logo_url: null, slug: 'crossfit-fictif' };
const mockAuth = {
  user: { id: 'me', username: 'Moi' },
  currentBox: BOX,
  boxRole: 'member',
  joinBox: jest.fn(async () => ({ error: null })),
};
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').lightTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let order: { col: string; asc: boolean } | null = null;
    let limit = Infinity;
    const b: Record<string, unknown> = {};
    const filtered = table === 'box_notifications';
    for (const m of ['select', 'eq', 'gte', 'lte', 'gt', 'order', 'limit', 'in', 'or', 'is', 'contains']) {
      b[m] = (...args: unknown[]) => {
        mockCalls.push({ table, method: m, args });
        if (filtered && m === 'eq') filters.push((r) => r[args[0] as string] === args[1]);
        if (filtered && m === 'gt') filters.push((r) => String(r[args[0] as string]) > String(args[1]));
        if (filtered && m === 'order') order = { col: args[0] as string, asc: (args[1] as { ascending?: boolean })?.ascending !== false };
        if (filtered && m === 'limit') limit = args[0] as number;
        return b;
      };
    }
    const rows = () => {
      let rs = (mockTables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      if (order) {
        const { col, asc } = order;
        rs = [...rs].sort((x, y) => (String(x[col]) < String(y[col]) ? -1 : 1) * (asc ? 1 : -1));
      }
      return rs.slice(0, limit);
    };
    const one = () => ({ then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows()[0] ?? null, error: null }).then(res) });
    b.single = one;
    b.maybeSingle = one;
    b.then = (res: (v: unknown) => unknown) => {
      const error = mockErrors[table] ?? null;
      return Promise.resolve(error ? { data: null, count: null, error } : { data: rows(), count: rows().length, error: null }).then(res);
    };
    return b;
  };
  const channel = () => {
    const ch = { on: () => ch, subscribe: () => ch };
    return ch;
  };
  return { supabase: { from: (t: string) => builder(t), channel, removeChannel: jest.fn(), rpc: jest.fn(async () => ({ data: null, error: null })) } };
});
jest.mock('../services/membership', () => ({
  ...jest.requireActual('../services/membership'),
  getMyPlanStatus: async () => null,
}));
jest.mock('../lib/unreadMessages', () => ({ countUnreadMessages: jest.fn(async () => 0) }));
jest.mock('../lib/analytics', () => ({ trackScoreSubmit: jest.fn() }));
jest.mock('../services/notifications', () => ({
  sendScoreNotification: jest.fn(async () => {}), sendScoreOvertakenNotification: jest.fn(async () => {}), cancelTodayScoreReminder: jest.fn(async () => {}),
}));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}), logMovementReps: jest.fn(async () => {}), recordActivity: jest.fn(async () => {}) }));
jest.mock('../services/programContent', () => ({ listProgramWodsByProgram: jest.fn(async () => ({})), listProgramRestDaysByProgram: jest.fn(async () => ({})) }));
jest.mock('../services/eloCompute', () => ({ computeAndSaveElo: jest.fn(async () => {}), sortScoresRxFirst: (s: unknown[]) => s }));
jest.mock('../services/strengthPR', () => ({ recordStrengthPRs: jest.fn(async () => []) }));
jest.mock('../utils/eloLevels', () => ({ syncLevelAndBadges: jest.fn(async () => []) }));
jest.mock('../hooks/useMyOneRepMax', () => {
  const none = () => null;
  return { useMyOneRepMax: () => none };
});
jest.mock('../services/strengthSets', () => ({
  ...jest.requireActual('../services/strengthSets'),
  fetchStrengthSummaries: jest.fn(async () => ({})),
}));
jest.mock('../components/ReportMenu', () => () => null);
jest.mock('../components/ShareScoreCard', () => () => null);
jest.mock('react-native-webview', () => 'WebView');
jest.mock('react-native-view-shot', () => 'ViewShot');
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn(async () => true) }));
jest.mock('../components/wod/TimerLaunchModal', () => () => null);
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-10-04T18:30:00Z');
// Posées dans le désordre : seul le tri demandé au serveur les remet en ordre.
const ANNONCES = [
  { id: 'n-old', box_id: 'box-1', title: 'Ouverture samedi 8 h', body: 'Le WOD sera révélé à 9 h.', target: 'all', created_at: '2026-10-03T07:30:00Z' },
  { id: 'n-new', box_id: 'box-1', title: 'Rappel de paiement', body: 'Pense à régulariser ta formule à l\'accueil avant samedi.', target: 'me', created_at: '2026-10-04T16:02:00Z' },
  { id: 'n-mid', box_id: 'box-1', title: 'Fermeture lundi', body: 'La box ferme exceptionnellement lundi.', target: 'all', created_at: '2026-10-03T19:00:00Z' },
];

let renderer: TestRenderer.ReactTestRenderer | null = null;
beforeEach(async () => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  await i18n.changeLanguage('fr');
  await AsyncStorage.clear();
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  for (const k of Object.keys(mockErrors)) delete mockErrors[k];
  mockTables.box_notifications = ANNONCES.map((a) => ({ ...a }));
});
afterEach(async () => {
  await unmount();
  jest.useRealTimers();
  jest.clearAllMocks();
  mockCalls.length = 0;
});

async function unmount() {
  if (renderer) { const r = renderer; renderer = null; await act(async () => r.unmount()); }
}
async function mount(el: React.ReactElement) {
  await unmount();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await act(async () => { renderer = TestRenderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
  return renderer!.root;
}
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
const byId = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
const cardIds = (root: ReactTestInstance) =>
  root.findAll((n) => typeof n.type === 'string' && /^annonce-n-[a-z]+$/.test(String(n.props.testID))).map((n) => n.props.testID);

describe('AnnoncesScreen', () => {
  it('ne demande que les colonnes prévues, de la box active, 50 au plus, du plus récent au plus ancien', async () => {
    await mount(<AnnoncesScreen />);
    const calls = mockCalls.filter((c) => c.table === 'box_notifications');
    expect(calls.find((c) => c.method === 'select')?.args).toEqual(['id, title, body, target, created_at']);
    expect(calls.filter((c) => c.method === 'eq').map((c) => c.args)).toEqual([['box_id', 'box-1']]);
    expect(calls.find((c) => c.method === 'order')?.args).toEqual(['created_at', { ascending: false }]);
    expect(calls.find((c) => c.method === 'limit')?.args).toEqual([50]);
  });

  it('affiche les annonces de la plus récente à la plus ancienne, la plus récente en carte vedette', async () => {
    const root = await mount(<AnnoncesScreen />);
    expect(cardIds(root)).toEqual(['annonce-n-new', 'annonce-n-mid', 'annonce-n-old']);
    const [first, second] = ['annonce-n-new', 'annonce-n-mid'].map((id) => byId(root, id)[0]);
    expect(first.findAll((n) => n.props.testID === 'ax-card-rule')).not.toHaveLength(0);
    expect(second.findAll((n) => n.props.testID === 'ax-card-rule')).toHaveLength(0);
    // Message en entier : aucune coupe de lignes.
    const body = first.findAll((n) => String(n.type) === 'Text' && hostText(n).startsWith('Pense à régulariser'))[0];
    expect(body.props.numberOfLines).toBeUndefined();
    expect(hostText(first)).toContain('04 oct. 2026');
  });

  it('étiquette « Pour toi » (accent) si l\'annonce vise le membre, « Toute la box » (discret) sinon', async () => {
    const root = await mount(<AnnoncesScreen />);
    const tag = (id: string) => byId(root, `annonce-tag-${id}`)[0];
    expect(hostText(tag('n-new'))).toBe('Pour toi');
    expect(hostText(tag('n-old'))).toBe('Toute la box');
    expect(StyleSheet.flatten(tag('n-new').props.style).borderColor).toBe(lightTheme.ax.accentText);
    expect(StyleSheet.flatten(tag('n-old').props.style).borderColor).toBe(lightTheme.ax.textMuted);
  });

  it('aucune annonce : icône, titre et message de l\'état vide', async () => {
    mockTables.box_notifications = [];
    const root = await mount(<AnnoncesScreen />);
    const empty = byId(root, 'annonces-empty')[0];
    expect(hostText(empty)).toContain('AUCUNE ANNONCE');
    expect(hostText(empty)).toContain('Les messages de ta box s\'afficheront ici, même si tes notifications sont coupées.');
    expect(cardIds(root)).toEqual([]);
  });

  it('erreur de chargement : message d\'erreur du projet, pas l\'état vide', async () => {
    mockErrors.box_notifications = { message: 'boom' };
    const root = await mount(<AnnoncesScreen />);
    expect(hostText(byId(root, 'annonces-error')[0])).toBe(i18n.t('auth.errors.generic'));
    expect(byId(root, 'annonces-empty')).toHaveLength(0);
  });

  it('en anglais : libellés traduits', async () => {
    await i18n.changeLanguage('en');
    const root = await mount(<AnnoncesScreen />);
    expect(hostText(byId(root, 'annonce-tag-n-new')[0])).toBe('For you');
    expect(hostText(byId(root, 'annonce-tag-n-old')[0])).toBe('Whole box');
  });
});

describe('Ma Box : bouton Annonces et non-lus', () => {
  it('bouton « Annonces » sur la ligne d\'« Actualités », qui ouvre l\'écran', async () => {
    const root = await mount(<WhiteboardScreen />);
    const news = byId(root, 'whiteboard-news')[0];
    const ann = byId(root, 'whiteboard-annonces')[0];
    expect(hostText(ann)).toBe('Annonces');
    // Même rangée : le premier ancêtre hôte en ligne est le même pour les deux boutons.
    const row = (n: ReactTestInstance) => {
      let p = n.parent;
      while (p && !(typeof p.type === 'string' && StyleSheet.flatten(p.props.style)?.flexDirection === 'row')) p = p.parent;
      return p;
    };
    expect(row(news) !== null && row(news) === row(ann)).toBe(true);
    const press = root.findAll((n) => n.props.testID === 'whiteboard-annonces' && typeof n.props.onPress === 'function')[0];
    await act(async () => press.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Annonces');
  });

  it('pastille = annonces lisibles plus récentes que la dernière ouverture ; remise à zéro par l\'écran', async () => {
    let root = await mount(<WhiteboardScreen />);
    expect(hostText(byId(root, 'whiteboard-annonces-badge')[0])).toBe('3');

    await mount(<AnnoncesScreen />);
    expect(await AsyncStorage.getItem('lastSeenAnnonces_me_box-1')).toBe(NOW.toISOString());

    root = await mount(<WhiteboardScreen />);
    expect(byId(root, 'whiteboard-annonces-badge')).toHaveLength(0);

    mockTables.box_notifications.push({ id: 'n-next', box_id: 'box-1', title: 'Nouveau', body: 'x', target: 'all', created_at: '2026-10-04T19:00:00Z' });
    root = await mount(<WhiteboardScreen />);
    expect(hostText(byId(root, 'whiteboard-annonces-badge')[0])).toBe('1');
  });
});
