import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { AxGlass } from './AxGlass';

interface Props {
  dayLabel: string;
  dayNumber: number | string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

/** Jour d'un sélecteur de semaine (44 × 58). */
export function AxDayItem({ dayLabel, dayNumber, selected = false, onPress, testID }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const ink = selected ? c.onAccent : undefined;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dayLabel} ${dayNumber}`}
      accessibilityState={{ selected }}
      style={[styles.base, selected ? { backgroundColor: c.accent } : null]}
    >
      {!selected && <AxGlass color={c.text} opacity={0.08} radius={axRadius.control} />}
      <Text style={[axTypography.overlineSmall, { color: ink ?? c.textMuted }]}>{dayLabel}</Text>
      <Text style={[axTypography.numberM, { color: ink ?? c.text }]}>{dayNumber}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 58,
    borderRadius: axRadius.control,
    paddingVertical: axSpacing.sm,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
