/**
 * AthleX — Affichage d'un WOD généré dans la langue de l'app (étude i18n « Moteur », M4).
 *
 * Règle : le texte enregistré (`generated_wods`, `box_wods`) reste en français, octet pour octet.
 * Seul l'AFFICHAGE change de langue, à partir du `wod_json` v2 du moteur, par `renderFromWodJson`.
 * La langue n'entre jamais dans le tirage : tout ce fichier travaille sur un WOD déjà tiré.
 *
 * `displayWod` est l'unique point d'entrée pour le titre, la description et les notes. Les autres
 * fonctions de ce fichier reprennent ses règles pour les morceaux que les écrans affichent à part
 * (cible, stimulus, muscles évités, ligne d'exercice, libellés du minuteur Split).
 *
 * Repli, partout : langue française, WOD qui n'est pas un `wod_json` v2 du moteur (Manager v1,
 * saisie libre, ancienne ligne) → le texte enregistré, tel quel.
 */
import i18n from '../i18n';
import {
  WOD_JSON_VERSION, banqueVers, estimateAll, exerciseLine, loadText, noteExercice, noteStimulus, renderFromWodJson,
  sideLabel, textes,
} from '../../packages/wod-engine/src';
import type {
  Category, GeneratedWod, Langue, MuscuExercise, MuscuWod, Muscle, TexteBloc,
} from '../../packages/wod-engine/src';

/** Langue de l'affichage : celle de l'app (`i18n.language`), anglais sinon français. */
export function displayLangue(): Langue {
  return i18n.language === 'en' ? 'en' : 'fr';
}

/** Le `wod_json` est-il un WOD v2 du moteur, réaffichable dans une autre langue ? */
export function isRenderable(wodJson: unknown): boolean {
  if (!wodJson || typeof wodJson !== 'object') return false;
  const j = wodJson as { v?: unknown; source?: unknown };
  return j.v === WOD_JSON_VERSION && j.source === 'generator';
}

/** Texte enregistré d'un WOD : ce que `saveGeneratedWod` / `whiteboardRows` écrivent. */
export interface TexteEnregistre {
  title: string;
  description: string;
  notes?: string | null;
}

/**
 * Titre, description et notes à afficher.
 * Français : le texte enregistré lui-même. Autre langue : le rendu du moteur, sinon le texte enregistré.
 */
export function displayWod(wodJson: unknown, saved: TexteEnregistre, langue: Langue = displayLangue()): TexteBloc {
  const enregistre: TexteBloc = { title: saved.title, description: saved.description, notes: saved.notes ?? null };
  if (langue === 'fr') return enregistre;
  return renderFromWodJson(wodJson, langue) ?? enregistre;
}

/** Première ligne de la description : l'en-tête du format (« 5 rounds for time », « Strength · … »). */
export function headerLineOf(description: string): string {
  return description.split('\n')[0] ?? '';
}

/** Texte copié ou partagé : exactement ce que l'écran affiche, dans la langue affichée. */
export function shareText(wodJson: unknown, saved: TexteEnregistre, langue: Langue = displayLangue()): { copy: string; share: string } {
  const d = displayWod(wodJson, saved, langue);
  return { copy: d.description, share: `${d.title}\n${d.description}` };
}

/** Cible estimée d'une catégorie (« 8 rounds », « 12:40 »…), dans la langue affichée. */
export function displayTarget(wod: GeneratedWod, category: Category, langue: Langue = displayLangue()): string | null {
  const fr = wod.estimate.by_category[category]?.target ?? null;
  if (langue === 'fr' || !isRenderable(wod)) return fr;
  const { estimate: _e, signature: _s, ...sans } = wod;
  return estimateAll(sans, langue).by_category[category]?.target ?? fr;
}

/** Note du stimulus (sous « Stimulus · RPE … »), dans la langue affichée. */
export function displayStimulusNote(wod: GeneratedWod | MuscuWod, langue: Langue = displayLangue()): string {
  if (langue === 'fr' || !isRenderable(wod)) return wod.stimulus.note;
  if (wod.discipline === 'musculation') {
    return wod.rendu ? noteStimulus(wod.objective, wod.rendu.stimulus, langue) : wod.stimulus.note;
  }
  return banqueVers(langue)(wod.stimulus.note);
}

/** Muscles évités après la classe : la phrase du moteur en anglais, `null` en français (l'écran garde sa clé). */
export function afterClassMusclesEn(muscles: readonly Muscle[], langue: Langue = displayLangue()): string | null {
  if (langue === 'fr' || muscles.length === 0) return null;
  return textes(langue).musculation.musclesEvites([...muscles]);
}

const COTE_CLE = { jambe: 'jambe', bras: 'bras', 'côté': 'cote' } as const;

/** « 4 × 8 / jambe » — « 4 × 8 / leg » en anglais. */
export function schemeLine(e: MuscuExercise, langue: Langue = displayLangue()): string {
  let out = `${e.sets} × ${e.reps}`;
  if (e.reps_unit !== 'reps') out += ` ${e.reps_unit}`;
  if (e.per_side) out += ` / ${textes(langue).musculation.cote[COTE_CLE[sideLabel(e)]]}`;
  return out;
}

