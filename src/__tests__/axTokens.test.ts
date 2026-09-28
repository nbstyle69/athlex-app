import * as fs from 'fs';
import * as path from 'path';
import { axColors, axRadius, axSpacing, axGlass, axTypography } from '../theme/axTokens';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import { contrast } from '../theme/contrast';

// Valeurs de référence recopiées du Figma (collections « AthleX — Couleurs » et
// « AthleX — Dimensions ») : toute dérive des jetons doit faire échouer ce test.
const EXPECTED_COLORS = {
  dark: {
    background: '#101214', surface: '#1C2023', field: '#101214', text: '#F2F4F4',
    textMuted: '#989FA3', accent: '#9AE6D2', onAccent: '#101214', accentText: '#9AE6D2',
    border: 'rgba(242,244,244,0.12)', fieldBorder: '#6B7772', danger: '#F87171',
    warning: '#FBBF24', success: '#4ADE80', info: '#60A5FA', orange: '#F97316', violet: '#C084FC',
  },
  light: {
    background: '#F3F5F4', surface: '#FFFFFF', field: '#F3F5F4', text: '#17201D',
    textMuted: '#52605B', accent: '#9AE6D2', onAccent: '#101214', accentText: '#176B57',
    border: '#D1DAD6', fieldBorder: '#78867F', danger: '#B91C1C',
    warning: '#92400E', success: '#166534', info: '#1D4ED8', orange: '#9A3412', violet: '#6D28D9',
  },
};

const O = 'Oswald_500Medium';
const IR = 'Inter_400Regular';
const IM = 'Inter_500Medium';
const IS = 'Inter_600SemiBold';
const U = 'uppercase' as const;

const EXPECTED_TYPOGRAPHY = {
  titleXL: { fontFamily: O, fontSize: 34, lineHeight: 38, letterSpacing: -1, textTransform: U },
  titleL: { fontFamily: O, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, textTransform: U },
  titleM: { fontFamily: O, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, textTransform: U },
  numberL: { fontFamily: O, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  numberM: { fontFamily: O, fontSize: 24, lineHeight: 28, letterSpacing: 0 },
  overline: { fontFamily: IM, fontSize: 12, lineHeight: 16, letterSpacing: 2, textTransform: U },
  overlineSmall: { fontFamily: IM, fontSize: 9, lineHeight: 12, letterSpacing: 1, textTransform: U },
  body: { fontFamily: IR, fontSize: 15, lineHeight: 24 },
  bodySmall: { fontFamily: IR, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: IR, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: IS, fontSize: 14, lineHeight: 20 },
  labelSmall: { fontFamily: IS, fontSize: 12, lineHeight: 16 },
  tab: { fontFamily: IS, fontSize: 10, lineHeight: 12, letterSpacing: 0.2 },
};

// Instantané des thèmes de master avant l'ajout de `ax` (Platform.OS = 'ios'
// sous jest : ce sont les valeurs iOS des fonds translucides).
const MASTER_LIGHT: Omit<AppTheme, 'ax'> = {
    mode: 'light',
    background: '#ffffff',
    card: 'rgba(255,255,255,0.55)',
    cardBorder: 'rgba(255,255,255,0.55)',
    surface: 'rgba(255,255,255,0.40)',
    surfaceAlt: 'rgba(241,245,249,0.55)',
    primary: '#111827',
    primaryLight: '#374151',
    accent: '#94a3b8',
    accentDark: '#64748b',
    accentLight: '#cbd5e1',
    accentShadow: 'rgba(148,163,184,0.30)',
    onAccent: '#0a0a0a',
    accentText: '#475569',
    ctaBg: 'rgba(148,163,184,0.25)',
    ctaBorder: 'rgba(148,163,184,0.85)',
    ctaText: '#374151',
    secondary: '#6b7280',
    text: '#111827',
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    textMuted: '#646b78',
    border: 'rgba(148,163,184,0.20)',
    tabBar: 'rgba(255,255,255,0.85)',
    tabBarBorder: 'rgba(148,163,184,0.22)',
    tabBarActive: '#94a3b8',
    tabBarInactive: '#9ca3af',
    gold: '#A16207',
    silver: '#64748b',
    bronze: '#92400E',
    success: '#047857',
    error: '#DC2626',
    warning: '#B45309',
    shadow: 'rgba(0,0,0,0.06)',
    modalCard: '#ffffff',
    modalBackdrop: 'rgba(0,0,0,0.55)',
  };

const MASTER_DARK: Omit<AppTheme, 'ax'> = {
    mode: 'dark',
    background: '#0a0a0a',
    card: 'rgba(255,255,255,0.06)',
    cardBorder: 'rgba(255,255,255,0.12)',
    surface: 'rgba(255,255,255,0.04)',
    surfaceAlt: 'rgba(255,255,255,0.08)',
    primary: '#f9fafb',
    primaryLight: '#d1d5db',
    accent: '#10b981',
    accentDark: '#059669',
    accentLight: '#34d399',
    accentShadow: 'rgba(16,185,129,0.40)',
    onAccent: '#0a0a0a',
    accentText: '#34d399',
    ctaBg: 'rgba(16,185,129,0.25)',
    ctaBorder: 'rgba(16,185,129,0.8)',
    ctaText: '#ffffff',
    secondary: '#9ca3af',
    text: '#f9fafb',
    textPrimary: '#f9fafb',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    border: 'rgba(255,255,255,0.10)',
    tabBar: 'rgba(10,10,10,0.85)',
    tabBarBorder: 'rgba(16,185,129,0.20)',
    tabBarActive: '#10b981',
    tabBarInactive: '#6b7280',
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    success: '#10b981',
    error: '#f87171',
    warning: '#fbbf24',
    shadow: 'rgba(0,0,0,0.4)',
    modalCard: '#14161b',
    modalBackdrop: 'rgba(0,0,0,0.80)',
  };

describe('axTokens — valeurs Figma', () => {
  it('couleurs sombre et clair exactes', () => {
    expect(axColors).toStrictEqual(EXPECTED_COLORS);
  });

  it('rayons, espacements et verre exacts', () => {
    expect(axRadius).toStrictEqual({ control: 5, badge: 3, card: 8 });
    expect(axSpacing).toStrictEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24 });
    expect(axGlass).toStrictEqual({ glassBlur: 24 });
  });

  it('typographie exacte (13 styles)', () => {
    expect(axTypography).toStrictEqual(EXPECTED_TYPOGRAPHY);
  });
});

