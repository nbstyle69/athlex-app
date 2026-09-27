-- ═════════════════════════════════════════════════════════════════════════════
-- Prochaine échéance et jour de prélèvement (migration 20270135)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box A : gérant G (…e0, owner_id), co-gérant C (…e1), coach K (…e2), membre
-- M (…10). Box B : gérant H (…e3).
--   E1  appel sans échéance, par paramètres nommés comme le Manager : accepté,
--       JSON renvoyé inchangé, next_due_date vide ; une seule version de la
--       fonction ; '' vaut absence ;
--   E2  échéance du lendemain et à douze mois pile : acceptées et stockées ;
--   E3  du jour, passée → DUE_DATE_PAST ; mal formée, 30 février →
--       DUE_DATE_INVALID ; douze mois et un jour → DUE_DATE_TOO_FAR ; rien créé ;
--   E4  import : mêmes cas en verdicts par ligne ; sans la clé, verdicts actuels
--       inchangés ; une ligne refusée n'empêche pas la suivante au même e-mail ;
--   E5  resolve et peek renvoient next_due_date (null si absente) ;
--   E6  billing_day : 0 et 11 refusés, 1 à 10 acceptés (box_members et
--       pending_entitlements) ;
--   E7  claim_pending_entitlements recopie billing_day (création du compte,
--       puis membre existant) ;
--   E8  next_due_date : ni lu ni écrit par M, K ou H ; billing_day illisible
--       par M, K et G ; M et K ne créent pas d'invitation ;
--   E9  droits EXECUTE des six fonctions redéfinies, identiques à la prod ;
--   R   retour arrière (supabase/retours/…) : les six définitions reviennent aux
--       md5 de prod, droits et commentaire compris, déclencheur de la garde
--       compris, colonnes supprimées.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Prochaine échéance et jour de prélèvement'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9d1-0000000000' || s)::uuid FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', '10']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9d1-0000000000' || s)::uuid, 'ejp-' || s || '@test.invalid', 'ejp_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', '10']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9d1-000000000001', 'Box échéance A', 'EJPA', '00000000-0000-4000-a9d1-0000000000e0'),
  ('00000000-0000-4000-b9d1-000000000002', 'Box échéance B', 'EJPB', '00000000-0000-4000-a9d1-0000000000e3');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type) VALUES
  ('00000000-0000-4000-c9d1-000000000001', '00000000-0000-4000-b9d1-000000000001', 'Mensuel', 5000, 'subscription');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9d1-000000000001', '00000000-0000-4000-a9d1-0000000000e1', 'owner',  'active'),
  ('00000000-0000-4000-b9d1-000000000001', '00000000-0000-4000-a9d1-0000000000e2', 'coach',  'active'),
  ('00000000-0000-4000-b9d1-000000000001', '00000000-0000-4000-a9d1-000000000010', 'member', 'active');

-- Exécute `p_sql` sous l'identité `p_qui` (…e0, …e1…, « service » ou « anon ») ;
-- rend le résultat, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  IF p_qui IN ('service', 'anon') THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
    PERFORM set_config('role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9d1-0000000000' || p_qui, true);
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

-- Invitation unitaire par G dans A, avec ou sans échéance (NULL : paramètre omis).
CREATE FUNCTION pg_temp.inviter(p_email text, p_due text, p_mode text DEFAULT 'box') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire('e0', format(
    'SELECT public.create_box_invitation(p_box_id => %L, p_email => %L, p_first_name => NULL, p_last_name => NULL, p_plan_id => %L, p_payment_mode => %L, p_cash_collected => false%s)::text',
    '00000000-0000-4000-b9d1-000000000001', p_email, '00000000-0000-4000-c9d1-000000000001', p_mode,
    CASE WHEN p_due IS NULL THEN '' ELSE format(', p_next_due_date => %L', p_due) END));
$$;

CREATE FUNCTION pg_temp.echeance(p_email text) RETURNS date LANGUAGE sql AS $$
  SELECT next_due_date FROM public.box_invitations
  WHERE box_id = '00000000-0000-4000-b9d1-000000000001' AND email = p_email;
$$;

