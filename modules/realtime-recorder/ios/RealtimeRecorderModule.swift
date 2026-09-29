import ExpoModulesCore
import AVFoundation
import UIKit

// MARK: - Shared engine (singleton that owns the capture session)

final class RecorderEngine: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureAudioDataOutputSampleBufferDelegate {
  static let shared = RecorderEngine()

  private let captureQueue = DispatchQueue(label: "com.athlex.recorder.capture", qos: .userInitiated)
  private let writerQueue  = DispatchQueue(label: "com.athlex.recorder.writer",  qos: .userInitiated)

  private(set) var captureSession: AVCaptureSession?
  private var videoOutput: AVCaptureVideoDataOutput?
  private var audioOutput: AVCaptureAudioDataOutput?

  private var assetWriter: AVAssetWriter?
  private var videoWriterInput: AVAssetWriterInput?
  private var audioWriterInput: AVAssetWriterInput?
  private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?

  private var isRecording = false
  private var isSessionStarted = false
  private var outputURL: URL?
  var currentFacing: AVCaptureDevice.Position = .back
  /// Derived from the rotation actually applied to the video output (see
  /// `refreshOutputGeometry`), never from `UIDeviceOrientation` alone.
  private(set) var isLandscape = false
  private var currentDevice: AVCaptureDevice?
  /// Legacy path only (iOS < 17). Unverified: no device below iOS 17 in the fleet.
  private var currentDeviceOrientation: UIDeviceOrientation = .portrait

  /// `AVCaptureDevice.RotationCoordinator` (iOS 17+), typed as `NSObject` because
  /// stored properties cannot be availability-gated. Recreated on every session
  /// setup so it always points at the active device and preview layer.
  private var rotationCoordinator: NSObject?
  private var rotationObservation: NSKeyValueObservation?

  /// Diagnostic: logs device name + preview/capture angles at session start
  /// (`[RealtimeRecorder][orientation]` in Console). Off in production; flip to
  /// `true` to compare two phones.
  static let orientationDebugLog = false

  // Video options (R6c). Defaults = former fixed behaviour: 1080p, 30 fps, mic on.
  var quality = VideoQuality.defaultQuality
  var fps: Int32 = 30
  var micEnabled = true

  // Frames appended to the writer during the last recording (dry run or real).
  private var writtenFrames = 0
  private var firstFrameTime = CMTime.invalid
  private var lastFrameTime = CMTime.invalid

  private let renderer = OverlayRenderer()
  var overlayState = OverlayState()
  let stateLock = NSLock()

  // Weak ref to the visible host view (set by the view itself)
  weak var hostView: RealtimeRecorderHostView?

