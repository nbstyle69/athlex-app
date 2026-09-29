import { requireNativeModule } from 'expo-modules-core';

export interface OverlayState {
  timerType: string;
  timerDisplay: string;
  title: string;
  timestamp: string;
  isRecording: boolean;
  countdownValue: number;
  showTimer: boolean;
  boxLogoUrl: string;
  competitionLogoUrl: string;
}

export type VideoQuality = '720p' | '1080p' | '2k' | '4k';

/** Options vidéo (R6c) ; absentes = 1080p, 30 i/s, micro activé. */
export interface VideoOptions {
  quality?: VideoQuality;
  fps?: 25 | 30;
  mic?: boolean;
}

export interface RecordingOptions extends VideoOptions {
  outputPath: string;
  facing?: string;
  isLandscape?: boolean;
}

/** Qualité réellement retenue et pourquoi elle est plus basse que demandée. */
export interface QualityCheck {
  requested: VideoQuality;
  applied: VideoQuality;
  reason: 'camera' | 'performance' | 'thermal' | null;
}

interface RealtimeRecorderNative {
  updateOverlayState(state: Partial<OverlayState>): void;
  startRecording(options: RecordingOptions): Promise<void>;
  stopRecording(): Promise<string>;
  switchCamera(): void;
  getSupportedQualities(): { front: VideoQuality[]; back: VideoQuality[] };
  prepareQuality(options: VideoOptions & { facing?: string }): Promise<QualityCheck>;
  getLastRecordingStats(): { expectedFrames: number; writtenFrames: number };
}

let _module: RealtimeRecorderNative | null = null;
function getModule(): RealtimeRecorderNative {
  if (!_module) {
    _module = requireNativeModule('RealtimeRecorder') as RealtimeRecorderNative;
  }
  return _module;
}

export function updateOverlayState(state: Partial<OverlayState>): void {
  getModule().updateOverlayState(state);
}

export async function startRecording(options: RecordingOptions): Promise<void> {
  return getModule().startRecording(options);
}

export async function stopRecording(): Promise<string> {
  return getModule().stopRecording();
}

export function switchCamera(): void {
  getModule().switchCamera();
}

/** Qualités acceptées par la caméra avant et par la caméra arrière. */
export function getSupportedQualities(): { front: VideoQuality[]; back: VideoQuality[] } {
  return getModule().getSupportedQualities();
}

/** Fixe la qualité avant l'enregistrement (caméra, chauffe, essai à blanc au-delà de 1080p). */
export async function prepareQuality(options: VideoOptions & { facing?: string }): Promise<QualityCheck> {
  return getModule().prepareQuality(options);
}

/** Images attendues / écrites pendant le dernier enregistrement. */
export function getLastRecordingStats(): { expectedFrames: number; writtenFrames: number } {
  return getModule().getLastRecordingStats();
}
