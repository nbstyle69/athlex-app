/**
 * Retours du build 1.0.60, D1 : pas de bip sans caméra sur iPhone.
 *
 * Le mode audio n'était posé qu'à l'ouverture de l'écran. Sans caméra, rien ne
 * le reposait avant les bips : si iOS avait changé la session entre-temps
 * (passage par la caméra, interruption), le minuteur bipait dans une session mal
 * réglée. Il est désormais reposé, avec la même configuration, à chaque
 * lancement sans caméra, et attendu avant le premier bip. Le parcours caméra
 * n'est pas changé (handleStartRecording le repose déjà avant l'enregistrement).
 */
import React from 'react';
import { Dimensions, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import type { HomeStackParamList } from '../navigation';
import { captureError } from '../lib/sentry';
import TimerRunScreen from '../screens/timer/TimerRunScreen';

let mockParams: unknown;
const mockNavigation = { navigate: jest.fn(), getParent: () => undefined, addListener: () => () => {}, goBack: jest.fn(), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null, currentBox: null }) }));
jest.mock('../context/ThemeContext', () => {
  const { darkTheme: th } = jest.requireActual('../theme/palette');
  return { useTheme: () => ({ theme: th }) };
});
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(async () => {}) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => {} }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
  useMicrophonePermissions: () => [{ granted: true }, jest.fn()],
}));
jest.mock('expo-media-library', () => ({ usePermissions: () => [{ granted: true }, jest.fn()], saveToLibraryAsync: jest.fn(async () => {}) }));
const mockWrite = jest.fn(async (_p: string, _d: string, _o: unknown) => {});
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/', documentDirectory: 'file:///docs/', EncodingType: { Base64: 'base64' },
  writeAsStringAsync: (p: string, d: string, o: unknown) => mockWrite(p, d, o),
}));
/** Ordre des événements audio : « mode » (setAudioModeAsync) et « bip » (replayAsync). */
const mockJournal: string[] = [];
// « mode » est noté à la RÉSOLUTION (après quelques tours de microtâches, comme un
// aller-retour natif) : un appel non attendu laisserait passer le bip avant lui.
const mockSetAudioMode = jest.fn(async (_o: unknown) => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  mockJournal.push('mode');
});
const mockReplay = jest.fn(async (_uri: string) => { mockJournal.push('bip'); });
const mockCreate = jest.fn(async ({ uri }: { uri: string }) => ({ sound: {
  setVolumeAsync: jest.fn(async () => {}), replayAsync: () => mockReplay(uri), unloadAsync: jest.fn(async () => {}),
} }));
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: (o: unknown) => mockSetAudioMode(o),
    Sound: { createAsync: (s: { uri: string }) => mockCreate(s) },
  },
  InterruptionModeIOS: { MixWithOthers: 0 }, InterruptionModeAndroid: { DuckOthers: 0 },
}));
jest.mock('expo-screen-orientation', () => ({
  OrientationLock: { PORTRAIT_UP: 0, ALL: 1, LANDSCAPE: 2, LANDSCAPE_LEFT: 3, LANDSCAPE_RIGHT: 4 },
  Orientation: { PORTRAIT_UP: 1, LANDSCAPE_LEFT: 3, LANDSCAPE_RIGHT: 4 },
  getOrientationAsync: jest.fn(async () => 1),
  lockAsync: jest.fn(async () => {}), unlockAsync: jest.fn(async () => {}),
}));
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(async () => 'id'), cancelScheduledNotificationAsync: jest.fn(async () => {}),
}));
const mockStartRec = jest.fn(async (_o: unknown) => {});
const mockMarkBeep = jest.fn();
jest.mock('realtime-recorder', () => ({
  RealtimeRecorderView: 'Recorder',
  startRecording: (o: unknown) => mockStartRec(o),
  stopRecording: async () => '/docs/video.mp4',
  updateOverlayState: () => {},
  getLastRecordingStats: () => ({ expectedFrames: 0, writtenFrames: 0 }),
  markBeep: (t: string) => mockMarkBeep(t),
}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-view-shot', () => {
  const R = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return class ViewShot extends R.Component { render() { return R.createElement(View, this.props); } };
});
jest.mock('expo-video', () => ({ VideoView: 'VideoView', useVideoPlayer: () => ({}) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: jest.fn() }));

