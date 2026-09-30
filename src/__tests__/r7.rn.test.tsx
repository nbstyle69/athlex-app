import React from 'react';
import fs from 'fs';
import { Dimensions, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import '../i18n';
import { lightTheme, darkTheme } from '../theme/palette';
import BEFORE from './r7StructureBefore.json';
import EloHistoryScreen, { CHART_WIDTH } from '../screens/profile/EloHistoryScreen';
import { axSpacing, axTypography } from '../theme/axTokens';
import { contrast } from '../theme/contrast';
import { levelInk } from '../screens/home/homeLevelColor';
import {
  ELO_TIERS, tierOf, tierProgress, tierPassageIndex, bestIndex, tierBands, thresholdsIn,
} from '../utils/eloTiers';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockTheme = lightTheme;
const mockTables: Record<string, unknown[]> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(83),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
// Le mock partagé n'a ni Text ni LinearGradient : ajoutés ici, sans toucher au mock commun.
jest.mock('react-native-svg', () => {
  const R = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const base = jest.requireActual('react-native-svg');
  const make = (name: string) => {
    const C = (p: { children?: React.ReactNode }) => R.createElement(View, { ...p, svgType: name }, p.children);
    C.displayName = name;
    return C;
  };
  const out: Record<string, unknown> = { ...base };
  for (const n of ['Svg', 'Defs', 'LinearGradient', 'Stop', 'Path', 'Circle', 'Line', 'Rect', 'G', 'Text']) out[n] = make(n);
  out.default = out.Svg;
  return out;
});
const mockAuth = { user: { id: 'local', elo: 1250 } };
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme, mode: mockTheme.ax.background === '#101214' ? 'dark' : 'light' }),
}));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'in']) {
      b[m] = (...args: unknown[]) => { mockCalls.push({ table, method: m, args }); return b; };
    }
    b.then = (res: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: mockTables[table] ?? [], error: null }).then(res);
    return b;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-09-28T10:00:00');
const LONG = 'Un WOD au titre particulièrement long pour vérifier qu’aucun texte ne déborde de sa ligne';

function seed() {
  mockTables.elo_history = [
    { id: 'e4', wod_id: 'w-4', elo_before: 1190, elo_after: 1260, elo_delta: 70, rank: 3, created_at: '2026-09-24T18:00:00', box_wods: { title: 'Fran', wod_type: 'for-time' } },
    { id: 'e1', wod_id: 'w-1', elo_before: 1150, elo_after: 1180, elo_delta: 30, rank: 1, created_at: '2026-06-01T18:00:00', box_wods: { title: LONG, wod_type: 'amrap' } },
  ];
  mockTables.tournament_elo_history = [
    { id: 'e2', tournament_id: 't-2', elo_before: 1180, elo_after: 1210, elo_change: 30, final_rank: 2, calculated_at: '2026-09-10T18:00:00', tournaments: { name: 'Battle AthleX #3' } },
  ];
  mockTables.daily_tournament_elo_history = [
    { id: 'e3', tournament_id: 'd-3', elo_before: 1210, elo_after: 1190, elo_delta: -20, final_rank: 5, calculated_at: '2026-09-15T18:00:00', daily_tournaments: { wod_name: 'Mini Murph' } },
  ];
  mockTables.tournament_match_elo_history = [
    { id: 'e5', match_id: 'm-5', opponent_id: 'p-2', result: 'loss', elo_before: 1260, elo_after: 1250, elo_delta: -10, created_at: '2026-09-27T18:00:00', tournament_bracket_matches: { tournament_id: 't-5', tournaments: { name: 'Sprint #7' } } },
  ];
  mockTables.profiles = [{ id: 'p-2', username: 'Diego B.' }];
}

