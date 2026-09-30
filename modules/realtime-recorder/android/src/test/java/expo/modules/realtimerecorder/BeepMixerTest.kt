package expo.modules.realtimerecorder

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder

class BeepMixerTest {
  /** Same layout as buildMultiWAV (JS): RIFF, fmt (16), data. */
  private fun wav(samples: ShortArray, rate: Int = 44100, channels: Int = 1, format: Int = 1, bits: Int = 16): ByteArray {
    val data = samples.size * 2
    val b = ByteBuffer.allocate(44 + data).order(ByteOrder.LITTLE_ENDIAN)
    b.put("RIFF".toByteArray()); b.putInt(36 + data); b.put("WAVE".toByteArray())
    b.put("fmt ".toByteArray()); b.putInt(16); b.putShort(format.toShort()); b.putShort(channels.toShort())
    b.putInt(rate); b.putInt(rate * channels * 2); b.putShort((channels * 2).toShort()); b.putShort(bits.toShort())
    b.put("data".toByteArray()); b.putInt(data)
    samples.forEach { b.putShort(it) }
    return b.array()
  }

  @Test fun decodesPcm16Mono() {
    val (rate, pcm) = BeepPcm.decodeWav(wav(shortArrayOf(0, 16384, -32768, 32767)))!!
    assertEquals(44100, rate)
    assertArrayEquals(floatArrayOf(0f, 0.5f, -1f, 32767 / 32768f), pcm, 1e-6f)
  }

  @Test fun averagesStereoAndSkipsUnknownChunks() {
    val (rate, pcm) = BeepPcm.decodeWav(wav(shortArrayOf(16384, 0, -16384, -16384), rate = 48000, channels = 2))!!
    assertEquals(48000, rate)
    assertArrayEquals(floatArrayOf(0.25f, -0.5f), pcm, 1e-6f)
    // A LIST chunk before "data" is skipped.
    val base = wav(shortArrayOf(100))
    val list = "LIST".toByteArray() + byteArrayOf(4, 0, 0, 0) + "INFO".toByteArray()
    val withList = base.copyOfRange(0, 36) + list + base.copyOfRange(36, base.size)
    assertEquals(1, BeepPcm.decodeWav(withList)!!.second.size)
    // An odd-sized chunk is followed by one padding byte (RIFF rule).
    val odd = "junk".toByteArray() + byteArrayOf(3, 0, 0, 0, 1, 2, 3, 0)
    val withOdd = base.copyOfRange(0, 36) + odd + base.copyOfRange(36, base.size)
    assertArrayEquals(floatArrayOf(100 / 32768f), BeepPcm.decodeWav(withOdd)!!.second, 1e-7f)
  }

  @Test fun rejectsNonPcm16() {
    assertNull(BeepPcm.decodeWav(wav(shortArrayOf(1), format = 3)))
    assertNull(BeepPcm.decodeWav(wav(shortArrayOf(1), bits = 8)))
    assertNull(BeepPcm.decodeWav(ByteArray(10)))
    assertNull(BeepPcm.decodeWav("RIFFxxxxWAVE".toByteArray()))
  }

  @Test fun normalizesToMinus6dBFS() {
    assertEquals(0.5f, BeepPcm.LEVEL)
    assertArrayEquals(floatArrayOf(0.25f, -0.5f, 0.125f), BeepPcm.normalize(floatArrayOf(0.5f, -1f, 0.25f)), 1e-6f)
    assertArrayEquals(floatArrayOf(0.5f, -0.25f), BeepPcm.normalize(floatArrayOf(0.2f, -0.1f)), 1e-6f)
    assertArrayEquals(floatArrayOf(0f, 0f), BeepPcm.normalize(floatArrayOf(0f, 0f)), 0f)
  }

  @Test fun resamplesLinearly() {
    val src = floatArrayOf(0f, 1f, 0f, -1f)
    assertArrayEquals(src, BeepPcm.resample(src, 44100, 44100), 0f)
    assertArrayEquals(floatArrayOf(0f, 0.5f, 1f, 0.5f, 0f, -0.5f, -1f, -1f), BeepPcm.resample(src, 22050, 44100), 1e-6f)
    assertArrayEquals(floatArrayOf(0f, 0f), BeepPcm.resample(src, 44100, 22050), 1e-6f)
    // 100 ms at 44.1 kHz → 100 ms at 48 kHz.
    assertEquals(4800, BeepPcm.resample(FloatArray(4410), 44100, 48000).size)
  }

  @Test fun placesBeepsOnTheSampleTimeline() {
    assertEquals(44100L, BeepPcm.sampleAt(1_000_000_000L, 44100))
    assertEquals(3528L, BeepPcm.sampleAt(80_000_000L, 44100)) // 80 ms
    assertEquals(0L, BeepPcm.sampleAt(0L, 48000))
  }

  @Test fun mixesAcrossBuffersSaturatingAndDropsPastBeeps() {
    val s = BeepSchedule()
    s.add(3, floatArrayOf(0.5f, 0.5f, 0.5f, 0.5f)) // samples 3..6
    val a = ShortArray(5) { 100 }
    s.mix(a, 0, 5, 0)                                // buffer 0..4
    assertArrayEquals(shortArrayOf(100, 100, 100, (100 + 16383).toShort(), (100 + 16383).toShort()), a)
    val b = shortArrayOf(30000, -5, 7, 7)
    s.mix(b, 0, 4, 5)                                // buffer 5..8: saturates at 32767
    assertArrayEquals(shortArrayOf(32767, (-5 + 16383).toShort(), 7, 7), b)
    assertEquals(1, s.pending())
    s.mix(ShortArray(2), 0, 2, 9)                    // beep ended at 7: dropped
    assertEquals(0, s.pending())
  }

  @Test fun mixesAtAnOffsetAndSaturatesNegative() {
    val s = BeepSchedule()
    s.add(10, floatArrayOf(-1f, -1f))
    val dst = ShortArray(6) { -30000 }
    s.mix(dst, 2, 3, 9)                              // dst[2..4] = samples 9..11
    assertArrayEquals(shortArrayOf(-30000, -30000, -30000, -32768, -32768, -30000), dst)
  }

  @Test fun futureBeepsWaitAndOverlappingBeepsAdd() {
    val s = BeepSchedule()
    s.add(100, floatArrayOf(0.1f))
    s.add(0, floatArrayOf(0.1f, 0.1f))
    s.add(1, floatArrayOf(0.1f))
    val dst = ShortArray(3)
    s.mix(dst, 0, 3, 0)
    assertArrayEquals(shortArrayOf(3276, 6552, 0), dst)
    assertEquals(3, s.pending())                     // dropped only once fully in the past
    s.mix(ShortArray(3), 0, 3, 2)                    // both end exactly at 2: dropped now
    assertEquals(1, s.pending())                     // the one at 100 still waits
  }
}
