import i18next from 'i18next';

import i18n from '../i18n';
import { installPluralRules } from '../i18n/pluralRules';

// Clés _one / _other (format JSON v4, celui par défaut d'i18next).
const resources = {
  fr: { translation: { reps_one: '{{count}} rep', reps_other: '{{count}} reps' } },
  en: { translation: { reps_one: '{{count}} rep', reps_other: '{{count}} reps' } },
};

async function instance() {
  const inst = i18next.createInstance();
  await inst.init({ resources, lng: 'fr', fallbackLng: 'fr', interpolation: { escapeValue: false } });
  return inst;
}

async function attendus() {
  const inst = await instance();
  const fr = [0, 1, 2].map(count => inst.t('reps', { count }));
  await inst.changeLanguage('en');
  const en = [0, 1, 2].map(count => inst.t('reps', { count }));
  return { fr, en };
}

const ATTENDU = { fr: ['0 rep', '1 rep', '2 reps'], en: ['0 reps', '1 rep', '2 reps'] };

describe('pluriels _one / _other', () => {
  it('avec Intl.PluralRules du moteur (Node)', async () => {
    expect(await attendus()).toEqual(ATTENDU);
  });

  describe('sans Intl.PluralRules (Hermes) : polyfill fr/en', () => {
    const natif = Intl.PluralRules;
    beforeEach(() => { delete (Intl as { PluralRules?: unknown }).PluralRules; });
    afterEach(() => { (Intl as { PluralRules?: unknown }).PluralRules = natif; });

    it('sans polyfill, le français se trompe sur 0 (règle par défaut d’i18next)', async () => {
      const { fr } = await attendus();
      expect(fr[0]).toBe('0 reps');
    });

    it('avec le polyfill, 0, 1 et 2 sont corrects dans les deux langues', async () => {
      expect(installPluralRules()).toBe(true);
      expect(await attendus()).toEqual(ATTENDU);
    });
  });

  it("le polyfill n'écrase pas un Intl.PluralRules existant", () => {
    const natif = Intl.PluralRules;
    expect(installPluralRules()).toBe(false);
    expect(Intl.PluralRules).toBe(natif);
  });

  it("sans Intl, rien n'est installé et Intl reste absent", () => {
    const cible: { Intl?: unknown } = {};
    expect(installPluralRules(cible)).toBe(false);
    expect('Intl' in cible).toBe(false);
  });

  it('avec un Intl sans PluralRules, la règle fr / en est installée', () => {
    const cible: { Intl?: { PluralRules?: new (l: string) => Intl.PluralRules } } = { Intl: {} };
    expect(installPluralRules(cible)).toBe(true);
    const R = cible.Intl!.PluralRules!;
    expect([0, 1, 2].map(n => new R('fr').select(n))).toEqual(['one', 'one', 'other']);
    expect([0, 1, 2].map(n => new R('en').select(n))).toEqual(['other', 'one', 'other']);
  });

  it("une clé de pluriel de l'app rend 1 et 2 en fr et en en", async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('strengthSession.repsCount', { count: 1 })).toBe('1 rep');
    expect(i18n.t('strengthSession.repsCount', { count: 2 })).toBe('2 reps');
    await i18n.changeLanguage('en');
    expect(i18n.t('strengthSession.repsCount', { count: 1 })).toBe('1 rep');
    expect(i18n.t('strengthSession.repsCount', { count: 2 })).toBe('2 reps');
    await i18n.changeLanguage('fr');
  });
});
