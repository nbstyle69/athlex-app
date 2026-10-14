import { PixelRatio, Platform } from 'react-native';

/**
 * Mesures natives d'Oswald Medium, lues dans le fichier embarqué
 * (@expo-google-fonts/oswald/500Medium/Oswald_500Medium.ttf, tables head / hhea / OS/2 / glyf / hmtx ;
 * parité vérifiée par oswaldMetrics.test.ts) : ascendante 1193, descendante -289, interligne 0
 * (OS/2 typo identiques, USE_TYPO_METRICS), ligne native 1,482 em ; les chiffres vont de -12 à 820,
 * hauteur des capitales 810 (OS/2 sCapHeight).
 * Chasses des caractères que peut afficher le score géant de « Partager ma perf ».
 */
export const OSWALD_MEDIUM = {
  unitsPerEm: 1000, ascender: 1193, descender: -289, lineGap: 0, capHeight: 810,
  digitTop: 820, digitBottom: -12,
  advances: {
    '0': 534, '1': 382, '2': 497, '3': 496, '4': 504, '5': 493, '6': 521, '7': 413, '8': 510, '9': 521,
    ':': 239, '.': 217, C: 540, A: 522, P: 527,
  } as Record<string, number>,
  /** Chasse retenue pour un caractère absent de la liste : plus large que tous ceux-ci. */
  fallbackAdvance: 600,
} as const;

const { unitsPerEm, ascender, descender, lineGap, capHeight } = OSWALD_MEDIUM;
/** Ligne native d'Oswald Medium, en em (1,482). */
export const OSWALD_MEDIUM_LINE_EM = (ascender - descender + lineGap) / unitsPerEm;
/**
 * Décalage, en em, du milieu du glyphe (ligne de base − capHeight / 2) au milieu de la ligne
 * native : négatif, le glyphe est sous le milieu de sa boîte de ligne.
 */
export const OSWALD_MEDIUM_CENTER_SHIFT_EM = ((ascender - descender + lineGap) / 2 - (ascender - capHeight / 2)) / unitsPerEm;

/**
 * Décalage (dp) qui amène le milieu du glyphe (ligne de base − capHeight / 2) au milieu de la
 * boîte de ligne, pour une ligne au moins aussi haute que la ligne native. iOS centre la ligne
 * native en flottants (RCTApplyBaselineOffsetForRange). Android (React Native 0.81) arrondit :
 * police en px entiers vers le haut (TextAttributeProps), ligne vers le haut (CustomLineHeightSpan),
 * ascendante et descendante au px (getFontMetricsInt), demi-interligne vers le haut au-dessus ;
 * modèle vérifié sur les relevés natifs de l'émulateur (onTextLayout).
 */
export function oswaldMediumCenterShift(fontSize: number, line: number, os: string, density: number, fontScale: number): number {
  if (os !== 'android') return fontSize * fontScale * OSWALD_MEDIUM_CENTER_SHIFT_EM;
  const f = Math.ceil(fontSize * density * fontScale), L = Math.ceil(line * density * fontScale);
  const asc = Math.round((ascender * f) / unitsPerEm), desc = Math.round((-descender * f) / unitsPerEm);
  const baseline = asc + Math.ceil((L - asc - desc) / 2);
  return (L / 2 - (baseline - (capHeight * f) / unitsPerEm / 2)) / density;
}

/**
 * Chiffre Oswald Medium centré par son glyphe, à la même place sur iOS et Android : une ligne
 * native entière (les deux plateformes y centrent la ligne de la police), remontée par
 * `transform` de oswaldMediumCenterShift.
 */
export function oswaldMediumCentered(fontSize: number) {
  const line = Math.ceil(fontSize * OSWALD_MEDIUM_LINE_EM);
  const shift = oswaldMediumCenterShift(fontSize, line, Platform.OS, PixelRatio.get(), PixelRatio.getFontScale());
  return {
    fontSize, lineHeight: line, includeFontPadding: false, textAlignVertical: 'center' as const,
    transform: [{ translateY: shift }],
  };
}
