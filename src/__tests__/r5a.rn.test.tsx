import React from 'react';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Dimensions, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import { lightTheme, darkTheme } from '../theme/palette';
import { contrast } from '../theme/contrast';
import { axFonts } from '../theme/axTokens';
import { AxButton, AxChip, AxSwitch, AxTag } from '../components/ax';
import { AxScreenHeader } from '../components/ax/AxScreenHeader';
import { TIMER_THEMES } from '../theme/timerInk';
import { ScrollView } from 'react-native';
import { buildFullSeqBlockFromWOD, buildSplitBlock, buildTimerRunParamsFromBlock } from '../utils/wodToTimer';
import type { HomeStackParamList, SeqBlock } from '../navigation';
import TimerScreen from '../screens/timer/TimerScreen';
import TimerLaunchModal from '../components/wod/TimerLaunchModal';
import TimerRunScreen from '../screens/timer/TimerRunScreen';
import { Play, Settings } from 'lucide-react-native';

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

beforeEach(() => { jest.useFakeTimers(); setWindow(PORTRAIT); });
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
const AMRAP = buildFullSeqBlockFromWOD({ wod_type: 'amrap', time_cap_seconds: 720, rounds: 0 } as never);
const FORTIME = buildFullSeqBlockFromWOD({ wod_type: 'for-time', time_cap_seconds: 750, rounds: 0 } as never);
const EMOM: SeqBlock = { ...AMRAP, type: 'emom', emomInterval: 0, emomCustomSec: 90, emomRounds: 8 };
const TABATA: SeqBlock = { ...AMRAP, type: 'tabata', workSec: 20, restSec: 10, tabRounds: 8 };
const SPLIT = buildSplitBlock([{ name: 'Squat', sets: 2, restSec: 60 }]);
const modal = (b: SeqBlock, onLaunch = jest.fn(), onClose = jest.fn()) =>
  <TimerLaunchModal visible title={WOD_TITLE} initialBlock={b} onClose={onClose} onLaunch={onLaunch} />;

const runParams = (p: Partial<HomeStackParamList['TimerRun']>): HomeStackParamList['TimerRun'] => ({
  timerType: 'for-time', countdown: 0, totalSeconds: 0, maxTime: 600, interval: 1, rounds: 1, workTime: 0, restTime: 0,
  withCamera: false, videoTitle: WOD_TITLE, withTimestamp: false, sequence: '[]', ...p,
});
const RUN_AMRAP = runParams({ timerType: 'amrap', totalSeconds: 600, maxTime: 0 });
const RUN_EMOM = runParams({ timerType: 'emom', interval: 1, rounds: 10, maxTime: 0 });
const RUN_TABATA = runParams({ timerType: 'tabata', workTime: 20, restTime: 10, rounds: 8, maxTime: 0 });

type Variant = { name: string; run: () => Promise<ReactTestInstance> };
const run = async (p: HomeStackParamList['TimerRun'], w = PORTRAIT) => {
  setWindow(w);
  mockParams = p;
  return mount(<TimerRunScreen />);
};
const VARIANTS: Variant[] = [
  { name: 'réglages-for-time', run: () => mount(<TimerScreen />) },
  ...(['AMRAP', 'EMOM', 'TABATA', 'YWYR', 'SPLITS', 'PERSONNALISÉ'] as const).map((label) => ({
    name: `réglages-${label.toLowerCase()}`,
    run: async () => {
      const root = await mount(<TimerScreen />);
      await selectTimerType(root, label);
      return root;
    },
  })),
  { name: 'réglages-personnalisé-2-blocs-caméra', run: async () => {
    const root = await mount(<TimerScreen />);
    await selectTimerType(root, 'PERSONNALISÉ');
    await pressText(root, 'Ajouter un bloc');
    await toggleCamera(root);
    return root;
  } },
  { name: 'fenêtre-amrap', run: () => mount(modal(AMRAP)) },
  { name: 'fenêtre-for-time', run: () => mount(modal(FORTIME)) },
  { name: 'fenêtre-emom-perso', run: () => mount(modal(EMOM)) },
  { name: 'fenêtre-tabata', run: () => mount(modal(TABATA)) },
  { name: 'fenêtre-split', run: () => mount(modal(SPLIT)) },
  { name: 'en-cours-for-time-repos', run: () => run(runParams({})) },
  { name: 'en-cours-amrap', run: async () => { const r = await run(RUN_AMRAP); await startStop(r); await tick(3); return r; } },
  { name: 'en-cours-tabata', run: async () => { const r = await run(RUN_TABATA); await startStop(r); await tick(3); return r; } },
  { name: 'design-du-minuteur', run: async () => { const r = await run(runParams({})); await openSettings(r); return r; } },
  { name: 'paysage-a-for-time', run: () => run(runParams({}), LANDSCAPE) },
  { name: 'paysage-a-tabata', run: () => run(RUN_TABATA, LANDSCAPE) },
  { name: 'paysage-a-emom', run: () => run(RUN_EMOM, LANDSCAPE) },
  { name: 'paysage-b-amrap', run: async () => { const r = await run(RUN_AMRAP, LANDSCAPE); await startStop(r); await tick(3); return r; } },
  { name: 'paysage-b-emom', run: async () => { const r = await run(RUN_EMOM, LANDSCAPE); await startStop(r); await tick(3); return r; } },
  { name: 'temps-final', run: async () => { const r = await run(runParams({})); await startStop(r); await tick(7); await startStop(r); return r; } },
];

