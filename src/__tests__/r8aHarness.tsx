/**
 * Montage des écrans de tournoi (lot R8a) sur une base simulée : chaque état
 * du tournoi (inscription, complet, terminé, archivé, score en attente ou
 * rejeté, validation staff, ligue, tableau) est une variante nommée.
 */
import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme } from '../theme/palette';
import i18n from '../i18n';
import CompetitionScreen from '../screens/competition/CompetitionScreen';
import TournamentScreen from '../screens/competition/TournamentScreen';
import TournamentDivisionsView from '../screens/competition/TournamentDivisionsView';
import TournamentWODScreen from '../screens/competition/TournamentWODScreen';

export type Theme = typeof lightTheme;
export type Row = Record<string, unknown>;

export interface Db {
  tables: Record<string, Row[]>;
  rpc: Record<string, unknown>;
  calls: Array<{ table: string; method: string; args: unknown[] }>;
}

export const LONG = 'Un tournoi au nom particulièrement long pour vérifier qu’aucun texte ne déborde à 390';
export const LONG_WOD = 'Un WOD au titre particulièrement long pour vérifier le retour à la ligne';
export const LONG_USER = 'athlete_au_pseudo_particulierement_long_390';

export const NOW = new Date('2026-09-28T10:00:00Z');

export const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
export function hostText(n: ReactTestInstance): string {
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
export function structure(root: ReactTestInstance): string[] {
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

export const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE0F}]/gu;
const MEDALS: Record<string, string> = { '🥇': '#1', '🥈': '#2', '🥉': '#3' };
/** Casse, espaces et emoji mis à part ; les médailles emoji deviennent le rang écrit. */
export const normalize = (xs: string[]) => xs
  .map((x) => (MEDALS[x.trim()] ?? x).replace(EMOJI, '').replace(/\s+/g, ' ').trim().toUpperCase())
  .filter((x) => x.length > 0);

const same = (a: string, b: string) => normalize([a])[0] === normalize([b])[0];

export async function flush() {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
export async function pressText(root: ReactTestInstance, text: string) {
  const t = root.findAll((n) => isHostText(n) && same(hostText(n), text))[0];
  let n: ReactTestInstance | null = t ?? null;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress({ stopPropagation: () => {} }); });
  await flush();
}

export const T0 = {
  id: 't1', name: LONG, level: 'rx', status: 'open', max_participants: 8, prize: 'Un t-shirt AthleX',
  start_date: '2026-10-10', format: 'simple', description: 'Trois WODs à faire en une semaine.',
  require_video_proof: true, archived_at: null, current_season: 1, type: 'box',
};
export const W1 = {
  id: 'w1', tournament_id: 't1', title: LONG_WOD, type: 'For Time', status: 'active', duration_minutes: 12,
  deadline_hours: 24, scoring: 'Temps le plus court', description: 'Le plus vite possible.',
  movements: ['21-15-9 Thrusters', 'Pull-ups'], order_index: 0, reps_per_round: null, season_number: 1,
  bracket_board: 'winner', bracket_stage: 1,
};
export const W2 = {
  id: 'w2', tournament_id: 't1', title: 'Grace', type: 'AMRAP', status: 'upcoming', duration_minutes: 10,
  deadline_hours: 24, scoring: 'Reps', description: null, movements: [], order_index: 1, reps_per_round: null,
  season_number: 1, bracket_board: 'winner', bracket_stage: 0,
};
const PROFILES = [
  { id: 'local', username: 'moi', elo: 1200, level: 'rx', avatar_url: null, box_members: [{ box: { name: 'AthleX Lyon' } }] },
  { id: 'a2', username: LONG_USER, elo: 1300, level: 'scaled', avatar_url: null, box_members: [] },
  { id: 'a3', username: 'carla', elo: 1100, level: 'rx', avatar_url: null, box_members: [] },
  { id: 'a4', username: 'dan', elo: 1000, level: 'rx', avatar_url: null, box_members: [] },
];
const PARTS = ['a2', 'a3', 'a4'].map((id, i) => ({ athlete_id: id, created_at: `2026-09-2${i}T10:00:00Z` }));

export interface Setup {
  tournament?: Partial<typeof T0>;
  registered?: boolean;
  canJoin?: boolean;
  admin?: boolean;
  myScore?: Row | null;
  wods?: Row[];
  participants?: Row[];
  matches?: Row[];
}

