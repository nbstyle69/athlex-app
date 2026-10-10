import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxCard } from '../../components/ax';
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList,
  Image, ActivityIndicator,
} from 'react-native';
import { ChevronRight, Handshake, Tag } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { HomeStackParamList } from '../../navigation';
import { Partner, PartnerCategory } from '../../types';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { useTranslation } from 'react-i18next';
import { partnerCategoryLabel } from './explorerLabels';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

const CATEGORY_ORDER: PartnerCategory[] = [
  'nutrition', 'equipment', 'apparel', 'supplements', 'recovery', 'coaching', 'software', 'other',
];

export default function PartnersScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const c = theme.ax;
  const s = createStyles(c);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPartners();
  }, []);

  async function loadPartners() {
    try {
      const { data, error } = await supabase.from('partners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setPartners((data ?? []) as Partner[]);
    } catch (e) {
      captureError(e, { screen: 'Partners', action: 'load' });
    }
    setLoading(false);
  }

  const sections = useMemo(() => {
    const grouped: Record<string, Partner[]> = {};
    partners.forEach(p => {
      const cat = p.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return CATEGORY_ORDER
      .filter(cat => grouped[cat]?.length)
      .map(cat => ({ title: partnerCategoryLabel(cat), data: grouped[cat] }));
  }, [partners, t]);

  function renderPartner({ item }: { item: Partner }) {
    return (
      <AxCard
        style={s.card}
        onPress={() => navigation.navigate('PartnerDetail', { partnerId: item.id })}
        accessibilityLabel={item.name}
        testID={`partner-card-${item.id}`}
      >
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={s.logo} />
        ) : (
          <View style={[s.logo, s.logoPlaceholder]}>
            <Handshake size={20} color={c.accentText} />
          </View>
        )}
        <View style={s.cardContent}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
          {item.offer_title ? (
            <View style={s.offerRow}>
              <Tag size={12} color={c.accentText} />
              <Text style={s.offerText} numberOfLines={1}>{item.offer_title}</Text>
            </View>
          ) : item.description ? (
            <Text style={s.cardDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={c.textMuted} />
      </AxCard>
    );
  }

  return (
    <View style={s.container}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader title={t('home.explorer.partners')}>
          <Text style={s.headerSub}>{t('partners.subtitle')}</Text>
      </AxScreenHeader>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={c.accentText} />
        </View>
      ) : sections.length === 0 ? (
        <View style={s.center}>
          <Handshake size={40} color={c.textMuted} />
          <Text style={s.emptyText}>{t('partners.empty')}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderPartner}
          renderSectionHeader={({ section }) => (
            <Text style={s.sectionHeader}>{section.title}</Text>
          )}
          contentContainerStyle={[s.list, { paddingBottom: tabSpace }]}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

function createStyles(c: AxColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    headerSub: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    list: { paddingHorizontal: axSpacing.xl },
    separator: { height: axSpacing.sm },
    sectionHeader: {
      ...axTypography.overline, color: c.textMuted,
      marginTop: axSpacing['2xl'], marginBottom: axSpacing.md,
    },
    card: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
    logo: { width: 48, height: 48, borderRadius: axRadius.card },
    logoPlaceholder: {
      backgroundColor: c.field, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    cardContent: { flex: 1, minWidth: 0, gap: axSpacing.xs },
    cardName: { ...axTypography.titleM, color: c.text },
    cardDesc: { ...axTypography.bodySmall, color: c.textMuted },
    offerRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    offerText: { ...axTypography.bodySmall, color: c.accentText, flexShrink: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: axSpacing.md, paddingHorizontal: axSpacing['2xl'] },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  });
}
