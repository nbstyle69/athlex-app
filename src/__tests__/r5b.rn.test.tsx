import React from 'react';
import { Dimensions, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import { lightTheme, darkTheme } from '../theme/palette';
import { contrast } from '../theme/contrast';
import { TIMER_THEMES } from '../theme/timerInk';
import type { HomeStackParamList, SeqBlock } from '../navigation';
import TimerRunScreen from '../screens/timer/TimerRunScreen';
import { AxSwitch, AxTag } from '../components/ax';
import { Play, Settings } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Vibration } from 'react-native';
import { ensureContrast } from '../theme/timerInk';

const mockNavigate = jest.fn();
let mockTheme = lightTheme;
let mockParams: HomeStackParamList['TimerRun'];
const mockNavigation = { navigate: mockNavigate, getParent: () => undefined, addListener: () => () => {}, goBack: jest.fn(), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
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
jest.mock('expo-media-library', () => ({ usePermissions: () => [{ granted: true }, jest.fn()] }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '', EncodingType: { Base64: 'base64' }, writeAsStringAsync: jest.fn(async () => {}),
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
  OrientationLock: { PORTRAIT_UP: 0, ALL: 1, LANDSCAPE: 2 },
  lockAsync: jest.fn(async () => {}), unlockAsync: jest.fn(async () => {}),
}));
jest.mock('realtime-recorder', () => ({ RealtimeRecorderView: 'Recorder' }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-view-shot', () => 'ViewShot');

let renderer: TestRenderer.ReactTestRenderer | null = null;
const PORTRAIT = { width: 390, height: 844, scale: 3, fontScale: 1 };
const LANDSCAPE = { width: 844, height: 390, scale: 3, fontScale: 1 };
function setWindow(w: typeof PORTRAIT) {
  act(() => { Dimensions.set({ window: w, screen: w }); });
}

beforeEach(async () => { jest.useFakeTimers(); setWindow(PORTRAIT); await AsyncStorage.clear(); });
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.useRealTimers();
  jest.clearAllMocks();
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
function textsOf(n: ReactTestInstance, out: string[]) {
  if (isHostText(n)) {
    const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
    out.push(upper ? hostText(n).toUpperCase() : hostText(n));
    return;
  }
  n.children.forEach((ch) => { if (typeof ch !== 'string') textsOf(ch, out); });
}
function structure(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance) => {
    if (n.type === Modal) return;
    if (isHostText(n)) { textsOf(n, out); return; }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch); });
  };
  walk(root);
  for (const m of root.findAllByType(Modal).filter((x) => x.props.visible !== false)) {
    out.push('── fenêtre ──');
    textsOf(m, out);
  }
  return out.filter((t) => t.trim().length > 0);
}
async function mount(el: React.ReactElement, theme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  return renderer!.root;
}
async function pressText(root: ReactTestInstance, text: string) {
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress(); });
}
async function pressID(root: ReactTestInstance, id: string) {
  const node = root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`absent : ${id}`);
  await act(async () => { node.props.onPress(); });
}
async function pressAround(node: ReactTestInstance) {
  let n: ReactTestInstance | null = node;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  const target = n!;
  await act(async () => { target.props.onPress(); });
}
/** Bouton lecture / arrêt : testID sur la disposition portrait, icône Play en paysage (master). */
async function startStop(root: ReactTestInstance) {
  const node = root.findAll((n) => n.props.testID === 'timer-start-stop' && typeof n.props.onPress === 'function')[0];
  if (node) { await act(async () => { node.props.onPress(); }); return; }
  await pressAround(root.findAllByType(Play)[0]);
}
async function tick(seconds: number) {
  await act(async () => { jest.advanceTimersByTime(seconds * 1000); });
}

const WOD_TITLE = 'Fran — un titre de séance particulièrement long pour vérifier la troncature';
const runParams = (p: Partial<HomeStackParamList['TimerRun']>): HomeStackParamList['TimerRun'] => ({
  timerType: 'for-time', countdown: 0, totalSeconds: 0, maxTime: 600, interval: 1, rounds: 1, workTime: 0, restTime: 0,
  withCamera: false, videoTitle: WOD_TITLE, withTimestamp: false, sequence: '[]', ...p,
});

