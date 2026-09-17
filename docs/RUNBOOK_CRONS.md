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
        'Authorization', '<Bearer …>', 'Content-Type', 'application/json',
        'x-cron-secret', '<CRON_SECRET>'),
      body    := '{}'::jsonb);
  END IF;
END $guard$;
```

La fonction génère la semaine ISO **suivant celle du jour de l'appel** : un samedi pose donc la
semaine qui commence le lundi 9 jours plus tard. Elle est idempotente
(`box_auto_programming_runs`) — un second passage rend `kept` sans rien écrire — et refuse tout
appel sans `x-cron-secret` valide.

Régénérer une semaine à la main (les jours édités ou scorés sont conservés) :
`POST {"regen":{"box_id":"…","track":"functional"}, "iso_year":2026, "iso_week":41}` avec le même
en-tête. Désactiver les deux :
`SELECT cron.unschedule('generate-box-week-cest'), cron.unschedule('generate-box-week-cet');`.

Contrôle sans effet, n'importe quel jour : exécuter la commande du job telle quelle. Hors
samedi 08:00 Paris, la garde la rend inerte et `net._http_response` ne bouge pas.

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
