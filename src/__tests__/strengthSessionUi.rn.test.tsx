/**
 * Éléments nouveaux de la saisie de musculation (PR 2), montés avec le vrai
 * react-native : saisie décimale, état « En cours · n / N », charge max
 * calculée, charges enregistrées, accessibilité.
 */
import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import i18n from '../i18n';
import StrengthSetGrid, {
  StrengthMaxLoadRow, StrengthSavedLoads, StrengthSessionStatus,
} from '../components/wod/StrengthSetGrid';
import { AxStatusDot } from '../components/ax';
import type { StrengthSetDraft } from '../services/strengthSets';

let mockTheme: AppTheme = darkTheme;
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme, toggleTheme: () => {} }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));

let renderer: TestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
});
beforeAll(async () => { await i18n.changeLanguage('fr'); });

async function mount(el: React.ReactElement, theme: AppTheme = darkTheme): Promise<ReactTestInstance> {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  return renderer!.root;
}
const texts = (root: ReactTestInstance) => root.findAllByType(Text).map(t => [].concat(t.props.children).join(''));

const draft = (setIndex: number, reps: string, loadKg: string): StrengthSetDraft => ({
  entryIndex: 0, setIndex, name: 'Back Squat', reps, loadKg, prescribedReps: 5, prescribedLoadKg: 100,
});

describe('saisie décimale (iOS)', () => {
  it('102,5 tapé avec la virgule part en 102.5, clavier décimal', async () => {
    const onChange = jest.fn();
    const root = await mount(<StrengthSetGrid drafts={[draft(1, '5', '')]} onChange={onChange} />);
    const kg = root.findByProps({ testID: 'strength-kg-0' });
    expect(kg.props.keyboardType).toBe('decimal-pad');
    await act(async () => kg.props.onChangeText('102,5'));
    expect(onChange).toHaveBeenLastCalledWith(0, { loadKg: '102.5' });
    await act(async () => root.findByProps({ testID: 'strength-reps-0' }).props.onChangeText('5,'));
    expect(onChange).toHaveBeenLastCalledWith(0, { reps: '5' });
    expect(root.findAllByType(TextInput)).toHaveLength(2);
  });
});

describe('état de la séance', () => {
  it.each([darkTheme, lightTheme])('« En cours · n / N séries » en ton warning, date d’enregistrement', async (theme) => {
    const now = Date.parse('2026-09-28T12:00:00Z');
    const root = await mount(
      <StrengthSessionStatus done={2} total={3} savedAt="2026-09-28T11:55:00Z" saveState="idle" now={now} />, theme,
    );
    expect(root.findByType(AxStatusDot).props.tone).toBe('warning');
    expect(texts(root)).toEqual(expect.arrayContaining(['En cours · 2 / 3 séries', 'Enregistré il y a 5 min']));
    const box = root.findByProps({ testID: 'strength-status' });
    expect(box.props.accessible).toBe(true);
    expect(box.props.accessibilityLabel).toBe('Séance en cours : 2 séries sur 3. Enregistré il y a 5 min');
    expect(StyleSheet.flatten(root.findByProps({ testID: 'strength-saved' }).props.style).color).toBe(theme.ax.textMuted);
  });

  it('hors connexion : le dit, sans prétendre avoir enregistré', async () => {
    const root = await mount(<StrengthSessionStatus done={0} total={3} savedAt={null} saveState="offline" now={0} />);
    expect(texts(root).join(' ')).toContain('Hors connexion');
  });
});

describe('charge max calculée', () => {
  it('affiche la valeur calculée, lisible par le lecteur d’écran', async () => {
    const root = await mount(<StrengthMaxLoadRow maxLoadKg={102.5} />);
    expect(texts(root)).toEqual(['Charge max (score) · calculée', '102.5 kg']);
    expect(root.findByProps({ testID: 'strength-max-load' }).props.accessibilityLabel)
      .toBe('Charge max (score) · calculée : 102.5 kg');
    expect(root.findAllByType(TextInput)).toHaveLength(0);
  });
});

describe('charges enregistrées', () => {
  it('liste les séries enregistrées, pas la prescription', async () => {
    const root = await mount(<StrengthSavedLoads drafts={[draft(1, '4', '102.5'), draft(2, '', '')]} />);
    expect(texts(root)).toEqual(['Mes charges enregistrées', 'Back Squat', 'Série 1 · 4 × 102.5 kg', 'Série 2 · —']);
  });
});
