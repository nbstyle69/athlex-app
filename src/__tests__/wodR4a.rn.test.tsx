import React, { useEffect as mockUseEffect } from 'react';
import { Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import {
  BANK_V1 as mockBank, CATALOG_SNAPSHOT as mockCatalog, generateBlocC, generateMuscu, GenerateParams,
} from '../../packages/wod-engine/src';
import { lightTheme, darkTheme } from '../theme/palette';
import { axTypography } from '../theme/axTokens';
import WodGeneratorScreen from '../screens/wod/WodGeneratorScreen';
import WodResultScreen from '../screens/wod/WodResultScreen';
import StrengthSetGrid from '../components/wod/StrengthSetGrid';
import { AxButton, AxCard, AxChip, AxSwitch, AxTag, AxTextField } from '../components/ax';
// Relevé sur master avant R4a (même fonction structure(), mêmes données fictives).
import BEFORE from './wodR4aStructureBefore.json';

const mockNavigate = jest.fn();
let mockTheme = lightTheme;
let mockRouteParams: Record<string, unknown> = {};
const mockGenerateForUser = jest.fn();
const mockRedraw = jest.fn();
const mockSetFavorite = jest.fn();
const mockSaveGenerated = jest.fn();
const mockAddToWhiteboard = jest.fn();
const mockSubmitScore = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
  useFocusEffect: (callback: () => () => void) => mockUseEffect(callback, [callback]),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'local', level: 'rx' }, currentBox: { id: 'local-box', name: 'AthleX Fitness' } }),
}));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/haptics', () => ({ hapticSuccess: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/wodEngineData', () => ({ loadEngineData: async () => ({ catalog: mockCatalog, bank: mockBank }) }));
jest.mock('../services/wodDraft', () => ({
  loadWodDraft: async () => null, saveWodDraft: jest.fn(async () => undefined), clearWodDraft: jest.fn(async () => undefined),
}));
jest.mock('../services/muscuSession', () => ({
  ...jest.requireActual('../services/muscuSession'), findResumableMuscuSession: async () => null,
}));
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: async () => ({}) }));
jest.mock('../services/strengthSets', () => ({
  ...jest.requireActual('../services/strengthSets'),
  loadStrengthGrid: jest.fn(async () => ({ origin: 'prescription', drafts: [] })),
  fetchStrengthSession: jest.fn(async () => null),
  saveStrengthDraft: jest.fn(async () => ({ status: 'saved' })),
}));
jest.mock('../services/wodGenerator', () => ({
  ...jest.requireActual('../services/wodGenerator'),
  loadExcludes: async () => [], loadMuscuEquipment: async () => 'box', loadAdaptToPr: async () => true,
  todayClass: async () => null,
  generateForUser: (...a: unknown[]) => mockGenerateForUser(...a),
  redraw: (...a: unknown[]) => mockRedraw(...a),
  setFavorite: (...a: unknown[]) => mockSetFavorite(...a),
  saveGeneratedWod: (...a: unknown[]) => mockSaveGenerated(...a),
  addToWhiteboard: (...a: unknown[]) => mockAddToWhiteboard(...a),
  submitGeneratedScore: (...a: unknown[]) => mockSubmitScore(...a),
}));
jest.mock('../components/wod/TimerLaunchModal', () => {
  const { View } = jest.requireActual('react-native');
  return (props: { visible: boolean }) => (props.visible ? <View testID="timer-launch-modal" /> : null);
});
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const EMOJI = /\p{Extended_Pictographic}/u;
const LONG = 'Une séance au titre particulièrement long pour vérifier qu’aucun texte ne déborde de l’écran';
const fParams: GenerateParams = {
  entry: 'express', discipline: 'functional', budget_min: 15, format: 'amrap',
  intention: 'mixed', vest: 'none', exclude: [], profile_category: 'rx',
};
const hParams: GenerateParams = { ...fParams, discipline: 'hybrid', format: 'for_time' as GenerateParams['format'] };
const fWod = { ...generateBlocC(fParams, mockCatalog, mockBank, 42), title: LONG };
const hWod = { ...generateBlocC(hParams, mockCatalog, mockBank, 7), title: LONG };
const mWod = generateMuscu({ entry: 'express', target: 'push', objective: 'hypertrophie', budget_min: 45, equipment: 'box', level: 'inter' }, mockCatalog, mockBank, 7);
const RESULTS = {
  functional: { screen: { entry: 'express', discipline: 'functional', intention: 'mixed', exclude: [], format: 'amrap', vest: 'none' }, result: { wod: fWod, params: fParams, category: 'rx' } },
  hybrid: { screen: { entry: 'express', discipline: 'hybrid', intention: 'mixed', exclude: [], format: 'for_time', vest: 'none' }, result: { wod: hWod, params: hParams, category: 'rx' } },
  musculation: { screen: { entry: 'express', discipline: 'musculation', target: 'push', objective: 'hypertrophie', equipment: 'box', exclude: [] }, result: { wod: mWod, params: fParams, category: 'rx' } },
} as const;
type Sport = keyof typeof RESULTS;
const SPORTS: Sport[] = ['functional', 'hybrid', 'musculation'];

