export { default as RealtimeRecorderView } from './RealtimeRecorderView';
export {
  updateOverlayState, startRecording, stopRecording, switchCamera,
  getSupportedQualities, prepareQuality, getLastRecordingStats, markBeep,
} from './RealtimeRecorderModule';
export type { OverlayState, VideoQuality, VideoOptions, RecordingOptions, QualityCheck, BeepType } from './RealtimeRecorderModule';
