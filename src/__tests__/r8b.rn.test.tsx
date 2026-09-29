process.env.TZ = 'UTC';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import { lightTheme, darkTheme } from '../theme/palette';
import BEFORE from './r8bStructureBefore.json';
import { AxButton, AxCard, AxChip, AxStatusDot, AxTag, AxTextField } from '../components/ax';
import { axTypography } from '../theme/axTokens';
import { contrast } from '../theme/contrast';
import DailyTournamentsScreen from '../screens/tournament/DailyTournamentsScreen';
import DailyTournamentDetailScreen from '../screens/tournament/DailyTournamentDetailScreen';
import InterCompetitionListScreen from '../screens/competition/InterCompetitionListScreen';
import InterCompetitionDetailScreen from '../screens/competition/InterCompetitionDetailScreen';
import InterScoreSubmitScreen from '../screens/competition/InterScoreSubmitScreen';
import InterTeamScreen from '../screens/competition/InterTeamScreen';
import PhysicalCompetitionScreen from '../screens/competition/PhysicalCompetitionScreen';

type Row = Record<string, unknown>;
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockTheme = lightTheme;
let mockParams: Record<string, unknown> | undefined;
let mockDb: Record<string, Row[]> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];
const mockRpc = jest.fn(async (..._a: unknown[]) => ({ data: null, error: null }));

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() }),
    useRoute: () => ({ params: mockParams }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
  };
});
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 120 }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
const mockAuth = {
  user: { id: 'me', username: 'Nab', level: 'rx', avatar_url: null, gender: 'male', elo: 1200 },
  currentBox: { id: 'box1', name: 'CrossFit Lyon' },
};
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/haptics', () => ({ hapticSuccess: jest.fn(), hapticLight: jest.fn() }));
jest.mock('../lib/analytics', () => ({
  trackDailyTournamentJoin: jest.fn(), trackDailyTournamentCreate: jest.fn(), trackDailyTournamentScoreSubmit: jest.fn(),
  trackInterCompRegister: jest.fn(), trackInterCompScoreSubmit: jest.fn(),
}));
jest.mock('../services/myProfile', () => ({ fetchMyProfile: async () => ({ gender: 'male', level: 'rx', elo: 1200 }) }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../utils/eloLevels', () => ({ ...jest.requireActual('../utils/eloLevels'), syncLevelAndBadges: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let rows = [...(mockDb[table] ?? [])];
    const b: Record<string, unknown> = {};
    const log = (m: string, args: unknown[]) => mockCalls.push({ table, method: m, args });
    for (const m of ['select', 'neq', 'in', 'or', 'filter', 'ilike', 'order', 'limit', 'gte', 'lte', 'not', 'is',
      'insert', 'upsert', 'update', 'delete']) {
      b[m] = (...args: unknown[]) => { log(m, args); return b; };
    }
    b.eq = (col: string, val: unknown) => {
      log('eq', [col, val]);
      rows = rows.filter((r) => r[col] === undefined || r[col] === val);
      return b;
    };
    b.single = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    b.maybeSingle = b.single;
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(res, rej);
    return b;
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: (...a: unknown[]) => mockRpc(...a),
      channel: () => channel,
      removeChannel: jest.fn(),
    },
  };
});
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-09-28T10:00:00Z');
const LONG = 'Un intitulé particulièrement long pour vérifier qu’aucun texte ne déborde à 390 px';
const inH = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();

// ── Mini-tournois
const T_OPEN = {
  id: 't1', creator_id: 'u2', wod_name: 'Flash Burner', wod_type: 'For Time', duration: 12, level: 'rx',
  movements: '21-15-9\nThrusters 43 kg\nPull-ups', score_mode: 'time', gender_target: 'mix', status: 'open',
  max_players: 5, elo_reward: 30, is_official: false, ends_at: inH(3.42), created_at: inH(-2),
  participants: [{ user_id: 'me' }, { user_id: 'u2' }], scores: [], creator: { username: 'Coach Max' },
};
const T_FULL = {
  ...T_OPEN, id: 't2', wod_name: LONG, wod_type: 'AMRAP', level: 'elite', gender_target: 'female', score_mode: 'reps',
  participants: ['a', 'b', 'c', 'd', 'e'].map((u) => ({ user_id: u })), ends_at: inH(-1), creator: { username: 'Léa' },
};
const T_SCORED = {
  ...T_OPEN, id: 't3', wod_name: 'EMOM Express', wod_type: 'EMOM', level: 'scaled', duration: 10, score_mode: 'reps',
  participants: [{ user_id: 'me' }], scores: [{ user_id: 'me' }], creator: null,
};
const PARTS = (tid: string) => [
  { tournament_id: tid, user_id: 'me', profile: { username: 'Nab', level: 'rx', elo: 1200 } },
  { tournament_id: tid, user_id: 'u2', profile: { username: 'Léa', level: 'elite', elo: 1500 } },
  { tournament_id: tid, user_id: 'u3', profile: { username: LONG, level: 'scaled', elo: 900 } },
  { tournament_id: tid, user_id: 'u4', profile: { username: 'Sam', level: 'inter', elo: 1000 } },
];
const SCORES = (tid: string, withMe = false) => [
  ...(withMe ? [{ tournament_id: tid, user_id: 'me', score_value: 320, capped: false, rx: true, submitted_at: inH(-0.5), video_url: null, status: 'validated' }] : []),
  { tournament_id: tid, user_id: 'u2', score_value: 305, capped: false, rx: true, submitted_at: inH(-1), video_url: 'https://youtu.be/abc', status: 'pending' },
  { tournament_id: tid, user_id: 'u3', score_value: 150, capped: true, rx: false, submitted_at: inH(-1), video_url: null, status: 'validated' },
];
function dailyDetail(t: Row, opts: { joined?: boolean; scored?: boolean; elo?: boolean } = {}) {
  const parts = PARTS(String(t.id)).filter((p) => opts.joined !== false || p.user_id !== 'me');
  mockDb = {
    daily_tournaments: [t],
    daily_tournament_participants: parts,
    daily_tournament_scores: SCORES(String(t.id), opts.scored),
    daily_tournament_elo_history: opts.elo ? [
      { tournament_id: t.id, user_id: 'me', elo_delta: 24 }, { tournament_id: t.id, user_id: 'u2', elo_delta: 8 },
      { tournament_id: t.id, user_id: 'u3', elo_delta: -12 },
    ] : [],
  };
  mockParams = { tournamentId: t.id };
}

