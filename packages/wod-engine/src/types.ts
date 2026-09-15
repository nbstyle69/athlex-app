/**
 * wod-engine — types publics.
 * TypeScript pur : aucune dépendance React / Expo / Supabase.
 */

export type Discipline = 'functional' | 'hybrid';
export type Entry = 'express' | 'after_class';

export type FunctionalIntention = 'mixed' | 'cardio' | 'force' | 'gym';
export type HybridIntention = 'interval' | 'engine' | 'aerobic' | 'run' | 'core';
export type Intention = FunctionalIntention | HybridIntention;

/** Formats proposés à l'écran (« Surprends-moi » = `surprise`). */
export type FormatChoice = 'surprise' | 'amrap' | 'for_time' | 'emom' | 'chipper' | 'stations' | 'interval';

/** Formats des squelettes (bank-v1). */
export type SkeletonFormat =
  | 'amrap' | 'for_time' | 'rounds_for_time' | 'emom' | 'interval' | 'chipper'
  | 'ladder' | 'death_by' | 'tabata' | 'stations' | 'continuous';

export type Vest = 'none' | 'required' | 'optional';

export type FunctionalCategory = 'scaled' | 'inter' | 'rx' | 'rxplus' | 'elite' | 'pro';
export type HybridCategory = 'women' | 'men' | 'women_pro' | 'men_pro';
export type Category = FunctionalCategory | HybridCategory;

export const FUNCTIONAL_CATEGORIES: readonly FunctionalCategory[] = ['scaled', 'inter', 'rx', 'rxplus', 'elite', 'pro'];
export const HYBRID_CATEGORIES: readonly HybridCategory[] = ['women', 'men', 'women_pro', 'men_pro'];

export type Band = 'light' | 'medium' | 'heavy';
export type Unit = 'reps' | 'cal' | 'm' | 's';
export type LoadUnit = 'kg' | 'cm';

export type Family =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'gym' | 'bodyweight' | 'erg' | 'run' | 'sled'
  | 'carry' | 'sandbag' | 'wallball' | 'jump_rope' | 'box' | 'other';
export type Pattern =
  | 'squat' | 'hinge' | 'push_v' | 'push_h' | 'pull_v' | 'pull_h' | 'carry' | 'lunge' | 'core' | 'mono';
export type Modality = 'W' | 'G' | 'M';
export type Grip = 'none' | 'low' | 'high';
export type ShoulderLoad = 'none' | 'low' | 'high';

/** Clés de `rep_ranges` (bank : format → plage). */
export type RangeFormat = 'amrap' | 'for_time' | 'emom' | 'interval';

/** [H, F] */
export type LoadPair = [number, number];
export type LoadsByBand = Record<Band, LoadPair>;

export interface CatalogMovement {
  id: string;
  name: string;
  family: Family;
  pattern: Pattern[];
  modality: Modality;
  grip: Grip;
  shoulder_load: ShoulderLoad;
  unit_default: Unit;
  units_allowed: Unit[];
  load_unit: LoadUnit | null;
  weight_functional: number;
  weight_hybrid: number;
  equipment: string[];
  /** secondes par unité, par catégorie Functional puis par unité : `{ rx: { cal: 3.6, m: 0.2 } }` */
  cadence: Partial<Record<FunctionalCategory, Partial<Record<Unit, number>>>> | null;
  /** par catégorie Functional, trois bandes [H, F] ; null sans charge */
  loads: Partial<Record<FunctionalCategory, LoadsByBand>> | null;
  /** par unité puis par format : `{ reps: { amrap: [9, 15], … } }` */
  rep_ranges: Partial<Record<Unit, Partial<Record<RangeFormat, [number, number]>>>> | null;
  substitutions: Partial<Record<FunctionalCategory, string>> | null;
  variant_up: string | null;
  badge_key: string | null;
  active: boolean;
  version: number;
  notes: string | null;
}

export interface Catalog {
  version: number;
  movements: CatalogMovement[];
}

// ─── Banque de squelettes ────────────────────────────────────────────────────

