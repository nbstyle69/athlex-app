jest.mock('../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

import i18n from '../i18n';
import { membershipState, membershipStateText, MyMembership } from '../services/membership';

const base: MyMembership = {
  box_id: 'b1',
  subscription_status: 'active',
  subscription_current_period_end: '2026-10-31T10:00:00.000Z',
  subscription_cancel_at_period_end: false,
  past_due_since: null,
  dunning_grace_days: 7,
  suspended: false,
  has_stripe_subscription: true,
  stopped_at: null,
  stop_mode: null,
};

describe('membershipState', () => {
  it('abonnement actif sans fin programmée : rien à dire', () => {
    expect(membershipState(base)).toBeNull();
    expect(membershipState({ ...base, subscription_status: null, has_stripe_subscription: false })).toBeNull();
  });

  it('suspendu : la base le dit, l\'app ne recalcule pas', () => {
    expect(membershipState({ ...base, subscription_status: 'past_due', past_due_since: '2026-09-01T00:00:00.000Z', suspended: true }))
      .toEqual({ key: 'suspended' });
    // Impayé ancien mais pas suspendu pour la base (délai de la box) : pas de suspension côté app.
    expect(membershipState({ ...base, subscription_status: 'past_due', past_due_since: '2026-01-01T00:00:00.000Z', suspended: false })?.key)
      .toBe('pastDue');
  });

  it('impayé dans le délai : date limite = début de l\'impayé + délai de la box', () => {
    expect(membershipState({ ...base, subscription_status: 'past_due', past_due_since: '2026-09-20T12:00:00.000Z', dunning_grace_days: 3 }))
      .toEqual({ key: 'pastDue', date: '2026-09-23T12:00:00.000Z' });
    expect(membershipState({ ...base, subscription_status: 'past_due', past_due_since: '2026-09-20T12:00:00.000Z', dunning_grace_days: null }))
      .toEqual({ key: 'pastDue', date: '2026-09-27T12:00:00.000Z' });
  });

  it('fin programmée : la fin de la période payée', () => {
    expect(membershipState({ ...base, subscription_cancel_at_period_end: true }))
      .toEqual({ key: 'endsOn', date: '2026-10-31T10:00:00.000Z' });
  });

  it('arrêté tout de suite par la box : la date de l\'arrêt', () => {
    expect(membershipState({ ...base, subscription_status: 'cancelled', stopped_at: '2026-09-25T21:00:00.000Z', stop_mode: 'now' }))
      .toEqual({ key: 'stoppedOn', date: '2026-09-25T21:00:00.000Z' });
  });

  it('terminé en fin de période (arrêt programmé ou résiliation) : la fin de période', () => {
    expect(membershipState({ ...base, subscription_status: 'cancelled', stopped_at: '2026-09-01T00:00:00.000Z', stop_mode: 'period_end' }))
      .toEqual({ key: 'endedOn', date: '2026-10-31T10:00:00.000Z' });
    expect(membershipState({ ...base, subscription_status: 'canceled' }))
      .toEqual({ key: 'endedOn', date: '2026-10-31T10:00:00.000Z' });
  });

  it('un ancien arrêt n\'est pas montré si l\'abonnement a repris', () => {
    expect(membershipState({ ...base, stopped_at: '2026-01-01T00:00:00.000Z', stop_mode: 'now' })).toBeNull();
  });
});

describe('membershipStateText', () => {
  const d = '2026-10-31T10:00:00.000Z';
  it('français', async () => {
    await i18n.changeLanguage('fr');
    expect(membershipStateText({ key: 'endsOn', date: d })).toBe('Ton abonnement prend fin le 31 octobre 2026.');
    expect(membershipStateText({ key: 'stoppedOn', date: d })).toBe('Ta box a arrêté ton abonnement le 31 octobre 2026.');
    expect(membershipStateText({ key: 'endedOn', date: d })).toBe('Ton abonnement a pris fin le 31 octobre 2026.');
    expect(membershipStateText({ key: 'pastDue', date: d }))
      .toBe('Ton dernier paiement a échoué. Mets ton moyen de paiement à jour avant le 31 octobre 2026 pour continuer à réserver.');
    expect(membershipStateText({ key: 'suspended' })).toBe('Abonnement suspendu : paiement en retard.');
  });
  it('anglais', async () => {
    await i18n.changeLanguage('en');
    expect(membershipStateText({ key: 'endsOn', date: d })).toBe('Your membership ends on October 31, 2026.');
    expect(membershipStateText({ key: 'stoppedOn', date: d })).toBe('Your box stopped your membership on October 31, 2026.');
    expect(membershipStateText({ key: 'endedOn', date: d })).toBe('Your membership ended on October 31, 2026.');
    expect(membershipStateText({ key: 'pastDue', date: d }))
      .toBe('Your last payment failed. Update your payment method before October 31, 2026 to keep booking.');
    expect(membershipStateText({ key: 'suspended' })).toBe('Membership suspended: payment overdue.');
  });
});
