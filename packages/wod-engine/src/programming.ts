/**
 * Programmation automatique de box (J1) — couche de persistance PURE.
 *
 * Tout ce qui décide (semaine cible, seed, idempotence, régénération, lignes
 * `box_wods` à écrire, lignes à conserver) est ici, sans client Supabase : la
 * fonction edge `generate-box-week` et les tests parlent à la même logique via
 * l'interface `ProgrammingDb`. Le moteur reste déterministe : la même
 * `(box_id, track, iso_year, iso_week, regen_counter)` produit la même semaine.
 */
import type {
  Catalog, GeneratedMuscuWeek, GeneratedWeek, SkeletonBank, WodType,
} from './types';
import { generateMuscuWeek, generateWeek, hashSeed, isoWeek, isoWeekMonday, DAY_LABEL, SESSION_ENGINE_VERSION } from './session';
import { renderMuscu } from './muscu';

export type Track = 'functional' | 'musculation';
export const TRACKS: readonly Track[] = ['functional', 'musculation'];
export const TRACK_LABEL: Record<Track, string> = { functional: 'Functional / Hybrid', musculation: 'Musculation' };
/** Groupes créés dans la box (si absents) pour un futur ciblage par piste (J3). */
export const TRACK_GROUP_NAME: Record<Track, string> = { functional: 'Functional / Hybrid', musculation: 'Musculation' };
/** Clé de piste entrant dans le seed (figée : la piste `functional` s'appelait `crossfit`, les seeds des samples relus en dépendent). */
export const TRACK_SEED_KEY: Record<Track, string> = { functional: 'crossfit', musculation: 'musculation' };
export const PROGRAMMING_VERSION = SESSION_ENGINE_VERSION;
/** Lisibilité du Whiteboard : révélation dimanche 18:00 Paris, comme la Marketplace. */
export const REVEAL_HOUR_PARIS = 18;
export const RECENT_WEEKS = 4;

export type RunStatus = 'running' | 'done' | 'error' | 'skipped';

export interface RunRow {
  id: string;
  box_id: string;
  track: Track;
  iso_year: number;
  iso_week: number;
  generator_version: string;
  seed: number;
  regen_counter: number;
  status: RunStatus;
  error: string | null;
  wod_ids: string[];
  signatures: string[];
  relaxations: string[];
}

export interface BoxWodInsert {
  box_id: string;
  created_by: string | null;
  title: string;
  description: string;
  wod_type: WodType;
  scheduled_date: string;
  time_cap_seconds: number | null;
  rounds: number | null;
  notes: string | null;
  block_name: string;
  video_url: null;
  leaderboard_enabled: boolean;
  emom_interval_minutes: number | null;
  tabata_work_seconds: number | null;
  tabata_rest_seconds: number | null;
  is_published: true;
  publish_at: string;
  audience: 'all';
  sort_order: number;
  wod_json: unknown;
  source: 'auto';
  auto_run_id: string;
}

export interface ExistingAutoRow {
  id: string;
  scheduled_date: string;
  edited_at: string | null;
  scored: boolean;
}

export interface ProgrammingBox {
  id: string;
  owner_id: string | null;
  tracks: Track[];
  /** absent = défaut J1 (dimanche 18:00 Paris, semaine entière) */
  reveal?: RevealConfig;
}

export interface ProgrammingDb {
  listEnabledBoxes(): Promise<ProgrammingBox[]>;
  getRun(box_id: string, track: Track, iso_year: number, iso_week: number): Promise<RunRow | null>;
  /**
   * Insère (ou met à jour en place, `ON CONFLICT (box_id, track, iso_year,
   * iso_week) DO UPDATE`) l'en-tête d'une run et renvoie la ligne avec son id —
   * le même id qu'avant quand la run existait : les `box_wods.auto_run_id`
   * des jours conservés restent valides.
   */
  upsertRun(run: Omit<RunRow, 'id'>): Promise<RunRow>;
  updateRun(id: string, patch: Partial<Pick<RunRow, 'status' | 'error' | 'wod_ids' | 'signatures' | 'relaxations' | 'seed' | 'regen_counter'>>): Promise<void>;
  /** Signatures des runs `done` des `weeks` semaines précédant la cible, même box et piste. */
  recentSignatures(box_id: string, track: Track, before: { iso_year: number; iso_week: number }, weeks: number): Promise<string[]>;
  /** Lignes `source = 'auto'` de la run (via `auto_run_id`), avec leur état édité / scoré. */
  listAutoRows(run_id: string): Promise<ExistingAutoRow[]>;
  deleteRows(ids: string[]): Promise<void>;
  insertRows(rows: BoxWodInsert[]): Promise<string[]>;
  ensureGroup(box_id: string, name: string, created_by: string | null): Promise<void>;
}

