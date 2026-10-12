/**
 * Les quatre endroits où un texte français du moteur sert de clé ou est relu
 * par du code (étude i18n « Moteur », § 1.6). La traduction ne doit jamais les
 * toucher : chacun est figé ici sur sa valeur de master.
 *   1. libellés des plafonds de mouvement (`bank/rows.ts`, tri par libellé) ;
 *   2. noms de mouvement des exclusions et d'« Après ma classe » ;
 *   3. relecture des lignes du WOD du jour (`stripLine` de generate.ts et muscu.ts) ;
 *   4. `note.startsWith('montée')` de `stepLine` (session.ts).
 */
import { createHash } from 'crypto';
import {
  BANK_V1, BANK_VERSION, MOVEMENT_CAPS, CATALOG_SNAPSHOT, afterClassFilter, afterClassMuscles, bankFromRows, generateBlocC,
  generateMuscu, movementCapToRow, nameKey, resolveMovement, skeletonToRow, stepLine,
} from '../src';
import type { StrengthStep } from '../src';
import { CLASSES } from './instantane/chemins';

const C = CATALOG_SNAPSHOT;

describe('1. libellés des plafonds : des clés, pas du texte affiché', () => {
  const LABELS = [
    'HSPU', 'strict HSPU', 'C2B', 'pull-ups', 'T2B', 'BMU', 'RMU', 'rope climb', 'wall walk', 'HS walk',
    'barre heavy', 'barre medium', 'barre light', 'wall balls', 'corde à sauter', 'devil press',
    'burpee box jump over', 'box jump over', 'DB snatch', 'burpees',
  ];

  it('libellés et ordre inchangés, dans la banque embarquée comme dans MOVEMENT_CAPS', () => {
    expect(BANK_V1.movement_caps.map((c) => c.label)).toEqual(LABELS);
    expect(MOVEMENT_CAPS.map((c) => c.label)).toEqual(LABELS);
  });

  it('bankFromRows range les plafonds lus en base par leur libellé, quel que soit l’ordre des lignes', () => {
    const rows = BANK_V1.movement_caps.map((c) => movementCapToRow(c, BANK_VERSION)).reverse();
    const bank = bankFromRows(BANK_V1.skeletons.map((s) => skeletonToRow(s, BANK_VERSION)), rows);
    expect(bank.movement_caps.map((c) => c.label)).toEqual(LABELS);
  });
});

describe('2. noms de mouvement : clés des exclusions et d’« Après ma classe »', () => {
  it('noms du catalogue embarqué inchangés (324 mouvements, empreinte id=nom)', () => {
    const empreinte = createHash('sha256').update(C.movements.map((m) => `${m.id}=${m.name}`).join('\n')).digest('hex');
    expect(C.movements).toHaveLength(324);
    expect(empreinte).toBe('e73e42e70035d20ec442ca12490192c24e304a1ca8b349dcc42cdb2d699d743f');
  });

  it('nameKey et resolveMovement retrouvent les mêmes mouvements', () => {
    const vu = ['Thrusters', 'Pull-ups', 'Wall Balls', 'Toes-to-Bar', 'Box Jump-overs', 'Rope Climb', 'Développé couché']
      .map((n) => [n, nameKey(n), resolveMovement(C, n)?.id ?? null]);
    expect(vu).toEqual([
      ['Thrusters', 'thruster', 'thruster'],
      ['Pull-ups', 'pull up', 'pull_up'],
      ['Wall Balls', 'wall ball', 'wall_ball'],
      ['Toes-to-Bar', 'toe to bar', 'toes_to_bar'],
      ['Box Jump-overs', 'box jump over', 'box_jump_over'],
      ['Rope Climb', 'rope climb', 'rope_climb'],
      ['Développé couché', 'd velopp couch', null],
    ]);
  });

  it('une exclusion par nom affiché écarte le mouvement (metcon et Musculation)', () => {
    // sans exclusion, les mouvements visés sortent bien sur ces graines : le test n'est pas vide
    let sans = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const ids = generateBlocC({ entry: 'express', discipline: 'functional', budget_min: 15, intention: 'mixed', format: 'surprise' }, C, BANK_V1, seed)
        .blocks[0].movements.map((m) => m.id);
      if (ids.includes('thruster') || ids.includes('wall_ball')) sans++;
    }
    expect(sans).toBeGreaterThan(0);
    for (let seed = 1; seed <= 60; seed++) {
      const w = generateBlocC({
        entry: 'express', discipline: 'functional', budget_min: 15, intention: 'mixed', format: 'surprise', exclude: ['Thruster', 'Wall Balls'],
      }, C, BANK_V1, seed);
      expect(w.blocks[0].movements.map((m) => m.id)).not.toEqual(expect.arrayContaining(['thruster']));
      expect(w.blocks[0].movements.map((m) => m.id)).not.toEqual(expect.arrayContaining(['wall_ball']));
      const mu = generateMuscu({
        entry: 'express', target: 'push', objective: 'hypertrophie', budget_min: 45, equipment: 'gym', level: 'inter', exclude: ['Incline DB Press', 'Strict Press'],
      }, C, BANK_V1, seed);
      const ids = mu.blocks[0].exercises.map((e) => e.id);
      expect(ids).not.toContain('incline_db_press');
      expect(ids).not.toContain('strict_press');
    }
  });
});

