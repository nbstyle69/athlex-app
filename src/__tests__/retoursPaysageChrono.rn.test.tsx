/**
 * Retours du build 1.0.61, R3 : en paysage, le chrono était environ trois fois trop petit et
 * « Appuie pour démarrer » passait sur trois lignes. Maquette suivie : « Minuteur · Paysage A »
 * (page Minuteur 98:500, option A 102:1694, reprise en 173:4838 / 173:4858 sur le prototype).
 * La taille du chrono part de la boîte réellement mesurée (onLayout) ; ces tests simulent la
 * mesure et vérifient l'encre des chiffres avec les chasses réelles d'Oswald Bold.
 * (Banc repris de retours1060TempsFinal.rn.test.tsx.)
 */
import React from 'react';
import { Dimensions, StyleSheet, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import type { HomeStackParamList } from '../navigation';
import TimerRunScreen, { CAM_BAR_ROOM, CHRONO_FILL, CHRONO_INK_EM, LANDSCAPE_PLAY } from '../screens/timer/TimerRunScreen';
import { DISPLAY_OPTS_KEY } from '../lib/timerVideoOpts';
import { axFonts } from '../theme/axTokens';

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

/** Largeur d'écran lue par le module au chargement (taille de chiffres par défaut en portrait). */
const SW_CHARGEMENT = Dimensions.get('window').width;
const PORTRAIT = { width: 390, height: 844, scale: 3, fontScale: 1 };
const LANDSCAPE = { width: 844, height: 390, scale: 3, fontScale: 1 };
/** iPhone 15 en paysage : îlot d'un côté, bords arrondis des deux, barre d'accueil en bas. */
const ILOT_PAYSAGE = { top: 0, bottom: 21, left: 59, right: 59 };
function setWindow(w: typeof PORTRAIT) { act(() => { Dimensions.set({ window: w, screen: w }); }); }

/**
 * Vérité indépendante du code : chasse et hauteur d'encre d'Oswald Bold, relevées dans Chrome
 * (canvas measureText à 1000 px, fichier @expo-google-fonts/oswald/700Bold).
 */
const CHASSE_BOLD: Record<string, number> = {
  0: 0.55, 1: 0.385, 2: 0.514, 3: 0.514, 4: 0.524, 5: 0.509, 6: 0.538, 7: 0.439, 8: 0.521, 9: 0.538, ':': 0.278,
};
const ENCRE_BOLD = 0.828 + 0.016;
const largeurEncre = (t: string, fs: number) => [...t].reduce((s, c) => s + CHASSE_BOLD[c] * fs, 0);

let renderer: TestRenderer.ReactTestRenderer | null = null;
let vib: jest.SpyInstance;
beforeEach(async () => {
  jest.useFakeTimers(); setWindow(PORTRAIT); mockInsets = ILOT_PAYSAGE; await AsyncStorage.clear();
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
  timerType: 'for-time', countdown: 0, totalSeconds: 0, maxTime: 1080, interval: 1, rounds: 1, workTime: 0, restTime: 0,
  withCamera: false, videoTitle: '', withTimestamp: false, sequence: '[]', ...p,
});
async function run(p: HomeStackParamList['TimerRun'], theme = darkTheme, w = LANDSCAPE, style?: 'arc' | 'bar' | 'digits') {
  if (style) await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ clockStyle: style, followAppTheme: true }));
  setWindow(w);
  mockTheme = theme; mockParams = p;
  await act(async () => { renderer = TestRenderer.create(<TimerRunScreen />); });
  for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); });
  return renderer!.root;
}
/** Simule la mesure de la boîte du chrono (ce que fait onLayout sur l'appareil). */
async function mesurer(root: ReactTestInstance, w: number, h: number) {
  const box = root.findAll((n) => n.props.testID === 'timer-chrono-box' && typeof n.props.onLayout === 'function')[0];
  if (!box) throw new Error('boîte du chrono absente');
  await act(async () => { box.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: w, height: h } } }); });
}
const chrono = (root: ReactTestInstance, id = 'timer-main-time') => one(root, id);

