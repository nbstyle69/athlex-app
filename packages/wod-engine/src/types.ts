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
  | 'carry' | 'sandbag' | 'wallball' | 'jump_rope' | 'box' | 'machine' | 'cable' | 'other';
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
  /** colonnes Musculation (`discipline_muscu`) ; null = jamais tiré en musculation */
  muscu: MuscuFields | null;
}

// ─── Musculation (catalogue) ─────────────────────────────────────────────────

export type Muscle =
  | 'pecs' | 'epaules' | 'epaules_ant' | 'epaules_post' | 'triceps' | 'dos' | 'lombaires' | 'biceps'
  | 'quadriceps' | 'ischios' | 'fessiers' | 'mollets' | 'tronc' | 'trapezes' | 'avant_bras' | 'obliques' | 'coiffe';
export type MuscuObjective = 'hypertrophie' | 'force' | 'endurance';
export type MuscuLevel = 'debutant' | 'inter' | 'avance';
export type LoadMode = '1rm' | 'rpe' | 'bodyweight';
export type RmReference = 'back_squat' | 'deadlift' | 'bench' | 'press' | 'hip_thrust';
export type MuscuUnit = 'reps' | 's' | 'm';
/** Geste : un seul exercice par groupe et par séance (M2), sauf Full body et paire compound + isolation explicite. */
export type MovementGroup =
  | 'press_h' | 'press_v' | 'pull_v' | 'row' | 'squat' | 'hinge' | 'lunge' | 'hip_ext'
  | 'curl' | 'triceps_ext' | 'fly' | 'raise' | 'shrug' | 'core_flex' | 'core_anti' | 'carry';
export const MOVEMENT_GROUPS: readonly MovementGroup[] = [
  'press_h', 'press_v', 'pull_v', 'row', 'squat', 'hinge', 'lunge', 'hip_ext',
  'curl', 'triceps_ext', 'fly', 'raise', 'shrug', 'core_flex', 'core_anti', 'carry',
];

export interface MuscuFields {
  muscle_primary: Muscle;
  muscle_secondary: string[];
  compound: boolean;
  unilateral: boolean;
  level_min: MuscuLevel;
  load_mode: LoadMode;
  rm_reference: RmReference | null;
  rm_factor: number | null;
  seconds_per_rep: number;
  setup_s: number;
  objectives: MuscuObjective[];
  rep_ranges: Partial<Record<MuscuObjective, [number, number]>>;
  weight_bodyweight: number;
  weight_box: number;
  weight_gym: number;
  /** unité des « reps » : secondes (gainage) ou mètres (carry) */
  unit: MuscuUnit;
  /** 1 = meilleur exercice principal pour le muscle (slot main_compound), 5 = dernier recours */
  priority: number;
  /**
   * Priorité propre au mode « Sans matériel » (A1). Deux modes, deux ordres :
   * une pompe classique reste devant des pompes déclinées en salle, mais sans
   * matériel c'est la variété qui prime et les options doivent se serrer pour
   * concourir. `null` = pas d'ordre spécifique, on retombe sur `priority`.
   */
  priority_bodyweight: number | null;
  movement_group: MovementGroup;
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
  /** squelettes Musculation (M1), lignes `discipline = 'musculation'` de `wod_skeletons` */
  muscu_skeletons: MuscuSkeleton[];
  /** squelettes de séance Functional / Hybrid (J1), lignes `discipline = 'session'` de `wod_skeletons` */
  session_skeletons: SessionSkeleton[];
}

// ─── Séances de box (J1) ─────────────────────────────────────────────────────

/** Jour ISO : 1 = lundi … 6 = samedi. */
export type SessionDay = 1 | 2 | 3 | 4 | 5 | 6;
export type SessionBlockName = 'strength' | 'skill' | 'building' | 'wod' | 'finisher' | 'cooldown';

/** Un pas de progression : série × reps à un % du 1RM (bloc A haltéro / force). */
export interface StrengthStep {
  sets: number;
  reps: number;
  /** % 1RM ; null = charge « propre » (montée technique) */
  percent: number | null;
  rest_s: number;
  note?: string;
}

