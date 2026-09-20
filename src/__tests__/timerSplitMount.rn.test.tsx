import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { HomeStackParamList } from '../navigation';
import { buildSplitBlock } from '../utils/wodToTimer';
import TimerRunScreen from '../screens/timer/TimerRunScreen';

let mockParams: HomeStackParamList['TimerRun'];
const mockNavigation = { getParent: () => undefined, addListener: () => () => {}, goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null, currentBox: null }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: { tabBar: '#000', tabBarBorder: '#333' } }) }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}) }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => {} }));
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
    timerType: 'libre', countdown: 0, totalSeconds: 0, maxTime: 0, interval: 1,
    rounds: 1, workTime: 0, restTime: 0, withCamera: false, videoTitle: '', withTimestamp: false,
    sequence: JSON.stringify([buildSplitBlock([
      { name: 'Squat', sets: 2, restSec: 3 }, { name: 'Pompes', sets: 1, restSec: 0 },
    ])]),
  };
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
});

async function mount() {
  await act(async () => { renderer = TestRenderer.create(<TimerRunScreen />); });
}

async function press(id: string) {
  const button = renderer.root.findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
  if (!button) throw new Error(`Bouton absent : ${id}`);
  await act(async () => { button.props.onPress(); });
}

async function tick(seconds: number) {
  await act(async () => { jest.advanceTimersByTime(seconds * 1000); });
}

function text(id: string) {
  return React.Children.toArray(renderer.root.findAll((node) => node.type === Text && node.props.testID === id)[0].props.children).join('');
}

it('remet le chrono à zéro au prochain exercice, conserve le total et affiche les deux à chaque split', async () => {
  await mount();
  await press('timer-start-stop');
  await tick(5);
  expect(text('timer-main-time')).toBe('00:05');
  expect(text('timer-total')).toBe('TOTAL 00:05');
  await press('timer-split-done');
  await tick(3);
  await tick(4);
  expect(text('timer-main-time')).toBe('00:12');
  await press('timer-split-done');
  expect(text('timer-main-time')).toBe('00:00');
  expect(text('timer-total')).toBe('TOTAL 00:12');
  await tick(1);
  await press('timer-split-done');
  await tick(6);
  expect(text('timer-main-time')).toBe('00:07');
  expect(text('timer-total')).toBe('TOTAL 00:19');
  await press('timer-split-done');
  expect(text('timer-final-time')).toBe('00:19');
  expect(text('timer-split-0')).toBe('Squat · série 1/2 — exercice 00:05 · total 00:05');
  expect(text('timer-split-1')).toBe('Squat · série 2/2 — exercice 00:12 · total 00:12');
  expect(text('timer-split-2')).toBe('Pompes · série 1/1 — exercice 00:07 · total 00:19');
  await press('timer-reset');
  expect(text('timer-main-time')).toBe('00:00');
  expect(text('timer-total')).toBe('TOTAL 00:00');
  await press('timer-start-stop');
  await tick(2);
  await press('timer-start-stop');
  expect(text('timer-final-time')).toBe('00:02');
  expect(renderer.root.findAll((node) => node.props.testID === 'timer-split-0')).toHaveLength(0);
}, 20_000);

it('conserve les vrais temps et pauses entre plusieurs blocs Split', async () => {
  const first = buildSplitBlock([{ name: 'Row', sets: 1, restSec: 0 }]);
  first.pauseSec = 2;
  const second = buildSplitBlock([{ name: 'Run', sets: 1, restSec: 0 }]);
  mockParams.sequence = JSON.stringify([first, second]);
  await mount();
  await press('timer-start-stop');
  await tick(4);
  await press('timer-split-done');
  await tick(2);
  expect(text('timer-main-time')).toBe('00:00');
  expect(text('timer-total')).toBe('TOTAL 00:06');
  await tick(3);
  await press('timer-split-done');
  expect(text('timer-final-time')).toBe('00:09');
  expect(text('timer-split-1')).toBe('Run 1/1 — exercice 00:03 · total 00:09');
});
