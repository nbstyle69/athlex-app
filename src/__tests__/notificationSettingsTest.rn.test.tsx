/**
 * Profil → Notifications : le bouton « Tester les notifications » enregistre le
 * jeton puis programme une notification locale, et affiche son résultat sous le
 * bouton (jamais de fenêtre, jamais le jeton). L'écran est traduit.
 */
import React from 'react';
import { Alert, Linking, StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { darkTheme, lightTheme } from '../theme/palette';
import i18n from '../i18n';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';

const TOKEN = 'ExponentPushToken[JETON-EXEMPLE-0123456789abcdef]';
let mockToken: string | null = TOKEN;
let mockTheme = darkTheme;
const mockSaveToken = jest.fn(async (..._a: unknown[]) => {});
const mockSchedule = jest.fn(async (..._a: unknown[]) => 'id-test');

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../navigation/tabBarLayout', () => ({ useTabBarScrollSpace: () => 92 }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../components/glass/GlassBackground', () => () => null);
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  scheduleNotificationAsync: (...a: unknown[]) => mockSchedule(...a),
}));
jest.mock('../services/notifications', () => ({
  DEFAULT_NOTIFICATION_PREFS: jest.requireActual('../services/notificationPrefsCache').DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs: async () => jest.requireActual('../services/notificationPrefsCache').DEFAULT_NOTIFICATION_PREFS,
  saveNotificationPrefs: jest.fn(async () => {}),
  registerForPushNotifications: async () => mockToken,
  savePushToken: (...a: unknown[]) => mockSaveToken(...a),
}));

const texteDe = (n: ReactTestInstance): string => {
  const c = n.props.children;
  return (Array.isArray(c) ? c : [c]).filter((x) => typeof x === 'string').join('');
};
const textes = (root: ReactTestInstance) => root.findAllByType(Text).map(texteDe).filter((s) => s.trim());
const byId = (root: ReactTestInstance, id: string) => root.find((n) => n.props.testID === id && typeof n.type !== 'string');
const couleur = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style)?.color;

let r: TestRenderer.ReactTestRenderer | null = null;
async function monter() {
  await act(async () => { r = TestRenderer.create(<NotificationSettingsScreen />); });
  await act(async () => {});
  return r!.root;
}
async function tester(root: ReactTestInstance) {
  await act(async () => { byId(root, 'notif-test-push').props.onPress(); });
  await act(async () => {});
}

let alertSpy: jest.SpyInstance;
let settingsSpy: jest.SpyInstance;
beforeEach(async () => {
  mockToken = TOKEN;
  mockTheme = darkTheme;
  mockSaveToken.mockClear();
  mockSchedule.mockClear();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  settingsSpy = jest.spyOn(Linking, 'openSettings').mockImplementation(async () => {});
  await i18n.changeLanguage('fr');
});
afterEach(async () => {
  await act(async () => { r?.unmount(); });
  r = null;
  jest.restoreAllMocks();
});

describe('Tester les notifications', () => {
  it.each([['sombre', darkTheme], ['clair', lightTheme]])('permission accordée : jeton enregistré, notification locale, message succès (%s)', async (_n, th) => {
    mockTheme = th;
    const root = await monter();
    await tester(root);
    expect(mockSaveToken).toHaveBeenCalledWith('me', TOKEN);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledWith({
      content: { title: 'Notification de test', body: "Tout fonctionne : tu recevras les notifications d'AthleX.", sound: 'default' },
      trigger: { type: 'timeInterval', seconds: 3 },
    });
    const msg = byId(root, 'notif-test-ready');
    expect(texteDe(msg)).toBe('Ton téléphone est prêt. Une notification de test va arriver.');
    expect(couleur(msg)).toBe(th.ax.success);
    expect(alertSpy).not.toHaveBeenCalled();
    const tout = textes(root).join('\n');
    expect(tout).not.toContain('JETON-EXEMPLE');
    expect(tout).not.toMatch(/token|jeton/i);
    expect(tout).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(root.findAll((n) => n.props.testID === 'notif-test-denied')).toHaveLength(0);
  });

  it('permission refusée : message alerte, lien vers les réglages, aucune notification', async () => {
    mockToken = null;
    const root = await monter();
    await tester(root);
    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    const bloc = byId(root, 'notif-test-denied');
    const [msg] = bloc.findAllByType(Text);
    expect(texteDe(msg)).toBe("Notifications désactivées pour AthleX. Active-les dans les réglages de ton téléphone.");
    expect(couleur(msg)).toBe(darkTheme.ax.warning);
    const lien = byId(root, 'notif-test-open-settings');
    expect(texteDe(lien)).toBe('Ouvrir les réglages');
    await act(async () => { lien.props.onPress(); });
    expect(settingsSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(root.findAll((n) => n.props.testID === 'notif-test-ready')).toHaveLength(0);
  });

  it('bouton désactivé pendant le traitement', async () => {
    let finir!: (v: string | null) => void;
    const svc = jest.requireMock('../services/notifications');
    const orig = svc.registerForPushNotifications;
    svc.registerForPushNotifications = () => new Promise((r) => { finir = r; });
    try {
      const root = await monter();
      await act(async () => { byId(root, 'notif-test-push').props.onPress(); });
      expect(byId(root, 'notif-test-push').props.disabled).toBe(true);
      await act(async () => { finir(TOKEN); });
      await act(async () => {});
      expect(byId(root, 'notif-test-push').props.disabled).toBe(false);
    } finally {
      svc.registerForPushNotifications = orig;
    }
  });
});

describe('écran traduit', () => {
  it('rendu en anglais', async () => {
    await i18n.changeLanguage('en');
    const root = await monter();
    const tout = textes(root);
    for (const s of ['All notifications', 'Daily reminder', 'Training reminder', 'Reminder time', 'Reminders', 'Social', 'Training',
      'Competition', 'Box announcements', 'Score reminder (6 pm)', 'Friend requests', 'Announcements']) {
      expect(tout).toContain(s);
    }
    expect(byId(root, 'notif-test-push').props.label).toBe('Test notifications');
    expect(tout.join('\n')).not.toMatch(/Rappel|Toutes les|Entraînement|Annonces/);
    await tester(root);
    expect(texteDe(byId(root, 'notif-test-ready'))).toBe('Your phone is ready. A test notification is on its way.');
    expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({ title: 'Test notification', body: "Everything works: you'll receive AthleX notifications." }),
    }));
  });

  it('refus en anglais : message et lien', async () => {
    await i18n.changeLanguage('en');
    mockToken = null;
    const root = await monter();
    await tester(root);
    expect(texteDe(byId(root, 'notif-test-denied').findAllByType(Text)[0])).toBe('Notifications are turned off for AthleX. Turn them on in your phone settings.');
    expect(texteDe(byId(root, 'notif-test-open-settings'))).toBe('Open settings');
  });

  it('les clés notifSettings ont la même forme en FR et en EN, sans emoji', () => {
    const fr = require('../i18n/locales/fr.json').notifSettings;
    const en = require('../i18n/locales/en.json').notifSettings;
    const cles = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? cles(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(cles(en).sort()).toEqual(cles(fr).sort());
    expect(JSON.stringify([fr, en])).not.toMatch(/\p{Extended_Pictographic}|crossfit|hyrox/iu);
  });
});