export interface SlotPick {
  family?: Family[];
  modality?: Modality[];
  pattern_any?: Pattern[];
  pattern_not?: Pattern[];
  /** ids autorisés (liste fermée) */
  ids?: string[];
  /** unité imposée (sinon `unit_default` du mouvement) */
  unit?: Unit;
  /** le pattern principal doit différer de celui du slot d'index donné */
  pattern_not_of_slot?: number;
  /** bande imposée pour ce slot (ex. barre light/medium dans un chipper) */
  band?: Band;
  /** ne pas partager `grip = high` avec le slot d'index donné */
  no_shared_high_grip_with?: number;
  /** unité à préférer quand le mouvement tiré est un erg (Hybrid : mètres) */
  erg_unit?: Unit;
}

export interface Slot {
  pick: SlotPick;
  /**
   * `range`  : tiré dans rep_ranges[unit][format], ajusté au budget ;
   * `fixed`  : quantité imposée (`fixed` ou tirée dans `fixed_range`) ;
   * `scheme` : suit le scheme du squelette ;
   * `minute` : reps = numéro de la minute (death by).
   */
  qty: 'range' | 'fixed' | 'scheme' | 'minute';
  fixed?: number;
  fixed_range?: [number, number];
  /** quantité imposée selon le mouvement tiré */
  fixed_by_id?: Record<string, number>;
  /** plage de reps imposée par le squelette (prime sur rep_ranges) */
  reps_range?: [number, number];
  /** plafond de quantité pour ce slot (ex. run ≤ 800 m dans un chipper) */
  qty_max?: number;
  /** slot facultatif : conservé seulement si le nombre de stations le demande */
  optional?: boolean;
  /** libellé de rôle (buy-in, station…) */
  role?: string;
  /** un mouvement différent par round (tirage sans remise), rendu `R1 · …` */
  rotate_per_round?: boolean;
}

export type ScoreType = 'time' | 'rounds_reps' | 'cal_total' | 'distance' | 'reps_total';

export interface SkeletonRest {
  work_s?: number | [number, number];
  rest_s?: number | [number, number];
  every_s?: number | number[];
  /** transition entre blocs (tabata) */
  transition_s?: number;
}

export interface Skeleton {
  id: string;
  discipline: Discipline;
  format: SkeletonFormat;
  durations: number[];
  intentions: Intention[];
  band_by_intention: Partial<Record<Intention, Band>>;
  slots: Slot[];
  rounds?: { min: number; max: number } | 'amrap' | 'scheme';
  scheme?: number[];
  /** scheme alternatif par bande (ex. force → 15-12-9) */
  scheme_by_band?: Partial<Record<Band, number[]>>;
  /** Schémas de repli pour caler la durée (for_time à schéma). */
  scheme_alternatives?: number[][];
  /** plafond de rounds par bande (ex. force → rounds ≤ 4) */
  max_rounds_by_band?: Partial<Record<Band, number>>;
  rest?: SkeletonRest;
  /** nombre de stations : par durée, ou plage */
  station_count?: { by_duration?: Record<number, number>; min?: number; max?: number };
  /** variantes exclusives (ex. run_intervals A/B/C) : une seule est tirée */
  variants?: SkeletonVariant[];
  score_type: ScoreType;
  cap_factor: number;
  allow_variant_up: boolean;
  stimulus: { rpe: number; note: string };
  /** en stations : pas deux ergs consécutifs */
  no_consecutive_erg?: boolean;
  /** contrainte F05 : le slot barre prend le 20 ou le 10 du scheme */
  barbell_low_scheme?: boolean;
  /** max de secondes de travail par station (emom) */
  max_station_work_s?: number;
  /** travail par intervalle ≤ fraction de every_s */
  max_work_fraction?: number;
}

export interface SkeletonVariant {
  id: string;
  slots: Slot[];
  rounds?: { min: number; max: number };
  rest?: SkeletonRest;
  scheme?: number[];
}

/**
 * Plafond de volume total par WOD pour une classe de mouvements (§5.4), à la
 * référence RX ; multiplié par `VOLUME_CAP_FACTOR[cat]` pour les autres catégories.
 * `ids` ou `family` (+ `band` pour la barre) désignent la classe.
 */
export interface MovementCap {
  label: string;
  ids?: string[];
  family?: Family;
  band?: Band;
  unit: Unit;
  rx: number;
}

export interface SkeletonBank {
  version: number;
  skeletons: Skeleton[];
  /** plafond de volume total par mouvement (qty × rounds), par catégorie et unité */
  volume_caps: Record<Discipline, Partial<Record<Category, Partial<Record<Unit, number>>>>>;
  /** plafonds par classe de mouvements (§5.4), table RX */
  movement_caps: MovementCap[];
}

