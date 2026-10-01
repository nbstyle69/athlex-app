import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { axAccentSafeLineHeight, axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { AxButton } from './AxButton';

interface Props {
  title: string;
  body: string;
  icon: LucideIcon;
  /** Bouton principal, sous le texte ; absent, la carte n'a que du texte. */
  action?: { label: string; icon?: LucideIcon; onPress: () => void; testID?: string };
  /** Ligne discrète en bas de la carte. */
  footer?: string;
  testID?: string;
}

/** Bandeau d'avertissement : surface bordée de la couleur d'alerte, titre et icône dans cette couleur. */
export function AxNotice({ title, body, icon: Icon, action, footer, testID }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.warning }]}
    >
      <View style={styles.head}>
        <Icon testID="ax-notice-icon" size={18} color={c.warning} strokeWidth={2} />
        <Text style={[styles.title, { color: c.warning }]}>{title}</Text>
      </View>
      <Text style={[axTypography.bodySmall, { color: c.textMuted }]}>{body}</Text>
      {action && (
        <AxButton
          testID={action.testID}
          label={action.label}
          icon={action.icon}
          onPress={action.onPress}
          fullWidth
        />
      )}
      {!!footer && (
        <Text style={[axTypography.caption, styles.footer, { color: c.textMuted }]}>{footer}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: axRadius.card, padding: axSpacing.lg, gap: axSpacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  // Oswald : « À » de « FORMULE À ACTIVER » ne doit pas être rogné.
  title: { ...axTypography.titleM, lineHeight: axAccentSafeLineHeight.titleM, flexShrink: 1 },
  footer: { textAlign: 'center' },
});
