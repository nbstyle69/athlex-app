/**
 * PR M2 — Musculation dans le service partagé : tirage `generateMuscu` hors
 * ligne, options d'écran (ordre des cibles, Force grisée, 1RM du profil),
 * tonnage des séries saisies et crédit de badges via `logMovementReps`
 * (jamais `strength_set_logs`), matériel persisté dans `last_params`.
 */

type Row = Record<string, unknown>;
const inserted: { table: string; row: Row }[] = [];
const updated: { table: string; row: Row; filters: string[] }[] = [];
const selects: Record<string, { data: unknown; error: null }> = {};

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: string[] = [];
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      Object.assign(builder, {
        select: chain, eq: (c: string, v: unknown) => { filters.push(`${c}=${String(v)}`); return builder; },
        not: chain, order: chain, limit: chain, maybeSingle: chain, single: chain,
        insert: (row: Row) => { inserted.push({ table, row }); selects[table] = { data: { id: 'wod-1' }, error: null }; return builder; },
        update: (row: Row) => { updated.push({ table, row, filters }); return builder; },
        upsert: (row: Row) => { inserted.push({ table, row }); return builder; },
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve(selects[table] ?? { data: null, error: null }).then(resolve),
      });
      return builder;
    },
  },
}));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
const counters: unknown[][] = [];
const reps: unknown[][] = [];
jest.mock('../services/gamification', () => ({
  incrementCounter: (...a: unknown[]) => { counters.push(a); return Promise.resolve(); },
  logMovementReps: (...a: unknown[]) => { reps.push(a); return Promise.resolve(); },
}));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: () => Promise.resolve() }));
const records: Record<string, unknown> = {};
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: () => Promise.resolve(records) }));

import type { MuscuExercise } from '../../packages/wod-engine/src';
import {
  generateForUser, isMuscuResult, isMuscuWod, loadMuscuEquipment, performedMovementEntries, plannedSets,
  saveGeneratedWod, saveMuscuEquipment, setTonnage, submitMuscuScore, totalTonnage,
} from '../services/wodGenerator';
import {
  MUSCU_EQUIPMENTS, MUSCU_OBJECTIVES, candidateDurations, coerceMuscuDuration, muscuDisplayedFor, muscuEquipmentOptions,
  muscuOneRepMax, objectiveDisabled, oneRepMaxLine, targetOrderFor, targetOrderHint,
} from '../screens/wod/muscuOptions';
import { CATALOG_SNAPSHOT } from '../../packages/wod-engine/src/catalog/snapshot';
import type { MuscuScreenParams } from '../services/wodGenerator';
import type { AthleteLevel } from '../types';

const user = { id: 'u1', level: 'rx' as AthleteLevel, gender: 'female' as const };
const screen: MuscuScreenParams = {
  discipline: 'musculation', entry: 'express', target: 'fessiers', objective: 'hypertrophie', budget_min: 30, equipment: 'box', exclude: [],
};

beforeEach(() => {
  inserted.length = 0; updated.length = 0; counters.length = 0; reps.length = 0;
  for (const k of Object.keys(selects)) delete selects[k];
  for (const k of Object.keys(records)) delete records[k];
});

