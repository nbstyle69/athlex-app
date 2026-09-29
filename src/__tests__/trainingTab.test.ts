/**
 * R2a — l'onglet Entraînement remplace Explorer ; les anciens contenus
 * d'Explorer passent dans la pile Accueil.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const nav = read('navigation', 'index.tsx');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(full);
    return /\.(tsx?|json)$/.test(e.name) ? [full] : [];
  });
}

function stackScreens(fn: string, stack: string): string[] {
  const start = nav.indexOf(`function ${fn}() {`);
  expect(start).toBeGreaterThan(-1);
  const body = nav.slice(start, nav.indexOf('\n}\n', start));
  return [...body.matchAll(new RegExp(`<${stack}\\.Screen name="(\\w+)"`, 'g'))].map((m) => m[1]);
}

const EXPLORER_ROUTES = ['Programmation', 'BoxDirectory', 'BoxDirectoryMap', 'BoxDirectoryDetail', 'Partners', 'PartnerDetail', 'BoxPrograms'];

describe('onglet Entraînement', () => {
  it('2e onglet de la barre athlète, icône Dumbbell, libellé tabs.training', () => {
    const tabs = stackScreens('MainTabs', 'Tab');
    expect(tabs).toEqual(['Competitions', 'Training', 'Home', 'Whiteboard', 'Reservation']);
    expect(nav).toMatch(/Training:\s+<Dumbbell color=\{color\} size=\{size\} \/>/);
    expect(nav).toContain('<Tab.Screen name="Training"     component={TrainingNavigator}     options={{ tabBarLabel: t(\'tabs.training\') }}');
  });

  it('libellé FR « Entraînement », EN « Training »', () => {
    expect(JSON.parse(read('i18n', 'locales', 'fr.json')).tabs.training).toBe('Entraînement');
    expect(JSON.parse(read('i18n', 'locales', 'en.json')).tabs.training).toBe('Training');
  });

  it('la pile Entraînement déclare son écran et les écrans WOD / minuteur, qui restent aussi dans Accueil', () => {
    const training = stackScreens('TrainingNavigator', 'TrainingStack');
    const home = stackScreens('HomeNavigator', 'HomeStack');
    expect(training[0]).toBe('TrainingMain');
    expect(nav).toContain('<TrainingStack.Screen name="TrainingMain" component={TrainingScreen} />');
    for (const r of ['WodGenerator', 'WodResult', 'WodHistory', 'OneRMCalculator', 'Timer', 'TimerRun', 'VideoPlayback']) {
      expect(training).toContain(r);
      expect(home).toContain(r);
    }
  });

  it('chaque écran de la pile Entraînement trouve dans la pile les routes vers lesquelles il navigue', () => {
    const training = new Set(stackScreens('TrainingNavigator', 'TrainingStack'));
    const files: Record<string, string> = {
      WodGenerator: 'screens/wod/WodGeneratorScreen.tsx', WodResult: 'screens/wod/WodResultScreen.tsx',
      WodHistory: 'screens/wod/WodHistoryScreen.tsx', Profile: 'screens/profile/ProfileScreen.tsx',
      EloHistory: 'screens/profile/EloHistoryScreen.tsx', ProgramDetail: 'screens/programs/ProgramDetailScreen.tsx',
      TrainingMain: 'screens/training/TrainingScreen.tsx',
    };
    const TABS = new Set(['Home', 'Competitions', 'Training', 'Whiteboard', 'Reservation']);
    for (const [route, file] of Object.entries(files)) {
      expect(training.has(route)).toBe(true);
      const targets = [...read(file).matchAll(/navigation\.navigate\('(\w+)'/g)].map((m) => m[1]);
      for (const target of targets) if (!TABS.has(target)) expect(`${route} → ${target} : ${training.has(target)}`).toBe(`${route} → ${target} : true`);
    }
  });
});

describe('Explorer : plus d’onglet ni d’écran, contenus dans Accueil', () => {
  it('aucune route, aucun type ni écran Explorer / ExplorerMain dans src', () => {
    expect(fs.existsSync(path.join(SRC, 'screens', 'explorer', 'ExplorerScreen.tsx'))).toBe(false);
    const offenders = walk(SRC).filter((f) => !f.endsWith('.json')
      && /\bExplorer(Main|Screen|Navigator|StackParamList)\b|['"]Explorer['"]|name="Explorer"/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('les sept routes de l’ancienne pile Explorer sont déclarées dans Accueil, avec leur écran', () => {
    const home = stackScreens('HomeNavigator', 'HomeStack');
    for (const r of EXPLORER_ROUTES) {
      expect(home).toContain(r);
      expect(nav).toContain(`<HomeStack.Screen name="${r}" component={${r}Screen} />`);
      expect(nav).toMatch(new RegExp(`\\n  ${r}: `));
    }
  });

  it('chaque route Explorer est atteignable : bloc de l’Accueil ou lien depuis un écran de la pile', () => {
    const reach: Record<string, string> = {
      BoxDirectory: 'screens/home/HomeExplorerBlock.tsx', Programmation: 'screens/home/HomeExplorerBlock.tsx', Partners: 'screens/home/HomeExplorerBlock.tsx',
      BoxDirectoryMap: 'screens/explorer/BoxDirectoryScreen.tsx', BoxDirectoryDetail: 'screens/explorer/BoxDirectoryScreen.tsx',
      PartnerDetail: 'screens/explorer/PartnersScreen.tsx', BoxPrograms: 'screens/explorer/ProgrammationScreen.tsx',
    };
    for (const r of EXPLORER_ROUTES) expect(read(reach[r])).toMatch(new RegExp(`['"]${r}['"]`));
  });

  it('le générateur mène aux Programmes par l’onglet Accueil', () => {
    expect(read('screens', 'wod', 'WodGeneratorScreen.tsx')).toContain("navigation.navigate('Home', { screen: 'Programmation' })");
  });

  it('le bloc Explorer de l’Accueil est placé après « Cette semaine » et avant « Outils »', () => {
    const home = read('screens', 'home', 'HomeScreen.tsx');
    const week = home.indexOf("t('home.thisWeek");
    const explorer = home.indexOf("t('home.explorer.title')");
    const block = home.indexOf('<HomeExplorerBlock onOpen={(route) => navigation.navigate(route)} />');
    const tools = home.indexOf("t('home.tools.title')");
    expect(week).toBeGreaterThan(-1);
    expect(explorer).toBeGreaterThan(week);
    expect(block).toBeGreaterThan(explorer);
    expect(tools).toBeGreaterThan(block);
  });
});

describe('vocabulaire des nouveaux écrans', () => {
  const files = ['screens/training/TrainingScreen.tsx', 'screens/training/quickGenerate.ts', 'screens/training/lastSession.ts', 'screens/home/HomeExplorerBlock.tsx'];
  it('aucun « CrossFit » / « Hyrox », aucun emoji ; icônes lucide uniquement', () => {
    for (const f of files) {
      const s = read(f);
      expect(s).not.toMatch(/crossfit|hyrox/i);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
      const icons = [...s.matchAll(/from '([^']*icon[^']*)'/gi)].map((m) => m[1]);
      expect(icons.every((m) => m === 'lucide-react-native')).toBe(true);
    }
    for (const lang of ['fr', 'en']) {
      const d = JSON.parse(read('i18n', 'locales', `${lang}.json`));
      const blob = JSON.stringify([d.training, d.home.explorer, d.tabs.training]);
      expect(blob).not.toMatch(/crossfit|hyrox/i);
      expect(d.training.disciplines).toEqual({ functional: 'Functional', hybrid: 'Hybrid', musculation: 'Musculation' });
    }
  });

  it('les textes visibles passent par des clés présentes en FR et en EN', () => {
    const fr = JSON.parse(read('i18n', 'locales', 'fr.json'));
    const en = JSON.parse(read('i18n', 'locales', 'en.json'));
    const get = (d: Record<string, unknown>, k: string) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], d);
    for (const f of ['screens/training/TrainingScreen.tsx', 'screens/home/HomeExplorerBlock.tsx']) {
      const s = read(f);
      const keys = [...s.matchAll(/'((?:training|home\.explorer)\.[\w.]+)'/g)].map((m) => m[1]);
      expect(keys.length).toBeGreaterThanOrEqual(3);
      for (const k of keys) for (const d of [fr, en]) expect([k, typeof (get(d, k) ?? get(d, `${k}_one`))]).toEqual([k, 'string']);
      expect(s).not.toMatch(/<Text[^>]*>[^<{]*[A-Za-zÀ-ÿ][^<{]*<\/Text>/);
      expect(s).not.toMatch(/label="[^"]+"/);
    }
    expect(fr.training.subtitle).toBe('Génère, chronomètre et retrouve tes séances');
    expect(fr.training.generate.button).toBe('Générer mon WOD');
    expect(fr.training.generate.moreOptions).toBe("Plus d'options : format, intention, matériel");
  });
});
