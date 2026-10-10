/**
 * deliver-manager-notifications (D4a, PR B) : à qui part une notification du
 * gérant, dans quelle langue, une seule fois, et ce qui arrive en cas d'échec.
 * Règles pures (regles.ts), sans Deno : index.ts ne fait que vérifier
 * x-cron-secret et brancher ces accès sur la base. Conception :
 * docs/NOTIFS_GERANT.md.
 */
import fs from 'fs';
import path from 'path';
import {
  type Acces, type Box, type Jeton, type Ligne, type LigneStaff, type MessageExpo, type TypeNotif,
  Echec, MAX_TENTATIVES, TYPES_NOTIF, compterAcceptes, destinataires, heureParis, rediger, traiterFile,
} from '../../supabase/functions/deliver-manager-notifications/regles';
import { compterAcceptes as compterAcceptesAnnonces } from '../../supabase/functions/send-box-notification/regles';

const RACINE = path.join(__dirname, '..', '..');
const lire = (p: string) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const BOX = '00000000-0000-4000-b000-000000000001';
const G = '00000000-0000-4000-a000-0000000000e0'; // gérant principal, sans ligne de membre
const C = '00000000-0000-4000-a000-0000000000e1'; // co-gérant
const K = '00000000-0000-4000-a000-0000000000e2'; // coach
const M = '00000000-0000-4000-a000-000000000010'; // membre de l'événement
const PLAN = '00000000-0000-4000-c000-000000000001';

type Monde = {
  lignes: Ligne[];
  box: Box | null;
  staff: LigneStaff[];
  coupes?: string[];
  jetons: Jeton[];
  pseudos?: Record<string, string>;
  /** Exécution concurrente : ces lignes sont déjà réservées ailleurs. */
  prisesAilleurs?: string[];
  /** Réponse d'Expo par appel (ok par défaut, tickets ok). */
  expo?: Array<{ ok: false; erreur: string } | 'ok'>;
  tickets?: Record<string, 'ok' | 'error'>;
  /** Méthode d'accès qui lève. */
  panne?: keyof Acces;
  panneMessage?: Error;
};

function acces(m: Monde) {
  const lots: MessageExpo[][] = [];
  const terminees: Array<[string, number, string | null]> = [];
  const liberees: Array<[string, string]> = [];
  const reservees: string[] = [];
  const journal: string[] = [];
  let appelExpo = 0;
  const panne = <T>(nom: keyof Acces, v: T): T => {
    if (m.panne === nom) throw m.panneMessage ?? new Echec(`lecture_${String(nom)}`);
    return v;
  };
  const a: Acces = {
    aEnvoyer: async (limite) => panne('aEnvoyer', m.lignes.slice(0, limite)),
    reserver: async (l) => {
      reservees.push(l.id);
      return !(m.prisesAilleurs ?? []).includes(l.id);
    },
    box: async () => panne('box', m.box),
    cogerants: async () => panne('cogerants', m.staff),
    pseudo: async (id) => panne('pseudo', m.pseudos?.[id] ?? null),
    formule: async (id) => panne('formule', id === PLAN ? 'Illimité' : null),
    coupes: async (ids) => panne('coupes', (m.coupes ?? []).filter((id) => ids.includes(id))),
    jetons: async (ids) => panne('jetons', m.jetons.filter((j) => ids.includes(j.user_id))),
    envoyerExpo: async (messages) => {
      lots.push(messages);
      const r = m.expo?.[appelExpo++] ?? 'ok';
      if (r !== 'ok') return r;
      return { ok: true, reponse: { data: messages.map((msg) => ({ status: m.tickets?.[msg.to] ?? 'ok' })) } };
    },
    terminer: async (id, n, e) => { panne('terminer', null); terminees.push([id, n, e]); },
    liberer: async (id, e) => { panne('liberer', null); liberees.push([id, e]); },
    journaliser: (message) => { journal.push(message); },
  };
  return { a, lots, terminees, liberees, reservees, journal };
}

