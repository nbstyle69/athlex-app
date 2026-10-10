// Chantier anglais, groupe Profil & Accueil : pluriels des nouvelles clés _one / _other
// (count = 1 et 12), corrections validées, et textes que l'instantané rendu
// (i18nProfil.rn.test.tsx) n'atteint pas : le français reste le littéral de master.
import i18n from '../i18n';

afterAll(async () => { await i18n.changeLanguage('fr'); });

describe('Profil & Accueil : français', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each([
    // Onglets du gérant et du coach (navigation/index.tsx).
    ['tabs.schedule', undefined, 'Horaires'],
    ['tabs.members', undefined, 'Membres'],
    ['tabs.profile', undefined, 'Profil'],
    // Erreurs rendues par AuthContext et affichées par l'appelant.
    ['errors.notConnected', undefined, 'Non connecté'],
    ['errors.notInBox', undefined, 'Pas dans une box'],
    ['bo.wods.unknownError', undefined, 'Erreur inconnue'],
    // Pluriels : 0 et 1 au singulier, comme le « ami{s} » de master.
    ['friends.count', { count: 0 }, '0 ami'],
    ['friends.count', { count: 1 }, '1 ami'],
    ['friends.count', { count: 12 }, '12 amis'],
    // Forme de master gardée (faute signalée, non corrigée) : « 1 matchs ».
    ['home.matches', { count: 1 }, '1 matchs'],
    // Récap de la semaine : même texte que master (« WODs » au singulier aussi, faute signalée).
    ['home.weekTotal', { res: '1 cours', wods: '1 WODs' }, '1 cours · 1 WODs cette semaine'],
    ['home.classesCount', { count: 1 }, '1 cours'],
    ['home.wodsCount', { count: 1 }, '1 WODs'],
    ['scoreEntry.scoreRecapRounds', { total: 87, count: 4, reps: 7 }, '= 87 reps (4 tour(s) + 7)'],
    ['scoreEntry.scoreRecapRounds', { total: 27, count: 1, reps: 7 }, '= 27 reps (1 tour(s) + 7)'],
    ['tourWod.scoreRecapRounds', { total: 87, count: 4, reps: 7 }, '= 87 reps (4 tour(s) + 7)'],
    // Corrections validées.
    ['leaderboard.teamMembers', { count: 1 }, '1 membre'],
    ['leaderboard.top', { name: 'Lea' }, 'Top : Lea'],
    ['mini.statJoined', undefined, 'Rejoints'],
  ] as const)('%s %j', (key, opts, expected) => {
    expect(i18n.t(key, opts)).toBe(expected);
  });
});

describe('Profil & Accueil : anglais', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  it.each([
    ['friends.count', { count: 1 }, '1 friend', { count: 12 }, '12 friends'],
    ['home.matches', { count: 1 }, '1 match', { count: 12 }, '12 matches'],
    ['home.classesCount', { count: 1 }, '1 class', { count: 12 }, '12 classes'],
    ['home.wodsCount', { count: 1 }, '1 WOD', { count: 12 }, '12 WODs'],
    ['scoreEntry.scoreRecapRounds', { total: 27, count: 1, reps: 7 }, '= 27 reps (1 round + 7)', { total: 247, count: 12, reps: 7 }, '= 247 reps (12 rounds + 7)'],
    ['tourWod.scoreRecapRounds', { total: 27, count: 1, reps: 7 }, '= 27 reps (1 round + 7)', { total: 247, count: 12, reps: 7 }, '= 247 reps (12 rounds + 7)'],
    ['leaderboard.teamMembers', { count: 1 }, '1 member', { count: 12 }, '12 members'],
  ] as const)('pluriel anglais de %s : count = 1 et count = 12', (key, o1, one, o12, twelve) => {
    expect(i18n.t(key, o1)).toBe(one);
    expect(i18n.t(key, o12)).toBe(twelve);
  });
  it('récapitulatif AMRAP : « 4 rounds » et non « round(s) »', () => {
    expect(i18n.t('scoreEntry.scoreRecapRounds', { total: 87, count: 4, reps: 7 })).toBe('= 87 reps (4 rounds + 7)');
  });
  it('initiales des jours en anglais', () => {
    expect(i18n.t('home.dayInitials', { returnObjects: true })).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });
  it('lexique : Classement = Leaderboard', () => {
    expect([
      i18n.t('mini.boardTitleCategory', { cat: 'RX', n: 8 }),
      i18n.t('profile.badges.categories.Classement'),
      i18n.t('profile.badges.categories.elo'),
    ]).toEqual(['RX leaderboard (8)', 'Leaderboard', 'ELO leaderboard']);
  });
  it.each([
    ['tabs.schedule', 'Schedule'],
    ['tabs.members', 'Members'],
    ['errors.notConnected', 'Not signed in'],
    ['errors.notInBox', 'Not in a box'],
    ['auth.embeddedBundle', 'embedded'],
    ['profile.account.progOngoing', 'Ongoing · 3d/wk'],
  ])('%s', (key, expected) => {
    expect(i18n.t(key, { days: 3 })).toBe(expected);
  });
});
