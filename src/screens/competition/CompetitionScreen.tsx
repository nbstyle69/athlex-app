import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, LayoutAnimation,
} from 'react-native';
import { Trophy, Users, Zap, ChevronRight, Plus, Flame, Globe2, Info, CheckCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { AxButton, AxCard, AxChip, AxPageHeader, AxStatusDot, AxTag } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { CompetitionStackParamList } from '../../navigation';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTranslation } from 'react-i18next';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { useFocusQuery } from '../../hooks/useFocusQuery';
import { fetchEloRank } from '../../services/eloRank';
import CompetitionRankingCard from './CompetitionRankingCard';
import EmptyState from '../../components/EmptyState';

type Nav = NativeStackNavigationProp<CompetitionStackParamList, 'CompetitionList'>;



interface MiniTournament {
  id: string;
  wod_name: string;
  wod_type: string;
  level: string;
  score_mode: string;
  max_players: number;
  status: string;
  elo_reward: number;
  ends_at: string;
  participant_count: number;
  has_joined: boolean;
  creator_name: string;
}

interface OfficialWod {
  id: string;
  wod_name: string;
  wod_type: string;
  level: string;
  ends_at: string;
  participant_count: number;
  has_scored: boolean;
}

interface Tournament {
  id: string;
  name: string;
  level: string;
  status: string;
  max_participants: number;
  prize: string | null;
  start_date: string | null;
}

