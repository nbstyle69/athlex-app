import UIKit
import CoreGraphics
import CoreMedia
import CoreText

/// Holds the current overlay state pushed from JS
struct OverlayState {
  var timerType: String = ""
  var timerDisplay: String = ""       // e.g. "02:35.42"
  var title: String = ""
  var timestamp: String = ""
  var isRecording: Bool = false
  var countdownValue: Int = 0         // >0 means countdown is visible
  var countdownLabel: String = ""     // « PRÉPARE-TOI » / « PRÊT ? », already translated
  var countdownTense: Bool = false    // 3-2-1: label, digit and ring in accent
  var countdownMax: Int = 0           // duration of the countdown (largest value): sizes the digit, #547 PR 3
  var goLabel: String = ""            // « GO ! » band, empty = hidden
  var accentColor: String = "#FFFFFF" // accent, contrast already ensured by JS
  var goInk: String = "#101214"       // text ink on the accent band
  var showTimer: Bool = false         // true when chrono is running/frozen
  var boxLogoUrl: String = ""         // URL of the box logo (empty = no box)
  var competitionLogoUrl: String = "" // URL of competition logo (top-left overlay)
}

/// Draws overlay graphics directly onto a CVPixelBuffer using Core Graphics
final class OverlayRenderer {

  // Cached images
  private var cachedAthlexLogo: UIImage?
  private var cachedBoxLogo: UIImage?
  private var cachedBoxLogoUrl: String = ""
  private var boxLogoLoading = false
  private var cachedCompLogo: UIImage?
  private var cachedCompLogoUrl: String = ""
  private var compLogoLoading = false
  private var dsDigitalFont: UIFont?
  private var oswaldFont: UIFont?
  private var oswaldMediumFont: UIFont?

  init() {
    loadAthlexLogo()
    loadDSDigitalFont()
    loadOswaldFont()
    oswaldMediumFont = loadBundledFont(file: "Oswald-Medium", postScriptName: "Oswald-Medium")
  }

  // MARK: - Logo loading

  private func loadAthlexLogo() {
    // Try the resource bundle first (CocoaPods resource_bundles)
    let bundleName = "RealtimeRecorderResources"
    if let bundleURL = Bundle.main.url(forResource: bundleName, withExtension: "bundle"),
       let resBundle = Bundle(url: bundleURL),
       let img = UIImage(named: "logo", in: resBundle, compatibleWith: nil) ?? UIImage(contentsOfFile: resBundle.path(forResource: "logo", ofType: "png") ?? "") {
      cachedAthlexLogo = img
    }
    // Fallback: main bundle
    else if let img = UIImage(named: "logo") ?? UIImage(named: "logo.png") {
      cachedAthlexLogo = img
    }
  }

