import {
  CATALOG_SNAPSHOT, BANK_V1, movementById, primaryPattern, isFunctionalCategory, categoriesFor, cadenceFor,
  carriesIntention, isSlowSkill, movementCapFor, ladderStep, deathByMinute, roundSeconds, afterClassFilter,
} from '../src';
import type { GeneratedWod, GenerateParams, FormatChoice, Intention, Category } from '../src';

/** Causes de la relecture des 90 samples (A à H) : chaque violation ci-dessous est préfixée `[X]`. */
export const CAUSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type Cause = (typeof CAUSES)[number];

export function countByCause(violations: string[]): Record<Cause, number> {
  const out = Object.fromEntries(CAUSES.map((c) => [c, 0])) as Record<Cause, number>;
  for (const v of violations) {
    const m = /^\[([A-H])\]/.exec(v);
    if (m) out[m[1] as Cause]++;
  }
  return out;
}

const FMTS: FormatChoice[] = ['surprise', 'amrap', 'for_time', 'emom', 'chipper', 'stations', 'interval'];
const F_INT: Intention[] = ['mixed', 'cardio', 'force', 'gym'];
const H_INT: Intention[] = ['interval', 'engine', 'aerobic', 'run', 'core'];

/** Grille §9 : entrée × discipline × durée × format × intention × gilet. */
export function conformityGrid(): GenerateParams[] {
  const grid: GenerateParams[] = [];
  for (const b of [8, 12, 15, 20, 30]) for (const i of F_INT) for (const f of FMTS)
    grid.push({ entry: 'express', discipline: 'functional', budget_min: b, intention: i, format: f });
  for (const b of [15, 20, 30, 45]) for (const i of H_INT) for (const f of FMTS) for (const v of ['none', 'required', 'optional'] as const)
    grid.push({ entry: 'express', discipline: 'hybrid', budget_min: b, intention: i, format: f, vest: v });
  for (const b of [10, 15, 20]) for (const d of ['functional', 'hybrid'] as const) for (const i of d === 'functional' ? F_INT : H_INT)
    grid.push({ entry: 'after_class', discipline: d, budget_min: b, intention: i, format: 'surprise', after_class: { day_movements: ['Back Squat', 'Thrusters'] } });
  return grid;
}

