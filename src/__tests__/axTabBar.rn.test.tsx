/**
 * Refonte R2b : barre d'onglets flottante en verre de l'athlète, montée avec le
 * vrai react-native. Apparence (dimensions, rayon, bordure, verre iOS / Android,
 * couleurs dans les deux thèmes), accessibilité, masquage au clavier et espace
 * réservé en bas des écrans selon l'inset.
 */
import fs from 'node:fs';
import React from 'react';
import { Dimensions, Keyboard, Platform, StyleSheet, Text, View } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { CalendarClock, Dumbbell, Home, Layout, Trophy } from 'lucide-react-native';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import { axGlass, axTypography } from '../theme/axTokens';
import { AxCounterBadge, AxGlass, withAlpha } from '../components/ax';

let mockTheme: AppTheme = lightTheme;
let mockInsetBottom = 0;
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: mockInsetBottom, left: 0, right: 0 }),
}));
jest.mock('@react-navigation/native', () => ({
  CommonActions: { navigate: (route: { name: string }) => ({ type: 'NAVIGATE', payload: { name: route.name } }) },
}));
jest.mock('@react-navigation/bottom-tabs', () => {
  const R = jest.requireActual('react');
  return {
    BottomTabBarHeightCallbackContext: R.createContext(undefined),
    BottomTabBarHeightContext: R.createContext(undefined),
  };
});

import { BottomTabBarHeightCallbackContext, BottomTabBarHeightContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AxTabBar } from '../navigation/AxTabBar';
import { tabBarFootprint, tabBarScrollSpace, useTabBarFootprint, useTabBarScrollSpace } from '../navigation/tabBarLayout';

const ROUTES = [
  { name: 'Competitions', label: 'Compétition', Icon: Trophy },
  { name: 'Training', label: 'Entraînement', Icon: Dumbbell },
  { name: 'Home', label: 'Accueil', Icon: Home },
  { name: 'Whiteboard', label: 'Ma Box', Icon: Layout },
  { name: 'Reservation', label: 'Réservation', Icon: CalendarClock },
];

const originalOS = Platform.OS;
let renderer: TestRenderer.ReactTestRenderer | null = null;
let keyboardListeners: Record<string, () => void> = {};

beforeEach(() => {
  Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1 }, screen: { width: 390, height: 844, scale: 3, fontScale: 1 } });
  keyboardListeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
    keyboardListeners[event] = cb;
    return { remove: () => {} };
  }) as never);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  Platform.OS = originalOS;
  mockInsetBottom = 0;
  jest.restoreAllMocks();
});

type Opts = { index?: number; inset?: number; theme?: AppTheme; tabBarStyle?: object; badge?: number; onHeight?: (h: number) => void };

function buildProps({ index = 2, inset = 0, tabBarStyle, badge }: Opts) {
  const routes = ROUTES.map((r) => ({ key: `${r.name}-key`, name: r.name }));
  const descriptors = Object.fromEntries(ROUTES.map((r) => [`${r.name}-key`, {
    options: {
      tabBarLabel: r.label,
      tabBarHideOnKeyboard: true,
      tabBarStyle,
      tabBarBadge: r.name === 'Whiteboard' ? badge : undefined,
      tabBarIcon: ({ color, size }: { color: string; size: number }) => <r.Icon color={color} size={size} />,
    },
  }]));
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    dispatch: jest.fn(),
  };
  return {
    state: { key: 'tabs', index, routes },
    descriptors,
    navigation,
    insets: { top: 0, bottom: inset, left: 0, right: 0 },
  };
}

async function mount(opts: Opts = {}) {
  mockTheme = opts.theme ?? lightTheme;
  const props = buildProps(opts);
  await act(async () => {
    renderer = TestRenderer.create(
      <BottomTabBarHeightCallbackContext.Provider value={opts.onHeight}>
        <AxTabBar {...(props as unknown as BottomTabBarProps)} />
      </BottomTabBarHeightCallbackContext.Provider>,
    );
  });
  return { root: renderer!.root, props };
}

const flat = (i: ReactTestInstance) => StyleSheet.flatten(i.props.style) ?? {};
const bar = (root: ReactTestInstance) => root.findAll((n) => n.props.testID === 'ax-tab-bar' && typeof n.type !== 'string')[0];
const tabs = (root: ReactTestInstance) => root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.type !== 'string' && n.props.onPress);
const dot = (root: ReactTestInstance, name: string) => root.findAll((n) => n.props.testID === `tab-${name}-dot` && typeof n.type === 'string')[0];

