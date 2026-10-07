import React from 'react';
import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, StyleSheet } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { lightTheme, darkTheme } from '../theme/palette';
import { AxButton, AxCard, AxChip, AxSwitch } from '../components/ax';
import { axTypography } from '../theme/axTokens';
import { contrast } from '../theme/contrast';
import { readableInk } from '../screens/home/homeLevelColor';
import { GYM_ZONES, gymRepsAt } from '../screens/home/gymZones';
import i18n from '../i18n';
import BEFORE from './r4bStructureBefore.json';
import WodHistoryScreen from '../screens/wod/WodHistoryScreen';
import OneRMCalculatorScreen from '../screens/home/OneRMCalculatorScreen';
import ProgramDetailScreen from '../screens/programs/ProgramDetailScreen';

const mockNavigate = jest.fn();
let mockTheme = lightTheme;
let mockProgramError = false;
const mockTables: Record<string, unknown[]> = {};
const mockCalls: Array<{ table: string; method: string; args: unknown[] }> = [];
const mockSetProgramStartDate = jest.fn(async (_id: string, d: string) => d);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
  BottomTabBarHeightContext: jest.requireActual('react').createContext(undefined),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: View,
  };
});
const mockAuth = { user: { id: 'local' } };
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'in', 'update', 'delete']) {
      b[m] = (...args: unknown[]) => { mockCalls.push({ table, method: m, args }); return b; };
    }
    b.then = (res: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: mockTables[table] ?? [], error: null }).then(res);
    return b;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});
jest.mock('../services/myProfile', () => ({
  fetchMyPersonalRecords: async () => ({
    'weightlifting_Back Squat': '120', weightlifting_Deadlift: '160',
    'gymnastics_Pull-ups': '20', 'gymnastics_Toes To Bar': '25',
  }),
}));
jest.mock('../services/programContent', () => ({
  listProgramWods: async () => {
    if (mockProgramError) throw new Error('réseau');
    return mockTables.program_wods ?? [];
  },
  listProgramRestDays: async () => mockTables.program_rest_days ?? [],
  setProgramStartDate: (id: string, d: string) => mockSetProgramStartDate(id, d),
}));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../components/glass/GlassBackground', () => () => null);

const NOW = new Date('2026-09-28T10:00:00Z');
const LONG = 'Une séance au titre particulièrement long pour vérifier qu’aucun texte ne déborde';

const GENERATED = {
  id: 'g1', sport: 'crossfit', wod_name: LONG, wod_type: 'AMRAP', duration: 12, level: 'rx',
  format: 'AMRAP 12', movements: 'AMRAP 12 min\n  10 Burpees\n  15 KB Swings 24 kg', scoring: 'Rounds + reps',
  coach_tip: 'Garde un rythme régulier', team_note: null, equipment: [], is_favorite: false, is_benchmark: true,
  created_at: '2026-09-28T08:00:00Z',
  scores: [
    { id: 's1', score_type: 'rounds', score_value: 7, rx: true, notes: 'Bonne séance', completed_at: '2026-09-28T09:00:00Z' },
    { id: 's2', score_type: 'rounds', score_value: 6, rx: false, notes: null, completed_at: '2026-09-27T09:00:00Z' },
  ],
};
const BOX_SCORE = {
  id: 'b1', wod_id: 'w-box', score_value: 305, score_type: 'time', rx: true, submitted_at: '2026-09-27T18:00:00Z',
  wod: { title: 'Fran', wod_type: 'for-time', scheduled_date: '2026-09-27' },
};
const COMPLETION = {
  id: 'c1', wod_id: 'w-done', completed_at: '2026-09-26T18:00:00Z',
  wod: { title: 'Murph', wod_type: 'for-time', scheduled_date: '2026-09-26' },
};
const PROGRAM_WODS = [
  { id: 'p-1', title: 'Back Squat 5×5', description: 'Back Squat 5×5 @75%\nRepos 2 min', wod_type: 'strength', time_cap_seconds: null, notes: 'Contrôle la descente', scheduled_date: null, program_week: 2, program_day: 1, sort_order: 0, is_published: true },
  { id: 'p-2', title: LONG, description: 'AMRAP 15\n10 Wall Balls\n10 Box Jumps', wod_type: 'amrap', time_cap_seconds: 900, notes: null, scheduled_date: null, program_week: 2, program_day: 2, sort_order: 0, is_published: true },
  { id: 'p-3', title: 'EMOM 12', description: 'EMOM 12\n12 Cal Row', wod_type: 'emom', time_cap_seconds: 720, notes: null, scheduled_date: null, program_week: 2, program_day: 4, sort_order: 0, is_published: true },
];
const PROGRAM_SCORES = [
  { id: 'ps1', wod_id: 'p-1', member_id: 'local', score_type: 'load', score_value: 100, rx: true, capped: false, notes: null, submitted_at: '2026-09-28T09:00:00Z' },
];
const PROGRAM_PARAMS = {
  programId: 'prog-1', programTitle: 'Force & Condition', progType: 'fixed', durationWeeks: 4, daysPerWeek: 5, startDate: '2026-09-21',
};

