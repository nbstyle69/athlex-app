# Runbook — tâches planifiées (pg_cron) de la production

Aucun secret ne figure ici. Les jobs `net.http_post` portent leur clé
d'API et leur `x-cron-secret` **dans la définition du job en base**, jamais dans
le dépôt : c'est pourquoi ils ne sont pas créés par une migration. Une migration
est publique dans l'historique Git ; un `CRON_SECRET` ne doit pas y entrer.

Conséquence à connaître : **rejouer les migrations sur une base neuve ne recrée
pas ces jobs**. La liste ci-dessous est la référence pour les remonter.

| job | fréquence | cible |
| --- | --- | --- |
| `daily-wod-du-jour-cet` / `-cest` | 23:05 / 22:05 UTC | `SELECT ensure_daily_official_wod()` |
| `extend-class-schedules-daily` | 02:00 UTC | `SELECT extend_all_class_schedules()` |
| `detect-trial-followups-hourly` | H+10 | `SELECT detect_trial_followups()` |
| `session-followup-cron-hourly` | H+20 | edge `session-followup-cron` |
| `materialize-box-programming-cet` / `-cest` | dim. 17:00 / 16:00 UTC | `SELECT materialize_box_programming()` |
| `tournament_activation_sweep` | toutes les 15 min | `SELECT sync_tournament_activation()` |
| `tournament-notifications-sweep` | min. 5, 20, 35, 50 | edge `tournament-notifications-cron` |
| `weekly-owner-digest-monday` | lundi 07:00 UTC | edge `weekly-owner-digest` |
| `generate-box-week-cet` / `-cest` | sam. 07:00 / 06:00 UTC | edge `generate-box-week` |

## `generate-box-week` (programmation automatique, J1)

**Créé et actif depuis le 17/09/2026** (jobs 12 et 13), sur le modèle de
`materialize-box-programming` : deux jobs couvrent les deux décalages, une garde
`Europe/Paris` fait que seul celui du bon décalage agit. Cible : **samedi 08:00 Paris**,
deux jours avant la révélation par défaut du dimanche 18:00.

| Job | Cron (UTC) | Agit |
| --- | --- | --- |
| `generate-box-week-cest` | `0 6 * * 6` | de fin mars à fin octobre (UTC+2) |
| `generate-box-week-cet` | `0 7 * * 6` | de fin octobre à fin mars (UTC+1) |

La différence avec `materialize-box-programming` : là-bas la garde est dans la fonction SQL
(`materialize_box_programming()` sort si l'heure de Paris n'est pas 18), ici l'appel est un
`net.http_post` sans fonction SQL intermédiaire, donc la garde est **dans la commande du job** :

```sql
DO $guard$
BEGIN
  IF EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Europe/Paris'))::int = 6
     AND EXTRACT(HOUR  FROM (now() AT TIME ZONE 'Europe/Paris'))::int = 8 THEN
    PERFORM net.http_post(
      url     := 'https://<ref>.supabase.co/functions/v1/generate-box-week',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
      body    := '{}'::jsonb);
  END IF;
END $guard$;
```

Depuis la migration `20270104` (clés Supabase, PR C), les cinq jobs qui appellent une fonction
edge (8, 10, 11, 12, 13) n'envoient **aucune clé d'API** : les fonctions ont `verify_jwt = false`
(versionné dans `supabase/config.toml`) et authentifient le job par `x-cron-secret`, lu au moment
de l'appel dans le Vault (`cron_secret`, égal au `CRON_SECRET` des fonctions). Un nouveau job
suit ce modèle ; ne jamais écrire une clé ni le secret en clair dans une commande. Changer
`CRON_SECRET` des fonctions, c'est changer **aussi** `cron_secret` dans le Vault
(`vault.update_secret`), sinon les cinq jobs reçoivent 401.

La fonction génère la semaine ISO **suivant celle du jour de l'appel** : un samedi pose donc la
semaine qui commence le lundi 9 jours plus tard. Elle est idempotente
(`box_auto_programming_runs`) — un second passage rend `kept` sans rien écrire — et refuse tout
appel sans `x-cron-secret` valide.

Régénérer une semaine à la main (les jours édités ou scorés sont conservés) :
`POST {"regen":{"box_id":"…","track":"functional"}, "iso_year":2026, "iso_week":41}` avec le même
en-tête.

