// Journal des séries réellement réalisées (lot 4).
//
// Le lot 2 collectait UNE charge par mouvement et calculait le 1RM avec les reps
// PRESCRITES : un 5 × 3 réellement exécuté 5, 5, 3 produisait un 1RM estimé sur
// 3 reps alors que l'athlète en avait poussé 5. Le chiffre était faux, plausible,
// et invérifiable puisque le travail n'était nulle part.
//
// Ici la grille est la source : une ligne par série prescrite, pré-remplie avec
// la prescription (reps, et charge résolue depuis le %1RM), modifiable ligne par
// ligne. L'athlète qui a fait exactement ce qui était prescrit valide sans rien
// toucher ; celui qui a dévié corrige la ligne concernée, et c'est cette valeur
// qui part au journal ET au calcul du 1RM.
//
// Ce service n'écrit JAMAIS dans `movement_logs` : cette table crédite les
// badges et les reps à vie, et le lot 2 a délibérément exclu les blocs de force
// de ce crédit. Un test verrouille cette séparation.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { captureError } from '../lib/sentry';
import { StrengthEntry, resolveStrengthLoadKg } from '../utils/strengthBlock';
import { weightliftingPrLabel } from '../screens/profile/prStorage';
import { gymRepsForPct } from '../screens/home/gymZones';
import { bestOneRepMaxBySet, PerformedSet } from './strengthPR';
import type { Database, Json } from '../types/supabase';

/** Origine d'une série : le couple (type, id) survivra à la mort de program_wods. */
export type StrengthSourceType = 'whiteboard' | 'program' | 'generated';

/** Une ligne de la grille de saisie : ce que l'athlète déclare avoir fait. */
export interface StrengthSetDraft {
  /** Index du bloc dans la description (une même séance peut avoir plusieurs mouvements). */
  entryIndex: number;
  /**
   * Numéro de stockage, 1-based, continu par mouvement sur toute la séance
   * (`numberSetsByMovement`) ; l'affichage montre le rang dans le bloc (`setRanks`).
   */
  setIndex: number;
  name: string;
  /** Saisies libres : la grille reste éditable, la validation se fait à l'écriture. */
  reps: string;
  loadKg: string;
  prescribedReps: number;
  prescribedLoadKg: number | null;
  /**
   * Gymnastique prescrite en % du record (« 3 × 15 % du max ») : les reps
   * prévues en découlent ; sans record, `prescribedReps` vaut 0 (inconnues).
   */
  prescribedPctOfMax?: number | null;
}

export interface StrengthSetRow {
  id: string;
  source_type: string;
  source_id: string;
  source_title: string | null;
  movement: string;
  movement_label: string | null;
  set_index: number;
  reps: number;
  load_kg: number | null;
  prescribed_reps: number | null;
  prescribed_load_kg: number | null;
  performed_at: string;
}