export interface SessionBlockAOption {
  id: string;
  /** `station`, `run` et `race` sont propres à la piste Hybrid (aucun haltéro technique). */
  kind: 'weightlifting' | 'strength' | 'skill' | 'station' | 'run' | 'race' | 'compromised';
  /** mouvement de référence (id catalogue) : nom du 1RM, pattern lourd */
  movement: string;
  /** `station` : Every `every_s` × `rounds`, postes en alternance quand il y en a plusieurs */
  station?: { every_s: number; rounds: number; items: SessionStationItem[] };
  /** `run` : variantes d'intervalles en rotation par `iso_week % variants.length` */
  run?: { variants: Array<{ label: string; target: string; rest_s: number; meters: number }> };
  /**
   * `race` : enchaînement chronométré, `rounds` × (`run_m` de course + un poste).
   * `ordered` fige l'ordre et le nombre de tours (test de bloc, comparable d'une fois
   * sur l'autre) ; sinon l'ordre et le nombre de tours (`rounds_min`..`rounds_max`)
   * sont tirés par la graine, pour que deux samedis ne se ressemblent pas.
   */
  race?: {
    rounds: number;
    rounds_min?: number;
    rounds_max?: number;
    run_m: number;
    stations: SessionStationItem[];
    score: string;
    ordered?: boolean;
  };
  /** bloc chronométré : devient le bloc `wod` de la séance (classement activé) */
  timed?: boolean;
  /**
   * `compromised` : `rounds` × (un poste tenu `work_s` + une course de `run_m_min`..`run_m_max`),
   * postes tirés. Le vendredi de la piste Hybrid, dont l'identité est la course chargée.
   */
  compromised?: {
    rounds: number;
    work_s: number;
    run_m_min: number;
    run_m_max: number;
    stations: SessionStationItem[];
    target: string;
    /** distance de course de chaque round, tirée à la graine (multiples de 100 m) */
    runs?: number[];
  };
  /** effort attendu du bloc, pour le RPE de la journée (max des blocs) */
  rpe?: number;
  /** mouvements du complexe (ids catalogue), dans l'ordre ; vide en force / skill */
  complex?: string[];
  /** semaines paires / impaires (variante) ; absent = toujours éligible */
  weeks?: 'even' | 'odd';
  /** pas de progression (weightlifting / strength) */
  steps?: StrengthStep[];
  tempo?: string | null;
  /** skill : reps RX par tour, tours et intervalle ; `progression` = étapes A et B propres au skill */
  skill?: {
    reps: number;
    rounds: number;
    every_s: number;
    progression: { a: string; b: string };
    substitutions: Partial<Record<FunctionalCategory, string>>;
  };
  minutes: number;
}

export interface SessionBlockBOption {
  id: string;
  movement: string;
  /** nom affiché quand le mouvement n'est pas dans le catalogue Functional */
  name?: string;
  /** pattern du mouvement de B (≠ pattern lourd de A) */
  pattern: Pattern;
  steps: StrengthStep[];
  tempo?: string | null;
  minutes: number;
}

export interface SessionFinisherOption {
  id: string;
  /** rounds × lignes « qty mouvement » (ids catalogue) */
  rounds: number;
  family: 'core' | 'carry' | 'shoulders' | 'glutes' | 'calves' | 'breathing';
  movements: Array<{ id: string; name?: string; qty: number; unit: Unit }>;
  minutes: number;
}

/** Filtre du bloc C : ce que reçoit `generateBlocC`. */
export interface SessionBlocCFilter {
  intentions: Intention[];
  durations: number[];
  formats?: FormatChoice[];
  /** pattern lourd du bloc A exclu du bloc C ; `heavy_pattern` = déduit du mouvement A */
  pattern_not: Pattern[] | 'heavy_pattern';
  /** aucun mouvement de ces familles (S2 : pas de squat lourd = pas de barre en squat) */
  exclude?: string[];
  /**
   * Liste blanche de squelettes de bloc C (piste Hybrid) : tout le reste de la
   * discipline est passé en `skeleton_not`. Absente = toute la banque est ouverte.
   */
  skeletons?: string[];
}

/** Piste de programmation d'un squelette de séance : deux semaines types distinctes. */
export type SessionTrack = 'functional' | 'hybrid';

