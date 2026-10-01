/**
 * Bips du chrono : synthèse WAV (PCM 16 bits mono 44,1 kHz) et jeux de bips.
 * Le même WAV sert au haut-parleur (expo-av) et au mélange dans la vidéo (module natif).
 */

export type WavSeg = {
  hz?: number; ms: number; silent?: boolean; fadeInMs?: number; fadeOutMs?: number; amp?: number;
  /** Amplitude relative de la 2e harmonique (0 = son pur). */
  harmonic?: number;
  /** Fréquence d'arrivée : glissement linéaire depuis `hz`. */
  hzEnd?: number;
  /**
   * « Ping » : après l'attaque (`fadeInMs`), décroissance exponentielle de constante
   * de temps `decayMs` au lieu d'un palier ; `fadeOutMs` ne sert plus qu'à finir à zéro.
   */
  decayMs?: number;
  /** Amplitude relative d'un partiel désaccordé de +0,6 % : battement lent, la résonance du sonar. */
  resonance?: number;
};

export type BeepType = 'tick' | 'go' | 'done';
export type BeepSetId = 'athlex' | 'classic';
export const BEEP_TYPES: BeepType[] = ['tick', 'go', 'done'];
export const DEFAULT_BEEP_SET: BeepSetId = 'athlex';

export const BEEP_SETS: Record<BeepSetId, Record<BeepType, WavSeg[]>> = {
  /** Les bips d'avant R6c, à l'octet près. */
  classic: {
    tick: [{ hz: 860, ms: 180, fadeInMs: 15, fadeOutMs: 30 }],
    go: [{ hz: 1000, ms: 550, fadeInMs: 15, fadeOutMs: 50 }],
    done: [
      { hz: 1000, ms: 550, fadeInMs: 15, fadeOutMs: 50 },
      { silent: true, ms: 80 },
      { hz: 1000, ms: 550, fadeInMs: 15, fadeOutMs: 50 },
    ],
  },
  /**
   * « Sonar » : pings sinusoïdaux, attaque de 2 ms puis longue décroissance exponentielle,
   * légère résonance. Tic vers 1 100 Hz (350 ms), GO plus aigu et plus long (1 500 Hz,
   * 800 ms), fin en trois pings descendants.
   */
  athlex: {
    tick: [{ hz: 1100, ms: 350, fadeInMs: 2, decayMs: 80, fadeOutMs: 20, resonance: 0.3 }],
    go: [{ hz: 1500, ms: 800, fadeInMs: 2, decayMs: 180, fadeOutMs: 30, resonance: 0.3 }],
    done: [
      { hz: 1500, ms: 300, fadeInMs: 2, decayMs: 70, fadeOutMs: 20, resonance: 0.3 },
      { hz: 1250, ms: 300, fadeInMs: 2, decayMs: 70, fadeOutMs: 20, resonance: 0.3 },
      { hz: 1050, ms: 400, fadeInMs: 2, decayMs: 100, fadeOutMs: 20, resonance: 0.3 },
    ],
  },
};

export function isBeepSet(v: unknown): v is BeepSetId {
  return v === 'athlex' || v === 'classic';
}

/** WAV en base64. Sans `harmonic`, `hzEnd`, `decayMs` ni `resonance`, octets identiques à ceux d'avant R6c (vérifié par empreinte). */
export function buildMultiWAV(segs: WavSeg[]): string {
  const sr = 44100;
  const blockAlign = 2; // 16-bit mono
  let totalSamples = 0;
  for (const seg of segs) totalSamples += Math.floor(sr * seg.ms / 1000);
  const dataBytes = totalSamples * blockAlign;
  const ab = new ArrayBuffer(44 + dataBytes);
  const dv = new DataView(ab);
  const u8 = new Uint8Array(ab);
  const ws = (o: number, v: string) => { for (let i = 0; i < v.length; i++) u8[o + i] = v.charCodeAt(i); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + dataBytes, true); ws(8, 'WAVE');
  ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * blockAlign, true);
  dv.setUint16(32, blockAlign, true); dv.setUint16(34, 16, true);
  ws(36, 'data'); dv.setUint32(40, dataBytes, true);
  let off = 44;
  for (const seg of segs) {
    const n       = Math.floor(sr * seg.ms / 1000);
    const fadeIn  = Math.max(1, Math.floor(sr * (seg.fadeInMs  ?? 5)  / 1000));
    const fadeOut = Math.max(1, Math.floor(sr * (seg.fadeOutMs ?? 8)  / 1000));
    const h = seg.harmonic ?? 0;
    const r = seg.resonance ?? 0;
    const tau = seg.decayMs ? sr * seg.decayMs / 1000 : 0;
    for (let i = 0; i < n; i++) {
      let sample = 0;
      if (!seg.silent && seg.hz) {
        let amp = seg.amp ?? 0.85;
        if (i < fadeIn)          amp *= i / fadeIn;
        else if (tau)            amp *= Math.exp(-(i - fadeIn) / tau);
        if (i >= fadeIn && i > n - fadeOut) amp *= (n - i) / fadeOut;
        // Phase intégrée du glissement linéaire hz → hzEnd ; harmonique et résonance
        // normalisées : crête ≤ amp, jamais de saturation.
        const phase = 2 * Math.PI * (seg.hz * i + ((seg.hzEnd ?? seg.hz) - seg.hz) * i * i / (2 * n)) / sr;
        const wave = Math.sin(phase) + h * Math.sin(2 * phase) + (r ? r * Math.sin(1.006 * phase) : 0);
        sample = Math.round(32767 * amp * wave / (1 + h + r));
      }
      dv.setInt16(off, sample, true); off += 2;
    }
  }
  let b = ''; for (let i = 0; i < u8.length; i++) b += String.fromCharCode(u8[i]);
  return btoa(b);
}

/** Nom du fichier en cache d'un bip (un par jeu, pour ne jamais relire l'autre jeu). */
export function beepFileName(set: BeepSetId, type: BeepType): string {
  return `bwod_${set}_${type}.wav`;
}

/**
 * Un bip est-il mélangé dans la piste son de la vidéo ? Seulement si « Bips dans la vidéo »
 * est activé ET que le micro ne l'enregistre pas déjà : micro coupé, ou téléphone muet (sons
 * coupés, volume à zéro, sons pas encore chargés). Micro et sons du téléphone activés : le
 * micro capte le bip du haut-parleur, le mélanger aussi le ferait entendre deux fois.
 * Décidé à chaque bip : couper ou rétablir les sons pendant l'enregistrement est suivi.
 */
export function mixBeepInVideo(o: { videoBeeps: boolean; mic: boolean; phoneAudible: boolean }): boolean {
  return o.videoBeeps && (!o.mic || !o.phoneAudible);
}
