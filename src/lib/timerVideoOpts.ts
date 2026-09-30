import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupportedQualities, type QualityCheck, type VideoQuality } from 'realtime-recorder';

/** Même stockage que les options d'affichage du minuteur (TimerRunScreen). */
export const DISPLAY_OPTS_KEY = 'bwod_timer_display_opts_v2';

export type { VideoQuality };
export const VIDEO_QUALITIES: VideoQuality[] = ['720p', '1080p', '2k', '4k'];
export const VIDEO_QUALITY_LABELS: Record<VideoQuality, string> = { '720p': '720p', '1080p': '1080p', '2k': '2K', '4k': '4K' };
export const VIDEO_FPS = [25, 30] as const;

export interface VideoOpts {
  videoQuality: VideoQuality;
  videoFps: 25 | 30;
  videoMic: boolean;
  /** Bips du chrono mélangés dans la piste son de la vidéo. */
  videoBeeps: boolean;
}

/** Comportement d'avant R6c : 1080p, 30 i/s, micro activé ; bips dans la vidéo activés. */
export const DEFAULT_VIDEO_OPTS: VideoOpts = { videoQuality: '1080p', videoFps: 30, videoMic: true, videoBeeps: true };

/** Options vidéo lues dans l'objet stocké ; toute valeur inconnue retombe sur le défaut. */
export function readVideoOpts(stored: unknown): VideoOpts {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  return {
    videoQuality: VIDEO_QUALITIES.includes(s.videoQuality as VideoQuality) ? s.videoQuality as VideoQuality : DEFAULT_VIDEO_OPTS.videoQuality,
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

/** Fusionne dans l'objet stocké sans toucher aux options d'affichage. */
export async function saveVideoOpts(update: Partial<VideoOpts>): Promise<void> {
  const stored = await readStored();
  await AsyncStorage.setItem(DISPLAY_OPTS_KEY, JSON.stringify({ ...stored, ...update }));
}

export const isAbove1080 = (q: VideoQuality) => q === '2k' || q === '4k';

/**
 * Qualités proposées : celles qu'accepte au moins une des deux caméras
 * (la caméra se choisit après, à l'écran du chrono, qui redescend si besoin).
 * 720p et 1080p restent toujours proposés.
 */
export function offeredQualities(): VideoQuality[] {
  let front: VideoQuality[] = [];
  let back: VideoQuality[] = [];
  try { ({ front, back } = getSupportedQualities()); } catch { /* module absent (web, tests) */ }
  return VIDEO_QUALITIES.filter(q => !isAbove1080(q) || front.includes(q) || back.includes(q));
}

/** Choix affiché : la qualité enregistrée, ou la meilleure proposée en dessous. */
export function shownQuality(stored: VideoQuality, offered: VideoQuality[]): VideoQuality {
  const below = VIDEO_QUALITIES.slice(0, VIDEO_QUALITIES.indexOf(stored) + 1).filter(q => offered.includes(q));
  return below.at(-1) ?? DEFAULT_VIDEO_OPTS.videoQuality;
}

/** Bandeau expliquant une redescente de qualité (null = rien à dire). */
export function qualityNotice(check: QualityCheck | null, t: (key: string, o?: Record<string, string>) => string): string | null {
  if (!check || check.applied === check.requested || !check.reason) return null;
  const o = { requested: VIDEO_QUALITY_LABELS[check.requested], applied: VIDEO_QUALITY_LABELS[check.applied] };
  return t(`timer.video.notice.${check.reason}`, o);
}

/** Vrai quand moins de 90 % des images attendues sont dans le fichier. */
export function isJerky(stats: { expectedFrames: number; writtenFrames: number } | null): boolean {
  return !!stats && stats.expectedFrames > 0 && stats.writtenFrames * 10 < stats.expectedFrames * 9;
}
