package expo.modules.realtimerecorder

data class OverlayState(
  var timerType: String = "",
  var timerDisplay: String = "",
  var title: String = "",
  var timestamp: String = "",
  var isRecording: Boolean = false,
  var countdownValue: Int = 0,
  var countdownLabel: String = "",
  var countdownTense: Boolean = false,
  /** Duration of the countdown (its largest value): sizes the digit, #547 PR 3. 0 = unknown. */
  var countdownMax: Int = 0,
  var goLabel: String = "",
  var accentColor: String = "#FFFFFF",
  var goInk: String = "#101214",
  var showTimer: Boolean = false,
  var boxLogoUrl: String = "",
  var competitionLogoUrl: String = ""
)
