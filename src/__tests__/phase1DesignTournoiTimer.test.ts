import fs from 'fs';
import path from 'path';
import { contrast } from '../theme/contrast';
import { lightTheme, darkTheme } from '../theme/palette';

const SCREENS = path.resolve(__dirname, '..', 'screens');
const read = (rel: string): string => fs.readFileSync(path.join(SCREENS, rel), 'utf8');

const TIMER = read('timer/TimerScreen.tsx');
const TOURNOI = read('competition/TournamentScreen.tsx');

const TEXT_MIN = 4.5;
const GLYPH_MIN = 3;
/** Arrêt le plus contraignant du dégradé clair sous les commandes du minuteur. */
const GRAD_LIGHT = '#f1f5f9';
const GRAD_DARK = '#0d1f17';
/** Arrêt le plus clair de l'en-tête du tournoi : celui qui laisse le moins de marge. */

describe('minuteur — encre des commandes', () => {
  it('aucune encre blanche en dur ne subsiste', () => {
    expect(TIMER).not.toMatch(/'#fff'|'#FFF'|'#ffffff'|'#FFFFFF'/);
    expect(TIMER).not.toMatch(/color="#fff"/);
    expect(TIMER).not.toMatch(/rgba\(255,255,255/);
  });

  it('les aplats d’accent portent onAccent, pas du blanc', () => {
    // Accent clair de master (#94a3b8) ; en R14a l'aplat d'accent des composants ax est la menthe.
    expect(contrast('#FFFFFF', '#94a3b8')).toBeLessThan(TEXT_MIN);
    expect(contrast('#FFFFFF', darkTheme.accent)).toBeLessThan(TEXT_MIN);
    expect(contrast('#FFFFFF', lightTheme.ax.accent)).toBeLessThan(TEXT_MIN);
    expect(contrast(lightTheme.onAccent, lightTheme.accent)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(darkTheme.onAccent, darkTheme.accent)).toBeGreaterThanOrEqual(TEXT_MIN);
    // R5a : les choix passent par AxChip / AxSwitch, dont l'encre sur accent est onAccent.
    expect(TIMER).toMatch(/<AxChip /);
    expect(TIMER).toMatch(/<AxSwitch /);
    expect(TIMER).toMatch(/seqBlockNumText: \{[^}]*color: c\.onAccent/);
  });

  it('DÉMARRER est posé sur un CTA translucide : son encre est theme.text', () => {
    // Le bouton est un aplat d'accent à 28 % sur le dégradé.
    const cta = `${lightTheme.accent}28`;
    expect(contrast('#FFFFFF', cta, GRAD_LIGHT)).toBeLessThan(2);
    expect(contrast(lightTheme.text, cta, GRAD_LIGHT)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(darkTheme.text, `${darkTheme.accent}28`, GRAD_DARK)).toBeGreaterThanOrEqual(TEXT_MIN);
    // R5a : DÉMARRER est un AxButton accent plein (encre onAccent, prouvée AA dans axComponents).
    expect(TIMER).toMatch(/<AxButton label=\{t\('wodGenerator\.start'\)\} variant="accent"/);
    expect(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'i18n', 'locales', 'fr.json'), 'utf8')).wodGenerator.start).toBe('Démarrer');
  });

  it('l’accent ne sert plus d’encre : accentText sur carte et sur dégradé', () => {
    expect(contrast(lightTheme.ax.accent, lightTheme.card, GRAD_LIGHT)).toBeLessThan(GLYPH_MIN);
    expect(contrast(lightTheme.accentText, lightTheme.card, GRAD_LIGHT)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(darkTheme.accentText, darkTheme.card, GRAD_DARK)).toBeGreaterThanOrEqual(GLYPH_MIN);
    expect(TIMER).not.toMatch(/color: theme\.accent[,\s}]/);
    expect(TIMER).not.toMatch(/color=\{theme\.accent\}/);
  });

  it('les libellés et la poignée sortent du blanc translucide invisible', () => {
    expect(contrast('rgba(255,255,255,0.5)', GRAD_LIGHT)).toBeLessThan(1.5);
    expect(contrast(lightTheme.textMuted, GRAD_LIGHT)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast('rgba(255,255,255,0.2)', lightTheme.modalCard)).toBeLessThan(1.5);
    expect(contrast(lightTheme.textMuted, lightTheme.modalCard)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it('le bouton secondaire ne repose plus sur un aplat de page', () => {
    expect(TIMER).not.toMatch(/backgroundColor: theme\.background/);
  });
});

describe('détail tournoi — en-tête', () => {
  it('R8a : l’en-tête est une carte ax mise en avant, plus un dégradé codé en dur', () => {
    expect(TOURNOI).toMatch(/<AxCard variant="featured" testID="tournament-header"/);
    expect(TOURNOI).not.toMatch(/HEADER_GRADIENT|LinearGradient|#0d1f17|#022c22|#12121A|#0A0A0F/);
  });

  it('R8a : l’encre de l’en-tête vient des jetons ax, lisible (AA) sur la carte dans les deux thèmes', () => {
    expect(TOURNOI).not.toMatch(/darkTheme\./);
    for (const th of [lightTheme, darkTheme]) {
      expect(contrast(th.ax.text, th.ax.surface)).toBeGreaterThanOrEqual(TEXT_MIN);
      expect(contrast(th.ax.textMuted, th.ax.surface)).toBeGreaterThanOrEqual(TEXT_MIN);
      expect(contrast(th.ax.accentText, th.ax.surface)).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });

  it('le corps de l’écran reste sur la coque de verre', () => {
    expect(TOURNOI).toMatch(/<GlassBackground \/>/);
    expect(TOURNOI).toMatch(/container: *\{ flex: 1, backgroundColor: 'transparent' \}/);
  });
});
