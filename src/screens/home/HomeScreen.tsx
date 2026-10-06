import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Modal, Pressable,
  RefreshControl, LayoutAnimation, UIManager, Platform, Animated,
} from 'react-native';
import {
  Trophy, User, Users, Bell, ChevronDown,
  Building2, Check, Flame, Medal,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusQuery } from '../../hooks/useFocusQuery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { axAccentSafeLineHeight, axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { HomeStackParamList, CompetitionSummary } from '../../navigation';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { readRows } from '../../lib/db';
import { countUnreadChangelog } from '../../lib/changelog';
import { formatScoreValue } from '../../utils/scoreFormat';
import { getStreak, StreakInfo, readBadgeQueue, clearBadgeQueue, BadgeQueueItem } from '../../services/gamification';
import AutoScrollCarousel from '../../components/AutoScrollCarousel';
import { AxButton, AxCard, AxCounterBadge, AxIconButton, AxStatusDot, withAlpha } from '../../components/ax';
import InteractiveTour from '../../components/InteractiveTour';
import HomeNewsCard from './HomeNewsCard';
import { fetchHomeNews, type HomeNews } from '../../services/homeNews';
import { fetchEloRank } from '../../services/eloRank';
import HomeExplorerBlock from './HomeExplorerBlock';
import { levelInk } from './homeLevelColor';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { dateLocale } from '../../i18n/locale';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'HomeList'>;

interface RecentScore {
  id: string;
  score_value: string;
  submitted_at: string;
  wod_title: string;
  status: string;
}

