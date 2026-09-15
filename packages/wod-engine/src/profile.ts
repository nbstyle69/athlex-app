import type { Category, Discipline } from './types';

/**
 * Catégorie moteur depuis le profil app : `rx+` → `rxplus`, Hybrid dérivée du
 * genre (`gender` absent ⇒ Men, estimation seulement). Retourne la référence
 * (`rx` / `men`) quand la valeur est inconnue.
 */
export function profileCategory(
  discipline: Discipline,
  level: string | null | undefined,
  gender: 'male' | 'female' | null | undefined,
): Category {
  const lv = (level ?? '').toLowerCase().replace(/\s+/g, '');
  if (discipline === 'functional') {
    const map: Record<string, Category> = {
      scaled: 'scaled', inter: 'inter', intermediate: 'inter', rx: 'rx', 'rx+': 'rxplus', rxplus: 'rxplus',
      elite: 'elite', pro: 'pro',
    };
    return map[lv] ?? 'rx';
  }
  const pro = lv === 'pro' || lv === 'rx+' || lv === 'rxplus' || lv === 'elite' || lv.endsWith('pro');
  const women = gender === 'female' || lv.startsWith('women');
  if (women) return pro ? 'women_pro' : 'women';
  return pro ? 'men_pro' : 'men';
}
