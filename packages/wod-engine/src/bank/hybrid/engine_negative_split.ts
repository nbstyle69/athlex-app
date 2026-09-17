import type { Skeleton } from '../../types';

/**
 * Engine long en négative split : même trame que `engine_continuous`, segments plus
 * longs et consigne d'accélération sur la seconde moitié.
 *
 * Ajouté pour deux raisons : `engine_continuous` était le seul squelette d'engine long
 * de la banque, ce qui donnait au jeudi de la piste Hybrid une seule combinaison possible
 * (signature répétée au-delà de quatre semaines) ; et aucune durée entre 30 et 45 minutes
 * n'existait, alors que le jeudi vise 35 à 40 minutes pour tenir dans 60 minutes avec
 * l'échauffement et le retour au calme. Le générateur athlète y gagne la même variété.
 */
export const engine_negative_split: Skeleton = {
  id: 'engine_negative_split',
  discipline: 'hybrid',
  format: 'continuous',
  durations: [30, 35, 40],
  intentions: ['aerobic'],
  band_by_intention: { aerobic: 'light' },
  rounds: { min: 1, max: 5 },
  slots: [
    { pick: { ids: ['run'], unit: 'm' }, qty: 'fixed', fixed: 800 },
    { pick: { ids: ['row', 'ski_erg'], unit: 'm' }, qty: 'fixed', fixed: 750 },
    { pick: { ids: ['bike_erg'], unit: 'm' }, qty: 'fixed', fixed: 1500 },
    { pick: { ids: ['db_farmer_carry', 'sandbag_carry'], unit: 'm' }, qty: 'fixed', fixed: 200, optional: true },
  ],
  station_count: { min: 3, max: 4 },
  score_type: 'distance',
  cap_factor: 1.0,
  allow_variant_up: false,
  stimulus: {
    rpe: 6,
    note: 'Zone 3, respiration nasale tenable. Seconde moitié un cran plus vite que la première, sans jamais passer en zone 4.',
  },
};
