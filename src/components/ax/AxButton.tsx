import React, { useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, axVeil, type AxColors } from '../../theme/axTokens';
import { AxGlass } from './AxGlass';

export type AxButtonVariant = 'accent' | 'outline' | 'light' | 'dashed' | 'stop';

interface Props {
  label: string;
  onPress: () => void;
  variant?: AxButtonVariant;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Encre du contour posé hors des surfaces de l'app (fond du chrono) : texte, icône et filet. */
  ink?: string;
  /** Posé sur l'image de la caméra : voile sombre et encre claire. */
  veil?: boolean;
  /** Libellé lu par le lecteur d'écran quand il diffère du texte affiché. */
  accessibilityLabel?: string;
  /** Nombre de lignes du libellé (1 : jamais replié sur deux lignes). */
  numberOfLines?: number;
  testID?: string;
}

interface VariantStyle {
  glass?: { color: string; opacity: number };
  background?: string;
  border?: { width: number; color: string };
  dashed?: string;
  foreground: string;
}

export function axButtonStyle(variant: AxButtonVariant, c: AxColors): VariantStyle {
  switch (variant) {
    case 'accent':
      // Action principale uniquement.
      return { glass: { color: c.accent, opacity: 0.88 }, foreground: c.onAccent };
    case 'outline':
      return { glass: { color: c.text, opacity: 0.08 }, border: { width: 1, color: c.border }, foreground: c.text };
    case 'light':
      return { background: c.text, foreground: c.background };
    case 'dashed':
      return { dashed: c.accentText, foreground: c.accentText };
    case 'stop':
      // Réservé à l'arrêt et au danger.
      return { glass: { color: c.danger, opacity: 0.12 }, border: { width: 1, color: c.danger }, foreground: c.danger };
  }
}

function veilButtonStyle(variant: AxButtonVariant, c: AxColors): VariantStyle {
  if (variant === 'accent') return axButtonStyle('accent', c);
  if (variant === 'stop') return { background: axVeil.stop, foreground: axVeil.ink };
  return { background: axVeil.background, border: { width: 1, color: axVeil.border }, foreground: axVeil.ink };
}

const DASH_WIDTH = 1.5;

export function AxButton({
  label, onPress, variant = 'accent', icon: Icon, disabled = false, loading = false, fullWidth = false, ink, veil = false, accessibilityLabel, numberOfLines, testID,
}: Props) {
  const { theme } = useTheme();
  const base = axButtonStyle(variant, theme.ax);
  const v: VariantStyle = veil ? veilButtonStyle(variant, theme.ax) : ink && variant === 'outline'
    ? { glass: { color: ink, opacity: 0.08 }, border: { width: 1, color: ink }, foreground: ink }
    : base;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const inactive = disabled || loading;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <Pressable
      testID={testID}
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onLayout={v.dashed ? onLayout : undefined}
      style={[
        styles.base,
        { alignSelf: fullWidth ? 'stretch' : 'flex-start' },
        v.background ? { backgroundColor: v.background } : null,
        v.border ? { borderWidth: v.border.width, borderColor: v.border.color } : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {v.glass && <AxGlass color={v.glass.color} opacity={v.glass.opacity} radius={axRadius.control} />}
      {v.dashed && size.width > 0 && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={size.width} height={size.height}>
            <Rect
              testID="ax-button-dash"
              x={DASH_WIDTH / 2}
              y={DASH_WIDTH / 2}
              width={size.width - DASH_WIDTH}
              height={size.height - DASH_WIDTH}
              rx={axRadius.control}
              fill="none"
              stroke={v.dashed}
              strokeWidth={DASH_WIDTH}
              strokeDasharray="6 5"
            />
          </Svg>
        </View>
      )}
      {loading ? (
        <ActivityIndicator testID="ax-button-loading" size="small" color={v.foreground} />
      ) : (
        Icon && <Icon testID="ax-button-icon" size={16} color={v.foreground} strokeWidth={2} />
      )}
      <Text numberOfLines={numberOfLines} style={[axTypography.label, styles.label, { color: v.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: axSpacing.sm,
    paddingVertical: 13,
    paddingHorizontal: axSpacing.lg,
    borderRadius: axRadius.control,
    overflow: 'hidden',
  },
  label: { textAlign: 'center', flexShrink: 1 },
  disabled: { opacity: 0.5 },
});
