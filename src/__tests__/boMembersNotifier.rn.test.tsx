/**
 * D4b, PR 2b : raccourci « Envoyer une notification » dans la fiche membre (Figma 482:3303),
 * qui ouvre les notifications du gérant avec ce membre présélectionné. Banc repris de
 * boMembersCoOwner.rn.test.tsx (vrai react-native, client Supabase simulé).
 */
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme as mockTheme } from '../theme/palette';
import i18n from '../i18n';
import BOMembersScreen from '../screens/backoffice/BOMembersScreen';
import { AxButton } from '../components/ax';
import { Bell } from 'lucide-react-native';

type Row = { id: string; box_id: string; member_id: string; joined_at: string; status: string; role: string; profile: { username: string; level: string; elo: number } };
const row = (id: string, role: string, status = 'active'): Row => ({
  id: `r-${id}`, box_id: 'box-1', member_id: id, joined_at: '2026-01-01T00:00:00Z', status, role,
  profile: { username: `user-${id}`, level: 'rx', elo: 1000 },
});

let mockUserId = 'P';
let mockRows: Row[] = [];
let mockUpdateResult: { data: unknown; error: unknown } = { data: [{ id: 'x' }], error: null };
const mockUpdates: Record<string, unknown>[] = [];
let mockLoads = 0;

jest.mock('../context/AuthContext', () => {
  const box = { id: 'box-1', owner_id: 'P' };
  const users: Record<string, { id: string }> = {};
  return { useAuth: () => ({ user: (users[mockUserId] ??= { id: mockUserId }), currentBox: box }) };
});
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../lib/supabase', () => {
  function from(table: string) {
    const q: Record<string, unknown> = {};
    let update: Record<string, unknown> | null = null;
    q.select = () => q;
    q.eq = () => q;
    q.limit = () => q;
    q.update = (v: Record<string, unknown>) => { update = v; mockUpdates.push(v); return q; };
    q.order = () => { if (table === 'box_members') mockLoads += 1; return q; };
    q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(
      update ? mockUpdateResult : { data: table === 'box_members' ? mockRows : [], error: null },
    ).then(res, rej);
    return q;
  }
  return {
    supabase: {
      from,
      rpc: async (name: string) => {
        if (name === 'reactivate_box_member') { mockUpdates.push({ rpc: name }); return mockUpdateResult; }
        return { data: [], error: null };
      },
    },
  };
});

const texts = (root: ReactTestInstance) => root.findAllByType(Text).map(n => {
  const c = n.props.children;
  return Array.isArray(c) ? c.join('') : String(c);
});

const mockNavigate = jest.fn();
async function mountAndOpen(username: string) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<BOMembersScreen navigation={{ goBack: jest.fn(), navigate: mockNavigate }} />); });
  const target = r.root.findAllByType(TouchableOpacity).find(b => texts(b).includes(username));
  if (!target) throw new Error(`ligne ${username} absente`);
  await act(async () => { target.props.onPress(); });
  return r;
}

const byTestID = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.findAllByType(TouchableOpacity).filter(n => n.props.testID === id);

beforeAll(async () => { await i18n.changeLanguage('fr'); });
beforeEach(() => {
  mockUserId = 'P';
  mockRows = [row('P', 'owner'), row('M', 'member'), row('B', 'member', 'banned'), row('K', 'coach')];
  mockUpdates.length = 0;
  mockNavigate.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const bouton = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType(AxButton).filter((b) => b.props.testID === 'members-send-notification');

describe('fiche membre : « Envoyer une notification »', () => {
  it('membre actif : bouton contour avec la cloche, au-dessus de « Promouvoir coach »', async () => {
    const r = await mountAndOpen('user-M');
    const b = bouton(r);
    expect(b).toHaveLength(1);
    expect([b[0].props.variant, b[0].props.icon, b[0].props.label, b[0].props.fullWidth]).toEqual(['outline', Bell, 'Envoyer une notification', true]);
    const ordre = texts(r.root);
    expect(ordre.indexOf('Envoyer une notification')).toBeGreaterThanOrEqual(0);
    expect(ordre.indexOf('Envoyer une notification')).toBeLessThan(ordre.indexOf('Promouvoir coach'));
  });

  it('appui : ferme la fiche et ouvre les notifications avec ce membre présélectionné', async () => {
    const r = await mountAndOpen('user-M');
    await act(async () => { bouton(r)[0].props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('BODashboard', { screen: 'BONotifications', params: { memberId: 'M' } });
    expect(bouton(r)).toHaveLength(0);
  });

  it('coach actif : bouton présent aussi', async () => {
    expect(bouton(await mountAndOpen('user-K'))).toHaveLength(1);
  });

  it('membre banni : pas de bouton (il ne recevrait rien)', async () => {
    expect(bouton(await mountAndOpen('user-B'))).toHaveLength(0);
  });
});
