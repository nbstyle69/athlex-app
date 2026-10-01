// Lot 4 « Rejoindre une box en payant » : état de la formule (my_box_plan_status, migration 20270141).
const mockRpc = jest.fn();
const mockCapture = jest.fn();
jest.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock('../lib/sentry', () => ({ captureError: (...a: unknown[]) => mockCapture(...a) }));

import { getMyPlanStatus, needsPlan, planActivationUrl, type MyPlanStatus } from '../services/membership';

const SANS_FORMULE: MyPlanStatus = { is_staff: false, has_plan: false, suspended: false, credits_left: 0, pays_online: true };

beforeEach(() => { mockRpc.mockReset(); mockCapture.mockReset(); });

describe('needsPlan : « Formule à activer » exactement quand la base refuserait la réservation', () => {
  it('ni staff ni formule, non suspendu : oui', () => {
    expect(needsPlan(SANS_FORMULE)).toBe(true);
    // Des séances restantes ne changent rien : has_plan le dit déjà.
    expect(needsPlan({ ...SANS_FORMULE, credits_left: 3 })).toBe(true);
  });
  it('formule, staff : non', () => {
    expect(needsPlan({ ...SANS_FORMULE, has_plan: true })).toBe(false);
    expect(needsPlan({ ...SANS_FORMULE, is_staff: true })).toBe(false);
  });
  it('suspendu : le bandeau « abonnement suspendu » prime, jamais les deux', () => {
    expect(needsPlan({ ...SANS_FORMULE, suspended: true })).toBe(false);
  });
  it('état inconnu (appel échoué, pas membre actif) : rien', () => {
    expect(needsPlan(null)).toBe(false);
    expect(needsPlan(undefined)).toBe(false);
  });
});

describe('planActivationUrl : la page de la box sur le site, jamais un achat dans l’app', () => {
  it('box qui vend en ligne : /box/<slug>', () => {
    expect(planActivationUrl(SANS_FORMULE, 'athlex-fitness')).toBe('https://athlexapp.eu/box/athlex-fitness');
    expect(planActivationUrl(SANS_FORMULE, 'a b/c')).toBe('https://athlexapp.eu/box/a%20b%2Fc');
  });
  it('box sans formule en ligne, sans slug ou état inconnu : aucun bouton', () => {
    expect(planActivationUrl({ ...SANS_FORMULE, pays_online: false }, 'athlex-fitness')).toBeNull();
    expect(planActivationUrl(SANS_FORMULE, null)).toBeNull();
    expect(planActivationUrl(SANS_FORMULE, '')).toBeNull();
    expect(planActivationUrl(null, 'athlex-fitness')).toBeNull();
  });
});

describe('getMyPlanStatus', () => {
  it('appelle my_box_plan_status pour la box et rend la ligne', async () => {
    mockRpc.mockResolvedValue({ data: [SANS_FORMULE], error: null });
    await expect(getMyPlanStatus('b1')).resolves.toEqual(SANS_FORMULE);
    expect(mockRpc).toHaveBeenCalledWith('my_box_plan_status', { p_box_id: 'b1' });
  });
  it('aucune ligne (pas membre actif) : null', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await expect(getMyPlanStatus('b1')).resolves.toBeNull();
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(getMyPlanStatus('b1')).resolves.toBeNull();
    expect(mockCapture).not.toHaveBeenCalled();
  });
  it('appel échoué : null et erreur remontée, l’app reste utilisable', async () => {
    const error = { message: 'boom' };
    mockRpc.mockResolvedValue({ data: null, error });
    await expect(getMyPlanStatus('b1')).resolves.toBeNull();
    expect(mockCapture).toHaveBeenCalledWith(error, { service: 'membership', action: 'getMyPlanStatus' });
  });
});
