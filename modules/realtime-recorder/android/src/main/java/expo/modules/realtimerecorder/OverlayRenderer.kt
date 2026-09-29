package expo.modules.realtimerecorder

import android.content.Context
import android.graphics.*
import android.graphics.drawable.BitmapDrawable
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import java.net.URL

/**
 * Draws overlay graphics directly onto a Bitmap (video frame) using Android Canvas.
 * Mirrors the iOS OverlayRenderer.swift layout exactly:
 *
 * - Competition logo: top left (rounded square)
 * - Title: top center (28pt bold)
 * - Box logo: top right (circle)
 * - Countdown: center screen, same look as the on-screen CountdownView (R5b/R6b)
 * - « GO ! »: accent band tilted by -4°, same look as the on-screen GoFlash
 * - Bottom row (all vertically centered):
 *   - Left: ATHLEX logo (160px)
 *   - Center: Timer DS-Digital (180pt)
 *   - Right: Timestamp
 */
class OverlayRenderer(private val context: Context) {

  @Volatile private var cachedAthlexLogo: Bitmap? = null
  @Volatile private var cachedBoxLogo: Bitmap? = null
  @Volatile private var cachedBoxLogoUrl: String = ""
  @Volatile private var boxLogoLoading = false
  @Volatile private var cachedCompLogo: Bitmap? = null
  @Volatile private var cachedCompLogoUrl: String = ""
  @Volatile private var compLogoLoading = false
  private var dsDigitalTypeface: Typeface? = null
  private var oswaldTypeface: Typeface? = null
  private var oswaldMediumTypeface: Typeface? = null

