/**
 * deliver-access-notices (paiements au comptoir P1, PR 3) : messages de fin
 * d'accès (J−7, J−1, fin) au membre payé au comptoir, par push et par e-mail.
 * Règles pures (regles.ts), sans Deno : index.ts ne fait que vérifier
 * x-cron-secret et brancher ces accès sur la base, Expo et Resend.
 */
import fs from 'fs';
import path from 'path';
import {
  type Acces, type EtatMembre, type Formule, type Jeton, type Ligne, type MessageExpo, type Preferences, type Resultat,
  autorise, boxVendEnLigne, dansLesHeures, dateLisible, echapper, EXPEDITEUR, htmlEmail, joursRestants, langueRetenue,
  rediger, traiterFile, URL_COMPTE,
} from '../../supabase/functions/deliver-access-notices/regles';

const RACINE = path.join(__dirname, '..', '..');
const lire = (p: string) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const BOX = '00000000-0000-4000-b000-000000000001';
const M = '00000000-0000-4000-a000-000000000010';
const BM = '00000000-0000-4000-d000-000000000010';
// Mercredi 11 novembre 2026, 11:00 à Paris (heure d'hiver, UTC+1).
const MAINTENANT = new Date('2026-11-11T10:00:00Z');

type Monde = {
  instant?: Date;
  lignes: Ligne[];
  membre?: EtatMembre | null;
  box?: { name: string; stripe_account_id: string | null; stripe_onboarding_complete: boolean | null } | null;
  formules?: Formule[];
  prefs?: Preferences | null;
  jetons?: Jeton[];
  email?: string | null;
  prisesAilleurs?: string[];
  expo?: { ok: false; erreur: string };
  tickets?: 'ok' | 'error';
  resend?: { ok: false; erreur: string };
  panneTerminer?: boolean;
  panneMembre?: boolean;
};

function acces(m: Monde) {
  const etat = new Map(m.lignes.map((l) => [l.id, { reservee: false, envoyee: false }]));
  const lots: MessageExpo[][] = [];
  const emails: Array<{ to: string; subject: string; html: string }> = [];
  const terminees: Array<[string, Resultat]> = [];
  const journal: string[] = [];
  const appels: string[] = [];
  const a: Acces = {
    maintenant: () => m.instant ?? MAINTENANT,
    aEnvoyer: async (limite) => {
      appels.push('aEnvoyer');
      return m.lignes.filter((l) => !etat.get(l.id)!.reservee && !etat.get(l.id)!.envoyee).slice(0, limite);
    },
    reserver: async (id) => {
      appels.push(`reserver:${id}`);
      const e = etat.get(id)!;
      if ((m.prisesAilleurs ?? []).includes(id) || e.reservee || e.envoyee) return false;
      e.reservee = true;
      return true;
    },
    membre: async () => {
      appels.push('membre');
      if (m.panneMembre) throw new Error('lecture échouée pour membre@exemple.fr');
      return m.membre === undefined ? membreOk() : m.membre;
    },
    box: async () => (m.box === undefined ? { name: 'Box Lyon', stripe_account_id: 'acct_1', stripe_onboarding_complete: true } : m.box),
    formules: async () => m.formules ?? [{ is_active: true, stripe_price_id: 'price_1' }],
    preferences: async () => (m.prefs === undefined ? null : m.prefs),
    jetons: async () => m.jetons ?? [{ token: 'ExponentPushToken[fr]', language: 'fr', updated_at: '2026-10-01T00:00:00Z' }],
    email: async () => (m.email === undefined ? 'membre@exemple.fr' : m.email),
    envoyerExpo: async (messages) => {
      lots.push(messages);
      if (m.expo) return m.expo;
      return { ok: true, reponse: { data: messages.map(() => ({ status: m.tickets ?? 'ok' })) } };
    },
    envoyerEmail: async (e) => {
      emails.push(e);
      return m.resend ?? { ok: true };
    },
    terminer: async (id, r) => {
      if (m.panneTerminer) throw new Error('écriture échouée');
      etat.get(id)!.envoyee = true;
      terminees.push([id, r]);
    },
    journaliser: (code, erreur) => {
      journal.push(`${code} ${erreur instanceof Error && erreur.constructor.name === 'Echec' ? erreur.message : 'erreur_interne'}`);
    },
  };
  return { a, lots, emails, terminees, journal, appels };
}

