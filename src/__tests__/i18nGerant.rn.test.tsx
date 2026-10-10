/**
 * Chantier anglais, groupe Gérant : écrans gérant et coach de l'app (horaires,
 * compétition inter-box, programmation, éditeur de programme, membres, éditeur
 * de WOD, bandeau d'essai, ouverture d'un lien), montés avec le vrai
 * react-native (données fictives, aucun réseau).
 * - FR : textes affichés, placeholders, libellés d'accessibilité, fenêtres et
 *   alertes identiques à l'instantané pris sur master avant la traduction
 *   (i18nGerantAvant.json ; I18N_GERANT_CAPTURE=<fichier> pour le reprendre).
 * - EN : aucun texte accentué, et aucun texte resté identique au français hors
 *   données fictives et libellés identiques par nature.
 */
import React, { useEffect as mockUseEffect } from 'react';
import { Alert, Linking, Modal, StyleSheet, View } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import BEFORE from './i18nGerantAvant.json';
import TrialBanner from '../components/TrialBanner';
import { openExternalUrl } from '../lib/openCheckout';
import BOScheduleScreen from '../screens/backoffice/BOScheduleScreen';
import BOInterCompetitionScreen from '../screens/backoffice/BOInterCompetitionScreen';
import PoolTab from '../screens/backoffice/inter-competition/PoolTab';
import SwissTab from '../screens/backoffice/inter-competition/SwissTab';
import BOProgrammingScreen from '../screens/backoffice/BOProgrammingScreen';
import BOProgramEditorScreen from '../screens/backoffice/BOProgramEditorScreen';
import BOMembersScreen from '../screens/backoffice/BOMembersScreen';
import BOWODsScreen from '../screens/backoffice/BOWODsScreen';
import { lightTheme } from '../theme/palette';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { strictAllowed } = require('../../scripts/i18n/scanner');

const mockState: Record<string, any> = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: () => () => {}, canGoBack: () => true }),
  useRoute: () => ({ params: undefined }),
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View: V } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: V };
});
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 92 }));
// Objets STABLES d'un rendu à l'autre : un `user` neuf relancerait les effets sans fin.
jest.mock('../context/AuthContext', () => {
  const mockAuth = {
    user: { id: 'me', username: 'Sam', role: 'box_owner', level: 'rx' },
    currentBox: { id: 'b1', name: 'Box Alpha', owner_id: 'me' },
    boxRole: 'owner',
  };
  return { useAuth: () => mockAuth };
});
jest.mock('../context/ThemeContext', () => {
  const { lightTheme: th } = jest.requireActual('../theme/palette');
  const mockValue = { theme: th, mode: 'light' };
  return { useTheme: () => mockValue };
});
jest.mock('../hooks/useFocusQuery', () => {
  const mockResult = { data: [], isLoading: false, isFetching: false, refetch: () => {} };
  return { useFocusQuery: () => mockResult };
});
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/logger', () => ({ log: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('../components/InteractiveTour', () => ({ __esModule: true, default: () => null, COACH_TOUR_STEPS: [], BO_TOUR_STEPS: [] }));
jest.mock('../services/notifications', () => ({ sendWodPublishedNotification: jest.fn(), sendBoxNotification: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ readAsStringAsync: jest.fn() }));
jest.mock('../services/programContent', () => ({
  ...jest.requireActual('../services/programContent'),
  listProgramWods: async () => mockState.programWods,
}));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const ops: Array<{ m: string; a: unknown[] }> = [];
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'or', 'order', 'limit', 'in', 'ilike', 'gt', 'gte', 'lt', 'lte', 'is', 'not', 'range', 'update', 'delete', 'insert', 'upsert']) {
      b[m] = (...a: unknown[]) => { ops.push({ m, a }); return b; };
    }
    const run = () => {
      if (mockState.failTable === table) return { data: null, error: { message: 'boom' }, count: 0 };
      if (ops.some((o) => ['update', 'delete', 'insert', 'upsert'].includes(o.m))) return { data: null, error: null, count: 0 };
      const rows = mockState.tables[table] ?? [];
      return { data: rows, error: null, count: Array.isArray(rows) ? rows.length : 0 };
    };
    const one = () => ({ then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
      const r = run();
      return Promise.resolve({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data }).then(res, rej);
    } });
    b.single = one;
    b.maybeSingle = one;
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej);
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: async (name: string) => ({ data: mockState.rpc[name] ?? [], error: null }),
      channel: () => { const ch: Record<string, unknown> = {}; ch.on = () => ch; ch.subscribe = () => ch; return ch; },
      removeChannel: jest.fn(),
      auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    },
  };
});

