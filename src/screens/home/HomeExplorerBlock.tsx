/**
 * Bloc « Explorer » de l'Accueil (refonte R2a) : les anciens contenus de
 * l'onglet Explorer, dans une carte ax. Le titre de section est posé par
 * `HomeScreen`, comme ses autres sections.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { AxCard } from '../../components/ax';
import { axSpacing, axTypography } from '../../theme/axTokens';

export type HomeExplorerRoute = 'BoxDirectory' | 'Programmation' | 'Partners';

const ROWS: { route: HomeExplorerRoute; labelKey: string }[] = [
  { route: 'BoxDirectory', labelKey: 'home.explorer.findBox' },
  { route: 'Programmation', labelKey: 'home.explorer.programs' },
  { route: 'Partners', labelKey: 'home.explorer.partners' },
];

export default function HomeExplorerBlock({ onOpen }: { onOpen: (route: HomeExplorerRoute) => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <AxCard testID="home-explorer" style={styles.card}>
      {ROWS.map(({ route, labelKey }, i) => (
        <View key={route}>
          {i > 0 && <View testID="home-explorer-divider" style={[styles.divider, { backgroundColor: c.border }]} />}
          <Pressable
            onPress={() => onOpen(route)}
            accessibilityRole="button"
            accessibilityLabel={t(labelKey)}
            style={styles.row}
            testID={`home-explorer-${route}`}
          >
            <Text style={[axTypography.label, styles.label, { color: c.text }]} numberOfLines={1}>{t(labelKey)}</Text>
            <ChevronRight size={18} color={c.textMuted} />
          </Pressable>
        </View>
      ))}
    </AxCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, minHeight: 48,
    paddingVertical: 14, paddingHorizontal: axSpacing.lg,
  },
  label: { flex: 1 },
  divider: { height: 1 },
});