/** Un poste d'un bloc A Hybrid : mouvement du catalogue, quantité, unité, bande de charge. */
export interface SessionStationItem {
  id: string;
  qty: number;
  unit: Unit;
  /** bande de charge du catalogue ; absente = pas de charge affichée */
  band?: Band;
  /** libellé de repli quand le mouvement n'est pas au catalogue */
  name?: string;
  /**
   * Mouvement dont la charge est affichée, quand elle ne vient pas du mouvement lui-même :
   * un box step-up porte une hauteur en cm au catalogue, sa charge est celle des haltères.
   */
  load_from?: string;
  /** durée de travail du poste, quand il se mesure en temps plutôt qu'en quantité (bloc B de H5) */
  work_s?: number;
}

export interface SessionSkeleton {
  id: string;
  discipline: 'session';
  format: 'session';
  /** absent = `functional` : les six squelettes S1–S6 d'avant la piste Hybrid */
  track?: SessionTrack;
  day: SessionDay;
  label: string;
  budget_min: number;
  warmup: { minutes: number; lines: string[] };
  block_a: SessionBlockAOption[] | null;
  block_b: SessionBlockBOption[] | null;
  /**
   * Bloc de travail écrit, quand l'identité du jour tient à sa structure (stations du
   * mardi, course compromise du vendredi, simulation du samedi) : il devient le bloc
   * `wod` de la séance. Ses postes restent tirés à la graine.
   */
  block_work?: SessionBlockAOption[] | null;
  /** `null` = séance sans bloc tiré dans la banque partagée */
  block_c: SessionBlocCFilter | null;
  finisher: SessionFinisherOption[] | null;
  /** semaines ISO où ce squelette remplace celui du même jour (H6 complète : `% 8 === 0`) */
  weeks_modulo?: { modulo: number; equals: number };
  /** retour au calme : bloc réel de fin de séance (footing ou erg facile + étirements nommés) */
  cooldown?: { minutes: number; lines: string[] }[] | null;
  /**
   * Effort maximal admis pour la journée (max des blocs). Le moteur préfère un bloc de
   * travail qui s'y tient ; s'il n'en trouve pas, il le dit (`rpe_over_cap`).
   */
  max_rpe?: number;
}

export interface SessionParams {
  day: SessionDay;
  iso_year: number;
  iso_week: number;
  /** piste dont on tire le squelette du jour ; absente = `functional` */
  track?: SessionTrack;
  /** signatures des blocs C des 4 dernières semaines (journal) */
  recent_signatures?: string[];
  /** squelette du bloc C de la veille (règle 2 : jamais deux fois le même) */
  previous_c_skeleton?: string | null;
  /** squelette du bloc C du lendemain, quand le jour est retiré après coup (plafond gym) */
  next_c_skeleton?: string | null;
  /** patterns gym à écarter du bloc C (plafond hebdo dépassé) */
  pattern_not?: Pattern[];
  /** mouvements de bloc B déjà tirés cette semaine (jamais deux fois le même B) */
  week_b_movements?: string[];
  /** finishers de la semaine courante et des 4 dernières (journal `finisher:<id>`) */
  recent_finishers?: string[];
  exclude?: string[];
}

export interface SessionBlock extends Omit<EditorColumns, 'block_name'> {
  block_name: SessionBlockName;
  sort_order: number;
  minutes: number;
  /** contenu structuré : bloc A/B/finisher = objet ci-dessous, bloc C = `GeneratedWod` */
  wod_json: GeneratedWod | SessionStructuredBlock;
}

export interface SessionStructuredBlock {
  source: 'generator';
  discipline: 'session';
  kind: 'weightlifting' | 'strength' | 'skill' | 'building' | 'finisher' | 'station' | 'run' | 'race' | 'compromised' | 'cooldown';
  option_id: string;
  movement: string | null;
  heavy_pattern: Pattern | null;
  steps: StrengthStep[] | null;
  complex: string[] | null;
  skill: SessionBlockAOption['skill'] | null;
  finisher: SessionFinisherOption | null;
  /** reps RX comptées pour les plafonds gym de la semaine, par id */
  gym_reps_rx: Record<string, number>;
}

