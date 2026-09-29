import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axTypography } from '../../theme/axTokens';

/** Encre du badge : blanc fixé par la maquette, identique dans les deux thèmes. */
const BADGE_INK = '#FFFFFF';

export function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

interface Props {
  count: number;
  testID?: string;
}

export function AxCounterBadge({ count, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View testID={testID} style={[styles.base, { backgroundColor: theme.ax.danger }]}>
      <Text style={[axTypography.labelSmall, { color: BADGE_INK }]}>{formatCount(count)}</Text>
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
