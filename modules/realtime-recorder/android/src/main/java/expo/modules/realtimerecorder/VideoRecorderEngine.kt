package expo.modules.realtimerecorder

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraManager
import android.media.MediaCodecList
import android.media.MediaFormat
import android.opengl.EGL14
import android.opengl.EGLSurface
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.PowerManager
import android.util.Log
import android.view.Surface
import android.view.TextureView
import android.view.WindowManager
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Orchestrates the full recording pipeline:
 *
 *   Camera2 → SurfaceTexture (OES) → GL thread 25 / 30 FPS
 *       → dual render: preview TextureView + encoder EGLSurface
 *       → H.264 HW encoder → MediaMuxer → MP4
 *       + AudioRecord → AAC → same MediaMuxer (only when the mic is on)
 *
 * Coordinates [EglCore], [CameraTextureRenderer], [OverlayRenderer],
 * [CameraController], [VideoEncoder], [AudioEncoder], and [VideoMuxer].
 */
class VideoRecorderEngine private constructor() {

  companion object {
    private const val TAG = "RealtimeRecorder"
    private const val DRY_RUN_MS = 1500L

    val shared = VideoRecorderEngine()
  }

  // Landscape mode — set before startRecording, swaps encoder dimensions
  var isLandscape = false

  // Video options (R6c). Defaults = former fixed behaviour: 1080p, 30 fps, mic on.
  @Volatile var quality = VideoQuality.DEFAULT
  @Volatile var fps = 30
  @Volatile var micEnabled = true

  private val videoWidth: Int get() = VideoQuality.size(quality).let { if (isLandscape) it.first else it.second }
  private val videoHeight: Int get() = VideoQuality.size(quality).let { if (isLandscape) it.second else it.first }
  private val frameIntervalNs: Long get() = 1_000_000_000L / fps

  // Frames that reached the muxer during the last recording (dry run or real).
  @Volatile private var writtenFrames = 0
  @Volatile private var firstPtsUs = -1L
  @Volatile private var lastPtsUs = -1L

  // Overlay state (updated from JS thread)
  var overlayState = OverlayState()
  val stateLock = Object()

  @Volatile var useFrontCamera = false
  private var overlayRenderer: OverlayRenderer? = null

  // Sub-components
  private var eglCore: EglCore? = null
  private var renderer: CameraTextureRenderer? = null
  private var cameraController: CameraController? = null
  private var videoEncoder: VideoEncoder? = null
  private var audioEncoder: AudioEncoder? = null
  private var muxer: VideoMuxer? = null

  // GL pipeline
  private var glThread: HandlerThread? = null
  private var glHandler: Handler? = null
  private var cameraSurfaceTexture: SurfaceTexture? = null
  private var cameraSurface: Surface? = null

  // EGL surfaces
  private var eglPreviewSurface: EGLSurface = EGL14.EGL_NO_SURFACE
  private var eglEncoderSurface: EGLSurface = EGL14.EGL_NO_SURFACE

  // Preview
  private var previewSurface: Surface? = null

  // Recording state
  private val isRecording = AtomicBoolean(false)

  fun isRecordingActive(): Boolean = isRecording.get()
  private var recordingStartNanos = 0L
  private var outputPath: String? = null
  private var hasAudio = true

  // View reference
  var hostView: WeakReference<RealtimeRecorderHostView>? = null
  private var readyCallback: (() -> Unit)? = null
  private val sessionActive = AtomicBoolean(false)
  private val setupLock = Object()

  // Render loop
  private val frameAvailable = AtomicBoolean(false)
  private val renderLoopRunning = AtomicBoolean(false)

  // Overlay bitmap cache
  private var lastOverlayState: OverlayState? = null
  private var overlayBitmap: Bitmap? = null
  private var overlayDirty = AtomicBoolean(false)

  // Encoder drain thread — keeps GL thread free
  private var drainThread: HandlerThread? = null
  private var drainHandler: Handler? = null

  // Context ref for foreground service
  private var appContext: WeakReference<Context>? = null

  fun setReadyCallback(cb: (() -> Unit)?) {
    readyCallback = cb
  }

  // ================================================================
  //  SESSION SETUP
  // ================================================================