export interface GeneratedSession {
  source: 'generator';
  discipline: 'session';
  generator: { version: string; skeleton_id: string; seed: number; catalog_version: number; bank_version: number; relaxations: string[] };
  day: SessionDay;
  iso_year: number;
  iso_week: number;
  label: string;
  budget_min: number;
  total_minutes: number;
  heavy_pattern: Pattern | null;
  blocks: SessionBlock[];
  /** `null` pour une séance sans bloc C tiré (H6 : l'enchaînement chronométré est le bloc A) */
  bloc_c: GeneratedWod | null;
  /** reps RX par id gym sur toute la séance (A + B + C + finisher) */
  gym_reps_rx: Record<string, number>;
  /** signature du bloc C (anti-répétition 4 semaines) */
  signature: string;
  /** mouvement du bloc B retenu (null sans B) */
  block_b_movement: string | null;
  /** id du finisher retenu (null sans finisher) */
  finisher_id: string | null;
  /** effort de la journée : maximum des blocs (A, B, travail), pas du seul bloc tiré */
  rpe: number;
  /**
   * Mouvements de la séance par rôle : `a` = bloc A, `work` = bloc de travail (écrit ou
   * tiré). Sert la règle de répétition hebdomadaire : un même mouvement peut revenir dans
   * un rôle différent, jamais dans le même.
   */
  movements_by_role?: { a: string[]; work: string[] };
  /** mètres de course et d'erg de la séance (bloc A Hybrid + bloc C), règle §3.4 */
  run_meters?: number;
}

export interface WeekParams {
  iso_year: number;
  iso_week: number;
  recent_signatures?: string[];
  exclude?: string[];
  /** piste générée ; absente = `functional` */
  track?: SessionTrack;
}

export interface GeneratedWeek {
  track: SessionTrack;
  iso_year: number;
  iso_week: number;
  seed: number;
  sessions: GeneratedSession[];
  /** total RX sur la semaine : `pull` = C2B + pull-ups + T2B, `hspu` */
  gym_volume: { pull: number; hspu: number };
  relaxations: string[];
  /** journal à persister : signatures des blocs C + `finisher:<id>` (anti-répétition 4 semaines) */
  signatures: string[];
}

export interface MuscuWeekParams {
  iso_year: number;
  iso_week: number;
  equipment?: MuscuEquipment;
  level?: MuscuLevel;
  recent_signatures?: string[];
  exclude?: string[];
}

export interface MuscuWeekDay {
  day: SessionDay;
  target: MuscuTarget;
  budget_min: number;
  wod: MuscuWod;
}

