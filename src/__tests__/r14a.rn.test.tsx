/**
 * R14a : fond uni, titres accentués non rognés, AxChip jamais comprimée.
 * Monté avec le vrai react-native (npm run test:rn).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import { axAccentSafeLineHeight, axTypography } from '../theme/axTokens';
import GlassBackground from '../components/glass/GlassBackground';
import { AxChip, AX_CHIP_HEIGHT } from '../components/ax/AxChip';
import { AxPageHeader } from '../components/ax/AxPageHeader';

let mockTheme: AppTheme = lightTheme;
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme, toggleTheme: () => {} }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const SRC = path.resolve(__dirname, '..');
const flat = (i: ReactTestInstance) => StyleSheet.flatten(i.props.style) ?? {};

let renderer: TestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
});
async function mount(el: React.ReactElement, theme: AppTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  return renderer!.root;
}

/** Métriques Oswald 500 (Oswald_500Medium.ttf, 1000 unités/em) : « É » monte à 1066, descente 289. */
const OSWALD_ACCENT_TOP = 1.066;
const OSWALD_DESCENT = 0.289;
/** Inter 600 (Inter_600SemiBold.ttf, 2048 unités/em) : ascendante 1984, descendante 494. */
const INTER_HEIGHT = (1984 + 494) / 2048;

describe('GlassBackground — fond uni theme.ax.background', () => {
  for (const theme of [darkTheme, lightTheme]) {
    it(`${theme.mode} : une seule vue pleine, couleur ${theme.ax.background}, sans dégradé ni tache`, async () => {
      const root = await mount(<GlassBackground />, theme);
      const hosts = root.findAll((n) => typeof n.type === 'string');
      expect(hosts).toHaveLength(1);
      expect(flat(hosts[0])).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.ax.background });
      expect(hosts[0].props.pointerEvents).toBe('none');
    });
  }

  it('les deux thèmes donnent les fonds du nouveau design', () => {
    expect(darkTheme.ax.background).toBe('#101214');
    expect(lightTheme.ax.background).toBe('#F3F5F4');
  });

  it('le composant ne rend plus ni dégradé, ni SVG, ni animation', () => {
    const src = fs.readFileSync(path.join(SRC, 'components', 'glass', 'GlassBackground.tsx'), 'utf8');
    expect(src).not.toMatch(/LinearGradient|react-native-svg|Animated|BlurView/);
  });
});

describe('titres Oswald en capitales : l’accent de « É » n’est pas rogné', () => {
  it.each(['titleXL', 'titleL', 'titleM'] as const)('%s : interligne ≥ montée de « É » + descente', (k) => {
    const fontSize = axTypography[k].fontSize as number;
    expect(axAccentSafeLineHeight[k]).toBeGreaterThanOrEqual(Math.ceil(fontSize * (OSWALD_ACCENT_TOP + OSWALD_DESCENT)));
  });

  it('l’interligne de base, lui, rognait l’accent (le contrôle mord)', () => {
    const fontSize = axTypography.titleXL.fontSize as number;
    const lineHeight = axTypography.titleXL.lineHeight as number;
    expect(lineHeight).toBeLessThan(fontSize * (OSWALD_ACCENT_TOP + OSWALD_DESCENT));
  });

  for (const theme of [darkTheme, lightTheme]) {
    it(`${theme.mode} : AxPageHeader « Compétitions » garde l’accent et l’interligne sûr`, async () => {
      const root = await mount(<AxPageHeader title="Compétitions" />, theme);
      const title = root.findAll((n) => n.type === Text && n.props.accessibilityRole === 'header')[0];
      expect(title.props.children).toBe('Compétitions');
      expect(flat(title)).toMatchObject({ textTransform: 'uppercase', lineHeight: axAccentSafeLineHeight.titleXL });
    });
  }

  it('titres français accentués (fr.json) : Réservation, Compétitions, Compétition', () => {
    const fr = require('../i18n/locales/fr.json') as Record<string, Record<string, string>>;
    expect(fr.reservation.title).toBe('Réservation');
    expect(fr.competition.title).toBe('Compétitions');
    expect(fr.tabs.competition).toBe('Compétition');
    expect(fr.tabs.reservation).toBe('Réservation');
    expect(fr.reservation.title.toUpperCase()).toBe('RÉSERVATION');
    expect(fr.competition.title.toUpperCase()).toBe('COMPÉTITIONS');
  });

  it.each([
    ['screens/reservation/ReservationScreen.tsx', 'headerTitle'],
    ['screens/home/HomeScreen.tsx', 'username'],
    ['screens/profile/ProfileScreen.tsx', 'username'],
    ['screens/whiteboard/WhiteboardScreen.tsx', 'headerTitle'],
  ])('%s : le titre titleXL prend l’interligne sûr', (rel, key) => {
    const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
    expect(src).toMatch(new RegExp(`${key}: *\\{ \\.\\.\\.axTypography\\.titleXL, lineHeight: axAccentSafeLineHeight\\.titleXL`));
  });
});

describe('AxChip — le libellé n’est jamais rogné', () => {
  for (const theme of [darkTheme, lightTheme]) {
    it(`${theme.mode} : hauteur minimale = padding + interligne + bordure, non comprimable`, async () => {
      const root = await mount(<AxChip label="Tournois" onPress={() => {}} />, theme);
      const chip = root.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Tournois')[0];
      const s = flat(chip);
      expect(AX_CHIP_HEIGHT).toBe(9 + (axTypography.label.lineHeight as number) + 9 + 2);
      expect(s.minHeight).toBe(AX_CHIP_HEIGHT);
      expect(s.flexShrink).toBe(0);
      expect(axTypography.label.lineHeight as number).toBeGreaterThanOrEqual(Math.ceil((axTypography.label.fontSize as number) * INTER_HEIGHT));
    });
  }

  it.each([
    ['screens/competition/CompetitionScreen.tsx', /tabsBar: \{ flexGrow: 0, flexShrink: 0 \}/],
    ['screens/competition/TournamentScreen.tsx', /chipBar: *\{ flexGrow: 0, flexShrink: 0 \}/],
    ['screens/explorer/BoxDirectoryScreen.tsx', /filtersBar: \{ flexGrow: 0, flexShrink: 0 \}/],
    ['screens/settings/NotificationSettingsScreen.tsx', /hourScroll: \{ flexGrow: 0, flexShrink: 0/],
    ['screens/wod/WodGeneratorScreen.tsx', /chipScrollOuter: \{\s*flexGrow: 0,\s*flexShrink: 0/],
  ])('%s : la rangée horizontale de pastilles ne se comprime pas', (rel, re) => {
    expect(fs.readFileSync(path.join(SRC, rel), 'utf8')).toMatch(re);
  });
});

