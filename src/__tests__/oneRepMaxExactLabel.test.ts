/**
 * R1 (retour 1.0.61) — le 1RM d'un bloc de musculation est d'abord le record
 * de SON libellé de la page Records ; la famille du générateur n'est qu'un repli.
 * Le générateur (parsePersonalRecords / resolveLoad) ne change pas.
 */
import { oneRepMaxFromRecords } from '../hooks/useMyOneRepMax';
import { annotateStrengthLoads, parseStrengthLine } from '../utils/strengthBlock';
import { buildStrengthGrid } from '../services/strengthSets';
import { parsePersonalRecords, resolveLoad } from '../utils/wod/movementLoadability';

const forRecords = (records: Record<string, unknown>) => (name: string) => oneRepMaxFromRecords(name, records);

describe('1RM exact du libellé avant la famille', () => {
  // 91 % de 100 = 91, arrondi au pas de 2,5 kg des charges → 90.
  it.each(['Bench Press', 'Hip Thrust'])('%s @ 91 %%1RM avec un 1RM de 100', movement => {
    const oneRepMaxFor = forRecords({ [`weightlifting_${movement}`]: '100' });
    const line = `${movement} — 3 × 2 @ 91 %1RM`;
    expect(annotateStrengthLoads(line, oneRepMaxFor)).toBe(`${line} (≈ 90 kg)`);
    const grid = buildStrengthGrid([parseStrengthLine(line)!], oneRepMaxFor);
    expect(grid).toHaveLength(3);
    expect(grid[0]).toMatchObject({ reps: '2', loadKg: '90' });
  });

  it('rapproche le nom comme la gymnastique (casse, tirets, espaces, pluriel)', () => {
    const oneRepMaxFor = forRecords({ 'weightlifting_Hip Thrust': '100', 'Haltérophilie_Bench Press': '80' });
    expect(oneRepMaxFor('hip-thrusts')).toBe(100);
    expect(oneRepMaxFor('BENCH  PRESS')).toBe(80); // ancienne clé lue comme readPr
  });

  it('Strict Press utilise son propre record, pas le Push Press plus lourd', () => {
    const oneRepMaxFor = forRecords({ 'weightlifting_Strict Press': '60', 'weightlifting_Push Press': '80' });
    expect(oneRepMaxFor('Strict Press')).toBe(60);
    expect(annotateStrengthLoads('Strict Press — 5 × 3 @ 50 %1RM', oneRepMaxFor))
      .toBe('Strict Press — 5 × 3 @ 50 %1RM (≈ 30 kg)');
  });

  it('Squat Clean sans record exact retombe sur la famille clean', () => {
    const oneRepMaxFor = forRecords({ 'weightlifting_Power Clean': '100', 'weightlifting_Hang Squat Clean': '90' });
    expect(oneRepMaxFor('Squat Clean')).toBe(100);
    expect(oneRepMaxFor('Squat Cleans')).toBe(100);
  });

  it('un record exact hors plage est ignoré, sans 1RM ni famille → null', () => {
    expect(forRecords({ 'weightlifting_Bench Press': '4' })('Bench Press')).toBeNull();
    expect(forRecords({})('Bench Press')).toBeNull();
  });
});

describe('générateur inchangé', () => {
  const records = {
    'weightlifting_Bench Press': '100', 'weightlifting_Hip Thrust': '150',
    'weightlifting_Strict Press': '60', 'weightlifting_Push Press': '80',
  };

  it('parsePersonalRecords garde ses familles (Strict Press fusionné au Push Press, Bench et Hip Thrust ignorés)', () => {
    expect(parsePersonalRecords(records)).toEqual({ push_press: 80 });
    expect(parsePersonalRecords({ 'weightlifting_Strict Press': '60' })).toEqual({ push_press: 60 });
  });

  it('resolveLoad calcule toujours sur la famille', () => {
    expect(resolveLoad('pushPress', 'RX', parsePersonalRecords(records))).toEqual({ kg: 40, source: 'pr' });
  });
});