const ligne = (o: Partial<Ligne> = {}): Ligne => ({
  id: 'n1', box_id: BOX, type: 'subscription_paid', member_id: M, plan_id: PLAN,
  class_starts_at: null, actor_id: null, attempts: 0, ...o,
});
const monde = (o: Partial<Monde> = {}): Monde => ({
  lignes: [ligne()],
  box: { name: 'CrossFit Lyon', owner_id: G, archived_at: null },
  staff: [{ member_id: C, role: 'owner', status: 'active' }],
  jetons: [
    { token: 'ExponentPushToken[g]', user_id: G, language: 'fr' },
    { token: 'ExponentPushToken[c]', user_id: C, language: 'en' },
  ],
  pseudos: { [M]: 'nab_wod' },
  ...o,
});

describe('destinataires : gérant et co-gérants, par leur compte', () => {
  const box: Box = { name: 'B', owner_id: G, archived_at: null };

  it('gérant principal servi sans ligne de membre ; co-gérant actif (statut absent compris) servi', () => {
    expect(destinataires(box, [], null)).toEqual([G]);
    expect(destinataires(box, [{ member_id: C, role: 'owner', status: 'active' }], null)).toEqual([G, C]);
    expect(destinataires(box, [{ member_id: C, role: 'owner', status: null }], null)).toEqual([G, C]);
  });

  it('coach, membre simple, co-gérant inactif ou banni : jamais servis', () => {
    const staff: LigneStaff[] = [
      { member_id: K, role: 'coach', status: 'active' },
      { member_id: M, role: 'member', status: 'active' },
      { member_id: C, role: 'owner', status: 'inactive' },
      { member_id: 'banni', role: 'owner', status: 'banned' },
    ];
    expect(destinataires(box, staff, null)).toEqual([G]);
  });

  it("l'auteur du geste n'est pas notifié ; un gérant qui est aussi co-gérant n'est servi qu'une fois", () => {
    const staff: LigneStaff[] = [{ member_id: C, role: 'owner', status: 'active' }, { member_id: G, role: 'owner', status: 'active' }];
    expect(destinataires(box, staff, C)).toEqual([G]);
    expect(destinataires(box, staff, null)).toEqual([G, C]);
  });

  it('box sans gérant principal : les co-gérants seuls', () => {
    expect(destinataires({ ...box, owner_id: null }, [{ member_id: C, role: 'owner', status: 'active' }], null)).toEqual([C]);
  });
});

describe('textes validés (FR / EN), heure à Paris', () => {
  const v = { membre: 'nab_wod', formule: 'Illimité', heure: '18:30', box: 'CrossFit Lyon' };
  const attendus: Array<[TypeNotif, string, string, string, string]> = [
    ['subscription_paid', 'Nouvel abonnement', 'nab_wod a souscrit Illimité.', 'New subscription', 'nab_wod subscribed to Illimité.'],
    ['payment_failed', 'Paiement échoué', 'Le paiement de nab_wod pour Illimité a échoué.', 'Payment failed', "nab_wod's payment for Illimité failed."],
    ['booked_without_plan', 'Inscription sans formule', 'nab_wod a été inscrit au cours de 18:30 sans formule active.',
      'Booking without a plan', 'nab_wod was booked into the 18:30 class without an active plan.'],
    ['invitation_accepted', 'Invitation acceptée', 'nab_wod a rejoint CrossFit Lyon.', 'Invitation accepted', 'nab_wod joined CrossFit Lyon.'],
    ['plan_change_request', 'Demande de changement de formule', 'nab_wod demande à passer à Illimité.',
      'Plan change request', 'nab_wod asked to switch to Illimité.'],
  ];

  it('chaque type de la file a son texte, en français et en anglais', () => {
    expect(attendus.map(([t]) => t).sort()).toEqual([...TYPES_NOTIF].sort());
    for (const type of TYPES_NOTIF) {
      for (const langue of ['fr', 'en'] as const) {
        const m = rediger(type, langue, v);
        expect(m?.title).toBeTruthy();
        expect(m?.body).toBeTruthy();
      }
    }
  });
  it.each(attendus)('%s', (type, titreFr, corpsFr, titreEn, corpsEn) => {
    expect(rediger(type, 'fr', v)).toEqual({ title: titreFr, body: corpsFr });
    expect(rediger(type, 'en', v)).toEqual({ title: titreEn, body: corpsEn });
  });

  it('heure du cours en Europe/Paris, été comme hiver', () => {
    expect(heureParis('2026-07-01T16:30:00Z')).toBe('18:30');
    expect(heureParis('2026-11-03T17:30:00Z')).toBe('18:30');
    expect(heureParis('2026-11-03T06:05:00+00:00')).toBe('07:05');
  });

  it('nom manquant (formule supprimée, heure inconnue) : un repli lisible, jamais « null »', () => {
    const vide = { membre: null, formule: null, heure: null, box: 'B' };
    for (const type of attendus.map(([t]) => t)) {
      for (const langue of ['fr', 'en'] as const) expect(rediger(type, langue, vide).body).not.toMatch(/null|undefined/);
    }
    expect(rediger('booked_without_plan', 'fr', vide).body).toBe('Un membre a été inscrit à un cours sans formule active.');
  });
});

