import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { HomeStackParamList } from '../navigation';
import i18n from '../i18n';
import TimerRunScreen from '../screens/timer/TimerRunScreen';

let mockParams: HomeStackParamList['TimerRun'];
const mockNavigation = { getParent: () => undefined, addListener: () => () => {}, goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null, currentBox: null }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: { tabBar: '#000', tabBarBorder: '#333', ax: jest.requireActual('../theme/palette').darkTheme.ax } }) }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}) }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => {} }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
  useMicrophonePermissions: () => [{ granted: true }, jest.fn()],
}));
jest.mock('expo-media-library', () => ({ usePermissions: () => [{ granted: true }, jest.fn()] }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '', EncodingType: { Base64: 'base64' }, writeAsStringAsync: jest.fn(async () => {}),
}));
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(async () => {}),
    Sound: { createAsync: jest.fn(async () => ({ sound: {
      setVolumeAsync: jest.fn(async () => {}), replayAsync: jest.fn(async () => {}), unloadAsync: jest.fn(async () => {}),
    } })) },
  },
  InterruptionModeIOS: { MixWithOthers: 0 }, InterruptionModeAndroid: { DuckOthers: 0 },
}));
jest.mock('expo-screen-orientation', () => ({
  OrientationLock: { PORTRAIT_UP: 0 },
  lockAsync: jest.fn(async () => {}), unlockAsync: jest.fn(async () => {}),
}));
jest.mock('realtime-recorder', () => ({ RealtimeRecorderView: 'Recorder' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-view-shot', () => 'ViewShot');
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(async () => 'local'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

let renderer: TestRenderer.ReactTestRenderer;

beforeEach(() => {
  jest.useFakeTimers();
  mockParams = {
    timerType: 'splits', countdown: 0, totalSeconds: 0, maxTime: 0, interval: 1,
    rounds: 4, workTime: 102, restTime: 0, withCamera: false, sequence: '', videoTitle: '', withTimestamp: false,
  };
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
});

const byId = (id: string) => renderer.root.findAll((node) => node.props.testID === id);
const text = (id: string) => React.Children.toArray(
  renderer.root.findAll((node) => node.type === Text && node.props.testID === id)[0].props.children).join('');
const allText = () => renderer.root.findAll((node) => node.type === Text)
  .map((node) => React.Children.toArray(node.props.children).join(''));

async function press(id: string) {
  const target = byId(id).find((node) => typeof node.props.onPress === 'function');
  if (!target) throw new Error(`Bouton absent : ${id}`);
  await act(async () => { target.props.onPress(); });
}

async function waitingAfterRound1() {
  await act(async () => { renderer = TestRenderer.create(<TimerRunScreen />); });
  await press('timer-start-stop');
  await act(async () => { jest.advanceTimersByTime(102 * 1000); });
}

it('affiche le round suivant, les pastilles et le round qui vient de se terminer', async () => {
  expect(i18n.t('timer.splits.tapToStart')).not.toBe('timer.splits.tapToStart');
  await waitingAfterRound1();
  expect(text('timer-splits-round')).toBe('ROUND 2 / 4');
  for (const id of ['timer-splits-dot-1-done', 'timer-splits-dot-2-next', 'timer-splits-dot-3-todo', 'timer-splits-dot-4-todo']) {
    expect(byId(id).length).toBeGreaterThan(0);
  }
  // Durée du round terminé = workTime formaté (le round Splits s'arrête seul à 0).
  expect(text('timer-splits-done-time')).toBe('01:42');
  expect(allText()).toEqual(expect.arrayContaining([
    i18n.t('timer.splits.tapToStart'), i18n.t('timer.splits.hint'), i18n.t('timer.splits.doneRound', { n: 1 }),
  ]));
}, 20_000);

it("toucher l'écran lance le round suivant", async () => {
  await waitingAfterRound1();
  await press('timer-splits-overlay');
  expect(byId('timer-splits-overlay')).toHaveLength(0);
  await act(async () => { jest.advanceTimersByTime(102 * 1000); });
  expect(text('timer-splits-round')).toBe('ROUND 3 / 4');
  expect(byId('timer-splits-dot-2-done').length).toBeGreaterThan(0);
  expect(allText()).toContain(i18n.t('timer.splits.doneRound', { n: 2 }));
}, 20_000);

it('passe ses textes par la traduction (anglais)', async () => {
  const before = i18n.language;
  await act(async () => { await i18n.changeLanguage('en'); });
  try {
    await waitingAfterRound1();
    expect(allText()).toEqual(expect.arrayContaining(['TAP TO START', 'Free rest · Tap anywhere']));
  } finally {
    await act(async () => { await i18n.changeLanguage(before); });
  }
}, 20_000);
