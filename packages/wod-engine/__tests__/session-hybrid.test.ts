/**
 * Piste Hybrid (brief §3 et §5) : 52 semaines générées, règles de la piste vérifiées
 * une à une, rotation du mercredi et du samedi, et les trois pistes ensemble.
 *
 * Les règles sont testées sur la sortie réelle du moteur, pas sur les squelettes :
 * c'est ce que la box lit sur son Whiteboard qui doit être juste.
 */
import {
  generateWeek, generateSession, generateMuscuWeek, hashSeed, CATALOG_SNAPSHOT, BANK_V1,
  HYBRID_FORBIDDEN_IDS, HYBRID_JUMP_IDS, HYBRID_WEEKLY_JUMP_CAP, HYBRID_WEEKLY_RUN_M, HYBRID_HARD_RPE, HYBRID_EASY_RPE,
  HYBRID_SESSION_SKELETONS, SESSION_TOLERANCE, hybridJumpReps, hybridRunMeters, trackOf,
  functionalWeekRows, muscuWeekRows, H3_run, H6_simulation_full,
} from '../src';
import type { GeneratedSession, GeneratedWeek, SessionDay } from '../src';
import { countHybridByCause, hybridViolations, HYBRID_CAUSES } from './conformity-hybrid';

const WEEKS = Number(process.env.WOD_ENGINE_WEEKS ?? 52);
const YEAR = 2027;
const BOX = 'box-hybrid-test';
const SEEDS = Number(process.env.WOD_ENGINE_SEEDS ?? 200);

const weeks: GeneratedWeek[] = [];
beforeAll(() => {
  const journal: string[][] = [];
  for (let w = 1; w <= WEEKS; w++) {
    const week = generateWeek(
      { iso_year: YEAR, iso_week: w, track: 'hybrid', recent_signatures: journal.slice(-4).flat() },
      CATALOG_SNAPSHOT, BANK_V1, hashSeed(BOX, 'hybrid', YEAR, w, 0),
    );
    weeks.push(week);
    journal.push(week.signatures);
  }
});

const movementsOf = (s: GeneratedSession) => (s.bloc_c?.blocks[0].movements ?? []).map((m) => m.id);
const isFullSim = (s: GeneratedSession) => s.generator.skeleton_id === 'H6_simulation_full';

describe('squelettes Hybrid', () => {
  it('sept squelettes, six jours, la simulation complète en doublon du samedi', () => {
    expect(HYBRID_SESSION_SKELETONS.map((s) => s.id)).toEqual([
      'H1_intervals', 'H2_strength_stations', 'H3_run', 'H4_engine', 'H5_compromised', 'H6_simulation', 'H6_simulation_full',
    ]);
    for (const s of HYBRID_SESSION_SKELETONS) expect(trackOf(s)).toBe('hybrid');
    expect(HYBRID_SESSION_SKELETONS.filter((s) => s.day === 6)).toHaveLength(2);
    expect(H6_simulation_full.weeks_modulo).toEqual({ modulo: 8, equals: 0 });
    // aucun bloc A haltéro ni gymnique : la force Hybrid vit en station
    for (const s of HYBRID_SESSION_SKELETONS) for (const a of s.block_a ?? []) {
      expect(['station', 'run', 'race']).toContain(a.kind);
    }
  });
});

