import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function GlassBackground() {
  const { theme } = useTheme();
  return (
    <View
      testID="glass-background"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.ax.background }]}
    />
  );
}
