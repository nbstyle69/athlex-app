/**
 * Classement de la compétition classique : l'app affiche ce que la base calcule.
 * Cas de référence de l'étape 0 : un For Time, A et B en 8:00, C en 9:30, D au
 * CAP à 150 reps, E au CAP à 140 reps, F sans score — la base rend A 100, B 100
 * (1ers ex-aequo), C 95 (3e), D 93, E 91, F 0 (supabase/tests/bareme_classique.sql).
 */
import {
  chargerClassement, chargerGeneralSaison, classementGeneral, classementWod, ongletsClassement, saisonsTerminees,
  LigneClassement, RangWod,
} from '../utils/classementTournoi';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabase: { rpc: jest.fn(async () => ({ data: [], error: null })) },
}));

const W = 'wod-fran';
const inscrits = ['F', 'E', 'D', 'C', 'B', 'A'].map(n => ({ athlete_id: n }));

// Ce que rendent les deux fonctions de la base pour le cas de référence.
const lignes: LigneClassement[] = [
  { athlete_id: 'A', points: 100, final_rank: 1 }, { athlete_id: 'B', points: 100, final_rank: 1 },
  { athlete_id: 'C', points: 95, final_rank: 3 }, { athlete_id: 'D', points: 93, final_rank: 4 },
  { athlete_id: 'E', points: 91, final_rank: 5 }, { athlete_id: 'F', points: 0, final_rank: 6 },
];
const rangs: RangWod[] = [
  { athlete_id: 'A', tournament_wod_id: W, wod_rank: 1, points: 100 },
  { athlete_id: 'B', tournament_wod_id: W, wod_rank: 1, points: 100 },
  { athlete_id: 'C', tournament_wod_id: W, wod_rank: 3, points: 95 },
  { athlete_id: 'D', tournament_wod_id: W, wod_rank: 4, points: 93 },
  { athlete_id: 'E', tournament_wod_id: W, wod_rank: 5, points: 91 },
];
// Scores lus par l'app : G a un For Time illisible (validé), H un score rejeté.
const scores = [
  { athlete_id: 'E', tournament_wod_id: W, score_value: '140', status: 'validated' },
  { athlete_id: 'G', tournament_wod_id: W, score_value: 'abc', status: 'validated' },
  { athlete_id: 'A', tournament_wod_id: W, score_value: '480', status: 'validated' },
  { athlete_id: 'H', tournament_wod_id: W, score_value: '420', status: 'rejected' },
  { athlete_id: 'C', tournament_wod_id: W, score_value: '570', status: 'validated' },
  { athlete_id: 'B', tournament_wod_id: W, score_value: '480', status: 'validated' },
  { athlete_id: 'D', tournament_wod_id: W, score_value: '150', status: 'validated' },
];

describe('classement général (base)', () => {
  it('cas de référence : A 100, B 100 ex-aequo 1ers, C 95 3e, D 93, E 91, F 0', () => {
    const c = classementGeneral(inscrits, lignes);
    expect(c.map(p => `${p.athlete_id}:${p.points}/${p.rang}`)).toEqual(
      ['A:100/1', 'B:100/1', 'C:95/3', 'D:93/4', 'E:91/5', 'F:0/6']);
  });

  it("un inscrit absent du calcul a 0 point, au rang de ceux qui n'ont pas marqué", () => {
    const c = classementGeneral([...inscrits, { athlete_id: 'Z' }], lignes);
    expect(c.find(p => p.athlete_id === 'Z')).toMatchObject({ points: 0, rang: 6 });
  });

  it("n'utilise jamais le score stocké sur l'inscription", () => {
    const c = classementGeneral([{ athlete_id: 'A', score: 999 }, { athlete_id: 'C', score: 5000 }], lignes);
    expect(c.map(p => [p.athlete_id, p.points])).toEqual([['A', 100], ['C', 95]]);
  });
});