// ── Inter-box
const COMP = {
  id: 'c1', title: 'Battle des Box', description: 'Trois WODs, une seule couronne.', rules: 'Standards CrossFit Games.',
  format: 'league', type: 'individual', team_size: 1, status: 'open', starts_at: '2026-10-10T09:00:00Z',
  ends_at: '2026-10-31T18:00:00Z', max_participants: 64, created_at: inH(-48),
};
const COMP2 = { ...COMP, id: 'c2', title: LONG, format: 'bracket', type: 'team', team_size: 3, status: 'active', max_participants: null, description: null };
const PROFILES = [
  { id: 'me', username: 'Nab' }, { id: 'u2', username: 'Léa' }, { id: 'u3', username: LONG }, { id: 'u4', username: 'Sam' },
];
const WODS = [
  { id: 'w1', competition_id: 'c1', order_index: 1, title: 'Chipper', description: '50 Wall Balls\n40 Burpees', time_cap: 15, scoring_type: 'time', revealed_at: inH(-72) },
  { id: 'w2', competition_id: 'c1', order_index: 2, title: 'Secret', description: null, time_cap: null, scoring_type: 'reps', revealed_at: inH(72) },
  { id: 'w3', competition_id: 'c1', order_index: 3, title: LONG, description: 'AMRAP 12', time_cap: 12, scoring_type: 'reps', revealed_at: inH(-24) },
];
function interDetail(comp: Row, extra: Record<string, Row[]> = {}, registered = true) {
  mockDb = {
    inter_competitions: [comp],
    inter_competition_wods: WODS.map((w) => ({ ...w, competition_id: comp.id })),
    inter_registrations: registered ? [{ id: 'r1', competition_id: comp.id, athlete_id: 'me', team_id: null }] : [],
    inter_scores: [{ id: 's1', competition_id: comp.id, wod_id: 'w1', athlete_id: 'me', score_display: '12:34', score_value: 754, status: 'pending' }],
    inter_standings: [
      { competition_id: comp.id, wod_id: 'w1', rank: 1, athlete_id: 'u2', username: 'Léa', box_name: 'CrossFit Nice', score_display: '10:02' },
      { competition_id: comp.id, wod_id: 'w1', rank: 2, athlete_id: 'me', username: 'Nab', box_name: null, score_display: '12:34' },
      { competition_id: comp.id, wod_id: 'w1', rank: 4, athlete_id: 'u3', username: LONG, box_name: LONG, score_display: '14:59' },
    ],
    inter_teams: [],
    profiles: PROFILES,
    ...extra,
  };
  mockParams = { competitionId: comp.id };
}
const LEAGUE = {
  inter_league_rounds: [
    { id: 'lr1', competition_id: 'c1', round_number: 1, title: null, status: 'completed', wod_id: 'w1' },
    { id: 'lr2', competition_id: 'c1', round_number: 2, title: 'Journée finale', status: 'active', wod_id: 'w3' },
  ],
  inter_league_standings: ['me', 'u2', 'u3', 'u4'].map((a, i) => ({
    id: `ls${i}`, competition_id: 'c1', athlete_id: a, wins: 3 - i, podiums: 4 - i, rounds_played: 4, total_points: 100 - i * 10,
  })),
};
const BRACKET = {
  inter_bracket_matches: [
    { id: 'm1', competition_id: 'c1', round: 1, match_number: 1, participant1_id: 'me', participant2_id: 'u2', status: 'pending', winner_id: null, wod_id: 'w1' },
    { id: 'm2', competition_id: 'c1', round: 1, match_number: 2, participant1_id: 'u3', participant2_id: 'u4', status: 'completed', winner_id: 'u3', wod_id: 'w1' },
    { id: 'm3', competition_id: 'c1', round: 2, match_number: 1, participant1_id: 'u3', participant2_id: null, status: 'bye', winner_id: 'u3', wod_id: null },
  ],
};
const POOLS = {
  inter_pool_groups: [{ id: 'g1', competition_id: 'c1', group_index: 0, group_name: 'Poule A' }],
  inter_pool_members: ['me', 'u2', 'u3'].map((a, i) => ({
    id: `pm${i}`, competition_id: 'c1', group_id: 'g1', athlete_id: a, points: 6 - i * 3, wins: 2 - i, draws: 0, losses: i, score_for: 10, score_against: 4 + i,
  })),
  inter_pool_matches: [
    { id: 'pq1', competition_id: 'c1', group_id: 'g1', athlete1_id: 'me', athlete2_id: 'u2', status: 'completed', score1: 5, score2: 3, winner_id: 'me' },
    { id: 'pq2', competition_id: 'c1', group_id: 'g1', athlete1_id: 'u2', athlete2_id: 'u3', status: 'pending', score1: null, score2: null, winner_id: null },
  ],
};
const SWISS = {
  inter_swiss_rounds: [{ id: 'sr1', competition_id: 'c1', round_number: 1, status: 'completed' }, { id: 'sr2', competition_id: 'c1', round_number: 2, status: 'active' }],
  inter_swiss_pairings: [
    { id: 'sp1', competition_id: 'c1', round_id: 'sr1', athlete1_id: 'me', athlete2_id: 'u2', status: 'completed', score1: 2, score2: 1, winner_id: 'me' },
    { id: 'sp2', competition_id: 'c1', round_id: 'sr1', athlete1_id: 'u3', athlete2_id: null, status: 'bye', score1: null, score2: null, winner_id: 'u3' },
    { id: 'sp3', competition_id: 'c1', round_id: 'sr2', athlete1_id: 'me', athlete2_id: 'u3', status: 'pending', score1: null, score2: null, winner_id: null },
  ],
  inter_swiss_standings: ['me', 'u2', 'u3', 'u4'].map((a, i) => ({
    id: `ss${i}`, competition_id: 'c1', athlete_id: a, points: 6 - i, wins: 2 - Math.min(i, 2), draws: 0, losses: Math.min(i, 2), buchholz: 3,
  })),
};
function interTeam(kind: 'captain' | 'complete' | 'create' | 'invite', teamSize = 3) {
  const team = { id: 'tm1', competition_id: 'c1', name: 'Les Fous du Rack', captain_id: 'me' };
  mockDb = {
    inter_teams: kind === 'captain' || kind === 'complete' ? [team] : [],
    inter_team_members: kind === 'captain' || kind === 'complete' ? [
      { id: 'tmm1', team_id: 'tm1', user_id: 'u2', status: 'accepted', profile: { username: 'Léa', level: 'rx', avatar_url: null } },
      { id: 'tmm2', team_id: 'tm1', user_id: 'u3', status: kind === 'complete' ? 'accepted' : 'pending', profile: { username: LONG, level: 'scaled', avatar_url: null } },
      { id: 'tmm3', team_id: 'tm1', user_id: 'u4', status: 'declined', profile: { username: 'Sam', level: 'inter', avatar_url: null } },
    ] : kind === 'invite' ? [
      { id: 'inv1', user_id: 'me', status: 'pending', team: { id: 'tm9', name: 'Les Rapides', captain_id: 'u2', competition_id: 'c1' } },
    ] : [],
    box_members: [{ box_id: 'box1', member_id: 'u5' }, { box_id: 'box1', member_id: 'u6' }],
    profiles: [
      { id: 'u5', username: 'Zoé', level: 'rx', elo: 1250, avatar_url: null },
      { id: 'u6', username: LONG, level: 'elite', elo: null, avatar_url: null },
    ],
  };
  mockParams = { competitionId: 'c1', teamSize: kind === 'complete' ? 3 : teamSize };
}
const SCORE_PARAMS = {
  competitionId: 'c1', wodId: 'w1', wodTitle: 'Chipper', wodDescription: '50 Wall Balls\n40 Burpees',
  timeCap: 15, scoringType: 'time', existingScore: null,
};

