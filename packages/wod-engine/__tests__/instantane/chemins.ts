/**
 * Instantané du texte français du moteur (i18n, étape « Moteur », PR M0).
 *
 * Chaque chemin qui produit du texte est rejoué sur un jeu d'entrées
 * déterministe : l'entrée n° k ne dépend que de k. Pour chaque entrée on garde
 *   - le texte affiché ou enregistré (titres, descriptions, notes, lignes) ;
 *   - la sortie complète (le `wod_json`, ou les lignes `box_wods` de la
 *     programmation automatique) ;
 *   - le journal des tirages (méthode appelée, valeur brute tirée).
 * Le test `instantane-fr.test.ts` compare ces trois empreintes à celles
 * relevées sur master avant toute modification du moteur.
 */
import {
  generateBlocC, generateMuscu, generateWeek, generateMuscuWeek, runWeekGeneration, movementLines, renderMuscu,
  exerciseLine, loadText, weekSeed, CATALOG_SNAPSHOT, BANK_V1, MUSCU_TARGETS, MUSCU_OBJECTIVES, MUSCU_DURATIONS,
  FUNCTIONAL_CATEGORIES, HYBRID_CATEGORIES, AFTER_CLASS_DURATIONS, RNG,
} from '../../src';
import type {
  GenerateRequest, GeneratedWod, MuscuWod, GeneratedWeek, GeneratedMuscuWeek, MuscuEquipment, MuscuLevel, FormatChoice,
  Intention, Vest, Category, ProgrammingDb, ProgrammingBox, RunRow, BoxWodInsert, ExistingAutoRow, Track, RevealConfig,
} from '../../src';

export interface Sortie {
  /** texte affiché ou enregistré, une ligne par entrée de tableau */
  texte: string[];
  /** sortie complète (structure enregistrée en `wod_json`, lignes `box_wods`) */
  sortie: unknown;
}

export interface Chemin {
  nom: string;
  /** nombre d'entrées rejouées */
  n: number;
  /** entrées dont le texte complet est gardé dans `instantane-fr-lisible.txt` */
  lisible: number;
  /** résumé lisible de l'entrée k (paramètres et graine) */
  entree(k: number): string;
  produire(k: number): Sortie | Promise<Sortie>;
}

// ── Journal des tirages ─────────────────────────────────────────────────────
// Chaque méthode publique du RNG note son nom, et chaque valeur brute tirée est
// notée à la suite : le journal donne le nombre ET l'ordre des appels.

let journal: string[] | null = null;
type Traced = { r: () => number; __trace?: boolean };
const proto = RNG.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
for (const nom of ['float', 'int', 'pick', 'pickWeighted', 'sample', 'shuffle']) {
  const orig = proto[nom];
  proto[nom] = function (this: Traced, ...a: unknown[]) {
    if (!this.__trace) {
      const r = this.r;
      this.r = () => { const v = r(); journal?.push(String(Math.round(v * 4294967296))); return v; };
      this.__trace = true;
    }
    journal?.push(nom);
    return orig.apply(this, a);
  };
}

/** Rejoue `f` en relevant le journal des tirages. */
export async function avecJournal(f: () => Sortie | Promise<Sortie>): Promise<{ s: Sortie; tirages: string[] }> {
  const j: string[] = [];
  journal = j;
  try { return { s: await f(), tirages: j }; } finally { journal = null; }
}

// ── Texte affiché ───────────────────────────────────────────────────────────

const lignes = (prefixe: string, texte: string | null | undefined): string[] =>
  texte == null ? [`${prefixe} ∅`] : texte.split('\n').map((l) => `${prefixe} ${l}`);

function texteMetcon(w: GeneratedWod, p = ''): string[] {
  const out = [
    ...lignes(`${p}titre :`, w.title),
    ...lignes(`${p}description :`, w.description),
    ...lignes(`${p}notes :`, w.notes),
    ...lignes(`${p}stimulus :`, w.stimulus.note),
    ...movementLines(w).map((l) => `${p}ligne : ${l}`),
  ];
  for (const [cat, e] of Object.entries(w.estimate.by_category)) out.push(`${p}cible ${cat} : ${e?.target ?? '∅'}`);
  return out;
}

