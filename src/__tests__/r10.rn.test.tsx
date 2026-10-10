import React from 'react';
import fs from 'fs';
import path from 'path';
import { Linking, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import '../i18n';
import BEFORE from './r10StructureBefore.json';
import ReservationScreen from '../screens/reservation/ReservationScreen';
import MyReservationsScreen from '../screens/reservation/MyReservationsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockTheme = lightTheme;
const mockTables: Record<string, Record<string, unknown>[]> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];
let mockInsertStatus: string = 'confirmed';
let mockInsertError: { code: string; message: string } | null = null;
let mockMemberships: unknown[] = [];
const mockAuth: { user: { id: string } | null; currentBox: { id: string; name: string; slug?: string } | null } = {
  user: { id: 'me' }, currentBox: { id: 'box-1', name: 'CrossFit Lumière' },
};
const mockSchedule = jest.fn(async (..._a: unknown[]) => {});
const mockCancel = jest.fn(async (_id: string) => {});

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() }),
    useRoute: () => ({ params: undefined }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
  };
});
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(80),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/notifications', () => ({
  scheduleClassReminder: (...a: unknown[]) => mockSchedule(...a),
  cancelClassReminder: (id: string) => mockCancel(id),
}));
let mockPlanStatus: unknown = null;
jest.mock('../services/membership', () => ({
  ...jest.requireActual('../services/membership'),
  getMyMemberships: async () => mockMemberships,
  getMyPlanStatus: async () => mockPlanStatus,
}));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let op: 'select' | 'insert' | 'delete' = 'select';
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'insert', 'delete', 'single']) {
      b[m] = (...args: unknown[]) => {
        mockCalls.push({ table, method: m, args });
        if (m === 'insert') op = 'insert';
        if (m === 'delete') op = 'delete';
        if (m === 'eq') filters.push([args[0] as string, args[1]]);
        return b;
      };
    }
    b.then = (res: (v: unknown) => unknown) => {
      if (op === 'insert') return Promise.resolve(mockInsertError ? { data: null, error: mockInsertError } : { data: { status: mockInsertStatus }, error: null }).then(res);
      if (op === 'delete') return Promise.resolve({ data: null, error: null }).then(res);
      const rows = (mockTables[table] ?? []).filter((r) => filters.every(([k, v]) => !(k in r) || r[k] === v));
      return Promise.resolve({ data: rows, error: null }).then(res);
    };
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: async (name: string, args: unknown) => { mockCalls.push({ table: 'rpc', method: name, args: [args] }); return { data: { allowed: true, max: 3, used: 1 }, error: null }; },
    },
  };
});
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-09-28T10:00:00Z');
const LONG = 'Haltérophilie technique et conditionnement métabolique longue durée';
const LONG_COACH = 'Maximilien-Alexandre de la Tour-Dupont';
const TODAY = '2026-09-28';

function slot(id: string, start: string, end: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id, box_id: 'box-1', title, description: null, coach: 'Nico', scheduled_date: TODAY,
    start_time: start, end_time: end, max_capacity: 3, ...extra,
  };
}
function res(schedule_id: string, member_id: string, status: string, n: number, username = member_id) {
  return { schedule_id, member_id, status, created_at: `2026-09-2${n}T08:00:00Z`, profile: { username, avatar_url: null } };
}
const SCHEDULES = [
  slot('s-booked', '12:00', '13:00', 'WOD', { coach: 'Julie' }),
  slot('s-free', '18:00', '19:00', 'CrossFit', { description: 'Fran + skill de gymnastique' }),
  slot('s-full', '19:00', '20:00', 'Hyrox'),
  slot('s-wait', '20:00', '21:00', LONG, { coach: LONG_COACH }),
];
const RESERVATIONS = [
  res('s-booked', 'me', 'confirmed', 1, 'moi'),
  res('s-booked', 'u2', 'confirmed', 2, 'Léa'),
  res('s-free', 'u2', 'confirmed', 1, 'Léa'),
  res('s-full', 'u2', 'confirmed', 1, 'Léa'), res('s-full', 'u3', 'confirmed', 2, 'Sam'), res('s-full', 'u4', 'confirmed', 3, 'Tom'),
  res('s-full', 'u5', 'waiting', 4, 'Max'),
  res('s-wait', 'u2', 'confirmed', 1, 'Léa'), res('s-wait', 'u3', 'confirmed', 2, 'Sam'), res('s-wait', 'u4', 'confirmed', 3, 'Tom'),
  res('s-wait', 'u5', 'waiting', 4, 'Max'), res('s-wait', 'me', 'waiting', 5, 'moi'),
];
const MY_RESERVATIONS = [
  { id: 'r1', schedule_id: 's-booked', status: 'confirmed', created_at: '2026-09-25T08:00:00Z', member_id: 'me', box_id: 'box-1',
    schedule: { title: 'WOD', scheduled_date: '2026-09-29', start_time: '18:00', end_time: '19:00', coach: 'Julie' } },
  { id: 'r2', schedule_id: 's-wait', status: 'waiting', created_at: '2026-09-25T09:00:00Z', member_id: 'me', box_id: 'box-1',
    schedule: { title: LONG, scheduled_date: '2026-09-30', start_time: '07:00', end_time: '08:00', coach: LONG_COACH } },
  { id: 'r3', schedule_id: 's-old', status: 'confirmed', created_at: '2026-09-20T08:00:00Z', member_id: 'me', box_id: 'box-1',
    schedule: { title: 'Hyrox', scheduled_date: '2026-09-21', start_time: '19:00', end_time: '20:00', coach: null } },
];

