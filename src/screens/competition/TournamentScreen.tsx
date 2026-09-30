import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Share,
} from 'react-native';
import {
  Users, Calendar, Zap, CheckCircle, Lock, Clock, Timer, UserX, Shield, Star, XCircle, MessageSquare, Share2,
  UserPlus, Swords, Dumbbell, Layers, Trophy, Video, ClipboardList, type LucideIcon,
} from 'lucide-react-native';
import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxButton, AxCard, AxChip, AxIconButton, AxStatusDot, AxTag } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { scheduleTournamentReminder } from '../../services/notifications';
import { CompetitionStackParamList } from '../../navigation';
import {
  TournamentWOD, TournamentScore,
  formatDate,
  formatScoreDisplay,
} from '../../utils/tournamentUtils';
import {
  chargerClassement, chargerGeneralSaison, classementGeneral, classementWod, ongletsClassement, saisonsTerminees,
  LigneClassement, RangWod,
} from '../../utils/classementTournoi';
import { trackTournamentJoin } from '../../lib/analytics';
import GlassBackground from '../../components/glass/GlassBackground';
import TournamentBracketView from './TournamentBracketView';
import TournamentDivisionsView from './TournamentDivisionsView';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import i18n from '../../i18n';
import { tournamentRefusal } from '../../utils/refusals';
import { libelleEtape } from '../../utils/bracketWods';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { useConfirmDialog } from '../../components/ConfirmDialog';

type Nav   = NativeStackNavigationProp<CompetitionStackParamList, 'Tournament'>;
type Route = RouteProp<CompetitionStackParamList, 'Tournament'>;

function wodStatusLabel(status: string, t: TFunction) {
  if (status === 'active')  return t('tournament.statusActive');
  if (status === 'closed')  return t('tournament.statusClosed');
  return t('tournament.statusUpcoming');
}

