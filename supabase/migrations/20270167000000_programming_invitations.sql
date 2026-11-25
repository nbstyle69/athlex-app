-- ═════════════════════════════════════════════════════════════════════════════
-- Invitation box → box à une offre de programmation (base seulement)
-- (nbstyle69/AthleX-Manager#461, PR 1)
--
-- Appliquée en prod : OUI, le 25/11/2026 à 14:58, heure de Paris lue par la
-- base, avec PGCLIENTENCODING=UTF8 (commit 45f3527f, sha256 du fichier
-- b76fdd53…9433). Dump des schémas public et internal avec droits
-- db-dumps/2026-11-25/athlex-prod-public-internal-20261125T135728Z.dump,
-- sha256 bd6a0a150d8c2c064a6fa2144356e7c0aa77c45c317d1bb8d2c47af86bd1785f,
-- aller-retour vérifié ; 141 TABLE DATA, 486 ACL, 348 POLICY. Précontrôle en
-- lecture seule : garde 396574b2…, catalogue 06329551…, policy e0101c97…
-- (ceux de la prod attendus), 20270166 présente, rien de 20270167. Après :
-- garde 344a90c4…, catalogue c15f6e94…, policy 51250a15… (ceux du rejeu) ;
-- box_programming (5 lignes) et box_programming_subscriptions (2 lignes)
-- identiques sur leurs colonnes d'origine (24617817… et 10fa386a…), toutes
-- en visibility 'catalogue', invitation_id et revoked_by_publisher_at vides ;
-- job pg_cron programming-invitations-expire posé ; EXECUTE des neuf fonctions
-- à authenticated seulement ; audit des droits 48/48 (master) et 49/49
-- (branche) ; test réel annulé sur des box jetables (envoi, acceptation
-- « Offerte », lecture invitée oui / tierce non, retrait au lundi suivant),
-- aucune trace.
-- Pas de BEGIN/COMMIT dans ce fichier : il se joue en UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- Retour arrière : supabase/retours/20270167000000_programming_invitations.sql,
-- vérifié sur le rejeu par supabase/tests/programming_invitations.sql (R1) :
-- les trois définitions redéfinies ici reviennent à leur md5 de prod, les objets
-- ajoutés disparaissent. Il refuse d'agir dès qu'une invitation existe (un accès
-- « Offert » sur une offre payante deviendrait sinon un accès sans paiement).
--
-- Décisions de Nab (24 et 25/11/2026) : n'importe quelle box AthleX invite
-- n'importe quelle autre box à une de ses offres, « Offerte » (`offered`,
-- gratuite quel que soit le mode de facturation) ou « Au prix de l'offre »
-- (`offer_price`, Stripe Connect, acceptation en PR 3) ; une offre peut être
-- « Sur invitation seulement » (`visibility = 'invitation'`, hors catalogue) ;
-- 14 jours de validité, 20 invitations par box éditrice et par 24 h glissantes ;
-- une seule invitation en attente par (offre, box invitée) ; gérant et co-gérant
-- seulement des deux côtés (`is_box_owner_admin`), le coach ne gagne rien ;
-- l'éditrice retire un accès « Offert » accepté avec effet le lundi suivant.
--
-- Aucun écran, aucune route, aucun envoi (notification, push, e-mail : PR 4),
-- aucune Edge Function.
--
--  1. box_programming.visibility ('catalogue' par défaut, 'invitation').
--  2. Table box_programming_invitations : RLS, lecture par les gérants de la
--     box éditrice ou de la box invitée, aucune écriture client (T10 de l'audit).
--  3. box_programming_subscriptions.invitation_id et revoked_by_publisher_at.
--  4. Huit fonctions publiques SECURITY DEFINER (EXECUTE : authenticated).
--  5. Garde guard_box_programming_subscription redéfinie depuis la prod
--     (md5 396574b203eb878a8a1cbcbcbaf5bf53, corps de 20261119 lot 5-F).
--  6. list_programming_catalog redéfinie depuis la prod
--     (md5 06329551f541f43204806c3bfeffc4da, corps de 20270128) : un filtre de
--     plus, signature et colonnes inchangées (pas de colonne visibility : elle
--     changerait le type de retour, donc DROP puis CREATE, sans utilité pour
--     l'appelant actuel puisque les offres « invitation » n'y sont plus).
--  7. Policy box_programming_select redéfinie depuis la prod (celle du
--     baseline). Elle passe de TO public à TO authenticated : pour anon elle
--     ne rendait déjà rien (manages_box faux sans auth.uid()), et la nouvelle
--     fonction qu'elle appelle n'est pas exécutable par anon.
--  8. Expiration quotidienne par pg_cron (SQL, aucun appel HTTP).
--  9. Dépublier une offre annule ses invitations en attente ; la supprimer les
--     supprime (ON DELETE CASCADE).
--
-- Retrait d'un accès « Offert » : current_period_end = lundi suivant 00:00
-- (Paris, heure lue par la base). La pose du dimanche 18:00
-- (materialize_box_programming) prend la semaine du lundi suivant tant que
-- current_period_end > now() : le retrait coupe donc aussi auto_apply_weekly,
-- et la garde refuse de le rallumer sur un accès retiré. Rien de déjà posé
-- n'est supprimé (semaine en cours, scores, ELO).
--
-- Contrôlée par supabase/tests/programming_invitations.sql.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Visibilité d'une offre ────────────────────────────────────────────────
ALTER TABLE public.box_programming
  ADD COLUMN visibility text NOT NULL DEFAULT 'catalogue'
    CONSTRAINT box_programming_visibility_check CHECK (visibility IN ('catalogue', 'invitation'));

COMMENT ON COLUMN public.box_programming.visibility IS
  'catalogue : listée au catalogue de la Marketplace. invitation : sur invitation seulement, hors catalogue (#461).';

-- ── 2. Les invitations ───────────────────────────────────────────────────────
CREATE TABLE public.box_programming_invitations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programming_id   uuid NOT NULL REFERENCES public.box_programming(id) ON DELETE CASCADE,
  publisher_box_id uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  invited_box_id   uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  pricing          text NOT NULL CHECK (pricing IN ('offered', 'offer_price')),
  message          text CHECK (message IS NULL OR char_length(message) <= 280),
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT now() + interval '14 days',
  invited_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at     timestamptz,
  subscription_id  uuid REFERENCES public.box_programming_subscriptions(id) ON DELETE SET NULL,
  CONSTRAINT box_programming_invitations_autre_box CHECK (publisher_box_id <> invited_box_id)
);

