package expo.modules.realtimerecorder

/**
 * Video quality rules (R6c), free of Android types so they run in JVM unit tests.
 * Qualities: "720p", "1080p", "2k", "4k" — default "1080p" (the former fixed size).
 */
object VideoQuality {
  val ORDER = listOf("720p", "1080p", "2k", "4k")
  const val DEFAULT = "1080p"

  /** Landscape encoder size. */
  fun size(q: String): Pair<Int, Int> = when (q) {
    "720p" -> 1280 to 720
    "2k" -> 2560 to 1440
    "4k" -> 3840 to 2160
    else -> 1920 to 1080
  }

  /** 1080p keeps the former 6 Mb/s. */
  fun bitrate(q: String): Int = when (q) {
    "720p" -> 4_000_000
    "2k" -> 10_000_000
    "4k" -> 20_000_000
    else -> 6_000_000
  }

  fun isAbove1080(q: String) = q == "2k" || q == "4k"

  fun lower(q: String): String? = ORDER.getOrNull(ORDER.indexOf(q) - 1)

  /**
   * Qualities a camera can record: 720p and 1080p always (the GL pass scales,
   * as before), 2K / 4K only if the camera delivers at least that size and the
   * encoder accepts it in both orientations.
   */
  fun supported(cameraSizes: List<Pair<Int, Int>>, encoderSupports: (Int, Int) -> Boolean): List<String> =
    ORDER.filter { q ->
      if (!isAbove1080(q)) return@filter true
      val (w, h) = size(q)
      cameraSizes.any { (cw, ch) -> maxOf(cw, ch) >= w && minOf(cw, ch) >= h } &&
        encoderSupports(w, h) && encoderSupports(h, w)
    }

  /** Highest supported quality not above the requested one ("1080p" as last resort). */
  fun clamp(requested: String, supported: List<String>): String {
    var q: String? = if (requested in ORDER) requested else DEFAULT
    while (q != null && q !in supported) q = lower(q)
    return q ?: DEFAULT
  }

  /**
   * Camera buffer size for a quality. For 1080p this is exactly the former
   * choice: preferred orientation, then the opposite one, then the largest
   * size whose long side fits. 2K falls back to a 4K buffer (scaled by GL).
   */
  fun bufferSize(sizes: List<Pair<Int, Int>>, q: String, landscape: Boolean): Pair<Int, Int> {
    val (lw, lh) = size(q)
    val preferred = if (landscape) lw to lh else lh to lw
    if (sizes.isEmpty()) return preferred
    sizes.find { it == preferred }?.let { return it }
    sizes.find { it == preferred.second to preferred.first }?.let { return it }
    if (q == "2k") {
      val (fw, fh) = size("4k")
      sizes.find { it == (if (landscape) fw to fh else fh to fw) }?.let { return it }
      sizes.find { it == (if (landscape) fh to fw else fw to fh) }?.let { return it }
    }
    return sizes
      .filter { maxOf(it.first, it.second) <= lw }
      .maxByOrNull { it.first.toLong() * it.second.toLong() }
      ?: sizes.first()
  }

  /** Dry run verdict: at least 90 % of the expected frames reached the file. */
  fun keepsUp(writtenFrames: Int, expectedFrames: Int): Boolean =
    expectedFrames > 0 && writtenFrames * 10 >= expectedFrames * 9
}
