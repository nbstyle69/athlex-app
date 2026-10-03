/**
 * send-box-notification (D4b, PR 1) : qui peut envoyer, combien d'appareils ont
 * reçu, et le résultat écrit sur la ligne. Règles pures (regles.ts), sans Deno :
 * index.ts ne fait que vérifier le JWT et brancher ces accès sur la base.
 */
import fs from 'fs';
import path from 'path';
import {
  type Acces, type FaitsAppelant, type MessageExpo, type Notification, type Preference,
  compterAcceptes, gerantOuCogerant, traiterEnvoi,
} from '../../supabase/functions/send-box-notification/regles';

const RACINE = path.join(__dirname, '..', '..');
const lire = (p: string) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const BOX = '00000000-0000-4000-b000-000000000001';
const G = '00000000-0000-4000-a000-0000000000e0'; // gérant principal
const C = '00000000-0000-4000-a000-0000000000e1'; // co-gérant
const K = '00000000-0000-4000-a000-0000000000e2'; // coach
const M1 = '00000000-0000-4000-a000-000000000010';
const M2 = '00000000-0000-4000-a000-000000000011';

type Monde = {
  notif: Notification | null;
  owner: string;
  lignes: Record<string, { role: string; status: string | null }>;
  profils?: Record<string, string>;
  actifs: string[];
  prefs?: Preference[];
  prefsErreur?: unknown;
  jetons: Record<string, string[]>;
  /** Statut du ticket rendu par Expo pour chaque jeton (ok par défaut). */
  tickets?: Record<string, 'ok' | 'error'>;
  expoEnPanne?: boolean;
  ecritureEnPanne?: boolean;
};

function acces(m: Monde) {
  const lots: MessageExpo[][] = [];
  const ecrits: Array<[string, number]> = [];
  const journal: string[] = [];
  const a: Acces = {
    notification: async (id) => (m.notif && m.notif.id === id ? m.notif : null),
    roleAppelant: async (_box, userId): Promise<FaitsAppelant> => ({
      ownerId: m.owner,
      ligne: m.lignes[userId] ?? null,
      roleProfil: m.profils?.[userId] ?? 'member',
    }),
    membresActifs: async () => m.actifs,
    estMembreActif: async (_box, userId) => m.actifs.includes(userId),
    preferences: async (ids) => ({ data: (m.prefs ?? []).filter((p) => ids.includes(p.user_id)), error: m.prefsErreur ?? null }),
    jetons: async (ids) => ids.flatMap((id) => m.jetons[id] ?? []),
    envoyerExpo: async (messages) => {
      lots.push(messages);
      if (m.expoEnPanne) return null;
      return { data: messages.map((msg) => ({ status: m.tickets?.[msg.to] ?? 'ok', id: `ticket-${msg.to}` })) };
    },
    poserResultat: async (id, n) => {
      if (m.ecritureEnPanne) throw new Error('écriture refusée');
      ecrits.push([id, n]);
    },
    journaliser: (message) => { journal.push(message); },
  };
  return { a, lots, ecrits, journal };
}

const NOTIF_TOUS: Notification = { id: 'n-tous', box_id: BOX, title: 'Fermeture', body: 'Box fermée lundi', target: 'all' };
const NOTIF_M1: Notification = { ...NOTIF_TOUS, id: 'n-m1', target: M1 };
const monde = (o: Partial<Monde> = {}): Monde => ({
  notif: NOTIF_TOUS,
  owner: G,
  lignes: { [C]: { role: 'owner', status: 'active' }, [K]: { role: 'coach', status: 'active' }, [M1]: { role: 'member', status: 'active' } },
  actifs: [C, K, M1, M2],
  jetons: { [M1]: ['ExponentPushToken[m1]'], [M2]: ['ExponentPushToken[m2-a]', 'ExponentPushToken[m2-b]'] },
  ...o,
});

