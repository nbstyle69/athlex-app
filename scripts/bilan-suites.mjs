/**
 * bilan-suites.mjs — verdict de integration.yml, une fois toutes les suites jouées.
 *
 * Chaque suite du workflow porte `continue-on-error: true` et un `id` qui
 * commence par `s_` : une suite rouge n'arrête plus les suivantes. Ce script
 * lit l'issue de chaque étape (`toJSON(steps)`, passé dans ETAPES), écrit un
 * tableau par suite dans le résumé du job, et échoue s'il y a eu au moins un
 * échec — ou si aucune suite n'a tourné : un vert qui ne mesure rien est pire
 * que le rouge qu'il remplace.
 *
 * Les libellés viennent du workflow lui-même (la ligne `name:` qui précède
 * chaque `id: s_…`) : une seule source pour les noms.
 */
import { readFileSync, appendFileSync } from 'node:fs';

const etapes = JSON.parse(process.env.ETAPES ?? '{}');
const workflow = readFileSync(new URL('../.github/workflows/integration.yml', import.meta.url), 'utf8');
const libelles = new Map(
  [...workflow.matchAll(/- name: ([^\n]+)\n\s+id: (s_[\w]+)/g)].map(m => [m[2], m[1]]),
);

const lignes = [...libelles].map(([id, nom]) => ({ nom, issue: etapes[id]?.outcome ?? 'absente' }));
const rouges = lignes.filter(l => l.issue === 'failure');
const jouees = lignes.filter(l => l.issue === 'success' || l.issue === 'failure');

const icone = { success: '✅', failure: '❌', skipped: '⏭️' };
const tableau = [
  '| Suite | Issue |', '| --- | --- |',
  ...lignes.map(l => `| ${l.nom} | ${icone[l.issue] ?? '❔'} ${l.issue} |`),
  '', `**${jouees.length - rouges.length}/${jouees.length} suites vertes** (${lignes.length - jouees.length} non jouées).`,
].join('\n');

console.log(tableau);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Suites d'intégration\n\n${tableau}\n`);

if (jouees.length === 0) {
  console.error('::error::Aucune suite n\'a tourné : ce vert ne mesurerait rien.');
  process.exit(1);
}
if (rouges.length) {
  console.error(`::error::${rouges.length} suite(s) en échec : ${rouges.map(l => l.nom).join(' ; ')}`);
  process.exit(1);
}
