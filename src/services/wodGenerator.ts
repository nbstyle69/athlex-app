/**
 * Générateur de WOD (bloc C) côté app : prépare les paramètres du moteur
 * (signatures récentes, classe du jour, exclusions du profil), tire un WOD
 * hors ligne avec `packages/wod-engine`, puis enregistre historique / favori /
 * score dans les tables existantes (`generated_wods`, `generated_wod_scores`).
 */
import { supabase } from '../lib/supabase';
import { Json } from '../types/supabase';
import { User } from '../types';
import { incrementCounter, logMovementReps } from './gamification';
import { cancelTodayScoreReminder } from './notifications';
import { computeCompletedMovements } from '../utils/movementParser';
import { captureError } from '../lib/sentry';
import { generateBlocC, profileCategory, CATEGORY_LABEL } from '../../packages/wod-engine/src';
import type { Category, GenerateParams, GeneratedWod } from '../../packages/wod-engine/src';
import { loadEngineData } from './wodEngineData';

export const SIGNATURE_WINDOW = 10;

/** Paramètres choisis à l'écran ; le service complète signatures, catégorie et classe du jour. */
export type ScreenParams = Pick<GenerateParams, 'entry' | 'discipline' | 'budget_min' | 'format' | 'intention' | 'vest' | 'exclude'>;

