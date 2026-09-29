import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius } from '../../theme/axTokens';
import { AxGlass } from './AxGlass';

interface Props {
  icon: LucideIcon;
  onPress: () => void;
  /** Obligatoire : le bouton n'a pas de libellé visible. */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

/** Bouton carré 44 × 44. */
export function AxIconButton({ icon: Icon, onPress, accessibilityLabel, disabled = false, testID }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[styles.base, { borderColor: c.border }, disabled ? styles.disabled : null]}
    >
      <AxGlass color={c.surface} opacity={0.85} radius={axRadius.card} />
      <Icon size={18} color={c.text} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    borderRadius: axRadius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabled: { opacity: 0.5 },
});
