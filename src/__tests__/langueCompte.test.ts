/**
 * Langue du compte enregistrée pour le serveur (#531, migration 20270161) :
 * notification_preferences.language (lue par langues_destinataires) et
 * user_metadata.language (modèles d'e-mail Auth), écrites au choix de langue
 * et au démarrage si elles diffèrent. Jamais bloquant : un échec est journalisé
 * sans donnée personnelle, et le démarrage suivant réessaie.
 */
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'fr' }] }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

type Resultat = { error: unknown };
const mockDb = {
  // Ligne de notification_preferences lue au démarrage (null : aucune ligne).
  row: null as Record<string, unknown> | null,
  selectError: null as unknown,
  upsertError: null as unknown,
  upserts: [] as { row: Record<string, unknown>; opts: unknown }[],
};
const mockAuth = {
  session: null as { user: { id: string; user_metadata: Record<string, unknown> } } | null,
  getSessionThrows: false,
  updateUser: jest.fn(async (_attrs: unknown): Promise<Resultat> => ({ error: null })),
};

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn(async (row: Record<string, unknown>, opts: unknown) => {
        mockDb.upserts.push({ row, opts });
        return { error: mockDb.upsertError };
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mockDb.selectError ? null : mockDb.row, error: mockDb.selectError }),
        }),
      }),
    })),
    auth: {
      getSession: jest.fn(async () => {
        if (mockAuth.getSessionThrows) throw new Error('réseau');
        return { data: { session: mockAuth.session } };
      }),
      updateUser: (attrs: unknown) => mockAuth.updateUser(attrs),
    },
  },
}));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

import i18n, { setLanguage } from '../i18n';
import { syncAccountLanguage, saveNotificationPrefs } from '../services/notifications';
import { captureError } from '../lib/sentry';

const connecte = (metaLanguage?: string) => {
  mockAuth.session = { user: { id: 'u1', user_metadata: metaLanguage ? { language: metaLanguage } : {} } };
};
const ecrituresLangue = () => mockDb.upserts.filter(u => 'language' in u.row);

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  mockDb.row = null;
  mockDb.selectError = null;
  mockDb.upsertError = null;
  mockDb.upserts = [];
  mockAuth.session = null;
  mockAuth.getSessionThrows = false;
  mockAuth.updateUser.mockClear();
  mockAuth.updateUser.mockImplementation(async () => ({ error: null }));
  (captureError as jest.Mock).mockClear();
});

describe('au choix de langue (setLanguage)', () => {
  it('écrit la langue du compte et la métadonnée Auth', async () => {
    connecte('fr');
    await setLanguage('en');
    expect(mockDb.upserts).toEqual([{ row: { user_id: 'u1', language: 'en' }, opts: { onConflict: 'user_id' } }]);
    expect(mockAuth.updateUser).toHaveBeenCalledTimes(1);
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ data: { language: 'en' } });
  });

  it('ne réécrit pas la métadonnée Auth si elle est déjà à jour', async () => {
    connecte('en');
    await setLanguage('en');
    expect(ecrituresLangue()).toHaveLength(1);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it("n'écrit rien déconnecté", async () => {
    await setLanguage('en');
    expect(mockDb.upserts).toHaveLength(0);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });
});

describe('au démarrage, une fois connecté (syncAccountLanguage)', () => {
  it("n'écrit rien quand la base et la métadonnée ont déjà la langue de l'app", async () => {
    await i18n.changeLanguage('en');
    connecte('en');
    mockDb.row = { language: 'en' };
    await syncAccountLanguage('u1');
    expect(mockDb.upserts).toHaveLength(0);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ['une autre langue', { language: 'fr' }],
    ['une langue jamais écrite', { language: null }],
    ['aucune ligne', null],
  ])('écrit la langue quand la base a %s', async (_cas, row) => {
    await i18n.changeLanguage('en');
    connecte('en');
    mockDb.row = row;
    await syncAccountLanguage('u1');
    expect(mockDb.upserts).toEqual([{ row: { user_id: 'u1', language: 'en' }, opts: { onConflict: 'user_id' } }]);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it("écrit seulement la métadonnée quand elle seule diffère", async () => {
    connecte();
    mockDb.row = { language: 'fr' };
    await syncAccountLanguage('u1');
    expect(mockDb.upserts).toHaveLength(0);
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ data: { language: 'fr' } });
  });
});

describe('préférences et langue ne se touchent pas', () => {
  it("l'écriture de langue n'envoie que user_id et language", async () => {
    connecte();
    await setLanguage('en');
    expect(ecrituresLangue().map(u => Object.keys(u.row).sort())).toEqual([['language', 'user_id']]);
  });

  it("l'enregistrement des préférences n'envoie pas language", async () => {
    connecte();
    await saveNotificationPrefs('u1', { daily_reminder: false });
    expect(mockDb.upserts).toHaveLength(1);
    expect(mockDb.upserts[0].row).toMatchObject({ user_id: 'u1', daily_reminder: false });
    expect(mockDb.upserts[0].row).not.toHaveProperty('language');
  });
});

describe('échec silencieux, nouvel essai au démarrage suivant', () => {
  it("un refus de la base ne bloque pas setLanguage, et le journal n'a aucun identifiant", async () => {
    connecte('fr');
    mockDb.upsertError = { message: 'refus' };
    mockAuth.updateUser.mockImplementation(async () => ({ error: { message: 'refus' } }));
    await expect(setLanguage('en')).resolves.toBeUndefined();
    expect(i18n.language).toBe('en');
    const journaux = (captureError as jest.Mock).mock.calls;
    expect(journaux.map(c => c[1].action)).toEqual(['saveAccountLanguage', 'saveAccountLanguageMetadata']);
    expect(JSON.stringify(journaux.map(c => c[1]))).not.toContain('u1');
  });

  it('une session illisible ne bloque pas setLanguage', async () => {
    mockAuth.getSessionThrows = true;
    await expect(setLanguage('en')).resolves.toBeUndefined();
    expect(mockDb.upserts).toHaveLength(0);
  });

  it("au démarrage, une lecture impossible n'écrit rien et ne lève pas", async () => {
    connecte();
    mockDb.selectError = { message: 'hors ligne' };
    await expect(syncAccountLanguage('u1')).resolves.toBeUndefined();
    expect(mockDb.upserts).toHaveLength(0);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
    expect(JSON.stringify((captureError as jest.Mock).mock.calls.map(c => c[1]))).not.toContain('u1');
  });

  it('après un échec, le démarrage suivant réécrit', async () => {
    await i18n.changeLanguage('en');
    connecte('en');
    mockDb.row = { language: 'fr' };
    mockDb.upsertError = { message: 'refus' };
    await syncAccountLanguage('u1');
    mockDb.upsertError = null;
    await syncAccountLanguage('u1');
    expect(ecrituresLangue()).toHaveLength(2);
  });
});