describe('barre flottante : forme et verre', () => {
  it.each([0, 34])('écran de 390, inset %d : 350 × 64, rayon 24, 20 de marge, posée à inset + 12, bordure 1 px theme.ax.border', async (inset) => {
    const { root } = await mount({ inset });
    const s = flat(bar(root));
    expect(s).toMatchObject({
      position: 'absolute', width: 350, height: 64, left: 20, bottom: inset + 12, borderRadius: 24,
      borderWidth: 1, borderColor: lightTheme.ax.border,
      paddingVertical: 10, paddingHorizontal: 6, flexDirection: 'row',
    });
  });

  it.each([darkTheme, lightTheme])('iOS / $mode : AxGlass theme.ax.background à 0.80 avec flou axGlass.glassBlur', async (theme) => {
    Platform.OS = 'ios';
    const { root } = await mount({ theme });
    const glass = root.findByType(AxGlass);
    expect(glass.props).toMatchObject({ color: theme.ax.background, opacity: 0.8, radius: 24 });
    const blur = root.findAll((n) => (n.type as unknown) === 'BlurView');
    expect(blur).toHaveLength(1);
    expect(blur[0].props.intensity).toBe(axGlass.glassBlur);
    const fill = root.findAll((n) => n.props.testID === 'ax-tab-bar-glass-fill' && typeof n.type === 'string')[0];
    expect(flat(fill).backgroundColor).toBe(withAlpha(theme.ax.background, 0.8));
  });

  it.each([darkTheme, lightTheme])('Android / $mode : pas de flou, fond porté à 0.96', async (theme) => {
    Platform.OS = 'android';
    const { root } = await mount({ theme });
    expect(root.findAll((n) => (n.type as unknown) === 'BlurView')).toHaveLength(0);
    const fill = root.findAll((n) => n.props.testID === 'ax-tab-bar-glass-fill' && typeof n.type === 'string')[0];
    expect(flat(fill).backgroundColor).toBe(withAlpha(theme.ax.background, 0.96));
  });
});

describe('onglets', () => {
  it('5 onglets dans l\'ordre, libellé Inter SemiBold 9,5 sans espacement, icône 20, zone tactile 44 × 44, rôle tab et libellé lu', async () => {
    const { root } = await mount({ index: 2 });
    const items = tabs(root);
    expect(items.map((t) => t.props.accessibilityLabel)).toEqual(ROUTES.map((r) => r.label));
    items.forEach((t, i) => {
      expect(flat(t)).toMatchObject({ flex: 1, minWidth: 44, minHeight: 44, alignItems: 'center', gap: 4 });
      expect(t.props.accessibilityState).toEqual({ selected: i === 2 });
      const label = t.findByType(Text);
      expect(label.props.children).toBe(ROUTES[i].label);
      expect(flat(label)).toMatchObject({ fontFamily: axTypography.tab.fontFamily, fontSize: 9.5, lineHeight: 12, letterSpacing: 0 });
      expect(t.findByType(ROUTES[i].Icon).props.size).toBe(20);
    });
  });

  it.each([darkTheme, lightTheme])('$mode : actif en accentText avec point visible, inactifs en textMuted sans point', async (theme) => {
    const { root } = await mount({ index: 1, theme });
    tabs(root).forEach((t, i) => {
      const active = i === 1;
      const color = active ? theme.ax.accentText : theme.ax.textMuted;
      expect(flat(t.findByType(Text)).color).toBe(color);
      expect(t.findByType(ROUTES[i].Icon).props.color).toBe(color);
      const d = flat(dot(root, ROUTES[i].name));
      expect(d).toMatchObject({ width: 4, height: 4, backgroundColor: theme.ax.accentText, opacity: active ? 1 : 0 });
    });
  });

  it('appui sur un autre onglet : événement tabPress puis navigation ; sur l\'onglet actif : événement seul', async () => {
    const { root, props } = await mount({ index: 2 });
    await act(async () => tabs(root)[1].props.onPress());
    expect(props.navigation.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'Training-key', canPreventDefault: true });
    expect(props.navigation.dispatch).toHaveBeenCalledWith({ type: 'NAVIGATE', payload: { name: 'Training' }, target: 'tabs' });
    props.navigation.dispatch.mockClear();
    await act(async () => tabs(root)[2].props.onPress());
    expect(props.navigation.dispatch).not.toHaveBeenCalled();
  });

  it('le badge des messages non lus reste sur Ma Box', async () => {
    const { root } = await mount({ badge: 3 });
    const badge = root.findAllByType(AxCounterBadge);
    expect(badge.map((b) => [b.props.testID, b.props.count])).toEqual([['tab-Whiteboard-badge', 3]]);
  });
});

