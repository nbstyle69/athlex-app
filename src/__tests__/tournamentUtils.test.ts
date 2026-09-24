import {
  normalizeMovement,
  formatDate,
  isRepsScoredType,
  repsPerRoundFromMovements,
  amrapTotalToRoundsReps,
  roundsRepsToTotal,
  formatAmrapScore,
  isTimeScoredType,
  timeStringToSeconds,
  secondsToTimeString,
  maskTimeInput,
  parseScoreToNumber,
  formatScoreDisplay,
} from '../utils/tournamentUtils';

// ── normalizeMovement ─────────────────────────────────────────────────────────
describe('normalizeMovement', () => {
  it('normalizes known movement — deadlift', () => {
    const r = normalizeMovement('deadlift');
    expect(r.key).toBe('deadlift');
    expect(r.label).toBe('Deadlift');
  });

  it('normalizes known movement — pull-up', () => {
    const r = normalizeMovement('pull-up');
    expect(r.key).toBe('pull_up');
    expect(r.label).toBe('Pull Up');
  });

  it('normalizes French alias — traction → pull_up', () => {
    const r = normalizeMovement('traction');
    expect(r.key).toBe('pull_up');
  });

  it('normalizes thruster', () => {
    const r = normalizeMovement('thruster');
    expect(r.key).toBe('thruster');
  });

  it('normalizes burpee', () => {
    const r = normalizeMovement('burpee');
    expect(r.key).toBe('burpee');
  });

  it('produces snake_case key for unknown movement', () => {
    const r = normalizeMovement('unknown move');
    expect(r.key).toBe('unknown_move');
    expect(r.label).toBe('Unknown Move');
  });

  it('strips digits from input before lookup', () => {
    const r = normalizeMovement('5 deadlifts');
    expect(r.key).toBe('deadlift');
  });

  // Toutes ces lignes existent telles quelles dans les WOD de tournoi en base :
  // chaque variante d'écriture donnait sa propre clé, donc son propre compteur.
  it('collapses plural and hyphenated spellings onto one key', () => {
    const cases: [string, string][] = [
      ['Pull-ups', 'pull_up'],          ['Pull Up', 'pull_up'],
      ['Air Squats', 'air_squat'],      ['Wall Balls', 'wall_ball'],
      ['Toes-to-bar', 'toes_to_bar'],   ['Handstand Push-ups', 'hspu'],
      ['HSPU Stricts', 'hspu'],         ['Box Jumps', 'box_jump'],
      ['DB Thrusters', 'db_thruster'],  ['KB Thrusters', 'kb_thruster'],
      ['Sit-ups', 'sit_up'],            ['Double Unders', 'double_under'],
      ['Kettlebell Swings', 'kb_swing'], ['Wall Walks', 'wall_walk'],
      ['Squat Cleans', 'clean'],        ['Power Clean', 'clean'],
      ['Push Press', 'press'],          ['Shoulder to OH', 'press'],
      ['Cal Row', 'row'],               ['Cal Assault Bike', 'bike'],
      ['Chest-to-Bar Pull-ups', 'chest_to_bar'],
      ['Sumo Deadlift High Pull', 'sdlhp'],
      ['DB Snatches alt.', 'db_snatch'],
    ];
    cases.forEach(([raw, key]) => expect(normalizeMovement(raw).key).toBe(key));
  });
});


// ── formatDate ────────────────────────────────────────────────────────────────
describe('formatDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2026-01-15T10:00:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('does not throw for invalid input', () => {
    expect(() => formatDate('not-a-date')).not.toThrow();
    expect(typeof formatDate('not-a-date')).toBe('string');
  });
});

