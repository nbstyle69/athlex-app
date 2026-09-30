/**
 * Séance Musculation générée côté serveur (PR 3) : la grille de la carte Séance
 * part en brouillon dans `strength_sessions` / `strength_set_logs` (source
 * `generated`, identifiant = le WOD enregistré dans `generated_wods`), se reprend
 * sur un autre appareil, et se valide par `validate_strength_session`.
 *
 * Le score reste le tonnage (`generated_wod_scores`) ; compteur, rappel et crédit
 * `movement_logs` ne partent qu'à la première validation. Une modification
 * ultérieure ne remplace que le tonnage.
 */
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import type { MuscuWod } from '../../packages/wod-engine/src';
import {
  ServerSet, StrengthSetDraft, StrengthValidationResult, latestStrengthDraft, numberSetsByMovement, parseDecimal,
  submitStrengthValidation,
} from './strengthSets';
import {
  MuscuResult, MuscuScoreSubmission, PerformedExercise, isMuscuWod, plannedSets, submitMuscuScore,
  totalTonnage, updateMuscuScore,
} from './wodGenerator';
import type { MuscuScreenParams } from './wodGenerator';

export function initialPerformed(wod: MuscuWod): PerformedExercise[] {
  return wod.blocks[0].exercises.map((e) => ({ exercise_id: e.id, name: e.name, sets: plannedSets(e) }));
}

const numText = (n: number) => (n > 0 ? String(Number(n)) : '');

/**
 * Séries de la carte Séance → lignes de la grille du service (une par série),
 * numérotées pour le stockage en continu par mouvement (un exercice présent
 * deux fois ne dédouble pas la clé).
 */
export function performedToDrafts(wod: MuscuWod, performed: readonly PerformedExercise[]): StrengthSetDraft[] {
  const exercises = wod.blocks[0].exercises;
  return numberSetsByMovement(performed.flatMap((ex, i) => {
    const planned = exercises[i] ? plannedSets(exercises[i]) : [];
    return ex.sets.map((s, j) => ({
      entryIndex: i,
      setIndex: j + 1,
      name: ex.name,
      reps: numText(s.reps),
      loadKg: numText(s.load_kg),
      prescribedReps: planned[j]?.reps ?? 0,
      prescribedLoadKg: planned[j] && planned[j].load_kg > 0 ? planned[j].load_kg : null,
    }));
  }));
}

/**
 * Lignes de la grille → séries de la carte Séance, dans l'ordre de la
 * prescription : la série j de l'exercice i est la j-ième ligne de son bloc
 * (son rang), pas son numéro de stockage.
 */
export function draftsToPerformed(base: readonly PerformedExercise[], drafts: readonly StrengthSetDraft[]): PerformedExercise[] {
  return base.map((ex, i) => ({
    ...ex,
    sets: ex.sets.map((s, j) => {
      const d = drafts.filter((x) => x.entryIndex === i)[j];
      if (!d) return s;
      return {
        reps: Math.max(0, Math.floor(parseDecimal(d.reps) ?? 0)),
        load_kg: Math.max(0, parseDecimal(d.loadKg) ?? 0),
      };
    }),
  }));
}

export interface MuscuValidation {
  tonnage: number;
  result: StrengthValidationResult;
}

/**
 * Valide la séance : séries et 1RM par `validate_strength_session`, puis le
 * tonnage. Première validation : score, compteur, rappel et `movement_logs`
 * (submitMuscuScore) ; sinon, le tonnage du score existant est remplacé.
 */
export async function validateMuscuSession(
  user: Pick<User, 'id'>,
  boxId: string | null | undefined,
  wod: MuscuWod,
  s: MuscuScoreSubmission,
  previousSets: ServerSet[] = [],
): Promise<MuscuValidation> {
  const tonnage = totalTonnage(s.performed);
  const result = await submitStrengthValidation(
    {
      userId: user.id,
      sourceType: 'generated',
      sourceId: s.wodId,
      sourceTitle: wod.title,
      drafts: performedToDrafts(wod, s.performed),
      rx: wod.level !== 'debutant',
      previousSets,
    },
    async () => { await submitMuscuScore(user, boxId, wod, s); },
  );
  if (!result.premiereValidation) await updateMuscuScore(user, wod, s);
  return { tonnage, result };
}

export interface ResumableMuscuSession {
  savedId: string;
  screen: MuscuScreenParams;
  result: MuscuResult;
}

/**
 * Séance générée en cours sur le serveur (brouillon le plus récent), avec son
 * WOD enregistré : de quoi rouvrir la page résultat sur n'importe quel appareil.
 */
export async function findResumableMuscuSession(userId: string): Promise<ResumableMuscuSession | null> {
  const draft = await latestStrengthDraft(userId, 'generated');
  if (!draft) return null;
  const { data, error } = await supabase
    .from('generated_wods')
    .select('id, wod_json')
    .eq('id', draft.sourceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const wod = (data?.wod_json ?? null) as unknown as MuscuWod | null;
  if (!data || !wod || typeof wod !== 'object' || !isMuscuWod(wod) || !Array.isArray(wod.blocks)) return null;
  const screen: MuscuScreenParams = {
    discipline: 'musculation',
    entry: wod.entry,
    target: wod.target,
    objective: wod.objective,
    equipment: wod.equipment,
    exclude: [],
  };
  return {
    savedId: data.id,
    screen,
    result: {
      wod,
      params: {
        entry: wod.entry, target: wod.target, objective: wod.objective, budget_min: wod.budget_min,
        equipment: wod.equipment, level: wod.level, exclude: [],
      },
      category: 'rx',
    },
  };
}
