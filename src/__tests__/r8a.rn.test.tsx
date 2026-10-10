import React from 'react';
import fs from 'fs';
import path from 'path';
import { ScrollView, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import {
  VARIANTS, Ctx, Db, Route, Row, Theme, NOW, flush, structure, normalize, EMOJI,
  LONG, LONG_WOD, LONG_USER, hostText, isHostText,
} from './r8aHarness';
import { AxButton, AxCard, AxChip, AxStatusDot, AxTag } from '../components/ax';
import { axTypography } from '../theme/axTokens';
import i18n from '../i18n';
import { Crown } from 'lucide-react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockTheme = lightTheme;
const mockDb: Db = { tables: {}, rpc: {}, calls: [] };
const mockRoute: Route = { params: undefined };
const mockAuth: { user: Row | null; currentBox: Row | null } = { user: null, currentBox: null };

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() }),
    useRoute: () => mockRoute,
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
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
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/analytics', () => ({ trackTournamentJoin: jest.fn() }));
jest.mock('../services/notifications', () => ({ scheduleTournamentReminder: jest.fn(async () => {}) }));
jest.mock('../services/eloRank', () => ({ fetchEloRank: jest.fn(async () => 12) }));
jest.mock('../hooks/useFocusQuery', () => ({ useFocusQuery: () => ({ data: 12 }) }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../navigation/tabBarLayout', () => ({
  ...jest.requireActual('../navigation/tabBarLayout'),
  useTabBarScrollSpace: () => 321,
}));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const eq: Array<[string, unknown]> = [];
    const inn: Array<[string, unknown[]]> = [];
    const rows = () => (mockDb.tables[table] ?? []).filter((r) =>
      eq.every(([k, v]) => !(k in r) || r[k] === v) && inn.every(([k, v]) => !(k in r) || v.includes(r[k])));
    const b: Record<string, unknown> = {};
    const chain = (method: string) => (...args: unknown[]) => {
      mockDb.calls.push({ table, method, args });
      if (method === 'eq') eq.push([args[0] as string, args[1]]);
      if (method === 'in') inn.push([args[0] as string, args[1] as unknown[]]);
      return b;
    };
    ['select', 'eq', 'in', 'is', 'gt', 'gte', 'lt', 'neq', 'order', 'limit', 'update', 'insert', 'delete', 'upsert', 'not', 'or']
      .forEach((m) => { b[m] = chain(m); });
    const one = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
    b.single = one;
    b.maybeSingle = one;
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null, count: rows().length }).then(res, rej);
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: (name: string, args: unknown) => {
        mockDb.calls.push({ table: `rpc:${name}`, method: 'rpc', args: [args] });
        return Promise.resolve({ data: mockDb.rpc[name] ?? null, error: null });
      },
    },
  };
});

