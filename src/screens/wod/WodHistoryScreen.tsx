import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert,
} from 'react-native';
import {
  Heart, Clock, Zap, Trash2, ChevronDown, ChevronUp, CheckCircle2, ChevronRight, Flame, Lightbulb, ClipboardList,
} from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AxButton, AxCard, AxChip, AxTag, withAlpha } from '../../components/ax';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { levelInk } from '../home/homeLevelColor';
import { HomeStackParamList } from '../../navigation';
import { formatScoreValue } from '../../utils/scoreFormat';
import { wodTypeLabel } from '../../utils/wodTypeLabel';
import GlassBackground from '../../components/glass/GlassBackground';
import { buildHistoryEntries, countScores, HistoryEntry, BoxScoreRow, CompletionRow } from '../../lib/wodHistoryEntries';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import EmptyState from '../../components/EmptyState';
import { dateLocale } from '../../i18n/locale';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

interface SavedWOD {
  id: string;
  sport: string;
  wod_name: string;
  wod_type: string;
  duration: number;
  level: string;
  format: string;
  movements: string;
  scoring: string | null;
  coach_tip: string | null;
  team_note: string | null;
  equipment: string[];
  is_favorite: boolean;
  is_benchmark: boolean;
  created_at: string;
  scores?: WODScore[];
}

interface WODScore {
  id: string;
  score_type: string;
  score_value: number;
  rx: boolean;
  notes: string | null;
  completed_at: string;
}

type FilterType = 'all' | 'favorites' | 'benchmark';
type Entry = HistoryEntry<SavedWOD>;

const HISTORY_FETCH_LIMIT = 200;
const PAGE_SIZE = 30;

function formatScore(score: WODScore): string {
  return formatScoreValue(score.score_value, score.score_type);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
}

