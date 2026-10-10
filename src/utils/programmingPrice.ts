import i18n from '../i18n';
import { formatNumber } from '../i18n/locale';

/** Prix d'une offre payante : « 29€/mois » en français, « €29/month » en anglais (montant par locale.ts). */
export function programmingPrice(p: { price_cents: number; currency: string; billing: string }): string {
  const amount = formatNumber(p.price_cents / 100, { maximumFractionDigits: 0, useGrouping: false });
  const price = p.currency === 'eur' ? i18n.t('bo.programming.priceEur', { amount }) : amount;
  return p.billing === 'monthly' ? `${price}${i18n.t('bo.programming.perMonth')}` : price;
}
