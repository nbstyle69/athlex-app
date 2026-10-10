// Chantier anglais, groupe Gérant : pluriels des clés _one / _other (count = 1 et 12),
// corrections validées par Nab, « Heavy » pour l'intention Functional, et textes que
// l'instantané rendu (i18nGerant.rn.test.tsx) n'atteint pas.
import i18n from '../i18n';

const DISCIPLINES = ['training.disciplines.functional', 'training.disciplines.hybrid', 'bo.programming.disciplineHaltero', 'bo.programming.disciplineEndurance'];

afterAll(async () => { await i18n.changeLanguage('fr'); });

describe('Gérant : français', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each([
    // Bandeau d'essai : même texte que le « jour{s} restant{s} » de master.
    ['bo.trialBanner.daysLeft', { count: 1 }, '1 jour restant sur ton essai'],
    ['bo.trialBanner.daysLeft', { count: 12 }, '12 jours restants sur ton essai'],
    // Pluriels anglais ajoutés : le français garde la forme de master (faute signalée, non corrigée).
    ['bo.interComp.entrants', { count: 1 }, '1 inscrit(s)'],
    ['bo.dashboard.participantCount', { count: 12 }, '12 participant(s)'],
    ['bo.wods.importSuccessMsg', { count: 1 }, '1 WOD(s) importé(s) !'],
    ['bo.tournament.pendingScoresMsg', { count: 1 }, "1 score(s) non traité(s). Valide ou rejette-les d'abord."],
    ['errors.openLink', undefined, "Impossible d'ouvrir le lien."],
    // L'intention Functional et le type de séance gardent « Force » en français.
    ['wodGenerator.intentOpt.strength', undefined, 'Force'],
    ['bo.wods.typeStrength', undefined, 'Force'],
    // Corrections validées par Nab.
    ['profile.account.progOngoing', { days: 3 }, 'En continu · 3j/sem'],
    ['home.matches', { count: 1 }, '1 match'],
    ['home.matches', { count: 12 }, '12 matchs'],
    ['home.wodsCount', { count: 1 }, '1 WOD'],
    ['home.wodsCount', { count: 12 }, '12 WODs'],
    ['home.dayStreak', { count: 1 }, "1 jour d'affilée"],
    ['home.dayStreak', { count: 12 }, "12 jours d'affilée"],
    ['strengthSession.repsCount', { count: 1 }, '1 rep'],
    ['strengthSession.repsCount', { count: 12 }, '12 reps'],
    ['profile.stats.winRate', undefined, 'Taux de victoire'],
  ] as const)('%s %j', (key, opts, expected) => {
    expect(i18n.t(key, opts)).toBe(expected);
  });
  it('disciplines de la programmation : libellés de master', () => {
    expect(DISCIPLINES.map((k) => i18n.t(k))).toEqual(['Functional', 'Hybrid', 'Haltéro', 'Endurance']);
  });
});

describe('Gérant : anglais', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  it.each([
    ['bo.trialBanner.daysLeft', '1 day left in your trial', '12 days left in your trial'],
    ['bo.interComp.entrants', '1 entrant', '12 entrants'],
    ['bo.dashboard.participantCount', '1 participant', '12 participants'],
    ['bo.wods.importSuccessMsg', '1 WOD imported!', '12 WODs imported!'],
    ['bo.tournament.pendingScoresMsg', '1 unprocessed score. Validate or reject it first.', '12 unprocessed scores. Validate or reject them first.'],
    ['home.matches', '1 match', '12 matches'],
    ['home.wodsCount', '1 WOD', '12 WODs'],
    ['home.dayStreak', '1-day streak', '12-day streak'],
    ['strengthSession.repsCount', '1 rep', '12 reps'],
  ])('pluriel anglais de %s : count = 1 et count = 12', (key, one, twelve) => {
    expect(i18n.t(key, { count: 1 })).toBe(one);
    expect(i18n.t(key, { count: 12 })).toBe(twelve);
  });
  it('« Heavy » pour l’intention Functional, jamais deux « Strength » parmi les intentions', () => {
    const intents = ['mixed', 'cardio', 'strength', 'gymnastics'].map((k) => i18n.t(`wodGenerator.intentOpt.${k}`));
    expect(intents[2]).toBe('Heavy');
    expect(intents.filter((x) => x === 'Strength')).toEqual([]);
  });
  it('disciplines de la programmation en anglais', () => {
    expect(DISCIPLINES.map((k) => i18n.t(k))).toEqual(['Functional', 'Hybrid', 'Weightlifting', 'Endurance']);
  });
  it('« Taux de victoire » et « En continu » : plus de français en anglais', () => {
    expect([i18n.t('profile.stats.winRate'), i18n.t('profile.account.progOngoing', { days: 3 })]).toEqual(['Win rate', 'Ongoing · 3d/wk']);
  });
});
