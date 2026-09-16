/**
 * Bundle ESM du package `wod-engine` pour la fonction edge `generate-box-week`
 * (Deno n'accepte pas les imports TypeScript sans extension du package).
 *
 *   node packages/wod-engine/scripts/bundle-edge.mjs            # écrit le bundle
 *   node packages/wod-engine/scripts/bundle-edge.mjs --check    # échoue si le bundle commité est périmé
 *
 * Le bundle est COMMITÉ (supabase/functions/generate-box-week/wod-engine.bundle.js) :
 * le déploiement `supabase functions deploy` n'a pas de build step. Le test
 * `__tests__/edge-bundle.test.ts` rejoue `--check`.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const entry = path.join(root, 'packages/wod-engine/src/index.ts');
const out = path.join(root, 'supabase/functions/generate-box-week/wod-engine.bundle.js');
const check = process.argv.includes('--check');

const result = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  write: false,
  legalComments: 'none',
  banner: { js: '// GÉNÉRÉ par packages/wod-engine/scripts/bundle-edge.mjs — ne pas éditer.' },
});
const code = result.outputFiles[0].text;

if (check) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (current !== code) {
    console.error(`bundle périmé : relancer node packages/wod-engine/scripts/bundle-edge.mjs`);
    process.exit(1);
  }
  console.log('bundle à jour');
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, code);
  console.log(`${path.relative(root, out)} : ${(code.length / 1024).toFixed(0)} Ko`);
}