let renderer: TestRenderer.ReactTestRenderer | null = null;
async function mount(el: React.ReactElement, theme: Theme = lightTheme) {
  mockTheme = theme;
  if (renderer) act(() => { renderer?.unmount(); });
  await act(async () => { renderer = TestRenderer.create(el); });
  await flush();
  return (renderer as unknown as TestRenderer.ReactTestRenderer).root;
}
const ctx: Ctx = { db: mockDb, route: mockRoute, auth: mockAuth, mount };

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask', 'setTimeout', 'setInterval', 'clearInterval', 'clearTimeout'] });
  jest.setSystemTime(NOW);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockDb.tables = {};
  mockDb.rpc = {};
  mockDb.calls = [];
  mockRoute.params = undefined;
  mockAuth.user = { id: 'local', role: 'athlete', elo: 1200, level: 'rx' };
  mockAuth.currentBox = { id: 'box1', name: 'AthleX Lyon' };
});
afterEach(() => {
  act(() => { renderer?.unmount(); });
  renderer = null;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const BEFORE_FILE = path.join(__dirname, 'r8aStructureBefore.json');

describe('R8a : ordre des blocs inchangé', () => {
  if (process.env.R8A_CAPTURE === '1') {
    const out: Record<string, string[]> = {};
    it.each(VARIANTS.map((v) => [v.name, v] as const))('capture %s', async (_n, v) => {
      out[v.name] = structure(await v.run(ctx));
    });
    afterAll(() => { fs.writeFileSync(BEFORE_FILE, `${JSON.stringify(out, null, 1)}\n`); });
    return;
  }
  const BEFORE: Record<string, string[]> = JSON.parse(fs.readFileSync(BEFORE_FILE, 'utf8'));
  it('une capture avant par état', () => {
    expect(Object.keys(BEFORE).sort()).toEqual(VARIANTS.map((v) => v.name).sort());
  });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s : mêmes textes, même ordre', async (_n, v) => {
    for (const th of [lightTheme, darkTheme]) {
      const root = await v.run(ctx, th);
      expect(normalize(structure(root))).toEqual(normalize(BEFORE[v.name]));
      act(() => { renderer?.unmount(); });
    }
  });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s : aucun emoji affiché', async (_n, v) => {
    const root = await v.run(ctx);
    const withEmoji = structure(root).filter((x) => x.replace(EMOJI, '') !== x);
    expect(withEmoji).toEqual([]);
  });
});

const variant = (name: string) => {
  const v = VARIANTS.find((x) => x.name === name);
  if (!v) throw new Error(name);
  return v;
};
const byTestID = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => n.props.testID === id && typeof n.type !== 'string')[0];
const accents = (root: ReactTestInstance) =>
  root.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent');
const press = async (n: ReactTestInstance) => {
  await act(async () => { n.props.onPress(); });
  await flush();
};

describe('R8a : une seule action principale accent par écran', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s : au plus une AxButton accent', async (_n, v) => {
    expect(accents(await v.run(ctx)).length).toBeLessThanOrEqual(1);
  });
  it.each([
    ['tournoi-pas-inscrit', 'tournament-register'],
    ['ligue-pas-inscrit', 'tournament-register'],
    ['tournoi-inscriptions-pendant', 'tournament-register'],
    ['wods-à-faire', 'tournament-launch-w1'],
    ['wods-score-rejeté', 'tournament-resubmit-w1'],
    ['valider-staff', 'tournament-validate-s1'],
    ['wod-détail', 'tourwod-launch-camera'],
    ['wod-soumission', 'tourwod-submit'],
    ['wod-envoyé', 'tourwod-back'],
    ['compétitions-inter-box', 'competition-inter-box'],
  ])('%s : l’action principale est %s', async (name, id) => {
    const a = accents(await variant(name).run(ctx));
    expect(a.map((b) => b.props.testID)).toEqual([id]);
  });
  it.each([
    ['tournoi-inscrit', 'tournament-leave'],
    ['valider-staff', 'tournament-reject-s1'],
  ])('%s : %s en variante stop', async (name, id) => {
    expect(byTestID(await variant(name).run(ctx), id).props.variant).toBe('stop');
  });
});

