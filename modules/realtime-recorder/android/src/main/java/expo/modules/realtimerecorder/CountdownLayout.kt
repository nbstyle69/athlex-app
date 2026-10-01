package expo.modules.realtimerecorder

/**
 * Geometry of the countdown burned into the video, centered in the frame
 * (portrait or landscape, front or back camera: the overlay covers the whole
 * frame and is never mirrored). Free of Android types: JVM unit tests.
 *
 * The group « label + gap + ring » is centered vertically (the ring alone used
 * to be centered, which pushed the whole group up), and every text is placed by
 * its ink — the glyphs actually drawn — not by its line box (ascent/descent) nor
 * its advance (trailing letter spacing). Same rules as the iOS OverlayRenderer.
 */
object CountdownLayout {
  /** Ring diameter: half of the short side in landscape, 55 % in portrait. */
  fun ringDiameter(refDim: Float, isLandscape: Boolean): Float = refDim * (if (isLandscape) 0.5f else 0.55f)

  fun labelSize(ringDiameter: Float): Float = ringDiameter * 0.07f
  fun digitSize(ringDiameter: Float, tense: Boolean): Float = ringDiameter * (if (tense) 0.7f else 0.55f)
  fun gap(ringDiameter: Float): Float = ringDiameter * 0.04f

  /** « GO ! » text size and band height (text centered in the band, band centered in the frame). */
  fun goSize(refDim: Float): Float = refDim * 0.16f
  fun goBandHeight(goSize: Float): Float = goSize * 1.9f

  data class Countdown(
    val centerX: Float,
    /** Vertical center of the label's ink. */
    val labelCenterY: Float,
    /** Center of the ring (and of the digit's ink). */
    val ringCenterY: Float,
    val ringDiameter: Float,
  )

  /**
   * Label above the ring, the pair centered in a `width` × `height` frame. The
   * label block is one font size tall (capitals and accents), whatever the
   * label: « PRÉPARE-TOI » → « PRÊT ? » never moves the ring.
   */
  fun countdown(width: Float, height: Float, isLandscape: Boolean, hasLabel: Boolean): Countdown {
    val d = ringDiameter(minOf(width, height), isLandscape)
    val labelH = if (hasLabel) labelSize(d) else 0f
    val labelBlock = if (hasLabel) labelH + gap(d) else 0f
    val top = (height - (labelBlock + d)) / 2f
    return Countdown(
      centerX = width / 2f,
      labelCenterY = top + labelH / 2f,
      ringCenterY = top + labelBlock + d / 2f,
      ringDiameter = d,
    )
  }

  /**
   * Baseline putting ink [inkTop, inkBottom] (relative to the baseline, y down,
   * so inkTop < 0 for glyphs above it) centered on `centerY`.
   */
  fun baselineFor(centerY: Float, inkTop: Float, inkBottom: Float): Float = centerY - (inkTop + inkBottom) / 2f

  /** Drawing x putting ink [inkLeft, inkRight] (relative to that x) centered on `centerX`. */
  fun originXFor(centerX: Float, inkLeft: Float, inkRight: Float): Float = centerX - (inkLeft + inkRight) / 2f
}