let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
  mockTables.generated_wods = [GENERATED];
  mockTables.wod_scores = [BOX_SCORE];
  mockTables.wod_completions = [COMPLETION];
  mockTables.program_wods = PROGRAM_WODS;
  mockTables.program_rest_days = [{ program_week: 2, program_day: 3 }];
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.useRealTimers();
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockProgramError = false;
  await AsyncStorage.clear();
});

const isHostText = (n: ReactTestInstance) => String(n.type) === 'Text';
function hostText(n: ReactTestInstance): string {
  return n.children.map((ch) => (typeof ch === 'string' ? ch : hostText(ch))).join('');
}
function textsOf(n: ReactTestInstance, out: string[]) {
  if (isHostText(n)) {
    const upper = StyleSheet.flatten(n.props.style)?.textTransform === 'uppercase';
    out.push(upper ? hostText(n).toUpperCase() : hostText(n));
    return;
  }
  n.children.forEach((ch) => { if (typeof ch !== 'string') textsOf(ch, out); });
}
/** Suite ordonnée des textes visibles de l'écran, puis de chaque fenêtre ouverte. */
function structure(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (n: ReactTestInstance) => {
    if (n.type === Modal) return;
    if (isHostText(n)) { textsOf(n, out); return; }
    n.children.forEach((ch) => { if (typeof ch !== 'string') walk(ch); });
  };
  walk(root);
  for (const m of root.findAllByType(Modal).filter((x) => x.props.visible)) {
    out.push('── fenêtre ──');
    textsOf(m, out);
  }
  return out.filter((t) => t.trim().length > 0);
}

/** Appuie sur l'élément appuyable le plus proche qui contient ce texte. */
async function pressText(root: ReactTestInstance, text: string) {
  const t = root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
  let n: ReactTestInstance | null = t;
  while (n && typeof n.props.onPress !== 'function') n = n.parent;
  if (!n) throw new Error(`rien d'appuyable autour de « ${text} »`);
  const target = n;
  await act(async () => { target.props.onPress(); });
}
async function pressID(root: ReactTestInstance, testID: string) {
  const node = root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === 'function')[0];
  await act(async () => { node.props.onPress(); });
}
async function pressLabel(root: ReactTestInstance, label: string) {
  const node = root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  await act(async () => { node.props.onPress(); });
}
async function typeIn(root: ReactTestInstance, placeholder: string, value: string) {
  const input = root.findAll((n) => String(n.type) === 'TextInput' && n.props.placeholder === placeholder)[0];
  await act(async () => { input.props.onChangeText(value); });
}

async function mount(el: React.ReactElement, theme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
  return renderer.root;
}

