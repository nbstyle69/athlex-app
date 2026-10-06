import { getLocales } from 'expo-localization';

import i18n from './index';

/**
 * Locale BCP 47 des dates et nombres affichés. Langue : celle de l'app (lue à
 * chaque appel, pour suivre un changement de langue). Région : celle du
 * téléphone s'il est réglé dans la même langue que l'app, sinon fr-FR / en-GB.
 */
export function dateLocale(): string {
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const phone = getLocales()[0];
  const region = phone?.regionCode;
  if (region && phone?.languageCode?.toLowerCase() === lang) return `${lang}-${region.toUpperCase()}`;
  return lang === 'en' ? 'en-GB' : 'fr-FR';
}

type DateInput = Date | string | number;

export function formatDate(date: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(dateLocale(), options);
}

export function formatTime(date: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleTimeString(dateLocale(), options);
}

export function formatDateTime(date: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString(dateLocale(), options);
}

export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(dateLocale(), options);
}
