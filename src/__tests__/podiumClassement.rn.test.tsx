/**
 * Classement général : le nom de chaque marche du podium tient entièrement dans sa case.
 * Les cases avaient une hauteur fixe (56 / 76 / 44) plus petite que leur contenu (médaille,
 * nom, ELO, marges, environ 62 px) : le nom du 3e était écrasé, coupé en bas de sa case.
 * Jest n'a pas de moteur de mise en page : la position de chaque texte est calculée depuis
 * les styles rendus (empilement depuis le bas, justifyContent flex-end) et la hauteur de
 * ligne native du fichier Inter embarqué. Mesure réelle dans le navigateur : banc local de la PR.
 */
import React from 'react';
import path from 'path';
import { StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lightTheme, darkTheme } from '../theme/palette';
import '../i18n';
import LeaderboardScreen from '../screens/leaderboard/LeaderboardScreen';
import { lirePolice } from './policeTtf';

let mockTheme = lightTheme;
let mockProfiles: Record<string, unknown>[] = [];

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), canGoBack: () => true }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 0, useTabBarFootprint: () => 0 }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' }, currentBox: null }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'or', 'order', 'limit', 'range', 'not', 'is']) b[m] = () => b;
    const rows = table === 'profiles' ? mockProfiles : [];
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(res, rej);
    return b;
  };
  return { supabase: { from: (t: string) => builder(t), channel: () => ({}), removeChannel: jest.fn() } };
});

// Hauteur de ligne native d'Inter (police par défaut de l'app, App.tsx) : (ascendante − descendante + interligne) / em.
const INTER = lirePolice(path.join(process.cwd(), 'node_modules', '@expo-google-fonts', 'inter', '400Regular', 'Inter_400Regular.ttf'));
const LIGNE = (INTER.hhea.ascender - INTER.hhea.descender + INTER.hhea.lineGap) / INTER.unitsPerEm;

const NOMS = {
  courts: ['Lea', 'Sam', 'Karim'],
  longs: ['athlete_au_pseudo_particulierement_long', 'Maximilien-Alexandre', 'Karim_Benali_du_CrossFit_Lyon'],
};
const profils = (noms: string[]) => noms.map((username, i) => ({
  id: `u${i}`, username, level: 'rx', elo: 1500 - 300 * i, wins: 0, total_matches: 0, avatar_url: null,
}));

let renderer: TestRenderer.ReactTestRenderer | undefined;
afterEach(() => { if (renderer) { const r = renderer; act(() => r.unmount()); renderer = undefined; } });

async function monter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await act(async () => { renderer = TestRenderer.create(<QueryClientProvider client={client}><LeaderboardScreen /></QueryClientProvider>); });
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return renderer!.root;
}

const flat = (n: ReactTestInstance) => (StyleSheet.flatten(n.props.style) ?? {}) as Record<string, number | string | undefined>;
const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : d);

/** Case d'une marche et position verticale de chacun de ses textes, depuis le haut de la case. */
function placer(root: ReactTestInstance, idx: number) {
  const marche = root.findAll((n) => typeof n.type === 'string' && n.props.testID === `podium-step-${idx}`)[0];
  const st = flat(marche);
  const bord = num(st.borderWidth);
  const padH = num(st.paddingTop, num(st.paddingVertical, num(st.padding)));
  const padB = num(st.paddingBottom, num(st.paddingVertical, num(st.padding)));
  const textes = marche.findAll((n) => String(n.type) === 'Text');
  const lignes = textes.map((t) => { const s = flat(t); return { t, marge: num(s.marginTop), h: num(s.lineHeight, Math.ceil(num(s.fontSize, 14) * LIGNE)) }; });
  const contenu = lignes.reduce((a, l) => a + l.marge + l.h, 0);
  const hauteur = st.height !== undefined ? num(st.height) : 2 * bord + padH + padB + contenu;
  // justifyContent flex-end : les textes s'empilent depuis le bas intérieur de la case.
  let bas = hauteur - bord - padB;
  const pos = new Map<ReactTestInstance, { haut: number; bas: number }>();
  for (const l of [...lignes].reverse()) { pos.set(l.t, { haut: bas - l.h, bas }); bas -= l.h + l.marge; }
  const nom = root.findAll((n) => String(n.type) === 'Text' && n.props.testID === `podium-name-${idx}`)[0];
  return { hauteur, interieur: { haut: bord + padH, bas: hauteur - bord - padB }, premier: Math.min(...[...pos.values()].map((p) => p.haut)), nom: pos.get(nom)!, nomProps: nom.props };
}

describe('podium du classement général : le nom tient dans sa case', () => {
  it.each([
    ['clair', 'courts'], ['clair', 'longs'], ['sombre', 'courts'], ['sombre', 'longs'],
  ] as const)('thème %s, noms %s', async (theme, noms) => {
    mockTheme = theme === 'clair' ? lightTheme : darkTheme;
    mockProfiles = profils(NOMS[noms]);
    const root = await monter();
    // Ordre d'affichage : 2e, 1er, 3e.
    const [deux, un, trois] = [0, 1, 2].map((i) => placer(root, i));
    for (const m of [deux, un, trois]) {
      // Une ligne, tronquée par « … » si trop longue.
      expect(m.nomProps.numberOfLines).toBe(1);
      expect(m.nomProps.ellipsizeMode).toBe('tail');
      // Le nom entier entre le haut et le bas intérieurs de sa case, et rien n'est écrasé au-dessus.
      expect(m.nom.haut).toBeGreaterThanOrEqual(m.interieur.haut);
      expect(m.nom.bas).toBeLessThanOrEqual(m.interieur.bas);
      expect(m.premier).toBeGreaterThanOrEqual(m.interieur.haut);
    }
    // La forme du podium est gardée : 1er plus haut que 2e, plus haut que 3e.
    expect(un.hauteur).toBeGreaterThan(deux.hauteur);
    expect(deux.hauteur).toBeGreaterThan(trois.hauteur);
    expect(root.findAll((n) => String(n.type) === 'Text' && n.props.testID?.startsWith('podium-name-')).map((n) => n.props.children))
      .toEqual([NOMS[noms][1], NOMS[noms][0], NOMS[noms][2]]);
  });
});
