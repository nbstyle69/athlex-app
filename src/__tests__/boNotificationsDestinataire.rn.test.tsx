/**
 * D4b, PR 2b : destinataire (tous ou un membre choisi dans une feuille de A à Z),
 * résultat de l'envoi dans la carte, historique enrichi, présélection depuis la fiche.
 * Monté avec le vrai react-native, client Supabase simulé.
 */
import React from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { BellOff, CircleCheck } from 'lucide-react-native';
import { darkTheme } from '../theme/palette';
import i18n from '../i18n';
import { AxButton, AxChip, AxTextField } from '../components/ax';
import BONotificationsScreen from '../screens/backoffice/BONotificationsScreen';

const LEA = 'u-lea';
let mockParams: { memberId?: string } | undefined;
let mockMembers: { member_id: string; profiles: { username: string } }[] = [];
let mockHistory: Record<string, unknown>[] = [];
let mockInvoke: () => Promise<{ data: unknown; error: unknown }>;
const mockInserts: Record<string, unknown>[] = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../context/AuthContext', () => {
  const box = { id: 'box-1' };
  return { useAuth: () => ({ currentBox: box }) };
});
jest.mock('../context/ThemeContext', () => {
  const { darkTheme: th } = jest.requireActual('../theme/palette');
  return { useTheme: () => ({ theme: th }) };
});
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
      functions: { invoke: () => mockInvoke() },
    },
  };
});

const c = darkTheme.ax;
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const texteDe = (n: ReactTestInstance): string => {
  const ch = n.props.children;
  return (Array.isArray(ch) ? ch : [ch]).filter((x) => typeof x === 'string' || typeof x === 'number').join('');
};
const textes = (root: ReactTestInstance) => root.findAllByType(Text).map(texteDe).filter((s) => s.trim());
const par = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id);
const appuyer = async (root: ReactTestInstance, id: string) => {
  const n = root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`rien d'appuyable : ${id}`);
  await act(async () => { await n.props.onPress(); });
};
const feuilleOuverte = (root: ReactTestInstance) => root.findAllByType(Modal).some((m) => m.props.visible);
const membresFeuille = (root: ReactTestInstance) =>
  par(root, 'choisir-membre-liste')[0].findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('choisir-membre-u-') && typeof n.type === 'string')
    .map((n) => n.props.accessibilityLabel);
const envoyer = (root: ReactTestInstance) => root.findAllByType(AxButton).find((b) => b.props.testID === 'bo-notif-send')!;

async function monter() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<BONotificationsScreen />); });
  await act(async () => {});
  return r.root;
}
async function saisirTitre(root: ReactTestInstance, titre = 'Fermeture lundi') {
  await act(async () => { root.findAllByType(AxTextField).find((f) => f.props.testID === 'bo-notif-title')!.props.onChangeText(titre); });
}

