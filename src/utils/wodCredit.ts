/**
 * Reps de mouvements créditées pour les badges (Whiteboard). Règle d'avant pour
 * les lignes structurées ; texte libre (#453) : lu par freeTextWod, crédité
 * seulement quand le score prouve la séance terminée.
 */
import { BoxWOD, ScoreType } from '../types';
import { MovementEntry } from '../services/gamification';
import { computeCompletedMovements, computeForTimeProgress, repsPerRoundFromMovements } from './movementParser';
import { creditFreeText } from './freeTextWod';
import { decodeRoundsReps } from './wodScoreType';

type Gender = 'male' | 'female' | null | undefined;

/**
 * Reps de mouvements créditées par un score posé. Texte libre : lecture du
 * texte, crédit seulement sur un temps fini. Lignes structurées : règle
 * d'avant ; tours + reps y est ramené à un total de reps (comme un AMRAP).
 */
export function movementCredit(
  wod: Pick<BoxWOD, 'description' | 'wod_type' | 'text_mode' | 'score_type'>,
  value: number,
  scoreType: ScoreType,
  capped: boolean,
  gender?: Gender,
): MovementEntry[] {
  if (scoreType === 'done' || !wod.description) return [];
  if (wod.text_mode === 'free') return creditFreeText(wod.description, { scoreType, capped }, gender);
  const lines = wod.description.split('\n').filter(Boolean);
  // For Time typé arrêté en cours (score en reps fixé, ou temps au cap) : les X
  // premières reps dans l'ordre du WOD, jamais plus que le WOD écrit.
  if (wod.wod_type === 'for-time' && (wod.score_type === 'reps' || (wod.score_type === 'time' && capped))) {
    return computeForTimeProgress(lines, value, { gender });
  }
  // Autre format avec un score en reps fixé : ce total réparti comme un AMRAP.
  const wodFormat = wod.score_type === 'reps' || scoreType === 'rounds_reps' ? 'AMRAP'
    : wod.wod_type === 'for-time' ? 'For Time' : wod.wod_type === 'amrap' ? 'AMRAP' : wod.wod_type === 'emom' ? 'EMOM' : wod.wod_type ?? 'For Time';
  if (scoreType === 'rounds_reps') {
    const perRound = repsPerRoundFromMovements(lines);
    if (perRound <= 0) return [];
    const { rounds, reps } = decodeRoundsReps(value);
    return computeCompletedMovements(lines, wodFormat, rounds * perRound + reps, 'reps', { gender });
  }
  return computeCompletedMovements(lines, wodFormat, value, scoreType, { gender });
}

/**
 * « Réalisé » coché sur le Whiteboard, sans score : le travail prescrit d'un
 * For Time / EMOM / Tabata / Chipper ; rien pour un AMRAP (tours inconnus) ni
 * pour un texte libre (aucun score ne prouve la séance).
 */
export function completionCredit(wod: Pick<BoxWOD, 'description' | 'wod_type' | 'text_mode'>, gender?: Gender): MovementEntry[] {
  if (!wod.description || wod.wod_type === 'amrap' || wod.text_mode === 'free') return [];
  const lines = wod.description.split('\n').filter(Boolean);
  const wodFormat = wod.wod_type === 'for-time' ? 'For Time'
    : wod.wod_type === 'emom' ? 'EMOM'
    : wod.wod_type === 'tabata' ? 'Tabata'
    : 'For Time';
  return computeCompletedMovements(lines, wodFormat, 0, 'reps', { gender });
}
