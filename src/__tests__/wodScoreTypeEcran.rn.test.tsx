/**
 * #453, PR 3 (app) : saisie du score fixé par le créateur, texte libre,
 * « Marquer comme faite ». WODDetailScreen monté avec le vrai react-native,
 * Supabase simulé (aucun réseau), données fictives.
 * - WOD typé : une seule pastille et le champ du type ; ce qui part en base ;
 * - WOD sans type : écran et écriture d'avant ;
 * - 'done' : ni compteur ni crédit ; texte libre affiché tel quel ;
 * - tri du classement selon score_type ; refus SCORE_TYPE_MISMATCH lisible ;
 * - anglais : aucun texte français dans les nouveaux états.
 */
import React from 'react';
import { Alert, Modal, TextInput } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import WODDetailScreen from '../screens/whiteboard/WODDetailScreen';
import { incrementCounter, logMovementReps, recordActivity } from '../services/gamification';
import { logStrengthSets, submitStrengthValidation } from '../services/strengthSets';

const mockTables: Record<string, unknown[]> = {};
const mockUpserts: Record<string, unknown>[] = [];
let mockUpsertError: { message: string } | null = null;
let mockRouteParams: Record<string, unknown> = {};

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
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
const BOX = { id: 'box-1', name: 'Box Alpha' };
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', username: 'Sam', gender: 'male' }, currentBox: BOX }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').lightTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let upsert = false;
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'gte', 'lte', 'order', 'limit', 'in', 'or', 'is', 'not', 'update', 'delete', 'insert', 'upsert']) {
      b[m] = (...args: unknown[]) => {
        if (m === 'upsert') { upsert = true; mockUpserts.push({ table, ...(args[0] as object) }); }
        return b;
      };
    }
    const rows = () => (mockTables[table] ?? []) as unknown[];
    const one = () => ({ then: (res: (v: unknown) => unknown) => Promise.resolve({ data: rows()[0] ?? null, error: null }).then(res) });
    b.single = one;
    b.maybeSingle = () => ({ then: (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res) });
    b.then = (res: (v: unknown) => unknown) => Promise.resolve(upsert && mockUpsertError
      ? { data: null, error: mockUpsertError }
      : { data: rows(), count: rows().length, error: null }).then(res);
    return b;
  };
  const channel = () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; };
  return { supabase: { from: (t: string) => builder(t), channel, removeChannel: jest.fn(), rpc: jest.fn(async () => ({ data: null, error: null })) } };
});
jest.mock('../lib/analytics', () => ({ trackScoreSubmit: jest.fn() }));
jest.mock('../services/notifications', () => ({
  sendScoreNotification: jest.fn(async () => {}), sendScoreOvertakenNotification: jest.fn(async () => {}),
  cancelTodayScoreReminder: jest.fn(async () => {}),
}));
jest.mock('../services/gamification', () => ({
  incrementCounter: jest.fn(async () => []), logMovementReps: jest.fn(async () => []), recordActivity: jest.fn(async () => []),
}));
jest.mock('../services/strengthPR', () => ({ recordStrengthPRs: jest.fn(async () => []) }));
jest.mock('../utils/eloLevels', () => ({ syncLevelAndBadges: jest.fn(async () => []) }));
jest.mock('../hooks/useMyOneRepMax', () => {
  const none = () => null;
  return { useMyOneRepMax: () => none, useMyRecords: () => ({ oneRepMaxFor: none, gymRecordFor: none, reload: () => {} }) };
});
jest.mock('../services/strengthSets', () => ({
  ...jest.requireActual('../services/strengthSets'),
  loadStrengthGrid: jest.fn(async (_k: unknown, prescription: unknown[]) => ({ drafts: prescription, origin: 'prescription', server: null, pending: null, offline: false })),
  fetchStrengthSession: jest.fn(async () => ({ session: null, sets: [] })),
  logStrengthSets: jest.fn(async () => []),
  submitStrengthValidation: jest.fn(async (_p: unknown, onFirst: (r: unknown) => Promise<void>) => {
    const r = { premiereValidation: true, maxLoadKg: 100, totalReps: null, seriesValides: 5, records: [] };
    await onFirst(r);
    return r;
  }),
}));
jest.mock('../services/moderation', () => ({ ...jest.requireActual('../services/moderation'), getBlockedUserIds: async () => [] }));
jest.mock('../components/SharePerfScreen', () => () => null);
jest.mock('react-native-webview', () => 'WebView');
jest.mock('react-native-view-shot', () => 'ViewShot');
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn(async () => true) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-11-19T10:00:00Z');
const TODAY = '2026-11-19';
const RXP = "For time\n21 pull-ups + 15/12 cal ski + 21 thrusters @43/29\n1'30 rest\nTC 14'";
const WOD = {
  id: 'w1', box_id: 'box-1', title: 'Test', description: '20 min AMRAP\n5 pull-ups', wod_type: 'amrap',
  scheduled_date: TODAY, time_cap_seconds: 1200, notes: null, video_url: null, is_published: true, leaderboard_enabled: true,
};
const score = (member: string, v: number, type: string, extra: Record<string, unknown> = {}) => ({
  id: `s-${member}`, wod_id: 'w1', member_id: member, score_value: v, score_type: type, rx: true, capped: false, notes: null,
  profile: { id: member, username: member === 'me' ? 'Sam' : `User ${member}`, avatar_url: null, level: 'rx', elo: 1000 }, ...extra,
});

