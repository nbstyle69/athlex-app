-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR 5b-base : pas de double paiement comptoir +
-- Stripe (migration 20270158)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box A (b9c3-…01) : vend en ligne, renouvellement au comptoir autorisé,
-- formule a1 à 50 € avec prix Stripe. Box B (…02) : 61 y attend un paiement. Comptes (suffixe a9c3-…XX) : e0 gérant,
-- e1 co-gérant (box_members.role = 'owner'), e2 coach.
-- Membres de A :
--   60 invité Stripe, compte créé, pas encore payé (pending_payment)
--   61 invité Stripe déjà abonné (le cas trouvé en prod le 15/10/2026)
--   62 invité Stripe encaissé au comptoir (actif, fin d'accès dans 20 jours)
--   63 invité au comptoir, pas encore encaissé (pending_cash)
--   64 actif au comptoir, fin d'accès dans 10 jours (renouvellement)
--   67 actif au comptoir, fin dans 5 jours, invité de nouveau en Stripe
--   66 compte sans adhésion
-- Invitations (jeton brut « pdp-tok-XX ») : 60, 61, 62 Stripe acceptées par le
-- membre du même numéro (60 expirée depuis hier) ; 63 comptoir acceptée ;
-- 66 Stripe acceptée sans adhésion ; 73 comptoir acceptée par 60 ; 65, 67
-- Stripe non acceptées ; 69 Stripe révoquée ; 70 Stripe expirée ; 72 comptoir
-- non acceptée.
-- Contrôles :
--   S  structure : une version de chaque fonction, SECURITY DEFINER et
--      search_path, verrous FOR UPDATE, définitions épinglées (md5 calculé par
--      la base, search_path de la prod) ;
--   E  record_member_cash_payment : STRIPE_PAYMENT_PENDING ; inchangés :
--      premier encaissement (pending_cash), renouvellement, STRIPE_MEMBER,
--      FORBIDDEN (coach) ;
--   V  resolve_box_invitation_for_checkout : acceptée en pending_payment
--      payable (même expirée) ; INVITATION_NOT_PAYABLE si déjà abonnée Stripe
--      (cas de prod), encaissée au comptoir, sans adhésion ; inchangés : non
--      acceptée payable, REVOKED, EXPIRED, NOT_STRIPE ;
--   R  revoke_box_invitation : Stripe acceptée en pending_payment révoquée
--      (gérant, co-gérant), adhésion laissée en pending_payment, lien et
--      activation fermés ensuite ; ALREADY_ACCEPTED sinon (abonnée, encaissée,
--      sans adhésion, mode comptoir) ; FORBIDDEN (coach) ; non acceptée
--      révoquée comme avant ;
--   W  box_invitation_activation_permise : chaque code de l'en-tête ;
--   D  droits : la nouvelle fonction à service_role seulement ; les trois
--      fonctions modifiées gardent leurs droits et commentaires ;
--   M  mutations : chaque contrôle échoue quand on retire ce qu'il prouve ;
--   X  retour arrière (supabase/retours/…) : définitions de prod aux md5 du
--      précontrôle, droits et commentaires, fonction ajoutée supprimée.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Paiements au comptoir : pas de double paiement comptoir + Stripe'

BEGIN;
SET LOCAL search_path = "$user", public, extensions;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9c3-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0','e1','e2','60','61','62','63','64','65','66','67']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9c3-0000000000' || s)::uuid, 'pdp-' || s || '@test.invalid', 'pdp_' || s
  FROM unnest(ARRAY['e0','e1','e2','60','61','62','63','64','65','66','67']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id, stripe_account_id, stripe_onboarding_complete) VALUES
  ('00000000-0000-4000-b9c3-000000000001', 'Box double paiement', 'PDPA', '00000000-0000-4000-a9c3-0000000000e0', 'acct_pdp_a', true),
  ('00000000-0000-4000-b9c3-000000000002', 'Box double paiement B', 'PDPB', '00000000-0000-4000-a9c3-0000000000e0', NULL, false);