describe('axTokens — contraste AA', () => {
  const AA_TEXT = 4.5;
  const AA_NON_TEXT = 3;

  (['dark', 'light'] as const).forEach((mode) => {
    const c = axColors[mode];
    const pairs: [string, string, string, number][] = [
      ['text / background', c.text, c.background, AA_TEXT],
      ['text / surface', c.text, c.surface, AA_TEXT],
      ['textMuted / background', c.textMuted, c.background, AA_TEXT],
      ['textMuted / surface', c.textMuted, c.surface, AA_TEXT],
      ['accentText / background', c.accentText, c.background, AA_TEXT],
      ['accentText / surface', c.accentText, c.surface, AA_TEXT],
      ['onAccent / accent', c.onAccent, c.accent, AA_TEXT],
      ['danger / background', c.danger, c.background, AA_TEXT],
      ['warning / background', c.warning, c.background, AA_TEXT],
      ['success / background', c.success, c.background, AA_TEXT],
      ['info / background', c.info, c.background, AA_TEXT],
      ['fieldBorder / background', c.fieldBorder, c.background, AA_NON_TEXT],
    ];
    it.each(pairs)(`${mode} : %s ≥ seuil`, (_name, fg, bg, min) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  });
});

describe('palette — aucune valeur préexistante modifiée', () => {
  it('lightTheme hors ax identique à master, ax = couleurs claires', () => {
    const { ax, ...rest } = lightTheme;
    expect(rest).toStrictEqual(MASTER_LIGHT);
    expect(ax).toBe(axColors.light);
  });

  it('darkTheme hors ax identique à master, ax = couleurs sombres', () => {
    const { ax, ...rest } = darkTheme;
    expect(rest).toStrictEqual(MASTER_DARK);
    expect(ax).toBe(axColors.dark);
  });
});

describe('App.tsx — police Oswald', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');

  it('importe Oswald_500Medium depuis @expo-google-fonts/oswald', () => {
    expect(src).toMatch(/import\s*\{[^}]*\bOswald_500Medium\b[^}]*\}\s*from\s*'@expo-google-fonts\/oswald'/);
  });

  it('charge Oswald_500Medium dans useFonts', () => {
    const block = src.match(/useFonts\(\{([\s\S]*?)\}\)/);
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/\bOswald_500Medium\b/);
  });
});
