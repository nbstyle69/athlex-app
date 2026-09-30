package expo.modules.realtimerecorder

/**
 * Beeps mixed into the video's audio track (R6c). Free of Android types so it
 * runs in JVM unit tests: WAV decoding, level, resampling, timeline placement.
 */
object BeepPcm {
  /** Fixed beep peak in the video, about -6 dBFS. */
  const val LEVEL = 0.5f

  /** 16-bit PCM WAV → (sample rate, mono samples in [-1, 1]); channels are averaged. Null if not PCM 16. */
  fun decodeWav(bytes: ByteArray): Pair<Int, FloatArray>? {
    fun u16(i: Int) = (bytes[i].toInt() and 0xFF) or ((bytes[i + 1].toInt() and 0xFF) shl 8)
    fun u32(i: Int) = u16(i) or (u16(i + 2) shl 16)
    fun tag(i: Int) = String(bytes, i, 4, Charsets.US_ASCII)
    if (bytes.size < 12 || tag(0) != "RIFF" || tag(8) != "WAVE") return null
    var rate = 0
    var channels = 0
    var bits = 0
    var i = 12
    while (i + 8 <= bytes.size) {
      val id = tag(i)
      val size = u32(i + 4)
      val body = i + 8
      if (id == "fmt ") {
        if (u16(body) != 1) return null
        channels = u16(body + 2)
        rate = u32(body + 4)
        bits = u16(body + 14)
      } else if (id == "data") {
        if (bits != 16 || channels < 1 || rate <= 0) return null
        val end = minOf(bytes.size, body + size)
        val frames = (end - body) / (2 * channels)
        val out = FloatArray(frames)
        for (f in 0 until frames) {
          var sum = 0
          for (c in 0 until channels) sum += u16(body + (f * channels + c) * 2).toShort().toInt()
          out[f] = sum / (channels * 32768f)
        }
        return rate to out
      }
      i = body + size + (size and 1)
    }
    return null
  }

  /** Scales so the peak is exactly `peak` (silence stays silent). */
  fun normalize(pcm: FloatArray, peak: Float = LEVEL): FloatArray {
    val max = pcm.maxOfOrNull { kotlin.math.abs(it) } ?: 0f
    if (max == 0f) return pcm.copyOf()
    val g = peak / max
    return FloatArray(pcm.size) { pcm[it] * g }
  }

  /** Linear-interpolation resampling (enough for tones). */
  fun resample(pcm: FloatArray, from: Int, to: Int): FloatArray {
    if (from == to || pcm.isEmpty()) return pcm.copyOf()
    val n = (pcm.size.toLong() * to / from).toInt()
    return FloatArray(n) { k ->
      val x = k.toDouble() * from / to
      val i = x.toInt()
      val t = (x - i).toFloat()
      val a = pcm[minOf(i, pcm.size - 1)]
      val b = pcm[minOf(i + 1, pcm.size - 1)]
      a + (b - a) * t
    }
  }

  /** Sample index reached `elapsedNanos` after the start of the track. */
  fun sampleAt(elapsedNanos: Long, rate: Int): Long = elapsedNanos * rate / 1_000_000_000L
}

/**
 * Beeps waiting to be mixed, placed on the audio track's sample timeline.
 * `add` comes from the JS thread, `mix` from the audio thread.
 */
class BeepSchedule {
  private val beeps = ArrayList<Pair<Long, FloatArray>>()

  @Synchronized fun add(startSample: Long, pcm: FloatArray) {
    beeps.add(startSample to pcm)
  }

  @Synchronized fun pending(): Int = beeps.size

  /**
   * Adds every beep overlapping samples [start, start + count) into
   * dst[offset until offset + count], saturating at 16 bits. Beeps that are
   * fully in the past are dropped.
   */
  @Synchronized fun mix(dst: ShortArray, offset: Int, count: Int, start: Long) {
    val it = beeps.iterator()
    while (it.hasNext()) {
      val (s, pcm) = it.next()
      val end = s + pcm.size
      if (end <= start) { it.remove(); continue }
      val from = maxOf(s, start)
      val to = minOf(end, start + count)
      var k = from
      while (k < to) {
        val i = offset + (k - start).toInt()
        val v = dst[i] + pcm[(k - s).toInt()] * 32767f
        dst[i] = v.coerceIn(-32768f, 32767f).toInt().toShort()
        k++
      }
    }
  }
}
