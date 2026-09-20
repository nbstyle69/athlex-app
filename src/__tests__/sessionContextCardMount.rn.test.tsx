import React, { useEffect as mockUseEffect } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BANK_V1 as mockBank, CATALOG_SNAPSHOT as mockCatalog, generateBlocC, GenerateParams } from '../../packages/wod-engine/src';
import { lightTheme, darkTheme } from '../theme/palette';
import type { WodDraft } from '../services/wodDraft';
import WodGeneratorScreen from '../screens/wod/WodGeneratorScreen';
import SessionContextCard from '../components/wod/SessionContextCard';
import GlassCard from '../components/glass/GlassCard';

const mockNavigate = jest.fn();
let mockTheme = lightTheme;
const params: GenerateParams = {
  entry: 'express', discipline: 'functional', budget_min: 15, format: 'amrap',
  intention: 'mixed', vest: 'none', exclude: [], profile_category: 'rx',
};
const mockDraft: WodDraft = {
  savedAt: '2026-09-20T12:00:00.000Z',
  screen: params,
  result: {
    wod: { ...generateBlocC(params, mockCatalog, mockBank, 42), title: 'Une séance avec un titre long qui doit rester lisible sur plusieurs lignes' },
    params, category: 'rx',
  },
  submittedScore: null,
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback: () => () => void) => mockUseEffect(callback, [callback]),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'local', level: 'rx' }, currentBox: { id: 'local-box', name: 'AthleX Fitness' } }),
}));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../services/wodEngineData', () => ({ loadEngineData: async () => ({ catalog: mockCatalog, bank: mockBank }) }));
jest.mock('../services/wodDraft', () => ({ loadWodDraft: async () => mockDraft }));
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: async () => ({}) }));
jest.mock('../services/wodGenerator', () => ({
  loadExcludes: async () => [], loadMuscuEquipment: async () => 'box',
  todayClass: async () => ({ title: 'Une classe avec un titre long et des mouvements à éviter', movements: ['20 Air Squats'] }),
}));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const originalOS = Platform.OS;
let renderer: TestRenderer.ReactTestRenderer;

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  Platform.OS = originalOS;
});

for (const os of ['ios', 'android'] as const) {
  for (const theme of [lightTheme, darkTheme]) {
    it(`${os}/${theme.mode} : les deux encarts montent le même composant, avec padding intérieur et reprise du brouillon`, async () => {
      Platform.OS = os;
      mockTheme = theme;
      mockNavigate.mockClear();
      await act(async () => { renderer = TestRenderer.create(<WodGeneratorScreen />); });
      const afterClass = renderer.root.findAll((node) => node.props.testID === 'wodgen-entry-after_class' && typeof node.props.onPress === 'function')[0];
      await act(async () => { afterClass.props.onPress(); });

      const cards = renderer.root.findAllByType(SessionContextCard);
      expect(cards.map((card) => card.props.label)).toEqual([
        'Dernière séance générée', 'Classe du jour · AthleX Fitness',
      ]);
      expect(cards[0].findAllByType(TouchableOpacity)).toHaveLength(1);
      expect(cards[1].findAllByType(TouchableOpacity)).toHaveLength(0);
      for (const card of cards) {
        const glass = card.findByType(GlassCard);
        expect(glass.props.radius).toBe(14);
        expect(StyleSheet.flatten(glass.props.style).padding).toBeUndefined();
        const content = glass.findAll((node) => node.type === View && node.props.testID === `${card.props.testID}-content`)[0];
        expect(StyleSheet.flatten(content.props.style).padding).toBe(16);
        const texts = content.findAllByType(Text);
        expect(StyleSheet.flatten(texts[0].props.style).textTransform).toBe('uppercase');
        expect(StyleSheet.flatten(texts[1].props.style).color).toBe(theme.text);
        expect(texts.every((text) => text.props.numberOfLines === undefined)).toBe(true);
      }
      const resume = cards[0].findAll((node) => node.props.testID === 'wodgen-draft-resume' && typeof node.props.onPress === 'function')[0];
      await act(async () => { resume.props.onPress(); });
      expect(mockNavigate).toHaveBeenCalledWith('WodResult', {
        screen: mockDraft.screen, result: mockDraft.result,
        draft: { performed: undefined, submittedScore: null },
      });
    }, 20_000);
  }
}