  fun setupSession(context: Context) {
    synchronized(setupLock) {
      if (sessionActive.get()) {
        Log.i(TAG, "Releasing previous session before setup")
        releaseSessionInternal()
      }

      appContext = WeakReference(context)

      if (overlayRenderer == null) {
        try {
          overlayRenderer = OverlayRenderer(context)
        } catch (e: Exception) {
          Log.e(TAG, "OverlayRenderer init failed", e)
        }
      }

      sessionActive.set(true)
    }

    initGLAndBindCamera(context)
  }

  fun releaseSession() {
    synchronized(setupLock) {
      releaseSessionInternal()
    }
  }

  private fun releaseSessionInternal() {
    sessionActive.set(false)
    renderLoopRunning.set(false)

    cameraController?.closeCamera()
    cameraController = null

    // Capture local refs BEFORE posting — prevents race condition on camera switch
    val oldHandler = glHandler
    val oldThread = glThread
    glHandler = null
    glThread = null

    if (oldHandler != null) {
      val latch = CountDownLatch(1)
      oldHandler.post {
        releaseGL()
        latch.countDown()
      }
      latch.await(2, TimeUnit.SECONDS)
      oldThread?.quitSafely()
    } else {
      releaseGL()
    }

    Log.i(TAG, "Session released")
  }

  // ================================================================
  //  GL + CAMERA INIT
  // ================================================================

  private fun initGLAndBindCamera(context: Context) {
    if (!sessionActive.get()) return

    glThread = HandlerThread("GLVideoThread").apply { start() }
    glHandler = Handler(glThread!!.looper)

    glHandler?.post {
      try {
        initEGL()
        initPreviewSurface()
        initRenderer()
        openCamera(context)
        startRenderLoop()
      } catch (e: Exception) {
        Log.e(TAG, "GL + Camera init failed", e)
        releaseGL()
      }
    }
  }

  private fun initEGL() {
    eglCore = EglCore().apply { initialize() }
    Log.i(TAG, "EGL initialized")
  }

