import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** "default" = surface, "emerald" = surface teintée d'accent */
  variant?: 'default' | 'emerald';
  /** Conservé pour compatibilité ; le fond est opaque. */
  intensity?: number;
  /** Override border radius. Default 16. */
  radius?: number;
  testID?: string;
}

/** Carte à fond uni `ax.surface`, bordure `ax.border`. */
export default function GlassCard({ style, children, variant = 'default', radius = 16, testID }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const tinted = variant === 'emerald';
  return (
    <View
      testID={testID}
      style={[
        {
          borderRadius: radius,
          backgroundColor: c.surface,
          borderColor: tinted ? c.accentText : c.border,
          borderWidth: 1,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
