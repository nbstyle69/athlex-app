import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, axVeil } from '../../theme/axTokens';

export type AxTagTone = 'accent' | 'muted' | 'danger' | 'success' | 'warning';

interface Props {
  label: string;
  tone?: AxTagTone;
  /** Encre imposée quand l'étiquette est posée hors des surfaces de l'app (fond du chrono). */
  color?: string;
  /** Point plein avant le libellé (ex. enregistrement en cours). */
  dot?: boolean;
  /** Posée sur l'image de la caméra : voile sombre, texte clair. */
  veil?: boolean;
  /** Libellé long : retour à la ligne dans la largeur du parent. */
  wrap?: boolean;
  /** Libellé long (nom de séance…) : coupé à ce nombre de lignes, dans la largeur disponible. */
  numberOfLines?: number;
  testID?: string;
}

/** Étiquette non interactive, en capitales. */
export function AxTag({ label, tone = 'accent', color: ink, dot = false, veil = false, wrap = false, numberOfLines, testID }: Props) {
  const { theme } = useTheme();
  const toneColor = tone === 'danger'
    ? (veil ? axVeil.rec : theme.ax.danger)
    : tone === 'accent' ? theme.ax.accentText
    : tone === 'success' ? theme.ax.success
    : tone === 'warning' ? theme.ax.warning : theme.ax.textMuted;
  const color = ink ?? (veil ? axVeil.ink : toneColor);
  const edge = ink ?? (veil && tone !== 'danger' ? axVeil.border : toneColor);
  return (
    <View testID={testID} style={[styles.base, { borderColor: edge }, veil ? { backgroundColor: axVeil.background } : null, wrap || numberOfLines ? styles.bounded : null]}>
      {dot && <View testID={testID ? `${testID}-dot` : undefined} style={[styles.dot, { backgroundColor: toneColor }]} />}
      <Text
        numberOfLines={numberOfLines}
        style={[axTypography.labelSmall, styles.text, { color }, wrap || numberOfLines ? styles.shrink : null]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: axSpacing.xs,
    paddingVertical: axSpacing.xs,
    paddingHorizontal: axSpacing.sm,
    borderRadius: axRadius.badge,
    borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { textTransform: 'uppercase' },
  shrink: { flexShrink: 1 },
  bounded: { maxWidth: '100%' },
});
