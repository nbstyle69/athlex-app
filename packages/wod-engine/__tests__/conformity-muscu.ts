import {
  CATALOG_SNAPSHOT, targetAvailable, MUSCU_TARGETS, MUSCU_OBJECTIVES, MUSCU_DURATIONS, TARGET_MUSCLES, SCHEMES,
  HEAVY_MAX, HEAVY_PERCENT, REST_EXTRA_MAX, BODYWEIGHT_MAX_LOADED, BODYWEIGHT_PULL_UP_IDS, NO_SQUAT_TARGETS, SQUAT_IDS, HIGH_REP_SETS_MAX, HIGH_REP_SETS_REPS_MAX,
  MUSCU_SKELETONS, priorityFor,
} from '../src';
import type { MuscuWod, MuscuParams, MuscuExercise, MuscuEquipment, MuscuLevel, CatalogMovement, MuscuFields, MovementGroup } from '../src';

/** Causes des relectures des samples Musculation (M1 à M10) : chaque violation ci-dessous est préfixée `[Mx]`. */
export const MUSCU_CAUSES = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10'] as const;
export type MuscuCause = (typeof MUSCU_CAUSES)[number];

export function countMuscuByCause(violations: string[]): Record<MuscuCause, number> {
  const out = Object.fromEntries(MUSCU_CAUSES.map((c) => [c, 0])) as Record<MuscuCause, number>;
  for (const v of violations) {
    const m = /^\[(M\d+)\]/.exec(v);
    if (m && m[1] in out) out[m[1] as MuscuCause]++;
  }
  return out;
}

const EQ: MuscuEquipment[] = ['none', 'box', 'gym'];
const LV: MuscuLevel[] = ['debutant', 'inter', 'avance'];
const RANK: Record<MuscuLevel, number> = { debutant: 0, inter: 1, avance: 2 };
const HIP_THRUST_LOADED = ['hip_thrust', 'db_hip_thrust', 'hip_thrust_machine'];
const LEG_MUSCLES = ['quadriceps', 'fessiers', 'ischios'];
const CORE_MUSCLES = TARGET_MUSCLES.tronc as readonly string[];

type Mv = CatalogMovement & { muscu: MuscuFields };
const byId = new Map<string, Mv>((CATALOG_SNAPSHOT.movements.filter((m) => m.muscu) as Mv[]).map((m) => [m.id, m]));

/** Grille : cible × objectif × matériel × niveau × durée (Force jamais sans matériel ni en Tronc ; Tronc 15 · 20 · 30). */
export function muscuConformityGrid(): MuscuParams[] {
  const grid: MuscuParams[] = [];
  for (const target of MUSCU_TARGETS) for (const objective of MUSCU_OBJECTIVES) for (const equipment of EQ) for (const level of LV) {
    if (objective === 'force' && (equipment === 'none' || target === 'tronc')) continue;
    if (!targetAvailable(CATALOG_SNAPSHOT, target, equipment, level)) continue;
    for (const budget_min of target === 'tronc' ? MUSCU_DURATIONS.tronc : MUSCU_DURATIONS.express) grid.push({ entry: 'express', target, objective, equipment, level, budget_min });
  }
  return grid;
}

function eqWeight(m: Mv, eq: MuscuEquipment): number {
  return eq === 'none' ? m.muscu.weight_bodyweight : eq === 'box' ? m.muscu.weight_box : m.muscu.weight_gym;
}

function isCore(e: MuscuExercise): boolean {
  return e.role === 'core' || e.role === 'calves' || CORE_MUSCLES.includes(e.muscle_primary);
}

function isBodyweightNonCore(m: Mv): boolean {
  return m.muscu.load_mode === 'bodyweight' && !CORE_MUSCLES.includes(m.muscu.muscle_primary) && m.muscu.muscle_primary !== 'mollets';
}

function heavy(e: MuscuExercise): boolean {
  return e.load.mode === 'weighted' || (e.load.mode === '1rm' && (e.load.percent ?? 0) >= HEAVY_PERCENT);
}

