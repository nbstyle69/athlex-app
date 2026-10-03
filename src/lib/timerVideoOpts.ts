import AsyncStorage from '@react-native-async-storage/async-storage';

/** Même stockage que les options d'affichage du minuteur (TimerRunScreen). */
export const DISPLAY_OPTS_KEY = 'bwod_timer_display_opts_v2';

export const VIDEO_FPS = [25, 30] as const;

/**
 * La vidéo est toujours en 1080p : le choix 720p / 2K / 4K et son essai à blanc
 * ont été retirés après les plantages du build 1.0.59. Une ancienne valeur
 * `videoQuality` enregistrée est ignorée.
 */
export interface VideoOpts {
  videoFps: 25 | 30;
  videoMic: boolean;
  /** Bips du chrono mélangés dans la piste son de la vidéo. */
  videoBeeps: boolean;
}

/** Comportement d'avant R6c : 30 i/s, micro activé ; bips dans la vidéo activés. */
export const DEFAULT_VIDEO_OPTS: VideoOpts = { videoFps: 30, videoMic: true, videoBeeps: true };

/** Options vidéo lues dans l'objet stocké ; toute valeur inconnue retombe sur le défaut. */
export function readVideoOpts(stored: unknown): VideoOpts {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  return {
    videoFps: s.videoFps === 25 ? 25 : 30,
    videoMic: typeof s.videoMic === 'boolean' ? s.videoMic : DEFAULT_VIDEO_OPTS.videoMic,
    videoBeeps: typeof s.videoBeeps === 'boolean' ? s.videoBeeps : DEFAULT_VIDEO_OPTS.videoBeeps,
  };
}

async function readStored(): Promise<Record<string, unknown>> {
  try {
    const v = await AsyncStorage.getItem(DISPLAY_OPTS_KEY);
    const parsed = v ? JSON.parse(v) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export async function loadVideoOpts(): Promise<VideoOpts> {
  return readVideoOpts(await readStored());
}

/** Fusionne dans l'objet stocké sans toucher aux options d'affichage ; retire l'ancienne qualité. */
export async function saveVideoOpts(update: Partial<VideoOpts>): Promise<void> {
  const { videoQuality: _old, ...stored } = await readStored();
  await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ ...stored, ...update }));
}

/** Vrai quand moins de 90 % des images attendues sont dans le fichier. */
export function isJerky(stats: { expectedFrames: number; writtenFrames: number } | null): boolean {
  return !!stats && stats.expectedFrames > 0 && stats.writtenFrames * 10 < stats.expectedFrames * 9;
}
