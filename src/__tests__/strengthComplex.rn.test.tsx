/**
 * Grille d'un complexe (nbstyle69/AthleX-Manager#454, Figma 740:658 et 740:741),
 * montée avec le vrai react-native : titre « Complexe · … », « prévu 1 × kg (%) »
 * ou « prévu 1 · 75 % », avertissement sans 1RM de référence, textes sans 1RM,
 * « Charge max (complexe) ». Sombre et clair, FR et EN.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import i18n from '../i18n';
import StrengthSetGrid, { StrengthMaxLoadRow, StrengthMyLoadsCard, isComplexGrid } from '../components/wod/StrengthSetGrid';
import { buildStrengthGrid } from '../services/strengthSets';
import { parseStrengthLine } from '../utils/strengthBlock';

let mockTheme: AppTheme = darkTheme;
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme, toggleTheme: () => {} }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));

let renderer: TestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
});
beforeEach(async () => { await i18n.changeLanguage('fr'); });

async function mount(el: React.ReactElement, theme: AppTheme = darkTheme): Promise<ReactTestInstance> {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  return renderer!.root;
}
const texte = (root: ReactTestInstance, testID: string) =>
  [].concat(root.findAll(n => n.type === Text && n.props.testID === testID)[0].props.children).join('').replace(/[  ]/g, ' ');
const textes = (root: ReactTestInstance) =>
  root.findAll(n => n.type === Text)
    .map(n => [].concat(n.props.children).filter(x => typeof x === 'string').join('').replace(/[  ]/g, ' '));

const LIGNE = 'Complexe — 1 Deadlift + 1 Hang Power Clean + 1 Power Clean — 5 × 1 @ 75 %1RM Power Clean — repos 2:00';
const grille = (rm: number | null) => buildStrengthGrid([parseStrengthLine(LIGNE)!], n => (n === 'Power Clean' ? rm : null));

describe.each([['sombre', darkTheme], ['clair', lightTheme]] as const)('complexe (%s)', (_nom, theme) => {
  it('1RM connu (740:658) : titre, prévu « 1 × 72.5 kg (75 %) », textes sans 1RM', async () => {
    const root = await mount(<StrengthSetGrid drafts={grille(95)} onChange={jest.fn()} onAddSet={jest.fn()} />, theme);
    const t = textes(root);
    expect(t).toContain('Complexe · 1 Deadlift + 1 Hang Power Clean + 1 Power Clean');
    expect(t).toContain('Pré-rempli avec ce qui était prescrit. Corrige seulement les séries où tu as fait autre chose.');
    expect(texte(root, 'strength-note-0')).toBe('prévu 1 × 72.5 kg (75 %)');
    expect(texte(root, 'strength-no-load-hint'))
      .toBe('Un complexe ne change pas ton 1RM. Une série sans charge compte dans tes séries, pas dans la charge max.');
    expect(root.findAll(n => n.props.testID === 'strength-complex-no-1rm-0')).toHaveLength(0);
    expect(root.findAllByProps({ testID: 'strength-add-set-0' }).length).toBeGreaterThan(0);
    expect(t.join(' ')).not.toMatch(/mettent à jour ton 1RM/);
  });

  it('sans 1RM de référence (740:741) : avertissement en couleur d’avertissement, « prévu 1 · 75 % », champ « kg »', async () => {
    const root = await mount(<StrengthSetGrid drafts={grille(null)} onChange={jest.fn()} />, theme);
    expect(texte(root, 'strength-complex-no-1rm-0'))
      .toBe('Pas de 1RM de Power Clean : charge à ton appréciation. Renseigne ton 1RM pour la voir calculée.');
    const warn = root.findAll(n => n.type === Text && n.props.testID === 'strength-complex-no-1rm-0')[0];
    expect(StyleSheet.flatten(warn.props.style).color).toBe(theme.ax.warning);
    expect(texte(root, 'strength-note-0')).toBe('prévu 1 · 75 %');
    expect(root.findByProps({ testID: 'strength-kg-0' }).props.placeholder).toBe('kg');
    expect(root.findAll(n => n.props.testID === 'strength-complex-no-1rm-0' && n.type === Text)).toHaveLength(1);
  });

  it('« Charge max (complexe) · calculée » et carte « Mes charges »', async () => {
    let root = await mount(<StrengthMaxLoadRow maxLoadKg={75} complex />, theme);
    expect(textes(root)).toContain('Charge max (complexe) · calculée');
    await act(async () => renderer!.unmount());
    root = await mount(<StrengthMyLoadsCard drafts={grille(95)} maxLoadKg={72.5} />, theme);
    expect(textes(root)).toContain('Complexe · 1 Deadlift + 1 Hang Power Clean + 1 Power Clean');
  });
});

describe('textes', () => {
  it('une ligne ordinaire garde ses textes d’avant', async () => {
    const d = buildStrengthGrid([parseStrengthLine('Back Squat — 2 × 5 @ 75 %1RM')!], () => null);
    expect(isComplexGrid(d)).toBe(false);
    const root = await mount(<StrengthSetGrid drafts={d} onChange={jest.fn()} onAddSet={jest.fn()} />);
    expect(texte(root, 'strength-note-0')).toBe('prévu 5 × 75 % 1RM');
    expect(root.findByProps({ testID: 'strength-kg-0' }).props.placeholder).toBe(i18n.t('strengthSession.pct1RmPlaceholder'));
    expect(texte(root, 'strength-no-load-hint')).toBe('Une série sans charge compte dans tes reps, pas dans ton 1RM.');
    let row = await mount(<StrengthMaxLoadRow maxLoadKg={75} />);
    expect(textes(row)).toContain('Charge max (score) · calculée');
    await act(async () => renderer!.unmount());
    row = await mount(<StrengthMaxLoadRow maxLoadKg={75} complex={isComplexGrid(d)} />);
    expect(textes(row)).toContain('Charge max (score) · calculée');
  });

  it('en anglais : « Complex », noms de mouvements non traduits', async () => {
    await i18n.changeLanguage('en');
    const root = await mount(<StrengthSetGrid drafts={grille(null)} onChange={jest.fn()} onAddSet={jest.fn()} />);
    const t = textes(root);
    expect(t).toContain('Complex · 1 Deadlift + 1 Hang Power Clean + 1 Power Clean');
    expect(texte(root, 'strength-complex-no-1rm-0')).toBe('No Power Clean 1RM: load at your discretion. Enter your 1RM to see it calculated.');
    expect(texte(root, 'strength-note-0')).toBe('planned 1 · 75%');
    expect(texte(root, 'strength-no-load-hint'))
      .toBe("A complex doesn't change your 1RM. A set without load counts toward your sets, not your max load.");
    await act(async () => renderer!.unmount());
    const row = await mount(<StrengthMaxLoadRow maxLoadKg={75} complex />);
    expect(textes(row)).toContain('Max load (complex) · calculated');
  });
});