type Variant = { name: string; run: (theme?: typeof lightTheme) => Promise<ReactTestInstance> };
const mountProgram = (th?: typeof lightTheme, scores: unknown[] = PROGRAM_SCORES) => {
  mockTables.wod_scores = scores;
  return mount(<ProgramDetailScreen navigation={{ navigate: mockNavigate, goBack: jest.fn() }} route={{ params: PROGRAM_PARAMS }} />, th);
};
const VARIANTS: Variant[] = [
  { name: 'historique', run: async (th) => {
    const root = await mount(<WodHistoryScreen />, th);
    await pressText(root, LONG);
    return root;
  } },
  { name: '1rm-barres-liste', run: async (th) => {
    const root = await mount(<OneRMCalculatorScreen />, th);
    await pressText(root, 'Choisir un mouvement (mes PR)');
    return root;
  } },
  { name: '1rm-barres-choisi', run: async (th) => {
    const root = await mount(<OneRMCalculatorScreen />, th);
    await pressText(root, 'Choisir un mouvement (mes PR)');
    await pressText(root, 'Back Squat');
    return root;
  } },
  { name: '1rm-barres-saisie', run: async (th) => {
    const root = await mount(<OneRMCalculatorScreen />, th);
    await typeIn(root, 'ex: 100', '100');
    return root;
  } },
  { name: '1rm-gym-liste', run: async (th) => {
    const root = await mount(<OneRMCalculatorScreen />, th);
    await pressID(root, 'onerm-section-gym');
    await pressText(root, 'Choisir un mouvement (mes PR)');
    return root;
  } },
  { name: '1rm-gym-choisi', run: async (th) => {
    const root = await mount(<OneRMCalculatorScreen />, th);
    await pressID(root, 'onerm-section-gym');
    await pressText(root, 'Choisir un mouvement (mes PR)');
    await pressText(root, 'Pull-ups');
    return root;
  } },
  { name: 'programme', run: async (th) => mountProgram(th) },
  { name: 'programme-date', run: async (th) => {
    const root = await mountProgram(th, []);
    await pressLabel(root, 'Modifier ma date de début');
    return root;
  } },
  { name: 'séance-de-programme', run: async (th) => {
    const root = await mountProgram(th);
    await pressText(root, 'Back Squat 5×5');
    return root;
  } },
  { name: 'séance-de-programme-à-faire', run: async (th) => {
    const root = await mountProgram(th);
    await pressText(root, 'EMOM 12');
    return root;
  } },
];


const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
/** Casse et emoji mis à part : les surtitres passent en capitales, les emoji deviennent des icônes Lucide. */
const normalize = (xs: string[]) => xs.map((x) => x.replace(EMOJI, '').trim().toUpperCase()).filter((x) => x.length > 0);
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const byID = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id)[0];
const textByContent = (root: ReactTestInstance, text: string) =>
  root.findAll((n) => isHostText(n) && hostText(n) === text)[0];
const inModal = (n: ReactTestInstance) => {
  for (let p: ReactTestInstance | null = n.parent; p; p = p.parent) if (p.type === Modal) return p;
  return null;
};
/** Actions accent : l'écran d'un côté, chaque fenêtre ouverte de l'autre. */
function accentCounts(root: ReactTestInstance): { screen: number; modals: number[] } {
  const accents = root.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent');
  const modals = root.findAllByType(Modal).filter((m) => m.props.visible);
  return {
    screen: accents.filter((b) => !inModal(b)).length,
    modals: modals.map((m) => accents.filter((b) => inModal(b) === m).length),
  };
}

describe('R4b : ordre des blocs et libellés inchangés (instantané pris sur master)', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (name, v) => {
    const root = await v.run();
    const current = structure(root);
    if (process.env.R4B_CAPTURE) {
      const file = process.env.R4B_CAPTURE;
      const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      all[name] = current;
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    const before = (BEFORE as Record<string, string[]>)[name];
    expect(before).toBeDefined();
    expect(normalize(current)).toEqual(normalize(before));
  });
});