UPDATE public.boxes SET allow_counter_renewal = true WHERE id = '00000000-0000-4000-b9c3-000000000001';
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active, stripe_price_id) VALUES
  ('00000000-0000-4000-c9c3-0000000000a1', '00000000-0000-4000-b9c3-000000000001', 'Mensuel A', 5000, 'subscription', true, 'price_pdp_a1');
-- (suffixe, rôle, statut, formule, statut d'abonnement, moyen, abonnement Stripe, fin d'accès en jours)
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, payment_method_type,
                                stripe_subscription_id, cash_access_until)
SELECT '00000000-0000-4000-b9c3-000000000001', ('00000000-0000-4000-a9c3-0000000000' || m)::uuid, r, st,
       CASE WHEN r = 'member' THEN '00000000-0000-4000-c9c3-0000000000a1'::uuid END, ss, pm, sub,
       CASE WHEN fin IS NULL THEN NULL ELSE (now() AT TIME ZONE 'Europe/Paris')::date + fin END
  FROM (VALUES
    ('e1', 'owner',  'active',   NULL,              NULL,   NULL,         NULL::int),
    ('e2', 'coach',  'active',   NULL,              NULL,   NULL,         NULL),
    ('60', 'member', 'inactive', 'pending_payment', NULL,   NULL,         NULL),
    ('61', 'member', 'active',   'active',          'card', 'sub_pdp_61', NULL),
    ('62', 'member', 'active',   'active',          'cash', NULL,         20),
    ('63', 'member', 'inactive', 'pending_cash',    'cash', NULL,         NULL),
    ('64', 'member', 'active',   'active',          'cash', NULL,         10),
    ('67', 'member', 'active',   'active',          'cash', NULL,         5)
  ) v(m, r, st, ss, pm, sub, fin);
-- 61 attend aussi un paiement en ligne dans une autre box (B) : le lien de A ne
-- doit pas s'en servir.
INSERT INTO public.box_members (box_id, member_id, role, status, subscription_status)
VALUES ('00000000-0000-4000-b9c3-000000000002', '00000000-0000-4000-a9c3-000000000061', 'member', 'inactive', 'pending_payment');
-- (suffixe, mode, statut, accepté par, expiration en jours)
INSERT INTO public.box_invitations (id, box_id, email, plan_id, payment_mode, cash_collected, token_hash, status,
                                    expires_at, accepted_by, accepted_at)
SELECT ('00000000-0000-4000-d9c3-0000000000' || i)::uuid, '00000000-0000-4000-b9c3-000000000001', 'pdp-' || i || '@test.invalid',
       '00000000-0000-4000-c9c3-0000000000a1', mode, false, encode(sha256(('pdp-tok-' || i)::bytea), 'hex'), st,
       now() + make_interval(days => exp),
       CASE WHEN acc IS NULL THEN NULL ELSE ('00000000-0000-4000-a9c3-0000000000' || acc)::uuid END,
       CASE WHEN acc IS NULL THEN NULL ELSE now() END
  FROM (VALUES
    ('60', 'stripe', 'accepted', '60',  -1),
    ('61', 'stripe', 'accepted', '61',  7),
    ('62', 'stripe', 'accepted', '62',  7),
    ('63', 'box',    'accepted', '63',  7),
    ('66', 'stripe', 'accepted', '66',  7),
    ('73', 'box',    'accepted', '60',  7),
    ('65', 'stripe', 'pending',  NULL,  7),
    ('67', 'stripe', 'pending',  NULL,  7),
    ('69', 'stripe', 'revoked',  NULL,  7),
    ('70', 'stripe', 'pending',  NULL,  -1),
    ('72', 'box',    'pending',  NULL,  7)
  ) v(i, mode, st, acc, exp);