export function tournamentDb(db: Db, s: Setup) {
  const tour = { ...T0, ...s.tournament };
  const parts = [...(s.participants ?? PARTS), ...(s.registered ? [{ athlete_id: 'local', created_at: '2026-09-20T10:00:00Z' }] : [])];
  db.tables.tournaments = [tour];
  db.tables.tournament_wods = (s.wods ?? [W1, W2]).map((w) => ({ ...w }));
  db.tables.tournament_participants = s.registered ? [{ tournament_id: 't1', athlete_id: 'local' }] : [];
  db.tables.profiles = PROFILES;
  db.tables.tournament_scores = s.myScore ? [{ tournament_id: 't1', athlete_id: 'local', ...s.myScore }] : [];
  db.tables.tournament_bracket_matches = s.matches ?? [];
  db.tables.tournament_divisions = [];
  db.tables.tournament_division_members = [];
  db.rpc.get_tournament_participants = parts;
  db.rpc.can_join_tournament = s.canJoin ?? false;
  db.rpc.get_tournament_validated_scores = [];
  db.rpc.tournament_classique_standings = [];
  db.rpc.tournament_classique_wod_ranks = [];
  db.rpc.tournament_ligue_standings = [];
}

export const STAFF_SCORES = [
  { id: 's1', tournament_id: 't1', tournament_wod_id: 'w1', athlete_id: 'a2', score_value: '305', capped: false, tiebreak_value: 180,
    status: 'pending', notes: 'Bonne séance', video_url: 'https://youtu.be/abc', submitted_at: '2026-09-27T10:00:00Z', tw: { title: LONG_WOD, type: 'For Time' } },
  { id: 's2', tournament_id: 't1', tournament_wod_id: 'w1', athlete_id: 'a3', score_value: '330', capped: false, tiebreak_value: null,
    status: 'validated', notes: null, video_url: 'https://youtu.be/def', submitted_at: '2026-09-26T10:00:00Z', tw: { title: LONG_WOD, type: 'For Time' } },
];

export const MATCHES = [
  { id: 'm1', round: 1, match_number: 1, side: 'winner', participant1_id: 'a2', participant2_id: 'a3', winner_id: 'a2', loser_id: 'a3', status: 'completed', wod_id: 'w1' },
  { id: 'm2', round: 1, match_number: 2, side: 'winner', participant1_id: 'a4', participant2_id: 'local', winner_id: null, loser_id: null, status: 'active', wod_id: 'w1' },
  { id: 'm3', round: 2, match_number: 1, side: 'loser', participant1_id: 'a3', participant2_id: null, winner_id: null, loser_id: null, status: 'pending', wod_id: null },
  { id: 'm4', round: 3, match_number: 1, side: 'grand_final', participant1_id: null, participant2_id: null, winner_id: null, loser_id: null, status: 'pending', wod_id: 'w2' },
];

export const DIVS = [
  { id: 'd1', tournament_id: 't1', name: 'Élite', level: 1, max_members: 4, promote_count: 1, relegate_count: 1 },
  { id: 'd2', tournament_id: 't1', name: 'Challengers', level: 2, max_members: 4, promote_count: 1, relegate_count: 1 },
];
export const DIV_MEMBERS = [
  { id: 'dm1', division_id: 'd1', athlete_id: 'a2', points: 30, rank: 1 },
  { id: 'dm2', division_id: 'd1', athlete_id: 'a3', points: 20, rank: 2 },
  { id: 'dm3', division_id: 'd1', athlete_id: 'local', points: 10, rank: 3 },
  { id: 'dm4', division_id: 'd2', athlete_id: 'a4', points: 25, rank: 1 },
];

export type Route = { params: Record<string, unknown> | undefined };
export interface Ctx {
  db: Db;
  route: Route;
  auth: { user: Row | null; currentBox: Row | null };
  mount: (el: React.ReactElement, theme?: Theme) => Promise<ReactTestInstance>;
}

export const ts = (k: string, o?: Record<string, unknown>) => String(i18n.t(k, o));

