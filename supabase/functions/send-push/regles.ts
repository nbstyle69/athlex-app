// Règles pures de send-push, sans Deno ni réseau : testées par Jest
// (src/__tests__/sendPushRegles.test.ts), importées par index.ts.

// Mapping unique : type de notification → colonne de notification_preferences.
// Toute famille de notification doit figurer ici. Un type absent est refusé,
// pas envoyé : ajouter une notification force à décider quel réglage la
// gouverne (c'est précisément l'oubli qui a produit le bug).
export const PREF_BY_TYPE: Record<string, string> = {
  // Social
  friend_request: 'friend_requests',
  friend_accepted: 'friend_requests',
  new_message: 'group_messages',
  score_comment: 'score_comments',
  score_reaction: 'score_reactions',
  score_overtaken: 'score_updates',
  // Entraînement
  wod_published: 'new_wod',
  // Compétition
  tournament_closed: 'tournament_updates',
  tournament_started: 'tournament_updates',
  tournament_wod_scheduled: 'tournament_updates',
  tournament_wod_open: 'tournament_updates',
  tournament_submission_reminder: 'tournament_updates',
  inter_wod_revealed: 'tournament_updates',
  inter_bracket_match: 'tournament_updates',
  inter_bracket_result: 'tournament_updates',
  inter_pool_match: 'tournament_updates',
  inter_competition_closed: 'elo_updates',
  elo_change: 'elo_updates',
  // Annonces de la box
  box_notification: 'box_announcements',
  // Abonnement arrêté par le gérant (envoyé par le Manager)
  membership_stopped: 'box_announcements',
};

// Les clés de préférence sont aussi acceptées comme catégorie : les versions
// d'app déjà installées envoient `pref_key`, il ne s'agit pas de les casser.
const PREF_KEYS = new Set<string>(Object.values(PREF_BY_TYPE));

/** Colonne de préférence gouvernant cet appel, ou null si non résoluble. */
export function resolvePrefKey(
  category: unknown, legacyPrefKey: unknown, types: string[],
): string | null {
  for (const raw of [category, legacyPrefKey]) {
    if (typeof raw === 'string' && raw) {
      if (PREF_KEYS.has(raw)) return raw;
      if (PREF_BY_TYPE[raw]) return PREF_BY_TYPE[raw];
      return null; // catégorie fournie mais inconnue → refus, pas de repli
    }
  }
  const keys = new Set(types.map((t) => PREF_BY_TYPE[t]).filter(Boolean));
  // Un lot mélangeant deux familles n'a pas de réglage unique : refusé plutôt
  // que d'en choisir un au hasard.
  return keys.size === 1 ? [...keys][0] : null;
}

// Types qui annoncent un fait que seul le serveur établit : acceptés par le
// seul chemin serveur (`x-cron-secret`), jamais d'un utilisateur connecté,
// même gérant ou co-membre (il se ferait passer pour la box). Aucun n'est
// envoyé par un utilisateur : les annonces passent par send-box-notification,
// et elo_change n'a aucun émetteur.
export const SERVER_ONLY_TYPES = new Set<string>(['membership_stopped', 'box_notification', 'elo_change']);

// Catégories (clés de préférence) réservées au serveur : une notification
// rangée sous « annonces de la box » vient de la box, jamais d'un membre, avec
// ou sans type, qu'elle soit demandée par category, pref_key ou déduite du type.
export const SERVER_ONLY_CATEGORIES = new Set<string>(['box_announcements']);

// Catégories réservées au staff : un utilisateur connecté ne les envoie que
// s'il gère (gérant, co-gérant ou coach) une box qui contient TOUS les
// destinataires. « Nouveau WOD » annonce une publication de la box.
export const STAFF_ONLY_CATEGORIES = new Set<string>(['new_wod']);

/**
 * Une box gérée par l'appelant qui contient tous les destinataires, ou null.
 * `members` : paires (box, membre actif ou propriétaire) des box gérées.
 */
export function boxCoveringAll(
  managedBoxIds: string[], members: { box_id: string; member_id: string }[], recipients: string[],
): string | null {
  for (const box of new Set(managedBoxIds)) {
    const inBox = new Set(members.filter((m) => m.box_id === box).map((m) => m.member_id));
    if (recipients.every((r) => inBox.has(r))) return box;
  }
  return null;
}

/** Le type réservé au serveur que demande cet appel (par data.type, category ou pref_key), ou null. */
export function serverOnlyType(
  category: unknown, legacyPrefKey: unknown, types: string[],
): string | null {
  for (const t of [category, legacyPrefKey, ...types]) {
    if (typeof t === 'string' && SERVER_ONLY_TYPES.has(t)) return t;
  }
  return null;
}

/**
 * `title` / `body` : la version unique, ou la version française quand `en` est
 * fournie. `en` : la version anglaise, envoyée aux seuls jetons enregistrés en
 * anglais ; un jeton en français ou sans langue reçoit `title` / `body`.
 */
export interface Recipient {
  user_id: string;
  title: string;
  body: string;
  en?: { title: string; body: string };
  data?: Record<string, unknown>;
}

export interface PushToken {
  token: string | null;
  user_id: string;
  language?: string | null;
}

/** Un message Expo par jeton, dans la langue enregistrée avec le jeton. */
export function buildMessages(tokens: PushToken[], byUser: Map<string, Recipient>) {
  return tokens
    .filter((t) => t.token && byUser.has(t.user_id))
    .map((t) => {
      const r = byUser.get(t.user_id)!;
      const en = t.language === 'en' && typeof r.en?.title === 'string' ? r.en : null;
      return {
        to: t.token as string,
        sound: 'default',
        title: en ? en.title : r.title,
        body: (en ? en.body : r.body) ?? '',
        data: r.data ?? {},
      };
    });
}
