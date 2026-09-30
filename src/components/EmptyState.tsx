import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { AxButton } from './ax/AxButton';
import { axSpacing, axTypography } from '../theme/axTokens';

interface Props {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void; icon?: LucideIcon };
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** État vide du nouveau design : icône Lucide, titre titleM, texte bodySmall atténué, action AxButton. */
export default function EmptyState({ icon: Icon, title, text, action, style, testID = 'empty-state' }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <View testID={testID} style={[styles.box, style]}>
      <Icon testID={`${testID}-icon`} size={40} color={c.textMuted} strokeWidth={1.5} />
      <Text style={[axTypography.titleM, styles.center, { color: c.text }]}>{title}</Text>
      {!!text && <Text style={[axTypography.bodySmall, styles.center, { color: c.textMuted }]}>{text}</Text>}
      {action && (
        <View style={styles.action}>
          <AxButton label={action.label} onPress={action.onPress} icon={action.icon} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: axSpacing.sm, paddingHorizontal: axSpacing.xl, paddingVertical: axSpacing['2xl'] },
  center: { textAlign: 'center' },
  action: { marginTop: axSpacing.sm },
});