export default function WodHistoryScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<{ WodHistory: { filter?: 'favorites' } | undefined }, 'WodHistory'>>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.ax;
  const S = createStyles(c);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>(route.params?.filter === 'favorites' ? 'favorites' : 'all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    if (!user) return;
    let generatedQuery = supabase
      .from('generated_wods')
      .select('*, scores:generated_wod_scores(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_FETCH_LIMIT);
    if (filter === 'favorites') generatedQuery = generatedQuery.eq('is_favorite', true);
    if (filter === 'benchmark') generatedQuery = generatedQuery.eq('is_benchmark', true);

    // Favoris / benchmark n'existent que sur les WOD générés : les lignes de box
    // ne rejoignent la liste que dans l'onglet « Tous ».
    const boxScoresQuery = filter === 'all'
      ? supabase
        .from('wod_scores')
        .select('id, wod_id, score_value, score_type, rx, submitted_at, wod:box_wods(title, wod_type, scheduled_date)')
        .eq('member_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(HISTORY_FETCH_LIMIT)
      : Promise.resolve({ data: [], error: null });
    const completionsQuery = filter === 'all'
      ? supabase
        .from('wod_completions')
        .select('id, wod_id, completed_at, wod:box_wods(title, wod_type, scheduled_date)')
        .eq('member_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(HISTORY_FETCH_LIMIT)
      : Promise.resolve({ data: [], error: null });

    const [generated, boxScores, completions] = await Promise.all([generatedQuery, boxScoresQuery, completionsQuery]);
    if (generated.error) captureError(generated.error, { screen: 'WodHistory', action: 'loadWods' });
    if (boxScores.error) captureError(boxScores.error, { screen: 'WodHistory', action: 'loadBoxScores' });
    if (completions.error) captureError(completions.error, { screen: 'WodHistory', action: 'loadCompletions' });

    setEntries(buildHistoryEntries(
      (generated.data ?? []) as SavedWOD[],
      (boxScores.data ?? []) as unknown as BoxScoreRow[],
      (completions.data ?? []) as unknown as CompletionRow[],
    ));
    setVisibleCount(PAGE_SIZE);
    setLoading(false);
    setRefreshing(false);
  }, [user, filter]);

  useEffect(() => { load(); }, [load]);

  const visibleEntries = entries.slice(0, visibleCount);
  const loadMore = useCallback(() => {
    if (visibleCount < entries.length) setVisibleCount(c => c + PAGE_SIZE);
  }, [visibleCount, entries.length]);

  function patchGenerated(id: string, patch: Partial<SavedWOD>) {
    setEntries(prev => prev.map(e => e.kind === 'generated' && e.wod.id === id ? { ...e, wod: { ...e.wod, ...patch } } : e));
  }

  async function toggleFav(wod: SavedWOD) {
    const newVal = !wod.is_favorite;
    patchGenerated(wod.id, { is_favorite: newVal });
    await supabase.from('generated_wods').update({ is_favorite: newVal }).eq('id', wod.id);
  }

  async function deleteWod(wod: SavedWOD) {
    Alert.alert(t('wodHistory.deleteConfirmTitle'), wod.wod_name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          setEntries(prev => prev.filter(e => !(e.kind === 'generated' && e.wod.id === wod.id)));
          await supabase.from('generated_wods').delete().eq('id', wod.id);
        },
      },
    ]);
  }

  // Stats
  const totalWods = entries.length;
  const totalScores = countScores(entries);
  const streak = (() => {
    const days = new Set(entries.map(e => new Date(e.date).toISOString().split('T')[0]));
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (days.has(d.toISOString().split('T')[0])) count++;
      else if (i > 0) break;
    }
    return count;
  })();

  function renderBoxEntry(entry: Extract<Entry, { kind: 'boxScore' | 'completion' }>) {
    const title = entry.wod?.title ?? t('wodHistory.boxWodFallback');
    const wodType = entry.wod?.wod_type ?? null;
    return (
      <AxCard
        style={S.wodCard}
        onPress={() => navigation.navigate('WODDetail', { wodId: entry.wodId })}
        testID={`history-${entry.kind}-${entry.wodId}`}
      >
        <View style={S.wodTop}>
          <View style={S.wodBadges}>
            <AxTag label={t('wodHistory.boxTag')} tone="accent" />
            {wodType && <AxTag testID={`history-type-${entry.wodId}`} label={wodTypeLabel(wodType)} tone="muted" />}
          </View>
          <ChevronRight color={c.textMuted} size={16} />
        </View>
        <Text style={S.wodName}>{title}</Text>
        <Text style={S.wodDate}>{formatDate(entry.date)}</Text>
        {entry.kind === 'boxScore' ? (
          <View style={S.bestScoreRow}>
            <Zap color={c.warning} size={12} />
            <Text style={S.bestScoreTxt}>
              {formatScoreValue(entry.score.score_value, entry.score.score_type ?? 'time')} {entry.score.rx ? t('wodHistory.rxTag') : t('wodHistory.scaledTag')}
            </Text>
          </View>
        ) : (
          <View style={S.bestScoreRow}>
            <CheckCircle2 color={c.textMuted} size={12} />
            <Text style={S.completedTxt}>{t('wodHistory.completedNoScore')}</Text>
          </View>
        )}
      </AxCard>
    );
  }

  function renderEntry({ item }: { item: Entry }) {
    if (item.kind !== 'generated') return renderBoxEntry(item);
    return renderWod(item.wod);
  }

  function renderWod(item: SavedWOD) {
    const isExpanded = expandedId === item.id;
    const levelColor = levelInk(item.level, c);
    const bestScore = item.scores && item.scores.length > 0
      ? item.scores.sort((a, b) => item.wod_type === 'For Time' ? a.score_value - b.score_value : b.score_value - a.score_value)[0]
      : null;

    return (
      <AxCard
        style={S.wodCard}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        testID={`history-generated-${item.id}`}
      >
        {/* Top row */}
        <View style={S.wodTop}>
          <View style={S.wodBadges}>
            <AxTag label={item.wod_type} tone="accent" />
            <View style={[S.badge, { borderColor: levelColor }]} testID={`history-level-${item.id}`}>
              <Text style={[S.badgeTxt, { color: levelColor }]}>{item.level.toUpperCase()}</Text>
            </View>
            {item.is_benchmark && <AxTag label="BM" tone="accent" />}
            {item.duration > 0 && (
              <View style={[S.badge, { borderColor: c.border }]}>
                <Clock color={c.textMuted} size={10} />
                <Text style={[S.badgeTxt, { color: c.textMuted }]}>{item.duration}m</Text>
              </View>
            )}
          </View>
          <View style={S.wodActions}>
            <TouchableOpacity
              onPress={() => toggleFav(item)}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityState={{ selected: item.is_favorite }}
              testID={`history-fav-${item.id}`}
            >
              <Heart color={item.is_favorite ? c.danger : c.textMuted} size={16} fill={item.is_favorite ? c.danger : 'transparent'} />
            </TouchableOpacity>
            {isExpanded ? <ChevronUp color={c.textMuted} size={16} /> : <ChevronDown color={c.textMuted} size={16} />}
          </View>
        </View>

        {/* Title + date */}
        <Text style={S.wodName}>{item.wod_name}</Text>
        <Text style={S.wodDate}>{formatDate(item.created_at)} · {item.format}</Text>

        {/* Best score if any */}
        {bestScore && (
          <View style={S.bestScoreRow}>
            <Zap color={c.warning} size={12} />
            <Text style={S.bestScoreTxt}>{t('wodHistory.best', { score: formatScore(bestScore), tag: bestScore.rx ? t('wodHistory.rxTag') : t('wodHistory.scaledTag') })}</Text>
          </View>
        )}

        {/* Expanded content */}
        {isExpanded && (
          <View style={S.expandedContent}>
            <View style={S.movBox}>
              {item.movements.split('\n').map((line, i) => (
                <Text key={i} style={line.startsWith('  ') ? S.movLine : S.movHeader}>{line}</Text>
              ))}
            </View>
            {item.scoring && (
              <View style={S.scoringRow}>
                <Zap color={c.warning} size={13} />
                <Text style={S.scoringTxt}>{item.scoring}</Text>
              </View>
            )}
            {item.coach_tip && (
              <View style={S.coachBox}>
                <Lightbulb color={c.accentText} size={14} />
                <Text style={S.coachTxt}>{item.coach_tip}</Text>
              </View>
            )}

            {/* All scores */}
            {item.scores && item.scores.length > 0 && (
              <View style={S.scoresSection}>
                <Text style={S.scoresTitle}>{t('wodHistory.myScores', { count: item.scores.length })}</Text>
                {item.scores.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()).map(sc => (
                  <View key={sc.id} style={S.scoreRow}>
                    <Text style={S.scoreDate}>{formatDateShort(sc.completed_at)}</Text>
                    <Text style={S.scoreValue}>{formatScore(sc)}</Text>
                    <Text style={S.scoreRx}>{sc.rx ? 'RX' : 'SC'}</Text>
                    {sc.notes ? <Text style={S.scoreNotes} numberOfLines={1}>{sc.notes}</Text> : null}
                  </View>
                ))}
              </View>
            )}

            {/* Delete */}
            <View style={S.deleteRow}>
              <AxButton
                variant="stop"
                icon={Trash2}
                label={t('common.delete')}
                onPress={() => deleteWod(item)}
                testID={`history-delete-${item.id}`}
              />
            </View>
          </View>
        )}
      </AxCard>
    );
  }

  return (
    <View style={S.screen}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader title={t('wodHistory.title')} />

      {/* Stats row */}
      <AxCard style={S.statsCard} testID="history-stats">
        <View style={S.statsRow}>
          <View style={S.statBox}>
            <Text style={S.statNum} testID="history-stat-wods">{totalWods}</Text>
            <Text style={S.statLabel}>{t('wodHistory.statWods')}</Text>
          </View>
          <View style={S.statBox}>
            <Text style={S.statNum} testID="history-stat-scores">{totalScores}</Text>
            <Text style={S.statLabel}>{t('wodHistory.statScores')}</Text>
          </View>
          <View style={S.statBox}>
            <View style={S.streakRow}>
              <Text style={[S.statNum, streak >= 3 && { color: c.orange }]} testID="history-stat-streak">{streak}</Text>
              <Flame color={streak >= 3 ? c.orange : c.textMuted} size={18} />
            </View>
            <Text style={S.statLabel}>{t('wodHistory.statStreak')}</Text>
          </View>
        </View>
      </AxCard>

      {/* Filter tabs */}
      <View style={S.filterRow}>
        {([['all', t('wodHistory.filterAll')], ['favorites', t('wodHistory.filterFavorites')], ['benchmark', t('wodHistory.filterBenchmark')]] as const).map(([key, label]) => (
          <AxChip
            key={key}
            label={label}
            selected={filter === key}
            onPress={() => setFilter(key)}
            testID={`history-filter-${key}`}
          />
        ))}
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={c.accentText} />
        </View>
      ) : (
        <FlatList
          data={visibleEntries}
          keyExtractor={e => e.id}
          renderItem={renderEntry}
          contentContainerStyle={[S.list, { paddingBottom: tabSpace }]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <EmptyState testID="wod-history-empty" style={S.empty} icon={ClipboardList} title={t('wodHistory.emptyTitle')} text={t('wodHistory.emptySub')} />
          }
        />
      )}
    </View>
  );
}

