/**
 * Programmation (Marketplace du gérant) : une seule pastille « Hybrid », qui
 * retient les programmes des deux valeurs enregistrées 'hybrid' et 'hyrox'
 * (aucune valeur en base ne change). Monté avec le vrai react-native.
 */
import React, { useEffect as mockUseEffect } from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import BOProgrammingScreen from '../screens/backoffice/BOProgrammingScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../context/AuthContext', () => {
  const mockAuth = { user: { id: 'me' }, currentBox: { id: 'b1', name: 'Box Alpha' } };
  return { useAuth: () => mockAuth };
});
jest.mock('../context/ThemeContext', () => {
  const { lightTheme } = jest.requireActual('../theme/palette');
  const mockValue = { theme: lightTheme };
  return { useTheme: () => mockValue };
});
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../components/glass/GlassBackground', () => () => null);
const item = (id: string, title: string, discipline: string) => ({
  programming_id: id, publisher_box_id: 'b9', title, description: null, discipline, level: null,
  days_per_week: 3, weeks_count: 4, billing: 'free', price_cents: 0, currency: 'eur', publisher_box_name: 'Box Nine',
});
jest.mock('../lib/supabase', () => {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
  return {
    supabase: {
      from: () => q,
      rpc: async () => ({
        data: [item('p1', 'Engine Race', 'hyrox'), item('p2', 'Hybrid Base', 'hybrid'), item('p3', 'Mixed Bag', 'crossfit')],
        error: null,
      }),
    },
  };
});

let r: TestRenderer.ReactTestRenderer;
beforeAll(async () => { await i18n.changeLanguage('fr'); });
afterEach(async () => { if (r) await act(async () => r.unmount()); });

const text = (n: ReactTestInstance) => [n.props.children].flat().join('');
const titles = () => r.root.findAllByType(Text).map(text).filter((s) => ['Engine Race', 'Hybrid Base', 'Mixed Bag'].includes(s));
// Une pastille par testID (le composant et sa vue native portent le même).
const chips = () => r.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('programming-discipline-') && typeof n.props.onPress === 'function')
  .filter((n, i, all) => all.findIndex((m) => m.props.testID === n.props.testID) === i);

async function mount() {
  await act(async () => { r = TestRenderer.create(<BOProgrammingScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />); });
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((res) => setImmediate(res)); });
}

describe('Programmation : pastille « Hybrid »', () => {
  it('une seule pastille « Hybrid » parmi les disciplines', async () => {
    await mount();
    const labels = chips().map((c) => c.findAllByType(Text).map(text).join(''));
    expect(labels).toEqual(['Functional', 'Hybrid', 'Haltéro', 'Endurance']);
  });

  it('elle retient les programmes « hybrid » et « hyrox », et eux seuls', async () => {
    await mount();
    expect(titles()).toEqual(['Engine Race', 'Hybrid Base', 'Mixed Bag']);
    const hybrid = chips().find((c) => c.props.testID === 'programming-discipline-hybrid')!;
    await act(async () => { hybrid.props.onPress(); });
    expect(titles()).toEqual(['Engine Race', 'Hybrid Base']);
  });

  it('la pastille « Functional » ne retient que « crossfit »', async () => {
    await mount();
    const functional = chips().find((c) => c.props.testID === 'programming-discipline-crossfit')!;
    await act(async () => { functional.props.onPress(); });
    expect(titles()).toEqual(['Mixed Bag']);
  });
});