  private func loadDSDigitalFont() {
    let bundleName = "RealtimeRecorderResources"
    guard let bundleURL = Bundle.main.url(forResource: bundleName, withExtension: "bundle"),
          let resBundle = Bundle(url: bundleURL),
          let fontURL = resBundle.url(forResource: "DS-Digital", withExtension: "ttf") else {
      print("[OverlayRenderer] DS-Digital.ttf not found in resource bundle")
      return
    }
    var errorRef: Unmanaged<CFError>?
    CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &errorRef)
    if let err = errorRef?.takeRetainedValue() {
      let desc = CFErrorGetDomain(err) as String
      if !desc.contains("already registered") {
        print("[OverlayRenderer] DS-Digital font registration error: \(err)")
      }
    }
    // PostScript name for DS-Digital is "DS-Digital"
    if let font = UIFont(name: "DS-Digital", size: 48) {
      dsDigitalFont = font
    } else {
      print("[OverlayRenderer] DS-Digital font not available after registration")
    }
  }

  private func loadOswaldFont() {
    let bundleName = "RealtimeRecorderResources"
    guard let bundleURL = Bundle.main.url(forResource: bundleName, withExtension: "bundle"),
          let resBundle = Bundle(url: bundleURL),
          let fontURL = resBundle.url(forResource: "Oswald-Bold", withExtension: "ttf") else {
      print("[OverlayRenderer] Oswald-Bold.ttf not found in resource bundle")
      return
    }
    var errorRef: Unmanaged<CFError>?
    CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &errorRef)
    if let err = errorRef?.takeRetainedValue() {
      let desc = CFErrorGetDomain(err) as String
      if !desc.contains("already registered") {
        print("[OverlayRenderer] Oswald font registration error: \(err)")
      }
    }
    if let font = UIFont(name: "Oswald-Bold", size: 40) {
      oswaldFont = font
    } else {
      print("[OverlayRenderer] Oswald-Bold font not available after registration")
    }
  }

  private func loadBundledFont(file: String, postScriptName: String) -> UIFont? {
    guard let bundleURL = Bundle.main.url(forResource: "RealtimeRecorderResources", withExtension: "bundle"),
          let resBundle = Bundle(url: bundleURL),
          let fontURL = resBundle.url(forResource: file, withExtension: "ttf") else {
      print("[OverlayRenderer] \(file).ttf not found in resource bundle")
      return nil
    }
    CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
    let font = UIFont(name: postScriptName, size: 40)
    if font == nil { print("[OverlayRenderer] \(postScriptName) not available after registration") }
    return font
  }

  private func loadBoxLogoIfNeeded(url: String) {
    guard !url.isEmpty, url != cachedBoxLogoUrl, !boxLogoLoading else { return }
    boxLogoLoading = true
    cachedBoxLogoUrl = url

    DispatchQueue.global(qos: .utility).async { [weak self] in
      guard let self = self, let imgURL = URL(string: url),
            let data = try? Data(contentsOf: imgURL),
            let img = UIImage(data: data) else {
        self?.boxLogoLoading = false
        return
      }
      self.cachedBoxLogo = img
      self.boxLogoLoading = false
    }
  }

  private func loadCompLogoIfNeeded(url: String) {
    guard !url.isEmpty, url != cachedCompLogoUrl, !compLogoLoading else { return }
    compLogoLoading = true
    cachedCompLogoUrl = url

    DispatchQueue.global(qos: .utility).async { [weak self] in
      guard let self = self, let imgURL = URL(string: url),
            let data = try? Data(contentsOf: imgURL),
            let img = UIImage(data: data) else {
        self?.compLogoLoading = false
        return
      }
      self.cachedCompLogo = img
      self.compLogoLoading = false
    }
  }

  // MARK: - Main render

  /// Draw all overlays onto the given pixel buffer. Thread-safe — called from capture queue.
  func render(onto pixelBuffer: CVPixelBuffer, state: OverlayState) {
    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    let size = CGSize(width: CGFloat(width), height: CGFloat(height))
    let isLandscape = size.width > size.height

    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

    guard let context = CGContext(
      data: CVPixelBufferGetBaseAddress(pixelBuffer),
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    ) else { return }

    // Core Graphics origin is bottom-left; UIKit is top-left.
    context.translateBy(x: 0, y: size.height)
    context.scaleBy(x: 1, y: -1)

    // Load logos in background if URL changed
    loadBoxLogoIfNeeded(url: state.boxLogoUrl)
    loadCompLogoIfNeeded(url: state.competitionLogoUrl)

    // Use min dimension as reference so elements stay the same physical size
    let refDim = min(size.width, size.height)
    let scale = refDim / 1080.0
    let margin: CGFloat = 24 * scale
    let safeTop: CGFloat = isLandscape ? 24 * scale : 60 * (size.height / 1920.0)

    // ─── 0. Competition logo (top left — rounded square, no white bg) ───
    let logoSize: CGFloat = isLandscape ? 120 * scale : 200 * scale
    if let compImg = cachedCompLogo {
      let logoRect = CGRect(x: margin, y: safeTop, width: logoSize, height: logoSize)
      let cornerRadius: CGFloat = isLandscape ? 20 * scale : 32 * scale
      UIGraphicsPushContext(context)
      context.saveGState()
      let path = UIBezierPath(roundedRect: logoRect, cornerRadius: cornerRadius)
      path.addClip()
      compImg.draw(in: logoRect)
      context.restoreGState()
      UIGraphicsPopContext()
    }

    // ─── 1. Title (top center) ───
    if !state.title.isEmpty {
      let titleX = cachedCompLogo != nil ? (margin + logoSize + 12 * scale) : margin
      let titleW = size.width - titleX - (cachedBoxLogo != nil ? (logoSize + margin + 12 * scale) : margin)
      drawText(context: context, text: state.title,
               rect: CGRect(x: titleX, y: safeTop, width: titleW, height: 40 * scale),
               fontSize: 28 * scale, bold: true, color: .white, alignment: .center, shadow: true)
    }

    // ─── 2. Box logo (top right — circle, no background) ───
    if let boxImg = cachedBoxLogo {
      let logoRect = CGRect(x: size.width - logoSize - margin, y: safeTop, width: logoSize, height: logoSize)
      let cornerRadius: CGFloat = logoSize / 2  // circle
      UIGraphicsPushContext(context)
      context.saveGState()
      let path = UIBezierPath(roundedRect: logoRect, cornerRadius: cornerRadius)
      path.addClip()
      boxImg.draw(in: logoRect)
      context.restoreGState()
      UIGraphicsPopContext()
    }

    // ─── 3. Countdown (center) — same look as the on-screen CountdownView (R5b/R6b) ───
    if state.countdownValue > 0 {
      drawCountdown(context: context, size: size, state: state)
    }

    // ════════════════════════════════════════════
    //  BOTTOM ROW — AthleX logo (left) | Timer (center) | Timestamp (right)
    //  All elements vertically centered on the same row
    // ════════════════════════════════════════════
    let safeBottom: CGFloat = isLandscape ? 40 * scale : 92 * scale

    // Row height driven by the timer (largest element)
    let timerFontSize: CGFloat = isLandscape ? 140 * scale : 180 * scale
    let timerH: CGFloat = isLandscape ? 170 * scale : 220 * scale
    let rowCenterY = size.height - safeBottom - timerH / 2

    // ─── 4. AthleX mark (-20%) + « AthleX » wordmark below (bottom-left) ───
    let atlLogoH: CGFloat = (isLandscape ? 120 * scale : 160 * scale) * 0.8
    if let atlImg = cachedAthlexLogo {
      let atlLogoW = atlLogoH * (atlImg.size.width / atlImg.size.height)
      let wordSize: CGFloat = atlLogoH * 0.32
      let wordH: CGFloat = wordSize * 1.25
      let gap: CGFloat = 6 * scale
      let groupH = atlLogoH + gap + wordH
      let groupTop = rowCenterY - groupH / 2
      let logoRect = CGRect(x: margin, y: groupTop, width: atlLogoW, height: atlLogoH)
      UIGraphicsPushContext(context)
      atlImg.draw(in: logoRect)
      UIGraphicsPopContext()
      // Wordmark centered under the mark, Oswald bold uppercase w/ letter spacing (landing typo)
      let wordPad: CGFloat = 24 * scale
      drawText(context: context, text: "ATHLEX",
               rect: CGRect(x: margin - wordPad, y: groupTop + atlLogoH + gap,
                            width: atlLogoW + wordPad * 2, height: wordH),
               fontSize: wordSize, bold: true, color: .white, alignment: .center,
               shadow: true, oswald: true, tracking: wordSize * 0.12)
    }

    // ─── 5. Timer display (center, x2 size) ───
    if state.showTimer && state.countdownValue <= 0 {
      let timerY = rowCenterY - timerH / 2
      drawText(context: context, text: state.timerDisplay,
               rect: CGRect(x: 0, y: timerY, width: size.width, height: timerH),
               fontSize: timerFontSize, bold: false, color: .white, alignment: .center,
               weight: .medium, shadow: true, dsDigital: true)
    }

    // ─── 6. Timestamp (right, vertically centered on same row) ───
    if !state.timestamp.isEmpty && state.showTimer && state.countdownValue <= 0 {
      let tsW: CGFloat = 260 * scale
      let tsH: CGFloat = 34 * scale
      let tsY = rowCenterY - tsH / 2
      drawText(context: context, text: state.timestamp,
               rect: CGRect(x: size.width - tsW - margin, y: tsY, width: tsW, height: tsH),
               fontSize: 24 * scale, bold: false, color: UIColor.white.withAlphaComponent(0.8),
               alignment: .right, shadow: true)
    }

    // ─── 7. « GO ! » band (on top of the running timer) — same look as the on-screen GoFlash ───
    if !state.goLabel.isEmpty {
      drawGoBand(context: context, size: size, refDim: refDim, state: state)
    }
  }

  // MARK: - Countdown

  /// #547 PR 3 — same look as the on-screen CountdownView (#549) at rest, fixed:
  /// label above a thin ring (white 35 % above 3, accent 35 % at 3-2-1), digit
  /// (white, then accent) inscribed in the inner ring and centered on it by its
  /// glyph: baseline − capHeight / 2 on the ring center (CountdownLayout).
  /// Drawn with CoreText at an explicit baseline: `boundingRect(… .usesDeviceMetrics)`
  /// returns the glyph box from the baseline, while `draw(with: … .usesLineFragmentOrigin)`
  /// places the top of the line, which put the digit about 0.385 em too low.
  private func drawCountdown(context: CGContext, size: CGSize, state: OverlayState) {
    let accent = UIColor(hex: state.accentColor) ?? .white
    let tense = state.countdownTense
    let m = digitMetrics(upTo: CountdownLayout.maxValue(state.countdownMax, state.countdownValue))
    let c = CountdownLayout.countdown(size: size, hasLabel: !state.countdownLabel.isEmpty, metrics: m)

    if !state.countdownLabel.isEmpty {
      let font = UIFont.systemFont(ofSize: c.labelSize, weight: .medium)
      let line = ctLine(state.countdownLabel, font: font,
                        color: tense ? accent : UIColor.white.withAlphaComponent(0.8), kern: c.labelTracking)
      // Ink centered horizontally, its bottom labelGap above the ring (glyph bounds: y up, from the baseline).
      let ink = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
      drawLine(line, context: context, x: c.centerX - ink.midX, baseline: c.labelInkBottomY + ink.minY, shadow: true)
    }

    let r = c.ringDiameter / 2 - c.ringBorder / 2
    context.saveGState()
    context.setStrokeColor((tense ? accent : UIColor.white).withAlphaComponent(0.35).cgColor)
    context.setLineWidth(c.ringBorder)
    context.strokeEllipse(in: CGRect(x: c.centerX - r, y: c.ringCenterY - r, width: 2 * r, height: 2 * r))
    context.restoreGState()

    let font = (oswaldMediumFont ?? UIFont.systemFont(ofSize: 40, weight: .medium)).withSize(c.digitSize)
    let line = ctLine("\(state.countdownValue)", font: font, color: tense ? accent : .white)
    let width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
    drawLine(line, context: context, x: c.centerX - width / 2, baseline: c.digitBaselineY, shadow: !tense)
  }

  private var metricsUpTo = -1
  private var metrics = CountdownLayout.DigitMetrics(widestAdvanceEm: 0, inkHeightEm: 0, capHeightEm: 0)

  /// Measures of the Oswald Medium actually drawn, read at 1000 pt (em = pt / 1000):
  /// advances from CoreText, digits' ink from their glyph outlines, capitals from UIFont.capHeight.
  private func digitMetrics(upTo maxValue: Int) -> CountdownLayout.DigitMetrics {
    if maxValue == metricsUpTo { return metrics }
    let font = (oswaldMediumFont ?? UIFont.systemFont(ofSize: 40, weight: .medium)).withSize(1000)
    var widest: CGFloat = 0
    for v in 1...max(1, maxValue) {
      widest = max(widest, CGFloat(CTLineGetTypographicBounds(ctLine("\(v)", font: font), nil, nil, nil)))
    }
    let ink = CTLineGetBoundsWithOptions(ctLine("0123456789", font: font), .useGlyphPathBounds)
    if metricsUpTo < 0 {
      // OSWALD_MEDIUM: ascender 1193, descender -289, capHeight 810 (unitsPerEm 1000).
      print("[OverlayRenderer] \(font.fontName) @1000: ascender \(font.ascender) descender \(font.descender) capHeight \(font.capHeight) leading \(font.leading)")
    }
    metrics = CountdownLayout.DigitMetrics(widestAdvanceEm: widest / 1000, inkHeightEm: ink.height / 1000,
                                           capHeightEm: font.capHeight / 1000)
    metricsUpTo = maxValue
    return metrics
  }

  /// One CoreText line: the font, its color (CGColor, read by CoreText) and an optional letter spacing.
  private func ctLine(_ text: String, font: UIFont, color: UIColor = .white, kern: CGFloat = 0) -> CTLine {
    var attrs: [NSAttributedString.Key: Any] = [
      .font: font,
      NSAttributedString.Key(kCTForegroundColorAttributeName as String): color.cgColor,
    ]
    if kern != 0 { attrs[.kern] = kern }
    return CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attrs) as CFAttributedString)
  }

  /// Draws `line` with its baseline at `baseline` (top-left, y-down context), its origin at `x`.
  private func drawLine(_ line: CTLine, context: CGContext, x: CGFloat, baseline: CGFloat, shadow: Bool) {
    context.saveGState()
    if shadow {
      // Shadow offsets are in device space (y up): (1, -1) is down-right, like NSShadow (1, 1).
      context.setShadow(offset: CGSize(width: 1, height: -1), blur: 4, color: UIColor.black.withAlphaComponent(0.7).cgColor)
    }
    context.textMatrix = .identity
    context.translateBy(x: x, y: baseline)
    context.scaleBy(x: 1, y: -1)
    context.textPosition = .zero
    CTLineDraw(line, context)
    context.restoreGState()
  }

  /// Accent band tilted by -4° through the center of the frame, « GO ! » ink-centered in `goInk`.
  private func drawGoBand(context: CGContext, size: CGSize, refDim: CGFloat, state: OverlayState) {
    let accent = UIColor(hex: state.accentColor) ?? .white
    let ink = UIColor(hex: state.goInk) ?? .black
    let goSize = CountdownLayout.goSize(refDim)
    let textH = lineHeight(goSize, oswaldMedium: true)
    let bandH = textH + goSize * 0.75
    context.saveGState()
    context.translateBy(x: size.width / 2, y: size.height / 2)
    context.rotate(by: -4 * .pi / 180)
    context.setFillColor(accent.cgColor)
    context.fill(CGRect(x: -size.width * 0.6, y: -bandH / 2, width: size.width * 1.2, height: bandH))
    drawInkCentered(context: context, text: state.goLabel, center: .zero,
                    fontSize: goSize, color: ink, oswaldMedium: true)
    context.restoreGState()
  }

  // MARK: - Ink-centered text (countdown, « GO ! »)

  /// Draws `text` so that its ink (the glyphs actually drawn, from
  /// `usesDeviceMetrics`) is centered on `center`: neither the line box
  /// (ascent/descent) nor the trailing letter spacing shift it.
  private func drawInkCentered(
    context: CGContext, text: String, center: CGPoint, fontSize: CGFloat, color: UIColor,
    weight: UIFont.Weight? = nil, shadow: Bool = false, tracking: CGFloat = 0,
    oswaldMedium: Bool = false, glow: UIColor? = nil, glowRadius: CGFloat = 0
  ) {
    let attr = attributedText(text, fontSize: fontSize, bold: false, color: color, alignment: .left,
                              weight: weight, shadow: shadow, tracking: tracking,
                              oswaldMedium: oswaldMedium, glow: glow, glowRadius: glowRadius)
    let area = CGSize(width: 100_000, height: 100_000)
    let ink = attr.boundingRect(with: area, options: [.usesLineFragmentOrigin, .usesDeviceMetrics], context: nil)
    let origin = CGPoint(x: center.x - ink.midX, y: center.y - ink.midY)
    UIGraphicsPushContext(context)
    attr.draw(with: CGRect(origin: origin, size: area), options: [.usesLineFragmentOrigin], context: nil)
    UIGraphicsPopContext()
  }

  private func lineHeight(_ fontSize: CGFloat, oswaldMedium: Bool = false) -> CGFloat {
    let font = oswaldMedium ? oswaldMediumFont?.withSize(fontSize) : nil
    return (font ?? UIFont.systemFont(ofSize: fontSize, weight: .medium)).lineHeight
  }

  // MARK: - Text drawing helper

  private func drawText(
    context: CGContext,
    text: String,
    rect: CGRect,
    fontSize: CGFloat,
    bold: Bool,
    color: UIColor,
    alignment: NSTextAlignment,
    weight: UIFont.Weight? = nil,
    shadow: Bool = false,
    monospace: Bool = false,
    dsDigital: Bool = false,
    oswald: Bool = false,
    tracking: CGFloat = 0,
    oswaldMedium: Bool = false,
    glow: UIColor? = nil,
    glowRadius: CGFloat = 0
  ) {
    let attrString = attributedText(text, fontSize: fontSize, bold: bold, color: color, alignment: alignment,
                                    weight: weight, shadow: shadow, monospace: monospace, dsDigital: dsDigital,
                                    oswald: oswald, tracking: tracking, oswaldMedium: oswaldMedium,
                                    glow: glow, glowRadius: glowRadius)
    UIGraphicsPushContext(context)
    attrString.draw(in: rect)
    UIGraphicsPopContext()
  }

  private func attributedText(
    _ text: String,
    fontSize: CGFloat,
    bold: Bool,
    color: UIColor,
    alignment: NSTextAlignment,
    weight: UIFont.Weight? = nil,
    shadow: Bool = false,
    monospace: Bool = false,
    dsDigital: Bool = false,
    oswald: Bool = false,
    tracking: CGFloat = 0,
    oswaldMedium: Bool = false,
    glow: UIColor? = nil,
    glowRadius: CGFloat = 0
  ) -> NSAttributedString {
    let font: UIFont
    if oswaldMedium, let omFont = oswaldMediumFont?.withSize(fontSize) {
      font = omFont
    } else if oswald, let osFont = oswaldFont?.withSize(fontSize) {
      font = osFont
    } else if dsDigital, let dsFont = dsDigitalFont?.withSize(fontSize) {
      font = dsFont
    } else if monospace {
      font = UIFont.monospacedDigitSystemFont(ofSize: fontSize, weight: weight ?? (bold ? .bold : .regular))
    } else if let w = weight {
      font = UIFont.systemFont(ofSize: fontSize, weight: w)
    } else {
      font = bold ? UIFont.boldSystemFont(ofSize: fontSize) : UIFont.systemFont(ofSize: fontSize)
    }

    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.alignment = alignment
    paragraphStyle.lineBreakMode = .byTruncatingTail

    var attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: color,
      .paragraphStyle: paragraphStyle,
    ]

    if tracking != 0 {
      attributes[.kern] = tracking
    }

    if shadow {
      let s = NSShadow()
      s.shadowColor = UIColor.black.withAlphaComponent(0.7)
      s.shadowOffset = CGSize(width: 1, height: 1)
      s.shadowBlurRadius = 4
      attributes[.shadow] = s
    }

    if let glow = glow {
      let s = NSShadow()
      s.shadowColor = glow
      s.shadowOffset = .zero
      s.shadowBlurRadius = glowRadius
      attributes[.shadow] = s
    }

    return NSAttributedString(string: text, attributes: attributes)
  }
}

