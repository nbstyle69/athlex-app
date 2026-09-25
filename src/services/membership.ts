import { supabase } from '../lib/supabase';
import { captureError } from '../lib/sentry';
import i18n from '../i18n';

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