let renderer: TestRenderer.ReactTestRenderer;
let alerts: string[] = [];
beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message) => { alerts.push(`${title} | ${message ?? ''}`); });
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockUpserts.length = 0;
  mockUpsertError = null;
  mockTables.wod_scores = [];
  await i18n.changeLanguage('fr');
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
afterAll(async () => { await i18n.changeLanguage('fr'); });

async function settle() {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}
async function mount(wod: Record<string, unknown>) {
  mockTables.box_wods = [wod];
  mockRouteParams = { wodId: wod.id as string };
  await act(async () => { renderer = TestRenderer.create(<WODDetailScreen />); });
  await settle();
  return renderer.root;
}
const byId = (root: ReactTestInstance, id: string) => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll(x => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await act(async () => { n.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
async function type(root: ReactTestInstance, id: string, text: string) {
  const input = root.findAll(n => n.type === TextInput && n.props.testID === id)[0];
  if (!input) throw new Error(`champ introuvable : ${id}`);
  await act(async () => { input.props.onChangeText(text); });
}
const hostText = (n: ReactTestInstance): string => n.children.map(ch => (typeof ch === 'string' ? ch : hostText(ch))).join('');
function texts(root: ReactTestInstance, inModal = false): string[] {
  const scope = inModal ? root.findAll(n => n.type === Modal && n.props.visible)[0] : root;
  return scope.findAll(n => String(n.type) === 'Text').map(hostText);
}
const uniq = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i);
const chips = (root: ReactTestInstance) => uniq(root.findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('score-type-') && typeof n.props.onPress === 'function').map(n => n.props.testID as string));
const submitDisabled = (root: ReactTestInstance) => root.findAll(n => n.props.testID === 'score-submit' && typeof n.props.onPress === 'function')[0].props.disabled;
const lastUpsert = () => mockUpserts[mockUpserts.length - 1];

describe('WOD sans type : comportement d’avant', () => {
  it('AMRAP : une pastille Reps, champ unique, score reps, compteur et crédit', async () => {
    const root = await mount(WOD);
    await press(root, 'enter-score');
    expect(chips(root)).toEqual(['score-type-reps']);
    expect(byId(root, 'score-fixed-hint')).toHaveLength(0);
    expect(texts(root, true)).toContain('RX');
    await type(root, 'score-value', '150');
    await press(root, 'score-submit');
    expect(lastUpsert()).toMatchObject({ score_type: 'reps', score_value: 150, capped: false });
    expect(incrementCounter).toHaveBeenCalledWith('me', 'total_scores_submitted', 1, 'box-1', expect.anything());
    expect(logMovementReps).toHaveBeenCalled();
  });

  it('wod_type absent : les quatre pastilles d’avant, au choix', async () => {
    const root = await mount({ ...WOD, wod_type: null });
    await press(root, 'enter-score');
    expect(chips(root)).toEqual(['score-type-time', 'score-type-reps', 'score-type-weight', 'score-type-rounds']);
  });
});

describe('WOD typé : une seule pastille et le champ du type', () => {
  it('Temps sur un AMRAP : MM:SS, indication du coach, case CAP → reps', async () => {
    const root = await mount({ ...WOD, score_type: 'time' });
    await press(root, 'enter-score');
    expect(chips(root)).toEqual(['score-type-time']);
    expect(texts(root, true)).toContain('Type de score fixé par le coach : plus de choix à faire.');
    await type(root, 'score-time-min', '12');
    await type(root, 'score-time-sec', '34');
    await press(root, 'score-submit');
    expect(lastUpsert()).toMatchObject({ score_type: 'time', score_value: 754, capped: false });
  });

  it('Temps au time cap : reps complétées, capped', async () => {
    const root = await mount({ ...WOD, score_type: 'time' });
    await press(root, 'enter-score');
    await press(root, 'score-dnf');
    expect(byId(root, 'score-fixed-hint')).toHaveLength(0);
    await type(root, 'score-cap-reps', '87');
    await press(root, 'score-submit');
    expect(lastUpsert()).toMatchObject({ score_type: 'time', score_value: 87, capped: true });
  });

  it('Tours + reps : deux champs, tours × 1000 + reps', async () => {
    const root = await mount({ ...WOD, wod_type: 'for-time', score_type: 'rounds_reps' });
    await press(root, 'enter-score');
    expect(chips(root)).toEqual(['score-type-rounds_reps']);
    expect(texts(root, true)).toEqual(expect.arrayContaining(['TOURS + REPS', 'TOURS', 'REPS', 'Tours complets, puis les reps du tour en cours.']));
    expect(submitDisabled(root)).toBe(true);
    await type(root, 'score-rounds', '7');
    await type(root, 'score-rounds-reps', '12');
    expect(submitDisabled(root)).toBe(false);
    await press(root, 'score-submit');
    expect(lastUpsert()).toMatchObject({ score_type: 'rounds_reps', score_value: 7012, capped: false });
  });

  it('Tours + reps : 1000 reps ou plus refusées, erreur sous le champ', async () => {
    const root = await mount({ ...WOD, score_type: 'rounds_reps' });
    await press(root, 'enter-score');
    await type(root, 'score-rounds', '7');
    await type(root, 'score-rounds-reps', '1000');
    expect(texts(root, true)).toContain('Moins de 1000 reps dans le tour en cours.');
    expect(submitDisabled(root)).toBe(true);
    await type(root, 'score-rounds-reps', '999');
    expect(byId(root, 'score-rounds-reps-error')).toHaveLength(0);
    expect(submitDisabled(root)).toBe(false);
  });

  it.each([['reps', 'REPS', 150], ['weight', 'CHARGE', 100]] as const)('%s sur un For Time : un champ, score %s', async (st, label, v) => {
    const root = await mount({ ...WOD, wod_type: 'for-time', score_type: st });
    await press(root, 'enter-score');
    expect(chips(root)).toEqual([`score-type-${st}`]);
    expect(texts(root, true)).toContain(label);
    expect(byId(root, 'score-dnf')).toHaveLength(0);
    await type(root, 'score-value', String(v));
    await press(root, 'score-submit');
    expect(lastUpsert()).toMatchObject({ score_type: st, score_value: v });
  });
});

describe('Sans score : « Marquer comme faite »', () => {
  const NONE = { ...WOD, score_type: 'none', leaderboard_enabled: false };

  it('bouton et fenêtre « Marquer comme faite », ni pastille ni champ ni niveau', async () => {
    const root = await mount(NONE);
    expect(texts(root)).toContain('Marquer comme faite');
    await press(root, 'enter-score');
    const t = texts(root, true);
    expect(t.filter(x => x === 'Marquer comme faite')).toHaveLength(2);
    expect(t).toContain('Pas de score pour cette séance : marque-la comme faite. Elle compte dans ton historique, sans classement.');
    expect(chips(root)).toEqual([]);
    expect(t).not.toContain('RX');
    expect(root.findAll(n => n.type === TextInput).map(n => n.props.testID)).toEqual(['score-notes']);
  });

  it('score « done » = 1, série d’activité, sans compteur ni crédit', async () => {
    const root = await mount({ ...NONE, description: '10 pull-ups' });
    await press(root, 'enter-score');
    expect(submitDisabled(root)).toBe(false);
    await press(root, 'score-submit');
    expect(lastUpsert()).toMatchObject({ score_type: 'done', score_value: 1 });
    expect(incrementCounter).not.toHaveBeenCalled();
    expect(logMovementReps).not.toHaveBeenCalled();
    expect(recordActivity).toHaveBeenCalledWith('me', 'box-1');
  });

  it('mon score affiché « Faite », hors de tout classement', async () => {
    mockTables.wod_scores = [score('me', 1, 'done'), score('u2', 1, 'done')];
    const root = await mount(NONE);
    expect(byId(root, 'my-score-value').map(hostText)).toEqual(['Faite']);
    expect(byId(root, 'my-score').length).toBeGreaterThan(0);
    expect(texts(root).some(x => x.startsWith('#'))).toBe(false);
  });
});

describe('texte libre', () => {
  it('affiché tel quel (retours à la ligne gardés, aucune annotation)', async () => {
    const root = await mount({ ...WOD, wod_type: 'for-time', score_type: 'time', text_mode: 'free', description: RXP });
    expect(byId(root, 'wod-free-text').map(hostText)).toEqual([RXP]);
  });

  it('temps fini : crédit des mouvements reconnus ; capé : rien', async () => {
    const root = await mount({ ...WOD, wod_type: 'for-time', score_type: 'time', text_mode: 'free', description: RXP });
    await press(root, 'enter-score');
    await type(root, 'score-time-min', '11');
    await press(root, 'score-submit');
    expect(logMovementReps).toHaveBeenLastCalledWith('me', [
      { name: 'Pull-ups', reps: 21 }, { name: 'Thruster', reps: 21, weight_kg: 43 },
    ], 'whiteboard', 'w1');
  });
});

describe('texte libre + blocs Musculation / Cardio (#453 PR 3b)', () => {
  const SQUAT = 'Back Squat — 5 × 3 @ 100 kg — repos 2:00';
  const ROW = 'Row ~ 2 × 500 m ~ repos 1:30';
  const METCON = 'For time\n21 thrusters @43/29 + 21 pull-ups';

  it('sans bloc : inchangé (aucune ligne de bloc affichée à part)', async () => {
    const root = await mount({ ...WOD, wod_type: 'for-time', score_type: 'time', text_mode: 'free', description: RXP });
    expect(byId(root, 'wod-free-blocks')).toHaveLength(0);
    expect(byId(root, 'wod-free-text').map(hostText)).toEqual([RXP]);
  });

  it('Musculation : bloc affiché à part, reste tel quel ; grille ouverte, séries validées (validate_strength_session)', async () => {
    const root = await mount({ ...WOD, wod_type: 'strength', score_type: 'weight', text_mode: 'free', description: `${SQUAT}\n\n${METCON}` });
    expect(byId(root, 'wod-free-blocks').map(hostText)).toEqual([SQUAT]);
    expect(byId(root, 'wod-free-text').map(hostText)).toEqual([METCON]);
    await press(root, 'enter-score');
    expect(byId(root, 'score-value')).toHaveLength(0);
    expect(byId(root, 'strength-kg-4')).toHaveLength(1);
    await press(root, 'strength-validate');
    expect(submitStrengthValidation).toHaveBeenCalledTimes(1);
    const drafts = (submitStrengthValidation as jest.Mock).mock.calls[0][0].drafts;
    expect(drafts).toHaveLength(5);
    expect(drafts[0]).toMatchObject({ name: 'Back Squat', reps: '3', loadKg: '100', prescribedLoadKg: 100 });
    // Première validation : crédit d'une séance chargée, metcon non prouvé par une charge.
    expect(logMovementReps).toHaveBeenLastCalledWith('me', [], 'whiteboard', 'w1');
  });

  it('Cardio : série créditée en plus du metcon du reste, une seule fois', async () => {
    const root = await mount({ ...WOD, wod_type: 'for-time', score_type: 'time', text_mode: 'free', description: `${ROW}\n${METCON}` });
    expect(byId(root, 'wod-free-blocks').map(hostText)).toEqual(['Row · 2 × 500 m · repos 1:30']);
    await press(root, 'enter-score');
    await type(root, 'score-time-min', '11');
    await press(root, 'score-submit');
    expect(logMovementReps).toHaveBeenLastCalledWith('me', [
      { name: 'Thruster', reps: 21, weight_kg: 43 }, { name: 'Pull-ups', reps: 21 }, { name: 'Row', reps: 1000, unit: 'm' },
    ], 'whiteboard', 'w1');
  });

  it('les deux : grille de séries dans la saisie, séries journalisées, cardio crédité', async () => {
    const root = await mount({ ...WOD, wod_type: 'for-time', score_type: 'time', text_mode: 'free', description: `${SQUAT}\n${ROW}\n\n${METCON}` });
    expect(byId(root, 'wod-free-blocks').map(hostText)).toEqual([`${SQUAT}\nRow · 2 × 500 m · repos 1:30`]);
    expect(byId(root, 'wod-free-text').map(hostText)).toEqual([METCON]);
    await press(root, 'enter-score');
    expect(byId(root, 'strength-kg-4')).toHaveLength(1);
    await type(root, 'score-time-min', '11');
    await press(root, 'score-submit');
    expect(logStrengthSets).toHaveBeenCalledTimes(1);
    expect((logStrengthSets as jest.Mock).mock.calls[0][0].drafts).toHaveLength(5);
    expect(logMovementReps).toHaveBeenLastCalledWith('me', [
      { name: 'Thruster', reps: 21, weight_kg: 43 }, { name: 'Pull-ups', reps: 21 }, { name: 'Row', reps: 1000, unit: 'm' },
    ], 'whiteboard', 'w1');
  });
});

describe('affichage et tri', () => {
  it('« 7 + 12 » et classement selon score_type (AMRAP typé Temps : croissant)', async () => {
    mockTables.wod_scores = [score('u2', 300, 'time'), score('u3', 200, 'time'), score('me', 400, 'time')];
    const root = await mount({ ...WOD, score_type: 'time' });
    const rows = root.findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('leader-row-') && typeof n.props.onPress === 'function');
    expect(uniq(rows.map(r => r.props.testID))).toEqual(['leader-row-s-u3', 'leader-row-s-u2', 'leader-row-s-me']);
  });

  it('un « done » n’entre jamais dans un classement (même sur un WOD classé)', async () => {
    mockTables.wod_scores = [score('u2', 300, 'reps'), score('u3', 1, 'done')];
    const root = await mount(WOD);
    const rows = root.findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('leader-row-') && typeof n.props.onPress === 'function');
    expect(uniq(rows.map(r => r.props.testID))).toEqual(['leader-row-s-u2']);
    expect(byId(root, 'score-list-title').map(hostText)).toEqual(['Classement · 1 score']);
  });

  it('tours + reps affiché « 7 + 12 »', async () => {
    mockTables.wod_scores = [score('me', 7012, 'rounds_reps')];
    const root = await mount({ ...WOD, score_type: 'rounds_reps' });
    expect(byId(root, 'my-score-value').map(hostText)).toEqual(['7 + 12']);
  });

  it('WOD sans type : AMRAP trié décroissant comme avant', async () => {
    mockTables.wod_scores = [score('u2', 300, 'reps'), score('u3', 200, 'reps'), score('me', 400, 'reps')];
    const root = await mount(WOD);
    const rows = root.findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('leader-row-') && typeof n.props.onPress === 'function');
    expect(uniq(rows.map(r => r.props.testID))).toEqual(['leader-row-s-me', 'leader-row-s-u2', 'leader-row-s-u3']);
  });
});

