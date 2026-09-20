/**
 * Générateur de WOD (bloc C) côté app : prépare les paramètres du moteur
 * (signatures récentes, classe du jour, exclusions du profil), tire un WOD
 * hors ligne avec `packages/wod-engine`, puis enregistre historique / favori /
 * score dans les tables existantes (`generated_wods`, `generated_wod_scores`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Json } from '../types/supabase';
import { BoxWOD, User } from '../types';
import { incrementCounter, logMovementReps } from './gamification';
import type { MovementEntry } from './gamification';
import { cancelTodayScoreReminder } from './notifications';
import { computeCompletedMovements } from '../utils/movementParser';
import { captureError } from '../lib/sentry';
import {
  generateBlocC, generateMuscu, profileCategory, muscuLevelFor, renderMuscu, exerciseLine, CATEGORY_LABEL,
} from '../../packages/wod-engine/src';
import type {
  Category, GenerateParams, GeneratedWod, MuscuExercise, MuscuEquipment, MuscuParams, MuscuWod,
} from '../../packages/wod-engine/src';
import { loadEngineData } from './wodEngineData';
import { fetchMyPersonalRecords } from './myProfile';
import { readBodyweightKg } from '../screens/profile/prStorage';
import { muscuOneRepMax } from '../screens/wod/muscuOptions';
import { gymRecordsFrom } from '../screens/wod/gymRecords';

export const SIGNATURE_WINDOW = 10;

/** Paramètres Functional / Hybrid choisis à l'écran ; le service complète signatures, catégorie et classe du jour. */
export type MetconScreenParams = Pick<GenerateParams, 'entry' | 'discipline' | 'budget_min' | 'format' | 'intention' | 'vest' | 'exclude'> & {
  adapt_to_pr?: boolean;
};

/** Paramètres Musculation ; le service complète niveau, 1RM, poids de corps, signatures et classe du jour. */
export type MuscuScreenParams = Pick<MuscuParams, 'entry' | 'target' | 'objective' | 'budget_min' | 'equipment' | 'exclude'> & {
  discipline: 'musculation';
};

export type ScreenParams = MetconScreenParams | MuscuScreenParams;

export function isMuscuScreen(screen: ScreenParams): screen is MuscuScreenParams {
  return screen.discipline === 'musculation';
}

export type AnyWod = GeneratedWod | MuscuWod;

export function isMuscuWod(wod: AnyWod): wod is MuscuWod {
  return wod.discipline === 'musculation';
}

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

type LastParams = { exclude?: unknown; muscu_equipment?: unknown; adapt_to_pr?: unknown } & Record<string, unknown>;

const MUSCU_EQUIPMENTS: readonly MuscuEquipment[] = ['none', 'box', 'gym'];

async function readLastParams(userId: string): Promise<LastParams | null> {
  const { data, error } = await supabase
    .from('user_generation_settings')
    .select('last_params')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.last_params ?? null) as LastParams | null;
}

const settingsWrites = new Map<string, Promise<void>>();

