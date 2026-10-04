# Notifications push au gérant (D4a) — note de conception

Aucune notification push n'est envoyée aujourd'hui au gérant d'une box. Quatre
événements, textes validés par Nab, partent désormais au gérant et à ses
co-gérants. Trois PR :

| PR | Contenu | Prod |
| --- | --- | --- |
| A | migration `20270143` : file `box_manager_notifications` + déclencheurs | appliquée le 04/10/2026, 10:16 UTC |
| B | fonction edge `deliver-manager-notifications` (envoi) | déployée le 04/10/2026, 10:19 UTC |
| C | migration `20270144` : tâches pg_cron (envoi chaque minute, purge) | appliquée le 04/10/2026, 10:19 UTC |

Ordre d'application : A, puis B (déploiement), puis C. A seule remplit la file
sans rien envoyer ; B sans C ne tourne jamais.

## Relevé de prod (04/10/2026, lecture seule)

`SET default_transaction_read_only = on` en tête, métadonnées, md5 calculés par
la base et agrégats seulement.

- `box_members` : `subscription_status`, `stripe_subscription_id`,
  `past_due_since`, `plan_id`, `member_id`, `box_id`, `role`, `status`.
  Agrégats : 151 actifs au comptoir, 8 actifs Stripe, 1 résilié Stripe,
  23 sans statut, aucun impayé en cours.
- `box_member_alerts` (20270133) : vide. `box_invitations` : 2 acceptées,
  1 en attente. `push_tokens.language` : 3 `fr`, 14 sans langue. 4 box, aucune
  archivée.
- Déclencheurs existants (md5 de `pg_get_functiondef`, non redéfinis — la PR A
  ajoute des déclencheurs séparés) :

  | table | déclencheur | fonction | md5 |
  | --- | --- | --- | --- |
  | box_members | trg_box_member_count | update_box_member_count | 82f49d0983b45d1cecedb5f826382e0a (porte des CR ; rejeu 163d943f…) |
  | box_members | trg_box_members_entree_box | internal.refuser_entree_directe_box | 73b868ed7881131d0e746a9b95645c0d |
  | box_members | trg_box_members_garde_cogerant | internal.garder_role_cogerant | a3f6d592e30b88f0099e3e3e0f27e08f |
  | box_members | trg_box_members_garde_facturation | internal.garder_facturation_membre | 2c8c6335dd9ec48f9e2899af6f24dffc |
  | box_members | trg_release_reservations_on_revoke | release_reservations_on_revoke | 5970975ea59649147d9c59a99caa93e8 |
  | box_members | trg_sync_member_plan_groups | sync_member_plan_groups | b27819449b9a72407fbce288e8727121 |
  | box_invitations | trg_box_invitations_entree_box | internal.refuser_entree_directe_box | 73b868ed7881131d0e746a9b95645c0d |
  | class_reservations | trg_zz_alerte_sans_formule | internal.alerter_reservation_sans_formule | c7d278376a5fd40f7370e3b5da50f263 |

  `box_member_alerts` n'a aucun déclencheur. Référence :
  `is_box_owner_admin` e61752a60abf9ec18f3b5e0571cc3c4f (identique au dépôt),
  `is_box_owner` aa0186463d1c06497093850cb591357f.
- pg_cron : 13 tâches ; celles qui appellent une fonction edge lisent
  `x-cron-secret` dans le Vault (secret `cron_secret`, seul secret du Vault).

## Qui écrit ces colonnes (webhook Stripe du Manager, lu le 04/10/2026)

`AthleX-Manager/app/api/stripe-connect-webhook/route.ts`, clé serveur :

