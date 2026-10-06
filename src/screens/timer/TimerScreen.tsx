import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable } from 'react-native';
import {
  Timer, Video, Plus, Minus, Trash2, Type, Clock, Camera, Pause, ChevronDown, Check,
  RefreshCw, Radio, Zap, BicepsFlexed, Scissors, Wrench, Mic, Volume2, type LucideIcon,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { HomeStackParamList, TimerType, SeqBlock, BlockType } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxButton, AxCard, AxChip, AxIconButton, AxSwitch, AxTag, AxTextField, withAlpha } from '../../components/ax';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_VIDEO_OPTS, VIDEO_FPS, loadVideoOpts, saveVideoOpts, type VideoOpts,
} from '../../lib/timerVideoOpts';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Timer'>;

// Libellés et descriptions : clés i18n (`timer.run.type.*`, `timer.config.desc.*`), traduites au rendu.
const TABS: { key: TimerType; labelKey: string; icon: LucideIcon; descKey: string }[] = [
  { key: 'for-time',  labelKey: 'timer.run.type.forTime', icon: Timer,        descKey: 'timer.config.desc.forTime' },
  { key: 'amrap',     labelKey: 'timer.run.type.amrap',   icon: RefreshCw,    descKey: 'timer.config.desc.amrap' },
  { key: 'emom',      labelKey: 'timer.run.type.emom',    icon: Radio,        descKey: 'timer.config.desc.emom' },
  { key: 'tabata',    labelKey: 'timer.run.type.tabata',  icon: Zap,          descKey: 'timer.config.desc.tabata' },
  { key: 'ywyr',      labelKey: 'timer.run.type.ywyr',    icon: BicepsFlexed, descKey: 'timer.config.desc.ywyr' },
  { key: 'splits',    labelKey: 'timer.run.type.splits',  icon: Scissors,     descKey: 'timer.config.desc.splits' },
  { key: 'libre',     labelKey: 'timer.run.type.custom',  icon: Wrench,       descKey: 'timer.config.desc.custom' },
];

const BLOCK_TYPES: { key: BlockType; labelKey: string }[] = [
  { key: 'for-time', labelKey: 'timer.run.type.forTime' },
  { key: 'amrap',    labelKey: 'timer.run.type.amrap' },
  { key: 'emom',     labelKey: 'timer.run.type.emom' },
  { key: 'tabata',   labelKey: 'timer.run.type.tabata' },
  { key: 'ywyr',     labelKey: 'timer.run.type.ywyr' },
];

function makeBlock(): SeqBlock {
  return makeTypedBlock('amrap');
}

function makeTypedBlock(type: BlockType): SeqBlock {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    durationMin: type === 'amrap' ? 10 : 0,
    emomInterval: 1, emomRounds: 10, emomCustomSec: 90,
    workSec: 20, restSec: 10, tabRounds: 8,
    pauseSec: 0,
  };
}

const COUNTDOWN_OPTS = [0, 3, 5, 10, 15, 30];
const EMOM_INTERVALS = [1, 2, 3, 4, 5];

function Stepper({
  value, onDec, onInc, unit, minVal = 0,
}: { value: number; onDec: () => void; onInc: () => void; unit: string; minVal?: number }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const S = createStyles(theme.ax);
  return (
    <View style={S.stepperRow}>
      <AxIconButton icon={Minus} onPress={onDec} disabled={value <= minVal} accessibilityLabel={t('timer.config.less', { unit })} />
      <View style={S.stepperValueBox}>
        <Text style={S.stepperValue}>{value}</Text>
        <Text style={S.stepperUnit}>{unit}</Text>
      </View>
      <AxIconButton icon={Plus} onPress={onInc} accessibilityLabel={t('timer.config.more', { unit })} />
    </View>
  );
}

function CountdownPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const S = createStyles(theme.ax);
  return (
    <AxCard>
      <Text style={S.overline}>{t('timer.config.countdown')}</Text>
      <View testID="timer-countdown-opts" style={S.countdownRow}>
        {COUNTDOWN_OPTS.map((v) => (
          <AxChip key={v} equal testID={`timer-countdown-opt-${v}`} label={v === 0 ? '—' : `${v}s`} selected={value === v} onPress={() => onChange(v)} />
        ))}
      </View>
    </AxCard>
  );
}

