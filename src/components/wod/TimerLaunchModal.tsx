import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { X, Timer as TimerIcon, Camera, CameraOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { SeqBlock } from '../../navigation';
import {
  blockDurationSec,
  buildTimerRunParamsFromBlock,
  formatBlockPreconfig,
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
  const S = createStyles(theme);

  const [countdown, setCountdown] = useState<number>(3);
  const [block, setBlock] = useState<SeqBlock | null>(initialBlock);

  useEffect(() => {
    if (visible) {
      setCountdown(3);
      setBlock(initialBlock);
    }
  }, [visible, initialBlock]);

  function updateBlock(patch: Partial<SeqBlock>) {
    setBlock(b => (b ? { ...b, ...patch } : b));
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
      <View style={{ marginBottom: 4 }}>
        <Text style={S.timerModalLabel}>{t('whiteboard.timerMode')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TIMER_BLOCK_TYPES.map(mt => (
              <TouchableOpacity
                key={mt.key}
                onPress={() => updateBlock({ type: mt.key })}
                style={[S.timerModeChip, blk.type === mt.key && S.timerModeChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[S.timerModeChipText, blk.type === mt.key && S.timerModeChipTextActive]}>
                  {mt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

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
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={S.emomStepRow}>
                    <TouchableOpacity style={S.emomStepBtn} onPress={() => setDur(durSec - 60)}>
                      <Text style={S.emomStepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={S.emomStepValue}>{Math.floor(durSec / 60)}<Text style={S.emomStepUnit}> {t('whiteboard.minUnit')}</Text></Text>
                    <TouchableOpacity style={S.emomStepBtn} onPress={() => setDur(durSec + 60)}>
                      <Text style={S.emomStepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={S.emomStepRow}>
                    <TouchableOpacity style={S.emomStepBtn} onPress={() => setDur(durSec % 5 === 0 ? durSec - 5 : Math.floor(durSec / 5) * 5)}>
                      <Text style={S.emomStepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={S.emomStepValue}>{durSec % 60}<Text style={S.emomStepUnit}> {t('whiteboard.secUnit')}</Text></Text>
                    <TouchableOpacity style={S.emomStepBtn} onPress={() => setDur(durSec % 5 === 0 ? durSec + 5 : Math.ceil(durSec / 5) * 5)}>
                      <Text style={S.emomStepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(iv => (
                    <TouchableOpacity
                      key={iv}
                      onPress={() => {
                        const prevIvSec = isPerso ? customSec : blk.emomInterval * 60;
                        const totalMinPrev = (prevIvSec * blk.emomRounds) / 60;
                        const newRounds = Math.max(1, Math.round(totalMinPrev / iv));
                        updateBlock({ emomInterval: iv, emomRounds: newRounds });
                      }}
                      style={[S.timerModeChip, blk.emomInterval === iv && S.timerModeChipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[S.timerModeChipText, blk.emomInterval === iv && S.timerModeChipTextActive]}>
                        {iv === 1 ? 'EMOM' : `E${iv}MOM`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => updateBlock({ emomInterval: 0 })}
                    style={[S.timerModeChip, isPerso && S.timerModeChipActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.timerModeChipText, isPerso && S.timerModeChipTextActive]}>{t('whiteboard.emomPerso')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {isPerso && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <View style={S.emomStepRow}>
                    <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ emomCustomSec: Math.max(1, customSec - 60) })}>
                      <Text style={S.emomStepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={S.emomStepValue}>{customMin}<Text style={S.emomStepUnit}> {t('whiteboard.minUnit')}</Text></Text>
                    <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ emomCustomSec: customSec + 60 })}>
                      <Text style={S.emomStepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={S.emomStepRow}>
                    <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ emomCustomSec: Math.max(1, customSec % 5 === 0 ? customSec - 5 : Math.floor(customSec / 5) * 5) })}>
                      <Text style={S.emomStepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={S.emomStepValue}>{customSs}<Text style={S.emomStepUnit}> {t('whiteboard.secUnit')}</Text></Text>
                    <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ emomCustomSec: customSec % 5 === 0 ? customSec + 5 : Math.ceil(customSec / 5) * 5 })}>
                      <Text style={S.emomStepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={S.timerModalLabel}>{t('whiteboard.rounds')}</Text>
              <View style={S.emomStepRow}>
                <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ emomRounds: Math.max(1, blk.emomRounds - 1) })}>
                  <Text style={S.emomStepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={S.emomStepValue}>{blk.emomRounds}<Text style={S.emomStepUnit}> {t('whiteboard.roundsUnit')}</Text></Text>
                <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ emomRounds: blk.emomRounds + 1 })}>
                  <Text style={S.emomStepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={S.emomTotalHint}>
                {t('whiteboard.emomTotal', { total: `${totalMm} min${totalSs ? ` ${totalSs}s` : ''}` })}
              </Text>
            </>
          );
        })()}

        {blk.type === 'tabata' && (
          <>
            <Text style={S.timerModalLabel}>{t('whiteboard.work')}</Text>
            <View style={S.emomStepRow}>
              <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ workSec: Math.max(5, blk.workSec - 5) })}>
                <Text style={S.emomStepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={S.emomStepValue}>{blk.workSec}<Text style={S.emomStepUnit}> {t('whiteboard.secUnit')}</Text></Text>
              <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ workSec: blk.workSec + 5 })}>
                <Text style={S.emomStepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={S.timerModalLabel}>{t('whiteboard.rest')}</Text>
            <View style={S.emomStepRow}>
              <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ restSec: Math.max(0, blk.restSec - 5) })}>
                <Text style={S.emomStepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={S.emomStepValue}>{blk.restSec}<Text style={S.emomStepUnit}> {t('whiteboard.secUnit')}</Text></Text>
              <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ restSec: blk.restSec + 5 })}>
                <Text style={S.emomStepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={S.timerModalLabel}>{t('whiteboard.rounds')}</Text>
            <View style={S.emomStepRow}>
              <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ tabRounds: Math.max(1, blk.tabRounds - 1) })}>
                <Text style={S.emomStepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={S.emomStepValue}>{blk.tabRounds}<Text style={S.emomStepUnit}> {t('whiteboard.roundsUnit')}</Text></Text>
              <TouchableOpacity style={S.emomStepBtn} onPress={() => updateBlock({ tabRounds: blk.tabRounds + 1 })}>
                <Text style={S.emomStepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {blk.type === 'ywyr' && (
          <Text style={S.emomTotalHint}>{t('whiteboard.ywyrHint')}</Text>
        )}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={S.timerModalBackdrop}>
        <View style={S.timerModalCard}>
          <View style={S.timerModalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={S.timerModalTitle}>{t('whiteboard.launchTimer')}</Text>
              {!!title && (
                <Text style={S.timerModalSubtitle} numberOfLines={1}>{title}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={theme.textSecondary} size={20} />
            </TouchableOpacity>
          </View>

          {block && (
            <View style={S.timerModalPreview}>
              <TimerIcon color={theme.accent} size={18} />
              <Text style={S.timerModalPreviewText}>{formatBlockPreconfig(block)}</Text>
            </View>
          )}

          {renderConfig()}

          <Text style={S.timerModalLabel}>{t('whiteboard.countdown')}</Text>
          <View style={S.timerModalCountdownRow}>
            {[0, 3, 5, 10].map(v => (
              <TouchableOpacity
                key={v}
                onPress={() => setCountdown(v)}
                style={[S.timerModalCdChip, countdown === v && S.timerModalCdChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[S.timerModalCdChipText, countdown === v && S.timerModalCdChipTextActive]}>
                  {v === 0 ? '—' : `${v}s`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={S.timerModalActions}>
            <TouchableOpacity
              onPress={() => launch(false)}
              style={[S.timerModalBtn, S.timerModalBtnSecondary]}
              activeOpacity={0.85}
              testID="timer-launch-without-camera"
            >
              <CameraOff color={theme.text} size={18} />
              <Text style={S.timerModalBtnSecondaryText}>{t('whiteboard.withoutCamera')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => launch(true)}
              style={[S.timerModalBtn, S.timerModalBtnPrimary]}
              activeOpacity={0.85}
              testID="timer-launch-with-camera"
            >
              <Camera color="#fff" size={18} />
              <Text style={S.timerModalBtnPrimaryText}>{t('whiteboard.withCamera')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  timerModalBackdrop: {
    flex: 1, backgroundColor: theme.modalBackdrop,
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  timerModalCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: theme.modalCard, borderRadius: 20, padding: 20, gap: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  timerModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerModalTitle: { fontSize: 17, fontWeight: '800', color: theme.text },
  timerModalSubtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  timerModalPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${theme.accent}14`, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: `${theme.accent}30`,
  },
  timerModalPreviewText: { fontSize: 14, fontWeight: '700', color: theme.accent, letterSpacing: 0.3 },
  timerModalLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.6, marginTop: 8, marginBottom: 6 },
  emomStepRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: theme.border, marginBottom: 4,
  },
  emomStepBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: theme.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.border,
  },
  emomStepBtnText: { fontSize: 18, fontWeight: '900', color: theme.text },
  emomStepValue: { fontSize: 22, fontWeight: '900', color: theme.text },
  emomStepUnit: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
  emomTotalHint: { fontSize: 11, fontWeight: '600', color: theme.textMuted, textAlign: 'center', marginTop: 6 },
  timerModeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  timerModeChipActive: { backgroundColor: `${theme.accent}22`, borderColor: theme.accent },
  timerModeChipText: { fontSize: 12, fontWeight: '800', color: theme.textSecondary, letterSpacing: 0.4 },
  timerModeChipTextActive: { color: theme.accent },
  timerModalCountdownRow: { flexDirection: 'row', gap: 8 },
  timerModalCdChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center',
  },
  timerModalCdChipActive: { backgroundColor: `${theme.accent}22`, borderColor: theme.accent },
  timerModalCdChipText: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  timerModalCdChipTextActive: { color: theme.accent },
  timerModalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  timerModalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
  },
  timerModalBtnSecondary: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  timerModalBtnSecondaryText: { fontSize: 14, fontWeight: '700', color: theme.text },
  timerModalBtnPrimary: { backgroundColor: theme.accent },
  timerModalBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
