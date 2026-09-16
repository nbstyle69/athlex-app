#!/usr/bin/env node
/* eslint-disable */
// Import de catalogue-v1.csv → snapshot TS embarqué + migration SQL + table de correspondance.
//
//   node packages/wod-engine/scripts/import-catalog.cjs
//
// Sorties (toutes régénérées, ne pas éditer à la main) :
//   packages/wod-engine/src/catalog/snapshot.ts
//   packages/wod-engine/catalog/name-alignment.md
//   supabase/migrations/20261211000000_movement_catalog.sql   (DDL + seed, appliquée en prod : inchangée)
//   supabase/migrations/20261214000000_movement_catalog_musculation.sql (colonnes + 173 exercices M1)
//   packages/wod-engine/catalog/muscu-alignment.md
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
const MUSCU_CSV_PATH = path.join(PKG, 'catalog/catalogue-musculation-v1.csv');
const MUSCU_MIGRATION = path.join(ROOT, 'supabase/migrations/20261214000000_movement_catalog_musculation.sql');

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
const MUSCU_ALIGNMENT = require(path.join(PKG, 'catalog/muscu-alignment.cjs'));

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
for (const m of movements) m.muscu = null;
const metconMovements = [...movements];

// ── catalogue musculation (M1) ───────────────────────────────────────────────
const MUSCU_OBJECTIVES = ['hypertrophie', 'force', 'endurance'];
const MUSCLE_PATTERN = {
  pecs: 'push_h', epaules: 'push_v', epaules_ant: 'push_v', epaules_post: 'pull_h', triceps: 'push_h', dos: 'pull_h',
  lombaires: 'hinge', biceps: 'pull_h', quadriceps: 'squat', ischios: 'hinge', fessiers: 'hinge', mollets: 'mono',
  tronc: 'core', trapezes: 'pull_v', avant_bras: 'carry', obliques: 'core', coiffe: 'pull_h',
};
const WEIGHTED_FAMILIES = new Set(['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'carry', 'other']);
const MOVEMENT_GROUPS = ['press_h', 'press_v', 'pull_v', 'row', 'squat', 'hinge', 'lunge', 'hip_ext', 'curl', 'triceps_ext', 'fly', 'raise', 'shrug', 'core_flex', 'core_anti', 'carry'];
const muscuRows = parseCsv(fs.readFileSync(MUSCU_CSV_PATH, 'utf8'));
const muscuMapping = [];
const muscuIds = new Set();
for (const r of muscuRows) {
  if (!r.id) continue;
  if (muscuIds.has(r.id)) throw new Error(`muscu : id dupliqué ${r.id}`);
  muscuIds.add(r.id);
  const objectives = split(r.objectives);
  const ranges = jsonOrNull(r.rep_ranges) ?? {};
  if (!objectives.length || objectives.some((o) => !MUSCU_OBJECTIVES.includes(o))) throw new Error(`${r.id}: objectives invalides`);
  for (const o of objectives) if (!Array.isArray(ranges[o]) || ranges[o].length !== 2) throw new Error(`${r.id}: rep_ranges sans plage ${o}`);
  if (r.load_mode === '1rm' && (!r.rm_reference || !r.rm_factor)) throw new Error(`${r.id}: 1rm sans référence`);
  const priority = Number(r.priority);
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) throw new Error(`${r.id}: priority hors 1-5`);
  if (!MOVEMENT_GROUPS.includes(r.movement_group)) throw new Error(`${r.id}: movement_group inconnu ${r.movement_group}`);
  const unit = /unité secondes/i.test(r.notes) ? 's' : /unité mètres/i.test(r.notes) ? 'm' : 'reps';
  const muscu = {
    muscle_primary: r.muscle_primary,
    muscle_secondary: split(r.muscle_secondary),
    compound: r.compound === 'true',
    unilateral: r.unilateral === 'true',
    level_min: r.level_min,
    load_mode: r.load_mode,
    rm_reference: r.rm_reference || null,
    rm_factor: r.rm_factor ? Number(r.rm_factor) : null,
    seconds_per_rep: Number(r.seconds_per_rep),
    setup_s: Number(r.setup_s),
    objectives,
    rep_ranges: ranges,
    weight_bodyweight: Number(r.weight_bodyweight || 0),
    weight_box: Number(r.weight_box || 0),
    weight_gym: Number(r.weight_gym || 0),
    unit,
    priority,
    movement_group: r.movement_group,
  };
  if (muscu.weight_bodyweight + muscu.weight_box + muscu.weight_gym === 0) throw new Error(`${r.id}: aucun poids de tirage`);
  const sharedId = MUSCU_ALIGNMENT[r.id];
  if (sharedId) {
    const m = byId.get(sharedId);
    if (!m) throw new Error(`muscu-alignment : ${sharedId} absent du catalogue metcon`);
    if (m.muscu) throw new Error(`muscu-alignment : ${sharedId} aligné deux fois`);
    m.muscu = muscu;
    muscuMapping.push({ csvId: r.id, csvName: r.name, id: m.id, name: m.name, status: 'partagé (colonnes ajoutées)' });
    continue;
  }
  if (byId.has(r.id)) throw new Error(`muscu : id ${r.id} déjà pris par le catalogue metcon (aligner dans muscu-alignment.cjs)`);
  if (names.has(r.name)) throw new Error(`muscu : nom « ${r.name} » déjà pris par ${names.get(r.name)} (aligner dans muscu-alignment.cjs)`);
  const family = r.family;
  const equipment = split(r.equipment);
  const weighted = WEIGHTED_FAMILIES.has(family);
  const upper = ['pecs', 'epaules', 'epaules_ant', 'triceps'].includes(r.muscle_primary);
  const m = {
    id: r.id,
    name: r.name,
    family,
    pattern: [MUSCLE_PATTERN[r.muscle_primary]],
    modality: weighted ? 'W' : 'G',
    grip: weighted ? (['dos', 'biceps', 'trapezes', 'avant_bras'].includes(r.muscle_primary) ? 'high' : 'low') : 'none',
    shoulder_load: upper ? (muscu.compound ? 'high' : 'low') : 'none',
    unit_default: unit,
    units_allowed: [unit],
    load_unit: weighted ? 'kg' : null,
    weight_functional: 0,
    weight_hybrid: 0,
    equipment,
    cadence: null,
    loads: null,
    rep_ranges: null,
    substitutions: null,
    variant_up: null,
    badge_key: badgeKeyFor(r.name, unit),
    active: true,
    version: 1,
    notes: r.notes ? `Musculation — ${r.notes}` : 'Musculation (M1) — jamais tiré en metcon',
    muscu,
  };
  if (!MUSCLE_PATTERN[r.muscle_primary]) throw new Error(`${r.id}: muscle_primary inconnu ${r.muscle_primary}`);
  movements.push(m);
  byId.set(m.id, m);
  names.set(m.name, m.id);
  muscuMapping.push({ csvId: r.id, csvName: r.name, id: m.id, name: m.name, status: 'nouveau (metcon 0/0)' });
}
const muscuMovements = movements.filter((m) => m.muscu);
if (muscuMovements.length !== muscuRows.filter((r) => r.id).length) throw new Error('muscu : compte incohérent');

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
  `Total : ${metconMovements.length} lignes — ${metconMovements.filter((m) => m.active).length} actives (CSV), ${metconMovements.filter((m) => !m.active).length} inactives (app seulement).`,
  '',
];
fs.writeFileSync(path.join(PKG, 'catalog/name-alignment.md'), md.join('\n'));

