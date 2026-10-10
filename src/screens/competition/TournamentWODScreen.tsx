import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal, Linking,
} from 'react-native';
import {
  Youtube, Clock, Zap, CheckCircle,
  AlertTriangle, Play, FileText, Info, Check,
} from 'lucide-react-native';
import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxContentTitle } from '../../components/ax/AxContentTitle';
import { AxButton, AxCard, AxTag } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { CompetitionStackParamList } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTranslation } from 'react-i18next';
import {
  isRepsScoredType, isTimeScoredType, repsPerRoundFromMovements, formatScoreDisplay,
} from '../../utils/tournamentUtils';
import ScoreEntryFields, { ScoreKind } from '../../components/score/ScoreEntryFields';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav   = NativeStackNavigationProp<CompetitionStackParamList, 'TournamentWOD'>;
type Route = RouteProp<CompetitionStackParamList, 'TournamentWOD'>;

const YOUTUBE_REGEX = /(youtube\.com\/(watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)/;

function formatCountdown(ms: number, theme: AppTheme, expiredLabel: string): { text: string; color: string } {
  if (ms <= 0) return { text: expiredLabel, color: theme.ax.danger };
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const text = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const color = ms < 3600000 ? theme.ax.danger : ms < 7200000 ? theme.ax.warning : theme.ax.success;
  return { text, color };
}

export default function TournamentWODScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { tournamentId, tournamentName, wod, existingScore, requireVideoProof = false } = route.params;
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const roundsLabel = (n: number) => t('score.amrapRounds', { count: n });
  const S = createStyles(theme);
  const c = theme.ax;
  const scrollPadBottom = tabSpace;

  const [phase,         setPhase]         = useState<'detail' | 'submit' | 'success'>('detail');
  const [youtubeUrl,    setYoutubeUrl]    = useState(existingScore?.video_url ?? '');
  const [tiebreakValue, setTiebreakValue] = useState('');
  const [notes,         setNotes]         = useState('');
  const [urlValid,      setUrlValid]      = useState(YOUTUBE_REGEX.test(existingScore?.video_url ?? ''));
  const [submitting,    setSubmitting]    = useState(false);
  const [showYtHelp,    setShowYtHelp]    = useState(false);

  // ── Unified, coherent score entry ──
  // For Time  -> masked "mm:ss", stored as canonical total SECONDS.
  // AMRAP/Max Reps -> "rounds + reps" ⇄ "total reps", stored as canonical TOTAL REPS.
  // Both converge to a single stored number so ranking stays coherent.
  const isRepsScore  = isRepsScoredType(wod.type);
  const repsPerRound = wod.reps_per_round ?? repsPerRoundFromMovements(wod.movements);
  const scoreKind: ScoreKind = isRepsScore ? 'reps' : isTimeScoredType(wod.type) ? 'for-time' : 'free';
  const [canonicalScore, setCanonicalScore] = useState(existingScore?.score_value ?? '');
  const [scoreValid,     setScoreValid]     = useState(!!existingScore?.score_value);
  // For Time uniquement : temps limite atteint → on stocke les REPS, pas le temps.
  const [capped,  setCapped]  = useState(!!existingScore?.capped);
  const [capReps, setCapReps] = useState(existingScore?.capped ? String(existingScore.score_value) : '');

  const deadlineHours = (wod.deadline_hours && wod.deadline_hours > 0) ? wod.deadline_hours : 24;
  const deadlineMsRef = useRef<number>(Date.now() + deadlineHours * 3600 * 1000);
  const [remainingMs, setRemainingMs] = useState(deadlineHours * 3600 * 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    deadlineMsRef.current = Date.now() + deadlineHours * 3600 * 1000;
    intervalRef.current = setInterval(() => {
      const rem = deadlineMsRef.current - Date.now();
      setRemainingMs(rem);
      if (rem <= 0 && intervalRef.current) clearInterval(intervalRef.current);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function startCountdown() {
    // Un seul intervalle actif : arrêter celui du montage (ou d'une relance) avant d'en lancer un.
    if (intervalRef.current) clearInterval(intervalRef.current);
    deadlineMsRef.current = Date.now() + wod.deadline_hours * 3600 * 1000;
    intervalRef.current = setInterval(() => {
      const rem = deadlineMsRef.current - Date.now();
      setRemainingMs(rem);
      if (rem <= 0 && intervalRef.current) clearInterval(intervalRef.current);
    }, 1000);
  }

  async function handleSubmit() {
    // Canonical value: total reps (AMRAP/Max Reps), total seconds (For Time),
    // or raw text (loads/other). Ranking consumes the canonical number.
    const isCapped = scoreKind === 'for-time' && capped;
    const finalScore = isCapped ? capReps.trim() : canonicalScore.trim();
    if (isCapped ? !(parseInt(capReps, 10) > 0) : !scoreValid) {
      Alert.alert(t('common.error'), t('tourWod.errNoScore')); return;
    }
    // La vidéo n'est exigée que si la RÈGLE du tournoi l'impose (require_video_proof).
    // Sinon elle est facultative — mais si un lien est saisi, il doit être valide.
    if (requireVideoProof && !urlValid) { Alert.alert(t('common.error'), t('tourWod.errBadUrl')); return; }
    if (!requireVideoProof && youtubeUrl.trim().length > 0 && !urlValid) {
      Alert.alert(t('common.error'), t('tourWod.errBadUrl')); return;
    }
    if (remainingMs <= 0)    { Alert.alert(t('tourWod.deadlineExpiredTitle'), t('tourWod.errExpired')); return; }
    if (!user)               { Alert.alert(t('common.error'), t('tourWod.errNoUser')); return; }

    setSubmitting(true);
    const payload = {
      tournament_id:     tournamentId,
      tournament_wod_id: wod.id,
      athlete_id:        user.id,
      score_value:       finalScore,
      capped:            isCapped,
      tiebreak_value:    tiebreakValue ? parseFloat(tiebreakValue) : null,
      video_url:         youtubeUrl.trim() || null,
      notes:             notes.trim() || null,
      submitted_at:      new Date().toISOString(),
      deadline_at:       new Date(deadlineMsRef.current).toISOString(),
      status:            'pending',
    };

    let error: any;
    if (existingScore && existingScore.status === 'rejected') {
      ({ error } = await supabase.from('tournament_scores')
        .update(payload).eq('tournament_wod_id', wod.id).eq('athlete_id', user.id));
    } else {
      ({ error } = await supabase.from('tournament_scores').insert(payload));
    }

    setSubmitting(false);
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('success');
  }

  function launchTimer() {
    // Use wod.type as primary (amrap, for-time, emom, tabata, strength, custom)
    // wod.timer_type is a different field ('countdown','stopwatch','emom','tabata','none')
    const wodType = (wod.type ?? '').toLowerCase().replace(/\s+/g, '-');
    const timerType =
      wodType === 'amrap'                               ? 'amrap'    :
      wodType === 'for-time' || wodType === 'for time'  ? 'for-time' :
      wodType === 'emom'                                ? 'emom'     :
      wodType === 'tabata'                              ? 'tabata'   :
      wodType === 'ywyr'                                ? 'ywyr'     :
      // fall back to timer_type only for emom/tabata overrides
      wod.timer_type === 'emom'   ? 'emom'   :
      wod.timer_type === 'tabata' ? 'tabata' :
      'for-time';

    const durSeconds = (wod.time_cap_seconds ?? 0) > 0
      ? wod.time_cap_seconds!
      : wod.duration_minutes * 60;

    const rounds   = (wod as any).rounds       ?? (timerType === 'emom' ? wod.duration_minutes : 3);
    const workTime = (wod as any).work_seconds ?? 40;
    const restTime = (wod as any).rest_seconds ?? 20;

    navigation.navigate('TimerRun', {
      timerType,
      countdown:     10,
      totalSeconds:  timerType === 'amrap' ? durSeconds : 0,
      maxTime:       timerType === 'for-time' ? durSeconds : 0,
      interval:      timerType === 'emom' ? 1 : 0,
      rounds,
      workTime,
      restTime,
      sequence:      '[]',
      withCamera:    true,
      videoTitle:    `${tournamentName} · ${wod.title}`,
      withTimestamp: true,
    });
  }

  const countdown = formatCountdown(remainingMs, theme, t('tourWod.deadlineExpired'));

  // ══ PHASE : SUCCESS ═══════════════════════════════════════════════════════
  if (phase === 'success') return (
    <View style={S.successContainer}>
      <GlassBackground />
      <CheckCircle color={c.success} size={72} />
      <Text style={S.successTitle}>{t('tourWod.successTitle')}</Text>
      <Text style={S.successSub}>{t('tourWod.successSub')}</Text>
      <AxCard style={S.successCard} testID="tourwod-success-card">
        <Text style={S.successLabel}>{t('tourWod.wod')}</Text>
        <Text style={S.successValue}>{wod.title}</Text>
        <Text style={[S.successLabel, S.successGap]}>{t('tourWod.score')}</Text>
        <Text style={S.successScore}>{formatScoreDisplay(capped ? capReps : canonicalScore, wod.type, repsPerRound, capped, roundsLabel)}</Text>
        {tiebreakValue ? (
          <>
            <Text style={[S.successLabel, S.successGap]}>{t('tourWod.tiebreak')}</Text>
            <Text style={S.successValue}>{t('tourWod.reps', { n: tiebreakValue })}</Text>
          </>
        ) : null}
        <View style={S.successYtRow}>
          <Youtube color={c.success} size={16} />
          <Text style={S.successYtText}>{t('tourWod.ytSubmitted')}</Text>
        </View>
      </AxCard>
      <AxButton testID="tourwod-back" fullWidth onPress={() => navigation.goBack()} label={t('tourWod.backToTournament')} />
    </View>
  );

  // ══ PHASE : DETAIL ═════════════════════════════════════════════════════
  if (phase === 'detail') return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title={t('screenTitles.tournamentWod')} />
      <View style={S.header} testID="tourwod-header">
        <AxContentTitle title={wod.title} testID="tourwod-title" />
        <Text style={S.headerSub}>{tournamentName}</Text>
        <View style={S.headerBadges}>
          <AxTag label={wod.type} tone="accent" testID="tourwod-type" />
          <View style={S.metaItem}>
            <Clock color={c.textMuted} size={12} />
            <Text style={S.durationText}>{t('tourWod.minutes', { n: wod.duration_minutes })}</Text>
          </View>
          <View style={S.metaItem}>
            <Zap color={c.textMuted} size={12} />
            <Text style={S.scoringText}>{wod.scoring}</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.content, { paddingBottom: scrollPadBottom }]}>
        {wod.description ? (
          <AxCard style={S.card}>
            <Text style={S.cardLabel}>{t('tourWod.description')}</Text>
            <Text style={S.descText}>{wod.description}</Text>
          </AxCard>
        ) : null}

        {Array.isArray(wod.movements) && wod.movements.length > 0 && (
          <AxCard style={S.card}>
            <Text style={S.cardLabel}>{t('tourWod.movements')}</Text>
            {wod.movements.map((m, i) => (
              <View key={i} style={S.movRow}>
                <View style={S.movDot} />
                <Text style={S.movText}>{m}</Text>
              </View>
            ))}
          </AxCard>
        )}

        <AxCard style={S.card}>
          <Text style={S.cardLabel}>{t('tourWod.filmingRules')}</Text>
          {[t('tourWod.rule1'),
            t('tourWod.rule2'),
            t('tourWod.rule3'),
            t('tourWod.rule4', { h: wod.deadline_hours }),
            t('tourWod.rule5'),
          ].map((r, i) => <Text key={i} style={S.ruleText}>{r}</Text>)}
        </AxCard>

        {existingScore && (
          <AxCard style={[S.card, S.cardWarning]} testID="tourwod-prev-score">
            <Text style={S.cardLabel}>{t('tourWod.prevScore')}</Text>
            <Text style={S.prevScore}>{formatScoreDisplay(existingScore.score_value, wod.type, repsPerRound, existingScore.capped, roundsLabel)}</Text>
            {existingScore.video_url ? (
              <TouchableOpacity style={S.ytPrevBtn} onPress={() => Linking.openURL(existingScore.video_url!)} accessibilityRole="link">
                <Youtube color={c.danger} size={16} />
                <Text style={S.ytPrevText}>{t('tourWod.seeSubmittedVideo')}</Text>
              </TouchableOpacity>
            ) : null}
          </AxCard>
        )}

        <AxCard style={[S.card, S.cardWarning]}>
          <View style={S.warningRow}>
            <AlertTriangle color={c.warning} size={16} />
            <Text style={S.warningText}>
              {t('tourWod.countdownWarning', { h: wod.deadline_hours })}
            </Text>
          </View>
        </AxCard>

        <View style={S.actions}>
          <AxButton testID="tourwod-launch-camera" icon={Play} fullWidth onPress={launchTimer} label={t('tourWod.launchWithCamera')} />
          <AxButton testID="tourwod-submit-manual" icon={FileText} variant="outline" fullWidth
            onPress={() => { startCountdown(); setPhase('submit'); }} label={t('tourWod.submitScore')} />
        </View>

        <View style={S.bottomGap} />
      </ScrollView>
    </View>
  );

  // ══ PHASE : SUBMIT ═════════════════════════════════════════════════════
  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title={t('screenTitles.tournamentWod')} onBack={() => setPhase('detail')} />
      <View style={S.header} testID="tourwod-header">
        <AxContentTitle title={wod.title} testID="tourwod-title" />
        <Text style={S.headerSub}>{tournamentName}</Text>
        <View style={[S.countdownRow, { borderColor: countdown.color }]} testID="tourwod-countdown">
          <Clock color={countdown.color} size={14} />
          <Text style={[S.countdownText, { color: countdown.color }]}>{countdown.text}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.content, { paddingBottom: scrollPadBottom }]}
        keyboardShouldPersistTaps="handled">

        <AxCard style={S.card}>
          <Text style={S.cardLabel}>
            {wod.type === 'For Time' ? t('tourWod.finalTime') : t('tourWod.finalScore')}
          </Text>

          {scoreKind === 'for-time' && (
            <TouchableOpacity
              style={S.cappedRow}
              onPress={() => { setCapped(!capped); setCapReps(''); }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: capped }}
              activeOpacity={0.8}
            >
              <View style={[S.cappedCheck, capped && S.cappedCheckActive]}>
                {capped && <Check color={c.onAccent} size={14} strokeWidth={3} />}
              </View>
              <Text style={S.cappedLabel}>{t('tourWod.cappedLabel')}</Text>
            </TouchableOpacity>
          )}

          {scoreKind === 'for-time' && capped ? (
            <TextInput
              style={S.cappedInput}
              value={capReps}
              onChangeText={v => setCapReps(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder={t('tourWod.cappedPlaceholder')}
              placeholderTextColor={c.textMuted}
            />
          ) : (
            <ScoreEntryFields
              kind={scoreKind}
              movements={wod.movements}
              repsPerRound={wod.reps_per_round}
              initialCanonical={existingScore?.score_value ?? null}
              freePlaceholder={t('tourWod.phDefault')}
              onChange={(canonical, valid) => { setCanonicalScore(canonical); setScoreValid(valid); }}
            />
          )}
        </AxCard>

        <AxCard style={S.card}>
          <Text style={S.cardLabel}>{t('tourWod.tiebreakLabel')}</Text>
          <Text style={S.cardHint}>
            {t('tourWod.tiebreakHint')}
          </Text>
          <TextInput
            style={S.scoreInput}
            value={tiebreakValue}
            onChangeText={setTiebreakValue}
            placeholder={t('tourWod.phTiebreak')}
            placeholderTextColor={c.textMuted}
            keyboardType="numeric"
          />
        </AxCard>

        <AxCard style={S.card}>
          <Text style={S.cardLabel}>{t('tourWod.youtubeLabel')}</Text>
          <View style={S.ytRow}>
            <Youtube color={urlValid ? c.success : c.danger} size={20} />
            <TextInput
              style={S.ytInput}
              value={youtubeUrl}
              onChangeText={v => { setYoutubeUrl(v); setUrlValid(YOUTUBE_REGEX.test(v)); }}
              placeholder={t('tourWod.youtubePlaceholder')}
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {youtubeUrl.length > 0 && !urlValid && (
            <Text style={S.urlError}>{t('tourWod.urlError')}</Text>
          )}
          <TouchableOpacity onPress={() => setShowYtHelp(true)} style={S.ytHelpLink} accessibilityRole="button">
            <Info color={c.accentText} size={13} />
            <Text style={S.ytHelpText}>{t('tourWod.howToUpload')}</Text>
          </TouchableOpacity>
        </AxCard>

        <AxCard style={S.card}>
          <Text style={S.cardLabel}>{t('tourWod.notesLabel')}</Text>
          <TextInput
            style={[S.scoreInput, S.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('tourWod.notesPlaceholder')}
            placeholderTextColor={c.textMuted}
            multiline
          />
        </AxCard>

        <AxCard style={[S.card, S.cardWarning]}>
          <Text style={S.cardLabel}>{t('tourWod.honorLabel')}</Text>
          <Text style={S.honorText}>
            {t('tourWod.honorText')}
          </Text>
        </AxCard>

        <AxButton
          testID="tourwod-submit"
          fullWidth
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || remainingMs <= 0}
          label={remainingMs <= 0 ? t('tourWod.deadlineExpired') : t('tourWod.submitScoreCta')}
        />

        <View style={S.bottomGap} />
      </ScrollView>

      {/* YouTube help modal */}
      <Modal visible={showYtHelp} animationType="slide" transparent onRequestClose={() => setShowYtHelp(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <Text style={S.modalTitle}>{t('tourWod.uploadModalTitle')}</Text>
            {(t('tourWod.uploadSteps', { returnObjects: true }) as string[])
              .map((step, i) => <Text key={i} style={S.modalStep}>{step}</Text>)}
            <AxButton variant="outline" icon={Youtube} fullWidth
              onPress={() => Linking.openURL('https://studio.youtube.com')} label={t('tourWod.openYtStudio')} />
            <TouchableOpacity style={S.modalClose} onPress={() => setShowYtHelp(false)} accessibilityRole="button">
              <Text style={S.modalCloseTxt}>{t('tourWod.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
  container:   { flex: 1, backgroundColor: 'transparent' },
  header:      { paddingTop: axSpacing.sm, paddingHorizontal: axSpacing.lg, paddingBottom: axSpacing.lg, gap: axSpacing.sm },
  headerSub:   { ...axTypography.overline, color: c.textMuted },
  headerBadges:{ flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, flexWrap: 'wrap' },
  metaItem:      { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, flexShrink: 1 },
  durationText:  { ...axTypography.caption, color: c.textMuted },
  scoringText:   { ...axTypography.caption, color: c.text, flexShrink: 1 },
  countdownRow:  { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: axSpacing.sm, borderRadius: axRadius.control, borderWidth: 1, paddingHorizontal: axSpacing.md, paddingVertical: 7 },
  countdownText: { ...axTypography.numberM },
  content: { padding: axSpacing.lg, paddingTop: axSpacing.md },
  card:      { marginBottom: axSpacing.md },
  cardWarning: { borderColor: c.warning },
  cardLabel: { ...axTypography.overline, color: c.textMuted },
  cappedRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, marginTop: axSpacing.sm },
  cappedCheck: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: c.fieldBorder, alignItems: 'center', justifyContent: 'center',
  },
  cappedCheckActive: { backgroundColor: c.accent, borderColor: c.accent },
  cappedLabel: { ...axTypography.body, color: c.text, flexShrink: 1 },
  cappedInput: {
    marginTop: axSpacing.sm, backgroundColor: c.field, borderRadius: axRadius.control,
    borderWidth: 1, borderColor: c.fieldBorder, paddingHorizontal: axSpacing.lg,
    paddingVertical: axSpacing.md, color: c.text, ...axTypography.label,
  },
  cardHint:  { ...axTypography.bodySmall, color: c.textMuted },
  descText:  { ...axTypography.body, color: c.text },
  movRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.md },
  movDot:    { width: 7, height: 7, borderRadius: 4, marginTop: 7, backgroundColor: c.accentText },
  movText:   { ...axTypography.body, color: c.text, flex: 1 },
  ruleText:  { ...axTypography.bodySmall, color: c.text },
  warningRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.md },
  warningText: { ...axTypography.bodySmall, color: c.warning, flex: 1 },
  prevScore:  { ...axTypography.numberM, color: c.text },
  ytPrevBtn:  { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, minHeight: 44 },
  ytPrevText: { ...axTypography.label, color: c.danger },
  scoreInput: { backgroundColor: c.field, borderRadius: axRadius.control, padding: axSpacing.md, ...axTypography.body, color: c.text, borderWidth: 1, borderColor: c.fieldBorder },
  notesInput: { height: 80, textAlignVertical: 'top' },
  ytRow:      { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, backgroundColor: c.field, borderRadius: axRadius.control, paddingHorizontal: axSpacing.md, borderWidth: 1, borderColor: c.fieldBorder },
  ytInput:    { flex: 1, minWidth: 0, paddingVertical: axSpacing.md, ...axTypography.bodySmall, color: c.text },
  urlError:   { ...axTypography.caption, color: c.danger },
  ytHelpLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  ytHelpText: { ...axTypography.label, color: c.accentText },
  honorText:  { ...axTypography.bodySmall, color: c.text },
  actions:        { gap: axSpacing.md },
  bottomGap:      { height: 40 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: axSpacing.xl, gap: axSpacing.lg },
  successTitle:     { ...axTypography.titleL, color: c.text, textAlign: 'center' },
  successSub:       { ...axTypography.body, color: c.textMuted, textAlign: 'center' },
  successCard:      { alignSelf: 'stretch', gap: axSpacing.xs },
  successGap:       { marginTop: axSpacing.md },
  successLabel:     { ...axTypography.overline, color: c.textMuted },
  successValue:     { ...axTypography.label, color: c.text },
  successScore:     { ...axTypography.numberM, color: c.text },
  successYtRow:     { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, marginTop: axSpacing.md },
  successYtText:    { ...axTypography.label, color: c.success, flexShrink: 1 },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: axSpacing.xl, gap: axSpacing.md, borderWidth: 1, borderColor: c.border },
  modalTitle:    { ...axTypography.titleM, color: c.text },
  modalStep:     { ...axTypography.body, color: c.text },
  modalClose:    { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  modalCloseTxt: { ...axTypography.label, color: c.textMuted },
  });
}