describe('options de la carte Musculation', () => {
  it('libellés validés, ordre des cibles par genre, Full body en tête sans genre', () => {
    expect(MUSCU_OBJECTIVES.map((o) => o.label)).toEqual(['Prise de muscle', 'Force', 'Tonification']);
    expect(MUSCU_EQUIPMENTS.map((e) => e.label)).toEqual(['Sans matériel', 'Box', 'Salle']);
    expect(targetOrderFor('female')[0]).toBe('fessiers');
    expect(targetOrderFor('male')[0]).toBe('push');
    expect(targetOrderFor(null)[0]).toBe('full_body');
    expect(targetOrderHint(null).text).toBe('Renseigne ton profil pour un ordre adapté');
    expect(targetOrderHint('male')).toEqual({ text: 'Ordre d\'après ton profil', link: 'modifier' });
  });

  it('Force grisée en Tronc, Après ma classe et sans matériel ; durées Tronc 15 · 20 · 30', () => {
    expect(objectiveDisabled('force', 'express', 'tronc', 'box')).toBe(true);
    expect(objectiveDisabled('force', 'after_class', 'pecs', 'box')).toBe(true);
    expect(objectiveDisabled('force', 'express', 'pecs', 'none')).toBe(true);
    expect(objectiveDisabled('force', 'express', 'pecs', 'box')).toBe(false);
    expect(objectiveDisabled('hypertrophie', 'express', 'tronc', 'none')).toBe(false);
    expect(candidateDurations('express', 'tronc')).toEqual([15, 20, 30]);
    expect(candidateDurations('express', 'pecs')).toEqual([20, 30, 45, 60]);
    expect(candidateDurations('after_class', 'pecs')).toEqual([15, 20, 30]);
    expect(coerceMuscuDuration([20, 30, 45], 60)).toBe(45);
    expect(coerceMuscuDuration([20, 30, 45], 30)).toBe(30);
  });

  it('niveau du profil : Scaled → Débutant, RX → Intermédiaire, RX+ → Avancé, sans niveau → Débutant', () => {
    expect(muscuDisplayedFor('scaled').level).toBe('debutant');
    expect(muscuDisplayedFor('rx')).toMatchObject({ level: 'inter', link: 'modifier' });
    expect(muscuDisplayedFor('rx+').level).toBe('avance');
    expect(muscuDisplayedFor(null)).toMatchObject({ level: 'debutant', link: 'choisir' });
  });

  it('1RM lus dans personal_records (clés weightlifting_<Label>) ; ligne 1RM ou invitation au calculateur', () => {
    expect(muscuOneRepMax({ 'weightlifting_Back Squat': '120', 'weightlifting_Deadlift': 150, 'weightlifting_Bench Press': '7' })).toEqual({ back_squat: 120, deadlift: 150 });
    expect(oneRepMaxLine({ back_squat: 120, deadlift: 150 })).toEqual({ text: 'Charges d\'après tes 1RM : Squat 120 · DL 150', link: 'modifier', known: true });
    expect(oneRepMaxLine({})).toMatchObject({ link: 'calculateur', known: false });
  });

  it('matériel excluable : barres / poulies en Box et Salle, ni « none » ni « bodyweight »', () => {
    const box = muscuEquipmentOptions(CATALOG_SNAPSHOT, 'box');
    expect(box).toContain('barbell');
    expect(box).not.toContain('bodyweight');
    expect(box).not.toContain('none');
    expect(muscuEquipmentOptions(CATALOG_SNAPSHOT, 'gym')).toContain('cable');
  });
});

describe('tirage Musculation', () => {
  it('generateMuscu hors ligne, déterministe, niveau inter pour RX, description rendue, 1RM et poids du profil transmis', async () => {
    records['weightlifting_Hip Thrust'] = '100';
    records._bodyweight_kg = '62';
    const a = await generateForUser(user, 'box', screen, 3);
    const b = await generateForUser(user, 'box', screen, 3);
    expect(isMuscuResult(a)).toBe(true);
    if (!isMuscuResult(a) || !isMuscuResult(b)) throw new Error('muscu attendu');
    expect(a.wod.signature).toBe(b.wod.signature);
    expect(a.params.level).toBe('inter');
    expect(a.params.one_rep_max).toEqual({ hip_thrust: 100 });
    expect(a.params.bodyweight_kg).toBe(62);
    expect(a.wod.blocks[0].kind).toBe('strength_session');
    expect(a.wod.description).toMatch(/Prise de muscle/);
    expect(a.wod.description).not.toMatch(/Hypertrophie|CrossFit|Hyrox/i);
  });

  it('enregistre la séance dans generated_wods (format Solo, wod_json structuré, matériel des exercices)', async () => {
    const r = await generateForUser(user, 'box', screen, 3);
    const id = await saveGeneratedWod(user.id, r.wod, r.category);
    expect(id).toBe('wod-1');
    const row = inserted.find((i) => i.table === 'generated_wods')?.row as Row;
    expect(row.format).toBe('Solo');
    expect(row.movements).toBe(r.wod.description);
    expect(row.level).toBe('inter');
    expect((row.wod_json as Row).discipline).toBe('musculation');
    expect(isMuscuWod(row.wod_json as never)).toBe(true);
  });

  it('matériel persisté dans user_generation_settings.last_params, repli Box', async () => {
    expect(await loadMuscuEquipment('u1')).toBe('box');
    selects.user_generation_settings = { data: { last_params: { muscu_equipment: 'gym' } }, error: null };
    expect(await loadMuscuEquipment('u1')).toBe('gym');
    await saveMuscuEquipment('u1', 'none');
    const row = inserted.find((i) => i.table === 'user_generation_settings')?.row as Row;
    expect((row.last_params as Row).muscu_equipment).toBe('none');
  });
});