  private override init() {
    super.init()
    // Listen to device rotation so we can keep the preview upright in real time
    // (only when we're not actively recording — orientation is locked once the
    // user presses "Démarrer").
    UIDevice.current.beginGeneratingDeviceOrientationNotifications()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleDeviceOrientationChange),
      name: UIDevice.orientationDidChangeNotification,
      object: nil
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    UIDevice.current.endGeneratingDeviceOrientationNotifications()
  }

  @objc private func handleDeviceOrientationChange() {
    let orientation = UIDevice.current.orientation
    guard orientation.isValidInterfaceOrientation else { return }
    captureQueue.async { [weak self] in
      guard let self = self else { return }
      // Lock orientation once recording has started — never re-rotate the live
      // capture connection while the asset writer is consuming frames.
      if self.isRecording { return }
      self.currentDeviceOrientation = orientation
      if #available(iOS 17.0, *) { return } // RotationCoordinator KVO drives iOS 17+
      self.applyLegacyOrientation()
    }
  }

  // MARK: Orientation (iOS 17+: asked to iOS, never guessed)

  /// Builds a fresh coordinator for the active device + preview layer, wires the
  /// KVO that keeps the preview level while the user rotates the phone before
  /// recording, and applies the initial angles. Main thread.
  @available(iOS 17.0, *)
  private func installRotationCoordinator(device: AVCaptureDevice, preview: AVCaptureVideoPreviewLayer) {
    rotationObservation?.invalidate()
    let coordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: preview)
    rotationCoordinator = coordinator
    rotationObservation = coordinator.observe(\.videoRotationAngleForHorizonLevelPreview, options: [.new]) { [weak self] _, _ in
      self?.applyCoordinatorAngles(logReason: "rotation")
    }
    applyCoordinatorAngles(logReason: "session start")
  }

  /// Preview → `videoRotationAngleForHorizonLevelPreview`, video output (writer)
  /// → `videoRotationAngleForHorizonLevelCapture`. Frozen while recording.
  @available(iOS 17.0, *)
  private func applyCoordinatorAngles(logReason: String) {
    guard let coordinator = rotationCoordinator as? AVCaptureDevice.RotationCoordinator else { return }
    let previewAngle = coordinator.videoRotationAngleForHorizonLevelPreview
    let captureAngle = coordinator.videoRotationAngleForHorizonLevelCapture

    DispatchQueue.main.async { [weak self] in
      guard let self = self, !self.isRecording,
            let conn = self.hostView?.currentPreviewLayer?.connection else { return }
      if conn.isVideoRotationAngleSupported(previewAngle) { conn.videoRotationAngle = previewAngle }
    }

    captureQueue.async { [weak self] in
      guard let self = self, !self.isRecording else { return }
      // The angle really applied is the one re-read from the connection after
      // assignment (unsupported angles are silently not applied), and it is the
      // one the writer geometry must follow.
      var appliedAngle = captureAngle
      if let conn = self.videoOutput?.connection(with: .video) {
        if conn.isVideoRotationAngleSupported(captureAngle) {
          conn.videoRotationAngle = captureAngle
        }
        appliedAngle = conn.videoRotationAngle
      }
      self.refreshOutputGeometry(appliedAngle: appliedAngle)
      if RecorderEngine.orientationDebugLog {
        let name = self.currentDevice?.localizedName ?? "?"
        print("[RealtimeRecorder][orientation] \(logReason) device=\(name) facing=\(self.currentFacing == .front ? "front" : "back") previewAngle=\(previewAngle) captureAngle=\(captureAngle) appliedAngle=\(appliedAngle) isLandscape=\(self.isLandscape)")
      }
    }
  }

  /// Derives `isLandscape` from the native format dimensions rotated by the
  /// angle really applied to the output connection, so the writer's
  /// 1080×1920 / 1920×1080 always matches the buffers it receives. captureQueue.
  private func refreshOutputGeometry(appliedAngle: CGFloat) {
    guard let device = currentDevice else { return }
    let dims = CMVideoFormatDescriptionGetDimensions(device.activeFormat.formatDescription)
    let quarterTurn = Int(appliedAngle.rounded()) % 180 != 0
    let outW = quarterTurn ? Int(dims.height) : Int(dims.width)
    let outH = quarterTurn ? Int(dims.width)  : Int(dims.height)
    isLandscape = outW > outH
    if RecorderEngine.orientationDebugLog {
      print("[RealtimeRecorder][orientation] native=\(dims.width)x\(dims.height) applied=\(appliedAngle) → output=\(outW)x\(outH)")
    }
  }

  /// iOS < 17 only (deployment target 15.1). Unverified on device: the standard
  /// UIDeviceOrientation → AVCaptureVideoOrientation mapping via raw values
  /// (landscape is inverted between the two enums, which the raw values encode).
  private func applyLegacyOrientation() {
    let avOrientation = AVCaptureVideoOrientation(rawValue: currentDeviceOrientation.rawValue) ?? .portrait
    if let conn = videoOutput?.connection(with: .video), conn.isVideoOrientationSupported {
      conn.videoOrientation = avOrientation
    }
    isLandscape = currentDeviceOrientation.isLandscape
    DispatchQueue.main.async { [weak self] in
      guard let conn = self?.hostView?.currentPreviewLayer?.connection, conn.isVideoOrientationSupported else { return }
      conn.videoOrientation = avOrientation
    }
  }

  // MARK: Setup

  func setupSession() {
    captureQueue.async { [weak self] in
      guard let self = self else { return }

      DispatchQueue.main.sync {
        let orientation = UIDevice.current.orientation
        if orientation.isValidInterfaceOrientation {
          self.currentDeviceOrientation = orientation
        }
        self.rotationObservation?.invalidate()
        self.rotationObservation = nil
        self.rotationCoordinator = nil
      }

      if let existing = self.captureSession, existing.isRunning {
        existing.stopRunning()
      }

      // Configure audio session BEFORE capture session to ensure iOS locks the correct audio route
      let audioSession = AVAudioSession.sharedInstance()
      do {
        if self.micEnabled {
          try audioSession.setCategory(.playAndRecord, mode: .videoRecording, options: [.defaultToSpeaker, .allowBluetooth, .mixWithOthers])
          try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
          try audioSession.overrideOutputAudioPort(.speaker)
          print("[RealtimeRecorder] Audio session configured (videoRecording mode)")
        } else {
          // Mic off: playback only, no input route (no orange mic indicator).
          try audioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
          try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
          print("[RealtimeRecorder] Audio session configured (playback only, mic off)")
        }
      } catch {
        print("[RealtimeRecorder] Audio session config error: \(error)")
      }

      let session = AVCaptureSession()
      // Keep our own audio session (with .mixWithOthers) — otherwise AVCaptureSession
      // reconfigures it when the mic input is added and interrupts the user's music.
      session.automaticallyConfiguresApplicationAudioSession = false
      session.beginConfiguration()
      session.sessionPreset = .hd1920x1080

      guard let camera = self.findCamera(position: self.currentFacing),
            let videoInput = try? AVCaptureDeviceInput(device: camera),
            session.canAddInput(videoInput) else {
        print("[RealtimeRecorder] Cannot add video input")
        session.commitConfiguration()
        return
      }
      session.addInput(videoInput)
      self.currentDevice = camera

      if self.quality != VideoQuality.defaultQuality {
        // Step down until this camera accepts the preset (2K captures 4K).
        var q: String? = self.quality
        while let cur = q, !session.canSetSessionPreset(VideoQuality.preset(cur)) { q = VideoQuality.lower(cur) }
        self.quality = q ?? VideoQuality.defaultQuality
        session.sessionPreset = VideoQuality.preset(self.quality)
      }

      if self.micEnabled,
         let mic = AVCaptureDevice.default(for: .audio),
         let audioInput = try? AVCaptureDeviceInput(device: mic),
         session.canAddInput(audioInput) {
        session.addInput(audioInput)
      }

      let vOutput = AVCaptureVideoDataOutput()
      vOutput.videoSettings = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
      ]
      vOutput.alwaysDiscardsLateVideoFrames = true
      vOutput.setSampleBufferDelegate(self, queue: self.captureQueue)
      if session.canAddOutput(vOutput) { session.addOutput(vOutput) }

      if let connection = vOutput.connection(with: .video), self.currentFacing == .front {
        // Only the writer output is mirrored; the preview layer mirrors itself
        // (`automaticallyAdjustsVideoMirroring`), so we never double it.
        connection.isVideoMirrored = true
      }

      var aOutput: AVCaptureAudioDataOutput?
      if self.micEnabled {
        let out = AVCaptureAudioDataOutput()
        out.setSampleBufferDelegate(self, queue: self.captureQueue)
        if session.canAddOutput(out) { session.addOutput(out); aOutput = out }
      }

      session.commitConfiguration()

      // 25 fps: fixed frame duration when the active format allows it (30 = format default, untouched).
      if self.fps != 30,
         camera.activeFormat.videoSupportedFrameRateRanges.contains(where: { $0.minFrameRate <= Double(self.fps) && Double(self.fps) <= $0.maxFrameRate }),
         (try? camera.lockForConfiguration()) != nil {
        camera.activeVideoMinFrameDuration = CMTime(value: 1, timescale: self.fps)
        camera.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: self.fps)
        camera.unlockForConfiguration()
      }

      self.captureSession = session
      self.videoOutput = vOutput
      self.audioOutput = aOutput

      // Attach preview on main thread, then let iOS decide the angles.
      DispatchQueue.main.async {
        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        self.hostView?.attachPreview(preview)

        if #available(iOS 17.0, *) {
          self.installRotationCoordinator(device: camera, preview: preview)
        } else {
          self.captureQueue.async { self.applyLegacyOrientation() }
        }
      }

      session.startRunning()
      print("[RealtimeRecorder] Session started, facing: \(self.currentFacing == .back ? "back" : "front")")

      DispatchQueue.main.async {
        self.hostView?.markReady()
      }
    }
  }

  // MARK: Recording

  func startRecording(url: URL) throws {
    // The audio session is already configured (with .mixWithOthers) when the capture
    // session is set up. Re-activating it here would interrupt the user's music at the
    // moment recording starts, so we intentionally do NOT touch the session again.

    try? FileManager.default.removeItem(at: url)
    self.outputURL = url
    self.isSessionStarted = false

    let writer = try AVAssetWriter(url: url, fileType: .mp4)

    let size = VideoQuality.size(quality)
    let vidW = isLandscape ? size.width : size.height
    let vidH = isLandscape ? size.height : size.width

    var videoSettings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: vidW,
      AVVideoHeightKey: vidH,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: VideoQuality.bitrate(quality),
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
      ]
    ]
    // 2K: 4K camera buffers, scaled down to 2560 x 1440 by the writer.
    let scaled = quality == "2k"
    if scaled { videoSettings[AVVideoScalingModeKey] = AVVideoScalingModeResizeAspect }
    let vInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    vInput.expectsMediaDataInRealTime = true

    var adaptorAttrs: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    ]
    if !scaled {
      adaptorAttrs[kCVPixelBufferWidthKey as String] = vidW
      adaptorAttrs[kCVPixelBufferHeightKey as String] = vidH
    }
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: vInput,
      sourcePixelBufferAttributes: adaptorAttrs
    )

    let audioSettings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: 44100,
      AVNumberOfChannelsKey: 1,
      AVEncoderBitRateKey: 128000,
    ]
    let aInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
    aInput.expectsMediaDataInRealTime = true

    if writer.canAdd(vInput) { writer.add(vInput) }
    // Mic off: no audio track at all.
    if micEnabled, writer.canAdd(aInput) { writer.add(aInput) }

    self.assetWriter = writer
    self.videoWriterInput = vInput
    self.audioWriterInput = micEnabled ? aInput : nil
    self.pixelBufferAdaptor = adaptor
    self.writtenFrames = 0
    self.firstFrameTime = .invalid
    self.lastFrameTime = .invalid
    self.isRecording = true

    // Prevent screen from auto-locking during recording
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = true
    }

    print("[RealtimeRecorder] Recording started → \(url.lastPathComponent)")
  }

  func stopRecording(completion: @escaping (Result<String, Error>) -> Void) {
    guard isRecording else {
      completion(.failure(NSError(domain: "RealtimeRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: "Not recording"])))
      return
    }

    isRecording = false

    // Re-enable screen auto-lock
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = false
    }

    print("[RealtimeRecorder] Stopping recording...")

    writerQueue.async { [weak self] in
      guard let self = self else { return }
      self.videoWriterInput?.markAsFinished()
      self.audioWriterInput?.markAsFinished()

      self.assetWriter?.finishWriting {
        let status = self.assetWriter?.status ?? .unknown
        if status == .completed, let path = self.outputURL?.absoluteString {
          print("[RealtimeRecorder] Recording saved: \(path)")
          completion(.success(path))
        } else {
          let errMsg = self.assetWriter?.error?.localizedDescription ?? "Unknown error"
          print("[RealtimeRecorder] Recording failed: \(errMsg)")
          completion(.failure(NSError(domain: "RealtimeRecorder", code: 2, userInfo: [NSLocalizedDescriptionKey: errMsg])))
        }

        self.assetWriter = nil
        self.videoWriterInput = nil
        self.audioWriterInput = nil
        self.pixelBufferAdaptor = nil
      }
    }
  }

  // MARK: Delegate

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard isRecording, let writer = assetWriter else { return }

    let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)

    if !isSessionStarted {
      if writer.status == .unknown {
        writer.startWriting()
        writer.startSession(atSourceTime: timestamp)
        isSessionStarted = true
        print("[RealtimeRecorder] Writer session started at \(timestamp.seconds)s")
      }
    }

    guard writer.status == .writing else { return }

    if output == videoOutput {
      guard let videoInput = videoWriterInput, videoInput.isReadyForMoreMediaData else { return }
      guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

      stateLock.lock()
      let currentState = overlayState
      stateLock.unlock()

      renderer.render(onto: imageBuffer, state: currentState)
      if pixelBufferAdaptor?.append(imageBuffer, withPresentationTime: timestamp) == true {
        writtenFrames += 1
        if !firstFrameTime.isValid { firstFrameTime = timestamp }
        lastFrameTime = timestamp
      }

    } else if output == audioOutput {
      guard let audioInput = audioWriterInput, audioInput.isReadyForMoreMediaData else { return }
      audioInput.append(sampleBuffer)
    }
  }

  // MARK: Quality (R6c)

  /// (frames expected from the first to the last appended frame, frames appended).
  func lastRecordingStats() -> (expected: Int, written: Int) {
    guard firstFrameTime.isValid, lastFrameTime.isValid else { return (0, writtenFrames) }
    let span = CMTimeGetSeconds(CMTimeSubtract(lastFrameTime, firstFrameTime))
    return (Int((span * Double(fps)).rounded(.down)) + 1, writtenFrames)
  }

  /// Qualities the camera at `position` records natively (2K = 4K scaled down).
  func supportedQualities(position: AVCaptureDevice.Position) -> [String] {
    guard let device = findCamera(position: position) else { return ["720p", "1080p"] }
    let dims = device.formats
      .filter { $0.videoSupportedFrameRateRanges.contains(where: { $0.maxFrameRate >= 30 }) }
      .map { CMVideoFormatDescriptionGetDimensions($0.formatDescription) }
    let has4k = dims.contains { $0.width == 3840 && $0.height == 2160 }
    return VideoQuality.order.filter { VideoQuality.isAbove1080($0) ? has4k : true }
  }

  /// Settles the quality before recording: highest one the current camera
  /// supports, 1080p when the phone is hot, and above 1080p a 1.5 s dry run
  /// through the real pipeline (overlay included, mic off) that steps down
  /// while fewer than 90 % of the frames reach the file.
  func prepareQuality(completion: @escaping (_ applied: String, _ reason: String?) -> Void) {
    let requested = quality
    var q = VideoQuality.clamp(requested, supportedQualities(position: currentFacing))
    var reason: String? = q != requested ? "camera" : nil
    let thermal = ProcessInfo.processInfo.thermalState
    if VideoQuality.isAbove1080(q), thermal == .serious || thermal == .critical {
      q = VideoQuality.defaultQuality
      reason = "thermal"
    }
    let mic = micEnabled

    func finish(_ applied: String) {
      quality = applied
      micEnabled = mic
      if applied != requested || VideoQuality.isAbove1080(requested) { setupSession() }
      print("[RealtimeRecorder] prepareQuality requested=\(requested) applied=\(applied) reason=\(reason ?? "-")")
      completion(applied, reason)
    }

    func dryRun(_ candidate: String) {
      guard VideoQuality.isAbove1080(candidate) else { finish(candidate); return }
      quality = candidate
      micEnabled = false
      setupSession()
      let url = FileManager.default.temporaryDirectory.appendingPathComponent("realtime_recorder_dry_run.mp4")
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
        do { try self.startRecording(url: url) } catch { finish(VideoQuality.defaultQuality); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
          self.stopRecording { _ in
            try? FileManager.default.removeItem(at: url)
            let stats = self.lastRecordingStats()
            print("[RealtimeRecorder] dry run \(candidate): \(stats.written)/\(stats.expected) frames")
            // An unsupported preset was stepped down by setupSession: keep what it settled on.
            let ran = self.quality
            if VideoQuality.keepsUp(written: stats.written, expected: stats.expected) {
              DispatchQueue.main.async { finish(ran) }
            } else {
              reason = "performance"
              DispatchQueue.main.async { dryRun(VideoQuality.lower(ran) ?? VideoQuality.defaultQuality) }
            }
          }
        }
      }
    }

    dryRun(q)
  }

  // MARK: Helpers

  private func findCamera(position: AVCaptureDevice.Position) -> AVCaptureDevice? {
    if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) {
      return device
    }
    return AVCaptureDevice.default(for: .video)
  }
}

