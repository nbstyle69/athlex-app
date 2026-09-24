/**
 * Bandes de pastilles horizontales du classement (filtres de niveau) et du
 * formulaire de WOD du back-office (rangée des mouvements), montées avec le
 * vrai react-native — même défaut, même correction que les onglets de piste de
 * « Ma Box » (#346) : un ScrollView porte `flexShrink: 1` dans son style de
 * base, et une colonne qui déborde l'écrasait jusqu'à rogner ses pastilles.
 *
 * react-test-renderer ne calcule pas la mise en page : on vérifie, dans chaque
 * état (clair et sombre, taille de texte ×1, ×1,3, ×2 ; chaque niveau choisi
 * pour le classement), les propriétés qui la décident. Le rendu réel se
 * constate avec le protocole visuel de la PR.
 */
import React, { useEffect as mockUseEffect } from 'react';
import { PixelRatio, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';

let mockTheme = lightTheme;

// Une requête Supabase qui se chaîne et rend « aucune ligne ». Un objet fini, pas
// un Proxy : un Proxy infini fait diverger tout ce qui l'inspecte.
function mockRequete(): any {
  const requete: any = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'or', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'order', 'range', 'limit', 'filter', 'match', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete']) {
    requete[m] = () => requete;
  }
  requete.then = (ok: any, ko: any) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok, ko);
  return requete;
}

jest.mock('../lib/supabase', () => ({ supabase: { from: () => mockRequete(), rpc: () => mockRequete() } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
// Valeur STABLE : un nouveau tableau à chaque rendu relancerait sans fin les effets qui en dépendent.
jest.mock('../hooks/useFocusQuery', () => {
  const mockResultat = { data: [], isLoading: false, refetch: () => {} };
  return { useFocusQuery: () => mockResultat };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useFocusEffect: (callback: () => void) => mockUseEffect(callback, [callback]),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));
// Objets STABLES d'un rendu à l'autre, pour la même raison.
jest.mock('../context/AuthContext', () => {
  const mockAuth = {
    user: { id: 'u-local', level: 'rx' },
    currentBox: { id: 'box-local', name: 'AthleX Fitness' },
    boxRole: 'owner',
  };
  return { useAuth: () => mockAuth };
});
jest.mock('../context/ThemeContext', () => {
  const mockCache = new Map();
  return {
    useTheme: () => {
      if (!mockCache.has(mockTheme)) mockCache.set(mockTheme, { theme: mockTheme });
      return mockCache.get(mockTheme);
    },
  };
});
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('../components/InteractiveTour', () => ({ __esModule: true, default: () => null, COACH_TOUR_STEPS: [] }));
jest.mock('../services/notifications', () => ({ sendWodPublishedNotification: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ readAsStringAsync: jest.fn() }));

import i18n from '../i18n';
import LeaderboardScreen from '../screens/leaderboard/LeaderboardScreen';
import BOWODsScreen from '../screens/backoffice/BOWODsScreen';

let renderer: TestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  jest.restoreAllMocks();
});

async function monter(element: React.ReactElement, theme = lightTheme, echelle = 1) {
  mockTheme = theme;
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(echelle);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await act(async () => { renderer = TestRenderer.create(element); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return renderer!.root;
}

const plat = (i: ReactTestInstance) => StyleSheet.flatten(i.props.style) ?? {};
const texte = (n: ReactTestInstance) =>
  n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' ');

/** La bande horizontale dont une pastille porte ce libellé. */
function bande(root: ReactTestInstance, libelle: string) {
  const bandes = root.findAll((n) => n.type === ScrollView && n.props.horizontal === true)
    .filter((b) => b.findAllByType(TouchableOpacity).some((p) => texte(p) === libelle));
  expect(bandes).toHaveLength(1);
  return bandes[0];
}

/** Ce qui doit tenir dans tous les états : la bande ne se comprime pas, rien ne rogne une pastille. */
function verifier(b: ReactTestInstance, pastillesAttendues: number) {
  const s = plat(b);
  expect({ flexGrow: s.flexGrow, flexShrink: s.flexShrink }).toEqual({ flexGrow: 0, flexShrink: 0 });
  expect(s.height ?? s.maxHeight).toBeUndefined();
  const pastilles = b.findAllByType(TouchableOpacity);
  expect(pastilles.length).toBe(pastillesAttendues);
  for (const p of pastilles) {
    const c = plat(p);
    expect(c.height ?? c.maxHeight).toBeUndefined();
    expect(c.overflow).not.toBe('hidden');
    for (const t of p.findAllByType(Text)) {
      expect(t.props.allowFontScaling).not.toBe(false);
      expect(t.props.maxFontSizeMultiplier).toBeUndefined();
      expect(t.props.numberOfLines).toBeUndefined();
    }
  }
}

const NIVEAUX = ['Tous', 'SCALED', 'INTER', 'RX', 'RX+', 'ELITE', 'PRO'];

describe('classement — filtres de niveau', () => {
  it('contre-exemple : la bande est bien trouvée, avec ses pastilles dans l\'ordre', async () => {
    const root = await monter(<LeaderboardScreen />);
    const b = bande(root, 'Tous');
    expect(b.findAllByType(TouchableOpacity).map(texte)).toEqual(NIVEAUX);
  });

  for (const theme of [lightTheme, darkTheme]) {
    for (const echelle of [1, 1.3, 2]) {
      it(`${theme.mode}, texte ×${echelle}, chaque niveau choisi : la bande ne se comprime pas`, async () => {
        const root = await monter(<LeaderboardScreen />, theme, echelle);
        for (const niveau of NIVEAUX) {
          const p = bande(root, 'Tous').findAllByType(TouchableOpacity).find((x) => texte(x) === niveau)!;
          await act(async () => p.props.onPress());
          verifier(bande(root, 'Tous'), NIVEAUX.length);
        }
      });
    }
  }
});

describe('back-office, formulaire de WOD — rangée des mouvements', () => {
  async function ouvrirFormulaire(theme = lightTheme, echelle = 1) {
    const root = await monter(<BOWODsScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />, theme, echelle);
    // Semaine sans séance : chaque jour vide ouvre le formulaire de création.
    expect(root.findAllByType(Text).map((t) => [t.props.children].flat().join(''))).toContain(i18n.t('bo.wods.addWod'));
    const jourVide = root.findAll((n) => n.type === TouchableOpacity && texte(n) === i18n.t('bo.wods.addWod'))[0];
    await act(async () => jourVide!.props.onPress());
    return root;
  }

  it('contre-exemple : le formulaire s\'ouvre et la rangée porte tout le catalogue', async () => {
    const { MOVEMENT_CATALOG } = jest.requireActual('../utils/movementsCatalog');
    const root = await ouvrirFormulaire();
    const b = bande(root, MOVEMENT_CATALOG[0].name);
    expect(b.findAllByType(TouchableOpacity).map(texte)).toEqual(MOVEMENT_CATALOG.map((m: { name: string }) => m.name));
  });

  for (const theme of [lightTheme, darkTheme]) {
    for (const echelle of [1, 1.3, 2]) {
      it(`${theme.mode}, texte ×${echelle} : la rangée ne se comprime pas`, async () => {
        const { MOVEMENT_CATALOG } = jest.requireActual('../utils/movementsCatalog');
        const root = await ouvrirFormulaire(theme, echelle);
        verifier(bande(root, MOVEMENT_CATALOG[0].name), MOVEMENT_CATALOG.length);
      });
    }
  }
});
