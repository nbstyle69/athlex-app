import fs from 'fs';
import path from 'path';
import { axColors } from '../theme/axTokens';
import { LevelColors } from '../theme/designTokens';
import { HUES } from '../theme/hues';
import { lightTheme, darkTheme } from '../theme/palette';
import { contrast } from '../theme/contrast';

/**
 * R14a : fond uni et palette du nouveau design partout. Plus aucune couleur de
 * l'ancienne identité émeraude dans src/, chrono plein écran compris ; seules les
 * définitions de TIMER_THEMES (thèmes de chrono choisis par l'athlète) sont exclues.
 */

const SRC = path.resolve(__dirname, '..');
const TIMER_INK = path.join(SRC, 'theme', 'timerInk.ts');
const TEXT_MIN = 4.5;
const GLYPH_MIN = 3;

export const LEGACY_EMERALD =
  /#(?:10b981|34d399|059669|047857|022c22|0d1f17|0b2e1a|6ee7b7|065f46|064e3b|1a3d2e)\b|rgba\(\s*(?:16,\s*185,\s*129|5,\s*150,\s*105|52,\s*211,\s*153|110,\s*231,\s*183|4,\s*120,\s*87)\s*,/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === '__mocks__') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|json)$/.test(e.name)) out.push(full);
  }
  return out;
}

/** Retire le tableau TIMER_THEMES de timerInk.ts ; le reste du fichier est scanné. */
export function withoutTimerThemes(src: string): string {
  const start = src.indexOf('export const TIMER_THEMES');
  if (start < 0) return src;
  const end = src.indexOf('\n];', start);
  return src.slice(0, start) + src.slice(end + 3);
}

const scanned = (f: string) => {
  const src = fs.readFileSync(f, 'utf8');
  return f === TIMER_INK ? withoutTimerThemes(src) : src;
};

describe('R14a : plus aucune couleur émeraude de l\'ancienne identité dans src/', () => {
  const files = walk(SRC);

  it('la recherche couvre bien src/', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('le chrono plein écran et la vidéo sont scannés', () => {
    expect(files).toContain(path.join(SRC, 'screens', 'timer', 'TimerRunScreen.tsx'));
    expect(files).toContain(path.join(SRC, 'screens', 'timer', 'VideoPlaybackScreen.tsx'));
    expect(files).toContain(TIMER_INK);
  });

  it('aucun fichier (hors définitions de TIMER_THEMES) ne contient d\'émeraude', () => {
    const offenders = files
      .filter((f) => LEGACY_EMERALD.test(scanned(f)))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it('le motif mord : il reconnaît les anciennes valeurs', () => {
    for (const v of ["'#10B981'", "'#34d399'", "'#022c22'", "'rgba(16,185,129,0.25)'", "'rgba(52, 211, 153, 0.3)'"]) {
      expect(LEGACY_EMERALD.test(v)).toBe(true);
    }
    expect(LEGACY_EMERALD.test("'#9AE6D2'")).toBe(false);
  });

  it('seul le tableau TIMER_THEMES est exclu de timerInk.ts', () => {
    const src = "const A = '#10b981';\nexport const TIMER_THEMES: T[] = [\n  { accent: '#10b981' },\n];\nconst B = 1;";
    const kept = withoutTimerThemes(src);
    expect(kept).toContain("const A = '#10b981';");
    expect(kept).toContain('const B = 1;');
    expect(kept).not.toContain("{ accent: '#10b981' }");
    expect(withoutTimerThemes(fs.readFileSync(TIMER_INK, 'utf8'))).toContain('export function appTimerThemeId');
  });
});

describe('R14a : contraste AA des couples texte / fond modifiés', () => {
  const d = axColors.dark;

  it('Toast (surface sombre) : texte et icônes de statut', () => {
    expect(contrast(d.text, d.surface)).toBeGreaterThanOrEqual(TEXT_MIN);
    for (const k of ['success', 'danger', 'warning', 'info'] as const) {
      expect(contrast(d[k], d.surface)).toBeGreaterThanOrEqual(GLYPH_MIN);
    }
  });

  it('Mise à jour obligatoire (fond sombre) : titres, sous-titre et bouton', () => {
    expect(contrast(d.text, d.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(d.textMuted, d.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(d.onAccent, d.accent)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it.each([['clair', lightTheme], ['sombre', darkTheme]] as const)('%s : cartes, CTA, onglets et bordures accent', (_m, t) => {
    expect(contrast(t.text, t.card, t.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.textMuted, t.card, t.background)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.ctaText, t.ctaBg)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.accent, t.card)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.tabBarActive, t.tabBar)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.tabBarInactive, t.tabBar)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast(t.ax.accentText, t.ax.surface)).toBeGreaterThanOrEqual(GLYPH_MIN);
  });

  it.each([['clair', lightTheme], ['sombre', darkTheme]] as const)('%s : teintes de domaine retouchées lisibles en texte sur carte', (_m, t) => {
    for (const name of ['emerald', 'blue', 'red', 'negative'] as const) {
      expect(contrast(HUES[name][t.mode], t.card)).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });

  it('palier elite lisible sur carte sombre et claire (glyphe)', () => {
    expect(contrast(LevelColors.elite, darkTheme.card)).toBeGreaterThanOrEqual(GLYPH_MIN);
    expect(contrast(LevelColors.elite, lightTheme.card)).toBeGreaterThanOrEqual(GLYPH_MIN);
  });
});
