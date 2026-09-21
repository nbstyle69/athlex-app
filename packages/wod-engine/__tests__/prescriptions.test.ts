import {
  BANK_V1, CATALOG_SNAPSHOT, generateBlocC, movementById,
} from '../src';
import type { Family, GenerateRequest, Skeleton, Unit } from '../src';
import { roundCalculatedQuantity } from '../src/quantities';
import { movementSeconds, fixedWorkSeconds } from '../src/estimate';

const request: GenerateRequest = { entry: 'express', discipline: 'functional', intention: 'mixed', gym_records: {} };
const only = (sk: Skeleton) => ({ ...BANK_V1, skeletons: [sk] });
const gen = (sk: Skeleton, seed = 1, params = request) => generateBlocC(params, CATALOG_SNAPSHOT, only(sk), seed);
const skeleton = (id: string) => BANK_V1.skeletons.find((sk) => sk.id === id)!;
const usual = [8, 10, 12, 15, 16, 18, 20, 25, 30];

describe('R1/R4 — durée des prescriptions', () => {
  it('EMOM, E2MOM et E3MOM font des passages complets, dont cinq stations à 10/15/20 minutes', () => {
    for (const id of ['emom_alternating', 'gym_density', 'emom_hybrid']) {
      const sk = skeleton(id);
      for (const variant of sk.variants ?? [null]) for (let seed = 1; seed <= 20; seed++) {
        const wod = gen({ ...sk, variants: variant ? [variant] : undefined }, seed, {
          ...request, discipline: sk.discipline, intention: sk.intentions[0],
        });
        const b = wod.blocks[0];
        expect(b.rounds! * b.movements.length * b.rest!.every_s!).toBe(wod.budget_min * 60);
        expect(b.rounds).toBeGreaterThanOrEqual(2);
        if (variant?.id === 'EMOM-five') expect([10, 15, 20]).toContain(wod.budget_min);
      }
    }
  });

  it('les tirages et les réajustements des formats non EMOM restent sur les durées usuelles', () => {
    for (const discipline of ['functional', 'hybrid'] as const) for (let seed = 1; seed <= 100; seed++) {
      const wod = generateBlocC({ ...request, discipline, intention: discipline === 'functional' ? 'mixed' : 'engine' }, CATALOG_SNAPSHOT, BANK_V1, seed);
      if (wod.format !== 'emom') expect(usual).toContain(wod.budget_min);
      if (wod.blocks[0].timecap) {
        expect(wod.blocks[0].timecap % 60).toBe(0);
        expect(wod.time_cap_seconds).toBe(wod.blocks[0].timecap);
      }
    }
  });

  it.each([10, 15, 20])('la densité gym à %s minutes reste servable après la classe, avec des cycles complets', (budget_min) => {
    for (let seed = 1; seed <= 20; seed++) {
      const wod = gen(skeleton('gym_density'), seed, {
        ...request, entry: 'after_class', intention: 'gym', budget_min,
        after_class: { day_movements: ['Back Squat', 'Thrusters'] },
      });
      const b = wod.blocks[0];
      expect(wod.budget_min).toBe(budget_min);
      expect(b.rounds! * b.movements.length * b.rest!.every_s!).toBe(budget_min * 60);
    }
  });
});