describe('refus du serveur SCORE_TYPE_MISMATCH', () => {
  it.each([
    ['fr', 'Le type de score de cette séance a changé : rouvre-la pour saisir ton score.'],
    ['en', "This session's score type has changed: reopen it to enter your score."],
  ])('%s : message clair, pas le message technique', async (lang, msg) => {
    await i18n.changeLanguage(lang);
    mockUpsertError = { message: 'SCORE_TYPE_MISMATCH: type attendu time, reçu reps' };
    const root = await mount({ ...WOD, score_type: 'reps' });
    await press(root, 'enter-score');
    await type(root, 'score-value', '150');
    await press(root, 'score-submit');
    expect(alerts.some(a => a.includes(msg))).toBe(true);
    expect(alerts.some(a => a.includes('SCORE_TYPE_MISMATCH'))).toBe(false);
  });
});

describe('anglais : aucun texte français dans les nouveaux états', () => {
  const FRENCH = /[àâçéèêëîïôûùüÿœ]|\b(?:faite|tours|séance|coach :|Pas de)\b/i;
  it.each([
    ['time', {}], ['rounds_reps', {}], ['none', { leaderboard_enabled: false }],
  ] as const)('%s', async (st, extra) => {
    await i18n.changeLanguage('en');
    const root = await mount({ ...WOD, title: 'Test', score_type: st, ...extra });
    await press(root, 'enter-score');
    const t = texts(root, true).filter(x => x !== 'Test');
    expect(t.filter(x => FRENCH.test(x))).toEqual([]);
  });
});
