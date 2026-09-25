-- ═════════════════════════════════════════════════════════════════════════════
-- Impayé : réservations bloquées après le délai de la box (migration 20270121)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Boxes : B1 (délai 3 jours), B0 (délai 0), B2 (délai par défaut, 7). Membres,
-- tous en formule abonnement de leur box, insérés comme le vrai client
-- (rôle authenticated + auth.uid()) sauf mention :
--   R1  M1 impayé depuis 1 jour (délai 3) : réservation acceptée ;
--   R2  M2 impayé depuis 5 jours (délai 3, donc suspendu — mais dans les 7
--       jours du défaut, ce qui piège un délai lu en dur) : réservation ET
--       liste d'attente refusées, message MEMBERSHIP_PAST_DUE ;
--   R3  M3 impayé à l'instant, délai 0 : refusé immédiatement ;
--   R5  la réservation prise par M2 avant sa suspension est toujours là ;
--   R6  le coach inscrit M2 lui-même depuis le back-office : accepté ;
--   R4  M2 repasse actif (past_due_since laissé tel quel, comme un webhook qui
--       ne le nettoie pas) : accepté sans autre action ;
--   R7  M4 actif et M5 au comptoir (subscription_status NULL) : acceptés ;
--   R8  anon : toujours refusé (RLS) ; M6, impayé depuis 5 jours dans B2
--       (délai 7) : accepté — l'autre box suit son propre délai ;
--   R9  crédits : M7 suspendu avec un carnet, inscrit par le staff → le crédit
--       est consommé (l'abonnement suspendu ne vaut plus abonnement) ; M8
--       impayé dans le délai avec un carnet → aucun crédit consommé.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Impayé : réservations bloquées après le délai avant suspension'

BEGIN;

-- Gérant O1 …e0, coach C1 …e1, membres M1 à M8 …01 à …08, gérants B0/B2 …e2/…e3.
INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9ee-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', '01', '02', '03', '04', '05', '06', '07', '08']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9ee-0000000000' || s)::uuid, 'ri-' || s || '@test.invalid', 'ri_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', '01', '02', '03', '04', '05', '06', '07', '08']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id, dunning_grace_days) VALUES
  ('00000000-0000-4000-b9ee-000000000001', 'Box délai 3', 'RIB1', '00000000-0000-4000-a9ee-0000000000e0', 3),
  ('00000000-0000-4000-b9ee-000000000000', 'Box délai 0', 'RIB0', '00000000-0000-4000-a9ee-0000000000e2', 0),
  ('00000000-0000-4000-b9ee-000000000002', 'Box délai défaut', 'RIB2', '00000000-0000-4000-a9ee-0000000000e3', DEFAULT);
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type) VALUES
  ('00000000-0000-4000-e9ee-000000000001', '00000000-0000-4000-b9ee-000000000001', 'Illimité', 8900, 'subscription'),
  ('00000000-0000-4000-e9ee-000000000000', '00000000-0000-4000-b9ee-000000000000', 'Illimité', 8900, 'subscription'),
  ('00000000-0000-4000-e9ee-000000000002', '00000000-0000-4000-b9ee-000000000002', 'Illimité', 8900, 'subscription');

-- Adhésions : (suffixe membre, box, plan ?, statut d'abonnement, impayé depuis).
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, past_due_since)
SELECT ('00000000-0000-4000-b9ee-00000000000' || b)::uuid, ('00000000-0000-4000-a9ee-0000000000' || m)::uuid,
       r, 'active',
       CASE WHEN avec_plan THEN ('00000000-0000-4000-e9ee-00000000000' || b)::uuid END,
       ss, depuis
  FROM (VALUES
    ('e0', '1', 'owner',  false, NULL,       NULL::timestamptz),
    ('e1', '1', 'coach',  false, NULL,       NULL),
    ('e2', '0', 'owner',  false, NULL,       NULL),
    ('e3', '2', 'owner',  false, NULL,       NULL),
    ('01', '1', 'member', true,  'past_due', now() - interval '1 day'),
    ('02', '1', 'member', true,  'past_due', now() - interval '5 days'),
    ('03', '0', 'member', true,  'past_due', now() - interval '1 minute'),
    ('04', '1', 'member', true,  'active',   NULL),
    ('05', '1', 'member', true,  NULL,       NULL),
    ('06', '2', 'member', true,  'past_due', now() - interval '5 days'),
    ('07', '1', 'member', true,  'past_due', now() - interval '5 days'),
    ('08', '1', 'member', true,  'past_due', now() - interval '1 day')
  ) v(m, b, r, avec_plan, ss, depuis);

