/**
 * Annonces de la box : la box active que connaît le vrai AuthProvider est celle
 * que le gestionnaire du toucher compare au box_id de la notification, y compris
 * après un changement de box. Supabase simulé, données fictives, aucun réseau.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import '../i18n';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { routeNotification } from '../services/notificationRouter';
import { navigationRef } from '../navigation/navigationRef';

jest.mock('../navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true), dispatch: jest.fn() },
}));
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
  const BOXES = [
    { box_id: 'b1', role: 'member', boxes: { id: 'b1', name: 'Box Une', owner_id: 'u9' } },
    { box_id: 'b2', role: 'member', boxes: { id: 'b2', name: 'Box Deux', owner_id: 'u8' } },
  ];
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single']) b[m] = () => b;
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: table === 'box_members' ? BOXES : [], error: null }).then(res);
    return b;
  };
  const session = { user: { id: 'me', email: 'moi@example.test' } };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session } }),
        getUser: async () => ({ data: { user: session.user } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      rpc: async (fn: string) => ({ data: fn === 'get_my_profile' ? [{ id: 'me', username: 'Moi', role: 'athlete', level: 'rx' }] : [], error: null }),
      from: builder,
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: jest.fn(),
    },
  };
});

const dispatch = navigationRef.dispatch as jest.Mock;
let auth: ReturnType<typeof useAuth>;
function Sonde() { auth = useAuth(); return null; }

let renderer: TestRenderer.ReactTestRenderer | undefined;
afterEach(async () => {
  if (renderer) { const r = renderer; renderer = undefined; await act(async () => r.unmount()); }
});

/** Ouvre-t-on l'écran Annonces pour une notification de cette box ? */
function ouvreAnnonces(boxId: string) {
  dispatch.mockClear();
  routeNotification({ type: 'box_notification', box_id: boxId });
  return dispatch.mock.calls.some(([a]) => a?.payload?.params?.screen === 'Annonces');
}

it('la box active d’AuthContext est celle comparée au box_id de la notification, changement de box compris', async () => {
  await act(async () => { renderer = TestRenderer.create(<AuthProvider><Sonde /></AuthProvider>); });
  for (let i = 0; i < 10 && auth.currentBox?.id !== 'b1'; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
  expect(auth.currentBox?.id).toBe('b1');
  expect(ouvreAnnonces('b1')).toBe(true);
  expect(ouvreAnnonces('b2')).toBe(false);

  await act(async () => { await auth.switchBox('b2'); });
  expect(auth.currentBox?.id).toBe('b2');
  expect(ouvreAnnonces('b2')).toBe(true);
  expect(ouvreAnnonces('b1')).toBe(false);
});
