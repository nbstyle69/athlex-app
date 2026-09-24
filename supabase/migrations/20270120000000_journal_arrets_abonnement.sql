-- ═════════════════════════════════════════════════════════════════════════════
-- Journal des arrêts d'abonnement décidés par un gérant — chantier S1
--
-- Appliquée en prod : NON
--
-- Chantier « arrêt des abonnements par le gérant » (diagnostic côté Manager).
-- Chaque arrêt décidé par un gérant laisse une trace, en ajout seul :
-- `public.box_member_subscription_actions`. L'écriture se fait par une route du
-- Manager avec la clé secrète serveur ; les clients ne font que lire.
--
-- Ajout seul, avec une seule exception :
--   * un trigger BEFORE (INSERT, UPDATE, DELETE, TRUNCATE) refuse toute
--     réécriture et toute suppression, y compris par la clé serveur ;
--   * EXCEPTION : `notified_at` se renseigne UNE fois, après l'envoi de l'e-mail
--     — de NULL à une date, toutes les autres colonnes inchangées. Ni l'effacer
--     ni le changer ensuite. C'est la plus petite ouverture qui sert le besoin :
--     la ligne reste la même, seul le fait « e-mail parti » s'y ajoute ;
--   * sa fonction est dans le schéma `internal` (jamais exécutable par anon ni
--     authenticated ; contrôlé par `schema_internal_ferme.sql` et
--     `controle-schema-internal.mjs`).
--
-- Clés étrangères : AUCUNE, volontairement. L'historique doit survivre à la
-- suppression d'un membre ou d'une box sans bloquer ces suppressions :
--   * ON DELETE CASCADE effacerait l'historique ;
--   * ON DELETE RESTRICT / NO ACTION bloquerait la suppression ;
--   * ON DELETE SET NULL est une mise à jour : le trigger d'ajout seul la
--     refuserait (donc bloquerait la suppression), et l'autoriser reviendrait à
--     laisser la clé serveur effacer « qui » et « où » d'un arrêt déjà journalisé.
-- Les identifiants sont donc enregistrés comme des faits, tels qu'au moment de
-- l'arrêt, et ne changent plus. L'intégrité est vérifiée à l'INSERTION par le
-- même trigger : la box existe, la ligne d'adhésion existe et appartient à
-- cette box et à ce membre, l'auteur est gérant de la box (propriétaire ou
-- co-gérant actif).
--
-- Idempotence : une souscription Stripe ne s'arrête qu'une fois (index unique
-- partiel sur (stripe_subscription_id, action) quand l'identifiant est renseigné).
--
-- RLS : lecture par le gérant de la box (`is_box_owner_admin`) ; aucune écriture
-- pour anon ni authenticated (ni droit, ni policy).
--
-- Pas de notification push `membership_stopped` dans ce lot (S5).
--
-- Données en prod : table nouvelle, vide.
--
-- Retour arrière : script transactionnel dans la PR (DROP de la table, qui emporte
-- triggers, policy et index, puis de la fonction), vérifié sur la base de rejeu.
--
-- Contrôlée par `supabase/tests/journal_arrets_abonnement.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE public.box_member_subscription_actions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id                 uuid        NOT NULL,
  box_member_id          uuid        NOT NULL,
  member_id              uuid        NOT NULL,
  action                 text        NOT NULL,
  mode                   text        NOT NULL,
  refund_cents           integer     NOT NULL DEFAULT 0,
  stripe_subscription_id text,
  stripe_refund_id       text,
  actor_id               uuid        NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  notified_at            timestamptz,
  CONSTRAINT box_member_subscription_actions_action_check CHECK (action IN ('stop')),
  CONSTRAINT box_member_subscription_actions_mode_check CHECK (mode IN ('period_end', 'now')),
  CONSTRAINT box_member_subscription_actions_refund_check CHECK (refund_cents >= 0),
  -- Un arrêt en fin de période ne rembourse rien ; un identifiant de
  -- remboursement Stripe n'existe qu'avec un montant remboursé.
  CONSTRAINT box_member_subscription_actions_refund_mode_check CHECK (mode = 'now' OR refund_cents = 0),
  CONSTRAINT box_member_subscription_actions_refund_id_check CHECK (stripe_refund_id IS NULL OR refund_cents > 0)
);
COMMENT ON TABLE public.box_member_subscription_actions IS
  'Journal en ajout seul des arrêts d''abonnement décidés par un gérant. Sans clé étrangère : l''historique survit à la suppression du membre ou de la box. Écrit par le Manager (clé serveur) ; notified_at se renseigne une seule fois.';

-- Idempotence : une souscription Stripe n'est arrêtée qu'une fois.
CREATE UNIQUE INDEX box_member_subscription_actions_stripe_unique
  ON public.box_member_subscription_actions (stripe_subscription_id, action)
  WHERE stripe_subscription_id IS NOT NULL;
-- Lecture du gérant : les arrêts d'une box, du plus récent au plus ancien.
CREATE INDEX box_member_subscription_actions_box_idx
  ON public.box_member_subscription_actions (box_id, created_at DESC);

-- Gardes : intégrité à l'insertion, ajout seul ensuite (sauf notified_at, une fois).
CREATE FUNCTION internal.box_member_subscription_actions_gardes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'TRUNCATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: un arrêt d''abonnement journalisé ne se supprime pas.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.notified_at IS NULL AND NEW.notified_at IS NOT NULL
       AND (to_jsonb(NEW) - 'notified_at') = (to_jsonb(OLD) - 'notified_at') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'APPEND_ONLY: un arrêt d''abonnement journalisé ne se modifie pas (seul notified_at se renseigne, une fois).'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- INSERT : les identifiants doivent désigner, à cet instant, des objets réels et cohérents.
  IF NOT EXISTS (SELECT 1 FROM public.boxes WHERE id = NEW.box_id) THEN
    RAISE EXCEPTION 'JOURNAL_ARRET: box % inconnue.', NEW.box_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.box_members
                  WHERE id = NEW.box_member_id AND box_id = NEW.box_id AND member_id = NEW.member_id) THEN
    RAISE EXCEPTION 'JOURNAL_ARRET: l''adhésion % n''est pas celle de ce membre dans cette box.', NEW.box_member_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT (EXISTS (SELECT 1 FROM public.boxes WHERE id = NEW.box_id AND owner_id = NEW.actor_id)
          OR EXISTS (SELECT 1 FROM public.box_members
                      WHERE box_id = NEW.box_id AND member_id = NEW.actor_id
                        AND role = 'owner' AND COALESCE(status, 'active') = 'active')) THEN
    RAISE EXCEPTION 'JOURNAL_ARRET: l''auteur % n''est pas gérant de la box.', NEW.actor_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.box_member_subscription_actions_gardes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER box_member_subscription_actions_gardes
  BEFORE INSERT OR UPDATE OR DELETE ON public.box_member_subscription_actions
  FOR EACH ROW EXECUTE FUNCTION internal.box_member_subscription_actions_gardes();
CREATE TRIGGER box_member_subscription_actions_pas_de_truncate
  BEFORE TRUNCATE ON public.box_member_subscription_actions
  FOR EACH STATEMENT EXECUTE FUNCTION internal.box_member_subscription_actions_gardes();

-- Droits et RLS : lecture par le gérant de la box, aucune écriture cliente.
ALTER TABLE public.box_member_subscription_actions ENABLE ROW LEVEL SECURITY;
-- La clé serveur lit, ajoute et renseigne notified_at : ni DELETE ni TRUNCATE,
-- même au niveau des droits (le trigger le refuse aussi).
REVOKE ALL ON TABLE public.box_member_subscription_actions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.box_member_subscription_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.box_member_subscription_actions TO service_role;

CREATE POLICY box_member_subscription_actions_owner_read
  ON public.box_member_subscription_actions
  FOR SELECT TO authenticated
  USING (public.is_box_owner_admin(box_id));

COMMIT;
