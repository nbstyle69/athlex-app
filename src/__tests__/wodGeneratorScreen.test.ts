/**
 * Écran « Générateur de WOD » (brief §8) : options exactes, libellés, menu,
 * remplacement de l'ancien générateur (supprimé, pas masqué).
 */
import fs from 'fs';
import path from 'path';
import {
  DURATIONS, FORMATS, INTENTIONS, VESTS, coerceDuration, equipmentOptions, avoidedText,
} from '../screens/wod/wodGeneratorOptions';
import { CATALOG_SNAPSHOT } from '../../packages/wod-engine/src';

const ROOT = path.join(__dirname, '..', '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
/**
 * Présence d'un fichier, À LA CASSE PRÈS. `fs.existsSync` répond « oui » pour
 * `WODGeneratorScreen.tsx` alors que seul `WodGeneratorScreen.tsx` existe :
 * macOS et Windows ne distinguent pas la casse. Or ce test affirme justement
 * l'absence de fichiers dont le nom ne diffère de l'actuel que par la casse —
 * il passait en CI (Linux) et échouait sur un poste de développement, ce qui
 * est la pire des deux façons de se tromper. On lit donc le dossier et on
 * compare les noms exactement.
 */
const exists = (...p: string[]) => {
  const nom = p[p.length - 1];
  try {
    return fs.readdirSync(path.join(ROOT, ...p.slice(0, -1))).includes(nom);
  } catch {
    return false; // dossier parent absent : le fichier l'est aussi
  }
};
const screen = read('src', 'screens', 'wod', 'WodGeneratorScreen.tsx');
const result = read('src', 'screens', 'wod', 'WodResultScreen.tsx');
const nav = read('src', 'navigation', 'index.tsx');

describe('options du formulaire', () => {
  it('durées par entrée × discipline', () => {
    expect(DURATIONS.express.functional).toEqual([8, 12, 15, 20, 30]);
    expect(DURATIONS.express.hybrid).toEqual([15, 20, 30, 45]);
    expect(DURATIONS.after_class.functional).toEqual([10, 15, 20]);
    expect(DURATIONS.after_class.hybrid).toEqual([10, 15, 20]);
    expect(coerceDuration('express', 'hybrid', 8)).toBe(30);
    expect(coerceDuration('after_class', 'functional', 30)).toBe(15);
    expect(coerceDuration('express', 'hybrid', 30)).toBe(30);
  });

  it('formats express, intentions par discipline, gilet Hybrid', () => {
    expect(FORMATS.map((f) => f.label)).toEqual(['Surprends-moi', 'AMRAP', 'For time', 'EMOM', 'Chipper', 'Stations', 'Intervalles']);
    expect(INTENTIONS.functional.map((i) => i.label)).toEqual(['Mixed', 'Cardio', 'Force', 'Gym']);
    expect(INTENTIONS.hybrid.map((i) => i.label)).toEqual(['Interval', 'Engine', 'Aerobic', 'Run', 'Core']);
    expect(VESTS.map((v) => v.label)).toEqual(['Sans', 'Avec', 'Optionnel']);
    expect(VESTS.map((v) => v.key)).toEqual(['none', 'required', 'optional']);
  });

  it('Exclure : matériel tiré du catalogue, recherche de mouvement, pas de ligne Catégorie', () => {
    const eq = equipmentOptions(CATALOG_SNAPSHOT);
    expect(eq).toEqual(expect.arrayContaining(['barbell', 'rower']));
    expect(eq).toEqual([...eq].sort((a, b) => a.localeCompare(b)));
    expect(screen).toContain('placeholder="Exclure du matériel ou un mouvement…"');
    expect(screen).toContain('saveExcludes(user.id, next)');
    expect(screen).not.toMatch(/title="Catégorie"/);
    expect(screen).not.toContain('CATEGORY_LABEL');
  });

  it('Après ma classe : carte « Classe du jour · box » seulement si box + WOD publié, patterns évités', () => {
    expect(screen).toContain("entry === 'after_class' && dayClass && currentBox");
    expect(screen).toContain('label={`Classe du jour · ${currentBox.name}`}');
    expect(avoidedText(CATALOG_SNAPSHOT, ['21 Thruster (43/30 kg)', '21 Pull-ups'])).toMatch(/^Patterns évités : .*traction verticale/);
    expect(avoidedText(CATALOG_SNAPSHOT, ['21 Thruster (43/30 kg)'])).toContain('barre');
    expect(avoidedText(CATALOG_SNAPSHOT, [])).toContain('sans filtre');
  });

  it('titre, menu Historique · Favoris · Programmes, bouton selon l’entrée', () => {
    expect(screen).toContain('Générateur de WOD');
    expect(screen).toContain("navigation.navigate('WodHistory')");
    expect(screen).toContain("navigation.navigate('WodHistory', { filter: 'favorites' })");
    expect(screen).toContain("navigation.navigate('Explorer', { screen: 'Programmation' })");
    expect(screen).toContain("entry === 'express' ? (isMuscu ? 'Générer ma séance' : 'Générer mon WOD') : 'Générer mon complément'");
  });
});

describe('page résultat', () => {
  it('Re-tirer (nouvelle graine, mêmes paramètres), Enregistrer, Favori, Minuteur, Whiteboard, Saisir mon score ; Copier dans le menu ⋯', () => {
    expect(result).toContain('redraw(user, currentBox?.id, screen)');
    for (const label of ['Re-tirer', 'Favori', 'Minuteur', 'Plus', 'Copier le WOD']) expect(result).toContain(`>${label}</Text>`);
    expect(result).toContain("savedId ? 'Enregistré' : 'Enregistrer'");
    expect(result).toContain("boxWodId ? 'Sur le Whiteboard' : 'Ajouter au Whiteboard'");
    expect(result).toContain("submittedScore ? 'Modifier mon score' : 'Saisir mon score'");
    expect(result).toContain('<TimerLaunchModal');
    expect(result).toContain('<WodTypeBadge type="generated" label="Généré"');
    expect(result).toContain("navigation.navigate('Profile', { editLevel: true })");
    expect(result).not.toContain('theme.textMuted, marginTop');
    expect(result).toContain('Catégorie réalisée');
    expect(result).toMatch(/Share\.share\(\{ message: `\$\{wod\.title\}\\n\$\{wod\.description\}` \}\)/);
    expect(result).not.toContain('wod.description}</Text>');
  });
});

describe('remplacement de l’ancien générateur', () => {
  it('les anciens écrans, moteurs et le flag sont supprimés', () => {
    for (const p of [
      ['src', 'screens', 'wod', 'WODGeneratorScreen.tsx'], ['src', 'screens', 'wod', 'WODGenProScreen.tsx'],
      ['src', 'screens', 'wod', 'WODSuggestionsScreen.tsx'], ['src', 'components', 'WodGeneratorCard.tsx'],
      ['src', 'utils', 'wod', 'engineCrossFit.ts'], ['src', 'utils', 'wod', 'engineHyrox.ts'],
      ['src', 'utils', 'wod', 'ranker.ts'], ['src', 'utils', 'wod', 'adapter.ts'], ['src', 'lib', 'features.ts'],
    ]) expect(exists(...p)).toBe(false);
  });

  it('les routes WodGenerator / WodResult remplacent WODGenerator / WODGenPro / WODSuggestions dans les deux piles', () => {
    for (const old of ['WODGenerator', 'WODGenPro', 'WODSuggestions']) expect(nav).not.toContain(old);
    expect(nav).toMatch(/<HomeStack\.Screen name="WodGenerator" component=\{WodGeneratorScreen\} \/>/);
    expect(nav).toMatch(/<HomeStack\.Screen name="WodResult" component=\{WodResultScreen\} \/>/);
    expect(nav).toMatch(/<WODStack\.Screen name="WodGenerator" component=\{WodGeneratorScreen\} \/>/);
    expect(nav).toMatch(/<WODStack\.Screen name="WodResult" component=\{WodResultScreen\} \/>/);
    expect(read('src', 'screens', 'wod', 'WODScreen.tsx')).toContain("navigation.navigate('WodGenerator')");
    expect(read('src', 'screens', 'home', 'homeTools.ts')).toContain("screen: 'WodGenerator'");
  });

  it('le moteur ne dépend ni de Supabase ni du réseau ni d’une IA', () => {
    const dir = path.join(ROOT, 'packages', 'wod-engine', 'src');
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of walk(dir)) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src).not.toMatch(/from ['"][^'"]*(supabase|openai|anthropic)|\bfetch\(|XMLHttpRequest|createClient\(/i);
    }
  });
});
