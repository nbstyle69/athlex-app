// Hermes n'a pas Intl.PluralRules : sans lui, i18next applique « 1 = one,
// sinon other », faux en français pour 0 (« 0 rep »). Règles cardinales CLDR
// des deux langues de l'app ; installé seulement si le moteur ne l'a pas.
// ponytail: fr/en seulement, cardinal seulement ; une 3e langue ou des ordinaux
// demanderaient le paquet intl-pluralrules.

type Category = 'one' | 'other';

class FrEnPluralRules {
  private readonly fr: boolean;

  constructor(locale?: string | string[]) {
    const tag = Array.isArray(locale) ? locale[0] : locale;
    this.fr = (tag ?? '').toLowerCase().startsWith('fr');
  }

  select(n: number): Category {
    const abs = Math.abs(n);
    if (this.fr) return abs < 2 ? 'one' : 'other';
    return abs === 1 ? 'one' : 'other';
  }

  resolvedOptions() {
    return { locale: this.fr ? 'fr' : 'en', type: 'cardinal', pluralCategories: ['one', 'other'] as Category[] };
  }
}

export function installPluralRules(target: { Intl?: unknown } = globalThis as { Intl?: unknown }): boolean {
  const intl = (target.Intl ?? {}) as { PluralRules?: unknown };
  if (typeof intl.PluralRules === 'function') return false;
  intl.PluralRules = FrEnPluralRules;
  target.Intl = intl;
  return true;
}