const run = async (p: HomeStackParamList['TimerRun'], theme = lightTheme) => {
  mockParams = p;
  const root = await mount(<TimerRunScreen />, theme);
  await act(async () => { await Promise.resolve(); });
  return root;
};
async function switchAppTheme(theme: typeof lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer!.update(<TimerRunScreen />); });
}
async function openSettings(root: ReactTestInstance) {
  const btn = root.findAll((n) => n.props.testID === 'timer-settings' && typeof n.props.onPress === 'function')[0];
  if (btn) { await act(async () => { btn.props.onPress(); }); return; }
  await pressAround(root.findAllByType(Settings)[0]);
}
const byID = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && isHostText(n) === false);
const followSwitch = (root: ReactTestInstance) => root.findAllByType(AxSwitch).find((s) => s.props.testID === 'timer-follow-app-switch')!;
const activeTag = (root: ReactTestInstance) => root.findAllByType(AxTag).find((s) => s.props.testID === 'timer-active-theme')!.props.label;
/** Fonds plein écran (flex: 1) : ceux du thème du chrono, pas les pastilles de l'app. */
const bgs = (root: ReactTestInstance) => new Set(root.findAll((n) => String(n.type) === 'View')
  .map((n) => StyleSheet.flatten(n.props.style) ?? {}).filter((st) => st.flex === 1).map((st) => st.backgroundColor));
const stored = async () => JSON.parse((await AsyncStorage.getItem('bwod_timer_display_opts_v2'))!);
const PRE_R5B = { clockStyle: 'bar', fontSize: 86, digitColor: '#4d1a00', bgCountdown: '#CC5200', bgRunning: '#FF6600', bgDone: '#FF8833',
  bipsEnabled: true, allowRotation: false, themeId: 'fire', beepVolume: 1 };
const labelText = (root: ReactTestInstance) => hostText(root.findAll((n) => n.props.testID === 'timer-countdown-label' && isHostText(n))[0]);
const vibrations = () => (Vibration.vibrate as unknown as jest.Mock).mock.calls.map((c) => c[0]);

const ORDER = ['athlex', 'athlex2', 'noir', 'blanc', 'emerald', 'fire', 'electric', 'midnight', 'ocean', 'solar', 'neon', 'rage'];
const FR = ['AthleX', 'AthleX 2', 'Noir', 'Blanc', 'Citron vert', 'Orange', 'Bleu', 'Violet', 'Cyan', 'Jaune', 'Rose', 'Rouge'];
const EN = ['AthleX', 'AthleX 2', 'Black', 'White', 'Lime', 'Orange', 'Blue', 'Purple', 'Cyan', 'Yellow', 'Pink', 'Red'];
const EMOJI = /[\p{Extended_Pictographic}\uFE0F]/u;

async function inLanguage<T>(lng: string, fn: () => Promise<T> | T): Promise<T> {
  await act(async () => { await i18n.changeLanguage(lng); });
  try { return await fn(); } finally { await act(async () => { await i18n.changeLanguage('fr'); }); }
}

describe('R5b : thèmes du chrono', () => {
  it('ordre d\u2019affichage et identifiants existants conservés', () => {
    expect(TIMER_THEMES.map((t) => t.id)).toEqual(ORDER);
  });
  it('noms FR et EN par clés de traduction', async () => {
    expect(TIMER_THEMES.map((t) => i18n.t(t.labelKey))).toEqual(FR);
    await inLanguage('en', () => expect(TIMER_THEMES.map((t) => i18n.t(t.labelKey))).toEqual(EN));
  });
  it('plus aucun champ emoji', () => {
    for (const t of TIMER_THEMES) expect(Object.keys(t)).not.toContain('emoji');
  });
  it('couleurs exactes de AthleX et AthleX 2', () => {
    expect(TIMER_THEMES[0]).toEqual({ id: 'athlex', labelKey: 'timer.themes.athlex', digitColor: '#9AE6D2', bgCountdown: '#101214', bgRunning: '#101214', bgDone: '#1C2023', accent: '#9AE6D2' });
    expect(TIMER_THEMES[1]).toEqual({ id: 'athlex2', labelKey: 'timer.themes.athlex2', digitColor: '#101214', bgCountdown: '#9AE6D2', bgRunning: '#9AE6D2', bgDone: '#B5EEDF', accent: '#101214' });
  });
  it.each(TIMER_THEMES.slice(0, 2).map((t) => [t.id, t] as const))('%s : chiffres et accent lisibles (AA) sur chaque fond', (_, t) => {
    for (const bg of [t.bgCountdown, t.bgRunning, t.bgDone]) {
      expect(contrast(t.digitColor, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accent, bg)).toBeGreaterThanOrEqual(4.5);
      expect(ensureContrast(t.digitColor, bg)).toBe(t.digitColor);
    }
  });
  it.each([['fr', FR], ['en', EN]] as const)('feuille Design : noms %s, « 01:30 » en couleur des chiffres, aucun emoji', async (lng, names) => {
    await inLanguage(lng, async () => {
      const r = await run(runParams({}));
      await openSettings(r);
      const sheet = r.findAll((n) => n.props.testID === 'timer-design-sheet')[0];
      const txt = structure(sheet);
      expect(txt.some((s) => EMOJI.test(s))).toBe(false);
      for (const [i, t] of TIMER_THEMES.entries()) {
        const card = sheet.findAll((n) => n.props.testID === `timer-theme-${t.id}` && typeof n.props.onPress === 'function')[0];
        expect(structure(card)).toEqual(['01:30', names[i].toUpperCase()]);
        const digits = card.findAll((n) => isHostText(n) && hostText(n) === '01:30')[0];
        expect(StyleSheet.flatten(digits.props.style).color).toBe(t.digitColor);
      }
    });
  });
});

