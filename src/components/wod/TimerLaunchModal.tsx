import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { X, Timer as TimerIcon, Camera, CameraOff, Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { AxButton, AxCard, AxChip, AxIconButton, withAlpha } from '../ax';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { SeqBlock } from '../../navigation';
import {
  blockDurationSec,
  buildTimerRunParamsFromBlock,
  formatBlockPreconfig,
  roundSplitExercises,
  TIMER_BLOCK_TYPES,
} from '../../utils/wodToTimer';

export type TimerRunParams = ReturnType<typeof buildTimerRunParamsFromBlock>;

type Props = {
  visible: boolean;
  /** Titre affiché sous « Lancer le minuteur » et repris comme titre de la vidéo. */
  title: string;
  /** Bloc pré-configuré depuis le WOD ; le mode reste modifiable dans la modale. */
  initialBlock: SeqBlock | null;
  onClose: () => void;
  onLaunch: (params: TimerRunParams) => void;
};

/**
 * Modale de lancement du minuteur vidéo depuis un WOD (Whiteboard, page
 * résultat du générateur) : mode éditable, compte à rebours, avec ou sans
 * caméra.
 */
export default function TimerLaunchModal({ visible, title, initialBlock, onClose, onLaunch }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.ax;
  const S = createStyles(c);

  const [countdown, setCountdown] = useState<number>(3);
  const [block, setBlock] = useState<SeqBlock | null>(initialBlock);

  useEffect(() => {
    if (visible) {
      setCountdown(3);
      setBlock(initialBlock);
    }
  }, [visible, initialBlock]);

  function updateBlock(patch: Partial<SeqBlock>) {
    // B5 : passer un bloc sans exercices en Split le splitte par round
    setBlock(b => (b ? { ...b, ...patch, ...(patch.type === 'split' && !b.splitExercises?.length ? { splitExercises: roundSplitExercises(b.emomRounds) } : {}) } : b));
  }

  function launch(withCamera: boolean) {
    if (!block) return;
    onLaunch(buildTimerRunParamsFromBlock(block, title, { withCamera, countdown }));
  }

  // Mode selector + per-mode configuration for the timer launcher.
  function renderConfig() {
    const blk = block;
    if (!blk) return null;

    return (
      <View style={S.config}>
        <Text style={S.timerModalLabel}>{t('whiteboard.timerMode')}</Text>
        <View style={S.chipWrap} testID="timer-mode-list">
            {TIMER_BLOCK_TYPES.map(mt => (
              <AxChip
                key={mt.key}
                label={mt.label}
                selected={blk.type === mt.key}
                onPress={() => updateBlock({ type: mt.key })}
                testID={`timer-type-${mt.key}`}
              />
            ))}
          </View>

        {(blk.type === 'amrap' || blk.type === 'for-time') && (
          <>
            <Text style={S.timerModalLabel}>
              {blk.type === 'amrap' ? t('whiteboard.duration') : t('whiteboard.capMax')}
            </Text>
            {(() => {
              // Le cap se règle en minutes ET en secondes : un pas d'une minute
              // conserve les secondes du WOD, donc lancer sans y toucher ne
              // réécrit pas un 12:30 en 13:00.
              const durSec = blockDurationSec(blk);
              const setDur = (sec: number) => updateBlock({ durationSec: Math.max(0, sec), durationMin: Math.floor(Math.max(0, sec) / 60) });
              return (
                <View style={S.stepPair}>
                  <StepRow value={Math.floor(durSec / 60)} unit={t('whiteboard.minUnit')}
                    onDec={() => setDur(durSec - 60)}
                    onInc={() => setDur(durSec + 60)} />
                  <StepRow value={durSec % 60} unit={t('whiteboard.secUnit')}
                    onDec={() => setDur(durSec % 5 === 0 ? durSec - 5 : Math.floor(durSec / 5) * 5)}
                    onInc={() => setDur(durSec % 5 === 0 ? durSec + 5 : Math.ceil(durSec / 5) * 5)} />
                </View>
              );
            })()}
          </>
        )}

        {blk.type === 'emom' && (() => {
          const isPerso = blk.emomInterval === 0;
          const customSec = blk.emomCustomSec ?? 90;
          const customMin = Math.floor(customSec / 60);
          const customSs = customSec % 60;
          const intervalSec = isPerso ? customSec : blk.emomInterval * 60;
          const totalSec = intervalSec * blk.emomRounds;
          const totalMm = Math.floor(totalSec / 60);
          const totalSs = totalSec % 60;
          return (
            <>
              <Text style={S.timerModalLabel}>{t('whiteboard.interval')}</Text>
              <View style={S.chipWrap}>
                  {[1, 2, 3, 4, 5].map(iv => (
                    <AxChip
                key={iv}
                label={iv === 1 ? 'EMOM' : `E${iv}MOM`}
                selected={blk.emomInterval === iv}
                onPress={() => {
                        const prevIvSec = isPerso ? customSec : blk.emomInterval * 60;
                        const totalMinPrev = (prevIvSec * blk.emomRounds) / 60;
                        const newRounds = Math.max(1, Math.round(totalMinPrev / iv));
                        updateBlock({ emomInterval: iv, emomRounds: newRounds });
                      }}
                testID={`timer-mode-${iv}`}
              />
                  ))}
                  <AxChip label={t('whiteboard.emomPerso')} selected={isPerso} onPress={() => updateBlock({ emomInterval: 0 })} />
                </View>

              {isPerso && (
                <View style={S.stepPair}>
                  <StepRow value={customMin} unit={t('whiteboard.minUnit')}
                    onDec={() => updateBlock({ emomCustomSec: Math.max(1, customSec - 60) })}
                    onInc={() => updateBlock({ emomCustomSec: customSec + 60 })} />
                  <StepRow value={customSs} unit={t('whiteboard.secUnit')}
                    onDec={() => updateBlock({ emomCustomSec: Math.max(1, customSec % 5 === 0 ? customSec - 5 : Math.floor(customSec / 5) * 5) })}
                    onInc={() => updateBlock({ emomCustomSec: customSec % 5 === 0 ? customSec + 5 : Math.ceil(customSec / 5) * 5 })} />
                </View>
              )}

              <Text style={S.timerModalLabel}>{t('whiteboard.rounds')}</Text>
              <StepRow value={blk.emomRounds} unit={t('whiteboard.roundsUnit')}
                    onDec={() => updateBlock({ emomRounds: Math.max(1, blk.emomRounds - 1) })}
                    onInc={() => updateBlock({ emomRounds: blk.emomRounds + 1 })} />
              <Text style={S.emomTotalHint}>
                {t('whiteboard.emomTotal', { total: `${totalMm} min${totalSs ? ` ${totalSs}s` : ''}` })}
              </Text>
            </>
          );
        })()}

        {blk.type === 'tabata' && (
          <>
            <Text style={S.timerModalLabel}>{t('whiteboard.work')}</Text>
            <StepRow value={blk.workSec} unit={t('whiteboard.secUnit')}
                    onDec={() => updateBlock({ workSec: Math.max(5, blk.workSec - 5) })}
                    onInc={() => updateBlock({ workSec: blk.workSec + 5 })} />
            <Text style={S.timerModalLabel}>{t('whiteboard.rest')}</Text>
            <StepRow value={blk.restSec} unit={t('whiteboard.secUnit')}
                    onDec={() => updateBlock({ restSec: Math.max(0, blk.restSec - 5) })}
                    onInc={() => updateBlock({ restSec: blk.restSec + 5 })} />
            <Text style={S.timerModalLabel}>{t('whiteboard.rounds')}</Text>
            <StepRow value={blk.tabRounds} unit={t('whiteboard.roundsUnit')}
                    onDec={() => updateBlock({ tabRounds: Math.max(1, blk.tabRounds - 1) })}
                    onInc={() => updateBlock({ tabRounds: blk.tabRounds + 1 })} />
          </>
        )}

        {blk.type === 'ywyr' && (
          <Text style={S.emomTotalHint}>{t('whiteboard.ywyrHint')}</Text>
        )}
        {blk.type === 'split' && (
          <View style={S.splitList}>
            {(blk.splitExercises ?? []).map((e, i) => (
              <Text key={`${e.name}-${i}`} style={S.splitItem} numberOfLines={1}>
                {e.name} · {e.sets} {e.sets > 1 ? 'séries' : 'série'}{e.restSec > 0 ? ` · repos ${e.restSec} s` : ''}
              </Text>
            ))}
            <Text style={S.emomTotalHint}>Chrono global. « Série terminée » enregistre un split et lance le repos ; les splits sont listés en fin de séance.</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={S.timerModalBackdrop}>
        <AxCard style={S.timerModalCard} testID="timer-launch-card">
          <View style={S.timerModalHeader}>
            <View style={S.flex1}>
              <Text style={S.timerModalTitle}>{t('whiteboard.launchTimer')}</Text>
              {!!title && (
                <Text style={S.timerModalSubtitle} numberOfLines={1}>{title}</Text>
              )}
            </View>
            <AxIconButton icon={X} onPress={onClose} accessibilityLabel={t('common.close')} testID="timer-launch-close" />
          </View>

          {block && (
            <View style={S.timerModalPreview} testID="timer-launch-preview">
              <TimerIcon color={c.accentText} size={18} />
              <Text style={S.timerModalPreviewText}>{formatBlockPreconfig(block)}</Text>
            </View>
          )}

          {renderConfig()}

          <Text style={S.timerModalLabel}>{t('whiteboard.countdown')}</Text>
          <View style={S.chipWrap}>
            {[0, 3, 5, 10].map(v => (
              <AxChip
                key={v}
                label={v === 0 ? '—' : `${v}s`}
                selected={countdown === v}
                onPress={() => setCountdown(v)}
                testID={`timer-countdown-${v}`}
              />
            ))}
          </View>

          <View style={S.timerModalActions}>
            <View style={S.flex1}>
              <AxButton
                label={t('whiteboard.withoutCamera')}
                variant="outline"
                icon={CameraOff}
                fullWidth
                onPress={() => launch(false)}
                testID="timer-launch-without-camera"
              />
            </View>
            <View style={S.flex1}>
              <AxButton
                label={t('whiteboard.withCamera')}
                variant="accent"
                icon={Camera}
                fullWidth
                onPress={() => launch(true)}
                testID="timer-launch-with-camera"
              />
            </View>
          </View>
        </AxCard>
      </View>
    </Modal>
  );
}

function StepRow({ value, unit, onDec, onInc }: { value: number; unit: string; onDec: () => void; onInc: () => void }) {
  const { theme } = useTheme();
  const S = createStyles(theme.ax);
  return (
    <View style={S.stepRow}>
      <AxIconButton icon={Minus} onPress={onDec} accessibilityLabel={`− ${unit}`} />
      <Text style={S.stepValue}>{value}<Text style={S.stepUnit}> {unit}</Text></Text>
      <AxIconButton icon={Plus} onPress={onInc} accessibilityLabel={`+ ${unit}`} />
    </View>
  );
}

const createStyles = (c: AxColors) => StyleSheet.create({
  flex1: { flex: 1 },
  config: { gap: axSpacing.sm },
  stepPair: { flexDirection: 'row', gap: axSpacing.sm },
  splitList: { gap: axSpacing.xs },
  splitItem: { ...axTypography.bodySmall, color: c.text },
  timerModalBackdrop: {
    flex: 1, backgroundColor: withAlpha(c.background, 0.8),
    justifyContent: 'center', alignItems: 'center', padding: axSpacing.xl,
  },
  timerModalCard: { width: '100%', maxWidth: 420, borderRadius: axRadius.card, gap: axSpacing.md },
  timerModalHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
  timerModalTitle: { ...axTypography.titleM, color: c.text },
  timerModalSubtitle: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2 },
  timerModalPreview: {
    flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm,
    backgroundColor: withAlpha(c.accent, 0.12), borderRadius: axRadius.control, padding: axSpacing.md,
  },
  timerModalPreviewText: { ...axTypography.label, color: c.text, flexShrink: 1 },
  timerModalLabel: { ...axTypography.overline, color: c.textMuted, marginTop: axSpacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm },
  stepRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: axRadius.control, padding: axSpacing.xs,
    borderWidth: 1, borderColor: c.border,
  },
  stepValue: { ...axTypography.numberM, color: c.text },
  stepUnit: { ...axTypography.caption, color: c.textMuted },
  emomTotalHint: { ...axTypography.caption, color: c.textMuted, textAlign: 'center' },
  timerModalActions: { flexDirection: 'row', gap: axSpacing.md, marginTop: axSpacing.xs },
});