DO $t$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_max   date := ((now() AT TIME ZONE 'Europe/Paris')::date + interval '12 months')::date;
  v text;
  j jsonb;
  r jsonb;
  v_cas record;
  v_n int;
BEGIN
  -- E1 : sans échéance, comme le Manager.
  v := pg_temp.inviter('e1-sans@test.invalid', NULL);
  j := v::jsonb;
  IF (j->>'ok') IS DISTINCT FROM 'true'
     OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(j) k) <> ARRAY['email', 'expires_at', 'id', 'ok', 'token'] THEN
    RAISE EXCEPTION 'E1 : appel sans échéance (%)', v;
  END IF;
  IF pg_temp.echeance('e1-sans@test.invalid') IS NOT NULL THEN RAISE EXCEPTION 'E1 : échéance inventée'; END IF;
  v := pg_temp.inviter('e1-vide@test.invalid', '  ');
  IF v NOT LIKE '{%' OR pg_temp.echeance('e1-vide@test.invalid') IS NOT NULL THEN
    RAISE EXCEPTION 'E1 : échéance vide non traitée comme absente (%)', v;
  END IF;
  SELECT count(*) INTO v_n FROM pg_proc WHERE proname = 'create_box_invitation' AND pronamespace = 'public'::regnamespace;
  IF v_n <> 1 THEN RAISE EXCEPTION 'E1 : % versions de create_box_invitation', v_n; END IF;
  -- Appel positionnel à 8 arguments : toujours résolu sans ambiguïté.
  v := pg_temp.faire('e0', 'SELECT public.create_box_invitation(''00000000-0000-4000-b9d1-000000000001'', ''e1-pos@test.invalid'', NULL, NULL, NULL, ''box'', false, 7)::text');
  IF v NOT LIKE '{%' THEN RAISE EXCEPTION 'E1 : appel positionnel (%)', v; END IF;

  -- E2 : échéances acceptées et stockées.
  v := pg_temp.inviter('e2-demain@test.invalid', (v_today + 1)::text, 'stripe');
  IF v NOT LIKE '{%' OR pg_temp.echeance('e2-demain@test.invalid') IS DISTINCT FROM v_today + 1 THEN
    RAISE EXCEPTION 'E2 : échéance du lendemain (%)', v;
  END IF;
  v := pg_temp.inviter('e2-max@test.invalid', v_max::text);
  IF v NOT LIKE '{%' OR pg_temp.echeance('e2-max@test.invalid') IS DISTINCT FROM v_max THEN
    RAISE EXCEPTION 'E2 : échéance à douze mois pile (%)', v;
  END IF;

  -- E3 : refus, et rien de créé.
  FOR v_cas IN SELECT * FROM (VALUES
      ('e3-jour',    v_today::text,            'DUE_DATE_PAST'),
      ('e3-hier',    (v_today - 1)::text,      'DUE_DATE_PAST'),
      ('e3-loin',    (v_max + 1)::text,        'DUE_DATE_TOO_FAR'),
      ('e3-fev',     '2027-02-30',             'DUE_DATE_INVALID'),
      ('e3-fr',      to_char(v_today + 1, 'DD/MM/YYYY'), 'DUE_DATE_INVALID'),
      ('e3-court',   '2027-1-5',               'DUE_DATE_INVALID'),
      ('e3-heure',   (v_today + 1)::text || 'T10:00', 'DUE_DATE_INVALID'),
      ('e3-texte',   'bientôt',                'DUE_DATE_INVALID')) c(nom, due, attendu)
  LOOP
    v := pg_temp.inviter(v_cas.nom || '@test.invalid', v_cas.due);
    IF v NOT LIKE '23514: ' || v_cas.attendu || ':%' THEN
      RAISE EXCEPTION 'E3 : % (%) : attendu %, obtenu %', v_cas.nom, v_cas.due, v_cas.attendu, v;
    END IF;
    IF EXISTS (SELECT 1 FROM public.box_invitations WHERE email = v_cas.nom || '@test.invalid') THEN
      RAISE EXCEPTION 'E3 : % créée malgré le refus', v_cas.nom;
    END IF;
  END LOOP;

  -- E4 : import.
  v := pg_temp.faire('e0', format('SELECT public.create_box_invitations_bulk(%L, %L::jsonb)::text',
    '00000000-0000-4000-b9d1-000000000001', jsonb_build_array(
      jsonb_build_object('line', 1, 'email', 'i-ok@test.invalid', 'next_due_date', (v_today + 10)::text),
      jsonb_build_object('line', 2, 'email', 'i-sans@test.invalid'),
      jsonb_build_object('line', 3, 'email', 'i-null@test.invalid', 'next_due_date', NULL),
      jsonb_build_object('line', 4, 'email', 'i-jour@test.invalid', 'next_due_date', v_today::text),
      jsonb_build_object('line', 5, 'email', 'i-hier@test.invalid', 'next_due_date', (v_today - 1)::text),
      jsonb_build_object('line', 6, 'email', 'i-fev@test.invalid', 'next_due_date', '2027-02-30'),
      jsonb_build_object('line', 7, 'email', 'i-mal@test.invalid', 'next_due_date', '05/10/2026'),
      jsonb_build_object('line', 8, 'email', 'i-nombre@test.invalid', 'next_due_date', 20261005),
      jsonb_build_object('line', 9, 'email', 'i-loin@test.invalid', 'next_due_date', (v_max + 1)::text),
      jsonb_build_object('line', 10, 'email', 'i-max@test.invalid', 'next_due_date', v_max::text),
      -- Verdicts d'avant, lignes sans échéance :
      jsonb_build_object('line', 11, 'email', 'i-ok@test.invalid'),
      jsonb_build_object('line', 12, 'email', 'pas-une-adresse'),
      jsonb_build_object('line', 13, 'email', 'ejp-10@test.invalid'),
      jsonb_build_object('line', 14, 'email', 'e1-sans@test.invalid'),
      jsonb_build_object('line', 15, 'email', 'i-formule@test.invalid', 'plan_id', 'pas-un-uuid'),
      -- Refusée pour l'échéance, puis la même adresse correcte : créée.
      jsonb_build_object('line', 16, 'email', 'i-reprise@test.invalid', 'next_due_date', v_today::text),
      jsonb_build_object('line', 17, 'email', 'i-reprise@test.invalid', 'next_due_date', (v_today + 3)::text)
    )::text));
  IF v NOT LIKE '{%' THEN RAISE EXCEPTION 'E4 : import en erreur (%)', v; END IF;
  j := v::jsonb;
  IF j->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'E4 : import refusé (%)', v; END IF;
  SELECT jsonb_object_agg(x->>'line', coalesce(x->>'verdict', '') || '/' || coalesce(x->>'reason', '')) INTO r
    FROM jsonb_array_elements(j->'results') x;
  IF r IS DISTINCT FROM jsonb_build_object(
      '1', 'creee/', '2', 'creee/', '3', 'creee/',
      '4', 'refusee/DUE_DATE_PAST', '5', 'refusee/DUE_DATE_PAST',
      '6', 'refusee/DUE_DATE_INVALID', '7', 'refusee/DUE_DATE_INVALID', '8', 'refusee/DUE_DATE_INVALID',
      '9', 'refusee/DUE_DATE_TOO_FAR', '10', 'creee/',
      '11', 'ignoree/doublon_fichier', '12', 'refusee/email_invalide', '13', 'ignoree/deja_membre',
      '14', 'ignoree/invitation_en_attente', '15', 'refusee/formule_inconnue',
      '16', 'refusee/DUE_DATE_PAST', '17', 'creee/') THEN
    RAISE EXCEPTION 'E4 : verdicts inattendus : %', r;
  END IF;
  IF (j->>'created')::int <> 5 OR (j->>'ignored')::int <> 3 OR (j->>'refused')::int <> 9 THEN
    RAISE EXCEPTION 'E4 : totaux inattendus (%)', v;
  END IF;
  IF pg_temp.echeance('i-ok@test.invalid') IS DISTINCT FROM v_today + 10
     OR pg_temp.echeance('i-max@test.invalid') IS DISTINCT FROM v_max
     OR pg_temp.echeance('i-reprise@test.invalid') IS DISTINCT FROM v_today + 3
     OR pg_temp.echeance('i-sans@test.invalid') IS NOT NULL
     OR pg_temp.echeance('i-null@test.invalid') IS NOT NULL THEN
    RAISE EXCEPTION 'E4 : échéances mal stockées';
  END IF;
  IF EXISTS (SELECT 1 FROM public.box_invitations WHERE email IN
      ('i-jour@test.invalid', 'i-hier@test.invalid', 'i-fev@test.invalid', 'i-mal@test.invalid', 'i-nombre@test.invalid', 'i-loin@test.invalid')) THEN
    RAISE EXCEPTION 'E4 : une ligne refusée a été créée';
  END IF;