describe('R5b : suivre le thème de l\u2019app', () => {
  it.each([['clair', lightTheme, 'ATHLEX 2', '#9AE6D2'], ['sombre', darkTheme, 'ATHLEX', '#101214']] as const)(
    'sans thème enregistré : réglage activé, app en %s → %s', async (_, th, tag, bg) => {
      const r = await run(runParams({}), th);
      expect(bgs(r).has(bg)).toBe(true);
      await openSettings(r);
      expect(followSwitch(r).props.value).toBe(true);
      expect(activeTag(r)).toBe(tag);
    });
  it('le thème du chrono change dès que le thème de l\u2019app change, chrono lancé', async () => {
    const r = await run(runParams({}), lightTheme);
    await startStop(r); await tick(2);
    expect(bgs(r).has('#9AE6D2')).toBe(true);
    await switchAppTheme(darkTheme);
    expect(bgs(r).has('#101214')).toBe(true);
    expect(bgs(r).has('#9AE6D2')).toBe(false);
    await switchAppTheme(lightTheme);
    expect(bgs(r).has('#9AE6D2')).toBe(true);
  });
  it('toucher une vignette désactive le réglage et garde ce thème, même si l\u2019app change', async () => {
    const r = await run(runParams({}), darkTheme);
    await openSettings(r);
    await pressID(r, 'timer-theme-fire');
    expect(followSwitch(r).props.value).toBe(false);
    expect(activeTag(r)).toBe('ORANGE');
    expect(await stored()).toMatchObject({ followAppTheme: false, themeId: 'fire', bgRunning: '#FF6600' });
    await switchAppTheme(lightTheme);
    expect(activeTag(r)).toBe('ORANGE');
    expect(bgs(r).has('#FF6600')).toBe(true);
  });
  it('réactiver le réglage rend la main au thème de l\u2019app', async () => {
    const r = await run(runParams({}), lightTheme);
    await openSettings(r);
    await pressID(r, 'timer-theme-rage');
    await act(async () => { followSwitch(r).props.onValueChange(true); });
    expect(activeTag(r)).toBe('ATHLEX 2');
    expect((await stored()).followAppTheme).toBe(true);
    await switchAppTheme(darkTheme);
    expect(activeTag(r)).toBe('ATHLEX');
  });
  it('préférence enregistrée avant R5b : thème conservé, réglage désactivé', async () => {
    await AsyncStorage.setItem('bwod_timer_display_opts_v2', JSON.stringify(PRE_R5B));
    const r = await run(runParams({}), darkTheme);
    expect(bgs(r).has('#FF6600')).toBe(true);
    await openSettings(r);
    expect(followSwitch(r).props.value).toBe(false);
    expect(activeTag(r)).toBe('ORANGE');
  });
  it('choisir une couleur de chiffres fige le thème affiché', async () => {
    const r = await run(runParams({}), darkTheme);
    await openSettings(r);
    const chip = r.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === '#FFFFFF')[0];
    await act(async () => { chip.props.onPress(); });
    expect(await stored()).toMatchObject({ followAppTheme: false, themeId: 'athlex', bgRunning: '#101214' });
  });
});

