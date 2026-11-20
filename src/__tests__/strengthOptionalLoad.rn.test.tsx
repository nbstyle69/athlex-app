/**
 * Grille de musculation, charge facultative (nbstyle69/AthleX-Manager#453, PR 4b ;
 * Figma 737:777), montée avec le vrai react-native : « Ajouter une série » sur
 * un mouvement chargé, « ajoutée · sans charge », indication « % 1RM » dans un
 * champ kg vide, erreurs sous le champ concerné, aide une seule fois, « Mes
 * charges » d'une série faite sans charge. Sombre et clair, FR et EN.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import i18n from '../i18n';
import StrengthSetGrid, { StrengthMyLoadsCard } from '../components/wod/StrengthSetGrid';
import { addStrengthSet, buildStrengthGrid, type StrengthSetDraft } from '../services/strengthSets';
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
  [].concat(root.findByProps({ testID }).props.children).join('');
const couleur = (root: ReactTestInstance, testID: string) =>
  StyleSheet.flatten(root.findAll(n => n.type === Text && n.props.testID === testID)[0].props.style).color;

// Deadlift 86 %1RM (1RM 223 → 192,5 kg), Back Squat 75 %1RM sans 1RM connu.
const grille = () => buildStrengthGrid(
  ['Deadlift — 2 × 2 @ 86 %1RM', 'Back Squat — 2 × 5 @ 75 %1RM'].map(l => parseStrengthLine(l)!),
  n => (n === 'Deadlift' ? 223 : null),
);
const edit = (d: StrengthSetDraft[], i: number, patch: Partial<StrengthSetDraft>) =>
  d.map((x, j) => (j === i ? { ...x, ...patch } : x));

describe.each([['sombre', darkTheme], ['clair', lightTheme]] as const)('grille chargée (%s)', (_nom, theme) => {
  it('« Ajouter une série » sous chaque mouvement chargé ; l’aide « sans charge » une seule fois, sous le dernier', async () => {
    const onAddSet = jest.fn();
    const root = await mount(<StrengthSetGrid drafts={grille()} onChange={jest.fn()} onAddSet={onAddSet} />, theme);
    await act(async () => root.findByProps({ testID: 'strength-add-set-0' }).props.onPress());
    await act(async () => root.findByProps({ testID: 'strength-add-set-1' }).props.onPress());
    expect(onAddSet.mock.calls).toEqual([[0], [1]]);
    expect(root.findAll(n => n.props.testID === 'strength-no-load-hint' && n.type === Text)).toHaveLength(1);
    expect(texte(root, 'strength-no-load-hint')).toBe('Une série sans charge compte dans tes reps, pas dans ton 1RM.');
  });

  it('série ajoutée : « ajoutée · sans charge » puis « ajoutée », en couleur d’accent', async () => {
    const d = addStrengthSet(grille(), 0);
    let root = await mount(<StrengthSetGrid drafts={edit(d, 2, { reps: '2' })} onChange={jest.fn()} />, theme);
    expect(texte(root, 'strength-note-2')).toBe('ajoutée · sans charge');
    expect(couleur(root, 'strength-note-2')).toBe(theme.ax.accentText);
    await act(async () => renderer!.unmount()); renderer = null;
    root = await mount(<StrengthSetGrid drafts={edit(d, 2, { reps: '2', loadKg: '160' })} onChange={jest.fn()} />, theme);
    expect(texte(root, 'strength-note-2')).toBe('ajoutée');
  });

  it('%1RM : charge préremplie et prévu « 2 × 192,5 kg (86 %) » ; sans 1RM, champ vide marqué « % 1RM »', async () => {
    const root = await mount(<StrengthSetGrid drafts={grille()} onChange={jest.fn()} />, theme);
    expect(root.findByProps({ testID: 'strength-kg-0' }).props.value).toBe('192.5');
    expect(texte(root, 'strength-note-0')).toBe('prévu 2 × 192.5 kg (86 %)');
    expect(root.findByProps({ testID: 'strength-kg-2' }).props.value).toBe('');
    expect(root.findByProps({ testID: 'strength-kg-2' }).props.placeholder).toBe('% 1RM');
    expect(texte(root, 'strength-note-2')).toBe('prévu 5 × 75 % 1RM');
    expect(root.findByProps({ testID: 'strength-kg-0' }).props.placeholder).toBe('kg');
  });

  it('erreurs de saisie sous le champ concerné, en couleur danger ; aucune pour une série sans charge', async () => {
    let d = edit(grille(), 0, { reps: '0' });
    d = edit(d, 1, { loadKg: '600' });
    d = edit(d, 2, { reps: '5', loadKg: '' });
    const root = await mount(<StrengthSetGrid drafts={d} onChange={jest.fn()} />, theme);
    expect(texte(root, 'strength-reps-error-0')).toBe('1 à 500');
    expect(couleur(root, 'strength-reps-error-0')).toBe(theme.ax.danger);
    expect(texte(root, 'strength-kg-error-1')).toBe('kg invalide');
    expect(root.findAll(n => n.props.testID === 'strength-errors-2')).toHaveLength(0);
  });
});

describe('anglais', () => {
  it('notes, indication et aide traduites', async () => {
    await i18n.changeLanguage('en');
    const d = edit(addStrengthSet(grille(), 0), 2, { reps: '2' });
    const root = await mount(<StrengthSetGrid drafts={d} onChange={jest.fn()} onAddSet={jest.fn()} />);
    expect(texte(root, 'strength-note-2')).toBe('added · no load');
    expect(texte(root, 'strength-note-0')).toBe('planned 2 × 192.5 kg (86%)');
    expect(root.findByProps({ testID: 'strength-kg-3' }).props.placeholder).toBe('% 1RM');
    expect(texte(root, 'strength-no-load-hint')).toBe('A set without load counts toward your reps, not your 1RM.');
  });
});

describe('Mes charges (séance validée)', () => {
  it('série faite sans charge : « Série 1 · 2 reps · sans charge », hors tonnage et charge max', async () => {
    const d = edit(grille().slice(0, 2), 0, { loadKg: '' });
    const root = await mount(<StrengthMyLoadsCard drafts={d} maxLoadKg={192.5} />);
    const lignes = root.findAllByType(Text).map(t => [].concat(t.props.children).join(''));
    expect(lignes).toContain('Série 1 · 2 reps · sans charge');
    expect(lignes).toContain('Série 2 · 2 × 192.5 kg');
    expect(texte(root, 'strength-my-loads-tonnage')).toBe('385 kg');
  });

  it('aucune série chargée : ni tonnage ni charge max affichés', async () => {
    const d = edit(edit(grille().slice(0, 2), 0, { loadKg: '' }), 1, { loadKg: '' });
    const root = await mount(<StrengthMyLoadsCard drafts={d} maxLoadKg={null} />);
    expect(root.findAll(n => n.props.testID === 'strength-my-loads-tonnage')).toHaveLength(0);
  });
});