export interface GeneratedMuscuWeek {
  track: 'musculation';
  iso_year: number;
  iso_week: number;
  seed: number;
  objective: MuscuObjective;
  days: MuscuWeekDay[];
  /** séries par muscle principal sur la semaine */
  sets_by_muscle: Partial<Record<Muscle, number>>;
  relaxations: string[];
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
  /**
   * B10 : records gymniques du profil, id catalogue → reps. Absent ou vide :
   * la catégorie décide seule. Renseigné : un mouvement gymnique dont le record
   * est à 0 est substitué par sa variante accessible, et le volume d'un
   * mouvement à record est borné à `GYM_RECORD_FRACTION` du record par WOD.
   */
  gym_records?: Record<string, number>;
  after_class?: AfterClassContext | null;
  /** patterns interdits à tous les mouvements (séance : pattern lourd du bloc A) */
  pattern_not?: Pattern[];
  /** squelettes interdits (séance : squelette du bloc C de la veille) */
  skeleton_not?: string[];
  /**
   * Arrondir les quantités à des valeurs lisibles sur un tableau de box : reps et
   * calories au multiple de 5, temps au multiple de 10 s. Utilisé par la programmation
   * automatique ; le générateur athlète garde ses quantités fines.
   */
  round_qty?: boolean;
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

// ─── Musculation (squelettes, paramètres, sortie) ────────────────────────────

export type MuscuTarget =
  | 'fessiers' | 'fessiers_ischios' | 'bas' | 'full_body' | 'tronc' | 'haut' | 'dos' | 'epaules' | 'bras'
  | 'pecs' | 'push' | 'pull' | 'jambes';
export type MuscuEquipment = 'none' | 'box' | 'gym';
export type MuscuSlotRole = 'main_compound' | 'secondary_compound' | 'isolation' | 'core' | 'calves';

export interface MuscuSlot {
  role: MuscuSlotRole;
  /** muscle principal attendu (un ou plusieurs) */
  muscle: Muscle | Muscle[];
  /** retiré en premier si le budget est court */
  optional?: boolean;
  /** liste fermée d'exercices préférés (relâchée si aucun n'est disponible) */
  ids?: string[];
  /** exercice unilatéral exigé (split squat, reverse lunge, step-up…) */
  unilateral?: boolean;
  /** ids jamais tirés sur ce slot (ex. back squat sur la cible Fessiers) */
  exclude_ids?: string[];
  /** groupes de geste admis sur ce slot (ex. tirage vertical) */
  groups?: MovementGroup[];
  /** isolation autorisée dans le groupe d'un compound déjà tiré (paire compound + isolation explicite, M2) */
  pair?: boolean;
}

export interface MuscuSkeleton {
  id: string;
  discipline: 'musculation';
  format: 'strength_session';
  target: MuscuTarget;
  objective: MuscuObjective;
  slots: MuscuSlot[];
}

export interface MuscuParams {
  entry: Entry;
  target: MuscuTarget;
  objective: MuscuObjective;
  /** Séance 20 · 30 · 45 · 60 ; Après ma classe 15 · 20 · 30 */
  budget_min: number;
  equipment: MuscuEquipment;
  level: MuscuLevel;
  /** matériel (`barbell`, `cable`, `leg_press`…), ids ou noms d'exercices exclus */
  exclude?: string[];
  recent_signatures?: string[];
  /**
   * Ids des exercices sortis lors des derniers tirages de l'athlète (A1).
   * En « Sans matériel », ils sont pénalisés au tirage : le catalogue y est
   * étroit, et sans cela le même exercice revient séance après séance.
   */
  recent_exercise_ids?: string[];
  /** 1RM connus (kg) par référence */
  one_rep_max?: Partial<Record<RmReference, number>> | null;
  bodyweight_kg?: number | null;
  after_class?: AfterClassContext | null;
  /** WOD de box : charges en `%1RM` (jamais de kg individuel), RPE sans référence */
  box_wod?: boolean;
  /** Séries encore disponibles par muscle avant le plafond hebdomadaire (piste box) : la séance se compose autour, sans raccourcir. */
  weekly_room?: Partial<Record<Muscle, number>> | null;
  /**
   * A2 — exercices déjà posés ailleurs dans la semaine (piste box). Un exercice
   * et son geste n'y reviennent qu'une fois ; deux tolérées si les deux séances
   * ne sont pas des jours consécutifs et que le rôle diffère.
   */
  week_seen?: WeekSeen[] | null;
  /** Jour de la séance dans la semaine (1 = lundi), pour la règle des jours consécutifs. */
  week_day?: number | null;
}

/** Une occurrence d'exercice ailleurs dans la semaine (A2). */
export interface WeekSeen {
  id: string;
  group: MovementGroup;
  day: number;
  role: string;
}

export interface MuscuLoad {
  /** `percent` : %1RM sans kg (WOD de box) */
  mode: LoadMode | 'weighted' | 'percent';
  /** S4 : exercice à l'élastique — même mode `bodyweight` (pas de kg), mais le libellé dit « élastique », pas « poids du corps ». */
  band?: true;
  kg?: number;
  percent?: number;
  rpe?: number;
  rm_reference?: RmReference;
}

export interface MuscuExercise {
  id: string;
  name: string;
  role: MuscuSlotRole;
  muscle_primary: Muscle;
  movement_group: MovementGroup;
  priority: number;
  sets: number;
  reps: number;
  reps_unit: MuscuUnit;
  per_side: boolean;
  load: MuscuLoad;
  rest_s: number;
  notes: string;
  badge_key: string | null;
  /** Exercice ajouté par le rattrapage de budget (slot `optional` ou bonus sur un muscle secondaire). */
  optional: boolean;
}

export interface StrengthSessionBlock {
  kind: 'strength_session';
  exercises: MuscuExercise[];
}

export interface MuscuWod extends EditorColumns {
  source: 'generator';
  generator: GeneratedWod['generator'];
  discipline: 'musculation';
  entry: Entry;
  target: MuscuTarget;
  objective: MuscuObjective;
  equipment: MuscuEquipment;
  level: MuscuLevel;
  budget_min: number;
  blocks: [StrengthSessionBlock];
  estimate: { minutes: number; seconds: number };
  stimulus: { rpe: number; note: string };
  score_type: 'tonnage';
  after_class: { excluded_muscles: Muscle[]; suggested_target: MuscuTarget | null } | null;
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
