import type {
  AfterClassContext, Catalog, CatalogMovement, Muscle, MuscuEquipment, MuscuExercise, MuscuFields, MuscuLevel, MuscuLoad,
  MuscuObjective, MuscuParams, MuscuSkeleton, MuscuSlot, MuscuSlotRole, MuscuTarget, MuscuUnit, MuscuWod, Pattern, SkeletonBank,
} from './types';
import { RNG } from './rng';
import { nameKey, resolveMovement } from './catalog';
import { MUSCU_SKELETONS, MUSCU_TARGETS, TARGET_MUSCLES } from './bank/muscu';

/**
 * Générateur Musculation V1 (brief M1). Déterministe (graine), sans réseau :
 * catalogue (`muscu` non nul) + squelettes `discipline = 'musculation'`.
 *
 * Pipeline : squelette (cible × objectif) → un exercice par slot (rôle, muscle,
 * matériel, niveau, exclusions, Après ma classe) → schéma par objectif → charge
 * (1RM × facteur × %, RPE ou poids du corps) → ajustement au budget (slots
 * optionnels, séries, reps, slots bonus) → anti-répétition sur la signature.
 * Jamais de `NoValidWod` : chaque contrainte relâchée est tracée dans
 * `generator.relaxations`.
 */

export const MUSCU_ENGINE_VERSION = '1.0.0';
export const MUSCU_MAX_ATTEMPTS = 40;
export const MUSCU_TOLERANCE = 0.10;
export const MUSCU_DURATIONS = { express: [20, 30, 45, 60], after_class: [15, 20, 30] } as const;
/** Débutant : bilatéral, sans lest, 4 exercices maximum (§5). */
export const BEGINNER_MAX_EXERCISES = 4;
/** Séries maximum par muscle principal et par séance (§5 volume). */
export const VOLUME_CAP_SETS: Record<MuscuObjective, number> = { hypertrophie: 12, force: 10, endurance: 9 };
/** Exercices poids du corps lestables en Force (intermédiaire+). */
export const WEIGHTED_IDS = ['dips', 'strict_pull_up', 'chin_up', 'wide_grip_pull_up', 'neutral_grip_pull_up', 'close_grip_pull_up', 'close_grip_dips'];
/**
 * Plages pour les unités secondes / mètres. Le CSV v1 donne `[15, 20]` à toutes
 * les lignes `s` / `m` (copie de la plage endurance en reps) ; les exemples du
 * brief tiennent 30-45 s de gainage et 40 m de carry.
 */
export const UNIT_RANGES: Record<Exclude<MuscuUnit, 'reps'>, [number, number]> = { s: [30, 60], m: [30, 50] };
export const LOAD_STEP_KG = 2.5;
/** Lest des tractions / dips en Force : 10 % du poids de corps, arrondi au pas de 2,5 kg. */
export const WEIGHTED_BODYWEIGHT_RATIO = 0.10;
/** Tempo 3-1-1 : durée d'une répétition quand la séance reste sous le budget. */
export const TEMPO_311 = '3-1-1';
export const TEMPO_311_SECONDS_PER_REP = 5;
/** Repos maximal des lignes gainage / mollets quand elles sont les seules à pouvoir absorber le budget (cible Tronc). */
export const CORE_REST_MAX = 90;

interface Scheme {
  sets: Record<'main' | 'other', number>;
  sets_min: number;
  sets_max: number;
  rest: Record<'main' | 'other', number>;
  /** repos maximal quand la séance est trop courte pour le budget */
  rest_max: number;
  rpe: number;
  rir: string;
}
export const SCHEMES: Record<MuscuObjective, Scheme> = {
  hypertrophie: { sets: { main: 4, other: 3 }, sets_min: 3, sets_max: 5, rest: { main: 90, other: 75 }, rest_max: 120, rpe: 8, rir: 'dernière série à 1-2 reps de l\'échec' },
  force: { sets: { main: 5, other: 4 }, sets_min: 3, sets_max: 5, rest: { main: 150, other: 120 }, rest_max: 180, rpe: 8, rir: 'RIR 2, dernière série RPE 9' },
  endurance: { sets: { main: 3, other: 3 }, sets_min: 2, sets_max: 5, rest: { main: 40, other: 40 }, rest_max: 75, rpe: 7, rir: 'rythme continu, aucune série à l\'échec' },
};

/** % du 1RM par nombre de reps (brief : hypertrophie 60-80, force 80-90, endurance 50-60). */
const PCT_ANCHORS: Array<[number, number]> = [[3, 88], [4, 85], [5, 82], [6, 79], [8, 72], [10, 68], [12, 65], [15, 60], [18, 55], [20, 52]];
export function percentForReps(reps: number): number {
  if (reps <= PCT_ANCHORS[0][0]) return PCT_ANCHORS[0][1];
  for (let i = 1; i < PCT_ANCHORS.length; i++) {
    const [r0, p0] = PCT_ANCHORS[i - 1];
    const [r1, p1] = PCT_ANCHORS[i];
    if (reps <= r1) return Math.round(p0 + ((p1 - p0) * (reps - r0)) / (r1 - r0));
  }
  return PCT_ANCHORS[PCT_ANCHORS.length - 1][1];
}