CREATE UNIQUE INDEX box_programming_invitations_une_en_attente
  ON public.box_programming_invitations (programming_id, invited_box_id)
  WHERE status = 'pending';
CREATE INDEX box_programming_invitations_editrice
  ON public.box_programming_invitations (publisher_box_id, created_at);
CREATE INDEX box_programming_invitations_invitee
  ON public.box_programming_invitations (invited_box_id, status);

COMMENT ON TABLE public.box_programming_invitations IS
  'Invitations box → box à une offre de programmation (#461). Écrites par les seules fonctions *_programming_invitation ; lues par les gérants des deux box.';

ALTER TABLE public.box_programming_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.box_programming_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.box_programming_invitations TO authenticated;
GRANT ALL ON TABLE public.box_programming_invitations TO service_role;

-- is_box_owner_admin : SECURITY DEFINER, bornée à auth.uid().
CREATE POLICY box_programming_invitations_select ON public.box_programming_invitations
  FOR SELECT TO authenticated
  USING (public.is_box_owner_admin(publisher_box_id) OR public.is_box_owner_admin(invited_box_id));

-- ── 3. L'abonnement garde la trace de son invitation ─────────────────────────
-- Table lue par le client : rien de sensible ici, un identifiant et une date.
ALTER TABLE public.box_programming_subscriptions
  ADD COLUMN invitation_id uuid REFERENCES public.box_programming_invitations(id) ON DELETE SET NULL,
  ADD COLUMN revoked_by_publisher_at timestamptz;

