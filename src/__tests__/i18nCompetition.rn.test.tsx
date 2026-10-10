/**
 * Chantier anglais, groupe Compétition : mini-tournois, classements, inter-box
 * et saisie de score, montés avec le vrai react-native (données fictives, aucun réseau).
 * - FR : textes affichés, placeholders, libellés d'accessibilité et alertes
 *   identiques à l'instantané pris sur master avant la traduction
 *   (i18nCompetitionAvant.json ; I18N_COMPETITION_CAPTURE=<fichier> pour le reprendre).
 * - EN : aucun texte accentué, et aucun texte resté identique au français hors
 *   données fictives et libellés identiques par nature (RX, ELO, BYE…).
 */
process.env.TZ = 'UTC';
import React from 'react';
import { Alert, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../i18n';
import BEFORE from './i18nCompetitionAvant.json';
import DailyTournamentsScreen from '../screens/tournament/DailyTournamentsScreen';
import DailyTournamentDetailScreen from '../screens/tournament/DailyTournamentDetailScreen';
import LeaderboardScreen from '../screens/leaderboard/LeaderboardScreen';
import BoxRankingScreen from '../screens/leaderboard/BoxRankingScreen';
import InterCompetitionDetailScreen from '../screens/competition/InterCompetitionDetailScreen';
import InterScoreSubmitScreen from '../screens/competition/InterScoreSubmitScreen';
import TournamentBracketView from '../screens/competition/TournamentBracketView';
import TournamentWODScreen from '../screens/competition/TournamentWODScreen';
import { getScaledMovements } from '../utils/wodScaling';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { strictAllowed } = require('../../scripts/i18n/scanner');

type Row = Record<string, unknown>;
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: Record<string, unknown> | undefined;
let mockDb: Record<string, Row[]> = {};
let mockWriteError: { message: string } | null = null;
let mockRpcError: { message: string } | null = null;
let mockGender: string | null = 'male';

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn(), canGoBack: () => true }),
    useRoute: () => ({ params: mockParams }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
  };
});
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 0, useTabBarFootprint: () => 0 }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
const mockAuth = {
  user: { id: 'me', username: 'Sam', level: 'rx', avatar_url: null, gender: 'male', elo: 1200 },
  currentBox: { id: 'box1', name: 'Iron Lab' } as { id: string; name: string } | null,
};
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').lightTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/haptics', () => ({ hapticSuccess: jest.fn(), hapticLight: jest.fn() }));
jest.mock('../lib/analytics', () => ({
  trackDailyTournamentJoin: jest.fn(), trackDailyTournamentCreate: jest.fn(), trackDailyTournamentScoreSubmit: jest.fn(),
  trackInterCompRegister: jest.fn(), trackInterCompScoreSubmit: jest.fn(), trackTournamentScoreSubmit: jest.fn(),
}));
jest.mock('../services/myProfile', () => ({ fetchMyProfile: async () => ({ gender: mockGender, level: 'rx', elo: 1200 }) }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn(async () => {}) }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}), logMovementReps: jest.fn(async () => {}) }));
jest.mock('../utils/eloLevels', () => ({ ...jest.requireActual('../utils/eloLevels'), syncLevelAndBadges: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let rows = [...(mockDb[table] ?? [])];
    let write = false;
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'neq', 'in', 'or', 'filter', 'ilike', 'order', 'limit', 'range', 'gte', 'lte', 'not', 'is']) b[m] = () => b;
    for (const m of ['insert', 'upsert', 'update', 'delete']) b[m] = () => { write = true; return b; };
    b.eq = (col: string, val: unknown) => { rows = rows.filter((r) => r[col] === undefined || r[col] === val); return b; };
    const result = () => (write && mockWriteError ? { data: null, error: mockWriteError } : { data: rows, error: null, count: rows.length });
    b.single = () => Promise.resolve(write && mockWriteError ? { data: null, error: mockWriteError } : { data: rows[0] ?? null, error: null });
    b.maybeSingle = b.single;
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
    return b;
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: async () => ({ data: null, error: mockRpcError }),
      channel: () => channel,
      removeChannel: jest.fn(),
    },
  };
});
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-09-28T10:00:00Z');
const inH = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();

