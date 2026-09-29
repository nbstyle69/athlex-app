/**
 * Refonte R3c : chaque écran secondaire de l'athlète utilise AxScreenHeader,
 * avec son titre, son action de droite et son retour propre ; les écrans
 * racine des onglets et les écrans exclus n'en ont pas.
 */
import * as fs from 'fs';
import * as path from 'path';
import { R3C_SCREENS, ATHLETE_ROOT_SCREENS } from './r3cScreens';

const SCREENS = path.join(__dirname, '..', 'screens');
const read = (f: string) => fs.readFileSync(path.join(SCREENS, f), 'utf8');

/** Balises ouvrantes <AxScreenHeader …> complètes, accolades comprises. */
function headerTags(src: string): string[] {
  const tags: string[] = [];
  let i = src.indexOf('<AxScreenHeader');
  while (i !== -1) {
    let depth = 0;
    let j = i;
    for (; j < src.length; j++) {
      const ch = src[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0 && src[j - 1] !== '=') break;
    }
    tags.push(src.slice(i, j + 1));
    i = src.indexOf('<AxScreenHeader', j);
  }
  return tags;
}

const LEGACY_HEADER = /\.header\}>\s*(?:<View[^>]*>\s*)?<TouchableOpacity[^>]*onPress=\{\(\) => (?:\{ )?(?:nav(?:igation)?\.goBack|setSelected|setPhase|setSelectedArticle)/;

describe('R3c : écrans secondaires de l’athlète', () => {
  it('la liste couvre les écrans migrés, sans doublon', () => {
    const files = R3C_SCREENS.map((s) => s.file);
    expect(new Set(files).size).toBe(files.length);
    expect(files.length).toBe(37);
  });

  describe.each(R3C_SCREENS)('$file', ({ file, titles, right = [], onBack = [] }) => {
    const src = read(file);
    const tags = headerTags(src);

    it('importe AxScreenHeader et n’a plus l’ancien en-tête', () => {
      expect(src).toMatch(/import \{ AxScreenHeader \} from '\.\.\/\.\.\/components\/ax\/AxScreenHeader';/);
      expect(src).not.toMatch(LEGACY_HEADER);
      expect(src).not.toMatch(/\bArrowLeft\b/);
    });

    it.each(titles)('garde son titre : %s', (title) => {
      expect(tags.some((t) => t.includes(title))).toBe(true);
    });

    if (right.length) {
      it.each(right)('garde son action de droite : %s', (r) => {
        expect(tags.some((t) => /\bright=\{/.test(t) && t.slice(t.indexOf('right={')).includes(r))).toBe(true);
      });
    }

    if (onBack.length) {
      it.each(onBack)('garde son action de retour propre : %s', (b) => {
        expect(tags.some((t) => t.includes(b))).toBe(true);
      });
    }
  });

  it('MessagesScreen : Retour seulement quand l’écran a été ouvert depuis un autre', () => {
    expect(read('messages/MessagesScreen.tsx')).toMatch(/\{canGoBack \? \(\s*<AxScreenHeader title="Messages">/);
  });
});

describe('R3c : écrans non concernés', () => {
  it.each(ATHLETE_ROOT_SCREENS)('écran racine %s : pas de Retour ax', (file) => {
    const src = read(file);
    expect(src).not.toMatch(/AxScreenHeader/);
    expect(src).not.toMatch(/common\.back/);
    expect(src).not.toMatch(/goBack\(\)\}[^>]*>\s*<(?:ChevronLeft|ArrowLeft)\b/);
  });

  it('Réservation (racine) : plus de chevron de retour, titre et nom de box gardés', () => {
    const src = read('reservation/ReservationScreen.tsx');
    expect(src).not.toMatch(/navigation\.goBack\(\)/);
    expect(src).not.toMatch(/\bChevronLeft\b/);
    expect(src).toMatch(/<Text style=\{S\.headerTitle\}>\{t\('reservation\.title'\)\}<\/Text>\s*<Text style=\{S\.headerSub\}>\{currentBox\.name\}<\/Text>/);
  });

  it.each([
    'timer/TimerRunScreen.tsx',
    'timer/VideoPlaybackScreen.tsx',
    'explorer/BoxDirectoryMapScreen.tsx',
    'explorer/BoxDirectoryMapScreen.web.tsx',
  ])('plein écran %s : inchangé', (file) => {
    expect(read(file)).not.toMatch(/AxScreenHeader/);
  });

  it('gérant, coach, connexion, tutoriel : aucun AxScreenHeader', () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const files = ['backoffice', 'admin', 'auth', 'onboarding'].flatMap((d) => walk(path.join(SCREENS, d)));
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter((f) => /AxScreenHeader/.test(fs.readFileSync(f, 'utf8')))).toEqual([]);
  });
});
