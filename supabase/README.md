# Base de données — baseline et migrations

## Source de vérité

`supabase/migrations/` reconstruit **exactement** le schéma de production :

1. `20260301000000_baseline_prod_schema.sql` — snapshot du schéma réel de la
   prod (`supabase db dump`) : tables, vues, fonctions, triggers, index,
   contraintes, RLS, grants, buckets et policies storage ;
2. les migrations suivantes, dans l'ordre lexicographique.

L'historique d'avant baseline est dans `supabase/migrations_archive/` — conservé,
plus jamais rejoué. Voir son README pour la raison (le rejeu produisait la
mauvaise version de `programs`).

## Vérifier qu'une migration est rejouable

```bash
./scripts/db-replay.sh
```

Le script démarre un Postgres vierge (image `supabase/postgres`, même version
majeure que la prod), rejoue baseline + migrations, et échoue à la première
erreur. C'est ce que la CI exécute sur chaque PR
(`.github/workflows/db-replay.yml`) : **une migration non rejouable ne peut
plus être mergée**.

## Vérifier la fidélité du baseline vis-à-vis de la prod

```bash
KEEP=1 ./scripts/db-replay.sh
SUPABASE_DB_URL='<url prod, lecture seule>' ./scripts/db-fidelity.sh
```

Compare 8 inventaires (colonnes, fonctions, policies, triggers, index, grants
de table, de colonne, de routine) entre la prod et la base rejouée. Attendu :
`ecarts=0` partout.

## Deux pièges que le baseline traite explicitement

- **`pg_dump` n'émet aucun `REVOKE`.** Les default privileges de la stack
  Supabase donnent `ALL` à `anon`/`authenticated` sur toute table créée dans
  `public`, et `EXECUTE` sur toute fonction. Rejouer le dump nu rendait donc à
  `anon` des droits que les lots de sécurité lui avaient retirés (jusqu'à
  `EXECUTE` sur `delete_user_account` ou `join_box_by_invite`). Le baseline se
  termine par une section « grants exacts » : `REVOKE ALL` sur chaque table et
  chaque routine, puis les privilèges tels qu'ils sont réellement en prod.
- **Hors périmètre du schéma** : schémas `auth`/`realtime` (plateforme), jobs
  `pg_cron`, secrets des edge functions, et les données. Le harnais de rejeu
  recrée le minimum de `storage` que la plateforme fournit normalement.

## Dump de production avant d'appliquer une migration

Toute application en prod est précédée d'un dump déposé dans le bucket privé
`db-dumps` (`db-dumps/AAAA-MM-JJ/athlex-prod-public-<horodatage>.dump`), dont le
chemin et le sha256 figurent au compte rendu.

```bash
pg_dump "$PROD_DB_URL" -Fc -n public --no-owner -f athlex-prod-public-<horodatage>.dump
```

- **Schéma *et* données** : jamais `--schema-only`. `pg_restore -l` doit lister
  des sections `TABLE DATA`.
- **Pas de `--no-acl`** (convention posée le 22/09/2026) : les droits font partie
  de l'état de sécurité de la base et doivent pouvoir être restaurés avec le
  reste. C'est le même raisonnement que la section « grants exacts » du baseline
  ci-dessus — un état restauré sans ses `GRANT`/`REVOKE` n'est pas l'état d'avant.
- **Compter les sections du dump**, parce que c'est ce qui *prouve* ce qu'il
  contient — un nom de fichier ne prouve rien :

  ```bash
  pg_restore -l athlex-prod-public-<horodatage>.dump | grep -c 'TABLE DATA'   # données
  pg_restore -l athlex-prod-public-<horodatage>.dump | grep -ci 'ACL'         # droits
  ```

  Les deux comptes vont au compte rendu. Un `ACL` à zéro signifie un dump pris
  avec `--no-acl` : il faut le refaire.
- `--no-owner` reste en place : le propriétaire dépend de l'instance.
- La copie locale est supprimée après dépôt ; `PROD_DB_URL` n'est ni affichée ni
  écrite dans un fichier.

### Déposer le fichier dans le bucket

```bash
npx supabase storage cp <chemin/relatif>.dump ss:///db-dumps/AAAA-MM-JJ/<nom>.dump --experimental
```

Le chemin source doit être **relatif**. Un chemin absolu Windows échoue : le
`C:` est pris pour un schéma d'URL, la CLI croit alors copier d'un dossier local
vers un autre et rend un « Unsupported operation » qui ne dit pas cela du tout.
Relire ensuite le fichier depuis le bucket et comparer les sha256 : c'est le seul
contrôle qui prouve que le dépôt a bien eu lieu, et à l'octet près.

### Ce qui doit rester intact, et comment le prouver

Une migration qui ne doit pas toucher une table ne se contente pas de le dire :
on relève **avant et après**, en lecture seule, le nombre de lignes et un md5 du
contenu agrégé, et on les compare. Un comptage seul ne verrait pas une ligne
modifiée en place.

```sql
SELECT count(*) AS lignes,
       md5(string_agg(col_a || '|' || col_b, E'
' ORDER BY cle)) AS empreinte
  FROM public.<table>;
```

C'est ce qui a permis d'affirmer, pour la migration `20261231`, que les 208
lignes de `badges_catalog` étaient **inchangées** — et pas seulement au même
nombre — alors que la migration contenait un `INSERT` sur cette table.
