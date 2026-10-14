package expo.modules.realtimerecorder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.hypot

/**
 * Countdown burned into the video (#547 PR 3): fixed, same look as the on-screen
 * CountdownView (#549) at rest. Ring of 36 % of the short side, digit inscribed
 * in the inner ring with its margin and centered on it by its glyph, label above
 * with its gap, the « label + ring » group centered in the frame. The overlay
 * bitmap is the same whatever the camera (front or back): it covers the whole
 * frame and is never mirrored.
 */
class CountdownLayoutTest {
  private val eps = 0.01f

  /** Overlay bitmaps actually drawn: half the video size (Android), and full size (iOS). */
  private val frames = listOf(
    540f to 960f, 960f to 540f,        // 1080p, portrait / landscape (half resolution)
    1080f to 1920f, 1920f to 1080f,    // 1080p full size (iOS), 4K half (Android)
    360f to 640f, 640f to 360f,        // 720p half
  )

  /** Oswald Medium (OSWALD_MEDIUM): chasses of 0-9, digits' ink -12 to 820, capHeight 810, unitsPerEm 1000. */
  private val advance = mapOf('0' to 534, '1' to 382, '2' to 497, '3' to 496, '4' to 504, '5' to 493, '6' to 521, '7' to 413, '8' to 510, '9' to 521)
  private fun advanceEm(v: Int) = "$v".sumOf { advance.getValue(it) } / 1000f
  private fun metrics(max: Int) = CountdownLayout.DigitMetrics((1..max).maxOf { advanceEm(it) }, 0.832f, 0.810f)

  @Test fun ringIs36PercentOfTheShortSideWithAScaledBorder() {
    for ((w, h) in frames) {
      val c = CountdownLayout.countdown(w, h, hasLabel = true, m = metrics(10))
      val short = minOf(w, h)
      assertEquals(short * 0.36f, c.ringDiameter, eps)
      assertEquals(2f * short / 390f, c.ringBorder, eps)
      assertEquals(w / 2f, c.centerX, eps)
    }
  }

  @Test fun glyphMiddleIsOnTheRingCenter() {
    for ((w, h) in frames) for (max in listOf(10, 15, 30, 9)) {
      val c = CountdownLayout.countdown(w, h, hasLabel = true, m = metrics(max))
      assertEquals("$w×$h, $max", c.ringCenterY, c.digitBaselineY - 0.810f * c.digitSize / 2f, eps)
    }
  }

  @Test fun everyValueInkStaysInsideTheRingWithItsMarginTheWidestTouchesIt() {
    for ((w, h) in frames) for (max in listOf(10, 15, 30, 9)) {
      val c = CountdownLayout.countdown(w, h, hasLabel = true, m = metrics(max))
      val dp = minOf(w, h) / 390f
      assertEquals((c.ringDiameter - 2f * c.ringBorder) / 2f - 6f * dp, c.inkRadius, eps)
      val corners = (1..max).map { hypot(advanceEm(it) * c.digitSize, 0.832f * c.digitSize) / 2f }
      assertTrue("$w×$h, $max: ${corners.max()} ≤ ${c.inkRadius}", corners.max() <= c.inkRadius + eps)
      assertTrue("$w×$h, $max: widest at the margin", corners.max() > c.inkRadius - 1f)
    }
  }

  @Test fun labelAboveTheRingWithItsGapAndTheGroupCentered() {
    for ((w, h) in frames) {
      val c = CountdownLayout.countdown(w, h, hasLabel = true, m = metrics(10))
      val dp = minOf(w, h) / 390f
      val ringTop = c.ringCenterY - c.ringDiameter / 2f
      assertEquals(8f * dp, ringTop - c.labelInkBottomY, eps)
      assertEquals(12f * dp, c.labelSize, eps)
      assertEquals(4f * dp, c.labelTracking, eps)
      val groupTop = c.labelInkBottomY - c.labelSize
      assertEquals("group centered in $w×$h", h / 2f, (groupTop + ringTop + c.ringDiameter) / 2f, eps)
      assertTrue(groupTop > 0f && ringTop + c.ringDiameter < h)
    }
  }

  @Test fun withoutLabelTheRingItselfIsCentered() {
    for ((w, h) in frames) assertEquals(h / 2f, CountdownLayout.countdown(w, h, hasLabel = false, m = metrics(10)).ringCenterY, eps)
  }

  @Test fun largestValueFromJsOrTheValueShown() {
    assertEquals(10, CountdownLayout.maxValue(10, 3))
    assertEquals(15, CountdownLayout.maxValue(0, 15))
    assertEquals(1, CountdownLayout.maxValue(0, 0))
  }

  @Test fun goInkIsCenteredOnTheTarget() {
    // « GO ! » in the band's rotated frame, centered on (0, 0).
    assertEquals(0f, CountdownLayout.baselineFor(0f, -120f, 2f) + (-120f + 2f) / 2f, eps)
    val x = CountdownLayout.originXFor(270f, inkLeft = 3f, inkRight = 283f)
    assertEquals(270f, ((x + 3f) + (x + 283f)) / 2f, eps)
  }
}