function patchLastParams(userId: string, patch: Record<string, Json>, action: string): Promise<void> {
  const pending = (settingsWrites.get(userId) ?? Promise.resolve()).then(async () => {
    try {
      const prev = (await readLastParams(userId)) ?? {};
      const last_params = { ...prev, ...patch } as Json;
      const { error } = await supabase
        .from('user_generation_settings')
        .upsert({ user_id: userId, last_params, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (e) {
      captureError(e, { action });
    }
  });
  settingsWrites.set(userId, pending);
  return pending.finally(() => {
    if (settingsWrites.get(userId) === pending) settingsWrites.delete(userId);
  });
}

export async function loadAdaptToPr(userId: string): Promise<boolean> {
  try {
    return (await readLastParams(userId))?.adapt_to_pr !== false;
  } catch {
    return true;
  }
}

export function saveAdaptToPr(userId: string, enabled: boolean): Promise<void> {
  return patchLastParams(userId, { adapt_to_pr: enabled }, 'saveAdaptToPr');
}

/** Dernier matériel Musculation choisi (`last_params.muscu_equipment`), `box` par défaut. */
export async function loadMuscuEquipment(userId: string): Promise<MuscuEquipment> {
  try {
    const eq = (await readLastParams(userId))?.muscu_equipment;
    return MUSCU_EQUIPMENTS.find((e) => e === eq) ?? 'box';
  } catch {
    return 'box';
  }
}

export function saveMuscuEquipment(userId: string, equipment: MuscuEquipment): Promise<void> {
  return patchLastParams(userId, { muscu_equipment: equipment }, 'saveMuscuEquipment');
}

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

export function saveExcludes(userId: string, exclude: string[]): Promise<void> {
  return patchLastParams(userId, { exclude }, 'saveExcludes');
}

// ── Tirage ───────────────────────────────────────────────────────────────────

export interface MetconResult {
  wod: GeneratedWod;
  params: GenerateParams;
  category: Category;
}

export interface MuscuResult {
  wod: MuscuWod;
  params: MuscuParams;
  category: Category;
}

export type GenerateResult = MetconResult | MuscuResult;

export function isMuscuResult(r: GenerateResult): r is MuscuResult {
  return r.wod.discipline === 'musculation';
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
  screen: MetconScreenParams,
  seed?: number,
): Promise<MetconResult>;
export async function generateForUser(
  user: Pick<User, 'id' | 'level' | 'gender'>,
  boxId: string | null | undefined,
  screen: MuscuScreenParams,
  seed?: number,
): Promise<MuscuResult>;
export async function generateForUser(
  user: Pick<User, 'id' | 'level' | 'gender'>,
  boxId: string | null | undefined,
  screen: ScreenParams,
  seed?: number,
): Promise<GenerateResult>;
export async function generateForUser(
  user: Pick<User, 'id' | 'level' | 'gender'>,
  boxId: string | null | undefined,
  screen: ScreenParams,
  seed: number = newSeed(),
): Promise<GenerateResult> {
  if (isMuscuScreen(screen)) return generateMuscuForUser(user, boxId, screen, seed);
  const { adapt_to_pr = true, ...engineScreen } = screen;
  const [{ catalog, bank }, signatures, dayClass, records] = await Promise.all([
    loadEngineData(),
    recentSignatures(user.id),
    screen.entry === 'after_class' ? todayClass(boxId) : Promise.resolve(null),
    adapt_to_pr ? fetchMyPersonalRecords().catch(() => ({} as Record<string, unknown>)) : Promise.resolve({}),
  ]);
  const category = categoryFor(user, screen.discipline);
  const params: GenerateParams = {
    ...engineScreen,
    recent_signatures: signatures,
    profile_category: category,
    gym_records: adapt_to_pr ? gymRecordsFrom(records) : undefined,
    after_class: screen.entry === 'after_class' && dayClass
      ? { day_movements: dayClass.movements, box_wod_title: dayClass.title }
      : null,
  };
  const wod = generateBlocC(params, catalog, bank, seed);
  return { wod, params, category };
}

/**
 * Mémoire des tirages Musculation (lot B). Le moteur pénalise (×4, mode « Sans
 * matériel ») un exercice sorti aux derniers tirages, mais il ne sait rien de
 * l'historique : c'est l'écran qui doit le lui donner. Clé locale par
 * utilisateur, préfixe `@athlex:` donc purgée à la déconnexion (appareil
 * partagé), remplacée à chaque tirage — re-tirage compris, c'est le but.
 */
const MUSCU_RECENT_DRAWS = 3;
const muscuRecentKey = (userId: string) => `@athlex:muscuRecent:${userId}`;

export async function loadRecentExerciseIds(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(muscuRecentKey(userId));
    const draws = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(draws) ? Array.from(new Set(draws.flat().filter((x): x is string => typeof x === 'string'))) : [];
  } catch { return []; }
}

export async function rememberExerciseIds(userId: string, ids: string[]): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(muscuRecentKey(userId));
    const draws = raw ? (JSON.parse(raw) as unknown) : [];
    const prev = Array.isArray(draws) ? (draws as string[][]) : [];
    await AsyncStorage.setItem(muscuRecentKey(userId), JSON.stringify([ids, ...prev].slice(0, MUSCU_RECENT_DRAWS)));
  } catch (e) { captureError(e, { action: 'rememberExerciseIds' }); }
}