// MARK: - Expo Module

public class RealtimeRecorderModule: Module {
  private var engine: RecorderEngine { RecorderEngine.shared }

  public func definition() -> ModuleDefinition {
    Name("RealtimeRecorder")

    Function("updateOverlayState") { (dict: [String: Any]) in
      self.engine.stateLock.lock()
      if let v = dict["timerType"] as? String   { self.engine.overlayState.timerType = v }
      if let v = dict["timerDisplay"] as? String { self.engine.overlayState.timerDisplay = v }
      if let v = dict["title"] as? String        { self.engine.overlayState.title = v }
      if let v = dict["timestamp"] as? String    { self.engine.overlayState.timestamp = v }
      if let v = dict["isRecording"] as? Bool    { self.engine.overlayState.isRecording = v }
      if let v = dict["countdownValue"] as? Int  { self.engine.overlayState.countdownValue = v }
      if let v = dict["countdownLabel"] as? String { self.engine.overlayState.countdownLabel = v }
      if let v = dict["countdownTense"] as? Bool { self.engine.overlayState.countdownTense = v }
      if let v = dict["goLabel"] as? String      { self.engine.overlayState.goLabel = v }
      if let v = dict["accentColor"] as? String  { self.engine.overlayState.accentColor = v }
      if let v = dict["goInk"] as? String        { self.engine.overlayState.goInk = v }
      if let v = dict["showTimer"] as? Bool      { self.engine.overlayState.showTimer = v }
      if let v = dict["boxLogoUrl"] as? String  { self.engine.overlayState.boxLogoUrl = v }
      if let v = dict["competitionLogoUrl"] as? String { self.engine.overlayState.competitionLogoUrl = v }
      self.engine.stateLock.unlock()
    }

    AsyncFunction("startRecording") { (options: [String: Any], promise: Promise) in
      let outputPath = options["outputPath"] as? String ?? ""
      let facing = options["facing"] as? String ?? "back"
      self.applyVideoOptions(options)
      // `isLandscape` from JS is ignored on purpose: the writer geometry is
      // derived from the rotation angle actually applied by the engine.

      self.engine.currentFacing = facing == "front" ? .front : .back

      guard !outputPath.isEmpty else {
        promise.reject("ERR", "outputPath is required")
        return
      }

      let url: URL
      if outputPath.hasPrefix("file://") {
        url = URL(string: outputPath) ?? URL(fileURLWithPath: outputPath)
      } else {
        url = URL(fileURLWithPath: outputPath)
      }

      // Always re-setup session so the rotation coordinator matches the device
      self.engine.setupSession()
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
        do {
          try self.engine.startRecording(url: url)
          promise.resolve(nil)
        } catch {
          promise.reject("ERR", error.localizedDescription)
        }
      }
    }

