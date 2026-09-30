import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxContentTitle } from '../../components/ax/AxContentTitle';
import i18n from '../../i18n';
import { AxButton, AxCard, AxTag } from '../../components/ax';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Image, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { Globe, Instagram, Tag, Copy, ExternalLink, Handshake } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { HomeStackParamList } from '../../navigation';
import { Partner } from '../../types';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav = NativeStackNavigationProp<HomeStackParamList>;
type Route = RouteProp<HomeStackParamList, 'PartnerDetail'>;

const CATEGORY_LABELS: Record<string, string> = {
  nutrition: 'Nutrition', equipment: 'Équipement', apparel: 'Vêtements',
  supplements: 'Compléments', recovery: 'Récupération', coaching: 'Coaching',
  software: 'Logiciel', other: 'Autres',
};

export default function PartnerDetailScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const c = theme.ax;
  const s = createStyles(c);

  const partnerId = route.params?.partnerId;
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) return;
    (async () => {
      try {
        const { data, error } = await supabase.from('partners')
          .select('*')
          .eq('id', partnerId)
          .single();
        if (error) throw error;
        setPartner(data as Partner);
      } catch (e) {
        captureError(e, { screen: 'PartnerDetail', action: 'load' });
      }
      setLoading(false);
    })();
  }, [partnerId]);

  function copyCode(code: string) {
    try {
      const { Clipboard: RNClipboard } = require('react-native');
      RNClipboard?.setString?.(code);
    } catch (_) {}
    Alert.alert('Code copié !', `Le code "${code}" a été copié dans le presse-papier.`);
  }

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <GlassBackground />
        <ActivityIndicator size="large" color={c.accentText} />
      </View>
    );
  }

  if (!partner) {
    return (
      <View style={[s.container, s.center]}>
        <GlassBackground />
        <Text style={s.emptyText}>Partenaire introuvable</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader title={i18n.t('screenTitles.partner')} />

      <ScrollView contentContainerStyle={{ paddingBottom: tabSpace }}>
        {/* Logo + info */}
        <View style={s.heroSection}>
          {partner.logo_url ? (
            <Image source={{ uri: partner.logo_url }} style={s.logo} />
          ) : (
            <View style={[s.logo, s.logoPlaceholder]}>
              <Handshake size={36} color={c.accentText} />
            </View>
          )}
          <Text style={s.name}>{partner.name}</Text>
          <AxTag label={CATEGORY_LABELS[partner.category] ?? partner.category} />
        </View>

        <View style={s.body}>
          {/* Description */}
          {partner.description ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>À propos</Text>
              <Text style={s.descText}>{partner.description}</Text>
            </View>
          ) : null}

          {/* Offer */}
          {(partner.offer_title || partner.offer_description) && (
            <AxCard variant="featured" style={s.offerCard} testID="partner-offer">
              <View style={s.offerHeader}>
                <Tag size={16} color={c.accentText} />
                <Text style={s.offerTitle}>{partner.offer_title ?? 'Offre spéciale'}</Text>
              </View>
              {partner.offer_description ? (
                <Text style={s.offerDesc}>{partner.offer_description}</Text>
              ) : null}
              {partner.offer_code ? (
                <AxButton
                  label={partner.offer_code}
                  icon={Copy}
                  onPress={() => copyCode(partner.offer_code!)}
                  fullWidth
                  testID="partner-offer-code"
                />
              ) : null}
            </AxCard>
          )}

          {/* Links */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Liens</Text>
            <View style={s.linkList}>
              {partner.website_url && (
                <AxCard
                  style={s.linkBtn}
                  onPress={() => Linking.openURL(partner.website_url!)}
                  accessibilityLabel="Site web"
                  testID="partner-link-website"
                >
                  <Globe size={16} color={c.accentText} />
                  <Text style={s.linkText}>Site web</Text>
                  <ExternalLink size={14} color={c.textMuted} />
                </AxCard>
              )}
              {partner.instagram_url && (
                <AxCard
                  style={s.linkBtn}
                  onPress={() => Linking.openURL(partner.instagram_url!)}
                  accessibilityLabel="Instagram"
                  testID="partner-link-instagram"
                >
                  <Instagram size={16} color={c.accentText} />
                  <Text style={s.linkText}>Instagram</Text>
                  <ExternalLink size={14} color={c.textMuted} />
                </AxCard>
              )}
            </View>
          </View>
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
    heroSection: { alignItems: 'center', gap: axSpacing.sm, paddingVertical: axSpacing['2xl'], paddingHorizontal: axSpacing.xl },
    logo: { width: 80, height: 80, borderRadius: axRadius.card },
    logoPlaceholder: {
      backgroundColor: c.field, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    name: { ...axTypography.titleL, color: c.text, textAlign: 'center', marginTop: axSpacing.sm },
    body: { paddingHorizontal: axSpacing.xl },
    section: { marginTop: axSpacing['2xl'] },
    sectionTitle: { ...axTypography.overline, color: c.textMuted, marginBottom: axSpacing.md },
    descText: { ...axTypography.body, color: c.text },
    offerCard: { marginTop: axSpacing['2xl'] },
    offerHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    offerTitle: { ...axTypography.titleM, color: c.text, flex: 1, minWidth: 0 },
    offerDesc: { ...axTypography.bodySmall, color: c.textMuted },
    linkList: { gap: axSpacing.sm },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
    linkText: { ...axTypography.label, color: c.text, flex: 1, minWidth: 0 },
  });
}