// Premier montage lent sur les runners CI (chargement à froid de RN et des écrans).
jest.setTimeout(30000);

let renderer: TestRenderer.ReactTestRenderer | null = null;
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  mockTables.class_schedules = SCHEDULES;
  mockTables.class_reservations = RESERVATIONS;
  mockMemberships = [];
  mockInsertStatus = 'confirmed';
  mockInsertError = null;
  mockPlanStatus = null;
  mockAuth.currentBox = { id: 'box-1', name: 'CrossFit Lumière', slug: 'crossfit-lumiere' };
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  jest.clearAllMocks();
  jest.restoreAllMocks();
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
const inModal = (n: ReactTestInstance) => {
  for (let p: ReactTestInstance | null = n.parent; p; p = p.parent) if (p.type === Modal) return p;
  return null;
};
async function settle() {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
/** Appuie sur l'élément appuyable le plus proche qui contient ce texte (hors fenêtre si modal=false). */
async function pressText(root: ReactTestInstance, text: string, modal = false) {
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text && (inModal(n) != null) === modal)[0];
  if (!t) throw new Error(`texte absent : ${text}`);
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress(); });
  await settle();
}
async function mount(el: React.ReactElement, theme = lightTheme) {
  mockTheme = theme;
  let r: TestRenderer.ReactTestRenderer | null = null;
  await act(async () => { r = TestRenderer.create(el); renderer = r; });
  await settle();
  return r!.root;
}

type Variant = { name: string; run: (theme?: typeof lightTheme) => Promise<ReactTestInstance> };
const VARIANTS: Variant[] = [
  { name: 'réservation', run: (th) => mount(<ReservationScreen />, th) },
  { name: 'réservation-suspendue-paiement', run: (th) => {
    mockMemberships = [{ box_id: 'box-1', suspended: true, has_stripe_subscription: true }];
    return mount(<ReservationScreen />, th);
  } },
  { name: 'réservation-suspendue-contact', run: (th) => {
    mockMemberships = [{ box_id: 'box-1', suspended: true, has_stripe_subscription: false }];
    return mount(<ReservationScreen />, th);
  } },
  { name: 'réservation-jour-vide', run: async (th) => {
    const root = await mount(<ReservationScreen />, th);
    await pressText(root, 'MAR');
    return root;
  } },
  { name: 'réservation-sans-box', run: (th) => {
    mockAuth.currentBox = null;
    return mount(<ReservationScreen />, th);
  } },
  { name: 'créneau', run: async (th) => {
    const root = await mount(<ReservationScreen />, th);
    await pressText(root, 'CrossFit');
    return root;
  } },
  { name: 'créneau-réservé', run: async (th) => {
    const root = await mount(<ReservationScreen />, th);
    await pressText(root, 'WOD');
    return root;
  } },
  { name: 'créneau-en-attente', run: async (th) => {
    const root = await mount(<ReservationScreen />, th);
    await pressText(root, LONG);
    return root;
  } },
  { name: 'mes-réservations', run: (th) => {
    mockTables.class_reservations = MY_RESERVATIONS;
    return mount(<MyReservationsScreen />, th);
  } },
  { name: 'mes-réservations-passées', run: async (th) => {
    mockTables.class_reservations = MY_RESERVATIONS;
    const root = await mount(<MyReservationsScreen />, th);
    await pressText(root, 'Passées (1)');
    return root;
  } },
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
/** Casse et emoji mis à part : les libellés passent en capitales, les emoji deviennent des icônes Lucide. */
const normalize = (xs: string[]) => xs.map((x) => x.replace(EMOJI, '').trim().toUpperCase()).filter((x) => x.length > 0);

describe('R10 : ordre des blocs et libellés inchangés (instantané pris sur master)', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const root = await v.run();
    const current = structure(root);
    if (process.env.R10_CAPTURE) {
      const file = process.env.R10_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(normalize(current)).toEqual(normalize(before));
  });
});

