// Règles de deliver-manager-notifications, sans Deno ni réseau : testées par
// Jest (src/__tests__/deliverManagerNotificationsRegles.test.ts), importées par
// index.ts qui leur fournit les accès à la base (clé serveur) et à Expo.
// Conception : docs/NOTIFS_GERANT.md.

/** Les types de la file : ceux de la contrainte box_manager_notifications_type_check (contrôlé par le test). */
export const TYPES_NOTIF = [
  'subscription_paid', 'payment_failed', 'booked_without_plan', 'invitation_accepted', 'plan_change_request',
] as const;
export type TypeNotif = typeof TYPES_NOTIF[number];

/** Une ligne de `box_manager_notifications` à envoyer (migration 20270143). */
export type Ligne = {
  id: string;
  box_id: string;
  type: TypeNotif;
  member_id: string;
  plan_id: string | null;
  class_starts_at: string | null;
  /** Le gérant qui a fait le geste (inscription sans formule) : pas notifié de son propre geste. */
  actor_id: string | null;
  attempts: number;
};
export type Box = { name: string; owner_id: string | null; archived_at: string | null };
export type LigneStaff = { member_id: string; role: string | null; status: string | null };
export type Jeton = { token: string | null; user_id: string; language?: string | null };
export type MessageExpo = {
  to: string; sound: 'default'; title: string; body: string; data: { type: TypeNotif; box_id: string };
};
export type ResultatExpo = { ok: true; reponse: unknown } | { ok: false; erreur: string };

/**
 * Échec attendu, dont le message est un code court SANS donnée personnelle,
 * recopié tel quel dans `last_error`. Toute autre erreur devient
 * `erreur_interne` (son message pourrait contenir un e-mail, un pseudo…).
 */
export class Echec extends Error {}

/** Ce que la fonction lit et écrit, fourni par index.ts (clé serveur). */
export interface Acces {
  /** Lignes non envoyées, non réservées, attempts < MAX_TENTATIVES, créées depuis moins de 24 h, les plus anciennes d'abord. */
  aEnvoyer(limite: number): Promise<Ligne[]>;
  /**
   * Réservation conditionnelle : `UPDATE … SET claimed_at = now(), attempts =
   * attempts + 1 WHERE id = … AND sent_at IS NULL AND claimed_at IS NULL AND
   * attempts = <lu>`, avec retour de ligne. Faux : une autre exécution l'a prise.
   */
  reserver(ligne: Ligne): Promise<boolean>;
  box(boxId: string): Promise<Box | null>;
  /** Lignes `box_members` de rôle `owner` de la box (co-gérants). */
  cogerants(boxId: string): Promise<LigneStaff[]>;
  pseudo(userId: string): Promise<string | null>;
  formule(planId: string): Promise<string | null>;
  /** Comptes dont l'interrupteur général est coupé (`notifications_enabled = false`). */
  coupes(userIds: string[]): Promise<string[]>;
  jetons(userIds: string[]): Promise<Jeton[]>;
  /** Un lot de 100 messages au plus. */
  envoyerExpo(messages: MessageExpo[]): Promise<ResultatExpo>;
  /** Pose `sent_at`, `delivered_count` et `last_error` : la ligne ne repartira plus. */
  terminer(id: string, delivered: number, erreur: string | null): Promise<void>;
  /** Remet `claimed_at` à NULL avec `last_error` : nouvelle tentative à l'exécution suivante. */
  liberer(id: string, erreur: string): Promise<void>;
  journaliser(message: string, erreur: unknown): void;
}

export const MAX_TENTATIVES = 5;
export const LOT_FILE = 50;
const LOT_EXPO = 100;

/**
 * Gérant principal (`boxes.owner_id`, sans ligne de membre pour 3 gérants sur
 * 4) et co-gérants (`box_members.role = 'owner'`, statut actif ou absent) :
 * `is_box_owner_admin` sans sa branche « administrateur de la plateforme »,
 * qui ouvre un accès et n'est pas un rôle dans la box. Le coach et le membre
 * simple ne sont jamais servis. L'auteur du geste est retiré.
 */
export function destinataires(box: Box, staff: LigneStaff[], auteur: string | null): string[] {
  const ids = new Set<string>();
  if (box.owner_id) ids.add(box.owner_id);
  for (const l of staff) {
    if (l.role === 'owner' && (l.status ?? 'active') === 'active') ids.add(l.member_id);
  }
  if (auteur) ids.delete(auteur);
  return [...ids];
}

/**
 * Appareils acceptés = tickets « ok » d'Expo : la règle de
 * send-box-notification, recopiée (un import entre fonctions ne passe pas
 * ts-jest) ; le test vérifie qu'elles rendent la même chose.
 */
export function compterAcceptes(reponse: unknown): number {
  const tickets = (reponse as { data?: unknown } | null)?.data;
  if (!Array.isArray(tickets)) return 0;
  return tickets.filter((t) => (t as { status?: unknown } | null)?.status === 'ok').length;
}

/** Heure d'un cours, à Paris, en HH:MM. */
export function heureParis(instant: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(instant));
}

export type Valeurs = { membre: string | null; formule: string | null; heure: string | null; box: string };

