-- ═════════════════════════════════════════════════════════════════════════════
-- Réservation : box du créneau et appartenance à la box (migration 20270134)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box A : propriétaire OA (…e0, owner_id), coach CA (…e1), co-gérant KA (…e2).
-- Box B : propriétaire OB (…e4). Box Z, archivée : coach CZ (…e6).
-- Tous les membres ont une formule (abonnement actif, ou carnet dans A pour ceux
-- qui n'ont pas d'adhésion active) : c'est la policy qui tranche, pas NO_ACTIVE_PLAN.
--   01 M1  membre actif de A            05 M5  membre actif de A (liste d'attente)
--   02 IN  adhésion inactive, carnet    06 MZ  membre actif de Z (archivée)
--   03 BA  banni, carnet                07 NF  membre actif de A sans formule
--   04 EX  aucune adhésion, carnet      08 SU  membre de A suspendu (impayé)
--
--   B1  M1 réserve dans A : accepté ;
--   B2  EX (non-membre), IN (inactif), BA (banni) : refus RLS (42501) ; M1 qui
--       inscrit M5 : refus RLS ;
--   B3  staff de A pour lui-même (CA, OA par owner_id, KA) : accepté ;
--   B4  box déclarée ≠ box du créneau : par M1 (dans les deux sens), par le coach
--       de A (INSERT, puis UPDATE de schedule_id et de box_id), par la clé
--       serveur, box nulle : RESERVATION_BOX_MISMATCH ; NF (sans formule) aussi,
--       avant NO_ACTIVE_PLAN (ordre des déclencheurs) ;
--   B5  UPDATE de attended par le staff sur une ligne ancienne dont la box ne
--       correspond pas : accepté (le déclencheur ne regarde que box_id et
--       schedule_id) ;
--   B6  book_trial_slot (anon) : accepté ;
--   B7  promotion depuis la liste d'attente : M5 promu ;
--   B8  box archivée : MZ refusé (42501), CZ accepté ;
--   B9  inchangés : NF → NO_ACTIVE_PLAN, alerte ouverte quand le coach l'inscrit ;
--       SU → MEMBERSHIP_PAST_DUE ;
--   B10 définitions : nouvelle policy et nouvelle fonction épinglées, autres
--       policies et fonctions voisines inchangées, trg_a0 premier des
--       déclencheurs BEFORE INSERT, fonction internal fermée aux rôles clients.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Réservation : box du créneau et appartenance à la box'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9bc-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0','e1','e2','e4','e6','01','02','03','04','05','06','07','08']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9bc-0000000000' || s)::uuid, 'rbc-' || s || '@test.invalid', 'rbc_' || s
  FROM unnest(ARRAY['e0','e1','e2','e4','e6','01','02','03','04','05','06','07','08']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id, archived_at) VALUES
  ('00000000-0000-4000-b9bc-00000000000a', 'Box A', 'RBCA', '00000000-0000-4000-a9bc-0000000000e0', NULL),
  ('00000000-0000-4000-b9bc-00000000000b', 'Box B', 'RBCB', '00000000-0000-4000-a9bc-0000000000e4', NULL),
  ('00000000-0000-4000-b9bc-00000000000f', 'Box Z', 'RBCZ', '00000000-0000-4000-a9bc-0000000000e4', now() - interval '1 day');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active) VALUES
  ('00000000-0000-4000-e9bc-00000000000a', '00000000-0000-4000-b9bc-00000000000a', 'Illimité', 8900, 'subscription', true),
  ('00000000-0000-4000-e9bc-00000000000f', '00000000-0000-4000-b9bc-00000000000f', 'Illimité', 8900, 'subscription', true),
  ('00000000-0000-4000-e9bc-0000000000ea', '00000000-0000-4000-b9bc-00000000000a', 'Essai', 0, 'trial', true);

