import type {
  Catalog, CatalogMovement, FormatChoice, FunctionalIntention, GeneratedMuscuWeek, GeneratedSession, GeneratedWeek, GeneratedWod, Muscle,
  MuscuObjective, MuscuTarget, MuscuWeekDay, MuscuWeekParams, MuscuWod, Pattern, SessionBlock, SessionBlockAOption,
  SessionBlockBOption, SessionDay, SessionFinisherOption, SessionParams, SessionSkeleton, SessionStructuredBlock,
  SkeletonBank, StrengthStep, WeekParams,
} from './types';
import { NoValidWod } from './types';
import { RNG } from './rng';
import { movementById, primaryPattern } from './catalog';
import { generateBlocC } from './generate';
import { deathByMinute, ladderProgress, roundSeconds } from './estimate';
import { generateMuscu, renderMuscu, sessionSeconds, SCHEMES } from './muscu';

export const SESSION_ENGINE_VERSION = '1.0.0';
/** ± 10 % autour de 60' (brief J1 §5.1) */
export const SESSION_TOLERANCE = 0.10;
/** minute de transition entre deux blocs */
export const TRANSITION_MIN = 1;
/** plafonds gym hebdomadaires RX (brief J1 §5.5) */
export const WEEKLY_GYM_CAPS = { pull: 150, hspu: 80 } as const;
export const WEEKLY_PULL_IDS: ReadonlySet<string> = new Set(['chest_to_bar', 'pull_up', 'toes_to_bar']);
export const WEEKLY_HSPU_IDS: ReadonlySet<string> = new Set(['handstand_push_up', 'strict_handstand_push_up']);
/** plafond hebdomadaire Musculation : séries par muscle principal (brief J1 §3b) */
export const MUSCU_WEEKLY_CAP_SETS = 16;
export const MUSCU_WEEK_DAYS: ReadonlyArray<{ day: SessionDay; target: MuscuTarget; budget_min: number }> = [
  { day: 1, target: 'push', budget_min: 45 },
  { day: 2, target: 'jambes', budget_min: 45 },
  { day: 4, target: 'pull', budget_min: 45 },
  { day: 5, target: 'fessiers_ischios', budget_min: 45 },
  { day: 6, target: 'tronc', budget_min: 20 },
];
/** objectif par bloc de deux semaines, en boucle (semaines 1-2 hypertrophie, 3-4 endurance, 5-6 force) */
export const MUSCU_OBJECTIVE_CYCLE: readonly MuscuObjective[] = ['hypertrophie', 'endurance', 'force'];

export const DAY_LABEL: Record<SessionDay, string> = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' };

// ─── Graine ──────────────────────────────────────────────────────────────────

/** FNV-1a 32 bits d'une chaîne : graine reproductible `hash(box_id, iso_year, iso_week[, regen])`. */
export function hashSeed(...parts: Array<string | number>): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Semaine ISO 8601 d'une date (UTC). */
export function isoWeek(date: Date): { iso_year: number; iso_week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { iso_year: d.getUTCFullYear(), iso_week: Math.ceil(((d.getTime() - y0) / 86400000 + 1) / 7) };
}

