/**
 * Moteur M4 (#528) — l'écran de résultat montés pour de vrai, en français puis en anglais :
 * titre, en-tête, séance Musculation, Copier / Partager, minuteur Split. Une génération par discipline.
 */
import React, { useEffect as mockUseEffect } from 'react';
import { Modal, Share, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import {
  BANK_V1 as mockBank, CATALOG_SNAPSHOT as mockCatalog, generateBlocC, generateMuscu, GenerateParams, mouvements, renderFromWodJson,
} from '../../packages/wod-engine/src';
import { lightTheme } from '../theme/palette';
import WodResultScreen from '../screens/wod/WodResultScreen';
import i18n from '../i18n';
import { displayStimulusNote, exerciseName } from '../services/wodRender';

let mockRouteParams: Record<string, unknown> = {};
let mockTimerProps: any = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
  useFocusEffect: (callback: () => () => void) => mockUseEffect(callback, [callback]),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'local', level: 'rx' }, currentBox: { id: 'local-box', name: 'AthleX Fitness' } }),
}));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: require('../theme/palette').lightTheme }) }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/haptics', () => ({ hapticSuccess: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
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
jest.mock('../components/wod/TimerLaunchModal', () => (props: unknown) => { mockTimerProps = props; return null; });
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;
const fParams: GenerateParams = {
  entry: 'express', discipline: 'functional', budget_min: 15, format: 'amrap', intention: 'mixed', vest: 'none', exclude: [], profile_category: 'rx',
};
const hParams: GenerateParams = { ...fParams, discipline: 'hybrid', format: 'for_time' as GenerateParams['format'] };
const fWod = generateBlocC(fParams, mockCatalog, mockBank, 42);
/** Après ma classe : la classe du jour écarte des patterns et du matériel (ligne « Complément : évite »). */
const acParams: GenerateParams = {
  ...fParams, entry: 'after_class', format: 'surprise' as GenerateParams['format'],
  after_class: { day_movements: ['Back Squat', 'Thrusters', 'Pull-ups'], box_wod_title: null },
};
const acWod = generateBlocC(acParams, mockCatalog, mockBank, 3);
const acHParams: GenerateParams = { ...acParams, discipline: 'hybrid' };
const acHWod = generateBlocC(acHParams, mockCatalog, mockBank, 3);
const hWod = generateBlocC(hParams, mockCatalog, mockBank, 7);
const mWod = generateMuscu({ entry: 'express', target: 'push', objective: 'hypertrophie', budget_min: 45, equipment: 'box', level: 'inter' }, mockCatalog, mockBank, 7);
const RESULTS = {
  functional: { screen: { entry: 'express', discipline: 'functional', intention: 'mixed', exclude: [], format: 'amrap', vest: 'none' }, result: { wod: fWod, params: fParams, category: 'rx' } },
  hybrid: { screen: { entry: 'express', discipline: 'hybrid', intention: 'mixed', exclude: [], format: 'for_time', vest: 'none' }, result: { wod: hWod, params: hParams, category: 'rx' } },
  musculation: { screen: { entry: 'express', discipline: 'musculation', target: 'push', objective: 'hypertrophie', equipment: 'box', exclude: [] }, result: { wod: mWod, params: fParams, category: 'rx' } },
  apresClasseHybrid: { screen: { entry: 'after_class', discipline: 'hybrid', intention: 'mixed', exclude: [], format: 'surprise', vest: 'none' }, result: { wod: acHWod, params: acHParams, category: 'rx' } },
  apresClasse: { screen: { entry: 'after_class', discipline: 'functional', intention: 'mixed', exclude: [], format: 'surprise', vest: 'none' }, result: { wod: acWod, params: acParams, category: 'rx' } },
} as const;
type Sport = keyof typeof RESULTS;
const SPORTS: Sport[] = ['functional', 'hybrid', 'musculation'];

let renderer: TestRenderer.ReactTestRenderer;
let shareSpy: jest.SpyInstance;
beforeEach(() => { shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any); mockTimerProps = null; });
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  shareSpy.mockRestore();
});
afterAll(() => i18n.changeLanguage('fr'));

async function mount(sport: Sport, langue: 'fr' | 'en') {
  await i18n.changeLanguage(langue);
  mockRouteParams = RESULTS[sport];
  await act(async () => { renderer = TestRenderer.create(<WodResultScreen />); });
  return renderer.root;
}
const press = async (root: ReactTestInstance, testID: string) => {
  const node = root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === 'function')[0];
  await act(async () => { node.props.onPress(); });
};
const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
function textes(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string' || n.type === Modal) return;
    if (isHostText(n)) {
      const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
      out.push(upper ? hostText(n).toUpperCase() : hostText(n));
      return;
    }
    n.children.forEach(walk);
  };
  walk(root);
  return out.filter((t) => t.trim().length > 0);
}
const wodOf = (s: Sport) => RESULTS[s].result.wod as any;

