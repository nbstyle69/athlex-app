/**
 * Ce que le moteur SAIT servir, lu dans la table générée depuis la banque
 * (`bank/feasibility.ts`, scripts/feasibility.mjs) — pas dans les déclarations
 * des squelettes, qui promettent parfois ce qu'elles ne tiennent pas.
 *
 * L'écran du générateur s'en sert pour ne proposer que les formats que la
 * discipline connaît (Hybrid n'a ni EMOM ni Chipper) et pour griser une
 * combinaison durée × format × intention qu'aucun squelette n'aboutit. Un
 * athlète ne doit jamais pouvoir choisir ce que le moteur ne sait pas faire,
 * puis recevoir autre chose en silence (G1, G4 — 18/09/2026).
 */
import { FEASIBILITY } from './bank/feasibility';
import type { Discipline, FormatChoice, Intention, SkeletonFormat } from './types';

/** Choix d'écran → formats de squelettes qu'il couvre (miroir de `FORMAT_CHOICES` du moteur). */
export const FORMAT_CHOICE_COVERS: Record<Exclude<FormatChoice, 'surprise'>, readonly SkeletonFormat[]> = {
  amrap: ['amrap'],
  for_time: ['for_time', 'rounds_for_time', 'ladder'],
  emom: ['emom', 'death_by'],
  chipper: ['chipper'],
  stations: ['stations', 'continuous'],
  interval: ['interval', 'tabata'],
};

const CHOICES = Object.keys(FORMAT_CHOICE_COVERS) as Array<Exclude<FormatChoice, 'surprise'>>;

function rows(discipline: Discipline) {
  return FEASIBILITY.filter((r) => r.discipline === discipline && r.feasible);
}

/** Formats d'écran qu'au moins un squelette de la discipline sait servir, sur au moins une combinaison. */
export function formatsOfferedFor(discipline: Discipline): FormatChoice[] {
  const served = new Set(rows(discipline).map((r) => r.format));
  return ['surprise', ...CHOICES.filter((c) => FORMAT_CHOICE_COVERS[c].some((f) => served.has(f)))];
}

/** Formats d'écran servis pour une durée × intention précises (« Surprends-moi » l'est dès qu'une ligne l'est). */
export function feasibleFormats(discipline: Discipline, budget_min: number, intention: Intention): Set<FormatChoice> {
  const served = new Set(rows(discipline).filter((r) => r.budget_min === budget_min && r.intention === intention).map((r) => r.format));
  const out = new Set<FormatChoice>(CHOICES.filter((c) => FORMAT_CHOICE_COVERS[c].some((f) => served.has(f))));
  if (served.size) out.add('surprise');
  return out;
}

/** Durées servies pour une intention, et un format d'écran s'il est choisi. */
export function feasibleDurations(discipline: Discipline, intention: Intention, format: FormatChoice = 'surprise'): Set<number> {
  const covers = format === 'surprise' ? null : new Set(FORMAT_CHOICE_COVERS[format]);
  return new Set(rows(discipline).filter((r) => r.intention === intention && (!covers || covers.has(r.format))).map((r) => r.budget_min));
}

/** Une combinaison complète est-elle servie par au moins un squelette ? */
export function combinationFeasible(discipline: Discipline, budget_min: number, intention: Intention, format: FormatChoice): boolean {
  return feasibleFormats(discipline, budget_min, intention).has(format);
}
