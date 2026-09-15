import type { Band, Discipline, Family, MovementCap, Skeleton, SkeletonBank, SkeletonFormat, Unit } from '../types';
import { BANK_V1 } from './index';

/** Ligne de `public.wod_skeletons` : la définition complète du squelette en jsonb. */
export interface SkeletonRow {
  id: string;
  discipline: Discipline;
  format: SkeletonFormat;
  definition: Skeleton;
  active: boolean;
  version: number;
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
 */
export function bankFromRows(skeletons: SkeletonRow[], caps: VolumeCapRow[]): SkeletonBank {
  const active = skeletons.filter((r) => r.active);
  const activeCaps = caps.filter((r) => r.active);
  if (active.length === 0 || activeCaps.length === 0) {
    throw new Error('wod_skeletons / wod_volume_caps vides');
  }
  const version = Math.max(...active.map((r) => r.version), ...activeCaps.map((r) => r.version));
  return {
    version,
    skeletons: active.map((r) => ({ ...r.definition, id: r.id, discipline: r.discipline, format: r.format })),
    volume_caps: BANK_V1.volume_caps,
    movement_caps: activeCaps.map(movementCapFromRow),
  };
}