export const TARGET_LABEL: Record<MuscuTarget, string> = {
  fessiers: 'Fessiers', fessiers_ischios: 'Fessiers & ischios', bas: 'Bas du corps', full_body: 'Full body', tronc: 'Tronc',
  haut: 'Haut du corps', dos: 'Dos', epaules: 'Épaules', bras: 'Bras', pecs: 'Pectoraux', push: 'Push', pull: 'Pull', jambes: 'Jambes',
};
export const OBJECTIVE_LABEL: Record<MuscuObjective, string> = { hypertrophie: 'Hypertrophie', force: 'Force', endurance: 'Endurance musculaire' };
export const EQUIPMENT_LABEL: Record<MuscuEquipment, string> = { none: 'Sans matériel', box: 'Box', gym: 'Salle' };
export const LEVEL_LABEL: Record<MuscuLevel, string> = { debutant: 'Débutant', inter: 'Intermédiaire', avance: 'Avancé' };
const LEVEL_RANK: Record<MuscuLevel, number> = { debutant: 0, inter: 1, avance: 2 };

/** Niveau Musculation depuis `profiles.level` (Scaled → débutant, Inter / RX → intermédiaire, RX+ et au-delà → avancé). */
export function muscuLevelFor(level: string | null | undefined): MuscuLevel {
  const lv = (level ?? '').toLowerCase().replace(/\s+/g, '');
  if (!lv || lv === 'scaled' || lv === 'debutant' || lv === 'débutant') return 'debutant';
  if (lv === 'inter' || lv === 'intermediate' || lv === 'rx' || lv === 'men' || lv === 'women') return 'inter';
  return 'avance';
}

export class InvalidMuscuParams extends Error {
  readonly code: 'force_after_class' | 'force_without_equipment' | 'unknown_target' | 'target_unavailable';
  constructor(code: InvalidMuscuParams['code'], message: string) {
    super(message);
    this.name = 'InvalidMuscuParams';
    this.code = code;
  }
}

// ─── Après ma classe ─────────────────────────────────────────────────────────

/** Muscles principaux travaillés par un pattern metcon (brief §5 Après ma classe). */
const PATTERN_MUSCLES: Partial<Record<Pattern, Muscle[]>> = {
  squat: ['quadriceps', 'fessiers'],
  lunge: ['quadriceps', 'fessiers'],
  push_v: ['epaules'],
  pull_v: ['dos', 'biceps'],
  hinge: ['ischios', 'lombaires'],
  push_h: ['pecs', 'triceps'],
  pull_h: ['dos'],
};

export interface AfterClassMuscles {
  excluded: Muscle[];
  suggested_target: MuscuTarget | null;
}

/** Muscles à exclure d'après le WOD du jour, et première cible libre dans l'ordre Haut → Bas → Tronc (§5). */
export function afterClassMuscles(catalog: Catalog, ctx: AfterClassContext): AfterClassMuscles {
  const set = new Set<Muscle>();
  for (const raw of ctx.day_movements) {
    const m = resolveMovement(catalog, raw) ?? resolveMovement(catalog, stripLine(raw));
    if (!m) continue;
    for (const p of m.pattern) for (const mu of PATTERN_MUSCLES[p] ?? []) set.add(mu);
    if (m.muscu) set.add(m.muscu.muscle_primary);
  }
  const excluded = [...set];
  const free = (t: MuscuTarget) => TARGET_MUSCLES[t].every((mu) => !set.has(mu));
  const suggested_target = (['haut', 'bas', 'tronc'] as MuscuTarget[]).find(free) ?? null;
  return { excluded, suggested_target };
}

function stripLine(raw: string): string {
  return raw.replace(/^\s*\d+(?:[.,]\d+)?\s*(?:x|×|reps?|cal|m|km|s)?\s*/i, '').replace(/\(.*?\)/g, '').trim();
}

// ─── Candidats ───────────────────────────────────────────────────────────────

type Mv = CatalogMovement & { muscu: MuscuFields };

interface Ctx {
  params: MuscuParams;
  catalog: Catalog;
  scheme: Scheme;
  rng: RNG;
  exclude: Set<string>;
  excludedMuscles: Set<Muscle>;
  relax: Set<string>;
  pool: Mv[];
}

function norm(s: string): string {
  return nameKey(s).replace(/[\s-]+/g, '_');
}

function equipmentWeight(m: Mv, eq: MuscuEquipment): number {
  return eq === 'none' ? m.muscu.weight_bodyweight : eq === 'box' ? m.muscu.weight_box : m.muscu.weight_gym;
}

function isExcluded(ctx: Ctx, m: Mv): boolean {
  if (ctx.exclude.size === 0) return false;
  if (ctx.exclude.has(norm(m.id)) || ctx.exclude.has(norm(m.name))) return true;
  if (ctx.exclude.has(norm(m.family))) return true;
  return m.equipment.some((e) => ctx.exclude.has(norm(e)));
}

