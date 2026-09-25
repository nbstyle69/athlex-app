import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildMessages, resolvePrefKey, serverOnlyType, type Recipient,
} from '../../supabase/functions/send-push/regles';

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';

const fr = { user_id: U1, title: 'Abonnement arrêté', body: 'Box Test a arrêté ton abonnement aujourd\'hui.', data: { type: 'membership_stopped' } };
const deuxLangues: Recipient = { ...fr, en: { title: 'Membership stopped', body: 'Box Test stopped your membership today.' } };

const jetons = [
  { token: 'ExponentPushToken[fr]', user_id: U1, language: 'fr' },
  { token: 'ExponentPushToken[en]', user_id: U1, language: 'en' },
  { token: 'ExponentPushToken[sans]', user_id: U1, language: null },
  { token: 'ExponentPushToken[ancien]', user_id: U1 },
];
const parJeton = (msgs: ReturnType<typeof buildMessages>) =>
  Object.fromEntries(msgs.map((m) => [m.to, `${m.title} | ${m.body}`]));

describe('send-push : langue par jeton', () => {
  it('une seule version : elle part à tous les jetons, quelle que soit leur langue', () => {
    const msgs = buildMessages(jetons, new Map([[U1, fr]]));
    expect(msgs).toHaveLength(4);
    expect(new Set(msgs.map((m) => m.title))).toEqual(new Set([fr.title]));
    expect(new Set(msgs.map((m) => m.body))).toEqual(new Set([fr.body]));
  });

  it('deux versions : chaque jeton reçoit la sienne, un jeton sans langue le français', () => {
    expect(parJeton(buildMessages(jetons, new Map([[U1, deuxLangues]])))).toEqual({
      'ExponentPushToken[fr]': 'Abonnement arrêté | Box Test a arrêté ton abonnement aujourd\'hui.',
      'ExponentPushToken[en]': 'Membership stopped | Box Test stopped your membership today.',
      'ExponentPushToken[sans]': 'Abonnement arrêté | Box Test a arrêté ton abonnement aujourd\'hui.',
      'ExponentPushToken[ancien]': 'Abonnement arrêté | Box Test a arrêté ton abonnement aujourd\'hui.',
    });
  });

  it('les données et les destinataires sont inchangés', () => {
    const msgs = buildMessages(
      [...jetons, { token: 'ExponentPushToken[autre]', user_id: U2, language: 'en' }, { token: null, user_id: U1, language: 'en' }],
      new Map([[U1, deuxLangues]]),
    );
    expect(msgs.map((m) => m.to)).toEqual(jetons.map((t) => t.token));
    expect(msgs.every((m) => m.data.type === 'membership_stopped' && m.sound === 'default')).toBe(true);
  });
});

describe('send-push : le handler passe par ces règles', () => {
  const src = readFileSync(join(__dirname, '../../supabase/functions/send-push/index.ts'), 'utf8');
  it('lit la langue avec le jeton et construit les messages par buildMessages', () => {
    expect(src).toContain(".from('push_tokens').select('token, user_id, language')");
    expect(src).toContain('const messages = buildMessages(tokens, byUser);');
    expect(src).toContain('const prefKey = resolvePrefKey(body?.category, body?.pref_key, types);');
    expect(src).not.toMatch(/PREF_BY_TYPE\s*[:=]/);
  });

  it('refuse un type réservé au serveur à un utilisateur connecté, en 403 SERVER_ONLY_TYPE', () => {
    expect(src).toContain('const reserve = isMachine ? null : serverOnlyType(body?.category, body?.pref_key, types);');
    expect(src).toContain("return json({ error: 'SERVER_ONLY_TYPE', type: reserve, sent: 0 }, 403);");
    // Le refus passe avant l'autorisation par relation et l'envoi.
    expect(src.indexOf("'SERVER_ONLY_TYPE'")).toBeLessThan(src.indexOf('await authorizeRecipients('));
  });
});

describe('send-push : types réservés au serveur', () => {
  it('membership_stopped est réservé, quelle que soit la façon de le demander', () => {
    expect(serverOnlyType(undefined, undefined, ['membership_stopped'])).toBe('membership_stopped');
    expect(serverOnlyType(undefined, undefined, ['wod_published', 'membership_stopped'])).toBe('membership_stopped');
    expect(serverOnlyType('membership_stopped', undefined, [])).toBe('membership_stopped');
    expect(serverOnlyType(undefined, 'membership_stopped', [])).toBe('membership_stopped');
  });

  it('les autres types, et la seule clé de préférence des annonces, ne sont pas réservés', () => {
    for (const t of ['wod_published', 'new_message', 'friend_request', 'tournament_closed', 'box_notification', 'elo_change']) {
      expect(serverOnlyType(undefined, undefined, [t])).toBeNull();
    }
    expect(serverOnlyType('box_announcements', undefined, ['box_notification'])).toBeNull();
    expect(serverOnlyType(undefined, undefined, [])).toBeNull();
  });
});

describe('send-push : catégorie', () => {
  it('membership_stopped est gouverné par les annonces de la box', () => {
    expect(resolvePrefKey(undefined, undefined, ['membership_stopped'])).toBe('box_announcements');
  });

  it('un type inconnu est refusé', () => {
    expect(resolvePrefKey(undefined, undefined, ['famille_inventee'])).toBeNull();
    expect(resolvePrefKey('bogus', undefined, ['membership_stopped'])).toBeNull();
  });

  it('les autres types ne changent pas', () => {
    expect(resolvePrefKey(undefined, undefined, ['wod_published'])).toBe('new_wod');
    expect(resolvePrefKey(undefined, undefined, ['box_notification'])).toBe('box_announcements');
    expect(resolvePrefKey(undefined, undefined, ['wod_published', 'new_message'])).toBeNull();
  });
});