END $t$;

-- E5 : resolve (clé serveur) et peek (anonyme) renvoient l'échéance.
DO $t$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_tok_due text;
  v_tok_sans text;
  j jsonb;
BEGIN
  v_tok_due  := (pg_temp.inviter('r-due@test.invalid', (v_today + 5)::text, 'stripe'))::jsonb->>'token';
  v_tok_sans := (pg_temp.inviter('r-sans@test.invalid', NULL, 'stripe'))::jsonb->>'token';
  j := pg_temp.faire('service', format('SELECT public.resolve_box_invitation_for_checkout(%L)::text', v_tok_due))::jsonb;
  IF j->>'ok' IS DISTINCT FROM 'true' OR j->>'next_due_date' IS DISTINCT FROM (v_today + 5)::text THEN
    RAISE EXCEPTION 'E5 : resolve sans l''échéance (%)', j;
  END IF;
  j := pg_temp.faire('service', format('SELECT public.resolve_box_invitation_for_checkout(%L)::text', v_tok_sans))::jsonb;
  IF j->>'ok' IS DISTINCT FROM 'true' OR NOT j ? 'next_due_date' OR j->'next_due_date' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'E5 : resolve sans échéance (%)', j;
  END IF;
  j := pg_temp.faire('anon', format('SELECT public.peek_box_invitation(%L)::text', v_tok_due))::jsonb;
  IF j->>'ok' IS DISTINCT FROM 'true' OR j->>'next_due_date' IS DISTINCT FROM (v_today + 5)::text THEN
    RAISE EXCEPTION 'E5 : peek sans l''échéance (%)', j;
  END IF;
  j := pg_temp.faire('anon', format('SELECT public.peek_box_invitation(%L)::text', v_tok_sans))::jsonb;
  IF j->>'ok' IS DISTINCT FROM 'true' OR NOT j ? 'next_due_date' OR j->'next_due_date' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'E5 : peek sans échéance (%)', j;
  END IF;