function competitionDb(db: Db, empty = false) {
  db.tables.tournaments = empty ? [] : [
    { id: 'c1', name: 'Box Games', level: 'rx', status: 'active', max_participants: 10, prize: '100 €', start_date: null, box_id: 'box1', archived_at: null },
    { id: 'c2', name: LONG, level: 'scaled', status: 'open', max_participants: 0, prize: null, start_date: null, box_id: 'box1', archived_at: null },
  ];
  db.tables.tournament_participants = [{ tournament_id: 'c1', athlete_id: 'local' }, { tournament_id: 'c1', athlete_id: 'a2' }];
  db.tables.daily_tournaments = [
    { id: 'o1', is_official: true, wod_name: 'WOD officiel', wod_type: 'AMRAP', level: 'rx', ends_at: '2026-09-28T15:30:00Z',
      participants: [{ user_id: 'a2' }], scores: [] },
    { id: 'd1', is_official: false, wod_name: LONG_WOD, wod_type: 'For Time', level: 'rx', score_mode: 'time', max_players: 4,
      status: 'open', elo_reward: 15, ends_at: '2026-09-28T12:05:00Z', participants: [{ user_id: 'a2' }], creator: { username: 'carla' } },
    { id: 'd2', is_official: false, wod_name: 'Cindy', wod_type: 'AMRAP', level: 'scaled', score_mode: 'reps', max_players: 2,
      status: 'open', elo_reward: 10, ends_at: '2026-09-28T09:00:00Z', participants: [{ user_id: 'local' }], creator: [{ username: 'dan' }] },
  ];
}

export type Variant = { name: string; run: (ctx: Ctx, theme?: Theme) => Promise<ReactTestInstance> };

const tournoi = (s: Setup, tab?: string | ((ctx: Ctx) => string), then?: (root: ReactTestInstance) => Promise<void>) =>
  async (ctx: Ctx, th?: Theme) => {
    if (s.admin) ctx.auth.user = { ...ctx.auth.user, role: 'box_owner' };
    tournamentDb(ctx.db, s);
    ctx.route.params = { tournamentId: 't1' };
    const root = await ctx.mount(<TournamentScreen />, th);
    if (tab) await pressText(root, typeof tab === 'string' ? tab : tab(ctx));
    if (then) await then(root);
    return root;
  };

const wodParams = (existingScore: Row | null = { tournament_wod_id: 'w1', score_value: '305', capped: false, video_url: 'https://youtu.be/abc', status: 'rejected' }) => ({
  tournamentId: 't1', tournamentName: LONG, requireVideoProof: false, wod: W1, existingScore,
});

