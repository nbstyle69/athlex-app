-- ═════════════════════════════════════════════════════════════════════════════
-- État de la formule d'un membre (migration 20270141) : my_box_plan_status
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B (vend en ligne : formule Stripe) : propriétaire O (…e0, owner_id, sans
-- ligne box_members), co-gérant K (…e2), coach C (…e1), coach inactif X (…e3).
-- Box B2 (ne vend pas en ligne) : propriétaire P (…e4), membre AUT (…12).
-- Membres de B (… suffixe) :
--   01 NF   ni formule ni crédit            08 TRI  abonnement trialing
--   02 NFS  formule abonnement, statut NULL 09 PDU  impayé dans le délai (1 j)
--   03 SUB  abonnement actif                10 CAN  abonnement résilié
--   04 CRE  carnet 7 restantes + carnet     11 INA  membre inactif, abonnement
--           expiré non entamé                       actif
--   05 EPU  carnet épuisé                   13 ESS  formule d'essai, statut NULL
--   06 SUS  impayé depuis 10 j (suspendu)   14 CR2  deux carnets (2 + 3)
--   07 SUC  suspendu, carnet de 2 restantes
--
--   E1  chaque appelant lit son état dans B (staff, formule, suspension,
--       séances restantes, vente en ligne) ou aucune ligne (O sans ligne
--       box_members, X et INA inactifs, AUT hors de B) ;
--   E2  bornage : une seule ligne, toujours celle de l'appelant ; SUB ne lit rien
--       dans B2, AUT lit B2 (pays_online faux) ; clé serveur : aucune ligne ;
--       anon : droit refusé (42501) ;
--   E3  pays_online : formule de B désactivée, ou formule sans prix Stripe →
--       faux ; formule d'une autre box → sans effet ;
--   E4  parité avec le refus : pour chaque ligne lue, une réservation réelle de
--       l'appelant pour lui-même (INSERT dans class_reservations, annulé sous
--       savepoint) est refusée par NO_ACTIVE_PLAN si et seulement si
--       NOT suspended AND NOT is_staff AND NOT has_plan, et par
--       MEMBERSHIP_PAST_DUE si et seulement si suspended ; les deux verdicts sont
--       couverts ; la parité tient encore après changement d'état (NFS passe
--       active, SUB passe canceled) ;
--   E5  droits et attributs : rien pour PUBLIC ni anon, EXECUTE pour
--       authenticated et service_role ; SECURITY DEFINER, STABLE, search_path ;
--       commentaire ;
--   E6  définitions figées : les fonctions internes appelées et le refus sont
--       aux md5 de prod ; la nouvelle fonction est épinglée ;
--   R   retour arrière (supabase/retours/…) : la fonction disparaît, les
--       fonctions internes restent aux md5 de prod.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> État de la formule d''un membre : my_box_plan_status'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a960-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0','e1','e2','e3','e4','01','02','03','04','05','06','07','08','09','10','11','12','13','14']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a960-0000000000' || s)::uuid, 'efm-' || s || '@test.invalid', 'efm_' || s
  FROM unnest(ARRAY['e0','e1','e2','e3','e4','01','02','03','04','05','06','07','08','09','10','11','12','13','14']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b960-000000000001', 'Box en ligne', 'EFM1', '00000000-0000-4000-a960-0000000000e0'),
  ('00000000-0000-4000-b960-000000000002', 'Box au comptoir', 'EFM2', '00000000-0000-4000-a960-0000000000e4');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active, stripe_price_id) VALUES
  ('00000000-0000-4000-e960-000000000001', '00000000-0000-4000-b960-000000000001', 'Illimité', 8900, 'subscription', true, 'price_efm_1'),
  ('00000000-0000-4000-e960-000000000002', '00000000-0000-4000-b960-000000000001', 'Essai', 0, 'trial', true, NULL),
  ('00000000-0000-4000-e960-000000000003', '00000000-0000-4000-b960-000000000002', 'Comptoir', 7000, 'subscription', true, NULL);

