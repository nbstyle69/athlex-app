import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxCard, AxChip, withAlpha } from '../../components/ax';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Line, Rect, G, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TrendingUp, TrendingDown, Trophy, Dumbbell, Zap, Swords, ChevronRight, Medal } from 'lucide-react-native';
import { HomeStackParamList } from '../../navigation';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { log } from '../../lib/logger';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import GlassBackground from '../../components/glass/GlassBackground';
import {
  EloEntry, MatchEloRow, matchEloRowToEntry, sortEloEntries, eloCurvePoints,
} from '../../utils/eloHistoryEntries';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import {
  ELO_TIERS, tierIndexOf, tierOf, tierProgress, passageIndex, bestIndex, tierBands, thresholdsIn,
  tierInk, tierBand, tierInkOnBand,
} from '../../utils/eloTiers';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

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
    const d = new Date(iso);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} à ${hours}:${mins}`;
  }

  return (
    <View style={S.container}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader title="Historique ELO" onBack={() => nav.goBack()} />

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: tabSpace }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
      >
        {/* Current ELO card */}
        <AxCard testID="elo-card" style={S.eloCard}>
          <Text testID="elo-value" style={[axTypography.numberL, { color: c.accentText }]}>{currentElo}</Text>
          <Text style={[axTypography.overline, { color: c.textMuted }]}>ELO ACTUEL</Text>
          <View style={S.eloCardStats}>
            <View style={S.eloCardStat}>
              <TrendingUp color={c.success} size={16} />
              <Text testID="elo-gain" style={[axTypography.label, { color: c.success }]}>+{totalGain}</Text>
            </View>
            <View style={S.eloCardStat}>
              <TrendingDown color={c.danger} size={16} />
              <Text testID="elo-loss" style={[axTypography.label, { color: c.danger }]}>{totalLoss}</Text>
            </View>
          </View>
          <EloTierProgress elo={currentElo} c={c} />
        </AxCard>

        {/* Period filter */}
        {!loading && entries.length > 0 && (
          <View style={S.filterRow}>
            {(['7d', '30d', '365d', 'all'] as const).map(p => (
              <AxChip
                key={p}
                testID={`elo-filter-${p}`}
                selected={period === p}
                onPress={() => setPeriod(p)}
                label={p === '7d' ? '7j' : p === '30d' ? '30j' : p === '365d' ? '1an' : 'Tout'}
              />
            ))}
          </View>
        )}

        {/* ELO Chart */}
        {!loading && filtered.length >= 2 && (
          <EloChart entries={filtered} currentElo={currentElo} c={c} />
        )}

        {!loading && <EloTierLadder elo={currentElo} c={c} />}

        {/* History list */}
        {loading ? (
          <ActivityIndicator color={c.accent} size="large" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={S.emptyState}>
            <Trophy color={c.textMuted} size={40} />
            <Text style={[axTypography.label, S.emptyText]}>Aucun historique ELO</Text>
            <Text style={[axTypography.bodySmall, S.emptySubtext]}>Participe à des WODs ou tournois pour voir ton historique ici.</Text>
          </View>
        ) : (
          <View style={S.list}>
            <Text style={[axTypography.overline, S.sectionTitle]}>HISTORIQUE ({filtered.length})</Text>
            {filtered.map((entry) => (
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
                <View style={[S.rowIcon, { backgroundColor: withAlpha(entryColor(entry.type, c), 0.12) }]}>
                  {entry.type === 'tournament'
                    ? <Trophy color={c.violet} size={18} />
                    : entry.type === 'match'
                    ? <Swords color={c.violet} size={18} />
                    : entry.type === 'daily'
                    ? <Zap color={c.danger} size={18} />
                    : <Dumbbell color={c.accentText} size={18} />
                  }
                </View>
                <View style={S.rowBody}>
                  <Text style={[axTypography.label, { color: c.text }]} numberOfLines={1}>{entry.label}</Text>
                  <View style={S.rowMeta}>
                    <Text style={[axTypography.caption, { color: c.textMuted }]}>{formatDate(entry.date)}</Text>
                    <RankLabel rank={entry.rank} theme={theme} />
                  </View>
                </View>
                <View style={S.rowRight}>
                  <Text style={[
                    axTypography.label,
                    { color: entry.delta > 0 ? c.success : entry.delta < 0 ? c.danger : c.textMuted },
                  ]}>
                    {entry.delta > 0 ? '+' : ''}{entry.delta}
                  </Text>
                  <Text style={[axTypography.caption, { color: c.textMuted }]}>{entry.eloAfter}</Text>
                </View>
                {entry.type === 'wod' && (
                  <ChevronRight color={c.textMuted} size={16} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function entryColor(type: EloEntry['type'], c: AxColors): string {
  return type === 'tournament' || type === 'match' ? c.violet : type === 'daily' ? c.danger : c.accentText;
}

const MEDAL_LABELS = ['1er', '2e', '3e'];

function RankLabel({ rank, theme }: { rank: number | null; theme: AppTheme }) {
  if (rank === null) return null;
  if (rank >= 1 && rank <= 3) {
    const color = rank === 1 ? theme.gold : rank === 2 ? theme.silver : theme.bronze;
    return (
      <View testID={`elo-rank-medal-${rank}`} accessible accessibilityLabel={MEDAL_LABELS[rank - 1]}>
        <Medal color={color} size={14} />
      </View>
    );
  }
  return <Text style={[axTypography.labelSmall, { color: theme.ax.textMuted }]}>{`#${rank}`}</Text>;
}

