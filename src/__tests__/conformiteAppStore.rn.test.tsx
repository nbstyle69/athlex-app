/**
 * Conformité App Store 3.1.1 (#553, E9) : sur iOS, aucun prix de contenu numérique
 * et aucun lien d'achat de contenu numérique (programmations, Marketplace, AthleX Pro).
 *
 * 1. Écrans : les six écrans concernés sont montés avec le vrai react-native, sur iOS
 *    puis sur Android. Sur iOS, aucun texte rendu (fenêtres et alertes comprises) ne
 *    porte un prix, et un appui sur TOUT ce qui est appuyable (boutons des alertes
 *    compris) n'ouvre jamais /programming, /pricing ou /box/. Sur Android, les mêmes
 *    détecteurs trouvent bien prix et liens : le contrôle iOS n'est pas vide.
 * 2. Source : chaque ligne de src/ qui ouvre ou construit un lien d'achat, ou affiche
 *    un prix, figure ci-dessous dans SOURCE_AUTORISEE, un emplacement par entrée,
 *    avec sa raison. Une ligne nouvelle, ou une entrée retirée de la liste, fait
 *    échouer le test ; une entrée qui ne correspond plus à rien aussi.
 * 3. Textes : même règle pour les clés FR/EN qui portent un prix ou nomment le site
 *    (toutes les clés, donc bo.*, plan.*, reservation.* comprises).
 */
import fs from 'fs';
import path from 'path';
import React, { useEffect as mockUseEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import BOProgrammingScreen from '../screens/backoffice/BOProgrammingScreen';
import BOPaywallScreen from '../screens/backoffice/BOPaywallScreen';
import BOSubscriptionScreen from '../screens/backoffice/BOSubscriptionScreen';
import BoxProgramsScreen from '../screens/explorer/BoxProgramsScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import WaitingScreen from '../screens/onboarding/WaitingScreen';

const mockState: Record<string, any> = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: () => () => {}, canGoBack: () => true }),
  useRoute: () => ({ params: undefined }),
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View: V } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: V };
});
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 92 }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockState.auth }));
jest.mock('../context/ThemeContext', () => {
  const { lightTheme: th } = jest.requireActual('../theme/palette');
  const mockValue = { theme: th, mode: 'light' };
  return { useTheme: () => mockValue };
});
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/logger', () => ({ log: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('../lib/openCheckout', () => ({ ...jest.requireActual('../lib/openCheckout'), pollUntilTrue: async () => true }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'or', 'order', 'limit', 'in', 'is', 'not', 'update', 'insert', 'upsert', 'delete']) b[m] = () => b;
    const res = () => ({ data: mockState.tables[table] ?? [], error: null });
    b.single = b.maybeSingle = () => ({ then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok) });
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(res()).then(ok, ko);
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: async (name: string) => ({ data: mockState.rpc[name] ?? null, error: null }),
      channel: () => { const ch: Record<string, unknown> = {}; ch.on = () => ch; ch.subscribe = () => ch; return ch; },
      removeChannel: jest.fn(),
    },
  };
});

// ── Détecteurs ───────────────────────────────────────────────────────────────
/** Un prix affiché : « 29€ », « €29 », « 29 EUR », « $29 ». */
const PRIX = /\d\s*€|€\s*\d|\d\s*EUR\b|\$\s*\d/;
/** Un lien d'achat : page Marketplace, grille AthleX Pro (et son onboarding), page d'une box. */
const LIEN_ACHAT = /\/(programming|pricing|box)(\/|\?|$)/;