async function selectTimerType(root: ReactTestInstance, label: string) {
  await pressID(root, 'timer-type-selector');
  const key = TYPES.find((t) => t.label === label)!.key;
  await pressID(root, `timer-type-option-${key}`);
}
async function toggleCamera(root: ReactTestInstance) {
  const sw = root.findAll((n) => n.props.testID === 'timer-camera-switch' && typeof n.props.onPress === 'function')[0];
  if (sw) { await act(async () => { sw.props.onPress(); }); return; }
  const label = root.findAll((n) => isHostText(n) && hostText(n) === 'Enregistrer avec caméra')[0];
  let row: ReactTestInstance = label;
  while (row.findAll((n) => typeof n.props.onPress === 'function').length === 0) row = row.parent!;
  const toggle = row.findAll((n) => typeof n.props.onPress === 'function')[0];
  await act(async () => { toggle.props.onPress(); });
}
async function openSettings(root: ReactTestInstance) {
  const btn = root.findAll((n) => n.props.testID === 'timer-settings' && typeof n.props.onPress === 'function')[0];
  if (btn) { await act(async () => { btn.props.onPress(); }); return; }
  await pressAround(root.findAllByType(Settings)[0]);
}

describe('R5a : capture', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const root = await v.run();
    const current = structure(root);
    const file = process.env.R5A_CAPTURE;
    if (file) {
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    expect(current.length).toBeGreaterThan(0);
  });
});

/**
 * R6b : état du lien YouTube retiré, « GO ! » aussi en mode caméra (écart prouvé dans r6b.rn.test.tsx).
 * R6c : synchro de l'incrustation déplacée après displayOpts, champs du décompte envoyés (écart prouvé dans r6c.rn.test.tsx).
 */
const LOGIC_SHA = '4e98aa7bd29ca634486d0008ea6a1f6273b5dc369a22deae7fca53e0ddfaa66d';
const THEMES_SHA = 'bcac5c7d5b679c14c380dd3c86d531450e0283e3f7881219d508aa7f02c53c78';
const MODAL_SHA = '48d210edde52dc6c61eefc919547338ded563c6ac4e8405c748e9c748a47c566';
const LAUNCH_SHA = 'e4567887b4ed3745b56790f362ad063d475f82f5d770b1ab62783ff38c5f7dc2';
const MAIN_AT_GO = '00:00';

