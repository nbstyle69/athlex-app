import i18n from '../i18n';

// La base refuse en clair sous la forme « CODE: texte en français ». L'app
// affiche le texte traduit du code ; le texte de la base n'est jamais montré.
export function refusalCode(message: string | null | undefined): string | null {
  return /^([A-Z][A-Z_]+):/.exec(message ?? '')?.[1] ?? null;
}

const TOURNAMENT_REFUSALS: Record<string, string> = {
  TOURNOI_ARCHIVE: 'archived',
  TOURNOI_INCONNU: 'unknownTournament',
  HORS_BOX: 'outsideBox',
  GENRE_CIBLE: 'category',
  TOURNOI_COMPLET: 'full',
  TABLEAU_DEJA_TIRE: 'bracketDrawn',
  DIVISION_INDISPONIBLE: 'divisionUnavailable',
  DIVISION_PLEINE: 'divisionFull',
};

/** Refus d'inscription à un tournoi, traduit. `INSCRIPTIONS_FERMEES` a deux sens : démarré ou terminé. */
export function tournamentRefusal(message: string | null | undefined, status: string | null | undefined): string {
  const code = refusalCode(message);
  if (code === 'INSCRIPTIONS_FERMEES') {
    return i18n.t(status === 'active' ? 'tournament.refusal.closedStarted' : 'tournament.refusal.closedOver');
  }
  const key = code ? TOURNAMENT_REFUSALS[code] : undefined;
  return i18n.t(`tournament.refusal.${key ?? 'generic'}`);
}

const MEMBER_REFUSALS: Record<string, string> = {
  MEMBRE_ABONNEMENT_EN_COURS: 'bo.members.refusal.banActiveMembership',
  REACTIVATION_ABONNEMENT_EN_COURS: 'bo.members.refusal.reactivateActiveMembership',
  MEMBRE_ROLE_COGERANT_RESERVE: 'bo.members.refusal.coOwnerReserved',
};

type RefusalError = { code?: string; message?: string };

/**
 * Refus d'une action sur un membre (rôle, bannir, réactiver), traduit. Un 42501 sans code connu
 * (RLS, droits) a son propre texte ; tout autre refus, le texte générique.
 */
export function memberActionRefusal(error: string | RefusalError | null | undefined): string {
  const err: RefusalError = typeof error === 'string' ? { message: error } : error ?? {};
  const code = refusalCode(err.message);
  const key = (code ? MEMBER_REFUSALS[code] : undefined)
    ?? (err.code === '42501' ? 'bo.members.refusal.notAllowed' : 'auth.errors.generic');
  return i18n.t(key);
}

/**
 * Résultat d'une écriture sur un membre : null si elle est enregistrée, sinon le message à afficher.
 * Aucune ligne rendue (RLS qui filtre sans erreur) ou `false` d'une RPC vaut échec.
 */
export function memberWriteRefusal(result: { data: unknown; error: RefusalError | null }): string | null {
  if (result.error) return memberActionRefusal(result.error);
  const d = result.data;
  if (d == null || d === false || (Array.isArray(d) && d.length === 0)) return i18n.t('bo.members.refusal.notSaved');
  return null;
}

const RESERVATION_REFUSALS: Record<string, string> = {
  MEMBERSHIP_PAST_DUE: 'reservation.pastDue',
  NO_ACTIVE_PLAN: 'reservation.noActivePlan',
  RESERVATION_BOX_MISMATCH: 'reservation.boxMismatch',
};

/**
 * Refus d'une réservation ou d'une inscription en liste d'attente, traduit ; null pour tout autre erreur.
 * Le refus RLS (42501) n'a pas de code dans son message : à l'insertion d'une réservation, c'est que le
 * compte n'est plus membre actif de la box (migration 20270134).
 */
export function reservationRefusal(error: { code?: string; message?: string } | null | undefined): { code: string; title: string; body: string } | null {
  const code = refusalCode(error?.message);
  const key = code ? RESERVATION_REFUSALS[code] : error?.code === '42501' ? 'reservation.notMember' : undefined;
  if (!key) return null;
  return { code: code ?? 'NOT_MEMBER', title: i18n.t(`${key}Title`), body: i18n.t(`${key}Body`) };
}

