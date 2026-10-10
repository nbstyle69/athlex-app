// Chantier anglais, groupe Compétition : pluriels anglais des nouvelles clés _one / _other
// (count = 1 et 12), et textes que l'instantané rendu (i18nCompetition.rn.test.tsx)
// n'atteint pas : le français reste le littéral de master, au caractère près.
import i18n from '../i18n';
import { formatAmrapScore, formatScoreDisplay } from '../utils/tournamentUtils';

afterAll(async () => { await i18n.changeLanguage('fr'); });
const rounds = (n: number) => i18n.t('score.amrapRounds', { count: n });

describe('Compétition : français inchangé hors instantané', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each([
    ['mini.reservedMale', undefined, 'Ce tournoi est réservé aux hommes.'],
    ['mini.timeLeft', { h: 3, m: '05' }, '3h05 restantes'],
    ['mini.shareMessage', { name: 'Flash', url: 'athlex://daily/t1' }, 'Flash — Rejoins le mini-tournoi sur AthleX ! athlex://daily/t1'],
    ['mini.cannotOpenVideo', { url: 'https://x' }, "Impossible d'ouvrir ce lien vidéo.\n\nhttps://x"],
    ['boxRanking.subtitle', { box: i18n.t('boxRanking.theBox') }, 'ELO propre à la box — WODs de la box uniquement'],
    ['boxRanking.record', { wins: 0, count: 0 }, '0V · 0 WOD'],
    // Correction validée : singulier « 1 membre ».
    ['leaderboard.teamMembers', { count: 1 }, '1 membre'],
  ] as const)('%s %j', (key, opts, expected) => {
    expect(i18n.t(key, opts)).toBe(expected);
  });
  it('libellé des tours fourni par l’écran : même texte que l’ancien repli français', () => {
    expect([formatAmrapScore(87, 20, rounds), formatAmrapScore(20, 20, rounds), formatScoreDisplay('5', 'AMRAP', 20, false, rounds)])
      .toEqual(['87 reps (4 tours + 7)', '20 reps (1 tour)', '5 reps (0 tour + 5)']);
  });
});

describe('Compétition : anglais', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  it.each([
    ['leaderboard.teamMembers', { count: 1 }, '1 member', { count: 12 }, '12 members'],
    ['boxRanking.record', { wins: 1, count: 1 }, '1W · 1 WOD', { wins: 7, count: 12 }, '7W · 12 WODs'],
    ['community.athleteCount', { count: 1 }, '1 athlete', { count: 12 }, '12 athletes'],
  ] as const)('pluriel anglais de %s : count = 1 et count = 12', (key, o1, one, o12, twelve) => {
    expect(i18n.t(key, o1)).toBe(one);
    expect(i18n.t(key, o12)).toBe(twelve);
  });
  it('tours d’un score AMRAP en anglais', () => {
    expect([formatAmrapScore(87, 20, rounds), formatAmrapScore(20, 20, rounds)]).toEqual(['87 reps (4 rounds + 7)', '20 reps (1 round)']);
  });
  it('lexique : Classement = Leaderboard sur les écrans du groupe', () => {
    expect([i18n.t('tabs.leaderboard'), i18n.t('boxRanking.title'), i18n.t('mini.boardTitle', { n: 2, max: 5 })])
      .toEqual(['Leaderboard', 'Box leaderboard', 'Leaderboard (2/5)']);
  });
});