describe.each(SPORTS)('résultat %s', (sport) => {
  it('français : titre et en-tête = texte enregistré', async () => {
    const root = await mount(sport, 'fr');
    const w = wodOf(sport);
    expect(hostText(root.findByProps({ testID: 'wodresult-title' }))).toBe(w.title.toUpperCase());
    expect(textes(root)).toContain(w.description.split('\n')[0]);
  });

  it('anglais : titre et en-tête = rendu anglais du moteur, aucun accent', async () => {
    const root = await mount(sport, 'en');
    const en = renderFromWodJson(wodOf(sport), 'en')!;
    expect(hostText(root.findByProps({ testID: 'wodresult-title' }))).toBe(en.title.toUpperCase());
    expect(textes(root)).toContain(en.description.split('\n')[0]);
    if (sport === 'musculation') expect(en.title).not.toBe(wodOf(sport).title);
  });

  it('stimulus et durée estimée : la note dans la langue affichée', async () => {
    for (const langue of ['fr', 'en'] as const) {
      const w = wodOf(sport);
      const note = langue === 'fr' ? w.stimulus.note : (sport === 'musculation'
        ? renderFromWodJson(w, 'en')!.notes : displayStimulusNote(w, 'en'));
      const root = await mount(sport, langue);
      const attendu = i18n.t('wodResult.stimulus', { rpe: String(w.stimulus.rpe).replace(/\.0$/, ''), note });
      expect(textes(root)).toContain(attendu);
      await act(async () => renderer.unmount());
    }
  });

  it('Copier et Partager : le texte affiché, dans la langue affichée', async () => {
    for (const langue of ['fr', 'en'] as const) {
      shareSpy.mockClear();
      const root = await mount(sport, langue);
      const w = wodOf(sport);
      const d = langue === 'fr' ? { title: w.title, description: w.description } : renderFromWodJson(w, 'en')!;
      await press(root, 'wodresult-more');
      await press(root, 'wodresult-share');
      expect(shareSpy).toHaveBeenLastCalledWith({ message: `${d.title}\n${d.description}` });
      await press(root, 'wodresult-more');
      await press(root, 'wodresult-copy');
      expect(shareSpy).toHaveBeenLastCalledWith({ message: `${d.title}\n${d.description}` });
      await act(async () => renderer.unmount());
    }
  });

  it('minuteur : titre issu du rendu de la langue affichée', async () => {
    for (const langue of ['fr', 'en'] as const) {
      await mount(sport, langue);
      const w = wodOf(sport);
      const titre = langue === 'fr' ? w.title : renderFromWodJson(w, 'en')!.title;
      expect(mockTimerProps.title).toBe(titre);
      await act(async () => renderer.unmount());
    }
  });
});

describe('Musculation — carte de séance et minuteur Split', () => {
  it('anglais : lignes d’exercice et notes sans français, mêmes exercices que le français', async () => {
    const fr = textes(await mount('musculation', 'fr'));
    await act(async () => renderer.unmount());
    const root = await mount('musculation', 'en');
    const en = textes(root);
    const exos = mWod.blocks[0].exercises;
    expect(en.some((t) => t.includes('muscu') || /séries|repos/.test(t))).toBe(false);
    for (const e of exos) expect(en.some((t) => t.startsWith(exerciseName(e, 'en')))).toBe(true);
    const schemes = en.filter((t) => / × \d+/.test(t));
    expect(schemes.length).toBeGreaterThanOrEqual(exos.length);
    expect(schemes.some((t) => /charge|repos|poids du corps|jambe|bras/.test(t))).toBe(false);
    expect(fr.some((t) => / × \d+/.test(t))).toBe(true);
    // aucun accent, noms d'exercice compris (traduits par id depuis la PR « Données » D1)
    expect(en.filter((t) => ACCENT.test(t))).toEqual([]);
  });

  it('minuteur Split : une étape par exercice, dans l’ordre de la séance, quelle que soit la langue', async () => {
    for (const langue of ['fr', 'en'] as const) {
      await mount('musculation', langue);
      const noms = mockTimerProps.initialBlock.splitExercises.map((s: { name: string }) => s.name);
      expect(noms).toEqual(mWod.blocks[0].exercises.map((e) => exerciseName(e, langue)));
      await act(async () => renderer.unmount());
    }
  });
});

describe('anglais : tout le texte de l’écran sans français', () => {
  // noms sans entrée anglaise (repli) : aucun depuis la PR « Données » D1
  const noms = [...new Set(mockCatalog.movements.filter((m) => !(m.id in mouvements)).map((m) => m.name))].sort((a, b) => b.length - a.length);
  const sansNoms = (t: string) => noms.reduce((x, n) => x.split(n).join(' '), t);
  it.each([...SPORTS, 'apresClasse', 'apresClasseHybrid'] as Sport[])('%s : aucun accent hors noms du catalogue', async (sport) => {
    const root = await mount(sport, 'en');
    if (sport !== 'musculation') await press(root, 'wodresult-all-categories');
    expect(textes(root).filter((t) => ACCENT.test(sansNoms(t)))).toEqual([]);
  });

  // Hors M4 (décision de Nab) : « Complément : évite » garde les ids bruts de master, dans les deux langues,
  // jusqu'à sa correction après l'App Store. Ce test fige l'état de master.
  it.each(['apresClasse', 'apresClasseHybrid'] as Sport[])('%s : « Complément : évite » identique à master (ids bruts), en français et en anglais', async (sport) => {
    const ac = wodOf(sport).after_class!;
    const ids = [...ac.excluded_patterns, ...ac.excluded_families];
    expect(ids.some((id: string) => /_/.test(id))).toBe(true); // un id brut se distingue de son libellé
    for (const langue of ['fr', 'en'] as const) {
      const root = await mount(sport, langue);
      expect(textes(root)).toContain(i18n.t('wodResult.complementAvoids', { list: ids.join(', ') }));
      await act(async () => renderer.unmount());
    }
  });
});
