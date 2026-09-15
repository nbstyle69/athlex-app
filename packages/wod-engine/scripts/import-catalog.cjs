#!/usr/bin/env node
/* eslint-disable */
// Import de catalogue-v1.csv → snapshot TS embarqué + migration SQL + table de correspondance.
//
//   node packages/wod-engine/scripts/import-catalog.cjs
//
// Sorties (toutes régénérées, ne pas éditer à la main) :
//   packages/wod-engine/src/catalog/snapshot.ts
//   packages/wod-engine/catalog/name-alignment.md
//   supabase/migrations/20261211000000_movement_catalog.sql   (DDL + seed)
//
// Règles (recon E4/E5, validées) :
//   - nom app conservé quand le mouvement existait déjà (name-alignment.cjs) ;
//   - nom CSV pour les nouveaux ;
//   - badge_key rempli depuis MOVEMENT_BADGE_PREFIX / CARDIO_BADGE_PREFIX via normalizeMovement ;
//   - mouvements app absents du CSV (legacy-movements.cjs) insérés avec active = false ;
//   - `Weighted Vest` n'est pas un mouvement (paramètre `vest` du générateur).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const PKG = path.resolve(__dirname, '..');
const CSV_PATH = process.argv[2] || path.join(PKG, 'catalog/catalogue-v1.csv');
const MIGRATION = path.join(ROOT, 'supabase/migrations/20261211000000_movement_catalog.sql');

// ── require hook TS (typescript est déjà une dépendance du repo via ts-jest) ──
const ts = require(path.join(ROOT, 'node_modules/typescript'));
require.extensions['.ts'] = (module, filename) => {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  module._compile(out.outputText, filename);
};
const { normalizeMovement } = require(path.join(ROOT, 'src/utils/tournamentUtils.ts'));
const { MOVEMENT_BADGE_PREFIX, CARDIO_BADGE_PREFIX } = require(path.join(ROOT, 'src/utils/movementBadgeKeys.ts'));
const { MOVEMENT_CATALOG } = require(path.join(ROOT, 'src/utils/movementsCatalog.ts'));
const NAME_ALIGNMENT = require(path.join(PKG, 'catalog/name-alignment.cjs'));
const LEGACY = require(path.join(PKG, 'catalog/legacy-movements.cjs'));

// ── CSV ──────────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1 || (r[0] ?? '').trim());
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const CATEGORIES = ['scaled', 'inter', 'rx', 'rxplus', 'elite', 'pro'];
const RANGE_FORMATS = ['amrap', 'for_time', 'emom', 'interval'];
const split = (s) => (s ? s.split('|').map((x) => x.trim()).filter(Boolean) : []);
const jsonOrNull = (s) => (s ? JSON.parse(s) : null);

function badgeKeyFor(name, unitDefault) {
  const { key } = normalizeMovement(name);
  const cardio = CARDIO_BADGE_PREFIX[key];
  if (cardio) return cardio[unitDefault] ?? Object.values(cardio)[0] ?? null;
  return MOVEMENT_BADGE_PREFIX[key] ?? MOVEMENT_BADGE_PREFIX[key.replace(/s$/, '')] ?? null;
}

function cadenceFrom(r, unitDefault, unitsAllowed) {
  const byCat = jsonOrNull(r.cadence_by_category);
  if (!byCat) return null;
  const rx = byCat.rx;
  const mRx = r.cadence_m_rx_s_per_unit ? Number(r.cadence_m_rx_s_per_unit) : null;
  const out = {};
  for (const c of CATEGORIES) {
    if (byCat[c] == null) continue;
    out[c] = { [unitDefault]: byCat[c] };
    if (mRx != null && unitsAllowed.includes('m') && unitDefault !== 'm') {
      out[c].m = Math.round((mRx * byCat[c] / rx) * 1000) / 1000;
    }
  }
  return out;
}

function repRangesFrom(r, unitDefault) {
  const raw = jsonOrNull(r.rep_ranges);
  if (!raw) return null;
  const keyed = Object.keys(raw).some((k) => RANGE_FORMATS.includes(k));
  return keyed ? { [unitDefault]: raw } : raw;
}