let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  mockAuth.user.elo = 1250;
  seed();
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
const isNew = (n: ReactTestInstance) => typeof n.props.testID === 'string' && n.props.testID.startsWith('elo-tier');
/** Suite ordonnée des textes visibles, hors éléments de palier ajoutés au lot R7. */
function structure(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance) => {
    if (isNew(n)) return;
    if (isHostText(n)) {
      const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
      out.push(upper ? hostText(n).toUpperCase() : hostText(n));
      return;
    }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch); });
  };
  walk(root);
  return out.filter((t) => t.trim().length > 0);
}
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
const normalize = (xs: string[]) => xs.map((x) => x.replace(EMOJI, '').trim().toUpperCase()).filter((x) => x.length > 0);
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const byID = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id)[0];
const textByContent = (root: ReactTestInstance, text: string) =>
  root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
async function pressText(root: ReactTestInstance, text: string) {
  let n: ReactTestInstance | null = textByContent(root, text);
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress(); });
}
async function mount(theme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(<EloHistoryScreen />); });
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
  return renderer.root;
}

const PERIODS = [['tout', null], ['7j', '7j'], ['30j', '30j'], ['1an', '1an'], ['vide', null]] as const;
const empty = () => { for (const k of Object.keys(mockTables)) mockTables[k] = []; };

