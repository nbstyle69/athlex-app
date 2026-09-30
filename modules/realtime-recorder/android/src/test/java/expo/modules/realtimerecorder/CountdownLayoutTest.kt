package expo.modules.realtimerecorder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Countdown burned into the video: the « label + ring » group and every text
 * (label, digit, « GO ! ») centered in the frame, portrait and landscape.
 * The overlay bitmap is the same whatever the camera (front or back): it
 * covers the whole frame and is never mirrored.
 */
class CountdownLayoutTest {
  private val eps = 0.01f

  /** Overlay bitmaps actually drawn: half the video size (Android), and full size (iOS). */
  private val frames = listOf(
    540f to 960f, 960f to 540f,        // 1080p, portrait / landscape (half resolution)
    1080f to 1920f, 1920f to 1080f,    // 1080p full size
    360f to 640f, 1920f to 3840f / 2f, // 720p half, 4K half
  )

  @Test fun groupLabelAndRingIsCenteredVertically() {
    for ((w, h) in frames) {
      val landscape = w > h
      val c = CountdownLayout.countdown(w, h, landscape, hasLabel = true)
      val d = c.ringDiameter
      val labelH = CountdownLayout.labelSize(d)
      val groupTop = c.labelCenterY - labelH / 2f
      val groupBottom = c.ringCenterY + d / 2f
      assertEquals("group centered in $w×$h", h / 2f, (groupTop + groupBottom) / 2f, eps)
      assertEquals("label → ring gap in $w×$h", CountdownLayout.gap(d),
        (c.ringCenterY - d / 2f) - (c.labelCenterY + labelH / 2f), eps)
    }
  }

  @Test fun everythingIsCenteredHorizontally() {
    for ((w, h) in frames) {
      assertEquals(w / 2f, CountdownLayout.countdown(w, h, w > h, hasLabel = true).centerX, eps)
    }
  }

  @Test fun withoutLabelTheRingItselfIsCentered() {
    for ((w, h) in frames) {
      val c = CountdownLayout.countdown(w, h, w > h, hasLabel = false)
      assertEquals(h / 2f, c.ringCenterY, eps)
    }
  }

  @Test fun ringKeepsItsSizeAndFitsTheFrame() {
    for ((w, h) in frames) {
      val landscape = w > h
      val c = CountdownLayout.countdown(w, h, landscape, hasLabel = true)
      assertEquals(minOf(w, h) * (if (landscape) 0.5f else 0.55f), c.ringDiameter, eps)
      assertTrue(c.labelCenterY - CountdownLayout.labelSize(c.ringDiameter) / 2f > 0f)
      assertTrue(c.ringCenterY + c.ringDiameter / 2f < h)
    }
  }

  @Test fun inkIsCenteredOnTheTarget() {
    // A digit whose ink sits 0.73 em above the baseline (Oswald: tall ascent, no descent).
    val baseline = CountdownLayout.baselineFor(500f, inkTop = -146f, inkBottom = 0f)
    assertEquals(500f, ((baseline - 146f) + baseline) / 2f, eps)
    // Label with trailing letter spacing: ink from 3 to 283 of an advance of 300.
    val x = CountdownLayout.originXFor(270f, inkLeft = 3f, inkRight = 283f)
    assertEquals(270f, ((x + 3f) + (x + 283f)) / 2f, eps)
    // « GO ! » in the band's rotated frame, centered on (0, 0).
    assertEquals(0f, CountdownLayout.baselineFor(0f, -120f, 2f) + (-120f + 2f) / 2f, eps)
  }
}
