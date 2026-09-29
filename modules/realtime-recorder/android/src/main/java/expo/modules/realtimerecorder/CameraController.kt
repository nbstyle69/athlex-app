package expo.modules.realtimerecorder

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.SurfaceTexture
import android.hardware.camera2.*
import android.os.Handler
import android.util.Log
import android.util.Range
import android.view.Surface
import androidx.core.content.ContextCompat

/**
 * Camera2 API controller.
 *
 * Opens the camera, creates a capture session targeting the provided
 * [SurfaceTexture] (for the GL pipeline) and an optional preview [Surface],
 * and uses [CameraDevice.TEMPLATE_RECORD] for higher-quality capture.
 */
class CameraController {

  companion object {
    private const val TAG = "CameraController"

    /** First camera with the requested facing (fallback: the first camera). */
    fun chooseCameraId(manager: CameraManager, useFront: Boolean): String? {
      val targetLensFacing = if (useFront) {
        CameraCharacteristics.LENS_FACING_FRONT
      } else {
        CameraCharacteristics.LENS_FACING_BACK
      }

      for (id in manager.cameraIdList) {
        val chars = manager.getCameraCharacteristics(id)
        val facing = chars.get(CameraCharacteristics.LENS_FACING)
        if (facing == targetLensFacing) return id
      }

      // Fallback: return first available camera
      return manager.cameraIdList.firstOrNull()
    }

    /** SurfaceTexture output sizes of a camera (no permission needed). */
    fun outputSizes(characteristics: CameraCharacteristics): List<Pair<Int, Int>> =
      characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        ?.getOutputSizes(SurfaceTexture::class.java)
        ?.map { it.width to it.height }
        ?: emptyList()
  }

  private var cameraDevice: CameraDevice? = null
  private var captureSession: CameraCaptureSession? = null
  private var currentCameraId: String? = null
  @Volatile var isFrontFacing = false; private set

  // Actual buffer dimensions the camera was configured with. Exposed so the
  // renderer can compare against the preview viewport aspect and apply a
  // rotation if they mismatch (e.g. portrait buffer on landscape viewport).
  var bufferWidth = 1080; private set
  var bufferHeight = 1920; private set

  var onCameraOpened: (() -> Unit)? = null
  var onCameraError: ((Exception) -> Unit)? = null

  /**
   * Open the camera and start a repeating capture request.
   *
   * @param context         application context
   * @param useFront        true for front-facing camera
   * @param surfaceTexture  GL pipeline target (must have defaultBufferSize set)
   * @param handler         handler on the GL thread for callbacks
   */
  fun openCamera(
    context: Context,
    useFront: Boolean,
    surfaceTexture: SurfaceTexture,
    handler: Handler,
    isLandscape: Boolean = false,
    quality: String = VideoQuality.DEFAULT,
    fps: Int = 30
  ) {
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
        != PackageManager.PERMISSION_GRANTED) {
      onCameraError?.invoke(SecurityException("CAMERA permission not granted"))
      return
    }

    val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    val cameraId = chooseCameraId(manager, useFront)
    if (cameraId == null) {
      onCameraError?.invoke(RuntimeException("No suitable camera found (front=$useFront)"))
      return
    }

    isFrontFacing = useFront
    currentCameraId = cameraId

    // Pick best resolution for the SurfaceTexture (orientation-aware)
    val characteristics = manager.getCameraCharacteristics(cameraId)
    val (bestW, bestH) = VideoQuality.bufferSize(outputSizes(characteristics), quality, isLandscape)
    surfaceTexture.setDefaultBufferSize(bestW, bestH)
    bufferWidth = bestW
    bufferHeight = bestH
    Log.i(TAG, "Camera $cameraId selected, output size: ${bestW}x${bestH} (quality=$quality, landscape=$isLandscape)")

    try {
      manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
          cameraDevice = camera
          Log.i(TAG, "Camera opened: $cameraId")
          createCaptureSession(camera, surfaceTexture, handler, context, fps)
        }

