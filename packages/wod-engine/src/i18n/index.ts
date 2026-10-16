/**
 * Langue des textes du moteur (étude i18n « Moteur », M2).
 *
 * La langue n'entre qu'au rendu : elle choisit le dictionnaire, jamais un tirage.
 * Par défaut `fr`, la langue du texte enregistré (`box_wods`, `generated_wods`,
 * sortie de `generate-box-week`).
 */
import { fr } from './fr';
import type { Textes } from './fr';
import { en, mouvements } from './en';

export type Langue = 'fr' | 'en';
export type { Textes };
export { fr, en, mouvements };
export const LANGUES: readonly Langue[] = ['fr', 'en'];

const DICTIONNAIRES: Record<Langue, Textes> = { fr, en };

export function textes(langue: Langue = 'fr'): Textes {
  return DICTIONNAIRES[langue];
}

/** Noms des mouvements par id, hors français (le français lit le nom du catalogue). */
const NOMS: Record<Exclude<Langue, 'fr'>, Readonly<Record<string, string>>> = { en: mouvements };

/**
 * Nom affiché d'un mouvement du catalogue (PR « Données » D1). Français : `nomFr`, le nom du
 * catalogue tel quel, sans dictionnaire. Autre langue : l'entrée de l'id, sinon `nomFr` (repli).
 * Affichage seul : jamais écrit, jamais relu par un parseur, jamais utilisé pour trier ou tirer.
 */
export function nomMouvement(id: string, nomFr: string, langue: Langue = 'fr'): string {
  if (langue === 'fr') return nomFr;
  const noms = NOMS[langue];
  return Object.prototype.hasOwnProperty.call(noms, id) ? noms[id] : nomFr;
}

/** Les exercices de Musculation sont des lignes du même catalogue (mêmes ids) : même nom partout. */
export const nomExercice = nomMouvement;

/**
 * Correspondances « texte français de la banque → texte de la langue », position par
 * position dans `banque` (même structure dans les deux dictionnaires). La banque lue en
 * base (`wod_skeletons`) porte le texte français : il se traduit ainsi sans clé
 * supplémentaire, et un texte inconnu (banque modifiée en base) reste tel quel.
 */
export function correspondancesBanque(langue: Langue): { table: Map<string, string>; conflits: string[] } {
  const table = new Map<string, string>();
  const conflits: string[] = [];
  const parcourir = (source: unknown, cible: unknown, chemin: string) => {
    if (typeof source === 'string') {
      if (typeof cible !== 'string') { conflits.push(`${chemin} : absent`); return; }
      const deja = table.get(source);
      if (deja !== undefined && deja !== cible) conflits.push(`${chemin} : « ${source} » → « ${deja} » ou « ${cible} »`);
      table.set(source, cible);
      return;
    }
    if (source && typeof source === 'object') {
      for (const [k, v] of Object.entries(source)) parcourir(v, (cible as Record<string, unknown> | undefined)?.[k], `${chemin}.${k}`);
    }
  };
  parcourir(fr.banque, DICTIONNAIRES[langue].banque, 'banque');
  return { table, conflits };
}

const TABLES = new Map<Langue, Map<string, string>>();

/** Traduit un texte venu de la banque (stimulus, échauffement, nom de poste…) ; identité en français. */
export function banqueVers(langue: Langue = 'fr'): (texte: string) => string {
  if (langue === 'fr') return (texte) => texte;
  let table = TABLES.get(langue);
  if (!table) { table = correspondancesBanque(langue).table; TABLES.set(langue, table); }
  const t = table;
  return (texte) => t.get(texte) ?? texte;
}
