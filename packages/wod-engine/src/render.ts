import type { Category, GeneratedBlock, GeneratedMovement, GeneratedWod, SkeletonFormat, WodType } from './types';
import { FUNCTIONAL_CATEGORIES, HYBRID_CATEGORIES } from './types';
import { fr } from './i18n/fr';

const T = fr.rendu;

/**
 * Rendu texte compatible avec la grammaire lue par `movementParser` côté app :
 *  - lignes de mouvement quantité d'abord (`45 Thrusters (43/30 kg)`, `20 cal Row`, `500 m Run`) ;
 *  - en-têtes ignorés par le parseur (`AMRAP 12`, `5 rounds for time`, `For time · 21-15-9`, `EMOM 15`…) ;
 *  - lignes d'information (charges par catégorie, substitutions, stimulus) commençant par une lettre.
 * Les lignes `R1 · …` (station différente par round), `Station n · …` et `Tabata n · …`
 * ne sont volontairement pas créditées : leur quantité réalisée dépend du score.
 */

export const CATEGORY_LABEL: Record<Category, string> = fr.categories;

const WOD_TYPE: Record<SkeletonFormat, WodType> = {
  amrap: 'amrap', for_time: 'for-time', rounds_for_time: 'for-time', chipper: 'for-time', interval: 'for-time',
  ladder: 'amrap', continuous: 'amrap', stations: 'custom', emom: 'emom', death_by: 'emom', tabata: 'tabata',
};

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function mmss(s: number): string {
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return sec ? `${m}:${sec.toString().padStart(2, '0')}` : fr.duree.minutes(m);
}

/** `43/30 kg` (Functional H/F) ou `100/75 kg` (Hybrid Men/Women). */
function loadText(m: GeneratedMovement, discipline: GeneratedWod['discipline']): string | null {
  if (!m.load_unit) return null;
  const pair = discipline === 'functional'
    ? m.loads_by_category.rx
    : [m.loads_by_category.men?.[0], m.loads_by_category.women?.[0]];
  if (!pair || pair.some((v) => v === undefined || v === null)) return null;
  const vals = pair as number[];
  return `${vals.map(fmtNum).join('/')} ${m.load_unit}`;
}

function qtyText(m: GeneratedMovement): string {
  if (m.unit === 'reps') return `${m.qty}`;
  return `${m.qty} ${m.unit}`;
}

export function movementLine(m: GeneratedMovement, wod: Pick<GeneratedWod, 'discipline'>): string {
  const load = loadText(m, wod.discipline);
  const base = `${qtyText(m)} ${m.name}`;
  return load ? `${base} (${load})` : base;
}

/** Ligne des charges des autres catégories (omise si identiques à la référence). */
function loadsByCategoryLine(m: GeneratedMovement, wod: Pick<GeneratedWod, 'discipline'>): string | null {
  if (!m.load_unit) return null;
  const cats = wod.discipline === 'functional' ? FUNCTIONAL_CATEGORIES : HYBRID_CATEGORIES;
  const ref = wod.discipline === 'functional' ? 'rx' : 'men';
  const refVal = JSON.stringify(m.loads_by_category[ref]);
  const parts: string[] = [];
  if (wod.discipline === 'functional') {
    let differs = false;
    for (const c of cats) {
      if (c === ref) continue;
      const v = m.loads_by_category[c];
      if (!v) continue;
      if (JSON.stringify(v) !== refVal) differs = true;
      parts.push(`${CATEGORY_LABEL[c]} ${v.map(fmtNum).join('/')}`);
    }
    if (!differs) return null;
  } else {
    const pro = [m.loads_by_category.men_pro?.[0], m.loads_by_category.women_pro?.[0]];
    const std = [m.loads_by_category.men?.[0], m.loads_by_category.women?.[0]];
    if (JSON.stringify(pro) === JSON.stringify(std) || pro.some((v) => v == null)) return null;
    parts.push(`${CATEGORY_LABEL.pro} ${(pro as number[]).map(fmtNum).join('/')}`);
  }
  return parts.length ? `${parts.join(' · ')} ${m.load_unit}` : null;
}

