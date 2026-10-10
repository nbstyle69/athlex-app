import i18n from '../../i18n';

// Libellés des valeurs enregistrées en base (sports et services d'une box, catégorie
// d'un partenaire), traduits au rendu ; une valeur inconnue s'affiche telle quelle.
const SPORT_KEYS: Record<string, string> = {
  crossfit: 'training.disciplines.functional',
  functional: 'training.disciplines.functional',
  hyrox: 'training.disciplines.hybrid',
  weightlifting: 'profile.pr.categories.weightlifting',
  gymnastics: 'profile.pr.categories.gymnastics',
  hiit: 'explorer.sport.hiit',
  yoga: 'explorer.sport.yoga',
  boxing: 'explorer.sport.boxing',
  mma: 'explorer.sport.mma',
};

export const sportLabel = (sport: string): string => (SPORT_KEYS[sport] ? i18n.t(SPORT_KEYS[sport]) : sport);
export const serviceLabel = (service: string): string => i18n.t(`explorer.service.${service}`, { defaultValue: service });
export const partnerCategoryLabel = (category: string): string => i18n.t(`partners.category.${category}`, { defaultValue: category });