describe('R5b : décompte', () => {
  let vib: jest.SpyInstance;
  beforeEach(() => { vib = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {}); });
  afterEach(() => vib.mockRestore());

  it('« PRÉPARE-TOI » au-dessus de 3 (nom du WOD, anneau, couleur des chiffres), « PRÊT ? » à 3-2-1 (accent, halo), « GO ! » à 0', async () => {
    const r = await run(runParams({ countdown: 5 }), lightTheme);
    await startStop(r);
    expect(labelText(r)).toBe('PRÉPARE-TOI');
    expect(byID(r, 'timer-countdown-ring')).not.toHaveLength(0);
    expect(r.findAll((n) => isHostText(n) && hostText(n) === WOD_TITLE)).not.toHaveLength(0);
    const val = () => r.findAll((n) => n.props.testID === 'timer-countdown-value' && isHostText(n))[0];
    expect(hostText(val())).toBe('5');
    expect(StyleSheet.flatten(val().props.style).color).toBe('#101214');
    await tick(1);
    expect(labelText(r)).toBe('PRÉPARE-TOI');
    await tick(1);
    expect(hostText(val())).toBe('3');
    expect(labelText(r)).toBe('PRÊT ?');
    expect(byID(r, 'timer-countdown-halo')).not.toHaveLength(0);
    expect(byID(r, 'timer-countdown-ring')).toHaveLength(0);
    expect(StyleSheet.flatten(val().props.style).color).toBe(ensureContrast('#101214', '#9AE6D2'));
    await tick(2);
    expect(labelText(r)).toBe('PRÊT ?');
    await tick(1);
    expect(r.findAll((n) => n.props.testID === 'timer-countdown')).toHaveLength(0);
    expect(r.findAll((n) => isHostText(n) && hostText(n) === 'GO !')).toHaveLength(1);
    expect(r.findAll((n) => n.props.testID === 'timer-main-time' && isHostText(n))).toHaveLength(1);
    await tick(1);
    expect(r.findAll((n) => n.props.testID === 'timer-go')).toHaveLength(0);
  });
  it('thème Noir : chiffre de préparation en couleur des chiffres, « PRÊT ? » en accent ; anneau fin, halo sans bordure', async () => {
    await AsyncStorage.setItem('bwod_timer_display_opts_v2', JSON.stringify({ ...PRE_R5B, themeId: 'noir', digitColor: '#39FF14' }));
    const r = await run(runParams({ countdown: 4 }));
    await startStop(r);
    const val = () => r.findAll((n) => n.props.testID === 'timer-countdown-value' && isHostText(n))[0];
    const border = (id: string) => StyleSheet.flatten(byID(r, id)[0].props.style).borderWidth;
    expect(StyleSheet.flatten(val().props.style).color).toBe('#39FF14');
    expect(border('timer-countdown-ring')).toBe(2);
    await tick(1);
    expect(StyleSheet.flatten(val().props.style).color).toBe('#FFFFFF');
    expect(border('timer-countdown-halo')).toBe(0);
  });
  it('libellés EN : GET READY, READY?, GO!', async () => {
    await inLanguage('en', async () => {
      const r = await run(runParams({ countdown: 4 }));
      await startStop(r);
      expect(labelText(r)).toBe('GET READY');
      await tick(1);
      expect(labelText(r)).toBe('READY?');
      await tick(3);
      expect(r.findAll((n) => isHostText(n) && hostText(n) === 'GO!')).toHaveLength(1);
    });
  });
  it('« PRÊT ? » en couleur d\u2019accent lisible sur AthleX (sombre)', async () => {
    const r = await run(runParams({ countdown: 3 }), darkTheme);
    await startStop(r);
    const v = r.findAll((n) => n.props.testID === 'timer-countdown-value' && isHostText(n))[0];
    expect(StyleSheet.flatten(v.props.style).color).toBe('#9AE6D2');
  });
  it('vibrations : 40 ms à 3, 2, 1 puis 200 ms à GO', async () => {
    const r = await run(runParams({ countdown: 5 }));
    await startStop(r);
    await tick(1);
    expect(vibrations()).toEqual([]);
    await tick(1);
    expect(vibrations()).toEqual([40]);
    await tick(2);
    expect(vibrations()).toEqual([40, 40, 40]);
    await tick(1);
    expect(vibrations()).toEqual([40, 40, 40, 200]);
    await tick(1);
    expect(vibrations()).toEqual([40, 40, 40, 200]);
  });
  it('décompte de 3 s : vibration dès l\u2019affichage du 3', async () => {
    const r = await run(runParams({ countdown: 3 }));
    await startStop(r);
    expect(vibrations()).toEqual([40]);
  });
  it('sons coupés : aucune vibration du décompte', async () => {
    await AsyncStorage.setItem('bwod_timer_display_opts_v2', JSON.stringify({ ...PRE_R5B, bipsEnabled: false }));
    const r = await run(runParams({ countdown: 3 }));
    await startStop(r);
    await tick(4);
    expect(vibrations()).toEqual([]);
  });
  it('Android : bips 5-4-3-2-1 + GO inchangés, GO au même tic que le départ', async () => {
    const played: string[] = [];
    const av = jest.requireMock('expo-av') as { Audio: { Sound: { createAsync: jest.Mock } } };
    av.Audio.Sound.createAsync.mockImplementation(async (src: { uri: string }) => ({ sound: {
      setVolumeAsync: jest.fn(async () => {}), unloadAsync: jest.fn(async () => {}),
      replayAsync: jest.fn(async () => { played.push(src.uri.replace(/^.*bwod_|\.wav$/g, '')); }),
    } }));
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      const r = await run(runParams({ countdown: 6 }));
      await startStop(r);
      await tick(5);
      expect(r.findAll((n) => n.props.testID === 'timer-main-time')).toHaveLength(0);
      await tick(1);
      expect(played).toEqual(['tick', 'tick', 'tick', 'tick', 'tick', 'go']);
      expect(r.findAll((n) => n.props.testID === 'timer-main-time' && isHostText(n))).toHaveLength(1);
      expect(vibrations()).toEqual([40, 40, 40, 200]);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });
});