describe('masquage', () => {
  it.each(['ios', 'android'] as const)('%s : clavier ouvert, la barre disparaît ; fermé, elle revient', async (os) => {
    Platform.OS = os;
    const { root } = await mount();
    expect(bar(root)).toBeDefined();
    const [show, hide] = os === 'ios' ? ['keyboardWillShow', 'keyboardWillHide'] : ['keyboardDidShow', 'keyboardDidHide'];
    await act(async () => keyboardListeners[show]());
    expect(bar(root)).toBeUndefined();
    await act(async () => keyboardListeners[hide]());
    expect(bar(root)).toBeDefined();
  });

  it('un écran qui masque la barre (minuteur, vidéo) la masque toujours', async () => {
    const { root } = await mount({ tabBarStyle: { display: 'none' } });
    expect(bar(root)).toBeUndefined();
  });
});

describe('espace réservé en bas des écrans', () => {
  it.each([[0, 76, 92], [34, 110, 126]])('inset %d : la barre publie %d, le contenu garde %d (64 + 12 + inset + 16)', async (inset, footprint, space) => {
    expect(tabBarFootprint(inset)).toBe(footprint);
    expect(tabBarScrollSpace(tabBarFootprint(inset), inset)).toBe(space);
    const onHeight = jest.fn();
    await mount({ inset, onHeight });
    expect(onHeight).toHaveBeenLastCalledWith(footprint);
  });

  function Probe({ out }: { out: { space?: number; foot?: number } }) {
    out.space = useTabBarScrollSpace();
    out.foot = useTabBarFootprint();
    return <View />;
  }

  it.each([0, 34])('inset %d : un écran sous la barre garde 64 + 12 + inset + 16 ; un bouton fixé se pose au-dessus', async (inset) => {
    mockInsetBottom = inset;
    const out: { space?: number; foot?: number } = {};
    await act(async () => {
      renderer = TestRenderer.create(
        <BottomTabBarHeightContext.Provider value={tabBarFootprint(inset)}><Probe out={out} /></BottomTabBarHeightContext.Provider>,
      );
    });
    expect(out.space).toBe(64 + 12 + inset + 16);
    expect(out.foot).toBe(64 + 12 + inset);
    await act(async () => keyboardListeners[Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow']());
    expect(out.foot).toBe(0);
  });

  it('hors onglets : seulement inset + 16, aucun décalage de bouton', async () => {
    mockInsetBottom = 34;
    const out: { space?: number; foot?: number } = {};
    await act(async () => { renderer = TestRenderer.create(<Probe out={out} />); });
    expect(out).toEqual({ space: 50, foot: 0 });
  });
});

/**
 * Largeurs d'avance réelles d'Inter SemiBold, lues dans le fichier de police
 * (tables head, hhea, hmtx et cmap format 4) : aucune estimation par caractère.
 */
function loadAdvance(file: string): (text: string, size: number) => number {
  const buf = fs.readFileSync(file);
  const u16 = (o: number) => buf.readUInt16BE(o);
  const tables: Record<string, number> = {};
  for (let i = 0; i < u16(4); i++) tables[buf.toString('latin1', 12 + i * 16, 16 + i * 16)] = buf.readUInt32BE(20 + i * 16);
  const unitsPerEm = u16(tables.head + 18);
  const hMetrics = u16(tables.hhea + 34);
  let sub = -1;
  for (let i = 0; i < u16(tables.cmap + 2); i++) {
    const r = tables.cmap + 4 + i * 8;
    if (u16(r) === 3 && u16(r + 2) === 1) sub = tables.cmap + buf.readUInt32BE(r + 4);
  }
  const seg = u16(sub + 6) / 2;
  const ends = sub + 14, starts = ends + seg * 2 + 2, deltas = starts + seg * 2, ranges = deltas + seg * 2;
  const glyph = (code: number) => {
    for (let i = 0; i < seg; i++) {
      if (code > u16(ends + i * 2)) continue;
      if (code < u16(starts + i * 2)) return 0;
      const ro = u16(ranges + i * 2);
      if (ro === 0) return (code + u16(deltas + i * 2)) & 0xffff;
      const g = u16(ranges + i * 2 + ro + (code - u16(starts + i * 2)) * 2);
      return g === 0 ? 0 : (g + u16(deltas + i * 2)) & 0xffff;
    }
    return 0;
  };
  const advance = (g: number) => u16(tables.hmtx + Math.min(g, hMetrics - 1) * 4);
  return (text, size) => {
    let units = 0;
    for (const ch of text) {
      const g = glyph(ch.codePointAt(0)!);
      expect(g).toBeGreaterThan(0);
      units += advance(g);
    }
    return (units / unitsPerEm) * size;
  };
}

const textWidth = loadAdvance(require.resolve('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'));
const LABELS = {
  fr: ['Compétition', 'Entraînement', 'Accueil', 'Ma Box', 'Réservation'],
  en: ['Competition', 'Training', 'Home', 'My Box', 'Booking'],
};

/**
 * Rangée flex horizontale à partir des styles rendus : un enfant flex: 1 se
 * partage l'espace restant (base 0), sinon il prend sa largeur propre (icône ou
 * libellé, au moins minWidth), placée selon justifyContent.
 */
function layoutTabs(root: ReactTestInstance) {
  const b = flat(bar(root));
  const left = (b.borderLeftWidth ?? b.borderWidth ?? 0) + (b.paddingLeft ?? b.paddingHorizontal ?? b.padding ?? 0);
  const right = (b.borderRightWidth ?? b.borderWidth ?? 0) + (b.paddingRight ?? b.paddingHorizontal ?? b.padding ?? 0);
  const inner = b.width - left - right;
  const items = tabs(root).map((t) => {
    const s = flat(t);
    const label = flat(t.findByType(Text));
    const own = Math.max(s.minWidth ?? 0, 20, textWidth(t.findByType(Text).props.children, label.fontSize) + (label.letterSpacing ?? 0) * t.findByType(Text).props.children.length);
    return { grow: s.flex ?? s.flexGrow ?? 0, basis: (s.flex ?? 0) > 0 ? 0 : own, min: s.minWidth ?? 0 };
  });
  const totalGrow = items.reduce((a, i) => a + i.grow, 0);
  const free = inner - items.reduce((a, i) => a + i.basis, 0);
  const widths = items.map((i) => Math.max(i.min, i.basis + (totalGrow > 0 ? (free * i.grow) / totalGrow : 0)));
  const rest = inner - widths.reduce((a, w) => a + w, 0);
  const jc = b.justifyContent ?? 'flex-start';
  const gap = jc === 'space-between' && widths.length > 1 ? rest / (widths.length - 1) : 0;
  let x = b.left + left + (jc === 'center' ? rest / 2 : jc === 'flex-end' ? rest : 0);
  return widths.map((w) => {
    const r = { left: x, width: w, center: x + w / 2 };
    x += w + gap;
    return r;
  });
}

const setWidth = (width: number) =>
  Dimensions.set({ window: { width, height: 844, scale: 3, fontScale: 1 }, screen: { width, height: 844, scale: 3, fontScale: 1 } });

describe('Accueil centré, onglets de largeur égale', () => {
  it.each([390, 430])('écran de %d : les 5 onglets ont exactement la même largeur', async (w) => {
    setWidth(w);
    const { root } = await mount();
    const widths = layoutTabs(root).map((r) => r.width);
    expect(widths).toHaveLength(5);
    widths.forEach((x) => expect(x).toBeCloseTo((w - 40 - 2 - 12) / 5, 6));
  });

  it.each([390, 430])('écran de %d : le centre d\'« Accueil » est le centre de l\'écran', async (w) => {
    setWidth(w);
    const { root } = await mount();
    const home = layoutTabs(root)[ROUTES.findIndex((r) => r.name === 'Home')];
    expect(home.center).toBeCloseTo(w / 2, 6);
  });
});

describe('aucun libellé tronqué', () => {
  it('une seule ligne ; sinon réduction jusqu\'à 0,85, jamais coupé', async () => {
    const { root } = await mount();
    tabs(root).forEach((t) => {
      const label = t.findByType(Text);
      expect(label.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.85 });
      expect(label.props.ellipsizeMode).toBeUndefined();
      expect(flat(label)).toMatchObject({ alignSelf: 'stretch', textAlign: 'center' });
    });
  });

  it.each([
    [390, 'fr'], [390, 'en'], [430, 'fr'], [430, 'en'],
  ] as const)('écran de %d (%s) : chaque libellé tient à 9,5 sans réduction', async (w, lang) => {
    setWidth(w);
    const { root } = await mount();
    const boxes = layoutTabs(root);
    const size = flat(tabs(root)[0].findByType(Text)).fontSize;
    LABELS[lang].forEach((l, i) => expect(textWidth(l, size)).toBeLessThanOrEqual(boxes[i].width));
  });

  it.each(['fr', 'en'] as const)('petit écran de 320 (%s) : chaque libellé tient une fois réduit au minimum', async (lang) => {
    setWidth(320);
    const { root } = await mount();
    const boxes = layoutTabs(root);
    const label = tabs(root)[0].findByType(Text);
    const min = flat(label).fontSize * label.props.minimumFontScale;
    LABELS[lang].forEach((l, i) => expect(textWidth(l, min)).toBeLessThanOrEqual(boxes[i].width));
  });
});
