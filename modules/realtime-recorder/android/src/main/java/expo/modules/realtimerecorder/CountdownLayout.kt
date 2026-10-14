package expo.modules.realtimerecorder

import kotlin.math.floor
import kotlin.math.hypot

/**
 * Geometry of the countdown burned into the video, centered in the frame
 * (portrait or landscape, front or back camera: the overlay covers the whole
 * frame and is never mirrored). Free of Android types: JVM unit tests.
 *
 * #547 PR 3: same look as the on-screen CountdownView (#549) at rest, fixed (no
 * animation): thin ring of RING_RATIO × the short side, digit inscribed in the
 * inner ring with INK_MARGIN, label above the ring with LABEL_GAP. The frame
 * stands for a screen whose short side is REF_SHORT_DP: dp values scale by
 * `shortSide / REF_SHORT_DP`. Same rules and numbers as the iOS OverlayRenderer;
 * the values copied from TimerRunScreen.tsx are checked by the jest test
 * decompteVideoParite.test.ts.
 */
object CountdownLayout {
  /** TimerRunScreen.tsx: CD_RING_RATIO, CD_RING_BORDER, CD_INK_MARGIN. */
  const val RING_RATIO = 0.36f
  const val RING_BORDER_DP = 2f
  const val INK_MARGIN_DP = 6f
  /** CountdownView label: axTypography.overline (12, letter spacing 4), gap axSpacing.sm (8). */
  const val LABEL_SIZE_DP = 12f
  const val LABEL_TRACKING_DP = 4f
  const val LABEL_GAP_DP = 8f
  /** Short side, in dp, of the screen the video frame stands for. */
  const val REF_SHORT_DP = 390f

  /** « GO ! » text size and band height (text centered in the band, band centered in the frame). */
  fun goSize(refDim: Float): Float = refDim * 0.16f
  fun goBandHeight(goSize: Float): Float = goSize * 1.9f

  /** Font measures the digit is sized and placed with, in em (read in the font actually drawn). */
  data class DigitMetrics(
    /** Advance of the widest value of the countdown (1 to max). */
    val widestAdvanceEm: Float,
    /** Height of the digits' ink (lowest yMin to highest yMax). */
    val inkHeightEm: Float,
    /** Height of the capitals (the glyph's middle is baseline − capHeight / 2). */
    val capHeightEm: Float,
  )

  data class Countdown(
    val centerX: Float,
    val ringCenterY: Float,
    val ringDiameter: Float,
    val ringBorder: Float,
    /** Radius the digit's ink rectangle must stay within (inner ring minus the margin). */
    val inkRadius: Float,
    val digitSize: Float,
    /** Baseline putting the glyph's middle (baseline − capHeight / 2) on the ring center. */
    val digitBaselineY: Float,
    val labelSize: Float,
    val labelTracking: Float,
    /** Bottom of the label's ink: LABEL_GAP above the ring. */
    val labelInkBottomY: Float,
  )

  /**
   * Label above the ring, the pair centered in a `width` × `height` frame. The
   * label block is one label size tall whatever the label: « PRÉPARE-TOI » →
   * « PRÊT ? » never moves the ring.
   */
  fun countdown(width: Float, height: Float, hasLabel: Boolean, m: DigitMetrics): Countdown {
    val short = minOf(width, height)
    val dp = short / REF_SHORT_DP
    val d = short * RING_RATIO
    val border = RING_BORDER_DP * dp
    val inkRadius = (d - 2f * border) / 2f - INK_MARGIN_DP * dp
    val digitSize = floor((2f * inkRadius) / hypot(m.widestAdvanceEm, m.inkHeightEm))
    val labelSize = LABEL_SIZE_DP * dp
    val gap = LABEL_GAP_DP * dp
    val labelBlock = if (hasLabel) labelSize + gap else 0f
    val top = (height - (labelBlock + d)) / 2f
    val ringTop = top + labelBlock
    val cy = ringTop + d / 2f
    return Countdown(
      centerX = width / 2f,
      ringCenterY = cy,
      ringDiameter = d,
      ringBorder = border,
      inkRadius = inkRadius,
      digitSize = digitSize,
      digitBaselineY = cy + m.capHeightEm * digitSize / 2f,
      labelSize = labelSize,
      labelTracking = LABEL_TRACKING_DP * dp,
      labelInkBottomY = ringTop - gap,
    )
  }

  /** Largest value the countdown shows: the duration sent by JS, or the value itself. */
  fun maxValue(countdownMax: Int, value: Int): Int = maxOf(countdownMax, value, 1)

  /**
   * Baseline putting ink [inkTop, inkBottom] (relative to the baseline, y down,
   * so inkTop < 0 for glyphs above it) centered on `centerY` (« GO ! »).
   */
  fun baselineFor(centerY: Float, inkTop: Float, inkBottom: Float): Float = centerY - (inkTop + inkBottom) / 2f

  /** Drawing x putting ink [inkLeft, inkRight] (relative to that x) centered on `centerX`. */
  fun originXFor(centerX: Float, inkLeft: Float, inkRight: Float): Float = centerX - (inkLeft + inkRight) / 2f
}
