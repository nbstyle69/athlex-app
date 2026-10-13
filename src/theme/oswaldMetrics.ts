/**
 * Mesures natives d'Oswald Medium, lues dans le fichier embarqué
 * (@expo-google-fonts/oswald/500Medium/Oswald_500Medium.ttf, tables head / hhea / OS/2 / glyf / hmtx ;
 * parité vérifiée par oswaldMetrics.test.ts) : ascendante 1193, descendante -289, interligne 0
 * (OS/2 typo identiques, USE_TYPO_METRICS), ligne native 1,482 em ; les chiffres vont de -12 à 820.
 * Chasses des caractères que peut afficher le score géant de « Partager ma perf ».
 */
export const OSWALD_MEDIUM = {
  unitsPerEm: 1000, ascender: 1193, descender: -289, lineGap: 0,
  digitTop: 820, digitBottom: -12,
  advances: {
    '0': 534, '1': 382, '2': 497, '3': 496, '4': 504, '5': 493, '6': 521, '7': 413, '8': 510, '9': 521,
    ':': 239, '.': 217, C: 540, A: 522, P: 527,
  } as Record<string, number>,
  /** Chasse retenue pour un caractère absent de la liste : plus large que tous ceux-ci. */
  fallbackAdvance: 600,
} as const;
