/**
 * WOD des tournois à tableau (#386) : le WOD d'un match se lit dans `wod_id`,
 * l'ancien calcul par étape n'est qu'un secours (participants du tour 1, WOD
 * des gagnants seulement, comme le Manager), et l'étape d'un WOD se dit avec
 * son tableau, dans les libellés de `tournament_bracket_stages`.
 */
import fs from 'fs';
import path from 'path';
import i18n from '../i18n';
import { libelleEtape, toursGagnants, wodColonne, wodEtapeGagnants } from '../utils/bracketWods';

const SQL = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20270133000000_bracket_wods_prevus.sql'), 'utf8');
const chaines = (s: string) => [...s.matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1].replace(/''/g, "'"));
// Les tableaux de libellés de la base : double élimination d'abord, puis élimination simple.
const tableaux = [...SQL.matchAll(/lib_(fr|en) := ARRAY\[([^\]]*)\]/g)].map(m => ({ langue: m[1], libelles: chaines(m[2]) }));
// Libellé d'une étape hors gagnants : le premier `label_<langue>` qui suit `bracket_board := '<tableau>';`.
const libelleBase = (board: string, langue: string) =>
  chaines(new RegExp(`bracket_board := '${board}';[\\s\\S]*?label_${langue} := (?:format\\()?'(?:[^']|'')*'`).exec(SQL)![0]).pop()!;

const t = (langue: string) => i18n.getFixedT(langue);
const wod = (bracket_board: string | null, bracket_stage: number | null) => ({ bracket_board, bracket_stage });

describe('libellés : ceux de tournament_bracket_stages', () => {
  it('la migration donne bien 2 × 2 tableaux de 6 libellés', () => {
    expect(tableaux.map(x => [x.langue, x.libelles.length])).toEqual([['fr', 6], ['en', 6], ['fr', 6], ['en', 6]]);
  });

  describe.each(['fr', 'en'])('%s', langue => {
    const [double, simple] = tableaux.filter(x => x.langue === langue).map(x => x.libelles);
    const L = (board: string | null, stage: number | null, d = true) => libelleEtape(wod(board, stage), d, t(langue));

    it('double élimination : étapes des gagnants', () => {
      expect([0, 1, 2, 3, 4, 5].map(s => L('winner', s))).toEqual(double);
      const au_dela = langue === 'fr' ? '6 tours avant la finale des gagnants' : "6 rounds before the winners' final";
      expect(L('winner', 6)).toBe(au_dela);
      expect(SQL).toContain(langue === 'fr' ? "'%s tours avant la finale des gagnants'" : "'%s rounds before the winners'' final'");
    });

    it('tours des perdants, grande finale, match décisif, petite finale', () => {
      expect(L('loser', 2)).toBe(libelleBase('loser', langue).replace('%s', '2'));
      expect(L('grand_final', null)).toBe(libelleBase('grand_final', langue));
      expect(L('grand_final_reset', null)).toBe(libelleBase('grand_final_reset', langue));
      expect(L('third_place', null, false)).toBe(libelleBase('third_place', langue));
    });

    it('élimination simple : libellés inchangés, identiques à ceux de la base', () => {
      expect([0, 1, 2, 3, 4, 5].map(s => L('winner', s, false))).toEqual(simple);
      expect(L('winner', 7, false)).toBe(i18n.t('tournament.stageN', { n: 7, lng: langue }));
    });

    it('étape écrite sans tableau (ancien formulaire) : chez les gagnants', () => {
      expect(L(null, 1, false)).toBe(simple[1]);
      expect(L(null, 1)).toBe(double[1]);
    });

    it('pas d’étape : rien', () => {
      expect(L(null, null)).toBeNull();
      expect(L('winner', null)).toBeNull();
      expect(L('loser', null)).toBeNull();
    });
  });

  it('TournamentScreen dit l’étape avec son tableau, en double élimination pour « swiss »', () => {
    const src = fs.readFileSync(path.join(__dirname, '../screens/competition/TournamentScreen.tsx'), 'utf8');
    expect(src).toContain("libelleEtape(wod as any, tournament.format === 'swiss', t)");
    expect(src).not.toContain('bracketStageLabel');
  });
});

const m = (round: number, side: string, p1: string | null, p2: string | null, extra: object = {}) =>
  ({ round, side, participant1_id: p1, participant2_id: p2, wod_id: null as string | null, winner_id: null as string | null, status: 'pending', ...extra });

describe('toursGagnants : participants du tour 1, comme le Manager', () => {
  it('5 participants (dont une exemption) : 3 tours, même quand seul le tour 2 est créé', () => {
    const matchs = [m(1, 'winner', 'a', 'b'), m(1, 'winner', 'c', 'd'), m(1, 'winner', 'e', null, { status: 'bye' }), m(2, 'winner', null, null)];
    expect(toursGagnants(matchs)).toBe(3);
  });
  it('les matchs des perdants et des finales ne comptent pas', () => {
    expect(toursGagnants([m(1, 'winner', 'a', 'b'), m(1, 'winner', 'c', 'd'), m(1, 'loser', 'e', 'f'), m(2, 'grand_final', 'g', 'h')])).toBe(2);
  });
  it('tour 1 vide : le dernier tour des gagnants créé', () => {
    expect(toursGagnants([m(1, 'winner', null, null), m(3, 'winner', null, null), m(5, 'loser', null, null)])).toBe(3);
  });
});

describe('wodEtapeGagnants : le secours ne prend que les WOD des gagnants', () => {
  const wods = [{ id: 'l1', ...wod('loser', 1) }, { id: 'w1', ...wod('winner', 1) }, { id: 'gf', ...wod('grand_final', null) }];
  it('distance à la finale', () => {
    expect(wodEtapeGagnants(wods, 3, 2)?.id).toBe('w1');
    expect(wodEtapeGagnants(wods, 3, 3)).toBeUndefined();
  });
  it('jamais un WOD des perdants de même numéro', () => {
    expect(wodEtapeGagnants([wods[0]], 3, 2)).toBeUndefined();
  });
});

describe('wodColonne : wod_id d’abord, le secours seulement sans WOD', () => {
  const wods = [{ id: 'A' }, { id: 'B' }, { id: 'S' }];
  const secours = wods[2];
  it('le WOD posé sur le match, pas le secours', () => {
    expect(wodColonne([{ wod_id: 'A', winner_id: null, status: 'pending' }], wods, secours)?.id).toBe('A');
  });
  it('un match pas encore joué passe devant un match joué', () => {
    expect(wodColonne([{ wod_id: 'A', winner_id: 'x', status: 'completed' }, { wod_id: 'B', winner_id: null, status: 'pending' }], wods)?.id).toBe('B');
  });
  it('sinon un match joué', () => {
    expect(wodColonne([{ wod_id: 'A', winner_id: 'x', status: 'completed' }, { wod_id: null, winner_id: null, status: 'pending' }], wods, secours)?.id).toBe('A');
  });
  it('une exemption ne compte pas', () => {
    expect(wodColonne([{ wod_id: 'A', winner_id: 'x', status: 'bye' }], wods, secours)?.id).toBe('S');
  });
  it('aucun WOD : le secours, ou rien', () => {
    expect(wodColonne([{ wod_id: null, winner_id: null, status: 'pending' }], wods, secours)?.id).toBe('S');
    expect(wodColonne([{ wod_id: null, winner_id: null, status: 'pending' }], wods)).toBeUndefined();
  });
});
