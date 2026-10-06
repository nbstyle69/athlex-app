/**
 * AthleX — « Générateur de WOD » (brief §8)
 * ==========================================
 * Formulaire unique branché sur `packages/wod-engine` (hors ligne, déterministe) :
 * entrée (WOD express / Après ma classe) → discipline → format (express)
 * → intention → gilet (Hybrid) → Exclure (matériel + mouvements, persisté).
 * Troisième carte « Musculation » (PR M2) : objectif → cible (ordre selon le genre)
 * → matériel (persisté) → ligne 1RM.
 * Pas de ligne Catégorie : la catégorie / le niveau du profil servent à l'estimation.
 * Le résultat s'ouvre sur `WodResult`.
 */

import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, Sparkles, X, History, Heart, BookOpen, Zap, GraduationCap, Dumbbell, Flag, BicepsFlexed } from 'lucide-react-native';

import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import GlassBackground from '../../components/glass/GlassBackground';
import { AxButton, AxChip, AxSwitch, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import SessionContextCard from '../../components/wod/SessionContextCard';
import i18n from '../../i18n';
import { useTranslation } from 'react-i18next';
import type {
  Catalog, Discipline, Entry, FormatChoice, Intention, MuscuEquipment, MuscuObjective, MuscuTarget, Vest,
} from '../../../packages/wod-engine/src';
import { availableTargets, muscuLevelFor, feasibleFormats } from '../../../packages/wod-engine/src';
import {
  FORMATS, INTENTIONS, VESTS, avoidedText, equipmentOptions,
} from './wodGeneratorOptions';
import {
  MUSCU_EQUIPMENTS, MUSCU_OBJECTIVES, muscuEquipmentOptions,
  muscuOneRepMax, objectiveDisabled, oneRepMaxLine, targetLabel, targetOrderFor, targetOrderHint,
} from './muscuOptions';
import { equipmentLabel } from '../../utils/wod/equipmentLabels';
import { searchExclusions } from '../../utils/wod/exclusionSearch';
import { loadWodDraft, saveWodDraft, WodDraft } from '../../services/wodDraft';
import { ResumableMuscuSession, findResumableMuscuSession } from '../../services/muscuSession';
import { captureError } from '../../lib/sentry';
import { loadEngineData } from '../../services/wodEngineData';
import { fetchMyPersonalRecords } from '../../services/myProfile';
import {
  DayClass, ScreenParams, generateForUser, loadExcludes, loadMuscuEquipment, saveExcludes, saveMuscuEquipment, todayClass,
  loadAdaptToPr, saveAdaptToPr,
} from '../../services/wodGenerator';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Sport = Discipline | 'musculation';

export default function WodGeneratorScreen() {
  const { t } = useTranslation();
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, currentBox } = useAuth();
  const { theme } = useTheme();
  const S = createStyles(theme);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [entry, setEntry] = useState<Entry>('express');
  const [sport, setSport] = useState<Sport>('functional');
  const discipline: Discipline = sport === 'hybrid' ? 'hybrid' : 'functional';
  const isMuscu = sport === 'musculation';
  const [target, setTarget] = useState<MuscuTarget>('full_body');
  const [objective, setObjective] = useState<MuscuObjective>('hypertrophie');
  const [muscuEquipment, setMuscuEquipment] = useState<MuscuEquipment>('box');
  const [records, setRecords] = useState<Record<string, unknown>>({});
  const [format, setFormat] = useState<FormatChoice>('surprise');
  const [intention, setIntention] = useState<Intention>('mixed');

  const formatsFaisables = useMemo(
    () => isMuscu ? new Set<FormatChoice>() : feasibleFormats(discipline, intention),
    [discipline, intention, isMuscu],
  );
  useEffect(() => {
    if (!isMuscu && !formatsFaisables.has(format)) setFormat('surprise');
  }, [isMuscu, format, formatsFaisables]);
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
  // Séance Musculation en brouillon sur le serveur (commencée sur un autre appareil).
  const [serverMuscu, setServerMuscu] = useState<ResumableMuscuSession | null>(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (user?.id) {
      findResumableMuscuSession(user.id)
        .then((r) => { if (alive) setServerMuscu(r); })
        .catch((e) => captureError(e, { screen: 'WodGenerator', action: 'findResumableMuscu' }));
    } else setServerMuscu(null);
    return () => { alive = false; };
  }, [user?.id]));

  useEffect(() => {
    let alive = true;
    setAdaptToPr(true);
    setPrPreferenceReady(false);
    loadEngineData().then((d) => { if (alive) setCatalog(d.catalog); });
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

  const chooseEntry = (e: Entry) => { setEntry(e); };
  const chooseSport = (s: Sport) => {
    setSport(s);
    if (s === 'musculation') return;
    setIntention(INTENTIONS[s][0].key);
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
  const targets = useMemo(() => {
    const order = targetOrderFor(user?.gender);
    if (!catalog) return order;
    const ok = new Set(availableTargets(catalog, muscuEquipment, muscuLevel));
    return order.filter((t) => ok.has(t));
  }, [catalog, muscuEquipment, muscuLevel, user?.gender]);
  const effectiveObjective: MuscuObjective =
    objectiveDisabled(objective, entry, target, muscuEquipment) ? 'hypertrophie' : objective;
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
        discipline: 'musculation', entry, target, objective: effectiveObjective,
        equipment: muscuEquipment, exclude,
      }
      : {
        entry, discipline, intention, exclude, adapt_to_pr: adaptToPr,
        format: entry === 'express' ? format : 'surprise',
        vest: discipline === 'hybrid' ? vest : 'none',
      };
    try {
      const result = await generateForUser(user, currentBox?.id, screen);
      await saveWodDraft(user.id, { screen, result });
      navigation.navigate('WodResult', { screen, result });
    } catch (e) {
      Alert.alert(
        isMuscu ? t('training.generate.noValidSessionTitle') : t('training.generate.noValidWodTitle'),
        isMuscu ? t('training.generate.noValidSessionBody') : t('training.generate.noValidWodBody'),
      );
    } finally {
      setGenerating(false);
    }
  }

  const c = theme.ax;
  const accent = c.accentText;
  const Chip = AxChip;

  const ChipScroll = ({ children }: { children: React.ReactNode }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chipScroll} style={S.chipScrollOuter}>
      {children}
    </ScrollView>
  );

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title={t('wodGen.title')}>
          <View style={S.menu}>
            <TouchableOpacity style={S.menuBtn} onPress={() => navigation.navigate('WodHistory')} activeOpacity={0.8} testID="wodgen-menu-history">
              <History color={c.text} size={15} />
              <Text style={S.menuText}>{i18n.t('wodGenerator.history')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.menuBtn} onPress={() => navigation.navigate('WodHistory', { filter: 'favorites' })} activeOpacity={0.8} testID="wodgen-menu-favorites">
              <Heart color={c.danger} size={15} />
              <Text style={S.menuText}>{i18n.t('wodGenerator.favorites')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.menuBtn} onPress={() => navigation.navigate('Home', { screen: 'Programmation' })} activeOpacity={0.8} testID="wodgen-menu-programs">
              <BookOpen color={c.text} size={15} />
              <Text style={S.menuText}>{i18n.t('wodGenerator.programming')}</Text>
            </TouchableOpacity>
          </View>
        <Text style={[S.headerDiscipline, { color: accent }]} testID="wodgen-discipline">
          {t(`training.disciplines.${isMuscu ? 'musculation' : sport === 'hybrid' ? 'hybrid' : 'functional'}`)}
        </Text>
      </AxScreenHeader>

      {/* B3 : le champ de recherche reste au-dessus du clavier (iOS ; Android redimensionne la fenêtre) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[S.content, { paddingBottom: tabSpace }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Entrée */}
        <View style={S.cardRow}>
          {([
            { key: 'express', label: isMuscu ? t('wodGen.entrySession') : t('training.generate.express'), sub: t('wodGen.entryExpressSub'), Icon: Zap },
            { key: 'after_class', label: t('training.generate.afterClass'), sub: t('wodGen.entryAfterClassSub'), Icon: GraduationCap },
          ] as { key: Entry; label: string; sub: string; Icon: typeof Zap }[]).map(({ key, label, sub, Icon }) => (
            <TouchableOpacity
              key={key}
              style={[S.entryCard, entry === key && S.cardSelected]}
              onPress={() => chooseEntry(key)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: entry === key }}
              testID={`wodgen-entry-${key}`}
            >
              <Icon size={20} color={entry === key ? accent : c.textMuted} />
              <Text style={S.entryLabel}>{label}</Text>
              <Text style={S.entrySub}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Discipline */}
        <View style={S.cardRow}>
          {(['functional', 'hybrid', 'musculation'] as Sport[]).map((d) => {
            const selected = sport === d;
            const SportIcon = d === 'musculation' ? BicepsFlexed : d === 'hybrid' ? Flag : Dumbbell;
            return (
              <TouchableOpacity
                key={d}
                style={[S.sportCard, selected && S.cardSelected]}
                onPress={() => chooseSport(d)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`wodgen-discipline-${d}`}
              >
                <View style={S.sportIcon}><SportIcon size={22} color={selected ? accent : c.textMuted} /></View>
                <Text style={[S.sportLabel, selected && { color: accent }]} numberOfLines={1}>
                  {t(`training.disciplines.${d}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* B6 : reprendre la séance générée non enregistrée */}
        {draft && (
          <SessionContextCard
            testID="wodgen-draft"
            label={t('wodGen.lastGenerated')}
            title={draft.result.wod.title}
            action={{
              label: t('wodGen.resumeSession'),
              testID: 'wodgen-draft-resume',
              onPress: () => navigation.navigate('WodResult', { screen: draft.screen, result: draft.result, draft: { performed: draft.performed, submittedScore: draft.submittedScore } }),
            }}
          />
        )}
        {!draft && serverMuscu && (
          <SessionContextCard
            testID="wodgen-server-draft"
            label={t('wodGen.lastGenerated')}
            title={serverMuscu.result.wod.title}
            action={{
              label: t('wodGen.resumeSession'),
              testID: 'wodgen-server-draft-resume',
              onPress: () => navigation.navigate('WodResult', {
                screen: serverMuscu.screen, result: serverMuscu.result, savedId: serverMuscu.savedId,
              }),
            }}
          />
        )}

        {/* Classe du jour (Après ma classe) */}
        {entry === 'after_class' && dayClass && currentBox && (
          <SessionContextCard
            testID="wodgen-class"
            label={t('wodGen.dayClass', { box: currentBox.name })}
            title={dayClass.title}
            subtitle={catalog ? avoidedText(catalog, dayClass.movements) : ''}
          />
        )}

        {isMuscu && (
          <>
            <Section title={t('wodGen.objective')} S={S}>
              <ChipScroll>
                {MUSCU_OBJECTIVES.map((o) => (
                  <Chip
                    key={o.key}
                    label={t(o.labelKey)}
                    selected={effectiveObjective === o.key}
                    disabled={objectiveDisabled(o.key, entry, target, muscuEquipment)}
                    onPress={() => setObjective(o.key)}
                    testID={`wodgen-objective-${o.key}`}
                  />
                ))}
              </ChipScroll>
            </Section>

            <Section title={t('wodGen.target')} S={S}>
              <ChipScroll>
                {targets.map((tg) => (
                  <Chip key={tg} label={targetLabel(tg)} selected={target === tg} onPress={() => setTarget(tg)} testID={`wodgen-target-${tg}`} />
                ))}
              </ChipScroll>
              <Text style={S.hint} testID="wodgen-target-hint">
                {targetHint.text} ·{' '}
                <Text style={[S.hintLink, { color: accent }]} onPress={() => navigation.navigate('Profile', { editLevel: true })}>
                  {targetHint.link}
                </Text>
              </Text>
            </Section>

            <Section title={t('wodGen.equipment')} S={S}>
              <ChipScroll>
                {MUSCU_EQUIPMENTS.map((e) => (
                  <Chip key={e.key} label={t(e.labelKey)} selected={muscuEquipment === e.key} onPress={() => chooseMuscuEquipment(e.key)} testID={`wodgen-equipment-${e.key}`} />
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

        {!isMuscu && entry === 'express' && (
          <Section title={t('wodGenerator.format')} S={S}>
            <ChipScroll>
              {FORMATS.filter((f) => formatsFaisables.has(f.key)).map((f) => (
                <Chip key={f.key} label={t(f.labelKey)} selected={format === f.key} onPress={() => setFormat(f.key)} testID={`wodgen-format-${f.key}`} />
              ))}
            </ChipScroll>
          </Section>
        )}

        {!isMuscu && (
        <Section title={t('wodGenerator.intention')} S={S}>
          <ChipScroll>
            {INTENTIONS[discipline].map((i) => (
              <Chip key={i.key} label={t(i.labelKey)} selected={intention === i.key} onPress={() => setIntention(i.key)} />
            ))}
          </ChipScroll>
        </Section>
        )}

        {sport === 'hybrid' && (
          <Section title={t('wodGenerator.vest')} S={S}>
            <ChipScroll>
              {VESTS.map((v) => (
                <Chip key={v.key} label={t(v.labelKey)} selected={vest === v.key} onPress={() => setVest(v.key)} />
              ))}
            </ChipScroll>
          </Section>
        )}

        {/* Options avancées */}
        <TouchableOpacity style={S.advToggle} onPress={() => setAdvanced((v) => !v)} activeOpacity={0.8} testID="wodgen-advanced">
          <Text style={S.advToggleText}>{t('wodGen.advanced')}{exclude.length ? t('wodGen.excludedCount', { count: exclude.length }) : ''}</Text>
          {advanced ? <ChevronUp size={18} color={c.textMuted} /> : <ChevronDown size={18} color={c.textMuted} />}
        </TouchableOpacity>
        {advanced && (
          <View style={S.advBox}>
            {!isMuscu && (
              <View style={S.prOption}>
                <View style={{ flex: 1 }}>
                  <Text style={S.advLabel}>{t('wodGen.adaptToPr')}</Text>
                  <Text style={S.hint}>
                    {adaptToPr ? t('wodGen.adaptOn') : t('wodGen.adaptOff')}
                  </Text>
                </View>
                <AxSwitch
                  value={adaptToPr}
                  onValueChange={chooseAdaptToPr}
                  disabled={!prPreferenceReady}
                  accessibilityLabel={t('wodGen.adaptToPr')}
                  testID="wodgen-adapt-pr"
                />
              </View>
            )}
            <Text style={S.advLabel}>{t('wodGen.exclude')}</Text>
            {!catalog ? <ActivityIndicator color={accent} /> : (
              <ChipScroll>
                {excludedMovements.map((m) => (
                  <TouchableOpacity key={m.id} style={S.exclChip} onPress={() => toggleExclude(m.id)} activeOpacity={0.8}>
                    <Text style={S.exclChipText}>{m.name}</Text>
                    <X size={12} color={c.danger} />
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
                    {exclude.includes(e) && <X size={12} color={c.danger} />}
                  </TouchableOpacity>
                ))}
              </ChipScroll>
            )}
            <View style={S.input}>
              <AxTextField
                placeholder={t('wodGen.excludePlaceholder')}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                testID="wodgen-exclude-search"
              />
            </View>
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

        <View style={S.generateCard}>
          <AxButton
            variant="accent"
            icon={Sparkles}
            label={entry === 'express' ? (isMuscu ? t('training.generate.title') : t('training.generate.button')) : t('wodGen.generateComplement')}
            onPress={generate}
            loading={generating}
            disabled={!user || (!isMuscu && !prPreferenceReady)}
            fullWidth
            testID="wodgen-generate"
          />
        </View>
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

function createStyles(theme: AppTheme) { const c = theme.ax; return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: { paddingHorizontal: axSpacing.xl, paddingBottom: axSpacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...axTypography.titleM, color: c.text, marginTop: axSpacing.md, textAlign: 'center' },
  headerDiscipline: { ...axTypography.label, textAlign: 'center', marginTop: 2 },
  menu: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingHorizontal: axSpacing.xl },
  menuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: axRadius.control, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  menuText: { ...axTypography.labelSmall, color: c.text },
  content: { paddingHorizontal: axSpacing.xl, paddingTop: axSpacing.lg },

  cardRow: { flexDirection: 'row', gap: 10, marginBottom: axSpacing.lg },
  entryCard: {
    flex: 1, minWidth: 0, borderRadius: axRadius.card, padding: 14, gap: axSpacing.xs,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  cardSelected: { borderColor: c.accentText, borderWidth: 1.5 },
  entryLabel: { ...axTypography.label, color: c.text, marginTop: axSpacing.xs },
  entrySub: { ...axTypography.bodySmall, color: c.textMuted },
  sportCard: {
    flex: 1, minWidth: 0, borderRadius: axRadius.card, paddingVertical: axSpacing.md, paddingHorizontal: axSpacing.xs,
    alignItems: 'center', gap: axSpacing.xs, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  sportIcon: { height: 30, justifyContent: 'center' },
  sportLabel: { ...axTypography.label, color: c.text },
  hint: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
  hintLink: { ...axTypography.labelSmall },
  prOption: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, marginBottom: axSpacing.lg },

  section: { marginBottom: 18 },
  sectionTitle: { ...axTypography.overline, color: c.textMuted, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm, marginTop: axSpacing.sm },
  chipScrollOuter: { flexGrow: 0, flexShrink: 0, marginHorizontal: -axSpacing.xl, marginBottom: axSpacing.sm },
  chipScroll: { flexDirection: 'row', gap: axSpacing.sm, paddingHorizontal: axSpacing.xl },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: axRadius.control,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  chipText: { ...axTypography.label, color: c.text },
  exclChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: axSpacing.md, paddingVertical: 9, borderRadius: axRadius.control,
    borderWidth: 1, borderColor: c.danger, backgroundColor: c.surface,
  },
  exclChipText: { ...axTypography.label, color: c.text },

  advToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: axSpacing.lg, borderRadius: axRadius.card,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  advToggleText: { ...axTypography.label, color: c.text, flexShrink: 1 },
  advBox: {
    marginTop: axSpacing.md, padding: axSpacing.lg, borderRadius: axRadius.card,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  advLabel: { ...axTypography.overline, color: c.textMuted, marginBottom: 10 },
  input: { marginTop: 6 },

  generateCard: { marginTop: axSpacing['2xl'] },
}); }
