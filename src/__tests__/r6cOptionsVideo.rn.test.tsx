import React from 'react';
import { Alert, Dimensions, StyleSheet, Text, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { darkTheme } from '../theme/palette';
import { AxChip, AxSwitch } from '../components/ax';
import type { HomeStackParamList } from '../navigation';
import { DEFAULT_VIDEO_OPTS, DISPLAY_OPTS_KEY, isJerky, loadVideoOpts, readVideoOpts, saveVideoOpts } from '../lib/timerVideoOpts';
import TimerScreen from '../screens/timer/TimerScreen';
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
let mockMicGranted = true;
const mockRequestMic = jest.fn(async () => ({ granted: true }));
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
  useMicrophonePermissions: () => [{ granted: mockMicGranted }, mockRequestMic],
}));
jest.mock('expo-media-library', () => ({ usePermissions: () => [{ granted: true }, jest.fn()], saveToLibraryAsync: jest.fn(async () => {}) }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '', documentDirectory: 'file:///docs/', EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn(async () => {}),
}));
const mockSetAudioMode = jest.fn(async (_o: unknown) => {});
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: (o: unknown) => mockSetAudioMode(o),
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
let mockStats = { expectedFrames: 0, writtenFrames: 0 };
const mockStartRec = jest.fn(async (_o: unknown) => {});
jest.mock('realtime-recorder', () => ({
  RealtimeRecorderView: 'Recorder',
  startRecording: (o: unknown) => mockStartRec(o),
  stopRecording: async () => '/docs/video.mp4',
  updateOverlayState: () => {},
  getLastRecordingStats: () => mockStats,
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
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockStats = { expectedFrames: 0, writtenFrames: 0 };
  mockMicGranted = true;
  mockStartRec.mockImplementation(async () => {});
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  jest.restoreAllMocks();
  mockStartRec.mockClear(); mockRequestMic.mockClear(); mockSetAudioMode.mockClear();
});

async function mount(el: React.ReactElement) {
  await act(async () => { renderer = TestRenderer.create(el); });
  await act(async () => {});
  return renderer!.root;
}
const byId = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type !== 'string');
const stored = async () => JSON.parse((await AsyncStorage.getItem(DISPLAY_OPTS_KEY)) ?? '{}');
const fr = (k: string, o?: Record<string, string>) => i18n.t(k, { lng: 'fr', ...o });

describe('R6c (A) : réglages vidéo enregistrés avec les options d’affichage', () => {
  it('défauts = comportement d’avant : 30 i/s, micro activé ; plus aucune qualité', () => {
    expect(DEFAULT_VIDEO_OPTS).toEqual({ videoFps: 30, videoMic: true, videoBeeps: true }); // bips : R6c (B)
    expect(readVideoOpts(null)).toEqual(DEFAULT_VIDEO_OPTS);
    expect(readVideoOpts({ videoFps: 60, videoMic: 'non' })).toEqual(DEFAULT_VIDEO_OPTS);
    expect(readVideoOpts({ videoFps: 25, videoMic: false })).toEqual({ videoFps: 25, videoMic: false, videoBeeps: true });
  });
  it('une ancienne qualité enregistrée (2K, 4K…) est ignorée, puis retirée à la première écriture', async () => {
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ themeId: 'noir', videoQuality: '2k', videoFps: 25 }));
    expect(await loadVideoOpts()).toEqual({ videoFps: 25, videoMic: true, videoBeeps: true });
    expect(readVideoOpts({ videoQuality: '4k' })).not.toHaveProperty('videoQuality');
    await saveVideoOpts({ videoMic: false });
    expect(await stored()).toEqual({ themeId: 'noir', videoFps: 25, videoMic: false });
  });
  it('même clé que le design du minuteur ; enregistrer ne touche pas aux autres options', async () => {
    expect(DISPLAY_OPTS_KEY).toBe('bwod_timer_display_opts_v2');
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ themeId: 'noir', bipsEnabled: false }));
    await saveVideoOpts({ videoFps: 25 });
    await saveVideoOpts({ videoMic: false });
    expect(await stored()).toEqual({ themeId: 'noir', bipsEnabled: false, videoFps: 25, videoMic: false });
    expect(await loadVideoOpts()).toEqual({ videoFps: 25, videoMic: false, videoBeeps: true });
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, '{cassé');
    expect(await loadVideoOpts()).toEqual(DEFAULT_VIDEO_OPTS);
  });
  it('saccades : moins de 90 % des images attendues', () => {
    expect(isJerky({ expectedFrames: 300, writtenFrames: 269 })).toBe(true);
    expect(isJerky({ expectedFrames: 300, writtenFrames: 270 })).toBe(false);
    expect(isJerky({ expectedFrames: 0, writtenFrames: 0 })).toBe(false);
    expect(isJerky(null)).toBe(false);
  });
});

