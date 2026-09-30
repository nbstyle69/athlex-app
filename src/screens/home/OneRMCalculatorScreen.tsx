import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, Dumbbell } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlassBackground from '../../components/glass/GlassBackground';
import { AxCard, AxChip, AxSwitch, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { readableInk } from './homeLevelColor';
import { prKey, readPr } from '../profile/prStorage';
import { fetchMyPersonalRecords } from '../../services/myProfile';
import { GYM_PR_MOVEMENTS, GYM_ZONES, gymRepsAt } from './gymZones';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

const STORAGE_KEY = '@athlex:1rm_calc';

const PR_MOVEMENTS = [
  'Back Squat', 'Front Squat', 'Deadlift', 'Bench Press',
  'Strict Press', 'Push Press', 'Push Jerk', 'Split Jerk',
  'Squat Clean', 'Power Clean', 'Hang Power Clean', 'Hang Squat Clean',
  'Squat Snatch', 'Power Snatch', 'Hang Power Snatch', 'Hang Squat Snatch',
  'Clean & Jerk', 'Overhead Squat', 'Thruster',
];

const ZONES: Array<{
  pct: number;
  zone: string;
  reps: string;
  color: string;
  bg: string;
}> = [
  { pct: 50,  zone: 'Récupération',  reps: '20+ reps', color: '#60A5FA', bg: '#1E3A5F' },
  { pct: 55,  zone: 'Endurance',     reps: '16–20 reps', color: '#60A5FA', bg: '#1E3A5F' },
  { pct: 60,  zone: 'Endurance',     reps: '12–16 reps', color: '#4ADE80', bg: '#1C2023' },
  { pct: 65,  zone: 'Hypertrophie',  reps: '10–12 reps', color: '#4ADE80', bg: '#1C2023' },
  { pct: 70,  zone: 'Hypertrophie',  reps: '8–10 reps',  color: '#4ADE80', bg: '#1C2023' },
  { pct: 75,  zone: 'Hypertrophie',  reps: '6–8 reps',   color: '#FBBF24', bg: '#3D2E0F' },
  { pct: 80,  zone: 'Force',         reps: '4–6 reps',   color: '#FBBF24', bg: '#3D2E0F' },
  { pct: 85,  zone: 'Force',         reps: '3–5 reps',   color: '#F97316', bg: '#3D1A0A' },
  { pct: 90,  zone: 'Force Max',     reps: '2–3 reps',   color: '#F97316', bg: '#3D1A0A' },
  { pct: 95,  zone: 'Force Max',     reps: '1–2 reps',   color: '#EF4444', bg: '#3D0F0F' },
  { pct: 100, zone: '1RM',           reps: '1 rep',      color: '#EF4444', bg: '#3D0F0F' },
  { pct: 105, zone: 'Supra-max',     reps: 'Partiel/excentrique', color: '#A855F7', bg: '#2E1048' },
  { pct: 110, zone: 'Supra-max',     reps: 'Excentrique seul',    color: '#A855F7', bg: '#2E1048' },
  { pct: 115, zone: 'Potentiation',  reps: 'Assistance',          color: '#EC4899', bg: '#3D0A24' },
  { pct: 120, zone: 'Potentiation',  reps: 'Assistance',          color: '#EC4899', bg: '#3D0A24' },
  { pct: 125, zone: 'Overloading',   reps: 'Technique guidée',    color: '#EC4899', bg: '#3D0A24' },
  { pct: 130, zone: 'Overloading',   reps: 'Technique guidée',    color: '#EC4899', bg: '#3D0A24' },
];

function round(val: number, step: number): number {
  return Math.round(val / step) * step;
}

export default function OneRMCalculatorScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const c = theme.ax;
  const S = createStyles(c);
  const [input, setInput] = useState('');
  const [isLbs, setIsLbs] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<string | null>(null);
  // B8 : section Gymnastique (records en reps)
  const [section, setSection] = useState<'barbell' | 'gym'>('barbell');
  const [gymInput, setGymInput] = useState('');
  const [gymMovement, setGymMovement] = useState<string | null>(null);
  const [prData, setPrData] = useState<Record<string, string>>({});
  const [showPRList, setShowPRList] = useState(false);

  // Restore persisted values on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(json => {
      if (!json) return;
      try {
        const saved = JSON.parse(json);
        if (saved.input) setInput(saved.input);
        if (saved.movement) setSelectedMovement(saved.movement);
        if (saved.isLbs !== undefined) setIsLbs(saved.isLbs);
        if (saved.section === 'gym' || saved.section === 'barbell') setSection(saved.section);
        if (saved.gymInput) setGymInput(saved.gymInput);
        if (saved.gymMovement) setGymMovement(saved.gymMovement);
      } catch (e) { captureError(e, { screen: 'OneRMCalculator', action: 'restoreState' }); }
    });
  }, []);

  // Persist on change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      input,
      movement: selectedMovement,
      isLbs,
      section,
      gymInput,
      gymMovement,
    })).catch(e => captureError(e, { action: 'persistOneRM' }));
  }, [input, selectedMovement, isLbs, section, gymInput, gymMovement]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const records = await fetchMyPersonalRecords();
      setPrData(records as Record<string, string>);
    })();
  }, [user?.id]);

  const savedPRs = PR_MOVEMENTS
    .map(name => {
      const key = prKey('weightlifting', name);
      const val = readPr(prData, 'weightlifting', name) ?? '';
      const num = parseFloat(val);
      return { name, key, value: val, num };
    })
    .filter(pr => pr.value && !isNaN(pr.num) && pr.num > 0);

  function selectPR(pr: { name: string; num: number; value: string }) {
    setSelectedMovement(pr.name);
    setInput(pr.value);
    setShowPRList(false);
  }

  const savedGymPRs = GYM_PR_MOVEMENTS
    .map(name => {
      const key = prKey('gymnastics', name);
      const val = readPr(prData, 'gymnastics', name) ?? '';
      const num = parseFloat(val);
      return { name, key, value: val, num };
    })
    .filter(pr => pr.value && !isNaN(pr.num) && pr.num > 0);
  const gymRecord = parseFloat(gymInput.replace(',', '.'));
  const gymValid = !isNaN(gymRecord) && gymRecord > 0;

  const unit = isLbs ? 'lbs' : 'kg';
  const step = isLbs ? 5 : 2.5;
  const raw = parseFloat(input.replace(',', '.'));
  const valid = !isNaN(raw) && raw > 0;

  return (
    <SafeAreaView style={S.screen}>
      <GlassBackground />
      <AxScreenHeader title="Calculateur 1RM" safeArea={false} />

      <ScrollView style={S.scroll} contentContainerStyle={[S.scrollContent, { paddingBottom: tabSpace }]} showsVerticalScrollIndicator={false}>

        {/* B8 : Barres ou Gymnastique */}
        <View style={S.sectionRow}>
          {([['barbell', 'Barres'], ['gym', 'Gymnastique']] as const).map(([key, label]) => (
            <AxChip
              key={key}
              label={label}
              selected={section === key}
              onPress={() => { setSection(key); setShowPRList(false); }}
              testID={`onerm-section-${key}`}
            />
          ))}
        </View>

        {section === 'gym' && (
          <>
            {savedGymPRs.length > 0 && (
              <View style={S.prSection}>
                <AxCard style={S.prToggleCard} onPress={() => setShowPRList(!showPRList)} testID="onerm-pr-toggle">
                  <View style={S.prToggle}>
                    <Dumbbell color={c.accentText} size={16} />
                    <Text style={S.prToggleText} numberOfLines={1}>{gymMovement ?? 'Choisir un mouvement (mes PR)'}</Text>
                    {showPRList ? <ChevronUp color={c.textMuted} size={16} /> : <ChevronDown color={c.textMuted} size={16} />}
                  </View>
                </AxCard>
                {showPRList && (
                  <AxCard style={S.prListCard} testID="onerm-pr-list">
                    {savedGymPRs.map((pr, i) => (
                      <TouchableOpacity
                        key={pr.key}
                        style={[S.prItem, i > 0 && S.prItemSep]}
                        onPress={() => { setGymMovement(pr.name); setGymInput(String(Math.round(pr.num))); setShowPRList(false); }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected: gymMovement === pr.name }}
                        testID={`onerm-pr-${pr.key}`}
                      >
                        <Text style={[S.prItemName, gymMovement === pr.name && { color: c.accentText }]} numberOfLines={1}>{pr.name}</Text>
                        <Text style={S.prItemValue}>{Math.round(pr.num)} reps</Text>
                      </TouchableOpacity>
                    ))}
                  </AxCard>
                )}
              </View>
            )}

            <AxCard style={S.inputCard} testID="onerm-input-card">
              <Text style={S.inputLabel} numberOfLines={1}>{gymMovement ? `RECORD — ${gymMovement.toUpperCase()}` : 'TON RECORD (REPS)'}</Text>
              <View style={S.inputRow}>
                <View style={S.inputField}>
                  <AxTextField
                    value={gymInput}
                    onChangeText={(v) => { setGymInput(v); setGymMovement(null); }}
                    keyboardType="number-pad"
                    placeholder="ex: 20"
                    maxLength={4}
                    testID="onerm-gym-input"
                  />
                </View>
                <Text style={S.inputUnit}>reps</Text>
              </View>
            </AxCard>

            <ZoneTable
              headers={['%', 'Reps', 'Zone', 'Usage']}
              rows={GYM_ZONES.map((z) => {
                const reps = gymValid ? gymRepsAt(gymRecord, z.pct) : null;
                return { pct: z.pct, value: reps != null ? `${reps} reps` : null, zone: z.zone, detail: z.usage, color: z.color };
              })}
            />
            <View style={S.footer}>
              <Text style={S.footerTxt}>
                Reps arrondies à l'entier. 60 % du record : le plafond que le générateur s'impose sur un WOD.
              </Text>
            </View>
          </>
        )}

        {section === 'barbell' && (<>
        {/* PR Quick Select */}
        {savedPRs.length > 0 && (
          <View style={S.prSection}>
            <AxCard style={S.prToggleCard} onPress={() => setShowPRList(!showPRList)} testID="onerm-pr-toggle">
              <View style={S.prToggle}>
                <Dumbbell color={c.accentText} size={16} />
                <Text style={S.prToggleText} numberOfLines={1}>
                  {selectedMovement ?? 'Choisir un mouvement (mes PR)'}
                </Text>
                {showPRList
                  ? <ChevronUp color={c.textMuted} size={16} />
                  : <ChevronDown color={c.textMuted} size={16} />}
              </View>
            </AxCard>

            {showPRList && (
              <AxCard style={S.prListCard} testID="onerm-pr-list">
                {savedPRs.map((pr, i) => (
                  <TouchableOpacity
                    key={pr.key}
                    style={[S.prItem, i > 0 && S.prItemSep]}
                    onPress={() => selectPR(pr)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedMovement === pr.name }}
                    testID={`onerm-pr-${pr.key}`}
                  >
                    <Text style={[S.prItemName, selectedMovement === pr.name && { color: c.accentText }]} numberOfLines={1}>
                      {pr.name}
                    </Text>
                    <Text style={S.prItemValue}>{pr.value} kg</Text>
                  </TouchableOpacity>
                ))}
              </AxCard>
            )}
          </View>
        )}

        {/* Input */}
        <AxCard style={S.inputCard} testID="onerm-input-card">
          <Text style={S.inputLabel} numberOfLines={1}>
            {selectedMovement ? `1RM — ${selectedMovement}` : 'TON 1RM'}
          </Text>
          <View style={S.inputRow}>
            <View style={S.inputField}>
              <AxTextField
                value={input}
                onChangeText={(v) => { setInput(v); setSelectedMovement(null); }}
                keyboardType="decimal-pad"
                placeholder="ex: 100"
                maxLength={6}
                testID="onerm-barbell-input"
              />
            </View>
            <Text style={S.inputUnit}>{unit}</Text>
          </View>

          <View style={S.toggleRow}>
            <Text style={[S.toggleLabel, { color: isLbs ? c.textMuted : c.accentText }]}>KG</Text>
            <AxSwitch value={isLbs} onValueChange={setIsLbs} accessibilityLabel="Afficher en livres" testID="onerm-unit-switch" />
            <Text style={[S.toggleLabel, { color: isLbs ? c.accentText : c.textMuted }]}>LBS</Text>
          </View>
        </AxCard>

        <ZoneTable
          headers={['%', 'Charge', 'Zone', 'Reps']}
          rows={ZONES.map((z) => {
            const load = valid ? round(raw * z.pct / 100, step) : null;
            return { pct: z.pct, value: load != null ? `${load} ${unit}` : null, zone: z.zone, detail: z.reps, color: z.color };
          })}
        />

        <View style={S.footer}>
          <Text style={S.footerTxt}>
            Charges arrondiées au {step} {unit} le plus proche.{'\n'}
            Au-delà de 100% : excentrique, partiel ou assisté uniquement.
          </Text>
        </View>
        </>)}
      </ScrollView>
    </SafeAreaView>
  );
}

