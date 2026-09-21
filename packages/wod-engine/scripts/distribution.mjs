/**
 * node packages/wod-engine/scripts/distribution.mjs > distribution.json
 * 2 000 appels par discipline, graines 100000..101999, intentions en cycle.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const tmp = path.join(os.tmpdir(), `athlex-distribution-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(root, 'packages/wod-engine/src/index.ts')],
  bundle: true, format: 'esm', platform: 'node', target: 'es2022', outfile: tmp, logLevel: 'silent',
});
const { generateBlocC, CATALOG_SNAPSHOT, BANK_V1, FORMAT_CHOICE_COVERS, feasibleFormats } = await import(pathToFileURL(tmp).href);
fs.rmSync(tmp, { force: true });

const count = 2000;
const report = { count, seed_start: 100000, entry: 'express', format: 'surprise', gym_records: {}, disciplines: {} };
for (const [discipline, intentions] of Object.entries({
  functional: ['mixed', 'cardio', 'force', 'gym'],
  hybrid: ['interval', 'engine', 'aerobic', 'run', 'core'],
})) {
  const result = { intentions, families: {}, subformats: {}, variants: {}, failures: [], min_displayed_percent: 100 };
  for (const sk of BANK_V1.skeletons.filter((sk) => sk.discipline === discipline)) {
    for (const variant of sk.variants ?? [null]) result.variants[variant ? `${sk.id}:${variant.id}` : sk.id] = 0;
  }
  for (const intention of intentions) {
    for (const family of feasibleFormats(discipline, intention)) {
      if (family !== 'surprise') result.families[family] ??= 0;
    }
  }
  for (let i = 0; i < count; i++) {
    const intention = intentions[i % intentions.length];
    try {
      const wod = generateBlocC({
        discipline, entry: 'express', intention, format: 'surprise',
        profile_category: discipline === 'functional' ? 'rx' : 'men', gym_records: {},
      }, CATALOG_SNAPSHOT, BANK_V1, report.seed_start + i);
      const family = Object.keys(FORMAT_CHOICE_COVERS).find((f) => FORMAT_CHOICE_COVERS[f].includes(wod.format));
      result.families[family] = (result.families[family] ?? 0) + 1;
      result.subformats[wod.format] = (result.subformats[wod.format] ?? 0) + 1;
      result.variants[wod.generator.skeleton_id] = (result.variants[wod.generator.skeleton_id] ?? 0) + 1;
    } catch (err) {
      result.failures.push({ seed: report.seed_start + i, intention, message: err.message, reasons: err.reasons });
    }
  }
  result.min_displayed_percent = Math.min(...Object.values(result.families)) / count * 100;
  if (result.failures.length || result.min_displayed_percent < 5) process.exitCode = 1;
  if (discipline === 'functional' && ['tabata', 'death_by'].some((format) => (result.subformats[format] ?? 0) / count < 0.05)) process.exitCode = 1;
  report.disciplines[discipline] = result;
}
console.log(JSON.stringify(report, null, 2));