END $t$;

-- E6 : bornes de billing_day.
DO $t$
DECLARE
  v text;
  d int;
BEGIN
  FOREACH d IN ARRAY ARRAY[0, 11, -1] LOOP
    v := pg_temp.faire('service', format('WITH m AS (UPDATE public.box_members SET billing_day = %s WHERE member_id = ''00000000-0000-4000-a9d1-000000000010'' RETURNING 1) SELECT count(*)::text FROM m', d));
    IF v NOT LIKE '23514:%box_members_billing_day_check%' THEN RAISE EXCEPTION 'E6 : billing_day = % accepté (%)', d, v; END IF;
    v := pg_temp.faire('service', format('WITH m AS (INSERT INTO public.pending_entitlements (email, kind, payload, billing_day) VALUES (''x@test.invalid'', ''membership'', ''{}'', %s) RETURNING 1) SELECT count(*)::text FROM m', d));
    IF v NOT LIKE '23514:%pending_entitlements_billing_day_check%' THEN RAISE EXCEPTION 'E6 : pending billing_day = % accepté (%)', d, v; END IF;
  END LOOP;
  FOR d IN 1..10 LOOP
    v := pg_temp.faire('service', format('WITH m AS (UPDATE public.box_members SET billing_day = %s WHERE member_id = ''00000000-0000-4000-a9d1-000000000010'' RETURNING 1) SELECT count(*)::text FROM m', d));
    IF v <> '1' THEN RAISE EXCEPTION 'E6 : billing_day = % refusé (%)', d, v; END IF;
  END LOOP;
  UPDATE public.box_members SET billing_day = NULL WHERE member_id = '00000000-0000-4000-a9d1-000000000010';
END $t$;