-- (box, suffixe, rôle, statut, formule, statut d'abonnement, impayé depuis)
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, past_due_since)
SELECT ('00000000-0000-4000-b960-00000000000' || b)::uuid, ('00000000-0000-4000-a960-0000000000' || m)::uuid, r, st,
       ('00000000-0000-4000-e960-00000000000' || p)::uuid, ss, depuis
  FROM (VALUES
    ('1', 'e1', 'coach',  'active',   NULL, NULL,       NULL::timestamptz),
    ('1', 'e2', 'owner',  'active',   NULL, NULL,       NULL),
    ('1', 'e3', 'coach',  'inactive', NULL, NULL,       NULL),
    ('2', 'e4', 'owner',  'active',   NULL, NULL,       NULL),
    ('1', '01', 'member', 'active',   NULL, NULL,       NULL),
    ('1', '02', 'member', 'active',   '1',  NULL,       NULL),
    ('1', '03', 'member', 'active',   '1',  'active',   NULL),
    ('1', '04', 'member', 'active',   NULL, NULL,       NULL),
    ('1', '05', 'member', 'active',   NULL, NULL,       NULL),
    ('1', '06', 'member', 'active',   '1',  'past_due', now() - interval '10 days'),
    ('1', '07', 'member', 'active',   '1',  'past_due', now() - interval '10 days'),
    ('1', '08', 'member', 'active',   '1',  'trialing', NULL),
    ('1', '09', 'member', 'active',   '1',  'past_due', now() - interval '1 day'),
    ('1', '10', 'member', 'active',   '1',  'canceled', NULL),
    ('1', '11', 'member', 'inactive', '1',  'active',   NULL),
    ('2', '12', 'member', 'active',   NULL, NULL,       NULL),
    ('1', '13', 'member', 'active',   '2',  NULL,       NULL),
    ('1', '14', 'member', 'active',   NULL, NULL,       NULL)
  ) v(b, m, r, st, p, ss, depuis);

-- Carnets : (suffixe, n°, total, utilisées, expire dans (jours), statut).
INSERT INTO public.member_class_credits (id, member_id, box_id, credits_total, credits_used, expires_at, status)
SELECT ('00000000-0000-4000-c960-00000000' || m || n)::uuid, ('00000000-0000-4000-a960-0000000000' || m)::uuid,
       '00000000-0000-4000-b960-000000000001', t, u, now() + make_interval(days => j), s
  FROM (VALUES
    ('04', '01', 10, 3,  90, 'active'),
    ('04', '02', 10, 0,  -1, 'active'),     -- expiré hier : ne compte pas
    ('05', '01', 10, 10, 90, 'exhausted'),
    ('07', '01', 5,  3,  90, 'active'),
    ('14', '01', 5,  3,  90, 'active'),
    ('14', '02', 4,  1,  30, 'active')
  ) v(m, n, t, u, j, s);

-- Un créneau de demain, assez large pour tout le monde.
INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time, max_capacity)
VALUES ('00000000-0000-4000-d960-000000000001', '00000000-0000-4000-b960-000000000001', 'WOD', CURRENT_DATE + 1, '18:00', '19:00', 50);