CREATE FUNCTION pg_temp.u(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a9c3-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.inv(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-d9c3-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.bm(m text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM public.box_members WHERE member_id = pg_temp.u(m) AND box_id = '00000000-0000-4000-b9c3-000000000001' $$;
CREATE FUNCTION pg_temp.def(f text) RETURNS text LANGUAGE sql AS $$ SELECT pg_get_functiondef(f::regprocedure) $$;
-- Rejoue `f` avec un remplacement dans sa définition ; échoue s'il ne change rien.
CREATE FUNCTION pg_temp.muter(f text, de text, vers text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d text := pg_temp.def(f);
BEGIN
  IF strpos(d, de) = 0 THEN RAISE EXCEPTION 'mutation sans effet sur % : « % » absent', f, de; END IF;
  EXECUTE replace(d, de, vers);
END $$;

-- Joue `p_sql` sous l'identité `p_qui` (suffixe, « service » ou « anon »), puis
-- lit `p_lecture` en superutilisateur, et annule les deux. Rend
-- « résultat|lecture », ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.jouer(p_qui text, p_sql text, p_lecture text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text; w text; r text;
BEGIN
  BEGIN
    IF p_qui IN ('service', 'anon') THEN
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
      PERFORM set_config('role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
    ELSE
      PERFORM set_config('request.jwt.claim.sub', pg_temp.u(p_qui)::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM set_config('role', 'authenticated', true);
    END IF;
    EXECUTE p_sql INTO v;
    PERFORM set_config('role', 'none', true);
    IF p_lecture IS NOT NULL THEN EXECUTE p_lecture INTO w; END IF;
    RAISE EXCEPTION USING ERRCODE = 'PDP00', MESSAGE = coalesce(v, 'OK') || CASE WHEN p_lecture IS NULL THEN '' ELSE '|' || coalesce(w, '') END;
  EXCEPTION
    WHEN SQLSTATE 'PDP00' THEN r := SQLERRM;
    WHEN OTHERS THEN r := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN r;
END $$;
-- Code d'erreur métier (« STRIPE_PAYMENT_PENDING »…), « 42501 » pour un droit
-- refusé, ou le texte brut.
CREATE FUNCTION pg_temp.code(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN v ~ '^\w{5}: [A-Z_]+:' THEN split_part(split_part(v, ': ', 2), ':', 1)
              WHEN v ~ '^42501: ' THEN '42501' ELSE v END;
$$;
-- E : encaissement d'un mois de `m` par `qui` ; « OK:statut d'abonnement » ou le code.
CREATE FUNCTION pg_temp.encaisser(qui text, m text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN r ~ '^\{' THEN 'OK:' || split_part(r, '|', 2) ELSE pg_temp.code(r) END
    FROM pg_temp.jouer(qui, format('SELECT public.record_member_cash_payment(%L, 1)::text', pg_temp.bm(m)),
                       format('SELECT subscription_status FROM public.box_members WHERE id = %L', pg_temp.bm(m))) r;
$$;
-- V : lien `i` vu par le serveur du Manager ; « ok » ou la raison du refus.
CREATE FUNCTION pg_temp.resoudre(i text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(nullif(j->>'reason', ''), CASE WHEN j->>'ok' = 'true' THEN 'ok' END, r)
    FROM pg_temp.jouer('service', format('SELECT public.resolve_box_invitation_for_checkout(%L)::text', 'pdp-tok-' || i)) r,
         LATERAL (SELECT CASE WHEN r ~ '^\{' THEN r::jsonb END j) x;
$$;
-- R : révocation de `i` par `qui` ; « OK|statut de l'invitation:statut
-- d'abonnement de 60:lien de 60:activation de 60 » ou le code.
CREATE FUNCTION pg_temp.revoquer(qui text, i text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN r ~ '^\{' THEN 'OK|' || split_part(r, '|', 2) ELSE pg_temp.code(r) END
    FROM pg_temp.jouer(qui, format('SELECT public.revoke_box_invitation(%L)::text', pg_temp.inv(i)),
      format($q$SELECT (SELECT status FROM public.box_invitations WHERE id = %L) || ':'
                    || (SELECT subscription_status FROM public.box_members WHERE id = %L) || ':'
                    || coalesce(public.resolve_box_invitation_for_checkout('pdp-tok-60')->>'reason', 'ok') || ':'
                    || (public.box_invitation_activation_permise(%L, %L)->>'raison')$q$,
             pg_temp.inv(i), pg_temp.bm('60'), pg_temp.inv('60'), pg_temp.u('60'))) r;
$$;
-- W : activation du lien `i` pour le compte `m` ; « permise:raison » ou le code.
CREATE FUNCTION pg_temp.permise(i uuid, m uuid, qui text DEFAULT 'service') RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN r ~ '^\{' THEN (r::jsonb->>'permise') || ':' || (r::jsonb->>'raison') ELSE pg_temp.code(r) END
    FROM pg_temp.jouer(qui, format('SELECT public.box_invitation_activation_permise(%L, %L)::text', i, m)) r;
$$;
CREATE FUNCTION pg_temp.permise(i text, m text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.permise(pg_temp.inv(i), pg_temp.u(m));
$$;
-- Les verrous FOR UPDATE de 20270158, lus dans les définitions.
CREATE FUNCTION pg_temp.verrous() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(n, ', ') FROM (VALUES
    ('revoke : adhésion', strpos(pg_temp.def('public.revoke_box_invitation(uuid)'),
       'WHERE bm.box_id = r.box_id AND bm.member_id = r.accepted_by FOR UPDATE;')),
    ('permise : invitation', strpos(pg_temp.def('public.box_invitation_activation_permise(uuid,uuid)'),
       'WHERE id = p_invitation_id FOR UPDATE;')),
    ('permise : adhésion', strpos(pg_temp.def('public.box_invitation_activation_permise(uuid,uuid)'),
       'WHERE box_id = r.box_id AND member_id = p_user_id FOR UPDATE;'))
  ) x(n, pos) WHERE pos = 0;
$$;
-- Droits d'exécution des quatre fonctions, par rôle client.
CREATE FUNCTION pg_temp.droits() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(p.proname || '=' || coalesce((SELECT string_agg(ro, ',' ORDER BY ro)
           FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) ro WHERE has_function_privilege(ro, p.oid, 'EXECUTE')), '')
         || CASE WHEN EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                               WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN ',PUBLIC' ELSE '' END,
         ' ' ORDER BY p.proname COLLATE "C")
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('record_member_cash_payment', 'resolve_box_invitation_for_checkout', 'revoke_box_invitation',
                       'box_invitation_activation_permise');
$$;
CREATE FUNCTION pg_temp.commentaires() RETURNS text LANGUAGE sql AS $$
  SELECT md5(string_agg(p.proname || '=' || coalesce(obj_description(p.oid, 'pg_proc'), '-'), ' | ' ORDER BY p.proname COLLATE "C"))
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('record_member_cash_payment', 'resolve_box_invitation_for_checkout', 'revoke_box_invitation');
$$;
CREATE TEMP TABLE attendu (cas text PRIMARY KEY, valeur text NOT NULL) ON COMMIT DROP;

DO $t$
DECLARE
  v text;
  v_cas record;
BEGIN
  -- ── S : structure ──────────────────────────────────────────────────────────
  IF (SELECT string_agg(proname || ':' || n, ' ' ORDER BY proname) FROM (
        SELECT proname, count(*) n FROM pg_proc
         WHERE proname IN ('record_member_cash_payment', 'resolve_box_invitation_for_checkout', 'revoke_box_invitation',
                           'box_invitation_activation_permise') GROUP BY proname) s)
     IS DISTINCT FROM 'box_invitation_activation_permise:1 record_member_cash_payment:1 resolve_box_invitation_for_checkout:1 revoke_box_invitation:1' THEN
    RAISE EXCEPTION 'S : une version de chaque fonction';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.box_invitation_activation_permise(uuid,uuid)'::regprocedure
              AND NOT (prosecdef AND proconfig = ARRAY['search_path=public, pg_temp'])) THEN
    RAISE EXCEPTION 'S : box_invitation_activation_permise pas SECURITY DEFINER à search_path fixé';
  END IF;
  IF pg_temp.verrous() IS NOT NULL THEN RAISE EXCEPTION 'S : verrous absents : %', pg_temp.verrous(); END IF;
  -- Définitions de la migration, épinglées (search_path de la prod).
  SELECT string_agg(a.fn || ' ' || md5(pg_temp.def(a.fn)), ', ') INTO v
  FROM (VALUES
    ('public.record_member_cash_payment(uuid,integer)', '3b1060b271f96387dab3c5a6b6e737b2'),
    ('public.resolve_box_invitation_for_checkout(text)', '60499b17eb6c6cc3330b7c13e3d5d08a'),
    ('public.revoke_box_invitation(uuid)', '81eaf982928b03dc97ca89133c49ab75'),
    ('public.box_invitation_activation_permise(uuid,uuid)', 'cf6e9c3750c5604227e570e68d9ad558')
  ) a(fn, attendu)
  WHERE md5(pg_temp.def(a.fn)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'S : définitions différentes du fichier : %', v; END IF;

  -- ── D : droits ─────────────────────────────────────────────────────────────
  IF pg_temp.droits() IS DISTINCT FROM
     'box_invitation_activation_permise=service_role record_member_cash_payment=authenticated,service_role '
     || 'resolve_box_invitation_for_checkout=service_role revoke_box_invitation=authenticated,service_role' THEN
    RAISE EXCEPTION 'D : droits (%)', pg_temp.droits();
  END IF;

  -- ── Résultats attendus (E, V, R, W), relus par M ────────────────────────────
  INSERT INTO attendu VALUES
    -- E : règle 1, puis cas inchangés.
    ('E 60 gérant',          'STRIPE_PAYMENT_PENDING'),
    ('E 63 gérant',          'OK:active'),
    ('E 64 gérant',          'OK:active'),
    ('E 61 gérant',          'STRIPE_MEMBER'),
    ('E 60 coach',           'FORBIDDEN'),
    -- V : règle 2 (61 = le cas de prod), puis cas inchangés.
    ('V 60',                 'ok'),
    ('V 61',                 'INVITATION_NOT_PAYABLE'),
    ('V 62',                 'INVITATION_NOT_PAYABLE'),
    ('V 66',                 'INVITATION_NOT_PAYABLE'),
    ('V 65',                 'ok'),
    ('V 67',                 'ok'),
    ('V 69',                 'REVOKED'),
    ('V 70',                 'EXPIRED'),
    ('V 63',                 'NOT_STRIPE'),
    -- R : règle 3, puis cas inchangés.
    ('R 60 gérant',          'OK|revoked:pending_payment:REVOKED:REVOKED'),
    ('R 60 co-gérant',       'OK|revoked:pending_payment:REVOKED:REVOKED'),
    ('R 60 coach',           'FORBIDDEN'),
    ('R 61 gérant',          'ALREADY_ACCEPTED'),
    ('R 62 gérant',          'ALREADY_ACCEPTED'),
    ('R 63 gérant',          'ALREADY_ACCEPTED'),
    ('R 66 gérant',          'ALREADY_ACCEPTED'),
    ('R 73 gérant',          'ALREADY_ACCEPTED'),
    ('R 65 gérant',          'OK|revoked:pending_payment:ok:PENDING_PAYMENT'),
    ('R 72 gérant',          'OK|revoked:pending_payment:ok:PENDING_PAYMENT'),
    -- W : fonction du webhook.
    ('W 60/60',              'true:PENDING_PAYMENT'),
    ('W 65/65',              'true:NO_MEMBERSHIP_YET'),
    ('W 61/61',              'false:NOT_PENDING'),
    ('W 62/62',              'false:NOT_PENDING'),
    ('W 66/66',              'false:NOT_PENDING'),
    ('W 67/67',              'false:NOT_PENDING'),
    ('W 69/65',              'false:REVOKED'),
    ('W 60/61',              'false:ACCEPTED_BY_OTHER'),
    ('W null/60',            'false:MISSING_ARGUMENT'),
    ('W inconnue/60',        'false:NOT_FOUND'),
    ('W 60/60 anon',         '42501'),
    ('W 60/60 gérant',       '42501');
END $t$;

-- Rend le résultat observé d'un cas de la table attendu.
CREATE FUNCTION pg_temp.observer(c text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE p text[] := regexp_split_to_array(c, ' ');
BEGIN
  RETURN CASE p[1]
    WHEN 'E' THEN pg_temp.encaisser(CASE p[3] WHEN 'gérant' THEN 'e0' WHEN 'coach' THEN 'e2' END, p[2])
    WHEN 'V' THEN pg_temp.resoudre(p[2])
    WHEN 'R' THEN pg_temp.revoquer(CASE p[3] WHEN 'gérant' THEN 'e0' WHEN 'co-gérant' THEN 'e1' WHEN 'coach' THEN 'e2' END, p[2])
    WHEN 'W' THEN CASE
      WHEN c = 'W null/60'      THEN pg_temp.permise(NULL::uuid, pg_temp.u('60'))
      WHEN c = 'W inconnue/60'  THEN pg_temp.permise('00000000-0000-4000-d9c3-0000000000ff'::uuid, pg_temp.u('60'))
      WHEN c = 'W 60/60 anon'   THEN pg_temp.permise(pg_temp.inv('60'), pg_temp.u('60'), 'anon')
      WHEN c = 'W 60/60 gérant' THEN pg_temp.permise(pg_temp.inv('60'), pg_temp.u('60'), 'e0')
      ELSE pg_temp.permise(split_part(p[2], '/', 1), split_part(p[2], '/', 2)) END
  END;
END $$;
-- Cas dont le résultat diffère de l'attendu.
CREATE FUNCTION pg_temp.ecarts(p_prefixe text DEFAULT '') RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(cas || ' → ' || coalesce(pg_temp.observer(cas), 'NULL') || ' (attendu ' || valeur || ')', '; ' ORDER BY cas)
    FROM attendu WHERE cas LIKE p_prefixe || '%' AND pg_temp.observer(cas) IS DISTINCT FROM valeur;
$$;

-- ── E, V, R, W ────────────────────────────────────────────────────────────────
DO $t$
BEGIN
  IF pg_temp.ecarts() IS NOT NULL THEN RAISE EXCEPTION 'E/V/R/W : %', pg_temp.ecarts(); END IF;
  -- Rien n'a été écrit par les appels refusés ni par les appels joués.
  IF (SELECT count(*) FROM public.box_cash_payments WHERE box_id = '00000000-0000-4000-b9c3-000000000001') <> 0
     OR (SELECT subscription_status FROM public.box_members WHERE id = pg_temp.bm('60')) <> 'pending_payment'
     OR (SELECT status FROM public.box_invitations WHERE id = pg_temp.inv('60')) <> 'accepted' THEN
    RAISE EXCEPTION 'E/V/R/W : un appel a laissé une trace';
  END IF;
END $t$;

-- ── M : mutations ─────────────────────────────────────────────────────────────
-- Chaque mutation doit faire échouer le contrôle nommé ; la définition est
-- rejouée telle quelle ensuite.
CREATE FUNCTION pg_temp.prouver(f text, de text, vers text, c text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d text := pg_temp.def(f);
BEGIN
  PERFORM pg_temp.muter(f, de, vers);
  IF c = 'verrous' THEN
    IF pg_temp.verrous() IS NULL THEN RAISE EXCEPTION 'M : % « % » ne prouve rien (verrous)', f, de; END IF;
  ELSIF pg_temp.observer(c) IS NOT DISTINCT FROM (SELECT valeur FROM attendu WHERE cas = c) THEN
    RAISE EXCEPTION 'M : % « % » ne prouve rien (%)', f, de, c;
  END IF;
  EXECUTE d;
END $$;

DO $t$
DECLARE
  r constant text := 'public.record_member_cash_payment(uuid,integer)';
  v constant text := 'public.resolve_box_invitation_for_checkout(text)';
  k constant text := 'public.revoke_box_invitation(uuid)';
  w constant text := 'public.box_invitation_activation_permise(uuid,uuid)';
BEGIN
  -- E : règle 1.
  PERFORM pg_temp.prouver(r, 'IF m.subscription_status = ''pending_payment'' THEN', 'IF false THEN', 'E 60 gérant');
  -- V : règle 2 (chaque morceau de la condition).
  PERFORM pg_temp.prouver(v, 'IF r.status = ''accepted'' AND NOT EXISTS (', 'IF false AND NOT EXISTS (', 'V 61');
  PERFORM pg_temp.prouver(v, 'IF r.status = ''accepted'' AND NOT EXISTS (', 'IF NOT EXISTS (', 'V 65');
  PERFORM pg_temp.prouver(v, E'\n          AND bm.subscription_status = ''pending_payment'') THEN', ') THEN', 'V 61');
  PERFORM pg_temp.prouver(v, 'WHERE bm.box_id = r.box_id AND bm.member_id = r.accepted_by', 'WHERE bm.box_id = r.box_id', 'V 61');
  PERFORM pg_temp.prouver(v, 'WHERE bm.box_id = r.box_id AND bm.member_id = r.accepted_by', 'WHERE bm.member_id = r.accepted_by', 'V 61');
  -- R : règle 3.
  PERFORM pg_temp.prouver(k, 'IF r.payment_mode = ''stripe'' THEN', 'IF true THEN', 'R 73 gérant');
  PERFORM pg_temp.prouver(k, 'IF v_sub_status IS DISTINCT FROM ''pending_payment'' THEN', 'IF false THEN', 'R 61 gérant');
  PERFORM pg_temp.prouver(k, 'IF v_sub_status IS DISTINCT FROM ''pending_payment'' THEN', 'IF true THEN', 'R 60 gérant');
  PERFORM pg_temp.prouver(k, 'WHERE bm.box_id = r.box_id AND bm.member_id = r.accepted_by FOR UPDATE;',
                             'WHERE bm.box_id = r.box_id AND bm.member_id = r.accepted_by;', 'verrous');
  PERFORM pg_temp.prouver(k, 'IF NOT public.is_box_owner_admin(r.box_id) THEN', 'IF false THEN', 'R 60 coach');
  -- W : chaque code.
  PERFORM pg_temp.prouver(w, 'IF p_invitation_id IS NULL OR p_user_id IS NULL THEN', 'IF false THEN', 'W null/60');
  PERFORM pg_temp.prouver(w, E'IF r.id IS NULL THEN\n    RETURN jsonb_build_object(''permise'', false, ''raison'', ''NOT_FOUND'');',
                             E'IF false THEN\n    RETURN jsonb_build_object(''permise'', false, ''raison'', ''NOT_FOUND'');', 'W inconnue/60');
  PERFORM pg_temp.prouver(w, 'IF r.status = ''revoked'' THEN', 'IF false THEN', 'W 69/65');
  PERFORM pg_temp.prouver(w, 'IF r.status = ''accepted'' AND r.accepted_by IS DISTINCT FROM p_user_id THEN', 'IF false THEN', 'W 60/61');
  PERFORM pg_temp.prouver(w, 'IF m.id IS NULL AND r.status = ''pending'' THEN', 'IF m.id IS NULL THEN', 'W 66/66');
  PERFORM pg_temp.prouver(w, 'IF m.id IS NULL AND r.status = ''pending'' THEN', 'IF false THEN', 'W 65/65');
  PERFORM pg_temp.prouver(w, 'IF m.subscription_status = ''pending_payment'' THEN', 'IF m.id IS NOT NULL THEN', 'W 61/61');
  PERFORM pg_temp.prouver(w, 'IF m.subscription_status = ''pending_payment'' THEN', 'IF false THEN', 'W 60/60');
  PERFORM pg_temp.prouver(w, 'WHERE box_id = r.box_id AND member_id = p_user_id FOR UPDATE;',
                             'WHERE box_id = r.box_id AND member_id = p_user_id;', 'verrous');
  PERFORM pg_temp.prouver(w, 'WHERE id = p_invitation_id FOR UPDATE;', 'WHERE id = p_invitation_id;', 'verrous');
  -- D : un EXECUTE accordé se voit, au contrôle des droits comme à l'appel.
  GRANT EXECUTE ON FUNCTION public.box_invitation_activation_permise(uuid, uuid) TO authenticated;
  IF pg_temp.observer('W 60/60 gérant') = '42501' OR pg_temp.droits() NOT LIKE 'box_invitation_activation_permise=authenticated,service_role %' THEN
    RAISE EXCEPTION 'M : D authenticated ne prouve rien';
  END IF;
  REVOKE EXECUTE ON FUNCTION public.box_invitation_activation_permise(uuid, uuid) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.box_invitation_activation_permise(uuid, uuid) TO anon;
  IF pg_temp.observer('W 60/60 anon') = '42501' THEN RAISE EXCEPTION 'M : D anon ne prouve rien'; END IF;
  REVOKE EXECUTE ON FUNCTION public.box_invitation_activation_permise(uuid, uuid) FROM anon;
  GRANT EXECUTE ON FUNCTION public.box_invitation_activation_permise(uuid, uuid) TO PUBLIC;
  IF pg_temp.droits() NOT LIKE '%,PUBLIC %' THEN RAISE EXCEPTION 'M : D PUBLIC ne prouve rien'; END IF;
  REVOKE EXECUTE ON FUNCTION public.box_invitation_activation_permise(uuid, uuid) FROM PUBLIC;
  -- S : une seconde version se voit.
  CREATE FUNCTION public.revoke_box_invitation(p_invitation_id text) RETURNS jsonb LANGUAGE sql AS $f$ SELECT NULL::jsonb $f$;
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'revoke_box_invitation') <> 2 THEN RAISE EXCEPTION 'M : S une seule version ne prouve rien'; END IF;
  DROP FUNCTION public.revoke_box_invitation(text);
END $t$;

-- Les mutations n'ont rien laissé : définitions, droits et résultats revenus.
DO $t$
BEGIN
  IF (SELECT string_agg(md5(pg_temp.def(f)), ',' ORDER BY f) FROM unnest(ARRAY[
        'public.box_invitation_activation_permise(uuid,uuid)', 'public.record_member_cash_payment(uuid,integer)',
        'public.resolve_box_invitation_for_checkout(text)', 'public.revoke_box_invitation(uuid)']) f)
     IS DISTINCT FROM 'cf6e9c3750c5604227e570e68d9ad558,3b1060b271f96387dab3c5a6b6e737b2,60499b17eb6c6cc3330b7c13e3d5d08a,81eaf982928b03dc97ca89133c49ab75'
     OR pg_temp.droits() IS DISTINCT FROM
        'box_invitation_activation_permise=service_role record_member_cash_payment=authenticated,service_role '
        || 'resolve_box_invitation_for_checkout=service_role revoke_box_invitation=authenticated,service_role'
     OR pg_temp.ecarts() IS NOT NULL THEN
    RAISE EXCEPTION 'M : une mutation n''est pas revenue';
  END IF;
END $t$;

-- ── X : retour arrière ────────────────────────────────────────────────────────
CREATE TEMP TABLE avant_retour ON COMMIT DROP AS SELECT pg_temp.commentaires() AS c;
\i supabase/retours/20270158000000_comptoir_double_paiement_stripe.sql
SET LOCAL search_path = "$user", public, extensions;
DO $t$
DECLARE v text;
BEGIN
  SELECT string_agg(a.fn || ' ' || coalesce(md5(pg_temp.def(a.fn)), 'absente'), ', ') INTO v
  FROM (VALUES
    ('public.record_member_cash_payment(uuid,integer)', '7789384fc790ab1d7b42c70df8e96424'),
    ('public.resolve_box_invitation_for_checkout(text)', '3210ca73921e482cae65e031ff7ee4ae'),
    ('public.revoke_box_invitation(uuid)', '333011a7e465c54e1e94482ab6934002')
  ) a(fn, attendu)
  WHERE md5(pg_temp.def(a.fn)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'X : définitions de prod non rétablies : %', v; END IF;
  IF to_regprocedure('public.box_invitation_activation_permise(uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'X : box_invitation_activation_permise subsiste';
  END IF;
  IF pg_temp.droits() IS DISTINCT FROM
     'record_member_cash_payment=authenticated,service_role resolve_box_invitation_for_checkout=service_role revoke_box_invitation=authenticated,service_role' THEN
    RAISE EXCEPTION 'X : droits (%)', pg_temp.droits();
  END IF;
  IF pg_temp.commentaires() IS DISTINCT FROM (SELECT c FROM avant_retour) THEN RAISE EXCEPTION 'X : commentaires'; END IF;
  -- Comportement de prod revenu : l'encaissement et le lien du cas de prod passent.
  IF pg_temp.encaisser('e0', '60') <> 'OK:active' OR pg_temp.resoudre('61') <> 'ok' OR pg_temp.revoquer('e0', '60') <> 'ALREADY_ACCEPTED' THEN
    RAISE EXCEPTION 'X : comportement de prod non rétabli';
  END IF;
END $t$;

ROLLBACK;
\echo '    S, D, E, V, R, W, M et X OK'
