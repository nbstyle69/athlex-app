-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270167000000_programming_invitations.sql
-- (nbstyle69/AthleX-Manager#461, PR 1)
--
-- À jouer en UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test le rejoue dans sa transaction annulée).
--
-- Remet la garde guard_box_programming_subscription, list_programming_catalog et
-- la policy box_programming_select à leur définition de prod d'avant 20270167
-- (md5 396574b203eb878a8a1cbcbcbaf5bf53, 06329551f541f43204806c3bfeffc4da et
-- policy TO public au corps du baseline), puis retire la tâche d'expiration, le
-- déclencheur de dépublication, les fonctions, les deux colonnes de
-- box_programming_subscriptions, la table des invitations et
-- box_programming.visibility.
--
-- Garde : refuse d'agir si une invitation existe. Un accès « Offert » sur une
-- offre payante redeviendrait sinon un abonnement actif sans paiement, et une
-- offre « invitation » reviendrait au catalogue : ces cas se décident un par un.
-- Vérifié sur le rejeu par supabase/tests/programming_invitations.sql (R1).
-- ═════════════════════════════════════════════════════════════════════════════

DO $retour$
BEGIN
  IF EXISTS (SELECT 1 FROM public.box_programming_invitations) THEN
    RAISE EXCEPTION 'PROGRAMMING_INVITATIONS_RETOUR_ETAT: des invitations existent : rien n''est écrit';
  END IF;
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'programming-invitations-expire';
  END IF;
END $retour$;

DROP TRIGGER trg_box_programming_depubliee_invitations ON public.box_programming;
DROP FUNCTION internal.annuler_invitations_offre_depubliee();
DROP FUNCTION internal.expire_programming_invitations();

DROP POLICY box_programming_select ON public.box_programming;
CREATE POLICY box_programming_select ON public.box_programming
  FOR SELECT
  USING ((is_published AND (EXISTS (SELECT 1 FROM public.boxes b WHERE public.manages_box(b.id))))
         OR public.manages_box(publisher_box_id));

CREATE OR REPLACE FUNCTION public.list_programming_catalog(p_box_id uuid)
 RETURNS TABLE(programming_id uuid, title text, description text, discipline text, level text, days_per_week integer, weeks_count integer, billing text, price_cents integer, currency text, publisher_box_id uuid, publisher_box_name text, goal text, target_audience text, equipment text, wods_total integer, wods_per_week integer[], preview_week1 jsonb, subscribed boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.manages_box(p_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou coach de la box requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT p.id, p.title, p.description, p.discipline, p.level,
           p.days_per_week::int, p.weeks_count::int, p.billing, p.price_cents, p.currency,
           p.publisher_box_id, pb.name,
           p.goal, p.target_audience, p.equipment,
           (SELECT count(*)::int FROM public.box_programming_wods w WHERE w.programming_id = p.id),
           (SELECT array_agg(COALESCE(c.n, 0)::int ORDER BY wk.n)
              FROM generate_series(1, p.weeks_count) wk(n)
              LEFT JOIN (
                SELECT w.week_number, count(*) AS n
                  FROM public.box_programming_wods w
                 WHERE w.programming_id = p.id
                 GROUP BY w.week_number
              ) c ON c.week_number = wk.n),
           -- [{day, titles:[...]}] pour la semaine 1, jour par jour
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day_of_week, 'titles', d.titles)
                                      ORDER BY d.day_of_week), '[]'::jsonb)
              FROM (
                SELECT w.day_of_week, jsonb_agg(w.title ORDER BY w.sort_order) AS titles
                  FROM public.box_programming_wods w
                 WHERE w.programming_id = p.id AND w.week_number = 1
                 GROUP BY w.day_of_week
              ) d),
           EXISTS (
             SELECT 1 FROM public.box_programming_subscriptions s
              WHERE s.programming_id = p.id
                AND s.subscriber_box_id = p_box_id
                AND s.status = 'active'
           )
      FROM public.box_programming p
      LEFT JOIN public.boxes pb ON pb.id = p.publisher_box_id
     WHERE p.is_published
       AND NOT p.is_template
       AND p.publisher_box_id <> p_box_id
       -- Une box archivée ou en archivage programmé ne vend plus ; l'abonné
       -- actif voit encore son offre jusqu'à la fin de son abonnement.
       AND ((pb.archived_at IS NULL AND pb.archive_scheduled_at IS NULL)
            OR EXISTS (
              SELECT 1 FROM public.box_programming_subscriptions s
               WHERE s.programming_id = p.id
                 AND s.subscriber_box_id = p_box_id
                 AND s.status = 'active'
            ))
     ORDER BY p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_box_programming_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_paid           boolean;
  v_backend        boolean := public.request_is_backend();
  v_devient_active boolean;
  v_pose_stripe    boolean;
BEGIN
  SELECT COALESCE(p.price_cents, 0) > 0 OR COALESCE(p.billing, 'free') <> 'free'
    INTO v_paid
  FROM public.box_programming p
  WHERE p.id = NEW.programming_id;

  IF v_paid IS NULL THEN
    RAISE EXCEPTION 'Programmation introuvable' USING ERRCODE = 'no_data_found';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_devient_active := NEW.status = 'active';
    v_pose_stripe := NEW.stripe_subscription_id IS NOT NULL
                  OR NEW.stripe_customer_id IS NOT NULL
                  OR NEW.current_period_end IS NOT NULL;
  ELSE
    v_devient_active := NEW.status = 'active' AND OLD.status <> 'active';
    v_pose_stripe := NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
                  OR NEW.stripe_customer_id     IS DISTINCT FROM OLD.stripe_customer_id
                  OR NEW.current_period_end     IS DISTINCT FROM OLD.current_period_end;
  END IF;

  IF v_devient_active AND v_paid AND NOT v_backend THEN
    RAISE EXCEPTION
      'PAID_PROGRAMMING : une offre payante s''active par le paiement (webhook Stripe), pas par le client'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Les références Stripe sont posées par le backend, jamais revendiquées par
  -- un client : sans cela, un client modifié se déclarerait payé.
  IF v_pose_stripe AND NOT v_backend THEN
    RAISE EXCEPTION
      'PAID_PROGRAMMING : les références de paiement sont posées par le backend'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

DROP FUNCTION public.programming_visible_by_invitation(uuid);
DROP FUNCTION public.list_programming_invitations_sent(uuid);
DROP FUNCTION public.list_my_programming_invitations(uuid);
DROP FUNCTION public.revoke_offered_programming_access(uuid);
DROP FUNCTION public.accept_programming_invitation(uuid);
DROP FUNCTION public.decline_programming_invitation(uuid);
DROP FUNCTION public.cancel_programming_invitation(uuid);
DROP FUNCTION public.send_programming_invitation(uuid, uuid, text, text);
DROP FUNCTION public.search_boxes_for_invitation(uuid, text);

ALTER TABLE public.box_programming_subscriptions
  DROP COLUMN invitation_id,
  DROP COLUMN revoked_by_publisher_at;
DROP TABLE public.box_programming_invitations;
ALTER TABLE public.box_programming DROP COLUMN visibility;