describe('parité avec la base : les types de la file', () => {
  // La dernière migration qui (re)définit box_manager_notifications_type_check fait foi.
  const typesDeLaBase = (): string[] => {
    const dossier = 'supabase/migrations';
    const motif = /box_manager_notifications_type_check\s+CHECK \(type IN \(([^)]*)\)\)/;
    const fichier = fs.readdirSync(path.join(RACINE, dossier)).filter((f) => f.endsWith('.sql')).sort()
      .filter((f) => motif.test(lire(`${dossier}/${f}`))).pop();
    expect(fichier).toBeDefined();
    const liste = (lire(`${dossier}/${fichier}`).match(motif) as RegExpMatchArray)[1];
    return [...liste.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  };

  it('regles.ts connaît exactement les types de la contrainte (ni plus, ni moins)', () => {
    const base = typesDeLaBase();
    expect(base).toContain('plan_change_request');
    expect([...TYPES_NOTIF].sort()).toEqual([...base].sort());
  });
});

describe('traiterFile : envoi', () => {
  it('gérant sans ligne de membre et co-gérant servis, chacun dans la langue de son jeton', async () => {
    const { a, lots, terminees } = acces(monde({
      jetons: [
        { token: 'ExponentPushToken[g]', user_id: G, language: 'fr' },
        { token: 'ExponentPushToken[g2]', user_id: G, language: null },
        { token: 'ExponentPushToken[c]', user_id: C, language: 'en' },
      ],
    }));
    expect(await traiterFile(a)).toEqual({ lues: 1, envoyees: 1, echecs: 0, prises_ailleurs: 0 });
    expect(lots).toHaveLength(1);
    expect(lots[0]).toEqual([
      { to: 'ExponentPushToken[g]', sound: 'default', title: 'Nouvel abonnement', body: 'nab_wod a souscrit Illimité.',
        data: { type: 'subscription_paid', box_id: BOX } },
      { to: 'ExponentPushToken[g2]', sound: 'default', title: 'Nouvel abonnement', body: 'nab_wod a souscrit Illimité.',
        data: { type: 'subscription_paid', box_id: BOX } },
      { to: 'ExponentPushToken[c]', sound: 'default', title: 'New subscription', body: 'nab_wod subscribed to Illimité.',
        data: { type: 'subscription_paid', box_id: BOX } },
    ]);
    expect(terminees).toEqual([['n1', 3, null]]);
  });

  it('membre simple, coach, membre de l\'événement : jamais servis, même avec un jeton', async () => {
    const { a, lots } = acces(monde({
      staff: [{ member_id: K, role: 'coach', status: 'active' }, { member_id: M, role: 'member', status: 'active' }],
      jetons: [
        { token: 'ExponentPushToken[g]', user_id: G }, { token: 'ExponentPushToken[k]', user_id: K },
        { token: 'ExponentPushToken[m]', user_id: M },
      ],
    }));
    await traiterFile(a);
    expect(lots.flat().map((msg) => msg.to)).toEqual(['ExponentPushToken[g]']);
  });

  it("pseudo affiché, jamais l'e-mail ; heure du cours à Paris ; auteur exclu", async () => {
    const { a, lots } = acces(monde({
      lignes: [ligne({ type: 'booked_without_plan', plan_id: null, class_starts_at: '2026-11-03T17:30:00+00:00', actor_id: G })],
    }));
    await traiterFile(a);
    expect(lots[0]).toEqual([{
      to: 'ExponentPushToken[c]', sound: 'default', title: 'Booking without a plan',
      body: 'nab_wod was booked into the 18:30 class without an active plan.',
      data: { type: 'booked_without_plan', box_id: BOX },
    }]);
  });

  it('interrupteur général coupé : ce compte ne reçoit rien', async () => {
    const { a, lots } = acces(monde({ coupes: [C] }));
    await traiterFile(a);
    expect(lots.flat().map((msg) => msg.to)).toEqual(['ExponentPushToken[g]']);
  });

  it('appareils acceptés = tickets « ok » d\'Expo', async () => {
    const { a, terminees } = acces(monde({ tickets: { 'ExponentPushToken[c]': 'error' } }));
    await traiterFile(a);
    expect(terminees).toEqual([['n1', 1, null]]);
  });

  it('appareils comptés comme send-box-notification', () => {
    const reponses: unknown[] = [
      null, {}, { data: 'x' }, { data: [] }, { data: [{ status: 'ok' }, { status: 'error' }, null, { status: 'ok' }] },
    ];
    for (const r of reponses) expect(compterAcceptes(r)).toBe(compterAcceptesAnnonces(r));
    expect(compterAcceptes(reponses[4])).toBe(2);
  });

  it('sans destinataire ni jeton : terminée à 0, sans Expo', async () => {
    for (const o of [{ jetons: [] }, { coupes: [G, C] }, { box: { name: 'B', owner_id: null, archived_at: null }, staff: [] }]) {
      const { a, lots, terminees } = acces(monde(o));
      await traiterFile(a);
      expect(lots).toHaveLength(0);
      expect(terminees).toEqual([['n1', 0, null]]);
    }
  });

  it('box archivée ou supprimée entre-temps : terminée à 0 avec le motif, sans Expo', async () => {
    for (const [box, motif] of [[{ name: 'B', owner_id: G, archived_at: '2026-10-01T00:00:00Z' }, 'box_archivee'], [null, 'box_absente']] as const) {
      const { a, lots, terminees } = acces(monde({ box }));
      await traiterFile(a);
      expect(lots).toHaveLength(0);
      expect(terminees).toEqual([['n1', 0, motif]]);
    }
  });
});

