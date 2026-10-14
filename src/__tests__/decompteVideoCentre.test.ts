/**
 * Décompte incrusté dans la vidéo, centré (retour de Nab, build 1.0.58 ; refait pour #547 PR 3).
 * La géométrie est testée sur JVM (CountdownLayoutTest.kt) et, pour iOS, par le calcul Swift
 * extrait (decompteVideoParite.test.ts) ; ce test garde les deux moteurs de rendu alignés :
 * même groupe « libellé + anneau » centré, chiffre posé par sa ligne de base (milieu du glyphe au
 * centre de l'anneau), « GO ! » centré sur son encre.
 * #547 PR 3 : sur iOS, le décompte n'est plus placé par boundingRect(… .usesDeviceMetrics) suivi de
 * draw(with: … .usesLineFragmentOrigin) — le rectangle du glyphe est compté depuis la ligne de base,
 * le dessin depuis le haut de la ligne : chiffre trop bas d'environ 0,385 em (constat de Nab).
 */
import fs from 'fs';
import path from 'path';

const MOD = path.join(__dirname, '..', '..', 'modules', 'realtime-recorder');
const read = (p: string) => fs.readFileSync(path.join(MOD, p), 'utf8');
const KT_DIR = 'android/src/main/java/expo/modules/realtimerecorder';
const layoutKt = read(`${KT_DIR}/CountdownLayout.kt`);
const rendererKt = read(`${KT_DIR}/OverlayRenderer.kt`);
const swift = read('ios/OverlayRenderer.swift');
const swiftLayout = swift.slice(swift.indexOf('enum CountdownLayout'));
const fn = (src: string, start: string) => {
  const i = src.indexOf(start);
  expect(i).toBeGreaterThan(-1);
  const next = src.indexOf('\n  private func ', i + start.length);
  const nextKt = src.indexOf('\n  private fun ', i + start.length);
  const ends = [next, nextKt].filter((n) => n > 0);
  return src.slice(i, ends.length ? Math.min(...ends) : undefined);
};
/** Nombres d'une fonction de géométrie (« 0.16f » et « 0.16 » comptent pareil). */
const numbers = (src: string, name: string) => {
  const m = src.match(new RegExp(`fun(?:c)? ${name}\\([^\\n]*`));
  expect(m).not.toBeNull();
  return (m![0].match(/\d+\.\d+/g) ?? []).map(Number);
};

describe('décompte incrusté centré : même géométrie iOS et Android', () => {
  it('« GO ! » : mêmes nombres des deux côtés', () => {
    expect(numbers(swiftLayout, 'goSize')).toEqual(numbers(layoutKt, 'goSize'));
    expect(numbers(layoutKt, 'goSize').length).toBeGreaterThan(0);
  });

  it('le groupe libellé + anneau est centré (haut = (hauteur − groupe) / 2), le libellé ne déplace jamais l’anneau', () => {
    expect(layoutKt).toContain('val top = (height - (labelBlock + d)) / 2f');
    expect(swiftLayout).toContain('let top = (size.height - (labelBlock + d)) / 2');
    expect(layoutKt).toContain('val labelBlock = if (hasLabel) labelSize + gap else 0f');
    expect(swiftLayout).toContain('let labelBlock = hasLabel ? labelSize + gap : 0');
    expect(layoutKt).toContain('digitBaselineY = cy + m.capHeightEm * digitSize / 2f,');
    expect(swiftLayout).toContain('digitBaselineY: cy + m.capHeightEm * digitSize / 2,');
  });

  it('Android : décompte posé par la géométrie (ligne de base explicite), « GO ! » par son encre ; alignement à gauche gardé', () => {
    const cd = fn(rendererKt, 'private fun drawCountdown(');
    expect(cd).toContain('CountdownLayout.countdown(width, height, hasLabel = state.countdownLabel.isNotEmpty(), m = m)');
    expect(cd).toContain('canvas.drawText(digit, c.centerX - textPaint.measureText(digit) / 2f, c.digitBaselineY, textPaint)');
    expect(cd).not.toContain('drawInkCentered(');
    expect(rendererKt).not.toContain('textAlign = Paint.Align.CENTER');
    const go = fn(rendererKt, 'private fun drawGoBand(');
    expect(go).toContain('canvas.translate(width / 2f, height / 2f)');
    expect(go).toContain('drawInkCentered(canvas, state.goLabel, 0f, 0f)');
    const ink = fn(rendererKt, 'private fun drawInkCentered(');
    expect(ink).toContain('CountdownLayout.originXFor(cx, ink.left.toFloat(), ink.right.toFloat())');
    expect(ink).toContain('CountdownLayout.baselineFor(cy, ink.top.toFloat(), ink.bottom.toFloat())');
    expect(rendererKt).toContain('textPaint.textAlign = Paint.Align.LEFT');
  });

  it('iOS : décompte en CoreText à une ligne de base explicite, sans boundingRect', () => {
    const cd = fn(swift, 'private func drawCountdown(');
    expect(cd).toContain('CountdownLayout.countdown(size: size, hasLabel: !state.countdownLabel.isEmpty, metrics: m)');
    expect(cd).toContain('drawLine(line, context: context, x: c.centerX - width / 2, baseline: c.digitBaselineY, shadow: !tense)');
    expect(cd).not.toMatch(/boundingRect|usesDeviceMetrics|drawInkCentered/);
    const ligne = fn(swift, 'private func drawLine(');
    expect(ligne).toContain('context.translateBy(x: x, y: baseline)');
    expect(ligne).toContain('context.scaleBy(x: 1, y: -1)');
    expect(ligne).toContain('context.textPosition = .zero');
    expect(ligne).toContain('CTLineDraw(line, context)');
    const go = fn(swift, 'private func drawGoBand(');
    expect(go).toContain('context.translateBy(x: size.width / 2, y: size.height / 2)');
  });

  it('caméra avant ou arrière : l’incrustation ne dépend pas du côté de la caméra', () => {
    for (const src of [fn(rendererKt, 'private fun drawCountdown('), fn(swift, 'private func drawCountdown(')]) {
      expect(src).not.toMatch(/facing|mirror/i);
    }
  });
});