let renderer: TestRenderer.ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.clearAllMocks();
});

const press = async (root: ReactTestInstance, testID: string) => {
  const node = root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === 'function')[0];
  await act(async () => { node.props.onPress(); });
};

async function mountGenerator(sport: Sport, theme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(<WodGeneratorScreen />); });
  if (sport !== 'functional') await press(renderer.root, `wodgen-discipline-${sport}`);
  return renderer.root;
}
async function mountResult(sport: Sport, theme = lightTheme) {
  mockTheme = theme;
  mockRouteParams = RESULTS[sport];
  await act(async () => { renderer = TestRenderer.create(<WodResultScreen />); });
  return renderer.root;
}

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
/** Suite ordonnée des textes visibles hors fenêtres : ordre des blocs + libellés. */
function structure(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string, inModal: boolean) => {
    if (typeof n === 'string') return;
    if (n.type === Modal) return;
    if (isHostText(n)) {
      const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
      if (!inModal) out.push(upper ? hostText(n).toUpperCase() : hostText(n));
      return;
    }
    n.children.forEach((ch) => walk(ch, inModal));
  };
  walk(root, false);
  return out.filter((t) => t.trim().length > 0);
}
const accentButtons = (root: ReactTestInstance) => root.findAllByType(AxButton)
  .filter((b) => (b.props.variant ?? 'accent') === 'accent')
  .filter((b) => !b.findAll((n) => n.type === Modal).length)
  .filter((b) => !isInsideModal(b));
function isInsideModal(n: ReactTestInstance): boolean {
  for (let p = n.parent; p; p = p.parent) if (p.type === Modal) return true;
  return false;
}


describe('R4a — ordre des blocs et libellés inchangés (instantané avant / après)', () => {
  for (const sport of SPORTS) {
    it(`générateur ${sport}`, async () => {
      const root = await mountGenerator(sport);
      // Seule différence admise : les emoji 🏋️ / 🏁 des cartes Functional / Hybrid, remplacés par des icônes Lucide.
      expect(structure(root)).toEqual(BEFORE[`générateur-${sport}`].filter((t) => !EMOJI.test(t)));
    });
    it(`résultat ${sport}`, async () => {
      const root = await mountResult(sport);
      expect(structure(root)).toEqual(BEFORE[`résultat-${sport}`]);
    });
  }
});

describe('R4a — une seule action accent par écran, aucun emoji', () => {
  for (const sport of SPORTS) {
    for (const theme of [lightTheme, darkTheme]) {
      it(`${theme.mode} : générateur ${sport}`, async () => {
        const root = await mountGenerator(sport, theme);
        const accents = accentButtons(root);
        expect(accents.map((b) => b.props.testID)).toEqual(['wodgen-generate']);
        expect(structure(root).some((t) => EMOJI.test(t))).toBe(false);
      });
      it(`${theme.mode} : résultat ${sport}`, async () => {
        const root = await mountResult(sport, theme);
        expect(accentButtons(root).map((b) => b.props.testID)).toEqual(['wodresult-score']);
        expect(root.findByProps({ testID: 'wodresult-whiteboard' }).props.variant).toBe('outline');
        expect(structure(root).some((t) => EMOJI.test(t))).toBe(false);
      });
    }
  }
});

