import i18n from '../../i18n';
import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxContentTitle } from '../../components/ax/AxContentTitle';
import { AxIconButton } from '../../components/ax/AxIconButton';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Linking, Share,
} from 'react-native';
import { Users, Zap, Trophy, Crown, Medal, Check, X, Play, Edit3, Youtube, AlertTriangle, ThumbsUp, Link, Share2, Flame } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { hapticSuccess } from '../../lib/haptics';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { hue } from '../../theme/hues';
import { AxButton, AxCard, AxChip, AxStatusDot, AxSwitch, AxTag, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { levelInk } from '../home/homeLevelColor';
import { incrementCounter, logMovementReps } from '../../services/gamification';
import { cancelTodayScoreReminder } from '../../services/notifications';
import { computeCompletedMovements } from '../../utils/movementParser';
import { computeMaxScore } from '../../utils/computeMaxScore';
import { syncLevelAndBadges } from '../../utils/eloLevels';
import { formatScoreValue, mapForTimeScore, compareScores } from '../../utils/scoreFormat';
import { getScaledMovements } from '../../utils/wodScaling';

import { trackDailyTournamentJoin, trackDailyTournamentScoreSubmit } from '../../lib/analytics';
import { HomeStackParamList, TimerType } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { fetchMyProfile } from '../../services/myProfile';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav = NativeStackNavigationProp<HomeStackParamList>;
type Route = RouteProp<{ DailyTournamentDetail: { tournamentId: string } }, 'DailyTournamentDetail'>;

interface Participant {
  user_id: string;
  username: string;
  level: string;
  elo: number;
  score_value: number | null;
  capped: boolean;
  rx: boolean;
  submitted_at: string | null;
  video_url: string | null;
  status: string;
}

interface TournamentDetail {
  id: string;
  creator_id: string;
  wod_name: string;
  wod_type: string;
  duration: number;
  level: string;
  movements: string;
  movements_scaled?: string | null;
  scoring: string | null;
  score_mode: string;
  max_players: number;
  status: string;
  elo_reward: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
  gender_target?: string;
  is_official?: boolean;
}

function formatScore(value: number, mode: string, capped?: boolean | null): string {
  return formatScoreValue(value, mode, capped);
}

export default function DailyTournamentDetailScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { theme } = useTheme();
  const S = createStyles(theme);
  const c = theme.ax;
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user, currentBox } = useAuth();
  const { tournamentId } = route.params;

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [hasScored, setHasScored] = useState(false);
  const [joining, setJoining] = useState(false);

  // Score modal
  const [scoreModal, setScoreModal] = useState(false);
  const [scoreInput, setScoreInput] = useState('');
  const [scoreCapped, setScoreCapped] = useState(false);
  const [capReps, setCapReps] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [timeSec, setTimeSec] = useState('');
  const secRef = useRef<TextInput>(null);
  const [scoreRx, setScoreRx] = useState(true);
  const [boardTab, setBoardTab] = useState<'rx' | 'scaled'>('rx');
  const [scoreNotes, setScoreNotes] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [contestModal, setContestModal] = useState<Participant | null>(null);
  const [contestReason, setContestReason] = useState('');
  const [eloDeltas, setEloDeltas] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!user) return;
    try {
    const { data: t } = await supabase
      .from('daily_tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (t) setTournament(t as TournamentDetail);

    // Participants with scores and profiles
    const { data: parts } = await supabase
      .from('daily_tournament_participants')
      .select('user_id, profile:profiles!user_id(username, level, elo)')
      .eq('tournament_id', tournamentId);

    const { data: scores } = await supabase
      .from('daily_tournament_scores')
      .select('user_id, score_value, capped, rx, submitted_at, video_url, status')
      .eq('tournament_id', tournamentId);

    const scoreMap = new Map((scores ?? []).map((s: any) => [s.user_id, s]));

    const mapped: Participant[] = (parts ?? []).map((p: any) => {
      const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
      const score = scoreMap.get(p.user_id);
      return {
        user_id: p.user_id,
        username: profile?.username ?? '—',
        level: profile?.level ?? 'scaled',
        elo: profile?.elo ?? 1000,
        score_value: score?.score_value ?? null,
        capped: score?.capped ?? false,
        rx: score?.rx ?? true,
        submitted_at: score?.submitted_at ?? null,
        video_url: score?.video_url ?? null,
        status: score?.status ?? 'pending',
      };
    });

    // Sort: scored first, RX above Scaled within scored, then by score, then unscored
    const scoreMode = t?.score_mode ?? 'time';
    mapped.sort((a, b) => {
      if (a.score_value === null && b.score_value === null) return 0;
      if (a.score_value === null) return 1;
      if (b.score_value === null) return -1;
      // Miroir bit-à-bit de l'ORDER BY de compute_daily_tournament_elo.
      return compareScores(
        { rx: a.rx, score_value: a.score_value, capped: a.capped },
        { rx: b.rx, score_value: b.score_value, capped: b.capped },
        scoreMode === 'time',
      );
    });

    setParticipants(mapped);
    const alreadyJoined = mapped.some(p => p.user_id === user.id);
    const isCreator = t?.creator_id === user.id;

    // Auto-join creator if not already in participants
    if (isCreator && !alreadyJoined) {
      await supabase.from('daily_tournament_participants').upsert({
        tournament_id: tournamentId,
        user_id: user.id,
      }, { onConflict: 'tournament_id,user_id', ignoreDuplicates: true });
      setHasJoined(true);
    } else {
      setHasJoined(alreadyJoined);
    }

    setHasScored(mapped.some(p => p.user_id === user.id && p.score_value !== null));

    // ELO: compute lazily after tournament ends_at has passed, then load deltas
    const tournEnded = t?.ends_at ? new Date() >= new Date(t.ends_at) : false;
    // Fenêtre expirée mais jamais complété (ex. < max_players scores) : complétion
    // paresseuse via RPC pour que l'ELO puisse enfin être distribué.
    let tournStatus = t?.status;
    if (t && tournStatus !== 'completed' && tournEnded && !t.is_official && (alreadyJoined || isCreator)) {
      const { error: cErr } = await supabase.rpc('complete_daily_tournament', { p_tournament_id: tournamentId });
      if (!cErr) tournStatus = 'completed';
    }
    if (tournStatus === 'completed' && tournEnded && !t?.is_official) {
      const { data: eloHist } = await supabase
        .from('daily_tournament_elo_history')
        .select('user_id, elo_delta')
        .eq('tournament_id', tournamentId);

      if ((eloHist ?? []).length === 0 && mapped.length >= 2) {
        await computeAndSaveEloForTournament(tournamentId, t, mapped);
        const { data: freshHist } = await supabase
          .from('daily_tournament_elo_history')
          .select('user_id, elo_delta')
          .eq('tournament_id', tournamentId);
        const dMap: Record<string, number> = {};
        (freshHist ?? []).forEach((h: any) => { dMap[h.user_id] = h.elo_delta; });
        setEloDeltas(dMap);
      } else {
        const dMap: Record<string, number> = {};
        (eloHist ?? []).forEach((h: any) => { dMap[h.user_id] = h.elo_delta; });
        setEloDeltas(dMap);
      }
    } else {
      setEloDeltas({});
    }

    } catch (e) { captureError(e, { screen: 'DailyTournamentDetail', action: 'load' }); }
    setLoading(false);
    setRefreshing(false);
  }, [user, tournamentId]);

  useEffect(() => { load(); }, [load]);

  function mapTimerType(wodType: string): TimerType {
    const map: Record<string, TimerType> = {
      'For Time': 'for-time', 'AMRAP': 'amrap', 'EMOM': 'emom', 'Tabata': 'tabata',
    };
    return map[wodType] ?? 'for-time';
  }

  function handleLaunchWOD() {
    if (!tournament) return;
    const tt = mapTimerType(tournament.wod_type);
    const dur = (tournament.duration || 12) * 60;
    navigation.navigate('TimerRun', {
      timerType: tt,
      countdown: 10,
      totalSeconds: tt === 'amrap' || tt === 'emom' ? dur : 0,
      maxTime: tt === 'for-time' ? dur : 0,
      interval: tt === 'emom' ? 60 : 0,
      rounds: 1,
      workTime: tt === 'tabata' ? 20 : 0,
      restTime: tt === 'tabata' ? 10 : 0,
      withCamera: true,
      sequence: '[]',
      videoTitle: tournament.wod_name,
      withTimestamp: true,
    });
  }

  async function handleJoin() {
    if (!user) return;
    // Gender check
    if (tournament?.gender_target && tournament.gender_target !== 'mix') {
      const profile = await fetchMyProfile();
      if (profile?.gender && profile.gender !== tournament.gender_target) {
        const label = tournament.gender_target === 'male' ? 'hommes' : 'femmes';
        Alert.alert('Accès restreint', `Ce tournoi est réservé aux ${label}.`);
        return;
      }
      if (!profile?.gender) {
        Alert.alert('Genre non renseigné', 'Renseigne ton genre dans ton profil pour rejoindre ce tournoi.');
        return;
      }
    }
    setJoining(true);
    const { error } = await supabase.from('daily_tournament_participants').upsert({
      tournament_id: tournamentId,
      user_id: user.id,
    }, { onConflict: 'tournament_id,user_id', ignoreDuplicates: true });
    setJoining(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    trackDailyTournamentJoin(tournamentId);
    load();
  }

  async function handleSubmitScore() {
    const hasInput = tournament?.score_mode === 'time'
      ? (scoreCapped ? capReps.trim() : (timeMin.trim() || timeSec.trim()))
      : scoreInput.trim();
    if (!user || !hasInput) return;
    setSubmitting(true);

    let value = 0;
    let capped = false;
    if (tournament?.score_mode === 'time') {
      if (scoreCapped && !(parseInt(capReps) > 0)) {
        Alert.alert('Score invalide', 'Entre le nombre de répétitions complétées au cap.');
        setSubmitting(false);
        return;
      }
      ({ score_value: value, capped } = scoreCapped
        ? mapForTimeScore({ capped: true, reps: parseInt(capReps) || 0 })
        : mapForTimeScore({ capped: false, minutes: parseInt(timeMin) || 0, seconds: parseInt(timeSec) || 0 }));
    } else {
      value = parseFloat(scoreInput);
    }

    if (isNaN(value) || value <= 0) {
      Alert.alert('Valeur invalide', 'Entre un score valide.');
      setSubmitting(false);
      return;
    }

    // Validate video URL if provided
    const trimmedVideo = videoUrl.trim();
    if (trimmedVideo && !/^https?:\/\/.+/i.test(trimmedVideo)) {
      Alert.alert('Lien vidéo invalide', 'Le lien vidéo doit commencer par http:// ou https://');
      setSubmitting(false);
      return;
    }

    // Cap validation for AMRAP / EMOM / Tabata
    const sType = tournament?.score_mode === 'time' ? 'time' : 'reps';
    const maxScore = computeMaxScore(
      tournament?.wod_type,
      tournament?.movements,
      tournament?.duration ? tournament.duration * 60 : null,
      null,
      sType,
    );
    if (maxScore && !capped && value > maxScore) {
      Alert.alert('Score trop élevé', `Le maximum estimé pour ce WOD est de ${maxScore} reps. Vérifie ta saisie.`);
      setSubmitting(false);
      return;
    }

    // Inscription implicite au WOD du Jour : soumettre un score = participer.
    if (tournament?.is_official && !hasJoined) {
      await supabase.from('daily_tournament_participants').upsert({
        tournament_id: tournamentId,
        user_id: user.id,
      }, { onConflict: 'tournament_id,user_id', ignoreDuplicates: true });
    }

    const { error } = await supabase.from('daily_tournament_scores').upsert({
      tournament_id: tournamentId,
      user_id: user.id,
      score_value: value,
      capped,
      rx: scoreRx,
      notes: scoreNotes.trim() || null,
      video_url: videoUrl.trim() || null,
      status: 'pending',
    }, { onConflict: 'tournament_id,user_id' });

    setSubmitting(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    incrementCounter(user.id, 'total_scores_submitted', 1, currentBox?.id).catch(e => captureError(e, { action: 'incrementScores' }));
    cancelTodayScoreReminder().catch(e => captureError(e, { action: 'cancelScoreReminder' }));

    // Log movement reps for badges
    if (tournament?.movements) {
      const lines = tournament.movements.split('\n').filter(Boolean);
      const sType = tournament.score_mode === 'time' ? 'time' : 'reps';
      const completed = computeCompletedMovements(lines, tournament.wod_type, value, sType, { gender: user.gender });
      logMovementReps(user.id, completed, 'daily', tournamentId).catch(e => captureError(e, { action: 'logMovementReps' }));
    }

    trackDailyTournamentScoreSubmit(tournamentId, tournament?.score_mode ?? 'reps');
    hapticSuccess();
    setScoreModal(false);
    setScoreInput('');
    setScoreNotes('');
    setVideoUrl('');
    setScoreCapped(false);
    setCapReps('');
    setTimeMin('');
    setTimeSec('');

    // Check if all participants scored → complete tournament
    const { count } = await supabase
      .from('daily_tournament_scores')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    if (count && count >= (tournament?.max_players ?? 5)) {
      await completeTournament();
    }

    load();
  }

  async function completeTournament() {
    if (!tournament) return;
    // RPC serveur : complète si tous les scores attendus sont là OU si la fenêtre est
    // expirée. Appelable par TOUT participant — avant, l'update direct échouait en
    // silence (RLS créateur uniquement) quand le dernier score venait d'un autre
    // joueur, et l'ELO n'était jamais distribué.
    const { error } = await supabase.rpc('complete_daily_tournament', { p_tournament_id: tournamentId });
    if (error) captureError(error, { screen: 'DailyTournamentDetail', action: 'completeTournament' });
  }

  async function computeAndSaveEloForTournament(tId: string, _t: any, _parts: Participant[]) {
    // ELO is computed and persisted entirely server-side (idempotent RPC).
    // The client never supplies ELO values; it only triggers the computation.
    const { data, error } = await supabase.rpc('compute_daily_tournament_elo', { p_tournament_id: tId });
    if (error) { captureError(error, { screen: 'DailyTournamentDetail', action: 'computeElo' }); return; }
    for (const r of (data ?? [])) {
      await syncLevelAndBadges(r.user_id, r.elo_after);
    }
  }

  // Validation/contestation par les PAIRS via RPC SECURITY DEFINER : l'update direct
  // était un no-op silencieux (la RLS n'autorise que l'auteur du score) — l'app
  // affichait « validé » sans rien écrire. Le RPC vérifie : relecteur participant,
  // pas son propre score, score encore pending, tournoi non complété.
  async function handleValidateScore(participantId: string) {
    const { error } = await supabase.rpc('peer_review_daily_score', {
      p_tournament_id: tournamentId, p_user_id: participantId, p_action: 'validated',
    });
    if (error) { Alert.alert('Erreur', error.message); return; }
    Alert.alert('Score validé !');
    load();
  }

  async function handleContestScore() {
    if (!contestModal || !user) return;
    const { error } = await supabase.rpc('peer_review_daily_score', {
      p_tournament_id: tournamentId, p_user_id: contestModal.user_id,
      p_action: 'contested', p_reason: contestReason.trim() || undefined,
    });
    if (error) { Alert.alert('Erreur', error.message); return; }
    setContestModal(null);
    setContestReason('');
    Alert.alert('Score contesté — un administrateur vérifiera.');
    load();
  }

  function timeLeft(): string {
    if (!tournament) return '';
    const diff = new Date(tournament.ends_at).getTime() - Date.now();
    if (diff <= 0) return 'Terminé';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h${String(m).padStart(2, '0')} restantes`;
  }

  if (loading || !tournament) {
    return (
      <View style={[S.screen, S.center]}>
        <GlassBackground />
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const isCompleted = tournament.status === 'completed';
  const isOfficial = tournament.is_official === true;
  const isFull = !isOfficial && participants.length >= tournament.max_players;

  const scoreMode = tournament.score_mode ?? 'time';
  // Unresolved contested scores don't hold a rank (mirrors the server ELO rule).
  const rankGroup = (rx: boolean) =>
    participants
      .filter(p => p.score_value !== null && p.status !== 'contested' && p.rx === rx)
      .sort((a, b) => scoreMode === 'time'
        ? (a.score_value ?? 0) - (b.score_value ?? 0)
        : (b.score_value ?? 0) - (a.score_value ?? 0));
  const rxRanked = rankGroup(true);
  const scaledRanked = rankGroup(false);

  // Combined RX-first ranking for the mini-tournament board, contested excluded.
  const rankByUser = new Map<string, number>();
  participants
    .filter(p => p.score_value !== null && p.status !== 'contested')
    .forEach((p, i) => rankByUser.set(p.user_id, i + 1));

  const scaledMovements = tournament.movements_scaled || getScaledMovements(tournament.wod_name, tournament.movements);
  const shownMovements = !isOfficial || boardTab === 'rx' ? tournament.movements : scaledMovements;
  const shownRanked = boardTab === 'rx' ? rxRanked : scaledRanked;

  function renderPlayerRow(p: Participant, rank: number | null, isMe: boolean) {
    const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Medal : null;
    const rankColor = rank === 1 ? theme.gold : rank === 2 ? theme.silver : rank === 3 ? theme.bronze : c.textMuted;
    const statusTone = p.status === 'validated' ? 'active'
      : p.status === 'contested' ? 'danger' : 'warning';
    const statusLabel = p.status === 'validated' ? 'Validé'
      : p.status === 'contested' ? 'Contesté' : 'En attente';
    const delta = eloDeltas[p.user_id];

    return (
      <AxCard key={p.user_id} testID={`mini-player-${p.user_id}`} style={[S.playerCard, isMe && S.playerCardMe]}>
        <View style={S.playerRow}>
          <View style={S.rankCol}>
            {RankIcon ? (
              <RankIcon color={rankColor} size={18} />
            ) : (
              <Text style={S.rankNum}>{rank ?? '—'}</Text>
            )}
          </View>
          <View style={S.playerInfo}>
            <Text style={S.playerName} numberOfLines={2}>{p.username} {isMe ? '(moi)' : ''}</Text>
            <View style={S.playerMeta}>
              <AxStatusDot label={p.level.toUpperCase()} color={levelInk(p.level, c)} />
              <Text style={S.caption}>{p.elo} ELO</Text>
              {isCompleted && delta != null && (
                <Text style={[S.caption, S.delta, { color: delta > 0 ? hue(theme.mode, 'positive') : delta < 0 ? hue(theme.mode, 'negative') : c.textMuted }]}>
                  {delta > 0 ? '+' : ''}{delta}
                </Text>
              )}
            </View>
          </View>
          {p.score_value !== null ? (
            <View style={S.scoreCol}>
              <Text style={S.scoreValue}>{formatScore(p.score_value, tournament!.score_mode, p.capped)}</Text>
              <Text style={S.scoreRx}>{p.rx ? 'RX' : 'SC'}</Text>
            </View>
          ) : (
            <Text style={S.pendingTxt}>En attente…</Text>
          )}
        </View>

        {p.score_value !== null && (
          <View style={S.playerActions}>
            <View style={S.playerActionsTop}>
              {p.video_url ? (
                <AxButton label="Vidéo" variant="outline" icon={Youtube} testID={`mini-video-${p.user_id}`} onPress={async () => {
                  try {
                    const canOpen = await Linking.canOpenURL(p.video_url!);
                    if (canOpen) {
                      await Linking.openURL(p.video_url!);
                    } else {
                      Alert.alert('Lien invalide', `Impossible d'ouvrir ce lien vidéo.\n\n${p.video_url}`);
                    }
                  } catch (e: any) {
                    Alert.alert('Erreur vidéo', e?.message ?? 'Erreur inconnue');
                  }
                }} />
              ) : (
                <AxTag label="Pas de vidéo" tone="muted" />
              )}
              <AxStatusDot label={statusLabel} tone={statusTone} testID={`mini-player-status-${p.user_id}`} />
            </View>

            {!isMe && hasJoined && p.status === 'pending' && (
              <View style={S.voteRow}>
                <View style={S.voteCell}>
                  <AxButton label="Valider" variant="outline" icon={ThumbsUp} fullWidth onPress={() => handleValidateScore(p.user_id)} testID={`mini-validate-${p.user_id}`} />
                </View>
                <View style={S.voteCell}>
                  <AxButton label="Contester" variant="stop" icon={AlertTriangle} fullWidth onPress={() => { setContestModal(p); setContestReason(''); }} testID={`mini-contest-${p.user_id}`} />
                </View>
              </View>
            )}
          </View>
        )}
      </AxCard>
    );
  }

  return (
    <View style={S.screen}>
      <GlassBackground />
      <AxScreenHeader
        title={i18n.t('screenTitles.miniTournament')}
        right={<AxIconButton icon={Share2} onPress={() => Share.share({ message: `${tournament.wod_name} — Rejoins le mini-tournoi sur AthleX ! athlex://daily/${tournamentId}` })} accessibilityLabel={i18n.t('common.share')} testID="header-share" />}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.content, { paddingBottom: tabSpace }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <AxContentTitle title={tournament.wod_name} testID="mini-detail-title" />
        <View style={S.badges}>
          {isOfficial && <AxTag label="WOD DU JOUR" dot testID="mini-official-tag" />}
          <AxTag label={tournament.wod_type} testID="mini-detail-type" />
          <AxTag label={tournament.level.toUpperCase()} color={levelInk(tournament.level, c)} />
          {tournament.duration > 0 && <AxTag label={`${tournament.duration} min`} tone="muted" />}
          <AxStatusDot label={isCompleted ? 'TERMINÉ' : timeLeft()} tone={isCompleted ? 'danger' : 'active'} testID="mini-detail-status" />
          {tournament.gender_target && tournament.gender_target !== 'mix' && (
            <AxTag label={tournament.gender_target === 'male' ? 'Homme' : 'Femme'} tone="muted" />
          )}
        </View>

        {isOfficial ? (
          <AxCard style={S.rewardCard}>
            <Flame color={c.accentText} size={18} />
            <Text style={S.rewardTxt}>WOD du Jour officiel · classement RX / Scaled · ouvert à toute la communauté</Text>
          </AxCard>
        ) : (
          <AxCard style={S.rewardCard}>
            <Trophy color={c.accentText} size={18} />
            <Text style={S.rewardTxt}>Récompense : +{tournament.elo_reward} ELO pour le 1er</Text>
          </AxCard>
        )}

        {isOfficial && (
          <View style={S.segment}>
            <AxChip label="RX" selected={boardTab === 'rx'} onPress={() => setBoardTab('rx')} testID="mini-board-rx" />
            <AxChip label="Scaled" selected={boardTab === 'scaled'} onPress={() => setBoardTab('scaled')} testID="mini-board-scaled" />
          </View>
        )}

        <AxCard testID="mini-wod-card" style={S.wodCard}>
          <View style={S.wodTitleRow}>
            <Text style={S.wodTitle}>{tournament.wod_name}</Text>
            {isOfficial && <AxTag label={boardTab === 'rx' ? 'RX' : 'SCALED'} />}
          </View>
          {shownMovements.split('\n').map((line, i) => (
            <Text key={i} style={line.startsWith('  ') ? S.wodLine : S.wodHeader}>{line}</Text>
          ))}
          {isOfficial && boardTab === 'scaled' && (
            <Text style={S.wodScaledHint}>Version allégée — adapte encore les charges à ton niveau si besoin.</Text>
          )}
          {tournament.scoring && (
            <View style={S.scoringRow}>
              <Zap color={c.textMuted} size={12} />
              <Text style={S.caption}>{tournament.scoring}</Text>
            </View>
          )}
        </AxCard>

        {isOfficial ? (
          <>
            <Text style={S.sectionTitle}>Classement {boardTab === 'rx' ? 'RX' : 'Scaled'} ({shownRanked.length})</Text>
            {shownRanked.length === 0 ? (
              <Text style={S.noParticipants}>Aucun score {boardTab === 'rx' ? 'RX' : 'Scaled'} pour le moment.</Text>
            ) : (
              shownRanked.map((p, i) => renderPlayerRow(p, i + 1, p.user_id === user?.id))
            )}
          </>
        ) : (
          <>
            <Text style={S.sectionTitle}>
              Classement ({participants.length}/{tournament.max_players})
            </Text>
            {participants.length === 0 ? (
              <Text style={S.noParticipants}>Aucun participant pour le moment.</Text>
            ) : (
              participants.map((p) => renderPlayerRow(p, rankByUser.get(p.user_id) ?? null, p.user_id === user?.id))
            )}
          </>
        )}

        {!isCompleted && (
          <View style={S.actions}>
            {isOfficial ? (
              !hasScored ? (
                <>
                  <AxButton label="Lancer le WOD" icon={Play} fullWidth onPress={handleLaunchWOD} testID="mini-launch" />
                  <AxButton label="Entrer mon score manuellement" variant="outline" icon={Edit3} fullWidth onPress={() => { setScoreRx(boardTab === 'rx'); setScoreModal(true); }} testID="mini-manual" />
                </>
              ) : (
                <AxCard style={S.doneBadge}>
                  <Check color={c.accentText} size={16} />
                  <Text style={S.doneTxt}>Score soumis</Text>
                </AxCard>
              )
            ) : (
            <>
            {!hasJoined && !isFull && (
              <AxButton label="Rejoindre" icon={Users} fullWidth onPress={handleJoin} disabled={joining} loading={joining} testID="mini-join" />
            )}
            {hasJoined && !hasScored && (
              <>
                <AxButton label="Lancer le WOD" icon={Play} fullWidth onPress={handleLaunchWOD} testID="mini-launch" />
                <AxButton label="Entrer mon score manuellement" variant="outline" icon={Edit3} fullWidth onPress={() => setScoreModal(true)} testID="mini-manual" />
              </>
            )}
            {hasScored && (
              <AxCard style={S.doneBadge}>
                <Check color={c.accentText} size={16} />
                <Text style={S.doneTxt}>Score soumis</Text>
              </AxCard>
            )}
            </>
            )}
          </View>
        )}

        {!isOfficial && isCompleted && participants.length > 0 && participants[0].score_value !== null && (
          <AxCard variant="featured" style={S.winnerCard} testID="mini-winner">
            <Crown color={theme.gold} size={22} />
            <Text style={S.winnerTxt}>{participants[0].username} remporte +{tournament.elo_reward} ELO !</Text>
          </AxCard>
        )}
      </ScrollView>

      {/* Score modal */}
      <Modal visible={scoreModal} transparent animationType="slide" onRequestClose={() => setScoreModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalOverlay}>
          <View style={S.modalSheet} testID="mini-score-sheet">
            <View style={S.modalHandle} />
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Entrer mon score</Text>
              <AxIconButton icon={X} onPress={() => setScoreModal(false)} accessibilityLabel={i18n.t('common.close')} testID="mini-score-close" />
            </View>

            <Text style={S.modalLabel}>
              {tournament.score_mode === 'time' && scoreCapped ? 'REPS AU CAP' :
               tournament.score_mode === 'time' ? 'TEMPS (MM:SS)' :
               tournament.score_mode === 'reps' ? 'NOMBRE DE REPS' :
               tournament.score_mode === 'rounds' ? 'NOMBRE DE ROUNDS' : 'POIDS (KG)'}
            </Text>
            {tournament.score_mode === 'time' && (
              <View style={S.cappedRow}>
                <Text style={S.cappedLabel}>Temps limite atteint (CAP)</Text>
                <AxSwitch
                  value={scoreCapped}
                  onValueChange={() => { setScoreCapped(!scoreCapped); setCapReps(''); setTimeMin(''); setTimeSec(''); }}
                  accessibilityLabel="Temps limite atteint (CAP)"
                  testID="mini-score-capped"
                />
              </View>
            )}
            {tournament.score_mode === 'time' && scoreCapped ? (
              <TextInput
                style={S.modalInput}
                value={capReps}
                onChangeText={v => setCapReps(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="Reps complétées au cap"
                placeholderTextColor={c.textMuted}
                autoFocus
              />
            ) : tournament.score_mode === 'time' ? (
              <View style={S.timeRow}>
                <TextInput
                  style={[S.modalInput, S.timeInput]}
                  placeholder="MM"
                  placeholderTextColor={c.textMuted}
                  value={timeMin}
                  onChangeText={(t) => {
                    const d = t.replace(/\D/g, '').slice(0, 2);
                    setTimeMin(d);
                    if (d.length === 2) secRef.current?.focus();
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  autoFocus
                />
                <Text style={S.timeColon}>:</Text>
                <TextInput
                  ref={secRef}
                  style={[S.modalInput, S.timeInput]}
                  placeholder="SS"
                  placeholderTextColor={c.textMuted}
                  value={timeSec}
                  onChangeText={(t) => setTimeSec(t.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            ) : (
              <TextInput
                style={S.modalInput}
                value={scoreInput}
                onChangeText={setScoreInput}
                keyboardType="number-pad"
                placeholder="150"
                placeholderTextColor={c.textMuted}
                autoFocus
              />
            )}

            <View style={S.rxRow}>
              <AxChip label="RX" selected={scoreRx} onPress={() => setScoreRx(true)} testID="mini-score-rx" />
              <AxChip label="Scaled" selected={!scoreRx} onPress={() => setScoreRx(false)} testID="mini-score-scaled" />
            </View>

            <AxTextField
              value={scoreNotes}
              onChangeText={setScoreNotes}
              placeholder="Notes (optionnel)"
              multiline
              accessibilityLabel="Notes (optionnel)"
              testID="mini-score-notes"
            />

            <Text style={S.modalLabel}>LIEN VIDÉO YOUTUBE (recommandé)</Text>
            <AxTextField
              icon={Link}
              value={videoUrl}
              onChangeText={setVideoUrl}
              placeholder="https://youtube.com/..."
              autoCapitalize="none"
              keyboardType="url"
              accessibilityLabel="Lien vidéo YouTube"
              testID="mini-score-video"
            />

            <AxButton
              label="Valider mon score"
              icon={Check}
              fullWidth
              onPress={handleSubmitScore}
              disabled={!(tournament?.score_mode === 'time' ? (scoreCapped ? capReps.trim() : (timeMin.trim() || timeSec.trim())) : scoreInput.trim())}
              loading={submitting}
              testID="mini-score-submit"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Contest modal */}
      <Modal visible={!!contestModal} transparent animationType="slide" onRequestClose={() => setContestModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalOverlay}>
          <View style={S.modalSheet} testID="mini-contest-sheet">
            <View style={S.modalHandle} />
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Contester le score</Text>
              <AxIconButton icon={X} onPress={() => setContestModal(null)} accessibilityLabel={i18n.t('common.close')} testID="mini-contest-close" />
            </View>
            <Text style={S.contestInfo}>
              {contestModal?.username} — {contestModal?.score_value != null ? formatScore(contestModal.score_value, tournament?.score_mode ?? 'time') : ''}
            </Text>
            <AxTextField
              value={contestReason}
              onChangeText={setContestReason}
              placeholder="Raison de la contestation..."
              multiline
              accessibilityLabel="Raison de la contestation"
              testID="mini-contest-reason"
            />
            <AxButton label="Confirmer la contestation" variant="stop" icon={AlertTriangle} fullWidth onPress={handleContestScore} testID="mini-contest-confirm" />
            <AxButton label="Annuler" variant="outline" fullWidth onPress={() => setContestModal(null)} testID="mini-contest-cancel" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(t: AppTheme) {
  const c = t.ax;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    center: { justifyContent: 'center', alignItems: 'center' },
    content: { padding: axSpacing.lg, gap: axSpacing.md },
    badges: { flexDirection: 'row', gap: axSpacing.sm, flexWrap: 'wrap', alignItems: 'center' },
    rewardCard: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, padding: axSpacing.md },
    rewardTxt: { ...axTypography.bodySmall, color: c.text, flex: 1 },
    wodCard: { gap: axSpacing.xs },
    wodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, marginBottom: axSpacing.xs, flexWrap: 'wrap' },
    wodTitle: { ...axTypography.titleM, color: c.text, flexShrink: 1 },
    wodScaledHint: { ...axTypography.caption, fontStyle: 'italic', color: c.textMuted, marginTop: axSpacing.xs },
    segment: { flexDirection: 'row', gap: axSpacing.sm },
    wodHeader: { ...axTypography.label, color: c.textMuted },
    wodLine: { ...axTypography.body, color: c.text },
    scoringRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, marginTop: axSpacing.xs },
    caption: { ...axTypography.caption, color: c.textMuted, flexShrink: 1 },
    delta: { fontWeight: '800' },
    sectionTitle: { ...axTypography.overline, color: c.textMuted, marginTop: axSpacing.sm },
    noParticipants: { ...axTypography.bodySmall, color: c.textMuted },
    playerCard: { padding: 0, gap: 0 },
    playerCardMe: { borderColor: c.accent },
    playerRow: { flexDirection: 'row', alignItems: 'center', padding: axSpacing.md, gap: axSpacing.md },
    rankCol: { width: 28, alignItems: 'center' },
    rankNum: { ...axTypography.label, color: c.textMuted },
    playerInfo: { flex: 1, minWidth: 0 },
    playerName: { ...axTypography.label, color: c.text },
    playerMeta: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, marginTop: 2, flexWrap: 'wrap' },
    scoreCol: { alignItems: 'flex-end' },
    scoreValue: { ...axTypography.numberM, color: c.text },
    scoreRx: { ...axTypography.overlineSmall, color: c.accentText, marginTop: 1 },
    pendingTxt: { ...axTypography.caption, color: c.textMuted, fontStyle: 'italic' },
    playerActions: {
      paddingHorizontal: axSpacing.md, paddingBottom: axSpacing.md, paddingTop: axSpacing.sm, gap: axSpacing.sm,
      borderTopWidth: 1, borderTopColor: c.border,
    },
    playerActionsTop: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, flexWrap: 'wrap' },
    voteRow: { flexDirection: 'row', gap: axSpacing.sm },
    voteCell: { flex: 1 },
    actions: { gap: axSpacing.sm },
    doneBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: axSpacing.sm, padding: axSpacing.md },
    doneTxt: { ...axTypography.label, color: c.accentText },
    winnerCard: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
    winnerTxt: { ...axTypography.label, color: c.text, flex: 1 },
    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.modalBackdrop },
    modalSheet: {
      backgroundColor: c.background, borderTopLeftRadius: axRadius.card, borderTopRightRadius: axRadius.card,
      borderWidth: 1, borderColor: c.border,
      padding: axSpacing.xl, paddingBottom: 40, gap: axSpacing.md,
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm },
    modalTitle: { ...axTypography.titleM, color: c.text, flexShrink: 1 },
    modalLabel: { ...axTypography.overline, color: c.textMuted },
    modalInput: {
      ...axTypography.numberM,
      backgroundColor: c.field, borderRadius: axRadius.control, borderWidth: 1, borderColor: c.fieldBorder,
      paddingHorizontal: axSpacing.md, paddingVertical: axSpacing.md, color: c.text,
    },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    timeInput: { flex: 1, textAlign: 'center' },
    timeColon: { ...axTypography.numberM, color: c.text },
    cappedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.md },
    cappedLabel: { ...axTypography.body, color: c.text, flex: 1 },
    rxRow: { flexDirection: 'row', gap: axSpacing.sm },
    contestInfo: { ...axTypography.label, color: c.textMuted },
  });
}