-- E7 : claim_pending_entitlements. Paiement avant le compte, puis création du
-- profil (déclencheur de réclamation) ; puis membre existant.
INSERT INTO public.pending_entitlements (email, kind, payload, stripe_checkout_session_id, billing_day) VALUES
  ('ejp-20@test.invalid', 'membership', jsonb_build_object(
     'box_id', '00000000-0000-4000-b9d1-000000000001', 'plan_id', '00000000-0000-4000-c9d1-000000000001',
     'stripe_subscription_id', 'sub_ejp_20', 'amount_cents', 5000, 'payment_method_type', 'card'), 'cs_ejp_20', 7);
INSERT INTO auth.users (id) VALUES ('00000000-0000-4000-a9d1-000000000020');
INSERT INTO public.profiles (id, email, username) VALUES ('00000000-0000-4000-a9d1-000000000020', 'ejp-20@test.invalid', 'ejp_20');
INSERT INTO public.pending_entitlements (email, kind, payload, stripe_checkout_session_id, billing_day) VALUES
  ('ejp-10@test.invalid', 'membership', jsonb_build_object(
     'box_id', '00000000-0000-4000-b9d1-000000000001', 'plan_id', '00000000-0000-4000-c9d1-000000000001',
     'stripe_subscription_id', 'sub_ejp_10', 'amount_cents', 5000, 'payment_method_type', 'card'), 'cs_ejp_10', 3);

DO $t$
DECLARE v text;
BEGIN
  IF (SELECT billing_day FROM public.box_members WHERE member_id = '00000000-0000-4000-a9d1-000000000020') IS DISTINCT FROM 7::smallint THEN
    RAISE EXCEPTION 'E7 : billing_day non recopié à la création du compte';
  END IF;
  v := pg_temp.faire('service', 'SELECT public.claim_pending_entitlements(''00000000-0000-4000-a9d1-000000000010'', ''ejp-10@test.invalid'')::text');
  IF v <> '1' OR (SELECT billing_day FROM public.box_members WHERE member_id = '00000000-0000-4000-a9d1-000000000010') IS DISTINCT FROM 3::smallint THEN
    RAISE EXCEPTION 'E7 : billing_day non recopié sur un membre existant (%)', v;
  END IF;
END $t$;

-- E8 : isolement.
DO $t$
DECLARE
  v text;
  v_qui text;
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  FOREACH v_qui IN ARRAY ARRAY['10', 'e2', 'e3'] LOOP
    v := pg_temp.faire(v_qui, 'SELECT count(*)::text FROM public.box_invitations WHERE next_due_date IS NOT NULL');
    IF v <> '0' THEN RAISE EXCEPTION 'E8 : % lit next_due_date (%)', v_qui, v; END IF;
    v := pg_temp.faire(v_qui, 'WITH m AS (UPDATE public.box_invitations SET next_due_date = DATE ''2020-01-01'' RETURNING 1) SELECT count(*)::text FROM m');
    IF v <> '0' AND v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'E8 : % écrit next_due_date (%)', v_qui, v; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.box_invitations WHERE next_due_date = DATE '2020-01-01') THEN
    RAISE EXCEPTION 'E8 : next_due_date modifiée';
  END IF;
  -- Le gérant de A voit bien ses échéances (le contrôle ci-dessus n'est pas vide).
  v := pg_temp.faire('e0', 'SELECT count(*)::text FROM public.box_invitations WHERE next_due_date IS NOT NULL');
  IF v = '0' OR v LIKE '%:%' THEN RAISE EXCEPTION 'E8 : le gérant ne voit pas ses échéances (%)', v; END IF;
  FOREACH v_qui IN ARRAY ARRAY['10', 'e2', 'e0'] LOOP
    v := pg_temp.faire(v_qui, 'SELECT count(billing_day)::text FROM public.box_members');
    IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'E8 : % lit billing_day (%)', v_qui, v; END IF;
  END LOOP;
  FOREACH v_qui IN ARRAY ARRAY['10', 'e2', 'e3'] LOOP
    v := pg_temp.faire(v_qui, format('SELECT public.create_box_invitation(p_box_id => ''00000000-0000-4000-b9d1-000000000001'', p_email => ''e8@test.invalid'', p_next_due_date => %L)::text', (v_today + 2)::text));
    IF v NOT LIKE '42501: FORBIDDEN:%' THEN RAISE EXCEPTION 'E8 : % invite dans A (%)', v_qui, v; END IF;
  END LOOP;
END $t$;

-- E9 : droits EXECUTE, identiques à la prod.
DO $t$
DECLARE
  v_obtenu text;
  ATTENDU constant text :=
    'claim_pending_entitlements:service_role|create_box_invitation:authenticated,service_role|create_box_invitations_bulk:authenticated,service_role|garder_facturation_membre:|peek_box_invitation:anon,authenticated,service_role|resolve_box_invitation_for_checkout:service_role';
BEGIN
  SELECT string_agg(f || ':' || coalesce(r, ''), '|' ORDER BY f) INTO v_obtenu FROM (
    SELECT p.proname f,
           (SELECT string_agg(ro, ',' ORDER BY ro) FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) ro
             WHERE has_function_privilege(ro, p.oid, 'EXECUTE')) r
    FROM pg_proc p
    WHERE p.proname IN ('create_box_invitation', 'create_box_invitations_bulk', 'resolve_box_invitation_for_checkout',
                        'peek_box_invitation', 'claim_pending_entitlements', 'garder_facturation_membre')
      AND p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace)) s;
  IF v_obtenu IS DISTINCT FROM ATTENDU THEN RAISE EXCEPTION 'E9 : droits %', v_obtenu; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
              WHERE p.proname IN ('create_box_invitation', 'create_box_invitations_bulk', 'resolve_box_invitation_for_checkout',
                                  'peek_box_invitation', 'claim_pending_entitlements', 'garder_facturation_membre')
                AND a.grantee = 0) THEN
    RAISE EXCEPTION 'E9 : EXECUTE accordé à PUBLIC';
  END IF;
