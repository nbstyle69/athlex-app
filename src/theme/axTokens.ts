import type { TextStyle } from 'react-native';

/**
 * Jetons du nouveau design AthleX (refonte visuelle).
 * Source : Figma, collections « AthleX — Couleurs » et « AthleX — Dimensions ».
 * Aucun écran ne les consomme encore : ils sont posés en fondation (lot R0).
 */

export interface AxColors {
  background: string;
  surface: string;
  /** Fond des champs de saisie. */
  field: string;
  text: string;
  textMuted: string;
  accent: string;
  /** Encre posée sur un aplat d'accent. */
  onAccent: string;
  /** Accent utilisé comme texte sur le fond ou une surface. */
  accentText: string;
  border: string;
  fieldBorder: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  orange: string;
  violet: string;
}

export const axColors: { dark: AxColors; light: AxColors } = {
  dark: {
    background: '#101214',
    surface: '#1C2023',
    field: '#101214',
    text: '#F2F4F4',
    textMuted: '#989FA3',
    accent: '#9AE6D2',
    onAccent: '#101214',
    accentText: '#9AE6D2',
    border: 'rgba(242,244,244,0.12)',
    fieldBorder: '#6B7772',
    danger: '#F87171',
    warning: '#FBBF24',
    success: '#4ADE80',
    info: '#60A5FA',
    orange: '#F97316',
    violet: '#C084FC',
  },
  light: {
    background: '#F3F5F4',
    surface: '#FFFFFF',
    field: '#F3F5F4',
    text: '#17201D',
    textMuted: '#52605B',
    accent: '#9AE6D2',
    onAccent: '#101214',
    accentText: '#176B57',
    border: '#D1DAD6',
    fieldBorder: '#78867F',
    danger: '#B91C1C',
    warning: '#92400E',
    success: '#166534',
    info: '#1D4ED8',
    orange: '#9A3412',
    violet: '#6D28D9',
  },
};

/** Voile posé sur l'image de la caméra : encre claire lisible (AA) même sur une image blanche. */
export const axVeil = {
  background: 'rgba(0,0,0,0.6)',
  ink: '#F2F4F4',
  border: 'rgba(242,244,244,0.3)',
  rec: '#F87171',
  stop: '#B91C1C',
  /** Voile plus dense du décompte caméra. */
  countdown: 'rgba(0,0,0,0.75)',
  /** Fond le plus clair que donne ce voile (posé sur une image blanche) : base du contraste du décompte. */
  countdownFloor: '#404040',
} as const;

export const axRadius = {
  /** Boutons, champs, pastilles. */
  control: 5,
  badge: 3,
  card: 8,
} as const;

export const axSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
} as const;

/**
 * Verre : seul le flou est fixé ici. Le fond translucide et le repli Android
 * seront définis au lot R1.
 */
export const axGlass = {
  glassBlur: 24,
} as const;

/** Familles telles que chargées par expo-font (App.tsx). */
export const axFonts = {
  oswaldMedium: 'Oswald_500Medium',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
} as const;

export type AxTypographyName =
  | 'titleXL'
  | 'titleL'
  | 'titleM'
  | 'numberL'
  | 'numberM'
  | 'overline'
  | 'overlineSmall'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label'
  | 'labelSmall'
  | 'tab';

type AxTextStyle = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'
>;

/**
 * Interlignes des titres Oswald qui laissent passer les capitales accentuées
 * (« É » monte à 1,066 em, la descente à 0,289 em) : ceil(taille × 1,355).
 * iOS et Android posent la ligne de base en bas de la boîte et rognent ce qui
 * dépasse en haut ; avec l'interligne de base, l'accent d'« É » est coupé.
 */
export const axAccentSafeLineHeight = { titleXL: 47, titleL: 36, titleM: 28 } as const;

export const axTypography: Record<AxTypographyName, AxTextStyle> = {
  titleXL: { fontFamily: axFonts.oswaldMedium, fontSize: 34, lineHeight: 38, letterSpacing: -1, textTransform: 'uppercase' },
  titleL: { fontFamily: axFonts.oswaldMedium, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, textTransform: 'uppercase' },
  titleM: { fontFamily: axFonts.oswaldMedium, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, textTransform: 'uppercase' },
  numberL: { fontFamily: axFonts.oswaldMedium, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  numberM: { fontFamily: axFonts.oswaldMedium, fontSize: 24, lineHeight: 28, letterSpacing: 0 },
  overline: { fontFamily: axFonts.interMedium, fontSize: 12, lineHeight: 16, letterSpacing: 2, textTransform: 'uppercase' },
  overlineSmall: { fontFamily: axFonts.interMedium, fontSize: 9, lineHeight: 12, letterSpacing: 1, textTransform: 'uppercase' },
  body: { fontFamily: axFonts.interRegular, fontSize: 15, lineHeight: 24 },
  bodySmall: { fontFamily: axFonts.interRegular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: axFonts.interRegular, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: axFonts.interSemiBold, fontSize: 14, lineHeight: 20 },
  labelSmall: { fontFamily: axFonts.interSemiBold, fontSize: 12, lineHeight: 16 },
  tab: { fontFamily: axFonts.interSemiBold, fontSize: 10, lineHeight: 12, letterSpacing: 0.2 },
};
