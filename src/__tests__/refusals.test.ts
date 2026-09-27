import i18n from '../i18n';
import fs from 'fs';
import path from 'path';
import { refusalCode, tournamentRefusal, boxClosedRefusal, memberActionRefusal, reservationRefusal } from '../utils/refusals';

// Messages tels que la base les renvoie (déclencheur d'inscription, 20270125 ;
// refus d'entrée d'une box, 20270127).
const BASE = {
  TOURNOI_ARCHIVE: 'TOURNOI_ARCHIVE: ce tournoi est archivé, les inscriptions sont fermées.',
  TOURNOI_INCONNU: "TOURNOI_INCONNU: ce tournoi n'existe pas.",
  HORS_BOX: 'HORS_BOX: ce tournoi est réservé aux membres de la box.',
  GENRE_CIBLE: 'GENRE_CIBLE: ce tournoi est réservé à une autre catégorie.',
  TOURNOI_COMPLET: 'TOURNOI_COMPLET: le nombre maximal de participants est atteint.',
  TABLEAU_DEJA_TIRE: 'TABLEAU_DEJA_TIRE: le tableau est déjà tiré, les inscriptions sont closes.',
  DIVISION_INDISPONIBLE: "DIVISION_INDISPONIBLE: la ligue n'a pas de division ouverte aux inscriptions.",
  DIVISION_PLEINE: "DIVISION_PLEINE: la division d'entrée de la ligue est complète.",
};

describe('refusalCode', () => {
  it('lit le code en tête du message de la base', () => {
    expect(refusalCode(BASE.HORS_BOX)).toBe('HORS_BOX');
    expect(refusalCode('BOX_ARCHIVAGE_PROGRAMME: Cette box n\'accepte plus de nouveaux membres.')).toBe('BOX_ARCHIVAGE_PROGRAMME');
  });
  it('rien pour un message sans code', () => {
    expect(refusalCode('new row violates row-level security policy for table "tournament_participants"')).toBeNull();
    expect(refusalCode(undefined)).toBeNull();
  });
});

describe.each([
  ['fr', {
    TOURNOI_ARCHIVE: 'Ce tournoi est archivé : les inscriptions sont fermées.',
    TOURNOI_INCONNU: "Ce tournoi n'existe plus.",
    HORS_BOX: 'Ce tournoi est réservé aux membres de la box.',
    GENRE_CIBLE: 'Ce tournoi est réservé à une autre catégorie.',
    TOURNOI_COMPLET: 'Le tournoi est complet.',
    TABLEAU_DEJA_TIRE: 'Le tableau est déjà tiré : les inscriptions sont closes.',
    DIVISION_INDISPONIBLE: "La ligue n'a pas de division ouverte aux inscriptions.",
    DIVISION_PLEINE: "La division d'entrée de la ligue est complète.",
  }, {
    started: 'Le tournoi a démarré : les inscriptions sont closes.',
    over: 'Le tournoi est terminé.',
    generic: "L'inscription n'a pas abouti. Réessaie plus tard.",
    join: "Cette box n'accepte plus de nouveaux membres.",
    offer: "Cette box n'accepte plus de nouvel abonnement ni d'achat.",
  }],
  ['en', {
    TOURNOI_ARCHIVE: 'This tournament is archived: registration is closed.',
    TOURNOI_INCONNU: 'This tournament no longer exists.',
    HORS_BOX: 'This tournament is for members of the box only.',
    GENRE_CIBLE: 'This tournament is for another category.',
    TOURNOI_COMPLET: 'The tournament is full.',
    TABLEAU_DEJA_TIRE: 'The bracket has already been drawn: registration is closed.',
    DIVISION_INDISPONIBLE: 'The league has no division open for registration.',
    DIVISION_PLEINE: "The league's entry division is full.",
  }, {
    started: 'The tournament has started: registration is closed.',
    over: 'The tournament is over.',
    generic: 'Registration failed. Please try again later.',
    join: 'This box is no longer accepting new members.',
    offer: 'This box is no longer accepting new subscriptions or purchases.',
  }],
] as const)('refus traduits (%s)', (lang, parCode, autres) => {
  beforeAll(async () => { await i18n.changeLanguage(lang); });

  it.each(Object.keys(BASE) as (keyof typeof BASE)[])('%s', (code) => {
    expect(tournamentRefusal(BASE[code], 'open')).toBe(parCode[code]);
  });

  it('INSCRIPTIONS_FERMEES : démarré ou terminé selon le statut du tournoi', () => {
    expect(tournamentRefusal('INSCRIPTIONS_FERMEES: le tournoi a démarré, les inscriptions sont closes.', 'active')).toBe(autres.started);
    expect(tournamentRefusal('INSCRIPTIONS_FERMEES: le tournoi est terminé.', 'completed')).toBe(autres.over);
  });

  it('code inconnu ou message sans code : texte générique, jamais le texte de la base', () => {
    expect(tournamentRefusal('NOUVEAU_CODE: texte', 'open')).toBe(autres.generic);
    expect(tournamentRefusal('new row violates row-level security policy', 'open')).toBe(autres.generic);
  });

  it('box archivée ou en archivage programmé : un seul texte par entrée, quel que soit le code', () => {
    for (const code of ['BOX_ARCHIVEE', 'BOX_ARCHIVAGE_PROGRAMME']) {
      expect(boxClosedRefusal(`${code}: Cette box n'accepte plus de nouveaux membres.`, 'join')).toBe(autres.join);
      expect(boxClosedRefusal(`${code}: Cette box n'accepte plus de nouvel abonnement ni d'achat.`, 'offer')).toBe(autres.offer);
    }
  });

  it('un autre refus n\'est pas pris pour une box fermée', () => {
    expect(boxClosedRefusal('BANNED: votre acces a cette box a ete revoque', 'join')).toBeNull();
    expect(boxClosedRefusal('Code invalide ou box introuvable', 'join')).toBeNull();
  });
});