describe('R4b : calculs du calculateur inchangés', () => {
  const zoneValues = (root: ReactTestInstance) =>
    root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('onerm-zone-value-') && isHostText(n))
      .map((n) => hostText(n));
  const PCTS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130];

  it('Barres, 1RM 120 kg (Back Squat) : mêmes charges qu’avant', async () => {
    const root = await VARIANTS[2].run();
    expect(zoneValues(root)).toEqual([
      '60 kg', '65 kg', '72.5 kg', '77.5 kg', '85 kg', '90 kg', '95 kg', '102.5 kg', '107.5 kg',
      '115 kg', '120 kg', '125 kg', '132.5 kg', '137.5 kg', '145 kg', '150 kg', '155 kg',
    ]);
  });

  it('Barres, 100 en lbs : arrondi au 5 lbs, unité lbs', async () => {
    const root = await mount(<OneRMCalculatorScreen />);
    await typeIn(root, 'ex: 100', '100');
    const sw = root.findAllByType(AxSwitch)[0];
    await act(async () => { sw.props.onValueChange(true); });
    expect(zoneValues(root)).toEqual(PCTS.map((p) => `${Math.round((100 * p / 100) / 5) * 5} lbs`));
    expect(textByContent(root, 'Charges arrondiées au 5 lbs le plus proche.\nAu-delà de 100% : excentrique, partiel ou assisté uniquement.')).toBeDefined();
  });

  it('Gymnastique, record 20 (Pull-ups) : mêmes reps qu’avant, via gymRepsAt', async () => {
    const root = await VARIANTS[5].run();
    const expected = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].map((r) => `${r} reps`);
    expect(zoneValues(root)).toEqual(expected);
    expect(GYM_ZONES.map((z) => `${gymRepsAt(20, z.pct)} reps`)).toEqual(expected);
    expect(gymRepsAt(17, 30)).toBe(5);
    expect(gymRepsAt(17, 50)).toBe(9);
    expect(gymRepsAt(25, 10)).toBe(3);
  });

  it('tableau des zones de gymnastique inchangé (pourcentages, zones, couleurs)', () => {
    expect(GYM_ZONES.map((z) => [z.pct, i18n.t(`gymZones.zone.${z.zone}`), z.color])).toEqual([
      [10, 'Volume facile', '#60A5FA'], [20, 'Volume facile', '#60A5FA'], [30, 'Volume facile', '#60A5FA'],
      [40, 'Volume facile', '#4ADE80'], [50, 'Volume de travail', '#4ADE80'], [60, 'Volume de travail', '#4ADE80'],
      [70, 'Volume de travail', '#FBBF24'], [80, 'Série limite', '#F97316'], [90, 'Série limite', '#F97316'],
      [100, 'Record', '#EF4444'], [110, 'Au-delà du record', '#A855F7'], [120, 'Au-delà du record', '#A855F7'],
      [130, 'Au-delà du record', '#EC4899'], [140, 'Au-delà du record', '#EC4899'], [150, 'Au-delà du record', '#EC4899'],
    ]);
  });
});

describe('R4b : couleurs de zone lisibles (AA) et fidèles à leur sens, dans les deux thèmes', () => {
  for (const [mode, th] of [['clair', lightTheme], ['sombre', darkTheme]] as const) {
    it.each([['Barres', 2], ['Gymnastique', 5]] as const)(`${mode} — %s`, async (_n, idx) => {
      const root = await VARIANTS[idx].run(th);
      const c = th.ax;
      const pctTexts = root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('onerm-zone-pct-') && isHostText(n));
      expect(pctTexts.length).toBeGreaterThan(10);
      for (const t of pctTexts) {
        const pct = Number(t.props.testID.replace('onerm-zone-pct-', ''));
        const name = byID(root, `onerm-zone-name-${pct}`);
        const color = flat(t).color as string;
        expect(flat(name).color).toBe(color);
        expect(contrast(color, c.surface)).toBeGreaterThanOrEqual(4.5);
        if (idx === 5) {
          const base = GYM_ZONES.find((z) => z.pct === pct)?.color as string;
          expect(color).toBe(readableInk(base, c));
          // La teinte d'origine est gardée dès qu'elle est lisible : l'ajustement n'est qu'un assombrissement.
          if (contrast(base, c.surface) >= 4.5) expect(color).toBe(base);
        }
      }
      // Lignes séparées par un filet border, dans une AxCard.
      const row = byID(root, 'onerm-zone-60');
      expect(flat(row).borderTopColor).toBe(c.border);
      expect(root.findAllByType(AxCard).some((card) => card.props.testID === 'onerm-zones')).toBe(true);
    });
  }

  it('les zones gardent une teinte distincte en thème clair (du plus facile au plus lourd)', () => {
    const bases = [...new Set(GYM_ZONES.map((z) => z.color))];
    const inks = bases.map((b) => readableInk(b, lightTheme.ax));
    expect(new Set(inks).size).toBe(bases.length);
  });
});

