// Mon abonnement (C2) : service des trois routes du site, écran « Mon abonnement » et choix de formule.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Alert, Linking, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import i18n from '../i18n';
import { WEB_URL } from '../lib/urls';
import {
  MEMBERSHIP_TIMEOUT_MS, cancelMembershipPlanChange, changeMembershipPlan, counterAccess, getMembershipOverview, monthlyPrice,
  parisToday, paymentMethodLabel, type MembershipOverview, type MyMembership,
} from '../services/membership';
import MyMembershipScreen from '../screens/profile/MyMembershipScreen';
import ChangeMembershipPlanScreen from '../screens/profile/ChangeMembershipPlanScreen';

let mockTheme = lightTheme;
let mockFocus: (() => void | (() => void)) | null = null;
const mockSession = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(() => { mockFocus = cb; return cb(); }, [cb]),
    useNavigation: () => ({ goBack: mockGoBack }),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 122 }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
const mockRpc = jest.fn();
jest.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: () => mockSession() }, rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const TOKEN = 'jeton-de-test';
const fetchMock = jest.fn();
(global as unknown as { fetch: unknown }).fetch = fetchMock;

function reply(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

const BASE: MembershipOverview = {
  box: { id: 'b1', name: 'AthleX Fitness' },
  plan: { id: 'p-ill', name: 'Mensuel illimité' },
  price_cents: 4900,
  status: 'active',
  mode: 'online',
  next_billing_at: '2026-11-01T12:00:00Z',
  payment_method: 'Carte •••• 4242',
  scheduled_change: null,
  pending_request: null,
  available_plans: [
    { id: 'p-3', name: '3 séances / semaine', price_cents: 3500 },
    { id: 'p-pre', name: 'Premium', price_cents: 6950 },
  ],
  block_reason: null,
  unpaid_invoice_url: null,
};
const COUNTER: MembershipOverview = { ...BASE, mode: 'counter', next_billing_at: null, payment_method: null };

let renderer: TestRenderer.ReactTestRenderer | null = null;
beforeEach(async () => {
  mockSession.mockResolvedValue({ data: { session: { access_token: TOKEN } } });
  mockRpc.mockResolvedValue({ data: [], error: null });
  await i18n.changeLanguage('fr');
});
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.useRealTimers();
  fetchMock.mockReset();
  mockFocus = null;
});

async function settle() {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
async function mount(el: React.ReactElement, theme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  await settle();
  return renderer!.root;
}
const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
const hostText = (n: ReactTestInstance): string => n.children.map((c) => (typeof c === 'string' ? c : hostText(c))).join('');
const texts = (root: ReactTestInstance) => root.findAll(isHostText).map(hostText);
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const byId = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type !== 'string')[0]
  ?? root.findAll((n) => n.props.testID === id)[0];
const host = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];
const has = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id).length > 0;
async function press(root: ReactTestInstance, id: string) {
  const host = root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
  await act(async () => { host.props.onPress(); });
  await settle();
}
const navigation = { navigate: jest.fn(), goBack: mockGoBack } as any;
const overviewScreen = () => <MyMembershipScreen navigation={navigation} route={{ key: 'k', name: 'MyMembership' } as any} />;
const changeScreen = (o: MembershipOverview) => (
  <ChangeMembershipPlanScreen navigation={navigation} route={{ key: 'k', name: 'ChangeMembershipPlan', params: { overview: o } } as any} />
);
async function showOverview(o: MembershipOverview, theme = lightTheme) {
  fetchMock.mockImplementation(() => reply(200, o));
  return mount(overviewScreen(), theme);
}

// ── Service ──────────────────────────────────────────────────────────────────