describe('tonnage et badges', () => {
  it('tonnage = charge × reps par série, séries prévues depuis le 1RM connu', async () => {
    expect(setTonnage({ reps: 8, load_kg: 60 })).toBe(480);
    expect(setTonnage({ reps: 8, load_kg: 0 })).toBe(0);
    expect(totalTonnage([{ exercise_id: 'a', name: 'A', sets: [{ reps: 8, load_kg: 60 }, { reps: 6, load_kg: 70 }] }])).toBe(900);
    records['weightlifting_Hip Thrust'] = '100';
    // Depuis le lot A, trois rangs de priorité concourent sur le slot principal :
    // le hip thrust n'est plus garanti sur un seed donné. On cherche le premier
    // tirage qui charge un exercice depuis le 1RM connu — c'est lui qu'on vérifie.
    let ht: MuscuExercise | undefined;
    for (let seed = 1; seed <= 12 && !ht; seed++) {
      const r = await generateForUser(user, 'box', screen, seed);
      if (!isMuscuResult(r)) throw new Error('muscu attendu');
      ht = r.wod.blocks[0].exercises.find((e) => e.load.mode === '1rm');
    }
    expect(ht).toBeDefined();
    if (!ht) return;
    const sets = plannedSets(ht);
    expect(sets).toHaveLength(ht.sets);
    expect(sets[0]).toEqual({ reps: ht.reps, load_kg: ht.load.kg });
  });

  it('score : tonnage total en weight, compteur, badges d\'après les reps réelles via logMovementReps', async () => {
    const r = await generateForUser(user, 'box', screen, 3);
    if (!isMuscuResult(r)) throw new Error('muscu attendu');
    const performed = [
      { exercise_id: 'hip_thrust', name: 'Hip Thrust', sets: [{ reps: 10, load_kg: 60 }, { reps: 8, load_kg: 60 }] },
      { exercise_id: 'plank', name: 'Plank', sets: [{ reps: 0, load_kg: 0 }] },
    ];
    const tonnage = await submitMuscuScore(user, 'box', r.wod, { wodId: 'wod-1', performed, notes: 'ok' });
    expect(tonnage).toBe(1080);
    const score = inserted.find((i) => i.table === 'generated_wod_scores')?.row as Row;
    expect(score).toMatchObject({ wod_id: 'wod-1', user_id: 'u1', score_type: 'weight', score_value: 1080, rx: true });
    expect(counters[0]?.[1]).toBe('total_scores_submitted');
    expect(reps).toHaveLength(1);
    expect(reps[0][1]).toEqual([{ name: 'Hip Thrust', reps: 18, unit: 'reps', weight_kg: 60 }]);
    expect(reps[0][2]).toBe('wod');
    expect(inserted.some((i) => i.table === 'strength_set_logs')).toBe(false);
    expect(performedMovementEntries([{ exercise_id: 'x', name: 'X', sets: [{ reps: 0, load_kg: 50 }] }])).toEqual([]);
    // une série laissée à 0 rep (charge préremplie non touchée) ne compte pas dans la charge max
    expect(performedMovementEntries([{
      exercise_id: 'x', name: 'X',
      sets: [{ reps: 7, load_kg: 20 }, { reps: 5, load_kg: 18 }, { reps: 0, load_kg: 87.5 }],
    }])).toEqual([{ name: 'X', reps: 12, unit: 'reps', weight_kg: 20 }]);
  });
});

describe('mémoire des tirages Musculation (lot B)', () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  const ids = (r: Awaited<ReturnType<typeof generateForUser>>) => (isMuscuResult(r) ? r.wod.blocks[0].exercises.map((e) => e.id) : []);

  it("le premier tirage part sans historique, le second reçoit les exercices du premier — clé locale par utilisateur, préfixe purgé au signOut", async () => {
    await AsyncStorage.clear();
    const sans = { ...screen, equipment: 'none' as const };
    const first = await generateForUser(user, null, sans, 11);
    expect(isMuscuResult(first) && first.params.recent_exercise_ids).toEqual([]);
    const second = await generateForUser(user, null, sans, 12);
    expect(isMuscuResult(second) && second.params.recent_exercise_ids).toEqual(ids(first));
    expect(await AsyncStorage.getItem('@athlex:muscuRecent:u1')).toBe(JSON.stringify([ids(second), ids(first)]));
    expect(await AsyncStorage.getItem('@athlex:muscuRecent:u2')).toBeNull();
  });

  it('trois tirages au plus sont retenus, sans doublon dans ce qui est transmis au moteur', async () => {
    await AsyncStorage.clear();
    const sans = { ...screen, equipment: 'none' as const };
    const draws = [];
    for (let seed = 21; seed < 26; seed++) draws.push(ids(await generateForUser(user, null, sans, seed)));
    const stored = JSON.parse((await AsyncStorage.getItem('@athlex:muscuRecent:u1')) as string) as string[][];
    expect(stored).toEqual(draws.slice(2).reverse());
    const last = await generateForUser(user, null, sans, 26);
    const passed = isMuscuResult(last) ? last.params.recent_exercise_ids ?? [] : [];
    expect(new Set(passed).size).toBe(passed.length);
    expect(new Set(passed)).toEqual(new Set(stored.flat()));
  });
});
