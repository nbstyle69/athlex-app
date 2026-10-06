let mockLocales: { languageCode: string | null; regionCode: string | null }[] = [{ languageCode: 'fr', regionCode: 'FR' }];
jest.mock('expo-localization', () => ({ getLocales: () => mockLocales }));

import i18n from '../i18n';
import { dateLocale, formatDate, formatNumber, formatTime } from '../i18n/locale';

const telephone = (languageCode: string | null, regionCode: string | null) => {
  mockLocales = [{ languageCode, regionCode }];
};

describe('dateLocale : langue de l’app, région du téléphone', () => {
  afterAll(() => i18n.changeLanguage('fr'));

  it.each([
    // app, langue du téléphone, région du téléphone → locale
    ['fr', 'fr', 'FR', 'fr-FR'],
    ['fr', 'fr', 'CA', 'fr-CA'],
    ['fr', 'fr', 'BE', 'fr-BE'],
    ['en', 'en', 'US', 'en-US'],
    ['en', 'en', 'GB', 'en-GB'],
    ['en', 'en', 'au', 'en-AU'],
    // langue du téléphone différente de celle de l'app : région par défaut
    ['en', 'fr', 'FR', 'en-GB'],
    ['fr', 'en', 'US', 'fr-FR'],
    ['en', 'de', 'DE', 'en-GB'],
    // région inconnue
    ['en', 'en', null, 'en-GB'],
    ['fr', 'fr', null, 'fr-FR'],
  ])('app %s, téléphone %s-%s → %s', async (app, lang, region, attendu) => {
    await i18n.changeLanguage(app);
    telephone(lang, region);
    expect(dateLocale()).toBe(attendu);
  });

  it('suit un changement de langue sans rechargement', async () => {
    telephone('fr', 'FR');
    const jour = new Date(2026, 9, 6);
    await i18n.changeLanguage('fr');
    expect(formatDate(jour, { day: 'numeric', month: 'long' })).toBe('6 octobre');
    await i18n.changeLanguage('en');
    expect(formatDate(jour, { day: 'numeric', month: 'long' })).toBe('6 October');
  });

  it('formatDate : ordre jour / mois selon la région', async () => {
    const jour = new Date(2026, 9, 6);
    const opts = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
    await i18n.changeLanguage('en');
    telephone('en', 'US');
    expect(formatDate(jour, opts)).toBe('10/06/2026');
    telephone('en', 'GB');
    expect(formatDate(jour, opts)).toBe('06/10/2026');
    await i18n.changeLanguage('fr');
    telephone('fr', 'FR');
    expect(formatDate(jour.toISOString(), opts)).toBe('06/10/2026');
  });

  it('formatTime : 24 h en français, 12 h aux États-Unis', async () => {
    const t = new Date(2026, 9, 6, 18, 5);
    await i18n.changeLanguage('fr');
    telephone('fr', 'FR');
    expect(formatTime(t, { hour: '2-digit', minute: '2-digit' })).toBe('18:05');
    await i18n.changeLanguage('en');
    telephone('en', 'US');
    expect(formatTime(t, { hour: '2-digit', minute: '2-digit' })).toBe('06:05 PM');
  });

  it('formatNumber : séparateurs de la langue', async () => {
    await i18n.changeLanguage('fr');
    telephone('fr', 'FR');
    expect(formatNumber(12345.5)).toBe('12 345,5');
    await i18n.changeLanguage('en');
    telephone('en', 'GB');
    expect(formatNumber(12345.5)).toBe('12,345.5');
  });
});