function texteMuscu(w: MuscuWod, p = ''): string[] {
  return [
    ...lignes(`${p}titre :`, w.title),
    ...lignes(`${p}description :`, renderMuscu(w)),
    ...lignes(`${p}notes :`, w.notes),
    ...lignes(`${p}stimulus :`, w.stimulus.note),
    ...w.blocks[0].exercises.flatMap((e) => [
      `${p}exercice : ${exerciseLine(e)}`, `${p}charge : ${loadText(e)}`, `${p}note : ${e.notes}`,
    ]),
  ];
}

function texteSemaine(w: GeneratedWeek): string[] {
  return w.sessions.flatMap((s) => [
    `== jour ${s.day} · ${s.label}`,
    ...s.blocks.flatMap((b) => [
      `-- bloc ${b.block_name} (${b.sort_order})`,
      ...lignes('titre :', b.title), ...lignes('description :', b.description), ...lignes('notes :', b.notes),
    ]),
    // le bloc C est déjà dans `blocks` (titre, description, notes) : seules ses lignes et cibles s'ajoutent
    ...(s.bloc_c ? texteMetcon(s.bloc_c, 'C ').filter((l) => /^C (ligne|cible|stimulus) /.test(l)) : []),
  ]);
}

function texteSemaineMuscu(w: GeneratedMuscuWeek): string[] {
  return [...w.days.flatMap((d) => [`== jour ${d.day} · ${d.target}`, ...texteMuscu(d.wod)])];
}

function erreur(e: unknown): Sortie {
  const err = e as Error & { reasons?: unknown };
  return { texte: [`erreur : ${err.name} : ${err.message}`], sortie: { erreur: err.name, message: err.message, reasons: err.reasons ?? null } };
}

// ── Entrées déterministes ───────────────────────────────────────────────────

const C = CATALOG_SNAPSHOT;
const B = BANK_V1;
const FMTS: FormatChoice[] = ['surprise', 'amrap', 'for_time', 'emom', 'chipper', 'stations', 'interval'];
const F_INT: Intention[] = ['mixed', 'cardio', 'force', 'gym'];
const H_INT: Intention[] = ['interval', 'engine', 'aerobic', 'run', 'core'];
const VESTS: Vest[] = ['none', 'required', 'optional'];
const EQ: MuscuEquipment[] = ['none', 'box', 'gym'];
const LV: MuscuLevel[] = ['debutant', 'inter', 'avance'];

/** Ids gymniques actifs du catalogue (records gymniques B10). */
const GYM_IDS = C.movements.filter((m) => m.active && m.family === 'gym' && m.weight_functional > 0).map((m) => m.id).slice(0, 6);
/** Exclusions de l'écran : matériel, famille, noms affichés, ids. */
const EXCLUSIONS: (string[] | undefined)[] = [undefined, ['rower'], ['barbell'], ['Thrusters', 'Wall Balls'], ['run'], [GYM_IDS[0]]];

/**
 * WOD du jour de la box, dans les formes qu'on trouve en vrai : noms seuls,
 * lignes rendues par le moteur (`R1 ·`, `Min 3 ·`, `Station 1 ·`), lignes de
 * force (`— repos`, `/ jambe`, `% du max`), alias français, rien du tout.
 */
export const CLASSES: string[][] = [
  ['Back Squat', 'Thrusters'],
  ['21-15-9', 'Thrusters (43/30 kg)', 'Pull-ups'],
  ['R1 · 10 Deadlift (100/70 kg)', 'R2 · 12 Box Jump', 'Min 3 · 15 cal Row'],
  ['Station 1 · 20 Wall Balls', '400 m Run', '5 rounds for time'],
  ['Back Squat — 5 × 5 @ 75 %1RM — repos 2:00', 'Strict Press — 4 × 6 @ 70 %1RM'],
  ['Hip Thrust — 4 × 10 / jambe', 'Bulgarian Split Squat'],
  ['Snatch', 'Toes-to-Bar', 'Double Unders'],
  ['traction', 'pompe', 'rameur'],
  ['Bench Press', 'Ring Muscle-up — 3 × 15 % du max'],
  ['12 Wall Balls', '15 cal Row', '1.5 km Run'],
  [],
];

