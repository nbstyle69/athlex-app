/**
 * #453, PR 3 (app) : type de score fixé par le créateur, texte libre.
 * Logique pure : encodage tours + reps, sens du classement, affichage, lecture
 * du texte libre (contrat partagé avec le Manager) et crédit des badges.
 */
import contract from './fixtures/free-text-wod-contract.json';
import i18n from '../i18n';
import fs from 'fs';
import path from 'path';
import {
  creditFreeText, readFreeText, catalogName, FREE_TEXT_EXTRA_MOVEMENTS, FREE_TEXT_MOVEMENTS,
} from '../utils/freeTextWod';
import { MOVEMENT_CATALOG } from '../utils/movementsCatalog';
import { cleanMovementName, normalizeMovement } from '../utils/tournamentUtils';
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

  it('nom de la liste, casse, tirets et pluriel ignorés', () => {
    expect(catalogName('thrusters')).toBe('Thruster');
    expect(catalogName('THRUSTER')).toBe('Thruster');
    expect(catalogName('thrusterss')).toBeNull();
    expect(catalogName('pull-up')).toBe('Pull-ups');
    expect(catalogName('toes to bar')).toBe('Toes-to-Bar');
  });

  it('écriture de MOVEMENT_MAP : affichée sous le nom de la liste qu’elle désigne', () => {
    expect(catalogName('ski')).toBe('SkiErg');
    expect(catalogName('T2B')).toBe('Toes-to-Bar');
    expect(catalogName('toes2bar')).toBe('Toes-to-Bar');
    expect(catalogName('C2B')).toBe('Chest-to-Bar');
    expect(catalogName('HSPU')).toBe('Handstand Push-ups');
    expect(catalogName('DU')).toBe('Double-unders');
    expect(catalogName('BMU')).toBe('Bar Muscle-ups');
    expect(catalogName('RMU')).toBe('Ring Muscle-ups');
    expect(catalogName('OHS')).toBe('Overhead Squat');
  });

  it('écriture qui désigne plusieurs noms : le nom de même écriture, sinon à corriger', () => {
    expect(catalogName('clean')).toBe('Clean');
    expect(catalogName('snatch')).toBe('Snatch');
    expect(catalogName('front squat')).toBe('Front Squat');
    for (const w of ['hang clean', 'hang snatch', 'jerk', 'STOH', 'S2OH', 'kettlebell deadlift', 'overhead lunge', 'walking lunge', 'assault bike']) {
      expect([w, catalogName(w)]).toEqual([w, null]);
    }
  });

  it('aucune devinette', () => {
    for (const w of ['pow clean', 'kb dl', 'pullups strict', 'muscle up', 'pull', '']) expect([w, catalogName(w)]).toEqual([w, null]);
  });

  it('deux noms de la liste ne se confondent jamais une fois nettoyés', () => {
    const nets = FREE_TEXT_MOVEMENTS.map(m => cleanMovementName(m.name));
    expect(new Set(nets).size).toBe(nets.length);
  });
});

