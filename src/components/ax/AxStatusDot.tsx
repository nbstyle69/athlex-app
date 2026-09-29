import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axSpacing, axTypography, type AxColors } from '../../theme/axTokens';

export type AxStatusTone = 'active' | 'muted' | 'danger' | 'warning';

export function statusColor(tone: AxStatusTone, c: AxColors): string {
  switch (tone) {
    case 'active': return c.accentText;
    case 'muted': return c.textMuted;
    case 'danger': return c.danger;
    case 'warning': return c.warning;
  }
}

interface Props {
  label: string;
  tone?: AxStatusTone;
  testID?: string;
}

export function AxStatusDot({ label, tone = 'active', testID }: Props) {
  const { theme } = useTheme();
  const color = statusColor(tone, theme.ax);
  return (
    <View testID={testID} style={styles.row}>
      <View testID={testID ? `${testID}-dot` : undefined} style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[axTypography.labelSmall, styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { textTransform: 'uppercase' },
});
