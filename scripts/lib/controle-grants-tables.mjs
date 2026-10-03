/**
 * Contrôle des grants de *tables* du schéma public — lot 5-E.
 *
 * Partagé par les deux lecteurs, comme la liste blanche des EXECUTE : à gauche
 * `test-grants.mjs` sur la pile jetable (il prouve ce que nos migrations
 * produisent), à droite `audit-grants-prod.mjs` sur la production (il prouve ce
 * que la base *est*, y compris un grant posé à la main depuis le SQL editor).
 * Deux copies du même contrôle divergeraient, et la plus permissive deviendrait
 * la vraie.
 *
 * L'angle mort qu'il ferme : l'audit nocturne énumérait les EXECUTE des
 * fonctions et les privilèges par défaut des fonctions. Les grants de *tables*
 * n'y figuraient pas — d'où 101 tables où `anon` détenait INSERT/UPDATE/DELETE
 * /TRUNCATE sans qu'aucun contrôle ne le dise.
 *
 * Deux temps, comme pour les fonctions :
 *   T1..T3  l'état d'aujourd'hui, table par table, depuis le catalogue ;
 *   T4..T5  ce qui naîtra demain, depuis `pg_default_acl` — parce que les 101
 *           tables n'étaient pas un résidu mais le *défaut* du schéma, et
 *           qu'une révocation sans changement de défaut est un instantané.
 *
 * T6/T7 sont des contre-exemples, et ils pèsent autant que les refus : une
 * révocation massive sans contrôle positif est indistinguable d'une panne
 * massive. Si `authenticated` perdait ses écritures ou `anon` ses lectures,
 * T1 resterait vert.
 */

import {
  ANON_TABLE_WRITE_WHITELIST,
  PRIVILEGES_INTERDITS_ANON,
  PRIVILEGES_INTERDITS_AUTHENTICATED,
} from './anon-whitelist.mjs';

/** Seuil des contre-exemples : le décor réel en compte plus de 110. */
const PLANCHER_TABLES = 100;

/**
 * Tables que seules des fonctions serveur écrivent : ni `anon` ni
 * `authenticated` n'y détiennent d'écriture, et la RLS y est active. T6
 * accepte que `authenticated` écrive presque partout ; ces tables-là sont
 * l'exception, et une exception se nomme.
 */
const TABLES_ECRITURE_SERVEUR = new Map([
  ['box_member_alerts', 'alertes au gérant — écrites par le déclencheur de 20270133, '
    + 'résolues par resoudre_alerte_membre()'],
]);

/** Bits de `pg_trigger.tgtype`. */
const TG = { ROW: 1, BEFORE: 2, INSERT: 4, DELETE: 8, UPDATE: 16 };

/**
 * T11, T12… : les gardes par déclencheur qui ferment une écriture que la RLS
 * laisse passer (`authenticated` a l'écriture de la table et la règle y
 * autorise le gérant ou le co-gérant). Chacune doit exister, être active,
 * s'exécuter BEFORE, ligne par ligne, sur ses événements et ses colonnes
 * (`colonnes` vide : toutes les colonnes, aucun `UPDATE OF`), avoir une
 * fonction qu'aucun client n'exécute et un corps qui contrôle encore ce qu'il
 * doit. Lu par oid, sans résoudre de nom dans `internal` (le rôle d'audit n'y a
 * pas l'USAGE).
 */
