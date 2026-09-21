import type { Band, Discipline, Family, MovementCap, MuscuSkeleton, SessionSkeleton, Skeleton, SkeletonBank, SkeletonFormat, Unit } from '../types';
import { BANK_V1 } from './index';

/** Ligne de `public.wod_skeletons` : la définition complète du squelette en jsonb. */
export interface SkeletonRow {
  id: string;
  discipline: Discipline;
  format: SkeletonFormat;
  definition: Skeleton & { c2c3?: Skeleton };
  active: boolean;
  version: number;
}

/** Ligne `discipline = 'musculation'` de `public.wod_skeletons` (M1). */
export interface MuscuSkeletonRow {
  id: string;
  discipline: 'musculation';
  format: 'strength_session';
  definition: MuscuSkeleton;
  active: boolean;
  version: number;
}

/** Ligne `discipline = 'session'` de `public.wod_skeletons` (J1). */
export interface SessionSkeletonRow {
  id: string;
  discipline: 'session';
  format: 'session';
  definition: SessionSkeleton;
  active: boolean;
  version: number;
}

export type AnySkeletonRow = SkeletonRow | MuscuSkeletonRow | SessionSkeletonRow;

export function isMuscuSkeletonRow(r: AnySkeletonRow): r is MuscuSkeletonRow {
  return r.discipline === 'musculation';
}

export function isSessionSkeletonRow(r: AnySkeletonRow): r is SessionSkeletonRow {
  return r.discipline === 'session';
}

export function muscuSkeletonToRow(sk: MuscuSkeleton, version: number): MuscuSkeletonRow {
  return { id: sk.id, discipline: 'musculation', format: 'strength_session', definition: sk, active: true, version };
}

export function sessionSkeletonToRow(sk: SessionSkeleton, version: number): SessionSkeletonRow {
  return { id: sk.id, discipline: 'session', format: 'session', definition: sk, active: true, version };
}

/** Ligne de `public.wod_volume_caps` : la table §5.4 (total par WOD à la référence RX). */
export interface VolumeCapRow {
  label: string;
  ids: string[] | null;
  family: Family | null;
  band: Band | null;
  unit: Unit;
  rx_total: number;
  active: boolean;
  version: number;
}

export function skeletonToRow(sk: Skeleton, version: number): SkeletonRow {
  return { id: sk.id, discipline: sk.discipline, format: sk.format, definition: sk, active: true, version };
}

export function movementCapToRow(cap: MovementCap, version: number): VolumeCapRow {
  return {
    label: cap.label,
    ids: cap.ids ?? null,
    family: cap.family ?? null,
    band: cap.band ?? null,
    unit: cap.unit,
    rx_total: cap.rx,
    active: true,
    version,
  };
}

export function movementCapFromRow(r: VolumeCapRow): MovementCap {
  const cap: MovementCap = { label: r.label, unit: r.unit, rx: Number(r.rx_total) };
  if (r.ids && r.ids.length) cap.ids = r.ids;
  if (r.family) cap.family = r.family;
  if (r.band) cap.band = r.band;
  return cap;
}

/**
 * Banque depuis les deux tables Supabase. Les plafonds par catégorie
 * (`volume_caps`, constantes) et le facteur par catégorie restent ceux du
 * snapshot embarqué. Lève si l'une des deux listes est vide : l'appelant
 * retombe alors sur `BANK_V1`.
 *
 * Les lignes sont ORDONNÉES ici : le moteur filtre les squelettes dans l'ordre
 * du tableau et `movementCapFor` retourne le PREMIER plafond qui correspond. Or
 * `select('*')` ne promet aucun ordre, et un `UPDATE` déplace les lignes dans le
 * tas : la même graine rendait un autre WOD après une simple réécriture de la
 * banque (mesuré le 21/09/2026 sur la migration 20261229 — 232 tirages sur 672
 * changés à définitions identiques).
 *
 * L'ordre canonique est celui de la banque embarquée, pas l'ordre alphabétique :
 * une base et un repli hors-ligne doivent rendre le MÊME WOD à graine égale
 * (`__tests__/rows.test.ts`). Une ligne que le snapshot ne connaît pas encore —
 * un squelette ajouté par une migration avant que le code ne parte — se range
 * après, par id, ce qui reste déterministe.
 */
const rangDans = (ids: readonly string[]): ReadonlyMap<string, number> => new Map(ids.map((id, i) => [id, i]));
const RANG_SKELETON = rangDans([
  ...BANK_V1.skeletons.map((s) => s.id),
  ...BANK_V1.muscu_skeletons.map((s) => s.id),
  ...BANK_V1.session_skeletons.map((s) => s.id),
]);
const RANG_CAP = rangDans(BANK_V1.movement_caps.map((c) => c.label));

function parRang<T>(xs: readonly T[], cle: (x: T) => string, rangs: ReadonlyMap<string, number>): T[] {
  return [...xs].sort((a, b) => {
    const ra = rangs.get(cle(a)) ?? Infinity;
    const rb = rangs.get(cle(b)) ?? Infinity;
    if (ra !== rb) return ra - rb;
    return cle(a) < cle(b) ? -1 : cle(a) > cle(b) ? 1 : 0;
  });
}

export function bankFromRows(skeletons: AnySkeletonRow[], caps: VolumeCapRow[]): SkeletonBank {
  const triees = parRang(skeletons, (r) => r.id, RANG_SKELETON);
  const metcon = triees.filter((r): r is SkeletonRow => r.active && !isMuscuSkeletonRow(r) && !isSessionSkeletonRow(r));
  const muscu = triees.filter((r): r is MuscuSkeletonRow => r.active && isMuscuSkeletonRow(r));
  const session = triees.filter((r): r is SessionSkeletonRow => r.active && isSessionSkeletonRow(r));
  const activeCaps = parRang(caps.filter((r) => r.active), (r) => r.label, RANG_CAP);
  if (metcon.length === 0 || activeCaps.length === 0) {
    throw new Error('wod_skeletons / wod_volume_caps vides');
  }
  const version = Math.max(...metcon.map((r) => r.version), ...activeCaps.map((r) => r.version));
  return {
    version,
    skeletons: metcon.map((r) => ({ ...(r.definition.c2c3 ?? r.definition), id: r.id, discipline: r.discipline, format: r.format })),
    volume_caps: BANK_V1.volume_caps,
    movement_caps: activeCaps.map(movementCapFromRow),
    // base antérieure à la migration 20261215 (aucune ligne musculation) → snapshot embarqué
    muscu_skeletons: muscu.length
      ? muscu.map((r) => ({ ...r.definition, id: r.id, discipline: 'musculation' as const, format: 'strength_session' as const }))
      : BANK_V1.muscu_skeletons,
    session_skeletons: session.length
      ? session.map((r) => ({ ...r.definition, id: r.id, discipline: 'session' as const, format: 'session' as const }))
      : BANK_V1.session_skeletons,
  };
}
