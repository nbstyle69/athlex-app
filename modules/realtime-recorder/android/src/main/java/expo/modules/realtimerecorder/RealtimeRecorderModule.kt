package expo.modules.realtimerecorder

import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class RealtimeRecorderModule : Module() {

  companion object {
    private const val TAG = "RealtimeRecorder"
  }

  private val engine: VideoRecorderEngine get() = VideoRecorderEngine.shared

  override fun definition() = ModuleDefinition {
    Name("RealtimeRecorder")

    Function("updateOverlayState") { dict: Map<String, Any?> ->
      try {
        synchronized(engine.stateLock) {
          (dict["timerType"] as? String)?.let { engine.overlayState.timerType = it }
          (dict["timerDisplay"] as? String)?.let { engine.overlayState.timerDisplay = it }
          (dict["title"] as? String)?.let { engine.overlayState.title = it }
          (dict["timestamp"] as? String)?.let { engine.overlayState.timestamp = it }
          (dict["isRecording"] as? Boolean)?.let { engine.overlayState.isRecording = it }
          (dict["countdownValue"] as? Double)?.let { engine.overlayState.countdownValue = it.toInt() }
          (dict["showTimer"] as? Boolean)?.let { engine.overlayState.showTimer = it }
          (dict["boxLogoUrl"] as? String)?.let { engine.overlayState.boxLogoUrl = it }
          (dict["competitionLogoUrl"] as? String)?.let { engine.overlayState.competitionLogoUrl = it }
        }
      } catch (e: Exception) {
        Log.e(TAG, "updateOverlayState failed", e)
      }
    }

    AsyncFunction("startRecording") { options: Map<String, Any?>, promise: Promise ->
      try {
        val outputPath = options["outputPath"] as? String ?: ""
        val facing = options["facing"] as? String ?: "back"
        val landscape = options["isLandscape"] as? Boolean ?: false

        if (outputPath.isEmpty()) {
          promise.reject("ERR", "outputPath is required", null)
          return@AsyncFunction
        }

        engine.useFrontCamera = (facing == "front")
        engine.isLandscape = landscape
        applyVideoOptions(options)

        // Clean path (remove file:// prefix if present)
        val cleanPath = if (outputPath.startsWith("file://")) {
          outputPath.removePrefix("file://")
        } else {
          outputPath
        }

        val context = appContext.currentActivity ?: appContext.reactContext ?: run {
          promise.reject("ERR", "No context available", null)
          return@AsyncFunction
        }

        // Ensure session is running
        if (engine.hostView?.get() == null) {
          // Track whether promise has been settled (resolved or rejected)
          val settled = java.util.concurrent.atomic.AtomicBoolean(false)

          engine.setReadyCallback {
            if (settled.getAndSet(true)) return@setReadyCallback
            engine.setReadyCallback(null)
            try {
              val success = engine.startRecording(cleanPath)
              if (success) {
                promise.resolve(null)
              } else {
                promise.reject("ERR", "Failed to start recording", null)
              }
            } catch (e: Exception) {
              Log.e(TAG, "startRecording callback failed", e)
              promise.reject("ERR", e.message ?: "Unknown error", null)
            }
          }

          engine.setupSession(context)

          // Safety timeout: reject if camera never opens (10s)
          android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            if (settled.getAndSet(true)) return@postDelayed
            engine.setReadyCallback(null)
            Log.e(TAG, "Camera ready timeout (10s)")
            promise.reject("ERR", "Camera setup timeout", null)
          }, 10_000)
        } else {
          val success = engine.startRecording(cleanPath)
          if (success) {
            promise.resolve(null)
          } else {
            promise.reject("ERR", "Failed to start recording", null)
          }
        }
      } catch (e: Exception) {
        Log.e(TAG, "startRecording failed", e)
        promise.reject("ERR", e.message ?: "Unknown error", null)
      }
    }

    Function("getSupportedQualities") {
      val context = appContext.reactContext ?: return@Function mapOf(
        "front" to listOf("720p", "1080p"), "back" to listOf("720p", "1080p"))
      engine.supportedQualities(context)
    }

    AsyncFunction("prepareQuality") { options: Map<String, Any?>, promise: Promise ->
      val context = appContext.currentActivity ?: appContext.reactContext ?: run {
        promise.reject("ERR", "No context available", null)
        return@AsyncFunction
      }
      (options["facing"] as? String)?.let { engine.useFrontCamera = (it == "front") }
      applyVideoOptions(options)
      val requested = engine.quality
      // Blocking (camera reopen + dry run): off the JS and main threads.
      Thread {
        try {
          val (applied, reason) = engine.prepareQuality(context)
          promise.resolve(mapOf("requested" to requested, "applied" to applied, "reason" to reason))
        } catch (e: Exception) {
          Log.e(TAG, "prepareQuality failed", e)
          promise.reject("ERR", e.message ?: "Unknown error", e)
        }
      }.start()
    }

    Function("getLastRecordingStats") {
      val (expected, written) = engine.lastRecordingStats()
      mapOf("expectedFrames" to expected, "writtenFrames" to written)
    }

    AsyncFunction("stopRecording") { promise: Promise ->
      try {
        engine.stopRecording { result ->
          result.fold(
            onSuccess = { path -> promise.resolve(path) },
            onFailure = { err -> promise.reject("ERR", err.message ?: "Unknown error", err) }
          )
        }
      } catch (e: Exception) {
        Log.e(TAG, "stopRecording failed", e)
        promise.reject("ERR", e.message ?: "Unknown error", null)
      }
    }

    Function("switchCamera") {
      try {
        val context = appContext.currentActivity ?: appContext.reactContext ?: return@Function null
        engine.useFrontCamera = !engine.useFrontCamera
        engine.setupSession(context)
      } catch (e: Exception) {
        Log.e(TAG, "switchCamera failed", e)
      }
      null
    }

    View(RealtimeRecorderHostView::class) {
      Events("onReady")

      Prop("facing") { view: RealtimeRecorderHostView, facing: String ->
        try {
          val newFront = (facing == "front")
          if (newFront != engine.useFrontCamera) {
            engine.useFrontCamera = newFront
            engine.setupSession(view.context)
          }
        } catch (e: Exception) {
          Log.e(TAG, "Prop facing failed", e)
        }
      }

      Prop("isLandscape") { view: RealtimeRecorderHostView, landscape: Boolean ->
        try {
          if (landscape != engine.isLandscape) {
            // Never tear down the session while recording — the render loop
            // already picks up the live display rotation for correct preview
            // and encoded output orientation.
            if (engine.isRecordingActive()) {
              Log.i(TAG, "Prop isLandscape=$landscape ignored during active recording")
              engine.isLandscape = landscape
            } else {
              engine.isLandscape = landscape
              engine.setupSession(view.context)
            }
          }
        } catch (e: Exception) {
          Log.e(TAG, "Prop isLandscape failed", e)
        }
      }
    }
  }

  /** quality / fps / mic from JS; missing keys keep the defaults (1080p, 30 fps, mic on). */
  private fun applyVideoOptions(options: Map<String, Any?>) {
    engine.quality = (options["quality"] as? String)?.takeIf { it in VideoQuality.ORDER } ?: VideoQuality.DEFAULT
    engine.fps = if ((options["fps"] as? Number)?.toInt() == 25) 25 else 30
    engine.micEnabled = options["mic"] as? Boolean ?: true
  }
}