const ligne = (o: Partial<Ligne> = {}): Ligne => ({
  id: 'n1', box_id: BOX, member_id: M, box_member_id: BM, kind: 'j7', access_until: '2026-11-16',
  created_at: '2026-11-11T09:41:00Z', ...o,
});
function membreOk(o: Partial<EtatMembre> = {}): EtatMembre {
  return { role: 'member', status: 'active', stripe_subscription_id: null, cash_access_until: '2026-11-16', subscription_status: 'active', ...o };
}

describe('heures d\'envoi : de 9:00 à 20:00, heure de Paris', () => {
  it('bornes en hiver (UTC+1) et en été (UTC+2)', () => {
    expect(dansLesHeures(new Date('2026-11-11T07:59:00Z'))).toBe(false); // 08:59
    expect(dansLesHeures(new Date('2026-11-11T08:00:00Z'))).toBe(true); // 09:00
    expect(dansLesHeures(new Date('2026-11-11T18:59:00Z'))).toBe(true); // 19:59
    expect(dansLesHeures(new Date('2026-11-11T19:00:00Z'))).toBe(false); // 20:00
    expect(dansLesHeures(new Date('2026-07-01T06:59:00Z'))).toBe(false); // 08:59
    expect(dansLesHeures(new Date('2026-07-01T07:00:00Z'))).toBe(true); // 09:00
    expect(dansLesHeures(new Date('2026-07-01T18:00:00Z'))).toBe(false); // 20:00
  });

  it('hors des heures : rien n\'est lu ni réservé, les lignes attendent', async () => {
    const t = acces({ instant: new Date('2026-11-11T21:46:00Z'), lignes: [ligne()] });
    const bilan = await traiterFile(t.a);
    expect(bilan.hors_heures).toBe(true);
    expect(t.appels).toEqual([]);
    expect(t.lots).toEqual([]);
    expect(t.emails).toEqual([]);
  });
});

describe('ligne périmée (plus de 48 h)', () => {
  it('marquée envoyée avec « perime », sans aucun envoi ni relecture du membre', async () => {
    const t = acces({ lignes: [ligne({ created_at: '2026-11-09T09:59:00Z' })] });
    const bilan = await traiterFile(t.a);
    expect(bilan.perimees).toBe(1);
    expect(t.terminees).toEqual([['n1', { push_count: 0, email_sent: false, error: 'perime' }]]);
    expect(t.lots).toEqual([]);
    expect(t.emails).toEqual([]);
    expect(t.appels).not.toContain('membre');
  });

  it('47 h : encore envoyée', async () => {
    const t = acces({ lignes: [ligne({ created_at: '2026-11-09T11:00:00Z' })] });
    await traiterFile(t.a);
    expect(t.terminees[0][1].error).toBeNull();
    expect(t.emails).toHaveLength(1);
  });
});

