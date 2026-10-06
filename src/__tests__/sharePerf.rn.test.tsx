import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import i18n from '../i18n';
import ShareScoreCard from '../components/ShareScoreCard';
import SharePerfScreen from '../components/SharePerfScreen';

jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: { ax: jest.requireActual('../theme/palette').darkTheme.ax } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('react-native-view-shot', () => {
  const R = require('react');
  return R.forwardRef((p: any, _ref: any) => R.createElement('ViewShot', p, p.children));
});

// Les six variantes de la maquette (609:71007 → 609:71612) : valeur, unité, niveau, rang.
const BASE = { username: 'athlex_user', avatarUrl: null, boxName: 'AthleX Fitness', totalParticipants: 9 };
const CASES = [
  { nom: 'For time', p: { wodTitle: 'Fran', wodType: 'for-time', score: 267, scoreType: 'time', capped: false, rx: true, rank: 3, date: '2026-10-03' },
    type: 'FOR TIME', value: '04:27', unit: null, level: 'RX', medal: true },
  { nom: 'For time capé', p: { wodTitle: 'Murph light', wodType: 'for-time', score: 12, scoreType: 'time', capped: true, rx: false, rank: 7, date: '2026-10-03' },
    type: 'FOR TIME', value: 'CAP', unit: '+ 12 REPS', level: 'SCALED', medal: false },
  { nom: 'AMRAP', p: { wodTitle: 'AMRAP 14 · Wall ball / Box jump', wodType: 'amrap', score: 156, scoreType: 'reps', rx: true, rank: 2, date: '2026-10-05' },
    type: 'AMRAP', value: '156', unit: 'REPS', level: 'RX', medal: true },
  { nom: 'EMOM sans rang', p: { wodTitle: 'EMOM 16 · KB swings / Burpees', wodType: 'emom', score: 192, scoreType: 'reps', rx: true, rank: null, date: '2026-10-06' },
    type: 'EMOM', value: '192', unit: 'REPS', level: 'RX', medal: false },
  { nom: 'Tabata', p: { wodTitle: 'Tabata air squat', wodType: 'tabata', score: 84, scoreType: 'reps', rx: false, rank: 1, date: '2026-10-06' },
    type: 'TABATA', value: '84', unit: 'REPS', level: 'SCALED', medal: true },
  { nom: 'Custom (rounds)', p: { wodTitle: 'Chipper du samedi', wodType: 'custom', score: 5, scoreType: 'rounds', rx: true, rank: 4, date: '2026-10-03' },
    type: 'CUSTOM', value: '5', unit: 'RNDS', level: 'RX', medal: false },
];

let root: TestRenderer.ReactTestRenderer;
afterEach(async () => { if (root) await act(async () => root.unmount()); });

async function render(el: React.ReactElement) {
  await act(async () => { root = TestRenderer.create(el); });
  return root.root;
}
const all = (r: TestRenderer.ReactTestInstance, id: string) => r.findAll((n) => n.props.testID === id && typeof n.type === 'string');
const own = (x: TestRenderer.ReactTestInstance) => React.Children.toArray(x.props.children).filter((k) => typeof k !== 'object').join('');
// Textes d'un nœud : ses Text descendants, ou son propre contenu quand le nœud est lui-même un texte.
const textOf = (n: TestRenderer.ReactTestInstance) => {
  const inner = n.findAll((x) => x.type === Text);
  return inner.length ? inner.map(own).join('|') : own(n);
};
const texts = (r: TestRenderer.ReactTestInstance) => r.findAll((x) => x.type === Text).map((x) => React.Children.toArray(x.props.children).join(''));
const EMOJI = /\p{Extended_Pictographic}/u;