function substitutionLine(m: GeneratedMovement): string | null {
  const parts: string[] = [];
  const seen = new Map<string, string[]>();
  for (const [c, name] of Object.entries(m.substitutions_by_category)) {
    if (!name || name === m.name) continue;
    seen.set(name, [...(seen.get(name) ?? []), CATEGORY_LABEL[c as Category]]);
  }
  for (const [name, cats] of seen) parts.push(T.substitution(cats.join('/'), name));
  const vars = new Map<string, string[]>();
  for (const [c, name] of Object.entries(m.variant_by_category)) {
    if (!name) continue;
    vars.set(name, [...(vars.get(name) ?? []), CATEGORY_LABEL[c as Category]]);
  }
  for (const [name, cats] of vars) parts.push(T.substitution(cats.join('/'), name));
  return parts.length ? parts.join(' · ') : null;
}

/** `21-15-9` ou `250-500-750 m` quand le schéma porte des mètres/calories. */
function schemeText(b: GeneratedBlock): string {
  const unit = b.movements.find((m) => m.scheme)?.unit;
  const suffix = unit && unit !== 'reps' ? ` ${unit}` : '';
  return `${(b.scheme ?? []).join('-')}${suffix}`;
}

function header(wod: GeneratedWod, b: GeneratedBlock): string[] {
  const cap = b.timecap != null ? T.cap(mmss(b.timecap)) : '';
  const rounds = b.rounds ?? 0;
  switch (b.format) {
    case 'amrap': return [T.amrap(wod.budget_min)];
    case 'for_time': return [b.scheme ? T.forTimeSchema(schemeText(b), cap) : T.forTime(cap)];
    case 'rounds_for_time': return [T.roundsForTime(rounds, cap)];
    case 'chipper': return [T.chipper(cap)];
    case 'ladder': return b.ladder
      ? [T.ladderOuverte(b.ladder.start, b.ladder.start + b.ladder.step, b.ladder.start + 2 * b.ladder.step, wod.budget_min), T.ladderOuverteConsigne(b.ladder.step)]
      : [T.ladderFinie(schemeText(b), cap), T.ladderFinieConsigne];
    case 'emom': return [T.emom(wod.budget_min, b.rest?.every_s && b.rest.every_s !== 60 ? T.emomEvery(mmss(b.rest.every_s)) : '', b.movements.length)];
    case 'death_by': return [T.deathBy(wod.budget_min)];
    case 'tabata': return [T.tabata(b.rest?.transition_s ? T.tabataTransition(b.rest.transition_s) : '')];
    case 'interval': {
      if (b.rest?.every_s) return [T.intervalEvery(rounds, mmss(b.rest.every_s))];
      return [T.intervalRepos(rounds, mmss(b.rest?.rest_s ?? 60))];
    }
    case 'stations': return [T.stations(rounds, b.movements.length, b.rest?.work_s ?? 60, b.rest?.rest_s ?? 0)];
    case 'continuous': return [T.continu(wod.budget_min)];
  }
}

