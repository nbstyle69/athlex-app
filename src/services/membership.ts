import { supabase } from '../lib/supabase';
import { captureError } from '../lib/sentry';
import i18n from '../i18n';
import { WEB_URL } from '../lib/urls';

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
  const date = new Date(state.date).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'fr-FR', {
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
