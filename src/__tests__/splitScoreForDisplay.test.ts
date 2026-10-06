import { DNF_BASE, formatScoreValue, splitScoreForDisplay } from '../utils/scoreFormat';

describe('splitScoreForDisplay (carte « Partager ma perf »)', () => {
  test('temps : la valeur seule, sans unité', () => {
    expect(splitScoreForDisplay(267, 'time', false)).toEqual({ value: '04:27', unit: '' });
  });

  test('temps capé : CAP, et les reps en unité', () => {
    expect(splitScoreForDisplay(12, 'time', true)).toEqual({ value: 'CAP', unit: '+ 12 REPS' });
    // Encodage hérité DNF_BASE + reps : même découpage.
    expect(splitScoreForDisplay(DNF_BASE + 12, 'time', null)).toEqual({ value: 'CAP', unit: '+ 12 REPS' });
  });

  test('reps, weight, rounds : nombre + unité en capitales', () => {
    expect(splitScoreForDisplay(156, 'reps')).toEqual({ value: '156', unit: 'REPS' });
    expect(splitScoreForDisplay(170, 'weight')).toEqual({ value: '170', unit: 'KG' });
    expect(splitScoreForDisplay(102.5, 'weight')).toEqual({ value: '102.5', unit: 'KG' });
    expect(splitScoreForDisplay(5, 'rounds')).toEqual({ value: '5', unit: 'RNDS' });
  });

  test('ne change pas le contenu de formatScoreValue', () => {
    const cases: [number, string, boolean?][] = [[267, 'time', false], [12, 'time', true], [156, 'reps'], [170, 'weight'], [5, 'rounds'], [42, 'autre']];
    for (const [v, type, capped] of cases) {
      const { value, unit } = splitScoreForDisplay(v, type, capped);
      expect([value, unit].filter(Boolean).join(' ').toLowerCase()).toBe(formatScoreValue(v, type, capped).toLowerCase());
    }
  });
});
