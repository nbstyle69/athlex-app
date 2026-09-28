/**
 * Contrôle du stockage `documents` et de la table `box_documents`.
 *
 * Partagé par les deux lecteurs, comme les autres contrôles : `test-grants.mjs`
 * sur la pile jetable (ce que nos migrations produisent) et
 * `audit-grants-prod.mjs` sur la production (ce que la base *est*).
 *
 * Pourquoi (migration `20270136000000_documents_stockage_prive`) : jusqu'au
 * 28/09/2026, le stockage `documents` était public et la policy
 * `public_read_documents` (rôle public, sans condition) laissait n'importe qui,
 * sans compte, lister et lire les PDF déposés depuis l'écran Documents. L'écran
 * est retiré de l'app ; les fichiers et les lignes restent, lus par la seule
 * clé serveur. Trois verrous, contrôlés séparément parce qu'ils tombent
 * séparément :
 *   S1  le stockage `documents` existe et n'est pas public (sinon l'URL
 *       `/object/public/documents/…` sert le fichier sans aucune règle) ;
 *   S2  aucune policy de `storage.objects` ne mentionne `documents` (sinon
 *       l'API liste, lit, dépose ou supprime) ;
 *   S3  `box_documents` existe et ni `anon` ni `authenticated` n'y détiennent
 *       le moindre privilège, de table ou de colonne.
 *
 * S1 et S3 exigent que l'objet existe : sur un stockage ou une table absents,
 * « rien d'ouvert » serait vert sans rien prouver.
 */

/** Nombre d'assertions exécutées par ce contrôle. */
export const ASSERTIONS_STOCKAGE_DOCUMENTS = 3; // S1..S3

/**
 * @param {(sql: string) => string[][]} query  lecteur de catalogue (psql)
 * @param {(label: string, ok: boolean, detail?: string) => void} assert
 */
export function controlerStockageDocuments(query, assert) {
  // ── S1 : le stockage n'est pas public ──────────────────────────────────────
  // Libellés explicites plutôt que `boolean::text` (voir controlerRpcMutantes).
  const [[etat = 'absent']] = query(`
    select coalesce((select case when public then 'public' else 'prive' end
                     from storage.buckets where id = 'documents'), 'absent')
  `);

  assert(
    'S1 — le stockage `documents` existe et n\'est pas public',
    etat === 'prive',
    etat === 'absent'
      ? 'stockage absent : le contrôle ne porte sur rien — il a été renommé ou supprimé.'
      : 'stockage public : toute URL `/object/public/documents/…` sert le fichier sans '
        + 'compte ni règle.\n       → UPDATE storage.buckets SET public = false WHERE id = \'documents\'.',
  );

  // ── S2 : aucune règle client sur ce stockage ───────────────────────────────
  const regles = query(`
    select p.polname
    from pg_policy p
    where p.polrelid = 'storage.objects'::regclass
      and (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
           || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) like '%''documents''%'
    order by 1
  `).map(r => r[0]);

  assert(
    'S2 — aucune policy de `storage.objects` ne porte sur le stockage `documents`',
    regles.length === 0,
    regles.length
      ? `${regles.length} policy(s) : ${regles.join(', ')}\n`
        + '       → l\'écran Documents est retiré : aucun rôle client ne doit lister, lire, '
        + 'déposer ni supprimer dans ce stockage.'
      : '',
  );

  // ── S3 : aucun droit client sur box_documents ──────────────────────────────
  const [[present, droits]] = query(`
    select (to_regclass('public.box_documents') is not null)::int::text,
           coalesce((select string_agg(r || ':' || p, ',' order by r, p)
                     from unnest(array['anon', 'authenticated']) r,
                          unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE',
                                       'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) p
                     where to_regclass('public.box_documents') is not null
                       and (has_table_privilege(r, 'public.box_documents', p)
                            or (p in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
                                and has_any_column_privilege(r, 'public.box_documents', p)))), '')
  `);

  assert(
    'S3 — ni `anon` ni `authenticated` ne détiennent de droit sur `box_documents`',
    present === '1' && droits === '',
    present !== '1'
      ? 'table absente : le contrôle ne porte sur rien.'
      : `droits client : ${droits}\n`
        + '       → REVOKE ALL ON public.box_documents FROM anon, authenticated.',
  );
}