describe('AMRAP / Max Reps score normalization', () => {
  const wod = ['10 Thruster (43/30 kg)', '12 Pull-ups', '15 Box jump'];

  it('detects reps-scored WOD types', () => {
    expect(isRepsScoredType('AMRAP')).toBe(true);
    expect(isRepsScoredType('Max Reps')).toBe(true);
    expect(isRepsScoredType('For Time')).toBe(false);
    expect(isRepsScoredType(null)).toBe(false);
  });

  it('sums reps per round from movements', () => {
    expect(repsPerRoundFromMovements(wod)).toBe(37);
    expect(repsPerRoundFromMovements([])).toBe(0);
    expect(repsPerRoundFromMovements(null)).toBe(0);
  });

  it('gives the SAME stored total whether entered as "1 round" or "37 reps"', () => {
    const viaRounds = roundsRepsToTotal(1, 0, 37); // "1 round"
    const viaTotal  = 37;                          // "37 reps"
    expect(viaRounds).toBe(viaTotal);
  });

  it('converts total reps <-> rounds+reps consistently', () => {
    expect(roundsRepsToTotal(3, 12, 37)).toBe(123);
    expect(amrapTotalToRoundsReps(123, 37)).toEqual({ rounds: 3, reps: 12 });
  });

  it('falls back to raw total when reps-per-round is unknown', () => {
    expect(amrapTotalToRoundsReps(50, 0)).toEqual({ rounds: 0, reps: 50 });
    expect(formatAmrapScore(50, 0)).toBe('50 reps');
  });

  it('formats the recap label', () => {
    expect(formatAmrapScore(123, 37)).toBe('123 reps (3 tours + 12)');
    expect(formatAmrapScore(37, 37)).toBe('37 reps (1 tour)');
  });
});

describe('For Time score normalization', () => {
  it('detects time-scored WOD types', () => {
    expect(isTimeScoredType('For Time')).toBe(true);
    expect(isTimeScoredType('for-time')).toBe(true);
    expect(isTimeScoredType('AMRAP')).toBe(false);
    expect(isTimeScoredType(null)).toBe(false);
  });

  it('parses mm:ss into total seconds', () => {
    expect(timeStringToSeconds('12:30')).toBe(750);
    expect(timeStringToSeconds('0:05')).toBe(5);
    expect(timeStringToSeconds('1:05:30')).toBe(3930);
  });

  it('handles numeric and malformed input without throwing', () => {
    expect(timeStringToSeconds(90)).toBe(90);
    expect(timeStringToSeconds('')).toBe(0);
    expect(timeStringToSeconds(null)).toBe(0);
    expect(timeStringToSeconds('abc')).toBe(0);
  });

  it('formats seconds back to mm:ss / h:mm:ss', () => {
    expect(secondsToTimeString(750)).toBe('12:30');
    expect(secondsToTimeString(5)).toBe('0:05');
    expect(secondsToTimeString(3930)).toBe('1:05:30');
  });

  it('round-trips mm:ss through parse/format', () => {
    expect(secondsToTimeString(timeStringToSeconds('12:30'))).toBe('12:30');
  });

  it('masks raw digits into mm:ss right-to-left', () => {
    expect(maskTimeInput('1234')).toBe('12:34');
    expect(maskTimeInput('5')).toBe('0:05');
    expect(maskTimeInput('130')).toBe('1:30');
    expect(maskTimeInput('')).toBe('');
    expect(maskTimeInput('12a34')).toBe('12:34');
  });
});

describe('parseScoreToNumber / formatScoreDisplay', () => {
  it('parses For Time scores as seconds and reps as numbers', () => {
    expect(parseScoreToNumber('12:30', 'For Time')).toBe(750);
    expect(parseScoreToNumber('123', 'AMRAP')).toBe(123);
  });

  it('displays For Time as mm:ss and AMRAP as a reps recap', () => {
    expect(formatScoreDisplay('750', 'For Time')).toBe('12:30');
    expect(formatScoreDisplay('123', 'AMRAP', 37)).toBe('123 reps (3 tours + 12)');
    expect(formatScoreDisplay('abc', 'Custom')).toBe('abc');
  });
});
