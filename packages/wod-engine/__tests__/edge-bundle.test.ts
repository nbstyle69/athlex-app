/**
 * Le bundle ESM livré à la fonction edge `generate-box-week` est commité :
 * il doit rester identique à ce que produit `scripts/bundle-edge.mjs` depuis
 * `src/`, sinon la fonction déployée n'embarque pas le moteur testé ici.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const script = path.join(root, 'packages/wod-engine/scripts/bundle-edge.mjs');

describe('bundle edge wod-engine', () => {
  it('supabase/functions/generate-box-week/wod-engine.bundle.js est à jour', () => {
    const out = execFileSync(process.execPath, [script, '--check'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('bundle à jour');
  });
});
