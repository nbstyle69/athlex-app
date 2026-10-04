/**
 * G3 (gymnastique) : grille en reps seules, « Ajouter une série », totaux,
 * séance validée (écran C), séance générée au poids du corps, et apparence
 * mesurée (390 px, défilement, zone sûre). Vrai react-native, données fictives.
 */
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StrengthSetGrid, { StrengthMyLoadsCard, StrengthRepsScoreStatus } from '../components/wod/StrengthSetGrid';
import MuscuSessionCard from '../screens/wod/MuscuSessionCard';
import WODDetailScreen from '../screens/whiteboard/WODDetailScreen';
import { initialPerformed } from '../services/muscuSession';
import type { MuscuWod } from '../../packages/wod-engine/src';
import type { PerformedExercise } from '../services/wodGenerator';

let mockRouteParams: Record<string, unknown> | undefined;
const mockTables: Record<string, unknown[]> = {};
let mockServer: unknown = null;

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true, setOptions: jest.fn() }),
    useRoute: () => ({ params: mockRouteParams }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(83),
}));
// iPhone à encoche : 34 points de zone sûre en bas.
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }), SafeAreaView: View };
});
const BOX = { id: 'box-1', name: 'Box fictive', owner_id: 'u9', logo_url: null, slug: 'box-fictive' };
const mockAuth = { user: { id: 'me', username: 'Moi', avatar_url: null }, currentBox: BOX, boxRole: 'member', joinBox: jest.fn() };
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').darkTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let sel = '';
    const b: Record<string, unknown> = {};
    const rows = () => (mockTables[`${table}|${sel}`] ?? mockTables[table] ?? []) as unknown[];
    for (const m of ['select', 'eq', 'gte', 'lte', 'gt', 'order', 'limit', 'in', 'or', 'is', 'contains', 'update', 'delete', 'insert', 'upsert']) {
      b[m] = (...args: unknown[]) => { if (m === 'select' && !sel) sel = String(args[0]); return b; };
    }
    const one = () => ({ then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows()[0] ?? null, error: null }).then(res) });
    b.single = one;
    b.maybeSingle = one;
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows(), count: rows().length, error: null }).then(res);
    return b;
  };
  const channel = () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; };
  return { supabase: { from: (t: string) => builder(t), channel, removeChannel: jest.fn(), rpc: jest.fn(async () => ({ data: null, error: null })) } };
});
jest.mock('../services/myProfile', () => ({
  fetchMyPersonalRecords: jest.fn(async () => ({ 'gymnastics_Ring Muscle-up': '20' })),
  fetchMyProfile: jest.fn(async () => ({ personal_records: {} })),
}));
jest.mock('../services/membership', () => ({ ...jest.requireActual('../services/membership'), getMyPlanStatus: async () => null }));
jest.mock('../lib/analytics', () => ({ trackScoreSubmit: jest.fn() }));
jest.mock('../services/notifications', () => ({
  sendScoreNotification: jest.fn(async () => {}), sendScoreOvertakenNotification: jest.fn(async () => {}), cancelTodayScoreReminder: jest.fn(async () => {}),
}));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}), logMovementReps: jest.fn(async () => {}), recordActivity: jest.fn(async () => {}) }));
jest.mock('../services/eloCompute', () => ({ computeAndSaveElo: jest.fn(async () => {}), sortScoresRxFirst: (s: unknown[]) => s }));
jest.mock('../services/strengthPR', () => ({ recordStrengthPRs: jest.fn(async () => []) }));
jest.mock('../utils/eloLevels', () => ({ syncLevelAndBadges: jest.fn(async () => []) }));
jest.mock('../services/strengthSets', () => {
  const actual = jest.requireActual('../services/strengthSets');
  return {
    ...actual,
    loadStrengthGrid: jest.fn(async (_k: unknown, prescription: never[]) => {
      const server = mockServer as { sets: never[] } | null;
      return server
        ? { drafts: actual.gridFromServer(prescription, server.sets), origin: 'server', server, pending: null, offline: false }
        : { drafts: prescription, origin: 'prescription', server: null, pending: null, offline: false };
    }),
    saveStrengthDraft: jest.fn(async () => ({ status: 'saved', updatedAt: '2026-10-04T10:00:00Z' })),
    submitStrengthValidation: jest.fn(),
    fetchStrengthSession: jest.fn(async () => mockServer ?? { session: null, sets: [] }),
  };
});
jest.mock('../components/wod/TimerLaunchModal', () => () => null);
jest.mock('../components/ReportMenu', () => () => null);
jest.mock('../components/ShareScoreCard', () => () => null);
jest.mock('react-native-webview', () => 'WebView');
jest.mock('react-native-view-shot', () => 'ViewShot');
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn(async () => true) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

