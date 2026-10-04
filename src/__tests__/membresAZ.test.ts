/** D4b, PR 2b : membres de A à Z pour la feuille « Choisir un membre ». */
import {
  LETTRES_AZ, filtrerMembres, grouperParLettre, lettreDe, normaliser, sectionPourLettre, trierMembres, type MembreAZ,
} from '../lib/membresAZ';

const m = (username: string, i = 0): MembreAZ => ({ user_id: `u-${username}-${i}`, username });
const noms = (l: MembreAZ[]) => l.map((x) => x.username);

describe('normaliser', () => {
  it('sans accents ni casse, ligatures dépliées, espaces bordants retirés', () => {
    expect(normaliser('  Élodie ')).toBe('elodie');
    expect(normaliser('ZOÉ')).toBe('zoe');
    expect(normaliser('Œdipe')).toBe('oedipe');
    expect(normaliser('çàù')).toBe('cau');
  });
});

describe('tri de A à Z', () => {
  it('ignore accents et casse : « élodie » entre « Damien » et « Fanny », « Émile » juste après', () => {
    const l = trierMembres(['Fanny', 'élodie_r', 'Damien', 'Émile', 'antoine', 'Zoé', 'bastien'].map((n) => m(n)));
    expect(noms(l)).toEqual(['antoine', 'bastien', 'Damien', 'élodie_r', 'Émile', 'Fanny', 'Zoé']);
  });
  it('ce qui ne commence pas par une lettre va en dernier (« # »)', () => {
    expect(noms(trierMembres(['_kim', 'Ugo', '9lives', 'Ava'].map((n) => m(n))))).toEqual(['Ava', 'Ugo', '9lives', '_kim']);
  });
  it('homonymes : ordre stable par identifiant, liste d’origine non modifiée', () => {
    const orig = [{ user_id: 'b', username: 'Léa' }, { user_id: 'a', username: 'lea' }];
    expect(trierMembres(orig).map((x) => x.user_id)).toEqual(['a', 'b']);
    expect(orig.map((x) => x.user_id)).toEqual(['b', 'a']);
  });
});

describe('regroupement par lettre', () => {
  it('une section par lettre présente, dans l’ordre, « # » en dernier', () => {
    const s = grouperParLettre(['Chloé', 'Élodie', 'émile', 'Clément', '42', 'Adam'].map((n) => m(n)));
    expect(s.map((x) => [x.lettre, noms(x.membres)])).toEqual([
      ['A', ['Adam']], ['C', ['Chloé', 'Clément']], ['E', ['Élodie', 'émile']], ['#', ['42']],
    ]);
  });
  it('lettre d’un pseudo', () => {
    expect([lettreDe('élodie'), lettreDe('Zoé'), lettreDe('_x'), lettreDe('')]).toEqual(['E', 'Z', '#', '#']);
  });
  it('index : 26 lettres puis « # »', () => {
    expect(LETTRES_AZ).toHaveLength(27);
    expect(LETTRES_AZ[0]).toBe('A');
    expect(LETTRES_AZ.slice(-2)).toEqual(['Z', '#']);
  });
});

describe('filtre de la recherche', () => {
  const tous = ['Karim M.', 'Karine D.', 'Oskar P.', 'Léa M.', 'élodie_r'].map((n) => m(n));
  it('dès la première lettre, n’importe où dans le pseudo, sans casse', () => {
    expect(noms(filtrerMembres(tous, 'kar'))).toEqual(['Karim M.', 'Karine D.', 'Oskar P.']);
    expect(noms(filtrerMembres(tous, 'K'))).toEqual(['Karim M.', 'Karine D.', 'Oskar P.']);
  });
  it('sans accents dans les deux sens', () => {
    expect(noms(filtrerMembres(tous, 'ELO'))).toEqual(['élodie_r']);
    expect(noms(filtrerMembres(tous, 'léa'))).toEqual(['Léa M.']);
    expect(noms(filtrerMembres(tous, 'lea'))).toEqual(['Léa M.']);
  });
  it('saisie vide ou blanche : tout le monde, trié', () => {
    expect(noms(filtrerMembres(tous, '  '))).toEqual(['élodie_r', 'Karim M.', 'Karine D.', 'Léa M.', 'Oskar P.']);
  });
  it('rien ne correspond : liste vide', () => {
    expect(filtrerMembres(tous, 'zz')).toEqual([]);
  });
});

describe('index A–Z : section visée', () => {
  const sections = grouperParLettre(['Adam', 'Chloé', 'Mathis', '42'].map((n) => m(n)));
  it('sa lettre si elle existe, sinon la suivante présente, sinon la dernière', () => {
    expect(sectionPourLettre(sections, 'C')).toBe('C');
    expect(sectionPourLettre(sections, 'B')).toBe('C');
    expect(sectionPourLettre(sections, 'N')).toBe('#');
    expect(sectionPourLettre(sections, '#')).toBe('#');
    expect(sectionPourLettre(grouperParLettre([m('Adam')]), 'Z')).toBe('A');
    expect(sectionPourLettre([], 'A')).toBeNull();
  });
});