describe('send-box-notification : qui peut envoyer (règle de is_box_owner_admin)', () => {
  const faits = (o: Partial<FaitsAppelant> = {}): FaitsAppelant => ({ ownerId: G, ligne: null, roleProfil: 'member', ...o });

  it('gérant principal, co-gérant actif (statut absent compris) et administrateur de la plateforme : oui', () => {
    expect(gerantOuCogerant(faits(), G)).toBe(true);
    expect(gerantOuCogerant(faits({ ligne: { role: 'owner', status: 'active' } }), C)).toBe(true);
    expect(gerantOuCogerant(faits({ ligne: { role: 'owner', status: null } }), C)).toBe(true);
    expect(gerantOuCogerant(faits({ roleProfil: 'admin' }), M1)).toBe(true);
    expect(gerantOuCogerant(faits({ roleProfil: 'super_admin' }), M1)).toBe(true);
  });

  it('coach, membre, co-gérant inactif ou banni, inconnu : non', () => {
    expect(gerantOuCogerant(faits({ ligne: { role: 'coach', status: 'active' } }), K)).toBe(false);
    expect(gerantOuCogerant(faits({ ligne: { role: 'member', status: 'active' } }), M1)).toBe(false);
    expect(gerantOuCogerant(faits({ ligne: { role: 'owner', status: 'inactive' } }), C)).toBe(false);
    expect(gerantOuCogerant(faits({ ligne: { role: 'owner', status: 'banned' } }), C)).toBe(false);
    expect(gerantOuCogerant(faits({ ownerId: null }), M2)).toBe(false);
    expect(gerantOuCogerant(faits({ roleProfil: null }), M2)).toBe(false);
  });

  it('la fonction SQL is_box_owner_admin a toujours les trois mêmes clauses', () => {
    const sql = lire('supabase/migrations/20261101_lot0_frontiere_coach_argent.sql');
    const corps = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.is_box_owner_admin'), sql.indexOf('REVOKE ALL ON FUNCTION public.is_box_owner_admin'));
    expect(corps).toContain('owner_id = auth.uid()');
    expect(corps).toContain("AND role = 'owner'");
    expect(corps).toContain("COALESCE(status, 'active') = 'active'");
    expect(corps).toContain("role IN ('admin','super_admin')");
    // Aucune autre définition ne l'a remplacée depuis.
    const redefinitions = fs.readdirSync(path.join(RACINE, 'supabase', 'migrations'))
      .filter((f) => /CREATE (OR REPLACE )?FUNCTION "?public"?\."?is_box_owner_admin"?\s*\(/.test(lire(`supabase/migrations/${f}`)));
    expect(redefinitions).toEqual(['20261101_lot0_frontiere_coach_argent.sql']);
  });

  it('la règle d\'écriture de box_notifications est la même (migration 20270142)', () => {
    const sql = lire('supabase/migrations/20270142000000_notifications_gerant_resultat.sql');
    const code = sql.split('\n').filter((l) => !l.startsWith('--')).join('\n');
    expect(code).toMatch(/CREATE POLICY box_notifs_owner ON public\.box_notifications\s+USING \(public\.is_box_owner_admin\(box_id\)\);/);
  });
});

describe('send-box-notification : envoi et résultat', () => {
  it('co-gérant servi : appareils acceptés comptés, résultat écrit', async () => {
    const { a, lots, ecrits } = acces(monde({ tickets: { 'ExponentPushToken[m2-b]': 'error' } }));
    const r = await traiterEnvoi(a, C, 'n-tous');
    expect(r).toEqual({ status: 200, body: { sent: 2, recipients: 4, pref_disabled: 0 } });
    expect(lots).toHaveLength(1);
    expect(lots[0].map((msg) => msg.to)).toEqual(['ExponentPushToken[m1]', 'ExponentPushToken[m2-a]', 'ExponentPushToken[m2-b]']);
    expect(lots[0][0]).toEqual({
      to: 'ExponentPushToken[m1]', sound: 'default', title: 'Fermeture', body: 'Box fermée lundi',
      data: { type: 'box_notification', box_id: BOX },
    });
    expect(ecrits).toEqual([['n-tous', 2]]);
  });

  it('gérant principal servi, sans ligne box_members', async () => {
    const { a, ecrits } = acces(monde());
    const r = await traiterEnvoi(a, G, 'n-tous');
    expect(r.status).toBe(200);
    expect(r.body.sent).toBe(3);
    expect(ecrits).toEqual([['n-tous', 3]]);
  });

  it('coach et membre : 403, rien envoyé, rien écrit', async () => {
    for (const qui of [K, M1]) {
      const { a, lots, ecrits } = acces(monde());
      const r = await traiterEnvoi(a, qui, 'n-tous');
      expect(r).toEqual({ status: 403, body: { error: 'Not owner or co-owner of this box' } });
      expect(lots).toHaveLength(0);
      expect(ecrits).toHaveLength(0);
    }
  });

  it('membre seul sans aucun jeton : sent 0, et 0 écrit (pas NULL)', async () => {
    const { a, lots, ecrits } = acces(monde({ notif: NOTIF_M1, jetons: {} }));
    const r = await traiterEnvoi(a, G, 'n-m1');
    expect(r).toEqual({ status: 200, body: { sent: 0, recipients: 1, pref_disabled: 0 } });
    expect(lots).toHaveLength(0);
    expect(ecrits).toEqual([['n-m1', 0]]);
  });

  it('notifications coupées par le membre : 0 écrit, pref_disabled compté', async () => {
    const { a, ecrits } = acces(monde({ notif: NOTIF_M1, prefs: [{ user_id: M1, notifications_enabled: true, box_announcements: false }] }));
    const r = await traiterEnvoi(a, G, 'n-m1');
    expect(r).toEqual({ status: 200, body: { sent: 0, recipients: 0, pref_disabled: 1 } });
    expect(ecrits).toEqual([['n-m1', 0]]);
  });

  it('box sans membre actif : 0 écrit', async () => {
    const { a, ecrits } = acces(monde({ actifs: [] }));
    expect((await traiterEnvoi(a, G, 'n-tous')).body).toEqual({ sent: 0, recipients: 0, pref_disabled: 0 });
    expect(ecrits).toEqual([['n-tous', 0]]);
  });

  it('tous les tickets en erreur, ou Expo en panne : sent 0, et 0 écrit', async () => {
    const enErreur = acces(monde({ notif: NOTIF_M1, tickets: { 'ExponentPushToken[m1]': 'error' } }));
    expect((await traiterEnvoi(enErreur.a, G, 'n-m1')).body.sent).toBe(0);
    expect(enErreur.ecrits).toEqual([['n-m1', 0]]);
    const enPanne = acces(monde({ expoEnPanne: true }));
    expect((await traiterEnvoi(enPanne.a, G, 'n-tous')).body.sent).toBe(0);
    expect(enPanne.lots).toHaveLength(1);
    expect(enPanne.ecrits).toEqual([['n-tous', 0]]);
  });

  it('plus de 100 appareils : lots de 100, tickets additionnés', async () => {
    const beaucoup = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[${i}]`);
    const { a, lots, ecrits } = acces(monde({ jetons: { [M1]: beaucoup }, tickets: { 'ExponentPushToken[149]': 'error' } }));
    const r = await traiterEnvoi(a, G, 'n-tous');
    expect(lots.map((l) => l.length)).toEqual([100, 50]);
    expect(r.body.sent).toBe(149);
    expect(ecrits).toEqual([['n-tous', 149]]);
  });

  it('écriture du résultat refusée : la réponse ne change pas, l\'échec est journalisé', async () => {
    const { a, journal } = acces(monde({ ecritureEnPanne: true }));
    const r = await traiterEnvoi(a, G, 'n-tous');
    expect(r).toEqual({ status: 200, body: { sent: 3, recipients: 4, pref_disabled: 0 } });
    expect(journal).toEqual(['send-box-notification : delivered_count non écrit']);
  });

  it('refus sans écriture : notification absente, cible invalide ou hors box, préférences illisibles', async () => {
    const cas: Array<[Partial<Monde>, string, number]> = [
      [{ notif: null }, 'n-tous', 404],
      [{ notif: { ...NOTIF_TOUS, target: 'pas-un-uuid' } }, 'n-tous', 400],
      [{ notif: NOTIF_M1, actifs: [M2] }, 'n-m1', 403],
      [{ prefsErreur: new Error('panne') }, 'n-tous', 503],
    ];
    for (const [o, id, statut] of cas) {
      const { a, lots, ecrits } = acces(monde(o));
      expect((await traiterEnvoi(a, G, id)).status).toBe(statut);
      expect(lots).toHaveLength(0);
      expect(ecrits).toHaveLength(0);
    }
  });
});

describe('send-box-notification : tickets Expo', () => {
  it('compte les tickets « ok », rien pour une réponse illisible', () => {
    expect(compterAcceptes({ data: [{ status: 'ok' }, { status: 'error', message: 'DeviceNotRegistered' }, { status: 'ok' }] })).toBe(2);
    expect(compterAcceptes({ data: [] })).toBe(0);
    expect(compterAcceptes({ errors: [{ code: 'PUSH_TOO_MANY_EXPERIENCE_IDS' }] })).toBe(0);
    expect(compterAcceptes({ data: { status: 'ok' } })).toBe(0);
    expect(compterAcceptes(null)).toBe(0);
    expect(compterAcceptes({ data: [null, 'ok'] })).toBe(0);
  });
});

describe('send-box-notification : branchement', () => {
  it('index.ts délègue à traiterEnvoi et écrit delivered_count avec la clé serveur', () => {
    const src = lire('supabase/functions/send-box-notification/index.ts');
    expect(src).toContain("import { type Acces, traiterEnvoi } from './regles.ts';");
    expect(src).toContain('const admin = createClient(SUPABASE_URL, SERVICE_KEY);');
    expect(src).toMatch(/admin\s*\.from\('box_notifications'\)\.update\(\{ delivered_count: delivered \}\)\.eq\('id', notificationId\)/);
    expect(src).toContain('await traiterEnvoi(acces, userData.user.id, notificationId)');
  });
});