/** Charge d'un exercice, dans la langue affichée. */
export function loadLine(e: MuscuExercise, langue: Langue = displayLangue()): string {
  return loadText(e, langue);
}

/** Note d'un exercice (variante débutant, tempo…), dans la langue affichée. */
export function exerciseNote(e: MuscuExercise, langue: Langue = displayLangue()): string {
  if (langue === 'fr' || !e.rendu) return e.notes;
  return noteExercice(e.rendu, langue);
}

/**
 * Nom d'un exercice affiché (carte de séance, étapes du minuteur Split). Les noms viennent du
 * catalogue : la PR « Données » les traduira ici, en un seul point. D'ici là, le nom enregistré,
 * dans les deux langues (aucun mot français ajouté par M4).
 */
export function exerciseName(e: Pick<MuscuExercise, 'name'>, _langue: Langue = displayLangue()): string {
  return e.name;
}

// ─── Lignes enregistrées (M5 : Whiteboard, détail de WOD, programme, historique) ─────

/** Ligne `box_wods` (ou `generated_wods` ramenée à ces colonnes) : le texte enregistré et son `wod_json`. */
export interface LigneEnregistree {
  wod_json?: unknown;
  title: string;
  description?: string | null;
  notes?: string | null;
}

/**
 * Rendu d'une ligne, dans une langue. « Ajouter au Whiteboard » pose en Musculation une ligne par
 * exercice (titre = nom, description = `exerciseLine`, note du stimulus sur la première seulement) :
 * le moteur ne rend que la séance entière, cette forme est rendue ici.
 */
function rendreLigne(wodJson: unknown, saved: TexteBloc, langue: Langue): TexteBloc | null {
  const w = wodJson as MuscuWod | GeneratedWod;
  const exercices = w.discipline === 'musculation' ? (w as MuscuWod).blocks?.[0]?.exercises : undefined;
  if (exercices?.length === 1) {
    const e = exercices[0];
    return { title: exerciseName(e, langue), description: exerciseLine(e, langue), notes: saved.notes != null ? displayStimulusNote(w, langue) : null };
  }
  const r = langue === 'fr' ? renderFromWodJson(wodJson, 'fr') : displayWod(wodJson, saved, langue);
  // `saveGeneratedWod` (coach_tip) et « Ajouter au Whiteboard » (notes) enregistrent la note du stimulus,
  // pas les notes du rendu (qui ajoutent « Score : … ») : même forme, dans la langue affichée.
  const note = (w as GeneratedWod).stimulus?.note;
  if (r && note != null && saved.notes === note) return { ...r, notes: displayStimulusNote(w as GeneratedWod, langue) };
  return r;
}

/**
 * Titre, description et notes d'une ligne enregistrée, dans la langue de l'app.
 * Français : le texte enregistré. Anglais : le rendu du moteur (par `displayWod`), seulement si le
 * rendu FRANÇAIS du même `wod_json` redonne le texte enregistré au caractère près — une ligne
 * retouchée à la main (Manager, WOD perso) garde tout son texte, titre compris. Sinon, et pour
 * tout ce qui n'est pas un v2 du moteur : le texte enregistré, tel quel.
 */
export function displayRow(row: LigneEnregistree, langue: Langue = displayLangue()): TexteBloc {
  const saved: TexteBloc = { title: row.title, description: row.description ?? '', notes: row.notes ?? null };
  if (langue === 'fr' || !isRenderable(row.wod_json)) return saved;
  const fr = rendreLigne(row.wod_json, saved, 'fr');
  if (!fr || fr.title !== saved.title || fr.description !== saved.description || fr.notes !== saved.notes) return saved;
  return rendreLigne(row.wod_json, saved, langue) ?? saved;
}

/**
 * Annotations d'affichage (≈ kg, ≈ reps, ligne cardio) sur le texte affiché. Elles sont calculées
 * sur le texte ENREGISTRÉ, ligne par ligne ; un ajout en fin de ligne (≈ kg d'une ligne %1RM, seul
 * cas que le texte du moteur produit) est reporté en fin de la ligne affichée correspondante. Autre
 * annotation (insertion, ligne réécrite), nombre de lignes différent : la ligne affichée, sans
 * annotation (en cas de doute, rien).
 */
export function annotateShown(saved: string, shown: string, annotate: (text: string) => string): string {
  if (shown === saved) return annotate(saved);
  const fr = saved.split('\n');
  const en = shown.split('\n');
  if (fr.length !== en.length) return shown;
  return en.map((ligne, i) => {
    const base = fr[i].trimEnd();
    const annotee = annotate(fr[i]);
    return annotee !== fr[i] && annotee.startsWith(base) ? ligne.trimEnd() + annotee.slice(base.length) : ligne;
  }).join('\n');
}
