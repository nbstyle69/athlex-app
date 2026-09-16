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
export const MUSCU_DURATIONS = { express: [20, 30, 45, 60], after_class: [15, 20, 30], tronc: [15, 20, 30] } as const;
/** Débutant : bilatéral, sans lest, 4 exercices maximum (§5) — 6 à partir de 45 minutes (M7). */
export const BEGINNER_MAX_EXERCISES = 4;
export const BEGINNER_MAX_EXERCISES_LONG = 6;
export const BEGINNER_LONG_BUDGET_MIN = 45;
export const MAX_EXERCISES = 6;
/** Force : au plus deux exercices lourds (≥ 80 % ou lestés) par séance (M3). */
export const HEAVY_MAX = 2;
export const HEAVY_PERCENT = 80;
/** Troisième compound en Force : 70-75 % × 6-8 (M3). */
export const DEMOTED_RANGE: [number, number] = [6, 8];
export const DEMOTED_PERCENT_MAX = 75;
/** Repos : jamais au-dessus du schéma + 15 s (M7). */
export const REST_EXTRA_MAX = 15;
/** Poids du corps en Box / Salle (inter, avancé) : au plus un exercice hors tronc quand le muscle a des exercices chargés (M5). */
export const BODYWEIGHT_MAX_LOADED = 1;
export const BONUS_CORE_MAX = 2;
/** M7 : jamais « 5 × 20 » pour remplir — à partir de 5 séries, les reps restent sous 20. */
/** M7 : à partir de 5 séries, jamais plus de 15 reps (le « 5 × 20 » de remplissage est proscrit). */
export const HIGH_REP_SETS_MAX = 5;
export const HIGH_REP_SETS_REPS_MAX = 15;
/** M6 : une traction au poids du corps ne se programme jamais à 15-20 reps, même en Tonification (avancé). */
export const PULL_UP_ENDURANCE_RANGE: [number, number] = [8, 12];
/** Tractions poids du corps remplacées en Tonification, sauf niveau avancé (M6). */
export const BODYWEIGHT_PULL_UP_IDS = ['strict_pull_up', 'chin_up', 'wide_grip_pull_up', 'neutral_grip_pull_up', 'close_grip_pull_up'];
/** Squats jamais tirés sur une cible fessiers (M3). */
export const NO_SQUAT_TARGETS: readonly MuscuTarget[] = ['fessiers', 'fessiers_ischios'];
export const SQUAT_IDS = ['back_squat_m', 'front_squat_m'];
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

interface Scheme {
  sets: Record<'main' | 'other', number>;
  sets_min: number;
  sets_max: number;
  rest: Record<'main' | 'other', number>;
  rpe: number;
  rir: string;
}
export const SCHEMES: Record<MuscuObjective, Scheme> = {
  hypertrophie: { sets: { main: 4, other: 3 }, sets_min: 3, sets_max: 5, rest: { main: 90, other: 75 }, rpe: 8, rir: 'dernière série à 1-2 reps de l\'échec' },
  force: { sets: { main: 5, other: 4 }, sets_min: 3, sets_max: 5, rest: { main: 150, other: 120 }, rpe: 8, rir: 'RIR 2, dernière série RPE 9' },
  endurance: { sets: { main: 3, other: 3 }, sets_min: 2, sets_max: 5, rest: { main: 40, other: 40 }, rpe: 7, rir: 'rythme continu, aucune série à l\'échec' },
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
export const OBJECTIVE_LABEL: Record<MuscuObjective, string> = { hypertrophie: 'Prise de muscle', force: 'Force', endurance: 'Tonification' };
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
  readonly code: 'force_after_class' | 'force_without_equipment' | 'force_tronc' | 'tronc_duration' | 'unknown_target' | 'target_unavailable';
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
  const noSquat = NO_SQUAT_TARGETS.includes(params.target);
  const noBwPullUp = params.objective === 'endurance' && params.level !== 'avance';
  const troncMuscles = TARGET_MUSCLES.tronc;
  return (ctx.catalog.movements.filter((m) => m.muscu) as Mv[]).filter((m) =>
    equipmentWeight(m, params.equipment) > 0
    && levelOk(m, params.level)
    && !isExcluded(ctx, m)
    && !ctx.excludedMuscles.has(m.muscu.muscle_primary)
    && !(noSquat && SQUAT_IDS.includes(m.id))
    && !(noBwPullUp && BODYWEIGHT_PULL_UP_IDS.includes(m.id))
    && !(params.target === 'tronc' && m.muscu.compound && !troncMuscles.includes(m.muscu.muscle_primary)));
}

