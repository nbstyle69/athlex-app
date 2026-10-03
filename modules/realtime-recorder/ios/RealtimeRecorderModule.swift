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

  // Video options (R6c). Defaults = former fixed behaviour: 30 fps, mic on.
  // Capture and file are fixed at 1080p (the 2K / 4K choice and its dry run were
  // removed after the 1.0.59 crashes).
  var fps: Int32 = 30
  var micEnabled = true

  /// Error code sent to JS when the capture pipeline cannot be built or raises.
  static let sessionErrorCode = "ERR_CAPTURE_SESSION"

  // Beeps in the video (R6c): PCM per type (44.1 kHz, -6 dBFS peak), placed on the
  // capture clock by markBeep, mixed into the mic buffers or into a synthetic track.
  var beepsEnabled = false
  private var beepPcm: [String: [Float]] = [:]
  private var beepPcmByRate: [String: [Float]] = [:]
  private var scheduledBeeps: [(time: Double, type: String)] = []
  private let beepLock = NSLock()
  private var micActive = false
  private var synthFormat: CMAudioFormatDescription?
  private var synthStartTime = CMTime.invalid
  private var synthSamples: Int64 = 0

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
  /// recording, and returns the initial angles (applied synchronously by
  /// `buildAndStartSession`, before the session runs). Main thread.
  @available(iOS 17.0, *)
  private func installRotationCoordinator(device: AVCaptureDevice, preview: AVCaptureVideoPreviewLayer) -> (preview: CGFloat, capture: CGFloat) {
    rotationObservation?.invalidate()
    let coordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: preview)
    rotationCoordinator = coordinator
    rotationObservation = coordinator.observe(\.videoRotationAngleForHorizonLevelPreview, options: [.new]) { [weak self] _, _ in
      self?.applyCoordinatorAngles(logReason: "rotation")
    }
    return (coordinator.videoRotationAngleForHorizonLevelPreview, coordinator.videoRotationAngleForHorizonLevelCapture)
  }

  /// Live rotation before recording (KVO): preview →
  /// `videoRotationAngleForHorizonLevelPreview` on main, video output (writer) →
  /// `videoRotationAngleForHorizonLevelCapture` on captureQueue. Frozen while recording.
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
      self.applyCaptureAngle(captureAngle, previewAngle: previewAngle, logReason: logReason)
    }
  }

  /// Sets the video output angle and derives the writer geometry from the angle
  /// really applied (unsupported angles are silently not applied, so it is
  /// re-read from the connection after assignment). captureQueue.
  @available(iOS 17.0, *)
  private func applyCaptureAngle(_ captureAngle: CGFloat, previewAngle: CGFloat, logReason: String) {
    var appliedAngle = captureAngle
    if let conn = videoOutput?.connection(with: .video) {
      if conn.isVideoRotationAngleSupported(captureAngle) {
        conn.videoRotationAngle = captureAngle
      }
      appliedAngle = conn.videoRotationAngle
    }
    refreshOutputGeometry(appliedAngle: appliedAngle)
    if RecorderEngine.orientationDebugLog {
      let name = currentDevice?.localizedName ?? "?"
      print("[RealtimeRecorder][orientation] \(logReason) device=\(name) facing=\(currentFacing == .front ? "front" : "back") previewAngle=\(previewAngle) captureAngle=\(captureAngle) appliedAngle=\(appliedAngle) isLandscape=\(isLandscape)")
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

  /// Rebuilds the capture session on `captureQueue`, which serializes every
  /// setup, camera switch and recording start: nothing else touches a session
  /// while it is being configured. `completion` runs on `captureQueue` once the
  /// session is running with the preview attached, the rotation angles applied
  /// and `isLandscape` computed for *this* session — or with the error.
  ///
  /// Never kills the app: AVFoundation raises Objective-C exceptions (1.0.59
  /// crashed in `startRunning`, called while the preview layer was between
  /// `beginConfiguration` and `commitConfiguration` on the main thread), and
  /// Swift cannot catch them, so every session call goes through
  /// `RTRCatchException` and a raised exception becomes an error for JS.
  func setupSession(completion: ((Error?) -> Void)? = nil) {
    captureQueue.async { [weak self] in
      guard let self = self else { return }
      let error = self.buildAndStartSession()
      if let error = error { print("[RealtimeRecorder] Session setup failed: \(error.localizedDescription)") }
      completion?(error)
    }
  }

  private func sessionError(_ message: String) -> NSError {
    NSError(domain: "RealtimeRecorder", code: 3, userInfo: [NSLocalizedDescriptionKey: message])
  }

  private func sessionError(_ step: String, raised exception: NSException) -> NSError {
    sessionError("\(step): \(exception.name.rawValue) — \(exception.reason ?? "no reason")")
  }

  /// captureQueue. Returns nil when the session runs.
  private func buildAndStartSession() -> Error? {
    DispatchQueue.main.sync {
      let orientation = UIDevice.current.orientation
      if orientation.isValidInterfaceOrientation {
        self.currentDeviceOrientation = orientation
      }
      self.rotationObservation?.invalidate()
      self.rotationObservation = nil
      self.rotationCoordinator = nil
    }

    if let existing = captureSession {
      captureSession = nil
      videoOutput = nil
      audioOutput = nil
      if existing.isRunning, let raised = RTRCatchException({ existing.stopRunning() }) {
        print("[RealtimeRecorder] stopRunning raised \(raised.name.rawValue): \(raised.reason ?? "")")
      }
    }

    // Configure audio session BEFORE capture session to ensure iOS locks the correct audio route
    let audioSession = AVAudioSession.sharedInstance()
    do {
      if micEnabled {
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

    guard let camera = findCamera(position: currentFacing) else {
      return sessionError("No camera for facing \(currentFacing == .front ? "front" : "back")")
    }

    let session = AVCaptureSession()
    // Keep our own audio session (with .mixWithOthers) — otherwise AVCaptureSession
    // reconfigures it when the mic input is added and interrupts the user's music.
    session.automaticallyConfiguresApplicationAudioSession = false

    let vOutput = AVCaptureVideoDataOutput()
    var aOutput: AVCaptureAudioDataOutput?
    var configError: Error?
    if let raised = RTRCatchException({
      session.beginConfiguration()
      session.sessionPreset = .hd1920x1080

      guard let videoInput = try? AVCaptureDeviceInput(device: camera), session.canAddInput(videoInput) else {
        session.commitConfiguration()
        configError = self.sessionError("Cannot add video input")
        return
      }
      session.addInput(videoInput)

      if self.micEnabled,
         let mic = AVCaptureDevice.default(for: .audio),
         let audioInput = try? AVCaptureDeviceInput(device: mic),
         session.canAddInput(audioInput) {
        session.addInput(audioInput)
      }

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
    }) {
      return sessionError("configure", raised: raised)
    }
    if let configError = configError { return configError }

    currentDevice = camera
    captureSession = session
    videoOutput = vOutput
    audioOutput = aOutput

    // Preview + rotation coordinator, synchronously on main: the preview layer's own
    // beginConfiguration / commitConfiguration finishes before startRunning below.
    var angles: (preview: CGFloat, capture: CGFloat)?
    var previewError: Error?
    DispatchQueue.main.sync {
      if let raised = RTRCatchException({
        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        self.hostView?.attachPreview(preview)
        if #available(iOS 17.0, *) {
          let a = self.installRotationCoordinator(device: camera, preview: preview)
          if let conn = preview.connection, conn.isVideoRotationAngleSupported(a.preview) {
            conn.videoRotationAngle = a.preview
          }
          angles = a
        }
      }) {
        previewError = self.sessionError("preview", raised: raised)
      }
    }
    if let previewError = previewError {
      captureSession = nil; videoOutput = nil; audioOutput = nil
      return previewError
    }

    // Capture angle and writer geometry for this session, before it runs.
    if #available(iOS 17.0, *), let a = angles {
      applyCaptureAngle(a.capture, previewAngle: a.preview, logReason: "session start")
    } else {
      applyLegacyOrientation()
    }

    if let raised = RTRCatchException({ session.startRunning() }) {
      captureSession = nil; videoOutput = nil; audioOutput = nil
      return sessionError("startRunning", raised: raised)
    }
    print("[RealtimeRecorder] Session started, facing: \(currentFacing == .back ? "back" : "front"), landscape: \(isLandscape)")

    DispatchQueue.main.async { [weak self] in
      self?.hostView?.markReady()
    }
    return nil
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

    // `isLandscape` was computed for the session that is running now
    // (`buildAndStartSession`), never carried over from a previous one.
    let vidW = isLandscape ? 1920 : 1080
    let vidH = isLandscape ? 1080 : 1920

    let videoSettings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: vidW,
      AVVideoHeightKey: vidH,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 6_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
      ]
    ]
    let vInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    vInput.expectsMediaDataInRealTime = true

    let adaptorAttrs: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: vidW,
      kCVPixelBufferHeightKey as String: vidH,
    ]
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
    // Audio track: mic (+ beeps), beeps alone (synthetic), or none when both are off.
    micActive = micEnabled && audioOutput != nil
    let withBeeps = beepsEnabled && !beepPcm.isEmpty
    let withAudio = (micActive || withBeeps) && writer.canAdd(aInput)
    if withAudio { writer.add(aInput) }
    beepLock.lock(); scheduledBeeps.removeAll(); beepLock.unlock()
    beepPcmByRate.removeAll()
    synthStartTime = .invalid
    synthSamples = 0

    self.assetWriter = writer
    self.videoWriterInput = vInput
    self.audioWriterInput = withAudio ? aInput : nil
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
        synthStartTime = timestamp
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
      // Mic off, beeps on: the audio track follows the video clock.
      if !micActive, beepsEnabled { appendSyntheticAudio(upTo: timestamp) }

    } else if output == audioOutput {
      guard let audioInput = audioWriterInput, audioInput.isReadyForMoreMediaData else { return }
      if beepsEnabled { mixBeeps(into: sampleBuffer) }
      audioInput.append(sampleBuffer)
    }
  }

  // MARK: Recording stats (R6c)

  /// (frames expected from the first to the last appended frame, frames appended).
  func lastRecordingStats() -> (expected: Int, written: Int) {
    guard firstFrameTime.isValid, lastFrameTime.isValid else { return (0, writtenFrames) }
    let span = CMTimeGetSeconds(CMTimeSubtract(lastFrameTime, firstFrameTime))
    return (Int((span * Double(fps)).rounded(.down)) + 1, writtenFrames)
  }

  // MARK: Beeps in the video (R6c)

  /// Loads the beep WAVs sent by JS (same files as the speaker); broken files are skipped.
  func loadBeeps(files: [String: String]) {
    var out: [String: [Float]] = [:]
    for (type, path) in files {
      let url = path.hasPrefix("file://") ? (URL(string: path) ?? URL(fileURLWithPath: path)) : URL(fileURLWithPath: path)
      guard let data = try? Data(contentsOf: url), let decoded = BeepPcm.decodeWav(data) else {
        print("[RealtimeRecorder] beep \(type) not loaded")
        continue
      }
      out[type] = BeepPcm.normalize(BeepPcm.resample(decoded.1, from: decoded.0, to: 44100))
    }
    beepPcm = out
  }

  private var captureClock: CMClock {
    if #available(iOS 15.4, *), let clock = captureSession?.synchronizationClock { return clock }
    return CMClockGetHostTimeClock()
  }

  /// Places a beep at "now" on the capture clock (the sample buffers' clock). With the
  /// mic on, it is delayed by the output + input latencies so it lands on the speaker
  /// beep the mic captures instead of doubling it.
  func markBeep(_ type: String) {
    guard isRecording, beepsEnabled, beepPcm[type] != nil else { return }
    // No speaker-latency offset: JS only mixes a beep when the mic cannot hear the
    // speaker (mic off or phone silent), so the beep belongs at "now".
    let t = CMTimeGetSeconds(CMClockGetTime(captureClock))
    beepLock.lock()
    scheduledBeeps.append((time: t, type: type))
    beepLock.unlock()
  }

  /// Beep PCM at `rate` (resampled once per recording and rate).
  private func beepPcm(_ type: String, rate: Double) -> [Float] {
    let key = "\(type)@\(Int(rate))"
    if let cached = beepPcmByRate[key] { return cached }
    let pcm = BeepPcm.resample(beepPcm[type] ?? [], from: 44100, to: Int(rate))
    beepPcmByRate[key] = pcm
    return pcm
  }

  /// Adds the scheduled beeps overlapping [start, start + frames / rate) into interleaved
  /// PCM (Float32 or Int16), saturating. Beeps fully in the past are dropped. captureQueue.
  private func mixBeeps(into data: UnsafeMutableRawPointer, frames: Int, channels: Int, isFloat: Bool, rate: Double, start: Double) {
    beepLock.lock()
    let beeps = scheduledBeeps
    beepLock.unlock()
    var finished: [Double] = []
    for beep in beeps {
      let pcm = beepPcm(beep.type, rate: rate)
      let first = Int(((beep.time - start) * rate).rounded())
      if first + pcm.count <= 0 { finished.append(beep.time); continue }
      let from = max(0, first), to = min(frames, first + pcm.count)
      guard from < to else { continue }
      for f in from..<to {
        let v = pcm[f - first]
        for c in 0..<channels {
          let i = f * channels + c
          if isFloat {
            let p = data.assumingMemoryBound(to: Float.self)
            p[i] = min(1, max(-1, p[i] + v))
          } else {
            let p = data.assumingMemoryBound(to: Int16.self)
            p[i] = Int16(clamping: Int32(p[i]) + Int32(v * 32767))
          }
        }
      }
    }
    if !finished.isEmpty {
      beepLock.lock()
      scheduledBeeps.removeAll { b in finished.contains(b.time) }
      beepLock.unlock()
    }
  }

  /// Mixes into a mic sample buffer in place (linear PCM only).
  private func mixBeeps(into sampleBuffer: CMSampleBuffer) {
    guard let desc = CMSampleBufferGetFormatDescription(sampleBuffer),
          let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(desc)?.pointee,
          asbd.mFormatID == kAudioFormatLinearPCM else { return }
    let isFloat = asbd.mFormatFlags & kAudioFormatFlagIsFloat != 0
    guard (isFloat && asbd.mBitsPerChannel == 32) || (!isFloat && asbd.mBitsPerChannel == 16) else { return }
    let frames = CMSampleBufferGetNumSamples(sampleBuffer)
    let start = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
    var blockBuffer: CMBlockBuffer?
    var bufferList = AudioBufferList()
    let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
      sampleBuffer, bufferListSizeNeededOut: nil, bufferListOut: &bufferList,
      bufferListSize: MemoryLayout<AudioBufferList>.size, blockBufferAllocator: nil,
      blockBufferMemoryAllocator: nil, flags: 0, blockBufferOut: &blockBuffer)
    guard status == noErr else { return }
    let nonInterleaved = asbd.mFormatFlags & kAudioFormatFlagIsNonInterleaved != 0
    withUnsafeMutablePointer(to: &bufferList) { list in
      for buffer in UnsafeMutableAudioBufferListPointer(list) {
        guard let data = buffer.mData else { continue }
        mixBeeps(into: data, frames: frames, channels: nonInterleaved ? 1 : Int(buffer.mNumberChannels),
                 isFloat: isFloat, rate: asbd.mSampleRate, start: start)
      }
    }
  }

  /// Mic off: appends silence + beeps (Int16 mono 44.1 kHz) up to `time`. captureQueue.
  private func appendSyntheticAudio(upTo time: CMTime) {
    guard let input = audioWriterInput, synthStartTime.isValid, input.isReadyForMoreMediaData else { return }
    let rate = 44100.0
    let due = Int64((CMTimeGetSeconds(CMTimeSubtract(time, synthStartTime)) * rate).rounded(.down))
    let n = Int(min(due - synthSamples, 44100))
    guard n > 0 else { return }
    var pcm = [Int16](repeating: 0, count: n)
    let start = CMTimeGetSeconds(synthStartTime) + Double(synthSamples) / rate
    pcm.withUnsafeMutableBytes { raw in
      mixBeeps(into: raw.baseAddress!, frames: n, channels: 1, isFloat: false, rate: rate, start: start)
    }
    let pts = CMTimeAdd(synthStartTime, CMTime(value: synthSamples, timescale: 44100))
    if let sb = makeSyntheticSampleBuffer(pcm, pts: pts), input.append(sb) { synthSamples += Int64(n) }
  }

  private func makeSyntheticSampleBuffer(_ pcm: [Int16], pts: CMTime) -> CMSampleBuffer? {
    if synthFormat == nil {
      var asbd = AudioStreamBasicDescription(
        mSampleRate: 44100, mFormatID: kAudioFormatLinearPCM,
        mFormatFlags: kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked,
        mBytesPerPacket: 2, mFramesPerPacket: 1, mBytesPerFrame: 2, mChannelsPerFrame: 1,
        mBitsPerChannel: 16, mReserved: 0)
      CMAudioFormatDescriptionCreate(allocator: kCFAllocatorDefault, asbd: &asbd, layoutSize: 0, layout: nil,
                                     magicCookieSize: 0, magicCookie: nil, extensions: nil,
                                     formatDescriptionOut: &synthFormat)
    }
    guard let format = synthFormat else { return nil }
    let bytes = pcm.count * 2
    var block: CMBlockBuffer?
    guard CMBlockBufferCreateWithMemoryBlock(allocator: kCFAllocatorDefault, memoryBlock: nil, blockLength: bytes,
                                             blockAllocator: kCFAllocatorDefault, customBlockSource: nil,
                                             offsetToData: 0, dataLength: bytes,
                                             flags: kCMBlockBufferAssureMemoryNowFlag, blockBufferOut: &block) == noErr,
          let blockBuffer = block else { return nil }
    let copied = pcm.withUnsafeBytes { raw in
      CMBlockBufferReplaceDataBytes(with: raw.baseAddress!, blockBuffer: blockBuffer, offsetIntoDestination: 0, dataLength: bytes)
    }
    guard copied == noErr else { return nil }
    var sampleBuffer: CMSampleBuffer?
    guard CMAudioSampleBufferCreateReadyWithPacketDescriptions(
      allocator: kCFAllocatorDefault, dataBuffer: blockBuffer, formatDescription: format,
      sampleCount: pcm.count, presentationTimeStamp: pts, packetDescriptions: nil,
      sampleBufferOut: &sampleBuffer) == noErr else { return nil }
    return sampleBuffer
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
      self.applyBeepOptions(options)
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

      // The session is rebuilt for this recording (camera, mic, fps, rotation
      // coordinator) and the writer is created in its completion, on the same
      // queue, once the session runs with its geometry known: no timer.
      self.engine.setupSession { error in
        if let error = error {
          promise.reject(RecorderEngine.sessionErrorCode, error.localizedDescription)
          return
        }
        do {
          try self.engine.startRecording(url: url)
          promise.resolve(nil)
        } catch {
          promise.reject("ERR", error.localizedDescription)
        }
      }
    }

    Function("markBeep") { (type: String) in
      self.engine.markBeep(type)
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

  /// fps / mic from JS; missing keys keep the defaults (30 fps, mic on).
  private func applyVideoOptions(_ options: [String: Any]) {
    engine.fps = (options["fps"] as? Int) == 25 ? 25 : 30
    engine.micEnabled = options["mic"] as? Bool ?? true
  }

  /// beeps / beepFiles from JS; missing = no beep in the video (former behaviour).
  private func applyBeepOptions(_ options: [String: Any]) {
    let files = options["beepFiles"] as? [String: String] ?? [:]
    engine.beepsEnabled = (options["beeps"] as? Bool ?? false) && !files.isEmpty
    engine.loadBeeps(files: engine.beepsEnabled ? files : [:])
  }
}

