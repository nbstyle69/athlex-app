import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxCard, AxTag } from '../../components/ax';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Image, ActivityIndicator, Linking,
} from 'react-native';
import { MapPin, Globe, Mail, Phone, Users, Calendar, Instagram, Dumbbell, ExternalLink, Clock } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { BOX_COLUMNS } from '../../lib/boxColumns';
import { captureError } from '../../lib/sentry';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { HomeStackParamList } from '../../navigation';
import { Box } from '../../types';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav = NativeStackNavigationProp<HomeStackParamList>;
type Route = RouteProp<HomeStackParamList, 'BoxDirectoryDetail'>;

const SPORT_LABELS: Record<string, string> = {
  crossfit: 'Functional', weightlifting: 'Haltérophilie', gymnastics: 'Gymnastique',
  hiit: 'HIIT', yoga: 'Yoga', boxing: 'Boxe', mma: 'MMA',
  functional: 'Functional', hyrox: 'Hybrid',
};

const SERVICE_LABELS: Record<string, string> = {
  parking: 'Parking', showers: 'Douches', lockers: 'Casiers',
  shop: 'Boutique', nutrition: 'Nutrition', physio: 'Kiné',
  childcare: 'Garderie', sauna: 'Sauna', openGym: 'Open Gym',
};