// ─── Paramètres et sortie ────────────────────────────────────────────────────

export interface AfterClassContext {
  /** mouvements du WOD du jour (noms affichés ou ids catalogue) */
  day_movements: string[];
  box_wod_title?: string | null;
}

export interface GenerateParams {
  entry: Entry;
  discipline: Discipline;
  budget_min: number;
  format?: FormatChoice;
  intention: Intention;
  vest?: Vest;
  /** matériel (`rower`, `barbell`…), ids ou noms de mouvements exclus */
  exclude?: string[];
  /** 10 dernières signatures de l'athlète */
  recent_signatures?: string[];
  /** catégorie du profil (cible d'estimation) ; `rx` / `men` par défaut */
  profile_category?: Category | null;
  after_class?: AfterClassContext | null;
}

export interface GeneratedMovement {
  id: string;
  name: string;
  unit: Unit;
  qty: number;
  /** quantité par palier quand le mouvement suit un scheme (21-15-9…) ; `qty` = total */
  scheme?: number[];
  /** round auquel ce mouvement est exécuté (slot `rotate_per_round`) */
  round?: number;
  /** death by : `qty` = reps de la minute 1, +1 par minute */
  per_minute?: boolean;
  /** secondes par unité, par catégorie (rend l'estimation autonome) */
  cadence_by_category: Partial<Record<Category, number>>;
  load_band: Band | null;
  /** [H, F] en Functional ; [valeur] en Hybrid ; null sans charge */
  loads_by_category: Partial<Record<Category, number[] | null>>;
  substitutions_by_category: Partial<Record<Category, string | null>>;
  variant_by_category: Partial<Record<Category, string | null>>;
  load_unit: LoadUnit | null;
  badge_key: string | null;
}

export interface GeneratedBlock {
  kind: 'wod';
  format: SkeletonFormat;
  rounds: number | null;
  /** cap en secondes ; null quand le format est borné par le temps */
  timecap: number | null;
  scheme?: number[];
  /** ladder ouverte : paliers `start, start+step, …` jusqu'au temps ; `scheme` = paliers attendus pour la référence */
  ladder?: { start: number; step: number };
  rest?: { work_s?: number; rest_s?: number; every_s?: number; transition_s?: number };
  stations?: number;
  movements: GeneratedMovement[];
}

export interface CategoryEstimate {
  minutes: number;
  /** cible lisible (temps attendu, rounds attendus…) */
  target: string;
}

export interface DurationEstimate {
  by_category: Partial<Record<Category, CategoryEstimate>>;
  /** minutes estimées pour la catégorie de référence (`rx` / `men`) */
  reference_minutes: number;
  cap_minutes: number | null;
}

/** Type WodEditor du back-office (lib/wodFields.ts). */
export type WodType = 'for-time' | 'amrap' | 'emom' | 'tabata' | 'strength' | 'custom';

/** Colonnes partagées de l'éditeur (SharedWodColumns). */
export interface EditorColumns {
  title: string;
  description: string;
  wod_type: WodType;
  block_name: 'wod';
  time_cap_seconds: number | null;
  rounds: number | null;
  notes: string | null;
  video_url: null;
  leaderboard_enabled: boolean;
  emom_interval_minutes: number | null;
  tabata_work_seconds: number | null;
  tabata_rest_seconds: number | null;
}

export interface GeneratedWod extends EditorColumns {
  source: 'generator';
  generator: {
    version: string;
    skeleton_id: string;
    seed: number;
    catalog_version: number;
    bank_version: number;
    /** contraintes relâchées pour trouver un squelette (vide = tirage exact) */
    relaxations: string[];
    attempts: number;
  };
  discipline: Discipline;
  entry: Entry;
  intention: Intention;
  format: SkeletonFormat;
  budget_min: number;
  vest: { mode: Vest; load_kg_by_category: Partial<Record<Category, number>> } | null;
  blocks: GeneratedBlock[];
  estimate: DurationEstimate;
  stimulus: { rpe: number; note: string };
  score_type: ScoreType;
  after_class: { excluded_patterns: Pattern[]; excluded_families: Family[] } | null;
  signature: string;
}

export class NoValidWod extends Error {
  readonly reasons: Record<string, number>;
  constructor(message: string, reasons: Record<string, number>) {
    super(message);
    this.name = 'NoValidWod';
    this.reasons = reasons;
  }
}
