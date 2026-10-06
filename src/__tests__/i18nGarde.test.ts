// Garde du chantier anglais : un fichier déclaré traduit ne doit plus afficher
// de français hors t(), fr.json et en.json ont les mêmes clés, et « Musculation »
// se dit « Strength » en anglais. Ajouter un fichier à
// scripts/i18n/fichiers-traduits.json une fois qu'il est entièrement traduit.
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanFile } = require('../../scripts/i18n/scanner');

const RACINE = path.join(__dirname, '..', '..');
const FICHIERS: string[] = JSON.parse(fs.readFileSync(path.join(RACINE, 'scripts/i18n/fichiers-traduits.json'), 'utf8'));
const LOCALES = path.join(RACINE, 'src/i18n/locales');
const lire = (lang: string) => JSON.parse(fs.readFileSync(path.join(LOCALES, `${lang}.json`), 'utf8'));

const cles = (obj: Record<string, unknown>, prefixe = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? cles(v as Record<string, unknown>, `${prefixe}${k}.`) : [`${prefixe}${k}`],
  );
const valeurs = (obj: Record<string, unknown>, prefixe = ''): [string, unknown][] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? valeurs(v as Record<string, unknown>, `${prefixe}${k}.`) : [[`${prefixe}${k}`, v] as [string, unknown]],
  );

describe('garde i18n', () => {
  it.each(FICHIERS)('%s : aucune chaîne française hors t()', fichier => {
    const trouves = scanFile(path.join(RACINE, fichier)) as { line: number; text: string }[];
    expect(trouves.map(r => `${fichier}:${r.line} ${r.text}`)).toEqual([]);
  });

  it('fr.json et en.json ont exactement les mêmes clés', () => {
    const fr = new Set(cles(lire('fr')));
    const en = new Set(cles(lire('en')));
    expect({ absentesDeEn: [...fr].filter(k => !en.has(k)), absentesDeFr: [...en].filter(k => !fr.has(k)) })
      .toEqual({ absentesDeEn: [], absentesDeFr: [] });
  });

  it('aucune valeur de en.json ne contient « Musculation »', () => {
    const fautives = valeurs(lire('en')).filter(([, v]) => typeof v === 'string' && /musculation/i.test(v)).map(([k]) => k);
    expect(fautives).toEqual([]);
  });

  it('le scanner relève une chaîne française hors t() et ignore t()', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { scanSource } = require('../../scripts/i18n/scanner');
    const src = `const A = () => <Text>{t('a.b')}</Text>;\nconst B = () => <Text>Séance terminée</Text>;\n`;
    expect(scanSource('x.tsx', src).map((r: { line: number }) => r.line)).toEqual([2]);
  });
});