function createStyles(c: AxColors) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  statsCard: { marginHorizontal: axSpacing.xl, marginTop: axSpacing.sm, paddingVertical: axSpacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', flex: 1, minWidth: 0 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  statNum: { ...axTypography.numberM, color: c.text },
  statLabel: { ...axTypography.caption, color: c.textMuted },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm, paddingHorizontal: axSpacing.xl, paddingVertical: axSpacing.md },
  list: { paddingHorizontal: axSpacing.xl, gap: axSpacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingTop: 60 },
  wodCard: { gap: 6 },
  wodTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm },
  wodBadges: { flexDirection: 'row', gap: axSpacing.xs, flexWrap: 'wrap', flex: 1, minWidth: 0 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: axSpacing.sm, paddingVertical: axSpacing.xs,
    borderRadius: axRadius.badge, borderWidth: 1,
  },
  badgeTxt: { ...axTypography.labelSmall, textTransform: 'uppercase' },
  wodActions: { flexDirection: 'row', gap: axSpacing.md, alignItems: 'center' },
  wodName: { ...axTypography.label, color: c.text },
  wodDate: { ...axTypography.overline, color: c.textMuted },
  bestScoreRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  bestScoreTxt: { ...axTypography.bodySmall, color: c.text, flexShrink: 1 },
  completedTxt: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1 },
  expandedContent: { gap: 10, marginTop: axSpacing.sm, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  movBox: { backgroundColor: c.field, borderRadius: axRadius.control, padding: 10, gap: 2 },
  movHeader: { ...axTypography.labelSmall, color: c.textMuted },
  movLine: { ...axTypography.bodySmall, color: c.text },
  scoringRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scoringTxt: { ...axTypography.caption, color: c.textMuted, flex: 1 },
  coachBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.sm,
    backgroundColor: withAlpha(c.accent, 0.12), borderRadius: axRadius.control, padding: axSpacing.sm,
  },
  coachTxt: { ...axTypography.caption, color: c.text, flex: 1 },
  scoresSection: { gap: axSpacing.xs },
  scoresTitle: { ...axTypography.labelSmall, color: c.accentText },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, paddingVertical: axSpacing.xs, borderBottomWidth: 1, borderBottomColor: c.border },
  scoreDate: { ...axTypography.caption, color: c.textMuted, width: 60 },
  scoreValue: { ...axTypography.label, color: c.text },
  scoreRx: { ...axTypography.labelSmall, color: c.accentText },
  scoreNotes: { ...axTypography.caption, color: c.textMuted, flex: 1 },
  deleteRow: { alignItems: 'flex-end' },
}); }