Ne poser que certaines pistes : `"tracks": ["hybrid"]` dans le corps, tableau parmi
`functional | hybrid | musculation`, intersecté avec les pistes actives de la box (une piste
demandée mais inactive n'est pas générée). Absent = toutes les pistes actives, comportement
inchangé. Vaut aussi avec `regen`. Le journal garde une ligne par piste traitée. C'est ce que le
Manager appelle, un appel par piste cochée. Désactiver les deux :
`SELECT cron.unschedule('generate-box-week-cest'), cron.unschedule('generate-box-week-cet');`.

Contrôle sans effet, n'importe quel jour : exécuter la commande du job telle quelle. Hors
samedi 08:00 Paris, la garde la rend inerte et `net._http_response` ne bouge pas.

### Déployer la fonction

```bash
node scripts/deploy-edge.mjs generate-box-week
```

**Jamais `supabase functions deploy generate-box-week` en direct** : la commande
échoue en `EISDIR` sans jamais téléverser le bundle. La CLI collecte les sources
depuis l'entrée, suit la directive `@deno-types` et l'`import type` de `index.ts`
vers `packages/wod-engine/src/index.ts`, puis ouvre les spécificateurs de ce
fichier **tels quels, sans ajouter `.ts`** — et `packages/wod-engine/src/bank`
est un répertoire. Ce n'est pas réparable dans le moteur : il faudrait des
extensions `.ts` dans les imports, que TypeScript refuse, et corriger un seul
spécificateur déplace l'échec sur `./catalog`.

Le script déploie depuis une copie temporaire privée de ces deux lignes. Elles
sont type-only, donc effacées à l'exécution : la fonction déployée est identique
à ce que décrit le dépôt, qui garde son type-check.

Le bundle du moteur, lui, est commité et doit être à jour **avant** le
déploiement (`node packages/wod-engine/scripts/bundle-edge.mjs` ; le test
`edge-bundle.test.ts` refuse un bundle périmé).

`node scripts/deploy-edge.mjs generate-box-week --check` ne déploie rien et
vérifie la source. Il échoue si `index.ts` se met à importer une **valeur** hors
de son dossier : ce serait une vraie dépendance, que le script ne peut pas
retirer sans casser la fonction. Les valeurs du moteur passent par
`wod-engine.bundle.js`, voisin de l'entrée. `src/__tests__/deployEdge.test.ts`
rejoue ce contrôle.

## `tournament-notifications-sweep`

Décalé de 5 minutes après `tournament_activation_sweep` — et non planifié en
même temps : c'est l'activation qui fait passer un tournoi en `active`, et
l'annonce « le tournoi démarre » lit ce statut. Les deux au même instant
retarderaient chaque annonce d'un quart d'heure.

Ce que la fonction renvoie, et qui sert au diagnostic :

```
candidates    destinataires éligibles à cet instant (avant déduplication)
claimed       réservés par CE passage → ceux à qui on envoie réellement
sent          push effectivement partis (après filtre de préférence)
pref_disabled destinataires écartés par leur réglage tournament_updates
by_kind       répartition par famille
```

Un passage nominal en régime établi affiche `candidates > 0, claimed 0` : rien de
neuf, donc rien à envoyer. C'est le journal `tournament_notifications_sent` qui
garantit l'unicité (index unique `NULLS NOT DISTINCT`), pas l'heure de passage.

Pour repartir de zéro sur un tournoi (rejouer les annonces d'un tournoi de
test) : supprimer ses lignes du journal.

```sql
DELETE FROM tournament_notifications_sent WHERE tournament_id = '…';
```

## Vérifier qu'un job tourne vraiment

```sql
SELECT j.jobname, r.status, r.start_time, left(r.return_message, 120)
  FROM cron.job_run_details r JOIN cron.job j USING (jobid)
 WHERE j.jobname = 'tournament-notifications-sweep'
 ORDER BY r.start_time DESC LIMIT 5;
```

`status = 'succeeded'` ne prouve que l'appel HTTP, pas le résultat de la
fonction : la réponse est dans les logs de la fonction edge.

## Worktree jetable : ne jamais y relier `node_modules`

Pour exécuter une suite depuis une branche tierce, on crée un worktree — et on est
tenté d'y faire une jonction vers le `node_modules` du dépôt pour éviter un `npm ci`.
À ne pas faire : `git worktree remove --force` **suit la jonction** et vide le vrai
`node_modules`. Pire, `node_modules` contient un lien vers `modules/realtime-recorder`
(module Expo local) : la suppression a effacé ses 33 fichiers suivis dans le dépôt
(21/09/2026, restaurés par `git restore`, puis `npm ci`).

À la place, au choix :

- `npm ci --prefix <worktree>` (installation propre, jetable avec le worktree) ;
- ou copier le seul fichier à interroger dans le dépôt principal et le lire, sans worktree ;
- ou, si la jonction est vraiment nécessaire, la supprimer AVANT de retirer le worktree :
  `cmd /c rmdir "<worktree>
ode_modules"` (jamais `rm -rf`, qui suit le lien), puis
  `git worktree remove`.