export default function CompetitionScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<CompetitionStackParamList, 'CompetitionList'>>();
  const { theme } = useTheme();
  const { currentBox } = useAuth();
  const { t } = useTranslation();
  const TABS = [t('competition.tabTournaments'), t('competition.tabMini'), t('competition.tabPhysical'), t('competition.tabInter')];
  const S = createStyles(theme);
  const c = theme.ax;
  const insets = useSafeAreaInsets();
  const [activeTab,    setActiveTab]    = useState(route.params?.initialTab ?? 0);
  const [tournaments,  setTournaments]  = useState<Tournament[]>([]);
  const [tLoading,     setTLoading]     = useState(false);
  const [tRefreshing,  setTRefreshing]  = useState(false);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [myRegistered, setMyRegistered] = useState<Record<string, boolean>>({});
  const [miniTournaments, setMiniTournaments] = useState<MiniTournament[]>([]);
  const [miniLoading, setMiniLoading] = useState(false);
  const [officialWod, setOfficialWod] = useState<OfficialWod | null>(null);
  const { user } = useAuth();
  const { data: eloRank } = useFocusQuery(
    ['eloRank', user?.id, user?.elo],
    () => fetchEloRank(user?.elo ?? 0),
    { enabled: !!user },
  );

  useEffect(() => {
    if (route.params?.initialTab !== undefined) setActiveTab(route.params.initialTab);
  }, [route.params?.initialTab]);

  const loadTournaments = useCallback(async () => {
    setTLoading(true);
    if (!currentBox) { setTLoading(false); setTRefreshing(false); return; }
    try {
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, level, status, max_participants, prize, start_date')
      .eq('box_id', currentBox.id)
      .in('status', ['open', 'active'])
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    const list = (data ?? []) as Tournament[];
    setTournaments(list);
    // Fetch participant counts
    if (list.length > 0) {
      const counts: Record<string, number> = {};
      await Promise.all(list.map(async t => {
        const { count } = await supabase
          .from('tournament_participants')
          .select('id', { count: 'exact', head: true })
          .eq('tournament_id', t.id);
        counts[t.id] = count ?? 0;
      }));
      setParticipantCounts(counts);

      // Fetch my registration status across all listed tournaments (all formats)
      if (user) {
        const ids = list.map(t => t.id);
        const { data: myRows } = await supabase
          .from('tournament_participants')
          .select('tournament_id')
          .eq('athlete_id', user.id)
          .in('tournament_id', ids);
        const reg: Record<string, boolean> = {};
        (myRows ?? []).forEach((r: any) => { reg[r.tournament_id] = true; });
        setMyRegistered(reg);
      } else {
        setMyRegistered({});
      }
    }
    } catch (e) { captureError(e, { screen: 'Competition', action: 'loadTournaments' }); }
    setTLoading(false);
    setTRefreshing(false);
  }, [currentBox, user]);

  const loadMiniTournaments = useCallback(async () => {
    if (!user) return;
    setMiniLoading(true);
    try {
    const { data } = await supabase
      .from('daily_tournaments')
      .select(`
        *,
        participants:daily_tournament_participants(user_id),
        creator:profiles!creator_id(username)
      `)
      .eq('is_official', false)
      .in('status', ['open', 'active'])
      .order('created_at', { ascending: false })
      .limit(20);

    const mapped: MiniTournament[] = (data ?? []).map((t: any) => ({
      id: t.id,
      wod_name: t.wod_name,
      wod_type: t.wod_type,
      level: t.level,
      score_mode: t.score_mode,
      max_players: t.max_players,
      status: t.status,
      elo_reward: t.elo_reward,
      ends_at: t.ends_at,
      participant_count: t.participants?.length ?? 0,
      has_joined: (t.participants ?? []).some((p: any) => p.user_id === user.id),
      creator_name: (Array.isArray(t.creator) ? t.creator[0] : t.creator)?.username ?? '—',
    }));
    setMiniTournaments(mapped);
    } catch (e) { captureError(e, { screen: 'Competition', action: 'loadMiniTournaments' }); }
    setMiniLoading(false);
  }, [user]);

  const loadOfficialWod = useCallback(async () => {
    if (!user) return;
    try {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('daily_tournaments')
        .select(`
          id, wod_name, wod_type, level, ends_at,
          participants:daily_tournament_participants(user_id),
          scores:daily_tournament_scores(user_id)
        `)
        .eq('is_official', true)
        .gt('ends_at', nowIso)
        .order('official_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) { setOfficialWod(null); return; }
      setOfficialWod({
        id: data.id,
        wod_name: data.wod_name,
        wod_type: data.wod_type,
        level: data.level,
        ends_at: data.ends_at,
        participant_count: (data.participants ?? []).length,
        has_scored: (data.scores ?? []).some((s: { user_id: string }) => s.user_id === user.id),
      });
    } catch (e) { captureError(e, { screen: 'Competition', action: 'loadOfficialWod' }); }
  }, [user]);

  useEffect(() => { loadTournaments(); }, [loadTournaments, currentBox]);

  useFocusEffect(useCallback(() => { loadMiniTournaments(); loadOfficialWod(); }, [loadMiniTournaments, loadOfficialWod]));

  async function handleJoinMini(tournamentId: string) {
    if (!user) return;
    const { error } = await supabase.from('daily_tournament_participants').insert({
      tournament_id: tournamentId,
      user_id: user.id,
    });
    if (error) {
      if (error.code === '23505') Alert.alert(t('competition.alreadyJoined'), t('competition.alreadyParticipating'));
      else Alert.alert(t('common.error'), error.message);
      return;
    }
    loadMiniTournaments();
  }

  function timeLeft(endsAt: string): string {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return t('competition.finished');
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h${String(m).padStart(2, '0')}`;
  }

  return (
    <View style={S.container}>
      <GlassBackground />
      <View style={[S.header, { paddingTop: insets.top + axSpacing.lg }]}>
        <AxPageHeader title={t('competition.title')} subtitle={t('competition.subtitle')} testID="competition-header" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabsBar} contentContainerStyle={S.tabs}>
        {TABS.map((tab, i) => (
          <AxChip
            key={tab}
            testID={`competition-tab-${i}`}
            label={tab}
            selected={activeTab === i}
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveTab(i); }}
          />
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.content, { paddingBottom: tabSpace }]}>
        {activeTab === 0 && (
          <>
            {user && (
              <CompetitionRankingCard
                rank={eloRank ?? null}
                elo={user.elo ?? 1000}
                level={user.level ?? 'scaled'}
                onOpen={() => navigation.navigate('Leaderboard')}
              />
            )}

            <Text style={S.sectionTitle}>{t('competition.availableTournaments')}</Text>
            {tLoading ? (
              <ActivityIndicator color={c.accentText} style={S.loader} />
            ) : tournaments.length === 0 ? (
              <EmptyState testID="competition-no-tournament" style={S.emptyBox} icon={Trophy} title={t('competition.noTournament')} />
            ) : (
              tournaments.map(tour => {
                const participants = participantCounts[tour.id] ?? 0;
                const pct = tour.max_participants > 0 ? (participants / tour.max_participants) * 100 : 0;
                return (
                  <AxCard
                    key={tour.id}
                    testID={`competition-tournament-${tour.id}`}
                    style={S.card}
                    onPress={() => navigation.navigate('Tournament', { tournamentId: tour.id })}
                  >
                    <View style={S.tHeader}>
                      <Text style={S.tName}>{tour.name}</Text>
                      <AxStatusDot
                        testID={`competition-tournament-status-${tour.id}`}
                        tone={tour.status === 'active' ? 'warning' : 'active'}
                        label={tour.status === 'active' ? t('competition.live') : t('competition.open')}
                      />
                    </View>
                    {myRegistered[tour.id] && (
                      <View style={S.regBadge}>
                        <CheckCircle color={c.success} size={13} />
                        <Text style={S.regBadgeText}>{t('competition.registered')}</Text>
                      </View>
                    )}
                    <View style={S.tInfo}>
                      <View style={S.tInfoItem}>
                        <Users color={c.textMuted} size={14} />
                        <Text style={S.tInfoText}>{participants}/{tour.max_participants}</Text>
                      </View>
                      <AxTag label={(tour.level ?? 'RX').toUpperCase()} tone="accent" />
                      {tour.prize ? <Text style={S.tPrize}>{tour.prize}</Text> : null}
                    </View>
                    <View style={S.progressBar}>
                      <View style={[S.progressFill, { width: `${pct}%` as any }]} />
                    </View>
                  </AxCard>
                );
              })
            )}
          </>
        )}

        {activeTab === 1 && (
          <>
            {officialWod && (
              <AxCard
                variant="featured"
                testID="competition-official-wod"
                style={S.card}
                onPress={() => navigation.navigate('DailyTournamentDetail', { tournamentId: officialWod.id })}
              >
                <View style={S.officialBadgeRow}>
                  <View style={S.officialBadge}>
                    <Flame color={c.accentText} size={13} />
                    <Text style={S.officialBadgeTxt}>{t('competition.wodOfDay')}</Text>
                  </View>
                  <Text style={S.officialTime}>{timeLeft(officialWod.ends_at)}</Text>
                </View>
                <Text style={S.officialName}>{officialWod.wod_name}</Text>
                <Text style={S.officialSub}>{officialWod.wod_type} · {officialWod.level.toUpperCase()}</Text>
                <View style={S.officialFooter}>
                  <View style={S.officialParticipants}>
                    <Users color={c.textMuted} size={13} />
                    <Text style={S.officialParticipantsTxt}>
                      {t('competition.wodOfDayPlayers', { count: officialWod.participant_count })}
                    </Text>
                  </View>
                  <AxTag
                    testID="competition-official-cta"
                    tone={officialWod.has_scored ? 'success' : 'accent'}
                    label={officialWod.has_scored ? t('competition.wodOfDayScored') : t('competition.wodOfDayPlay')}
                  />
                </View>
              </AxCard>
            )}

            <View style={S.miniInfo}>
              <Zap color={c.accentText} size={16} />
              <Text style={S.miniInfoText}>{t('competition.miniInfo')}</Text>
            </View>

            <View style={S.block}>
              <AxButton
                testID="competition-create-mini"
                variant="dashed"
                icon={Plus}
                fullWidth
                onPress={() => navigation.navigate('DailyTournaments')}
                label={t('competition.createDaily')}
              />
            </View>

            <Text style={S.sectionTitle}>{t('competition.openNow')}</Text>
            {miniLoading ? (
              <ActivityIndicator color={c.accentText} style={S.loader} />
            ) : miniTournaments.length === 0 ? (
              <EmptyState testID="competition-no-mini" style={S.emptyBox} icon={Zap} title={t('competition.noMini')} />
            ) : (
              miniTournaments.map(m => {
                const isFull = m.participant_count >= m.max_players;
                const remaining = timeLeft(m.ends_at);
                const isFinished = new Date(m.ends_at).getTime() - Date.now() <= 0;
                return (
                  <AxCard
                    key={m.id}
                    testID={`competition-mini-${m.id}`}
                    style={S.card}
                    onPress={() => navigation.navigate('DailyTournamentDetail', { tournamentId: m.id })}
                  >
                    <View style={S.miniHeader}>
                      <Text style={S.miniName}>{m.wod_name}</Text>
                      <AxTag label={m.level.toUpperCase()} tone="muted" />
                    </View>
                    <Text style={S.miniCreator}>{t('competition.byCreator', { name: m.creator_name, type: m.wod_type })}</Text>
                    <View style={S.miniFooter}>
                      <View style={S.miniParticipants}>
                        {Array.from({ length: m.max_players }).map((_, i) => (
                          <View
                            key={i}
                            style={[
                              S.participantDot,
                              { backgroundColor: i < m.participant_count ? c.accentText : c.border },
                            ]}
                          />
                        ))}
                        <Text style={S.miniParticipantsText}>{m.participant_count}/{m.max_players}</Text>
                      </View>
                      <View style={S.miniTime}>
                        <Flame color={isFinished ? c.danger : c.accentText} size={13} />
                        <Text style={[S.miniTimeText, isFinished && { color: c.danger }]}>{remaining}</Text>
                      </View>
                      <View style={S.miniTime}>
                        <Trophy color={c.textMuted} size={12} />
                        <Text style={S.miniReward}>+{m.elo_reward}</Text>
                      </View>
                    </View>
                    {!m.has_joined && !isFull ? (
                      <AxButton
                        testID={`competition-join-${m.id}`}
                        variant="outline"
                        fullWidth
                        onPress={() => handleJoinMini(m.id)}
                        label={t('competition.join')}
                      />
                    ) : m.has_joined ? (
                      <View style={S.joinedRow}>
                        <CheckCircle color={c.success} size={14} />
                        <Text style={S.joinedText}>{t('competition.joined')}</Text>
                      </View>
                    ) : null}
                  </AxCard>
                );
              })
            )}

            {miniTournaments.length > 0 && (
              <TouchableOpacity
                style={S.seeAll}
                onPress={() => navigation.navigate('DailyTournaments')}
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <Text style={S.seeAllText}>{t('competition.seeAllMini')}</Text>
                <ChevronRight color={c.accentText} size={14} />
              </TouchableOpacity>
            )}
          </>
        )}
        {activeTab === 2 && (
          <View style={S.physList}>
            <AxCard
              testID="competition-physical-qualification"
              style={S.physModeCard}
              onPress={() => navigation.navigate('PhysicalCompetition', { mode: 'qualification' })}
            >
              <View style={S.physModeIcon}>
                <Zap color={c.accentText} size={22} />
              </View>
              <View style={S.flex}>
                <Text style={S.physModeTitle}>{t('competition.onlineQualif')}</Text>
                <Text style={S.physModeDesc}>{t('competition.onlineQualifDesc')}</Text>
              </View>
              <ChevronRight color={c.textMuted} size={18} />
            </AxCard>

            <AxCard
              testID="competition-physical-info"
              style={S.physModeCard}
              onPress={() => navigation.navigate('PhysicalCompetition', { mode: 'info' })}
            >
              <View style={S.physModeIcon}>
                <Info color={c.accentText} size={22} />
              </View>
              <View style={S.flex}>
                <Text style={S.physModeTitle}>{t('competition.noQualif')}</Text>
                <Text style={S.physModeDesc}>{t('competition.noQualifDesc')}</Text>
              </View>
              <ChevronRight color={c.textMuted} size={18} />
            </AxCard>
          </View>
        )}

        {activeTab === 3 && (
          <>
            <View style={S.block}>
              <AxButton
                testID="competition-inter-box"
                icon={Globe2}
                fullWidth
                onPress={() => navigation.navigate('InterCompetitionList')}
                label={t('competition.seeInterBox')}
              />
            </View>
            <AxCard style={S.card}>
              <Text style={S.physInfoTitle}>{t('competition.interBoxTitle')}</Text>
              <Text style={S.physInfoText}>{t('competition.interBoxInfo')}</Text>
            </AxCard>
          </>
        )}

        <View style={S.bottomGap} />
      </ScrollView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: { paddingBottom: axSpacing.md },
  tabsBar: { flexGrow: 0, flexShrink: 0 },
  tabs: { flexDirection: 'row', gap: axSpacing.sm, paddingHorizontal: axSpacing.xl, paddingBottom: axSpacing.md },
  content: { padding: axSpacing.lg },
  flex: { flex: 1, minWidth: 0 },
  block: { marginBottom: axSpacing.lg },
  card: { marginBottom: axSpacing.md },
  loader: { marginTop: 32 },
  sectionTitle: { ...axTypography.titleM, color: c.text, marginBottom: axSpacing.md, marginTop: axSpacing.sm },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: axSpacing.md },
  emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  tHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: axSpacing.md },
  tName: { ...axTypography.titleM, color: c.text, flex: 1, minWidth: 0 },
  regBadge: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  regBadgeText: { ...axTypography.labelSmall, color: c.success },
  tInfo: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, flexWrap: 'wrap' },
  tInfoItem: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  tInfoText: { ...axTypography.bodySmall, color: c.textMuted },
  tPrize: { ...axTypography.label, color: c.text, flexShrink: 1 },
  progressBar: { height: 4, backgroundColor: c.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: c.accent, borderRadius: 2 },
  officialBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.md },
  officialBadge: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, flexShrink: 1 },
  officialBadgeTxt: { ...axTypography.overline, color: c.accentText },
  officialTime: { ...axTypography.label, color: c.textMuted },
  officialName: { ...axTypography.titleL, color: c.text },
  officialSub: { ...axTypography.bodySmall, color: c.textMuted },
  officialFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.md, flexWrap: 'wrap' },
  officialParticipants: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, flexShrink: 1 },
  officialParticipantsTxt: { ...axTypography.caption, color: c.textMuted },
  miniInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.sm, marginBottom: axSpacing.lg },
  miniInfoText: { ...axTypography.bodySmall, color: c.textMuted, flex: 1 },
  miniHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: axSpacing.md },
  miniName: { ...axTypography.titleM, color: c.text, flex: 1, minWidth: 0 },
  miniCreator: { ...axTypography.caption, color: c.textMuted },
  miniFooter: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.lg, flexWrap: 'wrap' },
  miniParticipants: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  participantDot: { width: 8, height: 8, borderRadius: 4 },
  miniParticipantsText: { ...axTypography.caption, color: c.textMuted, marginLeft: axSpacing.xs },
  miniTime: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  miniTimeText: { ...axTypography.labelSmall, color: c.text },
  miniReward: { ...axTypography.labelSmall, color: c.text },
  joinedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: axSpacing.xs, minHeight: 44 },
  joinedText: { ...axTypography.label, color: c.success },
  seeAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: axSpacing.xs, minHeight: 44 },
  seeAllText: { ...axTypography.label, color: c.accentText },
  physList: { gap: axSpacing.md },
  physModeCard: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
  physModeIcon: { width: 44, height: 44, borderRadius: axRadius.control, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  physModeTitle: { ...axTypography.label, color: c.text },
  physModeDesc: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
  physInfoTitle: { ...axTypography.label, color: c.text },
  physInfoText: { ...axTypography.bodySmall, color: c.textMuted },
  bottomGap: { height: 32 },
  });
}