import {
  StrengthSetDraft, addStrengthSet, buildStrengthGrid, removeStrengthSet,
} from '../services/strengthSets';
import { parseStrengthLine } from '../utils/strengthBlock';

const TODAY = '2026-10-04';
const LINES = ['Ring Muscle-up — 3 × 15 % du max', 'Toes to Bar — 2 × 60 % du max', 'Back Squat — 2 × 5 @ 100 kg'];
const grid = (): StrengthSetDraft[] => buildStrengthGrid(LINES.map(l => parseStrengthLine(l)!), () => null, n => (n === 'Ring Muscle-up' ? 20 : null));

let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(`${TODAY}T10:00:00Z`),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockServer = null;
  mockRouteParams = undefined;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
  jest.clearAllMocks();
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
const hostText = (n: ReactTestInstance): string => n.children.map(ch => (typeof ch === 'string' ? ch : hostText(ch))).join('');
const texts = (root: ReactTestInstance) => root.findAll(isHostText).map(hostText);
const byID = (root: ReactTestInstance, id: string) => root.findAll(n => n.props.testID === id && typeof n.type === 'string')[0];
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
async function settle() {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}
async function press(root: ReactTestInstance, id: string) {
  let n: ReactTestInstance | null = byID(root, id);
  if (!n) throw new Error(`introuvable : ${id}`);
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  await act(async () => { n!.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
async function type(root: ReactTestInstance, id: string, v: string) {
  const t = root.findAll(n => n.props.testID === id && String(n.type) === 'TextInput')[0];
  await act(async () => { t.props.onChangeText(v); });
  await settle();
}

/** Grille seule, avec l'état que tient WODDetailScreen. */
function Banc({ initial }: { initial: StrengthSetDraft[] }) {
  const [drafts, setDrafts] = useState(initial);
  return (
    <StrengthSetGrid
      drafts={drafts}
      onChange={(i, patch) => setDrafts(prev => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)))}
      onAddSet={e => setDrafts(prev => addStrengthSet(prev, e))}
      onRemoveSet={i => setDrafts(prev => removeStrengthSet(prev, i))}
    />
  );
}
async function mountGrid() {
  await act(async () => { renderer = TestRenderer.create(<Banc initial={grid()} />); });
  await settle();
  return renderer.root;
}

describe('G3 : grille en reps seules', () => {
  it('pas de champ kg sur les lignes de gymnastique ; la ligne chargée garde le sien', async () => {
    const root = await mountGrid();
    expect([0, 1, 2, 3, 4].map(i => byID(root, `strength-kg-${i}-box`))).toEqual(Array(5).fill(undefined));
    expect(byID(root, 'strength-kg-5-box')).toBeTruthy();
    expect(byID(root, 'strength-kg-6-box')).toBeTruthy();
  });

  it('« Ajouter une série » sous chaque mouvement en reps seules, jamais sous une ligne chargée', async () => {
    const root = await mountGrid();
    expect(byID(root, 'strength-add-set-0')).toBeTruthy();
    expect(byID(root, 'strength-add-set-1')).toBeTruthy();
    expect(byID(root, 'strength-add-set-2')).toBeUndefined();
  });

  it('ajouter, saisir, retirer : la série ajoutée porte « ajoutée » et sa corbeille ; totaux à jour', async () => {
    const root = await mountGrid();
    expect(hostText(byID(root, 'strength-block-total-0'))).toBe('Total Ring Muscle-up9 reps');
    expect(hostText(byID(root, 'strength-total-reps-value'))).toBe('9 reps · calculées');
    await press(root, 'strength-add-set-0');
    expect(hostText(byID(root, 'strength-added-3'))).toBe('ajoutée');
    expect(byID(root, 'strength-remove-3')).toBeTruthy();
    await type(root, 'strength-reps-3', '1');
    expect(hostText(byID(root, 'strength-block-total-0'))).toBe('Total Ring Muscle-up10 reps');
    await type(root, 'strength-reps-4', '12');
    expect(hostText(byID(root, 'strength-block-total-1'))).toBe('Total Toes to Bar12 reps');
    expect(hostText(byID(root, 'strength-total-reps-value'))).toBe('22 reps · calculées');
    await press(root, 'strength-remove-3');
    expect(byID(root, 'strength-added-3')).toBeUndefined();
    expect(hostText(byID(root, 'strength-total-reps-value'))).toBe('21 reps · calculées');
  });

  it('les séries prescrites n’ont pas de corbeille', async () => {
    const root = await mountGrid();
    expect([0, 1, 2, 3, 4, 5, 6].map(i => byID(root, `strength-remove-${i}`))).toEqual(Array(7).fill(undefined));
  });

  it('écart en reps « 2 au lieu de 3 », « prévu 60 % du max » sans record', async () => {
    const root = await mountGrid();
    await type(root, 'strength-reps-2', '2');
    expect(texts(root)).toEqual(expect.arrayContaining(['2 au lieu de 3', 'prévu 3 reps', 'prévu 60 % du max']));
  });
});

describe('G3 : séance validée (écran C)', () => {
  const validated = (): StrengthSetDraft[] => {
    let d = addStrengthSet(grid(), 0);
    d = d.map((x, i) => (i === 2 ? { ...x, reps: '2' } : i === 3 ? { ...x, reps: '1' } : i === 4 ? { ...x, reps: '12' } : i === 5 ? { ...x, reps: '10' } : x));
    return d.slice(0, 6);
  };

  it('séries en reps, « ajoutée », totaux par mouvement, séparateur, « Reps totales »', async () => {
    await act(async () => { renderer = TestRenderer.create(<StrengthMyLoadsCard drafts={validated()} maxLoadKg={null} />); });
    const root = renderer.root;
    const t = texts(root);
    expect(t[0]).toBe('Mes séries');
    expect(t).toEqual(expect.arrayContaining([
      'Ring Muscle-up', 'Série 1', '3 reps', 'prévu 3', '2 au lieu de 3', '1 rep', 'ajoutée',
      'Total Ring Muscle-up', '9 reps', 'Toes to Bar', '12 reps', '10 reps', 'prévu 60 % du max',
      'Total Toes to Bar', '22 reps', 'Reps totales', '31 reps',
    ]));
    expect(byID(root, 'strength-my-loads-tonnage')).toBeUndefined();
    expect(hostText(byID(root, 'strength-my-loads-total-reps-value'))).toBe('31 reps');
  });

  it('séance mixte : tonnage et charge max gardés, reps totales en plus', async () => {
    const d = grid().map((x, i) => (i >= 5 ? { ...x, loadKg: '100' } : x));
    await act(async () => { renderer = TestRenderer.create(<StrengthMyLoadsCard drafts={d} maxLoadKg={100} />); });
    const root = renderer.root;
    expect(hostText(byID(root, 'strength-my-loads-tonnage'))).toBe('1000 kg');
    expect(hostText(byID(root, 'strength-my-loads-max'))).toBe('100 kg');
    expect(hostText(byID(root, 'strength-my-loads-total-reps-value'))).toBe('9 reps');
  });

  it('pastille « Validée le … » et « Score N reps »', async () => {
    await act(async () => { renderer = TestRenderer.create(<StrengthRepsScoreStatus validatedAt="2026-10-05T09:00:00Z" totalReps={31} />); });
    expect(texts(renderer.root)).toEqual(expect.arrayContaining(['Validée le 5 oct.', 'Score 31 reps']));
  });
});

describe('G3 : détail du WOD (saisie et séance validée)', () => {
  const WOD = {
    id: 'wG', box_id: 'box-1', title: 'Skill gym', wod_type: 'strength', block_name: 'strength', scheduled_date: TODAY,
    description: LINES.slice(0, 2).join('\n'), time_cap_seconds: null, video_url: null, notes: null, track: 'functional',
    is_published: true, sort_order: 0, leaderboard_enabled: true,
  };
  async function mountDetail(wod: Record<string, unknown> = WOD) {
    mockTables['box_wods|*'] = [wod];
    mockTables.wod_scores = [];
    mockRouteParams = { wodId: wod.id };
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
          <WODDetailScreen />
        </QueryClientProvider>,
      );
    });
    await settle();
    return renderer.root;
  }
  const ancestors = (n: ReactTestInstance) => { const out: ReactTestInstance[] = []; for (let p = n.parent; p; p = p.parent) out.push(p); return out; };

  it('gymnastique seule : pas de charge max, validation possible dès une série, reps totales', async () => {
    const root = await mountDetail();
    await press(root, 'enter-score');
    expect(byID(root, 'strength-max-load')).toBeUndefined();
    expect(byID(root, 'strength-total-reps')).toBeTruthy();
    const btn = root.findAll(n => n.props.testID === 'strength-validate' && typeof n.props.disabled === 'boolean')[0];
    expect(btn.props.disabled).toBe(false);
  });

  it('apparence : grille défilable, zone sûre en bas, aucun débordement à 390 px', async () => {
    const root = await mountDetail();
    await press(root, 'enter-score');
    await press(root, 'strength-add-set-0');
    const scroll = root.findAll(n => n.type === ScrollView && n.props.testID === 'score-modal-scroll')[0];
    expect(scroll).toBeTruthy();
    expect(ancestors(byID(root, 'strength-add-set-0')).includes(scroll)).toBe(true);
    expect(ancestors(byID(root, 'strength-validate')).includes(scroll)).toBe(true);
    const body = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(body.paddingBottom).toBeGreaterThanOrEqual(20 + 34);
    // Ligne la plus chargée (série ajoutée) : largeurs fixes + espaces ≤ 390 − marges.
    const row = byID(root, 'strength-remove-3').parent!.parent!;
    const rowStyle = flat(row);
    const fixed = row.children.filter((c): c is ReactTestInstance => typeof c !== 'string')
      .reduce((sum, c) => sum + (Number(flat(c).width) || 0), 0);
    const kids = row.children.length;
    expect(fixed + (kids - 1) * Number(rowStyle.gap ?? 0) + 16 + 40).toBeLessThanOrEqual(390 - 2 * Number(body.padding ?? 20));
    // Les textes longs (nom du mouvement, prescription) rétrécissent ou passent à la ligne.
    const total = byID(root, 'strength-block-total-0');
    expect(flat(total.children[0] as ReactTestInstance).flexShrink).toBe(1);
    const presc = root.findAll(n => isHostText(n) && hostText(n) === 'prévu 60 % du max')[0];
    expect(flat(presc).flexShrink).toBe(1);
    expect(presc.props.numberOfLines).toBe(1);
  });

  it('séance validée sans charge : pastille « Score N reps », « Modifier mes séries », pas de « Entrer mon score »', async () => {
    mockServer = {
      session: { status: 'validated', plannedSets: 5, maxLoadKg: null, totalReps: 21, firstValidatedAt: '2026-10-04T09:00:00Z', updatedAt: '2026-10-04T09:00:00Z' },
      sets: [
        { id: 's1', movement: 'Ring Muscle-up', movement_label: null, set_index: 1, reps: 3, load_kg: null, prescribed_reps: 3, prescribed_load_kg: null, is_added: false },
        { id: 's2', movement: 'Ring Muscle-up', movement_label: null, set_index: 4, reps: 6, load_kg: null, prescribed_reps: null, prescribed_load_kg: null, is_added: true },
        { id: 's3', movement: 'Toes to Bar', movement_label: null, set_index: 1, reps: 12, load_kg: null, prescribed_reps: null, prescribed_load_kg: null, is_added: false },
      ],
    };
    const root = await mountDetail();
    expect(texts(byID(root, 'strength-reps-score'))).toEqual(expect.arrayContaining(['Score 21 reps']));
    expect(byID(root, 'enter-score')).toBeUndefined();
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Modifier mes séries', 'Une modification recalcule ton score. Ton record ne change que si tu le confirmes.', 'ajoutée',
    ]));
    expect(root.findAllByType(Modal).some(m => m.props.visible)).toBe(false);
  });
});

