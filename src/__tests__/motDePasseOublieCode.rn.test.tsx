/**
 * D6 : mot de passe oublié par code à 6 chiffres.
 * Écrans 2 et 3 montés avec un faux contexte d'authentification ; la séquence
 * verifyOtp → updateUser est vérifiée sur le vrai AuthProvider, Supabase simulé.
 */
import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme } from '../theme/palette';
import '../i18n';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordCodeScreen from '../screens/auth/ResetPasswordCodeScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAuth: Record<string, jest.Mock> = {};
let mockListener: (event: string, session: unknown) => void = () => {};
const mockSupabaseAuth: Record<string, jest.Mock> = {};
const mockRpc = jest.fn();

jest.mock('../context/AuthContext', () => ({
  ...jest.requireActual('../context/AuthContext'),
  useAuth: () => mockAuth,
}));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: jest.requireActual('../theme/palette').lightTheme, mode: 'light' }) }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn(), setUserContext: jest.fn(), clearUserContext: jest.fn() }));
jest.mock('../lib/analytics', () => ({
  identifyUser: jest.fn(), resetUser: jest.fn(), forgetUser: jest.fn(() => ({})), trackLogin: jest.fn(),
  trackSignUp: jest.fn(), trackBoxJoin: jest.fn(), trackDeleteAccount: jest.fn(),
}));
jest.mock('../services/gamification', () => ({ awardLevelBadge: jest.fn(async () => true) }));
jest.mock('../services/notifications', () => ({
  registerForPushNotifications: jest.fn(async () => null), savePushToken: jest.fn(), refreshPushTokenLanguage: jest.fn(async () => undefined),
  removePushToken: jest.fn(async () => undefined), scheduleDailyReminder: jest.fn(), scheduleScoreReminder: jest.fn(async () => undefined),
  getNotificationPrefs: jest.fn(async () => ({ daily_reminder: false })), clearCachedPrefs: jest.fn(async () => undefined),
  cancelAllLocalReminders: jest.fn(async () => undefined),
}));
jest.mock('../lib/supabase', () => {
  const builder = () => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'maybeSingle', 'single']) b[m] = () => b;
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
    return b;
  };
  return {
    supabase: {
      get auth() { return mockSupabaseAuth; },
      rpc: (...a: unknown[]) => mockRpc(...a),
      from: builder,
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: jest.fn(),
    },
  };
});

const EMAIL = 'nab@example.test';
let renderer: TestRenderer.ReactTestRenderer | undefined;
async function mount(el: React.ReactElement) {
  await act(async () => { renderer = TestRenderer.create(el); });
  return renderer!.root;
}
const byId = (root: ReactTestInstance, id: string) => root.findByProps({ testID: id });
const errorOf = (root: ReactTestInstance, id: string) => root.findAllByProps({ testID: `${id}-error` }).map((n) => n.props.children)[0];
const type = async (root: ReactTestInstance, id: string, v: string) => { await act(async () => { byId(root, id).props.onChangeText(v); }); };
const press = async (root: ReactTestInstance, id: string) => { await act(async () => { await byId(root, id).props.onPress(); }); };
const resendText = (root: ReactTestInstance) => byId(root, 'reset-resend').findByType(require('react-native').Text).props.children;
const codeScreen = () => mount(
  <ResetPasswordCodeScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never} route={{ params: { email: EMAIL } } as never} />,
);

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockAuth.resetPassword = jest.fn(async () => ({ error: null }));
  mockAuth.resetPasswordWithCode = jest.fn(async () => ({ error: null }));
});
afterEach(async () => {
  if (renderer) { const r = renderer; renderer = undefined; await act(async () => r.unmount()); }
  expect(alertSpy).not.toHaveBeenCalled();
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  jest.useRealTimers();
});

