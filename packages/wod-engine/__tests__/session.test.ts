/**
 * J1 — séances Functional / Hybrid (A/B/C 60') et semaines Musculation (§8 du brief).
 * 52 semaines par piste, seeds dérivés comme la fonction edge (`hashSeed`).
 */
import {
  generateSession, generateWeek, generateMuscuWeek, hashSeed, isoWeek, isoWeekMonday, muscuObjectiveForWeek,
  weeklyGymVolume, stepLine, SESSION_SKELETONS, SESSION_TOLERANCE, WEEKLY_GYM_CAPS, MUSCU_WEEKLY_CAP_SETS, MUSCU_WEEK_DAYS,
  CATALOG_SNAPSHOT, BANK_V1, BANK_VERSION, bankFromRows, skeletonToRow, movementCapToRow, sessionSkeletonToRow, isSessionSkeletonRow, SESSION_BANK_VERSION,
} from '../src';
import type { AnySkeletonRow } from '../src';
import type { GeneratedSession, GeneratedWeek, GeneratedMuscuWeek, SessionDay, Pattern } from '../src';
import { countSessionByCause, sessionViolations, SESSION_CAUSES } from './conformity-session';
import { countMuscuByCause, muscuViolations, MUSCU_CAUSES } from './conformity-muscu';
import { FINISHERS, S3_gym, splitSignatures } from '../src';
import { parseMovementLine } from '../../../src/utils/movementParser';
import { parseStrengthLine } from '../../../src/utils/strengthBlock';

const WEEKS = Number(process.env.WOD_ENGINE_WEEKS ?? 52);
const YEAR = 2027;
const DAYS: SessionDay[] = [1, 2, 3, 4, 5, 6];

const weeks: GeneratedWeek[] = [];
const muscuWeeks: GeneratedMuscuWeek[] = [];
beforeAll(() => {
  const journal: string[][] = [];
  for (let w = 1; w <= WEEKS; w++) {
    const seed = hashSeed('box-test', 'crossfit', YEAR, w, 0);
    const week = generateWeek({ iso_year: YEAR, iso_week: w, recent_signatures: journal.slice(-4).flat() }, CATALOG_SNAPSHOT, BANK_V1, seed);
    weeks.push(week);
    journal.push(week.signatures);
    muscuWeeks.push(generateMuscuWeek({ iso_year: YEAR, iso_week: w }, CATALOG_SNAPSHOT, BANK_V1, hashSeed('box-test', 'musculation', YEAR, w, 0)));
  }
});

describe('squelettes de séance', () => {
  it('six squelettes S1..S6, un par jour lundi→samedi, S6 sans bloc A', () => {
    expect(SESSION_SKELETONS.map((s) => s.id)).toEqual(['S1_snatch', 'S2_squat', 'S3_gym', 'S4_cj', 'S5_hinge', 'S6_long']);
    expect(SESSION_SKELETONS.map((s) => s.day)).toEqual(DAYS);
    expect(SESSION_SKELETONS[5].block_a).toBeNull();
    for (const s of SESSION_SKELETONS) expect(s.budget_min).toBe(60);
  });

  it('aller-retour table ↔ banque (bankFromRows) identique à la banque embarquée', () => {
    const rows = SESSION_SKELETONS.map((s) => sessionSkeletonToRow(s, SESSION_BANK_VERSION));
    for (const r of rows) expect(isSessionSkeletonRow(r) && r.format === 'session').toBe(true);
    const all: AnySkeletonRow[] = [...BANK_V1.skeletons.map((s) => skeletonToRow(s, BANK_VERSION)), ...rows];
    const bank = bankFromRows(all, BANK_V1.movement_caps.map((c) => movementCapToRow(c, BANK_VERSION)));
    expect(bank.session_skeletons).toEqual(SESSION_SKELETONS);
    expect(bank.skeletons).toEqual(BANK_V1.skeletons);
  });
});

