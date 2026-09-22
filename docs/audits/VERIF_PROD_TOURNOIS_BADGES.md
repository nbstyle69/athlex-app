# Vérification en production — tournois et badges

Contrôle **en lecture seule** des constats d'un audit de code, sur les définitions
**réellement déployées** en production, l'historique des migrations en prod ne
correspondant pas aux fichiers du dépôt.

- **Date** : 21 septembre 2026.
- **Méthode** : `psql` sur `PROD_DB_URL`, chaque session ouverte par
  `SET default_transaction_read_only = on;`. Aucune écriture, aucune migration,
  aucune modification de policy, de fonction ou de job.
- **Lu** : métadonnées seulement — `pg_get_functiondef`, `pg_policies`,
  `pg_get_triggerdef`, ACL (`proacl`, `information_schema`), `cron.job` — et des
  **comptages agrégés**. Aucun contenu de ligne, aucune donnée personnelle,
  aucune donnée d'une box en particulier.
- **Comparaison repo ↔ prod** : sur le **corps** des fonctions, normalisé
  (espaces, commentaires de ligne, guillemets d'identifiants). Le baseline cite
  tous les identifiants (`"public"."profiles"`) là où Postgres les restitue nus :
  la différence n'est pas sémantique et ne doit pas faire conclure à un écart.
  Référence repo : **dernière** définition rencontrée dans `supabase/migrations/`,
  fichiers pris dans l'ordre des noms.

> **Amendement du 22 septembre 2026.** La réserve du point 3 (policy UPDATE de
> `tournament_scores`) était **partiellement fausse** : l'absence de `WITH CHECK`
> ne permettait **pas** à un athlète de faire passer sa ligne de `pending` à
> `validated`. Quand le `WITH CHECK` est absent, PostgreSQL applique l'expression
> du `USING` à la ligne écrite. Ce que l'absence laissait réellement passer est
> décrit au [point 3](#3-policies-tournament_scores). Corrigé par la migration
> `20261230000000_tournament_scores_gardes.sql` (PR #331), appliquée en prod le
> 21/09/2026.

## Synthèse

| # | Objet | Prod ≡ repo | Constat de l'audit |
|---|---|---|---|
| 1 | `badge_condition_met`, `claim_badge` — clés `mv_*` | **oui** | **confirmé** — aucune branche `mv_*`, `claim_badge` refuse |
| 2 | `increment_movement_stats` | **oui** (2 signatures) | **confirmé** — présente et identique |
| 3 | Policies `tournament_scores` INSERT / UPDATE | **oui** | **confirmé** pour l'INSERT ; UPDATE conforme à l'attendu, **avec une réserve amendée** (voir le point 3) |
| 4 | `recalc_division_points` | **oui** | **infirmé** sur les droits, **confirmé** sur l'absence de garde de rôle |
| 5 | `apply_bracket_match_elo` + `trg_bracket_match_elo` | **oui** | **confirmé** — ELO réappliqué sur réécriture |
| 6 | `end_season_and_advance` | **oui** | **confirmé** — aucune garde d'idempotence |
| 7 | `finalize_tournament_elo`, `generate_bracket_round_1`, `advance_bracket_round`, `auto_assign_lowest_division` | **oui** | **confirmé** — présentes et identiques |
| 8 | Jobs `pg_cron` d'activation des tournois | — | **installé et actif** (toutes les 15 min) |

**Les onze définitions auditées sont identiques au dépôt** (corps normalisés).
Autrement dit : les défauts relevés dans les fichiers de migration valent tels
quels pour la production — aucun correctif n'a été appliqué en prod hors dépôt,
et aucun correctif du dépôt ne manque en prod.

---

## 1. Badges de mouvement `mv_*`

**Prod identique au repo : oui** (`badge_condition_met` de `20261116_lot5c_programmes_par_box.sql`,
`claim_badge` de `20261018_badges_attribution_serveur.sql`).

**Constat confirmé.** La condition ne connaît aucune clé `mv_*` : elle traite
`level_*`, `first_score`, `first_win`, `champion_5`, `podium`, `veteran_10`,
`social_5`, `chatty_50`, puis retombe sur la branche par défaut.

```sql
-- public.badge_condition_met(uuid, text), extrait de la définition prod
    ELSE
      -- Badge sans source serveur fiable : jamais réclamable.
      RETURN false;
  END CASE;
```

`claim_badge` n'a pas de chemin propre : elle refuse dès que la condition est
fausse, donc **toute réclamation d'un badge `mv_*` répond `condition_non_remplie`**.

```sql
-- public.claim_badge(text), extrait de la définition prod
  IF NOT public.badge_condition_met(v_uid, p_badge_key) THEN
    RETURN jsonb_build_object('ok', false, 'awarded', false,
                              'badge_key', p_badge_key, 'reason', 'condition_non_remplie');
  END IF;
```

**Comptages (agrégats).**

| Mesure | `mv_*` | Total |
|---|---|---|
| `badges_catalog` | **187** | 208 |
| `athlete_badges` (attributions) | **1 893** | 2 624 |

Les 187 badges `mv_*` publiés au catalogue couvrent 45 familles de mouvements
(`pullup`, `hspu`, `row`, `run`, `snatch`, `thrusters`…). **Le catalogue propose
donc 187 badges que le serveur refuse d'attribuer.**

**Point à instruire, hors périmètre de cette vérification.** Les 1 893
attributions `mv_*` existent bien alors que `claim_badge` ne peut pas les poser.
Ce que les métadonnées établissent :

- `claim_badge` est la **seule** fonction de la base qui écrit dans
  `athlete_badges` (recherche sur le corps de toutes les fonctions `plpgsql`/`sql`
  du schéma `public`) ;
- la RLS est **activée** sur `athlete_badges` (non forcée) et la seule policy
  qui autorise une insertion est `badges_admin_write`
  (`is_box_admin_of_athlete(athlete_id)`) ; `authenticated` détient les droits de
  table `INSERT/UPDATE/DELETE`, mais aucune policy ne lui ouvre l'insertion pour
  lui-même ;
- ces attributions sont datées du **29/07/2026 au 04/09/2026**, soit **après** la
  mise en place de la garde serveur (18/10/2025) : ce ne sont pas des reliquats
  antérieurs.

Restent comme routes possibles un appel en `service_role` (qui contourne la RLS)
ou une écriture d'administrateur de box. **Déterminer l'écrivain exact demande
les journaux ou une lecture de lignes**, exclus de ce mandat.

## 2. `increment_movement_stats`

**Présente en prod, identique au repo : oui.** La fonction existe en **deux
signatures**, conformément au dépôt (`20261204_movement_stats_unit.sql`, qui
documente la coexistence : « la signature 4 arguments reste en place ») :

| Signature | `SECURITY DEFINER` | EXECUTE |
|---|---|---|
| `(p_user_id uuid, p_movement text, p_reps integer, p_weight numeric)` | oui | `authenticated`, `service_role` |
| `(…, p_unit text)` | oui | `authenticated`, `service_role` |

Les deux corps sont identiques au dépôt. La fonction n'écrit que dans
`user_movement_stats` (unité contrôlée `reps` / `m` / `cal`, cible forcée à
`auth.uid()` hors `service_role`) : **elle n'attribue aucun badge**, et aucun
trigger n'est posé sur `user_movement_stats`.

## 3. Policies `tournament_scores`

**Prod identique au repo : oui** — INSERT de `20261016_garde_wod_ferme.sql`,
UPDATE de `20261017_resserrage_role_box_owner.sql`.

**INSERT — les trois constats sont confirmés.**

```sql
-- policy tournament_scores_owner_insert, WITH CHECK (prod)
(((auth.uid() = athlete_id) AND tournament_wod_accepts_scores(tournament_wod_id, tournament_id))
 OR (EXISTS (SELECT 1 FROM tournaments t
              WHERE t.id = tournament_scores.tournament_id AND is_box_admin(t.box_id))))
```

- **`status = 'pending'` n'est pas imposé** : la colonne n'apparaît pas dans le
  `WITH CHECK`. Un athlète peut insérer sa ligne avec le statut de son choix.
- **L'inscription au tournoi n'est pas vérifiée** : aucune référence à
  `tournament_participants`.
- **L'appartenance à la box n'est pas vérifiée** pour la branche athlète.

Le seul garde-fou complémentaire est `tournament_wod_accepts_scores`, qui ne
regarde que l'état du WOD — ni l'inscription, ni la box :

```sql
-- public.tournament_wod_accepts_scores(uuid, uuid), corps intégral (prod)
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_wods w
     WHERE w.id = p_wod_id AND w.tournament_id = p_tournament_id
       AND w.status = 'active'
       AND (w.opens_at IS NULL OR w.opens_at <= now())
       AND (w.closes_at IS NULL OR w.closes_at > now()));
```

**UPDATE — l'exigence attendue est bien là, avec une réserve.** La policy
`tournament_scores_owner_update_pending` impose `status = 'pending'` **sur
l'ancienne ligne** (clause `USING`), ce qui répond à la question posée :

```sql
-- policy tournament_scores_owner_update_pending, USING (prod)
(((auth.uid() = athlete_id) AND (status = 'pending'::text)
  AND tournament_wod_accepts_scores(tournament_wod_id, tournament_id))
 OR (EXISTS (SELECT 1 FROM tournaments t
              WHERE t.id = tournament_scores.tournament_id AND is_box_admin(t.box_id))))
```

**Réserve relevée pendant la vérification, amendée le 22/09/2026.** Cette policy
**n'a pas de `WITH CHECK`** (`pg_policies.with_check` est nul) : le fait est
exact, la conséquence qui en était tirée ne l'était pas. Il était écrit ici qu'un
athlète dont la ligne est `pending` pouvait lui donner un autre statut, « y
compris celui qu'un organisateur poserait à la validation ». **C'est faux** :
quand le `WITH CHECK` est absent, PostgreSQL applique l'expression du `USING` à
la ligne **écrite** autant qu'à la ligne lue. Le `status = 'pending'` du `USING`
contraignait donc aussi la nouvelle ligne, et `pending` → `validated` était
**déjà refusé** en production.

Ce que l'absence de `WITH CHECK` laissait réellement passer, mesuré sur base de
rejeu dans l'état d'avant correctif :

- **la trace de modération était forgeable.** Aucune colonne n'était protégée :
  un athlète pouvait écrire `admin_message`, `validated_by` et `validated_at`
  sur sa propre ligne restée `pending` (1 ligne modifiée, sans erreur).
- **la correction d'un score rejeté échouait en silence.** Le `USING` n'accepte
  que `pending` : l'`UPDATE` que l'app propose sur une ligne `rejected`
  (`TournamentWODScreen.tsx`) portait sur **0 ligne**, sans erreur remontée au
  client — l'athlète croyait sa correction enregistrée.

Le correctif élargit le `USING` à `rejected` pour rouvrir cette correction ; le
`WITH CHECK` explicite y devient alors **nécessaire**, puisque le repli sur le
`USING` laisserait sinon l'athlète écrire `rejected` sur sa propre ligne.

## 4. `recalc_division_points`

**Prod identique au repo : oui** (`20261012_build_phase1_pr6_capped_ranking.sql`).

**Constat sur les droits : infirmé.** `authenticated` **n'a pas** l'EXECUTE en
production ; l'ACL ne l'accorde qu'à `postgres` et `service_role`, et aucun droit
n'est laissé à `PUBLIC` :

```
recalc_division_points : postgres=X/postgres , service_role=X/postgres
```

**Constat sur la garde de rôle : confirmé.** Le corps ne contient **aucune**
vérification d'appelant (ni `auth.uid()`, ni `is_tournament_manager`, ni
`is_box_admin`) ; le seul filtre est le format du tournoi :

```sql
-- public.recalc_division_points(uuid), en-tête du corps (prod)
  SELECT format INTO v_format FROM public.tournaments WHERE id = p_tournament_id;
  IF v_format IS DISTINCT FROM 'league_div' THEN
    RETURN;
  END IF;
```

La fonction est `SECURITY DEFINER` : elle n'est aujourd'hui hors de portée d'une
session cliente que par ses droits d'exécution. Tout futur `GRANT EXECUTE` à
`authenticated` la rendrait appelable sur **n'importe quel** tournoi `league_div`.

## 5. `apply_bracket_match_elo` et `trg_bracket_match_elo`

**Prod identique au repo : oui** (baseline `20260301000000_baseline_prod_schema.sql`).

**Constat confirmé : l'ELO est réappliqué quand un match déjà `completed` est
réécrit.** Le trigger se déclenche sur toute écriture des colonnes surveillées :

```sql
CREATE TRIGGER trg_bracket_match_elo AFTER INSERT OR UPDATE OF winner_id, status
  ON public.tournament_bracket_matches FOR EACH ROW EXECUTE FUNCTION apply_bracket_match_elo()
```

Dans la fonction, l'annulation du résultat précédent est conditionnée au
**changement de vainqueur** :

```sql
  IF TG_OP = 'UPDATE' AND OLD.winner_id IS DISTINCT FROM NEW.winner_id THEN
    -- … retrait de l'ELO précédent, purge de tournament_match_elo_history …
  END IF;
```

La branche d'application, elle, ne vérifie **pas** que l'ELO a déjà été porté
pour ce match : le garde-fou d'unicité ne protège que l'historique, tandis que
les deux `UPDATE profiles` s'exécutent inconditionnellement.

```sql
  INSERT INTO tournament_match_elo_history (…)
    VALUES (…)
    ON CONFLICT (match_id, athlete_id) DO NOTHING;   -- historique protégé

  UPDATE profiles SET elo = v_after_w, total_matches = total_matches + 1, wins = wins + 1 WHERE id = v_win;
  UPDATE profiles SET elo = v_after_l, total_matches = total_matches + 1                  WHERE id = v_lose;
```

Conséquence : une réécriture d'un match terminé **sans changer le vainqueur**
(ré-affectation de `status`, correction d'une autre colonne suivie d'une remise à
`completed`, rejeu d'un script) recalcule un delta à partir de l'ELO **déjà
modifié** et l'applique une seconde fois, en incrémentant à nouveau
`total_matches` et `wins`. L'historique, lui, reste à une ligne par athlète : la
dérive n'y est pas visible.

## 6. `end_season_and_advance`

**Prod identique au repo : oui** (baseline, droits repris par
`20261112_grants_execute_explicites.sql` ; EXECUTE à `authenticated` et
`service_role`).

**Constat confirmé : aucune garde d'idempotence.** Les deux seules gardes sont
l'autorisation de l'appelant et le format du tournoi :

```sql
  IF NOT public.is_tournament_manager(p_tournament_id) THEN
    RAISE EXCEPTION 'Not authorized: only the box owner/coach or an admin can manage this tournament';
  END IF;
  …
  IF v_format <> 'league_div' THEN
    RAISE EXCEPTION 'Tournament % is not a league_div tournament', p_tournament_id;
  END IF;
```

Rien ne vérifie que la saison en cours a déjà été clôturée, et la fin de fonction
se contente d'incrémenter le compteur :

```sql
  -- ── 5. Increment current_season ──────────────────────────────────────
  UPDATE public.tournaments SET current_season = v_season + 1 …
  RETURN v_season + 1;
```

Un second appel refait donc le cliché des classements, rejoue promotions et
relégations, et avance la saison une fois de plus.

## 7. Fonctions de bracket et d'affectation

**Toutes présentes en prod, corps identiques au dépôt.**

| Fonction | Présente | Identique | `SECURITY DEFINER` | EXECUTE |
|---|---|---|---|---|
| `finalize_tournament_elo(uuid)` | oui | oui | oui | `authenticated`, `service_role` |
| `generate_bracket_round_1(uuid)` | oui | oui | oui | `authenticated`, `service_role` |
| `advance_bracket_round(uuid, integer)` | oui | oui | oui | `authenticated`, `service_role` |
| `auto_assign_lowest_division()` | oui | oui | oui | `authenticated`, `service_role` |

Référence repo : `20261128_finalize_tournament_elo.sql` pour la première, le
baseline pour les trois autres.

## 8. Jobs `pg_cron` liés aux tournois

**Installé et actif.**

| Job | Fréquence | Actif | Commande |
|---|---|---|---|
| `tournament_activation_sweep` | `*/15 * * * *` | oui | `SELECT public.sync_tournament_activation();` |
| `tournament-notifications-sweep` | `5,20,35,50 * * * *` | oui | appel edge `tournament-notifications-cron` |

`sync_tournament_activation` existe en prod, en `SECURITY DEFINER`. Le job est
déclaré dans le dépôt par `20261015_tournoi_activation_auto.sql` et documenté
dans `docs/RUNBOOK_CRONS.md`. La commande du sweep d'activation est un appel de
fonction, sans jeton.

---

## Ce que cette vérification n'établit pas

- **L'origine des 1 893 attributions `mv_*`** (point 1) : hors de portée d'une
  lecture de métadonnées.
- **L'exploitation réelle** des écarts des points 3, 5 et 6 : aucun test d'écriture
  n'a été tenté, conformément au mandat. Les constats portent sur ce que les
  définitions déployées autorisent, pas sur ce qui s'est produit.
- **Les tables `daily_tournament_scores` et `inter_scores`**, hors périmètre
  demandé, dont les policies n'ont pas été relues.