const NOW = new Date('2026-09-28T10:00:00Z'); // lundi
const TODAY = '2026-09-28';

// Données fictives neutres : aucun accent, aucun mot de la liste du scanner français.
function baseState() {
  for (const k of Object.keys(mockState)) delete mockState[k];
  mockState.failTable = null;
  mockState.programWods = [];
  mockState.tables = {
    class_schedules: [
      { id: 's1', box_id: 'b1', title: 'WOD', description: null, coach: 'Lea', scheduled_date: TODAY, start_time: '07:00', end_time: '08:00', max_capacity: 12, created_at: TODAY },
      { id: 's2', box_id: 'b1', title: 'Sunrise Run', description: null, coach: null, scheduled_date: '2026-09-29', start_time: '06:30', end_time: '07:15', max_capacity: 8, created_at: TODAY },
    ],
    class_reservations: [{ schedule_id: 's1', status: 'confirmed' }, { schedule_id: 's1', status: 'waiting' }],
    box_members: [{ member_id: 'c1', profiles: { username: 'Lea' } }],
    inter_competitions: [{ id: 'c1', title: 'Fall Throwdown', format: 'bracket', status: 'active', type: 'individual', team_size: 1, created_at: TODAY }],
    inter_competition_wods: [
      { id: 'w1', competition_id: 'c1', title: 'Event 1', description: '21-15-9', scoring_type: 'time', time_cap: 12, order_index: 1, revealed_at: null },
      { id: 'w2', competition_id: 'c1', title: 'Event 2', description: null, scoring_type: 'reps', time_cap: null, order_index: 2, revealed_at: '2099-10-02T16:30:00Z' },
      { id: 'w3', competition_id: 'c1', title: 'Event 3', description: null, scoring_type: 'weight', time_cap: null, order_index: 3, revealed_at: '2026-09-20T08:00:00Z' },
    ],
    inter_scores: [], inter_registrations: [], inter_bracket_matches: [], profiles: [],
    programs: [{ box_id: 'b1' }],
    box_programming_subscriptions: [],
  };
  mockState.rpc = {
    list_programming_catalog: [
      { programming_id: 'p1', publisher_box_id: 'b9', title: 'Engine Lab', description: 'Six weeks', discipline: 'haltero', level: 'advanced', days_per_week: 4, weeks_count: 6, billing: 'monthly', price_cents: 2900, currency: 'eur', publisher_box_name: 'Box Nine' },
      { programming_id: 'p2', publisher_box_id: 'b8', title: 'Run Club', description: null, discipline: 'endurance', level: null, days_per_week: null, weeks_count: 8, billing: 'free', price_cents: 0, currency: 'eur', publisher_box_name: 'Box Eight' },
      { programming_id: 'p3', publisher_box_id: 'b7', title: 'Mixed Bag', description: null, discipline: 'crossfit', level: 'beginner', days_per_week: 3, weeks_count: 4, billing: 'free', price_cents: 0, currency: 'eur', publisher_box_name: 'Box Seven' },
    ],
  };
}

