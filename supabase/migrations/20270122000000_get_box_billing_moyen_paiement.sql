-- ═════════════════════════════════════════════════════════════════════════════
-- get_box_billing renvoie aussi le moyen de paiement (payment_method_type)
--
-- Appliquée en prod : OUI, le 25/09/2026 à 15:06 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public et internal avec droits
-- db-dumps/2026-09-25/athlex-prod-public-internal-20260925T150516Z.dump,
-- sha256 6ab9ce891fb9427f22f17f17abaca324f8acca0cf411321034b23b40b3c8eff6 vérifié
-- après aller-retour, 132 TABLE DATA, 416 ACL, 342 POLICY ; précontrôles :
-- get_box_billing au md5 add5743ad3c2db98050a55f06f5ebe7d (celui dont part ce
-- fichier), box_members.payment_method_type en text, droits EXECUTE pour
-- authenticated et service_role seulement, aucun objet dépendant ; vérifications :
-- md5 de box_members identique avant/après, nouvelle définition identique au
-- fichier (md5 c96d2dc554cdc4e3e240f526a38ecb98), droits et commentaire
-- identiques à avant ; audit des droits en prod 29/29 ; tests réels en
-- transaction annulée.)
--
-- Pour que le Manager affiche « carte » ou « prélèvement SEPA » dans la boîte
-- d'arrêt d'abonnement (S4, PR AthleX-Manager #385). Seul
-- `box_members.payment_method_type` porte cette information (écrite par le
-- webhook Connect : card, sepa_debit…), et aucune lecture du navigateur ne la
-- sert.
--
-- Le type de retour change : CREATE OR REPLACE ne suffit pas, d'où DROP puis
-- CREATE. Le corps repris est celui de la PROD, relu en lecture seule
-- (md5 add5743ad3c2db98050a55f06f5ebe7d, identique au rejeu de master,
-- défini en dernier par 20261121_lot6_residu_nominatif) — pas celui de la
-- baseline. Seuls changent : `payment_method_type text` en dernière colonne du
-- retour et du SELECT. Garde is_box_owner_admin, SECURITY DEFINER, STABLE et
-- search_path identiques.
--
-- Le DROP efface les droits et le commentaire : ils sont reposés à l'identique
-- (EXECUTE pour authenticated et service_role, rien pour PUBLIC ni anon ;
-- commentaire du lot 6).
--
-- Aucun objet ne dépend de la fonction (ni vue, ni règle, ni autre fonction).
--
-- Contrôlée par `supabase/tests/get_box_billing_moyen_paiement.sql`, dont G4
-- qui épingle le corps : une définition repartie de la baseline fait rougir la
-- CI.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP FUNCTION public.get_box_billing(uuid);

CREATE FUNCTION public.get_box_billing(p_box_id uuid)
 RETURNS TABLE(id uuid, member_id uuid, role text, status text, joined_at timestamp with time zone, plan_id uuid, subscription_status text, subscription_current_period_end timestamp with time zone, subscription_cancel_at_period_end boolean, subscription_paused boolean, pause_started_at timestamp with time zone, pause_resumes_at timestamp with time zone, commitment_end_date timestamp with time zone, amount_cents integer, platform_fee_cents integer, has_stripe_sub boolean, payment_method_type text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_box_owner_admin(p_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box requis'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT bm.id, bm.member_id, bm.role, bm.status, bm.joined_at, bm.plan_id,
         bm.subscription_status, bm.subscription_current_period_end,
         bm.subscription_cancel_at_period_end, bm.subscription_paused,
         bm.pause_started_at, bm.pause_resumes_at, bm.commitment_end_date,
         bm.amount_cents, bm.platform_fee_cents,
         (bm.stripe_subscription_id IS NOT NULL),
         bm.payment_method_type
  FROM public.box_members bm
  WHERE bm.box_id = p_box_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_box_billing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_box_billing(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_box_billing(uuid) IS
  'Lot 6 : « qui paie quoi », nominatif, réservé au gérant et au co-gérant. Le coach en est exclu — il programme, il n''encaisse pas.';

COMMIT;
