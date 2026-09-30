import { axColors, type AxColors } from './axTokens';

export type ThemeMode = 'light' | 'dark';

export interface AppTheme {
  mode: ThemeMode;
  background: string;
  card: string;
  cardBorder: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  primaryLight: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  accentShadow: string;
  /**
   * Encre posée SUR un aplat d'accent (bouton plein, segment sélectionné).
   * `#fff` y donnait 2,5:1 dans les deux thèmes : l'accent est un ton moyen,
   * ni assez clair ni assez sombre pour porter du blanc.
   */
  onAccent: string;
  /**
   * Accent utilisé EN TEXTE sur le fond ou une carte. En clair, `accent` y
   * tombe à 2,5:1 — il faut une déclinaison plus sombre ; en sombre, la teinte
   * d'origine tient.
   */
  accentText: string;
  /** Aplat et bordure des boutons d'action principaux. */
  ctaBg: string;
  ctaBorder: string;
  /** Encre du bouton plein (`EmeraldCTAButton`), posée sur `ctaBg`. */
  ctaText: string;
  secondary: string;
  text: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  gold: string;
  silver: string;
  bronze: string;
  success: string;
  error: string;
  warning: string;
  shadow: string;
  modalCard: string;
  modalBackdrop: string;
  /** Couleurs du nouveau design ; les champs ci-dessus en sont dérivés. */
  ax: AxColors;
}

/**
 * Les champs historiques sont dérivés des jetons `ax` : un écran qui lit encore
 * `theme.background`, `theme.card` ou `theme.accent` peint la palette du nouveau
 * design. `accent` sert à la fois d'aplat et de texte dans les écrans existants :
 * en clair il prend `accentText` (lisible sur le fond) et porte une encre
 * blanche ; en sombre la menthe tient les deux rôles avec l'encre `onAccent`.
 */
function fromAx(mode: ThemeMode, ax: AxColors, medals: Pick<AppTheme, 'gold' | 'silver' | 'bronze'>): AppTheme {
  const dark = mode === 'dark';
  const accent = dark ? ax.accent : ax.accentText;
  return {
    mode,
    background: ax.background,
    card: ax.surface,
    cardBorder: ax.border,
    surface: ax.surface,
    surfaceAlt: ax.field,
    primary: ax.text,
    primaryLight: ax.textMuted,
    accent,
    accentDark: ax.accentText,
    accentLight: accent,
    accentShadow: dark ? 'rgba(154,230,210,0.30)' : 'rgba(23,107,87,0.25)',
    onAccent: dark ? ax.onAccent : '#FFFFFF',
    accentText: ax.accentText,
    ctaBg: ax.accent,
    ctaBorder: ax.accent,
    ctaText: ax.onAccent,
    secondary: ax.textMuted,
    text: ax.text,
    textPrimary: ax.text,
    textSecondary: ax.textMuted,
    textMuted: ax.textMuted,
    border: ax.border,
    tabBar: ax.surface,
    tabBarBorder: ax.border,
    tabBarActive: ax.accentText,
    tabBarInactive: ax.textMuted,
    ...medals,
    success: ax.success,
    error: ax.danger,
    warning: ax.warning,
    shadow: dark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)',
    modalCard: ax.surface,
    modalBackdrop: dark ? 'rgba(0,0,0,0.80)' : 'rgba(0,0,0,0.55)',
    ax,
  };
}

// Médailles : teintes de domaine, déclinées pour le fond clair où leur variante
// vive n'atteint pas le seuil de lecture.
export const lightTheme: AppTheme = fromAx('light', axColors.light, {
  gold: '#A16207',
  silver: '#64748b',
  bronze: '#92400E',
});

export const darkTheme: AppTheme = fromAx('dark', axColors.dark, {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
});