const GARDES_DECLENCHEUR = [
  {
    id: 'T11',
    table: 'boxes',
    declencheur: 'trg_boxes_garde_archivage',
    evenements: ['UPDATE'],
    colonnes: ['archive_scheduled_at', 'archive_scheduled_by', 'archived_at', 'archived_by'],
    corps: ['BOX_ARCHIVAGE_RESERVE', 'NEW.archive_scheduled_at', 'NEW.archive_scheduled_by',
      'NEW.archived_at', 'NEW.archived_by'],
    libelle: 'l\'état d\'archivage de `boxes` n\'est écrit que par le serveur',
    risque: 'un gérant programme, lève ou efface l\'archivage de sa box depuis le '
      + 'navigateur. Rejoue 20270130.',
  },
  {
    id: 'T12',
    table: 'box_members',
    declencheur: 'trg_box_members_garde_cogerant',
    evenements: ['INSERT', 'UPDATE', 'DELETE'],
    colonnes: [],
    // Le tuple gardé en entier : `NEW.status` apparaît aussi dans la renonciation.
    corps: ['MEMBRE_ROLE_COGERANT_RESERVE', 'is_box_owner(',
      'ROW(NEW.role, NEW.member_id, NEW.box_id, NEW.status)'],
    libelle: 'seul le gérant principal donne ou retire le rôle co-gérant',
    risque: 'un co-gérant nomme un autre co-gérant, qui aura accès à l\'argent, ou '
      + 'retire ce rôle à un autre. Rejoue 20270139.',
  },
  {
    id: 'T13',
    table: 'box_notifications',
    declencheur: 'trg_box_notifications_garde_resultat',
    evenements: ['INSERT', 'UPDATE'],
    colonnes: [],
    corps: ['NOTIF_RESULTAT_RESERVE', 'NEW.delivered_count IS NOT NULL',
      'NEW.delivered_count IS DISTINCT FROM OLD.delivered_count'],
    libelle: 'le résultat d\'un envoi de notification n\'est écrit que par le serveur',
    risque: 'un gérant ou un co-gérant invente ou réécrit le nombre d\'appareils '
      + 'atteints par sa notification. Rejoue 20270142.',
  },
];

/**
 * Nombre d'assertions exécutées par ce contrôle.
 *
 * T4 en compte une par rôle **propriétaire** de tables, et T5 exige qu'il n'y
 * en ait qu'un : deux propriétaires feraient dépasser l'attendu, et le
 * décompte le dirait au lieu de le taire.
 */
export const ASSERTIONS_GRANTS_TABLES = 9 + TABLES_ECRITURE_SERVEUR.size + GARDES_DECLENCHEUR.length; // T1..T9, T10 par table, T11+ par garde

const PRIV_LISTE = privs => privs.map(p => `'${p}'`).join(', ');

/**
 * @param {(sql: string) => string[][]} query  lecteur de catalogue (psql)
 * @param {(label: string, ok: boolean, detail?: string) => void} assert
 */
