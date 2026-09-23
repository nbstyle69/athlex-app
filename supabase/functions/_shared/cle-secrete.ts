/**
 * La clé secrète Supabase des fonctions edge — une seule lecture pour les huit.
 *
 * Transition vers les nouvelles clés d'API (septembre 2026). La plateforme
 * injecte `SUPABASE_SECRET_KEYS`, un objet JSON indexé par nom de clé, dès que
 * des clés `sb_secret_…` existent sur le projet ; l'ancienne
 * `SUPABASE_SERVICE_ROLE_KEY` (JWT `service_role`) reste injectée tant qu'elle
 * n'est pas désactivée. On prend l'entrée `default` de la première si elle est
 * là, sinon la seconde : le même code tourne avant comme après la création des
 * nouvelles clés, et survit à la désactivation des anciennes.
 *
 * Dans un `fetch` direct, une clé `sb_secret_…` ne se passe qu'en `apikey`,
 * jamais en `Authorization: Bearer` : ce n'est pas un JWT. (`supabase-js` la
 * recopie en `Bearer`, mais la passerelle la remplace sur `/rest` et `/auth`.)
 */
export function cleSecrete(): string {
  const brut = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (brut) {
    try {
      const cle = JSON.parse(brut)?.default;
      if (typeof cle === 'string' && cle) return cle;
      console.warn('SUPABASE_SECRET_KEYS sans entrée « default » : repli sur SUPABASE_SERVICE_ROLE_KEY.');
    } catch {
      console.warn('SUPABASE_SECRET_KEYS illisible (JSON) : repli sur SUPABASE_SERVICE_ROLE_KEY.');
    }
  }
  const ancienne = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!ancienne) {
    throw new Error('Aucune clé secrète : ni SUPABASE_SECRET_KEYS.default ni SUPABASE_SERVICE_ROLE_KEY.');
  }
  return ancienne;
}