// ── Compétition physique
const PHYS = [
  { id: 'p1', name: 'Lyon Throwdown', date: '2026-10-12', start_date: '2026-09-01', end_date: '2026-10-30', location: 'Lyon',
    description: 'Qualification en ligne pour la finale régionale.', status: 'open', mode: 'qualification', logo_url: null,
    registration_url: 'https://example.test/inscription', format: 'team', price: '45 €' },
  { id: 'p2', name: LONG, date: '2026-11-02', start_date: '2026-10-15', end_date: '2026-11-15', location: LONG,
    description: LONG, status: 'active', mode: 'qualification', logo_url: null, registration_url: null, format: 'individual', price: null },
  { id: 'p3', name: 'Rhône Games', date: '2026-12-05', start_date: null, end_date: null, location: 'Villeurbanne',
    description: null, status: 'closed', mode: 'info', logo_url: null, registration_url: 'https://example.test/rg', format: 'both', price: '30 €' },
];
const PHYS_WODS = [
  { id: 'pw1', name: 'Event 1', description: 'AMRAP 12 : 10 Thrusters, 10 C2B', timer_type: 'amrap', total_seconds: 720,
    max_time: 0, interval_seconds: 0, rounds: 0, work_time: 0, rest_time: 0, with_camera: true, order_index: 1 },
  { id: 'pw2', name: LONG, description: null, timer_type: 'for-time', total_seconds: 0,
    max_time: 900, interval_seconds: 0, rounds: 0, work_time: 0, rest_time: 0, with_camera: false, order_index: 2 },
];
function phys(mode: 'qualification' | 'info', comps: Row[] = PHYS) {
  mockDb = { physical_competitions_served: comps, physical_wods: PHYS_WODS.map((w) => ({ ...w })) };
  mockParams = { mode };
}