describe('G3 : séance générée au poids du corps', () => {
  const WOD = {
    source: 'generator', discipline: 'musculation', title: 'Haut du corps', level: 'intermediaire',
    entry: 'express', target: 'haut', objective: 'force', equipment: 'box', budget_min: 30, score_type: 'tonnage',
    blocks: [{ exercises: [
      { id: 'pu', name: 'Strict Pull-Ups', sets: 2, reps: 8, reps_unit: 'reps', rest_s: 60, load: { mode: 'bodyweight' } },
      { id: 'ht', name: 'Hip Thrust', sets: 1, reps: 10, reps_unit: 'reps', rest_s: 60, load: { mode: 'weighted', kg: 60 } },
    ] }],
  } as unknown as MuscuWod;
  function Carte() {
    const [p, setP] = useState<PerformedExercise[]>(initialPerformed(WOD));
    return <MuscuSessionCard wod={WOD} accent="#9ae6d2" performed={p} onPerformedChange={setP} />;
  }

  it('reps seules, ajout et retrait, total du mouvement et reps totales', async () => {
    await act(async () => { renderer = TestRenderer.create(<Carte />); });
    const root = renderer.root;
    // Ouvre l'exercice (ses séries ne s'affichent que dépliées).
    const head = byID(root, 'muscu-exercise-0').findAll(n => typeof n.props.onPress === 'function')[0];
    await act(async () => { head.props.onPress(); });
    await settle();
    await press(root, 'muscu-add-set-0');
    expect(byID(root, 'muscu-kg-0-0-box')).toBeUndefined();
    expect(byID(root, 'muscu-kg-1-0-box')).toBeUndefined(); // Hip Thrust replié
    expect(byID(root, 'muscu-remove-0-2')).toBeTruthy();
    expect(byID(root, 'muscu-remove-0-0')).toBeUndefined();
    await type(root, 'muscu-reps-0-2', '5');
    expect(hostText(byID(root, 'muscu-block-total-0'))).toBe('Total Strict Pull-Ups21 reps');
    expect(hostText(byID(root, 'muscu-total-reps-value'))).toBe('21 reps');
    await press(root, 'muscu-remove-0-2');
    expect(byID(root, 'muscu-set-0-2')).toBeUndefined();
    expect(hostText(byID(root, 'muscu-total-reps-value'))).toBe('16 reps');
    expect(root.findAll(n => String(n.type) === 'TextInput' && n.props.testID === 'muscu-kg-0-0')).toHaveLength(0);
  });
});