describe('R4a — couleurs et typographies clés', () => {
  for (const theme of [lightTheme, darkTheme]) {
    const c = theme.ax;
    it(`${theme.mode} : générateur — AxChip, AxSwitch, AxTextField, titres overline, sélection accent`, async () => {
      const root = await mountGenerator('functional', theme);
      const chips = root.findAllByType(AxChip);
      expect(chips.length).toBeGreaterThan(4);
      expect(chips.filter((ch) => ch.props.selected).length).toBeGreaterThan(0);
      const format = root.findAll((n) => isHostText(n) && hostText(n) === 'Format')[0];
      expect(StyleSheet.flatten(format.props.style)).toMatchObject({ fontFamily: axTypography.overline.fontFamily, fontSize: 12, textTransform: 'uppercase', color: c.textMuted });
      const entry = root.findAll((n) => n.props.testID === 'wodgen-entry-express' && n.props.style)[0];
      expect(StyleSheet.flatten(entry.props.style)).toMatchObject({ borderColor: c.accentText, backgroundColor: c.surface });
      expect(StyleSheet.flatten(root.findByProps({ testID: 'wodgen-discipline' }).props.style).color).toBe(c.accentText);
      await press(root, 'wodgen-advanced');
      expect(root.findAllByType(AxSwitch).map((s) => s.props.testID)).toEqual(['wodgen-adapt-pr']);
      expect(root.findAllByType(AxTextField).map((s) => s.props.testID)).toEqual(['wodgen-exclude-search']);
      expect(root.findByType(AxTextField).props.autoCapitalize).toBe('none');
    });

    it(`${theme.mode} : résultat — carte featured, AxTag « Généré », titre titleL, puces accent`, async () => {
      const root = await mountResult('functional', theme);
      const card = root.findAllByType(AxCard).find((x) => x.props.testID === 'wodresult-card')!;
      expect(card.props.variant).toBe('featured');
      const tag = root.findByType(AxTag);
      expect(tag.props).toMatchObject({ label: 'Généré', tone: 'accent' });
      const title = root.findAll((n) => n.props.testID === 'wodresult-title' && typeof n.type === 'string')[0];
      expect(StyleSheet.flatten(title.props.style)).toMatchObject({ fontFamily: axTypography.titleL.fontFamily, fontSize: 26, textTransform: 'uppercase', color: c.text });
      expect(title.props.numberOfLines).toBeUndefined();
      const move = root.findAll((n) => n.props.testID === 'wodresult-move-0' && typeof n.props.onPress === 'function')[0];
      const bullet = move.findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.width === 6)[0];
      expect(StyleSheet.flatten(bullet.props.style).backgroundColor).toBe(c.accent);
      const moveText = move.findAll((n) => isHostText(n))[0];
      expect(StyleSheet.flatten(moveText.props.style)).toMatchObject({ fontFamily: axTypography.label.fontFamily, color: c.text });
    });

    it(`${theme.mode} : fenêtre score — AxChip RX / Scaled et types, AxTextField, une action accent`, async () => {
      const root = await mountResult('functional', theme);
      await press(root, 'wodresult-score');
      const modal = root.findAllByType(Modal).find((m) => m.props.visible && m.findAll((n) => n.props.testID === 'wodresult-score-input').length)!;
      const chips = modal.findAllByType(AxChip).map((ch) => ch.props.testID);
      expect(chips).toEqual(expect.arrayContaining(['wodresult-score-cat-rx', 'wodresult-score-cat-scaled', 'wodresult-score-type-time']));
      expect(modal.findAllByType(AxTextField).map((f) => f.props.testID)).toEqual(['wodresult-score-input', 'wodresult-score-notes']);
      expect(modal.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent').map((b) => b.props.testID)).toEqual(['wodresult-score-submit']);
    });

    it(`${theme.mode} : musculation — carte séance AxCard, champs AxTextField compacts, « Série suivante » outline`, async () => {
      const root = await mountResult('musculation', theme);
      expect(root.findAllByType(AxCard).some((x) => x.props.testID === 'muscu-session-card')).toBe(true);
      if (!root.findAll((n) => n.props.testID === 'muscu-kg-0-0').length) {
        const head = root.findAll((n) => n.props.testID === 'muscu-exercise-0')[0].findAll((n) => typeof n.props.onPress === 'function')[0];
        await act(async () => { head.props.onPress(); });
      }
      const fields = root.findAllByType(AxTextField).filter((f) => /^muscu-(reps|kg)-/.test(f.props.testID));
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.every((f) => f.props.compact)).toBe(true);
      expect(root.findByProps({ testID: 'muscu-next-set' }).props.variant).toBe('outline');
    });
  }
});

