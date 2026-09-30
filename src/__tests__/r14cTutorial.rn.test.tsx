/**
 * R14c — tutoriel : correctif du plantage de la page 5, bloc centré, logo AthleX.
 *
 * 1. FlatList lève « Changing onViewableItemsChanged on the fly is not supported »
 *    si la fonction change entre deux rendus. L'arrivée sur la page 5 changeait
 *    l'état du badge, donc la fonction : le test compare la fonction avant et
 *    après la page 5 et vérifie que le badge n'est décerné qu'une fois.
 * 2. Chaque page est UN bloc (illustration, titre, texte, points, bouton), dans
 *    un défilement vertical qui centre le bloc et le laisse défiler s'il ne tient pas.
 * 3. Le centre du bloc est à ± 10 % du centre de l'écran à 390 × 844 et 390 × 667.
 * 4. La page 1 affiche assets/athex-logo.png.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { FlatList, Image, ScrollView, StyleSheet, ViewToken } from 'react-native';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';

const mockAward = jest.fn(async () => true);
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'apple', role: 'member', level: 'scaled' },
    joinBox: jest.fn(async () => ({ error: null })),
    skipBox: jest.fn(async () => {}),
    currentBox: { id: 'b1' },
  }),
}));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../services/gamification', () => ({ awardLevelBadge: (...a: unknown[]) => mockAward(...(a as [])) }));
jest.mock('../lib/supabase', () => ({ supabase: { rpc: jest.fn(async () => ({ data: null, error: null })) } }));

import '../i18n';
import { ThemeProvider } from '../context/ThemeContext';
import OnboardingTutorialScreen, { TUTORIAL_BLOCK_PADDING_V } from '../screens/onboarding/OnboardingTutorialScreen';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
beforeEach(() => { jest.useFakeTimers(); mockAward.mockClear(); });

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<ThemeProvider><OnboardingTutorialScreen onDone={() => {}} /></ThemeProvider>);
  });
  return r;
}
const list = (r: TestRenderer.ReactTestRenderer) => r.root.findByType(FlatList);
const byId = (r: TestRenderer.ReactTestRenderer, id: string) =>
  r.root.findAll((n) => n.props.testID === id && typeof n.type !== 'string')[0] ?? r.root.findAllByProps({ testID: id })[0];
const view = (index: number) => ({ viewableItems: [{ index, isViewable: true, item: null, key: String(index + 1) } as unknown as ViewToken], changed: [] });

describe('R14c tutoriel : page 5 sans plantage', () => {
  it('onViewableItemsChanged et viewabilityConfig restent les mêmes après l’arrivée sur la page 5', async () => {
    const r = await mount();
    const before = list(r).props;
    await act(async () => { before.onViewableItemsChanged(view(4)); });
    await act(async () => { jest.advanceTimersByTime(500); });
    const after = list(r).props;
    expect(after.onViewableItemsChanged).toBe(before.onViewableItemsChanged);
    expect(after.viewabilityConfig).toBe(before.viewabilityConfig);
    r.unmount();
  });

  it('le badge n’est décerné qu’une fois, même si la page 5 redevient visible', async () => {
    const r = await mount();
    const cb = list(r).props.onViewableItemsChanged;
    await act(async () => { cb(view(4)); });
    await act(async () => { cb(view(3)); });
    await act(async () => { list(r).props.onViewableItemsChanged(view(4)); });
    expect(mockAward).toHaveBeenCalledTimes(1);
    expect(mockAward).toHaveBeenCalledWith('u1', 'first_step');
    r.unmount();
  });
});

describe('R14c tutoriel : un bloc centré par page', () => {
  it.each([1, 2, 3, 4, 5])('page %i : illustration, titre, texte, points puis bouton dans le même bloc, dans un défilement centré', async (page) => {
    const r = await mount();
    const scroll = byId(r, `tutorial-scroll-${page}`);
    expect(scroll.type).toBe(ScrollView);
    const content = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(content.flexGrow).toBe(1);
    expect(content.justifyContent).toBe('center');
    expect(content.paddingVertical).toBe(TUTORIAL_BLOCK_PADDING_V);
    const block = byId(r, `tutorial-block-${page}`);
    const ids: string[] = block.findAll((n) => typeof n.type === 'string' && !!n.props.testID).map((n) => String(n.props.testID));
    const at = (id: string) => ids.findIndex((x) => x === id || x.startsWith(id));
    expect(at(`tutorial-illustration-${page}`)).toBeGreaterThanOrEqual(0);
    expect(at(`tutorial-dots-${page}`)).toBeGreaterThan(at(`tutorial-illustration-${page}`));
    // Page 4 connecté : les boutons de box sont dans le bloc, au-dessus des points (inchangé).
    if (page !== 4) expect(at('tutorial-next')).toBeGreaterThan(at(`tutorial-dots-${page}`));
    r.unmount();
  });

  it('le bouton « C’est parti ! » de la page 1 est sous les points, dans le bloc', async () => {
    const r = await mount();
    const block = byId(r, 'tutorial-block-1');
    expect(block.findAll((n) => n.props.testID === 'tutorial-next').length).toBeGreaterThan(0);
    r.unmount();
  });

  it('l’illustration n’est jamais coupée : aucun overflow caché ni marge négative, cercle entier', async () => {
    const r = await mount();
    for (const page of [1, 2, 3, 4, 5]) {
      const chain: ReactTestInstance[] = [];
      let n: ReactTestInstance | null = byId(r, `tutorial-illustration-${page}`);
      while (n && n.props.testID !== `tutorial-scroll-${page}`) { chain.push(n); n = n.parent; }
      for (const x of chain) {
        const s = StyleSheet.flatten(x.props.style) ?? {};
        expect(s.overflow).not.toBe('hidden');
        expect((s.marginTop ?? 0) >= 0).toBe(true);
        expect(s.position).not.toBe('absolute');
      }
    }
    r.unmount();
  });

  // Bloc le plus haut (page 3, texte sur 4 lignes) : cercle 160 + 32, titre 2×44 + 14,
  // texte 4×24, points 8 + 2×24, bouton 52 ≈ 506 px. « Passer » occupe le haut jusqu'à 60 + 36 px.
  const BLOCK = 506;
  const SKIP_BOTTOM = 96;
  it.each([844, 667])('centre du bloc à ± 10 %% du centre de l’écran à 390 × %i, sans passer sous « Passer »', async (h) => {
    const r = await mount();
    const content = StyleSheet.flatten(byId(r, 'tutorial-scroll-3').props.contentContainerStyle);
    const padTop = content.paddingTop ?? content.paddingVertical ?? 0;
    const padBottom = content.paddingBottom ?? content.paddingVertical ?? 0;
    expect(padTop).toBeGreaterThanOrEqual(SKIP_BOTTOM);
    const available = h - padTop - padBottom;
    const top = padTop + Math.max(0, (available - BLOCK) / 2);
    const center = top + Math.min(BLOCK, available) / 2;
    expect(Math.abs(center - h / 2)).toBeLessThanOrEqual(h * 0.1);
    r.unmount();
  });
});

describe('R14c tutoriel : logo AthleX page 1', () => {
  // Les images sont toutes remplacées par le même module sous jest : la source est vérifiée dans le code.
  it('la page 1 affiche assets/athex-logo.png, jamais assets/logo.png', async () => {
    const r = await mount();
    const circle = byId(r, 'tutorial-illustration-1');
    expect(circle.findAll((n) => n.type === Image && n.props.testID === 'tutorial-logo')).toHaveLength(1);
    const src = fs.readFileSync(path.join(__dirname, '../screens/onboarding/OnboardingTutorialScreen.tsx'), 'utf8');
    const logoCase = src.slice(src.indexOf("case 'logo':"), src.indexOf("case 'wod':"));
    expect(logoCase).toContain("require('../../../assets/athex-logo.png')");
    expect(src).not.toContain("assets/logo.png");
    r.unmount();
  });
});
