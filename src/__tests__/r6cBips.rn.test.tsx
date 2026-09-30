import React from 'react';
import crypto from 'crypto';
import { Dimensions, Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { Settings } from 'lucide-react-native';
import { AxChip } from '../components/ax';
import type { HomeStackParamList } from '../navigation';
import {
  ANDROID_BEEP_MIC_LATENCY_MS, BEEP_SETS, BEEP_TYPES, DEFAULT_BEEP_SET, beepFileName, buildMultiWAV, isBeepSet,
} from '../lib/timerBeeps';
import { DEFAULT_VIDEO_OPTS, DISPLAY_OPTS_KEY, readVideoOpts } from '../lib/timerVideoOpts';
import { captureError } from '../lib/sentry';
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
const mockReplay = jest.fn(async (_uri: string) => {});
const mockCreate = jest.fn(async ({ uri }: { uri: string }) => ({ sound: {
  setVolumeAsync: jest.fn(async () => {}), replayAsync: () => mockReplay(uri), unloadAsync: jest.fn(async () => {}),
} }));
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(async () => {}),
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
  getSupportedQualities: () => ({ front: ['720p', '1080p'], back: ['720p', '1080p'] }),
  prepareQuality: async (o: { quality: string }) => ({ requested: o.quality, applied: o.quality, reason: null }),
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
  [mockWrite, mockReplay, mockCreate, mockStartRec, mockMarkBeep, captureError as jest.Mock].forEach((m) => m.mockClear());
});

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
/** Échantillons 16 bits d'un WAV base64 (en-tête de 44 octets). */
function samples(b64: string): Int16Array {
  const buf = Buffer.from(b64, 'base64');
  return new Int16Array(buf.buffer.slice(buf.byteOffset + 44, buf.byteOffset + buf.length));
}
/** Fréquence estimée par passages à zéro montants. */
function freq(s: Int16Array, from = 0, to = s.length): number {
  let n = 0;
  for (let i = from + 1; i < to; i++) if (s[i - 1] < 0 && s[i] >= 0) n++;
  return n / ((to - from) / 44100);
}
/** Plages non silencieuses [début, fin[ en échantillons. */
function notes(s: Int16Array): [number, number][] {
  const out: [number, number][] = [];
  let start = -1, lastLoud = -1;
  for (let i = 0; i < s.length; i++) {
    if (Math.abs(s[i]) > 200) { if (start < 0) start = i; lastLoud = i; }
    else if (start >= 0 && i - lastLoud > 441) { out.push([start, lastLoud + 1]); start = -1; }
  }
  if (start >= 0) out.push([start, lastLoud + 1]);
  return out;
}
const ms = (n: number) => Math.round(n / 44.1);