function levelOk(m: Mv, level: MuscuLevel): boolean {
  if (LEVEL_RANK[m.muscu.level_min] > LEVEL_RANK[level]) return false;
  if (level === 'debutant' && m.muscu.unilateral) return false;
  return true;
}

/** Objectif servi par l'exercice : le sien, sinon (isolation en Force) l'hypertrophie. */
function objectiveFor(m: Mv, objective: MuscuObjective): MuscuObjective | null {
  if (m.muscu.objectives.includes(objective)) return objective;
  if (objective === 'force' && !m.muscu.compound && m.muscu.objectives.includes('hypertrophie')) return 'hypertrophie';
  return null;
}

function basePool(ctx: Ctx): Mv[] {
  const { params } = ctx;
  return (ctx.catalog.movements.filter((m) => m.muscu) as Mv[]).filter((m) =>
    equipmentWeight(m, params.equipment) > 0
    && levelOk(m, params.level)
    && !isExcluded(ctx, m)
    && !ctx.excludedMuscles.has(m.muscu.muscle_primary));
}

const COMPOUND_ROLES: ReadonlySet<MuscuSlotRole> = new Set(['main_compound', 'secondary_compound']);

function roleOk(m: Mv, role: MuscuSlotRole): boolean {
  if (role === 'core' || role === 'calves') return true;
  return COMPOUND_ROLES.has(role) ? m.muscu.compound : !m.muscu.compound;
}

interface Picked {
  m: Mv;
  role: MuscuSlotRole;
  objective: MuscuObjective;
  optional: boolean;
  slotIndex: number;
}

interface Filter {
  ids: boolean;
  unilateral: boolean;
  role: boolean;
  objective: boolean;
  muscles: Muscle[];
}

function candidates(ctx: Ctx, slot: MuscuSlot, f: Filter, picked: Picked[], prevMuscle: Muscle | null): Mv[] {
  const used = new Set(picked.map((p) => p.m.id));
  const mainMuscles = new Set(picked.filter((p) => p.role === 'main_compound').map((p) => p.m.muscu.muscle_primary));
  const requireUnilateral = f.unilateral && !!slot.unilateral && ctx.params.level !== 'debutant';
  return ctx.pool.filter((m) => {
    if (used.has(m.id)) return false;
    if (!f.muscles.includes(m.muscu.muscle_primary)) return false;
    if (prevMuscle && m.muscu.muscle_primary === prevMuscle) return false;
    if (slot.exclude_ids?.includes(m.id)) return false;
    if (f.ids && slot.ids && !slot.ids.includes(m.id)) return false;
    if (requireUnilateral && !m.muscu.unilateral) return false;
    if (f.role && !roleOk(m, slot.role)) return false;
    if (f.objective && !objectiveFor(m, ctx.params.objective)) return false;
    if (slot.role === 'main_compound' && ctx.params.objective === 'force' && mainMuscles.has(m.muscu.muscle_primary)) return false;
    return true;
  });
}

/** Ordre de relâchement d'un slot : ids → unilatéral → rôle → objectif → muscles de la cible. */
function pickSlot(ctx: Ctx, slot: MuscuSlot, index: number, picked: Picked[], target: MuscuTarget): Picked | null {
  const slotMuscles = Array.isArray(slot.muscle) ? slot.muscle : [slot.muscle];
  const prev = picked.length ? picked[picked.length - 1].m.muscu.muscle_primary : null;
  const steps: Array<[string | null, Filter]> = [
    [null, { ids: true, unilateral: true, role: true, objective: true, muscles: slotMuscles }],
    [slot.ids ? 'slot_ids' : null, { ids: false, unilateral: true, role: true, objective: true, muscles: slotMuscles }],
    [slot.unilateral ? 'slot_unilateral' : null, { ids: false, unilateral: false, role: true, objective: true, muscles: slotMuscles }],
    ['slot_role', { ids: false, unilateral: false, role: false, objective: true, muscles: slotMuscles }],
    ['slot_objective', { ids: false, unilateral: false, role: false, objective: false, muscles: slotMuscles }],
  ];
  if (!slot.optional) {
    const wider = TARGET_MUSCLES[target].filter((mu) => !slotMuscles.includes(mu) && !ctx.excludedMuscles.has(mu));
    if (wider.length) steps.push(['slot_muscle', { ids: false, unilateral: false, role: true, objective: true, muscles: wider }]);
    if (wider.length) steps.push(['slot_muscle', { ids: false, unilateral: false, role: false, objective: false, muscles: wider }]);
  }
  for (const [i, [relax, f]] of steps.entries()) {
    if (i > 0 && relax === null) continue;
    const list = candidates(ctx, slot, f, picked, prev);
    if (!list.length) continue;
    const m = ctx.rng.pickWeighted(list, (x) => equipmentWeight(x, ctx.params.equipment))!;
    if (relax) ctx.relax.add(relax);
    return { m, role: slot.role, objective: objectiveFor(m, ctx.params.objective) ?? 'hypertrophie', optional: !!slot.optional, slotIndex: index };
  }
  return null;
}

// ─── Schéma, charge, durée ───────────────────────────────────────────────────

