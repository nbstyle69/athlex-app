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

import { pushLanguage } from '../i18n';
import { savePushToken, refreshPushTokenLanguage, removePushToken } from '../services/notifications';

const langue = (code: string | null) => { mockLocales = [{ languageCode: code }]; };

describe('pushLanguage : langue principale du téléphone, fr ou en', () => {
  it.each([
    ['fr', 'fr'], ['FR', 'fr'], ['en', 'en'], ['de', 'en'], ['es', 'en'], [null, 'en'],
  ])('%s → %s', (code, attendu) => {
    langue(code);
    expect(pushLanguage()).toBe(attendu);
  });

  it('ne prend que la langue principale', () => {
    mockLocales = [{ languageCode: 'de' }, { languageCode: 'fr' }];
    expect(pushLanguage()).toBe('en');
  });
});

describe('jeton de notification enregistré avec la langue', () => {
  beforeEach(async () => {
    mockUpsert.mockClear();
    await removePushToken('u0');
  });

  it("l'enregistrement du jeton porte la langue du téléphone", async () => {
    langue('en');
    await savePushToken('u1', 'ExponentPushToken[a]');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ user_id: 'u1', token: 'ExponentPushToken[a]', language: 'en' });
  });

  it("à l'ouverture de l'app, rien n'est réécrit si la langue n'a pas changé", async () => {
    langue('fr');
    await savePushToken('u1', 'ExponentPushToken[a]');
    mockUpsert.mockClear();
    await refreshPushTokenLanguage();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("à l'ouverture de l'app, la nouvelle langue est enregistrée si elle a changé", async () => {
    langue('fr');
    await savePushToken('u1', 'ExponentPushToken[a]');
    mockUpsert.mockClear();
    langue('it');
    await refreshPushTokenLanguage();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ user_id: 'u1', token: 'ExponentPushToken[a]', language: 'en' });
  });

  it('après déconnexion, plus rien n\'est réécrit', async () => {
    langue('fr');
    await savePushToken('u1', 'ExponentPushToken[a]');
    await removePushToken('u1');
    mockUpsert.mockClear();
    langue('en');
    await refreshPushTokenLanguage();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