export default function TimerScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);
  const [activeTab, setActiveTab] = useState<TimerType>('for-time');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [seqBlocks, setSeqBlocks] = useState<SeqBlock[]>([makeTypedBlock('for-time')]);
  const [videoTitle, setVideoTitle] = useState('');
  const [withTimestamp, setWithTimestamp] = useState(true);
  const [withCamera, setWithCamera] = useState(false);
  const { t } = useTranslation();
  // Options vidéo (R6c) : même stockage que les options d'affichage du minuteur.
  const [videoOpts, setVideoOpts] = useState<VideoOpts>(DEFAULT_VIDEO_OPTS);
  useEffect(() => { loadVideoOpts().then(setVideoOpts); }, []);
  function updateVideo(update: Partial<VideoOpts>) {
    setVideoOpts(v => ({ ...v, ...update }));
    saveVideoOpts(update).catch(() => {});
  }

  // Splits mode state — manual tap-to-restart timer
  const [splitsMin, setSplitsMin] = useState(1);
  const [splitsSec, setSplitsSec] = useState(30);
  const [splitsRounds, setSplitsRounds] = useState(4);

  function switchTab(key: TimerType) {
    setActiveTab(key);
    if (key === 'libre') setSeqBlocks([makeBlock()]);
    else if (key !== 'splits') setSeqBlocks([makeTypedBlock(key as BlockType)]);
    // splits doesn't use SeqBlocks — keep previous blocks untouched
  }

  function addBlock() {
    setSeqBlocks(v => [...v, activeTab === 'libre' ? makeBlock() : makeTypedBlock(activeTab as BlockType)]);
  }
  function removeBlock(id: string) { setSeqBlocks(v => v.length > 1 ? v.filter(b => b.id !== id) : v); }
  function updateBlock(id: string, patch: Partial<SeqBlock>) {
    setSeqBlocks(v => v.map(b => b.id === id ? { ...b, ...patch } : b));
  }

  function launch() {
    if (activeTab === 'splits') {
      const roundSec = Math.max(1, splitsMin * 60 + splitsSec);
      navigation.navigate('TimerRun', {
        timerType: 'splits',
        countdown: 0, // Splits = lancement direct, pas de 3-2-1
        totalSeconds: 0, maxTime: 0, interval: 0,
        rounds: Math.max(1, splitsRounds),
        workTime: roundSec, restTime: 0,
        withCamera,
        sequence: '[]',
        videoTitle: videoTitle.trim(),
        withTimestamp,
      });
      return;
    }
    if (activeTab === 'ywyr') {
      // YWYR autonome : chrono montant → FIN DU TRAVAIL → décompte → boucle infinie, fin manuelle
      navigation.navigate('TimerRun', {
        timerType: 'ywyr',
        countdown,
        totalSeconds: 0, maxTime: 0, interval: 0, rounds: 0, workTime: 0, restTime: 0,
        withCamera,
        sequence: '[]',
        videoTitle: videoTitle.trim(),
        withTimestamp,
      });
      return;
    }
    navigation.navigate('TimerRun', {
      timerType: 'libre',
      countdown,
      totalSeconds: 0, maxTime: 0, interval: 0, rounds: 0, workTime: 0, restTime: 0,
      withCamera,
      sequence: JSON.stringify(seqBlocks),
      videoTitle: videoTitle.trim(),
      withTimestamp,
    });
  }

  // Splits config card — render directly without SeqBlock plumbing
  const renderSplitsConfig = () => (
    <AxCard>
      <View style={S.seqCardHeader}>
        <View style={S.seqBlockNum}>
          <Text style={S.seqBlockNumText}>1</Text>
        </View>
        <AxTag label={t('timer.run.type.splits')} />
      </View>

      <View style={S.seqConfigRow}>
        <Text style={S.overline}>{t('timer.config.durationPerRound')}</Text>
        <View style={S.stepperPair}>
          <View style={S.flex1}>
            <Stepper value={splitsMin} unit="min" minVal={0}
              onDec={() => setSplitsMin(v => Math.max(0, v - 1))}
              onInc={() => setSplitsMin(v => Math.min(60, v + 1))}
            />
          </View>
          <View style={S.flex1}>
            <Stepper value={splitsSec} unit={t('timer.config.unitSec')} minVal={0}
              onDec={() => setSplitsSec(v => v % 5 === 0 ? Math.max(0, v - 5) : Math.floor(v / 5) * 5)}
              onInc={() => setSplitsSec(v => Math.min(55, v % 5 === 0 ? v + 5 : Math.ceil(v / 5) * 5))}
            />
          </View>
        </View>
        <Text style={S.overline}>{t('timer.config.rounds')}</Text>
        <Stepper value={splitsRounds} unit={t('timer.config.unitRounds')} minVal={1}
          onDec={() => setSplitsRounds(v => Math.max(1, v - 1))}
          onInc={() => setSplitsRounds(v => v + 1)}
        />
        <Text style={S.cardHint}>{t('timer.config.splitsHint')}</Text>
      </View>
    </AxCard>
  );

  const renderBlockConfig = (blk: SeqBlock) => (
    <>
      {(blk.type === 'amrap' || blk.type === 'for-time') && (
        <View style={S.seqConfigRow}>
          <Text style={S.overline}>{blk.type === 'amrap' ? t('timer.config.duration') : t('timer.config.capMax')}</Text>
          <Stepper value={blk.durationMin} unit="min" minVal={0}
            onDec={() => updateBlock(blk.id, { durationMin: Math.max(0, blk.durationMin - 1) })}
            onInc={() => updateBlock(blk.id, { durationMin: blk.durationMin + 1 })}
          />
          {blk.type === 'amrap' && <Text style={S.cardHint}>{t('timer.config.amrapHint')}</Text>}
          {blk.type === 'for-time' && <Text style={S.cardHint}>{t('timer.config.forTimeHint')}</Text>}
        </View>
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
        <View style={S.seqConfigRow}>
          <Text style={S.overline}>{t('timer.config.type')}</Text>
          <View style={S.chipRow}>
            {[1,2,3,4,5].map(iv => (
              <AxChip key={iv} label={iv === 1 ? t('timer.run.type.emom') : t('bo.wods.emomEvery', { n: iv })} selected={blk.emomInterval === iv}
                onPress={() => {
                  // Conserve la durée totale lors du changement d'interval, ajuste les rounds
                  const prevIvSec = isPerso ? customSec : blk.emomInterval * 60;
                  const totalMinPrev = (prevIvSec * blk.emomRounds) / 60;
                  const newRounds = Math.max(1, Math.round(totalMinPrev / iv));
                  updateBlock(blk.id, { emomInterval: iv, emomRounds: newRounds });
                }}
              />
            ))}
            <AxChip label={t('timer.config.emomCustom')} selected={isPerso} onPress={() => updateBlock(blk.id, { emomInterval: 0 })} />
          </View>

          {isPerso && (
            <>
              <Text style={S.overline}>{t('timer.config.customInterval')}</Text>
              <View style={S.stepperPair}>
                <View style={S.flex1}>
                  <Stepper value={customMin} unit="min" minVal={0}
                    onDec={() => updateBlock(blk.id, { emomCustomSec: Math.max(1, customSec - 60) })}
                    onInc={() => updateBlock(blk.id, { emomCustomSec: customSec + 60 })}
                  />
                </View>
                <View style={S.flex1}>
                  <Stepper value={customSs} unit={t('timer.config.unitSec')} minVal={0}
                    onDec={() => updateBlock(blk.id, { emomCustomSec: Math.max(1, customSec % 5 === 0 ? customSec - 5 : Math.floor(customSec / 5) * 5) })}
                    onInc={() => updateBlock(blk.id, { emomCustomSec: customSec % 5 === 0 ? customSec + 5 : Math.ceil(customSec / 5) * 5 })}
                  />
                </View>
              </View>
            </>
          )}

          <Text style={S.overline}>{t('timer.config.rounds')}</Text>
          <Stepper value={blk.emomRounds} unit={t('timer.config.unitRounds')} minVal={1}
            onDec={() => updateBlock(blk.id, { emomRounds: Math.max(1, blk.emomRounds - 1) })}
            onInc={() => updateBlock(blk.id, { emomRounds: blk.emomRounds + 1 })}
          />
          <Text style={S.cardHint}>
            {t('timer.config.emomHint', { total: `${totalMm} min${totalSs ? ` ${totalSs}s` : ''}` })}
          </Text>
        </View>
        );
      })()}
      {blk.type === 'tabata' && (
        <View style={S.seqConfigRow}>
          <Text style={S.overline}>{t('timer.run.work')}</Text>
          <Stepper value={blk.workSec} unit={t('timer.config.unitSec')} minVal={5}
            onDec={() => updateBlock(blk.id, { workSec: Math.max(5, blk.workSec - 5) })}
            onInc={() => updateBlock(blk.id, { workSec: blk.workSec + 5 })}
          />
          <Text style={S.overline}>{t('timer.run.rest')}</Text>
          <Stepper value={blk.restSec} unit={t('timer.config.unitSec')} minVal={5}
            onDec={() => updateBlock(blk.id, { restSec: Math.max(5, blk.restSec - 5) })}
            onInc={() => updateBlock(blk.id, { restSec: blk.restSec + 5 })}
          />
          <Text style={S.overline}>{t('timer.config.rounds')}</Text>
          <Stepper value={blk.tabRounds} unit={t('timer.config.unitRounds')} minVal={1}
            onDec={() => updateBlock(blk.id, { tabRounds: Math.max(1, blk.tabRounds - 1) })}
            onInc={() => updateBlock(blk.id, { tabRounds: blk.tabRounds + 1 })}
          />
          <Text style={S.cardHint}>{t('timer.config.total', { total: `${Math.floor((blk.workSec + blk.restSec) * blk.tabRounds / 60)} min ${((blk.workSec + blk.restSec) * blk.tabRounds) % 60} s` })}</Text>
        </View>
      )}
      {blk.type === 'ywyr' && (
        <Text style={S.cardHint}>{t('timer.config.ywyrHint')}</Text>
      )}
    </>
  );

  const renderBlocks = () => (
    <>
      {seqBlocks.map((blk, idx) => (
        <AxCard key={blk.id}>
          <View style={S.seqCardHeader}>
            <View style={S.seqBlockNum}>
              <Text style={S.seqBlockNumText}>{idx + 1}</Text>
            </View>
            {activeTab === 'libre' ? (
              <View style={[S.chipRow, S.flex1]}>
                {BLOCK_TYPES.map(bt => (
                  <AxChip key={bt.key} label={t(bt.labelKey)} selected={blk.type === bt.key}
                    onPress={() => updateBlock(blk.id, { type: bt.key })} />
                ))}
              </View>
            ) : (
              <View style={S.flex1}>
                <AxTag label={blk.type.toUpperCase().replace('-', ' ')} />
              </View>
            )}
            {seqBlocks.length > 1 && (
              <AxIconButton icon={Trash2} onPress={() => removeBlock(blk.id)}
                accessibilityLabel={t('timer.config.removeBlock', { n: idx + 1 })} />
            )}
          </View>

          {renderBlockConfig(blk)}

          {seqBlocks.length > 1 && (
            <View style={S.seqPauseRow}>
              <View style={S.seqPauseTitle}>
                <Pause color={c.textMuted} size={14} />
                <Text style={S.seqPauseLabel}>{t('timer.config.pauseAfter')}</Text>
              </View>
              <View style={S.chipRow}>
                {[0, 30, 60, 90, 120].map(sec => (
                  <AxChip key={sec} label={sec === 0 ? t('timer.config.pauseNone') : `${sec}s`} selected={blk.pauseSec === sec}
                    onPress={() => updateBlock(blk.id, { pauseSec: sec })} />
                ))}
              </View>
            </View>
          )}
        </AxCard>
      ))}
      <AxButton label={t('timer.config.addBlock')} icon={Plus} variant="dashed" fullWidth onPress={addBlock} />
    </>
  );

  const activeType = TABS.find(t => t.key === activeTab) ?? TABS[0];
  const ActiveIcon = activeType.icon;

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title={t('training.tools.timer')} />

      {/* Liste de sélection */}
      <Modal visible={showTypePicker} transparent animationType="slide" onRequestClose={() => setShowTypePicker(false)}>
        <View style={S.pickerOverlay}>
          <Pressable style={S.pickerBackdrop} onPress={() => setShowTypePicker(false)} testID="timer-type-backdrop" />
          <View style={S.pickerSheet} testID="timer-type-sheet">
            <View style={S.pickerHandle} />
            <Text style={S.pickerTitle}>{t('timer.config.chooseFormat')}</Text>
            {TABS.map(({ key, labelKey, icon: Icon, descKey }) => {
              const active = activeTab === key;
              const label = t(labelKey);
              return (
                <AxCard key={key} testID={`timer-type-option-${key}`} accessibilityLabel={label} style={S.typeSelectorCard}
                  onPress={() => {
                    switchTab(key);
                    setShowTypePicker(false);
                  }}>
                  <Icon color={active ? c.accentText : c.textMuted} size={20} />
                  <View style={S.flex1}>
                    <Text style={[S.typeLabel, active && S.typeLabelActive]}>{label}</Text>
                    <Text style={S.typeDesc}>{t(descKey)}</Text>
                  </View>
                  {active && <Check color={c.accentText} size={18} />}
                </AxCard>
              );
            })}
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={[S.content, { paddingBottom: tabSpace }]} showsVerticalScrollIndicator={false}>
        {/* Sélecteur de type de minuteur */}
        <View style={S.typeSelector}>
          <Text style={S.overline}>{t('timer.config.timerType')}</Text>
          <AxCard onPress={() => setShowTypePicker(true)} accessibilityLabel={t('timer.config.timerTypeA11y', { type: t(activeType.labelKey) })}
            testID="timer-type-selector" style={S.typeSelectorCard}>
            <ActiveIcon color={c.accentText} size={20} />
            <View style={S.flex1}>
              <Text style={S.typeLabel}>{t(activeType.labelKey)}</Text>
              <Text style={S.typeDesc}>{t(activeType.descKey)}</Text>
            </View>
            <ChevronDown color={c.textMuted} size={20} />
          </AxCard>
        </View>

        {activeTab !== 'splits' && (
          <CountdownPicker value={countdown} onChange={setCountdown} />
        )}

        {/* Caméra toggle */}
        <AxCard>
          <View style={S.recOptRow}>
            <Camera color={c.textMuted} size={16} />
            <View style={S.flex1}>
              <Text style={S.recOptLabel}>{t('timer.config.recordWithCamera')}</Text>
              <Text style={S.recOptHint}>{t('timer.config.recordHint')}</Text>
            </View>
            <AxSwitch value={withCamera} onValueChange={setWithCamera}
              accessibilityLabel={t('timer.config.recordWithCamera')} testID="timer-camera-switch" />
          </View>
          {withCamera && (
            <>
              <View style={S.recOptRow}>
                <Type color={c.textMuted} size={16} />
                <View style={S.flex1}>
                  <Text style={S.recOptLabel}>{t('timer.config.videoTitle')}</Text>
                  <AxTextField value={videoTitle} onChangeText={setVideoTitle} compact
                    placeholder={t('timer.config.videoTitlePlaceholder')} maxLength={60} testID="timer-video-title" />
                </View>
              </View>
              <View style={S.recOptRow}>
                <Clock color={c.textMuted} size={16} />
                <View style={S.flex1}>
                  <Text style={S.recOptLabel}>{t('timer.config.timestamp')}</Text>
                  <Text style={S.recOptHint}>{t('timer.config.timestampHint')}</Text>
                </View>
                <AxSwitch value={withTimestamp} onValueChange={setWithTimestamp}
                  accessibilityLabel={t('timer.config.timestamp')} testID="timer-timestamp-switch" />
              </View>
              <View style={S.recOptRow}>
                <Video color={c.textMuted} size={16} />
                <View style={[S.flex1, S.recOptGroup]}>
                  <Text style={S.recOptLabel}>{t('timer.video.fps')}</Text>
                  <View style={S.chipRow}>
                    {VIDEO_FPS.map(f => (
                      <AxChip key={f} label={t('timer.video.fpsValue', { fps: String(f) })} selected={videoOpts.videoFps === f}
                        onPress={() => updateVideo({ videoFps: f })} testID={`timer-fps-${f}`} />
                    ))}
                  </View>
                </View>
              </View>
              <View style={S.recOptRow}>
                <Mic color={c.textMuted} size={16} />
                <View style={S.flex1}>
                  <Text style={S.recOptLabel}>{t('timer.video.mic')}</Text>
                  <Text style={S.recOptHint}>{t('timer.video.micHint')}</Text>
                </View>
                <AxSwitch value={videoOpts.videoMic} onValueChange={(v) => updateVideo({ videoMic: v })}
                  accessibilityLabel={t('timer.video.mic')} testID="timer-mic-switch" />
              </View>
              <View style={S.recOptRow}>
                <Volume2 color={c.textMuted} size={16} />
                <View style={S.flex1}>
                  <Text style={S.recOptLabel}>{t('timer.video.beeps')}</Text>
                  <Text style={S.recOptHint}>{t('timer.video.beepsHint')}</Text>
                </View>
                <AxSwitch value={videoOpts.videoBeeps} onValueChange={(v) => updateVideo({ videoBeeps: v })}
                  accessibilityLabel={t('timer.video.beeps')} testID="timer-video-beeps-switch" />
              </View>
            </>
          )}
        </AxCard>

        {activeTab === 'splits' ? renderSplitsConfig() : renderBlocks()}

        <View style={S.spacer} />
        <AxButton label={t('wodGenerator.start')} variant="accent" icon={withCamera ? Video : Timer} fullWidth onPress={launch}
          testID="timer-start" />
      </ScrollView>
    </View>
  );
}

