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
};

/** Refus d'une action sur un membre (bannir, réactiver), traduit ; texte générique pour tout autre refus. */
export function memberActionRefusal(message: string | null | undefined): string {
  const code = refusalCode(message);
  const key = code ? MEMBER_REFUSALS[code] : undefined;
  return i18n.t(key ?? 'auth.errors.generic');
}

/** Refus d'une box archivée ou en archivage programmé, traduit ; null pour tout autre message. */
export function boxClosedRefusal(message: string | null | undefined, entry: 'join' | 'offer'): string | null {
  const code = refusalCode(message);
  if (code !== 'BOX_ARCHIVEE' && code !== 'BOX_ARCHIVAGE_PROGRAMME') return null;
  return i18n.t(entry === 'join' ? 'boxAccess.joinRefused' : 'boxAccess.offerRefused');
}
