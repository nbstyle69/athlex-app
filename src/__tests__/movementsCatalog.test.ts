import { serializeMovement, parseMovementRow, isWeightedMovement, MOVEMENT_CATALOG, defaultUnitFor } from '../utils/movementsCatalog';
import { parseMovementLine } from '../utils/movementParser';
import { normalizeMovement, isKnownMovementKey } from '../utils/tournamentUtils';
import { MOVEMENT_BADGE_PREFIX } from '../services/gamification';

describe('movementsCatalog serialize/parse', () => {
  it('serializes reps + name + weight into a parseable line', () => {
    expect(serializeMovement(21, 'Thruster', 43)).toBe('21 Thruster (43 kg)');
    expect(serializeMovement(12, 'Pull-ups')).toBe('12 Pull-ups');
    expect(serializeMovement(12, 'Pull-ups', 0)).toBe('12 Pull-ups');
  });

  it('serializes separate men / women loads', () => {
    expect(serializeMovement(21, 'Thruster', 43, 30)).toBe('21 Thruster (43/30 kg)');
    expect(serializeMovement(21, 'Thruster', null, 30)).toBe('21 Thruster (30 kg)');
    expect(serializeMovement(21, 'Thruster', 43, 0)).toBe('21 Thruster (43 kg)');
  });

  it('round-trips through parseMovementRow (editor prefill)', () => {
    const line = serializeMovement(21, 'Thruster', 43);
    const row = parseMovementRow(line);
    expect(row).toEqual({ reps: 21, name: 'Thruster', weightKg: 43, weightKgWomen: null });
  });

  it('round-trips men / women loads through parseMovementRow', () => {
    const line = serializeMovement(21, 'Thruster', 43, 30);
    expect(line).toBe('21 Thruster (43/30 kg)');
    expect(parseMovementRow(line)).toEqual({ reps: 21, name: 'Thruster', weightKg: 43, weightKgWomen: 30 });
  });

  it('parses a partial row (no reps yet) without losing the name', () => {
    expect(parseMovementRow('Thruster')).toEqual({ reps: null, name: 'Thruster', weightKg: null, weightKgWomen: null });
  });

  it('produces lines that the badge parser (parseMovementLine) reads back', () => {
    const line = serializeMovement(15, 'Wall Balls', 9);
    const parsed = parseMovementLine(line);
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe('Wall Balls');
    expect(parsed!.reps).toBe(15);
    expect(parsed!.weight_kg).toBe(9);
  });

  it('badge parser reads the men load from a men/women line', () => {
    const line = serializeMovement(15, 'Wall Balls', 9, 6);
    expect(line).toBe('15 Wall Balls (9/6 kg)');
    const parsed = parseMovementLine(line);
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe('Wall Balls');
    expect(parsed!.reps).toBe(15);
    expect(parsed!.weight_kg).toBe(9);
  });

  it('knows which catalog movements are weighted', () => {
    expect(isWeightedMovement('Thruster')).toBe(true);
    expect(isWeightedMovement('Pull-ups')).toBe(false);
    expect(isWeightedMovement('Unknown Move')).toBe(false);
  });
});

describe('catalogue haltéro élargi (12 mouvements, en reps)', () => {
  const twelve = [
    'Snatch Balance', 'Snatch High Pull', 'Clean Pull', 'Tall Clean', 'Power Jerk',
    'Split Jerk', 'Back Rack Split Jerk', 'Strict Press', 'DB Strict Press',
    'Bench Press', 'Zercher Squat', 'Wall Walk',
  ];

  it('les douze sont au catalogue, en reps', () => {
    for (const name of twelve) {
      expect(MOVEMENT_CATALOG.some(m => m.name === name)).toBe(true);
      expect(defaultUnitFor(name)).toBe('reps');
    }
    expect(isWeightedMovement('Bench Press')).toBe(true);
    expect(isWeightedMovement('Wall Walk')).toBe(false);
  });

  it('chaque nom se résout sur une clé canonique connue des compteurs', () => {
    const keys: Record<string, string> = {
      'Snatch Balance': 'snatch_balance', 'Snatch High Pull': 'snatch_high_pull',
      'Clean Pull': 'clean_pull', 'Tall Clean': 'clean', 'Power Jerk': 'press',
      'Split Jerk': 'press', 'Back Rack Split Jerk': 'press', 'Strict Press': 'press',
      'DB Strict Press': 'db_strict_press', 'Bench Press': 'bench_press',
      'Zercher Squat': 'squat', 'Wall Walk': 'wall_walk',
    };
    for (const [name, key] of Object.entries(keys)) {
      expect(normalizeMovement(name).key).toBe(key);
      expect(isKnownMovementKey(key)).toBe(true);
    }
  });

  it('alias usuels', () => {
    expect(normalizeMovement('bench').key).toBe('bench_press');
    expect(normalizeMovement('5 Bench Press').key).toBe('bench_press');
    expect(normalizeMovement('shoulder press').key).toBe('press');
    expect(normalizeMovement('WW').key).toBe('wall_walk');
    expect(normalizeMovement('Wall Walks').key).toBe('wall_walk');
    expect(normalizeMovement('jerk').key).toBe('press');
    expect(normalizeMovement('Snatch Pull').key).toBe('snatch_high_pull');
    expect(normalizeMovement('Snatch High Pulls').key).toBe('snatch_high_pull');
  });

  it('les nouvelles clés ont un préfixe de badge', () => {
    expect(MOVEMENT_BADGE_PREFIX.bench_press).toBe('mv_bench_press');
    expect(MOVEMENT_BADGE_PREFIX.snatch_balance).toBe('mv_snatch_balance');
    expect(MOVEMENT_BADGE_PREFIX.snatch_high_pull).toBe('mv_snatch_hp');
    expect(MOVEMENT_BADGE_PREFIX.clean_pull).toBe('mv_clean_pull');
    expect(MOVEMENT_BADGE_PREFIX.db_strict_press).toBe('mv_db_strict_press');
  });

  it('les lignes de WOD créditent la bonne clé', () => {
    expect(parseMovementLine('5 Bench Press (60/40 kg)')).toMatchObject({ name: 'Bench Press', reps: 5, weight_kg: 60 });
    expect(parseMovementLine('3 Wall Walk')).toMatchObject({ name: 'Wall Walk', reps: 3 });
  });
});