fs.writeFileSync(path.join(PKG, 'catalog/muscu-alignment.md'), [
  '# Correspondance catalogue-musculation-v1.csv ↔ movement_catalog',
  '',
  'Généré par `scripts/import-catalog.cjs`. Les lignes « partagé » reçoivent les colonnes musculation sur la ligne metcon existante (pas de seconde ligne).',
  '',
  '| id CSV | Nom CSV | id catalogue | Nom catalogue | Statut |',
  '|---|---|---|---|---|',
  ...muscuMapping.map((m) => `| \`${m.csvId}\` | ${m.csvName} | \`${m.id}\` | ${m.name} | ${m.status} |`),
  '',
  `Total : ${muscuMapping.length} exercices — ${muscuMapping.filter((m) => m.status.startsWith('partagé')).length} partagés, ${muscuMapping.filter((m) => m.status.startsWith('nouveau')).length} nouveaux.`,
  '',
].join('\n'));

// ── migration SQL ────────────────────────────────────────────────────────────
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a) => `ARRAY[${a.map(q).join(', ')}]::text[]`;
const jb = (v) => (v == null ? 'NULL' : `${q(JSON.stringify(v))}::jsonb`);
const values = metconMovements.map((m) => `  (${[
  q(m.id), q(m.name), q(m.family), arr(m.pattern), q(m.modality), q(m.grip), q(m.shoulder_load), q(m.unit_default), arr(m.units_allowed),
  q(m.load_unit), m.weight_functional, m.weight_hybrid, arr(m.equipment), jb(m.cadence), jb(m.loads), jb(m.rep_ranges), jb(m.substitutions),
  q(m.variant_up), q(m.badge_key), m.active, m.version, q(m.notes),
].join(', ')})`).join(',\n');

