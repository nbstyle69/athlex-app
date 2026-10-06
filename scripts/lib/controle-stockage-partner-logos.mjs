/**
 * Contrôle du stockage `partner-logos` (logos des partenaires).
 *
 * Partagé par `test-grants.mjs` (pile jetable) et `audit-grants-prod.mjs`
 * (production), comme les autres contrôles.
 *
 * Pourquoi (migration `20270148000000_partner_logos_admin`) : jusqu'au
 * 06/10/2026, les policies `admin_*_partner_logo` ne demandaient qu'un compte
 * connecté (`auth.uid() IS NOT NULL`) : tout membre déposait, remplaçait ou
 * supprimait un logo de partenaire, servi publiquement par l'app. La lecture
 * reste publique ; l'écriture est réservée aux admins de la plateforme. Un
 * verrou :
 *   S6  le stockage `partner-logos` existe, et chaque policy d'écriture
 *       (INSERT, UPDATE, DELETE ou ALL) de `storage.objects` qui porte sur lui
 *       n'est ouverte ni au rôle public ni à `anon`, et exige le rôle admin
 *       (`super_admin` et `admin`) dans chacune de ses expressions.
 */

/** Nombre d'assertions exécutées par ce contrôle. */
export const ASSERTIONS_STOCKAGE_PARTNER_LOGOS = 1; // S6

/**
 * @param {(sql: string) => string[][]} query  lecteur de catalogue (psql)
 * @param {(label: string, ok: boolean, detail?: string) => void} assert
 */
export function controlerStockagePartnerLogos(query, assert) {
  const [[existe = 'f']] = query(`
    select exists (select 1 from storage.buckets where id = 'partner-logos')::text
  `);

  // Le rôle public est l'oid 0 dans polroles ; `anon` est nommé à part parce
  // qu'une policy « TO anon » est aussi ouverte qu'une policy sans rôle. Les
  // expressions sont rendues sur une ligne (le séparateur de psql est le
  // retour à la ligne).
  const ecritures = query(`
    select p.polname,
           (0 = any (p.polroles) or 'anon'::regrole::oid = any (p.polroles))::text,
           coalesce(regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\\s+', ' ', 'g'), ''),
           coalesce(regexp_replace(pg_get_expr(p.polwithcheck, p.polrelid), '\\s+', ' ', 'g'), '')
    from pg_policy p
    where p.polrelid = 'storage.objects'::regclass
      and p.polcmd in ('a', 'w', 'd', '*')
      and (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
           || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) like '%partner-logos%'
    order by 1
  `);

  const exigeAdmin = (expr) => expr === '' || (expr.includes("'super_admin'") && expr.includes("'admin'"));
  const fautives = ecritures
    .filter(([, ouverte, qual, check]) => ouverte === 'true' || !exigeAdmin(qual) || !exigeAdmin(check))
    .map(([nom]) => nom);

  assert(
    'S6 — le stockage `partner-logos` n\'est écrit que par un admin (aucune policy d\'écriture ouverte)',
    existe === 'true' && fautives.length === 0,
    existe !== 'true'
      ? 'stockage absent : le contrôle ne porte sur rien — il a été renommé ou supprimé.'
      : fautives.length
        ? `${fautives.length} policy(s) : ${fautives.join(', ')}\n`
          + '       → dépôt, modification et suppression : rôle authenticated et profiles.role '
          + 'super_admin ou admin (migration 20270148).'
        : '',
  );
}
