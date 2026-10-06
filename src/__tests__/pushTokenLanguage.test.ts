import AsyncStorage from '@react-native-async-storage/async-storage';

let mockLocales: { languageCode: string | null }[] = [{ languageCode: 'fr' }];
jest.mock('expo-localization', () => ({ getLocales: () => mockLocales }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
const mockUpsert = jest.fn(async (_row: Record<string, unknown>, _opts?: unknown) => ({ error: null }));
jest.mock('../lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ upsert: mockUpsert, delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) })) },
}));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

import i18n, { initLanguage, pushLanguage, setLanguage } from '../i18n';
import { savePushToken, refreshPushTokenLanguage, removePushToken } from '../services/notifications';

const telephone = (code: string | null) => { mockLocales = [{ languageCode: code }]; };

beforeEach(async () => {
  telephone('fr');
  await AsyncStorage.clear();
  await i18n.changeLanguage('fr');
});

describe("pushLanguage : langue de l'app, pas celle du téléphone", () => {
  it.each([['fr', 'fr'], ['en', 'en']])('app %s → %s', async (app, attendu) => {
    await i18n.changeLanguage(app);
    expect(pushLanguage()).toBe(attendu);
  });

  it('suit le choix du Profil, même si le téléphone est dans une autre langue', async () => {
    telephone('en');
    await setLanguage('fr');
    expect(pushLanguage()).toBe('fr');
    telephone('fr');
    await setLanguage('en');
    expect(pushLanguage()).toBe('en');
  });

  it("sans choix enregistré, suit la langue détectée au démarrage", async () => {
    telephone('en');
    await initLanguage();
    expect(pushLanguage()).toBe('en');
    telephone('de'); // langue non gérée : l'app démarre en français
    await initLanguage();
    expect(pushLanguage()).toBe('fr');
  });
});

describe('jeton de notification enregistré avec la langue', () => {
  beforeEach(async () => {
    await removePushToken('u0');
    mockUpsert.mockClear();
  });

  it("l'enregistrement du jeton porte la langue de l'app", async () => {
    telephone('fr');
    await i18n.changeLanguage('en');
    await savePushToken('u1', 'ExponentPushToken[a]');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ user_id: 'u1', token: 'ExponentPushToken[a]', language: 'en' });
  });

  it('changer de langue dans le Profil réenregistre le jeton', async () => {
    await savePushToken('u1', 'ExponentPushToken[a]');
    mockUpsert.mockClear();
    await setLanguage('en');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ user_id: 'u1', token: 'ExponentPushToken[a]', language: 'en' });
    mockUpsert.mockClear();
    await setLanguage('fr');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ language: 'fr' });
  });

  it('rechoisir la même langue ne réécrit rien', async () => {
    await savePushToken('u1', 'ExponentPushToken[a]');
    mockUpsert.mockClear();
    await setLanguage('fr');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("au retour au premier plan, rien n'est réécrit si la langue n'a pas changé", async () => {
    await savePushToken('u1', 'ExponentPushToken[a]');
    mockUpsert.mockClear();
    telephone('it'); // la langue du téléphone ne compte plus
    await refreshPushTokenLanguage();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("après déconnexion, un changement de langue ne réécrit rien", async () => {
    await savePushToken('u1', 'ExponentPushToken[a]');
    await removePushToken('u1');
    mockUpsert.mockClear();
    await setLanguage('en');
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