export default function HomeScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { t } = useTranslation();
  const { user, currentBox, myBoxes, switchBox } = useAuth();
  const [boxPickerVisible, setBoxPickerVisible] = useState(false);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const level = user?.level ?? 'scaled';
  const S = createStyles(theme);
  const c = theme.ax;


  const [competitions,   setCompetitions]   = useState<CompetitionSummary[]>([]);
  const [recentScores,   setRecentScores]   = useState<RecentScore[]>([]);
  const [rank,           setRank]           = useState<number | null>(null);
  const [news,           setNews]           = useState<HomeNews | null>(null);
  const [streak,         setStreak]         = useState<StreakInfo>({ current_streak: 0, longest_streak: 0, week_session_count: 0, week_start: '', max_sessions_per_week: null });
  const [pendingFriends, setPendingFriends] = useState(0);
  const [unreadAccepted, setUnreadAccepted] = useState(0);
  const [unreadChangelog, setUnreadChangelog] = useState(0);

  const [totalWods,       setTotalWods]       = useState(0);
  const [totalScoresGen,  setTotalScoresGen]  = useState(0);
  const [genStreak,       setGenStreak]       = useState(0);
  const [weekActivity,    setWeekActivity]    = useState<number[]>([0,0,0,0,0,0,0]);
  const [weekReservations, setWeekReservations] = useState<number[]>([0,0,0,0,0,0,0]);
  const [weekWodsTotal,   setWeekWodsTotal]   = useState(0);
  const [weekResTotal,    setWeekResTotal]    = useState(0);
  const [activeDayStreak, setActiveDayStreak] = useState(0);
  const [selectedDay,     setSelectedDay]     = useState<number | null>(null);
  const [totalReservations, setTotalReservations] = useState(0);
  const [favCount,        setFavCount]        = useState(0);
  const [bestScores,      setBestScores]      = useState<{name:string; value:string; type:string}[]>([]);
  const [physComps,       setPhysComps]       = useState<{id:string; name:string; logo_url:string|null; mode:string}[]>([]);

  // ── Badge unlock popup
  const [badgePopup, setBadgePopup] = useState<BadgeQueueItem | null>(null);
  const badgeQueueRef = useRef<BadgeQueueItem[]>([]);
  const popupAnim    = useRef(new Animated.Value(120)).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const popupProgress = useRef(new Animated.Value(0)).current;
  const popupTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showNextBadge() {
    if (badgeQueueRef.current.length === 0) { setBadgePopup(null); return; }
    const item = badgeQueueRef.current.shift()!;
    setBadgePopup(item);
    popupAnim.setValue(120);
    popupOpacity.setValue(0);
    popupProgress.setValue(0);
    Animated.parallel([
      Animated.spring(popupAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(popupOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    Animated.timing(popupProgress, { toValue: 1, duration: 3000, useNativeDriver: false }).start();
    if (popupTimer.current) clearTimeout(popupTimer.current);
    popupTimer.current = setTimeout(() => dismissBadgePopup(), 3200);
  }

  function dismissBadgePopup() {
    if (popupTimer.current) clearTimeout(popupTimer.current);
    Animated.parallel([
      Animated.timing(popupAnim, { toValue: 120, duration: 220, useNativeDriver: true }),
      Animated.timing(popupOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => showNextBadge());
  }

  const { data: homeData, isLoading: homeDataLoading, refetch: refetchHome } = useFocusQuery(
    ['home', user?.id, currentBox?.id],
    async () => {
      if (!user) return null;

      const rankValue = await fetchEloRank(user.elo ?? 0);
      const newsValue = await fetchHomeNews(currentBox?.id);
      const streakData = await getStreak(user.id, currentBox?.id);

      const unreadCl = await countUnreadChangelog(user.id, { screen: 'Home', action: 'countUnreadChangelog' });

      const boxFilter = currentBox?.id;
      const tourns = boxFilter
        ? await readRows(
            supabase
              .from('tournaments')
              .select('id, name, description, level, status, start_date, end_date, max_participants, prize, tournament_participants(count)')
              .in('status', ['open', 'active'])
              .is('archived_at', null)
              .eq('box_id', boxFilter)
              .order('start_date')
              .limit(6),
            { screen: 'Home', action: 'tournaments' },
          )
        : [];

      const mapped: CompetitionSummary[] = (tourns ?? []).map((t: any) => ({
        id: t.id, name: t.name, description: t.description ?? '', level: t.level ?? 'rx',
        status: t.status,
        startDate: t.start_date ? new Date(t.start_date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) : '—',
        endDate:   t.end_date   ? new Date(t.end_date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) : '—',
        participants: t.tournament_participants?.[0]?.count ?? 0,
        maxParticipants: t.max_participants ?? 0,
        prize: t.prize ?? '', wods: [],
      }));

      const { count: friendCount } = await supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('addressee_id', user.id)
        .eq('status', 'pending');
      const lastSeen = await AsyncStorage.getItem(`lastSeenFriends_${user.id}`);
      if (lastSeen) {
        const { count: acceptedCount } = await supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('requester_id', user.id)
          .eq('status', 'accepted')
          .gt('updated_at', lastSeen);
        setUnreadAccepted(acceptedCount ?? 0);
      } else {
        await AsyncStorage.setItem(`lastSeenFriends_${user.id}`, new Date().toISOString());
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const sevenDaysStr = sevenDaysAgo.toISOString();

      const [{ count: genWodCount }, { count: genScoreCount }, { count: genFavCount }, { data: genScoreWeek }, { data: boxScoreWeek }, { data: genAll }] = await Promise.all([
        supabase.from('generated_wods').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('generated_wod_scores').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('generated_wods').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_favorite', true),
        supabase.from('generated_wod_scores').select('completed_at').eq('user_id', user.id).gte('completed_at', sevenDaysStr),
        supabase.from('wod_scores').select('submitted_at').eq('member_id', user.id).gte('submitted_at', sevenDaysStr),
        supabase.from('generated_wods').select('created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      ]);

      const now = new Date();
      const todayIdx = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - todayIdx);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);

      const weekArr = [0,0,0,0,0,0,0];
      const completedTs = [
        ...(genScoreWeek ?? []).map((s: any) => s.completed_at),
        ...(boxScoreWeek ?? []).map((s: any) => s.submitted_at),
      ];
      completedTs.forEach((ts: string | null) => {
        if (!ts) return;
        const d = new Date(ts);
        if (d >= monday && d < sunday) {
          const idx = (d.getDay() + 6) % 7;
          weekArr[idx]++;
        }
      });

      const weekResArr = [0,0,0,0,0,0,0];
      let totalRes = 0;
      if (currentBox?.id) {
        const { data: resData } = await supabase
          .from('class_reservations')
          .select('id, schedule:class_schedules(scheduled_date)')
          .eq('member_id', user.id)
          .eq('box_id', currentBox.id);
        (resData ?? []).forEach((r: any) => {
          const sd = r.schedule?.scheduled_date;
          if (!sd) return;
          const d = new Date(sd + 'T00:00:00');
          if (d >= monday && d < sunday) {
            const idx = (d.getDay() + 6) % 7;
            weekResArr[idx]++;
          }
        });
        totalRes = resData?.length ?? 0;
      }

      let gs = 0;
      if (genAll && genAll.length > 0) {
        const days = [...new Set((genAll as any[]).map((w: any) => w.created_at.slice(0, 10)))];
        const td = new Date();
        for (let i = 0; i < days.length; i++) {
          const check = new Date(td);
          check.setDate(td.getDate() - i);
          if (days.includes(check.toISOString().slice(0, 10))) gs++;
          else break;
        }
      }

      const weekWodsSum = weekArr.reduce((a, b) => a + b, 0);
      const weekResSum = weekResArr.reduce((a, b) => a + b, 0);

      let dayStreak = 0;
      for (let i = todayIdx; i >= 0; i--) {
        if (weekArr[i] > 0 || weekResArr[i] > 0) dayStreak++;
        else break;
      }

      const { data: bestData } = await supabase
        .from('generated_wod_scores')
        .select('score_type, score_value, wod:generated_wods(wod_name, wod_type)')
        .eq('user_id', user.id)
        .order('score_value', { ascending: true })
        .limit(50);
      const byType: Record<string, {name:string; value:number; type:string}> = {};
      if (bestData && bestData.length > 0) {
        (bestData as any[]).forEach(s => {
          const wodType = s.wod?.wod_type ?? 'unknown';
          const key = wodType;
          if (!byType[key]) {
            byType[key] = { name: s.wod?.wod_name ?? '—', value: s.score_value, type: s.score_type };
          } else {
            if (s.score_type === 'time' && s.score_value < byType[key].value) {
              byType[key] = { name: s.wod?.wod_name ?? '—', value: s.score_value, type: s.score_type };
            } else if (s.score_type !== 'time' && s.score_value > byType[key].value) {
              byType[key] = { name: s.wod?.wod_name ?? '—', value: s.score_value, type: s.score_type };
            }
          }
        });
      }
      const bestScoresMapped = Object.entries(byType).map(([, v]) => ({
        name: v.name,
        value: formatScoreValue(v.value, v.type),
        type: v.type,
      })).slice(0, 4);

      const { data: scores } = await supabase
        .from('tournament_scores')
        .select('id, score_value, submitted_at, status, tw:tournament_wods(title)')
        .eq('athlete_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(3);

      const recentScoresMapped = (scores ?? []).map((s: any) => ({
        id: s.id, score_value: s.score_value, submitted_at: s.submitted_at,
        wod_title: (Array.isArray(s.tw) ? s.tw[0] : s.tw)?.title ?? '—',
        status: s.status,
      }));

      const { data: physData } = await supabase
        .from('physical_competitions_served')
        .select('id, name, logo_url, mode')
        .in('status', ['open', 'active'])
        .order('date', { ascending: true })
        .limit(20);

      return {
        rank: rankValue,
        news: newsValue,
        streak: streakData,
        unreadChangelog: unreadCl,
        competitions: mapped,
        pendingFriends: friendCount ?? 0,
        recentScores: recentScoresMapped,
        totalWods: genWodCount ?? 0,
        totalScoresGen: genScoreCount ?? 0,
        favCount: genFavCount ?? 0,
        weekActivity: weekArr,
        weekReservations: weekResArr,
        weekWodsTotal: weekWodsSum,
        weekResTotal: weekResSum,
        activeDayStreak: dayStreak,
        totalReservations: totalRes,
        genStreak: gs,
        bestScores: bestScoresMapped,
        physComps: (physData ?? []).map((p: any) => ({ id: p.id, name: p.name, logo_url: p.logo_url, mode: p.mode })),
      };
    },
    { enabled: !!user },
  );

  useEffect(() => {
    if (!homeData) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRank(homeData.rank);
    setNews(homeData.news);
    setStreak(homeData.streak);
    setUnreadChangelog(homeData.unreadChangelog);
    setCompetitions(homeData.competitions);
    setPendingFriends(homeData.pendingFriends);
    setRecentScores(homeData.recentScores);
    setTotalWods(homeData.totalWods);
    setTotalScoresGen(homeData.totalScoresGen);
    setFavCount(homeData.favCount);
    setWeekActivity(homeData.weekActivity);
    setWeekReservations(homeData.weekReservations);
    setWeekWodsTotal(homeData.weekWodsTotal);
    setWeekResTotal(homeData.weekResTotal);
    setActiveDayStreak(homeData.activeDayStreak);
    setTotalReservations(homeData.totalReservations);
    setGenStreak(homeData.genStreak);
    setBestScores(homeData.bestScores);
    setPhysComps(homeData.physComps);
  }, [homeData]);

  useEffect(() => {
    if (!user) return;
    const refreshCounts = async () => {
      try {
        const [{ count: pending }, lastSeen] = await Promise.all([
          supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('addressee_id', user.id).eq('status', 'pending'),
          AsyncStorage.getItem(`lastSeenFriends_${user.id}`),
        ]);
        setPendingFriends(pending ?? 0);
        if (lastSeen) {
          const { count: accepted } = await supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('requester_id', user.id).eq('status', 'accepted').gt('updated_at', lastSeen);
          setUnreadAccepted(accepted ?? 0);
        }
      } catch (e) { captureError(e, { screen: 'Home', action: 'refreshFriendCounts' }); }
    };
    const channel = supabase
      .channel(`friend-notif-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${user.id}` }, refreshCounts)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friendships', filter: `requester_id=eq.${user.id}` }, refreshCounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      // Check badge queue
      readBadgeQueue(user.id).then(async (q) => {
        if (q.length > 0) {
          await clearBadgeQueue(user.id);
          badgeQueueRef.current = q;
          showNextBadge();
        }
      });
    }, [user?.id])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      AsyncStorage.getItem(`lastSeenFriends_${user.id}`).then(async (lastSeen) => {
        try {
          if (lastSeen) {
            const { count: accepted } = await supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('requester_id', user.id).eq('status', 'accepted').gt('updated_at', lastSeen);
            setUnreadAccepted(accepted ?? 0);
          }
        } catch (e) { captureError(e, { screen: 'Home', action: 'refreshUnreadAccepted' }); }
      });
    }, [user])
  );

  const levelColor = levelInk(level, c);
  const friendsCount = pendingFriends + unreadAccepted;

  return (
    <View style={S.root}>
      <ScrollView
        style={S.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.content, { paddingBottom: tabSpace, paddingTop: insets.top + axSpacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={homeDataLoading}
            onRefresh={refetchHome}
            tintColor={c.accentText}
            colors={[c.accent]}
          />
        }
      >
        {/* ── Header row ──────────────────────────────────────────────── */}
        <View style={S.headerRow} testID="home-header">
          <View style={S.headerText}>
            <Text style={S.username} numberOfLines={1} testID="home-username">{user?.username ?? 'Athlète'}</Text>
            {currentBox && (
              <TouchableOpacity
                onPress={() => myBoxes.length > 1 ? setBoxPickerVisible(true) : null}
                activeOpacity={myBoxes.length > 1 ? 0.7 : 1}
                style={S.boxSwitchBtn}
              >
                <Building2 size={16} color={c.textMuted} />
                <Text style={S.boxSwitchText} numberOfLines={1} testID="home-box-name">{currentBox.name}</Text>
                {myBoxes.length > 1 && <ChevronDown size={16} color={c.textMuted} />}
              </TouchableOpacity>
            )}
          </View>
          {currentBox?.logo_url && (
            <TouchableOpacity onPress={() => navigation.navigate('BoxInfo')} activeOpacity={0.8} testID="home-box-logo">
              <Image source={{ uri: currentBox.logo_url }} style={[S.boxLogo, { backgroundColor: c.surface }]} />
            </TouchableOpacity>
          )}
          <View>
            <AxIconButton
              icon={Bell}
              radius={HEADER_RADIUS}
              onPress={() => navigation.navigate('Changelog' as never)}
              accessibilityLabel={t('home.whatsNew')}
              testID="home-bell"
            />
            {unreadChangelog > 0 && (
              <View style={S.bellBadge} pointerEvents="none">
                <AxCounterBadge count={unreadChangelog} testID="home-bell-badge" />
              </View>
            )}
          </View>
        </View>

        {/* ── Hero ELO card ─────────────────────────────────────────── */}
        <AxCard style={S.eloCard} testID="home-elo-card">
          <View style={S.heroTop}>
            <TouchableOpacity onPress={() => navigation.navigate('EloHistory' as never)} activeOpacity={0.7} style={S.heroElo} testID="home-elo">
              <Text style={S.heroEloNum} numberOfLines={1} testID="home-elo-value">{user?.elo ?? 1000}</Text>
              <Text style={S.heroEloLabel}>{t('home.elo')} ›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Leaderboard')}
              activeOpacity={0.7}
              style={S.heroStat}
              accessibilityRole="button"
              accessibilityLabel={rank !== null ? t('home.rankOpen', { rank }) : t('home.rankOpenNoValue')}
              testID="home-rank"
            >
              <Text style={S.heroStatNum} numberOfLines={1} testID="home-stat-value">{rank !== null ? `#${rank}` : '—'}</Text>
              <Text style={S.heroStatLabel} numberOfLines={1}>{t('home.rank')} ›</Text>
            </TouchableOpacity>
            <View style={S.heroStat}>
              <View style={S.streakValue}>
                <Flame size={14} color={c.warning} />
                <Text style={S.heroStatNum} numberOfLines={1} testID="home-stat-value">{streak.current_streak}</Text>
              </View>
              <Text style={S.heroStatLabel} numberOfLines={1}>{streak.week_session_count}/{streak.max_sessions_per_week ?? '∞'} sem.</Text>
            </View>
            <View style={S.heroStat}>
              <Text style={S.heroStatNum} numberOfLines={1} testID="home-stat-value">{user?.wins ?? 0}</Text>
              <Text style={S.heroStatLabel} numberOfLines={1}>{t('home.wins')}</Text>
            </View>
          </View>

          <View style={S.heroLevelRow}>
            <AxStatusDot label={level.toUpperCase()} color={levelColor} testID="home-level" />
            <Text style={S.matchesTxt} numberOfLines={1}>{user?.total_matches ?? 0} matchs</Text>
          </View>
        </AxCard>

        {/* ── Action buttons ─────────────────────────────────────────── */}
        <View style={S.actionRow} testID="home-actions">
          <View style={S.actionCell}>
            <AxButton
              variant="outline"
              fullWidth
              icon={Users}
              onPress={() => navigation.navigate('Friends')}
              label={t('home.friends')}
              testID="home-friends"
            />
            {friendsCount > 0 && (
              <View style={S.actionBadge} pointerEvents="none">
                <AxCounterBadge count={friendsCount} testID="home-friends-badge" />
              </View>
            )}
          </View>
          <View style={S.actionCell}>
            <AxButton
              variant="outline"
              fullWidth
              icon={User}
              onPress={() => navigation.navigate('Profile')}
              label={t('tabs.profile')}
              testID="home-profile"
            />
          </View>
        </View>

        {/* ── Actu de ta box ──────────────────────────────────────────── */}
        <HomeNewsCard
          news={currentBox ? news : null}
          onOpen={() => navigation.getParent?.()?.navigate('Whiteboard', { screen: 'Articles' })}
        />

        {/* ── Cette semaine ──────────────────────────────────────────── */}
        {(totalWods > 0 || genStreak > 0 || totalReservations > 0 || weekReservations.some(r => r > 0)) && (
          <AxCard style={S.weekCard} testID="home-week">
            <View style={S.sectionHeader}>
              <View style={S.weekTitleRow}>
                <Text style={S.sectionTitle} numberOfLines={1} testID="home-section-title">{t('home.thisWeek')}</Text>
                {activeDayStreak >= 3 && (
                  <View style={S.streakBadge}>
                    <Flame color={c.accentText} size={12} />
                    <Text style={S.streakTxt}>{t('home.dayStreak', { count: activeDayStreak })}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('WodHistory')} activeOpacity={0.7} testID="home-history">
                <Text style={S.linkText}>{t('home.history')}</Text>
              </TouchableOpacity>
            </View>

            <View style={S.weekRow}>
              {['L','M','M','J','V','S','D'].map((day, i) => {
                const wods = weekActivity[i];
                const res = weekReservations[i];
                const maxAll = Math.max(...weekActivity, ...weekReservations, 1);
                const hWod = wods > 0 ? Math.max(4, (wods / maxAll) * 32) : 0;
                const hRes = res > 0 ? Math.max(4, (res / maxAll) * 32) : 0;
                const isToday = i === (new Date().getDay() + 6) % 7;
                const isSelected = selectedDay === i;
                const hasActivity = wods > 0 || res > 0;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[S.weekCol, isSelected && S.weekColSelected]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedDay(isSelected ? null : i)}
                  >
                    <View style={S.weekBars}>
                      {hRes > 0 && <View style={[S.weekBar, { height: hRes, backgroundColor: c.accent }]} />}
                      {hWod > 0 && <View style={[S.weekBar, { height: hWod, backgroundColor: c.text }]} />}
                      {!hasActivity && <View testID="home-week-track" style={[S.weekBar, { height: 4, backgroundColor: c.border }]} />}
                    </View>
                    <Text style={isToday ? S.weekDayToday : S.weekDayTxt}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedDay !== null && (
              <Text style={S.dayDetailTxt}>
                {t('home.dayDetail', {
                  day: (t('home.dayNamesFull', { returnObjects: true }) as string[])[selectedDay],
                  res: weekReservations[selectedDay],
                  wods: weekActivity[selectedDay],
                })}
              </Text>
            )}

            <View style={S.legendRow}>
              <View style={S.legendItem}>
                <View style={[S.legendDot, { backgroundColor: c.text }]} />
                <Text style={S.legendText}>{t('home.wodsCompleted')}</Text>
              </View>
              <View style={S.legendItem}>
                <View style={[S.legendDot, { backgroundColor: c.accent }]} />
                <Text style={S.legendText}>{t('home.reservations')}</Text>
              </View>
            </View>

            <Text style={S.weekTotalTxt}>{t('home.weekTotal', { res: weekResTotal, wods: weekWodsTotal })}</Text>

            <View style={S.progStrip}>
              {[
                { val: totalWods, lbl: 'WODs' },
                { val: totalScoresGen, lbl: 'Scores' },
                { val: genStreak, lbl: 'Streak' },
                { val: totalReservations, lbl: t('home.reservations') },
              ].map(s => (
                <View key={s.lbl} style={S.progItem}>
                  <Text style={S.progItemNum} numberOfLines={1}>{s.val}</Text>
                  <Text style={S.progItemLbl} numberOfLines={1}>{s.lbl}</Text>
                </View>
              ))}
            </View>

            {bestScores.length > 0 && (
              <View style={S.prBlock}>
                <Text style={S.prBlockTitle}>{t('home.personalRecords')}</Text>
                {bestScores.map((pr, i) => (
                  <View key={i} style={S.prLine}>
                    <Medal size={16} color={c.accentText} />
                    <Text style={S.prLineName} numberOfLines={2}>{pr.name}</Text>
                    <Text style={S.prLineVal}>{pr.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </AxCard>
        )}

        {/* ── Explorer ────────────────────────────────────────────────── */}
        <Text style={S.sectionTitle} testID="home-section-title">{t('home.explorer.title')}</Text>
        <HomeExplorerBlock onOpen={(route) => navigation.navigate(route)} />

        {/* ── Box Picker Modal ──────────────────────────────────────── */}
        <Modal visible={boxPickerVisible} transparent animationType="slide" onRequestClose={() => setBoxPickerVisible(false)}>
          <Pressable style={S.boxPickerOverlay} onPress={() => setBoxPickerVisible(false)}>
            <Pressable onPress={() => {}} style={S.boxPickerSheetWrap}>
              <View style={S.boxPickerSheet}>
                <View style={S.boxPickerHandle} />
                <Text style={S.boxPickerTitle}>{t('home.myBoxes')}</Text>
                {myBoxes.map(entry => {
                  const isActive = entry.box.id === currentBox?.id;
                  return (
                    <TouchableOpacity
                      key={entry.box.id}
                      style={[S.boxPickerRow, isActive && S.boxPickerRowActive]}
                      onPress={() => { switchBox(entry.box.id); setBoxPickerVisible(false); }}
                      activeOpacity={0.7}
                    >
                      {entry.box.logo_url ? (
                        <Image source={{ uri: entry.box.logo_url }} style={S.boxPickerLogo} />
                      ) : (
                        <View style={[S.boxPickerLogo, S.pastille]}>
                          <Building2 size={18} color={c.textMuted} />
                        </View>
                      )}
                      <View style={S.flexShrink}>
                        <Text style={[S.boxPickerName, isActive && { color: c.accentText }]} numberOfLines={1}>{entry.box.name}</Text>
                        <Text style={S.boxPickerRole}>{entry.role === 'owner' ? 'Propriétaire' : entry.role === 'coach' ? 'Coach' : 'Membre'}</Text>
                      </View>
                      {isActive && <Check size={18} color={c.accentText} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

      {/* ── Badge unlock popup ──────────────────────────────────────── */}
      {badgePopup && (
        <Animated.View
          style={[S.badgePopupWrap, {
            bottom: tabSpace,
            transform: [{ translateY: popupAnim }],
            opacity: popupOpacity,
          }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity onPress={dismissBadgePopup} activeOpacity={0.9} style={S.badgePopupCard}>
            <View style={S.badgePopupIconRow}>
              <Text style={S.badgePopupIcon}>{badgePopup.icon}</Text>
              <View style={S.flexShrink}>
                <View style={S.badgePopupHeaderRow}>
                  <Medal size={12} color={c.accentText} />
                  <Text style={S.badgePopupHeader}>Badge débloqué !</Text>
                </View>
                <Text style={S.badgePopupTitle}>{badgePopup.title}</Text>
                <Text style={S.badgePopupDesc} numberOfLines={2}>{badgePopup.description}</Text>
              </View>
            </View>
            <View style={S.badgeProgressTrack}>
              <Animated.View style={[S.badgeProgressFill, {
                width: popupProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

        {/* ── Compétitions physiques ─────────────────────────────────── */}
        {physComps.length > 0 && (
          <>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle} numberOfLines={1} testID="home-section-title">{t('home.competitions')}</Text>
              <TouchableOpacity
                onPress={() => {
                  const nav = navigation.getParent?.();
                  if (nav) nav.navigate('Competitions', { screen: 'CompetitionList', params: { initialTab: 2 } });
                }}
                activeOpacity={0.7}
                testID="home-see-competitions"
              >
                <Text style={S.linkText}>{t('home.seeList')} ›</Text>
              </TouchableOpacity>
            </View>
            <AutoScrollCarousel
              data={physComps}
              itemWidth={140}
              gap={12}
              speed={30}
              renderItem={(item) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    const nav = navigation.getParent?.();
                    if (nav) nav.navigate('Competitions', { screen: 'PhysicalCompetition', params: { mode: item.mode as any, selectedId: item.id } });
                  }}
                  testID="home-competition-card"
                >
                  <AxCard style={S.compPhysCard}>
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={[S.compPhysPastille, { backgroundColor: c.background }]} resizeMode="contain" />
                    ) : (
                      <View style={[S.compPhysPastille, S.pastille]}>
                        <Trophy color={c.accentText} size={32} />
                      </View>
                    )}
                    <Text numberOfLines={2} style={S.compPhysName}>{item.name}</Text>
                  </AxCard>
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {/* ── Tournois ────────────────────────────────────────────────── */}
        {competitions.length > 0 && (
          <>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle} numberOfLines={1} testID="home-section-title">{t('home.tournaments')}</Text>
              <TouchableOpacity
                onPress={() => {
                  const nav = navigation.getParent?.();
                  if (nav) nav.navigate('Competitions', { screen: 'CompetitionList', params: { initialTab: 0 } });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('home.seeAllTournaments')}
                testID="home-see-tournaments"
              >
                <Text style={S.linkText}>{t('home.seeAllTournaments')} ›</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.hList}>
              {competitions.map((comp: CompetitionSummary) => (
                <TouchableOpacity
                  key={comp.id}
                  onPress={() => navigation.navigate('CompetitionDetail', { competition: comp })}
                  activeOpacity={0.85}
                  testID="home-tournament-card"
                >
                  <AxCard style={S.compCard}>
                    <View style={[S.compPastille, S.pastille]}>
                      <Trophy color={c.accentText} size={20} />
                    </View>
                    <Text style={S.compStatus} numberOfLines={1}>{comp.status === 'open' ? t('home.tournamentStatus.open') : comp.status === 'active' ? t('home.tournamentStatus.active') : t('home.tournamentStatus.closed')}</Text>
                    <Text style={S.compName} numberOfLines={2}>{comp.name}</Text>
                    <Text style={S.compMeta} numberOfLines={1}>{t('home.tournamentParticipants', { n: comp.participants, max: comp.maxParticipants })}</Text>
                    <Text style={S.compMeta} numberOfLines={1}>{comp.startDate}</Text>
                  </AxCard>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Résultats récents ─────────────────────────────────────── */}
        <Text style={S.sectionTitle} testID="home-section-title">{t('home.recentResults')}</Text>
        {recentScores.length === 0 ? (
          <AxCard testID="home-results-empty">
            <Text style={S.emptyText}>{t('home.noScores')}</Text>
          </AxCard>
        ) : (
          <View style={S.resultList}>
            {recentScores.map(r => (
              <AxCard key={r.id} style={S.resultRow} testID="home-result">
                <View style={[S.resultAvatar, S.pastille]}>
                  <Text style={S.resultAvatarTxt}>{r.wod_title[0]}</Text>
                </View>
                <View style={S.flexShrink}>
                  <Text style={S.resultTitle} numberOfLines={1}>{r.wod_title}</Text>
                  <Text style={S.resultDate}>
                    {new Date(r.submitted_at).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <View style={S.resultRight}>
                  <Text testID="home-result-status" style={[S.resultStatus, {
                    color: r.status === 'approved' ? c.success : r.status === 'rejected' ? c.danger : c.textMuted,
                  }]}>
                    {r.status === 'approved' ? 'Validé' : r.status === 'rejected' ? 'Rejeté' : 'En attente'}
                  </Text>
                  <Text style={S.resultScore} numberOfLines={1}>{r.score_value}</Text>
                </View>
              </AxCard>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Interactive tour overlay — shown once after onboarding */}
      <InteractiveTour />
    </View>
  );
}

const HEADER_RADIUS = 12;

function createStyles(t: AppTheme) {
  const c = t.ax;

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    container: { flex: 1, backgroundColor: 'transparent' },
    content: { paddingHorizontal: axSpacing.xl, gap: axSpacing.lg },
    flexShrink: { flex: 1, minWidth: 0 },
    pastille: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.background, borderWidth: 1, borderColor: c.border },

    // Header row
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerText: { flex: 1, minWidth: 0, gap: axSpacing.xs },
    username: { ...axTypography.titleXL, lineHeight: axAccentSafeLineHeight.titleXL, color: c.text },
    boxLogo: { width: 44, height: 44, borderRadius: HEADER_RADIUS },
    boxSwitchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%' },
    boxSwitchText: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1 },
    bellBadge: { position: 'absolute', top: -5, right: -5 },

    // Hero ELO card
    eloCard: { borderRadius: axRadius.card, padding: axSpacing.lg, gap: axSpacing.md },
    heroTop: { flexDirection: 'row', alignItems: 'center' },
    heroElo: { alignItems: 'center', minWidth: 96 },
    heroEloNum: { ...axTypography.numberL, color: c.accentText },
    heroEloLabel: { ...axTypography.overlineSmall, color: c.textMuted },
    heroStat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
    streakValue: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    heroStatNum: { ...axTypography.numberM, color: c.text },
    heroStatLabel: { ...axTypography.caption, color: c.textMuted },
    heroLevelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.sm },
    matchesTxt: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1 },

    // Action row
    actionRow: { flexDirection: 'row', gap: axSpacing.md },
    actionCell: { flex: 1 },
    actionBadge: { position: 'absolute', top: -5, right: -5 },

    // Section header
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.md },
    sectionTitle: { ...axTypography.titleM, color: c.text, flexShrink: 1 },
    linkText: { ...axTypography.labelSmall, color: c.accentText },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted },

    // Week activity
    weekCard: { padding: axSpacing.lg, gap: 14 },
    weekTitleRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, flexShrink: 1 },
    streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: c.accentText, borderRadius: axRadius.badge, paddingHorizontal: 6, paddingVertical: 2 },
    streakTxt: { ...axTypography.labelSmall, color: c.accentText },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    weekCol: { alignItems: 'center', flex: 1, gap: axSpacing.sm, paddingVertical: axSpacing.xs, borderRadius: axRadius.control },
    weekColSelected: { backgroundColor: withAlpha(c.accent, 0.12) },
    weekBars: { alignItems: 'center', justifyContent: 'flex-end', gap: 2, minHeight: 36 },
    weekBar: { width: 22, borderRadius: 2, minHeight: 4 },
    weekDayTxt: { ...axTypography.bodySmall, color: c.textMuted },
    weekDayToday: { ...axTypography.labelSmall, color: c.text },
    dayDetailTxt: { ...axTypography.bodySmall, color: c.text, textAlign: 'center' },
    weekTotalTxt: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },

    // Legend
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 9, height: 9, borderRadius: 2 },
    legendText: { ...axTypography.caption, color: c.textMuted },

    // Progression strip
    progStrip: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border, paddingTop: axSpacing.md },
    progItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
    progItemNum: { ...axTypography.numberM, color: c.text },
    progItemLbl: { ...axTypography.caption, color: c.textMuted },

    // PRs
    prBlock: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: axSpacing.md, gap: axSpacing.sm },
    prBlockTitle: { ...axTypography.label, color: c.text },
    prLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    prLineName: { flex: 1, minWidth: 0, ...axTypography.bodySmall, color: c.textMuted },
    prLineVal: { ...axTypography.label, color: c.text },

    // Comps
    hList: { gap: axSpacing.md },
    compCard: { width: 170, padding: axSpacing.lg, gap: 6 },
    compPastille: { width: 44, height: 44, borderRadius: HEADER_RADIUS },
    compStatus: { ...axTypography.labelSmall, color: c.accentText },
    compName: { ...axTypography.label, color: c.text },
    compMeta: { ...axTypography.caption, color: c.textMuted },
    compPhysCard: { width: 140, height: 160, paddingVertical: 14, paddingHorizontal: axSpacing.lg, gap: axSpacing.sm, alignItems: 'center' },
    compPhysPastille: { width: 72, height: 72, borderRadius: 20 },
    compPhysName: { ...axTypography.labelSmall, color: c.text, textAlign: 'center' },

    // Results
    resultList: { gap: axSpacing.lg },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, paddingVertical: axSpacing.md, paddingHorizontal: axSpacing.lg },
    resultAvatar: { width: 40, height: 40, borderRadius: 20 },
    resultAvatarTxt: { ...axTypography.label, color: c.text },
    resultTitle: { ...axTypography.label, color: c.text },
    resultDate: { ...axTypography.caption, color: c.textMuted },
    resultRight: { alignItems: 'flex-end', maxWidth: '45%' },
    resultStatus: { ...axTypography.labelSmall },
    resultScore: { ...axTypography.numberM, color: c.text },

    // Badge unlock popup
    badgePopupWrap: {
      position: 'absolute', bottom: 100, left: axSpacing.lg, right: axSpacing.lg, zIndex: 99,
    },
    badgePopupCard: {
      backgroundColor: c.surface,
      borderRadius: axRadius.card, padding: axSpacing.lg,
      borderWidth: 1, borderColor: c.accentText,
      elevation: 10,
    },
    badgePopupIconRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
    badgePopupIcon: { fontSize: 44 },
    badgePopupHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, marginBottom: 2 },
    badgePopupHeader: { ...axTypography.overlineSmall, color: c.accentText },
    badgePopupTitle: { ...axTypography.label, color: c.text, marginBottom: 2 },
    badgePopupDesc: { ...axTypography.caption, color: c.textMuted },
    badgeProgressTrack: { height: 3, backgroundColor: c.border, borderRadius: 2, overflow: 'hidden' },
    badgeProgressFill: { height: '100%', backgroundColor: c.accent, borderRadius: 2 },

    // Box picker modal
    boxPickerOverlay: { flex: 1, backgroundColor: t.modalBackdrop, justifyContent: 'flex-end', paddingBottom: axSpacing.xl },
    boxPickerSheetWrap: { paddingHorizontal: axSpacing.lg },
    boxPickerSheet: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: axRadius.card, paddingHorizontal: axSpacing.lg, paddingBottom: axSpacing.xl, paddingTop: axSpacing.md },
    boxPickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: axSpacing.md },
    boxPickerTitle: { ...axTypography.titleM, color: c.text, marginBottom: axSpacing.md },
    boxPickerRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, padding: axSpacing.sm, borderRadius: axRadius.control, marginBottom: axSpacing.xs },
    boxPickerRowActive: { backgroundColor: withAlpha(c.accent, 0.12) },
    boxPickerLogo: { width: 40, height: 40, borderRadius: HEADER_RADIUS },
    boxPickerName: { ...axTypography.label, color: c.text },
    boxPickerRole: { ...axTypography.caption, color: c.textMuted },
  });
}
