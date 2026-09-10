-- ═════════════════════════════════════════════════════════════════════════════
-- Marketplace — se désabonner d'une programmation.
--
-- Jusqu'ici une box abonnée ne pouvait pas se désabonner : le statut
-- `canceled` n'était posé que par le webhook Stripe (offre payante), et rien
-- ne retirait les cartes déjà posées dans le Whiteboard.
--
-- Ce lot, additif et rejouable :
--
--   1. `unsubscribe_programming(p_subscription_id, p_remove_future)` —
--      SECURITY DEFINER, gérant / co-gérant de la box abonnée (ou backend).
--        · offre gratuite, ou paiement unique, ou appel backend : effet
--          immédiat — `status = 'canceled'` (ignoré par
--          `materialize_box_programming`, qui ne prend que `active`),
--          `color` conservée pour un réabonnement ;
--        · offre payante en abonnement Stripe (`stripe_subscription_id`
--          posé, appel client) : la fonction ne fait que MÉMORISER la demande
--          (`cancel_requested_at`, `remove_future_on_cancel`) — c'est le
--          Manager qui résilie chez Stripe à fin de période, et le webhook
--          `customer.subscription.deleted` qui rappelle cette RPC en backend.
--      `p_remove_future` : retire les cartes reçues de cette offre posées à
--      partir du LUNDI SUIVANT (Europe/Paris). La semaine en cours et les
--      semaines passées ne sont jamais touchées — les scores et l'ELO déjà
--      enregistrés y sont adossés.
--   2. Deux colonnes de mémoire de la demande sur
--      `box_programming_subscriptions`, remises à zéro par le réabonnement.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.box_programming_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS remove_future_on_cancel boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.box_programming_subscriptions.cancel_requested_at IS
  'Demande de désabonnement posée par le gérant (offre payante Stripe : résiliation à fin de période, le webhook conclut).';
COMMENT ON COLUMN public.box_programming_subscriptions.remove_future_on_cancel IS
  'À la résiliation effective, retirer les cartes reçues posées à partir du lundi suivant.';

-- ─── Réabonnement : la demande précédente ne vaut plus ────────────────────────
CREATE OR REPLACE FUNCTION public.box_prog_subs_reset_cancel_request()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status <> 'active') THEN
    NEW.cancel_requested_at := NULL;
    NEW.remove_future_on_cancel := false;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_box_prog_subs_reset_cancel_request ON public.box_programming_subscriptions;
CREATE TRIGGER trg_box_prog_subs_reset_cancel_request
  BEFORE INSERT OR UPDATE OF status ON public.box_programming_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.box_prog_subs_reset_cancel_request();

-- ─── La RPC ──────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.unsubscribe_programming(uuid, boolean);

CREATE OR REPLACE FUNCTION public.unsubscribe_programming(
  p_subscription_id uuid,
  p_remove_future boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sub        record;
  v_backend    boolean := public.request_is_backend();
  v_stripe_sub boolean;
  v_next_monday date := date_trunc('week', (now() AT TIME ZONE 'Europe/Paris'))::date + 7;
  v_removed    integer := 0;
BEGIN
  SELECT s.id, s.subscriber_box_id, s.programming_id, s.status, s.stripe_subscription_id,
         s.remove_future_on_cancel
    INTO v_sub
  FROM public.box_programming_subscriptions s
  WHERE s.id = p_subscription_id;

  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'Abonnement introuvable' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT (v_backend OR public.is_box_owner_admin(v_sub.subscriber_box_id)) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box abonnée requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Un abonnement Stripe récurrent se résilie chez Stripe (fin de période) :
  -- côté base on ne fait que mémoriser la demande, le webhook conclura.
  v_stripe_sub := v_sub.stripe_subscription_id IS NOT NULL AND v_sub.status <> 'canceled';
  IF v_stripe_sub AND NOT v_backend THEN
    UPDATE public.box_programming_subscriptions
       SET cancel_requested_at = now(),
           remove_future_on_cancel = COALESCE(p_remove_future, true)
     WHERE id = v_sub.id;
    RETURN jsonb_build_object(
      'subscription_id', v_sub.id, 'status', v_sub.status,
      'pending_stripe', true, 'removed', 0
    );
  END IF;

  -- Appel backend après résiliation Stripe : la case cochée au moment de la
  -- demande l'emporte si l'appelant ne la précise pas.
  IF v_backend AND p_remove_future IS NULL THEN
    p_remove_future := v_sub.remove_future_on_cancel;
  END IF;

  UPDATE public.box_programming_subscriptions
     SET status = 'canceled',
         cancel_requested_at = COALESCE(cancel_requested_at, now())
   WHERE id = v_sub.id
     AND status <> 'canceled';

  IF COALESCE(p_remove_future, false) THEN
    -- Jamais la semaine en cours ni le passé : scores et ELO y sont adossés.
    DELETE FROM public.box_wods w
     WHERE w.box_id = v_sub.subscriber_box_id
       AND w.source_programming_id = v_sub.programming_id
       AND w.scheduled_date IS NOT NULL
       AND w.scheduled_date >= v_next_monday;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'subscription_id', v_sub.id, 'status', 'canceled',
    'pending_stripe', false, 'removed', v_removed, 'from_monday', v_next_monday
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.unsubscribe_programming(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unsubscribe_programming(uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.unsubscribe_programming(uuid, boolean) IS
  'Désabonnement d''une programmation Marketplace (gérant/co-gérant de la box abonnée). Gratuit ou paiement unique : immédiat. Abonnement Stripe : mémorise la demande, le webhook conclut. p_remove_future retire les cartes reçues à partir du lundi suivant ; la semaine en cours et le passé sont conservés.';