    Function("getSupportedQualities") { () -> [String: [String]] in
      ["front": self.engine.supportedQualities(position: .front),
       "back": self.engine.supportedQualities(position: .back)]
    }

    AsyncFunction("prepareQuality") { (options: [String: Any], promise: Promise) in
      if let facing = options["facing"] as? String { self.engine.currentFacing = facing == "front" ? .front : .back }
      self.applyVideoOptions(options)
      let requested = self.engine.quality
      DispatchQueue.main.async {
        self.engine.prepareQuality { applied, reason in
          promise.resolve(["requested": requested, "applied": applied, "reason": reason.map { $0 as Any } ?? NSNull()])
        }
      }
    }

    Function("getLastRecordingStats") { () -> [String: Int] in
      let stats = self.engine.lastRecordingStats()
      return ["expectedFrames": stats.expected, "writtenFrames": stats.written]
    }

    AsyncFunction("stopRecording") { (promise: Promise) in
      self.engine.stopRecording { result in
        switch result {
        case .success(let path):
          promise.resolve(path)
        case .failure(let error):
          promise.reject("ERR", error.localizedDescription)
        }
      }
    }

    Function("switchCamera") {
      self.engine.currentFacing = self.engine.currentFacing == .back ? .front : .back
      self.engine.setupSession()
    }

