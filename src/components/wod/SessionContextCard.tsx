import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { AxButton, AxCard } from '../ax';
import { axSpacing, axTypography } from '../../theme/axTokens';

interface Props {
  label: string;
  title: string;
  subtitle?: string;
  testID: string;
  action?: { label: string; onPress: () => void; testID: string };
}

export default function SessionContextCard({ label, title, subtitle, testID, action }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <AxCard style={styles.card} testID={testID}>
      <View style={styles.content} testID={`${testID}-content`}>
        <Text style={[axTypography.overline, { color: c.textMuted }]}>{label}</Text>
        <Text style={[axTypography.label, { color: c.text }]}>{title}</Text>
        {!!subtitle && <Text style={[axTypography.bodySmall, { color: c.textMuted }]}>{subtitle}</Text>}
        {action && (
          <View style={styles.action}>
            <AxButton variant="outline" label={action.label} onPress={action.onPress} testID={action.testID} />
          </View>
        )}
      </View>
    </AxCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: axSpacing.lg, alignSelf: 'stretch', padding: 0 },
  content: { padding: 16, gap: axSpacing.xs },
  action: { marginTop: axSpacing.sm, maxWidth: '100%' },
});