interface Line extends Picked {
  sets: number;
  reps: number;
  range: [number, number];
  rest: number;
  tempo?: string;
}

function repRange(m: Mv, objective: MuscuObjective): [number, number] {
  if (m.muscu.unit !== 'reps') return UNIT_RANGES[m.muscu.unit];
  const r = m.muscu.rep_ranges[objective] ?? m.muscu.rep_ranges.hypertrophie ?? Object.values(m.muscu.rep_ranges)[0];
  return r ? [r[0], r[1]] : [8, 12];
}

function lineFor(ctx: Ctx, p: Picked): Line {
  const scheme = SCHEMES[p.objective];
  const kind = p.role === 'main_compound' ? 'main' : 'other';
  const range = repRange(p.m, p.objective);
  const sets = p.role === 'core' || p.role === 'calves' ? Math.min(scheme.sets.other, 3) : scheme.sets[kind];
  const rest = p.role === 'core' ? Math.min(scheme.rest.other, p.objective === 'endurance' ? 30 : 60)
    : p.role === 'calves' ? Math.min(scheme.rest.other, 45) : scheme.rest[kind];
  // sans matériel en Prise de muscle : les polyarticulaires poids du corps se font au tempo 3-1-1 (brief §5), compté dans la durée
  const tempo = ctx.params.equipment === 'none' && ctx.params.objective === 'hypertrophie' && p.m.muscu.load_mode === 'bodyweight' && p.m.muscu.unit === 'reps' && p.m.muscu.compound
    ? TEMPO_311 : undefined;
  return { ...p, sets, reps: Math.round((range[0] + range[1]) / 2), range, rest, ...(tempo ? { tempo } : {}) };
}

export function sessionSeconds(lines: Array<{ sets: number; reps: number; rest: number; tempo?: string; m: { muscu: Pick<MuscuFields, 'unilateral' | 'seconds_per_rep' | 'setup_s'> } }>): number {
  return lines.reduce((acc, l) => {
    const spr = l.tempo ? Math.max(l.m.muscu.seconds_per_rep, TEMPO_311_SECONDS_PER_REP) : l.m.muscu.seconds_per_rep;
    return acc + l.m.muscu.setup_s + l.sets * (l.reps * spr * (l.m.muscu.unilateral ? 2 : 1) + l.rest);
  }, 0);
}

function roundLoad(kg: number): number {
  return Math.round(kg / LOAD_STEP_KG) * LOAD_STEP_KG;
}

function loadFor(ctx: Ctx, l: Line): MuscuLoad {
  const { params } = ctx;
  const mu = l.m.muscu;
  const scheme = SCHEMES[l.objective];
  if (mu.load_mode === 'bodyweight') {
    if (params.objective === 'force' && params.level !== 'debutant' && WEIGHTED_IDS.includes(l.m.id) && l.objective === 'force') {
      const bw = params.bodyweight_kg;
      return bw && bw > 0
        ? { mode: 'weighted', kg: roundLoad(bw * WEIGHTED_BODYWEIGHT_RATIO), rpe: scheme.rpe }
        : { mode: 'weighted', rpe: scheme.rpe };
    }
    return { mode: 'bodyweight' };
  }
  if (mu.load_mode === '1rm' && mu.rm_reference) {
    const rm = params.one_rep_max?.[mu.rm_reference];
    const percent = percentForReps(l.reps);
    if (rm && rm > 0 && params.level !== 'debutant') {
      return { mode: '1rm', kg: roundLoad(rm * (mu.rm_factor ?? 1) * (percent / 100)), percent, rm_reference: mu.rm_reference };
    }
    return { mode: 'rpe', rpe: params.level === 'debutant' ? 7 : scheme.rpe, rm_reference: mu.rm_reference };
  }
  return { mode: 'rpe', rpe: scheme.rpe };
}

// ─── Ajustement au budget ────────────────────────────────────────────────────

function total(lines: Line[]): number {
  return sessionSeconds(lines);
}

function volumeByMuscle(lines: Line[]): Map<Muscle, number> {
  const v = new Map<Muscle, number>();
  for (const l of lines) v.set(l.m.muscu.muscle_primary, (v.get(l.m.muscu.muscle_primary) ?? 0) + l.sets);
  return v;
}

function applyVolumeCaps(ctx: Ctx, lines: Line[]): Line[] {
  const cap = VOLUME_CAP_SETS[ctx.params.objective];
  const out: Line[] = [];
  const v = new Map<Muscle, number>();
  for (const l of lines) {
    const mu = l.m.muscu.muscle_primary;
    const room = cap - (v.get(mu) ?? 0);
    if (room < 2) { ctx.relax.add('volume_cap'); continue; }
    if (l.sets > room) { l.sets = room; ctx.relax.add('volume_cap'); }
    v.set(mu, (v.get(mu) ?? 0) + l.sets);
    out.push(l);
  }
  return out;
}

function hasAdjacency(lines: Line[]): boolean {
  return lines.some((l, i) => i > 0 && l.m.muscu.muscle_primary === lines[i - 1].m.muscu.muscle_primary);
}