let renderer: TestRenderer.ReactTestRenderer | undefined;
beforeAll(async () => { await i18n.changeLanguage('fr'); });
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = undefined; }
  jest.useRealTimers();
  jest.clearAllMocks();
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
async function settle() {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
async function pressText(root: ReactTestInstance, text: string, nth = 0) {
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[nth];
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress(); });
  await settle();
}
async function pressLabel(root: ReactTestInstance, label: string) {
  const node = root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`aucun bouton « ${label} »`);
  await act(async () => { node.props.onPress(); });
  await settle();
}
async function mount(el: React.ReactElement, theme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  await settle();
  return renderer!.root;
}
const tr = (k: string, o?: Record<string, unknown>) => String(i18n.t(k, o));

type Variant = { name: string; run: (theme?: typeof lightTheme) => Promise<ReactTestInstance> };
const detailTab = (comp: Row, extra: Record<string, Row[]>, tabKey?: string, registered = true): Variant['run'] => async (th) => {
  interDetail(comp, extra, registered);
  const root = await mount(<InterCompetitionDetailScreen />, th);
  if (tabKey) await pressText(root, tabKey);
  return root;
};
const VARIANTS: Variant[] = [
  { name: 'mini-liste', run: async (th) => { mockDb = { daily_tournaments: [T_OPEN, T_FULL, T_SCORED] }; return mount(<DailyTournamentsScreen />, th); } },
  { name: 'mini-liste-vide', run: async (th) => { mockDb = { daily_tournaments: [] }; return mount(<DailyTournamentsScreen />, th); } },
  { name: 'mini-création', run: async (th) => {
    mockDb = { daily_tournaments: [T_OPEN] };
    const root = await mount(<DailyTournamentsScreen />, th);
    await pressLabel(root, tr('common.create'));
    return root;
  } },
  { name: 'mini-détail', run: async (th) => { dailyDetail(T_OPEN); return mount(<DailyTournamentDetailScreen />, th); } },
  { name: 'mini-détail-saisie', run: async (th) => {
    dailyDetail(T_OPEN);
    const root = await mount(<DailyTournamentDetailScreen />, th);
    await pressText(root, 'Entrer mon score manuellement');
    return root;
  } },
  { name: 'mini-détail-saisie-reps', run: async (th) => {
    dailyDetail({ ...T_OPEN, score_mode: 'reps', wod_type: 'AMRAP' });
    const root = await mount(<DailyTournamentDetailScreen />, th);
    await pressText(root, 'Entrer mon score manuellement');
    return root;
  } },
  { name: 'mini-détail-contestation', run: async (th) => {
    dailyDetail(T_OPEN, { scored: true });
    const root = await mount(<DailyTournamentDetailScreen />, th);
    await pressText(root, 'Contester');
    return root;
  } },
  { name: 'mini-détail-rejoindre', run: async (th) => { dailyDetail({ ...T_OPEN, gender_target: 'male' }, { joined: false }); return mount(<DailyTournamentDetailScreen />, th); } },
  { name: 'mini-détail-officiel', run: async (th) => { dailyDetail({ ...T_OPEN, id: 't9', is_official: true, wod_name: 'WOD du jour', level: 'pro' }); return mount(<DailyTournamentDetailScreen />, th); } },
  { name: 'mini-détail-terminé', run: async (th) => {
    dailyDetail({ ...T_OPEN, status: 'completed', ends_at: inH(-2) }, { scored: true, elo: true });
    return mount(<DailyTournamentDetailScreen />, th);
  } },
  { name: 'inter-liste', run: async (th) => {
    mockDb = { inter_competitions: [COMP, COMP2], inter_registrations: [{ id: 'r1', competition_id: 'c1', athlete_id: 'me' }] };
    return mount(<InterCompetitionListScreen />, th);
  } },
  { name: 'inter-liste-vide', run: async (th) => { mockDb = { inter_competitions: [] }; return mount(<InterCompetitionListScreen />, th); } },
  { name: 'inter-détail-infos', run: detailTab(COMP, LEAGUE) },
  { name: 'inter-détail-wods', run: detailTab(COMP, LEAGUE, 'WODs') },
  { name: 'inter-détail-inscription', run: detailTab(COMP, LEAGUE, 'Inscription') },
  { name: 'inter-détail-inscription-ouverte', run: detailTab(COMP, LEAGUE, 'Inscription', false) },
  { name: 'inter-détail-inscription-équipe', run: detailTab({ ...COMP, type: 'team', team_size: 3 },
    { ...LEAGUE, inter_teams: [{ id: 'tm1', competition_id: 'c1', name: 'Les Fous du Rack', captain_id: 'me' }] }, 'Inscription') },
  { name: 'inter-détail-inscription-équipe-libre', run: detailTab({ ...COMP, type: 'team', team_size: 3 }, LEAGUE, 'Inscription', false) },
  { name: 'inter-détail-classement', run: detailTab(COMP, LEAGUE, 'Classement') },
  { name: 'inter-détail-ligue', run: detailTab(COMP, LEAGUE, 'Ligue') },
  { name: 'inter-détail-bracket', run: detailTab({ ...COMP, format: 'bracket', status: 'active' }, BRACKET, 'Élimination') },
  { name: 'inter-détail-poules', run: detailTab({ ...COMP, format: 'pool', status: 'active' }, POOLS, 'Poules') },
  { name: 'inter-détail-suisse', run: detailTab({ ...COMP, format: 'swiss', status: 'active' }, SWISS, 'Suisse') },
  { name: 'inter-score', run: async (th) => { mockDb = {}; mockParams = SCORE_PARAMS; return mount(<InterScoreSubmitScreen />, th); } },
  { name: 'inter-score-màj', run: async (th) => {
    mockDb = {};
    mockParams = { ...SCORE_PARAMS, scoringType: 'reps', timeCap: null, wodDescription: '',
      existingScore: { id: 's1', score_value: 147, score_display: '147', video_url: 'https://youtu.be/x', notes: 'RAS' } };
    return mount(<InterScoreSubmitScreen />, th);
  } },
  { name: 'inter-score-libre', run: async (th) => { mockDb = {}; mockParams = { ...SCORE_PARAMS, scoringType: 'weight' }; return mount(<InterScoreSubmitScreen />, th); } },
  { name: 'inter-équipe-capitaine', run: async (th) => { interTeam('captain'); return mount(<InterTeamScreen />, th); } },
  { name: 'inter-équipe-membres-box', run: async (th) => {
    interTeam('captain');
    const root = await mount(<InterTeamScreen />, th);
    await pressText(root, tr('interTeam.seeBoxMembers'));
    return root;
  } },
  { name: 'inter-équipe-complète', run: async (th) => { interTeam('complete'); return mount(<InterTeamScreen />, th); } },
  { name: 'inter-équipe-création', run: async (th) => { interTeam('create'); return mount(<InterTeamScreen />, th); } },
  { name: 'inter-équipe-invitation', run: async (th) => { interTeam('invite'); return mount(<InterTeamScreen />, th); } },
  { name: 'physique-qualif', run: async (th) => { phys('qualification'); return mount(<PhysicalCompetitionScreen />, th); } },
  { name: 'physique-info', run: async (th) => { phys('info'); return mount(<PhysicalCompetitionScreen />, th); } },
  { name: 'physique-vide', run: async (th) => { phys('qualification', []); return mount(<PhysicalCompetitionScreen />, th); } },
  { name: 'physique-détail', run: async (th) => {
    phys('qualification');
    const root = await mount(<PhysicalCompetitionScreen />, th);
    await pressText(root, 'Lyon Throwdown');
    return root;
  } },
  { name: 'physique-détail-hors-période', run: async (th) => {
    phys('qualification');
    const root = await mount(<PhysicalCompetitionScreen />, th);
    await pressText(root, LONG);
    return root;
  } },
  { name: 'physique-détail-info-sans-wod', run: async (th) => {
    phys('info');
    mockDb.physical_wods = [];
    const root = await mount(<PhysicalCompetitionScreen />, th);
    await pressText(root, 'Rhône Games');
    return root;
  } },
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{FFFD}]/gu;
/** Casse et emoji mis à part : les surtitres passent en capitales, les emoji deviennent des icônes Lucide. */
const normalize = (xs: string[]) => xs.map((x) => x.replace(EMOJI, '').replace(/\s+/g, ' ').trim().toUpperCase()).filter((x) => x.length > 0);