export function controlerGrantsTables(query, assert) {
  // ── T1 : `anon` n'écrit dans aucune table ──────────────────────────────────
  const ecrituresAnon = query(`
    select c.relname, string_agg(distinct a.privilege_type, ',' order by a.privilege_type)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace,
         lateral aclexplode(c.relacl) a
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and a.grantee = 'anon'::regrole::oid
      and a.privilege_type in (${PRIV_LISTE(PRIVILEGES_INTERDITS_ANON)})
    group by 1 order by 1
  `);

  const horsListeAnon = ecrituresAnon.filter(([t]) => !ANON_TABLE_WRITE_WHITELIST.has(t));

  assert(
    'T1 — `anon` ne détient aucun privilège d\'écriture sur les tables de public',
    horsListeAnon.length === 0,
    horsListeAnon.length
      ? `${horsListeAnon.length} table(s) : `
        + horsListeAnon.slice(0, 12).map(([t, p]) => `${t} (${p})`).join(', ')
        + (horsListeAnon.length > 12 ? ', …' : '') + '\n'
        + '       → la clé anon est publique par nature (elle est dans le bundle '
        + 'de l\'app) : ces écritures ne dépendent plus que de la RLS. Révoque, ou '
        + 'inscris la table dans ANON_TABLE_WRITE_WHITELIST avec sa raison.'
      : '',
  );

  // ── T2 : `authenticated` ne détient ni TRUNCATE ni DDL ─────────────────────
  // TRUNCATE ne passe pas par la RLS : un seul appel vide la table. PostgREST
  // ne l'émet pas, donc le risque était latent — un grant sans usage est un
  // grant qu'on ne relit plus.
  const interditsAuth = query(`
    select c.relname, string_agg(distinct a.privilege_type, ',' order by a.privilege_type)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace,
         lateral aclexplode(c.relacl) a
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and a.grantee = 'authenticated'::regrole::oid
      and a.privilege_type in (${PRIV_LISTE(PRIVILEGES_INTERDITS_AUTHENTICATED)})
    group by 1 order by 1
  `);

  assert(
    `T2 — \`authenticated\` ne détient ${PRIVILEGES_INTERDITS_AUTHENTICATED.join('/')} sur aucune table`,
    interditsAuth.length === 0,
    interditsAuth.length
      ? `${interditsAuth.length} table(s) : `
        + interditsAuth.slice(0, 12).map(([t, p]) => `${t} (${p})`).join(', ')
        + (interditsAuth.length > 12 ? ', …' : '')
      : '',
  );

  // ── T3 : aucun grant de *colonne* n'a survécu au revoke de table ───────────
  // Le piège du lot 0-bis : `REVOKE ... ON TABLE` ne retire pas un grant posé
  // sur une colonne. Le contrôle regarde donc `pg_attribute.attacl`, pas
  // seulement `pg_class.relacl` — sinon il validerait une fermeture qui n'a
  // pas eu lieu.
  const colonnes = query(`
    select c.relname || '.' || att.attname || ' → ' || a.grantee::regrole::text
           || ' (' || a.privilege_type || ')'
    from pg_attribute att
    join pg_class c on c.oid = att.attrelid
    join pg_namespace n on n.oid = c.relnamespace,
         lateral aclexplode(att.attacl) a
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and a.grantee in ('anon'::regrole::oid, 'authenticated'::regrole::oid)
      and a.privilege_type <> 'SELECT'
    order by 1
  `).map(r => r[0]);

  assert(
    'T3 — aucun grant d\'écriture de colonne pour `anon` ou `authenticated`',
    colonnes.length === 0,
    colonnes.length ? `${colonnes.length} : ${colonnes.join(', ')}` : '',
  );

  // ── T4 : ce qui naîtra demain ─────────────────────────────────────────────
  // T1 constate aujourd'hui. Sans T4, la prochaine table naîtrait ouverte : le
  // défaut du schéma accordait l'ensemble des écritures à `anon`, donc les 101
  // tables n'étaient pas un accident, elles étaient la règle.
  //
  // Le contrôle porte sur les rôles qui **possèdent** des tables, pas sur tous
  // ceux qui pourraient en créer : c'est le propriétaire des tables existantes
  // qui créera la suivante. Un rôle au défaut ouvert qui ne crée jamais rien
  // est inoffensif — et T5 vérifie qu'il n'y en a qu'un, sinon l'inventaire
  // aurait un angle mort de plus.
  const proprietaires = query(`
    select distinct c.relowner::regrole::text,
           coalesce((select string_agg(distinct a.grantee::regrole::text || ':' || a.privilege_type, ',')
                     from pg_default_acl d, aclexplode(d.defaclacl) a
                     where d.defaclrole = c.relowner and d.defaclobjtype = 'r'
                       and d.defaclnamespace = 'public'::regnamespace::oid
                       and ((a.grantee = 'anon'::regrole::oid
                             and a.privilege_type in (${PRIV_LISTE(PRIVILEGES_INTERDITS_ANON)}))
                         or (a.grantee = 'authenticated'::regrole::oid
                             and a.privilege_type in (${PRIV_LISTE(PRIVILEGES_INTERDITS_AUTHENTICATED)})))), '')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    order by 1
  `);

  for (const [role, ouverts] of proprietaires) {
    assert(
      `T4 — une table créée par \`${role}\` dans public naîtra sans écriture pour \`anon\``,
      ouverts === '',
      `privilèges par défaut encore ouverts : ${ouverts}\n`
        + `       → ALTER DEFAULT PRIVILEGES FOR ROLE ${role} IN SCHEMA public `
        + 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon.',
    );
  }

  // ── T5 : un seul propriétaire, donc un seul défaut à surveiller ────────────
  assert(
    `T5 — les tables de public ont un unique propriétaire (${proprietaires.map(p => p[0]).join(', ') || '—'})`,
    proprietaires.length === 1,
    proprietaires.length === 0
      ? 'aucune table dans public : requête suspecte, pas base rassurante.'
      : 'plusieurs propriétaires : chacun porte son propre défaut, et celui '
        + 'd\'un rôle de plateforme n\'est pas modifiable depuis `postgres`. '
        + 'Recrée ces tables sous le propriétaire habituel, ou ce contrôle doit '
        + 'compter une assertion par rôle.',
  );

  // ── T6 / T7 : les contre-exemples ─────────────────────────────────────────
  const [[ecrituresConservees]] = query(`
    select count(*)::text from (
      select c.oid
      from pg_class c join pg_namespace n on n.oid = c.relnamespace,
           lateral aclexplode(c.relacl) a
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
        and a.grantee = 'authenticated'::regrole::oid
        and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
      group by c.oid
    ) t
  `);

  assert(
    `T6 — \`authenticated\` conserve ses écritures (${ecrituresConservees} tables, ≥ ${PLANCHER_TABLES})`,
    Number(ecrituresConservees) >= PLANCHER_TABLES,
    'la révocation a mordu sur le rôle connecté : l\'app ne peut plus rien '
      + 'écrire. T1 resterait vert — c\'est précisément le cas qu\'un contrôle '
      + 'négatif seul ne distingue pas d\'un succès.',
  );

  const [[lecturesAnon]] = query(`
    select count(*)::text from (
      select c.oid
      from pg_class c join pg_namespace n on n.oid = c.relnamespace,
           lateral aclexplode(c.relacl) a
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
        and a.grantee = 'anon'::regrole::oid and a.privilege_type = 'SELECT'
      group by c.oid
    ) t
  `);

  assert(
    `T7 — \`anon\` conserve ses lectures publiques (${lecturesAnon} relations, ≥ ${PLANCHER_TABLES})`,
    Number(lecturesAnon) >= PLANCHER_TABLES,
    'les lectures anonymes ont sauté avec les écritures : l\'annuaire /box, '
      + '/classement et les pages publiques sont muets.',
  );

  // ── T8 : une vue lue par `anon` évalue la RLS de ses tables ────────────────
  // Une vue sans `security_invoker` s'exécute avec les droits de son
  // propriétaire : la RLS des tables sous-jacentes n'est jamais évaluée, et le
  // grant SELECT accordé à `anon` sert donc des lignes que la table refuse.
  // C'est ainsi que la composition des groupes de messagerie et les volumes de
  // répétitions par athlète étaient lisibles à la clé publique du bundle. La
  // règle n'interdit pas les vues publiques — /classement en est une — elle
  // exige qu'elles emprunte l'identité de l'appelant.
  const vuesAnonEmprunt = query(`
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace,
         lateral aclexplode(c.relacl) a
    where n.nspname = 'public' and c.relkind in ('v', 'm')
      and a.grantee = 'anon'::regrole::oid and a.privilege_type = 'SELECT'
      and not coalesce(array_to_string(c.reloptions, ',') like '%security_invoker=true%', false)
    group by 1 order by 1
  `).map(r => r[0]);

  assert(
    'T8 — toute vue de public lisible par `anon` porte `security_invoker=true`',
    vuesAnonEmprunt.length === 0,
    vuesAnonEmprunt.length
      ? `${vuesAnonEmprunt.length} vue(s) : ${vuesAnonEmprunt.join(', ')}\n`
        + '       → elles servent les lignes avec les droits de leur '
        + 'propriétaire, RLS non évaluée. Ferme le SELECT à `anon`, ou pose '
        + 'ALTER VIEW … SET (security_invoker = true).'
      : '',
  );

  // ── T9 : les triggers de vue portent leur propre autorisation ─────────────
  // Le privilège d'exécution d'une fonction de trigger n'est vérifié qu'à sa
  // création, jamais à son déclenchement : un trigger `INSTEAD OF` en
  // `SECURITY DEFINER` sur une vue est un chemin d'écriture qui traverse la
  // RLS sans la lire. La garde doit être *dans* la fonction.
  //
  // Et elle doit y être avec le bon helper : dans une fonction `SECURITY
  // DEFINER`, `current_user` est le propriétaire, donc `is_privileged_backend()`
  // — qui lit `current_user` — est vrai pour tout appelant et n'autorise rien
  // du tout. `request_is_backend()` lit le rôle du JWT. Le contrôle refuse le
  // premier ici, sinon une garde présente mais inerte passerait pour une garde.
  const triggersVues = query(`
    select c.relname || '.' || p.proname,
           case
             when pg_get_functiondef(p.oid) like '%is_privileged_backend%'
               then 'garde inerte (is_privileged_backend dans une fonction DEFINER)'
             when pg_get_functiondef(p.oid) like '%is_box_owner_admin%'
               or pg_get_functiondef(p.oid) like '%is_box_owner_member%'
               or pg_get_functiondef(p.oid) like '%is_box_admin%'
               then 'ok'
             else 'aucune autorisation dans le corps'
           end
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public' and c.relkind in ('v', 'm')
      and not t.tgisinternal and p.prosecdef
    order by 1
  `);

  const triggersNus = triggersVues.filter(([, etat]) => etat !== 'ok');

  assert(
    `T9 — les triggers \`SECURITY DEFINER\` des vues de public portent une garde (${triggersVues.length} contrôlé(s))`,
    triggersNus.length === 0,
    triggersNus.length
      ? triggersNus.map(([nom, etat]) => `${nom} : ${etat}`).join(', ') + '\n'
        + '       → ce chemin écrit dans la table sous-jacente sans que sa RLS '
        + 'soit évaluée. Ajoute la garde de la table dans le corps de la '
        + 'fonction (`request_is_backend() or is_box_owner_admin(box_id)`).'
      : '',
  );

  controlerTablesEcritureServeur(query, assert);
  for (const garde of GARDES_DECLENCHEUR) controlerGardeDeclencheur(query, assert, garde);
}