    View(RealtimeRecorderHostView.self) {
      Events("onReady")

      Prop("facing") { (view: RealtimeRecorderHostView, val: String) in
        let newFacing: AVCaptureDevice.Position = val == "front" ? .front : .back
        if newFacing != self.engine.currentFacing {
          self.engine.currentFacing = newFacing
          self.engine.setupSession()
        }
      }

      Prop("isLandscape") { (view: RealtimeRecorderHostView, landscape: Bool) in
        // Kept for API compatibility with the JS side; geometry now follows the
        // rotation angle applied by iOS, so the JS hint only triggers a refresh.
        if landscape != self.engine.isLandscape {
          self.engine.setupSession()
        }
      }
    }
  }

  /// quality / fps / mic from JS; missing keys keep the defaults (1080p, 30 fps, mic on).
  private func applyVideoOptions(_ options: [String: Any]) {
    let q = options["quality"] as? String ?? VideoQuality.defaultQuality
    engine.quality = VideoQuality.order.contains(q) ? q : VideoQuality.defaultQuality
    engine.fps = (options["fps"] as? Int) == 25 ? 25 : 30
    engine.micEnabled = options["mic"] as? Bool ?? true
  }
}

// MARK: - Video quality rules (R6c)

enum VideoQuality {
  static let order = ["720p", "1080p", "2k", "4k"]
  static let defaultQuality = "1080p"