describe('classement d’un WOD (base)', () => {
  it('suit le rang de la base, ex-aequo compris', () => {
    const c = classementWod(scores, rangs, W);
    expect(c.map(s => `${s.athlete_id}:${s.rang}/${s.points}`)).toEqual(
      ['A:1/100', 'B:1/100', 'C:3/95', 'D:4/93', 'E:5/91']);
  });

  it("un For Time illisible n'est pas classé (et surtout pas premier)", () => {
    expect(classementWod(scores, rangs, W).some(s => s.athlete_id === 'G')).toBe(false);
  });

  it('un score rejeté sort du classement', () => {
    expect(classementWod(scores, rangs, W).some(s => s.athlete_id === 'H')).toBe(false);
  });

  it("n'affiche que le WOD demandé", () => {
    expect(classementWod(scores, rangs, 'autre-wod')).toEqual([]);
  });
});

describe('ligue : général par saison et « Saisons précédentes »', () => {
  it("une ligue sans saison terminée n'a pas d'onglet « Saisons précédentes »", () => {
    expect(saisonsTerminees('league_div', 1)).toEqual([]);
    expect(ongletsClassement('league_div', 1, ['d1', 'd2'], 2)).toEqual(['general', 'div_d1', 'div_d2', 'wod_0', 'wod_1']);
    expect(ongletsClassement('league_div', null, ['d1'], 1)).not.toContain('previous');
  });

  it('une ligue avec des saisons terminées a l’onglet, après les divisions, et ses saisons de la plus récente à la plus ancienne', () => {
    expect(saisonsTerminees('league_div', 3)).toEqual([2, 1]);
    expect(ongletsClassement('league_div', 3, ['d1'], 1)).toEqual(['general', 'div_d1', 'previous', 'wod_0']);
  });

  it("l'onglet « Général » existe aussi dans une ligue", () => {
    expect(ongletsClassement('league_div', 2, ['d1'], 0)[0]).toBe('general');
  });

  it("hors ligue, jamais d'onglet « Saisons précédentes »", () => {
    expect(saisonsTerminees('simple', 4)).toEqual([]);
    expect(ongletsClassement('simple', 4, [], 2)).toEqual(['general', 'wod_0', 'wod_1']);
  });

  it('deux saisons : chaque général affiche ce que la base rend pour SA saison', () => {
    // Saison 1 (terminée) : le cas de référence ; saison 2 (en cours) : F 200, A 97, B 97, les autres 0
    // (supabase/tests/ligue_general_saison.sql, L1 et L2).
    const saison2: LigneClassement[] = [
      { athlete_id: 'F', points: 200, final_rank: 1 }, { athlete_id: 'A', points: 97, final_rank: 2 },
      { athlete_id: 'B', points: 97, final_rank: 2 }, { athlete_id: 'C', points: 0, final_rank: 4 },
      { athlete_id: 'D', points: 0, final_rank: 4 }, { athlete_id: 'E', points: 0, final_rank: 4 },
    ];
    expect(classementGeneral(inscrits, saison2).map(p => `${p.athlete_id}:${p.points}/${p.rang}`)).toEqual(
      ['F:200/1', 'A:97/2', 'B:97/2', 'C:0/4', 'D:0/4', 'E:0/4']);
    expect(classementGeneral(inscrits, lignes).map(p => `${p.athlete_id}:${p.points}/${p.rang}`)).toEqual(
      ['A:100/1', 'B:100/1', 'C:95/3', 'D:93/4', 'E:91/5', 'F:0/6']);
  });
});

describe('chargement : la base calcule', () => {
  const rpc = supabase.rpc as unknown as jest.Mock;
  beforeEach(() => rpc.mockClear());

  it('une ligue lit le général de la saison en cours ; un autre format, le général du tournoi', async () => {
    await chargerClassement('t1', true);
    expect(rpc.mock.calls.map(c => c[0]).sort()).toEqual(['tournament_classique_wod_ranks', 'tournament_ligue_standings']);
    rpc.mockClear();
    await chargerClassement('t1');
    expect(rpc.mock.calls.map(c => c[0]).sort()).toEqual(['tournament_classique_standings', 'tournament_classique_wod_ranks']);
  });

  it('une saison précédente est demandée à la base avec son numéro', async () => {
    await chargerGeneralSaison('t1', 2);
    expect(rpc).toHaveBeenCalledWith('tournament_ligue_standings', { p_tournament_id: 't1', p_season: 2 });
  });
});
