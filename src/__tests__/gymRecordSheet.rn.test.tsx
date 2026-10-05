/**
 * G4 : fenêtre « Nouveau record ? » après la validation d'un WOD du Whiteboard.
 * Candidats (règle), fenêtre seule (confirmer, erreurs, « Pas maintenant ») et
 * vrai WODDetailScreen. Vrai react-native, données fictives.
 */
import React from 'react';
import { Modal, ScrollView, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GymRecordSheet from '../components/wod/GymRecordSheet';
import WODDetailScreen from '../screens/whiteboard/WODDetailScreen';

let mockRouteParams: Record<string, unknown> | undefined;
const mockTables: Record<string, unknown[]> = {};
let mockServer: unknown = null;
let mockRecords: Record<string, string> = {};

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
  fetchMyPersonalRecords: jest.fn(async () => mockRecords),
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
    loadStrengthGrid: jest.fn(async (_k: unknown, prescription: never[]) => ({ drafts: prescription, origin: 'prescription', server: null, pending: null, offline: false })),
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

import { GymRecordCandidate, ServerSet, gymRecordCandidates } from '../services/strengthSets';

const TODAY = '2026-10-04';
const rpc = () => jest.requireMock('../lib/supabase').supabase.rpc as jest.Mock;
const fetchRecords = () => jest.requireMock('../services/myProfile').fetchMyPersonalRecords as jest.Mock;

let renderer: TestRenderer.ReactTestRenderer | null = null;
beforeEach(() => {
  // Horloge figée à TODAY (seule la date : les minuteries restent réelles, settle() en dépend) ;
  // sans elle, le WOD du jour devient « passé » dès le lendemain et « Entrer mon score » disparaît.
  jest.useFakeTimers({
    now: new Date(`${TODAY}T10:00:00Z`),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockServer = null;
  mockRecords = {};
  mockRouteParams = undefined;
  rpc().mockImplementation(async () => ({ data: null, error: null }));
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  jest.useRealTimers();
  jest.clearAllMocks();
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
const hostText = (n: ReactTestInstance): string => n.children.map(ch => (typeof ch === 'string' ? ch : hostText(ch))).join('');
const texts = (root: ReactTestInstance) => root.findAll(isHostText).map(hostText);
const byID = (root: ReactTestInstance, id: string) => root.findAll(n => n.props.testID === id && typeof n.type === 'string')[0];
async function settle() {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}
/** Au-delà de MODAL_DISMISS_MS (iOS) : la fenêtre suivante est ouverte. */
async function afterModalDelay() {
  await act(async () => { await new Promise(r => setTimeout(r, 450)); });
  await settle();
}
async function press(root: ReactTestInstance, id: string) {
  let n: ReactTestInstance | null = byID(root, id);
  if (!n) throw new Error(`introuvable : ${id}`);
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  await act(async () => { n!.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}

const set = (id: string, movement: string, reps: number | null, load_kg: number | null = null): ServerSet => ({
  id, movement, movement_label: null, set_index: 1, reps, load_kg, prescribed_reps: null, prescribed_load_kg: null, is_added: false,
} as ServerSet);
const RECORDS: Record<string, number> = { 'Ring Muscle-up': 20, 'Toes To Bar': 15, 'Pull-ups': 10 };
const recordFor = (l: string) => RECORDS[l] ?? null;

describe('G4 : séries candidates (relues du serveur)', () => {
  it('sans record existant : aucune ligne', () => {
    expect(gymRecordCandidates([set('a', 'Bar Muscle-up', 30)], recordFor)).toEqual([]);
    expect(gymRecordCandidates([set('a', 'Ring Muscle-up', 30)], () => null)).toEqual([]);
  });

  it('meilleure série égale ou inférieure au record : aucune ligne', () => {
    expect(gymRecordCandidates([set('a', 'Ring Muscle-up', 20), set('b', 'Ring Muscle-up', 12)], recordFor)).toEqual([]);
    expect(gymRecordCandidates([set('a', 'Ring Muscle-up', 19)], recordFor)).toEqual([]);
  });

  it('au-dessus du record : une ligne avec l’id de la meilleure série et le libellé de la page Records', () => {
    const out = gymRecordCandidates([set('a', 'RMU', 12), set('b', 'ring muscle ups', 22), set('c', 'Ring Muscle-up', 21)], recordFor);
    expect(out).toEqual([{ label: 'Ring Muscle-up', movement: 'ring muscle ups', reps: 22, record: 20, setLogId: 'b' }]);
  });

  it('une ligne par mouvement', () => {
    const out = gymRecordCandidates([
      set('a', 'Ring Muscle-up', 21), set('b', 'Toes to Bar', 16), set('c', 'T2B', 18), set('d', 'Ring Muscle-up', 25),
    ], recordFor);
    expect(out.map(c => [c.label, c.reps, c.setLogId])).toEqual([['Ring Muscle-up', 25, 'd'], ['Toes To Bar', 18, 'c']]);
  });

  it('rien pour un mouvement chargé, de la gymnastique lestée ou une série sans reps', () => {
    expect(gymRecordCandidates([
      set('a', 'Back Squat', 30, 100), set('b', 'Pull-ups', 25, 10), set('c', 'Ring Muscle-up', null), set('d', 'Push Press', 40),
    ], recordFor)).toEqual([]);
  });
});

const ONE: GymRecordCandidate[] = [{ label: 'Ring Muscle-up', movement: 'Ring Muscle-up', reps: 22, record: 20, setLogId: 'srv-1' }];
const TWO: GymRecordCandidate[] = [...ONE, { label: 'Toes To Bar', movement: 'Toes to Bar', reps: 18, record: 15, setLogId: 'srv-2' }];

async function mountSheet(candidates: GymRecordCandidate[] | null) {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  await act(async () => { renderer = TestRenderer.create(<GymRecordSheet candidates={candidates} onClose={onClose} onSaved={onSaved} />); });
  await settle();
  return { root: renderer!.root, onClose, onSaved };
}
const rpcError = (message: string, code: string | null = 'P0001') => ({ data: null, error: { message, code } });

describe('G4 : fenêtre « Nouveau record ? »', () => {
  it('fermée sans candidat', async () => {
    const { root } = await mountSheet(null);
    expect(root.findByType(Modal).props.visible).toBe(false);
  });

  it('un mouvement : textes, une ligne, « Enregistrer 22 reps comme record »', async () => {
    const { root } = await mountSheet(ONE);
    expect(root.findByType(Modal).props.visible).toBe(true);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Nouveau record ?',
      'Une série a dépassé ton record. Il ne change que si tu le confirmes : une série dans un bloc ne vaut pas forcément un max unbroken.',
      'Ring Muscle-up', '22 reps · avant 20', 'Enregistrer 22 reps comme record', 'Pas maintenant',
    ]));
  });

  it('plusieurs mouvements : une ligne par mouvement, « Enregistrer ces records », liste défilable', async () => {
    const { root } = await mountSheet(TWO);
    expect(['Ring Muscle-up', 'Toes To Bar'].map(l => hostText(byID(root, `gym-record-value-${l}`)))).toEqual(['22 reps · avant 20', '18 reps · avant 15']);
    expect(texts(root)).toContain('Enregistrer ces records');
    const list = root.findAll(n => n.type === ScrollView && n.props.testID === 'gym-record-list')[0];
    expect(StyleSheet.flatten(list.props.style).maxHeight).toBeGreaterThan(0);
    expect(list.findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('gym-record-line-') && typeof n.type === 'string')).toHaveLength(2);
  });

  it('feuille en bas, voile, zone sûre en bas', async () => {
    const { root } = await mountSheet(ONE);
    const veil = StyleSheet.flatten(byID(root, 'gym-record-veil').props.style);
    expect(veil.justifyContent).toBe('flex-end');
    expect(veil.backgroundColor).toBe('rgba(0,0,0,0.6)');
    expect(StyleSheet.flatten(byID(root, 'gym-record-sheet').props.style).paddingBottom).toBeGreaterThanOrEqual(34);
  });

  it('« Pas maintenant » ferme sans rien appeler', async () => {
    const { root, onClose, onSaved } = await mountSheet(TWO);
    await press(root, 'gym-record-later');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(rpc()).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('confirmer appelle confirm_gym_record avec l’id de série du serveur et le libellé, pour chaque ligne', async () => {
    const { root, onClose, onSaved } = await mountSheet(TWO);
    await press(root, 'gym-record-confirm');
    expect(rpc().mock.calls).toEqual([
      ['confirm_gym_record', { p_set_log_id: 'srv-1', p_label: 'Ring Muscle-up' }],
      ['confirm_gym_record', { p_set_log_id: 'srv-2', p_label: 'Toes To Bar' }],
    ]);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('une erreur s’affiche sur sa ligne ; l’autre ligne reste enregistrée, la fenêtre reste ouverte', async () => {
    rpc().mockImplementation(async (_f: string, a: { p_label: string }) =>
      (a.p_label === 'Toes To Bar' ? rpcError('RECORD_NON_AMELIORE: record déjà à 18') : { data: {}, error: null }));
    const { root, onClose, onSaved } = await mountSheet(TWO);
    await press(root, 'gym-record-confirm');
    expect(hostText(byID(root, 'gym-record-error-Toes To Bar'))).toBe('Ton record est déjà à ce niveau ou plus haut.');
    expect(byID(root, 'gym-record-error-Ring Muscle-up')).toBeUndefined();
    expect(byID(root, 'gym-record-saved-Ring Muscle-up')).toBeTruthy();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    // Réessayer ne relance que la ligne en erreur.
    rpc().mockClear();
    rpc().mockImplementation(async () => ({ data: {}, error: null }));
    await press(root, 'gym-record-confirm');
    expect(rpc().mock.calls).toEqual([['confirm_gym_record', { p_set_log_id: 'srv-2', p_label: 'Toes To Bar' }]]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('erreurs serveur et réseau, chacune avec son texte', async () => {
    const codes: Record<string, unknown> = {
      'Ring Muscle-up': rpcError('RECORD_NON_PROUVE: série introuvable'),
      'Toes To Bar': rpcError('Failed to fetch', null),
    };
    rpc().mockImplementation(async (_f: string, a: { p_label: string }) => codes[a.p_label]);
    const { root, onSaved } = await mountSheet(TWO);
    await press(root, 'gym-record-confirm');
    expect(hostText(byID(root, 'gym-record-error-Ring Muscle-up'))).toBe('Cette série ne prouve pas le record : rien n’a été enregistré.');
    expect(hostText(byID(root, 'gym-record-error-Toes To Bar'))).toBe('Pas de connexion : réessaie.');
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('G4 : après la validation d’un WOD du Whiteboard', () => {
  const WOD = {
    id: 'wG', box_id: 'box-1', title: 'Skill gym', wod_type: 'strength', block_name: 'strength', scheduled_date: TODAY,
    description: 'Ring Muscle-up — 3 × 5\nPull-ups — 1 × 8 @ 10 kg', time_cap_seconds: null, video_url: null, notes: null,
    track: 'functional', is_published: true, sort_order: 0, leaderboard_enabled: true,
  };
  async function validate(serverSets: ServerSet[]) {
    const { submitStrengthValidation } = jest.requireMock('../services/strengthSets');
    submitStrengthValidation.mockImplementation(async (_p: unknown, onFirst: (r: unknown) => Promise<void>) => {
      const res = { premiereValidation: true, maxLoadKg: 10, totalReps: 15, seriesValides: 4, records: [] };
      await onFirst(res);
      mockServer = { session: { status: 'validated', plannedSets: 4, maxLoadKg: 10, totalReps: 15, firstValidatedAt: `${TODAY}T10:00:00Z`, updatedAt: `${TODAY}T10:00:00Z` }, sets: serverSets };
      return res;
    });
    mockTables['box_wods|*'] = [WOD];
    mockTables.wod_scores = [];
    mockRouteParams = { wodId: WOD.id };
    await act(async () => {
      renderer = TestRenderer.create(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
          <WODDetailScreen />
        </QueryClientProvider>,
      );
    });
    await settle();
    const root = renderer!.root;
    await press(root, 'enter-score');
    await press(root, 'strength-validate');
    await afterModalDelay();
    return root;
  }
  const sheetOpen = (root: ReactTestInstance) => !!byID(root, 'gym-record-sheet');

  it('record battu : la fenêtre s’ouvre avec l’id de série relu du serveur', async () => {
    mockRecords = { 'gymnastics_Ring Muscle-up': '20' };
    const root = await validate([set('srv-rmu', 'Ring Muscle-up', 22), set('srv-pu', 'Pull-ups', 30, 10)]);
    expect(sheetOpen(root)).toBe(true);
    expect(texts(root)).toEqual(expect.arrayContaining(['22 reps · avant 20', 'Enregistrer 22 reps comme record']));
    expect(byID(root, 'gym-record-line-Pull-ups')).toBeUndefined();
    await press(root, 'gym-record-confirm');
    expect(rpc()).toHaveBeenCalledWith('confirm_gym_record', { p_set_log_id: 'srv-rmu', p_label: 'Ring Muscle-up' });
  });

  it('sans record existant : pas de fenêtre', async () => {
    const root = await validate([set('srv-rmu', 'Ring Muscle-up', 22)]);
    expect(sheetOpen(root)).toBe(false);
  });

  it('meilleure série sous le record : pas de fenêtre', async () => {
    mockRecords = { 'gymnastics_Ring Muscle-up': '25' };
    const root = await validate([set('srv-rmu', 'Ring Muscle-up', 22)]);
    expect(sheetOpen(root)).toBe(false);
  });

  it('records relus après un succès, fenêtre fermée', async () => {
    mockRecords = { 'gymnastics_Ring Muscle-up': '20' };
    const root = await validate([set('srv-rmu', 'Ring Muscle-up', 22)]);
    const before = fetchRecords().mock.calls.length;
    await press(root, 'gym-record-confirm');
    expect(fetchRecords().mock.calls.length).toBe(before + 1);
    expect(sheetOpen(root)).toBe(false);
  });

  it('« Pas maintenant » : rien d’écrit, pas de nouvelle proposition, le partage suit', async () => {
    mockRecords = { 'gymnastics_Ring Muscle-up': '20' };
    const root = await validate([set('srv-rmu', 'Ring Muscle-up', 22)]);
    const before = fetchRecords().mock.calls.length;
    await press(root, 'gym-record-later');
    await afterModalDelay();
    expect(rpc()).not.toHaveBeenCalledWith('confirm_gym_record', expect.anything());
    expect(fetchRecords().mock.calls.length).toBe(before);
    expect(sheetOpen(root)).toBe(false);
    expect(root.findAllByType(Modal).filter(m => m.props.visible)).toHaveLength(1);
  });
});