describe('séance Functional / Hybrid (52 semaines)', () => {
  it('déterministe : même seed → même séance', () => {
    const a = generateSession({ day: 1, iso_year: YEAR, iso_week: 3 }, CATALOG_SNAPSHOT, BANK_V1, 42);
    const b = generateSession({ day: 1, iso_year: YEAR, iso_week: 3 }, CATALOG_SNAPSHOT, BANK_V1, 42);
    expect(b).toEqual(a);
    const c = generateSession({ day: 1, iso_year: YEAR, iso_week: 3 }, CATALOG_SNAPSHOT, BANK_V1, 43);
    expect(c.signature).not.toBe(a.signature);
  });

  it('chaque semaine a 6 séances, le squelette du jour, et l’ordre warmup+A / B? / C / finisher?', () => {
    for (const w of weeks) {
      expect(w.sessions.map((s) => s.day)).toEqual(DAYS);
      for (const s of w.sessions) {
        expect(s.generator.skeleton_id).toBe(SESSION_SKELETONS[s.day - 1].id);
        const names = s.blocks.map((b) => b.block_name);
        const c = names.indexOf('wod');
        expect(c).toBeGreaterThanOrEqual(0);
        expect(names.slice(0, c).every((n) => n === 'strength' || n === 'skill' || n === 'building')).toBe(true);
        expect(names.slice(c + 1).every((n) => n === 'finisher')).toBe(true);
        expect(s.blocks[0].description.startsWith('Échauffement')).toBe(true);
        if (s.day === 6) expect(names.filter((n) => n === 'strength' || n === 'skill')).toHaveLength(0);
        else expect(names[0] === 'strength' || names[0] === 'skill').toBe(true);
      }
    }
  });

  it('durée 60’ ± 10 % ou relâchement `session_budget` tracé', () => {
    for (const w of weeks) for (const s of w.sessions) {
      const within = Math.abs(s.total_minutes - s.budget_min) <= s.budget_min * SESSION_TOLERANCE;
      expect({ day: s.day, total: s.total_minutes, ok: within || s.generator.relaxations.some((r) => r.startsWith('session_budget')) }).toMatchObject({ ok: true });
      expect(s.blocks.reduce((a, b) => a + b.minutes, 0)).toBeLessThanOrEqual(s.total_minutes);
    }
  });

  it('bloc A : charges en %1RM ou note propre, jamais de kg', () => {
    for (const w of weeks) for (const s of w.sessions) {
      const a = s.blocks.find((b) => b.block_name === 'strength' || b.block_name === 'skill');
      if (!a) continue;
      expect(a.description).not.toMatch(/\d\s?kg\b/);
      const lines = a.description.split('\n').filter((l) => / — \d+ × \d+/.test(l));
      for (const l of lines) expect({ line: l, ok: /%1RM|charge /.test(l) }).toMatchObject({ ok: true });
    }
  });

  it('bloc C : intention et durée du squelette, pattern lourd de A écarté, règles Functional conservées', () => {
    for (const w of weeks) for (const s of w.sessions) {
      const sk = SESSION_SKELETONS[s.day - 1];
      const c = s.bloc_c;
      expect(c.discipline).toBe('functional');
      const relaxed = new Set(s.generator.relaxations.map((r) => r.split(':').slice(0, 2).join(':')));
      if (!relaxed.has('c_fallback:intention')) expect(sk.block_c.intentions as string[]).toContain(c.intention);
      expect(sk.block_c.durations).toContain(c.budget_min);
      if (s.heavy_pattern && !relaxed.has('c_fallback:pattern')) {
        const heavy: Pattern = s.heavy_pattern;
        const patterns = c.blocks.flatMap((b) => b.movements).map((m) => CATALOG_SNAPSHOT.movements.find((x) => x.id === m.id)?.pattern);
        expect({ day: s.day, heavy, patterns }).toMatchObject({ patterns: expect.not.arrayContaining([heavy]) });
      }
      // Mardi : cardio sans squat lourd ; jeudi / vendredi : mixed ou force ; samedi : long.
      if (s.day === 6) expect(c.budget_min).toBeGreaterThanOrEqual(25);
    }
  });

  it('relâchements : la cascade préserve l’intention avant le format, et le pattern lourd n’est jamais toléré en silence', () => {
    let intention = 0; let format = 0; let pattern = 0;
    for (const w of weeks) for (const s of w.sessions) {
      const tags = s.generator.relaxations;
      if (tags.some((t) => t.startsWith('c_fallback:intention'))) {
        intention++;
        // Seul cas toléré : jour retiré pour plafond gym (pull_v / push_v écartés), tracé au niveau semaine.
        expect(w.relaxations).toContain(`weekly_gym_cap:${s.day}`);
      }
      if (tags.some((t) => t.startsWith('c_fallback:format'))) format++;
      if (tags.some((t) => t.startsWith('c_fallback:pattern'))) pattern++;
      const sk = SESSION_SKELETONS[s.day - 1];
      const allowed: string[] = sk.block_c.intentions;
      if (!allowed.includes(s.bloc_c.intention)) {
        expect(tags.some((t) => t.startsWith('c_fallback:intention'))).toBe(true);
      }
    }
    expect(pattern).toBe(0);
    expect(intention).toBeLessThanOrEqual(2);
    expect(format).toBeGreaterThanOrEqual(0);
  });

  it('pas deux fois le même squelette C deux jours de suite, ni la même signature C sur 4 semaines', () => {
    const seen: string[] = [];
    for (const w of weeks) {
      for (let i = 1; i < w.sessions.length; i++) {
        expect(w.sessions[i].bloc_c.generator.skeleton_id).not.toBe(w.sessions[i - 1].bloc_c.generator.skeleton_id);
      }
      for (const s of w.sessions) {
        expect(seen.slice(-24)).not.toContain(s.signature);
        seen.push(s.signature);
      }
    }
  });

  it(`compteurs P1–P3 à zéro sur ${WEEKS} semaines (bloc B, finishers, progressions skill)`, () => {
    const all: string[] = [];
    for (const [i, w] of weeks.entries()) all.push(...sessionViolations(w, weeks.slice(0, i)));
    const counts = countSessionByCause(all);
    console.log(`session P1–P3 : ${weeks.length} semaines`, counts, all.slice(0, 20));
    for (const c of SESSION_CAUSES) expect(counts[c]).toBe(0);
  });

  it('P1 · options de B par squelette (brief) et B tiré dans les options du squelette du jour', () => {
    const byDay: Record<number, string[]> = {
      1: ['overhead_squat', 'snatch_balance', 'strict_pull_up'],
      2: ['push_press', 'strict_press', 'ring_dip', 'strict_pull_up'],
      3: ['ring_dip', 'strict_handstand_push_up', 'strict_pull_up'],
      4: ['front_squat', 'push_press', 'strict_pull_up'],
      5: ['front_rack_lunge', 'strict_press', 'ghd_sit_up'],
    };
    for (const sk of SESSION_SKELETONS) {
      if (sk.block_b) expect(sk.block_b.map((o) => o.movement).sort()).toEqual([...byDay[sk.day]].sort());
    }
    for (const w of weeks) for (const s of w.sessions) {
      if (s.block_b_movement) expect(byDay[s.day]).toContain(s.block_b_movement);
    }
    // sur 52 semaines, l'OHS ne monopolise pas le lundi et le RDL n'apparaît plus en B
    const mondays = weeks.map((w) => w.sessions[0].block_b_movement).filter(Boolean);
    expect(new Set(mondays).size).toBeGreaterThan(1);
    expect(weeks.flatMap((w) => w.sessions.map((s) => s.block_b_movement))).not.toContain('romanian_deadlift');
  });

  it('P2 · banque ≥ 10 finishers couvrant tronc, carries, épaules, fessiers, mollets, respiratoire ; journal `finisher:<id>` relu', () => {
    expect(FINISHERS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(FINISHERS.map((f) => f.id)).size).toBe(FINISHERS.length);
    expect(new Set(FINISHERS.map((f) => f.family))).toEqual(new Set(['core', 'carry', 'shoulders', 'glutes', 'calves', 'breathing']));
    const used = new Set(weeks.flatMap((w) => w.sessions.map((s) => s.finisher_id).filter(Boolean)));
    expect(used.size).toBeGreaterThanOrEqual(20);
    const { c, finishers } = splitSignatures(weeks[0].signatures);
    expect(c).toEqual(weeks[0].sessions.map((s) => s.signature));
    expect(finishers).toEqual(weeks[0].sessions.map((s) => s.finisher_id).filter(Boolean));
  });

  it('P3 · sept skills en S3 (C2B, HSPU, BMU, RMU, rope climb, wall walk, HS walk), progression A/B distincte par skill', () => {
    const ids = (S3_gym.block_a ?? []).map((o) => o.movement).sort();
    expect(ids).toEqual(['bar_muscle_up', 'chest_to_bar', 'handstand_push_up', 'handstand_walk', 'ring_muscle_up', 'rope_climb', 'wall_walk']);
    const steps = (S3_gym.block_a ?? []).flatMap((o) => [o.skill!.progression.a, o.skill!.progression.b]);
    expect(new Set(steps).size).toBe(steps.length);
  });

  it('plafonds gym hebdo (RX) : pull ≤ 150, HSPU ≤ 80, le volume est celui des blocs C', () => {
    for (const w of weeks) {
      expect(w.gym_volume).toEqual(weeklyGymVolume(w.sessions));
      expect(w.gym_volume.pull).toBeLessThanOrEqual(WEEKLY_GYM_CAPS.pull);
      expect(w.gym_volume.hspu).toBeLessThanOrEqual(WEEKLY_GYM_CAPS.hspu);
    }
  });

  it('descriptions lisibles : lignes de force relues par strengthBlock, mouvements du bloc C par movementParser', () => {
    for (const w of weeks.slice(0, 8)) for (const s of w.sessions) {
      for (const b of s.blocks) {
        if (b.block_name === 'strength' || b.block_name === 'building') {
          for (const l of b.description.split('\n').filter((x) => / — \d+ × \d+/.test(x))) {
            const p = parseStrengthLine(l);
            expect({ line: l, parsed: !!p }).toMatchObject({ parsed: true });
          }
        }
        if (b.block_name === 'wod' && !/^\d+ rounds × \d+ stations/m.test(b.description)) {
          const lines = b.description.split('\n').map((l) => l.replace(/^(R\d+|Min \d+) · /, '')).filter((l) => /^\d+(\.\d+)? /.test(l) && !/^\d+ rounds?/i.test(l));
          const hits = lines.map((l) => parseMovementLine(l)).filter(Boolean);
          expect(hits.length).toBeGreaterThan(0);
        }
        expect(b.wod_json).toBeTruthy();
        expect(b.title.length).toBeGreaterThan(3);
      }
    }
    expect(stepLine('Back Squat', { sets: 5, reps: 5, percent: 75, rest_s: 150 }, '3-1-X-1')).toBe('Back Squat — 5 × 5 @ 75 %1RM — repos 2:30 — tempo 3-1-X-1');
    expect(stepLine('Back Squat', { sets: 5, reps: 5, percent: null, rest_s: 120, note: 'lourde, propre' })).toBe('Back Squat — 5 × 5 — repos 2:00 — charge lourde, propre');
    expect(parseStrengthLine(stepLine('Back Squat', { sets: 5, reps: 5, percent: 75, rest_s: 150 }))).toMatchObject({ sets: 5, reps: 5 });
  });

  it('seul le bloc C garde le classement ; les autres blocs sont hors leaderboard', () => {
    for (const s of weeks[0].sessions) for (const b of s.blocks) {
      if (b.block_name !== 'wod') expect(b.leaderboard_enabled).toBe(false);
    }
  });
});

