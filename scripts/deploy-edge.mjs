/**
 * Déploiement d'une fonction edge, depuis une copie sans les lignes type-only.
 *
 *   node scripts/deploy-edge.mjs generate-box-week            # déploie
 *   node scripts/deploy-edge.mjs generate-box-week --check    # ne déploie rien, vérifie la source
 *   node scripts/deploy-edge.mjs <nom> --check --root <dir>   # inspecte une autre copie (tests)
 *
 * Pourquoi cette copie. La CLI Supabase collecte les sources depuis l'entrée de
 * la fonction. Elle suit la directive `@deno-types` et l'`import type` de
 * `index.ts` vers `packages/wod-engine/src/index.ts`, puis les spécificateurs de
 * ce fichier — qu'elle ouvre **tels quels, sans ajouter `.ts`**. La plupart ne
 * donnent qu'un avertissement bénin (`./programming`, `./muscu`, `./session`),
 * mais `./bank` et `./catalog` sont des RÉPERTOIRES : la lecture échoue en
 * `EISDIR`, fatalement, avant même que le bundle soit téléversé.
 *
 * Ce n'est pas réparable dans le moteur : il faudrait des extensions `.ts` dans
 * les imports, que TypeScript refuse. Corriger un seul spécificateur déplace
 * l'échec sur l'autre.
 *
 * Ces lignes sont type-only, donc effacées à l'exécution : la fonction déployée
 * est identique à ce que décrit le dépôt. Le dépôt garde son type-check, la
 * production garde son comportement, et la divergence devient un artefact de
 * build reproductible au lieu d'un geste manuel qu'on oublie six mois plus tard.
 *
 * Un import de VALEUR depuis le package serait, lui, une vraie dépendance :
 * le retirer casserait la fonction. `--check` échoue dans ce cas plutôt que de
 * déployer quelque chose de cassé, et `__tests__` rejoue `--check`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** `--root` inspecte une autre copie du dépôt : le test rejoue `--check` sur des mutations. */
const iRoot = process.argv.indexOf('--root');
const root = iRoot > -1 ? path.resolve(process.argv[iRoot + 1]) : path.resolve(here, '..');

/** Chemins de sources du monorepo : tout ce qui sort du dossier de la fonction. */
const HORS_FONCTION = /(^|['"/])\.\.\/\.\.\/\.\.\//;

/**
 * Une instruction `import` / `export … from '…'`, y compris sur plusieurs
 * lignes. Le `from` non gourmand borne la capture à la première instruction.
 */
const INSTRUCTION = /^(?:import|export)\s+(type\s+)?[\s\S]*?from\s+'([^']+)';/gm;

/** Ligne `// @deno-types="…"` qui précède immédiatement un import. */
const DENO_TYPES = /^\/\/ @deno-types="([^"]+)"\n/gm;

export function analyse(source) {
  const valeur = [];
  const typeOnly = [];
  for (const m of source.matchAll(INSTRUCTION)) {
    if (!HORS_FONCTION.test(m[2])) continue;
    (m[1] ? typeOnly : valeur).push({ texte: m[0], chemin: m[2] });
  }
  const directives = [...source.matchAll(DENO_TYPES)]
    .filter((m) => HORS_FONCTION.test(m[1]))
    .map((m) => ({ texte: m[0], chemin: m[1] }));
  return { valeur, typeOnly, directives };
}

/** Source déployable : sans les directives ni les imports de types hors fonction. */
export function allege(source) {
  const { typeOnly, directives } = analyse(source);
  let out = source;
  for (const d of directives) out = out.replace(d.texte, '');
  for (const t of typeOnly) out = out.replace(t.texte, '');
  // Les retraits laissent des lignes vides consécutives là où vivaient les
  // instructions ; on les ramène à une seule pour que la copie reste lisible.
  return out.replace(/\n{3,}/g, '\n\n');
}

function copier(depuis, vers, transforme) {
  fs.mkdirSync(vers, { recursive: true });
  for (const e of fs.readdirSync(depuis, { withFileTypes: true })) {
    const a = path.join(depuis, e.name);
    const b = path.join(vers, e.name);
    if (e.isDirectory()) copier(a, b, transforme);
    else if (e.name === 'index.ts') fs.writeFileSync(b, transforme(fs.readFileSync(a, 'utf8')));
    else fs.copyFileSync(a, b);
  }
}

