/**
 * #547 PR 3 : le décompte incrusté dans le fichier vidéo (module natif) reprend l'apparence du
 * décompte à l'écran (CountdownView, #549) au repos. Les valeurs sont recopiées dans le Kotlin et
 * le Swift (le module ne reçoit pas de configuration au début de l'enregistrement) : ce test lit les
 * trois fichiers et échoue si une valeur diffère de TimerRunScreen.tsx et des jetons de l'écran.
 */
import fs from 'fs';
import path from 'path';
import { axSpacing, axTypography } from '../theme/axTokens';
import { FICHIER_OSWALD_MEDIUM, lirePolice } from './policeTtf';

const racine = path.join(__dirname, '..', '..');
const lire = (f: string) => fs.readFileSync(path.join(racine, f), 'utf8');
const ecran = lire('src/screens/timer/TimerRunScreen.tsx');
const kotlin = lire('modules/realtime-recorder/android/src/main/java/expo/modules/realtimerecorder/CountdownLayout.kt');
const swift = lire('modules/realtime-recorder/ios/OverlayRenderer.swift');

function valeur(source: string, motif: RegExp, nom: string): number {
  const m = source.match(motif);
  if (!m) throw new Error(`absent : ${nom}`);
  return Number(m[1]);
}
const ts = (nom: string) => valeur(ecran, new RegExp(`export const ${nom} = ([\\d.]+);`), nom);
const kt = (nom: string) => valeur(kotlin, new RegExp(`const val ${nom} = ([\\d.]+)f`), nom);
const sw = (nom: string) => valeur(swift, new RegExp(`static let ${nom}: CGFloat = ([\\d.]+)`), nom);

describe('#547 PR 3 : constantes du décompte incrusté identiques à l’écran', () => {
  it.each([
    ['anneau (part du côté court)', ts('CD_RING_RATIO'), 'RING_RATIO', 'ringRatio'],
    ['bordure de l’anneau (dp)', ts('CD_RING_BORDER'), 'RING_BORDER_DP', 'ringBorderDp'],
    ['marge d’encre (dp)', ts('CD_INK_MARGIN'), 'INK_MARGIN_DP', 'inkMarginDp'],
    ['approche du libellé (dp)', ts('CD_LABEL_TRACKING'), 'LABEL_TRACKING_DP', 'labelTrackingDp'],
    ['taille du libellé (axTypography.overline)', axTypography.overline.fontSize, 'LABEL_SIZE_DP', 'labelSizeDp'],
    ['écart libellé → anneau (axSpacing.sm)', axSpacing.sm, 'LABEL_GAP_DP', 'labelGapDp'],
  ] as const)('%s : écran %d, Kotlin et Swift identiques', (_, attendu, nomKt, nomSw) => {
    expect([kt(nomKt), sw(nomSw)]).toEqual([attendu, attendu]);
  });

  it('écran de référence du cadre vidéo : même côté court en Kotlin et en Swift', () => {
    expect(sw('refShortDp')).toBe(kt('REF_SHORT_DP'));
  });

  it('CountdownView utilise bien ces valeurs (libellé overline, approche, écart, anneau)', () => {
    const vue = ecran.slice(ecran.indexOf('function CountdownView('), ecran.indexOf('/** « GO ! »'));
    expect(vue).toContain("<View testID=\"timer-countdown\" style={{ alignItems: 'center', gap: axSpacing.sm }}>");
    expect(vue).toContain('axTypography.overline, { color: tense ? accentInk : inkOnSecondary(bg), letterSpacing: CD_LABEL_TRACKING }');
    expect(vue).toContain('borderWidth: CD_RING_BORDER');
    expect(ecran).toContain('const cdAnneau = Math.round(cdCote * CD_RING_RATIO);');
    expect(ecran).toContain('const rayon = (ring - 2 * CD_RING_BORDER) / 2 - CD_INK_MARGIN;');
  });

  it('la durée du décompte part du JS et est lue par les deux modules natifs', () => {
    expect(ecran).toContain('countdownMax: countdown,');
    expect(lire('modules/realtime-recorder/android/src/main/java/expo/modules/realtimerecorder/RealtimeRecorderModule.kt'))
      .toContain('(dict["countdownMax"] as? Double)?.let { engine.overlayState.countdownMax = it.toInt() }');
    expect(lire('modules/realtime-recorder/ios/RealtimeRecorderModule.swift'))
      .toContain('if let v = dict["countdownMax"] as? Int   { self.engine.overlayState.countdownMax = v }');
  });
});

// ─── iOS, sans Mac : le calcul du Swift, extrait du fichier et évalué ───────────
// Le corps de CountdownLayout.countdown (Swift) est traduit mécaniquement en JS puis évalué avec
// les mesures du fichier Oswald Medium embarqué (celles que lisent UIFont et CoreText : chasses hmtx,
// contours glyf, capHeight OS/2), aux tailles de sortie d'iOS (1080 × 1920 et 1920 × 1080).
type Compte = { centerX: number; ringCenterY: number; ringDiameter: number; ringBorder: number; inkRadius: number;
  digitSize: number; digitBaselineY: number; labelSize: number; labelTracking: number; labelInkBottomY: number };
