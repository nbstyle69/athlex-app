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
  var countdownTense: Bool = false    // 3-2-1: label, digit and halo in accent
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
      drawCountdown(context: context, size: size, refDim: refDim, isLandscape: isLandscape, state: state)
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

  /// Label above a circle of diameter `d`: « PRÉPARE-TOI » + white digit in a
  /// 35 % ring above 3, « PRÊT ? » + accent digit on a 12 % accent halo at 3-2-1.
  private func drawCountdown(context: CGContext, size: CGSize, refDim: CGFloat, isLandscape: Bool, state: OverlayState) {
    let accent = UIColor(hex: state.accentColor) ?? .white
    let tense = state.countdownTense
    let d = refDim * (isLandscape ? 0.5 : 0.55)
    let circle = CGRect(x: (size.width - d) / 2, y: (size.height - d) / 2, width: d, height: d)

    let labelSize = d * 0.07
    let labelH = lineHeight(labelSize)
    drawText(context: context, text: state.countdownLabel,
             rect: CGRect(x: 0, y: circle.minY - d * 0.04 - labelH, width: size.width, height: labelH),
             fontSize: labelSize, bold: false, color: tense ? accent : UIColor.white.withAlphaComponent(0.8),
             alignment: .center, weight: .medium, shadow: true, tracking: labelSize * 0.33)

    context.saveGState()
    if tense {
      context.setFillColor(accent.withAlphaComponent(0.12).cgColor)
      context.fillEllipse(in: circle)
    } else {
      let w = d * 0.01
      context.setStrokeColor(UIColor.white.withAlphaComponent(0.35).cgColor)
      context.setLineWidth(w)
      context.strokeEllipse(in: circle.insetBy(dx: w / 2, dy: w / 2))
    }
    context.restoreGState()

    let digitSize = d * (tense ? 0.7 : 0.55)
    let digitH = lineHeight(digitSize, oswaldMedium: true)
    drawText(context: context, text: "\(state.countdownValue)",
             rect: CGRect(x: circle.minX - d * 0.25, y: circle.midY - digitH / 2, width: d * 1.5, height: digitH),
             fontSize: digitSize, bold: false, color: tense ? accent : .white, alignment: .center,
             shadow: !tense, oswaldMedium: true,
             glow: tense ? accent.withAlphaComponent(0.5) : nil, glowRadius: d * 0.11)
  }

  /// Accent band tilted by -4° across the frame, « GO ! » centered in `goInk`.
  private func drawGoBand(context: CGContext, size: CGSize, refDim: CGFloat, state: OverlayState) {
    let accent = UIColor(hex: state.accentColor) ?? .white
    let ink = UIColor(hex: state.goInk) ?? .black
    let goSize = refDim * 0.16
    let textH = lineHeight(goSize, oswaldMedium: true)
    let bandH = textH + goSize * 0.75
    context.saveGState()
    context.translateBy(x: size.width / 2, y: size.height / 2)
    context.rotate(by: -4 * .pi / 180)
    context.setFillColor(accent.cgColor)
    context.fill(CGRect(x: -size.width * 0.6, y: -bandH / 2, width: size.width * 1.2, height: bandH))
    drawText(context: context, text: state.goLabel,
             rect: CGRect(x: -size.width / 2, y: -textH / 2, width: size.width, height: textH),
             fontSize: goSize, bold: false, color: ink, alignment: .center, oswaldMedium: true)
    context.restoreGState()
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

    let attrString = NSAttributedString(string: text, attributes: attributes)

    UIGraphicsPushContext(context)
    attrString.draw(in: rect)
    UIGraphicsPopContext()
  }
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
