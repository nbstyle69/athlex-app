import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Globe2, Users, Calendar, ChevronRight } from 'lucide-react-native';
import { AxCard, AxStatusDot, AxTag } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { CompetitionStackParamList } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTranslation } from 'react-i18next';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { dateLocale } from '../../i18n/locale';

type Nav = NativeStackNavigationProp<CompetitionStackParamList, 'InterCompetitionList'>;

/** Libellé traduit sans son pictogramme de tête. */
function stripGlyph(label: string): string {
  return label.replace(/^[^\p{L}\p{N}]+/u, '');
}

interface InterComp {
  id: string;
  title: string;
  description: string | null;
  format: string;
  type: string;
  team_size: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  max_participants: number | null;
  reg_count: number;
  my_registration: boolean;
}

export default function InterCompetitionListScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const FORMAT_LABEL: Record<string, string> = {
    league: t('interComp.formatLeague'), bracket: t('interComp.formatBracket'),
    pool: t('interComp.formatPool'), swiss: t('interComp.formatSwiss'),
  };
  const STATUS_LABEL: Record<string, string> = {
    open: t('interComp.statusOpen'), active: t('interComp.statusActive'), closed: t('interComp.statusClosed'),
  };
  const S = createStyles(theme);
  const ax = theme.ax;

  const [comps, setComps] = useState<InterComp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
    const { data } = await supabase
      .from('inter_competitions')
      .select('*')
      .neq('status', 'draft')
      .order('created_at', { ascending: false });

    const list = await Promise.all((data ?? []).map(async (c: any) => {
      const [{ count: reg_count }, { data: myReg }] = await Promise.all([
        supabase.from('inter_registrations').select('*', { count: 'exact', head: true }).eq('competition_id', c.id),
        user ? supabase.from('inter_registrations')
          .select('id').eq('competition_id', c.id).eq('athlete_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { ...c, reg_count: reg_count ?? 0, my_registration: !!myReg };
    }));
    setComps(list);
    } catch (e) { captureError(e, { screen: 'InterCompetitionList', action: 'load' }); }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function onRefresh() { setRefreshing(true); load(); }

  return (
    <View style={S.container}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader title={t('interComp.title')}>
          <Text style={S.headerSub}>{t('interComp.subtitle')}</Text>
      </AxScreenHeader>

      {loading ? (
        <ActivityIndicator color={ax.accent} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.content, { paddingBottom: tabSpace }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ax.accent} />}
        >
          {comps.length === 0 ? (
            <View style={S.empty}>
              <Globe2 size={48} color={ax.textMuted} />
              <Text style={S.emptyTitle}>{t('interComp.noCompetition')}</Text>
              <Text style={S.emptyText}>{t('interComp.noCompetitionHint')}</Text>
            </View>
          ) : (
            comps.map(c => {
              const statusTone = c.status === 'open' ? 'active' : c.status === 'active' ? 'warning' : 'muted';
              return (
                <AxCard
                  key={c.id}
                  testID={`inter-card-${c.id}`}
                  variant={c.status === 'active' ? 'featured' : 'standard'}
                  accessibilityLabel={c.title}
                  onPress={() => navigation.navigate('InterCompetitionDetail', { competitionId: c.id })}
                  style={S.card}
                >
                  <View style={S.cardHeader}>
                    <View style={S.cardIcon}>
                      <Globe2 size={20} color={ax.accentText} />
                    </View>
                    <View style={S.cardHead}>
                      <Text style={S.cardTitle} numberOfLines={2}>{c.title}</Text>
                      <View style={S.badgeRow}>
                        <AxStatusDot label={STATUS_LABEL[c.status] ?? c.status} tone={statusTone} testID={`inter-status-${c.id}`} />
                        <AxTag label={FORMAT_LABEL[c.format] ?? c.format} testID={`inter-format-${c.id}`} />
                        <AxTag label={c.type === 'individual' ? t('interComp.individual') : t('interComp.team', { n: c.team_size })} tone="muted" />
                      </View>
                    </View>
                  </View>

                  {c.description ? (
                    <Text style={S.cardDesc} numberOfLines={2}>{c.description}</Text>
                  ) : null}

                  <View style={S.cardFooter}>
                    <View style={S.footerItem}>
                      <Users size={12} color={ax.textMuted} />
                      <Text style={S.footerText} testID={`inter-count-${c.id}`}>
                        {t('interComp.registered', { count: `${c.reg_count}${c.max_participants ? `/${c.max_participants}` : ''}` })}
                      </Text>
                    </View>
                    {c.starts_at && (
                      <View style={S.footerItem}>
                        <Calendar size={12} color={ax.textMuted} />
                        <Text style={S.footerText}>{new Date(c.starts_at).toLocaleDateString(dateLocale())}</Text>
                      </View>
                    )}
                    {c.my_registration && <AxTag label={stripGlyph(t('interComp.registeredBadge'))} dot />}
                    <ChevronRight size={16} color={ax.textMuted} style={S.chevron} />
                  </View>
                </AxCard>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    headerSub: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
    content: { padding: axSpacing.lg, gap: axSpacing.md },
    card: { gap: axSpacing.sm },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.md },
    cardIcon: {
      width: 40, height: 40, borderRadius: axRadius.control,
      borderWidth: 1, borderColor: c.border,
      justifyContent: 'center', alignItems: 'center',
    },
    cardHead: { flex: 1, minWidth: 0, gap: axSpacing.sm },
    cardTitle: { ...axTypography.titleM, color: c.text },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: axSpacing.sm },
    cardDesc: { ...axTypography.bodySmall, color: c.textMuted },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, flexWrap: 'wrap' },
    footerItem: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    footerText: { ...axTypography.caption, color: c.textMuted },
    chevron: { marginLeft: 'auto' },
    empty: { alignItems: 'center', paddingTop: 80, gap: axSpacing.md, paddingHorizontal: axSpacing['2xl'] },
    emptyTitle: { ...axTypography.label, color: c.text, textAlign: 'center' },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  });
}
