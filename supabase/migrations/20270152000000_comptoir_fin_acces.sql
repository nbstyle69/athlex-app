-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR 2 sur 6 : fin d'accès et file des messages
-- (base)
--
-- Appliquée en prod : OUI, le 13/10/2026 à 20:46 UTC, avec PGCLIENTENCODING=UTF8,
-- en une transaction (psql -1), sur GO de Nab. Dump des schémas public et
-- internal avec droits db-dumps/2026-10-13/athlex-prod-public-internal-20261013T204546Z.dump,
-- sha256 277761e5ea794f2be1e5e85a219b69d79ecc1bb95191f29e6e8765585d753724
-- vérifié après aller-retour, 138 TABLE DATA, 469 ACL, 348 POLICY ;
-- précontrôles (trois passages identiques, search_path de la prod) :
-- get_my_membership_billing à b4ca5500…, une version ; 20270151 en place (dix
-- définitions et deux déclencheurs aux empreintes de son en-tête) ; table,
-- cinq fonctions et tâche absentes ; effet de la première passe mesuré avant :
-- 0 membre à couper, 0 message J−7/J−1 ; box_members (186), class_reservations
-- (1183) et member_class_credits (1) relevés ; 15 tâches pg_cron relevées
-- (commandes comprises). Vérifications : les cinq définitions aux empreintes
-- du test (2104eb38…, ab6b46e8…, 6733b1b3…, 062d67dd…, e1ea48e6…), une version
-- de chaque ; get_my_membership_billing à authenticated et service_role
-- seulement, fonctions internal fermées à anon, authenticated et service_role ;
-- table : RLS sans règle, rien pour les clients, service_role en SELECT et
-- UPDATE des cinq colonnes d'envoi ; commentaires présents ; tâche
-- comptoir-fin-acces à « 41 * * * * », active, commande attendue (4c532b48…),
-- les 15 autres inchangées ; file vide, les trois tables à la même empreinte.
-- Test réel sur AthleX Fitness en transaction annulée (membre fictif à formule
-- payante, réservation à venir) : coupé ('expired', status 'active'),
-- réservation supprimée, 'fin' en file, second appel sans effet, 'j7' une seule
-- fois, 'j1', get_my_membership_billing sous son identité (fin d'accès,
-- box_sells_online vrai) ; aucune trace. Audit des droits en prod 45/45 (T18)
-- lancé depuis la branche. Première passe de la tâche le 13/10/2026 à
-- 21:41:00 UTC : succeeded en 0,2 s, aucun membre coupé, file vide.
--
-- Spec validée par Nab le 13/10/2026 (Figma « AthleX Manager — Back-office »,
-- page « 🧪 Spec · Paiements au comptoir (P1) », §4 et §6). Part des
-- définitions de prod (master + 20270151, appliquée le 13/10/2026 à 14:54 UTC).
-- Empreinte de prod redéfinie ici (md5 de pg_get_functiondef, search_path
-- "$user", public, extensions), rétablie par le retour arrière :
--   public.get_my_membership_billing()   b4ca55006146fc83bc3da8eff1260234
-- L'Edge Function d'envoi (PR 3), le Manager (PR 4, 5) et l'app (PR 6) viennent
-- après. Aucune donnée existante n'est modifiée par la migration elle-même ;
-- la tâche planifiée agit ensuite, toutes les heures.
--
-- 1. Adhésions suivies : internal.adhesions_comptoir_datees(), un seul endroit
--    pour les filtres. Membre (role = 'member') actif, sans abonnement Stripe,
--    avec une fin d'accès au comptoir (cash_access_until), statut d'abonnement
--    active, trialing ou past_due, formule payante (price_cents > 0 : une
--    formule à 0 € n'a pas de date de fin, spec P1), box non archivée. Une box
--    archivée est masquée à ses membres (règle boxes_hide_archived) : ils ont
--    déjà perdu l'accès. Une box en archivage programmé reste suivie : ses
--    membres gardent l'accès jusqu'à l'archivage (20270127).
-- 2. Fin d'accès : internal.expirer_acces_comptoir(). Le lendemain de
--    cash_access_until (jour de Paris), subscription_status passe à 'expired' ;
--    status reste 'active', le membre reste dans la box, et le refus
--    NO_ACTIVE_PLAN (internal.membre_a_formule) et le bandeau « Formule à
--    activer » existants font le reste. Ses réservations à partir d'aujourd'hui
--    (jour de Paris) dans la box sont supprimées, comme le fait
--    release_reservations_on_revoke à la sortie de l'état actif (son
--    déclencheur ne se lève que sur UPDATE OF status) ; une ligne 'fin' entre
--    dans la file. Rend le nombre de membres coupés. Un nouvel encaissement
--    (record_member_cash_payment) remet 'active' et pose une nouvelle fin.
--    Déclencheurs levés par la coupure :
--      box_members, UPDATE OF subscription_status :
--        trg_box_members_garde_facturation : laisse passer le serveur
--          (current_user ni authenticated ni anon) ;
--        trg_notif_gerant_abonnement_nouveau : sa condition exige un
--          abonnement Stripe, donc rien ;
--        trg_box_member_count : recompte les membres actifs, inchangé (status
--          reste 'active') ;
--        trg_box_members_garde_cogerant : rien pour un membre ;
--        trg_release_reservations_on_revoke, trg_sync_member_plan_groups,
--          trg_notif_gerant_impaye : ne se lèvent pas (colonnes non écrites).
--      class_reservations, DELETE des réservations à venir :
--        trg_refund_credit : rend le crédit d'une réservation payée par
--          carnet, à 5 h ou plus du début, comme une annulation ;
--        trg_promote_waiting : promeut la liste d'attente du créneau libéré.
--      Aucune notification au gérant, aucune alerte (alerter_reservation_
--      sans_formule ne se lève qu'à l'INSERT).
-- 3. File des messages au membre : public.box_member_access_notices, sur le
--    modèle de box_manager_notifications (20270143) : RLS active sans aucune
--    règle, rien pour anon ni authenticated, service_role lit et n'écrit que
--    les colonnes d'envoi. Une ligne par (adhésion, message, fin d'accès) : un
--    nouvel encaissement change la fin, la période suivante a ses messages.
--    internal.filer_avis_fin_acces() : 'j7' quand il reste de 2 à 7 jours,
--    'j1' quand il reste 1 jour ou moins (accès pas encore échu).
--    internal.purger_avis_fin_acces() : lignes envoyées depuis plus de 90 jours.
-- 4. Tâche pg_cron « comptoir-fin-acces », toutes les heures à la 41e minute
--    (minute libre : les tâches horaires tombent à 0, 5, 7, 10, 15, 20, 30,
--    35, 45 et 50, plus la tâche de chaque minute), SQL seulement : avis,
--    coupure, purge. Créée de manière idempotente.
-- 5. public.get_my_membership_billing() rend en plus, en fin de résultat,
--    cash_access_until et box_sells_online (internal.box_vend_en_ligne). Le
--    type de retour change : DROP puis CREATE, corps de prod repris, droits
--    (authenticated, service_role) et commentaire reposés à l'identique.
--    Appelants (lecture par nom de colonne, les colonnes ajoutées en fin ne
--    les cassent pas) : app src/services/membership.ts, gamification.ts ;
--    Manager app/compte/page.tsx, app/box/[slug]/MembershipManageButton.tsx ;
--    aucune Edge Function.
-- Crédits de séances (constat, rien de changé) : un membre 'expired' qui n'a
-- qu'un carnet épuisé ou expiré passe le contrôle NO_ACTIVE_PLAN
-- (membre_a_formule compte toute ligne de crédits) mais est refusé par
-- consume_credit_on_reservation (NO_CREDITS_LEFT) quand la place serait
-- confirmée ; sur un créneau plein il entre en liste d'attente et n'en est
-- jamais promu (la promotion passe par le même contrôle). Aucune place n'est
-- prise sans abonnement valable ni crédit utilisable : figé par le test.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Adhésions suivies ─────────────────────────────────────────────────────