describe('traiterFile : une seule fois', () => {
  it('ligne prise par une autre exécution (réservation refusée) : ni Expo ni écriture', async () => {
    const { a, lots, terminees, liberees, reservees } = acces(monde({ prisesAilleurs: ['n1'] }));
    expect(await traiterFile(a)).toEqual({ lues: 1, envoyees: 0, echecs: 0, prises_ailleurs: 1 });
    expect(reservees).toEqual(['n1']);
    expect(lots).toHaveLength(0);
    expect(terminees).toHaveLength(0);
    expect(liberees).toHaveLength(0);
  });

  it('chaque ligne est réservée avant son envoi', async () => {
    const { a, reservees, lots } = acces(monde({ lignes: [ligne({ id: 'n1' }), ligne({ id: 'n2', type: 'invitation_accepted' })] }));
    await traiterFile(a);
    expect(reservees).toEqual(['n1', 'n2']);
    expect(lots).toHaveLength(2);
  });

  it(`${MAX_TENTATIVES} tentatives épuisées : ni réservée ni envoyée`, async () => {
    const { a, reservees, lots } = acces(monde({ lignes: [ligne({ attempts: MAX_TENTATIVES })] }));
    await traiterFile(a);
    expect(reservees).toHaveLength(0);
    expect(lots).toHaveLength(0);
  });

  it('résultat non écrit après l\'envoi : la ligne n\'est PAS libérée (elle ne repartira pas)', async () => {
    const { a, lots, liberees, journal } = acces(monde({ panne: 'terminer' }));
    await traiterFile(a);
    expect(lots).toHaveLength(1);
    expect(liberees).toHaveLength(0);
    expect(journal).toEqual(['deliver-manager-notifications : résultat non écrit']);
  });

  it('un lot Expo en échec après un lot parti : terminée (pas de renvoi), avec le code', async () => {
    const jetons = Array.from({ length: 150 }, (_, i) => ({ token: `ExponentPushToken[${i}]`, user_id: G }));
    const { a, lots, terminees, liberees } = acces(monde({ jetons, expo: ['ok', { ok: false, erreur: 'expo_http_503' }] }));
    await traiterFile(a);
    expect(lots.map((l) => l.length)).toEqual([100, 50]);
    expect(terminees).toEqual([['n1', 100, 'expo_http_503']]);
    expect(liberees).toHaveLength(0);
  });
});

