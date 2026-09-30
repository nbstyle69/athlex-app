import fs from 'fs';
import path from 'path';
import { lightTheme, darkTheme, AppTheme, ThemeMode } from '../theme/palette';
import { contrast } from '../theme/contrast';

/**
 * Le fond de coque de la navigation était figé à `#0a0a0a` : en mode clair,
 * l'encre claire des écrans sans fond propre s'écrivait sur du noir — le titre
 * « Notifications » mesurait 1,12:1. Ce contrôle exige que la coque suive le
 * thème, et mesure les jetons d'encre sur le fond qu'ils reçoivent vraiment.
 *
 * Il porte aussi la mesure qui explique la forme retenue : sur le dégradé animé
 * (`GlassBackground`), l'encre atténuée ne tient 4,5:1 que **posée sur une
 * carte**. Un écran qui monte le dégradé écrit donc ses sous-titres dans des
 * cartes, jamais à même le fond.
 */

const TEXT_MIN = 4.5;
const ROOT = path.resolve(__dirname, '..', '..');
const NAV = fs.readFileSync(path.join(ROOT, 'src/navigation/index.tsx'), 'utf8');
const NOTIF = fs.readFileSync(
  path.join(ROOT, 'src/screens/settings/NotificationSettingsScreen.tsx'),
  'utf8',
);
const GLASS = fs.readFileSync(
  path.join(ROOT, 'src/components/glass/GlassBackground.tsx'),
  'utf8',
);

const THEMES: [ThemeMode, AppTheme][] = [
  ['light', lightTheme],
  ['dark', darkTheme],
];

describe('coque de navigation — le fond suit le thème', () => {
  it('aucun fond de coque en dur', () => {
    expect(NAV).not.toMatch(/contentStyle: \{ backgroundColor: '#[0-9a-fA-F]{3,8}' \}/);
    expect(NAV).not.toMatch(/background: '#0a0a0a',\s*\n\s*card: '#0a0a0a'/);
  });

  it('chaque pile prend ses options de coque du thème', () => {
    const stacks = NAV.match(/<\w*Stack\.Navigator screenOptions=\{[^}]*\}/g) ?? [];
    expect(stacks.length).toBeGreaterThan(0);
    for (const opts of stacks) {
      expect(opts).toMatch(/screenOptions=\{shell\}$/);
    }
    expect(NAV).toMatch(/backgroundColor: theme\.background/);
    expect(NAV).toMatch(/navThemeFor\(mode, theme\.background\)/);
  });

  it('les deux thèmes ne donnent pas la même coque', () => {
    expect(lightTheme.background).not.toBe(darkTheme.background);
  });
});

describe('écran Notifications — lisible sur le fond qu\'il reçoit', () => {
  it('sa racine monte le fond de coque et ne repeint pas un fond plein par-dessus', () => {
    expect(NOTIF).toMatch(/screen: \{ flex: 1, backgroundColor: 'transparent' \}/);
    expect(NOTIF).toMatch(/<GlassBackground \/>/);
  });

  describe.each(THEMES)('thème %s', (_mode, t) => {
    it('le titre est lisible sur la coque', () => {
      expect(contrast(t.text, t.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it('les sous-titres de réglages sont lisibles sur la coque', () => {
      expect(contrast(t.textMuted, t.background)).toBeGreaterThanOrEqual(TEXT_MIN);
      expect(contrast(t.textSecondary, t.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it('les cartes de réglages restent lisibles sur cette coque', () => {
      expect(contrast(t.textMuted, t.card, t.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    });
  });
});

describe('R14a : GlassBackground est un fond uni theme.ax.background', () => {
  it('plus de dégradé, de taches ni d\'animation dans le composant', () => {
    expect(GLASS).not.toMatch(/LinearGradient|react-native-svg|Animated|RadialGradient|Circle/);
    expect(GLASS).toMatch(/backgroundColor: theme\.ax\.background/);
  });

  it.each(THEMES)('thème %s : cartes et encres lisibles sur le fond uni', (_mode, t) => {
    expect(contrast(t.text, t.ax.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.textMuted, t.ax.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.textMuted, t.card, t.ax.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.accentText, t.card, t.ax.background)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it('le contrôle mord : l\'ancien arrêt sombre #14532d échouait sur carte translucide', () => {
    expect(contrast('#94a3b8', 'rgba(255,255,255,0.06)', '#14532d')).toBeLessThan(TEXT_MIN);
  });
});
