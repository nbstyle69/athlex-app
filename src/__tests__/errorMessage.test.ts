import { FunctionsHttpError } from '@supabase/functions-js';

import i18n from '../i18n';
import { errorMessage } from '../utils/refusals';

const pg = (message: string, code = 'P0001') => ({ message, code, details: null, hint: null });
const edge = (status: number, body: unknown) =>
  new FunctionsHttpError(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

describe.each([
  ['fr', {
    generic: 'Une erreur est survenue. Réessaie dans un instant.',
    notAuthenticated: 'Ta session a expiré : reconnecte-toi.',
    forbidden: "Tu n'as pas les droits pour cette action.",
    staffOnly: "Action réservée à l'équipe de la box (gérant, co-gérant ou coach).",
    wodNotFound: "Ce WOD n'existe plus.",
    invalidCode: 'Code invalide ou box introuvable.',
    full: 'Le tournoi est complet.',
    pastDue: 'Ton dernier prélèvement a échoué : les réservations sont suspendues. Mets ton moyen de paiement à jour ou contacte ta box pour rétablir ton accès.',
  }],
  ['en', {
    generic: 'Something went wrong. Please try again shortly.',
    notAuthenticated: 'Your session has expired. Please sign in again.',
    forbidden: "You don't have permission to do this.",
    staffOnly: 'Only the box team (owner, co-owner or coach) can do this.',
    wodNotFound: 'This WOD no longer exists.',
    invalidCode: 'Invalid code or box not found.',
    full: 'The tournament is full.',
    pastDue: 'Your last payment failed, so bookings are suspended. Update your payment method or contact your gym to restore access.',
  }],
])('errorMessage en %s', (lang, txt) => {
  beforeAll(() => i18n.changeLanguage(lang));
  afterAll(() => i18n.changeLanguage('fr'));

  describe('(a) code connu', () => {
    it('« CODE: texte » de la base', async () => {
      expect(await errorMessage(pg('NOT_AUTHENTICATED: connexion requise'))).toBe(txt.notAuthenticated);
      expect(await errorMessage(pg('FORBIDDEN: réservé au gérant'))).toBe(txt.forbidden);
      expect(await errorMessage(pg('TOURNOI_COMPLET: le nombre maximal de participants est atteint.'))).toBe(txt.full);
    });
    it('code seul', async () => {
      expect(await errorMessage(pg('WOD_INTROUVABLE'))).toBe(txt.wodNotFound);
    });
    it('les tables existantes (réservation) sont reprises', async () => {
      expect(await errorMessage(pg('MEMBERSHIP_PAST_DUE: paiement en retard'))).toBe(txt.pastDue);
    });
  });

  describe('(b) message français exact', () => {
    it.each([
      ['Code invalide ou box introuvable', 'invalidCode'],
      ['Non autorisé', 'forbidden'],
      ['Non authentifié', 'notAuthenticated'],
      ['WOD introuvable', 'wodNotFound'],
      ['Accès refusé : gérant ou co-gérant de la box requis', 'staffOnly'],
      ['Accès refusé : gérant ou coach de la box requis', 'staffOnly'],
      ['Accès refusé : gérant ou co-gérant de la box du groupe requis.', 'staffOnly'],
      ['Accès refusé : staff de la box du programme requis', 'staffOnly'],
      ['Accès refusé : super-admin requis', 'forbidden'],
    ] as const)('%s', async (message, cle) => {
      expect(await errorMessage(pg(message))).toBe(txt[cle]);
    });
    it('Error JS et chaîne nue', async () => {
      expect(await errorMessage(new Error('Non autorisé'))).toBe(txt.forbidden);
      expect(await errorMessage('WOD introuvable')).toBe(txt.wodNotFound);
    });
  });

  describe('(c) fonction Edge : le corps de la réponse est lu', () => {
    it('{ error: "CODE: …" }', async () => {
      expect(await errorMessage(edge(403, { error: 'FORBIDDEN: pas ta box' }))).toBe(txt.forbidden);
    });
    it('{ message: "…" } en texte exact', async () => {
      expect(await errorMessage(edge(404, { message: 'WOD introuvable' }))).toBe(txt.wodNotFound);
    });
    it('corps texte brut avec code', async () => {
      expect(await errorMessage(edge(401, 'NOT_AUTHENTICATED'))).toBe(txt.notAuthenticated);
    });
    it('corps non reconnu', async () => {
      const attendu = lang === 'fr' ? 'Daily AI limit reached' : txt.generic;
      expect(await errorMessage(edge(429, { error: 'Daily AI limit reached' }))).toBe(attendu);
    });
  });

  describe('(d) message non reconnu', () => {
    it('français : le message brut ; anglais : message générique', async () => {
      const brut = 'Semaine type introuvable pour cette offre';
      expect(await errorMessage(pg(brut))).toBe(lang === 'fr' ? brut : txt.generic);
    });
    it('code inconnu : idem', async () => {
      const brut = 'CODE_JAMAIS_VU: texte';
      expect(await errorMessage(pg(brut))).toBe(lang === 'fr' ? brut : txt.generic);
    });
    it('rien à afficher : message générique', async () => {
      expect(await errorMessage(null)).toBe(txt.generic);
      expect(await errorMessage({ message: '  ' })).toBe(txt.generic);
    });
  });
});