describe('semaine Musculation (52 semaines)', () => {
  it('5 jours lun / mar / jeu / ven / sam(20’), cibles fixes, leaderboard désactivé', () => {
    for (const w of muscuWeeks) {
      expect(w.days.map((d) => [d.day, d.target, d.budget_min])).toEqual(MUSCU_WEEK_DAYS.map((d) => [d.day, d.target, d.budget_min]));
      for (const d of w.days) {
        expect(d.wod.leaderboard_enabled).toBe(false);
        expect(d.wod.discipline).toBe('musculation');
        // M8 : pas de Force en Tronc → le samedi tronc d'une semaine Force passe en Prise de muscle
        expect(d.wod.objective).toBe(d.target === 'tronc' && w.objective === 'force' ? 'hypertrophie' : w.objective);
      }
    }
  });

  it('compteurs M1–M10 à zéro sur les 52 semaines de la piste box', () => {
    const violations: string[] = [];
    for (const w of muscuWeeks) for (const d of w.days) {
      const v = muscuViolations(d.wod, { entry: 'express', target: d.target, objective: d.wod.objective, budget_min: d.budget_min, equipment: 'box', level: 'inter' });
      violations.push(...v.map((x) => `${x} ← semaine ${w.iso_week} jour ${d.day}`));
    }
    const counts = countMuscuByCause(violations);
    console.log('piste Musculation M1–M10 :', muscuWeeks.length * 5, 'séances', counts, violations.slice(0, 10));
    for (const c of MUSCU_CAUSES) expect({ cause: c, n: counts[c] }).toEqual({ cause: c, n: 0 });
  });

  it('objectif par cycle : 1-2 hypertrophie, 3-4 endurance, 5-6 force, puis rebouclage', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 12, 13].map(muscuObjectiveForWeek)).toEqual([
      'hypertrophie', 'hypertrophie', 'endurance', 'endurance', 'force', 'force', 'hypertrophie', 'hypertrophie', 'force', 'hypertrophie',
    ]);
    for (const w of muscuWeeks) expect(w.objective).toBe(muscuObjectiveForWeek(w.iso_week));
  });

  it('≤ 16 séries hebdo par muscle principal, sinon relâchement tracé et corrigé', () => {
    for (const w of muscuWeeks) {
      for (const [m, n] of Object.entries(w.sets_by_muscle)) expect({ week: w.iso_week, m, n }).toMatchObject({ n: expect.any(Number) });
      expect(Math.max(...Object.values(w.sets_by_muscle).map((n) => n ?? 0))).toBeLessThanOrEqual(MUSCU_WEEKLY_CAP_SETS);
    }
  });

  it('les exercices varient avec le seed et se relisent dans la grammaire strength', () => {
    const sigs = new Set(muscuWeeks.flatMap((w) => w.days.map((d) => d.wod.signature)));
    expect(sigs.size).toBeGreaterThan(muscuWeeks.length * 3);
    for (const w of muscuWeeks.slice(0, 6)) for (const d of w.days) {
      const lines = d.wod.description.split('\n').filter((l) => / — \d+ × /.test(l));
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) expect({ line: l, ok: !!parseStrengthLine(l) }).toMatchObject({ ok: true });
      expect(d.wod.description).toMatch(/%1RM|RPE|poids du corps/);
    }
  });
});

describe('calendrier ISO', () => {
  it('isoWeek / isoWeekMonday cohérents (2026-W01 commence le 29/12/2025, 2027-W52 le 27/12/2027)', () => {
    expect(isoWeekMonday(2026, 1).toISOString().slice(0, 10)).toBe('2025-12-29');
    expect(isoWeekMonday(2027, 52).toISOString().slice(0, 10)).toBe('2027-12-27');
    expect(isoWeek(new Date('2026-01-01T00:00:00Z'))).toEqual({ iso_year: 2026, iso_week: 1 });
    expect(isoWeek(new Date('2027-01-03T00:00:00Z'))).toEqual({ iso_year: 2026, iso_week: 53 });
  });
});
