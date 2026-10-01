import React from 'react';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { Dimensions, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import { contrast } from '../theme/contrast';
import { axColors, axFonts, axTypography, axVeil } from '../theme/axTokens';
import { AxButton, AxIconButton, AxTag } from '../components/ax';
import type { HomeStackParamList } from '../navigation';
import '../i18n';
import TimerRunScreen from '../screens/timer/TimerRunScreen';
import VideoPlaybackScreen from '../screens/timer/VideoPlaybackScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockTheme = lightTheme;
let mockParams: unknown;
const mockNavigation = { navigate: mockNavigate, getParent: () => undefined, addListener: () => () => {}, goBack: mockGoBack, setOptions: jest.fn() };
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
const mockSaveToLibrary = jest.fn(async (_p: string) => {});
jest.mock('expo-media-library', () => ({
  usePermissions: () => [{ granted: true }, jest.fn()],
  saveToLibraryAsync: (p: string) => mockSaveToLibrary(p),
}));
const mockWriteFile = jest.fn(async (..._a: unknown[]) => {});
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '', documentDirectory: 'file:///docs/', EncodingType: { Base64: 'base64' },
  writeAsStringAsync: (...a: unknown[]) => mockWriteFile(...a),
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
const mockStartRec = jest.fn(async (_o: unknown) => {});
const mockStopRec = jest.fn(async () => '/docs/video.mp4');
const mockOverlay = jest.fn();
jest.mock('realtime-recorder', () => ({
  RealtimeRecorderView: 'Recorder',
  startRecording: (o: unknown) => mockStartRec(o),
  stopRecording: () => mockStopRec(),
  updateOverlayState: (s: unknown) => mockOverlay(s),
  getLastRecordingStats: () => ({ expectedFrames: 0, writtenFrames: 0 }),
}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-view-shot', () => 'ViewShot');
const mockPlayer = { playing: true, currentTime: 0, duration: 0, loop: false, play: jest.fn(), pause: jest.fn() };
jest.mock('expo-video', () => ({ VideoView: 'VideoView', useVideoPlayer: () => mockPlayer }));
const mockShare = jest.fn(async (_u: string) => {});
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: (u: string) => mockShare(u) }));

let renderer: TestRenderer.ReactTestRenderer | null = null;
const PORTRAIT = { width: 390, height: 844, scale: 3, fontScale: 1 };
const LANDSCAPE = { width: 844, height: 390, scale: 3, fontScale: 1 };
function setWindow(w: typeof PORTRAIT) {
  act(() => { Dimensions.set({ window: w, screen: w }); });
}
beforeEach(() => { jest.useFakeTimers(); setWindow(PORTRAIT); });
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  jest.clearAllMocks();
  mockPlayer.playing = true; mockPlayer.currentTime = 0; mockPlayer.duration = 0;
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
const texts = (root: ReactTestInstance) => root.findAll(isHostText).map(hostText).filter((t) => t.trim());
const byID = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type !== 'string');
const one = (root: ReactTestInstance, id: string) => {
  const n = byID(root, id)[0] ?? root.findAll((x) => x.props.testID === id)[0];
  if (!n) throw new Error(`absent : ${id}`);
  return n;
};
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
async function press(root: ReactTestInstance, id: string) {
  const n = one(root, id);
  await act(async () => { n.props.onPress(); });
}
async function tick(ms: number) {
  await act(async () => { jest.advanceTimersByTime(ms); });
}
async function mount(el: React.ReactElement, theme = darkTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  return renderer!.root;
}
const CAM: HomeStackParamList['TimerRun'] = {
  timerType: 'for-time', countdown: 3, totalSeconds: 0, maxTime: 600, interval: 1, rounds: 1, workTime: 0, restTime: 0,
  withCamera: true, videoTitle: 'Fran', withTimestamp: true, sequence: '[]',
};
async function camera(w = PORTRAIT, theme = darkTheme) {
  setWindow(w);
  mockParams = CAM;
  return mount(<TimerRunScreen />, theme);
}
const primary = (root: ReactTestInstance) => root.findByProps({ testID: 'timer-cam-primary' });
const accentCount = (root: ReactTestInstance) =>
  root.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent').length;

