-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270152000000_comptoir_fin_acces.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test comptoir_fin_acces.sql le rejoue dans sa
-- propre transaction annulée).
--
-- Définition rétablie octet pour octet (md5 de pg_get_functiondef, search_path
-- "$user", public, extensions ; relevé de prod du 13/10/2026, à recontrôler en
-- prod avant l'application) :
--   public.get_my_membership_billing()   b4ca55006146fc83bc3da8eff1260234
-- Perdu au retour : la file des messages au membre et la tâche planifiée. Les
-- membres déjà coupés (subscription_status 'expired') le restent : la coupure
-- est une donnée, pas un objet ; un encaissement les rétablit.
-- ═════════════════════════════════════════════════════════════════════════════

DO $retour$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'comptoir-fin-acces';
  END IF;
END $retour$;

DROP FUNCTION public.get_my_membership_billing();
CREATE OR REPLACE FUNCTION public.get_my_membership_billing()
 RETURNS TABLE(id uuid, box_id uuid, status text, joined_at timestamp with time zone, plan_id uuid, subscription_status text, subscription_current_period_end timestamp with time zone, subscription_cancel_at_period_end boolean, subscription_paused boolean, pause_resumes_at timestamp with time zone, commitment_end_date timestamp with time zone, amount_cents integer, past_due_since timestamp with time zone, dunning_grace_days integer, suspended boolean, has_stripe_subscription boolean, stopped_at timestamp with time zone, stop_mode text, scheduled_plan_id uuid, scheduled_change_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT bm.id, bm.box_id, bm.status, bm.joined_at, bm.plan_id,
         bm.subscription_status, bm.subscription_current_period_end,
         bm.subscription_cancel_at_period_end, bm.subscription_paused,
         bm.pause_resumes_at, bm.commitment_end_date, bm.amount_cents,
         bm.past_due_since,
         COALESCE(b.dunning_grace_days, 7),
         internal.membership_suspendu(bm.member_id, bm.box_id),
         (bm.stripe_subscription_id IS NOT NULL),
         arret.created_at,
         arret.mode,
         bm.scheduled_plan_id,
         bm.scheduled_change_at
  FROM public.box_members bm
  LEFT JOIN public.boxes b ON b.id = bm.box_id
  LEFT JOIN LATERAL (
    SELECT a.created_at, a.mode
      FROM public.box_member_subscription_actions a
     WHERE a.box_member_id = bm.id
       AND a.action = 'stop'
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT 1
  ) arret ON true
  WHERE bm.member_id = auth.uid();
$function$
;
REVOKE ALL ON FUNCTION public.get_my_membership_billing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_membership_billing() TO authenticated, service_role;
COMMENT ON FUNCTION public.get_my_membership_billing() IS
  'Lot 6 : son propre abonnement, par auth.uid(). Remplace la lecture directe des colonnes nominatives de box_members.';

DROP FUNCTION internal.expirer_acces_comptoir();
DROP FUNCTION internal.purger_avis_fin_acces();
DROP FUNCTION internal.filer_avis_fin_acces();
DROP TABLE public.box_member_access_notices;
DROP FUNCTION internal.adhesions_comptoir_datees();
