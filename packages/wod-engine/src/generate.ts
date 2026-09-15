import {
  Band, Catalog, CatalogMovement, Category, EditorColumns, Family, FormatChoice, GenerateParams, GeneratedBlock,
  GeneratedMovement, GeneratedWod, Intention, Modality, NoValidWod, Pattern, RangeFormat, Skeleton, SkeletonBank, SkeletonFormat,
  Slot, SkeletonVariant, Unit,
} from './types';
import {
  categoriesFor, cadenceFor, functionalRef, isFunctionalCategory, loadsFor, movementById, primaryPattern,
  resolveMovement, substitutionFor, weightFor,
} from './catalog';
import { RNG } from './rng';
import { estimateAll, estimateBlock, referenceCategory, roundSeconds, fixedWorkSeconds, TIME_BOUNDED, movementSeconds, TRANSITION_S } from './estimate';
import { signature } from './signature';
import { render } from './render';

export const ENGINE_VERSION = '1.0.0';
export const MAX_ATTEMPTS = 200;
export const TOLERANCE = 0.10;

const DEFAULT_BAND: Record<Intention, Band> = {
  mixed: 'medium', cardio: 'light', force: 'heavy', gym: 'light',
  interval: 'medium', engine: 'light', aerobic: 'light', run: 'light', core: 'light',
};

const FORMAT_CHOICES: Record<Exclude<FormatChoice, 'surprise'>, SkeletonFormat[]> = {
  amrap: ['amrap'],
  for_time: ['for_time', 'rounds_for_time', 'ladder'],
  emom: ['emom', 'death_by'],
  chipper: ['chipper'],
  stations: ['stations', 'continuous'],
  interval: ['interval', 'tabata'],
};

const RANGE_FORMAT: Record<SkeletonFormat, RangeFormat> = {
  amrap: 'amrap', for_time: 'for_time', rounds_for_time: 'for_time', chipper: 'for_time', ladder: 'for_time',
  emom: 'emom', death_by: 'emom', tabata: 'emom', interval: 'interval', stations: 'interval', continuous: 'interval',
};

/** Familles « matériel » exclues après la classe (les familles au poids du corps restent tirables). */
const EQUIPMENT_FAMILIES: ReadonlySet<Family> = new Set<Family>([
  'barbell', 'dumbbell', 'kettlebell', 'erg', 'run', 'sled', 'carry', 'sandbag', 'wallball', 'jump_rope', 'box',
]);
/** Patterns jamais exclus après la classe : ils sont le socle de tout complément. */
const NEVER_EXCLUDED: ReadonlySet<Pattern> = new Set<Pattern>(['core', 'mono']);

export const VEST_LOAD_KG: Record<Category, number> = {
  scaled: 6, inter: 6, rx: 9, rxplus: 9, elite: 9, pro: 9,
  women: 6, men: 9, women_pro: 6, men_pro: 9,
};

export const AFTER_CLASS_DURATIONS = [10, 15, 20];

// ─── Contexte de tirage ──────────────────────────────────────────────────────

interface AfterClassFilter { patterns: Set<Pattern>; families: Set<Family> }

interface Ctx {
  params: GenerateParams;
  catalog: Catalog;
  bank: SkeletonBank;
  rng: RNG;
  ref: Category;
  exclude: Set<string>;
  afterClass: AfterClassFilter | null;
  /** ids atteignables seulement par substitution / variante (poids faible + cible d'une autre ligne) */
  subOnly: Set<string>;
}

interface Picked {
  slot: Slot;
  index: number;
  m: CatalogMovement;
  unit: Unit;
  band: Band;
  qty: number;
  scheme?: number[];
  round?: number;
  range?: [number, number];
}