// ── Données fictives neutres (noms de tournois et contenus, jamais traduits)
const T_OPEN = {
  id: 't1', creator_id: 'u2', wod_name: 'Flash Burner', wod_type: 'For Time', duration: 12, level: 'rx',
  movements: '21-15-9\nThrusters 43 kg\nPull-ups', score_mode: 'time', gender_target: 'mix', status: 'open',
  max_players: 5, elo_reward: 30, is_official: false, ends_at: inH(3.42), created_at: inH(-2),
  participants: [{ user_id: 'me' }, { user_id: 'u2' }], scores: [], creator: { username: 'Max' },
};
const T_FULL = {
  ...T_OPEN, id: 't2', wod_name: 'Big Engine', wod_type: 'AMRAP', level: 'elite', gender_target: 'female', score_mode: 'reps',
  participants: ['a', 'b', 'c', 'd', 'e'].map((u) => ({ user_id: u })), ends_at: inH(-1), creator: { username: 'Lea' },
};
const T_SCORED = {
  ...T_OPEN, id: 't3', wod_name: 'Express', wod_type: 'EMOM', level: 'scaled', duration: 10, score_mode: 'reps',
  participants: [{ user_id: 'me' }], scores: [{ user_id: 'me' }], creator: null,
};
const PARTS = (tid: string) => [
  { tournament_id: tid, user_id: 'me', profile: { username: 'Sam', level: 'rx', elo: 1200 } },
  { tournament_id: tid, user_id: 'u2', profile: { username: 'Lea', level: 'elite', elo: 1500 } },
  { tournament_id: tid, user_id: 'u3', profile: { username: 'Karim', level: 'scaled', elo: 900 } },
  { tournament_id: tid, user_id: 'u4', profile: null },
];
const SCORES = (tid: string, withMe = false) => [
  ...(withMe ? [{ tournament_id: tid, user_id: 'me', score_value: 320, capped: false, rx: true, submitted_at: inH(-0.5), video_url: null, status: 'validated' }] : []),
  { tournament_id: tid, user_id: 'u2', score_value: 305, capped: false, rx: true, submitted_at: inH(-1), video_url: 'https://youtu.be/abc', status: 'pending' },
  { tournament_id: tid, user_id: 'u3', score_value: 150, capped: true, rx: false, submitted_at: inH(-1), video_url: null, status: 'contested' },
];
function daily(t: Row, opts: { joined?: boolean; scored?: boolean; elo?: boolean } = {}) {
  mockDb = {
    daily_tournaments: [t],
    daily_tournament_participants: PARTS(String(t.id)).filter((p) => opts.joined !== false || p.user_id !== 'me'),
    daily_tournament_scores: SCORES(String(t.id), opts.scored),
    daily_tournament_elo_history: opts.elo ? [
      { tournament_id: t.id, user_id: 'me', elo_delta: 24 }, { tournament_id: t.id, user_id: 'u2', elo_delta: -8 },
    ] : [],
  };
  mockParams = { tournamentId: t.id };
}
const T_REPS = { ...T_OPEN, id: 't4', wod_type: 'AMRAP', score_mode: 'reps', movements: '5 pull-ups\n10 push-ups', duration: 10, gender_target: 'female' };
const T_DONE = { ...T_OPEN, id: 't5', status: 'completed', ends_at: inH(-2) };
const T_OFFICIAL = { ...T_OPEN, id: 't6', is_official: true, wod_name: 'Cindy', wod_type: 'AMRAP', score_mode: 'reps', movements: '20 min AMRAP\n5 pull-ups', movements_scaled: null };
const T_WEIGHT = { ...T_OPEN, id: 't7', score_mode: 'weight' };
const T_ROUNDS = { ...T_OPEN, id: 't8', score_mode: 'rounds' };