describe('R7 : ordre des blocs et libellés existants inchangés (instantané pris sur master)', () => {
  it.each(PERIODS)('%s', async (name, chip) => {
    if (name === 'vide') empty();
    const root = await mount();
    if (chip) await pressText(root, chip);
    const current = structure(root);
    if (process.env.R7_CAPTURE) {
      const file = process.env.R7_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(normalize(current)).toEqual(normalize(before));
  });
});

// ── Logique des paliers ─────────────────────────────────────────────
describe('R7 : palier et points restants aux seuils exacts', () => {
  it.each([
    [0, 'scaled', 800], [799, 'scaled', 1], [800, 'inter', 400], [1199, 'inter', 1], [1200, 'rx', 200],
    [1399, 'rx', 1], [1400, 'rx+', 200], [1599, 'rx+', 1], [1600, 'elite', 200], [1799, 'elite', 1],
  ])('%i → %s, encore %i pts', (elo, level, remaining) => {
    expect(tierOf(elo).level).toBe(level);
    expect(tierProgress(elo).remaining).toBe(remaining);
  });

  it('Pro : aucun palier suivant, barre pleine', () => {
    for (const elo of [1800, 2400]) {
      expect(tierProgress(elo)).toEqual({ tier: ELO_TIERS[5], next: null, remaining: null, ratio: 1 });
    }
  });

  it('seuils et noms repris de eloLevels, du plus bas au plus haut', () => {
    expect(ELO_TIERS.map((t) => `${t.name} ${t.min}`)).toEqual(['Scaled 0', 'Inter 800', 'RX 1200', 'RX+ 1400', 'Elite 1600', 'Pro 1800']);
  });

  it('barre : avancement entre le seuil du palier et celui du suivant', () => {
    expect(tierProgress(1200).ratio).toBe(0);
    expect(tierProgress(1250).ratio).toBe(0.25);
    expect(tierProgress(1300).ratio).toBe(0.5);
    expect(tierProgress(799).ratio).toBeCloseTo(799 / 800);
  });

  it('Passage : première entrée dans le palier, absent si la courbe y reste ou n’y entre pas', () => {
    expect(tierPassageIndex([1150, 1180, 1210, 1190, 1260, 1250], 'rx')).toBe(2);
    expect(tierPassageIndex([1210, 1250, 1230], 'rx')).toBeNull();
    expect(tierPassageIndex([1100, 1150], 'rx')).toBeNull();
  });

  it('Meilleur : première occurrence du maximum', () => {
    expect(bestIndex([1150, 1260, 1200, 1260])).toBe(1);
    expect(bestIndex([])).toBeNull();
  });

  it('bandes et seuils limités à la plage affichée', () => {
    expect(tierBands(1100, 1300).map((b) => [b.tier.level, b.from, b.to])).toEqual([['inter', 1100, 1200], ['rx', 1200, 1300]]);
    expect(tierBands(1850, 1900).map((b) => [b.tier.level, b.from, b.to])).toEqual([['pro', 1850, 1900]]);
    expect(thresholdsIn(1100, 1300).map((t) => t.min)).toEqual([1200]);
    expect(thresholdsIn(1200, 1300)).toEqual([]);
  });
});

// ── Rendu ────────────────────────────────────────────────────────────
const THEMES = [['clair', lightTheme], ['sombre', darkTheme]] as const;
const txt = (root: ReactTestInstance, id: string) => hostText(byID(root, id));

describe('R7 : carte ELO', () => {
  it('ELO en numberL Oswald, palier RX, points restants, barre et bornes', async () => {
    const root = await mount();
    expect(flat(byID(root, 'elo-current'))).toMatchObject({ fontFamily: axTypography.numberL.fontFamily, fontSize: axTypography.numberL.fontSize });
    expect(txt(root, 'elo-tier-current-name')).toBe('RX');
    expect(txt(root, 'elo-tier-remaining')).toBe('encore 150 pts avant RX+');
    expect(flat(byID(root, 'elo-tier-progress-fill')).width).toBe('25%');
    expect(txt(root, 'elo-tier-bound-from')).toBe('RX · 1200');
    expect(txt(root, 'elo-tier-bound-to')).toBe('RX+ · 1400');
  });

  it('pastille et nom à la couleur du palier, ajustée au thème', async () => {
    for (const [, theme] of THEMES) {
      const root = await mount(theme);
      const ink = levelInk('rx', theme.ax);
      expect(flat(byID(root, 'elo-tier-current-dot')).backgroundColor).toBe(ink);
      expect(flat(byID(root, 'elo-tier-current-name')).color).toBe(ink);
      await act(async () => renderer.unmount());
    }
  });

  it('Pro : ni points restants, ni barre, ni bornes', async () => {
    mockAuth.user.elo = 1850;
    const root = await mount();
    expect(txt(root, 'elo-tier-current-name')).toBe('Pro');
    expect(byID(root, 'elo-tier-remaining')).toBeUndefined();
    expect(byID(root, 'elo-tier-progress')).toBeUndefined();
    expect(byID(root, 'elo-tier-bounds')).toBeUndefined();
  });

  it('en anglais : libellé traduit', async () => {
    const i18n = jest.requireActual('../i18n').default;
    await act(async () => { await i18n.changeLanguage('en'); });
    try {
      const root = await mount();
      expect(txt(root, 'elo-tier-remaining')).toBe('150 pts to RX+');
      expect(txt(root, 'elo-tier-you')).toBe('You');
    } finally {
      await act(async () => { await i18n.changeLanguage('fr'); });
    }
  });
});

describe('R7 : graphique', () => {
  it('bandes des paliers de la plage, seuil 1200 en pointillés avec sa valeur', async () => {
    const root = await mount();
    expect(byID(root, 'elo-tier-band-inter')).toBeDefined();
    expect(byID(root, 'elo-tier-band-rx')).toBeDefined();
    expect(byID(root, 'elo-tier-band-scaled')).toBeUndefined();
    expect(byID(root, 'elo-tier-band-rx+')).toBeUndefined();
    expect(byID(root, 'elo-tier-threshold-rx').props.strokeDasharray).toBeTruthy();
    expect(txt(root, 'elo-tier-threshold-label-rx')).toBe('1200');
  });

  it('points colorés selon le palier, dernier point mis en avant', async () => {
    const root = await mount();
    const c = lightTheme.ax;
    // Courbe : 1150, 1180, 1210, 1190, 1260, 1250.
    expect(byID(root, 'elo-tier-dot-0').props.fill).toBe(levelInk('inter', c));
    expect(byID(root, 'elo-tier-dot-2').props.fill).toBe(levelInk('rx', c));
    expect(byID(root, 'elo-tier-dot-5').props.r).toBeGreaterThan(byID(root, 'elo-tier-dot-4').props.r);
    expect(byID(root, 'elo-tier-dot-6')).toBeUndefined();
  });

  it('repères « Passage » et « Meilleur »', async () => {
    const root = await mount();
    expect(txt(root, 'elo-tier-passage')).toBe('Passage RX · 10/09');
    expect(txt(root, 'elo-tier-best')).toBe('Meilleur · 1260');
    expect(byID(root, 'elo-tier-best-ring').props.cx).toBe(byID(root, 'elo-tier-dot-4').props.cx);
    expect(byID(root, 'elo-tier-passage-line').props.x1).toBe(byID(root, 'elo-tier-dot-2').props.cx);
  });

  it('sur 7 jours, le passage suit la période filtrée', async () => {
    const root = await mount();
    await pressText(root, '7j');
    expect(txt(root, 'elo-tier-passage')).toBe('Passage RX · 24/09');
  });

  it('sans entrée dans le palier sur la période : pas de repère « Passage »', async () => {
    mockTables.elo_history = [];
    mockTables.tournament_elo_history = [];
    mockTables.daily_tournament_elo_history = [
      { id: 'x1', tournament_id: 'd', elo_before: 1210, elo_after: 1240, elo_delta: 30, final_rank: 4, calculated_at: '2026-09-20T18:00:00', daily_tournaments: { wod_name: 'Cindy' } },
      { id: 'x2', tournament_id: 'd', elo_before: 1240, elo_after: 1250, elo_delta: 10, final_rank: 4, calculated_at: '2026-09-22T18:00:00', daily_tournaments: { wod_name: 'Grace' } },
    ];
    mockTables.tournament_match_elo_history = [];
    const root = await mount();
    expect(byID(root, 'elo-tier-passage')).toBeUndefined();
    expect(txt(root, 'elo-tier-best')).toBe('Meilleur · 1250');
  });
});

describe('R7 : carte Paliers', () => {
  it('six paliers, dépassés pleins, suivants estompés, « Toi » sous le palier actuel', async () => {
    const root = await mount();
    const c = lightTheme.ax;
    expect(ELO_TIERS.map((t) => txt(root, `elo-tier-step-name-${t.level}`))).toEqual(['Scaled', 'Inter', 'RX', 'RX+', 'Elite', 'Pro']);
    for (const lvl of ['scaled', 'inter', 'rx']) {
      expect(flat(byID(root, `elo-tier-step-bar-${lvl}`)).backgroundColor).toBe(levelInk(lvl, c));
    }
    for (const lvl of ['rx+', 'elite', 'pro']) {
      expect(flat(byID(root, `elo-tier-step-bar-${lvl}`)).backgroundColor).not.toBe(levelInk(lvl, c));
      expect(flat(byID(root, `elo-tier-step-name-${lvl}`)).color).toBe(c.textMuted);
    }
    const you = root.findAll((n) => n.props.testID === 'elo-tier-you' && isHostText(n));
    expect(you).toHaveLength(1);
    expect(hostText(you[0])).toBe('Toi');
    let p: ReactTestInstance | null = you[0];
    while (p && p.props.testID !== 'elo-tier-step-rx') p = p.parent;
    expect(p).not.toBeNull();
  });
});

describe('R7 : contraste AA des couleurs de palier dans les deux thèmes', () => {
  it.each(THEMES)('%s', (_n, theme) => {
    for (const t of ELO_TIERS) {
      expect(contrast(levelInk(t.level, theme.ax), theme.ax.surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(theme.ax.textMuted, theme.ax.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('les couleurs affichées sont celles ajustées, dans chaque thème', async () => {
    for (const [, theme] of THEMES) {
      const root = await mount(theme);
      expect(flat(byID(root, 'elo-tier-step-name-inter')).color).toBe(levelInk('inter', theme.ax));
      expect(txt(root, 'elo-tier-threshold-label-rx')).toBe('1200');
      expect(byID(root, 'elo-tier-threshold-label-rx').props.fill).toBe(levelInk('rx', theme.ax));
      await act(async () => renderer.unmount());
    }
  });
});

describe('R7 : filtres, liste, navigation et callbacks inchangés', () => {
  it('filtres : 7j / 30j / 1an / Tout, sélection et nombre de lignes', async () => {
    const root = await mount();
    const count = () => root.findAll((n) => typeof n.props.testID === 'string' && /^elo-row-/.test(n.props.testID) && isHostText(n) === false && typeof n.props.onPress === 'function').length;
    expect(textByContent(root, 'HISTORIQUE (5)')).toBeDefined();
    for (const [chip, n] of [['7j', 2], ['30j', 4], ['1an', 5], ['Tout', 5]] as const) {
      await pressText(root, chip);
      expect(textByContent(root, `HISTORIQUE (${n})`)).toBeDefined();
      expect(count()).toBeGreaterThanOrEqual(n);
    }
  });

  it('WOD : ouvre le détail avec le classement ; autres lignes sans navigation ; retour', async () => {
    const root = await mount();
    await pressText(root, 'Fran');
    expect(mockNavigate).toHaveBeenCalledWith('WODDetail', { wodId: 'w-4', scrollToLeaderboard: true });
    mockNavigate.mockClear();
    await pressText(root, 'Battle AthleX #3');
    await pressText(root, 'Mini Murph');
    await pressText(root, 'Sprint #7 · vs Diego B.');
    expect(mockNavigate).not.toHaveBeenCalled();
    await pressText(root, 'Retour');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('lecture seule : uniquement des select sur les quatre tables et profiles', async () => {
    await mount();
    const tables = [...new Set(mockCalls.map((c) => c.table))].sort();
    expect(tables).toEqual(['daily_tournament_elo_history', 'elo_history', 'profiles', 'tournament_elo_history', 'tournament_match_elo_history']);
    expect(mockCalls.every((c) => ['select', 'eq', 'order', 'limit', 'in'].includes(c.method))).toBe(true);
  });

  it('rang : médailles Lucide pour 1 à 3, #N au-delà, aucun emoji', async () => {
    const root = await mount();
    expect(byID(root, 'elo-rank-medal-1')).toBeDefined();
    expect(byID(root, 'elo-rank-medal-3')).toBeDefined();
    expect(textByContent(root, '#5')).toBeDefined();
    const all = root.findAll(isHostText).map(hostText).join(' ');
    expect(all.match(EMOJI)).toBeNull();
  });
});

describe('R7 : 390 px et textes longs', () => {
  it('libellé long sur une ligne, colonne rétractable ; bornes et repères rétractables', async () => {
    const root = await mount();
    const long = textByContent(root, LONG);
    expect(long.props.numberOfLines).toBe(1);
    expect(flat(long.parent!.parent!)).toMatchObject({ flex: 1, minWidth: 0 });
    for (const id of ['elo-tier-bound-from', 'elo-tier-bound-to', 'elo-tier-passage', 'elo-tier-best']) {
      const n = byID(root, id);
      expect(n.props.numberOfLines).toBe(1);
      expect(flat(n).flexShrink).toBe(1);
    }
    for (const t of ELO_TIERS) {
      const step = byID(root, `elo-tier-step-${t.level}`);
      expect(flat(step)).toMatchObject({ flex: 1, minWidth: 0 });
    }
  });

  it('graphique à 390 px : largeur de la carte moins les marges', () => {
    expect(Dimensions.get('window').width).toBeGreaterThan(0);
    expect(CHART_WIDTH).toBe(Dimensions.get('window').width - 4 * axSpacing.lg);
  });

  it('espace bas : useTabBarScrollSpace', () => {
    const src = fs.readFileSync(require.resolve('../screens/profile/EloHistoryScreen.tsx'), 'utf8');
    expect(src).toMatch(/useTabBarScrollSpace\(\)/);
    expect(src).toMatch(/paddingBottom: tabSpace/);
  });
});
