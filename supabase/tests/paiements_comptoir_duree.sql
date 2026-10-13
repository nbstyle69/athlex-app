-- ═════════════════════════════════════════════════════════════════════════════
-- Paiements au comptoir (P1), PR 1 : durée des encaissements et date de fin
-- d'accès (migration 20270151)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Boxes (suffixe b9c1-…0N) :
--   1 A  vend en ligne (compte Stripe terminé, formule a1 50 € avec prix Stripe),
--        renouvellement au comptoir NON autorisé ; formule a0 à 0 €.
--   2 B  ne vend pas en ligne (aucun compte Stripe) ; formule b1 40 €.
--   3 C  vend en ligne, renouvellement au comptoir autorisé ; formule c1 30 €.
--   4 E  compte Stripe non terminé, formule avec prix Stripe.
--   5 F  compte Stripe terminé, formules sans prix Stripe ou inactives.
-- Comptes (suffixe a9c1-…XX) : e0 gérant de A, e2 coach de A, e3 gérant de B,
-- e4 gérant de C, e5 gérant de E et F.
-- Membres :
--   10 A, a1, aucune période            (premier encaissement)
--   11 A, a1, fin d'accès dans 10 jours (renouvellement)
--   12 A, a1, abonné Stripe
--   13 A, a0 (formule à 0 €)
--   14 A, a1, sans fin d'accès mais un encaissement d'adhésion journalisé
--   15 A, a1, seul un encaissement de programme journalisé
--   20 B, b1, fin dans 5 jours ; 21 B, b1, fin échue il y a 3 jours
--   30 C, c1, fin dans 2 jours
--   40 A, invité au comptoir, compte créé, pas encore encaissé, sans période
--   41 A, invité au comptoir, compte créé, fin d'accès dans 20 jours
--   42 sans box, invitation encaissée à consommer (création de l'adhésion)
--   43 A, inactif avec une fin d'accès lointaine, invitation encaissée à
--      consommer (mise à jour, la fin la plus tardive l'emporte)
--   Formule absente ou à 0 € (aucune période, aucune fin, rien au journal) :
--   50 A, a0, invité avec compte, sans fin ; 51 A, sans formule, invité avec
--   compte, fin dans 20 jours (inchangée) ; 44 sans box, invitation a0
--   encaissée à consommer ; 45 A, sans formule, fin dans 50 jours, invitation
--   sans formule encaissée à consommer (fin inchangée).
--   Invitations sans compte : 05 (a0) et 06 (sans formule).
-- Contrôles :
--   S  structure : colonnes, défauts, contraintes, déclencheurs, une seule
--      version de chaque fonction redéfinie, SECURITY DEFINER et search_path,
--      définitions épinglées (md5 calculé par la base, search_path de la prod) ;
--   P  internal.periode_comptoir : 1, 3, 12 mois, prolongation, accès échu,
--      fin aujourd'hui, 31/01 → 27/02, durée invalide ;
--   V  internal.box_vend_en_ligne : A, C oui ; B, E, F non ;
--   E  record_member_cash_payment : montant = prix × mois, période posée sur
--      le membre et au journal, appel à un argument = 1 mois, premier
--      encaissement accepté, COUNTER_RENEWAL_DISABLED (fin d'accès ou journal
--      d'adhésion), programme ignoré, box qui ne vend pas en ligne, réglage à
--      vrai, refus STRIPE_MEMBER, NO_PLAN_PRICE, FORBIDDEN (autre gérant,
--      coach), anon, durée invalide, verrou FOR UPDATE ;
--   I  mark_box_invitation_paid : sans compte (fin sur l'invitation), avec
--      compte (fin sur le membre, prolongation), renouvellement désactivé sans
--      effet, déjà encaissée, appel à un argument ; formule à 0 € ou absente,
--      avec et sans compte : ni période, ni fin, ni journal, membre activé ;
--   K  consommation : la fin de l'invitation est recopiée (insertion, et mise
--      à jour sans raccourcir) ; une invitation à 0 € ou sans formule ne pose
--      aucune fin ;
--   C  create_box_invitation déjà encaissée : période et journal ; non
--      encaissée, mode Stripe, formule à 0 € ou absente : rien ;
--   L  verrous : période du journal non modifiable (même service_role et
--      superutilisateur), période complète ou absente ; cash_access_until et
--      allow_counter_renewal non écrits par authenticated, écrits par le
--      serveur ;
--   D  droits : fonctions internes et _log_box_cash_payment fermées à anon,
--      authenticated et service_role ; les trois RPC à authenticated et
--      service_role seulement ;
--   M  mutations : chaque contrôle échoue quand on retire ce qu'il prouve ;
--   R  retour arrière (supabase/retours/…) : définitions de prod aux md5 du
--      précontrôle, droits et commentaires, objets ajoutés supprimés.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Paiements au comptoir : durée des encaissements'

BEGIN;
SET LOCAL search_path = "$user", public, extensions;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9c1-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0','e2','e3','e4','e5','10','11','12','13','14','15','20','21','30','40','41','42','43','44','45','50','51']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9c1-0000000000' || s)::uuid, 'pcd-' || s || '@test.invalid', 'pcd_' || s
  FROM unnest(ARRAY['e0','e2','e3','e4','e5','10','11','12','13','14','15','20','21','30','40','41','42','43','44','45','50','51']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id, stripe_account_id, stripe_onboarding_complete) VALUES
  ('00000000-0000-4000-b9c1-000000000001', 'Box comptoir A', 'PCDA', '00000000-0000-4000-a9c1-0000000000e0', 'acct_pcd_a', true),
  ('00000000-0000-4000-b9c1-000000000002', 'Box comptoir B', 'PCDB', '00000000-0000-4000-a9c1-0000000000e3', NULL, false),
  ('00000000-0000-4000-b9c1-000000000003', 'Box comptoir C', 'PCDC', '00000000-0000-4000-a9c1-0000000000e4', 'acct_pcd_c', true),
  ('00000000-0000-4000-b9c1-000000000004', 'Box comptoir E', 'PCDE', '00000000-0000-4000-a9c1-0000000000e5', 'acct_pcd_e', false),
  ('00000000-0000-4000-b9c1-000000000005', 'Box comptoir F', 'PCDF', '00000000-0000-4000-a9c1-0000000000e5', 'acct_pcd_f', true);
UPDATE public.boxes SET allow_counter_renewal = true WHERE id = '00000000-0000-4000-b9c1-000000000003';
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active, stripe_price_id)
SELECT ('00000000-0000-4000-c9c1-0000000000' || p)::uuid, ('00000000-0000-4000-b9c1-00000000000' || b)::uuid, n, prix, 'subscription', act, sp
  FROM (VALUES
    ('a1', '1', 'Mensuel A', 5000, true,  'price_pcd_a1'),
    ('a0', '1', 'Offert A',  0,    true,  NULL),
    ('b1', '2', 'Mensuel B', 4000, true,  NULL),
    ('c1', '3', 'Mensuel C', 3000, true,  'price_pcd_c1'),
    ('e1', '4', 'Mensuel E', 3000, true,  'price_pcd_e1'),
    ('f1', '5', 'Mensuel F', 3000, true,  NULL),
    ('f2', '5', 'Ancien F',  3000, false, 'price_pcd_f2')
  ) v(p, b, n, prix, act, sp);
-- (box, suffixe, rôle, statut, formule, statut d'abonnement, abonnement Stripe, fin d'accès en jours depuis aujourd'hui)
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, payment_method_type,
                                stripe_subscription_id, cash_access_until)
SELECT ('00000000-0000-4000-b9c1-00000000000' || b)::uuid, ('00000000-0000-4000-a9c1-0000000000' || m)::uuid, r, st,
       CASE WHEN p IS NULL THEN NULL ELSE ('00000000-0000-4000-c9c1-0000000000' || p)::uuid END, ss,
       CASE WHEN r = 'member' THEN 'cash' END, sub,
       CASE WHEN fin IS NULL THEN NULL ELSE (now() AT TIME ZONE 'Europe/Paris')::date + fin END
  FROM (VALUES
    ('1', 'e2', 'coach',  'active',   NULL, NULL,           NULL,      NULL::int),
    ('1', '10', 'member', 'active',   'a1', 'active',       NULL,      NULL),
    ('1', '11', 'member', 'active',   'a1', 'active',       NULL,      10),
    ('1', '12', 'member', 'active',   'a1', 'active',       'sub_pcd', NULL),
    ('1', '13', 'member', 'active',   'a0', 'active',       NULL,      NULL),
    ('1', '14', 'member', 'active',   'a1', 'active',       NULL,      NULL),
    ('1', '15', 'member', 'active',   'a1', 'active',       NULL,      NULL),
    ('2', '20', 'member', 'active',   'b1', 'active',       NULL,      5),
    ('2', '21', 'member', 'active',   'b1', 'active',       NULL,      -3),
    ('3', '30', 'member', 'active',   'c1', 'active',       NULL,      2),
    ('1', '40', 'member', 'inactive', 'a1', 'pending_cash', NULL,      NULL),
    ('1', '41', 'member', 'inactive', 'a1', 'pending_cash', NULL,      20),
    ('1', '43', 'member', 'inactive', 'a1', 'pending_cash', NULL,      200),
    ('1', '50', 'member', 'inactive', 'a0', 'pending_cash', NULL,      NULL),
    ('1', '51', 'member', 'inactive', NULL, 'pending_cash', NULL,      20),
    ('1', '45', 'member', 'inactive', NULL, 'pending_cash', NULL,      50)
  ) v(b, m, r, st, p, ss, sub, fin);
-- Journal d'avant 20270151 (sans période) : une adhésion pour 14, un programme pour 15.
INSERT INTO public.programs (id, title, box_id, owner_id, price_cents, type, invite_code)
VALUES ('00000000-0000-4000-f9c1-000000000001', 'Programme PCD', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-0000000000e0',
        2000, 'fixed', 'PCDPRG');
INSERT INTO public.box_cash_payments (id, box_id, member_id, plan_id, plan_name, amount_cents, source, program_id) VALUES
  ('00000000-0000-4000-e9c1-000000000014', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-000000000014',
   '00000000-0000-4000-c9c1-0000000000a1', 'Mensuel A', 5000, 'renewal', NULL),
  ('00000000-0000-4000-e9c1-000000000015', '00000000-0000-4000-b9c1-000000000001', '00000000-0000-4000-a9c1-000000000015',
   NULL, 'Programme PCD', 2000, 'program', '00000000-0000-4000-f9c1-000000000001');
-- Une ligne avec période, pour les verrous.
INSERT INTO public.box_cash_payments (id, box_id, member_id, plan_id, plan_name, amount_cents, source,
                                      period_months, access_from, access_until) VALUES
  ('00000000-0000-4000-e9c1-0000000000aa', '00000000-0000-4000-b9c1-000000000002', NULL,
   '00000000-0000-4000-c9c1-0000000000b1', 'Mensuel B', 4000, 'renewal', 1, '2026-10-01', '2026-10-31');
-- Invitations « mode box » (jeton brut = suffixe) : 01 sans compte, 40 et 41
-- acceptées sans encaissement, 04 déjà encaissée, 42 et 43 encaissées à
-- consommer.
INSERT INTO public.box_invitations (id, box_id, email, plan_id, payment_mode, cash_collected, token_hash, status,
                                    expires_at, accepted_by, cash_access_until)
SELECT ('00000000-0000-4000-d9c1-0000000000' || i)::uuid, '00000000-0000-4000-b9c1-000000000001', 'pcd-inv-' || i || '@test.invalid',
       CASE WHEN pl IS NULL THEN NULL ELSE ('00000000-0000-4000-c9c1-0000000000' || pl)::uuid END,
       'box', enc, encode(sha256(('pcd-tok-' || i)::bytea), 'hex'), st,
       now() + interval '7 days', CASE WHEN acc IS NULL THEN NULL ELSE ('00000000-0000-4000-a9c1-0000000000' || acc)::uuid END,
       CASE WHEN fin IS NULL THEN NULL ELSE (now() AT TIME ZONE 'Europe/Paris')::date + fin END
  FROM (VALUES
    ('01', false, 'pending',  NULL, NULL::int, 'a1'),
    ('40', false, 'accepted', '40', NULL,      'a1'),
    ('41', false, 'accepted', '41', NULL,      'a1'),
    ('04', true,  'pending',  NULL, NULL,      'a1'),
    ('42', true,  'pending',  NULL, 30,        'a1'),
    ('43', true,  'pending',  NULL, 30,        'a1'),
    ('05', false, 'pending',  NULL, NULL,      'a0'),
    ('06', false, 'pending',  NULL, NULL,      NULL),
    ('50', false, 'accepted', '50', NULL,      'a0'),
    ('51', false, 'accepted', '51', NULL,      NULL),
    ('44', true,  'pending',  NULL, NULL,      'a0'),
    ('45', true,  'pending',  NULL, NULL,      NULL)
  ) v(i, enc, st, acc, fin, pl);
UPDATE public.box_invitations SET email = 'pcd-' || right(id::text, 2) || '@test.invalid'
 WHERE id IN ('00000000-0000-4000-d9c1-000000000042', '00000000-0000-4000-d9c1-000000000043',
              '00000000-0000-4000-d9c1-000000000044', '00000000-0000-4000-d9c1-000000000045');

CREATE FUNCTION pg_temp.u(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a9c1-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.b(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-b9c1-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.inv(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-d9c1-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.bm(m text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.box_members WHERE member_id = pg_temp.u(m) $$;
CREATE FUNCTION pg_temp.auj() RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Europe/Paris')::date $$;
CREATE FUNCTION pg_temp.fin(d date, mois int) RETURNS date LANGUAGE sql IMMUTABLE AS $$ SELECT (d + make_interval(months => mois))::date - 1 $$;
CREATE FUNCTION pg_temp.def(f text) RETURNS text LANGUAGE sql AS $$ SELECT pg_get_functiondef(f::regprocedure) $$;
-- Rejoue `f` avec un remplacement dans sa définition ; échoue s'il ne change rien.
CREATE FUNCTION pg_temp.muter(f text, de text, vers text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d text := pg_temp.def(f);
BEGIN
  IF strpos(d, de) = 0 THEN RAISE EXCEPTION 'mutation sans effet sur % : « % » absent', f, de; END IF;
  EXECUTE replace(d, de, vers);
END $$;

-- Joue `p_sql` sous l'identité `p_qui` (suffixe, « service », « anon » ou
-- « admin » pour le superutilisateur), puis lit `p_lecture` en superutilisateur,
-- et annule les deux. Rend « résultat|lecture », ou « SQLSTATE: message ».
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
    IF p_sql ~* '^\s*(insert|update|delete)' THEN
      EXECUTE p_sql;
    ELSE
      EXECUTE p_sql INTO v;
    END IF;
    PERFORM set_config('role', 'none', true);
    IF p_lecture IS NOT NULL THEN EXECUTE p_lecture INTO w; END IF;
    RAISE EXCEPTION USING ERRCODE = 'PCD00', MESSAGE = coalesce(v, 'OK') || CASE WHEN p_lecture IS NULL THEN '' ELSE '|' || coalesce(w, '') END;
  EXCEPTION
    WHEN SQLSTATE 'PCD00' THEN r := SQLERRM;
    WHEN OTHERS THEN r := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN r;
END $$;
-- Code d'erreur métier (« COUNTER_RENEWAL_DISABLED »…) ou le texte brut.
CREATE FUNCTION pg_temp.code(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN v ~ '^\w{5}: [A-Z_]+:' THEN split_part(split_part(v, ': ', 2), ':', 1) ELSE v END;
$$;
-- Encaissement de `m` par `qui` (`mois` NULL : appel à un argument). Rend
-- « montant:début:fin:fin du membre:mois au journal » ou le code d'erreur.
CREATE FUNCTION pg_temp.encaisser(qui text, m text, mois int) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.code(pg_temp.jouer(qui,
    format('SELECT public.record_member_cash_payment(%L%s)::text', pg_temp.bm(m), CASE WHEN mois IS NULL THEN '' ELSE ', ' || mois END),
    format('SELECT c.amount_cents || '':'' || c.access_from || '':'' || c.access_until || '':'' || bm.cash_access_until || '':'' || c.period_months
              FROM public.box_cash_payments c JOIN public.box_members bm ON bm.member_id = c.member_id AND bm.box_id = c.box_id
             WHERE c.member_id = %L AND c.period_months IS NOT NULL ORDER BY c.collected_at DESC, c.access_until DESC LIMIT 1', pg_temp.u(m))));
$$;
CREATE FUNCTION pg_temp.lecture(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN strpos(v, '|') > 0 THEN split_part(v, '|', 2) ELSE v END;
$$;
CREATE FUNCTION pg_temp.attendu(montant int, debut date, mois int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT montant || ':' || debut || ':' || pg_temp.fin(debut, mois) || ':' || pg_temp.fin(debut, mois) || ':' || mois;
$$;
CREATE FUNCTION pg_temp.periode(fin date, mois int) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT access_from || ':' || access_until INTO v FROM internal.periode_comptoir(fin, mois);
  RETURN v;
EXCEPTION WHEN OTHERS THEN RETURN pg_temp.code(SQLSTATE || ': ' || SQLERRM);
END $$;
-- Paiement de l'invitation `i` par G. Rend « fin invitation:fin membre:mois au journal:membre au journal ».
CREATE FUNCTION pg_temp.payer(i text, mois int, m text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.jouer('e0',
    format('SELECT public.mark_box_invitation_paid(%L%s)::text', pg_temp.inv(i), CASE WHEN mois IS NULL THEN '' ELSE ', ' || mois END),
    format('SELECT coalesce(i.cash_access_until::text, ''-'') || '':'' || coalesce((SELECT bm.cash_access_until::text FROM public.box_members bm WHERE bm.box_id = i.box_id AND bm.member_id = %L), ''-'')
                   || '':'' || coalesce((SELECT c.period_months || '':'' || coalesce(right(c.member_id::text, 2), ''-'') || '':'' || c.amount_cents FROM public.box_cash_payments c WHERE c.invitation_id = i.id), ''-'')
              FROM public.box_invitations i WHERE i.id = %L', pg_temp.u(m), pg_temp.inv(i)));
$$;
-- Paiement de l'invitation `i` par G, puis « statut:fin » du membre `m`.
CREATE FUNCTION pg_temp.payer_statut(i text, m text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.lecture(pg_temp.jouer('e0', format('SELECT public.mark_box_invitation_paid(%L)::text', pg_temp.inv(i)),
    format('SELECT status || '':'' || coalesce(cash_access_until::text, ''-'') FROM public.box_members WHERE box_id = %L AND member_id = %L', pg_temp.b(1), pg_temp.u(m))));
$$;
-- Consommation de l'invitation `i` par le compte `m`. Rend « statut:fin du membre ».
CREATE FUNCTION pg_temp.consommer(i text, m text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.lecture(pg_temp.jouer('admin',
    format('SELECT public._consume_box_invitation(%L, %L)->>''ok''', 'pcd-tok-' || i, pg_temp.u(m)),
    format('SELECT status || '':'' || coalesce(cash_access_until::text, ''-'') FROM public.box_members WHERE box_id = %L AND member_id = %L', pg_temp.b(1), pg_temp.u(m))));
$$;
-- Création par G d'une invitation encaissée (`mois` NULL : paramètre omis).
-- Rend « fin invitation:mois au journal:montant » .
CREATE FUNCTION pg_temp.creer(email text, mode text, encaissee boolean, mois int, formule text DEFAULT 'a1') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.lecture(pg_temp.jouer('e0',
    format('SELECT public.create_box_invitation(p_box_id => %L, p_email => %L, p_plan_id => %L, p_payment_mode => %L, p_cash_collected => %L%s)->>''ok''',
           pg_temp.b(1), email, CASE WHEN formule IS NULL THEN NULL ELSE '00000000-0000-4000-c9c1-0000000000' || formule END, mode, encaissee, CASE WHEN mois IS NULL THEN '' ELSE ', p_cash_months => ' || mois END),
    format('SELECT coalesce(i.cash_access_until::text, ''-'') || '':'' || coalesce((SELECT c.period_months || '':'' || c.amount_cents || '':'' || c.access_from || '':'' || c.access_until FROM public.box_cash_payments c WHERE c.invitation_id = i.id), ''-'')
              FROM public.box_invitations i WHERE i.email = %L', email)));
$$;

DO $t$
DECLARE
  v text;
  v_cas record;
  t date := pg_temp.auj();
BEGIN
  -- ── S : structure ──────────────────────────────────────────────────────────
  IF (SELECT string_agg(table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '-'), ', ' ORDER BY table_name COLLATE "C", column_name COLLATE "C")
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) IN (('box_members', 'cash_access_until'), ('boxes', 'allow_counter_renewal'),
              ('box_invitations', 'cash_access_until'), ('box_cash_payments', 'period_months'),
              ('box_cash_payments', 'access_from'), ('box_cash_payments', 'access_until')))
     IS DISTINCT FROM 'box_cash_payments.access_from date YES -, box_cash_payments.access_until date YES -, box_cash_payments.period_months smallint YES -, box_invitations.cash_access_until date YES -, box_members.cash_access_until date YES -, boxes.allow_counter_renewal boolean NO false' THEN
    RAISE EXCEPTION 'S : colonnes';
  END IF;
  IF (SELECT string_agg(conname || ' ' || pg_get_constraintdef(oid), ' | ' ORDER BY conname COLLATE "C") FROM pg_constraint
       WHERE conrelid = 'public.box_cash_payments'::regclass AND conname IN ('box_cash_payments_period_months_check', 'box_cash_payments_periode_complete'))
     IS DISTINCT FROM 'box_cash_payments_period_months_check CHECK ((period_months = ANY (ARRAY[1, 3, 12]))) | box_cash_payments_periode_complete CHECK ((((period_months IS NULL) AND (access_from IS NULL) AND (access_until IS NULL)) OR ((period_months IS NOT NULL) AND (access_from IS NOT NULL) AND (access_until IS NOT NULL) AND (access_until >= access_from))))' THEN
    RAISE EXCEPTION 'S : contraintes du journal';
  END IF;
  IF (SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'trg_boxes_garde_renouvellement_comptoir') IS DISTINCT FROM
     'CREATE TRIGGER trg_boxes_garde_renouvellement_comptoir BEFORE INSERT OR UPDATE OF allow_counter_renewal ON public.boxes FOR EACH ROW EXECUTE FUNCTION internal.garder_reglage_comptoir_box()' THEN
    RAISE EXCEPTION 'S : déclencheur de la garde du réglage';
  END IF;
  FOR v_cas IN SELECT * FROM (VALUES ('record_member_cash_payment'), ('mark_box_invitation_paid'), ('create_box_invitation'),
                                     ('_log_box_cash_payment'), ('periode_comptoir'), ('box_vend_en_ligne')) x(f) LOOP
    IF (SELECT count(*) FROM pg_proc WHERE proname = v_cas.f) <> 1 THEN
      RAISE EXCEPTION 'S : % versions de %', (SELECT count(*) FROM pg_proc WHERE proname = v_cas.f), v_cas.f;
    END IF;
  END LOOP;
  FOR v_cas IN SELECT * FROM (VALUES
    ('public.record_member_cash_payment(uuid,integer)'), ('public.mark_box_invitation_paid(uuid,integer)'),
    ('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)'),
    ('public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)')) x(sig) LOOP
    IF NOT (SELECT prosecdef AND proconfig = ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid = v_cas.sig::regprocedure) THEN
      RAISE EXCEPTION 'S : % pas SECURITY DEFINER à search_path fixé', v_cas.sig;
    END IF;
  END LOOP;
  -- Le verrou de ligne : deux encaissements simultanés ne partent pas du même début.
  IF strpos(pg_temp.def('public.record_member_cash_payment(uuid,integer)'), 'WHERE id = p_box_member_id FOR UPDATE;') = 0 THEN
    RAISE EXCEPTION 'S : record_member_cash_payment ne verrouille plus la ligne du membre';
  END IF;
  -- Définitions de la migration, épinglées (search_path de la prod).
  SELECT string_agg(a.fn || ' ' || md5(pg_temp.def(a.fn)), ', ') INTO v
  FROM (VALUES
    ('public.record_member_cash_payment(uuid,integer)', '7789384fc790ab1d7b42c70df8e96424'),
    ('public.mark_box_invitation_paid(uuid,integer)', 'd4d61e9755478b4c23db84f54a43bf3b'),
    ('public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)', 'd2e9ef2e96701fbf9d2e1e62e6c72672'),
    ('public.reject_cash_payment_rewrite()', 'ae7c75d48949a602b6e6994bbd2aade6'),
    ('internal.garder_facturation_membre()', '483768906753de48dd9b48454f877f23'),
    ('public._consume_box_invitation(text,uuid)', '5d1e2581644640a3bb2f86c14e85a2dd'),
    ('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)', '8b090621d461d499b05afe334d9a8f8f'),
    ('internal.periode_comptoir(date,integer)', '946784e27c0e4c50feec61c0bc456dbb'),
    ('internal.box_vend_en_ligne(uuid)', 'f5d67d93a900664e3297742237f91d6f'),
    ('internal.garder_reglage_comptoir_box()', '36b6becbd14b979fc34b841bc271d4c2')
  ) a(fn, attendu)
  WHERE md5(pg_temp.def(a.fn)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'S : définitions différentes du fichier : %', v; END IF;
  IF (SELECT md5(pg_get_triggerdef(oid)) FROM pg_trigger WHERE tgname = 'trg_box_members_garde_facturation') IS DISTINCT FROM '3aec5ba9a7b7ba60ea9ec4423fbcf71e' THEN
    RAISE EXCEPTION 'S : déclencheur de la garde de facturation (%)', (SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'trg_box_members_garde_facturation');
  END IF;

  -- ── P : calcul de la période ───────────────────────────────────────────────
  FOR v_cas IN SELECT * FROM (VALUES
    ('aucune fin, 1 mois',   NULL::date,         1,  t::text || ':' || pg_temp.fin(t, 1)),
    ('aucune fin, 3 mois',   NULL,               3,  t::text || ':' || pg_temp.fin(t, 3)),
    ('aucune fin, 12 mois',  NULL,               12, t::text || ':' || pg_temp.fin(t, 12)),
    ('accès en cours',       t + 10,             1,  (t + 11)::text || ':' || pg_temp.fin(t + 11, 1)),
    ('fin aujourd''hui',     t,                  1,  (t + 1)::text || ':' || pg_temp.fin(t + 1, 1)),
    ('accès échu',           t - 1,              3,  t::text || ':' || pg_temp.fin(t, 3)),
    -- 31/01 + 1 mois = 28/02 (année non bissextile), − 1 jour = 27/02.
    ('31/01',                DATE '2099-01-30',  1,  '2099-01-31:2099-02-27'),
    ('31/01 bissextile',     DATE '2096-01-30',  1,  '2096-01-31:2096-02-28'),
    ('13/10',                DATE '2099-10-12',  1,  '2099-10-13:2099-11-12'),
    ('durée 2',              NULL,               2,  'INVALID_DURATION'),
    ('durée 0',              NULL,               0,  'INVALID_DURATION'),
    ('durée absente',        NULL,               NULL, 'INVALID_DURATION')
  ) x(cas, fin, mois, attendu) LOOP
    v := pg_temp.periode(v_cas.fin, v_cas.mois);
    IF v IS DISTINCT FROM v_cas.attendu THEN RAISE EXCEPTION 'P : % → % (attendu %)', v_cas.cas, v, v_cas.attendu; END IF;
  END LOOP;

  -- ── V : la box vend-elle en ligne ? ────────────────────────────────────────
  IF (SELECT string_agg(n || '=' || internal.box_vend_en_ligne(pg_temp.b(n)), ',' ORDER BY n) FROM generate_series(1, 5) n)
     IS DISTINCT FROM '1=true,2=false,3=true,4=false,5=false' THEN
    RAISE EXCEPTION 'V : box_vend_en_ligne (%)', (SELECT string_agg(n || '=' || internal.box_vend_en_ligne(pg_temp.b(n)), ',' ORDER BY n) FROM generate_series(1, 5) n);
  END IF;

  -- ── E : record_member_cash_payment ─────────────────────────────────────────
  FOR v_cas IN SELECT * FROM (VALUES
    ('premier encaissement, 1 mois',            'e0', '10', 1,    pg_temp.attendu(5000, t, 1)),
    ('premier encaissement, 3 mois',            'e0', '10', 3,    pg_temp.attendu(15000, t, 3)),
    ('premier encaissement, 12 mois',           'e0', '10', 12,   pg_temp.attendu(60000, t, 12)),
    ('appel à un argument = 1 mois',            'e0', '10', NULL, pg_temp.attendu(5000, t, 1)),
    ('seul un programme journalisé',            'e0', '15', 1,    pg_temp.attendu(5000, t, 1)),
    ('renouvellement, fin d''accès',            'e0', '11', 1,    'COUNTER_RENEWAL_DISABLED'),
    ('renouvellement, journal d''adhésion',     'e0', '14', 1,    'COUNTER_RENEWAL_DISABLED'),
    ('box qui ne vend pas en ligne, en cours',  'e3', '20', 1,    pg_temp.attendu(4000, t + 6, 1)),
    ('box qui ne vend pas en ligne, échu',      'e3', '21', 3,    pg_temp.attendu(12000, t, 3)),
    ('renouvellement autorisé par la box',      'e4', '30', 1,    pg_temp.attendu(3000, t + 3, 1)),
    ('abonné Stripe',                           'e0', '12', 1,    'STRIPE_MEMBER'),
    ('formule à 0 €',                           'e0', '13', 1,    'NO_PLAN_PRICE'),
    ('gérant d''une autre box',                 'e3', '10', 1,    'FORBIDDEN'),
    ('coach de la box',                         'e2', '10', 1,    'FORBIDDEN'),
    ('durée invalide',                          'e0', '10', 2,    'INVALID_DURATION')
  ) x(cas, qui, m, mois, attendu) LOOP
    v := pg_temp.lecture(pg_temp.encaisser(v_cas.qui, v_cas.m, v_cas.mois));
    IF v IS DISTINCT FROM v_cas.attendu THEN RAISE EXCEPTION 'E : % → % (attendu %)', v_cas.cas, v, v_cas.attendu; END IF;
  END LOOP;
  -- Le retour de l'appel.
  v := split_part(pg_temp.jouer('e0', format('SELECT (SELECT string_agg(k, '','' ORDER BY k) FROM jsonb_object_keys(public.record_member_cash_payment(%L, 3)) k)', pg_temp.bm('10'))), '|', 1);
  IF v IS DISTINCT FROM 'access_from,access_until,amount_cents,ok,payment_id' THEN RAISE EXCEPTION 'E : clés du retour (%)', v; END IF;
  -- Statut du membre mis à jour comme avant : actif, comptoir.
  v := pg_temp.lecture(pg_temp.jouer('e3', format('SELECT public.record_member_cash_payment(%L)::text', pg_temp.bm('21')),
         format('SELECT status || '':'' || subscription_status || '':'' || payment_method_type FROM public.box_members WHERE id = %L', pg_temp.bm('21'))));
  IF v IS DISTINCT FROM 'active:active:cash' THEN RAISE EXCEPTION 'E : membre après encaissement (%)', v; END IF;
  -- Refusé : rien n'est journalisé.
  IF pg_temp.jouer('e0', format('SELECT public.record_member_cash_payment(%L)::text', pg_temp.bm('11')),
                   'SELECT count(*)::text FROM public.box_cash_payments') NOT LIKE '23514: COUNTER_RENEWAL_DISABLED:%'
     OR (SELECT count(*) FROM public.box_cash_payments) <> 3 THEN
    RAISE EXCEPTION 'E : un refus a journalisé';
  END IF;
  -- anon n'a pas l'EXECUTE.
  IF pg_temp.jouer('anon', format('SELECT public.record_member_cash_payment(%L)::text', pg_temp.bm('10'))) NOT LIKE '42501:%' THEN
    RAISE EXCEPTION 'E : anon encaisse';
  END IF;

  -- ── I : mark_box_invitation_paid ───────────────────────────────────────────
  FOR v_cas IN SELECT * FROM (VALUES
    ('sans compte, 1 mois',                  '01', 1,    NULL, pg_temp.fin(t, 1) || ':-:1:-:5000'),
    ('sans compte, appel à un argument',     '01', NULL, NULL, pg_temp.fin(t, 1) || ':-:1:-:5000'),
    ('avec compte, 3 mois',                  '40', 3,    '40', '-:' || pg_temp.fin(t, 3) || ':3:40:15000'),
    -- A vend en ligne et refuse le renouvellement : sans effet sur un premier paiement.
    ('avec compte et période, prolongation', '41', 1,    '41', '-:' || pg_temp.fin(t + 21, 1) || ':1:41:5000')
  ) x(cas, i, mois, m, attendu) LOOP
    v := pg_temp.lecture(pg_temp.payer(v_cas.i, v_cas.mois, v_cas.m));
    IF v IS DISTINCT FROM v_cas.attendu THEN RAISE EXCEPTION 'I : % → % (attendu %)', v_cas.cas, v, v_cas.attendu; END IF;
  END LOOP;
  v := split_part(pg_temp.payer('40', 1, '40'), '|', 1);
  IF NOT (v::jsonb ?& ARRAY['ok', 'activated', 'payment_id', 'access_from', 'access_until']) OR (v::jsonb->>'activated') <> 'true' THEN
    RAISE EXCEPTION 'I : retour (%)', v;
  END IF;
  v := pg_temp.payer('04', 1);
  IF split_part(v, '|', 1) IS DISTINCT FROM '{"ok": true, "already_collected": true}' OR split_part(v, '|', 2) <> '-:-:-' THEN
    RAISE EXCEPTION 'I : déjà encaissée (%)', v;
  END IF;
  IF pg_temp.code(pg_temp.payer('01', 2)) <> 'INVALID_DURATION' THEN RAISE EXCEPTION 'I : durée invalide acceptée'; END IF;
  -- Formule à 0 € ou absente : ni période, ni fin, ni journal ; le membre est activé.
  FOR v_cas IN SELECT * FROM (VALUES
    ('formule à 0 €, sans compte',      '05', NULL, '-:-:-'),
    ('sans formule, sans compte',       '06', NULL, '-:-:-'),
    ('formule à 0 €, avec compte',      '50', '50', '-:-:-'),
    ('sans formule, avec compte et fin', '51', '51', '-:' || (t + 20) || ':-')
  ) x(cas, i, m, attendu) LOOP
    v := pg_temp.payer(v_cas.i, 3, v_cas.m);
    IF pg_temp.lecture(v) IS DISTINCT FROM v_cas.attendu THEN RAISE EXCEPTION 'I : % → % (attendu %)', v_cas.cas, pg_temp.lecture(v), v_cas.attendu; END IF;
    IF (split_part(v, '|', 1)::jsonb ->> 'ok') <> 'true' OR (split_part(v, '|', 1)::jsonb -> 'access_from') <> 'null'::jsonb
       OR (split_part(v, '|', 1)::jsonb -> 'access_until') <> 'null'::jsonb OR (split_part(v, '|', 1)::jsonb -> 'payment_id') <> 'null'::jsonb THEN
      RAISE EXCEPTION 'I : % → retour %', v_cas.cas, split_part(v, '|', 1);
    END IF;
  END LOOP;
  IF pg_temp.payer_statut('50', '50') IS DISTINCT FROM 'active:-' OR pg_temp.payer_statut('51', '51') IS DISTINCT FROM 'active:' || (t + 20) THEN
    RAISE EXCEPTION 'I : membre gratuit non activé ou fin modifiée (%, %)', pg_temp.payer_statut('50', '50'), pg_temp.payer_statut('51', '51');
  END IF;
  v := pg_temp.lecture(pg_temp.jouer('e0', format('SELECT public.mark_box_invitation_paid(%L)::text', pg_temp.inv('05')),
         format('SELECT cash_collected::text FROM public.box_invitations WHERE id = %L', pg_temp.inv('05'))));
  IF v IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'I : invitation gratuite non notée encaissée (%)', v; END IF;
  IF pg_temp.code(pg_temp.jouer('e3', format('SELECT public.mark_box_invitation_paid(%L)::text', pg_temp.inv('01')))) <> 'FORBIDDEN' THEN
    RAISE EXCEPTION 'I : gérant d''une autre box';
  END IF;

  -- ── K : consommation de l'invitation encaissée ─────────────────────────────
  v := pg_temp.consommer('42', '42');
  IF v IS DISTINCT FROM 'active:' || (t + 30) THEN RAISE EXCEPTION 'K : création de l''adhésion (%)', v; END IF;
  v := pg_temp.consommer('43', '43');
  IF v IS DISTINCT FROM 'active:' || (t + 200) THEN RAISE EXCEPTION 'K : mise à jour, fin raccourcie (%)', v; END IF;
  v := pg_temp.consommer('44', '44');
  IF v IS DISTINCT FROM 'active:-' THEN RAISE EXCEPTION 'K : invitation à 0 €, une fin est posée (%)', v; END IF;
  v := pg_temp.consommer('45', '45');
  IF v IS DISTINCT FROM 'active:' || (t + 50) THEN RAISE EXCEPTION 'K : invitation sans formule, fin modifiée (%)', v; END IF;

  -- ── C : création d'une invitation déjà encaissée ───────────────────────────
  v := pg_temp.creer('pcd-c1@test.invalid', 'box', true, 3);
  IF v IS DISTINCT FROM pg_temp.fin(t, 3) || ':3:15000:' || t || ':' || pg_temp.fin(t, 3) THEN RAISE EXCEPTION 'C : encaissée, 3 mois (%)', v; END IF;
  v := pg_temp.creer('pcd-c2@test.invalid', 'box', true, NULL);
  IF v IS DISTINCT FROM pg_temp.fin(t, 1) || ':1:5000:' || t || ':' || pg_temp.fin(t, 1) THEN RAISE EXCEPTION 'C : encaissée, durée par défaut (%)', v; END IF;
  v := pg_temp.creer('pcd-c3@test.invalid', 'box', false, 3);
  IF v IS DISTINCT FROM '-:-' THEN RAISE EXCEPTION 'C : non encaissée (%)', v; END IF;
  v := pg_temp.creer('pcd-c4@test.invalid', 'stripe', true, 1);
  IF v IS DISTINCT FROM '-:-' THEN RAISE EXCEPTION 'C : mode Stripe (%)', v; END IF;
  IF pg_temp.code(pg_temp.creer('pcd-c5@test.invalid', 'box', true, 6)) <> 'INVALID_DURATION' THEN RAISE EXCEPTION 'C : durée invalide acceptée'; END IF;
  v := pg_temp.creer('pcd-c6@test.invalid', 'box', true, 3, 'a0');
  IF v IS DISTINCT FROM '-:-' THEN RAISE EXCEPTION 'C : encaissée à 0 € (%)', v; END IF;
  v := pg_temp.creer('pcd-c7@test.invalid', 'box', true, 3, NULL);
  IF v IS DISTINCT FROM '-:-' THEN RAISE EXCEPTION 'C : encaissée sans formule (%)', v; END IF;

  -- ── L : verrous ────────────────────────────────────────────────────────────
  -- La clé serveur n'a pas l'UPDATE du journal ; le verrou, lui, tient pour
  -- tout rôle, superutilisateur compris.
  FOR v_cas IN SELECT * FROM (VALUES
    ('service', 'period_months = 3',              '42501: permission denied%'),
    ('admin',   'period_months = 3',              '42501: APPEND_ONLY:%'),
    ('admin',   'access_from = ''2026-09-30''',   '42501: APPEND_ONLY:%'),
    ('admin',   'access_until = ''2026-11-30''',  '42501: APPEND_ONLY:%')
  ) x(qui, ecr, attendu) LOOP
    v := pg_temp.jouer(v_cas.qui, format('UPDATE public.box_cash_payments SET %s WHERE id = ''00000000-0000-4000-e9c1-0000000000aa''', v_cas.ecr));
    IF v NOT LIKE v_cas.attendu THEN RAISE EXCEPTION 'L : % réécrit la période (%) : %', v_cas.qui, v_cas.ecr, v; END IF;
  END LOOP;
  FOR v_cas IN SELECT * FROM (VALUES ('1, NULL, NULL'), ('NULL, ''2026-10-01'', ''2026-10-31'''), ('2, ''2026-10-01'', ''2026-11-30'''), ('1, ''2026-10-31'', ''2026-10-01''')) x(vals) LOOP
    v := pg_temp.jouer('admin', format('INSERT INTO public.box_cash_payments (box_id, plan_id, plan_name, amount_cents, source, period_months, access_from, access_until)
                                         VALUES (%L, ''00000000-0000-4000-c9c1-0000000000b1'', ''x'', 100, ''renewal'', %s)', pg_temp.b(2), v_cas.vals));
    IF v NOT LIKE '23514:%' THEN RAISE EXCEPTION 'L : période incohérente acceptée (%) : %', v_cas.vals, v; END IF;
  END LOOP;
  v := pg_temp.jouer('e0', format('UPDATE public.box_members SET cash_access_until = %L WHERE id = %L', t + 400, pg_temp.bm('10')));
  IF v NOT LIKE '42501: MEMBRE_FACTURATION_RESERVEE:%' THEN RAISE EXCEPTION 'L : le gérant écrit cash_access_until (%)', v; END IF;
  v := pg_temp.jouer('service', format('UPDATE public.box_members SET cash_access_until = %L WHERE id = %L', t + 400, pg_temp.bm('10')),
                     format('SELECT cash_access_until::text FROM public.box_members WHERE id = %L', pg_temp.bm('10')));
  IF v IS DISTINCT FROM 'OK|' || (t + 400) THEN RAISE EXCEPTION 'L : la clé serveur n''écrit pas cash_access_until (%)', v; END IF;
  v := pg_temp.jouer('e0', format('UPDATE public.boxes SET allow_counter_renewal = true WHERE id = %L', pg_temp.b(1)));
  IF v NOT LIKE '42501: BOX_REGLAGE_RESERVE:%' THEN RAISE EXCEPTION 'L : le gérant écrit allow_counter_renewal (%)', v; END IF;
  v := pg_temp.jouer('e0', format('UPDATE public.boxes SET tagline = ''x'' WHERE id = %L', pg_temp.b(1)),
                     format('SELECT tagline FROM public.boxes WHERE id = %L', pg_temp.b(1)));
  IF v IS DISTINCT FROM 'OK|x' THEN RAISE EXCEPTION 'L : la garde bloque les autres colonnes de boxes (%)', v; END IF;
  v := pg_temp.jouer('service', format('UPDATE public.boxes SET allow_counter_renewal = true WHERE id = %L', pg_temp.b(1)),
                     format('SELECT allow_counter_renewal::text FROM public.boxes WHERE id = %L', pg_temp.b(1)));
  IF v IS DISTINCT FROM 'OK|true' THEN RAISE EXCEPTION 'L : la clé serveur n''écrit pas allow_counter_renewal (%)', v; END IF;

  -- ── D : droits ─────────────────────────────────────────────────────────────
  SELECT string_agg(f || '=' || coalesce(r, ''), ' ' ORDER BY f COLLATE "C") INTO v FROM (
    SELECT p.oid::regprocedure::text f,
           (SELECT string_agg(ro, ',' ORDER BY ro) FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) ro
             WHERE has_function_privilege(ro, p.oid, 'EXECUTE')) r
      FROM pg_proc p
     WHERE p.proname IN ('record_member_cash_payment', 'mark_box_invitation_paid', 'create_box_invitation', '_log_box_cash_payment',
                         'periode_comptoir', 'box_vend_en_ligne', 'garder_reglage_comptoir_box')) s;
  IF v IS DISTINCT FROM '_log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)= create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)=authenticated,service_role internal.box_vend_en_ligne(uuid)= internal.garder_reglage_comptoir_box()= internal.periode_comptoir(date,integer)= mark_box_invitation_paid(uuid,integer)=authenticated,service_role record_member_cash_payment(uuid,integer)=authenticated,service_role' THEN
    RAISE EXCEPTION 'D : droits EXECUTE %', v;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
              WHERE p.proname IN ('record_member_cash_payment', 'mark_box_invitation_paid', 'create_box_invitation', '_log_box_cash_payment',
                                  'periode_comptoir', 'box_vend_en_ligne', 'garder_reglage_comptoir_box') AND a.grantee = 0) THEN
    RAISE EXCEPTION 'D : EXECUTE accordé à PUBLIC';
  END IF;
  IF (SELECT string_agg(obj_description(p.oid, 'pg_proc'), ' | ' ORDER BY p.proname COLLATE "C") FROM pg_proc p
       WHERE p.proname IN ('record_member_cash_payment', 'mark_box_invitation_paid', 'create_box_invitation')) IS DISTINCT FROM
     'Crée une invitation nominative pour une box administrée par l''appelant. Renvoie le jeton en clair une seule fois. | '
     || 'Marque une invitation « mode box » comme encaissée au comptoir, journalise le paiement et active le membre s''il a déjà créé son compte. | '
     || 'Journalise l''échéance comptoir d''un membre (montant lu sur sa formule). Admin de la box uniquement, refusée sur un abonné Stripe.' THEN
    RAISE EXCEPTION 'D : commentaires';
  END IF;
END $t$;

-- ── M : mutations ─────────────────────────────────────────────────────────────
DO $t$
DECLARE
  v text;
  t date := pg_temp.auj();
  r constant text := 'public.record_member_cash_payment(uuid,integer)';
  k constant text := 'public.mark_box_invitation_paid(uuid,integer)';
  p constant text := 'internal.periode_comptoir(date,integer)';
  d text;
BEGIN
  -- P : prolongation au lendemain, « − 1 jour », durées permises.
  d := pg_temp.def(p);
  PERFORM pg_temp.muter(p, 'THEN p_fin_actuelle + 1 ELSE', 'THEN p_fin_actuelle ELSE');
  IF pg_temp.periode(t + 10, 1) = (t + 11) || ':' || pg_temp.fin(t + 11, 1) THEN RAISE EXCEPTION 'M : P prolongation ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(p, '::date - 1;', '::date;');
  IF pg_temp.periode(DATE '2099-01-30', 1) = '2099-01-31:2099-02-27' THEN RAISE EXCEPTION 'M : P 31/01 ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(p, 'p_mois NOT IN (1, 3, 12)', 'false');
  IF pg_temp.periode(NULL, 2) = 'INVALID_DURATION' THEN RAISE EXCEPTION 'M : P durée invalide ne prouve rien'; END IF;
  EXECUTE d;

  -- V : chaque condition de box_vend_en_ligne.
  d := pg_temp.def('internal.box_vend_en_ligne(uuid)');
  PERFORM pg_temp.muter('internal.box_vend_en_ligne(uuid)', 'AND b.stripe_onboarding_complete IS TRUE', '');
  IF NOT internal.box_vend_en_ligne(pg_temp.b(4)) THEN RAISE EXCEPTION 'M : V onboarding ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('internal.box_vend_en_ligne(uuid)', 'AND mp.is_active AND mp.stripe_price_id IS NOT NULL', 'AND mp.is_active');
  IF NOT internal.box_vend_en_ligne(pg_temp.b(5)) THEN RAISE EXCEPTION 'M : V prix Stripe ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('internal.box_vend_en_ligne(uuid)', 'AND mp.is_active AND', 'AND');
  IF NOT internal.box_vend_en_ligne(pg_temp.b(5)) THEN RAISE EXCEPTION 'M : V formule active ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('internal.box_vend_en_ligne(uuid)', 'AND b.stripe_account_id IS NOT NULL', '');
  UPDATE public.boxes SET stripe_account_id = NULL, stripe_onboarding_complete = true WHERE id = pg_temp.b(2);
  UPDATE public.membership_plans SET stripe_price_id = 'price_pcd_b1' WHERE box_id = pg_temp.b(2);
  IF NOT internal.box_vend_en_ligne(pg_temp.b(2)) THEN RAISE EXCEPTION 'M : V compte Stripe ne prouve rien'; END IF;
  EXECUTE d;
  IF internal.box_vend_en_ligne(pg_temp.b(2)) THEN RAISE EXCEPTION 'M : V box sans compte vendrait en ligne'; END IF;
  UPDATE public.boxes SET stripe_onboarding_complete = false WHERE id = pg_temp.b(2);
  UPDATE public.membership_plans SET stripe_price_id = NULL WHERE box_id = pg_temp.b(2);

  -- E : montant, période sur le membre, durée par défaut, règle de renouvellement, refus.
  d := pg_temp.def('public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)');
  PERFORM pg_temp.muter('public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)', 'v_plan.price_cents * p_months', 'v_plan.price_cents');
  IF pg_temp.lecture(pg_temp.encaisser('e0', '10', 3)) = pg_temp.attendu(15000, t, 3) THEN RAISE EXCEPTION 'M : E montant ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)', 'IF p_months IS NULL OR p_months NOT IN (1, 3, 12) OR', 'IF');
  IF pg_temp.lecture(pg_temp.jouer('admin', format('SELECT public._log_box_cash_payment(%L, %L, NULL, ''00000000-0000-4000-c9c1-0000000000a1'', ''renewal'', 2, %L, %L)::text', pg_temp.b(1), pg_temp.u('10'), t, t))) LIKE '23514: INVALID_DURATION%' THEN
    RAISE EXCEPTION 'M : E durée du journal ne prouve rien';
  END IF;
  EXECUTE d;
  IF pg_temp.jouer('admin', format('SELECT public._log_box_cash_payment(%L, %L, NULL, ''00000000-0000-4000-c9c1-0000000000a1'', ''renewal'', 2, %L, %L)::text', pg_temp.b(1), pg_temp.u('10'), t, t)) NOT LIKE '23514: INVALID_DURATION%' THEN
    RAISE EXCEPTION 'E : le journal accepte une durée de 2 mois';
  END IF;
  d := pg_temp.def(r);
  PERFORM pg_temp.muter(r, E'    cash_access_until   = v_until\n', E'    cash_access_until   = cash_access_until\n');
  IF pg_temp.lecture(pg_temp.encaisser('e0', '10', 1)) = pg_temp.attendu(5000, t, 1) THEN RAISE EXCEPTION 'M : E fin posée sur le membre ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'p_months integer DEFAULT 1)', 'p_months integer DEFAULT 3)');
  IF pg_temp.lecture(pg_temp.encaisser('e0', '10', NULL)) = pg_temp.attendu(5000, t, 1) THEN RAISE EXCEPTION 'M : E appel à un argument ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'AND internal.box_vend_en_ligne(m.box_id) THEN', 'AND false THEN');
  IF pg_temp.lecture(pg_temp.encaisser('e0', '11', 1)) = 'COUNTER_RENEWAL_DISABLED' THEN RAISE EXCEPTION 'M : E vente en ligne ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'AND NOT (SELECT b.allow_counter_renewal FROM', 'AND NOT (SELECT false FROM');
  IF pg_temp.lecture(pg_temp.encaisser('e4', '30', 1)) <> 'COUNTER_RENEWAL_DISABLED' THEN RAISE EXCEPTION 'M : E réglage de la box ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'IF (m.cash_access_until IS NOT NULL', 'IF (false');
  IF pg_temp.lecture(pg_temp.encaisser('e0', '11', 1)) = 'COUNTER_RENEWAL_DISABLED' THEN RAISE EXCEPTION 'M : E fin d''accès existante ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'OR EXISTS (SELECT 1 FROM public.box_cash_payments c', 'OR false AND EXISTS (SELECT 1 FROM public.box_cash_payments c');
  IF pg_temp.lecture(pg_temp.encaisser('e0', '14', 1)) = 'COUNTER_RENEWAL_DISABLED' THEN RAISE EXCEPTION 'M : E journal d''adhésion ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'AND c.source IN (''renewal'', ''invitation'')', '');
  IF pg_temp.lecture(pg_temp.encaisser('e0', '15', 1)) <> 'COUNTER_RENEWAL_DISABLED' THEN RAISE EXCEPTION 'M : E programme ignoré ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'IF m.stripe_subscription_id IS NOT NULL THEN', 'IF false THEN');
  IF pg_temp.lecture(pg_temp.encaisser('e0', '12', 1)) = 'STRIPE_MEMBER' THEN RAISE EXCEPTION 'M : E STRIPE_MEMBER ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'IF v_logged IS NULL THEN', 'IF false THEN');
  IF pg_temp.lecture(pg_temp.encaisser('e0', '13', 1)) = 'NO_PLAN_PRICE' THEN RAISE EXCEPTION 'M : E NO_PLAN_PRICE ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'OR NOT public.is_box_owner_admin(m.box_id) THEN', 'THEN');
  IF pg_temp.lecture(pg_temp.encaisser('e3', '10', 1)) = 'FORBIDDEN' OR pg_temp.lecture(pg_temp.encaisser('e2', '10', 1)) = 'FORBIDDEN' THEN
    RAISE EXCEPTION 'M : E FORBIDDEN ne prouve rien';
  END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(r, 'WHERE id = p_box_member_id FOR UPDATE;', 'WHERE id = p_box_member_id;');
  IF strpos(pg_temp.def(r), 'WHERE id = p_box_member_id FOR UPDATE;') > 0 THEN RAISE EXCEPTION 'M : E verrou ne prouve rien'; END IF;
  EXECUTE d;

  -- I : fin sur l'invitation, fin sur le membre, base de la prolongation.
  d := pg_temp.def(k);
  PERFORM pg_temp.muter(k, 'WHEN v_payante AND r.accepted_by IS NULL THEN v_until ELSE', 'WHEN v_payante AND r.accepted_by IS NULL THEN NULL ELSE');
  IF pg_temp.lecture(pg_temp.payer('01', 1)) = pg_temp.fin(t, 1) || ':-:1:-:5000' THEN RAISE EXCEPTION 'M : I fin sur l''invitation ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(k, 'CASE WHEN v_payante THEN v_until ELSE cash_access_until END', 'cash_access_until');
  IF pg_temp.lecture(pg_temp.payer('40', 3, '40')) = '-:' || pg_temp.fin(t, 3) || ':3:40:15000' THEN RAISE EXCEPTION 'M : I fin sur le membre ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(k, 'FROM internal.periode_comptoir(v_fin, p_months)', 'FROM internal.periode_comptoir(NULL, p_months)');
  IF pg_temp.lecture(pg_temp.payer('41', 1, '41')) = '-:' || pg_temp.fin(t + 21, 1) || ':1:41:5000' THEN RAISE EXCEPTION 'M : I prolongation ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter(k, 'IF r.cash_collected THEN', 'IF false THEN');
  IF split_part(pg_temp.payer('04', 1), '|', 2) = '-:-:-' THEN RAISE EXCEPTION 'M : I déjà encaissée ne prouve rien'; END IF;
  EXECUTE d;
  -- Formule à 0 € : la condition de prix retirée, une fin apparaît.
  PERFORM pg_temp.muter(k, 'mp.id = r.plan_id AND mp.price_cents > 0', 'mp.id = r.plan_id');
  IF pg_temp.lecture(pg_temp.payer('05', 3)) = '-:-:-' THEN RAISE EXCEPTION 'M : I 0 €, sans compte, ne prouve rien'; END IF;
  IF pg_temp.lecture(pg_temp.payer('50', 3, '50')) = '-:-:-' THEN RAISE EXCEPTION 'M : I 0 €, avec compte, ne prouve rien'; END IF;
  EXECUTE d;
  -- Sans formule : toute invitation tenue pour payante, une fin apparaît.
  PERFORM pg_temp.muter(k, 'v_payante := EXISTS (SELECT 1 FROM public.membership_plans mp WHERE mp.id = r.plan_id AND mp.price_cents > 0);', 'v_payante := true;');
  IF pg_temp.lecture(pg_temp.payer('06', 3)) = '-:-:-' THEN RAISE EXCEPTION 'M : I sans formule, sans compte, ne prouve rien'; END IF;
  IF pg_temp.lecture(pg_temp.payer('51', 3, '51')) = '-:' || (t + 20) || ':-' THEN RAISE EXCEPTION 'M : I sans formule, avec compte, ne prouve rien'; END IF;
  EXECUTE d;
  -- La fin du membre est laissée telle quelle sans période.
  PERFORM pg_temp.muter(k, 'cash_access_until   = CASE WHEN v_payante THEN v_until ELSE cash_access_until END', 'cash_access_until   = v_until');
  IF pg_temp.payer_statut('51', '51') = 'active:' || (t + 20) THEN RAISE EXCEPTION 'M : I fin du membre inchangée ne prouve rien'; END IF;
  EXECUTE d;

  -- K : recopie à la consommation (insertion, puis mise à jour sans raccourcir).
  d := pg_temp.def('public._consume_box_invitation(text,uuid)');
  PERFORM pg_temp.muter('public._consume_box_invitation(text,uuid)', 'AND r.cash_collected THEN r.cash_access_until END', 'AND r.cash_collected THEN NULL END');
  IF pg_temp.consommer('42', '42') = 'active:' || (t + 30) THEN RAISE EXCEPTION 'M : K insertion ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('public._consume_box_invitation(text,uuid)', 'THEN greatest(cash_access_until, r.cash_access_until)', 'THEN r.cash_access_until');
  IF pg_temp.consommer('43', '43') = 'active:' || (t + 200) THEN RAISE EXCEPTION 'M : K fin la plus tardive ne prouve rien'; END IF;
  IF pg_temp.consommer('45', '45') = 'active:' || (t + 50) THEN RAISE EXCEPTION 'M : K sans formule, fin inchangée, ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('public._consume_box_invitation(text,uuid)', 'AND r.cash_collected THEN r.cash_access_until END', 'AND r.cash_collected THEN coalesce(r.cash_access_until, current_date) END');
  IF pg_temp.consommer('44', '44') = 'active:-' THEN RAISE EXCEPTION 'M : K 0 €, aucune fin, ne prouve rien'; END IF;
  EXECUTE d;

  -- C : la création déjà encaissée journalise et pose la période.
  d := pg_temp.def('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)');
  PERFORM pg_temp.muter('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)', E'  IF v_payante THEN\n    PERFORM', E'  IF false THEN\n    PERFORM');
  IF pg_temp.creer('pcd-m1@test.invalid', 'box', true, 3) = pg_temp.fin(t, 3) || ':3:15000:' || t || ':' || pg_temp.fin(t, 3) THEN RAISE EXCEPTION 'M : C journal ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)', E'    v_due_date,\n    v_until\n', E'    v_due_date,\n    NULL\n');
  IF pg_temp.creer('pcd-m2@test.invalid', 'box', true, 3) = pg_temp.fin(t, 3) || ':3:15000:' || t || ':' || pg_temp.fin(t, 3) THEN RAISE EXCEPTION 'M : C fin sur l''invitation ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)', 'mp.id = p_plan_id AND mp.price_cents > 0', 'mp.id = p_plan_id');
  IF pg_temp.creer('pcd-m3@test.invalid', 'box', true, 3, 'a0') = '-:-' THEN RAISE EXCEPTION 'M : C 0 € ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)',
                        'v_payante := v_cash AND EXISTS (SELECT 1 FROM public.membership_plans mp WHERE mp.id = p_plan_id AND mp.price_cents > 0);', 'v_payante := v_cash;');
  IF pg_temp.creer('pcd-m4@test.invalid', 'box', true, 3, NULL) = '-:-' THEN RAISE EXCEPTION 'M : C sans formule ne prouve rien'; END IF;
  EXECUTE d;

  -- L : chaque colonne du verrou, la contrainte de période, les deux gardes.
  d := pg_temp.def('public.reject_cash_payment_rewrite()');
  PERFORM pg_temp.muter('public.reject_cash_payment_rewrite()', 'OR NEW.period_months IS DISTINCT FROM OLD.period_months', '');
  IF pg_temp.jouer('admin', 'UPDATE public.box_cash_payments SET period_months = 3 WHERE id = ''00000000-0000-4000-e9c1-0000000000aa''') <> 'OK' THEN RAISE EXCEPTION 'M : L period_months ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('public.reject_cash_payment_rewrite()', 'OR NEW.access_from   IS DISTINCT FROM OLD.access_from', '');
  IF pg_temp.jouer('admin', 'UPDATE public.box_cash_payments SET access_from = ''2026-09-30'' WHERE id = ''00000000-0000-4000-e9c1-0000000000aa''') <> 'OK' THEN RAISE EXCEPTION 'M : L access_from ne prouve rien'; END IF;
  EXECUTE d;
  PERFORM pg_temp.muter('public.reject_cash_payment_rewrite()', 'OR NEW.access_until  IS DISTINCT FROM OLD.access_until', '');
  IF pg_temp.jouer('admin', 'UPDATE public.box_cash_payments SET access_until = ''2026-11-30'' WHERE id = ''00000000-0000-4000-e9c1-0000000000aa''') <> 'OK' THEN RAISE EXCEPTION 'M : L access_until ne prouve rien'; END IF;
  EXECUTE d;
  ALTER TABLE public.box_cash_payments DROP CONSTRAINT box_cash_payments_periode_complete;
  IF pg_temp.jouer('admin', format('INSERT INTO public.box_cash_payments (box_id, plan_id, plan_name, amount_cents, source, period_months) VALUES (%L, ''00000000-0000-4000-c9c1-0000000000b1'', ''x'', 100, ''renewal'', 1)', pg_temp.b(2))) <> 'OK' THEN
    RAISE EXCEPTION 'M : L période complète ne prouve rien';
  END IF;
  ALTER TABLE public.box_cash_payments ADD CONSTRAINT box_cash_payments_periode_complete CHECK (
    (period_months IS NULL AND access_from IS NULL AND access_until IS NULL)
    OR (period_months IS NOT NULL AND access_from IS NOT NULL AND access_until IS NOT NULL
        AND access_until >= access_from));
  d := pg_temp.def('internal.garder_facturation_membre()');
  PERFORM pg_temp.muter('internal.garder_facturation_membre()', E'        NEW.cash_access_until\n     ) IS DISTINCT FROM ROW(', E'        OLD.cash_access_until\n     ) IS DISTINCT FROM ROW(');
  IF pg_temp.jouer('e0', format('UPDATE public.box_members SET cash_access_until = %L WHERE id = %L', t + 400, pg_temp.bm('10'))) <> 'OK' THEN
    RAISE EXCEPTION 'M : L garde de facturation (corps) ne prouve rien';
  END IF;
  EXECUTE d;
  DROP TRIGGER trg_box_members_garde_facturation ON public.box_members;
  CREATE TRIGGER trg_box_members_garde_facturation BEFORE INSERT OR UPDATE OF plan_id, subscription_status, stripe_subscription_id, stripe_checkout_session_id, subscription_current_period_end, subscription_cancel_at_period_end, amount_cents, platform_fee_cents, commitment_end_date, subscription_paused, pause_started_at, pause_resumes_at, payment_method_type, past_due_since, dunning_attempts, last_payment_error, dunning_reminders_sent, dunning_last_reminder_at, billing_day, scheduled_plan_id, scheduled_change_at, stripe_schedule_id, status ON public.box_members FOR EACH ROW EXECUTE FUNCTION internal.garder_facturation_membre();
  IF pg_temp.jouer('e0', format('UPDATE public.box_members SET cash_access_until = %L WHERE id = %L', t + 400, pg_temp.bm('10'))) <> 'OK' THEN
    RAISE EXCEPTION 'M : L garde de facturation (liste de colonnes) ne prouve rien';
  END IF;
  DROP TRIGGER trg_box_members_garde_facturation ON public.box_members;
  CREATE TRIGGER trg_box_members_garde_facturation BEFORE INSERT OR UPDATE OF plan_id, subscription_status, stripe_subscription_id, stripe_checkout_session_id, subscription_current_period_end, subscription_cancel_at_period_end, amount_cents, platform_fee_cents, commitment_end_date, subscription_paused, pause_started_at, pause_resumes_at, payment_method_type, past_due_since, dunning_attempts, last_payment_error, dunning_reminders_sent, dunning_last_reminder_at, billing_day, scheduled_plan_id, scheduled_change_at, stripe_schedule_id, cash_access_until, status ON public.box_members FOR EACH ROW EXECUTE FUNCTION internal.garder_facturation_membre();
  ALTER TABLE public.boxes DISABLE TRIGGER trg_boxes_garde_renouvellement_comptoir;
  IF pg_temp.jouer('e0', format('UPDATE public.boxes SET allow_counter_renewal = true WHERE id = %L', pg_temp.b(1))) <> 'OK' THEN
    RAISE EXCEPTION 'M : L garde du réglage ne prouve rien';
  END IF;
  ALTER TABLE public.boxes ENABLE TRIGGER trg_boxes_garde_renouvellement_comptoir;

  -- D : un EXECUTE accordé se voit ; une seconde version se voit.
  GRANT EXECUTE ON FUNCTION internal.periode_comptoir(date, integer) TO authenticated;
  GRANT EXECUTE ON FUNCTION internal.box_vend_en_ligne(uuid) TO anon;
  GRANT EXECUTE ON FUNCTION public._log_box_cash_payment(uuid, uuid, uuid, uuid, text, integer, date, date, uuid, integer, text) TO service_role;
  IF NOT has_function_privilege('authenticated', 'internal.periode_comptoir(date,integer)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'internal.box_vend_en_ligne(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'M : D droits ne prouvent rien';
  END IF;
  REVOKE EXECUTE ON FUNCTION internal.periode_comptoir(date, integer) FROM authenticated;
  REVOKE EXECUTE ON FUNCTION internal.box_vend_en_ligne(uuid) FROM anon;
  REVOKE EXECUTE ON FUNCTION public._log_box_cash_payment(uuid, uuid, uuid, uuid, text, integer, date, date, uuid, integer, text) FROM service_role;
  CREATE FUNCTION public.record_member_cash_payment(p_box_member_id uuid) RETURNS jsonb LANGUAGE sql AS $f$ SELECT NULL::jsonb $f$;
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'record_member_cash_payment') <> 2 THEN RAISE EXCEPTION 'M : S une seule version ne prouve rien'; END IF;
  DROP FUNCTION public.record_member_cash_payment(uuid);
END $t$;

-- Les mutations n'ont rien laissé : définitions, déclencheurs, contrainte et droits revenus au fichier.
DO $t$
BEGIN
  IF (SELECT string_agg(md5(pg_temp.def(f)), ',' ORDER BY f) FROM unnest(ARRAY[
        'public.record_member_cash_payment(uuid,integer)', 'public.mark_box_invitation_paid(uuid,integer)',
        'public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)', 'public.reject_cash_payment_rewrite()',
        'internal.garder_facturation_membre()', 'public._consume_box_invitation(text,uuid)',
        'public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)',
        'internal.periode_comptoir(date,integer)', 'internal.box_vend_en_ligne(uuid)']) f)
     IS DISTINCT FROM (SELECT string_agg(h, ',' ORDER BY f) FROM (VALUES
        ('public.record_member_cash_payment(uuid,integer)', '7789384fc790ab1d7b42c70df8e96424'),
        ('public.mark_box_invitation_paid(uuid,integer)', 'd4d61e9755478b4c23db84f54a43bf3b'),
        ('public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)', 'd2e9ef2e96701fbf9d2e1e62e6c72672'),
        ('public.reject_cash_payment_rewrite()', 'ae7c75d48949a602b6e6994bbd2aade6'),
        ('internal.garder_facturation_membre()', '483768906753de48dd9b48454f877f23'),
        ('public._consume_box_invitation(text,uuid)', '5d1e2581644640a3bb2f86c14e85a2dd'),
        ('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text,integer)', '8b090621d461d499b05afe334d9a8f8f'),
        ('internal.periode_comptoir(date,integer)', '946784e27c0e4c50feec61c0bc456dbb'),
        ('internal.box_vend_en_ligne(uuid)', 'f5d67d93a900664e3297742237f91d6f')) x(f, h))
     OR (SELECT md5(pg_get_triggerdef(oid)) FROM pg_trigger WHERE tgname = 'trg_box_members_garde_facturation') <> '3aec5ba9a7b7ba60ea9ec4423fbcf71e'
     OR (SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_boxes_garde_renouvellement_comptoir') <> 'O'
     OR (SELECT count(*) FROM pg_constraint WHERE conname = 'box_cash_payments_periode_complete') <> 1
     OR has_function_privilege('authenticated', 'internal.periode_comptoir(date,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'internal.box_vend_en_ligne(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'M : une mutation n''est pas revenue';
  END IF;
END $t$;

-- ── R : retour arrière ────────────────────────────────────────────────────────
-- D'abord celui de 20270152, qui lit cash_access_until (ordre inverse des migrations).
\i supabase/retours/20270152000000_comptoir_fin_acces.sql
\i supabase/retours/20270151000000_paiements_comptoir_duree.sql
SET LOCAL search_path = "$user", public, extensions;
DO $t$
DECLARE v text;
BEGIN
  SELECT string_agg(a.fn || ' ' || coalesce(md5(pg_temp.def(a.fn)), 'absente'), ', ') INTO v
  FROM (VALUES
    ('public.record_member_cash_payment(uuid)', '05ac1a6c13381169de8c887970461ce9'),
    ('public.mark_box_invitation_paid(uuid)', '58f668fc4ef9454fee71cddb0263965c'),
    ('public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,uuid,integer,text)', 'd5361a6e55adcbeccb3f0abb752a5995'),
    ('public.reject_cash_payment_rewrite()', 'd1c6053375305c67197ad659d42a0926'),
    ('internal.garder_facturation_membre()', 'b50e8f8843dbe51848862942b3f3602f'),
    ('public._consume_box_invitation(text,uuid)', '78b0d0a212111ddec7e08ecfb684640f'),
    ('public.create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text)', 'f9412cbc5e1d03d4de7483c8bb6e6e2f')
  ) a(fn, attendu)
  WHERE md5(pg_temp.def(a.fn)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'R : définitions de prod non rétablies : %', v; END IF;
  IF (SELECT md5(pg_get_triggerdef(oid)) FROM pg_trigger WHERE tgname = 'trg_box_members_garde_facturation') <> '05e9de13a14666cd9b5d99040e8da0c3' THEN
    RAISE EXCEPTION 'R : déclencheur de la garde non rétabli';
  END IF;
  SELECT string_agg(f || '=' || coalesce(r, ''), ' ' ORDER BY f COLLATE "C") INTO v FROM (
    SELECT p.oid::regprocedure::text f,
           (SELECT string_agg(ro, ',' ORDER BY ro) FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) ro
             WHERE has_function_privilege(ro, p.oid, 'EXECUTE')) r
      FROM pg_proc p
     WHERE p.proname IN ('record_member_cash_payment', 'mark_box_invitation_paid', 'create_box_invitation', '_log_box_cash_payment')) s;
  IF v IS DISTINCT FROM '_log_box_cash_payment(uuid,uuid,uuid,uuid,text,uuid,integer,text)=authenticated,service_role create_box_invitation(uuid,text,text,text,uuid,text,boolean,integer,text)=authenticated,service_role mark_box_invitation_paid(uuid)=authenticated,service_role record_member_cash_payment(uuid)=authenticated,service_role' THEN
    RAISE EXCEPTION 'R : droits (%)', v;
  END IF;
  IF (SELECT string_agg(coalesce(obj_description(p.oid, 'pg_proc'), '-'), ' | ' ORDER BY p.proname COLLATE "C") FROM pg_proc p
       WHERE p.proname IN ('record_member_cash_payment', 'mark_box_invitation_paid', 'create_box_invitation', '_log_box_cash_payment')) IS DISTINCT FROM
     '- | Crée une invitation nominative pour une box administrée par l''appelant. Renvoie le jeton en clair une seule fois. | '
     || 'Marque une invitation « mode box » comme encaissée au comptoir, journalise le paiement et active le membre s''il a déjà créé son compte. | '
     || 'Journalise l''échéance comptoir d''un membre (montant lu sur sa formule). Admin de la box uniquement, refusée sur un abonné Stripe.' THEN
    RAISE EXCEPTION 'R : commentaires';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
              AND (table_name, column_name) IN (('box_members', 'cash_access_until'), ('boxes', 'allow_counter_renewal'),
                   ('box_invitations', 'cash_access_until'), ('box_cash_payments', 'period_months'),
                   ('box_cash_payments', 'access_from'), ('box_cash_payments', 'access_until')))
     OR EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('periode_comptoir', 'box_vend_en_ligne', 'garder_reglage_comptoir_box'))
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_boxes_garde_renouvellement_comptoir')
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('box_cash_payments_period_months_check', 'box_cash_payments_periode_complete')) THEN
    RAISE EXCEPTION 'R : un objet ajouté subsiste';
  END IF;
END $t$;

ROLLBACK;
\echo '    S, P, V, E, I, K, C, L, D, M et R OK'
