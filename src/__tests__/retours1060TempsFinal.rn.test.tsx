/**
 * Retours du build 1.0.60, D2 : le bouton Fermer du temps final sortait de l'écran
 * (avec caméra sur iPhone, en paysage) ou passait sous la barre d'accueil.
 * Décision de Nab : l'écran ne défile pas, tout tient dans la zone sûre ;
 * Recommencer et Fermer deviennent deux actions rondes en verre de 56 px.
 * (Banc repris de retoursIphoneTimer.rn.test.tsx.)
 */
import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import type { HomeStackParamList } from '../navigation';
import TimerRunScreen, { FINAL_DIGITS_MIN } from '../screens/timer/TimerRunScreen';
import { ensureContrast } from '../theme/ink';
import { contrast } from '../theme/contrast';
import { AxTag } from '../components/ax';

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


// ═════════════════════════════════════════════════════════════════════════════
// Retours du build 1.0.60, D2 : temps final sans défilement, dans la zone sûre.
// ═════════════════════════════════════════════════════════════════════════════
const SE = { width: 375, height: 667, scale: 2, fontScale: 1 };
const SE_PAYSAGE = { width: 667, height: 375, scale: 2, fontScale: 1 };
const ILOT_PAYSAGE = { top: 0, bottom: 21, left: 59, right: 59 };

async function tempsFinal(w: typeof PORTRAIT, theme = lightTheme, camera = false) {
  const r = await run(params({ withCamera: camera }), theme, w);
  if (camera) {
    await camPress(r); // Démarrer l'enregistrement
    await camPress(r); // Lancer le chrono
    await tick(3);
    await camPress(r); // Arrêter le chrono
    await camPress(r); // Arrêter la vidéo
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
  } else {
    await press(r, 'timer-start-stop'); await tick(3); await press(r, 'timer-start-stop');
  }
  return r;
}
/** L'élément composite ActionRonde (premier porteur du testID). */
const action = (r: ReactTestInstance, id: string) => r.findAll((n) => n.props.testID === id)[0];
const appuyable = (r: ReactTestInstance, id: string) =>
  r.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button');

