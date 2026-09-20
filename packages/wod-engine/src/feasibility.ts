/**
 * Ce que le moteur SAIT servir, lu dans la table générée depuis la banque
 * (`bank/feasibility.ts`, scripts/feasibility.mjs) — pas dans les déclarations
 * des squelettes, qui promettent parfois ce qu'elles ne tiennent pas.
 *
 * L'écran du générateur s'en sert pour ne proposer que les formats que la
 * discipline et l'intention savent servir (Hybrid n'a ni EMOM ni Chipper). Un
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

/** Formats d'écran servis pour une intention (« Surprends-moi » l'est dès qu'une ligne l'est). */
export function feasibleFormats(discipline: Discipline, intention: Intention): Set<FormatChoice> {
  const served = new Set(rows(discipline).filter((r) => r.intention === intention).map((r) => r.format));
  const out = new Set<FormatChoice>(CHOICES.filter((c) => FORMAT_CHOICE_COVERS[c].some((f) => served.has(f))));
  if (served.size) out.add('surprise');
  return out;
}

/** Une combinaison intention × format est-elle servie par au moins un squelette ? */
export function combinationFeasible(discipline: Discipline, intention: Intention, format: FormatChoice): boolean {
  return feasibleFormats(discipline, intention).has(format);
}
