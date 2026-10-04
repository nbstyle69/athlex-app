/**
 * D4b, PR 2a : écran « Notifications » du gérant à l'apparence de sa maquette
 * (Figma 56:1868 sombre, 56:2536 clair), sans changement de contenu ni de
 * comportement. Monté avec le vrai react-native, client Supabase simulé.
 */
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { Send, CircleCheck, ChevronLeft, Bell } from 'lucide-react-native';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import i18n from '../i18n';
import { AxButton, AxCard, AxChip, AxTextField } from '../components/ax';
import { axAccentSafeLineHeight, axTypography } from '../theme/axTokens';
import BONotificationsScreen from '../screens/backoffice/BONotificationsScreen';

let mockTheme: AppTheme = darkTheme;
const mockMembers = [
  { member_id: 'u-lea', profiles: { username: 'Léa M.' } },
  { member_id: 'u-karim', profiles: { username: 'Karim B.' } },
];
const mockHistory = [
  { id: 'n1', title: 'Ouverture samedi 8 h', body: 'Le WOD sera révélé à 9 h.', target: 'all', created_at: '2026-09-25T16:02:00Z' },
  { id: 'n2', title: 'Rappel de paiement', body: '', target: 'u-lea', created_at: '2026-09-20T08:15:00Z' },
];
const mockInserts: Record<string, unknown>[] = [];
const mockInvokes: unknown[] = [];
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../context/AuthContext', () => {
  const box = { id: 'box-1' };
  return { useAuth: () => ({ currentBox: box }) };
});
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../lib/supabase', () => {
  function from(table: string) {
    const q: Record<string, unknown> = {};
    let insert: Record<string, unknown> | null = null;
    q.select = () => q;
    q.eq = () => q;
    q.order = () => q;
    q.limit = () => q;
    q.insert = (v: Record<string, unknown>) => { insert = v; mockInserts.push(v); return q; };
    q.single = () => Promise.resolve({ data: { id: 'n-new' }, error: null });
    q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(
      insert ? { data: { id: 'n-new' }, error: null }
        : { data: table === 'box_members' ? mockMembers : mockHistory, error: null },
    ).then(res, rej);
    return q;
  }
  return {
    supabase: {
      from,
      auth: { getUser: async () => ({ data: { user: { id: 'gerant' } } }) },
      functions: { invoke: async (name: string, o: unknown) => { mockInvokes.push([name, o]); return { data: { sent: 2, recipients: 3, pref_disabled: 0 }, error: null }; } },
    },
  };
});

const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const texteDe = (n: ReactTestInstance): string => {
  const c = n.props.children;
  return (Array.isArray(c) ? c : [c]).filter((x) => typeof x === 'string' || typeof x === 'number').join('');
};
/** Textes affichés, dans l'ordre, hors champs de saisie. */
const textes = (root: ReactTestInstance) => root.findAllByType(Text).map(texteDe).filter((s) => s.trim().length > 0);

async function monter(theme: AppTheme = darkTheme) {
  mockTheme = theme;
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<BONotificationsScreen />); });
  await act(async () => {});
  return r.root;
}

