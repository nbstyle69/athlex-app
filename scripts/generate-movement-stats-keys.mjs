#!/usr/bin/env node
/**
 * generate-movement-stats-keys.mjs — produit `supabase/seed/movement_stats_keys.json`.
 *
 * Deux espaces de clés coexistent. Les WOD de tournoi structurés
 * (`tournament_wods.movement_lines`) nomment leurs mouvements par l'id de
 * `movement_catalog` — c'est ce que manipule l'éditeur du Manager. Les cumuls
 * (`user_movement_stats`) et les règles de badges (`badge_rules`) comptent, eux,
 * des clés canoniques de l'app (`hspu`, `clean`, `kb_swing`…). Dix-neuf de ces
 * clés n'existent pas dans le catalogue.
 *
 * Le pont est calculé par la seule implémentation qui fait foi : le
 * `normalizeMovement` du client, appliqué au NOM de chaque mouvement du
 * catalogue. Le résultat est versionné, inséré par la migration dans
 * `movement_stats_keys`, et un test jest le redérive à chaque passage.
 *
 * Source du catalogue : le snapshot embarqué du moteur
 * (`packages/wod-engine/src/catalog/snapshot.ts`), identique à la prod au
 * 22/09/2026 (324 ids, mêmes noms). Un mouvement ajouté depuis le back-office
 * admin n'y est pas : c'est ce que le contrôle d'audit de la prod signale.
 *
 * Usage : node scripts/generate-movement-stats-keys.mjs [--check]
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import esbuild from 'esbuild';

const RACINE = path.resolve(import.meta.dirname, '..');
const SORTIE = path.join(RACINE, 'supabase', 'seed', 'movement_stats_keys.json');

/** Le code du client, tel quel : on le bundle plutôt que de le recopier. */
async function codeClient() {
  const r = await esbuild.build({
    entryPoints: [path.join(RACINE, 'src', 'utils', 'tournamentUtils.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stats-keys-')), 'tu.mjs');
  fs.writeFileSync(f, r.outputFiles[0].text);
  return import(pathToFileURL(f).href);
}

/** Les mouvements du snapshot : un objet JSON littéral après `CATALOG_SNAPSHOT`. */
function catalogue() {
  const src = fs.readFileSync(path.join(RACINE, 'packages/wod-engine/src/catalog/snapshot.ts'), 'utf8');
  const debut = src.indexOf('{', src.indexOf('CATALOG_SNAPSHOT'));
  return JSON.parse(src.slice(debut, src.lastIndexOf('}') + 1)).movements;
}

const { normalizeMovement, isKnownMovementKey } = await codeClient();

const correspondances = {};
const sansCorrespondance = [];
for (const m of catalogue().slice().sort((a, b) => a.id.localeCompare(b.id))) {
  const cle = normalizeMovement(m.name).key;
  if (isKnownMovementKey(cle)) correspondances[m.id] = cle;
  else sansCorrespondance.push(m.id);
}

const contenu = JSON.stringify({
  _lisez_moi: 'Fichier généré par scripts/generate-movement-stats-keys.mjs — ne pas éditer à la main. '
    + '`correspondances` : id de movement_catalog → clé canonique créditée dans user_movement_stats. '
    + '`sans_correspondance` : ids connus du catalogue qui ne créditent rien (musculation, accessoires…) ; '
    + 'un id de la prod absent des deux listes est un mouvement ajouté depuis — le contrôle d\'audit le signale.',
  correspondances,
  sans_correspondance: sansCorrespondance,
}, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const disque = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, 'utf8') : '';
  if (disque !== contenu) {
    console.error('movement_stats_keys.json ne correspond plus au catalogue ou au code du client'
      + ' — relance `node scripts/generate-movement-stats-keys.mjs`.');
    process.exit(1);
  }
  console.log('movement_stats_keys.json à jour.');
} else {
  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  fs.writeFileSync(SORTIE, contenu);
  console.log(`${Object.keys(correspondances).length} correspondances, `
    + `${sansCorrespondance.length} ids sans correspondance → supabase/seed/movement_stats_keys.json`);
}