const COMP = {
  id: 'c1', title: 'Box Battle', description: 'Three WODs', rules: 'Games standards', format: 'bracket', type: 'individual',
  team_size: 1, status: 'active', starts_at: '2026-10-10T09:00:00Z', ends_at: '2026-10-31T18:00:00Z', max_participants: 64, created_at: inH(-48),
};
const PROFILES = [{ id: 'me', username: 'Sam' }, { id: 'u2', username: 'Lea' }, { id: 'u3', username: 'Karim' }, { id: 'u4', username: 'Tom' }];
function inter(comp: Row, extra: Record<string, Row[]> = {}) {
  mockDb = {
    inter_competitions: [comp],
    inter_competition_wods: [{ id: 'w1', competition_id: comp.id, order_index: 1, title: 'Chipper', description: '50 wall balls', time_cap: 15, scoring_type: 'time', revealed_at: inH(-72) }],
    inter_registrations: [{ id: 'r1', competition_id: comp.id, athlete_id: 'me', team_id: null }],
    inter_scores: [], inter_standings: [], inter_teams: [], profiles: PROFILES, ...extra,
  };
  mockParams = { competitionId: comp.id };
}
const BRACKET = {
  inter_bracket_matches: [
    { id: 'm1', competition_id: 'c1', round: 1, match_number: 1, participant1_id: 'me', participant2_id: 'u2', status: 'pending', winner_id: null, wod_id: 'w1' },
    { id: 'm3', competition_id: 'c1', round: 2, match_number: 1, participant1_id: 'u3', participant2_id: null, status: 'bye', winner_id: 'u3', wod_id: null },
  ],
};
const POOLS = {
  inter_pool_groups: [{ id: 'g1', competition_id: 'c1', group_index: 0, group_name: 'Group A' }],
  inter_pool_members: ['me', 'u2'].map((a, i) => ({ id: `pm${i}`, competition_id: 'c1', group_id: 'g1', athlete_id: a, points: 3 - i * 3, wins: 1 - i, draws: 0, losses: i, score_for: 5, score_against: 3 })),
  inter_pool_matches: [
    { id: 'pq1', competition_id: 'c1', group_id: 'g1', athlete1_id: 'me', athlete2_id: 'u2', status: 'completed', score1: 5, score2: 3, winner_id: 'me' },
    { id: 'pq2', competition_id: 'c1', group_id: 'g1', athlete1_id: 'u3', athlete2_id: null, status: 'bye', score1: null, score2: null, winner_id: 'u3' },
  ],
};
const SWISS = {
  inter_swiss_rounds: [{ id: 'sr1', competition_id: 'c1', round_number: 1, status: 'completed' }],
  inter_swiss_pairings: [
    { id: 'sp1', competition_id: 'c1', round_id: 'sr1', athlete1_id: 'me', athlete2_id: 'u2', status: 'completed', score1: 2, score2: 1, winner_id: 'me' },
    { id: 'sp2', competition_id: 'c1', round_id: 'sr1', athlete1_id: 'u3', athlete2_id: null, status: 'bye', score1: null, score2: null, winner_id: 'u3' },
  ],
  inter_swiss_standings: ['me', 'u2', 'u3'].map((a, i) => ({ id: `ss${i}`, competition_id: 'c1', athlete_id: a, points: 3 - i, wins: 1, draws: 0, losses: 0, buchholz: 2 })),
};
const LB_PROFILES = [
  { id: 'u2', username: 'Lea', level: 'elite', elo: 1500, wins: 10, total_matches: 14, avatar_url: null },
  { id: 'me', username: 'Sam', level: 'rx', elo: 1200, wins: 3, total_matches: 5, avatar_url: null },
  { id: 'u3', username: 'Karim', level: 'scaled', elo: 900, wins: 0, total_matches: 0, avatar_url: null },
];
const TEAMS = {
  inter_teams: [{ id: 'tm1', name: 'Rack Pack', box_id: 'b1', captain_id: 'me' }, { id: 'tm2', name: 'Solo Crew', box_id: null, captain_id: 'u3' }],
  inter_team_members: [{ team_id: 'tm1', user_id: 'u2', status: 'accepted' }],
  boxes: [{ id: 'b1', name: 'Iron Lab', city: 'Boston' }, { id: 'b2', name: 'North Gym', city: null }],
  box_members: [{ box_id: 'b1', member_id: 'u2' }, { box_id: 'b1', member_id: 'me' }, { box_id: 'b2', member_id: 'u3' }],
};
const RANKING = {
  box_members: [
    { member_id: 'u2', profiles: { id: 'u2', username: 'Lea', avatar_url: null, level: 'elite' } },
    { member_id: 'me', profiles: { id: 'me', username: 'Sam', avatar_url: null, level: 'rx' } },
    { member_id: 'u3', profiles: null },
    { member_id: 'u4', profiles: { id: 'u4', username: 'Tom', avatar_url: null, level: 'scaled' } },
  ],
  box_elo: [{ member_id: 'u2', elo: 1320, matches: 12, wins: 7 }, { member_id: 'me', elo: 1210, matches: 1, wins: 1 }, { member_id: 'u3', elo: 1100, matches: 0, wins: 0 }],
};
const SCORE_PARAMS = { competitionId: 'c1', wodId: 'w1', wodTitle: 'Chipper', wodDescription: '50 wall balls', timeCap: 15, scoringType: 'time', existingScore: null };
const TOUR_WOD = { id: 'tw1', title: 'Engine', type: 'amrap', description: '10 cal row\n10 burpees', time_cap: 12, reps_per_round: 20, opens_at: inH(-1), closes_at: inH(30) };
const bracketMatch = (i: number, status: string) => ({
  id: `bm${i}`, round: 1, side: 'winner', match_number: i, participant1_id: 'u2', participant2_id: status === 'bye' ? null : 'u3',
  winner_id: status === 'bye' ? 'u2' : null, loser_id: null, status, wod_id: null,
});

