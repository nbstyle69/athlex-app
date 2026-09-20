/**
 * B10 (lot B) — records gymniques du profil (`personal_records`, section
 * Gymnastique, en reps) → `gym_records` du moteur (id catalogue → reps).
 *
 * `undefined` quand le profil n'a aucun record gym : le moteur garde alors le
 * comportement par catégorie. Sinon chaque mouvement suivi est présent, à 0
 * quand le record manque — c'est ce 0 qui déclenche la substitution.
 */
import { readPr } from '../profile/prStorage';

/** Libellé de la page Records → id du catalogue. */
export const GYM_PR_TO_MOVEMENT: Readonly<Record<string, string>> = {
  'Pull-ups': 'pull_up',
  'Chest To Bar': 'chest_to_bar',
  'Toes To Bar': 'toes_to_bar',
  'Bar Muscle-up': 'bar_muscle_up',
  'Ring Muscle-up': 'ring_muscle_up',
  'Hand Stand Push Up': 'handstand_push_up',
  'Strict Hand Stand Push Up': 'strict_handstand_push_up',
  'Dips': 'ring_dip',
};

export function gymRecordsFrom(records: Record<string, unknown> | null | undefined): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  let any = false;
  for (const [label, id] of Object.entries(GYM_PR_TO_MOVEMENT)) {
    const raw = readPr(records as Record<string, string> | undefined, 'gymnastics', label);
    const n = raw ? parseFloat(String(raw).replace(',', '.')) : NaN;
    const reps = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    if (reps > 0) any = true;
    out[id] = reps;
  }
  return any ? out : undefined;
}
