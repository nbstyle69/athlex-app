/**
 * Runtime OTA de chaque plateforme, lu dans app.json (`ios.runtimeVersion`,
 * `android.runtimeVersion`). Un update ne s'applique qu'aux binaires du même
 * runtime : chaque plateforme vise celui de son build en vente.
 */
import { readFileSync } from 'node:fs';

export const PLATFORMES = ['ios', 'android'];

export function runtimesOta(expo) {
  const runtimes = {};
  for (const p of PLATFORMES) {
    const v = expo?.[p]?.runtimeVersion;
    if (typeof v !== 'string' || v === '') {
      throw new Error(`app.json : ${p}.runtimeVersion absent ou non littéral (${JSON.stringify(v)})`);
    }
    runtimes[p] = v;
  }
  return runtimes;
}

export function lireRuntimesOta(chemin = 'app.json') {
  return runtimesOta(JSON.parse(readFileSync(chemin, 'utf8')).expo);
}

/** Runtime d'un build tel que le rend `eas build:list --json`. */
export function runtimeDuBuild(b) {
  return b.runtime?.version ?? b.runtimeVersion ?? b.appVersion;
}

/**
 * Plateformes sans build terminé sur leur runtime. Vide = l'update sera
 * appliqué partout.
 */
export function plateformesSansBuild(builds, runtimes) {
  return PLATFORMES.filter(
    (p) => !builds.some(
      (b) => b.status === 'FINISHED'
        && String(b.platform).toLowerCase() === p
        && runtimeDuBuild(b) === runtimes[p],
    ),
  );
}
