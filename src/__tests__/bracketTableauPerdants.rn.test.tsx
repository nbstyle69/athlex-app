/**
 * Double élimination (tournois, PR 5) : le serveur fait avancer les deux
 * tableaux au même numéro de tour, et le tableau des perdants né du tour 1 porte
 * le tour 2. L'écran numérote ses colonnes depuis 1, sans trou.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockMatchs = [
  { round: 1, side: 'winner' }, { round: 1, side: 'winner' },
  { round: 2, side: 'winner' }, { round: 2, side: 'loser' },
  { round: 3, side: 'loser' }, { round: 4, side: 'loser' },
].map((m, i) => ({
  id: `m${i}`, match_number: 1, participant1_id: null, participant2_id: null,
  winner_id: null, loser_id: null, status: 'pending', wod_id: null, ...m,
}));

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

it.each(['fr', 'en'])('colonnes du tableau des perdants numérotées depuis 1 (%s)', async langue => {
  await act(async () => { await i18n.changeLanguage(langue); });
  let r: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<TournamentBracketView tournamentId="t" format="swiss" />); });
  const textes = r!.root.findAllByType(Text).map(t => [].concat(t.props.children).join(''));
  const colonnes = [1, 2, 3].map(n => i18n.t('bracket.lbRound', { n }));
  expect(colonnes.every(c => textes.includes(c))).toBe(true);
  expect(textes).not.toContain(i18n.t('bracket.lbRound', { n: 4 }));
  await act(async () => r!.unmount());
});