describe('R6c (B) : jeux de bips', () => {
  it('« Classique » : octet pour octet les bips d’avant R6c', () => {
    expect(sha(buildMultiWAV(BEEP_SETS.classic.tick))).toBe('7b5dcaf10ed93ab57fc93af72ce356c6da0c001822e4bef2a63a559d1962e7db');
    expect(sha(buildMultiWAV(BEEP_SETS.classic.go))).toBe('9f81896d6f10115fc7bcedec100126ed278a499077278afc8631335cf76109de');
    expect(sha(buildMultiWAV(BEEP_SETS.classic.done))).toBe('354a881e22ba8a9462a71aa2adbaa359292769c5aefd43d9b41c64e21bc167d1');
    // Le bip unitaire (séquence d'armement) passe par la même fonction, inchangée.
    expect(sha(buildMultiWAV([{ hz: 860, ms: 150, fadeInMs: 5, fadeOutMs: 20 }]))).toBe('bc0d4114e51511253a846396ca2b3e10e1326dc8dd2f6b5cf48704fdf742fc47');
  });
  it('« AthleX » par défaut ; noms de fichiers distincts par jeu', () => {
    expect(DEFAULT_BEEP_SET).toBe('athlex');
    expect(BEEP_TYPES).toEqual(['tick', 'go', 'done']);
    expect(isBeepSet('athlex') && isBeepSet('classic')).toBe(true);
    expect(isBeepSet('autre') || isBeepSet(undefined)).toBe(false);
    expect(beepFileName('athlex', 'tick')).toBe('bwod_athlex_tick.wav');
    expect(beepFileName('classic', 'done')).toBe('bwod_classic_done.wav');
  });
  it('tic AthleX : environ 100 ms, fondamentale vers 1046 Hz, fondu court, crête sous la saturation', () => {
    const s = samples(buildMultiWAV(BEEP_SETS.athlex.tick));
    expect(ms(s.length)).toBe(100);
    expect(freq(s)).toBeGreaterThan(1020);
    expect(freq(s)).toBeLessThan(1070);
    expect(s[0]).toBe(0);
    expect(Math.abs(s[s.length - 1])).toBeLessThan(2000);
    const peak = Math.max(...Array.from(s, Math.abs));
    expect(peak).toBeGreaterThan(20000);
    expect(peak).toBeLessThanOrEqual(Math.round(0.85 * 32767));
    // Harmonique douce : le son n'est plus une sinusoïde pure (différent du même tic sans harmonique).
    const pure = samples(buildMultiWAV([{ ...BEEP_SETS.athlex.tick[0], harmonic: 0 }]));
    expect(Array.from(s).some((v, i) => Math.abs(v - pure[i]) > 1000)).toBe(true);
  });
  it('GO AthleX : environ 400 ms et montant (de 880 vers 1318 Hz)', () => {
    const s = samples(buildMultiWAV(BEEP_SETS.athlex.go));
    expect(ms(s.length)).toBe(400);
    const w = 2205; // 50 ms
    const start = freq(s, 0, w), end = freq(s, s.length - w, s.length);
    expect(start).toBeGreaterThan(860); expect(start).toBeLessThan(960);
    expect(end).toBeGreaterThan(1240); expect(end).toBeLessThan(1340);
  });
  it('fin AthleX : trois notes descendantes séparées de silences', () => {
    const s = samples(buildMultiWAV(BEEP_SETS.athlex.done));
    const n = notes(s);
    expect(n).toHaveLength(3);
    const f = n.map(([a, b]) => freq(s, a, b));
    expect(f[0]).toBeGreaterThan(f[1]);
    expect(f[1]).toBeGreaterThan(f[2]);
    expect(f[2]).toBeGreaterThan(1020);
    expect(f[2]).toBeLessThan(1070);
    expect(ms(s.length)).toBe(590);
  });
  it('Android, micro activé : calage de départ du bip mélangé à 80 ms', () => {
    expect(ANDROID_BEEP_MIC_LATENCY_MS).toBe(80);
  });
});

describe('R6c (B) : réglage « Bips dans la vidéo »', () => {
  it('activé par défaut, enregistré avec les autres options vidéo', () => {
    expect(DEFAULT_VIDEO_OPTS.videoBeeps).toBe(true);
    expect(readVideoOpts({}).videoBeeps).toBe(true);
    expect(readVideoOpts({ videoBeeps: false }).videoBeeps).toBe(false);
    expect(readVideoOpts({ videoBeeps: 'non' }).videoBeeps).toBe(true);
  });
  it('interrupteur dans la section caméra de l’écran de réglage', async () => {
    await act(async () => { renderer = TestRenderer.create(<TimerScreen />); });
    const root = renderer!.root;
    const byId = (id: string) => root.findAll((n) => n.props.testID === id && typeof n.type !== 'string');
    expect(byId('timer-video-beeps-switch')).toHaveLength(0);
    await act(async () => { byId('timer-camera-switch')[0].props.onValueChange(true); });
    const sw = byId('timer-video-beeps-switch')[0];
    expect(sw.props.value).toBe(true);
    const all = root.findAll((n) => String(n.type) === 'Text').map((n) => n.props.children).flat().join('|');
    expect(all).toContain('Bips dans la vidéo');
    expect(all).toContain('Les bips du chrono s\'entendent dans l\'enregistrement');
    await act(async () => { sw.props.onValueChange(false); });
    await act(async () => {});
    expect(JSON.parse((await AsyncStorage.getItem(DISPLAY_OPTS_KEY))!).videoBeeps).toBe(false);
  });
});