/** Règles M1–M10 vérifiées sur la sortie structurée et la description. Retourne la liste des violations. */
export function muscuViolations(wod: MuscuWod, params: MuscuParams): string[] {
  const out: string[] = [];
  const ex = wod.blocks[0].exercises;
  const mv = (e: MuscuExercise) => byId.get(e.id)!;
  const nonCore = ex.filter((e) => !isCore(e));
  const usedGroups = new Set<MovementGroup>(nonCore.map((e) => e.movement_group));
  const excluded = new Set(wod.after_class?.excluded_muscles ?? []);

  // M1 : le main_compound est le meilleur exercice disponible (priorité minimale)
  // pour son muscle. Exception « Sans matériel » (A1) : les DEUX meilleurs rangs
  // sont acceptés — le catalogue y est étroit, et prendre toujours le premier
  // faisait revenir le même exercice à chaque séance. La règle n'est pas levée,
  // elle est élargie d'un rang, et seulement dans ce mode.
  const rangsTolerees = params.equipment === 'none' ? 3 : 1;
  // La priorité applicable dépend du mode (A1) : sans matériel, le catalogue a
  // son propre ordre. On interroge le moteur plutôt que de recopier la règle.
  const prioriteDe = (x: MuscuExercise) => {
    const mv = byId.get(x.id);
    return mv ? priorityFor(mv, params.equipment) : x.priority;
  };
  // Un slot peut imposer un geste (`groups`) : le slot `dos` de `haut_hypertrophie`
  // n'admet que du tirage vertical. Comparer les priorités sur tout le muscle
  // sans en tenir compte reproche au moteur un choix qu'il n'avait pas. Le défaut
  // était invisible avant A1, faute d'exercice de priorité 1 hors du geste imposé.
  const squelette = MUSCU_SKELETONS.find((sk) => sk.target === params.target && sk.objective === params.objective);
  const gesteImpose = (e: MuscuExercise): MovementGroup[] | null => {
    const slot = (squelette?.slots ?? []).find((sl) => sl.role === e.role && sl.groups?.includes(e.movement_group));
    return slot?.groups ?? null;
  };
  for (const e of ex.filter((x) => x.role === 'main_compound')) {
    const impose = gesteImpose(e);
    const better = [...byId.values()].filter((c) =>
      c.id !== e.id && c.muscu.compound && c.muscu.muscle_primary === e.muscle_primary && priorityFor(c, params.equipment) < prioriteDe(e)
      && eqWeight(c, params.equipment) > 0 && RANK[c.muscu.level_min] <= RANK[params.level] && !(params.level === 'debutant' && c.muscu.unilateral)
      && c.muscu.objectives.includes(params.objective)
      && !(NO_SQUAT_TARGETS.includes(params.target) && SQUAT_IDS.includes(c.id))
      && !(params.objective === 'endurance' && params.level !== 'avance' && BODYWEIGHT_PULL_UP_IDS.includes(c.id))
      && !(params.target === 'tronc' && !CORE_MUSCLES.includes(c.muscu.muscle_primary))
      && !excluded.has(c.muscu.muscle_primary)
      && !ex.some((x) => x.id === c.id)
      && (params.target === 'full_body' || !usedGroups.has(c.muscu.movement_group) || c.muscu.movement_group === e.movement_group)
      && !(isBodyweightNonCore(c) && params.equipment !== 'none' && params.level !== 'debutant')
      && (!impose || impose.includes(c.muscu.movement_group)));
    // Nombre de rangs de priorité strictement meilleurs réellement disponibles :
    // c'est lui qui dit si l'exercice tiré est encore dans la fenêtre tolérée.
    const rangsMeilleurs = new Set(better.map((b) => priorityFor(b, params.equipment))).size;
    if (better.length && rangsMeilleurs >= rangsTolerees) {
      out.push(`[M1] ${e.name} (priorité ${prioriteDe(e)}) en principal alors que ${better.map((b) => b.name).join(' / ')} est disponible`);
    }
  }

  // M2 : un seul exercice par geste, sauf Full body et sauf paire compound + isolation
  if (params.target !== 'full_body') {
    const groups = new Map<MovementGroup, MuscuExercise[]>();
    for (const e of nonCore) groups.set(e.movement_group, [...(groups.get(e.movement_group) ?? []), e]);
    for (const [g, list] of groups) {
      if (list.length < 2) continue;
      const pair = list.length === 2 && mv(list[0]).muscu.compound !== mv(list[1]).muscu.compound;
      if (!pair) out.push(`[M2] ${list.length} exercices du groupe ${g} : ${list.map((e) => e.name).join(' + ')}`);
    }
  }

  // M3 : Force → au plus 2 lourds (≥ 80 % ou lestés) ; jamais de squat sur Fessiers / Fessiers + ischios
  if (params.objective === 'force') {
    const n = ex.filter(heavy).length;
    if (n > HEAVY_MAX) out.push(`[M3] ${n} exercices lourds`);
  }
  if (NO_SQUAT_TARGETS.includes(params.target)) for (const e of ex) if (SQUAT_IDS.includes(e.id)) out.push(`[M3] ${e.name} sur cible ${params.target}`);

  // M4 : Pull / Dos → un tirage vertical et un tirage horizontal
  if (params.target === 'pull' || params.target === 'dos') {
    if (!ex.some((e) => e.movement_group === 'pull_v')) out.push('[M4] aucun tirage vertical');
    if (!ex.some((e) => e.movement_group === 'row')) out.push('[M4] aucun tirage horizontal');
  }

  // M5 : Box / Salle, inter et avancé → au plus un poids du corps hors tronc quand le muscle a des exercices chargés
  if (params.equipment !== 'none' && params.level !== 'debutant') {
    const bw = ex.filter((e) => isBodyweightNonCore(mv(e)) && [...byId.values()].some((c) =>
      c.muscu.muscle_primary === e.muscle_primary && c.muscu.load_mode !== 'bodyweight' && c.muscu.compound === mv(e).muscu.compound
      && eqWeight(c, params.equipment) > 0 && RANK[c.muscu.level_min] <= RANK[params.level]));
    if (bw.length > BODYWEIGHT_MAX_LOADED) out.push(`[M5] ${bw.length} exercices poids du corps : ${bw.map((e) => e.name).join(' + ')}`);
  }

  // M6 : Tonification → tractions poids du corps remplacées (sauf avancé) ; jamais de tractions PdC à 15-20 reps
  for (const e of ex) if (BODYWEIGHT_PULL_UP_IDS.includes(e.id)) {
    if (params.objective === 'endurance' && params.level !== 'avance') out.push(`[M6] ${e.name} en Tonification ${params.level}`);
    if (e.reps >= 15) out.push(`[M6] ${e.sets} × ${e.reps} ${e.name}`);
  }

  // M7 : plus de padding par le repos, repos ≤ schéma + 15 s, jamais 5 × 20 pour remplir
  if (wod.generator.relaxations.includes('rest_extended')) out.push('[M7] rest_extended');
  for (const e of ex) {
    const kind = e.role === 'main_compound' ? 'main' : 'other';
    // une ligne sert l'objectif demandé ou, à défaut (isolation en Force), l'hypertrophie
    const maxRest = Math.max(SCHEMES[params.objective].rest[kind], SCHEMES.hypertrophie.rest[kind]);
    if (e.rest_s > maxRest + REST_EXTRA_MAX) out.push(`[M7] repos ${e.rest_s} s sur ${e.name} (schéma ${maxRest} s)`);
    // plancher de l'exercice toléré (reps alternées sans charge : Reverse Lunge 16 = 8 / jambe)
    const floor = byId.get(e.id)?.muscu.rep_ranges[params.objective]?.[0] ?? 0;
    if (e.sets >= HIGH_REP_SETS_MAX && e.reps > Math.max(HIGH_REP_SETS_REPS_MAX, floor) && e.reps_unit === 'reps') out.push(`[M7] ${e.sets} × ${e.reps} ${e.name}`);
  }

  // M8 : Tronc → jamais Force, durées 15 · 20 · 30, aucun compound jambes
  if (params.target === 'tronc') {
    if (params.objective === 'force') out.push('[M8] Force en Tronc');
    if (!(MUSCU_DURATIONS.tronc as readonly number[]).includes(params.budget_min)) out.push(`[M8] durée ${params.budget_min}'`);
    for (const e of ex) if (mv(e).muscu.compound && LEG_MUSCLES.includes(e.muscle_primary)) out.push(`[M8] ${e.name} en Tronc`);
  }

  // M9 : affichage de la charge sans 1RM et libellés validés
  if (/Hypertrophie|Endurance musculaire/.test(wod.description)) out.push('[M9] libellé interdit dans la description');
  if (/sans 1RM connu|%1RM/.test(wod.description)) out.push('[M9] rendu de charge sans 1RM à l’ancienne');
  if (!/Prise de muscle|Force|Tonification/.test(wod.description.split('\n')[0])) out.push('[M9] en-tête sans objectif lisible');
  for (const e of ex) if (e.load.mode === 'rpe' && e.load.rm_reference && !new RegExp(`RPE ${e.load.rpe} \\(≈ \\d+ % du 1RM\\)`).test(wod.description)) out.push(`[M9] ${e.name} : RPE sans approximation 1RM`);

  // M10 : Fessiers + ischios avec matériel → un Hip Thrust chargé (barre, DB ou machine)
  if (params.target === 'fessiers_ischios' && params.equipment !== 'none' && !ex.some((e) => HIP_THRUST_LOADED.includes(e.id))) out.push('[M10] aucun Hip Thrust chargé');

  return out;
}
