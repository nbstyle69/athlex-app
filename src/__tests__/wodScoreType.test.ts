/**
 * #453, PR 3 (app) : type de score fixé par le créateur, texte libre.
 * Logique pure : encodage tours + reps, sens du classement, affichage, lecture
 * du texte libre (contrat partagé avec le Manager) et crédit des badges.
 */
import contract from './fixtures/free-text-wod-contract.json';
import i18n from '../i18n';
import { creditFreeText, readFreeText, catalogName } from '../utils/freeTextWod';
import {
  decodeRoundsReps, encodeRoundsReps, fixedScoreType, isTimeRanked, rankableScores, roundsRepsTooHigh,
} from '../utils/wodScoreType';
import { formatScoreValue, splitScoreForDisplay } from '../utils/scoreFormat';
import { sortScoresRxFirst } from '../services/eloCompute';
import { WODScore } from '../types';

jest.mock('../lib/supabase', () => ({ supabase: {} }));

const s = (id: string, v: number, extra: Partial<WODScore> = {}) =>
  ({ id, score_value: v, rx: true, capped: false, score_type: 'reps', ...extra }) as WODScore;

describe('type de score fixé par le créateur', () => {
  it('WOD sans type : pas de type imposé, sens du classement selon wod_type comme avant', () => {
    expect(fixedScoreType({ wod_type: 'for-time' })).toBeNull();
    expect(fixedScoreType({ score_type: null, wod_type: 'amrap' })).toBeNull();
    expect(isTimeRanked({ wod_type: 'for-time' })).toBe(true);
    expect(isTimeRanked({ score_type: null, wod_type: 'amrap' })).toBe(false);
    expect(isTimeRanked({ wod_type: null })).toBe(false);
  });

  it('WOD typé : le type du créateur, « none » devient « done »', () => {
    expect(fixedScoreType({ score_type: 'time', wod_type: 'amrap' })).toBe('time');
    expect(fixedScoreType({ score_type: 'rounds_reps' })).toBe('rounds_reps');
    expect(fixedScoreType({ score_type: 'reps' })).toBe('reps');
    expect(fixedScoreType({ score_type: 'weight' })).toBe('weight');
    expect(fixedScoreType({ score_type: 'none' })).toBe('done');
  });

  it.each([
    ['time', 'amrap', true], ['rounds_reps', 'for-time', false], ['reps', 'for-time', false], ['weight', 'for-time', false],
  ] as const)('tri : %s l’emporte sur wod_type %s', (st, wt, time) => {
    expect(isTimeRanked({ score_type: st, wod_type: wt })).toBe(time);
    const list = [s('a', 300), s('b', 200), s('c', 400)];
    const ids = sortScoresRxFirst(list, isTimeRanked({ score_type: st, wod_type: wt })).map(x => x.id);
    expect(ids).toEqual(time ? ['b', 'a', 'c'] : ['c', 'a', 'b']);
  });

  it('tours + reps : encodage tours × 1000 + reps, reps < 1000', () => {
    expect(encodeRoundsReps('7', '12')).toBe(7012);
    expect(encodeRoundsReps('7', '')).toBe(7000);
    expect(encodeRoundsReps('', '12')).toBe(12);
    expect(encodeRoundsReps('0', '999')).toBe(999);
    expect(encodeRoundsReps('7', '1000')).toBeNull();
    expect(encodeRoundsReps('', '')).toBeNull();
    expect(encodeRoundsReps('-1', '3')).toBeNull();
    expect(encodeRoundsReps('2.5', '3')).toBeNull();
    expect(roundsRepsTooHigh('999')).toBe(false);
    expect(roundsRepsTooHigh('1000')).toBe(true);
    expect(roundsRepsTooHigh('')).toBe(false);
    expect(decodeRoundsReps(7012)).toEqual({ rounds: 7, reps: 12 });
  });

  it('affichage : « 7 + 12 », « Faite » / « Done », autres types inchangés', async () => {
    expect(formatScoreValue(7012, 'rounds_reps')).toBe('7 + 12');
    expect(formatScoreValue(12, 'rounds_reps')).toBe('0 + 12');
    expect(splitScoreForDisplay(7012, 'rounds_reps')).toEqual({ value: '7 + 12', unit: '' });
    await i18n.changeLanguage('fr');
    expect(formatScoreValue(1, 'done')).toBe('Faite');
    expect(splitScoreForDisplay(1, 'done')).toEqual({ value: 'Faite', unit: '' });
    await i18n.changeLanguage('en');
    expect(formatScoreValue(1, 'done')).toBe('Done');
    await i18n.changeLanguage('fr');
    expect(formatScoreValue(125, 'time')).toBe('02:05');
    expect(formatScoreValue(87, 'time', true)).toBe('CAP + 87 reps');
    expect(formatScoreValue(150, 'reps')).toBe('150 reps');
    expect(formatScoreValue(100, 'weight')).toBe('100 kg');
    expect(splitScoreForDisplay(87, 'time', true)).toEqual({ value: 'CAP', unit: '+ 87 REPS' });
  });

  it('aucune séance « faite » dans un classement', () => {
    expect(rankableScores([s('a', 1, { score_type: 'done' }), s('b', 5)]).map(x => x.id)).toEqual(['b']);
  });
});

