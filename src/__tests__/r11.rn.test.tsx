import React, { useEffect as mockUseEffect } from 'react';
import fs from 'fs';
import path from 'path';
import { Alert, Dimensions, Linking, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import i18n from '../i18n';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import JoinBoxScreen from '../screens/onboarding/JoinBoxScreen';
import WaitingScreen from '../screens/onboarding/WaitingScreen';
import OnboardingTutorialScreen from '../screens/onboarding/OnboardingTutorialScreen';
import LegalScreen from '../screens/documents/LegalScreen';
import MyReservationsScreen from '../screens/reservation/MyReservationsScreen';
import ReservationScreen from '../screens/reservation/ReservationScreen';
import WodHistoryScreen from '../screens/wod/WodHistoryScreen';
import FriendsScreen from '../screens/home/FriendsScreen';
import { Users } from 'lucide-react-native';
import MessagesScreen from '../screens/messages/MessagesScreen';
import { AxButton } from '../components/ax/AxButton';
import { AxCard } from '../components/ax/AxCard';
import { AxTextField } from '../components/ax/AxTextField';
import { axTypography, axVeil } from '../theme/axTokens';
import { contrast } from '../theme/contrast';
import { cancelClassReminder } from '../services/notifications';
import { markOnboardingCompleted } from '../lib/onboardingStatus';
import BEFORE from './r11StructureBefore.json';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockTheme = lightTheme;
const mockTables: Record<string, unknown[]> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];
const mockAuth: Record<string, unknown> = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn(), addListener: () => () => {}, canGoBack: () => true }),
  useRoute: () => ({ params: undefined }),
  useFocusEffect: (callback: () => void) => mockUseEffect(callback, [callback]),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: View };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme, mode: mockTheme.mode }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'or', 'order', 'limit', 'in', 'gte', 'lte', 'update', 'delete', 'insert', 'single', 'maybeSingle', 'contains', 'is', 'not', 'range', 'ilike', 'filter', 'match', 'upsert']) {
      b[m] = (...args: unknown[]) => { mockCalls.push({ table, method: m, args }); return b; };
    }
    b.then = (res: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: mockTables[table] ?? [], error: null }).then(res);
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: async () => ({ data: null, error: null }),
      auth: {},
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: jest.fn(),
    },
  };
});
jest.mock('../services/notifications', () => ({
  cancelClassReminder: jest.fn(async () => undefined), scheduleClassReminder: jest.fn(),
  sendFriendRequestNotification: jest.fn(), sendFriendAcceptedNotification: jest.fn(), sendNewMessageNotification: jest.fn(),
}));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), awardLevelBadge: jest.fn(async () => true) }));
jest.mock('../services/membership', () => ({ getMyMemberships: async () => [] }));
jest.mock('../services/moderation', () => ({ getBlockedUserIds: async () => [] }));
jest.mock('../lib/analytics', () => ({
  trackOnboardingStep: jest.fn(), trackOnboardingComplete: jest.fn(), trackOnboardingBoxJoin: jest.fn(), trackOnboardingSkipBox: jest.fn(),
}));
jest.mock('../lib/onboardingStatus', () => ({ markOnboardingCompleted: jest.fn(async () => undefined), ONBOARDING_KEY: 'k' }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('../lib/buildIdentity', () => ({ versionDisplay: (full: boolean) => (full ? 'v1.0.0 (1) · test' : 'v1.0.0') }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const R = path.join(__dirname, '..');
const EMOJI = /\p{Extended_Pictographic}\uFE0F?/gu;
const LONG_USER = 'Athlète-au-pseudo-particulièrement-long-pour-vérifier-les-débordements';
const FUTURE = '2099-01-15';

let renderer: TestRenderer.ReactTestRenderer | undefined;
let alertCalls: Array<[string, string | undefined, Array<{ text?: string; style?: string; onPress?: () => unknown }> | undefined]> = [];
function reset() {
  alertCalls = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => { alertCalls.push([title, message, buttons as never]); });
  jest.spyOn(Linking, 'openURL').mockImplementation(async () => true);
  for (const k of Object.keys(mockTables)) delete mockTables[k];
  for (const k of Object.keys(mockAuth)) delete mockAuth[k];
  Object.assign(mockAuth, {
    user: { id: 'local', username: LONG_USER, level: 'rx' },
    currentBox: { id: 'box', name: 'AthleX Fitness' },
    signIn: jest.fn(async () => ({ error: null })),
    signUp: jest.fn(async () => ({ error: 'CONFIRM_EMAIL', finalUsername: 'Nab' })),
    resetPassword: jest.fn(async () => ({ error: null })),
    joinBox: jest.fn(async () => ({ error: null })),
    skipBox: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    profileError: null,
  });
}
beforeEach(reset);
async function unmount() {
  if (renderer) { const r = renderer; renderer = undefined; await act(async () => r.unmount()); }
  jest.clearAllTimers();
  jest.useRealTimers();
}
afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
  mockNavigate.mockClear(); mockGoBack.mockClear();
  mockCalls.length = 0;
});

async function mount(el: React.ReactElement, theme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  await act(async () => { await new Promise((r) => setImmediate(r)); });
  return renderer!.root;
}

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
/** Textes visibles de l'écran dans l'ordre, puis ceux de chaque fenêtre ouverte (fenêtre native comprise). */
function structure(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance) => {
    if (n.type === Modal) return;
    if (isHostText(n)) { textsOf(n, out); return; }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch); });
  };
  walk(root);
  for (const m of root.findAllByType(Modal).filter((x) => x.props.visible)) {
    out.push('── fenêtre ──');
    textsOf(m, out);
  }
  for (const [title, message, buttons] of alertCalls) {
    out.push('── fenêtre ──', title);
    if (message) out.push(message);
    for (const b of buttons?.length ? buttons : [{ text: 'OK' }]) out.push(b.text ?? 'OK');
  }
  return out.filter((t) => t.trim().length > 0);
}
const normalize = (xs: string[]) => xs.map((x) => x.replace(EMOJI, '').replace(/\s+/g, ' ').trim().toUpperCase()).filter((x) => x.length > 0);