CREATE FUNCTION internal.adhesions_comptoir_datees()
 RETURNS TABLE(box_member_id uuid, box_id uuid, member_id uuid, access_until date)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT bm.id, bm.box_id, bm.member_id, bm.cash_access_until
    FROM public.box_members bm
    JOIN public.boxes b ON b.id = bm.box_id
    JOIN public.membership_plans mp ON mp.id = bm.plan_id
   WHERE bm.role = 'member'
     AND bm.status = 'active'
     AND bm.stripe_subscription_id IS NULL
     AND bm.cash_access_until IS NOT NULL
     AND bm.subscription_status IN ('active', 'trialing', 'past_due')
     AND mp.price_cents > 0
     AND b.archived_at IS NULL;
$function$;
REVOKE ALL ON FUNCTION internal.adhesions_comptoir_datees() FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION internal.adhesions_comptoir_datees() IS
  'Adhésions au comptoir à fin d''accès suivie : membre actif sans abonnement Stripe, formule payante, box non archivée.';

-- ── 3. File des messages au membre ───────────────────────────────────────────

CREATE TABLE public.box_member_access_notices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id        uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  box_member_id uuid NOT NULL REFERENCES public.box_members(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('j7', 'j1', 'fin')),
  -- Fin d'accès à laquelle le message se rapporte : un nouvel encaissement la
  -- change, la période suivante a ses propres messages.
  access_until  date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Envoi (clé serveur seulement, PR 3).
  reserved_at   timestamptz,
  sent_at       timestamptz,
  push_count    integer CHECK (push_count >= 0),
  email_sent    boolean,
  error         text,
  CONSTRAINT box_member_access_notices_une_fois UNIQUE (box_member_id, kind, access_until)
);
COMMENT ON TABLE public.box_member_access_notices IS
  'File des messages de fin d''accès au comptoir (J−7, J−1, fin). Remplie par internal.filer_avis_fin_acces et internal.expirer_acces_comptoir, vidée par la fonction edge d''envoi. Fermée aux clients.';
