-- ═════════════════════════════════════════════════════════════════════════════
-- Réservation sans formule : refusée au membre, signalée au gérant
--
-- Appliquée en prod : OUI, le 27/09/2026 à 10:18 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public et internal avec droits
-- db-dumps/2026-09-27/athlex-prod-public-internal-20260927T101714Z.dump,
-- sha256 3d6acd2e854b313094bd42011b8d3ee37fd3b396a89f12455e0d04ab925c19e9 vérifié
-- après aller-retour, 133 TABLE DATA, 439 ACL, 345 POLICY ; précontrôles :
-- bloquer_reservation_impaye 8488e9f2…, trg_aa_bloque_impaye ee71f92c…,
-- consume_credit_on_reservation f6bc083f… ; vérifications : nouvelles définitions
-- aux md5 du rejeu, consume_credit_on_reservation inchangée, md5 de box_members,
-- class_reservations et member_class_credits identiques avant/après,
-- box_member_alerts vide et RLS active ; audit des droits 30/30 (T10 compris) ; test en réel sur AthleX Fitness en
-- transaction annulée : NO_ACTIVE_PLAN en confirmed et en waiting, inscription
-- par un coach acceptée avec une alerte, aucune trace ensuite.)
--
-- Chantier « argent », lot 1 de la spec « Rejoindre une box en payant ».
-- Jusqu'ici, `consume_credit_on_reservation` laissait passer sans rien débiter
-- la réservation d'un membre qui n'a ni abonnement valable ni aucun crédit
-- (`v_has_any = false`) : rejoindre une box avec son code suffisait pour
-- réserver gratuitement et sans limite. Seul celui qui avait déjà eu des
-- crédits était bloqué (NO_CREDITS_LEFT). Précontrôle en prod du 27/09/2026 :
-- 25 membres actifs non staff dans ce cas, sur 3 box, aucune réservation à
-- venir.
--
--   * `internal.membre_a_formule(box, membre)` : abonnement valable OU au moins
--     un crédit, passé ou présent. Mêmes critères que
--     `consume_credit_on_reservation` (v_has_sub, v_has_any), que cette
--     migration NE TOUCHE PAS (md5 f6bc083f4c67cc88faa558a4eb061d29 avant et
--     après, test à l'appui) ;
--   * `internal.est_staff_box(box, membre)` : la règle de `public.is_box_staff`
--     (propriétaire de la box, ou owner/coach actif), appliquée au membre de la
--     réservation au lieu de l'appelant. Les admins de la plateforme n'en sont
--     pas ;
--   * `internal.bloquer_reservation_impaye` (trg_aa, BEFORE INSERT, premier
--     déclencheur) : après le contrôle d'impayé, inchangé et prioritaire, le
--     membre qui réserve POUR LUI-MÊME, hors staff, sans formule, est refusé :
--     « NO_ACTIVE_PLAN: … » (check_violation). Vaut pour `confirmed` comme pour
--     `waiting` (seuls statuts permis par class_reservations_status_check),
--     donc aussi quand la capacité aurait rétrogradé la réservation. L'essai
--     n'est pas concerné : class_reservations_essai_ou_membre impose
--     member_id NULL à toute ligne is_trial, qui sort au premier test. Un membre
--     qui a déjà eu des crédits a une formule : son cas reste NO_CREDITS_LEFT ;
--   * inscrit par le staff (auth.uid() ≠ member_id), par la clé serveur
--     (auth.uid() NULL) ou promu depuis la liste d'attente (UPDATE, que ce
--     déclencheur ne voit pas) : accepté comme avant ;
--   * `public.box_member_alerts` : quand le staff inscrit un membre sans
--     formule (INSERT, quel que soit le statut), un déclencheur AFTER INSERT
--     ouvre une alerte « reservation_sans_formule ». Une seule alerte ouverte
--     par membre et par box (index unique partiel). Aucune alerte à la
--     promotion ni à la clé serveur. Aucun rôle client n'écrit la table ;
--     l'owner / co-gérant / admin (`is_box_owner_admin`) la lit et la résout
--     par `public.resoudre_alerte_membre(id)`. L'affichage Manager viendra
--     dans un lot suivant.
--
-- Données en prod : aucune ligne existante modifiée ; le refus n'agit qu'aux
-- prochaines insertions.
--
-- Contrôlée par `supabase/tests/reservation_sans_formule.sql`.
--
-- Retour arrière (transactionnel, vérifié sur le rejeu : les définitions
-- reviennent aux md5 de prod relevés le 27/09/2026 — bloquer_reservation_impaye
-- 8488e9f2a4cdfd953462b74e584e679d, trg_aa ee71f92c8da50966eda067414c68430f) :
--
--   BEGIN;
--   DROP TRIGGER trg_zz_alerte_sans_formule ON public.class_reservations;
--   DROP FUNCTION public.resoudre_alerte_membre(uuid);
--   DROP TABLE public.box_member_alerts;
--   CREATE OR REPLACE FUNCTION internal.bloquer_reservation_impaye() … (corps
--     de 20270121000000_reservations_impaye_suspendu.sql, à l'identique) ;
--   DROP FUNCTION internal.alerter_reservation_sans_formule();
--   DROP FUNCTION internal.membre_a_formule(uuid, uuid);
--   DROP FUNCTION internal.est_staff_box(uuid, uuid);
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Abonnement valable ou au moins un crédit, présent ou passé : v_has_sub OR
-- v_has_any de consume_credit_on_reservation, mêmes clauses.
CREATE FUNCTION internal.membre_a_formule(p_box uuid, p_member uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT (
    EXISTS (
      SELECT 1
      FROM box_members bm
      JOIN membership_plans mp ON mp.id = bm.plan_id
      WHERE bm.member_id = p_member
        AND bm.box_id = p_box
        AND bm.status = 'active'
        AND mp.plan_type = 'subscription'
        AND COALESCE(bm.subscription_status, '') IN ('active', 'trialing', 'past_due')
    ) AND NOT internal.membership_suspendu(p_member, p_box)
  ) OR EXISTS (
    SELECT 1 FROM member_class_credits
    WHERE member_id = p_member AND box_id = p_box
  );
$function$;
REVOKE ALL ON FUNCTION internal.membre_a_formule(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- La règle de public.is_box_staff, pour un membre donné plutôt que l'appelant.
CREATE FUNCTION internal.est_staff_box(p_box uuid, p_member uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.boxes
      WHERE id = p_box AND owner_id = p_member
    )
    OR EXISTS (
      SELECT 1 FROM public.box_members
      WHERE box_id = p_box
        AND member_id = p_member
        AND role IN ('owner', 'coach')
        AND COALESCE(status, 'active') = 'active'
    );
$function$;
REVOKE ALL ON FUNCTION internal.est_staff_box(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Redéfinition à partir de la définition en prod (md5 8488e9f2…) : le contrôle
-- d'impayé est intact et reste premier ; le refus NO_ACTIVE_PLAN s'ajoute après.
CREATE OR REPLACE FUNCTION internal.bloquer_reservation_impaye()
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
  -- Sans formule (migration 20270133) : ni abonnement valable ni aucun crédit,
  -- réservation comme liste d'attente. Le staff de la box n'a pas besoin de formule.
  IF NOT internal.est_staff_box(NEW.box_id, NEW.member_id)
     AND NOT internal.membre_a_formule(NEW.box_id, NEW.member_id) THEN
    RAISE EXCEPTION 'NO_ACTIVE_PLAN: aucune formule active dans cette box — rapproche-toi de ta box pour activer ton abonnement.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TABLE public.box_member_alerts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id         uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  member_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.class_reservations(id) ON DELETE SET NULL,
  kind           text NOT NULL CHECK (kind = 'reservation_sans_formule'),
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,
  resolved_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
-- Une seule alerte ouverte par membre et par box.
CREATE UNIQUE INDEX box_member_alerts_une_ouverte
  ON public.box_member_alerts (box_id, member_id) WHERE resolved_at IS NULL;
-- Chaque annulation de réservation met reservation_id à NULL.
CREATE INDEX box_member_alerts_reservation ON public.box_member_alerts (reservation_id);

ALTER TABLE public.box_member_alerts ENABLE ROW LEVEL SECURITY;
-- Écriture : seulement par les fonctions ci-dessous. Lecture : policy gérant.
REVOKE ALL ON TABLE public.box_member_alerts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.box_member_alerts TO authenticated, service_role;
CREATE POLICY box_member_alerts_lecture_gerant ON public.box_member_alerts
  FOR SELECT TO authenticated
  USING (public.is_box_owner_admin(box_id));

CREATE FUNCTION internal.alerter_reservation_sans_formule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Seulement une inscription faite par un compte connecté : ni la clé serveur,
  -- ni l'essai. Le membre sans formule qui s'inscrit lui-même a déjà été
  -- refusé par trg_aa_bloque_impaye.
  IF NEW.member_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF internal.est_staff_box(NEW.box_id, NEW.member_id)
     OR internal.membre_a_formule(NEW.box_id, NEW.member_id) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.box_member_alerts (box_id, member_id, reservation_id, kind, created_by)
  VALUES (NEW.box_id, NEW.member_id, NEW.id, 'reservation_sans_formule', auth.uid())
  ON CONFLICT (box_id, member_id) WHERE resolved_at IS NULL DO NOTHING;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION internal.alerter_reservation_sans_formule() FROM PUBLIC, anon, authenticated;

-- AFTER INSERT seulement : la promotion depuis la liste d'attente (UPDATE)
-- n'ouvre pas d'alerte.
CREATE TRIGGER trg_zz_alerte_sans_formule
  AFTER INSERT ON public.class_reservations
  FOR EACH ROW EXECUTE FUNCTION internal.alerter_reservation_sans_formule();

-- Résolution par l'owner / co-gérant / admin de la box de l'alerte. Même refus
-- pour une alerte inconnue, déjà résolue ou d'une autre box.
CREATE FUNCTION public.resoudre_alerte_membre(p_alert_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_box uuid;
BEGIN
  SELECT box_id INTO v_box
  FROM box_member_alerts
  WHERE id = p_alert_id AND resolved_at IS NULL
  FOR UPDATE;

  IF v_box IS NULL OR NOT public.is_box_owner_admin(v_box) THEN
    RAISE EXCEPTION 'ALERTE_INTROUVABLE: aucune alerte ouverte à résoudre'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE box_member_alerts
  SET resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_alert_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.resoudre_alerte_membre(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resoudre_alerte_membre(uuid) TO authenticated;

COMMIT;
