/**
 * Exporte la banque de squelettes et la table §5.4 du package vers la migration
 * `wod_skeletons` / `wod_volume_caps` (DDL + seed, additif et rejouable).
 *
 *   npx tsx packages/wod-engine/scripts/export-bank.ts
 *
 * Le snapshot embarqué EST la source (`BANK_V1`) : pas de fichier JSON séparé
 * à maintenir, le repli hors ligne est le code TypeScript lui-même.
 */
import fs from 'fs';
import path from 'path';
import { BANK_V1, BANK_VERSION, MUSCU_BANK_VERSION, skeletonToRow, movementCapToRow, muscuSkeletonToRow } from '../src';
import type { MuscuSkeletonRow, SkeletonRow, VolumeCapRow } from '../src';

const PKG = path.resolve(__dirname, '..');
const MIGRATION = path.resolve(PKG, '../../supabase/migrations/20261212000000_wod_skeletons_volume_caps.sql');
const MUSCU_MIGRATION = path.resolve(PKG, '../../supabase/migrations/20261215000000_wod_skeletons_musculation.sql');

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const litOrNull = (s: string | null) => (s === null ? 'NULL' : lit(s));
const arr = (a: string[] | null) => (a === null ? 'NULL' : `ARRAY[${a.map(lit).join(', ')}]::text[]`);
const json = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`;

const skeletonRows: SkeletonRow[] = BANK_V1.skeletons.map((sk) => skeletonToRow(sk, BANK_VERSION));
const capRows: VolumeCapRow[] = BANK_V1.movement_caps.map((c) => movementCapToRow(c, BANK_VERSION));

const skValues = skeletonRows.map((r) =>
  `  (${lit(r.id)}, ${lit(r.discipline)}, ${lit(r.format)}, ${json(r.definition)}, ${r.active}, ${r.version})`);
const capValues = capRows.map((r) =>
  `  (${lit(r.label)}, ${arr(r.ids)}, ${litOrNull(r.family)}, ${litOrNull(r.band)}, ${lit(r.unit)}, ${r.rx_total}, ${r.active}, ${r.version})`);

const ddl = fs.readFileSync(path.join(__dirname, 'wod_bank.ddl.sql'), 'utf8');
const sql = `${ddl}
-- ── Seed : banque v${BANK_VERSION} (${skeletonRows.length} squelettes, généré par packages/wod-engine/scripts/export-bank.ts) ──
INSERT INTO public.wod_skeletons (id, discipline, format, definition, active, version)
VALUES
${skValues.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  discipline = EXCLUDED.discipline, format = EXCLUDED.format, definition = EXCLUDED.definition,
  active = EXCLUDED.active, version = EXCLUDED.version, updated_at = now();

-- ── Seed : plafonds §5.4 (${capRows.length} classes) ──
INSERT INTO public.wod_volume_caps (label, ids, family, band, unit, rx_total, active, version)
VALUES
${capValues.join(',\n')}
ON CONFLICT (label) DO UPDATE SET
  ids = EXCLUDED.ids, family = EXCLUDED.family, band = EXCLUDED.band, unit = EXCLUDED.unit,
  rx_total = EXCLUDED.rx_total, active = EXCLUDED.active, version = EXCLUDED.version, updated_at = now();
`;
fs.writeFileSync(MIGRATION, sql);
console.log(`${path.relative(process.cwd(), MIGRATION)} : ${skeletonRows.length} squelettes, ${capRows.length} plafonds (banque v${BANK_VERSION})`);

const muscuRows: MuscuSkeletonRow[] = BANK_V1.muscu_skeletons.map((sk) => muscuSkeletonToRow(sk, MUSCU_BANK_VERSION));
const muscuValues = muscuRows.map((r) =>
  `  (${lit(r.id)}, ${lit(r.discipline)}, ${lit(r.format)}, ${json(r.definition)}, ${r.active}, ${r.version})`);
const muscuDdl = fs.readFileSync(path.join(__dirname, 'wod_skeletons_muscu.ddl.sql'), 'utf8');
fs.writeFileSync(MUSCU_MIGRATION, `${muscuDdl}
-- ── Seed : squelettes musculation v${MUSCU_BANK_VERSION} (${muscuRows.length} squelettes, généré par packages/wod-engine/scripts/export-bank.ts) ──
INSERT INTO public.wod_skeletons (id, discipline, format, definition, active, version)
VALUES
${muscuValues.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  discipline = EXCLUDED.discipline, format = EXCLUDED.format, definition = EXCLUDED.definition,
  active = EXCLUDED.active, version = EXCLUDED.version, updated_at = now();
`);
console.log(`${path.relative(process.cwd(), MUSCU_MIGRATION)} : ${muscuRows.length} squelettes musculation (v${MUSCU_BANK_VERSION})`);
