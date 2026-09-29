import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axVeil } from '../../theme/axTokens';
import { AxGlass } from './AxGlass';

interface Props {
  icon: LucideIcon;
  onPress: () => void;
  /** Obligatoire : le bouton n'a pas de libellé visible. */
  accessibilityLabel: string;
  disabled?: boolean;
  radius?: number;
  /** Bouton rond posé sur l'image de la caméra : voile sombre et icône claire. */
  veil?: boolean;
  testID?: string;
}

/** Bouton carré 44 × 44. */
export function AxIconButton({ icon: Icon, onPress, accessibilityLabel, disabled = false, radius: r, veil = false, testID }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const radius = r ?? (veil ? 22 : axRadius.card);
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[styles.base, { borderColor: veil ? axVeil.border : c.border, borderRadius: radius },
        veil ? { backgroundColor: axVeil.background } : null, disabled ? styles.disabled : null]}
    >
      {!veil && <AxGlass color={c.surface} opacity={0.85} radius={radius} />}
      <Icon size={18} color={veil ? axVeil.ink : c.text} strokeWidth={2} />
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
