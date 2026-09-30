import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxCard } from '../../components/ax';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { Sparkles, Bug, RefreshCw, type LucideIcon } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { writeOk } from '../../lib/db';
import { CHANGELOG_WINDOW } from '../../lib/changelog';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { readableInk } from './homeLevelColor';

interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  type: 'fix' | 'feature' | 'update';
  created_at: string;
  isRead: boolean;
}

const TYPE_META: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  feature: { icon: Sparkles,  label: 'Nouveauté', color: '#10B981' },
  fix:     { icon: Bug,       label: 'Correction', color: '#EF4444' },
  update:  { icon: RefreshCw, label: 'Mise à jour', color: '#3B82F6' },
};

export default function ChangelogScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const S = createStyles(theme);

  const [entries, setEntries]   = useState<ChangelogEntry[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
    const [{ data: changelog }, { data: reads }] = await Promise.all([
      supabase
        .from('app_changelog')
        .select('id, title, body, type, created_at')
        .order('created_at', { ascending: false })
        .limit(CHANGELOG_WINDOW),
      supabase
        .from('changelog_reads')
        .select('changelog_id')
        .eq('user_id', user.id),
    ]);

    const readSet = new Set((reads ?? []).map(r => r.changelog_id));

    setEntries((changelog ?? []).map(c => ({
      ...c,
      type: c.type as 'fix' | 'feature' | 'update',
      isRead: readSet.has(c.id),
    })));
    setLoading(false);

    // Marque comme lues les nouveautés de la fenêtre affichée — la même que
    // celle comptée par la cloche. L'échec est remonté, pas avalé : sans ça un
    // refus d'écriture laisse un badge qui ressuscite sans aucun signal.
    const unread = (changelog ?? []).filter(c => !readSet.has(c.id));
    if (unread.length > 0) {
      const rows = unread.map(c => ({ user_id: user.id, changelog_id: c.id }));
      const ok = await writeOk(
        supabase.from('changelog_reads').upsert(rows, { onConflict: 'user_id,changelog_id' }),
        { screen: 'Changelog', action: 'markRead' },
      );
      if (ok) {
        setEntries(prev => prev.map(e => ({ ...e, isRead: true })));
        queryClient.invalidateQueries({ queryKey: ['home'] });
      }
    }
    } catch (e) { captureError(e, { screen: 'Changelog', action: 'load' }); setLoading(false); }
  }, [user, queryClient]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function renderEntry({ item }: { item: ChangelogEntry }) {
    const meta = TYPE_META[item.type] ?? TYPE_META.update;
    const ink = readableInk(meta.color, theme.ax);
    return (
      <AxCard style={[S.card, !item.isRead && S.cardUnread]} testID={`changelog-${item.id}`}>
        <View style={S.cardHeader}>
          <View style={[S.typeBadge, { borderColor: ink }]} testID={`changelog-${item.id}-type`}>
            <meta.icon color={ink} size={12} />
            <Text style={[S.typeBadgeText, { color: ink }]}>{meta.label}</Text>
          </View>
          <Text style={S.date}>{formatDate(item.created_at)}</Text>
          {!item.isRead && <View style={S.unreadDot} testID={`changelog-${item.id}-unread`} />}
        </View>
        <Text style={S.title}>{item.title}</Text>
        {item.body ? <Text style={S.body}>{item.body}</Text> : null}
      </AxCard>
    );
  }

  return (
    <View style={S.container}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader title="Nouveautés" />

      {loading ? (
        <ActivityIndicator size="large" color={theme.ax.accentText} style={{ marginTop: 40 }} />
      ) : entries.length === 0 ? (
        <View style={S.empty}>
          <Sparkles size={48} color={theme.ax.textMuted} />
          <Text style={S.emptyText}>Aucune nouveauté pour le moment</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.id}
          renderItem={renderEntry}
          contentContainerStyle={{ padding: 16, paddingBottom: tabSpace }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    card: { marginBottom: axSpacing.md, gap: 4 },
    cardUnread: { borderLeftWidth: 3, borderLeftColor: c.accent },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
    typeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: axRadius.badge, borderWidth: 1,
    },
    typeBadgeText: { ...axTypography.labelSmall },
    date: { ...axTypography.caption, color: c.textMuted, flex: 1, textAlign: 'right' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, marginLeft: 4 },
    title: { ...axTypography.label, color: c.text },
    body: { ...axTypography.bodySmall, color: c.textMuted },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
    emptyText: { ...axTypography.body, color: c.textMuted, textAlign: 'center' },
  });
}
