/**
 * Musculation de la programmation de box en plusieurs cartes (#620, #635) — fonctions PURES.
 *
 * La séance du jour est tirée comme avant (`generateMuscuWeek`) ; ces fonctions ne font que la
 * découper en cartes du Whiteboard, sans aucun appel au RNG :
 *   Échauffement · une carte par exercice, dans l'ordre de la séance · Retour au calme (tous les jours).
 * Partie d'une carte d'exercice : « Bloc principal » (`main_compound`, `secondary_compound`),
 * « Accessoires » (`isolation`, `core`, `calves`), « Tronc » pour tous les exercices du samedi.
 * La note du stimulus est sur la première carte d'exercice. Échauffement et retour au calme sont
 * choisis par la cible du jour.
 *
 * Le texte de chaque carte est celui que `renderFromWodJson` redonne de son `wod_json` : l'app le
 * réaffiche dans la langue de l'athlète, une app plus ancienne retombe sur le texte enregistré.
 */
import { movementById } from './catalog';
import { sessionSeconds } from './muscu';
import { fr } from './i18n/fr';
import type { Langue } from './i18n';
import { rendreBlocSeance } from './rendu-seance';
import type { RenduBlocSeance } from './rendu-seance';
import { renderFromWodJson } from './rendu-wod-json';
import type { Catalog, MuscuExercise, MuscuSlotRole, MuscuTarget, MuscuWod, PartieMuscu, SessionStructuredBlock } from './types';

/** Rôles du Bloc principal ; tous les autres vont aux Accessoires (hors Tronc). */
export const ROLES_PRINCIPAL: readonly MuscuSlotRole[] = ['main_compound', 'secondary_compound'];

/** Cibles de la semaine Musculation de box qui ont un échauffement et un retour au calme. */
export type CibleSemaineMuscu = keyof typeof fr.banque.musculation.echauffement;

/** Une carte de la journée, prête à devenir une ligne `box_wods` (dans l'ordre de `cartesJourMuscu`). */
export interface CarteMuscu {
  title: string;
  description: string;
  notes: string | null;
  wod_type: 'strength' | 'custom';
  block_name: 'warmup' | 'strength' | 'cooldown';
  leaderboard_enabled: false;
  wod_json: MuscuWod | SessionStructuredBlock;
}

/** Échauffement et retour au calme d'une cible, en français (texte de la banque) ; `null` hors semaine de box. */
export function lignesSeanceMuscu(target: MuscuTarget, bloc: 'echauffement' | 'retourAuCalme'): string[] | null {
  const table: Record<string, string> = fr.banque.musculation[bloc];
  return Object.prototype.hasOwnProperty.call(table, target) ? [table[target]] : null;
}

/** Secondes d'un sous-ensemble d'exercices, même calcul que la séance entière (additif par exercice). */
function secondes(catalog: Catalog, exercises: MuscuExercise[]): number {
  return sessionSeconds(exercises.flatMap((e) => {
    const m = movementById(catalog, e.id);
    return m?.muscu ? [{ sets: e.sets, reps: e.reps, rest: e.rest_s, ...(e.rendu?.tempo ? { tempo: e.rendu.tempo } : {}), m: { muscu: m.muscu } }] : [];
  }));
}

/** Partie d'un exercice : Tronc le samedi, sinon Bloc principal ou Accessoires selon son rôle. */
export function partieExercice(target: MuscuTarget, e: MuscuExercise): PartieMuscu {
  if (target === 'tronc') return 'tronc';
  return ROLES_PRINCIPAL.includes(e.role) ? 'principal' : 'accessoires';
}

/**
 * Une séance par exercice, dans l'ordre : chacune avec sa durée estimée, `rendu.partie` et
 * `rendu.premiere` (vrai sur la première). Séance sans `rendu` (pas réaffichable) : `[wod]`, inchangée.
 */
export function partiesMuscu(wod: MuscuWod, catalog: Catalog): MuscuWod[] {
  if (!wod.rendu) return [wod];
  return wod.blocks[0].exercises.map((e, i): MuscuWod => {
    const seconds = secondes(catalog, [e]);
    const w: MuscuWod = {
      ...wod,
      blocks: [{ kind: 'strength_session', exercises: [e] }],
      estimate: { minutes: Math.round(seconds / 60), seconds },
      rendu: { ...wod.rendu!, partie: partieExercice(wod.target, e), premiere: i === 0 },
    };
    // colonnes d'éditeur du JSON : celles de la carte, pas de la séance entière
    const t = renderFromWodJson(w, 'fr')!;
    return { ...w, title: t.title, description: t.description, notes: t.notes };
  });
}

function blocSeance(kind: 'warmup' | 'cooldown', target: MuscuTarget, rendu: RenduBlocSeance): SessionStructuredBlock {
  return {
    source: 'generator', discipline: 'session', kind, option_id: `muscu_${kind}_${target}`, movement: null, heavy_pattern: null,
    steps: null, complex: null, skill: null, finisher: null, gym_reps_rx: {}, v: 2, rendu,
  };
}

/** Carte Échauffement ou Retour au calme : sans score, sans grille. */
function carteSeance(kind: 'warmup' | 'cooldown', target: MuscuTarget, langue: Langue): CarteMuscu | null {
  const lignes = lignesSeanceMuscu(target, kind === 'warmup' ? 'echauffement' : 'retourAuCalme');
  if (!lignes) return null;
  const rendu: RenduBlocSeance = kind === 'warmup' ? { bloc: 'echauffement', lignes } : { bloc: 'cooldown', lignes };
  const t = rendreBlocSeance(rendu, langue);
  return { ...t, wod_type: 'custom', block_name: kind, leaderboard_enabled: false, wod_json: blocSeance(kind, target, rendu) };
}

/**
 * Cartes d'une journée Musculation, dans l'ordre : Échauffement, une carte par exercice, Retour au
 * calme. Une carte d'exercice = une `strength_session` d'un exercice.
 */
export function cartesJourMuscu(day: { target: MuscuTarget; wod: MuscuWod }, catalog: Catalog, langue: Langue = 'fr'): CarteMuscu[] {
  const muscu = partiesMuscu(day.wod, catalog).map((w): CarteMuscu => {
    const t = renderFromWodJson(w, langue)!;
    return { ...t, wod_type: 'strength', block_name: 'strength', leaderboard_enabled: false, wod_json: w };
  });
  return [carteSeance('warmup', day.target, langue), ...muscu, carteSeance('cooldown', day.target, langue)]
    .filter((c): c is CarteMuscu => c !== null);
}