function grilleExpress(): GenerateRequest[] {
  const g: GenerateRequest[] = [];
  for (const b of [8, 12, 15, 20, 30]) for (const i of F_INT) for (const f of FMTS)
    g.push({ entry: 'express', discipline: 'functional', budget_min: b, intention: i, format: f });
  for (const b of [15, 20, 30, 45]) for (const i of H_INT) for (const f of FMTS) for (const v of VESTS)
    g.push({ entry: 'express', discipline: 'hybrid', budget_min: b, intention: i, format: f, vest: v });
  return g;
}
const GRILLE_EXPRESS = grilleExpress();

/** Variations de l'écran, par k : durée laissée au moteur, catégorie, records gymniques, exclusions. */
function varier(p: GenerateRequest, k: number): GenerateRequest {
  const cats: readonly Category[] = p.discipline === 'functional' ? FUNCTIONAL_CATEGORIES : HYBRID_CATEGORIES;
  const q: GenerateRequest = { ...p, profile_category: cats[k % cats.length] };
  if (k % 3 === 0) delete q.budget_min; // l'app ne passe pas de durée : le moteur la tire
  if (k % 5 === 0) q.gym_records = Object.fromEntries(GYM_IDS.map((id, i) => [id, [0, 3, 12, 25][(k + i) % 4]]));
  const ex = EXCLUSIONS[k % EXCLUSIONS.length];
  if (ex) q.exclude = ex;
  if (k % 4 === 0) q.recent_signatures = [`functional|x|amrap|-|${GYM_IDS[1]}:reps`];
  return q;
}

function requeteExpress(k: number): GenerateRequest {
  return varier(GRILLE_EXPRESS[k % GRILLE_EXPRESS.length], k);
}

function requeteApresClasse(k: number): GenerateRequest {
  const discipline = k % 2 === 0 ? 'functional' : 'hybrid';
  const ints = discipline === 'functional' ? F_INT : H_INT;
  const p: GenerateRequest = {
    entry: 'after_class', discipline, intention: ints[k % ints.length], format: 'surprise',
    budget_min: AFTER_CLASS_DURATIONS[k % AFTER_CLASS_DURATIONS.length],
    after_class: { day_movements: CLASSES[k % CLASSES.length], box_wod_title: k % 2 ? 'WOD du jour' : null },
  };
  if (discipline === 'hybrid') p.vest = VESTS[k % VESTS.length];
  return varier(p, k);
}

type MuscuReq = Parameters<typeof generateMuscu>[0];

function requeteMuscu(k: number, entry: 'express' | 'after_class'): MuscuReq {
  const target = MUSCU_TARGETS[k % MUSCU_TARGETS.length];
  const durees: readonly number[] = entry === 'express' ? MUSCU_DURATIONS.express : MUSCU_DURATIONS.after_class;
  const p: MuscuReq = {
    entry,
    target,
    // Après ma classe refuse la Force (message affiché) : une entrée sur 25 seulement la demande
    objective: entry === 'after_class' && k % 25 !== 0
      ? (['hypertrophie', 'endurance'] as const)[Math.floor(k / MUSCU_TARGETS.length) % 2]
      : MUSCU_OBJECTIVES[Math.floor(k / MUSCU_TARGETS.length) % MUSCU_OBJECTIVES.length],
    equipment: EQ[Math.floor(k / 3) % EQ.length],
    level: LV[Math.floor(k / 7) % LV.length],
  };
  if (k % 4 !== 0) p.budget_min = durees[k % durees.length];
  if (k % 3 === 1) p.one_rep_max = { back_squat: 120, deadlift: 150, bench: 85, press: 55, hip_thrust: 140 };
  if (k % 3 === 2) p.one_rep_max = { bench: 60 };
  if (k % 4 === 1) p.bodyweight_kg = 72;
  if (k % 11 === 0) p.box_wod = true;
  if (k % 6 === 5) p.exclude = ['barbell'];
  if (k % 5 === 3) p.recent_exercise_ids = ['push_up', 'goblet_squat'];
  if (entry === 'after_class') p.after_class = { day_movements: CLASSES[k % CLASSES.length], box_wod_title: null };
  return p;
}

function metcon(p: GenerateRequest, seed: number): Sortie {
  try { const w = generateBlocC(p, C, B, seed); return { texte: texteMetcon(w), sortie: w }; } catch (e) { return erreur(e); }
}

