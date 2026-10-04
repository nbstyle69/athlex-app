import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Send, Clock, CircleCheck, ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import GlassBackground from '../../components/glass/GlassBackground';
import { AxButton, AxCard, AxChip, AxTextField } from '../../components/ax';
import { axAccentSafeLineHeight, axSpacing, axTypography } from '../../theme/axTokens';

interface Member { user_id: string; username: string }
interface SentNotif { id: string; title: string; body: string; target: string; created_at: string }

export default function BONotificationsScreen() {
  const navigation = useNavigation();
  const { currentBox } = useAuth();
  const { theme } = useTheme();
  const c = theme.ax;
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'fr-FR';

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [history, setHistory] = useState<SentNotif[]>([]);

  // Form
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'all' | string>('all'); // 'all' or user_id

  const load = useCallback(async () => {
    if (!currentBox) { setLoading(false); return; }
    try {
    const [{ data: mbrs }, { data: notifs }] = await Promise.all([
      supabase.from('box_members')
        .select('member_id, profiles(username)')
        .eq('box_id', currentBox.id).eq('status', 'active'),
      supabase.from('box_notifications')
        .select('*')
        .eq('box_id', currentBox.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setMembers((mbrs ?? []).map((m: any) => ({
      user_id: m.member_id,
      username: m.profiles?.username ?? '?',
    })));
    setHistory(notifs ?? []);
    } catch (e) { captureError(e, { screen: 'BONotifications', action: 'load' }); }
    setLoading(false);
    setRefreshing(false);
  }, [currentBox]);

  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    if (!title.trim()) { Alert.alert(t('common.error'), t('bo.notifications.titleRequired')); return; }
    if (!currentBox) return;

    setSending(true);
    const { data: inserted, error } = await supabase.from('box_notifications').insert({
      box_id: currentBox.id,
      title: title.trim(),
      body: body.trim(),
      target: target === 'all' ? 'all' : target,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    }).select('id').single();

    if (error || !inserted) {
      captureError(error, { screen: 'BONotifications', action: 'send' });
      Alert.alert(t('common.error'), error?.message ?? t('bo.notifications.saveFailed'));
      setSending(false);
      return;
    }

    // Deliver as a real push (service-role Edge Function reads member tokens).
    const { data: pushRes, error: pushErr } = await supabase.functions.invoke('send-box-notification', {
      body: { notification_id: inserted.id },
    });
    if (pushErr) {
      captureError(pushErr, { screen: 'BONotifications', action: 'push' });
      Alert.alert(t('bo.notifications.savedTitle'), t('bo.notifications.pushFailed'));
    } else {
      const recipients = pushRes?.sent ?? 0;
      Alert.alert(t('bo.notifications.sentTitle'), t('bo.notifications.sentMsg', { count: recipients }));
    }
    setTitle('');
    setBody('');
    setTarget('all');
    load();
    setSending(false);
  }

  if (loading) {
    return (
      <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <GlassBackground />
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={S.container}>
      <GlassBackground />
      {/* En-tête de la maquette « Notifications (envoi) » : ‹, cloche, titre Oswald en capitales. */}
      <View testID="bo-notif-header" style={[S.header, { paddingTop: insets.top + axSpacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <ChevronLeft color={c.text} size={22} strokeWidth={2} />
        </Pressable>
        <Bell color={c.accentText} size={20} strokeWidth={2} />
        <Text accessibilityRole="header" style={[axTypography.titleM, { lineHeight: axAccentSafeLineHeight.titleM, color: c.text }]}>{t('bo.notifications.title')}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {/* Compose */}
          <AxCard testID="bo-notif-compose">
            <Text style={[axTypography.titleM, { lineHeight: axAccentSafeLineHeight.titleM, color: c.text }]}>{t('bo.notifications.compose')}</Text>

            {/* Target selector */}
            <Text style={[axTypography.labelSmall, { color: c.textMuted }]}>{t('bo.notifications.recipient')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.pills}>
              <AxChip testID="bo-notif-target-all" label={t('bo.notifications.allCount', { count: members.length })}
                selected={target === 'all'} onPress={() => setTarget('all')} />
              {members.map(m => (
                <AxChip key={m.user_id} testID={`bo-notif-target-${m.user_id}`} label={m.username}
                  selected={target === m.user_id} onPress={() => setTarget(m.user_id)} />
              ))}
            </ScrollView>

            {/* Title */}
            <Text style={[axTypography.overlineSmall, { color: c.textMuted }]}>{t('bo.notifications.labelTitle')}</Text>
            <AxTextField testID="bo-notif-title" value={title} onChangeText={setTitle}
              placeholder={t('bo.notifications.titlePlaceholder')} accessibilityLabel={t('bo.notifications.labelTitle')} maxLength={80} />

            {/* Body */}
            <Text style={[axTypography.overlineSmall, { color: c.textMuted }]}>{t('bo.notifications.labelBody')}</Text>
            <AxTextField testID="bo-notif-body" value={body} onChangeText={setBody} multiline minInputHeight={56}
              placeholder={t('bo.notifications.bodyPlaceholder')} accessibilityLabel={t('bo.notifications.labelBody')} maxLength={300} />

            <AxButton testID="bo-notif-send" fullWidth icon={Send}
              label={sending ? t('bo.notifications.sending') : t('bo.notifications.send')}
              disabled={!title.trim() || sending} onPress={handleSend} />
          </AxCard>

          {/* History */}
          <Text style={[axTypography.titleM, { lineHeight: axAccentSafeLineHeight.titleM, color: c.text }]}>{t('bo.notifications.history')}</Text>
          {history.length === 0 ? (
            <AxCard testID="bo-notif-empty" style={S.empty}>
              <Bell color={c.textMuted} size={28} strokeWidth={2} />
              <Text style={[axTypography.bodySmall, { color: c.textMuted }]}>{t('bo.notifications.empty')}</Text>
            </AxCard>
          ) : (
            <AxCard testID="bo-notif-history" style={S.historyCard}>
              {history.map((n, i) => (
                <View key={n.id} testID={`bo-notif-row-${n.id}`} style={[S.historyRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}>
                  <CircleCheck color={c.success} size={14} strokeWidth={2} style={S.historyIcon} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[axTypography.label, { color: c.text }]}>{n.title}</Text>
                    {!!n.body && <Text style={[axTypography.caption, { color: c.textMuted }]} numberOfLines={2}>{n.body}</Text>}
                    <View style={S.historyMeta}>
                      <Clock color={c.textMuted} size={10} strokeWidth={2} />
                      <Text style={[axTypography.caption, { color: c.textMuted }]}>
                        {new Date(n.created_at).toLocaleDateString(dateLocale, {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                      <Text style={[axTypography.caption, { color: c.accentText }]}>
                        → {n.target === 'all' ? t('bo.notifications.targetAll') : t('bo.notifications.targetIndividual')}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </AxCard>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    paddingHorizontal: axSpacing.xl, paddingBottom: axSpacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  // Colonne de la maquette : marges de 20, 16 entre les blocs ; place sous la barre d'onglets flottante.
  content: { paddingHorizontal: axSpacing.xl, paddingTop: axSpacing.xs, paddingBottom: 140, gap: axSpacing.lg },
  pills: { flexDirection: 'row', gap: 6 },
  empty: { padding: 30, alignItems: 'center', gap: 10 },
  historyCard: { paddingHorizontal: axSpacing.lg, paddingVertical: 2, gap: 0 },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  historyIcon: { marginTop: 3 },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
