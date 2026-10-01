import React from 'react';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { Dimensions, Linking, StyleSheet, TextInput, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, Download, ExternalLink, Youtube } from 'lucide-react-native';
import i18n from '../i18n';
import { ensureContrast } from '../theme/timerInk';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import { contrast } from '../theme/contrast';
import { axColors, axFonts, axTypography, axVeil } from '../theme/axTokens';
import { AxButton, AxIconButton, AxTag } from '../components/ax';
import type { HomeStackParamList } from '../navigation';
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
jest.mock('react-native-view-shot', () => {
  const R = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return class ViewShot extends R.Component {
    capture = async () => 'file:///card.png';
    render() { return R.createElement(View, this.props); }
  };
});
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
let vib: jest.SpyInstance;
beforeEach(async () => {
  jest.useFakeTimers(); setWindow(PORTRAIT); await AsyncStorage.clear();
  vib = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  vib.mockRestore();
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
async function camera(w = PORTRAIT, theme = darkTheme, countdown = 3) {
  setWindow(w);
  mockParams = { ...CAM, countdown };
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


const STUDIO = 'https://studio.youtube.com/channel/UC/videos/upload';
const vibrations = () => vib.mock.calls.map((c) => c[0]);
const hosts = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
const cdLabel = (root: ReactTestInstance) => hostText(hosts(root, 'timer-countdown-label')[0]);
const cdValue = (root: ReactTestInstance) => hosts(root, 'timer-countdown-value')[0];
/** Démarrer puis « Lancer le chrono » : entrée dans le décompte caméra. */
async function toCountdown(root: ReactTestInstance) {
  await act(async () => { primary(root).props.onPress(); });
  await act(async () => { primary(root).props.onPress(); });
}
async function inLanguage(lng: string, fn: () => Promise<void>) {
  await act(async () => { await i18n.changeLanguage(lng); });
  try { await fn(); } finally { await act(async () => { await i18n.changeLanguage('fr'); }); }
}
/** Pire lecture possible du décompte : voile posé sur une image blanche ou noire. */
const worst = (ink: string) => Math.min(contrast(ink, axVeil.countdown, '#FFFFFF'), contrast(ink, axVeil.countdown, '#000000'));

// Retours iPhone : seul écart de logique, l'objet stocké sans thème (options vidéo seules) suit le thème de l'app (r5b.rn.test.tsx).
const IPHONE_FOLLOW_FIX = ["        // Un thème choisi avant le réglage est conservé ; un objet sans thème (écrit\n        // par les seules options vidéo) laisse le chrono suivre le thème de l'app.\n        setDisplayOptsRaw({ ...migrated, followAppTheme: stored.followAppTheme ?? !theme });", "        // Préférence enregistrée avant le réglage : le thème choisi est conservé.\n        setDisplayOptsRaw({ ...migrated, followAppTheme: stored.followAppTheme ?? false });"] as const;

describe('R6b : feuille « Partager sur YouTube » réduite', () => {
  async function openSheet(theme = darkTheme) {
    const { root } = await walkFlow(PORTRAIT, theme);
    await press(root, 'timer-yt-share');
    return { root, sheet: root.findByProps({ testID: 'timer-yt-sheet' }) };
  }
  it('titre sans emoji, phrase Studio, deux boutons Ax (accent puis outline), plus de champ ni de prompt', async () => {
    const { sheet } = await openSheet();
    expect(texts(sheet)).toEqual(['Partager sur YouTube', 'Publie ta vidéo depuis YouTube Studio', 'Ouvrir YouTube Studio', 'Fermer']);
    const buttons = sheet.findAllByType(AxButton);
    expect(buttons.map((b) => [b.props.testID, b.props.variant, b.props.icon ?? null])).toEqual([
      ['timer-yt-studio', 'accent', ExternalLink], ['timer-yt-close', 'outline', null],
    ]);
    expect(sheet.findAllByType(TextInput)).toHaveLength(0);
  });
  it('« Ouvrir YouTube Studio » ouvre le même lien ; « Fermer » ferme la feuille', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(async () => true);
    const { root } = await openSheet();
    await press(root, 'timer-yt-studio');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(STUDIO);
    await press(root, 'timer-yt-close');
    expect(root.findAll((n) => n.props.testID === 'timer-yt-sheet')).toHaveLength(0);
    open.mockRestore();
  });
  it('textes par clés : version EN', async () => {
    await inLanguage('en', async () => {
      const { sheet } = await openSheet();
      expect(texts(sheet)).toEqual(['Share on YouTube', 'Publish your video from YouTube Studio', 'Open YouTube Studio', 'Close']);
    });
  });
  it('code retiré : champ du lien, prompt, presse-papiers et leurs styles', () => {
    const timer = read('screens/timer/TimerRunScreen.tsx');
    for (const gone of ['ytLink', 'setYtLink', 'TextInput', 'Clipboard', 'KeyboardAvoidingView', 'Copy,', 'Colle ton lien', 'prompt', 'ytInput', 'ytAnalyseBtn', 'ytBtn:', '🎬']) {
      expect(timer).not.toContain(gone);
    }
  });
});

describe('R6b : temps final avec vidéo', () => {
  it('« Partager sur YouTube » seule action accent (menthe, texte foncé) ; Lire, Sauvegarder et Fermer en outline', async () => {
    const { root } = await walkFlow();
    const accents = root.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent');
    expect(accents.map((b) => [b.props.testID, b.props.label, b.props.icon, b.props.veil])).toEqual([
      ['timer-yt-share', 'Partager sur YouTube', Youtube, true],
    ]);
    const label = accents[0].findAll((n) => isHostText(n))[0];
    expect(flat(label).color).toBe(darkTheme.ax.onAccent);
    expect(contrast(darkTheme.ax.onAccent, darkTheme.ax.accent)).toBeGreaterThanOrEqual(4.5);
    for (const id of ['timer-play-video', 'timer-save-card', 'timer-close']) {
      expect(root.findByProps({ testID: id }).props.variant).toBe('outline');
    }
  });
  it('icône check Lucide à la place des ✓ (vidéo enregistrée, carte sauvegardée)', async () => {
    const { root } = await walkFlow();
    const all = () => texts(root).join('|');
    expect(all()).not.toContain('✓');
    expect(root.findByProps({ testID: 'timer-video-saved-icon' }).type).toBe(Check);
    expect(hostText(hosts(root, 'timer-video-saved')[0])).toBe('Vidéo enregistrée');
    const card = () => root.findByProps({ testID: 'timer-save-card' });
    expect([card().props.label, card().props.icon]).toEqual(['Sauvegarder la carte', Download]);
    await press(root, 'timer-save-card');
    await act(async () => {});
    expect(mockSaveToLibrary).toHaveBeenLastCalledWith('file:///card.png');
    expect([card().props.label, card().props.icon]).toEqual(['Carte sauvegardée', Check]);
    expect(all()).not.toContain('✓');
  });
});

describe('R6b : décompte à l’écran en mode caméra', () => {
  it('10 s : « PRÉPARE-TOI » + nom du WOD + anneau au-dessus de 3, « PRÊT ? » + halo à 3-2-1, « GO ! » à 0 sur le chrono lancé', async () => {
    const root = await camera(PORTRAIT, darkTheme, 10);
    await toCountdown(root);
    expect(cdLabel(root)).toBe('PRÉPARE-TOI');
    expect(hostText(cdValue(root))).toBe('10');
    expect(flat(cdValue(root)).color).toBe(axVeil.ink);
    expect(hostText(hosts(root, 'timer-countdown-title')[0])).toBe('Fran');
    expect(hosts(root, 'timer-countdown-ring')).toHaveLength(1);
    expect(flat(hosts(root, 'timer-cam-cd')[0]).backgroundColor).toBe(axVeil.countdown);
    await tick(6000);
    expect([cdLabel(root), hostText(cdValue(root))]).toEqual(['PRÉPARE-TOI', '4']);
    await tick(1000);
    expect([cdLabel(root), hostText(cdValue(root))]).toEqual(['PRÊT ?', '3']);
    expect(hosts(root, 'timer-countdown-glow')).toHaveLength(1);
    expect(hosts(root, 'timer-countdown-ring')).toHaveLength(1);
    expect(flat(hosts(root, 'timer-countdown-title')[0]).opacity).toBe(0);
    expect(root.findAll((n) => n.props.testID === 'timer-go')).toHaveLength(0);
    await tick(2000);
    expect([cdLabel(root), hostText(cdValue(root))]).toEqual(['PRÊT ?', '1']);
    await tick(1000);
    expect(hosts(root, 'timer-cam-cd')).toHaveLength(0);
    expect(primary(root).props.label).toBe('Arrêter le chrono');
    expect(root.findAll((n) => n.props.testID === 'timer-go' && typeof n.type === 'string')).toHaveLength(1);
    expect(texts(root)).toEqual(expect.arrayContaining(['GO !']));
    const band = hosts(root, 'timer-go-band')[0];
    expect(flat(band).backgroundColor).toBe(ensureContrast('#9AE6D2', axVeil.countdownFloor));
    await tick(1000);
    expect(root.findAll((n) => n.props.testID === 'timer-go')).toHaveLength(0);
  });
  it('« PRÊT ? » en accent lisible sur le voile, dans les deux thèmes AthleX (AA, image blanche ou noire)', async () => {
    for (const [theme, accent] of [[darkTheme, '#9AE6D2'], [lightTheme, '#101214']] as const) {
      const root = await camera(PORTRAIT, theme, 3);
      await toCountdown(root);
      const ink = ensureContrast(accent, axVeil.countdownFloor);
      expect(flat(cdValue(root)).color).toBe(ink);
      expect(flat(hosts(root, 'timer-countdown-label')[0]).color).toBe(ink);
      expect(worst(ink)).toBeGreaterThanOrEqual(4.5);
      if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
    }
    expect(worst(axVeil.ink)).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast('#9AE6D2', axVeil.countdownFloor)).toBe('#9AE6D2');
    expect(ensureContrast('#101214', axVeil.countdownFloor)).toBe('#FFFFFF');
    for (const ink of ['#9AE6D2', '#FFFFFF', '#101214']) {
      expect(contrast(ink, axVeil.countdownFloor)).toBeCloseTo(contrast(ink, axVeil.countdown, '#FFFFFF'), 1);
    }
  });
  it('libellés EN : GET READY, READY?, GO!', async () => {
    await inLanguage('en', async () => {
      const root = await camera(PORTRAIT, darkTheme, 4);
      await toCountdown(root);
      expect(cdLabel(root)).toBe('GET READY');
      await tick(1000);
      expect(cdLabel(root)).toBe('READY?');
      await tick(3000);
      expect(texts(root)).toEqual(expect.arrayContaining(['GO!']));
    });
  });
  it('vibrations : 40 ms à 3, 2, 1 puis 200 ms à GO', async () => {
    const root = await camera(PORTRAIT, darkTheme, 5);
    await toCountdown(root);
    await tick(1000);
    expect(vibrations()).toEqual([]);
    await tick(1000);
    expect(vibrations()).toEqual([40]);
    await tick(2000);
    expect(vibrations()).toEqual([40, 40, 40]);
    await tick(1000);
    expect(vibrations()).toEqual([40, 40, 40, 200]);
  });
  it('sons coupés : aucune vibration du décompte', async () => {
    await AsyncStorage.setItem('bwod_timer_display_opts_v2', JSON.stringify({ clockStyle: 'bar', fontSize: 86, digitColor: '#9AE6D2',
      bgCountdown: '#101214', bgRunning: '#101214', bgDone: '#1C2023', bipsEnabled: false, allowRotation: false, themeId: 'athlex', beepVolume: 1 }));
    const root = await camera(PORTRAIT, darkTheme, 3);
    await act(async () => {});
    await toCountdown(root);
    await tick(4000);
    expect(primary(root).props.label).toBe('Arrêter le chrono');
    expect(vibrations()).toEqual([]);
  });
  it('paysage 844 × 390 : décompte et GO dans l’écran', async () => {
    const root = await camera(LANDSCAPE, darkTheme, 4);
    await toCountdown(root);
    const ring = hosts(root, 'timer-countdown-ring')[0];
    expect(Number(flat(ring).width)).toBeLessThanOrEqual(LANDSCAPE.height);
    await tick(4000);
    expect(hosts(root, 'timer-go')).toHaveLength(1);
  });
});

describe('R6b : chrono et natif intacts', () => {
  it('le chrono démarre au même tic que GO ; incrustation native inchangée (valeur du décompte puis 0)', async () => {
    const root = await camera(PORTRAIT, darkTheme, 3);
    await toCountdown(root);
    expect(mockStartRec).toHaveBeenCalledTimes(1);
    await tick(2000);
    expect([cdLabel(root), hostText(cdValue(root))]).toEqual(['PRÊT ?', '1']);
    expect(hosts(root, 'timer-go')).toHaveLength(0);
    await tick(1000);
    expect(hosts(root, 'timer-go')).toHaveLength(1);
    expect(hosts(root, 'timer-cam-cd')).toHaveLength(0);
    expect(hosts(root, 'timer-cam-time').map(hostText)).toEqual(['00:00']);
    await tick(1000);
    expect(hosts(root, 'timer-cam-time').map(hostText)).toEqual(['00:01']);
    const values = mockOverlay.mock.calls.map((c) => (c[0] as { countdownValue?: number }).countdownValue).filter((v) => v !== undefined);
    expect(values[0]).toBe(3);
    expect(values.at(-1)).toBe(0);
    expect(values.every((v, i) => [3, 2, 1, 0].includes(v!) && (i === 0 || v! <= values[i - 1]!))).toBe(true);
  });
  it('logique du chrono : seuls le retrait de ytLink et le GO caméra diffèrent de l’état R5b', () => {
    const timer = read('screens/timer/TimerRunScreen.tsx');
    const now = region(timer, 'export default function TimerRunScreen()', '// Phase-aware accent color');
    const back = now
      .replace(...IPHONE_FOLLOW_FIX)
      .replace("  const [showYT, setShowYT] = useState(false);\n", "  const [showYT, setShowYT] = useState(false);\n  const [ytLink, setYtLink] = useState('');\n")
      .replace("phase === 'running') setShowGo(true);\n    prevPhaseRef.current = phase;\n  }, [phase]);",
        "phase === 'running' && !withCamera) setShowGo(true);\n    prevPhaseRef.current = phase;\n  }, [phase, withCamera]);");
    // R6c : + synchro de l'incrustation déplacée et champs du décompte (écart prouvé dans r6c.rn.test.tsx).
    // R6c (A) : + options vidéo, couvertes par r6cOptionsVideo.rn.test.tsx.
    // R6c (B) : + jeu de bips et bips dans la vidéo, couverts par r6cBips.rn.test.tsx.
    // Bips sans doublon : mixBeepInVideo dans playBeep, plus de calage de latence (r6cBips.rn.test.tsx).
    expect(sha(back)).toBe('56e9dfd34b8433830aca0ded2a1c2ae03419eea8073f88566a2be5a8f5c07d70');
  });
  it('module realtime-recorder et incrustations identiques à master', () => {
    const root = path.join(SRC, '..');
    const files = execSync('git ls-files modules/realtime-recorder', { cwd: root }).toString().trim().split('\n');
    const all = Buffer.concat(files.map((f) => fs.readFileSync(path.join(root, f))));
    // R6c : décompte incrusté (Oswald Medium, libellés, halo, bande GO), vérifié dans r6c.rn.test.tsx.
    // R6c (A) : fps et micro dans le module (r6cOptionsVideo.rn.test.tsx) ; qualité retirée, 1080p fixe, démarrage sérialisé et exception rattrapée (recorderRotationCoordinator.test.ts).
    expect(crypto.createHash('sha256').update(all).digest('hex')).toBe('022c5f809b4d805e1741c23eee3d981e1e403625f5e146aa86fd73a80a3c9d46'); // R6c (B) : mélange des bips (BeepMixerTest.kt) ; décompte incrusté centré (CountdownLayoutTest.kt) ; bips sans doublon : calage de latence retiré
    const timer = read('screens/timer/TimerRunScreen.tsx');
    expect(sha(region(timer, 'const isRecording = withCamera && isRecordingActive;', '    stopVideoAndFinish;\n')))
      .toBe('6b247370baa667947c4af06dd786454b35dd6deb53b463f2bd767b76f6e41c9d');
    expect(sha(region(timer, '? <RealtimeRecorderView', '/>')))
      .toBe('b9be0398d6a1eb22ef0050500d9058f715455a4e25fce20386abd1367b712cd6');
  });
});
