import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Image, Linking, Share,
} from 'react-native';
import { ChevronRight, MapPin, Calendar, Video, Clock, Zap, Play, ExternalLink, Info, DollarSign, Search, Share2, Dumbbell, ClipboardList } from 'lucide-react-native';
import { AxButton, AxCard, AxChip, AxIconButton, AxStatusDot, AxTag, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { CompetitionStackParamList, TimerType } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { formatDurationLabel } from '../../utils/wodToTimer';
import { useTranslation } from 'react-i18next';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav = NativeStackNavigationProp<CompetitionStackParamList, 'PhysicalCompetition'>;

interface PhysWOD {
  id: string;
  name: string;
  description: string;
  timer_type: TimerType;
  total_seconds: number;
  max_time: number;
  interval_seconds: number;
  rounds: number;
  work_time: number;
  rest_time: number;
  with_camera: boolean;
  order_index: number;
}

interface PhysComp {
  id: string;
  name: string;
  date: string;
  start_date: string | null;
  end_date: string | null;
  location: string;
  description: string;
  status: 'open' | 'active' | 'closed';
  mode: 'qualification' | 'info';
  logo_url: string | null;
  registration_url: string | null;
  format: string;
  price: string | null;
  created_by: string;
  wods?: PhysWOD[];
}

const TIMER_TYPES: { key: TimerType; label: string }[] = [
  { key: 'for-time', label: 'For Time' },
  { key: 'amrap',    label: 'AMRAP' },
  { key: 'emom',     label: 'EMOM' },
  { key: 'tabata',   label: 'Tabata' },
];

/** Libellé traduit sans son pictogramme de tête. */
function stripGlyph(label: string): string {
  return label.replace(/^[^\p{L}\p{N}]+/u, '');
}

export default function PhysicalCompetitionScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<CompetitionStackParamList, 'PhysicalCompetition'>>();
  const modeFilter = route.params.mode;
  const selectedId = route.params?.selectedId;
  const S = createStyles(theme);
  const ax = theme.ax;

  const [competitions, setCompetitions] = useState<PhysComp[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [selected,     setSelected]     = useState<PhysComp | null>(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterFormat,  setFilterFormat]  = useState<'all' | 'individual' | 'team'>('all');
  const [filterPrice,   setFilterPrice]   = useState(false);
  const autoOpenedRef = useRef(false);

  const load = useCallback(async () => {
    try {
    const { data } = await supabase
      .from('physical_competitions_served')
      .select('*')
      .order('date', { ascending: true });
    const list = (data ?? []) as PhysComp[];
    setCompetitions(list);

    // Auto-open a specific competition if selectedId is provided
    if (selectedId && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      const target = list.find(c => c.id === selectedId);
      if (target) {
        const { data: wData } = await supabase
          .from('physical_wods')
          .select('*')
          .eq('competition_id', target.id)
          .order('order_index', { ascending: true });
        setSelected({ ...target, wods: (wData ?? []) as PhysWOD[] });
      }
    }
    } catch (e) { captureError(e, { screen: 'PhysicalCompetition', action: 'load' }); }
    setLoading(false);
    setRefreshing(false);
  }, [selectedId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadWods = useCallback(async (comp: PhysComp) => {
    try {
    const { data } = await supabase
      .from('physical_wods')
      .select('*')
      .eq('competition_id', comp.id)
      .order('order_index', { ascending: true });
    const updated = { ...comp, wods: (data ?? []) as PhysWOD[] };
    setSelected(updated);
    } catch (e) { captureError(e, { screen: 'PhysicalCompetition', action: 'loadWods' }); }
  }, []);

  function launchWOD(wod: PhysWOD, comp: PhysComp) {
    const dur = wod.total_seconds || 900;
    const params = {
      timerType:    wod.timer_type,
      countdown:    10,
      totalSeconds: wod.timer_type === 'amrap' ? dur : 0,
      maxTime:      wod.timer_type === 'for-time' ? (wod.max_time || dur) : 0,
      interval:     wod.timer_type === 'emom' ? Math.max(1, Math.floor((wod.interval_seconds || 60) / 60)) : 0,
      rounds:       wod.rounds || 3,
      workTime:     wod.work_time || 40,
      restTime:     wod.rest_time || 20,
      withCamera:   wod.with_camera,
      sequence:     '[]',
      videoTitle:   wod.name,
      withTimestamp: true,
      competitionLogoUrl: comp.mode === 'qualification' ? (comp.logo_url || undefined) : undefined,
    };
    navigation.navigate('TimerRun', params);
  }

  function openURL(url: string) {
    Linking.openURL(url).catch(e => captureError(e, { action: 'openURL' }));
  }

  // ── Detail view (selected competition)
  if (selected) {
    const isQualif = selected.mode === 'qualification';

    return (
      <View style={S.container}>
      <GlassBackground />
        <AxScreenHeader
          title={selected.name}
          onBack={() => setSelected(null)}
          right={(
            <>
              <AxIconButton icon={Share2} onPress={() => Share.share({ message: t('phys.shareMessage', { name: selected.name, id: selected.id }) })} accessibilityLabel={t('common.share')} testID="header-share" />
          {selected.logo_url ? (
            <Image source={{ uri: selected.logo_url }} style={S.headerLogo} />
          ) : null}
            </>
          )}
        >
            <View style={S.metaRow}>
              {selected.location ? <><MapPin color={ax.textMuted} size={12} /><Text style={S.metaTxt}>{selected.location}</Text></> : null}
              {selected.mode === 'qualification' && selected.start_date ? (
                <><Calendar color={ax.textMuted} size={12} /><Text style={S.metaTxt}>{selected.start_date}{selected.end_date ? ` → ${selected.end_date}` : ''}</Text></>
              ) : selected.date ? (
                <><Calendar color={ax.textMuted} size={12} /><Text style={S.metaTxt}>{selected.date}</Text></>
              ) : null}
            </View>
        </AxScreenHeader>

        {/* Mode + Format badges */}
        <View style={S.badgeRow}>
          <View style={S.iconTag}>
            {isQualif ? <Zap color={ax.accentText} size={12} /> : <Info color={ax.accentText} size={12} />}
            <AxTag label={isQualif ? t('phys.qualifBadge') : t('phys.noQualifBadge')} testID="phys-mode-tag" />
          </View>
          <AxTag label={selected.format === 'team' ? t('phys.team') : t('phys.individual')} tone="muted" testID="phys-format-tag" />
          {selected.price ? (
            <View style={S.iconTag}>
              <DollarSign color={ax.textMuted} size={12} />
              <AxTag label={selected.price} tone="muted" />
            </View>
          ) : null}
        </View>

        {selected.description ? (
          <AxCard style={S.descBox}>
            <Text style={S.descText}>{selected.description}</Text>
          </AxCard>
        ) : null}

        {/* Registration URL button */}
        {selected.registration_url ? (
          <View style={S.registerBtn}>
            <AxButton
              label={t('phys.registerEvent')}
              icon={ExternalLink}
              fullWidth
              onPress={() => openURL(selected.registration_url!)}
              testID="phys-register"
            />
          </View>
        ) : null}

        <FlatList
          data={selected.wods ?? []}
          keyExtractor={w => w.id}
          contentContainerStyle={[S.list, { paddingBottom: tabSpace }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={S.emptyBox}>
              {isQualif ? <Dumbbell color={ax.textMuted} size={40} /> : <ClipboardList color={ax.textMuted} size={40} />}
              <Text style={S.emptyText}>
                {isQualif ? t('phys.wodsSoon') : t('phys.noWod')}
              </Text>
            </View>
          }
          renderItem={({ item: wod, index }) => (
            <AxCard style={S.wodCard} testID={`phys-wod-${wod.id}`}>
              <View style={S.wodTop}>
                <View style={S.wodIndexCircle}>
                  <Text style={S.wodIndexText}>{index + 1}</Text>
                </View>
                <View style={S.flexText}>
                  <Text style={S.wodName}>{wod.name}</Text>
                  {wod.description ? <Text style={S.wodDescText}>{wod.description}</Text> : null}
                </View>
              </View>
              <View style={S.wodMeta}>
                <View style={S.iconTag}>
                  <Clock color={ax.textMuted} size={12} />
                  <AxTag
                    label={`${TIMER_TYPES.find(tt => tt.key === wod.timer_type)?.label ?? wod.timer_type} · ${formatDurationLabel(wod.total_seconds || 0)}`}
                    testID={`phys-wod-timer-${wod.id}`}
                  />
                </View>
                {wod.with_camera && (
                  <View style={S.iconTag}>
                    <Video color={ax.danger} size={12} />
                    <AxTag label={t('phys.camera')} tone="danger" />
                  </View>
                )}
              </View>
              {isQualif && (() => {
                const now = new Date().toISOString().slice(0, 10);
                const before = selected.start_date && now < selected.start_date;
                const after = selected.end_date && now > selected.end_date;
                const outsidePeriod = before || after;
                return outsidePeriod ? (
                  <View style={S.launchBtn}>
                    <Clock color={ax.textMuted} size={15} />
                    <Text style={S.launchBtnTxt}>
                      {before ? t('phys.availableOn', { date: selected.start_date }) : t('phys.periodEnded')}
                    </Text>
                  </View>
                ) : (
                  <AxButton
                    label={t('phys.launchWod')}
                    icon={Play}
                    variant="outline"
                    fullWidth
                    onPress={() => launchWOD(wod, selected)}
                    testID={`phys-launch-${wod.id}`}
                  />
                );
              })()}
            </AxCard>
          )}
        />
      </View>
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const filteredComps = competitions
    .filter(c => c.mode === modeFilter)
    .filter(c => !query || c.name.toLowerCase().includes(query)
      || (c.location && c.location.toLowerCase().includes(query))
      || (c.description && c.description.toLowerCase().includes(query)))
    .filter(c => {
      if (filterFormat === 'individual') return c.format === 'individual' || c.format === 'both' || (c as any).has_individual;
      if (filterFormat === 'team') return c.format === 'team' || c.format === 'both' || (c as any).has_team;
      return true;
    })
    .filter(c => !filterPrice || (c.price && c.price.trim() !== ''));

  // ── Filtered list view
  const isQualifList = modeFilter === 'qualification';

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title={isQualifList ? t('phys.qualifTitle') : t('phys.noQualifTitle')}>
          <Text style={S.headerSub}>
            {isQualifList ? t('phys.qualifSub') : t('phys.noQualifSub')}
          </Text>
      </AxScreenHeader>

      <View style={S.searchBar}>
        <AxTextField
          icon={Search}
          placeholder={t('phys.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel={t('phys.searchPlaceholder')}
          compact
          testID="phys-search"
        />
      </View>

      <View style={S.filterRow}>
        {[
          { key: 'all',        label: t('phys.filterAll') },
          { key: 'individual', label: t('phys.individual') },
          { key: 'team',       label: t('phys.team') },
        ].map(f => (
          <AxChip
            key={f.key}
            label={f.label}
            selected={filterFormat === f.key}
            onPress={() => setFilterFormat(f.key as any)}
            testID={`phys-filter-${f.key}`}
          />
        ))}
        <AxChip
          label={t('phys.filterPrice')}
          selected={filterPrice}
          onPress={() => setFilterPrice(v => !v)}
          testID="phys-filter-price"
        />
      </View>

      {loading ? (
        <View style={S.center}><ActivityIndicator size="large" color={ax.accent} /></View>
      ) : (
        <FlatList
          data={filteredComps}
          keyExtractor={c => c.id}
          contentContainerStyle={[S.list, { paddingBottom: tabSpace }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={S.emptyBox}>
              {isQualifList ? <Dumbbell color={ax.textMuted} size={40} /> : <ClipboardList color={ax.textMuted} size={40} />}
              <Text style={S.emptyText}>
                {isQualifList
                  ? t('phys.emptyQualif')
                  : t('phys.emptyInfo')}
              </Text>
            </View>
          }
          renderItem={({ item: comp }) => (
              <AxCard
                style={S.compCard}
                onPress={() => loadWods(comp)}
                accessibilityLabel={comp.name}
                variant={comp.status === 'active' ? 'featured' : 'standard'}
                testID={`phys-card-${comp.id}`}
              >
                <View style={S.compTop}>
                  {comp.logo_url ? (
                    <Image source={{ uri: comp.logo_url }} style={S.compLogo} />
                  ) : null}
                  <View style={S.flexText}>
                    <Text style={S.compName}>{comp.name}</Text>
                    <View style={[S.compBadges]}>
                      <AxStatusDot
                        label={stripGlyph(comp.status === 'open' ? t('phys.statusOpen') : comp.status === 'active' ? t('phys.statusLive') : t('phys.statusClosed'))}
                        tone={comp.status === 'closed' ? 'muted' : comp.status === 'active' ? 'warning' : 'active'}
                        testID={`phys-status-${comp.id}`}
                      />
                    </View>
                  </View>
                </View>
                {comp.description ? <Text style={S.compDesc} numberOfLines={2}>{comp.description}</Text> : null}
                <View style={S.compMeta}>
                  {comp.location ? <View style={S.metaPill}><MapPin color={ax.textMuted} size={12} /><Text style={S.metaTxt}>{comp.location}</Text></View> : null}
                  {comp.date ? <View style={S.metaPill}><Calendar color={ax.textMuted} size={12} /><Text style={S.metaTxt}>{comp.date}</Text></View> : null}
                  {comp.price ? <View style={S.metaPill}><DollarSign color={ax.textMuted} size={12} /><Text style={S.metaTxt}>{comp.price}</Text></View> : null}
                </View>
                <View style={S.compFooter}>
                  <View style={S.metaPill}>
                    {comp.logo_url ? (
                      <Image source={{ uri: comp.logo_url }} style={S.footerLogo} />
                    ) : (
                      <Zap color={ax.accentText} size={12} />
                    )}
                    <Text style={S.footerTxt}>
                      {isQualifList ? t('phys.seeWods') : t('phys.seeDetails')}
                    </Text>
                  </View>
                  <ChevronRight color={ax.textMuted} size={16} />
                </View>
              </AxCard>
          )}
        />
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerSub: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
    headerLogo: { width: 40, height: 40, borderRadius: axRadius.control },
    badgeRow: { flexDirection: 'row', gap: axSpacing.sm, flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: axSpacing.lg, paddingTop: axSpacing.md },
    iconTag: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    descBox: { marginHorizontal: axSpacing.lg, marginTop: axSpacing.md },
    descText: { ...axTypography.bodySmall, color: c.textMuted },
    registerBtn: { marginHorizontal: axSpacing.lg, marginTop: axSpacing.md },
    list: { padding: axSpacing.lg, gap: axSpacing.md },
    emptyBox: { alignItems: 'center', paddingTop: 60, gap: axSpacing.md },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', paddingHorizontal: 32 },
    flexText: { flex: 1, minWidth: 0 },
    compCard: { gap: axSpacing.sm },
    compTop: { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.md },
    compLogo: { width: 44, height: 44, borderRadius: axRadius.control },
    compName: { ...axTypography.titleM, color: c.text, marginBottom: axSpacing.xs },
    compBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    compDesc: { ...axTypography.bodySmall, color: c.textMuted },
    compMeta: { flexDirection: 'row', gap: axSpacing.md, flexWrap: 'wrap' },
    compFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm, borderTopWidth: 1, borderTopColor: c.border, paddingTop: axSpacing.sm },
    metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, marginTop: 2, flexWrap: 'wrap' },
    metaTxt: { ...axTypography.caption, color: c.textMuted, flexShrink: 1 },
    footerLogo: { width: 20, height: 20, borderRadius: axRadius.badge },
    footerTxt: { ...axTypography.label, color: c.accentText, flexShrink: 1 },
    wodCard: { gap: axSpacing.sm },
    wodTop: { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.md },
    wodIndexCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    wodIndexText: { ...axTypography.label, color: c.accentText },
    wodName: { ...axTypography.label, color: c.text },
    wodDescText: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 3 },
    wodMeta: { flexDirection: 'row', gap: axSpacing.sm, flexWrap: 'wrap' },
    launchBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: axSpacing.sm,
      borderRadius: axRadius.control, borderWidth: 1, borderColor: c.border, padding: axSpacing.md,
    },
    launchBtnTxt: { ...axTypography.caption, color: c.textMuted, flexShrink: 1 },
    searchBar: { marginHorizontal: axSpacing.lg, marginTop: axSpacing.md, marginBottom: axSpacing.xs },
    filterRow: {
      flexDirection: 'row', gap: axSpacing.sm, paddingHorizontal: axSpacing.lg, marginTop: axSpacing.sm, marginBottom: axSpacing.xs, flexWrap: 'wrap',
    },
  });
}
