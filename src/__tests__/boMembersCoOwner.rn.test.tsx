/**
 * Écran Membres du gérant monté avec le vrai react-native : règle du co-gérant (garde
 * 20270139) et refus d'écriture. Client Supabase simulé, aucune base.
 */
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme as mockTheme } from '../theme/palette';
import i18n from '../i18n';
import BOMembersScreen from '../screens/backoffice/BOMembersScreen';

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

async function mountAndOpen(username: string) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<BOMembersScreen navigation={{ goBack: jest.fn() }} />); });
  const target = r.root.findAllByType(TouchableOpacity).find(b => texts(b).includes(username));
  if (!target) throw new Error(`ligne ${username} absente`);
  await act(async () => { target.props.onPress(); });
  return r;
}

const byTestID = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.findAllByType(TouchableOpacity).filter(n => n.props.testID === id);

beforeAll(async () => { await i18n.changeLanguage('fr'); });
beforeEach(() => {
  mockRows = [row('P', 'owner'), row('C1', 'owner'), row('C2', 'owner'), row('M', 'member')];
  mockUpdateResult = { data: [{ id: 'x' }], error: null };
  mockUpdates.length = 0;
  mockLoads = 0;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const RESERVED = 'Seul le gérant principal de la box peut nommer ou retirer un co-gérant.';

describe('co-gérant connecté', () => {
  beforeEach(() => { mockUserId = 'C1'; });

  it('ligne d’un autre co-gérant : aucune action, explication affichée', async () => {
    const r = await mountAndOpen('user-C2');
    expect(byTestID(r, 'members-toggle-coach')).toHaveLength(0);
    expect(byTestID(r, 'members-toggle-status')).toHaveLength(0);
    expect(texts(r.root)).toContain(RESERVED);
  });

  it('ligne du gérant principal : aucune action non plus', async () => {
    const r = await mountAndOpen('user-P');
    expect(byTestID(r, 'members-toggle-status')).toHaveLength(0);
    expect(texts(r.root)).toContain(RESERVED);
  });

  it('ligne d’un membre : choix coach seulement, jamais co-gérant', async () => {
    const r = await mountAndOpen('user-M');
    expect(byTestID(r, 'members-toggle-coach')).toHaveLength(1);
    expect(texts(r.root)).not.toContain(RESERVED);
    await act(async () => { byTestID(r, 'members-toggle-coach')[0].props.onPress(); });
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { onPress?: () => Promise<void> }[];
    await act(async () => { await buttons[1].onPress?.(); });
    expect(mockUpdates).toEqual([{ role: 'coach' }]);
  });

  it('sa propre ligne : pas réservée, statut modifiable (renonciation)', async () => {
    const r = await mountAndOpen('user-C1');
    expect(texts(r.root)).not.toContain(RESERVED);
    expect(byTestID(r, 'members-toggle-status')).toHaveLength(1);
  });
});

describe('gérant principal connecté', () => {
  beforeEach(() => { mockUserId = 'P'; });

  it('garde les actions sur la ligne d’un co-gérant', async () => {
    const r = await mountAndOpen('user-C2');
    expect(byTestID(r, 'members-toggle-status')).toHaveLength(1);
    expect(texts(r.root)).not.toContain(RESERVED);
  });
});

describe('écriture refusée par la base', () => {
  beforeEach(() => { mockUserId = 'P'; });

  async function promoteMember() {
    const r = await mountAndOpen('user-M');
    await act(async () => { byTestID(r, 'members-toggle-coach')[0].props.onPress(); });
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { onPress?: () => Promise<void> }[];
    const loadsBefore = mockLoads;
    await act(async () => { await buttons[1].onPress?.(); });
    return { r, loadsBefore };
  }

  it('42501 MEMBRE_ROLE_COGERANT_RESERVE : message clair, liste relue depuis la base', async () => {
    mockUpdateResult = { data: null, error: { code: '42501', message: 'MEMBRE_ROLE_COGERANT_RESERVE: seul le gérant principal nomme ou retire un co-gérant.' } };
    const { r, loadsBefore } = await promoteMember();
    expect((Alert.alert as jest.Mock).mock.calls[1]).toEqual([i18n.t('common.error'), RESERVED]);
    expect(mockLoads).toBe(loadsBefore + 1);
    expect(texts(r.root)).not.toContain('COACH');
  });

  it('aucune ligne modifiée : traité comme un échec', async () => {
    mockUpdateResult = { data: [], error: null };
    await promoteMember();
    expect((Alert.alert as jest.Mock).mock.calls[1]).toEqual([
      i18n.t('common.error'), "La modification n'a pas été enregistrée. Actualise la liste et réessaie.",
    ]);
  });

  it('écriture enregistrée : pas de message d’erreur', async () => {
    await promoteMember();
    expect((Alert.alert as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('bannissement sans ligne modifiée : échec signalé', async () => {
    mockUpdateResult = { data: [], error: null };
    const r = await mountAndOpen('user-M');
    await act(async () => { byTestID(r, 'members-toggle-status')[0].props.onPress(); });
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { onPress?: () => Promise<void> }[];
    await act(async () => { await buttons[1].onPress?.(); });
    expect(mockUpdates).toEqual([{ status: 'banned' }]);
    expect((Alert.alert as jest.Mock).mock.calls[1][1]).toBe("La modification n'a pas été enregistrée. Actualise la liste et réessaie.");
  });
});