/** Boîtes mesurées sur le banc web (844 × 390, îlot) et deux cas limites. */
const BOITES = [
  ['iPhone 15, au repos', 726, 243],
  ['iPhone SE (667 × 375), sans îlot', 635, 228],
  ['écran étroit : la largeur limite', 300, 243],
  ['écran bas : la hauteur limite', 726, 120],
] as const;

describe('R3 : chrono en paysage sans caméra, taille mesurée', () => {
  it.each([['sombre', darkTheme], ['clair', lightTheme]] as const)(
    'thème %s : les chiffres occupent presque toute la hauteur mesurée (au repos puis en cours)', async (_, th) => {
      const r = await run(params(), th);
      await mesurer(r, 726, 243);
      const repos = flat(chrono(r));
      expect(repos.fontFamily).toBe(axFonts.oswaldBold);
      const encre = (fs: number) => fs * ENCRE_BOLD;
      // Avant R3 : 226 px fixes, réduits par adjustsFontSizeToFit sur l'appareil. Ici : 259 px, encre de 219 px sur 243.
      expect(encre(repos.fontSize as number)).toBeGreaterThanOrEqual(0.85 * 243);
      expect(encre(repos.fontSize as number)).toBeLessThanOrEqual(243);
      await press(r, 'timer-start-stop'); await tick(3);
      expect(hostText(chrono(r))).toBe('00:03');
      expect(flat(chrono(r)).fontSize).toBe(repos.fontSize); // la taille ne saute pas quand les secondes défilent
    });

  it.each(BOITES)('%s : aucun débordement, ni en largeur ni en hauteur', async (_, w, h) => {
    const r = await run(params());
    await mesurer(r, w, h);
    const fs = flat(chrono(r)).fontSize as number;
    expect(hostText(chrono(r))).toBe('00:00');
    // « 00:00 » est le temps le plus large (le 0 a la plus grande chasse) : s'il tient, tout tient.
    expect(largeurEncre('00:00', fs)).toBeLessThanOrEqual(w);
    expect(fs * ENCRE_BOLD).toBeLessThanOrEqual(h * CHRONO_FILL + 0.5);
  });

  it('la taille suit la boîte : plus de place, plus grand ; moins de place, plus petit', async () => {
    const r = await run(params());
    await mesurer(r, 726, 243);
    const grand = flat(chrono(r)).fontSize as number;
    await mesurer(r, 726, 160);
    const petit = flat(chrono(r)).fontSize as number;
    expect(petit).toBeLessThan(grand);
    expect(petit * CHRONO_INK_EM).toBeLessThanOrEqual(160);
  });

  it('le texte ne capte pas les appuis (les boutons restent touchables sous la ligne du chrono)', async () => {
    const r = await run(params());
    const box = one(r, 'timer-chrono-box');
    const calque = box.findAll((n) => typeof n.type === 'string' && n.props.pointerEvents === 'none');
    expect(calque.length).toBeGreaterThan(0);
    expect(flat(chrono(r))).toMatchObject({ flexShrink: 0, includeFontPadding: false });
  });
});