-- Exécute `p_sql` sous l'identité `p_qui` (suffixe, « service » ou « anon »)
-- dans un sous-bloc (savepoint). `p_annuler` : le sous-bloc est toujours
-- annulé, même réussi (« ANNULE »). Rend « OK », « ANNULE » ou
-- « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text, p_annuler boolean DEFAULT false) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK';
BEGIN
  IF p_qui = 'service' THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('role', 'service_role', true);
  ELSIF p_qui = 'anon' THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    PERFORM set_config('role', 'anon', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a960-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
  BEGIN
    EXECUTE p_sql;
    IF p_annuler THEN RAISE EXCEPTION USING ERRCODE = 'EFM00', MESSAGE = 'ANNULE'; END IF;
  EXCEPTION
    WHEN SQLSTATE 'EFM00' THEN v := 'ANNULE';
    WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN v;
END $$;

-- L'état lu par `p_qui` pour la box n° `p_box` : « aucune », ou
-- « staff/formule/suspendu/séances/en ligne » (t ou f), ou « n lignes », ou
-- l'erreur.
CREATE FUNCTION pg_temp.etat(p_qui text, p_box int DEFAULT 1) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  v := pg_temp.faire(p_qui, format($q$
    SELECT set_config('efm.etat', COALESCE((
      SELECT CASE WHEN count(*) > 1 THEN count(*) || ' lignes'
                  ELSE string_agg(concat_ws('/', s.is_staff, s.has_plan, s.suspended, s.credits_left, s.pays_online), '') END
        FROM public.my_box_plan_status(%L) s), 'aucune'), true)$q$,
    '00000000-0000-4000-b960-00000000000' || p_box));
  IF v <> 'OK' THEN RETURN v; END IF;
  v := current_setting('efm.etat', true);
  PERFORM set_config('efm.etat', '', true);
  RETURN v;
END $$;

-- Réservation réelle de `p_membre` pour lui-même au créneau de B, annulée
-- quoi qu'il arrive.
CREATE FUNCTION pg_temp.reserver(p_membre text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire(p_membre, format(
    'INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status) VALUES (%L, %L, %L, %L)',
    '00000000-0000-4000-d960-000000000001', '00000000-0000-4000-a960-0000000000' || p_membre,
    '00000000-0000-4000-b960-000000000001', 'confirmed'), true);
$$;

-- ── E1 : chaque appelant, son état dans B ─────────────────────────────────────
DO $t$
DECLARE
  a record;
  v text;
BEGIN
  FOR a IN SELECT * FROM (VALUES
    ('e0', 'aucune'),       -- O : propriétaire sans ligne box_members
    ('e1', 't/f/f/0/t'),    -- C : coach
    ('e2', 't/f/f/0/t'),    -- K : co-gérant
    ('e3', 'aucune'),       -- X : coach inactif
    ('01', 'f/f/f/0/t'),    -- NF
    ('02', 'f/f/f/0/t'),    -- NFS : formule sans statut
    ('03', 'f/t/f/0/t'),    -- SUB
    ('04', 'f/t/f/7/t'),    -- CRE : le carnet expiré ne compte pas
    ('05', 'f/t/f/0/t'),    -- EPU : a une formule, plus de séance
    ('06', 'f/f/t/0/t'),    -- SUS
    ('07', 'f/t/t/2/t'),    -- SUC : suspendu, mais un carnet
    ('08', 'f/t/f/0/t'),    -- TRI
    ('09', 'f/t/f/0/t'),    -- PDU : dans le délai
    ('10', 'f/f/f/0/t'),    -- CAN
    ('11', 'aucune'),       -- INA : membre inactif
    ('12', 'aucune'),       -- AUT : hors de B
    ('13', 'f/f/f/0/t'),    -- ESS : formule d'essai sans statut
    ('14', 'f/t/f/5/t')     -- CR2 : 2 + 3 séances
  ) t(qui, attendu) LOOP
    v := pg_temp.etat(a.qui);
    IF v IS DISTINCT FROM a.attendu THEN
      RAISE EXCEPTION 'E1 : % lit « % » (« % » attendu)', a.qui, v, a.attendu;
    END IF;
  END LOOP;
END $t$;

-- ── E2 : bornage à l'appelant ─────────────────────────────────────────────────
DO $t$
DECLARE v text;
BEGIN
  v := pg_temp.etat('03', 2);
  IF v <> 'aucune' THEN RAISE EXCEPTION 'E2 : SUB lit B2 : %', v; END IF;
  v := pg_temp.etat('12', 2);
  IF v <> 'f/f/f/0/f' THEN RAISE EXCEPTION 'E2 : AUT dans B2 : % (box sans vente en ligne attendue)', v; END IF;
  v := pg_temp.etat('e4', 2);
  IF v <> 't/f/f/0/f' THEN RAISE EXCEPTION 'E2 : P dans B2 : %', v; END IF;
  v := pg_temp.etat('service');
  IF v <> 'aucune' THEN RAISE EXCEPTION 'E2 : la clé serveur lit une ligne : %', v; END IF;
  v := pg_temp.etat('anon');
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'E2 : anon : % (42501 attendu)', v; END IF;
  -- Une box inconnue : rien.
  v := pg_temp.etat('03', 9);
  IF v <> 'aucune' THEN RAISE EXCEPTION 'E2 : SUB lit une box inconnue : %', v; END IF;
END $t$;

-- ── E3 : pays_online ──────────────────────────────────────────────────────────
DO $t$
DECLARE v text;
BEGIN
  UPDATE public.membership_plans SET is_active = false WHERE id = '00000000-0000-4000-e960-000000000001';
  v := pg_temp.etat('01');
  IF v <> 'f/f/f/0/f' THEN RAISE EXCEPTION 'E3 : formule désactivée : %', v; END IF;
  UPDATE public.membership_plans SET is_active = true, stripe_price_id = NULL WHERE id = '00000000-0000-4000-e960-000000000001';
  v := pg_temp.etat('01');
  IF v <> 'f/f/f/0/f' THEN RAISE EXCEPTION 'E3 : formule sans prix Stripe : %', v; END IF;
  -- Une formule en ligne d'une autre box ne compte pas pour B.
  UPDATE public.membership_plans SET stripe_price_id = 'price_efm_3' WHERE id = '00000000-0000-4000-e960-000000000003';
  v := pg_temp.etat('01');
  IF v <> 'f/f/f/0/f' THEN RAISE EXCEPTION 'E3 : formule d''une autre box : %', v; END IF;
  v := pg_temp.etat('12', 2);
  IF v <> 'f/f/f/0/t' THEN RAISE EXCEPTION 'E3 : B2 avec formule en ligne : %', v; END IF;
  UPDATE public.membership_plans SET stripe_price_id = NULL WHERE id = '00000000-0000-4000-e960-000000000003';
  UPDATE public.membership_plans SET stripe_price_id = 'price_efm_1' WHERE id = '00000000-0000-4000-e960-000000000001';
  v := pg_temp.etat('01');
  IF v <> 'f/f/f/0/t' THEN RAISE EXCEPTION 'E3 : état restauré : %', v; END IF;
END $t$;

-- ── E4 : parité avec le refus réel ────────────────────────────────────────────
CREATE FUNCTION pg_temp.parite(p_tour text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  m text;
  s record;
  v text;
  n_refus int := 0;
  n_admis int := 0;
  lu boolean;
BEGIN
  FOREACH m IN ARRAY ARRAY['e0','e1','e2','e3','01','02','03','04','05','06','07','08','09','10','11','13','14'] LOOP
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a960-0000000000' || m, true);
    SELECT * INTO s FROM public.my_box_plan_status('00000000-0000-4000-b960-000000000001');
    lu := FOUND;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    CONTINUE WHEN NOT lu;
    v := pg_temp.reserver(m);
    IF (v LIKE '23514: NO_ACTIVE_PLAN%') IS DISTINCT FROM (NOT s.suspended AND NOT s.is_staff AND NOT s.has_plan) THEN
      RAISE EXCEPTION 'E4 (%) : % : réservation « % », état staff=% formule=% suspendu=%',
        p_tour, m, v, s.is_staff, s.has_plan, s.suspended;
    END IF;
    IF (v LIKE '23514: MEMBERSHIP_PAST_DUE%') IS DISTINCT FROM s.suspended THEN
      RAISE EXCEPTION 'E4 (%) : % : réservation « % », suspendu=%', p_tour, m, v, s.suspended;
    END IF;
    IF v LIKE '23514: NO_ACTIVE_PLAN%' THEN n_refus := n_refus + 1; ELSE n_admis := n_admis + 1; END IF;
  END LOOP;
  IF n_refus = 0 OR n_admis = 0 THEN
    RAISE EXCEPTION 'E4 (%) : le jeu ne couvre pas les deux verdicts (% refus, % autres)', p_tour, n_refus, n_admis;
  END IF;
  RETURN n_refus + n_admis;
END $$;

DO $t$
DECLARE n int;
BEGIN
  n := pg_temp.parite('départ');
  -- Aucune réservation ne subsiste, aucun crédit n'a bougé.
  IF EXISTS (SELECT 1 FROM public.class_reservations WHERE box_id = '00000000-0000-4000-b960-000000000001') THEN
    RAISE EXCEPTION 'E4 : une réservation a survécu au savepoint';
  END IF;
  IF (SELECT sum(credits_used) FROM public.member_class_credits WHERE box_id = '00000000-0000-4000-b960-000000000001') <> 20 THEN
    RAISE EXCEPTION 'E4 : un crédit a été débité';
  END IF;
  -- Changements d'état : NFS paie, SUB résilie, CRE perd son carnet.
  UPDATE public.box_members SET subscription_status = 'active'
   WHERE member_id = '00000000-0000-4000-a960-000000000002';
  UPDATE public.box_members SET subscription_status = 'canceled'
   WHERE member_id = '00000000-0000-4000-a960-000000000003';
  DELETE FROM public.member_class_credits WHERE member_id = '00000000-0000-4000-a960-000000000004';
  IF pg_temp.etat('02') <> 'f/t/f/0/t' OR pg_temp.etat('03') <> 'f/f/f/0/t'
     OR pg_temp.etat('04') <> 'f/f/f/0/t' THEN
    RAISE EXCEPTION 'E4 : états après changement : NFS %, SUB %, CRE %', pg_temp.etat('02'), pg_temp.etat('03'), pg_temp.etat('04');
  END IF;
  n := pg_temp.parite('après changement');
  RAISE NOTICE 'E4 : parité avec le refus sur % membres, deux fois', n;
END $t$;

-- ── E5 : droits et attributs ──────────────────────────────────────────────────
DO $t$
DECLARE p record;
BEGIN
  IF has_function_privilege('anon', 'public.my_box_plan_status(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.my_box_plan_status(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.my_box_plan_status(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'E5 : droits EXECUTE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc pr, aclexplode(pr.proacl) a
              WHERE pr.oid = 'public.my_box_plan_status(uuid)'::regprocedure AND a.grantee = 0) THEN
    RAISE EXCEPTION 'E5 : EXECUTE accordé à PUBLIC';
  END IF;
  SELECT prosecdef, provolatile, proconfig INTO p FROM pg_proc WHERE oid = 'public.my_box_plan_status(uuid)'::regprocedure;
  IF NOT p.prosecdef OR p.provolatile <> 's' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp'] THEN
    RAISE EXCEPTION 'E5 : attributs : %', p;
  END IF;
  IF obj_description('public.my_box_plan_status(uuid)'::regprocedure, 'pg_proc') NOT LIKE 'Lot 4 « Rejoindre une box en payant »%' THEN
    RAISE EXCEPTION 'E5 : commentaire';
  END IF;
END $t$;

-- ── E6 : définitions figées ───────────────────────────────────────────────────
CREATE FUNCTION pg_temp.empreintes_internes() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  f record;
  v text;
BEGIN
  FOR f IN SELECT * FROM (VALUES
    ('internal.membre_a_formule(uuid,uuid)',      '471b0e75ce212bda0e400c2ab546920f'),
    ('internal.est_staff_box(uuid,uuid)',         'f2829621c684819c49e3864b3acaaf9f'),
    ('internal.membership_suspendu(uuid,uuid)',   '4a057f03f7a3db2e845a18a750b027dd'),
    ('internal.bloquer_reservation_impaye()',     '3910a8d07c3da0fddf35f0b05bd75952'),
    ('public.consume_credit_on_reservation()',    'f6bc083f4c67cc88faa558a4eb061d29')
  ) t(sig, attendu) LOOP
    v := md5(pg_get_functiondef(f.sig::regprocedure));
    IF v <> f.attendu THEN
      RAISE EXCEPTION '% a changé (md5 %, % attendu)', f.sig, v, f.attendu;
    END IF;
  END LOOP;
END $$;

DO $t$
DECLARE v text;
BEGIN
  PERFORM pg_temp.empreintes_internes();
  v := md5(pg_get_functiondef('public.my_box_plan_status(uuid)'::regprocedure));
  IF v <> '5b3ced6c30e4a1578c15e675dfe2836f' THEN
    RAISE EXCEPTION 'E6 : my_box_plan_status a changé (md5 %)', v;
  END IF;
END $t$;

-- ── R : retour arrière ────────────────────────────────────────────────────────
\i supabase/retours/20270141000000_etat_formule_membre.sql
DO $t$
BEGIN
  IF to_regprocedure('public.my_box_plan_status(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'R : my_box_plan_status existe encore';
  END IF;
  PERFORM pg_temp.empreintes_internes();
END $t$;

ROLLBACK;
\echo '    E1 à E6 et R OK'