function bodyLines(wod: GeneratedWod, b: GeneratedBlock): string[] {
  const out: string[] = [];
  const push = (m: GeneratedMovement, line: string) => {
    out.push(line);
    const loads = loadsByCategoryLine(m, wod);
    const subs = substitutionLine(m);
    if (loads) out.push(loads);
    if (subs) out.push(subs);
  };
  b.movements.forEach((m, i) => {
    const load = loadText(m, wod.discipline);
    const withLoad = (s: string) => (load ? `${s} (${load})` : s);
    if (b.format === 'tabata') push(m, T.ligneTabata(i + 1, withLoad(m.name), m.unit === 's'));
    else if (b.format === 'stations') push(m, m.unit === 's' ? T.ligneStationTenue(i + 1, withLoad(m.name)) : T.ligneStation(i + 1, withLoad(m.name), m.unit, qtyText(m)));
    else if (m.round !== undefined) push(m, T.ligneRound(m.round, movementLine(m, wod)));
    else if (m.scheme) push(m, withLoad(m.name));
    else if (b.format === 'for_time' && b.scheme) push(m, T.lignePalier(movementLine(m, wod)));
    else if (m.per_minute) push(m, T.ligneParMinute(withLoad(m.name)));
    else if (b.format === 'death_by') push(m, T.ligneAvantSerie(movementLine(m, wod)));
    else if (b.format === 'emom') push(m, T.ligneMinute(i + 1, movementLine(m, wod)));
    else push(m, movementLine(m, wod));
  });
  return out;
}

function footer(wod: GeneratedWod, b: GeneratedBlock): string[] {
  const out: string[] = [];
  if (wod.vest) {
    const men = wod.vest.load_kg_by_category.men ?? 9;
    const women = wod.vest.load_kg_by_category.women ?? 6;
    out.push(wod.vest.mode === 'required' ? T.gilet(men, women) : T.giletOptionnel(men, women));
  }
  const ref = wod.discipline === 'functional' ? 'rx' : 'men';
  const target = wod.estimate.by_category[ref]?.target;
  const scored = b.format === 'for_time' || b.format === 'rounds_for_time' || b.format === 'chipper';
  out.push(T.stimulus(fmtNum(wod.stimulus.rpe), wod.stimulus.note,
    target ? T.stimulusCible(CATEGORY_LABEL[ref], target, scored && b.timecap != null ? T.stimulusCap(mmss(b.timecap)) : '') : ''));
  return out;
}

/** Le titre garde trois mouvements et DIT quand il en reste : « … / BIKE ERG +1 », jamais une troncature muette (G2). */
function titleOf(wod: GeneratedWod, b: GeneratedBlock): string {
  const all = [...new Set(b.movements.filter((m) => m.round === undefined || m.round === 1).map((m) => m.name))];
  const names = all.slice(0, 3);
  if (all.length > 3) names[2] = `${names[2]} +${all.length - 3}`;
  const label: Record<SkeletonFormat, string> = {
    ...T.titre, amrap: T.amrap(wod.budget_min), for_time: b.scheme ? b.scheme.join('-') : T.titre.for_time,
    rounds_for_time: T.titre.rounds_for_time(b.rounds), emom: T.titreEmom(wod.budget_min),
  };
  return `${label[b.format]} · ${names.join(' / ')}`;
}

/** Remplit les colonnes éditeur (titre, description, wod_type…) à partir des blocs. */
export function render(wod: GeneratedWod): GeneratedWod {
  const b = wod.blocks[0];
  const lines = [...header(wod, b), ...bodyLines(wod, b), ...footer(wod, b)];
  return {
    ...wod,
    title: titleOf(wod, b),
    description: lines.join('\n'),
    wod_type: b.format === 'ladder' && !b.ladder ? 'for-time' : WOD_TYPE[b.format],
    block_name: 'wod',
    time_cap_seconds: b.timecap ?? wod.budget_min * 60,
    rounds: b.rounds,
    notes: T.notes(wod.stimulus.note, wod.score_type),
    video_url: null,
    leaderboard_enabled: true,
    emom_interval_minutes: b.format === 'emom' || b.format === 'death_by' ? (b.rest?.every_s ?? 60) / 60 : null,
    tabata_work_seconds: b.format === 'tabata' ? b.rest?.work_s ?? 20 : null,
    tabata_rest_seconds: b.format === 'tabata' ? b.rest?.rest_s ?? 10 : null,
  };
}

/** Lignes de mouvement seules (pour le parseur / les tests de crédit). */
export function movementLines(wod: GeneratedWod): string[] {
  return bodyLines(wod, wod.blocks[0]);
}