describe('recontrôle avant envoi : message obsolète', () => {
  const cas: Array<[string, Partial<Ligne>, EtatMembre | null]> = [
    ['j7, réencaissé (autre fin d\'accès)', {}, membreOk({ cash_access_until: '2026-12-15' })],
    ['j7, passé en ligne (abonnement Stripe)', {}, membreOk({ stripe_subscription_id: 'sub_1' })],
    ['j7, plus membre (adhésion supprimée)', {}, null],
    ['j7, plus membre actif (inactif)', {}, membreOk({ status: 'inactive' })],
    ['j7, devenu coach', {}, membreOk({ role: 'coach' })],
    ['j7, déjà coupé', {}, membreOk({ subscription_status: 'expired' })],
    ['j1, réencaissé', { kind: 'j1', access_until: '2026-11-12' }, membreOk({ cash_access_until: '2026-12-11' })],
    ['fin, réencaissé (de nouveau actif)', { kind: 'fin', access_until: '2026-11-10' }, membreOk({ cash_access_until: '2026-12-10', subscription_status: 'active' })],
    ['fin, passé en ligne', { kind: 'fin', access_until: '2026-11-10' }, membreOk({ cash_access_until: '2026-11-10', subscription_status: 'expired', stripe_subscription_id: 'sub_1' })],
    ['fin, statut rétabli sans nouvelle fin', { kind: 'fin', access_until: '2026-11-10' }, membreOk({ cash_access_until: '2026-11-10', subscription_status: 'active' })],
  ];
  it.each(cas)('%s : marqué « obsolete », sans envoi', async (_nom, l, membre) => {
    const t = acces({ lignes: [ligne(l)], membre });
    const bilan = await traiterFile(t.a);
    expect(bilan.obsoletes).toBe(1);
    expect(t.terminees).toEqual([['n1', { push_count: 0, email_sent: false, error: 'obsolete' }]]);
    expect(t.lots).toEqual([]);
    expect(t.emails).toEqual([]);
  });

  it('fin : toujours coupé, à la même fin → envoyé', async () => {
    const t = acces({
      lignes: [ligne({ kind: 'fin', access_until: '2026-11-10' })],
      membre: membreOk({ cash_access_until: '2026-11-10', subscription_status: 'expired' }),
    });
    await traiterFile(t.a);
    expect(t.terminees[0][1].error).toBeNull();
    expect(t.emails[0].subject).toBe('Ton accès est terminé');
  });

  it.each(['active', 'trialing', 'past_due'])('j7, statut %s : envoyé', async (s) => {
    const t = acces({ lignes: [ligne()], membre: membreOk({ subscription_status: s }) });
    await traiterFile(t.a);
    expect(t.terminees[0][1].error).toBeNull();
  });
});

describe('une seule fois', () => {
  it('réservation perdue (prise par une autre exécution) : ni relecture, ni envoi, ni écriture', async () => {
    const t = acces({ lignes: [ligne()], prisesAilleurs: ['n1'] });
    const bilan = await traiterFile(t.a);
    expect(bilan.prises_ailleurs).toBe(1);
    expect(t.appels).toEqual(['aEnvoyer', 'reserver:n1']);
    expect(t.lots).toEqual([]);
    expect(t.emails).toEqual([]);
    expect(t.terminees).toEqual([]);
  });

  it('réservée avant tout appel externe', async () => {
    const t = acces({ lignes: [ligne()] });
    await traiterFile(t.a);
    expect(t.appels.indexOf('reserver:n1')).toBeLessThan(t.appels.indexOf('membre'));
  });

  it('Expo en échec : terminée avec le code, l\'e-mail part quand même ; jamais renvoyée', async () => {
    const t = acces({ lignes: [ligne()], expo: { ok: false, erreur: 'expo_http_500' } });
    await traiterFile(t.a);
    expect(t.terminees).toEqual([['n1', { push_count: 0, email_sent: true, error: 'expo_http_500' }]]);
    await traiterFile(t.a);
    expect(t.lots).toHaveLength(1);
    expect(t.emails).toHaveLength(1);
  });

  it('Resend en échec : terminée avec le code, jamais renvoyée', async () => {
    const t = acces({ lignes: [ligne()], resend: { ok: false, erreur: 'resend_http_422' } });
    await traiterFile(t.a);
    expect(t.terminees).toEqual([['n1', { push_count: 1, email_sent: false, error: 'resend_http_422' }]]);
    await traiterFile(t.a);
    expect(t.emails).toHaveLength(1);
  });

  it('erreur imprévue après la réservation : terminée en « erreur_interne », jamais son message', async () => {
    const t = acces({ lignes: [ligne()], panneMembre: true });
    await traiterFile(t.a);
    expect(t.terminees).toEqual([['n1', { push_count: 0, email_sent: false, error: 'erreur_interne' }]]);
    expect(t.journal.join(' ')).not.toMatch(/@/);
    await traiterFile(t.a);
    expect(t.appels.filter((x) => x === 'membre')).toHaveLength(1);
  });

  it('résultat non écrit : la ligne reste réservée et n\'est jamais reprise', async () => {
    const t = acces({ lignes: [ligne()], panneTerminer: true });
    await traiterFile(t.a);
    expect(t.journal).toEqual(['deliver-access-notices : résultat non écrit erreur_interne']);
    await traiterFile(t.a);
    expect(t.lots).toHaveLength(1);
    expect(t.emails).toHaveLength(1);
  });
});