function baseState(subscription: 'canceled' | 'active' = 'canceled') {
  for (const k of Object.keys(mockState)) delete mockState[k];
  const noop = async () => {};
  mockState.auth = {
    user: { id: 'me', username: 'Sam', role: 'box_owner', level: 'rx' },
    currentBox: { id: 'b1', name: 'Box Alpha', owner_id: 'me', slug: 'box-alpha' },
    boxRole: 'owner',
    boxSubscription: subscription === 'canceled'
      ? { status: 'canceled', trial_ends_at: '2026-10-01T00:00:00Z', current_period_end: null, stripe_customer_id: null }
      : { status: 'active', trial_ends_at: null, current_period_end: '2026-11-01T00:00:00Z', stripe_customer_id: 'cus_test' },
    isBoxActive: subscription === 'active', daysLeftTrial: 0,
    signOut: jest.fn(noop), signUp: jest.fn(async () => ({ error: null })), skipBox: jest.fn(noop), refreshSubscription: jest.fn(noop),
  };
  mockState.tables = {
    box_programming_subscriptions: [],
    programs: [
      { id: 'g1', title: 'Strength Eight', description: null, type: 'fixed', duration_weeks: 8, days_per_week: 3, box_id: 'b2', boxes: { name: 'Box Two', logo_url: null, city: 'Lyon', slug: 'box-two' } },
    ],
  };
  mockState.rpc = {
    list_programming_catalog: [
      { programming_id: 'p1', publisher_box_id: 'b9', publisher_box_name: 'Box Nine', title: 'Engine Lab', description: null, discipline: 'crossfit', level: 'advanced', days_per_week: 4, weeks_count: 6, billing: 'monthly', price_cents: 2900, currency: 'eur' },
      { programming_id: 'p2', publisher_box_id: 'b8', publisher_box_name: 'Box Eight', title: 'Race Prep', description: null, discipline: 'hybrid', level: null, days_per_week: null, weeks_count: 8, billing: 'once', price_cents: 4900, currency: 'eur' },
      { programming_id: 'p3', publisher_box_id: 'b7', publisher_box_name: 'Box Seven', title: 'Run Club', description: null, discipline: 'endurance', level: null, days_per_week: null, weeks_count: 4, billing: 'free', price_cents: 0, currency: 'eur' },
    ],
  };
}

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: () => () => {}, canGoBack: () => true };
/** Les écrans contrôlés, montés tels que l'app les monte. */
const ECRANS: Record<string, { el: () => React.ReactElement; abonnement?: 'canceled' | 'active' }> = {
  'marketplace': { el: () => <BOProgrammingScreen navigation={nav} /> },
  'programmes-box': { el: () => <BoxProgramsScreen /> },
  'paywall': { el: () => <BOPaywallScreen /> },
  'abonnement-expire': { el: () => <BOSubscriptionScreen navigation={nav} />, abonnement: 'canceled' },
  'abonnement-actif': { el: () => <BOSubscriptionScreen navigation={nav} />, abonnement: 'active' },
  'inscription': { el: () => <RegisterScreen navigation={nav as any} /> },
  'attente-box': { el: () => <WaitingScreen navigation={nav} /> },
};

jest.setTimeout(30000);
const originalOS = Platform.OS;
let renderer: TestRenderer.ReactTestRenderer | null = null;
let alertes: Array<{ texte: string; boutons: Array<{ onPress?: () => void }> }> = [];
let liens: string[] = [];
afterEach(async () => {
  if (renderer) { const r = renderer; renderer = null; await act(async () => r.unmount()); }
  jest.restoreAllMocks();
  Platform.OS = originalOS;
});
afterAll(async () => { await i18n.changeLanguage('fr'); });

async function settle() {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
function textes(root: ReactTestInstance): string[] {
  const out = root.findAll((n) => String(n.type) === 'Text').map(hostText);
  for (const n of root.findAll((n) => typeof n.type === 'string')) {
    if (typeof n.props.accessibilityLabel === 'string') out.push(n.props.accessibilityLabel);
    if (typeof n.props.placeholder === 'string') out.push(n.props.placeholder);
  }
  return [...out, ...alertes.map((a) => a.texte)];
}

/** Monte l'écran sur l'OS demandé, appuie sur tout (deux tours, boutons d'alertes compris), rend textes et liens ouverts. */
async function explorer(nom: string, os: 'ios' | 'android') {
  const e = ECRANS[nom];
  baseState(e.abonnement);
  Platform.OS = os;
  alertes = []; liens = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    alertes.push({ texte: [title, message ?? '', ...(buttons ?? []).map((b) => b.text ?? '')].join(' | '), boutons: buttons ?? [] });
  });
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking, 'openURL').mockImplementation(async (url: string) => { liens.push(url); return true; });
  await act(async () => { renderer = TestRenderer.create(e.el()); });
  await settle();
  const vus: string[] = [];
  const evt = { stopPropagation() {}, preventDefault() {}, nativeEvent: {} };
  for (let tour = 0; tour < 2; tour++) {
    vus.push(...textes(renderer!.root));
    // Fonctions relevées avant d'appuyer : un appui re-rend l'écran et périme les nœuds.
    const appuis = renderer!.root.findAll((x) => typeof x.props.onPress === 'function').map((x) => x.props.onPress as (e: unknown) => unknown);
    for (const onPress of appuis) await act(async () => { await onPress(evt); });
    for (const a of [...alertes]) for (const b of a.boutons) if (b.onPress) await act(async () => { await b.onPress!(); });
    await settle();
  }
  vus.push(...textes(renderer!.root));
  const r = renderer!; renderer = null; await act(async () => r.unmount());
  return { textes: vus, liens };
}