describe('texte libre : contrat partagé avec le Manager', () => {
  const cases = contract.cases;

  it('contient au minimum l’exemple RXP 01 de la maquette', () => {
    expect(cases.some(c => c.name.startsWith('RXP 01'))).toBe(true);
  });

  it.each(cases.map(c => [c.name, c] as const))('%s', (_n, c) => {
    expect(readFreeText(c.text)).toEqual(c.expected);
  });

  it('nom exact du catalogue, pluriel en « s » toléré, rien d’autre', () => {
    expect(catalogName('thrusters')).toBe('Thruster');
    expect(catalogName('THRUSTER')).toBe('Thruster');
    expect(catalogName('thrusterss')).toBeNull();
    expect(catalogName('pull-up')).toBeNull();
    expect(catalogName('ski')).toBeNull();
  });
});

describe('texte libre : crédit des badges', () => {
  const rxp = contract.cases[0].text;

  it('temps fini : chaque mouvement reconnu, quantités et charges du genre', () => {
    expect(creditFreeText(rxp, { scoreType: 'time', capped: false }, 'male')).toEqual([
      { name: 'Pull-ups', reps: 21 }, { name: 'Thruster', reps: 21, weight_kg: 43 },
      { name: 'Chest-to-Bar', reps: 18 }, { name: 'Thruster', reps: 18, weight_kg: 43 },
      { name: 'Bar Muscle-ups', reps: 15 }, { name: 'Thruster', reps: 15, weight_kg: 43 },
    ]);
    expect(creditFreeText(contract.cases[1].text, { scoreType: 'time', capped: false }, 'female')).toEqual([
      { name: 'Wall Balls', reps: 10, weight_kg: 6 }, { name: 'SkiErg', reps: 15, unit: 'cal' },
    ]);
  });

  it.each([
    ['capé', 'time', true], ['reps', 'reps', false], ['tours + reps', 'rounds_reps', false],
    ['charge', 'weight', false], ['faite', 'done', false],
  ] as const)('score %s : rien n’est crédité (il ne prouve pas la séance terminée)', (_n, scoreType, capped) => {
    expect(creditFreeText(rxp, { scoreType, capped }, 'male')).toEqual([]);
  });
});

describe('crédit des mouvements (utils/wodCredit)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { movementCredit, completionCredit } = require('../utils/wodCredit');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { computeCompletedMovements } = require('../utils/movementParser');
  const AMRAP = { description: '12 min AMRAP\n10 Thruster\n5 Pull-ups', wod_type: 'amrap' };

  it('WOD sans type : exactement la règle d’avant', () => {
    const before = computeCompletedMovements(AMRAP.description.split('\n'), 'AMRAP', 37, 'reps', { gender: 'male' });
    expect(movementCredit(AMRAP, 37, 'reps', false, 'male')).toEqual(before);
    const ft = { description: '21 Thruster\n21 Pull-ups', wod_type: 'for-time' };
    expect(movementCredit(ft, 300, 'time', false, 'male')).toEqual(
      computeCompletedMovements(ft.description.split('\n'), 'For Time', 300, 'time', { gender: 'male' }));
  });

  it('« faite » : rien', () => {
    expect(movementCredit({ ...AMRAP, score_type: 'none' }, 1, 'done', false, 'male')).toEqual([]);
  });

  it('tours + reps : ramené à un total de reps (2 tours + 12 = 42)', () => {
    expect(movementCredit({ ...AMRAP, score_type: 'rounds_reps' }, 2012, 'rounds_reps', false, 'male'))
      .toEqual([{ name: 'Thruster', reps: 30, weight_kg: undefined }, { name: 'Pull-ups', reps: 12, weight_kg: undefined }]);
  });

  it('reps fixé sur un For Time : réparti comme un AMRAP, jamais le travail entier', () => {
    const ft = { description: '21 Thruster\n21 Pull-ups', wod_type: 'for-time', score_type: 'reps' as const };
    expect(movementCredit(ft, 30, 'reps', false, 'male'))
      .toEqual([{ name: 'Thruster', reps: 21, weight_kg: undefined }, { name: 'Pull-ups', reps: 9, weight_kg: undefined }]);
  });

  it('texte libre : lu par freeTextWod (temps fini seulement)', () => {
    const free = { description: '21 thrusters @43/29 + 21 pull-ups', wod_type: 'for-time', text_mode: 'free' as const, score_type: 'time' as const };
    expect(movementCredit(free, 300, 'time', false, 'female')).toEqual([{ name: 'Thruster', reps: 21, weight_kg: 29 }, { name: 'Pull-ups', reps: 21 }]);
    expect(movementCredit(free, 80, 'time', true, 'female')).toEqual([]);
  });

  it('« réalisé » coché sur le Whiteboard : travail prescrit, sauf AMRAP et texte libre', () => {
    const ft = { description: '21 Thruster\n21 Pull-ups', wod_type: 'for-time' };
    expect(completionCredit(ft, 'male')).toEqual(computeCompletedMovements(ft.description.split('\n'), 'For Time', 0, 'reps', { gender: 'male' }));
    expect(completionCredit(ft, 'male').length).toBe(2);
    expect(completionCredit({ ...ft, text_mode: 'free' }, 'male')).toEqual([]);
    expect(completionCredit(AMRAP, 'male')).toEqual([]);
  });
});