const BEFORE: Record<string, string[]> = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'r5aStructureBefore.json'), 'utf8'),
);
/** Glyphes texte remplacés par des icônes Lucide (−, +, coches, pictos de style, son). */
const GLYPHS = new Set(['−', '+', '✓', '◯', '▬', '99', '🔊', '🔇']);
const EMOJI_PREFIX = /^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u;
/** Les 7 types et leur description, tels que sur master. */
const TYPES = [
  { key: 'for-time', label: 'FOR TIME', desc: 'Chrono montant avec cap optionnel' },
  { key: 'amrap', label: 'AMRAP', desc: 'As Many Rounds As Possible' },
  { key: 'emom', label: 'EMOM', desc: 'Every Minute On the Minute' },
  { key: 'tabata', label: 'TABATA', desc: 'Intervalles travail / repos' },
  { key: 'ywyr', label: 'YWYR', desc: 'Your Work Your Rest' },
  { key: 'splits', label: 'SPLITS', desc: 'Rounds chronométrés séparément' },
  { key: 'libre', label: 'PERSONNALISÉ', desc: 'Séquence de blocs sur mesure' },
];
function normalizeBefore(name: string, list: string[]): string[] {
  let out = list.filter((t) => !GLYPHS.has(t)).map((t) => t.replace(EMOJI_PREFIX, '').toUpperCase());
  if (name === 'design-du-minuteur') {
    // R5b : thèmes AthleX en tête, noms traduits, réglage « Suivre le thème de l'app ».
    const a = out.indexOf('DESIGN DU MINUTEUR');
    const b = out.indexOf('COULEUR DES CHIFFRES');
    const up = (k: string) => i18n.t(k).toUpperCase();
    out = [...out.slice(0, a + 1), up('timer.themes.athlex2'), 'THÈME', up('timer.followAppTheme'), up('timer.followAppThemeHint'),
      ...TIMER_THEMES.flatMap((t) => ['01:30', up(t.labelKey)]), ...out.slice(b)];
  }
  if (name.startsWith('réglages-')) {
    const i = out.indexOf('TYPE DE MINUTEUR');
    const type = TYPES.find((t) => t.label === out[i + 1])!;
    out = [...out.slice(0, i + 2), type.desc.toUpperCase(), ...out.slice(i + 2)];
  }
  return out;
}

describe('R5a : mêmes blocs, mêmes options, même ordre', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const root = await v.run();
    expect(structure(root).map((t) => t.replace(EMOJI_PREFIX, '').toUpperCase())).toEqual(normalizeBefore(name, BEFORE[name]));
  });
});

const THEMES = [['clair', lightTheme], ['sombre', darkTheme]] as const;
const ownText = (n: ReactTestInstance) => n.findAll((x) => isHostText(x))[0];
const colorOf = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style)?.color;

