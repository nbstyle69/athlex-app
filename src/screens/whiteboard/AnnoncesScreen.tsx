import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Megaphone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxCard, AxTag } from '../../components/ax';
import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { axSpacing, axTypography } from '../../theme/axTokens';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

interface Annonce {
  id: string;
  title: string;
  body: string;
  target: string;
  created_at: string;
}

export const lastSeenAnnoncesKey = (userId: string, boxId: string) => `lastSeenAnnonces_${userId}_${boxId}`;

function formatDate(iso: string, lang: string) {
  const locale = lang.startsWith('en') ? 'en-GB' : 'fr-FR';
  const d = new Date(iso);
  return `${d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
}

export default function AnnoncesScreen() {
  const { t, i18n } = useTranslation();
  const tabSpace = useTabBarScrollSpace();
  const { currentBox, user } = useAuth();
  const { theme } = useTheme();
  const S = styles(theme);
  const c = theme.ax;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [annonces, setAnnonces] = useState<Annonce[]>([]);

  const load = useCallback(async () => {
    if (!currentBox || !user) { setLoading(false); return; }
    // La RLS (notif_member_read / box_notifs_member_read) ne rend que les
    // annonces adressées à toute la box ou à ce membre.
    const { data, error } = await supabase
      .from('box_notifications')
      .select('id, title, body, target, created_at')
      .eq('box_id', currentBox.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      captureError(error, { screen: 'Annonces', action: 'load' });
      setFailed(true);
    } else {
      setFailed(false);
      setAnnonces((data ?? []) as Annonce[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [currentBox, user]);

  useFocusEffect(useCallback(() => {
    load();
    if (user && currentBox) {
      AsyncStorage.setItem(lastSeenAnnoncesKey(user.id, currentBox.id), new Date().toISOString());
    }
  }, [load, user, currentBox]));

  if (loading) {
    return (
      <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <GlassBackground />
        <ActivityIndicator size="large" color={c.accentText} />
      </View>
    );
  }

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title={t('whiteboard.announcementsTitle')} />
      <ScrollView
        testID="annonces-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.list, { paddingBottom: tabSpace }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {failed ? (
          <Text testID="annonces-error" style={S.errorText}>{t('auth.errors.generic')}</Text>
        ) : annonces.length === 0 ? (
          <View testID="annonces-empty" style={S.empty}>
            <Megaphone color={c.textMuted} size={32} strokeWidth={1.75} />
            <Text style={S.emptyTitle}>{t('whiteboard.announcementsEmptyTitle')}</Text>
            <Text style={S.emptyBody}>{t('whiteboard.announcementsEmptyBody')}</Text>
          </View>
        ) : annonces.map((a, i) => {
          const forMe = a.target === user?.id;
          return (
            <AxCard key={a.id} testID={`annonce-${a.id}`} variant={i === 0 ? 'featured' : 'standard'} style={S.card}>
              <View style={S.cardHead}>
                <AxTag
                  testID={`annonce-tag-${a.id}`}
                  label={forMe ? t('whiteboard.announcementForYou') : t('whiteboard.announcementWholeBox')}
                  tone={forMe ? 'accent' : 'muted'}
                />
                <Text style={S.date}>{formatDate(a.created_at, i18n.language)}</Text>
              </View>
              <Text style={S.title}>{a.title}</Text>
              <Text style={S.body}>{a.body}</Text>
            </AxCard>
          );
        })}
      </ScrollView>
    </View>
  );
}

function styles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    list: { padding: axSpacing.lg, gap: axSpacing.lg },
    card: { gap: axSpacing.md },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.sm },
    date: { ...axTypography.caption, color: c.textMuted, flexShrink: 1, textAlign: 'right' },
    title: { ...axTypography.titleM, color: c.text },
    body: { ...axTypography.bodySmall, color: c.textMuted },
    errorText: { ...axTypography.bodySmall, textAlign: 'center', color: c.textMuted, marginTop: 60 },
    empty: { alignItems: 'center', gap: axSpacing.sm, marginTop: 60, paddingHorizontal: axSpacing.xl },
    emptyTitle: { ...axTypography.titleM, color: c.text, textAlign: 'center' },
    emptyBody: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  });
}