/**
 * T10 : une assertion par table de TABLES_ECRITURE_SERVEUR — table présente,
 * RLS active, aucune écriture de table ni de colonne pour les rôles clients.
 */
function controlerTablesEcritureServeur(query, assert) {
  for (const [table, raison] of TABLES_ECRITURE_SERVEUR) {
    const [[present, rls, ecritures]] = query(`
      select count(c.oid)::text,
             coalesce(bool_or(c.relrowsecurity), false)::text,
             coalesce((select string_agg(distinct r || ':' || p, ',')
                       from unnest(array['anon', 'authenticated']) r,
                            unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
                       where to_regclass('public.${table}') is not null
                         and (has_table_privilege(r, 'public.${table}', p)
                              or (p in ('INSERT', 'UPDATE')
                                  and has_any_column_privilege(r, 'public.${table}', p)))), '')
      from pg_class c
      where c.oid = to_regclass('public.${table}')
    `);

    assert(
      `T10 — \`${table}\` n'est écrite que par le serveur (${raison})`,
      present === '1' && rls === 'true' && ecritures === '',
      present !== '1'
        ? 'table absente : la migration qui la crée n\'est pas appliquée, ou elle a été renommée.'
        : rls !== 'true'
          ? 'RLS désactivée.'
          : `écritures client : ${ecritures} → REVOKE INSERT, UPDATE, DELETE, TRUNCATE `
            + `ON public.${table} FROM anon, authenticated.`,
    );
  }
}

