/**
 * PR de suite du lot A — relecture de l'échantillon et tests réels (18/09/2026).
 *
 * S1 : une séance Push ne contient aucun tirage, une séance Pull aucune poussée.
 * S2 : les 55 exercices sans matériel sont des replis en Box et en Salle.
 * S3 : sur la piste box, au plus un exercice au poids du corps hors tronc par jour.
 * E1 : en Force, un mouvement en bande lourde fait 3 à 5 reps par station sur un
 *      EMOM, des intervalles ou des stations — jamais 7 front squats dans la minute.
 */
import {
  generateBlocC, generateMuscu, generateMuscuWeek, hashSeed, CATALOG_SNAPSHOT, BANK_V1, movementById, HEAVY_STATION_REPS,
} from '../src';
import type { MuscuParams, MuscuTarget } from '../src';
import fs from 'node:fs';
import path from 'node:path';

const base: Omit<MuscuParams, 'target'> = { entry: 'express', objective: 'hypertrophie', budget_min: 30, equipment: 'box', level: 'inter' };
const gen = (p: MuscuParams, seed: number) => generateMuscu(p, CATALOG_SNAPSHOT, BANK_V1, seed);
const patternsOf = (id: string) => movementById(CATALOG_SNAPSHOT, id)?.pattern ?? [];
const estPoussee = (id: string) => patternsOf(id).some((p) => p === 'push_h' || p === 'push_v');
const estTirage = (id: string) => patternsOf(id).some((p) => p === 'pull_h' || p === 'pull_v');

/** Les 55 : exactement les lignes insérées par la migration 20261227, lues dans le fichier. */
const AJOUTS = (() => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261227000000_movement_catalog_sans_materiel.sql'), 'utf8');
  const ids = [...sql.matchAll(/^\s+\('([a-z0-9_]+)', /gm)].map((m) => m[1]);
  return ids.map((id) => movementById(CATALOG_SNAPSHOT, id)!).filter(Boolean);
})();

describe('S1 — direction des séances', () => {
  const cibles: Array<[MuscuTarget, 'push' | 'pull']> = [['push', 'push'], ['pecs', 'push'], ['pull', 'pull'], ['dos', 'pull']];

  it.each(cibles)('cible « %s » (%s) : jamais le sens opposé, en Box, Salle et Sans matériel, sur 150 tirages', (target, sens) => {
    for (const equipment of ['box', 'gym', 'none'] as const) {
      for (let i = 0; i < 50; i++) {
        let wod;
        try { wod = gen({ ...base, target, equipment }, 900 + i); } catch { continue; }
        for (const e of wod.blocks[0].exercises) {
          const interdit = sens === 'push' ? estTirage(e.id) : estPoussee(e.id);
          if (interdit) throw new Error(`${target} / ${equipment} seed ${900 + i} : ${e.id} (${patternsOf(e.id).join(',')}) n'a rien à faire là`);
        }
      }
    }
  });

  it('les cas relevés à la relecture sont couverts : pull-apart, reverse snow angels, face pull', () => {
    for (const id of ['band_pull_apart', 'reverse_snow_angel', 'band_face_pull_high']) expect(estTirage(id)).toBe(true);
    expect(movementById(CATALOG_SNAPSHOT, 'band_pull_apart')!.name).toBe("Pull-apart à l'élastique");
  });
});

describe('S2 — les 55 ajouts sont des replis en Box et en Salle', () => {
  it('ils portent tous une priorité 4 ou 5, et un ordre sans matériel propre', () => {
    expect(AJOUTS.length).toBeGreaterThanOrEqual(50);
    for (const m of AJOUTS) {
      expect([4, 5]).toContain(m.muscu!.priority);
      if (m.muscu!.weight_bodyweight > 0) expect(m.muscu!.priority_bodyweight).not.toBeNull();
    }
  });

  it('en Box, le principal du Pull et des Fessiers & ischios est un mouvement chargé, pas un repli', () => {
    for (const target of ['pull', 'fessiers_ischios'] as MuscuTarget[]) {
      for (let i = 0; i < 40; i++) {
        let wod;
        try { wod = gen({ ...base, target, equipment: 'box' }, 1200 + i); } catch { continue; }
        const principal = wod.blocks[0].exercises.find((e) => e.role === 'main_compound');
        if (!principal) continue;
        const m = movementById(CATALOG_SNAPSHOT, principal.id)!;
        expect(AJOUTS.some((a) => a.id === m.id)).toBe(false);
      }
    }
  });
});