describe('ShareScoreCard : les six types de la maquette', () => {
  it.each(CASES)('$nom', async (c) => {
    const r = await render(<ShareScoreCard {...BASE} {...c.p} width={390} height={844} />);
    expect(textOf(all(r, 'share-score')[0])).toBe(c.value);
    if (c.unit) expect(textOf(all(r, 'share-unit')[0])).toBe(c.unit);
    else expect(all(r, 'share-unit')).toHaveLength(0);
    expect(textOf(all(r, 'share-level')[0])).toBe(c.level);
    expect(textOf(all(r, 'share-type')[0])).toBe(c.type);
    if (c.p.rank == null) expect(all(r, 'share-rank')).toHaveLength(0);
    else expect(textOf(all(r, 'share-rank')[0])).toBe(`${i18n.t('sharePerf.ranking')}|#${c.p.rank}|/ ${BASE.totalParticipants}`);
    expect(all(r, 'share-medal').length > 0).toBe(c.medal);
    expect(all(r, 'share-title')[0].props.numberOfLines).toBe(2);
    const score = all(r, 'share-score')[0];
    expect(score.props.numberOfLines).toBe(1);
    expect(score.props.adjustsFontSizeToFit).toBe(true);
    expect(score.props.style.fontSize).toBe(170);
    for (const s of texts(r)) expect(s).not.toMatch(EMOJI);
  });

  it("l'image 1080 garde le rapport 170/390 pour le score", async () => {
    const r = await render(<ShareScoreCard {...BASE} {...CASES[0].p} />);
    expect(all(r, 'share-score')[0].props.style.fontSize).toBeCloseTo(170 * 1080 / 390);
    // Les étiquettes AxTag suivent la même échelle (12 px sur la maquette 390).
    const tagText = all(r, 'share-type')[0].findAll((n) => typeof n.type === 'string' && n.props.style && !n.props.testID)
      .map((n) => [].concat(n.props.style).reduce((o: any, x: any) => ({ ...o, ...x }), {}))
      .find((st: any) => st.fontSize);
    expect(tagText.fontSize).toBeCloseTo(12 * 1080 / 390);
  });

  it("l'espace sous l'en-tête puis le score cèdent le dépassement (+ 1 px) pour finir au-dessus de la réserve basse", async () => {
    const r = await render(<ShareScoreCard {...BASE} {...CASES[2].p} width={390} height={844} bottomReserve={200} />);
    const layout = async (y: number, height: number) => {
      const content = all(r, 'share-card-content')[0];
      await act(async () => { content.props.onLayout({ nativeEvent: { layout: { x: 24, y, width: 342, height } } }); });
    };
    await layout(32, 600); // finit à 632 ≤ 644 : rien ne change
    expect(all(r, 'share-score')[0].props.style.fontSize).toBe(170);
    const gap = () => r.findAll((n) => n.props.style?.gap === 10 && typeof n.type === 'string')[0].props.style.marginTop;
    expect(gap()).toBe(68);
    await layout(32, 640); // finit à 672 : 28 de trop (+ 1), pris sur l'espace sous l'en-tête
    expect(gap()).toBe(68 - 29);
    expect(all(r, 'share-score')[0].props.style.fontSize).toBe(170);
    await layout(32, 690); // encore 78 de trop (+ 1) : l'espace tombe à 24, le reste (35) est pris au score (0,87 em)
    expect(gap()).toBe(24);
    expect(all(r, 'share-score')[0].props.style.fontSize).toBeCloseTo(170 - (29 + 79 - 44) / 0.87);
    await layout(32, 900); // jamais sous le plancher
    expect(all(r, 'share-score')[0].props.style.fontSize).toBe(48);
  });

  it('en anglais, FORCE devient STRENGTH', async () => {
    const strength = { ...BASE, ...CASES[0].p, wodType: 'strength', scoreType: 'weight', score: 170, width: 390, height: 844 };
    const before = i18n.language;
    await act(async () => { await i18n.changeLanguage('en'); });
    try {
      const r = await render(<ShareScoreCard {...strength} />);
      expect(textOf(all(r, 'share-type')[0])).toBe('STRENGTH');
      expect(textOf(all(r, 'share-rank')[0]).split('|')[0]).toBe('Ranking');
    } finally {
      await act(async () => { await i18n.changeLanguage(before); });
    }
    const r = await render(<ShareScoreCard {...strength} />);
    expect(textOf(all(r, 'share-type')[0])).toBe('FORCE');
  });
});

describe('« Partager ma perf » en plein écran', () => {
  async function screen() {
    const onShare = jest.fn();
    const onClose = jest.fn();
    const r = await render(
      <SharePerfScreen visible card={{ ...BASE, ...CASES[2].p }} viewShotRef={React.createRef()} sharing={false} onShare={onShare} onClose={onClose} />,
    );
    return { r, onShare, onClose };
  }
  const press = async (r: TestRenderer.ReactTestInstance, id: string) => {
    const n = r.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
    await act(async () => { n.props.onPress(); });
  };

  it('la croix et « Fermer » ferment, le bouton accent partage', async () => {
    const { r, onShare, onClose } = await screen();
    await press(r, 'share-close');
    expect(onClose).toHaveBeenCalledTimes(1);
    await press(r, 'share-dismiss');
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onShare).not.toHaveBeenCalled();
    await press(r, 'share-submit');
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(texts(r)).toEqual(expect.arrayContaining([i18n.t('sharePerf.share'), i18n.t('common.close')]));
  });

  it('en anglais, les boutons sont traduits', async () => {
    const before = i18n.language;
    await act(async () => { await i18n.changeLanguage('en'); });
    try {
      const { r } = await screen();
      expect(texts(r)).toEqual(expect.arrayContaining(['Share my performance', 'Close']));
    } finally {
      await act(async () => { await i18n.changeLanguage(before); });
    }
  });

  it("la carte de l'écran réserve la barre d'actions mesurée + 20", async () => {
    const { r } = await screen();
    const bar = all(r, 'share-actions')[0];
    await act(async () => { bar.props.onLayout({ nativeEvent: { layout: { x: 0, y: 700, width: 390, height: 140 } } }); });
    const screenCard = r.findAllByType(ShareScoreCard).find((c) => c.props.width !== 1080)!;
    expect(screenCard.props.bottomReserve).toBe(160);
    expect(screenCard.props.topInset).toBe(24 + 8);
  });

  it("plein écran, sans l'ancien titre ; l'image capturée est la carte 1080 × 1920 sans boutons", async () => {
    const { r } = await screen();
    const modal = r.findAll((x) => String(x.type) === 'Modal')[0];
    expect(modal.props.transparent).toBeFalsy();
    expect(texts(r).filter((s) => /Partager ma perf/.test(s))).toEqual([i18n.t('sharePerf.share')]);
    const shot = r.findAll((x) => String(x.type) === 'ViewShot')[0];
    expect(shot.props.options).toEqual({ format: 'png', quality: 1, result: 'tmpfile' });
    const card = shot.findByType(ShareScoreCard);
    expect([card.props.width, card.props.height]).toEqual([1080, 1920]);
    expect(shot.findAll((x) => /^share-(close|submit|dismiss)$/.test(x.props.testID ?? ''))).toHaveLength(0);
    for (const s of texts(r)) expect(s).not.toMatch(EMOJI);
  });
});