describe('3. relecture des lignes du WOD du jour (stripLine)', () => {
  it('Après ma classe metcon : patterns, familles et matériel évités inchangés', () => {
    const vu = CLASSES.map((cl) => {
      const f = afterClassFilter(C, cl);
      return { p: [...f.patterns], f: [...f.families], e: [...f.equipment] };
    });
    expect(vu).toEqual([
      { p: ['squat', 'push_v', 'lunge'], f: ['barbell'], e: ['barbell', 'rack'] },
      { p: ['squat', 'push_v', 'pull_v', 'lunge'], f: ['barbell'], e: ['barbell'] },
      { p: ['hinge', 'squat', 'pull_h', 'lunge'], f: ['barbell', 'box', 'erg'], e: ['barbell', 'box', 'rower'] },
      { p: ['squat', 'push_v', 'lunge'], f: ['wallball', 'run'], e: ['wallball'] },
      { p: [], f: [], e: [] },
      { p: ['squat', 'lunge'], f: ['dumbbell'], e: ['dumbbell', 'bench'] },
      { p: ['pull_v'], f: ['jump_rope'], e: ['jump_rope'] },
      { p: [], f: [], e: [] },
      { p: ['push_h'], f: ['barbell'], e: ['barbell', 'bench'] },
      { p: ['squat', 'push_v', 'pull_h', 'lunge'], f: ['wallball', 'erg'], e: ['wallball', 'rower'] },
      { p: [], f: [], e: [] },
    ]);
  });

  it('Après ma classe Musculation : muscles évités et cible proposée inchangés', () => {
    expect(CLASSES.map((cl) => afterClassMuscles(C, { day_movements: cl }))).toEqual([
      { excluded: ['quadriceps', 'fessiers', 'epaules'], suggested_target: 'tronc' },
      { excluded: ['quadriceps', 'fessiers', 'epaules', 'dos', 'biceps'], suggested_target: 'tronc' },
      { excluded: [], suggested_target: 'haut' },
      { excluded: [], suggested_target: 'haut' },
      { excluded: [], suggested_target: 'haut' },
      { excluded: ['quadriceps', 'fessiers'], suggested_target: 'haut' },
      { excluded: ['dos', 'biceps'], suggested_target: 'bas' },
      { excluded: [], suggested_target: 'haut' },
      { excluded: ['pecs', 'triceps'], suggested_target: 'bas' },
      { excluded: ['quadriceps', 'fessiers', 'epaules', 'dos'], suggested_target: 'tronc' },
      { excluded: [], suggested_target: 'haut' },
    ]);
  });
});

describe('4. stepLine : une note qui commence par « montée » retire le tempo', () => {
  const st: StrengthStep = { sets: 5, reps: 3, percent: 80, rest_s: 150 };

  it('sans note, avec une note « montée », avec une autre note', () => {
    expect(stepLine('Back Squat', st, '3-1-X-1')).toBe('Back Squat — 5 × 3 @ 80 %1RM — repos 2:30 — tempo 3-1-X-1');
    expect(stepLine('Back Squat', { ...st, note: 'montée jusqu\'à 85 %' }, '3-1-X-1'))
      .toBe('Back Squat — 5 × 3 @ 80 %1RM — repos 2:30 — charge montée jusqu\'à 85 %');
    expect(stepLine('Back Squat', { ...st, percent: null, note: 'strict, qualité avant quantité' }, '3-1-X-1'))
      .toBe('Back Squat — 5 × 3 — repos 2:30 — tempo 3-1-X-1 — charge strict, qualité avant quantité');
  });
});
