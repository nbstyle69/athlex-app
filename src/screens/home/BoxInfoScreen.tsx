import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Linking,
} from 'react-native';
import { MapPin, Globe, Mail, Users, Calendar, Trophy, Building2, Phone, Navigation, User } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import UserAvatar from '../../components/UserAvatar';
import { AxCard } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

interface BoxInfo {
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  website_url: string | null;
  contact_email: string | null;
  phone: string | null;
  google_maps_url: string | null;
  founded_at: string | null;
  created_at: string;
  memberCount: number;
  avgElo: number;
  joinedAt: string | null;
  ownerName: string | null;
  coaches: { id: string; username: string; avatar_url: string | null }[];
}

export default function BoxInfoScreen({ navigation }: any) {
  const tabSpace = useTabBarScrollSpace();
  const { currentBox, user } = useAuth();
  const { theme } = useTheme();
  const S = createStyles(theme);
  const c = theme.ax;
  const [info, setInfo] = useState<BoxInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBox || !user) return;
    (async () => {
      try {
        const [{ data: boxRaw }, { count }, { data: elos }, { data: membership }] = await Promise.all([
          supabase.from('boxes').select('name, description, logo_url, address, website_url, contact_email, phone, google_maps_url, founded_at, owner_id, created_at').eq('id', currentBox.id).single(),
          supabase.from('box_members').select('id', { count: 'exact', head: true }).eq('box_id', currentBox.id).eq('status', 'active'),
          supabase.from('box_members').select('member_id, profiles(elo)').eq('box_id', currentBox.id).eq('status', 'active'),
          supabase.from('box_members').select('joined_at').eq('box_id', currentBox.id).eq('member_id', user.id).eq('status', 'active').maybeSingle(),
        ]);
        const box = boxRaw as any;

        const eloValues = (elos ?? []).map((e: any) => e.profiles?.elo).filter((v: any) => typeof v === 'number');
        const avgElo = eloValues.length > 0 ? Math.round(eloValues.reduce((a: number, b: number) => a + b, 0) / eloValues.length) : 0;

        // Fetch owner name
        let ownerName: string | null = null;
        if (box?.owner_id) {
          const { data: ownerProfile } = await supabase.from('profiles').select('username').eq('id', box.owner_id).single();
          ownerName = ownerProfile?.username ?? null;
        }

        // Fetch coaches
        const { data: coachMembers } = await supabase
          .from('box_members')
          .select('member_id, profiles:member_id(username, avatar_url)')
          .eq('box_id', currentBox.id)
          .eq('role', 'coach');
        const coaches = (coachMembers ?? []).map((c: any) => ({
          id: c.member_id,
          username: (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.username ?? 'Coach',
          avatar_url: (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.avatar_url ?? null,
        }));

        setInfo({
          name: box?.name ?? currentBox.name,
          description: box?.description ?? null,
          logo_url: box?.logo_url ?? currentBox.logo_url ?? null,
          address: box?.address ?? null,
          website_url: box?.website_url ?? null,
          contact_email: box?.contact_email ?? null,
          phone: box?.phone ?? null,
          google_maps_url: box?.google_maps_url ?? null,
          founded_at: box?.founded_at ?? null,
          created_at: box?.created_at ?? currentBox.created_at,
          memberCount: count ?? 0,
          avgElo,
          joinedAt: membership?.joined_at ?? null,
          ownerName,
          coaches,
        });
      } catch (e) {
        captureError(e, { screen: 'BoxInfo', action: 'load' });
      }
      setLoading(false);
    })();
  }, [currentBox, user]);

  if (loading) {
    return (
      <View style={[S.container, S.center]}>
      <GlassBackground />
        <ActivityIndicator size="large" color={c.accentText} />
      </View>
    );
  }

  if (!info) {
    return (
      <View style={[S.container, S.center]}>
      <GlassBackground />
        <Text style={S.emptyText}>Aucune information disponible</Text>
      </View>
    );
  }

  const foundedDate = info.founded_at ? new Date(info.founded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const createdDate = new Date(info.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const joinedDate = info.joinedAt ? new Date(info.joinedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title="Informations" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.content, { paddingBottom: tabSpace }]}>
        {/* Logo + Name */}
        <AxCard testID="boxinfo-hero" style={S.heroSection}>
          {info.logo_url ? (
            <Image source={{ uri: info.logo_url }} style={S.logo} />
          ) : (
            <View style={[S.logo, S.logoPlaceholder]}>
              <Building2 color={c.textMuted} size={40} />
            </View>
          )}
          <Text testID="boxinfo-name" style={S.boxName}>{info.name}</Text>
          {info.description ? (
            <Text testID="boxinfo-desc" style={S.boxDesc}>{info.description}</Text>
          ) : null}
        </AxCard>

        {/* Stats row */}
        <View style={S.statsRow}>
          <AxCard testID="boxinfo-stat-members" style={S.statCard}>
            <Users color={c.accentText} size={20} />
            <Text style={S.statValue}>{info.memberCount}</Text>
            <Text style={S.statLabel} numberOfLines={1}>Membres</Text>
          </AxCard>
          <AxCard testID="boxinfo-stat-elo" style={S.statCard}>
            <Trophy color={c.warning} size={20} />
            <Text style={S.statValue}>{info.avgElo}</Text>
            <Text style={S.statLabel} numberOfLines={1}>ELO moyen</Text>
          </AxCard>
          <AxCard testID="boxinfo-stat-created" style={S.statCard}>
            <Calendar color={c.textMuted} size={20} />
            <Text style={S.statValue}>{new Date(info.created_at).getFullYear()}</Text>
            <Text style={S.statLabel} numberOfLines={1}>Création</Text>
          </AxCard>
        </View>

        {/* Info cards */}
        <AxCard testID="boxinfo-contact" style={S.infoSection}>
          {info.address ? (
            <View style={S.infoRow}>
              <MapPin color={c.accentText} size={18} />
              <View style={S.infoContent}>
                <Text style={S.infoLabel}>ADRESSE</Text>
                <Text style={S.infoValue}>{info.address}</Text>
              </View>
            </View>
          ) : null}

          {info.website_url ? (
            <TouchableOpacity testID="boxinfo-website" style={S.infoRow} onPress={() => Linking.openURL(info.website_url!)} activeOpacity={0.7}>
              <Globe color={c.accentText} size={18} />
              <View style={S.infoContent}>
                <Text style={S.infoLabel}>SITE WEB</Text>
                <Text style={[S.infoValue, S.link]}>{info.website_url}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {info.contact_email ? (
            <TouchableOpacity testID="boxinfo-email" style={S.infoRow} onPress={() => Linking.openURL(`mailto:${info.contact_email}`)} activeOpacity={0.7}>
              <Mail color={c.accentText} size={18} />
              <View style={S.infoContent}>
                <Text style={S.infoLabel}>CONTACT</Text>
                <Text style={[S.infoValue, S.link]}>{info.contact_email}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {info.phone ? (
            <TouchableOpacity testID="boxinfo-phone" style={S.infoRow} onPress={() => Linking.openURL(`tel:${info.phone}`)} activeOpacity={0.7}>
              <Phone color={c.accentText} size={18} />
              <View style={S.infoContent}>
                <Text style={S.infoLabel}>TÉLÉPHONE</Text>
                <Text style={[S.infoValue, S.link]}>{info.phone}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {info.google_maps_url ? (
            <TouchableOpacity testID="boxinfo-maps" style={[S.infoRow, S.infoRowLast]} onPress={() => Linking.openURL(info.google_maps_url!)} activeOpacity={0.7}>
              <Navigation color={c.accentText} size={18} />
              <View style={S.infoContent}>
                <Text style={S.infoLabel}>LOCALISATION</Text>
                <Text style={[S.infoValue, S.link]}>Voir sur Google Maps</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </AxCard>

        {/* Owner & coaches */}
        {(info.ownerName || info.coaches.length > 0) ? (
          <AxCard testID="boxinfo-people" style={S.infoSection}>
            {info.ownerName ? (
              <View style={S.infoRow}>
                <User color={c.accentText} size={18} />
                <View style={S.infoContent}>
                  <Text style={S.infoLabel}>PROPRIÉTAIRE</Text>
                  <Text style={S.infoValue}>{info.ownerName}</Text>
                </View>
              </View>
            ) : null}
            {info.coaches.length > 0 ? (
              <View style={[S.infoRow, S.infoRowLast]}>
                <Users color={c.accentText} size={18} />
                <View style={S.infoContent}>
                  <Text style={S.infoLabel}>COACHS</Text>
                  <View style={S.coachList}>
                    {info.coaches.map(co => (
                      <View key={co.id} style={S.coachChip}>
                        <UserAvatar uri={co.avatar_url} name={co.username} size={22} borderRadius={axRadius.badge} backgroundColor={c.surface} textColor={c.text} fontSize={9} />
                        <Text style={S.coachName} numberOfLines={1}>{co.username}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
          </AxCard>
        ) : null}

        {/* Dates */}
        <AxCard testID="boxinfo-dates" style={S.datesCard}>
          {foundedDate ? (
            <View style={S.dateRow}>
              <Text style={S.dateLabel}>Ouverture de la salle</Text>
              <Text style={S.dateValue}>{foundedDate}</Text>
            </View>
          ) : null}
          <View style={[S.dateRow, foundedDate ? S.dateRowSep : null]}>
            <Text style={S.dateLabel}>Création de la box</Text>
            <Text style={S.dateValue}>{createdDate}</Text>
          </View>
          {joinedDate ? (
            <View style={[S.dateRow, S.dateRowSep]}>
              <Text style={S.dateLabel}>Inscrit depuis le</Text>
              <Text style={S.dateValue}>{joinedDate}</Text>
            </View>
          ) : null}
        </AxCard>
      </ScrollView>
    </View>
  );
}

function createStyles(t: AppTheme) {
  const c = t.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { justifyContent: 'center', alignItems: 'center' },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted },
    content: { padding: axSpacing.xl, gap: axSpacing.md },
    heroSection: { alignItems: 'center', gap: axSpacing.md, padding: axSpacing.xl },
    logo: { width: 100, height: 100, borderRadius: axRadius.card, backgroundColor: c.field },
    logoPlaceholder: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.fieldBorder, borderStyle: 'dashed' },
    boxName: { ...axTypography.titleM, color: c.text, textAlign: 'center' },
    boxDesc: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    statsRow: { flexDirection: 'row', gap: axSpacing.sm },
    statCard: { flex: 1, minWidth: 0, padding: axSpacing.md, alignItems: 'center', gap: axSpacing.xs },
    statValue: { ...axTypography.numberM, color: c.text },
    statLabel: { ...axTypography.caption, color: c.textMuted },
    infoSection: { padding: 0, overflow: 'hidden' },
    infoRow: {
      flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, padding: axSpacing.lg,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    infoRowLast: { borderBottomWidth: 0 },
    infoContent: { flex: 1, minWidth: 0, gap: 2 },
    infoLabel: { ...axTypography.overlineSmall, color: c.textMuted },
    infoValue: { ...axTypography.label, color: c.text },
    link: { color: c.accentText },
    datesCard: { padding: axSpacing.lg, gap: axSpacing.md },
    dateRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm },
    dateRowSep: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: axSpacing.md },
    dateLabel: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1 },
    dateValue: { ...axTypography.label, color: c.text },
    coachList: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm, marginTop: axSpacing.xs },
    coachChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
      backgroundColor: c.field, borderRadius: axRadius.control, paddingHorizontal: 10, paddingVertical: 6,
      borderWidth: 1, borderColor: c.border,
    },
    coachName: { ...axTypography.labelSmall, color: c.text, flexShrink: 1 },
  });
}