beforeAll(async () => { await i18n.changeLanguage('fr'); });
beforeEach(() => {
  mockInserts.length = 0; mockInvokes.length = 0; mockGoBack.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/** Contenu de l'écran d'avant la PR, texte pour texte (dates au format local inchangé). */
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const CONTENU = [
  'Notifications', 'Nouvelle notification', 'Destinataire', 'Tous (2)', 'Léa M.', 'Karim B.',
  'Titre', 'Message (optionnel)', 'Envoyer', 'Historique',
  'Ouverture samedi 8 h', 'Le WOD sera révélé à 9 h.', date('2026-09-25T16:02:00Z'), '→ Tous',
  'Rappel de paiement', date('2026-09-20T08:15:00Z'), '→ Individuel',
];

describe('D4b 2a : même contenu (contrôle joué aussi sur l’écran d’avant)', () => {
  it('mêmes textes, dans le même ordre', async () => {
    const root = await monter();
    expect(textes(root)).toEqual(CONTENU);
  });
});

describe('D4b 2a : apparence de la maquette', () => {
  for (const [nom, th] of [['sombre', darkTheme], ['clair', lightTheme]] as const) {
    it(`en-tête, carte de saisie, pastilles, champs et bouton menthe (${nom})`, async () => {
      const root = await monter(th);
      const c = th.ax;
      // En-tête : ‹, cloche menthe, titre Oswald en capitales.
      const titres = root.findAllByType(Text).filter((n) => ['Notifications', 'Nouvelle notification', 'Historique'].includes(texteDe(n)));
      expect(titres).toHaveLength(3);
      for (const n of titres) expect(flat(n)).toMatchObject({ ...axTypography.titleM, lineHeight: axAccentSafeLineHeight.titleM, color: c.text });
      expect(root.findAllByType(ChevronLeft)[0].props.color).toBe(c.text);
      expect(root.findAllByType(Bell)[0].props.color).toBe(c.accentText);
      // Saisie dans une carte de surface.
      const compose = root.findAllByType(AxCard).find((n) => n.props.testID === 'bo-notif-compose')!;
      expect(compose).toBeTruthy();
      // Destinataires en pastilles, « Tous » choisie par défaut.
      const chips = root.findAllByType(AxChip);
      expect(chips.map((x) => [x.props.label, x.props.selected])).toEqual([['Tous (2)', true], ['Léa M.', false], ['Karim B.', false]]);
      // Libellés : « Destinataire » en libellé petit, Titre et Message en surtitre petit.
      const lib = (s: string) => flat(root.findAllByType(Text).find((n) => texteDe(n) === s)!);
      expect(lib('Destinataire')).toMatchObject({ ...axTypography.labelSmall, color: c.textMuted });
      for (const s of ['Titre', 'Message (optionnel)']) expect(lib(s)).toMatchObject({ ...axTypography.overlineSmall, color: c.textMuted });
      // Champs de saisie ax, bouton accent pleine largeur avec l'icône send.
      expect(root.findAllByType(AxTextField).map((f) => f.props.placeholder)).toEqual(['Titre de la notification...', 'Corps du message...']);
      const send = root.findAllByType(AxButton).find((b) => b.props.testID === 'bo-notif-send')!;
      expect([send.props.variant ?? 'accent', send.props.fullWidth, send.props.icon]).toEqual(['accent', true, Send]);
    });

    it(`historique : carte, coche verte, date et cible en menthe (${nom})`, async () => {
      const root = await monter(th);
      const c = th.ax;
      const hist = root.findAllByType(AxCard).find((n) => n.props.testID === 'bo-notif-history')!;
      expect(hist.findAllByType(CircleCheck).map((x) => x.props.color)).toEqual([c.success, c.success]);
      const cible = hist.findAllByType(Text).find((n) => texteDe(n) === '→ Tous')!;
      expect(flat(cible)).toMatchObject({ ...axTypography.caption, color: c.accentText });
      const titre = hist.findAllByType(Text).find((n) => texteDe(n) === 'Ouverture samedi 8 h')!;
      expect(flat(titre)).toMatchObject({ ...axTypography.label, color: c.text });
    });
  }

  it('défilement vertical unique et rangée de pastilles qui défile horizontalement (inchangés)', async () => {
    const root = await monter();
    const scrolls = root.findAllByType(ScrollView);
    expect(scrolls.filter((s) => s.props.horizontal)).toHaveLength(1);
    expect(scrolls.filter((s) => !s.props.horizontal)).toHaveLength(1);
  });
});

describe('D4b 2a : comportement inchangé', () => {
  it('bouton désactivé sans titre ; envoi : même insertion, même fonction, même message', async () => {
    const root = await monter();
    const send = () => root.findAllByType(AxButton).find((b) => b.props.testID === 'bo-notif-send')!;
    expect(send().props.disabled).toBe(true);
    const champTitre = root.findAllByType(AxTextField)[0];
    await act(async () => { champTitre.props.onChangeText('  Fermeture lundi  '); });
    expect(send().props.disabled).toBe(false);
    await act(async () => { root.findAllByType(AxChip)[1].props.onPress(); });
    await act(async () => { await send().props.onPress(); });
    expect(mockInserts).toEqual([{ box_id: 'box-1', title: 'Fermeture lundi', body: '', target: 'u-lea', created_by: 'gerant' }]);
    expect(mockInvokes).toEqual([['send-box-notification', { body: { notification_id: 'n-new' } }]]);
    expect(Alert.alert).toHaveBeenCalledWith('Envoyé', 'Notification poussée à 2 appareil(s).');
  });

  it('retour : navigation.goBack', async () => {
    const root = await monter();
    const retour = root.findAll((n) => n.props.accessibilityLabel === i18n.t('common.back') && typeof n.props.onPress === 'function')[0];
    await act(async () => { retour.props.onPress(); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