-- Carnets de M7 (suspendu) et M8 (dans le délai).
INSERT INTO public.member_class_credits (id, member_id, box_id, credits_total, credits_used, expires_at, status)
SELECT ('00000000-0000-4000-c9ee-00000000000' || n)::uuid, ('00000000-0000-4000-a9ee-0000000000' || m)::uuid,
       '00000000-0000-4000-b9ee-000000000001', 10, 0, now() + interval '90 days', 'active'
  FROM (VALUES ('7', '07'), ('8', '08')) v(n, m);

-- Un créneau par cas, demain, capacité large.
INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time, max_capacity)
SELECT ('00000000-0000-4000-d9ee-0000000000' || lpad(n::text, 2, '0'))::uuid,
       ('00000000-0000-4000-b9ee-00000000000' || b)::uuid,
       'WOD ' || n, CURRENT_DATE + 1, '18:00', '19:00', 15
  FROM (VALUES (1, '1'), (2, '1'), (3, '0'), (4, '1'), (5, '1'), (6, '2'), (7, '1'), (8, '1'), (9, '1'), (10, '1')) v(n, b);

-- La réservation que M2 avait prise avant sa suspension (posée hors rôle client).
INSERT INTO public.class_reservations (id, schedule_id, member_id, box_id, status)
VALUES ('00000000-0000-4000-f9ee-000000000001', '00000000-0000-4000-d9ee-000000000009',
        '00000000-0000-4000-a9ee-000000000002', '00000000-0000-4000-b9ee-000000000001', 'confirmed');

