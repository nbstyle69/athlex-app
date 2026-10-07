import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import i18n from '../../i18n';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { AxButton, AxChip, AxIconButton, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { Trash2 } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { BoxWODType } from '../../types';
import { WhiteboardStackParamList } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import DateField from '../../components/DateField';
import { formatCap, parseCap } from '../../utils/scoreFormat';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { errorMessage } from '../../utils/refusals';

type Nav = NativeStackNavigationProp<WhiteboardStackParamList, 'PersonalWODForm'>;
type Rt = RouteProp<WhiteboardStackParamList, 'PersonalWODForm'>;

const WOD_TYPES: { value: BoxWODType; labelKey: string }[] = [
  { value: 'for-time', labelKey: 'bo.wods.typeForTime' },
  { value: 'amrap',    labelKey: 'bo.wods.typeAmrap' },
  { value: 'emom',     labelKey: 'bo.wods.typeEmom' },
  { value: 'tabata',   labelKey: 'bo.wods.typeTabata' },
  { value: 'strength', labelKey: 'bo.wods.typeStrength' },
  { value: 'custom',   labelKey: 'bo.wods.typeCustom' },
];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function PersonalWODFormScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const S = createStyles(theme);
  const c = theme.ax;
  const { t } = useTranslation();

  const editId = route.params?.wodId ?? null;
  const initialDate = route.params?.date ?? toISO(new Date());

  // Form state
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [wodType, setWodType]           = useState<BoxWODType>('amrap');
  const [date, setDate]                 = useState(initialDate);
  const [timeCap, setTimeCap]           = useState('');
  const [rounds, setRounds]             = useState('');
  const [emomInterval, setEmomInterval] = useState('1');
  const [tabataWork, setTabataWork]     = useState('20');
  const [tabataRest, setTabataRest]     = useState('10');
  const [notes, setNotes]               = useState('');

  const form = { title, description, wodType, date, timeCap, rounds, emomInterval, tabataWork, tabataRest, notes };
  const [pristine, setPristine] = useState<typeof form | null>(editId ? null : form);
  const dirty = pristine != null && (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== pristine[k]);

  const [loading, setLoading]       = useState(!!editId);
  const [submitting, setSubmitting] = useState(false);

  // Load existing WOD if editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data: row, error } = await supabase
        .from('box_wods')
        .select('*')
        .eq('id', editId)
        .maybeSingle();
      if (error || !row) { setLoading(false); return; }
      const data = row as any;
      setTitle(data.title ?? '');
      setDescription(data.description ?? '');
      setWodType((data.wod_type as BoxWODType) ?? 'amrap');
      setDate(data.scheduled_date);
      setTimeCap(formatCap(data.time_cap_seconds));
      setRounds(data.rounds ? String(data.rounds) : '');
      setEmomInterval(data.emom_interval_minutes ? String(data.emom_interval_minutes) : '1');
      setTabataWork(data.tabata_work_seconds ? String(data.tabata_work_seconds) : '20');
      setTabataRest(data.tabata_rest_seconds ? String(data.tabata_rest_seconds) : '10');
      setNotes(data.notes ?? '');
      setPristine({
        title: data.title ?? '',
        description: data.description ?? '',
        wodType: (data.wod_type as BoxWODType) ?? 'amrap',
        date: data.scheduled_date,
        timeCap: formatCap(data.time_cap_seconds),
        rounds: data.rounds ? String(data.rounds) : '',
        emomInterval: data.emom_interval_minutes ? String(data.emom_interval_minutes) : '1',
        tabataWork: data.tabata_work_seconds ? String(data.tabata_work_seconds) : '20',
        tabataRest: data.tabata_rest_seconds ? String(data.tabata_rest_seconds) : '10',
        notes: data.notes ?? '',
      });
      setLoading(false);
    })();
  }, [editId]);

  async function save() {
    if (!user || !title.trim() || !date) {
      Alert.alert(t('personalWod.requiredTitle'), t('personalWod.requiredMsg'));
      return;
    }
    setSubmitting(true);
    const payload: any = {
      box_id: null,                         // ← marqueur WOD perso
      created_by: user.id,
      title: title.trim(),
      description: description.trim() || null,
      wod_type: wodType,
      scheduled_date: date,
      time_cap_seconds: parseCap(timeCap),
      rounds: rounds ? parseInt(rounds) : null,
      notes: notes.trim() || null,
      is_published: true,
      leaderboard_enabled: false,
    };
    if (wodType === 'emom') {
      payload.emom_interval_minutes = emomInterval ? parseInt(emomInterval) : 1;
    }
    if (wodType === 'tabata') {
      payload.tabata_work_seconds = tabataWork ? parseInt(tabataWork) : 20;
      payload.tabata_rest_seconds = tabataRest ? parseInt(tabataRest) : 10;
    }
    try {
      if (editId) {
        const { error } = await supabase.from('box_wods').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('box_wods').insert({ ...payload, sort_order: 0 });
        if (error) throw error;
      }
      navigation.goBack();
    } catch (e: any) {
      captureError(e, { screen: 'PersonalWODForm', action: editId ? 'update' : 'insert' });
      Alert.alert(t('common.error'), e?.message ? await errorMessage(e) : t('personalWod.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  function cancel() {
    if (!dirty) { navigation.goBack(); return; }
    Alert.alert(t('whiteboard.discardTitle'), undefined, [
      { text: t('whiteboard.keepEditing'), style: 'cancel' },
      { text: t('whiteboard.discard'), style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }

  async function remove() {
    if (!editId) return;
    Alert.alert(t('bo.wods.deleteTitle'), title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('box_wods').delete().eq('id', editId);
          if (error) Alert.alert(t('common.error'), await errorMessage(error));
          else navigation.goBack();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <GlassBackground />
        <ActivityIndicator size="large" color={c.accentText} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={S.container}
    >
      <GlassBackground />
      <AxScreenHeader
        title={editId ? t('personalWod.editTitle') : t('bo.wods.createWod')}
        right={editId ? <AxIconButton icon={Trash2} onPress={remove} accessibilityLabel={i18n.t('common.delete')} testID="header-delete" /> : undefined}
      />

      <ScrollView contentContainerStyle={[S.body, { paddingBottom: tabSpace }]} keyboardShouldPersistTaps="handled">
        <View style={S.row}>
          <View style={S.col}>
            <Text style={S.label}>{t('bo.wods.labelDate')}</Text>
            <DateField
              style={S.dateInput}
              value={date}
              onChangeText={setDate}
              theme={theme}
              placeholderTextColor={c.textMuted}
            />
          </View>
        </View>

        <Text style={S.label}>{t('bo.wods.labelTitle')}</Text>
        <AxTextField
          testID="pwod-title"
          value={title}
          onChangeText={setTitle}
          placeholder={t('personalWod.titlePlaceholder')}
        />

        <Text style={S.label}>{t('bo.wods.labelType')}</Text>
        <View style={S.typeGrid}>
          {WOD_TYPES.map(type => (
            <AxChip
              key={type.value}
              testID={`pwod-type-${type.value}`}
              label={t(type.labelKey)}
              selected={wodType === type.value}
              onPress={() => setWodType(type.value)}
            />
          ))}
        </View>

        <Text style={S.label}>{t('bo.wods.labelDescription')}</Text>
        <AxTextField
          testID="pwod-description"
          value={description}
          onChangeText={setDescription}
          placeholder={t('bo.wods.descriptionPlaceholder')}
          multiline
          minInputHeight={80}
        />

        <View style={S.row}>
          <View style={S.col}>
            <Text style={S.label}>{t('bo.wods.labelTimeCap')}</Text>
            <AxTextField
              testID="pwod-timecap"
              value={timeCap}
              onChangeText={setTimeCap}
              keyboardType="numbers-and-punctuation"
              placeholder="12:30"
            />
          </View>
          <View style={S.col}>
            <Text style={S.label}>{t('bo.wods.labelRounds')}</Text>
            <AxTextField
              testID="pwod-rounds"
              value={rounds}
              onChangeText={setRounds}
              keyboardType="numeric"
              placeholder="5"
            />
          </View>
        </View>

        {wodType === 'emom' && (
          <>
            <Text style={S.label}>{t('bo.wods.labelEmomInterval')}</Text>
            <AxTextField
              testID="pwod-emom"
              value={emomInterval}
              onChangeText={setEmomInterval}
              keyboardType="numeric"
              placeholder="1"
            />
          </>
        )}

        {wodType === 'tabata' && (
          <View style={S.row}>
            <View style={S.col}>
              <Text style={S.label}>{t('personalWod.tabataWork')}</Text>
              <AxTextField
                testID="pwod-tabata-work"
                value={tabataWork}
                onChangeText={setTabataWork}
                keyboardType="numeric"
                placeholder="20"
              />
            </View>
            <View style={S.col}>
              <Text style={S.label}>{t('personalWod.tabataRest')}</Text>
              <AxTextField
                testID="pwod-tabata-rest"
                value={tabataRest}
                onChangeText={setTabataRest}
                keyboardType="numeric"
                placeholder="10"
              />
            </View>
          </View>
        )}

        <Text style={S.label}>{t('personalWod.notesLabel')}</Text>
        <AxTextField
          testID="pwod-notes"
          value={notes}
          onChangeText={setNotes}
          placeholder={t('personalWod.notesPlaceholder')}
          multiline
          minInputHeight={80}
        />

        <View style={S.actions}>
          <View style={S.action}>
            <AxButton
              testID="pwod-cancel"
              variant="outline"
              label={t('common.cancel')}
              onPress={cancel}
              disabled={submitting}
              fullWidth
            />
          </View>
          <View style={S.action}>
            <AxButton
              testID="pwod-save"
              variant="accent"
              label={editId ? t('common.save') : t('personalWod.create')}
              onPress={save}
              disabled={!title.trim()}
              loading={submitting}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    body: { padding: axSpacing.xl, gap: axSpacing.sm },
    label: { ...axTypography.overline, color: c.textMuted, marginTop: axSpacing.sm },
    dateInput: {
      ...axTypography.body, color: c.text,
      backgroundColor: c.field, borderRadius: axRadius.control,
      borderWidth: 1, borderColor: c.fieldBorder, padding: 14,
    },
    row: { flexDirection: 'row', gap: axSpacing.md },
    col: { flex: 1, minWidth: 0, gap: axSpacing.sm },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm },
    actions: { flexDirection: 'row', gap: axSpacing.md, marginTop: axSpacing.lg },
    action: { flex: 1, minWidth: 0 },
  });
}