function muscu(p: MuscuReq, seed: number): Sortie {
  try { const w = generateMuscu(p, C, B, seed); return { texte: texteMuscu(w), sortie: w }; } catch (e) { return erreur(e); }
}

const graine = (k: number) => 1000 + k * 7919;
const graineSemaine = (k: number, t: Track) => { const s = semaineDe(k); return weekSeed(`box-${k}`, t, s.iso_year, s.iso_week, 0); };
const semaineDe = (k: number) => ({ iso_year: 2026 + (k % 3), iso_week: (k % 52) + 1 });

/** Une entrée sur quatre reçoit le journal de la semaine précédente, comme `recentSignatures`. */
function semaine(track: 'functional' | 'hybrid', k: number): Sortie {
  const { iso_year, iso_week } = semaineDe(k);
  const tirer = (w: number, recent: string[]) => generateWeek({
    iso_year, iso_week: w, track, recent_signatures: recent, exclude: k % 9 === 4 ? ['rower'] : undefined,
  }, C, B, weekSeed(`box-${k}`, track, iso_year, w, 0));
  try {
    const recent = k % 4 === 1 && iso_week > 1 ? tirer(iso_week - 1, []).signatures : [];
    const w = tirer(iso_week, recent);
    return { texte: texteSemaine(w), sortie: w };
  } catch (e) { return erreur(e); }
}

function semaineMuscu(k: number): Sortie {
  const { iso_year, iso_week } = semaineDe(k);
  try {
    const w = generateMuscuWeek({
      iso_year, iso_week, equipment: k % 5 === 2 ? 'gym' : undefined, level: k % 7 === 3 ? 'avance' : undefined,
    }, C, B, weekSeed(`box-${k}`, 'musculation', iso_year, iso_week, 0));
    return { texte: texteSemaineMuscu(w), sortie: w };
  } catch (e) { return erreur(e); }
}

// ── Programmation automatique (ce qu'écrit `generate-box-week`) ─────────────

class Base implements ProgrammingDb {
  boxes: ProgrammingBox[] = [];
  runs: RunRow[] = [];
  wods: (BoxWodInsert & { id: string })[] = [];
  groups: string[] = [];
  private seq = 0;
  private id(p: string) { this.seq += 1; return `${p}-${this.seq}`; }
  async listEnabledBoxes() { return this.boxes; }
  async getRun(box_id: string, track: Track, iso_year: number, iso_week: number) {
    return this.runs.find((r) => r.box_id === box_id && r.track === track && r.iso_year === iso_year && r.iso_week === iso_week) ?? null;
  }
  async upsertRun(run: Omit<RunRow, 'id'>) {
    const i = this.runs.findIndex((r) => r.box_id === run.box_id && r.track === run.track && r.iso_year === run.iso_year && r.iso_week === run.iso_week);
    if (i >= 0) { this.runs[i] = { ...run, id: this.runs[i].id }; return this.runs[i]; }
    const row = { ...run, id: this.id('run') };
    this.runs.push(row);
    return row;
  }
  async updateRun(id: string, patch: Partial<RunRow>) { const i = this.runs.findIndex((r) => r.id === id); this.runs[i] = { ...this.runs[i], ...patch }; }
  async recentSignatures(box_id: string, track: Track, before: { iso_year: number; iso_week: number }, weeks: number) {
    return this.runs.filter((r) => r.box_id === box_id && r.track === track && r.status === 'done' && r.iso_year === before.iso_year
      && r.iso_week < before.iso_week && r.iso_week >= before.iso_week - weeks).flatMap((r) => r.signatures);
  }
  async listAutoRows(run_id: string): Promise<ExistingAutoRow[]> {
    return this.wods.filter((w) => w.auto_run_id === run_id).map((w) => ({ id: w.id, scheduled_date: w.scheduled_date, edited_at: null, scored: false }));
  }
  async deleteRows(ids: string[]) { this.wods = this.wods.filter((w) => !ids.includes(w.id)); }
  async insertRows(rows: BoxWodInsert[]) { return rows.map((r) => { const id = this.id('wod'); this.wods.push({ ...r, id }); return id; }); }
  async ensureGroup(box_id: string, name: string) { this.groups.push(`${box_id}:${name}`); }
}

