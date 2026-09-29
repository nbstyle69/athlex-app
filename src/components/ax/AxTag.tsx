import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';

export type AxTagTone = 'accent' | 'muted';

interface Props {
  label: string;
  tone?: AxTagTone;
  /** Encre imposée quand l'étiquette est posée hors des surfaces de l'app (fond du chrono). */
  color?: string;
  testID?: string;
}

/** Étiquette non interactive, en capitales. */
export function AxTag({ label, tone = 'accent', color: ink, testID }: Props) {
  const { theme } = useTheme();
  const color = ink ?? (tone === 'accent' ? theme.ax.accentText : theme.ax.textMuted);
  return (
    <View testID={testID} style={[styles.base, { borderColor: color }]}>
      <Text style={[axTypography.labelSmall, styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: axSpacing.xs,
    paddingHorizontal: axSpacing.sm,
    borderRadius: axRadius.badge,
    borderWidth: 1,
  },
  text: { textTransform: 'uppercase' },
});
