import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LucideIcon } from 'lucide-react-native';
import {
  Calendar, CalendarClock, ExternalLink, Lock, Map, MapPin, RefreshCw, Send, ShieldCheck,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AxButton, AxCard, AxScreenHeader, AxStatusDot } from '../../components/ax';
import type { AxStatusTone } from '../../components/ax';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTheme } from '../../context/ThemeContext';
import { formatDate } from '../../i18n/locale';
import { WEB_URL } from '../../lib/urls';
import type { HomeStackParamList } from '../../navigation';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import {
  cancelMembershipPlanChange, counterAccess, getMembershipOverview, getMyMemberships, monthlyPrice, paymentMethodLabel,
  type CounterAccess, type MembershipErrorKind, type MembershipOverview, type MyMembership,
} from '../../services/membership';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';

type OverviewProps = NativeStackScreenProps<HomeStackParamList, 'MyMembership'>;

/** « 1 nov. 2026 » */
export const longDate = (d: string | number) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' });
/** « 31 oct. » */
export const shortDate = (d: string | number) => formatDate(d, { day: 'numeric', month: 'short' });
/** Jour civil « AAAA-MM-JJ » à midi local : la date affichée ne glisse pas d'un fuseau à l'autre. */
const civilDay = (d: string) => { const [y, m, j] = d.split('-').map(Number); return new Date(y, m - 1, j, 12).getTime(); };
/** Carte, prélèvement et résiliation : sur le site seulement (App Store 3.1.3(e)). */
const openAccount = () => Linking.openURL(`${WEB_URL}/compte`);

function statusOf(o: MembershipOverview, access: CounterAccess | null): { key: string; tone: AxStatusTone } {
  if (access?.key === 'ended') return { key: 'accessEnded', tone: 'danger' };
  switch (o.block_reason) {
    case 'past_due': return { key: 'pastDue', tone: 'danger' };
    case 'paused': return { key: 'paused', tone: 'warning' };
    case 'cancel_scheduled': return { key: 'cancelScheduled', tone: 'warning' };
    case 'box_closed': return { key: 'boxClosed', tone: 'muted' };
    default: return { key: 'active', tone: 'active' };
  }
}

function priceOf(o: MembershipOverview, planId: string): number | null {
  return o.available_plans.find(p => p.id === planId)?.price_cents ?? null;
}

/** Encart bordé : icône et libellé, texte, action. */
function Encart({ icon: Icon, tone, title, body, children, gap = axSpacing.sm, testID }: {
  icon: LucideIcon; tone: string; title: string; body: string; children?: React.ReactNode; gap?: number; testID: string;
}) {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <View testID={testID} style={[styles.encart, { gap, backgroundColor: c.surface, borderColor: tone }]}>
      <View style={styles.encartHead}>
        <Icon size={16} color={tone} strokeWidth={2} />
        <Text style={[axTypography.label, { color: c.text }]}>{title}</Text>
      </View>
      <Text style={[axTypography.bodySmall, { color: c.textMuted }]}>{body}</Text>
      {children}
    </View>
  );
}

