#!/usr/bin/env node
/**
 * generate-badge-rules.mjs — produit `supabase/seed/badge_rules.json`.
 *
 * Le fichier canonique est la seule description des règles `mv_*` : la
 * migration l'insère dans `badge_rules`, le test jest vérifie qu'il dit la même
 * chose que le TypeScript du client, et le test SQL juge le serveur sur les
 * mêmes cas. Recopier ces 187 règles à la main aurait été la première source
 * d'écart entre les deux décisions — c'est exactement ce qui s'est produit avec
 * `mv_sdlhp`, oublié d'une liste redéclarée.
 *
 * Deux entrées, toutes deux dans le dépôt :
 *
 *   1. les CLÉS et leurs SEUILS, lus dans les `INSERT INTO badges_catalog` de
 *      `supabase/migrations/` ET de `supabase/migrations_archive/`. L'archive
 *      n'est jamais rejouée mais elle reste la définition d'origine des 147
 *      badges que le baseline (schéma seul, sans données) n'a pas repris ;
 *   2. la jonction (mouvement, unité) → préfixe et les regroupements, lus dans
 *      `src/utils/movementBadgeKeys.ts` et `src/services/gamification.ts`.
 *
 * Usage : node scripts/generate-badge-rules.mjs [--check]
 *   --check n'écrit rien et sort en erreur si le fichier sur disque diffère.
 */
import fs from 'fs';
import path from 'path';

const RACINE = path.resolve(import.meta.dirname, '..');
const SORTIE = path.join(RACINE, 'supabase', 'seed', 'badge_rules.json');

const lire = p => fs.readFileSync(path.join(RACINE, p), 'utf8');

/** Corps d'un objet littéral TS exporté, sans l'analyser entièrement. */
function blocLitteral(src, nom) {
  const i = src.indexOf(`export const ${nom}`);
  if (i < 0) throw new Error(`${nom} introuvable`);
  const d = src.indexOf('{', i);
  const f = src.indexOf('\n};', d);
  return src.slice(d, f);
}

// ── 1. Clés et seuils du catalogue ───────────────────────────────────────────

function clesDuCatalogue() {
  const dirs = ['supabase/migrations', 'supabase/migrations_archive'];
  const cles = new Set();
  for (const dir of dirs) {
    for (const f of fs.readdirSync(path.join(RACINE, dir)).filter(f => f.endsWith('.sql'))) {
      const src = lire(`${dir}/${f}`);
      // Seuls les INSERT du catalogue comptent : une clé citée dans un
      // commentaire ou dans un REVOKE n'est pas un badge publié.
      for (const bloc of src.split(/INSERT\s+INTO\s+(?:public\.)?badges_catalog/i).slice(1)) {
        const fin = bloc.indexOf(';');
        for (const [, k] of (fin < 0 ? bloc : bloc.slice(0, fin)).matchAll(/\(\s*'(mv_[a-z0-9_]+)'/g)) {
          cles.add(k);
        }
      }
    }
  }
  return [...cles].sort();
}

/** `mv_total_10k` → 10000 ; `mv_pullup_500` → 500. */
function seuilDe(cle) {
  const suffixe = cle.slice(cle.lastIndexOf('_') + 1);
  const m = suffixe.match(/^(\d+)(k?)$/);
  if (!m) throw new Error(`seuil illisible dans ${cle}`);
  return parseInt(m[1], 10) * (m[2] === 'k' ? 1000 : 1);
}

// ── 2. Jonction (mouvement, unité) → préfixe, et regroupements ───────────────

function mappingClient() {
  const src = lire('src/utils/movementBadgeKeys.ts');
  /** préfixe → { unit, movement } */
  const parPrefixe = new Map();

  for (const [, mv, p] of blocLitteral(src, 'MOVEMENT_BADGE_PREFIX').matchAll(/(\w+)\s*:\s*'([^']+)'/g)) {
    parPrefixe.set(p, { unit: 'reps', movement: mv });
  }
  for (const [, mv, corps] of blocLitteral(src, 'CARDIO_BADGE_PREFIX').matchAll(/(\w+)\s*:\s*\{([^}]*)\}/g)) {
    for (const [, u, p] of corps.matchAll(/(\w+)\s*:\s*'([^']+)'/g)) {
      parPrefixe.set(p, { unit: u, movement: mv });
    }
  }

  const rollup = new Map();
  const srcGam = lire('src/services/gamification.ts');
  for (const [, p, liste] of blocLitteral(srcGam, 'MOVEMENT_BADGE_ROLLUP').matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)) {
    rollup.set(p, [...liste.matchAll(/'([^']+)'/g)].map(m => m[1]));
  }

  return { parPrefixe, rollup };
}

/** Espace de clés canonique : les valeurs de `MOVEMENT_MAP` (`isKnownMovementKey`). */
function clesCanoniques() {
  const src = lire('src/utils/tournamentUtils.ts');
  const i = src.indexOf('const MOVEMENT_MAP');
  const d = src.indexOf('{', i);
  const f = src.indexOf('\n};', d);
  const vals = [...src.slice(d, f).matchAll(/:\s*'([^']+)'/g)].map(m => m[1]);
  return [...new Set(vals)].sort();
}

