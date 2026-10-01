export { default as RealtimeRecorderView } from './RealtimeRecorderView';
export {
  updateOverlayState, startRecording, stopRecording, switchCamera,
  getLastRecordingStats, markBeep, CAPTURE_SESSION_ERROR,
} from './RealtimeRecorderModule';
export type { OverlayState, VideoOptions, RecordingOptions, BeepType } from './RealtimeRecorderModule';
