import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/** Fond de la barre d'onglets : `ax.surface` uni, filet `ax.border` en haut. */
export default function GlassTabBarBackground() {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surface }]}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: c.border }}
      />
    </View>
  );
}
