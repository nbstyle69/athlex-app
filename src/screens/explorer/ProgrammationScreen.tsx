import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxCard } from '../../components/ax';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Building2, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { HomeStackParamList } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

export default function ProgrammationScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const c = theme.ax;
  const s = createStyles(c);

  return (
    <View style={s.container}>
      <GlassBackground />
      <AxScreenHeader title={t('home.explorer.programs')}>
          <Text style={s.headerSub}>{t('explorer.programmation.subtitle')}</Text>
      </AxScreenHeader>

      <View style={s.content}>
        {/* Programmes des Boxes */}
        <AxCard
          style={s.categoryBtn}
          onPress={() => navigation.navigate('BoxPrograms')}
          accessibilityLabel={t('explorer.programs.title')}
          testID="programmation-box-programs"
        >
          <View style={s.categoryIcon}>
            <Building2 color={c.accentText} size={24} />
          </View>
          <View style={s.categoryContent}>
            <Text style={s.categoryTitle}>{t('explorer.programs.title')}</Text>
            <Text style={s.categoryDesc}>{t('explorer.programmation.boxProgramsDesc')}</Text>
          </View>
          <ChevronRight color={c.textMuted} size={20} />
        </AxCard>
      </View>
    </View>
  );
}

function createStyles(c: AxColors) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  headerSub: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: axSpacing.xl, paddingTop: axSpacing['2xl'], gap: axSpacing.md },
  categoryBtn: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.lg },
  categoryIcon: {
    width: 52, height: 52, borderRadius: axRadius.card,
    backgroundColor: c.field, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  categoryContent: { flex: 1, minWidth: 0, gap: axSpacing.xs },
  categoryTitle: { ...axTypography.titleM, color: c.text },
  categoryDesc: { ...axTypography.bodySmall, color: c.textMuted },
}); }