export default function BoxDirectoryDetailScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const c = theme.ax;
  const s = createStyles(c);

  const boxId = route.params?.boxId;
  const [box, setBox] = useState<Box | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boxId) return;
    (async () => {
      try {
        const [{ data: boxData }, { count }] = await Promise.all([
          supabase.from('boxes').select(BOX_COLUMNS).eq('id', boxId).single(),
          supabase.from('box_members').select('id', { count: 'exact', head: true }).eq('box_id', boxId).eq('status', 'active'),
        ]);
        setBox(boxData as unknown as Box);
        setMemberCount(count ?? 0);
      } catch (e) {
        captureError(e, { screen: 'BoxDirectoryDetail', action: 'load' });
      }
      setLoading(false);
    })();
  }, [boxId]);

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <GlassBackground />
        <ActivityIndicator size="large" color={c.accentText} />
      </View>
    );
  }

  // Box inexistante, ou cachée par la base (archivée, en archivage programmé).
  if (!box) {
    return (
      <View style={s.container}>
        <GlassBackground />
        <AxScreenHeader title={t('boxAccess.notFoundTitle')} />
        <View style={s.center}>
          <Text style={s.emptyText}>{t('boxAccess.notFoundBody')}</Text>
        </View>
      </View>
    );
  }

  function openLink(url?: string) {
    if (url) Linking.openURL(url).catch(() => {});
  }

  const sports = (box.sport_type ?? []).map(s => SPORT_LABELS[s] ?? s);
  const services = (box.services ?? []).map(s => SERVICE_LABELS[s] ?? s);

  return (
    <View style={s.container}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader title={box.name} />

      <ScrollView contentContainerStyle={{ paddingBottom: tabSpace }}>
        {/* Cover / Logo */}
        <View style={s.heroWrap}>
          {box.cover_url ? (
            <Image source={{ uri: box.cover_url }} style={s.cover} />
          ) : (
            <View style={[s.cover, s.coverPlaceholder]} />
          )}
          <View style={s.logoWrap}>
            {box.logo_url ? (
              <Image source={{ uri: box.logo_url }} style={s.logo} />
            ) : (
              <View style={[s.logo, s.logoPlaceholder]}>
                <Text style={s.logoLetter}>{box.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.body}>
          <AxCard variant="featured" testID="box-detail-card">
            {/* Name & tagline */}
            <Text style={s.name}>{box.name}</Text>
            {box.tagline ? <Text style={s.tagline}>{box.tagline}</Text> : null}

            {/* Stats row */}
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Users size={14} color={c.accentText} />
                <Text style={s.statVal}>{memberCount}</Text>
                <Text style={s.statLabel}>membres</Text>
              </View>
              {box.founded_at ? (
                <View style={s.statItem}>
                  <Calendar size={14} color={c.accentText} />
                  <Text style={s.statVal}>{new Date(box.founded_at).getFullYear()}</Text>
                  <Text style={s.statLabel}>fondée</Text>
                </View>
              ) : null}
              {sports.length > 0 ? (
                <View style={s.statItem}>
                  <Dumbbell size={14} color={c.accentText} />
                  <Text style={s.statVal}>{sports.length}</Text>
                  <Text style={s.statLabel}>sports</Text>
                </View>
              ) : null}
            </View>
          </AxCard>

          {/* Description */}
          {box.description ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>À propos</Text>
              <Text style={s.descText}>{box.description}</Text>
            </View>
          ) : null}

          {/* Sports */}
          {sports.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Sports</Text>
              <View style={s.badgeRow}>
                {sports.map(sp => (
                  <AxTag key={sp} label={sp} />
                ))}
              </View>
            </View>
          )}

          {/* Services */}
          {services.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Services</Text>
              <View style={s.badgeRow}>
                {services.map(sv => (
                  <AxTag key={sv} tone="muted" label={sv} />
                ))}
              </View>
            </View>
          )}

          {/* Contact info */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Contact</Text>
            <View style={s.infoList}>
              {box.address && (
                <Pressable style={s.infoRow} onPress={() => openLink(box.google_maps_url)} accessibilityRole="link">
                  <MapPin size={16} color={c.accentText} />
                  <Text style={s.infoText}>{box.address}{box.city ? `, ${box.city}` : ''}</Text>
                  {box.google_maps_url && <ExternalLink size={14} color={c.textMuted} />}
                </Pressable>
              )}
              {box.phone && (
                <Pressable style={s.infoRow} onPress={() => Linking.openURL(`tel:${box.phone}`)} accessibilityRole="link">
                  <Phone size={16} color={c.accentText} />
                  <Text style={s.infoText}>{box.phone}</Text>
                </Pressable>
              )}
              {box.contact_email && (
                <Pressable style={s.infoRow} onPress={() => Linking.openURL(`mailto:${box.contact_email}`)} accessibilityRole="link">
                  <Mail size={16} color={c.accentText} />
                  <Text style={s.infoText}>{box.contact_email}</Text>
                </Pressable>
              )}
              {box.website_url && (
                <Pressable style={s.infoRow} onPress={() => openLink(box.website_url)} accessibilityRole="link">
                  <Globe size={16} color={c.accentText} />
                  <Text style={s.infoText}>{box.website_url}</Text>
                </Pressable>
              )}
              {box.instagram_url && (
                <Pressable style={s.infoRow} onPress={() => openLink(box.instagram_url)} accessibilityRole="link">
                  <Instagram size={16} color={c.accentText} />
                  <Text style={s.infoText}>Instagram</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Opening hours */}
          {box.opening_hours && Object.keys(box.opening_hours).length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Horaires</Text>
              <AxCard style={s.hoursCard} testID="box-detail-hours">
                {Object.entries(box.opening_hours).map(([day, hours]) => (
                  <View key={day} style={s.hoursRow}>
                    <Text style={s.hoursDay}>{day}</Text>
                    <Text style={s.hoursVal}>{hours}</Text>
                  </View>
                ))}
              </AxCard>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}


function createStyles(c: AxColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: axSpacing['2xl'] },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    heroWrap: { position: 'relative' },
    cover: { width: '100%', height: 160 },
    coverPlaceholder: { backgroundColor: c.surface },
    logoWrap: {
      position: 'absolute', bottom: -32, left: axSpacing.xl,
      borderRadius: axRadius.card + 3, borderWidth: 3, borderColor: c.background,
      overflow: 'hidden',
    },
    logo: { width: 64, height: 64, borderRadius: axRadius.card },
    logoPlaceholder: {
      backgroundColor: c.field, alignItems: 'center', justifyContent: 'center',
    },
    logoLetter: { ...axTypography.titleL, color: c.accentText },
    body: { paddingHorizontal: axSpacing.xl, paddingTop: 44 },
    name: { ...axTypography.titleL, color: c.text },
    tagline: { ...axTypography.bodySmall, color: c.textMuted },
    statsRow: {
      flexDirection: 'row', flexWrap: 'wrap', columnGap: axSpacing.xl, rowGap: axSpacing.sm,
      paddingTop: axSpacing.md, borderTopWidth: 1, borderColor: c.border,
    },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    statVal: { ...axTypography.label, color: c.text },
    statLabel: { ...axTypography.bodySmall, color: c.textMuted },
    section: { marginTop: axSpacing['2xl'] },
    sectionTitle: { ...axTypography.overline, color: c.textMuted, marginBottom: axSpacing.md },
    descText: { ...axTypography.body, color: c.text },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm },
    infoList: { gap: axSpacing.xs },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, minHeight: 44 },
    infoText: { ...axTypography.bodySmall, color: c.text, flex: 1, minWidth: 0 },
    hoursCard: { gap: 0, paddingVertical: axSpacing.sm },
    hoursRow: { flexDirection: 'row', justifyContent: 'space-between', gap: axSpacing.md, paddingVertical: 6 },
    hoursDay: { ...axTypography.labelSmall, color: c.text, textTransform: 'capitalize' },
    hoursVal: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1, textAlign: 'right' },
  });
}
