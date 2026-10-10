/**
 * WOD de tournoi : un seul compte à rebours actif à la fois, aucun après le démontage.
 * startCountdown remplaçait l'intervalle du montage sans l'arrêter ; il tournait
 * ensuite indéfiniment, même écran quitté.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import '../i18n';
import TournamentWODScreen from '../screens/competition/TournamentWODScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: {
    tournamentId: 't1', tournamentName: 'Fall Cup', requireVideoProof: false, existingScore: null,
    wod: { id: 'w1', title: 'Engine', type: 'amrap', description: '10 burpees', time_cap: 12, deadline_hours: 24 },
  } }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' }, currentBox: { id: 'box1' } }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').lightTheme }) }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 0, useTabBarFootprint: () => 0 }));

// Seuls setInterval / clearInterval sont simulés : getTimerCount() compte les intervalles actifs.
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'setTimeout', 'clearTimeout',
    'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'] });
});
afterEach(() => { jest.useRealTimers(); });

it('relancer le compte à rebours arrête le précédent, démonter arrête tout', async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<TournamentWODScreen />); });
  expect(jest.getTimerCount()).toBe(1);

  const submit = r.root.find((n) => n.props.testID === 'tourwod-submit-manual' && typeof n.props.onPress === 'function');
  await act(async () => { submit.props.onPress(); });
  expect(jest.getTimerCount()).toBe(1);

  await act(async () => { r.unmount(); });
  expect(jest.getTimerCount()).toBe(0);
});
