package expo.modules.realtimerecorder

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileOutputStream
import kotlin.math.abs
import kotlin.math.hypot

/**
 * Debug harness (androidTest only, never in the app build), #547 PR 3: the native
 * [OverlayRenderer] draws the countdown burned into the video onto an off-screen
 * bitmap, at the overlay sizes actually used (half the video size; 1080 × 1920
 * is also the iOS frame). The images are saved for the report and measured here,
 * by their pixels. No camera, no recording.
 *
 * Images: /sdcard/Android/data/expo.modules.realtimerecorder.test/files/countdown/
 * Run: ./gradlew :realtime-recorder:connectedDebugAndroidTest
 */
@RunWith(AndroidJUnit4::class)
class CountdownRenderTest {
  private val context = InstrumentationRegistry.getInstrumentation().targetContext
  private val out = File(context.getExternalFilesDir(null), "countdown").apply { mkdirs() }
  private val accent = "#9AE6D2"

  /** Overlay bitmaps: 1080p, 720p and 4K, portrait and landscape (half the video size). */
  private val frames = listOf(540 to 960, 960 to 540, 360 to 640, 640 to 360, 1080 to 1920, 1920 to 1080)

  private fun render(renderer: OverlayRenderer, w: Int, h: Int, value: Int, max: Int): Bitmap {
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    bmp.eraseColor(Color.TRANSPARENT)
    val tense = value <= 3
    renderer.render(bmp, OverlayState(
      countdownValue = value, countdownMax = max,
      countdownLabel = if (tense) "PRÊT ?" else "PRÉPARE-TOI",
      countdownTense = tense, accentColor = accent,
    ))
    return bmp
  }

