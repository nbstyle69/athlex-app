import React from 'react';
import { AccessibilityInfo, Animated, Dimensions, Modal, PixelRatio, Platform, StyleSheet, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { X } from 'lucide-react-native';
import { lightTheme, darkTheme } from '../theme/palette';
import type { HomeStackParamList } from '../navigation';
import TimerRunScreen, { CAM_INFO_GAP, CAM_REC_GAP, CD_ANIM } from '../screens/timer/TimerRunScreen';
import { RecBlinkDot, REC_DOT } from '../components/timer/RecBlinkDot';
import { AxSwitch } from '../components/ax';
import { saveVideoOpts } from '../lib/timerVideoOpts';
import { OSWALD_MEDIUM, OSWALD_MEDIUM_CENTER_SHIFT_EM, OSWALD_MEDIUM_LINE_EM } from '../theme/oswaldMetrics';
import { FICHIER_OSWALD_MEDIUM, lirePolice } from './policeTtf';

let mockTheme = lightTheme;
let mockParams: unknown;
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
const mockNavigation = { navigate: jest.fn(), getParent: () => undefined, addListener: () => () => {}, goBack: jest.fn(), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => mockInsets, SafeAreaView: View };
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
  cacheDirectory: '', documentDirectory: 'file:///docs/', EncodingType: { Base64: 'base64' }, writeAsStringAsync: jest.fn(async () => {}),
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
jest.mock('realtime-recorder', () => ({
  RealtimeRecorderView: 'Recorder',
  startRecording: jest.fn(async () => {}),
  stopRecording: jest.fn(async () => '/docs/video.mp4'),
  updateOverlayState: jest.fn(),
  getLastRecordingStats: () => ({ expectedFrames: 0, writtenFrames: 0 }),
  markBeep: jest.fn(),
}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-view-shot', () => {
  const R = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return class ViewShot extends R.Component { render() { return R.createElement(View, this.props); } };
});

const PORTRAIT = { width: 390, height: 844, scale: 3, fontScale: 1 };
const LANDSCAPE = { width: 844, height: 390, scale: 3, fontScale: 1 };
/** iPhone 15 : îlot dynamique, zone sûre haute de 59 pt en portrait. */
const ISLAND = { top: 59, bottom: 34, left: 0, right: 0 };
function setWindow(w: typeof PORTRAIT) { act(() => { Dimensions.set({ window: w, screen: w }); }); }

let renderer: TestRenderer.ReactTestRenderer | null = null;
let vib: jest.SpyInstance;
beforeEach(async () => {
  jest.useFakeTimers(); setWindow(PORTRAIT); mockInsets = ISLAND; await AsyncStorage.clear();
  vib = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  vib.mockRestore();
  jest.restoreAllMocks();
});

const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const host = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
const one = (root: ReactTestInstance, id: string) => {
  const n = host(root, id)[0];
  if (!n) throw new Error(`absent : ${id}`);
  return n;
};
const hostText = (n: ReactTestInstance): string => [n.props.children].flat().join('');
async function tick(s: number) { await act(async () => { jest.advanceTimersByTime(s * 1000); }); }
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await act(async () => { n.props.onPress(); });
}
const params = (p: Partial<HomeStackParamList['TimerRun']> = {}): HomeStackParamList['TimerRun'] => ({
  timerType: 'for-time', countdown: 0, totalSeconds: 0, maxTime: 600, interval: 1, rounds: 1, workTime: 0, restTime: 0,
  withCamera: false, videoTitle: 'Fran', withTimestamp: true, sequence: '[]', ...p,
});
async function run(p: HomeStackParamList['TimerRun'], theme = lightTheme, w = PORTRAIT) {
  setWindow(w);
  mockTheme = theme; mockParams = p;
  await act(async () => { renderer = TestRenderer.create(<TimerRunScreen />); });
  await act(async () => { await Promise.resolve(); });
  return renderer!.root;
}
const camPrimary = (root: ReactTestInstance) => root.findByProps({ testID: 'timer-cam-primary' });
async function camPress(root: ReactTestInstance) { await act(async () => { camPrimary(root).props.onPress(); }); }
const isAncestor = (a: ReactTestInstance, b: ReactTestInstance) => { let n: ReactTestInstance | null = b.parent; while (n) { if (n === a) return true; n = n.parent; } return false; };

