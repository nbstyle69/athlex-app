-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR 2 : fin d'accès et file des messages
-- (migration 20270152)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Boxes (suffixe b9f2-…0N) : 1 A ne vend pas en ligne (gérant e0) ; 2 B vend
-- en ligne (gérant e3) ; 3 Z archivée (gérant e4). Formules : a1 50 € et a0
-- 0 € dans A, b1 40 € (prix Stripe) dans B, f1 30 € dans Z.
-- Membres (suffixe a9f2-…XX ; fin d'accès en jours depuis aujourd'hui, Paris) :
--   10 A, a1, fin J−1            → coupé
--   22 A, a1, trialing, fin J−2  → coupé
--   11 A, a1, fin J (dernier jour) → pas coupé, J−1 en file
--   12 A, a1, fin J+1            → J−1 en file
--   13 A, a1, fin J+5            → J−7 en file
--   14 A, a1, fin J+7            → J−7 en file
--   15 A, a1, fin J+8            → rien
--   16 A, abonné Stripe, fin J−1 ; 17 A, formule à 0 €, fin J−1 ; 18 A, sans
--   date ; 19 A, banni, fin J−1 ; 20 A, coach avec formule, fin J−1 ; 21 Z
--   (archivée), fin J−1             → jamais touchés, jamais en file
--   23 B, b1, fin J+3            → J−7 en file, box_sells_online vrai
--   30, 31, 32 A, déjà 'expired' : carnet épuisé, carnet expiré, carnet
--   utilisable (point 2 : crédits de séances).
-- Créneaux de A : s1 J−2, s2 J, s3 J+3, s4 J+4 (1 place, prise par 15),
-- s5 J+5. Réservations : 10 sur s1, s2, s3 ; 20 (coach) et 11 sur s3.
-- Contrôles :
--   S  structure : table, contrainte d'unicité, RLS sans règle, droits,
--      fonctions internes fermées, définitions épinglées ;
--   F  file : J−7 (2 à 7 jours), J−1 (1 jour ou moins), une seule fois, rien
--      pour les exclus ni les échus, nouvelle série quand la fin change ;
--   X  coupure : à J+1 et pas avant, exclus non touchés, réservations à venir
--      supprimées (passées et du staff gardées), 'fin' en file une fois,
--      garde de facturation franchie par le serveur, NO_ACTIVE_PLAN après,
--      accès rétabli par un encaissement, nouvelle série après réencaissement ;
--   P  crédits : carnet épuisé ou expiré refusé (NO_CREDITS_LEFT), créneau
--      plein en liste d'attente jamais promue, carnet utilisable accepté ;
--   G  get_my_membership_billing : colonnes ajoutées en fin, anciennes
--      inchangées, droits et commentaire ;
--   T  tâche pg_cron comptoir-fin-acces ;
--   M  mutations : chaque contrôle échoue quand on retire ce qu'il prouve ;
--   R  retour arrière rejoué jusqu'aux empreintes d'avant.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Paiements au comptoir : fin d''accès et file des messages'

BEGIN;
SET LOCAL search_path = "$user", public, extensions;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9f2-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0','e3','e4','10','11','12','13','14','15','16','17','18','19','20','21','22','23','30','31','32']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9f2-0000000000' || s)::uuid, 'cfa-' || s || '@test.invalid', 'cfa_' || s
  FROM unnest(ARRAY['e0','e3','e4','10','11','12','13','14','15','16','17','18','19','20','21','22','23','30','31','32']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id, stripe_account_id, stripe_onboarding_complete) VALUES
  ('00000000-0000-4000-b9f2-000000000001', 'Box fin A', 'CFAA', '00000000-0000-4000-a9f2-0000000000e0', NULL, false),
  ('00000000-0000-4000-b9f2-000000000002', 'Box fin B', 'CFAB', '00000000-0000-4000-a9f2-0000000000e3', 'acct_cfa_b', true),
  ('00000000-0000-4000-b9f2-000000000003', 'Box fin Z', 'CFAZ', '00000000-0000-4000-a9f2-0000000000e4', NULL, false);
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active, stripe_price_id)
SELECT ('00000000-0000-4000-c9f2-0000000000' || p)::uuid, ('00000000-0000-4000-b9f2-00000000000' || b)::uuid, n, prix, 'subscription', true, sp
  FROM (VALUES ('a1', '1', 'Mensuel A', 5000, NULL), ('a0', '1', 'Offert A', 0, NULL),
               ('b1', '2', 'Mensuel B', 4000, 'price_cfa_b1'), ('f1', '3', 'Mensuel Z', 3000, NULL)) v(p, b, n, prix, sp);
-- (box, suffixe, rôle, statut, formule, statut d'abonnement, abonnement Stripe, fin en jours)
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, payment_method_type,
                                stripe_subscription_id, cash_access_until)
SELECT ('00000000-0000-4000-b9f2-00000000000' || b)::uuid, ('00000000-0000-4000-a9f2-0000000000' || m)::uuid, r, st,
       ('00000000-0000-4000-c9f2-0000000000' || p)::uuid, ss, 'cash', sub,
       CASE WHEN fin IS NULL THEN NULL ELSE (now() AT TIME ZONE 'Europe/Paris')::date + fin END
  FROM (VALUES
    ('1', '10', 'member', 'active', 'a1', 'active',   NULL,      -1),
    ('1', '22', 'member', 'active', 'a1', 'trialing', NULL,      -2),
    ('1', '11', 'member', 'active', 'a1', 'active',   NULL,      0),
    ('1', '12', 'member', 'active', 'a1', 'active',   NULL,      1),
    ('1', '13', 'member', 'active', 'a1', 'active',   NULL,      5),
    ('1', '14', 'member', 'active', 'a1', 'active',   NULL,      7),
    ('1', '15', 'member', 'active', 'a1', 'active',   NULL,      8),
    ('1', '16', 'member', 'active', 'a1', 'active',   'sub_cfa', -1),
    ('1', '17', 'member', 'active', 'a0', 'active',   NULL,      -1),
    ('1', '18', 'member', 'active', 'a1', 'active',   NULL,      NULL::int),
    ('1', '19', 'member', 'banned', 'a1', 'active',   NULL,      -1),
    ('1', '20', 'coach',  'active', 'a1', 'active',   NULL,      -1),
    ('3', '21', 'member', 'active', 'f1', 'active',   NULL,      -1),
    ('2', '23', 'member', 'active', 'b1', 'active',   NULL,      3),
    ('1', '30', 'member', 'active', 'a1', 'expired',  NULL,      -5),
    ('1', '31', 'member', 'active', 'a1', 'expired',  NULL,      -5),
    ('1', '32', 'member', 'active', 'a1', 'expired',  NULL,      -5)
  ) v(b, m, r, st, p, ss, sub, fin);
