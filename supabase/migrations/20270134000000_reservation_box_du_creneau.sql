-- ═════════════════════════════════════════════════════════════════════════════
-- Réservation : la box est celle du créneau, et seul un membre de la box réserve
--
-- Appliquée en prod : non.
--
-- Deux trous relevés au précontrôle du lot « réservation sans formule »
-- (20270133), aucun n'étant exploité en prod le 27/09/2026 (0 réservation sur
-- 1 176 dans l'un ou l'autre cas) :
--
--   * `class_reservations.box_id` n'était pas contrôlé contre la box du
--     créneau. Un membre de A pouvait réserver un créneau de B en déclarant
--     box_id = A, et le staff de A pouvait faire de même, puisque ses policies
--     jugent `is_box_admin(box_id)`. Tous les contrôles (impayé, formule,
--     crédits, quota) lisent NEW.box_id.
--     → `internal.verifier_box_du_creneau()`, déclencheur `trg_a0_box_du_creneau`
--       BEFORE INSERT OR UPDATE OF box_id, schedule_id : refus
--       « RESERVATION_BOX_MISMATCH: … » (check_violation) si NEW.box_id IS
--       DISTINCT FROM la box du créneau, box nulle comprise. S'applique à tous les
--       rôles, clé serveur comprise. « a0 » le fait passer avant trg_aa_bloque_impaye
--       (ordre alphabétique des déclencheurs BEFORE) : aucun autre contrôle ne
--       tourne sur une box déclarée fausse. Un UPDATE de status ou de attended ne
--       le déclenche pas ;
--   * la policy `member_add_reservation` (WITH CHECK member_id = auth.uid(),
--     md5 7734932f3b163edf81287ccb07c9143a) ne vérifiait pas l'appartenance à la
--     box : tout compte connecté réservait dans n'importe quelle box.
--     → WITH CHECK member_id = auth.uid() AND (box_id IN (SELECT
--       get_user_box_ids()) OR is_box_staff(box_id)) : membre actif d'une box non
--       archivée, ou staff de la box (propriétaire, owner ou coach actif).
--       Deux fonctions `public` existantes, SECURITY DEFINER, bornées à
--       auth.uid() : pas de lecture de box_members depuis la policy, donc pas de
--       récursion. Membre banni ou inactif : refusé. Effet accepté : un membre ne
--       réserve plus lui-même dans une box archivée (le staff, si).
--
-- Inchangés : les policies du staff et de lecture, book_trial_slot (qui vérifie
-- déjà la box du créneau), la promotion depuis la liste d'attente (UPDATE de
-- status), consume_credit_on_reservation, bloquer_reservation_impaye et
-- l'alerte au gérant.
--
-- Données en prod : aucune ligne modifiée ; les contrôles n'agissent qu'aux
-- prochaines écritures.
--
-- Contrôlée par `supabase/tests/reservation_box_du_creneau.sql`.
--
-- Retour arrière (transactionnel, vérifié sur le rejeu contre les empreintes de
-- prod du 27/09/2026 — policy 7734932f3b163edf81287ccb07c9143a, 8 déclencheurs) :
--
--   BEGIN;
--   DROP TRIGGER trg_a0_box_du_creneau ON public.class_reservations;
--   DROP FUNCTION internal.verifier_box_du_creneau();
--   ALTER POLICY member_add_reservation ON public.class_reservations
--     WITH CHECK (member_id = auth.uid());
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE FUNCTION internal.verifier_box_du_creneau()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.box_id IS DISTINCT FROM (SELECT box_id FROM class_schedules WHERE id = NEW.schedule_id) THEN
    RAISE EXCEPTION 'RESERVATION_BOX_MISMATCH: la box de la réservation n''est pas celle du créneau.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.verifier_box_du_creneau() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_a0_box_du_creneau
  BEFORE INSERT OR UPDATE OF box_id, schedule_id ON public.class_reservations
  FOR EACH ROW EXECUTE FUNCTION internal.verifier_box_du_creneau();

-- Définition en prod : WITH CHECK (member_id = auth.uid()).
ALTER POLICY member_add_reservation ON public.class_reservations
  WITH CHECK (
    member_id = auth.uid()
    AND (box_id IN (SELECT public.get_user_box_ids()) OR public.is_box_staff(box_id))
  );

COMMIT;
