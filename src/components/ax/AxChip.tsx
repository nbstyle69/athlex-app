import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axTypography } from '../../theme/axTokens';
import { AxGlass } from './AxGlass';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** Choix indisponible : non appuyable, libellé en textMuted. */
  disabled?: boolean;
  /** Rôle lu par les lecteurs d'écran : « tab » pour une barre d'onglets. */
  accessibilityRole?: 'button' | 'tab';
  /** Pastille compacte de largeur égale à ses voisines : partage la rangée en parts égales. */
  equal?: boolean;
  testID?: string;
}

/** Hauteur visuelle 9 + 20 + 9 + bordure 2 = 40 : 2 de marge tactile en haut et en bas. */
const HIT_SLOP = { top: 2, bottom: 2, left: 0, right: 0 };
/** Hauteur de la pastille : une rangée qui la comprime rogne le bas du libellé. */
export const AX_CHIP_HEIGHT = 9 + (axTypography.label.lineHeight ?? 20) + 9 + 2;

/** Pastille de filtre ou de choix. */
export function AxChip({ label, selected = false, onPress, disabled = false, accessibilityRole = 'button', equal = false, testID }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={disabled ? { selected, disabled } : { selected }}
      style={[styles.base, equal && styles.equal, { borderColor: selected ? 'transparent' : c.border }]}
    >
      {selected ? (
        <AxGlass color={c.accent} opacity={0.88} radius={axRadius.control} />
      ) : (
        <AxGlass color={c.text} opacity={0.08} radius={axRadius.control} />
      )}
      <Text numberOfLines={equal ? 1 : undefined} style={[axTypography.label, equal && styles.equalLabel, { color: selected ? c.onAccent : disabled ? c.textMuted : c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    minHeight: AX_CHIP_HEIGHT,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: axRadius.control,
    borderWidth: 1,
    overflow: 'hidden',
  },
  equal: { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignSelf: 'auto', minWidth: 0, paddingHorizontal: 4, alignItems: 'center' },
  equalLabel: { textAlign: 'center' },
});