const csvRows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
const appNames = new Set(MOVEMENT_CATALOG.map((m) => m.name));
const movements = [];
const mapping = [];

for (const r of csvRows) {
  if (!r.id) continue;
  const csvName = r.name;
  const name = NAME_ALIGNMENT[csvName] ?? csvName;
  if (NAME_ALIGNMENT[csvName] && !appNames.has(name)) throw new Error(`name-alignment: « ${name} » absent du MOVEMENT_CATALOG app`);
  const unitDefault = r.unit_default;
  const unitsAllowed = split(r.units_allowed).length ? split(r.units_allowed) : [unitDefault];
  const badge = r.badge_key || badgeKeyFor(name, unitDefault);
  movements.push({
    id: r.id,
    name,
    family: r.family,
    pattern: split(r.pattern),
    modality: r.modality,
    grip: r.grip,
    shoulder_load: r.shoulder_load,
    unit_default: unitDefault,
    units_allowed: unitsAllowed,
    load_unit: r.load_unit || null,
    weight_functional: Number(r.weight_functional || 0),
    weight_hybrid: Number(r.weight_hybrid || 0),
    equipment: split(r.equipment),
    cadence: cadenceFrom(r, unitDefault, unitsAllowed),
    loads: jsonOrNull(r.loads),
    rep_ranges: repRangesFrom(r, unitDefault),
    substitutions: jsonOrNull(r.substitutions),
    variant_up: r.variant_up || null,
    badge_key: badge,
    active: r.active !== 'false',
    version: Number(r.version || 1),
    notes: r.notes || null,
  });
  mapping.push({ id: r.id, csv: csvName, app: name, status: appNames.has(name) ? (name === csvName ? 'identique' : 'renommé → nom app') : 'nouveau', badge: badge ?? '—' });
}

const ids = new Set(movements.map((m) => m.id));
for (const [id, name, family, pattern, modality, grip, shoulder, unit, loadUnit] of LEGACY) {
  if (ids.has(id)) throw new Error(`legacy id déjà présent : ${id}`);
  if (!appNames.has(name)) throw new Error(`legacy « ${name} » absent du MOVEMENT_CATALOG app`);
  movements.push({
    id, name, family, pattern, modality, grip, shoulder_load: shoulder, unit_default: unit, units_allowed: [unit],
    load_unit: loadUnit, weight_functional: 0, weight_hybrid: 0, equipment: family === 'barbell' ? ['barbell'] : family === 'dumbbell' ? ['dumbbell'] : [],
    cadence: null, loads: null, rep_ranges: null, substitutions: null, variant_up: null,
    badge_key: badgeKeyFor(name, unit), active: false, version: 1, notes: 'Ancien catalogue app — badges / back-office uniquement',
  });
  mapping.push({ id, csv: '—', app: name, status: 'app seulement (inactif)', badge: badgeKeyFor(name, unit) ?? '—' });
}

// ── contrôles ────────────────────────────────────────────────────────────────
const byId = new Map(movements.map((m) => [m.id, m]));
const names = new Map();
for (const m of movements) {
  if (names.has(m.name)) throw new Error(`nom dupliqué : ${m.name}`);
  names.set(m.name, m.id);
  for (const sub of Object.values(m.substitutions ?? {})) if (!byId.has(sub)) throw new Error(`${m.id}: substitution inconnue ${sub}`);
  if (m.variant_up && !byId.has(m.variant_up)) throw new Error(`${m.id}: variant_up inconnu ${m.variant_up}`);
}
const stillMissing = MOVEMENT_CATALOG.map((m) => m.name).filter((n) => !names.has(n));
if (stillMissing.length) throw new Error(`Noms app absents du catalogue final : ${stillMissing.join(', ')}`);

const version = movements.reduce((v, m) => Math.max(v, m.version), 0);

