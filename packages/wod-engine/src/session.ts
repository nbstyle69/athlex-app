import type {
  Catalog, CatalogMovement, FormatChoice, FunctionalIntention, GeneratedMuscuWeek, GeneratedSession, GeneratedWeek, GeneratedWod, Muscle,
  MuscuObjective, MuscuTarget, MuscuWeekDay, MuscuWeekParams, MuscuWod, Pattern, SessionBlock, SessionBlockAOption,
  SessionBlockBOption, SessionDay, SessionFinisherOption, SessionParams, SessionSkeleton, SessionStructuredBlock,
  SkeletonBank, StrengthStep, WeekParams, Band, Intention, SessionStationItem, SessionTrack, WeekSeen,
} from './types';
import { NoValidWod } from './types';
import { RNG } from './rng';
import { movementById, primaryPattern, loadsFor } from './catalog';
import { generateBlocC } from './generate';
import { deathByMinute, ladderProgress, roundSeconds, referenceCategory } from './estimate';
import { generateMuscu, renderMuscu, sessionSeconds, SCHEMES } from './muscu';
import { TARGET_MUSCLES } from './bank/muscu';
import { SESSION_SKELETONS } from './bank/session';
import {
  HYBRID_FORBIDDEN_IDS, HYBRID_JUMP_IDS, HYBRID_WEEKLY_JUMP_CAP, HYBRID_WEEKLY_RUN_M, HYBRID_HARD_RPE,
  HYBRID_FRIDAY_RUN_M,
} from './bank/session-hybrid';

export const SESSION_ENGINE_VERSION = '1.0.0';
/** ± 10 % autour de 60' (brief J1 §5.1) */
export const SESSION_TOLERANCE = 0.10;
/** minute de transition entre deux blocs */
export const TRANSITION_MIN = 1;
/** durée des étapes A et B d'un skill (secondes) */
export const SKILL_STEP_S = 180;
export const B_RETRY_MAX = 12;
/** préfixe des finishers dans le journal `signatures` (anti-répétition 4 semaines) */
export const FINISHER_SIGNATURE_PREFIX = 'finisher:';

export function finisherSignature(id: string): string {
  return `${FINISHER_SIGNATURE_PREFIX}${id}`;
}

export function splitSignatures(all: readonly string[]): { c: string[]; finishers: string[] } {
  const c: string[] = [];
  const finishers: string[] = [];
  for (const s of all) {
    if (s.startsWith(FINISHER_SIGNATURE_PREFIX)) finishers.push(s.slice(FINISHER_SIGNATURE_PREFIX.length));
    else c.push(s);
  }
  return { c, finishers };
}
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

/** saut de ligne des descriptions de blocs */
const NL = '\n';

const CAT_LABEL: Record<string, string> = { scaled: 'Scaled', inter: 'Inter', rx: 'RX', rxplus: 'RX+', elite: 'Elite', pro: 'Pro' };

/**
 * Un skill lu depuis `wod_skeletons` peut venir d'un seed antérieur aux progressions
 * (prod du 16/09/2026, seed 20261217) : on complète alors depuis le snapshot embarqué,
 * et on refuse explicitement un skill inconnu plutôt que de laisser un TypeError.
 */
export function withSkillProgression(opt: SessionBlockAOption): SessionBlockAOption {
  if (!opt.skill || opt.skill.progression) return opt;
  const snapshot = SESSION_SKELETONS.flatMap((s) => s.block_a ?? []).find((o) => o.id === opt.id)?.skill?.progression;
  if (!snapshot) {
    throw new Error(`Skill « ${opt.id} » (${opt.movement}) sans progression A/B : absente de la banque chargée et du snapshot embarqué`);
  }
  return { ...opt, skill: { ...opt.skill, progression: snapshot } };
}

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
    lines.push(`Étape A : ${sk.progression.a} — ${fmtEvery(SKILL_STEP_S)}`);
    lines.push(`Étape B : ${sk.progression.b} — ${fmtEvery(SKILL_STEP_S)}`);
    lines.push(`Étape C : Every ${fmtEvery(sk.every_s)} × ${sk.rounds}`);
    lines.push(`${sk.reps} ${name}`);
    const subs = Object.entries(sk.substitutions).map(([c, s]) => `${CAT_LABEL[c] ?? c} : ${s}`);
    if (subs.length) lines.push(`→ ${subs.join(' · ')}`);
  }
  return lines;
}

function nameOfB(catalog: Catalog, opt: SessionBlockBOption): string {
  return opt.name ?? nameOf(catalog, opt.movement);
}

function blockBLines(catalog: Catalog, opt: SessionBlockBOption): string[] {
  const name = nameOfB(catalog, opt);
  const lines = [`Building — ${name} tempo ${opt.tempo ?? ''}`.trim()];
  for (const st of opt.steps) lines.push(stepLine(name, st, opt.tempo));
  return lines;
}

function finisherLines(catalog: Catalog, opt: SessionFinisherOption): string[] {
  const lines = [`Finisher — ${opt.rounds} rounds, rythme continu :`];
  for (const m of opt.movements) {
    const name = m.name ?? nameOf(catalog, m.id);
    lines.push(m.unit === 's' ? `${m.qty} s ${name}` : m.unit === 'm' ? `${m.qty} m ${name}` : `${m.qty} ${name}`);
  }
  return lines;
}

// ─── Volume gym ──────────────────────────────────────────────────────────────

