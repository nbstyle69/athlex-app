import { axColors } from '../theme/axTokens';
import { lightTheme, darkTheme, ThemeMode } from '../theme/palette';
import { contrast } from '../theme/contrast';
import { wodTypeColor } from '../theme/wodTypeColor';

/** Valeurs de la maquette (Figma 630:72542, « Étiquette · Type de séance »). */
const EXPECTED: Record<string, Record<ThemeMode, string>> = {
  'for-time': { dark: '#EAB308', light: '#9A5D06' },
  amrap: { dark: '#60A5FA', light: '#1D4ED8' },
  emom: { dark: '#A78BFA', light: '#6D28D9' },
  tabata: { dark: '#22C55E', light: '#15803D' },
  strength: { dark: '#9AE6D2', light: '#176B57' },
  custom: { dark: '#989FA3', light: '#52605B' },
};
const MODES: ThemeMode[] = ['dark', 'light'];

describe('wodTypeColor', () => {
  it.each(Object.keys(EXPECTED).flatMap((type) => MODES.map((mode) => [type, mode] as const)))('%s en %s', (type, mode) => {
    expect(wodTypeColor(type, mode, axColors[mode])).toBe(EXPECTED[type][mode]);
  });

  it.each(MODES)('alias, casse et espaces (%s)', (mode) => {
    const ax = axColors[mode];
    for (const alias of ['for_time', 'fortime', ' For-Time ', 'FOR_TIME']) expect(wodTypeColor(alias, mode, ax)).toBe(EXPECTED['for-time'][mode]);
    expect(wodTypeColor('EMOM', mode, ax)).toBe(EXPECTED.emom[mode]);
  });

  it.each(MODES)('null, vide ou inconnu : texte atténué (%s)', (mode) => {
    const ax = axColors[mode];
    for (const type of [null, undefined, '', '  ', 'skill']) expect(wodTypeColor(type, mode, ax)).toBe(ax.textMuted);
  });

  it('EMOM reste le violet des teintes de domaine, pas axColors.violet', () => {
    expect(wodTypeColor('emom', 'dark', axColors.dark)).not.toBe(axColors.dark.violet);
  });
});

describe.each([['dark', darkTheme], ['light', lightTheme]] as const)('contraste des étiquettes de type — %s', (mode, t) => {
  it.each(Object.keys(EXPECTED))('%s ≥ 4,5:1 sur la surface des cartes', (type) => {
    const ink = wodTypeColor(type, mode, t.ax);
    expect(contrast(ink, t.ax.surface, t.ax.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.keys(EXPECTED))('%s ≥ 4,5:1 sur le fond (feuille du détail d’un programme)', (type) => {
    expect(contrast(wodTypeColor(type, mode, t.ax), t.ax.background)).toBeGreaterThanOrEqual(4.5);
  });
});