const NOMS = ['Léa M.', 'Karim M.', 'élodie_r', 'Zoé', 'antoine', 'Émile', 'Karine D.', 'Oskar P.', '42runner'];
beforeAll(async () => { await i18n.changeLanguage('fr'); });
beforeEach(() => {
  mockParams = undefined;
  mockMembers = NOMS.map((u, i) => ({ member_id: i === 0 ? LEA : `u-${i}`, profiles: { username: u } }));
  mockHistory = [];
  mockInvoke = async () => ({ data: { sent: 2, recipients: 3, pref_disabled: 0 }, error: null });
  mockInserts.length = 0;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('D4b 2b : destinataire', () => {
  it('deux pastilles, « Tous les membres (N) » choisie par défaut', async () => {
    const root = await monter();
    expect(root.findAllByType(AxChip).map((x) => [x.props.label, x.props.selected])).toEqual([
      ['Tous les membres (9)', true], ['Un membre', false],
    ]);
    expect(par(root, 'bo-notif-chosen')).toHaveLength(0);
    expect(feuilleOuverte(root)).toBe(false);
  });

  it('« Un membre » ouvre la feuille : A à Z sans accents ni casse, sous leur lettre, compteur', async () => {
    const root = await monter();
    await appuyer(root, 'bo-notif-target-one');
    expect(feuilleOuverte(root)).toBe(true);
    expect(textes(root)).toContain('CHOISIR UN MEMBRE');
    expect(texteDe(par(root, 'choisir-membre-compteur').find((n) => typeof n.type === 'string')!)).toBe('9 membres actifs, de A à Z');
    expect(membresFeuille(root)).toEqual(['antoine', 'élodie_r', 'Émile', 'Karim M.', 'Karine D.', 'Léa M.', 'Oskar P.', 'Zoé', '42runner']);
    const lettres = par(root, 'choisir-membre-liste')[0].findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('choisir-membre-section-') && typeof n.type === 'string')
      .map((n) => n.props.testID.replace('choisir-membre-section-', ''));
    expect(lettres).toEqual(['A', 'E', 'K', 'L', 'O', 'Z', '#']);
    expect(par(root, 'choisir-membre-index')).not.toHaveLength(0);
  });

  it('recherche : filtre dès la première lettre, sans accents, compteur de résultats, croix pour effacer', async () => {
    const root = await monter();
    await appuyer(root, 'bo-notif-target-one');
    const champ = () => root.findAllByType(AxTextField).find((f) => f.props.testID === 'choisir-membre-recherche')!;
    await act(async () => { champ().props.onChangeText('k'); });
    expect(membresFeuille(root)).toEqual(['Karim M.', 'Karine D.', 'Oskar P.']);
    expect(texteDe(par(root, 'choisir-membre-compteur').find((n) => typeof n.type === 'string')!)).toBe('3 résultats');
    expect(par(root, 'choisir-membre-index')).toHaveLength(0);
    await act(async () => { champ().props.onChangeText('EMI'); });
    expect(membresFeuille(root)).toEqual(['Émile']);
    expect(texteDe(par(root, 'choisir-membre-compteur').find((n) => typeof n.type === 'string')!)).toBe('1 résultat');
    await appuyer(root, 'choisir-membre-effacer');
    expect(champ().props.value).toBe('');
    expect(membresFeuille(root)).toHaveLength(9);
  });

  it('index A–Z : fait défiler jusqu’à la section de la lettre (ou la suivante présente)', async () => {
    const root = await monter();
    await appuyer(root, 'bo-notif-target-one');
    const liste = root.findAllByType(ScrollView).find((s) => s.props.testID === 'choisir-membre-liste')!;
    const scrollTo = jest.fn();
    (liste.instance as { scrollTo: unknown }).scrollTo = scrollTo;
    for (const [l, y] of [['A', 0], ['E', 120], ['K', 300], ['L', 420], ['O', 480], ['Z', 540], ['#', 600]] as const) {
      const sec = par(root, `choisir-membre-section-${l}`).find((n) => typeof n.type === 'string')!;
      await act(async () => { sec.props.onLayout({ nativeEvent: { layout: { x: 0, y, width: 300, height: 40 } } }); });
    }
    await appuyer(root, 'choisir-membre-index-K');
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 300, animated: true });
    await appuyer(root, 'choisir-membre-index-M'); // pas de M : la section suivante, O
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 480, animated: true });
  });

  it('toucher un membre le choisit et ferme la feuille ; « Changer » la rouvre', async () => {
    const root = await monter();
    await appuyer(root, 'bo-notif-target-one');
    await appuyer(root, `choisir-membre-${LEA}`);
    expect(feuilleOuverte(root)).toBe(false);
    expect(texteDe(par(root, 'bo-notif-chosen-name').find((n) => typeof n.type === 'string')!)).toBe('Léa M.');
    expect(textes(root)).toContain('Changer');
    expect(root.findAllByType(AxChip).map((x) => x.props.selected)).toEqual([false, true]);
    await appuyer(root, 'bo-notif-chosen');
    expect(feuilleOuverte(root)).toBe(true);
    await appuyer(root, 'choisir-membre-fermer');
    expect(feuilleOuverte(root)).toBe(false);
    expect(texteDe(par(root, 'bo-notif-chosen-name').find((n) => typeof n.type === 'string')!)).toBe('Léa M.');
    await appuyer(root, 'bo-notif-target-all');
    expect(par(root, 'bo-notif-chosen')).toHaveLength(0);
  });

  it('présélection depuis la fiche membre : membre choisi, envoi à ce membre', async () => {
    mockParams = { memberId: LEA };
    const root = await monter();
    expect(texteDe(par(root, 'bo-notif-chosen-name').find((n) => typeof n.type === 'string')!)).toBe('Léa M.');
    await saisirTitre(root);
    await act(async () => { await envoyer(root).props.onPress(); });
    expect(mockInserts[0]).toMatchObject({ target: LEA, title: 'Fermeture lundi' });
  });
});