/** Reps RX attendues par mouvement du bloc C (quantité × multiplicateur du format). */
export function blocCRepsRx(wod: GeneratedWod): Record<string, number> {
  const b = wod.blocks[0];
  const budgetS = wod.budget_min * 60;
  // Catégorie de référence de la discipline du WOD : 'rx' en Functional, 'men' en Hybrid.
  // Sans elle, un bloc C Hybrid au format continu cherche une cadence 'rx' qui n'existe pas.
  const ref = referenceCategory(wod);
  const out: Record<string, number> = {};
  for (const gm of b.movements) {
    let mult = 1;
    if (gm.round === undefined) {
      switch (b.format) {
        case 'rounds_for_time': case 'interval': case 'stations': case 'emom': mult = b.rounds ?? 1; break;
        case 'amrap': case 'continuous': mult = Math.ceil(budgetS / roundSeconds(b, ref)); break;
        case 'ladder': {
          const { step } = ladderProgress(b, ref, budgetS);
          const start = b.ladder?.start ?? gm.qty;
          const inc = b.ladder?.step ?? gm.qty;
          const n = inc > 0 ? Math.max(1, Math.floor((step - start) / inc) + 1) : 1;
          mult = n * (start + (n - 1) * inc / 2) / Math.max(1, gm.qty);
          break;
        }
        case 'death_by': {
          const n = deathByMinute(b, ref, wod.budget_min);
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

/** Répétitions sautées de la semaine (box jumps et variantes), blocs C compris. */
export function hybridJumpReps(sessions: GeneratedSession[]): number {
  let n = 0;
  for (const s of sessions) {
    if (!s.bloc_c) continue;
    const reps = blocCRepsRx(s.bloc_c);
    for (const id of HYBRID_JUMP_IDS) n += reps[id] ?? 0;
  }
  return n;
}

/** Une calorie d'erg vaut 10 m : conversion unique du moteur pour la règle §3.4. */
export const CAL_TO_M = 10;

/** Mètres de course et d'erg d'un bloc C. */
function blocCRunMeters(catalog: Catalog, wod: GeneratedWod): number {
  const reps = blocCRepsRx(wod);
  let total = 0;
  for (const gm of wod.blocks[0].movements) {
    const m = movementById(catalog, gm.id);
    if (!m || m.modality !== 'M') continue;
    const qty = reps[gm.id] ?? 0;
    if (gm.unit === 'cal') total += qty * CAL_TO_M;
    else if (gm.unit === 'm') total += qty;
  }
  return total;
}

/** Postes d'un bloc écrit (station, enchaînement, course compromise). */
export function itemsOf(opt: SessionBlockAOption): SessionStationItem[] {
  return [...(opt.station?.items ?? []), ...(opt.race?.stations ?? []), ...(opt.compromised?.stations ?? [])];
}

/** Mètres de course et d'erg d'un bloc A Hybrid (stations et enchaînement chronométré). */
function blockARunMeters(catalog: Catalog, opt: SessionBlockAOption): number {
  const ofItem = (it: SessionStationItem, times: number) => {
    const m = movementById(catalog, it.id);
    if (!m || m.modality !== 'M') return 0;
    return (it.unit === 'cal' ? it.qty * CAL_TO_M : it.unit === 'm' ? it.qty : 0) * times;
  };
  if (opt.station) {
    const { rounds, items } = opt.station;
    // postes en alternance : chacun revient un tour sur `items.length`
    return items.reduce((n, it) => n + ofItem(it, Math.ceil(rounds / items.length)), 0);
  }
  if (opt.race) {
    const { rounds, run_m, stations } = opt.race;
    const stationsM = Array.from({ length: rounds }, (_, i) => ofItem(stations[i % stations.length], 1)).reduce((a, b) => a + b, 0);
    return rounds * run_m + stationsM;
  }
  if (opt.compromised) {
    const { rounds, stations } = opt.compromised;
    const stationsM = Array.from({ length: rounds }, (_, i) => ofItem(stations[i % stations.length], 1)).reduce((a, b) => a + b, 0);
    return totalRunOf(opt) + stationsM;
  }
  return 0;
}

/** Mètres du bloc A `run` pour la semaine ISO donnée (variante en rotation). */
function runVariantMeters(opt: SessionBlockAOption, iso_week: number): number {
  if (!opt.run) return 0;
  return opt.run.variants[iso_week % opt.run.variants.length].meters;
}

/** Distance de course de la semaine, ergs compris (règle §3.4). */
export function hybridRunMeters(sessions: GeneratedSession[]): number {
  return sessions.reduce((n, s) => n + (s.run_meters ?? 0), 0);
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

/** Piste d'un squelette : les lignes d'avant la piste Hybrid n'ont pas le champ. */
export const trackOf = (sk: SessionSkeleton): SessionTrack => sk.track ?? 'functional';

/**
 * Squelette du jour pour une piste. Un squelette `weeks_modulo` remplace celui du même
 * jour les semaines visées (simulation complète du samedi, `iso_week % 8 === 0`) ; hors
 * de ces semaines il n'est jamais tiré.
 */
function skeletonForDay(bank: SkeletonBank, day: SessionDay, track: SessionTrack, iso_week: number): SessionSkeleton {
  const sameDay = bank.session_skeletons.filter((s) => s.day === day && trackOf(s) === track);
  const special = sameDay.find((s) => s.weeks_modulo && iso_week % s.weeks_modulo.modulo === s.weeks_modulo.equals);
  const sk = special ?? sameDay.find((s) => !s.weeks_modulo);
  if (!sk) throw new InvalidSessionParams('no_skeleton', `Aucun squelette de séance ${track} pour le jour ${day}`);
  return sk;
}

/** Charge d'un mouvement à une bande, hommes puis femmes ; `null` si le catalogue n'en a pas. */
function loadOf(catalog: Catalog, id: string, band?: Band): { men: number; women: number; unit: string } | null {
  if (!band) return null;
  const m = movementById(catalog, id);
  if (!m?.loads) return null;
  const men = loadsFor(m, 'men', band);
  const women = loadsFor(m, 'women', band);
  if (!men?.length || !women?.length) return null;
  return { men: men[0], women: women[0], unit: m.load_unit ?? 'kg' };
}

/**
 * Suffixe de charge d'un poste. Une hauteur de box (`cm`) n'est pas une charge : elle est
 * rendue entre parenthèses, et la charge vient alors du mouvement désigné par `load_from`.
 */
function loadPair(catalog: Catalog, it: SessionStationItem): string {
  const own = loadOf(catalog, it.id, it.band);
  const extra = it.load_from ? loadOf(catalog, it.load_from, it.band) : null;
  const parts: string[] = [];
  if (own && own.unit === 'cm') parts.push(`(box ${own.men}/${own.women} cm)`);
  else if (own) parts.push(`@ ${own.men}/${own.women} ${own.unit}`);
  if (extra) parts.push(`@ ${extra.men}/${extra.women} ${extra.unit}`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}

/** « 25 m Sled Push @ 125/100 kg », « 60 s Row », « 10 Box Step-ups (box 60/50 cm) @ 24/16 kg ». */
function stationLine(catalog: Catalog, it: SessionStationItem): string {
  const name = it.name ?? nameOf(catalog, it.id);
  const qty = it.unit === 'reps' ? `${it.qty}` : `${it.qty} ${it.unit}`;
  return `${qty} ${name}${loadPair(catalog, it)}`;
}

/** Ligne Pro d'un poste chargé, quand le catalogue connaît les charges Pro. */
function proLine(catalog: Catalog, items: readonly SessionStationItem[]): string | null {
  const parts: string[] = [];
  for (const it of items) {
    if (!it.band) continue;
    const m = movementById(catalog, it.id);
    if (!m?.loads) continue;
    if ((m.load_unit ?? 'kg') === 'cm') continue;
    const men = loadsFor(m, 'men_pro', it.band);
    const women = loadsFor(m, 'women_pro', it.band);
    if (!men?.length || !women?.length) continue;
    parts.push(`${it.name ?? nameOf(catalog, it.id)} ${men[0]}/${women[0]} ${m.load_unit ?? 'kg'}`);
  }
  return parts.length ? `Women Pro / Men Pro : ${parts.join(' · ')}` : null;
}

/**
 * Enchaînement chronométré non figé : ordre des postes et nombre de tours tirés à la graine.
 * Un `race.ordered` (test de bloc) est rendu tel quel, pour rester comparable d'une fois sur l'autre.
 */
export function drawRace(opt: SessionBlockAOption, rng: RNG): SessionBlockAOption {
  const shuffle = <T>(xs: readonly T[]): T[] => {
    const pool = [...xs];
    const out: T[] = [];
    while (pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    return out;
  };
  if (opt.compromised) {
    const c = opt.compromised;
    const runs = Array.from({ length: c.rounds }, () => rng.int(c.run_m_min / 100, c.run_m_max / 100) * 100);
    // le vendredi est la séance de course compromise : il garantit sa distance, en
    // remontant d'abord les courses les plus courtes jusqu'au maximum du squelette
    let total = runs.reduce((a, b) => a + b, 0);
    while (total < HYBRID_FRIDAY_RUN_M) {
      const i = runs.indexOf(Math.min(...runs));
      if (runs[i] >= c.run_m_max) break;
      runs[i] += 100;
      total += 100;
    }
    return { ...opt, compromised: { ...c, stations: shuffle(c.stations), runs } };
  }
  const race = opt.race;
  if (!race || race.ordered) return opt;
  const rounds = rng.int(race.rounds_min ?? race.rounds, race.rounds_max ?? race.rounds);
  return { ...opt, race: { ...race, rounds, stations: shuffle(race.stations) } };
}

/** Distance de course d'un round du bloc compromise (tirée, ou moyenne à défaut). */
function runOfRound(opt: SessionBlockAOption, i: number): number {
  const c = opt.compromised;
  if (!c) return 0;
  return c.runs?.[i] ?? Math.round((c.run_m_min + c.run_m_max) / 200) * 100;
}

/** Total de course du bloc compromise. */
function totalRunOf(opt: SessionBlockAOption): number {
  const c = opt.compromised;
  if (!c) return 0;
  return Array.from({ length: c.rounds }, (_, i) => runOfRound(opt, i)).reduce((a, b) => a + b, 0);
}

/** Bloc A des séances Hybrid : station `Every X'`, intervalles de course, ou enchaînement chronométré. */
function hybridALines(catalog: Catalog, opt: SessionBlockAOption, iso_week: number): string[] {
  const lines: string[] = [];
  if (opt.kind === 'station' && opt.station) {
    const { every_s, rounds, items } = opt.station;
    lines.push(items.length > 1
      ? `Every ${fmtEvery(every_s)} × ${rounds}, en rotation :`
      : `Every ${fmtEvery(every_s)} × ${rounds} :`);
    for (const [i, it] of items.entries()) {
      // deux postes s'alternent (impair / pair), au-delà ils tournent et se numérotent
      const tag = items.length === 2 ? `${i === 0 ? 'Impair' : 'Pair'} · ` : items.length > 2 ? `Poste ${i + 1} · ` : '';
      lines.push(`${tag}${stationLine(catalog, it)}`);
    }
    const pro = proLine(catalog, items);
    if (pro) lines.push(pro);
    if (items.some((it) => it.band === 'heavy')) {
      lines.push('Seule charge lourde de la semaine. Poussée continue, jamais en saccades.');
    }
  } else if (opt.kind === 'run' && opt.run) {
    const v = opt.run.variants[iso_week % opt.run.variants.length];
    lines.push(`Intervalles course — ${v.label}, repos ${fmtRest(v.rest_s)}`);
    lines.push(`Allure cible : ${v.target}. L'écart entre le premier et le dernier intervalle reste sous 5 s.`);
    lines.push(`Autres variantes du cycle : ${opt.run.variants.filter((x) => x !== v).map((x) => x.label).join(' · ')}`);
  } else if (opt.kind === 'compromised' && opt.compromised) {
    const { rounds, work_s, run_m_min, run_m_max, stations, target } = opt.compromised;
    lines.push(`${rounds} rounds :`);
    for (let i = 0; i < rounds; i++) {
      const st = stations[i % stations.length];
      const run = runOfRound(opt, i);
      lines.push(`${i + 1}. ${work_s} s de station — ${stationLine(catalog, st)}`);
      lines.push(`   puis ${run} m Run à allure cible (${target})`);
    }
    const used = Array.from({ length: rounds }, (_, i) => stations[i % stations.length]);
    const pro = proLine(catalog, used);
    if (pro) lines.push(pro);
    lines.push(`Total de course : ${totalRunOf(opt)} m. Tenir l'allure avec les jambes chargées, ne pas sprinter la station.`);
  } else if (opt.kind === 'race' && opt.race) {
    const { rounds, run_m, stations, score } = opt.race;
    lines.push(`Enchaînement chronométré — ${rounds} tours, dans l'ordre :`);
    for (let i = 0; i < rounds; i++) {
      const st = stations[i % stations.length];
      lines.push(`${i + 1}. ${run_m} m Run puis ${stationLine(catalog, st)}`);
    }
    const pro = proLine(catalog, Array.from({ length: rounds }, (_, i) => stations[i % stations.length]));
    if (pro) lines.push(pro);
    lines.push(`Score : ${score}. Note le temps de chaque segment.`);
  }
  return lines;
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
  const track: SessionTrack = params.track ?? 'functional';
  const sk = skeletonForDay(bank, params.day, track, params.iso_week);
  const rng = new RNG(seed);
  const weeks: 'even' | 'odd' = params.iso_week % 2 === 0 ? 'even' : 'odd';
  const relax = new Set<string>();

  // Bloc A
  let optA: SessionBlockAOption | null = null;
  if (sk.block_a) {
    const eligible = sk.block_a.filter((o) => !o.weeks || o.weeks === weeks);
    optA = withSkillProgression(rng.pick(eligible.length ? eligible : sk.block_a));
    optA = drawRace(optA, rng);
  }
  // Bloc de travail écrit (mardi, vendredi, samedi) : postes tirés, devient le bloc `wod`.
  const optW: SessionBlockAOption | null = sk.block_work?.length ? drawRace(rng.pick(sk.block_work), rng) : null;
  const cool = sk.cooldown?.length ? rng.pick(sk.cooldown) : null;
  const movA = optA ? movementById(catalog, optA.movement) : undefined;
  // Les blocs Hybrid (station, course, enchaînement) n'imposent pas de pattern lourd au bloc C :
  // leurs charges restent en bande légère ou moyenne, sauf le sled du vendredi.
  const heavy = optA && (optA.kind === 'weightlifting' || optA.kind === 'strength') ? heavyPatternOf(movA) : null;
  const { c: recentC, finishers: journalFinishers } = splitSignatures(params.recent_signatures ?? []);

  // Bloc B : exercice ≠ A (et hors complexe), pattern ≠ pattern lourd de A, jamais deux fois le même B dans la semaine
  let optB: SessionBlockBOption | null = null;
  if (sk.block_b) {
    const aIds = new Set([optA?.movement, ...(optA?.complex ?? [])].filter((x): x is string => !!x));
    const sameAsA = (id: string) => aIds.has(id) || aIds.has(id.replace(/^strict_/, ''));
    const base = sk.block_b.filter((o) => !sameAsA(o.movement) && (!heavy || o.pattern !== heavy));
    const weekB = new Set(params.week_b_movements ?? []);
    const fresh = base.filter((o) => !weekB.has(o.movement));
    if (fresh.length) optB = rng.pick(fresh);
    else if (base.length) { optB = rng.pick(base); relax.add('b_repeat_week'); }
    else { optB = null; relax.add('b_none'); }
  }

  // Finisher : jamais deux fois le même dans la semaine ni sur les 4 dernières semaines (journal)
  let optF: SessionFinisherOption | null = null;
  if (sk.finisher) {
    const used = new Set([...journalFinishers, ...(params.recent_finishers ?? [])]);
    const fresh = sk.finisher.filter((o) => !used.has(o.id));
    if (fresh.length) optF = rng.pick(fresh);
    else { optF = rng.pick(sk.finisher); relax.add('finisher_repeat'); }
  }

  // Bloc C : durée choisie pour tenir 60' avec / sans B et finisher
  const cFilter = sk.block_c;
  const fixed = sk.warmup.minutes + (optA?.minutes ?? 0) + (optW?.minutes ?? 0) + (cool?.minutes ?? 0);
  const lo = sk.budget_min * (1 - SESSION_TOLERANCE);
  const hi = sk.budget_min * (1 + SESSION_TOLERANCE);
  const combos: Array<{ c: number; b: boolean; f: boolean }> = [];
  for (const c of cFilter ? cFilter.durations : [0]) for (const b of [true, false]) for (const f of [true, false]) {
    if (b && !optB) continue;
    if (f && !optF) continue;
    combos.push({ c, b, f });
  }
  const totalOf = (x: { c: number; b: boolean; f: boolean }) => {
    const blocks = (cFilter ? 1 : 0) + (optA ? 1 : 0) + (optW ? 1 : 0) + (cool ? 1 : 0) + (x.b ? 1 : 0) + (x.f ? 1 : 0);
    return fixed + x.c + (x.b ? optB!.minutes : 0) + (x.f ? optF!.minutes : 0) + TRANSITION_MIN * blocks;
  };
  const fitting = combos.filter((x) => totalOf(x) >= lo && totalOf(x) <= hi);
  const pool = fitting.length ? fitting : combos.sort((a, b) => Math.abs(totalOf(a) - sk.budget_min) - Math.abs(totalOf(b) - sk.budget_min)).slice(0, 1);
  if (!fitting.length) relax.add('session_budget');
  // préférer la séance la plus complète (B puis finisher), tirage parmi les ex æquo
  const rank = (x: { b: boolean; f: boolean }) => (x.b ? 2 : 0) + (x.f ? 1 : 0);
  const bestRank = Math.max(...pool.map(rank));
  let choice = rng.pick(pool.filter((x) => rank(x) === bestRank));

  const patternNot: Pattern[] = cFilter ? [
    ...(cFilter.pattern_not === 'heavy_pattern' ? (heavy ? [heavy] : []) : cFilter.pattern_not),
    ...(params.pattern_not ?? []),
  ] : [];
  const intention: Intention = cFilter ? rng.pick(cFilter.intentions) : 'mixed';
  const format = cFilter?.formats ? rng.pick(cFilter.formats) : undefined;
  const cSeed = (seed + 104729 * params.day) >>> 0;
  // Piste Hybrid : haltéro technique et gymnique avancé jamais tirés (règles §3.1 et §3.2),
  // et les postes du bloc A ne reviennent pas dans le bloc de travail du même jour.
  const aIdsHybrid = track === 'hybrid' && optA
    ? [...(optA.station?.items ?? []), ...(optA.race?.stations ?? [])].map((it) => it.id)
    : [];
  const exclude = [
    ...(cFilter?.exclude ?? []), ...(params.exclude ?? []),
    ...(track === 'hybrid' ? [...HYBRID_FORBIDDEN_IDS, ...aIdsHybrid] : []),
  ];
  const neighbours = [params.previous_c_skeleton, params.next_c_skeleton].filter((s): s is string => !!s);
  // Liste blanche du squelette : tout le reste de la banque de la discipline part en `skeleton_not`.
  const cDiscipline = track === 'hybrid' ? 'hybrid' : 'functional';
  const outside = cFilter?.skeletons
    ? bank.skeletons.filter((s) => s.discipline === cDiscipline && !cFilter.skeletons!.includes(s.id)).map((s) => s.id)
    : [];
  const notList = [...new Set([...neighbours, ...outside])];
  const skeletonNot = notList.length ? notList : undefined;
  // Cascade quand le Functional n'a aucun WOD valide, l'intention d'abord
  // préservée : nouveau tirage (autre graine) puis format libre, autre durée du
  // squelette (avec puis sans format), autre intention du squelette, et en tout
  // dernier le pattern lourd toléré. Chaque étape est tracée dans `relaxations`.
  const attempts: Array<{ tag: string | null; c: number; intention: Intention; format?: FormatChoice; patternNot: Pattern[]; noRecent?: boolean }> = [
    { tag: null, c: choice.c, intention, format, patternNot },
  ];
  attempts.push({ tag: 'c_fallback:reseed', c: choice.c, intention, format, patternNot });
  if (format) attempts.push({ tag: 'c_fallback:format', c: choice.c, intention, format: undefined, patternNot });
  for (const c of cFilter?.durations ?? []) if (c !== choice.c) attempts.push({ tag: 'c_fallback:duration', c, intention, format, patternNot });
  if (format) for (const c of cFilter?.durations ?? []) if (c !== choice.c) attempts.push({ tag: 'c_fallback:duration', c, intention, format: undefined, patternNot });
  for (const i of cFilter?.intentions ?? []) if (i !== intention) attempts.push({ tag: 'c_fallback:intention', c: choice.c, intention: i, format: undefined, patternNot });
  if (patternNot.length) attempts.push({ tag: 'c_fallback:pattern', c: choice.c, intention, format: undefined, patternNot: [] });
  // Dernier recours : une liste blanche étroite (piste Hybrid) finit par épuiser les
  // signatures inédites sur 4 semaines. Mieux vaut répéter une séance et le dire.
  for (const i of cFilter?.intentions ?? []) {
    attempts.push({ tag: 'c_fallback:signature', c: choice.c, intention: i, format: undefined, patternNot: [], noRecent: true });
  }
  let blocC: GeneratedWod | null = null;
  let lastErr: unknown = null;
  let fallbackC: { wod: GeneratedWod; tag: string | null; c: number } | null = null;
  for (const [idx, a] of cFilter ? attempts.entries() : []) {
    try {
      const candidate = generateBlocC({
        entry: 'express',
        discipline: cDiscipline,
        budget_min: a.c,
        intention: a.intention,
        format: a.format,
        exclude,
        recent_signatures: a.noRecent ? [] : recentC,
        pattern_not: a.patternNot.length ? a.patternNot : undefined,
        skeleton_not: skeletonNot,
        round_qty: true,
      }, catalog, bank, idx === 0 ? cSeed : hashSeed(cSeed, a.tag ?? '', idx));
      // Plafond d'effort du jour (mardi 7,5 ; jeudi 6,5) : on continue la cascade tant
      // qu'un bloc plus dur sort, et on garde le premier trouvé en secours.
      if (sk.max_rpe !== undefined && candidate.stimulus.rpe > sk.max_rpe) {
        fallbackC = fallbackC ?? { wod: candidate, tag: a.tag, c: a.c };
        continue;
      }
      blocC = candidate;
      if (a.tag) relax.add(a.tag);
      if (a.c !== choice.c) choice = { ...choice, c: a.c };
      break;
    } catch (e) {
      if (!(e instanceof NoValidWod)) throw e;
      lastErr = e;
    }
  }
  if (cFilter && !blocC && fallbackC) {
    blocC = fallbackC.wod;
    if (fallbackC.tag) relax.add(fallbackC.tag);
    if (fallbackC.c !== choice.c) choice = { ...choice, c: fallbackC.c };
    relax.add('rpe_over_cap');
  }
  if (cFilter && !blocC) throw lastErr;
  if (blocC) for (const r of blocC.generator.relaxations) relax.add(`c:${r}`);

  // Assemblage des lignes box_wods
  const blocks: SessionBlock[] = [];
  const gym: Record<string, number> = {};
  const warm = [...sk.warmup.lines, ''];
  let sort = 0;
  if (optA) {
    const isHybridA = optA.kind === 'station' || optA.kind === 'run' || optA.kind === 'race';
    const lines = isHybridA ? hybridALines(catalog, optA, params.iso_week) : blockALines(catalog, optA, weeks);
    const aReps: Record<string, number> = {};
    if (optA.skill) aReps[optA.movement] = optA.skill.reps * optA.skill.rounds;
    addReps(gym, gymReps(catalog, aReps));
    const KIND_LABEL: Record<SessionBlockAOption['kind'], string> = {
      weightlifting: 'Haltéro', strength: 'Force', skill: 'Skill',
      station: 'Force sur station', run: 'Course', race: 'Simulation', compromised: 'Course compromise',
    };
    const title = optA.kind === 'race' ? sk.label : `${KIND_LABEL[optA.kind]} · ${nameOf(catalog, optA.movement)}`;
    // Une séance chronométrée (H6) n'a pas de bloc C : c'est son bloc A qui porte le classement.
    const a = editor(
      title,
      [...warm, ...lines].join('\n'),
      optA.kind === 'skill' || isHybridA ? 'custom' : 'strength',
      optA.timed ? 'wod' : optA.kind === 'skill' ? 'skill' : 'strength',
      sort++, sk.warmup.minutes + optA.minutes,
      structured(optA.kind, optA.id, {
        movement: optA.movement, heavy_pattern: heavy, steps: optA.steps ?? null, complex: optA.complex ?? null,
        skill: optA.skill ?? null, gym_reps_rx: gymReps(catalog, aReps),
      }),
      optA.kind === 'weightlifting' ? 'Pourcentages du 1RM du mouvement complet ; sans 1RM, charge propre.'
        : optA.timed ? 'Séance chronométrée de bout en bout : compare avec ta dernière simulation.' : null,
    );
    if (optA.timed) a.leaderboard_enabled = true;
    blocks.push(a);
  }
  if (choice.b && optB) {
    const bReps: Record<string, number> = {};
    for (const st of optB.steps) bReps[optB.movement] = (bReps[optB.movement] ?? 0) + st.sets * st.reps;
    addReps(gym, gymReps(catalog, bReps));
    blocks.push(editor(
      `Building · ${nameOfB(catalog, optB)}`,
      blockBLines(catalog, optB).join('\n'),
      'strength', 'building', sort++, optB.minutes,
      structured('building', optB.id, { movement: optB.movement, steps: optB.steps, gym_reps_rx: gymReps(catalog, bReps) }),
      null,
    ));
  }
  if (optW) {
    const wLines = hybridALines(catalog, optW, params.iso_week);
    const w = editor(
      optW.kind === 'race' ? sk.label : `${sk.label} · ${nameOf(catalog, optW.movement)}`,
      [...(optA ? [] : warm), ...wLines].join(NL),
      'custom', 'wod', sort++, optW.minutes + (optA ? 0 : sk.warmup.minutes),
      structured(optW.kind, optW.id, { movement: optW.movement, gym_reps_rx: {} }),
      optW.timed ? 'Séance chronométrée de bout en bout : compare avec ta dernière simulation.' : null,
    );
    w.leaderboard_enabled = true;
    blocks.push(w);
  }
  if (blocC) {
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
  }
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

  if (cool) {
    blocks.push(editor(
      'Retour au calme', cool.lines.join(NL), 'custom', 'cooldown', sort++, cool.minutes,
      structured('cooldown', `cooldown_${cool.minutes}`, {}), null,
    ));
  }

  // Effort de la journée : le maximum des blocs, pas celui du seul bloc tiré. Un mercredi
  // à 8 × 400 m n'est pas un jour facile parce que son bloc de tronc est à RPE 6.
  const rpe = Math.max(optA?.rpe ?? 0, optW?.rpe ?? 0, blocC?.stimulus.rpe ?? 0);

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
    // Sans bloc C (séance chronométrée), la signature vient du squelette et de son bloc A :
    // l'anti-répétition sur 4 semaines reste calculable.
    signature: blocC ? blocC.signature
      : `session|${sk.id}|${optA?.id ?? '-'}|${optA?.race ? `${optA.race.rounds}x${optA.race.run_m}:${optA.race.stations.map((x) => x.id).join(',')}` : '-'}`,
    block_b_movement: choice.b && optB ? optB.movement : null,
    finisher_id: choice.f && optF ? optF.id : null,
    rpe,
    movements_by_role: {
      a: optA ? itemsOf(optA).map((it) => it.id) : [],
      work: [
        ...(optW ? itemsOf(optW).map((it) => it.id) : []),
        ...(blocC ? blocC.blocks[0].movements.map((m) => m.id) : []),
      ],
    },
    run_meters: (optA ? blockARunMeters(catalog, optA) + runVariantMeters(optA, params.iso_week) : 0)
      + (optW ? blockARunMeters(catalog, optW) : 0)
      + (blocC ? blocCRunMeters(catalog, blocC) : 0),
  };
}

/**
 * Semaine Functional / Hybrid : 6 séances lundi → samedi, graine dérivée par jour,
 * squelette C ≠ veille, signatures C jamais répétées (journal + semaine courante),
 * plafonds gym hebdo : samedi puis mercredi (brief §5.5) retirés au bloc C gym (pull_v / push_v)
 * si dépassement, puis vendredi, jeudi, lundi, mardi tant que le plafond tient encore — chaque
 * jour retiré est tracé `weekly_gym_cap:<jour>`.
 */
export function generateWeek(params: WeekParams, catalog: Catalog, bank: SkeletonBank, seed: number): GeneratedWeek {
  const relax = new Set<string>();
  const track: SessionTrack = params.track ?? 'functional';
  const recent = [...(params.recent_signatures ?? [])];
  const sessions: GeneratedSession[] = [];
  /**
   * Règle Hybrid §3.6, assouplie : un mouvement fonctionnel peut revenir une seconde fois
   * dans la semaine s'il n'est pas sur deux jours consécutifs et s'il change de rôle
   * (bloc A puis bloc de travail). Au-delà, il est écarté du tirage — et si le moteur n'y
   * arrive pas, le relâchement le dit. Les monostructuraux (course, ergs) sont hors règle :
   * ils sont la trame de la piste et reviennent tous les jours.
   *
   * Les blocs écrits du mardi, du vendredi et du samedi rétrécissent mécaniquement le pool ;
   * interdire toute seconde occurrence revenait à relâcher la règle presque chaque semaine.
   */
  const functionalOnly = (ids: string[]) => ids.filter((id) => movementById(catalog, id)?.modality !== 'M');
  /**
   * Postes des blocs écrits d'un jour, connus avant tout tirage. Sans eux, le lundi
   * ignorerait ce que le mardi et le samedi vont poser — leurs blocs sont pourtant fixés
   * par le squelette, et c'est là que naissaient les répétitions sur trois jours.
   */
  const writtenOf = (d: SessionDay): string[] => {
    const sk = bank.session_skeletons.find((x) => x.day === d && trackOf(x) === track
      && (x.weeks_modulo ? params.iso_week % x.weeks_modulo.modulo === x.weeks_modulo.equals : true));
    if (!sk) return [];
    return functionalOnly([...(sk.block_a ?? []), ...(sk.block_work ?? [])].flatMap((o) => itemsOf(o).map((it) => it.id)));
  };
  const alreadyUsed = (day: SessionDay) => {
    if (track !== 'hybrid') return [];
    const days = new Map<string, Set<number>>();
    const neighbour = new Set<string>();
    const note = (d: SessionDay, ids: string[]) => {
      for (const id of ids) days.set(id, (days.get(id) ?? new Set()).add(d));
      if (Math.abs(d - day) === 1) for (const id of ids) neighbour.add(id);
    };
    // seulement les jours voisins : c'est là que la répétition se voit. Pré-charger les six
    // jours assécherait le vocabulaire Hybrid, déjà étroit, et ferait relâcher la règle.
    for (const d of [day - 1, day + 1] as SessionDay[]) if (d >= 1 && d <= 6) note(d, writtenOf(d));
    for (const s of sessions) {
      if (s.day === day) continue;
      const roles = s.movements_by_role ?? { a: [], work: [] };
      note(s.day, functionalOnly([...roles.a, ...roles.work]));
    }
    const out = new Set<string>(neighbour);
    // une troisième occurrence est de trop ; la deuxième passe si elle n'est pas voisine
    for (const [id, ds] of days) if (ds.size >= 2) out.add(id);
    return [...out];
  };
  const once = (day: SessionDay, salt: number, patternNot?: Pattern[], extraExclude: string[] = [], unique = true) => generateSession({
    track,
    day, iso_year: params.iso_year, iso_week: params.iso_week,
    recent_signatures: [...recent, ...sessions.filter((s) => s.day !== day).map((s) => s.signature)],
    week_b_movements: sessions.filter((s) => s.day !== day).flatMap((s) => (s.block_b_movement ? [s.block_b_movement] : [])),
    recent_finishers: sessions.filter((s) => s.day !== day).flatMap((s) => (s.finisher_id ? [s.finisher_id] : [])),
    previous_c_skeleton: sessions.find((s) => s.day === day - 1)?.bloc_c?.generator.skeleton_id ?? null,
    next_c_skeleton: sessions.find((s) => s.day === day + 1)?.bloc_c?.generator.skeleton_id ?? null,
    pattern_not: patternNot,
    exclude: [...(params.exclude ?? []), ...(unique ? alreadyUsed(day) : []), ...extraExclude],
  }, catalog, bank, (seed + day * 7919 + salt * 104729) >>> 0);
  /** Unicité des mouvements fonctionnels : préférence, pas contrainte dure — le repli est tracé. */
  const onceRelaxed = (day: SessionDay, salt: number, patternNot?: Pattern[], extraExclude: string[] = []) => {
    try {
      return once(day, salt, patternNot, extraExclude);
    } catch (e) {
      if (!(e instanceof NoValidWod)) throw e;
      relax.add(`movement_repeat_week:${day}`);
      return once(day, salt, patternNot, extraExclude, false);
    }
  };
  const repeatsB = (s: GeneratedSession) => s.generator.relaxations.includes('b_repeat_week');
  // bloc B unique dans la semaine : si le jour n'a plus d'option fraîche, on retire un jour
  // précédent (graine salée, de la veille au lundi) puis les jours suivants, jusqu'à B_RETRY_MAX
  // graines par jour ; à défaut le relâchement `b_repeat_week` reste tracé
  const gen = (day: SessionDay, patternNot?: Pattern[]) => onceRelaxed(day, 0, patternNot);
  for (const day of [1, 2, 3, 4, 5, 6] as SessionDay[]) {
    sessions.push(gen(day));
    if (!repeatsB(sessions[sessions.length - 1])) continue;
    const saved = [...sessions];
    let solved = false;
    for (let back = 1; back < day && !solved; back++) {
      for (let salt = 1; salt <= B_RETRY_MAX && !solved; salt++) {
        sessions.splice(day - 1 - back);
        sessions.push(onceRelaxed((day - back) as SessionDay, salt));
        for (let d = day - back + 1; d <= day; d++) sessions.push(onceRelaxed(d as SessionDay, 0));
        solved = sessions.slice(day - 1 - back).every((s) => !repeatsB(s));
      }
    }
    if (!solved) sessions.splice(0, sessions.length, ...saved);
  }

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

  if (track === 'hybrid') {
    // §3.7 : plafond de sauts sur la semaine. Au-delà, le jour le plus chargé est
    // régénéré sans mouvement sauté — le moteur tire alors le step-up.
    for (let pass = 0; pass < 3 && hybridJumpReps(sessions) > HYBRID_WEEKLY_JUMP_CAP; pass++) {
      const worst = [...sessions].sort((a, b) => hybridJumpReps([b]) - hybridJumpReps([a]))[0];
      if (!worst || hybridJumpReps([worst]) === 0) break;
      const i = sessions.findIndex((s) => s.day === worst.day);
      sessions[i] = onceRelaxed(worst.day, 0, undefined, [...HYBRID_JUMP_IDS]);
      relax.add(`weekly_jump_cap:${worst.day}`);
    }
    if (hybridJumpReps(sessions) > HYBRID_WEEKLY_JUMP_CAP) relax.add('weekly_jump_cap_exceeded');

    // §3.5 : jamais deux jours durs de suite, sur l'effort de la JOURNÉE (max des blocs).
    // Le second jour est retiré à graine salée ; au bout de HARD_RETRY tentatives on garde
    // le meilleur RPE obtenu et on le trace. Un jour dont le bloc de travail est écrit
    // (vendredi, samedi) ne peut pas s'adoucir : sa dureté est sa raison d'être.
    const rpeOf = (s: GeneratedSession) => s.rpe;
    const HARD_RETRY = 8;
    for (let i = 1; i < sessions.length; i++) {
      if (rpeOf(sessions[i]) < HYBRID_HARD_RPE || rpeOf(sessions[i - 1]) < HYBRID_HARD_RPE) continue;
      let best = sessions[i];
      for (let salt = 1; salt <= HARD_RETRY; salt++) {
        const candidate = onceRelaxed(sessions[i].day, salt);
        if (rpeOf(candidate) < rpeOf(best)) best = candidate;
        if (rpeOf(candidate) < HYBRID_HARD_RPE) break;
      }
      sessions[i] = best;
      if (rpeOf(best) >= HYBRID_HARD_RPE) relax.add(`hard_days_in_a_row:${best.day}`);
      else relax.add(`hard_day_softened:${best.day}`);
    }
    // §3.6 : constat final. Le tirage évite les jours voisins et la troisième occurrence,
    // mais les blocs écrits du mardi, du vendredi et du samedi sont fixes : quand un
    // mouvement les traverse quand même, on le nomme au lieu de le taire.
    const SLED_OK = new Set(['sled_push', 'sled_pull']);
    const byMovement = new Map<string, Set<number>>();
    for (const s of sessions) {
      const roles = s.movements_by_role ?? { a: [], work: [] };
      for (const id of functionalOnly([...roles.a, ...roles.work])) {
        byMovement.set(id, (byMovement.get(id) ?? new Set()).add(s.day));
      }
    }
    for (const [id, ds] of byMovement) {
      const days = [...ds].sort((a, b) => a - b);
      if (days.length < 2) continue;
      const adjacent = days.some((d, i) => i > 0 && d - days[i - 1] === 1);
      // le traîneau est l'objet du vendredi lourd et de la simulation du samedi
      if (SLED_OK.has(id) && days.every((d) => d === 5 || d === 6)) continue;
      if (days.length > 2 || adjacent) relax.add(`movement_repeat_week:${id}`);
    }
    // §3.4 : constaté et tracé, jamais corrigé en silence.
    if (hybridRunMeters(sessions) < HYBRID_WEEKLY_RUN_M) relax.add('weekly_run_short');
  }

  return {
    track, iso_year: params.iso_year, iso_week: params.iso_week, seed, sessions, gym_volume, relaxations: [...relax].sort(),
    signatures: [...sessions.map((s) => s.signature), ...sessions.flatMap((s) => (s.finisher_id ? [finisherSignature(s.finisher_id)] : []))],
  };
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
  // plafond hebdo en amont : les cibles les plus étroites (fessiers-ischios, tronc) se composent d'abord, les cibles
  // larges (jambes, push, pull) se composent ensuite avec la place restante par muscle — jamais raccourcies après coup
  const order = [...MUSCU_WEEK_DAYS].sort((a, b) => TARGET_MUSCLES[a.target].length - TARGET_MUSCLES[b.target].length || a.day - b.day);
  for (const d of order) {
    // M8 : pas d'objectif Force en Tronc → le samedi tronc d'une semaine Force passe en Prise de muscle
    const dayObjective = d.target === 'tronc' && objective === 'force' ? 'hypertrophie' : objective;
    const weekly_room: Partial<Record<Muscle, number>> = {};
    for (const [mu, n] of setsByMuscle(days)) weekly_room[mu] = Math.max(0, MUSCU_WEEKLY_CAP_SETS - n);
    // A2 : ce que la semaine a déjà posé, avec le jour et le rôle de chaque
    // exercice. Les jours sont composés du plus étroit au plus large, donc
    // `days` ne contient pas les jours dans l'ordre du calendrier — c'est bien
    // `d.day` qui porte la position dans la semaine, pas l'ordre de composition.
    const week_seen: WeekSeen[] = days.flatMap((x) => x.wod.blocks[0].exercises.map((e) => ({
      id: e.id, group: e.movement_group, day: x.day, role: e.role,
    })));
    const wod = generateMuscu({
      entry: 'express', target: d.target, objective: dayObjective, budget_min: d.budget_min, equipment, level,
      exclude: params.exclude, recent_signatures: [...recent, ...days.map((x) => x.wod.signature)], box_wod: true, weekly_room,
      week_seen, week_day: d.day,
    }, catalog, bank, (seed + d.day * 7919) >>> 0);
    for (const r of wod.generator.relaxations) relax.add(`${d.target}:${r}`);
    days.push({ day: d.day, target: d.target, budget_min: d.budget_min, wod });
  }
  days.sort((a, b) => a.day - b.day);

  // garde-fou : si le plafond est malgré tout dépassé, retirer une série à la fois, du dernier jour vers le premier
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