describe('texte libre : mouvements propres au texte libre (décision A)', () => {
  it('chacun a sa clé de badge', () => {
    expect(Object.fromEntries(FREE_TEXT_EXTRA_MOVEMENTS.map(m => [m.name, normalizeMovement(m.name).key]))).toEqual({
      Snatch: 'snatch', Clean: 'clean', 'Shoulder to Overhead': 'press', 'DB Lunge': 'lunge', 'DB Overhead Lunge': 'lunge',
      'KB Snatch': 'kb_snatch', 'KB Deadlift': 'deadlift', 'KB Front Squat': 'squat', 'KB Lunge': 'lunge', 'KB Overhead Lunge': 'lunge',
    });
  });

  it('le catalogue de l’éditeur du back-office (BOWODsScreen) ne change pas', () => {
    expect(MOVEMENT_CATALOG.map(m => m.name)).toEqual([
      'Thruster', 'Power Clean', 'Power Snatch', 'Clean & Jerk', 'Deadlift', 'Front Squat', 'Back Squat', 'Overhead Squat',
      'Push Press', 'Push Jerk', 'Sumo Deadlift High Pull', 'Squat Snatch', 'Squat Clean', 'Squat Clean & Jerk', 'Cluster',
      'Alt DB Snatch', 'DB Thruster', 'Devils Press', 'DB Deadlift', 'DB Clean & Jerk', 'DB Push Press', 'KB Swing',
      'Goblet Squat', 'KB Clean', 'Wall Balls', 'Snatch Balance', 'Snatch High Pull', 'Clean Pull', 'Tall Clean', 'Power Jerk',
      'Split Jerk', 'Back Rack Split Jerk', 'Strict Press', 'DB Strict Press', 'Bench Press', 'Zercher Squat', 'Pull-ups',
      'Toes-to-Bar', 'Chest-to-Bar', 'Bar Muscle-ups', 'Handstand Push-ups', 'Ring Dips', 'Ring Muscle-ups', 'Rope Climbs',
      'Pistols', 'Handstand Walk', 'Wall Walk', 'Box Jump-overs', 'Box Jumps', 'Box Step-ups', 'Burpees Over the Bar',
      'Burpees', 'Push-ups', 'Sit-ups', 'Air Squats', 'Row', 'Bike Erg', 'Echo Bike', 'SkiErg', 'Run', 'Double-unders',
      'Lunges', 'V-ups', 'Hollow Rocks',
    ]);
    const ecran = fs.readFileSync(path.join(__dirname, '../screens/backoffice/BOWODsScreen.tsx'), 'utf8');
    expect(ecran).toMatch(/\{MOVEMENT_CATALOG\.map\(/);
    expect(ecran).not.toMatch(/FREE_TEXT_|freeTextWod/);
  });
});

describe('MOVEMENT_MAP : écritures ajoutées (#453 PR 3c) et abréviations à chiffre', () => {
  it.each([
    ['kettlebell deadlift', 'deadlift'], ['KB lunges', 'lunge'], ['DB overhead lunge', 'lunge'], ['KB overhead lunge', 'lunge'],
    ['overhead lunges', 'lunge'], ['STOH', 'press'], ['S2OH', 'press'], ['C2B', 'chest_to_bar'], ['DU', 'double_under'],
    ['BMU', 'bar_muscle_up'], ['RMU', 'ring_muscle_up'],
    // entrées existantes jusqu'ici inaccessibles : chiffre entre deux lettres, « ohs » lu comme un pluriel
    ['21 T2B', 'toes_to_bar'], ['toes2bar', 'toes_to_bar'], ['K2E', 'knees_to_elbow'], ['10 OHS @40/30', 'overhead_squat'],
  ])('%s → %s', (w, cle) => {
    expect(normalizeMovement(w).key).toBe(cle);
  });

  it('un nombre hors d’un mot reste une quantité', () => {
    expect(normalizeMovement('21 thrusters').key).toBe('thruster');
    expect(normalizeMovement('15/12 cal row').key).toBe('row');
    expect(normalizeMovement('3x10 back squat').key).toBe('squat');
  });
});

describe('texte libre : crédit des badges', () => {
  const rxp = contract.cases[0].text;

  it('temps fini : chaque mouvement reconnu, quantités et charges du genre', () => {
    expect(creditFreeText(rxp, { scoreType: 'time', capped: false }, 'male')).toEqual([
      { name: 'Pull-ups', reps: 21 }, { name: 'SkiErg', reps: 15, unit: 'cal' }, { name: 'Thruster', reps: 21, weight_kg: 43 },
      { name: 'Chest-to-Bar', reps: 18 }, { name: 'SkiErg', reps: 15, unit: 'cal' }, { name: 'Thruster', reps: 18, weight_kg: 43 },
      { name: 'Bar Muscle-ups', reps: 15 }, { name: 'SkiErg', reps: 12, unit: 'cal' }, { name: 'Thruster', reps: 15, weight_kg: 43 },
    ]);
    expect(creditFreeText(contract.cases[1].text, { scoreType: 'time', capped: false }, 'female')).toEqual([
      { name: 'Wall Balls', reps: 10, weight_kg: 6 }, { name: 'SkiErg', reps: 15, unit: 'cal' }, { name: 'Pull-ups', reps: 1 },
    ]);
  });

  it('For Time « 21 T2B + 21 KB deadlifts @24/16 » : temps fini → toes_to_bar et deadlift, 21 chacun ; au cap → rien', () => {
    const wod = 'For time\n21 T2B + 21 KB deadlifts @24/16';
    const credit = creditFreeText(wod, { scoreType: 'time', capped: false }, 'female');
    expect(credit).toEqual([{ name: 'Toes-to-Bar', reps: 21 }, { name: 'KB Deadlift', reps: 21, weight_kg: 16 }]);
    expect(credit.map(c => [normalizeMovement(c.name).key, c.reps])).toEqual([['toes_to_bar', 21], ['deadlift', 21]]);
    expect(creditFreeText(wod, { scoreType: 'time', capped: true }, 'female')).toEqual([]);
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

  describe('For Time arrêté en cours : les X premières reps dans l’ordre du WOD', () => {
    const reps = (l: { name: string; reps: number }[]) => l.map(m => [m.name, m.reps]);
    const LADDER = { description: '21-15-9 For Time\n21 Thruster\n15 Pull-ups\n9 Burpees', wod_type: 'for-time', score_type: 'reps' as const };
    const RFT = { description: '3 rounds for time\n10 Thruster\n5 Pull-ups', wod_type: 'for-time', score_type: 'reps' as const };

    it('21-15-9 typé reps, X = 40 → 21 + 15 + 4', () => {
      expect(reps(movementCredit(LADDER, 40, 'reps', false, 'male'))).toEqual([['Thruster', 21], ['Pull-ups', 15], ['Burpees', 4]]);
    });
    it('X = 60 → le WOD écrit (45), jamais plus', () => {
      expect(reps(movementCredit(LADDER, 60, 'reps', false, 'male'))).toEqual([['Thruster', 21], ['Pull-ups', 15], ['Burpees', 9]]);
    });
    it('3 rounds for time : progression sur les tours répétés, plafonnée à 3 tours', () => {
      expect(reps(movementCredit(RFT, 37, 'reps', false, 'male'))).toEqual([['Thruster', 27], ['Pull-ups', 10]]);
      expect(reps(movementCredit(RFT, 100, 'reps', false, 'male'))).toEqual([['Thruster', 30], ['Pull-ups', 15]]);
    });
    it('typé temps, case CAP cochée : même règle ; temps fini : tout le WOD', () => {
      const t = { ...LADDER, score_type: 'time' as const };
      expect(reps(movementCredit(t, 40, 'time', true, 'male'))).toEqual([['Thruster', 21], ['Pull-ups', 15], ['Burpees', 4]]);
      expect(reps(movementCredit(t, 40, 'time', false, 'male'))).toEqual([['Thruster', 21], ['Pull-ups', 15], ['Burpees', 9]]);
    });
    it('pourcentage ignoré, bloc cardio compté, ligne non atteinte jamais créditée', () => {
      const ft = (description: string) => ({ description, wod_type: 'for-time', score_type: 'reps' as const });
      expect(reps(movementCredit(ft('For Time\n40% Ring Muscle-ups\n10 Thruster'), 5, 'reps', false, 'male'))).toEqual([['Thruster', 5]]);
      expect(reps(movementCredit(ft('For Time\nRow ~ 2 × 500 m\n10 Thruster'), 5, 'reps', false, 'male')).map(m => m[1])).toEqual([500]);
      expect(reps(movementCredit(ft('For Time\n10 Thruster\n50 m Run'), 10, 'reps', false, 'male'))).toEqual([['Thruster', 10]]);
      expect(reps(movementCredit(ft('For Time\n10 Thruster\n50 m Run\n5 Burpees'), 11, 'reps', false, 'male'))).toEqual([['Thruster', 10], ['Run', 50], ['Burpees', 1]]);
    });
    it('une distance coûte ses points (1 / 100 m) et se crédite au prorata', () => {
      const row = { description: 'For Time\n500 m Row\n20 Thruster', wod_type: 'for-time', score_type: 'reps' as const };
      expect(reps(movementCredit(row, 3, 'reps', false, 'male'))).toEqual([['Row', 300]]);
      expect(reps(movementCredit(row, 9, 'reps', false, 'male'))).toEqual([['Row', 500], ['Thruster', 4]]);
    });
    it('vrai AMRAP, autre format typé reps, charge, WOD sans type : règle d’avant', () => {
      const before = (d: string, f: string, v: number, t: string) => computeCompletedMovements(d.split('\n').filter(Boolean), f, v, t, { gender: 'male' });
      expect(movementCredit({ ...AMRAP, score_type: 'reps' }, 37, 'reps', false, 'male')).toEqual(before(AMRAP.description, 'AMRAP', 37, 'reps'));
      expect(movementCredit({ ...LADDER, wod_type: 'emom' }, 40, 'reps', false, 'male')).toEqual(before(LADDER.description, 'AMRAP', 40, 'reps'));
      expect(movementCredit({ ...LADDER, score_type: 'weight' }, 60, 'weight', false, 'male')).toEqual(before(LADDER.description, 'For Time', 60, 'weight'));
      const untyped = { description: LADDER.description, wod_type: 'for-time' };
      expect(movementCredit(untyped, 40, 'time', true, 'male')).toEqual(before(LADDER.description, 'For Time', 40, 'time'));
      expect(movementCredit(untyped, 40, 'reps', false, 'male')).toEqual(before(LADDER.description, 'For Time', 40, 'reps'));
    });
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

  describe('texte libre + blocs Musculation / Cardio (#453 PR 3b)', () => {
    const BOTH = 'Back Squat — 5 × 3 @ 100 kg\nRow ~ 2 × 500 m ~ repos 1:30\n\nFor time\n21 thrusters @43/29 + 21 pull-ups';
    const free = { description: BOTH, wod_type: 'for-time', text_mode: 'free' as const, score_type: 'time' as const };
    const row = { name: 'Row', reps: 1000, unit: 'm' };

    it('temps fini : le metcon du reste puis la série cardio, chacun une fois', () => {
      expect(movementCredit(free, 300, 'time', false, 'male')).toEqual([
        { name: 'Thruster', reps: 21, weight_kg: 43 }, { name: 'Pull-ups', reps: 21 }, row,
      ]);
    });
    it('capé, charge, reps : la série cardio seule (comme un bloc en lignes) ; faite : rien', () => {
      expect(movementCredit(free, 80, 'time', true, 'male')).toEqual([row]);
      expect(movementCredit({ ...free, wod_type: 'strength', score_type: 'weight' }, 100, 'weight', false, 'male')).toEqual([row]);
      expect(movementCredit(free, 40, 'reps', false, 'male')).toEqual([row]);
      expect(movementCredit(free, 1, 'done', false, 'male')).toEqual([]);
    });
    it('même crédit cardio qu’un WOD en lignes', () => {
      const lines = { description: 'Row ~ 2 × 500 m ~ repos 1:30', wod_type: 'strength' };
      expect(movementCredit({ ...free, description: lines.description }, 100, 'weight', false, 'male'))
        .toEqual(movementCredit(lines, 100, 'weight', false, 'male'));
    });
    it('« réalisé » coché : la série cardio seule (le metcon reste non prouvé)', () => {
      expect(completionCredit(free, 'male')).toEqual([row]);
      expect(completionCredit({ ...free, wod_type: 'amrap' }, 'male')).toEqual([]);
    });
    it('série au milieu du texte : du texte, jamais créditée comme un bloc', () => {
      const milieu = { ...free, description: 'For time\n21 thrusters @43/29\nRow ~ 2 × 500 m' };
      expect(movementCredit(milieu, 300, 'time', false, 'male')).toEqual([{ name: 'Thruster', reps: 21, weight_kg: 43 }]);
      expect(completionCredit(milieu, 'male')).toEqual([]);
    });
    it('aucune double lecture : les lignes de bloc ne sont ni reconnues ni « à corriger »', () => {
      const r = readFreeText(BOTH);
      expect(r.blocks).toEqual(['Back Squat — 5 × 3 @ 100 kg', 'Row ~ 2 × 500 m ~ repos 1:30']);
      expect(r.rest).toBe('For time\n21 thrusters @43/29 + 21 pull-ups');
      expect(r.toFix).toEqual([]);
      expect(r.recognized.map(m => m.name)).toEqual(['Thruster', 'Pull-ups']);
    });
  });
});
