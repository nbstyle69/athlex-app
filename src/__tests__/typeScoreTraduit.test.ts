import fs from 'fs';
import path from 'path';
import fr from '../i18n/locales/fr.json';
import en from '../i18n/locales/en.json';

// Le type de score s'affichait brut (« WEIGHT », « TIME ») dans la saisie du score.
const TYPES = ['time', 'reps', 'weight', 'rounds'] as const;
const src = fs.readFileSync(path.join(__dirname, '..', 'screens/whiteboard/WODDetailScreen.tsx'), 'utf8');

describe('type de score traduit dans la saisie du score', () => {
  it.each([['fr', fr, 'Charge'], ['en', en, 'Load']] as const)('%s : chaque type a son libellé', (_l, loc, charge) => {
    const st = (loc as any).wod.scoreType;
    expect(st.label).toBeTruthy();
    for (const t of TYPES) expect(st[t]).toBeTruthy();
    expect(st.weight).toBe(charge);
  });

  it('WODDetail affiche le libellé traduit, jamais le type brut', () => {
    expect(src).not.toMatch(/types\[0\]\.toUpperCase\(\)/);
    expect(src).not.toMatch(/\{t\.toUpperCase\(\)\}/);
    expect(src).not.toContain('TYPE DE SCORE');
    expect(src.match(/i18n\.t\(`wod\.scoreType\.\$\{/g)).toHaveLength(2);
  });
});
