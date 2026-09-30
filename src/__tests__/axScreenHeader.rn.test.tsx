/**
 * Refonte R3c : en-tête « ‹ Retour » des écrans secondaires (AxScreenHeader),
 * monté avec le vrai react-native.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { lightTheme, darkTheme, type AppTheme } from '../theme/palette';
import { axAccentSafeLineHeight, axTypography } from '../theme/axTokens';
import { contrast } from '../theme/contrast';
import { AxScreenHeader, AX_SCREEN_HEADER } from '../components/ax/AxScreenHeader';
import { AxIconButton } from '../components/ax/AxIconButton';

let mockTheme: AppTheme = lightTheme;
let mockLang: 'fr' | 'en' = 'fr';
const mockGoBack = jest.fn();
let mockInsetTop = 0;
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme, toggleTheme: () => {} }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: mockInsetTop, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => {
      const [ns, key] = k.split('.');
      const dict = (mockLang === 'fr' ? require('../i18n/locales/fr.json') : require('../i18n/locales/en.json')) as unknown as Record<string, Record<string, string>>;
      return dict[ns][key];
    },
  }),
}));

let renderer: TestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = null;
  mockGoBack.mockReset();
  mockLang = 'fr';
  mockInsetTop = 0;
});

async function mount(el: React.ReactElement, theme: AppTheme = lightTheme) {
  mockTheme = theme;
  await act(async () => { renderer = TestRenderer.create(el); });
  return renderer!.root;
}
const flat = (i: ReactTestInstance) => StyleSheet.flatten(i.props.style) ?? {};
const byId = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const host = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];
const layout = async (root: ReactTestInstance, id: string, width: number) => {
  const v = root.findAll((n) => n.props.testID === id && n.type === View)[0];
  await act(async () => v.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height: 44 } } }));
};

describe('AxScreenHeader', () => {
  for (const theme of [darkTheme, lightTheme]) {
    it(`${theme.mode} : chevron 16 + « Retour » en label textMuted, titre titleM text`, async () => {
      const root = await mount(<AxScreenHeader title="Classement" />, theme);
      const chevron = root.findByType(ChevronLeft);
      expect(chevron.props.size).toBe(16);
      expect(chevron.props.color).toBe(theme.ax.textMuted);
      const back = byId(root, 'ax-screen-header-back');
      const label = back.findByType(Text);
      expect(label.props.children).toBe('Retour');
      expect(flat(label)).toMatchObject({ ...axTypography.label, color: theme.ax.textMuted });
      const title = host(root, 'ax-screen-header-title');
      expect(title.props.children).toBe('Classement');
      expect(flat(title)).toMatchObject({ ...axTypography.titleM, lineHeight: axAccentSafeLineHeight.titleM, color: theme.ax.text });
    });

    it(`${theme.mode} : contraste AA du Retour et du titre sur le fond`, () => {
      expect(contrast(theme.ax.textMuted, theme.ax.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.ax.text, theme.ax.background)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('libellé « Back » en anglais (clé common.back)', async () => {
    mockLang = 'en';
    const root = await mount(<AxScreenHeader title="Ranking" />);
    const back = host(root, 'ax-screen-header-back');
    expect(back.props.accessibilityLabel).toBe('Back');
    expect(root.findAllByType(Text).map((t) => t.props.children)).toContain('Back');
  });

  it('rangée de 44, marges 20, sous la zone sûre du haut', async () => {
    mockInsetTop = 47;
    const root = await mount(<AxScreenHeader title="X" />);
    const wrap = host(root, 'ax-screen-header');
    expect(flat(wrap)).toMatchObject({ paddingTop: 47, paddingHorizontal: 20 });
    expect(flat(wrap.children[0] as ReactTestInstance).height).toBe(44);
  });

  it('safeArea={false} : pas de marge haute en double dans une SafeAreaView', async () => {
    mockInsetTop = 47;
    const root = await mount(<AxScreenHeader title="X" safeArea={false} />);
    expect(flat(host(root, 'ax-screen-header')).paddingTop).toBe(0);
  });

  it('accessibilité : bouton « Retour », zone tactile ≥ 44 × 44, titre en en-tête', async () => {
    const root = await mount(<AxScreenHeader title="X" />);
    const back = host(root, 'ax-screen-header-back');
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBe('Retour');
    const s = flat(back);
    expect(s.minWidth).toBeGreaterThanOrEqual(44);
    expect(s.minHeight).toBeGreaterThanOrEqual(44);
    expect(host(root, 'ax-screen-header-title').props.accessibilityRole).toBe('header');
  });

  it('appui → navigation.goBack() par défaut', async () => {
    const root = await mount(<AxScreenHeader title="X" />);
    await act(async () => byId(root, 'ax-screen-header-back').props.onPress());
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('appui → action de retour propre à l’écran, sans goBack', async () => {
    const onBack = jest.fn();
    const root = await mount(<AxScreenHeader title="X" onBack={onBack} />);
    await act(async () => byId(root, 'ax-screen-header-back').props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('titre long : une seule ligne avec « … » à la fin, rétrécissable', async () => {
    const long = 'Championnat régional des boxes de la vallée du Rhône édition 2026';
    const root = await mount(<AxScreenHeader title={long} />);
    const title = host(root, 'ax-screen-header-title');
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.ellipsizeMode).toBe('tail');
    expect(flat(title).flexShrink).toBe(1);
    expect(flat(title).textAlign).toBe('center');
  });

  const sides = (root: ReactTestInstance) =>
    ['ax-screen-header-left', 'ax-screen-header-right'].map((id) => flat(root.findAll((n) => n.props.testID === id && n.type === View)[0]));

  it('sans action à droite : emplacement vide de même largeur que Retour', async () => {
    const root = await mount(<AxScreenHeader title="X" />);
    await layout(root, 'ax-screen-header-left-content', 78);
    const [l, r] = sides(root);
    expect(r).toEqual({ ...l, justifyContent: 'flex-end', gap: 4 });
    expect(l.minWidth).toBe(78);
    expect(r.minWidth).toBe(78);
    expect(host(root, 'ax-screen-header-right').children).toHaveLength(0);
  });

  it('avec deux actions à droite plus larges que Retour : titre toujours centré', async () => {
    const onShare = jest.fn();
    const root = await mount(
      <AxScreenHeader
        title="Profil"
        right={<><AxIconButton icon={Share2} onPress={onShare} accessibilityLabel="Partager" testID="share" /><AxIconButton icon={Share2} onPress={() => {}} accessibilityLabel="b" /></>}
      />,
    );
    await layout(root, 'ax-screen-header-left-content', 78);
    await layout(root, 'ax-screen-header-right-content', 92);
    const [l, r] = sides(root);
    expect(l.minWidth).toBe(92);
    expect(r.minWidth).toBe(92);
    for (const s of [l, r]) expect(s).toMatchObject({ flexGrow: 1, flexShrink: 0, flexBasis: 0 });
    await act(async () => byId(root, 'share').props.onPress());
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('390 px : la place du titre reste positive avec la plus large action existante (2 boutons)', () => {
    const widest = 44 + 4 + 44;
    const titleBox = 390 - 2 * AX_SCREEN_HEADER.sideMargin - 2 * widest - 2 * 8;
    expect(titleBox).toBeGreaterThan(100);
  });

  it('les colonnes ne mesurent que leur contenu : la largeur étirée d’une colonne ne réserve pas la place du titre', async () => {
    const root = await mount(<AxScreenHeader title="Minuteur" right={<AxIconButton icon={Share2} onPress={() => {}} accessibilityLabel="a" />} />);
    const col = (id: string) => root.findAll((n) => n.props.testID === id && n.type === View)[0];
    expect(col('ax-screen-header-left').props.onLayout).toBeUndefined();
    expect(col('ax-screen-header-right').props.onLayout).toBeUndefined();
    expect(typeof col('ax-screen-header-left-content').props.onLayout).toBe('function');
    expect(typeof col('ax-screen-header-right-content').props.onLayout).toBe('function');
  });

  it('390 px : « MINUTEUR » (Oswald 500, 20 px) tient en entier entre Retour et une action', async () => {
    // Chasses Oswald 500 (unités de 1000 em, lues dans Oswald_500Medium.ttf).
    const ADV: Record<string, number> = { M: 683, I: 275, N: 545, U: 566, T: 430, E: 428, R: 561 };
    const fontSize = axTypography.titleM.fontSize as number;
    const letterSpacing = axTypography.titleM.letterSpacing as number;
    const text = 'Minuteur'.toUpperCase();
    const titleWidth = [...text].reduce((w, ch) => w + (ADV[ch] * fontSize) / 1000 + letterSpacing, 0);
    const root = await mount(<AxScreenHeader title="Minuteur" right={<AxIconButton icon={Share2} onPress={() => {}} accessibilityLabel="a" />} />);
    // Contenus réels : « ‹ Retour » ≈ 78, un bouton icône 44 ; puis re-mesure après un premier rendu étiré.
    await layout(root, 'ax-screen-header-left-content', 78);
    await layout(root, 'ax-screen-header-right-content', 44);
    const [l, r] = sides(root);
    expect(l.minWidth).toBe(78);
    expect(r.minWidth).toBe(78);
    const title = host(root, 'ax-screen-header-title');
    const room = 390 - 2 * AX_SCREEN_HEADER.sideMargin - l.minWidth - r.minWidth - 2 * (flat(title).marginHorizontal as number);
    expect(title.props.children).toBe('Minuteur');
    expect(titleWidth).toBeLessThan(room);
  });

  it('contenu existant de l’en-tête posé sous la rangée', async () => {
    const root = await mount(<AxScreenHeader title="Amis"><Text testID="sub">3 amis</Text></AxScreenHeader>);
    const wrap = host(root, 'ax-screen-header');
    expect((wrap.children[1] as ReactTestInstance).props.testID).toBe('sub');
  });
});