END $t$;

-- R : retour arrière, puis empreintes de prod.
\i supabase/retours/20270135000000_echeance_jour_prelevement.sql
SET LOCAL search_path = "$user", public, extensions;
DO $t$
DECLARE v text;
BEGIN
  SELECT string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ' ' ORDER BY p.proname) INTO v
  FROM pg_proc p
  WHERE p.proname IN ('create_box_invitation', 'create_box_invitations_bulk', 'resolve_box_invitation_for_checkout',
                      'peek_box_invitation', 'claim_pending_entitlements', 'garder_facturation_membre')
    AND p.pronamespace IN ('public'::regnamespace, 'internal'::regnamespace);
  IF v IS DISTINCT FROM 'claim_pending_entitlements=39653b35af642ffa91662e886a1ab96e create_box_invitation=e0b48f48b0211c34dea71318ee5c4795 create_box_invitations_bulk=809ebf560992450ca12d4b44a1c068be garder_facturation_membre=e0dfcd26b73cf9bab5b70f16bcfc672c peek_box_invitation=09b37db76642449d20d9338357c30ab7 resolve_box_invitation_for_checkout=4c2288bfd50cf37eaf1d033d91245e7c' THEN
    RAISE EXCEPTION 'R : définitions après retour arrière : %', v;
  END IF;
  IF has_function_privilege('anon', 'public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer)', 'EXECUTE')
     OR obj_description('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer)'::regprocedure, 'pg_proc')
        IS DISTINCT FROM 'Crée une invitation nominative pour une box administrée par l''appelant. Renvoie le jeton en clair une seule fois.' THEN
    RAISE EXCEPTION 'R : droits ou commentaire de create_box_invitation';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
              AND (table_name, column_name) IN (('box_invitations', 'next_due_date'), ('box_members', 'billing_day'), ('pending_entitlements', 'billing_day'))) THEN
    RAISE EXCEPTION 'R : colonnes restantes';
  END IF;
  IF (SELECT md5(pg_get_triggerdef(oid)) FROM pg_trigger WHERE tgname = 'trg_box_members_garde_facturation')
     IS DISTINCT FROM '30cc7eaef70e796798e60b05637b1793' THEN
    RAISE EXCEPTION 'R : déclencheur de la garde';
  END IF;
END $t$;

ROLLBACK;
\echo '    E1 à E9 et R OK'
