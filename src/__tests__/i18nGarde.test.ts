// Garde du chantier anglais : un fichier déclaré traduit n'affiche plus aucun
// texte hors t() (garde stricte, quelle que soit la langue ; exceptions : textes
// sans lettre, termes de scripts/i18n/termes-techniques.json, « // i18n-ignore :
// <raison> »), fr.json et en.json ont les mêmes clés, et « Musculation » se dit
// « Strength » en anglais. Ajouter un fichier à
// scripts/i18n/fichiers-traduits.json une fois qu'il est entièrement traduit.
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanFile, scanFileStrict, scanStrict, ignoresWithoutReason } = require('../../scripts/i18n/scanner');

const RACINE = path.join(__dirname, '..', '..');
const FICHIERS: string[] = JSON.parse(fs.readFileSync(path.join(RACINE, 'scripts/i18n/fichiers-traduits.json'), 'utf8'));
// Fichiers volontairement laissés en français, chacun avec sa raison (scripts/i18n/fichiers-exclus.json).
const EXCLUS: Record<string, string> = JSON.parse(fs.readFileSync(path.join(RACINE, 'scripts/i18n/fichiers-exclus.json'), 'utf8'));
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

  it.each(FICHIERS)('%s : aucun texte affiché hors t() (garde stricte), aucun i18n-ignore sans raison', fichier => {
    const { strict, ignoresWithoutReason: sansRaison } = scanFileStrict(path.join(RACINE, fichier)) as {
      strict: { line: number; text: string }[]; ignoresWithoutReason: { line: number; text: string }[];
    };
    expect(strict.map(r => `${fichier}:${r.line} ${r.text}`)).toEqual([]);
    expect(sansRaison.map(r => `${fichier}:${r.line} ${r.text}`)).toEqual([]);
  });

  it.each(Object.entries(EXCLUS))('%s : exclu avec sa raison, absent des fichiers traduits', (fichier, raison) => {
    expect(fs.existsSync(path.join(RACINE, fichier))).toBe(true);
    expect(raison.trim().length).toBeGreaterThan(10);
    expect(FICHIERS).not.toContain(fichier);
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

describe('garde stricte : scanner', () => {
  const lignes = (src: string) => (scanStrict('x.tsx', src) as { line: number }[]).map(r => r.line);

  it.each([
    ['texte JSX', '<Text>Re-tirer</Text>'],
    ['texte JSX', '<Text style={S.a}>Favori</Text>'],
    ['prop label', '<AxButton label="Copier" />'],
    ['texte anglais', '<AxButton label="Save" />'],
    ['ternaire dans une prop', "<AxButton label={ok ? t('a') : 'Plus'} />"],
    ['gabarit', '<Text>{`${n} séries`}</Text>'],
    ['?? dans le JSX', '<Text>{name ?? \'Athlète\'}</Text>'],
    ['placeholder', '<AxTextField placeholder="Notes" />'],
    ['accessibilityLabel', '<X accessibilityLabel="Close" />'],
    ['Alert.alert', "Alert.alert('Oops', t('a'));"],
    ['bouton d\'Alert.alert', "Alert.alert(t('a'), t('b'), [{ text: 'OK' }]);"],
  ])('%s hors t() : refusé (%s)', (_cas, code) => {
    expect(lignes(`const A = () => (\n  ${code}\n);\n`)).toEqual([2]);
  });

  it.each([
    ['séries × reps', '<Text>5 × 3</Text>'],
    ['terme technique', '<Text>RPE</Text>'],
    ['termes et nombres', '<Text>{`RPE ${rpe} · ${kg} kg`}</Text>'],
    ['For Time', '<AxTag label="For Time" />'],
    ['t()', "<AxButton label={t('common.save')} />"],
    ['valeur calculée', '<Text>{movement.name}</Text>'],
    ['argument d\'un appel', "<Text>{format(x, 'dd/MM')}</Text>"],
    ['testID', '<X testID="wod-save" />'],
  ])('%s : admis (%s)', (_cas, code) => {
    expect(lignes(`const A = () => (\n  ${code}\n);\n`)).toEqual([]);
  });

  it('i18n-ignore : la raison est obligatoire', () => {
    const avec = "const A = () => <Text>Re-tirer</Text>; // i18n-ignore : démonstration\n";
    const sans = "const A = () => <Text>Re-tirer</Text>; // i18n-ignore\n";
    expect(lignes(avec)).toEqual([]);
    expect(lignes(sans)).toEqual([1]);
    expect(ignoresWithoutReason(sans).map((r: { line: number }) => r.line)).toEqual([1]);
    expect(ignoresWithoutReason(avec)).toEqual([]);
  });

  it('la liste des termes techniques ne contient aucun mot courant', () => {
    const { termes } = JSON.parse(fs.readFileSync(path.join(RACINE, 'scripts/i18n/termes-techniques.json'), 'utf8'));
    for (const mot of ['plus', 'save', 'copier', 'favori', 'cap', 'score', 'total', 'round', 'rounds', 'coach', 'box']) {
      expect(termes.map((x: string) => x.toLowerCase())).not.toContain(mot);
    }
  });
});
