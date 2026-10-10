import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, Alert, Modal, FlatList, Linking,
} from 'react-native';
import { CalendarClock, Users, Timer, X, CalendarCheck, AlertTriangle, ExternalLink, User, CreditCard } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import UserAvatar from '../../components/UserAvatar';
import GlassBackground from '../../components/glass/GlassBackground';
import { scheduleClassReminder, cancelClassReminder } from '../../services/notifications';
import { getMyMemberships, needsPlan, planActivationUrl } from '../../services/membership';
import { usePlanStatuses } from '../../hooks/usePlanStatuses';
import PlanToActivateNotice from '../../components/PlanToActivateNotice';
import { WEB_URL } from '../../lib/urls';
import { reservationRefusal, errorMessage } from '../../utils/refusals';
import { classTitleLabel } from '../../lib/classTypes';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import { AxButton, AxCard, AxIconButton, AxStatusDot, AxTag, withAlpha } from '../../components/ax';
import { hitSlopFor } from '../../components/ax/color';
import ReservationWeekPicker from './ReservationWeekPicker';
import { axAccentSafeLineHeight, axRadius, axSpacing, axTypography } from '../../theme/axTokens';

interface ClassSchedule {
  id: string;
  title: string;
  description: string | null;
  coach: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  confirmed_count: number;
  waiting_count: number;
  available_spots: number;
  my_status: 'confirmed' | 'waiting' | null;
  my_waiting_position: number;
}

function getWeekDates(offset = 0): Date[] {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface SlotParticipant {
  member_id: string;
  username: string;
  status: 'confirmed' | 'waiting';
}

const REGISTER_CUTOFF_MIN = 15;
const CANCEL_CUTOFF_MIN   = 20;

// Rolling visibility window: user only sees slots up to today + N days from now.
const VISIBILITY_DAYS = 14;

function getHorizonDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + VISIBILITY_DAYS);
  return d;
}

function minutesUntilSlot(scheduled_date: string, start_time: string): number {
  const slotTime = new Date(`${scheduled_date}T${start_time}:00`);
  return (slotTime.getTime() - Date.now()) / 60_000;
}

