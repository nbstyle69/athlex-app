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
export function reservationRefusal(error: { code?: string; message?: string } | null | undefined): { title: string; body: string } | null {
  const code = refusalCode(error?.message);
  const key = code ? RESERVATION_REFUSALS[code] : error?.code === '42501' ? 'reservation.notMember' : undefined;
  if (!key) return null;
  return { title: i18n.t(`${key}Title`), body: i18n.t(`${key}Body`) };
}

/** Refus d'une box archivée ou en archivage programmé, traduit ; null pour tout autre message. */
export function boxClosedRefusal(message: string | null | undefined, entry: 'join' | 'offer'): string | null {
  const code = refusalCode(message);
  if (code !== 'BOX_ARCHIVEE' && code !== 'BOX_ARCHIVAGE_PROGRAMME') return null;
  return i18n.t(entry === 'join' ? 'boxAccess.joinRefused' : 'boxAccess.offerRefused');
}