// ── Palier actuel et progression ─────────────────────────────────────
function EloTierProgress({ elo, c }: { elo: number; c: AxColors }) {
  const { t } = useTranslation();
  const { current, next, remaining, ratio } = tierProgress(elo);
  const ink = tierInk(current.level, c);
  return (
    <View testID="elo-tier" style={tierStyles.progress}>
      <View style={tierStyles.currentRow}>
        <View testID="elo-tier-dot" style={[tierStyles.dot, { backgroundColor: ink }]} />
        <Text testID="elo-tier-name" style={[axTypography.label, { color: ink }]}>{current.name}</Text>
      </View>
      {next && remaining !== null && (
        <Text testID="elo-tier-remaining" style={[axTypography.bodySmall, { color: c.textMuted }]}>
          {t('eloHistory.tierRemaining', { points: remaining, tier: next.name })}
        </Text>
      )}
      <View testID="elo-tier-track" style={[tierStyles.track, { backgroundColor: withAlpha(c.text, 0.1) }]}>
        <View testID="elo-tier-fill" style={[tierStyles.fill, { width: `${ratio * 100}%`, backgroundColor: ink }]} />
      </View>
      <View style={tierStyles.bounds}>
        <Text testID="elo-tier-bound-low" numberOfLines={1} style={[axTypography.caption, { color: c.textMuted }]}>
          {t('eloHistory.tierBound', { tier: current.name, min: current.min })}
        </Text>
        {next && (
          <Text testID="elo-tier-bound-high" numberOfLines={1} style={[axTypography.caption, { color: c.textMuted }]}>
            {t('eloHistory.tierBound', { tier: next.name, min: next.min })}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Échelle des paliers ──────────────────────────────────────────────
function EloTierLadder({ elo, c }: { elo: number; c: AxColors }) {
  const { t } = useTranslation();
  const currentIdx = tierIndexOf(elo);
  return (
    <AxCard testID="elo-tiers-card" style={tierStyles.ladderCard}>
      <Text style={[axTypography.overline, { color: c.textMuted }]}>{t('eloHistory.tiersTitle')}</Text>
      <View style={tierStyles.ladder}>
        {ELO_TIERS.map((tier, i) => {
          const ink = tierInk(tier.level, c);
          const reached = i <= currentIdx;
          return (
            <View key={tier.level} testID={`elo-tier-step-${tier.level}`} style={tierStyles.step}>
              <View
                testID={`elo-tier-step-bar-${tier.level}`}
                style={[tierStyles.stepBar, { backgroundColor: reached ? ink : withAlpha(ink, 0.25) }]}
              />
              <Text numberOfLines={1} style={[axTypography.labelSmall, { color: reached ? c.text : c.textMuted }]}>{tier.name}</Text>
              <Text numberOfLines={1} style={[axTypography.caption, { color: c.textMuted }]}>{tier.min}</Text>
              {i === currentIdx && (
                <Text testID="elo-tier-you" numberOfLines={1} style={[axTypography.labelSmall, { color: c.accentText }]}>
                  {t('eloHistory.you')}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </AxCard>
  );
}

// ── ELO Progression Chart ────────────────────────────────────────────
/** Écran moins les marges de la carte, son padding et sa bordure. */
const CHART_WIDTH = Dimensions.get('window').width - 4 * axSpacing.lg - 2;
const CHART_HEIGHT = 180;
const PADDING = { top: 20, right: 16, bottom: 28, left: 44 };

function EloChart({ entries, currentElo, c }: {
  entries: EloEntry[]; currentElo: number; c: AxColors;
}) {
  const { t } = useTranslation();
  // Build chronological data points (oldest → newest, then current)
  const sorted = [...entries].reverse();
  const dayLabel = (iso: string) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const elos = eloCurvePoints(entries);
  const points: { elo: number; label: string }[] = elos.map((elo, i) => ({
    elo, label: dayLabel(sorted[Math.max(0, i - 1)].date),
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

  const last = linePoints.length - 1;
  const lastInk = tierInkOnBand(tierOf(points[last].elo).level, c);
  const currentTier = tierOf(currentElo);
  const passage = passageIndex(elos, currentTier.level);
  const best = bestIndex(elos);

  return (
    <AxCard testID="elo-chart" style={S_CHART.card}>
      <Text style={[axTypography.overline, { color: c.textMuted }]}>
        PROGRESSION ELO
      </Text>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Bandes des paliers */}
        <G testID="elo-chart-bands">
          {tierBands(padded.min, padded.max).map(({ tier, from, to }) => (
            <Rect
              key={`band-${tier.level}`}
              testID={`elo-band-${tier.level}`}
              x={PADDING.left} y={y(to)}
              width={w} height={y(from) - y(to)}
              fill={tierBand(tier.level, c)}
            />
          ))}
        </G>

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

        {/* Seuils des paliers */}
        <G testID="elo-chart-thresholds">
          {thresholdsIn(padded.min, padded.max).map((tier) => {
            const ink = tierInkOnBand(tier.level, c);
            return (
              <G key={`threshold-${tier.level}`} testID={`elo-threshold-${tier.level}`}>
                <Line
                  x1={PADDING.left} y1={y(tier.min)}
                  x2={PADDING.left + w} y2={y(tier.min)}
                  stroke={ink} strokeWidth={1} strokeDasharray="4 4"
                />
                <SvgText x={PADDING.left + w} y={y(tier.min) - 4} fontSize={10} fontWeight="600" fill={ink} textAnchor="end">
                  {tier.min}
                </SvgText>
              </G>
            );
          })}
        </G>

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={`ytick-${i}`}
            x={PADDING.left - 6}
            y={y(tick) + 4}
            fontSize={10}
            fontWeight="600"
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
            fontWeight="500"
            fill={c.textMuted}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}

        {/* Line */}
        <Path d={linePath} stroke={c.textMuted} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Repères */}
        <G testID="elo-chart-marks">
          {passage !== null && (
            <Circle testID="elo-passage-ring" cx={linePoints[passage].cx} cy={linePoints[passage].cy} r={8}
              fill="none" stroke={c.text} strokeWidth={1.5} />
          )}
          {best !== null && (
            <Circle testID="elo-best-ring" cx={linePoints[best].cx} cy={linePoints[best].cy} r={8}
              fill="none" stroke={c.text} strokeWidth={1.5} strokeDasharray="2 2" />
          )}
          <Circle testID="elo-last-halo" cx={linePoints[last].cx} cy={linePoints[last].cy} r={10} fill={withAlpha(lastInk, 0.25)} />
        </G>

        {/* Data points */}
        {linePoints.map((pt, i) => (
          <Circle
            key={`dot-${i}`}
            testID={`elo-dot-${i}`}
            cx={pt.cx}
            cy={pt.cy}
            r={i === last ? 6 : 3.5}
            fill={tierInkOnBand(tierOf(points[i].elo).level, c)}
            stroke={c.surface}
            strokeWidth={i === last ? 2 : 1}
          />
        ))}

        {/* Current ELO label on last point */}
        <SvgText
          x={linePoints[last].cx}
          y={linePoints[last].cy - 12}
          fontSize={12}
          fontWeight="800"
          fill={c.text}
          textAnchor="middle"
        >
          {currentElo}
        </SvgText>
      </Svg>
      {(passage !== null || best !== null) && (
        <View testID="elo-chart-legend" style={S_CHART.legend}>
          {passage !== null && (
            <View style={S_CHART.legendItem}>
              <View style={[S_CHART.legendRing, { borderColor: c.text }]} />
              <Text testID="elo-passage" numberOfLines={1} style={[axTypography.caption, { color: c.text }]}>
                {t('eloHistory.passage', { tier: currentTier.name, date: dayLabel(sorted[passage - 1].date) })}
              </Text>
            </View>
          )}
          {best !== null && (
            <View style={S_CHART.legendItem}>
              <View style={[S_CHART.legendRing, S_CHART.legendRingDashed, { borderColor: c.text }]} />
              <Text testID="elo-best" numberOfLines={1} style={[axTypography.caption, { color: c.text }]}>
                {t('eloHistory.best', { value: elos[best] })}
              </Text>
            </View>
          )}
        </View>
      )}
    </AxCard>
  );
}

const S_CHART = StyleSheet.create({
  card: { marginHorizontal: axSpacing.lg, marginBottom: axSpacing.lg, gap: axSpacing.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: axSpacing.lg, rowGap: axSpacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, flexShrink: 1 },
  legendRing: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  legendRingDashed: { borderStyle: 'dashed' },
});

const tierStyles = StyleSheet.create({
  progress: { alignSelf: 'stretch', gap: axSpacing.sm, marginTop: axSpacing.lg },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  bounds: { flexDirection: 'row', justifyContent: 'space-between', gap: axSpacing.sm },
  ladderCard: { marginHorizontal: axSpacing.lg, marginBottom: axSpacing.lg },
  ladder: { flexDirection: 'row', gap: axSpacing.xs },
  step: { flex: 1, minWidth: 0, gap: 2 },
  stepBar: { height: 6, borderRadius: axRadius.badge, marginBottom: axSpacing.xs },
});

function createStyles(c: AxColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    scroll: { paddingBottom: 140 },

    // ELO Card
    eloCard: { margin: axSpacing.lg, padding: axSpacing['2xl'], alignItems: 'center', gap: axSpacing.xs },
    eloCardStats: { flexDirection: 'row', gap: axSpacing['2xl'], marginTop: axSpacing.md },
    eloCardStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },

    // Empty state
    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyText: { color: c.text, marginTop: axSpacing.lg },
    emptySubtext: { color: c.textMuted, textAlign: 'center', marginTop: axSpacing.sm },

    // Filter pills
    filterRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm, paddingHorizontal: axSpacing.lg, marginBottom: axSpacing.md,
    },

    // List
    list: { paddingHorizontal: axSpacing.lg },
    sectionTitle: { color: c.textMuted, marginBottom: axSpacing.md },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: axSpacing.md,
      backgroundColor: c.surface,
      borderRadius: axRadius.card, padding: 14, marginBottom: axSpacing.sm,
      borderWidth: 1, borderColor: c.border,
    },
    rowIcon: {
      width: 40, height: 40, borderRadius: axRadius.control,
      alignItems: 'center', justifyContent: 'center',
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, marginTop: 3 },
    rowRight: { alignItems: 'flex-end' },
  });
}
