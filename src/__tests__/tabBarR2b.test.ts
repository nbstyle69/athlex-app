/**
 * Refonte R2b : la barre d'onglets de l'athlète devient la barre flottante ax
 * (apparence seule). Contrôles de source : branchement dans MainTabs, barres
 * gérant et coach inchangées, aucune couleur en dur, et chaque écran des piles
 * de l'athlète réserve en bas l'espace commun au-dessus de la barre.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(__dirname, '..');
const nav = fs.readFileSync(path.join(SRC, 'navigation/index.tsx'), 'utf8');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

function block(name: string): string {
  const start = nav.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const end = nav.indexOf('\n}\n', start);
  return nav.slice(start, end);
}

describe('MainTabs : barre flottante ax', () => {
  const main = block('MainTabs');

  it('la barre est AxTabBar, masquée clavier ouvert, et publie son encombrement avec l\'inset', () => {
    expect(main).toMatch(/tabBar=\{\(props\) => <AxTabBar \{\.\.\.props\} \/>\}/);
    expect(main).toMatch(/tabBarHideOnKeyboard: true/);
    expect(main).toMatch(/tabBarStyle: \{ height: tabBarFootprint\(insets\.bottom\) \}/);
  });

  it('l\'ancien fond et les anciennes teintes ne sont plus utilisés par la barre athlète', () => {
    expect(main).not.toMatch(/GlassTabBarBackground|tabBarActiveTintColor|tabBarInactiveTintColor|tabBarLabelStyle/);
    expect(main).not.toMatch(/iconSize = 22/);
  });

  it('les icônes suivent la taille fournie par la barre (20)', () => {
    expect(main).toMatch(/Training: +<Dumbbell color=\{color\} size=\{size\} \/>/);
  });
});

describe('barres gérant et coach inchangées', () => {
  it.each(['BoxOwnerTabs', 'CoachTabs'])('%s garde sa barre standard', (name) => {
    const b = block(name);
    expect(b).toMatch(/tabBarBackground: \(\) => <GlassTabBarBackground \/>/);
    expect(b).toMatch(/height: 60 \+ insets\.bottom/);
    expect(b).toMatch(/paddingBottom: 10 \+ insets\.bottom/);
    expect(b).toMatch(/tabBarActiveTintColor: theme\.tabBarActive/);
    expect(b).not.toMatch(/AxTabBar|tabBar=|tabBarHideOnKeyboard/);
  });
});

describe('aucune couleur en dur', () => {
  it.each(['navigation/AxTabBar.tsx', 'navigation/tabBarLayout.ts'])('%s tire ses couleurs de theme.ax', (rel) => {
    const s = read(rel);
    expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|'(white|black)'/);
  });
});

describe('espace réservé en bas des écrans de l\'athlète', () => {
  const STACKS = ['CompetitionNavigator', 'TrainingNavigator', 'HomeNavigator', 'WhiteboardNavigator', 'ReservationNavigator'];
  const components = new Set<string>();
  STACKS.forEach((s) => {
    for (const m of block(s).matchAll(/component=\{([^}]+)\}/g)) {
      for (const id of m[1].match(/\b[A-Z]\w*Screen\b/g) ?? []) components.add(id);
    }
  });
  const fileOf = (id: string) => {
    const m = nav.match(new RegExp(`import ${id}\\b[^;]* from '\\.\\./(screens/[^']+)'`));
    return m ? `${m[1]}.tsx` : null;
  };
  /** Écrans sans contenu défilant sous la barre, avec la preuve de leur mécanisme propre. */
  const OWN: Record<string, RegExp> = {
    TimerRunScreen: /tabBarStyle: \{ display: 'none' \}/,
    VideoPlaybackScreen: /tabBarStyle: \{ display: 'none' \}/,
    WodResultScreen: /useBottomTabBarHeight\(\)/,
    MessagesScreen: /useBottomTabBarHeight\(\)/,
    ProgrammationScreen: /^(?![\s\S]*(ScrollView|FlatList))/,
  };

  it('les piles de l\'athlète déclarent bien leurs écrans', () => {
    expect(components.size).toBeGreaterThanOrEqual(40);
  });

  it('chaque écran utilise l\'utilitaire commun et aucune marge basse recopiée', () => {
    const missing: string[] = [];
    for (const id of components) {
      if (id === 'AxCatalogScreen') continue;
      const rel = fileOf(id);
      expect(rel).not.toBeNull();
      const s = read(rel!);
      if (OWN[id]) {
        if (!OWN[id].test(s)) missing.push(`${id} (mécanisme propre absent)`);
        continue;
      }
      if (!/useTabBarScrollSpace\(\)/.test(s)) missing.push(id);
      if (/contentContainerStyle=\{\{[^}]*paddingBottom: \d{3}/.test(s)) missing.push(`${id} (valeur recopiée)`);
    }
    expect(missing).toEqual([]);
  });

  it.each([
    ['explorer/BoxDirectoryMapScreen.tsx', /style=\{\[s\.sheet, \{ paddingBottom: tabSpace \}\]\}/],
    ['whiteboard/ArticlesScreen.tsx', /\[S\.commentInput, tabFootprint > 0 && \{ bottom: tabFootprint/],
    ['home/HomeScreen.tsx', /S\.badgePopupWrap, \{\n\s+bottom: tabSpace,/],
    ['wod/WodGeneratorScreen.tsx', /\[S\.content, \{ paddingBottom: tabSpace \}\]/],
    ['reservation/ReservationScreen.tsx', /contentContainerStyle=\{\{ paddingBottom: tabSpace \}\}/],
    ['competition/TournamentWODScreen.tsx', /const scrollPadBottom = tabSpace;/],
  ])('%s : les éléments du bas restent au-dessus de la barre', (rel, re) => {
    expect(read(`screens/${rel}`)).toMatch(re);
  });
});