function isBodyweightNonCore(m: Mv): boolean {
  return m.muscu.load_mode === 'bodyweight' && !TARGET_MUSCLES.tronc.includes(m.muscu.muscle_primary) && m.muscu.muscle_primary !== 'mollets';
}

/** M5 : en Box / Salle (inter, avancé), un seul exercice poids du corps hors tronc quand le muscle a des exercices chargés. */
function bodyweightAllowed(ctx: Ctx, m: Mv, picked: ReadonlyArray<{ m: Mv }>): boolean {
  if (!isBodyweightNonCore(m)) return true;
  if (ctx.params.equipment === 'none' || ctx.params.level === 'debutant') return true;
  const loadedExists = ctx.pool.some((x) => x.muscu.muscle_primary === m.muscu.muscle_primary && x.muscu.load_mode !== 'bodyweight' && x.muscu.compound === m.muscu.compound);
  if (!loadedExists) return true;
  return picked.filter((p) => isBodyweightNonCore(p.m)).length < BODYWEIGHT_MAX_LOADED;
}

/**
 * M2 : un seul exercice par geste (`movement_group`), sauf Full body et sauf une paire
 * compound + isolation sur un slot `pair`. Les slots gainage (rôle core) ne comptent pas.
 */
function groupAllowed(ctx: Ctx, m: Mv, slot: MuscuSlot, picked: ReadonlyArray<Picked>): boolean {
  if (ctx.params.target === 'full_body' || slot.role === 'core') return true;
  const same = picked.filter((p) => p.role !== 'core' && p.m.muscu.movement_group === m.muscu.movement_group);
  if (!same.length) return true;
  return !!slot.pair && !m.muscu.compound && same.length === 1 && same[0].m.muscu.compound;
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
  /** troisième compound en Force : 70-75 % × 6-8 (M3) */
  demoted?: boolean;
  /** geste imposé par le squelette (tirage vertical / horizontal, M4) : jamais sacrifié au budget */
  required?: boolean;
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
    // un slot à geste imposé (tirage horizontal après le vertical, M4) peut suivre le même muscle : l'ordre est réarrangé ensuite
    if (prevMuscle && !(f.ids && slot.groups) && m.muscu.muscle_primary === prevMuscle) return false;
    if (slot.exclude_ids?.includes(m.id)) return false;
    if (f.ids && slot.ids && !slot.ids.includes(m.id)) return false;
    if (f.ids && slot.groups && !slot.groups.includes(m.muscu.movement_group)) return false;
    if (requireUnilateral && !m.muscu.unilateral) return false;
    if (f.role && !roleOk(m, slot.role)) return false;
    if (f.objective && !objectiveFor(m, ctx.params.objective)) return false;
    if (slot.role === 'main_compound' && ctx.params.objective === 'force' && !(f.ids && slot.groups) && mainMuscles.has(m.muscu.muscle_primary)) return false;
    if (!groupAllowed(ctx, m, slot, picked)) return false;
    if (!bodyweightAllowed(ctx, m, picked)) return false;
    return true;
  });
}

/** M1 : le slot principal prend le meilleur exercice disponible (`priority` 1 → 5) ; tirage pondéré seulement entre égalités. */
function choose(ctx: Ctx, list: Mv[], role: MuscuSlotRole): Mv {
  if (role === 'main_compound') {
    const best = Math.min(...list.map((m) => m.muscu.priority));
    list = list.filter((m) => m.muscu.priority === best);
  }
  return ctx.rng.pickWeighted(list, (x) => equipmentWeight(x, ctx.params.equipment))!;
}

