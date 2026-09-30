import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  size?: number;
  variant?: 'default' | 'emerald';
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

/** Tuile d'icône à fond uni `ax.surface`. */
export default function GlassIconBox({ size = 56, variant = 'default', children, style, radius = 18 }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const tinted = variant === 'emerald';
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: c.surface,
          borderColor: tinted ? c.accentText : c.border,
          borderWidth: 1,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
