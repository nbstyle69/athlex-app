import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Calendar, Clock, User, X as XIcon } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import GlassBackground from '../../components/glass/GlassBackground';
import { AxButton, AxCard, AxChip, AxStatusDot } from '../../components/ax';
import { axSpacing, axTypography } from '../../theme/axTokens';
import { cancelClassReminder } from '../../services/notifications';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';

interface ReservationRow {
  id: string;
  schedule_id: string;
  status: 'confirmed' | 'waiting';
  created_at: string;
  schedule: {
    title: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    coach: string | null;
  } | null;
}

const CANCEL_CUTOFF_MIN = 20;

function minutesUntilSlot(scheduled_date: string, start_time: string): number {
  const slotTime = new Date(`${scheduled_date}T${start_time}:00`);
  return (slotTime.getTime() - Date.now()) / 60_000;
}

export default function MyReservationsScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { user, currentBox } = useAuth();
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const S = createStyles(theme);
  const dialog = useConfirmDialog();
  const c = theme.ax;

  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const todayISO = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!user || !currentBox) { setLoading(false); return; }

    const { data } = await supabase
      .from('class_reservations')
      .select('id, schedule_id, status, created_at, schedule:class_schedules(title, scheduled_date, start_time, end_time, coach)')
      .eq('member_id', user.id)
      .eq('box_id', currentBox.id)
      .order('created_at', { ascending: false });

    setReservations((data ?? []).map((r: any) => ({
      ...r,
      schedule: Array.isArray(r.schedule) ? r.schedule[0] ?? null : r.schedule,
    })));
    setLoading(false);
    setRefreshing(false);
  }, [user, currentBox]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Sort by slot datetime (scheduled_date + start_time)
  function slotKey(r: ReservationRow) {
    if (!r.schedule) return '';
    return `${r.schedule.scheduled_date}T${r.schedule.start_time}`;
  }
  const upcoming = reservations
    .filter(r => r.schedule && r.schedule.scheduled_date >= todayISO)
    .sort((a, b) => slotKey(a).localeCompare(slotKey(b))); // soonest first
  const past = reservations
    .filter(r => r.schedule && r.schedule.scheduled_date < todayISO)
    .sort((a, b) => slotKey(b).localeCompare(slotKey(a))); // most recent first
  const displayed = tab === 'upcoming' ? upcoming : past;

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR';
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title={t('myReservations.title')}>
          <Text style={S.headerSub}>{t('myReservations.summary', { upcoming: upcoming.length, past: past.length })}</Text>
      </AxScreenHeader>

      {/* Tabs */}
      <View style={S.tabs}>
        <AxChip
          testID="r10-tab-upcoming"
          label={t('myReservations.tabUpcoming', { count: upcoming.length })}
          selected={tab === 'upcoming'}
          onPress={() => setTab('upcoming')}
        />
        <AxChip
          testID="r10-tab-past"
          label={t('myReservations.tabPast', { count: past.length })}
          selected={tab === 'past'}
          onPress={() => setTab('past')}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={c.accentText} />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: axSpacing.lg, gap: axSpacing.sm, paddingBottom: tabSpace }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.accentText} />
          }
          ListEmptyComponent={
            <EmptyState
              testID="my-reservations-empty"
              style={S.empty}
              icon={Calendar}
              title={tab === 'upcoming' ? t('myReservations.emptyUpcomingTitle') : t('myReservations.emptyPastTitle')}
              text={tab === 'upcoming' ? t('myReservations.emptyUpcomingSub') : t('myReservations.emptyPastSub')}
            />
          }
          renderItem={({ item }) => {
            const s = item.schedule;
            if (!s) return null;
            const isPast = s.scheduled_date < todayISO;
            const isConfirmed = item.status === 'confirmed';

            return (
              <AxCard testID={`r10-res-${item.id}`} style={isPast ? S.cardPast : undefined}>
                <View style={S.cardBody}>
                  <View style={S.cardTop}>
                    <Text style={S.cardTitle} numberOfLines={2}>{s.title}</Text>
                    <AxStatusDot
                      testID={`r10-res-status-${item.id}`}
                      tone={isConfirmed ? 'active' : 'warning'}
                      label={isConfirmed ? t('myReservations.confirmed') : t('myReservations.waiting')}
                    />
                  </View>
                  <View style={S.cardDetails}>
                    <View style={S.detailRow}>
                      <Calendar color={c.textMuted} size={12} />
                      <Text style={S.detailText}>{formatDate(s.scheduled_date)}</Text>
                    </View>
                    <View style={S.detailRow}>
                      <Clock color={c.textMuted} size={14} />
                      <Text style={S.time}>{s.start_time} – {s.end_time}</Text>
                    </View>
                  </View>
                  {s.coach && (
                    <View style={S.detailRow}>
                      <User color={c.textMuted} size={12} />
                      <Text style={S.coach} numberOfLines={1}>{t('myReservations.coach', { name: s.coach })}</Text>
                    </View>
                  )}
                  {!isPast && minutesUntilSlot(s.scheduled_date, s.start_time) >= CANCEL_CUTOFF_MIN && (
                    <View style={S.cancelWrap}>
                    <AxButton
                      testID={`r10-res-cancel-${item.id}`}
                      variant="stop"
                      icon={XIcon}
                      label={t('myReservations.cancel')}
                      onPress={() => {
                        const minsLeft = minutesUntilSlot(s.scheduled_date, s.start_time);
                        if (minsLeft < CANCEL_CUTOFF_MIN) {
                          dialog.show(
                            t('reservation.tooLateTitle'),
                            t('reservation.cancelTooLate', { min: CANCEL_CUTOFF_MIN }),
                          );
                          return;
                        }
                        dialog.show(
                          isConfirmed ? t('reservation.cancelReservationTitle') : t('reservation.leaveWaitlistTitle'),
                          isConfirmed
                            ? t('myReservations.cancelConfirmedBody')
                            : t('myReservations.cancelWaitingBody'),
                          [
                            { text: t('common.no'), style: 'cancel' },
                            {
                              text: t('myReservations.yesCancel'),
                              style: 'destructive',
                              onPress: async () => {
                                const { error } = await supabase
                                  .from('class_reservations')
                                  .delete()
                                  .eq('id', item.id);
                                if (error) Alert.alert(t('common.error'), error.message);
                                else {
                                  await cancelClassReminder(item.schedule_id);
                                  load();
                                }
                              },
                            },
                          ],
                        );
                      }}
                    />
                    </View>
                  )}
                </View>
              </AxCard>
            );
          }}
        />
      )}
      {dialog.element}
    </View>
  );
}

function createStyles(t: AppTheme) {
  const c = t.ax;
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: 'transparent' },
    headerSub:   { ...axTypography.bodySmall, color: c.textMuted },

    tabs:        { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm, paddingHorizontal: axSpacing.lg, paddingTop: axSpacing.sm },

    card:        {},
    cardPast:    { opacity: 0.55 },
    cardBody:    { gap: axSpacing.sm },
    cardTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: axSpacing.md },
    cardTitle:   { ...axTypography.label, color: c.text, flex: 1, minWidth: 0 },
    cardDetails: { gap: axSpacing.xs },
    detailRow:   { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    detailText:  { ...axTypography.caption, color: c.textMuted },
    time:        { ...axTypography.numberM, color: c.text },
    coach:       { ...axTypography.caption, color: c.textMuted, flexShrink: 1 },
    cancelWrap:  { alignItems: 'flex-end' },

    empty:       { alignItems: 'center', paddingTop: 60, gap: axSpacing.md },
    emptyTitle:  { ...axTypography.titleM, color: c.text, textAlign: 'center' },
    emptySub:    { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', paddingHorizontal: axSpacing['2xl'] },
  });
}
