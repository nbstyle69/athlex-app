import i18n from '../../i18n';
import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxIconButton } from '../../components/ax/AxIconButton';
import { AxCard, AxChip, AxTag, AxTextField } from '../../components/ax';
import { hitSlopFor } from '../../components/ax/color';
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  Image, ActivityIndicator,
} from 'react-native';
import { Search, MapPin, Users, Map, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { readRows } from '../../lib/db';
import { BOX_COLUMNS } from '../../lib/boxColumns';
import { captureError } from '../../lib/sentry';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { HomeStackParamList } from '../../navigation';
import { Box } from '../../types';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { sportLabel } from './explorerLabels';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

export default function BoxDirectoryScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const c = theme.ax;
  const s = createStyles(c);

  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  useEffect(() => {
    loadBoxes();
  }, []);

  async function loadBoxes() {
    try {
      const { data, error } = await supabase
        .from('boxes')
        .select(BOX_COLUMNS)
        .eq('is_listed', true)
        .eq('is_active', true);
      if (error) throw error;
      const list = (data ?? []) as unknown as Box[];

      // Fetch real member counts from box_members
      if (list.length > 0) {
        const boxIds = list.map(b => b.id);
        const members = await readRows(
          supabase
            .from('box_members')
            .select('box_id')
            .in('box_id', boxIds)
            .eq('status', 'active'),
          { screen: 'BoxDirectory', action: 'memberCounts' },
        );
        const countMap: Record<string, number> = {};
        (members ?? []).forEach((m: any) => {
          countMap[m.box_id] = (countMap[m.box_id] ?? 0) + 1;
        });
        list.forEach(b => { b.member_count = countMap[b.id] ?? 0; });
      }

      list.sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0));
      setBoxes(list);
    } catch (e) {
      captureError(e, { screen: 'BoxDirectory', action: 'load' });
    }
    setLoading(false);
  }

  const allSports = useMemo(() => {
    const set = new Set<string>();
    boxes.forEach(b => (b.sport_type ?? []).forEach(s => set.add(s)));
    return Array.from(set).sort();
  }, [boxes]);

  const filtered = useMemo(() => {
    let list = boxes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.name.toLowerCase().includes(q) ||
        (b.city ?? '').toLowerCase().includes(q) ||
        (b.tagline ?? '').toLowerCase().includes(q)
      );
    }
    if (selectedSport) {
      list = list.filter(b => (b.sport_type ?? []).includes(selectedSport));
    }
    return list;
  }, [boxes, search, selectedSport]);

  function renderBox({ item }: { item: Box }) {
    return (
      <AxCard
        style={s.card}
        onPress={() => navigation.navigate('BoxDirectoryDetail', { boxId: item.id })}
        accessibilityLabel={item.name}
        testID={`box-card-${item.id}`}
      >
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={s.logo} />
        ) : (
          <View style={[s.logo, s.logoPlaceholder]}>
            <Text style={s.logoLetter}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={s.cardContent}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
          {item.tagline ? (
            <Text style={s.cardTagline} numberOfLines={1}>{item.tagline}</Text>
          ) : null}
          <View style={s.cardMeta}>
            {item.city ? (
              <View style={s.metaRow}>
                <MapPin size={12} color={c.textMuted} />
                <Text style={s.metaText} numberOfLines={1}>{item.city}</Text>
              </View>
            ) : null}
            <View style={s.metaRow}>
              <Users size={12} color={c.textMuted} />
              <Text style={s.metaText} numberOfLines={1}>{i18n.t('explorer.membersCount', { count: item.member_count ?? 0 })}</Text>
            </View>
          </View>
          {(item.sport_type ?? []).length > 0 && (
            <View style={s.sportRow}>
              {(item.sport_type ?? []).slice(0, 3).map(sp => (
                <AxTag key={sp} tone="muted" label={sportLabel(sp)} />
              ))}
            </View>
          )}
        </View>
      </AxCard>
    );
  }

  return (
    <View style={s.container}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader
        title={i18n.t('explorer.directory.title')}
        right={<AxIconButton icon={Map} onPress={() => navigation.navigate('BoxDirectoryMap', { boxes: filtered.filter(b => b.latitude && b.longitude) })} accessibilityLabel={i18n.t('common.map')} testID="header-map" />}
      >
          <Text style={s.headerSub}>{i18n.t('explorer.directory.count', { count: filtered.length })}</Text>
      </AxScreenHeader>

      {/* Search */}
      <View style={s.searchWrap}>
        <AxTextField
          value={search}
          onChangeText={setSearch}
          placeholder={i18n.t('explorer.directory.searchPlaceholder')}
          icon={search.length > 0 ? undefined : Search}
          testID="box-search"
          trailing={search.length > 0 ? (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={hitSlopFor(18, 18)}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('whiteboard.memberSearchClear')}
              testID="box-search-clear"
            >
              <X size={18} color={c.textMuted} />
            </Pressable>
          ) : undefined}
        />
      </View>

      {/* Sport filters */}
      {allSports.length > 0 && (
        <View style={s.filtersWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={allSports}
            keyExtractor={i => i}
            style={s.filtersBar}
            contentContainerStyle={s.filtersList}
            renderItem={({ item: sp }) => (
              <AxChip
                label={sportLabel(sp)}
                selected={selectedSport === sp}
                onPress={() => setSelectedSport(selectedSport === sp ? null : sp)}
                testID={`box-filter-${sp}`}
              />
            )}
          />
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={c.accentText} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>{i18n.t('explorer.directory.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b => b.id}
          renderItem={renderBox}
          contentContainerStyle={[s.list, { paddingBottom: tabSpace }]}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
}

function createStyles(c: AxColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    headerSub: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    searchWrap: { paddingHorizontal: axSpacing.xl, paddingTop: axSpacing.md, paddingBottom: axSpacing.md },
    filtersWrap: { marginBottom: axSpacing.md },
    filtersBar: { flexGrow: 0, flexShrink: 0 },
    filtersList: { paddingHorizontal: axSpacing.xl, paddingVertical: 2, gap: axSpacing.sm },
    list: { paddingHorizontal: axSpacing.xl },
    separator: { height: axSpacing.md },
    card: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
    logo: { width: 52, height: 52, borderRadius: axRadius.card },
    logoPlaceholder: {
      backgroundColor: c.field, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    logoLetter: { ...axTypography.titleM, color: c.accentText },
    cardContent: { flex: 1, minWidth: 0, gap: axSpacing.xs },
    cardName: { ...axTypography.titleM, color: c.text },
    cardTagline: { ...axTypography.bodySmall, color: c.textMuted },
    cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: axSpacing.md, rowGap: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, flexShrink: 1, minWidth: 0 },
    metaText: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1 },
    sportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.xs, marginTop: axSpacing.xs },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: axSpacing['2xl'] },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  });
}