function toNumber(text: string): number | null {
  const n = parseFloat((text ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Saisie décimale : virgule (clavier iOS en français) ou point, un seul séparateur gardé. */
export function normalizeDecimalInput(text: string): string {
  const cleaned = (text ?? '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  return dot < 0 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
}

/** Saisie des reps : chiffres seuls. */
export function normalizeRepsInput(text: string): string {
  return (text ?? '').replace(/\D/g, '');
}

/** Valeur numérique d'une saisie décimale (« 102,5 » comme « 102.5 »). */
export function parseDecimal(text: string): number | null {
  return toNumber(text);
}

/** Plafond du CHECK `strength_set_logs.set_index` (1..50) : séries d'un mouvement dans une séance. */
export const MAX_SETS_PER_MOVEMENT = 50;

/**
 * Numéro de STOCKAGE des séries : continu par mouvement sur toute la séance.
 * Deux blocs « Front Squat » (2 × 3 puis 2 × 2) donnent 1, 2 puis 3, 4 : la clé
 * (athlète, source, mouvement, série) reste unique. Numéroter par bloc (1, 2,
 * 1, 2) la dédoublait — brouillon refusé en 21000, validation en
 * SERIES_EN_DOUBLE (1.0.58). L'athlète voit, lui, le rang dans le bloc
 * (`setRanks`).
 */
export function numberSetsByMovement<T extends { name: string; setIndex: number }>(drafts: T[]): T[] {
  const next = new Map<string, number>();
  return drafts.map(d => {
    const n = (next.get(d.name) ?? 0) + 1;
    next.set(d.name, n);
    return { ...d, setIndex: n };
  });
}

/**
 * Grille prête à écrire : renumérotée seulement si une clé (mouvement, série)
 * y est en double — une grille de la 1.0.58 (1, 2, 1, 2), copie locale
 * comprise. Une grille déjà unique est gardée telle quelle (une série hors
 * prescription, venue du serveur, garde son numéro).
 */
export function withUniqueSetKeys<T extends { name: string; setIndex: number }>(drafts: T[]): T[] {
  const unique = new Set(drafts.map(d => `${d.name}#${d.setIndex}`)).size === drafts.length;
  return unique ? drafts : numberSetsByMovement(drafts);
}

/** Rang de chaque série dans son bloc (« Série 1, 2, 3 » affiché), quel que soit son numéro de stockage. */
export function setRanks(drafts: { entryIndex: number }[]): number[] {
  const seen = new Map<number, number>();
  return drafts.map(d => {
    const n = (seen.get(d.entryIndex) ?? 0) + 1;
    seen.set(d.entryIndex, n);
    return n;
  });
}

/**
 * Grille pré-remplie par la prescription : une ligne par série.
 *
 * Un `%1RM` sans 1RM connu laisse la charge vide plutôt que d'en inventer une —
 * c'est déjà la règle de `resolveStrengthLoadKg`, elle ne change pas ici.
 */
export function buildStrengthGrid(
  entries: StrengthEntry[],
  oneRepMaxFor: (name: string) => number | null,
  gymRecordFor: (name: string) => number | null = () => null,
): StrengthSetDraft[] {
  const out: StrengthSetDraft[] = [];
  const perMovement = new Map<string, number>();
  entries.forEach((e, entryIndex) => {
    const kg = resolveStrengthLoadKg(e, oneRepMaxFor(e.name));
    // % du record : reps calculées, ou vides sans record (jamais inventées).
    const reps = e.pctOfMax != null ? gymRepsForPct(gymRecordFor(e.name), e.pctOfMax) ?? 0 : e.reps;
    const sets = Math.max(1, Math.min(MAX_SETS_PER_MOVEMENT, Math.round(e.sets)));
    for (let s = 1; s <= sets; s++) {
      const setIndex = (perMovement.get(e.name) ?? 0) + 1;
      // ponytail: au-delà de 50 séries d'un même mouvement dans la séance, les
      // suivantes ne sont pas proposées (CHECK set_index ≤ 50) ; une migration
      // relèvera le plafond si une vraie séance le dépasse un jour.
      if (setIndex > MAX_SETS_PER_MOVEMENT) break;
      perMovement.set(e.name, setIndex);
      out.push({
        entryIndex,
        setIndex,
        name: e.name,
        reps: e.pctOfMax != null && reps < 1 ? '' : String(reps),
        loadKg: kg == null ? '' : String(kg),
        prescribedReps: reps,
        prescribedLoadKg: kg,
        ...(e.pctOfMax != null ? { prescribedPctOfMax: e.pctOfMax } : {}),
      });
    }
  });
  return out;
}

/** Les lignes exploitables : une série sans reps ni charge valides n'est pas une série. */
export function usableDrafts(drafts: StrengthSetDraft[]): StrengthSetDraft[] {
  return drafts.filter(d => {
    const reps = toNumber(d.reps);
    const load = toNumber(d.loadKg);
    return reps != null && reps >= 1 && load != null && load > 0;
  });
}

export interface LogStrengthSetsParams {
  userId: string;
  sourceType: StrengthSourceType;
  sourceId: string;
  sourceTitle: string | null;
  drafts: StrengthSetDraft[];
}

/**
 * Écrit le journal de la séance et rend les séries réalisées, chacune porteuse
 * de l'`id` de sa ligne : c'est cet id qui permet de rattacher un 1RM à la
 * séance qui l'a établi (sinon la provenance serait déduite d'une date, donc
 * fausse dès qu'un athlète enregistre deux séances le même jour).
 *
 * La réécriture est un upsert sur (athlète, source, mouvement, série) suivi de
 * la purge des séries non réécrites : corriger son score corrige l'historique,
 * il ne l'empile pas — et trois séries déclarées après cinq, c'est trois séries.
 */
export async function logStrengthSets(p: LogStrengthSetsParams): Promise<PerformedSet[]> {
  const usable = usableDrafts(withUniqueSetKeys(p.drafts));
  // Une grille entièrement vide n'est PAS une déclaration de « zéro série » :
  // le pré-remplissage repart de la prescription à chaque ouverture, donc un
  // %1RM non résolu rend les charges vides sans que l'athlète ait rien dit.
  // Purger ici effacerait son historique sur un geste qu'il n'a pas fait. On
  // retire une série en soumettant moins de lignes, pas en les vidant toutes.
  if (usable.length === 0) return [];

  const rows = usable.map(d => ({
    user_id: p.userId,
    source_type: p.sourceType,
    source_id: p.sourceId,
    source_title: p.sourceTitle,
    movement: d.name,
    movement_label: weightliftingPrLabel(d.name),
    set_index: d.setIndex,
    reps: Math.round(toNumber(d.reps) as number),
    load_kg: toNumber(d.loadKg),
    prescribed_reps: d.prescribedReps,
    prescribed_load_kg: d.prescribedLoadKg,
  }));

  // Écriture d'abord, purge ensuite : l'inverse (effacer puis réinsérer) perdrait
  // l'historique de la séance si l'insertion échouait entre les deux.
  const { data, error } = await supabase
    .from('strength_set_logs')
    .upsert(rows, { onConflict: 'user_id,source_type,source_id,movement,set_index' })
    .select('id, movement, reps, load_kg');
  if (error || !data) {
    captureError(error ?? new Error('upsert strength_set_logs sans données'),
      { service: 'strengthSets', action: 'upsert' });
    return [];
  }

  // Les séries retirées de la grille (5 séries déclarées puis corrigées à 3)
  // sortent du journal : le laisser les garder ferait mentir l'historique.
  const keptIds = data.map(r => r.id);
  const { error: pruneErr } = await supabase
    .from('strength_set_logs')
    .delete()
    .eq('user_id', p.userId)
    .eq('source_type', p.sourceType)
    .eq('source_id', p.sourceId)
    .not('id', 'in', `(${keptIds.join(',')})`);
  if (pruneErr) captureError(pruneErr, { service: 'strengthSets', action: 'prune' });

  return data
    .filter(r => r.load_kg != null)
    .map(r => ({
      name: r.movement,
      loadKg: Number(r.load_kg),
      reps: r.reps,
      logId: r.id,
    }));
}

/** Historique de l'athlète (sa propre trace : la RLS suffit, pas de RPC). */
export async function fetchMyStrengthSets(limit = 200): Promise<StrengthSetRow[]> {
  const { data, error } = await supabase
    .from('strength_set_logs')
    .select('id, source_type, source_id, source_title, movement, movement_label, set_index, reps, load_kg, prescribed_reps, prescribed_load_kg, performed_at')
    .order('performed_at', { ascending: false })
    .order('movement', { ascending: true })
    .order('set_index', { ascending: true })
    .limit(limit);
  if (error) {
    captureError(error, { service: 'strengthSets', action: 'fetchMine' });
    return [];
  }
  return (data ?? []).map(r => ({ ...r, load_kg: r.load_kg == null ? null : Number(r.load_kg) }));
}

export interface StrengthSession {
  key: string;
  sourceType: string;
  sourceId: string;
  sourceTitle: string | null;
  performedAt: string;
  movement: string;
  movementLabel: string | null;
  sets: { setIndex: number; reps: number; loadKg: number | null; id: string }[];
}

/** Regroupe les séries par (séance, mouvement) — l'unité que l'athlète a vécue. */
export function groupStrengthSessions(rows: StrengthSetRow[]): StrengthSession[] {
  const map = new Map<string, StrengthSession>();
  for (const r of rows) {
    const key = `${r.source_id}::${r.movement}`;
    const existing = map.get(key);
    if (existing) {
      existing.sets.push({ setIndex: r.set_index, reps: r.reps, loadKg: r.load_kg, id: r.id });
      continue;
    }
    map.set(key, {
      key,
      sourceType: r.source_type,
      sourceId: r.source_id,
      sourceTitle: r.source_title,
      performedAt: r.performed_at,
      movement: r.movement,
      movementLabel: r.movement_label,
      sets: [{ setIndex: r.set_index, reps: r.reps, loadKg: r.load_kg, id: r.id }],
    });
  }
  const list = [...map.values()];
  for (const s of list) s.sets.sort((a, b) => a.setIndex - b.setIndex);
  return list.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
}

// ═══ Séance de musculation côté serveur (brouillon, reprise, validation) ═══════
//
// La séance (`strength_sessions`) et ses séries forment le brouillon : écrit au
// fil de la saisie, relu sur n'importe quel appareil. Un brouillon ne touche ni
// score, ni 1RM, ni compteurs. Seule `validate_strength_session` valide : séries,
// charge max, score Whiteboard et 1RM en une transaction ; elle rend
// `premiere_validation`, qui seul autorise compteurs, badges et notifications.

/** Tables et fonction de la migration 20270138, absentes des types générés. */
type SetLogs = Database['public']['Tables']['strength_set_logs'];
interface StrengthDb {
  public: {
    Tables: {
      strength_sessions: {
        Row: {
          id: string;
          user_id: string;
          source_type: string;
          source_id: string;
          source_title: string | null;
          status: string;
          planned_sets: number | null;
          max_load_kg: number | null;
          first_validated_at: string | null;
          validated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          source_type: string;
          source_id: string;
          source_title?: string | null;
          planned_sets?: number | null;
          updated_at?: string;
        };
        Update: {
          source_title?: string | null;
          planned_sets?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      strength_set_logs: {
        Row: Omit<SetLogs['Row'], 'reps'> & { reps: number | null };
        Insert: Omit<SetLogs['Insert'], 'reps'> & { reps?: number | null };
        Update: Omit<SetLogs['Update'], 'reps'> & { reps?: number | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      validate_strength_session: {
        Args: {
          p_source_type: string;
          p_source_id: string;
          p_source_title: string | null;
          p_planned_sets: number | null;
          p_rx: boolean;
          p_sets: Json;
          p_records?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
const db = supabase as unknown as SupabaseClient<StrengthDb>;

export type StrengthSessionStatus = 'draft' | 'validated';

export interface StrengthSessionInfo {
  status: StrengthSessionStatus;
  plannedSets: number | null;
  maxLoadKg: number | null;
  firstValidatedAt: string | null;
  updatedAt: string;
}

/** Série telle qu'enregistrée sur le serveur (reps vide possible dans un brouillon). */
export interface ServerSet {
  id: string;
  movement: string;
  movement_label: string | null;
  set_index: number;
  reps: number | null;
  load_kg: number | null;
  prescribed_reps: number | null;
  prescribed_load_kg: number | null;
}

export interface ServerStrengthSession {
  session: StrengthSessionInfo | null;
  sets: ServerSet[];
}

/** Copie locale d'un brouillon qui n'a pas pu partir (hors connexion). */
export interface PendingStrengthDraft {
  drafts: StrengthSetDraft[];
  /** Heure de la dernière frappe. */
  editedAt: string;
  /** `updated_at` de la version serveur sur laquelle la saisie est partie. */
  baseUpdatedAt: string | null;
}

export interface StrengthSourceKey {
  userId: string;
  sourceType: StrengthSourceType;
  sourceId: string;
}

const LIMITS = { reps: 500, loadKg: 500 };

const validReps = (text: string): number | null => {
  const n = toNumber(text);
  if (n == null) return null;
  const r = Math.round(n);
  return r >= 1 && r <= LIMITS.reps ? r : null;
};
const validLoad = (text: string): number | null => {
  const n = toNumber(text);
  return n != null && n > 0 && n <= LIMITS.loadKg ? Math.round(n * 100) / 100 : null;
};

/** Séries valides au sens de la validation serveur : reps 1..500, charge ]0 ; 500]. */
export function validStrengthSets(drafts: StrengthSetDraft[]): StrengthSetDraft[] {
  return drafts.filter(d => validReps(d.reps) != null && validLoad(d.loadKg) != null);
}

/** « n / N séries » : séries valides sur séries de la grille. */
export function strengthProgress(drafts: StrengthSetDraft[]): { done: number; total: number } {
  return { done: validStrengthSets(drafts).length, total: drafts.length };
}

/** Charge max (score « weight » du Whiteboard) : la plus lourde des séries valides. */
export function computedMaxLoad(drafts: StrengthSetDraft[]): number | null {
  const loads = validStrengthSets(drafts).map(d => validLoad(d.loadKg) as number);
  return loads.length ? Math.max(...loads) : null;
}

/** Tonnage des séries valides : somme reps × charge. */
export function strengthTonnage(drafts: StrengthSetDraft[]): number {
  const t = validStrengthSets(drafts)
    .reduce((sum, d) => sum + (validReps(d.reps) as number) * (validLoad(d.loadKg) as number), 0);
  return Math.round(t * 100) / 100;
}

/** Écart d'une série à sa prescription (reps et charge), null quand elle la suit. */
export interface StrengthSetDeviation {
  reps: { done: number; planned: number } | null;
  loadKg: { done: number; planned: number } | null;
}

export function strengthSetDeviation(d: StrengthSetDraft): StrengthSetDeviation {
  const reps = validReps(d.reps);
  const load = validLoad(d.loadKg);
  return {
    reps: reps != null && d.prescribedReps >= 1 && reps !== d.prescribedReps
      ? { done: reps, planned: d.prescribedReps } : null,
    loadKg: load != null && d.prescribedLoadKg != null && d.prescribedLoadKg > 0 && load !== d.prescribedLoadKg
      ? { done: load, planned: d.prescribedLoadKg } : null,
  };
}

/** État d'une séance pour une carte de liste : brouillon (n / N) ou validée. */
export interface StrengthCardSummary {
  status: StrengthSessionStatus;
  done: number;
  total: number;
}

/**
 * États des séances de l'athlète pour une liste de sources (les WOD de la
 * semaine) : une lecture groupée pour toute la liste, jamais une par carte.
 */
export async function fetchStrengthSummaries(
  userId: string,
  sourceType: StrengthSourceType,
  sourceIds: string[],
): Promise<Record<string, StrengthCardSummary>> {
  const ids = [...new Set(sourceIds)];
  if (ids.length === 0) return {};
  const [{ data: sessions, error: e1 }, { data: sets, error: e2 }] = await Promise.all([
    db.from('strength_sessions')
      .select('source_id, status, planned_sets')
      .eq('user_id', userId).eq('source_type', sourceType).in('source_id', ids),
    db.from('strength_set_logs')
      .select('source_id, reps, load_kg')
      .eq('user_id', userId).eq('source_type', sourceType).in('source_id', ids),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  const out: Record<string, StrengthCardSummary> = {};
  for (const s of sessions ?? []) {
    const rows = (sets ?? []).filter(r => r.source_id === s.source_id);
    const done = rows.filter(r => validReps(r.reps == null ? '' : String(r.reps)) != null
      && validLoad(r.load_kg == null ? '' : String(r.load_kg)) != null).length;
    out[s.source_id] = {
      status: s.status === 'validated' ? 'validated' : 'draft',
      done,
      total: Math.max(s.planned_sets ?? rows.length, done),
    };
  }
  return out;
}

const pendingKey = (k: StrengthSourceKey) => `@athlex:strengthDraft:${k.userId}:${k.sourceType}:${k.sourceId}`;

export async function loadPendingStrengthDraft(k: StrengthSourceKey): Promise<PendingStrengthDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(k));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PendingStrengthDraft>;
    if (!Array.isArray(p.drafts) || typeof p.editedAt !== 'string') return null;
    // Copie laissée par la 1.0.58, numérotée par bloc : renumérotée à la relecture.
    return { drafts: withUniqueSetKeys(p.drafts), editedAt: p.editedAt, baseUpdatedAt: p.baseUpdatedAt ?? null };
  } catch { return null; }
}

async function savePendingStrengthDraft(k: StrengthSourceKey, p: PendingStrengthDraft): Promise<void> {
  try { await AsyncStorage.setItem(pendingKey(k), JSON.stringify(p)); }
  catch (e) { captureError(e, { service: 'strengthSets', action: 'savePending' }); }
}

export async function clearPendingStrengthDraft(k: StrengthSourceKey): Promise<void> {
  try { await AsyncStorage.removeItem(pendingKey(k)); }
  catch (e) { captureError(e, { service: 'strengthSets', action: 'clearPending' }); }
}

/**
 * La version serveur l'emporte sur une copie locale quand la séance est validée,
 * ou quand elle a changé depuis la version d'origine de la copie ET après sa
 * dernière frappe (un autre appareil a enregistré plus tard).
 */
export function serverWins(session: StrengthSessionInfo | null, pending: PendingStrengthDraft): boolean {
  if (!session) return false;
  if (session.status === 'validated') return true;
  if (session.updatedAt === pending.baseUpdatedAt) return false;
  return Date.parse(session.updatedAt) > Date.parse(pending.editedAt);
}

const fmtKg = (n: number) => String(Number(n));

/**
 * Grille rechargée depuis le serveur. La prescription donne l'ordre et les
 * valeurs prévues ; une ligne sans série enregistrée reste vide (l'athlète l'a
 * vidée), une série hors prescription est ajoutée à la fin.
 */
export function gridFromServer(rawPrescription: StrengthSetDraft[], sets: ServerSet[]): StrengthSetDraft[] {
  // La série n du bloc b est retrouvée par son numéro de stockage, continu par
  // mouvement : deux blocs du même mouvement ne relisent jamais la même série.
  const prescription = withUniqueSetKeys(rawPrescription);
  const byKey = new Map(sets.map(s => [`${s.movement}#${s.set_index}`, s]));
  const used = new Set<string>();
  const out = prescription.map(d => {
    const key = `${d.name}#${d.setIndex}`;
    const s = byKey.get(key);
    if (!s) return { ...d, reps: '', loadKg: '' };
    used.add(key);
    return { ...d, reps: s.reps == null ? '' : String(s.reps), loadKg: s.load_kg == null ? '' : fmtKg(s.load_kg) };
  });
  const extra = sets
    .filter(s => !used.has(`${s.movement}#${s.set_index}`))
    .sort((a, b) => a.movement.localeCompare(b.movement) || a.set_index - b.set_index);
  for (const s of extra) {
    const same = out.find(d => d.name === s.movement);
    out.push({
      entryIndex: same ? same.entryIndex : 1000 + extra.indexOf(s),
      setIndex: s.set_index,
      name: s.movement,
      reps: s.reps == null ? '' : String(s.reps),
      loadKg: s.load_kg == null ? '' : fmtKg(s.load_kg),
      prescribedReps: s.prescribed_reps ?? 0,
      prescribedLoadKg: s.prescribed_load_kg == null ? null : Number(s.prescribed_load_kg),
    });
  }
  return out;
}

export type StrengthGridOrigin = 'server' | 'local' | 'prescription';

/** Choix de la grille affichée : serveur, copie locale plus récente, ou prescription. */
export function resolveStrengthGrid(
  prescription: StrengthSetDraft[],
  server: ServerStrengthSession | null,
  pending: PendingStrengthDraft | null,
): { drafts: StrengthSetDraft[]; origin: StrengthGridOrigin } {
  const session = server?.session ?? null;
  if (pending && !serverWins(session, pending)) return { drafts: pending.drafts, origin: 'local' };
  if (server && (session || server.sets.length > 0)) {
    return { drafts: gridFromServer(prescription, server.sets), origin: 'server' };
  }
  return { drafts: prescription, origin: 'prescription' };
}

/** Séance et séries de l'athlète pour cette source. Lève en cas d'échec (hors connexion). */
export async function fetchStrengthSession(k: StrengthSourceKey): Promise<ServerStrengthSession> {
  const [{ data: session, error: e1 }, { data: sets, error: e2 }] = await Promise.all([
    db.from('strength_sessions')
      .select('status, planned_sets, max_load_kg, first_validated_at, updated_at')
      .eq('user_id', k.userId).eq('source_type', k.sourceType).eq('source_id', k.sourceId)
      .maybeSingle(),
    db.from('strength_set_logs')
      .select('id, movement, movement_label, set_index, reps, load_kg, prescribed_reps, prescribed_load_kg')
      .eq('user_id', k.userId).eq('source_type', k.sourceType).eq('source_id', k.sourceId)
      .order('set_index', { ascending: true }),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  return {
    session: session
      ? {
          status: session.status === 'validated' ? 'validated' : 'draft',
          plannedSets: session.planned_sets,
          maxLoadKg: session.max_load_kg == null ? null : Number(session.max_load_kg),
          firstValidatedAt: session.first_validated_at,
          updatedAt: session.updated_at,
        }
      : null,
    sets: (sets ?? []).map(s => ({
      ...s,
      load_kg: s.load_kg == null ? null : Number(s.load_kg),
      prescribed_load_kg: s.prescribed_load_kg == null ? null : Number(s.prescribed_load_kg),
    })),
  };
}

/** Dernière séance en brouillon de l'athlète pour ce type de source (reprise sur un autre appareil). */
export async function latestStrengthDraft(
  userId: string,
  sourceType: StrengthSourceType,
): Promise<{ sourceId: string; updatedAt: string } | null> {
  const { data, error } = await db
    .from('strength_sessions')
    .select('source_id, updated_at')
    .eq('user_id', userId).eq('source_type', sourceType).eq('status', 'draft')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { sourceId: data.source_id, updatedAt: data.updated_at } : null;
}

export interface LoadedStrengthGrid {
  drafts: StrengthSetDraft[];
  origin: StrengthGridOrigin;
  server: ServerStrengthSession | null;
  /** La copie locale est en attente d'envoi (hors connexion, ou à renvoyer maintenant). */
  pending: PendingStrengthDraft | null;
  /** Lecture impossible faute de réseau. */
  offline: boolean;
  /** Lecture refusée par le serveur (jamais présentée comme une coupure réseau). */
  refused: boolean;
}

/**
 * Coupure réseau : postgrest-js rend alors `status 0` et `code ''` (fetch
 * échoué). Un refus de la base porte toujours un code (21000, 42501, PGRST…) :
 * il n'est jamais « hors connexion ».
 */
export function isNetworkError(e: unknown): boolean {
  const code = e && typeof e === 'object' && 'code' in e ? (e as { code: unknown }).code : undefined;
  return code == null || code === '';
}

/** Chargement de la grille : serveur d'abord, copie locale si elle est plus récente. */
export async function loadStrengthGrid(
  k: StrengthSourceKey,
  prescription: StrengthSetDraft[],
): Promise<LoadedStrengthGrid> {
  const pending = await loadPendingStrengthDraft(k);
  let server: ServerStrengthSession | null = null;
  try {
    server = await fetchStrengthSession(k);
  } catch (e) {
    captureError(e, { service: 'strengthSets', action: 'fetchSession' });
    const offline = isNetworkError(e);
    return {
      drafts: pending?.drafts ?? prescription, origin: pending ? 'local' : 'prescription', server: null, pending,
      offline, refused: !offline,
    };
  }
  const resolved = resolveStrengthGrid(prescription, server, pending);
  if (pending && resolved.origin !== 'local') await clearPendingStrengthDraft(k);
  return { ...resolved, server, pending: resolved.origin === 'local' ? pending : null, offline: false, refused: false };
}

export interface SaveStrengthDraftParams extends StrengthSourceKey {
  sourceTitle: string | null;
  drafts: StrengthSetDraft[];
  editedAt: string;
  baseUpdatedAt: string | null;
}

export type SaveStrengthDraftResult =
  | { status: 'saved'; updatedAt: string }
  | { status: 'server_newer'; server: ServerStrengthSession }
  /**
   * Coupure réseau (`offline`) ou refus du serveur (`refused`, avec son code) :
   * la copie locale est gardée. `baseUpdatedAt` est la version serveur sur
   * laquelle elle repose désormais — celle que cet envoi a lui-même écrite si
   * la séance est passée avant l'échec des séries.
   */
  | { status: 'offline'; baseUpdatedAt: string | null }
  | { status: 'refused'; code: string; baseUpdatedAt: string | null };

/**
 * Enregistre le brouillon : séance (statut draft) puis séries, rien d'autre.
 * La copie locale est écrite avant l'envoi et effacée après : une coupure réseau,
 * un refus du serveur ou une app tuée ne perd pas la saisie. Une version serveur
 * plus récente n'est jamais écrasée : elle est rendue à l'écran à la place.
 *
 * Les deux écritures ne sont pas atomiques : si la séance passe et que les
 * séries échouent, la copie locale reprend l'`updated_at` que cet envoi vient
 * d'écrire. Sans cela, l'essai suivant prenait sa propre écriture pour celle
 * d'un autre appareil et remplaçait la saisie par des séries vides (1.0.58).
 */
export async function saveStrengthDraft(p: SaveStrengthDraftParams): Promise<SaveStrengthDraftResult> {
  const k: StrengthSourceKey = { userId: p.userId, sourceType: p.sourceType, sourceId: p.sourceId };
  const drafts = withUniqueSetKeys(p.drafts);
  const pending: PendingStrengthDraft = { drafts, editedAt: p.editedAt, baseUpdatedAt: p.baseUpdatedAt };
  await savePendingStrengthDraft(k, pending);
  try {
    const current = await fetchStrengthSession(k);
    if (serverWins(current.session, pending)) {
      await clearPendingStrengthDraft(k);
      return { status: 'server_newer', server: current };
    }

    const updatedAt = new Date(Math.max(Date.now(), Date.parse(p.editedAt) || 0)).toISOString();
    const { error: sErr } = await db
      .from('strength_sessions')
      .upsert({
        user_id: p.userId,
        source_type: p.sourceType,
        source_id: p.sourceId,
        source_title: p.sourceTitle,
        planned_sets: Math.min(500, Math.max(1, drafts.length)),
        updated_at: updatedAt,
      }, { onConflict: 'user_id,source_type,source_id' });
    if (sErr) throw sErr;
    pending.baseUpdatedAt = updatedAt;
    await savePendingStrengthDraft(k, pending);

    const rows = drafts
      .map(d => ({ d, reps: validReps(d.reps), load: validLoad(d.loadKg) }))
      .filter(r => r.reps != null || r.load != null)
      .map(({ d, reps, load }) => ({
        user_id: p.userId,
        source_type: p.sourceType,
        source_id: p.sourceId,
        source_title: p.sourceTitle,
        movement: d.name,
        movement_label: weightliftingPrLabel(d.name),
        set_index: d.setIndex,
        reps,
        load_kg: load,
        prescribed_reps: d.prescribedReps >= 1 ? d.prescribedReps : null,
        prescribed_load_kg: d.prescribedLoadKg != null && d.prescribedLoadKg > 0 ? d.prescribedLoadKg : null,
      }));

    let keptIds: string[] = [];
    if (rows.length > 0) {
      const { data, error } = await db
        .from('strength_set_logs')
        .upsert(rows, { onConflict: 'user_id,source_type,source_id,movement,set_index' })
        .select('id');
      if (error) throw error;
      keptIds = (data ?? []).map(r => r.id);
    }
    let prune = db
      .from('strength_set_logs')
      .delete()
      .eq('user_id', p.userId)
      .eq('source_type', p.sourceType)
      .eq('source_id', p.sourceId);
    if (keptIds.length > 0) prune = prune.not('id', 'in', `(${keptIds.join(',')})`);
    const { error: pErr } = await prune;
    if (pErr) throw pErr;

    await clearPendingStrengthDraft(k);
    return { status: 'saved', updatedAt };
  } catch (e) {
    captureError(e, { service: 'strengthSets', action: 'saveDraft' });
    if (isNetworkError(e)) return { status: 'offline', baseUpdatedAt: pending.baseUpdatedAt };
    return { status: 'refused', code: String((e as { code: unknown }).code), baseUpdatedAt: pending.baseUpdatedAt };
  }
}

export interface StrengthRecordInput {
  label: string;
  kg: number | null;
  movement?: string;
  set_index?: number;
}

/**
 * 1RM à transmettre à la validation, par la formule existante
 * (`bestOneRepMaxBySet`, Epley de strengthPR) : le meilleur estimé par libellé,
 * avec la série qui le prouve. Un libellé présent dans la séance enregistrée
 * mais plus justifié par aucune série part à `kg: null`.
 */
export function strengthRecordsFor(drafts: StrengthSetDraft[], previous: ServerSet[] = []): StrengthRecordInput[] {
  const valid = validStrengthSets(drafts);
  const performed: PerformedSet[] = valid.map((d, i) => ({
    name: d.name,
    loadKg: validLoad(d.loadKg) as number,
    reps: validReps(d.reps) as number,
    logId: String(i),
  }));
  const best = bestOneRepMaxBySet(performed);
  const out: StrengthRecordInput[] = Object.entries(best).map(([label, b]) => {
    const d = valid[Number(b.logId)];
    return { label, kg: b.kg, movement: d.name, set_index: d.setIndex };
  });
  const labels = new Set(out.map(r => r.label));
  for (const s of previous) {
    const label = s.movement_label ?? weightliftingPrLabel(s.movement);
    if (label && !labels.has(label)) {
      labels.add(label);
      out.push({ label, kg: null });
    }
  }
  return out;
}

export interface ValidateStrengthParams {
  userId: string;
  sourceType: 'whiteboard' | 'generated';
  sourceId: string;
  sourceTitle: string | null;
  drafts: StrengthSetDraft[];
  rx: boolean;
  /** Séries enregistrées avant cette validation (pour retirer un record qu'elles ne justifient plus). */
  previousSets?: ServerSet[];
}

export interface StrengthValidationResult {
  premiereValidation: boolean;
  maxLoadKg: number;
  seriesValides: number;
  records: { label: string; kg: number | null; precedent: number | null }[];
}

interface RpcResult {
  premiere_validation?: boolean;
  max_load_kg?: number | string;
  series_valides?: number;
  records?: { label: string; kg: number | string | null; precedent: number | string | null }[];
}

const numOrNull = (v: number | string | null | undefined) => (v == null ? null : Number(v));

/** Valide la séance : une seule transaction côté serveur (séries, séance, score, 1RM). */
export async function validateStrengthSession(p: ValidateStrengthParams): Promise<StrengthValidationResult> {
  const drafts = withUniqueSetKeys(p.drafts);
  const valid = validStrengthSets(drafts);
  const sets = valid.map(d => ({
    movement: d.name,
    movement_label: weightliftingPrLabel(d.name),
    set_index: d.setIndex,
    reps: validReps(d.reps),
    load_kg: validLoad(d.loadKg),
    prescribed_reps: d.prescribedReps >= 1 ? d.prescribedReps : null,
    prescribed_load_kg: d.prescribedLoadKg != null && d.prescribedLoadKg > 0 ? d.prescribedLoadKg : null,
  }));
  const records = strengthRecordsFor(drafts, p.previousSets ?? []);
  const { data, error } = await db.rpc('validate_strength_session', {
    p_source_type: p.sourceType,
    p_source_id: p.sourceId,
    p_source_title: p.sourceTitle,
    p_planned_sets: Math.min(500, Math.max(1, drafts.length)),
    p_rx: p.rx,
    p_sets: sets as unknown as Json,
    p_records: records as unknown as Json,
  });
  if (error) throw error;
  const r = (data ?? {}) as RpcResult;
  await clearPendingStrengthDraft({ userId: p.userId, sourceType: p.sourceType, sourceId: p.sourceId });
  return {
    premiereValidation: r.premiere_validation === true,
    maxLoadKg: Number(r.max_load_kg ?? 0),
    seriesValides: Number(r.series_valides ?? 0),
    records: (r.records ?? []).map(x => ({ label: x.label, kg: numOrNull(x.kg), precedent: numOrNull(x.precedent) })),
  };
}

/**
 * Validation puis effets de la première validation (compteurs, streak, badges,
 * notifications, crédits) : `onFirstValidation` ne part que si le serveur dit
 * que c'est la première. Une modification ultérieure ne recompte rien.
 */
export async function submitStrengthValidation(
  p: ValidateStrengthParams,
  onFirstValidation: (r: StrengthValidationResult) => Promise<void> | void,
): Promise<StrengthValidationResult> {
  const result = await validateStrengthSession(p);
  if (result.premiereValidation) await onFirstValidation(result);
  return result;
}

/** Code d'erreur métier renvoyé par la validation (« SEANCE_VIDE: … » → SEANCE_VIDE). */
export function validationErrorCode(e: unknown): string | null {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '';
  const m = msg.match(/^([A-Z_]+):/) ?? msg.match(/^([A-Z_]{6,})$/);
  return m ? m[1] : null;
}

/** « Enregistré il y a … » : clé de traduction et quantité. */
export function savedAgo(savedAt: string, now: number): { key: 'justNow' | 'minutes' | 'hours' | 'days'; count: number } {
  const s = Math.max(0, Math.floor((now - Date.parse(savedAt)) / 1000));
  if (s < 60) return { key: 'justNow', count: 0 };
  if (s < 3600) return { key: 'minutes', count: Math.floor(s / 60) };
  if (s < 86400) return { key: 'hours', count: Math.floor(s / 3600) };
  return { key: 'days', count: Math.floor(s / 86400) };
}