class Reject extends Error {
  constructor(readonly reason: string) { super(reason); }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** « 20 cal Row (RPE 7) » → « Row » : les blocs du jour arrivent parfois en lignes rendues. */
function stripLine(line: string): string {
  return line
    .replace(/^\s*(?:R\d+|Min \d+|Station \d+)\s*·\s*/i, '')
    .replace(/^\s*\d+(?:\s*\/\s*\d+)?\s*(?:cal|kcal|m|s|sec|reps?)?\.?\s+/i, '')
    .replace(/\s*[(@].*$/, '')
    .trim();
}

export function afterClassFilter(catalog: Catalog, dayMovements: string[]): AfterClassFilter {
  const patterns = new Set<Pattern>();
  const families = new Set<Family>();
  for (const raw of dayMovements) {
    const m = resolveMovement(catalog, raw) ?? resolveMovement(catalog, stripLine(raw));
    if (!m) continue;
    for (const p of m.pattern) if (!NEVER_EXCLUDED.has(p)) patterns.add(p);
    if (EQUIPMENT_FAMILIES.has(m.family)) families.add(m.family);
  }
  if (patterns.has('squat')) patterns.add('lunge');
  if (patterns.has('lunge')) patterns.add('squat');
  return { patterns, families };
}

function substitutionOnlyIds(catalog: Catalog, discipline: GenerateParams['discipline']): Set<string> {
  const targets = new Set<string>();
  for (const m of catalog.movements) {
    if (m.substitutions) for (const id of Object.values(m.substitutions)) if (id && id !== m.id) targets.add(id);
    if (m.variant_up) targets.add(m.variant_up);
  }
  const out = new Set<string>();
  for (const m of catalog.movements) if (targets.has(m.id) && weightFor(m, discipline) <= 3) out.add(m.id);
  return out;
}

function isExcluded(ctx: Ctx, m: CatalogMovement): boolean {
  if (ctx.exclude.size === 0) return false;
  if (ctx.exclude.has(m.id) || ctx.exclude.has(norm(m.name)) || ctx.exclude.has(m.family)) return true;
  for (const e of m.equipment) if (ctx.exclude.has(norm(e))) return true;
  return false;
}

/** §5 : après la classe tout est light ; Force n'est jamais light ; heavy interdit au-delà de 15'. */
function constrainBand(band: Band, params: GenerateParams): Band {
  if (params.entry === 'after_class') return 'light';
  if (params.intention === 'force' && band === 'light') band = 'medium';
  if (band === 'heavy' && params.budget_min > 15) band = 'medium';
  return band;
}

function effectiveBand(sk: Skeleton, params: GenerateParams): Band {
  return constrainBand(sk.band_by_intention[params.intention] ?? DEFAULT_BAND[params.intention], params);
}

// ─── Sélection des squelettes ────────────────────────────────────────────────

function formatsFor(choice: FormatChoice | undefined): SkeletonFormat[] | null {
  if (!choice || choice === 'surprise') return null;
  return FORMAT_CHOICES[choice];
}

/** Paliers de squelettes candidats, du tirage exact aux relâchements successifs (format, durée ±5, intention). */
function candidateTiers(params: GenerateParams, bank: SkeletonBank): Array<{ list: Skeleton[]; relaxations: string[] }> {
  const base = bank.skeletons.filter((s) => s.discipline === params.discipline && s.intentions.includes(params.intention));
  const formats = formatsFor(params.format);
  const near = (d: number) => Math.abs(d - params.budget_min) <= 5;
  const acDur = (s: Skeleton) => params.entry !== 'after_class' || s.durations.some((d) => AFTER_CLASS_DURATIONS.includes(d));
  const all = bank.skeletons.filter((s) => s.discipline === params.discipline);
  const steps: Array<[string[], Skeleton[], (s: Skeleton) => boolean]> = [
    [[], base, (s) => s.durations.includes(params.budget_min) && (!formats || formats.includes(s.format)) && acDur(s)],
    [['format'], base, (s) => s.durations.includes(params.budget_min) && acDur(s)],
    [['format', 'duration±5'], base, (s) => s.durations.some(near) && acDur(s)],
    [['format', 'intention'], all, (s) => s.durations.includes(params.budget_min) && acDur(s)],
    [['format', 'intention', 'duration±5'], all, (s) => s.durations.some(near) && acDur(s)],
  ];
  const tiers: Array<{ list: Skeleton[]; relaxations: string[] }> = [];
  for (const [relaxations, pool, keep] of steps) {
    const list = pool.filter(keep);
    const key = list.map((x) => x.id).join(',');
    if (list.length && !tiers.some((t) => t.list.map((x) => x.id).join(',') === key)) tiers.push({ list, relaxations });
  }
  return tiers;
}

/** Tirages consécutifs ratés sur un palier avant de passer au palier plus relâché. */
export const TIER_ATTEMPTS = 50;

// ─── Tirage des mouvements ───────────────────────────────────────────────────

function pickUnit(slot: Slot, m: CatalogMovement): Unit | null {
  const want = slot.pick.unit ?? (m.family === 'erg' ? slot.pick.erg_unit : undefined);
  if (want) return m.units_allowed.includes(want) ? want : null;
  return m.unit_default;
}

function matchesPick(ctx: Ctx, slot: Slot, m: CatalogMovement, picked: Picked[], format: SkeletonFormat, functionalSmall: boolean): string | null {
  const p = slot.pick;
  if (!m.active) return 'inactive';
  if (weightFor(m, ctx.params.discipline) <= 0) return 'zero_weight';
  if (ctx.subOnly.has(m.id)) return 'substitution_only';
  if (p.ids && !p.ids.includes(m.id)) return 'ids';
  if (p.family && !p.family.includes(m.family)) return 'family';
  if (p.modality && !p.modality.includes(m.modality)) return 'modality';
  if (p.pattern_any && !m.pattern.some((x) => p.pattern_any!.includes(x))) return 'pattern_any';
  if (p.pattern_not && m.pattern.some((x) => p.pattern_not!.includes(x))) return 'pattern_not';
  if (isExcluded(ctx, m)) return 'excluded';
  if (pickUnit(slot, m) === null) return 'unit';
  if (!m.rep_ranges) return 'no_ranges';
  if (ctx.afterClass) {
    if (m.pattern.some((x) => ctx.afterClass!.patterns.has(x))) return 'after_class_pattern';
    if (ctx.afterClass.families.has(m.family)) return 'after_class_family';
  }
  if (picked.some((q) => q.m.id === m.id)) return 'duplicate';
  if (p.pattern_not_of_slot !== undefined) {
    const other = picked.find((q) => q.index === p.pattern_not_of_slot);
    if (other && primaryPattern(other.m) === primaryPattern(m)) return 'pattern_not_of_slot';
  }
  if (p.no_shared_high_grip_with !== undefined) {
    const other = picked.find((q) => q.index === p.no_shared_high_grip_with);
    if (other && other.m.grip === 'high' && m.grip === 'high') return 'shared_high_grip';
  }
  const prev = picked.length ? picked[picked.length - 1] : undefined;
  if (prev && prev.round === undefined) {
    // `mono` exempté : la banque enchaîne volontairement run → erg (Hybrid) ; les ergs sont bornés par `consecutive_erg`.
    if (primaryPattern(prev.m) === primaryPattern(m) && primaryPattern(m) !== 'mono') return 'consecutive_pattern';
    if (prev.m.grip === 'high' && m.grip === 'high') return 'consecutive_grip';
    if ((format === 'stations' || format === 'emom') && prev.m.shoulder_load === 'high' && m.shoulder_load === 'high') return 'consecutive_shoulder';
    if (prev.m.family === 'erg' && m.family === 'erg' && (format === 'stations' || format === 'continuous')) return 'consecutive_erg';
  }
  if (functionalSmall && m.family === 'barbell' && picked.some((q) => q.m.family === 'barbell')) return 'second_barbell';
  return null;
}

function drawMovement(ctx: Ctx, slot: Slot, index: number, picked: Picked[], format: SkeletonFormat, functionalSmall: boolean): CatalogMovement {
  const reasons: Record<string, number> = {};
  const pool = ctx.catalog.movements.filter((m) => {
    const r = matchesPick(ctx, slot, m, picked, format, functionalSmall);
    if (r) reasons[r] = (reasons[r] ?? 0) + 1;
    return r === null;
  });
  const m = ctx.rng.pickWeighted(pool, (x) => weightFor(x, ctx.params.discipline));
  if (!m) throw new Reject(`slot_${index}_empty:${Object.keys(reasons).sort().join(',')}`);
  return m;
}

function roundQty(q: number, unit: Unit): number {
  if (unit === 'm') {
    if (q >= 1000) return Math.round(q / 100) * 100;
    return q >= 200 ? Math.round(q / 50) * 50 : q >= 50 ? Math.round(q / 10) * 10 : Math.round(q / 5) * 5;
  }
  if (unit === 'cal' || unit === 's') return q >= 20 ? Math.round(q / 5) * 5 : Math.round(q);
  return Math.max(1, Math.round(q));
}

function rangeFor(slot: Slot, m: CatalogMovement, unit: Unit, format: SkeletonFormat): [number, number] {
  if (slot.reps_range) return slot.reps_range;
  const r = m.rep_ranges?.[unit]?.[RANGE_FORMAT[format]];
  if (!r) throw new Reject(`no_range:${m.id}:${unit}`);
  return r;
}

function drawFixed(ctx: Ctx, slot: Slot, m: CatalogMovement, unit: Unit): number {
  if (slot.fixed_by_id && slot.fixed_by_id[m.id] !== undefined) return slot.fixed_by_id[m.id];
  if (slot.fixed !== undefined) return slot.fixed;
  if (slot.fixed_range) return roundQty(ctx.rng.int(slot.fixed_range[0], slot.fixed_range[1]), unit);
  throw new Reject(`fixed_missing:${m.id}`);
}

function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)); }

