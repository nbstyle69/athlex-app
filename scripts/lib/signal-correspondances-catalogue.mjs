/**
 * Signal — et non contrôle bloquant — sur la correspondance catalogue → clés.
 *
 * `movement_stats_keys` traduit l'id d'un mouvement de `movement_catalog` en la
 * clé canonique créditée à l'athlète (migration `20270102`). Le fichier
 * canonique `supabase/seed/movement_stats_keys.json` dit quels ids ont une
 * correspondance et lesquels, connus, n'en ont pas.
 *
 * Or le catalogue est modifiable depuis le back-office admin. Un mouvement
 * ajouté en prod n'a pas de correspondance : ses lignes de WOD ne créditeraient
 * jamais rien, en silence. Ce signal le fait apparaître à l'audit nocturne.
 *
 * Il SIGNALE, il ne bloque pas (arbitrage de Nab, 23/09/2026) : ce n'est pas
 * une faille, c'est de l'entretien. Il n'ajoute donc aucune assertion au compte
 * de l'audit, et s'écrit en annotations `::warning::` que GitHub Actions affiche
 * sans faire échouer le job.
 */
import fs from 'fs';
import path from 'path';

const FICHIER = path.resolve(import.meta.dirname, '..', '..', 'supabase', 'seed', 'movement_stats_keys.json');

/**
 * @param {(sql: string) => string[][]} query  lecteur de catalogue (psql)
 * @returns {{ signaux: string[], catalogueVisible: number }} les signaux émis
 *   (vide si tout concorde) et le nombre de lignes du catalogue que le rôle voit
 */
export function signalerCorrespondancesCatalogue(query) {
  const attendu = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
  const connusSans = new Set(attendu.sans_correspondance);
  const signaux = [];

  // Un catalogue vide pour ce rôle (RLS sans policy qui le vise) rendrait le
  // signal muet à tort : « aucun mouvement sans correspondance ». On le dit.
  const catalogueVisible = Number(query(`select count(*) from public.movement_catalog`)[0]?.[0] ?? 0);
  const table = query(`select to_regclass('public.movement_stats_keys') is not null`)[0]?.[0];
  if (catalogueVisible === 0) {
    signaux.push('movement_catalog ne montre aucune ligne à ce rôle (RLS ou table vide) : le signal ne voit rien.');
  } else if (table !== 't') {
    signaux.push('movement_stats_keys absente : la migration 20270102 n\'est pas appliquée sur cette base.');
  } else {
    // Ids du catalogue prod sans correspondance, comparés à la liste attendue.
    const sansProd = query(`
      select c.id from public.movement_catalog c
        left join public.movement_stats_keys k on k.catalog_id = c.id
       where k.catalog_id is null
       order by 1
    `).map(r => r[0]);
    const nouveaux = sansProd.filter(id => !connusSans.has(id));
    if (nouveaux.length) {
      signaux.push(`${nouveaux.length} mouvement(s) du catalogue prod sans correspondance ni place dans la liste `
        + `attendue — leurs lignes de WOD ne créditeront jamais rien : ${nouveaux.join(', ')}. `
        + 'Saisir la correspondance, ou régénérer supabase/seed/movement_stats_keys.json.');
    }

    // Correspondances attendues absentes, ou différentes, en prod.
    const prod = new Map(query(`select catalog_id, stats_key from public.movement_stats_keys`)
      .map(([id, cle]) => [id, cle]));
    const ecarts = Object.entries(attendu.correspondances)
      .filter(([id, cle]) => prod.get(id) !== cle)
      .map(([id, cle]) => `${id} (attendu ${cle}, prod ${prod.get(id) ?? 'absente'})`);
    if (ecarts.length) {
      signaux.push(`${ecarts.length} correspondance(s) de la prod différente(s) du fichier canonique : ${ecarts.join(', ')}.`);
    }
  }

  for (const s of signaux) console.log(`::warning title=Correspondance catalogue::${s}`);
  if (!signaux.length) {
    console.log('  ✓ correspondance catalogue → clés conforme au fichier canonique (signal, sans assertion)');
  }
  return { signaux, catalogueVisible };
}
