/**
 * Contrôle du schéma `internal` — fonctions que la base appelle pour elle-même.
 *
 * Partagé par les deux lecteurs, comme les contrôles du schéma `public` : à
 * gauche `test-grants.mjs` sur la pile jetable (ce que nos migrations
 * produisent), à droite `audit-grants-prod.mjs` sur la production (ce que la
 * base *est*, y compris un grant posé à la main depuis le SQL editor).
 *
 * Pourquoi ce schéma existe (migration `20261230000000_tournament_scores_gardes`) :
 * `recalc_division_points` a été séparée en deux. La version publique porte la
 * garde de rôle et reste exposée ; `internal.recalc_division_points` porte le
 * corps sans garde et n'est appelée que par le trigger. Toute la protection de
 * cette seconde tient donc à une chose — **elle ne doit être atteignable par
 * aucun rôle client**. Rien ne le vérifiait : un `GRANT` de dépannage, ou une
 * future fonction posée là sans y penser, rendrait le recalcul appelable sur
 * n'importe quel tournoi, et l'audit nocturne serait resté vert.
 *
 * Deux verrous, contrôlés séparément parce qu'ils tombent séparément :
 *   I1  aucune fonction d'`internal` n'est exécutable par `anon` ni
 *       `authenticated` (ACL de la fonction) ;
 *   I2  `internal` n'accorde l'USAGE ni à `anon`, ni à `authenticated`, ni à
 *       PUBLIC (ACL du schéma). C'est le second verrou, et il couvre **les
 *       fonctions à venir** : sans USAGE, un EXECUTE ouvert par erreur sur une
 *       fonction d'`internal` ne suffit pas à la rendre appelable. I1 seul
 *       serait un instantané ; les deux verrous tombent séparément, d'où deux
 *       assertions.
 *
 * I3 est le contre-exemple, et il pèse autant que les deux refus : sur un
 * schéma vide ou absent, I1 et I2 sont verts sans rien prouver. Il ne vaut pas
 * liste blanche — il exige seulement que le contrôle ait une matière.
 *
 * Pas de liste blanche ici, à la différence d'`ANON_WHITELIST` : une fonction
 * d'`internal` atteignable par un client n'a aucune raison légitime d'exister.
 * Si une telle raison apparaît, elle a sa place dans `public`, derrière une
 * garde — pas une exception ajoutée ici.
 */

/** Nombre d'assertions exécutées par ce contrôle. */
export const ASSERTIONS_SCHEMA_INTERNAL = 3; // I1..I3

/** Rôles clients : ceux qu'une session PostgREST peut endosser. */
const ROLES_CLIENTS = ['anon', 'authenticated'];

const LISTE_ROLES = ROLES_CLIENTS.map(r => `('${r}')`).join(', ');

/**
 * @param {(sql: string) => string[][]} query  lecteur de catalogue (psql)
 * @param {(label: string, ok: boolean, detail?: string) => void} assert
 */
export function controlerSchemaInternal(query, assert) {
  // ── I3 d'abord : de quoi parle-t-on ────────────────────────────────────────
  // Lu avant les deux refus parce que leur message en dépend : « 0 fonction
  // ouverte » sur un schéma absent n'est pas la même nouvelle que sur un schéma
  // peuplé.
  const fonctions = query(`
    select p.oid::regprocedure::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'internal' and p.prokind in ('f', 'p')
    order by 1
  `).map(r => r[0]);

  // ── I1 : aucune fonction d'`internal` exécutable par un rôle client ────────
  const ouvertes = query(`
    select p.oid::regprocedure::text, r.rolname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join (values ${LISTE_ROLES}) as r(rolname)
    where n.nspname = 'internal' and p.prokind in ('f', 'p')
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
    order by 1, 2
  `);

  assert(
    'I1 — aucune fonction du schéma `internal` n\'est exécutable par `anon` ou `authenticated`',
    ouvertes.length === 0,
    ouvertes.length
      ? `${ouvertes.length} accès : ${ouvertes.map(([sig, role]) => `${role} → ${sig}`).join(', ')}\n`
        + '       → ces fonctions portent le corps SANS garde de rôle : c\'est '
        + 'leur inaccessibilité qui les protège. Révoque l\'EXECUTE. Si un '
        + 'client doit vraiment déclencher ce traitement, la porte est une '
        + 'fonction de `public` qui vérifie l\'appelant, pas un grant ici.'
      : '',
  );

  // ── I2 : le schéma lui-même reste fermé (couvre les fonctions à venir) ─────
  const usage = query(`
    select r.rolname
    from (values ${LISTE_ROLES}) as r(rolname)
    where exists (select 1 from pg_namespace where nspname = 'internal')
      and has_schema_privilege(r.rolname, 'internal', 'USAGE')
    order by 1
  `).map(r => r[0]);

  assert(
    'I2 — le schéma `internal` n\'accorde l\'USAGE à aucun rôle client',
    usage.length === 0,
    usage.length
      ? `USAGE ouvert à : ${usage.join(', ')}\n`
        + '       → c\'est le verrou qui couvre les fonctions à venir : tant '
        + 'qu\'il tient, un EXECUTE ouvert par erreur sur une fonction '
        + 'd\'`internal` ne suffit pas à la rendre appelable. '
        + 'REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;'
      : '',
  );

  // ── I3 : le contrôle a bien une matière ────────────────────────────────────
  assert(
    'le schéma `internal` existe et contient au moins une fonction (contre-exemple)',
    fonctions.length > 0,
    'schéma absent ou vide : I1 et I2 sont verts sans rien prouver.\n'
      + '       → si `internal` a été retiré, retire ce contrôle dans la même '
      + 'PR. Sinon, la migration qui le crée n\'est pas passée sur cette base.',
  );
}