function withinBudget(ctx: Ctx, lines: Line[]): boolean {
  const budget = ctx.params.budget_min * 60;
  const t = total(lines);
  return t >= budget * (1 - MUSCU_TOLERANCE) && t <= budget * (1 + MUSCU_TOLERANCE);
}

/** Aucun exercice consécutif sur le même muscle principal : permutation locale, sinon retrait. */
function breakAdjacency(ctx: Ctx, lines: Line[]): Line[] {
  const out = [...lines];
  for (let i = 1; i < out.length; i++) {
    if (out[i].m.muscu.muscle_primary !== out[i - 1].m.muscu.muscle_primary) continue;
    const j = out.findIndex((l, k) => k > i && l.m.muscu.muscle_primary !== out[i - 1].m.muscu.muscle_primary
      && (k + 1 >= out.length || out[k + 1].m.muscu.muscle_primary !== out[i].m.muscu.muscle_primary)
      && l.role === out[i].role);
    if (j > 0) { [out[i], out[j]] = [out[j], out[i]]; continue; }
    out.splice(i, 1);
    ctx.relax.add('adjacent_muscle');
    i--;
  }
  return out;
}

function bonusExercise(ctx: Ctx, lines: Line[], target: MuscuTarget): Line | null {
  const used = new Set(lines.map((l) => l.m.id));
  const last = lines[lines.length - 1]?.m.muscu.muscle_primary ?? null;
  const cap = VOLUME_CAP_SETS[ctx.params.objective];
  const vol = volumeByMuscle(lines);
  const minSets = SCHEMES[ctx.params.objective].sets_min;
  const muscles = TARGET_MUSCLES[target].filter((mu) => !ctx.excludedMuscles.has(mu) && (vol.get(mu) ?? 0) + minSets <= cap);
  const eligible = (m: Mv) => !used.has(m.id) && m.muscu.muscle_primary !== last && !ctx.excludedMuscles.has(m.muscu.muscle_primary)
    && (vol.get(m.muscu.muscle_primary) ?? 0) + minSets <= cap && objectiveFor(m, ctx.params.objective);
  const targetMuscles = TARGET_MUSCLES[target];
  const primary = ctx.pool.filter((m) => eligible(m) && muscles.includes(m.muscu.muscle_primary));
  // repli : exercice dont un muscle secondaire appartient à la cible (Air Squats → fessiers, Push-Ups → tronc…)
  const secondary = primary.length ? [] : ctx.pool.filter((m) => eligible(m) && (m.muscu.muscle_secondary as Muscle[]).some((mu) => targetMuscles.includes(mu)));
  const base = primary.length ? primary : secondary;
  const iso = base.filter((m) => !m.muscu.compound);
  const m = ctx.rng.pickWeighted(iso.length ? iso : base, (x) => equipmentWeight(x, ctx.params.equipment));
  if (!m) return null;
  const p: Picked = { m, role: m.muscu.compound ? 'secondary_compound' : 'isolation', objective: objectiveFor(m, ctx.params.objective)!, optional: true, slotIndex: 99 };
  const line = lineFor(ctx, p);
  line.sets = Math.min(line.sets, cap - (vol.get(m.muscu.muscle_primary) ?? 0));
  return line;
}