-- (suffixe, box, rôle, statut, formule ?, statut d'abonnement, impayé depuis)
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, past_due_since)
SELECT ('00000000-0000-4000-b9bc-00000000000' || b)::uuid, ('00000000-0000-4000-a9bc-0000000000' || m)::uuid, r, st,
       CASE WHEN f THEN ('00000000-0000-4000-e9bc-00000000000' || b)::uuid END, ss, depuis
  FROM (VALUES
    ('e1', 'a', 'coach',  'active',   false, NULL,       NULL::timestamptz),
    ('e2', 'a', 'owner',  'active',   false, NULL,       NULL),
    ('e6', 'f', 'coach',  'active',   false, NULL,       NULL),
    ('01', 'a', 'member', 'active',   true,  'active',   NULL),
    ('02', 'a', 'member', 'inactive', true,  'active',   NULL),
    ('03', 'a', 'member', 'banned',   true,  'active',   NULL),
    ('05', 'a', 'member', 'active',   true,  'active',   NULL),
    ('06', 'f', 'member', 'active',   true,  'active',   NULL),
    ('07', 'a', 'member', 'active',   false, NULL,       NULL),
    ('08', 'a', 'member', 'active',   true,  'past_due', now() - interval '30 days')
  ) v(m, b, r, st, f, ss, depuis);

-- Carnets dans A pour IN, BA et EX : la formule ne les arrête pas, la policy si.
INSERT INTO public.member_class_credits (member_id, box_id, credits_total, credits_used, expires_at, status)
SELECT ('00000000-0000-4000-a9bc-0000000000' || m)::uuid, '00000000-0000-4000-b9bc-00000000000a',
       10, 0, now() + interval '90 days', 'active'
  FROM unnest(ARRAY['02', '03', '04']) m;

-- Créneaux de demain : A 1 à 19 et 30 (une place), B 20 à 22, Z 25.
INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time, max_capacity)
SELECT ('00000000-0000-4000-d9bc-0000000000' || lpad(n::text, 2, '0'))::uuid,
       ('00000000-0000-4000-b9bc-00000000000' || CASE WHEN n BETWEEN 20 AND 22 THEN 'b' WHEN n = 25 THEN 'f' ELSE 'a' END)::uuid,
       'WOD ' || n, CURRENT_DATE + 1, '18:00', '19:00', CASE WHEN n = 30 THEN 1 ELSE 15 END
  FROM (SELECT generate_series(1, 22) UNION ALL SELECT 25 UNION ALL SELECT 30) g(n);

-- Une ligne ancienne dont la box ne correspond pas (posée sans les déclencheurs).
ALTER TABLE public.class_reservations DISABLE TRIGGER USER;
INSERT INTO public.class_reservations (id, schedule_id, member_id, box_id, status)
VALUES ('00000000-0000-4000-f9bc-000000000099', '00000000-0000-4000-d9bc-000000000021',
        '00000000-0000-4000-a9bc-000000000001', '00000000-0000-4000-b9bc-00000000000a', 'confirmed');
ALTER TABLE public.class_reservations ENABLE TRIGGER USER;

