import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axTypography } from '../../theme/axTokens';
import { contrast } from '../../theme/contrast';

/** Encre du badge : blanc fixé par la maquette, identique dans les deux thèmes. */
const BADGE_INK = '#FFFFFF';

export function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

interface Props {
  count: number;
  /** Encre la plus lisible sur le fond du badge (blanc ou fond de l'app) au lieu du blanc fixe. */
  readableInk?: boolean;
  testID?: string;
}

export function AxCounterBadge({ count, readableInk = false, testID }: Props) {
  const { theme } = useTheme();
  const bg = theme.ax.danger;
  const ink = readableInk && contrast(theme.ax.background, bg) > contrast(BADGE_INK, bg) ? theme.ax.background : BADGE_INK;
  return (
    <View testID={testID} style={[styles.base, { backgroundColor: bg }]}>
      <Text style={[axTypography.labelSmall, { color: ink }]}>{formatCount(count)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    borderRadius: 9,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
});
