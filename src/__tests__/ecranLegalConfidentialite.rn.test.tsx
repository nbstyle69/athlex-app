/**
 * Écran légal, onglet Confidentialité (#593) : il ne recopie plus la politique, il renvoie
 * vers https://athlexapp.eu/privacy, tenue à jour. Le bouton est là, en FR et en EN, il ouvre
 * exactement cette adresse, et le texte « anonymis… » (faux pour Mixpanel et Sentry) a disparu
 * de l'écran rendu comme de la source.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { Linking } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import LegalScreen from '../screens/documents/LegalScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), addListener: () => () => {}, canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View: V } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: V };
});
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 92 }));
jest.mock('../context/ThemeContext', () => {
  const { lightTheme: th } = jest.requireActual('../theme/palette');
  const mockValue = { theme: th, mode: 'light' };
  return { useTheme: () => mockValue };
});
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const hostText = (n: ReactTestInstance): string => n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
const textes = (root: ReactTestInstance) => root.findAll((n) => String(n.type) === 'Text').map(hostText);

let renderer: TestRenderer.ReactTestRenderer;
async function ongletConfidentialite() {
  await act(async () => { renderer = TestRenderer.create(<LegalScreen />); });
  const onglet = renderer.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function'
    && hostText(n) === i18n.t('legal.tabPrivacy'))[0];
  await act(async () => { onglet.props.onPress(); });
  return renderer.root;
}

afterEach(async () => {
  await act(async () => renderer?.unmount());
  await i18n.changeLanguage('fr');
});

describe('écran légal, onglet Confidentialité (#593)', () => {
  it.each([
    ['fr', 'Politique de confidentialité', 'Lire la politique de confidentialité', 'Supprimer ton compte : Profil → Compte → Supprimer mon compte.'],
    ['en', 'Privacy policy', 'Read the privacy policy', 'Delete your account: Profile → Account → Delete my account.'],
  ])('%s : titre, bouton, ligne de suppression ; le bouton ouvre exactement https://athlexapp.eu/privacy', async (lang, titre, bouton, suppression) => {
    await i18n.changeLanguage(lang);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await ongletConfidentialite();
    const vus = textes(root);
    expect(vus.map((s) => s.toUpperCase())).toContain(titre.toUpperCase());
    expect(vus).toContain(suppression);
    const btn = root.findByProps({ testID: 'legal-privacy-open' });
    expect(hostText(btn).toUpperCase()).toBe(bouton.toUpperCase());
    await act(async () => { btn.props.onPress(); });
    expect(open.mock.calls).toEqual([['https://athlexapp.eu/privacy']]);
    open.mockRestore();
  });

  it('aucune occurrence de « anonymis » : ni à l\'écran (deux langues), ni dans la source de l\'écran', async () => {
    for (const lang of ['fr', 'en']) {
      await i18n.changeLanguage(lang);
      const root = await ongletConfidentialite();
      expect(textes(root).filter((s) => /anonymi/i.test(s))).toEqual([]);
      await act(async () => renderer.unmount());
    }
    const src = fs.readFileSync(path.join(__dirname, '../screens/documents/LegalScreen.tsx'), 'utf8');
    expect(src).not.toMatch(/anonymi/i);
  });
});
