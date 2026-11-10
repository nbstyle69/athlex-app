/**
 * Un update EAS ne s'applique qu'aux builds du même runtime : publié sur un
 * runtime sans build, il est ignoré en silence par les appareils. Chaque
 * plateforme a son runtime (app.json `ios.runtimeVersion`,
 * `android.runtimeVersion`) ; sort en échec si l'une d'elles n'a aucun build
 * terminé sur le sien.
 *
 * usage : node scripts/ota-runtime-guard.mjs <builds.json> [app.json]
 */
import { readFileSync } from 'node:fs';
import { lireRuntimesOta, plateformesSansBuild, runtimeDuBuild } from './lib/runtimes-ota.mjs';

const [file, appJson = 'app.json'] = process.argv.slice(2);
if (!file) {
  console.error('usage : node scripts/ota-runtime-guard.mjs <builds.json> [app.json]');
  process.exit(2);
}

const builds = JSON.parse(readFileSync(file, 'utf8'));
const runtimes = lireRuntimesOta(appJson);
const manquantes = plateformesSansBuild(builds, runtimes);

if (manquantes.length > 0) {
  const vus = [...new Set(builds.map((b) => `${String(b.platform).toLowerCase()}/${runtimeDuBuild(b)}`))].join(', ');
  for (const p of manquantes) console.error(`aucun build ${p} terminé sur le runtime ${runtimes[p]}`);
  console.error(`(builds vus : ${vus || 'aucun'})`);
  process.exit(1);
}

for (const [p, r] of Object.entries(runtimes)) console.log(`${p} : build terminé sur le runtime ${r}`);
