import { requireNativeModule } from 'expo-modules-core';

export interface OverlayState {
  timerType: string;
  timerDisplay: string;
  title: string;
  timestamp: string;
  isRecording: boolean;
  countdownValue: number;
  /** « PRÉPARE-TOI » / « PRÊT ? », déjà traduit ; vide hors décompte. */
  countdownLabel: string;
  /** Décompte à 3-2-1 : libellé, chiffre et halo en couleur d'accent. */
  countdownTense: boolean;
  /** « GO ! » dans une bande d'accent ; vide = pas de bande. */
  goLabel: string;
  /** Accent déjà contrasté (#RRGGBB) et encre du texte posé sur l'accent. */
  accentColor: string;
  goInk: string;
  showTimer: boolean;
  boxLogoUrl: string;
  competitionLogoUrl: string;
}

/** Options vidéo (R6c) ; absentes = 30 i/s, micro activé. La vidéo est toujours en 1080p. */
export interface VideoOptions {
  fps?: 25 | 30;
  mic?: boolean;
}

export type BeepType = 'tick' | 'go' | 'done';

export interface RecordingOptions extends VideoOptions {
  outputPath: string;
  facing?: string;
  isLandscape?: boolean;
  /** Bips mélangés dans la piste son (absent = non). */
  beeps?: boolean;
  /** WAV PCM 16 bits des bips (mêmes fichiers que le haut-parleur). */
  beepFiles?: Record<BeepType, string>;
}

/**
 * Code de la promesse rejetée par `startRecording` quand la session de capture ne
 * démarre pas (exception AVFoundation rattrapée, caméra absente…) : l'app reste
 * ouverte et affiche l'erreur.
 */
export const CAPTURE_SESSION_ERROR = 'ERR_CAPTURE_SESSION';

interface RealtimeRecorderNative {
  updateOverlayState(state: Partial<OverlayState>): void;
  startRecording(options: RecordingOptions): Promise<void>;
  stopRecording(): Promise<string>;
  switchCamera(): void;
  getLastRecordingStats(): { expectedFrames: number; writtenFrames: number };
  markBeep(type: BeepType): void;
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

/**
 * Démarre l'enregistrement : la promesse n'est tenue qu'une fois la session de
 * capture relancée, orientée et le writer créé (iOS : complétion sur la file de
 * capture, plus de minuteur à l'aveugle). Rejetée (`CAPTURE_SESSION_ERROR`) si
 * la session ne démarre pas.
 */
export async function startRecording(options: RecordingOptions): Promise<void> {
  return getModule().startRecording(options);
}

export async function stopRecording(): Promise<string> {
  return getModule().stopRecording();
}

export function switchCamera(): void {
  getModule().switchCamera();
}

/** Images attendues / écrites pendant le dernier enregistrement. */
export function getLastRecordingStats(): { expectedFrames: number; writtenFrames: number } {
  return getModule().getLastRecordingStats();
}

/** Place un bip dans la piste son de la vidéo, à l'instant présent (sans effet hors enregistrement). */
export function markBeep(type: BeepType): void {
  getModule().markBeep(type);
}