describe('R4b : une seule action accent par écran', () => {
  it.each(VARIANTS.map((v) => [v.name, v] as const))('%s', async (_name, v) => {
    const root = await v.run();
    const counts = accentCounts(root);
    expect(counts.screen).toBeLessThanOrEqual(1);
    for (const m of counts.modals) expect(m).toBe(1);
  });

  it('programme sans date de début : « Choisir ma date de début » est l’unique accent', async () => {
    const root = await mount(<ProgramDetailScreen navigation={{ navigate: mockNavigate, goBack: jest.fn() }} route={{ params: { ...PROGRAM_PARAMS, startDate: null } }} />);
    expect(root.findAllByType(AxButton).filter((b) => (b.props.variant ?? 'accent') === 'accent').map((b) => b.props.label))
      .toEqual(['Choisir ma date de début']);
  });

  it('séance de programme (écran de WOD) : une seule action accent dans la saisie de musculation', () => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'screens', 'whiteboard', 'WODDetailScreen.tsx'), 'utf8');
    const block = code.slice(code.indexOf('{isStrengthSession ? (\n                <View style={{ gap: 12'), code.indexOf("i18n.t('wodDetail.submitScore')"));
    expect(block.match(/variant="accent"/g)).toHaveLength(1);
    expect(block).toContain('testID="strength-validate"');
    expect(block).toContain('testID="strength-save-later"');
  });
});

describe('R4b : couleurs et typographies clés, dans les deux thèmes', () => {
  for (const [mode, th] of [['clair', lightTheme], ['sombre', darkTheme]] as const) {
    const c = th.ax;
    it(`${mode} — historique`, async () => {
      const root = await VARIANTS[0].run(th);
      expect(byID(root, 'history-stats').type).toBe(AxCard);
      for (const id of ['history-stat-wods', 'history-stat-scores']) {
        expect(flat(byID(root, id))).toMatchObject({ fontFamily: axTypography.numberM.fontFamily, fontSize: axTypography.numberM.fontSize, color: c.text });
      }
      expect(flat(byID(root, 'history-stat-streak')).color).toBe(c.orange);
      expect(root.findAllByType(AxChip).map((ch) => [ch.props.label, ch.props.selected])).toEqual([
        ['Tous', true], ['Favoris', false], ['Benchmark', false],
      ]);
      expect(flat(textByContent(root, '28 sept. 2026 · AMRAP 12'))).toMatchObject({ ...axTypography.overline, color: c.textMuted });
      expect(flat(textByContent(root, LONG))).toMatchObject({ fontFamily: axTypography.label.fontFamily, color: c.text });
      expect(flat(textByContent(root, 'Meilleur : 7 rnds (RX)'))).toMatchObject({ fontSize: axTypography.bodySmall.fontSize });
      expect(flat(textByContent(root, 'Mes scores (2)'))).toMatchObject({ ...axTypography.labelSmall, color: c.accentText });
      expect(flat(textByContent(root, 'Réalisé, sans score')).color).toBe(c.textMuted);
      for (const id of ['history-generated-g1', 'history-boxScore-w-box', 'history-completion-w-done']) {
        expect(byID(root, id).type).toBe(AxCard);
      }
      expect(contrast(c.orange, c.surface)).toBeGreaterThanOrEqual(3);
    });

    it(`${mode} — calculateur`, async () => {
      const root = await VARIANTS[2].run(th);
      expect(root.findAllByType(AxChip).map((ch) => [ch.props.label, ch.props.selected])).toEqual([['Barres', true], ['Gymnastique', false]]);
      expect(flat(textByContent(root, '1RM — Back Squat'))).toMatchObject({ ...axTypography.overline, color: c.textMuted });
      expect(byID(root, 'onerm-barbell-input')).toBeDefined();
      expect(flat(textByContent(root, 'KG')).color).toBe(c.accentText);
      expect(flat(textByContent(root, 'LBS')).color).toBe(c.textMuted);
      expect(flat(byID(root, 'onerm-zone-value-100'))).toMatchObject({ fontFamily: axTypography.numberM.fontFamily, color: c.text });
    });

    it(`${mode} — programme et séance`, async () => {
      const root = await VARIANTS[8].run(th);
      expect(flat(textByContent(root, 'Lun'))).toMatchObject({ ...axTypography.overline, color: c.textMuted });
      expect(flat(textByContent(root, 'Repos')).color).toBe(c.textMuted);
      expect(flat(textByContent(root, 'Back Squat 5×5 @75%\nRepos 2 min'))).toBeDefined();
      expect(byID(root, 'program-wod-p-1').type).toBe(AxCard);
      expect(flat(root.findAll((n) => isHostText(n) && hostText(n) === 'Back Squat 5×5' && !inModal(n))[0]))
        .toMatchObject({ fontFamily: axTypography.label.fontFamily, color: c.text });
      expect(flat(textByContent(root, 'NOTES COACH'))).toMatchObject({ ...axTypography.overline, color: c.accentText });
      expect(byID(root, 'program-notes').type).toBe(AxCard);
      expect(flat(textByContent(root, '100 · RX'))).toMatchObject({ fontFamily: axTypography.numberM.fontFamily, fontSize: axTypography.numberM.fontSize });
    });
  }
});