describe('iOS : aucun prix de contenu numérique, aucun lien d\'achat', () => {
  for (const lang of ['fr', 'en']) {
    for (const nom of Object.keys(ECRANS)) {
      it(`${nom} (${lang})`, async () => {
        await i18n.changeLanguage(lang);
        const { textes: vus, liens: ouverts } = await explorer(nom, 'ios');
        expect(vus.filter((t) => PRIX.test(t))).toEqual([]);
        expect(ouverts.filter((u) => LIEN_ACHAT.test(u))).toEqual([]);
      });
    }
  }
});

// Témoin : sur Android, les mêmes détecteurs voient prix et liens. Sans ce témoin, un
// détecteur cassé (ou un écran qui ne monte plus) laisserait passer le contrôle iOS.
describe('Android : prix et liens conservés (témoin des détecteurs)', () => {
  const ATTENDU: Record<string, { prix: boolean; lien: RegExp }> = {
    'marketplace': { prix: true, lien: /\/programming$/ },
    'programmes-box': { prix: false, lien: /\/box\/box-two$/ },
    'paywall': { prix: true, lien: /\/pricing\?box_id=b1$/ },
    'abonnement-expire': { prix: true, lien: /\/pricing\?box_id=b1$/ },
    'abonnement-actif': { prix: true, lien: /\/pricing\/manage\?box_id=b1$/ },
    'inscription': { prix: false, lien: /\/pricing\/onboarding$/ },
    'attente-box': { prix: false, lien: /\/pricing\/onboarding$/ },
  };
  for (const nom of Object.keys(ECRANS)) {
    it(nom, async () => {
      await i18n.changeLanguage('fr');
      const { textes: vus, liens: ouverts } = await explorer(nom, 'android');
      expect(vus.some((t) => PRIX.test(t))).toBe(ATTENDU[nom].prix);
      expect(ouverts.some((u) => ATTENDU[nom].lien.test(u))).toBe(true);
    });
  }
});

// ── Source : chaque emplacement de prix ou de lien d'achat, un par un ────────
type Raison = 'android' | 'definition' | 'service-physique';
interface Entree { fichier: string; extrait: string; raison: Raison; ecran?: string; pourquoi: string }

const PHYSIQUE_ABONNEMENT_SALLE = "C — abonnement de salle : service physique consommé hors de l'app (3.1.3(e)), pas du contenu numérique";
const PHYSIQUE_PRIX_FORMULE = "D — prix d'une formule de box : service physique (accès à la salle), pas du contenu numérique";
const PHYSIQUE_COMPTE = "E — régler son abonnement de salle (/compte) : service physique, pas du contenu numérique";
const PHYSIQUE_COMPETITION = "F — inscription payante à une compétition en salle : événement réel, pas du contenu numérique";
const ANDROID = 'affiché ou ouvert sur Android seulement ; le montage iOS de l\'écran le prouve';

