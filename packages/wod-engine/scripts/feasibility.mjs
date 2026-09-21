/**
 * Table de faisabilité des combinaisons (squelette × intention), GÉNÉRÉE
 * depuis la banque par tirage réel — pas déclarée à la main.
 *
 *   node packages/wod-engine/scripts/feasibility.mjs            # écrit src/bank/feasibility.ts
 *   node packages/wod-engine/scripts/feasibility.mjs --check    # échoue si la table commitée est périmée
 *
 * L'écran ne propose que les familles servies pour la discipline et l'intention.
 * La durée est tirée dans la plage du squelette ou de sa variante.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const out = path.join(root, 'packages/wod-engine/src/bank/feasibility.ts');
const check = process.argv.includes('--check');

/** Seeds par combinaison : une combinaison est faisable si UN tirage aboutit. */
export const FEASIBILITY_SEEDS = 25;

const tmp = path.join(os.tmpdir(), `athlex-feasibility-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(root, 'packages/wod-engine/src/index.ts')],
  bundle: true, format: 'esm', platform: 'node', target: 'es2022', outfile: tmp, legalComments: 'none', logLevel: 'silent',
});
const { generateBlocC, CATALOG_SNAPSHOT, BANK_V1 } = await import(pathToFileURL(tmp).href);
fs.rmSync(tmp, { force: true });

const ids = BANK_V1.skeletons.map((s) => s.id);
const rows = [];
for (const sk of BANK_V1.skeletons) {
  const ref = sk.discipline === 'functional' ? 'rx' : 'men';
  for (const intention of sk.intentions) {
      let ok = 0;
      for (let i = 0; i < FEASIBILITY_SEEDS; i++) {
        try {
          generateBlocC(
            { entry: 'express', discipline: sk.discipline, intention, format: 'surprise', profile_category: ref, skeleton_not: ids.filter((x) => x !== sk.id) },
            CATALOG_SNAPSHOT, BANK_V1, 777 + i,
          );
          ok++;
        } catch { /* rejeté */ }
      }
      rows.push({ id: sk.id, discipline: sk.discipline, format: sk.format, intention, feasible: ok > 0 });
  }
}

const dead = rows.filter((r) => !r.feasible);
const lignes = rows.map((r) =>
  `  { id: '${r.id}', discipline: '${r.discipline}', format: '${r.format}', intention: '${r.intention}', feasible: ${r.feasible} },`);
const contenu = `// GÉNÉRÉ par scripts/feasibility.mjs — ne pas éditer. ${FEASIBILITY_SEEDS} seeds par combinaison.
// ${rows.length} combinaisons déclarées, ${dead.length} jamais servies.
import type { Discipline, Intention, SkeletonFormat } from '../types';

export interface FeasibilityRow {
  id: string;
  discipline: Discipline;
  format: SkeletonFormat;
  intention: Intention;
  /** au moins un tirage sur ${FEASIBILITY_SEEDS} aboutit, ce squelette seul autorisé */
  feasible: boolean;
}

export const FEASIBILITY: readonly FeasibilityRow[] = [
${lignes.join('\n')}
];
`;

if (check) {
  const actuel = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (actuel !== contenu) {
    console.error('feasibility.ts périmé : relancer node packages/wod-engine/scripts/feasibility.mjs');
    process.exit(1);
  }
  console.log(`feasibility.ts à jour (${rows.length} combinaisons, ${dead.length} infaisables)`);
} else {
  fs.writeFileSync(out, contenu);
  console.log(`feasibility.ts écrit : ${rows.length} combinaisons, ${dead.length} jamais servies`);
  for (const r of dead) console.log(`   ${r.discipline} · ${r.id} · ${r.intention}`);
}
