/**
 * Double élimination (tournois, PR 5 et 6). Le serveur fait avancer les deux
 * tableaux au même numéro de tour : le tableau des perdants né du tour 1 porte
 * le tour 2, et l'écran numérote ses colonnes depuis 1, sans trou. La grande
 * finale est suivie d'un match décisif quand le vainqueur du tableau des
 * perdants l'a gagnée : l'écran montre les deux, chacun sous son titre.
 * Un match gagné par forfait (PR 8) le dit.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const match = (round: number, side: string, i: number) => ({
  id: `m${i}`, round, side, match_number: 1, participant1_id: null, participant2_id: null,
  winner_id: null, loser_id: null, status: 'pending', wod_id: null,
});
const TABLEAUX = [[1, 'winner'], [1, 'winner'], [2, 'winner'], [2, 'loser'], [3, 'loser'], [4, 'loser']] as const;
const avecFinales = (n: number) =>
  [...TABLEAUX, ...Array.from({ length: n }, (_, k) => [5 + k, 'grand_final'] as const)].map(([r, s], i) => match(r, s, i));

let mockMatchs: any[] = [];
function mockRequete(data: any[]): any {
  const requete: any = {};
  for (const m of ['select', 'eq', 'in', 'order']) requete[m] = () => requete;
  requete.then = (ok: any, ko: any) => Promise.resolve({ data, error: null }).then(ok, ko);
  return requete;
}

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockRequete(table === 'tournament_bracket_matches' ? mockMatchs : []) },
}));
jest.mock('../context/ThemeContext', () => {
  const mockValeur = { theme: require('../theme/palette').lightTheme };
  return { useTheme: () => mockValeur };
});

import i18n from '../i18n';
import TournamentBracketView from '../screens/competition/TournamentBracketView';

async function textes(langue: string, finales: number, forfait = false) {
  mockMatchs = avecFinales(finales);
  if (forfait) Object.assign(mockMatchs[0], { status: 'forfeit', match_number: 7 });
  await act(async () => { await i18n.changeLanguage(langue); });
  let r: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<TournamentBracketView tournamentId="t" format="swiss" />); });
  // Le titre d'une finale porte une icône avant son libellé : on garde les chaînes.
  const out = r!.root.findAllByType(Text).map(t => [].concat(t.props.children).filter(c => typeof c === 'string' || typeof c === 'number').join('').trim());
  await act(async () => r!.unmount());
  return out;
}

describe.each(['fr', 'en'])('double élimination (%s)', langue => {
  it('colonnes du tableau des perdants numérotées depuis 1', async () => {
    const t = await textes(langue, 1);
    expect([1, 2, 3].every(n => t.includes(i18n.t('bracket.lbRound', { n })))).toBe(true);
    expect(t).not.toContain(i18n.t('bracket.lbRound', { n: 4 }));
  });

  it('une seule finale : pas de match décisif', async () => {
    const t = await textes(langue, 1);
    expect(t.filter(x => x === i18n.t('bracket.grandFinal'))).toHaveLength(1);
    expect(t).not.toContain(i18n.t('bracket.grandFinalReset'));
  });

  it('un match gagné par forfait le dit, et lui seul', async () => {
    const t = await textes(langue, 1, true);
    expect(t).toContain(`#7 · ${i18n.t('bracket.forfeit')}`);
    expect(t.filter(x => x.includes(i18n.t('bracket.forfeit')))).toHaveLength(1);
  });

  it('finale puis match décisif, chacun sous son titre', async () => {
    const t = await textes(langue, 2);
    expect(t.filter(x => x === i18n.t('bracket.grandFinal'))).toHaveLength(1);
    expect(t.filter(x => x === i18n.t('bracket.grandFinalReset'))).toHaveLength(1);
    expect(t.indexOf(i18n.t('bracket.grandFinal'))).toBeLessThan(t.indexOf(i18n.t('bracket.grandFinalReset')));
  });
});