function controlerGardeDeclencheur(query, assert, g) {
  const bits = TG.ROW | TG.BEFORE | g.evenements.reduce((m, e) => m | TG[e], 0);
  const lignes = query(`
    select t.tgenabled::text,
           ((t.tgtype & ${bits}) = ${bits})::text,
           coalesce((select string_agg(a.attname, ',' order by a.attname)
                     from pg_attribute a
                     where a.attrelid = t.tgrelid and a.attnum = any(t.tgattr::int2[])), ''),
           n.nspname || '.' || p.proname,
           (has_function_privilege('anon', p.oid, 'EXECUTE')
            or has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text,
           (${g.corps.map(c => `strpos(p.prosrc, '${c}') > 0`).join(' and ')})::text
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = to_regclass('public.${g.table}') and t.tgname = '${g.declencheur}'
  `);

  const [actif, forme, colonnes, fonction, execClient, corps] = lignes[0] ?? [];
  const couvertes = colonnes ? colonnes.split(',') : [];
  const manquantes = g.colonnes.filter(c => !couvertes.includes(c));
  const ecarts = lignes.length !== 1 ? ['déclencheur absent']
    : [
      ...(['O', 'A'].includes(actif) ? [] : [`désactivé (tgenabled=${actif})`]),
      ...(forme === 'true' ? [] : [`pas BEFORE ${g.evenements.join(' OR ')} FOR EACH ROW`]),
      ...(manquantes.length ? [`colonnes non couvertes : ${manquantes.join(', ')}`] : []),
      ...(g.colonnes.length === 0 && couvertes.length
        ? [`limité à UPDATE OF ${colonnes} (attendu : toutes les colonnes)`] : []),
      ...(execClient === 'false' ? [] : [`${fonction} exécutable par un rôle client`]),
      ...(corps === 'true' ? [] : [`${fonction} ne contrôle plus ${g.corps.join(', ')}`]),
    ];

  assert(
    `${g.id} — ${g.libelle} (${g.declencheur})`,
    ecarts.length === 0,
    ecarts.join(' ; ') + '\n'
      + `       → sans cette garde, ${g.risque}`,
  );
}

