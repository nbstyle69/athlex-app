import fs from 'fs';
import path from 'path';

// L'écran Documents est retiré (décision du 28/09/2026) : le stockage `documents`
// passe en privé et box_documents n'est plus lisible ni écrivable par l'app
// (migration 20270136). Une route ou un bouton restant ouvrirait un écran qui
// n'a plus aucun droit.
const src = path.join(__dirname, '..');
const lire = (f: string) => fs.readFileSync(path.join(src, f), 'utf8');

const fichiers = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : fichiers(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

describe('écran Documents retiré', () => {
  it("DocumentsScreen n'existe plus", () => {
    expect(fs.existsSync(path.join(src, 'screens/documents/DocumentsScreen.tsx'))).toBe(false);
  });

  it("la route Documents n'existe plus dans la navigation", () => {
    const nav = lire('navigation/index.tsx');
    expect(nav).not.toMatch(/name="Documents"/);
    expect(nav).not.toMatch(/^\s*Documents:/m);
    expect(nav).not.toContain('DocumentsScreen');
  });

  it("aucun écran ne navigue plus vers Documents", () => {
    const appels = fichiers(src).filter((f) => /navigate\(\s*['"]Documents['"]/.test(fs.readFileSync(f, 'utf8')));
    expect(appels).toEqual([]);
  });

  it("l'app n'écrit ni ne lit plus box_documents ni le stockage documents", () => {
    const usages = fichiers(src).filter((f) =>
      /from\(\s*['"](box_documents|documents)['"]\s*\)/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(usages).toEqual([]);
  });

  it.each(['fr', 'en'])('clés « Import WOD » retirées (%s)', (langue) => {
    const wb = JSON.parse(lire(`i18n/locales/${langue}.json`)).whiteboard;
    expect(wb.importWod).toBeUndefined();
    expect(wb.importWodCta).toBeUndefined();
    expect(wb.news).toBeDefined();
  });
});