jest.setTimeout(30000);
let renderer: TestRenderer.ReactTestRenderer | null = null;
let alerts: string[] = [];
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  baseState();
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    alerts.push(['ALERTE', title, message ?? '', ...(buttons ?? []).map((b) => b.text ?? '')].join(' | '));
  });
});
afterEach(async () => {
  if (renderer) { const r = renderer; renderer = null; await act(async () => r.unmount()); }
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
afterAll(async () => { await i18n.changeLanguage('fr'); });

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
/** Textes, placeholders et libellés d'accessibilité dans l'ordre de l'arbre ; fenêtres ouvertes, puis alertes. */
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
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
async function mount(el: React.ReactElement) {
  await act(async () => { renderer = TestRenderer.create(el); });
  await settle();
  return renderer!.root;
}
async function tap(n: ReactTestInstance) {
  await act(async () => { await n.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await tap(n);
}
/** Appuie sur le texte affiché (français ou anglais selon la langue du test). */
async function pressText(root: ReactTestInstance, texts: { fr: string; en: string }) {
  const text = i18n.language === 'en' ? texts.en : texts.fr;
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
  if (!t) throw new Error(`texte introuvable : ${text}`);
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  await tap(n);
}
async function typeIn(root: ReactTestInstance, placeholder: { fr: string; en: string }, value: string) {
  const p = i18n.language === 'en' ? placeholder.en : placeholder.fr;
  const input = root.findAll((n) => String(n.type) === 'TextInput' && n.props.placeholder === p)[0];
  if (!input) throw new Error(`champ introuvable : ${p}`);
  await act(async () => { input.props.onChangeText(value); });
}

const nav = { navigate: jest.fn(), goBack: jest.fn() };
const banner = (p: Partial<React.ComponentProps<typeof TrialBanner>>) => mount(
  <TrialBanner daysLeft={12} status="trialing" onUpgrade={jest.fn()} {...p} />,
);
const PROGRAMMER = { fr: 'Programmer', en: 'Schedule' };
const DATE_PH = { fr: 'AAAA-MM-JJ HH:mm', en: 'YYYY-MM-DD HH:mm' };
async function scheduleReveal(value: string) {
  const r = await mount(<BOInterCompetitionScreen navigation={nav} />);
  await pressText(r, PROGRAMMER);
  await typeIn(r, DATE_PH, value);
  await pressText(r, { fr: 'OK', en: 'OK' });
  return r;
}
const TAB_STYLES = StyleSheet.create({
  section: {}, emptyText: {}, roundTitle: {}, matchCard: {}, matchRow: {}, matchPlayer: {}, matchWinner: {},
  bracketEmpty: {}, generateBtn: {}, generateBtnText: {},
}) as never;

type Variant = { name: string; run: () => Promise<ReactTestInstance> };
const VARIANTS: Variant[] = [
  // ── Bandeau d'abonnement du tableau de bord ──
  { name: 'bandeau-actif', run: () => banner({ status: 'active' }) },
  { name: 'bandeau-impaye', run: () => banner({ status: 'past_due' }) },
  { name: 'bandeau-termine', run: () => banner({ status: 'expired', daysLeft: 0 }) },
  { name: 'bandeau-essai', run: () => banner({ daysLeft: 12 }) },
  { name: 'bandeau-essai-fondateur', run: () => banner({ daysLeft: 5, isEarlyAdopter: true }) },
  { name: 'bandeau-essai-urgent', run: () => banner({ daysLeft: 2 }) },
  // ── Lien externe impossible à ouvrir ──
  { name: 'lien-impossible', run: async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    await act(async () => { await openExternalUrl('https://pay.local'); });
    jest.spyOn(Linking, 'canOpenURL').mockRejectedValue(new Error('x'));
    await act(async () => { await openExternalUrl('https://pay.local'); });
    return mount(<View />);
  } },
  // ── Horaires ──
  { name: 'horaires', run: () => mount(<BOScheduleScreen navigation={nav} />) },
  { name: 'horaires-creer', run: async () => {
    const r = await mount(<BOScheduleScreen navigation={nav} />);
    const empty = r.findAll((n) => isHostText(n) && hostText(n) === i18n.t('bo.schedule.addSlot'))[0];
    let n: ReactTestInstance | null = empty;
    while (n && typeof n.props.onPress !== 'function') n = n.parent;
    await tap(n!);
    return r;
  } },
  { name: 'horaires-modifier-autre', run: async () => { const r = await mount(<BOScheduleScreen navigation={nav} />); await press(r, 'schedule-edit-s2'); return r; } },
  // ── Compétition inter-box ──
  { name: 'inter-wods', run: () => mount(<BOInterCompetitionScreen navigation={nav} />) },
  { name: 'inter-programmer', run: async () => { const r = await mount(<BOInterCompetitionScreen navigation={nav} />); await pressText(r, PROGRAMMER); return r; } },
  { name: 'inter-programmer-format', run: () => scheduleReveal('demain') },
  { name: 'inter-programmer-passe', run: () => scheduleReveal('2020-01-01 10:00') },
  { name: 'inter-poules', run: () => mount(
    <PoolTab
      poolGroups={[{ id: 'g1', competition_id: 'c1', group_name: 'A', group_index: 0, advance_count: 2 }]}
      poolMembers={[{ id: 'm1', group_id: 'g1', athlete_id: 'a1', points: 3, wins: 1, draws: 0, losses: 0, score_for: 10, score_against: 5, username: 'Lea' }]}
      poolMatches={[{ id: 'x1', group_id: 'g1', competition_id: 'c1', athlete1_id: 'a1', athlete2_id: 'a2', score1: null, score2: null, winner_id: null, status: 'pending', a1_username: 'Lea', a2_username: 'Kim' }]}
      registrationCount={4} theme={lightTheme} S={TAB_STYLES} onGeneratePool={jest.fn()} onResolveMatch={jest.fn()}
    />,
  ) },
  { name: 'inter-suisse', run: () => mount(
    <SwissTab
      swissRounds={[{ id: 'r1', competition_id: 'c1', round_number: 1, status: 'active', completed_at: null }]}
      swissPairings={[{ id: 'y1', round_id: 'r1', competition_id: 'c1', athlete1_id: 'a1', athlete2_id: 'a2', score1: null, score2: null, winner_id: null, status: 'pending', a1_username: 'Lea', a2_username: 'Kim' }]}
      swissStandings={[]} registrationCount={4} theme={lightTheme} S={TAB_STYLES} onGenerateRound={jest.fn()} onResolvePairing={jest.fn()}
    />,
  ) },
  // ── Programmation ──
  { name: 'programmation', run: () => mount(<BOProgrammingScreen navigation={nav} />) },
  // ── Éditeur de programme ──
  { name: 'programme-editeur', run: async () => {
    const r = await mount(<BOProgramEditorScreen navigation={nav} route={{ params: { programId: 'p1', programTitle: 'Engine Six', durationWeeks: 6, daysPerWeek: 4, progType: 'fixed' } }} />);
    const empty = r.findAll((n) => isHostText(n) && hostText(n) === i18n.t('bo.programEditor.addWod'))[0];
    let n: ReactTestInstance | null = empty;
    while (n && typeof n.props.onPress !== 'function') n = n.parent;
    await tap(n!);
    return r;
  } },
  // ── Membres : lecture refusée ──
  { name: 'membres-erreur', run: () => { mockState.failTable = 'box_members'; return mount(<BOMembersScreen navigation={nav} />); } },
  // ── Éditeur de WOD in-app ──
  { name: 'wod-editeur', run: async () => {
    const r = await mount(<BOWODsScreen navigation={nav} />);
    const empty = r.findAll((n) => isHostText(n) && hostText(n) === i18n.t('bo.wods.addWod'))[0];
    let n: ReactTestInstance | null = empty;
    while (n && typeof n.props.onPress !== 'function') n = n.parent;
    await tap(n!);
    return r;
  } },
];

/** Textes des données fictives (jamais traduits), ligne par ligne. */
function dataTexts(): Set<string> {
  const out = new Set<string>();
  (function walk(v: unknown) {
    if (typeof v === 'string') [v, ...v.split('\n')].forEach((l) => out.add(l.toLowerCase()));
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(mockState);
  // Catalogue de mouvements de l'éditeur de WOD : noms de mouvements, jamais traduits.
  const { MOVEMENT_CATALOG } = jest.requireActual('../utils/movementsCatalog');
  for (const m of MOVEMENT_CATALOG as { name: string }[]) out.add(m.name.toLowerCase());
  return out;
}
/** Libellés identiques dans les deux langues : termes techniques, noms propres, mentions imposées. */
const SAME_IN_EN = [
  /^(OK|WOD|WODs|Cardio|Open Gym|Strength|Mobility|Kids|Teens|Functional|Hybrid|Endurance|Box|Coach|Lea|vs|BYE|Tabata|Custom|Notes|Description)$/i,
  /^A\. Back Squat 5×5 @ 80%/, // exemple de séance de l'éditeur de programme, écrit en anglais technique
];
const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;

describe('Gérant, français : textes identiques à master', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const current = collect(await v.run());
    if (process.env.I18N_GERANT_CAPTURE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      const file = process.env.I18N_GERANT_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(current).toEqual(before);
  });
});

describe('Gérant, anglais : aucun texte français', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  afterAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const en = collect(await v.run());
    const DATA = dataTexts();
    const fr = (BEFORE as Record<string, string[]>)[name];
    const strip = (s: string) => s.replace(/^(placeholder|a11y): /, '').replace(/^ALERTE \| /, '');
    const same = (s: string) => SAME_IN_EN.some((re) => re.test(s));
    const isData = (s: string) => s.split(/\n|, | — | · | \| /).every((l) => !/\p{L}/u.test(l) || DATA.has(l.trim().toLowerCase()) || same(l.trim()));
    const shown = en.filter((s) => s !== '── fenêtre ──');
    const french = shown.filter((s) => ACCENT.test(strip(s)) && !isData(strip(s)));
    const frSet = new Set(fr.map((s) => s.toLowerCase()));
    const unchanged = shown.filter((s) => frSet.has(s.toLowerCase()) && /\p{L}{2,}/u.test(strip(s))
      && !isData(strip(s)) && !strictAllowed(strip(s)) && !same(strip(s)));
    expect({ name, french, unchanged }).toEqual({ name, french: [], unchanged: [] });
  });
});
