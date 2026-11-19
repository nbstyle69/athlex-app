/**
 * Type de score fixé par le créateur du WOD (box_wods.score_type, #453).
 * Un WOD sans type garde exactement le comportement d'avant : chaque fonction
 * retombe alors sur wod_type, comme le serveur (compute_wod_elo / compute_box_elo).
 */
import { ScoreType, WodScoreType } from '../types';

/** 'rounds_reps' : score_value = tours × 1000 + reps (contrainte serveur : reps < 1000). */
export const ROUNDS_REPS_BASE = 1000;

type WodLike = { score_type?: WodScoreType | null; wod_type?: string | null };

/** Type de score imposé à la saisie, ou null (l'athlète choisit). 'none' → 'done'. */
export function fixedScoreType(wod: WodLike | null | undefined): ScoreType | null {
  const t = wod?.score_type;
  if (!t) return null;
  return t === 'none' ? 'done' : t;
}

/** Sens du classement : le type du créateur s'il existe, sinon wod_type (For Time = croissant). */
export function isTimeRanked(wod: WodLike): boolean {
  return wod.score_type ? wod.score_type === 'time' : wod.wod_type === 'for-time';
}

/** Tours + reps → score_value ; null si la saisie est invalide (reps ≥ 1000, négatifs, rien). */
export function encodeRoundsReps(rounds: string, reps: string): number | null {
  const r = rounds.trim() === '' ? 0 : Number(rounds);
  const p = reps.trim() === '' ? 0 : Number(reps);
  if (!Number.isInteger(r) || !Number.isInteger(p) || r < 0 || p < 0 || p >= ROUNDS_REPS_BASE) return null;
  if (r === 0 && p === 0) return null;
  return r * ROUNDS_REPS_BASE + p;
}

export function decodeRoundsReps(value: number): { rounds: number; reps: number } {
  const v = Math.round(value);
  return { rounds: Math.floor(v / ROUNDS_REPS_BASE), reps: v % ROUNDS_REPS_BASE };
}

/** Reps saisies hors limite (le champ affiche l'erreur sous lui). */
export function roundsRepsTooHigh(reps: string): boolean {
  return reps.trim() !== '' && Number(reps) >= ROUNDS_REPS_BASE;
}

/** Une séance « faite » n'entre dans aucun classement. */
export function rankableScores<T extends { score_type: string }>(scores: T[]): T[] {
  return scores.filter(s => s.score_type !== 'done');
}
