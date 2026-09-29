/**
 * Bibliothèque ax (refonte, lot R1), montée avec le vrai react-native.
 * Vérifie que chaque composant tire ses couleurs de theme.ax dans les deux
 * thèmes, ses états d'accessibilité et ses rappels, le repli Android du verre,
 * le contraste des couples texte / fond, et qu'aucun écran existant ne
 * l'importe encore.
 */
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { ActivityIndicator, Animated, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { Play } from 'lucide-react-native';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import { axColors } from '../theme/axTokens';
import { contrast } from '../theme/contrast';
import { R3C_SCREENS } from './r3cScreens';
import {
  AxButton, AxCard, AxCheckbox, AxChip, AxDayItem, AxGlass, AxSwitch, AxTextField, withAlpha,
  resolveGlassOpacity, type AxButtonVariant,
} from '../components/ax';

let mockTheme: AppTheme = lightTheme;
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme, toggleTheme: () => {} }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));

const originalOS = Platform.OS;
let renderer: TestRenderer.ReactTestRenderer | null = null;

afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

async function mount(el: React.ReactElement, theme: AppTheme = lightTheme) {
  mockTheme = theme;
  await act(async () => {
    renderer = TestRenderer.create(el);
  });
  return renderer!.root;
}

const flat = (i: ReactTestInstance) => StyleSheet.flatten(i.props.style) ?? {};
const pressable = (root: ReactTestInstance) =>
  root.findAll((n) => typeof n.type !== 'string' && n.props.accessibilityRole !== undefined && n.props.accessibilityRole !== 'header')[0];
const glasses = (root: ReactTestInstance) => root.findAllByType(AxGlass).map((g) => ({ color: g.props.color, opacity: g.props.opacity }));
const textColor = (root: ReactTestInstance, i = 0) => flat(root.findAllByType(Text)[i]).color;
const THEMES = [darkTheme, lightTheme];