// Refus de la base sur un membre (migration 20270132), tels qu'elle les renvoie.
const BAN = 'MEMBRE_ABONNEMENT_EN_COURS: Ce membre a un abonnement en cours : bannis-le depuis le Manager, qui arrête aussi son abonnement.';
const REACT = 'REACTIVATION_ABONNEMENT_EN_COURS: Ce membre a encore un abonnement Stripe en cours : arrête-le depuis le Manager avant de le réactiver.';

describe.each([
  ['fr', {
    ban: 'Ce membre a un abonnement en cours : bannis-le depuis le Manager, qui arrête aussi son abonnement.',
    react: "Ce membre a encore un abonnement en cours : il ne peut pas être réactivé pour l'instant.",
    generic: 'Une erreur est survenue. Réessaie dans un instant.',
  }],
  ['en', {
    ban: 'This member has an active membership: ban them from the Manager, which also stops their membership.',
    react: "This member still has an active membership and can't be reactivated yet.",
    generic: 'Something went wrong. Please try again shortly.',
  }],
] as const)('refus sur un membre (%s)', (lang, attendu) => {
  beforeAll(async () => { await i18n.changeLanguage(lang); });

  it('bannissement d’un membre abonné par Stripe', () => {
    expect(memberActionRefusal(BAN)).toBe(attendu.ban);
  });
  it('réactivation avec un abonnement en cours', () => {
    expect(memberActionRefusal(REACT)).toBe(attendu.react);
  });
  it('code inconnu ou message sans code : texte générique, jamais le message de la base', () => {
    expect(memberActionRefusal("MEMBRE_FACTURATION_RESERVEE: la facturation d'un membre est écrite par le serveur")).toBe(attendu.generic);
    expect(memberActionRefusal('FORBIDDEN: reserve aux gestionnaires de la box')).toBe(attendu.generic);
    expect(memberActionRefusal('permission denied for table box_members')).toBe(attendu.generic);
    expect(memberActionRefusal(undefined)).toBe(attendu.generic);
  });
});

describe('BOMembersScreen : les refus de bannir et de réactiver sont traduits', () => {
  const src = fs.readFileSync(path.join(__dirname, '../screens/backoffice/BOMembersScreen.tsx'), 'utf8');
  const toggleBan = src.slice(src.indexOf('async function toggleBan'), src.indexOf('function formatDate'));
  it('les deux branches passent par memberActionRefusal, jamais par le message brut', () => {
    expect(toggleBan.match(/Alert\.alert\(t\('common\.error'\), memberActionRefusal\(error\.message\)\)/g)).toHaveLength(2);
    expect(toggleBan).not.toMatch(/Alert\.alert\([^)]*, error\.message\)/);
  });
});

// Refus d'une réservation (migrations 20270121 et 20270133), tels que la base les renvoie.
const PAST_DUE = "MEMBERSHIP_PAST_DUE: abonnement impayé au-delà du délai de la box — réservations et liste d'attente suspendues. Régularise ton paiement ou contacte ta box.";
const NO_PLAN = 'NO_ACTIVE_PLAN: aucune formule active dans cette box — rapproche-toi de ta box pour activer ton abonnement.';

describe.each([
  ['fr', {
    noPlan: { title: 'Pas de formule active', body: "Tu n'as pas de formule active dans cette box. Rapproche-toi de ta box pour activer ton abonnement." },
    pastDue: { title: 'Abonnement impayé', body: 'Ton dernier prélèvement a échoué : les réservations sont suspendues. Mets ton moyen de paiement à jour ou contacte ta box pour rétablir ton accès.' },
  }],
  ['en', {
    noPlan: { title: 'No active plan', body: "You don't have an active plan at this box. Contact your box to activate your membership." },
    pastDue: { title: 'Unpaid membership', body: 'Your last payment failed, so bookings are suspended. Update your payment method or contact your gym to restore access.' },
  }],
] as const)('refus d’une réservation (%s)', (lang, attendu) => {
  beforeAll(async () => { await i18n.changeLanguage(lang); });

  it('sans formule active', () => {
    expect(reservationRefusal(NO_PLAN)).toEqual(attendu.noPlan);
  });
  it('impayé : message inchangé', () => {
    expect(reservationRefusal(PAST_DUE)).toEqual(attendu.pastDue);
  });
  it('autre refus ou message sans code : null, l’écran garde son chemin d’erreur', () => {
    expect(reservationRefusal('NO_CREDITS_LEFT: aucun crédit disponible pour cette box')).toBeNull();
    expect(reservationRefusal('duplicate key value violates unique constraint')).toBeNull();
    expect(reservationRefusal(undefined)).toBeNull();
  });
});

describe('ReservationScreen : le refus d’une réservation passe par reservationRefusal', () => {
  const src = fs.readFileSync(path.join(__dirname, '../screens/reservation/ReservationScreen.tsx'), 'utf8');
  const insert = src.slice(src.indexOf('const insertReservation'), src.indexOf('if (wantsWaiting) {', src.indexOf('const insertReservation')));
  it('réservation et liste d’attente partagent ce chemin, qui affiche le refus traduit', () => {
    expect(insert).toMatch(/const refusal = reservationRefusal\(error\.message\);\s*if \(refusal\) Alert\.alert\(refusal\.title, refusal\.body\);/);
    expect(src.match(/from\('class_reservations'\)\.insert\(/g)).toHaveLength(1);
    expect(src).toMatch(/\{ text: t\('reservation\.joinWaitlist'\), onPress: insertReservation \}/);
  });
});
