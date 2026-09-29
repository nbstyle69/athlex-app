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

interface RealtimeRecorderNative {
  updateOverlayState(state: Partial<OverlayState>): void;
  startRecording(options: { outputPath: string; facing?: string; isLandscape?: boolean }): Promise<void>;
  stopRecording(): Promise<string>;
  switchCamera(): void;
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

export async function startRecording(options: { outputPath: string; facing?: string; isLandscape?: boolean }): Promise<void> {
  return getModule().startRecording(options);
}

export async function stopRecording(): Promise<string> {
  return getModule().stopRecording();
}

export function switchCamera(): void {
  getModule().switchCamera();
}