describe('textes', () => {
  const box = 'Box Lyon';
  it('j7, j1 demain, j1 ce soir, fin, en français et en anglais (box qui vend en ligne)', () => {
    const v = { box, date: '16 novembre', restants: 5, enLigne: true };
    expect(rediger('j7', 'fr', v)).toEqual({
      title: 'Ton accès se termine bientôt',
      body: 'Ton accès à Box Lyon se termine le 16 novembre. Passe au paiement en ligne pour continuer à réserver, sans payer deux fois.',
      bouton: 'Passer au paiement en ligne',
    });
    expect(rediger('j7', 'en', { ...v, date: 'November 16' })).toEqual({
      title: 'Your access ends soon',
      body: "Your access to Box Lyon ends on November 16. Switch to online payment to keep booking — you won't pay twice.",
      bouton: 'Switch to online payment',
    });
    expect(rediger('j1', 'fr', { ...v, restants: 1 })).toEqual({
      title: 'Ton accès se termine demain',
      body: 'Ton accès à Box Lyon se termine demain. Passe au paiement en ligne pour continuer à réserver.',
      bouton: 'Passer au paiement en ligne',
    });
    expect(rediger('j1', 'fr', { ...v, restants: 0 })).toEqual({
      title: 'Ton accès se termine ce soir',
      body: 'Ton accès à Box Lyon se termine ce soir. Passe au paiement en ligne pour continuer à réserver.',
      bouton: 'Passer au paiement en ligne',
    });
    expect(rediger('j1', 'en', { ...v, restants: 1 })).toEqual({
      title: 'Your access ends tomorrow',
      body: 'Your access to Box Lyon ends tomorrow. Switch to online payment to keep booking.',
      bouton: 'Switch to online payment',
    });
    expect(rediger('j1', 'en', { ...v, restants: 0 })).toEqual({
      title: 'Your access ends tonight',
      body: 'Your access to Box Lyon ends tonight. Switch to online payment to keep booking.',
      bouton: 'Switch to online payment',
    });
    expect(rediger('fin', 'fr', v)).toEqual({
      title: 'Ton accès est terminé',
      body: 'Ton accès à Box Lyon est terminé. Active ton abonnement en ligne pour réserver à nouveau.',
      bouton: 'Activer mon abonnement en ligne',
    });
    expect(rediger('fin', 'en', v)).toEqual({
      title: 'Your access has ended',
      body: 'Your access to Box Lyon has ended. Start your online membership to book again.',
      bouton: 'Start my online membership',
    });
  });

  it('box qui ne vend pas en ligne : « rapproche-toi de ta box », sans bouton', () => {
    const v = { box, date: '16 novembre', restants: 1, enLigne: false };
    for (const kind of ['j7', 'j1', 'fin'] as const) {
      const fr = rediger(kind, 'fr', v);
      const en = rediger(kind, 'en', v);
      expect(fr.body.endsWith('Rapproche-toi de ta box pour renouveler.')).toBe(true);
      expect(en.body.endsWith('Talk to your box to renew.')).toBe(true);
      expect(fr.body).not.toMatch(/en ligne/);
      expect(en.body).not.toMatch(/online/);
      expect(fr.bouton).toBeNull();
      expect(en.bouton).toBeNull();
    }
  });

  it('j1 au moment de l\'envoi : demain la veille, ce soir le jour même', async () => {
    const veille = acces({ lignes: [ligne({ kind: 'j1', access_until: '2026-11-12' })], membre: membreOk({ cash_access_until: '2026-11-12' }) });
    await traiterFile(veille.a);
    expect(veille.lots[0][0].title).toBe('Ton accès se termine demain');
    const jour = acces({ lignes: [ligne({ kind: 'j1', access_until: '2026-11-11' })], membre: membreOk({ cash_access_until: '2026-11-11' }) });
    await traiterFile(jour.a);
    expect(jour.lots[0][0].title).toBe('Ton accès se termine ce soir');
  });

  it('vocabulaire : jamais « CrossFit » ni « Hyrox », push et e-mail', () => {
    const textes: string[] = [];
    for (const kind of ['j7', 'j1', 'fin'] as const) {
      for (const langue of ['fr', 'en'] as const) {
        for (const enLigne of [true, false]) {
          for (const restants of [0, 1, 5]) {
            const t = rediger(kind, langue, { box: 'Box Lyon', date: dateLisible('2026-11-16', langue), restants, enLigne });
            textes.push(t.title, t.body, t.bouton ?? '', htmlEmail(t, langue, 'Box Lyon'));
          }
        }
      }
    }
    expect(textes.join('\n')).not.toMatch(/crossfit|hyrox/i);
  });
});