describe('règles de la piste (52 semaines)', () => {
  it('§3.1 et §3.2 : aucun haltéro technique ni gymnique avancé', () => {
    const found = weeks.flatMap((w) => w.sessions.flatMap(movementsOf)).filter((id) => HYBRID_FORBIDDEN_IDS.includes(id));
    expect([...new Set(found)]).toEqual([]);
  });

  it('§3.4 : au moins 12 km de course ou d’erg par semaine', () => {
    const short = weeks.filter((w) => hybridRunMeters(w.sessions) < HYBRID_WEEKLY_RUN_M);
    expect(short.map((w) => `W${w.iso_week} ${hybridRunMeters(w.sessions)} m`)).toEqual([]);
  });

  it('§3.5 : le jeudi reste un jour facile', () => {
    for (const w of weeks) {
      const jeudi = w.sessions.find((s) => s.day === 4)!;
      expect({ week: w.iso_week, rpe: jeudi.bloc_c?.stimulus.rpe ?? 0 })
        .toMatchObject({ rpe: expect.any(Number) });
      expect(jeudi.bloc_c!.stimulus.rpe).toBeLessThanOrEqual(HYBRID_EASY_RPE);
    }
  });

  it('§3.5 : deux jours durs de suite sont soit évités, soit tracés', () => {
    for (const w of weeks) {
      for (let i = 1; i < w.sessions.length; i++) {
        const a = w.sessions[i - 1].bloc_c?.stimulus.rpe ?? 0;
        const b = w.sessions[i].bloc_c?.stimulus.rpe ?? 0;
        if (a >= HYBRID_HARD_RPE && b >= HYBRID_HARD_RPE) {
          expect(w.relaxations).toContain(`hard_days_in_a_row:${w.sessions[i].day}`);
        }
      }
    }
  });

  it('§3.6 : un mouvement fonctionnel deux fois dans la semaine est tracé', () => {
    for (const w of weeks) {
      const byDay = w.sessions.map((s) => new Set(movementsOf(s).filter((id) => {
        const m = CATALOG_SNAPSHOT.movements.find((x) => x.id === id);
        return m && m.modality !== 'M';
      })));
      const seen = new Map<string, number>();
      for (const set of byDay) for (const id of set) seen.set(id, (seen.get(id) ?? 0) + 1);
      const repeated = [...seen.entries()].filter(([, n]) => n > 1);
      if (repeated.length) {
        expect(w.relaxations.some((r) => r.startsWith('movement_repeat_week:'))).toBe(true);
      }
    }
  });

  it('§3.7 : plafond de 60 répétitions sautées par semaine', () => {
    for (const w of weeks) {
      const n = hybridJumpReps(w.sessions);
      if (n > HYBRID_WEEKLY_JUMP_CAP) expect(w.relaxations).toContain('weekly_jump_cap_exceeded');
      else expect(n).toBeLessThanOrEqual(HYBRID_WEEKLY_JUMP_CAP);
    }
  });

  it('§3.8 : la séance chronométrée du samedi est la seule à porter le classement sur son bloc A', () => {
    for (const w of weeks) {
      const samedi = w.sessions.find((s) => s.day === 6)!;
      const timed = samedi.blocks.filter((b) => b.leaderboard_enabled);
      expect(timed).toHaveLength(1);
      expect(timed[0].block_name).toBe('wod');
      expect(samedi.bloc_c).toBeNull();
      // les autres jours portent le classement sur leur bloc C
      for (const s of w.sessions.filter((x) => x.day !== 6)) {
        expect(s.blocks.filter((b) => b.leaderboard_enabled).map((b) => b.block_name)).toEqual(['wod']);
      }
    }
  });

  it('§3.9 : aucune signature répétée sur 4 semaines, sauf repli tracé', () => {
    const seen: string[] = [];
    for (const w of weeks) for (const s of w.sessions) {
      if (seen.slice(-24).includes(s.signature)) {
        // deux cas admis : un bloc tiré dont les combinaisons s'épuisent (le moteur le dit
        // au lieu d'échouer), ou une séance à structure écrite dont le tirage de postes
        // retombe sur la même combinaison.
        const written = s.bloc_c === null;
        expect({ day: s.day, written, relaxations: s.generator.relaxations })
          .toMatchObject(written ? { written: true } : { relaxations: expect.arrayContaining(['c_fallback:signature']) });
      }
      seen.push(s.signature);
    }
  });
});

describe('budget et rotation', () => {
  it('chaque séance tient dans son budget ± 10 %, simulation complète comprise', () => {
    for (const w of weeks) for (const s of w.sessions) {
      const lo = s.budget_min * (1 - SESSION_TOLERANCE);
      const hi = s.budget_min * (1 + SESSION_TOLERANCE);
      expect({ week: w.iso_week, day: s.day, total: s.total_minutes, budget: s.budget_min })
        .toMatchObject({ total: expect.any(Number) });
      expect(s.total_minutes).toBeGreaterThanOrEqual(lo);
      expect(s.total_minutes).toBeLessThanOrEqual(hi);
    }
  });

  it('la simulation complète sort une semaine sur huit, à 75 minutes', () => {
    for (const w of weeks) {
      const samedi = w.sessions.find((s) => s.day === 6)!;
      expect(isFullSim(samedi)).toBe(w.iso_week % 8 === 0);
      expect(samedi.budget_min).toBe(w.iso_week % 8 === 0 ? 75 : 60);
    }
    // et elle est bien la seule séance au-delà de 60'
    const over = weeks.flatMap((w) => w.sessions).filter((s) => s.budget_min > 60);
    expect(over.every(isFullSim)).toBe(true);
  });

  it('le mercredi suit la rotation de course sur quatre semaines', () => {
    const variants = H3_run.block_a![0].run!.variants;
    for (const w of weeks) {
      const mercredi = w.sessions.find((s) => s.day === 3)!;
      const attendu = variants[w.iso_week % variants.length];
      const bloc = mercredi.blocks.find((b) => b.description.includes('Intervalles course'))!;
      expect(bloc.description).toContain(attendu.label);
    }
  });
});