function fitBudget(ctx: Ctx, input: Line[], target: MuscuTarget): Line[] {
  const budget = ctx.params.budget_min * 60;
  const lo = budget * (1 - MUSCU_TOLERANCE);
  const hi = budget * (1 + MUSCU_TOLERANCE);
  const maxEx = ctx.params.level === 'debutant' ? BEGINNER_MAX_EXERCISES : Infinity;
  let lines = [...input];

  const dropOptional = () => {
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].optional) { lines.splice(i, 1); return true; }
    return false;
  };
  while (lines.length > maxEx && (dropOptional() || (lines.length > 2 && lines.splice(lines.length - 1, 1).length))) ctx.relax.add('beginner_max');

  // trop long : optionnels → reps mini → une série → dernier slot
  while (total(lines) > hi) {
    if (dropOptional()) continue;
    const overReps = lines.filter((l) => l.reps > l.range[0]);
    if (overReps.length) { for (const l of overReps) l.reps = l.range[0]; continue; }
    const reducible = lines.filter((l) => l.sets > SCHEMES[l.objective].sets_min).sort((a, b) => b.sets - a.sets);
    if (reducible.length) { reducible[0].sets--; continue; }
    if (lines.length > 2) { lines.splice(lines.length - 1, 1); ctx.relax.add('slots_dropped'); continue; }
    ctx.relax.add('budget_long');
    break;
  }

  // trop court : reps maxi → une série de plus (jusqu'à sets_max) → exercice optionnel sur un
  // muscle secondaire de la cible → tempo 3-1-1 → repos allongé → budget_short tracé
  const MAX_EXERCISES = 6;
  let guard = 0;
  while (total(lines) < lo && guard++ < 40) {
    const underReps = lines.filter((l) => l.reps < l.range[1]);
    if (underReps.length) {
      for (const l of underReps) l.reps = Math.min(l.range[1], l.reps + (l.range[1] - l.range[0] >= 4 ? 2 : 1));
      continue;
    }
    const cap = VOLUME_CAP_SETS[ctx.params.objective];
    const vol = volumeByMuscle(lines);
    const addable = lines.filter((l) => l.sets < SCHEMES[l.objective].sets_max && (vol.get(l.m.muscu.muscle_primary) ?? 0) < cap)
      .sort((a, b) => a.sets - b.sets || a.slotIndex - b.slotIndex);
    const fits = (l: Line) => { l.sets++; if (total(lines) <= hi) return true; l.sets--; return false; };
    if (addable.some(fits)) continue;
    if (lines.length < Math.min(maxEx, MAX_EXERCISES)) {
      const bonus = bonusExercise(ctx, lines, target);
      if (bonus) {
        if (total([...lines, bonus]) <= hi) { lines.push(bonus); ctx.relax.add('bonus_slot'); continue; }
        bonus.reps = bonus.range[0];
        if (total([...lines, bonus]) <= hi) { lines.push(bonus); ctx.relax.add('bonus_slot'); continue; }
      }
    }
    const tempoable = lines.filter((l) => !l.tempo && l.m.muscu.unit === 'reps' && l.m.muscu.seconds_per_rep < TEMPO_311_SECONDS_PER_REP)
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const slow = (l: Line) => { l.tempo = TEMPO_311; if (total(lines) <= hi) return true; delete l.tempo; return false; };
    if (tempoable.some(slow)) { ctx.relax.add('tempo_311'); continue; }
    const restMax = (l: Line) => (l.role === 'core' || l.role === 'calves' ? Math.min(CORE_REST_MAX, SCHEMES[l.objective].rest_max) : SCHEMES[l.objective].rest_max);
    const mainRestable = lines.filter((l) => l.role !== 'core' && l.role !== 'calves' && l.rest < restMax(l));
    const restable = mainRestable.length ? mainRestable : lines.filter((l) => l.rest < restMax(l));
    if (restable.length) {
      const before = restable.map((l) => l.rest);
      for (const l of restable) l.rest = Math.min(restMax(l), l.rest + 15);
      if (total(lines) <= hi) { ctx.relax.add('rest_extended'); continue; }
      restable.forEach((l, i) => { l.rest = before[i]; });
    }
    if (ctx.params.level === 'debutant' && lines.length <= BEGINNER_MAX_EXERCISES) {
      const bonus = bonusExercise(ctx, lines, target);
      if (bonus && total([...lines, bonus]) <= hi) { lines.push(bonus); ctx.relax.add('beginner_fifth'); continue; }
    }
    ctx.relax.add('budget_short');
    break;
  }
  return lines;
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

const SIDE_LABEL: Partial<Record<Muscle, string>> = {
  quadriceps: 'jambe', ischios: 'jambe', fessiers: 'jambe', mollets: 'jambe',
  biceps: 'bras', triceps: 'bras', epaules: 'bras', epaules_post: 'bras', epaules_ant: 'bras', dos: 'bras', pecs: 'bras', avant_bras: 'bras', coiffe: 'bras',
};
export function sideLabel(m: Pick<MuscuExercise, 'muscle_primary'>): 'jambe' | 'bras' | 'côté' {
  return (SIDE_LABEL[m.muscle_primary] as 'jambe' | 'bras' | undefined) ?? 'côté';
}

function notesFor(ctx: Ctx, l: Line, load: MuscuLoad): string {
  const parts: string[] = [];
  if (ctx.params.objective === 'force' && l.objective !== 'force') parts.push('schéma hypertrophie');
  if (load.mode === 'rpe' && load.rm_reference && ctx.params.level === 'debutant') parts.push('monter jusqu\'à une charge propre');
  if (load.mode === 'bodyweight' && ctx.params.level === 'debutant' && /pull_up|chin_up/.test(l.m.id)) parts.push('Débutant : banded');
  if (l.tempo) parts.push(`tempo ${l.tempo}`);
  return parts.join(' · ');
}

function toExercise(ctx: Ctx, l: Line): MuscuExercise {
  const load = loadFor(ctx, l);
  return {
    id: l.m.id,
    name: l.m.name,
    role: l.role,
    muscle_primary: l.m.muscu.muscle_primary,
    sets: l.sets,
    reps: l.reps,
    reps_unit: l.m.muscu.unit,
    per_side: l.m.muscu.unilateral,
    load,
    rest_s: l.rest,
    notes: notesFor(ctx, l, load),
    badge_key: l.m.badge_key,
    optional: l.optional,
  };
}

export function muscuSignature(skeletonId: string, exercises: Array<Pick<MuscuExercise, 'id'>>): string {
  return `musculation|${skeletonId}|${exercises.map((e) => e.id).join(',')}`;
}

