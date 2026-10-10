import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TrendingUp, TrendingDown, Trophy, Dumbbell, Zap, Swords, ChevronRight, Medal } from 'lucide-react-native';
import { HomeStackParamList } from '../../navigation';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { log } from '../../lib/logger';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  EloEntry, MatchEloRow, matchEloRowToEntry, sortEloEntries, eloCurvePoints,
} from '../../utils/eloHistoryEntries';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { AxCard, AxChip, withAlpha } from '../../components/ax';
import { axFonts, axRadius, axSpacing, axTypography, AxColors } from '../../theme/axTokens';
import { levelInk } from '../home/homeLevelColor';
import { formatDate as formatLocaleDate, formatTime } from '../../i18n/locale';
import {
  ELO_TIERS, tierOf, tierProgress, tierPassageIndex, bestIndex, tierBands, thresholdsIn,
} from '../../utils/eloTiers';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

const PERIOD_KEYS = { '7d': 'eloHistory.period7d', '30d': 'eloHistory.period30d', '365d': 'eloHistory.period1y', all: 'eloHistory.periodAll' } as const;

export default function EloHistoryScreen() {
  const tabSpace = useTabBarScrollSpace();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);

  const [entries, setEntries] = useState<EloEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '365d' | 'all'>('all');

  const load = useCallback(async () => {
    if (!user) return;
    try {
    const results: EloEntry[] = [];

    // L'ELO est calculé côté serveur par les RPC (compute_wod_elo /
    // compute_daily_tournament_elo) au moment de la soumission. L'ancien invoke
    // 'compute-elo-batch' était une edge NON déployée → 404 silencieux à chaque
    // ouverture (Lot 5.3). Retiré ; l'écran ne fait plus que LIRE l'historique.

    // 1. WOD elo_history
    const { data: wodHistory, error: wodErr } = await supabase
      .from('elo_history')
      .select('id, wod_id, elo_before, elo_after, elo_delta, rank, created_at, box_wods(title, wod_type)')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    log.debug('[EloHistory] wodHistory count=', wodHistory?.length ?? 0, 'error=', wodErr?.message);

    for (const h of wodHistory ?? []) {
      const wod = Array.isArray(h.box_wods) ? h.box_wods[0] : h.box_wods;
      results.push({
        id: h.id,
        type: 'wod',
        refId: h.wod_id,
        label: h.wod_id === null ? t('eloHistory.deletedWod') : (wod?.title ?? 'WOD'),
        delta: h.elo_delta,
        eloBefore: h.elo_before,
        eloAfter: h.elo_after,
        rank: h.rank,
        date: h.created_at ?? '',
      });
    }

    // 2. Tournament elo_history
    const { data: tournHistory, error: tournErr } = await supabase
      .from('tournament_elo_history')
      .select('id, tournament_id, elo_before, elo_after, elo_change, final_rank, calculated_at, tournaments(name)')
      .eq('athlete_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(100);

    log.debug('[EloHistory] tournHistory count=', tournHistory?.length ?? 0, 'error=', tournErr?.message);

    for (const h of tournHistory ?? []) {
      const tourn = Array.isArray(h.tournaments) ? h.tournaments[0] : h.tournaments;
      results.push({
        id: h.id,
        type: 'tournament',
        refId: h.tournament_id,
        label: h.tournament_id === null ? t('eloHistory.deletedTournament') : (tourn?.name ?? 'Tournoi'),
        delta: h.elo_change,
        eloBefore: h.elo_before,
        eloAfter: h.elo_after,
        rank: h.final_rank,
        date: h.calculated_at,
      });
    }

    // 3. Daily tournament elo_history
    const { data: dailyHistory } = await supabase
      .from('daily_tournament_elo_history')
      .select('id, tournament_id, elo_before, elo_after, elo_delta, final_rank, calculated_at, daily_tournaments(wod_name)')
      .eq('user_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(100);

    for (const h of dailyHistory ?? []) {
      const dt = Array.isArray(h.daily_tournaments) ? h.daily_tournaments[0] : h.daily_tournaments;
      results.push({
        id: h.id,
        type: 'daily',
        refId: h.tournament_id,
        label: h.tournament_id === null ? t('eloHistory.deletedDaily') : (dt?.wod_name ?? 'Mini-Tournoi'),
        delta: h.elo_delta,
        eloBefore: h.elo_before,
        eloAfter: h.elo_after,
        rank: h.final_rank,
        date: h.calculated_at,
      });
    }

    // 4. Matchs de bracket (trg_bracket_match_elo) — sans eux le dernier point de la courbe
    // ne retombe pas sur l'ELO du profil.
    const { data: matchHistory, error: matchErr } = await supabase
      .from('tournament_match_elo_history')
      .select('id, match_id, opponent_id, result, elo_before, elo_after, elo_delta, created_at, tournament_bracket_matches(tournament_id, tournaments(name))')
      .eq('athlete_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    log.debug('[EloHistory] matchHistory count=', matchHistory?.length ?? 0, 'error=', matchErr?.message);

    const matchRows = (matchHistory ?? []) as unknown as MatchEloRow[];
    const opponentIds = [...new Set(matchRows.map(r => r.opponent_id).filter((id): id is string => id !== null))];
    const opponentNames: Record<string, string | undefined> = {};
    if (opponentIds.length > 0) {
      const { data: opponents, error: oppErr } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', opponentIds);
      log.debug('[EloHistory] opponents count=', opponents?.length ?? 0, 'error=', oppErr?.message);
      for (const o of opponents ?? []) opponentNames[o.id] = o.username ?? undefined;
    }
    const matchLabels = {
      deletedMatch: t('eloHistory.deletedMatch'),
      unknownOpponent: t('eloHistory.unknownOpponent'),
      versus: (opponent: string) => t('eloHistory.versus', { opponent }),
    };
    for (const r of matchRows) results.push(matchEloRowToEntry(r, opponentNames, matchLabels));

    setEntries(sortEloEntries(results));
    } catch (e) { captureError(e, { screen: 'EloHistory', action: 'load' }); }
    setLoading(false);
    setRefreshing(false);
  }, [user, t]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const currentElo = user?.elo ?? 1000;

  const filtered = React.useMemo(() => {
    if (period === 'all') return entries;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return entries.filter(e => new Date(e.date) >= cutoff);
  }, [entries, period]);

  const totalGain = filtered.reduce((sum, e) => sum + (e.delta > 0 ? e.delta : 0), 0);
  const totalLoss = filtered.reduce((sum, e) => sum + (e.delta < 0 ? e.delta : 0), 0);

  function formatDate(iso: string) {
    return t('eloHistory.dateTime', {
      date: formatLocaleDate(iso, { day: '2-digit', month: '2-digit' }),
      time: formatTime(iso, { hour: '2-digit', minute: '2-digit' }),
    });
  }

  const MEDAL_COLORS = [c.warning, c.textMuted, c.orange];
  function rankMark(rank: number | null) {
    if (rank === null) return null;
    if (rank >= 1 && rank <= 3) {
      return (
        <View accessibilityLabel={`#${rank}`} testID={`elo-rank-medal-${rank}`}>
          <Medal color={MEDAL_COLORS[rank - 1]} size={14} />
        </View>
      );
    }
    return <Text style={S.rowRank}>{`#${rank}`}</Text>;
  }

  const progress = tierProgress(currentElo);
  const tierInk = levelInk(progress.tier.level, c);
  const currentTierIdx = ELO_TIERS.indexOf(progress.tier);

  function entryTone(type: EloEntry['type']) {
    if (type === 'tournament' || type === 'match') return c.violet;
    if (type === 'daily') return c.danger;
    return c.accentText;
  }

  return (
    <View style={S.container}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader title={t('eloHistory.title')} onBack={() => nav.goBack()} />

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: tabSpace }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accentText} colors={[c.accent]} />}
      >
        {/* Current ELO card */}
        <AxCard testID="elo-card" style={S.eloCard}>
          <Text style={S.eloCardValue} testID="elo-current">{currentElo}</Text>
          <Text style={S.eloCardLabel}>{t('eloHistory.current')}</Text>
          <View style={S.tierRow} testID="elo-tier-current">
            <View style={[S.tierDot, { backgroundColor: tierInk }]} testID="elo-tier-current-dot" />
            <Text style={[S.tierName, { color: tierInk }]} testID="elo-tier-current-name">{progress.tier.name}</Text>
          </View>
          {progress.next && progress.remaining !== null && (
            <>
              <Text style={S.tierRemaining} testID="elo-tier-remaining">
                {t('eloHistory.remaining', { count: progress.remaining, tier: progress.next.name })}
              </Text>
              <View style={S.progressTrack} testID="elo-tier-progress">
                <View
                  testID="elo-tier-progress-fill"
                  style={[S.progressFill, { width: `${Math.round(progress.ratio * 1000) / 10}%`, backgroundColor: tierInk }]}
                />
              </View>
              <View style={S.boundsRow} testID="elo-tier-bounds">
                <Text style={S.bound} numberOfLines={1} testID="elo-tier-bound-from">{`${progress.tier.name} · ${progress.tier.min}`}</Text>
                <Text style={[S.bound, S.boundRight]} numberOfLines={1} testID="elo-tier-bound-to">{`${progress.next.name} · ${progress.next.min}`}</Text>
              </View>
            </>
          )}
          <View style={S.eloCardStats}>
            <View style={S.eloCardStat}>
              <TrendingUp color={c.success} size={16} />
              <Text style={[S.eloCardStatText, { color: c.success }]} testID="elo-gain">+{totalGain}</Text>
            </View>
            <View style={S.eloCardStat}>
              <TrendingDown color={c.danger} size={16} />
              <Text style={[S.eloCardStatText, { color: c.danger }]} testID="elo-loss">{totalLoss}</Text>
            </View>
          </View>
        </AxCard>

        {/* Period filter */}
        {!loading && entries.length > 0 && (
          <View style={S.filterRow}>
            {(['7d', '30d', '365d', 'all'] as const).map(p => (
              <AxChip
                key={p}
                testID={`elo-period-${p}`}
                label={t(PERIOD_KEYS[p])}
                selected={period === p}
                onPress={() => setPeriod(p)}
              />
            ))}
          </View>
        )}

        {/* ELO Chart */}
        {!loading && filtered.length >= 2 && (
          <EloChart entries={filtered} currentElo={currentElo} c={c} t={t} />
        )}

        {/* Paliers */}
        {!loading && (
          <AxCard testID="elo-tier-ladder" style={S.card}>
            <Text style={S.overline}>{t('eloHistory.tiers')}</Text>
            <View style={S.ladder}>
              {ELO_TIERS.map((tier, i) => {
                const reached = i <= currentTierIdx;
                const ink = levelInk(tier.level, c);
                return (
                  <View key={tier.level} style={S.ladderStep} testID={`elo-tier-step-${tier.level}`}>
                    <View
                      testID={`elo-tier-step-bar-${tier.level}`}
                      style={[S.ladderBar, { backgroundColor: reached ? ink : withAlpha(ink, 0.25) }]}
                    />
                    <Text
                      style={[S.ladderName, { color: reached ? ink : c.textMuted }]}
                      numberOfLines={1}
                      testID={`elo-tier-step-name-${tier.level}`}
                    >
                      {tier.name}
                    </Text>
                    <Text style={S.ladderMin} numberOfLines={1}>{tier.min}</Text>
                    {i === currentTierIdx && (
                      <Text style={[S.ladderYou, { color: ink }]} testID="elo-tier-you">{t('eloHistory.you')}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </AxCard>
        )}

        {/* History list */}
        {loading ? (
          <ActivityIndicator color={c.accentText} size="large" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={S.emptyState}>
            <Trophy color={c.textMuted} size={40} />
            <Text style={S.emptyText}>{t('eloHistory.emptyTitle')}</Text>
            <Text style={S.emptySubtext}>{t('eloHistory.emptySub')}</Text>
          </View>
        ) : (
          <View style={S.list}>
            <Text style={S.sectionTitle}>{t('eloHistory.historyCount', { count: filtered.length })}</Text>
            {filtered.map((entry) => {
              const tone = entryTone(entry.type);
              return (
                <TouchableOpacity
                  key={entry.id}
                  testID={`elo-row-${entry.id}`}
                  style={S.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (entry.type === 'wod' && entry.refId) {
                      nav.navigate('WODDetail', { wodId: entry.refId, scrollToLeaderboard: true });
                    }
                  }}
                >
                  <View style={[S.rowIcon, { backgroundColor: withAlpha(tone, 0.12) }]}>
                    {entry.type === 'tournament'
                      ? <Trophy color={tone} size={18} />
                      : entry.type === 'match'
                      ? <Swords color={tone} size={18} />
                      : entry.type === 'daily'
                      ? <Zap color={tone} size={18} />
                      : <Dumbbell color={tone} size={18} />
                    }
                  </View>
                  <View style={S.rowBody}>
                    <Text style={S.rowLabel} numberOfLines={1}>{entry.label}</Text>
                    <View style={S.rowMeta}>
                      <Text style={S.rowDate}>{formatDate(entry.date)}</Text>
                      {rankMark(entry.rank)}
                    </View>
                  </View>
                  <View style={S.rowRight}>
                    <Text style={[
                      S.rowDelta,
                      { color: entry.delta > 0 ? c.success : entry.delta < 0 ? c.danger : c.textMuted },
                    ]}>
                      {entry.delta > 0 ? '+' : ''}{entry.delta}
                    </Text>
                    <Text style={S.rowEloAfter}>{entry.eloAfter}</Text>
                  </View>
                  {entry.type === 'wod' && (
                    <ChevronRight color={c.textMuted} size={16} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── ELO Progression Chart ────────────────────────────────────────────
/** Largeur de l'écran moins les marges et le padding de la carte. */
export const CHART_WIDTH = Dimensions.get('window').width - 2 * axSpacing.lg - 2 * axSpacing.lg;
const CHART_HEIGHT = 180;
const PADDING = { top: 20, right: 16, bottom: 28, left: 44 };
export const BAND_OPACITY = 0.1;

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

function EloChart({ entries, currentElo, c, t }: {
  entries: EloEntry[]; currentElo: number; c: AxColors; t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  // Build chronological data points (oldest → newest, then current)
  const sorted = [...entries].reverse();
  const dayLabel = (iso: string) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const elos = eloCurvePoints(entries);
  const pointDate = (i: number) => sorted[Math.max(0, i - 1)].date;
  const points: { elo: number; label: string }[] = elos.map((elo, i) => ({
    elo, label: dayLabel(pointDate(i)),
  }));

  if (points.length < 2) return null;

  const minElo = Math.min(...elos);
  const maxElo = Math.max(...elos);
  const eloRange = maxElo - minElo || 50;
  const padded = { min: minElo - eloRange * 0.1, max: maxElo + eloRange * 0.1 };

  const w = CHART_WIDTH - PADDING.left - PADDING.right;
  const h = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const x = (i: number) => PADDING.left + (i / (points.length - 1)) * w;
  const y = (elo: number) => PADDING.top + h - ((elo - padded.min) / (padded.max - padded.min)) * h;

  // Build smooth path
  const linePoints = points.map((p, i) => ({ cx: x(i), cy: y(p.elo) }));
  let linePath = `M ${linePoints[0].cx} ${linePoints[0].cy}`;
  for (let i = 1; i < linePoints.length; i++) {
    const prev = linePoints[i - 1];
    const curr = linePoints[i];
    const cpx = (prev.cx + curr.cx) / 2;
    linePath += ` C ${cpx} ${prev.cy}, ${cpx} ${curr.cy}, ${curr.cx} ${curr.cy}`;
  }

  // Y-axis labels (3-4 ticks)
  const tickCount = 4;
  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(Math.round(padded.min + (i / tickCount) * (padded.max - padded.min)));
  }

  // X-axis labels — show first, middle, last
  const xLabels: { i: number; label: string }[] = [];
  if (points.length <= 5) {
    points.forEach((p, i) => xLabels.push({ i, label: p.label }));
  } else {
    xLabels.push({ i: 0, label: points[0].label });
    const mid = Math.floor(points.length / 2);
    xLabels.push({ i: mid, label: points[mid].label });
    xLabels.push({ i: points.length - 1, label: points[points.length - 1].label });
  }

  const currentTier = tierOf(currentElo);
  const passage = tierPassageIndex(elos, currentTier.level);
  const best = bestIndex(elos);
  const last = linePoints.length - 1;
  const passageInk = levelInk(currentTier.level, c);

  return (
    <AxCard testID="elo-chart" style={S_CHART.card}>
      <Text style={S_CHART.title(c)}>{t('eloHistory.progression')}</Text>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Bandes de palier */}
        {tierBands(padded.min, padded.max).map((b) => (
          <Rect
            key={`band-${b.tier.level}`}
            testID={`elo-tier-band-${b.tier.level}`}
            x={PADDING.left} y={y(b.to)} width={w} height={y(b.from) - y(b.to)}
            fill={levelInk(b.tier.level, c)} fillOpacity={BAND_OPACITY}
          />
        ))}

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <Line
            key={`grid-${i}`}
            x1={PADDING.left} y1={y(tick)}
            x2={PADDING.left + w} y2={y(tick)}
            stroke={withAlpha(c.text, 0.08)}
            strokeWidth={1}
          />
        ))}

        {/* Seuils de palier */}
        {thresholdsIn(padded.min, padded.max).map((tier) => (
          <React.Fragment key={`thr-${tier.level}`}>
            <Line
              testID={`elo-tier-threshold-${tier.level}`}
              x1={PADDING.left} y1={y(tier.min)} x2={PADDING.left + w} y2={y(tier.min)}
              stroke={levelInk(tier.level, c)} strokeWidth={1} strokeDasharray="4 3"
            />
            <SvgText
              testID={`elo-tier-threshold-label-${tier.level}`}
              x={PADDING.left + w} y={y(tier.min) - 4}
              fontSize={10} fontFamily={axFonts.interSemiBold}
              fill={levelInk(tier.level, c)} textAnchor="end"
            >
              {tier.min}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={`ytick-${i}`}
            x={PADDING.left - 6}
            y={y(tick) + 4}
            fontSize={10}
            fontFamily={axFonts.interMedium}
            fill={c.textMuted}
            textAnchor="end"
          >
            {tick}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <SvgText
            key={`xtick-${i}`}
            x={x(i)}
            y={PADDING.top + h + 18}
            fontSize={10}
            fontFamily={axFonts.interMedium}
            fill={c.textMuted}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}

        {/* Repère de passage */}
        {passage !== null && (
          <Line
            testID="elo-tier-passage-line"
            x1={linePoints[passage].cx} y1={PADDING.top} x2={linePoints[passage].cx} y2={PADDING.top + h}
            stroke={passageInk} strokeWidth={1} strokeDasharray="2 3"
          />
        )}

        {/* Line */}
        <Path d={linePath} stroke={c.textMuted} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Meilleur */}
        {best !== null && (
          <Circle
            testID="elo-tier-best-ring"
            cx={linePoints[best].cx} cy={linePoints[best].cy} r={8}
            fill="none" stroke={c.text} strokeWidth={1.5}
          />
        )}

        {/* Data points */}
        {linePoints.map((pt, i) => (
          <Circle
            key={`dot-${i}`}
            testID={`elo-tier-dot-${i}`}
            cx={pt.cx}
            cy={pt.cy}
            r={i === last ? 6 : 3.5}
            fill={levelInk(tierOf(points[i].elo).level, c)}
            stroke={i === last ? c.surface : 'none'}
            strokeWidth={i === last ? 2 : 0}
          />
        ))}

        {/* Current ELO label on last point */}
        <SvgText
          x={linePoints[last].cx}
          y={linePoints[last].cy - 12}
          fontSize={12}
          fontFamily={axFonts.interSemiBold}
          fill={c.text}
          textAnchor="end"
        >
          {currentElo}
        </SvgText>
      </Svg>
      {(passage !== null || best !== null) && (
        <View style={S_CHART.markers} testID="elo-tier-markers">
          {passage !== null && (
            <View style={S_CHART.marker}>
              <View style={[S_CHART.markerDot, { backgroundColor: passageInk }]} />
              <Text style={[S_CHART.markerText(c), { color: passageInk }]} numberOfLines={1} testID="elo-tier-passage">
                {t('eloHistory.passage', { tier: currentTier.name, date: shortDate(pointDate(passage)) })}
              </Text>
            </View>
          )}
          {best !== null && (
            <View style={S_CHART.marker}>
              <View style={[S_CHART.markerRing, { borderColor: c.text }]} />
              <Text style={S_CHART.markerText(c)} numberOfLines={1} testID="elo-tier-best">
                {t('eloHistory.best', { value: elos[best] })}
              </Text>
            </View>
          )}
        </View>
      )}
    </AxCard>
  );
}

const S_CHART = {
  card: { marginHorizontal: axSpacing.lg, marginBottom: axSpacing.lg },
  title: (c: AxColors) => ({ ...axTypography.overline, color: c.textMuted }),
  markers: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: axSpacing.md },
  marker: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: axSpacing.xs, flexShrink: 1 },
  markerDot: { width: 8, height: 8, borderRadius: 4 },
  markerRing: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  markerText: (c: AxColors) => ({ ...axTypography.labelSmall, color: c.text, flexShrink: 1 }),
};

function createStyles(c: AxColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    scroll: { paddingBottom: 140 },

    card: { marginHorizontal: axSpacing.lg, marginBottom: axSpacing.lg },
    overline: { ...axTypography.overline, color: c.textMuted },

    // ELO Card
    eloCard: { margin: axSpacing.lg, alignItems: 'center' },
    eloCardValue: { ...axTypography.numberL, color: c.text },
    eloCardLabel: { ...axTypography.overline, color: c.textMuted, textTransform: 'uppercase' },
    tierRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, marginTop: axSpacing.xs },
    tierDot: { width: 10, height: 10, borderRadius: 5 },
    tierName: { ...axTypography.label },
    tierRemaining: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    progressTrack: {
      alignSelf: 'stretch', height: 6, borderRadius: axRadius.badge, overflow: 'hidden',
      backgroundColor: withAlpha(c.text, 0.12),
    },
    progressFill: { height: 6, borderRadius: axRadius.badge },
    boundsRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', gap: axSpacing.sm },
    bound: { ...axTypography.caption, color: c.textMuted, flexShrink: 1 },
    boundRight: { textAlign: 'right' },
    eloCardStats: { flexDirection: 'row', gap: axSpacing['2xl'], marginTop: axSpacing.xs },
    eloCardStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    eloCardStatText: { ...axTypography.label },

    // Paliers
    ladder: { flexDirection: 'row', gap: axSpacing.xs },
    ladderStep: { flex: 1, minWidth: 0, gap: 2 },
    ladderBar: { height: 6, borderRadius: axRadius.badge, marginBottom: axSpacing.xs },
    ladderName: { ...axTypography.labelSmall },
    ladderMin: { ...axTypography.caption, color: c.textMuted },
    ladderYou: { ...axTypography.labelSmall, marginTop: 2 },

    // Empty state
    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyText: { ...axTypography.label, color: c.text, marginTop: axSpacing.lg },
    emptySubtext: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', marginTop: axSpacing.sm },

    // Filter pills
    filterRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm, paddingHorizontal: axSpacing.lg, marginBottom: axSpacing.md,
    },

    // List
    list: { paddingHorizontal: axSpacing.lg },
    sectionTitle: { ...axTypography.overline, color: c.textMuted, marginBottom: axSpacing.md },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: axSpacing.md,
      backgroundColor: c.surface,
      borderRadius: axRadius.card, padding: axSpacing.md, marginBottom: axSpacing.sm,
      borderWidth: 1, borderColor: c.border,
    },
    rowIcon: {
      width: 40, height: 40, borderRadius: axRadius.control,
      alignItems: 'center', justifyContent: 'center',
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { ...axTypography.label, color: c.text },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, marginTop: 3 },
    rowDate: { ...axTypography.caption, color: c.textMuted },
    rowRank: { ...axTypography.labelSmall, color: c.textMuted },
    rowRight: { alignItems: 'flex-end' },
    rowDelta: { ...axTypography.numberM, fontSize: 18, lineHeight: 22 },
    rowEloAfter: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
  });
}