/**
 * `mv_db_lunge` n'a pas de préfixe côté client : `normalizeMovement` replie
 * « db lunge » sur `lunge`, donc ces reps alimentent `mv_lunge` et les trois
 * badges `mv_db_lunge_*` sont aujourd'hui inatteignables. Arbitrage de Nab
 * (22/09/2026) : la règle serveur dit la vérité — mouvement `db_lunge` —, et
 * c'est le repliement du client qui sera corrigé dans le lot client. Une
 * exception nominative, pas une famille ignorée en silence.
 */
const PREFIXES_SANS_MAPPING_CLIENT = new Map([
  ['mv_db_lunge', { unit: 'reps', movement: 'db_lunge' }],
]);

// ── 3. Assemblage ────────────────────────────────────────────────────────────

function regles() {
  const { parPrefixe, rollup } = mappingClient();
  const canoniques = clesCanoniques();
  const out = [];

  for (const badge_key of clesDuCatalogue()) {
    const threshold = seuilDe(badge_key);
    const prefix = badge_key.slice(0, badge_key.lastIndexOf('_'));

    // Méta-badges : ils ne portent ni mouvement ni préfixe de famille. Ils
    // lisent les mêmes lignes que le client — celles dont la clé est un
    // mouvement connu, en reps : des mètres de Row ne sont pas des répétitions.
    if (prefix === 'mv_total') {
      out.push({ badge_key, rule_kind: 'total', unit: 'reps', threshold,
                 movement_keys: canoniques, per_movement_threshold: null });
      continue;
    }
    if (prefix === 'mv_polyvalent') {
      out.push({ badge_key, rule_kind: 'polyvalent', unit: 'reps', threshold,
                 movement_keys: canoniques, per_movement_threshold: 100 });
      continue;
    }

    const def = parPrefixe.get(prefix) ?? PREFIXES_SANS_MAPPING_CLIENT.get(prefix);
    if (!def) throw new Error(`préfixe ${prefix} sans mouvement connu (badge ${badge_key})`);

    // Le regroupement ajoute des mouvements à la famille : les burpees box jump
    // comptent aussi comme burpees, les variantes de squat comme squats.
    const movement_keys = [def.movement, ...(rollup.get(prefix) ?? [])].sort();
    out.push({ badge_key, rule_kind: 'movement', unit: def.unit, threshold,
               movement_keys, per_movement_threshold: null });
  }

  // Un préfixe connu du client mais absent du catalogue n'attribuerait jamais
  // rien : le dire ici plutôt que de le découvrir sur un badge manquant.
  const couverts = new Set(out.map(r => r.badge_key.slice(0, r.badge_key.lastIndexOf('_'))));
  const orphelins = [...parPrefixe.keys()].filter(p => !couverts.has(p));
  if (orphelins.length) throw new Error(`préfixes client sans badge au catalogue : ${orphelins.join(', ')}`);

  return out;
}

const contenu = JSON.stringify({
  _lisez_moi: 'Fichier généré par scripts/generate-badge-rules.mjs — ne pas éditer à la main.',
  regles: regles(),
}, null, 2) + '\n';

/**
 * Les cas de parité sont écrits à la main dans `badge_rules_cases.json`, mais le
 * test SQL ne sait pas lire un fichier JSON : psql n'a ni `cat` portable ni
 * lecture côté serveur. On en dépose donc une copie dans un `.sql` trivial —
 * une seule valeur `jsonb` — et `--check` échoue si elle a vieilli. Même
 * mécanique que le bundle de `wod-engine` : un artefact dérivé, mais dont la
 * fraîcheur est un test.
 */
const CAS_JSON = path.join(RACINE, 'supabase', 'seed', 'badge_rules_cases.json');
const CAS_SQL = path.join(RACINE, 'supabase', 'seed', 'badge_rules_cases.sql');

const casSql = () => {
  const brut = fs.readFileSync(CAS_JSON, 'utf8');
  JSON.parse(brut); // un JSON invalide doit échouer ici, pas dans psql
  return `-- Généré par scripts/generate-badge-rules.mjs depuis badge_rules_cases.json.\n`
    + `-- Ne pas éditer : la source est le .json, ce fichier n'est qu'un transport\n`
    + `-- vers psql. Chargé par \\i depuis supabase/tests/badge_rules_mv.sql.\n`
    + `CREATE TEMP TABLE cas_parite (donnees jsonb);\n`
    + `INSERT INTO cas_parite VALUES ($cas$${brut.trimEnd()}$cas$::jsonb);\n`;
};

if (process.argv.includes('--check')) {
  const ko = [
    [SORTIE, contenu, 'badge_rules.json'],
    [CAS_SQL, casSql(), 'badge_rules_cases.sql'],
  ].filter(([f, attendu]) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '') !== attendu);
  if (ko.length) {
    console.error(`${ko.map(([, , n]) => n).join(' et ')} ne correspond plus à ses sources`
      + ' — relance `node scripts/generate-badge-rules.mjs`.');
    process.exit(1);
  }
  console.log('badge_rules.json et badge_rules_cases.sql à jour.');
} else {
  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  fs.writeFileSync(SORTIE, contenu);
  fs.writeFileSync(CAS_SQL, casSql());
  const r = JSON.parse(contenu).regles;
  const parType = r.reduce((a, x) => ({ ...a, [x.rule_kind]: (a[x.rule_kind] ?? 0) + 1 }), {});
  console.log(`${r.length} règles écrites dans supabase/seed/badge_rules.json`, parType);
  console.log('cas de parité recopiés dans supabase/seed/badge_rules_cases.sql');
}