/** Lundi (UTC) de la semaine ISO. */
export function isoWeekMonday(iso_year: number, iso_week: number): Date {
  const jan4 = new Date(Date.UTC(iso_year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (dow - 1) * 86400000);
  monday.setUTCDate(monday.getUTCDate() + (iso_week - 1) * 7);
  return monday;
}

export function muscuObjectiveForWeek(iso_week: number): MuscuObjective {
  return MUSCU_OBJECTIVE_CYCLE[Math.floor((iso_week - 1) / 2) % MUSCU_OBJECTIVE_CYCLE.length];
}

// ─── Rendu (grammaire `strength`) ────────────────────────────────────────────

function fmtRest(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

function fmtEvery(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}'${String(r).padStart(2, '0')}` : `${m}'`;
}

function nameOf(catalog: Catalog, id: string): string {
  return movementById(catalog, id)?.name ?? id;
}

/** `Back Squat — 5 × 5 @ 75 %1RM — repos 2:30 — tempo 3-1-X-1 — charge …` */
export function stepLine(name: string, st: StrengthStep, tempo?: string | null): string {
  let out = `${name} — ${st.sets} × ${st.reps}`;
  if (st.percent !== null) out += ` @ ${st.percent} %1RM`;
  out += ` — repos ${fmtRest(st.rest_s)}`;
  if (tempo && !st.note?.startsWith('montée')) out += ` — tempo ${tempo}`;
  if (st.note) out += ` — charge ${st.note}`;
  return out;
}

const CAT_LABEL: Record<string, string> = { scaled: 'Scaled', inter: 'Inter', rx: 'RX', rxplus: 'RX+', elite: 'Elite', pro: 'Pro' };

function blockALines(catalog: Catalog, opt: SessionBlockAOption, weeks: 'even' | 'odd'): string[] {
  const name = nameOf(catalog, opt.movement);
  const lines: string[] = [];
  if (opt.kind === 'weightlifting') {
    const complex = (opt.complex ?? []).map((id) => nameOf(catalog, id));
    lines.push(`Haltéro — complexe ${name} (${weeks === 'even' ? 'A' : 'B'}) : ${complex.join(' + ')}`);
    lines.push('Un complexe = une répétition, sans lâcher la barre. Sans 1RM connu : monter jusqu\'à une charge propre.');
    for (const st of opt.steps ?? []) lines.push(stepLine(name, st));
  } else if (opt.kind === 'strength') {
    lines.push(`Force — ${name}`);
    for (const st of opt.steps ?? []) lines.push(stepLine(name, st, opt.tempo));
    if (opt.tempo) lines.push(`Tempo ${opt.tempo} sur les séries de travail. Sans 1RM connu : dernière série RPE 8.`);
  } else if (opt.skill) {
    const sk = opt.skill;
    lines.push(`Skill — ${name} : progression en 3 étapes`);
    lines.push(`Étape A : positions et tension (hollow / arch, scap, kip) — ${fmtEvery(180)}`);
    lines.push(`Étape B : la répétition partielle ou assistée — ${fmtEvery(180)}`);
    lines.push(`Étape C : Every ${fmtEvery(sk.every_s)} × ${sk.rounds}`);
    lines.push(`${sk.reps} ${name}`);
    const subs = Object.entries(sk.substitutions).map(([c, s]) => `${CAT_LABEL[c] ?? c} : ${s}`);
    if (subs.length) lines.push(`→ ${subs.join(' · ')}`);
  }
  return lines;
}

function blockBLines(catalog: Catalog, opt: SessionBlockBOption): string[] {
  const name = nameOf(catalog, opt.movement);
  const lines = [`Building — ${name} tempo ${opt.tempo ?? ''}`.trim()];
  for (const st of opt.steps) lines.push(stepLine(name, st, opt.tempo));
  return lines;
}

function finisherLines(catalog: Catalog, opt: SessionFinisherOption): string[] {
  const lines = [`Finisher — ${opt.rounds} rounds, rythme continu :`];
  for (const m of opt.movements) {
    const name = nameOf(catalog, m.id);
    lines.push(m.unit === 's' ? `${m.qty} s ${name}` : m.unit === 'm' ? `${m.qty} m ${name}` : `${m.qty} ${name}`);
  }
  return lines;
}

// ─── Volume gym ──────────────────────────────────────────────────────────────

/** Reps RX attendues par mouvement du bloc C (quantité × multiplicateur du format). */
export function blocCRepsRx(wod: GeneratedWod): Record<string, number> {
  const b = wod.blocks[0];
  const budgetS = wod.budget_min * 60;
  const out: Record<string, number> = {};
  for (const gm of b.movements) {
    let mult = 1;
    if (gm.round === undefined) {
      switch (b.format) {
        case 'rounds_for_time': case 'interval': case 'stations': case 'emom': mult = b.rounds ?? 1; break;
        case 'amrap': case 'continuous': mult = Math.ceil(budgetS / roundSeconds(b, 'rx')); break;
        case 'ladder': {
          const { step } = ladderProgress(b, 'rx', budgetS);
          const start = b.ladder?.start ?? gm.qty;
          const inc = b.ladder?.step ?? gm.qty;
          const n = inc > 0 ? Math.max(1, Math.floor((step - start) / inc) + 1) : 1;
          mult = n * (start + (n - 1) * inc / 2) / Math.max(1, gm.qty);
          break;
        }
        case 'death_by': {
          const n = deathByMinute(b, 'rx', wod.budget_min);
          mult = gm.per_minute ? (n * (n + 1)) / 2 / Math.max(1, gm.qty) : n;
          break;
        }
        case 'tabata': mult = 0; break;
        default: mult = 1;
      }
    }
    out[gm.id] = (out[gm.id] ?? 0) + Math.round(gm.qty * mult);
  }
  return out;
}

function addReps(into: Record<string, number>, from: Record<string, number>): void {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
}

function gymReps(catalog: Catalog, reps: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(reps)) if (movementById(catalog, id)?.family === 'gym') out[id] = n;
  return out;
}

export function weeklyGymVolume(sessions: GeneratedSession[]): { pull: number; hspu: number } {
  let pull = 0;
  let hspu = 0;
  for (const s of sessions) {
    for (const [id, n] of Object.entries(s.gym_reps_rx)) {
      if (WEEKLY_PULL_IDS.has(id)) pull += n;
      if (WEEKLY_HSPU_IDS.has(id)) hspu += n;
    }
  }
  return { pull, hspu };
}

// ─── Séance ──────────────────────────────────────────────────────────────────

export class InvalidSessionParams extends Error {
  constructor(public code: string, message: string) { super(message); }
}

function skeletonForDay(bank: SkeletonBank, day: SessionDay): SessionSkeleton {
  const sk = bank.session_skeletons.find((s) => s.day === day);
  if (!sk) throw new InvalidSessionParams('no_skeleton', `Aucun squelette de séance pour le jour ${day}`);
  return sk;
}

function heavyPatternOf(m: CatalogMovement | undefined): Pattern | null {
  if (!m) return null;
  const p = primaryPattern(m);
  return p ?? null;
}

function editor(title: string, description: string, wod_type: SessionBlock['wod_type'], block_name: SessionBlock['block_name'], sort_order: number, minutes: number, wod_json: SessionBlock['wod_json'], notes: string | null): SessionBlock {
  return {
    title, description, wod_type, block_name, sort_order, minutes, wod_json, notes,
    time_cap_seconds: null, rounds: null, video_url: null, leaderboard_enabled: false,
    emom_interval_minutes: null, tabata_work_seconds: null, tabata_rest_seconds: null,
  };
}

function structured(kind: SessionStructuredBlock['kind'], option_id: string, extra: Partial<SessionStructuredBlock>): SessionStructuredBlock {
  return {
    source: 'generator', discipline: 'session', kind, option_id, movement: null, heavy_pattern: null, steps: null, complex: null,
    skill: null, finisher: null, gym_reps_rx: {}, ...extra,
  };
}

/**
 * Séance de box (brief J1) : échauffement + A + B optionnel + C + finisher optionnel,
 * 60' ± 10 %. Le bloc C passe par `generateBlocC` (règles A–K) avec `pattern_not` =
 * pattern lourd du bloc A et `skeleton_not` = squelette C de la veille.
 */
export function generateSession(params: SessionParams, catalog: Catalog, bank: SkeletonBank, seed: number): GeneratedSession {
  const sk = skeletonForDay(bank, params.day);
  const rng = new RNG(seed);
  const weeks: 'even' | 'odd' = params.iso_week % 2 === 0 ? 'even' : 'odd';
  const relax = new Set<string>();

  // Bloc A
  let optA: SessionBlockAOption | null = null;
  if (sk.block_a) {
    const eligible = sk.block_a.filter((o) => !o.weeks || o.weeks === weeks);
    optA = rng.pick(eligible.length ? eligible : sk.block_a);
  }
  const movA = optA ? movementById(catalog, optA.movement) : undefined;
  const heavy = optA && optA.kind !== 'skill' ? heavyPatternOf(movA) : null;
  const optB = sk.block_b ? rng.pick(sk.block_b) : null;
  const optF = sk.finisher ? rng.pick(sk.finisher) : null;

  // Bloc C : durée choisie pour tenir 60' avec / sans B et finisher
  const fixed = sk.warmup.minutes + (optA?.minutes ?? 0);
  const lo = sk.budget_min * (1 - SESSION_TOLERANCE);
  const hi = sk.budget_min * (1 + SESSION_TOLERANCE);
  const combos: Array<{ c: number; b: boolean; f: boolean }> = [];
  for (const c of sk.block_c.durations) for (const b of [true, false]) for (const f of [true, false]) {
    if (b && !optB) continue;
    if (f && !optF) continue;
    combos.push({ c, b, f });
  }
  const totalOf = (x: { c: number; b: boolean; f: boolean }) => {
    const blocks = 1 + (optA ? 1 : 0) + (x.b ? 1 : 0) + (x.f ? 1 : 0);
    return fixed + x.c + (x.b ? optB!.minutes : 0) + (x.f ? optF!.minutes : 0) + TRANSITION_MIN * blocks;
  };
  const fitting = combos.filter((x) => totalOf(x) >= lo && totalOf(x) <= hi);
  const pool = fitting.length ? fitting : combos.sort((a, b) => Math.abs(totalOf(a) - sk.budget_min) - Math.abs(totalOf(b) - sk.budget_min)).slice(0, 1);
  if (!fitting.length) relax.add('session_budget');
  // préférer la séance la plus complète (B puis finisher), tirage parmi les ex æquo
  const rank = (x: { b: boolean; f: boolean }) => (x.b ? 2 : 0) + (x.f ? 1 : 0);
  const bestRank = Math.max(...pool.map(rank));
  let choice = rng.pick(pool.filter((x) => rank(x) === bestRank));

  const patternNot: Pattern[] = [
    ...(sk.block_c.pattern_not === 'heavy_pattern' ? (heavy ? [heavy] : []) : sk.block_c.pattern_not),
    ...(params.pattern_not ?? []),
  ];
  const intention: FunctionalIntention = rng.pick(sk.block_c.intentions);
  const format = sk.block_c.formats ? rng.pick(sk.block_c.formats) : undefined;
  const cSeed = (seed + 104729 * params.day) >>> 0;
  const exclude = [...(sk.block_c.exclude ?? []), ...(params.exclude ?? [])];
  const neighbours = [params.previous_c_skeleton, params.next_c_skeleton].filter((s): s is string => !!s);
  const skeletonNot = neighbours.length ? neighbours : undefined;
  // Cascade quand le Functional n'a aucun WOD valide, l'intention d'abord
  // préservée : nouveau tirage (autre graine) puis format libre, autre durée du
  // squelette (avec puis sans format), autre intention du squelette, et en tout
  // dernier le pattern lourd toléré. Chaque étape est tracée dans `relaxations`.
  const attempts: Array<{ tag: string | null; c: number; intention: FunctionalIntention; format?: FormatChoice; patternNot: Pattern[] }> = [
    { tag: null, c: choice.c, intention, format, patternNot },
  ];
  attempts.push({ tag: 'c_fallback:reseed', c: choice.c, intention, format, patternNot });
  if (format) attempts.push({ tag: 'c_fallback:format', c: choice.c, intention, format: undefined, patternNot });
  for (const c of sk.block_c.durations) if (c !== choice.c) attempts.push({ tag: 'c_fallback:duration', c, intention, format, patternNot });
  if (format) for (const c of sk.block_c.durations) if (c !== choice.c) attempts.push({ tag: 'c_fallback:duration', c, intention, format: undefined, patternNot });
  for (const i of sk.block_c.intentions) if (i !== intention) attempts.push({ tag: 'c_fallback:intention', c: choice.c, intention: i, format: undefined, patternNot });
  if (patternNot.length) attempts.push({ tag: 'c_fallback:pattern', c: choice.c, intention, format: undefined, patternNot: [] });
  let blocC: GeneratedWod | null = null;
  let lastErr: unknown = null;
  for (const [idx, a] of attempts.entries()) {
    try {
      blocC = generateBlocC({
        entry: 'express',
        discipline: 'functional',
        budget_min: a.c,
        intention: a.intention,
        format: a.format,
        exclude,
        recent_signatures: params.recent_signatures ?? [],
        pattern_not: a.patternNot.length ? a.patternNot : undefined,
        skeleton_not: skeletonNot,
      }, catalog, bank, idx === 0 ? cSeed : hashSeed(cSeed, a.tag ?? '', idx));
      if (a.tag) relax.add(a.tag);
      if (a.c !== choice.c) choice = { ...choice, c: a.c };
      break;
    } catch (e) {
      if (!(e instanceof NoValidWod)) throw e;
      lastErr = e;
    }
  }
  if (!blocC) throw lastErr;
  for (const r of blocC.generator.relaxations) relax.add(`c:${r}`);

  // Assemblage des lignes box_wods
  const blocks: SessionBlock[] = [];
  const gym: Record<string, number> = {};
  const warm = [...sk.warmup.lines, ''];
  let sort = 0;
  if (optA) {
    const lines = blockALines(catalog, optA, weeks);
    const aReps: Record<string, number> = {};
    if (optA.skill) aReps[optA.movement] = optA.skill.reps * optA.skill.rounds;
    addReps(gym, gymReps(catalog, aReps));
    const kindLabel = optA.kind === 'weightlifting' ? 'Haltéro' : optA.kind === 'strength' ? 'Force' : 'Skill';
    blocks.push(editor(
      `${kindLabel} · ${nameOf(catalog, optA.movement)}`,
      [...warm, ...lines].join('\n'),
      optA.kind === 'skill' ? 'custom' : 'strength',
      optA.kind === 'skill' ? 'skill' : 'strength',
      sort++, sk.warmup.minutes + optA.minutes,
      structured(optA.kind, optA.id, {
        movement: optA.movement, heavy_pattern: heavy, steps: optA.steps ?? null, complex: optA.complex ?? null,
        skill: optA.skill ?? null, gym_reps_rx: gymReps(catalog, aReps),
      }),
      optA.kind === 'weightlifting' ? 'Pourcentages du 1RM du mouvement complet ; sans 1RM, charge propre.' : null,
    ));
  }
  if (choice.b && optB) {
    const bReps: Record<string, number> = {};
    for (const st of optB.steps) bReps[optB.movement] = (bReps[optB.movement] ?? 0) + st.sets * st.reps;
    addReps(gym, gymReps(catalog, bReps));
    blocks.push(editor(
      `Building · ${nameOf(catalog, optB.movement)}`,
      blockBLines(catalog, optB).join('\n'),
      'strength', 'building', sort++, optB.minutes,
      structured('building', optB.id, { movement: optB.movement, steps: optB.steps, gym_reps_rx: gymReps(catalog, bReps) }),
      null,
    ));
  }
  const cReps = blocCRepsRx(blocC);
  addReps(gym, gymReps(catalog, cReps));
  const cDescription = optA ? blocC.description : [...warm, blocC.description].join('\n');
  blocks.push({
    title: blocC.title,
    description: cDescription,
    wod_type: blocC.wod_type,
    block_name: 'wod',
    sort_order: sort++,
    minutes: choice.c + (optA ? 0 : sk.warmup.minutes),
    wod_json: blocC,
    time_cap_seconds: blocC.time_cap_seconds,
    rounds: blocC.rounds,
    notes: blocC.notes,
    video_url: null,
    leaderboard_enabled: true,
    emom_interval_minutes: blocC.emom_interval_minutes,
    tabata_work_seconds: blocC.tabata_work_seconds,
    tabata_rest_seconds: blocC.tabata_rest_seconds,
  });
  if (choice.f && optF) {
    const fReps: Record<string, number> = {};
    for (const m of optF.movements) if (m.unit === 'reps') fReps[m.id] = (fReps[m.id] ?? 0) + m.qty * optF.rounds;
    addReps(gym, gymReps(catalog, fReps));
    blocks.push(editor(
      'Finisher', finisherLines(catalog, optF).join('\n'), 'custom', 'finisher', sort++, optF.minutes,
      structured('finisher', optF.id, { finisher: optF, gym_reps_rx: gymReps(catalog, fReps) }),
      null,
    ));
  }

  return {
    source: 'generator',
    discipline: 'session',
    generator: {
      version: SESSION_ENGINE_VERSION, skeleton_id: sk.id, seed, catalog_version: catalog.version, bank_version: bank.version,
      relaxations: [...relax].sort(),
    },
    day: params.day,
    iso_year: params.iso_year,
    iso_week: params.iso_week,
    label: sk.label,
    budget_min: sk.budget_min,
    total_minutes: totalOf(choice),
    heavy_pattern: heavy,
    blocks,
    bloc_c: blocC,
    gym_reps_rx: gym,
    signature: blocC.signature,
  };
}

/**
 * Semaine CrossFit / Hyrox : 6 séances lundi → samedi, graine dérivée par jour,
 * squelette C ≠ veille, signatures C jamais répétées (journal + semaine courante),
 * plafonds gym hebdo : samedi puis mercredi (brief §5.5) retirés au bloc C gym (pull_v / push_v)
 * si dépassement, puis vendredi, jeudi, lundi, mardi tant que le plafond tient encore — chaque
 * jour retiré est tracé `weekly_gym_cap:<jour>`.
 */
export function generateWeek(params: WeekParams, catalog: Catalog, bank: SkeletonBank, seed: number): GeneratedWeek {
  const relax = new Set<string>();
  const recent = [...(params.recent_signatures ?? [])];
  const sessions: GeneratedSession[] = [];
  const gen = (day: SessionDay, patternNot?: Pattern[]) => generateSession({
    day, iso_year: params.iso_year, iso_week: params.iso_week,
    recent_signatures: [...recent, ...sessions.filter((s) => s.day !== day).map((s) => s.signature)],
    previous_c_skeleton: sessions.find((s) => s.day === day - 1)?.bloc_c.generator.skeleton_id ?? null,
    next_c_skeleton: sessions.find((s) => s.day === day + 1)?.bloc_c.generator.skeleton_id ?? null,
    pattern_not: patternNot,
    exclude: params.exclude,
  }, catalog, bank, (seed + day * 7919) >>> 0);
  for (const day of [1, 2, 3, 4, 5, 6] as SessionDay[]) sessions.push(gen(day));

  for (const day of [6, 3, 5, 4, 1, 2] as SessionDay[]) {
    const vol = weeklyGymVolume(sessions);
    if (vol.pull <= WEEKLY_GYM_CAPS.pull && vol.hspu <= WEEKLY_GYM_CAPS.hspu) break;
    const patternNot: Pattern[] = [];
    if (vol.pull > WEEKLY_GYM_CAPS.pull) patternNot.push('pull_v');
    if (vol.hspu > WEEKLY_GYM_CAPS.hspu) patternNot.push('push_v');
    const i = sessions.findIndex((s) => s.day === day);
    sessions[i] = gen(day, patternNot);
    relax.add(`weekly_gym_cap:${day}`);
  }
  const gym_volume = weeklyGymVolume(sessions);
  if (gym_volume.pull > WEEKLY_GYM_CAPS.pull || gym_volume.hspu > WEEKLY_GYM_CAPS.hspu) relax.add('weekly_gym_cap_exceeded');

  return { track: 'crossfit', iso_year: params.iso_year, iso_week: params.iso_week, seed, sessions, gym_volume, relaxations: [...relax].sort() };
}

// ─── Semaine Musculation ─────────────────────────────────────────────────────

function setsByMuscle(days: MuscuWeekDay[]): Map<Muscle, number> {
  const v = new Map<Muscle, number>();
  for (const d of days) for (const e of d.wod.blocks[0].exercises) v.set(e.muscle_primary, (v.get(e.muscle_primary) ?? 0) + e.sets);
  return v;
}

function recomputeEstimate(catalog: Catalog, wod: MuscuWod): void {
  const lines = wod.blocks[0].exercises.flatMap((e) => {
    const m = movementById(catalog, e.id);
    return m?.muscu ? [{ sets: e.sets, reps: e.reps, rest: e.rest_s, m: { muscu: m.muscu } }] : [];
  });
  const seconds = sessionSeconds(lines);
  wod.estimate = { minutes: Math.round(seconds / 60), seconds };
  wod.description = renderMuscu(wod);
}

/**
 * Semaine Musculation (brief J1 §3b) : 5 jours (push, jambes, pull, fessiers-ischios, tronc),
 * objectif par bloc de deux semaines, charges en %1RM / RPE (WOD de box), plafond
 * hebdomadaire de 16 séries par muscle principal (retrait de séries sur les derniers jours).
 */
export function generateMuscuWeek(params: MuscuWeekParams, catalog: Catalog, bank: SkeletonBank, seed: number): GeneratedMuscuWeek {
  const objective = muscuObjectiveForWeek(params.iso_week);
  const equipment = params.equipment ?? 'box';
  const level = params.level ?? 'inter';
  const relax = new Set<string>();
  const recent = [...(params.recent_signatures ?? [])];
  const days: MuscuWeekDay[] = [];
  for (const d of MUSCU_WEEK_DAYS) {
    const wod = generateMuscu({
      entry: 'express', target: d.target, objective, budget_min: d.budget_min, equipment, level,
      exclude: params.exclude, recent_signatures: [...recent, ...days.map((x) => x.wod.signature)], box_wod: true,
    }, catalog, bank, (seed + d.day * 7919) >>> 0);
    for (const r of wod.generator.relaxations) relax.add(`${d.target}:${r}`);
    days.push({ day: d.day, target: d.target, budget_min: d.budget_min, wod });
  }

  // plafond hebdo : retirer une série à la fois, du dernier jour vers le premier, sans passer sous le minimum du scheme
  const minSets = SCHEMES[objective].sets_min;
  const touched = new Set<MuscuWod>();
  for (let guard = 0; guard < 200; guard++) {
    const over = [...setsByMuscle(days).entries()].find(([, n]) => n > MUSCU_WEEKLY_CAP_SETS);
    if (!over) break;
    const [muscle] = over;
    let done = false;
    for (let i = days.length - 1; i >= 0 && !done; i--) {
      const exs = days[i].wod.blocks[0].exercises.filter((e) => e.muscle_primary === muscle && e.sets > minSets);
      const e = exs.sort((a, b) => b.sets - a.sets)[0];
      if (e) { e.sets -= 1; touched.add(days[i].wod); done = true; }
    }
    if (!done) {
      for (let i = days.length - 1; i >= 0 && !done; i--) {
        const list = days[i].wod.blocks[0].exercises;
        const j = list.findIndex((e) => e.muscle_primary === muscle && list.length > 3);
        if (j >= 0) { list.splice(j, 1); touched.add(days[i].wod); done = true; }
      }
    }
    if (!done) { relax.add(`weekly_cap_exceeded:${muscle}`); break; }
    relax.add(`weekly_cap:${muscle}`);
  }
  for (const wod of touched) {
    wod.generator = { ...wod.generator, relaxations: [...new Set([...wod.generator.relaxations, 'weekly_cap'])].sort() };
    recomputeEstimate(catalog, wod);
  }

  const sets_by_muscle: Partial<Record<Muscle, number>> = {};
  for (const [m, n] of setsByMuscle(days)) sets_by_muscle[m] = n;
  return { track: 'musculation', iso_year: params.iso_year, iso_week: params.iso_week, seed, objective, days, sets_by_muscle, relaxations: [...relax].sort() };
}
