import i18n from '../i18n';
import { assignableRoles, isPrincipalManager, memberRowPermissions, MemberViewer } from '../utils/memberPermissions';
import { memberActionRefusal, memberWriteRefusal } from '../utils/refusals';

// Box de test : P gérant principal (boxes.owner_id), C1 et C2 co-gérants, M membre.
const PRINCIPAL: MemberViewer = { userId: 'P', principalId: 'P' };
const COOWNER: MemberViewer = { userId: 'C1', principalId: 'P' };
const rows = {
  principal: { member_id: 'P', role: 'owner' as const },
  self: { member_id: 'C1', role: 'owner' as const },
  other: { member_id: 'C2', role: 'owner' as const },
  coach: { member_id: 'K', role: 'coach' as const },
  member: { member_id: 'M', role: 'member' as const },
};
const COGERANT = 'MEMBRE_ROLE_COGERANT_RESERVE: seul le gérant principal nomme ou retire un co-gérant.';

describe('gérant principal : boxes.owner_id de la box active', () => {
  it('le gérant principal est reconnu, le co-gérant non', () => {
    expect(isPrincipalManager(PRINCIPAL)).toBe(true);
    expect(isPrincipalManager(COOWNER)).toBe(false);
    expect(isPrincipalManager({ userId: undefined, principalId: undefined })).toBe(false);
  });
});

describe('choix du rôle', () => {
  it('ne propose jamais co-gérant', () => {
    expect(assignableRoles()).toEqual(['member', 'coach']);
  });
  it('co-gérant : rôle member / coach modifiable, jamais sur une ligne de co-gérant', () => {
    expect(memberRowPermissions(COOWNER, rows.member).canToggleCoach).toBe(true);
    expect(memberRowPermissions(COOWNER, rows.coach).canToggleCoach).toBe(true);
    expect(memberRowPermissions(COOWNER, rows.other).canToggleCoach).toBe(false);
  });
});

describe('ligne d’un autre co-gérant', () => {
  it('co-gérant : réservée au gérant principal, aucune action', () => {
    for (const row of [rows.other, rows.principal]) {
      expect(memberRowPermissions(COOWNER, row)).toEqual({
        reservedToPrincipal: true, canToggleCoach: false, canChangeStatus: false, canRenounce: false,
      });
    }
  });
  it('ligne du gérant principal, quel que soit son rôle affiché : réservée', () => {
    expect(memberRowPermissions(COOWNER, { member_id: 'P', role: 'member' }).reservedToPrincipal).toBe(true);
  });
  it('gérant principal : toutes les actions de l’écran', () => {
    expect(memberRowPermissions(PRINCIPAL, rows.other)).toEqual({
      reservedToPrincipal: false, canToggleCoach: false, canChangeStatus: true, canRenounce: false,
    });
    expect(memberRowPermissions(PRINCIPAL, rows.member)).toMatchObject({ canToggleCoach: true, canChangeStatus: true });
  });
  it('lignes member / coach : pas concernées par la règle', () => {
    expect(memberRowPermissions(COOWNER, rows.member).reservedToPrincipal).toBe(false);
    expect(memberRowPermissions(COOWNER, rows.coach).canChangeStatus).toBe(true);
  });
});

describe('sa propre ligne de co-gérant', () => {
  it('renonciation permise, ligne non réservée', () => {
    expect(memberRowPermissions(COOWNER, rows.self)).toMatchObject({
      reservedToPrincipal: false, canChangeStatus: true, canRenounce: true,
    });
  });
});

describe.each([
  ['fr', {
    coOwner: 'Seul le gérant principal de la box peut nommer ou retirer un co-gérant.',
    notAllowed: "Tu n'as pas les droits pour cette action : rien n'a été enregistré.",
    notSaved: "La modification n'a pas été enregistrée. Actualise la liste et réessaie.",
  }],
  ['en', {
    coOwner: "Only the box's main manager can appoint or remove a co-manager.",
    notAllowed: "You don't have permission for this action: nothing was saved.",
    notSaved: "The change wasn't saved. Refresh the list and try again.",
  }],
] as const)('refus d’écriture (%s)', (lang, attendu) => {
  beforeAll(async () => { await i18n.changeLanguage(lang); });

  it('MEMBRE_ROLE_COGERANT_RESERVE (42501) : message du co-gérant', () => {
    expect(memberActionRefusal({ code: '42501', message: COGERANT })).toBe(attendu.coOwner);
    expect(memberWriteRefusal({ data: null, error: { code: '42501', message: COGERANT } })).toBe(attendu.coOwner);
  });
  it('autre 42501 : message de droits, jamais le texte de la base', () => {
    const rls = { code: '42501', message: 'new row violates row-level security policy for table "box_members"' };
    expect(memberWriteRefusal({ data: null, error: rls })).toBe(attendu.notAllowed);
  });
  it('aucune ligne modifiée ou RPC à false : échec', () => {
    expect(memberWriteRefusal({ data: [], error: null })).toBe(attendu.notSaved);
    expect(memberWriteRefusal({ data: false, error: null })).toBe(attendu.notSaved);
    expect(memberWriteRefusal({ data: null, error: null })).toBe(attendu.notSaved);
  });
  it('écriture enregistrée : aucun message', () => {
    expect(memberWriteRefusal({ data: [{ id: 'row' }], error: null })).toBeNull();
    expect(memberWriteRefusal({ data: true, error: null })).toBeNull();
  });
});