/** Ordre de relâchement d'un slot : ids / groupes → unilatéral → rôle → objectif → muscles de la cible. */
function pickSlot(ctx: Ctx, slot: MuscuSlot, index: number, picked: Picked[], target: MuscuTarget): Picked | null {
  const slotMuscles = Array.isArray(slot.muscle) ? slot.muscle : [slot.muscle];
  const prev = picked.length ? picked[picked.length - 1].m.muscu.muscle_primary : null;
  const steps: Array<[string | null, Filter]> = [
    [null, { ids: true, unilateral: true, role: true, objective: true, muscles: slotMuscles }],
    // geste imposé (M4) : on garde le groupe avant de lâcher l'objectif ou le rôle
    [slot.groups ? 'slot_objective' : null, { ids: true, unilateral: true, role: true, objective: false, muscles: slotMuscles }],
    [slot.groups ? 'slot_role' : null, { ids: true, unilateral: true, role: false, objective: false, muscles: slotMuscles }],
    [slot.ids || slot.groups ? 'slot_ids' : null, { ids: false, unilateral: true, role: true, objective: true, muscles: slotMuscles }],
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
    const m = choose(ctx, list, slot.role);
    if (relax) ctx.relax.add(relax);
    const required = !!slot.groups && f.ids && !slot.optional;
    return { m, role: slot.role, objective: objectiveFor(m, ctx.params.objective) ?? 'hypertrophie', optional: !!slot.optional, slotIndex: index, ...(required ? { required } : {}) };
  }
  return null;
}

/**
 * M3 : en Force, les deux premiers compounds restent lourds ; le troisième passe à 70-75 % × 6-8,
 * les suivants en schéma hypertrophie.
 */
function applyHeavyCap(ctx: Ctx, picked: Picked[]): void {
  if (ctx.params.objective !== 'force') return;
  let heavy = 0;
  for (const p of picked) {
    if (p.objective !== 'force') continue;
    heavy++;
    if (heavy <= HEAVY_MAX) continue;
    if (heavy === HEAVY_MAX + 1) { p.demoted = true; ctx.relax.add('heavy_cap'); continue; }
    p.objective = 'hypertrophie';
    ctx.relax.add('heavy_cap');
  }
}

// ─── Schéma, charge, durée ───────────────────────────────────────────────────

interface Line extends Picked {
  sets: number;
  reps: number;
  range: [number, number];
  rest: number;
  /** Repos du schéma, avant tout rattrapage (M7 : jamais plus de `rest0 + REST_EXTRA_MAX`). */
  rest0: number;
  tempo?: string;
}

function repRange(m: Mv, objective: MuscuObjective): [number, number] {
  if (m.muscu.unit !== 'reps') return UNIT_RANGES[m.muscu.unit];
  if (objective === 'endurance' && BODYWEIGHT_PULL_UP_IDS.includes(m.id)) return [...PULL_UP_ENDURANCE_RANGE];
  const r = m.muscu.rep_ranges[objective] ?? m.muscu.rep_ranges.hypertrophie ?? Object.values(m.muscu.rep_ranges)[0];
  return r ? [r[0], r[1]] : [8, 12];
}

function lineFor(ctx: Ctx, p: Picked): Line {
  const scheme = SCHEMES[p.objective];
  const kind = p.role === 'main_compound' && !p.demoted ? 'main' : 'other';
  const range = p.demoted ? DEMOTED_RANGE : repRange(p.m, p.objective);
  const sets = p.role === 'core' || p.role === 'calves' ? Math.min(scheme.sets.other, 3) : scheme.sets[kind];
  const rest = p.role === 'core' ? Math.min(scheme.rest.other, p.objective === 'endurance' ? 30 : 60)
    : p.role === 'calves' ? Math.min(scheme.rest.other, 45) : scheme.rest[kind];
  // sans matériel en Prise de muscle : les polyarticulaires poids du corps se font au tempo 3-1-1 (brief §5), compté dans la durée
  const tempo = ctx.params.equipment === 'none' && ctx.params.objective === 'hypertrophie' && p.m.muscu.load_mode === 'bodyweight' && p.m.muscu.unit === 'reps' && p.m.muscu.compound
    ? TEMPO_311 : undefined;
  return { ...p, sets, reps: Math.round((range[0] + range[1]) / 2), range, rest, rest0: rest, ...(tempo ? { tempo } : {}) };
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
    const percent = l.demoted ? Math.min(percentForReps(l.reps), DEMOTED_PERCENT_MAX) : percentForReps(l.reps);
    if (params.box_wod && params.level !== 'debutant') {
      return { mode: 'percent', percent, rpe: scheme.rpe, rm_reference: mu.rm_reference };
    }
    if (rm && rm > 0 && params.level !== 'debutant') {
      return { mode: '1rm', kg: roundLoad(rm * (mu.rm_factor ?? 1) * (percent / 100)), percent, rm_reference: mu.rm_reference };
    }
    return { mode: 'rpe', rpe: params.level === 'debutant' ? 7 : scheme.rpe, percent, rm_reference: mu.rm_reference };
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
    const swappable = (l: Line, k: number) => k > i && l.m.muscu.muscle_primary !== out[i - 1].m.muscu.muscle_primary
      && (k + 1 >= out.length || out[k + 1].m.muscu.muscle_primary !== out[i].m.muscu.muscle_primary);
    let j = out.findIndex((l, k) => swappable(l, k) && l.role === out[i].role);
    if (j < 0) j = out.findIndex((l, k) => swappable(l, k) && l.role !== 'core');
    if (j > 0) { [out[i], out[j]] = [out[j], out[i]]; continue; }
    out.splice(i, 1);
    ctx.relax.add('adjacent_muscle');
    i--;
  }
  return out;
}