const SOURCE_AUTORISEE: Entree[] = [
  // Définitions : elles ne s'affichent pas ; chacun de leurs appels est listé plus bas.
  { fichier: 'lib/urls.ts', extrait: 'export const OWNER_ONBOARDING_URL', raison: 'definition', pourquoi: 'adresse, appelée par inscription et attente-box' },
  { fichier: 'lib/urls.ts', extrait: 'export const PRICING_URL', raison: 'definition', pourquoi: 'adresse, appelée par paywall et abonnement' },
  { fichier: 'lib/athlexProPrice.ts', extrait: 'export const ATHLEX_PRO_PRICE_EUR', raison: 'definition', pourquoi: 'constante unique du 79 € et du 749 €' },
  { fichier: 'services/membership.ts', extrait: 'export function planActivationUrl', raison: 'definition', pourquoi: 'adresse /box/, appelée par les quatre emplacements C' },
  { fichier: 'services/membership.ts', extrait: '/box/${encodeURIComponent(slug)}', raison: 'definition', pourquoi: 'corps de planActivationUrl' },
  { fichier: 'services/membership.ts', extrait: 'export function monthlyPrice', raison: 'definition', pourquoi: 'format des prix de formule, appelé par les emplacements D' },
  { fichier: 'utils/programmingPrice.ts', extrait: 'export function programmingPrice', raison: 'definition', pourquoi: 'format du prix d\'une programmation, appelé par la Marketplace' },
  { fichier: 'utils/programmingPrice.ts', extrait: 'p.price_cents / 100', raison: 'definition', pourquoi: 'corps de programmingPrice' },

  // Contenu numérique, Android seulement (D4, D5, décisions A et B du 15/10).
  { fichier: 'screens/backoffice/BOProgrammingScreen.tsx', extrait: '`${WEB_URL}/programming`', raison: 'android', ecran: 'marketplace', pourquoi: ANDROID },
  { fichier: 'screens/backoffice/BOProgrammingScreen.tsx', extrait: ': programmingPrice(p);', raison: 'android', ecran: 'marketplace', pourquoi: ANDROID },
  { fichier: 'screens/explorer/BoxProgramsScreen.tsx', extrait: '`${SITE_BASE_URL}/box/${slug}`', raison: 'android', ecran: 'programmes-box', pourquoi: ANDROID },
  { fichier: 'screens/backoffice/BOPaywallScreen.tsx', extrait: '`${PRICING_URL}?box_id=', raison: 'android', ecran: 'paywall', pourquoi: ANDROID },
  { fichier: 'screens/backoffice/BOPaywallScreen.tsx', extrait: '<Text style={S.price}>', raison: 'android', ecran: 'paywall', pourquoi: ANDROID },
  { fichier: 'screens/backoffice/BOPaywallScreen.tsx', extrait: "t('bo.paywall.subscribe'", raison: 'android', ecran: 'paywall', pourquoi: ANDROID },
  { fichier: 'screens/backoffice/BOSubscriptionScreen.tsx', extrait: '`${PRICING_URL}?box_id=', raison: 'android', ecran: 'abonnement-expire', pourquoi: ANDROID },
  { fichier: 'screens/backoffice/BOSubscriptionScreen.tsx', extrait: '`${PRICING_URL}/manage', raison: 'android', ecran: 'abonnement-actif', pourquoi: ANDROID },
  { fichier: 'screens/backoffice/BOSubscriptionScreen.tsx', extrait: '<Text style={S.priceAmount}>', raison: 'android', ecran: 'abonnement-expire', pourquoi: ANDROID },
  { fichier: 'screens/backoffice/BOSubscriptionScreen.tsx', extrait: "t('bo.subscription.annual'", raison: 'android', ecran: 'abonnement-expire', pourquoi: ANDROID },
  { fichier: 'screens/backoffice/BOSubscriptionScreen.tsx', extrait: "t('bo.subscription.subscribePrice'", raison: 'android', ecran: 'abonnement-expire', pourquoi: ANDROID },
  { fichier: 'screens/auth/RegisterScreen.tsx', extrait: 'Linking.openURL(OWNER_ONBOARDING_URL)', raison: 'android', ecran: 'inscription', pourquoi: ANDROID },
  { fichier: 'screens/onboarding/WaitingScreen.tsx', extrait: 'Linking.openURL(OWNER_ONBOARDING_URL)', raison: 'android', ecran: 'attente-box', pourquoi: ANDROID },

  // C — activer son abonnement de salle (lien /box/), gardé sur iOS : quatre emplacements, nommés un par un.
  { fichier: 'components/PlanToActivateNotice.tsx', extrait: 'planActivationUrl(status, box.slug)', raison: 'service-physique', pourquoi: PHYSIQUE_ABONNEMENT_SALLE },
  { fichier: 'screens/reservation/ReservationScreen.tsx', extrait: 'noPlanButtons(planActivationUrl(', raison: 'service-physique', pourquoi: PHYSIQUE_ABONNEMENT_SALLE },
  { fichier: 'screens/onboarding/BoxWelcomeScreen.tsx', extrait: 'planActivationUrl(status, joinedBox.slug)', raison: 'service-physique', pourquoi: PHYSIQUE_ABONNEMENT_SALLE },
  { fichier: 'screens/profile/ProfileScreen.tsx', extrait: 'planActivationUrl(planStatuses[e.box.id]', raison: 'service-physique', pourquoi: PHYSIQUE_ABONNEMENT_SALLE },

  // D — prix des formules de box.
  { fichier: 'screens/profile/MyMembershipScreen.tsx', extrait: 'testID="membership-price"', raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },
  { fichier: 'screens/profile/MyMembershipScreen.tsx', extrait: "t('membership.scheduled.bodyPrice'", raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },
  { fichier: 'screens/profile/ChangeMembershipPlanScreen.tsx', extrait: 'price: monthlyPrice(plan.price_cents),', raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },
  { fichier: 'screens/profile/ChangeMembershipPlanScreen.tsx', extrait: "t('membership.choose.nextBillingBody'", raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },
  { fichier: 'screens/profile/ChangeMembershipPlanScreen.tsx', extrait: '{monthlyPrice(cents)}', raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },
  { fichier: 'screens/backoffice/BOMembersScreen.tsx', extrait: '(plan.price_cents / 100).toFixed(2)', raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },

  // E — régler son abonnement de salle sur /compte.
  { fichier: 'screens/profile/MyMembershipScreen.tsx', extrait: '`${WEB_URL}/compte`', raison: 'service-physique', pourquoi: PHYSIQUE_COMPTE },
  { fichier: 'screens/reservation/ReservationScreen.tsx', extrait: '`${WEB_URL}/compte`', raison: 'service-physique', pourquoi: PHYSIQUE_COMPTE },

  // F — compétitions physiques : prix d'inscription et lien d'inscription externe.
  { fichier: 'screens/competition/PhysicalCompetitionScreen.tsx', extrait: '{selected.price ? (', raison: 'service-physique', pourquoi: PHYSIQUE_COMPETITION },
  { fichier: 'screens/competition/PhysicalCompetitionScreen.tsx', extrait: 'label={selected.price}', raison: 'service-physique', pourquoi: PHYSIQUE_COMPETITION },
  { fichier: 'screens/competition/PhysicalCompetitionScreen.tsx', extrait: 'c.price.trim()', raison: 'service-physique', pourquoi: PHYSIQUE_COMPETITION },
  { fichier: 'screens/competition/PhysicalCompetitionScreen.tsx', extrait: '{comp.price ?', raison: 'service-physique', pourquoi: PHYSIQUE_COMPETITION },
  { fichier: 'screens/competition/PhysicalCompetitionScreen.tsx', extrait: 'openURL(selected.registration_url!)', raison: 'service-physique', pourquoi: PHYSIQUE_COMPETITION },
];