describe('R2 — quantités calculées avant contrôles, prescriptions exactes', () => {
  it.each<[number, Unit, Family, number]>([
    [31, 'reps', 'box', 30], [38, 'reps', 'kettlebell', 40], [37, 'reps', 'kettlebell', 35],
    [9, 'reps', 'gym', 9], [3, 'reps', 'gym', 3], [18, 'cal', 'erg', 20], [19, 'cal', 'erg', 20],
    [35, 'm', 'sled', 25], [62, 'm', 'carry', 50], [751, 'm', 'run', 800],
  ])('%s %s (%s) devient %s', (q, unit, family, expected) => {
    expect(roundCalculatedQuantity(q, unit, family)).toBe(expected);
  });

  it('ne remonte pas au-dessus d’un plafond et n’arrondit pas les petites séries à 5', () => {
    expect(roundCalculatedQuantity(19, 'reps', 'gym', 'down')).toBe(15);
    expect(roundCalculatedQuantity(24, 'cal', 'erg', 'down')).toBe(20);
    for (let q = 1; q < 10; q++) expect(roundCalculatedQuantity(q, 'reps', 'gym')).toBe(q);
  });

  it('athlète et box reçoivent les mêmes quantités, estimations et caps', () => {
    for (const id of ['stations_rotation', 'chipper_stations_erg', 'couplet_amrap_short']) {
      for (let seed = 1; seed <= 25; seed++) {
        const athlete = gen(skeleton(id), seed);
        const box = gen(skeleton(id), seed, { ...request, round_qty: true });
        expect(box).toEqual(athlete);
        for (const m of box.blocks[0].movements) {
          const family = movementById(CATALOG_SNAPSHOT, m.id)!.family;
          if (m.unit === 'reps' && m.qty >= 10 || m.unit === 'cal') expect(m.qty % 5).toBe(0);
          if (m.unit === 'm' && ['sled', 'carry'].includes(family)) expect(m.qty % 25).toBe(0);
          if (m.unit === 'm' && family === 'run') expect(m.qty % 100).toBe(0);
          if (box.format === 'stations') expect(movementSeconds(m, 'rx')).toBeLessThanOrEqual(box.blocks[0].rest!.work_s!);
        }
      }
    }
  });

  it('la plage des stations lourdes Force porte les 3–5 reps avant les contrôles', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const wod = gen(skeleton('stations_rotation'), seed, {
        ...request, intention: 'force', budget_min: 30,
      });
      const loaded = wod.blocks[0].movements.filter((m) => m.unit === 'reps' && m.load_band === 'heavy');
      expect(loaded.length).toBeGreaterThan(0);
      for (const m of loaded) {
        expect(m.qty).toBeGreaterThanOrEqual(3);
        expect(m.qty).toBeLessThanOrEqual(5);
      }
    }
  });

  it('les schémas nommés gardent chaque palier en box comme chez l’athlète', () => {
    for (const id of ['couplet_for_time_21_15_9', 'triplet_for_time_classics', 'ladder_finite']) {
      const sk = skeleton(id);
      for (const variant of sk.variants!) {
        const wod = gen({ ...sk, variants: [variant] }, 2, { ...request, round_qty: true });
        expect(wod.blocks[0].scheme).toEqual(variant.scheme);
        for (const m of wod.blocks[0].movements) expect(m.scheme).toEqual(variant.scheme);
      }
    }
  });

  it('la banque distingue les tirages calculés des distances fixes et des schémas nommés', () => {
    for (const sk of BANK_V1.skeletons) for (const slot of [...sk.slots, ...(sk.variants ?? []).flatMap((v) => v.slots)]) {
      if (slot.fixed_range) expect(slot.qty).toBe('draw');
      if (slot.fixed !== undefined || slot.fixed_by_id) expect(slot.qty).toBe('fixed');
    }
    for (const variant of skeleton('sled_repeats').variants!) {
      const wod = gen({ ...skeleton('sled_repeats'), variants: [variant] }, 1, {
        ...request, discipline: 'hybrid', intention: 'interval', round_qty: true,
      });
      expect(wod.blocks[0].movements[0].qty).toBe(variant.id === '15m-every3' ? 15 : 25);
    }
  });

  it('reporte les secondes arrondies à 60 sur la minute suivante dans les cibles rendues', () => {
    const sk = skeleton('sled_repeats');
    const wod = gen({ ...sk, variants: sk.variants!.filter((v) => v.id === '15m-every3') }, 1, {
      ...request, discipline: 'hybrid', intention: 'interval',
    });
    expect(wod.estimate.by_category.men!.target).toContain('2:00');
    expect(wod.description).not.toMatch(/\d:60/);
  });
});