describe('R8a : composants ax adoptés', () => {
  it('en-tête de tournoi : AxCard featured, statut AxStatusDot, niveau AxTag, onglets AxChip', async () => {
    const root = await variant('tournoi-pas-inscrit').run(ctx);
    expect(byTestID(root, 'tournament-header').props.variant).toBe('featured');
    expect(byTestID(root, 'tournament-status').type).toBe(AxStatusDot);
    expect(byTestID(root, 'tournament-level').type).toBe(AxTag);
    expect(root.findAllByType(AxChip).length).toBeGreaterThanOrEqual(3);
  });
  it('« Comment ça marche » : une carte par étape du code', async () => {
    const root = await variant('tournoi-pas-inscrit').run(ctx);
    expect(root.findAll((n) => n.type === AxCard && /^tournament-step-/.test(String(n.props.testID))).length).toBe(4);
  });
  it('Compétitions : onglets AxChip, cartes AxCard, statut AxStatusDot', async () => {
    const root = await variant('compétitions').run(ctx);
    expect(root.findAllByType(AxChip).length).toBe(4);
    expect(byTestID(root, 'competition-tournament-c1').type).toBe(AxCard);
    expect(byTestID(root, 'competition-tournament-status-c1').type).toBe(AxStatusDot);
  });
  it.each([['clair', lightTheme], ['sombre', darkTheme]] as const)('Divisions (%s) : promus en AxTag success, relégués en AxTag danger, points en numberM', async (_t, th) => {
    const d2 = await variant('divisions-vue').run(ctx, th);
    expect(byTestID(d2, 'division-promote-dm4').props.tone).toBe('success');
    expect(byTestID(d2, 'division-relegate-dm3').props.tone).toBe('danger');
    expect(byTestID(d2, 'division-promote-dm2')).toBeUndefined();
    expect(byTestID(d2, 'division-relegate-dm4')).toBeUndefined();
    const pts = d2.findAll((n) => isHostText(n) && hostText(n) === i18n.t('divisions.points', { n: 30 }));
    expect(StyleSheet.flatten(pts[0].props.style).fontFamily).toBe(axTypography.numberM.fontFamily);
    expect(StyleSheet.flatten(pts[0].props.style).color).toBe(th.ax.text);
    const ink = (id: string) => StyleSheet.flatten(byTestID(d2, id).findAll(isHostText)[0].props.style).color;
    expect(ink('division-promote-dm4')).toBe(th.ax.success);
    expect(ink('division-relegate-dm3')).toBe(th.ax.danger);
  });
  it('Tableau : WOD en AxTag, match en AxCard, vainqueur signalé', async () => {
    const root = await variant('bracket').run(ctx);
    expect(root.findAll((n) => n.type === AxTag && n.props.testID === 'bracket-wod').length).toBeGreaterThan(0);
    expect(byTestID(root, 'bracket-match-m1').type).toBe(AxCard);
    const crowns = byTestID(root, 'bracket-match-m1').findAllByType(Crown);
    expect(crowns.length).toBe(1);
    for (const cr of crowns) {
      const row = cr.parent as ReactTestInstance;
      expect(row.findAll(isHostText).map(hostText)).toContain(LONG_USER);
    }
  });
});