-- Exécute `p_sql` sous l'identité `p_qui` (suffixe, « service » ou « anon ») ;
-- rend « OK » ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK';
BEGIN
  IF p_qui IN ('service', 'anon') THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
    PERFORM set_config('role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9bc-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN v;
END $$;

-- Inscrit `p_membre` au créneau `p_creneau` en déclarant la box `p_box` (a, b, f ou NULL).
CREATE FUNCTION pg_temp.reserver(p_qui text, p_membre text, p_creneau int, p_box text, p_statut text DEFAULT 'confirmed')
RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire(p_qui, format(
    'INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status) VALUES (%L, %L, %L, %L)',
    '00000000-0000-4000-d9bc-0000000000' || lpad(p_creneau::text, 2, '0'),
    '00000000-0000-4000-a9bc-0000000000' || p_membre,
    CASE WHEN p_box IS NOT NULL THEN '00000000-0000-4000-b9bc-00000000000' || p_box END, p_statut));
$$;

DO $t$
DECLARE
  v text;
  m text;
  v_id uuid;
BEGIN
  -- ── B1 : membre actif de la box ───────────────────────────────────────────
  v := pg_temp.reserver('01', '01', 1, 'a');
  IF v <> 'OK' THEN RAISE EXCEPTION 'B1 : M1 refusé dans sa box : %', v; END IF;

  -- ── B2 : non-membre, inactif, banni ───────────────────────────────────────
  FOREACH m IN ARRAY ARRAY['04', '02', '03'] LOOP
    v := pg_temp.reserver(m, m, 2, 'a');
    IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'B2 : % : % (refus RLS 42501 attendu)', m, v; END IF;
  END LOOP;

  -- Un membre n'inscrit pas quelqu'un d'autre, même de sa box.
  v := pg_temp.reserver('01', '05', 2, 'a');
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'B2 : M1 inscrit M5 : % (refus RLS 42501 attendu)', v; END IF;

  -- ── B3 : le staff réserve pour lui-même ──────────────────────────────────
  FOREACH m IN ARRAY ARRAY['e1', 'e0', 'e2'] LOOP
    v := pg_temp.reserver(m, m, 3, 'a');
    IF v <> 'OK' THEN RAISE EXCEPTION 'B3 : staff % refusé : %', m, v; END IF;
  END LOOP;

  -- ── B4 : box déclarée différente de celle du créneau ─────────────────────
  v := pg_temp.reserver('01', '01', 20, 'a');   -- créneau de B, box A déclarée
  IF v NOT LIKE '23514: RESERVATION_BOX_MISMATCH%' THEN RAISE EXCEPTION 'B4 : M1, créneau de B déclaré A : %', v; END IF;
  v := pg_temp.reserver('01', '01', 4, 'b');    -- créneau de A, box B déclarée
  IF v NOT LIKE '23514: RESERVATION_BOX_MISMATCH%' THEN RAISE EXCEPTION 'B4 : M1, créneau de A déclaré B : %', v; END IF;
  v := pg_temp.reserver('07', '07', 20, 'a');   -- ordre : le refus de box passe avant NO_ACTIVE_PLAN
  IF v NOT LIKE '23514: RESERVATION_BOX_MISMATCH%' THEN RAISE EXCEPTION 'B4 : NF, créneau de B déclaré A : % (le contrôle de box doit passer en premier)', v; END IF;
  v := pg_temp.reserver('e1', '01', 20, 'a');   -- le coach de A, créneau de B
  IF v NOT LIKE '23514: RESERVATION_BOX_MISMATCH%' THEN RAISE EXCEPTION 'B4 : coach de A, créneau de B : %', v; END IF;
  v := pg_temp.reserver('service', '01', 20, 'a');
  IF v NOT LIKE '23514: RESERVATION_BOX_MISMATCH%' THEN RAISE EXCEPTION 'B4 : clé serveur, box différente : %', v; END IF;
  v := pg_temp.reserver('service', '01', 5, NULL);
  IF v NOT LIKE '23514: RESERVATION_BOX_MISMATCH%' THEN RAISE EXCEPTION 'B4 : clé serveur, box nulle : %', v; END IF;
  SELECT id INTO v_id FROM public.class_reservations
   WHERE member_id = '00000000-0000-4000-a9bc-000000000001' AND schedule_id = '00000000-0000-4000-d9bc-000000000001';
  v := pg_temp.faire('e1', format('UPDATE public.class_reservations SET schedule_id = %L WHERE id = %L',
                                  '00000000-0000-4000-d9bc-000000000022', v_id));
  IF v NOT LIKE '23514: RESERVATION_BOX_MISMATCH%' THEN RAISE EXCEPTION 'B4 : coach de A, UPDATE vers un créneau de B : %', v; END IF;
  v := pg_temp.faire('e1', format('UPDATE public.class_reservations SET box_id = %L WHERE id = %L',
                                  '00000000-0000-4000-b9bc-00000000000b', v_id));
  IF v NOT LIKE '23514: RESERVATION_BOX_MISMATCH%' THEN RAISE EXCEPTION 'B4 : coach de A, UPDATE de box_id vers B : %', v; END IF;
  IF EXISTS (SELECT 1 FROM public.class_reservations r JOIN public.class_schedules s ON s.id = r.schedule_id
              WHERE r.box_id IS DISTINCT FROM s.box_id AND r.id <> '00000000-0000-4000-f9bc-000000000099') THEN
    RAISE EXCEPTION 'B4 : une réservation à box incohérente a été écrite';
  END IF;

  -- ── B5 : UPDATE de attended, ligne ancienne incohérente ──────────────────
  v := pg_temp.faire('e1', $q$UPDATE public.class_reservations SET attended = true WHERE id = '00000000-0000-4000-f9bc-000000000099'$q$);
  IF v <> 'OK' OR NOT (SELECT attended FROM public.class_reservations WHERE id = '00000000-0000-4000-f9bc-000000000099') THEN
    RAISE EXCEPTION 'B5 : UPDATE de attended par le coach refusé : %', v;
  END IF;

  -- ── B6 : essai par le tunnel public ──────────────────────────────────────
  v := pg_temp.faire('anon', $q$SELECT set_config('rbc.essai', public.book_trial_slot(
         '00000000-0000-4000-b9bc-00000000000a', '00000000-0000-4000-d9bc-000000000006',
         'Essai', 'Test', 'rbc-essai@test.invalid', NULL)::text, true)$q$);
  IF v <> 'OK' OR current_setting('rbc.essai', true)::jsonb ->> 'ok' <> 'true' THEN
    RAISE EXCEPTION 'B6 : book_trial_slot : % / %', v, current_setting('rbc.essai', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_reservations WHERE schedule_id = '00000000-0000-4000-d9bc-000000000006' AND is_trial) THEN
    RAISE EXCEPTION 'B6 : aucune réservation d''essai écrite';
  END IF;

  -- ── B7 : promotion depuis la liste d'attente ─────────────────────────────
  v := pg_temp.reserver('01', '01', 30, 'a');
  IF v <> 'OK' THEN RAISE EXCEPTION 'B7 : M1 sur le créneau à une place : %', v; END IF;
  v := pg_temp.reserver('05', '05', 30, 'a', 'waiting');
  IF v <> 'OK' THEN RAISE EXCEPTION 'B7 : M5 en liste d''attente : %', v; END IF;
  v := pg_temp.faire('e0', $q$DELETE FROM public.class_reservations
    WHERE schedule_id = '00000000-0000-4000-d9bc-000000000030' AND member_id = '00000000-0000-4000-a9bc-000000000001'$q$);
  IF v <> 'OK' OR (SELECT status FROM public.class_reservations
                    WHERE schedule_id = '00000000-0000-4000-d9bc-000000000030' AND member_id = '00000000-0000-4000-a9bc-000000000005') <> 'confirmed' THEN
    RAISE EXCEPTION 'B7 : M5 n''a pas été promu (%)', v;
  END IF;

  -- ── B8 : box archivée ────────────────────────────────────────────────────
  v := pg_temp.faire('06', $q$INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status)
    VALUES ('00000000-0000-4000-d9bc-000000000025', '00000000-0000-4000-a9bc-000000000006', '00000000-0000-4000-b9bc-00000000000f', 'confirmed')$q$);
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'B8 : membre de la box archivée : % (42501 attendu)', v; END IF;
  v := pg_temp.faire('e6', $q$INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status)
    VALUES ('00000000-0000-4000-d9bc-000000000025', '00000000-0000-4000-a9bc-0000000000e6', '00000000-0000-4000-b9bc-00000000000f', 'confirmed')$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'B8 : coach de la box archivée refusé : %', v; END IF;

  -- ── B9 : refus et alerte des lots précédents, inchangés ──────────────────
  v := pg_temp.reserver('07', '07', 7, 'a');
  IF v NOT LIKE '23514: NO_ACTIVE_PLAN%' THEN RAISE EXCEPTION 'B9 : NF : % (NO_ACTIVE_PLAN attendu)', v; END IF;
  v := pg_temp.reserver('e1', '07', 7, 'a');
  IF v <> 'OK' OR NOT EXISTS (SELECT 1 FROM public.box_member_alerts
                               WHERE member_id = '00000000-0000-4000-a9bc-000000000007' AND resolved_at IS NULL) THEN
    RAISE EXCEPTION 'B9 : NF inscrit par le coach : % / alerte absente', v;
  END IF;
  v := pg_temp.reserver('08', '08', 8, 'a');
  IF v NOT LIKE '23514: MEMBERSHIP_PAST_DUE%' THEN RAISE EXCEPTION 'B9 : SU : % (MEMBERSHIP_PAST_DUE attendu)', v; END IF;

  RAISE NOTICE 'réservation, box du créneau : B1 à B9 conformes';
