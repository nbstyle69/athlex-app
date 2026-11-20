/**
 * Confirmation à la validation (décision de Nab, nbstyle69/AthleX-Manager#453, PR 4b) :
 * « n / N » à l'ouverture ne compte pas les séries à charge prévue laissées vides ;
 * « Valider la séance » demande confirmation quand des séries prévues avec charge
 * partent sans charge (« Annuler » n'envoie rien, « Valider » envoie tout), et
 * jamais sinon. Vrai WODDetailScreen, WOD en lignes et en texte libre, données fictives.
 */
import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fs from 'fs';
import path from 'path';
import i18n from '../i18n';
import WODDetailScreen from '../screens/whiteboard/WODDetailScreen';
import { confirmUnloadedSets } from '../components/wod/StrengthSetGrid';

let mockRouteParams: Record<string, unknown> | undefined;
const mockTables: Record<string, unknown[]> = {};

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
  fetchMyPersonalRecords: jest.fn(async () => ({})),
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
    saveStrengthDraft: jest.fn(async () => ({ status: 'saved', updatedAt: '2026-11-20T10:00:00Z' })),
    submitStrengthValidation: jest.fn(async () => ({ premiereValidation: false, maxLoadKg: 100, totalReps: 10, seriesValides: 4, records: [] })),
    fetchStrengthSession: jest.fn(async () => ({ session: null, sets: [] })),
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

const TODAY = '2026-11-20';
const submit = () => jest.requireMock('../services/strengthSets').submitStrengthValidation as jest.Mock;
let alertSpy: jest.SpyInstance;
let renderer: TestRenderer.ReactTestRenderer | null = null;

beforeEach(async () => {
  jest.useFakeTimers({
    now: new Date(`${TODAY}T10:00:00Z`),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await i18n.changeLanguage('fr');
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  jest.useRealTimers();
  jest.clearAllMocks();
  alertSpy.mockRestore();
});

const hostText = (n: ReactTestInstance): string => n.children.map(ch => (typeof ch === 'string' ? ch : hostText(ch))).join('');
const byID = (root: ReactTestInstance, id: string) => root.findAll(n => n.props.testID === id && typeof n.type === 'string')[0];
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

/** WOD de force fictif : Deadlift en kg (préremplie), Back Squat en %1RM sans 1RM connu. */
async function open(description: string, textMode: 'lines' | 'free' = 'lines') {
  mockTables['box_wods|*'] = [{
    id: 'wM', box_id: 'box-1', title: 'Force', wod_type: 'strength', block_name: 'strength', scheduled_date: TODAY,
    description, text_mode: textMode, score_type: null, time_cap_seconds: null, video_url: null, notes: null,
    track: 'functional', is_published: true, sort_order: 0, leaderboard_enabled: true,
  }];
  mockTables.wod_scores = [];
  mockRouteParams = { wodId: 'wM' };
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
  return root;
}
const MIXTE = 'Deadlift — 2 × 2 @ 100 kg\nBack Squat — 2 × 5 @ 75 %1RM';
/** Dernier appel d'Alert.alert : [titre, message, boutons]. */
const alerte = () => alertSpy.mock.calls[alertSpy.mock.calls.length - 1] as [string, string, { text: string; onPress: () => void }[]];

describe.each([['en lignes', 'lines'], ['en texte libre', 'free']] as const)('WOD %s', (_n, mode) => {
  const description = mode === 'free' ? `${MIXTE}\n\nPuis 3 tours :\n10 burpees` : MIXTE;

  it('ouverture : « 2 / 4 » (les Back Squat à charge prévue, vides, ne comptent pas)', async () => {
    const root = await open(description, mode);
    expect(hostText(byID(root, 'strength-progress'))).toMatch(/2 \/ 4/);
  });

  it('Valider : confirmation « 2 séries… » ; Annuler n’envoie rien ; Valider envoie les 4 séries', async () => {
    const root = await open(description, mode);
    await press(root, 'strength-validate');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [titre, message, boutons] = alerte();
    expect(titre).toBe('Séries sans charge');
    expect(message).toBe('2 séries prévues avec charge seront enregistrées sans charge. Valider quand même ?');
    expect(boutons.map(b => b.text)).toEqual(['Annuler', 'Valider']);
    await act(async () => { boutons[0].onPress(); });
    await settle();
    expect(submit()).not.toHaveBeenCalled();

    await press(root, 'strength-validate');
    await act(async () => { alerte()[2][1].onPress(); });
    await settle();
    expect(submit()).toHaveBeenCalledTimes(1);
    const drafts = submit().mock.calls[0][0].drafts as { name: string; loadKg: string }[];
    expect(drafts.map(d => `${d.name}:${d.loadKg}`)).toEqual(['Deadlift:100', 'Deadlift:100', 'Back Squat:', 'Back Squat:']);
  });
});

describe('aucune confirmation', () => {
  it('toutes les séries prévues avec charge ont leur charge : validation directe', async () => {
    const root = await open('Deadlift — 2 × 2 @ 100 kg');
    await press(root, 'strength-validate');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(submit()).toHaveBeenCalledTimes(1);
  });

  it('seulement des lignes sans charge prévue (gymnastique) : validation directe', async () => {
    const root = await open('Ring Muscle-up — 3 × 5');
    await press(root, 'strength-validate');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(submit()).toHaveBeenCalledTimes(1);
  });
});

describe('confirmUnloadedSets', () => {
  it('rien à confirmer : aucune fenêtre, validé', async () => {
    await expect(confirmUnloadedSets(0)).resolves.toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['fr', 1, '1 série prévue avec charge sera enregistrée sans charge. Valider quand même ?', 'Annuler', 'Valider'],
    ['en', 3, '3 sets planned with a load will be saved without load. Validate anyway?', 'Cancel', 'Validate'],
  ])('%s, %i : message au pluriel juste ; Annuler → false, Valider → true, fermeture → false', async (lng, n, msg, annuler, valider) => {
    await i18n.changeLanguage(lng);
    let p = confirmUnloadedSets(n);
    expect(alerte()[1]).toBe(msg);
    expect(alerte()[2].map(b => b.text)).toEqual([annuler, valider]);
    alerte()[2][0].onPress();
    await expect(p).resolves.toBe(false);
    p = confirmUnloadedSets(n);
    alerte()[2][1].onPress();
    await expect(p).resolves.toBe(true);
    p = confirmUnloadedSets(n);
    (alertSpy.mock.calls[alertSpy.mock.calls.length - 1][3] as { onDismiss: () => void }).onDismiss();
    await expect(p).resolves.toBe(false);
  });

  it('séance générée : la confirmation passe avant tout envoi (avant onSave)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../screens/wod/WodResultScreen.tsx'), 'utf8');
    const f = src.slice(src.indexOf('async function onSubmitMuscuScore'));
    expect(f.indexOf('confirmUnloadedSets(unloadedPlannedSets(performedToDrafts(m, performed)))')).toBeGreaterThan(-1);
    expect(f.indexOf('confirmUnloadedSets(')).toBeLessThan(f.indexOf('await onSave()'));
  });
});
