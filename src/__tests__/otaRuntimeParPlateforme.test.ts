/**
 * Runtime OTA par plateforme (#523).
 *
 * Un update ne s'applique qu'aux binaires du même runtime. Les deux binaires en
 * vente n'ont pas la même version : iOS 1.0.67 (build 68), Android 1.0.68
 * (versionCode 84). Chaque plateforme fige donc le runtime de SON build ; la
 * politique `appVersion` (un seul runtime = `version`) laissait les deux sans
 * update. À chaque nouveau build store, la valeur de la plateforme concernée
 * change dans la même branche `build/<version>` — et ce test avec.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = path.join(__dirname, '..', '..');
const expo = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;

describe('app.json : runtime OTA de chaque binaire en vente', () => {
  it('iOS vise 1.0.67 (build 68), Android 1.0.68 (versionCode 84)', () => {
    expect(expo.ios.runtimeVersion).toBe('1.0.67');
    expect(expo.android.runtimeVersion).toBe('1.0.68');
  });

  it('aucun runtime global ni politique : chaque plateforme porte le sien', () => {
    expect(expo.runtimeVersion).toBeUndefined();
  });
});

/** Lance le vrai garde-fou du workflow sur une liste de builds fabriquée. */
function garde(builds: object[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-garde-'));
  const file = path.join(dir, 'builds.json');
  fs.writeFileSync(file, JSON.stringify(builds));
  const r = spawnSync('node', [path.join(ROOT, 'scripts', 'ota-runtime-guard.mjs'), file, path.join(ROOT, 'app.json')], {
    encoding: 'utf8',
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: r.stdout + r.stderr };
}

// Forme réelle de `eas build:list --json` : le runtime est sous `runtime.version`.
const build = (platform: string, runtime: string, status = 'FINISHED') =>
  ({ platform, status, appVersion: runtime, runtime: { version: runtime } });

describe('garde-fou du workflow OTA : chaque plateforme sur son runtime', () => {
  it('passe quand iOS a un build 1.0.67 et Android un build 1.0.68', () => {
    const r = garde([build('IOS', '1.0.67'), build('ANDROID', '1.0.68'), build('ANDROID', '1.0.67')]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('ios : build terminé sur le runtime 1.0.67');
    expect(r.out).toContain('android : build terminé sur le runtime 1.0.68');
  });

  it("refuse si Android n'a de build que sur le runtime d'iOS", () => {
    const r = garde([build('IOS', '1.0.67'), build('ANDROID', '1.0.67')]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('aucun build android terminé sur le runtime 1.0.68');
  });

  it("refuse si le build iOS du runtime n'est pas terminé", () => {
    const r = garde([build('IOS', '1.0.67', 'ERRORED'), build('ANDROID', '1.0.68')]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('aucun build ios terminé sur le runtime 1.0.67');
  });
});