END $t$;

-- ── B10 : définitions figées et ordre des déclencheurs ───────────────────────
DO $t$
DECLARE
  f record;
  v text;
BEGIN
  -- Le search_path de la prod : pg_get_expr y écrit `auth.uid()` (ici, `auth`
  -- dans le search_path de supabase_admin l'abrégerait en `uid()`).
  PERFORM set_config('search_path', '"$user", public, extensions', true);
  FOR f IN SELECT * FROM (VALUES
    ('member_add_reservation',       'b6176ffa1101b39a7ca141d62f481bfd'),
    ('box_admin_insert_reservation', '8938b926ccdb55c112600fcfa4d8b094'),
    ('box_admin_update_reservation', '13ff327ba59d78668d4cb8c61635ba84'),
    ('box_admin_delete_reservation', 'd13d760ba32b63be56b658132c15cb1c'),
    ('member_delete_reservation',    '3f6e49d74640f035979b4d7759e7e435'),
    ('box_member_see_reservations',  'd8badeb436be496d8ae9f04a55654f10'),
    ('superadmin_read_reservations', '5b015041e7a71394d88b4ef7bc5c66a1')
  ) t(nom, attendu) LOOP
    SELECT md5(concat_ws('|', polname, polcmd, polpermissive, polroles::regrole[]::text,
                         pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)))
      INTO v FROM pg_policy WHERE polrelid = 'public.class_reservations'::regclass AND polname = f.nom;
    IF v IS DISTINCT FROM f.attendu THEN RAISE EXCEPTION 'B10 : policy % (md5 %, % attendu)', f.nom, v, f.attendu; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.class_reservations'::regclass) <> 7 THEN
    RAISE EXCEPTION 'B10 : nombre de policies de class_reservations changé';
  END IF;

  FOR f IN SELECT * FROM (VALUES
    ('internal.verifier_box_du_creneau()',          'c9f473625de05e52678cd4a8c50037fb'),
    ('public.consume_credit_on_reservation()',      'f6bc083f4c67cc88faa558a4eb061d29'),
    ('internal.bloquer_reservation_impaye()',       '3910a8d07c3da0fddf35f0b05bd75952'),
    ('internal.alerter_reservation_sans_formule()', 'c7d278376a5fd40f7370e3b5da50f263')
  ) t(sig, attendu) LOOP
    v := md5(pg_get_functiondef(f.sig::regprocedure));
    IF v <> f.attendu THEN RAISE EXCEPTION 'B10 : % a changé (md5 %, % attendu)', f.sig, v, f.attendu; END IF;
  END LOOP;

  IF (SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'trg_a0_box_du_creneau')
     <> 'CREATE TRIGGER trg_a0_box_du_creneau BEFORE INSERT OR UPDATE OF box_id, schedule_id ON public.class_reservations FOR EACH ROW EXECUTE FUNCTION internal.verifier_box_du_creneau()' THEN
    RAISE EXCEPTION 'B10 : trg_a0_box_du_creneau a changé';
  END IF;
  -- Ordre d'exécution : Postgres déclenche les BEFORE par ordre de nom.
  IF (SELECT tgname FROM pg_trigger
       WHERE tgrelid = 'public.class_reservations'::regclass AND NOT tgisinternal
         AND tgtype & 2 = 2 AND tgtype & 4 = 4          -- BEFORE, INSERT
       ORDER BY tgname COLLATE "C" LIMIT 1) <> 'trg_a0_box_du_creneau' THEN
    RAISE EXCEPTION 'B10 : trg_a0_box_du_creneau n''est pas le premier déclencheur BEFORE INSERT';
  END IF;

  IF has_function_privilege('anon', 'internal.verifier_box_du_creneau()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'internal.verifier_box_du_creneau()', 'EXECUTE') THEN
    RAISE EXCEPTION 'B10 : internal.verifier_box_du_creneau est exécutable par un rôle client';
  END IF;
  RAISE NOTICE 'B10 : définitions et ordre conformes';
END $t$;

ROLLBACK;
