-- ═════════════════════════════════════════════════════════════════════════════
-- État de la formule d'un membre, pour l'app athlète
--
-- Appliquée en prod : OUI, le 01/10/2026 à 00:57 UTC, avec PGCLIENTENCODING=UTF8,
-- en une transaction, sur GO de Nab. Dump des schémas public et internal avec
-- droits db-dumps/2026-10-01/athlex-prod-public-internal-20261001T005645Z.dump,
-- sha256 f0d8d5849fe3104fdccf4c4fd3d93452bd8831a2d6c01ec8c9586644aaa64abd vérifié
-- après aller-retour, 135 TABLE DATA, 449 ACL, 346 POLICY ; précontrôles (trois
-- passages identiques, search_path de la prod) : membre_a_formule 471b0e75…,
-- membership_suspendu 4a057f03…, est_staff_box f2829621…,
-- bloquer_reservation_impaye 3910a8d0…, consume_credit_on_reservation f6bc083f…,
-- get_my_membership_billing 6b3770f8…, déclencheurs de class_reservations
-- 5c64d781… (9), my_box_plan_status absente ; vérifications : nouvelle
-- fonction au md5 du rejeu 5b3ced6c…, EXECUTE pour authenticated et
-- service_role seulement, tout le reste identique avant/après ; test réel sur
-- AthleX Fitness en transaction annulée (membre fictif sans formule, avec
-- formule, staff : état et réservation concordants), aucune trace ensuite ;
-- audit grants-prod 37/37.
--
-- Chantier « Rejoindre une box en payant », lot 4 (base). L'app doit savoir,
-- avant toute réservation, qu'un membre n'a pas de formule (bandeau « Formule
-- à activer », écran « Bienvenue chez ta box ») sans recopier côté client la
-- règle qui refuse ses réservations (NO_ACTIVE_PLAN, migration 20270133).
--
--   `public.my_box_plan_status(p_box_id)` : une ligne si l'appelant est membre
--   actif de la box (box_members.status = 'active'), aucune sinon (non-membre,
--   autre box, membre inactif, appel sans compte). Bornée à auth.uid().
--
--     is_staff      internal.est_staff_box : la règle qui dispense le staff
--                   de formule dans le refus ;
--     has_plan      internal.membre_a_formule : la règle du refus elle-même.
--                   L'app affiche le bandeau quand NOT is_staff AND NOT has_plan,
--                   exactement quand la base refuserait la réservation ;
--     suspended     internal.membership_suspendu (le bandeau « abonnement
--                   suspendu » existant prime sur « Formule à activer ») ;
--     credits_left  somme des séances restantes des carnets utilisables, avec
--                   la clause de consume_credit_on_reservation (status
--                   'active', expires_at > now(), credits_used < credits_total) ;
--     pays_online   la box a au moins une formule active vendue par Stripe
--                   (is_active, stripe_price_id renseigné). Sinon l'app masque
--                   « Activer mon abonnement » et ne garde que « Tu paies au
--                   comptoir ? Rapproche-toi de ta box. »
--
--   Aucune règle n'est recopiée : les trois fonctions internes sont appelées
--   telles quelles (md5 de prod relevés le 01/10/2026 : est_staff_box
--   f2829621…, membre_a_formule 471b0e75…, membership_suspendu 4a057f03…),
--   et cette migration NE LES TOUCHE PAS. SECURITY DEFINER : elles sont
--   fermées aux rôles clients. Droits : rien pour PUBLIC ni anon, EXECUTE pour
--   authenticated et service_role.
--
-- Données en prod : aucune ligne lue ni écrite à l'application.
--
-- Contrôlée par `supabase/tests/etat_formule_membre.sql`.
--
-- Retour arrière : `supabase/retours/20270141000000_etat_formule_membre.sql`
-- (DROP FUNCTION), rejoué par le test.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE FUNCTION public.my_box_plan_status(p_box_id uuid)
 RETURNS TABLE(is_staff boolean, has_plan boolean, suspended boolean, credits_left integer, pays_online boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT internal.est_staff_box(bm.box_id, bm.member_id),
         internal.membre_a_formule(bm.box_id, bm.member_id),
         internal.membership_suspendu(bm.member_id, bm.box_id),
         (SELECT COALESCE(sum(c.credits_total - c.credits_used), 0)::integer
            FROM member_class_credits c
           WHERE c.member_id = bm.member_id
             AND c.box_id = bm.box_id
             AND c.status = 'active'
             AND c.expires_at > now()
             AND c.credits_used < c.credits_total),
         EXISTS (
           SELECT 1 FROM membership_plans mp
            WHERE mp.box_id = bm.box_id
              AND mp.is_active
              AND mp.stripe_price_id IS NOT NULL
         )
    FROM box_members bm
   WHERE bm.member_id = auth.uid()
     AND bm.box_id = p_box_id
     AND bm.status = 'active';
$function$;

REVOKE ALL ON FUNCTION public.my_box_plan_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_box_plan_status(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.my_box_plan_status(uuid) IS
  'Lot 4 « Rejoindre une box en payant » : état de la formule de l''appelant dans une box (une ligne s''il en est membre actif, aucune sinon). has_plan et is_staff sont les règles du refus NO_ACTIVE_PLAN (internal.membre_a_formule, internal.est_staff_box) ; pays_online : la box vend au moins une formule en ligne.';

COMMIT;