describe('langue et date', () => {
  it('langue retenue : celle du jeton le plus récent, sinon le français', () => {
    expect(langueRetenue([])).toBe('fr');
    expect(langueRetenue([{ token: 't', language: 'en', updated_at: '2026-10-01T00:00:00Z' }])).toBe('en');
    expect(langueRetenue([{ token: 't', language: 'fr', updated_at: '2026-10-01T00:00:00Z' }])).toBe('fr');
    expect(langueRetenue([
      { token: 'a', language: 'fr', updated_at: '2026-09-01T00:00:00Z' },
      { token: 'b', language: 'en', updated_at: '2026-10-01T00:00:00Z' },
    ])).toBe('en');
    expect(langueRetenue([
      { token: 'a', language: 'en', updated_at: '2026-09-01T00:00:00Z' },
      { token: 'b', language: 'fr', updated_at: '2026-10-01T00:00:00Z' },
    ])).toBe('fr');
  });

  it('push dans la langue de chaque jeton, e-mail dans la langue retenue', async () => {
    const t = acces({
      lignes: [ligne()],
      jetons: [
        { token: 'ExponentPushToken[fr]', language: 'fr', updated_at: '2026-09-01T00:00:00Z' },
        { token: 'ExponentPushToken[en]', language: 'en', updated_at: '2026-10-01T00:00:00Z' },
      ],
    });
    await traiterFile(t.a);
    expect(t.lots[0].map((x) => [x.to, x.title])).toEqual([
      ['ExponentPushToken[fr]', 'Ton accès se termine bientôt'],
      ['ExponentPushToken[en]', 'Your access ends soon'],
    ]);
    expect(t.emails[0].subject).toBe('Your access ends soon');
    expect(t.emails[0].html).toContain('November 16');
  });

  it('sans jeton : e-mail en français', async () => {
    const t = acces({ lignes: [ligne()], jetons: [] });
    await traiterFile(t.a);
    expect(t.lots).toEqual([]);
    expect(t.emails[0].subject).toBe('Ton accès se termine bientôt');
    expect(t.emails[0].html).toContain('16 novembre');
  });

  it('date : « 12 novembre » / « November 12 », jours restants au jour de Paris', () => {
    expect(dateLisible('2026-11-12', 'fr')).toBe('12 novembre');
    expect(dateLisible('2026-11-12', 'en')).toBe('November 12');
    expect(dateLisible('2027-01-01', 'fr')).toBe('1 janvier');
    // 23:30 UTC le 11 = 00:30 à Paris le 12.
    expect(joursRestants('2026-11-12', new Date('2026-11-11T23:30:00Z'))).toBe(0);
    expect(joursRestants('2026-11-12', new Date('2026-11-11T22:30:00Z'))).toBe(1);
  });
});

