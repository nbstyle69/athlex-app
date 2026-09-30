import React from 'react';
import { Dimensions, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { darkTheme } from '../theme/palette';
import { AxChip, AxSwitch } from '../components/ax';
import type { HomeStackParamList } from '../navigation';
import {
  DEFAULT_VIDEO_OPTS, DISPLAY_OPTS_KEY, isJerky, loadVideoOpts, offeredQualities, qualityNotice, readVideoOpts,
  saveVideoOpts, shownQuality,
} from '../lib/timerVideoOpts';
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
type Q = '720p' | '1080p' | '2k' | '4k';
let mockSupported: { front: Q[]; back: Q[] } | null = { front: ['720p', '1080p'], back: ['720p', '1080p'] };
let mockStats = { expectedFrames: 0, writtenFrames: 0 };
const mockStartRec = jest.fn(async (_o: unknown) => {});
const mockPrepare = jest.fn(async (o: { quality: Q }) => ({ requested: o.quality, applied: o.quality, reason: null as string | null }));
jest.mock('realtime-recorder', () => ({
  RealtimeRecorderView: 'Recorder',
  startRecording: (o: unknown) => mockStartRec(o),
  stopRecording: async () => '/docs/video.mp4',
  updateOverlayState: () => {},
  getSupportedQualities: () => { if (!mockSupported) throw new Error('no native module'); return mockSupported; },
  prepareQuality: (o: { quality: Q }) => mockPrepare(o),
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
  mockSupported = { front: ['720p', '1080p'], back: ['720p', '1080p'] };
  mockStats = { expectedFrames: 0, writtenFrames: 0 };
  mockMicGranted = true;
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  jest.restoreAllMocks();
  mockStartRec.mockClear(); mockPrepare.mockClear(); mockRequestMic.mockClear(); mockSetAudioMode.mockClear();
});

async function mount(el: React.ReactElement) {
  await act(async () => { renderer = TestRenderer.create(el); });
  await act(async () => {});
  return renderer!.root;
}
const byId = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type !== 'string');
const stored = async () => JSON.parse((await AsyncStorage.getItem(DISPLAY_OPTS_KEY)) ?? '{}');
const fr = (k: string, o?: Record<string, string>) => i18n.t(k, { lng: 'fr', ...o });
const en = (k: string, o?: Record<string, string>) => i18n.t(k, { lng: 'en', ...o });

describe('R6c (A) : réglages vidéo enregistrés avec les options d’affichage', () => {
  it('défauts = comportement d’avant : 1080p, 30 i/s, micro activé', () => {
    expect(DEFAULT_VIDEO_OPTS).toEqual({ videoQuality: '1080p', videoFps: 30, videoMic: true, videoBeeps: true }); // bips : R6c (B)
    expect(readVideoOpts(null)).toEqual(DEFAULT_VIDEO_OPTS);
    expect(readVideoOpts({ videoQuality: '8k', videoFps: 60, videoMic: 'non' })).toEqual(DEFAULT_VIDEO_OPTS);
    expect(readVideoOpts({ videoQuality: '720p', videoFps: 25, videoMic: false })).toEqual({ videoQuality: '720p', videoFps: 25, videoMic: false, videoBeeps: true });
    expect(readVideoOpts({ videoQuality: '4k' }).videoQuality).toBe('4k');
    expect(readVideoOpts({ videoQuality: '2k' }).videoQuality).toBe('2k');
  });
  it('même clé que le design du minuteur ; enregistrer ne touche pas aux autres options', async () => {
    expect(DISPLAY_OPTS_KEY).toBe('bwod_timer_display_opts_v2');
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ themeId: 'noir', bipsEnabled: false }));
    await saveVideoOpts({ videoQuality: '4k' });
    await saveVideoOpts({ videoMic: false });
    expect(await stored()).toEqual({ themeId: 'noir', bipsEnabled: false, videoQuality: '4k', videoMic: false });
    expect(await loadVideoOpts()).toEqual({ videoQuality: '4k', videoFps: 30, videoMic: false, videoBeeps: true });
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, '{cassé');
    expect(await loadVideoOpts()).toEqual(DEFAULT_VIDEO_OPTS);
  });
  it('qualités proposées = union des deux caméras ; 720p et 1080p toujours', () => {
    mockSupported = { front: ['720p', '1080p'], back: ['720p', '1080p', '2k', '4k'] };
    expect(offeredQualities()).toEqual(['720p', '1080p', '2k', '4k']);
    mockSupported = { front: ['720p', '1080p', '2k'], back: ['720p', '1080p'] };
    expect(offeredQualities()).toEqual(['720p', '1080p', '2k']);
    mockSupported = { front: [], back: [] };
    expect(offeredQualities()).toEqual(['720p', '1080p']);
    mockSupported = null;
    expect(offeredQualities()).toEqual(['720p', '1080p']);
  });
  it('choix affiché : la qualité enregistrée ou la meilleure proposée en dessous', () => {
    expect(shownQuality('4k', ['720p', '1080p', '2k'])).toBe('2k');
    expect(shownQuality('4k', ['720p', '1080p'])).toBe('1080p');
    expect(shownQuality('720p', ['720p', '1080p'])).toBe('720p');
    expect(shownQuality('2k', ['720p', '1080p', '2k', '4k'])).toBe('2k');
  });
  it('bandeau de redescente : caméra, cadence, chauffe ; rien si la qualité est tenue', () => {
    expect(qualityNotice(null, fr)).toBeNull();
    expect(qualityNotice({ requested: '4k', applied: '4k', reason: null }, fr)).toBeNull();
    expect(qualityNotice({ requested: '4k', applied: '1080p', reason: 'camera' }, fr)).toBe('4K indisponible sur cette caméra : vidéo en 1080p');
    expect(qualityNotice({ requested: '4k', applied: '2k', reason: 'performance' }, fr)).toBe('Ton téléphone ne tient pas la 4K avec l\'incrustation : vidéo en 2K');
    expect(qualityNotice({ requested: '2k', applied: '1080p', reason: 'thermal' }, fr)).toBe('Téléphone trop chaud pour la 2K : vidéo en 1080p');
    expect(qualityNotice({ requested: '4k', applied: '1080p', reason: 'camera' }, en)).toBe('4K not available on this camera: recording in 1080p');
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
  it('options visibles seulement avec « Enregistrer avec caméra » ; 1080p, 30 fps et micro par défaut', async () => {
    mockSupported = { front: ['720p', '1080p'], back: ['720p', '1080p', '2k', '4k'] };
    const root = await mount(<TimerScreen />);
    expect(chips(root)).toEqual([]);
    expect(byId(root, 'timer-mic-switch')).toHaveLength(0);
    await cameraOn(root);
    expect(chips(root)).toEqual([
      ['timer-quality-720p', '720p', false], ['timer-quality-1080p', '1080p', true],
      ['timer-quality-2k', '2K', false], ['timer-quality-4k', '4K', false],
      ['timer-fps-25', '25 fps', false], ['timer-fps-30', '30 fps', true],
    ]);
    const mic = root.findAllByType(AxSwitch).find((s) => s.props.testID === 'timer-mic-switch')!;
    expect(mic.props.value).toBe(true);
  });
  it('un choix est enregistré tout de suite et retrouvé au retour', async () => {
    mockSupported = { front: ['720p', '1080p'], back: ['720p', '1080p', '2k', '4k'] };
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ themeId: 'noir' }));
    let root = await mount(<TimerScreen />);
    await cameraOn(root);
    await act(async () => { byId(root, 'timer-quality-4k')[0].props.onPress(); });
    await act(async () => { byId(root, 'timer-fps-25')[0].props.onPress(); });
    await act(async () => { byId(root, 'timer-mic-switch')[0].props.onValueChange(false); });
    await act(async () => {});
    expect(await stored()).toEqual({ themeId: 'noir', videoQuality: '4k', videoFps: 25, videoMic: false });
    await act(async () => renderer!.unmount()); renderer = null;
    root = await mount(<TimerScreen />);
    await cameraOn(root);
    expect(chips(root).filter((c) => c[2]).map((c) => c[0])).toEqual(['timer-quality-4k', 'timer-fps-25']);
    expect(byId(root, 'timer-mic-switch')[0].props.value).toBe(false);
  });
  it('téléphone sans 4K : pas de puce 4K, choix enregistré 4K affiché en 1080p', async () => {
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ videoQuality: '4k' }));
    const root = await mount(<TimerScreen />);
    await cameraOn(root);
    expect(chips(root).map((c) => c[1])).toEqual(['720p', '1080p', '25 fps', '30 fps']);
    expect(chips(root).filter((c) => c[2]).map((c) => c[1])).toEqual(['1080p', '30 fps']);
  });
  it('textes en anglais', async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
    try {
      const root = await mount(<TimerScreen />);
      await cameraOn(root);
      const all = root.findAll((n) => String(n.type) === 'Text').map((n) => n.props.children).flat().join('|');
      for (const s of ['Quality', 'Frames per second', 'Microphone', 'Records sound during the video']) expect(all).toContain(s);
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

describe('R6c (A) : options transmises au module', () => {
  it('par défaut : 1080p, 30 fps, micro — mêmes permissions et même session audio qu’avant', async () => {
    mockMicGranted = false;
    const root = await run();
    expect(mockRequestMic).toHaveBeenCalled();
    expect(mockPrepare).toHaveBeenCalledWith({ quality: '1080p', fps: 30, mic: true, facing: 'back' });
    expect(primary(root).props.label).toBe('Démarrer');
    mockMicGranted = true;
    await press(root);
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ quality: '1080p', fps: 30, mic: true, facing: 'back' }));
    expect(mockSetAudioMode).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecordingIOS: true }));
  });
  it('micro coupé : aucune demande de permission micro, module et session audio sans enregistrement du son', async () => {
    mockMicGranted = false;
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ videoMic: false, videoFps: 25, videoQuality: '720p' }));
    const root = await run();
    await press(root);
    expect(mockRequestMic).not.toHaveBeenCalled();
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ quality: '720p', fps: 25, mic: false }));
    expect(mockSetAudioMode).toHaveBeenLastCalledWith(expect.objectContaining({ allowsRecordingIOS: false }));
  });
  it('4K : « Vérification 4K… » bloque le départ, puis bandeau et enregistrement à la qualité retenue', async () => {
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ videoQuality: '4k' }));
    let settle: (v: { requested: Q; applied: Q; reason: string | null }) => void = () => {};
    mockPrepare.mockImplementationOnce(() => new Promise((r) => { settle = r; }));
    const root = await run();
    expect(primary(root).props.label).toBe('Vérification 4K…');
    expect(primary(root).props.disabled).toBe(true);
    await press(root);
    expect(mockStartRec).not.toHaveBeenCalled();
    await act(async () => { settle({ requested: '4k', applied: '2k', reason: 'performance' }); });
    expect(primary(root).props.label).toBe('Démarrer');
    expect(primary(root).props.disabled).toBe(false);
    const notice = root.findAll((n) => n.props.testID === 'timer-quality-notice' && String(n.type) === 'Text');
    expect(notice.map((n) => n.props.children)).toEqual(['Ton téléphone ne tient pas la 4K avec l\'incrustation : vidéo en 2K']);
    await press(root);
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ quality: '2k' }));
    expect(root.findAll((n) => n.props.testID === 'timer-quality-notice')).toHaveLength(0);
  });
  it('vérification en échec au-delà de 1080p : enregistrement en 1080p', async () => {
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ videoQuality: '4k' }));
    mockPrepare.mockImplementationOnce(async () => { throw new Error('boom'); });
    const root = await run();
    await press(root);
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ quality: '1080p' }));
  });
  it('changer de caméra refait la vérification pour la caméra choisie', async () => {
    const root = await run();
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    await act(async () => { byId(root, 'timer-cam-flip')[0].props.onPress(); });
    await act(async () => {});
    expect(mockPrepare).toHaveBeenLastCalledWith(expect.objectContaining({ facing: 'front' }));
    expect(mockPrepare).toHaveBeenCalledTimes(2);
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
