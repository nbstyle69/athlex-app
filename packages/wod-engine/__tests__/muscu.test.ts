import {
  generateMuscu, targetAvailable, availableTargets, availableDurations, afterClassMuscles, renderMuscu, exerciseLine, muscuSignature, percentForReps,
  InvalidMuscuParams, CATALOG_SNAPSHOT, BANK_V1, MUSCU_SKELETONS, MUSCU_TARGETS, MUSCU_OBJECTIVES, MUSCU_DURATIONS, TARGET_MUSCLES,
  VOLUME_CAP_SETS, BEGINNER_MAX_EXERCISES, BEGINNER_MAX_EXERCISES_LONG, BEGINNER_LONG_BUDGET_MIN, WEIGHTED_IDS, MUSCU_TOLERANCE, bankFromRows, muscuSkeletonToRow, skeletonToRow, movementCapToRow,
  BANK_VERSION, MUSCU_BANK_VERSION, MOVEMENT_GROUPS, CORE_MAX_OUTSIDE_TRONC, BONUS_EXCLUDED_IDS,
} from '../src';
import type { MuscuEquipment, MuscuLevel, MuscuParams, MuscuWod, Muscle } from '../src';
import { parseStrengthLine, isStrengthLine } from '../../../src/utils/strengthBlock';
import MUSCU_ALIGNMENT from '../catalog/muscu-alignment.cjs';
import { muscuConformityGrid, muscuViolations, countMuscuByCause, MUSCU_CAUSES } from './conformity-muscu';
import { readFileSync } from 'fs';
import path from 'path';

const SEEDS = Number(process.env.WOD_ENGINE_SEEDS ?? 200);
const EQ: MuscuEquipment[] = ['none', 'box', 'gym'];
const LV: MuscuLevel[] = ['debutant', 'inter', 'avance'];
const gen = (p: MuscuParams, seed: number): MuscuWod => generateMuscu(p, CATALOG_SNAPSHOT, BANK_V1, seed);
const base: MuscuParams = { entry: 'express', target: 'push', objective: 'hypertrophie', budget_min: 45, equipment: 'gym', level: 'inter' };
const muscuRows = CATALOG_SNAPSHOT.movements.filter((m) => m.muscu);

function* grid(): Generator<MuscuParams> {
  for (const target of MUSCU_TARGETS) for (const objective of MUSCU_OBJECTIVES) for (const equipment of EQ) for (const level of LV) {
    if (objective === 'force' && (equipment === 'none' || target === 'tronc')) continue;
    if (!targetAvailable(CATALOG_SNAPSHOT, target, equipment, level)) continue;
    // seules les durées proposées à l'écran (celles que le catalogue peut remplir) sont tirées
    for (const budget_min of availableDurations(CATALOG_SNAPSHOT, BANK_V1, { entry: 'express', target, objective, equipment, level })) yield { entry: 'express', target, objective, equipment, level, budget_min };
  }
}