/** Textes validés par Nab (D4a). Un nom manquant (formule supprimée…) a son repli. */
export function rediger(type: TypeNotif, langue: 'fr' | 'en', v: Valeurs): { title: string; body: string } {
  if (langue === 'en') {
    const membre = v.membre ?? 'A member';
    const formule = v.formule ?? 'their plan';
    switch (type) {
      case 'subscription_paid': return { title: 'New subscription', body: `${membre} subscribed to ${formule}.` };
      case 'payment_failed': return { title: 'Payment failed', body: `${membre}'s payment for ${formule} failed.` };
      case 'booked_without_plan': return {
        title: 'Booking without a plan',
        body: v.heure
          ? `${membre} was booked into the ${v.heure} class without an active plan.`
          : `${membre} was booked into a class without an active plan.`,
      };
      case 'invitation_accepted': return { title: 'Invitation accepted', body: `${membre} joined ${v.box}.` };
      case 'plan_change_request': return { title: 'Plan change request', body: `${membre} asked to switch to ${formule}.` };
    }
  }
  const membre = v.membre ?? 'Un membre';
  const formule = v.formule ?? 'sa formule';
  switch (type) {
    case 'subscription_paid': return { title: 'Nouvel abonnement', body: `${membre} a souscrit ${formule}.` };
    case 'payment_failed': return { title: 'Paiement échoué', body: `Le paiement de ${membre} pour ${formule} a échoué.` };
    case 'booked_without_plan': return {
      title: 'Inscription sans formule',
      body: v.heure
        ? `${membre} a été inscrit au cours de ${v.heure} sans formule active.`
        : `${membre} a été inscrit à un cours sans formule active.`,
    };
    case 'invitation_accepted': return { title: 'Invitation acceptée', body: `${membre} a rejoint ${v.box}.` };
    case 'plan_change_request': return { title: 'Demande de changement de formule', body: `${membre} demande à passer à ${formule}.` };
  }
}

export type Bilan = { lues: number; envoyees: number; echecs: number; prises_ailleurs: number };

/**
 * Traite un lot de la file. Chaque ligne est réservée avant tout envoi (une
 * seule exécution l'envoie), puis terminée (`sent_at`) ou libérée pour une
 * nouvelle tentative (`last_error`, code sans donnée personnelle). Une ligne
 * réservée dont l'exécution meurt avant le résultat n'est jamais reprise :
 * un double envoi est pire qu'un oubli.
 */
export async function traiterFile(acces: Acces): Promise<Bilan> {
  const lignes = await acces.aEnvoyer(LOT_FILE);
  const bilan: Bilan = { lues: lignes.length, envoyees: 0, echecs: 0, prises_ailleurs: 0 };

  for (const ligne of lignes) {
    if (ligne.attempts >= MAX_TENTATIVES) continue;
    if (!(await acces.reserver(ligne))) {
      bilan.prises_ailleurs++;
      continue;
    }
    // Après la réservation, toute issue écrit la ligne : terminée ou libérée.
    let issue: Issue;
    try {
      issue = await envoyerLigne(acces, ligne);
    } catch (e) {
      // Levée avant tout envoi à Expo : la ligne peut repartir.
      acces.journaliser('deliver-manager-notifications : envoi en échec', e);
      issue = { ok: false, erreur: e instanceof Echec ? e.message : 'erreur_interne' };
    }
    if (issue.ok) bilan.envoyees++;
    else bilan.echecs++;
    try {
      if (issue.ok) await acces.terminer(ligne.id, issue.delivered, issue.erreur);
      else await acces.liberer(ligne.id, issue.erreur);
    } catch (e) {
      // La ligne reste réservée : jamais reprise, donc jamais envoyée deux fois.
      acces.journaliser('deliver-manager-notifications : résultat non écrit', e);
    }
  }
  return bilan;
}

type Issue = { ok: true; delivered: number; erreur: string | null } | { ok: false; erreur: string };

async function envoyerLigne(acces: Acces, ligne: Ligne): Promise<Issue> {
  const box = await acces.box(ligne.box_id);
  if (!box) return { ok: true, delivered: 0, erreur: 'box_absente' };
  if (box.archived_at) return { ok: true, delivered: 0, erreur: 'box_archivee' };

  let ids = destinataires(box, await acces.cogerants(ligne.box_id), ligne.actor_id);
  if (ids.length > 0) {
    const coupes = new Set(await acces.coupes(ids));
    ids = ids.filter((id) => !coupes.has(id));
  }
  if (ids.length === 0) return { ok: true, delivered: 0, erreur: null };

  const jetons = (await acces.jetons(ids)).filter((j) => j.token && ids.includes(j.user_id));
  if (jetons.length === 0) return { ok: true, delivered: 0, erreur: null };

  const valeurs: Valeurs = {
    membre: await acces.pseudo(ligne.member_id),
    formule: ligne.plan_id ? await acces.formule(ligne.plan_id) : null,
    heure: ligne.class_starts_at ? heureParis(ligne.class_starts_at) : null,
    box: box.name,
  };
  const messages: MessageExpo[] = jetons.map((j) => ({
    to: j.token as string,
    sound: 'default',
    ...rediger(ligne.type, j.language === 'en' ? 'en' : 'fr', valeurs),
    data: { type: ligne.type, box_id: ligne.box_id },
  }));

  let delivered = 0;
  for (let i = 0; i < messages.length; i += LOT_EXPO) {
    const r = await acces.envoyerExpo(messages.slice(i, i + LOT_EXPO));
    if (!r.ok) {
      // Rien de parti : nouvelle tentative. Un lot déjà parti : on s'arrête là,
      // sans renvoyer les appareils déjà servis.
      return i === 0 ? { ok: false, erreur: r.erreur } : { ok: true, delivered, erreur: r.erreur };
    }
    delivered += compterAcceptes(r.reponse);
  }
  return { ok: true, delivered, erreur: null };
}
