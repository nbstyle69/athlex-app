import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, AppTheme } from '../../context/ThemeContext';

// Couleurs WOD types adaptées au thème
export function getTypeColors(theme: AppTheme): Record<string, string> {
  return {
    'for-time': theme.error,      // Rouge
    amrap: '#3B82F6',             // Bleu
    emom: '#8B5CF6',             // Violet
    tabata: theme.warning,        // Orange
    strength: theme.success,      // Vert
    generated: theme.accent,      // Généré par AthleX
    custom: theme.textMuted,      // Gris
  };
}

const S = StyleSheet.create({
  typeBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.5 },
});

export default function WodTypeBadge({
  type,
  label,
  color: colorOverride,
}: {
  type?: string;
  label?: string;
  color?: string;
}) {
  const { theme } = useTheme();
  const colors = getTypeColors(theme);
  const color = colorOverride ?? colors[type ?? 'custom'] ?? theme.textMuted;
  return (
    <View style={[S.typeBadge, { backgroundColor: theme.mode === 'dark' ? `${color}25` : `${color}15` }]}>
      <Text style={[S.typeBadgeText, { color }]}>{(label ?? type ?? 'custom').toUpperCase()}</Text>
    </View>
  );
}
