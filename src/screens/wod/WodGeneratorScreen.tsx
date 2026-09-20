/**
 * AthleX — « Générateur de WOD » (brief §8)
 * ==========================================
 * Formulaire unique branché sur `packages/wod-engine` (hors ligne, déterministe) :
 * entrée (WOD express / Après ma classe) → discipline → durée → format (express)
 * → intention → gilet (Hybrid) → Exclure (matériel + mouvements, persisté).
 * Troisième carte « Musculation » (PR M2) : objectif → cible (ordre selon le genre)
 * → durée filtrée par `availableDurations` → matériel (persisté) → ligne 1RM.
 * Pas de ligne Catégorie : la catégorie / le niveau du profil servent à l'estimation.
 * Le résultat s'ouvre sur `WodResult`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronDown, ChevronUp, Sparkles, X, History, Heart, BookOpen, Zap, GraduationCap, Dumbbell,
} from 'lucide-react-native';

import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import GlassBackground from '../../components/glass/GlassBackground';
import GlassCard from '../../components/glass/GlassCard';
import i18n from '../../i18n';
import type {
  Catalog, Discipline, Entry, FormatChoice, Intention, MuscuEquipment, MuscuObjective, MuscuTarget, SkeletonBank, Vest,
} from '../../../packages/wod-engine/src';
import { availableDurations, availableTargets, muscuLevelFor } from '../../../packages/wod-engine/src';
import { formatsOfferedFor, feasibleFormats, feasibleDurations } from '../../../packages/wod-engine/src';
import {
  HYBRID_ORANGE, DURATIONS, FORMATS, INTENTIONS, VESTS, avoidedText, equipmentOptions, coerceDuration,
} from './wodGeneratorOptions';
import {
  MUSCU_BLUE, MUSCU_EQUIPMENTS, MUSCU_OBJECTIVES, candidateDurations, coerceMuscuDuration, muscuEquipmentOptions,
  muscuOneRepMax, objectiveDisabled, oneRepMaxLine, targetLabel, targetOrderFor, targetOrderHint,
} from './muscuOptions';
import { readBodyweightKg } from '../profile/prStorage';
import { equipmentLabel } from '../../utils/wod/equipmentLabels';
import { searchExclusions } from '../../utils/wod/exclusionSearch';
import { loadWodDraft, saveWodDraft, WodDraft } from '../../services/wodDraft';
import { loadEngineData } from '../../services/wodEngineData';
import { fetchMyPersonalRecords } from '../../services/myProfile';
import {
  DayClass, ScreenParams, generateForUser, loadExcludes, loadMuscuEquipment, saveExcludes, saveMuscuEquipment, todayClass,
  loadAdaptToPr, saveAdaptToPr,
} from '../../services/wodGenerator';

type Sport = Discipline | 'musculation';

export default function WodGeneratorScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, currentBox } = useAuth();
  const { theme } = useTheme();
  const S = createStyles(theme);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [bank, setBank] = useState<SkeletonBank | null>(null);
  const [entry, setEntry] = useState<Entry>('express');
  const [sport, setSport] = useState<Sport>('functional');
  const discipline: Discipline = sport === 'hybrid' ? 'hybrid' : 'functional';
  const isMuscu = sport === 'musculation';
  const [target, setTarget] = useState<MuscuTarget>('full_body');
  const [objective, setObjective] = useState<MuscuObjective>('hypertrophie');
  const [muscuEquipment, setMuscuEquipment] = useState<MuscuEquipment>('box');
  const [muscuDuration, setMuscuDuration] = useState(30);
  const [records, setRecords] = useState<Record<string, unknown>>({});
  const [duration, setDuration] = useState(15);
  const [format, setFormat] = useState<FormatChoice>('surprise');
  const [intention, setIntention] = useState<Intention>('mixed');

  // G1 / G4 : l'écran ne propose que ce que la banque sait servir. Les formats
  // absents de la discipline (Hybrid n'a ni EMOM ni Chipper) disparaissent ;
  // une combinaison durée × format × intention qu'aucun squelette n'aboutit
  // est grisée — jamais choisie puis remplacée en silence. Tout vient de la
  // table de faisabilité générée depuis la banque, rien n'est écrit en dur.
  const formatsOffered = isMuscu ? [] : formatsOfferedFor(discipline);
  const formatsFaisables = isMuscu ? new Set<FormatChoice>() : feasibleFormats(discipline, duration, intention);
  const dureesFaisables = isMuscu ? new Set<number>() : feasibleDurations(discipline, intention, entry === 'express' ? format : 'surprise');
  useEffect(() => {
    if (!isMuscu && !formatsOffered.includes(format)) setFormat('surprise');
  }, [discipline, isMuscu, format, formatsOffered]);
  const [vest, setVest] = useState<Vest>('none');
  const [exclude, setExclude] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [adaptToPr, setAdaptToPr] = useState(true);
  const [prPreferenceReady, setPrPreferenceReady] = useState(false);
  const [search, setSearch] = useState('');
  const [dayClass, setDayClass] = useState<DayClass | null>(null);
  const [generating, setGenerating] = useState(false);
  // B6 : brouillon de la dernière séance générée, relu à chaque retour sur l'écran
  const [draft, setDraft] = useState<WodDraft | null>(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (user?.id) loadWodDraft(user.id).then((d) => { if (alive) setDraft(d); }); else setDraft(null);
    return () => { alive = false; };
  }, [user?.id]));

  useEffect(() => {
    let alive = true;
    setAdaptToPr(true);
    setPrPreferenceReady(false);
    loadEngineData().then((d) => { if (alive) { setCatalog(d.catalog); setBank(d.bank); } });
    if (user?.id) {
      loadAdaptToPr(user.id).then((enabled) => {
        if (alive) { setAdaptToPr(enabled); setPrPreferenceReady(true); }
      });
      loadExcludes(user.id).then((ex) => { if (alive) setExclude(ex); });
      loadMuscuEquipment(user.id).then((eq) => { if (alive) setMuscuEquipment(eq); });
      fetchMyPersonalRecords().then((r) => { if (alive) setRecords(r); }).catch(() => {});
    } else setPrPreferenceReady(true);
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!isMuscu) return;
    setTarget(targetOrderFor(user?.gender)[0]);
  }, [isMuscu, user?.gender]);

  useEffect(() => {
    let alive = true;
    if (entry === 'after_class') todayClass(currentBox?.id).then((c) => { if (alive) setDayClass(c); });
    return () => { alive = false; };
  }, [entry, currentBox?.id]);

  const chooseEntry = (e: Entry) => { setEntry(e); setDuration((d) => coerceDuration(e, discipline, d)); };
  const chooseSport = (s: Sport) => {
    setSport(s);
    if (s === 'musculation') return;
    setIntention(INTENTIONS[s][0].key);
    setDuration((cur) => coerceDuration(entry, s, cur));
    if (s === 'functional') setVest('none');
  };
  const chooseMuscuEquipment = (eq: MuscuEquipment) => {
    setMuscuEquipment(eq);
    if (user?.id) saveMuscuEquipment(user.id, eq);
  };
  const chooseAdaptToPr = (enabled: boolean) => {
    setAdaptToPr(enabled);
    if (user?.id) saveAdaptToPr(user.id, enabled);
  };

  const muscuLevel = muscuLevelFor(user?.level ?? null);
  const oneRepMax = useMemo(() => muscuOneRepMax(records), [records]);
  const bodyweightKg = useMemo(() => readBodyweightKg(records), [records]);
  const targets = useMemo(() => {
    const order = targetOrderFor(user?.gender);
    if (!catalog) return order;
    const ok = new Set(availableTargets(catalog, muscuEquipment, muscuLevel));
    return order.filter((t) => ok.has(t));
  }, [catalog, muscuEquipment, muscuLevel, user?.gender]);
  const effectiveObjective: MuscuObjective =
    objectiveDisabled(objective, entry, target, muscuEquipment) ? 'hypertrophie' : objective;
  const muscuDurations = useMemo(() => {
    const candidates = candidateDurations(entry, target);
    if (!catalog || !bank || !isMuscu) return candidates;
    return availableDurations(catalog, bank, {
      entry, target, objective: effectiveObjective, equipment: muscuEquipment, level: muscuLevel, exclude,
      one_rep_max: oneRepMax, bodyweight_kg: bodyweightKg,
    });
  }, [catalog, bank, isMuscu, entry, target, effectiveObjective, muscuEquipment, muscuLevel, exclude, oneRepMax, bodyweightKg]);
  useEffect(() => { setMuscuDuration((cur) => coerceMuscuDuration(muscuDurations, cur)); }, [muscuDurations]);
  useEffect(() => { if (targets.length && !targets.includes(target)) setTarget(targets[0]); }, [targets, target]);
  const rmLine = oneRepMaxLine(oneRepMax);
  const targetHint = targetOrderHint(user?.gender);

  const toggleExclude = useCallback((key: string) => {
    setExclude((prev) => {
      const next = prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key];
      if (user?.id) saveExcludes(user.id, next);
      return next;
    });
  }, [user?.id]);

  const equipment = useMemo(
    () => (catalog ? (isMuscu ? muscuEquipmentOptions(catalog, muscuEquipment) : equipmentOptions(catalog)) : []),
    [catalog, isMuscu, muscuEquipment],
  );
  const exclusionHits = useMemo(
    () => catalog ? searchExclusions(catalog, equipment, search, exclude, isMuscu) : [],
    [catalog, equipment, search, exclude, isMuscu],
  );
  const excludedMovements = useMemo(
    () => exclude.filter((k) => !equipment.includes(k)).map((id) => ({ id, name: catalog?.movements.find((m) => m.id === id)?.name ?? equipmentLabel(id) })),
    [exclude, equipment, catalog],
  );

  async function generate() {
    if (!user || (!isMuscu && !prPreferenceReady)) return;
    setGenerating(true);
    const screen: ScreenParams = isMuscu
      ? {
        discipline: 'musculation', entry, target, objective: effectiveObjective, budget_min: muscuDuration,
        equipment: muscuEquipment, exclude,
      }
      : {
        entry, discipline, budget_min: duration, intention, exclude, adapt_to_pr: adaptToPr,
        format: entry === 'express' ? format : 'surprise',
        vest: discipline === 'hybrid' ? vest : 'none',
      };
    try {
      const result = await generateForUser(user, currentBox?.id, screen);
      await saveWodDraft(user.id, { screen, result });
      navigation.navigate('WodResult', { screen, result });
    } catch (e) {
      Alert.alert(
        isMuscu ? 'Aucune séance valide' : 'Aucun WOD valide',
        isMuscu ? 'Essaie une autre durée, une autre cible ou moins d\'exclusions.' : 'Essaie une autre durée, un autre format ou moins d\'exclusions.',
      );
    } finally {
      setGenerating(false);
    }
  }

  const accent = isMuscu ? MUSCU_BLUE : discipline === 'hybrid' ? HYBRID_ORANGE : theme.accent;

  const Chip = ({ label, selected, onPress, disabled, testID }: {
    label: string; selected: boolean; onPress: () => void; disabled?: boolean; testID?: string;
  }) => (
    <TouchableOpacity
      style={[S.chip, selected && { backgroundColor: `${accent}25`, borderColor: accent }, disabled && S.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      testID={testID}
    >
      <Text style={[S.chipText, selected && { fontWeight: '800' }, disabled && S.chipTextDisabled]}>{label}</Text>
    </TouchableOpacity>
  );

  const ChipScroll = ({ children }: { children: React.ReactNode }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chipScroll} style={S.chipScrollOuter}>
      {children}
    </ScrollView>
  );

  return (
    <View style={S.container}>
      <GlassBackground />
      <View style={[S.header, { paddingTop: insets.top + 12 }]}>
        <View style={S.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronLeft color={theme.textSecondary} size={24} />
          </TouchableOpacity>
          <View style={S.menu}>
            <TouchableOpacity style={S.menuBtn} onPress={() => navigation.navigate('WodHistory')} activeOpacity={0.8} testID="wodgen-menu-history">
              <History color={theme.text} size={15} />
              <Text style={S.menuText}>{i18n.t('wodGenerator.history')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.menuBtn} onPress={() => navigation.navigate('WodHistory', { filter: 'favorites' })} activeOpacity={0.8} testID="wodgen-menu-favorites">
              <Heart color={theme.error} size={15} />
              <Text style={S.menuText}>{i18n.t('wodGenerator.favorites')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.menuBtn} onPress={() => navigation.navigate('Explorer', { screen: 'Programmation' })} activeOpacity={0.8} testID="wodgen-menu-programs">
              <BookOpen color={theme.text} size={15} />
              <Text style={S.menuText}>{i18n.t('wodGenerator.programming')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* B1 : deux lignes centrées, la discipline toujours nommée — Functional comme les autres */}
        <Text style={S.headerTitle}>Générateur de WOD</Text>
        <Text style={[S.headerDiscipline, { color: accent }]} testID="wodgen-discipline">
          {isMuscu ? 'Musculation' : sport === 'hybrid' ? 'Hybrid' : 'Functional'}
        </Text>
      </View>

      {/* B3 : le champ de recherche reste au-dessus du clavier (iOS ; Android redimensionne la fenêtre) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Entrée */}
        <View style={S.cardRow}>
          {([
            { key: 'express', label: isMuscu ? 'Séance' : 'WOD express', sub: 'Une séance complète', Icon: Zap },
            { key: 'after_class', label: 'Après ma classe', sub: 'Un complément', Icon: GraduationCap },
          ] as { key: Entry; label: string; sub: string; Icon: typeof Zap }[]).map(({ key, label, sub, Icon }) => (
            <TouchableOpacity
              key={key}
              style={[S.entryCard, entry === key && { borderColor: accent, backgroundColor: `${accent}10` }]}
              onPress={() => chooseEntry(key)}
              activeOpacity={0.85}
              testID={`wodgen-entry-${key}`}
            >
              <Icon size={20} color={entry === key ? accent : theme.textSecondary} />
              <Text style={S.entryLabel}>{label}</Text>
              <Text style={S.entrySub}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Discipline */}
        <View style={S.cardRow}>
          {(['functional', 'hybrid', 'musculation'] as Sport[]).map((d) => {
            const color = d === 'hybrid' ? HYBRID_ORANGE : d === 'musculation' ? MUSCU_BLUE : theme.accent;
            const selected = sport === d;
            return (
              <TouchableOpacity
                key={d}
                style={[S.sportCard, selected && { borderColor: color, backgroundColor: `${color}10` }]}
                onPress={() => chooseSport(d)}
                activeOpacity={0.85}
                testID={`wodgen-discipline-${d}`}
              >
                {d === 'musculation'
                  ? <View style={S.sportIcon}><Dumbbell size={22} color={selected ? MUSCU_BLUE : theme.textSecondary} /></View>
                  : <Text style={S.sportEmoji}>{d === 'functional' ? '🏋️' : '🏁'}</Text>}
                <Text style={[S.sportLabel, selected && { color }]}>
                  {d === 'functional' ? 'Functional' : d === 'hybrid' ? 'Hybrid' : 'Musculation'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* B6 : reprendre la séance générée non enregistrée */}
        {draft && (
          <GlassCard radius={14} style={S.classCard} testID="wodgen-draft">
            <Text style={S.classTitle}>Dernière séance générée</Text>
            <Text style={S.classWod}>{draft.result.wod.title}</Text>
            <TouchableOpacity
              style={[S.chip, { alignSelf: 'flex-start', marginTop: 10 }]}
              onPress={() => navigation.navigate('WodResult', { screen: draft.screen, result: draft.result, draft: { performed: draft.performed, submittedScore: draft.submittedScore } })}
              activeOpacity={0.8}
              testID="wodgen-draft-resume"
            >
              <Text style={S.chipText}>Reprendre la séance</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* Classe du jour (Après ma classe) */}
        {entry === 'after_class' && dayClass && currentBox && (
          <GlassCard radius={14} style={S.classCard}>
            <Text style={S.classTitle}>Classe du jour · {currentBox.name}</Text>
            <Text style={S.classWod}>{dayClass.title}</Text>
            <Text style={S.classSub}>{catalog ? avoidedText(catalog, dayClass.movements) : ''}</Text>
          </GlassCard>
        )}

        {isMuscu && (
          <>
            <Section title="Objectif" S={S}>
              <ChipScroll>
                {MUSCU_OBJECTIVES.map((o) => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    selected={effectiveObjective === o.key}
                    disabled={objectiveDisabled(o.key, entry, target, muscuEquipment)}
                    onPress={() => setObjective(o.key)}
                    testID={`wodgen-objective-${o.key}`}
                  />
                ))}
              </ChipScroll>
            </Section>

            <Section title="Cible" S={S}>
              <ChipScroll>
                {targets.map((t) => (
                  <Chip key={t} label={targetLabel(t)} selected={target === t} onPress={() => setTarget(t)} testID={`wodgen-target-${t}`} />
                ))}
              </ChipScroll>
              <Text style={S.hint} testID="wodgen-target-hint">
                {targetHint.text} ·{' '}
                <Text style={[S.hintLink, { color: accent }]} onPress={() => navigation.navigate('Profile', { editLevel: true })}>
                  {targetHint.link}
                </Text>
              </Text>
            </Section>

            <Section title="Durée" S={S}>
              <ChipScroll>
                {(muscuDurations.length ? muscuDurations : candidateDurations(entry, target)).map((d) => (
                  <Chip key={d} label={`${d} min`} selected={muscuDuration === d} onPress={() => setMuscuDuration(d)} testID={`wodgen-muscu-duration-${d}`} />
                ))}
              </ChipScroll>
            </Section>

            <Section title="Matériel" S={S}>
              <ChipScroll>
                {MUSCU_EQUIPMENTS.map((e) => (
                  <Chip key={e.key} label={e.label} selected={muscuEquipment === e.key} onPress={() => chooseMuscuEquipment(e.key)} testID={`wodgen-equipment-${e.key}`} />
                ))}
              </ChipScroll>
              <Text style={S.hint} testID="wodgen-rm-line">
                {rmLine.text} ·{' '}
                <Text
                  style={[S.hintLink, { color: accent }]}
                  onPress={() => navigation.navigate(rmLine.known ? 'Profile' : 'OneRMCalculator')}
                >
                  {rmLine.link}
                </Text>
              </Text>
            </Section>
          </>
        )}

        {!isMuscu && (
        <Section title="Durée" S={S}>
          <ChipScroll>
            {DURATIONS[entry][discipline].map((d) => (
              <Chip key={d} label={`${d} min`} selected={duration === d} onPress={() => setDuration(d)} disabled={!dureesFaisables.has(d)} testID={`wodgen-duration-${d}`} />
            ))}
          </ChipScroll>
        </Section>
        )}

        {!isMuscu && entry === 'express' && (
          <Section title="Format" S={S}>
            <ChipScroll>
              {FORMATS.filter((f) => formatsOffered.includes(f.key)).map((f) => (
                <Chip key={f.key} label={f.label} selected={format === f.key} onPress={() => setFormat(f.key)} disabled={!formatsFaisables.has(f.key)} testID={`wodgen-format-${f.key}`} />
              ))}
            </ChipScroll>
          </Section>
        )}

        {!isMuscu && (
        <Section title="Intention" S={S}>
          <ChipScroll>
            {INTENTIONS[discipline].map((i) => (
              <Chip key={i.key} label={i.label} selected={intention === i.key} onPress={() => setIntention(i.key)} />
            ))}
          </ChipScroll>
        </Section>
        )}

        {sport === 'hybrid' && (
          <Section title="Gilet lesté" S={S}>
            <ChipScroll>
              {VESTS.map((v) => (
                <Chip key={v.key} label={v.label} selected={vest === v.key} onPress={() => setVest(v.key)} />
              ))}
            </ChipScroll>
          </Section>
        )}

        {/* Options avancées */}
        <TouchableOpacity style={S.advToggle} onPress={() => setAdvanced((v) => !v)} activeOpacity={0.8} testID="wodgen-advanced">
          <Text style={S.advToggleText}>Options avancées{exclude.length ? ` · ${exclude.length} exclu${exclude.length > 1 ? 's' : ''}` : ''}</Text>
          {advanced ? <ChevronUp size={18} color={theme.textSecondary} /> : <ChevronDown size={18} color={theme.textSecondary} />}
        </TouchableOpacity>
        {advanced && (
          <View style={S.advBox}>
            {!isMuscu && (
              <View style={S.prOption}>
                <View style={{ flex: 1 }}>
                  <Text style={S.advLabel}>Adapter à mes PR</Text>
                  <Text style={S.hint}>
                    {adaptToPr ? 'Gym : substitutions et 50 % du record par série.' : 'Mode challenge : catégorie seule, sans adaptation aux PR gym.'}
                  </Text>
                </View>
                <Switch
                  value={adaptToPr}
                  onValueChange={chooseAdaptToPr}
                  disabled={!prPreferenceReady}
                  accessibilityLabel="Adapter à mes PR"
                  trackColor={{ false: theme.border, true: accent }}
                  testID="wodgen-adapt-pr"
                />
              </View>
            )}
            <Text style={S.advLabel}>Exclure</Text>
            {!catalog ? <ActivityIndicator color={accent} /> : (
              <ChipScroll>
                {excludedMovements.map((m) => (
                  <TouchableOpacity key={m.id} style={S.exclChip} onPress={() => toggleExclude(m.id)} activeOpacity={0.8}>
                    <Text style={S.exclChipText}>{m.name}</Text>
                    <X size={12} color={theme.error} />
                  </TouchableOpacity>
                ))}
                {equipment.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[S.chip, exclude.includes(e) && S.exclChip]}
                    onPress={() => toggleExclude(e)}
                    activeOpacity={0.8}
                  >
                    <Text style={[S.chipText, exclude.includes(e) && S.exclChipText]}>{equipmentLabel(e)}</Text>
                    {exclude.includes(e) && <X size={12} color={theme.error} />}
                  </TouchableOpacity>
                ))}
              </ChipScroll>
            )}
            <TextInput
              style={S.input}
              placeholder="Exclure du matériel ou un mouvement…"
              placeholderTextColor={theme.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              testID="wodgen-exclude-search"
            />
            {exclusionHits.length > 0 && (
              <View style={S.chipRow}>
                {exclusionHits.map((m) => (
                  <TouchableOpacity key={`${m.kind}-${m.id}`} style={S.chip} onPress={() => { toggleExclude(m.id); setSearch(''); }} activeOpacity={0.8} testID={`wodgen-exclude-${m.kind}-${m.id}`}>
                    <Text style={S.chipText}>+ {m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <GlassCard radius={16} variant={sport === 'functional' ? 'emerald' : 'default'} style={S.generateCard}>
          <TouchableOpacity
            style={[S.generateBtn, { borderColor: accent, backgroundColor: `${accent}1A` }]}
            onPress={generate}
            disabled={generating || !user || (!isMuscu && !prPreferenceReady)}
            activeOpacity={0.9}
            testID="wodgen-generate"
          >
            {generating ? <ActivityIndicator color={accent} /> : <Sparkles size={18} color={accent} />}
            <Text style={S.generateText}>
              {entry === 'express' ? (isMuscu ? 'Générer ma séance' : 'Générer mon WOD') : 'Générer mon complément'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Section({ title, children, S }: { title: string; children: React.ReactNode; S: ReturnType<typeof createStyles> }) {
  return (
    <View style={S.section}>
      <Text style={S.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function createStyles(theme: AppTheme) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: theme.text, marginTop: 12, textAlign: 'center' },
  headerDiscipline: { fontSize: 15, fontWeight: '800', letterSpacing: 0.4, textAlign: 'center', marginTop: 2 },
  menu: { flexDirection: 'row', gap: 6 },
  menuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
  },
  menuText: { fontSize: 12, fontWeight: '700', color: theme.text },
  content: { padding: 16 },

  cardRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  entryCard: {
    flex: 1, borderRadius: 16, padding: 14, gap: 4,
    backgroundColor: theme.card, borderWidth: 2, borderColor: theme.border,
  },
  entryLabel: { fontSize: 14, fontWeight: '800', color: theme.text, marginTop: 4 },
  entrySub: { fontSize: 11, color: theme.textMuted },
  sportCard: {
    flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4,
    backgroundColor: theme.card, borderWidth: 2, borderColor: theme.border,
  },
  sportEmoji: { fontSize: 22 },
  sportIcon: { height: 30, justifyContent: 'center' },
  sportLabel: { fontSize: 13, fontWeight: '800', color: theme.textSecondary },
  hint: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  hintLink: { fontWeight: '800' },
  prOption: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },

  // B2 : mêmes marges et corps que les cartes de la page résultat, hauteur libre, rien de tronqué
  classCard: { padding: 16, marginBottom: 16 },
  classTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textSecondary },
  classWod: { fontSize: 16, fontWeight: '800', color: theme.text, marginTop: 6, lineHeight: 22 },
  classSub: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 19 },

  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.textSecondary, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chipScrollOuter: { marginHorizontal: -16, marginBottom: 8 },
  chipScroll: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
  },
  chipText: { fontSize: 13, color: theme.text, fontWeight: '600' },
  chipDisabled: { opacity: 0.4 },
  chipTextDisabled: { color: theme.textMuted },
  exclChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: theme.error, backgroundColor: `${theme.error}12`,
  },
  exclChipText: { fontSize: 13, fontWeight: '700', color: theme.text },

  advToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
  },
  advToggleText: { fontSize: 14, fontWeight: '800', color: theme.text },
  advBox: {
    marginTop: 12, padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
  },
  advLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textSecondary, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: theme.text, fontSize: 14, marginTop: 6,
  },

  generateCard: { marginTop: 24, overflow: 'hidden' },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 16, borderWidth: 1, padding: 18,
  },
  generateText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.6, color: theme.text },
}); }
