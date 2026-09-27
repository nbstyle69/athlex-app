-- ═════════════════════════════════════════════════════════════════════════════
-- Réservation : la box est celle du créneau, et seul un membre de la box réserve
--
-- Appliquée en prod : OUI, le 27/09/2026 à 15:56 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public et internal avec droits
-- db-dumps/2026-09-27/athlex-prod-public-internal-20260927T155556Z.dump,
-- sha256 4c8c066f934a61c1da4c4605ec001dcc2339ecf4af9bc3a3cdede9f58d6c230d vérifié
-- après aller-retour, 134 TABLE DATA, 444 ACL, 346 POLICY ; précontrôles (md5
-- calculés avec le search_path de la prod) : member_add_reservation 7734932f…,
-- les 6 autres policies et les 8 déclencheurs à leurs empreintes (989f097d…),
-- consume_credit_on_reservation f6bc083f…, bloquer_reservation_impaye 3910a8d0…,
-- alerter_reservation_sans_formule c7d27837… ; vérifications : policy e2856d80…
-- et verifier_box_du_creneau c9f47362… (empreintes du rejeu), trg_a0 premier des
-- BEFORE INSERT, reste inchangé, md5 de class_reservations, box_members et
-- class_schedules identiques avant/après ; audit des droits 30/30 ; test en réel
-- sur AthleX Fitness en transaction annulée : non-membre refusé (42501), membre
-- actif accepté, box déclarée différente refusée par un membre et par la clé
-- serveur (RESERVATION_BOX_MISMATCH), inscription par un coach acceptée, aucune
-- trace ensuite.)
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
--     → WITH CHECK member_id = auth.uid() AND box_id IN (SELECT
--       get_user_box_ids()) : membre actif d'une box non archivée. Fonction
--       `public` existante, SECURITY DEFINER, bornée à auth.uid() : pas de
--       lecture de box_members depuis la policy, donc pas de récursion. Membre
--       banni ou inactif : refusé. Le staff passe par sa propre policy
--       (`box_admin_insert_reservation`, is_box_admin), y compris pour lui-même
--       et dans une box archivée ; une clause staff ici ne changerait aucun
--       résultat. Effet accepté : un membre ne réserve plus lui-même dans une box
--       archivée.
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
    AND box_id IN (SELECT public.get_user_box_ids())
  );

COMMIT;
