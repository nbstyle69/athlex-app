-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270158000000_comptoir_double_paiement_stripe.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test comptoir_double_paiement_stripe.sql le
-- rejoue dans sa propre transaction annulée).
--
-- Définitions de prod rétablies octet pour octet (md5 de pg_get_functiondef,
-- search_path "$user", public, extensions ; relevées le 15/10/2026, à
-- recontrôler en prod avant l'application). CREATE OR REPLACE garde droits et
-- commentaires :
--   public.record_member_cash_payment(uuid,integer)    7789384fc790ab1d7b42c70df8e96424
--   public.resolve_box_invitation_for_checkout(text)   3210ca73921e482cae65e031ff7ee4ae
--   public.revoke_box_invitation(uuid)                 333011a7e465c54e1e94482ab6934002
-- Fonction ajoutée supprimée : public.box_invitation_activation_permise.
-- Aucune donnée à reprendre : la migration n'écrit aucune ligne. Une
-- invitation révoquée par la règle 3 entre-temps reste révoquée.
-- ═════════════════════════════════════════════════════════════════════════════

DROP FUNCTION public.box_invitation_activation_permise(uuid, uuid);

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
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_box_invitation(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r public.box_invitations;
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
  IF r.status = 'accepted' THEN
    RAISE EXCEPTION 'ALREADY_ACCEPTED: cette invitation a déjà été utilisée'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.box_invitations SET status = 'revoked' WHERE id = r.id;

  RETURN jsonb_build_object('ok', true, 'id', r.id);
END;
$function$
;
