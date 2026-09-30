/**
 * Refonte R13 : écrans ouverts depuis le bloc Explorer de l'Accueil (annuaire des boxs,
 * carte, fiche box, Programmes, programmes des boxs, partenaires, fiche partenaire).
 * Apparence seule : contenu, ordre, navigation et callbacks restent ceux de master.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Alert, Linking, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import BEFORE from './r13StructureBefore.json';
import { AxButton, AxCard, AxChip, AxIconButton, AxTag, AxTextField } from '../components/ax';
import { AxScreenHeader } from '../components/ax/AxScreenHeader';
import { axTypography } from '../theme/axTokens';
import { contrast } from '../theme/contrast';
import { WEB_URL } from '../lib/urls';
import BoxDirectoryScreen from '../screens/explorer/BoxDirectoryScreen';
import BoxDirectoryMapScreen from '../screens/explorer/BoxDirectoryMapScreen';
import BoxDirectoryDetailScreen from '../screens/explorer/BoxDirectoryDetailScreen';
import ProgrammationScreen from '../screens/explorer/ProgrammationScreen';
import BoxProgramsScreen from '../screens/explorer/BoxProgramsScreen';
import PartnersScreen from '../screens/explorer/PartnersScreen';
import PartnerDetailScreen from '../screens/explorer/PartnerDetailScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockTheme = lightTheme;
let mockParams: Record<string, unknown> | undefined;
const mockTables: Record<string, unknown[]> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: View,
  };
});
jest.mock('react-native-maps', () => {
  const R = jest.requireActual('react');
  const { View, Pressable } = jest.requireActual('react-native');
  const MapView = R.forwardRef((p: { children?: unknown }, _ref: unknown) => R.createElement(View, { testID: 'map-view' }, p.children));
  const Marker = (p: { children?: unknown; onPress?: () => void; identifier?: string }) =>
    R.createElement(Pressable, { testID: 'map-marker', onPress: p.onPress }, p.children);
  return { __esModule: true, default: MapView, Marker, Callout: View };
});
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    let single = false;
    let head = false;
    for (const m of ['select', 'eq', 'order', 'limit', 'in', 'single']) {
      b[m] = (...args: unknown[]) => {
        mockCalls.push({ table, method: m, args });
        if (m === 'single') single = true;
        if (m === 'select' && (args[1] as { head?: boolean } | undefined)?.head) head = true;
        return b;
      };
    }
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
      const rows = mockTables[table] ?? [];
      const v = head
        ? { data: null, count: rows.length, error: null }
        : single
          ? rows.length ? { data: rows[0], error: null } : { data: null, error: { message: 'introuvable' } }
          : { data: rows, error: null };
      return Promise.resolve(v).then(res, rej);
    };
    return b;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const LONG = 'Une box au nom particulièrement long pour vérifier qu’aucun texte ne déborde à 390 px';

const BOXES = [
  {
    id: 'b1', owner_id: 'o', name: 'CrossFit Lumière', tagline: 'La box du centre-ville', city: 'Lyon',
    sport_type: ['crossfit', 'hyrox'], logo_url: null, latitude: 45.76, longitude: 4.83, is_active: true, created_at: '',
  },
  {
    id: 'b2', owner_id: 'o', name: LONG, tagline: LONG, city: 'Saint-Rémy-de-Provence-sur-Durance',
    sport_type: ['weightlifting', 'gymnastics', 'yoga', 'boxing'], logo_url: null, latitude: 43.79, longitude: 4.83,
    is_active: true, created_at: '',
  },
  { id: 'b3', owner_id: 'o', name: 'Box Sans Ville', is_active: true, created_at: '' },
];
const MEMBERS = [{ box_id: 'b1' }, { box_id: 'b1' }, { box_id: 'b2' }];
const BOX_FULL = {
  id: 'b1', owner_id: 'o', name: 'CrossFit Lumière', tagline: 'La box du centre-ville', city: 'Lyon',
  description: 'Une box familiale, ouverte à tous les niveaux.', address: '12 rue des Lilas',
  google_maps_url: 'https://maps.example/b1', phone: '0102030405', contact_email: 'contact@lumiere.test',
  website_url: 'https://lumiere.test', instagram_url: 'https://instagram.com/lumiere', founded_at: '2018-03-01',
  sport_type: ['crossfit', 'hyrox'], services: ['parking', 'showers', 'openGym'],
  opening_hours: { lundi: '6h – 21h', samedi: '9h – 13h' }, is_active: true, created_at: '',
};
const PROGRAMS = [
  { id: 'p1', title: 'Force & Condition', description: 'Huit semaines de force.', type: 'fixed', duration_weeks: 8, days_per_week: 4, box_id: 'b1', boxes: { name: 'CrossFit Lumière', logo_url: null, city: 'Lyon', slug: 'lumiere' } },
  { id: 'p2', title: LONG, description: LONG, type: 'ongoing', duration_weeks: null, days_per_week: 5, box_id: 'b1', boxes: { name: 'CrossFit Lumière', logo_url: null, city: 'Lyon', slug: 'lumiere' } },
  { id: 'p3', title: 'Engine', description: null, type: 'fixed', duration_weeks: 6, days_per_week: 3, box_id: 'b2', boxes: { name: LONG, logo_url: null, city: null, slug: null } },
];
const PARTNERS = [
  { id: 'pa1', name: 'NutriFuel', category: 'nutrition', offer_title: '-15 % sur la boutique', description: 'Repas', is_active: true, sort_order: 1, created_at: '' },
  { id: 'pa2', name: LONG, category: 'equipment', offer_title: null, description: LONG, is_active: true, sort_order: 2, created_at: '' },
  { id: 'pa3', name: 'Récup+', category: 'recovery', is_active: true, sort_order: 3, created_at: '' },
];
const PARTNER_FULL = {
  id: 'pa1', name: 'NutriFuel', category: 'nutrition', description: 'Des repas pensés pour les athlètes.',
  offer_title: '-15 % sur la boutique', offer_description: 'Valable sur toute la boutique en ligne.', offer_code: 'ATHLEX15',
  website_url: 'https://nutrifuel.test', instagram_url: 'https://instagram.com/nutrifuel', is_active: true, sort_order: 1, created_at: '',
};

let renderer: TestRenderer.ReactTestRenderer | null = null;
beforeEach(() => {
  mockParams = undefined;
  mockTables.boxes = BOXES;
  mockTables.box_members = MEMBERS;
  mockTables.programs = PROGRAMS;
  mockTables.partners = PARTNERS;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  jest.clearAllMocks();
  mockCalls.length = 0;
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
function textsOf(n: ReactTestInstance, out: string[]) {
  if (isHostText(n)) {
    const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
    out.push(upper ? hostText(n).toUpperCase() : hostText(n));
    return;
  }
  n.children.forEach((ch) => { if (typeof ch !== 'string') textsOf(ch, out); });
}
/** Suite ordonnée des textes visibles de l'écran. */
function structure(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance) => {
    if (n.type === Modal) return;
    if (isHostText(n)) { textsOf(n, out); return; }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch); });
  };
  walk(root);
  return out.filter((t) => t.trim().length > 0);
}
const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
};
async function mount(el: React.ReactElement, theme = lightTheme, params?: Record<string, unknown>) {
  mockTheme = theme;
  mockParams = params;
  await act(async () => { renderer = TestRenderer.create(el); });
  await settle();
  return renderer!.root;
}
const textNode = (root: ReactTestInstance, text: string) =>
  root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
