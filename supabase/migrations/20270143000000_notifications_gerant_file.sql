-- ═════════════════════════════════════════════════════════════════════════════
-- Notifications push au gérant (D4a, PR A) : file d'attente et déclencheurs
--
-- Appliquée en prod : OUI, le 04/10/2026 à 10:16 UTC, avec PGCLIENTENCODING=UTF8,
-- sur GO de Nab. Dump des schémas public et internal avec droits
-- db-dumps/2026-10-04/athlex-prod-public-internal-20261004T101510Z.dump,
-- sha256 92a481a37f438d4536164f3285dfb7d6742de9f810989ed48a6170c94e7cedad vérifié
-- après aller-retour, 135 TABLE DATA, 451 ACL, 346 POLICY (un ACL de plus que le
-- dump du 03/10, pris avant 20270142 : garder_resultat_notification) ;
-- précontrôles : md5 des sept fonctions existantes et de is_box_owner_admin
-- identiques au relevé ci-dessous, ni table, ni fonction, ni déclencheur,
-- cron_secret présent dans le Vault ; vérifications : RLS active sans règle,
-- service_role SELECT et UPDATE des cinq colonnes d'envoi, aucun droit client,
-- fonction SECURITY DEFINER au md5 du rejeu 6b0bb58f80f3eeeaa883d838ae5049ce
-- (sans CR), EXECUTE fermé, cinq déclencheurs actifs avec leurs conditions,
-- fonctions existantes inchangées, box_members (183 lignes, 4ad6b560…),
-- box_member_alerts (0) et box_invitations (3 lignes, 7fb19f32…) à la même
-- empreinte, file vide ; test réel en transaction annulée sur AthleX Fitness
-- (membres et co-gérant fictifs : une ligne par événement, aucune au
-- renouvellement ni à la relance, heure du cours et auteur justes, file en
-- erreur sans blocage de l'écriture d'origine), sans trace ; audit des droits
-- en prod 39/39 (T13 et T14 compris).
--
-- Aucune notification n'est envoyée aujourd'hui au gérant d'une box. Quatre
-- événements, validés par Nab, sont mis en file ici ; la fonction edge
-- `deliver-manager-notifications` (PR B), appelée chaque minute par pg_cron
-- (PR C), les envoie au gérant et aux co-gérants. Conception :
-- docs/NOTIFS_GERANT.md.
--
--   type                  déclencheur (AFTER, ligne par ligne, transition seule)        référence (anti-doublon)
--   subscription_paid     box_members : un NOUVEL abonnement Stripe arrive actif —       stripe_subscription_id
--                         INSERT, ou UPDATE où stripe_subscription_id change, avec
--                         subscription_status = 'active'
--   payment_failed        box_members : past_due_since passe de NULL à une date         id du membre + past_due_since
--   booked_without_plan   box_member_alerts : INSERT (reservation_sans_formule)          id de l'alerte
--   invitation_accepted   box_invitations : status passe à 'accepted'                    id de l'invitation
--
-- Pourquoi « nouvel identifiant d'abonnement » plutôt que « statut vers
-- actif » : relevé du webhook Stripe du Manager (stripe-connect-webhook) le
-- 04/10/2026, la première activation (`activateMembership`, et
-- `claim_pending_entitlements` sans compte) écrit `subscription_status =
-- 'active'` ET `stripe_subscription_id` dans la même écriture ; `invoice.paid`
-- réécrit 'active' à chaque échéance (UPDATE à l'identique) ; un retour
-- d'impayé ou une reprise après pause repasse à 'active' AVEC le même
-- identifiant. Seul le nouvel identifiant distingue une souscription. Le
-- comptoir (`stripe_subscription_id` NULL) ne notifie rien.
--
-- Garanties :
--   * un événement n'est mis en file qu'une fois : clé unique (type, event_ref)
--     et `ON CONFLICT DO NOTHING` ;
--   * une box archivée (`boxes.archived_at` non NULL) ne met rien en file ;
--   * la file ne bloque JAMAIS l'écriture d'origine (paiement, réservation,
--     invitation) : toute erreur de mise en file est rattrapée et journalisée
--     (WARNING `NOTIF_GERANT_NON_FILEE`), l'écriture d'origine passe ;
--   * aucun rôle client (`anon`, `authenticated`) ne lit ni n'écrit la table,
--     RLS active sans règle ; la clé serveur la lit et n'écrit que les colonnes
--     d'envoi ; la fonction de déclencheur est dans `internal`, EXECUTE fermé.
--
-- Les déclencheurs et fonctions existants de ces tables ne sont pas redéfinis
-- (relevé de prod du 04/10/2026, lecture seule, md5 de pg_get_functiondef :
-- internal.garder_facturation_membre 2c8c6335…, internal.garder_role_cogerant
-- a3f6d592…, internal.refuser_entree_directe_box 73b868ed…,
-- update_box_member_count 82f49d09…, release_reservations_on_revoke 5970975e…,
-- sync_member_plan_groups b27819449…, internal.alerter_reservation_sans_formule
-- c7d27837… ; is_box_owner_admin e61752a6…, identique au dépôt).
--
-- Contrôlée par `supabase/tests/notifications_gerant_file.sql` (rejouée par la
-- CI, mutations et retour arrière compris) et par le contrôle T14 de l'audit
-- des droits (`scripts/lib/controle-grants-tables.mjs`).
--
-- Retour arrière (transactionnel ; d'abord retirer la tâche pg_cron de la PR C
-- si elle est appliquée ; vérifié sur le rejeu par la suite de tests : ni
-- table, ni fonction, ni déclencheur ne subsistent, les fonctions existantes
-- de box_members, box_member_alerts et box_invitations sont inchangées) :
--
--   BEGIN;
--   DROP TRIGGER trg_notif_gerant_abonnement_creation ON public.box_members;
--   DROP TRIGGER trg_notif_gerant_abonnement_nouveau ON public.box_members;
--   DROP TRIGGER trg_notif_gerant_impaye ON public.box_members;
--   DROP TRIGGER trg_notif_gerant_sans_formule ON public.box_member_alerts;
--   DROP TRIGGER trg_notif_gerant_invitation ON public.box_invitations;
--   DROP FUNCTION internal.filer_notification_gerant();
--   DROP TABLE public.box_manager_notifications;
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE public.box_manager_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id          uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('subscription_paid', 'payment_failed', 'booked_without_plan', 'invitation_accepted')),
  event_ref       text NOT NULL,
  -- Données du texte, relues à l'envoi (pseudo, nom de formule) : aucune copie
  -- de donnée personnelle dans la file.
  member_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id         uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  class_starts_at timestamptz,
  -- Auteur de l'événement quand c'est un gérant (inscription sans formule) :
  -- il n'est pas notifié de son propre geste.
  actor_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Envoi (clé serveur seulement) : réservation conditionnelle, résultat.
  claimed_at      timestamptz,
  sent_at         timestamptz,
  delivered_count integer,
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error      text,
  CONSTRAINT box_manager_notifications_evenement_unique UNIQUE (type, event_ref)
);
COMMENT ON TABLE public.box_manager_notifications IS
  'File des notifications push au gérant et aux co-gérants (D4a). Remplie par internal.filer_notification_gerant, vidée par la fonction edge deliver-manager-notifications. Fermée aux clients.';