describe('push : préférences, données, appareils', () => {
  it.each<[string, Preferences | null, number]>([
    ['sans préférences (défauts)', null, 1],
    ['tout permis', { notifications_enabled: true, box_announcements: true }, 1],
    ['interrupteur général coupé', { notifications_enabled: false, box_announcements: true }, 0],
    ['« Annonces de la box » coupé', { notifications_enabled: true, box_announcements: false }, 0],
  ])('%s', async (_nom, prefs, attendus) => {
    const t = acces({ lignes: [ligne()], prefs });
    await traiterFile(t.a);
    expect(t.lots).toHaveLength(attendus);
    // L'e-mail part même quand les push sont coupés : information de service.
    expect(t.emails).toHaveLength(1);
    expect(t.terminees[0][1]).toEqual({ push_count: attendus, email_sent: true, error: null });
  });

  it('données du push : type membership_access_ending, kind, box ; push_count = tickets ok', async () => {
    const t = acces({ lignes: [ligne({ kind: 'j1', access_until: '2026-11-12' })], membre: membreOk({ cash_access_until: '2026-11-12' }), tickets: 'error' });
    await traiterFile(t.a);
    expect(t.lots[0][0].data).toEqual({ type: 'membership_access_ending', kind: 'j1', box_id: BOX });
    expect(t.lots[0][0].sound).toBe('default');
    expect(t.terminees[0][1].push_count).toBe(0);
  });
});