describe('R3 — sled enchaîné et cadence lourde', () => {
  const sled: Skeleton = {
    ...skeleton('chipper_stations_erg'), id: 'sled_prescription', duration_range: [8, 20], durations: [12, 20],
    intentions: ['mixed'], band_by_intention: { mixed: 'heavy' }, variants: undefined,
    rounds: { min: 1, max: 4 },
    slots: [
      { pick: { ids: ['sled_push', 'sled_pull'], unit: 'm' }, qty: 'range', reps_range: [25, 100] },
      { pick: { ids: ['run'], unit: 'm' }, qty: 'range', reps_range: [200, 1200] },
    ],
  };

  it.each(['chipper', 'amrap', 'for_time', 'rounds_for_time'] as const)('%s plafonne chaque passage à 50 m', (format) => {
    for (let seed = 1; seed <= 20; seed++) {
      const wod = gen({ ...sled, format }, seed);
      expect(wod.blocks[0].movements[0].qty).toBeLessThanOrEqual(50);
      expect(wod.blocks[0].movements[0].qty % 25).toBe(0);
    }
  });

  it('autorise 100 m avec repos et applique le facteur heavy 1,5 au sled généré', () => {
    const wod = gen({
      ...sled, format: 'interval', duration_range: [20, 20], rounds: { min: 2, max: 2 },
      rest: { every_s: 600 }, max_work_fraction: 0.7,
      slots: [
        { pick: { ids: ['sled_push'], unit: 'm' }, qty: 'fixed', fixed: 100 },
        { pick: { ids: ['run'], unit: 'm' }, qty: 'fixed', fixed: 200 },
      ],
    });
    const b = wod.blocks[0];
    const m = b.movements[0];
    expect(m.qty).toBe(100);
    expect(m.load_band).toBe('heavy');
    expect(movementSeconds(m, 'rx')).toBeCloseTo(100 * m.cadence_by_category.rx! * 1.5);
    const lighter = { ...b, movements: b.movements.map((m) => ({ ...m, load_band: 'light' as const })) };
    expect(fixedWorkSeconds(b, 'rx')).toBeGreaterThan(fixedWorkSeconds(lighter, 'rx'));
  });
});

describe('R5 — compositions Hybrid', () => {
  const track = ['sled_push', 'sled_pull', 'sandbag_lunge', 'sandbag_carry', 'kb_swing_russian', 'wall_ball', 'db_farmer_carry'];
  it('sert chaque intention et chaque départ, sans haltéro technique ni gym avancée', () => {
    const sk = skeleton('emom_hybrid');
    for (const intention of sk.intentions) for (let seed = 1; seed <= 50; seed++) {
      const wod = gen(sk, seed, { ...request, discipline: 'hybrid', intention });
      const [erg, run, load] = wod.blocks[0].movements;
      expect(movementById(CATALOG_SNAPSHOT, erg.id)!.family).toBe('erg');
      expect(run.id).toBe('run');
      expect(track).toContain(load.id);
      expect(wod.budget_min).toBeGreaterThanOrEqual(12);
      expect(wod.budget_min).toBeLessThanOrEqual(20);
    }
  });

  it('encadre quatre ou cinq stations par deux courses de 800–1000 m, avec sled ≤50 m', () => {
    const sk = skeleton('chipper_hybrid');
    const lengths = new Set<number>();
    let sleds = 0;
    for (const intention of sk.intentions) for (let seed = 1; seed <= 50; seed++) {
      const wod = gen(sk, seed, { ...request, discipline: 'hybrid', intention });
      const ms = wod.blocks[0].movements;
      lengths.add(ms.length);
      for (const run of [ms[0], ms.at(-1)!]) {
        expect(run.id).toBe('run');
        expect([800, 900, 1000]).toContain(run.qty);
      }
      for (const m of ms.slice(1, -1)) {
        const family = movementById(CATALOG_SNAPSHOT, m.id)!.family;
        if (family === 'erg') expect(m.unit).toBe('cal');
        else expect(track.filter((id) => id !== 'kb_swing_russian')).toContain(m.id);
        if (family === 'sled') { sleds++; expect(m.qty).toBeLessThanOrEqual(50); }
      }
      expect(wod.budget_min).toBeGreaterThanOrEqual(18);
      expect(wod.budget_min).toBeLessThanOrEqual(30);
    }
    expect(lengths).toEqual(new Set([6, 7]));
    expect(sleds).toBeGreaterThan(0);
  });
});
