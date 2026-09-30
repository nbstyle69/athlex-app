import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Timer, Video, Send, Dumbbell } from 'lucide-react-native';
import { AxButton, AxCard, AxTag, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { CompetitionStackParamList } from '../../navigation';
import { trackInterCompScoreSubmit } from '../../lib/analytics';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTranslation } from 'react-i18next';
import ScoreEntryFields, { ScoreKind } from '../../components/score/ScoreEntryFields';
import { secondsToTimeString } from '../../utils/tournamentUtils';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav   = NativeStackNavigationProp<CompetitionStackParamList, 'InterScoreSubmit'>;
type Route = RouteProp<CompetitionStackParamList, 'InterScoreSubmit'>;

export default function InterScoreSubmitScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { competitionId, wodId, wodTitle, wodDescription, timeCap, scoringType, existingScore } = route.params;
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const S = createStyles(theme);
  const ax = theme.ax;

  // inter_scores.score_value is a NUMERIC column and the standings view ranks on
  // it (time ↑, everything else ↓). We store a canonical number and keep a
  // human-readable string in score_display.
  const scoreKind: ScoreKind = scoringType === 'time'
    ? 'for-time'
    : (scoringType === 'reps' || scoringType === 'rounds_reps') ? 'reps' : 'free';
  const [canonical,   setCanonical]   = useState(existingScore?.score_value?.toString() ?? '');
  const [scoreValid,  setScoreValid]  = useState(existingScore?.score_value != null);
  const [videoUrl,    setVideoUrl]    = useState(existingScore?.video_url ?? '');
  const [notes,       setNotes]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  function scoreDisplay(numeric: number, raw: string): string {
    if (scoringType === 'time') return secondsToTimeString(numeric);
    if (scoringType === 'reps' || scoringType === 'rounds_reps') return t('scoreEntry.scoreRecap', { total: numeric }).replace(/^=\s*/, '');
    if (scoringType === 'weight') return `${numeric} kg`;
    return raw;
  }

  async function handleSubmit() {
    if (!user) return;
    const numeric = parseFloat(canonical);
    if (!scoreValid || Number.isNaN(numeric)) {
      Alert.alert(t('interScore.scoreRequired'), t('interScore.scoreRequiredMsg'));
      return;
    }

    // Validate video URL if provided
    const trimmedVideo = videoUrl.trim();
    if (trimmedVideo && !/^https?:\/\/.+/i.test(trimmedVideo)) {
      Alert.alert(t('interScore.invalidVideo'), t('interScore.invalidVideoMsg'));
      return;
    }

    setSubmitting(true);
    const payload = {
      competition_id: competitionId,
      wod_id: wodId,
      athlete_id: user.id,
      score_value: numeric,
      score_display: scoreDisplay(numeric, canonical.trim()),
      video_url: trimmedVideo || null,
      notes: notes.trim() || null,
      status: 'pending',
    };

    let error: any = null;
    if (existingScore) {
      ({ error } = await supabase.from('inter_scores').update({ ...payload, reviewed_at: null, rejection_reason: null }).eq('id', existingScore.id));
    } else {
      ({ error } = await supabase.from('inter_scores').insert(payload));
    }

    setSubmitting(false);
    if (error) {
      if (error.code === '23505') Alert.alert(t('interScore.alreadySubmitted'), t('interScore.alreadySubmittedMsg'));
      else Alert.alert(t('common.error'), error.message);
      return;
    }
    trackInterCompScoreSubmit(competitionId, scoringType, !!trimmedVideo);
    Alert.alert(
      t('interScore.submittedTitle'),
      t('interScore.submittedMsg'),
      [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
    );
  }

  function handleLaunchTimer() {
    navigation.navigate('TimerRun', {
      timerType: 'for-time',
      countdown: 10,
      totalSeconds: 0,
      maxTime: timeCap ? timeCap * 60 : 0,
      interval: 0,
      rounds: 0,
      workTime: 0,
      restTime: 0,
      withCamera: true,
      sequence: '[]',
      videoTitle: wodTitle,
      withTimestamp: true,
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={S.container}>
      <GlassBackground />
        {/* Header */}
        <AxScreenHeader title={t('interScore.title')}>
            <Text style={S.headerSub}>{wodTitle}</Text>
        </AxScreenHeader>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.content, { paddingBottom: tabSpace }]} keyboardShouldPersistTaps="handled">

          {/* WOD info */}
          <AxCard style={S.wodCard} testID="inter-score-wod">
            <View style={S.wodHeader}>
              <View style={S.wodIcon}>
                <Dumbbell size={16} color={ax.accentText} />
              </View>
              <Text style={S.wodTitle}>{wodTitle}</Text>
            </View>
            {wodDescription ? <Text style={S.wodDesc}>{wodDescription}</Text> : null}
            <View style={S.wodMeta}>
              {timeCap && <AxTag label={t('interScore.minCap', { n: timeCap })} tone="muted" />}
              <AxTag label={scoringType} testID="inter-score-scoring" />
            </View>
          </AxCard>

          {/* Launch timer */}
          <View style={S.section}>
            <Text style={S.sectionLabel}>{t('interScore.step1')}</Text>
            <AxCard onPress={handleLaunchTimer} accessibilityLabel={t('interScore.launchTimerCamera')} style={S.timerBtn} testID="inter-score-timer">
              <Timer size={20} color={ax.accentText} />
              <View style={S.timerTexts}>
                <Text style={S.timerBtnTitle}>{t('interScore.launchTimerCamera')}</Text>
                <Text style={S.timerBtnSub}>{t('interScore.launchTimerCameraSub')}</Text>
              </View>
            </AxCard>
            <Text style={S.orText}>{t('interScore.orEnterBelow')}</Text>
          </View>

          {/* Score input */}
          <View style={S.section}>
            <Text style={S.sectionLabel}>{t('interScore.step2')}</Text>
            <ScoreEntryFields
              kind={scoreKind}
              initialCanonical={existingScore?.score_value?.toString() ?? null}
              freePlaceholder={scoringType === 'weight' ? t('interScore.phWeight') : t('interScore.enterScore')}
              onChange={(c, valid) => { setCanonical(c); setScoreValid(valid); }}
            />
          </View>

          {/* Video URL */}
          <View style={S.section}>
            <Text style={S.sectionLabel}>{t('interScore.step3')}</Text>
            <Text style={S.sectionHint}>{t('interScore.step3Hint')}</Text>
            <AxTextField
              icon={Video}
              value={videoUrl}
              onChangeText={setVideoUrl}
              placeholder="https://youtube.com/..."
              autoCapitalize="none"
              keyboardType="url"
              accessibilityLabel={t('interScore.step3')}
              testID="inter-score-video"
            />
          </View>

          {/* Notes */}
          <View style={S.section}>
            <Text style={S.sectionLabel}>{t('interScore.notes')}</Text>
            <AxTextField
              value={notes}
              onChangeText={setNotes}
              placeholder={t('interScore.notesPlaceholder')}
              multiline
              accessibilityLabel={t('interScore.notes')}
              testID="inter-score-notes"
            />
          </View>

          {/* Info */}
          <AxCard style={S.infoBox}>
            <Text style={S.infoText}>
              {t('interScore.infoPrefix')}{' '}
              <Text style={S.infoStrong}>{t('interScore.pending')}</Text>.
              {'\n'}{t('interScore.infoSuffix')}
            </Text>
          </AxCard>

          {/* Submit */}
          <AxButton
            label={existingScore ? t('interScore.update') : t('interScore.title')}
            icon={Send}
            fullWidth
            onPress={handleSubmit}
            disabled={submitting}
            loading={submitting}
            testID="inter-score-submit"
          />

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    headerSub: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
    content: { padding: axSpacing.lg },
    wodCard: { marginBottom: axSpacing.xl, gap: axSpacing.sm },
    wodHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
    wodIcon: { width: 32, height: 32, borderRadius: axRadius.control, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
    wodTitle: { ...axTypography.titleM, color: c.text, flex: 1 },
    wodDesc: { ...axTypography.bodySmall, color: c.textMuted },
    wodMeta: { flexDirection: 'row', gap: axSpacing.sm, flexWrap: 'wrap' },
    section: { marginBottom: axSpacing.xl, gap: axSpacing.sm },
    sectionLabel: { ...axTypography.overline, color: c.textMuted },
    sectionHint: { ...axTypography.caption, color: c.textMuted },
    timerBtn: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
    timerTexts: { flex: 1, minWidth: 0 },
    timerBtnTitle: { ...axTypography.label, color: c.text },
    timerBtnSub: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
    orText: { ...axTypography.caption, textAlign: 'center', color: c.textMuted, marginTop: axSpacing.xs },
    infoBox: { marginBottom: axSpacing.xl },
    infoText: { ...axTypography.bodySmall, color: c.textMuted },
    infoStrong: { fontWeight: '700', color: c.accentText },
  });
}
