import i18n from '../i18n';

// Grille AthleX Pro (abonnement gérant), en euros : seule source de ces montants dans l'app.
// Écrans et textes les reçoivent en paramètre ; affichés sur Android seulement (App Store 3.1.1).
export const ATHLEX_PRO_PRICE_EUR = { monthly: 79, annual: 749 } as const;

/** « 79€ » en français, « €79 » en anglais. */
export const athlexProPrice = (amount: number) => i18n.t('bo.programming.priceEur', { amount });
