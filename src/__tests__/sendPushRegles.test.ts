import { readFileSync } from 'fs';
import { join } from 'path';
import {
  boxCoveringAll, buildMessages, resolvePrefKey, SERVER_ONLY_CATEGORIES, serverOnlyType, STAFF_ONLY_CATEGORIES,
  type Recipient,
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

  it('refuse la catégorie des annonces à un utilisateur connecté, sur la catégorie résolue, en 403 SERVER_ONLY_CATEGORY', () => {
    expect(src).toContain('if (!isMachine && SERVER_ONLY_CATEGORIES.has(prefKey)) {');
    expect(src).toContain("return json({ error: 'SERVER_ONLY_CATEGORY', category: prefKey, sent: 0 }, 403);");
    expect(src.indexOf("'SERVER_ONLY_CATEGORY'")).toBeGreaterThan(src.indexOf('const prefKey = resolvePrefKey('));
    expect(src.indexOf("'SERVER_ONLY_CATEGORY'")).toBeLessThan(src.indexOf('await authorizeRecipients('));
  });
});

describe('send-push : types réservés au serveur', () => {
  it('membership_stopped est réservé, quelle que soit la façon de le demander', () => {
    expect(serverOnlyType(undefined, undefined, ['membership_stopped'])).toBe('membership_stopped');
    expect(serverOnlyType(undefined, undefined, ['wod_published', 'membership_stopped'])).toBe('membership_stopped');
    expect(serverOnlyType('membership_stopped', undefined, [])).toBe('membership_stopped');
    expect(serverOnlyType(undefined, 'membership_stopped', [])).toBe('membership_stopped');
  });

  it.each(['box_notification', 'elo_change'])('%s est réservé aussi, aux trois endroits', (t) => {
    expect(serverOnlyType(undefined, undefined, [t])).toBe(t);
    expect(serverOnlyType(undefined, undefined, ['new_message', t])).toBe(t);
    expect(serverOnlyType(t, undefined, [])).toBe(t);
    expect(serverOnlyType(undefined, t, [])).toBe(t);
  });

  it('les autres types, et les clés de préférence, ne sont pas réservés', () => {
    for (const t of ['wod_published', 'new_message', 'friend_request', 'score_overtaken', 'tournament_closed',
      'tournament_started', 'inter_competition_closed', 'inter_bracket_result', 'inter_bracket_match']) {
      expect(serverOnlyType(undefined, undefined, [t])).toBeNull();
    }
    expect(serverOnlyType('box_announcements', undefined, [])).toBeNull();
    expect(serverOnlyType(undefined, 'elo_updates', [])).toBeNull();
    expect(serverOnlyType(undefined, undefined, [])).toBeNull();
  });
});

describe('send-push : catégories réservées au serveur', () => {
  // La règle porte sur la catégorie résolue : toute demande qui aboutit aux annonces est visée.
  const reservee = (category: unknown, prefKey: unknown, types: string[]) => {
    const k = resolvePrefKey(category, prefKey, types);
    return k !== null && SERVER_ONLY_CATEGORIES.has(k);
  };

  it('les annonces de la box, par category ou pref_key, avec ou sans type', () => {
    expect(reservee('box_announcements', undefined, [])).toBe(true);
    expect(reservee(undefined, 'box_announcements', [])).toBe(true);
    expect(reservee('box_announcements', undefined, ['new_message'])).toBe(true);
    expect(reservee(undefined, 'box_announcements', ['wod_published'])).toBe(true);
    expect(reservee(undefined, undefined, ['box_notification'])).toBe(true);
  });

  it("aucune des catégories qu'atteignent les envois de l'app", () => {
    for (const t of ['wod_published', 'new_message', 'friend_request', 'friend_accepted', 'score_overtaken',
      'tournament_closed', 'inter_wod_revealed', 'inter_bracket_match', 'inter_bracket_result', 'inter_pool_match',
      'inter_competition_closed']) {
      expect(reservee(undefined, undefined, [t])).toBe(false);
    }
    for (const k of ['group_messages', 'new_wod', 'tournament_updates', 'elo_updates', 'friend_requests', 'score_updates']) {
      expect(reservee(k, undefined, [])).toBe(false);
    }
  });
});

describe('send-push : « Nouveau WOD » réservé au staff de la box des destinataires', () => {
  const src = readFileSync(join(__dirname, '../../supabase/functions/send-push/index.ts'), 'utf8');
  const BA = 'box-a', BB = 'box-b';
  const membres = [
    { box_id: BA, member_id: 'm1' }, { box_id: BA, member_id: 'm2' }, { box_id: BA, member_id: 'proprio-a' },
    { box_id: BB, member_id: 'm3' },
  ];

  it('new_wod est la seule catégorie du staff, atteinte par le type wod_published', () => {
    expect([...STAFF_ONLY_CATEGORIES]).toEqual(['new_wod']);
    expect(resolvePrefKey(undefined, undefined, ['wod_published'])).toBe('new_wod');
  });

  it('staff : une box gérée contient tous les destinataires (propriétaire compris)', () => {
    expect(boxCoveringAll([BA], membres, ['m1', 'm2'])).toBe(BA);
    expect(boxCoveringAll([BA], membres, ['m1', 'proprio-a'])).toBe(BA);
    expect(boxCoveringAll([BB, BA], membres, ['m2'])).toBe(BA);
  });

  it("simple membre : aucune box gérée, refusé", () => {
    expect(boxCoveringAll([], membres, ['m1'])).toBeNull();
  });

  it('destinataires de deux boxes différentes : refusé, même si l’appelant gère les deux', () => {
    expect(boxCoveringAll([BA, BB], membres, ['m1', 'm3'])).toBeNull();
  });

  it("un destinataire hors de la box gérée : refusé", () => {
    expect(boxCoveringAll([BA], membres, ['m1', 'inconnu'])).toBeNull();
    expect(boxCoveringAll([BB], membres, ['m1'])).toBeNull();
  });

  it('le handler l’applique à un utilisateur connecté, sur la catégorie résolue, avant l’autorisation', () => {
    expect(src).toContain("if (!isMachine && STAFF_ONLY_CATEGORIES.has(prefKey) && !(await staffBoxFor(admin, caller!, userIds))) {");
    expect(src).toContain("return json({ error: 'STAFF_ONLY_CATEGORY', category: prefKey, sent: 0 }, 403);");
    expect(src.indexOf("'STAFF_ONLY_CATEGORY'")).toBeLessThan(src.indexOf('await authorizeRecipients('));
    expect(src).toContain(".in('role', ['owner', 'coach']).eq('status', 'active'),");
    expect(src).toContain(".in('box_id', managed).in('member_id', userIds).eq('status', 'active'),");
    expect(src).toContain("admin.from('boxes').select('id, owner_id').in('id', managed).in('owner_id', userIds),");
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