type Metriques = { widestAdvanceEm: number; inkHeightEm: number; capHeightEm: number };
function calculSwift(): (W: number, H: number, label: boolean, m: Metriques) => Compte {
  const debut = swift.indexOf('static func countdown(size: CGSize, hasLabel: Bool, metrics m: DigitMetrics) -> Countdown {');
  if (debut < 0) throw new Error('fonction Swift introuvable');
  const fin = swift.indexOf('static func maxValue', debut);
  const corps = swift.slice(swift.indexOf('{', debut) + 1, fin);
  const lets = [...corps.matchAll(/^\s*let (\w+) = (.+)$/gm)].map(([, n, e]) => `const ${n} = ${e
    .replace(/\((.+)\)\.squareRoot\(\)/g, 'Math.sqrt($1)')
    .replace(/\((.+)\)\.rounded\(\.down\)/g, 'Math.floor($1)')
    .replace(/\bmin\(/g, 'Math.min(')
    .replace(/size\.width/g, 'W').replace(/size\.height/g, 'H').replace(/hasLabel/g, 'label')};`);
  const retour = corps.slice(corps.indexOf('return Countdown(') + 'return Countdown('.length, corps.lastIndexOf(')'))
    .replace(/size\.width/g, 'W').replace(/size\.height/g, 'H');
  const constantes = ['ringRatio', 'ringBorderDp', 'inkMarginDp', 'labelSizeDp', 'labelTrackingDp', 'labelGapDp', 'refShortDp']
    .map((n) => `const ${n} = ${sw(n)};`).join('\n');
  if (lets.length < 12) throw new Error('corps Swift inattendu : ' + lets.length + ' let');
  // eslint-disable-next-line no-new-func
  return new Function('W', 'H', 'label', 'm', `${constantes}\n${lets.join('\n')}\nreturn {${retour}};`) as never;
}

describe('#547 PR 3 : calcul iOS (Swift extrait), aux tailles de sortie 1080 × 1920 et 1920 × 1080', () => {
  const P = lirePolice(FICHIER_OSWALD_MEDIUM);
  const em = (u: number) => u / P.unitsPerEm;
  const chasse = (v: number) => em([...String(v)].reduce((s, c) => s + P.glyphe(c).chasse, 0));
  const chiffres = [...'0123456789'].map((c) => P.glyphe(c));
  const encreEm = em(Math.max(...chiffres.map((g) => g.yMax)) - Math.min(...chiffres.map((g) => g.yMin)));
  const metriques = (max: number): Metriques => ({
    widestAdvanceEm: Math.max(...Array.from({ length: max }, (_, i) => chasse(i + 1))), inkHeightEm: encreEm, capHeightEm: em(P.capHeight),
  });
  const calcul = calculSwift();

  it.each([[1080, 1920], [1920, 1080]] as const)('%i × %i : anneau de 36 %, milieu du glyphe au centre, encre de chaque valeur dans l’anneau avec sa marge, libellé au-dessus', (W, H) => {
    for (const max of [10, 15, 30, 9]) {
      const c = calcul(W, H, true, metriques(max));
      const dp = Math.min(W, H) / 390;
      expect(c.ringDiameter).toBeCloseTo(Math.min(W, H) * 0.36, 6);
      expect(c.ringBorder).toBeCloseTo(2 * dp, 6);
      // CTLineDraw pose la ligne de base à la position donnée : milieu des capitales = ligne de base − capHeight / 2.
      expect(c.digitBaselineY - (em(P.capHeight) * c.digitSize) / 2).toBeCloseTo(c.ringCenterY, 6);
      expect(c.inkRadius).toBeCloseTo((c.ringDiameter - 2 * c.ringBorder) / 2 - 6 * dp, 6);
      const coins = Array.from({ length: max }, (_, i) => Math.hypot(chasse(i + 1) * c.digitSize, encreEm * c.digitSize) / 2);
      expect(Math.max(...coins)).toBeLessThanOrEqual(c.inkRadius);
      expect(Math.max(...coins)).toBeGreaterThan(c.inkRadius - 1);
      const haut = c.ringCenterY - c.ringDiameter / 2;
      expect(haut - c.labelInkBottomY).toBeCloseTo(8 * dp, 6);
      expect(c.labelSize).toBeCloseTo(12 * dp, 6);
      expect((c.labelInkBottomY - c.labelSize + haut + c.ringDiameter) / 2).toBeCloseTo(H / 2, 6);
      expect(c.centerX).toBe(W / 2);
    }
  });

  it('ancien placement iOS (boundingRect .usesDeviceMetrics puis draw .usesLineFragmentOrigin) : chiffre trop bas d’environ 0,385 em', () => {
    // Rectangle du glyphe compté depuis la ligne de base, vers le haut ; dessin posé par le haut de la ligne :
    // le milieu de l'encre tombe à ascendante − (yMin + yMax) sous le centre visé.
    const g = P.glyphe('3');
    const decalageEm = em(P.hhea.ascender) - em(g.yMin + g.yMax);
    expect(decalageEm).toBeCloseTo(0.385, 3);
    // 1080 × 1920, ancien anneau de 55 % : « 10 » à 0,55 × Ø (126 px), « 3 » à 0,7 × Ø (160 px).
    const d = 1080 * 0.55;
    expect(Math.round(decalageEm * d * 0.55)).toBe(126);
    expect(Math.round(decalageEm * d * 0.7)).toBe(160);
  });
});