describe('R3 : bandeau, rangée du bas et zones sûres (maquette Paysage A)', () => {
  it('« Appuie pour démarrer » sur une ligne, à gauche du bouton Lecture, dans la même rangée', async () => {
    const r = await run(params());
    const hint = one(r, 'timer-ready-hint');
    expect(hostText(hint)).toBe('Appuie pour démarrer');
    expect(hint.props.numberOfLines).toBe(1);
    const rangee = one(r, 'timer-bottom-row');
    expect(flat(rangee)).toMatchObject({ flexDirection: 'row', height: LANDSCAPE_PLAY });
    const ordre = rangee.findAll((n) => typeof n.type === 'string' && (n.props.testID === 'timer-ready-hint' || n.props.testID === 'timer-start-stop'))
      .map((n) => n.props.testID);
    expect(ordre).toEqual(['timer-ready-hint', 'timer-start-stop']);
    // Maquette 173:4855 : bouton de 56 px (70 avant R3).
    expect(flat(one(r, 'timer-start-stop'))).toMatchObject({ width: 56, height: 56, borderRadius: 28 });
    expect(rangee.findAll((n) => n.props.testID === 'timer-progress' && typeof n.type === 'string')).toHaveLength(1);
    await press(r, 'timer-start-stop');
    expect(host(r, 'timer-ready-hint')).toHaveLength(0);
  });

  it('bandeau : type, « BLOC 1/1 · CAP 18:00 », pas de petit chrono qui répète le grand', async () => {
    const r = await run(params());
    expect(hostText(one(r, 'timer-landscape-info'))).toBe('BLOC 1/1 · CAP 18:00');
    expect(host(r, 'timer-total')).toHaveLength(0);
    await press(r, 'timer-start-stop'); await tick(2);
    expect(host(r, 'timer-total')).toHaveLength(0);
  });

  it('AMRAP : le temps écoulé reste affiché, il ne répète pas le compte à rebours', async () => {
    const r = await run(params({ timerType: 'amrap', totalSeconds: 600, maxTime: 0 }));
    await press(r, 'timer-start-stop'); await tick(3);
    expect(hostText(one(r, 'timer-total'))).toBe('00:03');
    expect(hostText(chrono(r))).toBe('09:57');
    expect(host(r, 'timer-landscape-info')).toHaveLength(0);
  });

  it('sans caméra : marges de la zone sûre (îlot, bords, barre d’accueil)', async () => {
    const r = await run(params());
    const page = flat(one(r, 'timer-landscape'));
    expect(page.paddingLeft).toBeGreaterThanOrEqual(ILOT_PAYSAGE.left);
    expect(page.paddingRight).toBeGreaterThanOrEqual(ILOT_PAYSAGE.right);
    expect(page.paddingBottom).toBeGreaterThanOrEqual(ILOT_PAYSAGE.bottom);
  });

  it('avec caméra : barre du haut et bouton hors de l’îlot et de la barre d’accueil', async () => {
    const r = await run(params({ withCamera: true }));
    const barre = flat(one(r, 'timer-cam-topbar'));
    expect(barre.paddingLeft).toBeGreaterThanOrEqual(ILOT_PAYSAGE.left);
    expect(barre.paddingRight).toBeGreaterThanOrEqual(ILOT_PAYSAGE.right);
    const couche = flat(one(r, 'timer-overlay'));
    const zone = flat(one(r, 'timer-cam-landscape'));
    expect(zone.paddingLeft).toBe(ILOT_PAYSAGE.left);
    expect((couche.paddingVertical as number) + (zone.paddingBottom as number)).toBeGreaterThanOrEqual(ILOT_PAYSAGE.bottom);
  });
});

describe('R3 : chrono en paysage avec caméra, taille mesurée', () => {
  it('style Barre (par défaut) : barre + chiffres tiennent dans la boîte, chiffres en grand', async () => {
    const r = await run(params({ withCamera: true }));
    await mesurer(r, 726, 280);
    const fs = flat(chrono(r, 'timer-cam-time')).fontSize as number;
    expect(fs * ENCRE_BOLD + CAM_BAR_ROOM).toBeLessThanOrEqual(280);
    expect(fs * ENCRE_BOLD).toBeGreaterThanOrEqual(0.85 * (280 - CAM_BAR_ROOM));
    expect(largeurEncre('00:00', fs)).toBeLessThanOrEqual(726);
  });

  it('style Digits : les chiffres prennent la boîte, sans déborder', async () => {
    const r = await run(params({ withCamera: true }), darkTheme, LANDSCAPE, 'digits');
    await mesurer(r, 726, 280);
    const fs = flat(chrono(r, 'timer-cam-time')).fontSize as number;
    expect(fs * ENCRE_BOLD).toBeLessThanOrEqual(280);
    expect(fs * ENCRE_BOLD).toBeGreaterThanOrEqual(0.85 * 280);
  });

  it('style Cercle : le cadran tient dans la boîte (il en prend le plus petit côté)', async () => {
    const r = await run(params({ withCamera: true }), darkTheme, LANDSCAPE, 'arc');
    await mesurer(r, 726, 250);
    const cadrans = one(r, 'timer-chrono-box').findAll((n) => typeof n.type === 'string'
      && typeof flat(n).width === 'number' && flat(n).width === flat(n).height);
    expect(cadrans.map((n) => flat(n).width)).toEqual([250]);
  });
});