describe('R8b : ordre des blocs et libellés inchangés (instantané pris sur master)', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const current = structure(await v.run());
    if (process.env.R8B_CAPTURE) {
      const file = process.env.R8B_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(normalize(current)).toEqual(normalize(before));
  });
});

const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const byID = (root: ReactTestInstance, id: string) => {
  const n = root.findAll((x) => x.props.testID === id)[0];
  if (!n) throw new Error(`testID absent : ${id}`);
  return n;
};
const textByContent = (root: ReactTestInstance, text: string) => {
  const n = root.findAll((x) => isHostText(x) && hostText(x) === text)[0];
  if (!n) throw new Error(`texte absent : ${text}`);
  return n;
};
const inModal = (n: ReactTestInstance) => {
  for (let p: ReactTestInstance | null = n.parent; p; p = p.parent) if (p.type === Modal) return p;
  return null;
};
const variant = (name: string) => VARIANTS.find((v) => v.name === name)!;
async function pressID(root: ReactTestInstance, id: string) {
  const n = byID(root, id);
  await act(async () => { n.props.onPress(); });
  await settle();
}
function accentCounts(root: ReactTestInstance): { screen: number; modals: number[] } {
  const accents = root.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent');
  const modals = root.findAllByType(Modal).filter((m) => m.props.visible);
  return {
    screen: accents.filter((b) => !inModal(b)).length,
    modals: modals.map((m) => accents.filter((b) => inModal(b) === m).length),
  };
}

