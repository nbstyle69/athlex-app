import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxCard, AxTag } from '../../components/ax';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, SectionList,
  Image, ActivityIndicator, Linking,
} from 'react-native';
import { Building2, ExternalLink, Calendar } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { HomeStackParamList } from '../../navigation';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import GlassBackground from '../../components/glass/GlassBackground';
import { WEB_URL } from '../../lib/urls';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

interface ProgramItem {
  id: string;
  title: string;
  description: string | null;
  type: 'fixed' | 'ongoing';
  duration_weeks: number | null;
  days_per_week: number;
  box_id: string;
  box_name: string;
  box_logo: string | null;
  box_city: string | null;
  box_slug: string | null;
}

const SITE_BASE_URL = WEB_URL;

export default function BoxProgramsScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const c = theme.ax;
  const s = createStyles(c);
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, title, description, type, duration_weeks, days_per_week, box_id, boxes(name, logo_url, city, slug)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list: ProgramItem[] = ((data ?? []) as any[]).map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        type: p.type,
        duration_weeks: p.duration_weeks,
        days_per_week: p.days_per_week,
        box_id: p.box_id,
        box_name: p.boxes?.name ?? '',
        box_logo: p.boxes?.logo_url ?? null,
        box_city: p.boxes?.city ?? null,
        box_slug: p.boxes?.slug ?? null,
      }));
      setPrograms(list);
    } catch (e) {
      captureError(e, { screen: 'BoxPrograms', action: 'load' });
    }
    setLoading(false);
  }

  const sections = useMemo(() => {
    const map: Record<string, { box_name: string; box_logo: string | null; box_city: string | null; box_slug: string | null; data: ProgramItem[] }> = {};
    programs.forEach(p => {
      if (!map[p.box_id]) {
        map[p.box_id] = { box_name: p.box_name, box_logo: p.box_logo, box_city: p.box_city, box_slug: p.box_slug, data: [] };
      }
      map[p.box_id].data.push(p);
    });
    return Object.entries(map).map(([, v]) => ({
      title: v.box_name,
      box_logo: v.box_logo,
      box_city: v.box_city,
      box_slug: v.box_slug,
      data: v.data,
    }));
  }, [programs]);

  function openBoxPage(slug: string | null) {
    if (slug) Linking.openURL(`${SITE_BASE_URL}/box/${slug}`);
  }

  return (
    <View style={s.container}>
      <GlassBackground />
      <AxScreenHeader title={t('explorer.programs.title')}>
          <Text style={s.headerSub}>{t('explorer.programs.count', { count: programs.length })}</Text>
      </AxScreenHeader>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={c.accentText} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={[s.list, { paddingBottom: tabSpace }]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={s.center}>
              <Building2 color={c.textMuted} size={40} />
              <Text style={s.emptyTxt}>{t('explorer.programs.empty')}</Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Pressable
              style={s.sectionRow}
              onPress={() => openBoxPage(section.box_slug)}
              accessibilityRole="button"
              accessibilityLabel={section.title}
              testID={`box-programs-section-${section.data[0].box_id}`}
            >
              {section.box_logo ? (
                <Image source={{ uri: section.box_logo }} style={s.sectionLogo} />
              ) : (
                <View style={[s.sectionLogo, s.sectionLogoFallback]}>
                  <Text style={s.sectionInitial}>{section.title.charAt(0)}</Text>
                </View>
              )}
              <View style={s.sectionText}>
                <Text style={s.sectionName} numberOfLines={1}>{section.title}</Text>
                {section.box_city && <Text style={s.sectionCity} numberOfLines={1}>{section.box_city}</Text>}
              </View>
              {section.box_slug && <ExternalLink color={c.textMuted} size={16} />}
            </Pressable>
          )}
          renderItem={({ item }) => (
            <AxCard
              onPress={() => openBoxPage(item.box_slug)}
              accessibilityLabel={item.title}
              testID={`program-card-${item.id}`}
            >
              <View style={s.titleRow}>
                <Text style={s.cardName} numberOfLines={1}>{item.title}</Text>
                <AxTag
                  tone={item.type === 'fixed' ? 'accent' : 'muted'}
                  label={item.type === 'fixed' ? t('explorer.programs.weeks', { n: item.duration_weeks }) : t('bo.programs.ongoing')}
                />
              </View>
              {item.description && <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>}
              <View style={s.metaRow}>
                <Calendar color={c.textMuted} size={12} />
                <Text style={s.metaTxt}>{t('explorer.programs.daysPerWeek', { count: item.days_per_week })}</Text>
              </View>
            </AxCard>
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          SectionSeparatorComponent={() => <View style={s.sectionSeparator} />}
        />
      )}
    </View>
  );
}

function createStyles(c: AxColors) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  headerSub: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  list: { paddingHorizontal: axSpacing.xl, paddingTop: axSpacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: axSpacing.md, paddingTop: 60 },
  emptyTxt: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', paddingHorizontal: 30 },
  separator: { height: axSpacing.sm },
  sectionSeparator: { height: axSpacing.lg },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: axSpacing.md,
    minHeight: 44, paddingVertical: axSpacing.sm,
  },
  sectionLogo: { width: 36, height: 36, borderRadius: axRadius.card },
  sectionLogoFallback: {
    backgroundColor: c.field, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionInitial: { ...axTypography.label, color: c.accentText },
  sectionText: { flex: 1, minWidth: 0 },
  sectionName: { ...axTypography.label, color: c.text },
  sectionCity: { ...axTypography.bodySmall, color: c.textMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  cardName: { ...axTypography.titleM, color: c.text, flex: 1, minWidth: 0 },
  cardDesc: { ...axTypography.bodySmall, color: c.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  metaTxt: { ...axTypography.bodySmall, color: c.textMuted },
}); }
