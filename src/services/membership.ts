import { supabase } from '../lib/supabase';
import { captureError } from '../lib/sentry';
import i18n from '../i18n';
import { WEB_URL } from '../lib/urls';
import { dateLocale, formatNumber } from '../i18n/locale';

/** Une adhésion de l'utilisateur connecté, telle que la rend `get_my_membership_billing`. */
export interface MyMembership {
  box_id: string;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean | null;
  past_due_since: string | null;
  dunning_grace_days: number | null;
  suspended: boolean | null;
  has_stripe_subscription: boolean | null;
  stopped_at: string | null;
  stop_mode: string | null;
}

export type MembershipState =
  | { key: 'suspended' }
  | { key: 'pastDue' | 'endsOn' | 'stoppedOn' | 'endedOn'; date: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ce que l'athlète doit savoir de son abonnement, ou null s'il n'y a rien à
 * signaler. `suspended` vient de la base : c'est la règle qui bloque les
 * réservations, l'app ne la recalcule pas.
 */
export function membershipState(m: MyMembership): MembershipState | null {
  if (m.suspended) return { key: 'suspended' };
  const status = m.subscription_status;
  if (status === 'past_due' && m.past_due_since) {
    const until = new Date(new Date(m.past_due_since).getTime() + (m.dunning_grace_days ?? 7) * DAY_MS);
    return { key: 'pastDue', date: until.toISOString() };
  }
  if ((status === 'active' || status === 'trialing') && m.subscription_cancel_at_period_end && m.subscription_current_period_end) {
    return { key: 'endsOn', date: m.subscription_current_period_end };
  }
  if (status === 'cancelled' || status === 'canceled') {
    if (m.stop_mode === 'now' && m.stopped_at) return { key: 'stoppedOn', date: m.stopped_at };
    const end = m.subscription_current_period_end ?? m.stopped_at;
    if (end) return { key: 'endedOn', date: end };
  }
  return null;
}

/** La phrase à montrer à l'athlète, dans la langue de l'app. */
export function membershipStateText(state: MembershipState): string {
  if (state.key === 'suspended') return i18n.t('profile.account.subscription.suspended');
  const date = new Date(state.date).toLocaleDateString(dateLocale(), {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  return i18n.t(`profile.account.subscription.${state.key}`, { date });
}

export async function getMyMemberships(): Promise<MyMembership[]> {
  const { data, error } = await supabase.rpc('get_my_membership_billing');
  if (error) {
    captureError(error, { service: 'membership', action: 'getMyMemberships' });
    return [];
  }
  return (data ?? []) as MyMembership[];
}

/** L'état de la formule de l'appelant dans une box, tel que le rend `my_box_plan_status`. */
export interface MyPlanStatus {
  is_staff: boolean;
  has_plan: boolean;
  suspended: boolean;
  credits_left: number;
  pays_online: boolean;
}

/**
 * Null si l'appel échoue ou si l'appelant n'est pas membre actif de la box :
 * l'app n'affiche alors ni bandeau ni bienvenue.
 */
export async function getMyPlanStatus(boxId: string): Promise<MyPlanStatus | null> {
  const { data, error } = await supabase.rpc('my_box_plan_status', { p_box_id: boxId });
  if (error) {
    captureError(error, { service: 'membership', action: 'getMyPlanStatus' });
    return null;
  }
  return (data?.[0] as MyPlanStatus | undefined) ?? null;
}

/**
 * « Formule à activer » : la base refuserait une réservation (ni staff ni
 * formule, migration 20270141). Suspendu, seul le bandeau « abonnement
 * suspendu » s'affiche.
 */
export function needsPlan(s: MyPlanStatus | null | undefined): boolean {
  return !!s && !s.is_staff && !s.has_plan && !s.suspended;
}

/** Page de la box sur le site, où l'on paie la formule ; null si la box ne vend rien en ligne. */
export function planActivationUrl(s: MyPlanStatus | null | undefined, slug: string | null | undefined): string | null {
  return s?.pays_online && slug ? `${WEB_URL}/box/${encodeURIComponent(slug)}` : null;
}

// ── Mon abonnement (routes du site, Bearer de la session courante) ───────────

/** Ce que rend `GET /api/membership/overview` (AthleX-Manager, lib/membership/overview.ts). */
export interface MembershipOverview {
  box: { id: string; name: string | null };
  plan: { id: string; name: string } | null;
  price_cents: number | null;
  status: string | null;
  mode: 'online' | 'counter';
  /** Null au comptoir. */
  next_billing_at: string | null;
  /** « Carte •••• 4242 », « Prélèvement SEPA •••• 1234 » (texte du site, en français) ou null. */
  payment_method: string | null;
  scheduled_change: { plan: { id: string; name: string }; at: string | null } | null;
  pending_request: { plan: { id: string; name: string }; at: string } | null;
  available_plans: { id: string; name: string; price_cents: number }[];
  block_reason: 'past_due' | 'paused' | 'cancel_scheduled' | 'box_closed' | null;
  unpaid_invoice_url: string | null;
}

export interface PlanChangeResult {
  ok: true;
  mode: 'online' | 'counter';
  effective_at?: string | null;
  plan_name?: string;
}

/**
 * `auth` : pas de session, ou le site ne la reconnaît plus (reconnexion) ;
 * `none` : aucune adhésion active (404 de l'overview) ; `refused` : refus nommé
 * du site ; `network` : délai dépassé ou pas de réseau ; `server` : le reste.
 */
export type MembershipErrorKind = 'auth' | 'none' | 'refused' | 'network' | 'server';
export type MembershipResult<T> = { ok: true; data: T } | { ok: false; kind: MembershipErrorKind; message: string; code?: string };

export const MEMBERSHIP_TIMEOUT_MS = 15000;

/** Codes du site que l'app sait dire ; tout autre code devient le message générique. */
const KNOWN_CODES = [
  'PLAN_CHANGE_NOT_MEMBER', 'PLAN_CHANGE_BOX_CLOSED', 'PLAN_CHANGE_NOT_COUNTER', 'PLAN_CHANGE_PAST_DUE',
  'PLAN_CHANGE_PAUSED', 'PLAN_CHANGE_CANCEL_SCHEDULED', 'PLAN_CHANGE_INVALID_PLAN', 'PLAN_CHANGE_SAME_PLAN',
  'PLAN_CHANGE_PENDING_EXISTS', 'PLAN_CHANGE_FORBIDDEN', 'PLAN_CHANGE_NOT_FOUND', 'PLAN_CHANGE_FOREIGN_SCHEDULE',
  'PLAN_CHANGE_NOTHING_TO_CANCEL', 'PLAN_CHANGE_PAYMENTS_DISABLED', 'BOX_ARCHIVEE', 'BOX_ARCHIVAGE_PROGRAMME',
];

function fail(kind: MembershipErrorKind, code?: string): { ok: false; kind: MembershipErrorKind; message: string; code?: string } {
  const message = code && KNOWN_CODES.includes(code)
    ? i18n.t(`membership.errors.${code}`)
    : i18n.t(`membership.errors.${kind}`);
  return { ok: false, kind, message, ...(code ? { code } : {}) };
}

/**
 * Un appel au site avec le jeton de la session Supabase courante, lu à chaque
 * appel et jamais gardé ailleurs. Jamais d'exception : le résultat dit quoi afficher.
 */
async function callSite<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<MembershipResult<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return fail('auth');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEMBERSHIP_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${WEB_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    return fail('network');
  } finally {
    clearTimeout(timer);
  }

  const json = await res.json().catch(() => null) as (T & { code?: unknown }) | null;
  if (res.ok && json) return { ok: true, data: json };
  if (res.status === 401) return fail('auth');
  const code = typeof json?.code === 'string' ? json.code : undefined;
  if (res.status === 404 && path === '/api/membership/overview') return fail('none');
  if (code) return fail('refused', code);
  captureError(new Error(`membership ${path} ${res.status}`), { service: 'membership', action: path });
  return fail('server');
}

export function getMembershipOverview(): Promise<MembershipResult<MembershipOverview>> {
  return callSite<MembershipOverview>('/api/membership/overview', { method: 'GET' });
}

export function changeMembershipPlan(newPlanId: string): Promise<MembershipResult<PlanChangeResult>> {
  return callSite<PlanChangeResult>('/api/change-membership-plan', { method: 'POST', body: { new_plan_id: newPlanId } });
}

export function cancelMembershipPlanChange(): Promise<MembershipResult<{ ok: true; mode: 'online' | 'counter' }>> {
  return callSite('/api/change-membership-plan/cancel', { method: 'POST' });
}

/**
 * Le moyen de paiement dans la langue de l'app : le site l'envoie en français
 * (« Carte •••• 4242 », « Prélèvement SEPA •••• 1234 »). Un texte inconnu est
 * rendu tel quel.
 */
export function paymentMethodLabel(text: string | null): string | null {
  if (!text) return null;
  const card = /^Carte •••• (\d{4})$/.exec(text);
  if (card) return i18n.t('membership.payment.card', { last4: card[1] });
  const sepa = /^Prélèvement SEPA •••• (\d{4})$/.exec(text);
  if (sepa) return i18n.t('membership.payment.sepa', { last4: sepa[1] });
  return text;
}

/** « 49 € / mois » ; les formules d'abonnement sont mensuelles (prix Stripe `interval: 'month'`). */
export function monthlyPrice(cents: number): string {
  const amount = formatNumber(cents / 100, { maximumFractionDigits: cents % 100 ? 2 : 0, minimumFractionDigits: cents % 100 ? 2 : 0 });
  return i18n.t('membership.pricePerMonth', { amount });
}