describe('Retours iPhone (2) : décompte centré, chiffre au centre du cercle, halo circulaire', () => {
  it.each([['portrait', PORTRAIT], ['paysage', LANDSCAPE]] as const)('sans caméra, %s : le décompte couvre l’écran entier et s’y centre', async (_, w) => {
    const r = await run(params({ countdown: 5 }), lightTheme, w);
    await press(r, 'timer-start-stop');
    const overlay = one(r, 'timer-cd-overlay');
    expect(flat(overlay)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' });
    expect(isAncestor(overlay, one(r, 'timer-countdown'))).toBe(true);
    expect(overlay.props.pointerEvents).toBe('none');
    expect(r.findAll((n) => n.props.testID === 'timer-countdown' && typeof n.type === 'string')).toHaveLength(1);
  });
  it.each([['portrait', PORTRAIT], ['paysage', LANDSCAPE]] as const)('avec caméra, %s : voile plein écran centré, sans décalage vers le haut', async (_, w) => {
    const r = await run(params({ countdown: 5, withCamera: true }), darkTheme, w);
    await camPress(r); await camPress(r);
    const st = flat(one(r, 'timer-cam-cd'));
    expect(st).toMatchObject({ position: 'absolute', top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' });
    expect(st.paddingBottom ?? 0).toBe(0);
    expect(st.paddingTop ?? 0).toBe(0);
  });
  it('le chiffre occupe toute la largeur du cercle, centré, sans approche négative ni réduction de police', async () => {
    const r = await run(params({ countdown: 10 }));
    await press(r, 'timer-start-stop');
    const ring = flat(one(r, 'timer-countdown-ring'));
    const v = one(r, 'timer-countdown-value');
    const st = flat(v);
    expect(ring.width).toBe(ring.height);
    expect(ring.borderRadius).toBe((ring.width as number) / 2);
    expect(st).toMatchObject({ width: ring.width, textAlign: 'center', letterSpacing: 0, includeFontPadding: false });
    expect(v.props.adjustsFontSizeToFit).toBeFalsy();
  });
  it('3-2-1 : même cercle, même taille et même position du chiffre que le reste du décompte', async () => {
    const r = await run(params({ countdown: 5 }));
    await press(r, 'timer-start-stop');
    await tick(1);
    expect(hostText(one(r, 'timer-countdown-value'))).toBe('4');
    const geo = () => {
      const ring = flat(one(r, 'timer-countdown-ring'));
      const v = flat(one(r, 'timer-countdown-value'));
      const title = one(r, 'timer-countdown-title');
      return { w: ring.width, h: ring.height, radius: ring.borderRadius, border: ring.borderWidth,
        fontSize: v.fontSize, lineHeight: v.lineHeight, vw: v.width, titleLines: title.props.numberOfLines };
    };
    const calm = geo();
    await tick(1);
    expect(hostText(one(r, 'timer-countdown-value'))).toBe('3');
    expect(geo()).toEqual(calm);
  });
  it('« PRÊT ? » : anneau circulaire, sans halo plein ni fond (#547), aucune ombre de texte (rognée en rectangle sur iOS)', async () => {
    const r = await run(params({ countdown: 3 }));
    await press(r, 'timer-start-stop');
    const halo = flat(one(r, 'timer-countdown-ring'));
    expect(halo.borderRadius).toBe((halo.width as number) / 2);
    expect(host(r, 'timer-countdown-glow')).toHaveLength(0);
    expect(halo.backgroundColor ?? 'transparent').toBe('transparent');
    const st = flat(one(r, 'timer-countdown-value'));
    expect(st.textShadowRadius ?? 0).toBe(0);
    expect(st.textShadowColor).toBeUndefined();
    expect(st.width).toBe(halo.width);
  });
});

describe('Retours iPhone (3) : caméra, REC sous l’îlot, point clignotant, date sous le bouton', () => {
  it('portrait : la rangée REC démarre au moins 40 px sous la zone sûre', async () => {
    const r = await run(params({ countdown: 3, withCamera: true }), darkTheme);
    await camPress(r);
    expect(host(r, 'timer-rec').length).toBeGreaterThan(0);
    expect(flat(one(r, 'timer-overlay')).paddingTop).toBeGreaterThanOrEqual(ISLAND.top + CAM_REC_GAP);
    expect(CAM_REC_GAP).toBeGreaterThanOrEqual(40);
  });
  it('point rouge à droite pendant l’enregistrement seulement', async () => {
    const r = await run(params({ countdown: 3, withCamera: true }), darkTheme);
    expect(r.findAllByType(RecBlinkDot)).toHaveLength(0);
    await camPress(r);
    expect(r.findAllByType(RecBlinkDot)).toHaveLength(1);
    const dot = one(r, 'timer-rec-blink');
    const row = one(r, 'timer-cam-topbar');
    expect(flat(row).justifyContent).toBe('space-between');
    const kids = row.children.filter((c): c is ReactTestInstance => typeof c !== 'string');
    expect(isAncestor(kids[kids.length - 1], dot)).toBe(true);
    expect(flat(dot)).toMatchObject({ backgroundColor: REC_DOT.color, borderRadius: REC_DOT.size / 2 });
  });
  it('chrono lancé : le point reste à droite pendant tout l’enregistrement', async () => {
    const r = await run(params({ countdown: 0, withCamera: true }), darkTheme);
    await camPress(r); await camPress(r); await tick(1);
    expect(camPrimary(r).props.label).toMatch(/Arrêter/);
    const row = one(r, 'timer-cam-topbar');
    const kids = row.children.filter((c): c is ReactTestInstance => typeof c !== 'string');
    expect(isAncestor(kids[kids.length - 1], one(r, 'timer-rec-blink'))).toBe(true);
  });
  it('date et heure sous « Arrêter le chrono », avec un espace', async () => {
    const r = await run(params({ countdown: 0, withCamera: true }), darkTheme);
    await camPress(r); await camPress(r); await tick(1);
    expect(camPrimary(r).props.label).toMatch(/Arrêter/);
    const stack = one(r, 'timer-cam-bottom');
    const kids = stack.children.filter((c): c is ReactTestInstance => typeof c !== 'string');
    const iPrimary = kids.findIndex((k) => k.props.testID === 'timer-cam-primary-wrap');
    const iInfo = kids.findIndex((k) => k.props.testID === 'timer-cam-infobar');
    expect(iPrimary).toBeGreaterThanOrEqual(0);
    expect(iInfo).toBe(iPrimary + 1);
    expect((flat(stack).gap as number) + (flat(kids[iInfo]).marginTop as number)).toBe(CAM_INFO_GAP);
    expect(CAM_INFO_GAP).toBeGreaterThan(0);
    expect(host(r, 'timer-cam-clock').length).toBeGreaterThan(0);
  });
});

describe('Retours iPhone (3) : clignotement doux, arrêté si « réduire les animations »', () => {
  async function mountDot(reduce: boolean) {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduce);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    const loop = jest.spyOn(Animated, 'loop');
    await act(async () => { renderer = TestRenderer.create(<RecBlinkDot />); });
    await act(async () => { await Promise.resolve(); });
    return loop;
  }
  it('animations permises : boucle d’opacité douce (≥ 0,25, demi-période ≥ 600 ms)', async () => {
    const loop = await mountDot(false);
    expect(loop).toHaveBeenCalled();
    expect(REC_DOT.minOpacity).toBeGreaterThanOrEqual(0.25);
    expect(REC_DOT.halfPeriodMs).toBeGreaterThanOrEqual(600);
  });
  it('réduire les animations : point fixe, pleinement visible', async () => {
    const loop = await mountDot(true);
    await tick(5);
    expect(loop).not.toHaveBeenCalled();
    const opacity = flat(renderer!.root.findByProps({ testID: 'timer-rec-blink' })).opacity as unknown as Animated.Value;
    expect(Number(JSON.stringify(opacity))).toBe(1);
  });
});

describe('Retours iPhone (4) : temps final sans vidéo', () => {
  const final = async (theme = lightTheme, w = PORTRAIT) => {
    const r = await run(params(), theme, w);
    const running = { ...flat(one(r, 'timer-controls')) };
    if (w === PORTRAIT) for (const id of ['timer-ctrl-close', 'timer-ctrl-settings']) {
      const btn = host(r, id).find((n) => isAncestor(one(r, 'timer-controls'), n))!;
      expect(flat(btn).alignSelf).toBe('flex-start');
    }
    await press(r, 'timer-start-stop'); await tick(3); await press(r, 'timer-start-stop');
    return { r, running };
  };
  it.each([['clair', lightTheme, 'rgba(0,0,0,0.65)'], ['sombre', darkTheme, 'rgba(255,255,255,0.8)']] as const)(
    'thème %s : logo comme sur Connexion, croix et Réglages à la place du chrono, couleur du thème de chrono', async (_, th, ink) => {
      const { r, running } = await final(th);
      const logo = one(r, 'timer-final-logo');
      expect(flat(logo)).toMatchObject({ width: 120, height: 120 });
      const ctrls = flat(one(r, 'timer-final-controls'));
      for (const k of ['paddingTop', 'paddingHorizontal', 'paddingBottom'] as const) expect(ctrls[k]).toBe(running[k]);
      expect(ctrls.paddingTop).toBeGreaterThanOrEqual(ISLAND.top);
      const finalRow = one(r, 'timer-final-controls');
      const xs = finalRow.findAllByType(X);
      expect(xs).toHaveLength(1);
      expect(xs[0].props.color).toBe(ink);
      expect(r.findAll((n) => n.props.testID === 'timer-rec')).toHaveLength(0);
      await press(r, 'timer-ctrl-settings');
      expect(r.findAllByType(Modal).some((m) => m.props.visible)).toBe(true);
    });
  // R3 : en paysage, les marges du bandeau du chrono sont portées par la page (maquette Paysage A) ;
  // relecture de #479 : la rangée du temps final reprend exactement ces marges (zone sûre comprise).
  it('paysage : même place que pendant le chrono', async () => {
    const r0 = await run(params(), lightTheme, LANDSCAPE);
    const page = { ...flat(one(r0, 'timer-landscape')) };
    await press(r0, 'timer-start-stop'); await tick(3); await press(r0, 'timer-start-stop');
    const ctrls = flat(one(r0, 'timer-final-controls'));
    expect(ctrls.paddingTop).toBe(page.paddingTop);
    expect(ctrls.paddingLeft).toBe(page.paddingLeft);
    expect(ctrls.paddingRight).toBe(page.paddingRight);
  });
});

describe('Retours iPhone (5) : paysage sans vidéo, For Time au repos', () => {
  // R3 : le bouton Lecture est passé dans la rangée du bas (maquette Paysage A) ; plus de place réservée à droite.
  it('chiffres centrés sur l’écran : marges latérales égales', async () => {
    const r = await run(params(), lightTheme, LANDSCAPE);
    const page = flat(one(r, 'timer-landscape'));
    expect(page.paddingLeft).toBe(page.paddingRight);
    expect(flat(one(r, 'timer-main-time'))).toMatchObject({ textAlign: 'center' });
  });
});

describe('Retours iPhone (6) : « Suivre le thème de l’app » après un réglage vidéo', () => {
  const followSwitch = (root: ReactTestInstance) => root.findAllByType(AxSwitch).find((s) => s.props.testID === 'timer-follow-app-switch')!;
  const bgs = (root: ReactTestInstance) => new Set(root.findAll((n) => String(n.type) === 'View')
    .map((n) => flat(n)).filter((st) => st.flex === 1).map((st) => st.backgroundColor));
  it.each([['clair', lightTheme, '#9AE6D2'], ['sombre', darkTheme, '#101214']] as const)(
    'app en %s, cadence vidéo déjà choisie : le chrono suit le thème de l’app', async (_, th, bg) => {
      await saveVideoOpts({ videoFps: 25 });
      const r = await run(params(), th);
      await press(r, 'timer-start-stop'); await tick(1);
      expect(bgs(r).has(bg)).toBe(true);
      await press(r, 'timer-ctrl-settings');
      expect(followSwitch(r).props.value).toBe(true);
    });
  it('le passage Sombre ↔ Clair du Profil bascule AthleX ↔ AthleX 2', async () => {
    await saveVideoOpts({ videoMic: false });
    const r = await run(params(), darkTheme);
    await press(r, 'timer-start-stop'); await tick(1);
    expect(bgs(r).has('#101214')).toBe(true);
    mockTheme = lightTheme;
    await act(async () => { renderer!.update(<TimerRunScreen />); });
    expect(bgs(r).has('#9AE6D2')).toBe(true);
    expect(bgs(r).has('#101214')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// #547 (retour du build 1.0.64) : le chiffre du décompte n'était pas centré dans le cercle.
// La boîte de ligne était centrée, pas le glyphe ; avec une ligne plus courte que la ligne
// native d'Oswald, iOS et Android ne posaient pas non plus la ligne de base au même endroit.
// Vérité indépendante du code : le fichier Oswald Medium embarqué, la façon dont React Native
// 0.81 place la ligne de base quand lineHeight est fixé (iOS : RCTApplyBaselineOffsetForRange,
// en flottants ; Android : TextAttributeProps, CustomLineHeightSpan, getFontMetricsInt, en
// pixels entiers), et pour Android les lignes natives relevées sur l'émulateur (onTextLayout).
// ═════════════════════════════════════════════════════════════════════════════
const MEDIUM = lirePolice(FICHIER_OSWALD_MEDIUM);
type Plateforme = { os: 'ios' | 'android'; d: number };
/** Cadre du texte (hauteur) et ligne de base depuis son haut, en dp, et demi-capitale, sur une plateforme. */
function ligne(fs: number, L: number, { os, d }: Plateforme) {
  const em = MEDIUM.unitsPerEm, A = MEDIUM.hhea.ascender, D = -MEDIUM.hhea.descender;
  if (os === 'ios') {
    const asc = (A * fs) / em, N = ((A + D + MEDIUM.hhea.lineGap) * fs) / em;
    // Ligne native centrée dans lineHeight si elle y tient ; sinon iOS garde le bas de la ligne.
    return { hauteur: L, base: L >= N ? (L - N) / 2 + asc : L - (D * fs) / em, demiCap: (MEDIUM.capHeight * fs) / em / 2 };
  }
  const f = Math.ceil(fs * d), Lp = Math.ceil(L * d);
  const asc = Math.round((A * f) / em), desc = Math.round((D * f) / em);
  return { hauteur: Lp / d, base: (asc + Math.ceil((Lp - asc - desc) / 2)) / d, demiCap: (MEDIUM.capHeight * f) / em / 2 / d };
}
const hoteParent = (n: ReactTestInstance) => { let p = n.parent; while (p && typeof p.type !== 'string') p = p.parent; return p; };
/** Échelle et opacité courantes d'un nœud (transform scale, absente : 1). */
/** Valeur courante (nombre ou Animated.Value, lue par son toJSON). */
const valeur = (v: unknown) => (v === undefined ? undefined : Number(JSON.stringify(v)));
const echelle = (n: ReactTestInstance) => ((flat(n).transform as { scale?: unknown }[] | undefined) ?? []).reduce((s: number, t) => s * (valeur(t.scale) ?? 1), 1);
const opacite = (n: ReactTestInstance) => valeur(flat(n).opacity) ?? 1;
/** Avance par pas de 10 ms jusqu'à l'apparition de la valeur (au plus 12 s). */
async function apparition(r: ReactTestInstance, chiffre: string) {
  for (let ms = 0; hostText(one(r, 'timer-countdown-value')) !== chiffre; ms += 10) {
    if (ms > 12000) throw new Error('valeur jamais affichée : ' + chiffre);
    await act(async () => { jest.advanceTimersByTime(10); });
  }
}
/**
 * Animations du décompte observables dans jest : chaque Animated.timing est relevé (pour vérifier
 * useNativeDriver: true), puis joué par le pilote JS, que les minuteries simulées font avancer.
 */
const TIMING = Animated.timing;
function animationsObservables() {
  // Animations permises, explicitement (le mock par défaut peut avoir été effacé par restoreAllMocks).
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const releves: Animated.TimingAnimationConfig[] = [];
  jest.spyOn(Animated, 'timing').mockImplementation((v, c) => { releves.push(c); return TIMING(v, { ...c, useNativeDriver: false }); });
  return releves;
}
/** Milieu du glyphe (ligne de base − capHeight / 2) moins le milieu du cercle, en dp. */
function ecartAuCentre(r: ReactTestInstance, p: Plateforme) {
  const ring = one(r, 'timer-countdown-ring');
  const v = one(r, 'timer-countdown-value');
  const a = flat(ring), st = flat(v);
  // Conditions du modèle : chiffre enfant direct du cercle, centré par lui, sans marge, rembourrage ni hauteur imposée.
  let parent = hoteParent(v);
  // #547 PR 2 : le chiffre est dans la couche du zoom, qui remplit l'intérieur de l'anneau et le centre ;
  // à l'instant mesuré, son échelle vaut 1.
  if (parent?.props.testID === 'timer-countdown-zoom') {
    const z = flat(parent);
    expect(z).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' });
    expect(echelle(parent)).toBeCloseTo(1, 6);
    // Animée (pas l'état fixe de « Réduire les animations ») : la couche porte bien une échelle.
    expect((flat(parent).transform as unknown[] | undefined)?.length).toBe(1);
    parent = hoteParent(parent);
  } else expect(a).toMatchObject({ justifyContent: 'center', alignItems: 'center' });
  expect(parent === ring).toBe(true);
  for (const k of ['padding', 'paddingTop', 'paddingBottom', 'paddingVertical'] as const) expect(a[k] ?? 0).toBe(0);
  for (const k of ['margin', 'marginTop', 'marginBottom', 'marginVertical', 'top', 'bottom'] as const) expect(st[k] ?? 0).toBe(0);
  // Cadre du texte : sa hauteur imposée, égale à la ligne (pas plus courte : la ligne serait rognée, le chiffre descendrait).
  expect(st.height).toBe(st.lineHeight);
  const S = a.height as number, B = (a.borderWidth as number) ?? 0;
  const l = ligne(st.fontSize as number, st.lineHeight as number, p);
  // Cadre de hauteur H centré dans l'anneau ; Android y centre sa ligne en px entiers (textAlignVertical: center).
  const H = st.height as number;
  const haut = B + (S - 2 * B - H) / 2 + (p.os === 'android' ? (H - l.hauteur) / 2 : 0);
  const ty = ((st.transform as { translateY?: number }[] | undefined) ?? []).reduce((s, t) => s + (t.translateY ?? 0), 0);
  return haut + l.base - l.demiCap + ty - S / 2;
}
/** Lignes natives relevées sur l'émulateur Android (420 ppp) : taille, lineHeight, puis hauteur, ascendante, descendante. */
const RELEVES_ANDROID: [number, number, number, number, number][] = [
  [109, 131, 131.048, 115.048, 16.000], [133, 160, 160.000, 140.571, 19.429], [74, 89, 89.143, 78.476, 10.667],
  [90, 108, 108.190, 95.238, 12.952], [97, 116, 116.190, 102.095, 14.095], [118, 142, 142.095, 124.571, 17.524],
  [109, 162, 162.286, 130.667, 31.619], [133, 198, 198.095, 159.619, 38.476], [74, 110, 110.095, 88.762, 21.333],
  [90, 134, 134.095, 108.190, 25.905], [97, 144, 144.000, 115.810, 28.190], [118, 175, 175.238, 140.952, 34.286],
];

describe('#547 : chiffre du décompte centré dans le cercle par son glyphe, même place sur iOS et Android', () => {
  it('le décalage vient des mesures du fichier Oswald Medium embarqué (glyphe sous le milieu : remonté)', () => {
    expect(OSWALD_MEDIUM.unitsPerEm).toBe(MEDIUM.unitsPerEm);
    expect([OSWALD_MEDIUM.ascender, OSWALD_MEDIUM.descender, OSWALD_MEDIUM.lineGap]).toEqual([MEDIUM.hhea.ascender, MEDIUM.hhea.descender, MEDIUM.hhea.lineGap]);
    // Android suit OS/2 typo (USE_TYPO_METRICS) : identiques à hhea, donc même ligne sur les deux plateformes.
    expect(MEDIUM.typo).toEqual({ ascender: MEDIUM.hhea.ascender, descender: MEDIUM.hhea.descender, lineGap: MEDIUM.hhea.lineGap, utilisees: true });
    expect(OSWALD_MEDIUM.capHeight).toBe(MEDIUM.capHeight);
    const { ascender: A, descender: D, lineGap: G } = MEDIUM.hhea;
    const attendu = ((A - D + G) / 2 - (A - MEDIUM.capHeight / 2)) / MEDIUM.unitsPerEm;
    expect(attendu).toBeLessThan(0);
    expect(OSWALD_MEDIUM_CENTER_SHIFT_EM).toBeCloseTo(attendu, 12);
    expect(OSWALD_MEDIUM_LINE_EM).toBeCloseTo((A - D + G) / MEDIUM.unitsPerEm, 12);
  });

  it('le modèle Android de ce test redonne au millième les lignes natives relevées sur l’émulateur', () => {
    for (const [fs, L, hauteur, ascendante, descendante] of RELEVES_ANDROID) {
      const l = ligne(fs, L, { os: 'android', d: 420 / 160 });
      expect([fs, L, +l.hauteur.toFixed(3), +l.base.toFixed(3), +(l.hauteur - l.base).toFixed(3)]).toEqual([fs, L, hauteur, ascendante, descendante]);
    }
  });

  const plateformes: Plateforme[] = [
    { os: 'ios', d: 2 }, { os: 'ios', d: 3 },
    { os: 'android', d: 420 / 160 }, { os: 'android', d: 2.75 }, { os: 'android', d: 3 }, { os: 'android', d: 3.5 },
  ];
  const cas = [
    ['minuteur, portrait', false, PORTRAIT], ['minuteur, paysage', false, LANDSCAPE],
    ['enregistrement, portrait', true, PORTRAIT], ['enregistrement, paysage', true, LANDSCAPE],
  ] as const;
  it.each(cas)('%s : 10 puis 3, à 0,35 s, milieu du glyphe au milieu du cercle à un demi-pixel près, sur iOS et Android, à chaque densité', async (_, camera, w) => {
    const ecarts: Record<string, number[]> = {};
    for (const p of plateformes) {
      jest.replaceProperty(Platform, 'OS', p.os);
      jest.spyOn(PixelRatio, 'get').mockReturnValue(p.d);
      animationsObservables();
      const r = await run(params({ countdown: 10, withCamera: camera }), darkTheme, w);
      if (camera) { await camPress(r); await camPress(r); } else await press(r, 'timer-start-stop');
      const cle = `${p.os} ×${p.d}`;
      ecarts[cle] = [];
      // Mesuré 0,35 s après l'apparition de chaque valeur (fin de l'entrée : échelle 1).
      for (const chiffre of ['10', '3']) {
        await apparition(r, chiffre);
        await tick(CD_ANIM.enterMs / 1000);
        expect(hostText(one(r, 'timer-countdown-value'))).toBe(chiffre);
        const st = flat(one(r, 'timer-countdown-value'));
        // Ligne au moins aussi haute que la ligne native : rien n'est coupé, le modèle centré s'applique.
        expect(st.lineHeight as number).toBeGreaterThanOrEqual((st.fontSize as number) * OSWALD_MEDIUM_LINE_EM);
        ecarts[cle].push(ecartAuCentre(r, p));
      }
      await act(async () => renderer!.unmount()); renderer = null;
      jest.restoreAllMocks();
    }
    // Écart en pixels physiques : au plus un demi-pixel partout, donc iOS et Android au pixel près.
    const px = Object.fromEntries(plateformes.map((p) => [`${p.os} ×${p.d}`, ecarts[`${p.os} ×${p.d}`].map((e) => Math.abs(e * p.d) <= 0.5)]));
    expect(px).toEqual(Object.fromEntries(Object.keys(px).map((k) => [k, [true, true]])));
    // 6 rendus × 2 valeurs, par pas de 10 ms jusqu'à l'apparition : ~2 s en local, plus de 5 s sur la CI.
  }, 30000);
});

// ═════════════════════════════════════════════════════════════════════════════
// #547, PR 2 (retour du build 1.0.64, décision de Nab) : en paysage avec rounds, le cercle chevauchait
// les pastilles. Le décompte change d'apparence : anneau fin et fixe (36 % du côté court, plafonné en
// paysage par la zone libre entre le bandeau et les pastilles), chiffre au repos inscrit dans l'anneau,
// qui grossit puis s'efface à chaque seconde (Animated, pilote natif), immobile si « Réduire les animations ».
// Mesure du placement : la mise en page (bandeau, zone flex, pastilles, rangée du bas) est recalculée depuis
// les styles rendus, la zone mesurée est simulée (onLayout), puis le groupe « libellé, titre, anneau » est
// placé dans son conteneur réel (zone ou écran entier).
// ═════════════════════════════════════════════════════════════════════════════
/** Insets en paysage : iPhone à îlot (bords et barre d'accueil), Android à navigation par gestes. */
const INSETS_PAYSAGE = { ios: { top: 0, bottom: 21, left: 59, right: 59 }, android: { top: 0, bottom: 24, left: 0, right: 0 } } as const;
const MARGE_VISIBLE = 8;
/** Enfants hôtes directs (le plus proche ancêtre hôte est `n`). */
const enfantsHote = (n: ReactTestInstance) => n.findAll((x) => typeof x.type === 'string' && x !== n && hoteParent(x) === n);
const ancetre = (n: ReactTestInstance, id: string) => { for (let p = n.parent; p; p = p.parent) if (p.props.testID === id) return true; return false; };
const estBulle = (x: ReactTestInstance) => typeof flat(x).width === 'number' && flat(x).width === flat(x).height && flat(x).borderRadius !== undefined;
/** Mise en page en paysage sans caméra, en dp depuis le haut de l'écran. */
function paysage(r: ReactTestInstance, H: number) {
  const land = flat(one(r, 'timer-landscape'));
  const enTeteBas = (land.paddingTop as number) + Math.max(...enfantsHote(one(r, 'timer-controls')).map((x) => (flat(x).height as number) ?? 0));
  const rangee = one(r, 'timer-round-bubbles'), rs = flat(rangee);
  const bulles = enfantsHote(rangee).filter(estBulle);
  const hRangee = (flat(bulles[0]).height as number) + 2 * ((rs.paddingVertical as number) ?? 0);
  const pastillesHaut = H - (land.paddingBottom as number) - (flat(one(r, 'timer-bottom-row')).height as number) - hRangee;
  return { enTeteBas, pastillesHaut, rangee, bulles, land };
}
/** Groupe du décompte (libellé, titre, anneau) centré dans son conteneur réel. */
function groupe(r: ReactTestInstance, conteneur: { haut: number; bas: number }) {
  const g = one(r, 'timer-countdown');
  const enfants = enfantsHote(g);
  const h = (x: ReactTestInstance) => (flat(x).height as number) ?? (flat(x).lineHeight as number);
  const total = enfants.reduce((s, x) => s + h(x), 0) + ((flat(g).gap as number) ?? 0) * (enfants.length - 1);
  const haut = conteneur.haut + (conteneur.bas - conteneur.haut - total) / 2;
  const d = flat(one(r, 'timer-countdown-ring')).height as number;
  return { haut, anneauHaut: haut + total - d, anneauBas: haut + total, d };
}
async function mesurerZone(r: ReactTestInstance, w: number, h: number) {
  const box = r.findAll((n) => n.props.testID === 'timer-chrono-box' && typeof n.props.onLayout === 'function')[0];
  await act(async () => { box.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: w, height: h } } }); });
}
async function emomPaysage(os: 'ios' | 'android', ecran: typeof LANDSCAPE, rounds: number) {
  jest.replaceProperty(Platform, 'OS', os);
  mockInsets = INSETS_PAYSAGE[os];
  const r = await run(params({ timerType: 'emom', rounds, interval: 60, countdown: 10 }), darkTheme, ecran);
  await press(r, 'timer-start-stop');
  const p = paysage(r, ecran.height);
  await mesurerZone(r, ecran.width - 32, p.pastillesHaut - p.enTeteBas);
  return { r, p };
}
/** Vérité du fichier : chasse d'une valeur (somme des chasses, sans crénage, qui ne fait que resserrer) et hauteur des chiffres, en em. */
const chasseEm = (v: string) => [...v].reduce((s, c) => s + MEDIUM.glyphe(c).chasse, 0) / MEDIUM.unitsPerEm;
const HAUTEUR_CHIFFRES_EM = (() => { const g = [...'0123456789'].map((c) => MEDIUM.glyphe(c)); return (Math.max(...g.map((x) => x.yMax)) - Math.min(...g.map((x) => x.yMin))) / MEDIUM.unitsPerEm; })();
const ECRAN_360 = { width: 800, height: 360, scale: 3, fontScale: 1 };

describe('#547 PR 2 : en paysage avec pastilles, l’anneau tient entre le bandeau et les pastilles', () => {
  const ecrans = [['844 × 390', LANDSCAPE], ['800 × 360', ECRAN_360]] as const;
  for (const os of ['ios', 'android'] as const) for (const [nomEcran, ecran] of ecrans) for (const rounds of [10, 20, 30]) {
    it(`${os}, ${nomEcran}, EMOM ${rounds} : libellé et anneau entre le bas du bandeau et le haut des pastilles, marges visibles, rangée dans la largeur`, async () => {
      const { r, p } = await emomPaysage(os, ecran, rounds);
      const overlay = one(r, 'timer-cd-overlay');
      const conteneur = ancetre(overlay, 'timer-main-landscape') ? { haut: p.enTeteBas, bas: p.pastillesHaut } : { haut: 0, bas: ecran.height };
      const g = groupe(r, conteneur);
      expect({ sousLeBandeau: g.haut >= p.enTeteBas + MARGE_VISIBLE, auDessusDesPastilles: g.anneauBas <= p.pastillesHaut - MARGE_VISIBLE })
        .toEqual({ sousLeBandeau: true, auDessusDesPastilles: true });
      // 36 % du côté court, sauf si la zone libre impose moins.
      expect(g.d).toBeLessThanOrEqual(Math.round(ecran.height * 0.36));
      // Rangée : 10 pastilles au plus, plus « … », dans la largeur laissée par les côtés (« … » compté 13 dp).
      const rs = flat(p.rangee);
      const points = p.rangee.findAll((x) => String(x.type) === 'Text' && hostText(x) === '…').length;
      const nb = p.bulles.length + points;
      const largeur = p.bulles.length * (flat(p.bulles[0]).width as number) + points * 13 + (nb - 1) * (rs.gap as number) + 2 * (rs.paddingHorizontal as number);
      expect(p.bulles.length).toBe(10);
      expect(largeur).toBeLessThanOrEqual(ecran.width - (p.land.paddingLeft as number) - (p.land.paddingRight as number));
    });
  }
});

describe('#547 PR 2 : anneau, chiffre au repos et animation du décompte', () => {
  it.each([
    ['minuteur, portrait', false, PORTRAIT], ['enregistrement, portrait', true, PORTRAIT],
    ['minuteur, paysage sans rounds', false, LANDSCAPE], ['enregistrement, paysage', true, LANDSCAPE],
  ] as const)('%s : anneau de 36 % du côté court de l’écran, libellé au-dessus avec un écart', async (_, camera, w) => {
    const r = await run(params({ countdown: 10, withCamera: camera }), darkTheme, w);
    if (camera) { await camPress(r); await camPress(r); } else await press(r, 'timer-start-stop');
    const a = flat(one(r, 'timer-countdown-ring'));
    expect([a.width, a.height]).toEqual([Math.round(Math.min(w.width, w.height) * 0.36), Math.round(Math.min(w.width, w.height) * 0.36)]);
    const g = one(r, 'timer-countdown');
    const enfants = enfantsHote(g);
    expect(enfants[0].props.testID).toBe('timer-countdown-label');
    expect(enfants[enfants.length - 1].props.testID).toBe('timer-countdown-ring');
    expect(flat(g).gap as number).toBeGreaterThanOrEqual(4);
  });

  it.each([10, 15, 30, 9])('décompte de %i s : encre au repos de chaque valeur dans l’anneau intérieur moins 6 dp, la plus large au contact', async (duree) => {
    const r = await run(params({ countdown: duree }), darkTheme, PORTRAIT);
    await press(r, 'timer-start-stop');
    const a = flat(one(r, 'timer-countdown-ring'));
    const rayon = ((a.width as number) - 2 * (a.borderWidth as number)) / 2 - 6;
    const fs = flat(one(r, 'timer-countdown-value')).fontSize as number;
    const coins = Array.from({ length: duree }, (_, i) => String(i + 1)).map((v) => Math.hypot((chasseEm(v) * fs) / 2, (HAUTEUR_CHIFFRES_EM * fs) / 2));
    expect(Math.max(...coins)).toBeLessThanOrEqual(rayon);
    expect(Math.max(...coins)).toBeGreaterThan(rayon - 1.5);
  });

  it('animation relancée à chaque valeur : 0,55 et invisible à l’apparition, échelle 1 et opaque à 0,35 s, pointe à 65 % du côté court et opacité nulle en fin de seconde ; pilote natif', async () => {
    const releves = animationsObservables();
    const r = await run(params({ countdown: 10 }), darkTheme, PORTRAIT);
    await press(r, 'timer-start-stop');
    const z = () => one(r, 'timer-countdown-zoom');
    const fs = flat(one(r, 'timer-countdown-value')).fontSize as number;
    const pointe = (0.65 * Math.min(PORTRAIT.width, PORTRAIT.height)) / (fs * HAUTEUR_CHIFFRES_EM);
    for (const chiffre of ['10', '9', '3']) {
      await apparition(r, chiffre);
      expect([chiffre, echelle(z()), opacite(z())]).toEqual([chiffre, 0.55, 0]);
      await tick(0.08);
      expect(opacite(z())).toBeCloseTo(1, 3);
      await tick(0.27);
      expect(echelle(z())).toBeCloseTo(1, 3);
      expect(opacite(z())).toBeCloseTo(1, 3);
      await tick(0.6);
      expect(echelle(z())).toBeCloseTo(pointe, 3);
      expect(echelle(z()) * fs * HAUTEUR_CHIFFRES_EM).toBeLessThanOrEqual(0.65 * PORTRAIT.width + 0.01);
      expect(opacite(z())).toBeCloseTo(0, 6);
      await tick(0.04);
      expect(opacite(z())).toBeCloseTo(0, 6);
    }
    expect(releves.length).toBeGreaterThanOrEqual(12);
    expect(releves.every((c) => c.useNativeDriver === true)).toBe(true);
  });

  it('couche du zoom sans toucher, centrée sur l’anneau (remplit son intérieur), sans découpe par l’anneau', async () => {
    const r = await run(params({ countdown: 10 }), darkTheme, PORTRAIT);
    await press(r, 'timer-start-stop');
    const z = one(r, 'timer-countdown-zoom');
    expect(z.props.pointerEvents).toBe('none');
    expect(hoteParent(z) === one(r, 'timer-countdown-ring')).toBe(true);
    expect(flat(z)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' });
    for (const k of ['margin', 'marginTop', 'marginLeft', 'padding', 'width', 'height'] as const) expect(flat(z)[k]).toBeUndefined();
    expect(flat(one(r, 'timer-countdown-ring')).overflow).not.toBe('hidden');
    expect(one(r, 'timer-cd-overlay').props.pointerEvents).toBe('none');
  });

  it('« Réduire les animations » : chiffre fixe dans l’anneau, sans échelle ni fondu, qui change simplement de valeur', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const r = await run(params({ countdown: 10 }), darkTheme, PORTRAIT);
    await press(r, 'timer-start-stop');
    for (const chiffre of ['10', '9']) {
      await apparition(r, chiffre);
      await tick(0.5);
      const z = flat(one(r, 'timer-countdown-zoom'));
      expect([chiffre, z.transform, z.opacity]).toEqual([chiffre, undefined, undefined]);
    }
    expect(timing).not.toHaveBeenCalled();
  });
});
