/**
 * Retours du build 1.0.60, D7 : la musique de l'utilisateur baissait au premier bip
 * du décompte et ne remontait plus (constaté sur Android).
 *
 * Sur Android, expo-av demande le focus audio (GAIN_TRANSIENT_MAY_DUCK) à chaque
 * lecture et ne le rend que si plus aucun son n'a shouldPlay à true. Un bip fini le
 * garde à true : le focus n'était jamais rendu et Android laissait la musique baissée
 * jusqu'à la sortie de l'écran. Chaque bip est désormais arrêté (stopAsync) dès qu'il
 * est fini, ce qui rend le focus. iOS mélange sans baisser : rien n'y change.
 *
 * Journal : « mode » (setAudioModeAsync résolu), « bip » (replayAsync), « rendu »
 * (stopAsync, focus rendu), « décharge » (unloadAsync). Le natif signale la fin d'un
 * bip 400 ms après son départ, comme expo-av (didJustFinish).
 */
jest.setTimeout(20000);

import React from 'react';
import { Dimensions, Platform, Vibration } from 'react-native';
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
/** Journal des événements audio, dans l’ordre. */
const mockJournal: string[] = [];
// « mode » est noté à la RÉSOLUTION (après quelques tours de microtâches, comme un
// aller-retour natif) : un appel non attendu laisserait passer le bip avant lui.
const mockSetAudioMode = jest.fn(async (_o: unknown) => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  mockJournal.push('mode');
});
const mockReplay = jest.fn(async (_uri: string) => { mockJournal.push('bip'); });
const mockCreate = jest.fn(async (s: { uri: string }) => {
  let ecouteur: ((st: unknown) => void) | null = null;
  let decharge = false;
  const sound = {
    setVolumeAsync: jest.fn(async () => {}),
    setOnPlaybackStatusUpdate: jest.fn((f: (st: unknown) => void) => { ecouteur = f; }),
    replayAsync: async () => {
      await mockReplay(s.uri);
      setTimeout(() => { if (!decharge) ecouteur?.({ isLoaded: true, didJustFinish: true }); }, 400);
    },
    stopAsync: jest.fn(async () => { mockJournal.push('rendu'); }),
    unloadAsync: jest.fn(async () => { decharge = true; mockJournal.push('décharge'); }),
  };
  return { sound };
});
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
  Platform.OS = 'android';
});
const OS_INITIAL = Platform.OS;
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  jest.restoreAllMocks();
  [mockWrite, mockReplay, mockCreate, mockStartRec, mockMarkBeep, mockSetAudioMode, captureError as jest.Mock].forEach((m) => m.mockClear());
  mockJournal.length = 0;
  Platform.OS = OS_INITIAL;
});

const SANS_CAM: HomeStackParamList['TimerRun'] = {
  timerType: 'for-time', countdown: 3, totalSeconds: 0, maxTime: 0, interval: 0, rounds: 1, workTime: 0, restTime: 0,
  withCamera: false, videoTitle: '', withTimestamp: false, sequence: '[]',
};
const CAM: HomeStackParamList['TimerRun'] = { ...SANS_CAM, maxTime: 600, interval: 1, withCamera: true };
async function run(params: HomeStackParamList['TimerRun']) {
  mockParams = params;
  await act(async () => { renderer = TestRenderer.create(<TimerRunScreen />); });
  await act(async () => {});
  await act(async () => {});
  return renderer!.root;
}
async function appuyer(root: ReactTestInstance, testID: string) {
  const n = root.findAll((x) => x.props.testID === testID && typeof x.props.onPress === 'function')[0];
  await act(async () => { await n.props.onPress(); });
}
async function secondes(n: number) {
  for (let i = 0; i < n; i++) await act(async () => { jest.advanceTimersByTime(1000); });
}
/** Bips et rendus seuls, dans l'ordre. */
const sons = () => mockJournal.filter((e) => e === 'bip' || e === 'rendu');
/** Chaque bip est suivi de son rendu avant le bip suivant : la musique n'est baissée que pendant un bip. */
function chaqueBipRendu() {
  const s = sons();
  expect(s.length).toBeGreaterThan(0);
  expect(s.join(' ')).toBe(Array(s.length / 2).fill('bip rendu').join(' '));
}

describe('D7 (Android) : le focus audio est rendu après chaque bip', () => {
  it('sans caméra : mode posé avant le premier bip, focus rendu après chaque bip et après le GO', async () => {
    jest.useFakeTimers();
    const root = await run(SANS_CAM);
    await appuyer(root, 'timer-start-stop');
    await secondes(5); // 3, 2, 1, GO, puis une seconde de chrono
    expect(mockJournal.slice(0, 2)).toEqual(['mode', 'mode']);
    expect(mockJournal.indexOf('mode', 1)).toBeLessThan(mockJournal.indexOf('bip'));
    expect(sons().filter((e) => e === 'bip')).toHaveLength(4);
    chaqueBipRendu();
  });

  it('sans caméra, au stop : le bip de fin rend lui aussi le focus', async () => {
    jest.useFakeTimers();
    const root = await run(SANS_CAM);
    await appuyer(root, 'timer-start-stop');
    await secondes(5);
    const avant = sons().length;
    await appuyer(root, 'timer-start-stop'); // arrêt → bip de fin
    expect(sons().slice(avant)).toEqual(['bip']);
    await secondes(1);
    expect(sons().slice(avant)).toEqual(['bip', 'rendu']);
    chaqueBipRendu();
  });

  it('avec caméra : mode reposé avant l’enregistrement, focus rendu après chaque bip, au stop et à la fin de la vidéo', async () => {
    jest.useFakeTimers();
    const root = await run(CAM);
    await appuyer(root, 'timer-cam-primary'); // démarre l'enregistrement
    await act(async () => {});
    expect(mockJournal).toEqual(['mode', 'mode']); // ouverture, puis juste avant l'enregistrement
    expect(mockStartRec).toHaveBeenCalled();
    await appuyer(root, 'timer-cam-primary'); // lance le chrono
    await secondes(5);
    await appuyer(root, 'timer-cam-primary'); // arrête le chrono → bip de fin
    await secondes(1);
    await appuyer(root, 'timer-cam-primary'); // arrête la vidéo
    await secondes(1);
    expect(sons().filter((e) => e === 'bip')).toHaveLength(5);
    chaqueBipRendu();
  });

  it('en quittant l’écran pendant un bip : les sons sont déchargés (focus rendu par expo-av)', async () => {
    jest.useFakeTimers();
    const root = await run(SANS_CAM);
    await appuyer(root, 'timer-start-stop');
    await secondes(1); // premier tic, encore en lecture
    expect(mockJournal[mockJournal.length - 1]).toBe('bip');
    const r = renderer!; renderer = null;
    await act(async () => r.unmount());
    expect(mockJournal.slice(-3)).toEqual(['décharge', 'décharge', 'décharge']);
  });
});

describe('D7 (iOS) : rien ne change', () => {
  it('pas d’arrêt des bips ni d’écoute de fin : la session mélange sans baisser la musique', async () => {
    jest.useFakeTimers();
    Platform.OS = 'ios';
    const root = await run(SANS_CAM);
    await appuyer(root, 'timer-start-stop');
    await secondes(5);
    expect(sons()).toEqual(['bip', 'bip', 'bip', 'bip']);
    expect(mockSetAudioMode.mock.calls[1][0]).toEqual(expect.objectContaining({ interruptionModeIOS: 0, allowsRecordingIOS: false }));
  });
});
