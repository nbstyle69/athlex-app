/**
 * Quelle clé Supabase le bundle embarque-t-il ? — partagé par les trois
 * garde-fous de livraison (`ota-`, `ipa-`, `aab-verify-bundle.mjs`).
 *
 * Transition vers les nouvelles clés d'API (septembre 2026) : la clé publique
 * passe du JWT `anon` à une clé opaque `sb_publishable_…`. Pendant la
 * transition, les deux sont acceptées. Ce qui est TOUJOURS refusé, quelle que
 * soit la clé publique trouvée : une clé secrète dans le bundle, sous l'une ou
 * l'autre forme (`sb_secret_…`, JWT `role=service_role`). Un bundle est public :
 * une clé secrète embarquée donne à qui l'ouvre tous les droits sur la base.
 *
 * Aucune valeur n'est jamais écrite : seulement des longueurs et des rôles.
 *
 * @param {string} js  le bundle (texte, ou table de chaînes Hermes lue en utf8)
 * @returns {{ name: string, ok: boolean, detail: string }[]}
 */
export function verifierCleSupabase(js) {
  const checks = [];
  const check = (name, ok, detail = '') => checks.push({ name, ok, detail });

  const urlMatch = js.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const ref = urlMatch ? urlMatch[1] : null;

  // Tous les JWT du bundle, pas seulement le premier : un JWT service_role placé
  // après la clé anon passerait inaperçu sinon.
  const jwts = [...js.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{20,}/g)]
    .map(([jeton, charge]) => {
      try {
        const p = JSON.parse(Buffer.from(charge, 'base64url').toString());
        return { longueur: jeton.length, role: p.role ?? null, ref: p.ref ?? null };
      } catch {
        return { longueur: jeton.length, role: null, ref: null };
      }
    });
  const anon = jwts.filter((j) => j.role === 'anon');
  const serviceRole = jwts.filter((j) => j.role === 'service_role');
  const publishable = js.match(/sb_publishable_[A-Za-z0-9_-]{20,}/);
  const secret = js.match(/sb_secret_[A-Za-z0-9_-]{20,}/);

  check('clé publique Supabase embarquée (sb_publishable_ ou JWT anon)', !!publishable || anon.length > 0,
    publishable ? `sb_publishable_, ${publishable[0].length} caractères`
      : anon.length ? `JWT anon, ${anon[0].longueur} caractères`
        : 'absente');
  // Le JWT porte le projet visé ; la clé opaque, non : on ne peut comparer que le JWT.
  for (const j of anon) {
    check('le JWT anon embarqué pointe le même projet que l’URL', !ref || j.ref === ref,
      `${j.ref} vs ${ref}`);
  }
  check('aucune clé secrète sb_secret_ embarquée', !secret, secret ? 'PRÉSENTE' : 'aucune');
  check('aucun JWT service_role embarqué', serviceRole.length === 0,
    serviceRole.length ? `${serviceRole.length} PRÉSENT(S)` : 'aucun');
  return checks;
}
