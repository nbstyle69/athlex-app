-- ═════════════════════════════════════════════════════════════════════════════
-- L'argent relève du gérant, pas du coach : résiliations, Marketplace, impayés
--
-- Appliquée en prod : NON.
--
-- Règle produit (26/09/2026) : l'argent relève du gérant et du co-gérant
-- (`is_box_owner_admin`), jamais du coach. Relevé en prod le 26/09 : la base
-- laissait le coach, en direct, lire et traiter les demandes de résiliation et
-- annuler ou supprimer un abonnement Marketplace (l'interface le lui cachait).
--
-- 1. Demandes de résiliation (`membership_cancellation_requests`) :
--    `cancel_req_read` et `cancel_req_update` passent de `is_box_staff`
--    (coach compris) à `is_box_owner_admin`. Le membre lit toujours sa propre
--    demande. `cancel_req_insert` ne change pas.
--
-- 2. Abonnements Marketplace (`box_programming_subscriptions`) :
--    `box_prog_subs_select` est scindée : côté abonné, le staff de la box
--      abonnée (`manages_box`, coach compris : couleurs des cartes reçues sur
--      `/wods`) ; côté éditeur, les boxes qui achètent une offre ne sont plus
--      lisibles que par `is_box_owner_admin` de la box éditrice ;
--    `box_prog_subs_write` (FOR ALL) passe de `manages_box` à
--      `is_box_owner_admin` de la box abonnée : le coach ne modifie, ne
--      supprime ni ne crée plus un abonnement ;
--    `subscribe_free_programming` : garde `is_box_owner_admin` au lieu de
--      `manages_box` (le coach n'abonne plus sa box). Corps repris de la prod
--      (md5 9357924e26b38f7cf304f76c1ee039cc), seule la garde change.
--    `box_programming_wods_write` ne change pas : le coach écrit toujours le
--    contenu des offres, y compris payantes.
--
-- 3. `get_box_dunning` : la garde devient `IF NOT is_box_owner_admin(p_box_id)
--    THEN RAISE 42501`, comme `get_box_billing`, au lieu d'un filtre qui rendait
--    une liste vide. Corps repris de la prod (md5
--    87fada6405beafb43a611d782ae8342c) : même retour, même requête, sans le
--    filtre de rôle ; passe de LANGUAGE sql à plpgsql pour lever l'erreur.
--    CREATE OR REPLACE : droits conservés.
--
-- Effet de bord assumé : `is_box_owner_admin` compte aussi les admins de la
-- plateforme (`admin`, `super_admin`) ; ils lisent désormais les demandes de
-- résiliation et les impayés de toute box (le super-admin lisait déjà les
-- impayés).
--
-- Vérifié avant : aucun écran de l'app ni du Manager n'utilise ces droits en
-- tant que coach, hors la couleur des abonnements de sa box sur `/wods`
-- (gardée par le point 2). Les fonctions qui touchent ces abonnements sont
-- toutes SECURITY DEFINER (dont `apply_program_week`, utilisée par le coach).
--
-- Contrôlée par `supabase/tests/coach_argent.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Demandes de résiliation ───────────────────────────────────────────────
DROP POLICY cancel_req_read ON public.membership_cancellation_requests;
CREATE POLICY cancel_req_read ON public.membership_cancellation_requests
  FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_box_owner_admin(box_id));

DROP POLICY cancel_req_update ON public.membership_cancellation_requests;
CREATE POLICY cancel_req_update ON public.membership_cancellation_requests
  FOR UPDATE TO authenticated
  USING (public.is_box_owner_admin(box_id))
  WITH CHECK (public.is_box_owner_admin(box_id));

-- ── 2. Abonnements Marketplace ───────────────────────────────────────────────
DROP POLICY box_prog_subs_select ON public.box_programming_subscriptions;
CREATE POLICY box_prog_subs_select ON public.box_programming_subscriptions
  FOR SELECT
  USING (
    public.manages_box(subscriber_box_id)
    OR EXISTS (SELECT 1 FROM public.box_programming p
                WHERE p.id = box_programming_subscriptions.programming_id
                  AND public.is_box_owner_admin(p.publisher_box_id))
  );

DROP POLICY box_prog_subs_write ON public.box_programming_subscriptions;
CREATE POLICY box_prog_subs_write ON public.box_programming_subscriptions
  FOR ALL
  USING (public.is_box_owner_admin(subscriber_box_id))
  WITH CHECK (public.is_box_owner_admin(subscriber_box_id));

CREATE OR REPLACE FUNCTION public.subscribe_free_programming(p_programming_id uuid, p_subscriber_box_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog   record;
  -- Lundi SUIVANT (Paris) : la première pose automatique est la semaine 1.
  v_anchor date := date_trunc('week', (now() AT TIME ZONE 'Europe/Paris'))::date + 7;
  v_id     uuid;
BEGIN
  IF NOT public.is_box_owner_admin(p_subscriber_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id, publisher_box_id, is_published, COALESCE(price_cents, 0) AS price_cents,
         COALESCE(billing, 'free') AS billing
    INTO v_prog
  FROM public.box_programming
  WHERE id = p_programming_id;

  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programmation introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT v_prog.is_published THEN
    RAISE EXCEPTION 'Cette programmation n''est pas publiée' USING ERRCODE = 'check_violation';
  END IF;
  IF v_prog.publisher_box_id = p_subscriber_box_id THEN
    RAISE EXCEPTION 'Une box ne s''abonne pas à sa propre offre' USING ERRCODE = 'check_violation';
  END IF;
  IF v_prog.price_cents > 0 OR v_prog.billing <> 'free' THEN
    RAISE EXCEPTION
      'PAID_PROGRAMMING : cette offre est payante — elle passe par le paiement Stripe'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.box_programming_subscriptions
    (programming_id, subscriber_box_id, status, week_anchor, created_by)
  VALUES (p_programming_id, p_subscriber_box_id, 'active', v_anchor, auth.uid())
  ON CONFLICT (programming_id, subscriber_box_id)
  DO UPDATE SET status = 'active',
                week_anchor = v_anchor,
                created_by = COALESCE(auth.uid(), public.box_programming_subscriptions.created_by)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('subscription_id', v_id, 'status', 'active', 'week_anchor', v_anchor);
END;
$function$;

-- ── 3. Impayés ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_box_dunning(p_box_id uuid)
 RETURNS TABLE(id uuid, username text, email text, plan_name text, amount_cents integer, payment_method_type text, past_due_since timestamp with time zone, dunning_attempts integer, dunning_reminders_sent integer, dunning_last_reminder_at timestamp with time zone, last_payment_error text, has_stripe_sub boolean, suspended boolean, grace_days integer)
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
  select
    bm.id,
    p.username,
    p.email,
    mp.name,
    bm.amount_cents,
    bm.payment_method_type,
    bm.past_due_since,
    bm.dunning_attempts,
    bm.dunning_reminders_sent,
    bm.dunning_last_reminder_at,
    bm.last_payment_error,
    (bm.stripe_subscription_id is not null),
    -- Accès suspendu dès que l'impayé dépasse le délai de grâce de la box.
    (bm.past_due_since is not null
      and now() >= bm.past_due_since + make_interval(days => coalesce(b.dunning_grace_days, 7))),
    b.dunning_grace_days
  from public.box_members bm
  join public.boxes b on b.id = bm.box_id
  left join public.profiles p on p.id = bm.member_id
  left join public.membership_plans mp on mp.id = bm.plan_id
  where bm.box_id = p_box_id
    and bm.subscription_status = 'past_due'
  order by bm.past_due_since asc nulls last;
END;
$function$;

COMMIT;