const REVEALS: (RevealConfig | undefined)[] = [undefined, { mode: 'daily', dow: 0, time: '06:00' }, { mode: 'weekly', dow: 5, time: '20:30' }];

async function programmation(k: number): Promise<Sortie> {
  const db = new Base();
  const tracks: Track[] = [['functional', 'hybrid', 'musculation'], ['functional'], ['hybrid', 'musculation']][k % 3] as Track[];
  db.boxes = [{ id: `box-${k}`, owner_id: k % 2 ? `owner-${k}` : null, tracks, reveal: REVEALS[k % REVEALS.length] }];
  const target = semaineDe(k);
  // semaine précédente d'abord : l'anti-répétition lit son journal
  if (target.iso_week > 1) await runWeekGeneration(db, C, B, { now: new Date(0), target: { ...target, iso_week: target.iso_week - 1 } });
  const avant = db.wods.length;
  const outcomes = await runWeekGeneration(db, C, B, { now: new Date(0), target });
  if (k % 4 === 0) outcomes.push(...await runWeekGeneration(db, C, B, { now: new Date(0), target, regen: { box_id: `box-${k}`, track: tracks[0] } }));
  const rows = db.wods.slice(avant);
  return {
    texte: [
      ...db.groups.map((g) => `groupe : ${g}`),
      ...rows.flatMap((r) => [
        `== ${r.track} · ${r.scheduled_date} · ${r.block_name} (${r.sort_order})`,
        ...lignes('titre :', r.title), ...lignes('description :', r.description), ...lignes('notes :', r.notes),
      ]),
      ...outcomes.filter((o) => o.error).map((o) => `erreur : ${o.track} : ${o.error}`),
    ],
    sortie: { outcomes, runs: db.runs, rows: db.wods },
  };
}

// ── Les chemins ─────────────────────────────────────────────────────────────

export const CHEMINS: Chemin[] = [
  {
    nom: 'wod-express', n: 600, lisible: 50,
    entree: (k) => `${JSON.stringify(requeteExpress(k))} graine ${graine(k)}`,
    produire: (k) => metcon(requeteExpress(k), graine(k)),
  },
  {
    nom: 'apres-ma-classe', n: 500, lisible: 50,
    entree: (k) => `${JSON.stringify(requeteApresClasse(k))} graine ${graine(k)}`,
    produire: (k) => metcon(requeteApresClasse(k), graine(k)),
  },
  {
    nom: 'musculation', n: 600, lisible: 50,
    entree: (k) => `${JSON.stringify(requeteMuscu(k, 'express'))} graine ${graine(k)}`,
    produire: (k) => muscu(requeteMuscu(k, 'express'), graine(k)),
  },
  {
    nom: 'musculation-apres-ma-classe', n: 500, lisible: 50,
    entree: (k) => `${JSON.stringify(requeteMuscu(k, 'after_class'))} graine ${graine(k)}`,
    produire: (k) => muscu(requeteMuscu(k, 'after_class'), graine(k)),
  },
  {
    nom: 'seance-functional', n: 500, lisible: 15,
    entree: (k) => `box-${k} functional ${JSON.stringify(semaineDe(k))} graine ${graineSemaine(k, 'functional')}`,
    produire: (k) => semaine('functional', k),
  },
  {
    nom: 'seance-hybrid', n: 500, lisible: 15,
    entree: (k) => `box-${k} hybrid ${JSON.stringify(semaineDe(k))} graine ${graineSemaine(k, 'hybrid')}`,
    produire: (k) => semaine('hybrid', k),
  },
  {
    nom: 'semaine-musculation', n: 500, lisible: 15,
    entree: (k) => `box-${k} musculation ${JSON.stringify(semaineDe(k))} graine ${graineSemaine(k, 'musculation')}`,
    produire: (k) => semaineMuscu(k),
  },
  {
    nom: 'programmation', n: 500, lisible: 8,
    entree: (k) => `box-${k} ${JSON.stringify(semaineDe(k))} pistes ${k % 3} révélation ${k % REVEALS.length}${k % 4 === 0 ? ' + régénération' : ''}`,
    produire: (k) => programmation(k),
  },
];
