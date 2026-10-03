// Règles de send-box-notification, sans Deno ni réseau : testées par Jest
// (src/__tests__/sendBoxNotificationRegles.test.ts), importées par index.ts qui
// leur fournit les accès à la base (clé serveur) et à Expo.

export type Notification = {
  id: string; box_id: string; title: string; body: string | null; target: string;
  /** NULL tant que l'envoi n'a pas été tenté ; posé à 0 par `reserverEnvoi`, puis au nombre définitif. */
  delivered_count: number | null;
};
export type Preference = { user_id: string; notifications_enabled: boolean | null; box_announcements: boolean | null };
export type MessageExpo = { to: string; sound: 'default'; title: string; body: string; data: { type: 'box_notification'; box_id: string } };

/** Ce que la fonction lit et écrit, fourni par index.ts (clé serveur). */
export interface Acces {
  notification(id: string): Promise<Notification | null>;
  /** Faits nécessaires à `gerantOuCogerant`, lus pour l'appelant. */
  roleAppelant(boxId: string, userId: string): Promise<FaitsAppelant>;
  membresActifs(boxId: string): Promise<string[]>;
  estMembreActif(boxId: string, userId: string): Promise<boolean>;
  preferences(userIds: string[]): Promise<{ data: Preference[] | null; error: unknown }>;
  jetons(userIds: string[]): Promise<string[]>;
  /** Un lot de 100 messages au plus ; le JSON de la réponse d'Expo, ou null si la requête a échoué. */
  envoyerExpo(messages: MessageExpo[]): Promise<unknown>;
  /**
   * Réserve l'envoi : `UPDATE … SET delivered_count = 0 WHERE id = … AND
   * delivered_count IS NULL`, avec retour de ligne. Vrai si la ligne est
   * revenue (cet appel est le seul à envoyer), faux si un autre envoi l'a déjà
   * réservée. Une erreur de la base lève (500, rien n'est envoyé).
   */
  reserverEnvoi(notificationId: string): Promise<boolean>;
  /** Écrit `box_notifications.delivered_count` (clé serveur seulement, garde 20270142). */
  poserResultat(notificationId: string, delivered: number): Promise<void>;
  journaliser(message: string, erreur: unknown): void;
}

export type FaitsAppelant = {
  /** `boxes.owner_id` de la box de la notification. */
  ownerId: string | null;
  /** Ligne `box_members` de l'appelant dans cette box, s'il en a une. */
  ligne: { role: string | null; status: string | null } | null;
  /** `profiles.role` de l'appelant. */
  roleProfil: string | null;
};

/**
 * Même règle que `public.is_box_owner_admin(box_id)` (migration 20261101), qui
 * garde aussi l'écriture de `box_notifications` (`box_notifs_owner`, 20270142) :
 * gérant principal (`boxes.owner_id`), co-gérant (`box_members.role = 'owner'`,
 * statut actif ou absent), ou administrateur de la plateforme. Le coach et le
 * membre simple sont refusés. La fonction tourne avec la clé serveur
 * (`auth.uid()` y est nul) : la règle est donc rejouée ici sur les mêmes
 * colonnes, et le test vérifie que la fonction SQL n'a pas bougé.
 */
export function gerantOuCogerant(f: FaitsAppelant, userId: string): boolean {
  if (f.ownerId !== null && f.ownerId === userId) return true;
  if (f.ligne && f.ligne.role === 'owner' && (f.ligne.status ?? 'active') === 'active') return true;
  return f.roleProfil === 'admin' || f.roleProfil === 'super_admin';
}

/**
 * Appareils acceptés par Expo dans la réponse d'un lot : un ticket par message,
 * `status: 'ok'` quand Expo l'a pris en charge, `'error'` sinon (jeton
 * désinscrit, mal formé…). Une réponse illisible ou en erreur ne compte rien.
 */