// ── Apparence, callbacks et textes longs ─────────────────────────────────────

const THEMES = [lightTheme, darkTheme];
const SRC = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const byId = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type !== 'string')[0];
const hostOf = (n: ReactTestInstance, type: string) => n.findAll((x) => String(x.type) === type)[0];
const typeName = (n: ReactTestInstance) => (typeof n.type === 'string' ? n.type : (n.type as { name?: string }).name ?? '');
const comp = (root: ReactTestInstance, name: string) => root.findAll((n) => typeName(n) === name);
const textNode = (root: ReactTestInstance, text: string) => root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
const DIALOG_STYLE: Record<string, string> = { accent: 'default', outline: 'cancel', stop: 'destructive' };
const alertButtons = (root: ReactTestInstance) => root.findByProps({ testID: 'confirm-dialog' })
  .findAll((n) => typeName(n) === 'AxButton')
  .map((b) => ({ text: b.props.label as string, style: DIALOG_STYLE[b.props.variant as string], onPress: b.props.onPress as () => unknown }));

function lum(hex: string) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function mix(fg: string, bg: string, alpha: number) {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map((i) => Math.round(ch(fg, i) * alpha + ch(bg, i) * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}

describe('R10 : Réservation au nouveau design', () => {
  for (const th of THEMES) {
    const c = th.ax;
    it(`${th.mode} : sélecteur de jours en AxDayItem, aujourd'hui sélectionné et en accentText ailleurs`, async () => {
      const root = await mount(<ReservationScreen />, th);
      const days = comp(root, 'AxDayItem');
      expect(days.map((d) => d.props.dayLabel)).toEqual(['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']);
      expect(days.map((d) => d.props.selected)).toEqual([true, false, false, false, false, false, false]);
      expect(days[0].props.today).toBe(true);
      await pressText(root, 'MAR');
      const after = comp(root, 'AxDayItem');
      expect(after[1].props.selected).toBe(true);
      const todayTexts = after[0].findAll(isHostText).map((n) => flat(n).color);
      expect(todayTexts).toEqual([c.accentText, c.accentText]);
    });

    it(`${th.mode} : créneaux en AxCard, heure numberM Oswald, discipline en AxTag, coach et places en caption`, async () => {
      const root = await mount(<ReservationScreen />, th);
      const cards = comp(root, 'AxCard');
      expect(cards.map((k) => k.props.testID)).toEqual(['r10-slot-s-booked', 'r10-slot-s-free', 'r10-slot-s-full', 'r10-slot-s-wait']);
      expect(cards[0].props.variant).toBe('featured');
      expect(cards.slice(1).map((k) => k.props.variant)).toEqual(['standard', 'standard', 'standard']);
      expect(flat(hostOf(cards[3], 'View'))).toMatchObject({ borderColor: c.warning });
      expect(flat(textNode(root, '18:00 – 19:00'))).toMatchObject({ fontFamily: 'Oswald_500Medium', fontSize: 24, lineHeight: 28, color: c.text });
      const tags = comp(root, 'AxTag');
      expect(tags.map((g) => g.props.label)).toEqual(['WOD', 'CrossFit', 'Hyrox', LONG]);
      for (const text of ['Julie', 'Fran + skill de gymnastique', '1/3']) {
        expect(flat(textNode(root, text))).toMatchObject({ fontSize: 12, lineHeight: 16, color: c.textMuted });
      }
      expect(flat(textNode(root, '2 places dispo'))).toMatchObject({ fontSize: 12, color: c.accentText });
      expect(flat(textNode(root, '3/3'))).toMatchObject({ color: c.danger });
      expect(flat(textNode(root, "#2 en liste d'attente"))).toMatchObject({ color: c.warning });
    });

    it(`${th.mode} : Réservé / Attente #n / Complet en AxStatusDot, Réserver accent, File d'attente en contour`, async () => {
      const root = await mount(<ReservationScreen />, th);
      const dots = comp(root, 'AxStatusDot').map((d) => [d.props.label, d.props.tone]);
      expect(dots).toEqual([['Réservé', 'active'], ['Complet · 1 en attente', 'danger'], ['Attente #2', 'warning']]);
      const buttons = comp(root, 'AxButton').map((b) => [b.props.label, b.props.variant]);
      expect(buttons).toEqual([['Mes réservations', 'outline'], ['Réserver', 'accent'], ["File d'attente", 'outline']]);
      const booked = textNode(root, 'RÉSERVÉ') ?? textNode(root, 'Réservé');
      expect(flat(booked)).toMatchObject({ color: c.accentText, textTransform: 'uppercase' });
      expect(flat(textNode(root, 'Attente #2'))).toMatchObject({ color: c.warning });
      expect(flat(textNode(root, 'Complet · 1 en attente'))).toMatchObject({ color: c.danger });
    });

    it(`${th.mode} : fenêtre du créneau, Réserver ce créneau accent, Se désinscrire / Quitter en stop`, async () => {
      let root = await mount(<ReservationScreen />, th);
      await pressText(root, 'CrossFit');
      expect(comp(root, 'AxButton').filter((b) => inModal(b)).map((b) => [b.props.label, b.props.variant]))
        .toEqual([['Réserver ce créneau', 'accent']]);
      await act(async () => renderer!.unmount()); renderer = null;
      root = await mount(<ReservationScreen />, th);
      await pressText(root, 'WOD');
      expect(comp(root, 'AxButton').filter((b) => inModal(b)).map((b) => [b.props.label, b.props.variant]))
        .toEqual([['Se désinscrire', 'stop']]);
      await act(async () => renderer!.unmount()); renderer = null;
      root = await mount(<ReservationScreen />, th);
      await pressText(root, LONG);
      expect(comp(root, 'AxButton').filter((b) => inModal(b)).map((b) => [b.props.label, b.props.variant]))
        .toEqual([["Quitter la file d'attente", 'stop']]);
      const sheet = root.findAll((n) => isHostText(n) && inModal(n) != null && hostText(n) === LONG)[0];
      expect(sheet.props.numberOfLines).toBe(2);
    });

    it(`${th.mode} : bandeau Abonnement suspendu en ton warning, AxButton accent vers la page compte`, async () => {
      mockMemberships = [{ box_id: 'box-1', suspended: true, has_stripe_subscription: true }];
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      const root = await mount(<ReservationScreen />, th);
      const banner = byId(root, 'r10-suspended');
      expect(flat(banner)).toMatchObject({ borderColor: c.warning });
      expect(flat(textNode(root, 'Abonnement suspendu'))).toMatchObject({ color: c.warning });
      const cta = comp(root, 'AxButton').find((b) => b.props.testID === 'r10-suspended-cta')!;
      expect([cta.props.label, cta.props.variant]).toEqual(['Mettre à jour mon paiement', 'accent']);
      await act(async () => { cta.props.onPress(); });
      expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/compte$/));
      const tint = mix(c.warning, c.background, 0.12);
      expect(contrast(c.warning, tint)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.text, tint)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('sans Stripe : bandeau sans bouton de paiement', async () => {
    mockMemberships = [{ box_id: 'box-1', suspended: true, has_stripe_subscription: false }];
    const root = await mount(<ReservationScreen />);
    expect(comp(root, 'AxButton').map((b) => b.props.testID)).not.toContain('r10-suspended-cta');
  });

  it('navigation : Mes réservations ouvre MyReservations', async () => {
    const root = await mount(<ReservationScreen />);
    await pressText(root, 'Mes réservations');
    expect(mockNavigate).toHaveBeenCalledWith('MyReservations');
  });

  it('callbacks : Réserver passe par les deux limites puis insère « confirmed » et programme le rappel', async () => {
    const root = await mount(<ReservationScreen />);
    mockCalls.length = 0;
    await pressText(root, 'Réserver');
    expect(mockCalls.filter((x) => x.table === 'rpc').map((x) => x.method)).toEqual(['check_weekly_limit', 'check_daily_limit']);
    const ins = mockCalls.find((x) => x.method === 'insert')!;
    expect(ins.args[0]).toEqual({ schedule_id: 's-free', member_id: 'me', box_id: 'box-1', status: 'confirmed' });
    expect(mockSchedule).toHaveBeenCalledWith('s-free', 'CrossFit', TODAY, '18:00');
  });

  it("callbacks : File d'attente demande confirmation puis insère « waiting »", async () => {
    const root = await mount(<ReservationScreen />);
    await pressText(root, "File d'attente");
    const join = alertButtons(root).find((b) => b.text === "Rejoindre la file")
      ?? alertButtons(root)[1];
    mockCalls.length = 0;
    await act(async () => { await join.onPress!(); });
    await settle();
    expect(mockCalls.find((x) => x.method === 'insert')!.args[0]).toMatchObject({ schedule_id: 's-full', status: 'waiting' });
  });

  it('callbacks : Réservé puis Oui supprime la réservation et annule le rappel', async () => {
    const root = await mount(<ReservationScreen />);
    await pressText(root, 'Réservé');
    const yes = alertButtons(root).find((b) => b.style === 'destructive')!;
    mockCalls.length = 0;
    await act(async () => { await yes.onPress!(); });
    await settle();
    expect(mockCalls.some((x) => x.method === 'delete')).toBe(true);
    expect(mockCalls.filter((x) => x.method === 'eq').slice(0, 2).map((x) => x.args)).toEqual([['schedule_id', 's-booked'], ['member_id', 'me']]);
    expect(mockCancel).toHaveBeenCalledWith('s-booked');
  });

  it('callbacks : la flèche suivante s’arrête à la limite de 14 jours et grise les jours au-delà', async () => {
    const root = await mount(<ReservationScreen />);
    const next = () => byId(root, 'r10-week-next');
    await act(async () => { next().props.onPress(); }); await settle();
    await act(async () => { next().props.onPress(); }); await settle();
    const days = comp(root, 'AxDayItem');
    expect(days.map((d) => d.props.disabled)).toEqual([false, true, true, true, true, true, true]);
    expect(next().props.disabled).toBe(true);
    await act(async () => { next().props.onPress(); }); await settle();
    expect(comp(root, 'AxDayItem')[0].props.testID).toBe('r10-day-2026-10-12');
  });

  it('textes longs : discipline sur 2 lignes bornée à la largeur, coach sur 1 ligne, colonne gauche rétrécissable', async () => {
    const root = await mount(<ReservationScreen />);
    const tag = comp(root, 'AxTag').find((g) => g.props.label === LONG)!;
    expect(tag.props.numberOfLines).toBe(2);
    const tagText = tag.findAll(isHostText)[0];
    expect(tagText.props.numberOfLines).toBe(2);
    expect(flat(tagText)).toMatchObject({ flexShrink: 1 });
    expect(flat(hostOf(tag, 'View'))).toMatchObject({ maxWidth: '100%' });
    const coach = textNode(root, LONG_COACH);
    expect(coach.props.numberOfLines).toBe(1);
    expect(flat(coach)).toMatchObject({ flexShrink: 1 });
    let left: ReactTestInstance | null = coach.parent;
    while (left && flat(left).flex !== 1) left = left.parent;
    expect(flat(left!)).toMatchObject({ flex: 1, minWidth: 0 });
    const card = byId(root, 'r10-slot-s-wait');
    const right = card.findAll((n) => String(n.type) === 'View' && flat(n).maxWidth === '45%');
    expect(right).toHaveLength(1);
    expect(flat(right[0])).toMatchObject({ flexShrink: 0 });
  });
});

// Lot 4 « Rejoindre une box en payant » : bandeau « Formule à activer » et bouton du refus NO_ACTIVE_PLAN.
const SANS_FORMULE = { is_staff: false, has_plan: false, suspended: false, credits_left: 0, pays_online: true };
const NO_PLAN_ERROR = { code: '23514', message: 'NO_ACTIVE_PLAN: aucune formule active dans cette box — rapproche-toi de ta box pour activer ton abonnement.' };

describe('Lot 4 : Réservation sans formule', () => {
  for (const th of THEMES) {
    const c = th.ax;
    it(`${th.mode} : bandeau en tête, au-dessus de Mes réservations, ton warning, bouton vers la page de la box`, async () => {
      mockPlanStatus = SANS_FORMULE;
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      const root = await mount(<ReservationScreen />, th);
      const s = structure(root);
      expect(s.indexOf('FORMULE À ACTIVER')).toBeGreaterThan(s.indexOf('CrossFit Lumière'));
      expect(s.indexOf('FORMULE À ACTIVER')).toBeLessThan(s.indexOf('Mes réservations'));
      expect(s).toContain('Tu as rejoint CrossFit Lumière. Pour réserver tes cours, active une formule de ta box.');
      expect(s).toContain('Tu paies au comptoir ? Rapproche-toi de ta box.');
      const card = root.findAll((n) => n.props.testID === 'r10-plan' && String(n.type) === 'View')[0];
      expect(flat(card)).toMatchObject({ borderColor: c.warning, backgroundColor: c.surface });
      expect(flat(textNode(root, 'Formule à activer'))).toMatchObject({ color: c.warning });
      expect(contrast(c.warning, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.textMuted, c.surface)).toBeGreaterThanOrEqual(4.5);
      const cta = comp(root, 'AxButton').find((b) => b.props.testID === 'r10-plan-cta')!;
      expect([cta.props.label, cta.props.variant ?? 'accent']).toEqual(['Activer mon abonnement', 'accent']);
      await act(async () => { cta.props.onPress(); });
      expect(open).toHaveBeenCalledWith('https://athlexapp.eu/box/crossfit-lumiere');
    });
  }

  it('box sans formule en ligne : bandeau sans bouton, seul « Tu paies au comptoir ? » reste', async () => {
    mockPlanStatus = { ...SANS_FORMULE, pays_online: false };
    const root = await mount(<ReservationScreen />);
    expect(byId(root, 'r10-plan')).toBeDefined();
    expect(comp(root, 'AxButton').map((b) => b.props.testID)).not.toContain('r10-plan-cta');
    expect(structure(root)).toContain('Tu paies au comptoir ? Rapproche-toi de ta box.');
  });

  it('suspendu : seul le bandeau « Abonnement suspendu », jamais les deux', async () => {
    mockMemberships = [{ box_id: 'box-1', suspended: true, has_stripe_subscription: true }];
    mockPlanStatus = { ...SANS_FORMULE, suspended: true };
    const root = await mount(<ReservationScreen />);
    expect(byId(root, 'r10-suspended')).toBeDefined();
    expect(byId(root, 'r10-plan')).toBeUndefined();
  });

  it('formule active, staff ou état inconnu : aucun bandeau', async () => {
    for (const st of [{ ...SANS_FORMULE, has_plan: true }, { ...SANS_FORMULE, is_staff: true }, null]) {
      mockPlanStatus = st;
      const root = await mount(<ReservationScreen />);
      expect([st, byId(root, 'r10-plan')]).toEqual([st, undefined]);
      const r = renderer!; await act(async () => r.unmount()); renderer = null;
    }
  });

  it('refus NO_ACTIVE_PLAN : textes conservés, icône carte, « Activer mon abonnement » ouvre la page de la box, « Fermer » en contour', async () => {
    mockPlanStatus = SANS_FORMULE;
    mockInsertError = NO_PLAN_ERROR;
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await mount(<ReservationScreen />);
    await pressText(root, 'Réserver');
    const dialog = root.findByProps({ testID: 'confirm-dialog' });
    const texts: string[] = []; textsOf(dialog, texts);
    expect(texts).toEqual([
      'PAS DE FORMULE ACTIVE',
      "Tu n'as pas de formule active dans cette box. Rapproche-toi de ta box pour activer ton abonnement.",
      'Activer mon abonnement', 'Fermer',
    ]);
    expect(dialog.findAll((n) => n.props.testID === 'confirm-dialog-icon').length).toBeGreaterThan(0);
    expect(alertButtons(root).map((b) => [b.text, b.style])).toEqual([['Activer mon abonnement', 'default'], ['Fermer', 'cancel']]);
    await pressText(root, 'Activer mon abonnement', true);
    expect(open).toHaveBeenCalledWith('https://athlexapp.eu/box/crossfit-lumiere');
  });

  it('refus NO_ACTIVE_PLAN, box sans formule en ligne : « Fermer » seul', async () => {
    mockPlanStatus = { ...SANS_FORMULE, pays_online: false };
    mockInsertError = NO_PLAN_ERROR;
    const root = await mount(<ReservationScreen />);
    await pressText(root, 'Réserver');
    expect(alertButtons(root).map((b) => [b.text, b.style])).toEqual([['Fermer', 'cancel']]);
  });

  it('autre refus (impayé) : fenêtre inchangée, sans bouton vers le site', async () => {
    mockPlanStatus = SANS_FORMULE;
    mockInsertError = { code: '23514', message: 'MEMBERSHIP_PAST_DUE: abonnement impayé' };
    const root = await mount(<ReservationScreen />);
    await pressText(root, 'Réserver');
    expect(alertButtons(root).map((b) => [b.text, b.style])).toEqual([['OK', 'default']]);
  });
});

describe('R10 : Mes réservations au nouveau design', () => {
  for (const th of THEMES) {
    const c = th.ax;
    it(`${th.mode} : onglets en AxChip, cartes AxCard, statut en AxStatusDot, heure numberM, Annuler en stop`, async () => {
      mockTables.class_reservations = MY_RESERVATIONS;
      const root = await mount(<MyReservationsScreen />, th);
      expect(comp(root, 'AxScreenHeader')).toHaveLength(1);
      expect(comp(root, 'AxChip').map((x) => [x.props.label, x.props.selected])).toEqual([['En cours (2)', true], ['Passées (1)', false]]);
      expect(comp(root, 'AxCard').map((k) => k.props.testID)).toEqual(['r10-res-r1', 'r10-res-r2']);
      expect(comp(root, 'AxStatusDot').map((d) => [d.props.label, d.props.tone])).toEqual([['Confirmé', 'active'], ['Attente', 'warning']]);
      expect(comp(root, 'AxButton').map((b) => [b.props.label, b.props.variant])).toEqual([['Annuler', 'stop'], ['Annuler', 'stop']]);
      expect(flat(textNode(root, '18:00 – 19:00'))).toMatchObject({ fontFamily: 'Oswald_500Medium', fontSize: 24, color: c.text });
      expect(flat(textNode(root, 'Coach : Julie'))).toMatchObject({ fontSize: 12, color: c.textMuted });
      expect(flat(textNode(root, 'WOD'))).toMatchObject({ fontSize: 14, color: c.text });
      await pressText(root, 'Passées (1)');
      expect(comp(root, 'AxChip').map((x) => x.props.selected)).toEqual([false, true]);
      expect(flat(comp(root, 'AxCard')[0].findAll((n) => typeof n.type === 'string' && String(n.type) === 'View')[0])).toMatchObject({ opacity: 0.55 });
    });
  }

  it('callbacks : Annuler → Oui supprime par id et annule le rappel', async () => {
    mockTables.class_reservations = MY_RESERVATIONS;
    const root = await mount(<MyReservationsScreen />);
    const cancel = comp(root, 'AxButton')[0];
    await act(async () => { cancel.props.onPress(); });
    const yes = alertButtons(root).find((b) => b.style === 'destructive')!;
    mockCalls.length = 0;
    await act(async () => { await yes.onPress!(); });
    await settle();
    expect(mockCalls.some((x) => x.method === 'delete')).toBe(true);
    expect(mockCalls.find((x) => x.method === 'eq')!.args).toEqual(['id', 'r1']);
    expect(mockCancel).toHaveBeenCalledWith('s-booked');
  });

  it('textes longs : titre sur 2 lignes rétrécissable, coach sur 1 ligne', async () => {
    mockTables.class_reservations = MY_RESERVATIONS;
    const root = await mount(<MyReservationsScreen />);
    const title = textNode(root, LONG);
    expect(title.props.numberOfLines).toBe(2);
    expect(flat(title)).toMatchObject({ flex: 1, minWidth: 0 });
    const coach = textNode(root, `Coach : ${LONG_COACH}`);
    expect(coach.props.numberOfLines).toBe(1);
    expect(flat(coach)).toMatchObject({ flexShrink: 1 });
  });
});

describe('R10 : garde-fous', () => {
  it('contraste AA des encres utilisées sur les cartes et le fond, dans les deux thèmes', () => {
    for (const th of THEMES) {
      const c = th.ax;
      for (const bg of [c.surface, c.background]) {
        for (const ink of [c.text, c.textMuted, c.accentText, c.warning, c.danger]) {
          expect([th.mode, ink, bg, contrast(ink, bg) >= 4.5]).toEqual([th.mode, ink, bg, true]);
        }
      }
    }
  });

  it('aucun emoji ni couleur codée en dur dans les écrans du lot', () => {
    for (const rel of ['screens/reservation/ReservationScreen.tsx', 'screens/reservation/ReservationWeekPicker.tsx', 'screens/reservation/MyReservationsScreen.tsx']) {
      const src = read(rel);
      expect(src.match(EMOJI)).toBeNull();
      expect(src.match(/['"`]#[0-9a-fA-F]{3,8}['"`]|rgba\(/g)).toBeNull();
      expect(src).not.toMatch(/TouchableOpacity|EmeraldCTAButton|WeekDayPicker/);
    }
  });

  it('règles de réservation inchangées : logique figée par empreinte (relevée sur master)', () => {
    const fp = (src: string, a: string, b: string) => {
      const i = src.indexOf(a); const j = src.indexOf(b, i);
      expect([a, i >= 0 && j >= 0]).toEqual([a, true]);
      return require('crypto').createHash('sha256').update(src.slice(i, j + b.length).replace(/dialog\.show\(/g, 'Alert.alert(').replace(/dialog\.afterModalClose\(\); /g, '').replace(/\s+/g, ' ')).digest('hex').slice(0, 16);
    };
    const r = read('screens/reservation/ReservationScreen.tsx');
    const m = read('screens/reservation/MyReservationsScreen.tsx');
    expect([
      fp(r, '  const [schedules', '  const todayISO'),
      fp(r, 'const REGISTER_CUTOFF_MIN', 'export default'),
      fp(m, '  const [reservations', 'function formatDate'),
      fp(m, 'const minsLeft = minutesUntilSlot(s.scheduled_date', 'await cancelClassReminder(item.schedule_id);'),
    // Première empreinte relevée de nouveau au lot 4 « Rejoindre une box en payant » : état de la
    // formule (usePlanStatuses) et boutons du refus NO_ACTIVE_PLAN ; le reste de la logique est inchangé.
    // Relevées de nouveau (PR erreurs et corrections) : messages d'erreur par errorMessage(), libellé du type
    // de cours (classTitleLabel) et pluriel du refus de limite hebdomadaire ; aucune règle modifiée.
    ]).toEqual(['4d3a4ff83b6353b2', '5479c602315099b6', '3d0c0e51770f9357', 'db89b14584f7f8cc']);
  });

  it('filtre de visibilité et fenêtre d’inscription inchangés dans le rendu', () => {
    const r = read('screens/reservation/ReservationScreen.tsx');
    expect(r).toContain('if (slotMs > horizonMs) return false;');
    expect(r).toContain('return minutesUntilSlot(s.scheduled_date, s.start_time) >= REGISTER_CUTOFF_MIN;');
    expect(r).toContain("onPress={() => Linking.openURL(`${WEB_URL}/compte`)}");
    expect(r).toMatch(/\{suspension\.stripe && \(\s*<AxButton/);
    const m = read('screens/reservation/MyReservationsScreen.tsx');
    expect(m).toContain('{!isPast && minutesUntilSlot(s.scheduled_date, s.start_time) >= CANCEL_CUTOFF_MIN && (');
  });
});