  // Pre-allocated objects to avoid GC pressure on every frame
  private val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG)
  private val bitmapPaint = Paint(Paint.FILTER_BITMAP_FLAG)
  private val reusableClipPath = Path()
  private val shapePaint = Paint(Paint.ANTI_ALIAS_FLAG)

  init {
    loadAthlexLogo()
    loadDSDigitalFont()
    loadOswaldFont()
  }

  // MARK: - Resource loading

  private fun loadAthlexLogo() {
    try {
      val inputStream = context.assets.open("realtime-recorder/logo.png")
      cachedAthlexLogo = BitmapFactory.decodeStream(inputStream)
      inputStream.close()
    } catch (e: Exception) {
      // Try raw resources
      try {
        val resId = context.resources.getIdentifier("logo", "drawable", context.packageName)
        if (resId != 0) {
          cachedAthlexLogo = BitmapFactory.decodeResource(context.resources, resId)
        }
      } catch (_: Exception) {}
    }
  }

  private fun loadDSDigitalFont() {
    try {
      dsDigitalTypeface = Typeface.createFromAsset(context.assets, "realtime-recorder/DS-Digital.ttf")
    } catch (e: Exception) {
      dsDigitalTypeface = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
    }
  }

  private fun loadOswaldFont() {
    try {
      oswaldTypeface = Typeface.createFromAsset(context.assets, "realtime-recorder/Oswald-Bold.ttf")
    } catch (e: Exception) {
      oswaldTypeface = Typeface.DEFAULT_BOLD
    }
    oswaldMediumTypeface = try {
      Typeface.createFromAsset(context.assets, "realtime-recorder/Oswald-Medium.ttf")
    } catch (e: Exception) {
      Typeface.DEFAULT_BOLD
    }
  }

  private fun loadBoxLogoIfNeeded(url: String) {
    if (url.isEmpty() || url == cachedBoxLogoUrl || boxLogoLoading) return
    boxLogoLoading = true
    cachedBoxLogoUrl = url

    Thread {
      try {
        val stream = URL(url).openStream()
        val bmp = BitmapFactory.decodeStream(stream)
        stream.close()
        cachedBoxLogo = bmp
      } catch (_: Exception) {
      } finally {
        boxLogoLoading = false
      }
    }.start()
  }

  private fun loadCompLogoIfNeeded(url: String) {
    if (url.isEmpty() || url == cachedCompLogoUrl || compLogoLoading) return
    compLogoLoading = true
    cachedCompLogoUrl = url

    Thread {
      try {
        val stream = URL(url).openStream()
        val bmp = BitmapFactory.decodeStream(stream)
        stream.close()
        cachedCompLogo = bmp
      } catch (_: Exception) {
      } finally {
        compLogoLoading = false
      }
    }.start()
  }

  // MARK: - Main render

  /**
   * Draw all overlays onto the given Bitmap. Called from recording thread.
   */
  fun render(bitmap: Bitmap, state: OverlayState) {
    val canvas = Canvas(bitmap)
    val width = bitmap.width.toFloat()
    val height = bitmap.height.toFloat()
    val isLandscape = width > height

    loadBoxLogoIfNeeded(state.boxLogoUrl)
    loadCompLogoIfNeeded(state.competitionLogoUrl)

    // Use min dimension as reference so elements stay the same physical size
    val refDim = minOf(width, height)
    val scale = refDim / 1080f
    val margin = 24f * scale
    val safeTop = if (isLandscape) 24f * scale else 60f * (height / 1920f)

    // ─── 0. Competition logo (top left — rounded square, no white bg) ───
    val logoSize = if (isLandscape) 120f * scale else 200f * scale
    cachedCompLogo?.let { compImg ->
      val logoRect = RectF(margin, safeTop, margin + logoSize, safeTop + logoSize)
      val cornerRadius = if (isLandscape) 20f * scale else 32f * scale

      canvas.save()
      reusableClipPath.reset()
      reusableClipPath.addRoundRect(logoRect, cornerRadius, cornerRadius, Path.Direction.CW)
      canvas.clipPath(reusableClipPath)
      canvas.drawBitmap(compImg, null, logoRect, bitmapPaint)
      canvas.restore()
    }

    // ─── 1. Title (top center, adjusted for logos) ───
    if (state.title.isNotEmpty()) {
      val titleLeft = if (cachedCompLogo != null) margin + logoSize + 12f * scale else margin
      val titleRight = if (cachedBoxLogo != null) width - logoSize - margin - 12f * scale else width - margin
      drawText(
        canvas, state.title,
        RectF(titleLeft, safeTop, titleRight, safeTop + 40f * scale),
        fontSize = 28f * scale, bold = true, color = Color.WHITE,
        alignment = Layout.Alignment.ALIGN_CENTER, shadow = true
      )
    }

    // ─── 2. Box logo (top right — circle, no background) ───
    cachedBoxLogo?.let { boxImg ->
      val logoRect = RectF(
        width - logoSize - margin, safeTop,
        width - margin, safeTop + logoSize
      )
      val cornerRadius = logoSize / 2f  // circle

      canvas.save()
      reusableClipPath.reset()
      reusableClipPath.addRoundRect(logoRect, cornerRadius, cornerRadius, Path.Direction.CW)
      canvas.clipPath(reusableClipPath)
      canvas.drawBitmap(boxImg, null, logoRect, bitmapPaint)
      canvas.restore()
    }

    // ─── 3. Countdown (center) — same look as the on-screen CountdownView ───
    if (state.countdownValue > 0) {
      drawCountdown(canvas, width, height, refDim, isLandscape, state)
    }

    // ════════════════════════════════════════════
    //  BOTTOM ROW — AthleX logo (left) | Timer (center) | Timestamp (right)
    //  All elements vertically centered on the same row
    // ════════════════════════════════════════════
    val safeBottom = if (isLandscape) 40f * scale else 92f * scale

    // Row height driven by the timer (largest element)
    val timerFontSize = if (isLandscape) 140f * scale else 180f * scale
    val timerH = if (isLandscape) 170f * scale else 220f * scale
    val rowCenterY = height - safeBottom - timerH / 2f

    // ─── 4. AthleX mark (-20%) + « AthleX » wordmark below (bottom-left) ───
    val atlLogoH = (if (isLandscape) 120f * scale else 160f * scale) * 0.8f
    cachedAthlexLogo?.let { atlImg ->
      val atlLogoW = atlLogoH * (atlImg.width.toFloat() / atlImg.height.toFloat())
      val wordSize = atlLogoH * 0.32f
      val wordH = wordSize * 1.25f
      val gap = 6f * scale
      val groupH = atlLogoH + gap + wordH
      val groupTop = rowCenterY - groupH / 2f
      val logoRect = RectF(margin, groupTop, margin + atlLogoW, groupTop + atlLogoH)
      canvas.drawBitmap(atlImg, null, logoRect, bitmapPaint)
      // Wordmark centered under the mark, Oswald bold uppercase w/ letter spacing (landing typo)
      val wordPad = 24f * scale
      drawText(
        canvas, "ATHLEX",
        RectF(margin - wordPad, groupTop + atlLogoH + gap,
              margin + atlLogoW + wordPad, groupTop + atlLogoH + gap + wordH),
        fontSize = wordSize, bold = true, color = Color.WHITE,
        alignment = Layout.Alignment.ALIGN_CENTER,
        shadow = true, oswald = true, letterSpacing = 0.12f
      )
    }

    // ─── 5. Timer display (center, x2 size) ───
    if (state.showTimer && state.countdownValue <= 0) {
      val timerY = rowCenterY - timerH / 2f
      drawText(
        canvas, state.timerDisplay,
        RectF(0f, timerY, width, timerY + timerH),
        fontSize = timerFontSize, bold = false, color = Color.WHITE,
        alignment = Layout.Alignment.ALIGN_CENTER,
        shadow = true, dsDigital = true
      )
    }

    // ─── 6. Timestamp (right, vertically centered on same row) ───
    if (state.timestamp.isNotEmpty() && state.showTimer && state.countdownValue <= 0) {
      val tsW = 260f * scale
      val tsH = 34f * scale
      val tsY = rowCenterY - tsH / 2f
      drawText(
        canvas, state.timestamp,
        RectF(width - tsW - margin, tsY, width - margin, tsY + tsH),
        fontSize = 24f * scale, bold = false,
        color = Color.argb(204, 255, 255, 255),
        alignment = Layout.Alignment.ALIGN_OPPOSITE, shadow = true
      )
    }

    // ─── 7. « GO ! » band (on top of the running timer) ───
    if (state.goLabel.isNotEmpty()) {
      drawGoBand(canvas, width, height, refDim, state)
    }
  }

  // MARK: - Countdown

  /**
   * Label above a circle of diameter `d`: « PRÉPARE-TOI » + white digit in a
   * 35 % ring above 3, « PRÊT ? » + accent digit on a 12 % accent halo at 3-2-1.
   */
  private fun drawCountdown(canvas: Canvas, width: Float, height: Float, refDim: Float, isLandscape: Boolean, state: OverlayState) {
    val accent = parseColor(state.accentColor, Color.WHITE)
    val tense = state.countdownTense
    val d = refDim * (if (isLandscape) 0.5f else 0.55f)
    val cx = width / 2f
    val cy = height / 2f

    val labelSize = d * 0.07f
    val labelH = labelSize * 1.4f
    val labelBottom = cy - d / 2f - d * 0.04f
    drawText(
      canvas, state.countdownLabel,
      RectF(0f, labelBottom - labelH, width, labelBottom),
      fontSize = labelSize, bold = false,
      color = if (tense) accent else Color.argb(204, 255, 255, 255),
      alignment = Layout.Alignment.ALIGN_CENTER, shadow = true, letterSpacing = 0.33f
    )

    shapePaint.reset()
    shapePaint.isAntiAlias = true
    if (tense) {
      shapePaint.style = Paint.Style.FILL
      shapePaint.color = withAlpha(accent, 0.12f)
      canvas.drawCircle(cx, cy, d / 2f, shapePaint)
    } else {
      val w = d * 0.01f
      shapePaint.style = Paint.Style.STROKE
      shapePaint.strokeWidth = w
      shapePaint.color = Color.argb(89, 255, 255, 255)
      canvas.drawCircle(cx, cy, d / 2f - w / 2f, shapePaint)
    }

    val digitSize = d * (if (tense) 0.7f else 0.55f)
    drawText(
      canvas, "${state.countdownValue}",
      RectF(cx - d * 0.75f, cy - d / 2f, cx + d * 0.75f, cy + d / 2f),
      fontSize = digitSize, bold = false, color = if (tense) accent else Color.WHITE,
      alignment = Layout.Alignment.ALIGN_CENTER,
      shadow = !tense, oswaldMedium = true,
      glowColor = if (tense) withAlpha(accent, 0.5f) else null, glowRadius = d * 0.11f
    )
  }

  /** Accent band tilted by -4° across the frame, « GO ! » centered in `goInk`. */
  private fun drawGoBand(canvas: Canvas, width: Float, height: Float, refDim: Float, state: OverlayState) {
    val accent = parseColor(state.accentColor, Color.WHITE)
    val goSize = refDim * 0.16f
    val bandH = goSize * 1.9f
    canvas.save()
    canvas.translate(width / 2f, height / 2f)
    canvas.rotate(-4f)
    shapePaint.reset()
    shapePaint.style = Paint.Style.FILL
    shapePaint.color = accent
    canvas.drawRect(-width * 0.6f, -bandH / 2f, width * 0.6f, bandH / 2f, shapePaint)
    drawText(
      canvas, state.goLabel,
      RectF(-width / 2f, -bandH / 2f, width / 2f, bandH / 2f),
      fontSize = goSize, bold = false, color = parseColor(state.goInk, Color.BLACK),
      alignment = Layout.Alignment.ALIGN_CENTER, oswaldMedium = true
    )
    canvas.restore()
  }

  private fun parseColor(hex: String, fallback: Int): Int =
    try { Color.parseColor(hex) } catch (_: Exception) { fallback }

  private fun withAlpha(color: Int, alpha: Float): Int =
    Color.argb((alpha * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))

  // MARK: - Text drawing helper

  private fun drawText(
    canvas: Canvas, text: String, rect: RectF,
    fontSize: Float, bold: Boolean, color: Int,
    alignment: Layout.Alignment,
    shadow: Boolean = false,
    monospace: Boolean = false,
    dsDigital: Boolean = false,
    oswald: Boolean = false,
    letterSpacing: Float = 0f,
    oswaldMedium: Boolean = false,
    glowColor: Int? = null,
    glowRadius: Float = 0f
  ) {
    textPaint.reset()
    textPaint.isAntiAlias = true
    textPaint.color = color
    textPaint.textSize = fontSize
    textPaint.letterSpacing = letterSpacing
    textPaint.typeface = when {
      oswaldMedium -> oswaldMediumTypeface ?: Typeface.DEFAULT_BOLD
      oswald -> oswaldTypeface ?: Typeface.DEFAULT_BOLD
      dsDigital -> dsDigitalTypeface ?: Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
      monospace -> Typeface.create(Typeface.MONOSPACE, if (bold) Typeface.BOLD else Typeface.NORMAL)
      bold -> Typeface.DEFAULT_BOLD
      else -> Typeface.DEFAULT
    }
    if (shadow) {
      textPaint.setShadowLayer(4f, 1f, 1f, Color.argb(179, 0, 0, 0))
    }
    if (glowColor != null) {
      textPaint.setShadowLayer(glowRadius, 0f, 0f, glowColor)
    }

    // Use StaticLayout for proper alignment
    val layoutWidth = (rect.right - rect.left).toInt().coerceAtLeast(1)

    @Suppress("DEPRECATION")
    val layout = StaticLayout(
      text, textPaint, layoutWidth,
      alignment, 1f, 0f, false
    )

    canvas.save()
    // Center vertically within rect
    val textHeight = layout.height.toFloat()
    val offsetY = rect.top + (rect.height() - textHeight) / 2f
    canvas.translate(rect.left, offsetY)
    layout.draw(canvas)
    canvas.restore()
  }
}