function InfoRow({ icon: Icon, label, value, testID }: { icon: LucideIcon; label: string; value: string; testID: string }) {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <View testID={testID} style={styles.infoRow}>
      <Icon size={16} color={c.textMuted} strokeWidth={2} />
      <Text style={[axTypography.bodySmall, styles.flex, { color: c.textMuted }]}>{label}</Text>
      <Text style={[axTypography.label, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function PlanCard({ o, access }: { o: MembershipOverview; access: CounterAccess | null }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.ax;
  const status = statusOf(o, access);
  const payment = o.mode === 'counter' ? t('membership.payment.counter') : paymentMethodLabel(o.payment_method);
  return (
    <AxCard variant="featured" style={styles.planCard} testID="membership-plan-card">
      <Text style={[axTypography.overline, { color: c.textMuted }]}>{t('membership.currentPlan')}</Text>
      <View style={styles.planHead}>
        <Text testID="membership-plan-name" style={[axTypography.titleL, styles.flex, { color: c.text }]}>
          {o.plan?.name ?? t('membership.noPlan')}
        </Text>
        <AxStatusDot testID="membership-status" label={t(`membership.status.${status.key}`)} tone={status.tone} />
      </View>
      {o.price_cents != null && (
        <Text testID="membership-price" style={[axTypography.numberM, { color: c.accentText }]}>{monthlyPrice(o.price_cents)}</Text>
      )}
      <View style={[styles.rule, { backgroundColor: c.border }]} />
      {/* Au comptoir, le site ne donne pas d'échéance : la ligne n'apparaît pas. */}
      {o.next_billing_at && (
        <InfoRow
          testID="membership-next-billing"
          icon={Calendar}
          label={t('membership.nextBilling')}
          value={o.block_reason === 'past_due'
            ? t('membership.dueSince', { date: longDate(o.next_billing_at) })
            : longDate(o.next_billing_at)}
        />
      )}
      {access && (
        <InfoRow
          testID="membership-access-until"
          icon={CalendarClock}
          label={t(access.key === 'ended' ? 'membership.counterAccess.endedOn' : 'membership.counterAccess.paidUntil')}
          value={longDate(civilDay(access.until))}
        />
      )}
      {payment && (
        <InfoRow testID="membership-payment" icon={o.mode === 'counter' ? MapPin : ShieldCheck} label={t('membership.payment.label')} value={payment} />
      )}
    </AxCard>
  );
}

export default function MyMembershipScreen({ navigation }: OverviewProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.ax;
  const tabSpace = useTabBarScrollSpace();
  const [overview, setOverview] = useState<MembershipOverview | null>(null);
  const [billing, setBilling] = useState<MyMembership[]>([]);
  const [error, setError] = useState<{ kind: MembershipErrorKind; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [r, rows] = await Promise.all([getMembershipOverview(), getMyMemberships()]);
    setBilling(rows);
    if (r.ok) setOverview(r.data);
    else { setOverview(null); setError({ kind: r.kind, message: r.message }); }
    setLoading(false);
  }, []);

  // Rechargé au retour de l'écran de choix : le changement programmé ou la demande s'affiche.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmCancel(o: MembershipOverview) {
    const counter = o.mode === 'counter';
    Alert.alert(
      t(counter ? 'membership.cancelRequestTitle' : 'membership.cancelChangeTitle'),
      t(counter ? 'membership.cancelRequestMsg' : 'membership.cancelChangeMsg'),
      [
        { text: t('membership.keep'), style: 'cancel' },
        {
          text: t(counter ? 'membership.cancelRequest' : 'membership.cancelChange'),
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            setCancelError(null);
            const r = await cancelMembershipPlanChange();
            setCancelling(false);
            if (r.ok) load();
            else setCancelError(r.message);
          },
        },
      ],
    );
  }

  let body: React.ReactNode;
  if (loading && !overview) {
    body = <View style={styles.center}><ActivityIndicator testID="membership-loading" color={c.accentText} /></View>;
  } else if (error || !overview) {
    body = (
      <View style={styles.center} testID="membership-error">
        <Text style={[axTypography.bodySmall, styles.centered, { color: c.textMuted }]}>{error?.message}</Text>
        {error?.kind !== 'none' && error?.kind !== 'auth' && (
          // AxButton hors pleine largeur se cale à gauche : l'enveloppe le centre.
          <View testID="membership-retry-wrap" style={styles.selfCenter}>
            <AxButton testID="membership-retry" variant="outline" icon={RefreshCw} label={t('membership.retry')} onPress={load} />
          </View>
        )}
      </View>
    );
  } else {
    const o = overview;
    const blocked = o.block_reason;
    const online = o.mode === 'online';
    const scheduled = online ? o.scheduled_change : null;
    const pending = online ? null : o.pending_request;
    const scheduledPrice = scheduled ? priceOf(o, scheduled.plan.id) : null;
    const access = counterAccess(o, billing);
    const canChange = !blocked && !scheduled && !pending && access?.key !== 'ended';
    body = (
      <>
        {!!o.box.name && <Text testID="membership-box" style={[axTypography.caption, styles.centered, { color: c.textMuted }]}>{o.box.name}</Text>}

        {blocked === 'past_due' && (
          <Encart testID="membership-unpaid" gap={10} icon={Lock} tone={c.danger} title={t('membership.unpaid.title')} body={t('membership.unpaid.body')}>
            <AxButton testID="membership-update-payment" icon={Map} label={t('membership.unpaid.cta')} onPress={openAccount} fullWidth />
          </Encart>
        )}

        {(access?.key === 'endingSoon' || access?.key === 'ended') && (
          <Encart
            testID={access.key === 'ended' ? 'membership-access-ended' : 'membership-access-ending'}
            gap={10}
            icon={access.key === 'ended' ? Lock : CalendarClock}
            tone={access.key === 'ended' ? c.danger : c.warning}
            title={access.key === 'ended'
              ? t('membership.counterAccess.endedTitle')
              : t('membership.counterAccess.endingTitle', { date: shortDate(civilDay(access.until)) })}
            body={!access.sellsOnline
              ? t('membership.counterAccess.noOnlineBody')
              : t(access.key === 'ended' ? 'membership.counterAccess.endedBody' : 'membership.counterAccess.endingBody')}
          >
            {access.sellsOnline && (
              <AxButton
                testID="membership-go-online"
                icon={ExternalLink}
                label={t(access.key === 'ended' ? 'membership.counterAccess.activateOnline' : 'membership.counterAccess.goOnline')}
                onPress={openAccount}
                fullWidth
              />
            )}
          </Encart>
        )}

        <PlanCard o={o} access={access} />

        {access?.key === 'current' && access.sellsOnline && (
          <>
            <AxButton testID="membership-go-online" icon={ExternalLink} label={t('membership.counterAccess.goOnline')} onPress={openAccount} fullWidth />
            <Text testID="membership-go-online-hint" style={[axTypography.caption, styles.centered, { color: c.textMuted }]}>
              {t('membership.counterAccess.goOnlineHint')}
            </Text>
          </>
        )}

        {blocked && (
          <Text testID="membership-blocked" style={[axTypography.caption, { color: c.textMuted }]}>
            {t(`membership.blocked.${blocked}`)}
          </Text>
        )}

        {scheduled && (
          <Encart
            testID="membership-scheduled"
            icon={CalendarClock}
            tone={c.accent}
            title={t('membership.scheduled.title')}
            body={scheduledPrice != null
              ? t('membership.scheduled.bodyPrice', { plan: scheduled.plan.name, price: monthlyPrice(scheduledPrice), date: scheduled.at ? longDate(scheduled.at) : '' })
              : t('membership.scheduled.body', { plan: scheduled.plan.name, date: scheduled.at ? longDate(scheduled.at) : '' })}
          >
            <AxButton testID="membership-cancel" variant="outline" label={t('membership.cancelChange')} onPress={() => confirmCancel(o)} loading={cancelling} fullWidth />
            {cancelError && <Text testID="membership-cancel-error" style={[axTypography.caption, { color: c.danger }]}>{cancelError}</Text>}
          </Encart>
        )}

        {pending && (
          <Encart
            testID="membership-pending"
            icon={Send}
            tone={c.warning}
            title={t('membership.pending.title')}
            body={t('membership.pending.body', {
              plan: pending.plan.name,
              date: longDate(pending.at),
            })}
          >
            <AxButton testID="membership-cancel" variant="outline" label={t('membership.cancelRequest')} onPress={() => confirmCancel(o)} loading={cancelling} fullWidth />
            {cancelError && <Text testID="membership-cancel-error" style={[axTypography.caption, { color: c.danger }]}>{cancelError}</Text>}
          </Encart>
        )}

        {canChange && (o.available_plans.length === 0 ? (
          <Text testID="membership-no-plans" style={[axTypography.caption, styles.centered, { color: c.textMuted }]}>{t('membership.noOtherPlan')}</Text>
        ) : (
          <>
            <AxButton
              testID="membership-change"
              // Menthe réservée à l'action principale : en contour dès que l'accès au comptoir est daté.
              variant={access ? 'outline' : 'accent'}
              icon={online ? RefreshCw : Send}
              label={t(online ? 'membership.change' : 'membership.requestChange')}
              onPress={() => navigation.navigate('ChangeMembershipPlan', { overview: o })}
              fullWidth
            />
            <Text testID="membership-change-hint" style={[axTypography.caption, styles.centered, { color: c.textMuted }]}>
              {t(online ? 'membership.changeHint' : 'membership.counterHint')}
            </Text>
          </>
        ))}

        {online && blocked !== 'past_due' && (
          <View testID="membership-billing" style={styles.section}>
            <Text style={[axTypography.overline, { color: c.textMuted }]}>{t('membership.billingTitle')}</Text>
            <AxButton testID="membership-manage-site" variant="outline" icon={Map} label={t('membership.manageOnSite')} onPress={openAccount} fullWidth />
            <Text style={[axTypography.caption, { color: c.textMuted }]}>{t('membership.manageOnSiteHint')}</Text>
          </View>
        )}
      </>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <GlassBackground />
      <AxScreenHeader title={t('membership.title')} testID="membership-header" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabSpace }]} testID="membership-scroll">
        {body}
      </ScrollView>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: axSpacing.xl, gap: 14 },
  center: { paddingTop: axSpacing['2xl'], alignItems: 'center', gap: axSpacing.md },
  centered: { textAlign: 'center' },
  selfCenter: { alignSelf: 'center' },
  flex: { flex: 1 },
  planCard: { gap: axSpacing.md, paddingBottom: 18 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { height: 1, alignSelf: 'stretch' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  section: { gap: axSpacing.sm },
  encart: { borderWidth: 1, borderRadius: axRadius.card, padding: axSpacing.lg },
  encartHead: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
});
