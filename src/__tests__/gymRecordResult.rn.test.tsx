/**
 * G4 : fenêtre « Nouveau record ? » après la validation d'une séance générée
 * (vrai WodResultScreen). Une séance au poids du corps seule se valide.
 */
import React, { useEffect as mockUseEffect } from 'react';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import WodResultScreen from '../screens/wod/WodResultScreen';
import i18n from '../i18n';
import { BANK_V1, CATALOG_SNAPSHOT, generateMuscu } from '../../packages/wod-engine/src';

let mockRouteParams: Record<string, unknown> = {};
let mockRecords: Record<string, string> = {};
let mockServerSets: unknown[] = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
  useFocusEffect: (callback: () => () => void) => mockUseEffect(callback, [callback]),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', level: 'rx' }, currentBox: { id: 'box-1', name: 'Box fictive' } }),
}));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').darkTheme }) }));
jest.mock('../lib/supabase', () => ({ supabase: { rpc: jest.fn(async () => ({ data: {}, error: null })) } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/haptics', () => ({ hapticSuccess: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/wodDraft', () => ({
  loadWodDraft: async () => null, saveWodDraft: jest.fn(async () => undefined), clearWodDraft: jest.fn(async () => undefined),
}));
jest.mock('../services/muscuSession', () => ({
  ...jest.requireActual('../services/muscuSession'),
  findResumableMuscuSession: async () => null,
  validateMuscuSession: jest.fn(async () => undefined),
}));
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: jest.fn(async () => mockRecords) }));
jest.mock('../services/strengthSets', () => ({
  ...jest.requireActual('../services/strengthSets'),
  loadStrengthGrid: jest.fn(async (_k: unknown, drafts: unknown[]) => ({ origin: 'prescription', drafts, server: null, pending: null, offline: false })),
  fetchStrengthSession: jest.fn(async () => ({
    session: { status: 'validated', plannedSets: 3, maxLoadKg: null, firstValidatedAt: '2026-10-04T10:00:00Z', updatedAt: '2026-10-04T10:00:00Z' },
    sets: mockServerSets,
  })),
  saveStrengthDraft: jest.fn(async () => ({ status: 'saved' })),
}));
jest.mock('../components/wod/TimerLaunchModal', () => () => null);
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

// Séance générée réelle, réduite à un exercice au poids du corps.
const base = generateMuscu({ entry: 'express', target: 'push', objective: 'hypertrophie', budget_min: 45, equipment: 'box', level: 'inter' }, CATALOG_SNAPSHOT, BANK_V1, 7);
const WOD = {
  ...base,
  blocks: [{ ...base.blocks[0], exercises: [
    { ...base.blocks[0].exercises[0], id: 'pu', name: 'Pull-ups', sets: 2, reps: 8, reps_unit: 'reps', load: { mode: 'bodyweight' } },
  ] }],
};
const params = {
  screen: { entry: 'express', discipline: 'musculation', target: 'haut', objective: 'force', equipment: 'box', exclude: [] },
  result: { wod: WOD, params: { entry: 'express', discipline: 'musculation', budget_min: 30 }, category: 'rx' },
  savedId: 'gen-1',
};
const srv = (id: string, movement: string, reps: number, load_kg: number | null = null) => ({
  id, movement, movement_label: null, set_index: 1, reps, load_kg, prescribed_reps: 8, prescribed_load_kg: null, is_added: false,
});

let renderer: TestRenderer.ReactTestRenderer | null = null;
beforeEach(() => {
  mockRouteParams = params;
  mockRecords = {};
  mockServerSets = [];
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  jest.clearAllMocks();
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
const hostText = (n: ReactTestInstance): string => n.children.map(ch => (typeof ch === 'string' ? ch : hostText(ch))).join('');
const texts = (root: ReactTestInstance) => root.findAll(isHostText).map(hostText);
const byID = (root: ReactTestInstance, id: string) => root.findAll(n => n.props.testID === id && typeof n.type === 'string')[0];
async function settle() {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}
async function wait(ms: number) {
  await act(async () => { await new Promise(r => setTimeout(r, ms)); });
  await settle();
}
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll(x => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`introuvable : ${id}`);
  await act(async () => { n.props.onPress(); });
  await settle();
}
async function validate() {
  await act(async () => { renderer = TestRenderer.create(<WodResultScreen />); });
  await settle();
  const root = renderer!.root;
  await press(root, 'wodresult-score');
  await press(root, 'wodresult-score-submit');
  await wait(450);
  return root;
}
const saved = () => i18n.t('wodGenerator.scoreSavedTitle');

describe('G4 : après la validation d’une séance générée', () => {
  it('séance au poids du corps seule : validée, puis la fenêtre propose le record battu', async () => {
    mockRecords = { 'gymnastics_Pull-ups': '10' };
    mockServerSets = [srv('srv-pu', 'Pull-ups', 12), srv('srv-pu2', 'Pull-ups', 9)];
    const root = await validate();
    expect(jest.requireMock('../services/muscuSession').validateMuscuSession).toHaveBeenCalledTimes(1);
    expect(byID(root, 'gym-record-sheet')).toBeTruthy();
    expect(texts(root)).toEqual(expect.arrayContaining(['12 reps · avant 10', 'Enregistrer 12 reps comme record']));
    expect(texts(root)).not.toContain(saved());
    await press(root, 'gym-record-confirm');
    expect(jest.requireMock('../lib/supabase').supabase.rpc).toHaveBeenCalledWith('confirm_gym_record', { p_set_log_id: 'srv-pu', p_label: 'Pull-ups' });
    expect(jest.requireMock('../services/myProfile').fetchMyPersonalRecords).toHaveBeenCalledTimes(2);
    expect(byID(root, 'gym-record-sheet')).toBeUndefined();
    await wait(450);
    expect(texts(root)).toContain(saved());
  });

  it('« Pas maintenant » : rien d’écrit, le message « score enregistré » suit', async () => {
    mockRecords = { 'gymnastics_Pull-ups': '10' };
    mockServerSets = [srv('srv-pu', 'Pull-ups', 12)];
    const root = await validate();
    await press(root, 'gym-record-later');
    await wait(450);
    expect(jest.requireMock('../lib/supabase').supabase.rpc).not.toHaveBeenCalled();
    expect(byID(root, 'gym-record-sheet')).toBeUndefined();
    expect(texts(root)).toContain(saved());
  });

  it('sans record existant : pas de fenêtre, le message « score enregistré » directement', async () => {
    mockServerSets = [srv('srv-pu', 'Pull-ups', 12)];
    const root = await validate();
    expect(byID(root, 'gym-record-sheet')).toBeUndefined();
    expect(texts(root)).toContain(saved());
  });

  it('série chargée au-dessus du record : pas de fenêtre', async () => {
    mockRecords = { 'gymnastics_Pull-ups': '10' };
    mockServerSets = [srv('srv-pu', 'Pull-ups', 12, 10)];
    const root = await validate();
    expect(byID(root, 'gym-record-sheet')).toBeUndefined();
  });
});