// ─── Construction d'un bloc ──────────────────────────────────────────────────

interface Draft {
  sk: Skeleton;
  variantId: string | null;
  slots: Slot[];
  band: Band;
  picked: Picked[];
  rounds: number | null;
  scheme?: number[];
  rest?: GeneratedBlock['rest'];
  stations?: number;
}

function activeSlots(ctx: Ctx, sk: Skeleton, variant: SkeletonVariant | null): Slot[] {
  const src = variant ? variant.slots : sk.slots;
  const sc = sk.station_count;
  if (!sc) return src;
  let n: number;
  if (sc.by_duration && sc.by_duration[ctx.params.budget_min] !== undefined) n = sc.by_duration[ctx.params.budget_min];
  else if (sc.min !== undefined && sc.max !== undefined) n = ctx.rng.int(sc.min, sc.max);
  else n = src.length;
  const required = src.filter((s) => !s.optional);
  const optional = src.filter((s) => s.optional);
  const chosen = new Set<Slot>(required);
  for (const o of optional) if (chosen.size < n) chosen.add(o);
  return src.filter((s) => chosen.has(s));
}

function pickRounds(ctx: Ctx, sk: Skeleton, variant: SkeletonVariant | null, band: Band): number[] {
  const r = variant?.rounds ?? sk.rounds;
  if (!r || r === 'amrap') return [0];
  if (r === 'scheme') return [(variant?.scheme ?? sk.scheme_by_band?.[band] ?? sk.scheme ?? []).length];
  const max = Math.min(r.max, sk.max_rounds_by_band?.[band] ?? r.max);
  const list: number[] = [];
  for (let i = r.min; i <= max; i++) list.push(i);
  return ctx.rng.shuffle(list);
}