type ZoneRow = { pct: number; value: string | null; zone: string; detail: string; color: string };

/** Tableau des zones : une AxCard, lignes séparées d'un filet, couleur de zone lisible (AA) dans le thème. */
function ZoneTable({ headers, rows }: { headers: [string, string, string, string]; rows: ZoneRow[] }) {
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);
  return (
    <AxCard style={S.tableCard} testID="onerm-zones">
      <View style={S.tableHeader}>
        <Text style={[S.thTxt, S.colPct]}>{headers[0]}</Text>
        <Text style={[S.thTxt, S.colValue]}>{headers[1]}</Text>
        <Text style={[S.thTxt, S.colZone]}>{headers[2]}</Text>
        <Text style={[S.thTxt, S.colDetail]}>{headers[3]}</Text>
      </View>
      {rows.map((z) => {
        const ink = readableInk(z.color, c);
        return (
          <View key={z.pct} style={S.row} testID={`onerm-zone-${z.pct}`}>
            <View style={[S.pctBadge, S.colPct, { borderColor: ink }]}>
              <Text style={[S.pctTxt, { color: ink }]} testID={`onerm-zone-pct-${z.pct}`}>{z.pct}%</Text>
            </View>
            <Text style={[S.loadTxt, S.colValue, { color: z.value != null ? c.text : c.textMuted }]} numberOfLines={1} adjustsFontSizeToFit testID={`onerm-zone-value-${z.pct}`}>
              {z.value ?? '—'}
            </Text>
            <Text style={[S.zoneTxt, S.colZone, { color: ink }]} testID={`onerm-zone-name-${z.pct}`}>{z.zone}</Text>
            <Text style={[S.repsTxt, S.colDetail]}>{z.detail}</Text>
          </View>
        );
      })}
    </AxCard>
  );
}