const SCREEN_FILES = [
  'tournament/DailyTournamentsScreen.tsx', 'tournament/DailyTournamentDetailScreen.tsx',
  'competition/InterCompetitionListScreen.tsx', 'competition/InterCompetitionDetailScreen.tsx',
  'competition/InterScoreSubmitScreen.tsx', 'competition/InterTeamScreen.tsx', 'competition/PhysicalCompetitionScreen.tsx',
];
const source = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'screens', f), 'utf8');
const PICTO = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

describe('R8b : aucun emoji, icônes Lucide', () => {
  it.each(SCREEN_FILES)('%s : aucun emoji dans le code', (f) => {
    expect(source(f).match(new RegExp(PICTO.source, 'gu')) ?? []).toEqual([]);
  });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s : aucun emoji affiché', async (_n, v) => {
    const texts = structure(await v.run());
    expect(texts.filter((x) => PICTO.test(x))).toEqual([]);
  });
  it('podiums : médailles Lucide au lieu de 🥇🥈🥉 (classement inter-box)', async () => {
    const root = await variant('inter-détail-classement').run();
    const medals = root.findAll((n) => typeof n.type !== 'string' && (n.type as { displayName?: string }).displayName === 'Medal');
    expect(medals.length).toBeGreaterThanOrEqual(2);
    expect(textByContent(root, '#4')).toBeDefined();
  });
});

describe('R8b : une seule action accent par écran et par fenêtre', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (_n, v) => {
    const counts = accentCounts(await v.run());
    expect(counts.screen).toBeLessThanOrEqual(1);
    for (const m of counts.modals) expect(m).toBeLessThanOrEqual(1);
  });
  it('soumission de score inter-box : l’envoi est l’unique accent', async () => {
    const root = await variant('inter-score').run();
    expect(root.findAllByType(AxButton).map((b) => [b.props.label, b.props.variant ?? 'accent']))
      .toEqual([[tr('interScore.title'), 'accent']]);
  });
  it('création de mini-tournoi : « Lancer le mini-tournoi » est l’unique accent de la fenêtre', async () => {
    const root = await variant('mini-création').run();
    const inSheet = root.findAllByType(AxButton).filter((b) => inModal(b) && (b.props.variant ?? 'accent') === 'accent');
    expect(inSheet.map((b) => b.props.label)).toEqual(['Lancer le mini-tournoi']);
  });
});