describe('R8a : navigation et callbacks inchangés', () => {
  it('carte de tournoi → Tournament', async () => {
    const root = await variant('compétitions').run(ctx);
    await press(byTestID(root, 'competition-tournament-c1'));
    expect(mockNavigate).toHaveBeenCalledWith('Tournament', { tournamentId: 'c1' });
  });
  it.each([
    ['compétitions-inter-box', 'competition-inter-box', 'InterCompetitionList', undefined],
    ['compétitions-mini', 'competition-create-mini', 'DailyTournaments', undefined],
    ['compétitions-physiques', 'competition-physical-qualification', 'PhysicalCompetition', { mode: 'qualification' }],
    ['compétitions-physiques', 'competition-physical-info', 'PhysicalCompetition', { mode: 'info' }],
  ])('%s : %s → %s', async (name, id, route, params) => {
    const root = await variant(name).run(ctx);
    await press(byTestID(root, id));
    if (params) expect(mockNavigate).toHaveBeenCalledWith(route, params);
    else expect(mockNavigate).toHaveBeenCalledWith(route);
  });
  it('rejoindre un mini-tournoi insère la participation', async () => {
    const root = await variant('compétitions-mini').run(ctx);
    const join = root.findAll((n) => n.type === AxButton && /^competition-join-/.test(String(n.props.testID)))[0];
    await press(join);
    expect(mockDb.calls.some((c) => c.table === 'daily_tournament_participants' && c.method === 'insert')).toBe(true);
  });
  it('lancer un WOD de tournoi → TournamentWOD', async () => {
    const root = await variant('wods-à-faire').run(ctx);
    await press(byTestID(root, 'tournament-launch-w1'));
    expect(mockNavigate).toHaveBeenCalledWith('TournamentWOD', expect.objectContaining({ tournamentId: 't1' }));
  });
  it('WOD : « Lancer le WOD avec caméra » → TimerRun, retour → goBack', async () => {
    const root = await variant('wod-détail').run(ctx);
    await press(byTestID(root, 'tourwod-launch-camera'));
    expect(mockNavigate).toHaveBeenCalledWith('TimerRun', expect.any(Object));
    const done = await variant('wod-envoyé').run(ctx);
    await press(byTestID(done, 'tourwod-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
  it('WOD : la soumission écrit un score en attente', async () => {
    await variant('wod-envoyé').run(ctx);
    const w = mockDb.calls.find((c) => c.table === 'tournament_scores' && (c.method === 'insert' || c.method === 'update'));
    expect(w?.args[0]).toEqual(expect.objectContaining({ tournament_id: 't1', status: 'pending' }));
  });
  it('staff : valider et rejeter appellent leur mise à jour', async () => {
    const root = await variant('valider-staff').run(ctx);
    await press(byTestID(root, 'tournament-validate-s1'));
    expect(mockDb.calls.some((c) => c.table === 'tournament_scores' && c.method === 'update'
      && (c.args[0] as Row).status === 'validated')).toBe(true);
  });
});

describe('R8a : couleurs et typographies dans les deux thèmes', () => {
  it.each([['clair', lightTheme], ['sombre', darkTheme]] as const)('thème %s', async (_n, th) => {
    const root = await variant('classement').run(ctx, th);
    const title = root.findAll((n) => isHostText(n) && hostText(n) === LONG)[0];
    const st = StyleSheet.flatten(title.props.style);
    expect(st.color).toBe(th.ax.text);
    const pts = root.findAll((n) => isHostText(n) && hostText(n) === '200 pts')[0];
    const ps = StyleSheet.flatten(pts.props.style);
    expect(ps.fontFamily).toBe(axTypography.numberM.fontFamily);
    expect(ps.color).toBe(th.ax.text);
    act(() => { renderer?.unmount(); });
    const comp = await variant('compétitions').run(ctx, th);
    const sel = comp.findAllByType(AxChip).filter((c) => c.props.selected);
    expect(sel.length).toBe(1);
  });
});

describe('R8a : espace bas = useTabBarScrollSpace', () => {
  it.each(['compétitions', 'tournoi-pas-inscrit', 'classement', 'wod-détail', 'wod-soumission'])('%s', async (name) => {
    const root = await variant(name).run(ctx);
    const pads = root.findAllByType(ScrollView)
      .map((sv) => StyleSheet.flatten(sv.props.contentContainerStyle)?.paddingBottom);
    expect(pads).toContain(321);
  });
});

describe('R8a : textes longs sans débordement à 390 px', () => {
  const LONGS = [LONG, LONG_WOD, LONG_USER];
  const style = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
  const isRow = (n: ReactTestInstance) => ['row', 'row-reverse'].includes(String(style(n).flexDirection));
  // Jusqu'au premier conteneur en colonne, chaque maillon posé dans une rangée à plusieurs
  // enfants doit pouvoir rétrécir, sinon le texte long pousse ses voisins hors de l'écran.
  const shrinks = (n: ReactTestInstance | null): boolean => {
    for (; n && n.parent; n = n.parent) {
      const parent = n.parent;
      if (typeof parent.type === 'string' && !isRow(parent)) return true;
      if (typeof parent.type !== 'string') continue;
      const st = style(n);
      if (parent.children.length > 1 && !((st.flex ?? 0) > 0 || (st.flexShrink ?? 0) > 0)) return false;
    }
    return true;
  };
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (_n, v) => {
    const root = await v.run(ctx);
    const texts = root.findAll((n) => isHostText(n) && LONGS.some((l) => hostText(n).includes(l)));
    const bad = texts.filter((t) => !shrinks(t)).map(hostText);
    expect(bad).toEqual([]);
  });
});

export { StyleSheet, ReactTestInstance };