const ddl = fs.readFileSync(path.join(__dirname, 'movement_catalog.ddl.sql'), 'utf8');
const sql = `${ddl}
-- ── Seed : catalogue-v1 (${metconMovements.length} lignes, généré par packages/wod-engine/scripts/import-catalog.cjs) ──
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

// ── migration SQL musculation (M1) ───────────────────────────────────────────
const muscuValues = muscuMovements.map((m) => `  (${[
  q(m.id), q(m.name), q(m.family), arr(m.pattern), q(m.modality), q(m.grip), q(m.shoulder_load), q(m.unit_default), arr(m.units_allowed),
  q(m.load_unit), m.weight_functional, m.weight_hybrid, arr(m.equipment), q(m.badge_key), 'true', m.version, q(m.notes),
  'true', q(m.muscu.muscle_primary), arr(m.muscu.muscle_secondary), m.muscu.compound, m.muscu.unilateral, q(m.muscu.level_min),
  q(m.muscu.load_mode), q(m.muscu.rm_reference), m.muscu.rm_factor ?? 'NULL', m.muscu.seconds_per_rep, m.muscu.setup_s,
  arr(m.muscu.objectives), jb(m.muscu.rep_ranges), m.muscu.weight_bodyweight, m.muscu.weight_box, m.muscu.weight_gym, q(m.muscu.unit),
  m.muscu.priority, q(m.muscu.movement_group),
].join(', ')})`).join(',\n');
const muscuDdl = fs.readFileSync(path.join(__dirname, 'movement_catalog_muscu.ddl.sql'), 'utf8');
const shared = muscuMovements.filter((m) => metconMovements.includes(m)).length;
fs.writeFileSync(MUSCU_MIGRATION, `${muscuDdl}
-- ── Seed : catalogue-musculation-v1 (${muscuMovements.length} exercices, dont ${shared} déjà présents : colonnes ajoutées sur la ligne existante) ──
-- Sur conflit d'id, seules les colonnes musculation sont écrites : les colonnes metcon de prod (dont active, drapeau metcon) restent intactes.
-- Le moteur musculation ne lit pas active : un exercice se retire de la musculation par ses poids weight_* à 0.
INSERT INTO public.movement_catalog
  (id, name, family, pattern, modality, grip, shoulder_load, unit_default, units_allowed,
   load_unit, weight_functional, weight_hybrid, equipment, badge_key, active, version, notes,
   discipline_muscu, muscle_primary, muscle_secondary, compound, unilateral, level_min,
   load_mode, rm_reference, rm_factor, seconds_per_rep, setup_s,
   objectives, rep_ranges_muscu, weight_bodyweight, weight_box, weight_gym, muscu_unit,
   priority, movement_group)
VALUES
${muscuValues}
ON CONFLICT (id) DO UPDATE SET
  discipline_muscu = EXCLUDED.discipline_muscu, muscle_primary = EXCLUDED.muscle_primary,
  muscle_secondary = EXCLUDED.muscle_secondary, compound = EXCLUDED.compound, unilateral = EXCLUDED.unilateral,
  level_min = EXCLUDED.level_min, load_mode = EXCLUDED.load_mode, rm_reference = EXCLUDED.rm_reference,
  rm_factor = EXCLUDED.rm_factor, seconds_per_rep = EXCLUDED.seconds_per_rep, setup_s = EXCLUDED.setup_s,
  objectives = EXCLUDED.objectives, rep_ranges_muscu = EXCLUDED.rep_ranges_muscu,
  weight_bodyweight = EXCLUDED.weight_bodyweight, weight_box = EXCLUDED.weight_box, weight_gym = EXCLUDED.weight_gym,
  muscu_unit = EXCLUDED.muscu_unit, priority = EXCLUDED.priority, movement_group = EXCLUDED.movement_group,
  updated_at = now();
`);

console.log(`${metconMovements.length} mouvements metcon (${metconMovements.filter((m) => m.active).length} actifs) — version ${version}`);
console.log(`${muscuMovements.length} exercices musculation (${shared} partagés, ${muscuMovements.length - shared} nouveaux) → ${path.relative(ROOT, MUSCU_MIGRATION)}`);
console.log(`snapshot  : ${path.relative(ROOT, path.join(PKG, 'src/catalog/snapshot.ts'))}`);
console.log(`migration : ${path.relative(ROOT, MIGRATION)}`);