/**
 * Musculation : niveau du profil (Scaled → débutant, Inter / RX → intermédiaire,
 * RX+ / Elite / Pro → avancé), 1RM et poids de corps lus dans
 * `profiles.personal_records` (RPC privée), classe du jour en « Après ma classe ».
 * La catégorie Functional du profil est conservée pour l'historique (`level`).
 */
async function generateMuscuForUser(
  user: Pick<User, 'id' | 'level' | 'gender'>,
  boxId: string | null | undefined,
  screen: MuscuScreenParams,
  seed: number,
): Promise<MuscuResult> {
  const [{ catalog, bank }, signatures, dayClass, records, recentIds] = await Promise.all([
    loadEngineData(),
    recentSignatures(user.id),
    screen.entry === 'after_class' ? todayClass(boxId) : Promise.resolve(null),
    fetchMyPersonalRecords().catch(() => ({} as Record<string, unknown>)),
    loadRecentExerciseIds(user.id),
  ]);
  const params: MuscuParams = {
    entry: screen.entry,
    target: screen.target,
    objective: screen.objective,
    budget_min: screen.budget_min,
    equipment: screen.equipment,
    exclude: screen.exclude,
    level: muscuLevelFor(user.level ?? null),
    recent_signatures: signatures,
    recent_exercise_ids: recentIds,
    one_rep_max: muscuOneRepMax(records),
    bodyweight_kg: readBodyweightKg(records),
    after_class: screen.entry === 'after_class' && dayClass
      ? { day_movements: dayClass.movements, box_wod_title: dayClass.title }
      : null,
  };
  const wod = generateMuscu(params, catalog, bank, seed);
  await rememberExerciseIds(user.id, wod.blocks[0].exercises.map((e) => e.id));
  return { wod: { ...wod, description: renderMuscu(wod) }, params, category: categoryFor(user, 'functional') };
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
export async function saveGeneratedWod(userId: string, wod: AnyWod, category: Category): Promise<string> {
  const equipment = Array.from(new Set(
    isMuscuWod(wod)
      ? wod.blocks[0].exercises.map((e) => e.id)
      : wod.blocks.flatMap((b) => b.movements.map((m) => m.id)),
  ));
  const { data, error } = await supabase
    .from('generated_wods')
    .insert({
      user_id: userId,
      sport: wod.discipline,
      wod_name: wod.title,
      wod_type: wod.wod_type,
      duration: wod.budget_min,
      level: isMuscuWod(wod) ? wod.level : LEVEL_OF_CATEGORY[category],
      format: isMuscuWod(wod) ? 'Solo' : wod.format,
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

/** Colonnes éditeur du WOD généré au format attendu par `wodToTimer` / `box_wods` (null → undefined). */
/**
 * `rounds` au sens de l'éditeur / du minuteur : en EMOM c'est le nombre d'intervalles
 * (cap ÷ intervalle), pas le nombre de passages sur les stations que porte le moteur.
 */
export function editorRoundsOf(wod: GeneratedWod): number | null {
  if (wod.wod_type === 'emom') {
    const interval = wod.emom_interval_minutes && wod.emom_interval_minutes > 0 ? wod.emom_interval_minutes : 1;
    const cap = wod.time_cap_seconds ?? wod.budget_min * 60;
    return Math.max(1, Math.round(cap / 60 / interval));
  }
  return wod.rounds ?? null;
}

export function editorFieldsOf(wod: GeneratedWod): Pick<
  BoxWOD,
  'wod_type' | 'time_cap_seconds' | 'rounds' | 'emom_interval_minutes' | 'tabata_work_seconds' | 'tabata_rest_seconds'
> {
  return {
    wod_type: wod.wod_type,
    time_cap_seconds: wod.time_cap_seconds ?? undefined,
    rounds: editorRoundsOf(wod) ?? undefined,
    emom_interval_minutes: wod.emom_interval_minutes ?? undefined,
    tabata_work_seconds: wod.tabata_work_seconds ?? undefined,
    tabata_rest_seconds: wod.tabata_rest_seconds ?? undefined,
  };
}

/**
 * Ajoute le WOD généré au Whiteboard de l'athlète : WOD perso dans `box_wods`
 * (`box_id` null, `created_by` = athlète, `scheduled_date` = aujourd'hui,
 * `description` = rendu texte). Le JSON structuré reste dans
 * `generated_wods.wod_json`, complété de `box_wod_id` pour lier les deux.
 * Un score déjà saisi depuis la page résultat est recopié dans `wod_scores`
 * sur ce WOD (flux normal du Whiteboard), pas dupliqué côté `generated_wod_scores`.
 */
/**
 * B7 : la séance n'est plus une ligne de texte unique. Chaque exercice
 * (Musculation) ou chaque bloc (Functional / Hybrid) devient une ligne
 * `box_wods` — `block_name`, `sort_order`, `wod_json` et description rendue,
 * comme une séance de box — pour être validée et scorée bloc par bloc depuis
 * le Whiteboard.
 */
export interface WhiteboardRow {
  title: string;
  description: string;
  wod_type: AnyWod['wod_type'];
  block_name: string;
  sort_order: number;
  time_cap_seconds: number | null;
  rounds: number | null;
  emom_interval_minutes: number | null;
  tabata_work_seconds: number | null;
  tabata_rest_seconds: number | null;
  notes: string | null;
  wod_json: unknown;
}

export function whiteboardRows(wod: AnyWod): WhiteboardRow[] {
  if (isMuscuWod(wod)) {
    return wod.blocks[0].exercises.map((e, i) => ({
      title: e.name,
      description: exerciseLine(e),
      wod_type: 'strength',
      block_name: 'strength',
      sort_order: i,
      time_cap_seconds: null,
      rounds: null,
      emom_interval_minutes: null,
      tabata_work_seconds: null,
      tabata_rest_seconds: null,
      notes: i === 0 ? wod.stimulus.note : null,
      wod_json: { ...wod, blocks: [{ kind: 'strength_session', exercises: [e] }] },
    }));
  }
  return wod.blocks.map((b, i) => ({
    title: wod.blocks.length > 1 ? `${wod.title} · bloc ${i + 1}` : wod.title,
    description: wod.description,
    wod_type: wod.wod_type,
    block_name: 'wod',
    sort_order: i,
    time_cap_seconds: wod.time_cap_seconds,
    rounds: editorRoundsOf(wod),
    emom_interval_minutes: wod.emom_interval_minutes,
    tabata_work_seconds: wod.tabata_work_seconds,
    tabata_rest_seconds: wod.tabata_rest_seconds,
    notes: wod.stimulus.note,
    wod_json: wod.blocks.length > 1 ? { ...wod, blocks: [b] } : wod,
  }));
}

export async function addToWhiteboard(
  userId: string,
  wod: AnyWod,
  generatedId: string,
  existingScore: ScoreSubmission | null,
  scheduledDate: string = todayISO(),
): Promise<string> {
  const rows = whiteboardRows(wod).map((r) => ({
    ...r,
    box_id: null,
    created_by: userId,
    scheduled_date: scheduledDate,
    is_published: true,
    leaderboard_enabled: false,
    wod_json: r.wod_json as Json,
  }));
  const { data, error } = await supabase
    .from('box_wods')
    .insert(rows)
    .select('id');
  if (error) throw error;
  const ids = (data ?? []).map((d) => d.id as string);
  const boxWodId = ids[0];
  if (!boxWodId) throw new Error('aucune ligne posée sur le Whiteboard');

  const { error: linkError } = await supabase
    .from('generated_wods')
    .update({ wod_json: { ...wod, box_wod_id: boxWodId, box_wod_ids: ids } as unknown as Json })
    .eq('id', generatedId);
  if (linkError) captureError(linkError, { action: 'linkBoxWod' });

  if (existingScore) {
    const rx = RX_OR_ABOVE.has(existingScore.category);
    const { error: scoreError } = await supabase.from('wod_scores').upsert({
      wod_id: boxWodId,
      member_id: userId,
      box_id: null,
      score_type: existingScore.scoreType,
      score_value: existingScore.value,
      capped: false,
      rx,
      scaled: !rx,
      notes: scoreNotes(wod, existingScore),
    }, { onConflict: 'wod_id,member_id' });
    if (scoreError) throw scoreError;
  }
  return boxWodId;
}

function scoreNotes(wod: AnyWod, s: Pick<ScoreSubmission, 'category' | 'notes'>): string {
  const head = isMuscuWod(wod) ? 'Tonnage (kg × reps)' : `Catégorie : ${CATEGORY_LABEL[s.category]}`;
  return [head, s.notes.trim()].filter(Boolean).join('\n');
}

// ── Musculation : séries réalisées → tonnage ────────────────────────────────

/** Une série réellement effectuée (saisie à l'écran). */
export interface PerformedSet {
  reps: number;
  load_kg: number;
}

/** Séries réalisées par exercice, dans l'ordre de la séance (`exercise_id` = ligne du bloc). */
export interface PerformedExercise {
  exercise_id: string;
  name: string;
  sets: PerformedSet[];
}

/** Tonnage d'une série : charge × reps ; au poids du corps (0 kg) la série ne compte pas. */
export function setTonnage(s: PerformedSet): number {
  return s.load_kg > 0 && s.reps > 0 ? s.load_kg * s.reps : 0;
}

export function totalTonnage(performed: readonly PerformedExercise[]): number {
  return performed.reduce((sum, ex) => sum + ex.sets.reduce((acc, s) => acc + setTonnage(s), 0), 0);
}

/** Séries prévues par le moteur → séries pré-remplies (reps et kg du 1RM connus, sinon 0 kg). */
export function plannedSets(e: MuscuExercise): PerformedSet[] {
  const reps = e.reps_unit === 'reps' ? e.reps : 0;
  const load_kg = e.load.mode === '1rm' || e.load.mode === 'weighted' ? e.load.kg ?? 0 : 0;
  return Array.from({ length: e.sets }, () => ({ reps, load_kg }));
}

/**
 * Reps réellement faites par mouvement, pour le crédit de badges : somme des
 * reps saisies (les séries en secondes / mètres ne créditent rien), charge la
 * plus lourde de l'exercice. Jamais relu depuis `strength_set_logs`.
 */
export function performedMovementEntries(performed: readonly PerformedExercise[]): MovementEntry[] {
  const out: MovementEntry[] = [];
  for (const ex of performed) {
    const reps = ex.sets.reduce((acc, s) => acc + Math.max(0, Math.floor(s.reps)), 0);
    if (reps <= 0) continue;
    const weight = Math.max(0, ...ex.sets.filter((s) => s.reps > 0).map((s) => s.load_kg));
    out.push({ name: ex.name, reps, unit: 'reps', ...(weight > 0 ? { weight_kg: weight } : {}) });
  }
  return out;
}

export interface MuscuScoreSubmission {
  wodId: string;
  performed: PerformedExercise[];
  notes: string;
}

/**
 * Score Musculation : tonnage total dans `generated_wod_scores`
 * (`score_type = 'weight'`), compteur, puis crédit de badges d'après les reps
 * saisies via `logMovementReps` — indépendant du journal `strength_set_logs`.
 */
export async function submitMuscuScore(
  user: Pick<User, 'id'>,
  boxId: string | null | undefined,
  wod: MuscuWod,
  s: MuscuScoreSubmission,
): Promise<number> {
  const tonnage = totalTonnage(s.performed);
  const { error } = await supabase.from('generated_wod_scores').insert({
    wod_id: s.wodId,
    user_id: user.id,
    score_type: 'weight',
    score_value: tonnage,
    rx: wod.level !== 'debutant',
    notes: scoreNotes(wod, { category: 'rx', notes: s.notes }),
  });
  if (error) throw error;
  incrementCounter(user.id, 'total_scores_submitted', 1, boxId ?? undefined)
    .catch((e) => captureError(e, { action: 'incrementScores' }));
  cancelTodayScoreReminder().catch((e) => captureError(e, { action: 'cancelScoreReminder' }));
  logMovementReps(user.id, performedMovementEntries(s.performed), 'wod', s.wodId)
    .catch((e) => captureError(e, { action: 'logMovementReps' }));
  return tonnage;
}

/** Score + compteurs + crédit de badges par mouvement (grammaire du rendu texte). */
export async function submitGeneratedScore(
  user: Pick<User, 'id' | 'gender'>,
  boxId: string | null | undefined,
  wod: GeneratedWod,
  s: ScoreSubmission,
): Promise<void> {
  const notes = scoreNotes(wod, s);
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