const CAM: HomeStackParamList['TimerRun'] = {
  timerType: 'for-time', countdown: 3, totalSeconds: 0, maxTime: 600, interval: 1, rounds: 1, workTime: 0, restTime: 0,
  withCamera: true, videoTitle: '', withTimestamp: false, sequence: '[]',
};
async function run(params: Partial<HomeStackParamList['TimerRun']> = {}) {
  mockParams = { ...CAM, ...params };
  await act(async () => { renderer = TestRenderer.create(<TimerRunScreen />); });
  await act(async () => {});
  await act(async () => {});
  return renderer!.root;
}
const primary = (root: ReactTestInstance) => root.findByProps({ testID: 'timer-cam-primary' });
async function press(root: ReactTestInstance) { await act(async () => { primary(root).props.onPress(); }); }
const written = () => Object.fromEntries(mockWrite.mock.calls.map(([p, d]) => [p, d]));

describe('R6c (B) : le chrono charge le jeu choisi et le passe au module', () => {
  it('défaut « AthleX » : WAV écrits et joués au haut-parleur, mêmes fichiers envoyés au module', async () => {
    const root = await run();
    const w = written();
    for (const t of BEEP_TYPES) expect(w[`file:///cache/bwod_athlex_${t}.wav`]).toBe(buildMultiWAV(BEEP_SETS.athlex[t]));
    expect(mockCreate.mock.calls.map((c) => c[0].uri)).toEqual(BEEP_TYPES.map((t) => `file:///cache/bwod_athlex_${t}.wav`));
    await press(root);
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({
      beeps: true,
      beepFiles: { tick: 'file:///cache/bwod_athlex_tick.wav', go: 'file:///cache/bwod_athlex_go.wav', done: 'file:///cache/bwod_athlex_done.wav' },
    }));
  });
  it('« Classique » enregistré : les bips d’avant, au haut-parleur comme dans la vidéo', async () => {
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ beepSet: 'classic' }));
    const root = await run();
    await act(async () => {});
    for (const t of BEEP_TYPES) expect(written()[`file:///cache/bwod_classic_${t}.wav`]).toBe(buildMultiWAV(BEEP_SETS.classic[t]));
    await press(root);
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({
      beepFiles: expect.objectContaining({ tick: 'file:///cache/bwod_classic_tick.wav' }),
    }));
  });
  it('valeur inconnue enregistrée : jeu « AthleX »', async () => {
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ beepSet: 'disco' }));
    const root = await run();
    expect(mockWrite.mock.calls.filter(([p]) => p.includes('disco'))).toEqual([]);
    expect((captureError as jest.Mock).mock.calls.filter(([, ctx]) => ctx?.action === 'loadBeeps')).toEqual([]);
    expect(mockCreate.mock.calls.at(-1)![0].uri).toBe('file:///cache/bwod_athlex_done.wav');
    await press(root);
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({
      beepFiles: expect.objectContaining({ go: 'file:///cache/bwod_athlex_go.wav' }),
    }));
  });
  it('« Bips dans la vidéo » coupé : pas de bips pour le module', async () => {
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ videoBeeps: false }));
    const root = await run();
    await press(root);
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ beeps: false, beepFiles: undefined }));
  });
  it('calage : 80 ms envoyés sur Android, rien sur iOS (le natif mesure)', async () => {
    let root = await run();
    await press(root);
    expect((mockStartRec.mock.calls[0][0] as { beepLatencyMs?: number }).beepLatencyMs).toBeUndefined();
    await act(async () => renderer!.unmount()); renderer = null;
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      root = await run();
      await press(root);
      expect((mockStartRec.mock.calls[1][0] as { beepLatencyMs?: number }).beepLatencyMs).toBe(80);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });
});