/** Règles de composition §5 vérifiées sur la sortie structurée. Retourne la liste des violations. */
export function violations(wod: GeneratedWod, params: GenerateParams): string[] {
  const out: string[] = [];
  const b = wod.blocks[0];
  const ref: Category = params.discipline === 'functional' ? 'rx' : 'men';
  const rows = b.movements.map((gm) => ({ gm, m: movementById(CATALOG_SNAPSHOT, gm.id)! }));
  if (rows.some((r) => !r.m)) return ['mouvement inconnu du catalogue'];
  if (rows.some((r) => !r.m.active)) out.push('mouvement inactif tiré');

  // 1-3 : enchaînements (mouvements exécutés dans la même séquence : hors slots rotatifs)
  const seq = rows.filter((r) => r.gm.round === undefined);
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1].m;
    const c = seq[i].m;
    if (primaryPattern(a) === primaryPattern(c) && primaryPattern(c) !== 'mono') out.push(`pattern consécutif ${a.id}→${c.id}`);
    if (a.grip === 'high' && c.grip === 'high') out.push(`grip high consécutif ${a.id}→${c.id}`);
    if ((b.format === 'stations' || b.format === 'emom') && a.shoulder_load === 'high' && c.shoulder_load === 'high') out.push(`épaules high consécutives ${a.id}→${c.id}`);
  }
  // 4 : volumes bornés
  const caps = BANK_V1.volume_caps[params.discipline][ref] ?? {};
  const mult = b.format === 'rounds_for_time' ? (b.rounds ?? 1) : 1;
  for (const r of rows) {
    const cap = caps[r.gm.unit];
    const total = r.gm.qty * (r.gm.round !== undefined ? 1 : mult);
    if (cap !== undefined && total > cap) out.push(`volume ${r.gm.id} ${total} > ${cap}`);
  }
  // 5-6 : bandes
  const loaded = rows.filter((r) => r.gm.load_band && r.m.loads);
  if (params.budget_min > 15 && loaded.some((r) => r.gm.load_band === 'heavy')) out.push('bande heavy au-delà de 15 min');
  if (params.intention === 'force' && params.entry === 'express' && loaded.some((r) => r.gm.load_band === 'light')) out.push('bande light en Force');
  const needMod = { force: 'W', gym: 'G', cardio: 'M' }[params.intention as string];
  if (params.discipline === 'functional' && needMod && !rows.some((r) => r.m.modality === needMod)) out.push(`intention ${params.intention} sans modalité ${needMod}`);
  if (params.entry === 'after_class' && loaded.some((r) => r.gm.load_band !== 'light')) out.push('après-classe : bande non light');
  // 7-8 : composition par discipline
  if (params.discipline === 'hybrid' && !rows.some((r) => r.m.family === 'erg' || r.m.family === 'run')) out.push('Hybrid sans erg ni run');
  if (params.discipline === 'functional' && !rows.some((r) => r.m.modality === 'W' || r.m.modality === 'G')) out.push('Functional sans W ni G');
  // 9 : couplet / triplet Functional : une seule barre
  const slots = new Set(rows.map((r) => r.gm.round === undefined ? r.gm.id : 'rot')).size;
  if (params.discipline === 'functional' && slots <= 3 && rows.filter((r) => r.m.family === 'barbell').length > 1) out.push('deux barres en couplet/triplet');
  // 10 : poids de tirage nul
  for (const r of rows) {
    const w = params.discipline === 'functional' ? r.m.weight_functional : r.m.weight_hybrid;
    if (w <= 0) out.push(`poids de tirage nul ${r.m.id}`);
  }
  // 11 : variant_up seulement Elite / Pro
  for (const r of rows) {
    for (const [c, v] of Object.entries(r.gm.variant_by_category)) {
      if (v && !(c === 'elite' || c === 'pro')) out.push(`variante hors Elite/Pro ${r.gm.id}/${c}`);
    }
  }
  // 12 : estimation ±10 % du budget pour la catégorie de référence
  const est = wod.estimate.reference_minutes;
  if (Math.abs(est - params.budget_min) / params.budget_min > 0.10 + 1e-9) out.push(`estimation ${est.toFixed(1)} hors ±10 % de ${params.budget_min}`);
  // 13 : après-classe
  if (params.entry === 'after_class' && wod.after_class) {
    const pats = new Set(wod.after_class.excluded_patterns);
    const fams = new Set(wod.after_class.excluded_families);
    for (const r of rows) {
      if (r.m.pattern.some((p) => pats.has(p))) out.push(`après-classe : pattern exclu ${r.m.id}`);
      if (fams.has(r.m.family)) out.push(`après-classe : famille exclue ${r.m.id}`);
    }
  }
  // 14 : exclusions
  const ex = new Set((params.exclude ?? []).map((e) => e.toLowerCase()));
  for (const r of rows) {
    if (ex.has(r.m.id) || ex.has(r.m.family) || r.m.equipment.some((e) => ex.has(e.toLowerCase()))) out.push(`exclusion ignorée ${r.m.id}`);
  }
  // 15 : signature
  if ((params.recent_signatures ?? []).includes(wod.signature)) out.push('signature récente répétée');
  // gilet
  if (params.discipline === 'hybrid' && params.vest && params.vest !== 'none') {
    if (wod.vest?.mode !== params.vest) out.push('gilet absent');
  } else if (wod.vest) out.push('gilet inattendu');
  // charges / substitutions / cadences renseignées pour toutes les catégories de la discipline
  for (const r of rows) {
    for (const c of Object.keys(r.gm.cadence_by_category) as Category[]) {
      if (isFunctionalCategory(c) !== (params.discipline === 'functional')) out.push(`catégorie hors discipline ${c}`);
    }
    if (r.m.loads && Object.values(r.gm.loads_by_category).some((v) => !v || v.length === 0)) out.push(`charge manquante ${r.gm.id}`);
  }
  out.push(...causeViolations(wod, params));
  return out;
}

/** Volume total d'un mouvement sur le WOD, pour la catégorie de référence (même règle que le moteur). */
function totalVolume(wod: GeneratedWod, ref: Category, i: number): number {
  const b = wod.blocks[0];
  const gm = b.movements[i];
  const budgetS = wod.budget_min * 60;
  if (gm.round !== undefined) return gm.qty;
  switch (b.format) {
    case 'rounds_for_time': case 'interval': case 'stations': case 'emom': return gm.qty * (b.rounds ?? 1);
    case 'amrap': case 'continuous': return gm.qty * Math.ceil(budgetS / roundSeconds(b, ref));
    case 'death_by': {
      const n = deathByMinute(b, ref, wod.budget_min);
      return gm.per_minute ? (n * (n + 1)) / 2 : gm.qty * n;
    }
    case 'tabata': return (16 * 20) / gm.cadence_by_category[ref]!;
    default: return gm.qty;
  }
}

/**
 * Corrections A–H de la relecture des samples. Chaque violation est préfixée par sa cause
 * pour le compteur (`countByCause`) : toutes doivent être à zéro.
 */