// ── snapshot TS ──────────────────────────────────────────────────────────────
const snapshot = `// Généré par scripts/import-catalog.cjs depuis catalog/catalogue-v1.csv — ne pas éditer.
import type { Catalog } from '../types';

export const CATALOG_SNAPSHOT: Catalog = ${JSON.stringify({ version, movements }, null, 2)} as Catalog;
`;
fs.writeFileSync(path.join(PKG, 'src/catalog/snapshot.ts'), snapshot);

// ── table de correspondance ──────────────────────────────────────────────────
const md = [
  '# Correspondance catalogue-v1.csv ↔ noms app',
  '',
  'Généré par `scripts/import-catalog.cjs`. Le nom app (colonne « Nom final ») est celui inséré dans `movement_catalog.name` ; le crédit de badge suit `badge_key`.',
  '',
  '| id | Nom CSV | Nom final | Statut | badge_key |',
  '|---|---|---|---|---|',
  ...mapping.map((m) => `| \`${m.id}\` | ${m.csv} | ${m.app} | ${m.status} | ${m.badge === '—' ? '—' : `\`${m.badge}\``} |`),
  '',
  `Total : ${movements.length} lignes — ${movements.filter((m) => m.active).length} actives (CSV), ${movements.filter((m) => !m.active).length} inactives (app seulement).`,
  '',
];
fs.writeFileSync(path.join(PKG, 'catalog/name-alignment.md'), md.join('\n'));

// ── migration SQL ────────────────────────────────────────────────────────────
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a) => `ARRAY[${a.map(q).join(', ')}]::text[]`;
const jb = (v) => (v == null ? 'NULL' : `${q(JSON.stringify(v))}::jsonb`);
const values = movements.map((m) => `  (${[
  q(m.id), q(m.name), q(m.family), arr(m.pattern), q(m.modality), q(m.grip), q(m.shoulder_load), q(m.unit_default), arr(m.units_allowed),
  q(m.load_unit), m.weight_functional, m.weight_hybrid, arr(m.equipment), jb(m.cadence), jb(m.loads), jb(m.rep_ranges), jb(m.substitutions),
  q(m.variant_up), q(m.badge_key), m.active, m.version, q(m.notes),
].join(', ')})`).join(',\n');

const ddl = fs.readFileSync(path.join(__dirname, 'movement_catalog.ddl.sql'), 'utf8');
const sql = `${ddl}
-- ── Seed : catalogue-v1 (${movements.length} lignes, généré par packages/wod-engine/scripts/import-catalog.cjs) ──
INSERT INTO public.movement_catalog
  (id, name, family, pattern, modality, grip, shoulder_load, unit_default, units_allowed,
   load_unit, weight_functional, weight_hybrid, equipment, cadence, loads, rep_ranges, substitutions,
   variant_up, badge_key, active, version, notes)
VALUES
${values}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, family = EXCLUDED.family, pattern = EXCLUDED.pattern, modality = EXCLUDED.modality,
  grip = EXCLUDED.grip, shoulder_load = EXCLUDED.shoulder_load, unit_default = EXCLUDED.unit_default,
  units_allowed = EXCLUDED.units_allowed, load_unit = EXCLUDED.load_unit, weight_functional = EXCLUDED.weight_functional,
  weight_hybrid = EXCLUDED.weight_hybrid, equipment = EXCLUDED.equipment, cadence = EXCLUDED.cadence, loads = EXCLUDED.loads,
  rep_ranges = EXCLUDED.rep_ranges, substitutions = EXCLUDED.substitutions, variant_up = EXCLUDED.variant_up,
  badge_key = EXCLUDED.badge_key, active = EXCLUDED.active, version = EXCLUDED.version, notes = EXCLUDED.notes,
  updated_at = now();


`;
fs.writeFileSync(MIGRATION, sql);

console.log(`${movements.length} mouvements (${movements.filter((m) => m.active).length} actifs) — version ${version}`);
console.log(`snapshot  : ${path.relative(ROOT, path.join(PKG, 'src/catalog/snapshot.ts'))}`);
console.log(`migration : ${path.relative(ROOT, MIGRATION)}`);