describe('R3 : le portrait ne change pas', () => {
  it('sans caméra : chiffres Oswald Medium à la taille réglée, sans calcul de boîte', async () => {
    const r = await run(params(), darkTheme, PORTRAIT);
    expect(host(r, 'timer-chrono-box')).toHaveLength(0);
    const st = flat(chrono(r));
    expect(st).toMatchObject({ fontFamily: axFonts.oswaldMedium, fontSize: Math.round(SW_CHARGEMENT * 0.22), letterSpacing: -2 });
    expect(st.transform).toBeUndefined();
  });

  it.each(['bar', 'digits'] as const)('avec caméra, style %s : chiffres à la taille réglée, retour à la ligne permis comme avant', async (style) => {
    const r = await run(params({ withCamera: true }), darkTheme, PORTRAIT, style);
    const t = chrono(r, 'timer-cam-time');
    expect(t.props.numberOfLines).toBeUndefined();
    expect(flat(t)).toMatchObject({ fontFamily: axFonts.oswaldMedium, fontSize: Math.round(SW_CHARGEMENT * 0.22) });
    expect(flat(t).transform).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Relecture de #479 : sur le temps final (D2) en paysage, Fermer passait sous l'îlot
// (12 px du bord sans caméra, 24 px avec). Fermer et Réglages prennent la zone sûre et
// la position du chrono en paysage : ils ne sautent plus d'un écran à l'autre.
// ═════════════════════════════════════════════════════════════════════════════
/** Coin haut gauche de la croix, déduit des marges réellement posées (pas de moteur de mise en page ici). */
function croixChrono(r: ReactTestInstance, camera: boolean) {
  if (camera) return { x: flat(one(r, 'timer-cam-topbar')).paddingLeft as number, y: flat(one(r, 'timer-overlay')).paddingTop as number };
  const page = flat(one(r, 'timer-landscape'));
  return { x: page.paddingLeft as number, y: page.paddingTop as number };
}
function croixFinal(r: ReactTestInstance, camera: boolean) {
  if (camera) return { x: flat(one(r, 'timer-cam-topbar')).paddingLeft as number, y: flat(one(r, 'timer-overlay')).paddingTop as number };
  const rangee = flat(one(r, 'timer-final-controls'));
  return { x: rangee.paddingLeft as number, y: rangee.paddingTop as number };
}
async function versFinal(r: ReactTestInstance, camera: boolean) {
  const cam = async () => { await act(async () => { r.findByProps({ testID: 'timer-cam-primary' }).props.onPress(); }); };
  if (camera) { await cam(); await cam(); await tick(3); await cam(); await cam(); }
  else { await press(r, 'timer-start-stop'); await tick(3); await press(r, 'timer-start-stop'); }
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
  expect(host(r, 'timer-final')).toHaveLength(1);
}

describe('R3 (relecture) : temps final en paysage, Fermer et Réglages dans la zone sûre', () => {
  for (const camera of [false, true]) for (const [nomTheme, th] of [['sombre', darkTheme], ['clair', lightTheme]] as const) {
    it(`${camera ? 'avec' : 'sans'} caméra, thème ${nomTheme} : Fermer hors de l’îlot, à la place qu’il avait sur le chrono`, async () => {
      const r = await run(params({ withCamera: camera }), th);
      const avant = croixChrono(r, camera);
      await versFinal(r, camera);
      const croix = host(r, camera ? 'timer-cam-close' : 'timer-ctrl-close');
      expect(croix.length).toBeGreaterThan(0);
      const apres = croixFinal(r, camera);
      // Entièrement hors de la bande non sûre de gauche (0 → inset) et sous le haut de la zone sûre.
      expect(apres.x).toBeGreaterThanOrEqual(ILOT_PAYSAGE.left);
      expect(apres.y).toBeGreaterThanOrEqual(ILOT_PAYSAGE.top);
      expect(apres).toEqual(avant);
      if (!camera) {
        // Réglages : même marge à droite que sur le chrono.
        expect(flat(one(r, 'timer-final-controls')).paddingRight).toBeGreaterThanOrEqual(ILOT_PAYSAGE.right);
      }
    });
  }
});