function pressable(n: ReactTestInstance | null): ReactTestInstance {
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error('rien d’appuyable');
  return n;
}
async function pressText(root: ReactTestInstance, text: string) {
  const target = pressable(textNode(root, text));
  await act(async () => { target.props.onPress(); });
  await settle();
}
async function typeIn(root: ReactTestInstance, placeholder: string, value: string) {
  const input = root.findAll((n) => String(n.type) === 'TextInput' && n.props.placeholder === placeholder)[0];
  await act(async () => { input.props.onChangeText(value); });
}
const SEARCH = 'Rechercher une box ou une ville...';

type Variant = { name: string; run: (th?: typeof lightTheme) => Promise<ReactTestInstance> };
const VARIANTS: Variant[] = [
  { name: 'annuaire', run: (th) => mount(<BoxDirectoryScreen />, th) },
  { name: 'annuaire-filtre', run: async (th) => {
    const root = await mount(<BoxDirectoryScreen />, th);
    await pressText(root, 'Hybrid');
    return root;
  } },
  { name: 'annuaire-recherche-vide', run: async (th) => {
    const root = await mount(<BoxDirectoryScreen />, th);
    await typeIn(root, SEARCH, 'zzz');
    return root;
  } },
  { name: 'annuaire-vide', run: (th) => { mockTables.boxes = []; return mount(<BoxDirectoryScreen />, th); } },
  { name: 'carte', run: (th) => mount(<BoxDirectoryMapScreen />, th, { boxes: [{ ...BOXES[0], member_count: 2 }, { ...BOXES[1], member_count: 1 }] }) },
  { name: 'carte-fiche', run: async (th) => {
    const root = await mount(<BoxDirectoryMapScreen />, th, { boxes: [{ ...BOXES[0], member_count: 2 }, { ...BOXES[1], member_count: 1 }] });
    const marker = root.findAll((n) => n.props.testID === 'map-marker' && typeof n.props.onPress === 'function')[1];
    await act(async () => { marker.props.onPress(); });
    return root;
  } },
  { name: 'fiche-box', run: (th) => { mockTables.boxes = [BOX_FULL]; return mount(<BoxDirectoryDetailScreen />, th, { boxId: 'b1' }); } },
  { name: 'fiche-box-minimale', run: (th) => {
    mockTables.boxes = [{ id: 'b3', owner_id: 'o', name: 'Box Sans Ville', is_active: true, created_at: '' }];
    mockTables.box_members = [];
    return mount(<BoxDirectoryDetailScreen />, th, { boxId: 'b3' });
  } },
  { name: 'fiche-box-introuvable', run: (th) => { mockTables.boxes = []; return mount(<BoxDirectoryDetailScreen />, th, { boxId: 'x' }); } },
  { name: 'programmation', run: (th) => mount(<ProgrammationScreen />, th) },
  { name: 'programmes-des-boxs', run: (th) => mount(<BoxProgramsScreen />, th) },
  { name: 'programmes-des-boxs-vide', run: (th) => { mockTables.programs = []; return mount(<BoxProgramsScreen />, th); } },
  { name: 'partenaires', run: (th) => mount(<PartnersScreen />, th) },
  { name: 'partenaires-vide', run: (th) => { mockTables.partners = []; return mount(<PartnersScreen />, th); } },
  { name: 'fiche-partenaire', run: (th) => { mockTables.partners = [PARTNER_FULL]; return mount(<PartnerDetailScreen />, th, { partnerId: 'pa1' }); } },
  { name: 'fiche-partenaire-minimale', run: (th) => {
    mockTables.partners = [{ id: 'pa3', name: 'Récup+', category: 'recovery', is_active: true, sort_order: 3, created_at: '' }];
    return mount(<PartnerDetailScreen />, th, { partnerId: 'pa3' });
  } },
  { name: 'fiche-partenaire-introuvable', run: (th) => { mockTables.partners = []; return mount(<PartnerDetailScreen />, th, { partnerId: 'x' }); } },
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
/** Flèche de fin de ligne en texte, devenue une icône Lucide (ChevronRight). */
const ARROW_GLYPH = /→/g;
/** Casse mise à part : les surtitres et étiquettes passent en capitales. */
const normalize = (xs: string[]) => xs.map((x) => x.replace(EMOJI, '').replace(ARROW_GLYPH, '').trim().toUpperCase()).filter((x) => x.length > 0);

describe('R13 : ordre des blocs et libellés inchangés (instantané pris sur master)', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const root = await v.run();
    const current = structure(root);
    if (process.env.R13_CAPTURE) {
      const file = process.env.R13_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(normalize(current)).toEqual(normalize(before));
  });
});

