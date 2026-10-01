import React from 'react';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Dimensions, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import { axVeil } from '../theme/axTokens';
import { ensureContrast, inkOn } from '../theme/timerInk';
import { CD_TENSE_FROM, countdownOverlay } from '../lib/timerCountdownOverlay';
import type { HomeStackParamList } from '../navigation';
import TimerRunScreen from '../screens/timer/TimerRunScreen';

let mockTheme = darkTheme;
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
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
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
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '', documentDirectory: 'file:///docs/', EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn(async () => {}),
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
  OrientationLock: { PORTRAIT_UP: 0, ALL: 1, LANDSCAPE: 2, LANDSCAPE_LEFT: 3, LANDSCAPE_RIGHT: 4 },
  Orientation: { PORTRAIT_UP: 1, LANDSCAPE_LEFT: 3, LANDSCAPE_RIGHT: 4 },
  getOrientationAsync: jest.fn(async () => 1),
  lockAsync: jest.fn(async () => {}), unlockAsync: jest.fn(async () => {}),
}));
const mockOverlay = jest.fn();
jest.mock('realtime-recorder', () => ({
  RealtimeRecorderView: 'Recorder',
  startRecording: jest.fn(async () => {}),
  stopRecording: jest.fn(async () => '/docs/video.mp4'),
  updateOverlayState: (s: unknown) => mockOverlay(s),
  getLastRecordingStats: () => ({ expectedFrames: 0, writtenFrames: 0 }),
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
  jest.useFakeTimers();
  act(() => { Dimensions.set({ window: PORTRAIT, screen: PORTRAIT }); });
  await AsyncStorage.clear();
  jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  jest.restoreAllMocks();
  mockOverlay.mockClear();
});

const CAM: HomeStackParamList['TimerRun'] = {
  timerType: 'for-time', countdown: 3, totalSeconds: 0, maxTime: 600, interval: 1, rounds: 1, workTime: 0, restTime: 0,
  withCamera: true, videoTitle: 'Fran', withTimestamp: true, sequence: '[]',
};
async function camera(countdown: number, theme = darkTheme) {
  mockTheme = theme;
  mockParams = { ...CAM, countdown };
  await act(async () => { renderer = TestRenderer.create(<TimerRunScreen />); });
  const root = renderer!.root;
  const primary = () => root.findByProps({ testID: 'timer-cam-primary' });
  await act(async () => { primary().props.onPress(); }); // Démarrer l'enregistrement
  await act(async () => { primary().props.onPress(); }); // Lancer le chrono → décompte
  return root;
}
async function tick(ms: number) {
  await act(async () => { jest.advanceTimersByTime(ms); });
}
/** Secondes une à une : l'intervalle de synchro (100 ms) repart à chaque rendu. */
async function seconds(n: number) {
  for (let i = 0; i < n; i++) await tick(1000);
}
type Sent = { countdownValue: number; countdownLabel: string; countdownTense: boolean; goLabel: string; accentColor: string; goInk: string };
const last = (): Sent => mockOverlay.mock.calls.at(-1)![0] as Sent;
const view = (s: Sent) => [s.countdownValue, s.countdownLabel, s.countdownTense, s.goLabel];

const fr = (k: string) => i18n.t(k, { lng: 'fr' });
const en = (k: string) => i18n.t(k, { lng: 'en' });

describe('R6c : champs du décompte incrusté (calcul JS)', () => {
  it('au-dessus de 3 « PRÉPARE-TOI », de 3 à 1 « PRÊT ? » en accent, rien à 0', () => {
    expect(CD_TENSE_FROM).toBe(3);
    expect(view(countdownOverlay(10, false, 'athlex', fr))).toEqual([10, 'PRÉPARE-TOI', false, '']);
    expect(view(countdownOverlay(4, false, 'athlex', fr))).toEqual([4, 'PRÉPARE-TOI', false, '']);
    expect(view(countdownOverlay(3, false, 'athlex', fr))).toEqual([3, 'PRÊT ?', true, '']);
    expect(view(countdownOverlay(1, false, 'athlex', fr))).toEqual([1, 'PRÊT ?', true, '']);
    expect(view(countdownOverlay(0, false, 'athlex', fr))).toEqual([0, '', false, '']);
  });
  it('« GO ! » seulement quand la bande est visible, dans la langue de l’app', () => {
    expect(countdownOverlay(0, true, 'athlex', fr).goLabel).toBe('GO !');
    expect(view(countdownOverlay(0, true, 'athlex', en))).toEqual([0, '', false, 'GO!']);
    expect(countdownOverlay(4, false, 'athlex', en).countdownLabel).toBe('GET READY');
    expect(countdownOverlay(2, false, 'athlex', en).countdownLabel).toBe('READY?');
  });
  it('accent contrasté sur le voile du décompte caméra, encre de la bande lisible', () => {
    const athlex = countdownOverlay(3, true, 'athlex', fr);
    expect(athlex.accentColor).toBe('#9AE6D2');
    expect(athlex.goInk).toBe(inkOn('#9AE6D2'));
    const athlex2 = countdownOverlay(3, true, 'athlex2', fr);
    expect(athlex2.accentColor).toBe(ensureContrast('#101214', axVeil.countdownFloor));
    expect(athlex2.accentColor).toBe('#FFFFFF');
    expect(athlex2.goInk).toBe(inkOn('#FFFFFF'));
    expect(athlex2.goInk).not.toBe(athlex2.accentColor);
    expect(countdownOverlay(3, true, 'inconnu', fr).accentColor).toBe('#9AE6D2');
    expect(countdownOverlay(3, true, 'noir', fr).accentColor).toBe(ensureContrast('#FFFFFF', axVeil.countdownFloor));
  });
});

describe('R6c : le chrono envoie le décompte au module natif', () => {
  it('10 s : PRÉPARE-TOI de 10 à 4, PRÊT ? de 3 à 1, puis GO ! environ 900 ms, puis plus rien', async () => {
    await camera(10);
    await seconds(1);
    expect(view(last())).toEqual([10, 'PRÉPARE-TOI', false, '']);
    await seconds(6);
    expect(view(last())).toEqual([4, 'PRÉPARE-TOI', false, '']);
    await seconds(1);
    expect(view(last())).toEqual([3, 'PRÊT ?', true, '']);
    await seconds(2);
    expect(view(last())).toEqual([1, 'PRÊT ?', true, '']);
    await seconds(1);
    expect(view(last())).toEqual([0, '', false, 'GO !']);
    await seconds(1);
    expect(view(last())).toEqual([0, '', false, '']);
    expect(last().accentColor).toBe('#9AE6D2');
  });
  it('3 s : PRÊT ? dès le départ ; chaque envoi est cohérent (libellé ↔ valeur)', async () => {
    await camera(3);
    await seconds(5);
    const sent = mockOverlay.mock.calls.map((c) => c[0] as Sent);
    expect(view(sent[0])).toEqual([3, 'PRÊT ?', true, '']);
    for (const s of sent) {
      expect(s.countdownLabel).toBe(s.countdownValue > 3 ? 'PRÉPARE-TOI' : s.countdownValue > 0 ? 'PRÊT ?' : '');
      expect(s.countdownTense).toBe(s.countdownValue > 0 && s.countdownValue <= 3);
    }
    expect(sent.some((s) => s.goLabel === 'GO !')).toBe(true);
  });
  it('thème clair de l’app (AthleX 2) : accent blanc, encre foncée sur la bande', async () => {
    await camera(3, lightTheme);
    await seconds(4);
    expect(last().goLabel).toBe('GO !');
    expect(last().accentColor).toBe('#FFFFFF');
    expect(last().goInk).toBe(inkOn('#FFFFFF'));
  });
  it('app en anglais : GET READY, READY?, GO!', async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
    try {
      await camera(4);
      await seconds(1);
      expect(last().countdownLabel).toBe('GET READY');
      await seconds(1);
      expect(last().countdownLabel).toBe('READY?');
      await seconds(3);
      expect(last().goLabel).toBe('GO!');
    } finally {
      await act(async () => { await i18n.changeLanguage('fr'); });
    }
  });
});

