-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR 5b-base : pas de double paiement comptoir +
-- Stripe pour un invité Stripe (base)
--
-- Appliquée en prod : non.
--
-- Étude du 15/10/2026 (comptoir-p1/pr5b-base/etape1-compte-rendu.md) : un
-- invité Stripe qui a créé son compte est en subscription_status =
-- 'pending_payment' (seule écriture : _consume_box_invitation, mode stripe).
-- Trois trous : le gérant peut l'encaisser au comptoir, le lien de
-- l'invitation reste payable après cet encaissement (et après un abonnement
-- Stripe déjà pris : un cas en prod), et l'invitation acceptée ne peut plus
-- être révoquée. Le webhook Connect (Manager) active sans relire l'état ; sa
-- garde viendra dans une PR Manager, qui appellera la fonction 4.
--
-- Définitions de départ : celles de la prod, relevées le 15/10/2026, identiques
-- aux migrations (md5 de pg_get_functiondef, search_path "$user", public,
-- extensions), rétablies par supabase/retours/ :
--   public.record_member_cash_payment(uuid,integer)    7789384fc790ab1d7b42c70df8e96424
--   public.resolve_box_invitation_for_checkout(text)   3210ca73921e482cae65e031ff7ee4ae
--   public.revoke_box_invitation(uuid)                 333011a7e465c54e1e94482ab6934002
-- Droits et commentaires inchangés (CREATE OR REPLACE les garde).
--
-- L'adhésion d'une invitation est la ligne box_members (box_id de
-- l'invitation, member_id = accepted_by) : unique sur (box_id, member_id).
--
-- 1. record_member_cash_payment refuse une adhésion en 'pending_payment' :
--    STRIPE_PAYMENT_PENDING (check_violation). Le reste est inchangé.
-- 2. resolve_box_invitation_for_checkout : une invitation acceptée n'est
--    payable que si son adhésion est encore en 'pending_payment' ; sinon
--    { ok: false, reason: 'INVITATION_NOT_PAYABLE' }. Les refus existants
--    (INVALID_TOKEN, REVOKED, EXPIRED, NOT_STRIPE, NO_PLAN) gardent leur code ;
--    une invitation non acceptée reste payable comme avant. L'expiration ne
--    vise toujours que l'invitation non acceptée (raison inchangée : un membre
--    créé la veille de l'expiration doit pouvoir payer).
-- 3. revoke_box_invitation accepte une invitation Stripe acceptée dont
--    l'adhésion est encore en 'pending_payment' (verrou sur l'adhésion) ;
--    l'adhésion n'est pas touchée et reste en 'pending_payment'. Toute autre
--    invitation acceptée : ALREADY_ACCEPTED, comme avant. Mêmes droits.
-- 4. public.box_invitation_activation_permise(p_invitation_id, p_user_id) :
--    pour le webhook, avant d'activer une adhésion payée par Checkout.
--    Exécutable par service_role seulement. Verrouille l'invitation puis
--    l'adhésion (FOR UPDATE, même ordre que revoke_box_invitation) : une
--    révocation concurrente attend la fin de la transaction de l'appel, ou
--    l'appel attend la révocation. Le verrou ne dure que la transaction de
--    l'appel (un appel RPC = une transaction) : l'écriture du webhook qui suit
--    n'est pas couverte.
--    Rend { permise: bool, raison: text } :
--      permise = true
--        PENDING_PAYMENT    adhésion de p_user_id dans la box de l'invitation
--                           en 'pending_payment', invitation non révoquée ;
--        NO_MEMBERSHIP_YET  invitation non acceptée, pas encore d'adhésion
--                           (paiement avant la consommation du lien : rien
--                           n'a pu être encaissé ailleurs) ;
--      permise = false
--        MISSING_ARGUMENT   un argument est NULL ;
--        NOT_FOUND          invitation introuvable ;
--        REVOKED            invitation révoquée ;
--        ACCEPTED_BY_OTHER  invitation acceptée par un autre compte ;
--        NOT_PENDING        adhésion dans un autre état ('subscription_status'
--                           rendu à côté), ou invitation acceptée sans
--                           adhésion.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. record_member_cash_payment ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_member_cash_payment(p_box_member_id uuid, p_months integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  m        public.box_members;
  v_logged uuid;
  v_from   date;
  v_until  date;
BEGIN
  -- Verrou de la ligne : deux encaissements simultanés ne calculent pas le
  -- même début de période.
  SELECT * INTO m FROM public.box_members WHERE id = p_box_member_id FOR UPDATE;

  IF m.id IS NULL OR NOT public.is_box_owner_admin(m.box_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: adhésion introuvable ou hors de votre box'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Un abonné Stripe est déjà prélevé : enregistrer un encaissement comptoir
  -- pour lui compterait son mois deux fois.
  IF m.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'STRIPE_MEMBER: cette adhésion est prélevée par Stripe'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Invité Stripe qui n'a pas encore payé : son lien de paiement est vivant,
  -- l'encaisser au comptoir ouvrirait un double paiement (20270158).
  IF m.subscription_status = 'pending_payment' THEN
    RAISE EXCEPTION 'STRIPE_PAYMENT_PENDING: ce membre a été invité à payer en ligne, révoque son invitation avant de l''encaisser au comptoir'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Renouvellement au comptoir : refusé quand la box vend en ligne et ne l'a
  -- pas autorisé. Le premier encaissement d'un membre reste toujours possible.
  -- Un encaissement de programme n'est pas une période d'adhésion.
  IF (m.cash_access_until IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.box_cash_payments c
                  WHERE c.box_id = m.box_id AND c.member_id = m.member_id
                    AND c.source IN ('renewal', 'invitation')))
     AND NOT (SELECT b.allow_counter_renewal FROM public.boxes b WHERE b.id = m.box_id)
     AND internal.box_vend_en_ligne(m.box_id) THEN
    RAISE EXCEPTION 'COUNTER_RENEWAL_DISABLED: cette box ne renouvelle pas au comptoir, le membre passe au paiement en ligne'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT p.access_from, p.access_until INTO v_from, v_until
    FROM internal.periode_comptoir(m.cash_access_until, p_months) p;

  v_logged := public._log_box_cash_payment(
    m.box_id, m.member_id, NULL, m.plan_id, 'renewal', p_months, v_from, v_until
  );

  IF v_logged IS NULL THEN
    RAISE EXCEPTION 'NO_PLAN_PRICE: cette adhésion n''a pas de formule tarifée'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.box_members SET
    status              = CASE WHEN status = 'banned' THEN status ELSE 'active' END,
    subscription_status = CASE WHEN status = 'banned' THEN subscription_status ELSE 'active' END,
    payment_method_type = 'cash',
    cash_access_until   = v_until
  WHERE id = m.id;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_logged,
    'amount_cents', (SELECT c.amount_cents FROM public.box_cash_payments c WHERE c.id = v_logged),
    'access_from', v_from,
    'access_until', v_until
  );
END;
$function$;

-- ── 2. resolve_box_invitation_for_checkout ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_box_invitation_for_checkout(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r public.box_invitations;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_TOKEN');
  END IF;

  SELECT * INTO r
  FROM public.box_invitations
  WHERE token_hash = encode(sha256(btrim(p_token)::bytea), 'hex');

  IF r.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_TOKEN');
  END IF;

  IF r.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'REVOKED');
  END IF;

  -- L'expiration protège le lien, pas le paiement : une invitation déjà
  -- acceptée reste payable même après la date, sinon un membre créé la veille
  -- de l'expiration se retrouverait avec un compte et aucun moyen de payer.
  IF r.status = 'pending' AND r.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'EXPIRED');
  END IF;

  IF r.payment_mode <> 'stripe' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_STRIPE');
  END IF;

  IF r.plan_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_PLAN');
  END IF;

  -- Une invitation acceptée n'est payable que tant que son adhésion attend ce
  -- paiement : encaissée au comptoir ou déjà abonnée, elle paierait deux fois
  -- (20270158).
  IF r.status = 'accepted' AND NOT EXISTS (
       SELECT 1 FROM public.box_members bm
        WHERE bm.box_id = r.box_id AND bm.member_id = r.accepted_by
          AND bm.subscription_status = 'pending_payment') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVITATION_NOT_PAYABLE');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', r.id,
    'box_id', r.box_id,
    'plan_id', r.plan_id,
    'email', r.email,
    'status', r.status,
    'next_due_date', r.next_due_date
  );