describe('D4b 2b : résultat dans la carte', () => {
  const encadre = (root: ReactTestInstance, id: string) => par(root, id).find((n) => typeof n.type === 'string');

  it('sent > 0 : encadré vert « Envoyée à N appareils. », plus de fenêtre « Envoyé »', async () => {
    const root = await monter();
    await saisirTitre(root);
    await act(async () => { await envoyer(root).props.onPress(); });
    const ok = encadre(root, 'bo-notif-result-ok')!;
    expect(flat(ok).borderColor).toBe(c.success);
    expect(textes(ok)).toEqual(['Envoyée à 2 appareils.']);
    expect(ok.findAllByType(CircleCheck)).toHaveLength(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('pluriel : 1 appareil', async () => {
    mockInvoke = async () => ({ data: { sent: 1, recipients: 1, pref_disabled: 0 }, error: null });
    const root = await monter();
    await saisirTitre(root);
    await act(async () => { await envoyer(root).props.onPress(); });
    expect(textes(encadre(root, 'bo-notif-result-ok')!)).toEqual(['Envoyée à 1 appareil.']);
  });

  it('sent = 0, un membre : encadré couleur alerte, cloche barrée, texte au nom du membre', async () => {
    mockInvoke = async () => ({ data: { sent: 0, recipients: 1, pref_disabled: 0 }, error: null });
    mockParams = { memberId: LEA };
    const root = await monter();
    await saisirTitre(root);
    await act(async () => { await envoyer(root).props.onPress(); });
    const ko = encadre(root, 'bo-notif-result-none')!;
    expect(flat(ko).borderColor).toBe(c.warning);
    expect(ko.findAllByType(BellOff)[0].props.color).toBe(c.warning);
    expect(textes(ko)).toEqual(['Non reçue : Léa M. n\'a pas activé les notifications ou n\'est connecté sur aucun téléphone.']);
    expect(encadre(root, 'bo-notif-result-ok')).toBeUndefined();
  });

  it('sent = 0, tous : texte « aucun membre »', async () => {
    mockInvoke = async () => ({ data: { sent: 0, recipients: 9, pref_disabled: 2 }, error: null });
    const root = await monter();
    await saisirTitre(root);
    await act(async () => { await envoyer(root).props.onPress(); });
    expect(textes(encadre(root, 'bo-notif-result-none')!)).toEqual(['Non reçue : aucun membre n\'a activé les notifications.']);
  });

  it('erreur d’envoi (dont 409 « Already sent ») : message d’erreur existant, aucun encadré', async () => {
    mockInvoke = async () => ({ data: null, error: new Error('Edge Function returned a non-2xx status code (409)') });
    const root = await monter();
    await saisirTitre(root);
    await act(async () => { await envoyer(root).props.onPress(); });
    expect(Alert.alert).toHaveBeenCalledWith('Enregistrée', i18n.t('bo.notifications.pushFailed'));
    expect(encadre(root, 'bo-notif-result-ok')).toBeUndefined();
    expect(encadre(root, 'bo-notif-result-none')).toBeUndefined();
  });

  it('bouton désactivé pendant l’envoi, réactivé ensuite', async () => {
    let finir!: (v: { data: unknown; error: unknown }) => void;
    mockInvoke = () => new Promise((res) => { finir = res; });
    const root = await monter();
    await saisirTitre(root);
    expect(envoyer(root).props.disabled).toBe(false);
    let envoi!: Promise<unknown>;
    await act(async () => { envoi = envoyer(root).props.onPress(); });
    expect(envoyer(root).props.disabled).toBe(true);
    expect(envoyer(root).props.label).toBe(i18n.t('bo.notifications.sending'));
    await act(async () => { finir({ data: { sent: 3, recipients: 3, pref_disabled: 0 }, error: null }); await envoi; });
    await saisirTitre(root, 'Autre');
    expect(envoyer(root).props.disabled).toBe(false);
    expect(envoyer(root).props.label).toBe(i18n.t('bo.notifications.send'));
  });
});

describe('D4b 2b : historique', () => {
  const ligne = (root: ReactTestInstance, id: string) => par(root, `bo-notif-row-${id}-target`).find((n) => typeof n.type === 'string')!;

  it('delivered_count > 0 : coche verte et « N appareils » ; 0 : cloche barrée et « non reçue » ; NULL : rien', async () => {
    mockHistory = [
      { id: 'n1', title: 'A', body: '', target: 'all', created_at: '2026-09-25T16:02:00Z', delivered_count: 148 },
      { id: 'n2', title: 'B', body: '', target: LEA, created_at: '2026-09-20T08:15:00Z', delivered_count: 0 },
      { id: 'n3', title: 'C', body: '', target: 'all', created_at: '2026-09-12T17:40:00Z', delivered_count: null },
      { id: 'n4', title: 'D', body: '', target: 'all', created_at: '2026-09-11T17:40:00Z' },
      { id: 'n5', title: 'E', body: '', target: 'all', created_at: '2026-09-10T17:40:00Z', delivered_count: 1 },
    ];
    const root = await monter();
    expect(texteDe(ligne(root, 'n1'))).toBe('→ Tous · 148 appareils');
    expect(flat(ligne(root, 'n1')).color).toBe(c.accentText);
    expect(par(root, 'bo-notif-row-n1-ok').length).toBeGreaterThan(0);
    expect(texteDe(ligne(root, 'n2'))).toBe('→ Léa M. · non reçue');
    expect(flat(ligne(root, 'n2')).color).toBe(c.warning);
    expect(root.findAllByType(BellOff).find((b) => b.props.testID === 'bo-notif-row-n2-none')!.props.color).toBe(c.warning);
    expect(texteDe(ligne(root, 'n3'))).toBe('→ Tous');
    expect(texteDe(ligne(root, 'n4'))).toBe('→ Tous');
    expect(par(root, 'bo-notif-row-n3-ok').length).toBeGreaterThan(0);
    expect(texteDe(ligne(root, 'n5'))).toBe('→ Tous · 1 appareil');
  });

  it('pseudo du membre au lieu de « Individuel » ; « Membre retiré » s’il n’est plus dans la liste', async () => {
    mockHistory = [
      { id: 'n1', title: 'A', body: '', target: LEA, created_at: '2026-09-25T16:02:00Z', delivered_count: 2 },
      { id: 'n2', title: 'B', body: '', target: 'u-parti', created_at: '2026-09-20T08:15:00Z', delivered_count: null },
    ];
    const root = await monter();
    expect(texteDe(ligne(root, 'n1'))).toBe('→ Léa M. · 2 appareils');
    expect(texteDe(ligne(root, 'n2'))).toBe('→ Membre retiré');
    expect(textes(root)).not.toContain('Individuel');
    expect(root.findAllByType(CircleCheck).length).toBeGreaterThan(0);
  });
});