/** Position d'insertion d'un exercice bonus sans créer deux muscles consécutifs (de préférence en fin), -1 si impossible. */
function bonusIndex(lines: Line[], muscle: Muscle): number {
  for (let i = lines.length; i >= 1; i--) {
    if (lines[i - 1].m.muscu.muscle_primary === muscle) continue;
    if (i < lines.length && lines[i].m.muscu.muscle_primary === muscle) continue;
    return i;
  }
  return -1;
}

function bonusExercise(ctx: Ctx, lines: Line[], target: MuscuTarget): Line | null {
  const used = new Set(lines.map((l) => l.m.id));
  const cap = VOLUME_CAP_SETS[ctx.params.objective];
  const vol = volumeByMuscle(lines);
  const minSets = SCHEMES[ctx.params.objective].sets_min;
  const muscles = TARGET_MUSCLES[target].filter((mu) => !ctx.excludedMuscles.has(mu) && (vol.get(mu) ?? 0) + minSets <= cap);
  const bonusSlot: MuscuSlot = { role: 'isolation', muscle: TARGET_MUSCLES[target], optional: true };
  // le gainage bonus n'a pas à servir l'objectif (une planche n'a qu'une plage) : il prend le schéma disponible
  const eligible = (m: Mv, anyObjective = false) => !used.has(m.id) && bonusIndex(lines, m.muscu.muscle_primary) >= 0 && !ctx.excludedMuscles.has(m.muscu.muscle_primary)
    && (vol.get(m.muscu.muscle_primary) ?? 0) + minSets <= cap && (anyObjective || objectiveFor(m, ctx.params.objective))
    && groupAllowed(ctx, m, { ...bonusSlot, role: m.muscu.compound ? 'secondary_compound' : TARGET_MUSCLES.tronc.includes(m.muscu.muscle_primary) ? 'core' : 'isolation' }, lines)
    && bodyweightAllowed(ctx, m, lines);
  const targetMuscles = TARGET_MUSCLES[target];
  const primary = ctx.pool.filter((m) => eligible(m) && muscles.includes(m.muscu.muscle_primary));
  // repli : isolation dont un muscle secondaire appartient à la cible (jamais un compound d'un autre muscle : pas de squat en Tronc)
  const secondary = primary.length ? [] : ctx.pool.filter((m) => eligible(m) && !m.muscu.compound && (m.muscu.muscle_secondary as Muscle[]).some((mu) => targetMuscles.includes(mu)));
  // dernier repli : gainage (hors groupe), au plus deux lignes core ajoutées par ce chemin
  const coreMuscles = TARGET_MUSCLES.tronc;
  const tertiary = primary.length || secondary.length || lines.filter((l) => l.role === 'core' && l.slotIndex === 99).length >= BONUS_CORE_MAX ? []
    : ctx.pool.filter((m) => eligible(m, true) && coreMuscles.includes(m.muscu.muscle_primary) && (!m.muscu.compound || m.muscu.movement_group === 'carry'));
  const base = primary.length ? primary : secondary.length ? secondary : tertiary;
  const iso = base.filter((m) => !m.muscu.compound);
  const m = ctx.rng.pickWeighted(iso.length ? iso : base, (x) => equipmentWeight(x, ctx.params.equipment));
  if (!m) return null;
  const role: MuscuSlotRole = coreMuscles.includes(m.muscu.muscle_primary) ? 'core' : m.muscu.compound ? 'secondary_compound' : 'isolation';
  const p: Picked = { m, role, objective: objectiveFor(m, ctx.params.objective) ?? (m.muscu.objectives.includes('hypertrophie') ? 'hypertrophie' : m.muscu.objectives[0] ?? 'hypertrophie'), optional: true, slotIndex: 99 };
  if (ctx.params.objective === 'force' && p.objective === 'force') p.objective = 'hypertrophie';
  const line = lineFor(ctx, p);
  line.sets = Math.min(line.sets, cap - (vol.get(m.muscu.muscle_primary) ?? 0));
  return line;
}

