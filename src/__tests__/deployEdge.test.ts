/**
 * La fonction edge se déploie depuis une copie sans ses lignes type-only
 * (`scripts/deploy-edge.mjs`) : la CLI Supabase suit l'`import type` vers les
 * sources du moteur et échoue en `EISDIR` sur `src/bank`, qui est un répertoire.
 *
 * Un import de TYPE est donc permis — c'est lui que le script retire. Un import
 * de VALEUR ne l'est pas : le retirer casserait la fonction, et le laisser
 * casserait le déploiement. `--check` refuse ce cas, et c'est ce refus qu'on
 * mesure ici, sur la vraie source comme sur une mutation.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const racine = path.resolve(__dirname, '../..');
const script = path.join(racine, 'scripts/deploy-edge.mjs');
const entree = path.join(racine, 'supabase/functions/generate-box-week/index.ts');

/** Rejoue `--check` sur une source donnée, dans une copie jetable du dossier. */
function check(source?: string): { code: number; sortie: string } {
  let dossier = racine;
  let jetable: string | null = null;
  if (source !== undefined) {
    jetable = fs.mkdtempSync(path.join(os.tmpdir(), 'athlex-check-'));
    const cible = path.join(jetable, 'supabase/functions/generate-box-week');
    fs.mkdirSync(cible, { recursive: true });
    fs.writeFileSync(path.join(cible, 'index.ts'), source);
    dossier = jetable;
  }
  try {
    const sortie = execFileSync(
      process.execPath, [script, 'generate-box-week', '--check', '--root', dossier],
      { cwd: racine, encoding: 'utf8' },
    );
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, sortie: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  } finally {
    if (jetable) fs.rmSync(jetable, { recursive: true, force: true });
  }
}

describe('index.ts de generate-box-week', () => {
  const source = fs.readFileSync(entree, 'utf8');

  it('n\'importe aucune valeur depuis le monorepo : seul le bundle commité', () => {
    const r = check();
    expect(r.sortie).toContain('aucun import de valeur hors fonction');
    expect(r.code).toBe(0);
  });

  it('les valeurs du moteur viennent du bundle, voisin de l\'entrée', () => {
    expect(source).toMatch(/from '\.\/wod-engine\.bundle\.js';/);
  });

  it('l\'import de types, lui, reste permis — c\'est celui que le script retire', () => {
    expect(source).toMatch(/import type \{[\s\S]*?\} from '\.\.\/\.\.\/\.\.\/packages\/wod-engine\/src\/index\.ts';/);
    expect(check().sortie).toMatch(/2 ligne\(s\) type-only retirée\(s\)/);
  });

  it('l\'en-tête renvoie au script plutôt qu\'à la CLI en direct', () => {
    expect(source).toContain('node scripts/deploy-edge.mjs generate-box-week');
  });
});

describe('le garde-fou refuse un import de valeur réintroduit', () => {
  const source = fs.readFileSync(entree, 'utf8');

  it('échoue, et nomme le chemin fautif', () => {
    const mute = source.replace(
      'import type {',
      "import { TRACK_LABEL } from '../../../packages/wod-engine/src/index.ts';\nimport type {",
    );
    const r = check(mute);
    expect(r.code).toBe(1);
    expect(r.sortie).toContain('importe des VALEURS');
    expect(r.sortie).toContain('packages/wod-engine/src/index.ts');
  });

  it('un `export … from` du monorepo est refusé de la même façon', () => {
    const mute = `export { TRACKS } from '../../../packages/wod-engine/src/index.ts';\n${source}`;
    expect(check(mute).code).toBe(1);
  });
});