function toGenerated(ctx: Ctx, d: Draft, p: Picked): GeneratedMovement {
  const cats = categoriesFor(ctx.params.discipline);
  const loads: GeneratedMovement['loads_by_category'] = {};
  const subs: GeneratedMovement['substitutions_by_category'] = {};
  const vars: GeneratedMovement['variant_by_category'] = {};
  const cad: GeneratedMovement['cadence_by_category'] = {};
  for (const c of cats) {
    loads[c] = p.m.loads ? loadsFor(p.m, c, p.band) : null;
    const subId = substitutionFor(p.m, c);
    subs[c] = subId && subId !== p.m.id ? (movementById(ctx.catalog, subId)?.name ?? null) : null;
    const ref = functionalRef(c);
    vars[c] = d.sk.allow_variant_up && p.m.variant_up && isFunctionalCategory(c) && (ref === 'elite' || ref === 'pro')
      ? (movementById(ctx.catalog, p.m.variant_up)?.name ?? null)
      : null;
    const cd = cadenceFor(p.m, c, p.unit);
    if (cd === undefined) throw new Reject(`no_cadence:${p.m.id}:${p.unit}`);
    cad[c] = cd;
  }
  return {
    id: p.m.id,
    name: p.m.name,
    unit: p.unit,
    qty: p.qty,
    ...(p.scheme ? { scheme: p.scheme } : {}),
    ...(p.round !== undefined ? { round: p.round } : {}),
    ...(p.slot.qty === 'minute' ? { per_minute: true } : {}),
    cadence_by_category: cad,
    load_band: p.m.loads ? p.band : null,
    loads_by_category: loads,
    substitutions_by_category: subs,
    variant_by_category: vars,
    load_unit: p.m.load_unit,
    badge_key: p.m.badge_key,
  };
}

function blockOf(ctx: Ctx, d: Draft): GeneratedBlock {
  return {
    kind: 'wod',
    format: d.sk.format,
    rounds: d.rounds,
    timecap: null,
    ...(d.scheme ? { scheme: d.scheme } : {}),
    ...(d.rest ? { rest: d.rest } : {}),
    ...(d.stations ? { stations: d.stations } : {}),
    movements: d.picked.map((p) => toGenerated(ctx, d, p)),
  };
}

function within(est: number, budget: number): boolean {
  return Math.abs(est - budget) / budget <= TOLERANCE + 1e-9;
}

/** Ajuste les quantités « range » d'un facteur, bornées par leur plage ; retourne false si rien n'a bougé. */
function scaleRanges(d: Draft, factor: number): boolean {
  let moved = false;
  for (const p of d.picked) {
    if (!p.range) continue;
    const next = clamp(roundQty(p.qty * factor, p.unit), p.range[0], p.range[1]);
    if (next !== p.qty) { p.qty = next; moved = true; }
  }
  return moved;
}

function refBlock(ctx: Ctx, d: Draft): GeneratedBlock { return blockOf(ctx, d); }

/** Formats à volume fixe : ajuste rounds et quantités pour tomber dans ±10 % du budget. */
function fitFixedVolume(ctx: Ctx, d: Draft, roundsCandidates: number[]): void {
  const budgetS = ctx.params.budget_min * 60;
  for (const rounds of roundsCandidates) {
    d.rounds = rounds || null;
    for (let iter = 0; iter < 4; iter++) {
      const est = fixedWorkSeconds(refBlock(ctx, d), ctx.ref);
      if (within(est / 60, ctx.params.budget_min)) return;
      if (!scaleRanges(d, budgetS / est)) break;
    }
  }
  throw new Reject('duration_fixed');
}

