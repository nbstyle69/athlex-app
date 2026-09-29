import React from 'react';
import fs from 'fs';
import path from 'path';
import { StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import {
  VARIANTS, Ctx, Db, Route, Row, Theme, NOW, flush, structure, normalize, EMOJI,
} from './r8aHarness';

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
    const withEmoji = structure(root).filter((x) => new RegExp(EMOJI.source, 'u').test(x));
    expect(withEmoji).toEqual([]);
  });
});

export { StyleSheet, ReactTestInstance };