describe('écran 2 : demande du code', () => {
  it('ouvre l’écran du code après l’envoi, sans rien dire de l’existence du compte', async () => {
    const root = await mount(<ForgotPasswordScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never} />);
    await type(root, 'forgot-email', `  ${EMAIL} `);
    await press(root, 'forgot-submit');
    expect(mockAuth.resetPassword).toHaveBeenCalledWith(EMAIL);
    expect(mockNavigate).toHaveBeenCalledWith('ResetPasswordCode', { email: EMAIL });
  });

  it('e-mail vide ou invalide : message sous le champ, aucun envoi', async () => {
    const root = await mount(<ForgotPasswordScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never} />);
    await press(root, 'forgot-submit');
    expect(errorOf(root, 'forgot-email')).toBe('Saisis ton adresse email');
    await type(root, 'forgot-email', 'nab@example');
    await press(root, 'forgot-submit');
    expect(errorOf(root, 'forgot-email')).toBe("Adresse email invalide (vérifie qu'il n'y a pas d'espace)");
    expect(mockAuth.resetPassword).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('erreur d’envoi (réseau) : message existant sous le champ, on reste sur l’écran', async () => {
    mockAuth.resetPassword = jest.fn(async () => ({ error: 'Network request failed' }));
    const root = await mount(<ForgotPasswordScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never} />);
    await type(root, 'forgot-email', EMAIL);
    await press(root, 'forgot-submit');
    expect(errorOf(root, 'forgot-email')).toBe('Une erreur est survenue. Réessaie dans un instant.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('écran 3 : code et nouveau mot de passe', () => {
  it('« Renvoyer le code » grisé 60 s, puis actif ; un renvoi relance le décompte', async () => {
    jest.useFakeTimers();
    const root = await codeScreen();
    expect(resendText(root)).toBe('Renvoyer le code dans 60 s');
    expect(byId(root, 'reset-resend').props.disabled).toBe(true);
    for (let i = 0; i < 59; i++) await act(async () => { jest.advanceTimersByTime(1000); });
    expect(resendText(root)).toBe('Renvoyer le code dans 1 s');
    expect(byId(root, 'reset-resend').props.disabled).toBe(true);
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(resendText(root)).toBe('Renvoyer le code');
    expect(byId(root, 'reset-resend').props.disabled).toBe(false);
    await press(root, 'reset-resend');
    expect(mockAuth.resetPassword).toHaveBeenCalledWith(EMAIL);
    expect(resendText(root)).toBe('Renvoyer le code dans 60 s');
  });

  it('code collé avec espaces : seuls les 6 chiffres restent', async () => {
    const root = await codeScreen();
    await type(root, 'reset-code', '482 913');
    expect(byId(root, 'reset-code').props.value).toBe('482913');
    expect(byId(root, 'reset-code').props.keyboardType).toBe('number-pad');
    expect(byId(root, 'reset-code').props.textContentType).toBe('oneTimeCode');
    expect(byId(root, 'reset-code').props.autoComplete).toBe('sms-otp');
  });

  it('code incomplet : message sous le champ code, aucun appel', async () => {
    const root = await codeScreen();
    await type(root, 'reset-code', '48291');
    await type(root, 'reset-password', 'secret123');
    await type(root, 'reset-confirm', 'secret123');
    await press(root, 'reset-submit');
    expect(errorOf(root, 'reset-code')).toBe('Saisis les 6 chiffres du code.');
    expect(errorOf(root, 'reset-password')).toBeUndefined();
    expect(mockAuth.resetPasswordWithCode).not.toHaveBeenCalled();
  });

  it('mot de passe trop court : message sous le nouveau mot de passe', async () => {
    const root = await codeScreen();
    await type(root, 'reset-code', '482913');
    await type(root, 'reset-password', '12345');
    await type(root, 'reset-confirm', '12345');
    await press(root, 'reset-submit');
    expect(errorOf(root, 'reset-password')).toBe('Ton mot de passe doit contenir au moins 6 caractères.');
    expect(errorOf(root, 'reset-code')).toBeUndefined();
    expect(mockAuth.resetPasswordWithCode).not.toHaveBeenCalled();
  });

  it('mots de passe différents : message sous la confirmation', async () => {
    const root = await codeScreen();
    await type(root, 'reset-code', '482913');
    await type(root, 'reset-password', 'secret123');
    await type(root, 'reset-confirm', 'secret124');
    await press(root, 'reset-submit');
    expect(errorOf(root, 'reset-confirm')).toBe('Les mots de passe ne correspondent pas.');
    expect(errorOf(root, 'reset-password')).toBeUndefined();
    expect(mockAuth.resetPasswordWithCode).not.toHaveBeenCalled();
  });

  async function submitValid(result: Record<string, unknown>) {
    mockAuth.resetPasswordWithCode = jest.fn(async () => result);
    const root = await codeScreen();
    await type(root, 'reset-code', '482913');
    await type(root, 'reset-password', 'secret123');
    await type(root, 'reset-confirm', 'secret123');
    await press(root, 'reset-submit');
    expect(mockAuth.resetPasswordWithCode).toHaveBeenCalledWith(EMAIL, '482913', 'secret123');
    return root;
  }

  it('code invalide ou expiré : champ code en rouge, « Renvoyer le code » actif tout de suite', async () => {
    const root = await submitValid({ error: 'Token has expired or is invalid', step: 'code', network: false });
    expect(errorOf(root, 'reset-code')).toBe('Code invalide ou expiré. Demande un nouveau code.');
    expect(byId(root, 'reset-code-box').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderColor: lightTheme.ax.danger })]));
    expect(resendText(root)).toBe('Renvoyer le code');
    expect(byId(root, 'reset-resend').props.disabled).toBe(false);
  });

  it('erreur réseau : message existant, pas pris pour un code faux', async () => {
    const root = await submitValid({ error: 'Network request failed', step: 'code', network: true });
    expect(byId(root, 'reset-error').props.children).toBe('Une erreur est survenue. Réessaie dans un instant.');
    expect(errorOf(root, 'reset-code')).toBeUndefined();
  });

  it('refus du nouveau mot de passe : message sous le nouveau mot de passe', async () => {
    const root = await submitValid({ error: 'Password should be at least 6 characters.', step: 'password', network: false });
    expect(errorOf(root, 'reset-password')).toBe('Mot de passe trop court (6 caractères min)');
  });
});

