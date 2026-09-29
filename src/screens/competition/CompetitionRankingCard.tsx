/**
 * Carte « Classement » de l'écran Compétitions (refonte R3a) : rang, ELO et
 * palier de l'athlète, lien vers le Classement.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { AxCard } from '../../components/ax';
import { axSpacing, axTypography } from '../../theme/axTokens';

type Props = { rank: number | null; elo: number; level: string; onOpen: () => void };

export default function CompetitionRankingCard({ rank, elo, level, onOpen }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <View style={styles.wrap}>
      <AxCard onPress={onOpen} accessibilityLabel={t('competition.ranking.open')} testID="competition-ranking">
        <View style={styles.row}>
          <View style={styles.text}>
            <Text style={[axTypography.overline, { color: c.textMuted }]}>{t('competition.ranking.overline')}</Text>
            <Text testID="competition-ranking-summary" style={[axTypography.label, { color: c.text }]}>
              {t('competition.ranking.summary', { rank: rank ?? '—', elo, level: level.toUpperCase() })}
            </Text>
          </View>
          <View style={styles.see}>
            <Text style={[axTypography.labelSmall, { color: c.accentText }]}>{t('competition.ranking.see')}</Text>
            <ChevronRight size={16} color={c.accentText} />
          </View>
        </View>
      </AxCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: axSpacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
  text: { flex: 1, gap: axSpacing.xs },
  see: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, minHeight: 44 },
});