/** For time à schéma : essaie les schémas alternatifs (du plus court au plus long) jusqu'à tomber dans ±10 %. */
function fitScheme(ctx: Ctx, d: Draft, alternatives: number[][]): void {
  const sum = (s: number[]) => s.reduce((a, b) => a + b, 0);
  const ordered = [...new Set([d.scheme!, ...alternatives].map((s) => JSON.stringify(s)))]
    .map((s) => JSON.parse(s) as number[])
    .sort((a, b) => sum(a) - sum(b));
  for (const scheme of ordered) {
    d.scheme = scheme;
    d.rounds = d.sk.format === 'chipper' ? null : scheme.length;
    for (const p of d.picked) {
      if (d.sk.format === 'chipper') p.qty = scheme[p.index] ?? scheme[scheme.length - 1];
      else if (p.scheme) { p.scheme = scheme; p.qty = sum(scheme); }
    }
    const est = fixedWorkSeconds(refBlock(ctx, d), ctx.ref);
    if (within(est / 60, ctx.params.budget_min)) return;
  }
  throw new Reject('duration_scheme');
}

function fitInterval(ctx: Ctx, d: Draft, roundsCandidates: number[]): void {
  const rest = d.sk.rest ?? {};
  const variantRest = d.variantId ? d.sk.variants?.find((v) => v.id === d.variantId)?.rest : undefined;
  const r = { ...rest, ...variantRest };
  if (r.every_s !== undefined) {
    const everyList = Array.isArray(r.every_s) ? ctx.rng.shuffle([...r.every_s]) : [r.every_s];
    const frac = d.sk.max_work_fraction ?? 0.65;
    for (const every of everyList) {
      for (const rounds of roundsCandidates) {
        d.rounds = rounds;
        d.rest = { every_s: every };
        const targetWork = every * frac * 0.85;
        for (let iter = 0; iter < 4; iter++) {
          const work = roundSeconds(refBlock(ctx, d), ctx.ref);
          const total = every * (rounds - 1) + work;
          if (work <= every * frac && within(total / 60, ctx.params.budget_min)) return;
          if (work > every * frac || iter === 0) { if (!scaleRanges(d, targetWork / work)) break; } else break;
        }
      }
    }
    throw new Reject('duration_interval');
  }
  const restS = typeof r.rest_s === 'number' ? r.rest_s : 60;
  for (const rounds of roundsCandidates) {
    d.rounds = rounds;
    d.rest = { rest_s: restS };
    const work = roundSeconds(refBlock(ctx, d), ctx.ref);
    const total = rounds * work + restS * (rounds - 1);
    if (within(total / 60, ctx.params.budget_min)) return;
  }
  throw new Reject('duration_interval_rest');
}

function fitAmrap(ctx: Ctx, d: Draft): void {
  const budgetS = ctx.params.budget_min * 60;
  // cible : 3 à 10 rounds attendus pour la catégorie de référence
  for (let iter = 0; iter < 4; iter++) {
    const rs = roundSeconds(refBlock(ctx, d), ctx.ref);
    const rounds = budgetS / rs;
    if (rounds >= 3 && rounds <= 10) return;
    const target = rounds < 3 ? budgetS / 4 : budgetS / 8;
    if (!scaleRanges(d, target / rs)) break;
  }
  throw new Reject('amrap_round_length');
}

function fitEmom(ctx: Ctx, d: Draft): void {
  const every = typeof d.sk.rest?.every_s === 'number' ? d.sk.rest.every_s : 60;
  const maxWork = d.sk.max_station_work_s ?? every * 0.65;
  d.rest = { every_s: every };
  d.rounds = Math.floor((ctx.params.budget_min * 60) / every / d.picked.length);
  if (d.rounds < 2) throw new Reject('emom_too_short');
  for (const p of d.picked) {
    const m = toGenerated(ctx, d, p);
    for (let iter = 0; iter < 4; iter++) {
      const work = movementSeconds({ ...m, qty: p.qty }, ctx.ref);
      if (work <= maxWork && work >= maxWork * 0.4) break;
      if (!p.range) { if (work > maxWork) throw new Reject('emom_station_too_long'); break; }
      const next = clamp(roundQty(p.qty * ((maxWork * 0.8) / work), p.unit), p.range[0], p.range[1]);
      if (next === p.qty) { if (work > maxWork) throw new Reject('emom_station_too_long'); break; }
      p.qty = next;
    }
  }
}

