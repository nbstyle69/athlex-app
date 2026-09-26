-- ═════════════════════════════════════════════════════════════════════════════
-- Colonnes de facturation de box_members réservées au serveur (migration 20270132)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B : gérant G (…e0, owner_id), co-gérant C (…e1), coach K (…e2). Membres :
-- MT (…10, cible des colonnes), MS (…11, abonnement Stripe en cours), MC (…12,
-- au comptoir), MN (…13, sans abonnement), MB (…14, banni avec un abonnement
-- Stripe en cours), MR (…15, banni, facturation périmée, sans abonnement).
--   F1  règles réelles : G et C refusés (42501, MEMBRE_FACTURATION_RESERVEE)
--       sur chacune des 18 colonnes ; K ne change rien ; rien n'a bougé ;
--   F2  règle d'écriture ouverte à tous (dans la transaction) : G, C et K
--       refusés sur chacune des 18 colonnes ; rien n'a bougé ;
--   F3  réécriture à l'identique acceptée ; `role` et `status` restent libres ;
--   F4  la clé serveur écrit la facturation ; `reactivate_box_member` (SECURITY
--       DEFINER) remet MR à zéro ;
--   F5  insertion par G : avec une formule, refusée ; sans facturation, acceptée ;
--   F6  bannissement : MS (Stripe en cours) refusé à G et à C
--       (MEMBRE_ABONNEMENT_EN_COURS) ; MC (comptoir) et MN acceptés ; la clé
--       serveur bannit MS ;
--   F7  `reactivate_box_member` refuse MB (REACTIVATION_ABONNEMENT_EN_COURS) et
--       ne touche pas son abonnement ; elle réactive MC (comptoir, banni en F6).
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Facturation de box_members réservée au serveur'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9c1-0000000000' || s)::uuid FROM unnest(ARRAY['e0', 'e1', 'e2', '10', '11', '12', '13', '14', '15', '20', '21']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9c1-0000000000' || s)::uuid, 'bgf-' || s || '@test.invalid', 'bgf_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', '10', '11', '12', '13', '14', '15', '20', '21']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9c1-000000000001', 'Box facturation', 'BGF1', '00000000-0000-4000-a9c1-0000000000e0');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type) VALUES
  ('00000000-0000-4000-c9c1-000000000001', '00000000-0000-4000-b9c1-000000000001', 'Mensuel', 5000, 'subscription'),
  ('00000000-0000-4000-c9c1-000000000002', '00000000-0000-4000-b9c1-000000000001', 'Annuel', 50000, 'subscription');
