/**
 * R2a — onglet Entraînement monté avec le vrai react-native : génération en un
 * tap par le service du générateur, liens, tuiles, « Dernière séance » ; et le
 * bloc Explorer de l'Accueil.
 */
import React, { useEffect as mockUseEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BANK_V1 as mockBank, CATALOG_SNAPSHOT as mockCatalog, generateBlocC, GenerateParams } from '../../packages/wod-engine/src';
import { lightTheme as mockTheme } from '../theme/palette';
import type { WodDraft } from '../services/wodDraft';
import i18n from '../i18n';
import TrainingScreen from '../screens/training/TrainingScreen';
import HomeExplorerBlock from '../screens/home/HomeExplorerBlock';

const mockNavigate = jest.fn();
const mockGenerate = jest.fn();
const mockSaveDraft = jest.fn(async () => {});
let mockDraft: WodDraft | null = null;
let mockRows: unknown[] = [];

const params: GenerateParams = {
  entry: 'express', discipline: 'functional', budget_min: 15, format: 'amrap',
  intention: 'mixed', vest: 'none', exclude: [], profile_category: 'rx',
};
const wod = { ...generateBlocC(params, mockCatalog, mockBank, 42), title: 'Séance du test' };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback: () => () => void) => mockUseEffect(callback, [callback]),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../context/AuthContext', () => {
  const user = { id: 'u1', level: 'rx', gender: 'male' };
  return { useAuth: () => ({ user, currentBox: { id: 'box-1' } }) };
});
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'not', 'order']) chain[m] = () => chain;
  chain.limit = async () => ({ data: mockRows, error: null });
  return { supabase: { from: () => chain } };
});
jest.mock('../services/wodEngineData', () => ({ loadEngineData: async () => ({ catalog: mockCatalog, bank: mockBank }) }));
jest.mock('../services/wodDraft', () => ({
  loadWodDraft: async () => mockDraft,
  saveWodDraft: (...a: unknown[]) => mockSaveDraft(...(a as [])),
}));
jest.mock('../services/wodGenerator', () => ({
  isMuscuWod: (w: { discipline: string }) => w.discipline === 'musculation',
  categoryFor: () => 'rx',
  generateForUser: (...a: unknown[]) => mockGenerate(...a),
  loadExcludes: async () => ['burpee'],
  loadAdaptToPr: async () => false,
  loadMuscuEquipment: async () => 'box',
}));

let renderer: TestRenderer.ReactTestRenderer;
const byId = (id: string) => renderer.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const has = (id: string) => renderer.root.findAll((n) => n.props.testID === id).length > 0;
const texts = () => renderer.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

async function mount() {
  await act(async () => { renderer = TestRenderer.create(<TrainingScreen />); });
  await act(async () => {});
}

beforeAll(async () => { await i18n.changeLanguage('fr'); });
beforeEach(() => {
  mockNavigate.mockClear(); mockGenerate.mockReset(); mockSaveDraft.mockClear();
  mockDraft = null; mockRows = [];
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });

describe('TrainingScreen', () => {
  it('en-tête, carte vedette et libellés du brief', async () => {
    await mount();
    const all = texts();
    for (const s of ['Entraînement', 'Génère, chronomètre et retrouve tes séances', 'Générer ma séance', 'WOD express', 'Après ma classe',
      'Functional', 'Hybrid', 'Musculation', 'Générer mon WOD', "Plus d'options : format, intention, matériel", 'Minuteur', '1RM', 'Historique', 'Favoris']) {
      expect(all).toContain(s);
    }
    expect(all.join(' ')).not.toMatch(/crossfit|hyrox/i);
  });

  it('« Générer mon WOD » : generateForUser avec les réglages mémorisés, brouillon, puis WodResult', async () => {
    const result = { wod, params, category: 'rx' };
    mockGenerate.mockResolvedValue(result);
    await mount();
    await act(async () => { byId('training-generate-button').props.onPress(); });
    const screen = { entry: 'express', discipline: 'functional', intention: 'mixed', exclude: ['burpee'], adapt_to_pr: false, format: 'surprise', vest: 'none' };
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'box-1', screen);
    expect(mockSaveDraft).toHaveBeenCalledWith('u1', { screen, result });
    expect(mockNavigate).toHaveBeenCalledWith('WodResult', { screen, result });
  });

  it('les choix d’entrée et de discipline passent au service (Après ma classe · Musculation)', async () => {
    mockGenerate.mockResolvedValue({ wod, params, category: 'rx' });
    await mount();
    await act(async () => { byId('training-entry-after_class').props.onPress(); });
    await act(async () => { byId('training-discipline-musculation').props.onPress(); });
    await act(async () => { byId('training-generate-button').props.onPress(); });
    expect(mockGenerate.mock.calls[0][2]).toEqual(expect.objectContaining({
      discipline: 'musculation', entry: 'after_class', objective: 'hypertrophie', equipment: 'box', exclude: ['burpee'],
    }));
  });

  it('« Plus d’options » ouvre WodGenerator ; chaque tuile ouvre son écran', async () => {
    await mount();
    const cases: [string, unknown[]][] = [
      ['training-more-options', ['WodGenerator']],
      ['training-tool-timer', ['Timer']],
      ['training-tool-onerm', ['OneRMCalculator']],
      ['training-tool-history', ['WodHistory']],
      ['training-tool-favorites', ['WodHistory', { filter: 'favorites' }]],
    ];
    for (const [id, call] of cases) {
      mockNavigate.mockClear();
      await act(async () => { byId(id).props.onPress(); });
      expect(mockNavigate.mock.calls).toEqual([call]);
    }
  });

  it('« Dernière séance » masquée sans historique', async () => {
    await mount();
    expect(has('training-last')).toBe(false);
    expect(texts()).not.toContain('Dernière séance');
  });

  it('« Dernière séance » affichée depuis l’historique ; « Relancer » rouvre la séance dans WodResult', async () => {
    mockRows = [{ created_at: new Date().toISOString(), wod_json: wod, scores: [{ score_value: 125, score_type: 'time', completed_at: '2026-09-01' }] }];
    await mount();
    expect(has('training-last')).toBe(true);
    expect(texts()).toEqual(expect.arrayContaining(['Dernière séance', 'Séance du test', "Functional · Aujourd'hui · Score : 02:05"]));
    await act(async () => { byId('training-last-relaunch').props.onPress(); });
    const [route, p] = mockNavigate.mock.calls[0];
    expect(route).toBe('WodResult');
    expect(p.result.wod).toBe(wod);
    expect(p.screen).toEqual(expect.objectContaining({ entry: wod.entry, discipline: 'functional', exclude: ['burpee'] }));
  });

  it('« Dernière séance » : un brouillon plus récent que l’historique est repris avec son score', async () => {
    mockRows = [{ created_at: '2020-01-01T00:00:00.000Z', wod_json: { ...wod, title: 'Ancienne' }, scores: [] }];
    mockDraft = { savedAt: new Date().toISOString(), screen: params, result: { wod, params, category: 'rx' }, submittedScore: { value: 7, scoreType: 'rounds' } as WodDraft['submittedScore'] };
    await mount();
    expect(texts()).toContain('Séance du test');
    expect(texts()).not.toContain('Ancienne');
    await act(async () => { byId('training-last-relaunch').props.onPress(); });
    expect(mockNavigate.mock.calls[0][1]).toEqual(expect.objectContaining({ screen: params, result: mockDraft.result }));
  });
});

describe('HomeExplorerBlock', () => {
  it('trois lignes : Trouver une box → BoxDirectory, Programmes → Programmation, Partenaires → Partners', async () => {
    const onOpen = jest.fn();
    await act(async () => { renderer = TestRenderer.create(<HomeExplorerBlock onOpen={onOpen} />); });
    expect(texts()).toEqual(['Trouver une box', 'Programmes', 'Partenaires']);
    for (const r of ['BoxDirectory', 'Programmation', 'Partners']) {
      await act(async () => { byId(`home-explorer-${r}`).props.onPress(); });
    }
    expect(onOpen.mock.calls).toEqual([['BoxDirectory'], ['Programmation'], ['Partners']]);
  });
});

describe('Retours iPhone (10) : tuiles Outils centrées', () => {
  it('icône et texte centrés dans les quatre tuiles', async () => {
    await mount();
    for (const key of ['timer', 'onerm', 'history', 'favorites']) {
      const tile = renderer.root.findAll((n) => n.props.testID === `training-tool-${key}` && typeof n.type !== 'string')[0];
      expect(StyleSheet.flatten(tile.props.style)).toMatchObject({ alignItems: 'center', justifyContent: 'center' });
      const label = tile.findAllByType(Text)[0];
      expect(StyleSheet.flatten(label.props.style).textAlign).toBe('center');
    }
  });
});