function buildOnce(ctx: Ctx, sk: MuscuSkeleton): Line[] {
  const picked: Picked[] = [];
  sk.slots.forEach((slot, i) => {
    const slotMuscles = Array.isArray(slot.muscle) ? slot.muscle : [slot.muscle];
    if (slotMuscles.every((mu) => ctx.excludedMuscles.has(mu)) && slot.optional) return;
    const p = pickSlot(ctx, slot, i, picked, sk.target);
    if (p) picked.push(p);
    else ctx.relax.add(slot.optional ? 'optional_slot_empty' : 'slot_dropped');
  });
  let lines = picked.map((p) => lineFor(ctx, p));
  lines = breakAdjacency(ctx, lines);
  lines = applyVolumeCaps(ctx, lines);
  for (let pass = 0; pass < 3; pass++) {
    ctx.relax.delete('budget_short'); ctx.relax.delete('budget_long');
    lines = breakAdjacency(ctx, fitBudget(ctx, lines, sk.target));
    if (hasAdjacency(lines) === false && withinBudget(ctx, lines)) break;
  }
  return lines;
}

function findSkeleton(bank: SkeletonBank, target: MuscuTarget, objective: MuscuObjective): MuscuSkeleton {
  const list = bank.muscu_skeletons?.length ? bank.muscu_skeletons : MUSCU_SKELETONS;
  const sk = list.find((s) => s.target === target && s.objective === objective)
    ?? MUSCU_SKELETONS.find((s) => s.target === target && s.objective === objective);
  if (!sk) throw new InvalidMuscuParams('unknown_target', `Aucun squelette ${target} × ${objective}`);
  return sk;
}

/**
 * Cible proposable : au moins trois exercices tirables (matériel, niveau) sur deux muscles principaux
 * distincts — sinon la règle « jamais deux exercices consécutifs sur le même muscle » ne laisse qu'un exercice.
 */
export function targetAvailable(catalog: Catalog, target: MuscuTarget, equipment: MuscuEquipment, level: MuscuLevel): boolean {
  const muscles = TARGET_MUSCLES[target];
  const list = (catalog.movements.filter((m) => m.muscu) as Mv[]).filter((m) =>
    equipmentWeight(m, equipment) > 0 && levelOk(m, level) && muscles.includes(m.muscu.muscle_primary));
  return list.length >= 3 && new Set(list.map((m) => m.muscu.muscle_primary)).size >= 2;
}

/** Cibles proposables pour un matériel et un niveau — pour l'écran M2. */
export function availableTargets(catalog: Catalog, equipment: MuscuEquipment, level: MuscuLevel): MuscuTarget[] {
  return MUSCU_TARGETS.filter((t) => targetAvailable(catalog, t, equipment, level));
}

export function generateMuscu(params: MuscuParams, catalog: Catalog, bank: SkeletonBank, seed: number): MuscuWod {
  if (params.objective === 'force' && params.entry === 'after_class') {
    throw new InvalidMuscuParams('force_after_class', 'Après ma classe : la Force n\'est pas proposée (hypertrophie ou endurance)');
  }
  if (params.objective === 'force' && params.equipment === 'none') {
    throw new InvalidMuscuParams('force_without_equipment', 'Sans matériel : la Force est indisponible');
  }
  const sk = findSkeleton(bank, params.target, params.objective);
  const ac = params.entry === 'after_class' && params.after_class ? afterClassMuscles(catalog, params.after_class) : null;
  const recent = new Set(params.recent_signatures ?? []);
  if (!targetAvailable(catalog, params.target, params.equipment, params.level)) {
    throw new InvalidMuscuParams('target_unavailable', `${TARGET_LABEL[params.target]} : aucun exercice ${EQUIPMENT_LABEL[params.equipment].toLowerCase()} pour ce niveau`);
  }

  let best: { lines: Line[]; relax: Set<string>; attempts: number } | null = null;
  for (let attempt = 0; attempt < MUSCU_MAX_ATTEMPTS; attempt++) {
    const ctx: Ctx = {
      params, catalog, scheme: SCHEMES[params.objective], rng: new RNG(seed + attempt * 7919),
      exclude: new Set((params.exclude ?? []).map(norm)),
      excludedMuscles: new Set(ac?.excluded ?? []),
      relax: new Set(), pool: [],
    };
    ctx.pool = basePool(ctx);
    const lines = buildOnce(ctx, sk);
    if (!lines.length) continue;
    const sig = muscuSignature(sk.id, lines.map((l) => ({ id: l.m.id })));
    const cand = { lines, relax: ctx.relax, attempts: attempt + 1 };
    if (!recent.has(sig)) { best = cand; break; }
    if (!best) best = cand;
    best = { ...best, attempts: attempt + 1 };
    if (attempt === MUSCU_MAX_ATTEMPTS - 1) best.relax.add('repeat');
  }
  if (!best) {
    // pool vide (matériel + niveau + exclusions) : on relâche le niveau puis les exclusions, tracé
    const ctx: Ctx = {
      params: { ...params, exclude: [] }, catalog, scheme: SCHEMES[params.objective], rng: new RNG(seed),
      exclude: new Set(), excludedMuscles: new Set(), relax: new Set(['pool_empty']), pool: [],
    };
    ctx.pool = basePool(ctx);
    best = { lines: buildOnce(ctx, sk), relax: ctx.relax, attempts: MUSCU_MAX_ATTEMPTS };
  }

  const ctxOut: Ctx = {
    params, catalog, scheme: SCHEMES[params.objective], rng: new RNG(seed), exclude: new Set(), excludedMuscles: new Set(ac?.excluded ?? []),
    relax: best.relax, pool: [],
  };
  const exercises = best.lines.map((l) => toExercise(ctxOut, l));
  const seconds = total(best.lines);
  const sig = muscuSignature(sk.id, exercises);
  const stimulus = stimulusFor(params, exercises);
  const wod: MuscuWod = {
    source: 'generator',
    generator: {
      version: MUSCU_ENGINE_VERSION, skeleton_id: sk.id, seed, catalog_version: catalog.version, bank_version: bank.version,
      relaxations: [...best.relax].sort(), attempts: best.attempts,
    },
    discipline: 'musculation',
    entry: params.entry,
    target: params.target,
    objective: params.objective,
    equipment: params.equipment,
    level: params.level,
    budget_min: params.budget_min,
    blocks: [{ kind: 'strength_session', exercises }],
    estimate: { minutes: Math.round(seconds / 60), seconds },
    stimulus,
    score_type: 'tonnage',
    after_class: ac ? { excluded_muscles: ac.excluded, suggested_target: ac.suggested_target } : null,
    signature: sig,
    title: `${TARGET_LABEL[params.target]} · ${OBJECTIVE_LABEL[params.objective]}`,
    description: '',
    wod_type: 'strength',
    block_name: 'wod',
    time_cap_seconds: null,
    rounds: null,
    notes: stimulus.note,
    video_url: null,
    leaderboard_enabled: false,
    emom_interval_minutes: null,
    tabata_work_seconds: null,
    tabata_rest_seconds: null,
  };
  wod.description = renderMuscu(wod);
  return wod;
}