describe('AxButton', () => {
  const expected = (c: AppTheme['ax']): Record<AxButtonVariant, {
    glass: { color: string; opacity: number }[]; bg?: string; border?: [number, string]; fg: string;
  }> => ({
    accent: { glass: [{ color: c.accent, opacity: 0.88 }], fg: c.onAccent },
    outline: { glass: [{ color: c.text, opacity: 0.08 }], border: [1, c.border], fg: c.text },
    light: { glass: [], bg: c.text, fg: c.background },
    dashed: { glass: [], fg: c.accentText },
    stop: { glass: [{ color: c.danger, opacity: 0.12 }], border: [1, c.danger], fg: c.danger },
  });

  for (const theme of THEMES) {
    for (const variant of ['accent', 'outline', 'light', 'dashed', 'stop'] as AxButtonVariant[]) {
      it(`${theme.mode} / ${variant} : verre, fond, bordure et encre tirés de theme.ax`, async () => {
        const e = expected(theme.ax)[variant];
        const root = await mount(<AxButton variant={variant} label="Go" icon={Play} onPress={() => {}} />, theme);
        const s = flat(pressable(root));
        expect(glasses(root)).toEqual(e.glass);
        expect(s.backgroundColor).toBe(e.bg);
        expect(e.border ? [s.borderWidth, s.borderColor] : s.borderWidth).toEqual(e.border ?? undefined);
        expect(textColor(root)).toBe(e.fg);
        const icon = root.findAll((n) => n.props.testID === 'ax-button-icon' && typeof n.type !== 'string')[0];
        expect(icon.props.color).toBe(e.fg);
        expect(icon.props.size).toBe(16);
      });
    }

    it(`${theme.mode} / dashed : pointillés 1,5 px accentText, tirets 6 espaces 5`, async () => {
      const root = await mount(<AxButton variant="dashed" label="Ajouter" onPress={() => {}} />, theme);
      await act(async () => {
        pressable(root).props.onLayout({ nativeEvent: { layout: { width: 200, height: 46, x: 0, y: 0 } } });
      });
      const rect = root.findAll((n) => n.props.testID === 'ax-button-dash')[0];
      expect(rect.props).toMatchObject({ stroke: theme.ax.accentText, strokeWidth: 1.5, strokeDasharray: '6 5', rx: 5 });
    });
  }

  it('dimensions : rayon 5, padding 13 / 16, écart 8, libellé Inter SemiBold 14', async () => {
    const root = await mount(<AxButton label="Go" onPress={() => {}} />);
    expect(flat(pressable(root))).toMatchObject({ borderRadius: 5, paddingVertical: 13, paddingHorizontal: 16, gap: 8, minHeight: 46 });
    expect(flat(root.findAllByType(Text)[0])).toMatchObject({ fontFamily: 'Inter_600SemiBold', fontSize: 14 });
  });

  it('disabled : opacité 0.5, onPress jamais appelé, accessibilityState.disabled', async () => {
    const onPress = jest.fn();
    const root = await mount(<AxButton label="Go" disabled onPress={onPress} />);
    const p = pressable(root);
    expect(flat(p).opacity).toBe(0.5);
    expect(p.props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => { p.props.onPress?.(); });
    expect(onPress).not.toHaveBeenCalled();
  });

  it('actif : onPress appelé', async () => {
    const onPress = jest.fn();
    const root = await mount(<AxButton label="Go" onPress={onPress} />);
    await act(async () => { pressable(root).props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("loading : ActivityIndicator couleur du libellé à la place de l'icône", async () => {
    const root = await mount(<AxButton label="Go" icon={Play} loading onPress={() => {}} />, darkTheme);
    const spinner = root.findAllByType(ActivityIndicator);
    expect(spinner).toHaveLength(1);
    expect(spinner[0].props.color).toBe(darkTheme.ax.onAccent);
    expect(root.findAll((n) => n.props.testID === 'ax-button-icon')).toHaveLength(0);
  });
});

describe('AxChip', () => {
  for (const theme of THEMES) {
    it(`${theme.mode} : repos puis sélectionné`, async () => {
      const onPress = jest.fn();
      let root = await mount(<AxChip label="Hybrid" onPress={onPress} />, theme);
      expect(glasses(root)).toEqual([{ color: theme.ax.text, opacity: 0.08 }]);
      expect(flat(pressable(root))).toMatchObject({ borderWidth: 1, borderColor: theme.ax.border, borderRadius: 5, paddingVertical: 9, paddingHorizontal: 14 });
      expect(textColor(root)).toBe(theme.ax.text);
      expect(pressable(root).props.accessibilityState).toEqual({ selected: false });
      await act(async () => { pressable(root).props.onPress(); });
      expect(onPress).toHaveBeenCalledTimes(1);

      await act(async () => renderer!.unmount());
      root = await mount(<AxChip label="Hybrid" selected onPress={onPress} />, theme);
      expect(glasses(root)).toEqual([{ color: theme.ax.accent, opacity: 0.88 }]);
      expect(flat(pressable(root)).borderColor).toBe('transparent');
      expect(textColor(root)).toBe(theme.ax.onAccent);
      expect(pressable(root).props.accessibilityState).toEqual({ selected: true });
    });
  }

  it('zone tactile ≥ 44 : hitSlop vertical 2 sur 40 de haut', async () => {
    const root = await mount(<AxChip label="Hybrid" onPress={() => {}} />);
    expect(pressable(root).props.hitSlop).toMatchObject({ top: 2, bottom: 2 });
  });
});

describe('AxSwitch', () => {
  for (const theme of THEMES) {
    it(`${theme.mode} : off piste text / pastille textMuted, on piste accent / pastille onAccent`, async () => {
      const onValueChange = jest.fn();
      let root = await mount(<AxSwitch value={false} onValueChange={onValueChange} accessibilityLabel="Notif" />, theme);
      const thumb = () => flat(root.findAll((n) => n.props.testID === 'ax-switch-thumb' && typeof n.type !== 'string')[0]);
      expect(flat(pressable(root))).toMatchObject({ backgroundColor: theme.ax.text, width: 44, height: 26, borderRadius: 13 });
      expect(thumb()).toMatchObject({ backgroundColor: theme.ax.textMuted, width: 20, height: 20, top: 3, left: 3 });
      expect(pressable(root).props.accessibilityState).toEqual({ checked: false, disabled: false });
      expect(pressable(root).props.accessibilityRole).toBe('switch');
      await act(async () => { pressable(root).props.onPress(); });
      expect(onValueChange).toHaveBeenCalledWith(true);

      await act(async () => renderer!.unmount());
      root = await mount(<AxSwitch value onValueChange={onValueChange} accessibilityLabel="Notif" />, theme);
      expect(flat(pressable(root)).backgroundColor).toBe(theme.ax.accent);
      expect(thumb().backgroundColor).toBe(theme.ax.onAccent);
      expect(pressable(root).props.accessibilityState).toEqual({ checked: true, disabled: false });
    });
  }

  it('animation de glissement de 150 ms', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await mount(<AxSwitch value onValueChange={() => {}} accessibilityLabel="Notif" />);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 150, toValue: 18 }));
  });

  it('disabled : aucun rappel, accessibilityState.disabled, zone tactile ≥ 44', async () => {
    const onValueChange = jest.fn();
    const root = await mount(<AxSwitch value={false} disabled onValueChange={onValueChange} accessibilityLabel="Notif" />);
    const p = pressable(root);
    await act(async () => { p.props.onPress?.(); });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(p.props.accessibilityState).toEqual({ checked: false, disabled: true });
    expect(p.props.hitSlop).toMatchObject({ top: 9, bottom: 9 });
  });
});