const PORTRAIT = { width: 390, height: 844, scale: 3, fontScale: 1 };
let renderer: TestRenderer.ReactTestRenderer | null = null;
beforeEach(async () => {
  act(() => { Dimensions.set({ window: PORTRAIT, screen: PORTRAIT }); });
  await AsyncStorage.clear();
  jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  jest.restoreAllMocks();
  [mockWrite, mockReplay, mockCreate, mockStartRec, mockMarkBeep, mockSetAudioMode, captureError as jest.Mock].forEach((m) => m.mockClear());
  mockJournal.length = 0;
});


const SANS_CAMERA = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: 0,
  interruptionModeAndroid: 0,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
};
const BASE: HomeStackParamList['TimerRun'] = {
  timerType: 'for-time', countdown: 3, totalSeconds: 0, maxTime: 0, interval: 0, rounds: 1, workTime: 0, restTime: 0,
  withCamera: false, videoTitle: '', withTimestamp: false, sequence: '[]',
};
async function run(params: Partial<HomeStackParamList['TimerRun']> = {}) {
  mockParams = { ...BASE, ...params };
  await act(async () => { renderer = TestRenderer.create(<TimerRunScreen />); });
  await act(async () => {});
  await act(async () => {});
  return renderer!.root;
}
const actif = (root: ReactTestInstance, testID: string) =>
  root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === 'function')[0];
async function appuyer(root: ReactTestInstance, testID: string) {
  await act(async () => { await actif(root, testID).props.onPress(); });
}
async function secondes(n: number) {
  for (let i = 0; i < n; i++) await act(async () => { jest.advanceTimersByTime(1000); });
}

describe('D1 : mode audio reposé à chaque lancement sans caméra', () => {
  it('ouverture puis lancement : deux fois la même configuration, la seconde avant le premier bip', async () => {
    jest.useFakeTimers();
    const root = await run();
    expect(mockSetAudioMode.mock.calls).toEqual([[SANS_CAMERA]]);
    await appuyer(root, 'timer-start-stop');
    expect(mockSetAudioMode.mock.calls).toEqual([[SANS_CAMERA], [SANS_CAMERA]]);
    await secondes(4); // décompte 3, 2, 1, GO
    expect(mockJournal.slice(0, 3)).toEqual(['mode', 'mode', 'bip']);
    expect(mockReplay).toHaveBeenCalled();
  });

  it('deuxième lancement sur le même écran (arrêt, Recommencer, Démarrer) : reposé de nouveau avant ses bips', async () => {
    jest.useFakeTimers();
    const root = await run();
    await appuyer(root, 'timer-start-stop');
    await secondes(5);
    await appuyer(root, 'timer-start-stop'); // arrêt → temps final
    await appuyer(root, 'timer-reset');
    const avant = mockJournal.length;
    await appuyer(root, 'timer-start-stop');
    expect(mockSetAudioMode).toHaveBeenCalledTimes(3);
    expect(mockSetAudioMode.mock.calls[2]).toEqual([SANS_CAMERA]);
    await secondes(4);
    const suite = mockJournal.slice(avant);
    expect(suite[0]).toBe('mode');
    expect(suite).toContain('bip');
  });

  it('sans décompte : le mode est reposé avant le bip GO immédiat', async () => {
    jest.useFakeTimers();
    const root = await run({ countdown: 0 });
    await appuyer(root, 'timer-start-stop');
    await act(async () => {});
    expect(mockJournal.slice(0, 3)).toEqual(['mode', 'mode', 'bip']);
  });

  it("un échec de setAudioModeAsync au lancement est signalé et n'empêche pas le minuteur de partir", async () => {
    jest.useFakeTimers();
    const root = await run();
    mockSetAudioMode.mockImplementationOnce(async () => { throw new Error('session refusée'); });
    await appuyer(root, 'timer-start-stop');
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { screen: 'TimerRun', action: 'setAudioMode' });
    await secondes(4);
    expect(mockReplay).toHaveBeenCalled();
  });
});