/** Une ligne de code qui construit ou ouvre un lien d'achat. */
const SOURCE_LIEN = /\/programming\b|\/pricing\b|\/box\/|PRICING_URL|OWNER_ONBOARDING_URL|planActivationUrl\(|\/compte\b|registration_url!\)/;
/** Une ligne de code qui affiche ou calcule un prix. */
const SOURCE_PRIX = /€|monthlyPrice\(|programmingPrice\(|athlexProPrice\(|ATHLEX_PRO_PRICE_EUR|price_cents\s*\/\s*100|\.price\b/;

const SRC = path.join(__dirname, '..');
function fichiers(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return ['__tests__', '__mocks__', 'types'].includes(e.name) ? [] : fichiers(path.join(dir, e.name));
    return /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [];
  });
}
function lignesSensibles(): Array<{ fichier: string; ligne: number; texte: string }> {
  const out: Array<{ fichier: string; ligne: number; texte: string }> = [];
  for (const f of fichiers(SRC)) {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    fs.readFileSync(f, 'utf8').split('\n').forEach((texte, i) => {
      const t = texte.trim();
      if (/^(\/\/|\*|\/\*|\{\/\*|import )/.test(t)) return; // commentaires et imports
      if (SOURCE_LIEN.test(texte) || SOURCE_PRIX.test(texte)) out.push({ fichier: rel, ligne: i + 1, texte: t });
    });
  }
  return out;
}

describe('Source : la liste des emplacements est complète et vérifiée', () => {
  const lignes = lignesSensibles();
  const couvre = (e: Entree, l: { fichier: string; texte: string }) => e.fichier === l.fichier && l.texte.includes(e.extrait);

  it('chaque prix ou lien d\'achat du code figure dans la liste', () => {
    const horsListe = lignes.filter((l) => !SOURCE_AUTORISEE.some((e) => couvre(e, l))).map((l) => `${l.fichier}:${l.ligne}  ${l.texte}`);
    expect(horsListe).toEqual([]);
  });
  it('chaque entrée de la liste désigne exactement une ligne', () => {
    const fausses = SOURCE_AUTORISEE.filter((e) => lignes.filter((l) => couvre(e, l)).length !== 1).map((e) => `${e.fichier} « ${e.extrait} »`);
    expect(fausses).toEqual([]);
  });
  it('chaque entrée Android renvoie à un écran monté sur iOS ci-dessus', () => {
    const sansEcran = SOURCE_AUTORISEE.filter((e) => e.raison === 'android' && !(e.ecran && ECRANS[e.ecran])).map((e) => e.extrait);
    expect(sansEcran).toEqual([]);
  });
});

// ── Textes : clés qui portent un prix ou nomment le site ─────────────────────
const TEXTES_AUTORISES: Record<string, { raison: Raison | 'marque'; pourquoi: string }> = {
  'bo.programming.priceEur': { raison: 'android', pourquoi: 'format des prix Marketplace et AthleX Pro, rendus sur Android seulement' },
  'bo.paywall.subscribe': { raison: 'android', pourquoi: 'bouton du paywall, Android seulement' },
  'bo.subscription.annual': { raison: 'android', pourquoi: 'prix annuel, Android seulement' },
  'bo.subscription.subscribePrice': { raison: 'android', pourquoi: "bouton de l'écran d'abonnement, Android seulement" },
  'auth.ownerLink': { raison: 'android', pourquoi: "lien d'inscription gérant, Android seulement" },
  'auth.ownerA11y': { raison: 'android', pourquoi: "libellé d'accessibilité du même lien, Android seulement" },
  'onboarding.waiting.ownerCta': { raison: 'android', pourquoi: 'bouton gérant, Android seulement' },
  'membership.pricePerMonth': { raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },
  'membership.scheduled.bodyPrice': { raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },
  'membership.choose.onlineBody': { raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },
  'membership.choose.nextBillingBody': { raison: 'service-physique', pourquoi: PHYSIQUE_PRIX_FORMULE },
  'membership.manageOnSiteHint': { raison: 'service-physique', pourquoi: PHYSIQUE_COMPTE },
  'sharePerf.site': { raison: 'marque', pourquoi: "signature de l'image de partage d'une performance : ni prix, ni lien, ni achat" },
};
const TEXTE_SENSIBLE = /\d\s*€|€\s*\d|\{\{(price|amount)\}\}|athlexapp/;

function aplatir(o: Record<string, unknown>, p = ''): Array<[string, string]> {
  return Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? aplatir(v as Record<string, unknown>, `${p}${k}.`) : [[`${p}${k}`, String(v)] as [string, string]]));
}

describe('Textes FR/EN : la liste des clés à prix ou à adresse est complète et vérifiée', () => {
  const sensibles = new Set<string>();
  for (const lang of ['fr', 'en']) {
    const res = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', 'locales', `${lang}.json`), 'utf8'));
    for (const [k, v] of aplatir(res)) if (TEXTE_SENSIBLE.test(v)) sensibles.add(k);
  }
  it('chaque clé à prix ou à adresse figure dans la liste', () => {
    expect([...sensibles].filter((k) => !TEXTES_AUTORISES[k])).toEqual([]);
  });
  it('chaque clé de la liste porte encore un prix ou une adresse', () => {
    expect(Object.keys(TEXTES_AUTORISES).filter((k) => !sensibles.has(k))).toEqual([]);
  });
});
