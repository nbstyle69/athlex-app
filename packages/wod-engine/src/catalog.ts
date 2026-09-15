import {
  Band, Catalog, CatalogMovement, Category, Discipline, FunctionalCategory, HybridCategory,
  FUNCTIONAL_CATEGORIES, HYBRID_CATEGORIES, Pattern, Unit,
} from './types';

/** Ligne `movement_catalog` telle que servie par Supabase (jsonb déjà décodé ou en texte). */
export interface CatalogRow {
  id: string;
  name: string;
  family: string;
  pattern: string[];
  modality: string;
  grip: string;
  shoulder_load: string;
  unit_default: string;
  units_allowed: string[];
  load_unit: string | null;
  weight_functional: number;
  weight_hybrid: number;
  equipment: string[];
  cadence: unknown;
  loads: unknown;
  rep_ranges: unknown;
  substitutions: unknown;
  variant_up: string | null;
  badge_key: string | null;
  active: boolean;
  version: number;
  notes: string | null;
}

function json<T>(v: unknown): T | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string') return JSON.parse(v) as T;
  return v as T;
}

export function movementFromRow(r: CatalogRow): CatalogMovement {
  return {
    id: r.id,
    name: r.name,
    family: r.family as CatalogMovement['family'],
    pattern: r.pattern as Pattern[],
    modality: r.modality as CatalogMovement['modality'],
    grip: r.grip as CatalogMovement['grip'],
    shoulder_load: r.shoulder_load as CatalogMovement['shoulder_load'],
    unit_default: r.unit_default as Unit,
    units_allowed: (r.units_allowed ?? [r.unit_default]) as Unit[],
    load_unit: (r.load_unit ?? null) as CatalogMovement['load_unit'],
    weight_functional: r.weight_functional,
    weight_hybrid: r.weight_hybrid,
    equipment: r.equipment ?? [],
    cadence: json(r.cadence),
    loads: json(r.loads),
    rep_ranges: json(r.rep_ranges),
    substitutions: json(r.substitutions),
    variant_up: r.variant_up ?? null,
    badge_key: r.badge_key ?? null,
    active: r.active,
    version: r.version,
    notes: r.notes ?? null,
  };
}

/** Construit un catalogue depuis des lignes Supabase ; `version` = max des versions de ligne. */
export function catalogFromRows(rows: CatalogRow[]): Catalog {
  const movements = rows.map(movementFromRow);
  const version = movements.reduce((v, m) => Math.max(v, m.version), 0);
  return { version, movements };
}

export function movementById(catalog: Catalog, id: string): CatalogMovement | undefined {
  return catalog.movements.find((m) => m.id === id);
}

/** Clé de comparaison de nom : minuscules, sans ponctuation, pluriel simple retiré. */
export function nameKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (/[^s]s$/.test(w) ? w.slice(0, -1) : w))
    .join(' ');
}

/** Retrouve un mouvement par id ou par nom affiché (tolérant casse / pluriel / tirets). */
export function resolveMovement(catalog: Catalog, idOrName: string): CatalogMovement | undefined {
  const byId = movementById(catalog, idOrName);
  if (byId) return byId;
  const key = nameKey(idOrName);
  return catalog.movements.find((m) => nameKey(m.name) === key);
}

export function primaryPattern(m: CatalogMovement): Pattern | undefined {
  return m.pattern[0];
}

export function isFunctionalCategory(c: Category): c is FunctionalCategory {
  return (FUNCTIONAL_CATEGORIES as readonly string[]).includes(c);
}

export function categoriesFor(discipline: Discipline): readonly Category[] {
  return discipline === 'functional' ? FUNCTIONAL_CATEGORIES : HYBRID_CATEGORIES;
}

/** Catégorie Functional portant charges et cadences d'une catégorie Hybrid (Women/Men → rx, Pro → rxplus). */
export function functionalRef(c: Category): FunctionalCategory {
  if (isFunctionalCategory(c)) return c;
  return c === 'women_pro' || c === 'men_pro' ? 'rxplus' : 'rx';
}

/** Index H/F dans une paire de charges pour une catégorie Hybrid. */
export function genderIndex(c: HybridCategory): 0 | 1 {
  return c === 'women' || c === 'women_pro' ? 1 : 0;
}

/** Charge(s) d'un mouvement pour une catégorie et une bande : [H, F] en Functional, [valeur] en Hybrid. */
export function loadsFor(m: CatalogMovement, category: Category, band: Band): number[] | null {
  if (!m.loads) return null;
  const ref = functionalRef(category);
  const byBand = m.loads[ref];
  if (!byBand) return null;
  const pair = byBand[band];
  if (!pair) return null;
  if (isFunctionalCategory(category)) return [pair[0], pair[1]];
  return [pair[genderIndex(category)]];
}

/** Secondes par unité pour une catégorie ; `undefined` si le catalogue ne la connaît pas. */
export function cadenceFor(m: CatalogMovement, category: Category, unit: Unit): number | undefined {
  if (!m.cadence) return undefined;
  return m.cadence[functionalRef(category)]?.[unit];
}

export function substitutionFor(m: CatalogMovement, category: Category): string | null {
  return m.substitutions?.[functionalRef(category)] ?? null;
}

export function weightFor(m: CatalogMovement, discipline: Discipline): number {
  return discipline === 'functional' ? m.weight_functional : m.weight_hybrid;
}