-- ── 4. Les fonctions ─────────────────────────────────────────────────────────

-- Recherche d'une box à inviter : nom seul, aucune donnée personnelle.
CREATE FUNCTION public.search_boxes_for_invitation(p_programming_id uuid, p_q text)
 RETURNS TABLE(box_id uuid, name text, already_subscribed boolean, invitation_pending boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_publisher uuid;
  v_q         text := btrim(COALESCE(p_q, ''));
BEGIN
  SELECT publisher_box_id INTO v_publisher FROM public.box_programming WHERE id = p_programming_id;
  IF v_publisher IS NULL THEN
    RAISE EXCEPTION 'Programmation introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_box_owner_admin(v_publisher) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box éditrice requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF char_length(v_q) < 2 THEN
    RAISE EXCEPTION 'INVITATION_RECHERCHE_COURTE : saisissez au moins 2 lettres du nom de la box'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
    SELECT b.id, b.name,
           EXISTS (SELECT 1 FROM public.box_programming_subscriptions s
                    WHERE s.programming_id = p_programming_id AND s.subscriber_box_id = b.id
                      AND s.status = 'active'
                      AND (s.current_period_end IS NULL OR s.current_period_end > now())),
           EXISTS (SELECT 1 FROM public.box_programming_invitations i
                    WHERE i.programming_id = p_programming_id AND i.invited_box_id = b.id
                      AND i.status = 'pending' AND i.expires_at > now())
      FROM public.boxes b
     WHERE b.id <> v_publisher
       AND b.archived_at IS NULL
       AND b.archive_scheduled_at IS NULL
       AND b.name ILIKE '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
     ORDER BY b.name, b.id
     LIMIT 10;
END;
$function$;

CREATE FUNCTION public.send_programming_invitation(
  p_programming_id uuid, p_invited_box_id uuid, p_pricing text, p_message text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog    record;
  v_invitee record;
  v_message text := NULLIF(btrim(COALESCE(p_message, '')), '');
  v_id      uuid;
  v_expires timestamptz := now() + interval '14 days';
BEGIN
  SELECT p.id, p.publisher_box_id, p.is_published, p.is_template,
         COALESCE(p.price_cents, 0) > 0 OR COALESCE(p.billing, 'free') <> 'free' AS paid,
         pb.archived_at IS NOT NULL OR pb.archive_scheduled_at IS NOT NULL AS publisher_closing
    INTO v_prog
    FROM public.box_programming p
    JOIN public.boxes pb ON pb.id = p.publisher_box_id
   WHERE p.id = p_programming_id;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programmation introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_box_owner_admin(v_prog.publisher_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box éditrice requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT v_prog.is_published OR v_prog.is_template THEN
    RAISE EXCEPTION 'INVITATION_OFFRE_NON_PUBLIEE : publiez l''offre avant d''inviter une box'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_prog.publisher_closing THEN
    RAISE EXCEPTION 'INVITATION_BOX_ARCHIVEE : votre box est archivée ou en cours d''archivage, elle n''invite plus'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_pricing IS NULL OR p_pricing NOT IN ('offered', 'offer_price') THEN
    RAISE EXCEPTION 'INVITATION_TARIF : le tarif est « offered » (offerte) ou « offer_price » (au prix de l''offre)'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_pricing = 'offer_price' AND NOT v_prog.paid THEN
    RAISE EXCEPTION 'INVITATION_TARIF : cette offre est gratuite, invitez-la en « Offerte »'
      USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(v_message) > 280 THEN
    RAISE EXCEPTION 'INVITATION_MESSAGE_TROP_LONG : le message tient en 280 caractères au plus'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT b.id, b.archived_at IS NOT NULL OR b.archive_scheduled_at IS NOT NULL AS closing
    INTO v_invitee
    FROM public.boxes b WHERE b.id = p_invited_box_id;
  IF v_invitee.id IS NULL THEN
    RAISE EXCEPTION 'Box introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_invited_box_id = v_prog.publisher_box_id THEN
    RAISE EXCEPTION 'INVITATION_BOX_PROPRE : une box ne s''invite pas à sa propre offre'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_invitee.closing THEN
    RAISE EXCEPTION 'INVITATION_BOX_ARCHIVEE : cette box est archivée ou en cours d''archivage, elle ne reçoit plus d''invitation'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.box_programming_subscriptions s
              WHERE s.programming_id = p_programming_id AND s.subscriber_box_id = p_invited_box_id
                AND s.status = 'active'
                AND (s.current_period_end IS NULL OR s.current_period_end > now())) THEN
    RAISE EXCEPTION 'INVITATION_DEJA_ABONNEE : cette box est déjà abonnée à l''offre'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Une seule à la fois par box éditrice : la limite se compte sans course.
  PERFORM pg_advisory_xact_lock(hashtextextended('box_programming_invitations:' || v_prog.publisher_box_id::text, 0));

  -- Une invitation échue que la tâche du jour n'a pas encore passée en expired
  -- n'empêche pas d'en renvoyer une.
  UPDATE public.box_programming_invitations
     SET status = 'expired'
   WHERE programming_id = p_programming_id AND invited_box_id = p_invited_box_id
     AND status = 'pending' AND expires_at <= now();
  IF EXISTS (SELECT 1 FROM public.box_programming_invitations
              WHERE programming_id = p_programming_id AND invited_box_id = p_invited_box_id
                AND status = 'pending') THEN
    RAISE EXCEPTION 'INVITATION_EN_ATTENTE : une invitation à cette offre attend déjà la réponse de cette box'
      USING ERRCODE = 'check_violation';
  END IF;
  IF (SELECT count(*) FROM public.box_programming_invitations
       WHERE publisher_box_id = v_prog.publisher_box_id
         AND created_at > now() - interval '24 hours') >= 20 THEN
    RAISE EXCEPTION 'INVITATION_LIMITE : 20 invitations au plus par 24 heures pour une box, réessayez plus tard'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.box_programming_invitations
    (programming_id, publisher_box_id, invited_box_id, pricing, message, created_at, expires_at, invited_by)
  VALUES (p_programming_id, v_prog.publisher_box_id, p_invited_box_id, p_pricing, v_message, now(), v_expires, auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('invitation_id', v_id, 'status', 'pending', 'expires_at', v_expires);
END;
$function$;

CREATE FUNCTION public.cancel_programming_invitation(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_inv record;
BEGIN
  SELECT id, publisher_box_id, status INTO v_inv
    FROM public.box_programming_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_box_owner_admin(v_inv.publisher_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box éditrice requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_PLUS_EN_ATTENTE : cette invitation n''attend plus de réponse'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.box_programming_invitations SET status = 'cancelled' WHERE id = p_invitation_id;
  RETURN jsonb_build_object('invitation_id', p_invitation_id, 'status', 'cancelled');
END;
$function$;

CREATE FUNCTION public.decline_programming_invitation(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_inv record;
BEGIN
  SELECT id, invited_box_id, status, expires_at INTO v_inv
    FROM public.box_programming_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_box_owner_admin(v_inv.invited_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box invitée requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_PLUS_EN_ATTENTE : cette invitation n''attend plus de réponse'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'INVITATION_EXPIREE : cette invitation a expiré'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.box_programming_invitations
     SET status = 'declined', responded_at = now()
   WHERE id = p_invitation_id;
  RETURN jsonb_build_object('invitation_id', p_invitation_id, 'status', 'declined');
END;
$function$;

CREATE FUNCTION public.accept_programming_invitation(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_inv    record;
  -- Lundi SUIVANT (Paris) : la première pose automatique est la semaine 1,
  -- comme subscribe_free_programming.
  v_anchor date := date_trunc('week', (now() AT TIME ZONE 'Europe/Paris'))::date + 7;
  v_sub_id uuid;
BEGIN
  SELECT id, programming_id, invited_box_id, pricing, status, expires_at INTO v_inv
    FROM public.box_programming_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_box_owner_admin(v_inv.invited_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box invitée requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_PLUS_EN_ATTENTE : cette invitation n''attend plus de réponse'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'INVITATION_EXPIREE : cette invitation a expiré'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_inv.pricing <> 'offered' THEN
    RAISE EXCEPTION 'INVITATION_PAIEMENT_REQUIS : cette invitation est au prix de l''offre, elle s''accepte par le paiement'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.box_programming_subscriptions s
              WHERE s.programming_id = v_inv.programming_id AND s.subscriber_box_id = v_inv.invited_box_id
                AND s.status = 'active'
                AND (s.current_period_end IS NULL OR s.current_period_end > now())) THEN
    RAISE EXCEPTION 'INVITATION_DEJA_ABONNEE : votre box est déjà abonnée à cette offre'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Relu par la garde : seule cette fonction active une offre payante hors
  -- backend, pour cette invitation-là, le temps de cette écriture.
  PERFORM set_config('athlex.invitation_programmation', p_invitation_id::text, true);

  INSERT INTO public.box_programming_subscriptions
    (programming_id, subscriber_box_id, status, week_anchor, created_by, invitation_id)
  VALUES (v_inv.programming_id, v_inv.invited_box_id, 'active', v_anchor, auth.uid(), p_invitation_id)
  ON CONFLICT (programming_id, subscriber_box_id)
  DO UPDATE SET status = 'active',
                week_anchor = v_anchor,
                created_by = COALESCE(auth.uid(), public.box_programming_subscriptions.created_by),
                invitation_id = p_invitation_id,
                current_period_end = NULL,
                revoked_by_publisher_at = NULL
  RETURNING id INTO v_sub_id;

  PERFORM set_config('athlex.invitation_programmation', '', true);

  UPDATE public.box_programming_invitations
     SET status = 'accepted', responded_at = now(), subscription_id = v_sub_id
   WHERE id = p_invitation_id;

  RETURN jsonb_build_object('invitation_id', p_invitation_id, 'status', 'accepted',
                            'subscription_id', v_sub_id, 'week_anchor', v_anchor);
END;
$function$;

CREATE FUNCTION public.revoke_offered_programming_access(p_subscription_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sub record;
  -- Lundi suivant 00:00, heure de Paris lue par la base.
  v_fin timestamptz := (date_trunc('week', now() AT TIME ZONE 'Europe/Paris') + interval '7 days')
                       AT TIME ZONE 'Europe/Paris';
BEGIN
  SELECT s.id, s.status, s.current_period_end, s.revoked_by_publisher_at,
         p.publisher_box_id, i.pricing
    INTO v_sub
    FROM public.box_programming_subscriptions s
    JOIN public.box_programming p ON p.id = s.programming_id
    LEFT JOIN public.box_programming_invitations i ON i.id = s.invitation_id
   WHERE s.id = p_subscription_id
   FOR UPDATE OF s;
  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'Abonnement introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_box_owner_admin(v_sub.publisher_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box éditrice requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_sub.pricing IS DISTINCT FROM 'offered' THEN
    RAISE EXCEPTION 'ACCES_NON_OFFERT : seul un accès « Offert » par invitation se retire ainsi'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_sub.status <> 'active'
     OR v_sub.revoked_by_publisher_at IS NOT NULL
     OR (v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end <= now()) THEN
    RAISE EXCEPTION 'ACCES_DEJA_RETIRE : cet accès n''est plus actif ou son retrait est déjà prévu'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('athlex.retrait_acces_offert', p_subscription_id::text, true);
  UPDATE public.box_programming_subscriptions
     SET current_period_end = v_fin,
         revoked_by_publisher_at = now(),
         auto_apply_weekly = false
   WHERE id = p_subscription_id;
  PERFORM set_config('athlex.retrait_acces_offert', '', true);

  RETURN jsonb_build_object('subscription_id', p_subscription_id, 'access_ends_at', v_fin);
END;
$function$;

CREATE FUNCTION public.list_my_programming_invitations(p_box_id uuid)
 RETURNS TABLE(invitation_id uuid, programming_id uuid, title text, description text, discipline text, level text,
               days_per_week integer, weeks_count integer, billing text, price_cents integer, currency text,
               publisher_box_id uuid, publisher_box_name text, goal text, target_audience text, equipment text,
               wods_total integer, wods_per_week integer[], preview_week1 jsonb,
               pricing text, message text, created_at timestamptz, expires_at timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_box_owner_admin(p_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT i.id, p.id, p.title, p.description, p.discipline, p.level,
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
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day_of_week, 'titles', d.titles)
                                      ORDER BY d.day_of_week), '[]'::jsonb)
              FROM (
                SELECT w.day_of_week, jsonb_agg(w.title ORDER BY w.sort_order) AS titles
                  FROM public.box_programming_wods w
                 WHERE w.programming_id = p.id AND w.week_number = 1
                 GROUP BY w.day_of_week
              ) d),
           i.pricing, i.message, i.created_at, i.expires_at
      FROM public.box_programming_invitations i
      JOIN public.box_programming p ON p.id = i.programming_id
      LEFT JOIN public.boxes pb ON pb.id = p.publisher_box_id
     WHERE i.invited_box_id = p_box_id
       AND i.status = 'pending'
       AND i.expires_at > now()
     ORDER BY i.created_at DESC;
END;
$function$;

CREATE FUNCTION public.list_programming_invitations_sent(p_programming_id uuid)
 RETURNS TABLE(invitation_id uuid, invited_box_id uuid, invited_box_name text, pricing text, status text,
               message text, created_at timestamptz, expires_at timestamptz, responded_at timestamptz,
               subscription_id uuid, revoked_by_publisher_at timestamptz, access_ends_at timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_publisher uuid;
BEGIN
  SELECT publisher_box_id INTO v_publisher FROM public.box_programming WHERE id = p_programming_id;
  IF v_publisher IS NULL THEN
    RAISE EXCEPTION 'Programmation introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_box_owner_admin(v_publisher) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box éditrice requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT i.id, i.invited_box_id, b.name, i.pricing,
           -- Échue mais pas encore passée par la tâche du jour : déjà expirée.
           CASE WHEN i.status = 'pending' AND i.expires_at <= now() THEN 'expired' ELSE i.status END,
           i.message, i.created_at, i.expires_at, i.responded_at,
           i.subscription_id, s.revoked_by_publisher_at, s.current_period_end
      FROM public.box_programming_invitations i
      LEFT JOIN public.boxes b ON b.id = i.invited_box_id
      LEFT JOIN public.box_programming_subscriptions s ON s.id = i.subscription_id
     WHERE i.programming_id = p_programming_id
     ORDER BY i.created_at DESC, i.id;
END;
$function$;

-- Lecture d'une offre « invitation » par une box qui n'en est pas l'éditrice :
-- un booléen sur l'appelant (auth.uid()), pour la policy de box_programming.
CREATE FUNCTION public.programming_visible_by_invitation(p_programming_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
           SELECT 1 FROM public.box_programming_subscriptions s
            WHERE s.programming_id = p_programming_id
              AND public.manages_box(s.subscriber_box_id))
      OR EXISTS (
           SELECT 1 FROM public.box_programming_invitations i
            WHERE i.programming_id = p_programming_id
              AND i.status IN ('pending', 'accepted')
              AND public.is_box_owner_admin(i.invited_box_id));
$function$;

DO $droits$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.search_boxes_for_invitation(uuid, text)',
    'public.send_programming_invitation(uuid, uuid, text, text)',
    'public.cancel_programming_invitation(uuid)',
    'public.decline_programming_invitation(uuid)',
    'public.accept_programming_invitation(uuid)',
    'public.revoke_offered_programming_access(uuid)',
    'public.list_my_programming_invitations(uuid)',
    'public.list_programming_invitations_sent(uuid)',
    'public.programming_visible_by_invitation(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $droits$;

-- ── 5. La garde d'activation (redéfinie depuis la prod) ──────────────────────
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
  -- #461 : invitation box → box.
  v_visibility     text;
  v_publisher      uuid;
  v_reactivation   boolean;
  v_pose_fin       boolean;
  v_pose_invit     boolean;
  v_ctx_invit      text := NULLIF(current_setting('athlex.invitation_programmation', true), '');
  v_ctx_retrait    text := NULLIF(current_setting('athlex.retrait_acces_offert', true), '');
  v_par_invit      boolean := false;
  v_par_retrait    boolean := false;
BEGIN
  SELECT COALESCE(p.price_cents, 0) > 0 OR COALESCE(p.billing, 'free') <> 'free',
         p.visibility, p.publisher_box_id
    INTO v_paid, v_visibility, v_publisher
  FROM public.box_programming p
  WHERE p.id = NEW.programming_id;

  IF v_paid IS NULL THEN
    RAISE EXCEPTION 'Programmation introuvable' USING ERRCODE = 'no_data_found';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_devient_active := NEW.status = 'active';
    v_reactivation := NEW.status = 'active';
    v_pose_stripe := NEW.stripe_subscription_id IS NOT NULL
                  OR NEW.stripe_customer_id IS NOT NULL;
    v_pose_fin := NEW.current_period_end IS NOT NULL;
    v_pose_invit := NEW.invitation_id IS NOT NULL
                 OR NEW.revoked_by_publisher_at IS NOT NULL;
  ELSE
    v_devient_active := NEW.status = 'active' AND OLD.status <> 'active';
    -- Un renouvellement (past_due → active) n'est pas une nouvelle entrée.
    v_reactivation := NEW.status = 'active' AND OLD.status IN ('canceled', 'expired');
    v_pose_stripe := NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
                  OR NEW.stripe_customer_id     IS DISTINCT FROM OLD.stripe_customer_id;
    v_pose_fin := NEW.current_period_end IS DISTINCT FROM OLD.current_period_end;
    v_pose_invit := NEW.invitation_id IS DISTINCT FROM OLD.invitation_id
                 OR NEW.revoked_by_publisher_at IS DISTINCT FROM OLD.revoked_by_publisher_at;
  END IF;

  -- accept_programming_invitation : son invitation « Offerte », en attente et
  -- valide, pour cette offre et cette box, par un gérant de la box invitée.
  IF v_ctx_invit IS NOT NULL THEN
    v_par_invit := COALESCE(
      NEW.invitation_id::text = v_ctx_invit
      AND NEW.current_period_end IS NULL
      AND NEW.revoked_by_publisher_at IS NULL
      AND public.is_box_owner_admin(NEW.subscriber_box_id)
      AND EXISTS (SELECT 1 FROM public.box_programming_invitations i
                   WHERE i.id = NEW.invitation_id
                     AND i.programming_id = NEW.programming_id
                     AND i.invited_box_id = NEW.subscriber_box_id
                     AND i.pricing = 'offered'
                     AND i.status = 'pending'
                     AND i.expires_at > now()), false);
  END IF;

  -- revoke_offered_programming_access : un gérant de la box éditrice pose le
  -- retrait de cet abonnement-là, sans toucher à son invitation.
  IF v_ctx_retrait IS NOT NULL AND TG_OP = 'UPDATE' THEN
    v_par_retrait := COALESCE(
      NEW.id::text = v_ctx_retrait
      AND OLD.revoked_by_publisher_at IS NULL
      AND NEW.revoked_by_publisher_at IS NOT NULL
      AND NEW.invitation_id IS NOT DISTINCT FROM OLD.invitation_id
      AND public.is_box_owner_admin(v_publisher), false);
  END IF;

  IF v_devient_active AND v_paid AND NOT v_backend AND NOT v_par_invit THEN
    RAISE EXCEPTION
      'PAID_PROGRAMMING : une offre payante s''active par le paiement (webhook Stripe), pas par le client'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Les références Stripe sont posées par le backend, jamais revendiquées par
  -- un client : sans cela, un client modifié se déclarerait payé.
  IF (v_pose_stripe AND NOT v_backend)
     OR (v_pose_fin AND NOT (v_backend OR v_par_invit OR v_par_retrait)) THEN
    RAISE EXCEPTION
      'PAID_PROGRAMMING : les références de paiement sont posées par le backend'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- L'invitation d'origine et le retrait par l'éditrice : posés par le serveur.
  IF v_pose_invit AND NOT (v_backend OR v_par_invit OR v_par_retrait) THEN
    RAISE EXCEPTION
      'INVITATION_RESERVEE : l''invitation d''un abonnement et son retrait sont posés par le serveur, pas par le client'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Une offre sur invitation seulement n'entre que chez une box invitée, même
  -- par le backend.
  IF v_reactivation AND v_visibility = 'invitation'
     AND NOT EXISTS (SELECT 1 FROM public.box_programming_invitations i
                      WHERE i.programming_id = NEW.programming_id
                        AND i.invited_box_id = NEW.subscriber_box_id
                        AND i.status IN ('pending', 'accepted')) THEN
    RAISE EXCEPTION
      'INVITATION_REQUISE : cette offre est sur invitation seulement, votre box n''y est pas invitée'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Accès retiré par l'éditrice : plus aucune pose automatique.
  IF TG_OP = 'UPDATE' AND NEW.revoked_by_publisher_at IS NOT NULL
     AND NEW.auto_apply_weekly AND NOT OLD.auto_apply_weekly AND NOT v_backend THEN
    RAISE EXCEPTION
      'ACCES_RETIRE : l''éditrice a retiré cet accès, l''application automatique ne se rallume pas'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 6. Catalogue (redéfini depuis la prod) ───────────────────────────────────
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
       -- #461 : une offre sur invitation seulement n'est pas au catalogue,
       -- sauf pour la box qui y est déjà abonnée.
       AND (p.visibility = 'catalogue'
            OR EXISTS (
              SELECT 1 FROM public.box_programming_subscriptions s
               WHERE s.programming_id = p.id
                 AND s.subscriber_box_id = p_box_id
                 AND s.status = 'active'
            ))
     ORDER BY p.created_at DESC;
END;
$function$;

-- ── 7. Lecture d'une offre (policy redéfinie depuis la prod) ─────────────────
DROP POLICY box_programming_select ON public.box_programming;
CREATE POLICY box_programming_select ON public.box_programming
  FOR SELECT TO authenticated
  USING (
    (is_published
     AND (EXISTS (SELECT 1 FROM public.boxes b WHERE public.manages_box(b.id)))
     AND (visibility = 'catalogue' OR public.programming_visible_by_invitation(id)))
    OR public.manages_box(publisher_box_id)
  );

-- ── 8. Expiration quotidienne ────────────────────────────────────────────────
CREATE FUNCTION internal.expire_programming_invitations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.box_programming_invitations
     SET status = 'expired'
   WHERE status = 'pending' AND expires_at <= now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION internal.expire_programming_invitations() FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION internal.expire_programming_invitations() IS
  'Passe en expired les invitations box → box en attente dont expires_at est passée (#461). Rend le nombre d''invitations touchées.';

DO $migration$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron indisponible : les invitations de programmation n''expireront pas d''elles-mêmes.';
    RETURN;
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'programming-invitations-expire';
  PERFORM cron.schedule('programming-invitations-expire', '23 3 * * *', $cron$
  SELECT internal.expire_programming_invitations();
$cron$);
END $migration$;

-- ── 9. Dépublier une offre annule ses invitations en attente ─────────────────
CREATE FUNCTION internal.annuler_invitations_offre_depubliee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.box_programming_invitations
     SET status = 'cancelled'
   WHERE programming_id = NEW.id AND status = 'pending';
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION internal.annuler_invitations_offre_depubliee() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_box_programming_depubliee_invitations
  AFTER UPDATE OF is_published ON public.box_programming
  FOR EACH ROW
  WHEN (OLD.is_published AND NOT NEW.is_published)
  EXECUTE FUNCTION internal.annuler_invitations_offre_depubliee();