describe('G3 bis : crédit à la première validation', () => {
  const base = {
    box_id: 'box-1', block_name: 'strength', wod_type: 'strength', scheduled_date: TODAY, time_cap_seconds: null, video_url: null,
    notes: null, track: 'functional', is_published: true, sort_order: 0, leaderboard_enabled: true,
  };
  const GYM = { ...base, id: 'wGym', title: 'Skill gym', description: 'Ring Muscle-up — 3 × 5' };
  const CHARGE = { ...base, id: 'wLoad', title: 'Force', description: 'Back Squat — 2 × 5 @ 100 kg' };
  async function valider(wod: Record<string, unknown>, maxLoadKg: number | null) {
    const { submitStrengthValidation } = jest.requireMock('../services/strengthSets');
    submitStrengthValidation.mockImplementation(async (_p: unknown, onFirst: (r: unknown) => Promise<void>) => {
      const res = { premiereValidation: true, maxLoadKg, totalReps: maxLoadKg == null ? 15 : null, seriesValides: 3, records: [] };
      await onFirst(res);
      return res;
    });
    mockTables['box_wods|*'] = [wod];
    mockTables.wod_scores = [];
    mockRouteParams = { wodId: wod.id };
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
          <WODDetailScreen />
        </QueryClientProvider>,
      );
    });
    await settle();
    const root = renderer.root;
    await press(root, 'enter-score');
    await press(root, 'strength-validate');
    const { incrementCounter, logMovementReps } = jest.requireMock('../services/gamification');
    const calls = { counters: incrementCounter.mock.calls.map((c: unknown[]) => c.slice(0, 3)), badgeReps: logMovementReps.mock.calls.length };
    await act(async () => renderer.unmount());
    jest.clearAllMocks();
    return calls;
  }

  it('une séance de gymnastique seule déclenche le même crédit de compteurs qu’une séance chargée', async () => {
    const gym = await valider(GYM, null);
    const charge = await valider(CHARGE, 100);
    expect(gym.counters).toEqual([['me', 'total_scores_submitted', 1]]);
    expect(gym.counters).toEqual(charge.counters);
  });

  it('et ne crée aucune rep de badge (ni logMovementReps, ni movement_logs)', async () => {
    const gym = await valider(GYM, null);
    expect(gym.badgeReps).toBe(0);
  });
});

describe('G3 bis : grille, reps seules réservées à la gymnastique', () => {
  it('« Push Press — 2 × 5 » sans charge garde son champ kg ; « Ring Muscle-up — 3 × 5 » passe en reps seules', async () => {
    const d = buildStrengthGrid(['Push Press — 2 × 5', 'Ring Muscle-up — 3 × 5', 'Pull-ups — 1 × 8 @ 10 kg'].map(l => parseStrengthLine(l)!), () => null, () => null);
    await act(async () => { renderer = TestRenderer.create(<Banc initial={d} />); });
    await settle();
    const root = renderer.root;
    expect([0, 1].map(i => !!byID(root, `strength-kg-${i}-box`))).toEqual([true, true]);
    expect([2, 3, 4].map(i => !!byID(root, `strength-kg-${i}-box`))).toEqual([false, false, false]);
    expect(!!byID(root, 'strength-kg-5-box')).toBe(true);
    expect(byID(root, 'strength-add-set-0')).toBeUndefined();
    expect(byID(root, 'strength-add-set-1')).toBeTruthy();
    expect(byID(root, 'strength-add-set-2')).toBeUndefined();
  });
});