/** Parcourt tout l'enchaînement caméra et relève chaque état. */
async function walkFlow(w = PORTRAIT, theme = darkTheme) {
  const root = await camera(w, theme);
  const states: { label: string; variant: string; accents: number; rec: boolean }[] = [];
  const snap = () => {
    const b = primary(root);
    states.push({
      label: b.props.label, variant: b.props.variant, accents: accentCount(root),
      rec: root.findAll((n) => n.props.testID === 'timer-rec' && n.type === AxTag
        && n.props.tone === 'danger' && n.props.dot === true && n.props.veil === true).length === 1,
    });
  };
  snap();
  const [ready] = [primary(root).props.onPress];
  await act(async () => { ready(); });
  snap();
  await act(async () => { primary(root).props.onPress(); });
  const countdown = { frame: root.findAll((n) => n.props.testID === 'timer-cam-cd' && typeof n.type === 'string').length, texts: texts(root) };
  await tick(3000);
  snap();
  await act(async () => { primary(root).props.onPress(); });
  snap();
  await act(async () => { primary(root).props.onPress(); });
  await act(async () => {});
  return { root, states, countdown };
}

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const SRC = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(SRC, f), 'utf8');
function region(src: string, a: string, b: string) {
  const i = src.indexOf(a); const j = src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(`bornes absentes : ${a}`);
  return src.slice(i, j);
}
/** Voile de caméra posé sur l'image la plus défavorable (blanche ou noire). */
const worstOnVeil = (ink: string, veil: string) => Math.min(contrast(ink, veil, '#FFFFFF'), contrast(ink, veil, '#000000'));

