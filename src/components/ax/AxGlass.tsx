import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import { axGlass } from '../../theme/axTokens';
import { withAlpha } from './color';

/** Opacités des surfaces et barres, relevées sur Android faute de flou réel. */
const ANDROID_RAISED_OPACITIES = [0.8, 0.85];
const ANDROID_OPACITY = 0.96;

export function resolveGlassOpacity(opacity: number, os: string = Platform.OS): number {
  return os === 'android' && ANDROID_RAISED_OPACITIES.includes(opacity) ? ANDROID_OPACITY : opacity;
}

interface Props {
  /** Couleur de theme.ax (#RRGGBB). */
  color: string;
  opacity: number;
  /** Rayon du composant porteur. */
  radius: number;
  testID?: string;
}

/**
 * Calque de fond « verre » : à poser en premier enfant d'un composant.
 * iOS / web : flou d'arrière-plan + couleur translucide ; Android : couleur seule.
 */
export function AxGlass({ color, opacity, radius, testID = 'ax-glass' }: Props) {
  const { theme } = useTheme();
  const blur = Platform.OS !== 'android';
  return (
    <View
      pointerEvents="none"
      testID={testID}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
    >
      {blur && (
        <BlurView
          intensity={axGlass.glassBlur}
          tint={theme.mode === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View
        testID={`${testID}-fill`}
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(color, resolveGlassOpacity(opacity)) }]}
      />
    </View>
  );
}