export const VARIANTS: Variant[] = [
  { name: 'compétitions', run: async (ctx, th) => { competitionDb(ctx.db); ctx.route.params = undefined; return ctx.mount(<CompetitionScreen />, th); } },
  { name: 'compétitions-vide', run: async (ctx, th) => { competitionDb(ctx.db, true); ctx.route.params = undefined; return ctx.mount(<CompetitionScreen />, th); } },
  { name: 'compétitions-mini', run: async (ctx, th) => {
    competitionDb(ctx.db); ctx.route.params = { initialTab: 1 };
    return ctx.mount(<CompetitionScreen />, th);
  } },
  { name: 'compétitions-physiques', run: async (ctx, th) => {
    competitionDb(ctx.db); ctx.route.params = { initialTab: 2 };
    return ctx.mount(<CompetitionScreen />, th);
  } },
  { name: 'compétitions-inter-box', run: async (ctx, th) => {
    competitionDb(ctx.db); ctx.route.params = { initialTab: 3 };
    return ctx.mount(<CompetitionScreen />, th);
  } },
  { name: 'tournoi-pas-inscrit', run: tournoi({ canJoin: true }) },
  { name: 'tournoi-inscrit', run: tournoi({ canJoin: true, registered: true }) },
  { name: 'tournoi-inscriptions-pendant', run: tournoi({ tournament: { status: 'active' }, canJoin: true }) },
  { name: 'tournoi-complet', run: tournoi({ tournament: { max_participants: 3 } }) },
  { name: 'tournoi-terminé', run: tournoi({ tournament: { status: 'closed' } }) },
  { name: 'tournoi-archivé', run: tournoi({ tournament: { status: 'closed', archived_at: '2026-09-20T10:00:00Z' }, registered: true }) },
  { name: 'wods-pas-inscrit', run: tournoi({ canJoin: true }, () => ts('tournament.tabWods', { count: 2 })) },
  { name: 'wods-à-faire', run: tournoi({ tournament: { status: 'active' }, registered: true }, () => ts('tournament.tabWods', { count: 2 })) },
  { name: 'wods-score-en-attente', run: tournoi({ tournament: { status: 'active' }, registered: true,
    myScore: { id: 'me1', tournament_wod_id: 'w1', score_value: '305', capped: false, status: 'pending', video_url: null } },
  () => ts('tournament.tabWods', { count: 2 })) },
  { name: 'wods-score-rejeté', run: tournoi({ tournament: { status: 'active' }, registered: true,
    myScore: { id: 'me1', tournament_wod_id: 'w1', score_value: '305', capped: false, status: 'rejected', video_url: null, admin_message: 'Vidéo coupée avant la fin' } },
  () => ts('tournament.tabWods', { count: 2 })) },
  { name: 'participants-staff', run: tournoi({ admin: true, registered: true }, () => ts('tournament.tabParticipants', { count: 4 })) },
  { name: 'valider-staff', run: async (ctx, th) => {
    ctx.auth.user = { ...ctx.auth.user, role: 'box_owner' };
    tournamentDb(ctx.db, { tournament: { status: 'active' } });
    ctx.db.tables.tournament_scores = STAFF_SCORES;
    ctx.route.params = { tournamentId: 't1' };
    const root = await ctx.mount(<TournamentScreen />, th);
    await pressText(root, `${ts('tournament.tabValidate')} (1)`);
    return root;
  } },
  { name: 'classement', run: async (ctx, th) => {
    tournamentDb(ctx.db, { tournament: { status: 'active' }, registered: true });
    ctx.db.rpc.tournament_classique_standings = [
      { athlete_id: 'a2', points: 200, final_rank: 1 }, { athlete_id: 'local', points: 180, final_rank: 2 },
      { athlete_id: 'a3', points: 150, final_rank: 3 }, { athlete_id: 'a4', points: 90, final_rank: 4 },
    ];
    ctx.route.params = { tournamentId: 't1' };
    const root = await ctx.mount(<TournamentScreen />, th);
    await pressText(root, ts('tournament.tabStandings'));
    return root;
  } },
  { name: 'classement-wod', run: async (ctx, th) => {
    tournamentDb(ctx.db, { tournament: { status: 'active' }, registered: true });
    ctx.db.rpc.get_tournament_validated_scores = [
      { athlete_id: 'a3', tournament_wod_id: 'w1', score_value: '330', capped: false },
      { athlete_id: 'a2', tournament_wod_id: 'w1', score_value: '305', capped: false },
    ];
    ctx.db.rpc.tournament_classique_wod_ranks = [
      { athlete_id: 'a2', tournament_wod_id: 'w1', wod_rank: 1, points: 100 },
      { athlete_id: 'a3', tournament_wod_id: 'w1', wod_rank: 2, points: 95 },
    ];
    ctx.route.params = { tournamentId: 't1' };
    const root = await ctx.mount(<TournamentScreen />, th);
    await pressText(root, ts('tournament.tabStandings'));
    await pressText(root, ts('tournament.wodRankTab', { n: 1, title: LONG_WOD }));
    return root;
  } },
  { name: 'ligue-pas-inscrit', run: tournoi({ tournament: { format: 'league_div' }, canJoin: true }) },
  { name: 'ligue-divisions', run: async (ctx, th) => {
    tournamentDb(ctx.db, { tournament: { format: 'league_div', status: 'active', current_season: 2 }, registered: true });
    ctx.db.tables.tournament_divisions = DIVS;
    ctx.db.tables.tournament_division_members = DIV_MEMBERS;
    ctx.route.params = { tournamentId: 't1' };
    const root = await ctx.mount(<TournamentScreen />, th);
    await pressText(root, ts('tournament.tabDivisions'));
    return root;
  } },
  { name: 'bracket-pas-encore-généré', run: tournoi({ tournament: { format: 'bracket', status: 'active' }, registered: true }, () => ts('tournament.tabBracket')) },
  { name: 'bracket', run: tournoi({ tournament: { format: 'swiss', status: 'active' }, registered: true, matches: MATCHES }, () => ts('tournament.tabBracket')) },
  { name: 'divisions-vue', run: async (ctx, th) => {
    ctx.db.tables.tournament_divisions = DIVS;
    ctx.db.tables.tournament_division_members = DIV_MEMBERS;
    ctx.db.tables.profiles = PROFILES;
    return ctx.mount(<TournamentDivisionsView tournamentId="t1" currentUserId="local" />, th);
  } },
  { name: 'wod-détail', run: async (ctx, th) => { ctx.route.params = wodParams(); return ctx.mount(<TournamentWODScreen />, th); } },
  { name: 'wod-soumission', run: async (ctx, th) => {
    ctx.route.params = wodParams();
    const root = await ctx.mount(<TournamentWODScreen />, th);
    await pressText(root, ts('tourWod.submitScore'));
    return root;
  } },
  { name: 'wod-envoyé', run: async (ctx, th) => {
    ctx.route.params = wodParams();
    const root = await ctx.mount(<TournamentWODScreen />, th);
    await pressText(root, ts('tourWod.submitScore'));
    await pressText(root, ts('tourWod.submitScoreCta'));
    return root;
  } },
];
