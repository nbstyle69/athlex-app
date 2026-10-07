// Chantier anglais, groupe Ma Box + Réservation : textes que l'instantané rendu
// (i18nMaBox.rn.test.tsx) n'atteint pas (partage, nouveau 1RM, singuliers,
// recherche de GIF…). Le français doit rester le littéral de master, au caractère près.
import i18n from '../i18n';

afterAll(async () => { await i18n.changeLanguage('fr'); });

const FR: [string, Record<string, unknown> | undefined, string][] = [
  ['wodDetail.shareUnavailable', undefined, 'Partage non disponible sur cet appareil'],
  ['sharePerf.share', undefined, 'Partager ma performance'],
  ['wodDetail.shareFailed', undefined, 'Impossible de partager la card.'],
  ['wodDetail.newOneRmTitle', undefined, 'Nouveau 1RM 🏋️'],
  ['wodDetail.newOneRmLine', { movement: 'Back Squat', kg: 120 }, 'Back Squat : 120 kg'],
  ['wodDetail.newOneRmLineWas', { movement: 'Back Squat', kg: 120, previous: 110 }, 'Back Squat : 120 kg (avant 110 kg)'],
  ['wodDetail.someone', undefined, "Quelqu'un"],
  ['wodDetail.shareMessage', { title: 'Cindy', url: 'athlex://wod/w1' }, 'Cindy — Rejoins le WOD sur AthleX ! athlex://wod/w1'],
  ['wodDetail.rankingTitle', { count: 1 }, 'Classement · 1 score'],
  ['wodDetail.rankingTitle', { count: 0 }, 'Classement · 0 score'],
  ['wodDetail.weightLabel', undefined, 'POIDS (kg)'],
  ['wodDetail.agoHours', { n: 3 }, '3h'],
  ['wodDetail.agoDays', { n: 2 }, '2j'],
  ['personalWod.saveFailed', undefined, 'Impossible de sauvegarder le WOD.'],
  ['community.athleteCount', { count: 1 }, '1 athlète'],
  ['community.athleteCount', { count: 0 }, '0 athlète'],
  ['articles.likes', { count: 3 }, "3 J'aime"],
  ['messages.gifSearchUnavailable', undefined, 'Recherche de GIF indisponible'],
  ['messages.gifNoResult', undefined, 'Aucun résultat'],
  ['bo.wods.typeAmrap', undefined, 'AMRAP'],
  ['bo.wods.typeEmom', undefined, 'EMOM'],
  ['bo.wods.typeStrength', undefined, 'Force'],
];

describe('Ma Box + Réservation : français inchangé hors instantané', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each(FR.map(([k, o, v]) => [`${k} ${JSON.stringify(o ?? {})}`, k, o, v] as const))('%s', (_n, key, opts, expected) => {
    expect(i18n.t(key, opts)).toBe(expected);
  });
});

describe('Ma Box + Réservation : anglais', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  it('pluriels anglais', () => {
    expect(i18n.t('wodDetail.rankingTitle', { count: 1 })).toBe('Leaderboard · 1 score');
    expect(i18n.t('wodDetail.rankingTitle', { count: 0 })).toBe('Leaderboard · 0 scores');
    expect(i18n.t('community.athleteCount', { count: 1 })).toBe('1 athlete');
    expect(i18n.t('community.athleteCount', { count: 2 })).toBe('2 athletes');
    expect(i18n.t('articles.likes', { count: 1 })).toBe('1 like');
    expect(i18n.t('articles.likes', { count: 0 })).toBe('0 likes');
  });
  it('jours de la semaine et motifs de signalement', () => {
    expect(i18n.t('weekPicker.days', { returnObjects: true })).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
    expect(i18n.t('moderation.reason.cheating')).toBe('Cheating (score)');
  });
  it('« Force » (type de WOD) se dit « Strength », jamais « Musculation »', () => {
    expect(i18n.t('bo.wods.typeStrength')).toBe('Strength');
  });
});