CREATE INDEX box_member_access_notices_a_envoyer
  ON public.box_member_access_notices (created_at) WHERE sent_at IS NULL;

ALTER TABLE public.box_member_access_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.box_member_access_notices FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.box_member_access_notices TO service_role;
GRANT UPDATE (reserved_at, sent_at, push_count, email_sent, error)
  ON TABLE public.box_member_access_notices TO service_role;

CREATE FUNCTION internal.filer_avis_fin_acces()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_n     integer;
BEGIN
  INSERT INTO public.box_member_access_notices (box_id, member_id, box_member_id, kind, access_until)
  SELECT a.box_id, a.member_id, a.box_member_id,
         CASE WHEN a.access_until - v_today <= 1 THEN 'j1' ELSE 'j7' END,
         a.access_until
    FROM internal.adhesions_comptoir_datees() a
   WHERE a.access_until >= v_today
     AND a.access_until - v_today <= 7
  ON CONFLICT ON CONSTRAINT box_member_access_notices_une_fois DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION internal.filer_avis_fin_acces() FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION internal.filer_avis_fin_acces() IS
  'Met en file les messages J−7 (2 à 7 jours restants) et J−1 (1 jour ou moins) des accès au comptoir pas encore échus.';

CREATE FUNCTION internal.purger_avis_fin_acces()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_n integer;
BEGIN
  DELETE FROM public.box_member_access_notices WHERE sent_at < now() - interval '90 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION internal.purger_avis_fin_acces() FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION internal.purger_avis_fin_acces() IS
  'Purge les messages de fin d''accès envoyés depuis plus de 90 jours.';

-- ── 2. Fin d'accès ───────────────────────────────────────────────────────────

