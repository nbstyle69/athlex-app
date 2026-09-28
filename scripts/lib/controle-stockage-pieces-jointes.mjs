/**
 * Contrôle du stockage `message-attachments` (pièces jointes des messages).
 *
 * Partagé par `test-grants.mjs` (pile jetable) et `audit-grants-prod.mjs`
 * (production), comme les autres contrôles.
 *
 * Pourquoi (migration `20270137000000_pieces_jointes_privees`) : jusqu'au
 * 28/09/2026, le stockage était public et `public_read_attachments` (rôle
 * public, sans condition) laissait n'importe qui, sans compte, lister et lire
 * les images des conversations. Désormais une pièce jointe se lit comme le
 * message qui la porte, et seulement par un compte connecté. Deux verrous :
 *   S4  le stockage `message-attachments` existe et n'est pas public (sinon
 *       l'URL `/object/public/message-attachments/…` sert l'image sans règle) ;
 *   S5  aucune policy de lecture (SELECT ou ALL) de `storage.objects` portant
 *       sur ce stockage n'est ouverte au rôle public ni à `anon`.
 */

/** Nombre d'assertions exécutées par ce contrôle. */
export const ASSERTIONS_STOCKAGE_PIECES_JOINTES = 2; // S4, S5

/**
 * @param {(sql: string) => string[][]} query  lecteur de catalogue (psql)
 * @param {(label: string, ok: boolean, detail?: string) => void} assert
 */
export function controlerStockagePiecesJointes(query, assert) {
  // ── S4 : le stockage n'est pas public ──────────────────────────────────────
  const [[etat = 'absent']] = query(`
    select coalesce((select case when public then 'public' else 'prive' end
                     from storage.buckets where id = 'message-attachments'), 'absent')
  `);

  assert(
    'S4 — le stockage `message-attachments` existe et n\'est pas public',
    etat === 'prive',
    etat === 'absent'
      ? 'stockage absent : le contrôle ne porte sur rien — il a été renommé ou supprimé.'
      : 'stockage public : toute URL `/object/public/message-attachments/…` sert l\'image '
        + 'sans compte ni règle.\n       → UPDATE storage.buckets SET public = false '
        + 'WHERE id = \'message-attachments\'.',
  );

  // ── S5 : aucune lecture publique ───────────────────────────────────────────
  // Le rôle public est l'oid 0 dans polroles ; `anon` est nommé à part parce
  // qu'une policy « TO anon » est aussi publique qu'une policy sans rôle.
  const ouvertes = query(`
    select p.polname
    from pg_policy p
    where p.polrelid = 'storage.objects'::regclass
      and p.polcmd in ('r', '*')
      and (0 = any (p.polroles) or 'anon'::regrole::oid = any (p.polroles))
      and (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
           || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) like '%message-attachments%'
    order by 1
  `).map(r => r[0]);

  assert(
    'S5 — aucune policy ne donne à lire `message-attachments` au rôle public ni à `anon`',
    ouvertes.length === 0,
    ouvertes.length
      ? `${ouvertes.length} policy(s) : ${ouvertes.join(', ')}\n`
        + '       → une pièce jointe ne se lit que connecté, comme le message qui la porte.'
      : '',
  );
}