describe('S3 — piste box : au plus un exercice au poids du corps hors tronc par jour', () => {
  const YEAR = 2027;
  const coreMuscles = new Set(['tronc', 'obliques', 'lombaires']);

  it('sur 52 semaines, aucun jour ne cumule deux poids du corps hors tronc', () => {
    const fautes: string[] = [];
    for (let wk = 1; wk <= 52; wk++) {
      const s = generateMuscuWeek({ iso_year: YEAR, iso_week: wk }, CATALOG_SNAPSHOT, BANK_V1, hashSeed('box-test', 'musculation', YEAR, wk, 0));
      for (const d of s.days) {
        const bw = d.wod.blocks[0].exercises.filter((e) => {
          const m = movementById(CATALOG_SNAPSHOT, e.id)!;
          return m.muscu!.load_mode === 'bodyweight' && !coreMuscles.has(e.muscle_primary) && !m.equipment.includes('band');
        });
        if (bw.length > 1) fautes.push(`S${wk} jour ${d.day} ${d.target} : ${bw.map((e) => e.id).join(' + ')}`);
      }
    }
    expect(fautes).toEqual([]);
  });
});

const STATION_FORMATS = new Set(['emom', 'interval', 'stations']);

describe('E1 — reps lourdes par station en Force', () => {
  it('la règle est 3 à 5', () => {
    expect(HEAVY_STATION_REPS).toEqual([3, 5]);
  });

  it.each(['emom', 'interval', 'stations'] as const)('format %s : jamais plus de 5 ni moins de 3 reps sur une barre lourde (400 tirages)', (format) => {
    let vus = 0;
    for (let i = 0; i < 400; i++) {
      let wod;
      try {
        wod = generateBlocC({ entry: 'express', discipline: 'functional', budget_min: [12, 15, 20][i % 3], intention: 'force', format, profile_category: 'rx' }, CATALOG_SNAPSHOT, BANK_V1, 6000 + i);
      } catch { continue; }
      // la règle vise les stations : un format relâché (rounds for time, death by) n'en a pas
      if (!STATION_FORMATS.has(wod.blocks[0].format)) continue;
      for (const m of wod.blocks[0].movements) {
        const cat = movementById(CATALOG_SNAPSHOT, m.id);
        if (!cat?.loads || m.load_band !== 'heavy' || m.unit !== 'reps') continue;
        vus++;
        expect(m.qty).toBeGreaterThanOrEqual(3);
        expect(m.qty).toBeLessThanOrEqual(5);
      }
    }
    expect(vus).toBeGreaterThan(0);
  });

  it('le cas rapporté : 7 front squats lourds dans la minute ne sortent plus', () => {
    let frontSquats = 0;
    for (let i = 0; i < 600; i++) {
      let wod;
      try { wod = generateBlocC({ entry: 'express', discipline: 'functional', budget_min: 12, intention: 'force', format: 'emom', profile_category: 'rx' }, CATALOG_SNAPSHOT, BANK_V1, 7000 + i); } catch { continue; }
      if (wod.blocks[0].format !== 'emom') continue;
      for (const m of wod.blocks[0].movements) if (m.id === 'front_squat' && m.load_band === 'heavy') { frontSquats++; expect(m.qty).toBeLessThanOrEqual(5); }
    }
    expect(frontSquats).toBeGreaterThan(0);
  });
});