CREATE FUNCTION internal.expirer_acces_comptoir()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_n     integer;
BEGIN
  -- Les conditions de date et de statut sont reprises dans l'UPDATE : un
  -- encaissement concurrent qui vient de poser une nouvelle fin n'est pas
  -- coupé (elles sont réévaluées sur la ligne verrouillée).
  WITH coupes AS (
    UPDATE public.box_members bm
       SET subscription_status = 'expired'
     WHERE bm.id IN (SELECT a.box_member_id FROM internal.adhesions_comptoir_datees() a
                      WHERE a.access_until < v_today)
       AND bm.cash_access_until < v_today
       AND bm.subscription_status IN ('active', 'trialing', 'past_due')
    RETURNING bm.id, bm.box_id, bm.member_id, bm.cash_access_until
  ), liberees AS (
    -- Même clause que release_reservations_on_revoke, au jour de Paris.
    DELETE FROM public.class_reservations cr
     USING public.class_schedules cs, coupes c
     WHERE cs.id = cr.schedule_id
       AND cr.member_id = c.member_id
       AND cr.box_id    = c.box_id
       AND cs.scheduled_date >= v_today
    RETURNING cr.id
  ), avis AS (
    INSERT INTO public.box_member_access_notices (box_id, member_id, box_member_id, kind, access_until)
    SELECT c.box_id, c.member_id, c.id, 'fin', c.cash_access_until FROM coupes c
    ON CONFLICT ON CONSTRAINT box_member_access_notices_une_fois DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM coupes;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION internal.expirer_acces_comptoir() FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION internal.expirer_acces_comptoir() IS
  'Coupe l''accès des membres au comptoir le lendemain de leur fin d''accès : subscription_status ''expired'', réservations à venir supprimées, message ''fin'' en file. Rend le nombre de membres coupés.';

-- ── 4. Tâche planifiée ───────────────────────────────────────────────────────

DO $migration$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron indisponible : la fin d''accès au comptoir ne sera pas appliquée.';
    RETURN;
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'comptoir-fin-acces';
  PERFORM cron.schedule('comptoir-fin-acces', '41 * * * *', $cron$
  SELECT internal.filer_avis_fin_acces();
  SELECT internal.expirer_acces_comptoir();
  SELECT internal.purger_avis_fin_acces();
$cron$);
END $migration$;

-- ── 5. Exposition au membre ──────────────────────────────────────────────────

DROP FUNCTION public.get_my_membership_billing();
CREATE FUNCTION public.get_my_membership_billing()
 RETURNS TABLE(id uuid, box_id uuid, status text, joined_at timestamp with time zone, plan_id uuid, subscription_status text, subscription_current_period_end timestamp with time zone, subscription_cancel_at_period_end boolean, subscription_paused boolean, pause_resumes_at timestamp with time zone, commitment_end_date timestamp with time zone, amount_cents integer, past_due_since timestamp with time zone, dunning_grace_days integer, suspended boolean, has_stripe_subscription boolean, stopped_at timestamp with time zone, stop_mode text, scheduled_plan_id uuid, scheduled_change_at timestamp with time zone, cash_access_until date, box_sells_online boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT bm.id, bm.box_id, bm.status, bm.joined_at, bm.plan_id,
         bm.subscription_status, bm.subscription_current_period_end,
         bm.subscription_cancel_at_period_end, bm.subscription_paused,
         bm.pause_resumes_at, bm.commitment_end_date, bm.amount_cents,
         bm.past_due_since,
         COALESCE(b.dunning_grace_days, 7),
         internal.membership_suspendu(bm.member_id, bm.box_id),
         (bm.stripe_subscription_id IS NOT NULL),
         arret.created_at,
         arret.mode,
         bm.scheduled_plan_id,
         bm.scheduled_change_at,
         bm.cash_access_until,
         internal.box_vend_en_ligne(bm.box_id)
  FROM public.box_members bm
  LEFT JOIN public.boxes b ON b.id = bm.box_id
  LEFT JOIN LATERAL (
    SELECT a.created_at, a.mode
      FROM public.box_member_subscription_actions a
     WHERE a.box_member_id = bm.id
       AND a.action = 'stop'
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT 1
  ) arret ON true
  WHERE bm.member_id = auth.uid();
$function$;
REVOKE ALL ON FUNCTION public.get_my_membership_billing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_membership_billing() TO authenticated, service_role;
COMMENT ON FUNCTION public.get_my_membership_billing() IS
  'Lot 6 : son propre abonnement, par auth.uid(). Remplace la lecture directe des colonnes nominatives de box_members.';