describe('e-mail', () => {
  it('adresse de démo jamais écrite : email_sent faux, « demo »', async () => {
    const t = acces({ lignes: [ligne()], email: 'm042@Demo.AthleXapp.eu' });
    await traiterFile(t.a);
    expect(t.emails).toEqual([]);
    expect(t.terminees[0][1]).toEqual({ push_count: 1, email_sent: false, error: 'demo' });
  });

  it('sans adresse : rien écrit, « sans_email »', async () => {
    const t = acces({ lignes: [ligne()], email: null });
    await traiterFile(t.a);
    expect(t.emails).toEqual([]);
    expect(t.terminees[0][1].error).toBe('sans_email');
  });

  it('sujet = titre ; bouton vers /compte quand la box vend en ligne ; pied avec la box', async () => {
    const t = acces({ lignes: [ligne()] });
    await traiterFile(t.a);
    const e = t.emails[0];
    expect(e.to).toBe('membre@exemple.fr');
    expect(e.subject).toBe('Ton accès se termine bientôt');
    expect(e.html).toContain(`<a href="${URL_COMPTE}"`);
    expect(URL_COMPTE).toBe('https://athlexapp.eu/compte');
    expect(e.html).toContain('Passer au paiement en ligne');
    expect(e.html).toContain('Message envoyé par Box Lyon via AthleX.');
  });

  it('box qui ne vend pas en ligne : pas de bouton', async () => {
    const t = acces({ lignes: [ligne()], formules: [{ is_active: true, stripe_price_id: null }] });
    await traiterFile(t.a);
    expect(t.emails[0].html).not.toContain('<a ');
    expect(t.emails[0].html).toContain('Rapproche-toi de ta box pour renouveler.');
  });

  it('tout le contenu dynamique est échappé', () => {
    const nom = '<script>alert("x")</script> & Cie \'O\'';
    const t = rediger('fin', 'fr', { box: nom, date: '1 janvier', restants: 0, enLigne: true });
    const html = htmlEmail(t, 'fr', nom);
    expect(html).not.toContain('<script>');
    expect(html).toContain(echapper(nom));
    expect(echapper('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('titre et bouton échappés aussi (htmlEmail ne fait confiance à aucun texte)', () => {
    const html = htmlEmail({ title: '<i>t</i>', body: 'b', bouton: '<b>go</b>' }, 'en', 'B');
    expect(html).not.toMatch(/<i>|<b>/);
    expect(html).toContain('&lt;i&gt;t&lt;/i&gt;');
    expect(html).toContain('&lt;b&gt;go&lt;/b&gt;');
    expect(html).toContain('Message sent by B via AthleX.');
  });

  it('expéditeur constant, sur le domaine des autres envois', () => {
    expect(EXPEDITEUR).toBe('AthleX <noreply@athlexapp.eu>');
    expect(lire('supabase/functions/session-followup-cron/index.ts')).toContain('AthleX <noreply@athlexapp.eu>');
  });
});

describe('la box vend-elle en ligne (règle de internal.box_vend_en_ligne)', () => {
  const box = { name: 'B', stripe_account_id: 'acct_1', stripe_onboarding_complete: true };
  const formule = { is_active: true, stripe_price_id: 'price_1' };
  it('les trois conditions', () => {
    expect(boxVendEnLigne(box, [formule])).toBe(true);
    expect(boxVendEnLigne({ ...box, stripe_account_id: null }, [formule])).toBe(false);
    expect(boxVendEnLigne({ ...box, stripe_onboarding_complete: false }, [formule])).toBe(false);
    expect(boxVendEnLigne({ ...box, stripe_onboarding_complete: null }, [formule])).toBe(false);
    expect(boxVendEnLigne(box, [{ is_active: false, stripe_price_id: 'price_1' }])).toBe(false);
    expect(boxVendEnLigne(box, [{ is_active: true, stripe_price_id: null }])).toBe(false);
    expect(boxVendEnLigne(box, [])).toBe(false);
  });

  it('recopiée de la migration 20270151 (mêmes trois conditions)', () => {
    const sql = lire('supabase/migrations/20270151000000_paiements_comptoir_duree.sql');
    expect(sql).toContain('AND b.stripe_account_id IS NOT NULL');
    expect(sql).toContain('AND b.stripe_onboarding_complete IS TRUE');
    expect(sql).toContain('WHERE mp.box_id = b.id AND mp.is_active AND mp.stripe_price_id IS NOT NULL');
  });
});

describe('index.ts : appel par pg_cron seulement', () => {
  it('401 sans secret, ou avec un mauvais secret (fail-closed)', () => {
    expect(autorise(undefined, 's3cret')).toBe(false);
    expect(autorise('', '')).toBe(false);
    expect(autorise('s3cret', null)).toBe(false);
    expect(autorise('s3cret', 'autre')).toBe(false);
    expect(autorise('s3cret', 's3cret')).toBe(true);
  });

  const src = lire('supabase/functions/deliver-access-notices/index.ts');
  it('le contrôle précède tout accès aux données ; clé par cleSecrete()', () => {
    const garde = src.indexOf("if (!autorise(Deno.env.get('CRON_SECRET'), req.headers.get('x-cron-secret'))) {");
    expect(garde).toBeGreaterThan(-1);
    expect(src.indexOf("return json({ error: 'unauthorized' }, 401);")).toBeGreaterThan(garde);
    expect(src.indexOf('createClient(')).toBeGreaterThan(garde);
    expect(src).toContain("createClient(Deno.env.get('SUPABASE_URL')!, cleSecrete())");
  });

  it('lit la file non envoyée et non réservée ; réservation conditionnelle', () => {
    expect(src).toMatch(/\.is\('sent_at', null\)\.is\('reserved_at', null\)\s*\.order\('created_at', \{ ascending: true \}\)/);
    expect(src).toMatch(/\.update\(\{ reserved_at: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\('id', id\)\.is\('reserved_at', null\)\.is\('sent_at', null\)/);
  });

  it('journal sans donnée personnelle : ni adresse, ni corps de réponse de Resend', () => {
    expect(src).not.toMatch(/console\.(error|log|warn)\([^)]*(email|to|res\.text)/);
    expect(src).toContain("return res.ok ? { ok: true } : { ok: false, erreur: `resend_http_${res.status}` };");
  });

  it('préférence lue : notification_preferences.box_announcements (« Annonces de la box »)', () => {
    expect(src).toContain(".from('notification_preferences').select('notifications_enabled, box_announcements')");
    expect(lire('supabase/functions/send-push/regles.ts')).toContain("membership_access_ending: 'box_announcements',");
  });
});