describe('R5a : fenêtre « Lancer le chrono »', () => {
  it.each(THEMES)('six types en AxChip qui passent à la ligne, sans défilement (%s)', async (_, th) => {
    const root = await mount(modal(AMRAP), th);
    const list = root.findAll((n) => n.props.testID === 'timer-mode-list' && String(n.type) === 'View')[0];
    expect(StyleSheet.flatten(list.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(list.findAllByType(AxChip)).toHaveLength(6);
    const card = root.findAll((n) => n.props.testID === 'timer-launch-card')[0];
    expect(card.findAllByType(ScrollView).filter((sv) => sv.props.horizontal)).toHaveLength(0);
  });

  it.each([['amrap', AMRAP], ['for-time', FORTIME], ['emom', EMOM], ['tabata', TABATA], ['split', SPLIT]] as const)(
    'le type sélectionné (%s) est une pastille visible et la seule sélectionnée', async (key, b) => {
      const root = await mount(modal(b));
      const chips = root.findAll((n) => n.props.testID === 'timer-mode-list')[0].findAllByType(AxChip);
      expect(chips.filter((ch) => ch.props.selected).map((ch) => ch.props.testID)).toEqual([`timer-type-${key}`]);
    });

  it('compte à rebours à 3 s par défaut', async () => {
    const root = await mount(modal(AMRAP));
    const sel = root.findAllByType(AxChip).filter((ch) => /^timer-countdown-/.test(ch.props.testID) && ch.props.selected);
    expect(sel.map((ch) => ch.props.testID)).toEqual(['timer-countdown-3']);
  });

  it.each(THEMES)('« Avec caméra » en accent lisible AA, « Sans caméra » en contour (%s)', async (_, th) => {
    const root = await mount(modal(AMRAP), th);
    const buttons = root.findAllByType(AxButton);
    const withCam = buttons.find((b) => b.props.testID === 'timer-launch-with-camera')!;
    const without = buttons.find((b) => b.props.testID === 'timer-launch-without-camera')!;
    expect(withCam.props.variant).toBe('accent');
    expect(without.props.variant).toBe('outline');
    expect(buttons.filter((b) => b.props.variant === 'accent')).toHaveLength(1);
    const ink = colorOf(ownText(withCam));
    expect(ink).toBe(th.ax.onAccent);
    expect(contrast(ink, th.ax.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([[false, 'timer-launch-without-camera'], [true, 'timer-launch-with-camera']] as const)(
    'caméra %s : mêmes paramètres qu’avant', async (withCamera, id) => {
      const onLaunch = jest.fn();
      const root = await mount(modal(TABATA, onLaunch));
      await pressID(root, id);
      expect(onLaunch).toHaveBeenCalledTimes(1);
      expect(onLaunch).toHaveBeenCalledWith(buildTimerRunParamsFromBlock(TABATA, WOD_TITLE, { withCamera, countdown: 3 }));
    });
});

describe('R5a : réglages du minuteur', () => {
  it.each(THEMES)('en-tête, sélecteur de type, options en AxSwitch, une seule action accent (%s)', async (_, th) => {
    const root = await mount(<TimerScreen />, th);
    expect(root.findAllByType(AxScreenHeader)).toHaveLength(1);
    const sel = root.findAll((n) => n.props.testID === 'timer-type-selector' && typeof n.props.onPress === 'function')[0];
    expect(structure(sel)).toEqual(['FOR TIME', 'Chrono montant avec cap optionnel']);
    expect(root.findAllByType(AxChip).filter((ch) => /^timer-type-/.test(ch.props.testID))).toHaveLength(0);
    expect(root.findAllByType(AxSwitch).map((sw) => sw.props.testID)).toEqual(
      expect.arrayContaining(['timer-camera-switch']),
    );
    const accents = root.findAllByType(AxButton).filter((b) => b.props.variant === 'accent');
    expect(accents.map((b) => b.props.label)).toEqual(['DÉMARRER']);
  });

  it.each(THEMES)('liste : 7 AxCard avec libellé et description d’origine, type actif en accentText (%s)', async (_, th) => {
    const root = await mount(<TimerScreen />, th);
    expect(root.findAll((n) => n.props.testID === 'timer-type-sheet')).toHaveLength(0);
    await pressID(root, 'timer-type-selector');
    const sheet = root.findAll((n) => n.props.testID === 'timer-type-sheet')[0];
    expect(structure(sheet)).toEqual(['CHOISIR UN FORMAT', ...TYPES.flatMap((t) => [t.label, t.desc])]);
    for (const t of TYPES) {
      const card = sheet.findAll((n) => n.props.testID === `timer-type-option-${t.key}` && typeof n.props.onPress === 'function')[0];
      const [label, desc] = card.findAll((n) => isHostText(n));
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({
        fontFamily: axFonts.interSemiBold, fontSize: 14, color: t.key === 'for-time' ? th.ax.accentText : th.ax.text,
      });
      expect(StyleSheet.flatten(desc.props.style)).toMatchObject({ fontSize: 13, color: th.ax.textMuted });
      expect(contrast(th.ax.accentText, th.ax.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(TYPES.map((t) => [t.label, t] as const))('choisir %s met à jour le sélecteur et ferme la liste', async (_, t) => {
    const root = await mount(<TimerScreen />);
    await pressID(root, 'timer-type-selector');
    await pressID(root, `timer-type-option-${t.key}`);
    expect(root.findAll((n) => n.props.testID === 'timer-type-sheet')).toHaveLength(0);
    const sel = root.findAll((n) => n.props.testID === 'timer-type-selector' && typeof n.props.onPress === 'function')[0];
    expect(structure(sel)).toEqual([t.label, t.desc]);
  });

  it('fermer la liste sans choisir garde le type', async () => {
    const root = await mount(<TimerScreen />);
    await pressID(root, 'timer-type-selector');
    await pressID(root, 'timer-type-backdrop');
    expect(root.findAll((n) => n.props.testID === 'timer-type-sheet')).toHaveLength(0);
    const sel = root.findAll((n) => n.props.testID === 'timer-type-selector' && typeof n.props.onPress === 'function')[0];
    expect(structure(sel)).toEqual(['FOR TIME', 'Chrono montant avec cap optionnel']);
  });

  it('aucun emoji dans les réglages ni dans la liste', async () => {
    const root = await mount(<TimerScreen />);
    await pressID(root, 'timer-type-selector');
    expect(structure(root).filter((t) => /\p{Extended_Pictographic}/u.test(t))).toEqual([]);
  });

  it('DÉMARRER navigue avec les mêmes paramètres', async () => {
    const root = await mount(<TimerScreen />);
    await pressID(root, 'timer-start');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [route, params] = mockNavigate.mock.calls[0];
    expect(route).toBe('TimerRun');
    expect(params).toMatchObject({ timerType: 'libre', countdown: 3, withCamera: false, withTimestamp: true, videoTitle: '' });
    expect(JSON.parse(params.sequence)).toHaveLength(1);
    expect(JSON.parse(params.sequence)[0].type).toBe('for-time');
  });
});

function srcRegion(file: string, from: string, to: string): string {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  expect(a).toBeGreaterThanOrEqual(0);
  expect(b).toBeGreaterThan(a);
  return src.slice(a, b);
}
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe('R5a : aucun calcul, bip ni thème touché', () => {
  it('logique de TimerRunScreen (phases, tics, bips, enregistrement) figée (R5b : suivi du thème de l’app, vibration et GO du décompte ; R6b : GO en mode caméra)', () => {
    const logic = srcRegion('screens/timer/TimerRunScreen.tsx', 'export default function TimerRunScreen()', '// Phase-aware accent color');
    expect(sha(logic)).toBe(LOGIC_SHA);
  });
  it('TIMER_THEMES figé (état R5b)', () => {
    expect(sha(JSON.stringify(TIMER_THEMES))).toBe(THEMES_SHA);
  });
  it('fenêtre : réinitialisation à 3 s et launch identiques', () => {
    const logic = srcRegion('components/wod/TimerLaunchModal.tsx', 'useEffect(() => {', 'function renderConfig');
    expect(sha(logic)).toBe(MODAL_SHA);
  });
  it('réglages : launch() identique', () => {
    const logic = srcRegion('screens/timer/TimerScreen.tsx', 'function launch()', '// Splits config card');
    expect(sha(logic)).toBe(LAUNCH_SHA);
  });

  it('le chrono démarre au même tic que le GO et les bips sont 3, 2, 1, GO', async () => {
    const played: string[] = [];
    const av = jest.requireMock('expo-av') as { Audio: { Sound: { createAsync: jest.Mock } } };
    av.Audio.Sound.createAsync.mockImplementation(async (src: { uri: string }) => ({ sound: {
      setVolumeAsync: jest.fn(async () => {}), unloadAsync: jest.fn(async () => {}),
      replayAsync: jest.fn(async () => { played.push(src.uri.replace(/^.*bwod_|\.wav$/g, '')); }),
    } }));
    const root = await run(runParams({ countdown: 3 }));
    await act(async () => { await Promise.resolve(); });
    await startStop(root);
    await tick(2);
    expect(root.findAll((n) => n.props.testID === 'timer-main-time')).toHaveLength(0);
    await tick(1);
    const main = () => hostText(root.findAll((n) => n.props.testID === 'timer-main-time' && isHostText(n))[0]);
    expect(main()).toBe(MAIN_AT_GO);
    expect(played).toEqual(['tick', 'tick', 'tick', 'go']);
    await tick(1);
    expect(main()).not.toBe(MAIN_AT_GO);
  });
});

describe('R5a : écran en cours et paysage', () => {
  it.each(THEMES)('portrait : format en AxTag, grands chiffres Oswald (%s)', async (_, th) => {
    mockTheme = th;
    const r = await run(RUN_AMRAP);
    await startStop(r); await tick(4);
    expect(r.findAllByType(AxTag).filter((t) => t.props.testID === 'timer-format-tag')).toHaveLength(1);
    const main = r.findAll((n) => n.props.testID === 'timer-main-time' && isHostText(n))[0];
    expect(StyleSheet.flatten(main.props.style).fontFamily).toBe(axFonts.oswaldMedium);
  });

  const LAND = VARIANTS.filter((v) => v.name.startsWith('paysage-'));
  it.each(LAND.map((v) => [v.name, v] as const))('%s : rien ne sort des 844 × 390', async (_, v) => {
    const root = await v.run();
    const main = root.findAll((n) => n.props.testID === 'timer-main-time' && isHostText(n))[0];
    expect(main.props.numberOfLines).toBe(1);
    expect(main.props.adjustsFontSizeToFit).toBe(true);
    expect(StyleSheet.flatten(main.props.style).fontSize).toBeLessThanOrEqual(390);
    for (const n of root.findAll((x) => String(x.type) === 'View')) {
      const st = StyleSheet.flatten(n.props.style) ?? {};
      if (typeof st.width === 'number') expect(st.width).toBeLessThanOrEqual(844);
      if (typeof st.height === 'number') expect(st.height).toBeLessThanOrEqual(390);
      if (typeof st.left === 'number' && typeof st.width === 'number') expect(st.left + st.width).toBeLessThanOrEqual(844);
      if (typeof st.top === 'number' && typeof st.height === 'number') expect(st.top + st.height).toBeLessThanOrEqual(390);
    }
  });
});

describe('R5a : temps final sans vidéo', () => {
  const final = async () => {
    const r = await run(runParams({}));
    await startStop(r); await tick(7); await startStop(r);
    return r;
  };
  it.each(THEMES)('logo, AxTag du format, TEMPS FINAL, temps en Oswald (%s)', async (_, th) => {
    mockTheme = th;
    const r = await final();
    expect(r.findAllByType(AxTag).filter((t) => t.props.testID === 'timer-final-tag')).toHaveLength(1);
    expect(structure(r)).toContain('TEMPS FINAL');
    const time = r.findAll((n) => n.props.testID === 'timer-final-time' && isHostText(n))[0];
    expect(StyleSheet.flatten(time.props.style).fontFamily).toBe(axFonts.oswaldMedium);
  });
  it('Recommencer remet le chrono prêt', async () => {
    const r = await final();
    await pressID(r, 'timer-reset');
    expect(r.findAll((n) => n.props.testID === 'timer-final-time')).toHaveLength(0);
    expect(r.findAll((n) => n.props.testID === 'timer-start-stop').length).toBeGreaterThan(0);
  });
  it('Fermer : AxButton contour, retour inchangé', async () => {
    const r = await final();
    const close = r.findAllByType(AxButton).find((b) => b.props.testID === 'timer-close')!;
    expect(close.props.variant).toBe('outline');
    await pressID(r, 'timer-close');
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('R5a : feuille « Design du minuteur »', () => {
  it.each(THEMES)('mêmes vignettes, style en AxChip, sons et rotation en AxSwitch, une action accent (%s)', async (_, th) => {
    mockTheme = th;
    const r = await run(runParams({}));
    await openSettings(r);
    const sheet = r.findAll((n) => n.props.testID === 'timer-design-sheet')[0];
    expect(sheet.findAllByType(AxChip).map((ch) => ch.props.testID)).toEqual(['timer-style-arc', 'timer-style-bar', 'timer-style-digits']);
    expect(sheet.findAllByType(AxSwitch).map((sw) => sw.props.testID)).toEqual(['timer-follow-app-switch', 'timer-sounds-switch', 'timer-rotation-switch']);
    for (const t of TIMER_THEMES) expect(structure(sheet).join('|')).toContain(i18n.t(t.labelKey).toUpperCase());
    expect(sheet.findAllByType(AxButton).filter((b) => b.props.variant === 'accent')).toHaveLength(1);
  });
  it('choisir « Cercle » sélectionne ce style', async () => {
    const r = await run(runParams({}));
    await openSettings(r);
    await pressID(r, 'timer-style-arc');
    const sel = r.findAllByType(AxChip).filter((ch) => /^timer-style-/.test(ch.props.testID) && ch.props.selected);
    expect(sel.map((ch) => ch.props.testID)).toEqual(['timer-style-arc']);
  });
});

describe('R5a : encres posées sur le fond du chrono', () => {
  it('AxTag color et AxButton ink imposent l’encre', async () => {
    const root = await mount(<>
      <AxTag label="AMRAP" color="#003300" testID="t" />
      <AxButton label="Fermer" variant="outline" ink="#003300" onPress={() => {}} testID="b" />
      <AxButton label="Fermer" variant="outline" onPress={() => {}} testID="c" />
    </>);
    const texts = root.findAll((n) => isHostText(n));
    expect(texts.map((n) => colorOf(n))).toEqual(['#003300', '#003300', lightTheme.ax.text]);
  });
});