CREATE FUNCTION pg_temp.reserver(p_qui text, p_membre text, p_creneau int, p_box text, p_statut text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_err text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9ee-0000000000' || p_qui, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status)
    VALUES (('00000000-0000-4000-d9ee-0000000000' || lpad(p_creneau::text, 2, '0'))::uuid,
            ('00000000-0000-4000-a9ee-0000000000' || p_membre)::uuid,
            ('00000000-0000-4000-b9ee-00000000000' || p_box)::uuid, p_statut);
    v_err := 'OK';
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  RETURN v_err;
END $$;

DO $t$
DECLARE
  v text;
  v_credit_id uuid;
BEGIN
  -- R1 : impayé dans le délai.
  v := pg_temp.reserver('01', '01', 1, '1', 'confirmed');
  IF v <> 'OK' THEN RAISE EXCEPTION 'R1 : M1 (impayé depuis 1 j, délai 3) refusé : %', v; END IF;

  -- R2 : suspendu — réservation puis liste d'attente.
  v := pg_temp.reserver('02', '02', 2, '1', 'confirmed');
  IF v NOT LIKE 'MEMBERSHIP_PAST_DUE%' THEN RAISE EXCEPTION 'R2 : M2 suspendu, réservation : % (MEMBERSHIP_PAST_DUE attendu)', v; END IF;
  v := pg_temp.reserver('02', '02', 4, '1', 'waiting');
  IF v NOT LIKE 'MEMBERSHIP_PAST_DUE%' THEN RAISE EXCEPTION 'R2 : M2 suspendu, liste d''attente : % (MEMBERSHIP_PAST_DUE attendu)', v; END IF;

  -- R3 : délai à 0.
  v := pg_temp.reserver('03', '03', 3, '0', 'confirmed');
  IF v NOT LIKE 'MEMBERSHIP_PAST_DUE%' THEN RAISE EXCEPTION 'R3 : M3 (délai 0) : % (refus attendu)', v; END IF;

  -- R5 : la réservation déjà prise par M2 est intacte.
  IF NOT EXISTS (SELECT 1 FROM public.class_reservations
                  WHERE id = '00000000-0000-4000-f9ee-000000000001' AND status = 'confirmed') THEN
    RAISE EXCEPTION 'R5 : la réservation existante de M2 a disparu ou changé';
  END IF;

  -- R6 : le coach inscrit M2 (le staff n'est pas bloqué).
  v := pg_temp.reserver('e1', '02', 2, '1', 'confirmed');
  IF v <> 'OK' THEN RAISE EXCEPTION 'R6 : inscription de M2 par le coach refusée : %', v; END IF;

  -- R4 : M2 régularise (le webhook remet active ; past_due_since reste) : tout se rétablit.
  UPDATE public.box_members SET subscription_status = 'active'
   WHERE member_id = '00000000-0000-4000-a9ee-000000000002';
  v := pg_temp.reserver('02', '02', 4, '1', 'confirmed');
  IF v <> 'OK' THEN RAISE EXCEPTION 'R4 : M2 redevenu actif encore refusé : %', v; END IF;

  -- R7 : membre actif, membre au comptoir.
  v := pg_temp.reserver('04', '04', 5, '1', 'confirmed');
  IF v <> 'OK' THEN RAISE EXCEPTION 'R7 : M4 actif refusé : %', v; END IF;
  v := pg_temp.reserver('05', '05', 10, '1', 'confirmed');
  IF v <> 'OK' THEN RAISE EXCEPTION 'R7 : M5 (comptoir) refusé : %', v; END IF;

  -- R8 : anon toujours refusé ; l'autre box suit son propre délai.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('role', 'anon', true);
  BEGIN
    INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status)
    VALUES ('00000000-0000-4000-d9ee-000000000006', '00000000-0000-4000-a9ee-000000000006',
            '00000000-0000-4000-b9ee-000000000002', 'confirmed');
    RAISE EXCEPTION 'R8 : anon a pu réserver';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('role', 'none', true);
  v := pg_temp.reserver('06', '06', 6, '2', 'confirmed');
  IF v <> 'OK' THEN RAISE EXCEPTION 'R8 : M6 (impayé 5 j, délai 7 de sa box) refusé : %', v; END IF;

  -- R9 : crédits. M7 suspendu + carnet, inscrit par le staff : crédit consommé.
  v := pg_temp.reserver('e1', '07', 7, '1', 'confirmed');
  IF v <> 'OK' THEN RAISE EXCEPTION 'R9 : inscription de M7 par le coach refusée : %', v; END IF;
  SELECT credit_id INTO v_credit_id FROM public.class_reservations
   WHERE member_id = '00000000-0000-4000-a9ee-000000000007';
  IF v_credit_id IS NULL
     OR (SELECT credits_used FROM public.member_class_credits WHERE id = '00000000-0000-4000-c9ee-000000000007') <> 1 THEN
    RAISE EXCEPTION 'R9 : M7 suspendu : son abonnement impayé a encore compté comme valide (aucun crédit consommé)';
  END IF;
  -- M8 impayé dans le délai + carnet : l'abonnement vaut, aucun crédit consommé.
  v := pg_temp.reserver('08', '08', 8, '1', 'confirmed');
  IF v <> 'OK' THEN RAISE EXCEPTION 'R9 : M8 (impayé dans le délai) refusé : %', v; END IF;
  IF (SELECT credit_id FROM public.class_reservations WHERE member_id = '00000000-0000-4000-a9ee-000000000008') IS NOT NULL
     OR (SELECT credits_used FROM public.member_class_credits WHERE id = '00000000-0000-4000-c9ee-000000000008') <> 0 THEN
    RAISE EXCEPTION 'R9 : M8 dans le délai : un crédit a été consommé à tort';
  END IF;

  RAISE NOTICE 'réservations en impayé : R1 à R9 conformes';
END $t$;

ROLLBACK;