/// Geometry of the countdown burned into the video, centered in the frame
/// (portrait or landscape, front or back camera: the overlay is drawn on the
/// already-oriented buffer and never mirrored). #547 PR 3: same look as the
/// on-screen CountdownView (#549) at rest, fixed. The frame stands for a screen
/// whose short side is `refShortDp`: dp values scale by `shortSide / refShortDp`.
/// Same rules and numbers as `CountdownLayout.kt` (JVM-tested); the values copied
/// from TimerRunScreen.tsx are checked by the jest test decompteVideoParite.test.ts.
enum CountdownLayout {
  /// TimerRunScreen.tsx: CD_RING_RATIO, CD_RING_BORDER, CD_INK_MARGIN.
  static let ringRatio: CGFloat = 0.36
  static let ringBorderDp: CGFloat = 2
  static let inkMarginDp: CGFloat = 6
  /// CountdownView label: axTypography.overline (12, letter spacing 4), gap axSpacing.sm (8).
  static let labelSizeDp: CGFloat = 12
  static let labelTrackingDp: CGFloat = 4
  static let labelGapDp: CGFloat = 8
  /// Short side, in dp, of the screen the video frame stands for.
  static let refShortDp: CGFloat = 390

  static func goSize(_ refDim: CGFloat) -> CGFloat { refDim * 0.16 }