export default function ReservationScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { user, currentBox } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const S = createStyles(theme);
  const dialog = useConfirmDialog();
  const c = theme.ax;

  const [schedules,  setSchedules]  = useState<ClassSchedule[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [booking,    setBooking]    = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));
  const [detailItem,  setDetailItem]  = useState<ClassSchedule | null>(null);
  const [participants, setParticipants] = useState<SlotParticipant[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  // Adhésion suspendue (impayé au-delà du délai de la box) : les réservations sont refusées.
  const [suspension, setSuspension] = useState<{ stripe: boolean } | null>(null);
  // Formule à activer (ni staff ni formule) : bandeau en tête et bouton du refus NO_ACTIVE_PLAN.
  const planStatus = usePlanStatuses(currentBox ? [currentBox.id] : [])[currentBox?.id ?? ''];

  const weekDates = getWeekDates(weekOffset);

  const load = useCallback(async () => {
    if (!currentBox || !user) { setLoading(false); return; }
    const start = toISO(weekDates[0]);
    const end   = toISO(weekDates[6]);

    // Cap fetch range to [today, today + VISIBILITY_DAYS]
    const today = toISO(new Date());
    const horizon = toISO(getHorizonDate());
    const effectiveStart = start < today ? today : start;
    const effectiveEnd   = end > horizon ? horizon : end;

    if (effectiveStart > effectiveEnd) {
      setSchedules([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: schedulesData } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('box_id', currentBox.id)
      .gte('scheduled_date', effectiveStart)
      .lte('scheduled_date', effectiveEnd)
      .order('scheduled_date')
      .order('start_time');

    const items = (schedulesData ?? []) as Omit<ClassSchedule, 'confirmed_count' | 'waiting_count' | 'available_spots' | 'my_status' | 'my_waiting_position'>[];

    if (items.length > 0) {
      const ids = items.map(s => s.id);
      const { data: allRes } = await supabase
        .from('class_reservations')
        .select('schedule_id, member_id, status, created_at')
        .in('schedule_id', ids)
        .order('created_at', { ascending: true });

      const dataMap: Record<string, { confirmed: number; waiting: { id: string; member_id: string }[] }> = {};
      ids.forEach(id => { dataMap[id] = { confirmed: 0, waiting: [] }; });

      (allRes ?? []).forEach((r: any) => {
        if (!dataMap[r.schedule_id]) return;
        if (r.status === 'confirmed') {
          dataMap[r.schedule_id].confirmed++;
        } else {
          dataMap[r.schedule_id].waiting.push({ id: r.id, member_id: r.member_id });
        }
      });

      const enriched: ClassSchedule[] = items.map(s => {
        const d = dataMap[s.id];
        const myConfirmed = (allRes ?? []).some(
          (r: any) => r.schedule_id === s.id && r.member_id === user.id && r.status === 'confirmed'
        );
        const myWaitIdx = d.waiting.findIndex(w => w.member_id === user.id);
        return {
          ...s,
          confirmed_count: d.confirmed,
          waiting_count: d.waiting.length,
          available_spots: Math.max(0, s.max_capacity - d.confirmed),
          my_status: myConfirmed ? 'confirmed' : myWaitIdx >= 0 ? 'waiting' : null,
          my_waiting_position: myWaitIdx >= 0 ? myWaitIdx + 1 : 0,
        };
      });
      setSchedules(enriched);
    } else {
      setSchedules([]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [currentBox, user, weekOffset]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useFocusEffect(useCallback(() => {
    if (!currentBox || !user) { setSuspension(null); return; }
    getMyMemberships().then(rows => {
      const m = rows.find(r => r.box_id === currentBox.id);
      setSuspension(m?.suspended ? { stripe: !!m.has_stripe_subscription } : null);
    });
  }, [currentBox, user]));

  async function openParticipants(item: ClassSchedule) {
    setDetailItem(item);
    setDetailLoading(true);
    const { data } = await supabase
      .from('class_reservations')
      .select('member_id, status, profile:profiles(username, avatar_url)')
      .eq('schedule_id', item.id)
      .order('created_at', { ascending: true });
    const list: SlotParticipant[] = (data ?? []).map((r: any) => {
      const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return { member_id: r.member_id, username: p?.username ?? '?', avatar_url: p?.avatar_url, status: r.status };
    });
    setParticipants(list);
    setDetailLoading(false);
  }

  async function toggleBooking(item: ClassSchedule) {
    if (!user || !currentBox) return;
    setBooking(item.id);

    const minsLeft = minutesUntilSlot(item.scheduled_date, item.start_time);

    if (item.my_status) {
      if (minsLeft < CANCEL_CUTOFF_MIN) {
        dialog.show(
          t('reservation.tooLateTitle'),
          t('reservation.cancelTooLate', { min: CANCEL_CUTOFF_MIN }),
        );
        setBooking(null);
        return;
      }
      const label = item.my_status === 'confirmed'
        ? t('reservation.cancelConfirmed')
        : t('reservation.leaveWaitlistConfirm');
      dialog.show(
        item.my_status === 'confirmed' ? t('reservation.cancelReservationTitle') : t('reservation.leaveWaitlistTitle'),
        label,
        [
          { text: t('common.no'), style: 'cancel', onPress: () => setBooking(null) },
          {
            text: t('common.yes'),
            style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from('class_reservations')
                .delete()
                .eq('schedule_id', item.id)
                .eq('member_id', user.id);
              if (error) Alert.alert(t('common.error'), await errorMessage(error));
              else await cancelClassReminder(item.id);
              setBooking(null);
              load();
            },
          },
        ]
      );
    } else {
      if (minsLeft < REGISTER_CUTOFF_MIN) {
        dialog.show(
          t('reservation.tooLateTitle'),
          t('reservation.registerTooLate', { min: REGISTER_CUTOFF_MIN }),
        );
        setBooking(null);
        return;
      }

      // Check weekly limit before booking
      try {
        const { data: limitData } = await supabase.rpc('check_weekly_limit', {
          p_user_id: user.id, p_box_id: currentBox.id, p_target_date: item.scheduled_date,
        });
        const wl = limitData as { allowed: boolean; max: number; used: number } | null;
        if (wl && !wl.allowed) {
          dialog.show(
            t('reservation.limitReachedTitle'),
            t('reservation.limitReachedBody', { count: wl.max, max: wl.max, used: wl.used }),
          );
          setBooking(null);
          return;
        }
      } catch (e) { captureError(e, { screen: 'Reservation', action: 'checkWeeklyLimit' }); }

      // Check daily limit (1 créneau/jour sauf illimité)
      try {
        const { data: dailyData } = await supabase.rpc('check_daily_limit', {
          p_user_id: user.id, p_box_id: currentBox.id, p_date: item.scheduled_date,
        });
        const dl = dailyData as { allowed: boolean } | null;
        if (dl && !dl.allowed) {
          dialog.show(
            t('reservation.dailyLimitTitle'),
            t('reservation.dailyLimitBody'),
          );
          setBooking(null);
          return;
        }
      } catch (e) { captureError(e, { screen: 'Reservation', action: 'checkDailyLimit' }); }

      // Capacity is enforced server-side (trigger). We only *hint* the desired
      // status; the DB downgrades to 'waiting' if the class is actually full,
      // so we read back the row to know the real outcome.
      const wantsWaiting = item.available_spots <= 0;
      const insertReservation = async () => {
        const { data, error } = await supabase.from('class_reservations').insert({
          schedule_id: item.id, member_id: user.id, box_id: currentBox.id,
          status: wantsWaiting ? 'waiting' : 'confirmed',
        }).select('status').single();
        if (error) {
          const refusal = reservationRefusal(error);
          if (refusal?.code === 'NO_ACTIVE_PLAN') dialog.show(refusal.title, refusal.body, noPlanButtons(planActivationUrl(planStatus, currentBox.slug)), { icon: CreditCard });
          else if (refusal) dialog.show(refusal.title, refusal.body);
          else Alert.alert(t('common.error'), await errorMessage(error));
        }
        else if (data?.status === 'waiting') {
          Alert.alert(t('reservation.waitlistTitle'), t('reservation.waitlistDowngrade'));
        }
        else {
          await scheduleClassReminder(item.id, classTitleLabel(item.title), item.scheduled_date, item.start_time);
        }
        setBooking(null);
        load();
      };

      if (wantsWaiting) {
        dialog.show(
          t('reservation.slotFullTitle'),
          t('reservation.slotFullBody', { pos: item.waiting_count + 1 }),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => setBooking(null) },
            { text: t('reservation.joinWaitlist'), onPress: insertReservation },
          ]
        );
        return;
      }
      await insertReservation();
    }
  }

  /** Fenêtre « Pas de formule active » (maquette 68:1539) : le site si la box vend en ligne, sinon fermer seulement. */
  function noPlanButtons(url: string | null) {
    const close = { text: t('common.close'), style: 'cancel' as const };
    return url ? [{ text: t('plan.activateCta'), onPress: () => { Linking.openURL(url); } }, close] : [close];
  }

  const todayISO = toISO(new Date());

  if (!currentBox) {
    return (
      <View style={S.emptyContainer}>
        <GlassBackground />
        <EmptyState testID="reservation-no-box" icon={CalendarClock} title={t('reservation.noBoxTitle')} text={t('reservation.noBoxSubtitle')} />
      </View>
    );
  }

  const maxDate = toISO(getHorizonDate());
  const nextWeekFirst = new Date(weekDates[0]);
  nextWeekFirst.setDate(nextWeekFirst.getDate() + 7);
  const forwardDisabled = toISO(nextWeekFirst) > maxDate;

  return (
    <View style={S.container}>
      <GlassBackground />
      <View style={S.header}>
        <Text style={S.headerTitle}>{t('reservation.title')}</Text>
        <Text style={S.headerSub}>{currentBox.name}</Text>
      </View>

      {suspension && (
        <View style={S.suspendedBanner} accessibilityRole="alert" testID="r10-suspended">
          <View style={S.suspendedHead}>
            <AlertTriangle size={16} color={c.warning} />
            <Text style={S.suspendedTitle}>{t('reservation.suspendedTitle')}</Text>
          </View>
          <Text style={S.suspendedBody}>
            {suspension.stripe ? t('reservation.suspendedBodyStripe') : t('reservation.suspendedBodyContact')}
          </Text>
          {suspension.stripe && (
            <AxButton
              testID="r10-suspended-cta"
              variant="accent"
              icon={ExternalLink}
              onPress={() => Linking.openURL(`${WEB_URL}/compte`)}
              label={t('reservation.suspendedCta')}
            />
          )}
        </View>
      )}

      {needsPlan(planStatus) && (
        <View style={S.planNoticeWrap}>
          <PlanToActivateNotice status={planStatus} box={currentBox} testID="r10-plan" />
        </View>
      )}

      <View style={S.myResWrap}>
        <AxButton
          testID="r10-my-reservations"
          variant="outline"
          icon={CalendarCheck}
          fullWidth
          label={t('reservation.myReservations')}
          onPress={() => navigation.navigate('MyReservations')}
        />
      </View>

      <ReservationWeekPicker
        days={weekDates.map(d => ({ iso: toISO(d), dayNumber: d.getDate() }))}
        selectedDate={selectedDate}
        todayISO={todayISO}
        maxDate={maxDate}
        forwardDisabled={forwardDisabled}
        onSelectDate={setSelectedDate}
        onPrev={() => setWeekOffset(w => w - 1)}
        onNext={() => setWeekOffset(w => w + 1)}
      />

      {loading
        ? <ActivityIndicator style={{ marginTop: 60 }} size="large" color={c.accentText} />
        : (() => {
          const isPast   = selectedDate < todayISO;
          const horizonMs = getHorizonDate().getTime();
          const dayItems = schedules.filter(s => {
            if (s.scheduled_date !== selectedDate) return false;
            // Strict 14-day datetime cap (e.g. Wed 13h -> visible until Wed+14 13h)
            const slotMs = new Date(`${s.scheduled_date}T${s.start_time}:00`).getTime();
            if (slotMs > horizonMs) return false;
            // Hide slots whose registration window has closed (today only)
            if (s.scheduled_date === todayISO) {
              return minutesUntilSlot(s.scheduled_date, s.start_time) >= REGISTER_CUTOFF_MIN;
            }
            return true;
          });
          return (
            <ScrollView
              contentContainerStyle={{ paddingBottom: tabSpace }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.accentText} />}
            >
              <View style={S.dayBlock}>

                {/* Schedule slots */}
                {dayItems.length === 0 ? (
                  <View style={S.noSlots}>
                    <Text style={S.noSlotsText}>{t('reservation.noClassToday')}</Text>
                  </View>
                ) : (
                  dayItems.map(item => {
                    const isBusy    = booking === item.id;
                    const isWaiting = item.my_status === 'waiting';
                    const isFull    = item.available_spots === 0;
                    const fullFree  = isFull && !item.my_status;

                    return (
                      <AxCard
                        key={item.id}
                        testID={`r10-slot-${item.id}`}
                        variant={item.my_status === 'confirmed' ? 'featured' : 'standard'}
                        onPress={() => openParticipants(item)}
                        style={[
                          S.slotCard,
                          isWaiting && S.slotCardWaiting,
                          isPast && S.slotCardPast,
                        ]}
                      >
                        <View style={S.slotRow}>
                          <View style={S.slotLeft}>
                            <Text style={S.slotTime}>
                              {item.start_time} – {item.end_time}
                            </Text>
                            <AxTag testID={`r10-tag-${item.id}`} label={classTitleLabel(item.title)} numberOfLines={2} />
                            {item.coach ? (
                              <View style={S.metaRow}>
                                <User color={c.textMuted} size={12} />
                                <Text style={S.caption} numberOfLines={1}>{item.coach}</Text>
                              </View>
                            ) : null}
                            {item.description ? <Text style={S.caption} numberOfLines={1}>{item.description}</Text> : null}
                          </View>

                          <View style={S.slotRight}>
                            {/* Capacity info */}
                            <View style={S.metaRow}>
                              <Users color={fullFree ? c.danger : c.textMuted} size={12} />
                              <Text style={[S.caption, fullFree && S.captionDanger]}>
                                {item.confirmed_count}/{item.max_capacity}
                              </Text>
                              {item.waiting_count > 0 && (
                                <>
                                  <Timer color={c.warning} size={12} />
                                  <Text style={[S.caption, S.captionWarning]}>{item.waiting_count}</Text>
                                </>
                              )}
                            </View>

                            {/* Spots label */}
                            {!isPast && !item.my_status && (isFull
                              ? (
                                <AxStatusDot
                                  testID={`r10-full-${item.id}`}
                                  tone="danger"
                                  label={item.waiting_count > 0
                                    ? t('reservation.fullWithWaiting', { count: item.waiting_count })
                                    : t('reservation.full')}
                                />
                              ) : (
                                <Text style={[S.caption, S.captionAccent]}>
                                  {t('reservation.spotsAvailable', { count: item.available_spots })}
                                </Text>
                              ))}
                            {isWaiting && (
                              <Text style={[S.caption, S.captionWarning]}>
                                {t('reservation.waitingPosition', { pos: item.my_waiting_position })}
                              </Text>
                            )}

                            {/* Action button */}
                            {!isPast && (item.my_status ? (
                              <Pressable
                                testID={`r10-action-${item.id}`}
                                onPress={() => toggleBooking(item)}
                                disabled={isBusy}
                                accessibilityRole="button"
                                hitSlop={hitSlopFor(80, 20)}
                                style={[S.statusAction, isBusy && S.busy]}
                              >
                                <AxStatusDot
                                  tone={isWaiting ? 'warning' : 'active'}
                                  label={isBusy
                                    ? '…'
                                    : isWaiting
                                      ? t('reservation.waitingShort', { pos: item.my_waiting_position })
                                      : t('reservation.booked')}
                                />
                              </Pressable>
                            ) : (
                              <AxButton
                                testID={`r10-action-${item.id}`}
                                variant={isFull ? 'outline' : 'accent'}
                                disabled={isBusy}
                                label={isBusy ? '…' : isFull ? t('reservation.queue') : t('reservation.book')}
                                onPress={() => toggleBooking(item)}
                              />
                            ))}
                          </View>
                        </View>
                      </AxCard>
                    );
                  })
                )}
              </View>

              {dayItems.length === 0 && (
                <EmptyState testID="reservation-empty-week" style={S.emptyWeek} icon={CalendarClock} title={t('reservation.emptyTitle')} text={t('reservation.emptySubtitle')} />
              )}
            </ScrollView>
          );
        })()
      }

      {/* Participant detail modal */}
      <Modal visible={!!detailItem} transparent animationType="slide" onRequestClose={() => setDetailItem(null)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            {/* Modal header */}
            <View style={S.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={S.modalTitle} numberOfLines={2}>{detailItem?.title}</Text>
                <Text style={S.modalSubtitle}>
                  {detailItem?.start_time} – {detailItem?.end_time}
                  {detailItem?.coach ? `  ·  ${detailItem.coach}` : ''}
                </Text>
              </View>
              <AxIconButton
                testID="r10-modal-close"
                icon={X}
                accessibilityLabel={t('common.close')}
                onPress={() => setDetailItem(null)}
              />
            </View>

            {detailLoading ? (
              <ActivityIndicator style={{ marginVertical: 40 }} size="large" color={c.accentText} />
            ) : participants.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Users color={c.textMuted} size={32} />
                <Text style={[S.modalSubtitle, { marginTop: 12 }]}>{t('reservation.noParticipants')}</Text>
              </View>
            ) : (
              <FlatList
                data={participants}
                keyExtractor={p => p.member_id}
                style={{ maxHeight: 350 }}
                renderItem={({ item: p }) => {
                  const isMe = p.member_id === user?.id;
                  const isConfirmed = p.status === 'confirmed';
                  const ink = isConfirmed ? c.accentText : c.warning;
                  return (
                    <View style={S.participantRow}>
                      <UserAvatar
                        uri={(p as any).avatar_url}
                        name={p.username ?? '?'}
                        size={32}
                        borderRadius={axRadius.card}
                        backgroundColor={withAlpha(isConfirmed ? c.accent : c.warning, 0.15)}
                        textColor={ink}
                        fontSize={12}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[S.participantName, isMe && { color: c.accentText }]} numberOfLines={1}>
                          {p.username}{isMe ? ` ${t('reservation.you')}` : ''}
                        </Text>
                        <Text style={S.participantStatus}>
                          {isConfirmed ? t('reservation.registered') : t('reservation.waitingShort', { pos: participants.filter(x => x.status === 'waiting').indexOf(p) + 1 })}
                        </Text>
                      </View>
                      <View style={[S.participantDot, { backgroundColor: ink }]} />
                    </View>
                  );
                }}
              />
            )}

            {/* Action buttons */}
            {detailItem && !detailItem.my_status && detailItem.available_spots > 0 && (
              <View style={S.modalAction}>
                <AxButton
                  testID="r10-modal-book"
                  variant="accent"
                  fullWidth
                  label={t('reservation.bookThisSlot')}
                  onPress={() => { setDetailItem(null); dialog.afterModalClose(); toggleBooking(detailItem); }}
                />
              </View>
            )}
            {detailItem && detailItem.my_status && (
              <View style={S.modalAction}>
                <AxButton
                  testID="r10-modal-leave"
                  variant="stop"
                  fullWidth
                  label={detailItem.my_status === 'confirmed' ? t('reservation.unsubscribe') : t('reservation.leaveWaitlist')}
                  onPress={() => { setDetailItem(null); dialog.afterModalClose(); toggleBooking(detailItem); }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
      {dialog.element}
    </View>
  );
}

function createStyles(t: AppTheme) {
  const c = t.ax;
  return StyleSheet.create({
    container:          { flex: 1, backgroundColor: 'transparent' },
    emptyContainer:     { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', paddingHorizontal: axSpacing['2xl'], gap: axSpacing.md },
    emptyTitle:         { ...axTypography.titleM, color: c.text, textAlign: 'center' },
    emptySubtitle:      { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },

    header:             { paddingHorizontal: axSpacing.lg, paddingTop: 56, paddingBottom: axSpacing.md },
    headerTitle:        { ...axTypography.titleXL, lineHeight: axAccentSafeLineHeight.titleXL, color: c.text },
    headerSub:          { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2 },

    suspendedBanner: {
      marginHorizontal: axSpacing.lg, marginBottom: axSpacing.sm, padding: axSpacing.lg, gap: axSpacing.sm,
      backgroundColor: withAlpha(c.warning, 0.12), borderRadius: axRadius.card, borderWidth: 1, borderColor: c.warning,
    },
    suspendedHead:    { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    suspendedTitle:   { ...axTypography.label, color: c.warning, flexShrink: 1 },
    suspendedBody:    { ...axTypography.bodySmall, color: c.text },

    myResWrap:        { marginHorizontal: axSpacing.lg, marginBottom: axSpacing.sm },
    planNoticeWrap:   { marginHorizontal: axSpacing.lg, marginBottom: axSpacing.sm },


    dayBlock:           { marginHorizontal: axSpacing.lg, marginTop: axSpacing.md, gap: axSpacing.sm },
    noSlots:            { paddingVertical: 10, paddingHorizontal: 4 },
    noSlotsText:        { ...axTypography.caption, color: c.textMuted },

    slotCard:           {},
    slotCardWaiting:    { borderColor: c.warning },
    slotCardPast:       { opacity: 0.45 },
    slotRow:            { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.md },
    slotLeft:           { flex: 1, minWidth: 0, gap: axSpacing.xs },
    slotTime:           { ...axTypography.numberM, color: c.text },
    slotRight:          { alignItems: 'flex-end', gap: axSpacing.sm, flexShrink: 0, maxWidth: '45%' },
    metaRow:            { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    caption:            { ...axTypography.caption, color: c.textMuted, flexShrink: 1 },
    captionAccent:      { color: c.accentText },
    captionWarning:     { color: c.warning },
    captionDanger:      { color: c.danger },
    statusAction:       { minHeight: 44, justifyContent: 'center' },
    busy:               { opacity: 0.5 },

    emptyWeek:          { alignItems: 'center', paddingTop: 60, gap: axSpacing.md },
    emptyWeekTitle:     { ...axTypography.titleM, color: c.text, textAlign: 'center' },
    emptyWeekSub:       { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', paddingHorizontal: axSpacing['2xl'] },

    modalOverlay:       { flex: 1, backgroundColor: t.modalBackdrop, justifyContent: 'flex-end' },
    modalSheet:         { backgroundColor: c.surface, borderTopLeftRadius: axRadius.card, borderTopRightRadius: axRadius.card, borderWidth: 1, borderColor: c.border, paddingBottom: 34, maxHeight: '75%' },
    modalHeader:        { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, paddingHorizontal: axSpacing.lg, paddingTop: axSpacing.lg, paddingBottom: axSpacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
    modalTitle:         { ...axTypography.titleM, color: c.text },
    modalSubtitle:      { ...axTypography.caption, color: c.textMuted, marginTop: 2 },

    participantRow:     { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, paddingHorizontal: axSpacing.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    participantName:    { ...axTypography.label, color: c.text },
    participantStatus:  { ...axTypography.caption, color: c.textMuted, marginTop: 1 },
    participantDot:     { width: 8, height: 8, borderRadius: 4 },

    modalAction:        { marginHorizontal: axSpacing.lg, marginTop: axSpacing.lg },
  });
}