        override fun onDisconnected(camera: CameraDevice) {
          Log.w(TAG, "Camera disconnected")
          camera.close()
          cameraDevice = null
        }

        override fun onError(camera: CameraDevice, error: Int) {
          Log.e(TAG, "Camera error: $error")
          camera.close()
          cameraDevice = null
          onCameraError?.invoke(RuntimeException("Camera2 error code=$error"))
        }
      }, handler)
    } catch (e: SecurityException) {
      onCameraError?.invoke(e)
    }
  }

  private fun createCaptureSession(
    camera: CameraDevice,
    surfaceTexture: SurfaceTexture,
    handler: Handler,
    context: Context? = null,
    fps: Int = 30
  ) {
    val glSurface = Surface(surfaceTexture)
    val targets = listOf(glSurface)

    try {
      camera.createCaptureSession(targets, object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(session: CameraCaptureSession) {
          captureSession = session

          val fpsRange = chooseBestFpsRange(context, camera.id, fps)
          val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
            addTarget(glSurface)
            set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO)
            set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
            set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
            set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, fpsRange)
          }

          try {
            session.setRepeatingRequest(request.build(), null, handler)
            Log.i(TAG, "Capture session configured with TEMPLATE_RECORD")
            onCameraOpened?.invoke()
          } catch (e: CameraAccessException) {
            Log.e(TAG, "setRepeatingRequest failed", e)
            onCameraError?.invoke(e)
          }
        }

        override fun onConfigureFailed(session: CameraCaptureSession) {
          Log.e(TAG, "Capture session configuration failed")
          onCameraError?.invoke(RuntimeException("CaptureSession configuration failed"))
        }
      }, handler)
    } catch (e: CameraAccessException) {
      Log.e(TAG, "createCaptureSession failed", e)
      onCameraError?.invoke(e)
    }
  }

  /** Close the camera device and capture session. */
  fun closeCamera() {
    try { captureSession?.close() } catch (_: Exception) {}
    captureSession = null
    try { cameraDevice?.close() } catch (_: Exception) {}
    cameraDevice = null
    currentCameraId = null
    Log.i(TAG, "Camera closed")
  }

  // ================================================================
  //  Camera selection helpers
  // ================================================================

  /**
   * Pick the best FPS range from device capabilities.
   * Prefers [fps,fps], then any range whose upper is fps, then any range
   * containing fps (the GL loop paces the frames), then the highest available.
   */
  private fun chooseBestFpsRange(context: Context?, cameraId: String, fps: Int = 30): Range<Int> {
    val fallback = Range(24, 30)
    if (context == null) return fallback
    try {
      val mgr = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
      val chars = mgr.getCameraCharacteristics(cameraId)
      val ranges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
        ?: return fallback

      // 1. Exact [fps,fps]
      ranges.find { it.lower == fps && it.upper == fps }?.let {
        Log.i(TAG, "FPS range: [$fps,$fps]")
        return it
      }
      // 2. Any range whose upper is fps (e.g. [15,30], [24,30])
      val upperIsFps = ranges.filter { it.upper == fps }
        .maxByOrNull { it.lower }
      if (upperIsFps != null) {
        Log.i(TAG, "FPS range: [${upperIsFps.lower},${upperIsFps.upper}]")
        return upperIsFps
      }
      // 3. Any range containing fps
      ranges.filter { fps in it.lower..it.upper }.minByOrNull { it.upper }?.let {
        Log.i(TAG, "FPS range: [${it.lower},${it.upper}] (contains $fps)")
        return it
      }
      // 4. Highest upper FPS
      val best = ranges.maxByOrNull { it.upper }
      if (best != null) {
        Log.i(TAG, "FPS range fallback: [${best.lower},${best.upper}]")
        return best
      }
    } catch (e: Exception) {
      Log.w(TAG, "Failed to query FPS ranges", e)
    }
    return fallback
  }
}