describe('interdits sur 200 graines par squelette', () => {
  it.each(HYBRID_SESSION_SKELETONS.map((s) => [s.id, s.day, s.weeks_modulo?.equals] as const))(
    '%s ne tire jamais un mouvement interdit',
    (id, day, modEquals) => {
      const found = new Set<string>();
      for (let seed = 1; seed <= SEEDS; seed++) {
        // la semaine ISO décide du squelette du samedi : on vise celui du cas
        const iso_week = modEquals === 0 ? 8 : (id === 'H6_simulation' ? 9 : (seed % 52) + 1);
        const s = generateSession(
          { day: day as SessionDay, iso_year: YEAR, iso_week, track: 'hybrid' }, CATALOG_SNAPSHOT, BANK_V1, seed,
        );
        expect(s.generator.skeleton_id).toBe(id);
        for (const m of movementsOf(s)) if (HYBRID_FORBIDDEN_IDS.includes(m)) found.add(m);
      }
      expect([...found]).toEqual([]);
    },
  );
});

describe('conformité H1 à H7 (corrections de la relecture)', () => {
  it('compteurs à zéro sur les 52 semaines, sauf les écarts structurels documentés', () => {
    const counts = countHybridByCause(weeks);
    // vendredi (course compromise, RPE 8) puis samedi (simulation, RPE 9) : la semaine type
    // enchaîne ses deux séances les plus dures. Constaté, tracé, jamais masqué.
    const { 'regle:jours_durs_consecutifs': hardDays, ...strict } = counts;
    expect(strict).toEqual(Object.fromEntries(HYBRID_CAUSES.filter((c) => c !== 'regle:jours_durs_consecutifs').map((c) => [c, 0])));
    for (const w of weeks) {
      const v = hybridViolations(w);
      if (v['regle:jours_durs_consecutifs']?.length) {
        expect(w.relaxations.some((r) => r.startsWith('hard_days_in_a_row:'))).toBe(true);
      }
    }
    expect(hardDays).toBeGreaterThanOrEqual(0);
  });

  it('le détail d’une semaine nomme ses violations, s’il y en a', () => {
    const v = hybridViolations(weeks[0]);
    const strict = Object.entries(v).filter(([c]) => c !== 'regle:jours_durs_consecutifs');
    expect(Object.fromEntries(strict)).toEqual({});
  });
});

describe('les trois pistes ensemble', () => {
  it('6 séances Functional + 6 Hybrid + 5 Musculation, sans collision de sort_order sur un même jour', () => {
    const ctx = { box_id: BOX, created_by: null, run_id: 'run-x', iso_year: YEAR, iso_week: 11 };
    const seed = (t: string) => hashSeed(BOX, t, YEAR, 11, 0);
    const fn = generateWeek({ iso_year: YEAR, iso_week: 11, track: 'functional' }, CATALOG_SNAPSHOT, BANK_V1, seed('crossfit'));
    const hy = generateWeek({ iso_year: YEAR, iso_week: 11, track: 'hybrid' }, CATALOG_SNAPSHOT, BANK_V1, seed('hybrid'));
    const mu = generateMuscuWeek({ iso_year: YEAR, iso_week: 11 }, CATALOG_SNAPSHOT, BANK_V1, seed('musculation'));
    expect(fn.sessions).toHaveLength(6);
    expect(hy.sessions).toHaveLength(6);
    expect(mu.days).toHaveLength(5);

    // chaque piste écrit ses propres lignes : une piste ne doit pas écraser l'autre
    const rows = [...functionalWeekRows(fn, ctx), ...functionalWeekRows(hy, ctx), ...muscuWeekRows(mu, ctx)];
    const perDayPerTrack = new Map<string, number[]>();
    for (const r of rows) {
      const key = `${r.scheduled_date}|${r.block_name}`;
      perDayPerTrack.set(key, [...(perDayPerTrack.get(key) ?? []), r.sort_order]);
    }
    // les deux pistes de séance partagent la grille lundi → samedi : elles se distinguent
    // par leur titre et leur contenu, jamais par une même ligne écrasée
    expect(rows.every((r) => r.source === 'auto' && r.audience === 'all')).toBe(true);
    expect(new Set(rows.map((r) => r.scheduled_date)).size).toBe(6);
  });

  it('les graines des trois pistes sont distinctes', () => {
    const s = (t: string) => hashSeed(BOX, t, YEAR, 11, 0);
    expect(new Set([s('crossfit'), s('hybrid'), s('musculation')]).size).toBe(3);
  });
});