describe('R6a : enchaînement caméra inchangé, boutons Ax', () => {
  it('Prêt → Enregistrement → décompte → chrono → arrêt → temps final, mêmes libellés', async () => {
    const { states, countdown, root } = await walkFlow();
    expect(states.map((s) => s.label)).toEqual(['Démarrer', 'Lancer le chrono', 'Arrêter le chrono', 'Arrêter la vidéo']);
    expect(countdown.frame).toBe(1);
    expect(countdown.texts).toEqual(expect.arrayContaining(['PRÊT ?', '3']));
    expect(texts(root)).toEqual(expect.arrayContaining(['TEMPS FINAL', 'Vidéo enregistrée', 'Scanner pour les détails']));
  });

  it('« Arrêter… » en stop, « Démarrer » / « Lancer le chrono » en accent, une seule action accent par état', async () => {
    const { states, root } = await walkFlow();
    expect(states.map((s) => s.variant)).toEqual(['accent', 'accent', 'stop', 'stop']);
    expect(states.map((s) => s.accents)).toEqual([1, 1, 0, 0]);
    expect(accentCount(root)).toBe(1);
  });

  it('pastille REC : AxTag danger à point rouge, de l’enregistrement à l’arrêt seulement', async () => {
    const { states, root } = await walkFlow();
    expect(states.map((s) => s.rec)).toEqual([false, true, true, true]);
    expect(root.findAll((n) => n.props.testID === 'timer-rec')).toHaveLength(0);
    const tag = (
      <AxTag testID="t" label="REC" tone="danger" dot veil />
    );
    const r = await mount(tag);
    const dot = r.findByProps({ testID: 't-dot' });
    expect(flat(dot).backgroundColor).toBe(axVeil.rec);
    const box = r.findAll((n) => n.props.testID === 't' && typeof n.type === 'string')[0];
    expect(flat(box).borderColor).toBe(axVeil.rec);
    expect(flat(r.findAll(isHostText)[0]).color).toBe(axVeil.ink);
  });

  it('les appuis appellent les mêmes fonctions : enregistrement natif, arrêt, galerie, métadonnées', async () => {
    const { root } = await walkFlow();
    expect(mockStartRec).toHaveBeenCalledTimes(1);
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ facing: 'back', isLandscape: false }));
    expect(mockStopRec).toHaveBeenCalledTimes(1);
    expect(mockSaveToLibrary).toHaveBeenCalledWith('/docs/video.mp4');
    const meta = JSON.parse(String((mockWriteFile.mock.calls.at(-1) as unknown[])[1]));
    expect(meta).toEqual(expect.objectContaining({ videoURL: 'file:///docs/video.mp4', countdownDuration: 3, overlaysBurned: true }));
    await press(root, 'timer-play-video');
    expect(mockNavigate).toHaveBeenCalledWith('VideoPlayback', expect.objectContaining({
      videoURL: 'file:///docs/video.mp4', countdownDuration: 3, overlaysBurned: true,
    }));
    await press(root, 'timer-close');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('retourner la caméra et fermer : AxIconButton sur voile, mêmes actions', async () => {
    const root = await camera();
    const flip = root.findByProps({ testID: 'timer-cam-flip' });
    expect(flip.type).toBe(AxIconButton);
    expect(flip.props.veil).toBe(true);
    await act(async () => { flip.props.onPress(); });
    await act(async () => { primary(root).props.onPress(); });
    expect(mockStartRec).toHaveBeenCalledWith(expect.objectContaining({ facing: 'front' }));
    const close = root.findByProps({ testID: 'timer-cam-close' });
    expect(close.type).toBe(AxIconButton);
    expect(close.props.veil).toBe(true);
    await act(async () => { close.props.onPress(); });
    expect(mockStopRec).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('temps final avec vidéo : Lire, Sauvegarder et Fermer en outline sur voile (partage et feuille YouTube : r6b)', async () => {
    const { root } = await walkFlow();
    for (const id of ['timer-play-video', 'timer-save-card', 'timer-close']) {
      const b = root.findByProps({ testID: id });
      expect(b.type).toBe(AxButton);
      expect([b.props.variant, b.props.veil]).toEqual(['outline', true]);
    }
    expect(root.findByProps({ testID: 'timer-final-tag' }).type).toBe(AxTag);
  });
});

describe('R6a : typographie et lisibilité sur l’image de la caméra', () => {
  it('chiffres du chrono et du décompte en Oswald, date et heure en caption', async () => {
    const root = await camera();
    await act(async () => { primary(root).props.onPress(); });
    await act(async () => { primary(root).props.onPress(); });
    expect(flat(root.findAll((n) => n.props.testID === 'timer-countdown-value')[0]).fontFamily).toBe(axFonts.oswaldMedium);
    await tick(3000);
    const time = root.findAll((n) => n.props.testID === 'timer-cam-time')[0];
    expect(flat(time).fontFamily).toBe(axFonts.oswaldMedium);
    const clock = root.findAll((n) => n.props.testID === 'timer-cam-clock' && isHostText(n))[0];
    expect(flat(clock)).toEqual(expect.objectContaining({ ...axTypography.caption, color: axVeil.ink }));
    await act(async () => { primary(root).props.onPress(); });
    await act(async () => { primary(root).props.onPress(); });
    await act(async () => {});
    const date = root.findAll((n) => n.props.testID === 'timer-final-date' && isHostText(n))[0];
    expect(flat(date)).toEqual(expect.objectContaining({ ...axTypography.caption, color: axVeil.ink }));
    const final = root.findAll((n) => n.props.testID === 'timer-final-time' && isHostText(n))[0];
    expect(flat(final)).toEqual(expect.objectContaining({ fontFamily: axFonts.oswaldMedium, color: axVeil.ink }));
  });

  it('AA : encre du voile, bouton stop, accent et indice du QR, même sur une image blanche ou noire', () => {
    expect(worstOnVeil(axVeil.ink, axVeil.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(axVeil.ink, axVeil.stop)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(axColors.dark.onAccent, axColors.dark.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(axColors.light.textMuted, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('le temps final est posé sur le voile sombre, identique dans les deux thèmes de l’app', async () => {
    for (const theme of [darkTheme, lightTheme]) {
      const { root } = await walkFlow(PORTRAIT, theme);
      expect(flat(root.findByProps({ testID: 'timer-cam-dim' })).backgroundColor).toBe(axVeil.background);
      const rec = await mount(<AxButton veil variant="stop" label="x" onPress={() => {}} />, theme);
      const txt = rec.findAll(isHostText)[0];
      expect(flat(txt).color).toBe(axVeil.ink);
      const outline = await mount(<AxButton veil variant="outline" label="y" onPress={() => {}} />, theme);
      expect(flat(outline.findAll(isHostText)[0]).color).toBe(axVeil.ink);
    }
  });
});

describe('R6a : portrait et paysage sans débordement', () => {
  for (const [name, w] of [['portrait 390 × 844', PORTRAIT], ['paysage 844 × 390', LANDSCAPE]] as const) {
    it(`${name} : action principale dans l’écran à chaque état`, async () => {
      const { states, root } = await walkFlow(w);
      expect(states.map((s) => s.label)).toEqual(['Démarrer', 'Lancer le chrono', 'Arrêter le chrono', 'Arrêter la vidéo']);
      expect(texts(root)).toEqual(expect.arrayContaining(['Lire la vidéo', 'Sauvegarder la carte', 'Partager sur YouTube', 'Fermer']));
      if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
      const again = await camera(w);
      const wrap = again.findByProps({ testID: 'timer-cam-primary' }).parent!;
      const s = flat(wrap);
      const width = typeof s.width === 'number' ? s.width : Math.min(Number(s.maxWidth), w.width);
      expect(width).toBeLessThanOrEqual(w.width);
      expect(width).toBeGreaterThan(0);
    });
  }
});

describe('R6a : module natif et incrustation dans la vidéo inchangés', () => {
  const TIMER = read('screens/timer/TimerRunScreen.tsx');
  it('import, vue d’aperçu et états caméra identiques à master (empreintes)', () => {
    expect(TIMER).toContain("import { RealtimeRecorderView, updateOverlayState, startRecording as nativeStartRec, stopRecording as nativeStopRec } from 'realtime-recorder';");
    expect(sha(region(TIMER, 'const isRecording = withCamera && isRecordingActive;', '    stopVideoAndFinish;\n')))
      .toBe('6b247370baa667947c4af06dd786454b35dd6deb53b463f2bd767b76f6e41c9d');
    expect(sha(region(TIMER, '? <RealtimeRecorderView', '/>')))
      .toBe('b9be0398d6a1eb22ef0050500d9058f715455a4e25fce20386abd1367b712cd6');
  });

  it('fichiers du module realtime-recorder inchangés', () => {
    const root = path.join(SRC, '..');
    const files = execSync('git ls-files modules/realtime-recorder', { cwd: root }).toString().trim().split('\n');
    const all = Buffer.concat(files.map((f) => fs.readFileSync(path.join(root, f))));
    // R6c : décompte incrusté (Oswald Medium, libellés, halo, bande GO), vérifié dans r6c.rn.test.tsx.
    // R6c (A) : fps et micro dans le module (r6cOptionsVideo.rn.test.tsx) ; qualité retirée, 1080p fixe, démarrage sérialisé et exception rattrapée (recorderRotationCoordinator.test.ts).
    expect(crypto.createHash('sha256').update(all).digest('hex'))
      .toBe('022c5f809b4d805e1741c23eee3d981e1e403625f5e146aa86fd73a80a3c9d46'); // R6c (B) : mélange des bips (BeepMixerTest.kt) ; décompte incrusté centré (CountdownLayoutTest.kt, decompteVideoCentre.test.ts) ; bips sans doublon : calage de latence retiré (r6cBips.rn.test.tsx)
  });

  it('l’état d’incrustation suit toujours l’enregistrement', async () => {
    await walkFlow();
    const states = mockOverlay.mock.calls.map((c) => c[0] as { isRecording?: boolean });
    expect(states.some((s) => s.isRecording === true)).toBe(true);
  });
});

describe('R6a : lecture de la vidéo', () => {
  const PARAMS = { videoURL: 'file:///v.mp4', title: 'Fran', recordedAt: '2026-09-01T10:00:00.000Z', timerStartOffset: 3000, timerStopOffset: 0, countdownDuration: 3, overlaysBurned: false };

  it('lecteur et logique identiques à master (empreinte)', () => {
    const src = read('screens/timer/VideoPlaybackScreen.tsx');
    expect(sha(region(src, 'export default function VideoPlaybackScreen()', '\n  return (\n'))).toBe('6f35ed9ddf62f6db65ae7517cd86670f2ce7951bbda98de6bbe3833cfe3ec97c');
    expect(src).toContain('<VideoView\n          player={player}');
  });

  it('contrôles en AxIconButton sur voile, mêmes actions (pause / lecture, partager, fermer)', async () => {
    mockParams = PARAMS;
    mockPlayer.duration = 60; mockPlayer.currentTime = 5;
    const root = await mount(<VideoPlaybackScreen />);
    await tick(200);
    const surface = root.findAll((n) => typeof n.props.onPress === 'function' && n.props.activeOpacity === 1)[0];
    await act(async () => { surface.props.onPress(); });
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    mockPlayer.playing = false;
    for (const id of ['playback-share', 'playback-close', 'playback-toggle']) {
      const b = root.findByProps({ testID: id });
      expect(b.type).toBe(AxIconButton);
      expect(b.props.veil).toBe(true);
    }
    expect(root.findByProps({ testID: 'playback-toggle' }).props.accessibilityLabel).toBe('Lecture');
    await act(async () => { root.findByProps({ testID: 'playback-toggle' }).props.onPress(); });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(root.findByProps({ testID: 'playback-toggle' }).props.accessibilityLabel).toBe('Pause');
    await act(async () => { await root.findByProps({ testID: 'playback-share' }).props.onPress(); });
    expect(mockShare).toHaveBeenCalledWith('file:///v.mp4');
    await act(async () => { root.findByProps({ testID: 'playback-close' }).props.onPress(); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('temps en caption, chrono en Oswald, barre de lecture à l’accent', async () => {
    mockParams = PARAMS;
    mockPlayer.duration = 60; mockPlayer.currentTime = 5;
    const root = await mount(<VideoPlaybackScreen />);
    await tick(200);
    for (const id of ['playback-current', 'playback-duration']) {
      expect(flat(root.findByProps({ testID: id }))).toEqual(expect.objectContaining({ ...axTypography.caption, color: axVeil.ink }));
    }
    expect(texts(root.findByProps({ testID: 'playback-duration' }))).toEqual(['01:00']);
    expect(flat(root.findByProps({ testID: 'playback-chrono' })).fontFamily).toBe(axFonts.oswaldMedium);
    expect(texts(root.findByProps({ testID: 'playback-chrono' }))).toEqual(['00:02']);
    expect(flat(root.findByProps({ testID: 'playback-fill' })).backgroundColor).toBe(darkTheme.ax.accent);
  });
});
