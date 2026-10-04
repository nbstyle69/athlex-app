import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, RefreshControl, FlatList, Share, AppState,
} from 'react-native';
import { Clock, Plus, RotateCcw, MessageSquare, Trophy, Heart, Send, X, Smile, Share2, Play, Medal, Check } from 'lucide-react-native';
import WebView from 'react-native-webview';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import ShareScoreCard from '../../components/ShareScoreCard';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { hapticSuccess } from '../../lib/haptics';
import { computeAndSaveElo, sortScoresRxFirst } from '../../services/eloCompute';
import { leaderboardAvailable } from '../../utils/programSchedule';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { spacing, borderRadius, typography, shadows } from '../../theme/designTokens';
import { BoxWOD, WODScore, ScoreType } from '../../types';
import { WhiteboardStackParamList } from '../../navigation';
import { sendScoreNotification, sendScoreOvertakenNotification, cancelTodayScoreReminder } from '../../services/notifications';
import { incrementCounter, logMovementReps } from '../../services/gamification';
import { formatScoreValue, normalizeScore, mapForTimeScore, formatCap } from '../../utils/scoreFormat';
import { computeCompletedMovements } from '../../utils/movementParser';
import { annotateGymRepsInText, annotateStrengthLoads, parseStrengthLine, StrengthEntry } from '../../utils/strengthBlock';
import { annotateCardioLines } from '../../utils/cardioBlock';
import {
  applyGymRecordsToGrid, buildStrengthGrid, logStrengthSets, StrengthSetDraft, ServerStrengthSession, StrengthSourceKey,
  loadStrengthGrid, saveStrengthDraft, gridFromServer, fetchStrengthSession, submitStrengthValidation,
  strengthProgress, computedMaxLoad, validationErrorCode, isNetworkError,
} from '../../services/strengthSets';
import i18n from '../../i18n';
import { wodTypeLabel } from '../../utils/wodTypeLabel';
import StrengthSetGrid, {
  StrengthMaxLoadRow, StrengthMyLoadsCard, StrengthSaveState, StrengthSessionStatus,
} from '../../components/wod/StrengthSetGrid';
import { AxButton, AxCard, AxChip, AxTag, AxTextField } from '../../components/ax';
import { axSpacing, axTypography } from '../../theme/axTokens';
import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxContentTitle } from '../../components/ax/AxContentTitle';
import { AxIconButton } from '../../components/ax/AxIconButton';
import { useMyRecords } from '../../hooks/useMyOneRepMax';
import { recordStrengthPRs } from '../../services/strengthPR';
import { computeMaxScore } from '../../utils/computeMaxScore';
import { syncLevelAndBadges } from '../../utils/eloLevels';
import { trackScoreSubmit } from '../../lib/analytics';
import UserAvatar from '../../components/UserAvatar';
import GlassBackground from '../../components/glass/GlassBackground';
import EmeraldCTAButton from '../../components/glass/EmeraldCTAButton';
import ReportMenu from '../../components/ReportMenu';
import { readRows } from '../../lib/db';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

const DAY_LABELS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

type Nav   = NativeStackNavigationProp<WhiteboardStackParamList>;
type Route = RouteProp<WhiteboardStackParamList, 'WODDetail'>;

function allowedScoreTypes(wodType?: string | null): { types: ScoreType[]; default: ScoreType } {
  switch (wodType) {
    case 'for-time': return { types: ['time'],            default: 'time'   };
    case 'amrap':    return { types: ['reps'],            default: 'reps'   };
    case 'emom':     return { types: ['reps', 'rounds'],  default: 'rounds' };
    case 'tabata':   return { types: ['reps'],            default: 'reps'   };
    case 'strength': return { types: ['weight'],          default: 'weight' };
    default:         return { types: ['time', 'reps', 'weight', 'rounds'], default: 'reps' };
  }
}

/** Délai d'enregistrement du brouillon après la dernière frappe. */
export const DRAFT_SAVE_DELAY_MS = 800;
/** Nouvel essai d'envoi d'une copie locale restée hors connexion. */
const OFFLINE_RETRY_MS = 15000;

function formatScore(score: WODScore): string {
  return formatScoreValue(score.score_value, score.score_type, score.capped);
}

// ── ELO Calculation (delegated to shared utility) ───────────────────────

// ─────────────────────────────────────────────────────────────────────────