let renderer: TestRenderer.ReactTestRenderer | undefined;
let alerts: string[] = [];
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    alerts.push(['ALERTE', title, message ?? '', ...(buttons ?? []).map((b) => b.text ?? '')].join(' | '));
  });
  mockParams = undefined;
  mockDb = {};
  mockWriteError = null;
  mockRpcError = null;
  mockGender = 'male';
  mockAuth.currentBox = { id: 'box1', name: 'Iron Lab' };
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = undefined; }
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
afterAll(async () => { await i18n.changeLanguage('fr'); });

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
function collect(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance, inModal: boolean) => {
    if (n.type === Modal && !inModal) return;
    if (typeof n.type === 'string') {
      if (typeof n.props.placeholder === 'string') out.push(`placeholder: ${n.props.placeholder}`);
      if (typeof n.props.accessibilityLabel === 'string') out.push(`a11y: ${n.props.accessibilityLabel}`);
    }
    if (isHostText(n)) {
      if (n.props.accessibilityElementsHidden) return;
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
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
async function mount(el: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await act(async () => { renderer = TestRenderer.create(<QueryClientProvider client={client}>{el}</QueryClientProvider>); });
  await settle();
  return renderer!.root;
}
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await act(async () => { await n.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
async function pressText(root: ReactTestInstance, texts: { fr: string; en: string }) {
  const text = i18n.language === 'en' ? texts.en : texts.fr;
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
  if (!t) throw new Error(`texte introuvable : ${text}`);
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
async function type(root: ReactTestInstance, id: string, text: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onChangeText === 'function')[0];
  if (!n) throw new Error(`champ introuvable : ${id}`);
  await act(async () => { n.props.onChangeText(text); });
  await settle();
}
const typeIn = async (root: ReactTestInstance, placeholder: string, text: string) => {
  const n = root.findAll((x) => typeof x.props.onChangeText === 'function' && typeof x.type === 'string' && (x.props.placeholder === placeholder))[0];
  if (!n) throw new Error(`champ introuvable : ${placeholder}`);
  await act(async () => { n.props.onChangeText(text); });
  await settle();
};
const TAB = {
  teams: { fr: 'Équipes', en: 'Teams' },
  box: { fr: 'Box', en: 'Box' },
  bracket: { fr: 'Élimination', en: 'Elimination' },
  pool: { fr: 'Poules', en: 'Pools' },
  swiss: { fr: 'Suisse', en: 'Swiss' },
};

type Variant = { name: string; run: () => Promise<ReactTestInstance> };
const VARIANTS: Variant[] = [
  // ── Mini-tournois : liste et création
  { name: 'mini-liste', run: () => { mockDb = { daily_tournaments: [T_OPEN, T_FULL, T_SCORED] }; return mount(<DailyTournamentsScreen />); } },
  { name: 'mini-liste-vide', run: () => { mockDb = { daily_tournaments: [] }; return mount(<DailyTournamentsScreen />); } },
  { name: 'mini-creation', run: async () => {
    mockDb = { daily_tournaments: [] };
    const root = await mount(<DailyTournamentsScreen />);
    await press(root, 'header-create');
    return root;
  } },
  { name: 'mini-creation-erreur', run: async () => {
    mockDb = { daily_tournaments: [] };
    mockWriteError = { message: 'boom' };
    const root = await mount(<DailyTournamentsScreen />);
    await press(root, 'header-create');
    await type(root, 'mini-form-name', 'Engine');
    await type(root, 'mini-form-movements', '10 burpees');
    await press(root, 'mini-form-create');
    return root;
  } },
  { name: 'mini-liste-rejoindre-genre', run: async () => {
    mockDb = { daily_tournaments: [{ ...T_OPEN, participants: [], gender_target: 'female' }] };
    const root = await mount(<DailyTournamentsScreen />);
    await press(root, 'mini-join-t1');
    mockGender = null;
    await press(root, 'mini-join-t1');
    mockGender = 'female';
    mockWriteError = { message: 'boom' };
    await press(root, 'mini-join-t1');
    return root;
  } },
  // ── Détail d'un mini-tournoi
  { name: 'mini-detail-ouvert', run: () => { daily(T_OPEN, { joined: false }); return mount(<DailyTournamentDetailScreen />); } },
  { name: 'mini-detail-rejoindre-genre', run: async () => {
    daily(T_REPS, { joined: false });
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-join');
    mockGender = null;
    await press(root, 'mini-join');
    mockGender = 'female';
    mockWriteError = { message: 'boom' };
    await press(root, 'mini-join');
    return root;
  } },
  { name: 'mini-detail-inscrit', run: () => { daily(T_OPEN); return mount(<DailyTournamentDetailScreen />); } },
  { name: 'mini-detail-valider', run: async () => {
    daily(T_OPEN);
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-validate-u2');
    mockRpcError = { message: 'boom' };
    await press(root, 'mini-validate-u2');
    return root;
  } },
  { name: 'mini-detail-contester', run: async () => {
    daily(T_OPEN);
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-contest-u2');
    return root;
  } },
  { name: 'mini-detail-contester-envoye', run: async () => {
    daily(T_OPEN);
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-contest-u2');
    await press(root, 'mini-contest-confirm');
    mockRpcError = { message: 'boom' };
    await press(root, 'mini-contest-u2');
    await press(root, 'mini-contest-confirm');
    return root;
  } },
  { name: 'mini-detail-video', run: async () => {
    daily(T_OPEN);
    const root = await mount(<DailyTournamentDetailScreen />);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Linking } = require('react-native');
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('nope')).mockRejectedValueOnce({});
    await press(root, 'mini-video-u2');
    await press(root, 'mini-video-u2');
    await press(root, 'mini-video-u2');
    return root;
  } },
  { name: 'mini-detail-saisie-temps', run: async () => {
    daily(T_OPEN);
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-manual');
    return root;
  } },
  { name: 'mini-detail-saisie-cap', run: async () => {
    daily(T_OPEN);
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-manual');
    await press(root, 'mini-score-capped');
    await act(async () => { root.findAll((x) => x.props.testID === 'mini-score-capped' && typeof x.props.onValueChange === 'function')[0].props.onValueChange(true); });
    await settle();
    return root;
  } },
  { name: 'mini-detail-saisie-reps-alertes', run: async () => {
    daily(T_REPS);
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-manual');
    await typeIn(root, '150', '0');
    await press(root, 'mini-score-submit');
    await typeIn(root, '150', '99999');
    await press(root, 'mini-score-submit');
    await typeIn(root, '150', '50');
    await type(root, 'mini-score-video', 'youtube.com/x');
    await press(root, 'mini-score-submit');
    await type(root, 'mini-score-video', '');
    mockWriteError = { message: 'boom' };
    await press(root, 'mini-score-submit');
    return root;
  } },
  { name: 'mini-detail-saisie-poids', run: async () => {
    daily(T_WEIGHT);
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-manual');
    return root;
  } },
  { name: 'mini-detail-saisie-rounds', run: async () => {
    daily(T_ROUNDS);
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-manual');
    return root;
  } },
  { name: 'mini-detail-score-soumis', run: () => { daily(T_OPEN, { scored: true }); return mount(<DailyTournamentDetailScreen />); } },
  { name: 'mini-detail-termine', run: () => { daily(T_DONE, { scored: true, elo: true }); return mount(<DailyTournamentDetailScreen />); } },
  { name: 'mini-detail-officiel', run: () => { daily(T_OFFICIAL, { joined: false }); return mount(<DailyTournamentDetailScreen />); } },
  { name: 'mini-detail-officiel-scaled', run: async () => {
    daily(T_OFFICIAL, { joined: false });
    const root = await mount(<DailyTournamentDetailScreen />);
    await press(root, 'mini-board-scaled');
    return root;
  } },
  // ── Classements
  { name: 'classement-individuel', run: () => { mockDb = { profiles: LB_PROFILES }; return mount(<LeaderboardScreen />); } },
  { name: 'classement-individuel-vide', run: () => { mockDb = { profiles: [] }; return mount(<LeaderboardScreen />); } },
  { name: 'classement-equipes', run: async () => {
    mockDb = { profiles: LB_PROFILES, ...TEAMS };
    const root = await mount(<LeaderboardScreen />);
    await pressText(root, TAB.teams);
    return root;
  } },
  { name: 'classement-equipes-vide', run: async () => {
    mockDb = { profiles: LB_PROFILES };
    const root = await mount(<LeaderboardScreen />);
    await pressText(root, TAB.teams);
    return root;
  } },
  { name: 'classement-box', run: async () => {
    mockDb = { profiles: LB_PROFILES, ...TEAMS };
    const root = await mount(<LeaderboardScreen />);
    await pressText(root, TAB.box);
    return root;
  } },
  { name: 'classement-box-vide', run: async () => {
    mockDb = { profiles: LB_PROFILES };
    const root = await mount(<LeaderboardScreen />);
    await pressText(root, TAB.box);
    return root;
  } },
  { name: 'classement-de-la-box', run: () => { mockDb = { ...RANKING }; return mount(<BoxRankingScreen />); } },
  { name: 'classement-de-la-box-vide', run: () => { mockDb = { box_members: [], box_elo: [] }; return mount(<BoxRankingScreen />); } },
  { name: 'classement-de-la-box-sans-box', run: () => { mockAuth.currentBox = null; mockDb = {}; return mount(<BoxRankingScreen />); } },
  // ── Inter-box
  { name: 'inter-bracket', run: async () => {
    inter(COMP, BRACKET);
    const root = await mount(<InterCompetitionDetailScreen />);
    await pressText(root, TAB.bracket);
    return root;
  } },
  { name: 'inter-poules', run: async () => {
    inter({ ...COMP, format: 'pool' }, POOLS);
    const root = await mount(<InterCompetitionDetailScreen />);
    await pressText(root, TAB.pool);
    return root;
  } },
  { name: 'inter-suisse', run: async () => {
    inter({ ...COMP, format: 'swiss' }, SWISS);
    const root = await mount(<InterCompetitionDetailScreen />);
    await pressText(root, TAB.swiss);
    return root;
  } },
  { name: 'inter-saisie-score', run: () => { mockDb = {}; mockParams = SCORE_PARAMS; return mount(<InterScoreSubmitScreen />); } },
  // ── Tournoi : tableau et WOD
  { name: 'tournoi-tableau', run: () => {
    mockDb = { tournament_bracket_matches: [bracketMatch(1, 'pending'), bracketMatch(2, 'bye')], tournament_wods: [], profiles: PROFILES };
    return mount(<TournamentBracketView tournamentId="tt" format="bracket" />);
  } },
  { name: 'tournoi-wod-detail', run: () => {
    mockDb = {};
    mockParams = { tournamentId: 'tt', tournamentName: 'Fall Cup', wod: TOUR_WOD,
      existingScore: { id: 'x', score_value: 87, capped: false, status: 'pending', video_url: null, notes: null } };
    return mount(<TournamentWODScreen />);
  } },
  { name: 'tournoi-wod-saisie', run: async () => {
    mockDb = {};
    mockParams = { tournamentId: 'tt', tournamentName: 'Fall Cup', wod: TOUR_WOD,
      existingScore: { id: 'x', score_value: 87, capped: false, status: 'pending', video_url: null, notes: null } };
    const root = await mount(<TournamentWODScreen />);
    await press(root, 'tourwod-submit-manual');
    return root;
  } },
];

function dataTexts(): Set<string> {
  const out = new Set<string>();
  (function walk(v: unknown) {
    if (typeof v === 'string') [v, ...v.split('\n')].forEach((l) => out.add(l.toLowerCase()));
    else if (v && typeof v === 'object') { Object.keys(v).forEach(walk); Object.values(v).forEach(walk); }
    // Prescription Scaled du WOD du Jour : contenu d'entraînement (wodScaling.ts), traduit avec le moteur.
  })([mockDb, mockParams, mockAuth, getScaledMovements(T_OFFICIAL.wod_name, T_OFFICIAL.movements)]);
  return out;
}
/** Un texte de données : chaque morceau (ligne, « , », « — ») est une donnée, ou n'a pas de lettre. */
const isData = (DATA: Set<string>, s: string) =>
  s.replace(/\s*👈$/u, '').split(/\n|, | — /).map((l) => l.trim()).every((l) => !/\p{L}/u.test(l) || DATA.has(l.toLowerCase()));
/** Libellés identiques dans les deux langues : termes techniques, niveaux, noms propres, mots identiques. */
const SAME_IN_EN = [
  /^(Box|Scaled|SCALED|RX|SC|Mix|Bracket|Infos|Type|Score|Rounds)$/i,
  /^(SCALED|INTER|RX\+?|ELITE|PRO)$/, // niveaux d'athlète
  /^(MM|SS|VS|BYE|· BYE)$/,
  /^CAP \+ \d+ reps$/, /^ROUND \d+$/, /^\d+ (pts|rnds)$/, /^\d+ MIN CAP$/,
  /^https:\/\/youtube\.com\//,
  /^21-15-9\nThrusters/, // exemple de mouvements, identique en anglais
  /^Top: /, // « Top: » suivi d'un nom, identique en anglais (leaderboard.top)
];
const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;

describe('Compétition, français : textes identiques à master', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const current = collect(await v.run());
    if (process.env.I18N_COMPETITION_CAPTURE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      const file = process.env.I18N_COMPETITION_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(current).toEqual(before);
  });
});

describe('Compétition, anglais : aucun texte français', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  afterAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const en = collect(await v.run());
    const DATA = dataTexts();
    const fr = (BEFORE as Record<string, string[]>)[name];
    const strip = (s: string) => s.replace(/^(placeholder|a11y): /, '').replace(/^ALERTE \| /, '');
    const shown = en.filter((s) => s !== '── fenêtre ──');
    const french = shown.filter((s) => ACCENT.test(strip(s)) && !isData(DATA, strip(s)));
    const frSet = new Set(fr.map((s) => s.toLowerCase()));
    const unchanged = shown.filter((s) => frSet.has(s.toLowerCase()) && /\p{L}{2,}/u.test(strip(s))
      && !isData(DATA, strip(s)) && !strictAllowed(strip(s))
      && !SAME_IN_EN.some((re) => re.test(strip(s))));
    expect({ name, french, unchanged }).toEqual({ name, french: [], unchanged: [] });
  });
});
