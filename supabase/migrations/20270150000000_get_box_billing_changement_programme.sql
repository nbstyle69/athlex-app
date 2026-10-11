-- ═════════════════════════════════════════════════════════════════════════════
-- get_box_billing renvoie aussi le changement de formule programmé
-- (scheduled_plan_id, scheduled_change_at)
--
-- Appliquée en prod : oui, le 11/10/2026 à 21:34 UTC.
--
-- Pour que la page Abonnés du Manager (PR AthleX-Manager #425) affiche
-- « Changement programmé → {formule} le {date} » sur la ligne d'un membre dont
-- la formule change à l'échéance. Les deux colonnes de box_members existent
-- depuis 20270147 (écrites par la clé serveur seule) ; aucune lecture du
-- navigateur ne les sert au gérant. Le Manager lit exactement ces deux noms.
--
-- Le type de retour change : CREATE OR REPLACE ne suffit pas, d'où DROP puis
-- CREATE. Le corps repris est celui de la PROD, relu en lecture seule le
-- 11/10/2026 (md5 c96d2dc554cdc4e3e240f526a38ecb98, identique à 20270122,
-- dernière définition dans les fichiers ; 20270131 ne la redéfinit pas, il la
-- cite seulement). Seuls changent : `scheduled_plan_id uuid` et
-- `scheduled_change_at timestamptz` en fin de retour et du SELECT. Garde
-- is_box_owner_admin (gérant et co-gérants ; le coach, un simple membre ou le
-- gérant d'une autre box sont refusés en 42501, comme avant : ils ne voient ni
-- les colonnes d'argent ni ces deux champs), SECURITY DEFINER, STABLE et
-- search_path identiques.
--
-- Le DROP efface les droits et le commentaire : ils sont reposés à l'identique
-- (EXECUTE pour authenticated et service_role, rien pour PUBLIC ni anon ;
-- commentaire du lot 6). Relevé de prod : proacl
-- {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}.
--
-- Aucun objet ne dépend de la fonction (pg_depend, vues, autres fonctions :
-- 0 en prod le 11/10/2026).
--
-- Contrôlée par `supabase/tests/get_box_billing_changement_programme.sql`
-- (empreinte, accès, mutations, retour arrière) et
-- `supabase/tests/get_box_billing_moyen_paiement.sql` (G5 épingle désormais
-- cette définition).
--
-- Retour arrière (transactionnel, rejoué par le test) :
--
--   psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 \
--     -f supabase/retours/20270150000000_get_box_billing_changement_programme.sql
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP FUNCTION public.get_box_billing(uuid);

CREATE FUNCTION public.get_box_billing(p_box_id uuid)
 RETURNS TABLE(id uuid, member_id uuid, role text, status text, joined_at timestamp with time zone, plan_id uuid, subscription_status text, subscription_current_period_end timestamp with time zone, subscription_cancel_at_period_end boolean, subscription_paused boolean, pause_started_at timestamp with time zone, pause_resumes_at timestamp with time zone, commitment_end_date timestamp with time zone, amount_cents integer, platform_fee_cents integer, has_stripe_sub boolean, payment_method_type text, scheduled_plan_id uuid, scheduled_change_at timestamp with time zone)
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
         bm.payment_method_type,
         bm.scheduled_plan_id, bm.scheduled_change_at
  FROM public.box_members bm
  WHERE bm.box_id = p_box_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_box_billing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_box_billing(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_box_billing(uuid) IS
  'Lot 6 : « qui paie quoi », nominatif, réservé au gérant et au co-gérant. Le coach en est exclu — il programme, il n''encaisse pas.';

COMMIT;
