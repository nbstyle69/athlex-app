/**
 * Carte Séance Musculation (PR 3), montée avec le vrai react-native : état du
 * brouillon serveur et « Enregistrer et continuer plus tard » (composants ax),
 * masqués une fois la séance validée ; saisie décimale 102,5 → 102.5.
 */
import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { darkTheme, lightTheme, type AppTheme } from '../theme/palette';
import i18n from '../i18n';
import MuscuSessionCard from '../screens/wod/MuscuSessionCard';
import { AxButton, AxStatusDot } from '../components/ax';
import type { MuscuWod } from '../../packages/wod-engine/src';
import { PerformedExercise } from '../services/wodGenerator';
import { initialPerformed } from '../services/muscuSession';

let mockTheme: AppTheme = darkTheme;
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme, toggleTheme: () => {} }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));

const WOD = {
  source: 'generator', discipline: 'musculation', title: 'Séance Fessiers', level: 'intermediaire',
  entry: 'express', target: 'fessiers', objective: 'hypertrophie', equipment: 'box', budget_min: 30, score_type: 'tonnage',
  blocks: [{ exercises: [
    { id: 'hip_thrust', name: 'Hip Thrust', sets: 2, reps: 10, reps_unit: 'reps', rest_s: 90, load: { mode: 'weighted', kg: 60 } },
  ] }],
} as unknown as MuscuWod;

let renderer: TestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
});
beforeAll(async () => { await i18n.changeLanguage('fr'); });

let last: PerformedExercise[] = [];
function Harness({ draft }: { draft?: React.ComponentProps<typeof MuscuSessionCard>['draft'] }) {
  const [performed, setPerformed] = useState(() => initialPerformed(WOD));
  last = performed;
  return <MuscuSessionCard wod={WOD} accent="#00f" performed={performed} onPerformedChange={setPerformed} draft={draft} />;
}
async function mount(el: React.ReactElement, theme: AppTheme = darkTheme): Promise<ReactTestInstance> {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  return renderer!.root;
}

describe('brouillon serveur', () => {
  it.each([darkTheme, lightTheme])('« En cours · n / N séries » (warning) et bouton contour « Enregistrer et continuer plus tard »', async (theme) => {
    const onSaveLater = jest.fn();
    const root = await mount(
      <Harness draft={{ saveState: 'idle', savedAt: null, validated: false, onSaveLater }} />, theme,
    );
    const dot = root.findByType(AxStatusDot);
    expect(dot.props.tone).toBe('warning');
    expect(dot.props.label).toBe('En cours · 2 / 2 séries');
    const btn = root.findByType(AxButton);
    expect(btn.props.variant).toBe('outline');
    expect(btn.props.label).toBe('Enregistrer et continuer plus tard');
    await act(async () => btn.props.onPress());
    expect(onSaveLater).toHaveBeenCalledTimes(1);
  });

  it('séance validée : ni état de brouillon ni bouton d’enregistrement', async () => {
    const root = await mount(<Harness draft={{ saveState: 'idle', savedAt: null, validated: true, onSaveLater: jest.fn() }} />);
    expect(root.findAllByType(AxStatusDot)).toHaveLength(0);
    expect(root.findAllByType(AxButton)).toHaveLength(0);
    expect(root.findAllByProps({ testID: 'muscu-draft' })).toHaveLength(0);
  });

  it('sans brouillon suivi, la carte historique reste telle quelle', async () => {
    const root = await mount(<Harness />);
    expect(root.findAllByType(AxButton)).toHaveLength(0);
  });
});

describe('saisie décimale', () => {
  it('102,5 tapé avec la virgule donne 102.5 kg, clavier décimal', async () => {
    const root = await mount(<Harness />);
    const inputs = () => root.findAllByProps({ testID: 'muscu-kg-0-0' }).filter(n => typeof n.type !== 'string');
    if (inputs().length === 0) {
      await act(async () => root.findByProps({ testID: 'muscu-exercise-0' }).findAllByType(TouchableOpacity)[0].props.onPress());
    }
    const kg = inputs()[0];
    expect(kg.props.keyboardType).toBe('decimal-pad');
    await act(async () => kg.props.onChangeText('102,'));
    expect(inputs()[0].props.value).toBe('102.');
    await act(async () => inputs()[0].props.onChangeText('102,5'));
    expect(last[0].sets[0].load_kg).toBe(102.5);
    expect(inputs()[0].props.value).toBe('102.5');
  });
});