  private fun save(bmp: Bitmap, name: String) =
    FileOutputStream(File(out, name)).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }

  /** Ring: rows where the drawing is widest (wider than the label and the digit). Digit: its opaque ink. */
  private data class Mesure(val ringCy: Float, val ringCx: Float, val d: Int, val ink: Rect)
  private fun mesurer(bmp: Bitmap, ink: Int): Mesure {
    val w = bmp.width; val h = bmp.height
    val px = IntArray(w * h).also { bmp.getPixels(it, 0, w, 0, 0, w, h) }
    val extents = HashMap<Int, Pair<Int, Int>>()
    for (y in 0 until h) {
      var a = -1; var b = -1
      for (x in 0 until w) if (Color.alpha(px[y * w + x]) > 0) { if (a < 0) a = x; b = x }
      if (a >= 0) extents[y] = a to b
    }
    val wmax = extents.values.maxOf { it.second - it.first }
    val rows = extents.filter { it.value.second - it.value.first >= wmax - 1 }.keys.sorted()
    val cy = (rows.first() + rows.last()) / 2f
    val (a, b) = extents.getValue(rows[rows.size / 2])
    val d = b - a + 1
    val cx = (a + b) / 2f
    val r = Rect(Int.MAX_VALUE, Int.MAX_VALUE, -1, -1)
    for (y in (cy - d / 2f).toInt() until (cy + d / 2f).toInt()) for (x in (cx - d / 2f).toInt() until (cx + d / 2f).toInt()) {
      if (x !in 0 until w || y !in 0 until h) continue
      val p = px[y * w + x]
      val near = maxOf(abs(Color.red(p) - Color.red(ink)), abs(Color.green(p) - Color.green(ink)), abs(Color.blue(p) - Color.blue(ink))) < 40
      if (Color.alpha(p) >= 200 && near) { r.left = minOf(r.left, x); r.top = minOf(r.top, y); r.right = maxOf(r.right, x); r.bottom = maxOf(r.bottom, y) }
    }
    return Mesure(cy, cx, d, r)
  }

  @Test fun nativeFontMatchesOswaldMedium() {
    // OSWALD_MEDIUM: unitsPerEm 1000, ascender 1193, descender -289, capHeight 810.
    val p = Paint().apply { typeface = Typeface.createFromAsset(context.assets, "realtime-recorder/Oswald-Medium.ttf"); textSize = 1000f }
    val fm = p.fontMetrics
    // Capitals' height from the « H » outline (getTextBounds rounds the rasterized bounds outward).
    val path = android.graphics.Path().also { p.getTextPath("H", 0, 1, 0f, 0f, it) }
    val cap = android.graphics.RectF().also { path.computeBounds(it, true) }
    val rounded = Rect().also { p.getTextBounds("H", 0, 1, it) }
    File(out, "metriques.txt").writeText(
      "ascent ${fm.ascent} descent ${fm.descent} leading ${fm.leading} capHeight (contour) ${-cap.top} capHeight (getTextBounds) ${-rounded.top}\n")
    assertEquals(-1193f, fm.ascent, 1f)
    assertEquals(289f, fm.descent, 1f)
    assertEquals(0f, fm.leading, 0.5f)
    assertEquals(810f, -cap.top, 0.5f)
  }

  @Test fun renderAndMeasure10_3_1() {
    val renderer = OverlayRenderer(context)
    val report = StringBuilder()
    val echecs = mutableListOf<String>()
    for ((w, h) in frames) for (value in listOf(10, 3, 1)) {
      val bmp = render(renderer, w, h, value, max = 10)
      save(bmp, "countdown-${w}x$h-$value.png")
      val m = mesurer(bmp, if (value <= 3) Color.parseColor(accent) else Color.WHITE)
      val ecart = (m.ink.top + m.ink.bottom + 1) / 2f - m.ringCy
      report.append("${w}x$h $value : anneau Ø ${m.d} centre ${m.ringCy} ; encre ${m.ink.top}-${m.ink.bottom} ; écart $ecart\n")
      // Glyph middle on the ring center: the digits' ink (-12 to 820) sits 1/1000 em lower than capHeight / 2.
      if (abs(ecart) > 1f) echecs += "${w}x$h « $value » : écart $ecart px"
      bmp.recycle()
    }
    File(out, "mesures.txt").writeText(report.toString())
    assertTrue(echecs.joinToString(" ; "), echecs.isEmpty())
  }

  @Test fun countdownLeavesTheRestOfTheOverlayUnchanged() {
    // The paint is shared: drawing the countdown must not change how the « ATHLEX » wordmark (bottom) is drawn.
    val renderer = OverlayRenderer(context)
    for ((w, h) in frames) {
      val with = render(renderer, w, h, value = 3, max = 10)
      val without = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(Color.TRANSPARENT)
        renderer.render(it, OverlayState(accentColor = accent))
      }
      val top = (h * 0.8f).toInt()
      val a = IntArray(w * (h - top)).also { with.getPixels(it, 0, w, 0, top, w, h - top) }
      val b = IntArray(w * (h - top)).also { without.getPixels(it, 0, w, 0, top, w, h - top) }
      assertTrue("${w}x$h : bas de l'incrustation modifié par le décompte", a.contentEquals(b))
      with.recycle(); without.recycle()
    }
  }

  @Test fun widestValueStaysInsideTheRingWithItsMargin() {
    val renderer = OverlayRenderer(context)
    val p = Paint().apply { typeface = Typeface.createFromAsset(context.assets, "realtime-recorder/Oswald-Medium.ttf"); textSize = 1000f }
    val report = StringBuilder()
    val echecs = mutableListOf<String>()
    for ((w, h) in frames) for (max in listOf(10, 15, 30, 9)) {
      val widest = (1..max).maxBy { p.measureText("$it") }
      val bmp = render(renderer, w, h, widest, max)
      save(bmp, "encre-${w}x$h-max$max-$widest.png")
      val m = mesurer(bmp, if (widest <= 3) Color.parseColor(accent) else Color.WHITE)
      val short = minOf(w, h)
      val limit = m.d / 2f - 2f * short / 390f - 6f * short / 390f
      val corner = listOf(m.ink.left to m.ink.top, m.ink.right to m.ink.top, m.ink.left to m.ink.bottom, m.ink.right to m.ink.bottom)
        .maxOf { (x, y) -> hypot(x + 0.5f - m.ringCx, y + 0.5f - m.ringCy) }
      report.append("${w}x$h max $max « $widest » : coin $corner, limite $limit\n")
      if (corner > limit + 1f) echecs += "${w}x$h max $max « $widest » : coin d'encre $corner > $limit"
      bmp.recycle()
    }
    File(out, "encre.txt").writeText(report.toString())
    assertTrue(echecs.joinToString(" ; "), echecs.isEmpty())
  }
}
