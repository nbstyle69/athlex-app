/**
 * Bloc « Explorer » de l'Accueil (refonte R2a) : les anciens contenus de
 * l'onglet Explorer, dans une carte ax. Le titre de section est posé par
 * `HomeScreen`, comme ses autres sections.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronRight, Handshake, MapPin, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { AxCard } from '../../components/ax';
import { axSpacing, axTypography } from '../../theme/axTokens';

export type HomeExplorerRoute = 'BoxDirectory' | 'Programmation' | 'Partners';

const ROWS: { route: HomeExplorerRoute; labelKey: string; Icon: LucideIcon }[] = [
  { route: 'BoxDirectory', labelKey: 'home.explorer.findBox', Icon: MapPin },
  { route: 'Programmation', labelKey: 'home.explorer.programs', Icon: BookOpen },
  { route: 'Partners', labelKey: 'home.explorer.partners', Icon: Handshake },
];

export default function HomeExplorerBlock({ onOpen }: { onOpen: (route: HomeExplorerRoute) => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <AxCard testID="home-explorer">
      {ROWS.map(({ route, labelKey, Icon }, i) => (
        <View key={route}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: c.border }]} />}
          <Pressable
            onPress={() => onOpen(route)}
            accessibilityRole="button"
            accessibilityLabel={t(labelKey)}
            style={styles.row}
            testID={`home-explorer-${route}`}
          >
            <Icon size={18} color={c.accentText} />
            <Text style={[axTypography.label, styles.label, { color: c.text }]}>{t(labelKey)}</Text>
            <ChevronRight size={18} color={c.textMuted} />
          </Pressable>
        </View>
      ))}
    </AxCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, minHeight: 44 },
  label: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 10 },
});