export function causeViolations(wod: GeneratedWod, params: GenerateParams): string[] {
  const out: string[] = [];
  const b = wod.blocks[0];
  const ref: Category = params.discipline === 'functional' ? 'rx' : 'men';
  const rows = b.movements.map((gm) => ({ gm, m: movementById(CATALOG_SNAPSHOT, gm.id)! }));
  const budgetS = params.budget_min * 60;

  // A — scheme fixe : un for time à schéma est 21-15-9 / 9-7-5 (≤ 45 reps), jamais gonflé
  if (b.format === 'for_time' && b.scheme && rows.some((r) => r.gm.unit === 'reps' && r.gm.scheme)) {
    const sum = b.scheme.reduce((s, q) => s + q, 0);
    if (sum > 45) out.push(`[A] scheme gonflé ${b.scheme.join('-')}`);
  }
  // B — plafonds §5.4 par mouvement, total du WOD à la référence
  rows.forEach((r, i) => {
    const cap = movementCapFor(BANK_V1, r.m, r.gm.load_band ?? 'light', r.gm.unit, ref);
    if (cap === null) return;
    const total = totalVolume(wod, ref, i);
    if (total > cap + 1e-9) out.push(`[B] ${r.gm.id} ${Math.round(total)} ${r.gm.unit} > plafond ${cap}`);
  });
  // C — intention honorée quel que soit le format
  if (params.intention === 'force' || params.intention === 'gym' || params.intention === 'core') {
    if (!rows.some((r) => carriesIntention(params, r.m, r.gm.load_band ?? 'light'))) out.push(`[C] intention ${params.intention} non portée`);
  }
  if (params.intention === 'cardio') {
    for (const r of rows) if (isSlowSkill(r.m)) out.push(`[C] cardio avec skill lent ${r.gm.id} (${cadenceFor(r.m, 'rx', 'reps') ?? '-'} s/rep)`);
  }
  // D — chipper : un seul passage, run ≤ 800 m
  if (b.format === 'chipper') {
    if ((b.rounds ?? 1) > 1) out.push(`[D] chipper en ${b.rounds} rounds`);
    for (const r of rows) if (r.m.family === 'run' && r.gm.unit === 'm' && r.gm.qty > 800) out.push(`[D] run ${r.gm.qty} m dans un chipper`);
  }
  // E — ladder ouverte : palier différent entre la catégorie la plus basse et la plus haute
  if (b.format === 'ladder') {
    if (!b.ladder) out.push('[E] ladder fermée (pas de pas)');
    const cats = categoriesFor(params.discipline);
    const lo = ladderStep(b, cats[0], budgetS);
    const hi = ladderStep(b, cats[cats.length - 1], budgetS);
    if (lo >= hi) out.push(`[E] même palier ${lo} pour ${cats[0]} et ${cats[cats.length - 1]}`);
    const targets = new Set(cats.map((c) => wod.estimate.by_category[c]?.target));
    if (targets.size < 2) out.push('[E] cible identique pour toutes les catégories');
  }
  // F — budget : la structure temporelle ne dépasse jamais le budget
  const rounds = b.rounds ?? 1;
  if (b.format === 'interval' && b.rest?.every_s && rounds * b.rest.every_s > budgetS) out.push(`[F] ${rounds} × ${b.rest.every_s} s > budget`);
  if (b.format === 'interval' && !b.rest?.every_s) {
    const total = rounds * roundSeconds(b, ref) + (b.rest?.rest_s ?? 0) * (rounds - 1);
    if (total > budgetS + 1e-9) out.push(`[F] intervalles ${Math.round(total)} s > budget`);
  }
  if (b.format === 'stations' && rounds * b.movements.length * ((b.rest?.work_s ?? 0) + (b.rest?.rest_s ?? 0)) > budgetS) out.push('[F] stations > budget');
  if (b.format === 'emom' && rounds * b.movements.length * (b.rest?.every_s ?? 60) > budgetS) out.push('[F] EMOM > budget');
  if (b.format === 'tabata' && 2 * 8 * 30 + (b.rest?.transition_s ?? 0) > budgetS) out.push('[F] tabata > budget');
  if (b.format === 'death_by' && (b.rest?.every_s ?? 60) * params.budget_min > budgetS) out.push('[F] death by > budget');
  // G — exclusion en cascade : aucun mouvement dont le matériel est exclu (utilisateur ou WOD du jour)
  const ex = new Set((params.exclude ?? []).map((e) => e.toLowerCase()));
  const ac = params.entry === 'after_class' && params.after_class ? afterClassFilter(CATALOG_SNAPSHOT, params.after_class.day_movements) : null;
  for (const r of rows) {
    for (const e of r.m.equipment) {
      const k = e.toLowerCase();
      if (ex.has(k) || ac?.equipment.has(k)) out.push(`[G] ${r.gm.id} tiré avec matériel exclu ${e}`);
    }
  }
  // H — cadences Hybrid : la cible d'une station est tenable dans le temps de travail
  if (b.format === 'stations' && b.rest?.work_s) {
    for (const r of rows) {
      const need = r.gm.qty * r.gm.cadence_by_category[ref]!;
      if (need > b.rest.work_s * 1.05) out.push(`[H] ${r.gm.id} ${r.gm.qty} ${r.gm.unit} = ${Math.round(need)} s > ${b.rest.work_s} s`);
    }
  }
  return out;
}
