/**
 * Refonte R2b : barre d'onglets flottante en verre de l'athlète, montée avec le
 * vrai react-native. Apparence (dimensions, rayon, bordure, verre iOS / Android,
 * couleurs dans les deux thèmes), accessibilité, masquage au clavier et espace
 * réservé en bas des écrans selon l'inset.
 */
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
      paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between',
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
  it('5 onglets dans l\'ordre, libellé axTypography.tab, icône 20, zone tactile 44 × 44, rôle tab et libellé lu', async () => {
    const { root } = await mount({ index: 2 });
    const items = tabs(root);
    expect(items.map((t) => t.props.accessibilityLabel)).toEqual(ROUTES.map((r) => r.label));
    items.forEach((t, i) => {
      expect(flat(t)).toMatchObject({ minWidth: 44, minHeight: 44, alignItems: 'center', gap: 4 });
      expect(t.props.accessibilityState).toEqual({ selected: i === 2 });
      const label = t.findByType(Text);
      expect(label.props.children).toBe(ROUTES[i].label);
      expect(flat(label)).toMatchObject(axTypography.tab);
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