export interface DayClass {
  title: string;
  movements: string[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Graine 31 bits : aléatoire à chaque tirage, conservée dans le WOD pour rejouer. */
export function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** Les 10 dernières signatures de l'athlète (`wod_json->>'signature'`). */
export async function recentSignatures(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('generated_wods')
    .select('wod_json')
    .eq('user_id', userId)
    .not('wod_json', 'is', null)
    .order('created_at', { ascending: false })
    .limit(SIGNATURE_WINDOW);
  if (error || !data) return [];
  const out: string[] = [];
  for (const r of data) {
    const j = r.wod_json as { signature?: unknown } | null;
    if (j && typeof j.signature === 'string') out.push(j.signature);
  }
  return out;
}

/**
 * Classe du jour de la box : union des mouvements de tous les blocs publiés
 * aujourd'hui (pre-wod / post-wod inclus). La RLS de `box_wods` filtre déjà
 * les blocs restreints à un groupe ou à un programme. `null` sans box ou sans
 * WOD publié.
 */
export async function todayClass(boxId: string | null | undefined): Promise<DayClass | null> {
  if (!boxId) return null;
  const { data, error } = await supabase
    .from('box_wods')
    .select('title, description, block, sort_order')
    .eq('box_id', boxId)
    .eq('scheduled_date', todayISO())
    .eq('is_published', true)
    .order('sort_order');
  if (error || !data || data.length === 0) return null;
  const movements: string[] = [];
  for (const b of data) {
    for (const line of (b.description ?? '').split('\n')) {
      const t = line.trim();
      if (t && /^\d/.test(t)) movements.push(t);
    }
  }
  const main = data.find((b) => !b.block || b.block === 'wod') ?? data[0];
  return { title: main.title, movements };
}

// ── Exclusions persistées dans le profil (user_generation_settings.last_params) ──

type LastParams = { exclude?: unknown } & Record<string, unknown>;

export async function loadExcludes(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_generation_settings')
    .select('last_params')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return [];
  const lp = (data?.last_params ?? null) as LastParams | null;
  const ex = lp?.exclude;
  return Array.isArray(ex) ? ex.filter((v): v is string => typeof v === 'string') : [];
}

export async function saveExcludes(userId: string, exclude: string[]): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('user_generation_settings')
      .select('last_params')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    const prev = ((data?.last_params ?? {}) as LastParams);
    const last_params = { ...prev, exclude } as Json;
    await supabase
      .from('user_generation_settings')
      .upsert({ user_id: userId, last_params, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } catch (e) {
    captureError(e, { action: 'saveExcludes' });
  }
}

// ── Tirage ───────────────────────────────────────────────────────────────────

export interface GenerateResult {
  wod: GeneratedWod;
  params: GenerateParams;
  category: Category;
}

export function categoryFor(user: Pick<User, 'level' | 'gender'> | null, discipline: GenerateParams['discipline']): Category {
  return profileCategory(discipline, user?.level ?? null, user?.gender ?? null);
}

/**
 * Tire un WOD : catégorie du profil pour l'estimation (RX / Men par défaut),
 * anti-répétition sur les 10 dernières signatures, classe du jour en
 * « Après ma classe » (sans box ni WOD publié : pas de filtre).
 */
export async function generateForUser(
  user: Pick<User, 'id' | 'level' | 'gender'>,
  boxId: string | null | undefined,
  screen: ScreenParams,
  seed: number = newSeed(),
): Promise<GenerateResult> {
  const [{ catalog, bank }, signatures, dayClass] = await Promise.all([
    loadEngineData(),
    recentSignatures(user.id),
    screen.entry === 'after_class' ? todayClass(boxId) : Promise.resolve(null),
  ]);
  const category = categoryFor(user, screen.discipline);
  const params: GenerateParams = {
    ...screen,
    recent_signatures: signatures,
    profile_category: category,
    after_class: screen.entry === 'after_class' && dayClass
      ? { day_movements: dayClass.movements, box_wod_title: dayClass.title }
      : null,
  };
  const wod = generateBlocC(params, catalog, bank, seed);
  return { wod, params, category };
}

/** Re-tirage : mêmes paramètres (signatures relues), nouvelle graine. */
export function redraw(
  user: Pick<User, 'id' | 'level' | 'gender'>,
  boxId: string | null | undefined,
  screen: ScreenParams,
): Promise<GenerateResult> {
  return generateForUser(user, boxId, screen, newSeed());
}

// ── Historique / favori / score ─────────────────────────────────────────────

const LEVEL_OF_CATEGORY: Record<Category, string> = {
  scaled: 'scaled', inter: 'inter', rx: 'rx', rxplus: 'rx+', elite: 'elite', pro: 'pro',
  women: 'rx', men: 'rx', women_pro: 'rx+', men_pro: 'rx+',
};

/** Insère dans `generated_wods` : colonnes texte (rendu) + `wod_json` (structuré). */
export async function saveGeneratedWod(userId: string, wod: GeneratedWod, category: Category): Promise<string> {
  const equipment = Array.from(new Set(
    wod.blocks.flatMap((b) => b.movements.map((m) => m.id)),
  ));
  const { data, error } = await supabase
    .from('generated_wods')
    .insert({
      user_id: userId,
      sport: wod.discipline,
      wod_name: wod.title,
      wod_type: wod.wod_type,
      duration: wod.budget_min,
      level: LEVEL_OF_CATEGORY[category],
      format: wod.format,
      movements: wod.description,
      scoring: wod.score_type,
      coach_tip: wod.stimulus.note,
      team_note: null,
      equipment,
      is_benchmark: false,
      wod_json: wod as unknown as Json,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function setFavorite(wodId: string, value: boolean): Promise<void> {
  const { error } = await supabase.from('generated_wods').update({ is_favorite: value }).eq('id', wodId);
  if (error) throw error;
}

export type ScoreInputType = 'time' | 'reps' | 'rounds' | 'weight';

/** Type de saisie proposé par défaut selon le score du moteur. */
export function scoreInputTypeFor(wod: GeneratedWod): ScoreInputType {
  switch (wod.score_type) {
    case 'time': return 'time';
    case 'rounds_reps': return 'rounds';
    default: return 'reps';
  }
}

export interface ScoreSubmission {
  wodId: string;
  scoreType: ScoreInputType;
  value: number;
  /** catégorie réalisée, demandée à la saisie */
  category: Category;
  notes: string;
}

/** Type WodEditor du moteur → libellé attendu par `computeCompletedMovements`. */
const PARSER_WOD_TYPE: Record<GeneratedWod['wod_type'], string> = {
  'for-time': 'For Time', amrap: 'AMRAP', emom: 'EMOM', tabata: 'Tabata', strength: 'Strength', custom: 'Custom',
};

const RX_OR_ABOVE: ReadonlySet<Category> = new Set<Category>(['rx', 'rxplus', 'elite', 'pro', 'men', 'women', 'men_pro', 'women_pro']);

/** Score + compteurs + crédit de badges par mouvement (grammaire du rendu texte). */
export async function submitGeneratedScore(
  user: Pick<User, 'id' | 'gender'>,
  boxId: string | null | undefined,
  wod: GeneratedWod,
  s: ScoreSubmission,
): Promise<void> {
  const notes = [`Catégorie : ${CATEGORY_LABEL[s.category]}`, s.notes.trim()].filter(Boolean).join('\n');
  const { error } = await supabase.from('generated_wod_scores').insert({
    wod_id: s.wodId,
    user_id: user.id,
    score_type: s.scoreType,
    score_value: s.value,
    rx: RX_OR_ABOVE.has(s.category),
    notes,
  });
  if (error) throw error;
  incrementCounter(user.id, 'total_scores_submitted', 1, boxId ?? undefined)
    .catch((e) => captureError(e, { action: 'incrementScores' }));
  cancelTodayScoreReminder().catch((e) => captureError(e, { action: 'cancelScoreReminder' }));
  const lines = wod.description.split('\n').filter(Boolean);
  const completed = computeCompletedMovements(lines, PARSER_WOD_TYPE[wod.wod_type], s.value, s.scoreType, { gender: user.gender });
  logMovementReps(user.id, completed, 'wod', s.wodId)
    .catch((e) => captureError(e, { action: 'logMovementReps' }));
}
