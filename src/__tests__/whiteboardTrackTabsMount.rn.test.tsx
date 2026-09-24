/**
 * Barre d'onglets de piste de « Ma Box », montée avec le vrai react-native.
 *
 * Défauts constatés sur la 1.0.57 (iPhone) :
 *   1. texte rogné en bas, d'autant plus que la piste choisie montre de contenu
 *      (« Tout » le plus) : le ScrollView de la barre gardait le `flexShrink: 1`
 *      de son style de base, et la colonne à hauteur fixe de l'écran l'écrasait ;
 *   2. l'onglet choisi s'élargissait (graisse 800) et décalait les autres.
 *
 * react-test-renderer ne calcule pas la mise en page (pas de Yoga) : on vérifie
 * ici, dans CHAQUE état (chaque onglet choisi, aucun, clair et sombre, taille de
 * texte 1 / 1,3 / 2), les propriétés qui décident de la mise en page — et le
 * protocole visuel de la PR la constate sur l'iPhone.
 */
import React from 'react';
import { PixelRatio, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import WhiteboardTrackTabs from '../components/WhiteboardTrackTabs';
import { lightTheme, darkTheme } from '../theme/palette';
import { visibleTabs, TrackTab } from '../utils/whiteboardTracks';

const TABS = visibleTabs(['functional', 'hybrid', 'musculation']);
let renderer: TestRenderer.ReactTestRenderer | null = null;

afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  jest.restoreAllMocks();
});

async function monter(value: TrackTab | null, theme = lightTheme, echelle = 1) {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(echelle);
  await act(async () => {
    renderer = TestRenderer.create(
      <WhiteboardTrackTabs tabs={TABS} value={value} onChange={() => {}} theme={theme} />,
    );
  });
  return renderer!.root;
}

const plat = (i: ReactTestInstance) => StyleSheet.flatten(i.props.style) ?? {};
const onglet = (root: ReactTestInstance, tab: TrackTab) =>
  root.findAll((n) => n.type === TouchableOpacity && n.props.testID === `whiteboard-track-${tab}`)[0];
const textes = (n: ReactTestInstance) => n.findAllByType(Text);

/** Ce qui décide de la taille d'un onglet : sa boîte (hors couleurs) et son libellé réservé. */
function empreinteDeTaille(root: ReactTestInstance, tab: TrackTab) {
  const o = onglet(root, tab);
  const { backgroundColor, borderColor, ...boite } = plat(o);
  const reserve = textes(o).find((t) => t.props.testID === `whiteboard-track-${tab}-reserve`)!;
  const { color, ...police } = plat(reserve);
  return JSON.stringify({ boite, police, libelle: reserve.props.children });
}

it('les onglets sont bien lus (contre-exemple) : ordre et libellés inchangés', async () => {
  expect(TABS).toEqual(['functional', 'hybrid', 'musculation', 'all']);
  const root = await monter('all');
  const lus = TABS.map((tab) => textes(onglet(root, tab)).map((t) => t.props.children));
  expect(lus).toEqual(TABS.map((tab) => [i18n.t(`whiteboard.track.${tab}`), i18n.t(`whiteboard.track.${tab}`)]));
});

for (const theme of [lightTheme, darkTheme]) {
  for (const echelle of [1, 1.3, 2]) {
    for (const value of [...TABS, null] as (TrackTab | null)[]) {
      it(`${theme.mode}, texte ×${echelle}, « ${value ?? 'aucun'} » choisi : la barre ne se comprime pas, rien ne rogne le texte`, async () => {
        const root = await monter(value, theme, echelle);

        const barre = root.findAll((n) => n.type === ScrollView && n.props.testID === 'whiteboard-track-tabs')[0];
        const b = plat(barre);
        expect({ flexGrow: b.flexGrow, flexShrink: b.flexShrink }).toEqual({ flexGrow: 0, flexShrink: 0 });
        expect(b.height ?? b.maxHeight).toBeUndefined();

        for (const tab of TABS) {
          const o = onglet(root, tab);
          const c = plat(o);
          // Une hauteur MINIMALE, jamais fixe : l'onglet grandit avec la taille de texte.
          expect(c.minHeight).toBe(44);
          expect(c.height ?? c.maxHeight).toBeUndefined();
          expect(c.overflow).not.toBe('hidden');

          const [reserve, libelle] = textes(o);
          // La réserve : toujours en gras, invisible, masquée aux lecteurs d'écran.
          expect(plat(reserve)).toMatchObject({ fontWeight: '800', opacity: 0 });
          expect(reserve.props.accessibilityElementsHidden).toBe(true);
          // Le libellé visible, posé dessus ; gras seulement s'il est choisi.
          expect(plat(libelle)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center' });
          expect(plat(libelle).fontWeight).toBe(tab === value ? '800' : '600');
          // La taille de texte du téléphone s'applique : ni plafond, ni désactivation.
          for (const t of [reserve, libelle]) {
            expect(t.props.allowFontScaling).not.toBe(false);
            expect(t.props.maxFontSizeMultiplier).toBeUndefined();
            expect(t.props.numberOfLines).toBeUndefined();
          }
          expect(o.props.accessibilityLabel).toBe(i18n.t(`whiteboard.track.${tab}`));
          expect(o.props.accessibilityState).toEqual({ selected: tab === value });
        }
      });
    }
  }
}

it('largeur et hauteur stables : ce qui dimensionne chaque onglet ne dépend pas du choix', async () => {
  const empreintes: Record<string, Set<string>> = {};
  for (const value of [...TABS, null] as (TrackTab | null)[]) {
    const root = await monter(value);
    for (const tab of TABS) (empreintes[tab] ??= new Set()).add(empreinteDeTaille(root, tab));
    await act(async () => renderer!.unmount());
    renderer = null;
  }
  for (const tab of TABS) expect({ tab, etats: empreintes[tab].size }).toEqual({ tab, etats: 1 });
});