describe('R4b : navigation et callbacks inchangés', () => {
  it('historique : filtres Favoris / Benchmark → mêmes requêtes', async () => {
    const root = await mount(<WodHistoryScreen />);
    mockCalls.length = 0;
    await pressID(root, 'history-filter-favorites');
    expect(mockCalls).toContainEqual({ table: 'generated_wods', method: 'eq', args: ['is_favorite', true] });
    expect(root.findAllByType(AxChip).find((ch) => ch.props.label === 'Favoris')?.props.selected).toBe(true);
    mockCalls.length = 0;
    await pressID(root, 'history-filter-benchmark');
    expect(mockCalls).toContainEqual({ table: 'generated_wods', method: 'eq', args: ['is_benchmark', true] });
  });

  it('historique : favori, Mes scores (dépliage) et entrées de box → WODDetail', async () => {
    const root = await mount(<WodHistoryScreen />);
    expect(root.findAll((n) => isHostText(n) && hostText(n) === 'Mes scores (2)')).toHaveLength(0);
    await pressID(root, 'history-generated-g1');
    expect(textByContent(root, 'Mes scores (2)')).toBeDefined();
    mockCalls.length = 0;
    await pressID(root, 'history-fav-g1');
    expect(mockCalls).toContainEqual({ table: 'generated_wods', method: 'update', args: [{ is_favorite: true }] });
    expect(mockCalls).toContainEqual({ table: 'generated_wods', method: 'eq', args: ['id', 'g1'] });
    await pressID(root, 'history-boxScore-w-box');
    expect(mockNavigate).toHaveBeenLastCalledWith('WODDetail', { wodId: 'w-box' });
    await pressID(root, 'history-completion-w-done');
    expect(mockNavigate).toHaveBeenLastCalledWith('WODDetail', { wodId: 'w-done' });
  });

  it('calculateur : choix d’un mouvement, sections, mémorisation des saisies', async () => {
    const storage = AsyncStorage as unknown as { setItem: jest.Mock };
    const root = await mount(<OneRMCalculatorScreen />);
    await pressID(root, 'onerm-pr-toggle');
    await pressID(root, 'onerm-pr-weightlifting_Deadlift');
    expect(byID(root, 'onerm-barbell-input').props.value).toBe('160');
    expect(textByContent(root, '1RM — Deadlift')).toBeDefined();
    await pressID(root, 'onerm-section-gym');
    expect(byID(root, 'onerm-gym-input')).toBeDefined();
    expect(root.findAllByType(AxChip).find((ch) => ch.props.label === 'Gymnastique')?.props.selected).toBe(true);
    const saved = JSON.parse(storage.setItem.mock.calls.at(-1)[1]);
    expect(storage.setItem.mock.calls.at(-1)[0]).toBe('@athlex:1rm_calc');
    expect(saved).toEqual({ input: '160', movement: 'Deadlift', isLbs: false, section: 'gym', gymInput: '', gymMovement: null });
  });

  it('calculateur : saisies restaurées au montage', async () => {
    await AsyncStorage.setItem('@athlex:1rm_calc', JSON.stringify({ input: '80', movement: null, isLbs: true, section: 'barbell', gymInput: '', gymMovement: null }));
    const root = await mount(<OneRMCalculatorScreen />);
    expect(byID(root, 'onerm-barbell-input').props.value).toBe('80');
    expect(root.findAllByType(AxSwitch)[0].props.value).toBe(true);
  });

  it('programme : modifier la date de début (lundi choisi → setProgramStartDate)', async () => {
    const root = await mountProgram(undefined, []);
    await pressID(root, 'program-date-edit');
    await pressID(root, 'program-monday-2026-10-05');
    await pressID(root, 'program-date-validate');
    expect(mockSetProgramStartDate).toHaveBeenCalledWith('prog-1', '2026-10-05');
  });

  it('programme : date verrouillée dès qu’un résultat existe', async () => {
    const root = await mountProgram();
    const btn = byID(root, 'program-date-edit');
    expect(btn.props.accessibilityLabel).toBe('Date de début verrouillée');
    expect(root.findAll((n) => n.props.testID === 'program-date-edit' && n.props.disabled === true).length).toBeGreaterThan(0);
  });

  it('programme : la séance s’ouvre dans l’écran de WOD', async () => {
    const root = await mountProgram();
    await pressID(root, 'program-wod-p-3');
    await pressID(root, 'program-open-session');
    expect(mockNavigate).toHaveBeenLastCalledWith('WODDetail', { wodId: 'p-3' });
  });

  it('programme : navigation de semaine conservée', async () => {
    mockTables.program_wods = [
      { ...PROGRAM_WODS[2], id: 'p-0', title: 'Semaine un', program_week: 1, program_day: 1 },
      ...PROGRAM_WODS,
    ];
    const root = await mountProgram();
    expect(textByContent(root, 'Semaine 2 / 4')).toBeDefined();
    await pressID(root, 'program-week-prev');
    expect(textByContent(root, 'Semaine 1 / 4')).toBeDefined();
    expect(textByContent(root, 'Semaine en cours')).toBeUndefined();
    await pressID(root, 'program-week-next');
    expect(textByContent(root, 'Semaine 2 / 4')).toBeDefined();
  });
});

