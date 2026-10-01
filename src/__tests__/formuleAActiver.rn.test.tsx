// Lot 4 « Rejoindre une box en payant » : AxNotice, « Bienvenue chez ta box » et rechargement de l'état.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { AppState, Linking, Modal, StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { Clock, CreditCard } from 'lucide-react-native';
import { lightTheme, darkTheme } from '../theme/palette';
import '../i18n';
import { AxNotice } from '../components/ax';
import BoxWelcomeGate, { BoxWelcomeScreen } from '../screens/onboarding/BoxWelcomeScreen';
import { usePlanStatuses } from '../hooks/usePlanStatuses';

let mockTheme = lightTheme;
let mockFocus: (() => void | (() => void)) | null = null;
const mockNavigate = jest.fn();
const mockPlan = jest.fn();
const mockAuth: { joinedBox: { id: string; name: string; slug: string | null } | null; clearJoinedBox: jest.Mock } = {
  joinedBox: null, clearJoinedBox: jest.fn(),
};

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    // Le rappel est gardé pour simuler un retour sur l'écran.
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(() => { mockFocus = cb; return cb(); }, [cb]),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../navigation/navigationRef', () => ({ navigate: (...a: unknown[]) => mockNavigate(...a) }));
jest.mock('../services/membership', () => ({
  ...jest.requireActual('../services/membership'),
  getMyPlanStatus: (id: string) => mockPlan(id),
}));
jest.mock('../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const THEMES = [lightTheme, darkTheme];
const SANS_FORMULE = { is_staff: false, has_plan: false, suspended: false, credits_left: 0, pays_online: true };

let renderer: TestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  if (renderer) { const r = renderer; await act(async () => r.unmount()); renderer = null; }
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockAuth.joinedBox = null;
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
const texts = (root: ReactTestInstance) => root.findAll(isHostText).map((n) => {
  const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
  return upper ? hostText(n).toUpperCase() : hostText(n);
});
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const typeName = (n: ReactTestInstance) => (typeof n.type === 'string' ? n.type : (n.type as { name?: string }).name ?? '');
const buttons = (root: ReactTestInstance) => root.findAll((n) => typeName(n) === 'AxButton');
const textNode = (root: ReactTestInstance, t: string) => root.findAll((n) => isHostText(n) && hostText(n) === t)[0];
function lum(hex: string) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('AxNotice', () => {
  for (const th of THEMES) {
    const c = th.ax;
    it(`${th.mode} : surface bordée warning, titre et icône warning, texte et pied en textMuted, AA`, async () => {
      const onPress = jest.fn();
      const root = await mount(
        <AxNotice testID="n" icon={Clock} title="Formule à activer" body="Corps" footer="Pied"
          action={{ label: 'Activer', icon: CreditCard, onPress, testID: 'n-cta' }} />, th);
      const card = root.findAll((n) => n.props.testID === 'n' && String(n.type) === 'View')[0];
      expect(card.props.accessibilityRole).toBe('alert');
      expect(flat(card)).toMatchObject({ borderColor: c.warning, backgroundColor: c.surface, borderWidth: 1 });
      expect(texts(root)).toEqual(['FORMULE À ACTIVER', 'Corps', 'Activer', 'Pied']);
      expect(flat(textNode(root, 'Formule à activer'))).toMatchObject({ color: c.warning, lineHeight: 28 });
      expect(flat(textNode(root, 'Corps'))).toMatchObject({ color: c.textMuted });
      expect(flat(textNode(root, 'Pied'))).toMatchObject({ color: c.textMuted, textAlign: 'center' });
      expect(root.findAll((n) => n.props.testID === 'ax-notice-icon')[0].props.color).toBe(c.warning);
      for (const ink of [c.warning, c.textMuted]) expect(contrast(ink, c.surface)).toBeGreaterThanOrEqual(4.5);
      const cta = buttons(root)[0];
      expect([cta.props.label, cta.props.fullWidth, cta.props.variant]).toEqual(['Activer', true, undefined]);
      await act(async () => { cta.props.onPress(); });
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  }

  it('sans bouton ni pied : titre et texte seulement', async () => {
    const root = await mount(<AxNotice icon={Clock} title="Titre" body="Corps" />);
    expect(buttons(root)).toHaveLength(0);
    expect(texts(root)).toEqual(['TITRE', 'Corps']);
  });
});

describe('Bienvenue chez ta box (73:2095)', () => {
  for (const th of THEMES) {
    const c = th.ax;
    it(`${th.mode} : textes, ordre, boutons et encart sans bouton`, async () => {
      const root = await mount(<BoxWelcomeScreen boxName="AthleX Fitness" activationUrl="https://athlexapp.eu/box/x" onDone={jest.fn()} />, th);
      expect(texts(root)).toEqual([
        'BIENVENUE CHEZ ATHLEX FITNESS',
        'Dernière étape : active ta formule pour réserver tes cours. En attendant, tu as accès au whiteboard, aux messages et aux classements de ta box.',
        'Activer mon abonnement', 'Je paie au comptoir',
        'Tu as reçu une invitation par e-mail ?',
        'Utilise plutôt son lien : ta formule et ta date de prélèvement y sont déjà prêtes.',
      ]);
      expect(buttons(root).map((b) => [b.props.label, b.props.variant ?? 'accent'])).toEqual([
        ['Activer mon abonnement', 'accent'], ['Je paie au comptoir', 'outline'],
      ]);
      const invite = root.findAll((n) => n.props.testID === 'box-welcome-invite')[0];
      expect(invite.findAll((n) => typeof n.props.onPress === 'function')).toHaveLength(0);
      expect(flat(textNode(root, 'Bienvenue chez AthleX Fitness'))).toMatchObject({ color: c.text, textAlign: 'center' });
      for (const ink of [c.text, c.textMuted, c.accentText]) expect(contrast(ink, c.background)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('« Activer mon abonnement » ouvre la page de la box puis termine ; « Je paie au comptoir » termine seulement', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const onDone = jest.fn();
    const root = await mount(<BoxWelcomeScreen boxName="B" activationUrl="https://athlexapp.eu/box/b" onDone={onDone} />);
    await act(async () => { root.findByProps({ testID: 'box-welcome-activate' }).props.onPress(); });
    expect(open).toHaveBeenCalledWith('https://athlexapp.eu/box/b');
    expect(onDone).toHaveBeenCalledTimes(1);
    await act(async () => { root.findByProps({ testID: 'box-welcome-counter' }).props.onPress(); });
    expect(open).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it('box sans formule en ligne : aucun bouton « Activer mon abonnement »', async () => {
    const root = await mount(<BoxWelcomeScreen boxName="B" activationUrl={null} onDone={jest.fn()} />);
    expect(buttons(root).map((b) => b.props.label)).toEqual(['Je paie au comptoir']);
  });
});

describe('Bienvenue : déclenchement après joinBox', () => {
  it('formule à activer : écran ouvert ; « Je paie au comptoir » efface la box rejointe et mène à Ma Box', async () => {
    mockAuth.joinedBox = { id: 'b1', name: 'AthleX Fitness', slug: 'athlex-fitness' };
    mockPlan.mockResolvedValue(SANS_FORMULE);
    const root = await mount(<BoxWelcomeGate />);
    expect(mockPlan).toHaveBeenCalledWith('b1');
    expect(root.findAllByType(Modal)).toHaveLength(1);
    const activate = root.findByProps({ testID: 'box-welcome-activate' });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await act(async () => { activate.props.onPress(); });
    expect(open).toHaveBeenCalledWith('https://athlexapp.eu/box/athlex-fitness');
    expect(mockAuth.clearJoinedBox).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('Whiteboard');
  });

  it('sans formule en ligne : écran sans bouton d’activation', async () => {
    mockAuth.joinedBox = { id: 'b1', name: 'Box', slug: 'box' };
    mockPlan.mockResolvedValue({ ...SANS_FORMULE, pays_online: false });
    const root = await mount(<BoxWelcomeGate />);
    expect(root.findAll((n) => n.props.testID === 'box-welcome-activate')).toHaveLength(0);
    expect(root.findAll((n) => n.props.testID === 'box-welcome-counter').length).toBeGreaterThan(0);
  });

  it.each([
    ['formule active', { ...SANS_FORMULE, has_plan: true }],
    ['staff', { ...SANS_FORMULE, is_staff: true }],
    ['suspendu', { ...SANS_FORMULE, suspended: true }],
    ['appel échoué', null],
  ])('%s : pas d’écran, la box rejointe est effacée', async (_n, st) => {
    mockAuth.joinedBox = { id: 'b1', name: 'Box', slug: 'box' };
    mockPlan.mockResolvedValue(st);
    const root = await mount(<BoxWelcomeGate />);
    expect(root.findAllByType(Modal)).toHaveLength(0);
    expect(mockAuth.clearJoinedBox).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('aucune box rejointe : rien n’est demandé', async () => {
    const root = await mount(<BoxWelcomeGate />);
    expect(mockPlan).not.toHaveBeenCalled();
    expect(root.findAllByType(Modal)).toHaveLength(0);
  });

  it('joinBox pose la box rejointe ; la déconnexion l’efface ; la porte est montée à la racine une fois connecté', () => {
    const auth = fs.readFileSync(path.join(__dirname, '../context/AuthContext.tsx'), 'utf8');
    const join = auth.slice(auth.indexOf('async function joinBox'), auth.indexOf('async function skipBox'));
    expect(join).toMatch(/setCurrentBox\(box as Box\);[\s\S]*setJoinedBox\(box as Box\);/);
    const signOut = auth.slice(auth.indexOf('async function signOut'), auth.indexOf('// Purge des clés locales'));
    expect(signOut).toContain('setJoinedBox(null);');
    const nav = fs.readFileSync(path.join(__dirname, '../navigation/index.tsx'), 'utf8');
    expect(nav).toMatch(/<\/NavigationContainer>\s*\{isAuthenticated && <BoxWelcomeGate \/>\}/);
  });
});

describe('usePlanStatuses : relu au focus et au retour au premier plan', () => {
  function Probe({ ids }: { ids: string[] }) {
    const s = usePlanStatuses(ids);
    return <Text>{JSON.stringify(Object.keys(s))}</Text>;
  }

  it('lecture au montage, au retour sur l’écran et quand l’app revient au premier plan (retour du site)', async () => {
    let listener: ((s: string) => void) | null = null;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, l: (s: string) => void) => { listener = l; return { remove }; }) as never);
    mockPlan.mockResolvedValue(SANS_FORMULE);
    const root = await mount(<Probe ids={['b1', 'b2']} />);
    expect(mockPlan.mock.calls).toEqual([['b1'], ['b2']]);
    expect(hostText(root.findByType(Text))).toBe('["b1","b2"]');

    // Retour sur l'écran : le rappel de focus est rejoué.
    await act(async () => { mockFocus!(); });
    await settle();
    expect(mockPlan).toHaveBeenCalledTimes(4);

    // Retour du navigateur : l'app redevient active, l'état est relu ; arrière-plan : rien.
    mockPlan.mockResolvedValue(null);
    await act(async () => { listener!('background'); });
    expect(mockPlan).toHaveBeenCalledTimes(4);
    await act(async () => { listener!('active'); });
    await settle();
    expect(mockPlan).toHaveBeenCalledTimes(6);
    expect(hostText(root.findByType(Text))).toBe('[]');
  });

  it('écran quitté : l’écoute du premier plan est retirée', async () => {
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((() => ({ remove })) as never);
    mockPlan.mockResolvedValue(null);
    await mount(<Probe ids={['b1']} />);
    const r = renderer!; await act(async () => r.unmount()); renderer = null;
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('aucune box : aucun appel', async () => {
    mockPlan.mockResolvedValue(SANS_FORMULE);
    await mount(<Probe ids={[]} />);
    expect(mockPlan).not.toHaveBeenCalled();
  });
});
