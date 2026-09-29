import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const THIS_FILE = path.resolve(__filename);

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

const nav = fs.readFileSync(path.join(SRC, 'navigation', 'index.tsx'), 'utf8');

describe('retrait de WODScreen et de la pile WODNavigator', () => {
  it('le fichier WODScreen.tsx n’existe plus', () => {
    expect(fs.existsSync(path.join(SRC, 'screens', 'wod', 'WODScreen.tsx'))).toBe(false);
  });

  it('aucune occurrence de WODNavigator ni de la route WODList dans src/', () => {
    const offenders = walk(SRC)
      .filter((f) => path.resolve(f) !== THIS_FILE && /\.(tsx?|jsx?|json)$/.test(f))
      .filter((f) => {
        const src = fs.readFileSync(f, 'utf8');
        return src.includes('WODNavigator') || src.includes('WODList');
      })
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it.each(['WodGenerator', 'WodResult', 'WodHistory', 'TimerRun', 'VideoPlayback'])(
    'l’écran %s reste déclaré dans une pile de navigation',
    (name) => {
      expect(nav).toMatch(new RegExp(`<\\w+\\.Screen\\s+name="${name}"\\s+component=\\{${name}Screen\\}`));
    },
  );
});
