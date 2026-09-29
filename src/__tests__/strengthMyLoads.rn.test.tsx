/**
 * Musculation PR 4, montée avec le vrai react-native : mention des cartes de Ma
 * Box (brouillon / validée / sans séance) et bloc « Mes charges ».
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import i18n from '../i18n';
import {
  StrengthMyLoadsCard, StrengthWodCardStatus, strengthCardLinkKey,
} from '../components/wod/StrengthSetGrid';
import { AxCard, AxStatusDot } from '../components/ax';
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
  entryIndex: 0, setIndex, name: 'Back Squat', reps, loadKg, prescribedReps: 7, prescribedLoadKg: 100,
});

describe('carte d’un WOD de musculation (Ma Box)', () => {
  it.each([darkTheme, lightTheme])('brouillon : « En cours · n / N séries » en warning, lien « Reprendre ma saisie »', async (theme) => {
    const summary = { status: 'draft' as const, done: 2, total: 5 };
    const root = await mount(<StrengthWodCardStatus summary={summary} />, theme);
    const dot = root.findByType(AxStatusDot);
    expect(dot.props.tone).toBe('warning');
    expect(dot.props.label).toBe('En cours · 2 / 5 séries');
    expect(i18n.t(strengthCardLinkKey(summary))).toBe('Reprendre ma saisie');
  });

  it('validée : « Validée » en ton actif, lien inchangé', async () => {
    const summary = { status: 'validated' as const, done: 3, total: 3 };
    const root = await mount(<StrengthWodCardStatus summary={summary} />);
    const dot = root.findByType(AxStatusDot);
    expect(dot.props.tone).toBe('active');
    expect(dot.props.label).toBe('Validée');
    expect(strengthCardLinkKey(summary)).toBe('whiteboard.seeDetails');
  });

  it('sans séance : aucune mention, lien inchangé', async () => {
    const root = await mount(<StrengthWodCardStatus summary={undefined} />);
    expect(root.findAllByType(AxStatusDot)).toHaveLength(0);
    expect(strengthCardLinkKey(undefined)).toBe('whiteboard.seeDetails');
  });
});

describe('bloc « Mes charges »', () => {
  const drafts = [draft(1, '7', '100'), draft(2, '6', '100'), draft(3, '', '')];

  it.each([darkTheme, lightTheme])('séries enregistrées « reps × charge », écart en accentText, tonnage et charge max', async (theme) => {
    const root = await mount(<StrengthMyLoadsCard drafts={drafts} maxLoadKg={100} />, theme);
    expect(root.findAllByType(AxCard)).toHaveLength(1);
    expect(texts(root)).toEqual(expect.arrayContaining([
      'Mes charges', 'Back Squat', 'Série 1 · 7 × 100 kg', 'Série 2 · 6 × 100 kg', '1300 kg', '100 kg',
    ]));
    expect(root.findAllByProps({ testID: 'strength-my-loads-set-2' })).toHaveLength(0);
    expect(root.findAllByProps({ testID: 'strength-my-loads-gap-0' })).toHaveLength(0);
    const gap = root.findByProps({ testID: 'strength-my-loads-gap-1' });
    expect(gap.props.children).toBe('6 au lieu de 7');
    expect(StyleSheet.flatten(gap.props.style).color).toBe(theme.ax.accentText);
    expect(root.findByProps({ testID: 'strength-my-loads-tonnage' }).props.children).toBe('1300 kg');
  });

  it('aucune série valide : pas de bloc', async () => {
    const root = await mount(<StrengthMyLoadsCard drafts={[draft(1, '', '')]} maxLoadKg={null} />);
    expect(root.findAllByType(AxCard)).toHaveLength(0);
  });

  it('en anglais aussi', async () => {
    await i18n.changeLanguage('en');
    const root = await mount(<StrengthMyLoadsCard drafts={drafts} maxLoadKg={100} />);
    expect(texts(root)).toEqual(expect.arrayContaining(['My loads', '6 instead of 7']));
    await i18n.changeLanguage('fr');
  });
});