function fitStations(ctx: Ctx, d: Draft): void {
  const rest = d.sk.rest ?? {};
  const works = Array.isArray(rest.work_s) ? seq(rest.work_s[0], rest.work_s[1], 15) : [rest.work_s ?? 60];
  const rests = Array.isArray(rest.rest_s) ? seq(rest.rest_s[0], rest.rest_s[1], 15) : [rest.rest_s ?? 15];
  const roundsList = pickRounds(ctx, d.sk, null, d.band);
  const n = d.picked.length;
  const combos: Array<[number, number, number]> = [];
  for (const rounds of roundsList) for (const w of works) for (const r of rests) combos.push([rounds, w, r]);
  for (const [rounds, w, r] of ctx.rng.shuffle(combos)) {
    const total = (rounds * n * (w + r)) / 60;
    if (within(total, ctx.params.budget_min)) {
      d.rounds = rounds;
      d.rest = { work_s: w, rest_s: r };
      d.stations = n;
      for (const p of d.picked) {
        const cad = cadenceFor(p.m, ctx.ref, p.unit);
        if (!cad) throw new Reject(`no_cadence:${p.m.id}`);
        p.qty = roundQty(w / cad, p.unit);
      }
      return;
    }
  }
  throw new Reject('duration_stations');
}

function seq(a: number, b: number, step: number): number[] {
  const out: number[] = [];
  for (let v = a; v <= b; v += step) out.push(v);
  return out;
}

function fitLadder(ctx: Ctx, d: Draft): void {
  const scheme = d.sk.scheme ?? [];
  const budgetS = ctx.params.budget_min * 60;
  let acc = 0;
  let steps = 0;
  for (let i = 0; i < scheme.length; i++) {
    const stepS = d.picked.reduce((s, p) => s + scheme[i] * (cadenceFor(p.m, ctx.ref, p.unit) ?? 0) + TRANSITION_S, 0);
    acc += stepS;
    steps = i + 1;
    if (acc > budgetS) break;
  }
  if (steps < 3) throw new Reject('ladder_too_short');
  d.scheme = scheme.slice(0, Math.min(scheme.length, steps + 1));
  d.rounds = null;
  for (const p of d.picked) { p.scheme = d.scheme; p.qty = d.scheme.reduce((s, q) => s + q, 0); }
}

function fitDeathBy(ctx: Ctx, d: Draft): void {
  const main = d.picked.find((p) => p.slot.qty === 'minute');
  if (!main) throw new Reject('death_by_no_main');
  const cad = cadenceFor(main.m, ctx.ref, main.unit) ?? 0;
  const buy = d.picked.filter((p) => p !== main).reduce((s, p) => s + p.qty * (cadenceFor(p.m, ctx.ref, p.unit) ?? 0) + TRANSITION_S, 0);
  let minute = 0;
  for (let n = 1; n <= ctx.params.budget_min; n++) { if (buy + n * cad > 60) break; minute = n; }
  if (minute < Math.ceil(ctx.params.budget_min * 0.6)) throw new Reject('death_by_too_fast');
  d.rest = { every_s: 60 };
  d.rounds = null;
}

function fitContinuous(ctx: Ctx, d: Draft): void {
  const cycle = roundSeconds(refBlock(ctx, d), ctx.ref);
  const budgetS = ctx.params.budget_min * 60;
  if (budgetS / cycle < 1.5) throw new Reject('continuous_cycle_too_long');
  d.rounds = null;
  d.stations = d.picked.length;
}

