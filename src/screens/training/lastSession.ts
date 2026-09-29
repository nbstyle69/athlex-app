/**
 * « Dernière séance » de l'onglet Entraînement : la séance générée encore en
 * brouillon (`wodDraft`) ou la dernière enregistrée dans `generated_wods`
 * (la table lue par l'historique), la plus récente des deux. Rend de quoi la
 * rouvrir dans `WodResult`.
 */
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { formatScoreValue } from '../../utils/scoreFormat';
import { loadWodDraft } from '../../services/wodDraft';
import type { FormatChoice } from '../../../packages/wod-engine/src';
import {
  AnyWod, GenerateResult, ScreenParams, categoryFor, isMuscuWod,
} from '../../services/wodGenerator';
import type { WodResultParams } from '../wod/WodResultScreen';
import type { User } from '../../types';

export interface LastSession {
  title: string;
  discipline: 'functional' | 'hybrid' | 'musculation';
  date: string;
  score: string | null;
  params: WodResultParams;
}

interface SavedRow {
  created_at: string;
  wod_json: unknown;
  scores: { score_value: number; score_type: string; completed_at: string | null }[] | null;
}

const FORMAT_CHOICES: readonly FormatChoice[] = ['amrap', 'for_time', 'emom', 'chipper', 'stations', 'interval'];

/** Paramètres d'écran et résultat reconstruits depuis un WOD enregistré. */
export function reopenParams(
  wod: AnyWod,
  user: Pick<User, 'level' | 'gender'> | null,
  exclude: string[],
): { screen: ScreenParams; result: GenerateResult } {
  if (isMuscuWod(wod)) {
    return {
      screen: { discipline: 'musculation', entry: wod.entry, target: wod.target, objective: wod.objective, equipment: wod.equipment, exclude },
      result: {
        wod,
        params: { entry: wod.entry, target: wod.target, objective: wod.objective, budget_min: wod.budget_min, equipment: wod.equipment, level: wod.level, exclude },
        category: categoryFor(user, 'functional'),
      },
    };
  }
  const format = FORMAT_CHOICES.find((f) => f === wod.format) ?? 'surprise';
  const vest = wod.vest?.mode ?? 'none';
  const category = categoryFor(user, wod.discipline);
  return {
    screen: { entry: wod.entry, discipline: wod.discipline, intention: wod.intention, format, vest, exclude },
    result: {
      wod,
      params: { entry: wod.entry, discipline: wod.discipline, budget_min: wod.budget_min, format, intention: wod.intention, vest, exclude, profile_category: category },
      category,
    },
  };
}

function latestScore(scores: SavedRow['scores']): string | null {
  const s = [...(scores ?? [])].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0];
  return s ? formatScoreValue(s.score_value, s.score_type) : null;
}

export async function loadLastSession(
  user: Pick<User, 'id' | 'level' | 'gender'>,
  exclude: string[],
): Promise<LastSession | null> {
  const [draft, saved] = await Promise.all([
    loadWodDraft(user.id),
    supabase
      .from('generated_wods')
      .select('created_at, wod_json, scores:generated_wod_scores(score_value, score_type, completed_at)')
      .eq('user_id', user.id)
      .not('wod_json', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  if (saved.error) captureError(saved.error, { screen: 'Training', action: 'loadLastSession' });
  const row = ((saved.data ?? []) as unknown as SavedRow[])[0] ?? null;

  const draftTime = draft ? new Date(draft.savedAt).getTime() : -Infinity;
  const rowTime = row ? new Date(row.created_at).getTime() : -Infinity;
  if (draft && draftTime >= rowTime) {
    const s = draft.submittedScore;
    return {
      title: draft.result.wod.title,
      discipline: draft.result.wod.discipline,
      date: draft.savedAt,
      score: s ? formatScoreValue(s.value, s.scoreType) : null,
      params: { screen: draft.screen, result: draft.result, draft: { performed: draft.performed, submittedScore: draft.submittedScore } },
    };
  }
  if (!row) return null;
  const wod = row.wod_json as AnyWod;
  return {
    title: wod.title,
    discipline: wod.discipline,
    date: row.created_at,
    score: latestScore(row.scores),
    params: reopenParams(wod, user, exclude),
  };
}

/** Nombre de jours calendaires entre `iso` et `now` (0 = aujourd'hui). */
export function daysAgo(iso: string, now: Date = new Date()): number {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(0, Math.round((start(now) - start(d)) / 86_400_000));
}
