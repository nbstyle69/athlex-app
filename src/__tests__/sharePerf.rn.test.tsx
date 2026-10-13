import React from 'react';
import { Platform, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import i18n from '../i18n';
import ShareScoreCard, { SCORE_LINE_EM } from '../components/ShareScoreCard';
import { OSWALD_MEDIUM } from '../theme/oswaldMetrics';
import { FICHIER_OSWALD_MEDIUM, lirePolice } from './policeTtf';
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
  // Tailles et formule « / 0.87 » d'Android (styles de master) ; iOS : voir « Score géant sur iOS ».
  const os = Platform.OS;
  beforeAll(() => { Platform.OS = 'android'; });
  afterAll(() => { Platform.OS = os; });

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

describe('i18n 1a : date de l’image selon la langue', () => {
  it('la date suit la langue de l’app au moment du partage', async () => {
    const p = { ...BASE, ...CASES[1].p, width: 390, height: 844 };
    let r = await render(<ShareScoreCard {...p} />);
    expect(texts(r).some((s) => /octobre 2026/.test(s))).toBe(true);
    const before = i18n.language;
    await act(async () => { await i18n.changeLanguage('en'); });
    try {
      r = await render(<ShareScoreCard {...p} />);
      expect(texts(r).some((s) => /October 2026/.test(s))).toBe(true);
      expect(texts(r).some((s) => /octobre/.test(s))).toBe(false);
      expect(textOf(all(r, 'share-level')[0])).toBe('SCALED');
    } finally {
      await act(async () => { await i18n.changeLanguage(before); });
    }
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

describe('Score géant sur iOS : ligne native entière, encre placée comme sur Android', () => {
  // Preuves tirées du fichier de police embarqué, pas des constantes du code.
  const P = lirePolice(FICHIER_OSWALD_MEDIUM);
  const em = (x: number) => x / P.unitsPerEm;
  const A = em(P.hhea.ascender), D = em(-P.hhea.descender), LIGNE = A + D + em(P.hhea.lineGap);
  const encre = (v: string) => ({
    haut: Math.max(...[...v].map((c) => em(P.glyphe(c).yMax))), bas: Math.min(...[...v].map((c) => em(P.glyphe(c).yMin))),
  });
  const chasse = (v: string, fs: number, u: number) => [...v].reduce((s, c) => s + em(P.glyphe(c).chasse), 0) * fs - (v.length - 1) * u;

  type Score = [string, number, string, boolean?];
  const SCORES: Score[] = [
    ['90 KG', 90, 'weight'], ['170 KG', 170, 'weight'], ['142.5 KG', 142.5, 'weight'], ['1000 KG', 1000, 'weight'],
    ['04:27', 267, 'time'], ['59:59', 3599, 'time'], ['100:00', 6000, 'time'], ['CAP + 12 REPS', 12, 'time', true],
    ['1250 REPS', 1250, 'reps'], ['12 RNDS', 12, 'rounds'], ['7 (custom)', 7, 'custom'],
  ];
  // Écrans (barre d'actions de SharePerfScreen : 122 + zone sûre 16 + 20) et image partagée (valeurs par défaut).
  type Taille = { nom: string; w: number; h: number; ecran: boolean };
  const TAILLES: Taille[] = [
    { nom: '390 × 844', w: 390, h: 844, ecran: true }, { nom: '375 × 667', w: 375, h: 667, ecran: true },
    { nom: '430 × 932', w: 430, h: 932, ecran: true }, { nom: 'image 1080 × 1920', w: 1080, h: 1920, ecran: false },
  ];
  /** Hauteur du contenu hors espace sous l'en-tête et hors boîte du score, maquette 390 (émulateur, 90 KG : 601,5 − 68 − 0,87 × 170). */
  const RESTE = 385.6;

  const os = Platform.OS;
  afterAll(() => { Platform.OS = os; });

  /** Carte sur une plateforme, réduite en hauteur par son propre onLayout (contenu modélisé) jusqu'à tenir. */
  async function carte(plateforme: 'ios' | 'android', t: Taille, s: Score) {
    Platform.OS = plateforme;
    const u = t.w / 390;
    const r = await render(<ShareScoreCard {...BASE} wodTitle="Musculation" wodType="strength" score={s[1]} scoreType={s[2]}
      capped={s[3] ?? false} rx rank={2} date="2026-10-12" width={t.w} height={t.h}
      {...(t.ecran ? { topInset: 32, bottomReserve: 158 } : {})} />);
    const top = t.ecran ? 32 : 40 * u;
    const limite = t.h - (t.ecran ? 158 : 52 * u);
    const mesure = () => {
      const boite = all(r, 'share-score-box')[0].props.style ?? {};
      const st = all(r, 'share-score')[0].props.style;
      const ecart = r.findAll((n) => typeof n.type === 'string' && n.props.style?.gap === 10 * u)[0].props.style.marginTop;
      const hauteurScore = (boite.marginTop ?? 0) + (st.marginTop ?? 0) + st.lineHeight + (st.marginBottom ?? 0) + (boite.marginBottom ?? 0);
      return { boite, st, hauteur: RESTE * u + ecart + hauteurScore };
    };
    for (let i = 0; i < 6; i++) {
      const content = all(r, 'share-card-content')[0];
      await act(async () => { content.props.onLayout({ nativeEvent: { layout: { x: 24 * u, y: top, width: 342 * u, height: mesure().hauteur } } }); });
    }
    const { st, boite, hauteur } = mesure();
    const valeur = textOf(all(r, 'share-score')[0]);
    const largeur = 346 * u;
    // Taille rendue : adjustsFontSizeToFit ne réduit que si la chasse dépasse (iOS : à 96 pt au plus, sans réduire
    // la ligne ; Android : par pas de 1 tant que le texte passe à la ligne, sans réduire la ligne non plus).
    let fs = st.fontSize;
    if (chasse(valeur, fs, u) > largeur) {
      if (plateforme === 'ios') fs = Math.min(96, fs);
      else while (chasse(valeur, fs, u) > largeur) fs -= 1;
    }
    const L = st.lineHeight;
    // Ligne de base dans le cadre du Text (code RN 0.81) — iOS : ligne native centrée si lineHeight ≥ ligne native,
    // sinon le bas est gardé et le haut coupé ; Android : demi-interligne de part et d'autre (CustomLineHeightSpan).
    const base = plateforme === 'ios'
      ? (L >= LIGNE * fs ? (L - LIGNE * fs) / 2 + A * fs : L - D * fs)
      : L / 2 + ((A - D) / 2) * fs;
    const e = encre(valeur);
    const debutTexte = 16 * u + (boite.marginTop ?? 0) + (st.marginTop ?? 0); // haut du cadre du Text, depuis le bas de la date
    const finScore = debutTexte + L + (st.marginBottom ?? 0) + (boite.marginBottom ?? 0); // haut de la ligne unité / RX
    return {
      u, fs, L, valeur, largeur, st, bas: top + hauteur, limite,
      encreHautCadre: base - e.haut * fs, encreBasCadre: base - e.bas * fs,
      dateVersEncre: debutTexte + base - e.haut * fs, encreVersUnite: finScore - (debutTexte + base - e.bas * fs),
    };
  }

  it("les mesures d'Oswald Medium du code sont celles du fichier .ttf", () => {
    expect(OSWALD_MEDIUM.unitsPerEm).toBe(P.unitsPerEm);
    expect([OSWALD_MEDIUM.ascender, OSWALD_MEDIUM.descender, OSWALD_MEDIUM.lineGap]).toEqual([P.hhea.ascender, P.hhea.descender, P.hhea.lineGap]);
    expect([P.typo.ascender, P.typo.descender, P.typo.lineGap, P.typo.utilisees]).toEqual([P.hhea.ascender, P.hhea.descender, P.hhea.lineGap, true]);
    expect(OSWALD_MEDIUM.digitTop).toBe(Math.max(...[...'0123456789'].map((c) => P.glyphe(c).yMax)));
    expect(OSWALD_MEDIUM.digitBottom).toBe(Math.min(...[...'0123456789'].map((c) => P.glyphe(c).yMin)));
    for (const [c, v] of Object.entries(OSWALD_MEDIUM.advances)) expect([c, v]).toEqual([c, P.glyphe(c).chasse]);
    for (const c of Object.keys(OSWALD_MEDIUM.advances)) expect(OSWALD_MEDIUM.fallbackAdvance).toBeGreaterThan(P.glyphe(c).chasse);
    expect(SCORE_LINE_EM).toBeCloseTo(LIGNE, 10);
  });

  describe.each(TAILLES)('$nom', (t) => {
    it.each(SCORES)('%s', async (...s) => {
      const i = await carte('ios', t, s as Score);
      const a = await carte('android', t, s as Score);
      // a. Rien de coupé : l'encre tient dans le cadre du Text, qui n'a pas de marge propre.
      expect(i.encreHautCadre).toBeGreaterThanOrEqual(0);
      expect(i.encreBasCadre).toBeLessThanOrEqual(i.L);
      expect([i.st.marginTop, i.st.marginBottom]).toEqual([undefined, undefined]);
      // b. Le haut des chiffres reste sous le bas de la ligne de la date.
      expect(i.dateVersEncre).toBeGreaterThan(0);
      // c. La chasse tient dans la largeur à la taille demandée : adjustsFontSizeToFit ne réduit rien.
      expect(chasse(i.valeur, i.st.fontSize, i.u)).toBeLessThanOrEqual(i.largeur);
      expect(i.fs).toBe(i.st.fontSize);
      // d. Le contenu finit au-dessus de la réserve basse, sur les deux plateformes.
      expect(i.bas).toBeLessThanOrEqual(i.limite);
      expect(a.bas).toBeLessThanOrEqual(a.limite);
      // e. Mêmes écarts visibles qu'Android, à 1 px près.
      expect(Math.abs(i.dateVersEncre - a.dateVersEncre)).toBeLessThanOrEqual(1);
      expect(Math.abs(i.encreVersUnite - a.encreVersUnite)).toBeLessThanOrEqual(1);
    });
  });

  it.each(TAILLES)('Android, $nom : styles du score identiques à master', async (t) => {
    Platform.OS = 'android';
    const u = t.w / 390;
    const S = 170 * u;
    for (const s of SCORES) {
      const r = await render(<ShareScoreCard {...BASE} wodTitle="Musculation" wodType="strength" score={s[1]} scoreType={s[2]}
        capped={s[3] ?? false} rx rank={2} date="2026-10-12" width={t.w} height={t.h} />);
      expect(all(r, 'share-score')[0].props.style).toEqual({
        fontFamily: 'Oswald_500Medium', fontSize: S, lineHeight: S, marginTop: -0.1 * S, marginBottom: -0.03 * S,
        letterSpacing: -u, color: jest.requireActual('../theme/palette').darkTheme.ax.accentText, includeFontPadding: false,
      });
      expect(all(r, 'share-score-box')[0].props.style).toBeUndefined();
      expect(all(r, 'share-score')[0].props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.2 });
    }
  });

  it('iOS : adjustsFontSizeToFit et minimumFontScale restent en place', async () => {
    Platform.OS = 'ios';
    const r = await render(<ShareScoreCard {...BASE} {...CASES[0].p} width={390} height={844} />);
    expect(all(r, 'share-score')[0].props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.2 });
  });
});