describe('R6c (A) : écran de réglage du minuteur', () => {
  const chips = (root: ReactTestInstance) => root.findAllByType(AxChip)
    .filter((c) => /^timer-(quality|fps)-/.test(c.props.testID ?? ''))
    .map((c) => [c.props.testID, c.props.label, c.props.selected]);
  const cameraOn = async (root: ReactTestInstance) => {
    await act(async () => { byId(root, 'timer-camera-switch')[0].props.onValueChange(true); });
  };
  it('options visibles seulement avec « Enregistrer avec caméra » ; 30 fps et micro par défaut, aucune puce de qualité', async () => {
    const root = await mount(<TimerScreen />);
    expect(chips(root)).toEqual([]);
    expect(byId(root, 'timer-mic-switch')).toHaveLength(0);
    await cameraOn(root);
    expect(chips(root)).toEqual([['timer-fps-25', '25 fps', false], ['timer-fps-30', '30 fps', true]]);
    const mic = root.findAllByType(AxSwitch).find((s) => s.props.testID === 'timer-mic-switch')!;
    expect(mic.props.value).toBe(true);
    const all = root.findAll((n) => String(n.type) === 'Text').map((n) => n.props.children).flat().join('|');
    expect(all).not.toMatch(/Qualité|2K|4K|720p/);
  });
  it('un choix est enregistré tout de suite et retrouvé au retour', async () => {
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ themeId: 'noir' }));
    let root = await mount(<TimerScreen />);
    await cameraOn(root);
    await act(async () => { byId(root, 'timer-fps-25')[0].props.onPress(); });
    await act(async () => { byId(root, 'timer-mic-switch')[0].props.onValueChange(false); });
    await act(async () => {});
    expect(await stored()).toEqual({ themeId: 'noir', videoFps: 25, videoMic: false });
    await act(async () => renderer!.unmount()); renderer = null;
    root = await mount(<TimerScreen />);
    await cameraOn(root);
    expect(chips(root).filter((c) => c[2]).map((c) => c[0])).toEqual(['timer-fps-25']);
    expect(byId(root, 'timer-mic-switch')[0].props.value).toBe(false);
  });
  it('textes en anglais', async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
    try {
      const root = await mount(<TimerScreen />);
      await cameraOn(root);
      const all = root.findAll((n) => String(n.type) === 'Text').map((n) => n.props.children).flat().join('|');
      for (const s of ['Frames per second', 'Microphone', 'Records sound during the video']) expect(all).toContain(s);
      expect(all).not.toContain('Quality');
    } finally {
      await act(async () => { await i18n.changeLanguage('fr'); });
    }
  });
});

const CAM: HomeStackParamList['TimerRun'] = {
  timerType: 'for-time', countdown: 3, totalSeconds: 0, maxTime: 600, interval: 1, rounds: 1, workTime: 0, restTime: 0,
  withCamera: true, videoTitle: 'Fran', withTimestamp: false, sequence: '[]',
};
async function run() {
  mockParams = CAM;
  const root = await mount(<TimerRunScreen />);
  await act(async () => {});
  return root;
}
const primary = (root: ReactTestInstance) => root.findByProps({ testID: 'timer-cam-primary' });
async function press(root: ReactTestInstance) { await act(async () => { primary(root).props.onPress(); }); }

describe('Démarrage de la caméra : attente du module, échec sans quitter l’écran', () => {
  it('« Démarrage… » désactivé tant que le module n’a pas répondu, puis « Lancer le chrono »', async () => {
    let settle: () => void = () => {};
    mockStartRec.mockImplementationOnce(() => new Promise<void>((r) => { settle = r; }));
    const root = await run();
    await press(root);
    expect(primary(root).props.label).toBe('Démarrage…');
    expect(primary(root).props.disabled).toBe(true);
    await act(async () => { settle(); });
    expect(primary(root).props.label).toBe('Lancer le chrono');
    expect(primary(root).props.disabled).toBe(false);
  });
  it('promesse rejetée (ERR_CAPTURE_SESSION) : alerte avec le motif, retour à « Démarrer », nouvel essai possible', async () => {
    const err = Object.assign(new Error('startRunning: NSGenericException — startRunning may not be called between calls to beginConfiguration and commitConfiguration'), { code: 'ERR_CAPTURE_SESSION' });
    mockStartRec.mockImplementationOnce(async () => { throw err; });
    const root = await run();
    await press(root);
    await act(async () => {});
    expect(Alert.alert).toHaveBeenCalledWith(
      "Démarrage de l'enregistrement échoué",
      expect.stringContaining('startRunning may not be called between calls to beginConfiguration and commitConfiguration'),
      expect.anything(),
    );
    expect(primary(root).props.label).toBe('Démarrer');
    expect(primary(root).props.disabled).toBe(false);
    await press(root);
    expect(mockStartRec).toHaveBeenCalledTimes(2);
    expect(primary(root).props.label).toBe('Lancer le chrono');
  });
});

