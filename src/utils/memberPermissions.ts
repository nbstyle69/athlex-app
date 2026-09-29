// Règle du co-gérant (garde trg_box_members_garde_cogerant, migration 20270139) : seul le gérant
// principal (boxes.owner_id) donne ou retire le rôle co-gérant (role = 'owner'), change le statut
// d'une ligne co-gérant ou retire de la box un autre co-gérant. Un co-gérant garde la main sur sa
// propre ligne (renoncer au rôle, quitter la box) et sur les lignes member / coach.

export type MemberRole = 'member' | 'coach' | 'owner';

export interface MemberRowRef {
  member_id: string;
  role: MemberRole;
}

export interface MemberViewer {
  userId: string | null | undefined;
  principalId: string | null | undefined;
}

export interface MemberRowPermissions {
  /** Ligne réservée au gérant principal : aucune action, explication affichée. */
  reservedToPrincipal: boolean;
  canToggleCoach: boolean;
  canChangeStatus: boolean;
  /** Sa propre ligne de co-gérant : renoncer au rôle et quitter la box restent permis. */
  canRenounce: boolean;
}

export function isPrincipalManager(viewer: MemberViewer): boolean {
  return !!viewer.userId && viewer.userId === viewer.principalId;
}

/** Rôles que l'écran peut attribuer : jamais co-gérant, qui se nomme depuis le Manager. */
export function assignableRoles(): MemberRole[] {
  return ['member', 'coach'];
}

export function memberRowPermissions(viewer: MemberViewer, row: MemberRowRef): MemberRowPermissions {
  const principal = isPrincipalManager(viewer);
  const coOwnerRow = row.role === 'owner' || (!!viewer.principalId && row.member_id === viewer.principalId);
  const self = !!viewer.userId && row.member_id === viewer.userId;
  const reserved = coOwnerRow && !principal && !self;
  return {
    reservedToPrincipal: reserved,
    canToggleCoach: row.role !== 'owner' && !reserved,
    canChangeStatus: !reserved,
    canRenounce: row.role === 'owner' && self && !principal,
  };
}
