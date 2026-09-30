/**
 * WOD des matchs de tableau, écran monté (#386). Le WOD d'une colonne est
 * celui que la base a posé sur ses matchs (`wod_id`), y compris dans le
 * tableau des perdants, la grande finale et le match décisif. Les anciens
 * matchs des gagnants sans WOD gardent l'ancien calcul par étape, compté sur
 * les participants du tour 1 ; le bracket simple d'avant s'affiche comme avant.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

let mockMatchs: any[] = [];
let mockWods: any[] = [];
function mockRequete(data: any[]): any {
  const requete: any = {};
  for (const m of ['select', 'eq', 'in', 'order']) requete[m] = () => requete;
  requete.then = (ok: any, ko: any) => Promise.resolve({ data, error: null }).then(ok, ko);
  return requete;
}

jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) =>
      mockRequete(table === 'tournament_bracket_matches' ? mockMatchs : table === 'tournament_wods' ? mockWods : []),
  },
}));
jest.mock('../context/ThemeContext', () => {
  const mockValeur = { theme: require('../theme/palette').lightTheme };
  return { useTheme: () => mockValeur };
});

import '../i18n';
import TournamentBracketView from '../screens/competition/TournamentBracketView';

let n = 0;
const match = (round: number, side: string, extra: object = {}) => ({
  id: `m${n++}`, round, side, match_number: 1, participant1_id: `p${n}a`, participant2_id: `p${n}b`,
  winner_id: null, loser_id: null, status: 'pending', wod_id: null, ...extra,
});
const W = (id: string, bracket_board: string | null, bracket_stage: number | null) => ({ id, title: id, bracket_board, bracket_stage });

/** Les WOD affichés, dans l'ordre de l'écran, avec le titre de colonne ou de section qui les précède. */
async function pastilles(format: 'bracket' | 'swiss', matchs: any[], wods: any[]) {
  mockMatchs = matchs;
  mockWods = wods;
  let r: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<TournamentBracketView tournamentId="t" format={format} />); });
  const noms = r!.root.findAll(n => n.props.testID === 'bracket-wod' && typeof n.props.label === 'string').map(n => n.props.label as string);
  await act(async () => r!.unmount());
  return noms;
}

describe('double élimination : le WOD de chaque match', () => {
  it('perdants, grande finale et match décisif affichent le leur', async () => {
    const wods = [W('G2', 'winner', 1), W('G1', 'winner', 0), W('P1', 'loser', 1), W('P2', 'loser', 2), W('GF', 'grand_final', null), W('GFR', 'grand_final_reset', null)];
    const matchs = [
      match(1, 'winner', { wod_id: 'G2' }), match(1, 'winner', { wod_id: 'G2' }),
      match(2, 'winner', { wod_id: 'G1' }), match(2, 'loser', { wod_id: 'P1' }),
      match(3, 'loser', { wod_id: 'P2' }),
      match(4, 'grand_final', { wod_id: 'GF' }), match(5, 'grand_final', { wod_id: 'GFR' }),
    ];
    expect(await pastilles('swiss', matchs, wods)).toEqual(['G2', 'G1', 'P1', 'P2', 'GF', 'GFR']);
  });

  it('wod_id passe avant l’étape calculée', async () => {
    const wods = [W('ETAPE', 'winner', 1), W('POSE', null, null)];
    const matchs = [match(1, 'winner', { wod_id: 'POSE' }), match(1, 'winner', { wod_id: 'POSE' }), match(2, 'winner')];
    expect(await pastilles('swiss', matchs, wods)).toEqual(['POSE']);
  });

  it('ancien match des perdants ou de grande finale sans WOD : rien, jamais le WOD des gagnants', async () => {
    // 4 participants : le tour 2 est l'étape 0 des gagnants, le piège d'un secours mal placé.
    const wods = [W('G2', 'winner', 1), W('PIEGE', 'winner', 0)];
    const matchs = [match(1, 'winner', { wod_id: 'G2' }), match(1, 'winner', { wod_id: 'G2' }), match(2, 'loser'), match(2, 'grand_final')];
    expect(await pastilles('swiss', matchs, wods)).toEqual(['G2']);
  });
});

describe('anciens matchs sans WOD : l’étape d’après les participants du tour 1', () => {
  it('5 participants, tour 2 seul créé : la demi-finale, pas la finale', async () => {
    const wods = [W('QUART', 'winner', 2), W('DEMI', 'winner', 1), W('FINALE', 'winner', 0)];
    const matchs = [
      match(1, 'winner'), match(1, 'winner'), match(1, 'winner', { participant2_id: null, status: 'bye' }),
      match(2, 'winner'),
    ];
    expect(await pastilles('bracket', matchs, wods)).toEqual(['QUART', 'DEMI']);
  });

  it('un WOD des perdants de même numéro n’est jamais pris pour une étape des gagnants', async () => {
    const wods = [W('P1', 'loser', 1), W('FINALE', 'winner', 0)];
    const matchs = [match(1, 'winner'), match(1, 'winner'), match(2, 'winner')];
    expect(await pastilles('swiss', matchs, wods)).toEqual(['FINALE']);
  });
});

describe('bracket simple d’avant : affichage inchangé', () => {
  it('8 participants joués jusqu’à la finale, sans WOD posé : chaque tour a son WOD, la petite finale aucun', async () => {
    const wods = [W('QUART', 'winner', 2), W('DEMI', 'winner', 1), W('FINALE', 'winner', 0)];
    const matchs = [
      ...[0, 1, 2, 3].map(() => match(1, 'winner')), match(2, 'winner'), match(2, 'winner'),
      match(3, 'winner'), match(3, 'third_place'),
    ];
    expect(await pastilles('bracket', matchs, wods)).toEqual(['QUART', 'DEMI', 'FINALE']);
  });

  it('petite finale d’un nouveau tournoi : le WOD posé par la base s’affiche', async () => {
    const wods = [W('FINALE', 'winner', 0), W('PF', 'third_place', null)];
    const matchs = [match(1, 'winner', { wod_id: 'FINALE' }), match(1, 'third_place', { wod_id: 'PF' })];
    expect(await pastilles('bracket', matchs, wods)).toEqual(['FINALE', 'PF']);
  });

  it('pas de WOD prévu : aucune pastille', async () => {
    expect(await pastilles('bracket', [match(1, 'winner'), match(1, 'winner'), match(2, 'winner')], [])).toEqual([]);
  });
});