const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const byID = (root: ReactTestInstance, id: string) => root.find((n) => n.props.testID === id && typeof n.type !== 'string');
const texts = (root: ReactTestInstance, text: string) => root.findAll((n) => isHostText(n) && hostText(n) === text);
const inside = (n: ReactTestInstance, type: unknown) => {
  for (let p: ReactTestInstance | null = n.parent; p; p = p.parent) if (p.type === type) return p;
  return null;
};
async function press(n: ReactTestInstance) {
  await act(async () => { pressable(n).props.onPress(); });
  await settle();
}
const MAP_PARAMS = { boxes: [{ ...BOXES[0], member_count: 2 }, { ...BOXES[1], member_count: 1 }] };
async function openMapSheet(th = lightTheme) {
  const root = await mount(<BoxDirectoryMapScreen />, th, MAP_PARAMS);
  const marker = root.findAll((n) => n.props.testID === 'map-marker' && typeof n.props.onPress === 'function')[1];
  await act(async () => { marker.props.onPress(); });
  return root;
}

describe('R13 : navigation et callbacks inchangés', () => {
  let openURL: jest.SpyInstance;
  beforeEach(() => { openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true); });
  afterEach(() => openURL.mockRestore());

  it('annuaire : même requête, carte → fiche box, bouton carte → boxs géolocalisées', async () => {
    const root = await mount(<BoxDirectoryScreen />);
    expect(mockCalls.filter((c) => c.method === 'select').map((c) => c.table)).toEqual(expect.arrayContaining(['boxes', 'box_members']));
    await press(byID(root, 'box-card-b1'));
    expect(mockNavigate).toHaveBeenLastCalledWith('BoxDirectoryDetail', { boxId: 'b1' });
    await press(byID(root, 'header-map'));
    const [route, params] = mockNavigate.mock.calls[mockNavigate.mock.calls.length - 1];
    expect(route).toBe('BoxDirectoryMap');
    expect((params as { boxes: Array<{ id: string }> }).boxes.map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('annuaire : filtre de sport bascule, recherche puis effacement', async () => {
    const root = await mount(<BoxDirectoryScreen />);
    await press(byID(root, 'box-filter-hyrox'));
    expect(byID(root, 'box-filter-hyrox').props.selected).toBe(true);
    expect(root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('box-card-') && n.type === AxCard)).toHaveLength(1);
    await press(byID(root, 'box-filter-hyrox'));
    expect(byID(root, 'box-filter-hyrox').props.selected).toBe(false);
    await typeIn(root, SEARCH, 'lyon');
    expect(root.findAll((n) => n.type === AxCard)).toHaveLength(1);
    await press(byID(root, 'box-search-clear'));
    expect(root.findByType(AxTextField).props.value).toBe('');
    expect(root.findAll((n) => n.type === AxCard)).toHaveLength(3);
  });

  it('carte : retour, fiche → détail (et fermeture), bouton Fermer', async () => {
    let root = await openMapSheet();
    await press(byID(root, 'map-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    await press(byID(root, 'map-sheet-card'));
    expect(mockNavigate).toHaveBeenLastCalledWith('BoxDirectoryDetail', { boxId: 'b2' });
    expect(root.findAll((n) => n.props.testID === 'map-sheet-card')).toHaveLength(0);
    await act(async () => renderer!.unmount());
    root = await openMapSheet();
    await press(byID(root, 'map-sheet-close'));
    expect(root.findAll((n) => n.props.testID === 'map-sheet-card')).toHaveLength(0);
  });

  it('fiche box : adresse, téléphone, e-mail, site et Instagram ouvrent les mêmes liens', async () => {
    mockTables.boxes = [BOX_FULL];
    const root = await mount(<BoxDirectoryDetailScreen />, lightTheme, { boxId: 'b1' });
    for (const label of ['12 rue des Lilas, Lyon', '0102030405', 'contact@lumiere.test', 'https://lumiere.test', 'Instagram']) {
      await press(texts(root, label)[0]);
    }
    expect(openURL.mock.calls.map((c) => c[0])).toEqual([
      'https://maps.example/b1', 'tel:0102030405', 'mailto:contact@lumiere.test', 'https://lumiere.test', 'https://instagram.com/lumiere',
    ]);
  });

  it('Programmes → programmes des boxs', async () => {
    const root = await mount(<ProgrammationScreen />);
    await press(byID(root, 'programmation-box-programs'));
    expect(mockNavigate).toHaveBeenLastCalledWith('BoxPrograms');
  });

  it('programmes des boxs : en-tête de box et programme ouvrent la page publique ; sans slug, rien', async () => {
    const root = await mount(<BoxProgramsScreen />);
    await press(byID(root, 'box-programs-section-b1'));
    await press(byID(root, 'program-card-p1'));
    await press(byID(root, 'box-programs-section-b2'));
    await press(byID(root, 'program-card-p3'));
    expect(openURL.mock.calls.map((c) => c[0])).toEqual([`${WEB_URL}/box/lumiere`, `${WEB_URL}/box/lumiere`]);
  });

  it('partenaires : carte → fiche partenaire', async () => {
    const root = await mount(<PartnersScreen />);
    await press(byID(root, 'partner-card-pa2'));
    expect(mockNavigate).toHaveBeenLastCalledWith('PartnerDetail', { partnerId: 'pa2' });
  });

  it('fiche partenaire : copie du code (même alerte), site et Instagram', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockTables.partners = [PARTNER_FULL];
    const root = await mount(<PartnerDetailScreen />, lightTheme, { partnerId: 'pa1' });
    await press(byID(root, 'partner-offer-code'));
    expect(alert).toHaveBeenCalledWith('Code copié !', 'Le code "ATHLEX15" a été copié dans le presse-papier.');
    await press(byID(root, 'partner-link-website'));
    await press(byID(root, 'partner-link-instagram'));
    expect(openURL.mock.calls.map((c) => c[0])).toEqual(['https://nutrifuel.test', 'https://instagram.com/nutrifuel']);
    alert.mockRestore();
  });
});

describe('R13 : couleurs et typographies clés, dans les deux thèmes', () => {
  const TITLE_M = { fontFamily: axTypography.titleM.fontFamily, fontSize: axTypography.titleM.fontSize };
  const BODY_SMALL = { fontFamily: axTypography.bodySmall.fontFamily, fontSize: axTypography.bodySmall.fontSize };
  for (const [mode, th] of [['clair', lightTheme], ['sombre', darkTheme]] as const) {
    const c = th.ax;
    it(`${mode} — encres lisibles (AA) sur fond et surface`, () => {
      for (const ink of [c.text, c.textMuted, c.accentText]) {
        expect(contrast(ink, c.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(ink, c.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(ink, c.field)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${mode} — annuaire`, async () => {
      const root = await mount(<BoxDirectoryScreen />, th);
      expect(root.findAllByType(AxScreenHeader)).toHaveLength(1);
      expect(root.findByType(AxTextField).props.placeholder).toBe(SEARCH);
      expect(root.findAllByType(AxChip).map((ch) => ch.props.label)).toEqual(['Boxe', 'Functional', 'Gymnastique', 'Hybrid', 'Haltérophilie', 'Yoga']);
      expect(byID(root, 'box-card-b1').type).toBe(AxCard);
      expect(flat(texts(root, 'CrossFit Lumière')[0])).toMatchObject({ ...TITLE_M, color: c.text });
      for (const t of ['La box du centre-ville', 'Lyon', '2 membres']) expect(flat(texts(root, t)[0])).toMatchObject({ ...BODY_SMALL, color: c.textMuted });
      expect(inside(texts(root, 'Hybrid').find((n) => inside(n, AxTag))!, AxTag)!.props.tone).toBe('muted');
      expect(flat(texts(root, '3 boxs référencées')[0])).toMatchObject({ ...BODY_SMALL, color: c.textMuted });
    });

    it(`${mode} — carte : fiche featured, contrôles au nouveau design`, async () => {
      const root = await openMapSheet(th);
      expect(byID(root, 'map-back').type).toBe(AxIconButton);
      expect(flat(texts(root, 'Carte des Boxs')[0])).toMatchObject({ ...TITLE_M, color: c.text });
      expect(flat(texts(root, '2 boxs')[0])).toMatchObject({ ...BODY_SMALL, color: c.textMuted });
      const sheet = byID(root, 'map-sheet-card');
      expect(sheet.type).toBe(AxCard);
      expect(sheet.props.variant).toBe('featured');
      expect(flat(sheet.findAll((n) => isHostText(n) && hostText(n) === LONG)[0])).toMatchObject({ ...TITLE_M, color: c.text });
      expect(flat(texts(root, '1 membres')[0])).toMatchObject({ ...BODY_SMALL, color: c.textMuted });
      expect(flat(texts(root, 'Fermer')[0])).toMatchObject({ fontFamily: axTypography.labelSmall.fontFamily, color: c.textMuted });
    });

    it(`${mode} — fiche box`, async () => {
      mockTables.boxes = [BOX_FULL];
      const root = await mount(<BoxDirectoryDetailScreen />, th, { boxId: 'b1' });
      const card = byID(root, 'box-detail-card');
      expect(card.type).toBe(AxCard);
      expect(card.props.variant).toBe('featured');
      expect(inside(texts(root, 'CrossFit Lumière').find((n) => inside(n, AxCard))!, AxCard)).toBe(card);
      expect(flat(texts(root, 'CrossFit Lumière').find((n) => inside(n, AxCard))!)).toMatchObject({ fontFamily: axTypography.titleL.fontFamily, color: c.text });
      expect(flat(texts(root, 'La box du centre-ville')[0])).toMatchObject({ ...BODY_SMALL, color: c.textMuted });
      expect(flat(texts(root, 'Contact')[0])).toMatchObject({ ...axTypography.overline, color: c.textMuted });
      expect(root.findAllByType(AxTag).map((t) => [t.props.label, t.props.tone ?? 'accent'])).toEqual([
        ['Functional', 'accent'], ['Hybrid', 'accent'], ['Parking', 'muted'], ['Douches', 'muted'], ['Open Gym', 'muted'],
      ]);
      expect(byID(root, 'box-detail-hours').type).toBe(AxCard);
      expect(root.findAllByType(AxButton)).toHaveLength(0);
    });

    it(`${mode} — Programmes et programmes des boxs`, async () => {
      let root = await mount(<ProgrammationScreen />, th);
      expect(byID(root, 'programmation-box-programs').type).toBe(AxCard);
      expect(byID(root, 'programmation-box-programs').props.variant ?? 'standard').toBe('standard');
      expect(flat(texts(root, 'Programmes des Boxs')[0])).toMatchObject({ ...TITLE_M, color: c.text });
      expect(flat(texts(root, 'Découvre les programmations proposées par les boxs')[0])).toMatchObject({ ...BODY_SMALL, color: c.textMuted });
      await act(async () => renderer!.unmount());
      root = await mount(<BoxProgramsScreen />, th);
      expect(byID(root, 'program-card-p1').type).toBe(AxCard);
      expect(flat(texts(root, 'Force & Condition')[0])).toMatchObject({ ...TITLE_M, color: c.text });
      for (const t of ['Huit semaines de force.', '4 jours/semaine', 'Lyon']) expect(flat(texts(root, t)[0])).toMatchObject({ ...BODY_SMALL, color: c.textMuted });
      expect(root.findAllByType(AxTag).map((t) => [t.props.label, t.props.tone])).toEqual([
        ['8 sem.', 'accent'], ['Ongoing', 'muted'], ['6 sem.', 'accent'],
      ]);
    });

    it(`${mode} — partenaires et fiche partenaire (action accent unique)`, async () => {
      let root = await mount(<PartnersScreen />, th);
      expect(byID(root, 'partner-card-pa1').type).toBe(AxCard);
      expect(flat(texts(root, 'NutriFuel')[0])).toMatchObject({ ...TITLE_M, color: c.text });
      expect(flat(texts(root, '-15 % sur la boutique')[0])).toMatchObject({ ...BODY_SMALL, color: c.accentText });
      expect(flat(texts(root, LONG)[1])).toMatchObject({ ...BODY_SMALL, color: c.textMuted });
      expect(flat(texts(root, 'Nutrition')[0])).toMatchObject({ ...axTypography.overline, color: c.textMuted });
      await act(async () => renderer!.unmount());
      mockTables.partners = [PARTNER_FULL];
      root = await mount(<PartnerDetailScreen />, th, { partnerId: 'pa1' });
      expect(byID(root, 'partner-offer').props.variant).toBe('featured');
      const buttons = root.findAllByType(AxButton);
      expect(buttons.map((b) => [b.props.label, b.props.variant ?? 'accent'])).toEqual([['ATHLEX15', 'accent']]);
      expect(root.findAllByType(AxTag).map((t) => t.props.label)).toEqual(['Nutrition']);
      expect(byID(root, 'partner-link-website').type).toBe(AxCard);
      expect(flat(texts(root, 'Valable sur toute la boutique en ligne.')[0])).toMatchObject({ ...BODY_SMALL, color: c.textMuted });
    });
  }
});

describe('R13 : textes longs sans débordement (390 px)', () => {
  /** Jusqu'à la colonne `flex: 1, minWidth: 0` de la carte, chaque rangée laisse rétrécir le texte. */
  const shrinks = (n: ReactTestInstance) => {
    let cur = n;
    for (let p: ReactTestInstance | null = n.parent; p; p = p.parent) {
      if (typeof p.type !== 'string') continue;
      const st = flat(p);
      if (st.flexDirection === 'row') {
        const c = flat(cur);
        if (!((c.flexShrink ?? 0) >= 1 || (c.flex === 1 && c.minWidth === 0))) return false;
      }
      if (st.flex === 1 && st.minWidth === 0) return true;
      cur = p;
    }
    return false;
  };
  it('annuaire : nom, accroche et ville sur une ligne, colonne rétrécissable', async () => {
    const root = await mount(<BoxDirectoryScreen />);
    const card = byID(root, 'box-card-b2');
    for (const t of [LONG, 'Saint-Rémy-de-Provence-sur-Durance']) {
      for (const n of card.findAll((x) => isHostText(x) && hostText(x) === t)) {
        expect(n.props.numberOfLines).toBe(1);
        expect(shrinks(n)).toBe(true);
      }
    }
    expect(flat(card.findAllByType(AxTag)[0].parent!).flexWrap).toBe('wrap');
  });
  it('carte : nom sur deux lignes au plus, ville sur une', async () => {
    const root = await openMapSheet();
    const sheet = byID(root, 'map-sheet-card');
    const name = sheet.findAll((x) => isHostText(x) && hostText(x) === LONG)[0];
    expect(name.props.numberOfLines).toBe(2);
    expect(shrinks(name)).toBe(true);
    expect(sheet.findAll((x) => isHostText(x) && hostText(x) === 'Saint-Rémy-de-Provence-sur-Durance')[0].props.numberOfLines).toBe(1);
  });
  it('programmes des boxs : titre long tronqué à côté de son étiquette, nom de box sur une ligne', async () => {
    const root = await mount(<BoxProgramsScreen />);
    const title = byID(root, 'program-card-p2').findAll((x) => isHostText(x) && hostText(x) === LONG)[0];
    expect(title.props.numberOfLines).toBe(1);
    expect(flat(title)).toMatchObject({ flex: 1, minWidth: 0 });
    const section = byID(root, 'box-programs-section-b2').findAll((x) => isHostText(x) && hostText(x) === LONG)[0];
    expect(section.props.numberOfLines).toBe(1);
    expect(shrinks(section)).toBe(true);
  });
  it('partenaires : nom et description sur une ligne, colonne rétrécissable', async () => {
    const root = await mount(<PartnersScreen />);
    for (const n of byID(root, 'partner-card-pa2').findAll((x) => isHostText(x) && hostText(x) === LONG)) {
      expect(n.props.numberOfLines).toBe(1);
      expect(shrinks(n)).toBe(true);
    }
  });
});