CREATE INDEX box_manager_notifications_a_envoyer
  ON public.box_manager_notifications (created_at) WHERE sent_at IS NULL;

ALTER TABLE public.box_manager_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.box_manager_notifications FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.box_manager_notifications TO service_role;
GRANT UPDATE (claimed_at, sent_at, delivered_count, attempts, last_error)
  ON TABLE public.box_manager_notifications TO service_role;

-- Une fonction pour les cinq déclencheurs : TG_ARGV[0] porte le type.
CREATE FUNCTION internal.filer_notification_gerant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_type   text := TG_ARGV[0];
  v_ref    text;
  v_membre uuid;
  v_plan   uuid;
  v_cours  timestamptz;
  v_auteur uuid;
BEGIN
  BEGIN
    IF v_type = 'subscription_paid' THEN
      v_ref := NEW.stripe_subscription_id;
      v_membre := NEW.member_id;
      v_plan := NEW.plan_id;
    ELSIF v_type = 'payment_failed' THEN
      v_ref := NEW.id::text || '@' || to_char(NEW.past_due_since AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US');
      v_membre := NEW.member_id;
      v_plan := NEW.plan_id;
    ELSIF v_type = 'booked_without_plan' THEN
      v_ref := NEW.id::text;
      v_membre := NEW.member_id;
      v_auteur := NEW.created_by;
      -- Les heures de créneau sont celles de la box, à Paris.
      SELECT (cs.scheduled_date + cs.start_time::time) AT TIME ZONE 'Europe/Paris' INTO v_cours
      FROM class_reservations cr
      JOIN class_schedules cs ON cs.id = cr.schedule_id
      WHERE cr.id = NEW.reservation_id;
    ELSIF v_type = 'invitation_accepted' THEN
      v_ref := NEW.id::text;
      v_membre := NEW.accepted_by;
    ELSE
      RAISE EXCEPTION 'type de notification inconnu : %', v_type;
    END IF;

    IF v_membre IS NOT NULL AND EXISTS (
      SELECT 1 FROM boxes WHERE id = NEW.box_id AND archived_at IS NULL
    ) THEN
      INSERT INTO box_manager_notifications (box_id, type, event_ref, member_id, plan_id, class_starts_at, actor_id)
      VALUES (NEW.box_id, v_type, v_ref, v_membre, v_plan, v_cours, v_auteur)
      ON CONFLICT (type, event_ref) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Une notification ne bloque jamais un paiement, une réservation ou une invitation.
    RAISE WARNING 'NOTIF_GERANT_NON_FILEE: % (%, %)', v_type, SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION internal.filer_notification_gerant() FROM PUBLIC, anon, authenticated;

-- 1. Nouvel abonnement Stripe actif : création de la ligne, ou nouvel identifiant.
CREATE TRIGGER trg_notif_gerant_abonnement_creation
  AFTER INSERT ON public.box_members
  FOR EACH ROW
  WHEN (NEW.subscription_status = 'active' AND NEW.stripe_subscription_id IS NOT NULL)
  EXECUTE FUNCTION internal.filer_notification_gerant('subscription_paid');
CREATE TRIGGER trg_notif_gerant_abonnement_nouveau
  AFTER UPDATE OF subscription_status, stripe_subscription_id ON public.box_members
  FOR EACH ROW
  WHEN (NEW.subscription_status = 'active' AND NEW.stripe_subscription_id IS NOT NULL
        AND OLD.stripe_subscription_id IS DISTINCT FROM NEW.stripe_subscription_id)
  EXECUTE FUNCTION internal.filer_notification_gerant('subscription_paid');

-- 2. Impayé : past_due_since posé (les relances suivantes le gardent).
CREATE TRIGGER trg_notif_gerant_impaye
  AFTER UPDATE OF past_due_since ON public.box_members
  FOR EACH ROW
  WHEN (OLD.past_due_since IS NULL AND NEW.past_due_since IS NOT NULL)
  EXECUTE FUNCTION internal.filer_notification_gerant('payment_failed');

-- 3. Inscription sans formule : l'alerte ouverte (une seule ouverte par membre).
CREATE TRIGGER trg_notif_gerant_sans_formule
  AFTER INSERT ON public.box_member_alerts
  FOR EACH ROW
  WHEN (NEW.kind = 'reservation_sans_formule')
  EXECUTE FUNCTION internal.filer_notification_gerant('booked_without_plan');

-- 4. Invitation acceptée.
CREATE TRIGGER trg_notif_gerant_invitation
  AFTER UPDATE OF status ON public.box_invitations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'accepted' AND NEW.status = 'accepted')
  EXECUTE FUNCTION internal.filer_notification_gerant('invitation_accepted');

COMMIT;
