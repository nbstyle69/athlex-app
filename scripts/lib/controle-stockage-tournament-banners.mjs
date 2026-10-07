/**
 * Contrôle du stockage `tournament-banners` (bannières des tournois).
 *
 * Partagé par `test-grants.mjs` (pile jetable) et `audit-grants-prod.mjs`
 * (production), comme les autres contrôles.
 *
 * Pourquoi (migration `20270149000000_tournament_banners_staff`) : jusqu'au
 * 07/10/2026, les policies « Authenticated users can upload / update tournament
 * banners » ne demandaient qu'un compte connecté : tout membre déposait ou
 * remplaçait la bannière de n'importe quelle box, servie publiquement. La
 * lecture reste publique ; l'écriture est réservée au staff de la box du
 * premier dossier du chemin (`<box_id>/<fichier>`) et aux admins, par
 * `public.is_box_admin`. Un verrou :
 *   S7  le stockage `tournament-banners` existe, et chaque policy d'écriture
 *       (INSERT, UPDATE, DELETE ou ALL) de `storage.objects` qui porte sur lui
 *       n'est ouverte ni au rôle public ni à `anon`, et appelle `is_box_admin`
 *       sur le premier dossier du chemin dans chacune de ses expressions.
 */

/** Nombre d'assertions exécutées par ce contrôle. */
export const ASSERTIONS_STOCKAGE_TOURNAMENT_BANNERS = 1; // S7

/**
 * @param {(sql: string) => string[][]} query  lecteur de catalogue (psql)
 * @param {(label: string, ok: boolean, detail?: string) => void} assert
 */
export function controlerStockageTournamentBanners(query, assert) {
  const [[existe = 'f']] = query(`
    select exists (select 1 from storage.buckets where id = 'tournament-banners')::text
  `);

  // Même lecture que S6 : rôle public (oid 0) ou `anon`, expressions sur une
  // ligne.
  const ecritures = query(`
    select p.polname,
           (0 = any (p.polroles) or 'anon'::regrole::oid = any (p.polroles))::text,
           coalesce(regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\\s+', ' ', 'g'), ''),
           coalesce(regexp_replace(pg_get_expr(p.polwithcheck, p.polrelid), '\\s+', ' ', 'g'), '')
    from pg_policy p
    where p.polrelid = 'storage.objects'::regclass
      and p.polcmd in ('a', 'w', 'd', '*')
      and (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
           || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) like '%tournament-banners%'
    order by 1
  `);

  // Rendu de pg_get_expr : `is_box_admin((split_part(name, '/'::text, 1))::uuid)`,
  // préfixé de `public.` si public n'est pas dans le search_path.
  const appelBoxAdmin = /(public\.)?is_box_admin\(\(split_part\(name, '\/'::text, 1\)\)::uuid\)/;
  const exigeStaff = (expr) => expr === '' || appelBoxAdmin.test(expr);
  const fautives = ecritures
    .filter(([, ouverte, qual, check]) => ouverte === 'true' || !exigeStaff(qual) || !exigeStaff(check))
    .map(([nom]) => nom);

  assert(
    'S7 — le stockage `tournament-banners` n\'est écrit que par le staff de la box ou un admin (aucune policy d\'écriture ouverte)',
    existe === 'true' && fautives.length === 0,
    existe !== 'true'
      ? 'stockage absent : le contrôle ne porte sur rien — il a été renommé ou supprimé.'
      : fautives.length
        ? `${fautives.length} policy(s) : ${fautives.join(', ')}\n`
          + '       → dépôt et modification : rôle authenticated et is_box_admin du premier dossier '
          + 'du chemin (migration 20270149) ; aucune suppression.'
        : '',
  );
}
