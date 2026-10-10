/**
 * Chantier anglais, groupe Explorer : chaque écran du groupe est monté avec le
 * vrai react-native (données fictives, aucun réseau).
 * - FR : textes affichés, placeholders, libellés d'accessibilité et alertes
 *   identiques à l'instantané pris sur master avant la traduction
 *   (i18nExplorerAvant.json ; I18N_EXPLORER_CAPTURE=<fichier> pour le reprendre).
 * - EN : aucun texte accentué, et aucun texte resté identique au français hors
 *   données fictives (contenu des box et des partenaires) et libellés identiques par nature.
 */
import React from 'react';
import { Alert, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import BEFORE from './i18nExplorerAvant.json';
import BoxDirectoryScreen from '../screens/explorer/BoxDirectoryScreen';
import BoxDirectoryDetailScreen from '../screens/explorer/BoxDirectoryDetailScreen';
import BoxDirectoryMapScreen from '../screens/explorer/BoxDirectoryMapScreen';
import BoxDirectoryMapScreenWeb from '../screens/explorer/BoxDirectoryMapScreen.web';
import PartnersScreen from '../screens/explorer/PartnersScreen';
import PartnerDetailScreen from '../screens/explorer/PartnerDetailScreen';
import BoxProgramsScreen from '../screens/explorer/BoxProgramsScreen';
import ProgrammationScreen from '../screens/explorer/ProgrammationScreen';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { strictAllowed } = require('../../scripts/i18n/scanner');

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: Record<string, unknown> | undefined;
const mockTables: Record<string, unknown[]> = {};

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: () => true, setOptions: jest.fn() }),
    useRoute: () => ({ params: mockRouteParams }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
jest.mock('react-native-maps', () => {
  const { View, Pressable } = jest.requireActual('react-native');
  const R = jest.requireActual('react');
  const MapView = R.forwardRef((p: { children?: unknown }, _ref: unknown) => R.createElement(View, null, p.children));
  const Marker = (p: { onPress?: () => void; children?: unknown }) => R.createElement(Pressable, { testID: 'map-marker', onPress: p.onPress }, p.children);
  return { __esModule: true, default: MapView, Marker, Callout: View };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', username: 'Sam' }, currentBox: null }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').lightTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let one = false;
    const b: Record<string, unknown> = {};
    const rows = () => (mockTables[table] ?? []) as unknown[];
    for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'is', 'or']) b[m] = () => b;
    b.single = () => { one = true; return b; };
    b.maybeSingle = b.single;
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(one ? { data: rows()[0] ?? null, error: rows()[0] ? null : { message: 'not found' } } : { data: rows(), count: rows().length, error: null }).then(res, rej);
    return b;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

// Données fictives neutres (contenu des box et des partenaires, jamais traduit).
const BOX_A = {
  id: 'b1', name: 'Iron Lab', slug: 'iron-lab', tagline: 'Train hard', description: 'Open since 2019',
  logo_url: null, cover_url: null, address: '12 Main Street', city: 'Boston', latitude: 42.36, longitude: -71.06,
  phone: '0102030405', contact_email: 'hello@iron-lab.example', website_url: 'https://iron-lab.example',
  instagram_url: 'https://instagram.example/ironlab', google_maps_url: 'https://maps.example/ironlab',
  opening_hours: { Monday: '6am-9pm', Saturday: '9am-1pm' }, founded_at: '2019-03-01T00:00:00Z',
  sport_type: ['crossfit', 'weightlifting', 'gymnastics', 'hiit', 'yoga', 'boxing', 'mma', 'functional', 'hyrox'],
  services: ['parking', 'showers', 'lockers', 'shop', 'nutrition', 'physio', 'childcare', 'sauna', 'openGym'],
  is_active: true, is_listed: true, member_count: 1,
};
const BOX_B = { ...BOX_A, id: 'b2', name: 'North Gym', city: 'Denver', tagline: null, sport_type: ['hiit'], member_count: 12 };
const BOX_MIN = { ...BOX_A, id: 'b3', name: 'Small Box', tagline: null, description: null, founded_at: null, sport_type: [], services: [], opening_hours: null, address: null, phone: null, contact_email: null, website_url: null, instagram_url: null };
const PARTNERS = ['nutrition', 'equipment', 'apparel', 'supplements', 'recovery', 'coaching', 'software', 'other'].map((cat, i) => ({
  id: `p${i}`, name: `Brand ${i}`, category: cat, logo_url: null, description: i % 2 ? 'Quality gear' : null,
  offer_title: i % 2 ? null : 'Ten percent off', is_active: true, sort_order: i,
}));
const PARTNER_FULL = {
  id: 'px', name: 'Brand X', category: 'supplements', logo_url: null, description: 'Quality gear',
  offer_title: 'Ten percent off', offer_description: 'On the whole store', offer_code: 'ATHLEX10',
  website_url: 'https://brand.example', instagram_url: 'https://instagram.example/brand',
};
const PROGRAMS = [
  { id: 'g1', title: 'Engine Builder', description: 'Aerobic base', type: 'fixed', duration_weeks: 8, days_per_week: 3, box_id: 'b1', boxes: { name: 'Iron Lab', logo_url: null, city: 'Boston', slug: 'iron-lab' } },
  { id: 'g2', title: 'Daily Grind', description: null, type: 'ongoing', duration_weeks: null, days_per_week: 1, box_id: 'b1', boxes: { name: 'Iron Lab', logo_url: null, city: 'Boston', slug: 'iron-lab' } },
  { id: 'g3', title: 'Lift Club', description: 'Barbell work', type: 'fixed', duration_weeks: 1, days_per_week: 5, box_id: 'b2', boxes: { name: 'North Gym', logo_url: null, city: null, slug: null } },
];

