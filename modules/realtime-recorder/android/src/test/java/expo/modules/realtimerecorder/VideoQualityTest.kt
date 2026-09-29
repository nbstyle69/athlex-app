package expo.modules.realtimerecorder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VideoQualityTest {
  private val phone4k = listOf(4000 to 3000, 3840 to 2160, 2560 to 1440, 1920 to 1080, 1280 to 720, 640 to 480)
  private val phone1080 = listOf(1920 to 1080, 1440 to 1080, 1280 to 720)
  private val all: (Int, Int) -> Boolean = { _, _ -> true }

  @Test fun sizesAndBitrates() {
    assertEquals(1280 to 720, VideoQuality.size("720p"))
    assertEquals(1920 to 1080, VideoQuality.size("1080p"))
    assertEquals(2560 to 1440, VideoQuality.size("2k"))
    assertEquals(3840 to 2160, VideoQuality.size("4k"))
    assertEquals(1920 to 1080, VideoQuality.size("autre"))
    assertEquals(6_000_000, VideoQuality.bitrate("1080p"))
    assertEquals(listOf(4_000_000, 6_000_000, 10_000_000, 20_000_000), VideoQuality.ORDER.map(VideoQuality::bitrate))
    assertEquals("1080p", VideoQuality.DEFAULT)
  }

  @Test fun supportedFollowsCameraAndEncoder() {
    assertEquals(listOf("720p", "1080p", "2k", "4k"), VideoQuality.supported(phone4k, all))
    assertEquals(listOf("720p", "1080p"), VideoQuality.supported(phone1080, all))
    // 2K needs a camera size at least 2560 x 1440 (portrait sizes count too).
    assertEquals(listOf("720p", "1080p", "2k"), VideoQuality.supported(listOf(1440 to 2560), all))
    // Encoder must accept both orientations.
    val landscapeOnly: (Int, Int) -> Boolean = { w, h -> w >= h }
    assertEquals(listOf("720p", "1080p"), VideoQuality.supported(phone4k, landscapeOnly))
    val no4k: (Int, Int) -> Boolean = { w, h -> maxOf(w, h) < 3840 }
    assertEquals(listOf("720p", "1080p", "2k"), VideoQuality.supported(phone4k, no4k))
  }

  @Test fun clampStepsDown() {
    assertEquals("4k", VideoQuality.clamp("4k", listOf("720p", "1080p", "2k", "4k")))
    assertEquals("2k", VideoQuality.clamp("4k", listOf("720p", "1080p", "2k")))
    assertEquals("1080p", VideoQuality.clamp("4k", listOf("720p", "1080p")))
    assertEquals("720p", VideoQuality.clamp("720p", listOf("720p", "1080p")))
    assertEquals("1080p", VideoQuality.clamp("inconnu", listOf("720p", "1080p")))
    assertEquals("1080p", VideoQuality.clamp("720p", emptyList()))
    assertEquals("1080p", VideoQuality.lower("2k"))
    assertNull(VideoQuality.lower("720p"))
    assertTrue(VideoQuality.isAbove1080("2k") && VideoQuality.isAbove1080("4k"))
    assertFalse(VideoQuality.isAbove1080("1080p") || VideoQuality.isAbove1080("720p"))
  }

  @Test fun bufferSizeFor1080pIsTheFormerChoice() {
    assertEquals(1080 to 1920, VideoQuality.bufferSize(listOf(1920 to 1080, 1080 to 1920), "1080p", false))
    assertEquals(1920 to 1080, VideoQuality.bufferSize(phone4k, "1080p", false))
    assertEquals(1920 to 1080, VideoQuality.bufferSize(phone4k, "1080p", true))
    // No 1080p: largest size whose long side is at most 1920.
    assertEquals(1440 to 1080, VideoQuality.bufferSize(listOf(4000 to 3000, 1440 to 1080, 1280 to 720), "1080p", true))
    assertEquals(1080 to 1920, VideoQuality.bufferSize(emptyList(), "1080p", false))
  }

  @Test fun bufferSizeForOtherQualities() {
    assertEquals(3840 to 2160, VideoQuality.bufferSize(phone4k, "4k", true))
    assertEquals(1280 to 720, VideoQuality.bufferSize(phone4k, "720p", true))
    assertEquals(2560 to 1440, VideoQuality.bufferSize(phone4k, "2k", true))
    // 2K without a 2560 x 1440 size: 4K buffer, scaled by the GL pass.
    assertEquals(3840 to 2160, VideoQuality.bufferSize(listOf(3840 to 2160, 1920 to 1080), "2k", false))
  }

  @Test fun dryRunVerdict() {
    assertTrue(VideoQuality.keepsUp(41, 45))   // 91 %
    assertTrue(VideoQuality.keepsUp(27, 30))   // exactly 90 %
    assertFalse(VideoQuality.keepsUp(26, 30))  // 87 %
    assertFalse(VideoQuality.keepsUp(0, 0))    // nothing written
  }
}