/**
 * Les RPC mutantes de la liste des sondes, jugées sur le catalogue.
 *
 * Une sonde qui *appelle* la fonction n'apporte une information nouvelle que
 * dans l'état où le grant a régressé — donc exactement dans l'état où l'appel
 * aboutit. En production, cet appel générerait les créneaux de toutes les box :
 * l'audit deviendrait l'auteur du dégât qu'il constate.
 *
 * `has_function_privilege` répond la même chose sans atteindre le corps.
 */
export function controlerRpcMutantes(query, assert, fonctions) {
  for (const fn of fonctions) {
    const lignes = query(`
      select p.oid::regprocedure::text,
             case when has_function_privilege('anon', p.oid, 'EXECUTE')
                  then 'ouvert' else 'ferme' end
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = '${fn}'
      order by 1
    `);

    // Un libellé explicite, pas le rendu d'un booléen : `boolean::text` rend
    // `true`, et une comparaison à `'t'` était donc verte quel que soit l'état
    // du grant — un contrôle inconditionnellement vert ne contrôle rien.
    const ouvertes = lignes.filter(([, droit]) => droit === 'ouvert').map(([sig]) => sig);

    assert(
      `\`anon\` n'a pas l'EXECUTE sur \`${fn}\` (RPC mutante — jugée sans être appelée)`,
      lignes.length > 0 && ouvertes.length === 0,
      lignes.length === 0
        ? 'fonction absente du schéma : la sonde ne mesure plus rien — '
          + 'retire-la de la liste ou nomme la fonction qui l\'a remplacée.'
        : `${ouvertes.length} signature(s) ouverte(s) : ${ouvertes.join(', ')}\n`
          + '       → cette fonction écrit. La sonde ne l\'appelle pas exprès : '
          + 'révoque l\'EXECUTE avant de vérifier autre chose.',
    );
  }
}
