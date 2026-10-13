/**
 * Validation d'un score de tournoi au back-office de l'app, montée avec le vrai
 * react-native : `movement_rep_counts` ne reçoit que des clés du catalogue.
 * Un en-tête (« 12 min AMRAP ») ou un mouvement hors catalogue n'y écrit rien.
 * Client Supabase simulé, aucune base.
 */
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme as mockTheme } from '../theme/palette';
import i18n from '../i18n';
import BOTournamentScreen from '../screens/backoffice/BOTournamentScreen';

const mockWrites: { table: string; op: string; row: Record<string, unknown> }[] = [];
const mockScore = {
  id: 's1', athlete_id: 'a1', status: 'pending', score_value: '40', capped: false, video_url: null,
  submitted_at: '2026-10-01T00:00:00Z',
  tw: { title: 'WOD 1', type: 'AMRAP', movements: ['12 min AMRAP', '10 Thrusters', '10 Sandbag cleans'] },
};

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }) }));
jest.mock('../context/AuthContext', () => {
  const box = { id: 'box-1', owner_id: 'P' };
  return { useAuth: () => ({ user: { id: 'P' }, currentBox: box }) };
});
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../services/notifications', () => ({ sendTournamentClosedNotification: jest.fn() }));
jest.mock('../services/gamification', () => ({
  incrementCounter: jest.fn(), checkAndAwardBadges: jest.fn(), movementBadgesCrossed: jest.fn(async () => []),
}));
jest.mock('../utils/eloLevels', () => ({ syncLevelAndBadges: jest.fn() }));
jest.mock('../utils/classementTournoi', () => ({
  chargerClassement: jest.fn(async () => ({ lignes: [], rangs: [] })), classementGeneral: jest.fn(() => []),
}));
jest.mock('../lib/supabase', () => {
  function from(table: string) {
    const q: Record<string, unknown> = {};
    let write: { op: string; row: Record<string, unknown> } | null = null;
    const rows = () => {
      if (table === 'tournaments') return [{ id: 't1', name: 'T', status: 'active', end_date: null }];
      if (table === 'tournament_scores') return [mockScore];
      if (table === 'profiles') return [{ id: 'a1', username: 'athlete-1', level: 'rx', elo: 1000 }];
      return [];
    };
    for (const m of ['select', 'eq', 'is', 'order', 'in', 'limit']) q[m] = () => q;
    q.update = (row: Record<string, unknown>) => { write = { op: 'update', row }; mockWrites.push({ table, ...write }); return q; };
    q.insert = (row: Record<string, unknown>) => { write = { op: 'insert', row }; mockWrites.push({ table, ...write }); return q; };
    q.upsert = q.insert;
    q.maybeSingle = async () => ({ data: null, error: null });
    q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(write ? { data: null, error: null } : { data: rows(), error: null }).then(res, rej);
    return q;
  }
  return { supabase: { from, rpc: async () => ({ data: [{ gender: 'male' }], error: null }) } };
});

const label = (n: ReactTestInstance) => n.findAllByType(Text).map(x => {
  const c = x.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
}).join(' ');
const press = async (r: TestRenderer.ReactTestRenderer, text: string, exact = false) => {
  const b = r.root.findAllByType(TouchableOpacity).find(n => (exact ? label(n).trim() === text : label(n).includes(text)));
  if (!b) throw new Error(`bouton « ${text} » absent`);
  await act(async () => { b.props.onPress(); });
};

beforeAll(async () => { await i18n.changeLanguage('fr'); });

it('valider un AMRAP « 12 min AMRAP / 10 Thrusters / 10 Sandbag cleans » à 40 reps : seul thruster est écrit', async () => {
  const alerts = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<BOTournamentScreen />); });
  await press(r, '⚖️');
  await press(r, 'athlete-1');
  await press(r, i18n.t('bo.tournament.validate'), true);

  const confirm = alerts.mock.calls[0][2]!.find(b => b.text === i18n.t('bo.tournament.validate'))!;
  await act(async () => { await confirm.onPress!(); });

  const reps = mockWrites.filter(w => w.table === 'movement_rep_counts');
  expect(reps.map(w => [w.op, w.row.movement_key, w.row.total_reps])).toEqual([['insert', 'thruster', 20]]);
  expect(mockWrites.some(w => w.table === 'tournament_scores' && w.row.status === 'validated')).toBe(true);
});