- première activation : `activateMembership` (checkout.session.completed,
  y compris l'abonnement différé) écrit **dans la même écriture**
  `subscription_status = 'active'` et `stripe_subscription_id` (INSERT si le
  membre n'a pas de ligne, UPDATE sinon) ; sans compte, la même chose arrive
  plus tard par `claim_pending_entitlements` ;
- `invoice.paid` : UPDATE aveugle à chaque échéance, `subscription_status =
  'active'`, `past_due_since = NULL` ;
- `invoice.payment_failed` : `subscription_status = 'past_due'`,
  `past_due_since` posé seulement s'il est NULL (la date du premier échec est
  gardée pendant les relances), `dunning_attempts + 1` ;
- `customer.subscription.updated` : actif / essai → `active`, impayé →
  `past_due`, le reste → `cancelled`, sous le même identifiant ;
- comptoir (`record_member_cash_payment`, `mark_box_invitation_paid`,
  invitation « payé ») : `subscription_status = 'active'`,
  `stripe_subscription_id` NULL ;
- invitations : `_consume_box_invitation` (et `accept_box_invitation_after_payment`)
  passe `box_invitations.status` de `pending` à `accepted`, avec `accepted_by`.

## Déclencheurs (PR A) : la transition réelle, jamais chaque mise à jour

Une fonction, `internal.filer_notification_gerant()` (SECURITY DEFINER,
EXECUTE fermé à anon et authenticated), cinq déclencheurs AFTER ligne par
ligne dont la clause `WHEN` porte la transition :

| type | déclencheur | condition | `event_ref` |
| --- | --- | --- | --- |
| subscription_paid | `trg_notif_gerant_abonnement_creation` (INSERT box_members) | `subscription_status = 'active'` et `stripe_subscription_id` non NULL | identifiant Stripe |
| subscription_paid | `trg_notif_gerant_abonnement_nouveau` (UPDATE OF subscription_status, stripe_subscription_id) | idem, et `stripe_subscription_id` **change** | identifiant Stripe |
| payment_failed | `trg_notif_gerant_impaye` (UPDATE OF past_due_since) | `past_due_since` passe de NULL à une date | id du membre + date |
| booked_without_plan | `trg_notif_gerant_sans_formule` (INSERT box_member_alerts) | `kind = 'reservation_sans_formule'` | id de l'alerte |
| invitation_accepted | `trg_notif_gerant_invitation` (UPDATE OF status box_invitations) | passe à `accepted` | id de l'invitation |

« Nouvel abonnement » = **un nouvel identifiant d'abonnement Stripe arrive
actif**, pas « statut vers actif » : le retour d'impayé, la reprise après pause
et chaque renouvellement repassent à `active` sous le même identifiant, et ne
doivent rien envoyer ; le comptoir n'a pas d'identifiant. Le réabonnement après
résiliation crée un nouvel identifiant : il notifie.

« Inscription sans formule » suit l'alerte de 20270133, qui n'en ouvre qu'une
par membre et par box tant qu'elle n'est pas résolue : une deuxième inscription
sans formule avant résolution ne notifie pas. L'heure du cours est calculée à
la mise en file (`scheduled_date + start_time` à Paris), la réservation
pouvant être annulée avant l'envoi.

Une box archivée ne met rien en file. Une erreur de mise en file est rattrapée
(WARNING `NOTIF_GERANT_NON_FILEE`) : **la notification ne bloque jamais le
paiement, la réservation ou l'invitation qui la déclenche.**

## La file (PR A)

`public.box_manager_notifications` : `box_id`, `type`, `event_ref`,
`member_id`, `plan_id`, `class_starts_at`, `actor_id`, `created_at` ; pour
l'envoi `claimed_at`, `sent_at`, `delivered_count`, `attempts`, `last_error`.
Les noms (pseudo, formule, box) ne sont pas copiés : ils sont relus à l'envoi.

- **Anti-doublon** : clé unique `(type, event_ref)` + `ON CONFLICT DO NOTHING`.
  Un événement n'entre qu'une fois, même si un webhook est rejoué.
- **Droits** : RLS active sans règle ; aucun droit pour `anon` et
  `authenticated` ; `service_role` lit la table et n'écrit que `claimed_at`,
  `sent_at`, `delivered_count`, `attempts`, `last_error`. Contrôle T14 de
  l'audit des droits.

## Envoi (PR B) : `deliver-manager-notifications`

Appelée seulement par pg_cron avec `x-cron-secret` (401 sinon,
`verify_jwt = false` versionné), clé serveur par `_shared/cle-secrete.ts`.
Règles dans `regles.ts`, testées par Jest.

1. Lit au plus 50 lignes `sent_at IS NULL`, `claimed_at IS NULL`,
   `attempts < 5`, créées depuis moins de 24 h (une file restée en attente —
   fonction pas encore déployée, panne — ne déverse pas de vieilles alertes).
2. **Réserve** chaque ligne avant d'envoyer : `UPDATE … SET claimed_at = now(),
   attempts = n + 1 WHERE id = … AND sent_at IS NULL AND claimed_at IS NULL AND
   attempts = n`, avec retour de ligne ; aucune ligne → une autre exécution l'a
   prise, on passe (comme la réservation de la PR #456).
3. **Destinataires**, par leur compte, jamais par une ligne de membre :
   `boxes.owner_id` + `box_members` `role = 'owner'` actif (statut actif ou
   absent). C'est `is_box_owner_admin` **sans** la branche « administrateur de
   la plateforme » : celle-ci ouvre un droit d'accès, ce n'est pas un rôle dans
   la box (sinon chaque admin recevrait les événements de toutes les box).
   Coach et membre simple ne reçoivent rien. L'auteur de l'événement
   (`actor_id`, le gérant qui a inscrit le membre) n'est pas notifié de son
   propre geste. Interrupteur général des notifications coupé
   (`notifications_enabled = false`) → rien pour ce compte.
4. **Texte** dans la langue de chaque jeton (`push_tokens.language` `en` →
   anglais, sinon français, comme `send-push`), `{membre}` = `profiles.username`
   (le pseudo affiché dans l'app), jamais l'e-mail ; `{heure}` en
   Europe/Paris.
5. **Envoi** direct à Expo, comptage comme `send-box-notification` : appareils
   acceptés = tickets `ok`.
6. **Résultat** : succès → `sent_at`, `delivered_count` (0 compris : aucun
   destinataire, aucun jeton). Échec (Expo injoignable ou en erreur, lecture
   en échec) → `claimed_at` remis à NULL, `last_error` = un code court sans
   donnée personnelle (`expo_http_503`, `expo_injoignable`, `lecture_…`) :
   nouvelle tentative à la minute suivante, jusqu'à 5. Box archivée entre-temps
   → `sent_at`, 0 appareil, `last_error = 'box_archivee'`.
7. **Plantage** entre la réservation et le résultat (délai de la fonction
   dépassé) : la ligne garde `claimed_at` sans `sent_at` et n'est jamais
   reprise — un double envoi est pire qu'un oubli. Visible par
   `SELECT … WHERE claimed_at IS NOT NULL AND sent_at IS NULL AND claimed_at < now() - interval '5 minutes'`.

Données de la notification : `{ type, box_id }`. **Au toucher, l'app s'ouvre
simplement** : `src/services/notificationRouter.ts` ignore les types inconnus.
L'onglet Membres du gérant existe (`BoxOwnerTabs` → `BOMembers`) mais n'est
monté que pour un compte en mode gérant ; l'y conduire demande une PR d'app, reportée par Nab après la sortie App Store (04/10/2026).

## Purge (PR C)

Tâche pg_cron quotidienne : suppression des lignes créées il y a plus de
30 jours (envoyées, abandonnées après 5 tentatives, ou trop vieilles).

## Tests

- SQL : `supabase/tests/notifications_gerant_file.sql` (F0 à F9), rejoué par
  `scripts/db-replay.sh` (CI db-replay, sur chaque PR) ; mutations intégrées
  et retour arrière.
- Audit des droits : T14 (`scripts/lib/controle-grants-tables.mjs`).
- Jest : `src/__tests__/deliverManagerNotificationsRegles.test.ts` (PR B).
