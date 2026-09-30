package expo.modules.realtimerecorder

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaRecorder
import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Captures PCM audio from the microphone via [AudioRecord] and encodes it
 * to AAC using a [MediaCodec] encoder on a dedicated thread.
 *
 * R6c: scheduled [beeps] are mixed into the PCM before encoding. Without the
 * mic, a synthetic track (silence + beeps) is produced at the recording pace.
 *
 * Encoded buffers and the output format are delivered via callbacks so the
 * caller can forward them to a [VideoMuxer].
 */
class AudioEncoder {

  companion object {
    private const val TAG = "AudioEncoder"
    const val SAMPLE_RATE = 44100
    private const val SYNTH_CHUNK = 1024
    private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    private const val ENCODING = AudioFormat.ENCODING_PCM_16BIT
    private const val AAC_BITRATE = 128_000
  }

  private var audioRecord: AudioRecord? = null
  private var encoder: MediaCodec? = null
  private var captureThread: Thread? = null
  private val recording = AtomicBoolean(false)
  private var useMic = true
  private var startNanos = 0L

  /** Beeps mixed into the track (null = none). */
  @Volatile var beeps: BeepSchedule? = null

  // Total PCM samples (per channel) already queued to the encoder.
  // Used to compute PTS from sample count — guarantees the audio track
  // duration matches the actual audio content regardless of thread timing.
  private var encodedSamples = 0L

  /** Callback for encoded output format (SPS header for AAC). */
  var onOutputFormat: ((MediaFormat) -> Unit)? = null

  /** Callback for each encoded audio buffer. */
  var onOutputData: ((ByteBuffer, MediaCodec.BufferInfo) -> Unit)? = null

  /**
   * Configure the AAC encoder and the AudioRecord source.
   * @throws SecurityException if RECORD_AUDIO permission is missing.
   */
  fun configure(useMic: Boolean = true) {
    this.useMic = useMic
    val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, SAMPLE_RATE, 1).apply {
      setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
      setInteger(MediaFormat.KEY_BIT_RATE, AAC_BITRATE)
    }

    encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC).apply {
      configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      start()
    }

    if (!useMic) {
      Log.i(TAG, "Configured (${SAMPLE_RATE}Hz mono, AAC ${AAC_BITRATE / 1000}kbps, synthetic: no mic)")
      return
    }

    val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, ENCODING) * 2
    audioRecord = AudioRecord(
      MediaRecorder.AudioSource.MIC,
      SAMPLE_RATE, CHANNEL_CONFIG, ENCODING, bufferSize
    )

    if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
      audioRecord?.release()
      audioRecord = null
      encoder?.stop()
      encoder?.release()
      encoder = null
      throw RuntimeException("AudioRecord failed to initialize")
    }

    Log.i(TAG, "Configured (${SAMPLE_RATE}Hz mono, AAC ${AAC_BITRATE / 1000}kbps)")
  }

  /**
   * Start capturing and encoding audio on a background thread.
   * PTS is derived from the cumulative sample count; `recordingStartNanos`
   * paces the synthetic track (no mic).
   */
  fun start(recordingStartNanos: Long) {
    recording.set(true)
    encodedSamples = 0L
    startNanos = recordingStartNanos
    audioRecord?.startRecording()

    captureThread = Thread({
      if (useMic) captureLoop() else syntheticLoop()
    }, "AudioCaptureThread").apply { start() }

    Log.i(TAG, "Started")
  }

  private fun captureLoop() {
    val enc = encoder ?: return
    val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, ENCODING) * 2
    val shorts = ShortArray(bufferSize / 2)
    val pcmBuffer = ByteArray(bufferSize)

    try {
      while (recording.get()) {
        val read = audioRecord?.read(shorts, 0, shorts.size) ?: -1
        if (read > 0) {
          beeps?.mix(shorts, 0, read, encodedSamples)
          toBytes(shorts, read, pcmBuffer)
          feedEncoder(enc, pcmBuffer, read * 2, false)
          drainEncoder(enc, false)
        }
      }

      // Signal end-of-stream with an empty buffer
      feedEncoder(enc, ByteArray(0), 0, true)
      drainEncoder(enc, true)
    } catch (e: Exception) {
      Log.e(TAG, "Capture loop error", e)
    }
  }

  /**
   * Feed PCM bytes to the encoder, looping until every byte has been
   * handed to a MediaCodec input buffer. This prevents silent data loss
   * when the capture buffer (from AudioRecord) is larger than the codec
   * input buffer — which would otherwise cause the audio to play back
   * much faster than recorded because many samples are simply dropped.
   *
   * PTS is derived from [encodedSamples] (sample-accurate) instead of
   * wall-clock time so the MP4 audio track duration always matches the
   * actual PCM content fed to the encoder.
   */
  /** No mic: silence + beeps, fed as fast as the recording clock advances. */
  private fun syntheticLoop() {
    val enc = encoder ?: return
    val chunk = ShortArray(SYNTH_CHUNK)
    val bytes = ByteArray(SYNTH_CHUNK * 2)
    try {
      while (recording.get()) {
        val due = BeepPcm.sampleAt(System.nanoTime() - startNanos, SAMPLE_RATE)
        while (encodedSamples < due && recording.get()) {
          val n = minOf(SYNTH_CHUNK.toLong(), due - encodedSamples).toInt()
          chunk.fill(0, 0, n)
          beeps?.mix(chunk, 0, n, encodedSamples)
          toBytes(chunk, n, bytes)
          val before = encodedSamples
          feedEncoder(enc, bytes, n * 2, false)
          drainEncoder(enc, false)
          if (encodedSamples == before) break // encoder busy: retry on next tick
        }
        Thread.sleep(20)
      }
      feedEncoder(enc, ByteArray(0), 0, true)
      drainEncoder(enc, true)
    } catch (e: Exception) {
      Log.e(TAG, "Synthetic loop error", e)
    }
  }

  private fun toBytes(src: ShortArray, count: Int, dst: ByteArray) {
    ByteBuffer.wrap(dst).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().put(src, 0, count)
  }

  private fun feedEncoder(enc: MediaCodec, data: ByteArray, size: Int, eos: Boolean) {
    // Special case: EOS with no data — just signal end-of-stream.
    if (size == 0 && eos) {
      val index = enc.dequeueInputBuffer(10_000)
      if (index >= 0) {
        val ptsUs = encodedSamples * 1_000_000L / SAMPLE_RATE
        enc.queueInputBuffer(index, 0, 0, ptsUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
      }
      return
    }

    var offset = 0
    while (offset < size) {
      val index = enc.dequeueInputBuffer(10_000)
      if (index < 0) return  // encoder busy — drop this chunk rather than block forever

      val inputBuffer = enc.getInputBuffer(index) ?: return
      inputBuffer.clear()
      val toWrite = minOf(size - offset, inputBuffer.remaining())
      if (toWrite > 0) {
        inputBuffer.put(data, offset, toWrite)
      }

      val ptsUs = encodedSamples * 1_000_000L / SAMPLE_RATE
      encodedSamples += (toWrite / 2)  // 16-bit mono → 2 bytes per sample

      val isLast = (offset + toWrite >= size)
      val flags = if (eos && isLast) MediaCodec.BUFFER_FLAG_END_OF_STREAM else 0
      enc.queueInputBuffer(index, 0, toWrite, ptsUs, flags)

      offset += toWrite
    }
  }

  private fun drainEncoder(enc: MediaCodec, endOfStream: Boolean) {
    val bufferInfo = MediaCodec.BufferInfo()
    val timeoutUs = if (endOfStream) 10_000L else 0L

    var finished = false
    while (!finished) {
      val index = enc.dequeueOutputBuffer(bufferInfo, timeoutUs)
      if (index == MediaCodec.INFO_TRY_AGAIN_LATER) {
        finished = true
      } else if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
        onOutputFormat?.invoke(enc.outputFormat)
      } else if (index >= 0) {
        val buffer = enc.getOutputBuffer(index)
        if (buffer == null) {
          enc.releaseOutputBuffer(index, false)
        } else {
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
            bufferInfo.size = 0
          }

          if (bufferInfo.size > 0) {
            buffer.position(bufferInfo.offset)
            buffer.limit(bufferInfo.offset + bufferInfo.size)
            onOutputData?.invoke(buffer, bufferInfo)
          }

          enc.releaseOutputBuffer(index, false)

          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
            finished = true
          }
        }
      }
    }
  }

  /**
   * Stop capture, signal EOS, wait for the thread to finish, and release.
   */
  fun stop() {
    recording.set(false)
    try { captureThread?.join(3000) } catch (_: Exception) {}
    captureThread = null

    try { audioRecord?.stop() } catch (_: Exception) {}
    try { audioRecord?.release() } catch (_: Exception) {}
    audioRecord = null

    Log.i(TAG, "Stopped")
  }

  fun release() {
    stop()
    try { encoder?.stop() } catch (_: Exception) {}
    try { encoder?.release() } catch (_: Exception) {}
    encoder = null
    onOutputFormat = null
    onOutputData = null
    Log.i(TAG, "Released")
  }
}
