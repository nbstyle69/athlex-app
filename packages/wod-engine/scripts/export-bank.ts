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
import {
  BANK_V1, BANK_VERSION, MUSCU_BANK_VERSION, SESSION_BANK_VERSION,
  skeletonToRow, movementCapToRow, muscuSkeletonToRow, sessionSkeletonToRow,
} from '../src';
import type { MuscuSkeletonRow, SessionSkeletonRow, Skeleton, SkeletonRow, VolumeCapRow } from '../src';

const PKG = path.resolve(__dirname, '..');
const outputIndex = process.argv.indexOf('--metcon-output');
const metconOutput = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
if (outputIndex >= 0 && !metconOutput) throw new Error('--metcon-output attend un chemin SQL');
const MIGRATION = metconOutput ? path.resolve(metconOutput) : path.resolve(PKG, '../../supabase/migrations/20261212000000_wod_skeletons_volume_caps.sql');
const MUSCU_MIGRATION = path.resolve(PKG, '../../supabase/migrations/20261215000000_wod_skeletons_musculation.sql');
const SESSION_MIGRATION = path.resolve(PKG, '../../supabase/migrations/20261217000000_wod_skeletons_session.sql');

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const litOrNull = (s: string | null) => (s === null ? 'NULL' : lit(s));
const arr = (a: string[] | null) => (a === null ? 'NULL' : `ARRAY[${a.map(lit).join(', ')}]::text[]`);
const json = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`;

const skeletonRows: SkeletonRow[] = BANK_V1.skeletons.map((sk) => skeletonToRow(sk, BANK_VERSION));
const capRows: VolumeCapRow[] = BANK_V1.movement_caps.map((c) => movementCapToRow(c, BANK_VERSION));

if (metconOutput) {
  const legacy = new Map<string, Skeleton>();
  const str = "'((?:[^']+|'')*)'";
  const insert = new RegExp(`\\(${str}, ${str}, ${str}, ${str}::jsonb, (?:true|false), \\d+\\)`, 'g');
  const update = new RegExp(`UPDATE public\\.wod_skeletons SET definition = ${str}::jsonb, version = \\d+[^;]*?WHERE id = ${str}`, 'g');
  for (const name of ['20261212000000_wod_skeletons_volume_caps.sql', '20261222000000_auto_programming_tracks_hybrid.sql', '20261225000000_wod_skeletons_jump_rope_slots.sql']) {
    const source = fs.readFileSync(path.join(path.dirname(MIGRATION), name), 'utf8');
    for (const m of source.matchAll(insert)) legacy.set(m[1], JSON.parse(m[4].replace(/''/g, "'")) as Skeleton);
    for (const m of source.matchAll(update)) legacy.set(m[2], JSON.parse(m[1].replace(/''/g, "'")) as Skeleton);
  }
  for (const row of skeletonRows) {
    row.definition = { ...(legacy.get(row.id) ?? { ...row.definition, durations: [] }), c2c3: row.definition };
  }
}

const skValues = skeletonRows.map((r) =>
  `  (${lit(r.id)}, ${lit(r.discipline)}, ${lit(r.format)}, ${json(r.definition)}, ${r.active}, ${r.version})`);
const capValues = capRows.map((r) =>
  `  (${lit(r.label)}, ${arr(r.ids)}, ${litOrNull(r.family)}, ${litOrNull(r.band)}, ${lit(r.unit)}, ${r.rx_total}, ${r.active}, ${r.version})`);

const ddl = metconOutput
  ? '-- C2+C3 — banque metcon v4. appliquée en prod : non\n-- Appliquer avant merge / OTA 1.0.55. Les anciens lecteurs gardent les définitions v3.\n-- Le nouveau lecteur utilise definition.c2c3 ; les nouveaux squelettes ont durations=[] pour les anciens lecteurs.\nBEGIN;\n'
  : fs.readFileSync(path.join(__dirname, 'wod_bank.ddl.sql'), 'utf8');
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
fs.writeFileSync(MIGRATION, sql + (metconOutput ? '\nCOMMIT;\n' : ''));
console.log(`${path.relative(process.cwd(), MIGRATION)} : ${skeletonRows.length} squelettes, ${capRows.length} plafonds (banque v${BANK_VERSION})`);

if (!metconOutput) {
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

const sessionRows: SessionSkeletonRow[] = BANK_V1.session_skeletons.map((sk) => sessionSkeletonToRow(sk, SESSION_BANK_VERSION));
const sessionValues = sessionRows.map((r) =>
  `  (${lit(r.id)}, ${lit(r.discipline)}, ${lit(r.format)}, ${json(r.definition)}, ${r.active}, ${r.version})`);
const sessionDdl = fs.readFileSync(path.join(__dirname, 'wod_skeletons_session.ddl.sql'), 'utf8');
fs.writeFileSync(SESSION_MIGRATION, `${sessionDdl}
-- ── Seed : squelettes de séance v${SESSION_BANK_VERSION} (${sessionRows.length} squelettes, généré par packages/wod-engine/scripts/export-bank.ts) ──
INSERT INTO public.wod_skeletons (id, discipline, format, definition, active, version)
VALUES
${sessionValues.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  discipline = EXCLUDED.discipline, format = EXCLUDED.format, definition = EXCLUDED.definition,
  active = EXCLUDED.active, version = EXCLUDED.version, updated_at = now();
`);
console.log(`${path.relative(process.cwd(), SESSION_MIGRATION)} : ${sessionRows.length} squelettes de séance (v${SESSION_BANK_VERSION})`);
}