describe('AxCheckbox', () => {
  for (const theme of THEMES) {
    it(`${theme.mode} : vide puis cochée, rappel avec la valeur inverse`, async () => {
      const onChange = jest.fn();
      let root = await mount(<AxCheckbox checked={false} onChange={onChange} label="Règlement" />, theme);
      const box = () => flat(root.findAll((n) => n.props.testID === 'ax-checkbox-box' && typeof n.type !== 'string')[0]);
      expect(box()).toMatchObject({ width: 24, height: 24, borderRadius: 5, borderWidth: 1.5, borderColor: theme.ax.fieldBorder, backgroundColor: 'transparent' });
      expect(root.findAll((n) => n.props.testID === 'ax-checkbox-check')).toHaveLength(0);
      expect(pressable(root).props.accessibilityState).toEqual({ checked: false, disabled: false });
      expect(textColor(root)).toBe(theme.ax.text);
      await act(async () => { pressable(root).props.onPress(); });
      expect(onChange).toHaveBeenCalledWith(true);

      await act(async () => renderer!.unmount());
      root = await mount(<AxCheckbox checked onChange={onChange} label="Règlement" />, theme);
      expect(box().backgroundColor).toBe(theme.ax.accent);
      const check = root.findAll((n) => n.props.testID === 'ax-checkbox-check' && typeof n.type !== 'string')[0];
      expect(check.props).toMatchObject({ color: theme.ax.onAccent, size: 16, strokeWidth: 2.5 });
      expect(pressable(root).props.accessibilityState).toEqual({ checked: true, disabled: false });
      await act(async () => { pressable(root).props.onPress(); });
      expect(onChange).toHaveBeenLastCalledWith(false);
    });
  }
});