describe('D2 : Recommencer et Fermer en actions rondes', () => {
  for (const [nom, w, camera] of [
    ['portrait sans caméra', PORTRAIT, false], ['iPhone SE sans caméra', SE, false],
    ['portrait avec caméra', PORTRAIT, true], ['iPhone SE avec caméra', SE, true],
  ] as const) {
    it(`${nom} : deux boutons ronds de 56 px côte à côte, libellés d'accessibilité et libellés courts visibles`, async () => {
      const r = await tempsFinal(w, darkTheme, camera);
      for (const [id, libelle] of [['timer-reset', 'Recommencer'], ['timer-close', 'Fermer']] as const) {
        const btn = appuyable(r, id);
        expect(btn).toHaveLength(1);
        expect(btn[0].props.accessibilityLabel).toBe(libelle);
        expect(flat(btn[0])).toMatchObject({ minWidth: 44, minHeight: 44 });
        expect(flat(one(r, `${id}-cercle`))).toMatchObject({ width: 56, height: 56, borderRadius: 28 });
        expect(hostText(one(r, `${id}-libelle`))).toBe(libelle);
      }
      expect(flat(one(r, 'timer-final-actions')).flexDirection).toBe('row');
      expect(action(r, 'timer-close').props.tone).toBe('stop');
      expect(action(r, 'timer-reset').props.tone).toBe('neutral');
    });
  }

  it('Recommencer remet le chrono prêt, Fermer revient en arrière', async () => {
    const r = await tempsFinal(PORTRAIT);
    await press(r, 'timer-reset');
    expect(r.findAll((n) => n.props.testID === 'timer-final')).toHaveLength(0);
    if (renderer) { const x = renderer; await act(async () => x.unmount()); renderer = null; }
    const r2 = await tempsFinal(PORTRAIT);
    await press(r2, 'timer-close');
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('Fermer prend la couleur arrêt / danger, lisible sur les deux palettes', async () => {
    for (const theme of [darkTheme, lightTheme]) {
      const r = await tempsFinal(PORTRAIT, theme);
      const cercle = flat(one(r, 'timer-close-cercle'));
      const fond = theme === darkTheme ? '#1C2023' : '#B5EEDF';
      expect(cercle.borderColor).toBe(ensureContrast(theme.ax.danger, fond));
      expect(contrast(cercle.borderColor as string, fond)).toBeGreaterThanOrEqual(3);
      if (renderer) { const x = renderer; await act(async () => x.unmount()); renderer = null; }
    }
  });
});

describe('D2 : paysage, informations à gauche, boutons empilés à droite', () => {
  for (const [nom, w, camera] of [
    ['paysage sans caméra', LANDSCAPE, false], ['iPhone SE paysage sans caméra', SE_PAYSAGE, false],
    ['paysage avec caméra', LANDSCAPE, true], ['iPhone SE paysage avec caméra', SE_PAYSAGE, true],
  ] as const) {
    it(`${nom} : rangée info puis actions, actions en colonne, icônes seules`, async () => {
      const r = await tempsFinal(w, darkTheme, camera);
      const rangee = one(r, 'timer-final-row');
      expect(flat(rangee).flexDirection).toBe('row');
      const enfants = rangee.children as ReactTestInstance[];
      expect(enfants[0].props.testID).toBe('timer-final-info');
      const derniere = enfants[enfants.length - 1];
      expect(isAncestor(derniere, one(r, 'timer-final-actions'))).toBe(true);
      expect(flat(one(r, 'timer-final-actions')).flexDirection).toBe('column');
      for (const [id, libelle] of [['timer-reset', 'Recommencer'], ['timer-close', 'Fermer']] as const) {
        expect(appuyable(r, id)[0].props.accessibilityLabel).toBe(libelle);
        expect(r.findAll((n) => n.props.testID === `${id}-libelle`)).toHaveLength(0);
      }
    });
  }
});

describe('D2 : aucun défilement, zone sûre, badge centré, chiffre ajusté', () => {
  for (const [nom, w, camera] of [
    ['portrait', PORTRAIT, false], ['paysage', LANDSCAPE, false], ['portrait caméra', PORTRAIT, true], ['paysage caméra', LANDSCAPE, true],
  ] as const) {
    it(`${nom} : aucune ScrollView sur le temps final`, async () => {
      const r = await tempsFinal(w, lightTheme, camera);
      expect(one(r, 'timer-final').findAllByType(ScrollView)).toHaveLength(0);
    });
  }

  it('portrait : marges de la zone sûre en bas et sur les côtés (îlot, barre d’accueil)', async () => {
    mockInsets = ISLAND;
    const r = await tempsFinal(PORTRAIT);
    expect(flat(one(r, 'timer-final-column'))).toMatchObject({ paddingBottom: ISLAND.bottom + 12, paddingLeft: 24, paddingRight: 24 });
  });

  it('paysage : marges de l’encoche à gauche et à droite, barre d’accueil en bas', async () => {
    mockInsets = ILOT_PAYSAGE;
    const r = await tempsFinal(LANDSCAPE);
    expect(flat(one(r, 'timer-final-row'))).toMatchObject({ paddingLeft: 59 + 16, paddingRight: 59 + 16, paddingBottom: 21 + 8 });
  });

  it('caméra : le haut du temps final suit la zone sûre (plus d’écart fixe de 40 px)', async () => {
    mockInsets = ISLAND;
    const r = await tempsFinal(PORTRAIT, darkTheme, true);
    expect(flat(one(r, 'timer-overlay')).paddingTop).toBe(ISLAND.top + 8);
  });

  it.each([['portrait', PORTRAIT, false], ['paysage', LANDSCAPE, false], ['portrait caméra', PORTRAIT, true], ['paysage caméra', LANDSCAPE, true]] as const)(
    'badge du format (%s) : son parent direct est une vue qui épouse sa taille et se centre elle-même', async (_, w, camera) => {
      const r = await tempsFinal(w, darkTheme, camera);
      // AxTag pose alignSelf: 'flex-start' : un parent étiré, même en alignItems: 'center', le laisse à gauche.
      const tag = r.findAllByType(AxTag).find((n) => n.props.testID === 'timer-final-tag')!;
      expect(flat(r.findAll((n) => n.props.testID === 'timer-final-tag' && typeof n.type === 'string')[0]).alignSelf).toBe('flex-start');
      let parent = tag.parent;
      while (parent && typeof parent.type !== 'string') parent = parent.parent;
      expect(parent!.props.testID).toBe('timer-final-tag-wrap');
      const st = flat(parent!);
      expect(st.alignSelf).toBe('center');
      for (const k of ['width', 'minWidth', 'flex', 'flexGrow'] as const) expect(st[k]).toBeUndefined();
    });

  it('grand chiffre : taille tirée de la place disponible, jamais sous le plancher de 44', async () => {
    const r = await tempsFinal(SE_PAYSAGE);
    const boite = one(r, 'timer-final-digits-box');
    const taille = () => flat(r.findAll((n) => n.props.testID === 'timer-final-time' && typeof n.type === 'string')[0]).fontSize;
    await act(async () => { boite.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 120 } } }); });
    expect(taille()).toBe(100); // 120 / 1,2
    await act(async () => { boite.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 30 } } }); });
    expect(taille()).toBe(FINAL_DIGITS_MIN);
    await act(async () => { boite.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 130, height: 300 } } }); });
    expect(taille()).toBe(50); // 130 / 2,6
    expect(FINAL_DIGITS_MIN).toBe(44);
  });
});
