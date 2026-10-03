/**
 * Android ne capte, sur athlexapp.eu, que les chemins que l'app sait ouvrir
 * (src/navigation/linking.ts). Tout le reste — dont le lien de
 * réinitialisation du mot de passe — doit s'ouvrir dans le navigateur.
 * linking.ts est lu comme texte : la suite node remplace src/navigation par un module vide.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const linking = fs.readFileSync(path.join(ROOT, 'src', 'navigation', 'linking.ts'), 'utf8');

const webData = (app.expo.android.intentFilters as Array<{ data: Array<{ scheme: string; host?: string; pathPrefix?: string; path?: string; pathPattern?: string }> }>)
  .flatMap((f) => f.data)
  .filter((d) => d.host === 'athlexapp.eu');
const captured = (p: string) => webData.some((d) => (d.pathPrefix != null && p.startsWith(d.pathPrefix)) || d.path === p || (!d.pathPrefix && !d.path && !d.pathPattern));

describe('liens Android captés sur athlexapp.eu', () => {
  const handled = [...linking.matchAll(/:\s*'([\w-]+)\/:\w+'/g)].map((m) => `/${m[1]}/`).sort();

  it('lit bien les chemins de linking.ts (le test doit pouvoir échouer)', () => {
    expect(handled.length).toBeGreaterThan(0);
    expect(webData.length).toBeGreaterThan(0);
  });

  it('capte exactement les chemins que l’app ouvre', () => {
    expect(webData.every((d) => d.pathPrefix && !d.pathPattern && !d.path)).toBe(true);
    expect(webData.map((d) => d.pathPrefix).sort()).toEqual(handled);
  });

  it.each([
    '/auth/confirm?token_hash=x&type=recovery&next=/update-password',
    '/update-password',
    '/email-confirme',
    '/compte',
    '/pricing',
    '/',
  ])('%s s’ouvre dans le navigateur', (p) => {
    expect(captured(p)).toBe(false);
  });
});
