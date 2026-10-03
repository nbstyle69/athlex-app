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
  BEEP_SETS, BEEP_TYPES, DEFAULT_BEEP_SET, beepFileName, buildMultiWAV, isBeepSet, mixBeepInVideo,
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
  const peakOf = (s: Int16Array, from = 0, to = s.length) => {
    let p = 0;
    for (let i = from; i < to; i++) p = Math.max(p, Math.abs(s[i]));
    return p;
  };
  const rms = (s: Int16Array, from: number, to: number) => {
    let e = 0;
    for (let i = from; i < to; i++) e += s[i] * s[i];
    return Math.sqrt(e / (to - from));
  };
  const at = (msec: number) => Math.round(msec * 44.1);
  /** Instant (ms) où le son passe durablement sous 10 % de sa crête. */
  const fallMs = (s: Int16Array) => {
    const p = peakOf(s);
    let last = 0;
    for (let i = 0; i < s.length; i++) if (Math.abs(s[i]) > p * 0.1) last = i;
    return ms(last);
  };
  const CEILING = Math.round(0.85 * 32767);

  it('tic AthleX « sonar » : ping d’environ 350 ms vers 1 100 Hz, attaque très courte, longue décroissance exponentielle', () => {
    const s = samples(buildMultiWAV(BEEP_SETS.athlex.tick));
    expect(ms(s.length)).toBe(350);
    const f = freq(s, 0, at(150));
    expect(f).toBeGreaterThan(1070);
    expect(f).toBeLessThan(1130);
    expect(s[0]).toBe(0);
    // Attaque : la crête est atteinte dans les 10 premières ms.
    expect(peakOf(s, 0, at(10))).toBeGreaterThan(0.8 * peakOf(s));
    expect(peakOf(s)).toBeGreaterThan(20000);
    // Décroissance exponentielle (constante ~80 ms) : l'énergie de 0-150 ms vaut plusieurs fois celle de 150-300 ms…
    const ratio = rms(s, 0, at(150)) / rms(s, at(150), at(300));
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(12);
    // … et le ping s'éteint doucement : encore audible à 150 ms, presque nul à la fin, sans clic.
    expect(peakOf(s, at(140), at(160))).toBeGreaterThan(0.05 * peakOf(s));
    expect(peakOf(s, at(330), s.length)).toBeLessThan(0.02 * peakOf(s));
    expect(Math.abs(s[s.length - 1])).toBeLessThan(50);
  });
  it('légère résonance : un partiel désaccordé fait battre le ping (différent du même ping sans résonance)', () => {
    const s = samples(buildMultiWAV(BEEP_SETS.athlex.tick));
    const dry = samples(buildMultiWAV([{ ...BEEP_SETS.athlex.tick[0], resonance: 0 }]));
    // Même forme ramenée à la crête : seule la résonance (pas un simple gain) la change.
    const ps = peakOf(s), pd = peakOf(dry);
    expect(Array.from(s).some((v, i) => Math.abs(v / ps - dry[i] / pd) > 0.05)).toBe(true);
    expect(BEEP_SETS.athlex.tick[0].resonance).toBeGreaterThan(0);
    expect(BEEP_SETS.athlex.tick[0].resonance).toBeLessThanOrEqual(0.5);
  });
  it('GO AthleX : ping plus aigu (vers 1 500 Hz) et plus long (environ 800 ms)', () => {
    const s = samples(buildMultiWAV(BEEP_SETS.athlex.go));
    const tick = samples(buildMultiWAV(BEEP_SETS.athlex.tick));
    expect(ms(s.length)).toBe(800);
    const f = freq(s, 0, at(300));
    expect(f).toBeGreaterThan(1460);
    expect(f).toBeLessThan(1540);
    expect(peakOf(s, 0, at(10))).toBeGreaterThan(0.8 * peakOf(s));
    // Il résonne plus longtemps que le tic.
    expect(fallMs(s)).toBeGreaterThan(fallMs(tick) + 150);
    expect(peakOf(s, at(780), s.length)).toBeLessThan(0.02 * peakOf(s));
  });
  it('fin AthleX : trois pings descendants', () => {
    const s = samples(buildMultiWAV(BEEP_SETS.athlex.done));
    expect(ms(s.length)).toBe(1000);
    const bounds = [[0, 300], [300, 600], [600, 1000]].map(([a, b]) => [at(a), at(b)]);
    const f = bounds.map(([a, b]) => freq(s, a, a + at(150)));
    expect(f[0]).toBeGreaterThan(f[1] + 150);
    expect(f[1]).toBeGreaterThan(f[2] + 150);
    expect(f[2]).toBeGreaterThan(1020);
    expect(f[2]).toBeLessThan(1080);
    // Chaque ping repart d'une attaque : fort au début, presque éteint à la fin.
    for (const [a, b] of bounds) {
      expect(peakOf(s, a, a + at(10))).toBeGreaterThan(20000);
      expect(peakOf(s, b - at(15), b)).toBeLessThan(0.05 * 32767);
    }
  });
  it('aucune saturation : toute la série AthleX reste sous 0,85 de la pleine échelle', () => {
    for (const t of BEEP_TYPES) expect(peakOf(samples(buildMultiWAV(BEEP_SETS.athlex[t])))).toBeLessThanOrEqual(CEILING);
    // Résonance forte et harmonique ensemble : la normalisation tient toujours la crête.
    const loud = samples(buildMultiWAV([{ hz: 1100, ms: 200, fadeInMs: 2, decayMs: 80, resonance: 1, harmonic: 1 }]));
    expect(peakOf(loud)).toBeLessThanOrEqual(CEILING);
  });
  it('mélange dans la vidéo : seulement si le micro ne capte pas déjà le haut-parleur', () => {
    const cases: [boolean, boolean, boolean, boolean][] = [
      // videoBeeps, mic, phoneAudible → mélangé
      [true, true, true, false], // micro + sons du téléphone : le micro capte le bip, pas de doublon
      [true, false, true, true], // micro coupé
      [true, true, false, true], // téléphone muet
      [true, false, false, true],
      [false, false, false, false], // « Bips dans la vidéo » coupé : jamais
      [false, true, true, false],
      [false, false, true, false],
      [false, true, false, false],
    ];
    for (const [videoBeeps, mic, phoneAudible, mixed] of cases) {
      expect(mixBeepInVideo({ videoBeeps, mic, phoneAudible })).toBe(mixed);
    }
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
    expect(all).toContain('Les bips du chrono s\'entendent dans l\'enregistrement : ajoutés à la piste si le micro est coupé ou le téléphone muet, sinon captés par le micro');
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
  it('plus aucun calage de latence envoyé (iOS comme Android) : un bip mélangé tombe à l’instant de l’événement', async () => {
    let root = await run();
    await press(root);
    expect(mockStartRec.mock.calls[0][0]).not.toHaveProperty('beepLatencyMs');
    await act(async () => renderer!.unmount()); renderer = null;
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      root = await run();
      await press(root);
      expect(mockStartRec.mock.calls[1][0]).not.toHaveProperty('beepLatencyMs');
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
  it('micro et sons du téléphone activés (défaut) : bips au haut-parleur seulement, captés par le micro — aucun doublon', async () => {
    await countdown({});
    expect(mockMarkBeep).not.toHaveBeenCalled();
    expect(mockReplay.mock.calls.map((c) => c[0].replace('file:///cache/bwod_athlex_', '')))
      .toEqual(['tick.wav', 'tick.wav', 'tick.wav', 'go.wav']);
    // Le module reçoit quand même les fichiers : couper les sons en cours de route reste suivi.
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ beeps: true, mic: true }));
  });
  it('micro coupé : 3-2-1 puis GO dans la vidéo, aux mêmes instants que le haut-parleur', async () => {
    await countdown({ videoMic: false });
    expect(mockMarkBeep.mock.calls.map((c) => c[0])).toEqual(['tick', 'tick', 'tick', 'go']);
    expect(mockReplay.mock.calls.map((c) => c[0].replace('file:///cache/bwod_athlex_', '')))
      .toEqual(['tick.wav', 'tick.wav', 'tick.wav', 'go.wav']);
  });
  it('volume des bips à zéro (téléphone muet) : les bips vont dans la vidéo', async () => {
    await countdown({ beepVolume: 0 });
    expect(mockMarkBeep.mock.calls.map((c) => c[0])).toEqual(['tick', 'tick', 'tick', 'go']);
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