export default function WODDetailScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { user, currentBox } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { wodId, scrollToLeaderboard } = route.params;
  const S = createStyles(theme);
  const c = theme.ax;
  const medalInk = [c.warning, c.textMuted, c.orange];
  const { oneRepMaxFor, gymRecordFor, reload: reloadRecords } = useMyRecords();
  const scrollRef = useRef<ScrollView>(null);
  const leaderboardY = useRef(0);

  const [wod,         setWod]         = useState<BoxWOD | null>(null);
  const [scores,      setScores]      = useState<WODScore[]>([]);
  const [myScore,     setMyScore]     = useState<WODScore | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);

  // Score form
  const [scoreType,  setScoreType]  = useState<ScoreType>('reps');
  const [scoreInput, setScoreInput] = useState('');
  const [timeMin,    setTimeMin]    = useState('');
  const [timeSec,    setTimeSec]    = useState('');
  const secRef = useRef<TextInput>(null);
  const [isRx,       setIsRx]       = useState(true);
  const [noteInput,  setNoteInput]  = useState('');
  const [dnf,        setDnf]        = useState(false);
  const [capReps,    setCapReps]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Séries réellement réalisées sur les blocs musculation : une ligne par série
  // prescrite, pré-remplie. C'est cette saisie — pas la prescription — qui
  // alimente le journal ET les 1RM.
  const [strengthDrafts, setStrengthDrafts] = useState<StrengthSetDraft[]>([]);

  // Séance de musculation (WOD « strength ») : brouillon côté serveur, repris
  // sur n'importe quel appareil, validé par validate_strength_session.
  const [strengthServer, setStrengthServer] = useState<ServerStrengthSession | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<StrengthSaveState>('idle');
  const [draftDirtyTick, setDraftDirtyTick] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const draftsRef = useRef<StrengthSetDraft[]>([]);
  const editedAtRef = useRef<string | null>(null);
  const baseUpdatedAtRef = useRef<string | null>(null);
  const strengthOriginRef = useRef<'server' | 'local' | 'prescription' | null>(null);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const strengthLoadedFor = useRef<string | null>(null);
  draftsRef.current = strengthDrafts;

  // Score detail modal
  const [selectedScore, setSelectedScore] = useState<WODScore | null>(null);
  const [comments, setComments]     = useState<any[]>([]);
  const [reactions, setReactions]   = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  const EMOJI_LIST = ['❤️', '🔥', '💪', '👏', '🎯', '⚡', '🏆', '💥', '👊', '🙌', '😤', '🫡'];

  // Reaction/comment counts per score
  const [scoreMeta, setScoreMeta] = useState<Record<string, { reactions: number; comments: number }>>({});
  const [eloDeltas, setEloDeltas] = useState<Record<string, number>>({});
  const [shareModal, setShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  const load = useCallback(async () => {
    const { data: wodData } = await supabase.from('box_wods').select('*').eq('id', wodId).single();
    const w = wodData as BoxWOD | null;
    setWod(w);

    if (w) {
      // Pas de `gender` ici : le genre d'un autre athlète n'est plus lisible
      // (Lot 0-bis), et le mentionner ferait échouer TOUTE la requête — donc le
      // classement entier disparaîtrait en silence. `readRows` remonte le refus.
      const scoreData = await readRows(
        supabase
          .from('wod_scores')
          .select('*, profile:profiles(id, username, avatar_url, level, elo)')
          .eq('wod_id', w.id),
        { screen: 'WODDetail', action: 'load_scores' },
      );

      const list = sortScoresRxFirst((scoreData ?? []) as WODScore[], w.wod_type === 'for-time');
      setScores(list);
      setMyScore(list.find(sc => sc.member_id === user?.id) ?? null);
      setScoreType(allowedScoreTypes(w.wod_type).default);

      // Load reaction & comment counts for each score
      const scoreIds = list.map(s => s.id);
      if (scoreIds.length > 0) {
        const [{ data: rxnData }, { data: cmtData }] = await Promise.all([
          supabase.from('score_reactions').select('score_id').in('score_id', scoreIds),
          supabase.from('score_comments').select('score_id').in('score_id', scoreIds),
        ]);
        const meta: Record<string, { reactions: number; comments: number }> = {};
        scoreIds.forEach(id => { meta[id] = { reactions: 0, comments: 0 }; });
        (rxnData ?? []).forEach((r: any) => { if (meta[r.score_id]) meta[r.score_id].reactions++; });
        (cmtData ?? []).forEach((c: any) => { if (meta[c.score_id]) meta[c.score_id].comments++; });
        setScoreMeta(meta);
      }

      // ELO: compute lazily after WOD closes (past midnight), then load deltas
      const wodExpired = !!w.scheduled_date && new Date() >= (() => { const d = new Date(w.scheduled_date + 'T00:00:00'); d.setDate(d.getDate() + 1); return d; })();
      const { data: eloHist } = await supabase
        .from('elo_history')
        .select('member_id, elo_delta')
        .eq('wod_id', w.id);

      if (wodExpired && (eloHist ?? []).length === 0 && list.length >= 2 && leaderboardAvailable(w) && currentBox) {
        await computeAndSaveElo(w.id, currentBox.id, list, w.wod_type === 'for-time');
        const { data: freshHist } = await supabase
          .from('elo_history')
          .select('member_id, elo_delta')
          .eq('wod_id', w.id);
        const dMap: Record<string, number> = {};
        (freshHist ?? []).forEach((h: any) => { dMap[h.member_id] = h.elo_delta; });
        setEloDeltas(dMap);
      } else if (wodExpired) {
        const dMap: Record<string, number> = {};
        (eloHist ?? []).forEach((h: any) => { dMap[h.member_id] = h.elo_delta; });
        setEloDeltas(dMap);
      } else {
        setEloDeltas({});
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [wodId, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Auto-scroll to leaderboard when coming from "Classement" button
  useEffect(() => {
    if (scrollToLeaderboard && !loading && scores.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: leaderboardY.current, animated: true });
      }, 300);
    }
  }, [scrollToLeaderboard, loading, scores.length]);

  // Midnight cutoff: disable score submission after the WOD's scheduled date
  // Une séance de programme (sans date) ne ferme jamais : l'athlète la fait le jour où elle tombe pour lui.
  const isExpired = wod?.scheduled_date ? new Date() >= new Date(wod.scheduled_date + 'T00:00:00') && new Date() >= (() => {
    const d = new Date(wod.scheduled_date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d;
  })() : false;

  const strengthEntries: StrengthEntry[] = useMemo(() => (
    (wod?.description ?? '')
      .split('\n')
      .map(parseStrengthLine)
      .filter((e): e is StrengthEntry => e !== null)
  ), [wod?.description]);

  const isStrengthSession = wod?.wod_type === 'strength' && strengthEntries.length > 0;
  const strengthValidated = strengthServer?.session?.status === 'validated';
  const strengthPrescription = useMemo(
    () => buildStrengthGrid(strengthEntries, oneRepMaxFor, gymRecordFor),
    [strengthEntries, oneRepMaxFor, gymRecordFor],
  );
  const strengthKey: StrengthSourceKey | null = useMemo(
    () => (isStrengthSession && wod && user ? { userId: user.id, sourceType: 'whiteboard', sourceId: wod.id } : null),
    [isStrengthSession, wod?.id, user?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // La prescription pré-remplit la saisie ; l'athlète corrige ce qu'il a
  // réellement fait. Un %1RM sans 1RM connu reste vide plutôt qu'inventé.
  // Une séance de musculation garde sa grille : elle vient du serveur.
  const prefillStrengthLoads = useCallback(() => {
    if (isStrengthSession) return;
    setStrengthDrafts(strengthPrescription);
  }, [isStrengthSession, strengthPrescription]);

  const applyServerSession = useCallback((server: ServerStrengthSession) => {
    setStrengthServer(server);
    baseUpdatedAtRef.current = server.session?.updatedAt ?? null;
    setDraftSavedAt(server.session?.updatedAt ?? null);
  }, []);

  /** Envoie le brouillon (les envois se suivent : jamais deux en parallèle). */
  const saveDraftNow = useCallback((): Promise<string> => {
    const run = async (): Promise<string> => {
      if (!strengthKey || !wod) return 'saved';
      const editedAt = editedAtRef.current;
      if (!editedAt) return 'saved';
      setDraftSaveState('saving');
      const res = await saveStrengthDraft({
        ...strengthKey,
        sourceTitle: wod.title,
        drafts: draftsRef.current,
        editedAt,
        baseUpdatedAt: baseUpdatedAtRef.current,
      });
      if (res.status === 'saved') {
        if (editedAtRef.current === editedAt) editedAtRef.current = null;
        baseUpdatedAtRef.current = res.updatedAt;
        setDraftSavedAt(res.updatedAt);
        setStrengthServer(prev => ({
          session: { status: 'draft', plannedSets: draftsRef.current.length, maxLoadKg: null, firstValidatedAt: null, ...prev?.session, updatedAt: res.updatedAt },
          sets: prev?.sets ?? [],
        }));
        setDraftSaveState('idle');
      } else if (res.status === 'server_newer') {
        editedAtRef.current = null;
        applyServerSession(res.server);
        setStrengthDrafts(gridFromServer(strengthPrescription, res.server.sets));
        setDraftSaveState('serverNewer');
      } else {
        // Coupure réseau (nouvel essai automatique) ou refus du serveur (aucune
        // boucle) : la saisie reste à l'écran et sur le téléphone. La version
        // serveur de référence est celle que cet envoi a pu écrire.
        baseUpdatedAtRef.current = res.baseUpdatedAt;
        setDraftSaveState(res.status);
      }
      return res.status;
    };
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next;
    return next;
  }, [strengthKey, wod, strengthPrescription, applyServerSession]);

  // Chargement : séance et séries du serveur ; à défaut, la prescription. Une
  // copie locale restée hors connexion repart si le serveur n'a pas plus récent.
  useEffect(() => {
    if (!strengthKey || strengthLoadedFor.current === strengthKey.sourceId) return;
    strengthLoadedFor.current = strengthKey.sourceId;
    loadStrengthGrid(strengthKey, strengthPrescription).then(res => {
      strengthOriginRef.current = res.origin;
      setStrengthDrafts(res.drafts);
      if (res.server) applyServerSession(res.server);
      if (res.pending) {
        editedAtRef.current = res.pending.editedAt;
        baseUpdatedAtRef.current = res.pending.baseUpdatedAt;
        if (res.offline) setDraftSaveState('offline');
        else if (res.refused) setDraftSaveState('refused');
        else saveDraftNow();
      }
    }).catch(e => captureError(e, { screen: 'WODDetail', action: 'loadStrengthGrid' }));
  }, [strengthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Les 1RM du profil arrivent après : une grille encore issue de la
  // prescription, pas touchée, reprend les charges résolues. Sinon, un record
  // de gymnastique arrivé entre-temps ne remplit que les reps encore vides.
  useEffect(() => {
    if (strengthOriginRef.current === 'prescription' && !editedAtRef.current) setStrengthDrafts(strengthPrescription);
    else if (!strengthValidated) setStrengthDrafts(prev => applyGymRecordsToGrid(prev, strengthPrescription));
  }, [strengthPrescription]); // eslint-disable-line react-hooks/exhaustive-deps

  // Retour sur l'écran (après « Renseigner mon record ») : records relus. Le
  // premier focus est le montage, déjà couvert par la lecture du hook.
  const focusedOnce = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focusedOnce.current) reloadRecords();
    focusedOnce.current = true;
  }, [reloadRecords]));

  // Brouillon enregistré ~0,8 s après la dernière frappe.
  useEffect(() => {
    if (!strengthKey || strengthValidated || !editedAtRef.current) return undefined;
    const id = setTimeout(() => { saveDraftNow(); }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [draftDirtyTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hors connexion : nouvel essai au retour au premier plan et à intervalle.
  useEffect(() => {
    if (draftSaveState !== 'offline') return undefined;
    const id = setInterval(() => { saveDraftNow(); }, OFFLINE_RETRY_MS);
    const sub = AppState.addEventListener('change', st => { if (st === 'active') saveDraftNow(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [draftSaveState, saveDraftNow]);

  // « Enregistré il y a … » avance tout seul.
  useEffect(() => {
    if (!isStrengthSession) return undefined;
    const id = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(id);
  }, [isStrengthSession]);

  // Une saisie pas encore partie part quand on quitte l'écran.
  const saveDraftNowRef = useRef(saveDraftNow);
  saveDraftNowRef.current = saveDraftNow;
  useEffect(() => () => { if (editedAtRef.current) saveDraftNowRef.current(); }, []);

  function onStrengthDraftChange(index: number, patch: Partial<StrengthSetDraft>) {
    setStrengthDrafts(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    if (isStrengthSession && !strengthValidated) {
      editedAtRef.current = new Date().toISOString();
      // Une grille saisie n'est plus la prescription, même une fois le brouillon
      // enregistré (editedAt remis à zéro) : un record relu ne la remplace plus.
      strengthOriginRef.current = 'local';
      setDraftDirtyTick(t => t + 1);
    }
  }

  /** Fermer sans valider : une séance validée revient à ses charges enregistrées. */
  function closeScoreModal() {
    if (strengthValidated && strengthServer) setStrengthDrafts(gridFromServer(strengthPrescription, strengthServer.sets));
    setModalOpen(false);
  }

  /** « Renseigner mon record » : la saisie est gardée, la fenêtre se ferme, Records s'ouvre sur Gymnastique. */
  function openGymRecords() {
    if (editedAtRef.current) saveDraftNow();
    closeScoreModal();
    navigation.navigate('Profile', { prCategory: 'gymnastics' });
  }

  async function saveStrengthLater() {
    if (!strengthKey) return;
    if (!editedAtRef.current) editedAtRef.current = new Date().toISOString();
    setSubmitting(true);
    const status = await saveDraftNow();
    setSubmitting(false);
    setClock(Date.now());
    if (status === 'offline') {
      Alert.alert(i18n.t('strengthSession.offlineSavedTitle'), i18n.t('strengthSession.offline'));
    } else if (status === 'refused') {
      Alert.alert(i18n.t('strengthSession.refusedTitle'), i18n.t('strengthSession.refused'));
    }
    setModalOpen(false);
  }

  function openEditModal() {
    prefillStrengthLoads();
    if (!myScore) { setModalOpen(true); return; }
    // Pre-fill form with existing score
    setScoreType(myScore.score_type);
    setIsRx(myScore.rx);
    setNoteInput(myScore.notes ?? '');
    setDnf(false);
    setCapReps('');
    setScoreInput('');
    setTimeMin('');
    setTimeSec('');
    if (myScore.score_type === 'time') {
      const n = normalizeScore(Math.round(myScore.score_value), myScore.capped, true);
      if (n.capped) {
        setDnf(true);
        setCapReps(String(n.value));
      } else {
        setTimeMin(String(Math.floor(n.value / 60)));
        setTimeSec(String(n.value % 60));
      }
    } else {
      setScoreInput(String(myScore.score_value));
    }
    setModalOpen(true);
  }

  async function handleShare() {
    if (!viewShotRef.current?.capture) return;
    setSharing(true);
    try {
      const uri = await viewShotRef.current.capture();
      const available = await Sharing.isAvailableAsync();
      if (!available) { Alert.alert('Partage non disponible sur cet appareil'); return; }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Partager ma performance' });
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) {
        captureError(e, { screen: 'WODDetail', action: 'shareCard' });
        Alert.alert('Erreur', 'Impossible de partager la card.');
      }
    } finally {
      setSharing(false);
    }
  }

  async function submitScore() {
    if (!wod || !user) return;
    const scoreBoxId = wod.box_id == null ? null : currentBox?.id ?? null;
    if (wod.box_id != null && !scoreBoxId) return;
    let value = 0;
    let capped = false;
    if (scoreType === 'time' && dnf) {
      const reps = parseInt(capReps) || 0;
      if (reps <= 0) { Alert.alert('Score invalide', 'Entre le nombre de répétitions complétées.'); return; }
      ({ score_value: value, capped } = mapForTimeScore({ capped: true, reps }));
    } else if (scoreType === 'time') {
      ({ score_value: value, capped } = mapForTimeScore({
        capped: false, minutes: parseInt(timeMin) || 0, seconds: parseInt(timeSec) || 0,
      }));
    } else {
      value = parseFloat(scoreInput);
    }
    if (isNaN(value) || value <= 0) { Alert.alert('Score invalide'); return; }

    // Cap validation for AMRAP / EMOM / Tabata
    const maxScore = computeMaxScore(wod.wod_type, wod.description, wod.time_cap_seconds, wod.rounds, scoreType);
    if (maxScore && !capped && value > maxScore) {
      Alert.alert('Score trop élevé', `Le maximum estimé pour ce WOD est de ${maxScore} ${scoreType === 'rounds' ? 'rounds' : 'reps'}. Vérifie ta saisie.`);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('wod_scores').upsert({
      wod_id: wod.id,
      member_id: user.id,
      box_id: scoreBoxId,
      score_type: scoreType,
      score_value: value,
      capped,
      rx: isRx,
      scaled: !isRx,
      notes: noteInput.trim() || null,
    }, { onConflict: 'wod_id,member_id' });

    if (error) { setSubmitting(false); Alert.alert('Erreur', error.message); return; }

    await creditScoreSubmission(value, scoreType);

    // Les séries réellement réalisées sont journalisées, et ce sont ELLES qui
    // alimentent les 1RM — jamais les reps prescrites. Le journal d'abord :
    // chaque série rend son id, et c'est cet id qui rattache un record à la
    // séance qui l'a établi.
    if (strengthDrafts.length > 0) {
      logStrengthSets({
        userId: user.id,
        sourceType: 'whiteboard',
        sourceId: wod.id,
        sourceTitle: wod.title,
        drafts: strengthDrafts,
      })
        .then(performed => (performed.length > 0 ? recordStrengthPRs(performed) : []))
        .then(beaten => {
          if (beaten.length === 0) return;
          const lines = beaten.map(b => `${b.movement} : ${b.kg} kg${b.previousKg != null ? ` (avant ${b.previousKg} kg)` : ''}`);
          Alert.alert('Nouveau 1RM 🏋️', lines.join('\n'));
        })
        .catch(e => captureError(e, { action: 'logStrengthSets' }));
    }

    await refreshScoresAfterSubmit(true);
    finishSubmit();
  }

  /**
   * Compteurs, streak et crédit de mouvements d'un score posé. Pour une séance de
   * musculation, n'est appelé qu'à la première validation.
   */
  async function creditScoreSubmission(value: number, submittedType: ScoreType) {
    if (!wod || !user) return;
    trackScoreSubmit(wod.id, submittedType);

    // Dedup: if user already marked this WOD as "réalisé", the activity was already counted.
    // Remove the completion row (score is authoritative) and skip double-counting the streak.
    const { data: existingCompletion } = await supabase
      .from('wod_completions')
      .select('id')
      .eq('wod_id', wod.id)
      .eq('member_id', user.id)
      .maybeSingle();
    const alreadyCounted = !!existingCompletion;
    if (alreadyCounted) {
      await supabase.from('wod_completions').delete().eq('wod_id', wod.id).eq('member_id', user.id);
    }

    incrementCounter(user.id, 'total_scores_submitted', 1, currentBox?.id, { skipStreak: alreadyCounted })
      .catch(e => captureError(e, { action: 'incrementScores' }));
    cancelTodayScoreReminder().catch(e => captureError(e, { action: 'cancelScoreReminder' }));

    // Log movement reps for badges (parse description as movement lines)
    if (wod.description) {
      const lines = wod.description.split('\n').filter(Boolean);
      const wodFormat = wod.wod_type === 'for-time' ? 'For Time' : wod.wod_type === 'amrap' ? 'AMRAP' : wod.wod_type === 'emom' ? 'EMOM' : wod.wod_type ?? 'For Time';
      const completed = computeCompletedMovements(lines, wodFormat, value, submittedType, { gender: user.gender });
      logMovementReps(user.id, completed, 'whiteboard', wod.id).catch(e => captureError(e, { action: 'logMovementReps' }));
    }
  }

  /** Recharge le classement ; prévient les athlètes dépassés si demandé. */
  async function refreshScoresAfterSubmit(notifyOvertaken: boolean) {
    if (!wod || !user) return;
    // Snapshot old rankings before reload
    const oldScores = [...scores];

    // Reload scores then compute ELO
    const { data: updatedScores } = await supabase
      .from('wod_scores')
      .select('*, profile:profiles(id, username, avatar_url, level, elo)')
      .eq('wod_id', wod.id);

    const list = sortScoresRxFirst((updatedScores ?? []) as WODScore[], wod.wod_type === 'for-time');

    // Detect overtaken users: users who were ranked above my new position before
    const myNewIdx = list.findIndex(s => s.member_id === user.id);
    if (notifyOvertaken && myNewIdx >= 0 && oldScores.length > 0) {
      const overtaken = list
        .slice(myNewIdx + 1)
        .filter(s => {
          const oldIdx = oldScores.findIndex(os => os.member_id === s.member_id);
          return oldIdx >= 0 && oldIdx < oldScores.findIndex(os => os.member_id === user.id);
        })
        .map(s => s.member_id)
        .filter(id => id !== user.id);
      if (overtaken.length > 0) {
        sendScoreOvertakenNotification(overtaken, user.username, wod.title).catch(e => captureError(e, { action: 'sendOvertakenNotif' }));
      }
    }
    setScores(list);
    setMyScore(list.find(sc => sc.member_id === user.id) ?? null);

    // ELO is now computed lazily after WOD closes (past midnight)
  }

  function finishSubmit() {
    hapticSuccess();
    setSubmitting(false);
    setModalOpen(false);
    setScoreInput('');
    setTimeMin('');
    setTimeSec('');
    setNoteInput('');
    setDnf(false);
    setCapReps('');
    setShareModal(true);
  }

  /**
   * « Valider la séance » / « Enregistrer mes charges » : une transaction côté
   * serveur (séries, charge max = score, 1RM). Compteurs, badges et
   * notifications ne partent qu'à la première validation.
   */
  async function validateStrength() {
    if (!wod || !user || !strengthKey) return;
    setSubmitting(true);
    let first = false;
    try {
      const result = await submitStrengthValidation({
        userId: user.id,
        sourceType: 'whiteboard',
        sourceId: wod.id,
        sourceTitle: wod.title,
        drafts: strengthDrafts,
        rx: isRx,
        previousSets: strengthServer?.sets ?? [],
      }, async r => {
        first = true;
        await creditScoreSubmission(r.maxLoadKg, 'weight');
      });
      editedAtRef.current = null;
      setDraftSaveState('idle');

      const notes = noteInput.trim() || null;
      if (notes !== (myScore?.notes ?? null)) {
        const { error: nErr } = await supabase.from('wod_scores').update({ notes })
          .eq('wod_id', wod.id).eq('member_id', user.id);
        if (nErr) captureError(nErr, { screen: 'WODDetail', action: 'strengthNotes' });
      }

      fetchStrengthSession(strengthKey)
        .then(server => { applyServerSession(server); setStrengthDrafts(gridFromServer(strengthPrescription, server.sets)); })
        .catch(e => captureError(e, { screen: 'WODDetail', action: 'reloadStrengthSession' }));

      const beaten = result.records.filter(r => r.kg != null && (r.precedent == null || r.kg > r.precedent));
      if (beaten.length > 0) {
        Alert.alert(i18n.t('strengthSession.newRecordTitle'), beaten.map(b => (b.precedent != null
          ? i18n.t('strengthSession.recordLinePrevious', { label: b.label, kg: b.kg, previous: b.precedent })
          : i18n.t('strengthSession.recordLine', { label: b.label, kg: b.kg }))).join('\n'));
      }

      await refreshScoresAfterSubmit(first);
      finishSubmit();
    } catch (e) {
      setSubmitting(false);
      const code = validationErrorCode(e);
      const body = code === 'SEANCE_VIDE' ? i18n.t('strengthSession.errorEmpty')
        : code === 'SCORE_AUTRE_TYPE' ? i18n.t('strengthSession.errorOtherScoreType')
        : code === 'SERIES_EN_DOUBLE' ? i18n.t('strengthSession.errorDuplicate')
        : code && code.startsWith('RECORD_') ? i18n.t('strengthSession.errorRecord')
        : code || !isNetworkError(e) ? i18n.t('strengthSession.refused')
        : i18n.t('strengthSession.errorOffline');
      if (!code) captureError(e, { screen: 'WODDetail', action: 'validateStrength' });
      if (!code && !strengthValidated) {
        if (!editedAtRef.current) editedAtRef.current = new Date().toISOString();
        saveDraftNow();
      }
      Alert.alert(i18n.t('strengthSession.errorTitle'), body);
    }
  }

  async function openScoreDetail(sc: WODScore) {
    setSelectedScore(sc);
    setCommentText('');
    setShowEmojis(false);
    await loadScoreDetail(sc.id);
  }

  async function loadScoreDetail(scoreId: string) {
    const [{ data: cmts }, { data: rxns }] = await Promise.all([
      supabase
        .from('score_comments')
        .select('*, author:profiles!score_comments_author_id_fkey(id, username)')
        .eq('score_id', scoreId)
        .order('created_at', { ascending: true }),
      supabase
        .from('score_reactions')
        .select('*, reactor:profiles!score_reactions_user_id_fkey(username)')
        .eq('score_id', scoreId),
    ]);
    setComments(cmts ?? []);
    setReactions(rxns ?? []);
  }

  async function sendComment() {
    if (!selectedScore || !user || !currentBox || !commentText.trim()) return;
    setSendingComment(true);
    const { error } = await supabase.from('score_comments').insert({
      score_id: selectedScore.id,
      box_id: currentBox.id,
      author_id: user.id,
      content: commentText.trim(),
    });
    if (!error) {
      setCommentText('');
      await loadScoreDetail(selectedScore.id);
      // Update leaderboard count
      setScoreMeta(prev => ({
        ...prev,
        [selectedScore.id]: {
          ...prev[selectedScore.id],
          comments: (prev[selectedScore.id]?.comments ?? 0) + 1,
        },
      }));
      // Notify score owner (don't notify yourself)
      if (selectedScore.member_id !== user.id) {
        sendScoreNotification(
          selectedScore.member_id,
          user.username ?? 'Quelqu\'un',
          'comment',
        ).catch(e => captureError(e, { action: 'sendCommentNotif' }));
      }
    }
    setSendingComment(false);
  }

  async function toggleReaction(emoji: string) {
    if (!selectedScore || !user) return;
    const existing = reactions.find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('score_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('score_reactions').insert({
        score_id: selectedScore.id,
        user_id: user.id,
        emoji,
      });
      // Notify score owner (don't notify yourself)
      if (selectedScore.member_id !== user.id) {
        sendScoreNotification(
          selectedScore.member_id,
          user.username ?? 'Quelqu\'un',
          'reaction',
          emoji,
        ).catch(e => captureError(e, { action: 'sendReactionNotif' }));
      }
    }
    await loadScoreDetail(selectedScore.id);
    // Recalculate leaderboard reaction count from fresh data
    const { data: freshRxns } = await supabase
      .from('score_reactions').select('score_id').eq('score_id', selectedScore.id);
    setScoreMeta(prev => ({
      ...prev,
      [selectedScore.id]: {
        ...prev[selectedScore.id],
        reactions: freshRxns?.length ?? 0,
      },
    }));
  }

  if (loading) {
    return (
      <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!wod) {
    return (
      <View style={S.container}>
      <GlassBackground />
        <AxScreenHeader title="WOD introuvable" />
      </View>
    );
  }

  const myRank = myScore ? scores.findIndex(s => s.id === myScore.id) + 1 : null;

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader
        title={wod.scheduled_date ? i18n.t('screenTitles.wodOfDay') : i18n.t('screenTitles.wod')}
        right={<AxIconButton icon={Share2} onPress={() => Share.share({ message: `${wod.title} — Rejoins le WOD sur AthleX ! athlex://wod/${wodId}` })} accessibilityLabel={i18n.t('common.share')} testID="header-share" />}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: tabSpace }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* WOD info card */}
        <AxCard variant="featured" style={S.wodCard} testID="wod-card">
          <AxContentTitle title={wod.title} testID="wod-detail-title" />
          <View style={S.wodMeta}>
            <AxTag label={wodTypeLabel(wod.wod_type ?? 'custom')} tone="accent" testID="wod-type-tag" />
            {wod.time_cap_seconds && (
              <View style={S.timeCap}>
                <Clock color={c.textMuted} size={12} />
                <Text style={S.timeCapText}>Cap {formatCap(wod.time_cap_seconds)}</Text>
              </View>
            )}
          </View>

          <Text style={S.wodDate}>
            {wod.scheduled_date
              ? new Date(wod.scheduled_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              : `Programme · semaine ${wod.program_week ?? '?'} · ${DAY_LABELS_LONG[(wod.program_day ?? 1) - 1] ?? ''}`}
          </Text>

          {wod.description && (
            <Text style={S.wodDesc}>{annotateCardioLines(annotateGymRepsInText(annotateStrengthLoads(wod.description, oneRepMaxFor), gymRecordFor))}</Text>
          )}
          {wod.notes && (
            <AxCard style={S.notesBox} testID="wod-coach-notes">
              <Text style={S.notesLabel}>Notes coach</Text>
              <Text style={S.notesText}>{wod.notes}</Text>
            </AxCard>
          )}

          {/* Video */}
          {wod.video_url && (() => {
            const m = wod.video_url!.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
            const vid = m?.[1];
            if (!vid) return null;
            return (
              <View style={S.videoBox}>
                <View style={S.videoLabel}>
                  <Play color={c.danger} size={13} />
                  <Text style={S.videoLabelText}>Vidéo</Text>
                </View>
                <View style={S.videoWrapper}>
                  <WebView
                    source={{ uri: `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1` }}
                    style={{ height: 200, borderRadius: 12 }}
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    scrollEnabled={false}
                  />
                </View>
              </View>
            );
          })()}

        </AxCard>

        <View style={S.below}>
          {/* My score */}
          {myScore ? (
            <AxCard style={S.myScoreWrapper} testID="my-score">
              <View style={S.myScoreRow}>
                <Text style={S.myScoreLabel}>Mon score</Text>
                <Text style={S.myScoreValue} testID="my-score-value">{formatScore(myScore)}</Text>
                <AxTag label={myScore.rx ? 'RX' : 'Scaled'} tone={myScore.rx ? 'accent' : 'muted'} />
                {leaderboardAvailable(wod) && myRank && (
                  <View style={S.myRankBadge}>
                    <Trophy color={myRank <= 3 ? c.warning : c.textMuted} size={14} />
                    <Text style={S.myRankText}>#{myRank}</Text>
                  </View>
                )}
              </View>
              <View style={S.myScoreActions}>
                <View style={S.myScoreAction}>
                  <AxButton variant="outline" icon={Share2} label="Partager" onPress={() => setShareModal(true)} fullWidth testID="my-score-share" />
                </View>
                {!isExpired && !isStrengthSession && (
                  <View style={S.myScoreAction}>
                    <AxButton variant="outline" icon={RotateCcw} label="Modifier" onPress={openEditModal} fullWidth testID="my-score-edit" />
                  </View>
                )}
              </View>
              {myScore.notes ? (
                <View style={S.myScoreNotesBox}>
                  <Text style={S.myScoreNotesLabel}>MA NOTE</Text>
                  <Text style={S.myScoreNotesText}>{myScore.notes}</Text>
                </View>
              ) : null}
            </AxCard>
          ) : null}
          {isStrengthSession && strengthValidated && (
            <View style={{ marginTop: 12 }}>
              <StrengthMyLoadsCard
                drafts={strengthDrafts}
                maxLoadKg={strengthServer?.session?.maxLoadKg ?? computedMaxLoad(strengthDrafts)}
              />
              {!isExpired && (
                <View style={{ marginTop: 12 }}>
                  <AxButton
                    variant="outline"
                    label={i18n.t('strengthSession.editLoads')}
                    onPress={openEditModal}
                    fullWidth
                    testID="strength-edit-loads"
                  />
                </View>
              )}
            </View>
          )}
          {myScore ? null : isExpired ? (
            <View style={S.expiredBanner}>
              <Clock color={c.textMuted} size={14} />
              <Text style={S.expiredText}>Soumission de score terminée (minuit passé)</Text>
            </View>
          ) : (
            <>
              {isStrengthSession && (strengthServer?.session?.status === 'draft' || draftSaveState === 'offline' || draftSaveState === 'refused') && (
                <View style={{ marginBottom: 12 }}>
                  <StrengthSessionStatus
                    {...strengthProgress(strengthDrafts)}
                    savedAt={draftSavedAt}
                    saveState={draftSaveState}
                    now={clock}
                  />
                </View>
              )}
              <AxButton
                icon={Plus}
                label="Entrer mon score"
                onPress={() => { prefillStrengthLoads(); setModalOpen(true); }}
                fullWidth
                testID="enter-score"
              />
            </>
          )}
        </View>

        {/* Leaderboard */}
        {scores.length > 0 && leaderboardAvailable(wod) && (
          <View
            style={S.section}
            onLayout={e => { leaderboardY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={S.sectionTitle}>Classement · {scores.length} score{scores.length > 1 ? 's' : ''}</Text>
            <View style={S.leaderboard}>
              {(() => {
                const rankMap: Record<string, number> = {};
                scores.forEach((sc, i) => { rankMap[sc.id] = i + 1; });
                return scores.map((sc) => {
                const globalRank = rankMap[sc.id] ?? 1;
                const isMe = sc.member_id === user?.id;
                const elo = (sc.profile as any)?.elo ?? 1000;
                return (
                  <AxCard
                    key={sc.id}
                    style={[S.leaderRow, isMe && S.leaderRowMe]}
                    onPress={() => openScoreDetail(sc)}
                    testID={`leader-row-${sc.id}`}
                  >
                    <View style={S.leaderRank}>
                      {globalRank <= 3
                        ? <Medal color={medalInk[globalRank - 1]} size={18} testID={`rank-medal-${globalRank}`} />
                        : <Text style={S.leaderRankText}>{globalRank}</Text>}
                    </View>
                    <UserAvatar
                      uri={(sc.profile as any)?.avatar_url}
                      name={(sc.profile as any)?.username ?? '?'}
                      size={32}
                      borderRadius={12}
                      backgroundColor={c.background}
                      textColor={c.text}
                      fontSize={13}
                    />
                    <View style={S.leaderMid}>
                      <Text style={S.leaderName} numberOfLines={1}>
                        {(sc.profile as any)?.username ?? 'Athlète'}{isMe ? ' (moi)' : ''}
                      </Text>
                      <View style={S.leaderSubRow}>
                        <Text style={S.leaderElo}>{elo} ELO</Text>
                        {isExpired && eloDeltas[sc.member_id] != null && (
                          <Text style={[S.leaderDelta, { color: eloDeltas[sc.member_id] > 0 ? c.success : eloDeltas[sc.member_id] < 0 ? c.danger : c.textMuted }]}>
                            {eloDeltas[sc.member_id] > 0 ? '+' : ''}{eloDeltas[sc.member_id]}
                          </Text>
                        )}
                        {(scoreMeta[sc.id]?.reactions ?? 0) > 0 && (
                          <View style={S.leaderMetaChip}>
                            <Heart color={c.danger} size={10} fill={c.danger} />
                            <Text style={S.leaderMetaCount}>{scoreMeta[sc.id].reactions}</Text>
                          </View>
                        )}
                        {(scoreMeta[sc.id]?.comments ?? 0) > 0 && (
                          <View style={S.leaderMetaChip}>
                            <MessageSquare color={c.info} size={10} />
                            <Text style={S.leaderMetaCount}>{scoreMeta[sc.id].comments}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={S.leaderRight}>
                      <Text style={S.leaderScore}>{formatScore(sc)}</Text>
                      <AxTag label={sc.rx ? 'RX' : 'Scaled'} tone={sc.rx ? 'accent' : 'muted'} />
                    </View>
                  </AxCard>
                );
              });
              })()}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Score Modal */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeScoreModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={S.modalContainer}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Entrer mon score</Text>
              <TouchableOpacity onPress={closeScoreModal} accessibilityRole="button" hitSlop={8} testID="score-cancel">
                <Text style={S.modalCloseText}>Annuler</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={S.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={S.modalWodName}>{wod.title}</Text>

              {/* Score type */}
              {(() => {
                const allowed = allowedScoreTypes(wod.wod_type);
                if (allowed.types.length === 1) {
                  return (
                    <>
                      <Text style={S.modalLabel}>{i18n.t('wod.scoreType.label').toUpperCase()}</Text>
                      <View style={S.typeRow}>
                        <AxChip label={i18n.t(`wod.scoreType.${allowed.types[0]}`).toUpperCase()} selected onPress={() => {}} testID={`score-type-${allowed.types[0]}`} />
                      </View>
                    </>
                  );
                }
                return (
                  <>
                    <Text style={S.modalLabel}>{i18n.t('wod.scoreType.label').toUpperCase()}</Text>
                    <View style={S.typeRow}>
                      {allowed.types.map(t => (
                        <AxChip
                          key={t}
                          label={i18n.t(`wod.scoreType.${t}`).toUpperCase()}
                          selected={scoreType === t}
                          onPress={() => setScoreType(t)}
                          testID={`score-type-${t}`}
                        />
                      ))}
                    </View>
                  </>
                );
              })()}

              {scoreType === 'time' && (
                <TouchableOpacity
                  style={S.dnfRow}
                  onPress={() => { setDnf(!dnf); setScoreInput(''); setCapReps(''); }}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: dnf }}
                  testID="score-dnf"
                >
                  <View style={[S.dnfCheck, dnf && S.dnfCheckActive]}>
                    {dnf && <Check color={c.onAccent} size={14} strokeWidth={3} />}
                  </View>
                  <Text style={S.dnfLabel}>WOD pas fini (CAP)</Text>
                </TouchableOpacity>
              )}

              {isStrengthSession ? (
                <StrengthMaxLoadRow maxLoadKg={computedMaxLoad(strengthDrafts)} />
              ) : scoreType === 'time' && dnf ? (
                <>
                  <Text style={S.modalLabel}>NOMBRE DE RÉPÉTITIONS COMPLÉTÉES</Text>
                  <AxTextField
                    placeholder="Ex: 87"
                    value={capReps}
                    onChangeText={setCapReps}
                    keyboardType="number-pad"
                    autoFocus
                    testID="score-cap-reps"
                  />
                </>
              ) : (
                <>
                  <Text style={S.modalLabel}>
                    {scoreType === 'time' ? 'TEMPS (MM:SS)' : scoreType === 'weight' ? 'POIDS (kg)' : scoreType === 'reps' ? 'REPS' : 'ROUNDS'}
                  </Text>
                  {scoreType === 'time' ? (
                    <View style={S.timeRow}>
                      <View style={S.timeInput}>
                      <AxTextField
                        compact
                        placeholder="MM"
                        value={timeMin}
                        onChangeText={(t) => {
                          const d = t.replace(/\D/g, '').slice(0, 2);
                          setTimeMin(d);
                          if (d.length === 2) secRef.current?.focus();
                        }}
                        keyboardType="number-pad"
                        maxLength={2}
                        autoFocus
                        testID="score-time-min"
                      />
                      </View>
                      <Text style={S.timeColon}>:</Text>
                      <View style={S.timeInput}>
                      <AxTextField
                        compact
                        inputRef={secRef}
                        placeholder="SS"
                        value={timeSec}
                        onChangeText={(t) => setTimeSec(t.replace(/\D/g, '').slice(0, 2))}
                        keyboardType="number-pad"
                        maxLength={2}
                        testID="score-time-sec"
                      />
                      </View>
                    </View>
                  ) : (
                    <AxTextField
                      placeholder="150"
                      value={scoreInput}
                      onChangeText={setScoreInput}
                      keyboardType="number-pad"
                      autoFocus
                      testID="score-value"
                    />
                  )}
                </>
              )}

              {isStrengthSession && !strengthValidated && (
                <StrengthSessionStatus
                  {...strengthProgress(strengthDrafts)}
                  savedAt={draftSavedAt}
                  saveState={draftSaveState}
                  now={clock}
                />
              )}

              <StrengthSetGrid
                drafts={strengthDrafts}
                onChange={onStrengthDraftChange}
                gymRecordFor={gymRecordFor}
                onSetGymRecord={openGymRecords}
              />

              <Text style={S.modalLabel}>NIVEAU</Text>
              <View style={S.rxRow}>
                <AxChip label="RX" selected={isRx} onPress={() => setIsRx(true)} testID="score-level-rx" />
                <AxChip label="Scaled" selected={!isRx} onPress={() => setIsRx(false)} testID="score-level-scaled" />
              </View>

              <Text style={S.modalLabel}>NOTES (optionnel)</Text>
              <AxTextField
                placeholder="Commentaire, mouvements adaptés…"
                value={noteInput}
                onChangeText={setNoteInput}
                multiline
                minInputHeight={70}
                testID="score-notes"
              />

              {isStrengthSession ? (
                <View style={{ gap: 12, marginTop: 8 }}>
                  <AxButton
                    variant="accent"
                    label={i18n.t(strengthValidated ? 'strengthSession.saveChanges' : 'strengthSession.validate')}
                    onPress={validateStrength}
                    loading={submitting}
                    disabled={computedMaxLoad(strengthDrafts) == null}
                    fullWidth
                    testID="strength-validate"
                  />
                  {!strengthValidated && (
                    <AxButton
                      variant="outline"
                      label={i18n.t('strengthSession.saveLater')}
                      onPress={saveStrengthLater}
                      disabled={submitting}
                      fullWidth
                      testID="strength-save-later"
                    />
                  )}
                </View>
              ) : (
                <View style={{ marginTop: 8 }}>
                  <AxButton
                    label="Valider le score"
                    variant="accent"
                    loading={submitting}
                    disabled={!(dnf ? capReps.trim() : scoreType === 'time' ? (timeMin.trim() || timeSec.trim()) : scoreInput.trim())}
                    onPress={submitScore}
                    fullWidth
                    testID="score-submit"
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Share Modal */}
      <Modal visible={shareModal} animationType="fade" transparent onRequestClose={() => setShareModal(false)}>
        <View style={S.shareOverlay}>
          <View style={S.shareContainer}>
            <View style={S.shareHeader}>
              <Text style={S.shareTitle}>Partager ma perf 📸</Text>
              <TouchableOpacity onPress={() => setShareModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={theme.textMuted} size={22} />
              </TouchableOpacity>
            </View>

            {myScore && wod && (
              <>
                <View style={S.sharePreview}>
                  <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
                    <ShareScoreCard
                      wodTitle={wod.title}
                      wodType={wod.wod_type ?? null}
                      score={myScore.score_value}
                      scoreType={myScore.score_type}
                      capped={myScore.capped}
                      rx={myScore.rx}
                      rank={myRank}
                      totalParticipants={scores.length}
                      username={user?.username ?? 'Athlète'}
                      avatarUrl={user?.avatar_url}
                      boxName={currentBox?.name ?? 'Ma Box'}
                      date={wod.scheduled_date ?? new Date().toISOString().slice(0, 10)}
                    />
                  </ViewShot>
                </View>

                <EmeraldCTAButton
                  loading={sharing}
                  icon={<Share2 color={theme.ctaText} size={18} />}
                  onPress={handleShare}
                  style={{ marginHorizontal: 20 }}
                >
                  Partager ma performance
                </EmeraldCTAButton>
              </>
            )}

            <TouchableOpacity onPress={() => setShareModal(false)} style={S.shareSkip} activeOpacity={0.7}>
              <Text style={S.shareSkipText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Score Detail Modal */}
      <Modal visible={!!selectedScore} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedScore(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={S.sdContainer}>
            {/* Header */}
            <View style={S.sdHeader}>
              <View style={{ flex: 1 }}>
                <Text style={S.sdTitle}>
                  {(selectedScore?.profile as any)?.username ?? 'Athlète'}
                </Text>
                <Text style={S.sdSub}>
                  {selectedScore ? formatScore(selectedScore) : ''} · {selectedScore?.rx ? 'RX' : 'Scaled'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {selectedScore && selectedScore.member_id !== user?.id && (
                  <ReportMenu
                    contentType="score"
                    contentId={selectedScore.id}
                    reportedUserId={selectedScore.member_id}
                    size={20}
                    color={theme.textMuted}
                    onActionDone={() => { setSelectedScore(null); load(); }}
                  />
                )}
                <TouchableOpacity onPress={() => setSelectedScore(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X color={theme.textMuted} size={22} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Score card */}
            {selectedScore && (
              <View style={S.sdScoreCard}>
                <View style={S.sdScoreRow}>
                  <UserAvatar
                    uri={(selectedScore.profile as any)?.avatar_url}
                    name={(selectedScore.profile as any)?.username ?? '?'}
                    size={40}
                    borderRadius={14}
                    backgroundColor={theme.surface}
                    textColor={theme.text}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={S.sdAthleteName}>{(selectedScore.profile as any)?.username}</Text>
                    <Text style={S.sdLevel}>{(selectedScore.profile as any)?.level?.toUpperCase()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={S.sdScoreValue}>{formatScore(selectedScore)}</Text>
                    <View style={[S.sdRxTag, { backgroundColor: selectedScore.rx ? `${theme.success}15` : `${theme.warning}15` }]}>
                      <Text style={[S.sdRxText, { color: selectedScore.rx ? theme.success : theme.warning }]}>
                        {selectedScore.rx ? 'RX' : 'Scaled'}
                      </Text>
                    </View>
                  </View>
                </View>
                {selectedScore.notes ? (
                  <View style={S.sdNotesBox}>
                    <Text style={S.sdNotesText}>{selectedScore.notes}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Reactions summary */}
            {reactions.length > 0 && (
              <View style={S.sdReactionsRow}>
                {(() => {
                  const grouped: Record<string, { count: number; mine: boolean }> = {};
                  reactions.forEach(r => {
                    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
                    grouped[r.emoji].count++;
                    if (r.user_id === user?.id) grouped[r.emoji].mine = true;
                  });
                  return Object.entries(grouped).map(([emoji, { count, mine }]) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[S.sdReactionChip, mine && S.sdReactionChipMine]}
                      onPress={() => toggleReaction(emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={S.sdReactionEmoji}>{emoji}</Text>
                      <Text style={[S.sdReactionCount, mine && S.sdReactionCountMine]}>{count}</Text>
                    </TouchableOpacity>
                  ));
                })()}
              </View>
            )}

            {/* Emoji picker */}
            <View style={S.sdEmojiRow}>
              <TouchableOpacity onPress={() => setShowEmojis(!showEmojis)} style={S.sdEmojiToggle}>
                <Smile color={showEmojis ? theme.accent : theme.textMuted} size={20} />
              </TouchableOpacity>
              {showEmojis && (
                <View style={S.sdEmojiGrid}>
                  {EMOJI_LIST.map(e => (
                    <TouchableOpacity key={e} onPress={() => toggleReaction(e)} style={S.sdEmojiBtn}>
                      <Text style={S.sdEmojiBtnText}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {!showEmojis && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 6 }}>
                  {EMOJI_LIST.slice(0, 6).map(e => (
                    <TouchableOpacity key={e} onPress={() => toggleReaction(e)} style={S.sdQuickEmoji}>
                      <Text style={{ fontSize: 18 }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Comments */}
            <View style={{ flex: 1 }}>
              <Text style={S.sdCommentsTitle}>
                <MessageSquare color={theme.textMuted} size={14} /> Commentaires ({comments.length})
              </Text>
              <FlatList
                data={comments}
                keyExtractor={c => c.id}
                contentContainerStyle={S.sdCommentsList}
                renderItem={({ item }) => {
                  const author = Array.isArray(item.author) ? item.author[0] : item.author;
                  const isMyComment = author?.id === user?.id;
                  const ago = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000);
                  const timeLabel = ago < 60 ? `${ago}min` : ago < 1440 ? `${Math.floor(ago / 60)}h` : `${Math.floor(ago / 1440)}j`;
                  return (
                    <AxCard style={[S.sdComment, isMyComment && S.sdCommentMine]} testID={`comment-${item.id}`}>
                      <View style={S.sdCommentHeader}>
                        <UserAvatar
                          uri={author?.avatar_url}
                          name={author?.username ?? '?'}
                          size={24}
                          borderRadius={8}
                          backgroundColor={theme.surface}
                          textColor={theme.text}
                          fontSize={10}
                        />
                        <Text style={S.sdCommentAuthor}>{author?.username ?? 'Inconnu'}</Text>
                        <Text style={S.sdCommentTime}>{timeLabel}</Text>
                        {!isMyComment && author?.id && (
                          <ReportMenu
                            contentType="comment"
                            contentId={item.id}
                            reportedUserId={author.id}
                            size={14}
                            color={theme.textMuted}
                          />
                        )}
                      </View>
                      <Text style={S.sdCommentContent}>{item.content}</Text>
                    </AxCard>
                  );
                }}
                ListEmptyComponent={
                  <View style={S.sdEmptyComments}>
                    <MessageSquare color={theme.textMuted} size={24} />
                    <Text style={S.sdEmptyText}>Aucun commentaire</Text>
                    <Text style={S.sdEmptySubText}>Sois le premier à commenter !</Text>
                  </View>
                }
              />
            </View>

            {/* Comment input */}
            <View style={S.sdInputRow}>
              <View style={S.sdInput}>
                <AxTextField
                  placeholder="Écrire un commentaire..."
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                  maxInputHeight={100}
                  testID="comment-input"
                />
              </View>
              <TouchableOpacity
                onPress={sendComment}
                disabled={!commentText.trim() || sendingComment}
                style={[S.sdSendBtn, (!commentText.trim() || sendingComment) && { opacity: 0.4 }]}
                accessibilityRole="button"
                accessibilityLabel="Envoyer"
                testID="comment-send"
              >
                {sendingComment
                  ? <ActivityIndicator color={c.onAccent} size="small" />
                  : <Send color={c.onAccent} size={16} />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const isDark = theme.mode === 'dark';
  const cardShadow = isDark ? {} : {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  };
  const c = theme.ax;
  return StyleSheet.create({
  below: { paddingHorizontal: 16, gap: axSpacing.md },
  myScoreAction: { flex: 1 },
  leaderRankText: { ...axTypography.label, color: c.textMuted, textAlign: 'center' },
  leaderDelta: { ...axTypography.labelSmall },
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: theme.card,
    borderBottomWidth: isDark ? 1 : 0, borderBottomColor: theme.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }),
  },
  backBtn: { padding: 2 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text, flex: 1, textAlign: 'center' },
  wodCard: { margin: 16, gap: 10 },
  wodMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  blockBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: `${theme.accent}12`, borderWidth: 1, borderColor: `${theme.accent}25`,
  },
  blockBadgeText: { fontSize: 10, fontWeight: '700', color: theme.accent },
  timeCap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeCapText: { ...axTypography.caption, color: c.textMuted },
  wodDate: { ...axTypography.caption, color: c.textMuted, textTransform: 'capitalize' },
  wodDesc: { ...axTypography.body, color: c.text },
  notesBox: { gap: axSpacing.xs, padding: axSpacing.md },
  notesLabel: { ...axTypography.overline, color: c.accentText },
  notesText: { ...axTypography.bodySmall, color: c.textMuted },
  myScoreNotesBox: { gap: axSpacing.xs, paddingTop: axSpacing.sm, borderTopWidth: 1, borderTopColor: c.border },
  myScoreNotesLabel: { ...axTypography.overline, color: c.textMuted },
  myScoreNotesText: { ...axTypography.bodySmall, color: c.text },
  videoBox: { gap: 6, marginTop: 4 },
  videoLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  videoLabelText: { ...axTypography.overline, color: c.textMuted },
  videoWrapper: { borderRadius: 12, overflow: 'hidden', height: 200, backgroundColor: '#000' },
  myScoreWrapper: { gap: axSpacing.md },
  myScoreRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  myScoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  myScoreActions: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  myScoreLabel: { ...axTypography.overline, color: c.textMuted },
  myScoreValue: { ...axTypography.numberM, color: c.text },
  myRankBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  myRankText: { ...axTypography.label, color: c.text },
  expiredBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: c.border },
  expiredText: { ...axTypography.bodySmall, color: c.textMuted, flex: 1 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { ...axTypography.overline, color: c.textMuted, marginBottom: 12 },
  leaderboard: { gap: axSpacing.sm },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  leaderRowMe: { borderColor: c.accentText },
  leaderRank: { width: 24, alignItems: 'center' },
  leaderAvatar: { width: 32, height: 32, borderRadius: 12, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center' },
  leaderAvatarText: { fontSize: 13, fontWeight: '700', color: theme.text },
  leaderMid: { flex: 1, minWidth: 0 },
  leaderName: { ...axTypography.label, color: c.text },
  leaderElo: { ...axTypography.caption, color: c.textMuted },
  leaderSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  leaderMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  leaderMetaCount: { ...axTypography.caption, color: c.textMuted },
  leaderRight: { alignItems: 'flex-end', gap: 4 },
  leaderScore: { ...axTypography.label, color: c.text, fontVariant: ['tabular-nums'] },
  modalContainer: { flex: 1, backgroundColor: c.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.card,
  },
  modalTitle: { ...axTypography.titleM, color: c.text },
  modalCloseText: { ...axTypography.label, color: c.accentText },
  modalBody: { padding: 20, gap: 12 },
  modalWodName: { ...axTypography.label, color: c.text, marginBottom: 4 },
  modalLabel: { ...axTypography.overline, color: c.textMuted },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { flex: 1 },
  timeColon: { ...axTypography.numberM, color: c.text },
  dnfRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 4 },
  dnfCheck: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: c.fieldBorder, justifyContent: 'center', alignItems: 'center' },
  dnfCheckActive: { backgroundColor: c.accent, borderColor: c.accent },
  dnfLabel: { ...axTypography.label, color: c.text },
  rxRow: { flexDirection: 'row', gap: 10 },
  submitBtn: {
    backgroundColor: theme.accent, borderRadius: 14,
    padding: 18, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Score Detail Modal ──
  sdContainer: { flex: 1, backgroundColor: theme.modalCard },
  sdHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.card,
  },
  sdTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  sdSub: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  sdScoreCard: {
    margin: 16, backgroundColor: isDark ? theme.card : theme.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.border, gap: 12,
    ...cardShadow,
  },
  sdScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sdAvatar: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: theme.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  sdAvatarText: { fontSize: 16, fontWeight: '900', color: theme.text },
  sdAthleteName: { fontSize: 15, fontWeight: '700', color: theme.text },
  sdLevel: { fontSize: 10, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5 },
  sdScoreValue: { fontSize: 22, fontWeight: '900', color: theme.accent },
  sdRxTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  sdRxText: { fontSize: 10, fontWeight: '700' },
  sdNotesBox: {
    backgroundColor: theme.surface, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  sdNotesText: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },

  // Reactions
  sdReactionsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  sdReactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: theme.border,
  },
  sdReactionChipMine: { borderColor: theme.accent, backgroundColor: `${theme.accent}12` },
  sdReactionEmoji: { fontSize: 16 },
  sdReactionCount: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
  sdReactionCountMine: { color: theme.accent },

  // Emoji picker
  sdEmojiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  sdEmojiToggle: { padding: 4 },
  sdEmojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1,
  },
  sdEmojiBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: theme.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  sdEmojiBtnText: { fontSize: 18 },
  sdQuickEmoji: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: theme.surface,
    justifyContent: 'center', alignItems: 'center',
  },

  // Comments
  sdCommentsTitle: {
    fontSize: 13, fontWeight: '700', color: theme.textMuted,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  sdCommentsList: { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
  sdComment: { padding: 12, gap: 0 },
  sdCommentMine: { borderColor: c.accentText },
  sdCommentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sdCommentAvatar: {
    width: 24, height: 24, borderRadius: 8, backgroundColor: theme.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  sdCommentAvatarText: { fontSize: 10, fontWeight: '700', color: theme.text },
  sdCommentAuthor: { fontSize: 12, fontWeight: '700', color: theme.text, flex: 1 },
  sdCommentTime: { fontSize: 10, color: theme.textMuted },
  sdCommentContent: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginLeft: 32 },
  sdEmptyComments: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  sdEmptyText: { fontSize: 14, fontWeight: '700', color: theme.textMuted },
  sdEmptySubText: { fontSize: 12, color: theme.textMuted },

  // Comment input
  sdInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.card,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  sdInput: { flex: 1 },
  sdSendBtn: { width: 46, height: 46, borderRadius: 5, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center' },

  // ── Share Modal ──
  shareOverlay: {
    flex: 1, backgroundColor: theme.modalBackdrop,
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  shareContainer: {
    width: '100%', maxWidth: 400, backgroundColor: theme.modalCard,
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  shareHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  shareTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  sharePreview: {
    alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
    width: 1080, height: 1920,
    transform: [{ scale: 0.28 }],
    marginVertical: -(1920 * (1 - 0.28)) / 2,
    marginHorizontal: -(1080 * (1 - 0.28)) / 2,
  },
  shareCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: theme.accent, marginHorizontal: 20,
    borderRadius: 14, padding: 16,
  },
  shareCTAText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  shareSkip: { alignItems: 'center', paddingVertical: 16 },
  shareSkipText: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
}); }
