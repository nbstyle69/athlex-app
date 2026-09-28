import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axTypography } from '../../theme/axTokens';
import { AxGlass } from './AxGlass';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

/** Hauteur visuelle 9 + 20 + 9 + bordure 2 = 40 : 2 de marge tactile en haut et en bas. */
const HIT_SLOP = { top: 2, bottom: 2, left: 0, right: 0 };

/** Pastille de filtre ou de choix. */
export function AxChip({ label, selected = false, onPress, testID }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.base, { borderColor: selected ? 'transparent' : c.border }]}
    >
      {selected ? (
        <AxGlass color={c.accent} opacity={0.88} radius={axRadius.control} />
      ) : (
        <AxGlass color={c.text} opacity={0.08} radius={axRadius.control} />
      )}
      <Text style={[axTypography.label, { color: selected ? c.onAccent : c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: axRadius.control,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
