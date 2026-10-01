/**
 * Décompte incrusté dans la vidéo, centré (retour de Nab, build 1.0.58). La
 * géométrie est testée sur JVM (CountdownLayoutTest.kt) ; ce test garde les deux
 * moteurs de rendu alignés sur elle : même groupe « libellé + anneau » centré,
 * mêmes nombres, textes (libellé, chiffre, « GO ! ») centrés sur leur encre.
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
/** Nombres d'une fonction de géométrie (« 0.55f » et « 0.55 » comptent pareil). */
const numbers = (src: string, name: string) => {
  const m = src.match(new RegExp(`fun(?:c)? ${name}\\([^\\n]*`));
  expect(m).not.toBeNull();
  return (m![0].match(/\d+\.\d+/g) ?? []).map(Number);
};

describe('décompte incrusté centré : même géométrie iOS et Android', () => {
  it.each(['ringDiameter', 'labelSize', 'digitSize', 'gap', 'goSize'])('%s : mêmes nombres des deux côtés', (name) => {
    expect(numbers(swiftLayout, name)).toEqual(numbers(layoutKt, name));
    expect(numbers(layoutKt, name).length).toBeGreaterThan(0);
  });

  it('le groupe libellé + anneau est centré (haut = (hauteur − groupe) / 2), le libellé ne déplace jamais l’anneau', () => {
    expect(layoutKt).toContain('val top = (height - (labelBlock + d)) / 2f');
    expect(swiftLayout).toContain('let top = (size.height - (labelBlock + d)) / 2');
    for (const src of [layoutKt, swiftLayout]) {
      expect(src).toMatch(/hasLabel: Bool(ean)?/);
      expect(src).toMatch(/labelH = (if \(hasLabel\) labelSize\(d\) else 0f|hasLabel \? labelSize\(d\) : 0)/);
    }
  });

  it('Android : décompte et GO passent par la géométrie et le centrage par l’encre', () => {
    const cd = fn(rendererKt, 'private fun drawCountdown(');
    expect(cd).toContain('CountdownLayout.countdown(width, height, isLandscape, hasLabel = state.countdownLabel.isNotEmpty())');
    expect(cd).toContain('drawInkCentered(canvas, state.countdownLabel, cx, layout.labelCenterY)');
    expect(cd).toContain('drawInkCentered(canvas, "${state.countdownValue}", cx, cy)');
    expect(cd).not.toContain('drawText(');
    const go = fn(rendererKt, 'private fun drawGoBand(');
    expect(go).toContain('canvas.translate(width / 2f, height / 2f)');
    expect(go).toContain('drawInkCentered(canvas, state.goLabel, 0f, 0f)');
    expect(go).not.toContain('drawText(');
    const ink = fn(rendererKt, 'private fun drawInkCentered(');
    expect(ink).toContain('CountdownLayout.originXFor(cx, ink.left.toFloat(), ink.right.toFloat())');
    expect(ink).toContain('CountdownLayout.baselineFor(cy, ink.top.toFloat(), ink.bottom.toFloat())');
    expect(rendererKt).toContain('textPaint.getTextBounds(text, 0, text.length, inkBounds)');
    expect(rendererKt).toContain('textPaint.textAlign = Paint.Align.LEFT');
  });

  it('iOS : décompte et GO passent par la géométrie et le centrage par l’encre (usesDeviceMetrics)', () => {
    const cd = fn(swift, 'private func drawCountdown(');
    expect(cd).toContain('CountdownLayout.countdown(size: size, isLandscape: isLandscape, hasLabel: !state.countdownLabel.isEmpty)');
    expect(cd).toContain('center: CGPoint(x: layout.centerX, y: layout.labelCenterY)');
    expect(cd).toContain('center: CGPoint(x: circle.midX, y: circle.midY)');
    expect(cd).not.toContain('drawText(');
    const go = fn(swift, 'private func drawGoBand(');
    expect(go).toContain('context.translateBy(x: size.width / 2, y: size.height / 2)');
    expect(go).toContain('drawInkCentered(context: context, text: state.goLabel, center: .zero,');
    expect(go).not.toContain('drawText(');
    const ink = fn(swift, 'private func drawInkCentered(');
    expect(ink).toContain('options: [.usesLineFragmentOrigin, .usesDeviceMetrics]');
    expect(ink).toContain('CGPoint(x: center.x - ink.midX, y: center.y - ink.midY)');
    expect(ink).toContain('alignment: .left');
  });

  it('caméra avant ou arrière : l’incrustation ne dépend pas du côté de la caméra', () => {
    for (const src of [fn(rendererKt, 'private fun drawCountdown('), fn(swift, 'private func drawCountdown(')]) {
      expect(src).not.toMatch(/facing|mirror/i);
    }
  });
});