// MARK: - Beep PCM (R6c), same rules as BeepMixer.kt

enum BeepPcm {
  /// Fixed beep peak in the video, about -6 dBFS.
  static let level: Float = 0.5

  /// 16-bit PCM WAV → (sample rate, mono samples in [-1, 1]); channels are averaged.
  static func decodeWav(_ data: Data) -> (Int, [Float])? {
    let b = [UInt8](data)
    func u16(_ i: Int) -> Int { Int(b[i]) | (Int(b[i + 1]) << 8) }
    func u32(_ i: Int) -> Int { u16(i) | (u16(i + 2) << 16) }
    func tag(_ i: Int) -> String { String(bytes: b[i..<i + 4], encoding: .ascii) ?? "" }
    guard b.count >= 12, tag(0) == "RIFF", tag(8) == "WAVE" else { return nil }
    var rate = 0, channels = 0, bits = 0
    var i = 12
    while i + 8 <= b.count {
      let id = tag(i), size = u32(i + 4), body = i + 8
      if id == "fmt " {
        guard body + 16 <= b.count, u16(body) == 1 else { return nil }
        channels = u16(body + 2); rate = u32(body + 4); bits = u16(body + 14)
      } else if id == "data" {
        guard bits == 16, channels >= 1, rate > 0 else { return nil }
        let end = min(b.count, body + size)
        let frames = (end - body) / (2 * channels)
        var out = [Float](repeating: 0, count: frames)
        for f in 0..<frames {
          var sum = 0
          for c in 0..<channels { sum += Int(Int16(truncatingIfNeeded: u16(body + (f * channels + c) * 2))) }
          out[f] = Float(sum) / Float(channels * 32768)
        }
        return (rate, out)
      }
      i = body + size + (size & 1)
    }
    return nil
  }

  static func normalize(_ pcm: [Float], peak: Float = level) -> [Float] {
    let maxAbs = pcm.map { abs($0) }.max() ?? 0
    guard maxAbs > 0 else { return pcm }
    let g = peak / maxAbs
    return pcm.map { $0 * g }
  }

  /// Linear-interpolation resampling (enough for tones).
  static func resample(_ pcm: [Float], from: Int, to: Int) -> [Float] {
    guard from != to, !pcm.isEmpty, from > 0, to > 0 else { return pcm }
    let n = pcm.count * to / from
    return (0..<n).map { k in
      let x = Double(k) * Double(from) / Double(to)
      let i = Int(x), t = Float(x - Double(i))
      let a = pcm[min(i, pcm.count - 1)], c = pcm[min(i + 1, pcm.count - 1)]
      return a + (c - a) * t
    }
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
