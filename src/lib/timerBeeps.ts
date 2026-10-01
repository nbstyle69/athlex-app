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
  /** Tic court et brillant (do 6), GO long et montant, fin en trois notes descendantes (sol, mi, do). */
  athlex: {
    tick: [{ hz: 1046.5, ms: 100, fadeInMs: 4, fadeOutMs: 30, harmonic: 0.25 }],
    go: [{ hz: 880, hzEnd: 1318.5, ms: 400, fadeInMs: 6, fadeOutMs: 60, harmonic: 0.25 }],
    done: [
      { hz: 1568, ms: 170, fadeInMs: 4, fadeOutMs: 40, harmonic: 0.25 },
      { silent: true, ms: 40 },
      { hz: 1318.5, ms: 170, fadeInMs: 4, fadeOutMs: 40, harmonic: 0.25 },
      { silent: true, ms: 40 },
      { hz: 1046.5, ms: 170, fadeInMs: 4, fadeOutMs: 40, harmonic: 0.25 },
    ],
  },
};

export function isBeepSet(v: unknown): v is BeepSetId {
  return v === 'athlex' || v === 'classic';
}

/** WAV en base64. Sans `harmonic` ni `hzEnd`, octets identiques à ceux d'avant R6c (vérifié par empreinte). */
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
    for (let i = 0; i < n; i++) {
      let sample = 0;
      if (!seg.silent && seg.hz) {
        let amp = seg.amp ?? 0.85;
        if (i < fadeIn)          amp *= i / fadeIn;
        else if (i > n - fadeOut) amp *= (n - i) / fadeOut;
        // Phase intégrée du glissement linéaire hz → hzEnd ; harmonique normalisée (crête ≤ amp).
        const phase = 2 * Math.PI * (seg.hz * i + ((seg.hzEnd ?? seg.hz) - seg.hz) * i * i / (2 * n)) / sr;
        sample = Math.round(32767 * amp * (Math.sin(phase) + h * Math.sin(2 * phase)) / (1 + h));
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