  /// Landscape output size.
  static func size(_ q: String) -> (width: Int, height: Int) {
    switch q {
    case "720p": return (1280, 720)
    case "2k": return (2560, 1440)
    case "4k": return (3840, 2160)
    default: return (1920, 1080)
    }
  }

  /// 1080p keeps the former 6 Mb/s.
  static func bitrate(_ q: String) -> Int {
    switch q {
    case "720p": return 4_000_000
    case "2k": return 10_000_000
    case "4k": return 20_000_000
    default: return 6_000_000
    }
  }

  /// 2K has no native preset on iPhone: it captures 4K.
  static func preset(_ q: String) -> AVCaptureSession.Preset {
    switch q {
    case "720p": return .hd1280x720
    case "2k", "4k": return .hd4K3840x2160
    default: return .hd1920x1080
    }
  }

  static func isAbove1080(_ q: String) -> Bool { q == "2k" || q == "4k" }

  static func lower(_ q: String) -> String? {
    guard let i = order.firstIndex(of: q), i > 0 else { return nil }
    return order[i - 1]
  }

  static func clamp(_ requested: String, _ supported: [String]) -> String {
    var q: String? = order.contains(requested) ? requested : defaultQuality
    while let cur = q, !supported.contains(cur) { q = lower(cur) }
    return q ?? defaultQuality
  }

  static func keepsUp(written: Int, expected: Int) -> Bool {
    expected > 0 && written * 10 >= expected * 9
  }
}

// MARK: - Host View

public class RealtimeRecorderHostView: ExpoView {
  private var currentPreview: AVCaptureVideoPreviewLayer?

  /// Exposed so `RecorderEngine` can live-update the preview orientation.
  var currentPreviewLayer: AVCaptureVideoPreviewLayer? { currentPreview }

  // Expo Modules EventDispatcher — automatically bridged to JS onReady prop
  let onReady = EventDispatcher()

  /// Called by RecorderEngine when the capture session is running.
  func markReady() {
    onReady()
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      RecorderEngine.shared.hostView = self
      RecorderEngine.shared.setupSession()
    }
  }

  func attachPreview(_ layer: AVCaptureVideoPreviewLayer) {
    currentPreview?.removeFromSuperlayer()
    layer.frame = bounds
    self.layer.insertSublayer(layer, at: 0)
    currentPreview = layer
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    currentPreview?.frame = bounds
  }
}