// La vidéo saccadée (minuteurs simulés) reste le dernier test qui monte TimerRunScreen.
describe('R6c (A) : options transmises au module', () => {
  it('par défaut : 30 fps, micro, aucune qualité — mêmes permissions et même session audio qu’avant', async () => {
    mockMicGranted = false;
    const root = await run();
    expect(mockRequestMic).toHaveBeenCalled();
    expect(primary(root).props.label).toBe('Démarrer');
    mockMicGranted = true;
    await press(root);
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ fps: 30, mic: true, facing: 'back' }));
    expect(mockStartRec.mock.calls[0][0]).not.toHaveProperty('quality');
    expect(mockSetAudioMode).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecordingIOS: true }));
  });
  it('micro coupé : aucune demande de permission micro, module et session audio sans enregistrement du son', async () => {
    mockMicGranted = false;
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ videoMic: false, videoFps: 25, videoQuality: '720p' }));
    const root = await run();
    await press(root);
    expect(mockRequestMic).not.toHaveBeenCalled();
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ fps: 25, mic: false }));
    expect(mockStartRec.mock.calls[0][0]).not.toHaveProperty('quality');
    expect(mockSetAudioMode).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecordingIOS: false }));
  });
  it('vidéo saccadée (moins de 90 % des images) : avertissement au temps final', async () => {
    for (const [stats, shown] of [[{ expectedFrames: 300, writtenFrames: 250 }, 1], [{ expectedFrames: 300, writtenFrames: 290 }, 0]] as const) {
      mockStats = stats;
      jest.useFakeTimers();
      const root = await run();
      await press(root); // Démarrer
      await press(root); // Lancer le chrono
      await act(async () => { jest.advanceTimersByTime(4000); });
      await press(root); // Arrêter le chrono
      await press(root); // Arrêter la vidéo
      await act(async () => {});
      const warn = root.findAll((n) => n.props.testID === 'timer-video-jerky' && String(n.type) === 'Text');
      expect(warn).toHaveLength(shown);
      if (shown) expect(warn[0].props.children).toBe(fr('timer.video.jerky'));
      await act(async () => renderer!.unmount()); renderer = null;
      jest.useRealTimers();
    }
  });
});

/** Largeur estimée d'un libellé Inter demi-gras (0,58 em par caractère, borne haute). */
const estTextWidth = (s: string, fontSize: number) => Math.ceil(s.length * fontSize * 0.58);

describe('Retours iPhone (1) : compte à rebours sur une seule ligne à 390 px', () => {
  it('six pastilles de largeur égale, sans retour à la ligne, qui tiennent dans la carte', async () => {
    const root = await mount(<TimerScreen />);
    const row = byId(root, 'timer-countdown-opts')[0];
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'nowrap' });
    const opts = root.findAllByType(AxChip).filter((c) => /^timer-countdown-opt-/.test(c.props.testID ?? ''));
    expect(opts.map((c) => c.props.label)).toEqual(['—', '3s', '5s', '10s', '15s', '30s']);
    const styles = opts.map((c) => StyleSheet.flatten(c.findByProps({ testID: c.props.testID, accessibilityLabel: c.props.label }).props.style));
    for (const st of styles) expect(st).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 });
    const gap = (StyleSheet.flatten(row.props.style).gap as number) ?? 0;
    const available = 390 - 2 * 20 - 2 * 16;
    const need = styles.reduce((acc, st, i) => acc + 2 * (st.paddingHorizontal as number) + 2 + estTextWidth(opts[i].props.label, 14), 0) + gap * 5;
    expect(need).toBeLessThanOrEqual(available);
    for (const c of opts) expect(c.findAllByType(Text)[0].props.numberOfLines).toBe(1);
  });
});