describe('R4a — grille de musculation (StrengthSetGrid)', () => {
  for (const theme of [lightTheme, darkTheme]) {
    it(`${theme.mode} : champs compacts, « prévu » caption textMuted, écart en accentText`, async () => {
      mockTheme = theme;
      const onChange = jest.fn();
      const drafts = [
        { entryIndex: 0, setIndex: 1, name: 'Back Squat', reps: '5', loadKg: '100', prescribedReps: 5, prescribedLoadKg: 100 },
        { entryIndex: 0, setIndex: 2, name: 'Back Squat', reps: '5', loadKg: '110', prescribedReps: 5, prescribedLoadKg: 100 },
      ];
      await act(async () => { renderer = TestRenderer.create(<StrengthSetGrid drafts={drafts} onChange={onChange} />); });
      const root = renderer.root;
      const fields = root.findAllByType(AxTextField);
      expect(fields.map((f) => f.props.testID)).toEqual(['strength-reps-0', 'strength-kg-0', 'strength-reps-1', 'strength-kg-1']);
      expect(fields.every((f) => f.props.compact)).toBe(true);
      const prevus = root.findAll((n) => isHostText(n) && hostText(n).startsWith('prévu'));
      expect(prevus).toHaveLength(2);
      expect(StyleSheet.flatten(prevus[0].props.style)).toMatchObject({ fontSize: axTypography.caption.fontSize, color: theme.ax.textMuted });
      expect(StyleSheet.flatten(prevus[1].props.style).color).toBe(theme.ax.accentText);
      await act(async () => { fields[1].props.onChangeText('102,5'); });
      expect(onChange).toHaveBeenLastCalledWith(0, { loadKg: '102.5' });
    });
  }
});

describe('R4a — navigation et callbacks inchangés', () => {
  it('générer : même service, brouillon, puis WodResult', async () => {
    const res = RESULTS.functional.result;
    mockGenerateForUser.mockResolvedValue(res);
    const root = await mountGenerator('functional');
    await press(root, 'wodgen-generate');
    expect(mockGenerateForUser).toHaveBeenCalledTimes(1);
    expect(mockGenerateForUser.mock.calls[0][2]).toMatchObject({ discipline: 'functional', entry: 'express' });
    expect(mockNavigate).toHaveBeenCalledWith('WodResult', expect.objectContaining({ result: res }));
  });

  it('options avancées : ouvre le bloc, l’interrupteur PR et le champ d’exclusion', async () => {
    const root = await mountGenerator('functional');
    expect(root.findAllByProps({ testID: 'wodgen-adapt-pr' })).toHaveLength(0);
    await press(root, 'wodgen-advanced');
    expect(root.findAllByType(AxSwitch)).toHaveLength(1);
  });

  it('menu : historique, favoris, programmes', async () => {
    const root = await mountGenerator('functional');
    await press(root, 'wodgen-menu-history');
    await press(root, 'wodgen-menu-favorites');
    await press(root, 'wodgen-menu-programs');
    expect(mockNavigate.mock.calls).toEqual([
      ['WodHistory'], ['WodHistory', { filter: 'favorites' }], ['Home', { screen: 'Programmation' }],
    ]);
  });

  it('résultat : re-tirer, favori, minuteur, Whiteboard, saisir / valider le score', async () => {
    mockRedraw.mockResolvedValue(RESULTS.functional.result);
    mockSaveGenerated.mockResolvedValue('gen-1');
    mockSetFavorite.mockResolvedValue(undefined);
    mockAddToWhiteboard.mockResolvedValue('box-wod-1');
    mockSubmitScore.mockResolvedValue({ id: 'score-1' });
    const root = await mountResult('functional');

    await press(root, 'wodresult-redraw');
    expect(mockRedraw).toHaveBeenCalledTimes(1);

    await press(root, 'wodresult-favorite');
    expect(mockSetFavorite).toHaveBeenCalled();

    await press(root, 'wodresult-timer');
    expect(root.findAllByProps({ testID: 'timer-launch-modal' }).length).toBeGreaterThan(0);

    await press(root, 'wodresult-whiteboard');
    await press(root, 'wodresult-wb-confirm');
    expect(mockAddToWhiteboard).toHaveBeenCalledTimes(1);

    await press(root, 'wodresult-score');
    const input = root.findAll((n) => n.props.testID === 'wodresult-score-input' && typeof n.props.onChangeText === 'function')[0];
    await act(async () => { input.props.onChangeText('1234'); });
    await press(root, 'wodresult-score-submit');
    expect(mockSubmitScore).toHaveBeenCalledTimes(1);
  });
});