function createStyles(c: AxColors) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: axSpacing.xl, paddingTop: axSpacing.lg, gap: axSpacing.lg },
  flex1: { flex: 1 },
  spacer: { height: axSpacing.sm },
  overline: { ...axTypography.overline, color: c.textMuted },
  cardHint: { ...axTypography.bodySmall, color: c.textMuted },
  typeSelector: { gap: axSpacing.md },
  typeSelectorCard: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, paddingVertical: axSpacing.md },
  typeLabel: { ...axTypography.label, color: c.text },
  typeLabelActive: { color: c.accentText },
  typeDesc: { ...axTypography.bodySmall, color: c.textMuted },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(c.background, 0.8) },
  pickerSheet: {
    backgroundColor: c.background, borderTopLeftRadius: axRadius.card, borderTopRightRadius: axRadius.card,
    borderWidth: 1, borderColor: c.border, padding: axSpacing.xl, paddingBottom: 40, gap: axSpacing.sm,
  },
  pickerHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border },
  pickerTitle: { ...axTypography.titleM, color: c.text, marginBottom: axSpacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm },
  countdownRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: axSpacing.xs },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperPair: { flexDirection: 'row', gap: axSpacing.md },
  stepperValueBox: { alignItems: 'baseline', flexDirection: 'row', gap: axSpacing.xs },
  stepperValue: { ...axTypography.numberM, color: c.text },
  stepperUnit: { ...axTypography.bodySmall, color: c.textMuted },
  seqCardHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
  seqBlockNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center',
  },
  seqBlockNumText: { ...axTypography.labelSmall, color: c.onAccent },
  seqConfigRow: { gap: axSpacing.sm },
  seqPauseRow: { gap: axSpacing.sm, borderTopWidth: 1, borderTopColor: c.border, paddingTop: axSpacing.md },
  seqPauseTitle: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  seqPauseLabel: { ...axTypography.labelSmall, color: c.textMuted },
  recOptRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
  recOptLabel: { ...axTypography.label, color: c.text },
  recOptHint: { ...axTypography.caption, color: c.textMuted },
  recOptGroup: { gap: axSpacing.sm },
}); }
