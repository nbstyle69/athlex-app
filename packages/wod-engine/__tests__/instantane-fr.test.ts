/**
 * Instantané du texte français du moteur (i18n, étape « Moteur », PR M0).
 *
 * Le texte français est le texte ENREGISTRÉ (`box_wods`, `generated_wods`, sortie de
 * `generate-box-week`) : ses empreintes, relevées sur master avant toute modification du
 * moteur, ne changent jamais sans décision. Méthode et régénération : `instantane/instantane.ts`.
 */
import { decrireInstantane } from './instantane/instantane';

decrireInstantane('fr', 'instantané du texte français du moteur (M0)');