describe('R6c : module natif', () => {
  const ROOT = path.join(__dirname, '..', '..');
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const MOD = 'modules/realtime-recorder';
  it('iOS et Android lisent chaque champ de l’état d’incrustation déclaré côté JS', () => {
    const ts = read(`${MOD}/src/RealtimeRecorderModule.ts`);
    const iface = ts.slice(ts.indexOf('export interface OverlayState'), ts.indexOf('}', ts.indexOf('export interface OverlayState')));
    const keys = [...iface.matchAll(/^\s+(\w+): /gm)].map((m) => m[1]);
    expect(keys).toEqual(expect.arrayContaining(['countdownLabel', 'countdownTense', 'goLabel', 'accentColor', 'goInk']));
    const swift = read(`${MOD}/ios/RealtimeRecorderModule.swift`);
    const kt = read(`${MOD}/android/src/main/java/expo/modules/realtimerecorder/RealtimeRecorderModule.kt`);
    const swiftState = read(`${MOD}/ios/OverlayRenderer.swift`);
    const ktState = read(`${MOD}/android/src/main/java/expo/modules/realtimerecorder/OverlayState.kt`);
    for (const k of keys) {
      expect(swift).toContain(`dict["${k}"]`);
      expect(kt).toContain(`dict["${k}"]`);
      expect(swiftState).toContain(`var ${k}:`);
      expect(ktState).toContain(`var ${k}:`);
    }
  });
  it('les deux rendus dessinent libellé, anneau ou halo, chiffre et bande GO inclinée de −4°', () => {
    const swift = read(`${MOD}/ios/OverlayRenderer.swift`);
    const kt = read(`${MOD}/android/src/main/java/expo/modules/realtimerecorder/OverlayRenderer.kt`);
    for (const src of [swift, kt]) {
      expect(src).toMatch(/drawCountdown\(/);
      expect(src).toMatch(/drawGoBand\(/);
      expect(src).toContain('state.countdownLabel');
      expect(src).toContain('state.goLabel');
      expect(src).toContain('state.goInk');
    }
    expect(swift).toContain('context.rotate(by: -4 * .pi / 180)');
    expect(kt).toContain('canvas.rotate(-4f)');
    expect(swift).toContain('withAlphaComponent(0.12)');
    expect(kt).toContain('withAlpha(accent, 0.12f)');
  });
  it('Oswald Medium embarquée des deux côtés, identique à celle de l’écran', () => {
    const sha = (f: string) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
    const app = sha('node_modules/@expo-google-fonts/oswald/500Medium/Oswald_500Medium.ttf');
    expect(sha(`${MOD}/ios/Resources/Oswald-Medium.ttf`)).toBe(app);
    expect(sha(`${MOD}/android/src/main/assets/realtime-recorder/Oswald-Medium.ttf`)).toBe(app);
    expect(read(`${MOD}/ios/RealtimeRecorder.podspec`)).toContain("'Resources/**/*.{png,jpg,ttf}'");
    expect(read(`${MOD}/ios/OverlayRenderer.swift`)).toContain('loadBundledFont(file: "Oswald-Medium", postScriptName: "Oswald-Medium")');
    expect(read(`${MOD}/android/src/main/java/expo/modules/realtimerecorder/OverlayRenderer.kt`)).toContain('"realtime-recorder/Oswald-Medium.ttf"');
  });
});

// Retours iPhone : seul écart de logique, l'objet stocké sans thème (options vidéo seules) suit le thème de l'app (r5b.rn.test.tsx).
const IPHONE_FOLLOW_FIX = ["        // Un thème choisi avant le réglage est conservé ; un objet sans thème (écrit\n        // par les seules options vidéo) laisse le chrono suivre le thème de l'app.\n        setDisplayOptsRaw({ ...migrated, followAppTheme: stored.followAppTheme ?? !theme });", "        // Préférence enregistrée avant le réglage : le thème choisi est conservé.\n        setDisplayOptsRaw({ ...migrated, followAppTheme: stored.followAppTheme ?? false });"] as const;

describe('R6c : logique du chrono', () => {
  it('seul le bloc de synchro de l’incrustation a bougé (après displayOpts) et envoie les champs du décompte', () => {
    const timer = fs.readFileSync(path.join(__dirname, '..', 'screens/timer/TimerRunScreen.tsx'), 'utf8');
    const now = timer.slice(timer.indexOf('export default function TimerRunScreen()'), timer.indexOf('// Phase-aware accent color')).replace(...IPHONE_FOLLOW_FIX);
    const start = now.indexOf('\n  // Sync overlay state to native module on every render tick');
    const endMark = 'showGo, displayOpts.themeId, t]);\n\n';
    const block = now.slice(start, now.indexOf(endMark) + endMark.length);
    const oldBlock = block
      .replace('          ...countdownOverlay(phase === \'countdown\' ? countdownVal : 0, showGo, displayOpts.themeId, t),\n',
        '          countdownValue: phase === \'countdown\' ? countdownVal : 0,\n')
      .replace(', showGo, displayOpts.themeId, t]);', ']);');
    const anchor = '  }, [withCamera, isCameraReady, videoOpts, facing]);\n';
    const back = now.replace(block, '').replace(anchor, `${anchor}\n${oldBlock.slice(0, -1)}`);
    const sha = crypto.createHash('sha256').update(back).digest('hex');
    // État R6c (A) de la logique (LOGIC_SHA de r5a.rn.test.tsx avant R6c C), plus R6c (B) : jeu de bips,
    // markBeep et bips passés au module (r6cBips.rn.test.tsx) ; bips sans doublon (mixBeepInVideo, plus de calage) ;
    // 1080p fixe : plus de prepareQuality, « Démarrage… » jusqu'à la réponse du module (r6cOptionsVideo.rn.test.tsx).
    expect(sha).toBe('eaa8f7f6f7e6a42db8bcafd451befe303b159d778e7ed9afe11f37de3f2c31b8');
  });
});
