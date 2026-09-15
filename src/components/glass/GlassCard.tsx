import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** "default" = white-ish glass, "emerald" = tinted emerald glass */
  variant?: 'default' | 'emerald';
  /** Override blur intensity (0-100). Default 40 in light, 20 in dark. */
  intensity?: number;
  /** Override border radius. Default 16. */
  radius?: number;
  testID?: string;
}

/** Bordure 1 px à 15 % de blanc, commune aux deux thèmes. */
const GLASS_BORDER = 'rgba(255,255,255,0.15)';

/**
 * Glassmorphism card: blurred translucent background + 1 px white border + top-half reflection.
 * Adapts automatically to dark/light theme. On Android (no BlurView) the card falls back to
 * an opaque-ish fill (70 %) so it stays crisp without the blur cost.
 */
export default function GlassCard({ style, children, variant = 'default', intensity, radius = 16, testID }: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  const tint = isDark ? 'dark' : 'light';
  const blur = intensity ?? (isDark ? 20 : 40);
  const overlayColor =
    variant === 'emerald'
      ? (isDark ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.14)')
      : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.45)');
  const reflectionColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.55)';

  // ── Android : repli sans flou, fond à 70 % d'opacité ──
  if (Platform.OS === 'android') {
    const bg =
      variant === 'emerald'
        ? (isDark ? 'rgba(16,40,32,0.70)' : 'rgba(241,245,249,0.70)')
        : (isDark ? 'rgba(22,28,26,0.70)' : 'rgba(255,255,255,0.70)');
    return (
      <View
        testID={testID}
        style={[
          styles.shadowAndroid,
          { borderRadius: radius, backgroundColor: bg, borderColor: GLASS_BORDER, borderWidth: 1, overflow: 'hidden' },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // ── iOS / web : verre complet, flou + reflet ──
  return (
    <View
      testID={testID}
      style={[
        styles.shadow,
        { borderRadius: radius, shadowOpacity: isDark ? 0.3 : 0.08 },
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius: radius, borderColor: GLASS_BORDER, borderWidth: 1, flex: 1 }]}>
        <BlurView intensity={blur} tint={tint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
        {/* Top-half reflection */}
        <LinearGradient
          colors={[reflectionColor, 'rgba(255,255,255,0)']}
          style={[StyleSheet.absoluteFill, { height: '50%' }]}
          pointerEvents="none"
        />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    // Android elevation (subtle, glassmorphism doesn't really translate)
    elevation: 6,
  },
  shadowAndroid: {
    // Subtle elevation only — no white overlay, no double-shadow
    elevation: 3,
  },
  clip: {
    overflow: 'hidden',
  },
});