describe('AxDayItem', () => {
  for (const theme of THEMES) {
    it(`${theme.mode} : repos (verre text 0.08) puis sélectionné (accent plein)`, async () => {
      const onPress = jest.fn();
      let root = await mount(<AxDayItem dayLabel="LUN" dayNumber={21} onPress={onPress} />, theme);
      expect(glasses(root)).toEqual([{ color: theme.ax.text, opacity: 0.08 }]);
      expect(flat(pressable(root))).toMatchObject({ width: 44, height: 58, borderRadius: 5 });
      expect(flat(pressable(root)).backgroundColor).toBeUndefined();
      expect([textColor(root, 0), textColor(root, 1)]).toEqual([theme.ax.textMuted, theme.ax.text]);
      expect(pressable(root).props.accessibilityState).toEqual({ selected: false });
      await act(async () => { pressable(root).props.onPress(); });
      expect(onPress).toHaveBeenCalledTimes(1);

      await act(async () => renderer!.unmount());
      root = await mount(<AxDayItem dayLabel="LUN" dayNumber={21} selected onPress={onPress} />, theme);
      expect(glasses(root)).toEqual([]);
      expect(flat(pressable(root)).backgroundColor).toBe(theme.ax.accent);
      expect([textColor(root, 0), textColor(root, 1)]).toEqual([theme.ax.onAccent, theme.ax.onAccent]);
      expect(pressable(root).props.accessibilityState).toEqual({ selected: true });
    });
  }
});

