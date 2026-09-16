/**
 * Règle transverse — marques : « CrossFit » et « Hyrox » ne sortent jamais dans ce que voit un utilisateur
 * (titres, descriptions, libellés de piste, noms de groupe, squelettes, samples). On dit Functional et Hybrid.
 */
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import {
  generateBlocC, generateWeek, generateMuscuWeek, generateMuscu, hashSeed, renderMuscu,
  CATALOG_SNAPSHOT, BANK_V1, SESSION_SKELETONS, MUSCU_SKELETONS, TRACK_LABEL, TRACK_GROUP_NAME, MUSCU_TARGETS, MUSCU_OBJECTIVES,
  functionalWeekRows, muscuWeekRows,
} from '../src';
import type { GeneratedWod, MuscuParams, GenerateParams, WeekContext } from '../src';

const BRANDS = /crossfit|hyrox/i;
const YEAR = 2027;
const WEEKS = Number(process.env.WOD_ENGINE_WEEKS ?? 12);

function expectClean(label: string, text: string | null | undefined): void {
  if (text == null) return;
  if (BRANDS.test(text)) throw new Error(`${label} contient une marque : ${text.match(BRANDS)![0]} — « ${text.slice(0, 120)} »`);
}

function checkWod(label: string, w: GeneratedWod): void {
  expectClean(`${label}.title`, w.title);
  expectClean(`${label}.description`, w.description);
  expectClean(`${label}.stimulus`, w.stimulus?.note);
}

describe('marques : jamais « CrossFit » ni « Hyrox » côté utilisateur', () => {
  it('pistes, groupes et squelettes', () => {
    for (const v of Object.values(TRACK_LABEL)) expectClean('TRACK_LABEL', v);
    for (const v of Object.values(TRACK_GROUP_NAME)) expectClean('TRACK_GROUP_NAME', v);
    for (const sk of SESSION_SKELETONS) { expectClean(`${sk.id}.label`, sk.label); expectClean(sk.id, JSON.stringify(sk)); }
    for (const sk of MUSCU_SKELETONS) expectClean(sk.id, JSON.stringify(sk));
    for (const sk of BANK_V1.skeletons) expectClean(sk.id, JSON.stringify(sk));
  });

  it('WODs Functional / Hybrid (WodGenerator)', () => {
    const cases: GenerateParams[] = [
      { entry: 'express', discipline: 'functional', intention: 'mixed', budget_min: 20 },
      { entry: 'express', discipline: 'hybrid', intention: 'run', budget_min: 30 },
    ];
    for (const p of cases) for (let seed = 1; seed <= 40; seed++) checkWod(`${p.discipline}#${seed}`, generateBlocC(p, CATALOG_SNAPSHOT, BANK_V1, seed));
  });

  it('séances Musculation', () => {
    for (const target of MUSCU_TARGETS) for (const objective of MUSCU_OBJECTIVES) {
      const p: MuscuParams = { entry: 'express', target, objective, budget_min: 45, equipment: 'gym', level: 'inter' };
      const w = generateMuscu(p, CATALOG_SNAPSHOT, BANK_V1, 7);
      expectClean(`${target}/${objective}.title`, w.title);
      expectClean(`${target}/${objective}.description`, renderMuscu(w));
    }
  });

  it(`programmation automatique : lignes box_wods des deux pistes (${WEEKS} semaines)`, () => {
    for (let wk = 1; wk <= WEEKS; wk++) {
      const ctx: WeekContext = { box_id: 'box-test', run_id: 'run-test', created_by: 'owner-test', iso_year: YEAR, iso_week: wk };
      const week = generateWeek({ iso_year: YEAR, iso_week: wk }, CATALOG_SNAPSHOT, BANK_V1, hashSeed('box-test', 'crossfit', YEAR, wk, 0));
      for (const r of functionalWeekRows(week, ctx)) { expectClean(`functional W${wk} title`, r.title); expectClean(`functional W${wk} description`, r.description); }
      const mw = generateMuscuWeek({ iso_year: YEAR, iso_week: wk }, CATALOG_SNAPSHOT, BANK_V1, hashSeed('box-test', 'musculation', YEAR, wk, 0));
      for (const r of muscuWeekRows(mw, ctx)) { expectClean(`musculation W${wk} title`, r.title); expectClean(`musculation W${wk} description`, r.description); }
    }
  });

  it('samples relus par Nabil (samples*.md)', () => {
    const dir = path.join(__dirname, '..');
    const files = readdirSync(dir).filter((f) => /^samples.*\.md$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) expectClean(f, readFileSync(path.join(dir, f), 'utf8'));
  });
});
