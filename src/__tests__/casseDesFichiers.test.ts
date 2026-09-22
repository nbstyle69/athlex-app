/**
 * Deux fichiers versionnés ne doivent jamais différer par la seule casse.
 *
 * Pourquoi c'est un contrôle et pas une convention : les builds iOS d'EAS
 * tournent sur macOS, dont le système de fichiers est par défaut INSENSIBLE à
 * la casse. Une paire `Foo.tsx` / `foo.tsx` se checkoute là-bas en un seul
 * fichier — l'un écrase l'autre, silencieusement, et le binaire embarque le
 * mauvais. Sur la CI Linux, où le système de fichiers distingue la casse, rien
 * ne le dirait. Le contrôle est donc posé là où il sera vu : dans les tests,
 * qui tournent aux deux endroits.
 *
 * La liste vient de l'index git (`git ls-files`), pas du disque : lui seul
 * restitue les noms à la casse exacte sous Windows et sous macOS.
 */
import { execFileSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

const versionnes = () =>
  execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

describe('casse des noms de fichiers versionnés', () => {
  const fichiers = versionnes();

  it('le dépôt a bien été lu (contre-exemple)', () => {
    // Sur une liste vide, l'assertion suivante serait verte sans rien prouver.
    expect(fichiers.length).toBeGreaterThan(100);
  });

  it('aucune paire de fichiers ne diffère par la seule casse', () => {
    const parMinuscules = new Map<string, string[]>();
    for (const f of fichiers) {
      const cle = f.toLowerCase();
      parMinuscules.set(cle, [...(parMinuscules.get(cle) ?? []), f]);
    }
    const collisions = [...parMinuscules.values()]
      .filter((noms) => noms.length > 1)
      .map((noms) => noms.sort().join(' ↔ '));

    // Le message nomme la paire : « 2 collisions » n'aide personne à 3 h du
    // matin quand un build iOS embarque le mauvais écran.
    expect(collisions).toEqual([]);
  });
});