describe('R8b : couleurs et typographies clés, dans les deux thèmes', () => {
  for (const [mode, th] of [['clair', lightTheme], ['sombre', darkTheme]] as const) {
    const c = th.ax;
    it(`${mode} — mini-tournois`, async () => {
      const root = await variant('mini-liste').run(th);
      expect(byID(root, 'mini-card-t1').type).toBe(AxCard);
      expect(byID(root, 'mini-status-t1').type).toBe(AxStatusDot);
      expect(byID(root, 'mini-type-t1').type).toBe(AxTag);
      expect(flat(textByContent(root, 'Flash Burner'))).toMatchObject({ fontFamily: axTypography.titleM.fontFamily, color: c.text });
      expect(flat(textByContent(root, 'par Coach Max'))).toMatchObject({ fontSize: axTypography.caption.fontSize, color: c.textMuted });
      expect(contrast(c.textMuted, c.surface)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode} — création de mini-tournoi`, async () => {
      const root = await variant('mini-création').run(th);
      expect(byID(root, 'mini-form-name').type).toBe(AxTextField);
      expect(byID(root, 'mini-form-type-For Time').type).toBe(AxChip);
      expect(byID(root, 'mini-form-create').type).toBe(AxButton);
    });
    it(`${mode} — détail de mini-tournoi`, async () => {
      const root = await variant('mini-détail').run(th);
      expect(byID(root, 'mini-player-u2').type).toBe(AxCard);
      expect(byID(root, 'mini-player-status-u2').type).toBe(AxStatusDot);
      const saisie = await variant('mini-détail-saisie').run(th);
      expect(byID(saisie, 'mini-score-capped').props.accessibilityLabel).toBe('Temps limite atteint (CAP)');
    });
    it(`${mode} — inter-box`, async () => {
      const list = await variant('inter-liste').run(th);
      expect(byID(list, 'inter-card-c1').type).toBe(AxCard);
      expect(byID(list, 'inter-status-c1').type).toBe(AxStatusDot);
      expect(byID(list, 'inter-format-c1').type).toBe(AxTag);
      expect(flat(textByContent(list, 'Battle des Box'))).toMatchObject({ fontFamily: axTypography.titleM.fontFamily, color: c.text });
      const wods = await variant('inter-détail-wods').run(th);
      expect(byID(wods, 'inter-wod-scoring-w1').type).toBe(AxTag);
      expect(flat(textByContent(wods, '12:34'))).toMatchObject({ fontFamily: axTypography.numberM.fontFamily, color: c.text });
      expect(flat(textByContent(wods, 'W1'))).toMatchObject({ color: c.accentText });
      expect(contrast(c.accentText, c.surface)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode} — soumission de score et équipe`, async () => {
      const score = await variant('inter-score').run(th);
      expect(byID(score, 'inter-score-wod').type).toBe(AxCard);
      expect(byID(score, 'inter-score-video').type).toBe(AxTextField);
      expect(flat(textByContent(score, tr('interScore.step1')))).toMatchObject({ ...axTypography.overline, color: c.textMuted });
      const team = await variant('inter-équipe-capitaine').run(th);
      for (const id of ['team-member-captain', 'team-member-tmm1', 'team-member-tmm2', 'team-member-tmm3']) {
        expect(byID(team, id).type).toBe(AxCard);
      }
      expect(byID(team, 'team-member-status-tmm2').type).toBe(AxStatusDot);
      expect(flat(textByContent(team, 'Léa'))).toMatchObject({ fontFamily: axTypography.label.fontFamily, color: c.text });
    });
    it(`${mode} — compétition physique`, async () => {
      const root = await variant('physique-qualif').run(th);
      expect(byID(root, 'phys-card-p1').type).toBe(AxCard);
      expect(byID(root, 'phys-status-p1').type).toBe(AxStatusDot);
      expect(byID(root, 'phys-search').type).toBe(AxTextField);
      expect(root.findAllByType(AxChip).map((ch) => [ch.props.label, ch.props.selected])).toEqual([
        [tr('phys.filterAll'), true], [tr('phys.individual'), false], [tr('phys.team'), false], [tr('phys.filterPrice'), false],
      ]);
      expect(flat(textByContent(root, 'Lyon'))).toMatchObject({ fontSize: axTypography.caption.fontSize, color: c.textMuted });
      const detail = await variant('physique-détail').run(th);
      expect(byID(detail, 'phys-wod-pw1').type).toBe(AxCard);
      expect(byID(detail, 'phys-format-tag').type).toBe(AxTag);
    });
  }
});

describe('R8b : navigation et callbacks inchangés', () => {
  it('mini-tournois : carte → DailyTournamentDetail, « Rejoindre » → rpc/insert inchangés', async () => {
    const root = await variant('mini-liste').run();
    await pressID(root, 'mini-card-t1');
    expect(mockNavigate).toHaveBeenCalledWith('DailyTournamentDetail', { tournamentId: 't1' });
  });
  it('création : même payload daily_tournaments', async () => {
    const root = await variant('mini-création').run();
    await act(async () => { byID(root, 'mini-form-name').props.onChangeText('Flash'); });
    await act(async () => { byID(root, 'mini-form-movements').props.onChangeText('Thrusters'); });
    await pressID(root, 'mini-form-type-AMRAP');
    await pressID(root, 'mini-form-create');
    const insert = mockCalls.find((x) => x.table === 'daily_tournaments' && x.method === 'insert');
    expect(insert?.args[0]).toMatchObject({
      creator_id: 'me', wod_name: 'Flash', wod_type: 'AMRAP', duration: 12, movements: 'Thrusters', status: 'open',
    });
  });
  it('détail mini-tournoi : « Lancer le WOD » → TimerRun', async () => {
    const root = await variant('mini-détail').run();
    await pressID(root, 'mini-launch');
    expect(mockNavigate).toHaveBeenCalledWith('TimerRun', expect.objectContaining({ videoTitle: 'Flash Burner' }));
  });
  it('inter-box : même requête, carte → InterCompetitionDetail', async () => {
    const root = await variant('inter-liste').run();
    const q = mockCalls.filter((x) => x.table === 'inter_competitions').map((x) => [x.method, x.args]);
    expect(q).toEqual(expect.arrayContaining([['select', ['*']], ['neq', ['status', 'draft']], ['order', ['created_at', { ascending: false }]]]));
    await pressID(root, 'inter-card-c1');
    expect(mockNavigate).toHaveBeenCalledWith('InterCompetitionDetail', { competitionId: 'c1' });
  });
  it('inter-box détail : « Soumettre mon score » → InterScoreSubmit avec les mêmes paramètres', async () => {
    const root = await variant('inter-détail-wods').run();
    await pressID(root, 'inter-wod-submit-w3');
    expect(mockNavigate).toHaveBeenCalledWith('InterScoreSubmit', {
      competitionId: 'c1', wodId: 'w3', wodTitle: LONG, wodDescription: 'AMRAP 12', timeCap: 12, scoringType: 'reps', existingScore: null,
    });
  });
  it('inter-box détail : bracket → InterScoreSubmit ; équipe → InterTeam', async () => {
    const br = await variant('inter-détail-bracket').run();
    await pressID(br, 'inter-bracket-submit-m1');
    expect(mockNavigate).toHaveBeenCalledWith('InterScoreSubmit', expect.objectContaining({ wodId: 'w1', existingScore: null }));
    const team = await variant('inter-détail-inscription-équipe-libre').run();
    await pressID(team, 'inter-team-btn');
    expect(mockNavigate).toHaveBeenCalledWith('InterTeam', { competitionId: 'c1', teamSize: 3 });
  });
  it('soumission : chrono → TimerRun, envoi bloqué sans score (alerte inchangée)', async () => {
    const root = await variant('inter-score').run();
    await pressID(root, 'inter-score-timer');
    expect(mockNavigate).toHaveBeenCalledWith('TimerRun', expect.objectContaining({ maxTime: 900, videoTitle: 'Chipper', withCamera: true }));
    await pressID(root, 'inter-score-submit');
    expect(mockCalls.find((x) => x.table === 'inter_scores')).toBeUndefined();
  });
  it('équipe : création → insert inter_teams puis upsert inter_registrations', async () => {
    const root = await variant('inter-équipe-création').run();
    mockDb.inter_teams = [{ id: 'tmNew', competition_id: 'c1', name: 'Les Barbares', captain_id: 'me' }];
    await act(async () => { byID(root, 'team-name').props.onChangeText('  Les Barbares '); });
    await pressID(root, 'team-create');
    expect(mockCalls.find((x) => x.table === 'inter_teams' && x.method === 'insert')?.args[0])
      .toEqual({ competition_id: 'c1', name: 'Les Barbares', captain_id: 'me', box_id: 'box1' });
    expect(mockCalls.find((x) => x.table === 'inter_registrations' && x.method === 'upsert')?.args[0])
      .toEqual({ competition_id: 'c1', team_id: 'tmNew', athlete_id: null, box_id: 'box1' });
  });
  it('équipe : ouverture des membres de la box, invitation', async () => {
    const root = await variant('inter-équipe-membres-box').run();
    await pressID(root, 'team-invite-u5');
    expect(mockCalls.some((x) => x.table === 'inter_team_members' && x.method === 'insert')).toBe(true);
  });
  it('physique : même requête, carte → WODs, lancement → TimerRun', async () => {
    const root = await variant('physique-qualif').run();
    expect(mockCalls.filter((x) => x.table === 'physical_competitions_served').map((x) => [x.method, x.args]))
      .toEqual([['select', ['*']], ['order', ['date', { ascending: true }]]]);
    await pressID(root, 'phys-card-p1');
    await pressID(root, 'phys-launch-pw1');
    expect(mockNavigate).toHaveBeenCalledWith('TimerRun', expect.objectContaining({ timerType: 'amrap', totalSeconds: 720, videoTitle: 'Event 1' }));
  });
  it('physique : filtres et recherche filtrent toujours la liste', async () => {
    const root = await variant('physique-qualif').run();
    await pressID(root, 'phys-filter-price');
    expect(root.findAll((n) => n.props.testID === 'phys-card-p2')).toHaveLength(0);
    expect(byID(root, 'phys-card-p1')).toBeDefined();
  });
});

describe('R8b : textes longs sans débordement à 390 px', () => {
  /** Dans chaque rangée traversée entre le titre et la carte, l'enfant qui porte le titre peut rétrécir. */
  const shrinks = (title: ReactTestInstance, card: ReactTestInstance) => {
    let child: ReactTestInstance = title;
    for (let p = title.parent; p && p !== card; p = p.parent) {
      if (typeof p.type !== 'string') continue;
      if (flat(p).flexDirection === 'row') {
        const st = flat(child);
        if (!(st.flex === 1 || st.flexShrink === 1 || st.minWidth === 0)) return false;
      }
      child = p;
    }
    return true;
  };
  it.each([
    ['mini-liste', 'mini-card-t2'], ['inter-liste', 'inter-card-c2'], ['physique-qualif', 'phys-card-p2'],
    ['inter-équipe-capitaine', 'team-member-tmm2'], ['physique-détail', 'phys-wod-pw2'],
  ])('%s : titre long retourne à la ligne dans un conteneur rétrécissable (%s)', async (name, id) => {
    const root = await variant(name).run();
    const card = byID(root, id);
    const title = card.findAll((n) => isHostText(n) && hostText(n).includes(LONG))[0];
    expect(title).toBeDefined();
    expect(title.props.numberOfLines ?? 2).toBeGreaterThanOrEqual(1);
    expect(shrinks(title, card)).toBe(true);
  });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s : aucune largeur fixe supérieure à 390 px', async (_n, v) => {
    const root = await v.run();
    const wide = root.findAll((n) => typeof n.type === 'string' && typeof flat(n).width === 'number' && (flat(n).width as number) > 390);
    expect(wide).toHaveLength(0);
  });
});