describe('R6c (B) : markBeep aux mêmes instants que le haut-parleur', () => {
  async function countdown(stored: Record<string, unknown>) {
    await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify(stored));
    jest.useFakeTimers();
    const root = await run();
    await press(root); // Démarrer l'enregistrement
    await press(root); // Lancer le chrono → décompte 3 s
    for (let i = 0; i < 4; i++) await act(async () => { jest.advanceTimersByTime(1000); });
    return root;
  }
  it('pendant l’enregistrement : 3-2-1 puis GO, dans la vidéo comme au haut-parleur', async () => {
    await countdown({});
    expect(mockMarkBeep.mock.calls.map((c) => c[0])).toEqual(['tick', 'tick', 'tick', 'go']);
    expect(mockReplay.mock.calls.map((c) => c[0].replace('file:///cache/bwod_athlex_', '')))
      .toEqual(['tick.wav', 'tick.wav', 'tick.wav', 'go.wav']);
  });
  it('sons du téléphone coupés : les bips vont quand même dans la vidéo', async () => {
    await countdown({ bipsEnabled: false });
    expect(mockMarkBeep.mock.calls.map((c) => c[0])).toEqual(['tick', 'tick', 'tick', 'go']);
    expect(mockReplay).not.toHaveBeenCalled();
  });
  it('« Bips dans la vidéo » coupé : aucun bip dans la vidéo, le haut-parleur continue', async () => {
    await countdown({ videoBeeps: false });
    expect(mockMarkBeep).not.toHaveBeenCalled();
    expect(mockReplay).toHaveBeenCalledTimes(4);
  });
  it('sans enregistrement (chrono sans caméra) : jamais de markBeep', async () => {
    jest.useFakeTimers();
    const root = await run({ withCamera: false });
    const start = root.findAll((n) => n.props.testID === 'timer-start-stop' && typeof n.props.onPress === 'function')[0];
    await act(async () => { start.props.onPress(); });
    for (let i = 0; i < 4; i++) await act(async () => { jest.advanceTimersByTime(1000); });
    expect(mockReplay).toHaveBeenCalledTimes(4); // le haut-parleur a bien bipé
    expect(mockMarkBeep).not.toHaveBeenCalled();
  });
});

describe('R6c (B) : choix du jeu dans « Design du minuteur »', () => {
  it('puces AthleX / Classique dans la section Sons ; changer recharge les sons du jeu choisi', async () => {
    jest.useFakeTimers(); // comme les autres montages du chrono de ce fichier (animations de la feuille)
    const root = await run({ withCamera: false });
    // Ouvre la feuille par le bouton réglages (icône Settings).
    let btn: ReactTestInstance | null = root.findAllByType(Settings)[0];
    while (btn && typeof btn.props.onPress !== 'function') btn = btn.parent;
    await act(async () => { btn!.props.onPress(); });
    const chips = root.findAllByType(AxChip).filter((c) => /^timer-beeps-/.test(c.props.testID));
    expect(chips.map((c) => [c.props.label, c.props.selected])).toEqual([['AthleX', true], ['Classique', false]]);
    expect(root.findAll((n) => String(n.type) === 'Text' && n.props.children === i18n.t('timer.beeps.label'))).toHaveLength(1);
    mockCreate.mockClear();
    await act(async () => { chips[1].props.onPress(); });
    await act(async () => {});
    expect(JSON.parse((await AsyncStorage.getItem(DISPLAY_OPTS_KEY))!).beepSet).toBe('classic');
    expect(mockCreate.mock.calls.map((c) => c[0].uri)).toEqual(BEEP_TYPES.map((t) => `file:///cache/bwod_classic_${t}.wav`));
  });
  it('textes en anglais', () => {
    expect(i18n.t('timer.beeps.label', { lng: 'en' })).toBe('Beep set');
    expect(i18n.t('timer.beeps.classic', { lng: 'en' })).toBe('Classic');
    expect(i18n.t('timer.video.beeps', { lng: 'en' })).toBe('Beeps in the video');
  });
});