UPDATE public.boxes SET archived_at = now() WHERE id = '00000000-0000-4000-b9f2-000000000003';
-- Carnets : épuisé (30), expiré (31), utilisable (32).
INSERT INTO public.member_class_credits (box_id, member_id, credits_total, credits_used, status, expires_at)
SELECT '00000000-0000-4000-b9f2-000000000001', ('00000000-0000-4000-a9f2-0000000000' || m)::uuid, 10, u, st, e
  FROM (VALUES ('30', 10, 'exhausted', now() + interval '30 days'),
               ('31', 2,  'active',    now() - interval '1 day'),
               ('32', 2,  'active',    now() + interval '30 days')) v(m, u, st, e);
INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time, max_capacity)
SELECT ('00000000-0000-4000-e9f2-00000000000' || n)::uuid, '00000000-0000-4000-b9f2-000000000001', 'Créneau ' || n,
       (now() AT TIME ZONE 'Europe/Paris')::date + j, '23:00', '23:59', cap
  FROM (VALUES (1, -2, 10), (2, 0, 10), (3, 3, 10), (4, 4, 1), (5, 5, 10)) v(n, j, cap);
INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status)
SELECT ('00000000-0000-4000-e9f2-00000000000' || s)::uuid, ('00000000-0000-4000-a9f2-0000000000' || m)::uuid,
       '00000000-0000-4000-b9f2-000000000001', 'confirmed'
  FROM (VALUES (1, '10'), (2, '10'), (3, '10'), (3, '20'), (3, '11'), (4, '15')) v(s, m);