describe('catalogue musculation (import CSV v1)', () => {
  it('179 exercices (173 du CSV + 5 variantes faciles sans matériel + Banded Pull-Ups), 19 partagés avec le catalogue metcon (13 annoncés par le brief + 6 alignés par nom), 160 nouveaux', () => {
    expect(muscuRows).toHaveLength(179);
    const shared = Object.keys(MUSCU_ALIGNMENT);
    expect(shared).toHaveLength(19);
    const sharedIds = new Set(Object.values(MUSCU_ALIGNMENT) as string[]);
    const sharedRows = muscuRows.filter((m) => sharedIds.has(m.id));
    expect(sharedRows).toHaveLength(19);
    // partagé = ligne metcon existante (poids metcon renseignés ou ligne legacy inactive), jamais une seconde ligne
    for (const m of sharedRows) expect(m.notes ?? '').not.toMatch(/^Musculation/);
    expect(muscuRows.filter((m) => !sharedIds.has(m.id))).toHaveLength(160);
    const names = CATALOG_SNAPSHOT.movements.map((m) => m.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('les nouveaux exercices ne sont jamais tirés en metcon (poids Functional / Hybrid à 0) et les 14 legacy restent inactifs', () => {
    for (const m of muscuRows) if ((m.notes ?? '').startsWith('Musculation')) {
      expect(m.weight_functional).toBe(0);
      expect(m.weight_hybrid).toBe(0);
    }
    expect(CATALOG_SNAPSHOT.movements.filter((m) => !m.active)).toHaveLength(14);
    expect(CATALOG_SNAPSHOT.movements.filter((m) => m.active && (m.weight_functional > 0 || m.weight_hybrid > 0))).toHaveLength(95);
  });

  it('chaque exercice a un poids de tirage, une plage par objectif et des métadonnées 1RM cohérentes', () => {
    for (const m of muscuRows) {
      const mu = m.muscu!;
      expect(mu.weight_bodyweight + mu.weight_box + mu.weight_gym).toBeGreaterThan(0);
      expect(mu.objectives.length).toBeGreaterThan(0);
      for (const o of mu.objectives) expect(mu.rep_ranges[o]).toHaveLength(2);
      if (mu.load_mode === '1rm') {
        expect(mu.rm_reference).toBeTruthy();
        expect(mu.rm_factor).toBeGreaterThan(0);
      } else {
        expect(mu.rm_reference).toBeNull();
      }
    }
  });

  it('chaque exercice porte priority 1-5 et un movement_group du référentiel', () => {
    for (const m of muscuRows) {
      expect(Number.isInteger(m.muscu!.priority)).toBe(true);
      expect(m.muscu!.priority).toBeGreaterThanOrEqual(1);
      expect(m.muscu!.priority).toBeLessThanOrEqual(5);
      expect(MOVEMENT_GROUPS).toContain(m.muscu!.movement_group);
    }
    expect(CATALOG_SNAPSHOT.movements.find((m) => m.id === 'yates_row')!.muscu!.muscle_primary).toBe('trapezes');
  });

  it('les familles machine / cable sont dans la migration et les 179 lignes dans le seed', () => {
    const sql = readFileSync(path.join(__dirname, '../../../supabase/migrations/20261214000000_movement_catalog_musculation.sql'), 'utf8');
    expect(sql).toMatch(/'machine','cable'/);
    expect(sql).toMatch(/Appliquée en prod : NON/);
    expect((sql.match(/^\s+\('/gm) ?? []).length).toBe(179);
    expect(sql).toMatch(/ON CONFLICT \(id\) DO UPDATE SET\n\s+discipline_muscu/);
    expect(sql).toMatch(/priority = EXCLUDED.priority/);
    expect(sql).toMatch(/movement_group = EXCLUDED.movement_group/);
    expect(sql).not.toMatch(/DO UPDATE SET[^;]*\bactive\b/);
    const metcon = readFileSync(path.join(__dirname, '../../../supabase/migrations/20261211000000_movement_catalog.sql'), 'utf8');
    expect((metcon.match(/^\s+\('/gm) ?? []).length).toBe(109);
  });
});

describe('squelettes musculation', () => {
  it('39 squelettes : 13 cibles × 3 objectifs, slots dans l’ordre main → secondary → isolation → core/calves', () => {
    expect(MUSCU_SKELETONS).toHaveLength(39);
    expect(MUSCU_TARGETS).toHaveLength(13);
    const ORDER = { main_compound: 0, secondary_compound: 1, isolation: 2, core: 3, calves: 3 };
    for (const sk of MUSCU_SKELETONS) {
      expect(sk.discipline).toBe('musculation');
      expect(sk.format).toBe('strength_session');
      expect(sk.slots.length).toBeGreaterThanOrEqual(3);
      const ranks = sk.slots.map((s) => ORDER[s.role]);
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
      for (const s of sk.slots) {
        const muscles = Array.isArray(s.muscle) ? s.muscle : [s.muscle];
        for (const mu of muscles) expect(muscuRows.some((m) => m.muscu!.muscle_primary === mu)).toBe(true);
        for (const id of s.ids ?? []) expect(muscuRows.some((m) => m.id === id)).toBe(true);
      }
    }
  });

  it('export / import : 39 lignes wod_skeletons, banque reconstruite identique, repli embarqué si aucune ligne musculation', () => {
    const rows = MUSCU_SKELETONS.map((sk) => muscuSkeletonToRow(sk, MUSCU_BANK_VERSION));
    expect(rows).toHaveLength(39);
    const metcon = BANK_V1.skeletons.map((sk) => skeletonToRow(sk, BANK_VERSION));
    const caps = BANK_V1.movement_caps.map((c) => movementCapToRow(c, BANK_VERSION));
    const bank = bankFromRows([...metcon, ...rows], caps);
    expect(bank.muscu_skeletons).toEqual(MUSCU_SKELETONS);
    expect(bank.skeletons).toHaveLength(BANK_V1.skeletons.length);
    expect(bankFromRows(metcon, caps).muscu_skeletons).toEqual(MUSCU_SKELETONS);
    const sql = readFileSync(path.join(__dirname, '../../../supabase/migrations/20261215000000_wod_skeletons_musculation.sql'), 'utf8');
    expect((sql.match(/^\s+\('[a-z_]+', 'musculation', 'strength_session'/gm) ?? []).length).toBe(39);
    expect(sql).toMatch(/Appliquée en prod : NON/);
  });
});

describe('generateMuscu — conformité (cible × objectif × durée × matériel × niveau × seeds)', () => {
  it(`jamais d’échec, durée ±10 % sauf relâchement tracé, règles §5 (${SEEDS} seeds)`, () => {
    let n = 0;
    const relax: Record<string, number> = {};
    for (const p of grid()) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const w = gen(p, seed);
        n++;
        const ex = w.blocks[0].exercises;
        expect(ex.length).toBeGreaterThanOrEqual(2);
        for (const r of w.generator.relaxations) relax[r] = (relax[r] ?? 0) + 1;
        const dev = Math.abs(w.estimate.seconds - p.budget_min * 60) / (p.budget_min * 60);
        if (!w.generator.relaxations.some((r) => r === 'budget_short' || r === 'budget_long')) expect(dev).toBeLessThanOrEqual(MUSCU_TOLERANCE + 1e-9);
        // jamais deux exercices consécutifs sur le même muscle principal
        for (let i = 1; i < ex.length; i++) expect(ex[i].muscle_primary).not.toBe(ex[i - 1].muscle_primary);
        // un seul exercice distinct
        expect(new Set(ex.map((e) => e.id)).size).toBe(ex.length);
        // plafond de séries par muscle
        const vol = new Map<Muscle, number>();
        for (const e of ex) vol.set(e.muscle_primary, (vol.get(e.muscle_primary) ?? 0) + e.sets);
        for (const v of vol.values()) expect(v).toBeLessThanOrEqual(VOLUME_CAP_SETS[p.objective]);
        // Force : un seul main_compound par muscle principal
        if (p.objective === 'force') {
          const mains = ex.filter((e) => e.role === 'main_compound').map((e) => e.muscle_primary);
          expect(new Set(mains).size).toBe(mains.length);
        }
        for (const e of ex) {
          const m = CATALOG_SNAPSHOT.movements.find((x) => x.id === e.id)!;
          const mu = m.muscu!;
          // matériel : poids > 0 pour l'équipement demandé
          expect(p.equipment === 'none' ? mu.weight_bodyweight : p.equipment === 'box' ? mu.weight_box : mu.weight_gym).toBeGreaterThan(0);
          // niveau
          expect(['debutant', 'inter', 'avance'].indexOf(mu.level_min)).toBeLessThanOrEqual(['debutant', 'inter', 'avance'].indexOf(p.level));
          if (p.level === 'debutant') {
            expect(mu.unilateral).toBe(false);
            expect(e.load.mode).not.toBe('weighted');
            expect(e.load.mode).not.toBe('1rm');
          }
          if (e.load.mode === 'weighted') {
            expect(p.objective).toBe('force');
            expect(WEIGHTED_IDS).toContain(e.id);
          }
          if (e.load.mode === 'rpe') expect([7, 8]).toContain(e.load.rpe);
          expect(e.sets).toBeGreaterThanOrEqual(2);
          expect(e.reps).toBeGreaterThan(0);
        }
        if (p.level === 'debutant') expect(ex.length).toBeLessThanOrEqual(p.budget_min >= BEGINNER_LONG_BUDGET_MIN ? BEGINNER_MAX_EXERCISES_LONG : BEGINNER_MAX_EXERCISES);
        expect(w.generator.relaxations).not.toContain('rest_extended');
        expect(w.signature).toBe(muscuSignature(w.generator.skeleton_id, ex));
        expect(w.description).toContain(ex[0].name);
      }
    }
    expect(n).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`muscu conformité : ${n} séances, relâchements`, relax);
    // séance annoncée trop longue : < 1 % des tirages, et seulement après exercice → série → tempo → reps → repos + 15 s
    expect((relax.budget_short ?? 0) / n).toBeLessThan(0.01);
  });

  it(`compteurs M1–M10 à zéro sur la grille (${Math.min(SEEDS, 40)} seeds)`, () => {
    const all: string[] = [];
    let n = 0;
    for (const p of muscuConformityGrid()) for (let seed = 1; seed <= Math.min(SEEDS, 40); seed++) {
      const w = gen(p, seed);
      n++;
      for (const v of muscuViolations(w, p)) all.push(`${v} ← ${p.target}/${p.objective}/${p.equipment}/${p.level}/${p.budget_min}#${seed}`);
    }
    const counts = countMuscuByCause(all);
    // eslint-disable-next-line no-console
    console.log(`muscu M1–M10 : ${n} séances`, counts, all.filter((l) => !l.startsWith('[M7]')).slice(0, 40), all.filter((l) => l.startsWith('[M7]')).slice(0, 10));
    for (const c of MUSCU_CAUSES) expect(counts[c]).toBe(0);
  });

  it('rattrapage de budget : séries ≤ 5 en hypertrophie / endurance, tempo 3-1-1 rendu, variantes faciles sans matériel présentes', () => {
    const easy = ['incline_push_up', 'wall_push_up', 'glute_bridge', 'bird_dog', 'bodyweight_reverse_lunge', 'squat_hold'];
    for (const id of easy) {
      const m = CATALOG_SNAPSHOT.movements.find((x) => x.id === id)!;
      expect(m.muscu!.weight_bodyweight).toBeGreaterThan(0);
      expect(m.muscu!.level_min).toBe('debutant');
    }
    let tempo = 0;
    for (const target of MUSCU_TARGETS) for (let seed = 1; seed <= 20; seed++) {
      if (!targetAvailable(CATALOG_SNAPSHOT, target, 'none', 'debutant')) continue;
      const w = gen({ ...base, target, objective: 'hypertrophie', equipment: 'none', level: 'debutant', budget_min: target === 'tronc' ? 30 : 60 }, seed);
      for (const e of w.blocks[0].exercises) expect(e.sets).toBeLessThanOrEqual(5);
      if (w.generator.relaxations.includes('tempo_311')) {
        tempo++;
        expect(w.blocks[0].exercises.some((e) => e.notes.includes('tempo 3-1-1'))).toBe(true);
      }
    }
    expect(tempo).toBeGreaterThan(0);
  });

  it('bonus (M2) : au plus un exercice de tronc hors cible Tronc ; jamais Mountain Climbers / Vacuum / Russian Twist en Prise de muscle / Force ; isolation d’un muscle secondaire avant le gainage', () => {
    const tronc = TARGET_MUSCLES.tronc as string[];
    let secondaryIso = 0;
    for (const p of grid()) {
      if (p.target === 'tronc') continue;
      for (let seed = 1; seed <= 10; seed++) {
        const w = gen(p, seed);
        const ex = w.blocks[0].exercises;
        const core = ex.filter((e) => tronc.includes(e.muscle_primary));
        expect({ p, core: core.map((e) => e.name) }).toMatchObject({ core: expect.any(Array) });
        expect(core.length).toBeLessThanOrEqual(CORE_MAX_OUTSIDE_TRONC);
        if (p.objective !== 'endurance') for (const e of ex) expect(BONUS_EXCLUDED_IDS).not.toContain(e.id);
        // un bonus hors muscles de la cible est une isolation (jamais un compound d'un autre muscle) ou le seul gainage
        for (const e of ex.filter((x) => x.optional && !(TARGET_MUSCLES[p.target] as string[]).includes(x.muscle_primary))) {
          const m = CATALOG_SNAPSHOT.movements.find((x) => x.id === e.id)!.muscu!;
          if (tronc.includes(e.muscle_primary)) continue;
          expect({ p, e: e.name, compound: m.compound }).toMatchObject({ compound: false });
          secondaryIso++;
        }
      }
    }
    expect(secondaryIso).toBeGreaterThan(0);
    // #124 Épaules Prise de muscle (box, inter, 45') : plus de Russian Twist + Mountain Climbers ; #157 Pecs Force : pas de Vacuum ; #148 Bras : pas de Vacuum
    for (let seed = 1; seed <= 40; seed++) {
      for (const p of [{ target: 'epaules', objective: 'hypertrophie' }, { target: 'pecs', objective: 'force' }, { target: 'bras', objective: 'hypertrophie' }] as const) {
        const ex = gen({ ...base, ...p, equipment: 'box', level: 'inter', budget_min: 45 }, seed).blocks[0].exercises;
        expect(ex.map((e) => e.id)).not.toEqual(expect.arrayContaining(['russian_twist']));
        expect(ex.map((e) => e.id)).not.toEqual(expect.arrayContaining(['vacuum']));
        expect(ex.map((e) => e.id)).not.toEqual(expect.arrayContaining(['mountain_climber']));
      }
    }
  });

  it('durées proposées : celles que le catalogue remplit ; Pecs sans matériel n’offre pas 45 ni 60, Push salle offre tout', () => {
    expect(availableDurations(CATALOG_SNAPSHOT, BANK_V1, { entry: 'express', target: 'push', objective: 'hypertrophie', equipment: 'gym', level: 'inter' })).toEqual([...MUSCU_DURATIONS.express]);
    const pecsNone = availableDurations(CATALOG_SNAPSHOT, BANK_V1, { entry: 'express', target: 'pecs', objective: 'hypertrophie', equipment: 'none', level: 'inter' });
    expect(pecsNone).toEqual([20, 30]);
    expect(availableDurations(CATALOG_SNAPSHOT, BANK_V1, { entry: 'express', target: 'tronc', objective: 'hypertrophie', equipment: 'box', level: 'inter' })).toEqual([...MUSCU_DURATIONS.tronc]);
    expect(availableDurations(CATALOG_SNAPSHOT, BANK_V1, { entry: 'after_class', target: 'haut', objective: 'endurance', equipment: 'box', level: 'inter', after_class: { day_movements: [] } })).toEqual([...MUSCU_DURATIONS.after_class]);
  });

  it('plafond hebdo (weekly_room) : un muscle plein sort du pool, la séance garde sa durée avec les autres muscles de la cible', () => {
    const p: MuscuParams = { ...base, target: 'jambes', objective: 'hypertrophie', equipment: 'box', level: 'inter', budget_min: 45, box_wod: true, weekly_room: { quadriceps: 0 } };
    for (let seed = 1; seed <= 20; seed++) {
      const w = gen(p, seed);
      expect(w.blocks[0].exercises.some((e) => e.muscle_primary === 'quadriceps')).toBe(false);
      expect(w.generator.relaxations).toContain('weekly_cap');
      expect(w.generator.relaxations).not.toContain('budget_short');
      expect(Math.abs(w.estimate.seconds - 45 * 60) / (45 * 60)).toBeLessThanOrEqual(MUSCU_TOLERANCE + 1e-9);
    }
  });

  it('déterministe, et anti-répétition sur les 10 dernières signatures', () => {
    expect(gen(base, 5)).toEqual(gen(base, 5));
    const recent: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const w = gen({ ...base, recent_signatures: recent.slice(-10) }, seed);
      if (!w.generator.relaxations.includes('repeat')) expect(recent.slice(-10)).not.toContain(w.signature);
      recent.push(w.signature);
    }
  });

  it('cible indisponible (sans matériel : pull, dos), Force sans matériel / Après ma classe / Tronc, durée Tronc hors 15-20-30 → erreur explicite', () => {
    expect(() => gen({ ...base, equipment: 'none', target: 'pull' }, 1)).toThrow(InvalidMuscuParams);
    expect(() => gen({ ...base, target: 'tronc', objective: 'force', budget_min: 20 }, 1)).toThrow(/Tronc/);
    expect(() => gen({ ...base, target: 'tronc', budget_min: 45 }, 1)).toThrow(/15, 20 ou 30/);
    expect(gen({ ...base, target: 'tronc', budget_min: 30 }, 1).blocks[0].exercises.length).toBeGreaterThanOrEqual(2);
    expect(() => gen({ ...base, equipment: 'none', objective: 'force', target: 'push' }, 1)).toThrow(/Force/);
    expect(() => gen({ ...base, entry: 'after_class', objective: 'force', after_class: { day_movements: [] } }, 1)).toThrow(/Force/);
    expect(availableTargets(CATALOG_SNAPSHOT, 'gym', 'debutant')).toEqual(MUSCU_TARGETS);
    expect(availableTargets(CATALOG_SNAPSHOT, 'none', 'avance')).not.toContain('pull');
  });
});

describe('charges', () => {
  const P: MuscuParams = { ...base, target: 'pecs', objective: 'force', level: 'avance', budget_min: 45 };

  it('1RM connu : kg = 1RM × facteur × %, arrondi à 2,5 kg', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = gen({ ...P, one_rep_max: { bench: 100, press: 60 } }, seed);
      for (const e of w.blocks[0].exercises) {
        const mu = CATALOG_SNAPSHOT.movements.find((m) => m.id === e.id)!.muscu!;
        if (mu.load_mode !== '1rm') continue;
        if (mu.rm_reference === 'bench' || mu.rm_reference === 'press') {
          expect(e.load.mode).toBe('1rm');
          const rm = mu.rm_reference === 'bench' ? 100 : 60;
          expect(e.load.kg).toBeCloseTo(Math.round((rm * (mu.rm_factor ?? 1) * (e.load.percent! / 100)) / 2.5) * 2.5, 5);
          expect(e.load.kg! % 2.5).toBe(0);
          expect(e.load.percent).toBe(percentForReps(e.reps));
          if (e.role === 'main_compound') expect(e.load.percent).toBeGreaterThanOrEqual(80);
          expect(exerciseLine(e)).toMatch(/@ \d+(\.5)? kg — charge \d+ % 1RM/);
        } else {
          expect(e.load.mode).toBe('rpe');
        }
      }
    }
  });

  it('1RM inconnu : RPE (7 endurance, 8 hypertrophie / force) rendu « RPE 8 (≈ 72 % du 1RM) » ; débutant jamais en 1RM', () => {
    const hyp = gen({ ...base, one_rep_max: null }, 3);
    for (const e of hyp.blocks[0].exercises) if (e.load.mode === 'rpe') {
      expect(e.load.rpe).toBe(8);
      if (e.load.rm_reference) expect(exerciseLine(e)).toMatch(/RPE 8 \(≈ \d+ % du 1RM\)/);
    }
    expect(hyp.description).not.toMatch(/sans 1RM connu|%1RM/);
    const end = gen({ ...base, objective: 'endurance', one_rep_max: null }, 3);
    for (const e of end.blocks[0].exercises) if (e.load.mode === 'rpe') expect(e.load.rpe).toBe(7);
    const deb = gen({ ...P, level: 'debutant', one_rep_max: { bench: 100 } }, 3);
    for (const e of deb.blocks[0].exercises) expect(e.load.mode).not.toBe('1rm');
  });

  it('lest : 10 % du poids de corps arrondi à 2,5 kg quand bodyweight_kg est fourni, sinon « lesté léger »', () => {
    const cases: Array<[number, number]> = [[82, 7.5], [77, 7.5], [90, 10], [100, 10], [60, 5], [68.9, 7.5], [71.3, 7.5]];
    let seen = 0;
    for (const [bw, kg] of cases) for (let seed = 1; seed <= 30; seed++) {
      const w = gen({ ...base, target: 'pull', objective: 'force', level: 'avance', equipment: 'box', bodyweight_kg: bw }, seed);
      for (const e of w.blocks[0].exercises) if (e.load.mode === 'weighted') {
        seen++;
        expect(e.load.kg).toBe(kg);
        expect(exerciseLine(e)).toContain(`lesté ${kg} kg (10 % du poids de corps)`);
      }
    }
    expect(seen).toBeGreaterThan(0);
    let light = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const w = gen({ ...base, target: 'pull', objective: 'force', level: 'avance', equipment: 'box' }, seed);
      for (const e of w.blocks[0].exercises) if (e.load.mode === 'weighted') {
        light++;
        expect(e.load.kg).toBeUndefined();
        expect(exerciseLine(e)).toContain('lesté léger');
      }
    }
    expect(light).toBeGreaterThan(0);
  });

  it('poids du corps : dips / tractions lestés en Force intermédiaire +, jamais en débutant ni hors Force', () => {
    let weighted = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const w = gen({ ...base, target: 'pull', objective: 'force', level: 'avance', equipment: 'box' }, seed);
      for (const e of w.blocks[0].exercises) if (e.load.mode === 'weighted') { weighted++; expect(WEIGHTED_IDS).toContain(e.id); }
    }
    expect(weighted).toBeGreaterThan(0);
    for (let seed = 1; seed <= 20; seed++) {
      for (const e of gen({ ...base, target: 'pull', objective: 'hypertrophie', equipment: 'box' }, seed).blocks[0].exercises) expect(e.load.mode).not.toBe('weighted');
    }
  });
});

describe('Après ma classe', () => {
  const day = { day_movements: ['Back Squat', 'Thruster'] };

  it('Back Squat + Thrusters : quadriceps / fessiers / épaules exclus, cible suggérée Tronc', () => {
    const ac = afterClassMuscles(CATALOG_SNAPSHOT, day);
    expect(ac.excluded).toEqual(expect.arrayContaining(['quadriceps', 'fessiers', 'epaules']));
    expect(ac.suggested_target).toBe('tronc');
    for (const budget_min of MUSCU_DURATIONS.after_class) for (const objective of ['hypertrophie', 'endurance'] as const) for (let seed = 1; seed <= 20; seed++) {
      const w = gen({ ...base, entry: 'after_class', target: 'tronc', objective, budget_min, after_class: day }, seed);
      expect(w.after_class?.suggested_target).toBe('tronc');
      for (const e of w.blocks[0].exercises) expect(ac.excluded).not.toContain(e.muscle_primary);
    }
  });

  it('WOD haut du corps : cible suggérée Bas ; WOD sans pattern reconnu : Haut', () => {
    expect(afterClassMuscles(CATALOG_SNAPSHOT, { day_movements: ['Pull-ups', 'Push-ups', 'Strict Press'] }).suggested_target).toBe('bas');
    expect(afterClassMuscles(CATALOG_SNAPSHOT, { day_movements: ['Double-Unders', 'Run 400 m'] }).suggested_target).toBe('haut');
  });

  it('une cible qui chevauche les muscles du jour reste générable sur les muscles libres, exclusion tracée', () => {
    const w = gen({ ...base, entry: 'after_class', target: 'bas', objective: 'hypertrophie', budget_min: 20, after_class: day }, 1);
    for (const e of w.blocks[0].exercises) expect(['quadriceps', 'fessiers']).not.toContain(e.muscle_primary);
    expect(w.after_class?.excluded_muscles).toContain('quadriceps');
  });
});

describe('exclusions', () => {
  it('matériel exclu (barbell) → remplacé, jamais conservé', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = gen({ ...base, target: 'bas', objective: 'force', exclude: ['barbell', 'rack'] }, seed);
      for (const e of w.blocks[0].exercises) {
        const m = CATALOG_SNAPSHOT.movements.find((x) => x.id === e.id)!;
        expect(m.equipment).not.toContain('barbell');
        expect(m.equipment).not.toContain('rack');
      }
      expect(w.blocks[0].exercises.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('exercice exclu par nom ou id', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const ids = gen({ ...base, target: 'pecs', exclude: ['Bench Press', 'dips'] }, seed).blocks[0].exercises.map((e) => e.id);
      expect(ids).not.toContain('bench_press');
      expect(ids).not.toContain('dips');
    }
  });
});

describe('rendu texte (grammaire strength)', () => {
  it('chaque ligne d’exercice est reconnue et relue par parseStrengthLine (nom, séries, reps, unité, côté, kg)', () => {
    for (const p of [base, { ...base, objective: 'endurance' as const, target: 'tronc' as const, budget_min: 30 }, { ...base, target: 'jambes' as const, level: 'avance' as const, one_rep_max: { back_squat: 120, deadlift: 160 } }]) {
      for (let seed = 1; seed <= 10; seed++) {
        const w = gen(p, seed);
        for (const e of w.blocks[0].exercises) {
          const line = exerciseLine(e);
          expect(isStrengthLine(line)).toBe(true);
          const parsed = parseStrengthLine(line)!;
          expect(parsed.name).toBe(e.name);
          expect(parsed.sets).toBe(e.sets);
          expect(parsed.reps).toBe(e.reps);
          if (e.reps_unit !== 'reps') expect(parsed.repsUnit).toBe(e.reps_unit);
          if (e.per_side) expect(parsed.perSide).toBeTruthy();
          if (e.load.mode === '1rm') { expect(parsed.load).toBe(e.load.kg); expect(parsed.unit).toBe('kg'); }
          expect(parsed.restSec).toBe(e.rest_s);
        }
        expect(renderMuscu(w)).toBe(w.description);
        expect(w.description.split('\n')[0]).toMatch(/^Musculation · /);
        expect(w.description).not.toMatch(/Hypertrophie|Endurance musculaire/);
        expect(w.description).toMatch(/Prise de muscle|Force|Tonification/);
        expect(w.description).toContain(`Durée estimée ${w.estimate.minutes}'`);
      }
    }
  });

  it('les exercices unilatéraux et en secondes / mètres sont rendus « / jambe », « s », « m »', () => {
    let sides = 0; let units = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = gen({ ...base, target: 'tronc', objective: 'endurance', level: 'avance', budget_min: 30 }, seed);
      for (const e of w.blocks[0].exercises) {
        if (e.per_side) { sides++; expect(exerciseLine(e)).toMatch(/ \/ (jambe|bras|côté)/); }
        if (e.reps_unit === 's') { units++; expect(exerciseLine(e)).toMatch(/× \d+ s/); }
        if (e.reps_unit === 'm') { units++; expect(exerciseLine(e)).toMatch(/× \d+ m/); }
      }
    }
    expect(sides).toBeGreaterThan(0);
    expect(units).toBeGreaterThan(0);
  });
});

describe('cibles et muscles', () => {
  it('chaque exercice tiré appartient aux muscles de la cible (ou à un slot core / mollets)', () => {
    for (const target of MUSCU_TARGETS) for (let seed = 1; seed <= 10; seed++) {
      const w = gen({ ...base, target, objective: 'hypertrophie', level: 'avance', budget_min: target === 'tronc' ? 30 : 45 }, seed);
      for (const e of w.blocks[0].exercises) {
        const m = CATALOG_SNAPSHOT.movements.find((x) => x.id === e.id)!;
        const inTarget = TARGET_MUSCLES[target].includes(e.muscle_primary);
        // rattrapage de budget : un exercice optionnel peut viser la cible par un muscle secondaire
        // ou, en bonus, une isolation d'un muscle secondaire de la cible (muscle secondaire d'un exercice de la séance ou du pool de la cible)
        const secondaryOfTarget = new Set(
          CATALOG_SNAPSHOT.movements
            .filter((x) => x.muscu && TARGET_MUSCLES[target].includes(x.muscu.muscle_primary))
            .flatMap((x) => x.muscu!.muscle_secondary as Muscle[]),
        );
        const viaSecondary = e.optional && (
          (m.muscu!.muscle_secondary as Muscle[]).some((mu) => TARGET_MUSCLES[target].includes(mu))
          || (!m.muscu!.compound && secondaryOfTarget.has(e.muscle_primary))
        );
        expect({ target, e: e.name, ok: inTarget || viaSecondary || e.role === 'core' || e.role === 'calves' }).toMatchObject({ ok: true });
      }
    }
  });
});