function createStyles(c: AxColors) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: axSpacing.xl },
  inputCard: { marginTop: axSpacing.xl, marginBottom: axSpacing.xl },
  inputLabel: { ...axTypography.overline, color: c.textMuted },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
  inputField: { flex: 1, minWidth: 0 },
  inputUnit: { ...axTypography.numberM, color: c.textMuted },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, justifyContent: 'center' },
  toggleLabel: { ...axTypography.label, letterSpacing: 1 },
  tableCard: { padding: 0, gap: 0, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: axSpacing.md, paddingVertical: 10 },
  thTxt: { ...axTypography.overline, color: c.textMuted },
  colPct: { flex: 0.8 },
  colValue: { flex: 1.1 },
  colZone: { flex: 1.4 },
  colDetail: { flex: 1.3 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: axSpacing.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  pctBadge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: axRadius.badge, paddingVertical: 3 },
  pctTxt: { ...axTypography.labelSmall },
  loadTxt: { ...axTypography.numberM, fontSize: 16, lineHeight: 20 },
  zoneTxt: { ...axTypography.labelSmall },
  repsTxt: { ...axTypography.caption, color: c.textMuted },
  footer: { marginTop: axSpacing.xl, paddingHorizontal: axSpacing.xs },
  footerTxt: { ...axTypography.caption, color: c.textMuted, lineHeight: 18, textAlign: 'center' },
  sectionRow: { flexDirection: 'row', gap: axSpacing.sm, marginTop: axSpacing.lg },
  prSection: { marginTop: axSpacing.xl },
  prToggleCard: { paddingVertical: 14 },
  prToggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prToggleText: { ...axTypography.label, flex: 1, color: c.text },
  prListCard: { marginTop: 6, padding: 0, gap: 0, overflow: 'hidden' },
  prItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.md,
    paddingHorizontal: axSpacing.lg, paddingVertical: 13, minHeight: 44,
  },
  prItemSep: { borderTopWidth: 1, borderTopColor: c.border },
  prItemName: { ...axTypography.label, color: c.text, flex: 1 },
  prItemValue: { ...axTypography.numberM, fontSize: 16, lineHeight: 20, color: c.accentText },
}); }