function stimulusFor(params: MuscuParams, exercises: MuscuExercise[]): { rpe: number; note: string } {
  const scheme = SCHEMES[params.objective];
  const parts = [scheme.rir.charAt(0).toUpperCase() + scheme.rir.slice(1)];
  if (params.objective === 'force') {
    const main = exercises.find((e) => e.role === 'main_compound');
    if (main) parts.push(`Montée en charge sur ${main.name} : 5 @ 50 % · 3 @ 65 % · 2 @ 75 % avant les séries de travail`);
  }
  if (exercises.some((e) => e.load.mode === 'rpe' && e.load.rm_reference)) {
    parts.push('Renseigne tes 1RM dans le calculateur pour avoir des charges en kg');
  }
  return { rpe: scheme.rpe, note: parts.join('. ') };
}

// ─── Rendu texte (grammaire `strength` : nom d'abord, segments « — ») ────────

function fmtRest(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

export function loadText(e: MuscuExercise): string {
  const l = e.load;
  switch (l.mode) {
    case '1rm': return `${l.kg} kg (${l.percent} %)`;
    case 'weighted': return l.kg ? `lesté ${l.kg} kg, RPE ${l.rpe}` : `lesté léger, RPE ${l.rpe}`;
    case 'bodyweight': return e.reps_unit === 'reps' ? 'poids du corps' : '—';
    default: return `RPE ${l.rpe}`;
  }
}

/** `Bench Press — 4 × 8 @ 65 kg — charge 72 % 1RM — repos 1:30` (lisible par `parseStrengthLine`). */
export function exerciseLine(e: MuscuExercise): string {
  let out = `${e.name} — ${e.sets} × ${e.reps}`;
  if (e.reps_unit !== 'reps') out += ` ${e.reps_unit}`;
  if (e.per_side) out += ` / ${sideLabel(e)}`;
  const l = e.load;
  if (l.mode === '1rm' && l.kg) {
    out += ` @ ${l.kg} kg — charge ${l.percent} % 1RM`;
  } else if (l.mode === 'weighted') {
    out += l.kg ? ` — lesté ${l.kg} kg (10 % du poids de corps), RPE ${l.rpe}` : ` — lesté léger, RPE ${l.rpe}`;
  } else if (l.mode === 'rpe') {
    out += ` — charge RPE ${l.rpe}`;
  } else if (e.reps_unit === 'reps') {
    out += ' — charge poids du corps';
  }
  if (e.rest_s > 0) out += ` — repos ${fmtRest(e.rest_s)}`;
  return out;
}

export function renderMuscu(wod: MuscuWod): string {
  const lines: string[] = [];
  lines.push(`Musculation · ${TARGET_LABEL[wod.target]} · ${OBJECTIVE_LABEL[wod.objective]} · ${wod.budget_min}' · ${EQUIPMENT_LABEL[wod.equipment]}`);
  lines.push('');
  for (const e of wod.blocks[0].exercises) {
    lines.push(exerciseLine(e));
    if (e.notes) lines.push(`  ${e.notes}`);
  }
  lines.push('');
  lines.push(`Durée estimée ${wod.estimate.minutes}'`);
  lines.push(`Stimulus : ${wod.stimulus.note}`);
  if (wod.after_class?.excluded_muscles.length) {
    lines.push(`Après ma classe : muscles évités ${wod.after_class.excluded_muscles.join(', ')}`);
  }
  return lines.join('\n');
}
