// Chantier anglais, groupe Explorer : pluriels anglais des nouvelles clés _one / _other
// (count = 1 et 12), et textes que l'instantané rendu (i18nExplorer.rn.test.tsx)
// n'atteint pas : le français reste le littéral de master, au caractère près.
import i18n from '../i18n';
import en from '../i18n/locales/en.json';
import { partnerCategoryLabel, serviceLabel, sportLabel } from '../screens/explorer/explorerLabels';

afterAll(async () => { await i18n.changeLanguage('fr'); });

describe('Explorer : français inchangé hors instantané', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each([
    ['explorer.map.missing', undefined, 'react-native-maps non installé.'],
    ['explorer.map.missingHint', undefined, 'Installez-le pour afficher la carte.'],
    ['explorer.directory.count', { count: 0 }, '0 box référencée'],
    ['explorer.map.count', { count: 1 }, '1 box'],
    ['explorer.programs.count', { count: 0 }, '0 programme disponible'],
    // Les deux formes françaises restent celles de master (« 1 membres », « 1 jours/semaine »).
    ['explorer.membersCount', { count: 1 }, '1 membres'],
    ['explorer.programs.daysPerWeek', { count: 1 }, '1 jours/semaine'],
    ['explorer.detail.members', { count: 1 }, 'membres'],
    ['explorer.detail.sports', { count: 1 }, 'sports'],
    ['partners.codeCopiedMsg', { code: 'ATHLEX10' }, 'Le code "ATHLEX10" a été copié dans le presse-papier.'],
  ] as const)('%s %j', (key, opts, expected) => {
    expect(i18n.t(key, opts)).toBe(expected);
  });
  it('valeur inconnue affichée telle quelle', () => {
    expect([sportLabel('padel'), serviceLabel('pool'), partnerCategoryLabel('travel')]).toEqual(['padel', 'pool', 'travel']);
    expect([sportLabel('crossfit'), sportLabel('hyrox'), sportLabel('weightlifting')]).toEqual(['Functional', 'Hybrid', 'Haltérophilie']);
  });
});

describe('Explorer : anglais', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  it.each([
    ['explorer.membersCount', '1 member', '12 members'],
    ['explorer.directory.count', '1 listed box', '12 listed boxes'],
    ['explorer.detail.members', 'member', 'members'],
    ['explorer.detail.sports', 'sport', 'sports'],
    ['explorer.map.count', '1 box', '12 boxes'],
    ['explorer.programs.count', '1 program available', '12 programs available'],
    ['explorer.programs.daysPerWeek', '1 day/week', '12 days/week'],
  ])('pluriel anglais de %s : count = 1 et count = 12', (key, one, twelve) => {
    expect(i18n.t(key, { count: 1 })).toBe(one);
    expect(i18n.t(key, { count: 12 })).toBe(twelve);
  });
  it('aucune forme _one / _other de en.json ne contient « (s) »', () => {
    const flat = (o: Record<string, unknown>, p = ''): [string, unknown][] => Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v) ? flat(v as Record<string, unknown>, `${p}${k}.`) : [[`${p}${k}`, v] as [string, unknown]]);
    expect(flat(en).filter(([k, v]) => /_(one|other)$/.test(k) && typeof v === 'string' && v.includes('(s)')).map(([k]) => k)).toEqual([]);
  });
  it('sports, services et catégories', () => {
    expect([sportLabel('crossfit'), sportLabel('hyrox'), sportLabel('boxing'), sportLabel('weightlifting')]).toEqual(['Functional', 'Hybrid', 'Boxing', 'Weightlifting']);
    expect([serviceLabel('physio'), partnerCategoryLabel('apparel')]).toEqual(['Physio', 'Apparel']);
  });
});
