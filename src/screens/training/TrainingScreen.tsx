/**
 * Onglet « Entraînement » (refonte R2a) : génération en un tap, outils et
 * dernière séance. Construit avec `src/components/ax` et `theme.ax`.
 * La génération passe par le même service que `WodGeneratorScreen`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Calculator, ChevronRight, Heart, History, RotateCcw, Timer, type LucideIcon } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AxButton, AxCard, AxChip, AxPageHeader } from '../../components/ax';
import { axSpacing, axTypography } from '../../theme/axTokens';
import type { TrainingStackParamList } from '../../navigation';
import type { Catalog, Entry, MuscuEquipment } from '../../../packages/wod-engine/src';
import { loadEngineData } from '../../services/wodEngineData';
import { saveWodDraft } from '../../services/wodDraft';
import { generateForUser, loadAdaptToPr, loadExcludes, loadMuscuEquipment } from '../../services/wodGenerator';
import { quickScreenParams, Sport } from './quickGenerate';
import { daysAgo, LastSession, loadLastSession } from './lastSession';

type Nav = NativeStackNavigationProp<TrainingStackParamList, 'TrainingMain'>;

const ENTRIES: { key: Entry; labelKey: string }[] = [
  { key: 'express', labelKey: 'training.generate.express' },
  { key: 'after_class', labelKey: 'training.generate.afterClass' },
];
const SPORTS: Sport[] = ['functional', 'hybrid', 'musculation'];

export default function TrainingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, currentBox } = useAuth();
  const { theme } = useTheme();
  const c = theme.ax;

  const [entry, setEntry] = useState<Entry>('express');
  const [sport, setSport] = useState<Sport>('functional');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [exclude, setExclude] = useState<string[]>([]);
  const [adaptToPr, setAdaptToPr] = useState(true);
  const [muscuEquipment, setMuscuEquipment] = useState<MuscuEquipment>('box');
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [last, setLast] = useState<LastSession | null>(null);

  useEffect(() => {
    let alive = true;
    setReady(false);
    loadEngineData().then((d) => { if (alive) setCatalog(d.catalog); }).catch(() => {});
    if (!user?.id) return () => { alive = false; };
    Promise.all([loadExcludes(user.id), loadAdaptToPr(user.id), loadMuscuEquipment(user.id)])
      .then(([ex, adapt, eq]) => {
        if (!alive) return;
        setExclude(ex);
        setAdaptToPr(adapt);
        setMuscuEquipment(eq);
        setReady(true);
      })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    if (user) {
      loadLastSession(user, exclude)
        .then((s) => { if (alive) setLast(s); })
        .catch(() => { if (alive) setLast(null); });
    } else setLast(null);
    return () => { alive = false; };
  }, [user, exclude]));

  async function generate() {
    if (!user || !ready) return;
    setGenerating(true);
    const screen = quickScreenParams(entry, sport, { exclude, adaptToPr, muscuEquipment }, user, catalog);
    try {
      const result = await generateForUser(user, currentBox?.id, screen);
      await saveWodDraft(user.id, { screen, result });
      navigation.navigate('WodResult', { screen, result });
    } catch (e) {
      const muscu = sport === 'musculation';
      Alert.alert(
        t(muscu ? 'training.generate.noValidSessionTitle' : 'training.generate.noValidWodTitle'),
        t(muscu ? 'training.generate.noValidSessionBody' : 'training.generate.noValidWodBody'),
      );
    } finally {
      setGenerating(false);
    }
  }

  const tools: { key: string; label: string; Icon: LucideIcon; onPress: () => void }[] = [
    { key: 'timer', label: t('training.tools.timer'), Icon: Timer, onPress: () => navigation.navigate('Timer') },
    { key: 'onerm', label: t('training.tools.oneRm'), Icon: Calculator, onPress: () => navigation.navigate('OneRMCalculator') },
    { key: 'history', label: t('training.tools.history'), Icon: History, onPress: () => navigation.navigate('WodHistory') },
    { key: 'favorites', label: t('training.tools.favorites'), Icon: Heart, onPress: () => navigation.navigate('WodHistory', { filter: 'favorites' }) },
  ];

  const lastMeta = last ? [
    t(`training.disciplines.${last.discipline}`),
    relativeDay(t, daysAgo(last.date)),
    last.score ? t('training.last.score', { score: last.score }) : null,
  ].filter(Boolean).join(' · ') : '';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingTop: insets.top + axSpacing.lg, paddingBottom: insets.bottom + 120 }}
      showsVerticalScrollIndicator={false}
      testID="training-screen"
    >
      <AxPageHeader title={t('training.title')} subtitle={t('training.subtitle')} testID="training-header" />

      <View style={styles.body}>
        <AxCard variant="featured" testID="training-generate">
          <View style={styles.stack}>
            <Text style={[axTypography.titleM, { color: c.text }]}>{t('training.generate.title')}</Text>
            <View style={styles.chips}>
              {ENTRIES.map(({ key, labelKey }) => (
                <AxChip key={key} label={t(labelKey)} selected={entry === key} onPress={() => setEntry(key)} testID={`training-entry-${key}`} />
              ))}
            </View>
            <View style={styles.chips}>
              {SPORTS.map((s) => (
                <AxChip key={s} label={t(`training.disciplines.${s}`)} selected={sport === s} onPress={() => setSport(s)} testID={`training-discipline-${s}`} />
              ))}
            </View>
            <AxButton
              variant="accent"
              label={t('training.generate.button')}
              onPress={generate}
              loading={generating}
              disabled={!user || !ready}
              fullWidth
              testID="training-generate-button"
            />
            <Pressable
              onPress={() => navigation.navigate('WodGenerator')}
              accessibilityRole="link"
              hitSlop={8}
              style={styles.link}
              testID="training-more-options"
            >
              <Text style={[axTypography.labelSmall, { color: c.accentText }]}>{t('training.generate.moreOptions')}</Text>
              <ChevronRight size={14} color={c.accentText} />
            </Pressable>
          </View>
        </AxCard>

        <View style={styles.section}>
          <Text style={[axTypography.overline, { color: c.textMuted }]}>{t('training.tools.title')}</Text>
          <View style={styles.grid}>
            {tools.map(({ key, label, Icon, onPress }) => (
              <View key={key} style={styles.tile}>
                <AxCard onPress={onPress} accessibilityLabel={label} testID={`training-tool-${key}`}>
                  <Icon size={22} color={c.accentText} />
                  <Text style={[axTypography.label, { color: c.text }]}>{label}</Text>
                </AxCard>
              </View>
            ))}
          </View>
        </View>

        {last && (
          <View style={styles.section} testID="training-last">
            <Text style={[axTypography.overline, { color: c.textMuted }]}>{t('training.last.title')}</Text>
            <AxCard>
              <Text style={[axTypography.label, { color: c.text }]} numberOfLines={2} testID="training-last-title">{last.title}</Text>
              <Text style={[axTypography.bodySmall, { color: c.textMuted }]} testID="training-last-meta">{lastMeta}</Text>
              <AxButton
                variant="outline"
                icon={RotateCcw}
                label={t('training.last.relaunch')}
                onPress={() => navigation.navigate('WodResult', last.params)}
                testID="training-last-relaunch"
              />
            </AxCard>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function relativeDay(t: (k: string, o?: Record<string, unknown>) => string, days: number): string {
  if (days === 0) return t('training.last.today');
  if (days === 1) return t('training.last.yesterday');
  return t('training.last.daysAgo', { count: days });
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: axSpacing.xl, paddingTop: axSpacing['2xl'], gap: axSpacing['2xl'] },
  stack: { gap: axSpacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm },
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: axSpacing.xs },
  section: { gap: axSpacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.md },
  tile: { flexBasis: '46%', flexGrow: 1 },
});