END;
$function$;

-- ── 3. revoke_box_invitation ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.revoke_box_invitation(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r public.box_invitations;
  v_sub_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: connexion requise' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO r FROM public.box_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: invitation introuvable' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_box_owner_admin(r.box_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: vous n''administrez pas cette box'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Révoquer une invitation déjà acceptée ne retirerait rien au membre : ce
  -- serait un faux geste de sécurité. L'exclusion passe par box_members.
  -- Exception (20270158) : invitation Stripe dont l'adhésion attend encore le
  -- paiement en ligne ; la révoquer ferme le lien, l'adhésion reste en attente.
  IF r.status = 'accepted' THEN
    IF r.payment_mode = 'stripe' THEN
      SELECT bm.subscription_status INTO v_sub_status FROM public.box_members bm
       WHERE bm.box_id = r.box_id AND bm.member_id = r.accepted_by FOR UPDATE;
    END IF;
    IF v_sub_status IS DISTINCT FROM 'pending_payment' THEN
      RAISE EXCEPTION 'ALREADY_ACCEPTED: cette invitation a déjà été utilisée'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.box_invitations SET status = 'revoked' WHERE id = r.id;

  RETURN jsonb_build_object('ok', true, 'id', r.id);
END;
$function$;

-- ── 4. box_invitation_activation_permise ─────────────────────────────────────

CREATE FUNCTION public.box_invitation_activation_permise(p_invitation_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r public.box_invitations;
  m public.box_members;
BEGIN
  IF p_invitation_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('permise', false, 'raison', 'MISSING_ARGUMENT');
  END IF;

  -- Même ordre de verrous que revoke_box_invitation : invitation, puis adhésion.
  SELECT * INTO r FROM public.box_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF r.id IS NULL THEN
    RETURN jsonb_build_object('permise', false, 'raison', 'NOT_FOUND');
  END IF;
  IF r.status = 'revoked' THEN
    RETURN jsonb_build_object('permise', false, 'raison', 'REVOKED');
  END IF;
  IF r.status = 'accepted' AND r.accepted_by IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('permise', false, 'raison', 'ACCEPTED_BY_OTHER');
  END IF;

  SELECT * INTO m FROM public.box_members
   WHERE box_id = r.box_id AND member_id = p_user_id FOR UPDATE;

  IF m.id IS NULL AND r.status = 'pending' THEN
    RETURN jsonb_build_object('permise', true, 'raison', 'NO_MEMBERSHIP_YET');
  END IF;
  IF m.subscription_status = 'pending_payment' THEN
    RETURN jsonb_build_object('permise', true, 'raison', 'PENDING_PAYMENT');
  END IF;

  RETURN jsonb_build_object('permise', false, 'raison', 'NOT_PENDING',
                            'subscription_status', m.subscription_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.box_invitation_activation_permise(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.box_invitation_activation_permise(uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.box_invitation_activation_permise(uuid, uuid) IS
  'Webhook Connect : l''activation par Checkout est-elle encore permise (invitation non révoquée, adhésion en pending_payment) ? Verrouille l''invitation et l''adhésion. service_role seulement.';