function fitBudget(ctx: Ctx, input: Line[], target: MuscuTarget): Line[] {
  const budget = ctx.params.budget_min * 60;
  const lo = budget * (1 - MUSCU_TOLERANCE);
  const hi = budget * (1 + MUSCU_TOLERANCE);
  const maxEx = ctx.params.level === 'debutant'
    ? (ctx.params.budget_min >= BEGINNER_LONG_BUDGET_MIN ? BEGINNER_MAX_EXERCISES_LONG : BEGINNER_MAX_EXERCISES)
    : MAX_EXERCISES;
  let lines = [...input];

  // retirer une ligne ne doit pas rapprocher deux exercices du même muscle (les gestes imposés M4 sont tous deux « dos »)
  const joins = (i: number) => i > 0 && i + 1 < lines.length && lines[i - 1].m.muscu.muscle_primary === lines[i + 1].m.muscu.muscle_primary;
  const dropOptional = () => {
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].optional && !joins(i)) { lines.splice(i, 1); return true; }
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].optional) { lines.splice(i, 1); return true; }
    return false;
  };
  const dropLast = () => {
    if (lines.length <= 2) return false;
    for (let i = lines.length - 1; i > 0; i--) if (!lines[i].required && !joins(i)) { lines.splice(i, 1); return true; }
    for (let i = lines.length - 1; i > 0; i--) if (!lines[i].required) { lines.splice(i, 1); return true; }
    lines.splice(lines.length - 1, 1);
    return true;
  };
  while (lines.length > maxEx && (dropOptional() || dropLast())) ctx.relax.add('beginner_max');

  // trop long : optionnels → reps mini → une série → dernier slot
  while (total(lines) > hi) {
    if (dropOptional()) continue;
    const overReps = lines.filter((l) => l.reps > l.range[0]);
    if (overReps.length) { for (const l of overReps) l.reps = l.range[0]; continue; }
    const reducible = lines.filter((l) => l.sets > SCHEMES[l.objective].sets_min).sort((a, b) => b.sets - a.sets);
    if (reducible.length) { reducible[0].sets--; continue; }
    if (dropLast()) { ctx.relax.add('slots_dropped'); continue; }
    ctx.relax.add('budget_long');
    break;
  }

  // trop court (M7) : un exercice de plus (débutant : 6 à partir de 45') → une série de plus (jusqu'à sets_max) →
  // tempo 3-1-1 → reps vers le haut de la plage → repos + 15 s au plus → budget_short tracé. Jamais de repos au-delà.
  let guard = 0;
  while (total(lines) < lo && guard++ < 40) {
    if (lines.length < maxEx) {
      const bonus = bonusExercise(ctx, lines, target);
      if (bonus) {
        const at = bonusIndex(lines, bonus.m.muscu.muscle_primary);
        if (total([...lines, bonus]) <= hi) { lines.splice(at, 0, bonus); ctx.relax.add('bonus_slot'); continue; }
        bonus.reps = bonus.range[0];
        if (total([...lines, bonus]) <= hi) { lines.splice(at, 0, bonus); ctx.relax.add('bonus_slot'); continue; }
      }
    }
    const cap = VOLUME_CAP_SETS[ctx.params.objective];
    const vol = volumeByMuscle(lines);
    const addable = lines.filter((l) => l.sets < SCHEMES[l.objective].sets_max && (vol.get(l.m.muscu.muscle_primary) ?? 0) < cap)
      .sort((a, b) => a.sets - b.sets || a.slotIndex - b.slotIndex);
    // une 5e série à 20 reps serait du remplissage (M7) : on redistribue le volume, 5 séries plus courtes
    const fits = (l: Line) => {
      const reps = l.reps;
      l.sets++;
      if (l.sets >= HIGH_REP_SETS_MAX && l.m.muscu.unit === 'reps') l.reps = Math.min(l.reps, Math.max(l.range[0], HIGH_REP_SETS_REPS_MAX));
      if (total(lines) <= hi) return true;
      l.sets--; l.reps = reps; return false;
    };
    if (addable.some(fits)) continue;
    const tempoable = lines.filter((l) => !l.tempo && !l.demoted && l.objective !== 'force' && l.m.muscu.unit === 'reps' && l.m.muscu.seconds_per_rep < TEMPO_311_SECONDS_PER_REP)
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const slow = (l: Line) => { l.tempo = TEMPO_311; if (total(lines) <= hi) return true; delete l.tempo; return false; };
    if (tempoable.some(slow)) { ctx.relax.add('tempo_311'); continue; }
    const maxReps = (l: Line) => (l.sets >= HIGH_REP_SETS_MAX && l.m.muscu.unit === 'reps' ? Math.min(l.range[1], Math.max(l.range[0], HIGH_REP_SETS_REPS_MAX)) : l.range[1]);
    const underReps = lines.filter((l) => l.reps < maxReps(l));
    if (underReps.length) {
      for (const l of underReps) l.reps = Math.min(maxReps(l), l.reps + (l.range[1] - l.range[0] >= 4 ? 2 : 1));
      continue;
    }
    const restable = lines.filter((l) => l.rest < l.rest0 + REST_EXTRA_MAX);
    if (restable.length) {
      const before = restable.map((l) => l.rest);
      for (const l of restable) l.rest = l.rest0 + REST_EXTRA_MAX;
      if (total(lines) <= hi) { ctx.relax.add('rest_plus_15'); continue; }
      restable.forEach((l, i) => { l.rest = before[i]; });
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
  if (l.demoted) parts.push('3e compound : 70-75 % × 6-8');
  if (load.mode === 'bodyweight' && ctx.params.level === 'debutant' && /pull_up|chin_up/.test(l.m.id) && !/banded/.test(l.m.id)) parts.push('Débutant : banded');
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
    movement_group: l.m.muscu.movement_group,
    priority: l.m.muscu.priority,
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
  applyHeavyCap(ctx, picked);
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
  if (params.target === 'tronc' && params.objective === 'force') {
    throw new InvalidMuscuParams('force_tronc', 'Tronc : la Force n\'est pas proposée (Prise de muscle ou Tonification)');
  }
  if (params.target === 'tronc' && !(MUSCU_DURATIONS.tronc as readonly number[]).includes(params.budget_min)) {
    throw new InvalidMuscuParams('tronc_duration', 'Tronc : durées 15, 20 ou 30 minutes');
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
  if (!params.box_wod && exercises.some((e) => e.load.mode === 'rpe' && e.load.rm_reference)) {
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
    case 'percent': return `${l.percent} % 1RM`;
    case 'weighted': return l.kg ? `lesté ${l.kg} kg, RPE ${l.rpe}` : `lesté léger, RPE ${l.rpe}`;
    case 'bodyweight': return e.reps_unit === 'reps' ? 'poids du corps' : '—';
    default: return l.percent ? `RPE ${l.rpe} (≈ ${l.percent} % du 1RM)` : `RPE ${l.rpe}`;
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
  } else if (l.mode === 'percent') {
    out += ` — RPE ${l.rpe} (≈ ${l.percent} % du 1RM)`;
  } else if (l.mode === 'weighted') {
    out += l.kg ? ` — lesté ${l.kg} kg (10 % du poids de corps), RPE ${l.rpe}` : ` — lesté léger, RPE ${l.rpe}`;
  } else if (l.mode === 'rpe') {
    out += l.percent ? ` — charge RPE ${l.rpe} (≈ ${l.percent} % du 1RM)` : ` — charge RPE ${l.rpe}`;
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
