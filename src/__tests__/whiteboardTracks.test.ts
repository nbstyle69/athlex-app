/**
 * Onglets de piste du Whiteboard (brief §1.3 / §1.4).
 *
 * Le filtre est de la logique pure : c'est elle qu'on mesure ici, plus la
 * lisibilité des teintes d'onglet dans les deux thèmes — un accent choisi à
 * l'œil sur fond sombre passe sous le seuil sur une carte claire.
 */
import fs from 'fs';
import path from 'path';
import {
  TrackTab, filterByTab, resolveTab, tabAccent, visibleTabs, whiteboardTrackKey,
} from '../utils/whiteboardTracks';
import { isPurgedAtSignOut } from '../lib/storageKeys';
import { lightTheme, darkTheme, AppTheme } from '../theme/palette';
import { contrast } from '../theme/contrast';

type Carte = { id: string; track?: string | null };

/** Un jour de box à trois pistes, plus deux WODs saisis par le coach. */
const JOUR: Carte[] = [
  { id: 'f1', track: 'functional' },
  { id: 'f2', track: 'functional' },
  { id: 'f3', track: 'functional' },
  { id: 'h1', track: 'hybrid' },
  { id: 'h2', track: 'hybrid' },
  { id: 'm1', track: 'musculation' },
  { id: 'c1', track: null },
  { id: 'c2', track: null },
];

const TABS = visibleTabs(JOUR.map((c) => c.track));

