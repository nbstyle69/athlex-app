import fs from 'fs';
import path from 'path';

const lire = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
// La requête `tournaments` d'un écran, de `.from('tournaments')` jusqu'à la fin de l'appel.
const requeteTournois = (src: string) => {
  const i = src.indexOf(".from('tournaments')");
  return src.slice(i, src.indexOf(')\n', src.indexOf('.order(', i)) + 1 || src.indexOf(',\n', i));
};

describe('tournois archivés masqués des listes', () => {
  it.each([
    'screens/home/HomeScreen.tsx',
    'screens/competition/CompetitionScreen.tsx',
    'screens/backoffice/BOTournamentScreen.tsx',
  ])('%s', (f) => {
    expect(requeteTournois(lire(f))).toContain(".is('archived_at', null)");
  });

  it('AdminScreen ne compte pas les tournois archivés', () => {
    expect(lire('screens/admin/AdminScreen.tsx'))
      .toContain("supabase.from('tournaments').select('id', { count: 'exact', head: true }).in('status', ['open', 'active']).is('archived_at', null)");
  });

  it("l'historique ELO garde les tournois archivés", () => {
    expect(lire('screens/profile/EloHistoryScreen.tsx')).not.toContain('archived_at');
  });
});

describe('TournamentScreen : la base décide de l\'inscription', () => {
  const src = lire('screens/competition/TournamentScreen.tsx');

  it('interroge can_join_tournament au chargement', () => {
    expect(src).toContain("supabase.rpc('can_join_tournament', { p_tournament_id: tournamentId })");
    expect(src).toContain('setCanJoin(joinable === true);');
  });

  it("le bouton suit la base, plus le statut « ouvert » seul, et jamais sur un tournoi archivé", () => {
    expect(src).toContain('const canRegister = canJoin && !isRegistered && !isArchived;');
    expect(src).not.toMatch(/canRegister = tournament\.status === 'open'/);
    expect(src).toContain("const openDuring  = tournament.status === 'active' && canJoin;");
  });

  it('pastille et indice pendant le tournoi, état archivé', () => {
    expect(src).toContain("t('tournament.badgeOpenDuring')");
    expect(src).toContain("openDuring ? t('tournament.hintOpenDuring')");
    expect(src).toContain("t('tournament.badgeArchived')");
    expect(src).toContain("isArchived ? t('tournament.hintArchived')");
  });

  it('le refus est traduit par son code, jamais affiché brut', () => {
    expect(src).toContain("Alert.alert(t('tournament.registerError'), tournamentRefusal(error.message, tournament?.status));");
    expect(src).not.toContain("Alert.alert(t('tournament.registerError'), error.message)");
  });

  it('« Se désinscrire » reste réservé aux tournois ouverts', () => {
    const i = src.indexOf("t('tournament.unregister')");
    expect(src.slice(src.lastIndexOf('{', src.lastIndexOf('<TouchableOpacity', i)) , i)).toContain("tournament.status === 'open' &&");
  });
});

describe('box archivée ou en archivage programmé', () => {
  it('joinBox traduit le refus pour les quatre écrans qui l\'appellent', () => {
    const src = lire('context/AuthContext.tsx');
    const joinBox = src.slice(src.indexOf('async function joinBox'), src.indexOf('async function skipBox'));
    expect(joinBox).toContain("boxClosedRefusal(joinErr?.message, 'join')");
    expect(joinBox).toContain("i18n.t('boxAccess.invalidCode')");
    expect(joinBox).not.toContain("?? 'Code invalide ou box introuvable'");
  });

  it("l'offre gratuite traduit le refus ; le catalogue vient de list_programming_catalog", () => {
    const src = lire('screens/backoffice/BOProgrammingScreen.tsx');
    expect(src).toContain("boxClosedRefusal(e?.message, 'offer')");
    expect(src).toContain(".rpc('list_programming_catalog', { p_box_id: currentBox.id })");
    expect(src).not.toContain(".from('box_programming')");
  });

  it("fiche de l'annuaire : « box introuvable » traduit, avec retour", () => {
    const src = lire('screens/explorer/BoxDirectoryDetailScreen.tsx');
    const introuvable = src.slice(src.indexOf('if (!box) {'), src.indexOf('function openLink'));
    expect(introuvable).toContain("t('boxAccess.notFoundTitle')");
    expect(introuvable).toContain("t('boxAccess.notFoundBody')");
    expect(introuvable).toContain('navigation.goBack()');
    expect(src).not.toContain('>Box introuvable<');
  });
});

describe('S5 côté athlète', () => {
  it('bandeau « abonnement suspendu » là où il réserve, lien de paiement seulement avec Stripe', () => {
    const src = lire('screens/reservation/ReservationScreen.tsx');
    expect(src).toContain('setSuspension(m?.suspended ? { stripe: !!m.has_stripe_subscription } : null);');
    expect(src).toContain("suspension.stripe ? t('reservation.suspendedBodyStripe') : t('reservation.suspendedBodyContact')");
    const cta = src.slice(src.indexOf('{suspension.stripe && ('), src.indexOf("t('reservation.suspendedCta')"));
    expect(cta).toContain('Linking.openURL(`${WEB_URL}/compte`)');
  });

  it("l'état de l'abonnement est affiché dans le profil", () => {
    const src = lire('screens/profile/ProfileScreen.tsx');
    expect(src).toContain('const state = membershipState(r);');
    expect(src).toContain('{membershipStateText(m.state)}');
  });

  it("la langue du jeton est revue au retour de l'app au premier plan", () => {
    const src = lire('context/AuthContext.tsx');
    expect(src).toMatch(/AppState\.addEventListener\('change', state => \{\s*if \(state === 'active'\) \{\s*refreshPushTokenLanguage\(\)/);
    expect(src).toContain('appState.remove();');
  });
});