export function compterAcceptes(reponse: unknown): number {
  const tickets = (reponse as { data?: unknown } | null)?.data;
  if (!Array.isArray(tickets)) return 0;
  return tickets.filter((t) => (t as { status?: unknown } | null)?.status === 'ok').length;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOT = 100;

export type Reponse = { status: number; body: Record<string, unknown> };

/**
 * Envoie la notification `notificationId` pour l'appelant `callerId` (JWT déjà
 * vérifié par index.ts). Réponse `{ sent, recipients, pref_disabled }`, où
 * `sent` est le nombre d'appareils qu'Expo a acceptés.
 *
 * Une notification ne part qu'une fois : 409 `Already sent` si elle a déjà un
 * résultat, ou si un envoi simultané l'a réservée avant celui-ci. La
 * réservation (`delivered_count` NULL → 0, conditionnelle) se fait après tous
 * les refus (400, 403, 404, 503), qui laissent donc NULL, et avant Expo ; le
 * nombre définitif (0 compris) est écrit après l'envoi. Une erreur levée après
 * la réservation laisse 0 : la notification n'est jamais renvoyée en double.
 */
export async function traiterEnvoi(acces: Acces, callerId: string, notificationId: string): Promise<Reponse> {
  const notif = await acces.notification(notificationId);
  if (!notif) return { status: 404, body: { error: 'Notification not found' } };

  if (!gerantOuCogerant(await acces.roleAppelant(notif.box_id, callerId), callerId)) {
    return { status: 403, body: { error: 'Not owner or co-owner of this box' } };
  }
  const DEJA_ENVOYEE: Reponse = { status: 409, body: { error: 'Already sent' } };
  if (notif.delivered_count !== null) return DEJA_ENVOYEE;

  let recipientIds: string[];
  if (notif.target === 'all') {
    recipientIds = await acces.membresActifs(notif.box_id);
  } else {
    // SÉCURITÉ (Lot 6B) : une cible nominative doit être un MEMBRE ACTIF de la
    // box. `box_notifications.target` est un text libre sans FK : sans ce
    // contrôle, un gérant poussait un message signé AthleX à n'importe quel
    // utilisateur de la plateforme (trou jumeau de celui fermé sur send-push).
    if (typeof notif.target !== 'string' || !UUID_RE.test(notif.target)) {
      return { status: 400, body: { error: 'Invalid target' } };
    }
    if (!(await acces.estMembreActif(notif.box_id, notif.target))) {
      return { status: 403, body: { error: 'Target is not an active member of this box' } };
    }
    recipientIds = [notif.target];
  }

  // ── PRÉFÉRENCES (2026-08-16) ───────────────────────────────────────────────
  // Une annonce du gérant ne passe pas par send-push (elle parle à Expo
  // directement) : le filtre des réglages est appliqué ici, sur la même clé.
  // Ligne de préférence absente = annonce autorisée (défaut true).
  let disabled = new Set<string>();
  if (recipientIds.length > 0) {
    const { data: prefs, error: prefsErr } = await acces.preferences(recipientIds);
    if (prefsErr) return { status: 503, body: { error: 'Preferences unavailable', sent: 0 } };
    disabled = new Set(
      (prefs ?? [])
        .filter((p) => p.notifications_enabled === false || p.box_announcements === false)
        .map((p) => p.user_id),
    );
    recipientIds = recipientIds.filter((id) => !disabled.has(id));
  }

  // Plus aucun refus possible : réservation, puis envoi.
  if (!(await acces.reserverEnvoi(notif.id))) return DEJA_ENVOYEE;

  // Résultat définitif : écrit sur la ligne, puis rendu.
  const resultat = async (sent: number, recipients: number): Promise<Reponse> => {
    try {
      await acces.poserResultat(notif.id, sent);
    } catch (e) {
      acces.journaliser('send-box-notification : delivered_count non écrit', e);
    }
    return { status: 200, body: { sent, recipients, pref_disabled: disabled.size } };
  };

  if (recipientIds.length === 0) return resultat(0, 0);

  const list = (await acces.jetons(recipientIds)).filter(Boolean);
  if (list.length === 0) return resultat(0, recipientIds.length);

  const messages: MessageExpo[] = list.map((token) => ({
    to: token,
    sound: 'default',
    title: notif.title,
    body: notif.body ?? '',
    data: { type: 'box_notification', box_id: notif.box_id },
  }));

  let sent = 0;
  for (let i = 0; i < messages.length; i += LOT) {
    sent += compterAcceptes(await acces.envoyerExpo(messages.slice(i, i + LOT)));
  }
  return resultat(sent, recipientIds.length);
}
