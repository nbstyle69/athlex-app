-- ═════════════════════════════════════════════════════════════════════════════
-- État de l'abonnement pour l'athlète, langue des jetons de notification,
-- catalogue sans les boxs qui ferment
--
-- Appliquée en prod : OUI, le 25/09/2026 à 21:11 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public et internal avec droits
-- db-dumps/2026-09-25/athlex-prod-public-internal-20260925T211012Z.dump,
-- sha256 20473f6d58236236a2c27f23cf4ab9e2e8ec9ef74b14bdf42423135754d5af7b vérifié
-- après aller-retour, 133 TABLE DATA, 433 ACL, 345 POLICY ; précontrôles :
-- get_my_membership_billing et list_programming_catalog aux md5 dont part ce
-- fichier, internal.membership_suspendu identique au dépôt, droits et
-- commentaire relevés, aucun objet dépendant, push_tokens sans colonne language ;
-- vérifications : les deux définitions identiques au fichier (md5
-- 6b3770f8bcf03c86b7e68f2e680c734e et 06329551f541f43204806c3bfeffc4da), droits
-- et commentaire identiques à avant, push_tokens (hors colonne ajoutée),
-- box_members, box_programming et le journal des arrêts identiques avant/après,
-- 17 jetons sans langue ; audit des droits en prod 29/29 ; tests réels en
-- transaction annulée, sans trace.)
--
-- Lot validé le 25/09/2026 (S5 côté athlète, notifications dans la langue du
-- téléphone, suite de l'archivage des boxs). Trois changements, rien d'autre.
--
-- 1. `get_my_membership_billing()` renvoie aussi, en fin de retour :
--      past_due_since          début de l'impayé (box_members) ;
--      dunning_grace_days      délai de la box avant suspension (7 par défaut,
--                              la même valeur que la règle de suspension) ;
--      suspended               `internal.membership_suspendu` : la règle qui
--                              bloque déjà les réservations (20270121) ;
--      has_stripe_subscription un abonnement Stripe existe : l'app propose
--                              alors la page de paiement ;
--      stopped_at, stop_mode   le dernier arrêt décidé par un gérant pour cette
--                              adhésion (journal `box_member_subscription_actions`,
--                              20270120), NULL s'il n'y en a pas.
--    L'app affiche l'état de l'abonnement et le bandeau « abonnement suspendu ».
--    Le type de retour change : CREATE OR REPLACE ne suffit pas, d'où DROP puis
--    CREATE. Le corps repris est celui de la PROD, relu en lecture seule
--    (md5 5774e1688a1021e2c769da83bd9aeab7, défini en dernier par
--    20261121_lot6_residu_nominatif) ; les douze colonnes d'avant sont
--    inchangées, dans le même ordre (l'app et le Manager les lisent par nom).
--    SECURITY DEFINER, STABLE et search_path identiques. Le DROP efface les
--    droits et le commentaire : ils sont reposés à l'identique (EXECUTE pour
--    authenticated et service_role, rien pour PUBLIC ni anon ; commentaire du
--    lot 6). Aucun objet ne dépend de la fonction.
--
-- 2. `push_tokens.language` : la langue du téléphone, enregistrée par l'app
--    avec le jeton (`fr` ou `en`, contrôlée ; toute autre langue du téléphone
--    donne `en` côté app). NULL pour les jetons des versions d'app d'avant :
--    `send-push` leur envoie le français. Droits et règle de la table
--    inchangés : chacun n'écrit que ses propres jetons.
--
-- 3. `list_programming_catalog(box)` ne liste plus les offres d'une box
--    archivée ou en archivage programmé (`archived_at` ou
--    `archive_scheduled_at` renseigné), sauf celles auxquelles la box qui
--    consulte est déjà abonnée (abonnement actif) : pendant l'archivage
--    programmé ses abonnements continuent jusqu'à la fin de période, et
--    l'abonné doit encore voir son offre (même principe que le Manager pour
--    une offre sans WOD). Corps repris de la PROD (md5
--    f5928fcc997547829241bd306c8d0ccd, 20261209_marketplace_whiteboard) ;
--    seul le filtre est ajouté. CREATE OR REPLACE : droits conservés.
--
-- Contrôlée par `supabase/tests/etat_abonnement_langue_catalogue.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. get_my_membership_billing ─────────────────────────────────────────────
DROP FUNCTION public.get_my_membership_billing();

CREATE FUNCTION public.get_my_membership_billing()
 RETURNS TABLE(id uuid, box_id uuid, status text, joined_at timestamp with time zone, plan_id uuid, subscription_status text, subscription_current_period_end timestamp with time zone, subscription_cancel_at_period_end boolean, subscription_paused boolean, pause_resumes_at timestamp with time zone, commitment_end_date timestamp with time zone, amount_cents integer, past_due_since timestamp with time zone, dunning_grace_days integer, suspended boolean, has_stripe_subscription boolean, stopped_at timestamp with time zone, stop_mode text)
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
         arret.mode
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
$function$;

REVOKE ALL ON FUNCTION public.get_my_membership_billing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_membership_billing() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_membership_billing() IS
  'Lot 6 : son propre abonnement, par auth.uid(). Remplace la lecture directe des colonnes nominatives de box_members.';

-- ── 2. Langue des jetons de notification ─────────────────────────────────────
ALTER TABLE public.push_tokens
  ADD COLUMN language text,
  ADD CONSTRAINT push_tokens_language_check CHECK (language IN ('fr', 'en'));

COMMENT ON COLUMN public.push_tokens.language IS
  'Langue du téléphone à l''enregistrement du jeton : fr ou en (toute autre langue donne en). NULL : version d''app antérieure, send-push envoie le français.';

-- ── 3. Catalogue sans les boxs qui ferment ───────────────────────────────────
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

COMMIT;