INSERT INTO public.box_members (id, box_id, member_id, role, status, plan_id, subscription_status, stripe_subscription_id, payment_method_type) VALUES
  ('00000000-0000-4000-f9c1-0000000000e1', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-0000000000e1', 'owner',  'active', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-f9c1-0000000000e2', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-0000000000e2', 'coach',  'active', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-f9c1-000000000010', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-000000000010', 'member', 'active', '00000000-0000-4000-c9c1-000000000001', 'active', NULL, 'cash'),
  ('00000000-0000-4000-f9c1-000000000011', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-000000000011', 'member', 'active', '00000000-0000-4000-c9c1-000000000001', 'active', 'sub_bgf_11', 'card'),
  ('00000000-0000-4000-f9c1-000000000012', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-000000000012', 'member', 'active', '00000000-0000-4000-c9c1-000000000001', 'active', NULL, 'cash'),
  ('00000000-0000-4000-f9c1-000000000013', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-000000000013', 'member', 'active', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-f9c1-000000000014', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-000000000014', 'member', 'banned', '00000000-0000-4000-c9c1-000000000001', 'active', 'sub_bgf_14', 'card'),
  ('00000000-0000-4000-f9c1-000000000015', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-000000000015', 'member', 'banned', '00000000-0000-4000-c9c1-000000000001', 'cancelled', NULL, 'card');

-- Exécute `p_sql` sous l'identité `p_qui` (…e0, …e1, …e2 ou « service ») ;
-- rend le résultat, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  IF p_qui = 'service' THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('role', 'service_role', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9c1-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
  BEGIN
    EXECUTE p_sql INTO v;
    v := coalesce(v, 'OK');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN v;
END $$;

CREATE FUNCTION pg_temp.facturation(p_id text) RETURNS text LANGUAGE sql AS $$
  SELECT row(plan_id, subscription_status, stripe_subscription_id, stripe_checkout_session_id, subscription_current_period_end, subscription_cancel_at_period_end, amount_cents, platform_fee_cents, commitment_end_date, subscription_paused, pause_started_at, pause_resumes_at, payment_method_type, past_due_since, dunning_attempts, last_payment_error, dunning_reminders_sent, dunning_last_reminder_at)::text FROM public.box_members WHERE id = ('00000000-0000-4000-f9c1-0000000000' || p_id)::uuid;
$$;

DO $t$
DECLARE
  ACTIONS constant text[] := ARRAY[
    'plan_id', '''00000000-0000-4000-c9c1-000000000002''',
    'subscription_status', '''past_due''',
    'stripe_subscription_id', '''sub_pirate''',
    'stripe_checkout_session_id', '''cs_pirate''',
    'subscription_current_period_end', 'now() + interval ''1 year''',
    'subscription_cancel_at_period_end', 'true',
    'amount_cents', '1',
    'platform_fee_cents', '1',
    'commitment_end_date', 'now()',
    'subscription_paused', 'true',
    'pause_started_at', 'now()',
    'pause_resumes_at', 'now()',
    'payment_method_type', '''card''',
    'past_due_since', 'now()',
    'dunning_attempts', '5',
    'last_payment_error', '''x''',
    'dunning_reminders_sent', '5',
    'dunning_last_reminder_at', 'now()'];
  v text;
  v_qui text;
  v_i int;
  v_avant text := pg_temp.facturation('10');
  v_passage int;
  MAJ constant text := 'WITH m AS (UPDATE public.box_members SET %s = %s WHERE id = ''00000000-0000-4000-f9c1-000000000010'' RETURNING 1) SELECT count(*)::text FROM m';
BEGIN
  FOR v_passage IN 1..2 LOOP
    IF v_passage = 2 THEN
      -- Règle d'écriture ouverte à tous : la garde doit tenir seule.
      CREATE POLICY zz_ecriture_ouverte ON public.box_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    FOREACH v_qui IN ARRAY ARRAY['e0', 'e1', 'e2'] LOOP
      FOR v_i IN 1..array_length(ACTIONS, 1) / 2 LOOP
        v := pg_temp.faire(v_qui, format(MAJ, ACTIONS[2 * v_i - 1], ACTIONS[2 * v_i]));
        -- F1 : le coach n'a pas le droit d'écrire la table (0 ligne) ;
        -- gérant et co-gérant l'ont, la garde les refuse. F2 : tous refusés.
        IF (v_passage = 2 OR v_qui <> 'e2') AND v NOT LIKE '42501: MEMBRE_FACTURATION_RESERVEE:%' THEN
          RAISE EXCEPTION 'F% : % n''est pas refusé sur % (obtenu : %)', v_passage, v_qui, ACTIONS[2 * v_i - 1], v;
        END IF;
        IF v_passage = 1 AND v_qui = 'e2' AND v <> '0' AND v NOT LIKE '42501:%' THEN
          RAISE EXCEPTION 'F1 : le coach a écrit % (obtenu : %)', ACTIONS[2 * v_i - 1], v;
        END IF;
      END LOOP;
    END LOOP;
    IF pg_temp.facturation('10') IS DISTINCT FROM v_avant THEN
      RAISE EXCEPTION 'F% : la facturation a bougé : % au lieu de %', v_passage, pg_temp.facturation('10'), v_avant;
    END IF;
  END LOOP;
  DROP POLICY zz_ecriture_ouverte ON public.box_members;

  -- F3 : réécriture à l'identique (les valeurs actuelles, comme un formulaire
  -- enregistré sans changement) ; role et status libres.
  v := pg_temp.faire('e0', 'WITH m AS (UPDATE public.box_members SET plan_id = ''00000000-0000-4000-c9c1-000000000001'', subscription_status = ''active'', stripe_subscription_id = NULL, stripe_checkout_session_id = NULL, subscription_current_period_end = NULL, subscription_cancel_at_period_end = false, amount_cents = NULL, platform_fee_cents = NULL, commitment_end_date = NULL, subscription_paused = false, pause_started_at = NULL, pause_resumes_at = NULL, payment_method_type = ''cash'', past_due_since = NULL, dunning_attempts = 0, last_payment_error = NULL, dunning_reminders_sent = 0, dunning_last_reminder_at = NULL, role = ''coach'' WHERE id = ''00000000-0000-4000-f9c1-000000000010'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'F3 : réécriture à l''identique refusée (%)', v; END IF;
  v := pg_temp.faire('e1', 'WITH m AS (UPDATE public.box_members SET status = ''inactive'' WHERE id = ''00000000-0000-4000-f9c1-000000000013'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'F3 : changement de statut refusé (%)', v; END IF;
  UPDATE public.box_members SET status = 'active' WHERE id = '00000000-0000-4000-f9c1-000000000013';

  -- F4 : clé serveur et fonction SECURITY DEFINER.
  v := pg_temp.faire('service', format('WITH m AS (UPDATE public.box_members SET %s WHERE id = ''00000000-0000-4000-f9c1-000000000010'' RETURNING 1) SELECT count(*)::text FROM m',
    (SELECT string_agg(format('%s = %s', ACTIONS[2 * i - 1], ACTIONS[2 * i]), ', ') FROM generate_series(1, array_length(ACTIONS, 1) / 2) i)));
  IF v <> '1' THEN RAISE EXCEPTION 'F4 : la clé serveur n''écrit pas la facturation (%)', v; END IF;
  v := pg_temp.faire('e0', 'SELECT public.reactivate_box_member(''00000000-0000-4000-b9c1-000000000001'', ''00000000-0000-4000-a9c1-000000000015'')::text');
  IF v <> 'true' OR (SELECT plan_id IS NULL AND subscription_status IS NULL AND status = 'active' FROM public.box_members WHERE id = '00000000-0000-4000-f9c1-000000000015') IS NOT TRUE THEN
    RAISE EXCEPTION 'F4 : reactivate_box_member n''a pas remis MR à zéro (%)', v;
  END IF;

  -- F5 : insertion par le gérant.
  v := pg_temp.faire('e0', 'WITH m AS (INSERT INTO public.box_members (box_id, member_id, role, status, plan_id) VALUES (''00000000-0000-4000-b9c1-000000000001'', ''00000000-0000-4000-a9c1-000000000020'', ''member'', ''active'', ''00000000-0000-4000-c9c1-000000000001'') RETURNING 1) SELECT count(*)::text FROM m');
  IF v NOT LIKE '42501: MEMBRE_FACTURATION_RESERVEE:%' THEN RAISE EXCEPTION 'F5 : insertion avec formule acceptée (%)', v; END IF;
  v := pg_temp.faire('e0', 'WITH m AS (INSERT INTO public.box_members (box_id, member_id, role, status) VALUES (''00000000-0000-4000-b9c1-000000000001'', ''00000000-0000-4000-a9c1-000000000021'', ''member'', ''active'') RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'F5 : insertion sans facturation refusée (%)', v; END IF;

  -- F6 : bannissement.
  FOREACH v_qui IN ARRAY ARRAY['e0', 'e1'] LOOP
    v := pg_temp.faire(v_qui, 'WITH m AS (UPDATE public.box_members SET status = ''banned'' WHERE id = ''00000000-0000-4000-f9c1-000000000011'' RETURNING 1) SELECT count(*)::text FROM m');
    IF v <> '42501: MEMBRE_ABONNEMENT_EN_COURS: Ce membre a un abonnement en cours : bannis-le depuis le Manager, qui arrête aussi son abonnement.' THEN
      RAISE EXCEPTION 'F6 : % a banni un membre avec un abonnement Stripe en cours (%)', v_qui, v;
    END IF;
  END LOOP;
  v := pg_temp.faire('e0', 'WITH m AS (UPDATE public.box_members SET status = ''banned'' WHERE id IN (''00000000-0000-4000-f9c1-000000000012'', ''00000000-0000-4000-f9c1-000000000013'') RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '2' THEN RAISE EXCEPTION 'F6 : bannissement au comptoir ou sans abonnement refusé (%)', v; END IF;
  v := pg_temp.faire('service', 'WITH m AS (UPDATE public.box_members SET status = ''banned'' WHERE id = ''00000000-0000-4000-f9c1-000000000011'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'F6 : la clé serveur ne bannit pas (%)', v; END IF;

  -- F7 : réactivation refusée avec un abonnement Stripe en cours.
  v := pg_temp.faire('e0', 'SELECT public.reactivate_box_member(''00000000-0000-4000-b9c1-000000000001'', ''00000000-0000-4000-a9c1-000000000014'')::text');
  IF v NOT LIKE '23514: REACTIVATION_ABONNEMENT_EN_COURS:%'
     OR (SELECT stripe_subscription_id FROM public.box_members WHERE id = '00000000-0000-4000-f9c1-000000000014') IS DISTINCT FROM 'sub_bgf_14' THEN
    RAISE EXCEPTION 'F7 : réactivation avec abonnement en cours (%)', v;
  END IF;
  -- Un membre au comptoir banni (MC, banni en F6) reste réactivable.
  v := pg_temp.faire('e0', 'SELECT public.reactivate_box_member(''00000000-0000-4000-b9c1-000000000001'', ''00000000-0000-4000-a9c1-000000000012'')::text');
  IF v <> 'true' THEN RAISE EXCEPTION 'F7 : réactivation d''un membre au comptoir refusée (%)', v; END IF;
END $t$;

ROLLBACK;
\echo '    F1 à F7 OK'
