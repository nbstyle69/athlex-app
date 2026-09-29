/**
 * R7 — Historique ELO au nouveau design, avec les paliers : carte ELO,
 * graphique par paliers, carte « Paliers ». Filtres de période, liste et
 * navigation inchangés.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Dimensions, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import i18n from '../i18n';
import { axTypography } from '../theme/axTokens';
import { AxChip, AxScreenHeader, withAlpha } from '../components/ax';
import { ELO_TIERS, tierInk, tierBand, tierInkOnBand } from '../utils/eloTiers';
import BEFORE from './r7StructureBefore.json';
import EloHistoryScreen from '../screens/profile/EloHistoryScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockTheme: AppTheme = lightTheme;
let mockUser: Record<string, unknown> | null = null;
const mockTables: Record<string, unknown[]> = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 92 }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme, mode: mockTheme === jest.requireActual('../theme/palette').darkTheme ? 'dark' : 'light' }),
}));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('react-native-svg', () => {
  const R = jest.requireActual('react');
  const { View, Text } = jest.requireActual('react-native');
  const C = (name: string) => (p: Record<string, unknown>) => R.createElement(View, { ...p, svg: name }, p.children);
  const T = (p: Record<string, unknown>) => R.createElement(Text, { svgText: true, fill: p.fill, x: p.x, y: p.y, textAnchor: p.textAnchor }, p.children);
  return {
    ...jest.requireActual('../__mocks__/rn/svg.js'),
    __esModule: true, default: C('Svg'), Svg: C('Svg'), Path: C('Path'), Circle: C('Circle'), Defs: C('Defs'),
    LinearGradient: C('LinearGradient'), Stop: C('Stop'), Line: C('Line'), Rect: C('Rect'), G: C('G'), Text: T,
  };
});
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'in']) b[m] = () => b;
    b.then = (res: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: mockTables[table] ?? [], error: null }).then(res);
    return b;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});

export const NOW = new Date('2026-09-28T10:00:00Z');
const LONG = 'Une séance au titre particulièrement long pour vérifier qu’aucun texte ne déborde de la ligne';

function seed() {
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockTables.elo_history = [
    { id: 'w5', wod_id: 'wod-5', elo_before: 1450, elo_after: 1432, elo_delta: -18, rank: 5, created_at: '2026-09-27T18:00:00Z', box_wods: { title: LONG, wod_type: 'AMRAP' } },
    { id: 'w1', wod_id: 'wod-1', elo_before: 1180, elo_after: 1210, elo_delta: 30, rank: 3, created_at: '2026-08-15T18:00:00Z', box_wods: { title: 'Fran', wod_type: 'FOR_TIME' } },
    { id: 'w0', wod_id: 'wod-0', elo_before: 1150, elo_after: 1180, elo_delta: 30, rank: null, created_at: '2025-06-01T18:00:00Z', box_wods: [{ title: 'Murph', wod_type: 'FOR_TIME' }] },
  ];
  mockTables.tournament_elo_history = [
    { id: 't3', tournament_id: 'tour-3', elo_before: 1390, elo_after: 1410, elo_change: 20, final_rank: 2, calculated_at: '2026-09-20T18:00:00Z', tournaments: { name: "Open d'automne" } },
  ];
  mockTables.daily_tournament_elo_history = [
    { id: 'd4', tournament_id: 'dt-4', elo_before: 1410, elo_after: 1450, elo_delta: 40, final_rank: 1, calculated_at: '2026-09-24T18:00:00Z', daily_tournaments: { wod_name: 'Mini-tournoi du jeudi' } },
  ];
  mockTables.tournament_match_elo_history = [
    { id: 'm2', match_id: 'bm-2', opponent_id: 'p-2', result: 'win', elo_before: 1210, elo_after: 1390, elo_delta: 180, created_at: '2026-09-10T18:00:00Z', tournament_bracket_matches: { tournament_id: 'tour-2', tournaments: { name: 'Battle #3' } } },
  ];
  mockTables.profiles = [{ id: 'p-2', username: 'Diego' }];
}

let r: TestRenderer.ReactTestRenderer;
const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
/** Blocs ajoutés par R7 : exclus de la comparaison avec l'instantané de master. */
const NEW_BLOCKS = ['elo-tier', 'elo-tiers-card', 'elo-chart-thresholds', 'elo-chart-legend'];
/** Médailles emoji de master, remplacées par l'icône Lucide Medal. */
const MEDALS = ['🥇', '🥈', '🥉'];
/** Suite ordonnée des textes visibles de l'écran, hors blocs ajoutés par R7. */
function structure(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance) => {
    if (NEW_BLOCKS.includes(n.props.testID)) return;
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
async function mount(theme: AppTheme = lightTheme) {
  mockTheme = theme;
  await act(async () => { r = TestRenderer.create(<EloHistoryScreen />); });
  await act(async () => {});
  return r.root;
}
async function pressText(text: string) {
  let n: ReactTestInstance | null = r.root.findAll((x) => isHostText(x) && hostText(x) === text)[0];
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`aucun appuyable pour « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress(); });
}

beforeAll(async () => { await i18n.changeLanguage('fr'); });
beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'] });
  mockUser = { id: 'u1', elo: 1432 };
  seed();
  mockNavigate.mockClear(); mockGoBack.mockClear();
});
afterEach(async () => {
  if (r) await act(async () => r.unmount());
  jest.useRealTimers();
});

const VARIANTS: { name: string; run: () => Promise<unknown> }[] = [
  { name: 'tout', run: async () => { await mount(); } },
  { name: '7j', run: async () => { await mount(); await pressText('7j'); } },
  { name: '30j', run: async () => { await mount(); await pressText('30j'); } },
  { name: '1an', run: async () => { await mount(); await pressText('1an'); } },
  { name: 'vide', run: async () => { for (const k of Object.keys(mockTables)) delete mockTables[k]; await mount(); } },
];

describe('R7 : ordre des blocs et libellés existants inchangés (instantané pris sur master)', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    await v.run();
    const current = structure(r.root);
    if (process.env.R7_CAPTURE) {
      const file = process.env.R7_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(current).toEqual(before.filter((t) => !MEDALS.includes(t)));
  });
});

const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const byId = (id: string) => r.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
const one = (id: string) => {
  const found = byId(id);
  if (found.length === 0) throw new Error(`testID absent : ${id}`);
  return found[0];
};
const textOf = (id: string) => hostText(one(id));
const hasId = (id: string) => byId(id).length > 0;

describe('R7 : navigation et callbacks inchangés', () => {
  it('une ligne WOD ouvre le WOD au classement ; les autres lignes ne naviguent pas ; Retour revient', async () => {
    await mount();
    const press = async (id: string) => {
      let n: ReactTestInstance | null = r.root.findAll((x) => x.props.testID === id)[0];
      while (n && typeof n.props.onPress !== 'function') n = n.parent;
      const target = n as ReactTestInstance;
      await act(async () => { target.props.onPress(); });
    };
    await press('elo-row-w5');
    expect(mockNavigate).toHaveBeenCalledWith('WODDetail', { wodId: 'wod-5', scrollToLeaderboard: true });
    mockNavigate.mockClear();
    for (const id of ['elo-row-t3', 'elo-row-d4', 'elo-row-m2']) await press(id);
    expect(mockNavigate).not.toHaveBeenCalled();
    await press('ax-screen-header-back');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(r.root.findByType(AxScreenHeader).props.title).toBe('Historique ELO');
  });

  it('filtres : Tout sélectionné au départ, un appui sélectionne la période et filtre la liste', async () => {
    await mount();
    const selected = () => r.root.findAllByType(AxChip).filter((ch) => ch.props.selected).map((ch) => ch.props.label);
    expect(r.root.findAllByType(AxChip).map((ch) => ch.props.label)).toEqual(['7j', '30j', '1an', 'Tout']);
    expect(selected()).toEqual(['Tout']);
    await pressText('30j');
    expect(selected()).toEqual(['30j']);
    expect(r.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string' && n.props.testID.startsWith('elo-row-')).map((n) => n.props.testID))
      .toEqual(['elo-row-w5', 'elo-row-d4', 'elo-row-t3', 'elo-row-m2']);
  });

  it('les requêtes restent en lecture seule sur les quatre historiques', () => {
    const src = fs.readFileSync(path.join(__dirname, '../screens/profile/EloHistoryScreen.tsx'), 'utf8');
    expect(src).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
    expect(src.match(/\.from\('([a-z_]+)'\)/g)).toEqual([
      ".from('elo_history')", ".from('tournament_elo_history')", ".from('daily_tournament_elo_history')",
      ".from('tournament_match_elo_history')", ".from('profiles')",
    ]);
  });
});

describe('R7 : carte ELO et palier actuel', () => {
  it('ordre des blocs : carte ELO (palier dedans), filtres, graphique, Paliers, liste', async () => {
    await mount();
    const order = r.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string'
      && /^(elo-card|elo-tier|elo-filter-7d|elo-chart|elo-tiers-card|elo-row-w1)$/.test(n.props.testID))
      .map((n) => n.props.testID);
    expect(order.filter((id, i) => order.indexOf(id) === i))
      .toEqual(['elo-card', 'elo-tier', 'elo-filter-7d', 'elo-chart', 'elo-tiers-card', 'elo-row-w1']);
    expect(one('elo-card').findAll((n) => n.props.testID === 'elo-tier')).not.toHaveLength(0);
  });

  const cases: [number, string, string | null, string, string | null, string][] = [
    [1432, 'RX+', 'encore 168 pts avant Elite', 'RX+ · 1400', 'Elite · 1600', '16%'],
    [799, 'Scaled', 'encore 1 pts avant Inter', 'Scaled · 0', 'Inter · 800', `${(799 / 800) * 100}%`],
    [800, 'Inter', 'encore 400 pts avant RX', 'Inter · 800', 'RX · 1200', '0%'],
    [1599, 'RX+', 'encore 1 pts avant Elite', 'RX+ · 1400', 'Elite · 1600', `${(199 / 200) * 100}%`],
    [1600, 'Elite', 'encore 200 pts avant Pro', 'Elite · 1600', 'Pro · 1800', '0%'],
    [1850, 'Pro', null, 'Pro · 1800', null, '100%'],
  ];
  it.each(cases)('ELO %i : %s, « %s », bornes et barre', async (elo, name, remaining, low, high, width) => {
    mockUser = { id: 'u1', elo };
    await mount();
    expect(textOf('elo-value')).toBe(String(elo));
    expect(textOf('elo-tier-name')).toBe(name);
    if (remaining) expect(textOf('elo-tier-remaining')).toBe(remaining);
    else expect(hasId('elo-tier-remaining')).toBe(false);
    expect(textOf('elo-tier-bound-low')).toBe(low);
    if (high) expect(textOf('elo-tier-bound-high')).toBe(high);
    else expect(hasId('elo-tier-bound-high')).toBe(false);
    expect(flat(one('elo-tier-fill')).width).toBe(width);
  });
});

describe('R7 : graphique par paliers', () => {
  it('bandes des paliers de la plage, seuils en pointillés avec leur valeur', async () => {
    await mount();
    const c = lightTheme.ax;
    // Plage affichée 1120 → 1480 : Inter, RX, RX+.
    expect(r.root.findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string' && n.props.testID.startsWith('elo-band-')).map((n) => n.props.testID))
      .toEqual(['elo-band-inter', 'elo-band-rx', 'elo-band-rx+']);
    expect(one('elo-band-rx').props.fill).toBe(tierBand('rx', c));
    for (const [level, min] of [['rx', '1200'], ['rx+', '1400']] as const) {
      const g = one(`elo-threshold-${level}`);
      const line = g.findAll((n) => n.props.svg === 'Line')[0];
      expect(line.props.strokeDasharray).toBe('4 4');
      expect(line.props.stroke).toBe(tierInkOnBand(level, c));
      const label = g.findAll((n) => isHostText(n))[0];
      expect(hostText(label)).toBe(min);
      expect(label.props.fill).toBe(tierInkOnBand(level, c));
    }
    expect(hasId('elo-threshold-inter')).toBe(false);
  });

  it('points colorés par palier, dernier point mis en avant', async () => {
    await mount();
    const c = lightTheme.ax;
    // Points : 1150, 1180, 1210, 1390, 1410, 1450, 1432.
    const levels = ['inter', 'inter', 'rx', 'rx', 'rx+', 'rx+', 'rx+'] as const;
    levels.forEach((level, i) => {
      const dot = one(`elo-dot-${i}`);
      expect(dot.props.fill).toBe(tierInkOnBand(level, c));
      expect(dot.props.r).toBe(i === levels.length - 1 ? 6 : 3.5);
    });
    expect(hasId('elo-dot-7')).toBe(false);
    expect(one('elo-last-halo').props.cx).toBe(one('elo-dot-6').props.cx);
  });

  it('repères « Passage RX+ · 20/9 » (première entrée sur la période) et « Meilleur · 1450 »', async () => {
    await mount();
    expect(textOf('elo-passage')).toBe('Passage RX+ · 20/9');
    expect(one('elo-passage-ring').props.cx).toBe(one('elo-dot-4').props.cx);
    expect(textOf('elo-best')).toBe('Meilleur · 1450');
    expect(one('elo-best-ring').props.cx).toBe(one('elo-dot-5').props.cx);
  });

  it('7 jours : déjà RX+ en début de période, pas de repère Passage ; Meilleur sur la période', async () => {
    await mount();
    await pressText('7j');
    expect(hasId('elo-passage')).toBe(false);
    expect(hasId('elo-passage-ring')).toBe(false);
    expect(textOf('elo-best')).toBe('Meilleur · 1450');
  });

  it('la courbe tient dans la carte : largeur de l’écran moins marges, padding et bordure', async () => {
    await mount();
    const svg = one('elo-chart').findAll((n) => typeof n.type === 'string' && n.props.svg === 'Svg')[0];
    expect(svg.props.width + 2 * 16 + 2 * 16 + 2).toBe(Dimensions.get('window').width);
    for (const id of ['elo-passage', 'elo-best']) expect(one(id).props.numberOfLines).toBe(1);
  });
});

describe('R7 : carte Paliers', () => {
  it('six paliers dans l’ordre, dépassés pleins, suivants estompés, « Toi » sous le palier actuel', async () => {
    await mount();
    const c = lightTheme.ax;
    const card = one('elo-tiers-card');
    expect(hostText(card.findAll((n) => isHostText(n))[0])).toBe('Paliers');
    const steps = card.findAll((n) => typeof n.props.testID === 'string' && /^elo-tier-step-[^b]/.test(n.props.testID) && typeof n.type === 'string');
    expect(steps.map((n) => n.props.testID)).toEqual(ELO_TIERS.map((t) => `elo-tier-step-${t.level}`));
    expect(steps.map((n) => n.findAll((x) => isHostText(x)).slice(0, 2).map(hostText)))
      .toEqual([['Scaled', '0'], ['Inter', '800'], ['RX', '1200'], ['RX+', '1400'], ['Elite', '1600'], ['Pro', '1800']]);
    for (const t of ELO_TIERS) {
      const reached = ['scaled', 'inter', 'rx', 'rx+'].includes(t.level);
      expect(flat(one(`elo-tier-step-bar-${t.level}`)).backgroundColor)
        .toBe(reached ? tierInk(t.level, c) : withAlpha(tierInk(t.level, c), 0.25));
    }
    expect(one('elo-tier-step-rx+').findAll((n) => n.props.testID === 'elo-tier-you')).not.toHaveLength(0);
    expect(byId('elo-tier-you')).toHaveLength(1);
    expect(textOf('elo-tier-you')).toBe('Toi');
  });

  it('affichée aussi sans historique', async () => {
    for (const k of Object.keys(mockTables)) delete mockTables[k];
    await mount();
    expect(hasId('elo-tiers-card')).toBe(true);
  });
});

describe.each([['clair', lightTheme], ['sombre', darkTheme]])('R7 : couleurs et typographies, thème %s', (_n, theme) => {
  const c = theme.ax;

  it('ELO en numberL Oswald accentText, palier à sa couleur ajustée, barre et pastille', async () => {
    await mount(theme);
    expect(flat(one('elo-value'))).toMatchObject({ fontFamily: axTypography.numberL.fontFamily, fontSize: axTypography.numberL.fontSize, color: c.accentText });
    expect(flat(one('elo-tier-name')).color).toBe(tierInk('rx+', c));
    expect(flat(one('elo-tier-dot')).backgroundColor).toBe(tierInk('rx+', c));
    expect(flat(one('elo-tier-fill')).backgroundColor).toBe(tierInk('rx+', c));
    expect(flat(one('elo-tier-remaining')).color).toBe(c.textMuted);
    expect(flat(one('elo-gain')).color).toBe(c.success);
    expect(flat(one('elo-loss')).color).toBe(c.danger);
    expect(flat(one('elo-tier-you')).color).toBe(c.accentText);
  });

  it('liste : médailles Lucide aux couleurs du thème, rang au-delà de 3 en texte', async () => {
    await mount(theme);
    const medalColor = (rank: number) => one(`elo-rank-medal-${rank}`).findAll((n) => n.props.color !== undefined)[0].props.color;
    expect(medalColor(1)).toBe(theme.gold);
    expect(medalColor(2)).toBe(theme.silver);
    expect(medalColor(3)).toBe(theme.bronze);
    expect(one('elo-rank-medal-1').props.accessibilityLabel).toBe('1er');
    const row5 = one('elo-row-w5');
    expect(row5.findAll((n) => isHostText(n)).map(hostText)).toContain('#5');
    expect(row5.findAll((n) => isHostText(n) && n.props.numberOfLines === 1).map(hostText)[0]).toMatch(/^Une séance au titre/);
  });
});

describe('R7 : règles de la refonte', () => {
  const src = fs.readFileSync(path.join(__dirname, '../screens/profile/EloHistoryScreen.tsx'), 'utf8');
  it('aucun emoji ni couleur codée en dur dans l’écran', () => {
    expect(src).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(src).not.toMatch(/'#[0-9a-fA-F]{3,8}'/);
  });
  it('espace bas donné par useTabBarScrollSpace', () => {
    expect(src).toMatch(/contentContainerStyle=\{\[S\.scroll, \{ paddingBottom: tabSpace \}\]\}/);
  });
});
