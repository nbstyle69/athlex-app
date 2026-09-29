import { ensureContrast, inkOn, TIMER_THEMES } from '../theme/timerInk';
import { axVeil } from '../theme/axTokens';

/** « PRÊT ? » et couleur d'accent à partir de 3 (au-dessus : « PRÉPARE-TOI »). */
export const CD_TENSE_FROM = 3;

/**
 * Champs du décompte pour l'incrustation native, calqués sur le décompte caméra
 * à l'écran (CountdownView / GoFlash posés sur axVeil.countdownFloor) :
 * textes déjà traduits, couleurs déjà contrastées, le natif ne fait que dessiner.
 */
export function countdownOverlay(value: number, goVisible: boolean, themeId: string, t: (key: string) => string) {
  const accent = (TIMER_THEMES.find(x => x.id === themeId) ?? TIMER_THEMES[0]).accent;
  const accentColor = ensureContrast(accent, axVeil.countdownFloor);
  const tense = value > 0 && value <= CD_TENSE_FROM;
  return {
    countdownValue: value,
    countdownLabel: value > 0 ? t(tense ? 'timer.countdown.ready' : 'timer.countdown.prepare') : '',
    countdownTense: tense,
    goLabel: goVisible ? t('timer.countdown.go') : '',
    accentColor,
    goInk: inkOn(accentColor),
  };
}
