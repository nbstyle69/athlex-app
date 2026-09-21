import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import GlassCard from '../glass/GlassCard';

interface Props {
  label: string;
  title: string;
  subtitle?: string;
  testID: string;
  action?: { label: string; onPress: () => void; testID: string };
}

export default function SessionContextCard({ label, title, subtitle, testID, action }: Props) {
  const { theme } = useTheme();
  return (
    <GlassCard radius={14} style={styles.card} testID={testID}>
      <View style={styles.content} testID={`${testID}-content`}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
        {action && (
          <TouchableOpacity
            style={[styles.button, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={action.onPress}
            activeOpacity={0.8}
            testID={action.testID}
          >
            <Text style={[styles.buttonText, { color: theme.text }]}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16, alignSelf: 'stretch' },
  content: { padding: 16 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '800', marginTop: 6, lineHeight: 22 },
  subtitle: { fontSize: 13, marginTop: 6, lineHeight: 19 },
  button: {
    alignSelf: 'flex-start', maxWidth: '100%', marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
  },
  buttonText: { fontSize: 13, fontWeight: '600' },
});