describe('service : appels au site', () => {
  it('overview : GET avec le jeton de la session courante', async () => {
    fetchMock.mockImplementation(() => reply(200, BASE));
    const r = await getMembershipOverview();
    expect(r).toEqual({ ok: true, data: BASE });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${WEB_URL}/api/membership/overview`);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body).toBeUndefined();
    expect(mockSession).toHaveBeenCalledTimes(1);
  });

  it('le jeton est relu à chaque appel (jamais gardé)', async () => {
    fetchMock.mockImplementation(() => reply(200, BASE));
    await getMembershipOverview();
    mockSession.mockResolvedValue({ data: { session: { access_token: 'autre' } } });
    await getMembershipOverview();
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer autre');
  });

  it('sans jeton : aucun appel, message de reconnexion', async () => {
    mockSession.mockResolvedValue({ data: { session: null } });
    const r = await getMembershipOverview();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, kind: 'auth', message: 'Ta session a expiré. Reconnecte-toi pour gérer ton abonnement.' });
  });

  it('401 du site : reconnexion', async () => {
    fetchMock.mockImplementation(() => reply(401, { error: 'Non authentifié.' }));
    expect(await changeMembershipPlan('p-3')).toMatchObject({ ok: false, kind: 'auth' });
  });

  it('404 de l\'overview : aucune adhésion active', async () => {
    fetchMock.mockImplementation(() => reply(404, { error: "Tu n'as pas d'adhésion active." }));
    expect(await getMembershipOverview()).toEqual({ ok: false, kind: 'none', message: "Tu n'as pas d'adhésion active." });
  });

  it('change : POST du new_plan_id, réponse rendue', async () => {
    const ok = { ok: true, mode: 'online', effective_at: '2026-11-01T12:00:00Z', plan_name: '3 séances / semaine' };
    fetchMock.mockImplementation(() => reply(200, ok));
    expect(await changeMembershipPlan('p-3')).toEqual({ ok: true, data: ok });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${WEB_URL}/api/change-membership-plan`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ new_plan_id: 'p-3' });
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('refus nommés traduits (PLAN_CHANGE_* et BOX_*)', async () => {
    const cases: [string, string][] = [
      ['PLAN_CHANGE_PAST_DUE', "Règle d'abord ton impayé pour changer de formule."],
      ['PLAN_CHANGE_PENDING_EXISTS', 'Une demande de changement est déjà en attente.'],
      ['PLAN_CHANGE_FOREIGN_SCHEDULE', "Ton abonnement a déjà une modification programmée par ta box : rapproche-toi d'elle."],
      ['BOX_ARCHIVEE', 'Cette box est archivée : ta formule ne peut plus changer.'],
      ['BOX_ARCHIVAGE_PROGRAMME', 'Cette box ferme bientôt : ta formule ne peut plus changer.'],
    ];
    for (const [code, message] of cases) {
      fetchMock.mockImplementationOnce(() => reply(409, { error: 'texte du site', code }));
      expect(await changeMembershipPlan('p-3')).toEqual({ ok: false, kind: 'refused', code, message });
    }
  });

  it('chaque code du site a sa phrase dans les deux langues', () => {
    const codes = fs.readFileSync(path.join(__dirname, '../services/membership.ts'), 'utf8')
      .match(/'(PLAN_CHANGE_[A-Z_]+|BOX_ARCHIV[A-Z_]+)'/g)!.map((s) => s.slice(1, -1));
    expect(codes).toHaveLength(16);
    for (const lng of ['fr', 'en']) {
      for (const code of codes) expect(i18n.exists(`membership.errors.${code}`, { lng })).toBe(true);
    }
  });

  it('code inconnu : message générique de refus, le texte français du site n\'est pas montré', async () => {
    fetchMock.mockImplementation(() => reply(409, { error: 'texte du site', code: 'PLAN_CHANGE_NOUVEAU' }));
    expect(await changeMembershipPlan('p-3')).toEqual({ ok: false, kind: 'refused', code: 'PLAN_CHANGE_NOUVEAU', message: 'Action refusée par ta box.' });
  });

  it('réseau coupé : erreur réseau', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Network request failed')));
    expect(await getMembershipOverview()).toEqual({ ok: false, kind: 'network', message: 'Connexion impossible. Vérifie ton réseau et réessaie.' });
  });

  it('délai dépassé : la requête est interrompue au bout de MEMBERSHIP_TIMEOUT_MS', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_u: string, init: { signal: AbortSignal }) => new Promise((_res, rej) => {
      signal = init.signal;
      init.signal.addEventListener('abort', () => rej(new Error('Aborted')));
    }));
    const p = cancelMembershipPlanChange();
    await Promise.resolve(); await Promise.resolve();
    jest.advanceTimersByTime(MEMBERSHIP_TIMEOUT_MS - 1);
    expect(signal!.aborted).toBe(false);
    jest.advanceTimersByTime(1);
    expect(signal!.aborted).toBe(true);
    expect(await p).toMatchObject({ ok: false, kind: 'network' });
  });

  it('500 sans code : erreur générique', async () => {
    fetchMock.mockImplementation(() => reply(500, { error: 'Lecture impossible.' }));
    expect(await getMembershipOverview()).toEqual({ ok: false, kind: 'server', message: 'Une erreur est survenue. Réessaie dans un instant.' });
  });

  it('réponse illisible : erreur générique', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('x')) }));
    expect(await getMembershipOverview()).toMatchObject({ ok: false, kind: 'server' });
  });

  it('cancel : POST sans corps ; rien à annuler → refus nommé', async () => {
    fetchMock.mockImplementationOnce(() => reply(200, { ok: true, mode: 'online' }));
    expect(await cancelMembershipPlanChange()).toEqual({ ok: true, data: { ok: true, mode: 'online' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${WEB_URL}/api/change-membership-plan/cancel`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    fetchMock.mockImplementationOnce(() => reply(409, { error: 'x', code: 'PLAN_CHANGE_NOTHING_TO_CANCEL' }));
    expect(await cancelMembershipPlanChange()).toMatchObject({ kind: 'refused', message: "Aucun changement de formule n'est en attente." });
  });
});

describe('service : textes', () => {
  it('moyen de paiement traduit, quatre chiffres gardés', async () => {
    expect(paymentMethodLabel('Carte •••• 4242')).toBe('Carte •••• 4242');
    await i18n.changeLanguage('en');
    expect(paymentMethodLabel('Carte •••• 4242')).toBe('Card •••• 4242');
    expect(paymentMethodLabel('Prélèvement SEPA •••• 1234')).toBe('SEPA direct debit •••• 1234');
    expect(paymentMethodLabel('Autre')).toBe('Autre');
    expect(paymentMethodLabel(null)).toBeNull();
  });

  it('prix mensuel : entier sans décimales, centimes sinon', async () => {
    expect(monthlyPrice(4900)).toBe('49 € / mois');
    expect(monthlyPrice(6950)).toBe('69,50 € / mois');
    await i18n.changeLanguage('en');
    expect(monthlyPrice(3500)).toBe('€35 / month');
  });
});

// ── Écran « Mon abonnement » ─────────────────────────────────────────────────

describe('Mon abonnement : états', () => {
  it('chargement : indicateur, rien d\'autre', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const root = await mount(overviewScreen());
    expect(has(root, 'membership-loading')).toBe(true);
    expect(has(root, 'membership-plan-card')).toBe(false);
  });

  it.each([['clair', lightTheme], ['sombre', darkTheme]])('en ligne, actif (%s) : carte, Changer, Paiement et résiliation', async (_n, theme) => {
    const root = await showOverview(BASE, theme);
    const c = theme.ax;
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Mon abonnement', 'AthleX Fitness', 'Formule en cours', 'Mensuel illimité', 'Actif', '49 € / mois',
      'Prochaine échéance', '1 nov. 2026', 'Paiement', 'Carte •••• 4242', 'Changer de formule',
      'Le changement prend effet à ta prochaine échéance.', 'Paiement et résiliation',
      'Gérer mon paiement sur le site', 'Carte bancaire, prélèvement et résiliation se gèrent sur athlexapp.eu.',
    ]));
    // Typo : titre et prix en Oswald, couleurs du thème.
    const name = byId(root, 'membership-plan-name');
    expect(flat(name)).toMatchObject({ fontFamily: 'Oswald_500Medium', fontSize: 26, textTransform: 'uppercase', color: c.text });
    expect(flat(byId(root, 'membership-price'))).toMatchObject({ fontSize: 24, color: c.accentText });
    // Centrage et alignements de la maquette.
    expect(flat(byId(root, 'membership-box')).textAlign).toBe('center');
    expect(flat(byId(root, 'membership-change-hint')).textAlign).toBe('center');
    expect(byId(root, 'membership-change').props.fullWidth).toBe(true);
    expect(byId(root, 'membership-manage-site').props.variant).toBe('outline');
    expect(byId(root, 'membership-change').props.variant ?? 'accent').toBe('accent');
    // Carte vedette : liseré accent, padding 18.
    expect(has(root, 'ax-card-rule')).toBe(true);
    expect(flat(byId(root, 'membership-plan-card').findAll((n) => typeof n.type === 'string')[0])).toMatchObject({ paddingTop: 18, paddingBottom: 18, paddingLeft: 18 });
  });

  it('le défilement réserve la place de la barre d\'onglets sous le dernier bouton', async () => {
    const root = await showOverview(BASE);
    const scroll = root.findAll((n) => n.props.testID === 'membership-scroll' && n.props.contentContainerStyle)[0];
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ paddingBottom: 122, paddingHorizontal: 20, gap: 14 });
  });

  it('« Changer de formule » ouvre le choix avec l\'overview', async () => {
    const root = await showOverview(BASE);
    await press(root, 'membership-change');
    expect(navigation.navigate).toHaveBeenCalledWith('ChangeMembershipPlan', { overview: BASE });
  });

  it('« Gérer mon paiement sur le site » ouvre /compte', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await showOverview(BASE);
    await press(root, 'membership-manage-site');
    expect(open).toHaveBeenCalledWith(`${WEB_URL}/compte`);
  });

  it('changement programmé : encart, « Annuler ce changement », Changer masqué', async () => {
    const o = { ...BASE, scheduled_change: { plan: { id: 'p-3', name: '3 séances / semaine' }, at: '2026-11-01T12:00:00Z' } };
    const root = await showOverview(o);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Changement programmé', '3 séances / semaine à 35 € / mois à partir du 1 nov. 2026.', 'Annuler ce changement',
    ]));
    expect(has(root, 'membership-change')).toBe(false);
    expect(has(root, 'membership-billing')).toBe(true);
  });

  it('annuler un changement : confirmation, appel, rechargement', async () => {
    const o = { ...BASE, scheduled_change: { plan: { id: 'p-3', name: '3 séances / semaine' }, at: '2026-11-01T12:00:00Z' } };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const root = await showOverview(o);
    await press(root, 'membership-cancel');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [title, msg, btns] = alert.mock.calls[0] as [string, string, { text: string; style?: string; onPress?: () => Promise<void> }[]];
    expect([title, msg]).toEqual(['Annuler ce changement ?', 'Tu gardes ta formule actuelle.']);
    expect(btns.map((b) => b.text)).toEqual(['Garder', 'Annuler ce changement']);
    fetchMock.mockImplementationOnce(() => reply(200, { ok: true, mode: 'online' }));
    fetchMock.mockImplementationOnce(() => reply(200, BASE));
    await act(async () => { await btns[1].onPress!(); });
    await settle();
    expect(fetchMock.mock.calls[1][0]).toBe(`${WEB_URL}/api/change-membership-plan/cancel`);
    expect(fetchMock.mock.calls[2][0]).toBe(`${WEB_URL}/api/membership/overview`);
    expect(has(root, 'membership-scheduled')).toBe(false);
    expect(has(root, 'membership-change')).toBe(true);
  });

  it('annulation refusée : le message s\'affiche sous le bouton', async () => {
    const o = { ...BASE, scheduled_change: { plan: { id: 'p-3', name: '3 séances / semaine' }, at: '2026-11-01T12:00:00Z' } };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const root = await showOverview(o);
    await press(root, 'membership-cancel');
    fetchMock.mockImplementationOnce(() => reply(409, { error: 'x', code: 'PLAN_CHANGE_NOTHING_TO_CANCEL' }));
    const btns = alert.mock.calls[0][2] as { onPress?: () => Promise<void> }[];
    await act(async () => { await btns[1].onPress!(); });
    await settle();
    const encart = byId(root, 'membership-scheduled');
    const kids = encart.findAll(isHostText).map(hostText);
    expect(kids.indexOf("Aucun changement de formule n'est en attente.")).toBeGreaterThan(kids.indexOf('Annuler ce changement'));
  });

  it('impayé : encart en premier, mise à jour sur /compte, Changer indisponible avec sa phrase', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const o: MembershipOverview = { ...BASE, block_reason: 'past_due', status: 'past_due', next_billing_at: '2026-10-01T12:00:00Z', payment_method: 'Prélèvement SEPA •••• 1234', unpaid_invoice_url: 'https://invoice.example/x' };
    const root = await showOverview(o, darkTheme);
    const all = texts(root);
    expect(all.indexOf('Paiement en retard')).toBeLessThan(all.indexOf('Formule en cours'));
    expect(all).toEqual(expect.arrayContaining([
      'Impayé', 'Échue le 1 oct. 2026', 'Prélèvement SEPA •••• 1234', 'Mettre à jour mon paiement',
      "Le changement de formule est indisponible tant que le paiement n'est pas régularisé.",
    ]));
    expect(has(root, 'membership-change')).toBe(false);
    expect(has(root, 'membership-billing')).toBe(false);
    expect(flat(host(root, 'membership-unpaid')).borderColor).toBe(darkTheme.ax.danger);
    expect(flat(byId(root, 'membership-blocked')).textAlign).toBeUndefined();
    await press(root, 'membership-update-payment');
    expect(open).toHaveBeenCalledWith(`${WEB_URL}/compte`);
  });

  it.each([
    ['cancel_scheduled', 'Résiliation programmée', "Ton abonnement s'arrête à la fin de la période en cours : ta formule ne peut plus changer."],
    ['paused', 'En pause', 'Ton abonnement est en pause : tu pourras changer de formule quand il reprendra.'],
    ['box_closed', 'Box fermée', 'Ta box ferme : ta formule ne peut plus changer.'],
  ] as const)('%s : Changer masqué, état affiché', async (reason, label, sentence) => {
    const root = await showOverview({ ...BASE, block_reason: reason });
    expect(has(root, 'membership-change')).toBe(false);
    expect(texts(root)).toEqual(expect.arrayContaining([label, sentence]));
    expect(has(root, 'membership-billing')).toBe(true);
  });

  it('comptoir : « Au comptoir », pas d\'échéance, demande de changement, pas de bloc paiement', async () => {
    const root = await showOverview(COUNTER);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Au comptoir', 'Demander un changement de formule', "Tu paies au comptoir : ta box valide le changement et l'encaisse.",
    ]));
    expect(has(root, 'membership-next-billing')).toBe(false);
    expect(has(root, 'membership-billing')).toBe(false);
    await press(root, 'membership-change');
    expect(navigation.navigate).toHaveBeenCalledWith('ChangeMembershipPlan', { overview: COUNTER });
  });

  it('demande envoyée : encart, « Annuler ma demande », demande masquée', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const o = { ...COUNTER, pending_request: { plan: { id: 'p-3', name: '3 séances / semaine' }, at: '2026-10-05T12:00:00Z' } };
    const root = await showOverview(o, darkTheme);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Demande envoyée à ta box', '3 séances / semaine · envoyée le 5 oct. 2026. Ta box te confirmera le changement.', 'Annuler ma demande',
    ]));
    expect(has(root, 'membership-change')).toBe(false);
    expect(flat(host(root, 'membership-pending')).borderColor).toBe(darkTheme.ax.warning);
    await press(root, 'membership-cancel');
    expect(alert.mock.calls[0][0]).toBe('Annuler ta demande ?');
  });

  it('aucune formule à proposer : phrase, pas de bouton', async () => {
    const root = await showOverview({ ...BASE, available_plans: [] });
    expect(texts(root)).toContain('Ta box ne propose aucune autre formule pour le moment.');
    expect(has(root, 'membership-change')).toBe(false);
  });

  it('erreur réseau : message et « Réessayer » qui recharge', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Network request failed')));
    const root = await mount(overviewScreen());
    expect(texts(root)).toContain('Connexion impossible. Vérifie ton réseau et réessaie.');
    expect(flat(host(root, 'membership-retry-wrap')).alignSelf).toBe('center');
    fetchMock.mockImplementationOnce(() => reply(200, BASE));
    await press(root, 'membership-retry');
    expect(has(root, 'membership-plan-card')).toBe(true);
    expect(has(root, 'membership-error')).toBe(false);
  });

  it('jeton absent : message de reconnexion, pas de « Réessayer »', async () => {
    mockSession.mockResolvedValue({ data: { session: null } });
    const root = await mount(overviewScreen());
    expect(texts(root)).toContain('Ta session a expiré. Reconnecte-toi pour gérer ton abonnement.');
    expect(has(root, 'membership-retry')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pas d\'adhésion active : message, pas de « Réessayer »', async () => {
    fetchMock.mockImplementation(() => reply(404, { error: 'x' }));
    const root = await mount(overviewScreen());
    expect(texts(root)).toContain("Tu n'as pas d'adhésion active.");
    expect(has(root, 'membership-retry')).toBe(false);
  });

  it('rechargé au retour sur l\'écran', async () => {
    const root = await showOverview(BASE);
    fetchMock.mockImplementation(() => reply(200, { ...BASE, scheduled_change: { plan: { id: 'p-3', name: '3 séances / semaine' }, at: '2026-11-01T12:00:00Z' } }));
    await act(async () => { mockFocus!(); });
    await settle();
    expect(has(root, 'membership-scheduled')).toBe(true);
  });

  it('en anglais : tout l\'écran suit la langue', async () => {
    await i18n.changeLanguage('en');
    const root = await showOverview(BASE);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'My membership', 'Current plan', 'Active', '€49 / month', 'Next payment', 'Card •••• 4242', 'Change plan',
      'Payment and cancellation', 'Manage my payment on the website',
    ]));
  });
});

// ── Accès payé au comptoir (Paiements au comptoir, PR 6 ; maquettes 655:1558 à 655:2148) ──
// Aujourd'hui = 13 oct. 2026 à Paris, comme dans la maquette. Seule la date est simulée.
const NOW = new Date('2026-10-13T10:00:00Z');
const REAL_TIMERS = ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'] as const;
const ROW: MyMembership = {
  box_id: 'b1', status: 'active', subscription_status: 'active', subscription_current_period_end: null,
  subscription_cancel_at_period_end: false, past_due_since: null, dunning_grace_days: 7, suspended: false,
  has_stripe_subscription: false, stopped_at: null, stop_mode: null, cash_access_until: '2026-11-12', box_sells_online: true,
};
async function showCounter(row: Partial<MyMembership> | null, o: MembershipOverview = COUNTER, theme = lightTheme) {
  jest.useFakeTimers({ now: NOW, doNotFake: [...REAL_TIMERS] });
  mockRpc.mockResolvedValue({ data: row ? [{ ...ROW, ...row }] : [], error: null });
  return showOverview(o, theme);
}
/** Rang de chaque testID dans l'ordre d'affichage (-1 : absent). */
const order = (root: ReactTestInstance, ...ids: string[]) => {
  const all = root.findAll((n) => typeof n.type === 'string' && ids.includes(n.props.testID)).map((n) => n.props.testID);
  const seen = all.filter((id, i) => all.indexOf(id) === i);
  return ids.map((id) => seen.indexOf(id));
};
const COUNTER_HINT = "Tu paies au comptoir : ta box valide le changement et l'encaisse.";

describe('Mon abonnement : accès payé au comptoir', () => {
  it('lit get_my_membership_billing, une seule fois et rien d\'autre', async () => {
    await showCounter({});
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_my_membership_billing');
  });

  it.each([['clair', lightTheme], ['sombre', darkTheme]])('en cours (%s) : « Accès payé jusqu’au », bouton menthe vers /compte, changement en contour', async (_n, theme) => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await showCounter({}, COUNTER, theme);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Actif', 'Accès payé jusqu’au', '12 nov. 2026', 'Au comptoir', 'Passer au paiement en ligne',
      'Rien à payer aujourd’hui : ton premier prélèvement aura lieu après la fin de ton accès.',
      'Demander un changement de formule', COUNTER_HINT,
    ]));
    expect(has(root, 'membership-access-ending')).toBe(false);
    expect(has(root, 'membership-access-ended')).toBe(false);
    expect(has(root, 'membership-next-billing')).toBe(false);
    expect(byId(root, 'membership-go-online').props.variant ?? 'accent').toBe('accent');
    expect(byId(root, 'membership-change').props.variant).toBe('outline');
    expect(flat(byId(root, 'membership-go-online-hint')).textAlign).toBe('center');
    expect(order(root, 'membership-plan-card', 'membership-go-online', 'membership-go-online-hint', 'membership-change'))
      .toEqual([0, 1, 2, 3]);
    await press(root, 'membership-go-online');
    expect(open).toHaveBeenCalledWith(`${WEB_URL}/compte`);
  });

  it.each([['clair', lightTheme], ['sombre', darkTheme]])('fin proche (%s) : encart ambre en tête, date courte, bouton dans l\'encart', async (_n, theme) => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await showCounter({ cash_access_until: '2026-10-20' }, COUNTER, theme);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Ton accès se termine le 20 oct.',
      'Passe au paiement en ligne pour continuer à réserver, sans payer deux fois : rien n’est prélevé avant la fin de ton accès.',
      'Passer au paiement en ligne', 'Accès payé jusqu’au', '20 oct. 2026', 'Actif', COUNTER_HINT,
    ]));
    expect(flat(host(root, 'membership-access-ending')).borderColor).toBe(theme.ax.warning);
    expect(order(root, 'membership-access-ending', 'membership-plan-card', 'membership-change')).toEqual([0, 1, 2]);
    expect(host(root, 'membership-access-ending').findAll((n) => n.props.testID === 'membership-go-online').length).toBeGreaterThan(0);
    expect(has(root, 'membership-go-online-hint')).toBe(false);
    expect(byId(root, 'membership-change').props.variant).toBe('outline');
    await press(root, 'membership-go-online');
    expect(open).toHaveBeenCalledWith(`${WEB_URL}/compte`);
  });

  it.each([
    ['2026-10-20', 'endingSoon'], ['2026-10-13', 'endingSoon'], ['2026-10-21', 'current'],
  ] as const)('seuil des 7 jours : fin le %s → %s', (until, key) => {
    expect(counterAccess(COUNTER, [{ ...ROW, cash_access_until: until }], '2026-10-13')?.key).toBe(key);
  });

  it.each([['clair', lightTheme], ['sombre', darkTheme]])('terminé (%s) : encart rouge, pastille « Accès terminé », plus de demande de changement', async (_n, theme) => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await showCounter({ subscription_status: 'expired', cash_access_until: '2026-10-10' }, { ...COUNTER, status: 'expired' }, theme);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Ton accès est terminé', 'Tu ne peux plus réserver. Active ton abonnement en ligne pour réserver à nouveau.',
      'Activer mon abonnement en ligne', 'Accès terminé', 'Accès terminé le', '10 oct. 2026', 'Au comptoir',
    ]));
    expect(flat(host(root, 'membership-access-ended')).borderColor).toBe(theme.ax.danger);
    expect(byId(root, 'membership-status').props.tone).toBe('danger');
    expect(order(root, 'membership-access-ended', 'membership-plan-card')).toEqual([0, 1]);
    expect(has(root, 'membership-change')).toBe(false);
    expect(texts(root)).not.toContain(COUNTER_HINT);
    expect(texts(root)).not.toContain('Actif');
    await press(root, 'membership-go-online');
    expect(open).toHaveBeenCalledWith(`${WEB_URL}/compte`);
  });

  it('expirée mais date pas encore passée : aucun bloc', () => {
    expect(counterAccess(COUNTER, [{ ...ROW, subscription_status: 'expired', cash_access_until: '2026-10-13' }], '2026-10-13')).toBeNull();
  });

  it.each([
    ['formule à 0 €', { ...COUNTER, price_cents: 0 }, {}],
    ['sans prix', { ...COUNTER, price_cents: null }, {}],
    ['sans date de fin (Accès démo)', COUNTER, { cash_access_until: null }],
    ['en ligne', BASE, {}],
    ['adhésion d\'une autre box', COUNTER, { box_id: 'b2' }],
    ['adhésion quittée', COUNTER, { status: 'left' }],
  ] as const)('%s : l\'écran reste comme aujourd\'hui', async (_n, o, row) => {
    const root = await showCounter(row, o as MembershipOverview);
    for (const id of ['membership-access-until', 'membership-access-ending', 'membership-access-ended', 'membership-go-online', 'membership-go-online-hint']) {
      expect(has(root, id)).toBe(false);
    }
    expect(byId(root, 'membership-change').props.variant ?? 'accent').toBe('accent');
    expect(texts(root)).not.toContain('Accès payé jusqu’au');
  });

  it('lecture du billing en échec : l\'écran reste comme aujourd\'hui', async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: [...REAL_TIMERS] });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    const root = await showOverview(COUNTER);
    expect(has(root, 'membership-plan-card')).toBe(true);
    expect(has(root, 'membership-access-until')).toBe(false);
  });

  it.each([
    ['en cours', '2026-11-12', 'active'], ['fin proche', '2026-10-20', 'active'], ['terminé', '2026-10-10', 'expired'],
  ] as const)('box sans vente en ligne, %s : texte qui renvoie au comptoir, aucun bouton vers le site', async (_n, until, st) => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await showCounter({ box_sells_online: false, cash_access_until: until, subscription_status: st });
    expect(has(root, 'membership-go-online')).toBe(false);
    expect(has(root, 'membership-go-online-hint')).toBe(false);
    expect(has(root, 'membership-access-until')).toBe(true);
    const sentence = 'Ta box ne propose pas le paiement en ligne : rapproche-toi d’elle pour renouveler.';
    if (until === '2026-11-12') expect(texts(root)).not.toContain(sentence);
    else expect(texts(root)).toContain(sentence);
    expect(open).not.toHaveBeenCalled();
  });

  it('date de Paris : 22 h 30 UTC le 13 oct. est déjà le 14 à Paris', () => {
    expect(parisToday(new Date('2026-10-13T22:30:00Z'))).toBe('2026-10-14');
    expect(parisToday(new Date('2026-10-13T21:59:00Z'))).toBe('2026-10-13');
  });

  it('en anglais : fin proche et terminé sans un mot de français', async () => {
    await i18n.changeLanguage('en');
    let root = await showCounter({ cash_access_until: '2026-10-20' });
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Your access ends on 20 Oct', 'Switch to online payment', 'Access paid until', '20 Oct 2026',
    ]));
    await act(async () => renderer!.unmount());
    renderer = null;
    root = await showCounter({ subscription_status: 'expired', cash_access_until: '2026-10-10' });
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Your access has ended', 'Activate my membership online', 'Access ended', 'Access ended on', '10 Oct 2026',
    ]));
    for (const k of ['paidUntil', 'endedOn', 'goOnline', 'goOnlineHint', 'endingTitle', 'endingBody', 'endedTitle', 'endedBody', 'activateOnline', 'noOnlineBody']) {
      expect(i18n.t(`membership.counterAccess.${k}`)).not.toMatch(/[àâçéèêëîïôûù’]|\b(ton|ta|tu|le|la|de|du|accès|paiement)\b/i);
    }
  });
});

// ── Choix de formule ─────────────────────────────────────────────────────────

describe('Changer de formule', () => {
  it('liste : formule actuelle étiquetée, formules proposées, bouton inactif sans choix', async () => {
    const root = await mount(changeScreen(BASE), darkTheme);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Changer de formule', 'Formules proposées par AthleX Fitness', 'Mensuel illimité', 'Formule actuelle',
      '3 séances / semaine', '35 € / mois', 'Premium', '69,50 € / mois', 'Confirmer le changement',
    ]));
    expect(flat(byId(root, 'change-plan-subtitle')).textAlign).toBe('center');
    expect(byId(root, 'change-plan-submit').props.disabled).toBe(true);
    expect(has(root, 'change-plan-recap')).toBe(false);
    expect(byId(root, 'plan-option-p-ill').props.onPress).toBeUndefined();
  });

  it('en ligne : choix, récapitulatif daté, confirmation, retour', async () => {
    const root = await mount(changeScreen(BASE), darkTheme);
    await press(root, 'plan-option-p-3');
    expect(has(root, 'plan-option-p-3-on')).toBe(true);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'À partir du 1 nov. 2026',
      "Tu gardes Mensuel illimité jusqu'au 31 oct. Ta nouvelle formule, 3 séances / semaine à 35 € / mois, sera prélevée à partir du 1 nov.",
    ]));
    expect(byId(root, 'change-plan-submit').props.disabled).toBe(false);
    fetchMock.mockImplementation(() => reply(200, { ok: true, mode: 'online', effective_at: '2026-11-01T12:00:00Z', plan_name: '3 séances / semaine' }));
    await press(root, 'change-plan-submit');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ new_plan_id: 'p-3' });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('formule choisie : bordure accent 2 px, prix en accent', async () => {
    const root = await mount(changeScreen(BASE), darkTheme);
    await press(root, 'plan-option-p-3');
    const card = root.findAll((n) => n.props.testID === 'plan-option-p-3' && n.props.accessibilityRole === 'button')[0];
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({ borderWidth: 2, borderColor: darkTheme.ax.accent });
    const price = card.findAll(isHostText).find((n) => hostText(n) === '35 € / mois')!;
    expect(flat(price).color).toBe(darkTheme.ax.accentText);
  });

  it('refus du site : message sous le bouton, pas de retour', async () => {
    const root = await mount(changeScreen(BASE));
    await press(root, 'plan-option-p-3');
    fetchMock.mockImplementation(() => reply(409, { error: 'x', code: 'PLAN_CHANGE_CANCEL_SCHEDULED' }));
    await press(root, 'change-plan-submit');
    const all = texts(root);
    expect(all.indexOf("Ton abonnement s'arrête bientôt : tu ne peux plus changer de formule.")).toBeGreaterThan(all.indexOf('Confirmer le changement'));
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('erreur réseau à l\'envoi : message sous le bouton', async () => {
    const root = await mount(changeScreen(BASE));
    await press(root, 'plan-option-p-pre');
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Network request failed')));
    await press(root, 'change-plan-submit');
    expect(texts(root)).toContain('Connexion impossible. Vérifie ton réseau et réessaie.');
  });

  it('comptoir : récapitulatif « Demande à ta box », « Envoyer ma demande »', async () => {
    const root = await mount(changeScreen(COUNTER));
    await press(root, 'plan-option-p-3');
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Demande à ta box', "Ta box reçoit ta demande. Le changement s'applique dès qu'elle l'accepte.", 'Envoyer ma demande',
    ]));
    fetchMock.mockImplementation(() => reply(200, { ok: true, mode: 'counter', plan_name: '3 séances / semaine' }));
    await press(root, 'change-plan-submit');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  const WITH_DESC: MembershipOverview = {
    ...BASE,
    plan: { id: 'p-ill', name: 'Mensuel illimité', description: 'Accès à tous les cours, sans limite.' },
    available_plans: [
      { id: 'p-3', name: '3 séances / semaine', price_cents: 3500, description: 'Trois cours par semaine au choix.' },
      { id: 'p-pre', name: 'Premium', price_cents: 6950, description: null },
    ],
  };
  const optionTexts = (root: ReactTestInstance, id: string) =>
    host(root, `plan-option-${id}`).findAll(isHostText).map(hostText);

  it.each([['en ligne', 'online'], ['comptoir', 'counter']] as const)('description (%s) : sous le nom, au-dessus de l’étiquette, Texte/Mini secondaire', async (_n, mode) => {
    const root = await mount(changeScreen({ ...WITH_DESC, mode }), darkTheme);
    expect(optionTexts(root, 'p-ill')).toEqual(['Mensuel illimité', 'Accès à tous les cours, sans limite.', 'Formule actuelle', '49 € / mois']);
    expect(optionTexts(root, 'p-3')).toEqual(['3 séances / semaine', 'Trois cours par semaine au choix.', '35 € / mois']);
    const d = flat(host(root, 'plan-option-p-3-description'));
    expect(d).toMatchObject({ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: darkTheme.ax.textMuted });
  });

  it('sans description (null, absente, vide, espaces) : rien, aucun espace réservé', async () => {
    const o: MembershipOverview = {
      ...BASE,
      plan: { id: 'p-ill', name: 'Mensuel illimité', description: '   ' },
      available_plans: [
        { id: 'p-3', name: '3 séances / semaine', price_cents: 3500, description: '' },
        { id: 'p-pre', name: 'Premium', price_cents: 6950, description: null },
        { id: 'p-x', name: 'Sans champ', price_cents: 1000 },
      ],
    };
    const root = await mount(changeScreen(o));
    for (const id of ['p-ill', 'p-3', 'p-pre', 'p-x']) expect(has(root, `plan-option-${id}-description`)).toBe(false);
    expect(optionTexts(root, 'p-3')).toEqual(['3 séances / semaine', '35 € / mois']);
  });

  it('description non traduite : affichée telle quelle en anglais', async () => {
    await i18n.changeLanguage('en');
    const root = await mount(changeScreen(WITH_DESC));
    expect(optionTexts(root, 'p-3')).toEqual(['3 séances / semaine', 'Trois cours par semaine au choix.', '€35 / month']);
  });

  it('aucune formule à proposer : phrase, pas de bouton', async () => {
    const root = await mount(changeScreen({ ...BASE, available_plans: [] }));
    expect(texts(root)).toContain('Ta box ne propose aucune autre formule pour le moment.');
    expect(has(root, 'change-plan-submit')).toBe(false);
  });
});

// ── Profil ───────────────────────────────────────────────────────────────────

describe('Profil : « Gérer mon abonnement »', () => {
  const src = fs.readFileSync(path.join(__dirname, '../screens/profile/ProfileScreen.tsx'), 'utf8');
  const block = src.slice(src.indexOf('testID="profile-manage-subscription"'), src.indexOf("t('profile.account.manageSubscriptionSub')"));

  it('ouvre l\'écran Mon abonnement, plus le site', () => {
    expect(block).toContain("onPress={() => navigation.navigate('MyMembership')}");
    expect(block).not.toContain('Linking.openURL');
  });

  it('les deux écrans sont déclarés dans les quatre piles où vit le Profil', () => {
    const nav = fs.readFileSync(path.join(__dirname, '../navigation/index.tsx'), 'utf8');
    for (const stack of ['HomeStack', 'WhiteboardStack', 'TrainingStack', 'BOProfileStack']) {
      expect(nav).toContain(`<${stack}.Screen name="MyMembership" component={MyMembershipScreen} />`);
      expect(nav).toContain(`<${stack}.Screen name="ChangeMembershipPlan" component={ChangeMembershipPlanScreen} />`);
    }
  });

  it('l\'app ne vend rien : aucun lien Stripe ni portail dans l\'écran', () => {
    const screen = fs.readFileSync(path.join(__dirname, '../screens/profile/MyMembershipScreen.tsx'), 'utf8');
    expect(screen).not.toMatch(/stripe|payment-portal|unpaid_invoice_url/i);
    expect(screen.match(/Linking\.openURL\(([^)]*)\)/g)).toEqual(['Linking.openURL(`${WEB_URL}/compte`)']);
  });
});

describe('textes', () => {
  it('ni « CrossFit » ni « Hyrox » dans les textes de l\'écran', () => {
    for (const lng of ['fr', 'en']) {
      const s = JSON.stringify(i18n.getResourceBundle(lng, 'translation').membership);
      expect(s).not.toMatch(/crossfit|hyrox/i);
    }
  });

  it('les deux langues ont exactement les mêmes clés', () => {
    const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(i18n.getResourceBundle('en', 'translation').membership).sort())
      .toEqual(keys(i18n.getResourceBundle('fr', 'translation').membership).sort());
  });
});