describe('onglets d\'une box à trois pistes', () => {
  it('rend les trois pistes, « Box » et « Tout », dans cet ordre', () => {
    expect(TABS).toEqual(['functional', 'hybrid', 'musculation', 'box', 'all']);
  });

  it('chaque onglet montre le bon nombre de cartes', () => {
    expect(filterByTab(JOUR, 'functional')).toHaveLength(3);
    expect(filterByTab(JOUR, 'hybrid')).toHaveLength(2);
    expect(filterByTab(JOUR, 'musculation')).toHaveLength(1);
    expect(filterByTab(JOUR, 'box')).toHaveLength(2);
    expect(filterByTab(JOUR, 'all')).toHaveLength(8);
  });

  it('la somme des onglets égale « Tout », sans doublon ni oubli', () => {
    const repartis = (['functional', 'hybrid', 'musculation', 'box'] as TrackTab[])
      .flatMap((t) => filterByTab(JOUR, t).map((c) => c.id));
    expect(repartis).toHaveLength(filterByTab(JOUR, 'all').length);
    expect(new Set(repartis).size).toBe(JOUR.length);
  });

  it('une carte saisie par le coach n\'apparaît que dans « Box »', () => {
    const ailleurs = (['functional', 'hybrid', 'musculation'] as TrackTab[])
      .flatMap((t) => filterByTab(JOUR, t).map((c) => c.id));
    expect(ailleurs).not.toContain('c1');
    expect(filterByTab(JOUR, 'box').map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('une box sans piste sur la semaine n\'a pas de barre du tout', () => {
    expect(visibleTabs([null, null])).toEqual([]);
  });

  it('« Box » disparaît quand le coach n\'a rien saisi cette semaine', () => {
    expect(visibleTabs(['functional', 'hybrid'])).toEqual(['functional', 'hybrid', 'all']);
  });
});

describe('onglet par défaut et mémorisation', () => {
  it('un athlète neuf arrive sur Functional', () => {
    expect(resolveTab(null, TABS)).toBe('functional');
  });

  it('un athlète qui a choisi Hybrid retrouve Hybrid', () => {
    expect(resolveTab('hybrid', TABS)).toBe('hybrid');
  });

  it('un onglet mémorisé sans contenu cette semaine se replie sur Functional', () => {
    expect(resolveTab('hybrid', ['functional', 'musculation', 'all'])).toBe('functional');
  });

  it('… puis sur « Tout » quand Functional non plus n\'a rien', () => {
    expect(resolveTab('hybrid', ['musculation', 'box', 'all'])).toBe('all');
  });

  it('pas de barre → pas d\'onglet courant', () => {
    expect(resolveTab('hybrid', [])).toBeNull();
  });

  it('une valeur locale corrompue ne devient jamais l\'onglet courant', () => {
    expect(resolveTab('crossfit', TABS)).toBe('functional');
  });

  it('la clé est propre à la box et part à la déconnexion', () => {
    expect(whiteboardTrackKey('box-1')).toBe('@athlex:whiteboardTrack:box-1');
    expect(whiteboardTrackKey('box-1')).not.toBe(whiteboardTrackKey('box-2'));
    expect(isPurgedAtSignOut(whiteboardTrackKey('box-1'))).toBe(true);
  });
});

describe('repli quand la colonne track n\'existe pas encore', () => {
  // La migration 20261223 pas encore appliquée : la requête de semaine échoue
  // (42703) et rend zéro piste ; les cartes du jour, elles, arrivent par
  // `select('*')` sans le champ. Toutes doivent rester visibles.
  const sansColonne: Carte[] = JOUR.map(({ id }) => ({ id }));

  it('aucune barre, et l\'écran montre toutes les cartes', () => {
    const tabs = visibleTabs([]);
    expect(tabs).toEqual([]);
    expect(resolveTab(null, tabs)).toBeNull();
    expect(filterByTab(sansColonne, 'all')).toHaveLength(JOUR.length);
  });

  it('une carte sans champ track compte comme carte de box, pas comme piste inconnue', () => {
    expect(filterByTab(sansColonne, 'box')).toHaveLength(JOUR.length);
    expect(filterByTab(sansColonne, 'functional')).toHaveLength(0);
  });
});

describe('teintes des onglets — lisibles dans les deux thèmes', () => {
  const THEMES: [string, AppTheme][] = [['clair', lightTheme], ['sombre', darkTheme]];
  const TOUS: TrackTab[] = ['functional', 'hybrid', 'musculation', 'box', 'all'];

  describe.each(THEMES)('thème %s', (_nom, t) => {
    it.each(TOUS)('l\'encre de l\'onglet « %s » actif reste lisible sur son fond', (tab) => {
      const accent = tabAccent(t, tab);
      expect(contrast(t.text, `${accent}25`, t.background)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(TOUS)('la bordure de l\'onglet « %s » actif se voit', (tab) => {
      expect(contrast(tabAccent(t, tab), t.background)).toBeGreaterThanOrEqual(3);
    });

    it('l\'encre d\'un onglet inactif est celle des cartes, donc lisible', () => {
      expect(contrast(t.text, t.card, t.background)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('en thème sombre, les teintes sont exactement celles du générateur de WOD', () => {
    // Le brief demande « la couleur de la discipline dans le générateur » :
    // vert Functional, orange Hybrid, bleu Musculation.
    expect(tabAccent(darkTheme, 'hybrid')).toBe('#F97316');
    expect(tabAccent(darkTheme, 'musculation')).toBe('#3B82F6');
    expect(tabAccent(darkTheme, 'functional')).toBe('#10B981');
  });

  it('en thème clair, elles sont assombries — la teinte du sombre y serait illisible', () => {
    expect(contrast('#F97316', lightTheme.background)).toBeLessThan(3);
    expect(tabAccent(lightTheme, 'hybrid')).not.toBe('#F97316');
  });
});

describe('place de la barre dans l\'écran', () => {
  const ecran = fs.readFileSync(
    path.join(__dirname, '../screens/whiteboard/WhiteboardScreen.tsx'), 'utf8',
  );

  it('sous les raccourcis et au-dessus du sélecteur de jours', () => {
    const raccourcis = ecran.indexOf('whiteboard.boxRanking');
    const barre = ecran.indexOf('<WhiteboardTrackTabs');
    // Le premier sélecteur de jours de l'écran est celui de la branche « sans
    // box » (séances perso), qui n'a pas de piste : c'est celui du Whiteboard
    // de box, juste après la barre, qu'on situe ici.
    const jours = ecran.indexOf('<WeekDayPicker', barre);
    expect(raccourcis).toBeGreaterThan(-1);
    expect(barre).toBeGreaterThan(raccourcis);
    expect(jours).toBeGreaterThan(barre);
  });

  it('la barre n\'est rendue qu\'une fois, sur le Whiteboard de box', () => {
    expect(ecran.split('<WhiteboardTrackTabs')).toHaveLength(2);
  });

  it('le filtre porte sur toute la partie basse : raccourcis du jour et cartes', () => {
    // `mainWod` commande « Entrer mon score » et « Classement » : il doit être
    // choisi dans la liste filtrée, sinon les boutons pointent une autre piste.
    expect(ecran).toMatch(/const mainWod =\s*\n\s*shownWODs\.find/);
    expect(ecran).toContain('{shownWODs.map((wod, idx) =>');
  });
});