let renderer: TestRenderer.ReactTestRenderer;
let alerts: string[] = [];
beforeEach(() => {
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    alerts.push(['ALERTE', title, message ?? '', ...(buttons ?? []).map((b) => b.text ?? '')].join(' | '));
  });
  mockRouteParams = undefined;
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  mockTables.boxes = [BOX_A, BOX_B];
  mockTables.box_members = [{ box_id: 'b1' }, ...Array.from({ length: 12 }, () => ({ box_id: 'b2' }))];
  mockTables.partners = PARTNERS;
  mockTables.programs = PROGRAMS;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
afterAll(async () => { await i18n.changeLanguage('fr'); });

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
/** Textes, placeholders et libellés d'accessibilité dans l'ordre de l'arbre ; fenêtres ouvertes à la fin. */
function collect(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance, inModal: boolean) => {
    if (n.type === Modal && !inModal) return;
    if (typeof n.type === 'string') {
      if (typeof n.props.placeholder === 'string') out.push(`placeholder: ${n.props.placeholder}`);
      if (typeof n.props.accessibilityLabel === 'string') out.push(`a11y: ${n.props.accessibilityLabel}`);
    }
    if (isHostText(n)) {
      const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
      out.push(upper ? hostText(n).toUpperCase() : hostText(n));
      return;
    }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch, inModal); });
  };
  walk(root, false);
  for (const m of root.findAllByType(Modal).filter((x) => x.props.visible)) {
    out.push('── fenêtre ──');
    walk(m, true);
  }
  return [...out, ...alerts].filter((t) => t.replace(/^(placeholder|a11y): /, '').trim().length > 0);
}
async function settle() {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
async function mount(el: React.ReactElement) {
  await act(async () => { renderer = TestRenderer.create(el); });
  await settle();
  return renderer.root;
}
/** Appuie sur l'élément `testID` (le composant qui porte `onPress`). */
async function press(root: ReactTestInstance, id: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await act(async () => { n.props.onPress({ stopPropagation: () => {} }); });
  await settle();
}
async function type(root: ReactTestInstance, id: string, text: string) {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onChangeText === 'function')[0];
  if (!n) throw new Error(`champ introuvable : ${id}`);
  await act(async () => { n.props.onChangeText(text); });
  await settle();
}