async function pressText(root: ReactTestInstance, text: string) {
  const t = root.findAll((n) => isHostText(n) && hostText(n).toUpperCase() === text.toUpperCase())[0];
  if (!t) throw new Error(`texte absent : ${text}`);
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de ${text}`);
  const node = n;
  await act(async () => { await node.props.onPress(); });
}

const RESERVATION = {
  id: 'r1', schedule_id: 's1', status: 'confirmed', created_at: '2026-09-28T08:00:00Z',
  schedule: { title: 'WOD du matin', scheduled_date: FUTURE, start_time: '07:00', end_time: '08:00', coach: 'Coach Nab' },
};

type Variant = { name: string; run: () => Promise<ReactTestInstance> };
export const VARIANTS: Variant[] = [
  { name: 'connexion', run: () => mount(<LoginScreen navigation={{ navigate: mockNavigate } as never} />) },
  { name: 'creer-un-compte', run: () => mount(<RegisterScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never} />) },
  {
    name: 'creer-un-compte-mail-a-confirmer', run: async () => {
      const root = await mount(<RegisterScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never} />);
      const fields = root.findAll((n) => String(n.type) === 'TextInput');
      await act(async () => { fields[0].props.onChangeText('Nabil'); fields[1].props.onChangeText('nab@example.test'); fields[2].props.onChangeText('secret123'); });
      const cgu = root.findAll((n) => n.props.accessibilityRole === 'checkbox' && typeof n.props.onPress === 'function')[0];
      await act(async () => { cgu.props.onPress(); });
      const cta = root.findAll((n) => n.props.accessibilityLabel === 'Créer un compte' && typeof n.props.onPress === 'function')[0];
      await act(async () => { await cta.props.onPress(); });
      return root;
    },
  },
  { name: 'mot-de-passe-oublie', run: () => mount(<ForgotPasswordScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never} />) },
  {
    name: 'email-envoye', run: async () => {
      const root = await mount(<ForgotPasswordScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never} />);
      const field = root.findAll((n) => String(n.type) === 'TextInput')[0];
      await act(async () => { field.props.onChangeText('nab@example.test'); });
      await pressText(root, 'Envoyer le lien');
      return root;
    },
  },
  { name: 'rejoindre-une-box', run: () => mount(<WaitingScreen navigation={{ navigate: mockNavigate }} />) },
  { name: 'rejoins-ta-box', run: () => mount(<JoinBoxScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />) },
  { name: 'tutoriel', run: () => { jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] }); mockAuth.currentBox = null; return mount(<OnboardingTutorialScreen onDone={jest.fn()} />); } },
  { name: 'mentions-legales', run: () => mount(<LegalScreen />) },
  { name: 'reservation-sans-box', run: () => { mockAuth.currentBox = null; return mount(<ReservationScreen />); } },
  { name: 'mes-reservations-vide', run: () => mount(<MyReservationsScreen />) },
  {
    name: 'mes-reservations-vide-passees', run: async () => {
      const root = await mount(<MyReservationsScreen />);
      await pressText(root, 'Passées (0)');
      return root;
    },
  },
  {
    name: 'annuler-la-reservation', run: async () => {
      mockTables.class_reservations = [RESERVATION];
      const root = await mount(<MyReservationsScreen />);
      await pressText(root, 'Annuler');
      return root;
    },
  },
  {
    name: 'quitter-la-liste-d-attente', run: async () => {
      mockTables.class_reservations = [{ ...RESERVATION, status: 'waiting' }];
      const root = await mount(<MyReservationsScreen />);
      await pressText(root, 'Annuler');
      return root;
    },
  },
  { name: 'historique-wods-vide', run: () => mount(<WodHistoryScreen />) },
  { name: 'amis-vide', run: () => mount(<FriendsScreen />) },
  { name: 'messages-sans-box', run: () => { mockAuth.currentBox = null; return mount(<MessagesScreen />); } },
];

/** Appels de fenêtre (titre, texte, boutons et leurs actions) des écrans trop lourds à monter, lus dans la source. */
export const DIALOG_SOURCES: Array<{ file: string; keys: string[] }> = [
  { file: 'screens/reservation/ReservationScreen.tsx', keys: ['tooLateTitle', 'cancelReservationTitle', 'limitReachedTitle', 'dailyLimitTitle', 'refusal.title', 'slotFullTitle'] },
  { file: 'screens/reservation/MyReservationsScreen.tsx', keys: ['tooLateTitle', 'cancelReservationTitle'] },
  { file: 'screens/competition/TournamentScreen.tsx', keys: ['tournament.kickTitle', 'tournament.leaveTitle'] },
  { file: 'screens/backoffice/BOTournamentScreen.tsx', keys: ['bo.tournament.kickTitle'] },
  { file: 'screens/wod/WodResultScreen.tsx', keys: ['wodGenerator.scoreSavedTitle'] },
];
function callArgs(src: string, callee: string): string[] {
  const out: string[] = [];
  let i = src.indexOf(callee);
  while (i >= 0) {
    let depth = 0; let j = i + callee.length - 1;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') { depth--; if (depth === 0) break; }
    }
    out.push(src.slice(i + callee.length, j).replace(/\s+/g, ' ').replace(/,\s*([\])])/g, '$1').trim().replace(/,$/, ''));
    i = src.indexOf(callee, j);
  }
  return out;
}
export function dialogCalls(file: string, keys: string[], callee: string): string[] {
  const src = fs.readFileSync(path.join(R, file), 'utf8');
  return callArgs(src, callee).filter((a) => keys.some((k) => a.slice(0, 120).includes(k)));
}

if (process.env.R11_CAPTURE) {
  it('capture de l’instantané avant', async () => {
    const all: Record<string, string[]> = {};
    for (const v of VARIANTS) {
      jest.restoreAllMocks();
      reset();
      all[v.name] = structure(await v.run());
      process.stdout.write(`capturé ${v.name}\n`);
      await unmount();
    }
    const dialogs: Record<string, string[]> = {};
    for (const d of DIALOG_SOURCES) dialogs[d.file] = dialogCalls(d.file, d.keys, 'Alert.alert(');
    fs.writeFileSync(process.env.R11_CAPTURE!, JSON.stringify({ screens: all, dialogs }, null, 2));
  }, 60_000);
}

const THEMES = [['clair', lightTheme], ['sombre', darkTheme]] as const;
const R11_FILES = [
  'screens/auth/LoginScreen.tsx', 'screens/auth/RegisterScreen.tsx', 'screens/auth/ForgotPasswordScreen.tsx',
  'screens/onboarding/WaitingScreen.tsx', 'screens/onboarding/JoinBoxScreen.tsx', 'screens/onboarding/OnboardingTutorialScreen.tsx',
  'screens/documents/LegalScreen.tsx', 'components/EmptyState.tsx', 'components/ConfirmDialog.tsx',
];
const variant = (name: string) => VARIANTS.find((v) => v.name === name)!;
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const textNode = (root: ReactTestInstance, text: string) =>
  root.findAll((n) => isHostText(n) && hostText(n).toUpperCase() === text.toUpperCase())[0];
const button = (root: ReactTestInstance, label: string) =>
  root.findAllByType(AxButton).find((b) => String(b.props.label).toUpperCase() === label.toUpperCase())!;
const dialog = (root: ReactTestInstance) => root.findByProps({ testID: 'confirm-dialog' });
const pressButton = async (b: ReactTestInstance) => { await act(async () => { await b.props.onPress(); }); };

if (!process.env.R11_CAPTURE) {
  describe('R11 : ordre des blocs inchangé (instantané avant / après)', () => {
    it.each(VARIANTS.map((v) => v.name))('%s', async (name) => {
      const root = await variant(name).run();
      expect(normalize(structure(root))).toEqual(normalize((BEFORE.screens as Record<string, string[]>)[name]));
    }, 20_000);

    it.each(DIALOG_SOURCES.map((d) => d.file))('fenêtres de %s : mêmes titres, textes, boutons et actions', (file) => {
      const d = DIALOG_SOURCES.find((x) => x.file === file)!;
      const before = (BEFORE.dialogs as Record<string, string[]>)[file];
      expect(before.length).toBeGreaterThan(0);
      expect(dialogCalls(file, d.keys, 'dialog.show(')).toEqual(before);
      expect(dialogCalls(file, d.keys, 'Alert.alert(')).toEqual([]);
    });
  });

  describe('R11 : aucun emoji', () => {
    it.each(VARIANTS.map((v) => v.name))('rendu de %s', async (name) => {
      const root = await variant(name).run();
      expect(structure(root).filter((x) => /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u.test(x))).toEqual([]);
    }, 20_000);
    it.each(R11_FILES)('source de %s', (file) => {
      const src = fs.readFileSync(path.join(R, file), 'utf8');
      expect(src.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/gu) ?? []).toEqual([]);
    });
  });

  describe('R11 : navigation et callbacks inchangés', () => {
    it('connexion : liens et action principale', async () => {
      const root = await variant('connexion').run();
      await pressText(root, 'Mot de passe oublié ?');
      expect(mockNavigate).toHaveBeenLastCalledWith('ForgotPassword');
      await pressText(root, 'Créer un compte');
      expect(mockNavigate).toHaveBeenLastCalledWith('Register');
      await act(async () => {
        root.findByProps({ testID: 'login-email' }).props.onChangeText('nab@example.test');
        root.findByProps({ testID: 'login-password' }).props.onChangeText('secret123');
      });
      await pressButton(root.findByProps({ testID: 'login-submit' }));
      expect(mockAuth.signIn).toHaveBeenCalledWith('nab@example.test', 'secret123');
    });

    it('création de compte : OK de la fenêtre renvoie vers Connexion, CGU exigées', async () => {
      const root = await variant('creer-un-compte-mail-a-confirmer').run();
      expect(mockAuth.signUp).toHaveBeenCalledTimes(1);
      await pressButton(button(dialog(root), 'OK'));
      expect(mockNavigate).toHaveBeenLastCalledWith('Login');
      expect(root.findAllByProps({ testID: 'confirm-dialog' })).toHaveLength(0);
    });

    it('mot de passe oublié : envoi puis retour à Connexion', async () => {
      const root = await variant('email-envoye').run();
      expect(mockAuth.resetPassword).toHaveBeenCalledWith('nab@example.test');
      await pressButton(root.findByProps({ testID: 'forgot-back-to-login' }));
      expect(mockNavigate).toHaveBeenLastCalledWith('Login');
      await pressText(root, 'Retour');
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('rejoindre une box : code, espace propriétaire, sans code, déconnexion', async () => {
      const root = await variant('rejoindre-une-box').run();
      await pressButton(root.findByProps({ testID: 'waiting-have-code' }));
      expect(mockNavigate).toHaveBeenLastCalledWith('JoinBox');
      await pressButton(root.findByProps({ testID: 'waiting-owner' }));
      expect(Linking.openURL).toHaveBeenCalled();
      await act(async () => { root.findByProps({ testID: 'waiting-no-code' }).props.onPress(); });
      expect(mockAuth.skipBox).toHaveBeenCalled();
      await act(async () => { root.findByProps({ testID: 'waiting-sign-out' }).props.onPress(); });
      expect(mockAuth.signOut).toHaveBeenCalled();
    });

    it('rejoins ta box : bouton inactif tant que le code n’a pas 6 caractères', async () => {
      const root = await variant('rejoins-ta-box').run();
      const submit = () => root.findByProps({ testID: 'join-submit' });
      expect(submit().props.disabled).toBe(true);
      await act(async () => { root.findByProps({ testID: 'join-code' }).props.onChangeText('abc123'); });
      expect(submit().props.disabled).toBe(false);
      await pressButton(submit());
      expect(mockAuth.joinBox).toHaveBeenCalledWith('ABC123');
    });

    it('tutoriel : « Passer » termine le tutoriel', async () => {
      const onDone = jest.fn();
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
      mockAuth.currentBox = null;
      const root = await mount(<OnboardingTutorialScreen onDone={onDone} />);
      expect(root.findAllByProps({ testID: 'tutorial-next' }).length).toBeGreaterThan(0);
      await act(async () => { await root.findByProps({ testID: 'tutorial-skip' }).props.onPress(); });
      expect(markOnboardingCompleted).toHaveBeenCalledWith('local');
      expect(mockAuth.skipBox).toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('amis vide : « Rechercher » ouvre l’onglet recherche', async () => {
      const root = await variant('amis-vide').run();
      await pressButton(button(root.findByProps({ testID: 'friends-empty' }), 'Rechercher'));
      expect(root.findAllByProps({ testID: 'friends-empty' })).toHaveLength(0);
    });

    it('annuler la réservation : « Oui » supprime la réservation, « Non » ne fait rien', async () => {
      let root = await variant('annuler-la-reservation').run();
      await pressButton(button(dialog(root), 'Non'));
      expect(mockCalls.filter((c) => c.method === 'delete')).toHaveLength(0);
      await unmount(); reset();
      root = await variant('annuler-la-reservation').run();
      await pressButton(button(dialog(root), 'Oui, annuler'));
      expect(mockCalls.filter((c) => c.table === 'class_reservations' && c.method === 'delete')).toHaveLength(1);
      expect(mockCalls).toContainEqual({ table: 'class_reservations', method: 'eq', args: ['id', 'r1'] });
      expect(cancelClassReminder).toHaveBeenCalledWith('s1');
    });
  });

  describe('R11 : conditions des états vides', () => {
    it('réservation : état vide sans box uniquement', async () => {
      let root = await variant('reservation-sans-box').run();
      expect(root.findAllByProps({ testID: 'reservation-no-box' }).length).toBeGreaterThan(0);
      await unmount(); reset();
      root = await mount(<ReservationScreen />);
      expect(root.findAllByProps({ testID: 'reservation-no-box' })).toHaveLength(0);
    });
    it('mes réservations : vide sans réservation, absent sinon', async () => {
      let root = await variant('mes-reservations-vide').run();
      expect(root.findAllByProps({ testID: 'my-reservations-empty' }).length).toBeGreaterThan(0);
      await unmount(); reset();
      mockTables.class_reservations = [RESERVATION];
      root = await mount(<MyReservationsScreen />);
      expect(root.findAllByProps({ testID: 'my-reservations-empty' })).toHaveLength(0);
    });
    it('messages : état vide sans box uniquement', async () => {
      let root = await variant('messages-sans-box').run();
      expect(root.findAllByProps({ testID: 'messages-no-box' }).length).toBeGreaterThan(0);
      await unmount(); reset();
      root = await mount(<MessagesScreen />);
      expect(root.findAllByProps({ testID: 'messages-no-box' })).toHaveLength(0);
    });
    it('mini-tournois et tournois : mêmes conditions dans la source', () => {
      const src = fs.readFileSync(path.join(R, 'screens/competition/CompetitionScreen.tsx'), 'utf8').replace(/\s+/g, ' ');
      expect(src).toContain("miniTournaments.length === 0 ? ( <EmptyState testID=\"competition-no-mini\"");
      expect(src).toContain("tournaments.length === 0 ? ( <EmptyState testID=\"competition-no-tournament\"");
    });
    it('réservation : semaine vide sous la même condition', () => {
      const src = fs.readFileSync(path.join(R, 'screens/reservation/ReservationScreen.tsx'), 'utf8').replace(/\s+/g, ' ');
      expect(src).toContain('{dayItems.length === 0 && ( <EmptyState testID="reservation-empty-week"');
    });
  });

  describe('R11 : conditions des fenêtres', () => {
    it('aucune fenêtre ouverte au montage', async () => {
      const root = await variant('mes-reservations-vide').run();
      expect(root.findAllByProps({ testID: 'confirm-dialog' })).toHaveLength(0);
    });
    it('réservation confirmée → « Annuler la réservation », liste d’attente → « Quitter la liste d’attente »', async () => {
      let root = await variant('annuler-la-reservation').run();
      expect(normalize(textsOfAll(dialog(root)))[0]).toBe(normalize([i18nT('reservation.cancelReservationTitle')])[0]);
      await unmount(); reset();
      root = await variant('quitter-la-liste-d-attente').run();
      expect(normalize(textsOfAll(dialog(root)))[0]).toBe(normalize([i18nT('reservation.leaveWaitlistTitle')])[0]);
    });
  });

  describe.each(THEMES)('R11 : couleurs et typographies clés (thème %s)', (_name, theme) => {
    const c = theme.ax;
    it('entrée : champs AxTextField, une seule action accent, liens labelSmall accentText', async () => {
      for (const name of ['connexion', 'creer-un-compte', 'mot-de-passe-oublie', 'rejoins-ta-box']) {
        mockTheme = theme;
        const root = await (async () => { const r = await variant(name).run(); return r; })();
        expect(root.findAllByType(AxTextField).length).toBeGreaterThan(0);
        expect(root.findAll((n) => String(n.type) === 'TextInput').length).toBe(root.findAllByType(AxTextField).length);
        expect(root.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent')).toHaveLength(1);
        await unmount(); reset();
      }
    });
    it('connexion : liens en labelSmall accentText, contraste AA', async () => {
      const root = await mount(<LoginScreen navigation={{ navigate: mockNavigate } as never} />, theme);
      const link = flat(textNode(root, 'Mot de passe oublié ?'));
      expect(link.fontFamily).toBe(axTypography.labelSmall.fontFamily);
      expect(link.fontSize).toBe(axTypography.labelSmall.fontSize);
      expect(link.color).toBe(c.accentText);
      expect(contrast(c.accentText, c.background)).toBeGreaterThanOrEqual(4.5);
    });
    it('tutoriel : titre titleXL, texte body, « Suivant » accent, « Passer » texte accentText', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
      mockAuth.currentBox = null;
      const root = await mount(<OnboardingTutorialScreen onDone={jest.fn()} />, theme);
      const title = flat(textNode(root, i18nT('onboarding.slides.welcome.title')));
      expect(title.fontFamily).toBe(axTypography.titleXL.fontFamily);
      expect(title.fontSize).toBe(axTypography.titleXL.fontSize);
      expect(title.color).toBe(c.text);
      const body = flat(textNode(root, i18nT('onboarding.slides.welcome.description')));
      expect(body.fontSize).toBe(axTypography.body.fontSize);
      expect(body.color).toBe(c.textMuted);
      expect(root.findByProps({ testID: 'tutorial-next' }).props.variant ?? 'accent').toBe('accent');
      const skip = flat(textNode(root, i18nT('onboarding.tutorial.skip')));
      expect(skip.color).toBe(c.accentText);
      expect(skip.fontFamily).toBe(axTypography.labelSmall.fontFamily);
      expect(root.findAll((n) => n.props.testID === undefined && String(n.type) === 'View' && flat(n).height === 8 && flat(n).backgroundColor === c.accentText)).toHaveLength(5);
    });
    it('état vide : icône Lucide, titre titleM text, texte bodySmall textMuted, action AxButton', async () => {
      const root = await mount(<FriendsScreen />, theme);
      const box = root.findByProps({ testID: 'friends-empty' });
      expect(box.findByType(Users).props.color).toBe(c.textMuted);
      const [title, text] = box.findAll((n) => isHostText(n) && !n.parent?.props.accessibilityRole);
      expect(flat(title)).toMatchObject({ fontFamily: axTypography.titleM.fontFamily, fontSize: axTypography.titleM.fontSize, color: c.text });
      expect(flat(text)).toMatchObject({ fontFamily: axTypography.bodySmall.fontFamily, fontSize: axTypography.bodySmall.fontSize, color: c.textMuted });
      expect(box.findAllByType(AxButton)).toHaveLength(1);
      expect(contrast(c.textMuted, c.surface)).toBeGreaterThanOrEqual(4.5);
    });
    it('fenêtre : AxCard centrée sur voile sombre, titre titleM, texte bodySmall, « Oui » stop, « Non » outline', async () => {
      mockTheme = theme;
      mockTables.class_reservations = [RESERVATION];
      const root = await mount(<MyReservationsScreen />, theme);
      await pressText(root, 'Annuler');
      const veil = flat(root.findByProps({ testID: 'confirm-dialog-veil' }));
      expect(veil).toMatchObject({ backgroundColor: axVeil.background, justifyContent: 'center', alignItems: 'center' });
      const card = dialog(root);
      expect(card.type).toBe(AxCard);
      const [title, text] = card.findAll((n) => isHostText(n) && !n.parent?.props.accessibilityRole);
      expect(flat(title)).toMatchObject({ fontFamily: axTypography.titleM.fontFamily, fontSize: axTypography.titleM.fontSize, color: c.text });
      expect(flat(text)).toMatchObject({ fontFamily: axTypography.bodySmall.fontFamily, fontSize: axTypography.bodySmall.fontSize, color: c.textMuted });
      expect(button(card, 'Oui, annuler').props.variant).toBe('stop');
      expect(button(card, 'Non').props.variant).toBe('outline');
    });
    it('fenêtre informative : action unique en accent', async () => {
      mockTheme = theme;
      const root = await variant('creer-un-compte-mail-a-confirmer').run();
      expect(button(dialog(root), 'OK').props.variant).toBe('accent');
    });
  });

  describe('R11 : textes longs sans débordement à 390 px', () => {
    it.each(VARIANTS.map((v) => v.name))('%s', async (name) => {
      const root = await variant(name).run();
      const page = Dimensions.get('window').width;
      const wide = root.findAll((n) => typeof n.type === 'string' && [flat(n).width, flat(n).minWidth].some((w) => typeof w === 'number' && w > 390 && w !== page));
      expect(wide).toHaveLength(0);
      const hostParent = (n: ReactTestInstance) => {
        let p = n.parent;
        while (p && typeof p.type !== 'string') p = p.parent;
        return p;
      };
      const scope = root.findAllByProps({ testID: 'confirm-dialog' })[0] ?? root;
      const rowsWithRigidText = scope.findAll((n) => isHostText(n) && typeof n.type === 'string')
        .filter((t) => { const p = hostParent(t); return !!p && flat(p).flexDirection === 'row'; })
        .filter((t) => hostText(t).length > 12 && !(flat(t).flexShrink || flat(t).flex));
      expect(rowsWithRigidText.map(hostText)).toEqual([]);
      const long = structure(root).filter((x) => x.includes(LONG_USER));
      for (const x of long) expect(root.findAll((n) => isHostText(n) && hostText(n) === x).every((n) => !n.props.numberOfLines || n.props.ellipsizeMode !== 'clip')).toBe(true);
    }, 20_000);
  });
}

function textsOfAll(n: ReactTestInstance): string[] { const out: string[] = []; textsOf(n, out); return out; }
function i18nT(key: string): string { return i18n.t(key); }
