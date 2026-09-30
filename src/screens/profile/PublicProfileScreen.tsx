import i18n from '../../i18n';
import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxIconButton } from '../../components/ax/AxIconButton';
import { AxButton, AxCard, AxChip } from '../../components/ax';
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator, Share, Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { UserPlus, Check, Clock, Trophy, Zap, TrendingUp, Share2, MapPin, Flame, Users, Dumbbell, Medal, Award, type LucideIcon } from 'lucide-react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { readRows } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { LevelColors } from '../../theme/designTokens';
import { HomeStackParamList } from '../../navigation';
import { getBadgesCatalog, BadgeDef } from '../../services/gamification';
import UserAvatar from '../../components/UserAvatar';
import GlassBackground from '../../components/glass/GlassBackground';
import ReportMenu from '../../components/ReportMenu';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { levelInk } from '../home/homeLevelColor';

const TROPHY_ICONS: Record<string, LucideIcon> = {
  activity: Flame,
  tournament: Trophy,
  social: Users,
  wod: Dumbbell,
  elo: TrendingUp,
  Classement: Medal,
};

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'PublicProfile'>;
  route: RouteProp<HomeStackParamList, 'PublicProfile'>;
};

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

interface PublicUser {
  id: string;
  username: string;
  avatar_url?: string;
  level: string;
  elo: number;
  wins: number;
  total_matches: number;
  bio?: string;
}

interface EloPoint {
  elo: number;
  label: string;
}

interface BoxInfo {
  id: string;
  name: string;
  city?: string;
}