  /// Font measures the digit is sized and placed with, in em (read in the font actually drawn).
  struct DigitMetrics {
    /// Advance of the widest value of the countdown (1 to max).
    let widestAdvanceEm: CGFloat
    /// Height of the digits' ink (lowest to highest point of their outlines).
    let inkHeightEm: CGFloat
    /// Height of the capitals (the glyph's middle is baseline − capHeight / 2).
    let capHeightEm: CGFloat
  }

  struct Countdown {
    let centerX: CGFloat
    let ringCenterY: CGFloat
    let ringDiameter: CGFloat
    let ringBorder: CGFloat
    /// Radius the digit's ink rectangle must stay within (inner ring minus the margin).
    let inkRadius: CGFloat
    let digitSize: CGFloat
    /// Baseline putting the glyph's middle (baseline − capHeight / 2) on the ring center.
    let digitBaselineY: CGFloat
    let labelSize: CGFloat
    let labelTracking: CGFloat
    /// Bottom of the label's ink: labelGap above the ring.
    let labelInkBottomY: CGFloat
  }

  /// Label above the ring, the pair centered in `size` (top-left origin, y down). The label
  /// block is one label size tall whatever the label: « PRÉPARE-TOI » → « PRÊT ? » never moves the ring.
  static func countdown(size: CGSize, hasLabel: Bool, metrics m: DigitMetrics) -> Countdown {
    let short = min(size.width, size.height)
    let dp = short / refShortDp
    let d = short * ringRatio
    let border = ringBorderDp * dp
    let inkRadius = (d - 2 * border) / 2 - inkMarginDp * dp
    let diagonalEm = (m.widestAdvanceEm * m.widestAdvanceEm + m.inkHeightEm * m.inkHeightEm).squareRoot()
    let digitSize = ((2 * inkRadius) / diagonalEm).rounded(.down)
    let labelSize = labelSizeDp * dp
    let gap = labelGapDp * dp
    let labelBlock = hasLabel ? labelSize + gap : 0
    let top = (size.height - (labelBlock + d)) / 2
    let ringTop = top + labelBlock
    let cy = ringTop + d / 2
    return Countdown(
      centerX: size.width / 2, ringCenterY: cy, ringDiameter: d, ringBorder: border, inkRadius: inkRadius,
      digitSize: digitSize, digitBaselineY: cy + m.capHeightEm * digitSize / 2,
      labelSize: labelSize, labelTracking: labelTrackingDp * dp, labelInkBottomY: ringTop - gap)
  }

  /// Largest value the countdown shows: the duration sent by JS, or the value itself.
  static func maxValue(_ countdownMax: Int, _ value: Int) -> Int { max(countdownMax, value, 1) }
}

private extension UIColor {
  /// "#RRGGBB" (as sent by JS); nil when malformed.
  convenience init?(hex: String) {
    var h = hex.trimmingCharacters(in: .whitespaces)
    if h.hasPrefix("#") { h.removeFirst() }
    guard h.count == 6, let v = UInt32(h, radix: 16) else { return nil }
    self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255,
              blue: CGFloat(v & 0xFF) / 255, alpha: 1)
  }
}