CREATE FUNCTION pg_temp.u(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a9f2-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.b(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-b9f2-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.s(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-e9f2-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.bm(m text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.box_members WHERE member_id = pg_temp.u(m) $$;
CREATE FUNCTION pg_temp.auj() RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Europe/Paris')::date $$;
CREATE FUNCTION pg_temp.def(f text) RETURNS text LANGUAGE sql AS $$ SELECT pg_get_functiondef(f::regprocedure) $$;
CREATE FUNCTION pg_temp.muter(f text, de text, vers text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d text := pg_temp.def(f);
BEGIN
  IF strpos(d, de) = 0 THEN RAISE EXCEPTION 'mutation sans effet sur % : « % » absent', f, de; END IF;
  EXECUTE replace(d, de, vers);
END $$;
-- Joue `p_sql` sous l'identité `p_qui` (suffixe, « service », « anon » ou
-- « admin »), lit `p_lecture` en superutilisateur, annule les deux. Rend
-- « résultat|lecture » ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.jouer(p_qui text, p_sql text, p_lecture text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text; w text; r text;
BEGIN
  BEGIN
    IF p_qui IN ('service', 'anon') THEN
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claim.role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
      PERFORM set_config('role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
    ELSIF p_qui <> 'admin' THEN
      PERFORM set_config('request.jwt.claim.sub', pg_temp.u(p_qui)::text, true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM set_config('role', 'authenticated', true);
    END IF;
    IF p_sql ~* '^\s*(insert|update|delete)' THEN EXECUTE p_sql; ELSE EXECUTE p_sql INTO v; END IF;
    PERFORM set_config('role', 'none', true);
    IF p_lecture IS NOT NULL THEN EXECUTE p_lecture INTO w; END IF;
    RAISE EXCEPTION USING ERRCODE = 'CFA00', MESSAGE = coalesce(v, 'OK') || CASE WHEN p_lecture IS NULL THEN '' ELSE '|' || coalesce(w, '') END;
  EXCEPTION
    WHEN SQLSTATE 'CFA00' THEN r := SQLERRM;
    WHEN OTHERS THEN r := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN r;
END $$;
CREATE FUNCTION pg_temp.code(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN v ~ '^\w{5}: [A-Z_]+:' THEN split_part(split_part(v, ': ', 2), ':', 1) ELSE v END;
$$;
-- Statut d'abonnement des membres suivis, « suffixe:statut » triés.
CREATE FUNCTION pg_temp.statuts() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(right(member_id::text, 2) || ':' || coalesce(subscription_status, '-'), ' ' ORDER BY right(member_id::text, 2))
    FROM public.box_members WHERE member_id::text LIKE '00000000-0000-4000-a9f2-%' AND role IN ('member', 'coach')
     AND right(member_id::text, 2) NOT IN ('30', '31', '32');
$$;
-- File : « suffixe:message:jours restants » triés.
CREATE FUNCTION pg_temp.file() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(string_agg(right(member_id::text, 2) || ':' || kind || ':' || (access_until - pg_temp.auj()), ' '
                             ORDER BY right(member_id::text, 2), kind, access_until), '')
    FROM public.box_member_access_notices WHERE member_id::text LIKE '00000000-0000-4000-a9f2-%';
$$;
-- Réservations restantes : « créneau:suffixe » triés.
CREATE FUNCTION pg_temp.resas() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(right(schedule_id::text, 1) || ':' || right(member_id::text, 2) || ':' || status, ' '
                    ORDER BY right(schedule_id::text, 1), right(member_id::text, 2))
    FROM public.class_reservations WHERE box_id = pg_temp.b(1);
$$;
-- Coupure jouée puis annulée : « nombre|statuts|réservations|file ».
CREATE FUNCTION pg_temp.coupure() RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.jouer('admin', 'SELECT internal.expirer_acces_comptoir()::text',
                       'SELECT pg_temp.statuts() || ''|'' || pg_temp.resas() || ''|'' || pg_temp.file()');
$$;
-- Réservation de `s` par `m` pour lui-même. Rend le code, ou « statut ».
CREATE FUNCTION pg_temp.reserver(m text, s int) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.code(pg_temp.jouer(m,
    format('INSERT INTO public.class_reservations (schedule_id, member_id, box_id) VALUES (%L, %L, %L)', pg_temp.s(s), pg_temp.u(m), pg_temp.b(1)),
    format('SELECT status FROM public.class_reservations WHERE schedule_id = %L AND member_id = %L', pg_temp.s(s), pg_temp.u(m))));
$$;
-- Coupe, puis encaisse l'adhésion `bm` par G (A ne vend pas en ligne) ; rend
-- son statut d'abonnement, ou l'erreur. Tout est annulé.
CREATE FUNCTION pg_temp.coupe_puis_paie(bm uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  BEGIN
    PERFORM internal.expirer_acces_comptoir();
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9f2-0000000000e0', true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
    PERFORM public.record_member_cash_payment(bm);
    PERFORM set_config('role', 'none', true);
    SELECT subscription_status INTO v FROM public.box_members WHERE id = bm;
    RAISE EXCEPTION USING ERRCODE = 'CFA00', MESSAGE = coalesce(v, '-');
  EXCEPTION
    WHEN SQLSTATE 'CFA00' THEN v := SQLERRM;
    WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN v;
END $$;
-- Ce que rend get_my_membership_billing au membre `m` : « fin:vend en ligne ».
CREATE FUNCTION pg_temp.billing(m text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.jouer(m, 'SELECT coalesce((cash_access_until - (now() AT TIME ZONE ''Europe/Paris'')::date)::text, ''-'') || '':'' || box_sells_online FROM public.get_my_membership_billing()');
$$;

-- Avant : l'état de départ, le résultat attendu de la coupure et de la file.
DO $t$
DECLARE
  v text;
  t date := pg_temp.auj();
  ATTENDU_COUPURE constant text := '2|10:expired 11:active 12:active 13:active 14:active 15:active 16:active 17:active 18:active 19:active 20:active 21:active 22:expired 23:active|1:10:confirmed 3:11:confirmed 3:20:confirmed 4:15:confirmed|10:fin:-1 22:fin:-2';
BEGIN
  -- ── S : structure ──────────────────────────────────────────────────────────
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.box_member_access_notices'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'box_member_access_notices') THEN
    RAISE EXCEPTION 'S : RLS de la file';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'box_member_access_notices_une_fois')
     IS DISTINCT FROM 'UNIQUE (box_member_id, kind, access_until)' THEN
    RAISE EXCEPTION 'S : unicité de la file';
  END IF;
  SELECT string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' ORDER BY a.grantee::regrole::text COLLATE "C", a.privilege_type COLLATE "C") INTO v
    FROM pg_class c, aclexplode(c.relacl) a
   WHERE c.oid = 'public.box_member_access_notices'::regclass AND (a.grantee = 0 OR a.grantee::regrole::text IN ('anon', 'authenticated', 'service_role'));
  IF v IS DISTINCT FROM 'service_role:SELECT' THEN RAISE EXCEPTION 'S : droits de table de la file (%)', v; END IF;
  SELECT string_agg(attname || ':' || privilege, ',' ORDER BY attname COLLATE "C", privilege COLLATE "C") INTO v FROM (
    SELECT a.attname, p.privilege FROM pg_attribute a, unnest(ARRAY['INSERT', 'UPDATE', 'SELECT', 'REFERENCES']) p(privilege)
     WHERE a.attrelid = 'public.box_member_access_notices'::regclass AND a.attnum > 0 AND NOT a.attisdropped
       AND has_column_privilege('service_role', a.attrelid, a.attnum, p.privilege) AND p.privilege <> 'SELECT') x;
  IF v IS DISTINCT FROM 'email_sent:UPDATE,error:UPDATE,push_count:UPDATE,reserved_at:UPDATE,sent_at:UPDATE' THEN
    RAISE EXCEPTION 'S : écritures de service_role sur la file (%)', v;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p
              WHERE has_table_privilege(r, 'public.box_member_access_notices', p)
                 OR (p IN ('SELECT', 'INSERT', 'UPDATE') AND has_any_column_privilege(r, 'public.box_member_access_notices', p))) THEN
    RAISE EXCEPTION 'S : un client a un droit sur la file';
  END IF;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v FROM pg_proc p, unnest(ARRAY['anon', 'authenticated', 'service_role']) r
   WHERE p.proname IN ('adhesions_comptoir_datees', 'expirer_acces_comptoir', 'filer_avis_fin_acces', 'purger_avis_fin_acces')
     AND has_function_privilege(r, p.oid, 'EXECUTE');
  IF v IS NOT NULL THEN RAISE EXCEPTION 'S : fonctions internes exécutables par un client : %', v; END IF;
  SELECT string_agg(a.fn || ' ' || md5(pg_temp.def(a.fn)), ', ') INTO v
  FROM (VALUES
    ('internal.adhesions_comptoir_datees()', '2104eb3810c3e0867c0251401983dece'),
    ('internal.expirer_acces_comptoir()', 'ab6b46e8c349bb8704ac2fe37bc7e79f'),
    ('internal.filer_avis_fin_acces()', '6733b1b320527e415c451da02afddf6c'),
    ('internal.purger_avis_fin_acces()', '062d67dd72af7bce17a869335239b26a'),
    ('public.get_my_membership_billing()', 'e1ea48e62a72b96753ba00fd93bdde69')
  ) a(fn, attendu) WHERE md5(pg_temp.def(a.fn)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'S : définitions différentes du fichier : %', v; END IF;
  -- Fonctions existantes touchées par la coupure, aux empreintes de prod.
  SELECT string_agg(a.fn, ', ') INTO v FROM (VALUES
    ('internal.garder_facturation_membre()', '483768906753de48dd9b48454f877f23'),
    ('public.record_member_cash_payment(uuid,integer)', '7789384fc790ab1d7b42c70df8e96424'),
    ('internal.membre_a_formule(uuid,uuid)', '471b0e75ce212bda0e400c2ab546920f'),
    ('internal.bloquer_reservation_impaye()', '3910a8d07c3da0fddf35f0b05bd75952'),
    ('public.consume_credit_on_reservation()', 'f6bc083f4c67cc88faa558a4eb061d29'),
    ('public.release_reservations_on_revoke()', '5970975ea59649147d9c59a99caa93e8')
  ) a(fn, attendu) WHERE md5(pg_temp.def(a.fn)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'S : fonctions existantes modifiées : %', v; END IF;

  -- ── T : tâche planifiée ────────────────────────────────────────────────────
  IF (SELECT count(*) FROM cron.job WHERE jobname = 'comptoir-fin-acces') <> 1
     OR (SELECT schedule FROM cron.job WHERE jobname = 'comptoir-fin-acces') <> '41 * * * *'
     OR NOT (SELECT strpos(command, 'internal.filer_avis_fin_acces()') BETWEEN 1 AND strpos(command, 'internal.expirer_acces_comptoir()')
                AND strpos(command, 'internal.expirer_acces_comptoir()') < strpos(command, 'internal.purger_avis_fin_acces()')
                AND strpos(command, 'http') = 0
               FROM cron.job WHERE jobname = 'comptoir-fin-acces') THEN
    RAISE EXCEPTION 'T : tâche comptoir-fin-acces';
  END IF;

  -- ── X : coupure (jouée puis annulée) ───────────────────────────────────────
  v := pg_temp.coupure();
  IF v IS DISTINCT FROM ATTENDU_COUPURE THEN RAISE EXCEPTION 'X : coupure → % (attendu %)', v, ATTENDU_COUPURE; END IF;

  -- ── P : crédits de séances ─────────────────────────────────────────────────
  IF pg_temp.reserver('30', 5) <> 'NO_CREDITS_LEFT' THEN RAISE EXCEPTION 'P : carnet épuisé (%)', pg_temp.reserver('30', 5); END IF;
  IF pg_temp.reserver('31', 5) <> 'NO_CREDITS_LEFT' THEN RAISE EXCEPTION 'P : carnet expiré (%)', pg_temp.reserver('31', 5); END IF;
  IF pg_temp.reserver('32', 5) <> 'OK|confirmed' THEN RAISE EXCEPTION 'P : carnet utilisable (%)', pg_temp.reserver('32', 5); END IF;
  IF pg_temp.reserver('30', 4) <> 'OK|waiting' THEN RAISE EXCEPTION 'P : créneau plein, liste d''attente (%)', pg_temp.reserver('30', 4); END IF;

  -- ── G : get_my_membership_billing ──────────────────────────────────────────
  IF pg_temp.billing('13') <> '5:false' OR pg_temp.billing('23') <> '3:true' OR pg_temp.billing('18') <> '-:false' THEN
    RAISE EXCEPTION 'G : colonnes ajoutées (%, %, %)', pg_temp.billing('13'), pg_temp.billing('23'), pg_temp.billing('18');
  END IF;
  IF pg_get_function_result('public.get_my_membership_billing()'::regprocedure) IS DISTINCT FROM
     'TABLE(id uuid, box_id uuid, status text, joined_at timestamp with time zone, plan_id uuid, subscription_status text, subscription_current_period_end timestamp with time zone, subscription_cancel_at_period_end boolean, subscription_paused boolean, pause_resumes_at timestamp with time zone, commitment_end_date timestamp with time zone, amount_cents integer, past_due_since timestamp with time zone, dunning_grace_days integer, suspended boolean, has_stripe_subscription boolean, stopped_at timestamp with time zone, stop_mode text, scheduled_plan_id uuid, scheduled_change_at timestamp with time zone, cash_access_until date, box_sells_online boolean)' THEN
    RAISE EXCEPTION 'G : type de retour (anciennes colonnes, ordre)';
  END IF;
  v := pg_temp.jouer('13', 'SELECT status || '':'' || subscription_status || '':'' || right(plan_id::text, 2) || '':'' || has_stripe_subscription || '':'' || suspended FROM public.get_my_membership_billing()');
  IF v IS DISTINCT FROM 'active:active:a1:false:false' THEN RAISE EXCEPTION 'G : anciennes colonnes (%)', v; END IF;
  IF has_function_privilege('anon', 'public.get_my_membership_billing()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_my_membership_billing()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_my_membership_billing()', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.get_my_membership_billing()'::regprocedure AND a.grantee = 0)
     OR obj_description('public.get_my_membership_billing()'::regprocedure, 'pg_proc') IS DISTINCT FROM
        'Lot 6 : son propre abonnement, par auth.uid(). Remplace la lecture directe des colonnes nominatives de box_members.' THEN
    RAISE EXCEPTION 'G : droits ou commentaire';
  END IF;
  IF pg_temp.jouer('anon', 'SELECT count(*)::text FROM public.get_my_membership_billing()') NOT LIKE '42501:%' THEN RAISE EXCEPTION 'G : anon lit'; END IF;

  -- ── Droits à l'usage ───────────────────────────────────────────────────────
  IF pg_temp.jouer('10', 'SELECT count(*)::text FROM public.box_member_access_notices') NOT LIKE '42501:%' THEN RAISE EXCEPTION 'S : authenticated lit la file'; END IF;
  IF pg_temp.jouer('service', 'SELECT count(*)::text FROM public.box_member_access_notices') <> '0' THEN RAISE EXCEPTION 'S : la clé serveur ne lit pas la file'; END IF;
  IF pg_temp.jouer('10', 'SELECT internal.expirer_acces_comptoir()::text') NOT LIKE '42501:%'
     OR pg_temp.jouer('service', 'SELECT internal.filer_avis_fin_acces()::text') NOT LIKE '42501:%' THEN
    RAISE EXCEPTION 'S : une fonction interne est appelable';
  END IF;
END $t$;

-- ── F, X : déroulé réel (dans la transaction du test) ─────────────────────────
DO $t$
DECLARE
  v text;
  n int;
  t date := pg_temp.auj();
BEGIN
  -- F1 : la file, une fois.
  n := internal.filer_avis_fin_acces();
  IF n <> 5 OR pg_temp.file() IS DISTINCT FROM '11:j1:0 12:j1:1 13:j7:5 14:j7:7 23:j7:3' THEN
    RAISE EXCEPTION 'F1 : % ligne(s) : %', n, pg_temp.file();
  END IF;
  IF internal.filer_avis_fin_acces() <> 0 THEN RAISE EXCEPTION 'F1 : messages en double'; END IF;
  -- La clé serveur note l'envoi, rien d'autre.
  v := pg_temp.jouer('service', format('UPDATE public.box_member_access_notices SET sent_at = now(), push_count = 1, email_sent = true WHERE member_id = %L', pg_temp.u('13')),
                     format('SELECT count(*)::text FROM public.box_member_access_notices WHERE member_id = %L AND sent_at IS NOT NULL', pg_temp.u('13')));
  IF v <> 'OK|1' THEN RAISE EXCEPTION 'F1 : la clé serveur ne note pas l''envoi (%)', v; END IF;
  IF pg_temp.jouer('service', format('UPDATE public.box_member_access_notices SET kind = ''fin'' WHERE member_id = %L', pg_temp.u('13'))) NOT LIKE '42501:%'
     OR pg_temp.jouer('service', format('INSERT INTO public.box_member_access_notices (box_id, member_id, box_member_id, kind, access_until) VALUES (%L, %L, %L, ''j7'', %L)',
                                        pg_temp.b(1), pg_temp.u('15'), pg_temp.bm('15'), t + 8)) NOT LIKE '42501:%'
     OR pg_temp.jouer('service', format('DELETE FROM public.box_member_access_notices WHERE member_id = %L', pg_temp.u('13'))) NOT LIKE '42501:%' THEN
    RAISE EXCEPTION 'F1 : la clé serveur écrit autre chose que l''envoi';
  END IF;
  -- F2 : nouvelle série quand la fin change (nouvel encaissement).
  UPDATE public.box_members SET cash_access_until = t + 6 WHERE id = pg_temp.bm('13');
  n := internal.filer_avis_fin_acces();
  IF n <> 1 OR (SELECT count(*) FROM public.box_member_access_notices WHERE member_id = pg_temp.u('13') AND kind = 'j7') <> 2 THEN
    RAISE EXCEPTION 'F2 : pas de nouvelle série (%)', pg_temp.file();
  END IF;

  -- X1 : coupure réelle, une fois.
  n := internal.expirer_acces_comptoir();
  IF n <> 2 OR (SELECT subscription_status FROM public.box_members WHERE id = pg_temp.bm('10')) <> 'expired'
     OR (SELECT status FROM public.box_members WHERE id = pg_temp.bm('10')) <> 'active' THEN
    RAISE EXCEPTION 'X1 : coupure réelle (%)', n;
  END IF;
  n := internal.expirer_acces_comptoir();
  IF n <> 0
     OR (SELECT count(*) FROM public.box_member_access_notices WHERE kind = 'fin' AND member_id::text LIKE '00000000-0000-4000-a9f2-%') <> 2 THEN
    RAISE EXCEPTION 'X1 : seconde coupure';
  END IF;
  -- X2 : NO_ACTIVE_PLAN après la coupure.
  IF pg_temp.reserver('10', 5) <> 'NO_ACTIVE_PLAN' THEN RAISE EXCEPTION 'X2 : NO_ACTIVE_PLAN (%)', pg_temp.reserver('10', 5); END IF;
  -- X3 : un encaissement rétablit l'accès.
  v := pg_temp.jouer('e0', format('SELECT public.record_member_cash_payment(%L)->>''ok''', pg_temp.bm('10')),
                     format('SELECT subscription_status || '':'' || (cash_access_until - %L::date) FROM public.box_members WHERE id = %L', t, pg_temp.bm('10')));
  IF v IS DISTINCT FROM 'true|active:' || (((t + interval '1 month')::date - 1) - t) THEN RAISE EXCEPTION 'X3 : réencaissement (%)', v; END IF;
  v := pg_temp.bm('10');
  PERFORM set_config('request.jwt.claim.sub', pg_temp.u('e0')::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.record_member_cash_payment(v::uuid);
  PERFORM set_config('role', 'none', true);
  IF pg_temp.reserver('10', 5) <> 'OK|confirmed' THEN RAISE EXCEPTION 'X3 : réservation après réencaissement (%)', pg_temp.reserver('10', 5); END IF;
  -- X4 : nouvelle série après réencaissement : la période suivante a sa propre fin.
  UPDATE public.box_members SET cash_access_until = t - 3 WHERE id = pg_temp.bm('10');
  n := internal.expirer_acces_comptoir();
  IF n <> 1
     OR (SELECT count(*) FROM public.box_member_access_notices WHERE kind = 'fin' AND member_id = pg_temp.u('10')) <> 2 THEN
    RAISE EXCEPTION 'X4 : pas de nouvelle fin (%)', pg_temp.file();
  END IF;
  -- X5 : la garde refuse la même écriture à un client.
  v := pg_temp.jouer('e0', format('UPDATE public.box_members SET subscription_status = ''expired'' WHERE id = %L', pg_temp.bm('11')));
  IF v NOT LIKE '42501: MEMBRE_FACTURATION_RESERVEE:%' THEN RAISE EXCEPTION 'X5 : un client coupe (%)', v; END IF;
  -- P2 : liste d'attente jamais promue (carnet épuisé), la place reste libre.
  v := format('INSERT INTO public.class_reservations (schedule_id, member_id, box_id) VALUES (%L, %L, %L)', pg_temp.s(4), pg_temp.u('30'), pg_temp.b(1));
  PERFORM set_config('request.jwt.claim.sub', pg_temp.u('30')::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  EXECUTE v;
  PERFORM set_config('role', 'none', true);
  DELETE FROM public.class_reservations WHERE schedule_id = pg_temp.s(4) AND member_id = pg_temp.u('15');
  IF (SELECT string_agg(right(member_id::text, 2) || ':' || status, ' ') FROM public.class_reservations WHERE schedule_id = pg_temp.s(4)) IS DISTINCT FROM '30:waiting' THEN
    RAISE EXCEPTION 'P2 : promotion sans crédit (%)', (SELECT string_agg(right(member_id::text, 2) || ':' || status, ' ') FROM public.class_reservations WHERE schedule_id = pg_temp.s(4));
  END IF;
  -- Purge : seules les lignes envoyées il y a plus de 90 jours partent.
  UPDATE public.box_member_access_notices SET sent_at = now() - interval '91 days' WHERE member_id = pg_temp.u('11');
  UPDATE public.box_member_access_notices SET sent_at = now() - interval '89 days' WHERE member_id = pg_temp.u('12');
  n := internal.purger_avis_fin_acces();
  IF n <> 1 OR (SELECT count(*) FROM public.box_member_access_notices WHERE member_id IN (pg_temp.u('11'), pg_temp.u('12'))) <> 1 THEN
    RAISE EXCEPTION 'F3 : purge';
  END IF;
END $t$;
-- Remet l'état de départ pour les mutations (la coupure et la file sont rejouées).
DELETE FROM public.box_member_access_notices WHERE member_id::text LIKE '00000000-0000-4000-a9f2-%';
DELETE FROM public.class_reservations WHERE box_id = '00000000-0000-4000-b9f2-000000000001';
INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status)
SELECT ('00000000-0000-4000-e9f2-00000000000' || s)::uuid, ('00000000-0000-4000-a9f2-0000000000' || m)::uuid,
       '00000000-0000-4000-b9f2-000000000001', 'confirmed'
  FROM (VALUES (1, '10'), (2, '10'), (3, '10'), (3, '20'), (3, '11'), (4, '15')) v(s, m);
UPDATE public.box_members SET subscription_status = 'active', cash_access_until = (now() AT TIME ZONE 'Europe/Paris')::date - 1
 WHERE member_id = '00000000-0000-4000-a9f2-000000000010';
UPDATE public.box_members SET subscription_status = 'trialing' WHERE member_id = '00000000-0000-4000-a9f2-000000000022';
UPDATE public.box_members SET cash_access_until = (now() AT TIME ZONE 'Europe/Paris')::date + 5 WHERE member_id = '00000000-0000-4000-a9f2-000000000013';

-- ── M : mutations ─────────────────────────────────────────────────────────────
DO $t$
DECLARE
  v text;
  d  text;
  dx text;
  t date := pg_temp.auj();
  a  constant text := 'internal.adhesions_comptoir_datees()';
  x  constant text := 'internal.expirer_acces_comptoir()';
  f  constant text := 'internal.filer_avis_fin_acces()';
  ATTENDU_COUPURE constant text := '2|10:expired 11:active 12:active 13:active 14:active 15:active 16:active 17:active 18:active 19:active 20:active 21:active 22:expired 23:active|1:10:confirmed 3:11:confirmed 3:20:confirmed 4:15:confirmed|10:fin:-1 22:fin:-2';
  ATTENDU_FILE constant text := '11:j1:0 12:j1:1 13:j7:5 14:j7:7 23:j7:3';
BEGIN
  IF pg_temp.coupure() IS DISTINCT FROM ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : état de départ non rétabli (%)', pg_temp.coupure(); END IF;

  -- X : chaque exclusion, la date, les réservations, le statut, la file 'fin'.
  d := pg_temp.def(a);
  FOR v IN SELECT * FROM unnest(ARRAY[
      'WHERE bm.role = ''member''', 'AND bm.status = ''active''', 'AND bm.stripe_subscription_id IS NULL',
      'AND mp.price_cents > 0', 'AND b.archived_at IS NULL']) LOOP
    PERFORM pg_temp.muter(a, v, CASE WHEN v LIKE 'WHERE%' THEN 'WHERE true' ELSE '' END);
    IF pg_temp.coupure() = ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : X exclusion « % » ne prouve rien', v; END IF;
    EXECUTE d;
  END LOOP;
  PERFORM pg_temp.muter(a, 'AND bm.subscription_status IN (''active'', ''trialing'', ''past_due'')', 'AND bm.subscription_status IN (''active'', ''past_due'')');
  IF pg_temp.coupure() = ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : X trialing ne prouve rien'; END IF;
  EXECUTE d;
  -- Sans date : seule une date inventée la ferait couper (les deux comparaisons protègent).
  dx := pg_temp.def(x);
  PERFORM pg_temp.muter(a, 'SELECT bm.id, bm.box_id, bm.member_id, bm.cash_access_until', 'SELECT bm.id, bm.box_id, bm.member_id, coalesce(bm.cash_access_until, current_date - 1)');
  PERFORM pg_temp.muter(a, 'AND bm.cash_access_until IS NOT NULL', '');
  PERFORM pg_temp.muter(x, 'AND bm.cash_access_until < v_today', 'AND coalesce(bm.cash_access_until, v_today - 1) < v_today');
  IF pg_temp.coupure() = ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : X membre sans date ne prouve rien'; END IF;
  EXECUTE d;
  EXECUTE dx;
  d := dx;
  FOR v IN SELECT * FROM unnest(ARRAY['WHERE a.access_until < v_today', 'AND bm.cash_access_until < v_today']) LOOP
    PERFORM pg_temp.muter(x, v, replace(v, '<', '<='));
  END LOOP;
  IF pg_temp.coupure() = ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : X coupure à J+1 ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(x, 'AND cs.scheduled_date >= v_today', 'AND cs.scheduled_date >= v_today + 1');
  IF pg_temp.coupure() = ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : X réservation du jour ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(x, 'AND cs.scheduled_date >= v_today', 'AND cs.scheduled_date >= v_today - 30');
  IF pg_temp.coupure() = ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : X réservation passée ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(x, 'AND cr.member_id = c.member_id', format('AND cr.member_id IN (c.member_id, %L)', pg_temp.u('20')));
  IF pg_temp.coupure() = ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : X réservation du staff ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(x, 'SET subscription_status = ''expired''', 'SET subscription_status = subscription_status');
  IF pg_temp.coupure() = ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : X statut expired ne prouve rien'; END IF;
  v := pg_temp.code(pg_temp.jouer('admin', 'SELECT internal.expirer_acces_comptoir()::text', format('SELECT pg_temp.reserver(%L, 5)', '10')));
  IF v LIKE '%NO_ACTIVE_PLAN' THEN RAISE EXCEPTION 'M : X2 NO_ACTIVE_PLAN ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(x, 'FROM coupes c
    ON CONFLICT', 'FROM coupes c WHERE false
    ON CONFLICT');
  IF pg_temp.coupure() = ATTENDU_COUPURE THEN RAISE EXCEPTION 'M : X message de fin ne prouve rien'; END IF;
  EXECUTE d;
  -- La garde est bien sur le chemin : forcée pour tous, la coupure échoue.
  d := pg_temp.def('internal.garder_facturation_membre()');
  PERFORM pg_temp.muter('internal.garder_facturation_membre()', 'IF current_user NOT IN (''authenticated'', ''anon'') THEN', 'IF false THEN');
  IF pg_temp.coupure() NOT LIKE '42501: MEMBRE_FACTURATION_RESERVEE:%' THEN RAISE EXCEPTION 'M : X garde de facturation ne prouve rien'; END IF;
  EXECUTE d;
  -- Réencaissement : sans la remise à 'active', l'accès ne revient pas.
  d := pg_temp.def('public.record_member_cash_payment(uuid,integer)');
  PERFORM pg_temp.muter('public.record_member_cash_payment(uuid,integer)', 'subscription_status = CASE WHEN status = ''banned'' THEN subscription_status ELSE ''active'' END',
                        'subscription_status = subscription_status');
  v := pg_temp.coupe_puis_paie(pg_temp.bm('10'));
  IF v = 'active' THEN RAISE EXCEPTION 'M : X3 réencaissement ne prouve rien (%)', v; END IF;
  EXECUTE d;
  IF pg_temp.coupe_puis_paie(pg_temp.bm('10')) <> 'active' THEN RAISE EXCEPTION 'X3 : réencaissement (sous-bloc)'; END IF;

  -- F : seuils, accès pas échu, une seule fois.
  d := pg_temp.def(f);
  PERFORM pg_temp.muter(f, 'WHEN a.access_until - v_today <= 1 THEN', 'WHEN a.access_until - v_today <= 0 THEN');
  IF pg_temp.jouer('admin', 'SELECT internal.filer_avis_fin_acces()::text', 'SELECT pg_temp.file()') = '5|' || ATTENDU_FILE THEN RAISE EXCEPTION 'M : F seuil J−1 ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(f, 'AND a.access_until - v_today <= 7', 'AND a.access_until - v_today <= 6');
  IF pg_temp.jouer('admin', 'SELECT internal.filer_avis_fin_acces()::text', 'SELECT pg_temp.file()') = '5|' || ATTENDU_FILE THEN RAISE EXCEPTION 'M : F seuil J−7 ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(f, 'WHERE a.access_until >= v_today', 'WHERE a.access_until > v_today');
  IF pg_temp.jouer('admin', 'SELECT internal.filer_avis_fin_acces()::text', 'SELECT pg_temp.file()') = '5|' || ATTENDU_FILE THEN RAISE EXCEPTION 'M : F dernier jour ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(f, 'WHERE a.access_until >= v_today', 'WHERE a.access_until >= v_today - 30');
  IF pg_temp.jouer('admin', 'SELECT internal.filer_avis_fin_acces()::text', 'SELECT pg_temp.file()') = '5|' || ATTENDU_FILE THEN RAISE EXCEPTION 'M : F accès échu ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(f, 'ON CONFLICT ON CONSTRAINT box_member_access_notices_une_fois DO NOTHING', '');
  ALTER TABLE public.box_member_access_notices DROP CONSTRAINT box_member_access_notices_une_fois;
  IF pg_temp.jouer('admin', 'SELECT internal.filer_avis_fin_acces()::text || internal.filer_avis_fin_acces()::text') = '50' THEN RAISE EXCEPTION 'M : F une seule fois ne prouve rien'; END IF;
  ALTER TABLE public.box_member_access_notices ADD CONSTRAINT box_member_access_notices_une_fois UNIQUE (box_member_id, kind, access_until);
  EXECUTE d;
  IF pg_temp.jouer('admin', 'SELECT internal.filer_avis_fin_acces()::text || internal.filer_avis_fin_acces()::text') <> '50' THEN RAISE EXCEPTION 'F : une seule fois'; END IF;

  -- P : sans le refus NO_CREDITS_LEFT, le carnet épuisé prendrait une place.
  d := pg_temp.def('public.consume_credit_on_reservation()');
  PERFORM pg_temp.muter('public.consume_credit_on_reservation()', 'IF v_has_any THEN', 'IF false THEN');
  IF pg_temp.reserver('30', 5) = 'NO_CREDITS_LEFT' OR pg_temp.reserver('31', 5) = 'NO_CREDITS_LEFT' THEN RAISE EXCEPTION 'M : P carnets ne prouve rien'; END IF;
  EXECUTE d;

  -- G : les deux colonnes ajoutées.
  d := pg_temp.def('public.get_my_membership_billing()');
  PERFORM pg_temp.muter('public.get_my_membership_billing()', 'internal.box_vend_en_ligne(bm.box_id)', 'false');
  IF pg_temp.billing('23') = '3:true' THEN RAISE EXCEPTION 'M : G box_sells_online ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('public.get_my_membership_billing()', 'bm.cash_access_until,', 'NULL::date,');
  IF pg_temp.billing('13') = '5:false' THEN RAISE EXCEPTION 'M : G cash_access_until ne prouve rien'; END IF;
  EXECUTE d;

  -- S, T : droits et tâche.
  GRANT INSERT ON public.box_member_access_notices TO service_role;
  IF pg_temp.jouer('service', format('INSERT INTO public.box_member_access_notices (box_id, member_id, box_member_id, kind, access_until) VALUES (%L, %L, %L, ''j7'', %L)',
                                     pg_temp.b(1), pg_temp.u('15'), pg_temp.bm('15'), t + 8)) <> 'OK' THEN RAISE EXCEPTION 'M : S écriture serveur ne prouve rien'; END IF;
  REVOKE INSERT ON public.box_member_access_notices FROM service_role;
  GRANT SELECT ON public.box_member_access_notices TO authenticated;
  IF pg_temp.jouer('10', 'SELECT count(*)::text FROM public.box_member_access_notices') <> '0' THEN RAISE EXCEPTION 'M : S droit accordé, la RLS devrait tout filtrer'; END IF;
  ALTER TABLE public.box_member_access_notices DISABLE ROW LEVEL SECURITY;
  IF pg_temp.jouer('10', 'SELECT count(*)::text FROM public.box_member_access_notices') LIKE '42501:%' THEN RAISE EXCEPTION 'M : S lecture client ne prouve rien'; END IF;
  ALTER TABLE public.box_member_access_notices ENABLE ROW LEVEL SECURITY;
  REVOKE SELECT ON public.box_member_access_notices FROM authenticated;
  GRANT EXECUTE ON FUNCTION internal.expirer_acces_comptoir() TO authenticated;
  IF NOT has_function_privilege('authenticated', 'internal.expirer_acces_comptoir()', 'EXECUTE') THEN RAISE EXCEPTION 'M : S droits des fonctions ne prouvent rien'; END IF;
  REVOKE EXECUTE ON FUNCTION internal.expirer_acces_comptoir() FROM authenticated;
  PERFORM cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'comptoir-fin-acces'), schedule := '0 * * * *');
  IF (SELECT schedule FROM cron.job WHERE jobname = 'comptoir-fin-acces') = '41 * * * *' THEN RAISE EXCEPTION 'M : T ne prouve rien'; END IF;
  PERFORM cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'comptoir-fin-acces'), schedule := '41 * * * *');
END $t$;

-- Les mutations n'ont rien laissé.
DO $t$
BEGIN
  IF (SELECT string_agg(md5(pg_temp.def(f)), ',' ORDER BY f) FROM unnest(ARRAY[
        'internal.adhesions_comptoir_datees()', 'internal.expirer_acces_comptoir()', 'internal.filer_avis_fin_acces()',
        'internal.garder_facturation_membre()', 'public.consume_credit_on_reservation()', 'public.get_my_membership_billing()',
        'public.record_member_cash_payment(uuid,integer)']) f)
     IS DISTINCT FROM (SELECT string_agg(h, ',' ORDER BY f) FROM (VALUES
        ('internal.adhesions_comptoir_datees()', '2104eb3810c3e0867c0251401983dece'),
        ('internal.expirer_acces_comptoir()', 'ab6b46e8c349bb8704ac2fe37bc7e79f'),
        ('internal.filer_avis_fin_acces()', '6733b1b320527e415c451da02afddf6c'),
        ('internal.garder_facturation_membre()', '483768906753de48dd9b48454f877f23'),
        ('public.consume_credit_on_reservation()', 'f6bc083f4c67cc88faa558a4eb061d29'),
        ('public.get_my_membership_billing()', 'e1ea48e62a72b96753ba00fd93bdde69'),
        ('public.record_member_cash_payment(uuid,integer)', '7789384fc790ab1d7b42c70df8e96424')) x(f, h))
     OR (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'box_member_access_notices_une_fois') IS DISTINCT FROM 'UNIQUE (box_member_id, kind, access_until)'
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.box_member_access_notices'::regclass)
     OR has_table_privilege('service_role', 'public.box_member_access_notices', 'INSERT')
     OR has_table_privilege('authenticated', 'public.box_member_access_notices', 'SELECT')
     OR has_function_privilege('authenticated', 'internal.expirer_acces_comptoir()', 'EXECUTE')
     OR (SELECT schedule FROM cron.job WHERE jobname = 'comptoir-fin-acces') <> '41 * * * *' THEN
    RAISE EXCEPTION 'M : une mutation n''est pas revenue';
  END IF;
END $t$;

-- ── R : retour arrière ────────────────────────────────────────────────────────
\i supabase/retours/20270152000000_comptoir_fin_acces.sql
SET LOCAL search_path = "$user", public, extensions;
DO $t$
BEGIN
  IF md5(pg_temp.def('public.get_my_membership_billing()')) <> 'b4ca55006146fc83bc3da8eff1260234' THEN
    RAISE EXCEPTION 'R : get_my_membership_billing non rétablie (%)', md5(pg_temp.def('public.get_my_membership_billing()'));
  END IF;
  IF has_function_privilege('anon', 'public.get_my_membership_billing()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_my_membership_billing()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_my_membership_billing()', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.get_my_membership_billing()'::regprocedure AND a.grantee = 0)
     OR obj_description('public.get_my_membership_billing()'::regprocedure, 'pg_proc') IS DISTINCT FROM
        'Lot 6 : son propre abonnement, par auth.uid(). Remplace la lecture directe des colonnes nominatives de box_members.' THEN
    RAISE EXCEPTION 'R : droits ou commentaire de get_my_membership_billing';
  END IF;
  IF to_regclass('public.box_member_access_notices') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('adhesions_comptoir_datees', 'expirer_acces_comptoir', 'filer_avis_fin_acces', 'purger_avis_fin_acces'))
     OR EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'comptoir-fin-acces') THEN
    RAISE EXCEPTION 'R : un objet ajouté subsiste';
  END IF;
END $t$;

ROLLBACK;
\echo '    S, T, X, P, G, F, M et R OK'
