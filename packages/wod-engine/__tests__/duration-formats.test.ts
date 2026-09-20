import {
  BANK_V1, CATALOG_SNAPSHOT, FORMAT_CHOICE_COVERS, generateBlocC, generateMuscu, NoValidWod, roundSeconds, movementById,
} from '../src';
import type { GenerateRequest, SkeletonBank } from '../src';

const functional: GenerateRequest = { entry: 'express', discipline: 'functional', intention: 'mixed', format: 'surprise' };
const gen = (request: GenerateRequest, seed: number, bank = BANK_V1) => generateBlocC(request, CATALOG_SNAPSHOT, bank, seed);

describe('durées et familles choisies par le moteur', () => {
  it('chaque variante Functional demandée sort seule, avec sa plage et 2 à 5 mouvements rendus', () => {
    const ids = ['couplet_for_time_21_15_9', 'triplet_for_time_classics', 'chipper_descending', 'ladder_finite', 'emom_alternating'];
    for (const sk of BANK_V1.skeletons.filter((sk) => ids.includes(sk.id))) {
      for (const variant of sk.variants ?? []) {
        const bank = { ...BANK_V1, skeletons: [{ ...sk, variants: [variant] }] };
        const outputs = [];
        for (let seed = 1; seed <= 40; seed++) {
          try { outputs.push(gen(functional, seed, bank)); } catch (error) {
            if (!(error instanceof NoValidWod)) throw error;
          }
        }
        expect({ variant: `${sk.id}:${variant.id}`, served: outputs.length > 0 }).toEqual({ variant: `${sk.id}:${variant.id}`, served: true });
        for (const wod of outputs) {
          const [min, max] = variant.duration_range ?? sk.duration_range;
          expect(wod.budget_min).toBeGreaterThanOrEqual(min);
          expect(wod.budget_min).toBeLessThanOrEqual(max);
          expect(wod.blocks[0].movements.length).toBeGreaterThanOrEqual(2);
          expect(wod.blocks[0].movements.length).toBeLessThanOrEqual(5);
          if (sk.id === 'chipper_descending') expect(wod.blocks[0].movements.map((m) => m.qty)).toEqual(variant.scheme);
          if (sk.id === 'ladder_finite') {
            expect(wod.blocks[0].ladder).toBeUndefined();
            expect(wod.wod_type).toBe('for-time');
            expect(wod.blocks[0].scheme).toEqual(variant.scheme);
          }
          if (sk.format === 'emom') expect(wod.blocks[0].rest?.every_s).toBe(variant.rest?.every_s ?? 60);
        }
      }
    }
  });

  it('un échec de composition ne change ni famille, ni sous-format', () => {
    const bank: SkeletonBank = {
      ...BANK_V1,
      skeletons: BANK_V1.skeletons.filter((sk) => FORMAT_CHOICE_COVERS.emom.includes(sk.format)).map((sk) => sk.format === 'death_by'
        ? { ...sk, slots: [{ pick: { ids: ['introuvable'] }, qty: 'minute' }] }
        : sk),
    };
    let rejected = 0;
    let served = 0;
    for (let seed = 1; seed <= 40; seed++) {
      try {
        expect(gen({ ...functional, format: 'emom' }, seed, bank).format).toBe('emom');
        served++;
      } catch (error) {
        if (!(error instanceof NoValidWod)) throw error;
        expect(Object.keys(error.reasons).every((reason) => reason.startsWith('death_by:'))).toBe(true);
        rejected++;
      }
    }
    expect(rejected).toBeGreaterThan(0);
    expect(served).toBeGreaterThan(0);
  });

  it('Après ma classe reste à 15–20, filtre les familles impossibles avant le tirage', () => {
    for (const discipline of ['functional', 'hybrid'] as const) {
      for (const day_movements of [['Back Squat', 'Thrusters'], ['Row', 'Wall Balls', 'Burpees Over the Bar']]) {
        for (let seed = 1; seed <= 50; seed++) {
          const wod = gen({
            entry: 'after_class', discipline, intention: discipline === 'functional' ? 'mixed' : 'engine',
            after_class: { day_movements }, gym_records: {},
          }, seed);
          expect(wod.budget_min).toBeGreaterThanOrEqual(15);
          expect(wod.budget_min).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it('Musculation prend 45 minutes en séance et 15–20 après classe, sans durée en entrée', () => {
    for (const target of ['push', 'tronc'] as const) for (const entry of ['express', 'after_class'] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        const wod = generateMuscu({ entry, target, objective: 'hypertrophie', equipment: 'gym', level: 'inter' }, CATALOG_SNAPSHOT, BANK_V1, seed);
        expect(wod.budget_min).toBeGreaterThanOrEqual(entry === 'express' ? 45 : 15);
        expect(wod.budget_min).toBeLessThanOrEqual(entry === 'express' ? 45 : 20);
      }
    }
  });

  it('Hybrid : les deux départs sled gardent au moins 30 % de repos ; course/erg alternent', () => {
    for (const id of ['sled_repeats', 'engine_negative_split', 'run_intervals']) {
      const sk = BANK_V1.skeletons.find((sk) => sk.id === id)!;
      for (const variant of sk.variants ?? [null]) {
        const bank = { ...BANK_V1, skeletons: [{ ...sk, variants: variant ? [variant] : undefined }] };
        const request: GenerateRequest = { discipline: 'hybrid', entry: 'express', intention: id === 'sled_repeats' ? 'interval' : id === 'run_intervals' ? 'run' : 'aerobic' };
        for (let seed = 1; seed <= 20; seed++) {
          const wod = gen(request, seed, bank);
          const block = wod.blocks[0];
          if (id === 'sled_repeats') {
            const every = variant!.id === '25m-every4' ? 240 : 180;
            expect(block.rest?.every_s).toBe(every);
            expect(block.movements[0].qty).toBe(every === 240 ? 25 : 15);
            expect(roundSeconds(block, 'men')).toBeLessThanOrEqual(every * 0.7);
          }
          if (id === 'engine_negative_split') expect(block.movements.map((m) => movementById(CATALOG_SNAPSHOT, m.id)!.family)).toEqual(['run', 'erg', 'run', 'erg']);
          if (id === 'run_intervals') expect(block.movements).toHaveLength(1);
        }
      }
    }
  });
});