describe('R4b : états du programme', () => {
  it('erreur de chargement : « Réessayer » en outline, relance le chargement', async () => {
    mockProgramError = true;
    const root = await mountProgram();
    expect(textByContent(root, 'Programmation indisponible')).toBeDefined();
    const retry = root.findAllByType(AxButton).find((b) => b.props.label === 'Réessayer');
    expect(retry?.props.variant).toBe('outline');
    mockProgramError = false;
    await act(async () => { retry?.props.onPress(); });
    for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
    expect(textByContent(root, 'Semaine 2 / 4')).toBeDefined();
  });
});

describe('R4b : textes longs sans débordement', () => {
  it('titres longs : ellipsis ou retour à la ligne dans un conteneur rétrécissable', async () => {
    const program = await mountProgram();
    const row = root2(program, 'program-wod-p-2');
    const title = row.findAll((n) => isHostText(n) && hostText(n) === LONG)[0];
    expect(title.props.numberOfLines).toBe(2);
    await pressID(program, 'program-wod-p-2');
    const modalTitle = program.findAll((n) => isHostText(n) && hostText(n) === LONG && inModal(n) != null)[0];
    expect(modalTitle.props.numberOfLines).toBe(1);
  });
});
function root2(root: ReactTestInstance, id: string) { return byID(root, id); }