  private fun initPreviewSurface() {
    val view = hostView?.get() ?: return
    val textureView = view.textureView

    if (textureView.isAvailable) {
      createPreviewEGLSurface(Surface(textureView.surfaceTexture))
    }

    textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
      override fun onSurfaceTextureAvailable(st: SurfaceTexture, w: Int, h: Int) {
        glHandler?.post { createPreviewEGLSurface(Surface(st)) }
      }
      override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {}
      override fun onSurfaceTextureDestroyed(st: SurfaceTexture): Boolean {
        glHandler?.post { destroyPreviewEGLSurface() }
        return true
      }
      override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
    }
  }

  private fun createPreviewEGLSurface(surface: Surface) {
    destroyPreviewEGLSurface()
    previewSurface = surface
    eglPreviewSurface = eglCore?.createWindowSurface(surface) ?: EGL14.EGL_NO_SURFACE
    Log.i(TAG, "Preview EGLSurface created")
  }

  private fun destroyPreviewEGLSurface() {
    if (eglPreviewSurface != EGL14.EGL_NO_SURFACE) {
      eglPreviewSurface = eglCore?.destroySurface(eglPreviewSurface) ?: EGL14.EGL_NO_SURFACE
    }
    previewSurface?.release()
    previewSurface = null
  }

  private fun initRenderer() {
    renderer = CameraTextureRenderer().apply { initialize(videoWidth, videoHeight) }

    cameraSurfaceTexture = SurfaceTexture(renderer!!.cameraTextureId).apply {
      setDefaultBufferSize(videoWidth, videoHeight)
      setOnFrameAvailableListener { frameAvailable.set(true) }
    }
    cameraSurface = Surface(cameraSurfaceTexture)

    Log.i(TAG, "Renderer + SurfaceTexture initialized")
  }

  /** Current display rotation in degrees (0/90/180/270), read from WindowManager. */
  private fun currentDisplayRotationDegrees(): Int {
    val ctx = appContext?.get() ?: return 0
    return try {
      val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return 0
      @Suppress("DEPRECATION")
      when (wm.defaultDisplay.rotation) {
        Surface.ROTATION_90 -> 90
        Surface.ROTATION_180 -> 180
        Surface.ROTATION_270 -> 270
        else -> 0
      }
    } catch (e: Exception) { 0 }
  }

  private fun openCamera(context: Context) {
    val handler = glHandler ?: return

    cameraController = CameraController().apply {
      onCameraOpened = {
        Log.i(TAG, "Camera opened (front=$useFrontCamera)")
        val ctx = appContext?.get()
        if (ctx != null) {
          // Notify JS on main thread
          android.os.Handler(android.os.Looper.getMainLooper()).post {
            readyCallback?.invoke()
          }
        }
      }
      onCameraError = { e ->
        Log.e(TAG, "Camera error", e)
      }
    }

    val st = cameraSurfaceTexture ?: return
    cameraController?.openCamera(context, useFrontCamera, st, handler, isLandscape, quality, fps)
  }

  // ================================================================
  //  RENDER LOOP (30 FPS)
  // ================================================================

  private fun startRenderLoop() {
    renderLoopRunning.set(true)
    renderFrame()
    Log.i(TAG, "Render loop started")
  }

  private fun renderFrame() {
    if (!renderLoopRunning.get()) return
    val frameStart = System.nanoTime()

    try {
      if (frameAvailable.getAndSet(false)) {
        cameraSurfaceTexture?.updateTexImage()
      }

      val texMatrix = FloatArray(16)
      cameraSurfaceTexture?.getTransformMatrix(texMatrix)

      // Detect if the texture matrix already includes a horizontal mirror.
      // Camera2 front cameras on some devices (OnePlus, Samsung, etc.) include
      // a reflection in getTransformMatrix(). The 2D determinant tells us:
      // negative → transform includes a mirror/reflection.
      val isFront = cameraController?.isFrontFacing ?: useFrontCamera
      val texDet = texMatrix[0] * texMatrix[5] - texMatrix[4] * texMatrix[1]
      val texAlreadyMirrored = texDet < 0
      val mirror = if (isFront) !texAlreadyMirrored else false

      updateOverlayBitmap()

      val rotationDeg = currentDisplayRotationDegrees()
      val camBufW = cameraController?.bufferWidth ?: 0
      val camBufH = cameraController?.bufferHeight ?: 0

      // --- Render to preview surface (NO overlay — RN draws its own UI) ---
      if (eglPreviewSurface != EGL14.EGL_NO_SURFACE) {
        eglCore?.makeCurrent(eglPreviewSurface)
        val view = hostView?.get()
        val pw = view?.textureView?.width ?: videoWidth
        val ph = view?.textureView?.height ?: videoHeight
        renderer?.drawFrame(texMatrix, mirror, drawOverlay = false,
          viewportWidth = pw, viewportHeight = ph,
          displayRotationDegrees = rotationDeg,
          cameraBufferWidth = camBufW, cameraBufferHeight = camBufH)
        eglCore?.swapBuffers(eglPreviewSurface)
      }

      // --- Render to encoder surface (WITH overlay burned in) ---
      if (isRecording.get() && eglEncoderSurface != EGL14.EGL_NO_SURFACE) {
        eglCore?.makeCurrent(eglEncoderSurface)
        renderer?.drawFrame(texMatrix, mirror, drawOverlay = true,
          displayRotationDegrees = rotationDeg,
          cameraBufferWidth = camBufW, cameraBufferHeight = camBufH)

        val ptsNanos = System.nanoTime() - recordingStartNanos
        eglCore?.setPresentationTime(eglEncoderSurface, ptsNanos)
        eglCore?.swapBuffers(eglEncoderSurface)

        // Drain encoder on a separate thread to keep GL thread free
        drainHandler?.post { drainVideoEncoder(false) }
      }
    } catch (e: Exception) {
      Log.e(TAG, "renderFrame error", e)
    }

    val elapsed = System.nanoTime() - frameStart
    val delayMs = maxOf(1L, (frameIntervalNs - elapsed) / 1_000_000)
    glHandler?.postDelayed({ renderFrame() }, delayMs)
  }

  private fun updateOverlayBitmap() {
    val state: OverlayState
    synchronized(stateLock) {
      state = overlayState.copy()
    }

    if (state == lastOverlayState) return
    lastOverlayState = state

    val or = overlayRenderer ?: return

    // Render overlay at half resolution — GPU upscales via linear filtering.
    // Cuts eraseColor + glTexSubImage2D cost by 4× (8MB → 2MB) with no visible loss
    // (overlay is just text + icons with shadows).
    val overlayW = videoWidth / 2
    val overlayH = videoHeight / 2

    // Reuse the same bitmap — allocate only once
    var bmp = overlayBitmap
    if (bmp == null || bmp.width != overlayW || bmp.height != overlayH) {
      bmp?.recycle()
      bmp = Bitmap.createBitmap(overlayW, overlayH, Bitmap.Config.ARGB_8888)
      overlayBitmap = bmp
    } else {
      bmp.eraseColor(android.graphics.Color.TRANSPARENT)
    }

    or.render(bmp, state)
    overlayDirty.set(true)
    renderer?.updateOverlayTexture(bmp)
  }

  // ================================================================
  //  RECORDING
  // ================================================================

  fun startRecording(path: String): Boolean {
    if (isRecording.get()) {
      Log.w(TAG, "Already recording")
      return false
    }

    outputPath = path
    try { File(path).delete() } catch (_: Exception) {}

    try {
      // 1. Video encoder (landscape swaps dimensions)
      videoEncoder = VideoEncoder().apply {
        configure(width = videoWidth, height = videoHeight, bitrate = VideoQuality.bitrate(quality), fps = fps)
      }
      writtenFrames = 0
      firstPtsUs = -1L
      lastPtsUs = -1L

      // 2. Muxer
      muxer = VideoMuxer()

      // 3. Audio encoder (optional; never touches the mic when it is off)
      hasAudio = micEnabled
      audioEncoder = if (!micEnabled) null else try {
        AudioEncoder().apply { configure() }
      } catch (e: Exception) {
        Log.w(TAG, "Audio encoder setup failed, recording without audio", e)
        hasAudio = false
        null
      }

      muxer?.initialize(path, hasAudio)

      // Wire audio encoder callbacks to muxer
      audioEncoder?.onOutputFormat = { format ->
        muxer?.addAudioTrack(format)
      }
      audioEncoder?.onOutputData = { buffer, info ->
        val m = muxer
        if (m != null) {
          m.writeSampleData(m.audioTrackIndex, buffer, info)
        }
      }

      // Wire video encoder callbacks to muxer
      // (called from drainVideoEncoder on GL thread)

      // 4. Start encoder drain thread
      drainThread = HandlerThread("EncoderDrainThread").apply { start() }
      drainHandler = Handler(drainThread!!.looper)

      // 5. Create encoder EGLSurface on GL thread
      val latch = CountDownLatch(1)
      glHandler?.post {
        try {
          val encoderInputSurface = videoEncoder?.inputSurface
            ?: throw RuntimeException("No encoder input surface")
          eglEncoderSurface = eglCore?.createWindowSurface(encoderInputSurface)
            ?: throw RuntimeException("createWindowSurface for encoder failed")
          videoEncoder?.start()
          Log.i(TAG, "Encoder EGLSurface created")
        } catch (e: Exception) {
          Log.e(TAG, "Encoder surface creation failed", e)
        }
        latch.countDown()
      }
      latch.await(2, TimeUnit.SECONDS)

      // 6. Start recording
      isRecording.set(true)
      recordingStartNanos = System.nanoTime()

      if (hasAudio) {
        audioEncoder?.start(recordingStartNanos)
      }

      setKeepScreenOn(true)
      startForegroundService()

      Log.i(TAG, "Recording started → $path (audio=$hasAudio)")
      return true
    } catch (e: Exception) {
      Log.e(TAG, "Failed to start recording", e)
      cleanupRecording()
      return false
    }
  }

  private val drainLock = Object()

  private fun drainVideoEncoder(endOfStream: Boolean) {
    synchronized(drainLock) {
      videoEncoder?.drainOutput(
        endOfStream = endOfStream,
        onFormat = { format ->
          muxer?.addVideoTrack(format)
        },
        onData = { buffer, info ->
          val m = muxer ?: return@drainOutput
          m.writeSampleData(m.videoTrackIndex, buffer, info)
          if (m.isStarted()) {
            writtenFrames++
            if (firstPtsUs < 0) firstPtsUs = info.presentationTimeUs
            lastPtsUs = info.presentationTimeUs
          }
        }
      )
    }
  }

  // ================================================================
  //  STOP RECORDING
  // ================================================================

  fun stopRecording(callback: (Result<String>) -> Unit) {
    if (!isRecording.getAndSet(false)) {
      callback(Result.failure(Exception("Not recording")))
      return
    }

    setKeepScreenOn(false)

    Thread {
      try {
        // 1. Stop audio
        audioEncoder?.stop()

        // 2. Signal EOS on GL thread, then drain on drain thread
        val signalLatch = CountDownLatch(1)
        glHandler?.post {
          try {
            if (eglEncoderSurface != EGL14.EGL_NO_SURFACE) {
              eglCore?.makeCurrent(eglEncoderSurface)
              videoEncoder?.signalEndOfInputStream()
              eglEncoderSurface = eglCore?.destroySurface(eglEncoderSurface) ?: EGL14.EGL_NO_SURFACE
            }
          } catch (_: Exception) {}
          signalLatch.countDown()
        } ?: signalLatch.countDown()
        signalLatch.await(2, TimeUnit.SECONDS)

        // Final drain on drain thread (blocking)
        val drainLatch = CountDownLatch(1)
        val dh = drainHandler
        if (dh != null) {
          dh.post {
            drainVideoEncoder(true)
            drainLatch.countDown()
          }
          drainLatch.await(3, TimeUnit.SECONDS)
        } else {
          drainVideoEncoder(true)
        }

        // 3. Stop encoders
        videoEncoder?.stop()

        // 4. Stop muxer
        muxer?.stop()

        // 5. Release
        videoEncoder?.release()
        videoEncoder = null
        audioEncoder?.release()
        audioEncoder = null
        muxer = null

        // 6. Stop drain thread
        drainThread?.quitSafely()
        drainThread = null
        drainHandler = null

        stopForegroundService()

        val path = outputPath ?: ""
        Log.i(TAG, "Recording stopped: $path")
        callback(Result.success("file://$path"))
      } catch (e: Exception) {
        Log.e(TAG, "Stop recording error", e)
        callback(Result.failure(e))
      }
    }.start()
  }

  // ================================================================
  //  QUALITY (R6c)
  // ================================================================

  /** (frames expected from the first to the last muxed frame, frames muxed). */
  fun lastRecordingStats(): Pair<Int, Int> {
    val expected = if (firstPtsUs < 0) 0
      else ((lastPtsUs - firstPtsUs) * fps / 1_000_000L).toInt() + 1
    return expected to writtenFrames
  }

  /** Qualities of the front and back cameras (camera sizes x AVC encoder). */
  fun supportedQualities(context: Context): Map<String, List<String>> {
    val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    return mapOf("front" to true, "back" to false).mapValues { (_, front) ->
      try {
        val id = CameraController.chooseCameraId(manager, front) ?: return@mapValues BASIC_QUALITIES
        VideoQuality.supported(CameraController.outputSizes(manager.getCameraCharacteristics(id))) { w, h -> encoderSupports(w, h) }
      } catch (e: Exception) {
        Log.w(TAG, "supportedQualities failed", e)
        BASIC_QUALITIES
      }
    }
  }

  private val BASIC_QUALITIES = listOf("720p", "1080p")

  private fun encoderSupports(w: Int, h: Int): Boolean =
    MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.any { info ->
      info.isEncoder && info.supportedTypes.any { it.equals(MediaFormat.MIMETYPE_VIDEO_AVC, ignoreCase = true) } &&
        try {
          info.getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC)
            .videoCapabilities?.areSizeAndRateSupported(w, h, 30.0) == true
        } catch (_: Exception) { false }
    }

  private fun isHot(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
    val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
    return pm.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE
  }

  /**
   * Settles the quality before recording: highest one the current camera
   * supports, 1080p when the phone is hot, and above 1080p a 1.5 s dry run
   * through the real pipeline (overlay included) that steps down while fewer
   * than 90 % of the frames reach the file. Blocking — call off the main thread.
   * Returns (applied quality, reason or null).
   */
  fun prepareQuality(context: Context): Pair<String, String?> {
    val requested = quality
    val supported = supportedQualities(context)[if (useFrontCamera) "front" else "back"] ?: BASIC_QUALITIES

    var q = VideoQuality.clamp(requested, supported)
    var reason: String? = if (q != requested) "camera" else null
    if (VideoQuality.isAbove1080(q) && isHot(context)) { q = VideoQuality.DEFAULT; reason = "thermal" }

    while (VideoQuality.isAbove1080(q)) {
      quality = q
      if (dryRunKeepsUp(context)) break
      q = VideoQuality.lower(q) ?: VideoQuality.DEFAULT
      reason = "performance"
    }
    val reopen = quality != q || VideoQuality.isAbove1080(requested)
    quality = q
    // Reopen the camera at the settled size for the preview and the real recording.
    if (reopen) reopenAndWait(context)
    Log.i(TAG, "prepareQuality requested=$requested applied=$q reason=$reason")
    return q to reason
  }

  private fun reopenAndWait(context: Context): Boolean {
    val latch = CountDownLatch(1)
    setReadyCallback { latch.countDown() }
    setupSession(context)
    val ok = latch.await(10, TimeUnit.SECONDS)
    setReadyCallback(null)
    return ok
  }

  private fun dryRunKeepsUp(context: Context): Boolean {
    if (!reopenAndWait(context)) return false
    val file = File(context.cacheDir, "realtime_recorder_dry_run.mp4")
    // Video only: the dry run never opens the mic.
    val mic = micEnabled
    micEnabled = false
    try {
      if (!startRecording(file.absolutePath)) return false
      Thread.sleep(DRY_RUN_MS)
      val done = CountDownLatch(1)
      stopRecording { done.countDown() }
      done.await(5, TimeUnit.SECONDS)
    } finally {
      micEnabled = mic
    }
    file.delete()
    val (expected, written) = lastRecordingStats()
    Log.i(TAG, "dry run $quality: $written/$expected frames")
    return VideoQuality.keepsUp(written, expected)
  }

  // ================================================================
  //  GL CLEANUP
  // ================================================================

  private fun releaseGL() {
    try { renderer?.release() } catch (_: Exception) {}
    renderer = null

    try { cameraSurface?.release() } catch (_: Exception) {}
    cameraSurface = null
    try { cameraSurfaceTexture?.release() } catch (_: Exception) {}
    cameraSurfaceTexture = null

    destroyPreviewEGLSurface()

    if (eglEncoderSurface != EGL14.EGL_NO_SURFACE) {
      eglEncoderSurface = eglCore?.destroySurface(eglEncoderSurface) ?: EGL14.EGL_NO_SURFACE
    }

    overlayBitmap?.recycle()
    overlayBitmap = null
    lastOverlayState = null

    eglCore?.release()
    eglCore = null

    Log.i(TAG, "GL resources released")
  }

  // ================================================================
  //  FOREGROUND SERVICE
  // ================================================================

  private fun startForegroundService() {
    val ctx = appContext?.get() ?: return
    try {
      val intent = Intent(ctx, RecordingForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
    } catch (e: Exception) {
      Log.w(TAG, "Failed to start foreground service", e)
    }
  }

  private fun stopForegroundService() {
    val ctx = appContext?.get() ?: return
    try {
      val intent = Intent(ctx, RecordingForegroundService::class.java)
      ctx.stopService(intent)
    } catch (e: Exception) {
      Log.w(TAG, "Failed to stop foreground service", e)
    }
  }

  // ================================================================
  //  HELPERS
  // ================================================================

  private fun setKeepScreenOn(on: Boolean) {
    val view = hostView?.get() ?: return
    val activity = view.context as? android.app.Activity ?: return
    activity.runOnUiThread {
      if (on) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }
  }

  private fun cleanupRecording() {
    isRecording.set(false)
    audioEncoder?.release()
    audioEncoder = null
    videoEncoder?.release()
    videoEncoder = null
    muxer?.stop()
    muxer = null
    drainThread?.quitSafely()
    drainThread = null
    drainHandler = null
    stopForegroundService()
  }
}