describe('AxCard', () => {
  for (const theme of THEMES) {
    it(`${theme.mode} : standard, vedette (filet accent 3 px en bas) et verre`, async () => {
      const card = (root: ReactTestInstance) => flat(root.findAllByType(View)[0]);
      let root = await mount(<AxCard variant="standard"><Text>a</Text></AxCard>, theme);
      expect(card(root)).toMatchObject({ backgroundColor: theme.ax.surface, borderWidth: 1, borderColor: theme.ax.border, borderRadius: 8, padding: 16, gap: 10 });
      expect(root.findAll((n) => n.props.testID === 'ax-card-rule')).toHaveLength(0);
      expect(glasses(root)).toEqual([]);

      await act(async () => renderer!.unmount());
      root = await mount(<AxCard variant="featured"><Text>a</Text></AxCard>, theme);
      expect(card(root)).toMatchObject({ backgroundColor: theme.ax.surface, borderColor: theme.ax.border, borderRadius: 8, paddingTop: 18, paddingRight: 18, paddingBottom: 16, paddingLeft: 18, overflow: 'hidden' });
      const rule = root.findAll((n) => n.props.testID === 'ax-card-rule' && typeof n.type !== 'string');
      expect(rule).toHaveLength(1);
      expect(flat(rule[0])).toMatchObject({ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: theme.ax.accent });

      await act(async () => renderer!.unmount());
      root = await mount(<AxCard variant="glass"><Text>a</Text></AxCard>, theme);
      expect(glasses(root)).toEqual([{ color: theme.ax.surface, opacity: 0.8 }]);
      expect(card(root)).toMatchObject({ borderWidth: 1, borderColor: theme.ax.border, borderRadius: 8, padding: 16 });
      expect(card(root).backgroundColor).toBeUndefined();
    });
  }

  it('onPress : la carte entière est un bouton cliquable', async () => {
    const onPress = jest.fn();
    const root = await mount(<AxCard onPress={onPress}><Text>a</Text></AxCard>);
    const p = pressable(root);
    expect(p.props.accessibilityRole).toBe('button');
    await act(async () => { p.props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('AxTextField', () => {
  for (const theme of THEMES) {
    it(`${theme.mode} : bordure normale, focalisée, erreur + message`, async () => {
      let root = await mount(<AxTextField value="" onChangeText={() => {}} placeholder="Nom" />, theme);
      const box = () => flat(root.findAll((n) => n.props.testID === 'ax-text-field-box' && typeof n.type !== 'string')[0]);
      const input = () => root.findAllByType(TextInput)[0];
      expect(box()).toMatchObject({ backgroundColor: theme.ax.field, borderWidth: 1, borderColor: theme.ax.fieldBorder, borderRadius: 5, padding: 14 });
      expect(input().props.placeholderTextColor).toBe(theme.ax.textMuted);
      expect(flat(input())).toMatchObject({ color: theme.ax.text, fontFamily: 'Inter_400Regular', fontSize: 15 });
      await act(async () => { input().props.onFocus(); });
      expect(box().borderColor).toBe(theme.ax.accentText);
      await act(async () => { input().props.onBlur(); });
      expect(box().borderColor).toBe(theme.ax.fieldBorder);
      expect(root.findAll((n) => n.props.testID === 'ax-text-field-error')).toHaveLength(0);

      await act(async () => renderer!.unmount());
      root = await mount(<AxTextField value="x" onChangeText={() => {}} error="Obligatoire" />, theme);
      expect(box().borderColor).toBe(theme.ax.danger);
      const err = root.findAll((n) => n.props.testID === 'ax-text-field-error' && n.type === Text)[0];
      expect(err.props.children).toBe('Obligatoire');
      expect(flat(err)).toMatchObject({ color: theme.ax.danger, fontSize: 12 });
    });
  }
});

describe('AxGlass', () => {
  it('Android : aucune BlurView, 0.80 et 0.85 portées à 0.96, autres opacités inchangées', async () => {
    Platform.OS = 'android';
    for (const [opacity, applied] of [[0.8, 0.96], [0.85, 0.96], [0.88, 0.88], [0.08, 0.08], [0.12, 0.12]]) {
      const root = await mount(<AxGlass color={darkTheme.ax.surface} opacity={opacity} radius={8} />, darkTheme);
      expect(root.findAll((n) => (n.type as unknown) === 'BlurView')).toHaveLength(0);
      const fill = root.findAll((n) => n.props.testID === 'ax-glass-fill' && typeof n.type !== 'string')[0];
      expect(flat(fill).backgroundColor).toBe(withAlpha(darkTheme.ax.surface, applied));
      await act(async () => renderer!.unmount());
      renderer = null;
    }
    expect(resolveGlassOpacity(0.85, 'android')).toBe(0.96);
    expect(resolveGlassOpacity(0.85, 'ios')).toBe(0.85);
  });

  for (const theme of THEMES) {
    it(`iOS / ${theme.mode} : BlurView présente (flou 24, teinte du thème), opacité inchangée, coins et masque`, async () => {
      Platform.OS = 'ios';
      const root = await mount(<AxGlass color={theme.ax.surface} opacity={0.85} radius={8} />, theme);
      const blur = root.findAll((n) => (n.type as unknown) === 'BlurView');
      expect(blur).toHaveLength(1);
      expect(blur[0].props).toMatchObject({ intensity: 24, tint: theme.mode });
      const fill = root.findAll((n) => n.props.testID === 'ax-glass-fill' && typeof n.type !== 'string')[0];
      expect(flat(fill).backgroundColor).toBe(withAlpha(theme.ax.surface, 0.85));
      const layer = root.findAll((n) => n.props.testID === 'ax-glass' && typeof n.type !== 'string')[0];
      expect(flat(layer)).toMatchObject({ borderRadius: 8, overflow: 'hidden' });
    });
  }
});

describe('contraste AA des couples texte / fond', () => {
  for (const mode of ['dark', 'light'] as const) {
    const c = axColors[mode];
    it.each([
      ['onAccent / accent', c.onAccent, c.accent],
      ['text / surface', c.text, c.surface],
      ['danger / background', c.danger, c.background],
      ['accentText / background', c.accentText, c.background],
    ])(`${mode} : %s ≥ 4,5:1`, (_n, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('isolement : rien d’existant ne consomme src/components/ax', () => {
  const SRC = path.join(__dirname, '..');
  const AX_DIR = path.join(SRC, 'components', 'ax');
  const CATALOG = path.join(SRC, 'screens', 'dev', 'AxCatalogScreen.tsx');
  // Tout spécificateur relatif (import, import de bord, export, require) qui vise le dossier ax.
  const IMPORTS_AX = /(?:from|import|require\()\s*['"]\.[^'"]*\/ax(?:\/[^'"]*)?['"]/;

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
    });
  }

  // Adoption écran par écran : seuls les fichiers listés ici, pour leurs éléments nouveaux.
  const ADOPTERS = [
    path.join(SRC, 'screens', 'whiteboard', 'WODDetailScreen.tsx'),
    path.join(SRC, 'components', 'wod', 'StrengthSetGrid.tsx'),
    path.join(SRC, 'screens', 'wod', 'MuscuSessionCard.tsx'),
    path.join(SRC, 'screens', 'training', 'TrainingScreen.tsx'),
    path.join(SRC, 'screens', 'home', 'HomeExplorerBlock.tsx'),
    path.join(SRC, 'screens', 'home', 'HomeNewsCard.tsx'),
    path.join(SRC, 'screens', 'competition', 'CompetitionRankingCard.tsx'),
    // R3b : l'Accueil de l'athlète passe au nouveau design.
    path.join(SRC, 'screens', 'home', 'HomeScreen.tsx'),
    // R3c : en-tête « ‹ Retour » des écrans secondaires de l'athlète.
    ...R3C_SCREENS.map((s) => path.join(SRC, 'screens', s.file)),
    // R4a : générateur et résultats au nouveau design.
    path.join(SRC, 'components', 'wod', 'SessionContextCard.tsx'),
  ];

  it('R4a : dans src/screens/wod et src/components/wod, seuls les fichiers du générateur et des résultats consomment ax', () => {
    const wod = [...walk(path.join(SRC, 'screens', 'wod')), ...walk(path.join(SRC, 'components', 'wod'))]
      .filter((f) => IMPORTS_AX.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f))
      .sort();
    expect(wod).toEqual([
      path.join('components', 'wod', 'SessionContextCard.tsx'),
      path.join('components', 'wod', 'StrengthSetGrid.tsx'),
      path.join('screens', 'wod', 'MuscuSessionCard.tsx'),
      path.join('screens', 'wod', 'WodGeneratorScreen.tsx'),
      // Adoptant R3c (AxScreenHeader seul), hors périmètre R4a.
      path.join('screens', 'wod', 'WodHistoryScreen.tsx'),
      path.join('screens', 'wod', 'WodResultScreen.tsx'),
    ].sort());
  });

  it('R3b / R3c : dans src/screens/home, seuls l’Accueil, ses blocs et les écrans secondaires R3c consomment ax', () => {
    const home = walk(path.join(SRC, 'screens', 'home'))
      .filter((f) => IMPORTS_AX.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.basename(f))
      .sort();
    expect(home).toEqual([
      'BoxInfoScreen.tsx', 'ChangelogScreen.tsx', 'FriendsScreen.tsx', 'HomeExplorerBlock.tsx',
      'HomeNewsCard.tsx', 'HomeScreen.tsx', 'OneRMCalculatorScreen.tsx',
    ]);
  });

  it('aucun écran de src/screens (hors catalogue et adoptants) ni ancien composant de src/components n’importe ax', () => {
    const files = [...walk(path.join(SRC, 'screens')), ...walk(path.join(SRC, 'components'))]
      .filter((f) => f !== CATALOG && !ADOPTERS.includes(f) && !f.startsWith(AX_DIR + path.sep));
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((f) => IMPORTS_AX.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe('catalogue : développement uniquement', () => {
  const nav = fs.readFileSync(path.join(__dirname, '..', 'navigation', 'index.tsx'), 'utf8');

  it('le catalogue est chargé derrière __DEV__ et jamais importé statiquement', () => {
    expect(nav).toMatch(/const AxCatalogScreen[^=]*=\s*__DEV__\s*\?\s*require\('\.\.\/screens\/dev\/AxCatalogScreen'\)\.default\s*:\s*null;/);
    expect(nav).not.toMatch(/import[^;]*AxCatalogScreen/);
    expect(nav.match(/screens\/dev\/AxCatalogScreen/g)).toHaveLength(1);
  });

  it("l'écran n'est enregistré que si AxCatalogScreen existe", () => {
    const registrations = nav.split('\n').filter((l) => l.includes('name="AxCatalog"'));
    expect(registrations).toHaveLength(1);
    expect(registrations[0].trim()).toMatch(/^\{AxCatalogScreen && <HomeStack\.Screen name="AxCatalog" component=\{AxCatalogScreen\} \/>\}$/);
  });
});