type Variant = { name: string; run: () => Promise<ReactTestInstance> };
const VARIANTS: Variant[] = [
  // ── Annuaire des box ──
  { name: 'annuaire', run: () => mount(<BoxDirectoryScreen />) },
  { name: 'annuaire-une-box', run: () => { mockTables.boxes = [BOX_B]; return mount(<BoxDirectoryScreen />); } },
  { name: 'annuaire-filtre', run: async () => {
    const root = await mount(<BoxDirectoryScreen />);
    await press(root, 'box-filter-hiit');
    return root;
  } },
  { name: 'annuaire-recherche-vide', run: async () => {
    const root = await mount(<BoxDirectoryScreen />);
    await type(root, 'box-search', 'zzz');
    return root;
  } },
  // ── Détail d'une box ──
  { name: 'box-detail', run: () => { mockRouteParams = { boxId: 'b1' }; return mount(<BoxDirectoryDetailScreen />); } },
  { name: 'box-detail-minimal', run: () => { mockTables.boxes = [BOX_MIN]; mockRouteParams = { boxId: 'b3' }; return mount(<BoxDirectoryDetailScreen />); } },
  { name: 'box-detail-introuvable', run: () => { mockTables.boxes = []; mockRouteParams = { boxId: 'x' }; return mount(<BoxDirectoryDetailScreen />); } },
  // ── Carte ──
  { name: 'carte', run: () => { mockRouteParams = { boxes: [BOX_A, BOX_B] }; return mount(<BoxDirectoryMapScreen />); } },
  { name: 'carte-une-box', run: () => { mockRouteParams = { boxes: [BOX_A] }; return mount(<BoxDirectoryMapScreen />); } },
  { name: 'carte-fiche', run: async () => {
    mockRouteParams = { boxes: [BOX_A, BOX_B] };
    const root = await mount(<BoxDirectoryMapScreen />);
    await press(root, 'map-marker');
    return root;
  } },
  { name: 'carte-web', run: () => mount(<BoxDirectoryMapScreenWeb />) },
  // ── Partenaires ──
  { name: 'partenaires', run: () => mount(<PartnersScreen />) },
  { name: 'partenaires-vide', run: () => { mockTables.partners = []; return mount(<PartnersScreen />); } },
  { name: 'partenaire-detail', run: async () => {
    mockTables.partners = [PARTNER_FULL];
    mockRouteParams = { partnerId: 'px' };
    const root = await mount(<PartnerDetailScreen />);
    await press(root, 'partner-offer-code');
    return root;
  } },
  { name: 'partenaire-sans-titre-offre', run: () => {
    mockTables.partners = [{ ...PARTNER_FULL, offer_title: null, category: 'unknown', instagram_url: null }];
    mockRouteParams = { partnerId: 'px' };
    return mount(<PartnerDetailScreen />);
  } },
  { name: 'partenaire-introuvable', run: () => { mockTables.partners = []; mockRouteParams = { partnerId: 'x' }; return mount(<PartnerDetailScreen />); } },
  // ── Programmes ──
  { name: 'programmes-box', run: () => mount(<BoxProgramsScreen />) },
  { name: 'programmes-box-un', run: () => { mockTables.programs = [PROGRAMS[1]]; return mount(<BoxProgramsScreen />); } },
  { name: 'programmes-box-vide', run: () => { mockTables.programs = []; return mount(<BoxProgramsScreen />); } },
  { name: 'programmation', run: () => mount(<ProgrammationScreen />) },
];

function dataTexts(): Set<string> {
  const out = new Set<string>();
  (function walk(v: unknown) {
    if (typeof v === 'string') [v, ...v.split('\n')].forEach((l) => out.add(l.toLowerCase()));
    else if (v && typeof v === 'object') { Object.keys(v).forEach(walk); Object.values(v).forEach(walk); }
  })([mockTables, mockRouteParams, BOX_A, BOX_B, BOX_MIN, PARTNERS, PARTNER_FULL, PROGRAMS]);
  return out;
}
/** Libellés identiques dans les deux langues : termes techniques, noms propres, mots identiques. */
const SAME_IN_EN = [
  /^(Functional|Hybrid|HIIT|Yoga|MMA|Parking|Sauna|Open Gym|Nutrition|Coaching|Sports|Services|Contact|Violence|Ongoing|Instagram)$/i,
  /^Map not available on web$/,
  /^Box$/i, /^\d+ box$/, // « Box » garde son nom (glossaire)
];
const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;

describe('Explorer, français : textes identiques à master', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const current = collect(await v.run());
    if (process.env.I18N_EXPLORER_CAPTURE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      const file = process.env.I18N_EXPLORER_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(current).toEqual(before);
  });
});

describe('Explorer, anglais : aucun texte français', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  afterAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const en = collect(await v.run());
    const DATA = dataTexts();
    const fr = (BEFORE as Record<string, string[]>)[name];
    const strip = (s: string) => s.replace(/^(placeholder|a11y): /, '').replace(/^ALERTE \| /, '');
    const shown = en.filter((s) => s !== '── fenêtre ──');
    const french = shown.filter((s) => ACCENT.test(strip(s)) && !DATA.has(strip(s).toLowerCase()));
    const frSet = new Set(fr.map((s) => s.toLowerCase()));
    const unchanged = shown.filter((s) => frSet.has(s.toLowerCase()) && /\p{L}{2,}/u.test(strip(s))
      && !strip(s).split(/\n|, /).every((l) => DATA.has(l.toLowerCase())) && !strictAllowed(strip(s))
      && !SAME_IN_EN.some((re) => re.test(strip(s))));
    expect({ name, french, unchanged }).toEqual({ name, french: [], unchanged: [] });
  });
});