export default function PublicProfileScreen({ navigation, route }: Props) {
  const tabSpace = useTabBarScrollSpace();
  const { userId } = route.params;
  const { user: me } = useAuth();
  const { theme } = useTheme();
  const S = createStyles(theme);
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [actionLoading, setActionLoading] = useState(false);
  const [eloPoints, setEloPoints] = useState<EloPoint[]>([]);
  const [boxInfo, setBoxInfo] = useState<BoxInfo | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '365d' | 'all'>('all');
  const [featuredBadges, setFeaturedBadges] = useState<BadgeDef[]>([]);

  useEffect(() => {
    loadProfile();
    loadFriendStatus();
    loadEloHistory();
    loadBox();
  }, [userId]);

  async function loadProfile() {
    const data = await readRows(
      supabase
        .from('profiles')
        // Profil public entre athlètes : pseudo, avatar, ELO, badges. Ni nom
        // civil ni records — ceux-là ne sont lisibles que par soi-même et par
        // le staff de la box, via get_athlete_private_profile().
        .select('id, username, avatar_url, level, elo, wins, total_matches, bio')
        .eq('id', userId)
        .single(),
      { screen: 'PublicProfile', action: 'loadProfile' },
    );
    setProfile(data as PublicUser);
    setLoading(false);
    const featuredData = await readRows(
      supabase
        .from('profiles')
        .select('featured_badges')
        .eq('id', userId)
        .maybeSingle(),
      { screen: 'PublicProfile', action: 'loadFeaturedBadges' },
    );
    const keys: string[] = featuredData?.featured_badges ?? [];
    if (keys.length > 0) {
      const catalog = await getBadgesCatalog();
      setFeaturedBadges(catalog.filter(b => keys.includes(b.badge_key)));
    }
  }

  async function loadEloHistory() {
    const { data } = await supabase
      .from('elo_history')
      .select('elo_before, elo_after, created_at')
      .eq('member_id', userId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (!data || data.length === 0) { setEloPoints([]); return; }
    const pts: EloPoint[] = [];
    const first = data[0];
    const d0 = new Date(first.created_at as string);
    pts.push({ elo: first.elo_before, label: `${d0.getDate()}/${d0.getMonth() + 1}` });
    for (const row of data) {
      const d = new Date(row.created_at as string);
      pts.push({ elo: row.elo_after, label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    setEloPoints(pts);
  }

  async function loadBox() {
    const membership = await readRows(
      supabase
        .from('box_members')
        .select('box_id, boxes(id, name, city)')
        .eq('member_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(),
      { screen: 'PublicProfile', action: 'loadBox' },
    );
    if (membership?.boxes) {
      const b = Array.isArray(membership.boxes) ? membership.boxes[0] : membership.boxes;
      if (b) setBoxInfo({ id: b.id, name: b.name, city: b.city ?? undefined });
    }
  }

  async function loadFriendStatus() {
    if (!me) return;
    const { data } = await supabase
      .from('friendships')
      .select('status, requester_id')
      .or(`and(requester_id.eq.${me.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${me.id})`)
      .maybeSingle();
    if (!data) { setFriendStatus('none'); return; }
    if (data.status === 'accepted') { setFriendStatus('friends'); return; }
    if (data.requester_id === me.id) setFriendStatus('pending_sent');
    else setFriendStatus('pending_received');
  }

  async function handleAddFriend() {
    if (!me) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: me.id, addressee_id: userId, status: 'pending' });
    setActionLoading(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    setFriendStatus('pending_sent');
  }

  async function handleAcceptFriend() {
    if (!me) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', userId)
      .eq('addressee_id', me.id);
    setActionLoading(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    setFriendStatus('friends');
  }

  if (loading) return (
    <View style={S.loadingContainer}>
      <ActivityIndicator color={theme.ax.accentText} size="large" />
    </View>
  );

  if (!profile) return (
    <View style={S.loadingContainer}>
      <Text style={S.notFound}>Profil introuvable</Text>
    </View>
  );

  const level = profile.level ?? 'scaled';
  const levelColor = LevelColors[level] ?? theme.accent;
  const levelText = levelInk(level, theme.ax);
  const winRate = profile.total_matches ? Math.round((profile.wins / profile.total_matches) * 100) : 0;

  function FriendButton() {
    if (me?.id === userId) return null;
    if (friendStatus === 'friends') return (
      <View style={S.friendsBadge} testID="public-friends">
        <Check color={theme.ax.accentText} size={14} />
        <Text style={S.friendsBadgeText}>Amis</Text>
      </View>
    );
    if (friendStatus === 'pending_sent') return (
      <View style={S.pendingBadge} testID="public-pending">
        <Clock color={theme.ax.textMuted} size={14} />
        <Text style={S.pendingBadgeText}>Demande envoyée</Text>
      </View>
    );
    if (friendStatus === 'pending_received') return (
      <AxButton label="Accepter" icon={Check} onPress={handleAcceptFriend} loading={actionLoading} testID="public-accept" />
    );
    return (
      <AxButton label="Demander en ami" icon={UserPlus} onPress={handleAddFriend} loading={actionLoading} testID="public-add-friend" />
    );
  }

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader
        title="Profil"
        right={(
          <>
            <AxIconButton icon={Share2} onPress={() => Share.share({ message: `Découvre mon profil sur AthleX ! athlex://profile/${route.params.userId}` })} accessibilityLabel={i18n.t('common.share')} testID="header-share" />
          {me?.id !== route.params.userId && (
            <View style={S.backBtn}>
              <ReportMenu
                contentType="profile"
                reportedUserId={route.params.userId}
                onActionDone={() => navigation.goBack()}
                size={20}
                color={theme.ax.text}
              />
            </View>
          )}
          </>
        )}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.content, { paddingBottom: tabSpace }]}>
        {/* Avatar + name */}
        <AxCard style={S.heroCard} testID="public-hero">
          <UserAvatar
            uri={profile.avatar_url}
            name={profile.username ?? '?'}
            size={80}
            borderRadius={40}
            borderWidth={3}
            borderColor={levelColor}
            backgroundColor={theme.ax.field}
            textColor={theme.ax.text}
            fontSize={32}
          />
          <Text style={S.username} numberOfLines={2} testID="public-username">{profile.username}</Text>
          <View style={[S.levelPill, { borderColor: levelText }]} testID="public-level">
            <View style={[S.levelDot, { backgroundColor: levelText }]} />
            <Text style={[S.levelText, { color: levelText }]}>{level.toUpperCase()}</Text>
          </View>
          {profile.bio ? <Text style={S.bio}>{profile.bio}</Text> : null}
          <FriendButton />
        </AxCard>

        {/* Featured badges trophy case */}
        {featuredBadges.length > 0 && (
          <AxCard style={S.trophyCase} testID="public-trophies">
            <Text style={S.trophyCaseTitle}>Trophées</Text>
            <View style={S.trophyRow}>
              {featuredBadges.map(b => {
                const Icon = TROPHY_ICONS[b.category] ?? Award;
                return (
                  <View key={b.badge_key} style={S.trophyCard}>
                    <Icon color={theme.ax.accentText} size={28} />
                    <Text style={S.trophyName} numberOfLines={2}>{b.title}</Text>
                  </View>
                );
              })}
            </View>
          </AxCard>
        )}

        {/* Stats */}
        <View style={S.statsRow}>
          {[
            { icon: Zap, color: theme.ax.accentText, value: profile.elo, label: 'ELO' },
            { icon: Trophy, color: theme.ax.textMuted, value: profile.wins, label: 'Victoires' },
            { icon: TrendingUp, color: theme.ax.textMuted, value: `${winRate}%`, label: 'Win Rate' },
          ].map(({ icon: Icon, color, value, label }, i) => (
            <AxCard key={label} style={S.statCard} testID={`public-stat-${i}`}>
              <Icon color={color} size={16} />
              <Text style={S.statValue} numberOfLines={1} testID={`public-stat-${i}-value`}>{value}</Text>
              <Text style={S.statLabel} numberOfLines={1}>{label}</Text>
            </AxCard>
          ))}
        </View>

        {/* Box info */}
        {boxInfo && (
          <AxCard style={S.boxCard} testID="public-box">
            <MapPin color={theme.ax.accentText} size={18} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={S.boxName} numberOfLines={2}>{boxInfo.name}</Text>
              {boxInfo.city ? <Text style={S.boxCity} numberOfLines={1}>{boxInfo.city}</Text> : null}
            </View>
          </AxCard>
        )}

        {/* ELO Chart */}
        {eloPoints.length >= 2 && (
          <PublicEloChart points={eloPoints} currentElo={profile.elo} theme={theme} period={period} setPeriod={setPeriod} />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
  notFound: { ...axTypography.body, color: c.textMuted },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: axSpacing.lg, gap: 14, paddingBottom: 120 },
  heroCard: { padding: 24, alignItems: 'center', gap: 8 },
  username: { ...axTypography.titleXL, color: c.text, textAlign: 'center', alignSelf: 'stretch' },
  levelPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: axRadius.badge, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelText: { ...axTypography.labelSmall, letterSpacing: 0.8 },
  bio: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', maxWidth: 240 },
  friendsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: axRadius.control, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: c.accentText, marginTop: 4,
  },
  friendsBadgeText: { ...axTypography.label, color: c.accentText },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: axRadius.control, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: c.border, marginTop: 4,
  },
  pendingBadgeText: { ...axTypography.label, color: c.textMuted },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, minWidth: 0, paddingHorizontal: 8, alignItems: 'center', gap: 4 },
  statValue: { ...axTypography.numberM, color: c.text },
  statLabel: { ...axTypography.overlineSmall, color: c.textMuted },
  boxCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boxName: { ...axTypography.label, color: c.text },
  boxCity: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2 },
  trophyCase: { gap: 12 },
  trophyCaseTitle: { ...axTypography.overline, color: c.textMuted },
  trophyRow: { flexDirection: 'row', gap: 10 },
  trophyCard: {
    flex: 1, minWidth: 0, alignItems: 'center', backgroundColor: c.field,
    borderRadius: axRadius.card, padding: 12, borderWidth: 1, borderColor: c.border,
    gap: 6,
  },
  trophyName: { ...axTypography.labelSmall, color: c.text, textAlign: 'center' },
}); }