describe('AuthContext : verifyOtp puis updateUser, sans ouvrir l’app avant la fin', () => {
  const { AuthProvider, useAuth: useRealAuth } = jest.requireActual('../context/AuthContext');
  const SESSION = { user: { id: 'u1' }, access_token: 'jeton-de-test' };
  let ctx: { session: unknown; user: unknown; resetPasswordWithCode: (e: string, c: string, p: string) => Promise<Record<string, unknown>> };
  function Probe() { ctx = useRealAuth(); return null; }
  let releaseUpdate: (r: unknown) => void;
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    mockRpc.mockReset().mockImplementation(async (name: string) => {
      calls.push(`rpc:${name}`);
      return name === 'get_my_profile' ? { data: [{ id: 'u1', username: 'nab' }], error: null } : { data: [], error: null };
    });
    Object.assign(mockSupabaseAuth, {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      getUser: jest.fn(async () => ({ data: { user: { email: EMAIL } } })),
      onAuthStateChange: jest.fn((cb) => { mockListener = cb; return { data: { subscription: { unsubscribe() {} } } }; }),
      verifyOtp: jest.fn(async () => { calls.push('verifyOtp'); mockListener('PASSWORD_RECOVERY', SESSION); return { data: { user: SESSION.user, session: SESSION }, error: null }; }),
      updateUser: jest.fn(() => { calls.push('updateUser'); return new Promise((r) => { releaseUpdate = r; }); }),
      signOut: jest.fn(async () => { calls.push('signOut'); mockListener('SIGNED_OUT', null); return { error: null }; }),
    });
  });

  async function start() {
    await mount(<AuthProvider><Probe /></AuthProvider>);
    let pending!: Promise<Record<string, unknown>>;
    await act(async () => { pending = ctx.resetPasswordWithCode(EMAIL, '482913', 'secret123'); });
    // Enveloppé : rendre la promesse telle quelle ferait attendre start() jusqu'à la fin d'updateUser.
    return { pending };
  }

  it('session ouverte par le code mais profil non chargé tant que updateUser n’a pas fini, puis Accueil connecté', async () => {
    const { pending } = await start();
    expect(mockSupabaseAuth.verifyOtp).toHaveBeenCalledWith({ email: EMAIL, token: '482913', type: 'recovery' });
    expect(mockSupabaseAuth.updateUser).toHaveBeenCalledWith({ password: 'secret123' });
    expect(calls).toEqual(['verifyOtp', 'updateUser']);
    // La navigation n'ouvre les onglets que si session ET profil : ici le profil reste vide.
    expect(ctx.session).toBe(SESSION);
    expect(ctx.user).toBeNull();
    await act(async () => { mockListener('USER_UPDATED', SESSION); releaseUpdate({ data: { user: SESSION.user }, error: null }); await pending; });
    expect(await pending).toEqual({ error: null });
    expect(calls).toEqual(['verifyOtp', 'updateUser', 'rpc:get_my_profile', 'rpc:get_my_admin_boxes']);
    expect(ctx.user).toEqual(expect.objectContaining({ id: 'u1', email: EMAIL }));
  });

  it('updateUser refusé : signOut, aucune session ni profil, erreur rendue à l’écran', async () => {
    const { pending } = await start();
    await act(async () => { releaseUpdate({ data: { user: null }, error: { message: 'New password should be different from the old password.' } }); await pending; });
    expect(await pending).toEqual(expect.objectContaining({ step: 'password', network: false }));
    expect(calls).toEqual(['verifyOtp', 'updateUser', 'signOut']);
    expect(ctx.session).toBeNull();
    expect(ctx.user).toBeNull();
  });

  it('code refusé : ni updateUser ni session', async () => {
    mockSupabaseAuth.verifyOtp = jest.fn(async () => { calls.push('verifyOtp'); return { data: { user: null, session: null }, error: { message: 'Token has expired or is invalid' } }; });
    await mount(<AuthProvider><Probe /></AuthProvider>);
    let result!: Record<string, unknown>;
    await act(async () => { result = await ctx.resetPasswordWithCode(EMAIL, '000000', 'secret123'); });
    expect(result).toEqual(expect.objectContaining({ step: 'code', network: false }));
    expect(calls).toEqual(['verifyOtp']);
  });
});