function fitTabata(ctx: Ctx, d: Draft): void {
  const transition = ctx.params.budget_min >= 10 ? 60 : 30;
  d.rest = { work_s: 20, rest_s: 10, transition_s: transition };
  d.rounds = 8;
  const total = (2 * 8 * 30 + transition) / 60;
  if (!within(total, ctx.params.budget_min)) throw new Reject('duration_tabata');
  for (const p of d.picked) p.qty = 0;
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

function buildDraft(ctx: Ctx, sk: Skeleton): Draft {
  const variant = sk.variants && sk.variants.length ? ctx.rng.pick(sk.variants) : null;
  const band = effectiveBand(sk, ctx.params);
  const slots = activeSlots(ctx, sk, variant);
  const format = sk.format;
  const functionalSmall = ctx.params.discipline === 'functional' && slots.length <= 3;
  const scheme = variant?.scheme ?? sk.scheme_by_band?.[band] ?? sk.scheme;
  const d: Draft = { sk, variantId: variant?.id ?? null, slots, band, picked: [], rounds: null };
  const roundsCandidates = pickRounds(ctx, sk, variant, band);
  const rounds = roundsCandidates[0] || null;

  slots.forEach((slot, index) => {
    const m = drawMovement(ctx, slot, index, d.picked, format, functionalSmall);
    const unit = pickUnit(slot, m)!;
    const slotBand = slot.pick.band ? constrainBand(slot.pick.band, ctx.params) : band;
    const base: Picked = { slot, index, m, unit, band: slotBand, qty: 0 };
    switch (slot.qty) {
      case 'range': {
        const r = rangeFor(slot, m, unit, format);
        base.range = r;
        base.qty = roundQty(ctx.rng.int(r[0], r[1]), unit);
        break;
      }
      case 'fixed': base.qty = drawFixed(ctx, slot, m, unit); break;
      case 'scheme': {
        if (!scheme) throw new Reject('scheme_missing');
        if (format === 'chipper') base.qty = scheme[index] ?? scheme[scheme.length - 1];
        else { base.scheme = scheme; base.qty = scheme.reduce((s, q) => s + q, 0); }
        break;
      }
      case 'minute': base.qty = 1; break;
    }
    if (slot.rotate_per_round && rounds && rounds >= 4) {
      // un mouvement différent par round, tirage sans remise
      const extra: Picked[] = [];
      base.round = 1;
      for (let r = 2; r <= rounds; r++) {
        const mm = drawMovement(ctx, slot, index, [...d.picked, base, ...extra], format, functionalSmall);
        const uu = pickUnit(slot, mm)!;
        const q: Picked = { slot, index, m: mm, unit: uu, band: slotBand, qty: 0, round: r };
        if (slot.qty === 'range') { q.range = rangeFor(slot, mm, uu, format); q.qty = roundQty(ctx.rng.int(q.range[0], q.range[1]), uu); }
        else q.qty = drawFixed(ctx, slot, mm, uu);
        extra.push(q);
      }
      d.picked.push(base, ...extra);
    } else {
      d.picked.push(base);
    }
  });
  if (format !== 'chipper' && scheme && !variant?.scheme) d.scheme = scheme;
  if (variant?.scheme) d.scheme = variant.scheme;

  switch (format) {
    case 'amrap': fitAmrap(ctx, d); d.rounds = null; break;
    case 'emom': fitEmom(ctx, d); break;
    case 'interval': fitInterval(ctx, d, roundsCandidates); break;
    case 'stations': fitStations(ctx, d); break;
    case 'ladder': fitLadder(ctx, d); break;
    case 'death_by': fitDeathBy(ctx, d); break;
    case 'continuous': fitContinuous(ctx, d); break;
    case 'tabata': fitTabata(ctx, d); break;
    case 'rounds_for_time': {
      const rotating = d.picked.some((p) => p.round !== undefined);
      fitFixedVolume(ctx, d, rotating ? [rounds ?? 1] : roundsCandidates);
      break;
    }
    case 'chipper':
      if (scheme && d.sk.scheme_alternatives?.length) { d.scheme = scheme; fitScheme(ctx, d, d.sk.scheme_alternatives); d.scheme = undefined; d.rounds = null; }
      else fitFixedVolume(ctx, d, roundsCandidates);
      break;
    default:
      if (d.scheme && d.sk.scheme_alternatives?.length) fitScheme(ctx, d, d.sk.scheme_alternatives);
      else fitFixedVolume(ctx, d, d.scheme ? [d.scheme.length] : [0]);
      d.rounds = null;
  }
  applyVolumeCaps(ctx, d);
  checkComposition(ctx, d);
  return d;
}

/** §5 : un Hybrid contient un erg ou de la course ; un Functional contient de l'haltéro (W) ou de la gym (G). */
function checkComposition(ctx: Ctx, d: Draft): void {
  if (ctx.params.discipline === 'hybrid') {
    if (!d.picked.some((p) => p.m.family === 'erg' || p.m.family === 'run')) throw new Reject('hybrid_without_erg_or_run');
  } else {
    const has = (mod: Modality) => d.picked.some((p) => p.m.modality === mod);
    if (!has('W') && !has('G')) throw new Reject('functional_without_W_or_G');
    const need = INTENTION_MODALITY[ctx.params.intention];
    if (need && !has(need)) throw new Reject(`intention_without_${need}`);
  }
}

/** L'intention Functional exige la modalité qui la nomme : Force ⇒ une charge, Gym ⇒ un gymnastique, Cardio ⇒ un mono. */
const INTENTION_MODALITY: Partial<Record<Intention, Modality>> = { force: 'W', gym: 'G', cardio: 'M' };

function applyVolumeCaps(ctx: Ctx, d: Draft): void {
  const caps = ctx.bank.volume_caps[ctx.params.discipline][ctx.ref] ?? {};
  const mult = d.sk.format === 'rounds_for_time' ? (d.rounds ?? 1) : 1;
  for (const p of d.picked) {
    const cap = caps[p.unit];
    if (cap === undefined) continue;
    const perRound = p.round !== undefined ? 1 : mult;
    if (p.qty * perRound > cap) throw new Reject(`volume_cap:${p.m.id}`);
  }
}

function finalize(ctx: Ctx, d: Draft, relaxations: string[], attempts: number, seed: number): GeneratedWod {
  const block = blockOf(ctx, d);
  const refEst = estimateBlock(block, ctx.ref, ctx.params.budget_min);
  const timeBounded = TIME_BOUNDED.has(d.sk.format) || d.sk.format === 'interval' || d.sk.score_type !== 'time';
  block.timecap = timeBounded ? null : Math.ceil((refEst.minutes * d.sk.cap_factor) / 0.5) * 30;
  const vest = ctx.params.discipline === 'hybrid' && ctx.params.vest && ctx.params.vest !== 'none'
    ? { mode: ctx.params.vest, load_kg_by_category: pickCats(ctx) }
    : null;
  const partial: Omit<GeneratedWod, 'estimate' | 'signature' | keyof EditorColumns> = {
    source: 'generator',
    generator: {
      version: ENGINE_VERSION,
      skeleton_id: d.sk.id + (d.variantId ? `:${d.variantId}` : ''),
      seed,
      catalog_version: ctx.catalog.version,
      bank_version: ctx.bank.version,
      relaxations,
      attempts,
    },
    discipline: ctx.params.discipline,
    entry: ctx.params.entry,
    intention: ctx.params.intention,
    format: d.sk.format,
    budget_min: ctx.params.budget_min,
    vest,
    blocks: [block],
    stimulus: { ...d.sk.stimulus },
    score_type: d.sk.score_type,
    after_class: ctx.afterClass
      ? { excluded_patterns: [...ctx.afterClass.patterns].sort(), excluded_families: [...ctx.afterClass.families].sort() }
      : null,
  };
  const estimate = estimateAll({ ...partial, ...emptyEditor() });
  const wod: GeneratedWod = { ...emptyEditor(), ...partial, estimate, signature: '' };
  wod.signature = signature(wod);
  return render(wod);
}

function pickCats(ctx: Ctx): Partial<Record<Category, number>> {
  const out: Partial<Record<Category, number>> = {};
  for (const c of categoriesFor(ctx.params.discipline)) out[c] = VEST_LOAD_KG[c];
  return out;
}

function emptyEditor(): EditorColumns {
  return {
    title: '', description: '', wod_type: 'custom', block_name: 'wod', time_cap_seconds: null, rounds: null,
    notes: null, video_url: null, leaderboard_enabled: true, emom_interval_minutes: null,
    tabata_work_seconds: null, tabata_rest_seconds: null,
  };
}

// ─── API publique ────────────────────────────────────────────────────────────

export function generateBlocC(params: GenerateParams, catalog: Catalog, bank: SkeletonBank, seed: number): GeneratedWod {
  const rng = new RNG(seed);
  const ref = params.profile_category ?? referenceCategory({ discipline: params.discipline });
  const refOk = categoriesFor(params.discipline).includes(ref);
  const ctx: Ctx = {
    params,
    catalog,
    bank,
    rng,
    ref: refOk ? ref : referenceCategory({ discipline: params.discipline }),
    exclude: new Set((params.exclude ?? []).map(norm)),
    afterClass: params.entry === 'after_class' && params.after_class
      ? afterClassFilter(catalog, params.after_class.day_movements)
      : null,
    subOnly: substitutionOnlyIds(catalog, params.discipline),
  };
  const tiers = candidateTiers(params, bank);
  if (!tiers.length) throw new NoValidWod('Aucun squelette compatible', { no_skeleton: 1 });
  const recent = new Set(params.recent_signatures ?? []);
  const reasons: Record<string, number> = {};
  let tier = 0;
  let tierFails = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (tierFails >= TIER_ATTEMPTS && tier < tiers.length - 1) { tier++; tierFails = 0; }
    const { list, relaxations } = tiers[tier];
    const sk = rng.pick(list);
    try {
      const d = buildDraft(ctx, sk);
      const wod = finalize(ctx, d, relaxations, attempt, seed);
      if (recent.has(wod.signature)) throw new Reject('recent_signature');
      return wod;
    } catch (e) {
      if (e instanceof Reject) { tierFails++; reasons[`${sk.id}:${e.reason}`] = (reasons[`${sk.id}:${e.reason}`] ?? 0) + 1; continue; }
      throw e;
    }
  }
  throw new NoValidWod(`Aucun WOD valide après ${MAX_ATTEMPTS} tirages`, reasons);
}
