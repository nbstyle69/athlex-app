-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270150000000_get_box_billing_changement_programme.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test get_box_billing_changement_programme.sql
-- le rejoue dans sa propre transaction annulée).
--
-- Rétablit la définition de 20270122, celle de la prod avant la migration
-- (md5 c96d2dc554cdc4e3e240f526a38ecb98, relevé du 11/10/2026), ses droits
-- (EXECUTE pour authenticated et service_role seulement) et son commentaire.
-- Les colonnes scheduled_* de box_members ne sont pas touchées (20270147).
-- ═════════════════════════════════════════════════════════════════════════════

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