/** Refus d'une box archivée ou en archivage programmé, traduit ; null pour tout autre message. */
export function boxClosedRefusal(message: string | null | undefined, entry: 'join' | 'offer'): string | null {
  const code = refusalCode(message);
  if (code !== 'BOX_ARCHIVEE' && code !== 'BOX_ARCHIVAGE_PROGRAMME') return null;
  return i18n.t(entry === 'join' ? 'boxAccess.joinRefused' : 'boxAccess.offerRefused');
}

// Codes de la base → clé i18n, tous refus confondus (tables ci-dessus regroupées,
// plus les codes génériques des fonctions SQL).
const CODE_KEYS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TOURNAMENT_REFUSALS).map(([c, k]) => [c, `tournament.refusal.${k}`])),
  INSCRIPTIONS_FERMEES: 'errors.registrationClosed',
  ...MEMBER_REFUSALS,
  ...Object.fromEntries(Object.entries(RESERVATION_REFUSALS).map(([c, k]) => [c, `${k}Body`])),
  BOX_ARCHIVEE: 'boxAccess.joinRefused',
  BOX_ARCHIVAGE_PROGRAMME: 'boxAccess.joinRefused',
  NOT_AUTHENTICATED: 'errors.notAuthenticated',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  WOD_INTROUVABLE: 'errors.wodNotFound',
  BANNED: 'errors.banned',
  MEMBER_BANNED: 'errors.banned',
};

// Messages français sans code, renvoyés tels quels par la base et visibles d'un athlète.
const MESSAGE_KEYS: Record<string, string> = {
  'Code invalide ou box introuvable': 'boxAccess.invalidCode',
  'Non autorisé': 'errors.forbidden',
  'Non authentifié': 'errors.notAuthenticated',
  'WOD introuvable': 'errors.wodNotFound',
};

/** Clé i18n d'un message d'erreur de la base ou d'une fonction Edge ; null s'il n'est pas reconnu. */
function errorKey(message: string): string | null {
  const code = refusalCode(message) ?? (/^[A-Z][A-Z_]+$/.test(message) ? message : null);
  if (code && CODE_KEYS[code]) return CODE_KEYS[code];
  const text = message.trim().replace(/\.$/, '');
  if (MESSAGE_KEYS[text]) return MESSAGE_KEYS[text];
  // « Accès refusé : gérant ou co-gérant de la box requis » et ses variantes (coach, staff…).
  if (/^Accès refusé\s*:\s*(gérant|staff)/.test(text)) return 'errors.staffOnly';
  if (/^Accès refusé\s*:/.test(text)) return 'errors.forbidden';
  return null;
}

type FunctionsHttpErrorLike = { name: string; context?: { text?: () => Promise<string> } };

/** Corps d'une réponse d'erreur de fonction Edge : `{ error }`, `{ message }` ou texte brut. */
async function edgeErrorBody(e: FunctionsHttpErrorLike): Promise<string | null> {
  try {
    const raw = (await e.context?.text?.()) ?? '';
    try {
      const body = JSON.parse(raw);
      const msg = body?.error ?? body?.message;
      return typeof msg === 'string' ? msg : raw || null;
    } catch {
      return raw || null;
    }
  } catch {
    return null;
  }
}

/**
 * Message à afficher pour une erreur (base, fonction Edge, exception) : traduit
 * si le code ou le texte est reconnu ; sinon le message brut en français, et le
 * message générique en anglais (le texte brut de la base est en français).
 */
export async function errorMessage(e: unknown): Promise<string> {
  let message: string | null = null;
  if (typeof e === 'string') message = e;
  else if (e && typeof e === 'object') {
    const err = e as FunctionsHttpErrorLike & { message?: unknown };
    if (err.name === 'FunctionsHttpError') message = await edgeErrorBody(err);
    if (!message && typeof err.message === 'string') message = err.message;
  }
  if (!message?.trim()) return i18n.t('errors.generic');
  const key = errorKey(message);
  if (key) return i18n.t(key);
  return i18n.language === 'en' ? i18n.t('errors.generic') : message;
}