/** Lundi → samedi de la semaine ISO, en `YYYY-MM-DD`. */
export function weekDates(iso_year: number, iso_week: number): string[] {
  const monday = isoWeekMonday(iso_year, iso_week);
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date(monday.getTime() + i * 86400000);
    return d.toISOString().slice(0, 10);
  });
}

/** Semaine suivant celle qui contient `now` (Europe/Paris). */
export function nextIsoWeek(now: Date): { iso_year: number; iso_week: number } {
  const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const local = new Date(Date.UTC(paris.getFullYear(), paris.getMonth(), paris.getDate()));
  return isoWeek(new Date(local.getTime() + 7 * 86400000));
}

/** Décalage Europe/Paris (minutes) à l'instant UTC donné — CET +60, CEST +120. */
export function parisOffsetMinutes(utc: Date): number {
  const p = new Date(utc.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const u = new Date(utc.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.round((p.getTime() - u.getTime()) / 60000);
}

/**
 * Révélation d'une box — colonnes `boxes.auto_programming_reveal_*` (migration 20261221).
 * `weekly` : toutes les cartes ensemble, le jour `dow` de la semaine qui précède le lundi
 * ciblé (le lundi lui-même si `dow = 1`). `daily` : chaque carte le jour de sa séance.
 */
export interface RevealConfig {
  mode: 'daily' | 'weekly';
  /** 0 = dimanche … 6 = samedi ; ignoré en `daily`. */
  dow: number;
  /** heure locale Europe/Paris, `HH:MM` ou `HH:MM:SS`. */
  time: string;
}

/** Défaut J1, conservé pour une box sans colonnes de révélation : dimanche 18:00 Paris, semaine entière. */
export const DEFAULT_REVEAL: RevealConfig = { mode: 'weekly', dow: 0, time: `${REVEAL_HOUR_PARIS}:00` };

/** `RevealConfig` depuis une ligne `boxes` : valeur absente, nulle ou hors domaine → défaut J1. */
export function revealFromRow(mode: unknown, dow: unknown, time: unknown): RevealConfig {
  const d = typeof dow === 'number' ? dow : Number(dow);
  return {
    mode: mode === 'daily' ? 'daily' : 'weekly',
    dow: Number.isInteger(d) && d >= 0 && d <= 6 ? d : DEFAULT_REVEAL.dow,
    time: typeof time === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(time) ? time : DEFAULT_REVEAL.time,
  };
}

/**
 * Instant UTC (ISO) d'une heure locale Europe/Paris un jour donné (`YYYY-MM-DD`, `HH:MM[:SS]`).
 * Le décalage est lu à midi UTC : jamais dans l'heure sautée ni doublée d'un changement d'heure.
 */
export function parisInstant(ymd: string, time: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = time.split(':').map(Number);
  const midnightUtc = Date.UTC(y, m - 1, d);
  const offset = parisOffsetMinutes(new Date(midnightUtc + 12 * 3600000));
  return new Date(midnightUtc + ((hh * 60 + mm) * 60 + ss) * 1000 - offset * 60000).toISOString();
}

/** Jour (`YYYY-MM-DD`) de la révélation hebdomadaire de la semaine ciblée. */
export function weeklyRevealDate(iso_year: number, iso_week: number, dow: number): string {
  const monday = isoWeekMonday(iso_year, iso_week);
  const daysBefore = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
  return new Date(monday.getTime() - daysBefore * 86400000).toISOString().slice(0, 10);
}

/** Révélation hebdomadaire en ISO UTC (défaut : dimanche 18:00 Paris, comportement J1). */
export function revealAt(iso_year: number, iso_week: number, reveal: RevealConfig = DEFAULT_REVEAL): string {
  return parisInstant(weeklyRevealDate(iso_year, iso_week, reveal.dow), reveal.time);
}

/** `publish_at` d'une carte : son propre jour en `daily`, la révélation hebdomadaire sinon. */
export function publishAtFor(
  scheduled_date: string, iso_year: number, iso_week: number, reveal: RevealConfig = DEFAULT_REVEAL,
): string {
  return reveal.mode === 'daily' ? parisInstant(scheduled_date, reveal.time) : revealAt(iso_year, iso_week, reveal);
}

export function weekSeed(box_id: string, track: Track, iso_year: number, iso_week: number, regen_counter: number): number {
  return hashSeed(box_id, TRACK_SEED_KEY[track], iso_year, iso_week, regen_counter);
}

export interface WeekContext {
  box_id: string;
  created_by: string | null;
  run_id: string;
  iso_year: number;
  iso_week: number;
  /** absent = défaut J1 (dimanche 18:00 Paris, semaine entière) */
  reveal?: RevealConfig;
}

export function functionalWeekRows(week: GeneratedWeek, ctx: WeekContext): BoxWodInsert[] {
  const dates = weekDates(ctx.iso_year, ctx.iso_week);
  const publishAt = (date: string) => publishAtFor(date, ctx.iso_year, ctx.iso_week, ctx.reveal);
  const rows: BoxWodInsert[] = [];
  for (const s of week.sessions) {
    for (const b of s.blocks) {
      rows.push({
        box_id: ctx.box_id,
        created_by: ctx.created_by,
        title: b.title,
        description: b.description,
        wod_type: b.wod_type,
        scheduled_date: dates[s.day - 1],
        time_cap_seconds: b.time_cap_seconds,
        rounds: b.rounds,
        notes: b.notes,
        block_name: b.block_name,
        video_url: null,
        leaderboard_enabled: b.block_name === 'wod' ? b.leaderboard_enabled : false,
        emom_interval_minutes: b.emom_interval_minutes,
        tabata_work_seconds: b.tabata_work_seconds,
        tabata_rest_seconds: b.tabata_rest_seconds,
        is_published: true,
        publish_at: publishAt(dates[s.day - 1]),
        audience: 'all',
        sort_order: b.sort_order,
        wod_json: b.wod_json,
        source: 'auto',
        auto_run_id: ctx.run_id,
      });
    }
  }
  return rows;
}

export function muscuWeekRows(week: GeneratedMuscuWeek, ctx: WeekContext): BoxWodInsert[] {
  const dates = weekDates(ctx.iso_year, ctx.iso_week);
  const publishAt = (date: string) => publishAtFor(date, ctx.iso_year, ctx.iso_week, ctx.reveal);
  return week.days.map((d) => ({
    box_id: ctx.box_id,
    created_by: ctx.created_by,
    title: d.wod.title,
    description: renderMuscu(d.wod),
    wod_type: 'strength' as const,
    scheduled_date: dates[d.day - 1],
    time_cap_seconds: null,
    rounds: null,
    notes: d.wod.notes,
    block_name: 'strength',
    video_url: null,
    leaderboard_enabled: false,
    emom_interval_minutes: null,
    tabata_work_seconds: null,
    tabata_rest_seconds: null,
    is_published: true,
    publish_at: publishAt(dates[d.day - 1]),
    audience: 'all',
    sort_order: 0,
    wod_json: d.wod,
    source: 'auto',
    auto_run_id: ctx.run_id,
  }));
}

export interface WeekOutcome {
  box_id: string;
  track: Track;
  iso_year: number;
  iso_week: number;
  status: RunStatus | 'kept';
  regen_counter: number;
  inserted: number;
  kept_dates: string[];
  deleted: number;
  error?: string;
}

export interface RunOptions {
  now: Date;
  /** semaine cible explicite (tests, admin) ; défaut = semaine suivante */
  target?: { iso_year: number; iso_week: number };
  /** régénérer une box × piste déjà générée (regen_counter + 1) */
  regen?: { box_id: string; track: Track };
  /** ne traiter que cette box */
  only_box_id?: string;
}

/**
 * Point d'entrée de la fonction edge. Pour chaque box activée × piste :
 *   - run `done` existante et pas de `regen` → `kept` (idempotent) ;
 *   - sinon génère la semaine (seed déterministe), supprime les lignes `auto`
 *     ni éditées ni scorées de la run précédente, conserve les autres jours,
 *     insère les jours manquants, journalise (`done` / `error`).
 */
export async function runWeekGeneration(
  db: ProgrammingDb, catalog: Catalog, bank: SkeletonBank, opts: RunOptions,
): Promise<WeekOutcome[]> {
  const target = opts.target ?? nextIsoWeek(opts.now);
  const boxes = (await db.listEnabledBoxes()).filter((b) => !opts.only_box_id || b.id === opts.only_box_id);
  const out: WeekOutcome[] = [];
  for (const box of boxes) {
    for (const track of box.tracks) {
      const base = { box_id: box.id, track, iso_year: target.iso_year, iso_week: target.iso_week };
      const existing = await db.getRun(box.id, track, target.iso_year, target.iso_week);
      const regen = !!opts.regen && opts.regen.box_id === box.id && opts.regen.track === track;
      if (existing && existing.status === 'done' && !regen) {
        out.push({ ...base, status: 'kept', regen_counter: existing.regen_counter, inserted: 0, kept_dates: [], deleted: 0 });
        continue;
      }
      const regen_counter = existing ? (regen ? existing.regen_counter + 1 : existing.regen_counter) : 0;
      const seed = weekSeed(box.id, track, target.iso_year, target.iso_week, regen_counter);
      const run = await db.upsertRun({
        ...base, generator_version: PROGRAMMING_VERSION, seed, regen_counter,
        status: 'running', error: null, wod_ids: existing?.wod_ids ?? [], signatures: existing?.signatures ?? [], relaxations: [],
      });
      try {
        await db.ensureGroup(box.id, TRACK_GROUP_NAME[track], box.owner_id);
        const recent = await db.recentSignatures(box.id, track, target, RECENT_WEEKS);
        const ctx: WeekContext = {
          box_id: box.id, created_by: box.owner_id, run_id: run.id,
          iso_year: target.iso_year, iso_week: target.iso_week, reveal: box.reveal,
        };
        let rows: BoxWodInsert[];
        let signatures: string[];
        let relaxations: string[];
        if (track === 'functional') {
          const week = generateWeek({ iso_year: target.iso_year, iso_week: target.iso_week, recent_signatures: recent }, catalog, bank, seed);
          rows = functionalWeekRows(week, ctx);
          signatures = week.signatures;
          relaxations = [...week.relaxations, ...week.sessions.flatMap((s) => s.generator.relaxations.map((r) => `${DAY_LABEL[s.day]}:${r}`))];
        } else {
          const week = generateMuscuWeek({ iso_year: target.iso_year, iso_week: target.iso_week, recent_signatures: recent }, catalog, bank, seed);
          rows = muscuWeekRows(week, ctx);
          signatures = week.days.map((d) => d.wod.signature);
          relaxations = week.relaxations;
        }
        // Lignes de la run précédente : on garde les jours édités ou scorés.
        const previous = existing ? await db.listAutoRows(existing.id) : [];
        const keptDates = new Set(previous.filter((r) => r.edited_at || r.scored).map((r) => r.scheduled_date));
        const toDelete = previous.filter((r) => !keptDates.has(r.scheduled_date)).map((r) => r.id);
        if (toDelete.length) await db.deleteRows(toDelete);
        const keptIds = previous.filter((r) => keptDates.has(r.scheduled_date)).map((r) => r.id);
        const inserts = rows.filter((r) => !keptDates.has(r.scheduled_date));
        const ids = inserts.length ? await db.insertRows(inserts) : [];
        await db.updateRun(run.id, { status: 'done', error: null, wod_ids: [...keptIds, ...ids], signatures, relaxations, seed, regen_counter });
        out.push({ ...base, status: 'done', regen_counter, inserted: ids.length, kept_dates: [...keptDates].sort(), deleted: toDelete.length });
      } catch (e) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        await db.updateRun(run.id, { status: 'error', error: msg });
        out.push({ ...base, status: 'error', regen_counter, inserted: 0, kept_dates: [], deleted: 0, error: msg });
      }
    }
  }
  return out;
}
