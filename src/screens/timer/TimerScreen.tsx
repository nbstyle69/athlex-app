import React, { useEffect, useMemo, useState } from 'react';
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
  DEFAULT_VIDEO_OPTS, VIDEO_FPS, VIDEO_QUALITY_LABELS, loadVideoOpts, offeredQualities, saveVideoOpts, shownQuality, type VideoOpts,
} from '../../lib/timerVideoOpts';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Timer'>;

const TABS: { key: TimerType; label: string; icon: LucideIcon; desc: string }[] = [
  { key: 'for-time',  label: 'FOR TIME',     icon: Timer,        desc: 'Chrono montant avec cap optionnel' },
  { key: 'amrap',     label: 'AMRAP',        icon: RefreshCw,    desc: 'As Many Rounds As Possible' },
  { key: 'emom',      label: 'EMOM',         icon: Radio,        desc: 'Every Minute On the Minute' },
  { key: 'tabata',    label: 'TABATA',       icon: Zap,          desc: 'Intervalles travail / repos' },
  { key: 'ywyr',      label: 'YWYR',         icon: BicepsFlexed, desc: 'Your Work Your Rest' },
  { key: 'splits',    label: 'SPLITS',       icon: Scissors,     desc: 'Rounds chronométrés séparément' },
  { key: 'libre',     label: 'PERSONNALISÉ', icon: Wrench,       desc: 'Séquence de blocs sur mesure' },
];

const BLOCK_TYPES: { key: BlockType; label: string }[] = [
  { key: 'for-time', label: 'FOR TIME' },
  { key: 'amrap',    label: 'AMRAP' },
  { key: 'emom',     label: 'EMOM' },
  { key: 'tabata',   label: 'TABATA' },
  { key: 'ywyr',     label: 'YWYR' },
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
  const { theme } = useTheme();
  const S = createStyles(theme.ax);
  return (
    <View style={S.stepperRow}>
      <AxIconButton icon={Minus} onPress={onDec} disabled={value <= minVal} accessibilityLabel={`Moins (${unit})`} />
      <View style={S.stepperValueBox}>
        <Text style={S.stepperValue}>{value}</Text>
        <Text style={S.stepperUnit}>{unit}</Text>
      </View>
      <AxIconButton icon={Plus} onPress={onInc} accessibilityLabel={`Plus (${unit})`} />
    </View>
  );
}

function CountdownPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { theme } = useTheme();
  const S = createStyles(theme.ax);
  return (
    <AxCard>
      <Text style={S.overline}>COMPTE À REBOURS</Text>
      <View style={S.chipRow}>
        {COUNTDOWN_OPTS.map((v) => (
          <AxChip key={v} label={v === 0 ? '—' : `${v}s`} selected={value === v} onPress={() => onChange(v)} />
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
  const offered = useMemo(offeredQualities, []);
  useEffect(() => { loadVideoOpts().then(setVideoOpts); }, []);
  function updateVideo(update: Partial<VideoOpts>) {
    setVideoOpts(v => ({ ...v, ...update }));
    saveVideoOpts(update).catch(() => {});
  }
  const quality = shownQuality(videoOpts.videoQuality, offered);

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
        <AxTag label="SPLITS" />
      </View>

      <View style={S.seqConfigRow}>
        <Text style={S.overline}>DURÉE PAR ROUND</Text>
        <View style={S.stepperPair}>
          <View style={S.flex1}>
            <Stepper value={splitsMin} unit="min" minVal={0}
              onDec={() => setSplitsMin(v => Math.max(0, v - 1))}
              onInc={() => setSplitsMin(v => Math.min(60, v + 1))}
            />
          </View>
          <View style={S.flex1}>
            <Stepper value={splitsSec} unit="sec" minVal={0}
              onDec={() => setSplitsSec(v => v % 5 === 0 ? Math.max(0, v - 5) : Math.floor(v / 5) * 5)}
              onInc={() => setSplitsSec(v => Math.min(55, v % 5 === 0 ? v + 5 : Math.ceil(v / 5) * 5))}
            />
          </View>
        </View>
        <Text style={S.overline}>ROUNDS</Text>
        <Stepper value={splitsRounds} unit="rounds" minVal={1}
          onDec={() => setSplitsRounds(v => Math.max(1, v - 1))}
          onInc={() => setSplitsRounds(v => v + 1)}
        />
        <Text style={S.cardHint}>Tap entre rounds · Récup libre</Text>
      </View>
    </AxCard>
  );

  const renderBlockConfig = (blk: SeqBlock) => (
    <>
      {(blk.type === 'amrap' || blk.type === 'for-time') && (
        <View style={S.seqConfigRow}>
          <Text style={S.overline}>{blk.type === 'amrap' ? 'DURÉE' : 'CAP MAX (0 = ∞)'}</Text>
          <Stepper value={blk.durationMin} unit="min" minVal={0}
            onDec={() => updateBlock(blk.id, { durationMin: Math.max(0, blk.durationMin - 1) })}
            onInc={() => updateBlock(blk.id, { durationMin: blk.durationMin + 1 })}
          />
          {blk.type === 'amrap' && <Text style={S.cardHint}>Compte à rebours · Bip final</Text>}
          {blk.type === 'for-time' && <Text style={S.cardHint}>Chrono montant · Stoppe avec ■</Text>}
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
          <Text style={S.overline}>TYPE</Text>
          <View style={S.chipRow}>
            {[1,2,3,4,5].map(iv => (
              <AxChip key={iv} label={iv === 1 ? 'EMOM' : `E${iv}MOM`} selected={blk.emomInterval === iv}
                onPress={() => {
                  // Conserve la durée totale lors du changement d'interval, ajuste les rounds
                  const prevIvSec = isPerso ? customSec : blk.emomInterval * 60;
                  const totalMinPrev = (prevIvSec * blk.emomRounds) / 60;
                  const newRounds = Math.max(1, Math.round(totalMinPrev / iv));
                  updateBlock(blk.id, { emomInterval: iv, emomRounds: newRounds });
                }}
              />
            ))}
            <AxChip label="PERSO" selected={isPerso} onPress={() => updateBlock(blk.id, { emomInterval: 0 })} />
          </View>

          {isPerso && (
            <>
              <Text style={S.overline}>INTERVALLE PERSO</Text>
              <View style={S.stepperPair}>
                <View style={S.flex1}>
                  <Stepper value={customMin} unit="min" minVal={0}
                    onDec={() => updateBlock(blk.id, { emomCustomSec: Math.max(1, customSec - 60) })}
                    onInc={() => updateBlock(blk.id, { emomCustomSec: customSec + 60 })}
                  />
                </View>
                <View style={S.flex1}>
                  <Stepper value={customSs} unit="sec" minVal={0}
                    onDec={() => updateBlock(blk.id, { emomCustomSec: Math.max(1, customSec % 5 === 0 ? customSec - 5 : Math.floor(customSec / 5) * 5) })}
                    onInc={() => updateBlock(blk.id, { emomCustomSec: customSec % 5 === 0 ? customSec + 5 : Math.ceil(customSec / 5) * 5 })}
                  />
                </View>
              </View>
            </>
          )}

          <Text style={S.overline}>ROUNDS</Text>
          <Stepper value={blk.emomRounds} unit="rounds" minVal={1}
            onDec={() => updateBlock(blk.id, { emomRounds: Math.max(1, blk.emomRounds - 1) })}
            onInc={() => updateBlock(blk.id, { emomRounds: blk.emomRounds + 1 })}
          />
          <Text style={S.cardHint}>
            Bip au début de chaque interval · Total : {totalMm} min{totalSs ? ` ${totalSs}s` : ''}
          </Text>
        </View>
        );
      })()}
      {blk.type === 'tabata' && (
        <View style={S.seqConfigRow}>
          <Text style={S.overline}>TRAVAIL</Text>
          <Stepper value={blk.workSec} unit="sec" minVal={5}
            onDec={() => updateBlock(blk.id, { workSec: Math.max(5, blk.workSec - 5) })}
            onInc={() => updateBlock(blk.id, { workSec: blk.workSec + 5 })}
          />
          <Text style={S.overline}>REPOS</Text>
          <Stepper value={blk.restSec} unit="sec" minVal={5}
            onDec={() => updateBlock(blk.id, { restSec: Math.max(5, blk.restSec - 5) })}
            onInc={() => updateBlock(blk.id, { restSec: blk.restSec + 5 })}
          />
          <Text style={S.overline}>ROUNDS</Text>
          <Stepper value={blk.tabRounds} unit="rounds" minVal={1}
            onDec={() => updateBlock(blk.id, { tabRounds: Math.max(1, blk.tabRounds - 1) })}
            onInc={() => updateBlock(blk.id, { tabRounds: blk.tabRounds + 1 })}
          />
          <Text style={S.cardHint}>Total : {Math.floor((blk.workSec + blk.restSec) * blk.tabRounds / 60)} min {((blk.workSec + blk.restSec) * blk.tabRounds) % 60} s</Text>
        </View>
      )}
      {blk.type === 'ywyr' && (
        <Text style={S.cardHint}>Chrono libre · appuie sur FIN pour passer au repos</Text>
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
                  <AxChip key={bt.key} label={bt.label} selected={blk.type === bt.key}
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
                accessibilityLabel={`Supprimer le bloc ${idx + 1}`} />
            )}
          </View>

          {renderBlockConfig(blk)}

          {seqBlocks.length > 1 && (
            <View style={S.seqPauseRow}>
              <View style={S.seqPauseTitle}>
                <Pause color={c.textMuted} size={14} />
                <Text style={S.seqPauseLabel}>Pause après</Text>
              </View>
              <View style={S.chipRow}>
                {[0, 30, 60, 90, 120].map(sec => (
                  <AxChip key={sec} label={sec === 0 ? 'Aucune' : `${sec}s`} selected={blk.pauseSec === sec}
                    onPress={() => updateBlock(blk.id, { pauseSec: sec })} />
                ))}
              </View>
            </View>
          )}
        </AxCard>
      ))}
      <AxButton label="Ajouter un bloc" icon={Plus} variant="dashed" fullWidth onPress={addBlock} />
    </>
  );

  const activeType = TABS.find(t => t.key === activeTab) ?? TABS[0];
  const ActiveIcon = activeType.icon;

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title="Minuteur" />

      {/* Liste de sélection */}
      <Modal visible={showTypePicker} transparent animationType="slide" onRequestClose={() => setShowTypePicker(false)}>
        <View style={S.pickerOverlay}>
          <Pressable style={S.pickerBackdrop} onPress={() => setShowTypePicker(false)} testID="timer-type-backdrop" />
          <View style={S.pickerSheet} testID="timer-type-sheet">
            <View style={S.pickerHandle} />
            <Text style={S.pickerTitle}>Choisir un format</Text>
            {TABS.map(({ key, label, icon: Icon, desc }) => {
              const active = activeTab === key;
              return (
                <AxCard key={key} testID={`timer-type-option-${key}`} accessibilityLabel={label} style={S.typeSelectorCard}
                  onPress={() => {
                    switchTab(key);
                    setShowTypePicker(false);
                  }}>
                  <Icon color={active ? c.accentText : c.textMuted} size={20} />
                  <View style={S.flex1}>
                    <Text style={[S.typeLabel, active && S.typeLabelActive]}>{label}</Text>
                    <Text style={S.typeDesc}>{desc}</Text>
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
          <Text style={S.overline}>TYPE DE MINUTEUR</Text>
          <AxCard onPress={() => setShowTypePicker(true)} accessibilityLabel={`Type de minuteur : ${activeType.label}`}
            testID="timer-type-selector" style={S.typeSelectorCard}>
            <ActiveIcon color={c.accentText} size={20} />
            <View style={S.flex1}>
              <Text style={S.typeLabel}>{activeType.label}</Text>
              <Text style={S.typeDesc}>{activeType.desc}</Text>
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
              <Text style={S.recOptLabel}>Enregistrer avec caméra</Text>
              <Text style={S.recOptHint}>Active la vidéo pendant le chrono</Text>
            </View>
            <AxSwitch value={withCamera} onValueChange={setWithCamera}
              accessibilityLabel="Enregistrer avec caméra" testID="timer-camera-switch" />
          </View>
          {withCamera && (
            <>
              <View style={S.recOptRow}>
                <Type color={c.textMuted} size={16} />
                <View style={S.flex1}>
                  <Text style={S.recOptLabel}>Titre</Text>
                  <AxTextField value={videoTitle} onChangeText={setVideoTitle} compact
                    placeholder="Ex: Fran Sprint · Rx · 3 min 12s" maxLength={60} testID="timer-video-title" />
                </View>
              </View>
              <View style={S.recOptRow}>
                <Clock color={c.textMuted} size={16} />
                <View style={S.flex1}>
                  <Text style={S.recOptLabel}>Timestamp</Text>
                  <Text style={S.recOptHint}>Date &amp; heure en overlay</Text>
                </View>
                <AxSwitch value={withTimestamp} onValueChange={setWithTimestamp}
                  accessibilityLabel="Timestamp" testID="timer-timestamp-switch" />
              </View>
              <View style={S.recOptRow}>
                <Video color={c.textMuted} size={16} />
                <View style={[S.flex1, S.recOptGroup]}>
                  <View>
                    <Text style={S.recOptLabel}>{t('timer.video.quality')}</Text>
                    <Text style={S.recOptHint}>{t('timer.video.qualityHint')}</Text>
                  </View>
                  <View style={S.chipRow}>
                    {offered.map(q => (
                      <AxChip key={q} label={VIDEO_QUALITY_LABELS[q]} selected={quality === q}
                        onPress={() => updateVideo({ videoQuality: q })} testID={`timer-quality-${q}`} />
                    ))}
                  </View>
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
        <AxButton label="Démarrer" variant="accent" icon={withCamera ? Video : Timer} fullWidth onPress={launch}
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