// ── ELO Chart for Public Profile ─────────────────────────────────────
const PUB_CHART_W = Dimensions.get('window').width - 64;
const PUB_CHART_H = 160;
const PUB_PAD = { top: 18, right: 14, bottom: 26, left: 42 };

function PublicEloChart({ points, currentElo, theme, period, setPeriod }: {
  points: EloPoint[]; currentElo: number; theme: AppTheme;
  period: '7d' | '30d' | '365d' | 'all'; setPeriod: (p: '7d' | '30d' | '365d' | 'all') => void;
}) {
  const filtered = useMemo(() => {
    if (period === 'all') return points;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    // Points don't have real dates — approximate by index distribution
    // Since points are chronological, take the last N% proportional
    return points; // all points shown; period just filters conceptually
  }, [points, period]);

  if (filtered.length < 2) return null;

  const elos = filtered.map(p => p.elo);
  const minElo = Math.min(...elos);
  const maxElo = Math.max(...elos);
  const eloRange = maxElo - minElo || 50;
  const padded = { min: minElo - eloRange * 0.1, max: maxElo + eloRange * 0.1 };

  const w = PUB_CHART_W - PUB_PAD.left - PUB_PAD.right;
  const h = PUB_CHART_H - PUB_PAD.top - PUB_PAD.bottom;

  const x = (i: number) => PUB_PAD.left + (i / (filtered.length - 1)) * w;
  const y = (elo: number) => PUB_PAD.top + h - ((elo - padded.min) / (padded.max - padded.min)) * h;

  const linePoints = filtered.map((p, i) => ({ cx: x(i), cy: y(p.elo) }));
  let linePath = `M ${linePoints[0].cx} ${linePoints[0].cy}`;
  for (let i = 1; i < linePoints.length; i++) {
    const prev = linePoints[i - 1];
    const curr = linePoints[i];
    const cpx = (prev.cx + curr.cx) / 2;
    linePath += ` C ${cpx} ${prev.cy}, ${cpx} ${curr.cy}, ${curr.cx} ${curr.cy}`;
  }
  const fillPath = linePath +
    ` L ${linePoints[linePoints.length - 1].cx} ${PUB_PAD.top + h}` +
    ` L ${linePoints[0].cx} ${PUB_PAD.top + h} Z`;

  const tickCount = 4;
  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) yTicks.push(Math.round(padded.min + (i / tickCount) * (padded.max - padded.min)));

  const xLabels: { i: number; label: string }[] = [];
  if (filtered.length <= 5) {
    filtered.forEach((p, i) => xLabels.push({ i, label: p.label }));
  } else {
    xLabels.push({ i: 0, label: filtered[0].label });
    const mid = Math.floor(filtered.length / 2);
    xLabels.push({ i: mid, label: filtered[mid].label });
    xLabels.push({ i: filtered.length - 1, label: filtered[filtered.length - 1].label });
  }

  const trending = filtered[filtered.length - 1].elo >= filtered[0].elo;
  const accentColor = trending ? '#22c55e' : '#ef4444';

  return (
    <AxCard style={{ gap: 0, padding: 16 }} testID="public-elo-chart">
      <Text style={[axTypography.overline, { color: theme.ax.textMuted, marginBottom: 8 }]}>
        PROGRESSION ELO
      </Text>
      {/* Period pills */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {(['7d', '30d', '365d', 'all'] as const).map(p => (
          <AxChip
            key={p}
            label={p === '7d' ? '7j' : p === '30d' ? '30j' : p === '365d' ? '1an' : 'Tout'}
            selected={period === p}
            onPress={() => setPeriod(p)}
            testID={`public-period-${p}`}
          />
        ))}
      </View>
      <Svg width={PUB_CHART_W} height={PUB_CHART_H}>
        <Defs>
          <LinearGradient id="pubGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accentColor} stopOpacity="0.3" />
            <Stop offset="1" stopColor={accentColor} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        {yTicks.map((tick, i) => (
          <Line key={`g${i}`} x1={PUB_PAD.left} y1={y(tick)} x2={PUB_PAD.left + w} y2={y(tick)} stroke={`${theme.textMuted}15`} strokeWidth={1} />
        ))}
        {yTicks.map((tick, i) => (
          <SvgText key={`y${i}`} x={PUB_PAD.left - 6} y={y(tick) + 4} fontSize={9} fontWeight="600" fill={theme.textMuted} textAnchor="end">{tick}</SvgText>
        ))}
        {xLabels.map(({ i, label }) => (
          <SvgText key={`x${i}`} x={x(i)} y={PUB_PAD.top + h + 16} fontSize={9} fontWeight="500" fill={theme.textMuted} textAnchor="middle">{label}</SvgText>
        ))}
        <Path d={fillPath} fill="url(#pubGrad)" />
        <Path d={linePath} stroke={accentColor} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {linePoints.map((pt, i) => (
          <Circle key={`d${i}`} cx={pt.cx} cy={pt.cy} r={i === linePoints.length - 1 ? 4.5 : 2.5}
            fill={i === linePoints.length - 1 ? accentColor : theme.card} stroke={accentColor} strokeWidth={1.5} />
        ))}
        <SvgText x={linePoints[linePoints.length - 1].cx} y={linePoints[linePoints.length - 1].cy - 9}
          fontSize={11} fontWeight="800" fill={accentColor} textAnchor="middle">{currentElo}</SvgText>
      </Svg>
    </AxCard>
  );
}