describe('traiterFile : erreur → nouvelle tentative', () => {
  it('Expo en échec avant tout envoi : libérée avec le code, comptée en échec', async () => {
    const { a, terminees, liberees } = acces(monde({ expo: [{ ok: false, erreur: 'expo_injoignable' }] }));
    expect(await traiterFile(a)).toEqual({ lues: 1, envoyees: 0, echecs: 1, prises_ailleurs: 0 });
    expect(terminees).toHaveLength(0);
    expect(liberees).toEqual([['n1', 'expo_injoignable']]);
  });

  it('lecture en échec : libérée avec le code de la lecture', async () => {
    const { a, lots, liberees } = acces(monde({ panne: 'jetons' }));
    await traiterFile(a);
    expect(lots).toHaveLength(0);
    expect(liberees).toEqual([['n1', 'lecture_jetons']]);
  });

  it('erreur imprévue : « erreur_interne », jamais son message (donnée personnelle possible)', async () => {
    const { a, liberees } = acces(monde({ panne: 'pseudo', panneMessage: new Error('nab@example.com introuvable') }));
    await traiterFile(a);
    expect(liberees).toEqual([['n1', 'erreur_interne']]);
  });

  it('une ligne en échec n\'empêche pas les suivantes', async () => {
    const { a, terminees, liberees } = acces(monde({
      lignes: [ligne({ id: 'n1' }), ligne({ id: 'n2' })],
      expo: [{ ok: false, erreur: 'expo_http_500' }, 'ok'],
    }));
    expect(await traiterFile(a)).toEqual({ lues: 2, envoyees: 1, echecs: 1, prises_ailleurs: 0 });
    expect(liberees).toEqual([['n1', 'expo_http_500']]);
    expect(terminees).toEqual([['n2', 2, null]]);
  });

  it('file illisible : l\'erreur remonte (500), rien n\'est réservé', async () => {
    const { a, reservees } = acces(monde({ panne: 'aEnvoyer' }));
    await expect(traiterFile(a)).rejects.toThrow('lecture_aEnvoyer');
    expect(reservees).toHaveLength(0);
  });
});

describe('index.ts et la file', () => {
  const src = lire('supabase/functions/deliver-manager-notifications/index.ts');

  it('appelée seulement avec x-cron-secret (fail-closed), clé par cleSecrete()', () => {
    expect(src).toMatch(/if \(!cronSecret \|\| provided !== cronSecret\) return json\(\{ error: 'unauthorized' \}, 401\);/);
    expect(src.indexOf("return json({ error: 'unauthorized' }, 401)")).toBeLessThan(src.indexOf('createClient('));
    expect(src).toContain("import { cleSecrete } from '../_shared/cle-secrete.ts';");
  });

  it('lit la file non envoyée, non réservée, sous le plafond de tentatives, des dernières 24 h', () => {
    expect(src).toMatch(/\.is\('sent_at', null\)\.is\('claimed_at', null\)\.lt\('attempts', MAX_TENTATIVES\)/);
    expect(src).toMatch(/\.gte\('created_at', depuis\)/);
  });

  it('réservation conditionnelle : non envoyée, non réservée, au nombre de tentatives lu', () => {
    expect(src).toMatch(/\.update\(\{ claimed_at: new Date\(\)\.toISOString\(\), attempts: ligne\.attempts \+ 1 \}\)\s*\.eq\('id', ligne\.id\)\.is\('sent_at', null\)\.is\('claimed_at', null\)\.eq\('attempts', ligne\.attempts\)\s*\.select\('id'\)/);
  });

  it('co-gérants lus par le rôle owner ; Expo ne lève jamais (échec rendu en code)', () => {
    expect(src).toMatch(/\.from\('box_members'\)\.select\('member_id, role, status'\)\.eq\('box_id', boxId\)\.eq\('role', 'owner'\)/);
    expect(src).toContain("return { ok: false, erreur: `expo_http_${res.status}` };");
    expect(src).toContain("return { ok: false, erreur: 'expo_injoignable' };");
  });

  it('le membre est nommé par son pseudo (profiles.username), jamais par son e-mail', () => {
    expect(src).toMatch(/\.from\('profiles'\)\.select\('username'\)/);
    expect(src).not.toMatch(/email/);
  });
});