const nom = process.argv[2];
const check = process.argv.includes('--check');
if (!nom || nom.startsWith('--')) {
  console.error('usage : node scripts/deploy-edge.mjs <nom-de-la-fonction> [--check]');
  process.exit(2);
}

const dossier = path.join(root, 'supabase/functions', nom);
const entree = path.join(dossier, 'index.ts');
if (!fs.existsSync(entree)) {
  console.error(`fonction introuvable : supabase/functions/${nom}/index.ts`);
  process.exit(2);
}

const source = fs.readFileSync(entree, 'utf8');
const { valeur, typeOnly, directives } = analyse(source);

if (valeur.length) {
  console.error(
    `${nom}/index.ts importe des VALEURS hors du dossier de la fonction :\n` +
    valeur.map((v) => `  ${v.chemin}`).join('\n') +
    '\n\nCe script ne peut pas les retirer sans casser la fonction, et la CLI\n' +
    'Supabase ne sait pas les résoudre (voir l\'en-tête de ce fichier).\n' +
    'Passer par le bundle commité, comme wod-engine.bundle.js.',
  );
  process.exit(1);
}

const retires = directives.length + typeOnly.length;
const allegee = allege(source);
if (HORS_FONCTION.test(allegee)) {
  console.error(`${nom}/index.ts référence encore le monorepo après allègement — allègement incomplet.`);
  process.exit(1);
}

// Un import de `../_shared/` doit viser un fichier présent : la copie de
// déploiement n'emporte que ce dossier-là en plus de celui de la fonction.
const partagesManquants = [...source.matchAll(/from '\.\.\/_shared\/([^']+)'/g)]
  .map((m) => m[1])
  .filter((f) => !fs.existsSync(path.join(root, 'supabase/functions/_shared', f)));
if (partagesManquants.length) {
  console.error(`${nom}/index.ts importe un fichier partagé absent : ${partagesManquants.map((f) => `_shared/${f}`).join(', ')}`);
  process.exit(1);
}

if (check) {
  console.log(`${nom} : aucun import de valeur hors fonction, ${retires} ligne(s) type-only retirée(s) au déploiement.`);
  process.exit(0);
}

const ref = process.env.SUPABASE_PROJECT_REF
  ?? fs.readFileSync(path.join(root, 'supabase/.temp/project-ref'), 'utf8').trim();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'athlex-edge-'));
try {
  fs.mkdirSync(path.join(tmp, 'supabase/functions'), { recursive: true });
  fs.copyFileSync(path.join(root, 'supabase/config.toml'), path.join(tmp, 'supabase/config.toml'));
  copier(dossier, path.join(tmp, 'supabase/functions', nom), allege);
  // Code partagé entre fonctions (`../_shared/…`, ex. la lecture de la clé
  // secrète) : copié tel quel, la CLI le suit depuis l'entrée.
  const partage = path.join(root, 'supabase/functions/_shared');
  if (fs.existsSync(partage)) copier(partage, path.join(tmp, 'supabase/functions/_shared'), (s) => s);
  console.log(`${nom} : ${retires} ligne(s) type-only retirée(s), déploiement depuis une copie temporaire.`);
  // `--use-api` : le bundleur serveur est celui qui a été vérifié sur cette
  // fonction. Docker reste une option, mais rien ne l'a exercée ici.
  //
  // `shell: true` : depuis Node 18.20 / 20.12 / 22, `spawn` refuse un `.cmd`
  // sans shell sur Windows (EINVAL), et `npx` EST un `.cmd` là-bas. Les
  // arguments passent donc par des guillemets — le dossier temporaire peut
  // contenir une espace, un profil Windows portant souvent un prénom et un nom.
  const args = ['supabase', 'functions', 'deploy', nom, '--project-ref', ref, '--use-api', '--workdir', tmp];
  execFileSync('npx', args.map((a) => `"${a}"`), { stdio: 'inherit', cwd: root, shell: true });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
