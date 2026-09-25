-- ═════════════════════════════════════════════════════════════════════════════
-- Impayé : les réservations d'un membre suspendu sont bloquées
--
-- Appliquée en prod : NON
--
-- Décision produit du 25/09/2026. Un membre est « suspendu » quand son
-- abonnement est en impayé (`subscription_status = 'past_due'`) et que
-- `past_due_since` + le « délai avant suspension » de sa box est dépassé.
-- Le délai est `boxes.dunning_grace_days` (0 à 90 jours, réglé par le gérant
-- dans les Réglages du Manager, route /api/box/dunning ; NOT NULL, défaut 7).
-- La formule est CELLE de `get_box_dunning` (drapeau « suspended » du panneau
-- Impayés du Manager) : les deux affichages et le blocage disent la même chose.
--
-- Jusqu'ici, rien ne bloquait : le déclencheur `membership_access_blocked`
-- d'une migration archivée (migrations_archive/20260703_sepa_dunning.sql)
-- n'existe pas en prod, aucun des 6 déclencheurs de `class_reservations` ne
-- regarde l'impayé, et `consume_credit_on_reservation` tient `past_due` pour
-- un abonnement valide sans regarder le délai.
--
--   * `internal.membership_suspendu(membre, box)` : la règle, en un seul
--     endroit (impayé + délai dépassé, `now() >= past_due_since + délai`) ;
--   * un déclencheur BEFORE INSERT sur `class_reservations` refuse au membre
--     suspendu de créer une réservation (`status = 'confirmed'`) comme une
--     inscription en liste d'attente (`status = 'waiting'`, même table).
--     Refus : « MEMBERSHIP_PAST_DUE: … », le code que l'app affiche déjà
--     (ReservationScreen, textes FR/EN en place) ;
--   * QUI est bloqué : seulement le membre qui réserve POUR LUI-MÊME
--     (`auth.uid() = NEW.member_id`). Le gérant ou un coach qui inscrit ce
--     membre depuis le back-office passe (auth.uid() ≠ member_id, et la
--     policy `box_admin_insert_reservation` garde déjà ce chemin) ; un créneau
--     d'essai (member_id NULL, prospect) et la clé serveur (auth.uid() NULL)
--     ne sont pas concernés. Aucun contournement pour le membre : la policy
--     `member_add_reservation` (WITH CHECK member_id = auth.uid()) lui interdit
--     d'écrire une ligne qui ne porte pas son propre uid ;
--   * les réservations déjà prises ne bougent pas (rien sur UPDATE ni DELETE) ;
--     la promotion d'une ligne d'attente existante (waiting → confirmed, à la
--     libération d'une place) reste possible : c'est une inscription déjà
--     prise. Le retour à `active` rétablit tout, sans autre action ;
--   * `consume_credit_on_reservation` : `past_due` ne vaut plus abonnement
--     valide que DANS le délai ; suspendu, le membre bascule sur ses crédits
--     (le carnet reste utilisable quand le staff l'inscrit).
--
-- Aucun changement de RLS : les policies existantes suffisent.
--
-- Données en prod : aucune donnée touchée ; le blocage n'agit qu'aux
-- prochaines insertions.
--
-- Contrôlée par `supabase/tests/reservations_impaye.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- La règle « suspendu », partagée par le déclencheur et les crédits.
-- Même formule que get_box_dunning : un délai à 0 suspend dès l'impayé.
CREATE FUNCTION internal.membership_suspendu(p_member uuid, p_box uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.box_members bm
      JOIN public.boxes b ON b.id = bm.box_id
     WHERE bm.member_id = p_member
       AND bm.box_id = p_box
       AND bm.subscription_status = 'past_due'
       AND bm.past_due_since IS NOT NULL
       AND now() >= bm.past_due_since + make_interval(days => COALESCE(b.dunning_grace_days, 7))
  );
$function$;
REVOKE ALL ON FUNCTION internal.membership_suspendu(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION internal.bloquer_reservation_impaye()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Seul le membre qui réserve pour lui-même est concerné : l'inscription par
  -- le staff (auth.uid() ≠ member_id), l'essai (member_id NULL) et la clé
  -- serveur (auth.uid() NULL) passent.
  IF NEW.member_id IS NULL OR auth.uid() IS DISTINCT FROM NEW.member_id THEN
    RETURN NEW;
  END IF;
  IF internal.membership_suspendu(NEW.member_id, NEW.box_id) THEN
    RAISE EXCEPTION 'MEMBERSHIP_PAST_DUE: abonnement impayé au-delà du délai de la box — réservations et liste d''attente suspendues. Régularise ton paiement ou contacte ta box.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.bloquer_reservation_impaye() FROM PUBLIC, anon, authenticated;

-- « aa » : avant les autres déclencheurs (capacité, quota, crédits) — un refus
-- d'impayé ne doit ni consommer un crédit ni poser de verrou pour rien.
DROP TRIGGER IF EXISTS trg_aa_bloque_impaye ON public.class_reservations;
CREATE TRIGGER trg_aa_bloque_impaye
  BEFORE INSERT ON public.class_reservations
  FOR EACH ROW EXECUTE FUNCTION internal.bloquer_reservation_impaye();

-- Crédits : `past_due` ne vaut abonnement valide que dans le délai.
CREATE OR REPLACE FUNCTION public.consume_credit_on_reservation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_has_sub    boolean;
  v_has_any    boolean;
  v_credit_id  uuid;
BEGIN
  -- Un crédit n'est consommé que par une réservation confirmée.
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Déjà rattachée à un crédit (ex. UPDATE sans changement d'accès) -> rien.
  IF NEW.credit_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Mode abonnement : le quota hebdo (trigger dédié) s'applique, pas les
  -- crédits. Un impayé ne compte que DANS le délai avant suspension de la box
  -- (migration 20270121) ; suspendu, le membre bascule sur ses crédits.
  SELECT EXISTS (
    SELECT 1
    FROM box_members bm
    JOIN membership_plans mp ON mp.id = bm.plan_id
    WHERE bm.member_id = NEW.member_id
      AND bm.box_id = NEW.box_id
      AND bm.status = 'active'
      AND mp.plan_type = 'subscription'
      AND COALESCE(bm.subscription_status, '') IN ('active', 'trialing', 'past_due')
  ) AND NOT internal.membership_suspendu(NEW.member_id, NEW.box_id) INTO v_has_sub;

  IF v_has_sub THEN
    RETURN NEW;
  END IF;

  -- Cherche un crédit disponible (le plus proche de l'expiration d'abord).
  SELECT id INTO v_credit_id
  FROM member_class_credits
  WHERE member_id = NEW.member_id
    AND box_id = NEW.box_id
    AND status = 'active'
    AND expires_at > now()
    AND credits_used < credits_total
  ORDER BY expires_at ASC
  FOR UPDATE
  LIMIT 1;

  IF v_credit_id IS NOT NULL THEN
    UPDATE member_class_credits
    SET credits_used = credits_used + 1,
        status = CASE WHEN credits_used + 1 >= credits_total THEN 'exhausted' ELSE status END
    WHERE id = v_credit_id;
    NEW.credit_id := v_credit_id;
    RETURN NEW;
  END IF;

  -- Pas de crédit dispo : si le membre a DÉJÀ acheté des crédits pour cette box
  -- (mode crédit), on bloque. Sinon (membre libre/invité) : accès inchangé.
  SELECT EXISTS (
    SELECT 1 FROM member_class_credits
    WHERE member_id = NEW.member_id AND box_id = NEW.box_id
  ) INTO v_has_any;

  IF v_has_any THEN
    RAISE EXCEPTION 'NO_CREDITS_LEFT: aucun crédit valide (carnet épuisé ou expiré)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
