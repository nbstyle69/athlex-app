import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axAccentSafeLineHeight, axSpacing, axTypography } from '../../theme/axTokens';

interface Props {
  title: string;
  subtitle?: string;
  testID?: string;
}

export function AxPageHeader({ title, subtitle, testID }: Props) {
  const { theme } = useTheme();
  return (
    <View testID={testID} style={styles.base}>
      <Text accessibilityRole="header" style={[axTypography.titleXL, { lineHeight: axAccentSafeLineHeight.titleXL, color: theme.ax.text }]}>{title}</Text>
      {!!subtitle && <Text style={[axTypography.bodySmall, { color: theme.ax.textMuted }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { gap: axSpacing.xs, paddingHorizontal: axSpacing.xl },
});