export default function TournamentScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { tournamentId } = route.params;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'box_owner';
  const { theme } = useTheme();
  const { t } = useTranslation();
  const S = createStyles(theme);
  const dialog = useConfirmDialog();
  const c = theme.ax;

  const [activeTab,    setActiveTab]    = useState<'infos' | 'wods' | 'scores' | 'participants' | 'validate' | 'bracket' | 'divisions'>('infos');
  const [tournament,   setTournament]   = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [myScores,     setMyScores]     = useState<TournamentScore[]>([]);
  const [allScores,    setAllScores]    = useState<TournamentScore[]>([]);
  const [wods,         setWods]         = useState<TournamentWOD[]>([]);
  const [processing,   setProcessing]   = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [registering,       setRegistering]       = useState(false);
  const [isRegistered,      setIsRegistered]      = useState(false);
  // La base décide de l'inscription (statut, option « pendant le tournoi », box, catégorie, places…).
  const [canJoin,           setCanJoin]           = useState(false);
  const [wodValidatedScores, setWodValidatedScores] = useState<any[]>([]);
  // Classement calculé par la base (barème, tie-break, rang partagé) : l'app ne classe plus.
  const [classement, setClassement] = useState<{ lignes: LigneClassement[]; rangs: RangWod[] }>({ lignes: [], rangs: [] });
  // Ligue : saison terminée choisie dans « Saisons précédentes », et son général final.
  const [saisonChoisie, setSaisonChoisie] = useState<number | null>(null);
  const [generalSaison, setGeneralSaison] = useState<LigneClassement[]>([]);
  const [rankTab,            setRankTab]            = useState<string>('general');
  const [divisions,          setDivisions]          = useState<any[]>([]);
  const [divisionMembers,    setDivisionMembers]    = useState<any[]>([]);

  const load = useCallback(async () => {
    const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'box_owner';
    const [{ data: tourData }, { data: tw }, { data: tp }, { data: ms }, { data: as_ }, { data: vs }, { data: myReg }, { data: joinable }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
      supabase.from('tournament_wods').select('*').eq('tournament_id', tournamentId).order('order_index'),
      supabase.rpc('get_tournament_participants', { p_tournament_id: tournamentId }),
      user ? supabase.from('tournament_scores')
        .select('*').eq('tournament_id', tournamentId).eq('athlete_id', user.id) : { data: [] },
      isAdminUser ? supabase.from('tournament_scores')
        .select('*, tw:tournament_wods(title, type)')
        .eq('tournament_id', tournamentId)
        .order('submitted_at', { ascending: false }) : { data: [] },
      supabase.rpc('get_tournament_validated_scores', { p_tournament_id: tournamentId }),
      user ? supabase.from('tournament_participants')
        .select('athlete_id')
        .eq('tournament_id', tournamentId)
        .eq('athlete_id', user.id)
        .maybeSingle() : { data: null },
      user ? supabase.rpc('can_join_tournament', { p_tournament_id: tournamentId }) : { data: false },
    ]);
    setCanJoin(joinable === true);
    setTournament(tourData);
    // For league_div tournaments, only show WODs from the current season.
    const allWods = (tw ?? []) as any[];
    const t_ = tourData as any;
    const filteredWods = (t_?.format === 'league_div')
      ? allWods.filter(w => (w.season_number ?? 1) === (t_?.current_season ?? 1))
      : allWods;
    setWods(filteredWods as TournamentWOD[]);

    // Server is the single source of truth (self SELECT policy guarantees read)
    const registered = !!myReg;
    setIsRegistered(registered);

    // ── Separate profile fetch to bypass FK ambiguity ──────────────────────
    const participantList = tp ?? [];
    const allScoreList    = as_ ?? [];
    const allAthleteIds   = [...new Set([
      ...participantList.map((p: any) => p.athlete_id),
      ...allScoreList.map((s: any)   => s.athlete_id),
      ...(user && registered ? [user.id] : []),
    ])];
    let profileMap: Record<string, any> = {};
    if (allAthleteIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, elo, level, avatar_url, box_members(box:boxes(name))')
        .in('id', allAthleteIds);
      (profs ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    // Build participants list — inject current user if registered but RLS blocks full SELECT
    let mappedParticipants = participantList.map((p: any) => ({ ...p, profile: profileMap[p.athlete_id] ?? null }));
    if (user && registered && !mappedParticipants.some((p: any) => p.athlete_id === user.id)) {
      mappedParticipants = [
        ...mappedParticipants,
        {
          athlete_id:  user.id,
          profile:     profileMap[user.id] ?? { id: user.id, username: user.username, elo: user.elo, level: user.level },
        },
      ];
    }
    setParticipants(mappedParticipants);

    setMyScores((ms ?? []) as TournamentScore[]);
    setWodValidatedScores(vs ?? []);
    try {
      setClassement(await chargerClassement(tournamentId, (tourData as any)?.format === 'league_div'));
    } catch (e) {
      captureError(e, { screen: 'Tournament', action: 'chargerClassement' });
    }

    // ── Divisions (league_div only) ─────────────────────────────────────
    if ((tourData as any)?.format === 'league_div') {
      const { data: divs } = await supabase
        .from('tournament_divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('level');
      const divList = divs ?? [];
      setDivisions(divList);
      const divIds = divList.map((d: any) => d.id);
      if (divIds.length > 0) {
        const { data: mems } = await supabase
          .from('tournament_division_members')
          .select('*')
          .in('division_id', divIds);
        setDivisionMembers(mems ?? []);
      } else {
        setDivisionMembers([]);
      }
      // Default to first division (no "Général" tab for league_div)
      setRankTab(prev => (prev === 'general' && divList.length > 0) ? `div_${(divList[0] as any).id}` : prev);
    } else {
      setDivisions([]);
      setDivisionMembers([]);
    }
    if (isAdminUser) setAllScores(allScoreList.map((s: any) => ({
      ...s,
      profile: profileMap[s.athlete_id] ?? null,
      tw: Array.isArray(s.tw) ? s.tw[0] : s.tw,
    })));
    setLoading(false);
    setRefreshing(false);
  }, [tournamentId, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRegister() {
    if (!user || isRegistered) return;
    setRegistering(true);
    try {
      const { error } = await supabase.from('tournament_participants')
        .insert({ tournament_id: tournamentId, athlete_id: user.id });
      if (error && error.code !== '23505') {
        Alert.alert(t('tournament.registerError'), tournamentRefusal(error.message, tournament?.status));
        return;
      }
      setIsRegistered(true);
      trackTournamentJoin(tournamentId, tournament?.type ?? 'unknown');
      if (tournament?.start_date) {
        scheduleTournamentReminder(tournamentId, tournament.name, tournament.start_date).catch(e => captureError(e, { action: 'scheduleTournamentReminder' }));
      }
      setParticipants(prev =>
        prev.some(p => p.athlete_id === user.id)
          ? prev
          : [...prev, {
              athlete_id: user.id,
              profile: {
                id: user.id,
                username: user.username,
                elo: user.elo,
                level: user.level,
              },
            }]
      );
    } catch (e: any) {
      captureError(e, { screen: 'Tournament', action: 'register' });
      Alert.alert(t('common.error'), e?.message ?? t('tournament.registerImpossible'));
    } finally {
      setRegistering(false);
    }
  }

  // « Saisons précédentes » : général final de la saison choisie (la plus récente par défaut).
  useEffect(() => {
    if (rankTab !== 'previous') return;
    const saison = saisonChoisie ?? saisonsTerminees(tournament?.format, tournament?.current_season)[0];
    if (!saison) return;
    let annule = false;
    chargerGeneralSaison(tournamentId, saison)
      .then(lignes => { if (!annule) setGeneralSaison(lignes); })
      .catch(e => captureError(e, { screen: 'Tournament', action: 'chargerGeneralSaison' }));
    return () => { annule = true; };
  }, [rankTab, saisonChoisie, tournament?.format, tournament?.current_season, tournamentId]);

  // Une ligne du classement général (onglet « Général » et « Saisons précédentes »).
  function renderLigneGenerale(p: any) {
    const isMe = user?.id === p.athlete_id;
    const memberRow = divisionMembers.find((m: any) => m.athlete_id === p.athlete_id);
    const myDiv    = memberRow ? divisions.find((d: any) => d.id === memberRow.division_id) : null;
    return (
      <View key={p.athlete_id} testID={`tournament-rank-row-${p.athlete_id}`} style={[S.row, isMe && S.rowMe]}>
        <View style={S.rankBadge}>
          <Text style={[S.rankNumber, p.rang <= 3 && S.rankNumberTop]} numberOfLines={1}>#{p.rang}</Text>
        </View>
        <UserAvatar
          uri={p.profile?.avatar_url}
          name={p.profile?.username ?? '?'}
          size={40}
          borderRadius={20}
          backgroundColor={c.background}
          textColor={c.text}
        />
        <View style={S.rankInfo}>
          <View style={S.rankNameRow}>
            <Text style={[S.rankName, isMe && { color: c.accentText }]} numberOfLines={1}>
              {p.profile?.username ?? '?'}{isMe ? t('tournament.youSuffix') : ''}
            </Text>
            {myDiv && <AxTag label={`D${myDiv.level} · ${myDiv.name}`} tone="muted" />}
          </View>
          <Text style={S.rankElo}>ELO {p.profile?.elo ?? 1000}</Text>
        </View>
        <Text style={S.rankScore} numberOfLines={1}>{p.points} pts</Text>
      </View>
    );
  }

  async function handleValidateScore(scoreId: string) {
    if (tournament?.require_video_proof) {
      const score = allScores.find(s => s.id === scoreId);
      const videoUrl = String((score as any)?.video_url ?? '').trim();
      if (!videoUrl) {
        Alert.alert(
          t('tournament.videoRequiredTitle'),
          t('tournament.videoRequiredMsg'),
        );
        return;
      }
    }
    setProcessing(scoreId);
    const { error } = await supabase.from('tournament_scores')
      .update({ status: 'validated', validated_at: new Date().toISOString() })
      .eq('id', scoreId);
    if (error) { Alert.alert(t('common.error'), error.message); setProcessing(null); return; }
    setAllScores(prev => prev.map(s => s.id === scoreId ? { ...s, status: 'validated' as const } : s));
    setProcessing(null);
    load();
  }

  async function handleRejectScore(scoreId: string) {
    setProcessing(scoreId);
    const { error } = await supabase.from('tournament_scores')
      .update({ status: 'rejected' })
      .eq('id', scoreId);
    if (error) { Alert.alert(t('common.error'), error.message); setProcessing(null); return; }
    setAllScores(prev => prev.map(s => s.id === scoreId ? { ...s, status: 'rejected' as const } : s));
    setProcessing(null);
    load(); // le score rejeté sort du classement calculé par la base
  }

  async function handleKick(athleteId: string, username: string) {
    if (!isAdmin) return;
    dialog.show(
      t('tournament.kickTitle'),
      t('tournament.kickMsg', { username }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('tournament.kick'), style: 'destructive', onPress: async () => {
          const { error } = await supabase
            .from('tournament_participants')
            .delete()
            .eq('tournament_id', tournamentId)
            .eq('athlete_id', athleteId);
          if (error) { Alert.alert(t('common.error'), error.message); return; }
          load();
        }},
      ]
    );
  }

  async function handleLeave() {
    if (!user) return;
    dialog.show(
      t('tournament.leaveTitle'),
      t('tournament.leaveMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('tournament.leave'), style: 'destructive', onPress: async () => {
          const { error } = await supabase
            .from('tournament_participants')
            .delete()
            .eq('tournament_id', tournamentId)
            .eq('athlete_id', user.id);
          if (error) { Alert.alert(t('common.error'), error.message); return; }
          setIsRegistered(false);
          load();
        }},
      ]
    );
  }

  function goToWOD(wod: TournamentWOD) {
    const existing = myScores.find(s => s.tournament_wod_id === wod.id) ?? null;
    navigation.navigate('TournamentWOD', {
      tournamentId,
      tournamentName: tournament?.name ?? '',
      requireVideoProof: tournament?.require_video_proof ?? false,
      wod,
      existingScore: existing ? {
        tournament_wod_id: existing.tournament_wod_id,
        score_value: existing.score_value,
        capped: existing.capped,
        video_url: existing.video_url,
        status: existing.status,
      } : null,
    });
  }

  if (loading) return (
    <View style={S.loadingContainer}><ActivityIndicator size="large" color={c.accentText} /></View>
  );
  if (!tournament) return (
    <View style={S.loadingContainer}><Text style={S.errorText}>{t('tournament.notFound')}</Text></View>
  );

  const isFull      = participants.length >= tournament.max_participants;
  const isArchived  = !!tournament.archived_at;
  // Pendant le tournoi, si l'option le permet : la base l'a dit (can_join_tournament).
  const openDuring  = tournament.status === 'active' && canJoin;
  const canRegister = canJoin && !isRegistered && !isArchived;
  // Une seule action accent par écran : la première carte de WOD ou de score qui en porte une.
  const primaryWodId = wods.find((w) => {
    const ms = myScores.find(s => s.tournament_wod_id === w.id);
    return (isRegistered && w.status === 'active' && !ms) || ms?.status === 'rejected';
  })?.id;
  const primaryScoreId = allScores.find(s => s.status === 'pending')?.id;

  const myStatus = !user ? null
    : isArchived ? { icon: Lock, color: c.textMuted, label: t('tournament.badgeArchived') }
    : isRegistered ? { icon: CheckCircle, color: c.success, label: myScores.length > 0 ? t('tournament.registeredScoreSubmitted') : t('tournament.youAreRegistered') }
    : isFull ? { icon: Lock, color: c.danger, label: t('tournament.full') }
    : tournament.status === 'open' ? { icon: Zap, color: c.text, label: t('tournament.notYetRegistered') }
    : openDuring ? { icon: Zap, color: c.accentText, label: t('tournament.badgeOpenDuring') }
    : null;

  const rankMark = (rang: number) => (
    <View style={S.rankBadge}>
      <Text style={[S.rankNumber, rang <= 3 && S.rankNumberTop]} numberOfLines={1}>#{rang}</Text>
    </View>
  );

  const emptyState = (Icon: LucideIcon, title: string, text?: string) => (
    <View style={S.emptyState}>
      <Icon color={c.textMuted} size={36} strokeWidth={1.75} />
      <Text style={S.emptyTitle}>{title}</Text>
      {text ? <Text style={S.emptyText}>{text}</Text> : null}
    </View>
  );

  return (
    <View style={S.container}>
      <GlassBackground />
      {/* ── Header ── */}
      <AxScreenHeader
        title={tournament.name}
        right={<AxIconButton icon={Share2} onPress={() => Share.share({ message: t('tournament.shareMessage', { name: tournament?.name ?? t('tournament.defaultName'), id: tournamentId }) })} accessibilityLabel={i18n.t('common.share')} testID="header-share" />}
      />
      <View style={S.headerWrap}>
        <AxCard variant="featured" testID="tournament-header" style={S.headerCard}>
          <View style={S.headerMeta}>
            <AxTag label={(tournament.level ?? 'RX').toUpperCase()} tone="accent" testID="tournament-level" />
            <AxStatusDot
              testID="tournament-status"
              tone={tournament.status === 'open' ? 'active' : tournament.status === 'active' ? 'warning' : 'muted'}
              label={tournament.status === 'open' ? t('tournament.badgeOpen') : tournament.status === 'active' ? t('tournament.statusActive') : t('tournament.statusClosed')}
            />
          </View>
          <View style={S.headerStats}>
            <View style={S.metaItem}>
              <Users color={c.textMuted} size={14} />
              <Text style={S.metaText}>{participants.length}/{tournament.max_participants}</Text>
            </View>
            {tournament.start_date && (
              <View style={S.metaItem}>
                <Calendar color={c.textMuted} size={14} />
                <Text style={S.metaText}>{formatDate(tournament.start_date)}</Text>
              </View>
            )}
            {tournament.prize ? <Text style={S.prize} numberOfLines={2}>{tournament.prize}</Text> : null}
          </View>

          {/* ── Personal registration status (persistent, all tabs) ── */}
          {myStatus && (
            <View style={S.myStatusRow} testID="tournament-my-status">
              <myStatus.icon color={myStatus.color} size={15} />
              <Text style={[S.myStatusText, { color: myStatus.color }]}>{myStatus.label}</Text>
            </View>
          )}
        </AxCard>
      </View>

      {/* ── Tabs ── */}
      <View style={S.tabsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={S.chipBar} contentContainerStyle={S.tabsContent}>
          {((): any[] => {
              const fmt = tournament?.format ?? 'simple';
              const base: any[] = ['infos'];
              if (fmt === 'bracket' || fmt === 'swiss') base.push('bracket');
              if (fmt === 'league_div') base.push('scores'); // "Divisions" right after Infos
              base.push('wods', 'participants');
              if (fmt !== 'league_div') base.push('scores'); // "Classement" at the end for other formats
              if (isAdmin) base.push('validate');
              return base;
            })().map((tab: any) => {
              const pendingCount = allScores.filter(s => s.status === 'pending').length;
              return (
                <AxChip
                  key={tab}
                  testID={`tournament-tab-${tab}`}
                  selected={activeTab === tab}
                  onPress={() => setActiveTab(tab)}
                  label={tab === 'infos'       ? t('tournament.tabInfos')
                    : tab === 'wods'       ? t('tournament.tabWods', { count: wods.length })
                    : tab === 'participants'? t('tournament.tabParticipants', { count: participants.length })
                    : tab === 'bracket'    ? t('tournament.tabBracket')
                    : tab === 'validate'   ? `${t('tournament.tabValidate')}${pendingCount > 0 ? ` (${pendingCount})` : ''}`
                    : tournament?.format === 'league_div' ? t('tournament.tabDivisions')
                    : t('tournament.tabStandings')}
                />
              );
            })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.content, { paddingBottom: tabSpace }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

        {/* ══ INFOS ══ */}
        {activeTab === 'infos' && (
          <>
            {/* ── "Comment ça marche" — une carte par étape, adaptée au format ── */}
            {(() => {
              const fmt = tournament.format ?? 'simple';
              const isBracket = fmt === 'bracket' || fmt === 'swiss';
              const isLeague  = fmt === 'league_div';
              const steps: { key: string; icon: LucideIcon; label: string }[] = [
                { key: 'register', icon: UserPlus, label: t('tournament.stepRegister') },
                { key: 'wod',      icon: isBracket ? Swords : Dumbbell, label: isBracket ? t('tournament.stepFight') : t('tournament.stepWods') },
                { key: 'score',    icon: Timer, label: t('tournament.stepScore') },
                { key: 'rank',     icon: isLeague ? Layers : Trophy, label: isLeague ? t('tournament.tabDivisions') : t('tournament.tabStandings') },
              ];
              // Current step: 0 = à inscrire, 1 = faire les WODs, 2 = score soumis (suivre le classement)
              const currentIndex = !isRegistered ? 0 : (myScores.length === 0 ? 1 : 2);
              const hint = isArchived ? t('tournament.hintArchived')
                : !isRegistered
                ? (tournament.status === 'open' ? t('tournament.hintRegister')
                  : openDuring ? t('tournament.hintOpenDuring') : t('tournament.hintClosed'))
                : myScores.length === 0
                  ? (isBracket ? t('tournament.hintBracket')
                    : t('tournament.hintWods'))
                  : (isLeague ? t('tournament.hintLeagueDone')
                    : t('tournament.hintDone'));
              return (
                <View style={S.section} testID="tournament-how">
                  <Text style={S.cardLabel}>{t('tournament.howItWorks')}</Text>
                  <View style={S.stepsRow}>
                    {steps.map((st, i) => {
                      const done   = i < currentIndex;
                      const active = i === currentIndex;
                      const color  = done ? c.success : active ? c.accentText : c.textMuted;
                      const Icon   = done ? CheckCircle : st.icon;
                      return (
                        <AxCard key={st.key} testID={`tournament-step-${st.key}`}
                          style={[S.stepCard, active && { borderColor: c.accentText }]}>
                          <Icon color={color} size={20} />
                          <Text style={[S.stepLabel, { color: done || active ? c.text : c.textMuted }]} numberOfLines={1}>
                            {st.label}
                          </Text>
                        </AxCard>
                      );
                    })}
                  </View>
                  <Text style={S.stepHintText}>{hint}</Text>
                </View>
              );
            })()}

            {canRegister && (
              <View style={S.block}>
                <AxButton
                  testID="tournament-register"
                  icon={Zap}
                  fullWidth
                  loading={registering}
                  onPress={handleRegister}
                  label={tournament?.format === 'league_div' ? t('tournament.joinLeague') : t('tournament.registerToTournament')}
                />
              </View>
            )}
            {isRegistered && (
              <View style={S.registeredBlock}>
                <View style={S.registeredBadge}>
                  <CheckCircle color={c.success} size={20} />
                  <Text style={S.registeredText}>{t('tournament.youParticipate')}</Text>
                </View>
                {tournament.status === 'open' && (
                  <AxButton testID="tournament-leave" variant="stop" fullWidth onPress={handleLeave} label={t('tournament.unregister')} />
                )}
              </View>
            )}
            {isFull && !isRegistered && (
              <View style={[S.registeredBadge, S.block, { borderColor: c.danger }]}>
                <Lock color={c.danger} size={18} />
                <Text style={[S.registeredText, { color: c.danger }]}>{t('tournament.full')}</Text>
              </View>
            )}

            {tournament.description ? (
              <AxCard style={S.card}>
                <Text style={S.cardLabel}>{t('tournament.about')}</Text>
                <Text style={S.descText}>{tournament.description}</Text>
              </AxCard>
            ) : null}

            {/* Format banner */}
            {(tournament.format === 'bracket' || tournament.format === 'swiss' || tournament.format === 'league_div') && (
              <AxCard style={S.card} testID="tournament-format-card">
                <Text style={S.cardLabel}>{t('tournament.format')}</Text>
                <AxTag
                  testID="tournament-format"
                  tone="accent"
                  wrap
                  label={tournament.format === 'bracket' ? t('tournament.formatBracket') :
                   tournament.format === 'swiss'   ? t('tournament.formatSwiss') :
                                                     t('tournament.formatLeagueDiv')}
                />
                {tournament.require_video_proof && (
                  <View style={S.ruleRow}>
                    <Video color={c.warning} size={14} />
                    <Text style={[S.ruleText, { color: c.warning }]}>{t('tournament.videoProofRequired')}</Text>
                  </View>
                )}
              </AxCard>
            )}

            <AxCard style={S.card}>
              <Text style={S.cardLabel}>{t('tournament.rules')}</Text>
              {(t('tournament.rulesList', { returnObjects: true }) as string[]).map((rule, i) => (
                <Text key={i} style={S.ruleText}>{rule}</Text>
              ))}
            </AxCard>
          </>
        )}

        {/* ══ WODS ══ */}
        {activeTab === 'wods' && (
          <>
            {wods.length === 0 ? emptyState(Dumbbell, t('tournament.wodsUpcoming'), t('tournament.wodsSoon'))
            : wods.map((wod, i) => {
              const myScore = myScores.find(s => s.tournament_wod_id === wod.id);
              const canDo   = isRegistered && wod.status === 'active' && !myScore;
              const primary = wod.id === primaryWodId ? 'accent' : 'outline';
              const scoreColor = myScore?.status === 'pending' ? c.warning
                : myScore?.status === 'validated' ? c.success : c.danger;
              return (
                <AxCard key={wod.id} testID={`tournament-wod-${wod.id}`} style={[S.card,
                  myScore && { borderColor: c.success },
                  wod.status === 'closed' && S.wodCardClosed]}>
                  <View style={S.wodCardHeader}>
                    <AxTag label={`WOD ${i + 1}`} tone="accent" />
                    <AxTag label={wod.type} tone="muted" />
                    {(() => {
                      // Étape du WOD selon son tableau (#386) ; libellés de tournament_bracket_stages.
                      const etape = (tournament.format === 'bracket' || tournament.format === 'swiss')
                        ? libelleEtape(wod as any, tournament.format === 'swiss', t) : null;
                      return etape ? <AxTag label={etape} tone="muted" /> : null;
                    })()}
                    {tournament.format === 'league_div' && (() => {
                      const d = (wod as any).division_id ? divisions.find((x: any) => x.id === (wod as any).division_id) : null;
                      return <AxTag label={d ? `D${d.level} · ${d.name}` : t('tournament.generalTab')} tone="muted" />;
                    })()}
                    <View style={S.wodDurationRow}>
                      <Clock color={c.textMuted} size={12} />
                      <Text style={S.wodDurationText}>{t('tournament.minutes', { n: wod.duration_minutes })}</Text>
                    </View>
                    <AxStatusDot
                      label={wodStatusLabel(wod.status, t)}
                      tone={wod.status === 'active' ? 'active' : wod.status === 'closed' ? 'muted' : 'warning'}
                    />
                  </View>
                  <Text style={S.wodTitle}>{wod.title}</Text>
                  {wod.description ? <Text style={S.wodDesc}>{wod.description}</Text> : null}
                  {Array.isArray(wod.movements) && wod.movements.length > 0 && (
                    <View style={S.movementsBox}>
                      {wod.movements.map((m, mi) => (
                        <Text key={mi} style={S.movementLine}>• {m}</Text>
                      ))}
                    </View>
                  )}
                  <View style={S.wodScoringRow}>
                    <Zap color={c.textMuted} size={13} />
                    <Text style={S.wodScoringText}>{wod.scoring}</Text>
                  </View>
                  {wod.status === 'active' && (
                    <View style={S.deadlineRow}>
                      <Clock color={c.warning} size={13} />
                      <Text style={S.deadlineText}>{t('tournament.submissionDeadline', { h: wod.deadline_hours })}</Text>
                    </View>
                  )}
                  {myScore && (
                    <View style={S.myScoreBadge} testID={`tournament-my-score-${wod.id}`}>
                      <CheckCircle color={scoreColor} size={16} />
                      <View style={S.flex}>
                        <Text style={S.myScoreValue}>{t('tournament.scoreSubmitted', { value: formatScoreDisplay(myScore.score_value, wod.type, wod.reps_per_round, myScore.capped) })}</Text>
                        <Text style={[S.myScoreStatus, { color: scoreColor }]}>
                          {myScore.status === 'pending' ? t('tournament.pendingValidation')
                            : myScore.status === 'validated' ? t('tournament.validatedEmoji') : t('tournament.rejectedEmoji')}
                        </Text>
                        {(myScore as any).admin_message ? (
                          <View style={S.adminMsgBox}>
                            <MessageSquare color={c.textMuted} size={12} />
                            <Text style={S.adminMsgText}>{(myScore as any).admin_message}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )}
                  {canDo && (
                    <AxButton testID={`tournament-launch-${wod.id}`} icon={Timer} fullWidth variant={primary}
                      onPress={() => goToWOD(wod)} label={t('tournament.launchWod')} />
                  )}
                  {!isRegistered && wod.status === 'active' && (
                    <AxButton testID={`tournament-locked-${wod.id}`} icon={Lock} fullWidth variant="outline"
                      onPress={() => setActiveTab('infos')} label={t('tournament.registrationRequired')} />
                  )}
                  {myScore?.status === 'rejected' && (
                    <AxButton testID={`tournament-resubmit-${wod.id}`} icon={Timer} fullWidth variant={primary}
                      onPress={() => goToWOD(wod)} label={t('tournament.submitAgain')} />
                  )}
                </AxCard>
              );
            })}
          </>
        )}

        {/* ══ PARTICIPANTS ══ */}
        {activeTab === 'participants' && (
          <>
            {isAdmin && (
              <View style={S.adminBanner}>
                <Shield color={c.accentText} size={14} />
                <Text style={S.adminBannerText}>{t('tournament.adminBanner')}</Text>
              </View>
            )}
            {participants.length === 0 ? emptyState(Users, t('tournament.noParticipants'), t('tournament.registrationsHere'))
            : participants.map((p: any, i: number) => {
              const isMe = user?.id === p.athlete_id;
              const boxName = p.profile?.box_members?.[0]?.box?.name ?? null;
              const regDate = p.created_at
                ? new Date(p.created_at).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '—';
              return (
                <View key={p.athlete_id} testID={`tournament-participant-${p.athlete_id}`} style={[S.row, isMe && S.rowMe]}>
                  <View style={S.partAvatar}>
                    <Text style={S.partAvatarText}>
                      {(p.profile?.username ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={S.partInfo}>
                    <View style={S.partNameRow}>
                      <Text style={[S.partName, isMe && { color: c.accentText }]} numberOfLines={1}>
                        {p.profile?.username ?? '?'}{isMe ? t('tournament.youSuffix') : ''}
                      </Text>
                      {p.profile?.level && <AxTag label={p.profile.level.toUpperCase()} tone="muted" />}
                    </View>
                    <View style={S.partMeta}>
                      <Star color={c.textMuted} size={11} />
                      <Text style={S.partMetaText}>ELO {p.profile?.elo ?? 1000}</Text>
                      {boxName && (
                        <><Text style={S.partMetaDot}>·</Text>
                        <Text style={S.partMetaText} numberOfLines={1}>{boxName}</Text></>
                      )}
                    </View>
                    <Text style={S.partDate}>{t('tournament.registeredOn', { date: regDate })}</Text>
                  </View>
                  {isAdmin && !isMe && (
                    <TouchableOpacity style={S.kickBtn}
                      onPress={() => handleKick(p.athlete_id, p.profile?.username ?? '?')}
                      accessibilityRole="button"
                      accessibilityLabel={t('tournament.kick')}
                      activeOpacity={0.7}>
                      <UserX color={c.danger} size={16} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ══ BRACKET (bracket / swiss) ══ */}
        {activeTab === 'bracket' && (
          <TournamentBracketView
            tournamentId={tournamentId}
            format={tournament.format === 'swiss' ? 'swiss' : 'bracket'}
            currentUserId={user?.id}
          />
        )}

        {/* ══ CLASSEMENT / DIVISIONS ══ */}
        {activeTab === 'scores' && (
          <>
            {/* Sub-tabs: Général + Divisions (league_div) + WOD 1, WOD 2... */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={S.subTabs} contentContainerStyle={S.subTabsContent}>
              {ongletsClassement(tournament?.format, tournament?.current_season, divisions.map((d: any) => d.id), wods.length).map(tab => {
                let label = '';
                if (tab === 'general') label = t('tournament.generalRankTab');
                else if (tab === 'previous') label = t('tournament.previousSeasonsTab');
                else if (tab.startsWith('div_')) {
                  const d = divisions.find((dd: any) => `div_${dd.id}` === tab);
                  label = d ? `D${d.level} · ${d.name}` : '';
                } else {
                  const idx = parseInt(tab.split('_')[1]);
                  label = t('tournament.wodRankTab', { n: idx + 1, title: wods[idx]?.title ?? '' });
                }
                return (
                  <AxChip key={tab} testID={`tournament-rank-tab-${tab}`} label={label}
                    selected={rankTab === tab} onPress={() => setRankTab(tab)} />
                );
              })}
            </ScrollView>

            {/* Général */}
            {rankTab === 'general' && (
              participants.length === 0 ? emptyState(Trophy, t('tournament.emptyStandings'), t('tournament.emptyStandingsSub'))
              : classementGeneral(participants, classement.lignes).map(renderLigneGenerale)
            )}

            {/* Saisons précédentes (ligue) : une puce par saison terminée, puis son général final */}
            {rankTab === 'previous' && (() => {
              const saisons = saisonsTerminees(tournament?.format, tournament?.current_season);
              const saison = saisonChoisie ?? saisons[0];
              return (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={S.subTabs} contentContainerStyle={S.subTabsContent}>
                    {saisons.map(n => (
                      <AxChip key={n} label={t('tournament.seasonChip', { n })}
                        selected={saison === n} onPress={() => setSaisonChoisie(n)} />
                    ))}
                  </ScrollView>
                  {classementGeneral(participants, generalSaison).map(renderLigneGenerale)}
                </>
              );
            })()}

            {/* Par division (league_div) */}
            {divisions.map((div: any) => rankTab === `div_${div.id}` && (() => {
              const divMembers = divisionMembers.filter((m: any) => m.division_id === div.id);
              const ranked = divMembers
                .map((m: any) => {
                  const part = participants.find((p: any) => p.athlete_id === m.athlete_id);
                  return { ...m, profile: part?.profile, score: m.points ?? 0 };
                })
                .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
              return (
                <View key={div.id}>
                  <View style={S.wodRankHeader}>
                    <Text style={S.wodRankHeaderText}>{t('tournament.divisionHeader', { level: div.level, name: div.name })}</Text>
                    <Text style={S.divSubInfo}>
                      {ranked.length}/{div.max_members} · {div.promote_count > 0 ? t('tournament.promotedCount', { n: div.promote_count }) : ''} {div.relegate_count > 0 ? t('tournament.relegatedCount', { n: div.relegate_count }) : ''}
                    </Text>
                  </View>
                  {ranked.length === 0 ? emptyState(Users, t('tournament.emptyDivision'))
                  : ranked.map((m: any, i: number) => {
                    const isMe = user?.id === m.athlete_id;
                    const isPromoted = i < (div.promote_count ?? 0);
                    const isRelegated = i >= ranked.length - (div.relegate_count ?? 0) && (div.relegate_count ?? 0) > 0;
                    return (
                      <View key={m.athlete_id} testID={`tournament-div-row-${m.athlete_id}`} style={[S.row, isMe && S.rowMe]}>
                        {rankMark(i + 1)}
                        <UserAvatar
                          uri={m.profile?.avatar_url}
                          name={m.profile?.username ?? '?'}
                          size={40}
                          borderRadius={20}
                          backgroundColor={c.background}
                          textColor={c.text}
                        />
                        <View style={S.rankInfo}>
                          <View style={S.rankNameRow}>
                            <Text style={[S.rankName, isMe && { color: c.accentText }]} numberOfLines={1}>
                              {m.profile?.username ?? '?'}{isMe ? t('tournament.youSuffix') : ''}
                            </Text>
                            {isPromoted && <AxTag label={t('tournament.promoted')} tone="success" />}
                            {isRelegated && <AxTag label={t('tournament.relegated')} tone="danger" />}
                          </View>
                          <Text style={S.rankElo}>ELO {m.profile?.elo ?? 1000}</Text>
                        </View>
                        <Text style={S.rankScore} numberOfLines={1}>{m.score ?? 0} pts</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })())}

            {/* Par WOD */}
            {wods.map((wod: any, idx: number) => rankTab === `wod_${idx}` && (() => {
              const wodScores = classementWod(wodValidatedScores, classement.rangs, wod.id);
              return (
                <View key={wod.id}>
                  <View style={S.wodRankHeader}>
                    <Text style={S.wodRankHeaderText}>{t('tournament.wodRankTab', { n: idx + 1, title: wod.title })}</Text>
                  </View>
                  {wodScores.length === 0 ? emptyState(ClipboardList, t('tournament.noValidatedScore'))
                  : wodScores.map((s: any) => {
                    const profile = participants.find((p: any) => p.athlete_id === s.athlete_id)?.profile;
                    const isMe = user?.id === s.athlete_id;
                    return (
                      <View key={s.athlete_id} testID={`tournament-wod-row-${s.athlete_id}`} style={[S.row, isMe && S.rowMe]}>
                        {rankMark(s.rang)}
                        <UserAvatar
                          uri={profile?.avatar_url}
                          name={profile?.username ?? '?'}
                          size={40}
                          borderRadius={20}
                          backgroundColor={c.background}
                          textColor={c.text}
                        />
                        <View style={S.rankInfo}>
                          <Text style={[S.rankName, isMe && { color: c.accentText }]} numberOfLines={1}>
                            {profile?.username ?? '?'}{isMe ? t('tournament.youSuffix') : ''}
                          </Text>
                        </View>
                        <Text style={S.rankScore} numberOfLines={1}>{formatScoreDisplay(s.score_value, wod.type, wod.reps_per_round, s.capped)}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })())}
          </>
        )}

        {/* ══ VALIDER (admin only) ══ */}
        {activeTab === 'validate' && isAdmin && (
          <>
            {allScores.length === 0 ? emptyState(ClipboardList, t('tournament.noScoreSubmitted'), t('tournament.athleteScoresHere'))
            : allScores.map(score => {
              const statusTone = score.status === 'validated' ? 'success'
                : score.status === 'rejected' ? 'danger' : 'warning';
              const statusLabel = score.status === 'validated' ? t('tournament.validatedEmoji')
                : score.status === 'rejected' ? t('tournament.rejectedEmoji') : t('tournament.pendingEmoji');
              const isProcessing = processing === score.id;
              return (
                <AxCard key={score.id} testID={`tournament-score-${score.id}`} style={S.card}>
                  <View style={S.scoreCardHeader}>
                    <View style={S.scoreAvatarWrap}>
                      <Text style={S.scoreAvatarText}>
                        {((score as any).profile?.username ?? '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={S.flex}>
                      <Text style={S.scoreUsername} numberOfLines={1}>{(score as any).profile?.username ?? '?'}</Text>
                      <Text style={S.scoreWodTitle} numberOfLines={2}>{(score as any).tw?.title ?? ''}</Text>
                    </View>
                    <AxTag label={statusLabel} tone={statusTone} testID={`tournament-score-status-${score.id}`} />
                  </View>

                  <View style={S.scoreValueRow}>
                    <Text style={S.scoreValue} numberOfLines={1}>{formatScoreDisplay(score.score_value, (score as any).tw?.type, (score as any).tw?.reps_per_round, score.capped)}</Text>
                    {score.tiebreak_value != null && (
                      <Text style={S.scoreTiebreak}>TB: {score.tiebreak_value}</Text>
                    )}
                  </View>

                  {score.notes ? (
                    <Text style={S.scoreNotes}>{score.notes}</Text>
                  ) : null}

                  {score.status === 'pending' && (
                    <View style={S.scoreActions}>
                      <View style={S.flex}>
                        <AxButton testID={`tournament-reject-${score.id}`} variant="stop" icon={XCircle} fullWidth
                          loading={isProcessing} onPress={() => handleRejectScore(score.id)} label={t('tournament.reject')} />
                      </View>
                      <View style={S.flex}>
                        <AxButton testID={`tournament-validate-${score.id}`} variant={score.id === primaryScoreId ? 'accent' : 'outline'}
                          icon={CheckCircle} fullWidth loading={isProcessing}
                          onPress={() => handleValidateScore(score.id)} label={t('tournament.validate')} />
                      </View>
                    </View>
                  )}
                </AxCard>
              );
            })}
          </>
        )}

        <View style={S.bottomGap} />
      </ScrollView>
      {dialog.element}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
  container:        { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  errorText:        { ...axTypography.body, color: c.textMuted },
  flex:        { flex: 1, minWidth: 0 },
  headerWrap:  { paddingHorizontal: axSpacing.lg, paddingBottom: axSpacing.md },
  headerCard:  { gap: axSpacing.md },
  headerMeta:  { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, flexWrap: 'wrap' },
  headerStats: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.lg, flexWrap: 'wrap' },
  myStatusRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  myStatusText:{ ...axTypography.label, flexShrink: 1 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  metaText:    { ...axTypography.bodySmall, color: c.textMuted },
  prize:       { ...axTypography.label, color: c.text, flexShrink: 1 },
  tabsBar:     { paddingBottom: axSpacing.sm },
  tabsContent: { flexDirection: 'row', gap: axSpacing.sm, paddingHorizontal: axSpacing.lg },
  content: { padding: axSpacing.lg, paddingTop: axSpacing.md },
  section:   { gap: axSpacing.sm, marginBottom: axSpacing.lg },
  block:     { marginBottom: axSpacing.md },
  card:      { marginBottom: axSpacing.md },
  cardLabel: { ...axTypography.overline, color: c.textMuted },
  stepsRow:  { flexDirection: 'row', gap: axSpacing.sm },
  stepCard:  { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: axSpacing.xs, paddingVertical: axSpacing.md, gap: axSpacing.sm },
  stepLabel: { ...axTypography.labelSmall, textAlign: 'center' },
  stepHintText: { ...axTypography.bodySmall, color: c.textMuted },
  descText:  { ...axTypography.body, color: c.text },
  ruleRow:   { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  ruleText:  { ...axTypography.bodySmall, color: c.text, flexShrink: 1 },
  registeredBlock:  { marginBottom: axSpacing.md, gap: axSpacing.sm },
  registeredBadge:  { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, backgroundColor: c.surface, borderRadius: axRadius.card, padding: axSpacing.lg, borderWidth: 1, borderColor: c.success },
  registeredText:   { ...axTypography.label, color: c.success, flexShrink: 1 },
  emptyState: { alignItems: 'center', paddingTop: 40, gap: axSpacing.sm },
  emptyTitle: { ...axTypography.titleM, color: c.text, textAlign: 'center' },
  emptyText:  { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  wodCardClosed: { opacity: 0.7 },
  wodCardHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, flexWrap: 'wrap' },
  wodDurationRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  wodDurationText:{ ...axTypography.caption, color: c.textMuted },
  wodTitle:      { ...axTypography.titleM, color: c.text },
  wodDesc:       { ...axTypography.bodySmall, color: c.textMuted },
  movementsBox:  { backgroundColor: c.background, borderRadius: axRadius.control, padding: axSpacing.md, gap: 3 },
  movementLine:  { ...axTypography.bodySmall, color: c.text },
  wodScoringRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  wodScoringText:{ ...axTypography.bodySmall, color: c.text, flexShrink: 1 },
  deadlineRow:   { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  deadlineText:  { ...axTypography.bodySmall, color: c.warning, flexShrink: 1 },
  myScoreBadge:  { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.md, backgroundColor: c.background, borderRadius: axRadius.control, padding: axSpacing.md },
  myScoreValue:  { ...axTypography.label, color: c.text },
  myScoreStatus: { ...axTypography.bodySmall, marginTop: 2 },
  adminMsgBox:   { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.sm, marginTop: axSpacing.sm },
  adminMsgText:  { ...axTypography.caption, color: c.textMuted, flex: 1 },
  divSubInfo:   { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
  chipBar:        { flexGrow: 0, flexShrink: 0 },
  subTabs:        { flexGrow: 0, flexShrink: 0, marginBottom: axSpacing.md },
  subTabsContent: { gap: axSpacing.sm, paddingHorizontal: 2 },
  wodRankHeader:        { backgroundColor: c.surface, borderRadius: axRadius.control, borderWidth: 1, borderColor: c.border, paddingHorizontal: axSpacing.lg, paddingVertical: axSpacing.md, marginBottom: axSpacing.sm },
  wodRankHeaderText:    { ...axTypography.label, color: c.text },
  row:          { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, backgroundColor: c.surface, borderRadius: axRadius.card, padding: axSpacing.lg, marginBottom: axSpacing.sm, borderWidth: 1, borderColor: c.border },
  rowMe:        { borderColor: c.accentText },
  rankBadge:    { width: 36, alignItems: 'center' },
  rankNumber:   { ...axTypography.label, color: c.textMuted },
  rankNumberTop:{ color: c.accentText },
  rankInfo:     { flex: 1, minWidth: 0 },
  rankNameRow:  { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, flexWrap: 'wrap' },
  rankName:     { ...axTypography.label, color: c.text, flexShrink: 1 },
  rankElo:      { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
  rankScore:    { ...axTypography.numberM, color: c.text },
  adminBanner:     { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, backgroundColor: c.surface, borderRadius: axRadius.control, padding: axSpacing.md, marginBottom: axSpacing.md, borderWidth: 1, borderColor: c.accentText },
  adminBannerText: { ...axTypography.bodySmall, color: c.accentText, flex: 1 },
  partAvatar:   { width: 44, height: 44, borderRadius: 22, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.border },
  partAvatarText: { ...axTypography.label, color: c.text },
  partInfo:     { flex: 1, minWidth: 0, gap: 3 },
  partNameRow:  { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  partName:     { ...axTypography.label, color: c.text, flexShrink: 1 },
  partMeta:     { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  partMetaText: { ...axTypography.caption, color: c.textMuted, flexShrink: 1 },
  partMetaDot:  { ...axTypography.caption, color: c.textMuted },
  partDate:     { ...axTypography.caption, color: c.textMuted },
  kickBtn:      { width: 44, height: 44, borderRadius: axRadius.control, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.danger },
  scoreCardHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
  scoreAvatarWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.background, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  scoreAvatarText: { ...axTypography.label, color: c.text },
  scoreUsername:   { ...axTypography.label, color: c.text },
  scoreWodTitle:   { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
  scoreValueRow:   { flexDirection: 'row', alignItems: 'baseline', gap: axSpacing.sm, backgroundColor: c.background, borderRadius: axRadius.control, padding: axSpacing.md },
  scoreValue:      { ...axTypography.numberM, color: c.text, flex: 1 },
  scoreTiebreak:   { ...axTypography.caption, color: c.textMuted },
  scoreNotes:      { ...axTypography.bodySmall, color: c.textMuted, fontStyle: 'italic' },
  scoreActions:    { flexDirection: 'row', gap: axSpacing.sm },
  bottomGap:       { height: 40 },
  });
}