describe('R4a — aucun débordement à 390 px, textes longs', () => {
  const SCREEN = 390;
  const widths = (root: ReactTestInstance) => root.findAll((n) => typeof n.type === 'string')
    .map((n) => StyleSheet.flatten(n.props.style)?.width)
    .filter((w): w is number => typeof w === 'number');
  for (const sport of SPORTS) {
    it(`générateur et résultat ${sport} : aucune largeur fixe > 350, titre long jamais tronqué`, async () => {
      let root = await mountGenerator(sport);
      expect(Math.max(0, ...widths(root))).toBeLessThanOrEqual(SCREEN - 40);
      for (const id of ['wodgen-entry-express', 'wodgen-discipline-functional']) {
        const card = root.findAll((n) => n.props.testID === id && n.props.style)[0];
        expect(StyleSheet.flatten(card.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
      }
      await act(async () => renderer.unmount());
      root = await mountResult(sport);
      expect(Math.max(0, ...widths(root))).toBeLessThanOrEqual(SCREEN - 40);
      const texts = root.findAll((n) => isHostText(n));
      expect(texts.filter((t) => hostText(t).includes(LONG.toUpperCase()) || hostText(t).includes(LONG)).every((t) => t.props.numberOfLines === undefined)).toBe(true);
      root.findAllByType(AxButton).forEach((b) => {
        const wrapper = b.parent!;
        if (b.props.testID === 'wodresult-whiteboard' || b.props.testID === 'wodresult-score') {
          expect(StyleSheet.flatten(wrapper.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
        }
      });
    });
  }
});


/** Largeur estimée d'un libellé Inter demi-gras (0,58 em par caractère, borne haute). */
const estTextWidth = (s: string, fontSize: number) => Math.ceil(s.length * fontSize * 0.58);

describe('Retours iPhone (8) : boutons Whiteboard et score de « Ton WOD »', () => {
  it('même hauteur, une seule ligne à 390 px, icônes alignées de la même façon', async () => {
    const root = await mountResult('functional');
    const btns = ['wodresult-whiteboard', 'wodresult-score'].map((id) => root.findAllByType(AxButton).find((b) => b.props.testID === id)!);
    expect(btns.every(Boolean)).toBe(true);
    const cells = btns.map((b) => StyleSheet.flatten(b.parent!.props.style));
    for (const cell of cells) expect(cell).toMatchObject({ flex: 1, minWidth: 0 });
    let row = btns[0].parent!.parent!;
    while (typeof row.type !== 'string') row = row.parent!;
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', alignItems: 'stretch' });
    const cellW = (390 - 2 * 20 - 10) / 2;
    for (const b of btns) {
      expect(b.props.numberOfLines).toBe(1);
      expect(b.props.fullWidth).toBe(true);
      expect(b.findAllByProps({ testID: 'ax-button-icon' }).filter((n) => typeof n.type !== 'string')[0].props.size).toBe(16);
      for (const label of [b.props.label]) expect(estTextWidth(label, 14) + 16 + 8 + 2 * 16 + 2).toBeLessThanOrEqual(cellW);
      expect(b.props.accessibilityLabel).toMatch(/Whiteboard|score/);
    }
    expect(btns.map((b) => b.props.accessibilityLabel)).toEqual(['Ajouter au Whiteboard', 'Saisir mon score']);
    const boxH = btns.map((b) => {
      const st = StyleSheet.flatten(b.findAll((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button')[0].props.style);
      return 2 * ((st.paddingVertical as number) + ((st.borderWidth as number) ?? 0));
    });
    expect(boxH[0]).toBe(boxH[1]);
  });
});

describe('i18n 1b : « Ton WOD » en anglais', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const i18n = require('../i18n').default;
  afterAll(() => i18n.changeLanguage('fr'));

  it.each(SPORTS)('%s : libellés de l’écran en anglais, plus aucun libellé français de l’interface', async (sport) => {
    await i18n.changeLanguage('en');
    const root = await mountResult(sport);
    const texts = structure(root);
    const all = texts.join('\n');
    for (const label of ['Redraw', 'Favorite', 'Timer', 'More', 'Estimated time']) expect(all).toMatch(new RegExp(label, 'i'));
    expect(all).toMatch(/GENERATED/i);
    for (const fr of ['Re-tirer', 'Favori', 'Minuteur', 'Plus', 'Généré', 'Durée estimée', 'Toutes catégories', 'Voir toutes les catégories', 'repos compris']) {
      expect(texts.filter((t) => t.toLowerCase() === fr.toLowerCase() || (fr.includes(' ') && t.includes(fr)))).toEqual([]);
    }
    if (sport === 'musculation') expect(all).toMatch(/exercises · rest included/);
    else {
      expect(all).toContain('Shown for: RX · based on your profile');
      expect(all).toContain('Show all categories');
    }
  });
});

describe('i18n 1a : le générateur envoie les mêmes valeurs en français et en anglais', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const i18n = require('../i18n').default;
  afterAll(() => i18n.changeLanguage('fr'));

  const choix: Record<Sport, string[]> = {
    functional: ['wodgen-entry-express', 'wodgen-format-emom'],
    hybrid: ['wodgen-entry-after_class'],
    musculation: ['wodgen-equipment-gym', 'wodgen-target-dos'],
  };
  async function envoi(sport: Sport, lang: 'fr' | 'en') {
    await i18n.changeLanguage(lang);
    mockGenerateForUser.mockReset();
    mockGenerateForUser.mockResolvedValue(RESULTS[sport].result);
    const root = await mountGenerator(sport);
    for (const id of choix[sport]) if (root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function').length) await press(root, id);
    await press(root, 'wodgen-generate');
    const screen = mockGenerateForUser.mock.calls[0][2];
    await act(async () => renderer.unmount());
    return screen;
  }

  it.each(SPORTS)('%s : paramètres identiques', async (sport) => {
    const fr = await envoi(sport, 'fr');
    const en = await envoi(sport, 'en');
    expect(en).toEqual(fr);
    expect(fr).toMatchObject({ discipline: sport === 'musculation' ? 'musculation' : sport });
    // les choix ont bien été faits (valeurs internes, pas les libellés)
    if (sport === 'functional') expect(fr).toMatchObject({ format: 'emom' });
    if (sport === 'hybrid') expect(fr).toMatchObject({ entry: 'after_class' });
    if (sport === 'musculation') expect(fr).toMatchObject({ equipment: 'gym', target: 'dos' });
  });

  it('en anglais, la discipline Musculation s’affiche « Strength »', async () => {
    await i18n.changeLanguage('en');
    const root = await mountGenerator('musculation');
    const texts = structure(root);
    expect(texts).toContain('Strength');
    expect(texts.filter((t) => /musculation/i.test(t))).toEqual([]);
  });

  // Décision produit : l'objectif « Force » se dit « Max Strength », la discipline « Strength ».
  const objectiveLabel = (root: ReactTestInstance) => hostText(root.findAll((n) => n.props.testID === 'wodgen-objective-force')[0]
    .findAll((n) => isHostText(n))[0]);
  const insideDiscipline = (n: ReactTestInstance) => {
    for (let p: ReactTestInstance | null = n; p; p = p.parent) if (/^wodgen-discipline/.test(p.props.testID ?? '')) return true;
    return false;
  };

  it('en anglais : objectif « Max Strength », « Strength » réservé à la discipline', async () => {
    await i18n.changeLanguage('en');
    const root = await mountGenerator('musculation');
    expect(objectiveLabel(root)).toBe('Max Strength');
    const strength = root.findAll((n) => isHostText(n) && hostText(n) === 'Strength');
    expect(strength.length).toBeGreaterThan(0);
    expect(strength.filter((n) => !insideDiscipline(n)).map(hostText)).toEqual([]);
  });

  it('en français : objectif « Force », discipline « Musculation », inchangés', async () => {
    await i18n.changeLanguage('fr');
    const root = await mountGenerator('musculation');
    expect(objectiveLabel(root)).toBe('Force');
    expect(structure(root)).toContain('Musculation');
  });
});
