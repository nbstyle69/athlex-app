/**
 * Réaffichage d'un WOD du moteur à partir de son seul `wod_json` (étude i18n « Moteur », M3).
 *
 * `renderFromWodJson(wodJson, langue)` reconstruit le titre, la description et les notes
 * enregistrés (`box_wods`, `generated_wods`), dans la langue demandée : en français il
 * redonne le texte enregistré au caractère près. Fonction pure, sans catalogue ni base :
 * tout ce qu'il faut est dans le `wod_json` v2.
 *
 * Renvoie `null` quand le JSON n'est pas un `wod_json` v2 du moteur (ligne plus ancienne,
 * `{ version: 1, source: 'manager' }` du back-office, saisie libre) : l'affichage retombe
 * alors sur le texte enregistré.
 *
 * Lignes du Whiteboard posées par l'app (« Ajouter au Whiteboard ») : en Musculation une
 * ligne par exercice, dont la description est `exerciseLine(e)` et non la séance entière ;
 * c'est à l'app de rendre ces lignes (M5), cette fonction rend le WOD tel que le moteur l'écrit.
 */
import { render } from './render';
import { noteExercice, noteStimulus, renderMuscu } from './muscu';
import { descriptionBlocC, rendreBlocSeance } from './rendu-seance';
import type { RenduBlocSeance, TexteBloc } from './rendu-seance';
import { textes } from './i18n';
import type { Langue } from './i18n';
import type { GeneratedWod, MuscuWod } from './types';

/** Version du `wod_json` écrit par le moteur depuis M3. */
export const WOD_JSON_VERSION = 2;

export function renderFromWodJson(wodJson: unknown, langue: Langue = 'fr'): TexteBloc | null {
  if (!wodJson || typeof wodJson !== 'object') return null;
  const j = wodJson as { v?: unknown; source?: unknown; discipline?: unknown; rendu?: unknown };
  if (j.v !== WOD_JSON_VERSION || j.source !== 'generator') return null;

  if (j.discipline === 'session') return j.rendu ? rendreBlocSeance(j.rendu as RenduBlocSeance, langue) : null;

  if (j.discipline === 'musculation') {
    const w = wodJson as MuscuWod;
    const note = w.rendu ? noteStimulus(w.objective, w.rendu.stimulus, langue) : w.stimulus.note;
    const exercises = w.blocks[0].exercises.map((e) => (e.rendu ? { ...e, notes: noteExercice(e.rendu, langue) } : e));
    const copie: MuscuWod = { ...w, stimulus: { ...w.stimulus, note }, blocks: [{ ...w.blocks[0], exercises }] };
    const T = textes(langue).musculation;
    return { title: T.titre(T.cible[w.target], T.objectif[w.objective]), description: renderMuscu(copie, langue), notes: note };
  }

  if (j.discipline === 'functional' || j.discipline === 'hybrid') {
    const w = wodJson as GeneratedWod;
    const r = render(w, langue);
    return { title: r.title, description: descriptionBlocC(r.description, w.rendu?.echauffement ?? null, langue), notes: r.notes };
  }
  return null;
}
